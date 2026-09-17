/* SRHELL Shorts R19 — performance/virtualization + Aura bottom sheet.
   Shorts only. Keeps media transport and 2-minute arc behavior from previous revisions. */
const SRH_R19='shorts-r19';
const srhR19Grid={nodes:new Map(),raf:0,probeTimer:0,lastSig:'',lastProbeItems:[],suspended:false};
let srhR19ArcSig='',srhR19ArcActive=-1;

function srhR19Metrics(){
  const cs=getComputedStyle(el.feedScroller);
  const pad=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
  const width=Math.max(220,el.feedScroller.clientWidth-pad);
  const cols=innerWidth>=1200?12:innerWidth>=900?6:2;
  const gap=innerWidth>=900?10:8;
  const cardW=(width-gap*(cols-1))/cols;
  const rowH=cardW*1.5+gap;
  const visibleRows=Math.max(1,Math.ceil(el.feedScroller.clientHeight/rowH));
  return{width,cols,gap,cardW,rowH,visibleRows};
}
function srhR19RevealImage(img){
  if(!img||img.dataset.revealed==='1')return;
  const done=()=>{if(!img.isConnected)return;img.dataset.revealed='1';img.classList.add('is-loaded')};
  if(typeof img.decode==='function')img.decode().catch(()=>{}).finally(done);else done();
}
function srhR19CreateCard(item,idx,m,hmap){
  const id=itemId(item),sec=durationFor(item),count=arcCount(sec),h=hmap.get(id),pct=h?.duration?Math.min(100,h.position/h.duration*100):0;
  const card=document.createElement('article');
  card.className='short-card srh-r19-card';
  card.dataset.index=String(idx);
  card.dataset.streamId=id;
  card.innerHTML='<img class="short-card__image srh-r19-image" alt="" loading="lazy" decoding="async"><div class="short-card__shade"></div><div class="arc-badge"></div><div class="card-progress is-hidden"><span></span></div>';
  const img=card.querySelector('img'),badge=card.querySelector('.arc-badge'),progress=card.querySelector('.card-progress'),fill=progress.querySelector('span');
  badge.textContent=count?count+' arco'+(count>1?'s':''):'…';
  if(pct>0){progress.classList.remove('is-hidden');fill.style.transform=`scaleX(${pct/100})`}
  img.addEventListener('load',()=>srhR19RevealImage(img),{passive:true});
  img.src=itemImage(item)||IMAGE_PLACEHOLDER;
  card.onclick=()=>{const items=currentShortItems(),current=items[Number(card.dataset.index)];if(current)openShort(current,0)};
  srhR19PositionCard(card,idx,m);
  return card;
}
function srhR19PositionCard(card,idx,m){
  const row=Math.floor(idx/m.cols),col=idx%m.cols;
  card.style.left=(col*(m.cardW+m.gap))+'px';
  card.style.top=(row*m.rowH)+'px';
  card.style.width=m.cardW+'px';
  card.style.height=(m.cardW*1.5)+'px';
}
function srhR19ClearGrid(){
  for(const node of srhR19Grid.nodes.values())node.remove();
  srhR19Grid.nodes.clear();
  srhR19Grid.lastSig='';
}
function srhR19ScheduleProbes(items){
  srhR19Grid.lastProbeItems=items;
  clearTimeout(srhR19Grid.probeTimer);
  if(srhR19Grid.suspended)return;
  srhR19Grid.probeTimer=setTimeout(()=>{
    if(srhR19Grid.suspended||!el.shortPlayer.classList.contains('is-hidden'))return;
    setProbeWindow(srhR19Grid.lastProbeItems);
  },320);
}
function srhR19RenderNow(force=false){
  if(srhR19Grid.suspended)return;
  const items=currentShortItems();
  if(!items.length){
    srhR19ClearGrid();
    el.feedSpacer.style.height='auto';
    el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';
    return;
  }
  if(el.feedSpacer.querySelector('.skeleton,.media-loader'))el.feedSpacer.replaceChildren();
  const m=srhR19Metrics(),rows=Math.ceil(items.length/m.cols);
  const visibleFirst=Math.max(0,Math.floor(el.feedScroller.scrollTop/m.rowH));
  const first=Math.max(0,visibleFirst-2);
  const last=Math.min(rows,visibleFirst+m.visibleRows+3);
  const sig=[first,last,m.cols,Math.round(m.cardW),items.length].join(':');
  el.feedSpacer.style.height=(rows*m.rowH)+'px';
  if(!force&&sig===srhR19Grid.lastSig)return;
  srhR19Grid.lastSig=sig;

  const wanted=new Set(),hmap=new Map(history().map(x=>[String(x.streamId),x]));
  for(let r=first;r<last;r++){
    for(let c=0;c<m.cols;c++){
      const idx=r*m.cols+c;if(idx>=items.length)break;
      wanted.add(idx);
      let card=srhR19Grid.nodes.get(idx);
      if(!card){
        card=srhR19CreateCard(items[idx],idx,m,hmap);
        srhR19Grid.nodes.set(idx,card);
        el.feedSpacer.appendChild(card);
      }else srhR19PositionCard(card,idx,m);
    }
  }
  for(const [idx,node] of [...srhR19Grid.nodes]){
    if(!wanted.has(idx)){node.remove();srhR19Grid.nodes.delete(idx)}
  }
  const probe=[];
  const probeLast=Math.min(rows,visibleFirst+m.visibleRows+1);
  for(let r=visibleFirst;r<probeLast;r++)for(let c=0;c<m.cols;c++){const idx=r*m.cols+c;if(idx<items.length)probe.push(items[idx])}
  srhR19ScheduleProbes(probe);
}
renderGrid=function(force=false){
  if(force){
    if(srhR19Grid.raf){cancelAnimationFrame(srhR19Grid.raf);srhR19Grid.raf=0}
    srhR19ClearGrid();
    return srhR19RenderNow(true);
  }
  if(srhR19Grid.raf)return;
  srhR19Grid.raf=requestAnimationFrame(()=>{srhR19Grid.raf=0;srhR19RenderNow(false)});
};

