import { describe, expect, it } from "vitest";
import stringWidth from "string-width";
import { wrapLyric } from "../src/ui/components/lyric-layout";
describe("wrapped lyrics", () => {
  it("preserves words while wrapping long and wide Unicode text into terminal cells", () => {
    for (const text of ["One two three four", "東京の音楽 🎵 café", "superlongunbrokentext"]) {
      const rows = wrapLyric({ at: 0, text }, 3, 8);
      expect(rows.every(r => r.line === 3)).toBe(true);
      expect(rows.every(r => stringWidth(r.parts.map(p => p.text).join("")) <= 8)).toBe(true);
      expect(rows.flatMap(r => r.parts).map(p => p.text).join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
    }
  });
  it("retains word indices across wrapped rows for supplied timing", () => {
    const rows = wrapLyric({ at: 0, text: "Hello world", words: [{ at: 0, text: "Hello" }, { at: 2, text: "world" }] }, 0, 7);
    expect(rows).toEqual([{ line: 0, parts: [{ text: "Hello", word: 0 }] }, { line: 0, parts: [{ text: "world", word: 1 }] }]);
  });
});
