import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import type { Track as LibraryTrack } from "../library/types";
import { isStream, streamMetadata, type PlayableTrack as Track, type MediaResolver, type ResolvedMedia } from "./media";
import { MpvPlayer } from "./mpv";
import { onEndedDecision, shuffledOrder, stepIndex } from "./order";
import { openPath } from "../util/open-path";
import type { ListeningSession } from "./session";

export type Engine = "mpv" | "external";
/**
 * Repeat: "all" loops the whole list when it reaches the end; "one" locks the
 * current track so it replays every time it ends.
 */
export type RepeatMode = "off" | "all" | "one";

export interface PlaybackState {
  track: Track | null;
  list: Track[];
  index: number;
  paused: boolean;
  position: number; // seconds (integer)
  duration: number; // seconds (integer)
  volume: number; // 0..100
  engine: Engine;
  mpvAvailable: boolean;
  repeat: RepeatMode;
  /** Whether the list is being played in a shuffled order. */
  shuffle?: boolean;
  /** True while a file is loading (mpv engine only). */
  loading?: boolean;
  /** True when transport controls actually work (engine === 'mpv'). */
  canControl?: boolean;
  error?: string;
  preloading?: boolean;
  nextReady?: boolean;
}

export type Opener = (file: string) => void;

function defaultOpener(file: string): void {
  openPath(file);
}

