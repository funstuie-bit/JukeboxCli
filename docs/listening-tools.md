# Player polish and listening tools

Implemented in the **1.9.0 source build**. The published stable release and
Homebrew pin remain 1.8.2 until this work goes through release checks.

## Finding things

Press **Ctrl+K** for searchable commands: player controls, sections, chapters,
mini-player and listening tools. **Ctrl+E** opens listening tools directly;
Settings has the same entry. **Ctrl+B** hides/shows the sidebar. **Z** opens a
three-line mini-player; Z/Escape returns. Very short/narrow windows use mini mode
automatically, without saving a preference. Enlarge the window to get back.
Home keeps a compact cabinet at laptop sizes and a small badge below that.

These extra keys don't override an existing custom binding. Text fields keep
their editing chords. The clickable header is another way into Commands.
Mouse stays off/wheel/click according to your saved choice; Home Setup shows its
current mode. In click mode, rows highlight under the pointer, right-click opens
actions, and timeline/volume dragging follows the pointer at a bounded rate.
Shift-drag selects terminal text. LIVE broadcasts have no seeking target.

Clean layout shares medium-width screens more evenly. Home's recent/Continue and
station shelves show real saved items, with small covers when there's room.
Only visible shelf art is requested; there is no background recommendation feed.
The theme editor previews the shared palette across the interface chrome, lists,
menus and player. Save keeps it; Escape/leaving discards the draft. Built-in
solid palettes have text/selection contrast checks. A transparent background or
custom accent depends on your terminal; high contrast and solid mode are available.

## Timer, sound and format

Listening tools shows the codec, reported bitrate, decoded sample rate, output
sample rate and channels when mpv supplies them. Source decoding and output are
different; this is not a bit-perfect claim. Missing values stay unknown.

Choose a 15/30/60/90-minute preset or custom timer (1–1440 minutes, left/right adjusts one minute, Shift adjusts
five), end of track, or end of album when tags identify the boundary. Enter starts
it; Cancel removes it. End of album follows the queue's next known album/artist,
so shuffle and repeat affect what that boundary is. Use minutes for live radio.
Expiry pauses or disconnects, cancels pending loads and blocks automatic queue
advance. The queue stays. Explicit Play reloads at the retained position and
refreshes a streaming link; wake never starts playback. Timers don't survive quit.
Timers require mpv; JukeboxCli cannot pause playback handed to an external app.

EQ starts bypassed. Choose Flat, Warm, Voice or Electronic, or adjust ten bands
from −12 to +12 dB. Edits are a draft until **Save EQ**; leaving discards them.
Flat/bypass removes only the EQ stage. Enabled EQ processes at 48 kHz so the
16 kHz band also works with low-rate speech sources, and reserves gain headroom
for boosts. This does not guarantee against all clipping. The visualiser keeps
its separate analysis filter and pipes. A failed live edit retains the previous
settings; a build unable to load saved EQ plays bypassed and shows a notice.

## Resume, chapters and video results

History keeps up to 500 stable media IDs with progress. Old history loads without
conversion. Resume points are shared between duplicate occurrences of the same
media; queue occurrences remain independently editable. Resume inserts the chosen
item after the current occurrence without replacing the queue. It loads directly
at the stored position. Live streams are excluded. Home has a Continue entry;
video result actions offer **Resume** and **Start again**, with watched/resume
markers. Listening tools can clear resume points without deleting history/music.

Commands lists chapters and Previous/Next chapter when actual media or extractor
chapter metadata exists. Chapter seeking is disabled for LIVE/non-seekable items.
Wide video lists show channel, publication date, views and duration; narrow
windows use a compact row. Unreported metadata is a dash, not a guess.

**Download-size estimates are off by default.** Enable them in Listening tools
for a separate metadata lookup after highlighting a video for 600 ms. It uses
the audio downloader's format and your explicit cookie preference, cancels when
selection changes, times out after 15 seconds and keeps at most 40 numeric results
for five minutes in memory. No media/file is saved. A preview panel shows the
estimate where space permits. Transcoding or extracting from video can change
the final size, so those results say source size / saved size unknown. Missing
size stays unknown. It does not install/update yt-dlp or change authentication.

## Laptop events and power

The optional Mac helper is built with Apple's SDK during the normal build.
It uses IOKit sleep notifications, CoreAudio output/jack notifications and the
system Low Power Mode notification. No daemon or audio routing changes. It owns
no player and exits when the app pipe closes. If compilation or notifications
are unavailable, Listening tools reports that and manual controls still work.
Output disconnect detection depends on device properties; AirPods/Bluetooth
switches are not universally detectable. An ordinary output switch is not treated
as proof of unplugging.

On Linux, a scoped helper observes logind PrepareForSleep through dbus-monitor
when available. It kills its owned monitor on exit. This adapter doesn't claim
headphone-disconnect or system low-power detection. Neither platform installs a
permanent service, requests disk access, resets permissions or resumes on wake.

Low-power visuals can also be enabled manually. It stops decorative animation
and live-spectrum redraw subscriptions while keeping essential progress/input
updates. It doesn't change audio quality, stop downloads, disable mpv analysis
or claim system-wide energy savings. Hidden/mini player views stop their spectrum
subscriptions too. Artwork loads remain bounded to visible covers.

Automated state/lifetime tests and muted Mac playback checks cover these paths.
Physical lid/headphone/Bluetooth acceptance and Linux device behaviour still need
testing on the relevant hardware; they cannot be inferred from a Mac unit suite.

Interaction inspiration: [Musinator](https://github.com/smanookian/musinator),
[TubeTUI](https://github.com/polblancoo/tubetui) and
[Cloofy](https://github.com/parda21/cloofy). Implemented independently using the
existing JukeboxCli/mpv engine; no upstream source or artwork copied.
