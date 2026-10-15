import { expect, it, vi } from "vitest";
import stringWidth from "string-width";
import { PlayerActions } from "../src/ui/components/PlayerActions";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { press, renderReady } from "./ink-input";

it("dims unavailable actions and scrolls keyboard selection inside a compact menu", async () => {
  const disabled = vi.fn(), enabled = vi.fn(), close = vi.fn();
  const actions = [{ label: "Pause", disabled: true, run: disabled },
    ...Array.from({ length: 6 }, (_, i) => ({ label: `Action ${i}`, run: enabled }))];
  const view = await renderReady(<StoreContext.Provider value={makeStore()}>
    <PlayerActions actions={actions} width={32} height={8} active close={close} />
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
