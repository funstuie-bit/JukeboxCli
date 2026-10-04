import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { Cover } from "./Cover";
import { cleanText } from "../../util/format";
import { COLOR } from "../theme";

/** A short settle delay avoids probing every file while scrolling quickly. */
export function BrowsePreview({ source, title, subtitle, rows, visible = true }: {
  source?: string; title?: string; subtitle?: string; rows: number; visible?: boolean;
}) {
  const [settled, setSettled] = useState(source);
  useEffect(() => { const timer = setTimeout(() => setSettled(source), 180); return () => clearTimeout(timer); }, [source]);
  return <Box flexDirection="column" width={32}>
    <Cover source={settled} cols={30} rows={Math.max(2, Math.min(14, rows - 3))} visible={visible}
      fallback={<Text color={COLOR.muted}>No artwork</Text>} />
    <Text bold color={COLOR.accent} wrap="truncate-end">{cleanText(title ?? "Choose a track")}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{cleanText(subtitle ?? "Preview only · Enter plays")}</Text>
  </Box>;
}
