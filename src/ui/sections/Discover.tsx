import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { browseMusic, searchMusic, type MusicFilter, type MusicPage } from "../../sources/music";
import { cleanText, truncate } from "../../util/format";
import { useStore } from "../store";
import { TextField } from "../components/TextField";
import { COLOR } from "../theme";

const filters: MusicFilter[] = ["song", "video", "album", "artist", "playlist"];
export function Discover() {
  const { region, setCaptureMode, playback, setPendingAdd, setSection, listRows, contentWidth, pendingSearch, setPendingSearch } = useStore();
  const focused = region === "content";
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MusicFilter>("song");
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState<MusicPage>({ title: "YouTube Music · no sign-in needed", items: [] });
  useEffect(() => { if (pendingSearch) { setEditing(true); setPendingSearch(false); } }, [pendingSearch, setPendingSearch]);
  const [parents, setParents] = useState<{ page: MusicPage; cursor: number }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    setCaptureMode(focused && editing ? "text" : focused && (parents.length > 0 || busy) ? "esc" : "none");
    return () => setCaptureMode("none");
  }, [focused, editing, parents.length, busy, setCaptureMode]);
  const load = async (task: () => Promise<MusicPage>, mode: "search" | "browse" | "more") => {
    const token = ++request.current;
    setBusy(true); setNotice(""); setEditing(false);
    try {
      const next = await task();
      if (token !== request.current) return;
      if (mode === "browse") setParents(p => [...p, { page, cursor }]);
      if (mode === "search") setParents([]);
      setPage(mode === "more" ? { ...next, items: [...page.items, ...next.items] } : next);
      if (mode !== "more") setCursor(0);
    } catch {
      if (token === request.current) setNotice("Could not load YouTube Music. Check your connection; / searches again.");
    } finally { if (token === request.current) setBusy(false); }
  };
  const rows = Math.max(1, listRows - 4);
  const selected = Math.min(cursor, Math.max(0, page.items.length - 1));
  useInput((input, key) => {
    if (editing) { if (key.escape) setEditing(false); return; }
    if (key.escape) {
      request.current++; setBusy(false);
      const parent = parents.at(-1);
      if (parent) { setPage(parent.page); setCursor(parent.cursor); setParents(p => p.slice(0, -1)); }
      return;
    }
    if (input === "/") { setEditing(true); return; }
    if (input === "[" || input === "]") {
      const next = filters[(filters.indexOf(kind) + (input === "]" ? 1 : filters.length - 1)) % filters.length]!;
      setKind(next); if (query.trim()) void load(() => searchMusic(query, next), "search"); return;
    }
    if (busy) return;
    if (key.upArrow) setCursor(Math.max(0, selected - 1));
    else if (key.downArrow) setCursor(Math.min(page.items.length - 1, selected + 1));
    else if (key.pageDown) setCursor(Math.min(page.items.length - 1, selected + rows));
    else if (key.pageUp) setCursor(Math.max(0, selected - rows));
    else if (input === "L" && page.more) void load(page.more, "more");
    else {
      const item = page.items[selected]; if (!item) return;
      if (key.return) {
        if (item.track) {
          // Search is a one-off selection; a browsed collection supplies context.
          const tracks = parents.length ? page.items.flatMap(i => i.track ? [i.track] : []) : [item.track];
          void playback.selectTrack(item.track, tracks).catch(() => setNotice("Could not start playback. Try again in Queue."));
        } else void load(() => browseMusic(item), "browse");
      } else if (item.track && (input === "A" || input === "P")) {
        const already = playback.getState().list.some(t => t.id === item.track!.id);
        playback.enqueue(item.track, input === "P"); setNotice(already ? "Already queued · added another occurrence · 7 Playback queue" : input === "P" ? "Queued next · 7 opens queue" : "Added to queue · 7 opens queue");
      } else if (item.track && input === "d") {
        setPendingAdd(item.track.streamUrl); setSection("download");
      }
    }
  }, { isActive: focused });
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), page.items.length - rows));
  return <Box flexDirection="column" width={contentWidth}>
    <Text bold color={COLOR.alt} wrap="truncate-end">Discover · {cleanText(page.title)}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{filters.map(f => f === kind ? `[${f}]` : f).join("  ")}</Text>
    {focused && editing ? <TextField defaultValue={query} placeholder="Search music…" onChange={setQuery}
      onSubmit={value => { setQuery(value); void load(() => searchMusic(value, kind), "search"); }} />
      : <Text color={COLOR.muted} wrap="truncate-end">{busy ? "Loading… esc cancels" : notice || "/ search · [ ] type · enter stream/open · A/P queue · d download"}</Text>}
    {page.items.length === 0 && !busy ? <Text color={COLOR.muted}>Listen without downloading: / search · o Play URL · 9 radio</Text> : null}
    {page.items.slice(start, start + rows).map((item, i) => <Text key={`${start + i}:${item.id}`}
      color={focused && selected === start + i ? COLOR.accent : undefined} wrap="truncate-end">
      {selected === start + i ? "› " : "  "}{truncate(cleanText(`${item.title}${item.subtitle ? ` · ${item.subtitle}` : ""} [${item.kind}]`), contentWidth - 2)}
    </Text>)}
    <Text dimColor wrap="truncate-end">{page.items.length ? `${selected + 1}/${page.items.length} · ` : ""}{parents.length ? "esc back · " : ""}{page.more ? "L load more · " : ""}8 Discover · 7 Queue · m Player</Text>
  </Box>;
}
