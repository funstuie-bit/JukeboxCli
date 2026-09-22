// Optional JukeboxCli companion. projectM is dynamically linked (LGPL-2.1-or-later).
#import <Cocoa/Cocoa.h>
#import <CoreAudio/CoreAudio.h>
#import <CoreAudio/CATapDescription.h>
#import <CoreAudio/AudioHardwareTapping.h>
#import <OpenGL/gl3.h>
#include <projectM-4/projectM.h>
#include <atomic>
#include <array>
#include <algorithm>
#include <chrono>
#include <filesystem>
#include <random>
#include <thread>
#include <vector>
#include <cstdio>
#include <unistd.h>
#include <signal.h>

@interface VisualizerWindow : NSWindow
@end
@implementation VisualizerWindow
- (BOOL)canBecomeKeyWindow { return YES; }
- (BOOL)canBecomeMainWindow { return YES; }
@end

// Single producer (CoreAudio), single consumer (render thread). Drop excess
// samples instead of allocating or blocking the realtime audio callback.
struct AudioRing {
    static constexpr uint32_t capacity = 65536;
    std::array<std::array<float, 2>, capacity> samples{};
    std::atomic<uint32_t> write{0}, read{0};
    void push(float l, float r) {
        auto w = write.load(std::memory_order_relaxed);
        if (w - read.load(std::memory_order_acquire) >= capacity) return;
        samples[w % capacity] = {l, r};
        write.store(w + 1, std::memory_order_release);
    }
    unsigned pop(float* out, unsigned max) {
        auto r = read.load(std::memory_order_relaxed);
        auto count = std::min(max, write.load(std::memory_order_acquire) - r);
        for (unsigned i = 0; i < count; ++i) {
            out[2*i] = samples[(r+i) % capacity][0];
            out[2*i+1] = samples[(r+i) % capacity][1];
        }
        read.store(r + count, std::memory_order_release);
        return count;
    }
};

static OSStatus capture(AudioDeviceID, const AudioTimeStamp*, const AudioBufferList* in,
                        const AudioTimeStamp*, AudioBufferList*, const AudioTimeStamp*, void* ctx) {
    if (!in || !in->mNumberBuffers) return noErr;
    auto& ring = *static_cast<AudioRing*>(ctx);
    const auto& first = in->mBuffers[0];
    if (!first.mData || !first.mNumberChannels) return noErr;
    const auto* left = static_cast<const float*>(first.mData);
    auto frames = first.mDataByteSize / (sizeof(float) * first.mNumberChannels);
    if (first.mNumberChannels >= 2) {
        for (unsigned i=0; i<frames; ++i) ring.push(left[i*first.mNumberChannels], left[i*first.mNumberChannels+1]);
    } else {
        const float* right = left;
        if (in->mNumberBuffers >= 2 && in->mBuffers[1].mData) {
            right = static_cast<const float*>(in->mBuffers[1].mData);
            frames = std::min<size_t>(frames, in->mBuffers[1].mDataByteSize / sizeof(float));
        }
        for (unsigned i=0; i<frames; ++i) ring.push(left[i], right[i]);
    }
    return noErr;
}

