// Isolated, network-free visual fixture. Invented enhanced LRC; no audio playback.
// FORCE_COLOR=3 npx tsx scripts/visual-lyrics.tsx [--auto]
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useEffect, useState } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-lyric-visual-"));
process.env.JUKEBOXCLI_HOME = profile;
const { makeStore, makeFakePlayback } = await import("./fake-data");
const { StoreContext } = await import("../src/ui/store");
const { LyricsPanel } = await import("../src/ui/components/LyricsPanel");
const filePath = path.join(profile, "fixture.wav");
const phrases = ["A quiet evening in the listening room", "A small light beside the window", "Turning another page of the day",
  "These are invented words for a screen test", "The current word follows its own timestamp", "A longer line wraps comfortably without losing the active word or changing the panel width",
  "The room is still and the music continues", "Another quiet evening in the listening room"];
const stamp = (s: number) => `00:${s.toFixed(2).padStart(5, "0")}`;
writeFileSync(filePath.replace(".wav", ".lrc"), phrases.map((phrase, i) =>
  `[${stamp(i * 5)}]` + phrase.split(" ").map((w, j, words) => `<${stamp(i * 5 + j * 5 / words.length)}> ${w}`).join(" ")).join("\n"));
function Demo() {
  const { exit } = useApp(), { stdout } = useStdout();
  const [position, setPosition] = useState(17), [size, setSize] = useState([stdout.columns || 100, stdout.rows || 30]);
  useEffect(() => {
    const resize = () => setSize([stdout.columns || 100, stdout.rows || 30]);
    stdout.on("resize", resize);
    const timer = setInterval(() => setPosition(p => p >= 38 ? 0 : p + 0.2), 200);
    const end = process.argv.includes("--auto") ? setTimeout(exit, 6000) : undefined;
    return () => { clearInterval(timer); clearTimeout(end); stdout.off("resize", resize); };
  }, [exit, stdout]);
  useInput(input => { if (input === "q") exit(); });
  const track = { id: "fixture", title: "Invented fixture", artist: "No network", source: "local" as const, sourceTrackId: "fixture", addedAt: "2026-09-08", filePath };
  const store = makeStore({ playback: makeFakePlayback({ track, position }), config: { ...makeStore().config, lyricsOnline: false } });
  return <StoreContext.Provider value={store}><Box flexDirection="column">
    <Text>JukeboxCli · isolated lyric visual fixture · q exit</Text>
    <LyricsPanel width={size[0]!} height={Math.max(5, size[1]! - 2)} active />
  </Box></StoreContext.Provider>;
}
render(<Demo />);
