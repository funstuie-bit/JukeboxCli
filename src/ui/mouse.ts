import { EventEmitter } from "node:events";
export const mouseEvents = new EventEmitter();
mouseEvents.setMaxListeners(0); // One subscriber per visible row, removed on unmount.
export interface MousePress { handled?: boolean; x: number; y: number; button?: "left" | "right" }
export interface MouseEvent extends MousePress { kind: "press" | "move" | "release" | "wheel"; down?: boolean }
/** Bounded decoder retains only an unfinished SGR packet across stdin chunks. */
export class MouseDecoder {
  private tail = "";
  push(chunk: string): MouseEvent[] {
    const text = this.tail + chunk; this.tail = "";
    const events: MouseEvent[] = [];
    for (const m of text.matchAll(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/g)) {
      const code = Number(m[1]); if (code & 4) continue; // Shift belongs to terminal text selection.
      if ((code & 64) && (code & 3) > 1) continue;
      const x = Number(m[2]), y = Number(m[3]);
      if (![code, x, y].every(Number.isSafeInteger) || x < 1 || y < 1 || x > 1_000_000 || y > 1_000_000) continue;
      if (!(code & 64) && !(code & 32) && (code & 3) > 2) continue;
      events.push({ x: x - 1, y: y - 1,
        button: (code & 3) === 2 ? "right" : "left",
        kind: code & 64 ? "wheel" : m[4] === "m" ? "release" : code & 32 ? "move" : "press",
        ...(code & 64 ? { down: !!(code & 1) } : {}) });
    }
    const partial = text.match(/\x1b(?:\[(?:<(?:\d*(?:;\d*){0,2})?)?)?$/)?.[0];
    if (partial && partial.length < 96) this.tail = partial;
    return events;
  }
}
export function mousePresses(data: string): MousePress[] {
  return [...data.matchAll(/\x1b\[<(0|2);(\d+);(\d+)M/g)].map(m => ({ x: Number(m[2]) - 1, y: Number(m[3]) - 1, ...(m[1] === "2" ? { button: "right" as const } : {}) }));
}
