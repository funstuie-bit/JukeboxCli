# Linux development handover

This is the rebuild-safe starting point for Linux development.
Linux and macOS use one source history and release process.

## Current state

- Source preview: `1.6.0-dev.12`, including general YouTube video search and [audio/video controls](video-playback.md).
- Production release: `v1.5.0`
- Public source: `https://github.com/funstuie-bit/JukeboxCli.git`
- Private mirror connection details belong in private maintainer notes, not here
- Branch: `main`; both remotes must contain the same commits

Version 1.2.0 includes Mac fullscreen effects, Linux preset packs and native
first-frame logo removal. It retains 1.1.1's mpv lifetime protection.

The private repository's pre-1.0 history was replaced during reconciliation.
Always make a fresh clone after a machine rebuild. Never merge, rebase or copy
history from an old Linux checkout into `main`.

## Fresh clone after an Arch Linux rebuild

Clone the public source. Maintainers can add their private mirror separately
using their own connection details and credential manager.

```sh
sudo pacman -S --needed git # bootstrap cloning only
mkdir -p ~/projects
git clone https://github.com/funstuie-bit/JukeboxCli.git ~/projects/JukeboxCli
cd ~/projects/JukeboxCli
git fetch --all --tags
```

Never put credentials into the repository, documentation or a remote URL.

Version 1.2.0 automates Arch native dependencies in `install.sh`: core tools plus
projectM/Classic by default. Chromium/keyring and Cream of the Crop are optional
flags. Use `--no-visualizer` for core only or `--no-system-deps` for externally
managed system packages. Other Linux distributions still need manual native
dependencies. See [preset-pack details](linux-preset-packs.md).

## Build and install

```sh
cd ~/projects/JukeboxCli
npm ci
npm test
npm run typecheck
npm run build
./install.sh --prefix "$HOME/.local" --with-browser-cookies --with-cream-of-the-crop
export PATH="$HOME/.local/bin:$PATH"
jukeboxcli --doctor
```

Persist `~/.local/bin` in the shell profile if it is not already on `PATH`.
`install.sh` can also choose the user-local prefix automatically when the system
npm prefix is not writable.

The browser session is not stored in Git. Start Chromium in the desktop session,
ensure GNOME Keyring/Secret Service is running, then choose the browser profile
under Settings -> Cookies. Never export or log cookie values.

Fresh Linux data uses XDG locations:

- Config: `~/.config/JukeboxCli`
- Data: `~/.local/share/JukeboxCli`
- Cache/tools: `~/.cache/JukeboxCli`
- Logs/state: `~/.local/state/JukeboxCli`
- Music: `~/Music/JukeboxCli`

These paths can contain private station URLs, history and browser-profile names.
Back them up separately if continuity is needed; never commit them.

## First acceptance checks

1. Run `jukeboxcli --doctor`; expect Linux x64, healthy mpv/ffmpeg/ffprobe,
   the visualiser enabled and managed yt-dlp available.
2. Play a local track and confirm cover art remains stable while `v` cycles the
   six terminal visualisers.
3. Press `F` in Now Playing. projectM should open on the active output in true
   fullscreen, skip its M/headphones introduction and select a shuffled preset.
   Playback and the terminal visualiser should continue. Close it with Alt+F4.
4. Quit normally, with Ctrl-C, and by closing a test terminal. After each test,
   check `pgrep -a mpv`; JukeboxCli's player must not remain. Do not kill an
   unrelated mpv process.
5. Test Radio Browser quick channels and one small authenticated download.

projectM captures the existing system monitor source; it must not open a second
media stream. Its absence is optional and must not break playback or the terminal
visualiser.

## Rebuilt Arch acceptance — 2026-09-22

Fresh source install passed doctor, local playback, all six terminal visualiser
modes, Radio Browser lookup and a small download using Chromium/GNOME Keyring
cookies. projectM entered true fullscreen at 2560×1080 on the active output;
playback continued and Alt+F4 closed the companion.

