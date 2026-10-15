# Audio and video playback

Source preview 1.6.0-dev.3; stable release/Homebrew remain 1.5.0.

In Discover (`8`), choose **YouTube Music** or **YouTube Videos** with `Y`
(Shift+y) when not typing, or click a source label in click mouse mode. If the
search field is focused, Escape leaves typing first. YouTube Music retains its
song/music-video/album/artist/playlist filters; YouTube Videos searches ordinary
YouTube videos, including talks, tutorials, documentaries and long music mixes.
Changing catalogue repeats the current query and clears the old results. Press
`/` to enter a new search, and `L` for another page. Searching alone does not play
or download anything. Channel, duration/live status, publication and view details
appear when supplied. This remains a list with an explicit Details action; a
persistent preview pane is not part of this build. Player search's existing
`v:` shortcut still searches music videos; general video search lives in Discover.

In Discover, search, select a playable result and press `c`. With mouse
mode set to **click** in Settings, right-click the row to open the same menu.
Choose Play audio, Play video, Play next, Add to queue, Download or Details.
Arrow keys/Enter or a left click choose an action; Escape dismisses it.
The result list and selection remain in place. Enter on a result plays audio;
Enter on an album/artist/playlist opens it as before.

Video opens a separate mpv window. In Player (`m`), `W` switches the current item
between audio and video (rebindable in Settings). Existing transport, seeking
and volume still control the same mpv process. The change reloads the stream,
so there is a brief interruption; it retains pause, volume and the recorded
position when seekable. Live and non-seekable sources reconnect without seeking.

Closing the video window stops the current item, keeps the queue, and leaves
JukeboxCli running. Choose another queue row to play again. Following queue
entries, session restoration and ordinary Enter playback default to audio.
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
