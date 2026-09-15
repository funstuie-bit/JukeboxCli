import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ytDlpProvider } from "../src/bin/ytdlp-policy";

vi.mock("../src/util/exec", () => ({ findOnPath: async () => "/fixture/system/yt-dlp" }));
vi.mock("execa", () => ({ execa: vi.fn(async () => ({ stdout: "2026.09.14" })) }));
afterEach(() => { vi.unstubAllEnvs(); });

it("retains installer defaults but permits a yt-dlp-only override", () => {
  expect(ytDlpProvider(undefined, { JUKEBOXCLI_SYSTEM_TOOLS: "1" })).toBe("system");
  expect(ytDlpProvider("managed", { JUKEBOXCLI_SYSTEM_TOOLS: "1" })).toBe("managed");
  expect(ytDlpProvider(undefined, {})).toBe("managed");
  expect(ytDlpProvider("system", {})).toBe("system");
});

it("uses the cache only on opt-in, promotes staged updates on restart, and can return to system", async () => {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  vi.resetModules();
  let tool = await import("../src/bin/ytdlp-fetch");
  await fs.mkdir(path.dirname(tool.ytDlpPath()), { recursive: true });
  await fs.writeFile(tool.ytDlpPath(), "previous cached version");
  await fs.writeFile(tool.stagedYtDlpPath(), "new nightly version");
  expect(await tool.ensureYtDlp()).toBe("/fixture/system/yt-dlp");
  expect(await fs.readFile(tool.stagedYtDlpPath(), "utf8")).toBe("new nightly version");
  expect(await fs.readFile(tool.ytDlpPath(), "utf8")).toBe("previous cached version");

  vi.resetModules(); // restart with the saved preference
  tool = await import("../src/bin/ytdlp-fetch");
  expect(await tool.ensureYtDlp(undefined, "nightly", "managed")).toBe(tool.ytDlpPath());
  expect(tool.resolvedYtDlpPath()).toBe(tool.ytDlpPath());
  expect(await fs.readFile(tool.ytDlpPath(), "utf8")).toBe("new nightly version");
  expect(process.env.JUKEBOXCLI_SYSTEM_TOOLS).toBe("1");
  // The running process stays on its existing provider until restart.
  expect(await tool.ensureYtDlp(undefined, "nightly", "system")).toBe(tool.ytDlpPath());

  vi.resetModules();
  tool = await import("../src/bin/ytdlp-fetch");
  expect(await tool.ensureYtDlp(undefined, "nightly", "system")).toBe("/fixture/system/yt-dlp");
  expect(tool.resolvedYtDlpPath()).toBe("/fixture/system/yt-dlp");
  expect(await fs.readFile(tool.ytDlpPath(), "utf8")).toBe("new nightly version");
});
