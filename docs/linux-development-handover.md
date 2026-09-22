# Linux development handover

This is the rebuild-safe starting point for the `soundstu` Linux instance on
`maclinux`. Linux and macOS use one source history and release process.

## Current state

- Production release: `v1.1.1` (`d2df5c9`)
- Homebrew/main release commit: `6161cfc`
- Last shared main before this handover: `ee0280f`
- Private primary: `http://192.168.1.207:3000/admin/soundcli-fork.git`
- Public mirror: `https://github.com/funstuie-bit/JukeboxCli.git`
- Branch: `main`; both remotes must contain the same commits

Version 1.1.1 makes mpv stop when its parent app disappears, including terminal
closure and forced Node termination. Version 1.1.0 added the optional Linux
projectM fullscreen visualiser and skips projectM's branded introduction.

The private repository's pre-1.0 history was replaced during reconciliation.
Always make a fresh clone after a machine rebuild. Never merge, rebase or copy
history from an old Linux checkout into `main`.

## Fresh clone after an Arch Linux rebuild

Authenticate to Gitea interactively so a token does not enter shell history or
a remote URL. The canonical checkout is `~/projects/JukeboxCli`.

```sh
sudo pacman -S --needed git # bootstrap cloning only
git config --global credential.helper store
mkdir -p ~/projects
git clone http://192.168.1.207:3000/admin/soundcli-fork.git ~/projects/JukeboxCli
cd ~/projects/JukeboxCli
git remote add github https://github.com/funstuie-bit/JukeboxCli.git
git fetch --all --tags
test "$(git rev-parse origin/main)" = "$(git rev-parse github/main)"
```

Use Gitea username `admin` and the token as the password when prompted. Never
write the token into this repository, documentation, notes or a remote URL.

Current main automates Arch native dependencies in `install.sh`: core tools plus
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
Lua-based compositor. Current main now tries Lua with explicit key-down/key-up
and falls back to the old dispatcher when Lua is unavailable. The corrected
installed build automatically selected a real preset. This is an unreleased
compatibility fix on top of 1.1.1, not a new published version.

Normal quit, Ctrl-C and closing the dedicated test terminal each removed its
mpv process, while an unrelated active player remained untouched. Validation:
709 tests passed, 5 skipped; typecheck, build and distribution guard passed.
Older Hyprland fallback has automated coverage; live desktop acceptance was on
the Lua-based compositor. Long-session memory soak remains outstanding.

## Optional packs acceptance — 2026-09-22

Current main includes the optional Cream of the Crop installer and pack selector.
Real download verified both pinned archives; 9,795 presets and 67 textures were
installed in user data. Cream and Combined both rendered at true 2560×1080
fullscreen, skipped the intro, and closed with Alt+F4. The combined collection
on the test installation contained 13,984 presets. Core texture-path persistence
was checked, including a regression for CRLF configuration files.

Final suite: 725 passed, 5 skipped, 76 files. Typecheck/build/import guard and
independent packaged install/reinstall passed. Arch dependency installation is
covered with fake pacman/sudo fixtures; the real machine already had its native
packages, so the installer correctly skipped sudo. A second pack install reused
the healthy download. No new release tag; additional user-pack imports and
long-duration memory/GPU soak remain open.

## Startup-logo correction — 2026-09-22

The earlier acceptance verified eventual preset selection but missed the first
1.8 seconds of visible branding. Current main removes delayed shortcut injection.
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
