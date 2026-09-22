import { describe, expect, it } from "vitest";
import { setIniValue, setPresetPath } from "../src/player/fullscreen-visualizer";

describe("projectM settings", () => {
  it("sets the core texture search path without joining CRLF comments or losing preferences", () => {
    const text = "Aspect Correction = true # keep\r\n\r\nPreset Path = /old # old\r\nFPS = 35\r\n";
    expect(setPresetPath(text, "/new pack/presets")).toBe("Aspect Correction = true # keep\n\nPreset Path = /new pack/presets\nFPS = 35\n");
    expect(setPresetPath("FPS = 35\n", "/presets")).toContain("\nPreset Path = /presets\n");
    expect(() => setPresetPath(text, "/bad\nsetting")).toThrow();
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

});
