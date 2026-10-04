import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useStore } from "../store";
import { ACTIONS, bindingError, keyToken, type Bindings } from "../shortcuts";
import { COLOR } from "../theme";

export function ShortcutEditor({ focused, onBack }: { focused: boolean; onBack: () => void }) {
  const { config, setConfig, listRows } = useStore();
  const [draft, setDraft] = useState<Bindings>({ ...config.keybindings });
  const [cursor, setCursor] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const height = Math.max(3, listRows - 5);
  useInput((input, key) => {
    if (key.escape) { if (recording) setRecording(false); else onBack(); return; }
    if (recording) {
      const a = ACTIONS[cursor]!;
      const next = { ...draft, [a.id]: keyToken(input, key) };
      const problem = bindingError(next);
      if (problem) { setError(problem); return; }
      if (next[a.id] === a.key) delete next[a.id];
      setDraft(next); setRecording(false); setError(""); return;
    }
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    else if (key.downArrow) setCursor(c => Math.min(ACTIONS.length + 1, c + 1));
    else if (key.pageDown) setCursor(c => Math.min(ACTIONS.length + 1, c + height));
    else if (key.pageUp) setCursor(c => Math.max(0, c - height));
    else if (key.return) {
      if (cursor === ACTIONS.length) { setDraft({}); setError(""); }
      else if (cursor === ACTIONS.length + 1) { setConfig({ ...config, keybindings: draft }); onBack(); }
      else { setRecording(true); setError(""); }
    }
  }, { isActive: focused });
  const rows = [...ACTIONS.map(a => `${a.label}: ${draft[a.id] ?? a.key}`), "Reset all shortcuts", "Save and return"];
  const start = Math.max(0, cursor - height + 1);
  return <Box flexDirection="column">
    <Text bold>Custom shortcuts · {cursor + 1}/{rows.length}</Text>
    {rows.slice(start, start + height).map((row, i) => <Text key={start + i} color={start + i === cursor ? COLOR.accent : COLOR.text} wrap="truncate-end">{start + i === cursor ? "› " : "  "}{row}</Text>)}
    <Text color={COLOR.warn} wrap="wrap">{error || (recording ? "Press the new key (for example Ctrl+N). Esc cancels recording." : "Enter edits · arrows scroll · Esc discards · Ctrl+C quits")}</Text>
    <Text color={COLOR.muted}>Navigation, text-entry and destructive confirmations stay fixed.</Text>
  </Box>;
}
