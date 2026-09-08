import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../config/paths";
import { trackFromUrl } from "./url";
import { cleanText } from "../util/format";
import { isHttpUrl, type StreamTrack } from "./media";

export const stationsFile = path.join(paths.data, "radio-stations.json");
export interface Station { name: string; url: string; thumbnailUrl?: string; websiteUrl?: string }

export function stationTrack(station: Station): StreamTrack {
  const track = trackFromUrl(station.url, true);
  if (track.streamType !== "radio") throw new Error("Save a direct radio stream here; YouTube links belong in the queue.");
  if ((station.thumbnailUrl !== undefined && !isHttpUrl(station.thumbnailUrl)) ||
      (station.websiteUrl !== undefined && !isHttpUrl(station.websiteUrl))) throw new Error("Station artwork/website must use HTTP(S).");
  return { ...track, title: station.name, thumbnailUrl: station.thumbnailUrl, stationWebsite: station.websiteUrl };
}

/** Corruption is visible, never silently replaced by an empty favourites file. */
export function readStations(file = stationsFile): Station[] {
  let raw: string;
  try { raw = readFileSync(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw new Error("Could not read saved stations. Check file permissions."); }
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.stations) || data.stations.length > 500) throw Error();
    return data.stations.map((s: Station) => {
      if (!s || typeof s.name !== "string" || !s.name.trim() || s.name.length > 120 || typeof s.url !== "string") throw Error();
      return { name: cleanText(s.name), url: stationTrack(s).streamUrl,
        ...(s.thumbnailUrl ? { thumbnailUrl: s.thumbnailUrl } : {}), ...(s.websiteUrl ? { websiteUrl: s.websiteUrl } : {}) };
    });
  } catch { throw new Error("Saved stations file is invalid. Back up radio-stations.json before repairing it; it has not been overwritten."); }
}

function writeStations(stations: Station[], file: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, stations }, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}
export function saveStation(name: string, url: string, file = stationsFile, details: Pick<Station, "thumbnailUrl" | "websiteUrl"> = {}): Station[] {
  if (!name.trim() || name.length > 120) throw new Error("Give the station a name of 1–120 characters.");
  const title = cleanText(name).trim();
  const station = { name: title, url: stationTrack({ name: title, url, ...details }).streamUrl, ...details };
  const stations = readStations(file);
  const at = stations.findIndex(s => s.url === station.url);
  if (at >= 0) stations[at] = { ...stations[at]!, ...station };
  else { if (stations.length >= 500) throw new Error("Station limit reached (500). Remove a favourite first."); stations.push(station); }
  try { writeStations(stations, file); } catch { throw new Error("Could not save station. Check file permissions and free space."); }
  return stations;
}
export function removeStation(url: string, file = stationsFile): Station[] {
  const stations = readStations(file).filter(s => s.url !== url);
  try { writeStations(stations, file); } catch { throw new Error("Could not remove station. Check file permissions and free space."); }
  return stations;
}
