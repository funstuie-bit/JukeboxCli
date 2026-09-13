import { describe, expect, it } from "vitest";
import { BANDS, BandMeter, SpectrumDynamics, nextSpectrumMode, spectrumGraph, spectrumRows, visualizerEnabled } from "../scripts/spectrum-core";
const record = (time: number, db: string) => `frame:0 pts:0 pts_time:${time}\nlavfi.astats.Overall.RMS_level=${db}\n`;
describe("isolated spectrum prototype", () => {
  it("enables Linux by default with an explicit off switch", () => {
    expect(visualizerEnabled({}, "linux")).toBe(true);
    expect(visualizerEnabled({ JUKEBOXCLI_VISUALIZER: "0" }, "linux")).toBe(false);
    expect(visualizerEnabled({}, "darwin")).toBe(false);
    expect(visualizerEnabled({ JUKEBOXCLI_VISUALIZER: "1" }, "darwin")).toBe(true);
  });
  it("splits analysis from unchanged output and uses fixed inherited pipes", () => {
    const graph = spectrumGraph();
    expect(graph).toContain("[in]asplit[out][analysis]");
    expect(graph.match(/anullsink/g)).toHaveLength(BANDS.length);
    expect(graph).toContain("pipe\\:10"); expect(graph).not.toContain("pan=");
  });
  it("parses partial lines, negative infinity and rejects invalid metadata", () => {
    const m = new BandMeter(), data = record(1, "-25.5");
    m.push(data.slice(0, 20)); m.push(data.slice(20));
    expect(m.at(1)?.db).toBe(-25.5);
    m.push(record(2, "-inf")); expect(m.at(2)?.db).toBe(-120);
    m.push(record(3, "NaN")); expect(m.at(3)).toBeUndefined();
  });
  it("uses playback timestamps instead of the latest decoded frame and discards stale history", () => {
    const m = new BandMeter(); m.push(record(1, "-20") + record(1.5, "-5"));
    expect(m.at(1.1)?.db).toBe(-20); expect(m.at(0)).toBeUndefined(); expect(m.at(2)).toBeUndefined();
    m.clear(); expect(m.at(1)).toBeUndefined();
  });
  it("caps history and recovers from oversized malformed lines", () => {
    const m = new BandMeter();
    for (let i = 0; i < 2000; i++) m.push(record(i / 20, "-10"));
    expect(m.samples).toHaveLength(128);
    m.push("x".repeat(100000)); m.push("\n" + record(100, "-15"));
    expect(m.at(100)?.db).toBe(-15); expect(m.samples).toHaveLength(128);
  });
  it("renders silence honestly and remains bounded across terminal sizes", () => {
    for (const width of [8, 35, 100]) for (const height of [1, 3, 8]) {
      const silent = spectrumRows(BANDS.map(() => -120), width, height);
      expect(silent.join("").trim()).toBe("");
      const rows = spectrumRows(BANDS.map(() => -10), width, height);
      expect(rows).toHaveLength(height); expect(rows.every(row => row.length === width)).toBe(true);
      expect(rows.join("").trim()).not.toBe("");
    }
  });
  it("renders narrow interpolated LED bars from the bottom", () => {
    expect(spectrumRows([-10, -65], 2, 1)).toEqual(["█ "]);
    expect(spectrumRows([-65, -10], 2, 1)).toEqual([" █"]);
    expect(spectrumRows([-10], 1, 2)).toEqual(["█", "█"]);
    expect(spectrumRows([-37.5], 1, 2)).toEqual([" ", "█"]);
    expect(spectrumRows(BANDS.map(() => -10), 24, 1)).toEqual(["██ ██ ██ ██ ██ ██ ██ ██ "]);
  });
  it("uses fast attack, slow decay and falling peak caps", () => {
    const motion = new SpectrumDynamics();
    const attack = motion.update([-10]);
    expect(attack.body[0]).toBeGreaterThan(-25);
    motion.update([-120]);
    const falling = motion.update([-120]);
    expect(falling.body[0]).toBeLessThan(attack.body[0]!);
    expect(falling.peaks[0]).toBeGreaterThan(falling.body[0]!);
    expect(spectrumRows(falling.body, 6, 3, falling.peaks).join("")).toContain("▀");
    expect(motion.update([-10], true)).toEqual({ body: [-120], peaks: [-120] });
  });
  it("cycles distinct persistent presentation modes over the same readings", () => {
    expect(nextSpectrumMode()).toBe("smooth");
    expect(nextSpectrumMode("smooth")).toBe("mirror");
    expect(nextSpectrumMode("mirror")).toBe("classic");
    const values = [-12, -55, -30, -45, -20, -60, -38, -24];
    const classic = spectrumRows(values, 24, 4, values, "classic");
    const smooth = spectrumRows(values, 24, 4, values, "smooth");
    const mirror = spectrumRows(values, 24, 4, values, "mirror");
    expect(new Set([classic.join("\n"), smooth.join("\n"), mirror.join("\n")]).size).toBe(3);
    expect(mirror.every(row => row === [...row].reverse().join(""))).toBe(true);
  });
  it("leaves missing, non-finite and sub-floor readings blank", () => {
    for (const values of [[], [NaN, Infinity, -Infinity], [-120, -66, -65]]) {
      expect(spectrumRows(values, 20, 4).join("").trim()).toBe("");
    }
  });
});
