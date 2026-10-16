import { Text } from "ink";
import { useEffect, useState } from "react";
import { COLOR } from "../theme";

/** Original terminal-native mark: no font, image protocol or startup delay. */
const centre = (text: string, width: number) => {
  const padding = (width - text.length) / 2;
  return " ".repeat(padding) + text + " ".repeat(padding);
};
export const JUKEBOX_MARK = [
  centre(".-----------.", 25),
  centre(".'   JUKEBOX   '.", 25),
  centre(`/ ${centre(".---------.", 15)} \\`, 25),
  ...[
    "/  ♫     ♬  \\",
    "|   ───────   |",
    "'-------------'",
    "[ C L I ]",
    "⠿⠿⠿⠿⠿⠿⠿⠿⠿",
    "⠿⠿⠿⠿⠿⠿⠿⠿⠿",
  ].map(interior => `  |${centre(interior, 19)}|  `),
  "  '-------------------'  ",
].join("\n");
export const ASCII_JUKEBOX = JUKEBOX_MARK.replace(/[♫♬]/g, "*").replace(/─/g, "-").replace(/⠿/g, ":");
export function JukeboxMark({ animate = false, color = COLOR.alt }: { animate?: boolean; color?: string }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setPhase(p => (p + 1) % 4), 900);
    return () => clearInterval(timer);
  }, [animate]);
  const ascii = process.env.JUKEBOXCLI_LOGO === "ascii";
  let mark = ascii ? ASCII_JUKEBOX : JUKEBOX_MARK;
  // Decorative cabinet lights only, never presented as an audio spectrum.
  if (animate) mark = mark.replace(ascii ? ":".repeat(9) : "⠿".repeat(9),
    (ascii ? [":::::::::", "::..:..::", ":..:::..:", "...:::..."] : ["⠿⠿⠿⠿⠿⠿⠿⠿⠿", "⠿⠿⠶⠶⠿⠶⠶⠿⠿", "⠿⠶⠶⠿⠿⠿⠶⠶⠿", "⠶⠶⠶⠿⠿⠿⠶⠶⠶"])[phase]!);
  return <Text color={color}>{mark}</Text>;
}
