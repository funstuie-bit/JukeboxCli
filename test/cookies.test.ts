import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectBrowserProfiles } from "../src/config/cookies";

/**
 * Firefox profile detection: only profiles that actually hold a cookie
 * database may be offered. An empty ".default" stub (left behind by an old
 * install) would otherwise get picked and fail every download with
 * "could not find firefox cookies database".
 */
describe("detectBrowserProfiles: firefox cookies gate", () => {
  it("skips a .default stub with no cookies.sqlite and offers the real profile", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "sndcli-cookies-"));
    // Point the detector at a fake home: it reads
    // <home>/Library/Application Support/Firefox/Profiles.
    const fakeHome = path.join(base, "home");
    const profilesDir = path.join(
      fakeHome,
      "Library/Application Support/Firefox/Profiles",
    );
    const stub = path.join(profilesDir, "abc123.default");
    const real = path.join(profilesDir, "xyz789.default-release");
    await fs.mkdir(stub, { recursive: true });
    await fs.mkdir(real, { recursive: true });
    // Only the real profile gets a cookie database.
    await fs.writeFile(path.join(real, "cookies.sqlite"), "sqlite-bytes");

    const originalHome = os.homedir();
    // os.homedir() is read at call time inside detectBrowserProfiles, so a
    // temporary HOME env var is enough to redirect it.
    process.env.HOME = fakeHome;
    try {
      const profiles = await detectBrowserProfiles();
      const firefox = profiles.filter((p) => p.browser === "firefox");
      expect(firefox.map((p) => p.profileName)).toEqual([
        "xyz789.default-release",
      ]);
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it("offers nothing when Firefox has no usable profiles", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "sndcli-cookies-"));
    const fakeHome = path.join(base, "home");
    const profilesDir = path.join(
      fakeHome,
      "Library/Application Support/Firefox/Profiles",
    );
    // A stub with no cookies database, and nothing else.
    await fs.mkdir(path.join(profilesDir, "abc123.default"), {
      recursive: true,
    });

    const originalHome = os.homedir();
    process.env.HOME = fakeHome;
    try {
      const profiles = await detectBrowserProfiles();
      expect(profiles.filter((p) => p.browser === "firefox")).toEqual([]);
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(base, { recursive: true, force: true });
    }
  });
});
