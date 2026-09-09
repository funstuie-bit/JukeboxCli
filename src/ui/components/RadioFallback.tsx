import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { PlayerPalette } from "../theme";

/** Original terminal artwork, not album art or an audio-reactive visualiser. */
export function RadioFallback({ live, animate, rows, palette }: {
  live: boolean; animate: boolean; rows: number; palette: PlayerPalette;
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!animate || rows < 7) return;
    const timer = setInterval(() => setPhase(p => (p + 1) % 4), 700);
    return () => clearInterval(timer);
  }, [animate, rows]);
  const dial = animate ? ["● · · ·", "· ● · ·", "· · ● ·", "· · · ●"][phase]! : "● · · ·";
  const drawing = live ? [
    "           ╱       ", "  ╭───────╱─────╮  ", "  │  R A D I O  │  ",
    `  │  ${dial}    │  `, "  │  ░░░░   ◉   │  ", "  ╰─────────────╯  ",
  ] : ["     ╭───────╮     ", "   ╭─╯  ···  ╰─╮   ", "   │  · ╭─╮ ·  │   ",
    `   │  ${animate && phase % 2 ? "·" : " "} │●│    │   `, "   ╰─╮  ╰─╯  ╭─╯   ", "     ╰───────╯     "];
  return <Box flexDirection="column" alignItems="center" justifyContent="center" height={rows}>
    {rows >= 7 ? drawing.map((line, i) => <Text key={i} color={palette.alt}>{line}</Text>) : null}
    <Text color={palette.accent}>{live ? "RADIO" : "JUKEBOX"}{animate ? " · decorative" : ""}</Text>
    {rows >= 8 || (rows >= 3 && rows < 7) ? <Text color={palette.muted}>{animate ? "Decorative animation" : live ? "Station display" : "Cover unavailable"}</Text> : null}
  </Box>;
}
