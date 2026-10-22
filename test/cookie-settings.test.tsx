import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderReady, press } from "./ink-input";
import { Settings } from "../src/ui/sections/Settings";
import { StoreContext, type CaptureMode } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { detectBrowserProfiles } from "../src/config/cookies";
vi.mock("../src/config/cookies", async original => ({
  ...await original<typeof import("../src/config/cookies")>(), detectBrowserProfiles: vi.fn(),
}));
beforeEach(() => { vi.mocked(detectBrowserProfiles).mockResolvedValue([]); });
async function open() {
  const save = vi.fn();
  function Harness() {
    const [store] = useState(() => makeStore({region:"content",listRows:30}));
    const [config,setConfig] = useState(store.config);
    const [captureMode,setCaptureMode] = useState<CaptureMode>("none");
    return <StoreContext.Provider value={{...store,config,captureMode,setCaptureMode,setConfig:next=>{ save(next); setConfig(next); }}}><Settings /></StoreContext.Provider>;
  }
  const view = await renderReady(<Harness />);
  for (let i=0;i<4;i++) await press(view,"\x1b[B");
  await press(view,"\r");
  await vi.waitFor(()=>expect(view.lastFrame()).toContain("Firefox · automatic profile"));
  return {view,save};
}
it("still lets users choose a browser when no profiles are detected", async () => {
  const {view,save}=await open();
  expect(view.lastFrame()).toContain("No profiles detected automatically");
  expect(view.lastFrame()).toContain("Google Chrome · automatic profile");
  await press(view,"\x1b[B");
  await press(view,"\r");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({cookiesFromBrowser:"firefox",cookiesFile:undefined}));
});
it("accepts an explicit browser profile and captures text without global shortcuts", async () => {
  const {view,save}=await open();
  for(let i=0;i<3;i++) await press(view,"\x1b[B"); await press(view,"\r");
  expect(view.lastFrame()).toContain("Browser / profile");
  await press(view,"firefox:/custom/music profile"); await press(view,"\r");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({cookiesFromBrowser:"firefox:/custom/music profile"}));
});
it("rejects invalid browser selectors and returns from the file editor to the picker", async () => {
  const {view,save}=await open();
  for(let i=0;i<3;i++) await press(view,"\x1b[B"); await press(view,"\r");
  await press(view,"unknown-browser"); await press(view,"\r");
  expect(view.lastFrame()).toContain("Choose firefox, chrome"); expect(save).not.toHaveBeenCalled();
  await press(view,"\x1b");
  await vi.waitFor(()=>expect(view.lastFrame()).toContain("Firefox · automatic profile"));
  for (let i=0;i<4;i++) await press(view,"\x1b[B");
  await press(view,"\r"); expect(view.lastFrame()).toContain("Cookies file path");
  await press(view,"\x1b"); await vi.waitFor(()=>expect(view.lastFrame()).toContain("Firefox · automatic profile"));
  expect(save).not.toHaveBeenCalled();
});
it("shows anonymous mode as a valid choice and leaves preferences unchanged",async()=>{
  const {view,save}=await open();
  expect(view.lastFrame()).toContain("Keep anonymous playback");
  expect(view.lastFrame()).toContain("Public links are tried without sign-in");
  expect(save).not.toHaveBeenCalled();await press(view,"\r");
  expect(save).not.toHaveBeenCalled();expect(view.lastFrame()).toContain("Anonymous · cookies optional");
});
