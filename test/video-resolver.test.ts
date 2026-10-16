import { beforeEach, expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("execa", () => ({ execa: run }));
import { createStreamResolver, resolvedMedia } from "../src/player/resolve";
import { trackFromUrl } from "../src/player/url";
import { StreamResolutionError, streamMetadata } from "../src/player/media";
beforeEach(() => { run.mockReset(); vi.useRealTimers(); });
it("keeps audio and video caches separate and requests separate streams with a combined fallback", async () => {
  run.mockResolvedValue({ stdout: JSON.stringify({url:"https://example.com/media", title:"Video"}) });
  const resolve = createStreamResolver(async () => ({} as any));
  const t = trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk");
  const signal = new AbortController().signal;
  await resolve(t, signal); await resolve(t, signal, false, "video");
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[0][1]).toContain("bestaudio/best");
  expect(run.mock.calls[1][1]).toContain("bestvideo+bestaudio/best/bestvideo");
  await resolve(t, signal); await resolve(t, signal, false, "video");
  expect(run).toHaveBeenCalledTimes(2);
});

const split = () => ({ title: "Separate streams", http_headers: { "User-Agent": "player", Cookie: "secret" },
  requested_formats: [
    { url: "https://cdn.example/video?expire=1000&sig=video-secret", vcodec: "av1", acodec: "none" },
    { url: "https://cdn.example/audio?expire=600&sig=audio-secret", vcodec: "none", acodec: "opus", http_headers: { "user-agent": "player", Authorization: "secret" } },
  ] });
it("accepts separate-only formats and expires both URLs at the earlier stream deadline", () => {
  const media = resolvedMedia(split(), 500_000, "video");
  expect(media.url).toContain("/video?"); expect(media.audioUrl).toContain("/audio?");
  expect(media.expiresAt).toBe(570_000);
  expect(media.headers).toEqual({ "User-Agent": "player" });
  const track = trackFromUrl("https://youtu.be/abcdefghijk");
  expect(JSON.stringify(streamMetadata({ ...track, ...media } as any))).not.toMatch(/audioUrl|audio-secret|video-secret|headers/);
});
it("refreshes a cached video when its audio URL expires first", async () => {
  vi.useFakeTimers(); vi.setSystemTime(500_000);
  try {
    run.mockResolvedValue({ stdout: JSON.stringify(split()) });
    const resolve = createStreamResolver(async () => ({} as any));
    const t = trackFromUrl("https://youtu.be/abcdefghijk"), signal = new AbortController().signal;
    await resolve(t, signal, false, "video");
    vi.setSystemTime(569_000); await resolve(t, signal, false, "video");
    expect(run).toHaveBeenCalledTimes(1);
    vi.setSystemTime(570_000); await resolve(t, signal, false, "video");
    expect(run).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});
it("retains combined and silent-video sources, and rejects audio-only video results", () => {
  expect(resolvedMedia({ url: "https://cdn.example/combined", vcodec: "h264", acodec: "aac" }, 0, "video").audioUrl).toBeUndefined();
  expect(resolvedMedia({ url: "https://cdn.example/silent", vcodec: "h264", acodec: "none" }, 0, "video").audioUrl).toBeUndefined();
  expect(() => resolvedMedia({ url: "https://cdn.example/audio", vcodec: "none", acodec: "opus" }, 0, "video")).toThrow("no playable video");
});
it("keeps the selected HLS soundtrack even when yt-dlp has not identified its audio codec", () => {
  const info = split();
  const audio = info.requested_formats[1]! as Record<string, unknown>;
  delete audio.acodec; audio.protocol = "m3u8_native";
  expect(resolvedMedia(info, 500_000, "video").audioUrl).toBe(audio.url);
});
it.each(["audio", "video"] as const)("prefers an HLS soundtrack on a fresh YouTube %s retry without dropping cookies", async mode => {
  run.mockResolvedValue({ stdout: JSON.stringify({url:"https://example.com/media", title:"Video"}) });
  const resolve = createStreamResolver(async () => ({cookiesFromBrowser:"firefox"} as any));
  const track = trackFromUrl("https://youtu.be/abcdefghijk");
  await resolve(track, new AbortController().signal, true, mode);
  expect(run.mock.calls[0]![1]).toContain(mode === "video" ? "bestvideo+bestaudio[protocol^=m3u8]/bestvideo+bestaudio/best/bestvideo" : "bestaudio[protocol^=m3u8]/bestaudio/best");
  expect(run.mock.calls[0]![1]).toEqual(expect.arrayContaining(["--cookies-from-browser", "firefox"]));
});
it("rejects unsafe separate URLs and conflicting per-stream headers", () => {
  const info = split(); info.requested_formats[1]!.url = "file:///private/audio-secret";
  expect(() => resolvedMedia(info, 0, "video")).toThrow(StreamResolutionError);
  expect(() => resolvedMedia(info, 0, "video")).not.toThrow(/audio-secret/);
  const conflict = split(); conflict.requested_formats[1]!.http_headers!["user-agent"] = "different";
  expect(() => resolvedMedia(conflict, 0, "video")).toThrow("incompatible settings");
});
it.each([
  ["ERROR: Requested format is not available https://cdn.example/?sig=private", "compatible video format"],
  ["ERROR: HTTP Error 403 https://cdn.example/?sig=private", "browser cookies"],
  ["ERROR: Private video https://cdn.example/?sig=private", "unavailable"],
  ["ERROR: operation timed out https://cdn.example/?sig=private", "timed out"],
  ["ERROR: could not find firefox cookies database in private-profile-path", "Could not read the selected browser cookies"],
  ["ERROR: failed to decrypt cookies private-profile-path", "Could not read the selected browser cookies"],
])("reports a safe reason for %s", async (stderr, message) => {
  run.mockRejectedValue({ stderr });
  const resolve = createStreamResolver(async () => ({} as any));
  const error = await resolve(trackFromUrl("https://youtu.be/abcdefghijk"), new AbortController().signal, false, "video").catch(e => e);
  expect(error).toBeInstanceOf(StreamResolutionError);
  expect(error.message).toContain(message);
  expect(error.message).not.toMatch(/https:|sig=|private-profile-path/);
});

it("invalidates signed-stream caches when the selected cookies change", async () => {
  run.mockResolvedValue({stdout:JSON.stringify({url:"https://cdn.example/media"})});
  let cfg = {cookiesFromBrowser:"firefox"};
  const resolve = createStreamResolver(async () => cfg as any);
  const track = trackFromUrl("https://youtu.be/abcdefghijk"), signal = new AbortController().signal;
  await resolve(track, signal); await resolve(track, signal);
  expect(run).toHaveBeenCalledTimes(1);
  cfg = {cookiesFromBrowser:"chrome"}; await resolve(track, signal);
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1]![1]).toEqual(expect.arrayContaining(["--cookies-from-browser", "chrome"]));
});