struct AudioTap {
    AudioObjectID tap = kAudioObjectUnknown;
    AudioDeviceID device = kAudioObjectUnknown;
    AudioDeviceIOProcID io = nullptr;
    AudioRing ring;
    ~AudioTap() {
        if (io) { AudioDeviceStop(device, io); AudioDeviceDestroyIOProcID(device, io); }
        if (device != kAudioObjectUnknown) AudioHardwareDestroyAggregateDevice(device);
        if (tap != kAudioObjectUnknown) AudioHardwareDestroyProcessTap(tap);
    }
    bool start(pid_t pid) {
        AudioObjectID process = kAudioObjectUnknown;
        UInt32 size = sizeof(process);
        AudioObjectPropertyAddress address = {kAudioHardwarePropertyTranslatePIDToProcessObject,
            kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain};
        OSStatus status = AudioObjectGetPropertyData(kAudioObjectSystemObject, &address, sizeof(pid), &pid, &size, &process);
        if (status || process == kAudioObjectUnknown) {
            fprintf(stderr, "Start music in JukeboxCli before opening fullscreen effects.\n"); return false;
        }
        CATapDescription* description = [[CATapDescription alloc] initStereoMixdownOfProcesses:@[@(process)]];
        description.UUID = [NSUUID UUID];
        description.name = @"JukeboxCli visualiser";
        description.privateTap = YES;
        description.muteBehavior = CATapUnmuted;
        status = AudioHardwareCreateProcessTap(description, &tap);
        if (status) {
            fprintf(stderr, "Audio capture failed (%d). Allow JukeboxCli Visualizer in System Settings > Privacy & Security > Screen & System Audio Recording, then reopen effects.\n", (int)status);
            return false;
        }
        AudioStreamBasicDescription format{};
        size = sizeof(format);
        address.mSelector = kAudioTapPropertyFormat;
        status = AudioObjectGetPropertyData(tap, &address, 0, nullptr, &size, &format);
        if (status || format.mFormatID != kAudioFormatLinearPCM || !(format.mFormatFlags & kAudioFormatFlagIsFloat) || format.mBitsPerChannel != 32) {
            fprintf(stderr, "This audio output does not provide 32-bit float capture.\n"); return false;
        }
        // A private, tap-only aggregate. Never change the default output, mute
        // playback, or include a microphone/other applications in the mix.
        NSDictionary* spec = @{
            @kAudioAggregateDeviceNameKey: @"JukeboxCli visualiser",
            @kAudioAggregateDeviceUIDKey: [NSUUID UUID].UUIDString,
            @kAudioAggregateDeviceIsPrivateKey: @YES,
            @kAudioAggregateDeviceTapAutoStartKey: @YES,
            @kAudioAggregateDeviceTapListKey: @[@{
                @kAudioSubTapUIDKey: description.UUID.UUIDString,
                @kAudioSubTapDriftCompensationKey: @YES
            }]
        };
        status = AudioHardwareCreateAggregateDevice((__bridge CFDictionaryRef)spec, &device);
        if (!status) status = AudioDeviceCreateIOProcID(device, capture, &ring, &io);
        if (!status) status = AudioDeviceStart(device, io);
        if (status) fprintf(stderr, "Could not start the private audio tap (%d). Check audio-recording permission and reopen effects.\n", (int)status);
        return status == noErr;
    }
};

struct Presets {
    projectm_handle renderer;
    std::vector<std::string> files;
    size_t next = 0;
    bool failed = false;
    bool requested = false;
    bool load(bool smooth) {
        // Bad or unsupported presets must not expose the built-in idle logo.
        for (size_t attempts=0; attempts<std::min<size_t>(files.size(), 100); ++attempts) {
            failed = false;
            projectm_load_preset_file(renderer, files[next++ % files.size()].c_str(), smooth);
            if (!failed) return true;
        }
        fprintf(stderr, "No compatible preset could be loaded. Reinstall the visualiser pack.\n");
        return false;
    }
};

