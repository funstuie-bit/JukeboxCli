import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { redactLog, logEvent, diagnosticReport, exportDiagnostics, sessionLogFile } from "../src/diagnostics/log";

it("redacts URLs, credentials, paths, emails and terminal escapes", () => {
  const safe = redactLog(`\x1b[31mError ${os.homedir()}/private https://example.com/secret?q=token\n/Users/example/music.mp3\n/home/example/a\nme@example.com\nAuthorization: Bearer abc\n{"token":"hidden"}\npassword=oops`);
  for (const secret of [os.homedir(), "example.com", "hidden", "oops", "abc", "\x1b", "/Users/example", "/home/example"]) expect(safe).not.toContain(secret);
});
it("serialises and bounds logs, exports privately without overwriting", async () => {
  await Promise.all([logEvent("player", "Playback disconnected"), logEvent("download", "HTTP 403 https://example.com/private")]);
  expect(await diagnosticReport()).toContain("Playback disconnected");
  expect(await diagnosticReport()).not.toContain("example.com");
  await fs.writeFile(sessionLogFile, "x".repeat(300000));
  await logEvent("app", "After rotation");
  expect((await fs.stat(sessionLogFile)).size).toBeLessThan(1000);
  const first = await exportDiagnostics(), second = await exportDiagnostics();
  expect(first).not.toBe(second);
  expect((await fs.stat(first)).mode & 0o777).toBe(0o600);
  expect(await fs.readFile(first, "utf8")).toContain("After rotation");
});
it("removes cookie rows, private keys and network addresses", () => {
  const result = redactLog(".example.org\tTRUE\t/\tFALSE\t0\tSID\thidden-cookie\n-----BEGIN PRIVATE KEY-----\nsecret-key-material\n-----END PRIVATE KEY-----\n192.168.1.2");
  expect(result).not.toContain("hidden-cookie"); expect(result).not.toContain("secret-key-material"); expect(result).not.toContain("192.168.1.2");
});
