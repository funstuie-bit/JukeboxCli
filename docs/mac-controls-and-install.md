# Mac media controls and installation — dev.12

## Media keys

JukeboxCli now routes mpv's native media-key events through its own playback
controller. Next/previous use the complete listening queue and its shuffle/history,
not mpv's two-entry preload list. Play/pause are idempotent; Stop means pause, not
clear queue or quit. Forward/rewind request 15-second seeks; live radio retains
its no-seeking/disconnect/reconnect rules. Input while a track is loading is ignored.

On macOS this bridge is enabled when mpv reports input-media-keys enabled and
accepts the bindings. An unsupported binding/option disables the bridge without
breaking playback. Ordinary terminal controls remain available. Disable it before
launch with `JUKEBOXCLI_MEDIA_KEYS=0 jukeboxcli`; restart to change this setting.
No new native helper, global keyboard hook, Accessibility permission or driver.

mpv's existing MediaPlayer implementation supplies macOS Now Playing integration.
We set a descriptive artist/title (and radio broadcast text) instead of exposing
an extracted stream URL. The system player may still be labelled **mpv**, and
artwork/artist/album fields are limited to what mpv discovers itself. No claim of
JukeboxCli-branded system artwork, AirPods routing or universal media-key ownership.
Other media apps can become the active system player. After disconnecting radio,
macOS may remove its controls; reconnect using Space in JukeboxCli if necessary.

`npx tsx scripts/smoke-media-keys.ts` generates silent stereo audio, uses actual
mpv keypress events and checks play/pause/next/previous/title/queue preservation.
It does **not** simulate physical hardware or prove Control Centre behaviour.
the maintainer still needs to test F7/F8/F9 (or Fn combinations, depending on macOS settings),
background terminal use, other media apps, pause/quit and radio reconnect.

## Source install/update

`sh install.sh` builds locked dependencies and installs an npm archive, not a
symlink back into the checkout. Moving the source folder no longer breaks a fresh
installation. Existing already-linked installations are not silently migrated.
The archive bundles the production dependency tree installed with npm ci from
the lockfile; staging does not modify the checkout's lockfile. This also avoids
npm12's exclusion of npm-shrinkwrap.json from package archives.
The compatibility soundcli alias is included; npm will not be forced to overwrite
unrelated commands. Use `sh install.sh --prefix /absolute/private/prefix` to keep
another installation intact, then add that prefix's bin directory to PATH.

`sh install.sh --check` verifies dependencies/build/imports/version without a
global install. `sh update.sh` refuses dirty checkouts, pulls only fast-forward
changes on the tracked branch and reruns the installer. It accepts the same
--prefix option. No reset/stash/force or profile migration; if a build fails after
pull, the previously installed independent package remains usable. Package
archives are retained in the printed temporary directory for reinstall/rollback;
copy one somewhere durable before macOS clears its temporary files.

`jukeboxcli --doctor` is read-only: reports Node/architecture and tool versions
on PATH (or SOUNDCLI_MPV override), without opening the player, inspecting cookies,
loading the library, creating a profile or downloading binaries. Non-zero exit
means Node is too old or a PATH tool is missing/unusable. Automatic-mode cached
tools may still work even when doctor reports a PATH tool missing.

## Homebrew packaging

The formula is maintained in this repository's Formula directory, using an
immutable Git source revision, locked npm dependencies, declared node/mpv/
ffmpeg/yt-dlp dependencies, private libexec installation and a single jukeboxcli
wrapper (no conflicting soundcli alias). It is a third-party, source-built tap,
not homebrew/core, a bottled release or an npm registry publication. The GitHub
repo is private: anonymous archive downloads return404. Visibility is unchanged;
Git must have access. Install gh, sign in with `gh auth login` and run
`gh auth setup-git` first if needed. No tokens are embedded in the formula.
Homebrew strips transient GH_TOKEN/GIT_CONFIG environment variables at startup;
it does read global Git credential helpers during downloads. CI uses its supported
HOMEBREW_GITHUB_API_TOKEN with a helper referring to that variable, not the token
value. The CI helper uses gh's absolute executable path because Homebrew also
filters PATH. Local read-only staging operations suppress global Git config separately.

For this development preview (formula is not on main yet):

```sh
brew tap funstuie-bit/jukeboxcli https://github.com/funstuie-bit/JukeboxCli.git
git -C "$(brew --repository funstuie-bit/jukeboxcli)" \
  fetch origin development:development
git -C "$(brew --repository funstuie-bit/jukeboxcli)" switch development
brew install funstuie-bit/jukeboxcli/jukeboxcli
brew test funstuie-bit/jukeboxcli/jukeboxcli
```

Do not use force/overwrite if Homebrew reports an existing jukeboxcli command;
keep the current installation until you decide to switch. Future formula revisions
pin a newly verified source commit; `brew update` and `brew upgrade jukeboxcli`
then install that version using your configured Git credentials.
Merely advancing the app branch does not update the pin.

The wrapper sets JUKEBOXCLI_SYSTEM_TOOLS=1 and uses the declared dependencies on
PATH. In this mode, JukeboxCli neither downloads replacement tools nor stages
yt-dlp updates; missing dependencies produce a repair instruction. Existing
library/config/cookies/session paths remain unchanged. Use Homebrew to update
tools. Remove only the formula to uninstall; user music/profile data is retained.

## Verification and limits

- Unit/full-App suite plus typecheck, build and distribution-import checks.
- Real mpv 0.41 media-key IPC routing tested with generated muted stereo audio.
- Isolated source copy, prefix with spaces, install, source relocation and
  reinstall, verifying the installed package does not point back into the source.
- A read-only diagnostic run on this Apple Silicon Mac finds all four tools.
- [CI run 34365507402](https://github.com/funstuie-bit/JukeboxCli/actions/runs/34365507402)
  passed on 2026-09-09 at c5aedb0 on macos-15 (arm64) and macos-15-intel
  (x64): full tests, typecheck/build/import guard, independent package
  install/relocation/reinstall with Node22, and actual private Homebrew formula
  install plus version/help/doctor/profile-isolation tests with Homebrew's Node.
  Locally, 609 tests passed with four inherited skips; real muted mpv routing
  and the isolated bundled-package installation also passed.
- Physical media controls, clean end-user GUI first run, browsers/cookies and
  long-running radio across both architectures remain separate acceptance work.
- npm reports two existing moderate development-dependency advisories during
  npm ci; the production-only audit reported zero vulnerabilities on 2026-09-09.

Upstream references checked through documentation lookup:
[mpv input options](https://mpv.io/manual/master/#options-input-media-keys),
[mpv macOS RemoteCommandCenter](https://github.com/mpv-player/mpv/blob/master/osdep/mac/remote_command_center.swift),
[Homebrew language-specific formula guidance](https://docs.brew.sh/Language-Specific-Formulae),
[GitHub runner architecture labels](https://github.com/actions/runner-images#available-images).
No upstream source code was copied into JukeboxCli.
