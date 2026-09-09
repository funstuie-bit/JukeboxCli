import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { searchMusic, type MusicPage } from "../../sources/music";
import type { PlayableTrack } from "../../player/media";
import { isStream } from "../../player/media";
import { cleanText, formatDuration } from "../../util/format";
import { useStore } from "../store";
import { playerPalette, RULE } from "../theme";
import { TextField } from "./TextField";

export function playerQuery(value: string) {
  const match = value.trim().match(/^\/?([lsv]):\s*(.*)$/i);
  return { mode: match?.[1]?.toLowerCase() ?? "l", query: (match?.[2] ?? value).trim().slice(0, 200) };
}

/** Owns keyboard while open; browsing never touches playback or download state. */
export function PlayerSearch({ width, height, active, onClose, onDownload }: {
  width: number; height: number; active: boolean; onClose: () => void; onDownload: () => void;
}) {
  const store = useStore(), palette = playerPalette(store.config.playerTheme);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(true);
  const [tracks, setTracks] = useState<PlayableTrack[]>([]);
  const [more, setMore] = useState<MusicPage["more"]>();
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("l: local · s: online songs · v: videos");
  const [source, setSource] = useState("Local");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; request.current++; controller.current?.abort(); }, []);
  useEffect(() => {
    if (!active) { request.current++; setBusy(false); return; }
    store.setCaptureMode("text");
    return () => { request.current++; controller.current?.abort(); store.setCaptureMode("none"); };
  }, [active, store.setCaptureMode]);
  const load = async (task: (signal: AbortSignal) => Promise<MusicPage>, append = false) => {
    const token = ++request.current;
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setBusy(true); setNotice("Searching online… Esc cancels"); setEditing(false);
    try {
      const page = await task(pending.signal);
      if (token !== request.current) return;
      const next = page.items.flatMap(item => item.track ? [item.track] : []);
      const combined = [...(append ? tracks : []), ...next];
      const unique = [...new Map(combined.map(track => [track.id, track])).values()].slice(0, 200);
      setTracks(unique); setMore(() => unique.length < 200 ? page.more : undefined);
      if (!append) setCursor(0);
      setNotice(unique.length ? "Enter play · A append · P next · d download" : "No matches · / edit search");
    } catch {
      if (token === request.current) setNotice("Search failed · check connection · / retry");
    } finally { if (token === request.current) setBusy(false); }
  };
  const submit = (value: string) => {
    const parsed = playerQuery(value);
    if (!parsed.query) { setNotice("Type l: artist/song, s: songs or v: videos"); return; }
    request.current++; setQuery(value.slice(0, 204)); setCursor(0); setTracks([]); setMore(undefined);
    setSource(parsed.mode === "l" ? "Local" : parsed.mode === "v" ? "Online videos" : "Online songs");
    if (parsed.mode === "l") {
      const results = store.library.search(parsed.query).slice(0, 200);
      setTracks(results); setBusy(false); setEditing(false);
      setNotice(results.length ? "Enter play · A append · P next · already saved locally" : "No local matches · / edit search");
    } else void load(signal => searchMusic(parsed.query, parsed.mode === "v" ? "video" : "song", signal));
  };
  const rows = Math.max(1, height - 6), selected = Math.min(cursor, Math.max(0, tracks.length - 1));
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), tracks.length - rows));
  useInput((input, key) => {
    if (key.escape) { request.current++; controller.current?.abort(); onClose(); return; }
    if (editing) return;
    if (input === "/") { request.current++; controller.current?.abort(); setBusy(false); setEditing(true); return; }
    if (busy) return;
    if (key.upArrow) setCursor(Math.max(0, selected - 1));
    else if (key.downArrow) setCursor(Math.min(tracks.length - 1, selected + 1));
    else if (key.pageUp) setCursor(Math.max(0, selected - rows));
    else if (key.pageDown) setCursor(Math.min(tracks.length - 1, selected + rows));
    else if (input === "L" && more) void load(more, true);
    else {
      const track = tracks[selected]; if (!track) return;
      if (key.return) {
        void store.playback.selectTrack(track, [track]).catch(() => {
          if (mounted.current) setNotice("Could not play · try again");
        });
        setNotice("Playing selection · Esc returns to player");
      } else if (input === "A" || input === "P") {
        store.playback.enqueue(track, input === "P");
        setNotice(input === "P" ? "Queued next · Esc returns to player" : "Appended to queue · Esc returns to player");
      } else if (input === "d") {
        if (!isStream(track)) { setNotice("Already saved locally · no download needed"); return; }
        store.setPendingAdd(track.streamUrl); store.setSection("download"); store.setRegion("content");
        onClose(); onDownload();
      }
    }
  }, { isActive: active });
  return <Box width={width} height={height} borderStyle="round" borderColor={RULE} paddingX={1} flexDirection="column" overflow="hidden">
    <Text bold color={palette.alt} wrap="truncate-end">SEARCH · {source} · music keeps playing</Text>
    <Box height={1} overflow="hidden">{editing ? <TextField defaultValue={query} width={Math.max(1, width - 5)}
      placeholder="l: local / s: songs / v: videos" isDisabled={!active} onSubmit={submit} /> :
      <Text color={palette.accent} wrap="truncate-end">{cleanText(query)}</Text>}</Box>
    <Text color={palette.muted} wrap="truncate-end">{notice}</Text>
    <Box height={rows} overflow="hidden" flexDirection="column">{tracks.slice(start, start + rows).map((track, i) =>
      <Text key={track.id} color={start + i === selected ? palette.accent : palette.text} wrap="truncate-end">
        {start + i === selected ? "› " : "  "}{cleanText(track.title)} · {cleanText(track.artist ?? "")} · {formatDuration(track.durationSec)}
      </Text>)}</Box>
    <Text color={palette.muted} wrap="truncate-end">Esc back · / edit{more ? " · L more" : ""} · {tracks.length}/200 max</Text>
  </Box>;
}
