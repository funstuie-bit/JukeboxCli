import { beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import { FIRST_FRAME_PATCH, patchFirstFrame } from "../src/player/linux-visualizer-install";
import { waitForVisualizerReady } from "../src/player/fullscreen-visualizer";

const compiler = spawnSync("c++", ["--version"]).status === 0;
describe.skipIf(!compiler)("compiled projectM first-frame patch", () => {
  let executable: string;
  beforeAll(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-first-frame-"));
    executable = path.join(dir, "fixture");
    // Compile the exact code inserted into upstream, with a controllable engine.
    await fs.writeFile(path.join(dir, "test.cpp"), `
#include <cstdio>
#include <cstdlib>
struct QApplication { static void exit(int code) { std::exit(code); } };
struct Engine {
  int mode; bool selected = false;
  unsigned getPlaylistSize() { return mode == 0 ? 0 : 1; }
  void selectRandom(bool hard) { if (!hard) std::abort(); selected = true; }
  bool getErrorLoadingCurrentPreset() { return mode == 2; }
  bool selectedPresetIndex(unsigned& index) { index = 0; return selected; }
  void renderFrame() { if (!selected) { puts("IDLE_LOGO"); std::exit(99); } puts("REAL_PRESET_FRAME"); }
};
struct Widget {
  bool startupReady = false; Engine* m_projectM;
  void paintGL() { ${FIRST_FRAME_PATCH} }
};
int main(int argc, char** argv) {
  Engine engine{std::atoi(argv[1])}; Widget widget{false, &engine};
  widget.paintGL(); widget.paintGL(); return 0;
}
`);
    await execa("c++", ["-std=c++17", path.join(dir, "test.cpp"), "-o", executable]);
  });
  it("selects a hard-cut real preset before the first and every later rendered frame", async () => {
    const r = await execa(executable, ["1"]);
    expect(r.stdout).toBe("REAL_PRESET_FRAME\nREAL_PRESET_FRAME");
    expect(r.stderr.match(/JUKEBOXCLI_PROJECTM_READY/g)).toHaveLength(1);
  });
  it("renders no idle frame while the playlist is empty", async () => {
    expect((await execa(executable, ["0"])).stdout).toBe("");
  });
  it("fails without drawing the logo when all startup preset attempts fail", async () => {
    const r = await execa(executable, ["2"], { reject: false });
    expect(r.exitCode).toBe(78); expect(r.stdout).toBe("");
    expect(r.stderr).toContain("JUKEBOXCLI_PROJECTM_ERROR");
  });
});

it("rejects unexpected upstream source instead of building without the fix", () => {
  expect(() => patchFirstFrame("different source")).toThrow("Unexpected");
  expect(patchFirstFrame("int mouseHideTimeoutSeconds; m_projectM->renderFrame();")).toContain(FIRST_FRAME_PATCH);
});

it("waits for native readiness, including a split marker, instead of treating spawn as success", async () => {
  const child = spawn(process.execPath, ["-e", `setTimeout(()=>{process.stderr.write('JUKEBOXCLI_PROJECTM_');setTimeout(()=>process.stderr.write('READY\\n'),30)},100);setInterval(()=>{},1000)`], { stdio: ["ignore", "ignore", "pipe"] });
  let complete = false;
  try {
    const ready = waitForVisualizerReady(child).then(r => { complete = true; return r; });
    await new Promise(r => setTimeout(r, 30)); expect(complete).toBe(false);
    expect((await ready).ok).toBe(true);
  } finally { child.kill("SIGKILL"); }
});

it("stops its own companion on startup timeout", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: ["ignore", "ignore", "pipe"] });
  try {
    expect((await waitForVisualizerReady(child, undefined, 100)).ok).toBe(false);
    expect(child.killed).toBe(true);
  } finally { child.kill("SIGKILL"); }
});

it("does not lose readiness when a preset emits a large burst of shader diagnostics", async () => {
  const child = spawn(process.execPath, ["-e", "process.stderr.write('JUKEBOXCLI_PROJECTM_READY\\n'+'x'.repeat(12000));setInterval(()=>{},1000)"], { stdio: ["ignore", "ignore", "pipe"] });
  try { expect((await waitForVisualizerReady(child)).ok).toBe(true); }
  finally { child.kill("SIGKILL"); }
});
