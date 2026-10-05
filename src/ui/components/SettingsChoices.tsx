import { Box, Text } from "ink";
import { useActionInput } from "../hooks/useActionInput";
import { COLOR, ICON } from "../theme";

/** Live preference labels change after Enter. Keep focus by stable option ID,
 * not the option array/label, and use the available height instead of five rows. */
export function SettingsChoices({ title, options, focused, height, value, onFocus, onSelect }: {
  title: string;
  options: { label: string; value: string }[];
  focused: boolean;
  height: number;
  value?: string;
  onFocus: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const count = Math.max(1, Math.floor(height) - 2);
  const start = Math.max(0, Math.min(selected - Math.floor(count / 2), options.length - count));
  useActionInput((_input, key) => {
    if (!options.length) return;
    let next = selected;
    if (key.upArrow) next--;
    else if (key.downArrow) next++;
    else if (key.pageUp) next -= count;
    else if (key.pageDown) next += count;
    else if (key.home) next = 0;
    else if (key.end) next = options.length - 1;
    else if (key.return) { onSelect(options[selected]!.value); return; }
    else return;
    onFocus(options[Math.max(0, Math.min(options.length - 1, next))]!.value);
  }, { isActive: focused });
  return <Box flexDirection="column">
    <Text bold color={COLOR.text} wrap="truncate-end">{title}</Text>
    {options.slice(start, start + count).map((option, offset) => <Text key={option.value}
      color={focused && start + offset === selected ? COLOR.accent : COLOR.text} wrap="truncate-end">
      {focused && start + offset === selected ? `${ICON.pointer} ` : "  "}{option.label}
    </Text>)}
    <Text color={COLOR.muted} wrap="truncate-end">↑↓ choose · Enter change/open · {options.length ? selected + 1 : 0}/{options.length}{options.length > count ? ` · showing ${start + 1}–${Math.min(options.length, start + count)} · Pg↑/↓ scroll` : " · all options shown"}</Text>
  </Box>;
}
