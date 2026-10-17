// Read-only, real-terminal Home artwork acceptance. No playback or profile writes.
// npx tsx scripts/visual-home-art.tsx /path/to/image [...] [--auto]
import { useEffect, useState } from "react";
import { Box, Text, render, useApp, useInput, useStdout } from "ink";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.JUKEBOXCLI_HOME = mkdtempSync(path.join(tmpdir(), "jukeboxcli-home-art-"));
const { Home } = await import("../src/ui/sections/Home");
const { StoreContext } = await import("../src/ui/store");
const { defaultConfig } = await import("../src/config/config");
const { makeFakeLibrary, makeFakePlayback, makeStore, PLACEHOLDER_TRACKS } = await import("./fake-data");
const graphics = await import("../src/player/graphics");
const { enableGraphics, probeGraphics, createGraphicsRenderer } = graphics;
const { ensureFfmpeg } = await import("../src/bin/ffmpeg-fetch");

const sources = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
if (!sources.length) throw Error("Pass local image paths; this fixture never downloads media or starts playback.");
process.env.JUKEBOXCLI_SYSTEM_TOOLS = "1";
await ensureFfmpeg(); // Require installed tools; never bootstrap a tool download in this fixture.
const native = await probeGraphics();
if (native) enableGraphics();
process.stdout.write("\x1b[?1049h\x1b[H\x1b]0;JukeboxCli Home artwork fixture\x07");
let phase = "home";
function Demo() {
  const { exit } = useApp(), { stdout } = useStdout();
  const [hidden, setHidden] = useState(false);
  const [size, setSize] = useState([stdout.columns, stdout.rows]);
  const [store] = useState(() => {
    const tracks = sources.map((filePath, i) => ({ ...PLACEHOLDER_TRACKS[0]!, id: `fixture:${i}`, filePath,
      title: `Fixture ${i + 1} · A long recent title should keep clear, separate thumbnails alongside the featured cover`, artist: "Read-only artwork fixture" }));
    const result = makeStore({ section: "home", config: { ...defaultConfig, reducedMotion: true, artworkColours: false },
      library: makeFakeLibrary(tracks), playback: makeFakePlayback({ track: null, list: [], paused: true }) });
    for (const track of [...tracks].reverse()) result.history.record(track);
    return result;
  });
  useInput((input, key) => { if (input === "q") exit(); if (input === "?" || key.escape) setHidden(value => !value); });
  useEffect(() => {
    const resize = () => setSize([stdout.columns, stdout.rows]); stdout.on("resize", resize);
    return () => { stdout.off("resize", resize); };
  }, [stdout]);
  useEffect(() => {
    if (!process.argv.includes("--auto")) return;
    const timers = [setTimeout(() => setHidden(true), 9000), setTimeout(() => setHidden(false), 13000), setTimeout(exit, 19000)];
    return () => timers.forEach(clearTimeout);
  }, [exit]);
  phase = hidden ? "help" : "home";
  return <StoreContext.Provider value={{ ...store, region: hidden ? "help" : "content", cols: size[0]!, contentWidth: size[0]! - 2, listRows: size[1]! - 3 }}>
    <Box flexDirection="column" paddingX={1}>
      <Text>Home artwork fixture · {native ? graphics.graphicsProtocol : "blocks"} · ? hide/show · q quit</Text>
      <Box display={hidden ? "none" : "flex"}><Home /></Box>
      {hidden ? <Box height={size[1]! - 3}><Text>HELP — every cover must be absent. Press ? to restore.</Text></Box> : null}
    </Box>
  </StoreContext.Provider>;
}
let app: ReturnType<typeof render> | undefined;
const renderer = createGraphicsRenderer(async () => {
  await app?.waitUntilRenderFlush();
}, () => graphics.graphicsPainter);
try {
  app = render(<Demo />, { incrementalRendering: true, onRender: () => {
    renderer.onRender();
    setImmediate(async () => {
      await app?.waitUntilRenderFlush();
      if (process.env.JUKEBOXCLI_VISUAL_REPORT) appendFileSync(process.env.JUKEBOXCLI_VISUAL_REPORT,
        JSON.stringify({ phase, native, protocol: native ? graphics.graphicsProtocol : "blocks", ...graphics.graphicsPainter?.status }) + "\n");
    });
  } });
  await app.waitUntilExit();
} finally { renderer.dispose(); graphics.graphicsPainter?.clear(); process.stdout.write("\x1b[?1049l"); }
