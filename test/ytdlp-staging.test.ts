import { afterEach, expect, it, vi } from "vitest";
import { updateYtDlpNow } from "../src/bin/ytdlp-update";
import { downloadVerified, downloadYtDlp, stagedYtDlpPath, finalizeStagedYtDlp } from "../src/bin/ytdlp-fetch";
import type { FetchImpl } from "../src/util/net";

vi.mock("../src/bin/ytdlp-fetch", async original => ({
  ...await original<typeof import("../src/bin/ytdlp-fetch")>(),
  downloadVerified: vi.fn(), downloadYtDlp: vi.fn(), finalizeStagedYtDlp: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const fetcher: FetchImpl = async () => ({ headers: new Headers({ location: "https://github.com/yt-dlp/yt-dlp/releases/tag/2026.09.14" }) }) as Response;

it("stages and checks the executable without replacing the running binary", async () => {
  vi.mocked(downloadVerified).mockImplementation(async (dest, download) => { await download!(dest); });
  await expect(updateYtDlpNow("nightly", fetcher)).resolves.toBe("2026.09.14");
  expect(downloadVerified).toHaveBeenCalledWith(stagedYtDlpPath(), expect.any(Function));
  expect(downloadYtDlp).toHaveBeenCalledWith(stagedYtDlpPath(), fetcher, "nightly");
  expect(finalizeStagedYtDlp).not.toHaveBeenCalled();
});

it("serializes updates and allows another attempt after failure", async () => {
  let rejectFirst!: (error: Error) => void;
  vi.mocked(downloadVerified).mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
    .mockResolvedValue(undefined);
  const first = updateYtDlpNow("nightly", fetcher);
  const rejected = expect(first).rejects.toThrow("fixture failure");
  await vi.waitFor(() => expect(downloadVerified).toHaveBeenCalledTimes(1));
  const second = updateYtDlpNow("stable", fetcher);
  await Promise.resolve();
  expect(downloadVerified).toHaveBeenCalledTimes(1);
  rejectFirst(Error("fixture failure"));
  await rejected;
  await expect(second).resolves.toBe("2026.09.14");
  expect(downloadVerified).toHaveBeenCalledTimes(2);
});
