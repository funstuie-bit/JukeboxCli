import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { ThemeProvider } from "@inkjs/ui";
import { uiTheme } from "../src/ui/theme";
import { App } from "../src/ui/App";
import { readSession, sessionFile } from "../src/player/session";
import { rmSync } from "node:fs";
import path from "node:path";
import { paths } from "../src/config/paths";
import { readStations, saveStation, stationsFile } from "../src/player/stations";
import type { Config } from "../src/config/config";
import { DownloadQueue } from "../src/download/queue";

// Exercise the REAL App, Playback, navigation and persistence. Only external
// processes, bootstrap I/O and library contents are fixtures.
const startup = vi.hoisted(() => ({ fresh: false, writes: [] as Config[], readEffective: undefined as undefined | (() => Promise<Config>) }));
vi.mock("../src/ui/hooks/useMouseWheel", () => ({ useMouseWheel: () => {} }));
vi.mock("../src/bin/binaries", () => ({ ensureBinaries: async () => ({ mpv: "fixture", ffmpeg: "", ffprobe: "", ytDlp: "" }) }));
vi.mock("../src/config/config", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/config/config")>();
  return { ...actual, loadConfig: async () => ({ ...actual.defaultConfig, firstRunComplete: !startup.fresh, ytdlpAutoUpdate: false }), saveConfig: async (cfg: Config) => { startup.writes.push({ ...cfg }); } };
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
vi.mock("../src/player/lyrics", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/player/lyrics")>();
  return { ...actual, loadLyrics: actual.createLyricsService({ spacing: 0, fetcher: async (input, init) => {
    const url = new URL(String(input)), params = url.searchParams;
    if (params.get("q") === "slow") return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(Error("Cancelled")), { once: true }));
    if (url.hostname === "api.lyrics.ovh") return Response.json({ lyrics: "Other provider fixture" });
    if (url.pathname.endsWith("/search")) return Response.json([
      { id: 101, trackName: "Song Title", artistName: "Artist Name", albumName: "Fixture album", duration: 233, syncedLyrics: "[00:00] Manual fixture" },
      { id: 102, trackName: "Other version", artistName: "Artist Name", albumName: "Live", duration: 250, plainLyrics: "Plain fixture" },
    ]);
    return Response.json({ trackName: params.get("track_name"), artistName: params.get("artist_name"),
      duration: Number(params.get("duration")), syncedLyrics: "[00:00] Opening fixture\n[00:10] Middle fixture\n[00:20] Closing fixture" });
  } }) };
});
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
vi.mock("../src/player/resolve", () => ({ createStreamResolver: (read: () => Promise<Config>) => {
  startup.readEffective = read;
  return async () => ({ url: "https://example.com/audio", expiresAt: Infinity });
} }));
vi.mock("../src/player/feeds", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/player/feeds")>();
  return { ...actual, discoverFeeds: (url: string, radio: boolean, signal: AbortSignal) => actual.discoverFeeds(url, radio, signal,
    async () => url.includes("slow.example") ? new Promise<Response>((_resolve, reject) => signal.addEventListener("abort", () => reject(Error("Cancelled")), { once: true })) : new Response('<title>Fixture FM</title><meta property="og:image" content="/logo.png"><audio src="/live.mp3"></audio><audio src="/other.mp3"></audio>',
      { headers: { "content-type": "text/html" } })) };
});
vi.mock("../src/player/radio-browser", async () => {
  const { trackFromUrl } = await import("../src/player/url");
  return { QUICK_RADIO_CHANNELS: [{ name: "Lo-fi", query: "tag:lofi", count: 0 }], searchRadioDirectory: async (query: string) => {
    const track = trackFromUrl("https://directory.example/live.mp3", true);
    return { tracks: [{ ...track, title: query || "Popular Fixture", artist: "United Kingdom · MP3 · 128 kbps",
      thumbnailUrl: "https://directory.example/logo.png", stationWebsite: "https://directory.example/" }],
      note: "Found 1 station in Radio Browser · play, queue or save" };
  }, listRadioFacets: async (kind: "tags" | "countries") => kind === "tags"
    ? [{ name: "ambient", query: "tag:ambient", count: 321 }, { name: "jazz", query: "tag:jazz", count: 123 }]
    : [{ name: "United Kingdom", query: "country:GB", count: 456 }] };
});
const app = (props: Parameters<typeof App>[0] = {}) => render(<ThemeProvider theme={uiTheme}><App {...props} /></ThemeProvider>);
async function press(view: ReturnType<typeof app>, key: string) { view.stdin.write(key); await tick(); }
afterEach(() => { startup.fresh = false; startup.writes = []; startup.readEffective = undefined; vi.unstubAllEnvs(); cleanup(); rmSync(sessionFile, { force: true }); rmSync(stationsFile, { force: true }); rmSync(path.join(paths.cache, "lyrics-v1.json"), { force: true }); });

