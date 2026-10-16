import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { MusicResult } from "../../sources/music";
import { cleanText, formatDuration } from "../../util/format";
import { Cover } from "./Cover";
import { cellAspect } from "../../player/graphics";
import { COLOR } from "../theme";

/** Settle before decoding artwork; metadata always follows the highlighted row. */
export function VideoPreview({ item, width, height, visible, overlay }: {
  item?: MusicResult; width: number; height: number; visible: boolean; overlay: boolean;
}) {
  const source = item?.track?.thumbnailUrl;
  const [settled, setSettled] = useState(source);
  useEffect(() => { const timer = setTimeout(() => setSettled(source), 180); return () => clearTimeout(timer); }, [source]);
  const inner = width - 4;
  const showSubtitle = height >= 12 && !!item?.subtitle;
  const textRows = 8 + Number(showSubtitle);
  const artRows = Math.max(2, Math.min(Math.round(inner * 9 / 16 * cellAspect), height - textRows));
  return <Box flexDirection="column" width={width} height={artRows + textRows} flexShrink={0} paddingLeft={1} paddingRight={1} borderStyle="single" borderColor={COLOR.muted}>
    <Text bold color={COLOR.alt} wrap="truncate-end">Video preview</Text>
    <Cover source={settled === source ? settled : undefined} cols={inner} rows={artRows} fit="contain"
      visible={visible} suppressGraphics={overlay} fallback={<Text color={COLOR.muted}>No thumbnail</Text>} />
    <Box height={2} overflow="hidden"><Text bold color={COLOR.accent} wrap="wrap">{cleanText(item?.title ?? "Highlight a video")}</Text></Box>
    <Text color={COLOR.text} wrap="truncate-end">{cleanText(item?.track?.artist ?? "Unknown channel")}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{item?.track?.isLive ? "LIVE · play only" : item?.track?.durationSec ? formatDuration(item.track.durationSec) : "Duration unavailable"}</Text>
    {showSubtitle ? <Text color={COLOR.muted} wrap="truncate-end">{cleanText(item?.subtitle ?? "")}</Text> : null}
    <Text color={COLOR.muted} wrap="truncate-end">Enter video · a audio · c actions</Text>
  </Box>;
}
