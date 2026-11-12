import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ACTIONS, shortcutLabel } from "../shortcuts";
import { NAV } from "../navigation";
import { useStore, usePlayback, type Section } from "../store";
import { usePalette } from "../palette";
import { TextField } from "./TextField";
import { MouseRow } from "./MouseRow";
export interface PaletteAction { id: string; label: string; key?: string; disabled?: boolean; run: () => void | Promise<unknown> }
export function filterCommands(actions: PaletteAction[], query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return actions.filter(a => terms.every(t => `${a.label} ${a.key ?? ""}`.toLowerCase().includes(t)));
}
export function CommandPalette({ close, navigate, mini, sidebar, playerAction, reportError }: {
  close: () => void; navigate: (s: Section) => void; mini: () => void; sidebar: () => void; playerAction: (id: string) => void; reportError?: (message: string) => void;
}) {
  const s = useStore(), C = usePalette(), st = usePlayback(s.playback);
  const [query, setQuery] = useState(""), [selected, setSelected] = useState(0);
  const global: Record<string, () => void | Promise<unknown>> = {
    pause: () => s.playback.togglePause(), next: () => s.playback.next(), previous: () => s.playback.prev(),
    volumeUp: () => s.playback.changeVolume(5), volumeDown: () => s.playback.changeVolume(-5),
    restart: () => s.playback.restart(), shuffle: () => s.playback.toggleShuffle(), repeat: () => s.playback.cycleRepeat(),
    home: () => navigate("home"), player: () => navigate("player"), help: () => playerAction("help"),
  };
  const controls: PaletteAction[] = ACTIONS.filter(a => a.id !== "quit" && (global[a.id] || a.scope === "player")).map(a => ({
    id: a.id, label: a.label, key: shortcutLabel(a.key, s.config.keybindings, a.scope),
    disabled: ["next", "previous", "restart", "video"].includes(a.id) && !st.track,
    run: () => global[a.id] ? global[a.id]!() : playerAction(a.id),
  }));
  const queue: Record<string,()=>void|Promise<unknown>> = {
    queueRemove:()=>s.playback.removeQueue(st.index),queueUp:()=>s.playback.moveQueue(st.index,-1),queueDown:()=>s.playback.moveQueue(st.index,1),
  };
  const actions = filterCommands([...controls,
    ...ACTIONS.filter(a=>a.scope==="queue").map(a=>({id:a.id,label:`${a.label} (playing entry)`,key:shortcutLabel(a.key,s.config.keybindings,"queue"),disabled:!st.track||st.index<0,run:queue[a.id]!})),
    ...NAV.map(n => ({ id: `section:${n.key}`, label: `Open ${n.label}`, key: n.shortcut, run: () => navigate(n.key) })),
    { id: "tools", label: "Listening tools: equaliser, sleep timer, power and audio format", key: "Ctrl+E", run: () => s.openListeningTools?.() },
    { id: "mini", label: "Toggle mini-player", key: "Z", run: mini },
    { id: "sidebar", label: "Show / hide sidebar", key: "Ctrl+B", run: sidebar },
    { id: "chapter-prev", label: "Previous chapter", disabled: !st.chapters?.length || st.seekable === false, run: () => s.playback.seekChapter(Math.max(0, (st.chapters ?? []).findLastIndex(c => c.time < st.position - 3))) },
    { id: "chapter-next", label: "Next chapter", disabled: !st.chapters?.some(c => c.time > st.position) || st.seekable === false, run: () => s.playback.seekChapter((st.chapters ?? []).findIndex(c => c.time > st.position)) },
    ...(st.chapters ?? []).map((c, i) => ({ id: `chapter:${i}`, label: `Chapter: ${c.title}`, run: () => s.playback.seekChapter(i) })),
  ], query);
  const cursor = Math.min(selected, Math.max(0, actions.length - 1));
  const run = (i: number) => { const a = actions[i]; if (!a || a.disabled) return; close(); void Promise.resolve().then(a.run).catch(() => reportError?.("Command failed; try the section directly.")); };
  useInput((_input, key) => {
    if (key.escape) close();
    else if (key.upArrow || key.downArrow) setSelected(i => Math.max(0, Math.min(actions.length - 1, i + (key.upArrow ? -1 : 1))));
  });
  const slots = Math.max(1, s.rows - 9), start = Math.max(0, cursor - slots + 1);
  return <Box flexDirection="column" width={Math.max(15, s.cols - 4)}>
    <Text color={C.accent} bold>Commands · type to find an action</Text>
    <TextField width={Math.max(10, s.cols - 6)} placeholder="Search commands, settings or chapters" onChange={v => { setQuery(v); setSelected(0); }} onSubmit={() => run(cursor)} />
    {actions.slice(start, start + slots).map((a, i) => <MouseRow key={a.id} active allowDuringMenu allowDuringText onClick={() => run(start + i)}><Text dimColor={a.disabled} color={cursor === start + i ? C.accent : C.text} wrap="truncate-end">{cursor === start + i ? "› " : "  "}{a.label}{a.key ? ` · ${a.key}` : ""}{a.disabled ? " (unavailable)" : ""}</Text></MouseRow>)}
    {!actions.length ? <Text color={C.muted}>No matching commands</Text> : null}
    <Text color={C.muted} wrap="truncate-end">↑↓ choose · Enter run · Esc cancel · text editing shortcuts stay local</Text>
  </Box>;
}
