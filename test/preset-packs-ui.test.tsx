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
const waitForFrame = async (app: ReturnType<typeof render>, text: string) => {
  await vi.waitFor(() => expect(app.lastFrame()).toContain(text), { timeout: 3000 });
};
async function confirmDownload(app: ReturnType<typeof render>) {
  await waitForFrame(app, "❯ Built-in Classic");
  app.stdin.write("\x1b[B");
  await waitForFrame(app, "❯ Download Cream of the Crop");
  app.stdin.write("\r");
  await waitForFrame(app, "~14 MB");
  expect(installCreamPack).not.toHaveBeenCalled();
  app.stdin.write("\x1b[B");
  await waitForFrame(app, "❯ Download and select");
  app.stdin.write("\r");
  await vi.waitFor(() => expect(installCreamPack).toHaveBeenCalledTimes(1));
}
it("downloads only after confirmation, blocks repeated Enter, then selects the installed pack", async () => {
  let complete!: () => void;
  vi.mocked(installCreamPack).mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  const selected = vi.fn();
  const app = render(<ThemeProvider theme={uiTheme}><PresetPacks selected="classic" focused onSelect={selected} onBack={() => {}} /></ThemeProvider>);
  await confirmDownload(app);
  await waitForFrame(app, "Installing…");
  app.stdin.write("\r\r");
  await waitForFrame(app, "Installing…");
  expect(installCreamPack).toHaveBeenCalledTimes(1);
  expect(selected).not.toHaveBeenCalled();
  complete();
  await vi.waitFor(() => expect(selected).toHaveBeenCalledExactlyOnceWith("cream-of-the-crop"));
  await waitForFrame(app, "Combined / shuffled");
});
it("keeps the current pack after a failed download", async () => {
  vi.mocked(installCreamPack).mockRejectedValue(new Error("Download failed"));
  const selected = vi.fn();
  const app = render(<ThemeProvider theme={uiTheme}><PresetPacks selected="classic" focused onSelect={selected} onBack={() => {}} /></ThemeProvider>);
  await confirmDownload(app);
  await waitForFrame(app, "Download failed");
  expect(selected).not.toHaveBeenCalled();
  expect(app.lastFrame()).toContain("Active: Built-in Classic");
});
