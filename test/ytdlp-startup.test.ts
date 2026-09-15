import { afterEach, expect, it, vi } from "vitest";
import { execa } from "execa";
import { checkYtDlpStartup, downloadVerified } from "../src/bin/ytdlp-fetch";

vi.mock("execa", () => ({ execa: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

it("allows a cold startup that takes more than ten seconds", async () => {
  vi.useFakeTimers();
  vi.mocked(execa).mockImplementation(((_file: string, _args: string[], options: { timeout: number }) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject({ timedOut: true }), options.timeout);
      setTimeout(() => { clearTimeout(timeout); resolve({ stdout: "2026.08.30.232658" }); }, 10_073);
    })) as typeof execa);
  const result = checkYtDlpStartup("/fixture/yt-dlp");
  await vi.advanceTimersByTimeAsync(10_074);
  await expect(result).resolves.toBe(true);
  expect(execa).toHaveBeenCalledWith("/fixture/yt-dlp", ["--version"], { timeout: 60_000 });
});

it.each([
  [{ timedOut: true }, "startup timed out after 60 seconds"],
  [{ exitCode: 1 }, "startup exited with code 1"],
  [{ code: "EACCES" }, "could not start (EACCES)"],
  [{ signal: "SIGKILL" }, "startup was terminated (SIGKILL)"],
])("reports startup failure without blaming antivirus: %j", async (failure, reason) => {
  vi.mocked(execa).mockRejectedValue(failure);
  const remove = vi.fn();
  await expect(downloadVerified("/fixture/yt-dlp", async () => {}, checkYtDlpStartup, remove))
    .rejects.toThrow(`JukeboxCli downloaded yt-dlp, but verification failed: ${reason}. The update was not installed.`);
  expect(remove).toHaveBeenCalledTimes(2);
});
