// Process-owned, read-only platform notifications. No daemon or audio rerouting.
#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <IOKit/pwr_mgt/IOPMLib.h>
#import <IOKit/IOMessage.h>
#include <stdatomic.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>

static io_connect_t powerPort;
static AudioDeviceID output = kAudioObjectUnknown;
static UInt32 jack = 0;
static bool aliveSupported = false;
static atomic_bool routeChanged;
static AudioObjectPropertyAddress defaultOutput = { kAudioHardwarePropertyDefaultOutputDevice, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain };
static AudioObjectPropertyAddress alive = { kAudioDevicePropertyDeviceIsAlive, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain };
static AudioObjectPropertyAddress connected = { kAudioDevicePropertyJackIsConnected, kAudioDevicePropertyScopeOutput, kAudioObjectPropertyElementMain };
static void event(const char *type) { printf("{\"type\":\"%s\"}\n", type); fflush(stdout); }
static bool property(AudioObjectID device, AudioObjectPropertyAddress address, UInt32 *value) {
  UInt32 size = sizeof(*value);
  return AudioObjectGetPropertyData(device, &address, 0, NULL, &size, value) == noErr;
}
static OSStatus changed(AudioObjectID object, UInt32 count, const AudioObjectPropertyAddress *addresses, void *context) {
  atomic_store(&routeChanged, true); return noErr;
}
static void route(void) {
  UInt32 next = kAudioObjectUnknown, isAlive = 1, nextJack = 0;
  property(kAudioObjectSystemObject, defaultOutput, &next);
  bool canReadAlive = output != kAudioObjectUnknown && property(output, alive, &isAlive);
  bool disconnected = output != kAudioObjectUnknown && (canReadAlive ? !isAlive : aliveSupported);
  if (output != kAudioObjectUnknown && (next != output || disconnected)) {
    if (disconnected) event("output-disconnected");
    AudioObjectRemovePropertyListener(output, &connected, changed, NULL);
    AudioObjectRemovePropertyListener(output, &alive, changed, NULL);
  }
  if (next != kAudioObjectUnknown) {
    bool hasJack = property(next, connected, &nextJack);
    if (next == output && hasJack && jack && !nextJack) event("output-disconnected");
    if (next != output) {
      AudioObjectAddPropertyListener(next, &connected, changed, NULL);
      AudioObjectAddPropertyListener(next, &alive, changed, NULL);
    }
  }
  output = next; jack = nextJack;
  aliveSupported = output != kAudioObjectUnknown && property(output, alive, &isAlive);
}
static void power(void *ref, io_service_t service, natural_t message, void *argument) {
  if (message == kIOMessageCanSystemSleep) IOAllowPowerChange(powerPort, (intptr_t)argument);
  if (message == kIOMessageSystemWillSleep) {
    event("sleep");
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 250 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{ IOAllowPowerChange(powerPort, (intptr_t)argument); });
  }
  if (message == kIOMessageSystemHasPoweredOn) event("wake");
}
int main(int argc, char **argv) {
  @autoreleasepool {
    pid_t parent = getppid();
    fcntl(STDIN_FILENO, F_SETFL, fcntl(STDIN_FILENO, F_GETFL) | O_NONBLOCK);
    IONotificationPortRef port = NULL; io_object_t notifier = 0;
    powerPort = IORegisterForSystemPower(NULL, &port, power, &notifier);
    if (!powerPort || !port) { event("unavailable"); return 1; }
    CFRunLoopAddSource(CFRunLoopGetCurrent(), IONotificationPortGetRunLoopSource(port), kCFRunLoopCommonModes);
    AudioObjectAddPropertyListener(kAudioObjectSystemObject, &defaultOutput, changed, NULL);
    route();
    id observer = nil;
    if (@available(macOS 12.0, *)) {
      void (^report)(NSNotification *) = ^(NSNotification *note) { event(NSProcessInfo.processInfo.lowPowerModeEnabled ? "low-power" : "normal-power"); };
      observer = [NSNotificationCenter.defaultCenter addObserverForName:NSProcessInfoPowerStateDidChangeNotification object:nil queue:nil usingBlock:report];
      report(nil);
    }
    event("ready-macos");
    while (getppid() == parent) {
      char buffer[16]; if (read(STDIN_FILENO, buffer, sizeof(buffer)) == 0) break;
      CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.5, false);
      if (atomic_exchange(&routeChanged, false)) route();
    }
    if (observer) [NSNotificationCenter.defaultCenter removeObserver:observer];
    AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &defaultOutput, changed, NULL);
    if (output != kAudioObjectUnknown) {
      AudioObjectRemovePropertyListener(output, &connected, changed, NULL);
      AudioObjectRemovePropertyListener(output, &alive, changed, NULL);
    }
    IODeregisterForSystemPower(&notifier); IOServiceClose(powerPort); IONotificationPortDestroy(port);
    return 0;
  }
}
