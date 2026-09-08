import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useStore, usePlayback } from "../store";
import { cleanText, truncate } from "../../util/format";
import { COLOR } from "../theme";

export function ListeningQueue({ height, width, active }: {
  height?: number; width?: number; active?: boolean;
}) {
  const store = useStore();
  const state = usePlayback(store.playback);
  const entries = store.playback.queueEntries();
  const [cursor, setCursor] = useState(() => Math.max(0, entries.findIndex(e => e.index === state.index)));
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const rows = Math.max(1, (height ?? store.listRows) - 2);
  const cols = width ?? store.contentWidth;
  const selected = Math.min(cursor, Math.max(0, entries.length - 1));
  const focused = active ?? store.region === "content";
  const run = (action: Promise<void>) => { void action.catch(e => setError(String(e))); };
  useInput((input, key) => {
    if (confirmClear) {
      if (input === "y") { setConfirmClear(false); run(store.playback.stop()); }
      else if (key.escape || input === "N") setConfirmClear(false);
      return;
    }
    if (input === "X") { setConfirmClear(true); return; }
    if (key.upArrow) setCursor(Math.max(0, selected - 1));
    else if (key.downArrow) setCursor(Math.min(entries.length - 1, selected + 1));
    else if (key.pageUp) setCursor(Math.max(0, selected - rows));
    else if (key.pageDown) setCursor(Math.min(entries.length - 1, selected + rows));
    else if (key.home) setCursor(0);
    else if (key.end) setCursor(entries.length - 1);
    else {
      const row = entries[selected]; if (!row) return;
      if (key.return) run(store.playback.playQueueIndex(row.index));
      else if (input === "x") run(store.playback.removeQueue(row.index));
      else if (input === "u" || input === "D") {
        const delta = input === "u" ? -1 : 1;
        store.playback.moveQueue(row.index, delta);
        setCursor(Math.max(0, Math.min(entries.length - 1, selected + delta)));
      }
    }
  }, { isActive: focused && entries.length > 0 });
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), entries.length - rows));
  return <Box flexDirection="column" width={cols}>
    <Text bold color={COLOR.alt}>Queue · {entries.length} tracks · {state.shuffle ? "shuffled" : "in order"}</Text>
    <Text dimColor wrap="truncate-end">{confirmClear ? "Clear queue and stop? y clear · esc cancel (files stay)" : error || (entries.length ? "↑↓ select  enter play  u/D move  x remove  X clear" : "Empty · select a song in Library, then A append or P play next")}</Text>
    {entries.slice(start, start + rows).map((row, offset) => {
      const here = start + offset === selected;
      return <Text key={row.index} color={here && focused ? COLOR.accent : undefined} wrap="truncate-end">
        {here && focused ? "› " : "  "}{row.index === state.index ? "▶ " : "  "}
        {truncate(cleanText(`${row.track.title}${row.track.artist ? ` · ${row.track.artist}` : ""}`), Math.max(1, cols - 4))}
      </Text>;
    })}
  </Box>;
}
