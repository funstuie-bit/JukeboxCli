import { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { SelectField } from "./FormHelpers";
import { creamInstalled, installCreamPack, PRESET_PACKS, presetPackLabel, type PresetPack } from "../../player/linux-preset-packs";

export function PresetPacks({ selected, focused, onSelect, onBack }: {
  selected: PresetPack; focused: boolean; onSelect: (pack: PresetPack) => void; onBack: () => void;
}) {
  const [installed, setInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState("");
  const guard = useRef(false);
  useEffect(() => { let active = true; void creamInstalled().then(value => { if (active) { setInstalled(value); setLoading(false); } }); return () => { active = false; }; }, []);

  const download = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      await installCreamPack(setStatus);
      setInstalled(true); onSelect("cream-of-the-crop");
      setStatus("Cream of the Crop installed and selected. Close fullscreen, then press F again.");
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { guard.current = false; setBusy(false); setConfirm(false); }
  };
  return <Box flexDirection="column">
    <Text>Active: {presetPackLabel(selected)}</Text>
    <Text>Classic is included with projectM. Extra packs download only when chosen.</Text>
    <Text>Some presets need newer renderers; press Ctrl+R in projectM to skip one.</Text>
    {status ? <Text>{status}</Text> : null}
    {busy || loading ? <Text>{busy ? "Installing… Keep JukeboxCli open." : "Checking installed packs…"}</Text> :
      confirm ? <SelectField key="confirm" focused={focused} title="Download Cream of the Crop and textures (~14 MB download, ~140 MB disk)?"
        options={[{ label: "Back", value: "back" }, { label: "Download and select", value: "download" }]}
        onSelect={value => { if (value === "download") void download(); else setConfirm(false); }} onCancel={() => setConfirm(false)} /> :
        <SelectField key={`packs-${installed}-${selected}`} focused={focused} title="MilkDrop packs"
          options={[
            ...PRESET_PACKS.filter(p => p === "classic" || installed).map(p => ({ label: `${presetPackLabel(p)}${p === selected ? " · selected" : ""}`, value: p })),
            ...(!installed ? [{ label: "Download Cream of the Crop…", value: "download" }] : []),
            { label: "Back", value: "back" },
          ]} onSelect={value => {
            if (value === "download") setConfirm(true);
            else if (value === "back") onBack();
            else { onSelect(value as PresetPack); setStatus("Selected. Close any open fullscreen window, then press F again."); }
          }} onCancel={onBack} />}
  </Box>;
}
