import { afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ fetch: undefined as undefined | typeof fetch }));
vi.mock("youtubei.js", () => ({ Log: { setLevel() {}, Level: { ERROR: 0 } }, Innertube: {
  create: async (options: { fetch: typeof fetch }) => {
    fixture.fetch = options.fetch;
    return { music: { search: async (query: string) => {
      await options.fetch(`https://example.com/${query}`);
      return { contents: [], has_continuation: false };
    } } };
  },
} }));
import { searchMusic, searchPage } from "../src/sources/music";
afterEach(() => vi.unstubAllGlobals());
it("cancels one online search without cancelling another concurrent consumer", async () => {
  const signals: AbortSignal[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    signals.push(init.signal);
    if (String(_url).endsWith("slow")) return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(Error("aborted"))));
    return Response.json({});
  }));
  const controller = new AbortController();
  const first = searchMusic("slow", "song", controller.signal).catch(e => e.message);
  await searchMusic("fast", "song");
  controller.abort(); expect(await first).toBe("aborted");
  expect(signals[0]!.aborted).toBe(true); expect(signals[1]!.aborted).toBe(false);
});
it("refuses a cancelled continuation before asking the provider", () => {
  const getContinuation = vi.fn();
  const page = searchPage({ contents: [], has_continuation: true, getContinuation }, "song", "fixture");
  const c = new AbortController(); c.abort();
  expect(() => page.more!(c.signal)).toThrow(); expect(getContinuation).not.toHaveBeenCalled();
});
