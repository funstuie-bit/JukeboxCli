import { afterEach, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { ThemeProvider } from "@inkjs/ui";
import { uiTheme } from "../src/ui/theme";
import { PresetPacks } from "../src/ui/components/PresetPacks";
import { installCreamPack } from "../src/player/linux-preset-packs";

vi.mock("../src/player/linux-preset-packs", async original => ({
  ...await original<typeof import("../src/player/linux-preset-packs")>(),
  creamInstalled: async () => false,
  installCreamPack: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
it("downloads only after confirmation, blocks repeated Enter, then selects the installed pack", async () => {
  let complete!: () => void;
  vi.mocked(installCreamPack).mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  const selected = vi.fn();
  const app = render(<ThemeProvider theme={uiTheme}><PresetPacks selected="classic" focused onSelect={selected} onBack={() => {}} /></ThemeProvider>);
  await wait();
  expect(installCreamPack).not.toHaveBeenCalled();
  app.stdin.write("\x1b[B"); await wait(); app.stdin.write("\r"); await wait();
  expect(app.lastFrame()).toContain("~14 MB");
  expect(installCreamPack).not.toHaveBeenCalled();
  app.stdin.write("\x1b[B"); await wait(); app.stdin.write("\r"); await wait();
  app.stdin.write("\r\r"); await wait();
  expect(installCreamPack).toHaveBeenCalledTimes(1);
  expect(selected).not.toHaveBeenCalled();
  complete(); await wait();
  expect(selected).toHaveBeenCalledExactlyOnceWith("cream-of-the-crop");
  expect(app.lastFrame()).toContain("Combined / shuffled");
});
it("keeps the current pack after a failed download", async () => {
  vi.mocked(installCreamPack).mockRejectedValue(new Error("Download failed"));
  const selected = vi.fn();
  const app = render(<ThemeProvider theme={uiTheme}><PresetPacks selected="classic" focused onSelect={selected} onBack={() => {}} /></ThemeProvider>);
  await wait();
  for (const key of ["\x1b[B", "\r", "\x1b[B", "\r"]) { app.stdin.write(key); await wait(); }
  expect(selected).not.toHaveBeenCalled();
  expect(app.lastFrame()).toContain("Download failed");
  expect(app.lastFrame()).toContain("Active: Built-in Classic");
});
