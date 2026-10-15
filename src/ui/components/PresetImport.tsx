import { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { TextField } from "./TextField";
import { SelectField } from "./FormHelpers";
import { useActionInput } from "../hooks/useActionInput";
import { expandTilde, cleanText } from "../../util/format";
import { previewPresetImport, commitPresetImport, discardPresetImport, type PackPreview, type ImportedPack } from "../../player/import-preset-pack";

export function PresetImport({ focused, onBack, onInstalled, onTextMode }: {
  focused: boolean; onBack: () => void; onInstalled: (pack: ImportedPack) => void; onTextMode: (text: boolean) => void;
}) {
  const [preview, setPreview] = useState<PackPreview>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const staged = useRef<PackPreview | undefined>(undefined), alive = useRef(true), guard = useRef(false);
  useEffect(() => { onTextMode(!preview); return () => onTextMode(false); }, [!!preview, onTextMode]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (staged.current) void discardPresetImport(staged.current); }; }, []);
  useActionInput((_, key) => { if (key.escape && !busy && !preview) onBack(); }, { isActive: focused });
  const submit = async (file: string) => {
    if (guard.current || !file.trim()) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const p = await previewPresetImport(expandTilde(file.trim()));
      if (!alive.current) { await discardPresetImport(p); return; }
      staged.current = p; setPreview(p);
    } catch (e) { if (alive.current) setError(cleanText(String(e))); }
    finally { guard.current = false; if (alive.current) setBusy(false); }
  };
  const install = async () => {
    if (!preview || guard.current) return;
    guard.current = true; setBusy(true);
    try { const pack = await commitPresetImport(preview); staged.current = undefined; if (alive.current) onInstalled(pack); }
    catch (e) { setError(cleanText(String(e))); }
    finally { guard.current = false; if (alive.current) setBusy(false); }
  };
  return <Box flexDirection="column">
    <Text>Import a ZIP or folder · Esc back · source files stay in place.</Text>
    {error ? <Text>{error}</Text> : null}
    {!preview ? <TextField placeholder="Full path to ZIP or folder…" isDisabled={!focused || busy} onSubmit={v => { void submit(v); }} /> : <>
      <Text>{preview.name}: {preview.presets} presets · {preview.textures} textures · {(preview.bytes / 1048576).toFixed(1)} MiB</Text>
      <Text wrap="truncate-end">Examples: {preview.names.join(", ")}</Text>
      <Text>Only presets, textures and notices are installed. Preset compatibility varies.</Text>
      {!busy ? <SelectField title="Install this pack?" focused={focused} options={[{ label: "Back", value: "back" }, { label: "Install and select", value: "install" }]}
        onCancel={onBack} onSelect={v => { if (v === "install") void install(); else onBack(); }} /> : null}
    </>}
    {busy ? <Text>Preparing pack…</Text> : null}
  </Box>;
}
