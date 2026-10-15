import { expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("execa", () => ({ execa: run }));
import { createStreamResolver } from "../src/player/resolve";
import { trackFromUrl } from "../src/player/url";
it("keeps audio and video caches separate and selects a combined audiovisual stream", async () => {
  run.mockResolvedValue({ stdout: JSON.stringify({url:"https://example.com/media", title:"Video"}) });
  const resolve = createStreamResolver(async () => ({} as any));
  const t = trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk");
  const signal = new AbortController().signal;
  await resolve(t, signal); await resolve(t, signal, false, "video");
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[0][1]).toContain("bestaudio/best");
  expect(run.mock.calls[1][1]).toContain("best[vcodec!=none][acodec!=none]");
  await resolve(t, signal); await resolve(t, signal, false, "video");
  expect(run).toHaveBeenCalledTimes(2);
});
