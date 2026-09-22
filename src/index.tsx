import { render } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { App } from "./ui/App";
import { uiTheme } from "./ui/theme";
import { parseCliArgs, HELP_TEXT } from "./cli/args";

const ALT_ENTER = "\x1b[?1049h\x1b[H"; // enter alternate screen buffer, home cursor
const ALT_LEAVE = "\x1b[?1049l"; // restore the normal screen
const PASTE_ENTER = "\x1b[?2004h"; // keep a terminal paste together as one input event
const PASTE_LEAVE = "\x1b[?2004l";

// Terminal tab title: save the shell's title on the xterm title stack, set
// ours, and pop the old one back on exit. Terminals without the stack just
// ignore the push/pop and keep our title, which is still the right look.
const TITLE_PUSH = "\x1b[22;0t";
const TITLE_SET = "\x1b]0;♪ JukeboxCli\x07";
const TITLE_POP = "\x1b[23;0t";

// A music TUI must never die from a stray background async error (e.g. an mpv
// IPC command that rejected after the file unloaded). Swallow unhandled
// rejections and keep playing; writing to stderr would corrupt the Ink render.
process.on("unhandledRejection", () => {});

// A truly-uncaught sync error is fatal, but at least leave the terminal usable
// (restore the normal screen) instead of a garbled alternate buffer.
process.on("uncaughtException", (err) => {
  try {
    if (process.stdout.isTTY) process.stdout.write(ALT_LEAVE);
  } catch {
    // ignore
  }
  console.error(err);
  process.exit(1);
});

async function main(): Promise<void> {
  const command = parseCliArgs(process.argv.slice(2));

  if (command.kind === "install-linux-visualizer") {
    try {
      const { installLinuxVisualizer } = await import("./player/linux-visualizer-install");
      await installLinuxVisualizer(console.log);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command.kind === "install-preset-pack" || command.kind === "preset-pack") {
    try {
      if (process.platform !== "linux") throw Error("These preset-pack commands currently support Linux only.");
      const { installCreamPack, creamInstalled, presetPackLabel } = await import("./player/linux-preset-packs");
      const { loadConfig, saveConfig } = await import("./config/config");
      const pack = command.kind === "install-preset-pack" ? "cream-of-the-crop" : command.pack;
      if (command.kind === "install-preset-pack") await installCreamPack(console.log);
      if (pack !== "classic" && !await creamInstalled()) throw Error("Download Cream of the Crop first: jukeboxcli --install-preset-pack cream-of-the-crop");
      await saveConfig({ ...await loadConfig(), fullscreenPresetPack: pack });
      console.log(`${presetPackLabel(pack)} selected. Close any open fullscreen window, then press F in Now Playing.`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  if (command.kind === "doctor") {
    const { installationReport } = await import("./cli/doctor");
    const report = await installationReport();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
    return;
  }

  if (command.kind === "version") {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version: string };
    console.log(pkg.version);
    return;
  }

  if (command.kind === "help") {
    console.log(HELP_TEXT);
    return;
  }

  if (command.kind === "invalid") {
    console.error(`unknown argument: ${command.arg}\n`);
    console.error(HELP_TEXT);
    process.exitCode = 1;
    return;
  }

  // Run the dashboard in the alternate screen so it updates in place like a
  // real TUI (no scrollback, no snapping to the bottom on each keystroke).
  const useAlt = Boolean(process.stdout.isTTY);
  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    if (useAlt) {
      try {
        process.stdout.write(PASTE_LEAVE + ALT_LEAVE + TITLE_POP);
      } catch {
        // ignore
      }
    }
  };

  if (useAlt) {
    // Readline disables bracketed paste before launching a command. Turn it
    // back on before the graphics probe: otherwise a large paste arrives in
    // arbitrary chunks, one of which can look like a standalone shortcut
    // (notably q) and return the rest of the paste to the shell after exit.
    process.stdout.write(TITLE_PUSH + TITLE_SET + ALT_ENTER + PASTE_ENTER);
    process.on("exit", restore);
  }

  try {
    const { probeGraphics, enableGraphics } = await import("./player/graphics");
    if (await probeGraphics()) enableGraphics();
    const graphics = await import("./player/graphics");
    const { waitUntilExit } = render(
      <ThemeProvider theme={uiTheme}>
        <App initialAdd={command.initialAdd} initialOverrides={command.overrides} />
      </ThemeProvider>,
      {
        // Sixel images occupy terminal cells. Updating only changed text lines
        // keeps Foot from erasing and repainting the cover on every visualizer
        // frame, which previously made otherwise-sharp artwork flash.
        incrementalRendering: true,
        onRender: () => { setImmediate(() => graphics.graphicsPainter?.paint()); },
      },
    );
    await waitUntilExit();
    graphics.graphicsPainter?.clear();
  } finally {
    restore();
  }

  // Force-exit so dangling handles (timers, mpv, watcher) don't hang the terminal
  process.exit(0);
}

main().catch((err: unknown) => {
  try {
    if (process.stdout.isTTY) process.stdout.write(ALT_LEAVE);
  } catch {
    // ignore
  }
  console.error(err);
  process.exit(1);
});
