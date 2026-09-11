import { expect, it } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";

async function fixture(mode: "present" | "install" | "fail" | "broken") {
  const bin = await mkdtemp(path.join(tmpdir(), "jukeboxcli-mpv-installer-"));
  const put = (name: string, body: string) => writeFile(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  await put("uname", 'echo Darwin');
  await put("mpv", mode === "present" ? "exit 0" : '[ -f "$FIXTURE_BIN/installed" ]');
  await put("brew", `if [ "$1" = --prefix ]; then echo "$FIXTURE_BIN"; exit; fi
echo "brew $*" >> "$FIXTURE_BIN/calls"
${mode === "fail" ? 'echo "Fixture Homebrew failure" >&2; exit 1' : mode === "broken" ? 'exit 0' : 'touch "$FIXTURE_BIN/installed"'}`);
  // Prefix/bin is deliberately absent; PATH already contains the fixture mpv.
  const result = await execa("/bin/sh", ["-c", '. ./scripts/install-mpv.sh; ensure_install_mpv'], {
    cwd: path.resolve(import.meta.dirname, ".."), reject: false,
    env: { PATH: `${bin}:/usr/bin:/bin`, FIXTURE_BIN: bin },
  });
  return { ...result, calls: await readFile(path.join(bin, "calls"), "utf8").catch(() => "") };
}
it("does not invoke Homebrew when mpv already works", async () => {
  const r = await fixture("present"); expect(r.exitCode).toBe(0); expect(r.calls).toBe("");
});
it("installs missing mpv and verifies that it can execute", async () => {
  const r = await fixture("install"); expect(r.exitCode).toBe(0); expect(r.calls).toBe("brew install mpv\n");
});
it("propagates a visible Homebrew failure", async () => {
  const r = await fixture("fail"); expect(r.exitCode).not.toBe(0); expect(r.stderr).toContain("Fixture Homebrew failure"); expect(r.stderr).toContain("has not been replaced");
});
it("rejects a successful brew command that leaves mpv unusable", async () => {
  const r = await fixture("broken"); expect(r.exitCode).not.toBe(0); expect(r.stderr).toContain("mpv could not run");
});
