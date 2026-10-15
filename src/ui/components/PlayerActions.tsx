import { useState } from "react";
import { Box, Text } from "ink";
import { useActionInput } from "../hooks/useActionInput";
import { MouseRow } from "./MouseRow";
import { COLOR } from "../theme";

export interface PlayerAction { label: string; run: () => void; disabled?: boolean }
/** Replaces the player while open, so hidden queue controls cannot also react. */
export function PlayerActions({ actions, width, height, active, close }: {
  actions: PlayerAction[]; width: number; height: number; active: boolean; close: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const rows = Math.max(1, height - 5);
  const start = Math.max(0, selected - rows + 1);
  const choose = (index: number) => { if (!actions[index]?.disabled) actions[index]?.run(); };
  useActionInput((input, key) => {
    if (key.escape || input === "q" || input === "c") close();
    else if (key.upArrow) setSelected(i => Math.max(0, i - 1));
    else if (key.downArrow) setSelected(i => Math.min(actions.length - 1, i + 1));
    else if (key.return) choose(selected);
  }, { isActive: active });
  return <Box flexDirection="column" width={width} height={height}>
    <Box flexDirection="column" borderStyle="round" borderColor={COLOR.accent} width={Math.min(width, 64)}>
      <Text bold wrap="truncate-end">Now Playing actions</Text>
      {actions.slice(start, start + rows).map((action, offset) => {
        const index = start + offset;
        return <MouseRow key={action.label} active={active && !action.disabled} width={Math.min(width, 64) - 2} onClick={() => choose(index)}>
          <Text dimColor={action.disabled} color={index === selected ? COLOR.accent : undefined} wrap="truncate-end">{index === selected ? "› " : "  "}{action.label}{action.disabled ? " (unavailable)" : ""}</Text>
        </MouseRow>;
      })}
      <Text dimColor wrap="truncate-end">↑↓ choose · Enter / click · Esc close</Text>
    </Box>
  </Box>;
}
