import { describe, expect, it } from "vitest";
import { randomPresetCommand, setIniValue } from "../src/player/fullscreen-visualizer";

describe("projectM settings", () => {
  it("updates its key while retaining unrelated projectM preferences", () => {
    const source = "[General]\nPlaylistFile=/presets\nFullscreenOnStartup=false\n\n[Window]\nwidth=800\n";
    expect(setIniValue(source, "General", "FullscreenOnStartup", "true")).toBe(
      "[General]\nPlaylistFile=/presets\nFullscreenOnStartup=true\n\n[Window]\nwidth=800\n",
    );
  });

  it("creates a General section for a first launch", () => {
    expect(setIniValue("", "General", "pulseAudioDeviceName", "speakers.monitor")).toBe(
      "[General]\npulseAudioDeviceName=speakers.monitor\n",
    );
  });

  it("uses a focused-window helper to skip projectM's branded intro", () => {
    expect(randomPresetCommand({ hyprctl: null, wtype: "/usr/bin/wtype", xdotool: null }, 42)).toEqual({
      command: "/usr/bin/wtype",
      args: ["-M", "ctrl", "r", "-m", "ctrl"],
    });
    expect(randomPresetCommand({ hyprctl: null, wtype: null, xdotool: "/usr/bin/xdotool" }, 42)?.args).toContain("42");
    expect(randomPresetCommand({ hyprctl: "/usr/bin/hyprctl", wtype: null, xdotool: null }, 42)?.args).toContain("class:projectM-pulseaudio");
  });
});
