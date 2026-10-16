import { MouseRow } from "../components/MouseRow";
import type { ContextAction } from "../components/ContextMenu";
import { useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { useStore, useHistory, usePlaybackSelector, type Section } from "../store";
import { JukeboxMark } from "../components/JukeboxMark";
import { playerPalette } from "../theme";
import { wrapStep } from "../move";
import { readStations, stationTrack } from "../../player/stations";
import { cleanText } from "../../util/format";

export function Home({ firstRun = false }: { firstRun?: boolean }) {
  const s = useStore();
  const C = playerPalette(s.config.playerTheme);
  useHistory(s.history);
  const state = usePlaybackSelector(s.playback, x => x);
  const [cursor, setCursor] = useState(0);
  const [stations] = useState(() => { if (firstRun) return []; try { return readStations().slice(0, 3); } catch { return []; } });
  const width = firstRun ? Math.max(20, s.cols - 2) : s.contentWidth;
  const open = (section: Section) => {
    if (firstRun) s.setConfig({ ...s.config, firstRunComplete: true });
    s.setSection(section); s.setRegion("content");
  };
  const actions: { label: string; run: () => void; menuActions?: ContextAction[] }[] = [
    { label: "Search and play online", run: () => { s.setPendingSearch(true); open("discover"); } },
    { label: "Radio / paste a URL", run: () => { open("listen"); s.setOpenUrlRequest?.((s.openUrlRequest ?? 0) + 1); } },
    { label: "Local music library", run: () => open("library") },
    { label: "Download music (optional)", run: () => open("download") },
  ];
  const recent = s.history.ids().map(id => s.library.get(id) ?? s.history.getStream(id)).filter(t => !!t).slice(0, 3);
  if (!firstRun && s.rows >= 30) {
    for (const t of recent) actions.push({ label: `Recent · ${cleanText(t.title)}`, run: () => s.playTrack(t), menuActions: [{ label: "Play", run: () => s.playTrack(t) }, { label: "Play next", run: () => s.playback.enqueue(t, true) }, { label: "Add to queue", run: () => s.playback.enqueue(t, false) }] });
    for (const station of stations) { const track = stationTrack(station); actions.push({ label: `Radio · ${cleanText(station.name)}`, run: () => { void s.playback.selectTrack(track, [track]).catch(() => {}); }, menuActions: [{ label: "Play", run: () => s.playTrack(track) }, { label: "Play next", run: () => s.playback.enqueue(track, true) }, { label: "Add to queue", run: () => s.playback.enqueue(track, false) }] }); }
  }
  useInput((input, key) => {
    if (key.upArrow) setCursor(c => wrapStep(c, -1, actions.length));
    else if (key.downArrow) setCursor(c => wrapStep(c, 1, actions.length));
    else if (key.return) actions[Math.min(cursor, actions.length - 1)]?.run();
    else if (firstRun && key.escape) open("home");
  }, { isActive: firstRun || s.region === "content" });
  return <Box flexDirection="column" width={width} overflow="hidden">
    <Box gap={3} marginBottom={s.rows >= 30 ? 1 : 0}>
      {s.rows >= 30 && width >= 65 ? <JukeboxMark /> : null}
      <Box flexDirection="column" flexShrink={1}>
        <Text bold color={C.accent}>{firstRun ? "Welcome to JukeboxCli" : "Your jukebox"}</Text>
        <Text color={C.text}>Local music. Online tracks. Live radio.</Text>
        {s.rows >= 25 ? <Text color={C.muted}>Listen first. Download only when you choose.</Text> : null}
        {firstRun ? <Text color={C.muted} wrap="truncate-end">Downloads: {s.config.libraryDir}</Text> : null}
        {!firstRun && s.rows >= 25 ? <Text color={C.alt} wrap="truncate-end">{state.track ? `${state.paused ? "Paused" : "Now playing"} · ${cleanText(state.track.title)}` : "Nothing playing yet — choose something below"}</Text> : null}
      </Box>
    </Box>
    {actions.map((a, i) => <MouseRow key={i} active={firstRun || s.region === "content"} width={width} onClick={a.run} menuTitle={a.label} menuActions={a.menuActions ?? [{ label: "Open", run: a.run }]}><Text color={cursor === i ? C.accent : C.text} bold={cursor === i} wrap="truncate-end">{cursor === i ? "› " : "  "}{a.label}</Text></MouseRow>)}
    <Text color={C.muted}>{firstRun ? "↑↓ choose · Enter open · Esc skip to Home" : "↑↓ choose · Enter open · H Home · 8 search · 9 radio"}</Text>
  </Box>;
}
