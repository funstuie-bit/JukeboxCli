import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { MusicResult } from "../../sources/music";
import { cleanText, formatDuration } from "../../util/format";
import { Cover } from "./Cover";
import { COLOR } from "../theme";

/** Settle before decoding artwork; metadata always follows the highlighted row. */
export function VideoPreview({ item, width, height, visible, overlay }: {
  item?: MusicResult; width: number; height: number; visible: boolean; overlay: boolean;
}) {
  const source = item?.track?.thumbnailUrl;
  const [settled, setSettled] = useState(source);
  useEffect(() => { const timer = setTimeout(() => setSettled(source), 180); return () => clearTimeout(timer); }, [source]);
  const inner = width - 2;
  const artRows = Math.max(2, Math.min(8, Math.floor(inner * 9 / 32), height - 8));
  return <Box flexDirection="column" width={width} height={height} paddingLeft={1} paddingRight={1} borderStyle="single" borderColor={COLOR.muted}>
    <Text bold color={COLOR.alt} wrap="truncate-end">Video preview</Text>
    <Cover source={settled === source ? settled : undefined} cols={inner - 2} rows={artRows}
      visible={visible} suppressGraphics={overlay} fallback={<Text color={COLOR.muted}>No thumbnail</Text>} />
    <Text bold color={COLOR.accent} wrap="truncate-end">{cleanText(item?.title ?? "Highlight a video")}</Text>
    <Text color={COLOR.text} wrap="truncate-end">{cleanText(item?.track?.artist ?? "Unknown channel")}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{item?.track?.isLive ? "LIVE · play only" : item?.track?.durationSec ? formatDuration(item.track.durationSec) : "Duration unavailable"}</Text>
    {height - artRows >= 9 ? <Text color={COLOR.muted} wrap="truncate-end">{cleanText(item?.subtitle ?? "")}</Text> : null}
    <Text color={COLOR.muted} wrap="truncate-end">Enter video · a audio · c actions</Text>
  </Box>;
}
