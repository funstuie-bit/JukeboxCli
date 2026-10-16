import { isStream, type PlayableTrack } from "./media";
import { trackFromUrl } from "./url";

const videoFile = /\.(mp4|m4v|mkv|webm|mov|avi|ogv|mpeg|mpg)$/i;
/** A known video source, without a network probe or changes to saved metadata. */
export function videoSource(track: PlayableTrack): PlayableTrack | undefined {
  if (isStream(track)) {
    if (track.streamType === "radio") return;
    try {
      const url = new URL(track.streamUrl);
      if (videoFile.test(url.pathname)) return track;
      if (trackFromUrl(track.streamUrl).source === "youtube") return track;
    } catch { /* Not a known video URL. */ }
    return;
  }
  if (videoFile.test(track.filePath)) return track;
  if (track.source !== "youtube") return;
  try {
    const source = trackFromUrl(track.webpageUrl || `https://www.youtube.com/watch?v=${track.sourceTrackId}`);
    if (source.source !== "youtube") return;
    return { ...source, id: track.id, title: track.title, artist: track.artist, album: track.album, durationSec: track.durationSec };
  } catch { return; }
}
