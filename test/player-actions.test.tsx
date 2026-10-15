import { expect, it, vi } from "vitest";
import { mouseEvents } from "../src/ui/mouse";
import { Box, Text } from "ink";
import stringWidth from "string-width";
import { ContextMenu } from "../src/ui/components/ContextMenu";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { press, renderReady, act } from "./ink-input";

it("dims unavailable actions and scrolls keyboard selection inside a compact menu", async () => {
  const disabled = vi.fn(), enabled = vi.fn(), close = vi.fn();
  const actions = [{ label: "Pause", disabled: true, run: disabled },
    ...Array.from({ length: 6 }, (_, i) => ({ label: `Action ${i}`, run: enabled }))];
  const view = await renderReady(<StoreContext.Provider value={makeStore()}>
    <Box width={32} height={8}><ContextMenu actions={actions} width={32} height={8} active close={close} /></Box>
  </StoreContext.Provider>);
  expect(view.lastFrame()).toContain("Pause (unavailable)");
  await press(view, "\r"); expect(disabled).not.toHaveBeenCalled();
  for (let i = 0; i < 6; i++) await press(view, "\x1b[B");
  expect(view.lastFrame()).toContain("› Action 5");
  expect(view.lastFrame()!.split("\n").length).toBeLessThanOrEqual(8);
  expect(Math.max(...view.lastFrame()!.split("\n").map(stringWidth))).toBeLessThanOrEqual(32);
  await press(view, "\r"); expect(enabled).toHaveBeenCalledOnce();
  await press(view, "c"); expect(close).toHaveBeenCalledOnce();
});

it("clamps a popup at the bottom-right, preserves background and dismisses outside clicks", async () => {
  const store = makeStore(); store.config.mouseMode = "click";
  const close = vi.fn(), run = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><Box width={80} height={20}>
    <Text>Background still visible</Text>
    <ContextMenu title="Actions" actions={[{ label: "Unavailable", disabled: true, run }]} width={80} height={20}
      anchor={{ x: 79, y: 19 }} active close={close} />
  </Box></StoreContext.Provider>);
  const rows = view.lastFrame()!.split("\n");
  expect(rows[0]).toContain("Background still visible");
  expect(rows[15]!.indexOf("╭")).toBe(40);
  expect(rows[19]!.indexOf("╯")).toBe(79);
  await act(async () => { mouseEvents.emit("press", { x: 43, y: 17 }); });
  expect(run).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  await act(async () => { mouseEvents.emit("press", { x: 0, y: 0 }); });
  expect(close).toHaveBeenCalledOnce();
});
