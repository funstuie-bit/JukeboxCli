import stringWidth from "string-width";
import type { LyricLine } from "../../player/lyrics";

export interface LyricPart { text: string; word?: number }
export interface LyricRow { line: number; parts: LyricPart[] }
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Wrap by terminal cells, retaining supplied word indices for genuine timing. */
export function wrapLyric(line: LyricLine, index: number, width: number): LyricRow[] {
  width = Math.max(2, width);
  const rows: LyricRow[] = [];
  let parts: LyricPart[] = [], cells = 0;
  const flush = () => { if (parts.length) rows.push({ line: index, parts }); parts = []; cells = 0; };
  const tokens = line.words?.map((w, word) => ({ text: w.text, word })) ??
    (line.text || "♪").split(/\s+/).map(text => ({ text, word: undefined }));
  for (const token of tokens) {
    if (cells && cells + 1 + stringWidth(token.text) > width) flush();
    if (cells) { parts.push({ text: " " }); cells++; }
    for (const { segment } of graphemes.segment(token.text)) {
      const size = stringWidth(segment);
      if (cells + size > width) flush();
      const previous = parts.at(-1);
      if (previous && previous.word === token.word && previous.text !== " ") previous.text += segment;
      else parts.push({ text: segment, word: token.word });
      cells += size;
    }
  }
  flush(); return rows;
}
