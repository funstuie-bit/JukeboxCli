import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";

/**
 * Browser cookie extraction for yt-dlp.
 *
 * Supports two sources:
 * 1. Netscape cookies.txt file (user-provided or exported)
 * 2. Direct extraction from Chrome/Firefox profile via yt-dlp's --cookies-from-browser
 *
 * Standard locations include:
 * - Chrome: ~/Library/Application Support/Google/Chrome/Default/Cookies
 * - Firefox: ~/Library/Application Support/Firefox/Profiles/*.default-release/cookies.sqlite
 * - Edge: ~/Library/Application Support/Microsoft Edge/Default/Cookies
 * - Brave: ~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies
 * - Linux Chromium: ~/.config/chromium/Default/Cookies
 * - Linux Firefox: ~/.mozilla/firefox/*.default-release/cookies.sqlite
 *
 * yt-dlp can read cookies directly from the browser with --cookies-from-browser <browser>:<profile>
 * which is simpler and keeps cookies fresh. We write a cookies.txt only if the user wants
 * a portable file.
 */

export interface BrowserProfile {
  browser: "chrome" | "chromium" | "firefox" | "edge" | "brave" | "safari";
  profileName: string;
  /** Display label for the picker */
  label: string;
  /** Path to the profile directory (for verification) */
  profilePath: string;
  /** Explicit Linux Chromium keyring when auto-detection cannot identify it. */
  keyring?: "gnomekeyring";
}

/** Detect the GNOME Secret Service socket used by Chromium/libsecret. */
export function linuxChromiumKeyring(
  platform: NodeJS.Platform = process.platform,
  runtimeDir = process.env.XDG_RUNTIME_DIR ?? (process.getuid ? `/run/user/${process.getuid()}` : ""),
  exists: (file: string) => boolean = existsSync,
): BrowserProfile["keyring"] | undefined {
  if (platform !== "linux" || !runtimeDir) return;
  return exists(path.join(runtimeDir, "keyring", "control")) ? "gnomekeyring" : undefined;
}

/** Upgrade an old automatic Chromium selector only when GNOME Keyring is proven present. */
export function withDetectedLinuxKeyring(
  value: string | undefined,
  platform: NodeJS.Platform = process.platform,
  keyring = linuxChromiumKeyring(platform),
): string | undefined {
  if (!value || platform !== "linux" || !keyring || value.includes("+")) return value;
  return /^(chrome|chromium|edge|brave):/.test(value)
    ? value.replace(":", `+${keyring}:`)
    : value;
}

