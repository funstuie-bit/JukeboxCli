import { useState } from "react";
import { expect, it, vi } from "vitest";
import { press, renderReady } from "./ink-input";
import { makeStore } from "../scripts/fake-data";
import { StoreContext } from "../src/ui/store";
import { Settings } from "../src/ui/sections/Settings";

function Harness({ listRows = 30 }: { listRows?: number }) {
  const [store] = useState(() => makeStore({ region: "content", listRows }));
  const [config, setConfig] = useState(store.config);
  return <StoreContext.Provider value={{ ...store, config, setConfig }}><Settings /></StoreContext.Provider>;
}
async function appearance(view: Awaited<ReturnType<typeof renderReady>>) {
  await press(view, "\x1b[F");
  for (let i = 0; i < 20 && !view.lastFrame()?.includes("❯ Player appearance"); i++) await press(view, "\x1b[A");
  expect(view.lastFrame()).toContain("❯ Player appearance"); await press(view, "\r");
}
it("shows every appearance option with room and keeps focus across repeated toggles", async () => {
  const view = await renderReady(<Harness />); await appearance(view);
  expect(view.lastFrame()).toContain("Theme editor: preview / save");
  expect(view.lastFrame()).toContain("all options shown");
  await press(view, "\x1b[F"); await press(view, "\x1b[A");
  expect(view.lastFrame()).toContain("❯ Browsing artwork previews: off");
  await press(view, "\r"); expect(view.lastFrame()).toContain("❯ Browsing artwork previews: on");
  await press(view, "\r"); expect(view.lastFrame()).toContain("❯ Browsing artwork previews: off");
  await press(view, "\x1b[A"); await press(view, "\r");
  expect(view.lastFrame()).toContain("❯ Player layout: clean");
  await press(view, "\r"); expect(view.lastFrame()).toContain("❯ Player layout: classic");
  await press(view, "\x1b[F"); await press(view, "\r");
  expect(view.lastFrame()).toContain("Theme editor · preview");
  await press(view, "\x1b"); await vi.waitFor(() => expect(view.lastFrame()).toContain("❯ Theme editor: preview / save"));
});
it("scrolls a short window with a position indicator and keeps a toggled row visible", async () => {
  const view = await renderReady(<Harness listRows={11} />); await appearance(view);
  expect(view.lastFrame()).toContain("showing 1–5");
  await press(view, "\x1b[F"); await press(view, "\x1b[A"); await press(view, "\r");
  expect(view.lastFrame()).toContain("❯ Browsing artwork previews: on");
  expect(view.lastFrame()).toContain("Pg↑/↓ scroll");
  expect(view.lastFrame()!.split("\n").length).toBeLessThanOrEqual(11);
  await press(view, "\x1b[H"); expect(view.lastFrame()).toContain("❯ Theme:");
});
it("also retains keyboard preferences after toggling and returning from the shortcut editor", async () => {
  const view = await renderReady(<Harness />);
  await press(view, "\x1b[F"); await press(view, "\r");
  await press(view, "\x1b[F"); await press(view, "\x1b[A"); await press(view, "\r");
  expect(view.lastFrame()).toContain("❯ Online playlist queue continuation: on");
  await press(view, "\r"); expect(view.lastFrame()).toContain("❯ Online playlist queue continuation: off");
  await press(view, "\x1b[B"); await press(view, "\r");
  expect(view.lastFrame()).toContain("Custom shortcuts");
  await press(view, "\x1b"); await vi.waitFor(() => expect(view.lastFrame()).toContain("❯ Custom shortcuts: edit / reset"));
});
