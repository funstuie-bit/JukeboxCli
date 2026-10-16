import { beforeEach, expect, it, vi } from "vitest";
import stringWidth from "string-width";
import { Home } from "../src/ui/sections/Home";
import { StoreContext } from "../src/ui/store";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { renderReady, press, act } from "./ink-input";
import { readStations } from "../src/player/stations";
import { trackFromUrl } from "../src/player/url";
import { mouseEvents } from "../src/ui/mouse";
vi.mock("../src/player/stations", async original => ({ ...await original<typeof import("../src/player/stations")>(), readStations:vi.fn() }));
beforeEach(()=>{vi.mocked(readStations).mockReturnValue([{name:"Fixture Jazz",url:"https://example.com/jazz.mp3"},{name:"Fixture House",url:"https://example.com/house.mp3"}]);});
function fixture(width=110,height=40) {
  const s=makeStore({cols:width+30,rows:height+8,contentWidth:width,listRows:height,region:"content",section:"home"});
  s.config.mouseMode="click"; s.playTrack=vi.fn(); s.setSection=vi.fn(); s.setPendingSearch=vi.fn();
  for (let i=0;i<3;i++) s.history.record({...trackFromUrl(`https://example.com/track${i}.mp3`),title:`Recent fixture ${i}`,artist:"Fixture Artist"});
  return s;
}
it("shows useful quick cards, listening context and stations with aligned borders",async()=>{
  const s=fixture(),v=await renderReady(<StoreContext.Provider value={s}><Home /></StoreContext.Provider>,s.cols);
  const frame=v.lastFrame()!;
  for(const label of ["START LISTENING","RECENT LISTENING","SAVED STATIONS","YouTube videos","Playback queue","Fixture Jazz","Recent fixture 2"]) expect(frame).toContain(label);
  expect(s.playTrack).not.toHaveBeenCalled(); expect(s.setSection).not.toHaveBeenCalled();
  const row=frame.split("\n").find(line=>line.includes("Songs, artists"))!;
  expect(row.lastIndexOf("│")).toBe(109);
});
it.each([[110,40],[70,28],[52,14],[35,10],[20,8]])("fits %s columns and %s rows and never selects a clipped action",async(width,height)=>{
  const s=fixture(width,height),v=await renderReady(<StoreContext.Provider value={s}><Home /></StoreContext.Provider>,s.cols);
  for(let i=0;i<15;i++){
    const frame=v.lastFrame()!;
    expect(frame.split("\n").length).toBeLessThanOrEqual(height);
    expect(frame.split("\n").every(line=>stringWidth(line)<=width)).toBe(true);
    expect(frame).toContain("›"); await press(v,"\x1b[B");
  }
});
it("opens video search by keyboard and supports clicks while the sidebar owns keyboard focus",async()=>{
  const s=fixture(),v=await renderReady(<StoreContext.Provider value={s}><Home /></StoreContext.Provider>,s.cols);
  await press(v,"\x1b[B"); await press(v,"\r");
  expect(s.setSection).toHaveBeenCalledWith("videos"); expect(s.setPendingSearch).toHaveBeenCalledWith(true);
  s.region="sidebar"; await act(async()=>v.rerender(<StoreContext.Provider value={s}><Home /></StoreContext.Provider>));
  const rows=v.lastFrame()!.split("\n"),y=rows.findIndex(line=>line.includes("Local music library"));
  await act(async()=>{mouseEvents.emit("press",{x:rows[y]!.indexOf("Local music library")+1,y});});
  expect(s.setSection).toHaveBeenCalledWith("library");
});
it("preserves a recent item's selection across history updates",async()=>{
  const s=fixture(),v=await renderReady(<StoreContext.Provider value={s}><Home /></StoreContext.Provider>,s.cols);
  for(let i=0;i<6;i++) await press(v,"\x1b[B");
  expect(v.lastFrame()).toContain("› Recent · Recent fixture 2");
  await act(async()=>s.history.record({...trackFromUrl("https://example.com/new.mp3"),title:"New fixture"}));
  expect(v.lastFrame()).toContain("› Recent · Recent fixture 2");
  await press(v,"\r"); expect(s.playTrack).toHaveBeenCalledWith(expect.objectContaining({title:"Recent fixture 2"}));
});
it("offers cookie recovery on Home without changing saved settings",async()=>{
  const s=fixture(); s.playback=makeFakePlayback({cookieRetryAvailable:true}); s.playback.retryWithoutCookies=vi.fn(async()=>{}); s.setConfig=vi.fn();
  const v=await renderReady(<StoreContext.Provider value={s}><Home /></StoreContext.Provider>,s.cols);
  for(let i=0;i<6;i++) await press(v,"\x1b[B");
  expect(v.lastFrame()).toContain("› Retry without cookies"); await press(v,"\r");
  expect(s.playback.retryWithoutCookies).toHaveBeenCalledOnce(); expect(s.setConfig).not.toHaveBeenCalled();
});
