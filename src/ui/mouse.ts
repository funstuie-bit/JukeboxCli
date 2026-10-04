import { EventEmitter } from "node:events";
export const mouseEvents = new EventEmitter();
mouseEvents.setMaxListeners(0); // One subscriber per visible row, removed on unmount.
export interface MousePress { x: number; y: number }
export function mousePresses(data: string): MousePress[] {
  return [...data.matchAll(/\x1b\[<0;(\d+);(\d+)M/g)].map(m => ({ x: Number(m[1]) - 1, y: Number(m[2]) - 1 }));
}
