// Per-mpv PulseAudio monitor. No routing changes and no second playback stream.
// Called on the PulseAudio event thread; callbacks and query state stay there.
namespace JukeboxCapture {
static pa_context* ctx = nullptr;
static pa_stream* capture = nullptr;
static QProjectM_MainWindow* window = nullptr;
static const char* targetPid = nullptr;
static uint32_t input = PA_INVALID_INDEX, sink = PA_INVALID_INDEX;
static uint32_t foundInput = PA_INVALID_INDEX, foundSink = PA_INVALID_INDEX;
static bool querying = false, dirty = false;
static void query();
static void stop() {
    if (capture) {
        pa_stream_set_state_callback(capture, nullptr, nullptr);
        pa_stream_set_read_callback(capture, nullptr, nullptr);
        pa_stream_disconnect(capture);
        pa_stream_unref(capture);
        capture = nullptr;
    }
    input = sink = PA_INVALID_INDEX;
}
static void read(pa_stream* stream, size_t, void*) {
    const void* data = nullptr; size_t bytes = 0;
    if (pa_stream_peek(stream, &data, &bytes) < 0) return;
    // Pulse holes contain no PCM. Never dereference them or retain PCM buffers.
    if (data && bytes) window->addPCM((float*)data, bytes / sizeof(float));
    if (bytes) pa_stream_drop(stream);
}
static void state(pa_stream* stream, void*) {
    if (pa_stream_get_state(stream) == PA_STREAM_READY) {
        fprintf(stderr, "JUKEBOXCLI_AUDIO_READY\n"); fflush(stderr);
    } else if (pa_stream_get_state(stream) == PA_STREAM_FAILED) {
        // Fail closed; never fall back to the default microphone/system mix.
        fprintf(stderr, "JUKEBOXCLI_PROJECTM_ERROR: process audio capture failed\n");
        fflush(stderr);
        stop();
    }
}
static void finish() {
    querying = false;
    if (dirty) { dirty = false; query(); }
}
static void sinkInfo(pa_context*, const pa_sink_info* info, int eol, void*) {
    if (eol) { finish(); return; }
    if (!info || !info->monitor_source_name) return;
    const pa_sample_spec spec = { PA_SAMPLE_FLOAT32NE, 44100, 2 };
    capture = pa_stream_new(ctx, "JukeboxCli effects (mpv only)", &spec, nullptr);
    if (!capture) { finish(); return; }
    pa_stream_set_state_callback(capture, state, nullptr);
    pa_stream_set_read_callback(capture, read, nullptr);
    const pa_buffer_attr buffering = { 65536, UINT32_MAX, UINT32_MAX, UINT32_MAX, 7056 }; // ~20 ms stereo PCM
    if (pa_stream_set_monitor_stream(capture, input) < 0 ||
        pa_stream_connect_record(capture, info->monitor_source_name, &buffering, PA_STREAM_ADJUST_LATENCY) < 0) {
        fprintf(stderr, "JUKEBOXCLI_PROJECTM_ERROR: process monitor unavailable\n");
        fflush(stderr); stop();
    }
}
static void inputInfo(pa_context*, const pa_sink_input_info* info, int eol, void*) {
    if (!eol) {
        if (!info) return;
        const char* pid = pa_proplist_gets(info->proplist, PA_PROP_APPLICATION_PROCESS_ID);
        if (pid && strcmp(pid, targetPid) == 0 && foundInput == PA_INVALID_INDEX) {
            foundInput = info->index; foundSink = info->sink;
        }
        return;
    }
    if (eol < 0) { stop(); finish(); return; }
    if (foundInput == input && foundSink == sink && capture) { finish(); return; }
    stop();
    if (foundInput == PA_INVALID_INDEX) { finish(); return; } // pause/track change: wait for the next event
    input = foundInput; sink = foundSink;
    pa_operation* op = pa_context_get_sink_info_by_index(ctx, sink, sinkInfo, nullptr);
    if (op) pa_operation_unref(op); else finish();
}
static void query() {
    if (querying) { dirty = true; return; }
    querying = true; foundInput = foundSink = PA_INVALID_INDEX;
    pa_operation* op = pa_context_get_sink_input_info_list(ctx, inputInfo, nullptr);
    if (op) pa_operation_unref(op); else finish();
}
static void changed(pa_context*, pa_subscription_event_type_t, uint32_t, void*) { query(); }
static void start(pa_context* context, QProjectM_MainWindow* view, const char* pid) {
    ctx = context; window = view; targetPid = pid;
    pa_context_set_subscribe_callback(ctx, changed, nullptr);
    pa_operation* op = pa_context_subscribe(ctx, (pa_subscription_mask_t)(PA_SUBSCRIPTION_MASK_SINK_INPUT | PA_SUBSCRIPTION_MASK_SINK), nullptr, nullptr);
    if (op) pa_operation_unref(op);
    query();
}
}
