/* SRHELL Shorts R14 — final Aura behavior polish.
   Keeps R11/R12 transport intact; no Share/audience controls are ported. */
const SRH_R14_META_LIMIT=72;
let srhR14LastArc=-1,srhR14ProbeTimer=0;

function srhR14Progress(){
  const fill=document.getElementById('srhR12ProgressFill'),d=el.shortVideo.duration,p=el.shortVideo.currentTime;
  if(!fill)return;
  const ratio=Number.isFinite(d)&&d>0?Math.max(0,Math.min(1,p/d)):0;
  fill.style.transform=`scaleX(${ratio})`;
}
function srhR14SyncArcLabel(){
  if(!state.current)return;
  const idx=currentArc();
  if(idx===srhR14LastArc)return;
  srhR14LastArc=idx;
  const label=el.shortArcs?.querySelector('small');
  if(label)label.textContent='Arco '+(idx+1);
}
function srhR14OpenArcSheet(){
  el.arcDrawer.classList.remove('is-hidden');
  drawArcs();
  requestAnimationFrame(()=>el.arcGrid.querySelector('.arc-button.is-active')?.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'}));
  srhR12ShowControls();
}

/* Keep metadata cache bounded; the player only needs recently opened titles. */
const srhR14LoadMetaBase=srhR12LoadMeta;
srhR12LoadMeta=async function(item){
  const result=await srhR14LoadMetaBase(item);
  while(srhR12MetaCache.size>SRH_R14_META_LIMIT){const first=srhR12MetaCache.keys().next().value;if(first===undefined)break;srhR12MetaCache.delete(first)}
  return result;
};

/* Duration probes are useful on the catalog but should not compete with playback. */
const srhR14ProbeBase=runProbeQueue;
runProbeQueue=function(){
  clearTimeout(srhR14ProbeTimer);
  if(!el.shortPlayer.classList.contains('is-hidden')){srhR14ProbeTimer=setTimeout(runProbeQueue,700);return}
  return srhR14ProbeBase();
};

/* Use Aura-style arc sheet behavior and current-arc label. */
el.shortArcs.onclick=e=>{e.preventDefault();e.stopPropagation();if(el.arcDrawer.classList.contains('is-hidden'))srhR14OpenArcSheet();else el.arcDrawer.classList.add('is-hidden')};

/* Progress stays on the compositor instead of relayouting width on every tick. */
el.shortVideo.addEventListener('timeupdate',()=>{srhR14Progress();srhR14SyncArcLabel()},{passive:true});
el.shortVideo.addEventListener('loadedmetadata',()=>{srhR14Progress();srhR14SyncArcLabel()},{passive:true});
el.shortVideo.addEventListener('durationchange',srhR14Progress,{passive:true});

/* Reset the cheap UI state when switching videos. */
const srhR14OpenShortBase=openShort;
openShort=function(item,resumeAt=0){srhR14LastArc=-1;const out=srhR14OpenShortBase(item,resumeAt);requestAnimationFrame(()=>{srhR14Progress();srhR14SyncArcLabel()});return out};

/* When playback closes, let background probes resume after the transition. */
const srhR14CloseShortBase=closeShort;
closeShort=async function(){const out=await srhR14CloseShortBase();setTimeout(runProbeQueue,180);return out};

/* Cheap prefetch of the next title's metadata only when the browser is idle. */
function srhR14PrefetchNext(){
  if(!state.current||el.shortPlayer.classList.contains('is-hidden'))return;
  const items=currentShortItems(),id=String(state.current.streamId||''),idx=items.findIndex(x=>String(itemId(x))===id),next=idx>=0?items[idx+1]:null;
  if(!next)return;
  const task=()=>srhR12LoadMeta(next).catch(()=>{});
  if(typeof requestIdleCallback==='function')requestIdleCallback(task,{timeout:1600});else setTimeout(task,650);
}
el.shortVideo.addEventListener('playing',srhR14PrefetchNext,{passive:true});

srhR14Progress();
