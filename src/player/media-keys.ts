/** Commands stay in JukeboxCli's queue, never mpv's two-entry preload list. */
export const MEDIA_KEYS: Record<string, string> = {
  PLAY: "toggle", PLAYPAUSE: "toggle", PAUSE: "toggle",
  PLAYONLY: "play", PAUSEONLY: "pause", NEXT: "next", PREV: "previous",
  STOP: "pause", FORWARD: "forward", REWIND: "backward",
};
export const MEDIA_SECTION = "jukeboxcli-media";
export const mediaBindings = Object.entries(MEDIA_KEYS)
  .map(([key, action]) => `${key} script-message ${MEDIA_SECTION} ${action}`).join("\n");
export function mediaAction(args: unknown): string | undefined {
  if (!Array.isArray(args) || args.length !== 2 || args[0] !== MEDIA_SECTION) return;
  return typeof args[1] === "string" && Object.values(MEDIA_KEYS).includes(args[1]) ? args[1] : undefined;
}

export async function dispatchMediaAction(player: {
  getState(): { paused: boolean; loading?: boolean; track: unknown };
  togglePause(): Promise<void>; next(): Promise<void>; prev(): Promise<void>; seek(seconds: number): Promise<void>;
}, action: string): Promise<void> {
  const state = player.getState();
  if (!state.track || state.loading) return;
  if (action === "toggle" || (action === "play" && state.paused) || (action === "pause" && !state.paused)) await player.togglePause();
  else if (action === "next") await player.next();
  else if (action === "previous") await player.prev();
  else if (action === "forward" || action === "backward") await player.seek(action === "forward" ? 15 : -15);
}
