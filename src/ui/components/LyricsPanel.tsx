import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import stringWidth from "string-width";
import { usePlayback, useStore } from "../store";
import { playerPalette, RULE } from "../theme";
import { loadLyrics, lyricIndex, lyricTitle, safeLyricMatch, lyricsSignature, type LyricsOptions, type LyricsResult } from "../../player/lyrics";
import { isLive } from "../../player/media";
import { TextField } from "./TextField";
import { wrapLyric } from "./lyric-layout";

export function LyricsPanel({ width, height, active }: { width: number; height: number; active: boolean }) {
  const store = useStore(), state = usePlayback(store.playback), palette = playerPalette(store.config.playerTheme);
  const [result, setResult] = useState<LyricsResult>({ message: "Loading lyrics…" });
  const [resolvedKey, setResolvedKey] = useState("");
  const [manual, setManual] = useState<number | null>(null);
  const [selection, setSelection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<{ key: string; provider: "LRCLIB" | "lyrics.ovh" } | null>(null);
  const [action, setAction] = useState<{ key: string; options: Partial<LyricsOptions> } | null>(null);
  const track = state.track, live = isLive(track), online = store.config.lyricsOnline === true;
  const requestKey = JSON.stringify([track?.id, track?.filePath, track?.title, track?.artist, track?.album, track?.durationSec, live, live ? state.broadcastTitle : ""]);
  const editing = edit?.key === requestKey ? edit : null;
  const candidates = resolvedKey === requestKey ? result.candidates : undefined;
  const searching = loading && action?.key === requestKey && (action.options.query !== undefined || !!action.options.alternate);
  const captures = !!editing || !!candidates?.length || searching;
  useEffect(() => {
    if (!active || !captures) return;
    store.setCaptureMode("text");
    return () => store.setCaptureMode("none");
  }, [active, captures, store.setCaptureMode]);
  useEffect(() => {
    if (!active || editing) return;
    setLoading(!!track);
    setManual(null); setSelection(0); setResult({ message: track ? "Loading lyrics…" : "Play a song to see lyrics." });
    if (!track) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadLyrics(track, { ...(action?.key === requestKey ? action.options : {}), signal: controller.signal, online, broadcast: state.broadcastTitle }).then(value => {
        if (!controller.signal.aborted) { setResolvedKey(requestKey); setResult(value); setLoading(false); }
      }).catch(() => { if (!controller.signal.aborted) { setResult({ message: "Lyrics unavailable." }); setLoading(false); } });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestKey, active, online, action, editing]);
  const lyrics = resolvedKey === requestKey ? result.lyrics : undefined;
  const synced = !!lyrics?.lines.length && !lyrics.plainOnly && !live && state.engine === "mpv";
  const current = synced ? lyricIndex(lyrics.lines, state.position) : -1;
  const currentWords = synced && current >= 0 ? lyrics.lines[current]?.words : undefined;
  const currentWord = currentWords ? lyricIndex(currentWords, state.position) : -1;
  const dense = height < 9, rows = Math.max(0, height - (dense ? height >= 5 ? 4 : 3 : 6));
  const inner = Math.max(2, width - 4);
  const allRows = (synced ? lyrics.lines : (lyrics?.plain ?? []).map(text => ({ at: 0, text })))
    .flatMap((line, i) => wrapLyric(line, i, inner - 2));
  const maxStart = Math.max(0, allRows.length - rows);
  const focusRows = allRows.filter(row => row.line >= Math.max(0, current - 2) && row.line <= Math.max(0, current) + 2);
  const focusAt = Math.max(0, focusRows.findIndex(row => row.line === current && (!currentWords || row.parts.some(p => p.word === currentWord))));
  const focusStart = Math.max(0, focusAt - Math.floor(rows / 2));
  const browseStart = Math.min(maxStart, Math.max(0, manual ?? 0));
  const visible = synced && manual === null ? focusRows.slice(focusStart, focusStart + rows) : allRows.slice(browseStart, browseStart + rows);
  const perform = (options: Partial<LyricsOptions>) => { setEdit(null); setAction({ key: requestKey, options }); };
  const openSearch = (provider: "LRCLIB" | "lyrics.ovh") => {
    if (!track) { setResult({ message: "Play a song before searching for lyrics." }); return; }
    if (!online) { setResult({ message: "Online lyrics disabled — Shift+L to enable before searching." }); return; }
    setEdit({ key: requestKey, provider });
  };
  useInput((input, key) => {
    if (editing) {
      if (key.escape) setEdit(null);
      return;
    }
    if (searching && key.escape) { setAction(null); return; }
    if (input === "L") { setAction(null); store.setConfig({ ...store.config, lyricsOnline: !online }); return; }
    if (input === "/") { openSearch("LRCLIB"); return; }
    if (input === "O") { openSearch("lyrics.ovh"); return; }
    if (input === "R") { perform({ retry: true }); return; }
    if (candidates?.length) {
      if (key.escape) { setResult({ message: "Selection cancelled. / search · R retry · l queue" }); return; }
      if (key.upArrow) setSelection(i => Math.max(0, i - 1));
      if (key.downArrow) setSelection(i => Math.min(candidates.length - 1, i + 1));
      if (key.pageUp) setSelection(i => Math.max(0, i - Math.max(1, rows)));
      if (key.pageDown) setSelection(i => Math.min(candidates.length - 1, i + Math.max(1, rows)));
      if (key.return && candidates[selection]) perform({ candidate: candidates[selection] });
      return;
    }
    if (input === "f") setManual(null);
    const currentStart = manual ?? Math.max(0, allRows.findIndex(row => row.line === Math.max(0, current)) - Math.floor(rows / 2));
    if (key.upArrow) setManual(Math.max(0, currentStart - 1));
    if (key.downArrow) setManual(Math.min(maxStart, currentStart + 1));
    if (key.pageUp) setManual(Math.max(0, currentStart - rows));
    if (key.pageDown) setManual(Math.min(maxStart, currentStart + rows));
  }, { isActive: active });
  const signature = track ? lyricsSignature(track, state.broadcastTitle) : null;
  const artist = signature?.artist ?? track?.artist ?? "", title = lyricTitle(signature?.title ?? track?.title ?? "");
  const defaultSearch = editing?.provider === "lyrics.ovh" ? artist + " - " + title : (title + " " + artist).trim();
  const status = editing ? "Enter sends your search to " + editing.provider + " · Esc cancels" : !lyrics ? candidates?.length ? result.message :
    online ? "Online lookup enabled · / search · O other provider" : "Online lyrics disabled — Shift+L to enable" :
    result.message || (lyrics.instrumental ? "Instrumental recording" : synced ? (currentWords ? "Word" : "Line") + "-synced · " + (manual === null ? "following playback" : "browsing") :
      live ? "Radio · plain lyrics (song position unknown)" : lyrics.plainOnly ? "Selected lyrics · plain (recording timing unverified)" : "Plain lyrics · no timed highlighting");
  const choicesStart = Math.max(0, selection - Math.max(0, rows - 1));
  return <Box width={width} height={height} borderStyle="round" borderColor={RULE} paddingX={1} flexDirection="column">
    <Text color={palette.alt} bold wrap="truncate-end">LYRICS · {editing?.provider ?? lyrics?.source ?? "local / cached / online"}{!editing && lyrics?.match ? " · " + lyrics.match : ""}</Text>
    {!dense ? <Text color={palette.muted} wrap="truncate-end">{status}</Text> : null}
    <Box height={rows} overflow="hidden" flexDirection="column" justifyContent={editing || candidates?.length ? "flex-start" : "center"}>
      {editing ? <>
        <Text color={palette.alt} wrap="truncate-end">{editing.provider === "lyrics.ovh" ? "lyrics.ovh · plain only · Artist - Song" : "Search LRCLIB · song / artist"}</Text>
        <Box width={inner} overflow="hidden"><TextField key={editing.key + ":" + editing.provider} defaultValue={defaultSearch} width={inner - 1} isDisabled={!active}
          onSubmit={value => {
            if (editing.provider === "LRCLIB") perform({ query: value.slice(0, 200) });
            else {
              const parts = value.split(/\s+[-–—]\s+/);
              if (parts.length !== 2 || !parts.every(s => s.trim())) { setResult({ message: "Use Artist - Song (one spaced separator)." }); return; }
              perform({ alternate: { artist: parts[0]!, title: parts[1]! } });
            }
          }} /></Box>
        <Text color={palette.muted} wrap="truncate-end">{result.message.startsWith("Use Artist") ? result.message : "Enter search · Esc cancel"}</Text>
      </> : candidates?.length ? candidates.slice(choicesStart, choicesStart + rows).map((c, i) =>
        <Text key={c.id} wrap="truncate-end" color={choicesStart + i === selection ? palette.accent : palette.muted} bold={choicesStart + i === selection}>
          {choicesStart + i === selection ? "› " : "  "}{c.artist} — {c.title} · {Math.floor(c.duration / 60)}:{String(Math.round(c.duration % 60)).padStart(2, "0")} · {c.album} · {c.instrumental ? "instrumental" : c.syncedLyrics && signature && safeLyricMatch(signature, c) ? "timed" : "plain"}
        </Text>) : lyrics?.instrumental ? <Text color={palette.accent}>Instrumental · no lyrics</Text> : visible.length ? visible.map((row, i) => {
        const highlighted = synced && row.line === current;
        const content = row.parts.map(p => p.text).join("");
        const pad = " ".repeat(Math.max(0, Math.floor((inner - 2 - stringWidth(content)) / 2)));
        return <Text key={row.line + ":" + i} wrap="truncate-end" color={highlighted ? palette.accent : palette.muted} dimColor={!highlighted} bold={highlighted}>
          {pad}{highlighted ? "› " : "  "}{row.parts.map((p, j) => <Text key={j} underline={highlighted && p.word !== undefined && p.word === currentWord}>{p.text}</Text>)}
        </Text>;
      }) : <Text color={palette.muted}>{result.message}</Text>}
    </Box>
    {!dense ? <Text color={palette.muted} wrap="truncate-end">{captures ? "↑↓ choose · Enter select · Esc cancel" : "↑↓/Pg scroll · f follow · / search · R retry · l queue"}</Text> : null}
    {height >= 5 ? <Text color={palette.alt} wrap="truncate-end">Shift+L Online {online ? "on" : "off"} · O lyrics.ovh (plain)</Text> : null}
  </Box>;
}
