import { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { browseMusic, searchMusic, searchYouTubeVideos, queueLoader, type MusicFilter, type MusicPage } from "../../sources/music";
import { cleanText, truncate } from "../../util/format";
import { useStore } from "../store";
import { TextField } from "../components/TextField";
import { MouseRow } from "../components/MouseRow";
import { COLOR } from "../theme";

const filters: MusicFilter[] = ["song", "video", "album", "artist", "playlist"];
export function Discover() {
  const { config, region, setCaptureMode, playback, setPendingAdd, setSection, listRows, contentWidth, pendingSearch, setPendingSearch } = useStore();
  const focused = region === "content";
  const [youtube, setYoutube] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MusicFilter>("song");
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState<MusicPage>({ title: "YouTube Music · no sign-in needed", items: [] });
  useEffect(() => { if (pendingSearch) { setMenu(null); setDetails(false); setEditing(true); setPendingSearch(false); } }, [pendingSearch, setPendingSearch]);
  const [parents, setParents] = useState<{ page: MusicPage; cursor: number }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [action, setAction] = useState(0);
  const actions = ["Play audio", "Play video", "Play next", "Add to queue", "Download", "Details"];
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const autoAttempt = useRef<MusicPage | null>(null);
  useEffect(() => () => { request.current++; controller.current?.abort(); }, []);
  useEffect(() => {
    setCaptureMode(focused && editing ? "text" : focused && (menu !== null || details) ? "picker" : focused && (parents.length > 0 || busy) ? "esc" : "none");
    return () => setCaptureMode("none");
  }, [focused, editing, menu, details, parents.length, busy, setCaptureMode]);
  const load = async (task: (signal: AbortSignal) => Promise<MusicPage>, mode: "search" | "browse" | "more") => {
    const token = ++request.current;
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    setBusy(true); setNotice(""); setEditing(false);
    try {
      const next = await task(pending.signal);
      if (token !== request.current) return;
      if (mode === "browse") setParents(p => [...p, { page, cursor }]);
      if (mode === "search") setParents([]);
      const items = (mode === "more" ? [...page.items, ...next.items] : next.items).slice(0, 10000);
      setPage({ ...next, items, more: items.length >= 10000 || !next.items.length ? undefined : next.more });
      if (mode !== "more") setCursor(0);
    } catch {
      if (token === request.current) setNotice("Could not load search results. Check your connection; / searches again.");
    } finally { if (token === request.current) setBusy(false); }
  };
  const search = (value: string, videos = youtube, filter = kind) => {
    setPage({ title: value, items: [] }); setParents([]); setCursor(0);
    void load(signal => videos ? searchYouTubeVideos(value, signal) : searchMusic(value, filter, signal), "search");
  };
  const changeSource = (videos: boolean) => {
    if (videos === youtube) return;
    request.current++; controller.current?.abort(); setBusy(false);
    setYoutube(videos); setMenu(null); setDetails(false); setParents([]); setCursor(0); setNotice("");
    setPage({ title: "Search videos, music, talks and more", items: [] });
    if (query.trim()) search(query, videos);
    else setEditing(true);
  };
  const rows = Math.max(1, listRows - 5 - (menu !== null ? 8 : details ? 6 : 0));
  const selected = Math.min(cursor, Math.max(0, page.items.length - 1));
  useEffect(() => {
    if (!config.autoLoadMore || !focused || menu !== null || details || editing || busy || !page.more || !page.items.length || page.items.length >= 10000 || selected < page.items.length - 3 || autoAttempt.current === page) return;
    autoAttempt.current = page;
    void load(page.more, "more");
  }, [config.autoLoadMore, focused, menu, details, editing, busy, page, selected]);
  const runAction = (choice: number) => {
    const item = page.items[menu ?? selected];
    setMenu(null);
    if (!item?.track) return;
    if (choice <= 1) {
      const tracks = parents.length ? page.items.flatMap(i => i.track ? [i.track] : []) : [item.track];
      void playback.selectTrack(item.track, tracks, choice === 1 ? "video" : "audio")
        .catch(() => setNotice("Could not start playback. Try again in Queue."));
      playback.setContinuationEnabled(config.queueContinuation === true);
      playback.setContinuation(config.queueContinuation && parents.length ? queueLoader(page) : undefined);
    } else if (choice <= 3) { playback.enqueue(item.track, choice === 2); setNotice(choice === 2 ? "Queued next" : "Added to queue"); }
    else if (choice === 4) { setPendingAdd(item.track.streamUrl); setSection("download"); }
    else setDetails(true);
  };
  useInput((input, key) => {
    if (details) { if (key.escape || key.return) setDetails(false); return; }
    if (menu !== null) {
      if (key.escape) setMenu(null);
      else if (key.upArrow) setAction(a => Math.max(0, a - 1));
      else if (key.downArrow) setAction(a => Math.min(actions.length - 1, a + 1));
      else if (key.return) runAction(action);
      return;
    }
    if (editing) { if (key.escape) setEditing(false); return; }
    if (key.escape) {
      request.current++; controller.current?.abort(); setBusy(false);
      const parent = parents.at(-1);
      if (parent) { setPage(parent.page); setCursor(parent.cursor); setParents(p => p.slice(0, -1)); }
      return;
    }
    if (input === "Y") { changeSource(!youtube); return; }
    if (input === "/") { request.current++; controller.current?.abort(); setBusy(false); setEditing(true); return; }
    if (!youtube && (input === "[" || input === "]")) {
      const next = filters[(filters.indexOf(kind) + (input === "]" ? 1 : filters.length - 1)) % filters.length]!;
      setKind(next); if (query.trim()) search(query, false, next); return;
    }
    if (busy) return;
    if (key.upArrow) setCursor(Math.max(0, selected - 1));
    else if (key.downArrow) setCursor(Math.min(page.items.length - 1, selected + 1));
    else if (key.pageDown) setCursor(Math.min(page.items.length - 1, selected + rows));
    else if (key.pageUp) setCursor(Math.max(0, selected - rows));
    else if (input === "L" && page.more) void load(page.more, "more");
    else {
      const item = page.items[selected]; if (!item) return;
      if (input === "c" && item.track) { setAction(0); setMenu(selected); return; }
      if (key.return) {
        if (item.track) {
          // Search is a one-off selection; a browsed collection supplies context.
          const tracks = parents.length ? page.items.flatMap(i => i.track ? [i.track] : []) : [item.track];
          void playback.selectTrack(item.track, tracks).catch(() => setNotice("Could not start playback. Try again in Queue."));
          playback.setContinuationEnabled(config.queueContinuation === true);
          playback.setContinuation(config.queueContinuation && parents.length ? queueLoader(page) : undefined);
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
    <Box>
      <MouseRow active={focused && !editing && menu === null && !details} onClick={() => changeSource(false)}><Text color={!youtube ? COLOR.accent : COLOR.muted}>{!youtube ? "[YouTube Music]" : " YouTube Music "}</Text></MouseRow>
      <MouseRow active={focused && !editing && menu === null && !details} onClick={() => changeSource(true)}><Text color={youtube ? COLOR.accent : COLOR.muted}>{youtube ? " [YouTube Videos]" : "  YouTube Videos "}</Text></MouseRow>
      <Text dimColor> · Y switch</Text>
    </Box>
    <Text bold color={COLOR.alt} wrap="truncate-end">Discover · {cleanText(page.title)}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{youtube ? "All YouTube videos · audio or video playback · no sign-in needed" : filters.map(f => f === kind ? `[${f}]` : f).join("  ")}</Text>
    {focused && editing ? <TextField defaultValue={query} placeholder={youtube ? "Search YouTube videos…" : "Search music…"} onChange={setQuery}
      onSubmit={value => { setQuery(value); search(value); }} />
      : <Text color={COLOR.muted} wrap="truncate-end">{busy ? "Loading… esc cancels" : notice || `/ search${youtube ? "" : " · [ ] type"} · enter audio/open · c actions · A/P queue · d download`}</Text>}
    {page.items.length === 0 && !busy ? <Text color={COLOR.muted}>Listen without downloading: / search · o Play URL · 9 radio</Text> : null}
    {page.items.slice(start, start + rows).map((item, i) => <MouseRow key={`${start + i}:${item.id}`} active={focused && !editing && !busy && menu === null && !details} width={contentWidth}
      onClick={() => setCursor(start + i)} onContextMenu={() => { if (item.track) { setCursor(start + i); setAction(0); setMenu(start + i); } }}>
      <Text
      color={focused && selected === start + i ? COLOR.accent : undefined} wrap="truncate-end">
      {selected === start + i ? "› " : "  "}{truncate(cleanText(`${item.title}${item.subtitle ? ` · ${item.subtitle}` : ""} [${item.kind}]`), contentWidth - 2)}
    </Text></MouseRow>)}
    {details ? <Box flexDirection="column" borderStyle="round" borderColor={COLOR.accent}>
      <Text>{cleanText(page.items[selected]?.title ?? "")}</Text>
      <Text>{cleanText(page.items[selected]?.subtitle ?? "")}</Text>
      <Text wrap="truncate-end">{cleanText(page.items[selected]?.track?.streamUrl ?? "")}</Text>
      <Text dimColor>esc / enter closes details</Text>
    </Box> : null}
    {menu !== null ? <Box flexDirection="column" borderStyle="round" borderColor={COLOR.accent}>
      {actions.map((label, i) => <MouseRow key={label} active={focused} onClick={() => runAction(i)} width={contentWidth - 2}>
        <Text color={i === action ? COLOR.accent : undefined}>{i === action ? "› " : "  "}{label}</Text>
      </MouseRow>)}
    </Box> : null}
    <Text dimColor wrap="truncate-end">{page.items.length ? `${selected + 1}/${page.items.length} · ` : ""}{parents.length ? "esc back · " : ""}{page.more ? "L load more · " : ""}8 Discover · 7 Queue · m Player</Text>
  </Box>;
}