int main(int argc, const char* argv[]) {
    @autoreleasepool {
        if (argc == 2 && std::string(argv[1]) == "--check") {
            puts("JukeboxCli Visualizer 1 (projectM 4, CoreAudio process tap)"); return 0;
        }
        bool smoke = argc == 4 && std::string(argv[1]) == "--smoke";
        if (argc != 4) { fprintf(stderr, "Expected player PID, preset directory and texture directory.\n"); return 1; }
        pid_t pid = smoke ? 0 : (pid_t)strtol(argv[1], nullptr, 10);
        if (!smoke && pid <= 1) return 1;
        // Parent death closes the pipe, even after SIGKILL. Exit while a system
        // permission dialog is pending too; no orphan visualiser/audio tap.
        if (!smoke) std::thread([] { char byte; while (::read(STDIN_FILENO, &byte, 1) > 0) {} _exit(0); }).detach();
        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:smoke ? NSApplicationActivationPolicyProhibited : NSApplicationActivationPolicyRegular];
        [NSApp finishLaunching];
        NSOpenGLPixelFormatAttribute attributes[] = {NSOpenGLPFAOpenGLProfile, NSOpenGLProfileVersion4_1Core,
            NSOpenGLPFAAccelerated, NSOpenGLPFADoubleBuffer, NSOpenGLPFAColorSize, 24, 0};
        NSOpenGLPixelFormat* pixelFormat = [[NSOpenGLPixelFormat alloc] initWithAttributes:attributes];
        NSRect rect = smoke ? NSMakeRect(0, 0, 640, 360) : [NSScreen mainScreen].frame;
        NSWindow* window = [[VisualizerWindow alloc] initWithContentRect:rect styleMask:NSWindowStyleMaskBorderless
            backing:NSBackingStoreBuffered defer:NO];
        window.title = @"JukeboxCli Visualizer";
        NSOpenGLView* view = [[NSOpenGLView alloc] initWithFrame:NSMakeRect(0, 0, rect.size.width, rect.size.height) pixelFormat:pixelFormat];
        window.contentView = view;
        [view.openGLContext makeCurrentContext];
        if (!view.openGLContext || !glGetString(GL_VERSION)) { fprintf(stderr, "Could not create an OpenGL 4.1 context.\n"); return 1; }
        GLint interval = 1;
        [view.openGLContext setValues:&interval forParameter:NSOpenGLContextParameterSwapInterval];
        auto renderer = projectm_create();
        if (!renderer) { fprintf(stderr, "Could not initialise projectM.\n"); return 1; }
        // Logical points avoid a 4K/5K Retina render target and keep GPU use sane.
        projectm_set_window_size(renderer, (size_t)rect.size.width, (size_t)rect.size.height);
        projectm_set_fps(renderer, 60);
        projectm_set_preset_duration(renderer, 30);
        const char* textures[] = {argv[3]};
        projectm_set_texture_search_paths(renderer, textures, 1);
        Presets presets{renderer};
        try {
            for (const auto& entry : std::filesystem::recursive_directory_iterator(argv[2])) {
                if (entry.is_regular_file() && entry.path().extension() == ".milk") presets.files.push_back(entry.path().string());
            }
        } catch (...) { fprintf(stderr, "Preset pack is missing or unreadable.\n"); projectm_destroy(renderer); return 1; }
        if (presets.files.empty()) { fprintf(stderr, "No MilkDrop presets installed.\n"); projectm_destroy(renderer); return 1; }
        std::mt19937 rng(std::random_device{}());
        std::shuffle(presets.files.begin(), presets.files.end(), rng);
        projectm_set_preset_switch_failed_event_callback(renderer, [](const char*, const char*, void* ctx) {
            static_cast<Presets*>(ctx)->failed = true;
        }, &presets);
        projectm_set_preset_switch_requested_event_callback(renderer, [](bool, void* ctx) {
            static_cast<Presets*>(ctx)->requested = true;
        }, &presets);
        // Load AND render a real preset before the window is ever made visible.
        if (!presets.load(false)) { projectm_destroy(renderer); return 1; }
        projectm_opengl_render_frame(renderer);
        [view.openGLContext flushBuffer];
        AudioTap audio;
        if (!smoke && !audio.start(pid)) { projectm_destroy(renderer); return 1; }
        if (!smoke) {
            [NSApp setPresentationOptions:NSApplicationPresentationAutoHideDock | NSApplicationPresentationAutoHideMenuBar];
            [window makeKeyAndOrderFront:nil];
            [NSApp activateIgnoringOtherApps:YES];
        }
        puts("READY"); fflush(stdout);
        auto last = std::chrono::steady_clock::now();
        std::array<float, 2048> pcm{};
        const unsigned block = std::min(1024u, projectm_pcm_get_max_samples());
        unsigned frames = 0;
        bool running = true;
        while (running) {
            @autoreleasepool {
                const auto frameStart = std::chrono::steady_clock::now();
                if (!smoke && kill(pid, 0) != 0) break;
                NSEvent* event;
                while ((event = [NSApp nextEventMatchingMask:NSEventMaskAny untilDate:[NSDate distantPast]
                    inMode:NSDefaultRunLoopMode dequeue:YES])) {
                    if (event.type == NSEventTypeKeyDown) {
                        NSString* key = event.charactersIgnoringModifiers.lowercaseString;
                        if (event.keyCode == 53 || [key isEqualToString:@"q"]) running = false;
                        if ([key isEqualToString:@"n"] || [key isEqualToString:@" "]) presets.requested = true;
                    }
                    [NSApp sendEvent:event];
                }
                if (!running) break;
                [view.openGLContext makeCurrentContext];
                if (presets.requested || (smoke && frames && frames % 10 == 0) || frameStart-last > std::chrono::seconds(30)) {
                    presets.requested = false;
                    if (!presets.load(!smoke)) { running = false; break; }
                    last = frameStart;
                }
                unsigned count;
                while ((count = audio.ring.pop(pcm.data(), block))) projectm_pcm_add_float(renderer, pcm.data(), count, PROJECTM_STEREO);
                projectm_opengl_render_frame(renderer);
                [view.openGLContext flushBuffer];
                if (smoke && ++frames >= 60) break;
                std::this_thread::sleep_until(frameStart + std::chrono::microseconds(16667));
            }
        }
        [window orderOut:nil];
        projectm_destroy(renderer);
        return smoke && frames < 60 ? 1 : 0;
    }
}
