import { expect, it } from "vitest";
import type { Key } from "ink";
import { bindingError, shortcutInput, shortcutLabel, validBindings } from "../src/ui/shortcuts";
import { appearancePalette, readableForeground, validAppearance } from "../src/ui/appearance";
import { playerPalette } from "../src/ui/theme";
const key = {} as Key;
it("remaps actions, suppresses old keys and keeps scopes independent", () => {
  const bindings = { next: "ctrl+n", queueRemove: "!" };
  expect(shortcutInput("n", { ...key, ctrl: true }, bindings, "global")?.[0]).toBe("n");
  expect(shortcutInput("n", key, bindings, "global")).toBeNull();
  expect(shortcutInput("x", key, bindings, "queue")).toBeNull();
  expect(shortcutInput("x", key, bindings, "player")?.[0]).toBe("x");
  expect(shortcutLabel("n p", bindings)).toBe("ctrl+n p");
});
it("rejects collisions, navigation keys, escape strings and unknown actions", () => {
  expect(bindingError({ next: "p" })).toContain("conflicts");
  expect(bindingError({ pause: "ctrl+c" })).toContain("reserved");
  expect(bindingError({ next: "/" })).toContain("reserved");
  expect(validBindings({ next: "\x1b[H" })).toEqual({});
  expect(validBindings({ mystery: "a", next: "ctrl+n" })).toEqual({ next: "ctrl+n" });
  expect(validBindings({ next: "n" })).toEqual({});
});
it("validates appearance and preserves defaults; explicit accent wins over artwork", () => {
  expect(validAppearance({ background: "red", accent: "\x1b[2J", highContrast: "yes" })).toEqual({ background: "transparent", border: "round", highContrast: false, accent: undefined });
  expect(appearancePalette("lavender")).toEqual(playerPalette("lavender"));
  expect(appearancePalette("lavender", { accent: "#111111" }, "#00ff00")).toMatchObject({ accent: "#111111", selectedText: "#ffffff" });
  expect(readableForeground("#ffffff")).toBe("#000000");
  expect(appearancePalette("lavender", { highContrast: true }).text).toBe("#ffffff");
});
