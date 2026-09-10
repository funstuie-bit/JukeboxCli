import { useState } from "react";
import { Box, Text, useInput } from "ink";
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
  const actions = [
    { label: "Search and play online", run: () => { s.setPendingSearch(true); open("discover"); } },
    { label: "Radio / paste a URL", run: () => { open("listen"); s.setOpenUrlRequest?.((s.openUrlRequest ?? 0) + 1); } },
    { label: "Local music library", run: () => open("library") },
    { label: "Download music (optional)", run: () => open("download") },
  ];
  const recent = s.history.ids().map(id => s.library.get(id) ?? s.history.getStream(id)).filter(t => !!t).slice(0, 3);
  if (!firstRun && s.rows >= 30) {
    for (const t of recent) actions.push({ label: `Recent · ${cleanText(t.title)}`, run: () => s.playTrack(t) });
    for (const station of stations) actions.push({ label: `Radio · ${cleanText(station.name)}`, run: () => { const track = stationTrack(station); void s.playback.selectTrack(track, [track]).catch(() => {}); } });
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
    {actions.map((a, i) => <Text key={i} color={cursor === i ? C.accent : C.text} bold={cursor === i} wrap="truncate-end">{cursor === i ? "› " : "  "}{a.label}</Text>)}
    <Text color={C.muted}>{firstRun ? "↑↓ choose · Enter open · Esc skip to Home" : "↑↓ choose · Enter open · H Home · 8 search · 9 radio"}</Text>
  </Box>;
}
