import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { scanGenres, type GenreProgress } from "../../library/genre";
import { useStore } from "../store";
import { COLOR } from "../theme";

export function GenreScan({ focused }: { focused: boolean }) {
  const { library } = useStore();
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<GenreProgress | null>(null);
  const [note, setNote] = useState("Enter starts scanning · c stops · Esc returns");
  useEffect(() => () => controller.current?.abort(), []);
  useInput((input, key) => {
    if (input === "c") controller.current?.abort();
    if (key.return && !controller.current) {
      const abort = new AbortController(); controller.current = abort; setBusy(true);
      setNote("Reading genre tags; your audio files are not modified.");
      void scanGenres(library, abort.signal, setProgress).then(result => {
        setProgress(result); setNote(abort.signal.aborted ? "Stopped. Completed updates are kept." : "Done. In Library, B cycles to genres. Untagged tracks remain Unknown genre.");
      }).finally(() => { controller.current = null; setBusy(false); });
    }
  }, { isActive: focused });
  return <Box flexDirection="column">
    <Text>Read existing genre tags with ffprobe. No network requests or audio changes.</Text>
    <Text color={COLOR.alt}>{busy ? "Scanning…" : "Ready"}</Text>
    {progress ? <Text>{progress.checked}/{progress.total} checked · {progress.updated} updated · {progress.failed} unreadable</Text> : null}
    <Text color={COLOR.muted}>{note}</Text>
  </Box>;
}
