// Real-terminal visual fixture. No App boot, downloads, playback or library writes.
// FORCE_COLOR=3 npx tsx scripts/visual-player.tsx /path/to/audio-with-cover
import React, { useEffect, useState } from "react";
import { render, Box, Text, useInput, useStdout, useApp } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { makeStore, makeFakePlayback, PLACEHOLDER_TRACKS } from "./fake-data";
import { StoreContext } from "../src/ui/store";
import { NowPlaying } from "../src/ui/views/NowPlaying";
import { uiTheme, COLOR } from "../src/ui/theme";
import { probeGraphics, enableGraphics, graphicsPainter } from "../src/player/graphics";
import { appendFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Pass an audio file with embedded artwork (read-only).");
const native = await probeGraphics();
if (native) enableGraphics();
process.stdout.write("\x1b[?1049h\x1b[H\x1b]0;JukeboxCli Visual Test\x07");
function Demo() {
  const { stdout } = useStdout(); const { exit } = useApp();
  const [size, setSize] = useState([stdout.columns, stdout.rows]);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (process.argv[3] !== "--auto") return;
    const timers = [setTimeout(() => setHelp(true), 5000), setTimeout(() => setHelp(false), 8000), setTimeout(() => exit(), 12000)];
    return () => timers.forEach(clearTimeout);
  }, [exit]);
  useEffect(() => { const resize = () => setSize([stdout.columns, stdout.rows]); stdout.on("resize", resize); return () => { stdout.off("resize", resize); }; }, [stdout]);
  useInput((input, key) => { if (input === "q") exit(); if (input === "?" || key.escape) setHelp(v => !v); });
  const tracks = Array.from({ length: 30 }, (_, i) => ({ ...PLACEHOLDER_TRACKS[i % PLACEHOLDER_TRACKS.length]!, id: `visual:${i}` }));
  const track = { ...tracks[0]!, title: "Strings of Life", artist: "Derrick May", album: "Visual acceptance · real embedded cover", filePath: file! };
  tracks[0] = track;
  const store = makeStore({ cols: size[0]!, contentWidth: size[0]! - 2, rows: size[1]!, listRows: size[1]! - 6, region: help ? "help" : "content",
    playback: makeFakePlayback({ track, list: tracks, index: 0, duration: 362, position: 83, shuffle: false, repeat: "off" }) });
  return <ThemeProvider theme={uiTheme}><StoreContext.Provider value={store}>
    <Box flexDirection="column" paddingX={1}>
      <Text color={COLOR.accent}>JukeboxCli · visual fixture · {native ? "Kitty image protocol confirmed" : "block fallback"}</Text>
      <Box display={help ? "none" : "flex"}><NowPlaying embedded /></Box>
      {help ? <Box height={size[1]! - 4}><Text color={COLOR.text}>HELP — artwork must be absent here. Press ? to return.</Text></Box> : null}
      <Text color={COLOR.muted}>b artwork · ? hide/show view · q close fixture · resize this window</Text>
    </Box>
  </StoreContext.Provider></ThemeProvider>;
}
try {
  const app = render(<Demo />, { onRender: () => { setImmediate(() => {
    graphicsPainter?.paint();
    if (process.env.JUKEBOXCLI_VISUAL_REPORT) appendFileSync(process.env.JUKEBOXCLI_VISUAL_REPORT,
      JSON.stringify({ native, ...graphicsPainter?.status }) + "\n");
  }); } });
  await app.waitUntilExit();
} finally { graphicsPainter?.clear(); process.stdout.write("\x1b[?1049l"); }
