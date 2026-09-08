import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { ThemeProvider } from "@inkjs/ui";
import { uiTheme } from "../src/ui/theme";
import { App } from "../src/ui/App";
import { readSession, sessionFile } from "../src/player/session";
import { rmSync } from "node:fs";
import { readStations, stationsFile } from "../src/player/stations";

// Exercise the REAL App, Playback, navigation and persistence. Only external
// processes, bootstrap I/O and library contents are fixtures.
vi.mock("../src/ui/hooks/useMouseWheel", () => ({ useMouseWheel: () => {} }));
vi.mock("../src/bin/binaries", () => ({ ensureBinaries: async () => ({ mpv: "fixture", ffmpeg: "", ffprobe: "", ytDlp: "" }) }));
vi.mock("../src/config/config", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/config/config")>();
  return { ...actual, loadConfig: async () => ({ ...actual.defaultConfig, firstRunComplete: true, ytdlpAutoUpdate: false }), saveConfig: async () => {} };
});
vi.mock("../src/library/migrate", () => ({ migrateOwnerLayout: async () => {} }));
vi.mock("../src/library/reconcile", () => ({ reconcileLibrary: async () => ({ prunedMissing: 0 }) }));
vi.mock("../src/library/library", async () => {
  const { makeFakeLibrary } = await import("../scripts/fake-data");
  return { Library: { load: async () => ({ ...makeFakeLibrary(), flushSync: () => {} }) } };
});
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: (file: string) => file.startsWith("/music/soundcli/") || actual.existsSync(file) };
});
vi.mock("../src/player/art", () => ({
  loadCoverArt: async () => null,
  loadWaveform: async (_file: string, buckets: number) => ({ samples: Array.from({ length: buckets }, (_, i) => (i % 8 + 1) / 8) }),
}));
vi.mock("../src/player/mpv", async () => {
  const { EventEmitter } = await import("node:events");
  return { MpvPlayer: class extends EventEmitter {
    paused = false; volume = 100;
    setInitialVolume(v: number) { this.volume = v; }
    async loadMedia(_media: unknown, paused: boolean) { this.paused = paused; }
    async clearNext() {}
    async preloadNext() {}
    async playPrepared() { return false; }
    async command() {}
    async getVolume() { return this.volume; }
    async setVolume(v: number) { this.volume = v; }
    async togglePause() { this.paused = !this.paused; this.emit("property", "pause", this.paused); }
    async seekRelative(v: number) { /* Playback applies optimistic position. */ }
    async seekAbsolute(v: number) { this.emit("property", "time-pos", v); }
    async stop() {}
    quit() {}
  } };
});

const tick = () => new Promise(r => setTimeout(r, 40));
vi.mock("../src/sources/music", () => {
  const track = { kind: "stream", id: "stream:youtube:fixture", source: "youtube", sourceTrackId: "fixture",
    title: "Online fixture song", artist: "Fixture artist", streamUrl: "https://music.youtube.com/watch?v=fixture", addedAt: "2026-09-07" };
  const song = { id: "fixture", kind: "song", title: track.title, track };
  return {
    searchMusic: async (_query: string, kind: string) => ({ title: "Fixture results", items: kind === "album"
      ? [{ id: "album", kind: "album", title: "Fixture album" }] : [song],
      more: async () => ({ title: "Fixture results", items: [{ ...song, id: "second", title: "More results" }] }) }),
    browseMusic: async () => ({ title: "Inside album", items: [song] }),
  };
});
vi.mock("../src/player/resolve", () => ({ createStreamResolver: () => async () => ({ url: "https://example.com/audio", expiresAt: Infinity }) }));
vi.mock("../src/player/feeds", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/player/feeds")>();
  return { ...actual, discoverFeeds: (url: string, radio: boolean, signal: AbortSignal) => actual.discoverFeeds(url, radio, signal,
    async () => url.includes("slow.example") ? new Promise<Response>((_resolve, reject) => signal.addEventListener("abort", () => reject(Error("Cancelled")), { once: true })) : new Response('<title>Fixture FM</title><meta property="og:image" content="/logo.png"><audio src="/live.mp3"></audio><audio src="/other.mp3"></audio>',
      { headers: { "content-type": "text/html" } })) };
});
const app = () => render(<ThemeProvider theme={uiTheme}><App /></ThemeProvider>);
async function press(view: ReturnType<typeof app>, key: string) { view.stdin.write(key); await tick(); }
afterEach(() => { cleanup(); rmSync(sessionFile, { force: true }); rmSync(stationsFile, { force: true }); });

