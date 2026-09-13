import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inlineImage, inlineQuery, supportsInline, graphicsProtocol, simpleArtwork } from "../src/player/graphics";
import { encodeSixel } from "../src/player/art";
afterEach(() => vi.unstubAllEnvs());
import { GraphicsPainter, imagePackets, imagePlacement, deleteImage, graphicsQuery, probeGraphics } from "../src/player/graphics";

describe("terminal image lifecycle", () => {
  it("defaults only native Terminal to simple artwork and respects explicit modes", () => {
    expect(simpleArtwork({ TERM_PROGRAM: "Apple_Terminal" })).toBe(true);
    expect(simpleArtwork({ TERM_PROGRAM: "Apple_Terminal", JUKEBOXCLI_ART: "blocks" })).toBe(false);
    for (const terminal of ["ghostty", "iTerm.app", "kitty", "unknown"])
      expect(simpleArtwork({ TERM_PROGRAM: terminal })).toBe(false);
    expect(simpleArtwork({ TERM_PROGRAM: "ghostty", JUKEBOXCLI_ART: "simple" })).toBe(true);
  });
  it("does not probe graphics when simple artwork is explicitly selected", async () => {
    vi.stubEnv("JUKEBOXCLI_ART", "simple");
    const write = vi.fn();
    expect(await probeGraphics({ isTTY: true } as typeof process.stdin,
      { isTTY: true, write } as unknown as typeof process.stdout)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
  const image = { png: new Uint8Array(7000), width: 1024, height: 576 };
  const rect = { x: 3, y: 5, cols: 42, rows: 12 };
  it("renders inline PNGs with explicit inline mode, bounded cell placement and preserved cursor", () => {
    const packet = inlineImage(image, rect);
    expect(packet).toContain("File=inline=1;size=7000;width=42;height=12;preserveAspectRatio=1:");
    expect(packet).toContain("\x1b[6;4H"); expect(packet.endsWith("\x07\x1b8")).toBe(true);
    const writes: string[] = []; const painter = new GraphicsPainter(s => writes.push(s), "iterm");
    const remove = painter.set(image, () => rect); painter.paint(); painter.paint(); remove();
    expect(writes).toEqual([packet, packet]); // Ink clears text-cell art; never erase new text after a frame.
    expect(painter.status.visible).toBe(false);
    expect(supportsInline("AbCdF")).toBe(true); expect(supportsInline("File")).toBe(false);
    expect(inlineImage({ ...image, png: new Uint8Array(740001) }, rect)).toBe("");
  });
  it("does not retransmit an unchanged Sixel raster on playback redraws", () => {
    const sixel = { ...image, sixel: "\x1bPqfixture\x1b\\" };
    const writes: string[] = []; const painter = new GraphicsPainter(s => writes.push(s), "sixel");
    painter.set(sixel, () => rect); painter.paint(); painter.paint(); painter.paint();
    expect(writes).toHaveLength(1);
    painter.set(sixel, () => ({ ...rect, y: rect.y + 1 })); painter.paint();
    expect(writes).toHaveLength(2);
  });
  it("respects an explicit missing inline capability even after an older cell-size reply", async () => {
    vi.stubEnv("TERM_PROGRAM", "iTerm.app");
    const stdin = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
      setRawMode() {}, resume() {}, pause() {}, unshift() {} });
    const stdout = { isTTY: true, write() {
      stdin.emit("data", "\x1b]1337;ReportCellSize=20;10\x07");
      stdin.emit("data", "\x1b]1337;Capabilities=AbCd\x07");
    } };
    expect(await probeGraphics(stdin as unknown as typeof process.stdin, stdout as typeof process.stdout)).toBe(false);
  });
  it("accepts older iTerm2's live cell-size response and consumes all replies", async () => {
    vi.stubEnv("TERM_PROGRAM", "iTerm.app");
    const stdin = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
      setRawMode(value: boolean) { this.isRaw = value; }, resume() {}, pause() {}, keys: "", unshift(buffer: Buffer) { this.keys += buffer.toString(); } });
    const stdout = { isTTY: true, write(query: string) {
      expect(query).toContain(inlineQuery);
      stdin.emit("data", "z\x1b]1337;ReportCellSize=17.50;8.00;2.0\x07");
      stdin.emit("data", "\x1b_Gi=197704;ENOTSUP\x1b\\");
    } };
    expect(await probeGraphics(stdin as unknown as typeof process.stdin, stdout as typeof process.stdout)).toBe(true);
    expect(graphicsProtocol).toBe("iterm"); expect(stdin.keys).toBe("z"); expect(stdin.isRaw).toBe(false);
  });
  it("detects Sixel support from terminal attributes and cell size", async () => {
    const stdin = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
      setRawMode(value: boolean) { this.isRaw = value; }, resume() {}, pause() {}, keys: "", unshift(buffer: Buffer) { this.keys += buffer.toString(); } });
    const stdout = { isTTY: true, write(query: string) {
      expect(query).toContain("\x1b[c");
      stdin.emit("data", "x\x1b[6;20;10t\x1b[?62;4;22c");
    } };
    expect(await probeGraphics(stdin as unknown as typeof process.stdin, stdout as typeof process.stdout)).toBe(true);
    expect(graphicsProtocol).toBe("sixel"); expect(stdin.keys).toBe("x"); expect(stdin.isRaw).toBe(false);
  });
  it("encodes opaque and transparent RGBA pixels as bounded Sixel data", () => {
    const encoded = encodeSixel(new Uint8Array([
      255, 0, 0, 255, 0, 0, 0, 0,
      255, 0, 0, 255, 0, 255, 0, 255,
    ]), 2, 2);
    expect(encoded.startsWith("\x1bP0;1;0q\"1;1;2;2")).toBe(true);
    expect(encoded).toContain("#48");
    expect(encoded).toContain("#12");
    expect(encoded.endsWith("\x1b\\")).toBe(true);
    expect(encodeSixel(new Uint8Array(3), 1, 1)).toBe("");
  });
  it("chunks payloads and preserves the text renderer's cursor", () => {
    const packets = imagePackets(image.png).split("\x1b\\").filter(Boolean);
    expect(packets.length).toBeGreaterThan(1);
    expect(packets.every(p => p.split(";")[1]!.length <= 4096)).toBe(true);
    expect(packets[0]).toContain("a=t,f=100"); expect(packets.at(-1)).toContain("m=0");
    expect(imagePlacement(rect)).toContain("\x1b[6;4H");
    expect(imagePlacement(rect)).toContain("C=1,q=2");
    expect(imagePlacement(rect).endsWith("\x1b8")).toBe(true);
  });
  it("uploads once, repositions after redraw, and removes art on hide and unmount", () => {
    const writes: string[] = []; const painter = new GraphicsPainter(s => writes.push(s));
    let visible = true;
    const remove = painter.set(image, () => visible ? rect : null);
    painter.paint(); painter.paint();
    expect(writes.filter(s => s.includes("a=t"))).toHaveLength(1);
    expect(painter.status.visible).toBe(true);
    visible = false; painter.paint(); expect(writes.at(-1)).toBe(deleteImage);
    expect(painter.status.visible).toBe(false);
    visible = true; painter.paint(); expect(painter.status.visible).toBe(true);
    remove(); expect(painter.status.visible).toBe(false); expect(writes.at(-1)).toBe(deleteImage);
  });
  it("old effect cleanup cannot remove a newer track's image", () => {
    const painter = new GraphicsPainter(() => {});
    const old = painter.set(image, () => rect);
    painter.set({ ...image, width: 800 }, () => rect); painter.paint(); old();
    expect(painter.status.pixels).toEqual([800, 576]);
  });
  it("restores an embedded player's registration after its modal closes", () => {
    const painter = new GraphicsPainter(() => {});
    let hidden = false;
    painter.set(image, () => hidden ? null : rect); painter.paint();
    hidden = true;
    const close = painter.set({ ...image, width: 800 }, () => rect); painter.paint();
    expect(painter.status.pixels).toEqual([800, 576]);
    hidden = false; close();
    expect(painter.status.pixels).toEqual([1024, 576]);
  });
  it("uses an actual fragmented capability reply and preserves early keystrokes", async () => {
    const stdin = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
      setRawMode(value: boolean) { this.isRaw = value; }, resume() {}, pause() {},
      keys: "", unshift(buffer: Buffer) { this.keys += buffer.toString(); } });
    const stdout = { isTTY: true, write(query: string) {
      expect(query).toBe(graphicsQuery);
      stdin.emit("data", Buffer.from("x\x1b[6;20;10t\x1b_Gi=197704;")); stdin.emit("data", Buffer.from("OK\x1b\\"));
    } };
    expect(await probeGraphics(stdin as unknown as typeof process.stdin, stdout as typeof process.stdout)).toBe(true);
    expect(stdin.keys).toBe("x"); expect(stdin.isRaw).toBe(false);
  });
  it("does not write graphics queries to redirected output", async () => {
    const writes: string[] = [];
    expect(await probeGraphics({ isTTY: false } as typeof process.stdin,
      { isTTY: false, write: (s: string) => writes.push(s) } as unknown as typeof process.stdout)).toBe(false);
    expect(writes).toEqual([]);
  });
  it("falls back on a negative capability reply", async () => {
    const stdin = Object.assign(new EventEmitter(), { isTTY: true, isRaw: false,
      setRawMode() {}, resume() {}, pause() {}, unshift() {} });
    const stdout = { isTTY: true, write() { stdin.emit("data", Buffer.from("\x1b_Gi=197704;ENOTSUP\x1b\\")); } };
    expect(await probeGraphics(stdin as unknown as typeof process.stdin, stdout as typeof process.stdout)).toBe(false);
  });
});
