import { EventEmitter } from "node:events";
export const mouseEvents = new EventEmitter();
mouseEvents.setMaxListeners(0); // One subscriber per visible row, removed on unmount.
export interface MousePress { x: number; y: number; button?: "left" | "right" }
export function mousePresses(data: string): MousePress[] {
  return [...data.matchAll(/\x1b\[<(0|2);(\d+);(\d+)M/g)].map(m => ({ x: Number(m[2]) - 1, y: Number(m[3]) - 1, ...(m[1] === "2" ? { button: "right" as const } : {}) }));
}
