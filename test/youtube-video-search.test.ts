import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("youtubei.js", () => ({ Log: { setLevel() {}, Level: { ERROR: 0 } }, Innertube: { create: async () => ({ search: api.search }) } }));
import { searchYouTubeVideos, youtubeVideoPage, youtubeVideoResult } from "../src/sources/music";
const video = { type: "Video", video_id: "abcdefghijk", title: { toString: () => "A documentary" }, author: { name: "Channel" },
  thumbnails: [{url:"https://example.com/cover.jpg",width:100}], get duration() { return { seconds: 123, text: "2:03" }; }, is_live: false };
it("maps ordinary videos to stable watch URLs with metadata, and skips non-video nodes", () => {
  const result = youtubeVideoResult(video)!;
  expect(result.track).toMatchObject({ streamUrl: "https://www.youtube.com/watch?v=abcdefghijk", durationSec:123, artist:"Channel", isLive:false });
  expect(result.subtitle).toContain("2:03");
  expect(youtubeVideoResult({ ...video, is_live:true })?.subtitle).toContain("LIVE");
  for (const value of [null, {...video,type:"Channel"}, {...video,video_id:"invalid"}]) expect(youtubeVideoResult(value)).toBeNull();
});
it("uses general YouTube video search and continues through the same API", async () => {
  const getContinuation = vi.fn(async () => ({ videos:[video],has_continuation:false }));
  api.search.mockResolvedValue({videos:[video],has_continuation:true,getContinuation});
  const page = await searchYouTubeVideos(" documentary ");
  expect(api.search).toHaveBeenCalledWith("documentary",{type:"video"});
  expect(page.items).toHaveLength(1); const next = await page.more!();
  expect(next.items).toHaveLength(1); expect(next.more).toBeUndefined();
});
it("refuses cancelled continuation and does not search empty input", async () => {
  const getContinuation=vi.fn(); const page=youtubeVideoPage({videos:[],has_continuation:true,getContinuation},"test");
  const c=new AbortController(); c.abort();
  expect(()=>page.more!(c.signal)).toThrow(); expect(getContinuation).not.toHaveBeenCalled();
  api.search.mockClear(); expect((await searchYouTubeVideos(" ")).items).toEqual([]); expect(api.search).not.toHaveBeenCalled();
});