/** Clamp a volume into the valid 0..100 range as an integer. */
function clampVolume(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** First package manager found wins; apt stays the fallback for everything else. */
const LINUX_PM_HINTS: ReadonlyArray<readonly [string, string]> = [
  ["/usr/bin/apt", "sudo apt install mpv"],
  ["/usr/bin/dnf", "sudo dnf install mpv"],
  ["/usr/bin/pacman", "sudo pacman -S mpv"],
  ["/usr/bin/zypper", "sudo zypper install mpv"],
];

/**
 * The linux hint names the distro's own package manager (we only ever print
 * it, sudo is the user's call to run). Injectable detection for tests.
 */
export function linuxMpvHint(
  exists: (p: string) => boolean = existsSync,
): string {
  for (const [bin, hint] of LINUX_PM_HINTS) {
    if (exists(bin)) return hint;
  }
  return "sudo apt install mpv";
}

let cachedLinuxHint: string | null = null;

/** Per-OS one-liner to install mpv for the rich in-app player. */
export function mpvInstallHint(): string {
  if (process.platform === "win32") return "winget install mpv";
  if (process.platform === "darwin") return "brew install mpv";
  // The existsSync sweep runs once per process; the answer can't change
  // underneath a running app in any way we care about.
  cachedLinuxHint ??= linuxMpvHint();
  return cachedLinuxHint;
}

/**
 * High-level playback controller. Prefers mpv (full transport controls via
 * IPC); falls back to opening the file in the OS default audio app.
 */
export class Playback extends EventEmitter {
  private mpvPath: string | null;
  private readonly opener: Opener;
  private mpv: MpvPlayer | null = null;
  private state: PlaybackState;
  /**
   * Play order: a permutation of list indices. Linear ([0,1,2,...]) normally,
   * a shuffled permutation while shuffle is on. next()/prev() walk this.
   */
  private order: number[] = [];
  /**
   * Indices actually played within the current list, oldest first. Shuffle's
   * prev() walks this instead of the order: it survives reshuffles and works
   * from the head of a cycle, where the order has no "before".
   */
  private backStack: number[] = [];
  /** True while prev() replays a popped entry, so it isn't pushed back. */
  private popping = false;
  private playRequest = 0;
  private resolving: AbortController | null = null;
  private prefetchAbort: AbortController | null = null;
  private prefetchWork: Promise<void> = Promise.resolve();
  private prefetchToken = 0;
  private prepared: { token: number; index: number; track: Track; media: ResolvedMedia } | null = null;

  constructor(mpvPath: string | null, opener: Opener = defaultOpener, private readonly resolver?: MediaResolver) {
    super();
    this.mpvPath = mpvPath;
    this.opener = opener;
    const engine: Engine = mpvPath ? "mpv" : "external";
    this.state = {
      track: null,
      list: [],
      index: -1,
      paused: false,
      position: 0,
      duration: 0,
      volume: 100,
      engine,
      mpvAvailable: Boolean(mpvPath),
      repeat: "off",
      shuffle: false,
      loading: false,
      canControl: engine === "mpv",
    };
  }

  getState(): PlaybackState {
    return this.state;
  }

  /** Queue rows in actual play order; index identifies a particular occurrence. */
  queueEntries(): { index: number; track: Track }[] {
    return this.order.map((index) => ({ index, track: this.state.list[index]! }));
  }

  session(): ListeningSession {
    const streams = Object.fromEntries(this.state.list.filter(isStream).map(t => [t.id, streamMetadata(t)]));
    return { version: 2, streams, ids: this.state.list.map(t => t.id), index: this.state.index,
      order: [...this.order], backStack: [...this.backStack], position: this.state.position,
      volume: this.state.volume, shuffle: Boolean(this.state.shuffle), repeat: this.state.repeat };
  }

  async restoreSession(s: ListeningSession, resolve: (id: string) => LibraryTrack | undefined): Promise<void> {
    const list: Track[] = [];
    const map = new Map<number, number>();
    s.ids.forEach((id, i) => { const t = resolve(id) ?? s.streams?.[id]; if (t) { map.set(i, list.length); list.push(t); } });
    const remap = (xs: number[]) => xs.flatMap(i => map.has(i) ? [map.get(i)!] : []);
    this.order = remap(s.order);
    this.backStack = remap(s.backStack);
    const index = map.get(s.index) ?? -1;
    this.update({ list, index, track: list[index] ?? null, position: index < 0 ? 0 : s.position,
      volume: s.volume, shuffle: s.shuffle, repeat: s.repeat, paused: true });
    // Restore never opens an external application or starts audible playback.
    // Remote restoration is lazy: offline launch remains usable and silent.
    if (index >= 0 && this.mpvPath && !isStream(list[index]!)) {
      await this.play(list[index]!, list, index, true);
      if (this.mpv && this.state.engine === "mpv") {
        await this.mpv.seekAbsolute(s.position).catch(() => {});
        this.update({ position: s.position, paused: true });
      }
    }
  }

  /** Enqueue is non-interrupting, including when the player is idle. */
  enqueue(track: Track, next = false): void {
    const at = next && this.state.index >= 0 ? this.state.index + 1 : this.state.list.length;
    const list = [...this.state.list];
    list.splice(at, 0, track);
    const shift = (i: number) => i >= at ? i + 1 : i;
    this.order = this.order.map(shift);
    this.backStack = this.backStack.map(shift);
    const index = this.state.index >= 0 ? shift(this.state.index) : -1;
    const pos = next && index >= 0 ? this.order.indexOf(index) + 1 : this.order.length;
    this.order.splice(pos, 0, at);
    this.update({ list, index });
  }

  async playQueueIndex(index: number): Promise<void> {
    const t = this.state.list[index];
    if (t) await this.play(t, this.state.list, index);
  }

  /** Keep queued extras when choosing a song already in the current context. */
  async selectTrack(track: Track, context: Track[]): Promise<void> {
    const index = this.state.list.findIndex(t => t.id === track.id);
    const queuedIds = new Set(this.state.list.map(t => t.id));
    const sameContext = context.length > 1 && context.every(t => queuedIds.has(t.id));
    if (index >= 0 && sameContext) return this.playQueueIndex(index);
    if (context.length === 1 && this.state.track) {
      this.enqueue(track, true);
      return this.next();
    }
    return this.play(track, context);
  }

  /** Move in actual play order, and retain that edit when shuffle is disabled. */
  moveQueue(index: number, delta: -1 | 1): void {
    const pos = this.order.indexOf(index);
    const other = this.order[pos + delta];
    if (pos < 0 || other === undefined) return;
    const oldIndices = this.state.list.map((_, i) => i);
    oldIndices.splice(index, 1);
    oldIndices.splice(other, 0, index);
    const map = new Map(oldIndices.map((old, i) => [old, i]));
    [this.order[pos], this.order[pos + delta]] = [other, index];
    this.order = this.order.map(i => map.get(i)!);
    this.backStack = this.backStack.map(i => map.get(i)!);
    this.update({ list: oldIndices.map(i => this.state.list[i]!), index: map.get(this.state.index) ?? -1 });
  }

  async removeQueue(index: number): Promise<void> {
    if (!this.state.list[index]) return;
    if (index === this.state.index) {
      const pos = this.order.indexOf(index);
      const replacement = this.order[pos + 1] ?? this.order[pos - 1];
      if (replacement === undefined) { await this.stop(); return; }
      await this.playQueueIndex(replacement);
    }
    const shift = (i: number) => i > index ? i - 1 : i;
    this.order = this.order.filter(i => i !== index).map(shift);
    this.backStack = this.backStack.filter(i => i !== index).map(shift);
    this.update({ list: this.state.list.filter((_, i) => i !== index), index: shift(this.state.index) });
  }

  /** Enable mpv after construction (e.g. once it finishes auto-installing). */
  enableMpv(mpvPath: string): void {
    this.mpvPath = mpvPath;
    const engine: Engine = this.state.track ? this.state.engine : "mpv";
    this.update({
      mpvAvailable: true,
      engine,
      canControl: engine === "mpv",
    });
  }

  private update(patch: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...patch };
    this.emit("state", this.state);
    if (patch.list || patch.repeat !== undefined) this.schedulePrefetch();
  }

  private cancelPrefetch(): void {
    this.prefetchAbort?.abort(); this.prefetchAbort = null;
    this.prefetchToken++; this.prepared = null;
    this.update({ preloading: false, nextReady: false });
  }

  private async media(track: Track, signal: AbortSignal, fresh = false): Promise<ResolvedMedia> {
    if (!isStream(track)) return { url: track.filePath, expiresAt: Infinity };
    if (!this.resolver) throw new Error("Streaming is not available in this player.");
    return this.resolver(track, signal, fresh);
  }

  private schedulePrefetch(): void {
    this.cancelPrefetch();
    const m = this.mpv;
    if (!m || this.state.loading || !this.state.track) return;
    const signal = (this.prefetchAbort = new AbortController()).signal;
    const token = this.prefetchToken;
    const index = onEndedDecision(this.order, this.state.index, this.state.repeat);
    const track = index === "stop" ? undefined : this.state.list[index];
    this.prefetchWork = (async () => {
      await m.clearNext();
      if (signal.aborted) return;
      if (!track || index === "stop") { this.update({ preloading: false, nextReady: false }); return; }
      this.update({ preloading: true, nextReady: false });
      const media = await this.media(track, signal);
      if (signal.aborted) return;
      this.prepared = { token, track, index, media };
      await m.preloadNext(media, token, signal);
      if (!signal.aborted) this.update({ preloading: false, nextReady: true });
    })().catch(() => {
      if (!signal.aborted) { this.prepared = null; this.update({ preloading: false, nextReady: false }); }
    });
  }

  private ensureMpv(): MpvPlayer | null {
    if (!this.mpvPath) return null;
    if (this.mpv) return this.mpv;
    const m = new MpvPlayer(this.mpvPath);
    m.setInitialVolume(this.state.volume);
    m.on("property", (name: string, data: unknown) => {
      if (name === "time-pos" && typeof data === "number") {
        const pos = Math.floor(data);
        if (pos !== this.state.position) this.update({ position: pos });
      } else if (name === "duration" && typeof data === "number") {
        this.update({ duration: Math.floor(data) });
      } else if (name === "pause" && typeof data === "boolean") {
        this.update({ paused: data });
      } else if (name === "volume" && typeof data === "number") {
        const vol = clampVolume(data);
        if (vol !== this.state.volume) this.update({ volume: vol });
      }
    });
    m.on("ended", () => void this.onEnded().catch(() => this.update({ error: "Could not advance playback. Select a queue entry to retry." })));
    m.on("advanced", (token: number) => {
      const next = this.prepared;
      if (!next || next.token !== token) return;
      this.playRequest++;
      if (this.state.index >= 0 && next.index !== this.state.index) this.backStack.push(this.state.index);
      this.backStack = this.backStack.slice(-500);
      this.prepared = null;
      this.update({ track: next.track, index: next.index, position: 0,
        duration: next.track.durationSec ?? 0, loading: false, engine: "mpv", canControl: true, error: undefined });
      this.schedulePrefetch();
    });
    m.on("media-error", (token: number | null) => {
      if (this.state.loading) return; // foreground load handles its own retry
      const next = this.prepared;
      if (next && next.token === token) {
        void this.play(next.track, this.state.list, next.index, this.state.paused, true);
      } else {
        this.update({ error: "Playback interrupted. Press enter on the track in Queue to retry, or n to skip.", loading: false });
      }
    });
    // If mpv dies unexpectedly mid-session, drop our handle so the next play()
    // spins up a fresh process (MpvPlayer also resets its own socket state).
    m.on("quit", () => {
      if (this.mpv === m) this.mpv = null;
    });
    this.mpv = m;
    return m;
  }

  /** Rebuild the play order to match the current list and shuffle setting. */
  private rebuildOrder(): void {
    const len = this.state.list.length;
    if (this.state.shuffle) {
      this.order = shuffledOrder(len, this.state.index);
    } else {
      this.order = Array.from({ length: len }, (_, i) => i);
    }
  }

  /** A track finished on its own: honor repeat/shuffle via the pure decision. */
  private async onEnded(): Promise<void> {
    const request = this.playRequest;
    await this.prefetchWork;
    if (request !== this.playRequest) return;
    if (this.prepared && this.prepared.media.expiresAt > Date.now() && await this.mpv?.playPrepared(this.prepared.token)) return;
    const decision = onEndedDecision(
      this.order,
      this.state.index,
      this.state.repeat,
    );
    if (decision === "stop") {
      // Nothing left to play. Clear cleanly so the now-playing bar returns to
      // its idle "pick a song" state. Without this, mpv idles at EOF (it stays
      // up with --idle=yes), the bar freezes at 100%, and every transport key
      // silently no-ops because mpv reports the file as unloaded, which reads
      // as a softlock, especially with a single-song list.
      await this.stop();
      return;
    }
    await this.play(this.state.list[decision]!, this.state.list, decision);
  }

  /** Cycle repeat: off → all (loop the list) → one (lock current track) → off. */
  cycleRepeat(): void {
    const next: RepeatMode =
      this.state.repeat === "off"
        ? "all"
        : this.state.repeat === "all"
          ? "one"
          : "off";
    this.update({ repeat: next });
  }

  /**
   * Toggle shuffle. Turning it on reshuffles the list while keeping the current
   * track current; turning it off resumes linear order from the current track.
   * The underlying list is never mutated.
   */
  toggleShuffle(): void {
    const shuffle = !this.state.shuffle;
    this.state = { ...this.state, shuffle };
    this.rebuildOrder();
    this.update({});
    this.schedulePrefetch();
  }

  /**
   * Swap in a bigger list around the track that is already playing, without
   * touching the audio: only next/prev gain somewhere to go. Used when a
   * resumed single-track session turns shuffle on over the whole library.
   */
  adoptList(list: Track[], index: number): void {
    const cur = this.state.track;
    if (!cur || index < 0 || index >= list.length) return;
    if (list[index]!.id !== cur.id) return;
    this.backStack = [];
    this.state = { ...this.state, list, index };
    this.rebuildOrder();
    this.update({});
    this.schedulePrefetch();
  }

  async play(track: Track, list: Track[] = [track], index = -1, startPaused = false, fresh = false): Promise<void> {
    const request = ++this.playRequest;
    this.resolving?.abort();
    const signal = (this.resolving = new AbortController()).signal;
    this.cancelPrefetch();
    const idx = index >= 0 ? index : list.findIndex((t) => t.id === track.id);
    const safeIdx = idx < 0 ? 0 : idx;
    // A continuation of the same list (e.g. from next()/prev()) keeps the
    // existing order so an in-progress shuffle cycle is preserved; a new list
    // (or a stale order length) rebuilds it for the current shuffle setting.
    const newList = list !== this.state.list || this.order.length !== list.length;
    const fromIndex = this.state.index;
    if (newList) {
      this.backStack = [];
    } else if (!this.popping && fromIndex >= 0 && safeIdx !== fromIndex) {
      this.backStack.push(fromIndex);
      if (this.backStack.length > 500) this.backStack.shift();
    }
    this.state = { ...this.state,
      track,
      list,
      index: safeIdx,
      position: 0,
      duration: track.durationSec ?? 0,
      paused: startPaused,
      loading: Boolean(this.mpvPath),
      error: undefined, nextReady: false, preloading: false,
    };
    if (newList) this.rebuildOrder();
    this.update({});

    const m = this.ensureMpv();
    if (m) {
      try {
        // Cancel any old audible/preloaded entry before a slow URL lookup.
        await m.stop();
        if (request !== this.playRequest) return;
        const media = await this.media(track, signal, fresh);
        if (request !== this.playRequest) return;
        try { await m.loadMedia(media, startPaused); }
        catch (error) {
          if (!isStream(track) || fresh || signal.aborted) throw error;
          await m.stop();
          const renewed = await this.media(track, signal, true);
          if (request !== this.playRequest) return;
          await m.loadMedia(renewed, startPaused);
        }
        if (request !== this.playRequest) return;
        const volume = clampVolume(await m.getVolume());
        if (request !== this.playRequest) return;
        this.update({
          engine: "mpv",
          canControl: true,
          loading: false,
          volume,
        });
        this.schedulePrefetch();
        return;
      } catch (error) {
        if (request !== this.playRequest) return;
        if (isStream(track)) {
          await m.stop().catch(() => {});
          if (request !== this.playRequest) return;
          this.update({ engine: "mpv", canControl: true, loading: false, paused: true,
            error: error instanceof Error && /^(Streaming|Could not resolve|Only HTTP)/.test(error.message)
              ? error.message : "Could not play this stream. Select it in Queue to retry, or n to skip." });
          return;
        }
        // mpv failed to start or load: fall through to the external opener.
        // The failed instance may still own a live process, its IPC socket,
        // and our listeners; quit() tears all of that down (it is safe on an
        // already-dead process) so nothing lingers orphaned when the next
        // play() spawns a fresh mpv. Drop our handle first so the "quit"
        // event this fires finds it already cleared.
        if (this.mpv === m) this.mpv = null;
        m.quit();
      }
    }
    this.update({ engine: "external", canControl: false, loading: false });
    if (isStream(track)) {
      this.update({ error: "Streaming needs mpv. Install mpv, then restart JukeboxCli.", paused: true });
    } else if (!startPaused) this.opener(track.filePath);
  }

  async togglePause(): Promise<void> {
    if (this.state.error && this.state.track) {
      await this.play(this.state.track, this.state.list, this.state.index, false, true); return;
    }
    if (!this.state.track) {
      const first = this.order[0];
      if (first !== undefined) await this.playQueueIndex(first);
      return;
    }
    if (!this.mpv) {
      const index = this.state.index >= 0 ? this.state.index : this.order[0];
      const position = this.state.position;
      if (index !== undefined) {
        await this.playQueueIndex(index);
        const m = this.mpv as MpvPlayer | null;
        if (m && position > 0) await m.seekAbsolute(position).catch(() => {});
      }
      return;
    }
    const was = this.state.paused;
    this.update({ paused: !was });
    try {
      await this.mpv.togglePause();
    } catch {
      this.update({ paused: was });
    }
  }

  /** Relative seek by `seconds` (mpv engine only). */
  async seek(seconds: number): Promise<void> {
    if (!this.mpv) return;
    const prev = this.state.position;
    const dur = this.state.duration;
    let next = Math.max(0, prev + seconds);
    if (dur > 0) next = Math.min(next, dur);
    this.update({ position: next });
    try {
      await this.mpv.seekRelative(seconds);
    } catch {
      this.update({ position: prev });
    }
  }

  /** Jump back to the start of the current track. */
  async restart(): Promise<void> {
    const { track, list, index } = this.state;
    if (!track) return;
    try {
      if (this.mpv) {
        await this.mpv.seekAbsolute(0);
        this.update({ position: 0, paused: false });
        return;
      }
    } catch {
      // fall through to reload
    }
    if (list.length && index >= 0) {
      await this.play(track, list, index);
    }
  }

  /** Nudge the volume by `delta`, clamped to 0..100. */
  async changeVolume(delta: number): Promise<void> {
    await this.setVolume(this.state.volume + delta);
  }

  /** Set the absolute volume, clamped to 0..100. */
  async setVolume(v: number): Promise<void> {
    const vol = clampVolume(v);
    this.update({ volume: vol });
    this.mpv?.setInitialVolume(vol);
    if (this.mpv) {
      try {
        await this.mpv.setVolume(vol);
        this.update({ volume: clampVolume(await this.mpv.getVolume()) });
      } catch {
        // keep the optimistic value if mpv is momentarily unavailable
      }
    }
  }

  /**
   * Stop playback and clear the current track. The engine stays selectable so a
   * later play() resumes normally; for mpv this unloads the file too.
   */
  async stop(): Promise<void> {
    this.resolving?.abort(); this.cancelPrefetch();
    const request = ++this.playRequest;
    if (this.mpv) {
      try {
        await this.mpv.stop();
      } catch {
        // ignore, we still clear our own state below
      }
    }
    if (request !== this.playRequest) return;
    this.order = [];
    this.backStack = [];
    this.update({
      track: null,
      list: [],
      index: -1,
      position: 0,
      duration: 0,
      paused: false,
      loading: false,
      error: undefined, preloading: false, nextReady: false,
    });
  }

  async next(): Promise<void> {
    if (!this.state.list.length) return;
    const ni = stepIndex(this.order, this.state.index, this.state.repeat, 1);
    if (ni === null) return; // end of the list
    const prepared = this.prepared;
    if (prepared?.index === ni && prepared.media.expiresAt > Date.now()) {
      await this.mpv?.command(["set_property", "pause", false]);
      if (await this.mpv?.playPrepared(prepared.token)) { this.update({ paused: false }); return; }
    }
    await this.play(this.state.list[ni]!, this.state.list, ni);
  }

  /**
   * The next `count` tracks after the current one, in actual play order
   * (shuffle-aware). Previewed with repeat off, so it shows what remains in
   * this cycle rather than looping or locking on repeat-one.
   */
  upNext(count: number): Track[] {
    const out: Track[] = [];
    let idx = this.state.index;
    for (let i = 0; i < count; i++) {
      const ni = stepIndex(this.order, idx, "off", 1);
      if (ni === null) break;
      const t = this.state.list[ni];
      if (!t) break;
      out.push(t);
      idx = ni;
    }
    return out;
  }

  async prev(): Promise<void> {
    if (!this.state.list.length) return;
    if (this.state.shuffle) {
      let back: number | undefined;
      while ((back = this.backStack.pop()) !== undefined) {
        if (
          back >= 0 &&
          back < this.state.list.length &&
          back !== this.state.index
        ) {
          break;
        }
      }
      if (back !== undefined) {
        this.popping = true;
        try {
          await this.play(this.state.list[back]!, this.state.list, back);
        } finally {
          this.popping = false;
        }
        return;
      }
      // Nothing heard before in this list; the order walk below still lets
      // repeat 'all' wrap to the end of the cycle.
    }
    const pi = stepIndex(this.order, this.state.index, this.state.repeat, -1);
    if (pi === null) return; // start of the list
    await this.play(this.state.list[pi]!, this.state.list, pi);
  }

  quit(): void {
    this.resolving?.abort(); this.cancelPrefetch();
    this.playRequest++;
    this.mpv?.quit();
    this.mpv = null;
  }
}
