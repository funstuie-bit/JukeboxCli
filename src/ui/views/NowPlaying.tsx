import { memo, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { usePlayback, useStore } from "../store";
import { loadWaveform, type Waveform } from "../../player/art";
import { cleanText, formatDuration, trackDisplayTitle } from "../../util/format";
import { RULE, playerPalette, type PlayerPalette } from "../theme";
import { ListeningQueue } from "./ListeningQueue";
import { isLive, isStream } from "../../player/media";
import { Cover } from "../components/Cover";
import { graphicsPainter, graphicsProtocol, simpleArtwork } from "../../player/graphics";
import { RadioFallback } from "../components/RadioFallback";
import { LyricsPanel } from "../components/LyricsPanel";
import { PlayerSearch } from "../components/PlayerSearch";

export function playerLayout(width: number, height: number, live = false, waveform = false) {
  const split = width >= 86 && height >= 16;
  const left = split ? Math.min(56, Math.max(40, Math.floor(width * 0.36))) : width;
  const waveRows = height >= 26 ? 2 : 1;
  // Borders (2), heading (4), transport/status (4), then optional rows.
  // Reserve these before artwork so the bottom border cannot run into the footer.
  const extraRows = (height >= 23 ? 2 : 0) + (live && height >= 26 ? 2 : 0)
    + (!live && waveform ? 1 + waveRows : 0);
  const artRows = split ? Math.min(12, Math.max(0, height - 10 - extraRows)) : 0;
  return { split, left, right: width - left - 1, waveRows, artRows };
}

/** A whole-track loudness envelope, not a pretend live spectrum. */
const WaveformPanel = memo(function WaveformPanel({ samples, width, height, fraction, palette }: {
  samples?: number[]; width: number; height: number; fraction: number; palette: PlayerPalette;
}) {
  const glyphs = " ▁▂▃▄▅▆▇█";
  return <Box flexDirection="column">{Array.from({ length: height }, (_, row) => <Text key={row}>
    {Array.from({ length: width }, (_, i) => {
      const sample = samples?.[Math.min(samples.length - 1, Math.floor(i * samples.length / width))] ?? 0;
      const fill = Math.max(0, Math.min(8, Math.round((sample * height - (height - row - 1)) * 8)));
      return <Text key={i} color={i / width < fraction ? palette.accent : RULE}>{glyphs[fill]}</Text>;
    })}
  </Text>)}</Box>;
});

export function NowPlaying({ embedded = false, onDownload = () => {} }: { embedded?: boolean; onDownload?: () => void }) {
  const store = useStore();
  const COLOR = playerPalette(store.config.playerTheme);
  const st = usePlayback(store.playback);
  const width = Math.max(10, embedded ? store.contentWidth : store.cols - 2);
  const height = store.listRows + 2;
  const layout = playerLayout(width, height);
  const inner = layout.left - 4;
  const file = st.track?.filePath;
  const source = st.track && isStream(st.track) ? st.track.thumbnailUrl : file;
  const [artVisible, setArtVisible] = useState(true);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [wave, setWave] = useState<{ file: string; data: Waveform | null }>();
  // App unmounts expanded player for help; hidden embedded views get region=help.
  const active = !embedded || store.region === "content";
  useInput(input => {
    if (store.captureMode === "text") return;
    if (input === "S" || (input === "/" && !lyricsVisible)) { setSearchVisible(true); return; }
    if (input === "b") setArtVisible(v => !v);
    if (input === "l") setLyricsVisible(v => !v);
    if (input === "T") store.setConfig({ ...store.config, playerTheme: store.config.playerTheme === "calm" ? "lavender" : "calm" });
    if (input === "V") store.setConfig({ ...store.config, reducedMotion: !(store.config.reducedMotion ?? true) });
  }, { isActive: active });
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    void loadWaveform(file, inner).then(data => { if (!cancelled) setWave({ file, data }); });
    return () => { cancelled = true; };
  }, [file, inner]);
  const samples = wave?.file === file ? wave?.data?.samples : undefined;
  const canTrack = st.engine === "mpv" && !st.loading;
  const fraction = canTrack && st.duration > 0 ? Math.max(0, Math.min(1, st.position / st.duration)) : 0;
  const progressWidth = Math.max(6, inner - 2);
  const at = Math.min(progressWidth - 1, Math.floor(fraction * progressWidth));
  const t = st.track;
  const live = isLive(t);
  const artRows = playerLayout(width, height, live, !!samples).artRows;
  const heading = <Box flexDirection="column" width={inner}>
    <Text color={COLOR.accent} bold wrap="truncate-end">{t ? cleanText(trackDisplayTitle(t)) : "Nothing playing"}</Text>
    <Box height={layout.split && live && height >= 26 ? 3 : 1} overflow="hidden"><Text color={COLOR.alt} wrap={layout.split && live && height >= 26 ? "wrap" : "truncate-end"}>{live ? cleanText(st.broadcastTitle || "Waiting for station song information") : t?.artist ? cleanText(t.artist) : t ? "Online audio" : "Library · 8 Discover · o Play URL"}</Text></Box>
    {layout.split ? <Text color={COLOR.muted} wrap="truncate-end">{t?.album ? cleanText(t.album) : t?.playlist ? cleanText(t.playlist) : " "}</Text> : null}
  </Box>;
  const details = <Box flexDirection="column" width={inner}>
    {layout.split && !live && samples ? <Box flexDirection="column">
      <Text color={COLOR.muted}>TRACK WAVEFORM</Text>
      <WaveformPanel samples={samples} width={inner} height={layout.waveRows} fraction={fraction} palette={COLOR} />
    </Box> : null}
    {live ? <Text color={COLOR.accent} wrap="truncate-end">LIVE · no seeking or restart</Text> : <Text color={RULE}>{"─".repeat(at)}<Text color={COLOR.accent}>●</Text>{"─".repeat(progressWidth - at - 1)}</Text>}
    <Box justifyContent="space-between">
      <Text color={COLOR.text} wrap="truncate-end">{live ? st.loading ? "Connecting…" : st.paused ? "Disconnected · space reconnects" : "On air · space disconnects" : st.engine === "mpv" ? `${formatDuration(st.position)} / ${st.duration > 0 ? formatDuration(st.duration) : "—"}` : "Progress needs mpv"}</Text>
      <Text color={COLOR.alt}>{st.engine === "mpv" ? `${st.volume}%` : ""}</Text>
    </Box>
    <Text color={COLOR.muted} wrap="truncate-end">{`${!t ? "Stopped" : st.loading ? "Loading" : st.paused ? "Paused" : "Playing"} · shuffle ${st.shuffle ? "on" : "off"} · repeat ${st.repeat}`}</Text>
    <Text color={st.error ? COLOR.warn : COLOR.muted} wrap="truncate-end">{st.error || (st.loading ? "Loading…" : st.engine === "external" && t ? "Playing in your default app" : t ? `${isStream(t) ? "Streaming · not in Library" : "Saved locally"}${st.preloading ? " · preparing next…" : st.nextReady ? " · next prepared" : ""}` : "m closes this screen")}</Text>
  </Box>;
  return <Box width={width} height={height} flexDirection={layout.split ? "row" : "column"}>
    <Box width={layout.left} height={layout.split ? undefined : 6} alignSelf="flex-start" borderStyle={layout.split ? "round" : undefined} borderColor={RULE} flexDirection="column" paddingX={1} flexShrink={0}>
      {layout.split ? <Box justifyContent="space-between"><Text bold color={COLOR.alt}>NOW PLAYING</Text><Text color={COLOR.muted}>{st.index >= 0 ? `${store.playback.queueEntries().findIndex(e => e.index === st.index) + 1}/${st.list.length}` : ""}</Text></Box> : null}
      {heading}
      {layout.split ? <Box alignItems="center" justifyContent="center" flexShrink={0}>
        <Cover source={source} cols={Math.min(inner, 32)} rows={artRows} visible={artVisible}
          fallback={<RadioFallback live={live} rows={artRows} palette={COLOR} simple={simpleArtwork()}
            animate={active && !st.paused && !st.loading && !!t && store.config.reducedMotion === false} />} />
      </Box> : null}
      {layout.split && height >= 23 ? <Box height={1} /> : null}
      {details}
      {layout.split && height >= 23 ? <Text color={COLOR.muted} wrap="truncate-end">T {store.config.playerTheme === "calm" ? "Calm" : "Lavender"} · Art {simpleArtwork() ? "simple" : graphicsPainter ? graphicsProtocol === "iterm" ? "iTerm2" : "Kitty" : "text fallback"}</Text> : null}
    </Box>
    <Box flexDirection="column" marginLeft={layout.split ? 1 : 0} width={layout.split ? layout.right : width} height={layout.split ? height : Math.max(3, height - 6)}>
      <Box display={lyricsVisible || searchVisible ? "none" : "flex"}>
        <ListeningQueue height={(layout.split ? height : Math.max(3, height - 6)) - 1} width={layout.split ? layout.right : width} active={active && !lyricsVisible && !searchVisible} framed />
      </Box>
      {lyricsVisible ? <Box display={searchVisible ? "none" : "flex"}><LyricsPanel height={(layout.split ? height : Math.max(3, height - 6)) - 1} width={layout.split ? layout.right : width} active={active && !searchVisible} /></Box> : null}
      {!searchVisible ? <Text color={COLOR.alt} wrap="truncate-end">S Search · l: local / s: songs / v: videos</Text> : null}
      {searchVisible ? <PlayerSearch height={layout.split ? height : Math.max(3, height - 6)} width={layout.split ? layout.right : width}
        active={active} onClose={() => setSearchVisible(false)} onDownload={onDownload} /> : null}
    </Box>
  </Box>;
}
