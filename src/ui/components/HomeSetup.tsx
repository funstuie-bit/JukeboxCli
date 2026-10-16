import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useStore, type SettingsPage } from "../store";
import { SettingsChoices } from "./SettingsChoices";
import { useActionInput } from "../hooks/useActionInput";
import { appearancePalette } from "../appearance";
import { macVisualizerInstalled, macVisualizerSupported } from "../../player/macos-visualizer-install";

/** Read installed-file metadata only. No process launch, download or permissions prompt. */
export function useMacPackStatus() {
  const [installed, setInstalled] = useState<boolean>();
  const supported = macVisualizerSupported();
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void macVisualizerInstalled().then(value => { if (active) setInstalled(value); }).catch(() => { if (active) setInstalled(false); });
    return () => { active = false; };
  }, [supported]);
  return { supported, installed };
}

export function HomeSetup({ firstRun, onBack, onSettings }: { firstRun: boolean; onBack: () => void; onSettings: (page: SettingsPage) => void }) {
  const s = useStore();
  const C = appearancePalette(s.config.playerTheme, s.config.appearance);
  const { supported, installed } = useMacPackStatus();
  const [value, setValue] = useState("click");
  const focused = firstRun || s.region === "content";
  const height = Math.max(8, s.listRows);
  useEffect(() => {
    if (!focused) return;
    s.setCaptureMode("picker");
    return () => s.setCaptureMode("none");
  }, [focused, s.setCaptureMode]);
  useActionInput((_input, key) => { if (key.escape) onBack(); }, { isActive: focused });
  const options = [
    { value: "click", label: `${s.config.mouseMode === "click" ? "✓" : "○"} Mouse clicks: left plays, right opens actions` },
    { value: "wheel", label: `${s.config.mouseMode === "wheel" || !s.config.mouseMode ? "✓" : "○"} Wheel only: scroll without taking normal text selection` },
    { value: "off", label: `${s.config.mouseMode === "off" ? "✓" : "○"} Keyboard only: no mouse capture` },
    { value: "colours", label: `Artwork colours: ${s.config.artworkColours ? "on" : "off"} · match Home and Player to the cover` },
    { value: "motion", label: `Decorative motion: ${s.config.reducedMotion === false ? "on" : "off"} · jukebox lights while playing` },
    { value: "appearance", label: "Themes, layout and terminal visualiser…" },
    ...(supported ? [{ value: "projectm", label: `projectM fullscreen pack: ${installed === undefined ? "checking…" : installed ? "installed · manage / repair…" : "optional · review and install…"}` }]
      : process.platform === "linux" ? [{ value: "projectm", label: "projectM fullscreen effects: optional · setup details…" }] : []),
    { value: "cookies", label: "Browser cookies: optional · public playback can work without them" },
    { value: "dismiss", label: "Hide the Home setup checklist (u reopens this page)" },
    { value: "back", label: firstRun ? "Back to listening choices" : "Back to Home" },
  ];
  const selected = options.find(o => o.value === value)?.label ?? "";
  const detail = value === "click" ? "Shift-drag selects terminal text when clicks are enabled."
    : value === "projectm" ? "Separate effects window; never needed for music or the terminal visualiser."
    : value === "cookies" ? "Opening this page does not read browser cookies. Choose them only if needed."
    : value === "dismiss" ? "All of this remains available through u on Home and 9 Settings."
    : "Your choice saves immediately. Existing preferences are never changed automatically.";
  return <Box width={Math.max(8, firstRun ? s.cols - 2 : s.contentWidth)} height={height} flexDirection="column">
    <Text bold color={C.accent} wrap="truncate-end">SETUP & EXTRAS · nothing here is required to listen</Text>
    {height >= 14 ? <Text color={C.muted} wrap="truncate-end">Choose the controls and look you want. Optional installs ask first.</Text> : null}
    <SettingsChoices title="Make it yours" focused={focused} height={Math.max(3, height - (height >= 14 ? 6 : 4))}
      value={value} onFocus={setValue} options={options} onSelect={choice => {
        if (["click", "wheel", "off"].includes(choice)) s.setConfig({ ...s.config, mouseMode: choice as "click" | "wheel" | "off" });
        else if (choice === "colours") s.setConfig({ ...s.config, artworkColours: !s.config.artworkColours });
        else if (choice === "motion") s.setConfig({ ...s.config, reducedMotion: s.config.reducedMotion === false });
        else if (choice === "appearance") onSettings("appearance");
        else if (choice === "projectm") onSettings(supported ? "visualizer-install" : "appearance");
        else if (choice === "cookies") onSettings("cookies");
        else if (choice === "dismiss") { s.setConfig({ ...s.config, homeSetupDismissed: true }); onBack(); }
        else onBack();
      }} />
    {height >= 14 ? <><Text color={C.alt} wrap="truncate-end">{detail}</Text><Text color={C.muted} wrap="truncate-end">{selected}</Text></> : null}
    <Text color={C.muted} wrap="truncate-end">Esc back · ↑↓/Pg choose · Enter apply/open</Text>
  </Box>;
}
