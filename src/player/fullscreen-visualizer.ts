import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { findOnPath } from "../util/exec";

export type FullscreenVisualizerResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

let visualizerProcess: ChildProcess | null = null;

type ShortcutTools = { hyprctl: string | null; wtype: string | null; xdotool: string | null };
type ShortcutRunner = (command: string, args: string[]) => Promise<string>;

/** New Hyprland uses Lua; retain the legacy dispatcher for older desktops. */
export async function skipProjectMIntro(
  tools: ShortcutTools,
  pid: number,
  run: ShortcutRunner = async (command, args) => (await execa(command, args, { timeout: 3000 })).stdout,
): Promise<void> {
  if (tools.hyprctl) {
    try {
      const reply = await run(tools.hyprctl, ["eval",
        'hl.dispatch(hl.dsp.send_key_state({mods="CTRL",key="r",state="down",window="class:projectM-pulseaudio"})); ' +
        'hl.timer(function() hl.dispatch(hl.dsp.send_key_state({mods="CTRL",key="r",state="up",window="class:projectM-pulseaudio"})) end, {timeout=50,type="oneshot"})',
      ]);
      // hyprctl can return status zero with an error in its response text.
      if (reply.trim() === "ok") return;
    } catch { /* Older Hyprland has no eval command. */ }
  }
  const action = randomPresetCommand(tools, pid);
  if (action) await run(action.command, action.args);
}

export function randomPresetCommand(
  tools: ShortcutTools,
  pid: number,
): { command: string; args: string[] } | null {
  if (tools.hyprctl) {
    return {
      command: tools.hyprctl,
      args: ["dispatch", "sendshortcut", "CTRL,", "R,", "class:projectM-pulseaudio"],
    };
  }
  if (tools.wtype) {
    return { command: tools.wtype, args: ["-M", "ctrl", "r", "-m", "ctrl"] };
  }
  if (tools.xdotool) {
    return {
      command: tools.xdotool,
      args: ["search", "--sync", "--onlyvisible", "--pid", String(pid), "windowactivate", "--sync", "key", "--clearmodifiers", "ctrl+r"],
    };
  }
  return null;
}

/** Update one QSettings-style INI key without discarding unrelated settings. */
export function setIniValue(source: string, section: string, key: string, value: string): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source ? source.replace(/\r\n/g, "\n").split("\n") : [];
  const heading = `[${section}]`;
  const sectionAt = lines.findIndex(line => line.trim() === heading);
  if (sectionAt < 0) {
    if (lines.length && lines.at(-1) !== "") lines.push("");
    lines.push(heading, `${key}=${value}`);
  } else {
    let end = lines.findIndex((line, i) => i > sectionAt && /^\s*\[.+\]\s*$/.test(line));
    if (end < 0) end = lines.length;
    const keyAt = lines.findIndex((line, i) => i > sectionAt && i < end && line.split("=", 1)[0]?.trim() === key);
    if (keyAt >= 0) lines[keyAt] = `${key}=${value}`;
    else lines.splice(sectionAt + 1, 0, `${key}=${value}`);
  }
  while (lines.at(-1) === "") lines.pop();
  return lines.join(newline) + newline;
}

async function writeIniValues(file: string, values: Record<string, string>): Promise<void> {
  let source = "";
  try { source = await fs.readFile(file, "utf8"); } catch { /* first projectM launch */ }
  for (const [key, value] of Object.entries(values)) source = setIniValue(source, "General", key, value);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, source, "utf8");
}

function projectMConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "projectM");
}

/**
 * Open the optional Linux projectM companion window. projectM captures the
 * active output monitor, so playback remains owned by the existing mpv process.
 */
export async function launchFullscreenVisualizer(): Promise<FullscreenVisualizerResult> {
  if (process.platform !== "linux") {
    return { ok: false, message: "Fullscreen effects are currently available on Linux." };
  }
  if (visualizerProcess && visualizerProcess.exitCode === null && !visualizerProcess.killed) {
    return { ok: true, message: "Fullscreen effects are already open." };
  }

  const [projectM, pactl, hyprctl, wtype, xdotool] = await Promise.all([
    findOnPath("projectM-pulseaudio"),
    findOnPath("pactl"),
    process.env.HYPRLAND_INSTANCE_SIGNATURE ? findOnPath("hyprctl") : Promise.resolve(null),
    findOnPath("wtype"),
    findOnPath("xdotool"),
  ]);
  if (!projectM) {
    return { ok: false, message: "Install projectM-pulseaudio to use fullscreen effects." };
  }
  if (!pactl) {
    return { ok: false, message: "Fullscreen effects need PipeWire/PulseAudio pactl." };
  }

  let sink: string;
  try {
    const result = await execa(pactl, ["get-default-sink"], { timeout: 3000 });
    sink = result.stdout.trim();
  } catch {
    return { ok: false, message: "Could not find the active Linux audio output." };
  }
  if (!sink) return { ok: false, message: "No active Linux audio output was found." };

  try {
    const configDir = projectMConfigDir();
    await Promise.all([
      writeIniValues(path.join(configDir, "qprojectM.conf"), {
        FullscreenOnStartup: "true",
        ShuffleOnStartup: "true",
      }),
      writeIniValues(path.join(configDir, "qprojectM-pulseaudio.conf"), {
        pulseAudioDeviceName: `${sink}.monitor`,
        tryFirstAvailablePlaybackMonitor: "false",
      }),
    ]);
  } catch {
    return { ok: false, message: "Could not save projectM's fullscreen audio settings." };
  }

  return await new Promise(resolve => {
    const child = spawn(projectM, [], { stdio: "ignore" });
    visualizerProcess = child;
    let settled = false;
    child.once("spawn", () => {
      settled = true;
      // projectM opens with a built-in M/headphones branding preset. Once its
      // fullscreen window has focus, select a real playlist preset immediately.
      const introTimer = setTimeout(() => {
        if (visualizerProcess !== child || child.exitCode !== null) return;
        void skipProjectMIntro({ hyprctl, wtype, xdotool }, child.pid ?? 0).catch(() => {});
      }, 1800);
      introTimer.unref();
      resolve({ ok: true, message: "Fullscreen effects opened · close the window to return." });
    });
    child.once("error", () => {
      if (visualizerProcess === child) visualizerProcess = null;
      if (!settled) resolve({ ok: false, message: "projectM could not open its graphics window." });
    });
    child.once("exit", () => {
      if (visualizerProcess === child) visualizerProcess = null;
    });
  });
}

/** Stop only the companion process started by this JukeboxCLI session. */
export function closeFullscreenVisualizer(): void {
  const child = visualizerProcess;
  visualizerProcess = null;
  // The legacy Qt PulseAudio frontend ignores SIGTERM on some Linux builds.
  // It owns no playback or JukeboxCLI data, so use a definite process cleanup
  // when the parent app exits; closing its window remains the normal path.
  if (child && child.exitCode === null && !child.killed) child.kill("SIGKILL");
}
