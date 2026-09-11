# Home, first run and artwork

Start with online search, radio, local music or a download. Enter opens your
choice; Escape skips to Home. You don't need an account or an existing library.

## Navigation

`H` returns Home. Use arrows and Enter for its choices, recents and saved stations.
`/` opens online search from Home; `8` opens Discover and `9` opens Radio / URL.
`1` opens Library, `6` opens Now Playing, `m` expands the player and `7` opens
the queue. `?` shows the keys for the current screen. While you're typing in a
text field, shortcuts won't change playback or move you to another screen.

Home shows current playback, recent local and streamed plays, and saved stations.
Opening Home does not start playback. The large jukebox drawing appears only
when the window has enough room; smaller windows keep the navigation choices.
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

Ghostty, Kitty-compatible terminals and iTerm2 can show PNG artwork. The app
checks image support and cell size before using it; a terminal name alone isn't
enough. With tmux/screen, redirected output or no reply to those checks, it uses
block artwork. Apple's Terminal uses a text drawing by default and doesn't load
cover images in that mode.

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
