# Linux development handover

This is the rebuild-safe starting point for the next soundstu session working on
JukeboxCli from Linux. The Linux work is part of the product and release roadmap,
not a throwaway port.

## Repositories and history

- Native development remote: `http://192.168.1.207:3000/admin/soundcli-fork.git`
- Native development branch: `soundstu/jukeboxcli`
- Public remote: `https://github.com/funstuie-bit/JukeboxCli.git`
- Public/default branch: `main`
- Released baseline: `v0.1.1-beta.4`
- Last Linux functional commit before this handover: `c21a20e`

Gitea and GitHub contain equivalent source with unrelated rewritten commit
histories. Do not merge them and do not force one repository over the other.
Develop against the Gitea branch. For an accepted promotion, fast-forward Gitea
main, then replay the bounded commits onto a new branch from GitHub main, run the
larger public gate, and fast-forward GitHub main.

Use the inline identity for every commit:

```sh
git -c user.name="soundstu" -c user.email="soundstu@agents.local" \
  commit -m "soundstu: <summary>"
```

Authentication must remain transient. Do not write the Gitea token into a
remote URL, config, shell history, documentation or source file.

## Rebuild on Arch Linux

```sh
sudo pacman -S --needed git nodejs npm mpv ffmpeg chromium gnome-keyring libsecret
mkdir -p ~/projects
git clone http://192.168.1.207:3000/admin/soundcli-fork.git ~/projects/JukeboxCli
cd ~/projects/JukeboxCli
git switch soundstu/jukeboxcli
npm ci
npm test
npm run typecheck
npm run build
./install.sh --prefix "$HOME/.local"
jukeboxcli --doctor
```

The browser session is not stored in the repository. Start Chromium inside the
desktop session, ensure GNOME Keyring/Secret Service is running, then select the
profile under Settings → Cookies. On Linux, an unqualified Chromium-family
profile is upgraded to `+gnomekeyring` only when the Secret Service socket is
detected. Never export or log cookie values.

Fresh Linux data uses XDG locations:

- Config: `~/.config/JukeboxCli`
- Data: `~/.local/share/JukeboxCli`
- Cache/tools: `~/.cache/JukeboxCli`
- Logs/state: `~/.local/state/JukeboxCli`
- Music: `~/Music/JukeboxCli`

These paths may contain private station URLs, history and browser-profile names.
Back them up separately if Stu wants continuity; never commit them. Use an
isolated `JUKEBOXCLI_HOME=/absolute/test/profile` for destructive/manual tests.

## Accepted Linux state

- Foot automatically uses stable, sharp Sixel artwork. Incremental Ink updates
  keep it visible while metadata and the visualiser change.
- The live eight-band visualiser is on by default on Linux. `v` cycles Classic
  Peak, Smooth, Bass Mirror, Outline, Bricks and Mosaic. Set
  `JUKEBOXCLI_VISUALIZER=0` for the static waveform.
- Full-screen Now Playing uses the accepted balanced 45/55 player/queue layout,
  aligned panel bottoms and one shared footer. The latest queue fix removes the
  104-cell table cap so highlights and `TIME` reach the right border; it was
  promoted at Stu's rebuild request without a final post-fix screenshot.
- Radio Browser supports `M` quick channels, `B` popular, `g` genres, `c`
  countries and `/` station search. Quick channels are tag searches for Lo-fi,
  Synthwave, Ambient, Chillout, Jazz, Classical, House, Drum & Bass, Reggae and
  Rock—not copied cliamp feeds. Themes Lavender, Calm, Ember, Ocean and Forest
  cycle with `T` or Settings. Stu confirmed both additions on Linux and Mac.
- Chromium Premium cookies work through detected GNOME Keyring. The original
  instant rate limit was anonymous fallback caused by failed cookie decryption.
- App-managed yt-dlp defaults to nightly. Settings can update/switch stable or
  nightly; doctor reports its path, channel and version separately from PATH.
- Linux prefers distribution ffmpeg/ffprobe. Do not reintroduce the cached
  generic build ahead of `/usr/bin/ffmpeg`; it crashed on this machine when
  decoding HTTPS station artwork.

## Verification and remaining work

At handover, the native tree passes 660 tests with 5 skipped across 65 files,
TypeScript checking, production build and distribution-import validation.
Beta.4's public GitHub gate also passed x64 Linux source installation and Apple
Silicon tests, independent reinstall and Homebrew formula installation.

First manual checks after rebuilding:

1. Run `jukeboxcli --doctor`; expect Linux x64, mpv/ffmpeg/ffprobe healthy,
   visualiser enabled and a managed nightly yt-dlp channel.
2. Play a downloaded local track in Foot and confirm the Sixel cover remains
   stable while cycling all six visualisers.
3. Open full-screen Now Playing and confirm queue highlights plus `TIME` reach
   the queue panel's right edge.
4. In Radio press `M`, play several moods, save a station, and confirm artwork
   and the live visualiser persist through metadata changes.
5. Select Chromium cookies and perform one small authenticated download before
   testing a playlist. If throttled, inspect the sanitised yt-dlp reason rather
   than assuming Premium cookies were loaded.

Still open: wider Linux terminal/keyring coverage, actual Intel Mac and iTerm2
artwork/media-key acceptance, cover-derived colours, optional mouse/Vim input,
and automatic pagination for very large online collections. Account playlists,
likes and personalised YouTube Music radio remain deliberately deferred; no
separate Music sign-in work is planned.

Update README, feature status, changelog, this handover and the shared vault with
each coherent change. Preserve Fletch's handover.
