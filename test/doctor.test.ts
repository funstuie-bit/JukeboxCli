import { afterEach, expect, it, vi } from "vitest";
import { execa } from "execa";
import { installationReport } from "../src/cli/doctor";
vi.mock("../src/util/exec", () => ({ findOnPath: vi.fn(async (name: string) => "/fixture/" + name) }));
vi.mock("execa", () => ({ execa: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

it("allows bounded cold yt-dlp startup while keeping other probes short", async () => {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  vi.mocked(execa).mockResolvedValue({ stdout: "fixture version" } as never);
  const report = await installationReport();
  expect(report.ok).toBe(true);
  expect(report.toolsMode).toContain("managed");
  expect(execa).toHaveBeenCalledWith("/fixture/yt-dlp", ["--version"], { timeout: 15000 });
  expect(execa).toHaveBeenCalledWith("/fixture/ffmpeg", ["-version"], { timeout: 5000 });
});

it.each([
  [{ timedOut: true }, "Timed out after 15 seconds"],
  [{ exitCode: 1 }, "Exited with code 1"],
  [{ code: "ENOENT" }, "Could not start executable"],
])("reports the actual probe failure without exposing process output", async (failure, message) => {
  vi.mocked(execa).mockRejectedValue({ ...failure, stderr: "private diagnostic data" });
  const report = await installationReport();
  expect(report.ok).toBe(false);
  expect(report.tools.find(tool => tool.name === "yt-dlp")?.error).toBe(message);
  expect(JSON.stringify(report)).not.toContain("private diagnostic data");
});