function srhR19SuspendFeed(){
  srhR19Grid.suspended=true;
  clearTimeout(srhR19Grid.probeTimer);
  srhR19ClearGrid();
  document.body.classList.add('srh-r19-playing');
}
function srhR19ResumeFeed(){
  srhR19Grid.suspended=false;
  document.body.classList.remove('srh-r19-playing');
  renderGrid(true);
}

function srhR19EnsurePoster(){
  let img=document.getElementById('srhR19StagePoster');
  if(img)return img;
  img=document.createElement('img');
  img.id='srhR19StagePoster';
  img.className='srh-r19-stage-poster';
  img.alt='';
  img.decoding='async';
  const shade=srhR12Frame?.querySelector('.short-player__shade');
  if(shade)srhR12Frame.insertBefore(img,shade);else srhR12Frame?.appendChild(img);
  return img;
}
function srhR19ShowPoster(item){
  const img=srhR19EnsurePoster();if(!img)return;
  img.classList.remove('is-hidden','is-ready');
  img.dataset.initial='1';
  img.src=itemImage(item)||IMAGE_PLACEHOLDER;
  requestAnimationFrame(()=>img.classList.add('is-ready'));
}
function srhR19UpdatePoster(src){
  const img=srhR19EnsurePoster();if(!img||img.dataset.initial!=='1'||!src)return;
  img.src=src;
}
function srhR19HidePoster(){
  const img=document.getElementById('srhR19StagePoster');if(!img||img.dataset.initial!=='1')return;
  img.dataset.initial='0';
  img.classList.add('is-hidden');
}
el.shortVideo.addEventListener('playing',()=>requestAnimationFrame(()=>requestAnimationFrame(srhR19HidePoster)),{passive:true});

