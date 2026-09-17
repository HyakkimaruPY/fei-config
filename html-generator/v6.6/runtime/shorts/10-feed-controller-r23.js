/* SRHELL Shorts R23 — clean feed/player controller.
   Replaces only the unstable feed/player lifecycle. No R14 prefetch layer. */
const SRH_SHORTS_FEED_R23='shorts-feed-r23';
const srhR23Feed={top:null,grid:null,bottom:null,nodes:new Map(),firstRow:-1,lastRow:-1,cols:0,rowH:0,cardW:0,raf:0,probeTimer:0,suspended:false,savedScroll:0};
const srhR23Images={queue:[],active:0,max:3};
let srhR23ArcSig='',srhR23ArcActive=-1,srhR23ArcTimer=0;

function srhR23Metrics(){
  const cs=getComputedStyle(el.feedScroller);
  const pad=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
  const width=Math.max(220,el.feedScroller.clientWidth-pad);
  const cols=innerWidth>=1200?8:innerWidth>=900?6:2;
  const gap=innerWidth>=900?10:8;
  const cardW=(width-gap*(cols-1))/cols;
  const cardH=cardW*1.5;
  const rowH=cardH+gap;
  const visibleRows=Math.max(1,Math.ceil(el.feedScroller.clientHeight/rowH));
  return{cols,gap,cardW,cardH,rowH,visibleRows};
}
function srhR23EnsureFeed(){
  if(srhR23Feed.top?.isConnected&&srhR23Feed.grid?.isConnected&&srhR23Feed.bottom?.isConnected)return;
  const top=document.createElement('div'),grid=document.createElement('div'),bottom=document.createElement('div');
  top.className='srh-r23-spacer-top';grid.className='srh-r23-grid';bottom.className='srh-r23-spacer-bottom';
  el.feedSpacer.replaceChildren(top,grid,bottom);
  srhR23Feed.top=top;srhR23Feed.grid=grid;srhR23Feed.bottom=bottom;
  srhR23Feed.nodes.clear();srhR23Feed.firstRow=-1;srhR23Feed.lastRow=-1;
}
function srhR23ImageCandidates(src){
  const out=[],push=v=>{v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)};
  push(src);
  if(typeof srhShortsImageCandidates==='function')for(const v of srhShortsImageCandidates(src))push(v);
  return out;
}
function srhR23PumpImages(){
  while(srhR23Images.active<srhR23Images.max&&srhR23Images.queue.length){
    const task=srhR23Images.queue.shift();
    if(!task.card.isConnected||task.card.dataset.coverToken!==task.token)continue;
    srhR23Images.active++;
    const candidates=srhR23ImageCandidates(task.src);let pos=0,finished=false;
    const finish=()=>{if(finished)return;finished=true;srhR23Images.active--;srhR23PumpImages()};
    const next=()=>{
      if(!task.card.isConnected||task.card.dataset.coverToken!==task.token)return finish();
      if(pos>=candidates.length)return finish();
      const candidate=candidates[pos++],probe=new Image();
      probe.decoding='async';probe.referrerPolicy='no-referrer';
      probe.onload=()=>{
        const reveal=()=>{if(task.card.isConnected&&task.card.dataset.coverToken===task.token)task.img.src=candidate;finish()};
        if(typeof probe.decode==='function')probe.decode().catch(()=>{}).finally(reveal);else reveal();
      };
      probe.onerror=next;probe.src=candidate;
    };
    next();
  }
}
function srhR23QueueImage(card,img,src){
  const token=String((Number(card.dataset.coverSeq)||0)+1);
  card.dataset.coverSeq=token;card.dataset.coverToken=token;img.src=IMAGE_PLACEHOLDER;
  if(!src||src===IMAGE_PLACEHOLDER)return;
  srhR23Images.queue.push({card,img,src,token});srhR23PumpImages();
}
function srhR23HistoryMap(){return new Map(history().map(x=>[String(x.streamId),x]))}
function srhR23CreateCard(item,idx,hmap){
  const id=itemId(item),card=document.createElement('article'),img=document.createElement('img');
  card.className='short-card';card.dataset.index=String(idx);card.dataset.streamId=id;
  img.className='short-card__image';img.alt='';img.loading='lazy';img.decoding='async';img.src=IMAGE_PLACEHOLDER;
  const shade=document.createElement('div');shade.className='short-card__shade';
  const badge=document.createElement('div');badge.className='arc-badge';
  const progress=document.createElement('div');progress.className='card-progress is-hidden';
  const fill=document.createElement('span');progress.appendChild(fill);
  card.append(img,shade,badge,progress);
  srhR23QueueImage(card,img,itemImage(item));
  card.onclick=()=>{const items=currentShortItems(),current=items[Number(card.dataset.index)];if(current)openShort(current,0)};
  srhR23UpdateCard(card,item,idx,hmap,0,{cols:1});
  return card;
}
function srhR23UpdateCard(card,item,idx,hmap,firstRow,m){
  const oldId=card.dataset.streamId,newId=itemId(item);
  card.dataset.index=String(idx);card.dataset.streamId=newId;
  if(oldId!==newId){const img=card.querySelector('.short-card__image');if(img)srhR23QueueImage(card,img,itemImage(item))}
  const row=Math.floor(idx/m.cols),col=idx%m.cols;
  card.style.gridColumn=String(col+1);card.style.gridRow=String(row-firstRow+1);
  const sec=durationFor(item),count=arcCount(sec),badge=card.querySelector('.arc-badge');
  if(badge)badge.textContent=count?count+' arco'+(count>1?'s':''):'…';
  const h=hmap.get(String(newId)),ratio=h?.duration?Math.max(0,Math.min(1,h.position/h.duration)):0;
  const progress=card.querySelector('.card-progress'),fill=progress?.querySelector('span');
  progress?.classList.toggle('is-hidden',ratio<=0);if(fill)fill.style.transform=`scaleX(${ratio})`;
}
function srhR23RemoveCard(idx){
  const card=srhR23Feed.nodes.get(idx);if(!card)return;
  card.dataset.coverToken='dead';card.remove();srhR23Feed.nodes.delete(idx);
}
function srhR23ResetFeed(){
  if(srhR23Feed.raf){cancelAnimationFrame(srhR23Feed.raf);srhR23Feed.raf=0}
  for(const idx of [...srhR23Feed.nodes.keys()])srhR23RemoveCard(idx);
  srhR23Feed.firstRow=-1;srhR23Feed.lastRow=-1;srhR23Feed.cols=0;srhR23Feed.rowH=0;srhR23Feed.cardW=0;
}
function srhR23ScheduleProbe(items){
  clearTimeout(srhR23Feed.probeTimer);
  if(srhR23Feed.suspended)return;
  srhR23Feed.probeTimer=setTimeout(()=>{
    if(srhR23Feed.suspended||!el.shortPlayer.classList.contains('is-hidden'))return;
    setProbeWindow(items);
  },650);
}
function srhR23RenderNow(force=false){
  if(srhR23Feed.suspended)return;
  const items=currentShortItems();
  if(!items.length){srhR23ResetFeed();el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';srhR23Feed.top=srhR23Feed.grid=srhR23Feed.bottom=null;return}
  srhR23EnsureFeed();
  const m=srhR23Metrics(),rows=Math.ceil(items.length/m.cols),visibleFirst=Math.max(0,Math.floor(el.feedScroller.scrollTop/m.rowH));
  const first=Math.max(0,visibleFirst-2),last=Math.min(rows,visibleFirst+m.visibleRows+5);
  const geometryChanged=srhR23Feed.cols!==m.cols||Math.abs(srhR23Feed.cardW-m.cardW)>.5||Math.abs(srhR23Feed.rowH-m.rowH)>.5;
  if(!force&&!geometryChanged&&srhR23Feed.firstRow>=0&&first===srhR23Feed.firstRow&&last===srhR23Feed.lastRow)return;
  const wanted=new Set(),hmap=srhR23HistoryMap();
  srhR23Feed.grid.style.gridTemplateColumns=`repeat(${m.cols},minmax(0,1fr))`;
  srhR23Feed.grid.style.columnGap=m.gap+'px';srhR23Feed.grid.style.rowGap=m.gap+'px';srhR23Feed.grid.style.gridAutoRows=m.cardH+'px';
  for(let idx=first*m.cols;idx<Math.min(items.length,last*m.cols);idx++){
    wanted.add(idx);let card=srhR23Feed.nodes.get(idx);
    if(!card){card=srhR23CreateCard(items[idx],idx,hmap);srhR23Feed.nodes.set(idx,card);srhR23Feed.grid.appendChild(card)}
    srhR23UpdateCard(card,items[idx],idx,hmap,first,m);
  }
  for(const idx of [...srhR23Feed.nodes.keys()])if(!wanted.has(idx))srhR23RemoveCard(idx);
  srhR23Feed.top.style.height=(first*m.rowH)+'px';srhR23Feed.bottom.style.height=(Math.max(0,rows-last)*m.rowH)+'px';
  srhR23Feed.firstRow=first;srhR23Feed.lastRow=last;srhR23Feed.cols=m.cols;srhR23Feed.rowH=m.rowH;srhR23Feed.cardW=m.cardW;
  const probe=[],probeEnd=Math.min(items.length,(visibleFirst+m.visibleRows+1)*m.cols);
  for(let i=visibleFirst*m.cols;i<probeEnd;i++)probe.push(items[i]);
  srhR23ScheduleProbe(probe);
}
renderGrid=function(force=false){
  if(srhR23Feed.suspended)return;
  if(force){if(srhR23Feed.raf){cancelAnimationFrame(srhR23Feed.raf);srhR23Feed.raf=0}srhR23RenderNow(true);return}
  if(srhR23Feed.raf)return;
  srhR23Feed.raf=requestAnimationFrame(()=>{srhR23Feed.raf=0;srhR23RenderNow(false)});
};
runProbeQueue=function(){
  if(srhR23Feed.suspended||!el.shortPlayer.classList.contains('is-hidden'))return;
  if(state.probeActive>0||!state.probeQueue.length)return;
  const item=state.probeQueue.shift(),id=itemId(item);
  if(!state.probeWanted.has(id)){state.probeQueued.delete(id);setTimeout(runProbeQueue,0);return}
  state.probeActive=1;
  request({action:'get_vod_info',vod_id:id}).then(data=>{const d=durationFrom(item,data);if(d>0)saveDuration(id,d)}).catch(()=>{}).finally(()=>{state.probeActive=0;setTimeout(runProbeQueue,160)});
};

function srhR23Poster(){
  let img=document.getElementById('srhR23StagePoster');if(img)return img;
  img=document.createElement('img');img.id='srhR23StagePoster';img.className='srh-r23-stage-poster is-hidden';img.alt='';img.decoding='async';
  const frame=document.getElementById('shortFrame'),shade=frame?.querySelector('.short-player__shade');
  if(shade)frame.insertBefore(img,shade);else frame?.appendChild(img);return img;
}
function srhR23ShowPoster(item){
  const img=srhR23Poster(),session=String(Date.now())+'_'+Math.random();img.dataset.session=session;img.src=IMAGE_PLACEHOLDER;img.classList.remove('is-hidden');
  const src=itemImage(item);if(!src)return;
  const p=new Image();p.decoding='async';p.onload=()=>{const done=()=>{if(img.dataset.session===session){img.src=src;img.classList.remove('is-hidden')}};if(typeof p.decode==='function')p.decode().catch(()=>{}).finally(done);else done()};p.src=src;
}
function srhR23UpdatePoster(src){
  const img=srhR23Poster();if(!src||img.classList.contains('is-hidden'))return;
  const session=img.dataset.session,p=new Image();p.decoding='async';p.onload=()=>{if(img.dataset.session===session)img.src=src};p.src=src;
}
function srhR23HidePoster(){srhR23Poster().classList.add('is-hidden')}
function srhR23HidePosterOnFrame(){
  const v=el.shortVideo;
  if(typeof v.requestVideoFrameCallback==='function')v.requestVideoFrameCallback(()=>srhR23HidePoster());
  else requestAnimationFrame(()=>requestAnimationFrame(()=>{if(v.readyState>=2)srhR23HidePoster()}));
}
el.shortVideo.addEventListener('playing',srhR23HidePosterOnFrame,{passive:true});

function srhR23ArcBackdrop(){
  let b=document.getElementById('srhR23ArcBackdrop');if(b)return b;
  b=document.createElement('div');b.id='srhR23ArcBackdrop';b.className='srh-r23-arc-backdrop is-hidden';
  el.shortStage.insertBefore(b,el.arcDrawer);b.onclick=e=>{e.preventDefault();e.stopPropagation();srhR23CloseArcs()};return b;
}
function srhR23CloseArcs(immediate=false){
  clearTimeout(srhR23ArcTimer);const b=srhR23ArcBackdrop();
  el.arcDrawer.classList.remove('srh-r23-open');b.classList.remove('srh-r23-open');document.body.classList.remove('srh-r23-arc-open');
  const done=()=>{el.arcDrawer.classList.add('is-hidden');b.classList.add('is-hidden')};
  if(immediate)done();else srhR23ArcTimer=setTimeout(done,210);
}
function srhR23OpenArcs(){
  clearTimeout(srhR23ArcTimer);drawArcs();const b=srhR23ArcBackdrop();
  el.arcDrawer.classList.remove('is-hidden');b.classList.remove('is-hidden');
  requestAnimationFrame(()=>{el.arcDrawer.classList.add('srh-r23-open');b.classList.add('srh-r23-open');document.body.classList.add('srh-r23-arc-open');el.arcGrid.querySelector('.arc-button.is-active')?.scrollIntoView({block:'center',behavior:'auto'})});
  if(typeof srhR12ShowControls==='function')srhR12ShowControls();
}
drawArcs=function(){
  const d=el.shortVideo.duration;
  if(!Number.isFinite(d)||d<=0){srhR23ArcSig='';srhR23ArcActive=-1;el.arcHead.textContent='Arcos de 2 minutos';el.arcGrid.innerHTML='<div class="update-status">Duração indisponível.</div>';return}
  const seconds=120,count=Math.max(1,Math.ceil(d/seconds)),current=Math.min(count-1,Math.floor((el.shortVideo.currentTime||0)/seconds)),sig=count+':'+Math.round(d);
  el.arcHead.textContent=count+' arco'+(count===1?'':'s')+' · 2 min cada';
  if(sig!==srhR23ArcSig){
    srhR23ArcSig=sig;srhR23ArcActive=current;const frag=document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const start=i*seconds,end=Math.min(d,(i+1)*seconds),b=document.createElement('button');b.type='button';b.className='arc-button'+(i===current?' is-active':'');b.dataset.arc=String(i);b.setAttribute('aria-current',i===current?'true':'false');
      const fmt=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
      b.innerHTML='Arco '+(i+1)+'<br><small>'+fmt(start)+'–'+fmt(end)+'</small>';
      b.onclick=e=>{e.stopPropagation();seekArc(i);srhR23CloseArcs()};frag.appendChild(b);
    }
    el.arcGrid.replaceChildren(frag);
  }else if(current!==srhR23ArcActive){
    const old=el.arcGrid.querySelector(`[data-arc="${srhR23ArcActive}"]`),now=el.arcGrid.querySelector(`[data-arc="${current}"]`);
    old?.classList.remove('is-active');old?.setAttribute('aria-current','false');now?.classList.add('is-active');now?.setAttribute('aria-current','true');srhR23ArcActive=current;
  }
};
seekArc=function(index){
  const d=el.shortVideo.duration;if(!Number.isFinite(d)||d<=0)return;
  const seconds=120,count=Math.max(1,Math.ceil(d/seconds)),i=Math.max(0,Math.min(count-1,index));
  el.shortVideo.currentTime=Math.min(i*seconds,Math.max(0,d-.25));el.shortVideo.play().catch(()=>{});drawArcs();
};
currentArc=function(){return Math.max(0,Math.floor((el.shortVideo.currentTime||0)/120))};
el.shortArcs.onclick=e=>{e.preventDefault();e.stopPropagation();el.arcDrawer.classList.contains('is-hidden')?srhR23OpenArcs():srhR23CloseArcs()};
el.shortStage.addEventListener('click',e=>{if(!el.arcDrawer.classList.contains('is-hidden')&&!e.target.closest('#arcDrawer')&&!e.target.closest('#shortArcs'))srhR23CloseArcs()},true);

