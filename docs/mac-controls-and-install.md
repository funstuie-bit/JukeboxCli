# macOS installation and controls

JukeboxCli requires Node.js 22+ and mpv (0.38+ for streaming). yt-dlp resolves
YouTube audio; ffmpeg handles artwork, waveform extraction and conversion.

## Homebrew

```sh
brew tap funstuie-bit/jukeboxcli https://github.com/funstuie-bit/JukeboxCli.git
brew install funstuie-bit/jukeboxcli/jukeboxcli
jukeboxcli
```

This third-party source-built formula declares Node, mpv, ffmpeg and yt-dlp.
It builds a pinned Git revision into Homebrew's libexec and links only
`jukeboxcli`. Homebrew manages tool updates; `JUKEBOXCLI_SYSTEM_TOOLS=1` prevents
the app from downloading or updating its own tool binaries.

The formula currently pins `2b0269fece1a78ef365ff12be9d5bb8eab32418b`,
version `0.1.0-dev.14` (formula revision 1). It does not follow every source commit, even when that
commit has the same package version. A future release needs an explicit pin
update; use a source install if you need the latest checkout.

Update or uninstall:

```sh
brew update
brew upgrade jukeboxcli
# When you want to uninstall:
brew uninstall jukeboxcli
```

Uninstalling the command does not remove music or profile data.

## Source install

With Homebrew already available:

```sh
brew install node
git clone https://github.com/funstuie-bit/JukeboxCli.git
cd JukeboxCli
./install.sh
jukeboxcli
```

The installer requires Node 22+, checks for runnable mpv and installs missing mpv
through Homebrew on macOS. If that fails, it stops visibly before replacing the
global command. It does not install Homebrew or Node itself.

The installer builds an independent archive with locked production dependencies;
moving the checkout afterward does not break the installed command. Source/package
installs also provide the legacy `soundcli` alias. Existing unrelated commands
are not forcibly overwritten. Normal source installs can fetch managed yt-dlp
and ffmpeg copies on first launch.

`./install.sh --prefix /absolute/path` selects an npm prefix; add its `bin`
directory to PATH. `./install.sh --check` verifies the build without installing
the command or system tools.

Update from the clone:

```sh
cd JukeboxCli
./update.sh
```

The update script refuses a dirty checkout, pulls fast-forward only and runs the
installer. Keep using the same prefix when one was supplied.

Uninstall the source-installed package:

```sh
npm uninstall --global jukeboxcli
# For a custom prefix:
npm uninstall --global --prefix /absolute/path jukeboxcli
```

This removes package commands, not your music or profile. Existing legacy profiles
are retained; see [profile selection](first-run-and-home.md#profiles).

## Diagnostics

```sh
jukeboxcli --version
jukeboxcli --help
jukeboxcli --doctor
```

Doctor prints JSON without opening the UI, creating a profile, reading cookies
or bootstrapping tools. It reports tool availability and terminal environment
hints. A missing PATH tool can differ from the app's managed-cache availability;
read the reported paths. Source installs also check standard Homebrew mpv paths.

Doctor gives yt-dlp up to 15 seconds to start; other version probes have a
5-second limit. It reports timeout, exit-code and launch failures separately.
A successful real-world install does not mean every diagnostic probe succeeds.

If you installed through Homebrew but doctor reports `automatic` rather than
`managed`, check for another installation taking precedence:

```sh
type -a jukeboxcli
brew list --versions jukeboxcli
"$(brew --prefix jukeboxcli)/bin/jukeboxcli" --version
"$(brew --prefix jukeboxcli)/bin/jukeboxcli" --doctor
```

The explicit Homebrew path bypasses a conflicting command. Do not delete commands
or force-overwrite links until you know which installation owns them.

## Media controls

mpv supplies macOS media-key integration. JukeboxCli routes next/previous events
through its entire listening queue, not only mpv's prepared next entry.
Stop is treated as pause. For live radio, pause disconnects and play reconnects.

Try the media keys with another window focused; Fn behaviour depends on keyboard
and macOS settings. System UI may identify the player as mpv rather than
JukeboxCli. Other media apps can compete for these controls. No separate native
helper or system-wide audio capture is installed.

To disable JukeboxCli's optional media-key bridge:

```sh
JUKEBOXCLI_MEDIA_KEYS=0 jukeboxcli
```

Bridge setup failure leaves ordinary terminal playback available. Automated
event tests cannot establish physical-key or Control Centre behaviour on every
Mac; report the OS, terminal and keyboard context when filing an issue.
