import { useEffect, useRef, useState } from "react";
import { Box, Text, type DOMElement } from "ink";
import { useActionInput } from "../hooks/useActionInput";
import { MouseRow } from "./MouseRow";
import { imageRect } from "./Cover";
import { mouseEvents, type MousePress } from "../mouse";
import { useStore } from "../store";
import { COLOR } from "../theme";

export interface ContextAction { label: string; run: () => void; disabled?: boolean }
/** Opaque overlay; the caller keeps its background mounted but disables its controls. */
export function ContextMenu({ actions, width, height, active, close, anchor, title = "Now Playing actions" }: {
  actions: ContextAction[]; width: number; height: number; active: boolean; close: () => void; anchor?: { x: number; y: number }; title?: string;
}) {
  const { config } = useStore();
  const ref = useRef<DOMElement>(null);
  const [selected, setSelected] = useState(0);
  const menuWidth = Math.min(width, 40);
  const menuHeight = Math.min(height, actions.length + 4);
  const showTitle = menuHeight >= 4, showFooter = menuHeight >= 5;
  const rows = Math.max(1, menuHeight - 2 - Number(showTitle) - Number(showFooter));
  const left = Math.max(0, Math.min(anchor?.x ?? Math.floor((width - menuWidth) / 2), width - menuWidth));
  const top = Math.max(0, Math.min(anchor?.y ?? 2, height - menuHeight));
  useEffect(() => {
    if (!active || config.mouseMode !== "click") return;
    const dismiss = ({ x, y }: MousePress) => {
      const rect = imageRect(ref.current);
      if (rect && (x < rect.x || x >= rect.x + rect.cols || y < rect.y || y >= rect.y + rect.rows)) close();
    };
    mouseEvents.on("press", dismiss);
    return () => { mouseEvents.off("press", dismiss); };
  }, [active, config.mouseMode, close]);
  const start = Math.max(0, selected - rows + 1);
  const choose = (index: number) => { if (!actions[index]?.disabled) actions[index]?.run(); };
  useActionInput((input, key) => {
    if (key.escape || input === "q" || input === "c") close();
    else if (key.upArrow) setSelected(i => Math.max(0, i - 1));
    else if (key.downArrow) setSelected(i => Math.min(actions.length - 1, i + 1));
    else if (key.return) choose(selected);
  }, { isActive: active });
  return <Box ref={ref} position="absolute" left={left} top={top} flexDirection="column" borderStyle="round" borderColor={COLOR.accent} backgroundColor="#171b2b" width={menuWidth} height={menuHeight}>
      {showTitle ? <Text bold color={COLOR.text} wrap="truncate-end">{title}</Text> : null}
      {actions.slice(start, start + rows).map((action, offset) => {
        const index = start + offset;
        return <MouseRow key={action.label} active={active && !action.disabled} width={menuWidth - 2} onClick={() => choose(index)}>
          <Text dimColor={action.disabled} color={index === selected ? COLOR.accent : COLOR.text} wrap="truncate-end">{index === selected ? "› " : "  "}{action.label}{action.disabled ? " (unavailable)" : ""}</Text>
        </MouseRow>;
      })}
      {showFooter ? <Text color={COLOR.muted} wrap="truncate-end">↑↓ choose · Enter / click · Esc close</Text> : null}
  </Box>;
}
