import { expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

it("Linux observer reports logind events and removes its owned monitor on parent EOF",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"jukebox-logind-")), pidFile=path.join(dir,"pid");
  await writeFile(path.join(dir,"dbus-monitor"),`#!${process.execPath}\nimport {writeFileSync} from 'node:fs'; writeFileSync(process.env.JUKEBOX_TEST_PID,String(process.pid));console.log('signal PrepareForSleep\\n   boolean true\\n   boolean false');setInterval(()=>{},1000);`,{mode:0o755});
  const child=spawn(process.execPath,[path.resolve("native/platform-events/linux.mjs")],{env:{...process.env,PATH:`${dir}:${process.env.PATH}`,JUKEBOX_TEST_PID:pidFile},stdio:["pipe","pipe","pipe"]});
  let output="", owned:number|undefined;
  child.stdout.on("data",d=>{output+=d;});
  const exited=new Promise<void>(resolve=>child.once("exit",()=>resolve()));
  const wait=async(predicate:()=>boolean)=>{const until=Date.now()+4000;while(!predicate()){if(Date.now()>until)throw Error("Platform helper timed out");await new Promise(r=>setTimeout(r,20));}};
  try {
    await wait(()=>output.includes('"wake"')); owned=Number(await readFile(pidFile,"utf8"));
    expect(output).toContain('"ready-linux"');expect(output).toContain('"sleep"');
    child.stdin.end(); await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error("Helper did not exit")),4000).unref())]);
    await wait(()=>{try{process.kill(owned!,0);return false;}catch{return true;}});
    owned=undefined;
  } finally {child.kill("SIGTERM");if(owned)try{process.kill(owned,"SIGTERM");}catch{} await rm(dir,{recursive:true,force:true});}
});
