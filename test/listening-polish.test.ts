import { expect, it, vi } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import stringWidth from "string-width";
import { validEqualizer, equalizerFilter, validChapters, audioDetailsLabel } from "../src/player/audio-tools";
import { lifecycleEvent } from "../src/player/lifecycle";
import { MouseDecoder } from "../src/ui/mouse";
import { PlayHistory } from "../src/player/history";
import { trackFromUrl } from "../src/player/url";
import { defaultConfig } from "../src/config/config";
import { createSizeEstimator, estimateFromInfo, estimateLabel } from "../src/ytdlp/estimate";
import { videoRow } from "../src/ui/sections/Discover";
import { PLAYER_THEMES } from "../src/ui/theme";
import { appearancePalette, contrastRatio } from "../src/ui/appearance";

it("bypasses flat EQ, clamps invalid profiles and owns only its labelled filter", () => {
  expect(equalizerFilter(validEqualizer(undefined))).toBeNull();
  expect(equalizerFilter({ enabled: true, gains: Array(10).fill(0) })).toBeNull();
  const value = validEqualizer({ enabled: true, gains: [Infinity, 30, -30, NaN] });
  expect(value.gains).toEqual([0,12,-12,0,0,0,0,0,0,0]);
  expect(equalizerFilter(value)).toMatch(/^@jukebox-eq:lavfi=\[aresample=48000,volume=-12dB,/);
  expect(equalizerFilter(value)).not.toMatch(/spectrum|pipe:|asplit/);
});
it("keeps unknown audio details honest and rejects malformed chapters/events", () => {
  expect(audioDetailsLabel()).toBe("Audio format pending");
  expect(audioDetailsLabel({ codec: "opus", decodedRate: 48000, outputRate: 44100 })).toContain("decoded 48 kHz · output 44.1 kHz");
  expect(validChapters([{time:9,title:"Nine"},{time:-1},{time:NaN},{time:0,title:"Intro\x1b"},{time:9}])).toEqual([{time:0,title:"Intro"},{time:9,title:"Nine"}]);
  for (const input of ['{}','null','{"type":"quit"}','{"type":"wake"','not json']) expect(lifecycleEvent(input)).toBeUndefined();
  expect(lifecycleEvent('{"type":"sleep"}')).toBe("sleep");
});
it("decodes split and coalesced pointer gestures, preserving Shift selection", () => {
  const d = new MouseDecoder();
  expect(d.push("\x1b[<0;11;")).toEqual([]);
  expect(d.push("5M\x1b[<32;20;5M\x1b[<0;20;5m").map(e=>[e.kind,e.x,e.y])).toEqual([["press",10,4],["move",19,4],["release",19,4]]);
  expect(d.push("\x1b[<4;2;2M\x1b[<66;2;2M\x1b[<0;0;2M")).toEqual([]);
  expect(d.push("\x1b[<65;3;4M")[0]).toMatchObject({kind:"wheel",down:true});
});
it("persists bounded progress safely, excludes live radio and clears only resume points", async () => {
  const file = path.join(await mkdtemp(path.join(os.tmpdir(),"jukebox-resume-")),"history.json");
  const h = await PlayHistory.load(file), t = trackFromUrl("https://youtu.be/abcdefghijk"), live = trackFromUrl("https://example.com/live",true);
  h.record(t); h.record(live); h.recordProgress(t.id,60,300); h.recordProgress(live.id,60,300);
  expect(h.continuing()).toHaveLength(1); expect(h.progress(live.id)).toBeUndefined();
  await h.flush(); const loaded = await PlayHistory.load(file);
  expect(loaded.progress(t.id)).toMatchObject({position:60,duration:300});
  loaded.recordProgress(t.id,299,300); expect(loaded.continuing()).toEqual([]);
  loaded.clearProgress(); await loaded.flush(); expect(loaded.ids()).toHaveLength(2);
  expect(await readFile(file,"utf8")).not.toContain('"position"');
});
it("size estimates are opted in, cancellable, cached and use the downloader format", async () => {
  const lookup = vi.fn(async () => ({filesize_approx: 1048576,vcodec:"none"})), estimate = createSizeEstimator(lookup);
  const t = trackFromUrl("https://youtu.be/abcdefghijk"), controller = new AbortController();
  expect(await estimate(t,defaultConfig,controller.signal)).toEqual({}); expect(lookup).not.toHaveBeenCalled();
  const cfg = {...defaultConfig,downloadEstimates:true,formatString:"bestaudio[ext=m4a]"};
  expect(estimateLabel(await estimate(t,cfg,controller.signal))).toBe("~1.0 MB audio download estimate");
  await estimate(t,cfg,controller.signal); expect(lookup).toHaveBeenCalledTimes(1);
  const args = lookup.mock.calls[0]![0];
  expect(args).toContain("--skip-download"); expect(args).toContain("bestaudio[ext=m4a]"); expect(args).not.toContain("--cookies-from-browser");
  controller.abort(); await expect(estimate(t,cfg,controller.signal)).rejects.toThrow();
  expect(estimateFromInfo({requested_formats:[{filesize:10},{filesize:20}]},{audioFormat:"mp3"})).toMatchObject({bytes:30,converted:true});
  expect(estimateLabel(estimateFromInfo({filesize:10},{audioFormat:"mp3"}))).toContain("saved size unknown");
  expect(estimateFromInfo({is_live:true,filesize:100},{})).toEqual({});
});
it("rich video columns stay within their cell budget, including wide characters", () => {
  const item = {id:"a",kind:"video" as const,title:"🎺日本語 ".repeat(30),published:"2 days ago",views:"1M views",track:trackFromUrl("https://youtu.be/abcdefghijk")};
  for (const width of [24,50,80,110,150]) expect(stringWidth(videoRow(item,width,true,"resume"))).toBeLessThanOrEqual(width);
  expect(videoRow(item,150,true,"watched")).toContain("1M views");
});
it("built-in solid themes maintain readable text and selections", () => {
  for (const theme of PLAYER_THEMES) {
    const p = appearancePalette(theme,{background:"solid"});
    for (const role of ["text","muted","alt","accent","good","warn","bad"] as const) expect(contrastRatio(p[role],"#10131b"),`${theme}.${role}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.selectedText,p.selection)).toBeGreaterThanOrEqual(4.5);
  }
});
