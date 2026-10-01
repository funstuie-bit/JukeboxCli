import { trackFromUrl } from "./url";
import type { StreamTrack } from "./media";

export const STUDAYFM_WEBSITE = "https://www.studayfm.com/";

// Public receiver station names, mounts and artwork, verified 2026-10-01.
// No station administration endpoints, credentials or private infrastructure.
const STATIONS = [
  ["Studay FM", "stream", "the_instigator.png"],
  ["StuLoFiDay", "lofi", "stulofiday-station-640.webp"],
  ["Yacht Zone", "yacht", "yacht-zone-station-640.webp"],
  ["Tokyo Jazz", "jazzhop", "tokyo-jazz-station-640.webp"],
  ["C'est Magnifistu", "cest-magnifistu", "cest_magnifistu.webp"],
] as const;

/** Resolve public presets locally. No network requests until playback/artwork. */
export function studayFmFeeds(url: URL): StreamTrack[] | undefined {
  if (!["studayfm.com", "www.studayfm.com"].includes(url.hostname) || url.port) return;
  const mount = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  const stations = mount ? STATIONS.filter(([, path]) => path === mount) : STATIONS;
  if (!stations.length) return;
  return stations.map(([title, path, image]) => ({
    ...trackFromUrl(new URL(path, STUDAYFM_WEBSITE).href, true),
    title,
    stationWebsite: STUDAYFM_WEBSITE,
    thumbnailUrl: new URL(`images/${image}`, STUDAYFM_WEBSITE).href,
  }));
}
