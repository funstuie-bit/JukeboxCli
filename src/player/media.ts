import type { Track } from "../library/types";

/** A stream is metadata plus a stable page URL, never a fake local file. */
export interface StreamTrack extends Omit<Track, "filePath"> {
  kind: "stream";
  filePath?: never;
  streamUrl: string;
  thumbnailUrl?: string;
}
export type PlayableTrack = Track | StreamTrack;
export function isStream(track: PlayableTrack): track is StreamTrack {
  return "kind" in track && track.kind === "stream";
}
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
export interface ResolvedMedia {
  url: string;
  headers?: Record<string, string>;
  expiresAt: number;
}
export type MediaResolver = (track: StreamTrack, signal: AbortSignal, fresh?: boolean) => Promise<ResolvedMedia>;

/** Deliberate allowlist: no direct stream credentials or arbitrary input fields. */
export function streamMetadata(t: StreamTrack): StreamTrack {
  return { kind: "stream", id: t.id, source: t.source, sourceTrackId: t.sourceTrackId,
    title: t.title, artist: t.artist, album: t.album, durationSec: t.durationSec,
    playlist: t.playlist, addedAt: t.addedAt, streamUrl: t.streamUrl,
    webpageUrl: t.streamUrl, thumbnailUrl: t.thumbnailUrl };
}