describe("App player workflow", () => {
  it("keeps launch flags temporary through onboarding and player preference saves", async () => {
    const queueUpdate = vi.spyOn(DownloadQueue.prototype, "updateConfig");
    startup.fresh = true;
    const overrides = { libraryDir: "/fixture/run-only-output", audioFormat: "mp3", cookiesFromBrowser: "firefox" };
    const view = app({ initialOverrides: overrides });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Welcome to JukeboxCli"));
    expect(startup.writes).toHaveLength(0);
    expect(await startup.readEffective!()).toMatchObject(overrides);
    await press(view, "\u001b");
    await vi.waitFor(() => expect(startup.writes.some(c => c.firstRunComplete)).toBe(true));
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Your jukebox"));
    await press(view, "m");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("NOW PLAYING"));
    await press(view, "T");
    await vi.waitFor(() => expect(startup.writes.some(c => c.playerTheme === "calm")).toBe(true));
    for (const cfg of startup.writes) {
      expect(cfg.libraryDir).not.toBe(overrides.libraryDir);
      expect(cfg.audioFormat).toBe("best");
      expect(cfg.cookiesFromBrowser).toBeUndefined();
    }
    expect(await startup.readEffective!()).toMatchObject({ ...overrides, playerTheme: "calm" });
    expect(queueUpdate).toHaveBeenLastCalledWith(expect.objectContaining(overrides));
    queueUpdate.mockRestore();
  });
  it("first launch opens listening choices and hands focus directly to online search", async () => {
    startup.fresh = true;
    const view = app(); await tick(); await tick();
    expect(view.lastFrame()).toContain("Welcome to JukeboxCli");
    expect(view.lastFrame()).not.toContain("Where's your music?");
    await press(view, "\r"); expect(view.lastFrame()).toContain("Search music");
    await press(view, "fixture"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Online fixture song");
    await press(view, "\r"); await press(view, "m");
    expect(view.lastFrame()).toContain("Streaming · not in Library");
  });
  it("starts at Home and routes search while preserving typing and player navigation", async () => {
    const view = app(); await tick(); await tick();
    expect(view.lastFrame()).toContain("Your jukebox");
    expect(view.lastFrame()).toContain("H Home");
    await press(view, "/"); expect(view.lastFrame()).toContain("Search music");
    await press(view, "H"); expect(view.lastFrame()).toContain("Discover"); // typed H, not global Home
    await press(view, "\x1b"); await press(view, "H"); expect(view.lastFrame()).toContain("Your jukebox");
    await press(view, "m"); expect(view.lastFrame()).toContain("Stopped · shuffle");
    await press(view, "H"); expect(view.lastFrame()).toContain("Your jukebox");
  });
  it("searches inside player, isolates typing, queues online results and restores lyrics", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "1"); await press(view, "\u001b[B"); await press(view, "A");
    await press(view, "7"); await press(view, "\r"); await press(view, "m");
    await press(view, "S"); expect(view.lastFrame()).toContain("SEARCH · Local");
    await press(view, "l: no match m n p 9 X ?");
    expect(view.lastFrame()).toContain("SEARCH · Local");
    await press(view, "\r"); expect(view.lastFrame()).toContain("No local matches");
    await press(view, "/"); await press(view, "\u0015"); await press(view, "s: fixture"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Online fixture song");
    await press(view, "A"); expect(view.lastFrame()).toContain("Appended to queue");
    await press(view, "P"); expect(view.lastFrame()).toContain("Queued next");
    await press(view, "\u001b"); expect(view.lastFrame()).toContain("Playback queue · 3 tracks");
    await press(view, "l"); await press(view, "L"); await new Promise(r => setTimeout(r, 500));
    await press(view, "\u001b[B"); expect(view.lastFrame()).toContain("browsing");
    await press(view, "S"); await press(view, "\u001b"); await new Promise(r => setTimeout(r, 500));
    expect(view.lastFrame()).toContain("browsing");
    await press(view, "/"); expect(view.lastFrame()).toContain("Search LRCLIB");
    await press(view, "\u001b");
    view.unmount(); await tick();
    expect(readSession()?.ids).toHaveLength(3); expect(readSession()?.position).toBe(0);
    expect(readSession()?.volume).toBe(100);
  });
  it("searches from the embedded player, fits a small terminal and opens explicit download", async () => {
    const view = app(); await tick(); await tick(); await press(view, "6");
    await press(view, "/"); await press(view, "v: fixture"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Online videos");
    Object.defineProperty(view.stdout, "columns", { configurable: true, value: 60 });
    Object.defineProperty(view.stdout, "rows", { configurable: true, value: 18 });
    view.stdout.emit("resize"); await tick();
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(18);
    await press(view, "\u001b"); await press(view, "m"); await press(view, "S");
    await press(view, "s: fixture"); await press(view, "\r"); await press(view, "d");
    expect(view.lastFrame()).not.toContain("SEARCH ·");
    expect(view.lastFrame()).not.toContain("NOW PLAYING");
  });
  it("searches/selects lyrics, isolates typed shortcuts, cancels and tries the plain provider", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "1"); await press(view, "\u001b[B"); await press(view, "A");
    await press(view, "7"); await press(view, "\r"); await press(view, "m"); await press(view, "l");
    await press(view, "L"); await new Promise(r => setTimeout(r, 500));
    await press(view, "/"); expect(view.lastFrame()).toContain("Search LRCLIB");
    await press(view, "\u0015"); await press(view, "plain remix n p l m ? 9");
    expect(view.lastFrame()).toContain("Search LRCLIB");
    await press(view, "\r"); await new Promise(r => setTimeout(r, 500));
    expect(view.lastFrame()).toContain("Fixture album");
    await press(view, "\u001b[B"); await press(view, "\u001b[A"); await press(view, "\r");
    await new Promise(r => setTimeout(r, 500)); expect(view.lastFrame()).toContain("› Manual fixture");
    await press(view, "/"); await press(view, "\u0015"); await press(view, "slow"); await press(view, "\r");
    await new Promise(r => setTimeout(r, 500)); await press(view, "\u001b");
    await new Promise(r => setTimeout(r, 500)); expect(view.lastFrame()).toContain("› Manual fixture");
    await press(view, "O"); expect(view.lastFrame()).toContain("lyrics.ovh · plain only");
    await press(view, "\u0015"); await press(view, "invalid"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Use Artist - Song");
    await press(view, "\u001b"); expect(view.lastFrame()).toContain("LYRICS");
    await press(view, "O"); await press(view, "\r"); await new Promise(r => setTimeout(r, 500));
    expect(view.lastFrame()).toContain("Other provider fixture");
    expect(view.lastFrame()).not.toContain("› Other provider");
    await press(view, "l"); expect(view.lastFrame()).toContain("Playback queue · 1 tracks");
    view.unmount(); await tick();
    expect(readSession()?.ids).toHaveLength(1); expect(readSession()?.position).toBe(0);
    expect(readSession()?.volume).toBe(100);
  }, 15000); // Multi-step debounced workflow exceeds 5s on shared Mac CI runners.
  it("opts into lyrics, follows seeking/pausing and keeps lyric controls out of the queue", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "1"); await press(view, "\u001b[B"); await press(view, "A");
    await press(view, "7"); await press(view, "\r"); await press(view, "m");
    expect(view.lastFrame()).toContain("l Lyrics");
    await press(view, "l"); await new Promise(r => setTimeout(r, 500));
    expect(view.lastFrame()).toContain("Online lyrics disabled");
    await press(view, "L"); await new Promise(r => setTimeout(r, 500));
    expect(view.lastFrame()).toContain("› Opening fixture");
    await press(view, "\u001b[C"); expect(view.lastFrame()).toContain("› Middle fixture");
    await press(view, " "); expect(view.lastFrame()).toContain("› Middle fixture");
    await press(view, "\u001b[B"); await press(view, "x");
    expect(view.lastFrame()).toContain("Line-synced · browsing");
    await press(view, "f"); expect(view.lastFrame()).toContain("following playback");
    Object.defineProperty(view.stdout, "columns", { configurable: true, value: 60 });
    Object.defineProperty(view.stdout, "rows", { configurable: true, value: 18 });
    view.stdout.emit("resize"); await tick();
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(18);
    await press(view, "l"); expect(view.lastFrame()).toContain("Playback queue · 1 tracks");
    await press(view, "6"); await press(view, "l"); await new Promise(r => setTimeout(r, 500));
    expect(view.lastFrame()).toContain("LYRICS");
    view.unmount(); await tick(); expect(readSession()?.ids).toHaveLength(1);
    expect(readSession()?.position).toBe(15); // Neither player's l toggle seeks.
  });
  it("refreshes an old favourite and queued artwork while retaining names, then removes via d", async () => {
    saveStation("My custom radio", "https://example.com/live.mp3");
    const view = app(); await tick(); await tick(); await press(view, "9");
    expect(view.lastFrame()).toContain("x/d remove");
    await press(view, "\r"); // start the legacy favourite without artwork
    await press(view, "G"); expect(view.lastFrame()).toContain("Paste the station WEBSITE");
    await press(view, "https://example.com/radio"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Refreshed 1 saved station");
    expect(readStations()).toEqual([{ name: "My custom radio", url: "https://example.com/live.mp3",
      thumbnailUrl: "https://example.com/logo.png", websiteUrl: "https://example.com/radio" }]);
    await press(view, "d"); expect(view.lastFrame()).toContain("Remove favourite? My custom radio");
    await press(view, "\u001b"); expect(readStations()).toHaveLength(1);
    await press(view, "d"); await press(view, "y"); expect(readStations()).toEqual([]);
    await press(view, "7"); expect(view.lastFrame()).toContain("Playback queue · 1 tracks");
    view.unmount(); await tick();
    const session = readSession()!;
    expect(session.ids).toHaveLength(1);
    expect(Object.values(session.streams!)[0]).toMatchObject({ title: "My custom radio", thumbnailUrl: "https://example.com/logo.png" });
  });
  it("changes player appearance, keeps queue repeats explicit and separates favourites", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "R"); // not a global radio shortcut
    await press(view, "9"); await press(view, "R");
    await press(view, "https://decayfm.com/"); await press(view, "\r");
    await press(view, "A"); await press(view, "A");
    expect(view.lastFrame()).toContain("Already queued"); expect(readStations()).toEqual([]);
    await press(view, "7"); expect(view.lastFrame()).toContain("Playback queue · 2 tracks");
    await press(view, "\r"); await press(view, "m");
    expect(view.lastFrame()).toContain("LIVE");
    expect(view.lastFrame()).not.toContain("No cover art");
    await press(view, "T"); await press(view, "V");
    await press(view, "\u001b"); await press(view, "5"); await press(view, "\u001b[F"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Theme: Calm");
    expect(view.lastFrame()).toContain("Reduced motion: off");
    await press(view, "\r"); expect(view.lastFrame()).toContain("Theme: Ember");
    await press(view, "\u001b[B"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Reduced motion: on");
  });
  it("cancels website detection and accepts a new link without saving anything", async () => {
    const view = app(); await tick(); await tick();
    await press(view, "o"); await press(view, "https://slow.example/"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Looking for audio feeds");
    await press(view, "\u001b"); expect(view.lastFrame()).not.toContain("Looking for audio feeds");
    await press(view, "R"); await press(view, "https://example.com/radio"); await press(view, "\r");
    expect(view.lastFrame()).toContain("Found 2 feeds");
    expect(readStations()).toEqual([]);
  });
  it("searches the radio directory and keeps results temporary until saved", async () => {
    const view = app(); await tick(); await tick(); await press(view, "9");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Radio / URL · Saved stations"));
    await press(view, "/"); expect(view.lastFrame()).toContain("Search station name");
    await press(view, "Fixture Radio"); await press(view, "\r");
    expect(view.lastFrame()).toContain("[directory] [LIVE] Fixture Radio");
    expect(view.lastFrame()).toContain("United Kingdom · MP3 · 128 kbps");
    expect(readStations()).toEqual([]);
    await press(view, "f"); await press(view, "\r");
    expect(readStations()).toEqual([{ name: "Fixture Radio", url: "https://directory.example/live.mp3",
      thumbnailUrl: "https://directory.example/logo.png", websiteUrl: "https://directory.example/" }]);
  });
  it("browses radio genres without requiring query syntax", async () => {
    const view = app(); await tick(); await tick(); await press(view, "9");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("B popular · g genres"));
    await press(view, "g"); await vi.waitFor(() => expect(view.lastFrame()).toContain("Genres & tags"));
    expect(view.lastFrame()).toContain("ambient · 321 stations");
    await press(view, "\r"); await vi.waitFor(() => expect(view.lastFrame()).toContain("[directory] [LIVE] tag:ambient"));
  });
  it("opens quick radio moods without depending on hosted station lists", async () => {
    const view = app(); await tick(); await tick(); await press(view, "9");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("M quick channels"));
    await press(view, "M"); expect(view.lastFrame()).toContain("Quick channels");
    expect(view.lastFrame()).toContain("Lo-fi");
    await press(view, "\r"); await vi.waitFor(() => expect(view.lastFrame()).toContain("[directory] [LIVE] tag:lofi"));
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
    expect(view.lastFrame()).toContain("Playback queue · 2 tracks"); // idle queue was kept
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
    await press(again, "7"); expect(again.lastFrame()).toContain("Playback queue · 2 tracks");
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
    await press(view, "7"); expect(view.lastFrame()).toContain("NET"); expect(view.lastFrame()).not.toContain("[ONLINE]");
    await press(view, "\r"); await press(view, "m"); expect(view.lastFrame()).toContain("Streaming");
    await press(view, "m"); await press(view, "3");
    expect(view.lastFrame()).toContain("Recently played");
    expect(view.lastFrame()).toContain("Online fixture song");
    expect(view.lastFrame()).not.toContain("Nothing played yet");
    await press(view, "\r"); await press(view, "m");
    expect(view.lastFrame()).toContain("Streaming");
    view.unmount(); await tick();
    const saved = readSession()!; expect(saved.streams?.[saved.ids[0]!]!.streamUrl).toContain("music.youtube.com");
    const again = app(); await tick(); await tick(); await press(again, "m");
    expect(again.lastFrame()).toContain("Paused · shuffle off");
    expect(again.lastFrame()).toContain("Online fixture song");
    await press(again, " "); expect(again.lastFrame()).toContain("Playing · shuffle off");
  });
  it("advertises player, queues from Library, edits in player, and restores through a new App", async () => {
    vi.stubEnv("JUKEBOXCLI_VISUALIZER", "0"); // Exercise the documented static-waveform fallback.
    const view = app(); await tick(); await tick();
    expect(view.lastFrame()).toContain("m Player");
    expect(view.lastFrame()).toContain("6 Now Playing");
    expect(view.lastFrame()).toContain("7 Queue");
    await press(view, "1"); // focus Library
    await press(view, "\u001b[B"); // past shuffle action to first song
    await press(view, "A");
    expect(view.lastFrame()).toContain("Added to queue");
    await press(view, "\u001b[B"); await press(view, "A");
    await press(view, "7"); expect(view.lastFrame()).toContain("Playback queue · 2 tracks");
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
    expect(view.lastFrame()).toContain("Playback queue · 2 tracks");
    await press(view, "\u001b"); // close modal
    expect(view.lastFrame()).toContain("7 Queue");
    view.unmount(); await tick();
    const saved = readSession()!;
    expect(saved.ids).toHaveLength(2); expect(saved.volume).toBe(95);
    expect(saved.repeat).toBe("all"); expect(saved.position).toBe(15);
    const again = app(); await tick(); await tick(); await press(again, "m");
    expect(again.lastFrame()).toContain("Paused · shuffle off · repeat all");
    expect(again.lastFrame()).toContain("Playback queue · 2 tracks");
    await press(again, "x"); expect(again.lastFrame()).toContain("Playback queue · 1 tracks");
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
