import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { findOnPath } from "../util/exec";
import { loadConfig } from "../config/config";
import { linuxVisualizerExecutable } from "./linux-visualizer-install";
import { preparePresetPack } from "./linux-preset-packs";

export type FullscreenVisualizerResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

let visualizerProcess: ChildProcess | null = null;

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

export function setPresetPath(source: string, directory: string): string {
  if (/[\r\n#]/.test(directory)) throw Error("Preset directory contains unsupported characters.");
  // Work by lines: JS multiline \s also consumes CRLF boundaries, which can
  // accidentally attach Preset Path to the preceding comment and hide it.
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let found = false;
  const updated = lines.map(line => {
    if (!/^[\t ]*Preset Path[\t ]*=/.test(line)) return line;
    found = true;
    return `Preset Path = ${directory}`;
  });
  if (!found) updated.push(`Preset Path = ${directory}`);
  return updated.join("\n").trimEnd() + "\n";
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

  const [projectM, pactl] = await Promise.all([
    linuxVisualizerExecutable(), findOnPath("pactl"),
  ]);
  if (!projectM) {
    return { ok: false, message: "Install the logo-free fullscreen companion: jukeboxcli --install-linux-visualizer (or rerun ./install.sh on Arch)." };
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

  let packWarning: string | undefined;
  try {
    const configDir = projectMConfigDir();
    const pack = await preparePresetPack((await loadConfig()).fullscreenPresetPack ?? "classic");
    packWarning = pack.warning;
    await fs.mkdir(configDir, { recursive: true });
    // PlaylistFile controls the Qt playlist; the core also needs Preset Path
    // so it discovers textures beside the selected presets.
    const coreFile = path.join(configDir, "config.inp");
    let core = await fs.readFile(coreFile, "utf8").catch(() => "");
    if (!core) core = await fs.readFile("/usr/share/projectM/config.inp", "utf8").catch(() => "");
    await fs.writeFile(coreFile, setPresetPath(core, pack.directory));
    await Promise.all([
      writeIniValues(path.join(configDir, "qprojectM.conf"), {
        FullscreenOnStartup: "true",
        ShuffleOnStartup: "true",
        PlaylistFile: pack.directory,
      }),
      writeIniValues(path.join(configDir, "qprojectM-pulseaudio.conf"), {
        pulseAudioDeviceName: `${sink}.monitor`,
        tryFirstAvailablePlaybackMonitor: "false",
      }),
    ]);
  } catch (error) {
    return { ok: false, message: `Could not prepare fullscreen effects: ${error instanceof Error ? error.message : "settings unavailable"}` };
  }

  const child = spawn(projectM, [], { stdio: ["ignore", "ignore", "pipe"] });
  visualizerProcess = child;
  child.once("exit", () => { if (visualizerProcess === child) visualizerProcess = null; });
  child.once("error", () => { if (visualizerProcess === child) visualizerProcess = null; });
  return await waitForVisualizerReady(child, packWarning);
}

/** A spawn event is not proof that a real preset is ready to draw. */
export function waitForVisualizerReady(child: ChildProcess, warning?: string, timeoutMs = 15000): Promise<FullscreenVisualizerResult> {
  return new Promise(resolve => {
    let settled = false, output = "";
    const finish = (result: FullscreenVisualizerResult) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, message: "Fullscreen effects could not prepare a preset. Try Built-in Classic in MilkDrop packs." });
    }, timeoutMs);
    child.stderr?.on("data", chunk => {
      const incoming = output + chunk.toString();
      output = incoming.slice(-4096);
      if (incoming.includes("JUKEBOXCLI_PROJECTM_READY")) {
        finish({ ok: true, message: warning ?? "Fullscreen effects opened · close the window to return." });
      } else if (incoming.includes("JUKEBOXCLI_PROJECTM_ERROR")) {
        child.kill("SIGKILL");
        finish({ ok: false, message: "No playable fullscreen startup preset. Try Built-in Classic in MilkDrop packs." });
      }
    });
    child.once("error", () => finish({ ok: false, message: "Fullscreen companion could not start. Run jukeboxcli --install-linux-visualizer to rebuild it." }));
    child.once("exit", () => finish({ ok: false, message: "Fullscreen companion closed before a preset was ready." }));
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
