import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), installed: vi.fn(), supported: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("../src/player/macos-visualizer-install", () => ({
  macVisualizerInstalled: mocks.installed,
  macVisualizerSupported: mocks.supported,
  macVisualizerPaths: () => ({ executable: "/example/visualizer", presets: "/example/presets", textures: "/example/textures" }),
}));
import { closeFullscreenVisualizer, launchFullscreenVisualizer } from "../src/player/fullscreen-visualizer";

function fakeChild() {
  return Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    exitCode: null, killed: false, kill: vi.fn(), pid: 777 });
}
describe("Mac fullscreen lifecycle", () => {
  beforeEach(() => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mocks.supported.mockReturnValue(true);
    mocks.installed.mockResolvedValue(true);
    mocks.spawn.mockReset();
  });
  afterEach(() => { closeFullscreenVisualizer(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("does not download or spawn anything when the pack is missing", async () => {
    mocks.installed.mockResolvedValue(false);
    expect(await launchFullscreenVisualizer(123)).toMatchObject({ ok: false, message: expect.stringContaining("--install-visualizer") });
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("requires an existing player, never creating a second playback backend", async () => {
    expect(await launchFullscreenVisualizer()).toMatchObject({ ok: false, message: expect.stringContaining("Play music") });
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("waits for a rendered preset, passes the existing PID and owns a lifetime pipe", async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);
    const opening = launchFullscreenVisualizer(123);
    const duplicate = launchFullscreenVisualizer(123);
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(1));
    expect(mocks.spawn).toHaveBeenCalledWith("/example/visualizer", ["123", "/example/presets", "/example/textures"], { stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.write("REA");
    child.stdout.write("DY\n");
    expect(await opening).toMatchObject({ ok: true });
    expect(await duplicate).toMatchObject({ ok: true });
    expect(await launchFullscreenVisualizer(123)).toMatchObject({ message: expect.stringContaining("already open") });
    closeFullscreenVisualizer();
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
  it("reports native permission/startup errors rather than claiming it opened", async () => {
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);
    const opening = launchFullscreenVisualizer(123);
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalled());
    child.stderr.write("Allow audio-recording permission.\n");
    child.emit("exit", 1);
    expect(await opening).toEqual({ ok: false, message: "Allow audio-recording permission." });
  });
  it("bounds a stalled launch and stops its child", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    mocks.spawn.mockReturnValue(child);
    const opening = launchFullscreenVisualizer(123);
    await vi.advanceTimersByTimeAsync(120_001);
    expect(await opening).toMatchObject({ ok: false, message: expect.stringContaining("timed out") });
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
});
