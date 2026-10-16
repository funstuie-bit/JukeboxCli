# Audio and video playback

Available in JukeboxCli 1.6.2 on Mac and Linux, including the Mac Homebrew tap.
Separate video/audio streaming arrived in 1.6.1; 1.6.2 fixes missing HLS soundtracks.

Choose **YouTube Videos** in the sidebar or press **Y** (Shift+y) outside a text
field. On first visit the search field is ready to type into. Submit a query,
select a result and press **Enter to play video**, or **a for audio only**.
The query stays visible; `/` or clicking it in click mouse mode edits it.
Escape leaves typing. `L` loads more results. Searching does not play anything.

**Music Discover** remains on `7`, with YouTube Music's song/music-video/album/
artist/playlist filters and Enter for audio. Each section retains its own query,
results and selection when you leave and return during this app session. They also
save up to 30 recent searches and 100 results from the last successful search per
catalogue across restarts. Saved results reopen immediately, including selection,
without playback or provider requests. Press `/` then Enter to refresh the query
and retrieve fresh pagination; provider continuation callbacks are not persisted.
Collection drill-down and deeper back-navigation remain session-only.

Press **h** outside text entry, click the results footer, or click **Recent searches**
while typing. Choose a query with arrows/Enter or a left click to search again.
**Clear saved searches** removes that catalogue's saved queries/results; the other
catalogue and listening history stay intact. Search history is stored privately in
`search-history.json` in the profile's data directory, not in diagnostics exports.
Player search's existing `v:` shortcut still searches music videos.

Video results have title, channel and duration columns when space permits,
otherwise a compact list. `▶` means video, `●` plus LIVE means live, and `✓` means
already queued. Music browsing uses `♫`. No special icon font is required.
`TERM=dumb` or `JUKEBOXCLI_ICONS=ascii` uses plain symbols instead.

In either section, `c` or right-click in click mouse mode opens Play audio,
Play video, Play next, Add to queue, Download or Details. Choose using arrows /
Enter or a left click; Escape dismisses. Downloads use the existing audio flow.
YouTube Videos shows a compact thumbnail/details card alongside the list when
content is at least 88 columns wide and 15 rows high (roughly a 117-column terminal,
with extra height for the app chrome). It follows the highlighted result and shows
title, channel, duration/live status and available date/view metadata. **i** toggles
it; smaller windows automatically hide it. The border fits the content rather than
the terminal height, titles have two lines, and thumbnails preserve the whole
landscape image in block, Sixel and native image modes. Scrolling settles for 180 ms before
artwork decoding, and overlays suppress native graphics so menus remain visible.
Details also remains available as an explicit action. Artwork failure falls back to
text and never blocks navigation or playback.

Video opens a separate mpv window. In Player (`m`), `W` switches the current item
between audio and video (rebindable in Settings). Existing transport, seeking
and volume still control the same mpv process. The change reloads the stream,
so there is a brief interruption; it retains pause, volume and the recorded
position when seekable. Live and non-seekable sources reconnect without seeking.

Closing the video window stops the current item, keeps the queue, and leaves
JukeboxCli running. Choose another queue row to play again. Following queue
entries, session restoration and Enter in Music Discover default to audio; Enter in YouTube Videos explicitly
requests video.
No second audio player is started, and existing parent-exit cleanup remains.

Video requires mpv and a source containing a video track. In 1.6.1,
yt-dlp selects separate video/audio formats when available, falling back
to a combined stream or silent video. The existing mpv plays both streams; no
media files are downloaded or merged on disk. Switching back to audio clears
the separate soundtrack. Position, pause, volume and the queue stay intact.

Format, source-blocking/cookie, unavailable-video and lookup-timeout failures
show a safe reason and offer switching back to audio. Raw extractor output and
signed links are not shown or saved. Audio/video lookup caches remain separate
and bounded; a paired video's cache expires when either link expires. A failed
load refreshes both links once. Sources requiring conflicting HTTP headers for
their picture and sound are refused explicitly.

Version 1.6.2 retains selected HLS audio even when yt-dlp omits its codec name.
If mpv's video playlist load loses the external soundtrack, JukeboxCli explicitly
attaches it to the same player. On the existing single YouTube playback retry,
HLS audio is preferred where available to avoid repeatedly opening a blocked
direct-audio link. Configured cookies are retained; there is no anonymous fallback.
Changing cookie selection clears cached stream links. Cookie-read errors are
reported separately from source blocking. Browser selection does not prove login
state or guarantee access to every video.

Developers can run `npx tsx scripts/smoke-video.ts` for an isolated, muted test
using generated separate-stream files. Add a public YouTube URL to test the real
extractor and mpv. The script checks video/audio/video switching, one player
process, retained position/queue and cleanup. It uses system yt-dlp, an isolated
profile and no browser cookies; it never modifies the user's music or settings.
It also checks the decoded audio clock and configured audio output. This is
muted acceptance, not a claim about physical speakers or system volume settings.

The 1.6.1 playback implementation passed that check on Apple Silicon macOS using generated
separate-stream files and a public YouTube video that failed in 1.6.0. Both video
and audio loaded, playback advanced, mode switches kept one mpv process and the
queue/paused position, and quitting removed the test player. Wider source,
terminal and physical media-control acceptance remains ongoing.

Linux acceptance passed for generated local video, a public YouTube video and
a controlled live HTTP broadcast. Mode switching used one mpv PID, retained
paused local position/volume, and compositor window closure stopped the item.
One public YouTube live link could not resolve; broad live-source acceptance
remains pending. Automated coverage includes mode selection/cache separation,
queue defaults, window shutdown and keyboard/right-click actions. The Mac smoke
check above opened the native GPU window; broader visual, terminal and physical
media-control acceptance remains pending.

## Right-click menus

Set Settings → Keyboard and mouse → Mouse to **click**. Right-click a result in
Music Discover or YouTube Videos to choose its audio/video, queue, download or
details actions. Right-click Now Playing for pause/resume, previous/next,
volume, audio/video switching and fullscreen effects. **c** opens either menu
without mouse support; arrows and Enter choose, Escape closes. Player shortcuts
are suspended while its menu is open. Unavailable actions are dimmed.
Menus appear over the existing view near the clicked row/location, clamped inside
the view. Background playback, visualisers and list layout remain intact. Click
outside, c or Escape closes without activating controls beneath the popup.
Native terminal artwork temporarily uses block rendering to keep menus on top.

While typing a search, sidebar clicks still navigate in click mode. Enter submits;
Escape or the clickable cancel hint leaves the field. Letters such as q remain
literal search text. Successful searches also survive application restarts as described above.

## Downloading versus live playback

Live broadcasts can be played as audio or video, but ordinary Download does not
record them. Known live results explain this immediately; pasted links and older
queue entries are checked by yt-dlp before media is saved. The queue reports
“live stream — play only”. Finished recordings remain downloadable. Timed live
recording is not implemented. Cancellation/pause and app exit clean up only the
process group belonging to each download, including ffmpeg, leaving playback alone.

Left-click plays audio, including YouTube Videos results.
Enter in YouTube Videos still plays video. Right-click offers Play audio / Play
video on known video items in Home recent history, Library, History, playlists,
Queue, Radio / URL and player search, as well as existing discovery menus.

Downloaded YouTube tracks use the original online video for Play video. This
needs network access and the same streaming authentication as ordinary YouTube
playback; it does not download a video or alter the saved audio file. Switching
back to audio uses the saved file. Known local video files and direct video URLs
also offer the choice. Radio, audio-only files and unknown URLs keep Play; menus
do not make network probes to guess whether a source has video.
