// Manual end-to-end check (not published). Renders the full-screen Now
// Playing view against a REAL library file: real embedded cover art and a
// real waveform through the bundled ffmpeg, via the view's own code path.
// FORCE_COLOR must be set on the command line (ESM hoists imports ahead of
// any in-file assignment, and chalk decides color support at import time):
//   FORCE_COLOR=3 npx tsx scripts/smoke-nowplaying.tsx [file.opus]
// Prints the ANSI frame to preview/nowplaying-smoke.txt.

import { writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { render } from "ink-testing-library";
import { ThemeProvider } from "@inkjs/ui";
import { StoreContext, type Store } from "../src/ui/store";
import { uiTheme } from "../src/ui/theme";
import { NowPlaying } from "../src/ui/views/NowPlaying";
import { loadCoverArt, loadWaveform } from "../src/player/art";
import { makeStore, makeFakePlayback } from "./fake-data";
import type { Track } from "../src/library/types";

const HERE = dirname(fileURLToPath(import.meta.url));

/** First audio file under ~/Music/soundcli (arg picks a specific one). */
function findFirstFile(): string {
  const root = join(process.env.HOME ?? "~", "Music", "soundcli");
  const walk = (dir: string): string | null => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        const hit = walk(p);
        if (hit) return hit;
      } else if (/\.(opus|mp3|m4a|flac|ogg|wav)$/i.test(name)) {
        return p;
      }
    }
    return null;
  };
  const found = walk(root);
  if (!found) throw new Error(`no audio file under ${root}; pass one as arg`);
  return found;
}

const file = process.argv[2] ?? findFirstFile();
console.log("file:", file);

const track: Track = {
  id: "smoke:track",
  source: "local",
  sourceTrackId: "smoke",
  title: "Smoke Test Track",
  artist: "Real File",
  durationSec: 187,
  filePath: file,
  addedAt: new Date().toISOString(),
};

const store: Store = makeStore({
  playback: makeFakePlayback({
    track,
    list: [track],
    index: 0,
    position: 74,
    duration: 187,
  }),
});

// Direct loader verification (what the view calls under the hood).
const t0 = Date.now();
const [art, wave] = await Promise.all([
  loadCoverArt(file, 24, 12),
  loadWaveform(file, 64),
]);
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `extraction: cover=${art ? `${art.cols}x${art.rows} cells, brightness ${art.brightness.toFixed(2)}` : "null"}; ` +
    `waveform=${wave ? `${wave.samples.length} buckets, peak ${Math.max(...wave.samples).toFixed(2)}` : "null"}; ${dt}s`,
);

const { lastFrame, unmount } = render(
  <ThemeProvider theme={uiTheme}>
    <StoreContext.Provider value={store}>
      <NowPlaying />
    </StoreContext.Provider>
  </ThemeProvider>,
);

// Give the view's effect a tick to paint with the cached extractions.
await new Promise((r) => setTimeout(r, 300));
const frame = lastFrame() ?? "";
unmount();

mkdirSync(join(HERE, "..", "preview"), { recursive: true });
const out = join(HERE, "..", "preview", "nowplaying-smoke.txt");
writeFileSync(out, frame);
console.log(`frame: ${frame.split("\n").length} rows → ${out}`);
if (!/\x1b\[/.test(frame)) {
  throw new Error("no ANSI colors — run with FORCE_COLOR=3");
}
if (!frame.includes("Smoke Test Track")) {
  throw new Error("view did not render the title");
}
console.log("OK: colors present, title rendered");
