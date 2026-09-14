import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useStore } from "../store";
import { TextField } from "../components/TextField";
import { COLOR } from "../theme";
import { cleanText } from "../../util/format";
import { discoverFeeds } from "../../player/feeds";
import { listRadioFacets, QUICK_RADIO_CHANNELS, searchRadioDirectory, type RadioFacet, type RadioFacetKind } from "../../player/radio-browser";
import { readStations, removeStation, saveStation, refreshStations, stationTrack, type Station } from "../../player/stations";
import type { StreamTrack } from "../../player/media";

type DraftTrack = StreamTrack & { directoryResult?: boolean };

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
  const [drafts, setDrafts] = useState<DraftTrack[]>([]);
  const [mode, setMode] = useState<"list" | "url" | "radio" | "directory" | "browse" | "browseFilter" | "name" | "remove" | "finding">(openUrlRequest ? "url" : "list");
  const [finding, setFinding] = useState<"feed" | "directory" | RadioFacetKind>("feed");
  const [facets, setFacets] = useState<RadioFacet[]>([]);
  const [facetKind, setFacetKind] = useState<RadioFacetKind | "quick">("tags");
  const [facetFilter, setFacetFilter] = useState("");
  const [facetCursor, setFacetCursor] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [target, setTarget] = useState<StreamTrack | null>(null);
  const [urlText, setUrlText] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (openUrlRequest) { request.current?.abort(); setMode("url"); setUrlText(""); setNotice(""); setOpenUrlRequest?.(0); } }, [openUrlRequest, setOpenUrlRequest]);
  useEffect(() => {
    setCaptureMode(focused && mode !== "list" ? ["finding", "browse"].includes(mode) ? "esc" : "text" : "none");
    return () => setCaptureMode("none");
  }, [focused, mode, setCaptureMode]);
  const entries = [...drafts, ...stations.map(stationTrack)];
  const selected = Math.min(cursor, Math.max(0, entries.length - 1));
  const track = entries[selected];
  const rows = Math.max(1, listRows - 7);
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), entries.length - rows));
  const fail = (error: unknown) => setNotice(error instanceof Error ? error.message : "Action failed. Please try again.");
  const submitUrl = async (value: string) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const radio = mode === "radio";
    setFinding("feed"); setMode("finding"); setNotice("Identifying feeds… esc cancels");
    try {
      const result = await discoverFeeds(value, radio, controller.signal);
      if (controller.signal.aborted) return;
      const refreshed = result.tracks.some(t => t.streamType === "radio" && (t.thumbnailUrl || t.stationWebsite))
        ? refreshStations(result.tracks) : { stations, count: 0 };
      setStations(refreshed.stations);
      for (const found of result.tracks) playback.refreshStationArtwork(found);
      const existing = new Set(refreshed.stations.map(s => s.url));
      const fresh = result.tracks.filter(t => !existing.has(t.streamUrl));
      setDrafts(fresh);
      const savedAt = refreshed.stations.findIndex(s => s.url === result.tracks[0]?.streamUrl);
      setCursor(savedAt >= 0 ? fresh.length + savedAt : 0);
      setMode("list"); setNotice(refreshed.count ? `Refreshed ${refreshed.count} saved station(s) · names kept · ${result.tracks.some(t => t.thumbnailUrl) ? "artwork updated" : "no artwork supplied"}` : `Ready · ${result.note}`);
    } catch (e) {
      if (!controller.signal.aborted) { setMode(radio ? "radio" : "url"); fail(e); }
    }
  };
  const submitDirectory = async (value: string) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setFinding("directory"); setMode("finding"); setNotice("Searching Radio Browser… esc cancels");
    try {
      const result = await searchRadioDirectory(value, controller.signal);
      if (controller.signal.aborted) return;
      const existing = new Set(stations.map(s => s.url));
      setDrafts(result.tracks.filter(t => !existing.has(t.streamUrl)).map(t => ({ ...t, directoryResult: true })));
      setCursor(0); setMode("list"); setNotice(result.note);
    } catch (e) {
      if (!controller.signal.aborted) { setMode("directory"); fail(e); }
    }
  };
  const browseDirectory = async (kind: RadioFacetKind) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setFinding(kind); setMode("finding"); setNotice(`Loading ${kind}… esc cancels`);
    try {
      const result = await listRadioFacets(kind, controller.signal);
      if (controller.signal.aborted) return;
      setFacetKind(kind); setFacets(result); setFacetFilter(""); setFacetCursor(0); setMode("browse");
      setNotice(`${result.length} ${kind} · arrows browse · / filter · enter stations`);
    } catch (e) {
      if (!controller.signal.aborted) { setMode("list"); fail(e); }
    }
  };
  useInput((input, key) => {
    if (mode !== "list") {
      if (key.escape) { request.current?.abort(); setMode("list"); setNotice(""); }
      else if (mode === "browse") {
        const visible = facets.filter(f => !facetFilter || f.name.toLowerCase().includes(facetFilter.toLowerCase()));
        const picked = visible[Math.min(facetCursor, Math.max(0, visible.length - 1))];
        if (input === "/") setMode("browseFilter");
        else if (key.upArrow) setFacetCursor(i => Math.max(0, i - 1));
        else if (key.downArrow) setFacetCursor(i => Math.min(Math.max(0, visible.length - 1), i + 1));
        else if (key.pageUp) setFacetCursor(i => Math.max(0, i - rows));
        else if (key.pageDown) setFacetCursor(i => Math.min(Math.max(0, visible.length - 1), i + rows));
        else if (key.return && picked) void submitDirectory(picked.query);
      }
      else if (mode === "remove" && input === "y" && target) {
        try { setStations(removeStation(target.streamUrl)); setNotice("Favourite removed. Playback and queue unchanged."); setMode("list"); }
        catch (e) { fail(e); }
      }
      return;
    }
    if (input === "B") { void submitDirectory(""); return; }
    if (input === "M") { setFacetKind("quick"); setFacets([...QUICK_RADIO_CHANNELS]); setFacetFilter(""); setFacetCursor(0); setMode("browse"); setNotice("Quick channels · choose a mood, then pick a station"); return; }
    if (input === "g") { void browseDirectory("tags"); return; }
    if (input === "c") { void browseDirectory("countries"); return; }
    if (input === "/") { request.current?.abort(); setMode("directory"); setUrlText(""); setNotice(""); return; }
    if (input === "R") { request.current?.abort(); setMode("radio"); setUrlText(""); setNotice(""); return; }
    if (input === "o" || (key.return && !track)) { request.current?.abort(); setMode("url"); setUrlText(""); setNotice(""); return; }
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
        const already = playback.getState().list.some(t => t.id === track.id);
        playback.enqueue(track, input === "P"); setNotice(already ? "Already queued · added another occurrence · 7 Playback queue" : input === "P" ? "Queued next · 7 Queue" : "Added to queue · 7 Queue");
      } else if ((input === "f" || input === "t") && track.streamType === "radio") {
        setTarget(track); setMode("name"); setNotice("");
      } else if (input === "G" && track.streamType === "radio") {
        setMode("radio"); setUrlText(track.stationWebsite || "");
        setNotice("Paste the station WEBSITE to refresh matching feeds/artwork; names are kept.");
      } else if (input === "x" || input === "d") {
        if (selected < drafts.length) { setDrafts(d => d.filter((_, i) => i !== selected)); setNotice("Link dismissed; queue unchanged."); }
        else { setTarget(track); setMode("remove"); }
      }
    }
  }, { isActive: focused });
  return <Box flexDirection="column" width={contentWidth}>
    <Text bold color={COLOR.alt}>Radio / URL · Saved stations & found feeds</Text>
    <Text color={COLOR.muted} wrap="truncate-end">M quick channels · B popular · g genres · c countries · / search</Text>
    <Text color={COLOR.muted} wrap="truncate-end">Streams play without importing or downloading music.</Text>
    {mode === "url" || mode === "radio" ? <>
      <Text color={COLOR.accent} wrap="truncate-end">{mode === "radio" ? "Paste radio website, playlist or audio URL:" : "Paste YouTube / website / audio URL:"}</Text>
      {focused ? <TextField key={mode} defaultValue={urlText} onChange={setUrlText} width={contentWidth - 1} placeholder="https://…" onSubmit={submitUrl} /> : null}
    </> : mode === "directory" ? <>
      <Text color={COLOR.accent} wrap="truncate-end">Search station name · blank = popular · esc returns to browsing</Text>
      {focused ? <TextField key="directory" defaultValue={urlText} onChange={setUrlText} width={contentWidth - 1} placeholder="Station name…" onSubmit={submitDirectory} /> : null}
    </> : mode === "browseFilter" ? <>
      <Text color={COLOR.accent}>Filter {facetKind === "quick" ? "quick channels" : facetKind}:</Text>
      {focused ? <TextField key={`filter:${facetKind}`} defaultValue={facetFilter} width={contentWidth - 1} placeholder={`Type part of a ${facetKind === "quick" ? "quick channel" : facetKind === "tags" ? "genre or tag" : "country"}…`} onSubmit={value => { setFacetFilter(value.trim()); setFacetCursor(0); setMode("browse"); }} /> : null}
    </> : mode === "browse" ? <>
      <Text color={COLOR.accent}>{facetKind === "quick" ? "Quick channels" : facetKind === "tags" ? "Genres & tags" : "Countries"} · / filter · enter opens stations</Text>
      {(() => {
        const visible = facets.filter(f => !facetFilter || f.name.toLowerCase().includes(facetFilter.toLowerCase()));
        const picked = Math.min(facetCursor, Math.max(0, visible.length - 1));
        const from = Math.max(0, Math.min(picked - Math.floor(rows / 2), visible.length - rows));
        return visible.length ? visible.slice(from, from + rows).map((facet, i) => <Text key={facet.query} wrap="truncate-end"
          color={focused && picked === from + i ? COLOR.selectedText : COLOR.text}
          backgroundColor={focused && picked === from + i ? COLOR.selection : undefined}>
          {picked === from + i ? "› " : "  "}{cleanText(facet.name)}{facetKind === "quick" ? "" : ` · ${facet.count.toLocaleString()} stations`}
        </Text>) : <Text color={COLOR.muted}>No matching {facetKind === "quick" ? "quick channels" : facetKind}. Press / to change the filter.</Text>;
      })()}
    </> : mode === "name" ? <>
      <Text color={COLOR.accent} wrap="truncate-end">Name: {target?.title} · type replacement or enter to keep</Text>
      {focused ? <TextField key={target?.id} width={contentWidth - 1} placeholder="New name (or enter to keep current)…" onSubmit={name => {
        if (!target) return;
        try {
          const title = name.trim() || target.title;
          const next = saveStation(title, target.streamUrl, undefined, {
            ...(target.thumbnailUrl ? { thumbnailUrl: target.thumbnailUrl } : {}),
            ...(target.stationWebsite ? { websiteUrl: target.stationWebsite } : {}),
          });
          const remaining = drafts.filter(t => t.streamUrl !== target.streamUrl);
          setStations(next); setDrafts(remaining); playback.renameStation(target.streamUrl, cleanText(title));
          setCursor(remaining.length + next.findIndex(s => s.url === target.streamUrl)); setMode("list");
          setNotice("Station saved · in 9 favourites, not the music Library");
        } catch (e) { fail(e); }
      }} /> : null}
    </> : mode === "finding" ? <Text color={COLOR.accent}>{finding === "directory" ? "Searching Radio Browser" : finding === "feed" ? "Looking for audio feeds" : `Loading ${finding}`}… esc cancels</Text>
      : mode === "remove" ? <><Text color={COLOR.warn} wrap="truncate-end">Remove favourite? {target ? cleanText(target.title) : ""}</Text><Text color={COLOR.warn}>y confirms · esc cancels (music and queue stay)</Text></> : <>
      <Text color={COLOR.muted} wrap="truncate-end">enter play · A/P queue · f save · t rename · x/d remove · G artwork</Text>
      {!entries.length ? <Text color={COLOR.muted}>No saved stations yet. Press M/B/g/c to browse or R to add a radio stream.</Text> : null}
      {entries.slice(start, start + rows).map((entry, i) => <Text key={`${i}:${entry.id}`} wrap="truncate-end"
        color={focused && selected === start + i ? COLOR.selectedText : COLOR.text}
        backgroundColor={focused && selected === start + i ? COLOR.selection : undefined}>
        {selected === start + i ? "› " : "  "}{start + i < drafts.length ? drafts[start + i]?.directoryResult ? "[directory] " : "[found] " : "★ "}{entry.streamType === "radio" ? "[LIVE] " : ""}{cleanText(entry.title)}{entry.artist ? ` · ${cleanText(entry.artist)}` : ""}
      </Text>)}
    </>}
    <Text color={notice ? COLOR.alt : COLOR.muted} wrap="truncate-end">{notice || "Direct URLs are saved in your private listening session; use trusted links."}</Text>
    <Text color={COLOR.muted} wrap="truncate-end">{mode !== "list" ? "esc cancel · " : ""}9 Radio / URL · 7 Queue · m Player</Text>
  </Box>;
}
