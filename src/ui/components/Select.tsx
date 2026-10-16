import { useState } from "react";
import { Box, Text } from "ink";
import type { SelectProps } from "@inkjs/ui";
import { MouseRow } from "./MouseRow";
import { useActionInput } from "../hooks/useActionInput";
import { COLOR, ICON } from "../theme";
/** Shared keyboard and pointer selection for settings and nested menus. */
export function Select({ options, onChange, isDisabled = false, visibleOptionCount = 5, defaultValue, highlightText }: SelectProps) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(defaultValue);
  const signature = JSON.stringify(options.map(option => option.value));
  const [previousOptions, setPreviousOptions] = useState(signature);
  if (signature !== previousOptions) { setPreviousOptions(signature); setCursor(0); setSelected(defaultValue); }
  const index = Math.min(cursor, Math.max(0, options.length - 1));
  const count = Math.max(1, visibleOptionCount);
  const start = Math.max(0, index - count + 1);
  const choose = (i: number) => { const item = options[i]; if (item) { setCursor(i); setSelected(item.value); onChange?.(item.value); } };
  useActionInput((_, key) => {
    if (key.upArrow) setCursor(Math.max(0, index - 1));
    else if (key.downArrow) setCursor(Math.min(options.length - 1, index + 1));
    else if (key.home) setCursor(0);
    else if (key.end) setCursor(options.length - 1);
    else if (key.return) choose(index);
  }, { isActive: !isDisabled });
  return <Box flexDirection="column">{options.slice(start, start + count).map((item, offset) => {
    const at = highlightText ? item.label.indexOf(highlightText) : -1;
    return <MouseRow key={item.value} active={!isDisabled} allowDuringText onClick={() => choose(start + offset)}>
      <Text color={!isDisabled && index === start + offset ? COLOR.accent : selected === item.value ? COLOR.good : undefined}>
        {!isDisabled && index === start + offset ? `${ICON.pointer} ` : "  "}{at < 0 ? item.label : <>{item.label.slice(0, at)}<Text bold>{highlightText}</Text>{item.label.slice(at + highlightText!.length)}</>}
      </Text>
    </MouseRow>;
  })}</Box>;
}
