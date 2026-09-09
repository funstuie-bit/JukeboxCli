import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { usePlayback, useStore } from "../store";
import { playerPalette, RULE } from "../theme";
import { loadLyrics, lyricIndex, type LyricsResult } from "../../player/lyrics";
import { isLive } from "../../player/media";

export function LyricsPanel({ width, height, active }: { width: number; height: number; active: boolean }) {
  const store = useStore(); const state = usePlayback(store.playback);
  const palette = playerPalette(store.config.playerTheme);
  const [result, setResult] = useState<LyricsResult>({ message: "Loading lyrics…" });
  const [manual, setManual] = useState<number | null>(null);
  const track = state.track;
  const live = isLive(track);
  const online = store.config.lyricsOnline === true;
  // Excludes position/volume/art updates so normal playback never repeats a lookup.
  const requestKey = JSON.stringify([track?.id, track?.filePath, track?.title, track?.artist, track?.album, track?.durationSec, live, live ? state.broadcastTitle : ""]);
  useEffect(() => {
    if (!active) return;
    setManual(null); setResult({ message: track ? "Loading lyrics…" : "Play a song to see lyrics." });
    if (!track) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadLyrics(track, { signal: controller.signal, online, broadcast: state.broadcastTitle }).then(value => {
        if (!controller.signal.aborted) setResult(value);
      }).catch(() => { if (!controller.signal.aborted) setResult({ message: "Lyrics unavailable." }); });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey, active, online]);
  const lyrics = result.lyrics;
  const synced = !!lyrics?.lines.length && !live && state.engine === "mpv";
  const current = synced ? lyricIndex(lyrics.lines, state.position) : -1;
  const lines = synced ? lyrics.lines.map(line => line.text) : lyrics?.plain ?? [];
  const dense = height < 9;
  const rows = Math.max(0, height - (dense ? height >= 5 ? 4 : 3 : 6));
  const maxStart = Math.max(0, lines.length - rows);
  const start = Math.min(maxStart, Math.max(0, manual ?? (synced ? current - Math.floor(rows / 2) : 0)));
  useInput((input, key) => {
    if (input === "L") store.setConfig({ ...store.config, lyricsOnline: !online });
    if (input === "f") setManual(null);
    if (key.upArrow) setManual(Math.max(0, start - 1));
    if (key.downArrow) setManual(Math.min(maxStart, start + 1));
    if (key.pageUp) setManual(Math.max(0, start - rows));
    if (key.pageDown) setManual(Math.min(maxStart, start + rows));
  }, { isActive: active });
  return <Box width={width} height={height} borderStyle="round" borderColor={RULE} paddingX={1} flexDirection="column">
    <Text color={palette.alt} bold wrap="truncate-end">LYRICS · {lyrics?.source ?? "local / cached / LRCLIB"}</Text>
    {!dense ? <Text color={palette.muted} wrap="truncate-end">{lyrics && result.message ? result.message : synced ? manual === null ? "Synced lines · following playback" : "Synced lines · browsing" : live ? "Radio · plain lyrics (song position unknown)" : "Plain lyrics · no timed highlighting"}</Text> : null}
    {rows === 0 ? null : lyrics?.instrumental ? <Text color={palette.accent}>Instrumental · no lyrics</Text> : lines.length ?
      lines.slice(start, start + rows).map((line, i) => <Text key={`${start}:${i}`} wrap="truncate-end" bold={synced && start + i === current}
        color={synced && start + i === current ? palette.accent : palette.text}>
        {synced && start + i === current ? "› " : "  "}{line || "♪"}
      </Text>) : <Box height={rows} overflow="hidden"><Text color={palette.muted}>{result.message}</Text></Box>}
    <Box flexGrow={1} />
    {!dense ? <Text color={palette.muted} wrap="truncate-end">↑↓/Pg scroll · f follow · l queue</Text> : null}
    {height >= 5 ? <Text color={palette.alt} wrap="truncate-end">L Online lookup {online ? "on" : "off"} · LRCLIB</Text> : null}
  </Box>;
}
