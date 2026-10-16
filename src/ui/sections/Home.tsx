import { playbackActions } from "../components/PlaybackActions";
import { MouseRow } from "../components/MouseRow";
import type { ContextAction } from "../components/ContextMenu";
import { useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { useStore, useHistory, useLibrary, usePlaybackSelector, type Section } from "../store";
import { JukeboxMark } from "../components/JukeboxMark";
import { playerPalette } from "../theme";
import { wrapStep } from "../move";
import { readStations, stationTrack } from "../../player/stations";
import { cleanText, formatDuration } from "../../util/format";
import { isLive, isStream } from "../../player/media";
import type { PlaybackState } from "../../player/playback";

interface HomeAction { id: string; label: string; detail: string; key?: string; run: () => void; menuActions?: ContextAction[] }
type HomeState = Pick<PlaybackState, "track" | "paused"> & { loading: boolean; queueCount: number; cookieRetry: boolean };

/** Explicit row budgets: no focusable actions hidden below a short terminal. */
export function homeLayout(width: number, height: number) {
  const cards = width >= 70 && height >= 28;
  const mark = cards && width >= 90 && height >= 40;
  const hero = mark ? 12 : cards ? 6 : height >= 16 ? 4 : 2;
  const quickCount = cards ? 6 : Math.min(6, Math.max(1, height - hero - 2));
  const remaining = Math.max(0, height - hero - (cards ? 14 : quickCount + 1) - 1);
  const panels = cards && remaining >= 5;
  const recent = panels ? Math.min(3, Math.max(0, Math.floor((remaining - 4) / 2))) : Math.min(3, Math.max(0, remaining - 1));
  return { cards, mark, hero, quickCount, remaining, panels, recent };
}

export function Home({ firstRun = false }: { firstRun?: boolean }) {
  const s = useStore();
  const C = playerPalette(s.config.playerTheme);
  useHistory(s.history);
  const version = useLibrary(s.library);
  const libraryCount = useMemo(() => s.library.all().length, [s.library, version]);
  // Clock ticks don't repaint the whole dashboard.
  const summary = useRef<HomeState | undefined>(undefined);
  const { track, paused, loading, queueCount, cookieRetry } = usePlaybackSelector(s.playback, x => {
    const previous = summary.current;
    if (previous && previous.track === x.track && previous.paused === x.paused && previous.loading === Boolean(x.loading) && previous.queueCount === x.list.length && previous.cookieRetry === Boolean(x.cookieRetryAvailable)) return previous;
    return summary.current = { track: x.track, paused: x.paused, loading: Boolean(x.loading), queueCount: x.list.length, cookieRetry: Boolean(x.cookieRetryAvailable) };
  });
  const [selectedId, setSelectedId] = useState("music");
  const [saved] = useState(() => {
    try { return { stations: firstRun ? [] : readStations(), error: false }; }
    catch { return { stations: [], error: true }; }
  });
  const width = Math.max(8, firstRun ? s.cols - 2 : s.contentWidth);
  const height = Math.max(8, s.listRows);
  const showRetry = cookieRetry && !firstRun;
  const layout = homeLayout(width, height - Number(showRetry));
  const focused = firstRun || s.region === "content";
  const clickable = firstRun || s.region !== "help";
  const open = (section: Section) => {
    if (firstRun) s.setConfig({ ...s.config, firstRunComplete: true });
    s.setSection(section); s.setRegion("content");
  };
  const quick: HomeAction[] = [
    { id: "music", key: "7", label: "Search and play online", detail: "Songs, artists, albums and playlists", run: () => { s.setPendingSearch(true); open("discover"); } },
    { id: "videos", key: "Y", label: "YouTube videos", detail: "Search, watch or listen as audio", run: () => { s.setPendingSearch(true); open("videos"); } },
    { id: "radio", key: "8", label: "Live radio", detail: "Find stations · o pastes a music URL", run: () => open("listen") },
    { id: "library", key: "1", label: "Local music library", detail: libraryCount ? `${libraryCount} tracks · artists, albums and genres` : "Bring your own music, whenever you like", run: () => open("library") },
    { id: "queue", key: "6", label: "Playback queue", detail: queueCount ? `${queueCount} items · one queue, every source` : "Mix local files, online tracks and radio", run: () => open("queue") },
    { id: "download", key: "4", label: "Download music (optional)", detail: "Save only the music you choose", run: () => open("download") },
  ].slice(0, layout.quickCount);
  const recent: HomeAction[] = [];
  if (!firstRun) for (const id of s.history.ids()) {
    if (recent.length >= layout.recent) break;
    const t = s.library.get(id) ?? s.history.getStream(id);
    if (!t) continue;
    recent.push({ id: `recent:${id}`, label: `Recent · ${cleanText(t.title)}`,
      detail: [isLive(t) ? "LIVE" : isStream(t) ? "Online" : "Local", t.artist ? cleanText(t.artist) : undefined, t.durationSec && !isLive(t) ? formatDuration(t.durationSec) : undefined].filter(Boolean).join(" · "),
      run: () => s.playTrack(t), menuActions: [...playbackActions(t, mode => s.playTrack(t, undefined, mode)),
        { label: "Play next", run: () => s.playback.enqueue(t, true) }, { label: "Add to queue", run: () => s.playback.enqueue(t, false) }] });
  }
  const panels = layout.panels && !firstRun;
  const stations: HomeAction[] = panels ? saved.stations.slice(0, layout.recent).map(station => {
    const t = stationTrack(station);
    return { id: `station:${t.id}`, label: cleanText(station.name), detail: "LIVE · saved station", run: () => s.playTrack(t),
      menuActions: [{ label: "Play", run: () => s.playTrack(t) }, { label: "Play next", run: () => s.playback.enqueue(t, true) }, { label: "Add to queue", run: () => s.playback.enqueue(t, false) }] };
  }) : [];
  const historyLink: HomeAction = { id: "history", label: "3  Listening history", detail: "", run: () => open("history") };
  const radioLink: HomeAction = { id: "stations", label: "8  Browse all stations", detail: "", run: () => open("listen") };
  const retry: HomeAction = { id: "retry", label: "Retry without cookies", detail: "This item only · saved browser stays selected", run: () => { void s.playback.retryWithoutCookies(); } };
  const actions = [...quick, ...(showRetry ? [retry] : []), ...recent, ...(panels ? [historyLink, ...stations, radioLink] : [])];
  const selected = Math.max(0, actions.findIndex(a => a.id === selectedId));
  useInput((input, key) => {
    if (key.upArrow || key.downArrow) setSelectedId(actions[wrapStep(selected, key.upArrow ? -1 : 1, actions.length)]!.id);
    else if (key.return) actions[selected]?.run();
    else if (firstRun && key.escape) open("home");
  }, { isActive: focused });
  const row = (a: HomeAction, rowWidth: number, detail = false) => <MouseRow key={a.id} active={clickable} width={rowWidth}
    onClick={() => { setSelectedId(a.id); s.setRegion("content"); a.run(); }} menuTitle={a.label} menuActions={a.menuActions ?? [{ label: "Open", run: a.run }]}>
    <Box flexDirection="column" width={rowWidth}>
      <Text color={actions[selected]?.id === a.id ? C.accent : C.text} bold={actions[selected]?.id === a.id} wrap="truncate-end">{actions[selected]?.id === a.id ? "› " : "  "}{a.label}</Text>
      {detail ? <Text color={C.muted} wrap="truncate-end">  {a.detail}</Text> : null}
    </Box>
  </MouseRow>;
  const half = Math.floor((width - 2) / 2);
  const status = loading ? "Loading your selection…" : track ? `${paused ? "Paused" : isLive(track) ? "On air" : "Now playing"} · ${cleanText(track.title)}` : "Ready when you are — choose something below";
  return <Box flexDirection="column" width={width} height={height} flexShrink={0}>
    <Box height={layout.hero} flexShrink={0} gap={3}>
      {layout.mark ? <JukeboxMark /> : null}
      <Box flexDirection="column" flexGrow={1} minWidth={0}>
        <Text bold color={C.accent} wrap="truncate-end">{firstRun ? "Welcome to JukeboxCli" : "Your jukebox"}</Text>
        {layout.hero >= 4 ? <Text color={C.text} wrap="truncate-end">Local music. Online tracks. Live radio.</Text> : null}
        <Text color={C.muted} wrap="truncate-end">{firstRun ? `Downloads: ${cleanText(s.config.libraryDir)}` : `${libraryCount} local tracks · ${queueCount} queued · ${saved.error ? "stations unavailable" : `${saved.stations.length} saved stations`}`}</Text>
        {layout.hero >= 4 ? <Text color={C.alt} wrap="truncate-end">{status}</Text> : null}
        {layout.cards ? <>
          <Text color={C.muted} wrap="truncate-end">Listen first. Download only when you choose.</Text>
          <Box gap={2}>
            <MouseRow active={clickable} width={16} onClick={() => open("player")}><Text color={C.alt}>m  Open player</Text></MouseRow>
            <MouseRow active={clickable} onClick={() => { open("listen"); s.setOpenUrlRequest?.((s.openUrlRequest ?? 0) + 1); }}><Text color={C.alt}>o  Paste a music URL</Text></MouseRow>
          </Box>
        </> : null}
        {layout.mark && track?.artist ? <Text color={C.muted} wrap="truncate-end">{cleanText(track.artist)}</Text> : null}
      </Box>
    </Box>
    <Text bold color={C.alt} wrap="truncate-end">START LISTENING</Text>
    {layout.cards ? <Box flexDirection="column" width={width} marginBottom={1}>
      {[0, 2, 4].map(start => <Box key={start} width={width} gap={2}>{quick.slice(start, start + 2).map(a => <MouseRow key={a.id} active={clickable} width={half}
        onClick={() => { setSelectedId(a.id); a.run(); }} menuTitle={a.label} menuActions={[{ label: "Open", run: a.run }]}>
        <Box flexDirection="column" width={half} height={4} borderStyle="round" borderColor={actions[selected]?.id === a.id ? C.accent : C.muted} paddingX={1}>
          <Text bold color={actions[selected]?.id === a.id ? C.accent : C.text} wrap="truncate-end">{actions[selected]?.id === a.id ? "› " : "  "}{a.key}  {a.label}</Text>
          <Text color={C.muted} wrap="truncate-end">{a.detail}</Text>
        </Box>
      </MouseRow>)}</Box>)}
    </Box> : quick.map(a => row(a, width))}
    {showRetry ? row(retry, width) : null}
    {panels ? <Box width={width} gap={2} flexGrow={1} minHeight={0}>
      <Box width={half} flexDirection="column" borderStyle="round" borderColor={C.muted} paddingX={1}>
        <Text bold color={C.alt}>RECENT LISTENING</Text>
        {recent.length ? recent.map(a => row(a, half - 4, true)) : <Text color={C.muted} wrap="truncate-end">Your recent plays will appear here.</Text>}
        {row(historyLink, half - 4)}
      </Box>
      <Box width={half} flexDirection="column" borderStyle="round" borderColor={C.muted} paddingX={1}>
        <Text bold color={C.alt}>SAVED STATIONS</Text>
        {stations.length ? stations.map(a => row(a, half - 4, true)) : <Text color={C.muted} wrap="truncate-end">{saved.error ? "Could not read stations · check 8 Radio." : "Find a station in Radio; f saves it here."}</Text>}
        {row(radioLink, half - 4)}
      </Box>
    </Box> : recent.length ? <Box flexDirection="column"><Text bold color={C.alt}>RECENT LISTENING</Text>{recent.map(a => row(a, width))}</Box> : null}
    <Text color={C.muted} wrap="truncate-end">{firstRun ? "↑↓ choose · Enter open · Esc skip to Home" : `${focused ? "↑↓ choose · Enter open" : "Tab for Home choices"} · o URL · Mouse: ${s.config.mouseMode ?? "wheel"}${s.config.mouseMode === "click" ? "" : " (9 Settings enables clicks)"}`}</Text>
  </Box>;
}
