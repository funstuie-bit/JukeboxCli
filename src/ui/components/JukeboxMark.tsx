import { Text } from "ink";
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
export function JukeboxMark() {
  return <Text color={COLOR.alt}>{process.env.JUKEBOXCLI_LOGO === "ascii" ? ASCII_JUKEBOX : JUKEBOX_MARK}</Text>;
}
