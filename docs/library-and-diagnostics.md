# Library tools and diagnostics — 1.4

These features are included in JukeboxCli 1.4.0 on Mac and Linux, including Homebrew.

## Portable playlist files

Open Playlists (`2`). `I` imports a file; `E` exports the playback queue, or the
downloaded playlist when you have opened one. Enter a full filename ending in
`.json`, `.m3u` or `.m3u8`; `~` expands to your home folder. The destination folder
must already exist. Existing files are never overwritten: choose a new filename.

Import shows the available, missing and unsupported counts first. `A` appends
the available entries; `P` queues them next. Esc leaves without queueing anything.
There is no automatic playback, download, folder rename or library import.
Importing affects the playback queue, not the downloaded-folder collections.

JSON preserves stream type, title and artist. M3U preserves titles and uses
comments to retain JukeboxCli stream types. Both retain order and duplicates.
Local references are relative to your configured music folder, not the exporting
Mac's home directory. Keep the same subfolder layout on the receiving machine
and let JukeboxCli index its music before importing. Missing local files are
reported and skipped; JukeboxCli does not guess a replacement by song title.
Files outside the music folder are omitted from exports with a count.

For external M3U files, local entries must likewise be relative to the music
folder. Absolute paths, parent traversal, non-HTTP stream schemes, credentials
in URLs and remote playlist fetching are not supported. JSON is recommended for
transferring mixed queues between JukeboxCli installations. Limits: 2 MB and
10,000 entries. Imports read regular files, not symlinks or named pipes.

Exports contain track names and full stable stream/page URLs. A private radio
URL may contain a query token: review playlist files before sharing them.
Exports do not contain browser cookies or resolved YouTube media URLs.

## Genres

In Library (`1`), `B` now cycles songs → artists → albums → genres. Enter opens a
group; Esc returns. Existing filters, search, marking and queue actions work.
Genre appears in track details (`i`) and is included in Library search.

Settings (`5`) → **Scan genre tags** reads local tags with ffprobe. Enter starts;
`c` stops, and leaving the page cancels. Completed index updates are retained.
It does not rewrite, rename or move audio files or contact metadata services.
New downloads also retain a genre when yt-dlp supplies one.

Untagged files stay under **Unknown genre**. Genre strings are grouped
case-insensitively, but compound tags are not split or guessed. Scanning is
explicit so launching a large library does not start thousands of probes.

## Session diagnostics

Settings → **Session diagnostics** shows recent player/download errors plus the
existing download-failure log. Arrows/Page Up/Page Down scroll; `R` refreshes.
`E` writes a new private-permission text report in the profile's `logs/reports`
folder; the screen shows its location. Nothing is uploaded or opened automatically.

Completed download attempts record elapsed time, last reported speed, phase and
pacing settings without track names or URLs, to help distinguish slow transfers
from conversion work. The speed is a final sample, not an average or benchmark.

The session log rotates at roughly 256 KB; the viewer reads bounded tails rather
than loading an entire old log. New error entries and exported reports redact
URLs, home paths, email/IP addresses, common credential fields and terminal
control sequences. Raw configuration and cookie files are never attached.
Redaction is best effort: review a report before posting it publicly. Reports
are explicit snapshots, not a full debug trace or recordings of your listening.

## Optional interface controls

- **Player appearance → Artwork colours:** derive readable accent colours from
  current cover art for Now Playing and its queue. No art/monochrome art falls
  back to your chosen theme. The rest of the interface keeps the selected theme.
- **Keyboard and mouse → Vim-style j/k:** j moves down; k moves up in lists and
  pickers. Space remains pause. The former j-seek/k-pause aliases are disabled
  in this mode; arrows and other shortcuts still work. Text fields receive
  literal j/k. This is vertical navigation, not a complete Vim command language.
- **Mouse:** off, wheel (default), or click. Click mode adds row selection in
  song lists and the playback queue, and sidebar navigation. Clicking a track
  does not play or delete it; Enter plays. Mouse reporting is disabled in text
  fields. Terminal text selection may require Shift-drag while reporting is on.
- **Discover load more:** optionally fetch the next result page near the end of
  the focused list. Off by default; `L` remains available. Stops at an empty page
  or 10,000 entries. It never downloads music, starts playback or silently extends
  the playback queue. Failed pages remain available for manual retry.

## Hands-on checks still needed

Long MilkDrop sessions on a direct display, iTerm2 image repainting, physical
Mac media keys/Control Centre and more Linux terminal/keyring combinations remain
acceptance checks. A unit test or remote terminal session cannot certify those.
