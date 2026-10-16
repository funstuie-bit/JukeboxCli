import { useState } from "react";
import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import stringWidth from "string-width";
import { Home } from "../src/ui/sections/Home";
import { StoreContext, type Store } from "../src/ui/store";
import { JukeboxMark, JUKEBOX_MARK } from "../src/ui/components/JukeboxMark";
import { defaultConfig, type Config } from "../src/config/config";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { renderReady, press, act } from "./ink-input";
import { loadCoverArt, loadCoverImage } from "../src/player/art";
import { readStations } from "../src/player/stations";
import { macVisualizerInstalled } from "../src/player/macos-visualizer-install";
import { mouseEvents } from "../src/ui/mouse";
vi.mock("../src/player/art", async original => ({ ...await original<typeof import("../src/player/art")>(), loadCoverArt: vi.fn(async()=>null), loadCoverImage:vi.fn(async()=>null) }));
vi.mock("../src/player/stations", async original => ({ ...await original<typeof import("../src/player/stations")>(), readStations: vi.fn(()=>[]) }));
vi.mock("../src/player/macos-visualizer-install", async original => ({ ...await original<typeof import("../src/player/macos-visualizer-install")>(), macVisualizerSupported:()=>true, macVisualizerInstalled:vi.fn(async()=>false) }));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(macVisualizerInstalled).mockResolvedValue(false);vi.mocked(readStations).mockReturnValue([]);});
function harness(width=112, height=40, config:Partial<Config>={}, firstRun=false) {
  const writes=vi.fn(), pending=vi.fn(), section=vi.fn();
  const store=makeStore({cols:width+30,contentWidth:width,listRows:height,section:"home",region:"content",config:{...defaultConfig,...config},playTrack:vi.fn(),setPendingSettings:pending,setSection:section});
  function Host(){const [cfg,setCfg]=useState(store.config);return <StoreContext.Provider value={{...store,config:cfg,setConfig:c=>{writes(c);setCfg(c);}}}><Home firstRun={firstRun}/></StoreContext.Provider>;}
  return {node:<Host/>,store,writes,pending,section};
}
it("offers mouse setup explicitly on first launch without changing preferences or launching music",async()=>{
  const h=harness(112,40,{},true),v=await renderReady(h.node,h.store.cols);
  expect(v.lastFrame()).toContain("Mouse clicks OFF"); expect(h.writes).not.toHaveBeenCalled();
  await press(v,"u"); expect(v.lastFrame()).toContain("SETUP & EXTRAS");
  expect(v.lastFrame()).toContain("Shift-drag selects terminal text");
  await press(v,"\r"); expect(h.writes).toHaveBeenCalledWith(expect.objectContaining({mouseMode:"click",firstRunComplete:false}));
  expect(v.lastFrame()).toContain("❯ ✓ Mouse clicks"); expect(h.store.playTrack).not.toHaveBeenCalled();
  await press(v,"\x1b"); await vi.waitFor(()=>expect(v.lastFrame()).toContain("Mouse clicks ON"));
});
it.each([[112,40],[70,24],[35,12],[20,8]])("fits setup to %s x %s and scrolls without losing the selected option",async(width,height)=>{
  const h=harness(width,height),v=await renderReady(h.node,h.store.cols);
  await press(v,"u");
  for(let i=0;i<10;i++){
    const lines=v.lastFrame()!.split("\n");
    expect(lines.length).toBeLessThanOrEqual(height);expect(lines.every(line=>stringWidth(line)<=width)).toBe(true);
    expect(v.lastFrame()).toContain("❯");await press(v,"\x1b[B");
  }
});
it("remembers hide-checklist without removing access to setup or overwriting mouse/cookies",async()=>{
  const h=harness(112,40,{mouseMode:"off",cookiesFromBrowser:"firefox"}),v=await renderReady(h.node,h.store.cols);
  await press(v,"u"); await press(v,"\x1b[F"); await press(v,"\x1b[A"); await press(v,"\r");
  expect(h.writes).toHaveBeenCalledWith(expect.objectContaining({homeSetupDismissed:true,mouseMode:"off",cookiesFromBrowser:"firefox"}));
  expect(v.lastFrame()).not.toContain("Mouse clicks OFF"); expect(v.lastFrame()).toContain("u Setup & extras");
  await press(v,"u"); expect(v.lastFrame()).toContain("SETUP & EXTRAS");
});
it("opens the optional pack confirmation directly, without running an install or changing preferences",async()=>{
  const h=harness(),v=await renderReady(h.node,h.store.cols);await press(v,"u");
  for(let i=0;i<6;i++)await press(v,"\x1b[B");
  expect(v.lastFrame()).toContain("projectM fullscreen pack: optional");await press(v,"\r");
  expect(h.pending).toHaveBeenCalledWith("visualizer-install");expect(h.section).toHaveBeenCalledWith("settings");expect(h.writes).not.toHaveBeenCalled();
});
it("reports an already installed optional pack rather than nagging to download it",async()=>{
  vi.mocked(macVisualizerInstalled).mockResolvedValue(true);
  const h=harness(),v=await renderReady(h.node,h.store.cols);await press(v,"u");expect(v.lastFrame()).toContain("installed · manage / repair");
});
it("keeps focus on appearance toggles and preserves unrelated preferences",async()=>{
  const h=harness(112,40,{mouseMode:"wheel",cookiesFromBrowser:"firefox"}),v=await renderReady(h.node,h.store.cols);await press(v,"u");
  for(let i=0;i<3;i++)await press(v,"\x1b[B");await press(v,"\r");expect(v.lastFrame()).toContain("❯ Artwork colours: on");
  await press(v,"\x1b[B");await press(v,"\r");expect(v.lastFrame()).toContain("❯ Decorative motion: on");
  expect(h.writes).toHaveBeenLastCalledWith(expect.objectContaining({artworkColours:true,reducedMotion:false,cookiesFromBrowser:"firefox",mouseMode:"wheel"}));
});
it("uses supplied artwork for Home tiles, with no provider search or auto-play",async()=>{
  vi.mocked(readStations).mockReturnValue([{name:"Fixture Radio",url:"https://example.com/radio.mp3",thumbnailUrl:"https://example.com/radio.png"}]);
  const h=harness(124,44);h.store.history.record({...h.store.library.all()[0]!});
  const v=await renderReady(h.node,h.store.cols);
  expect(v.lastFrame()).toContain("THE LISTENING ROOM");expect(v.lastFrame()).toContain("SAVED STATIONS");
  expect(vi.mocked(loadCoverArt)).toHaveBeenCalled();expect(h.store.playTrack).not.toHaveBeenCalled();
});
it("uses a quiet tile while artwork loads and replaces it when the decode finishes",async()=>{
  let complete!: (art:Awaited<ReturnType<typeof loadCoverArt>>)=>void;
  vi.mocked(loadCoverArt).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
  const h=harness(110,40);h.store.history.record(h.store.library.all()[0]!);
  const v=await renderReady(h.node,h.store.cols);expect(v.lastFrame()).not.toContain("Loading artwork");
  await act(async()=>complete({cols:8,rows:4,brightness:0.5,cells:Array.from({length:32},()=>({top:[120,80,200],bottom:[60,40,120]}))}));
  expect(v.lastFrame()).toContain("▀");
});
it("plays a recent item when its artwork tile is clicked",async()=>{
  const h=harness(110,40,{mouseMode:"click"});const track=h.store.library.all()[0]!;h.store.history.record(track);
  const v=await renderReady(h.node,h.store.cols);
  const y=v.lastFrame()!.split("\n").findIndex(line=>line.includes("Recent · Song Title"));
  await act(async()=>{mouseEvents.emit("press",{x:3,y});});
  expect(h.store.playTrack).toHaveBeenCalledWith(track);
});
it("stops Home animation on pause, loading and hidden views without a clock-driven dashboard redraw",async()=>{
  const interval=vi.spyOn(globalThis,"setInterval"),clear=vi.spyOn(globalThis,"clearInterval");
  try {
    const h=harness(110,40,{reducedMotion:false});const p=h.store.playback,events=new EventEmitter();
    p.on=((name,listener)=>{events.on(name,listener);return p;}) as typeof p.on;
    p.off=((name,listener)=>{events.off(name,listener);return p;}) as typeof p.off;
    const v=await renderReady(<StoreContext.Provider value={h.store}><Home/></StoreContext.Provider>,h.store.cols);
    const timer=interval.mock.results[interval.mock.calls.findIndex(call=>call[1]===900)]!.value;
    await act(async()=>events.emit("state",{...p.getState(),paused:true}));expect(clear).toHaveBeenCalledWith(timer);
    await act(async()=>events.emit("state",{...p.getState(),loading:true}));
    const before=interval.mock.calls.filter(call=>call[1]===900).length;
    await act(async()=>events.emit("state",{...p.getState(),loading:true,position:200}));
    expect(interval.mock.calls.filter(call=>call[1]===900)).toHaveLength(before);
    await act(async()=>v.rerender(<StoreContext.Provider value={{...h.store,region:"help"}}><Home/></StoreContext.Provider>));
    expect(interval.mock.calls.filter(call=>call[1]===900)).toHaveLength(before);
    await act(async()=>v.unmount());expect(events.listenerCount("state")).toBe(0);
  } finally {interval.mockRestore();clear.mockRestore();}
});
it("decorates only the cabinet grille when motion is enabled and stops its timer on unmount",async()=>{
  vi.useFakeTimers();
  const interval=vi.spyOn(globalThis,"setInterval"),clear=vi.spyOn(globalThis,"clearInterval");
  try {
    const v=await renderReady(<JukeboxMark animate/>);
    const initial=v.lastFrame();await act(async()=>{vi.advanceTimersByTime(900);});
    expect(v.lastFrame()).not.toBe(initial);expect(v.lastFrame()).toContain("[ C L I ]");
    expect(v.lastFrame()!.split("\n").map(row=>row.length)).toEqual(JUKEBOX_MARK.split("\n").map(row=>row.trimEnd().length));
    const timer=interval.mock.results[interval.mock.calls.findIndex(call=>call[1]===900)]!.value;
    await act(async()=>v.unmount());expect(clear).toHaveBeenCalledWith(timer);
  } finally {interval.mockRestore();clear.mockRestore();vi.useRealTimers();}
});