Acceptance exposed the legacy Hyprland shortcut command failing on the new
Lua-based compositor. An intermediate fix used Lua with explicit key-down/key-up
and a legacy fallback. Version 1.2.0 supersedes both with the native first-frame
fix described below; it no longer injects compositor shortcuts.

Normal quit, Ctrl-C and closing the dedicated test terminal each removed its
mpv process, while an unrelated active player remained untouched. Validation:
709 tests passed, 5 skipped; typecheck, build and distribution guard passed.
Older Hyprland fallback has automated coverage; live desktop acceptance was on
the Lua-based compositor. Long-session memory soak remains outstanding.

## Optional packs acceptance — 2026-09-22

Version 1.2.0 includes the optional Cream of the Crop installer and pack selector.
Real download verified both pinned archives; 9,795 presets and 67 textures were
installed in user data. Cream and Combined both rendered at true 2560×1080
fullscreen, skipped the intro, and closed with Alt+F4. The combined collection
on the test installation contained 13,984 presets. Core texture-path persistence
was checked, including a regression for CRLF configuration files.

Final suite: 725 passed, 5 skipped, 76 files. Typecheck/build/import guard and
independent packaged install/reinstall passed. Arch dependency installation is
covered with fake pacman/sudo fixtures; the real machine already had its native
packages, so the installer correctly skipped sudo. A second pack install reused
the healthy download. Additional user-pack imports and
long-duration memory/GPU soak remain open.

## Startup-logo correction — 2026-09-22

The earlier acceptance verified eventual preset selection but missed the first
1.8 seconds of visible branding. Version 1.2.0 removes delayed shortcut injection.
The private Qt/PulseAudio frontend selects a valid preset before any render call;
empty or unsuccessful selection never draws the idle logo. The launcher waits
for readiness and reports errors/timeouts. No Hyprland/X11 shortcut helper is
needed. Arch installer builds it automatically; explicit rebuild command is
`jukeboxcli --install-linux-visualizer`. See [native build details](linux-preset-packs.md).

## Git and documentation rules

Public commits use the verified repository identity:

```sh
git -c user.name="funstuie-bit" \
    -c user.email="264561520+funstuie-bit@users.noreply.github.com" \
    commit -m "<summary>"
```

Push the identical commit to both remotes. Keep README, changelog, roadmap and
release notes current with user-visible changes. Machine coordination belongs in
the private vault handover, not this public repository.

Still open: wider Linux terminal/keyring coverage, actual Intel Mac and iTerm2
artwork/media-key acceptance, cover-derived colours, optional mouse/Vim input,
and pagination for very large online collections.

## October 2026 Linux update and memory investigation

Linux and macOS share main; Linux can fast-forward directly to 1.5.0.
Library browsing, portable playlists, diagnostics and player customisation are
cross-platform. Linux retains its private projectM frontend and optional packs.

A Node 26.8.2 V8 heap exhaustion abort was recorded on September 23. The missing
core prevents attributing that crash to a specific retained object. A separate
reproduction found React development performance entries growing with every
redraw (2,403 entries after 600 minimal redraws). Packaged startup now sets
production mode in a small launcher before dynamically importing the application,
so external React/Ink load their production implementations. The same reproduction
retains zero entries in production. Development commands remain unchanged.

The installer and prepublish check exercise 600 packaged-runtime redraws. This
fix removes a demonstrated unbounded retention path, but does not certify that
all causes of long-session memory growth are resolved. Long playback/visualiser
soaks and Settings → Session diagnostics remain useful follow-up evidence.

## Source preview 1.6.0-dev.1

Implemented all five follow-up items: ZIP/folder pack imports, Original/En D
optional downloads, player mouse controls, mpv-only Linux fullscreen capture and
bounded memory trends. [Usage and acceptance](visualiser-and-diagnostics.md).
Native frontend build revision4 adds per-process PulseAudio monitoring and parent
lifetime cleanup. Reinstall to rebuild it. Stable release/Homebrew remain1.5.0;
no new release tag is implied by the source preview.

### 15 October 2026 — player context menu

