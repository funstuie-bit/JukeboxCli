import { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { PresetImport } from "./PresetImport";
import { listImportedPacks, type ImportedPack } from "../../player/import-preset-pack";
import { SelectField } from "./FormHelpers";
import { creamInstalled, installCreamPack, downloadedPackInstalled, installPresetPack, DOWNLOADABLE_PACKS, type DownloadablePack, PRESET_PACKS, presetPackLabel, type PresetPack } from "../../player/linux-preset-packs";

export function PresetPacks({ selected, focused, onSelect, onBack, onTextMode = () => {} }: {
  selected: PresetPack; focused: boolean; onSelect: (pack: PresetPack) => void; onBack: () => void; onTextMode?: (text: boolean) => void;
}) {
  const [installed, setInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<DownloadablePack | null>(null);
  const [extras, setExtras] = useState<DownloadablePack[]>([]);
  const [imports, setImports] = useState<ImportedPack[]>([]);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");
  const guard = useRef(false);
  useEffect(() => { let active = true; void creamInstalled().then(value => { if (active) { setInstalled(value); setLoading(false); } }); return () => { active = false; }; }, []);

  useEffect(() => { void listImportedPacks().then(setImports); void Promise.all(DOWNLOADABLE_PACKS.filter(p => p !== "cream-of-the-crop").map(async p => await downloadedPackInstalled(p) ? p : null)).then(p => setExtras(p.filter(v => v !== null))); }, []);
  const download = async () => {
    if (!confirm) return;
    const pack = confirm;
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      if (pack === "cream-of-the-crop") { await installCreamPack(setStatus); setInstalled(true); }
      else { await installPresetPack(pack, setStatus); setExtras(previous => [...previous, pack]); }
      onSelect(pack);
      setStatus(`${presetPackLabel(pack)} installed and selected. Close fullscreen, then press F again.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { guard.current = false; setBusy(false); setConfirm(null); }
  };
  if (importing) return <PresetImport focused={focused} onTextMode={onTextMode} onBack={() => setImporting(false)} onInstalled={pack => { setImports(p => [...p, pack]); onSelect(pack.id); setImporting(false); }} />;
  return <Box flexDirection="column">
    <Text>Active: {imports.find(p => p.id === selected)?.name ?? presetPackLabel(selected)}</Text>
    <Text>Classic is included with projectM. Extra packs download only when chosen.</Text>
    <Text>Some presets need newer renderers; press Ctrl+R in projectM to skip one.</Text>
    {status ? <Text>{status}</Text> : null}
    {busy || loading ? <Text>{busy ? "Installing… Keep JukeboxCli open." : "Checking installed packs…"}</Text> :
      confirm ? <SelectField key="confirm" focused={focused} title={`Download ${presetPackLabel(confirm)} and textures (${confirm === "cream-of-the-crop" ? "~14 MB download, ~140 MB disk" : confirm === "en-d" ? "~6 MB download" : "~4 MB download"})?`}
        options={[{ label: "Back", value: "back" }, { label: "Download and select", value: "download" }]}
        onSelect={value => { if (value === "download") void download(); else setConfirm(null); }} onCancel={() => setConfirm(null)} /> :
        <SelectField key={`packs-${installed}-${selected}`} focused={focused} title="MilkDrop packs"
          options={[
            ...PRESET_PACKS.filter(p => p === "classic" || ((p === "combined" || p === "cream-of-the-crop") && installed) || extras.includes(p as DownloadablePack)).map(p => ({ label: `${presetPackLabel(p)}${p === selected ? " · selected" : ""}`, value: p })),
            ...(!installed ? [{ label: "Download Cream of the Crop…", value: "download" }] : []),
            ...DOWNLOADABLE_PACKS.filter(p => p !== "cream-of-the-crop" && !extras.includes(p)).map(p => ({ label: `Download ${presetPackLabel(p)}…`, value: `download:${p}` })),
            ...imports.map(p => ({ label: `${p.name}${p.id === selected ? " · selected" : ""}`, value: p.id })),
            { label: "Import ZIP or folder…", value: "import" },
            { label: "Back", value: "back" },
          ]} onSelect={value => {
            if (value === "download") setConfirm("cream-of-the-crop");
            else if (value.startsWith("download:")) setConfirm(value.slice(9) as DownloadablePack);
            else if (value === "import") setImporting(true);
            else if (value === "back") onBack();
            else { onSelect(value as PresetPack); setStatus("Selected. Close any open fullscreen window, then press F again."); }
          }} onCancel={onBack} />}
  </Box>;
}
