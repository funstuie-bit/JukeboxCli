# Audio and video playback

Source preview 1.6.0-dev.8; stable release/Homebrew remain 1.5.0.

Choose **YouTube Videos** in the sidebar or press **Y** (Shift+y) outside a text
field. On first visit the search field is ready to type into. Submit a query,
select a result and press **Enter to play video**, or **a for audio only**.
The query stays visible; `/` or clicking it in click mouse mode edits it.
Escape leaves typing. `L` loads more results. Searching does not play anything.

**Music Discover** remains on `8`, with YouTube Music's song/music-video/album/
artist/playlist filters and Enter for audio. Each section retains its own query,
results and selection when you leave and return during this app session. This
browsing state is held in memory, not saved across application restarts.
Player search's existing `v:` shortcut still searches music videos.

Video results have title, channel and duration columns when space permits,
otherwise a compact list. `▶` means video, `●` plus LIVE means live, and `✓` means
already queued. Music browsing uses `♫`. No special icon font is required.
`TERM=dumb` or `JUKEBOXCLI_ICONS=ascii` uses plain symbols instead.

In either section, `c` or right-click in click mouse mode opens Play audio,
Play video, Play next, Add to queue, Download or Details. Choose using arrows /
Enter or a left click; Escape dismisses. Downloads use the existing audio flow.
Details remain an explicit action; a persistent preview pane is deferred.

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

Video requires mpv and a source containing a video track. A failed video request
shows an error and offers switching back to audio. This preview selects the best
**combined audio/video format** supplied by yt-dlp; it does not merge separate
adaptive streams, so some sources offer lower resolution or no combined format.
The audio/video URL caches are separate, expire, and remain bounded. Signed URLs
are never saved in the listening session or displayed in errors.

Linux acceptance passed for generated local video, a public YouTube video and
a controlled live HTTP broadcast. Mode switching used one mpv PID, retained
paused local position/volume, and compositor window closure stopped the item.
One public YouTube live link could not resolve; broad live-source acceptance
remains pending. Automated coverage includes mode selection/cache separation,
queue defaults, window shutdown and keyboard/right-click actions. Physical macOS video-window acceptance remains pending;
shared source and automated checks do not establish that hardware result.

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
literal search text. Results survive section changes within the current session;
restarting the app starts a fresh search session.

## Downloading versus live playback

Live broadcasts can be played as audio or video, but ordinary Download does not
record them. Known live results explain this immediately; pasted links and older
queue entries are checked by yt-dlp before media is saved. The queue reports
“live stream — play only”. Finished recordings remain downloadable. Timed live
recording is not implemented. Cancellation/pause and app exit clean up only the
process group belonging to each download, including ffmpeg, leaving playback alone.

In preview dev.9, a single left-click on a YouTube Videos result plays video;
Music Discover plays audio or opens the clicked collection. Right-click retains
the audio/video choice and queue/download actions. Home and saved listening
lists also have play/queue menus, and Settings submenus accept left-click.