const srhR23OpenBase=openShort;
openShort=function(item,resumeAt=0){
  const alreadyOpen=!el.shortPlayer.classList.contains('is-hidden');
  if(!alreadyOpen)srhR23Feed.savedScroll=el.feedScroller.scrollTop;
  srhR23Feed.suspended=true;clearTimeout(srhR23Feed.probeTimer);document.body.classList.add('srh-r23-playing');srhR23CloseArcs(true);srhR23ShowPoster(item);
  const out=srhR23OpenBase(item,resumeAt),id=itemId(item);
  if(typeof srhR12LoadMeta==='function')srhR12LoadMeta(item).then(meta=>{if(String(state.current?.streamId||'')===String(id)&&meta?.cover)srhR23UpdatePoster(meta.cover)}).catch(()=>{});
  return out;
};
closeShort=async function(){
  persistProgress();try{el.shortVideo.pause()}catch{}destroyHls();srhR23CloseArcs(true);el.shortPlayer.classList.add('is-hidden');
  await leavePortraitFullscreen();state.current=null;srhR23HidePoster();document.body.classList.remove('srh-r23-playing');srhR23Feed.suspended=false;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  el.feedScroller.scrollTop=srhR23Feed.savedScroll;renderGrid(true);setTimeout(runProbeQueue,240);
};
el.shortClose.onclick=closeShort;
window.addEventListener('pageshow',()=>{if(el.shortPlayer.classList.contains('is-hidden')){srhR23Feed.suspended=false;renderGrid(true)}},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&el.shortPlayer.classList.contains('is-hidden')){srhR23Feed.suspended=false;renderGrid(true)}},{passive:true});

srhR23ArcBackdrop();srhR23Poster();
