import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useStore } from "../store";
import { TextField } from "../components/TextField";
import { COLOR } from "../theme";
import { cleanText } from "../../util/format";
import { trackFromUrl } from "../../player/url";
import { readStations, removeStation, saveStation, stationTrack, type Station } from "../../player/stations";
import type { StreamTrack } from "../../player/media";

/** Listening is deliberately separate from Download and the saved library. */
export function Listen() {
  const { region, setCaptureMode, playback, listRows, contentWidth, openUrlRequest, setOpenUrlRequest } = useStore();
  const focused = region === "content";
  const [loaded] = useState(() => {
    try { return { stations: readStations(), error: "" }; }
    catch (e) { return { stations: [] as Station[], error: (e as Error).message }; }
  });
  const [stations, setStations] = useState(loaded.stations);
  const [notice, setNotice] = useState(loaded.error);
  const [draft, setDraft] = useState<StreamTrack | null>(null);
  const [mode, setMode] = useState<"list" | "url" | "radio" | "name" | "remove">(openUrlRequest ? "url" : "list");
  const [cursor, setCursor] = useState(0);
  const [target, setTarget] = useState<StreamTrack | null>(null);
  useEffect(() => { if (openUrlRequest) { setMode("url"); setNotice(""); setOpenUrlRequest?.(0); } }, [openUrlRequest, setOpenUrlRequest]);
  useEffect(() => {
    setCaptureMode(focused && mode !== "list" ? "text" : "none");
    return () => setCaptureMode("none");
  }, [focused, mode, setCaptureMode]);
  const entries = [...(draft ? [draft] : []), ...stations.map(stationTrack)];
  const selected = Math.min(cursor, Math.max(0, entries.length - 1));
  const track = entries[selected];
  const rows = Math.max(1, listRows - 7);
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), entries.length - rows));
  const fail = (error: unknown) => setNotice(error instanceof Error ? error.message : "Action failed. Please try again.");
  const submitUrl = (value: string) => {
    try {
      const next = trackFromUrl(value, mode === "radio");
      setDraft(next); setCursor(0); setMode("list");
      setNotice("Ready · enter plays · A appends · P queues next · no download");
    } catch (e) { fail(e); }
  };
  useInput((input, key) => {
    if (mode !== "list") {
      if (key.escape) { setMode("list"); setNotice(""); }
      else if (mode === "remove" && input === "y" && target) {
        try { setStations(removeStation(target.streamUrl)); setNotice("Favourite removed. Playback and queue unchanged."); setMode("list"); }
        catch (e) { fail(e); }
      }
      return;
    }
    if (input === "R") { setMode("radio"); setNotice(""); return; }
    if (input === "o" || (key.return && !track)) { setMode("url"); setNotice(""); return; }
    if (key.upArrow) setCursor(Math.max(0, selected - 1));
    else if (key.downArrow) setCursor(Math.min(entries.length - 1, selected + 1));
    else if (key.pageUp) setCursor(Math.max(0, selected - rows));
    else if (key.pageDown) setCursor(Math.min(entries.length - 1, selected + rows));
    else if (track) {
      if (key.return) {
        setNotice("Opening stream… m Player · 7 Queue");
        void playback.selectTrack(track, [track]).then(() => {
          setNotice(playback.getState().error || "Listening online · nothing added to Library · m Player");
        }).catch(() => setNotice("Could not start playback. Select the entry in Queue to retry."));
      } else if (input === "A" || input === "P") {
        playback.enqueue(track, input === "P"); setNotice(input === "P" ? "Queued next · 7 Queue" : "Added to queue · 7 Queue");
      } else if (input === "f" && track.streamType === "radio") {
        setTarget(track); setMode("name"); setNotice("");
      } else if (input === "x") {
        if (draft && selected === 0) { setDraft(null); setNotice("Link dismissed; queue unchanged."); }
        else { setTarget(track); setMode("remove"); }
      }
    }
  }, { isActive: focused });
  return <Box flexDirection="column" width={contentWidth}>
    <Text bold color={COLOR.alt}>Listen online · Radio / URL</Text>
    <Text color={COLOR.muted} wrap="truncate-end">o YouTube / audio URL · R live radio URL · 8 search music</Text>
    <Text color={COLOR.muted} wrap="truncate-end">Streams play without importing or downloading music.</Text>
    {mode === "url" || mode === "radio" ? <>
      <Text color={COLOR.accent} wrap="truncate-end">{mode === "radio" ? "Paste direct radio stream (not homepage):" : "Paste YouTube / direct audio URL:"}</Text>
      {focused ? <TextField key={mode} width={contentWidth - 1} placeholder="https://…" onSubmit={submitUrl} /> : null}
    </> : mode === "name" ? <>
      <Text color={COLOR.accent} wrap="truncate-end">Station name (same URL updates name):</Text>
      {focused ? <TextField width={contentWidth - 1} defaultValue={target?.title} onSubmit={name => {
        if (!target) return;
        try {
          const next = saveStation(name, target.streamUrl); setStations(next); setDraft(null);
          setCursor(next.findIndex(s => s.url === target.streamUrl)); setMode("list"); setNotice("Station saved · available after restart");
        } catch (e) { fail(e); }
      }} /> : null}
    </> : mode === "remove" ? <Text color={COLOR.warn}>Remove favourite? y confirms · esc cancels (music and queue stay)</Text> : <>
      <Text color={COLOR.muted} wrap="truncate-end">enter play · A/P queue · f save/rename radio · x remove</Text>
      {!entries.length ? <Text color={COLOR.muted}>No saved stations yet. Press R to add a radio stream.</Text> : null}
      {entries.slice(start, start + rows).map((entry, i) => <Text key={`${i}:${entry.id}`} wrap="truncate-end"
        color={focused && selected === start + i ? COLOR.selectedText : COLOR.text}
        backgroundColor={focused && selected === start + i ? COLOR.selection : undefined}>
        {selected === start + i ? "› " : "  "}{draft && start + i === 0 ? "[new] " : "★ "}{entry.streamType === "radio" ? "[LIVE] " : ""}{cleanText(entry.title)}
      </Text>)}
    </>}
    <Text color={notice ? COLOR.alt : COLOR.muted} wrap="truncate-end">{notice || "Direct URLs are saved in your private listening session; use trusted links."}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{mode !== "list" ? "esc cancel · " : ""}9 Radio / URL · 7 Queue · m Player</Text>
  </Box>;
}
