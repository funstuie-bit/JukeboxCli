import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { HELP_GROUPS } from "../keymap";
import { useStore } from "../store";
import { COLOR, RULE } from "../theme";

/** Bounded, keyboard-paged help: adding a feature must not push its keys offscreen. */
export function HelpOverlay() {
  const { cols, rows, compact, section } = useStore();
  const [page, setPage] = useState(section === "listen" ? 4 : section === "discover" ? 3 : section === "player" ? 1 : section === "queue" ? 2 : 0);
  const [offset, setOffset] = useState(0);
  const width = Math.max(20, Math.min(cols - 2, 78));
  const height = Math.max(8, rows - 4);
  const visibleRows = height - 6;
  const group = HELP_GROUPS[page]!;
  const start = Math.min(offset, Math.max(0, group.hints.length - visibleRows));
  useInput((input, key) => {
    if (input === "[" || input === "]" || key.leftArrow || key.rightArrow || key.pageUp || key.pageDown) {
      const back = input === "[" || key.leftArrow || key.pageUp;
      setPage(p => (p + (back ? HELP_GROUPS.length - 1 : 1)) % HELP_GROUPS.length); setOffset(0);
    } else if (key.upArrow) setOffset(Math.max(0, start - 1));
    else if (key.downArrow) setOffset(Math.min(Math.max(0, group.hints.length - visibleRows), start + 1));
  });
  return <Box width={width} height={height} borderStyle="round" borderColor={RULE} paddingX={1} flexDirection="column">
    <Text bold color={COLOR.accent} wrap="truncate-end">Keyboard · {page + 1}/{HELP_GROUPS.length}{compact ? " · ? esc to close" : ""}</Text>
    <Text bold wrap="truncate-end">{group.title}</Text>
    {group.hints.slice(start, start + visibleRows).map(h => <Box key={h.keys + h.label}>
      <Box width={12} flexShrink={0}><Text color={COLOR.alt}>{h.keys}</Text></Box>
      <Text dimColor wrap="truncate-end">{h.label}</Text>
    </Box>)}
    <Box flexGrow={1} />
    <Text color={COLOR.muted} wrap="truncate-end">[ ] group · ↑↓ scroll{group.hints.length > visibleRows ? ` · ${start + 1}–${Math.min(group.hints.length, start + visibleRows)}/${group.hints.length}` : ""}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">Press ? or esc to close</Text>
  </Box>;
}
