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
export type PlaybackMode = "audio" | "video";
export interface ResolvedMedia {
  mode?: PlaybackMode;
  startPosition?: number;
  url: string;
  /** Optional separate audio stream; ephemeral like url, never session metadata. */
  audioUrl?: string;
  headers?: Record<string, string>;
  expiresAt: number;
  metadata?: Pick<StreamTrack, "title" | "artist" | "durationSec" | "thumbnailUrl" | "isLive">;
}
/** Fixed user-facing reasons; extractor output and signed URLs never become errors. */
const resolutionMessages = {
  "no-stream": "No playable stream was returned by the source.",
  "no-video": "This source has no playable video stream.",
  "no-audio": "The video's separate audio stream could not be loaded. Try again or choose another result.",
  "invalid-url": "The source returned an unsupported stream link.",
  "incompatible-headers": "The source requires incompatible settings for its picture and sound. Try another result.",
  "format": "No compatible video format was returned. Update yt-dlp in Settings or try another result.",
  "blocked": "Streaming was blocked by the source. Check browser cookies in Settings or try another result.",
  "unavailable": "This video is unavailable, private or restricted by the source.",
  "timeout": "Stream lookup timed out. Check your connection and try again.",
  "lookup": "Could not resolve this stream. Check your connection or try another result.",
} as const;
export class StreamResolutionError extends Error {
  constructor(readonly reason: keyof typeof resolutionMessages) {
    super(resolutionMessages[reason]);
    this.name = "StreamResolutionError";
  }
}
export type MediaResolver = (track: StreamTrack, signal: AbortSignal, fresh?: boolean, mode?: PlaybackMode) => Promise<ResolvedMedia>;

/** Deliberate allowlist: no direct stream credentials or arbitrary input fields. */
export function streamMetadata(t: StreamTrack): StreamTrack {
  return { kind: "stream", id: t.id, source: t.source, sourceTrackId: t.sourceTrackId,
    title: t.title, artist: t.artist, album: t.album, durationSec: t.durationSec,
    playlist: t.playlist, addedAt: t.addedAt, streamUrl: t.streamUrl,
    webpageUrl: t.streamUrl, thumbnailUrl: t.thumbnailUrl,
    streamType: t.streamType, isLive: t.isLive, stationWebsite: t.stationWebsite };
}
