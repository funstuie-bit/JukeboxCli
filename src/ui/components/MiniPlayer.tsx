import { Box, Text } from "ink";
import { usePlayback, useStore } from "../store";
import { usePalette } from "../palette";
import { cleanText, formatDuration } from "../../util/format";
import { isLive } from "../../player/media";
import { MouseRow } from "./MouseRow";
import { shortcutLabel } from "../shortcuts";
export function MiniPlayer({ close }: { close: () => void }) {
  const s = useStore(), st = usePlayback(s.playback), C = usePalette();
  return <Box width={Math.max(10, s.cols - 2)} flexDirection="column" height={3}>
    <Text color={C.accent} bold wrap="truncate-end">♫ {st.track ? `${cleanText(st.track.title)}${st.track.artist ? ` · ${cleanText(st.track.artist)}` : ""}` : "JukeboxCli · Nothing playing"}</Text>
    <Text color={C.text} wrap="truncate-end">{st.error || st.notice || (isLive(st.track) ? "LIVE · no seeking" : `${formatDuration(st.position)} / ${st.duration ? formatDuration(st.duration) : "—"}`)} · {st.volume}%{st.sleepTimer ? " · TIMER" : ""}</Text>
    <Box>
      <MouseRow active onClick={() => { void s.playback.togglePause(); }}><Text color={C.alt}>[{st.paused || !st.track ? "Play" : "Pause"}] </Text></MouseRow>
      {s.cols >= 45 ? <><MouseRow active onClick={() => { void s.playback.prev(); }}><Text color={C.alt}>[Prev] </Text></MouseRow><MouseRow active onClick={() => { void s.playback.next(); }}><Text color={C.alt}>[Next] </Text></MouseRow></> : null}
      <MouseRow active onClick={close}><Text color={C.alt} wrap="truncate-end">{s.rows < 12 || s.cols < 45 ? "Enlarge for full view" : "Z Back"}</Text></MouseRow>
      {s.cols >= 65 ? <Text color={C.muted}> · {shortcutLabel("space",s.config.keybindings)} play/pause · ^K Commands</Text> : null}
    </Box>
  </Box>;
}
