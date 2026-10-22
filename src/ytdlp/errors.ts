import { StreamResolutionError } from "../player/media";

/** Fixed messages only: never expose extractor output, signed URLs or profiles. */
export function ytDlpLookupError(error: unknown, cookiesConfigured: boolean): StreamResolutionError {
  if (error instanceof StreamResolutionError) return error;
  const stderr = typeof (error as { stderr?: unknown } | null)?.stderr === "string" ? (error as {stderr:string}).stderr : "";
  // Warnings/help often mention cookies even when the final error is unrelated.
  const errors = stderr.split(/\r?\n/).filter(line => /\bERROR:/i.test(line)).join("\n") || stderr;
  if (cookiesConfigured && /could not find.*cookies|could not copy.*cookies|failed to (?:decrypt|load).*cookies|could not.*decrypt|does not look like a Netscape|permission denied.*cookies/i.test(stderr)) return new StreamResolutionError("cookies");
  if (/HTTP(?: Error)?\s*429|too many requests|rate.?limit|temporarily blocked/i.test(errors)) return new StreamResolutionError("rate-limit");
  if (/confirm.*(?:bot|human)|not a bot|verify.*(?:human|connection)|bot verification/i.test(errors)) return new StreamResolutionError("verification");
  if (/private video|age.?restrict|confirm your age|members.only|join this channel|authentication required/i.test(errors)) return new StreamResolutionError("authentication");
  if (/video unavailable|video.*removed|not available in your country/i.test(errors)) return new StreamResolutionError("unavailable");
  if (/(?:no supported JavaScript runtime|challenge (?:solver|solving).*failed|EJS.*(?:missing|not found|unavailable)|no .*challenge solver)/i.test(stderr)) return new StreamResolutionError("javascript");
  if (/requested format.*not available|no video formats|only images are available/i.test(errors)) return new StreamResolutionError("format");
  if (/sign.?in|log.?in|cookies.*required|requires.*cookies/i.test(errors)) return new StreamResolutionError("authentication");
  if (/HTTP(?: Error)?\s*403|forbidden/i.test(errors)) return new StreamResolutionError("blocked");
  if ((error as { timedOut?: boolean } | null)?.timedOut || /timed? out|timeout/i.test(errors)) return new StreamResolutionError("timeout");
  return new StreamResolutionError("lookup");
}

export function isYouTubeLookup(input: string): boolean {
  if (/^ytsearch\d*:/i.test(input)) return true;
  try { return ["youtube.com", "www.youtube.com", "music.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(new URL(input).hostname.toLowerCase()); }
  catch { return false; }
}
