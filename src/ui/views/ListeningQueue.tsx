import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useStore, usePlayback } from "../store";
import { cleanText, formatDuration, trackDisplayTitle } from "../../util/format";
import stringWidth from "string-width";
import { COLOR, RULE } from "../theme";
import { isStream } from "../../player/media";

export function ListeningQueue({ height, width, active, framed = false }: {
  height?: number; width?: number; active?: boolean; framed?: boolean;
}) {
  const store = useStore();
  const state = usePlayback(store.playback);
  const entries = store.playback.queueEntries();
  const [cursor, setCursor] = useState(() => Math.max(0, entries.findIndex(e => e.index === state.index)));
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const cols = (width ?? store.contentWidth) - (framed ? 4 : 0);
  const dense = (height ?? store.listRows) < 10;
  const columns = cols >= 48 && !dense;
  const rows = Math.max(1, (height ?? store.listRows) - (framed ? dense ? 3 : 5 : dense ? 1 : 3) - (columns ? 1 : 0));
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
  return <Box flexDirection="column" width={width ?? store.contentWidth} height={height} borderStyle={framed ? "round" : undefined} borderColor={RULE} paddingX={framed ? 1 : 0}>
    <Text bold color={COLOR.alt}>Queue · {entries.length} tracks · {state.shuffle ? "shuffled" : "in order"}</Text>
    {!dense || confirmClear || error || !entries.length ? <Text color={COLOR.muted} wrap="truncate-end">{confirmClear ? "Clear queue and stop? y clear · esc cancel (files stay)" : error || (entries.length ? "↑↓ select  enter play  u/D move  x remove  X clear" : "Empty · select a song in Library, then A append or P play next")}</Text> : null}
    {columns ? <Text color={COLOR.muted}>{queueRow("ARTIST", "TITLE", "TIME", cols)}</Text> : null}
    {entries.slice(start, start + rows).map((row, offset) => {
      const here = start + offset === selected;
      const artist = row.track.artist ? cleanText(row.track.artist) : "—";
      const title = `${isStream(row.track) ? "[stream] " : ""}${cleanText(trackDisplayTitle(row.track))}`;
      const marker = row.index === state.index ? "▶ " : here && focused ? "› " : "  ";
      return <Text key={row.index} color={here && focused ? COLOR.selectedText : row.index === state.index ? COLOR.accent : COLOR.text} backgroundColor={here && focused ? COLOR.selection : undefined} wrap="truncate-end">
        {columns ? queueRow(artist, title, formatDuration(row.track.durationSec), cols, marker) : fitRow(marker + title + " · " + artist, cols)}
      </Text>;
    })}
    {!dense ? <><Box flexGrow={1} />
    <Text color={COLOR.muted} wrap="truncate-end">{entries.length ? `${selected + 1}/${entries.length} · ${state.shuffle ? "Shuffle on" : "In order"} · repeat ${state.repeat}` : "7 Queue · 8 Discover"}</Text></> : null}
  </Box>;
}

/** Pad/truncate by terminal cells, so emoji and CJK cannot displace duration. */
export function fitRow(text: string, width: number): string {
  const limit = Math.max(0, width);
  let out = "";
  for (const ch of text) { if (stringWidth(out + ch) > limit) break; out += ch; }
  return out + " ".repeat(Math.max(0, limit - stringWidth(out)));
}
export function queueRow(artist: string, title: string, time: string, width: number, marker = "  "): string {
  const artistW = Math.min(24, Math.floor(width * 0.3));
  const timeW = 8;
  return marker + fitRow(artist, artistW) + " " + fitRow(title, width - artistW - timeW - 4) + " " + fitRow(time.padStart(timeW), timeW);
}
