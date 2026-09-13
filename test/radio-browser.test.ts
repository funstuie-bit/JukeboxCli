import { describe, expect, it } from "vitest";
import { searchRadioDirectory } from "../src/player/radio-browser";

const signal = () => new AbortController().signal;
const rows = [{ stationuuid: "one", name: " Fixture FM ", url_resolved: "https://radio.example/live.mp3",
  homepage: "https://radio.example/", favicon: "https://radio.example/art.png", country: "France",
  codec: "mp3", bitrate: 192, tags: "jazz, soul", lastcheckok: 1 }];

describe("Radio Browser directory", () => {
  it("maps popular directory results into safe live tracks", async () => {
    let requested: URL | undefined;
    const result = await searchRadioDirectory("", signal(), async input => {
      requested = new URL(String(input)); return Response.json(rows);
    });
    expect(requested?.pathname).toBe("/json/stations/search");
    expect(requested?.searchParams.get("order")).toBe("clickcount");
    expect(requested?.searchParams.get("hidebroken")).toBe("true");
    expect(result.tracks[0]).toMatchObject({ title: "Fixture FM", streamUrl: "https://radio.example/live.mp3",
      artist: "France · MP3 · 192 kbps", album: "jazz · soul", thumbnailUrl: "https://radio.example/art.png",
      stationWebsite: "https://radio.example/", streamType: "radio", isLive: true });
  });

  it("supports names, exact tags and country codes", async () => {
    const urls: URL[] = [];
    const fetcher = async (input: URL | RequestInfo) => { urls.push(new URL(String(input))); return Response.json([]); };
    await searchRadioDirectory("NTS", signal(), fetcher);
    await searchRadioDirectory("tag:ambient", signal(), fetcher);
    await searchRadioDirectory("country:gb", signal(), fetcher);
    expect(urls[0]?.searchParams.get("name")).toBe("NTS");
    expect(urls[1]?.searchParams.get("tag")).toBe("ambient"); expect(urls[1]?.searchParams.get("tagExact")).toBe("true");
    expect(urls[2]?.searchParams.get("countrycode")).toBe("GB");
  });

  it("drops broken, duplicate and unsafe rows without following station links", async () => {
    const result = await searchRadioDirectory("test", signal(), async () => Response.json([
      ...rows, { ...rows[0], stationuuid: "duplicate" },
      { name: "Broken", url_resolved: "https://broken.example/live", lastcheckok: 0 },
      { name: "Unsafe", url_resolved: "file:///etc/passwd", lastcheckok: 1 },
      { name: "Playlist", url_resolved: "https://example.com/list.m3u", lastcheckok: 1 },
    ]));
    expect(result.tracks).toHaveLength(1);
  });

  it("reports service, payload and format failures clearly", async () => {
    await expect(searchRadioDirectory("x", signal(), async () => new Response("no", { status: 503 }))).rejects.toThrow(/unavailable/);
    await expect(searchRadioDirectory("x", signal(), async () => new Response("{"))).rejects.toThrow(/unreadable/);
    await expect(searchRadioDirectory("x", signal(), async () => new Response("x".repeat(2 * 1024 * 1024 + 1)))).rejects.toThrow(/too large/);
  });
});
