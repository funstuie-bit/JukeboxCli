import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
export type LifecycleEvent = "sleep" | "wake" | "output-disconnected" | "low-power" | "normal-power";
export function lifecycleEvent(line: string): LifecycleEvent | undefined {
  try { const type = JSON.parse(line).type; return ["sleep", "wake", "output-disconnected", "low-power", "normal-power"].includes(type) ? type : undefined; } catch { return; }
}
/** No daemon, credential access, polling commands or implicit resume. */
export function watchLifecycle(event: (event: LifecycleEvent) => void, status: (message: string) => void): () => void {
  if (process.env.NODE_ENV === "test" || process.env.JUKEBOXCLI_PLATFORM_EVENTS === "0") { status("Platform events disabled"); return () => {}; }
  const roots = [path.join(import.meta.dirname, "native/platform-events"), path.resolve(import.meta.dirname, "../../native/platform-events"), path.resolve(import.meta.dirname, "../../dist/native/platform-events")];
  const root = roots.find(root => existsSync(path.join(root, process.platform === "darwin" ? "watch" : "linux.mjs")));
  if (!root || !["darwin", "linux"].includes(process.platform)) { status("Platform events unavailable in this build"); return () => {}; }
  let child: ChildProcess;
  try { child = spawn(process.platform === "darwin" ? path.join(root, "watch") : process.execPath,
    process.platform === "darwin" ? [] : [path.join(root, "linux.mjs")], { stdio: ["pipe", "pipe", "ignore"] }); }
  catch { status("Platform events unavailable"); return () => {}; }
  let pending = "", stopped = false;
  const unavailable = () => { if (!stopped) status("Platform event monitor unavailable · controls still work"); };
  child.on("error", unavailable); child.on("exit", unavailable);
  child.stdout?.on("data", (chunk: Buffer) => {
    if (stopped) return;
    pending = (pending + chunk.toString()).slice(-8192);
    const lines = pending.split("\n"); pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line.includes('"ready-macos"')) status("Mac sleep/output and low-power events active");
      else if (line.includes('"ready-linux"')) status("Linux sleep events active · output detection unavailable");
      else if (line.includes('"unavailable"')) unavailable();
      const value = lifecycleEvent(line); if (value) event(value);
    }
  });
  return () => { stopped = true; child.stdin?.end(); const timer = setTimeout(() => child.kill("SIGTERM"), 1000); timer.unref(); child.once("exit", () => clearTimeout(timer)); };
}
