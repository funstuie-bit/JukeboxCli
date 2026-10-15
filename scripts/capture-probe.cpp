#include <pulse/pulseaudio.h>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <chrono>
#include <cstdlib>
class QProjectM_MainWindow { public: double sum=0; unsigned long count=0; void addPCM(float* data, size_t n) { for(size_t i=0;i<n;i++)sum+=data[i]*data[i]; count+=n; } };
#include "../native/linux-visualizer/jukebox-capture.hpp"
static QProjectM_MainWindow view;
static void ready(pa_context* c, void* pid) { if(pa_context_get_state(c)==PA_CONTEXT_READY) JukeboxCapture::start(c,&view,(char*)pid); }
int main(int argc,char** argv) {
 auto loop=pa_mainloop_new(); auto c=pa_context_new(pa_mainloop_get_api(loop),"Jukebox capture acceptance");
 pa_context_set_state_callback(c,ready,argv[1]);pa_context_connect(c,nullptr,PA_CONTEXT_NOFLAGS,nullptr);
 auto start=std::chrono::steady_clock::now();int last=-1;
 while(true){pa_mainloop_iterate(loop,0,nullptr);int sec=std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now()-start).count(); if(sec!=last){printf("%d %lu %.6f\n",sec,view.count,view.count?sqrt(view.sum/view.count):0);fflush(stdout);view.sum=0;view.count=0;last=sec;}if(sec>=10)break;usleep(1000);}
 JukeboxCapture::stop();pa_context_disconnect(c);pa_context_unref(c);pa_mainloop_free(loop);
}
