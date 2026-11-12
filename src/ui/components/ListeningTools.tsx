import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { usePlayback, useStore } from "../store";
import { usePalette } from "../palette";
import { audioDetailsLabel, EQ_BANDS, EQ_PRESETS, validEqualizer } from "../../player/audio-tools";
import { MouseRow } from "./MouseRow";
export function ListeningTools({ close }: { close: () => void }) {
  const s = useStore(), st = usePlayback(s.playback), C = usePalette();
  const [eq, setEq] = useState(() => validEqualizer(s.config.equalizer));
  const [minutes, setMinutes] = useState(30), [row, setRow] = useState(0), [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const presets = Object.entries(EQ_PRESETS);
  const timerPresets = [15,30,60,90];
  const timer = (mode: "minutes" | "track" | "album" | "off") => { s.playback.setSleepTimer(mode, minutes); setError(""); };
  const choices = [
    { label: `Sleep after ${minutes} minutes · ←/→ change`, run: () => timer("minutes") },
    ...timerPresets.map(value=>({label:`Sleep preset: ${value} minutes`,run:()=>{s.playback.setSleepTimer("minutes",value);setMinutes(value);setError("");}})),
    { label: "Sleep at end of track", run: () => timer("track") },
    { label: "Sleep at end of album", run: () => timer("album") },
    { label: "Cancel sleep timer", run: () => timer("off") },
    { label: `EQ: ${eq.enabled ? "ON" : "bypassed"} · unsaved draft`, run: () => setEq(v => ({ ...v, enabled: !v.enabled })) },
    ...presets.map(([name, gains]) => ({ label: `Preset: ${name}`, run: () => setEq({ enabled: name !== "Flat", gains: [...gains] }) })),
    ...EQ_BANDS.map((hz, i) => ({ label: `${hz >= 1000 ? `${hz / 1000}k` : hz} Hz: ${eq.gains[i]} dB · ←/→`, run: () => {} })),
    { label: "Save EQ (Flat bypasses all EQ filters)", run: async () => { await s.playback.setEqualizer(eq); s.setConfig({ ...s.config, equalizer: eq }); setError("Saved equaliser"); } },
    { label: `Low-power visuals: ${s.config.lowPower ? "ON" : "off"}`, run: () => s.setConfig({ ...s.config, lowPower: !s.config.lowPower }) },
    { label: `Pause for system sleep: ${s.config.lifecycle === false ? "off" : "ON"}`, run: () => s.setConfig({ ...s.config, lifecycle: s.config.lifecycle === false }) },
    { label: `Download-size estimates: ${s.config.downloadEstimates ? "ON" : "off"} (extra lookup)`, run: () => s.setConfig({ ...s.config, downloadEstimates: !s.config.downloadEstimates }) },
    { label: confirmClear ? "Confirm clear resume points? Enter clears; Esc cancels" : "Clear resume points… (music/history stays)", run: () => { if (confirmClear) { s.history.clearProgress(); setConfirmClear(false); } else setConfirmClear(true); } },
  ];
  const run = (i: number) => { setRow(i); void Promise.resolve().then(() => choices[i]?.run()).catch(e => setError(e instanceof Error ? e.message : "Action failed")); };
  useInput((input, key) => {
    if (key.escape) { if (confirmClear) setConfirmClear(false); else close(); return; }
    if (key.upArrow || key.downArrow) setRow(i => Math.max(0, Math.min(choices.length - 1, i + (key.upArrow ? -1 : 1))));
    if (key.return) run(row);
    if (key.leftArrow || key.rightArrow) {
      const delta = key.rightArrow ? 1 : -1;
      if (row === 0) setMinutes(v => Math.max(1, Math.min(1440, v + delta * (key.shift ? 5 : 1))));
      const band = row - 5 - timerPresets.length - presets.length;
      if (band >= 0 && band < 10) setEq(v => ({ ...v, gains: v.gains.map((n, i) => i === band ? Math.max(-12, Math.min(12, n + delta)) : n) }));
    }
  });
  const slots = Math.max(1, s.listRows - 6), start = Math.max(0, row - slots + 1);
  return <Box width={Math.max(15, s.cols - 4)} flexDirection="column">
    <Text bold color={C.accent}>Listening tools · EQ changes apply only on Save</Text>
    <Text color={C.muted} wrap="truncate-end">{audioDetailsLabel(st.audioDetails)}</Text>
    <Text color={C.alt} wrap="truncate-end">{st.sleepTimer ? `Timer: ${st.sleepTimer.mode} ${st.sleepTimer.remaining === undefined ? "" : `${st.sleepTimer.remaining}s remaining`}` : "Timer off"} · {s.lifecycleStatus ?? "Platform events not active"}</Text>
    {choices.slice(start, start + slots).map((item, i) => <MouseRow key={start + i} active allowDuringMenu onClick={() => run(start + i)}><Text color={row === start + i ? C.accent : C.text} wrap="truncate-end">{row === start + i ? "› " : "  "}{item.label}</Text></MouseRow>)}
    <Text color={C.warn} wrap="truncate-end">{error || "EQ boosts reserve headroom; no bit-perfect or universal clipping guarantee."}</Text>
    <Text color={C.muted}>↑↓ choose · Enter apply · ←→ adjust · Esc back</Text>
  </Box>;
}
