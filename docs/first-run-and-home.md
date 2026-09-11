# Home, first run and artwork

The welcome screen offers online search, radio/URL, local music and optional
downloads. Enter opens the selected choice; Escape skips to Home. No sign-in,
download or existing library is required to begin.

## Navigation

`H` returns Home. Use arrows and Enter for its choices, recents and saved stations.
`/` opens online search from Home; `8` opens Discover and `9` opens Radio / URL.
`1` opens Library, `6` opens Now Playing, `m` expands the player and `7` opens
the queue. `?` shows contextual, paged help. Text fields capture shortcuts until
you finish or cancel.

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
An existing custom music directory remains authoritative. Selection never copies,
moves or merges data. Do not run both apps against one profile concurrently.

An explicit profile overrides automatic selection:

```sh
JUKEBOXCLI_HOME="$HOME/JukeboxCli-demo" jukeboxcli
```

It contains `config/`, `data/`, `cache/`, `logs/`, `temp/` and the default
`music/` folder. Use a separate profile or generated fixtures for testing.
Profiles can contain cookies settings, listening history and private URL tokens;
do not publish them.

## Artwork

Ghostty/Kitty-compatible terminals use PNG graphics after live protocol and
cell-size checks. iTerm2 uses inline PNG images after capability/size checks.
Terminal environment names alone are not sufficient. tmux/screen, redirected I/O
or missing replies fall back to proportional half-block artwork.

iTerm2 may ask whether to allow terminal-initiated image display. Allow it only
for sessions you trust; its remember option can avoid repeated prompts.
You can instead keep text rendering:

```sh
JUKEBOXCLI_ART=blocks jukeboxcli
```

`JUKEBOXCLI_ART=iterm` explicitly selects the iTerm probe path; it is not a
permission bypass. `b` toggles artwork in the player. Missing artwork uses an
original radio/disc drawing. A station logo is not current-song album art;
see [station artwork refresh](listening-online.md).

Window resizing is handled live. Restart after changing font proportions if
placement is wrong. `jukeboxcli --doctor` reports terminal environment hints,
but does not perform an interactive graphics-permission test.

See the [README screenshots](../README.md#first-run) for actual terminal views.
[Generated fixture previews](../CONTRIBUTING.md#generated-previews) illustrate
components with placeholder data, not a live music collection.
