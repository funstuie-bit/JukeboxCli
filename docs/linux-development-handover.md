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
sudo pacman -S --needed git nodejs npm mpv ffmpeg chromium gnome-keyring libsecret projectm-pulseaudio
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

## Build and install

```sh
cd ~/projects/JukeboxCli
npm ci
npm test
npm run typecheck
npm run build
./install.sh --prefix "$HOME/.local"
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
