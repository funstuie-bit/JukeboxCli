import subprocess, tempfile, os, time, socket, json
from pathlib import Path
build=tempfile.TemporaryDirectory(prefix='jukebox-capture-build-')
probe=build.name+'/probe'
subprocess.run(['c++','-include','unistd.h',str(Path(__file__).with_name('capture-probe.cpp')),'-lpulse','-o',probe],check=True)
name='jukebox_acceptance_' +str(os.getpid())
module=subprocess.check_output(['pactl','load-module','module-null-sink','sink_name='+name],text=True).strip()
children=[]
try:
 with tempfile.TemporaryDirectory(prefix='capture-test-') as tmp:
  def player(hz,key):
   sock=tmp+'/'+key
   p=subprocess.Popen(['mpv','--no-config','--no-video','--ao=pulse','--audio-device=pulse/'+name,'--input-ipc-server='+sock,'--idle=yes','av://lavfi:sine=frequency='+str(hz)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);children.append(p);return p,sock
  target,ipc=player(440,'selected');other,_=player(880,'other');time.sleep(1)
  capture=subprocess.Popen([probe,str(target.pid)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);children.append(capture)
  def pause(value):
   with socket.socket(socket.AF_UNIX) as s:s.connect(ipc);s.sendall((json.dumps({'command':['set_property','pause',value]})+'\n').encode());s.recv(4096)
  time.sleep(3);pause(True);time.sleep(4);pause(False)
  out,err=capture.communicate(timeout=15);print(out);print(err)
  rows=[line.split() for line in out.splitlines()];samples={int(r[0]):float(r[2]) for r in rows}
  assert samples[2]>.001 and samples[5]<.00001 and samples[6]<.00001 and samples[9]>.001,samples
  print('PASS: selected mpv signal; silence while selected paused despite unrelated tone; recovery after resume')
finally:
 for p in children:
  if p.poll() is None:p.terminate()
 for p in children:
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:p.kill();p.wait()
 subprocess.run(['pactl','unload-module',module],check=True)

build.cleanup()
