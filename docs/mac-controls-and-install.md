# macOS installation and controls

JukeboxCli requires Node.js 22+ and mpv (0.38+ for streaming). yt-dlp resolves
YouTube audio; ffmpeg handles artwork, waveform extraction and conversion.

## Homebrew

```sh
brew tap funstuie-bit/jukeboxcli https://github.com/funstuie-bit/JukeboxCli.git
brew install funstuie-bit/jukeboxcli/jukeboxcli
jukeboxcli
```

This is the project's own Homebrew formula. It installs Node, mpv, ffmpeg and
yt-dlp, builds a specific Git revision into Homebrew's libexec and links only
`jukeboxcli`. Homebrew manages tool updates; `JUKEBOXCLI_SYSTEM_TOOLS=1` prevents
the app from downloading or updating its own tool binaries.

The formula pins the `v0.1.1-beta.4` source tag,
version `0.1.1-beta.4`. It does not follow every source commit, even when that
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
installs provide only `jukeboxcli`. Existing unrelated commands
are not forcibly overwritten. Normal source installs can fetch managed yt-dlp
and ffmpeg copies on first launch. Managed yt-dlp follows nightly by default;
Settings can update immediately or switch to stable.

`./install.sh --prefix /absolute/path` selects an npm prefix; add its `bin`
directory to PATH. `./install.sh --check` verifies the build without installing
the command or system tools.

Update from the clone:

```sh
cd JukeboxCli
./update.sh
```

The update script stops if you've changed files in the checkout. Otherwise it
pulls without merging divergent history and runs the installer. Keep using the
same prefix if you supplied one during installation.

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

Doctor prints JSON without opening the player, creating a profile, reading
cookies or installing tools. It reports which tools it can run and which
terminal you're using. Check the reported paths: a tool missing from PATH may
still be available in the app's own cache. Source installs also check the
standard Homebrew locations for mpv.

Doctor gives yt-dlp up to 15 seconds to start; other version probes have a
5-second limit. It reports timeout, exit-code and launch failures separately.
If playback works but doctor reports a failure, check the named tool and error.
That result is about the tool check, not a verdict on the whole installation.

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

If the bridge fails, you can still use the controls inside the terminal.
Automated tests don't tell us whether every Mac's physical keys and Control
Centre work. Include your macOS version, terminal and keyboard when reporting
a problem with them.
