// Owned muted mpv, generated low-rate fixture; no user profile or network.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
const directory = mkdtempSync(path.join(os.tmpdir(),"jukebox-tools-"));
process.env.JUKEBOXCLI_HOME = directory;
process.env.JUKEBOXCLI_MEDIA_KEYS = "0";
const { Playback } = await import("../src/player/playback");
const { EQ_PRESETS } = await import("../src/player/audio-tools");
const file = path.join(directory,"tone.wav");
await execa("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","sine=frequency=125:sample_rate=22050:duration=20","-c:a","pcm_f32le",file]);
const track = {id:"tone",title:"Muted fixture",source:"local" as const,sourceTrackId:"tone",filePath:file,addedAt:"2026-01-01",durationSec:20};
const playback = new Playback("mpv",()=>{throw Error("External player unexpected");});
let samples = false;
playback.on("spectrum",(levels:number[])=>{if(levels.some(db=>db > -80)) samples = true;});
const wait = async (predicate:()=>boolean) => {
  const deadline = Date.now()+6000;
  while(!predicate()) { assert(Date.now()<deadline,"Timed out awaiting player state"); await new Promise(r=>setTimeout(r,50)); }
};
let owned: number | undefined;
try {
  await playback.setVolume(0);
  await playback.setEqualizer({enabled:true,gains:EQ_PRESETS.Warm!});
  await playback.play(track,[track,{...track,id:"next"}]);
  assert.equal(playback.getState().error,undefined);
  owned = playback.mpvProcessId; assert(owned);
  await wait(()=>samples && !!playback.getState().audioDetails?.outputRate);
  const player = (playback as unknown as {mpv:import("../src/player/mpv").MpvPlayer}).mpv;
  const filters = await player.command(["get_property","af"]) as {label?:string}[];
  assert(filters.some(f=>f.label==="jukebox-eq")); assert(filters.length>=2,"Analysis and EQ must coexist");
  assert.equal(await player.command(["get_property","volume"]),0);
  assert.equal(playback.getState().audioDetails?.decodedRate,22050);
  if(process.argv.includes("--resources")) {
    for(const [name,pid] of [["Node",process.pid],["mpv",owned]] as const) {
      const {stdout}=await execa("ps",["-p",String(pid),"-o","pcpu=,rss="]);
      console.log(`${name} playing sample: CPU% / RSS KiB = ${stdout.trim()}`);
    }
  }
  await playback.setEqualizer({enabled:false,gains:[]});
  const bypassed = await player.command(["get_property","af"]) as {label?:string}[];
  assert(!bypassed.some(f=>f.label==="jukebox-eq")); assert(bypassed.length>=1,"Analysis remains after bypass");
  await playback.seekTo(5); await playback.suspendPlayback();
  assert.equal(playback.getState().paused,true);
  await playback.togglePause(); assert.equal(playback.mpvProcessId,owned);
  assert.equal(playback.getState().list.length,2);
  playback.setSleepTimer("minutes",.02);
  await wait(()=>playback.getState().sleepTimer===undefined);
  assert.equal(await player.command(["get_property","pause"]),true);
  assert.equal(playback.getState().track?.id,track.id);
  console.log("PASS: low-rate audio, telemetry, EQ + spectrum, bypass, sleep/resume and timer; one muted mpv");
} finally {
  playback.quit();
  const deadline = Date.now()+3000;
  while(owned && Date.now()<deadline) { try { process.kill(owned,0); await new Promise(r=>setTimeout(r,50)); } catch { owned=undefined; } }
  assert.equal(owned,undefined,"Owned player must exit");
}
