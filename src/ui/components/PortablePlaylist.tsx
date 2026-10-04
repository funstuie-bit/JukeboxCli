import { useState } from "react";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { useStore } from "../store";
import { TextField } from "./TextField";
import { readPlaylist, writePlaylist, type PlaylistPreview } from "../../library/portable-playlist";
import { expandTilde, cleanText, displayPath } from "../../util/format";
import { COLOR } from "../theme";
import type { PlayableTrack } from "../../player/media";

export function PortablePlaylist({ mode, tracks, focused, onBack }: {
  mode: "import" | "export"; tracks?: readonly PlayableTrack[]; focused: boolean; onBack: () => void;
}) {
  const { library, config, playback, listRows } = useStore();
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  useInput((input, key) => {
    if (key.escape) onBack();
    if (preview && !done && (input === "A" || input === "P")) {
      playback.enqueueMany(preview.tracks, input === "P");
      setDone(true); setNote(`${preview.tracks.length} entries queued. No downloads or automatic playback.`);
    }
  }, { isActive: focused && !busy });
  const submit = async (value: string) => {
    if (!value.trim() || busy) return;
    setBusy(true); setNote("");
    try {
      const file = expandTilde(value.trim());
      if (mode === "import") setPreview(await readPlaylist(file, library.all(), config.libraryDir));
      else {
        const omitted = await writePlaylist(file, tracks ?? playback.getState().list, config.libraryDir);
        setNote(`Saved ${displayPath(file)}${omitted ? ` · ${omitted} outside-library/invalid entries omitted` : ""}`); setDone(true);
      }
    } catch (error) { setNote(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <Box flexDirection="column">
    <Text bold color={COLOR.alt}>{mode === "import" ? "Import playlist" : "Export playlist"} · Esc back</Text>
    <Text wrap="truncate-end">JSON / M3U · local paths are relative to your music folder.</Text>
    <Text color={COLOR.warn} wrap="truncate-end">Exports include track names and full stream URLs. Review before sharing.</Text>
    {!preview && !done ? <TextField isDisabled={!focused || busy} placeholder="Full playlist filename…" onSubmit={v => { void submit(v); }} /> : null}
    {preview ? <>
      <Text>{preview.tracks.length}/{preview.total} available · {preview.missing} missing · {preview.invalid} unsupported</Text>
      <Text color={COLOR.alt}>A Append · P Queue next · missing/unsupported entries are skipped</Text>
      {preview.tracks.slice(0, Math.max(0, listRows - 8)).map((t, i) => <Text key={i} wrap="truncate-end">{i + 1}. {cleanText(t.title)}</Text>)}
    </> : null}
    <Text color={COLOR.good} wrap="truncate-middle">{busy ? "Working…" : note ? cleanText(note) : " "}</Text>
  </Box>;
}
