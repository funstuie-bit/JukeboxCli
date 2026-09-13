import { Box, Text } from "ink";
import { playerPalette, RULE } from "../theme";
import type { Hint } from "../keymap";
import { useStore, usePlayback } from "../store";
import { isLive } from "../../player/media";

/**
 * The quiet hint line. Keys take the secondary accent (the same "this is a
 * key you can press" brass as the help overlay and inline command rows) and
 * labels are dimmed. Deliberately short, the `?` overlay carries the rest.
 */
export function Footer({ hints }: { hints: Hint[] }) {
  const { playback, config } = useStore();
  const COLOR = playerPalette(config.playerTheme);
  const live = isLive(usePlayback(playback).track);
  const visible = live ? hints.filter(h => h.label !== "Seek").map(h => h.label === "Pause" ? { ...h, label: "Reconnect/pause" } : h) : hints;
  return (
    <Box>
      <HintLine hints={visible} />
    </Box>
  );
}

export function SplitFooter({ left, right, leftHints, rightHints }: {
  left: number; right: number; leftHints: Hint[]; rightHints: Hint[];
}) {
  const { playback } = useStore();
  const live = isLive(usePlayback(playback).track);
  const visible = (hints: Hint[]) => live
    ? hints.filter(h => h.label !== "Seek").map(h => h.label === "Pause" ? { ...h, label: "Reconnect/pause" } : h)
    : hints;
  return <Box width={left + right + 1}>
    <Box width={left} flexShrink={0}><HintLine hints={visible(leftHints)} /></Box>
    <Text color={RULE}>│</Text>
    <Box width={right} paddingLeft={1}><HintLine hints={visible(rightHints)} /></Box>
  </Box>;
}

function HintLine({ hints }: { hints: Hint[] }) {
  const { config } = useStore();
  const COLOR = playerPalette(config.playerTheme);
  return <Text wrap="truncate-end">{hints.map((h, i) => <Text key={h.keys + h.label}>
    {i > 0 ? <Text color={COLOR.muted}>{"   "}</Text> : null}
    <Text color={COLOR.alt}>{h.keys}</Text>
    <Text color={COLOR.muted}>{` ${h.label}`}</Text>
  </Text>)}</Text>;
}