function srhR19EnsureArcBackdrop(){
  let b=document.getElementById('srhR19ArcBackdrop');
  if(b)return b;
  b=document.createElement('div');b.id='srhR19ArcBackdrop';b.className='srh-r19-arc-backdrop is-hidden';
  el.shortStage.insertBefore(b,el.arcDrawer);
  b.onclick=e=>{e.stopPropagation();srhR19CloseArcSheet()};
  return b;
}
function srhR19CloseArcSheet(){
  el.arcDrawer.classList.add('is-hidden');
  srhR19EnsureArcBackdrop().classList.add('is-hidden');
  document.body.classList.remove('srh-r19-arc-open');
}
function srhR19OpenArcSheet(){
  drawArcs();
  el.arcDrawer.classList.remove('is-hidden');
  srhR19EnsureArcBackdrop().classList.remove('is-hidden');
  document.body.classList.add('srh-r19-arc-open');
  requestAnimationFrame(()=>el.arcGrid.querySelector('.arc-button.is-active')?.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'}));
  srhR12ShowControls();
}
drawArcs=function(){
  const d=el.shortVideo.duration;
  if(!Number.isFinite(d)||d<=0){
    srhR19ArcSig='';srhR19ArcActive=-1;el.arcGrid.innerHTML='<div class="update-status">Duração indisponível.</div>';return;
  }
  const count=Math.max(1,Math.ceil(d/SRH_R12_ARC_SECONDS));
  const current=Math.min(count-1,Math.floor((el.shortVideo.currentTime||0)/SRH_R12_ARC_SECONDS));
  const sig=count+':'+Math.round(d);
  el.arcHead.textContent=count+' arco'+(count===1?'':'s')+' · 2 min cada';
  if(sig!==srhR19ArcSig){
    srhR19ArcSig=sig;srhR19ArcActive=current;
    const frag=document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const start=i*SRH_R12_ARC_SECONDS,end=Math.min(d,(i+1)*SRH_R12_ARC_SECONDS);
      const b=document.createElement('button');b.className='arc-button'+(i===current?' is-active':'');b.dataset.arc=String(i);b.setAttribute('aria-current',i===current?'true':'false');
      b.innerHTML='Arco '+(i+1)+'<br><small>'+srhR12Time(start)+'–'+srhR12Time(end)+'</small>';
      b.onclick=e=>{e.stopPropagation();seekArc(i);srhR19CloseArcSheet()};
      frag.appendChild(b);
    }
    el.arcGrid.replaceChildren(frag);
  }else if(current!==srhR19ArcActive){
    el.arcGrid.querySelector(`[data-arc="${srhR19ArcActive}"]`)?.classList.remove('is-active');
    const active=el.arcGrid.querySelector(`[data-arc="${current}"]`);active?.classList.add('is-active');
    el.arcGrid.querySelectorAll('[aria-current="true"]').forEach(x=>x.setAttribute('aria-current','false'));
    active?.setAttribute('aria-current','true');
    srhR19ArcActive=current;
  }
};
el.shortArcs.onclick=e=>{e.preventDefault();e.stopPropagation();el.arcDrawer.classList.contains('is-hidden')?srhR19OpenArcSheet():srhR19CloseArcSheet()};
el.shortStage.addEventListener('click',()=>{if(el.arcDrawer.classList.contains('is-hidden'))srhR19CloseArcSheet()});

try{el.shortVideo.removeEventListener('playing',srhR14PrefetchNext)}catch{}

const srhR19OpenBase=openShort;
openShort=function(item,resumeAt=0){
  srhR19SuspendFeed();
  srhR19CloseArcSheet();
  srhR19ShowPoster(item);
  const out=srhR19OpenBase(item,resumeAt);
  const id=itemId(item);
  srhR12LoadMeta(item).then(meta=>{if(String(state.current?.streamId||'')===String(id)&&meta?.cover)srhR19UpdatePoster(meta.cover)}).catch(()=>{});
  return out;
};
const srhR19CloseBase=closeShort;
closeShort=async function(){
  srhR19CloseArcSheet();
  const out=await srhR19CloseBase();
  srhR19HidePoster();
  srhR19ResumeFeed();
  return out;
};

/* Keep idle probing strictly idle and single-lane. */
runProbeQueue=function(){
  clearTimeout(srhR14ProbeTimer);
  if(!el.shortPlayer.classList.contains('is-hidden')||srhR19Grid.suspended){srhR14ProbeTimer=setTimeout(runProbeQueue,900);return}
  if(state.probeActive>0)return;
  if(!state.probeQueue.length)return;
  const item=state.probeQueue.shift(),id=itemId(item);
  if(!state.probeWanted.has(id)){state.probeQueued.delete(id);return runProbeQueue()}
  state.probeActive=1;
  request({action:'get_vod_info',vod_id:id}).then(data=>{const d=durationFrom(item,data);if(d>0)saveDuration(id,d)}).catch(()=>{}).finally(()=>{state.probeActive=0;setTimeout(runProbeQueue,90)});
};

srhR19EnsurePoster();
srhR19EnsureArcBackdrop();
renderGrid(true);
