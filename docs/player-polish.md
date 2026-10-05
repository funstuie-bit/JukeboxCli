# Player polish — 1.5 development build

These additions are in source builds labelled 1.5.0-dev.1. Homebrew stable is
still 1.4.0. They use JukeboxCli's existing TypeScript/Ink/mpv stack; Orpheus was
interaction inspiration, not a source-code or asset dependency.

The Player appearance and Keyboard and mouse menus use the available height,
showing every option when it fits. Changing a setting keeps that row selected,
as does returning from its editor. Smaller windows show position/range hints;
arrows, Page Up/Down and Home/End navigate the remaining options.

## Browsing artwork

Settings (`5`) → Player appearance → Browsing artwork previews enables covers
in Library (`1`) and downloaded Playlists (`2`). Albums/artist/genre collections
use the first track's artwork. Playlist folders also use the first track, not
an online lookup for a playlist cover. Highlighting never starts playback.

Previews need a wide content pane (100 columns) and enough height for the list.
Smaller windows keep the existing text-details behaviour. A short selection
delay avoids probing every track during fast scrolling; filtering holds the
previous preview steady until you leave the text field. The existing terminal
artwork support and fallback rules apply. The option is off by default.

## Clean player

Settings → Player appearance → Player layout switches Classic / Clean.
Open `m` for Now Playing. Clean prioritises cover art, reduces repeated labels
and shows an editable **Up Next** subset in actual play order. `7` still opens
the complete queue, including the current and earlier tracks. Lyrics, search
and visualisers remain available. Very narrow layouts retain responsive fallbacks.

## Theme editor

Settings → Player appearance → Theme editor opens a draft with a live sample.
Choose a palette, transparent or dark solid player background, border style,
high contrast and accent. Enter/left/right change options; on Accent, `#` opens
a six-digit hex colour field. Choose **Save and return** to persist. Escape
discards the draft; quitting or leaving without saving does not write it.

These appearance overrides affect Now Playing and Queue, not every Settings or
Library label. Clean omits panel boxes; border styles are most visible in Classic.
The editor previews a sample rather than changing the hidden running player.
An explicit accent takes precedence over artwork colours; automatic accent
restores artwork-derived colours when enabled. High contrast brightens text and
selection text chooses black/white for the accent. Arbitrary custom colours and
transparent terminal backgrounds still need your visual judgement.

## Custom shortcuts

Settings → Keyboard and mouse → Custom shortcuts. Choose an action, press Enter,
then press its new key. The editor warns about conflicting/reserved combinations.
Use **Save and return** or **Reset all shortcuts**, then save. Escape discards.

Transport, player-view and queue-edit actions are configurable. Navigation,
section digits, text editing, search-field prefixes, confirmation keys and Ctrl+C
are intentionally fixed. Supported bindings are a printable character, Space,
or Ctrl plus one of A/B/E/F/G/K/N/O/P/R/T/U/V/W/X/Y. Terminals can intercept some
chords themselves. Existing action keys cannot be reassigned to a different
action because other sections may use them. Use an unused symbol or Ctrl chord.

Help and footer action hints reflect saved bindings. Replaced action shortcuts
stop triggering that action. Text fields keep literal input; Ctrl+C remains an
emergency exit. Arrow navigation and optional Vim-style j/k remain independent.
Malformed/conflicting hand-edited keybindings fall back to defaults at startup.

## Online playlist queue continuation

Settings → Keyboard and mouse → Online playlist queue continuation is opt-in.
After enabling it, use Discover (`8`) to open an online album/playlist and press
Enter on a track. This starts its loaded collection and retains its next-page
cursor. Merely browsing, a search-result song, or A/P queueing does not enable it.

Near the last three upcoming tracks, the app requests one more metadata page
and appends new entries after your existing queue. Manual additions, reordering
and deletions remain intact. Already-seen track IDs are not added again from
later pages. This avoids repeating a broken provider page; intentional repeated
IDs on subsequent pages are also skipped. Initial queue duplicates are retained.

Limits: one outstanding page, 20-second request/wait bound, 100 continuation
pages or 10,000 unique tracks per context. Empty/repeated pages stop continuation.
Failures do not retry on every playback tick: `C` in Queue retries, then `n`
advances if playback already reached the end. Live radio and repeat-one do not
trigger automatic top-ups. No automatic music downloads or library imports.

Stopping/clearing, replacing the playback context, disabling the option or
quitting cancels that continuation and discards late results. Provider page
results may be shared with browsing; an already-running shared metadata request
can finish within its timeout, but cannot append after cancellation.
The cursor is session-only: restart restores the loaded queue paused, without
silently fetching more pages. Start the online collection again to continue it.

Inspired by [Orpheus](https://github.com/Cabritto-Corps/orpheus). No Spotify
account, new playback backend, crossfade or audio disk cache has been added.
