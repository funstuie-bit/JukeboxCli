import { memo, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { usePlayback, useStore } from "../store";
import { loadWaveform, type Waveform } from "../../player/art";
import { cleanText, formatDuration, trackDisplayTitle } from "../../util/format";
import { COLOR, RULE } from "../theme";
import { ListeningQueue } from "./ListeningQueue";
import { isLive, isStream } from "../../player/media";
import { Cover } from "../components/Cover";

export function playerLayout(width: number, height: number) {
  const split = width >= 86 && height >= 16;
  const left = split ? Math.min(62, Math.max(40, Math.floor(width * 0.38))) : width;
  const waveRows = height >= 26 ? 5 : height >= 19 ? 3 : 1;
  const artRows = split ? Math.max(3, height - 12 - waveRows) : 0;
  return { split, left, right: width - left - 1, waveRows, artRows };
}

/** A whole-track loudness envelope, not a pretend live spectrum. */
const WaveformPanel = memo(function WaveformPanel({ samples, width, height, fraction }: {
  samples?: number[]; width: number; height: number; fraction: number;
}) {
  const glyphs = " ▁▂▃▄▅▆▇█";
  return <Box flexDirection="column">{Array.from({ length: height }, (_, row) => <Text key={row}>
    {Array.from({ length: width }, (_, i) => {
      const sample = samples?.[Math.min(samples.length - 1, Math.floor(i * samples.length / width))] ?? 0;
      const fill = Math.max(0, Math.min(8, Math.round((sample * height - (height - row - 1)) * 8)));
      return <Text key={i} color={i / width < fraction ? COLOR.accent : RULE}>{glyphs[fill]}</Text>;
    })}
  </Text>)}</Box>;
});

export function NowPlaying({ embedded = false }: { embedded?: boolean }) {
  const store = useStore();
  const st = usePlayback(store.playback);
  const width = Math.max(10, embedded ? store.contentWidth : store.cols - 2);
  const height = store.listRows + 2;
  const layout = playerLayout(width, height);
  const inner = layout.left - 4;
  const file = st.track?.filePath;
  const source = st.track && isStream(st.track) ? st.track.thumbnailUrl : file;
  const [artVisible, setArtVisible] = useState(true);
  const [wave, setWave] = useState<{ file: string; data: Waveform | null }>();
  const active = !embedded || store.region === "content";
  useInput(input => { if (input === "b") setArtVisible(v => !v); }, { isActive: active });
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
  const details = <Box flexDirection="column" width={inner}>
    <Text color={COLOR.accent} bold wrap="truncate-end">{t ? cleanText(trackDisplayTitle(t)) : "Nothing playing"}</Text>
    <Text color={COLOR.alt} wrap="truncate-end">{live ? cleanText(st.broadcastTitle || "Live broadcast · current-song info when supplied") : t?.artist ? cleanText(t.artist) : t ? "Online audio" : "Library · 8 Discover · o Play URL"}</Text>
    {layout.split ? <Text color={COLOR.muted} wrap="truncate-end">{t?.album ? cleanText(t.album) : t?.playlist ? cleanText(t.playlist) : " "}</Text> : null}
    {layout.split ? <Box marginTop={1} flexDirection="column">
      <Text color={COLOR.muted}>{live ? "LIVE RADIO / BROADCAST" : samples ? "TRACK WAVEFORM" : t && isStream(t) ? "STREAM PROGRESS" : "PLAYBACK"}</Text>
      <WaveformPanel samples={samples} width={inner} height={layout.waveRows} fraction={fraction} />
    </Box> : null}
    {live ? <Text color={COLOR.accent} wrap="truncate-end">LIVE · no seeking or restart</Text> : <Text color={RULE}>{"─".repeat(at)}<Text color={COLOR.accent}>●</Text>{"─".repeat(progressWidth - at - 1)}</Text>}
    <Box justifyContent="space-between">
      <Text color={COLOR.text}>{live ? st.loading ? "Connecting…" : st.paused ? "Disconnected · space reconnects" : "space disconnects / reconnects" : st.engine === "mpv" ? `${formatDuration(st.position)} / ${st.duration > 0 ? formatDuration(st.duration) : "—"}` : "Progress needs mpv"}</Text>
      <Text color={COLOR.alt}>{st.engine === "mpv" ? `${st.volume}%` : ""}</Text>
    </Box>
    <Text color={COLOR.muted} wrap="truncate-end">{`${st.paused ? "Paused" : "Playing"} · shuffle ${st.shuffle ? "on" : "off"} · repeat ${st.repeat}`}</Text>
    <Text color={st.error ? COLOR.warn : COLOR.muted} wrap="truncate-end">{st.error || (st.loading ? "Loading…" : st.engine === "external" && t ? "Playing in your default app" : t ? `${isStream(t) ? "Streaming · not in Library" : "Saved locally"}${st.preloading ? " · preparing next…" : st.nextReady ? " · next prepared" : ""}` : "m closes this screen")}</Text>
  </Box>;
  return <Box width={width} height={height} flexDirection={layout.split ? "row" : "column"}>
    <Box width={layout.left} height={layout.split ? height : 6} borderStyle={layout.split ? "round" : undefined} borderColor={RULE} flexDirection="column" paddingX={1} flexShrink={0}>
      {layout.split ? <Box justifyContent="space-between"><Text bold color={COLOR.alt}>NOW PLAYING</Text><Text color={COLOR.muted}>{st.index >= 0 ? `${store.playback.queueEntries().findIndex(e => e.index === st.index) + 1}/${st.list.length}` : ""}</Text></Box> : null}
      {layout.split ? <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Cover source={source} cols={inner} rows={layout.artRows} visible={artVisible} />
      </Box> : null}
      {details}
    </Box>
    <Box marginLeft={layout.split ? 1 : 0} width={layout.split ? layout.right : width} height={layout.split ? height : Math.max(3, height - 6)}>
      <ListeningQueue height={layout.split ? height : Math.max(3, height - 6)} width={layout.split ? layout.right : width} active={active} framed />
    </Box>
  </Box>;
}