describe("App player workflow", () => {
  it("cancels website detection and accepts a new link without saving anything", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "o"); await press(view, "https://slow.example/"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Looking for audio feeds");
    await press(view, "\u001b"); expect(view.lastFrame()).not.toContain("Looking for audio feeds");
    await press(view, "R"); await press(view, "https://example.com/radio"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Found 2 feeds");
    expect(readStations()).toEqual([]);
  });
  it("opens URLs without downloading, saves radio, reconnects and restores favourites", async () => {
    const view = app(); await tick(); await tick();
    expect(view.lastFrame()).toContain("9 Radio / URL");
    await press(view, "o"); expect(view.lastFrame()).toContain("Paste YouTube");
    await press(view, "https://youtu.be/dQw4w9WgXcQ?si=secret");
    await press(view, "\r"); expect(view.lastFrame()).toContain("Ready");
    await press(view, "A"); await press(view, "7"); expect(view.lastFrame()).toContain("YouTube");
    await press(view, "9"); expect(view.lastFrame()).toContain("No saved stations");
    await press(view, "R"); await press(view, "https://example.com/radio"); await press(view, "\r");
    expect(view.lastFrame()).toContain("[LIVE]");
    await press(view, "f"); await press(view, "Workday FM"); await press(view, "\r");
    expect(readStations()[0]?.name).toBe("Workday FM");
    expect(readStations()[0]?.thumbnailUrl).toBe("https://example.com/logo.png");
    await press(view, "t"); await press(view, "\r");
    expect(readStations()).toHaveLength(1);
    await press(view, "\r"); await press(view, "m");
    expect(view.lastFrame()).toContain("LIVE · no seeking");
    expect(view.lastFrame()).not.toContain("← → Seek");
    expect(view.lastFrame()).toContain("Queue · 2 tracks"); // idle queue was kept
    await press(view, " "); expect(view.lastFrame()).toContain("Disconnected");
    await press(view, " "); expect(view.lastFrame()).toContain("Playing");
    await press(view, "9"); await press(view, "x"); expect(view.lastFrame()).toContain("Remove favourite?");
    await press(view, "\u001b"); expect(readStations()).toHaveLength(1);
    view.unmount(); await tick();
    const saved = readSession()!;
    expect(saved.position).toBe(0); expect(saved.ids).toHaveLength(2);
    expect(JSON.stringify(saved)).not.toContain("secret");
    const again = app(); await tick(); await tick(); await press(again, "9");
    expect(again.lastFrame()).toContain("Workday FM");
    await press(again, "?"); expect(again.lastFrame()).toContain("Radio / URL (9)");
    expect((again.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(24);
    await press(again, "["); expect(again.lastFrame()).toContain("Discover (YouTube Music)");
    await press(again, "?");
    await press(again, "x"); await press(again, "y"); expect(readStations()).toEqual([]);
    await press(again, "7"); expect(again.lastFrame()).toContain("Queue · 2 tracks");
  });
  it("keeps invalid URLs in the form and fits URL entry on a small terminal", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "o"); await press(view, "file:///private/no"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Only HTTP(S)");
    await press(view, "\u0015");
    Object.defineProperty(view.stdout, "columns", { configurable: true, value: 60 });
    Object.defineProperty(view.stdout, "rows", { configurable: true, value: 18 });
    view.stdout.emit("resize"); await tick();
    await press(view, "https://example.com/" + "long".repeat(40));
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(18);
    await press(view, "\u001b"); await press(view, "8");
    expect(view.lastFrame()).toContain("Discover");
    await press(view, "?"); await press(view, "\u001b[B");
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(18);
  });
  it("searches and browses Discover, queues a stream, plays and restores it paused", async () => {
    const view = app(); await tick(); await tick();
    expect(view.lastFrame()).toContain("8 Discover");
    await press(view, "8"); await press(view, "/"); await press(view, "fixture"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Online fixture song");
    await press(view, "L"); expect(view.lastFrame()).toContain("More results");
    await press(view, "]"); await press(view, "]"); expect(view.lastFrame()).toContain("Fixture album");
    await press(view, "\r"); expect(view.lastFrame()).toContain("Inside album");
    await press(view, "A"); expect(view.lastFrame()).toContain("Added to queue");
    await press(view, "7"); expect(view.lastFrame()).toContain("[stream]");
    await press(view, "\r"); await press(view, "m"); expect(view.lastFrame()).toContain("Streaming");
    view.unmount(); await tick();
    const saved = readSession()!; expect(saved.streams?.[saved.ids[0]!]!.streamUrl).toContain("music.youtube.com");
    const again = app(); await tick(); await tick(); await press(again, "m");
    expect(again.lastFrame()).toContain("Paused · shuffle off");
    expect(again.lastFrame()).toContain("Online fixture song");
    await press(again, " "); expect(again.lastFrame()).toContain("Playing · shuffle off");
  });
  it("advertises player, queues from Library, edits in player, and restores through a new App", async () => {
    const view = app(); await tick(); await tick();
    expect(view.lastFrame()).toContain("m Player");
    expect(view.lastFrame()).toContain("6 Now Playing");
    expect(view.lastFrame()).toContain("7 Queue");
    await press(view, "1"); // focus Library
    await press(view, "\u001b[B"); // past shuffle action to first song
    await press(view, "A");
    expect(view.lastFrame()).toContain("Added to queue");
    await press(view, "\u001b[B"); await press(view, "A");
    await press(view, "7"); expect(view.lastFrame()).toContain("Queue · 2 tracks");
    await press(view, "\r"); await press(view, "m");
    expect(view.lastFrame()).toContain("Playing · shuffle off · repeat off");
    await press(view, "b"); expect(view.lastFrame()).toContain("Artwork hidden");
    await press(view, "b");
    await press(view, "?"); expect(view.lastFrame()).not.toContain("TRACK WAVEFORM");
    await press(view, "?"); expect(view.lastFrame()).toContain("TRACK WAVEFORM");
    expect(view.lastFrame()).toMatch(/[▁▂▃▄▅▆▇█]/);
    await press(view, " "); expect(view.lastFrame()).toContain("Paused · shuffle off");
    await press(view, "r"); await press(view, "-"); await press(view, "\u001b[C");
    await press(view, "\u001b[B"); await press(view, "u");
    expect(view.lastFrame()).toContain("Queue · 2 tracks");
    await press(view, "\u001b"); // close modal
    expect(view.lastFrame()).toContain("7 Queue");
    view.unmount(); await tick();
    const saved = readSession()!;
    expect(saved.ids).toHaveLength(2); expect(saved.volume).toBe(95);
    expect(saved.repeat).toBe("all"); expect(saved.position).toBe(15);
    const again = app(); await tick(); await tick(); await press(again, "m");
    expect(again.lastFrame()).toContain("Paused · shuffle off · repeat all");
    expect(again.lastFrame()).toContain("Queue · 2 tracks");
    await press(again, "x"); expect(again.lastFrame()).toContain("Queue · 1 tracks");
    await press(again, "X"); expect(again.lastFrame()).toContain("Clear queue and stop?");
    await press(again, "y"); expect(again.lastFrame()).toContain("Nothing playing");
    await press(again, "7"); await press(again, "1");
    await press(again, "\u001b[B"); await press(again, "A");
    await press(again, "7"); await press(again, " "); await press(again, "m");
    expect(again.lastFrame()).toContain("Playing · shuffle off · repeat all");
    await press(again, "X"); await press(again, "y");
    again.unmount(); await tick(); expect(readSession()?.ids).toEqual([]);
  });

  it("routes numbered navigation out of the modal and survives terminal resize", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "m"); expect(view.lastFrame()).toContain("Nothing playing");
    await press(view, "7"); expect(view.lastFrame()).toContain("Empty · select a song");
    Object.defineProperty(view.stdout, "columns", { configurable: true, value: 60 });
    Object.defineProperty(view.stdout, "rows", { configurable: true, value: 18 });
    view.stdout.emit("resize"); await tick();
    await press(view, "m"); expect(view.lastFrame()).toContain("Nothing playing");
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(18);
    await press(view, "\u001b"); await press(view, "1");
    expect(view.lastFrame()).toContain("Library");
  });
});
