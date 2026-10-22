import { beforeEach, expect, it, vi } from "vitest";
const run=vi.hoisted(()=>vi.fn());
vi.mock("execa",()=>({execa:run}));
import { createStreamResolver } from "../src/player/resolve";
import { trackFromUrl } from "../src/player/url";
import { defaultConfig } from "../src/config/config";
import { ytDlpLookupError } from "../src/ytdlp/errors";
import { enumerate } from "../src/ytdlp/ytdlp";
beforeEach(()=>{run.mockReset();});

it.each(["audio","video"] as const)("starts public YouTube %s with a fresh no-cookie profile and no cookie arguments",async mode=>{
  const config={...defaultConfig},before=JSON.stringify(config);
  run.mockResolvedValue({stdout:JSON.stringify({url:"https://cdn.example/public",title:"Public fixture"})});
  const resolve=createStreamResolver(async()=>config);
  const result=await resolve(trackFromUrl("https://youtu.be/abcdefghijk"),new AbortController().signal,false,mode);
  expect(result.url).toBe("https://cdn.example/public");expect(run).toHaveBeenCalledTimes(1);
  const args=run.mock.calls[0]![1] as string[];
  expect(args).toContain("--ignore-config");expect(args).not.toContain("--cookies");expect(args).not.toContain("--cookies-from-browser");
  expect(args).toContain("--js-runtimes");expect(JSON.stringify(config)).toBe(before);
});
it.each([
  ["ERROR: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies.","verification"],
  ["ERROR: HTTP Error 429: Too Many Requests; use cookies", "rate-limit"],
  ["ERROR: Private video. Sign in if granted access. Use cookies.","authentication"],
  ["ERROR: Sign in to confirm your age. Use cookies.","authentication"],
  ["WARNING: No supported JavaScript runtime could be found.\nERROR: Requested format is not available", "javascript"],
  ["WARNING: Cookie help: https://example.com/cookies\nERROR: HTTP Error 403: Forbidden", "blocked"],
  ["ERROR: could not find firefox cookies database at /private/profile", "lookup"],
  ["ERROR: operation timed out", "timeout"],
] as const)("distinguishes anonymous source failure: %s",(stderr,reason)=>{
  const error=ytDlpLookupError({stderr},false);
  expect(error.reason).toBe(reason);expect(error.message).not.toMatch(/https:|\/private|--cookies|selected browser/);
});
it("offers cookie-file recovery only when a cookie source was actually used",()=>{
  const error={stderr:"ERROR: failed to decrypt cookies /private/profile"};
  expect(ytDlpLookupError(error,true).reason).toBe("cookies");expect(ytDlpLookupError(error,false).reason).not.toBe("cookies");
});
it("does not retry a bot challenge repeatedly or inspect a browser automatically",async()=>{
  run.mockRejectedValue({stderr:"ERROR: Sign in to confirm you are not a bot. Use --cookies"});
  const resolve=createStreamResolver(async()=>({...defaultConfig}));
  await expect(resolve(trackFromUrl("https://youtu.be/abcdefghijk"),new AbortController().signal)).rejects.toMatchObject({reason:"verification"});
  expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0]![1]).not.toContain("--cookies-from-browser");
});
it("uses the same safe anonymous errors for pasted-link metadata without requiring a profile",async()=>{
  run.mockRejectedValue({stderr:"ERROR: Sign in to confirm you are not a bot. Use --cookies-from-browser /private/profile https://example.com/?secret=token"});
  const error=await enumerate("https://www.youtube.com/watch?v=abcdefghijk",{flat:false}).catch(e=>e);
  expect(error.reason).toBe("verification");expect(error.message).not.toMatch(/secret|token|\/private|--cookies/);
});
