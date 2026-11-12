import { useState } from "react";
import { Box, Text } from "ink";
import { expect, it, vi } from "vitest";
import { renderReady, act, press } from "./ink-input";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { ThemeEditor } from "../src/ui/components/ThemeEditor";
import { MiniPlayer } from "../src/ui/components/MiniPlayer";
import { ListeningTools } from "../src/ui/components/ListeningTools";
import { PaletteProvider, usePalette } from "../src/ui/palette";
import { MouseRow } from "../src/ui/components/MouseRow";
import { mouseEvents } from "../src/ui/mouse";
import { Home } from "../src/ui/sections/Home";
import type { Config } from "../src/config/config";
import stringWidth from "string-width";

it("previews the shared chrome palette and discards on unmount without writes", async () => {
  const s=makeStore({region:"content",contentWidth:78,listRows:25}),save=vi.fn(); s.setConfig=save;
  function Colour() { return <Text>{usePalette().accent}</Text>; }
  function Harness({editor=true}:{editor?:boolean}) {
    const [preview,setPreview]=useState<Config|null>(null);
    return <StoreContext.Provider value={{...s,config:preview??s.config,previewConfig:setPreview}}><PaletteProvider config={preview??s.config}>
      <Colour />{editor?<ThemeEditor focused onBack={()=>{}}/>:null}
    </PaletteProvider></StoreContext.Provider>;
  }
  const v=await renderReady(<Harness/>); await press(v,"\x1b[C"); expect(v.lastFrame()).toContain("#bdcbd5"); expect(save).not.toHaveBeenCalled();
  await act(async()=>v.rerender(<Harness editor={false}/>)); expect(v.lastFrame()).toContain("#b8a5ed"); expect(save).not.toHaveBeenCalled();
});
it.each([[80,24],[100,30],[120,40],[160,50]])("fits Home and a three-line mini-player at %s×%s",async(cols,rows)=>{
  const s=makeStore({cols,rows,contentWidth:cols-30,listRows:rows-7,region:"content"});
  const v=await renderReady(<StoreContext.Provider value={s}><Home/></StoreContext.Provider>,cols);
  expect(v.lastFrame()!.split("\n").length).toBeLessThanOrEqual(s.listRows);
  expect(v.lastFrame()!.split("\n").every(line=>stringWidth(line)<=s.contentWidth)).toBe(true);
  expect(v.lastFrame()).toContain(cols===80?"JUKEBOX":"Your jukebox");
  await act(async()=>v.rerender(<StoreContext.Provider value={s}><MiniPlayer close={()=>{}}/></StoreContext.Provider>));
  expect(v.lastFrame()!.split("\n")).toHaveLength(3);
});
it("keeps timer controls and the selected EQ band visible in a short window",async()=>{
  const s=makeStore({cols:80,rows:24,listRows:17,captureMode:"menu"}); s.playback.setSleepTimer=vi.fn();
  const v=await renderReady(<StoreContext.Provider value={s}><ListeningTools close={()=>{}}/></StoreContext.Provider>);
  await press(v,"\x1b[C"); await press(v,"\r"); expect(s.playback.setSleepTimer).toHaveBeenCalledWith("minutes",31);
  for(let i=0;i<30&&!v.lastFrame()?.includes("› 16k Hz");i++) await press(v,"\x1b[B");
  expect(v.lastFrame()).toContain("› 16k Hz: 0 dB"); await press(v,"\x1b[C"); expect(v.lastFrame()).toContain("› 16k Hz: 1 dB");
  expect(v.lastFrame()!.split("\n").length).toBeLessThanOrEqual(24);
});
it("throttles a captured drag, flushes release outside the target and removes listeners",async()=>{
  const s=makeStore({cols:80,rows:24}); s.config.mouseMode="click";
  const click=vi.fn(),drag=vi.fn(), before=mouseEvents.listenerCount("move");
  const v=await renderReady(<StoreContext.Provider value={s}><Box width={20}><MouseRow active width={20} onClick={click} onDrag={drag}><Text>Seek target</Text></MouseRow></Box></StoreContext.Provider>);
  await act(async()=>{mouseEvents.emit("press",{x:1,y:0});for(let x=2;x<19;x++)mouseEvents.emit("move",{x,y:0});mouseEvents.emit("release",{x:40,y:4});});
  expect(click).toHaveBeenCalledOnce(); expect(drag).toHaveBeenCalledOnce(); expect(drag).toHaveBeenLastCalledWith(1);
  await act(async()=>v.unmount()); expect(mouseEvents.listenerCount("move")).toBe(before);
});
