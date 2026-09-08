import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { GraphicsPainter, imagePackets, imagePlacement, deleteImage, graphicsQuery, probeGraphics } from "../src/player/graphics";

describe("terminal image lifecycle", () => {
  const image = { png: new Uint8Array(7000), width: 1024, height: 576 };
  const rect = { x: 3, y: 5, cols: 42, rows: 12 };
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
