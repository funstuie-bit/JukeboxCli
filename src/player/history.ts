import { promises as fs } from "node:fs";
import path from "node:path";
import { historyFile } from "../config/paths";
import { isHttpUrl, isStream, streamMetadata, type PlayableTrack, type StreamTrack } from "./media";

interface HistoryEntry {
  /** Library track id, e.g. "youtube:dQw4w9WgXcQ". */
  id: string;
  /** ISO timestamp of when it last started playing. */
  at: string;
  stream?: StreamTrack;
}

interface HistoryIndex {
  version: 1;
  entries: HistoryEntry[];
}

/** Replays move a track back to the top instead of stacking duplicates. */
const CAP = 500;

/**
 * Recently played tracks, newest first, backed by a JSON file. Same shape as
 * the Library store: serialized atomic writes, a version counter, and change
 * listeners for the UI.
 */
export class PlayHistory {
  private index: HistoryIndex;
  private chain: Promise<void> = Promise.resolve();
  private version = 0;
  private listeners = new Set<() => void>();

  private constructor(index: HistoryIndex, private file?: string) {
    this.index = index;
  }

  /** An empty in-memory history that is not backed by the user's data file. */
  static empty(): PlayHistory {
    return new PlayHistory({ version: 1, entries: [] });
  }

  static async load(file = historyFile): Promise<PlayHistory> {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as HistoryIndex;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
        const entries = parsed.entries.filter(e => e && typeof e.id === "string" && typeof e.at === "string").slice(0, CAP).map(e => {
          const t = e.stream;
          const valid = t && t.kind === "stream" && t.id === e.id && isHttpUrl(t.streamUrl) &&
            typeof t.title === "string" && typeof t.sourceTrackId === "string" &&
            ["youtube", "soundcloud", "spotify", "link", "local"].includes(t.source) &&
            [t.artist, t.album, t.playlist, t.addedAt].every(v => v === undefined || typeof v === "string") &&
            (t.durationSec === undefined || (Number.isFinite(t.durationSec) && t.durationSec >= 0)) &&
            (t.thumbnailUrl === undefined || isHttpUrl(t.thumbnailUrl)) &&
            (t.stationWebsite === undefined || isHttpUrl(t.stationWebsite)) &&
            (t.streamType === undefined || ["extractor", "direct", "radio"].includes(t.streamType)) &&
            (t.isLive === undefined || typeof t.isLive === "boolean");
          return { id: e.id, at: e.at, ...(valid ? { stream: streamMetadata(t) } : {}) };
        });
        return new PlayHistory({ version: 1, entries }, file);
      }
    } catch {
      // missing or invalid: start fresh
    }
    return new PlayHistory({ version: 1, entries: [] }, file);
  }

  /** A monotonically increasing counter bumped on every change. */
  getVersion(): number {
    return this.version;
  }

  /** Subscribe to history changes. Returns an unsubscribe fn. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  /** Track ids, newest first. */
  ids(): string[] {
    return this.index.entries.map((e) => e.id);
  }

  /** Stable metadata for a streamed play; local tracks remain library references. */
  getStream(id: string): StreamTrack | undefined {
    return this.index.entries.find(e => e.id === id)?.stream;
  }

  remove(id: string): void {
    this.index.entries = this.index.entries.filter(e => e.id !== id);
    this.notify();
    void this.persist();
  }

  /** Record a play: move it to the top, without stacking duplicates. */
  record(track: string | PlayableTrack): void {
    const id = typeof track === "string" ? track : track.id;
    const stream = typeof track !== "string" && isStream(track) ? streamMetadata(track) : undefined;
    this.index.entries = [
      { id, at: new Date().toISOString(), ...(stream ? { stream } : {}) },
      ...this.index.entries.filter((e) => e.id !== id),
    ].slice(0, CAP);
    this.notify();
    void this.persist();
  }

  /** Drop entries for tracks that no longer exist (wipe, prune). */
  retain(existing: (id: string) => boolean): void {
    const kept = this.index.entries.filter((e) => e.stream || existing(e.id));
    if (kept.length === this.index.entries.length) return;
    this.index.entries = kept;
    this.notify();
    void this.persist();
  }

  private persist(): Promise<void> {
    if (!this.file) return Promise.resolve();
    const file = this.file;
    this.chain = this.chain.then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.index, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tmp, file);
    }).catch(() => { /* History is best-effort; never interrupt playback. */ });
    return this.chain;
  }

  async flush(): Promise<void> { await this.chain; }
}
