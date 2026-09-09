# First impressions — dev.13

the maintainer's clean Mac screenshots exposed legacy naming, download-first onboarding,
empty landing pages and text-block artwork in iTerm2. This iteration addresses
those gaps; it does not resume the parked audio visualiser.

## Welcome and Home

The first screen offers Search and play online, Radio / paste a URL, Local music
library and optional downloads. Enter selects, arrows move, Escape finishes the
welcome and opens Home. No account sign-in, implicit playback or downloads. The
download section retains source/cookie/format workflows; the original Welcome
component remains in source for historical tests but is no longer mounted by App.

Normal launches open Home. H returns there without changing the existing 1–9
section shortcuts or 0 restart-song key. Home's / or Search action opens online
search with text focus; H typed in a search field remains input, not navigation.
Roomy Home lists up to three recent **local** tracks and three saved stations.
These are shortcuts to existing playback, not a second library/queue. Stream
history remains unimplemented. Current playback text and the normal bottom
transport remain visible; Home does not interrupt audio.

The original jukebox mark uses ASCII cabinet edges, music glyphs and a Braille
speaker grille. It is static, adds no wait, uses no image protocol/font dependency,
and is hidden below30 rows or65 content columns so actions retain priority.
`JUKEBOXCLI_LOGO=ascii jukeboxcli` replaces its non-ASCII characters for fonts
without suitable glyphs. This is character art, not accessible Braille prose.
Preview without network/audio/profile changes:

```sh
npx tsx scripts/visual-home.tsx
# q exits; --auto exits after five seconds
```

## Paths without data migration

Fresh default profiles use the name JukeboxCli for OS config/data/cache and
`~/Music/JukeboxCli` on Mac. At startup:

1. JUKEBOXCLI_HOME wins, retaining the existing portable config/data/music layout.
2. An existing branded config/data directory wins over a legacy one.
3. Otherwise an existing soundcli config/data directory or `~/Music/soundcli`
   selects the legacy profile and its default music folder.
4. With neither, use the new branded profile.

Saved custom libraryDir values remain authoritative. No profile is moved,
deleted, copied or merged. A machine already tested on dev.11 will keep its
soundcli folder: that is now an existing installation, not a genuinely fresh one.
Use a separate portable profile for previews, never delete a library to test this.

## iTerm2 artwork

Kitty remains supported. iTerm2 adds OSC1337 inline PNG output with preserved
cursor and aspect ratio; RGB480px bounds keep base64 packets below1MiB. Artwork
source processing/download failures still fall back safely; no playback blocking.
Auto mode uses feature reporting, or iTerm2 identity plus a live ReportCellSize
reply for older versions. It never trusts the terminal name alone. Responses are
consumed before Ink gets input; normal early keystrokes survive. Probe budget700ms.

`JUKEBOXCLI_ART=iterm jukeboxcli` explicitly requests inline mode (still requires
cell geometry); `JUKEBOXCLI_ART=blocks jukeboxcli` disables image queries/output.
tmux/screen and redirected I/O retain text fallback. The player labels the chosen
mode as iTerm2, Kitty or text fallback. `--doctor` reports terminal/environment
hints without querying the terminal or implying an interactive capability pass.

Inline images are text-cell content, erased by Ink's normal **full-frame** redraw;
they are repainted after each frame. Unlike Kitty images, they must not trigger
rectangle erasure after a new text layout has been drawn. Do not enable Ink's
incremental renderer without revisiting that lifecycle. Hide, modal changes and
resize must be checked in actual iTerm2; the terminal app is absent on this host.

documentation lookup official documentation informed this implementation:
[inline images](https://iterm2.com/documentation-images.html),
[feature reporting](https://iterm2.com/feature-reporting),
[cell-size report](https://iterm2.com/documentation-escape-codes.html).
No upstream code/assets were copied.

## Acceptance

Local verification: **623 tests pass / four inherited skips**, typecheck, build
and distribution-import checks pass. Separate Intel/Apple Silicon dev.13 CI
results are recorded after the development push; do not infer them from dev.12.

Isolated path tests cover fresh, legacy, both and portable cases. UI/full-App tests
cover first-run entry, search focus, typed H, returning Home, idle player status
and compact choices. Protocol tests cover inline payload/limits, older iTerm2
replies, explicit capability rejection, cursor preservation and Kitty regression.
The generated welcome SVG and real100×30 terminal fixture were inspected. Real
muted mpv smoke covers ongoing playback through player search and Home. Installation
smoke checks independent package relocation/reinstall without touching real data.

the maintainer: restart local jukeboxcli (dev.13), test H and a fresh profile, then iTerm2
artwork across b hide/show, m fullscreen/back, track changes and window resizing.
The observed lyrics-provider-unavailable screenshot is a separate network/provider
failure, not fixed or reclassified as instrumental by this iteration; R retries
or O explicitly requests the alternate provider. Main now includes dev.13 following
the maintainer's promotion request, so default clones include these screens. Home design approved;
actual iTerm2 and physical media-key testing remain pending. Latest runtime 83b6fb2
passes 626 tests / four skips and both Mac architecture CI jobs.
