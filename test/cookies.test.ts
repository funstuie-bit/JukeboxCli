import { describe, it, expect, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { browserCookieArg, detectBrowserProfiles, linuxChromiumKeyring, withDetectedLinuxKeyring, validBrowserCookieArg } from "../src/config/cookies";

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
      const profiles = await detectBrowserProfiles("darwin", fakeHome);
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
      const profiles = await detectBrowserProfiles("darwin", fakeHome);
      expect(profiles.filter((p) => p.browser === "firefox")).toEqual([]);
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(base, { recursive: true, force: true });
    }
  });
});

describe("detectBrowserProfiles: Linux Chromium browsers", () => {
  it("offers profiles with a cookie database and uses yt-dlp's Chromium name", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-linux-cookies-"));
    const profile = path.join(base, ".config/chromium/Default");
    await fs.mkdir(profile, { recursive: true });
    await fs.writeFile(path.join(profile, "Cookies"), "sqlite-bytes");
    try {
      expect(await detectBrowserProfiles("linux", base, null)).toContainEqual({
        browser: "chromium", profileName: "Default", label: "Chromium · Default", profilePath: profile,
      });
    } finally { await fs.rm(base, { recursive: true, force: true }); }
  });

  it("does not offer an empty Chrome profile directory", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-linux-cookies-"));
    await fs.mkdir(path.join(base, ".config/google-chrome/Default"), { recursive: true });
    try { expect(await detectBrowserProfiles("linux", base, null)).toEqual([]); }
    finally { await fs.rm(base, { recursive: true, force: true }); }
  });

  it("uses GNOME Keyring only when its Linux runtime socket is present", () => {
    const keyring = linuxChromiumKeyring("linux", "/run/user/1000", file => file === "/run/user/1000/keyring/control");
    expect(keyring).toBe("gnomekeyring");
    expect(withDetectedLinuxKeyring("chromium:Default", "linux", keyring)).toBe("chromium+gnomekeyring:Default");
    expect(withDetectedLinuxKeyring("firefox:main.default", "linux", keyring)).toBe("firefox:main.default");
    expect(withDetectedLinuxKeyring("chromium+kwallet6:Default", "linux", keyring)).toBe("chromium+kwallet6:Default");
  });

  it("stores an explicit detected keyring in the yt-dlp browser selector", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-linux-cookies-"));
    const profile = path.join(base, ".config/chromium/Default");
    await fs.mkdir(profile, { recursive: true });
    await fs.writeFile(path.join(profile, "Cookies"), "sqlite-bytes");
    try {
      const [found] = await detectBrowserProfiles("linux", base, "gnomekeyring");
      expect(found?.keyring).toBe("gnomekeyring");
      expect(browserCookieArg(found!)).toBe("chromium+gnomekeyring:Default");
    } finally { await fs.rm(base, { recursive: true, force: true }); }
  });
});

it("finds numbered, developer, ESR and custom-named Firefox profiles without offering empty stubs", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-firefox-"));
  const root = path.join(home, "Library/Application Support/Firefox/Profiles");
  const names = ["abc.default-release-1", "abc.dev-edition-default", "abc.default-esr", "abc.My music"];
  try {
    for (const name of [...names, "empty.default"]) {
      await fs.mkdir(path.join(root, name), {recursive:true});
      if (name !== "empty.default") await fs.writeFile(path.join(root, name, "cookies.sqlite"), "fixture");
    }
    expect((await detectBrowserProfiles("darwin", home)).map(p => p.profileName).sort()).toEqual(names.sort());
  } finally { await fs.rm(home, { recursive: true, force: true }); }
});

it.each(["darwin", "linux"] as const)("reads custom %s Firefox profiles.ini paths and deduplicates existing profiles", async platform => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-firefox-ini-"));
  const root = path.join(home, platform === "darwin" ? "Library/Application Support/Firefox" : ".mozilla/firefox");
  const normal = path.join(root, platform === "darwin" ? "Profiles/regular.default-release" : "regular.default-release");
  const custom = path.join(home, "Browser Profiles/Work profile");
  try {
    for (const profile of [normal, custom]) {
      await fs.mkdir(profile, { recursive: true }); await fs.writeFile(path.join(profile, "cookies.sqlite"), "fixture");
    }
    await fs.writeFile(path.join(root, "profiles.ini"), `[Profile0]\nName=Regular\nIsRelative=1\nPath=${path.relative(root, normal)}\n\n[Profile1]\nName=Work\nIsRelative=0\nPath=${custom}\n`);
    const found = await detectBrowserProfiles(platform, home, null);
    expect(found).toHaveLength(2);
    const external = found.find(p => p.profilePath === custom)!;
    expect(external.label).toBe("Firefox · Work");
    expect(browserCookieArg(external)).toBe(`firefox:${custom}`);
  } finally { await fs.rm(home, { recursive: true, force: true }); }
});

it("reports denied profile access without exposing a home path", async () => {
  const denied = vi.spyOn(fs, "readdir").mockRejectedValue(Object.assign(Error("private-path"), { code: "EACCES" }));
  const warn = vi.fn();
  try {
    await detectBrowserProfiles("darwin", "/nonexistent-cookie-test-home", null, warn);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toContain("Access to Firefox profiles was denied");
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/private-path|nonexistent-cookie-test-home/);
  } finally { denied.mockRestore(); }
});

it("accepts explicit browser selectors and rejects flags or control characters", () => {
  for (const selector of ["firefox", "chrome", "firefox:/path with spaces/profile", "chrome:Profile 1", "chromium+gnomekeyring:Default"]) expect(validBrowserCookieArg(selector)).toBe(true);
  for (const selector of ["", "--exec=bad", "unknown:profile", "firefox\n--exec=bad", "firefox:"]) expect(validBrowserCookieArg(selector)).toBe(false);
});