/** Detect installed browsers and profiles in their standard platform locations. */
export async function detectBrowserProfiles(
  platform: NodeJS.Platform = process.platform,
  home = os.homedir(),
  linuxKeyring: BrowserProfile["keyring"] | null = linuxChromiumKeyring(platform) ?? null,
): Promise<BrowserProfile[]> {
  const profiles: BrowserProfile[] = [];

  const candidates: { browser: BrowserProfile["browser"]; basePath: string; label: string }[] = platform === "darwin" ? [
    {
      browser: "chrome",
      basePath: path.join(home, "Library/Application Support/Google/Chrome"),
      label: "Google Chrome",
    },
    {
      browser: "edge",
      basePath: path.join(home, "Library/Application Support/Microsoft Edge"),
      label: "Microsoft Edge",
    },
    {
      browser: "brave",
      basePath: path.join(home, "Library/Application Support/BraveSoftware/Brave-Browser"),
      label: "Brave",
    },
  ] : platform === "linux" ? [
    { browser: "chrome", basePath: path.join(home, ".config/google-chrome"), label: "Google Chrome" },
    { browser: "chromium", basePath: path.join(home, ".config/chromium"), label: "Chromium" },
    { browser: "edge", basePath: path.join(home, ".config/microsoft-edge"), label: "Microsoft Edge" },
    { browser: "brave", basePath: path.join(home, ".config/BraveSoftware/Brave-Browser"), label: "Brave" },
  ] : [];

  const hasCookies = async (profilePath: string) => Promise.any([
    fs.access(path.join(profilePath, "Cookies")),
    fs.access(path.join(profilePath, "Network/Cookies")),
  ]).then(() => true).catch(() => false);

  for (const c of candidates) {
    try {
      const entries = await fs.readdir(c.basePath, { withFileTypes: true });
      // Default profile
      const hasDefault = entries.some(
        (e) => e.isDirectory() && e.name === "Default",
      ) && await hasCookies(path.join(c.basePath, "Default"));
      if (hasDefault) {
        profiles.push({
          browser: c.browser,
          profileName: "Default",
          label: `${c.label} · Default`,
          profilePath: path.join(c.basePath, "Default"),
          ...(linuxKeyring ? { keyring: linuxKeyring } : {}),
        });
      }
      // Additional profiles (Profile 1, Profile 2, etc.)
      for (const e of entries) {
        if (e.isDirectory() && /^Profile \d+$/.test(e.name) && await hasCookies(path.join(c.basePath, e.name))) {
          profiles.push({
            browser: c.browser,
            profileName: e.name,
            label: `${c.label} · ${e.name}`,
            profilePath: path.join(c.basePath, e.name),
            ...(linuxKeyring ? { keyring: linuxKeyring } : {}),
          });
        }
      }
    } catch {
      // browser not installed
    }
  }

  // Firefox profiles (different structure)
  const firefoxPath = platform === "darwin"
    ? path.join(home, "Library/Application Support/Firefox/Profiles")
    : platform === "linux" ? path.join(home, ".mozilla/firefox") : "";
  try {
    if (!firefoxPath) return profiles;
    const entries = await fs.readdir(firefoxPath, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // .default-release is the main profile, .default is older/secondary
      const isDefault = e.name.endsWith(".default-release") || e.name.endsWith(".default");
      if (!isDefault) continue;
      // A profile without a cookie database can't be used by
      // --cookies-from-browser, so don't offer it: an empty "default"
      // stub left behind by an old Firefox install would otherwise fail
      // every download with "could not find firefox cookies database".
      const hasCookiesDb = await fs
        .access(path.join(firefoxPath, e.name, "cookies.sqlite"))
        .then(() => true)
        .catch(() => false);
      if (!hasCookiesDb) continue;
      profiles.push({
        browser: "firefox",
        profileName: e.name,
        label: `Firefox · ${e.name.replace(/\.(default-release|default)$/, "")}`,
        profilePath: path.join(firefoxPath, e.name),
      });
    }
  } catch {
    // Firefox not installed
  }

  return profiles;
}

/**
 * Use yt-dlp to extract cookies from a browser profile into a Netscape cookies.txt file.
 * yt-dlp's --cookies-from-browser flag handles the SQLite decryption.
 */
export async function extractCookies(
  browser: BrowserProfile["browser"],
  profile: string,
  outputPath: string,
  ytDlpPath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // yt-dlp --cookies-from-browser <browser>:<profile> --cookies <output>
    // Actually, yt-dlp doesn't support exporting cookies directly.
    // We use --cookies-from-browser as a passthrough flag instead.
    // For a portable cookies.txt, the user needs to export manually.
    //
    // But we CAN use yt-dlp with --cookies-from-browser directly by storing
    // the browser string in config instead of a cookies file path.
    throw new Error(
      "Direct cookie extraction requires yt-dlp's --cookies-from-browser flag. " +
      "Store the browser identifier instead of a cookies file path.",
    );
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Build a yt-dlp --cookies-from-browser argument from a browser profile.
 * e.g. "chrome:Default" or "firefox:abc123.default-release"
 *
 * Stored in config as `cookiesFromBrowser` instead of `cookiesFile` when
 * the user picks a browser profile. The download function checks for
 * this field and uses --cookies-from-browser instead of --cookies.
 */
export function browserCookieArg(profile: BrowserProfile): string {
  return `${profile.browser}${profile.keyring ? `+${profile.keyring}` : ""}:${profile.profileName}`;
}

/**
 * Verify a cookies.txt file exists and looks like a Netscape cookies file.
 */
export async function validateCookiesFile(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    // Netscape format starts with "# Netscape HTTP Cookie File" or has tab-separated lines
    return content.includes("# Netscape HTTP Cookie File") || content.includes("\tHttpOnly\t");
  } catch {
    return false;
  }
}
