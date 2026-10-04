import { useEffect, useState } from "react";
import { loadCoverArt, type CoverArt } from "../../player/art";
import { lerpHex, playerPalette } from "../theme";

/** Pick a common colourful pixel, then lift it for readable dark-terminal accents. */
export function artworkAccent(art: CoverArt): string | undefined {
  const bins = new Map<string, { count: number; rgb: number[] }>();
  for (const cell of art.cells) for (const colour of [cell.top, cell.bottom]) {
    if (Math.max(...colour) < 40 || Math.max(...colour) - Math.min(...colour) < 25) continue;
    const key = colour.map(c => Math.floor(c / 48)).join(",");
    const bin = bins.get(key);
    if (bin) bin.count++; else bins.set(key, { count: 1, rgb: colour });
  }
  const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return;
  return lerpHex(`#${dominant.rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`, "#ffffff", 0.6);
}
const cache = new Map<string, Promise<string | undefined>>();
function accentFor(source: string) {
  let value = cache.get(source);
  if (!value) {
    value = loadCoverArt(source, 12, 6).then(art => art ? artworkAccent(art) : undefined);
    if (cache.size >= 16) cache.delete(cache.keys().next().value!);
    cache.set(source, value);
  }
  return value;
}
export function useArtworkPalette(theme: string | undefined, enabled: boolean | undefined, source?: string) {
  const [result, setResult] = useState<{ source: string; accent?: string }>();
  useEffect(() => {
    if (!enabled || !source) return;
    let cancelled = false;
    void accentFor(source).then(accent => { if (!cancelled) setResult({ source, accent }); });
    return () => { cancelled = true; };
  }, [enabled, source]);
  const palette = playerPalette(theme);
  const accent = enabled && result?.source === source ? result?.accent : undefined;
  return accent ? { ...palette, accent, selection: accent, selectedText: "#171b2b", alt: lerpHex(accent, "#ffffff", 0.25) } : palette;
}
