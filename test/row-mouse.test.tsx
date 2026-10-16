import { useState, type ReactNode } from "react";
import { Box } from "ink";
import { expect, it, vi } from "vitest";
import { StoreContext, type Store } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { RowMenuProvider, RowMenuOverlay } from "../src/ui/components/RowActions";
import { SongList } from "../src/ui/components/SongList";
import { trackFromUrl } from "../src/player/url";
import { Home } from "../src/ui/sections/Home";
import { Select } from "../src/ui/components/Select";
import { SettingsChoices } from "../src/ui/components/SettingsChoices";
import { MouseRow } from "../src/ui/components/MouseRow";
import { mouseEvents } from "../src/ui/mouse";
import { renderReady, act, press } from "./ink-input";

function Harness({ store, children }: { store: Store; children: ReactNode }) {
  const [captureMode, setCaptureMode] = useState(store.captureMode);
  return <StoreContext.Provider value={{ ...store, captureMode, setCaptureMode }}><RowMenuProvider>
    <Box width={100} height={30} flexDirection="column">{children}<RowMenuOverlay /></Box>
  </RowMenuProvider></StoreContext.Provider>;
}
async function click(view: Awaited<ReturnType<typeof renderReady>>, label: string, right = false) {
  const rows = view.lastFrame()!.split("\n");
  const y = rows.findIndex(r => r.includes(label));
  expect(y, label).toBeGreaterThanOrEqual(0);
  await act(async () => { mouseEvents.emit("press", { x: rows[y]!.indexOf(label) + 1, y, button: right ? "right" : "left" }); });
}
function store() { const s = makeStore({ cols: 100, rows: 30, contentWidth: 98, listRows: 24, region: "content" }); s.config.mouseMode = "click"; return s; }
it("plays clicked list rows and queues the right-clicked item without playing underneath", async () => {
  const s = store(), play = vi.fn(), queue = vi.fn(), remove = vi.fn();
  const view = await renderReady(<Harness store={s}><SongList focused groups={[{items:[{ value:"one",title:"First song" },{ value:"two",title:"Second song" }]}]} onSelect={play} onQueue={queue} onDelete={remove} /></Harness>);
  await click(view, "Second song"); expect(play).toHaveBeenLastCalledWith("two"); play.mockClear();
  await click(view, "First song", true); expect(view.lastFrame()).toContain("Add to queue");
  await press(view, "d"); expect(remove).not.toHaveBeenCalled();
  await click(view, "Add to queue"); expect(queue).toHaveBeenCalledWith("one", false); expect(play).not.toHaveBeenCalled();
  expect(view.lastFrame()).not.toContain("Add to queue");
  await click(view, "Second song", true); await press(view, "\x1b");
  await vi.waitFor(() => expect(view.lastFrame()).not.toContain("Add to queue"));
  await press(view, "\r"); expect(play).toHaveBeenCalledWith("two");
});
it("opens Home navigation with a single click", async () => {
  const s = store(); s.setSection = vi.fn();
  const view = await renderReady(<Harness store={s}><Home /></Harness>);
  await click(view, "Local music library"); expect(s.setSection).toHaveBeenCalledWith("library");
});
it("clicks nested select options and live preference rows", async () => {
  const s = store(), choose = vi.fn(), focus = vi.fn();
  const view = await renderReady(<Harness store={s}>
    <Select options={[{label:"Back",value:"back"},{label:"Install pack",value:"install"}]} onChange={choose} />
    <SettingsChoices title="Appearance" height={8} focused onFocus={focus} onSelect={choose} options={[{ label:"Artwork toggle",value:"art"}]} />
  </Harness>);
  await click(view, "Install pack"); expect(choose).toHaveBeenLastCalledWith("install");
  await click(view, "Artwork toggle"); expect(choose).toHaveBeenLastCalledWith("art"); expect(focus).toHaveBeenCalledWith("art");
});
it("gives a nested queue row precedence over the player context menu", async () => {
  const s = store(), parent = vi.fn(), play = vi.fn();
  const view = await renderReady(<Harness store={s}><MouseRow active onClick={() => {}} onContextMenu={parent}>
    <SongList focused groups={[{items:[{value:"one",title:"Nested track"}]}]} onSelect={play} />
  </MouseRow></Harness>);
  await click(view, "Nested track", true); expect(parent).not.toHaveBeenCalled();
  await click(view, "Open"); expect(play).toHaveBeenCalledWith("one");
});

it("opens recent Home tracks with queue actions without starting playback", async () => {
  const s = store(), track = trackFromUrl("https://example.com/audio.mp3");
  track.title = "Recent acceptance track"; s.history.record(track);
  s.playTrack = vi.fn(); s.playback.enqueue = vi.fn();
  const view = await renderReady(<Harness store={s}><Home /></Harness>);
  await click(view, "Recent acceptance track", true);
  expect(s.playTrack).not.toHaveBeenCalled();
  await click(view, "Play next"); expect(s.playback.enqueue).toHaveBeenCalledWith(track, true);
  await click(view, "Recent acceptance track"); expect(s.playTrack).toHaveBeenCalledWith(track);
});
