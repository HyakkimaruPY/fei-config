/* Shorts R24 — minimal runtime polish. Loaded inside the historical IIFE after core definitions. */

/* 1) Throttle feed virtualization to animation frames instead of every scroll event. */
const srhR24RenderGridBase=renderGrid;
let srhR24ScrollRaf=0;
renderGrid=function(force=false){
  if(force){
    if(srhR24ScrollRaf){cancelAnimationFrame(srhR24ScrollRaf);srhR24ScrollRaf=0}
    return srhR24RenderGridBase(true);
  }
  if(srhR24ScrollRaf)return;
  srhR24ScrollRaf=requestAnimationFrame(()=>{
    srhR24ScrollRaf=0;
    srhR24RenderGridBase(false);
  });
};

/* 2) Duration metadata probes wait for scroll idle and run one at a time. */
let srhR24ProbeTimer=0;
setProbeWindow=function(items){
  const list=Array.isArray(items)?items:[];
  state.probeWanted=new Set(list.map(itemId).filter(Boolean));
  state.probeQueue=state.probeQueue.filter(x=>state.probeWanted.has(itemId(x)));
  clearTimeout(srhR24ProbeTimer);
  srhR24ProbeTimer=setTimeout(()=>{
    for(const item of list)queueDurationProbe(item);
    runProbeQueue();
  },220);
};
runProbeQueue=function(){
  if(state.probeActive>0||!state.probeQueue.length)return;
  const item=state.probeQueue.shift(),id=itemId(item);
  if(!state.probeWanted.has(id)){
    state.probeQueued.delete(id);
    return runProbeQueue();
  }
  state.probeActive=1;
  request({action:'get_vod_info',vod_id:id})
    .then(data=>{const d=durationFrom(item,data);if(d>0)saveDuration(id,d)})
    .catch(()=>{})
    .finally(()=>{state.probeActive=0;setTimeout(runProbeQueue,90)});
};

/* 3) Keep the player covering the page until the underlying visible covers are ready.
      This removes the raw white/theme skeleton flash when swiping back from a video. */
async function srhR24WaitVisibleFeed(timeoutMs=180){
  await new Promise(r=>requestAnimationFrame(r));
  const viewport=el.feedScroller.getBoundingClientRect();
  const imgs=[...el.feedSpacer.querySelectorAll('.short-card__image')].filter(img=>{
    const r=img.getBoundingClientRect();
    return r.bottom>=viewport.top-80&&r.top<=viewport.bottom+80;
  }).slice(0,8);
  if(!imgs.length)return;
  const waits=imgs.map(img=>{
    if(img.complete&&img.naturalWidth>0)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>resolve();
      img.addEventListener('load',done,{once:true});
      img.addEventListener('error',done,{once:true});
    });
  });
  await Promise.race([
    Promise.all(waits),
    new Promise(resolve=>setTimeout(resolve,timeoutMs))
  ]);
}

closeShort=async function(){
  persistProgress();
  el.shortVideo.pause();
  destroyHls();
  el.arcDrawer.classList.add('is-hidden');

  /* Leave fullscreen first while the player itself is still visible. */
  await leavePortraitFullscreen();
  state.current=null;

  /* Preserve the already rendered feed whenever possible. If layout changed while
     fullscreen was closing, rebuild it behind the still-visible player. */
  if(!el.feedSpacer.querySelector('.short-card'))renderGrid(true);
  else renderGrid(false);
  await srhR24WaitVisibleFeed();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  el.shortPlayer.classList.add('is-hidden');
};

/* The original handler captured the old function reference, so bind the polished close. */
el.shortClose.onclick=closeShort;
