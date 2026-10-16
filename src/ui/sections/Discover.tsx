import { LIVE_DOWNLOAD_ERROR } from "../../ytdlp/live";
import stringWidth from "string-width";
import { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { browseMusic, searchMusic, searchYouTubeVideos, queueLoader, type MusicFilter, type MusicPage } from "../../sources/music";
import { cleanText, truncate, formatDuration } from "../../util/format";
import { useStore } from "../store";
import { TextField } from "../components/TextField";
import { ContextMenu } from "../components/ContextMenu";
import { MouseRow } from "../components/MouseRow";
import { browseIcon } from "../icons";
import { COLOR } from "../theme";

const filters: MusicFilter[] = ["song", "video", "album", "artist", "playlist"];
interface BrowseSnapshot {
  query: string; kind: MusicFilter; page: MusicPage;
  parents: { page: MusicPage; cursor: number }[]; cursor: number;
}
// Two bounded browsing snapshots per player session. No cross-profile/global history.
const sessions = new WeakMap<object, Map<boolean, BrowseSnapshot>>();
export function Discover({ videos: youtube = false }: { videos?: boolean } = {}) {
  const { config, region, setCaptureMode, playback, setPendingAdd, setSection, listRows, contentWidth, pendingSearch, setPendingSearch } = useStore();
  const focused = region === "content";
  const saved = sessions.get(playback)?.get(youtube);
  const [query, setQuery] = useState(saved?.query ?? "");
  const [kind, setKind] = useState<MusicFilter>(saved?.kind ?? "song");
  const [editing, setEditing] = useState(youtube && !saved?.query);
  const [page, setPage] = useState<MusicPage>(saved?.page ?? { title: youtube ? "Search videos, channels and topics" : "YouTube Music · no sign-in needed", items: [] });
  useEffect(() => { if (pendingSearch) { setMenu(null); setDetails(false); setEditing(true); setPendingSearch(false); } }, [pendingSearch, setPendingSearch]);
  const [parents, setParents] = useState<{ page: MusicPage; cursor: number }[]>(saved?.parents ?? []);
  const [cursor, setCursor] = useState(saved?.cursor ?? 0);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number }>();
  const actions = ["Play audio", "Play video", "Play next", "Add to queue", "Download", "Details"];
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const autoAttempt = useRef<MusicPage | null>(null);
  const snapshot = useRef<BrowseSnapshot>({ query, kind, page, parents, cursor });
  snapshot.current = { query, kind, page, parents, cursor };
  useEffect(() => () => {
    const cache = sessions.get(playback) ?? new Map<boolean, BrowseSnapshot>();
    cache.set(youtube, snapshot.current); sessions.set(playback, cache);
  }, [playback, youtube]);
  useEffect(() => () => { request.current++; controller.current?.abort(); }, []);
  useEffect(() => {
    setCaptureMode(focused && editing ? "text" : focused && menu !== null ? "menu" : focused && details ? "picker" : focused && (parents.length > 0 || busy) ? "esc" : "none");
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
  const rows = Math.max(1, listRows - (youtube ? 5 : 4) - (editing ? 1 : 0) - (details ? 6 : 0));
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
    else if (choice === 4 && item.track.isLive) { setNotice(LIVE_DOWNLOAD_ERROR); }
    else if (choice === 4) { setPendingAdd(item.track.streamUrl); setSection("download"); }
    else setDetails(true);
  };
  useInput((input, key) => {
    if (details) { if (key.escape || key.return) setDetails(false); return; }
    if (menu !== null) return;
    if (editing) { if (key.escape) setEditing(false); return; }
    if (key.escape) {
      request.current++; controller.current?.abort(); setBusy(false);
      const parent = parents.at(-1);
      if (parent) { setPage(parent.page); setCursor(parent.cursor); setParents(p => p.slice(0, -1)); }
      return;
    }
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
      if (input === "c" && item.track) { setMenuAnchor(undefined); setMenu(selected); return; }
      if (youtube && item.track && input === "a") { runAction(0); return; }
      if (key.return) {
        if (youtube && item.track) { runAction(1); return; }
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
      } else if (item.track && input === "d") { runAction(4); }
    }
  }, { isActive: focused });
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), page.items.length - rows));
  return <Box position="relative" flexDirection="column" width={contentWidth} height={listRows}>
    <Text bold color={COLOR.alt} wrap="truncate-end">{browseIcon(youtube ? "video" : "music")} {youtube ? "YouTube Videos" : "Music Discover"} · {cleanText(page.title)}</Text>
    {!youtube ? <Text color={COLOR.muted} wrap="truncate-end">{filters.map(f => f === kind ? `[${f}]` : f).join("  ")}</Text> : null}
    {focused && editing ? <TextField defaultValue={query} width={contentWidth} placeholder={youtube ? "Search YouTube videos…" : "Search music…"} onChange={setQuery}
      onSubmit={value => { setQuery(value); search(value); }} />
      : youtube ? <MouseRow active={focused && menu === null && !details} onClick={() => { setEditing(true); }} width={contentWidth}>
        <Text color={COLOR.muted} wrap="truncate-end">Search: {query || "type a video, channel or topic"} · / edit</Text>
      </MouseRow> : <Text color={COLOR.muted} wrap="truncate-end">{busy ? "Loading… esc cancels" : notice || `/ search${youtube ? "" : " · [ ] type"} · enter audio/open · c actions · A/P queue · d download`}</Text>}
    {focused && editing ? <MouseRow allowDuringText active={focused} width={contentWidth} onClick={() => setEditing(false)}>
      <Text color={COLOR.alt} wrap="truncate-end">Enter searches · Esc / click here cancels · sidebar stays clickable</Text>
    </MouseRow> : null}
    {youtube ? <>
      <Text color={COLOR.muted} wrap="truncate-end">{busy ? "Searching… esc cancels" : notice || (editing ? "Editing search" : `Enter ${browseIcon("video")} video · a audio only · c actions · A/P queue · d download`)}</Text>
      <Text color={COLOR.alt} wrap="truncate-end">{contentWidth >= 65 ? "   Title".padEnd(Math.floor(contentWidth * .58)) + "Channel".padEnd(Math.floor(contentWidth * .26)) + "Duration" : "Video · Channel · Duration"}</Text>
    </> : null}
    {page.items.length === 0 && !busy ? <Text color={COLOR.muted}>Listen without downloading: / search · o Play URL · 9 radio</Text> : null}
    {page.items.slice(start, start + rows).map((item, i) => <MouseRow key={`${start + i}:${item.id}`} active={focused && !editing && !busy && menu === null && !details} width={contentWidth}
      onClick={() => setCursor(start + i)} onContextMenu={point => { if (item.track) { setCursor(start + i); setMenuAnchor({ x: point.x, y: (youtube ? 4 : 3) + i + point.y }); setMenu(start + i); } }}>
      <Text
      color={focused && selected === start + i ? COLOR.accent : undefined} wrap="truncate-end">
      {selected === start + i ? "› " : "  "}{youtube ? videoRow(item, contentWidth - 2, playback.getState().list.some(t => t.id === item.track?.id)) : `${browseIcon("music")} ${truncate(cleanText(`${item.title}${item.subtitle ? ` · ${item.subtitle}` : ""} [${item.kind}]`), contentWidth - 4)}`}
    </Text></MouseRow>)}
    {details ? <Box flexDirection="column" borderStyle="round" borderColor={COLOR.accent}>
      <Text>{cleanText(page.items[selected]?.title ?? "")}</Text>
      <Text>{cleanText(page.items[selected]?.subtitle ?? "")}</Text>
      <Text wrap="truncate-end">{cleanText(page.items[selected]?.track?.streamUrl ?? "")}</Text>
      <Text dimColor>esc / enter closes details</Text>
    </Box> : null}
    <Text dimColor wrap="truncate-end">{page.items.length ? `${selected + 1}/${page.items.length} · ` : ""}{parents.length ? "esc back · " : ""}{page.more ? "L load more · " : ""}8 Music · Y Videos · 7 Queue · m Player</Text>
    {menu !== null ? <ContextMenu title={youtube ? "Video actions" : "Music actions"} actions={actions.map((label, i) => ({ label: i === 4 && page.items[menu]?.track?.isLive ? "Download: live stream (play only)" : label, run: () => runAction(i) }))}
      width={contentWidth} height={listRows} active={focused} anchor={menuAnchor} close={() => setMenu(null)} /> : null}
  </Box>;
}

function videoRow(item: import("../../sources/music").MusicResult, width: number, queued: boolean): string {
  const icon = browseIcon(item.track?.isLive ? "live" : "video");
  const title = `${icon}${queued ? browseIcon("queued") : " "} ${cleanText(item.title)}`;
  const channel = cleanText(item.track?.artist ?? "—");
  const duration = item.track?.isLive ? "LIVE" : item.track?.durationSec ? formatDuration(item.track.durationSec) : "—";
  if (width < 63) return truncate(`${title} · ${channel} · ${duration}`, width);
  const titleWidth = Math.floor((width + 2) * .58) - 2;
  const channelWidth = Math.floor((width + 2) * .26);
  return padColumn(title, titleWidth) + padColumn(channel, channelWidth) + truncate(duration, width - titleWidth - channelWidth);
}

function padColumn(text: string, width: number): string {
  const value = truncate(text, width - 1);
  return value + " ".repeat(Math.max(0, width - stringWidth(value)));
}
