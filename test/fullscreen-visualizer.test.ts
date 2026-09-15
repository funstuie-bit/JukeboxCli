import { describe, expect, it } from "vitest";
import { setIniValue } from "../src/player/fullscreen-visualizer";

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
});
