# Home, first run and artwork

Start with online search, radio, local music or a download. Enter opens your
choice; Escape skips to Home. You don't need an account or an existing library.

## Navigation

`H` returns Home. Use arrows and Enter for its choices, recents and saved stations.
`/` opens online search from Home; `7` opens Discover and `8` opens Radio / URL.
`1` opens Library, `5` opens Now Playing, `m` expands the player and `6` opens
the queue. `?` shows the keys for the current screen. While you're typing in a
text field, shortcuts won't change playback or move you to another screen.

## Setup & extras

Press **u on Home**, including on first launch. Choose Mouse clicks, Wheel only,
or Keyboard only explicitly. Defaults and existing preferences are unchanged;
Shift-drag selects terminal text in click mode. Artwork colours and decorative
motion toggle in place without moving your selection. Themes/layout and cookies
open their exact Settings pages. Browsing this page does not read browser cookies.

The optional Mac projectM row shows whether the pack is installed. Choosing it
opens the download/build confirmation, not an automatic install. Progress, a
failure reason and an explicit retry remain visible; music doesn't need projectM.
Linux links to its appearance/setup controls instead of the Mac installer.

The Home setup checklist is dismissible. That preference survives restarts,
but **u** and **9 Settings** remain available. All options are optional, and
Enter can still go straight to online search on first run. Escape goes back.
Short windows scroll the setup choices with arrows/PgUp/PgDn and retain focus.

Home's dashboard shows quick-launch cards for music search, YouTube videos, radio,
local music, the queue and optional downloads. The header has local/queue/station
counts and current playback; recents and saved stations have their own panels.
Use arrows and Enter in reading order, or click in click mode. Right-click recent
items/stations for audio/video and queue actions. Selection follows the same item
when recent history updates. Smaller windows use only choices that fit, without
off-screen keyboard targets. Tab gives the dashboard keyboard focus.

Roomy Home layouts show recent cover tiles, station logos and a larger current/
recent cover. Small tiles use block artwork so every thumbnail can appear
together; the large featured cover uses native graphics where supported.
Missing art uses text tiles; Apple Terminal keeps its simple
fallback. Artwork colours use the same opt-in as Player and respect custom
accent/high-contrast settings. Reduced motion stays on by default. With it off,
the cabinet grille animates slowly only while playing and visible; this is
decoration, not an audio visualiser. Pause, loading, help and unmount stop it.

Opening Home makes no search/extractor requests and does not start playback or
media downloads. Supplied thumbnail URLs may load as artwork; local covers are
read with ffmpeg. Image loading never blocks navigation or listening.
The large jukebox drawing appears only when the window has enough room.
The [generated dashboard preview](../preview/home-dashboard.svg) uses fictional
data and an isolated profile; it is not a screenshot of a real library.
To select its plain ASCII variant:

```sh
JUKEBOXCLI_LOGO=ascii jukeboxcli
```

## Profiles

Fresh macOS installations use:

- Music: `~/Music/JukeboxCli`
- Config: `~/Library/Preferences/JukeboxCli`
- Data: `~/Library/Application Support/JukeboxCli`
- Cache: `~/Library/Caches/JukeboxCli`
- Logs: `~/Library/Logs/JukeboxCli`

If an existing soundcli config, data directory or default music folder is found,
JukeboxCli retains the legacy profile unless branded config/data already exists.
An existing custom music directory still takes priority. Choosing a profile
doesn't copy, move or merge data. Don't run both apps against one profile at once.

To use a separate profile:

```sh
JUKEBOXCLI_HOME="$HOME/JukeboxCli-demo" jukeboxcli
```

It contains `config/`, `data/`, `cache/`, `logs/`, `temp/` and the default
`music/` folder. Use a separate profile or generated fixtures for testing.
Profiles can contain cookies settings, listening history and private URL tokens;
do not publish them.

## Artwork

Ghostty, Kitty-compatible terminals, Sixel terminals such as Foot and iTerm2 can
show artwork. The app checks image support and cell size before using it; a
terminal name alone isn't enough. With tmux/screen, redirected output or no reply
to those checks, it uses block artwork. Apple's Terminal uses a text drawing by
default and doesn't load cover images in that mode.

iTerm2 may ask whether to allow terminal-initiated image display. Allow it only
for sessions you trust; its remember option can avoid repeated prompts.
You can instead keep text rendering:

```sh
JUKEBOXCLI_ART=blocks jukeboxcli
```

This explicitly enables pixel artwork even in Apple's Terminal. To force the
simple drawing in any terminal, use `JUKEBOXCLI_ART=simple jukeboxcli`.
The `b` hide/show control works in either mode.

`JUKEBOXCLI_ART=iterm` explicitly selects the iTerm probe path; it is not a
permission bypass. `b` toggles artwork in the player. Missing artwork uses an
original radio/disc drawing. A station logo is not current-song album art;
see [station artwork refresh](listening-online.md).

Window resizing is handled live. Restart after changing font proportions if
placement is wrong. `jukeboxcli --doctor` reports terminal environment hints,
but does not perform an interactive graphics-permission test.

See the [README screenshots](../README.md#artwork-and-terminals) to compare Ghostty with Apple's Terminal.
[Generated fixture previews](../CONTRIBUTING.md#generated-previews) illustrate
components with placeholder data, not a live music collection.
