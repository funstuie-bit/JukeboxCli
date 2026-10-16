export const LIVE_DOWNLOAD_ERROR = "Live streams cannot be downloaded. Choose a finished video, or use Play audio/video.";
export function isLiveDownloadError(message: string): boolean {
  return message.includes("Live streams cannot be downloaded");
}
