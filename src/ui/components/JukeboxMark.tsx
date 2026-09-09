import { Text } from "ink";
import { COLOR } from "../theme";

/** Original terminal-native mark: no font, image protocol or startup delay. */
export const JUKEBOX_MARK = [
  "      .----------.      ",
  "    .'  JUKEBOX    '.    ",
  "   /   .--------.   \\   ",
  ...[
    "   /  ♫    ♬  \\   ",
    "  |   ──────   |  ",
    "  '------------'  ",
    "   [ A B C D ]    ",
    "    ⠿⠿⠿⠿⠿⠿⠿⠿⠿",
    "    ⠿⠿⠿⠿⠿⠿⠿⠿⠿",
  ].map(interior => `  |${interior.padEnd(18)}|  `),
  "  '------------------'  ",
].join("\n");
export const ASCII_JUKEBOX = JUKEBOX_MARK.replace(/[♫♬]/g, "*").replace(/─/g, "-").replace(/⠿/g, ":");
export function JukeboxMark() {
  return <Text color={COLOR.alt}>{process.env.JUKEBOXCLI_LOGO === "ascii" ? ASCII_JUKEBOX : JUKEBOX_MARK}</Text>;
}
