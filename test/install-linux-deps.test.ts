import { expect, it } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";

async function fixture(options = "", mode = "missing") {
  const bin = await mkdtemp(path.join(os.tmpdir(), "jukeboxcli-arch-"));
  const put = (name: string, body: string) => writeFile(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  await put("uname", "echo Linux");
  await put("id", "echo 1000");
  await put("sudo", 'echo "sudo $*" >> "$FIXTURE_BIN/calls"; exec "$@"');
  await put("pacman", `if [ "$1" = -Q ]; then ${mode === "present" ? "exit 0" : '[ -f "$FIXTURE_BIN/installed" ]; exit $?'}; fi
echo "pacman $*" >> "$FIXTURE_BIN/calls"
${mode === "fail" ? "exit 1" : 'touch "$FIXTURE_BIN/installed"'}`);
  const result = await execa("sh", ["-c", `${options} . ./scripts/install-linux-deps.sh; ensure_linux_dependencies`], {
    reject: false, env: { PATH: `${bin}:/usr/bin:/bin`, FIXTURE_BIN: bin },
  });
  return { ...result, calls: await readFile(path.join(bin, "calls"), "utf8").catch(() => "") };
}
it("installs Arch core plus basic fullscreen pack, without forcing a browser", async () => {
  const r = await fixture();
  expect(r.exitCode).toBe(0);
  expect(r.calls).toContain("sudo pacman -S --needed git nodejs npm mpv ffmpeg tar projectm-pulseaudio libpulse gcc make pkgconf qt5-base\n");
  expect(r.calls).not.toContain("chromium");
});
it("supports minimal install and optional browser/keyring dependencies", async () => {
  const r = await fixture("install_visualizer=0; install_browser_cookies=1;");
  expect(r.exitCode).toBe(0);
  expect(r.calls).not.toContain("projectm-pulseaudio");
  expect(r.calls).toContain("chromium gnome-keyring libsecret");
});
it("never requests sudo when dependencies are already present", async () => {
  const r = await fixture("", "present"); expect(r.exitCode).toBe(0); expect(r.calls).toBe("");
});
it("propagates package-manager failure", async () => {
  expect((await fixture("", "fail")).exitCode).not.toBe(0);
});