Preview dev.5 adds a Now Playing right-click / c menu alongside existing result
menus. Stu's saved mouse mode was absent (default wheel); it was explicitly set
to click for this machine. Restart the app to load the preference and new build.
Check right-click on both Videos results and Now Playing over VNC; keyboard c
remains available if the terminal intercepts right-click.

### 15 October 2026 — search focus fix

Preview dev.6 keeps sidebar navigation available while a TextField owns the
keyboard in click mode. Other click targets and wheel-to-arrow translation remain
blocked during typing. Discover now shows an explicit clickable cancel hint;
Escape exits typing. Reproduce acceptance by clicking Videos, typing q, clicking
Library without Escape, returning to Videos and using the cancel hint. Searches
are retained only during the current process, not after restart.

### 15 October 2026 — context-menu overlays

Preview dev.7 replaces the player action screen with a compact overlay. Results
use the same popup without shrinking/reflowing their list. Right-click anchors
near the pointer, c uses a default placement, and bounds are clamped on resize.
Outside click / Escape / c closes; underlying transport and queue input are
suspended. Pixel artwork temporarily uses blocks under an open player popup.
Acceptance: keep playback running, right-click the player and result rows near
edges, choose actions, dismiss outside, and confirm queue selection is retained.

### 15 October 2026 — live-download and child cleanup fixes

Dev.8 refuses live-broadcast downloads with UI feedback and yt-dlp's
--break-match-filters !is_live. Exit 101 is a refusal, including when --print
suppresses its explanatory output; never treat it as already saved. Refusals
do not retry or trip queue throttling. A separate Node supervisor owns each
yt-dlp process group and watches fd 3 for the parent lifetime. Cancellation and
parent loss terminate the group, then kill resistant descendants after 750 ms.
The supervisor script is bundled inline and does not rely on the checkout.

Tests use actual subprocesses to cover cancellation, resistant descendants,
unrelated processes, abrupt host death, quiet live refusal and finite completion.
Real Linux acceptance also verifies a small HTTP audio download converted with
ffmpeg and the reported YouTube live link rejected without media output. Mac
hardware acceptance remains pending. The user's earlier partial is retained.

### Linux pointer coverage — preview dev.9 (2026-10-15)

Home recent items/stations and Library/History/playlist/radio/queue/player-search
rows now expose context actions. Left-click plays or opens entries, including
discovery collections, Settings rows and nested option menus. The app-level
overlay avoids list reflow, suppresses background controls and native graphics,
and gives a nested queue row priority over the surrounding player. Click outside,
Esc or c closes. Existing destructive confirmations remain in place.

Mouse mode must be click; restart after installing. Specialist editors are not
claimed to have complete pointer coverage. macOS/VNC physical acceptance remains
separate from automated terminal validation.

### Audio/video item choices — preview dev.10 (2026-10-15)

Known YouTube items and video files/URLs offer Play audio / Play video across
Home, Library/History/playlists, Queue, Radio / URL and player search. Downloaded
YouTube audio resolves its original online source only when video is requested;
its queue identity and local file remain intact. Switching back uses local audio.
Radio and audio-only entries keep Play. Left-click is audio-first, including
YouTube results; Enter in YouTube Videos retains video playback.

No eager probing of unknown URLs. Video availability still depends on the source
and mpv; existing failure feedback offers audio. No library migration required.

### Sidebar presentation — preview dev.11 (2026-10-15)

Settings is now the final sidebar item, with a gap separating it from listening
sections. Every section has a simple icon before its shortcut and label; plain
terminals/JUKEBOXCLI_ICONS=ascii use ASCII fallbacks. Shortcut labels are explicit
rather than derived from display order: 5 Settings, 6 Now Playing, 7 Queue etc.
remain unchanged. Arrow navigation follows the displayed order.

### Sidebar renumbering — preview dev.12 (2026-10-15)

Supersedes dev.11's preserved numbers: 5 Now Playing, 6 Queue, 7 Music Discover,
8 Radio / URL, 9 Settings. H Home, Y YouTube Videos and 1–4 remain unchanged;
0 still restarts playback. Sidebar and numeric navigation now share navigation.ts.
Help and current guides use the new keys; published release notes retain history.
