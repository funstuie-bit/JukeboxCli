import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";

const mpv = spawnSync("which", ["mpv"], { encoding: "utf8" }).stdout?.trim();
const supported = process.platform !== "win32" && Boolean(mpv);
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

describe.skipIf(!supported)("real mpv parent lifetime", () => {
  for (const spectrum of ["0", "1"]) {
    for (const ending of ["quit", "exit", "SIGTERM", "SIGHUP", "SIGKILL"]) {
      it(`stops after ${ending}, visualiser=${spectrum}`, async () => {
        // Own only this isolated player. No user profile, network or audible audio.
        const parent = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
          import { MpvPlayer } from './src/player/mpv.ts';
          const player = new MpvPlayer(${JSON.stringify(mpv)});
          await player.command(['set_property', 'ao', 'null']);
          await player.command(['loadfile', 'av://lavfi:sine=frequency=440', 'replace']);
          let playing = false;
          for (let i = 0; i < 100; i++) {
            const position = await player.command(['get_property', 'time-pos']).catch(() => null);
            if (typeof position === 'number' && position > 0) { playing = true; break; }
            await new Promise(r => setTimeout(r, 20));
          }
          if (!playing) { player.quit(); throw new Error('test audio did not start'); }
          console.log(JSON.stringify({pid: player.proc.pid}));
          process.stdin.once('data', () => {
            if (${JSON.stringify(ending)} === 'quit') player.quit();
            process.exit(0);
          });
        `], { cwd: process.cwd(), env: { ...process.env, JUKEBOXCLI_VISUALIZER: spectrum },
          stdio: ["pipe", "pipe", "pipe"] });
        let childPid = 0;
        let errors = "";
        parent.stderr.on("data", b => { errors += b; });
        try {
          const line = await new Promise<string>((resolve, reject) => {
            let text = "";
            const timeout = setTimeout(() => reject(new Error(`startup timeout: ${errors}`)), 8000);
            parent.stdout.on("data", b => {
              text += b;
              if (text.includes("\n")) { clearTimeout(timeout); resolve(text.split("\n")[0]!); }
            });
            parent.once("exit", () => { clearTimeout(timeout); reject(new Error(errors || "parent exited early")); });
          });
          childPid = JSON.parse(line).pid;
          expect(alive(childPid)).toBe(true);
          await delay(150);
          expect(alive(childPid)).toBe(true);
          const exited = once(parent, "exit");
          if (ending === "quit" || ending === "exit") parent.stdin.write("exit\n");
          else parent.kill(ending as NodeJS.Signals);
          await exited;
          for (let i = 0; i < 60 && alive(childPid); i++) await delay(50);
          expect(alive(childPid)).toBe(false);
        } finally {
          if (parent.exitCode === null && parent.signalCode === null) parent.kill("SIGKILL");
          if (childPid && alive(childPid)) process.kill(childPid, "SIGKILL");
        }
      }, 15000);
    }
  }
});
