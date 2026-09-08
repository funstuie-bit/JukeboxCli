import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../config/paths";
import type { Playback } from "./playback";
import { isHttpUrl, streamMetadata, type StreamTrack } from "./media";

export interface ListeningSession {
  version: 1 | 2;
  streams?: Record<string, StreamTrack>;
  ids: string[];
  index: number;
  order: number[];
  backStack: number[];
  position: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
}
export const sessionFile = path.join(paths.data, "listening-session.json");

export function readSession(file = sessionFile): ListeningSession | null {
  try {
    const s = JSON.parse(readFileSync(file, "utf8"));
    if (![1, 2].includes(s.version) || (s.version === 2 && (!s.streams || typeof s.streams !== "object")) || !Array.isArray(s.ids) || s.ids.length > 10000 ||
        !s.ids.every((id: unknown) => typeof id === "string") ||
        !Number.isInteger(s.index) || s.index < -1 || s.index >= s.ids.length ||
        !Array.isArray(s.order) || s.order.length !== s.ids.length ||
        new Set(s.order).size !== s.ids.length ||
        !s.order.every((i: unknown) => Number.isInteger(i) && Number(i) >= 0 && Number(i) < s.ids.length) ||
        !Array.isArray(s.backStack) || s.backStack.length > 500 ||
        !s.backStack.every((i: unknown) => Number.isInteger(i) && Number(i) >= 0 && Number(i) < s.ids.length) ||
        !Number.isFinite(s.position) || s.position < 0 ||
        !Number.isFinite(s.volume) || s.volume < 0 || s.volume > 100 ||
        typeof s.shuffle !== "boolean" || !["off", "all", "one"].includes(s.repeat)) return null;
    if (s.version === 2) {
      if (Array.isArray(s.streams) || Object.keys(s.streams).length > 10000) return null;
      const streams: Record<string, StreamTrack> = {};
      for (const [id, value] of Object.entries(s.streams)) {
        const t = value as StreamTrack;
        if (!t || t.kind !== "stream" || t.id !== id || !id.startsWith("stream:") ||
            typeof t.title !== "string" || typeof t.sourceTrackId !== "string" ||
            !["youtube", "soundcloud", "link"].includes(t.source) || !isHttpUrl(t.streamUrl) ||
            [t.artist, t.album, t.playlist, t.addedAt].some(v => v !== undefined && typeof v !== "string") ||
            (t.thumbnailUrl !== undefined && !isHttpUrl(t.thumbnailUrl)) ||
            (t.stationWebsite !== undefined && !isHttpUrl(t.stationWebsite)) ||
            (t.streamType !== undefined && !["extractor", "direct", "radio"].includes(t.streamType)) ||
            (t.isLive !== undefined && typeof t.isLive !== "boolean") ||
            (t.durationSec !== undefined && (!Number.isFinite(t.durationSec) || t.durationSec < 0))) return null;
        streams[id] = streamMetadata(t);
      }
      s.streams = streams;
    }
    return s as ListeningSession;
  } catch { return null; }
}

/** Atomic, bounded-frequency saves. Caller flushes before quitting mpv. */
export function persistListeningSession(playback: Playback, file = sessionFile) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastError: string | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(playback.session()), { mode: 0o600 });
      renameSync(tmp, file);
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  };
  const onState = () => {
    if (!timer) { timer = setTimeout(flush, 1000); timer.unref(); }
  };
  playback.on("state", onState);
  return {
    flush,
    get error() { return lastError; },
    close() { playback.off("state", onState); flush(); },
  };
}
