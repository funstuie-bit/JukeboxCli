import type { Track } from "../library/types";

/** A stream is metadata plus a stable page URL, never a fake local file. */
export interface StreamTrack extends Omit<Track, "filePath"> {
  kind: "stream";
  filePath?: never;
  streamUrl: string;
  thumbnailUrl?: string;
  stationWebsite?: string;
  /** Absent on legacy entries: resolve a provider page through yt-dlp. */
  streamType?: "extractor" | "direct" | "radio";
  isLive?: boolean;
}
export type PlayableTrack = Track | StreamTrack;
export function isStream(track: PlayableTrack): track is StreamTrack {
  return "kind" in track && track.kind === "stream";
}
export function isLive(track: PlayableTrack | null): boolean {
  return !!track && isStream(track) && (track.streamType === "radio" || track.isLive === true);
}
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password && !/[\x00-\x20\x7f]/.test(value); } catch { return false; }
}
export interface ResolvedMedia {
  url: string;
  headers?: Record<string, string>;
  expiresAt: number;
  metadata?: Pick<StreamTrack, "title" | "artist" | "durationSec" | "thumbnailUrl" | "isLive">;
}
export type MediaResolver = (track: StreamTrack, signal: AbortSignal, fresh?: boolean) => Promise<ResolvedMedia>;

/** Deliberate allowlist: no direct stream credentials or arbitrary input fields. */
export function streamMetadata(t: StreamTrack): StreamTrack {
  return { kind: "stream", id: t.id, source: t.source, sourceTrackId: t.sourceTrackId,
    title: t.title, artist: t.artist, album: t.album, durationSec: t.durationSec,
    playlist: t.playlist, addedAt: t.addedAt, streamUrl: t.streamUrl,
    webpageUrl: t.streamUrl, thumbnailUrl: t.thumbnailUrl,
    streamType: t.streamType, isLive: t.isLive, stationWebsite: t.stationWebsite };
}
