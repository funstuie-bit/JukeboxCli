// Generates documentation SVGs from current components at 80 columns.
// Uses fake-data.ts placeholders, not a real library or profile.
// See CONTRIBUTING.md for preview links and regeneration instructions.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React, { act } from "react";
import { render } from "ink-testing-library";
import { Box } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { StoreContext, type Store } from "../src/ui/store";
import { uiTheme, COLOR } from "../src/ui/theme";
import { Logo } from "../src/ui/components/Logo";
import { Rule } from "../src/ui/components/Rule";
import { HelpOverlay } from "../src/ui/components/HelpOverlay";
import { NowPlayingBar } from "../src/ui/components/NowPlayingBar";
import { Footer } from "../src/ui/components/Footer";
import { Sidebar } from "../src/ui/components/Sidebar";
import { Home } from "../src/ui/sections/Home";
import { HomeSetup } from "../src/ui/components/HomeSetup";
import { Library as LibrarySection } from "../src/ui/sections/Library";
import { footerHints } from "../src/ui/keymap";
import { ansiToSvg } from "./ansi-to-svg";
import { makeStore, makeFakePlayback, makeFakeLibrary, PLACEHOLDER_TRACKS } from "./fake-data";
import { saveStation } from "../src/player/stations";
import { trackFromUrl } from "../src/player/url";
import { loadCoverArt } from "../src/player/art";
import { ensureFfmpeg } from "../src/bin/ffmpeg-fetch";

const COLS = 80;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "preview");
mkdirSync(OUT_DIR, { recursive: true });

async function save(name: string, store: Store, node: React.ReactNode, cols = COLS): Promise<void> {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<></>);
    Object.defineProperty(view.stdout, "columns", {value:cols,configurable:true});
    view.rerender(
    <ThemeProvider theme={uiTheme}>
      <StoreContext.Provider value={store}>{node}</StoreContext.Provider>
    </ThemeProvider>,
    );
  });
  const frame = view.lastFrame() ?? "";
  await act(async () => view.unmount());
  if (!/\x1b\[/.test(frame)) {
    throw new Error(`${name}: frame has no ANSI colors (FORCE_COLOR didn't take)`);
  }
  const svg = ansiToSvg(frame, { cols, title: "JukeboxCli", ...(name === "home-dashboard" ? { bg: "#1e1e2e" } : {}) });
  writeFileSync(join(OUT_DIR, `${name}.svg`), svg);
  console.log(`preview/${name}.svg`);
}

// The first-run intro: logo and listening-first Home choices.
const welcomeStore = makeStore({
  rows: 36, contentWidth: 78,
  binaries: { ffmpeg: "", ffprobe: "", ytDlp: "", mpv: "mpv" },
  // No playlist on the staged track: the bar line fits 80 cols untruncated.
  // Fully played, so the progress bar shows the whole gradient ramp.
  playback: makeFakePlayback({
    track: { ...PLACEHOLDER_TRACKS[0]!, playlist: undefined },
    position: 73,
    duration: 97,
  }),
});
await save(
  "welcome",
  welcomeStore,
  <Box flexDirection="column" width={COLS} paddingX={1}>
    <Box>
      <Logo />
    </Box>
    <Rule width={COLS - 2} />
    <Box marginTop={1}>
      <Home firstRun />
    </Box>
  </Box>,
);

// The everyday view: sidebar, the library with group headers, and the player
// mid-song. Mirrors App.tsx's main chrome with fixture data.
const libraryStore = makeStore({
  playback: makeFakePlayback({
    track: { ...PLACEHOLDER_TRACKS[2]!, playlist: undefined },
    position: 96,
    duration: 251,
  }),
});
await save(
  "library",
  libraryStore,
  <Box flexDirection="column" width={COLS} paddingX={1}>
    <Box>
      <Logo />
    </Box>
    <Rule width={COLS - 2} />
    <Box height={14} marginTop={1}>
      <Sidebar />
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="bold"
        borderColor={COLOR.accent}
        borderTop={false}
        borderRight={false}
        borderBottom={false}
        paddingLeft={2}
      >
        <LibrarySection />
      </Box>
    </Box>
    <Box flexDirection="column">
      <Rule width={COLS - 2} />
      <NowPlayingBar />
      <Footer hints={footerHints("content", "library")} />
    </Box>
  </Box>,
);

// The `?` cheatsheet card on its own, for the generated documentation previews.
await save(
  "keys",
  makeStore({}),
  <Box flexDirection="column" width={COLS} paddingX={1}>
    <HelpOverlay />
  </Box>,
);

// Fictional, offline-only Home dashboard. The entry point isolated its profile.
saveStation("Night Shift Radio", "https://example.com/night-shift.mp3");
saveStation("Sunday Jazz", "https://example.com/sunday-jazz.mp3");
const homeStore = makeStore({ cols: 164, rows: 48, contentWidth: 132, listRows: 40,
  section: "home", region: "content", config: { ...libraryStore.config, mouseMode: "click" },
  playback: makeFakePlayback({track:null,list:[],index:-1,paused:true}) });
for (const t of PLACEHOLDER_TRACKS.slice(0, 3).reverse()) homeStore.history.record(t);
const online = {...trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk"),title:"Late Night Coding Mix",artist:"Demo Radio"};
homeStore.history.record(online);
// Procedural test cover, not a real artist/album. Stored only in the isolated profile.
const cover = join(process.env.JUKEBOXCLI_HOME!, "fixture-cover.ppm");
const heroCover = join(process.env.JUKEBOXCLI_HOME!, "fixture-hero.ppm");
const pixels = Buffer.alloc(96 * 96 * 3);
for (let y=0;y<96;y++) for(let x=0;x<96;x++) {
  const at=(y*96+x)*3, ring=Math.sin(Math.hypot(x-48,y-48)/4)>0;
  pixels.set(ring ? [90 + x, 80 + y, 205] : [30 + Math.floor(x/2), 35 + Math.floor(y/2), 95], at);
}
const ppm=Buffer.concat([Buffer.from("P6\n96 96\n255\n"), pixels]);
writeFileSync(cover, ppm);
writeFileSync(heroCover, ppm);
homeStore.playback = makeFakePlayback({track:{...PLACEHOLDER_TRACKS[3]!,filePath:heroCover},list:[],index:-1,paused:false});
homeStore.history.record({...PLACEHOLDER_TRACKS[0]!,filePath:cover});
homeStore.library = makeFakeLibrary(PLACEHOLDER_TRACKS.map(t=>t.id===PLACEHOLDER_TRACKS[0]!.id ? {...t,filePath:cover} : t));
// Warm the exact fixture decode so the render is settled before taking its SVG.
await ensureFfmpeg(); // system tools only; never download a preview dependency
if (!await loadCoverArt(cover,8,4)) throw Error("Could not decode the generated fixture cover with system ffmpeg.");
await loadCoverArt(heroCover,24,10);
await save("home-dashboard", homeStore, <Box flexDirection="column" width={164} paddingX={1}>
  <Logo /><Rule width={162} />
  <Box height={40} marginTop={1}><Sidebar /><Box paddingLeft={2} borderStyle="single" borderTop={false} borderBottom={false} borderRight={false} borderColor={COLOR.muted}><Home /></Box></Box>
  <Rule width={162} /><NowPlayingBar /><Footer hints={footerHints("content","home")} />
</Box>, 164);
await save("home-setup", homeStore, <Box width={132}><HomeSetup firstRun={false} onBack={()=>{}} onSettings={()=>{}} /></Box>, 164);
