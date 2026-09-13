import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useStore, usePlayback } from "../store";
import { cleanText, formatDuration, trackDisplayTitle } from "../../util/format";
import stringWidth from "string-width";
import { playerPalette, RULE } from "../theme";
import { isLive, isStream } from "../../player/media";

export function ListeningQueue({ height, width, active, framed = false, controlsOutside = false }: {
  height?: number; width?: number; active?: boolean; framed?: boolean; controlsOutside?: boolean;
}) {
  const store = useStore();
  const COLOR = playerPalette(store.config.playerTheme);
  const state = usePlayback(store.playback);
  const entries = store.playback.queueEntries();
  const [cursor, setCursor] = useState(() => Math.max(0, entries.findIndex(e => e.index === state.index)));
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const cols = (width ?? store.contentWidth) - (framed ? 4 : 0);
  // Very wide tables push duration to the far edge without adding useful
  // information. Keep the panel roomy, but make its rows quick to scan.
  const contentCols = queueContentWidth(cols);
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
    <Text bold color={COLOR.alt} wrap="truncate-end">Playback queue · {entries.length} tracks · {state.shuffle ? "shuffled" : "in order"}</Text>
    {confirmClear || error || !entries.length || (!controlsOutside && !dense) ? <Text color={COLOR.muted} wrap="truncate-end">{confirmClear ? "Clear queue and stop? y clear · esc cancel (files stay)" : error || (entries.length ? "↑↓ select  enter play  u/D move  x remove  X clear" : "Empty · select a song in Library, then A append or P play next")}</Text> : null}
    {columns ? <Text color={COLOR.muted}>{queueRow("ARTIST", "TITLE", "TIME", contentCols, "  ", "TYPE")}</Text> : null}
    {entries.slice(start, start + rows).map((row, offset) => {
      const here = start + offset === selected;
      const artist = row.track.artist ? cleanText(row.track.artist) : "—";
      const source = isLive(row.track) ? "LIVE" : isStream(row.track) ? "NET" : "FILE";
      const title = cleanText(trackDisplayTitle(row.track)).replace(/^Radio · /, "");
      const marker = `${here && focused ? "›" : " "}${row.index === state.index ? state.paused ? "Ⅱ" : "▶" : " "}`;
      // The engine knows the current recording's duration better than saved tags.
      // Keep the other rows' metadata and the library itself unchanged.
      const duration = row.index === state.index && state.duration > 0 ? state.duration : row.track.durationSec;
      return <Text key={row.index} color={here && focused ? COLOR.selectedText : row.index === state.index ? COLOR.accent : COLOR.text} backgroundColor={here && focused ? COLOR.selection : undefined} wrap="truncate-end">
        {columns ? queueRow(artist, title, isLive(row.track) ? "LIVE" : formatDuration(duration), contentCols, marker, source) : fitRow(marker + source.padEnd(4) + " " + title + " · " + artist, cols)}
      </Text>;
    })}
    {!dense ? <><Box flexGrow={1} />
    {!controlsOutside ? <Text color={COLOR.muted} wrap="truncate-end">{entries.length ? `› selected · ▶ playing / Ⅱ paused · 9 saved stations` : "7 Queue · 8 Discover"}</Text> : null}</> : null}
  </Box>;
}

/** Pad/truncate by terminal cells, so emoji and CJK cannot displace duration. */
export function queueContentWidth(width: number): number { return Math.min(width, 104); }
export function fitRow(text: string, width: number): string {
  const limit = Math.max(0, width);
  let out = "";
  for (const ch of text) { if (stringWidth(out + ch) > limit) break; out += ch; }
  return out + " ".repeat(Math.max(0, limit - stringWidth(out)));
}
export function queueRow(artist: string, title: string, time: string, width: number, marker = "  ", source = ""): string {
  const sourceW = source ? 5 : 0;
  const artistW = Math.min(24, Math.floor(width * (source ? 0.26 : 0.3)));
  const timeW = 8;
  return marker + (source ? fitRow(source, 4) + " " : "") + fitRow(artist, artistW) + " " + fitRow(title, width - artistW - timeW - 4 - sourceW) + " " + fitRow(time.padStart(timeW), timeW);
}
