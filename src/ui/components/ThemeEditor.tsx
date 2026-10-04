import { useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { useStore } from "../store";
import { appearancePalette, playerBackground, playerBorder, validAppearance, type Appearance } from "../appearance";
import { PLAYER_THEMES, playerThemeLabel } from "../theme";
import { TextField } from "./TextField";

/** Draft is isolated: leaving, Esc or unmount cannot persist preview changes. */
export function ThemeEditor({ focused, onBack }: { focused: boolean; onBack: () => void }) {
  const { config, setConfig, contentWidth, listRows } = useStore();
  const [draft, setDraft] = useState(() => ({ theme: config.playerTheme, ...validAppearance(config.appearance) }));
  const [row, setRow] = useState(0);
  const [editingAccent, setEditingAccent] = useState(false);
  const [error, setError] = useState("");
  const accents = [undefined, "#b8a5ed", "#65c7d0", "#ff9b62", "#8dcc85", "#ffffff"];
  const cycle = <T,>(options: T[], current: T, delta: number) => options[(options.indexOf(current) + delta + options.length) % options.length]!;
  const change = (delta: number) => {
    if (row === 0) setDraft(d => ({ ...d, theme: cycle([...PLAYER_THEMES], d.theme ?? "lavender", delta) }));
    if (row === 1) setDraft(d => ({ ...d, background: d.background === "solid" ? "transparent" : "solid" }));
    if (row === 2) setDraft(d => ({ ...d, border: cycle<Appearance["border"]>(["round", "single", "double", "none"], d.border ?? "round", delta) }));
    if (row === 3) setDraft(d => ({ ...d, highContrast: !d.highContrast }));
    if (row === 4) setDraft(d => ({ ...d, accent: cycle(accents, d.accent, delta) }));
    if (row === 5) setDraft({ theme: config.playerTheme, ...validAppearance({}) });
    if (row === 6) { const { theme, ...appearance } = draft; setConfig({ ...config, playerTheme: theme, appearance }); onBack(); }
  };
  useInput((input, key) => {
    if (editingAccent) { if (key.escape) { setEditingAccent(false); setError(""); } return; }
    if (key.escape) { onBack(); return; }
    if (input === "#" && row === 4) { setEditingAccent(true); return; }
    if (key.upArrow) setRow(r => Math.max(0, r - 1));
    else if (key.downArrow) setRow(r => Math.min(6, r + 1));
    else if (key.return || key.rightArrow || input === "+") change(1);
    else if (key.leftArrow || input === "-") change(-1);
  }, { isActive: focused });
  const p = appearancePalette(draft.theme, draft);
  const labels = [`Palette: ${playerThemeLabel(draft.theme)}`, `Background: ${draft.background}`, `Border: ${draft.border}`,
    `High contrast: ${draft.highContrast ? "on" : "off"}`, `Accent: ${draft.accent ?? "automatic / artwork"} · # custom hex`, "Reset appearance overrides", "Save and return"];
  const slots = Math.max(1, listRows - 2 - (editingAccent ? 1 : 0) - (error ? 1 : 0));
  const start = Math.max(0, row - slots + 1);
  return <Box flexDirection="column" width={contentWidth}>
    <Text bold wrap="truncate-end">Theme editor · preview only until saved</Text>
    {labels.slice(start, start + slots).map((label, i) => <Text key={start + i} wrap="truncate-end" color={start + i === row ? p.accent : p.text}>{start + i === row ? "› " : "  "}{label}</Text>)}
    {editingAccent && focused ? <TextField defaultValue={draft.accent ?? "#b8a5ed"} placeholder="#rrggbb" onSubmit={value => {
      if (!/^#[0-9a-f]{6}$/i.test(value)) { setError("Use a six-digit colour, such as #65c7d0."); return; }
      setDraft(d => ({ ...d, accent: value })); setEditingAccent(false); setError("");
    }} /> : null}
    {error ? <Text color="yellow" wrap="truncate-end">{error}</Text> : null}
    {listRows >= 15 + (editingAccent ? 1 : 0) + (error ? 1 : 0) ? <Box borderStyle={playerBorder(draft)} borderColor={p.muted} backgroundColor={playerBackground(draft)} paddingX={1} flexDirection="column">
      <Text color={p.accent} bold>Now Playing · preview</Text>
      <Text color={p.text}>Track title · Artist</Text>
      <Text color={p.muted}>Album · 1:24 / 4:10</Text>
      <Text color={p.selectedText} backgroundColor={p.selection}>› Selected queue row</Text>
    </Box> : null}
    <Text color={p.muted} wrap="truncate-end">↑↓ choose · Enter change/save · Esc discard</Text>
  </Box>;
}
