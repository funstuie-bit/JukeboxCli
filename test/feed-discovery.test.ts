import { describe, expect, it, vi } from "vitest";
import { discoverFeeds, feedsFromHtml, feedsFromPlaylist } from "../src/player/feeds";
const signal = () => new AbortController().signal;

describe("website feed parsing", () => {
  it("finds audio/player variants, relative links, artwork and labels without executing JS", () => {
    const html = `<title>Fallback</title><meta content='Radio &amp; Stuff' property='og:site_name'>
      <meta content='/logo.png' property='og:image'><audio src='/live' title='Main'></audio>
      <source type='video/mp4' src='/video.mp4'><source type='audio/mpeg' src='/live'>
      <div data-flux='https://player.example/main' data-flux-hd='https://player.example/hd'></div>
      <script>"streamUrl":"https:\\/\\/other.example/live?x=1&amp;y=2"</script>
      <audio src='file:///private/data'><a href='/show.mp3'>Audio</a><a href='/about'>About</a>`;
    const tracks = feedsFromHtml(html, "https://example.com/");
    expect(tracks).toHaveLength(5);
    expect(tracks[0]?.title).toBe("Radio & Stuff · Main");
    expect(tracks[0]?.thumbnailUrl).toBe("https://example.com/logo.png");
    expect(tracks.some(t => t.title.endsWith("HD"))).toBe(true);
    expect(tracks.some(t => t.streamUrl.includes("file:") || t.streamUrl.includes("video.mp4"))).toBe(false);
    expect(tracks.every(t => t.streamType === "radio")).toBe(true);
  });
  it("bounds candidate count and validates image/stream schemes", () => {
    const tracks = feedsFromHtml(`<meta property='og:image' content='javascript:alert(1)'>` +
      Array.from({ length: 20 }, (_, i) => `<audio src='https://example.com/${i}'>`).join(""), "https://example.com");
    expect(tracks).toHaveLength(12); expect(tracks[0]?.thumbnailUrl).toBeUndefined();
  });
  it("prefers a touch icon over a generic favicon social image", () => {
    const tracks = feedsFromHtml(`<meta property='og:image' content='/favicon.png'>
      <link rel='apple-touch-icon' href='/assets/apple-touch-icon.png'>
      <audio src='/live'>`, "https://radio.example/");
    expect(tracks[0]?.thumbnailUrl).toBe("https://radio.example/assets/apple-touch-icon.png");
  });
  it("parses PLS and M3U lists without following nested lists or HLS segments", () => {
    const pls = feedsFromPlaylist("[playlist]\nFile1=https://stream.example/live\nTitle1=Test FM\nFile2=file:///private\nFile3=/more.pls", "https://example.com/list.pls");
    expect(pls).toHaveLength(1); expect(pls[0]?.title).toBe("Test FM");
    const m3u = feedsFromPlaylist("#EXTM3U\n#EXTINF:-1,Another FM\n/live\n/live", "https://example.com/list.m3u");
    expect(m3u).toHaveLength(1); expect(m3u[0]?.title).toBe("Another FM");
    const hls = feedsFromPlaylist("#EXTM3U\n#EXT-X-TARGETDURATION:6\nsegment.ts", "https://example.com/live.m3u8");
    expect(hls).toHaveLength(1); expect(hls[0]?.streamUrl).toBe("https://example.com/live.m3u8");
  });
});

describe("bounded feed detection", () => {
  it("recognises the requested DKFM and Radio Garden stations without bypassing site protection", async () => {
    const fetcher = vi.fn();
    expect((await discoverFeeds("https://decayfm.com/", true, signal(), fetcher)).tracks[0]?.title).toBe("DKFM");
    expect((await discoverFeeds("https://radio.garden/listen/deeper-shades-of-house/GFCK5Bn3", true, signal(), fetcher)).tracks[0]?.streamUrl).toContain("housejunkie");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(discoverFeeds("https://radio.garden/listen/other/12345678", true, signal(), fetcher)).rejects.toThrow(/not recognised/);
  });
  it("fetches a canonical website and returns feeds without fetching artwork or audio", async () => {
    const fetcher = vi.fn(async () => new Response(`<meta property='og:image' content='/logo.png'><audio src='https://audio.example/live'>`, { headers: { "content-type": "text/html" } }));
    const result = await discoverFeeds("https://ibizastardustradio.com/", false, signal(), fetcher);
    expect(result.tracks).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://www.ibizastardustradio.com/");
  });
  it("recognises audio by headers, keeps its stable URL and immediately closes the response", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cdn.example/live?token=temp" } }))
      .mockResolvedValueOnce(new Response(body, { headers: { "content-type": "audio/mpeg", "icy-name": "Test FM" } }));
    const result = await discoverFeeds("https://example.com/stable", false, signal(), fetcher);
    expect(result.tracks[0]?.streamUrl).toBe("https://example.com/stable");
    expect(result.tracks[0]?.title).toBe("Test FM"); expect(result.tracks[0]?.isLive).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects protected sites, loops, unsafe redirects and oversized/chunked pages", async () => {
    await expect(discoverFeeds("https://example.com", true, signal(), async () => new Response("Blocked", { status: 403 }))).rejects.toThrow(/blocked/);
    const loop = vi.fn(async () => new Response(null, { status: 302, headers: { location: "/" } }));
    await expect(discoverFeeds("https://example.com", true, signal(), loop)).rejects.toThrow(/Too many/);
    expect(loop).toHaveBeenCalledTimes(5);
    await expect(discoverFeeds("https://example.com", true, signal(), async () => new Response(null, { status: 302, headers: { location: "file:///private" } }))).rejects.toThrow(/unsupported/);
    await expect(discoverFeeds("https://example.com", true, signal(), async () => new Response("x".repeat(1024 * 1024 + 1)))).rejects.toThrow(/too large/);
  });
  it("rejects empty/challenge pages and supports cancellation", async () => {
    await expect(discoverFeeds("https://example.com", true, signal(), async () => new Response("<title>Just a moment</title>"))).rejects.toThrow(/No public/);
    const c = new AbortController(); c.abort(); const fetcher = vi.fn();
    await expect(discoverFeeds("https://decayfm.com/", true, c.signal, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
