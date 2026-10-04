import type { PlayableTrack } from "./media";

export interface QueuePage { tracks: PlayableTrack[]; more?: QueueLoader }
export type QueueLoader = (signal: AbortSignal) => Promise<QueuePage>;
/** Session-only cursor. Never serialise provider closures or signed URLs. */
export class QueueContinuation {
  private abort = new AbortController();
  private work?: Promise<void>;
  private seen: Set<string>;
  private failed = false;
  private pages = 0;
  constructor(private more: QueueLoader | undefined, tracks: readonly PlayableTrack[],
    private append: (tracks: PlayableTrack[]) => void, private status: (message?: string) => void) {
    this.seen = new Set(tracks.map(t => t.id));
  }
  cancel() { this.abort.abort(); this.more = undefined; }
  get available() { return !!this.more && !this.abort.signal.aborted; }
  async load(retry = false): Promise<void> {
    if (this.work) return this.work;
    if (!this.available || (this.failed && !retry)) return;
    this.failed = false;
    const loader = this.more!;
    this.work = (async () => {
      this.status("Loading more playlist tracks…");
      const timeout = AbortSignal.timeout(20_000);
      const signal = AbortSignal.any([this.abort.signal, timeout]);
      let abortListener: () => void = () => {};
      try {
        const aborted = new Promise<never>((_, reject) => {
          abortListener = () => reject(Error("Playlist request cancelled or timed out"));
          signal.addEventListener("abort", abortListener, { once: true });
          if (signal.aborted) abortListener();
        });
        const page = await Promise.race([loader(signal), aborted]);
        if (this.abort.signal.aborted) return;
        const fresh = page.tracks.filter(t => {
          if (this.seen.has(t.id) || this.seen.size >= 10000) return false;
          this.seen.add(t.id); return true;
        });
        this.pages++;
        // Empty/repeated pages stop a broken provider cursor, not an endless loop.
        this.more = fresh.length && this.seen.size < 10000 && this.pages < 100 ? page.more : undefined;
        this.append(fresh);
        this.status(this.more ? "Playlist continuation ready" : "End of playlist");
      } catch {
        if (!this.abort.signal.aborted) { this.failed = true; this.status("Playlist continuation failed · C retries in Queue"); }
      } finally { signal.removeEventListener("abort", abortListener); }
    })().finally(() => { this.work = undefined; });
    return this.work;
  }
}
