import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { paths, downloadLogFile } from "../config/paths";
import pkg from "../../package.json";

export const sessionLogFile = path.join(paths.log, "session.log");
const LIMIT = 256 * 1024;
let writes: Promise<void> = Promise.resolve();

/** Reports deliberately omit URLs, user paths and credentials, not just query tokens. */
export function redactLog(value: string): string {
  return value.split(/\r?\n/).map(line => line.slice(0, 8192)).join("\n").replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g, "")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[URL]")
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, "[PRIVATE KEY REDACTED]")
    .replace(/^\.?[^\s]+\t(?:TRUE|FALSE)\t[^\r\n]+$/gm, "[COOKIE REDACTED]")
    .split(os.homedir()).join("[HOME]")
    .replace(/\[HOME\][^\s"'<>]*/g, "[USER PATH]")
    .replace(/(?:\/Users\/|\/home\/)[^\s"'<>]+|[A-Za-z]:\\Users\\[^\r\n"<>]+/g, "[USER PATH]")
    .replace(/[\w.+-]{1,256}@[\w.-]{1,253}\.[a-z]{2,63}/gi, "[EMAIL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]")
    .replace(/\b(authorization|cookie|password|passwd|token|secret|api[_-]?key)\b["']?\s*[:=]\s*[^\r\n]+/gi, "$1=[REDACTED]")
    .replace(/\bBearer\s+[\w.+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}

/** Serialised, bounded and best-effort. Never allow diagnostics to break playback. */
export function logEvent(area: "player" | "download" | "app", detail: string): Promise<void> {
  const line = `${new Date().toISOString()} [${area}] ${redactLog(detail).replace(/\r?\n/g, " | ").slice(0, 4000)}\n`;
  writes = writes.then(async () => {
    await fs.mkdir(paths.log, { recursive: true });
    const stat = await fs.lstat(sessionLogFile).catch(() => null);
    if (stat?.isSymbolicLink()) return;
    if (stat && stat.size > LIMIT) await fs.rename(sessionLogFile, `${sessionLogFile}.old`);
    await fs.appendFile(sessionLogFile, line, { mode: 0o600 });
  }).catch(() => {});
  return writes;
}

async function tail(file: string): Promise<string> {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile()) return "";
    const handle = await fs.open(file, "r");
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, LIMIT));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, Math.max(0, stat.size - LIMIT));
      const text = buffer.subarray(0, bytesRead).toString("utf8");
      return stat.size > LIMIT ? text.slice(text.indexOf("\n") + 1) : text;
    } finally { await handle.close(); }
  } catch { return ""; }
}

export async function diagnosticReport(): Promise<string> {
  await writes;
  const chunks = await Promise.all([sessionLogFile, `${sessionLogFile}.old`, downloadLogFile].map(tail));
  return redactLog([
    `JukeboxCli ${pkg.version} diagnostics · ${new Date().toISOString()}`,
    `Platform: ${process.platform}/${process.arch} · Node ${process.version}`,
    "URLs, home paths and common credentials redacted. Review before sharing.",
    ...chunks.map((text, i) => `\n${["Session", "Previous session log", "Recent download failures"][i]}\n${text || "No entries yet."}`),
  ].join("\n"));
}

export async function exportDiagnostics(): Promise<string> {
  const report = await diagnosticReport();
  const dir = path.join(paths.log, "reports");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `jukeboxcli-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.txt`);
  await fs.writeFile(file, report, { flag: "wx", mode: 0o600 });
  return file;
}
