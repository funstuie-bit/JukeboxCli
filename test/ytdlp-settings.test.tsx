import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { makeStore } from "../scripts/fake-data";
import { StoreContext } from "../src/ui/store";
import { Settings } from "../src/ui/sections/Settings";
import { defaultConfig, type Config } from "../src/config/config";
import { updateYtDlpNow } from "../src/bin/ytdlp-update";
import { detectSystemYtDlp } from "../src/bin/ytdlp-fetch";

vi.mock("../src/bin/ytdlp-update", () => ({ updateYtDlpNow: vi.fn() }));
vi.mock("../src/bin/ytdlp-fetch", async original => ({
  ...await original<typeof import("../src/bin/ytdlp-fetch")>(), detectSystemYtDlp: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs(); });
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
async function open(initial: Partial<Config> = {}) {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  const save = vi.fn();
  function Fixture() {
    const [config, setConfig] = useState({ ...defaultConfig, ...initial });
    return <StoreContext.Provider value={makeStore({ config, region: "content", listRows: 20,
      binaries: { mpv: "mpv", ffmpeg: "ffmpeg", ffprobe: "ffprobe", ytDlp: "/fixture/system/yt-dlp" },
      setConfig: next => { save(next); setConfig(next); } })}><Settings /></StoreContext.Provider>;
  }
  const view = render(<Fixture />);
  await wait();
  for (let i = 0; i < 6; i++) { view.stdin.write("\u001b[B"); await wait(); }
  view.stdin.write("\r"); await wait();
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Active this launch: system"));
  return { view, save };
}

it("allows Homebrew users to stage nightly without claiming it is already active", async () => {
  vi.mocked(updateYtDlpNow).mockResolvedValue("2026.09.14.123");
  const { view, save } = await open();
  expect(view.lastFrame()).toContain("Next launch: system");
  view.stdin.write("\r");
  await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ ytdlpProvider: "managed", ytdlpChannel: "nightly" })));
  expect(updateYtDlpNow).toHaveBeenCalledWith("nightly");
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Restart JukeboxCli to apply"));
  expect(view.lastFrame()).toContain("Active this launch: system");
  expect(view.lastFrame()).toContain("Next launch: app-managed nightly");
});

it("keeps preferences unchanged when an update fails", async () => {
  vi.mocked(updateYtDlpNow).mockRejectedValue(Error("Could not download update"));
  const { view, save } = await open();
  view.stdin.write("\r");
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Could not download update"));
  expect(save).not.toHaveBeenCalled();
});

it("switches back to system only after confirming a runnable system binary", async () => {
  vi.mocked(detectSystemYtDlp).mockResolvedValue("/fixture/system/yt-dlp");
  const { view, save } = await open({ ytdlpProvider: "managed" });
  for (let i = 0; i < 2; i++) { view.stdin.write("\u001b[B"); await wait(); }
  view.stdin.write("\r");
  await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ ytdlpProvider: "system" })));
  expect(updateYtDlpNow).not.toHaveBeenCalled();
});
