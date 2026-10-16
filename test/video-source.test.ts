import { expect, it } from "vitest";
import { videoSource } from "../src/player/video-source";
import { trackFromUrl } from "../src/player/url";
import { playbackActions } from "../src/ui/components/PlaybackActions";
const local = { id: "saved", source: "local" as const, sourceTrackId: "saved", title: "Saved", addedAt: "2026-10-15", filePath: "/music/saved.mp3" };
it("offers video for YouTube and known video files but not radio or audio-only sources", () => {
  for (const track of [trackFromUrl("https://youtu.be/abcdefghijk"), trackFromUrl("https://example.com/movie.webm"), { ...local, filePath: "/music/movie.MP4" }]) {
    expect(playbackActions(track, () => {}).map(a => a.label)).toEqual(["Play audio", "Play video"]);
  }
  for (const track of [local, trackFromUrl("https://example.com/audio.mp3"), trackFromUrl("https://example.com/radio.mp4", true), { ...local, source: "youtube" as const, sourceTrackId: "invalid" }]) {
    expect(playbackActions(track, () => {}).map(a => a.label)).toEqual(["Play"]);
  }
});
it("maps downloaded YouTube audio to the original video without changing the saved track", () => {
  const saved = { ...local, source: "youtube" as const, sourceTrackId: "abcdefghijk" };
  expect(videoSource(saved)).toMatchObject({ kind: "stream", streamUrl: "https://www.youtube.com/watch?v=abcdefghijk", id: saved.id, title: saved.title });
  expect(saved.filePath).toBe("/music/saved.mp3");
  expect(videoSource({ ...saved, webpageUrl: "https://example.com/audio.mp3" })).toBeUndefined();
});
