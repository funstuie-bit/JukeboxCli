import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/util/exec", async original => ({ ...await original<typeof import("../src/util/exec")>(), findOnPath: vi.fn(async (name: string) => "/fixture/" + name) }));
vi.mock("execa", () => ({ execa: vi.fn(async () => ({ stdout: "fixture version" })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
it("uses managed PATH tools without fetching or touching the profile", async () => {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  const fetcher = vi.fn(() => { throw Error("Unexpected download"); }); vi.stubGlobal("fetch", fetcher);
  const yt = await import("../src/bin/ytdlp-fetch");
  const ff = await import("../src/bin/ffmpeg-fetch");
  expect(await yt.ensureYtDlp()).toBe("/fixture/yt-dlp");
  await ff.ensureFfmpeg();
  expect(ff.resolvedFfmpegPath()).toBe("/fixture/ffmpeg");
  expect(ff.resolvedFfprobePath()).toBe("/fixture/ffprobe"); expect(fetcher).not.toHaveBeenCalled();
});
