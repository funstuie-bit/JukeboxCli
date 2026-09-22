import { describe, expect, it, vi } from "vitest";
import { randomPresetCommand, setIniValue, setPresetPath, skipProjectMIntro } from "../src/player/fullscreen-visualizer";

describe("projectM settings", () => {
  it("sets the core texture search path without joining CRLF comments or losing preferences", () => {
    const text = "Aspect Correction = true # keep\r\n\r\nPreset Path = /old # old\r\nFPS = 35\r\n";
    expect(setPresetPath(text, "/new pack/presets")).toBe("Aspect Correction = true # keep\n\nPreset Path = /new pack/presets\nFPS = 35\n");
    expect(setPresetPath("FPS = 35\n", "/presets")).toContain("\nPreset Path = /presets\n");
    expect(() => setPresetPath(text, "/bad\nsetting")).toThrow();
  });
  const hyprTools = { hyprctl: "/usr/bin/hyprctl", wtype: null, xdotool: null };

  it("skips the intro through Lua without also sending the legacy shortcut", async () => {
    const run = vi.fn().mockResolvedValue("ok\n");
    await skipProjectMIntro(hyprTools, 42, run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[1][0]).toBe("eval");
  });

  it.each(["error response", "command failure"])("supports legacy Hyprland after %s", async (failure) => {
    const run = vi.fn().mockResolvedValue("ok");
    if (failure === "command failure") run.mockRejectedValueOnce(new Error("unknown command"));
    else run.mockResolvedValueOnce("error: Lua unavailable");
    await skipProjectMIntro(hyprTools, 42, run);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]?.[1]).toEqual(["dispatch", "sendshortcut", "CTRL,", "R,", "class:projectM-pulseaudio"]);
  });

  it("uses the existing non-Hyprland helper without a Lua probe", async () => {
    const run = vi.fn().mockResolvedValue("");
    await skipProjectMIntro({ ...hyprTools, hyprctl: null, wtype: "/usr/bin/wtype" }, 42, run);
    expect(run).toHaveBeenCalledExactlyOnceWith("/usr/bin/wtype", ["-M", "ctrl", "r", "-m", "ctrl"]);
  });
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
