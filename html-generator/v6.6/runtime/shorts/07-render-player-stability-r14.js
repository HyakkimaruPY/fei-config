/* SRHELL v6.6 — Shorts R14
   Fixes card recycling/flicker, keeps cover visible until playback really starts,
   and makes the whole control layer obey the same 4-second inactivity rule. */

let srhR14ProbeObserver=null;
let srhR14PosterToken='';
let srhR14HasStarted=false;
const srhR14Poster=document.createElement('div');
srhR14Poster.className='srh-r14-poster';
srhR14Poster.innerHTML='<img id="srhR14PosterImage" alt="">';
if(srhR12Frame)srhR12Frame.insertBefore(srhR14Poster,srhR12Frame.firstChild);
const srhR14PosterImage=document.getElementById('srhR14PosterImage');

function srhR14GridSignature(items){
  const first=items[0] ? itemId(items[0]) : '',last=items.length?itemId(items[items.length-1]):'';
  return ['r14',items.length,first,last,state.filteredItems?'filtered':'all'].join(':');
}
function srhR14ObserveProbes(items){
  if(srhR14ProbeObserver){try{srhR14ProbeObserver.disconnect()}catch{}srhR14ProbeObserver=null}
  const valid=new Set(items.map(itemId).filter(Boolean));
  state.probeWanted=new Set([...state.probeWanted].filter(id=>valid.has(id)));
  state.probeQueue=state.probeQueue.filter(item=>valid.has(itemId(item)));
  const cards=[...el.feedSpacer.querySelectorAll('[data-index]')];
  if(!('IntersectionObserver' in window)){
    const initial=items.slice(0,Math.min(24,items.length));
    initial.forEach(item=>state.probeWanted.add(itemId(item)));
    initial.forEach(queueDurationProbe);runProbeQueue();return;
  }
  srhR14ProbeObserver=new IntersectionObserver(entries=>{
    let changed=false;
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const idx=Number(entry.target.dataset.index),item=items[idx],id=item&&itemId(item);
      if(!item||!id)continue;
      if(!state.probeWanted.has(id)){state.probeWanted.add(id);changed=true}
      queueDurationProbe(item);
      srhR14ProbeObserver.unobserve(entry.target);
    }
    if(changed)runProbeQueue();
  },{root:el.feedScroller,rootMargin:'650px 0px',threshold:0.01});
  cards.forEach(card=>srhR14ProbeObserver.observe(card));
}

/* R14 deliberately keeps the full card DOM stable. 200–300 lazy images are
   cheaper here than repeatedly destroying/recreating visible cards on scroll,
   which was the source of blank/half cards on some Android WebViews. */
renderGrid=function(force=false){
  const items=currentShortItems();
  if(!items.length){
    state.gridSig='r14:empty';
    el.feedSpacer.classList.remove('srh-r14-grid');
    el.feedSpacer.style.height='auto';
    el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';
    return;
  }
  const sig=srhR14GridSignature(items);
  if(!force&&sig===state.gridSig)return;
  state.gridSig=sig;
  el.feedSpacer.classList.add('srh-r14-grid');
  el.feedSpacer.style.height='auto';
  const hmap=new Map(history().map(x=>[String(x.streamId),x]));
  el.feedSpacer.innerHTML=items.map((item,idx)=>{
    const id=itemId(item),sec=durationFor(item),count=arcCount(sec),h=hmap.get(id),pct=h?.duration?Math.min(100,h.position/h.duration*100):0;
    return `<article class="short-card" data-index="${idx}" data-stream-id="${escapeHtml(id)}"><img class="short-card__image" src="${escapeHtml(itemImage(item)||IMAGE_PLACEHOLDER)}" alt="" loading="lazy" decoding="async" draggable="false"><div class="short-card__shade"></div><div class="arc-badge">${count?count+' arco'+(count>1?'s':''):'…'}</div>${pct>0?`<div class="card-progress"><span style="width:${pct}%"></span></div>`:''}</article>`;
  }).join('');
  el.feedSpacer.querySelectorAll('[data-index]').forEach(card=>card.onclick=()=>{
    const item=items[Number(card.dataset.index)];if(item)openShort(item,0);
  });
  srhR14ObserveProbes(items);
};

function srhR14PosterUrl(item,meta){return String(meta?.cover||itemImage(item)||IMAGE_PLACEHOLDER).trim()||IMAGE_PLACEHOLDER}
function srhR14SetPoster(url){
  const safe=String(url||IMAGE_PLACEHOLDER).trim()||IMAGE_PLACEHOLDER;
  if(srhR14PosterImage){srhR14PosterImage.dataset.fallback='0';srhR14PosterImage.src=safe}
  try{el.shortVideo.poster=safe}catch{}
}
function srhR14PreparePoster(item){
  srhR14PosterToken=String(itemId(item)||'');
  srhR14HasStarted=false;
  el.shortPlayer.classList.remove('srh-r14-media-ready');
  srhR14Poster.classList.remove('is-ready');
  srhR14SetPoster(srhR14PosterUrl(item));
}
function srhR14RevealVideo(){
  if(srhR14HasStarted)return;
  srhR14HasStarted=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!srhR14HasStarted)return;
    el.shortPlayer.classList.add('srh-r14-media-ready');
    srhR14Poster.classList.add('is-ready');
  }));
}

const srhR14OpenShortBase=openShort;
openShort=function(item,resumeAt=0){
  if(!item?.stream_id)return;
  srhR14PreparePoster(item);
  srhR14OpenShortBase(item,resumeAt);
  const token=String(itemId(item)||'');
  srhR12LoadMeta(item).then(meta=>{
    if(token!==srhR14PosterToken||String(state.current?.streamId||'')!==token||srhR14HasStarted)return;
    srhR14SetPoster(srhR14PosterUrl(item,meta));
  }).catch(()=>{});
};

el.shortVideo.addEventListener('playing',srhR14RevealVideo,{passive:true});
el.shortVideo.addEventListener('emptied',()=>{
  if(!srhR14HasStarted&&state.current)el.shortPlayer.classList.remove('srh-r14-media-ready');
},{passive:true});

/* Replace R12's "only hide while playing" behavior: user requested every
   control/info layer to disappear after four seconds without interaction. */
const srhR14OldShowControls=srhR12ShowControls;
try{el.shortStage.removeEventListener('pointerdown',srhR14OldShowControls)}catch{}
try{el.shortStage.removeEventListener('pointermove',srhR14OldShowControls)}catch{}
srhR12ScheduleHide=function(){
  clearTimeout(srhR12HideTimer);
  srhR12HideTimer=setTimeout(()=>{
    if(el.arcDrawer.classList.contains('is-hidden'))el.shortPlayer.classList.add('srh-r12-controls-hidden');
  },SRH_R12_HIDE_MS);
};
srhR12ShowControls=function(){
  el.shortPlayer.classList.remove('srh-r12-controls-hidden');
  srhR12ScheduleHide();
};
el.shortStage.addEventListener('pointerdown',srhR12ShowControls,{passive:true});
el.shortStage.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')srhR12ShowControls()},{passive:true});
el.shortStage.addEventListener('keydown',srhR12ShowControls,{passive:true});

/* Re-render once after R14 is installed so a list already mounted by init/test
   cannot keep the old absolute geometry. Normal boot still calls init() later. */
if(state.items.length)renderGrid(true);
