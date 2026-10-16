import { videoSource } from "../../player/video-source";
import type { PlayableTrack, PlaybackMode } from "../../player/media";
import type { ContextAction } from "./ContextMenu";

export function playbackActions(track: PlayableTrack, play: (mode: PlaybackMode) => void): ContextAction[] {
  return videoSource(track)
    ? [{ label: "Play audio", run: () => play("audio") }, { label: "Play video", run: () => play("video") }]
    : [{ label: "Play", run: () => play("audio") }];
}
