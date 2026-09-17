/* SRHELL v6.6 — Shorts R12.
   UI/behavior adapted from aura-reels: custom controls, fit/fullscreen,
   API cover+synopsis, 2-minute arcs and lighter frame rendering.
   Share/audience/catalog-only controls are intentionally not ported. */

const SRH_R12_ARC_SECONDS=120;
const SRH_R12_HIDE_MS=4000;
const srhR12MetaCache=new Map();
const srhR12Frame=document.getElementById('shortFrame');
let srhR12HideTimer=0,srhR12GridFrame=0;

function srhR12Svg(body){return `<svg class="action-svg" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`}
function srhR12Button(id,label,svg,extra=''){const b=document.createElement('button');b.type='button';b.id=id;b.className='srh-r12-action '+extra;b.setAttribute('aria-label',label);b.innerHTML=srhR12Svg(svg)+`<small>${label}</small>`;return b}
function srhR12SetAction(btn,label,svg){if(!btn)return;btn.classList.add('srh-r12-action');btn.setAttribute('aria-label',label);btn.innerHTML=srhR12Svg(svg)+`<small>${label}</small>`}
function srhR12Time(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const m=Math.floor(sec/60),s=sec%60;return m+':'+String(s).padStart(2,'0')}

arcCount=function(seconds){return seconds>0?Math.max(1,Math.ceil(seconds/SRH_R12_ARC_SECONDS)):0};
drawArcs=function(){
  const d=el.shortVideo.duration;
  if(!Number.isFinite(d)||d<=0){el.arcGrid.innerHTML='<div class="update-status">Duração indisponível.</div>';return}
  const count=Math.max(1,Math.ceil(d/SRH_R12_ARC_SECONDS));
  const current=Math.min(count-1,Math.floor((el.shortVideo.currentTime||0)/SRH_R12_ARC_SECONDS));
  el.arcHead.textContent=count+' arco'+(count===1?'':'s')+' · 2 min cada';
  el.arcGrid.innerHTML=Array.from({length:count},(_,i)=>{const start=i*SRH_R12_ARC_SECONDS,end=Math.min(d,(i+1)*SRH_R12_ARC_SECONDS);return `<button class="arc-button${i===current?' is-active':''}" data-arc="${i}" aria-current="${i===current?'true':'false'}">Arco ${i+1}<br><small>${srhR12Time(start)}–${srhR12Time(end)}</small></button>`}).join('');
  el.arcGrid.querySelectorAll('[data-arc]').forEach(b=>b.onclick=e=>{e.stopPropagation();seekArc(Number(b.dataset.arc));el.arcDrawer.classList.add('is-hidden')});
};
seekArc=function(index){
  const d=el.shortVideo.duration;if(!Number.isFinite(d)||d<=0)return;
  const count=Math.max(1,Math.ceil(d/SRH_R12_ARC_SECONDS)),i=Math.max(0,Math.min(count-1,index));
  el.shortVideo.currentTime=Math.min(i*SRH_R12_ARC_SECONDS,Math.max(0,d-.25));
  el.shortVideo.play().catch(()=>{});drawArcs();srhR12ShowControls();
};
currentArc=function(){return Math.max(0,Math.floor((el.shortVideo.currentTime||0)/SRH_R12_ARC_SECONDS))};

function srhR12Synopsis(data,item){const info=data?.info||{},movie=data?.movie_data||{};return String(info.plot||info.description||info.overview||movie.plot||movie.description||item?.plot||'').trim()}
function srhR12Cover(data,item){const info=data?.info||{},movie=data?.movie_data||{};const back=Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path;return String(info.movie_image||info.cover_big||info.cover||movie.stream_icon||movie.movie_image||back||itemImage(item)||'').trim()}
async function srhR12LoadMeta(item){
  const id=itemId(item);if(!id)return null;if(srhR12MetaCache.has(id))return srhR12MetaCache.get(id);
  const task=request({action:'get_vod_info',vod_id:id}).then(data=>{const meta={title:String(data?.movie_data?.name||data?.info?.name||itemTitle(item)),cover:srhR12Cover(data,item),synopsis:srhR12Synopsis(data,item),duration:durationFrom(item,data)};if(meta.duration>0)saveDuration(id,meta.duration);return meta}).catch(()=>({title:itemTitle(item),cover:itemImage(item),synopsis:'',duration:durationFor(item)}));
  srhR12MetaCache.set(id,task);return task;
}
function srhR12ApplyMeta(meta,item){
  const title=document.getElementById('srhR12Title'),syn=document.getElementById('srhR12Synopsis'),img=document.getElementById('srhR12Cover');
  if(title)title.textContent=meta?.title||itemTitle(item);
  if(syn)syn.textContent=meta?.synopsis||'Sinopse não informada pela API.';
  if(img){img.dataset.fallback='0';img.src=meta?.cover||itemImage(item)||IMAGE_PLACEHOLDER}
}

function srhR12FitKey(){return `srhell:${APP_ID}:shorts:fit-r12`}
function srhR12SetFit(mode){mode=mode==='contain'?'contain':'cover';if(!srhR12Frame)return;srhR12Frame.classList.toggle('srh-fit-contain',mode==='contain');srhR12Frame.classList.toggle('srh-fit-cover',mode!=='contain');try{localStorage.setItem(srhR12FitKey(),mode)}catch{}const b=document.getElementById('srhR12Fit');if(b){const small=b.querySelector('small');if(small)small.textContent=mode==='contain'?'Ajustar':'Corte';b.setAttribute('aria-label',mode==='contain'?'Usar corte':'Ajustar vídeo à tela')}}
function srhR12ToggleFit(){srhR12SetFit(srhR12Frame?.classList.contains('srh-fit-contain')?'cover':'contain');srhR12ShowControls()}
function srhR12StoredFit(){try{return localStorage.getItem(srhR12FitKey())||'cover'}catch{return'cover'}}

function srhR12SyncFullscreen(){const b=document.getElementById('srhR12Expand');if(!b)return;const full=!!document.fullscreenElement;const small=b.querySelector('small');if(small)small.textContent=full?'Normal':'Tela cheia';b.setAttribute('aria-label',full?'Voltar à tela normal':'Abrir em tela cheia');b.classList.toggle('is-active',full)}
async function srhR12ToggleFullscreen(){
  try{
    if(document.fullscreenElement){await document.exitFullscreen?.();try{screen.orientation?.unlock?.()}catch{}}
    else{await el.shortPlayer.requestFullscreen?.({navigationUI:'hide'});if(isMobile())try{await screen.orientation?.lock?.('portrait-primary')}catch{}}
  }catch{toast('Tela cheia indisponível neste navegador.')}
  srhR12SyncFullscreen();srhR12ShowControls();
}

function srhR12NextContent(){
  const items=currentShortItems(),id=String(state.current?.streamId||''),idx=items.findIndex(x=>String(itemId(x))===id);
  if(idx<0||idx+1>=items.length){toast('Fim da lista.');return}
  persistProgress();openShort(items[idx+1],0);
}
function srhR12Seek(delta){const v=el.shortVideo;if(!Number.isFinite(v.duration)||v.duration<=0)return;v.currentTime=Math.max(0,Math.min(v.duration-.05,(v.currentTime||0)+delta));v.play().catch(()=>{});srhR12ShowControls()}
function srhR12TogglePlay(){const v=el.shortVideo;if(v.paused)v.play().catch(()=>{});else v.pause();srhR12UpdatePlay();srhR12ShowControls()}
function srhR12UpdatePlay(){const b=document.getElementById('srhR12Play');if(!b)return;b.innerHTML=el.shortVideo.paused?srhR12Svg('<path d="M8 5v14l11-7Z"/>'):srhR12Svg('<path d="M8 6v12M16 6v12"/>');b.setAttribute('aria-label',el.shortVideo.paused?'Reproduzir':'Pausar')}
function srhR12Progress(){const d=el.shortVideo.duration,p=el.shortVideo.currentTime,fill=document.getElementById('srhR12ProgressFill');if(fill)fill.style.width=Number.isFinite(d)&&d>0?Math.max(0,Math.min(100,p/d*100))+'%':'0%'}
function srhR12ScheduleHide(){clearTimeout(srhR12HideTimer);if(el.shortVideo.paused)return;srhR12HideTimer=setTimeout(()=>{if(el.arcDrawer.classList.contains('is-hidden')&&!el.shortVideo.paused)el.shortPlayer.classList.add('srh-r12-controls-hidden')},SRH_R12_HIDE_MS)}
function srhR12ShowControls(){el.shortPlayer.classList.remove('srh-r12-controls-hidden');srhR12ScheduleHide()}

function srhR12InstallUi(){
  if(document.getElementById('srhR12Actions'))return;
  el.shortVideo.controls=false;
  el.shortClose.classList.add('srh-r12-back');
  el.shortClose.innerHTML=srhR12Svg('<path d="M15 5 8 12l7 7"/>');
  el.shortStage.appendChild(el.shortClose);
  el.arcPrev.style.display='none';

  const actions=document.createElement('aside');actions.id='srhR12Actions';actions.className='srh-r12-actions';
  srhR12SetAction(el.shortFavorite,'Favorito','<path d="M12 3.8 14.7 9l5.8.8-4.2 4.1 1 5.8-5.3-2.8-5.2 2.8 1-5.8-4.2-4.1L9.3 9Z"/>');
  srhR12SetAction(el.shortArcs,'Arcos','<path d="M5 6h14M5 12h14M5 18h14M8 4v4M14 10v4M10 16v4"/>');
  srhR12SetAction(el.arcNext,'Próximo','<path d="M5 5v14l10-7Z"/><path d="M19 5v14"/>');
  el.arcNext.onclick=e=>{e.stopPropagation();srhR12NextContent()};
  const fit=srhR12Button('srhR12Fit','Corte','<path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3"/><rect x="8" y="7" width="8" height="10" rx="1.5"/>');fit.onclick=e=>{e.stopPropagation();srhR12ToggleFit()};
  const expand=srhR12Button('srhR12Expand','Tela cheia','<path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/>');expand.onclick=e=>{e.stopPropagation();srhR12ToggleFullscreen()};
  actions.append(el.shortFavorite,fit,el.shortArcs,el.arcNext,expand);el.shortStage.appendChild(actions);

  const copy=document.createElement('section');copy.className='srh-r12-copy';copy.innerHTML='<span class="srh-r12-cover"><img id="srhR12Cover" alt=""></span><div class="srh-r12-copytext"><div class="srh-r12-copytitle" id="srhR12Title"></div><div class="srh-r12-synopsis" id="srhR12Synopsis"></div></div>';el.shortStage.appendChild(copy);
  const seek=document.createElement('div');seek.className='srh-r12-seek';seek.innerHTML='<button id="srhR12Back10" type="button" aria-label="Voltar 10 segundos">'+srhR12Svg('<path d="M9 7H4V2M4.5 7.5A9 9 0 1 1 3 15"/>')+'<span>10</span></button><button class="srh-r12-play" id="srhR12Play" type="button" aria-label="Reproduzir"></button><button id="srhR12Forward10" type="button" aria-label="Avançar 10 segundos">'+srhR12Svg('<path d="M15 7h5V2M19.5 7.5A9 9 0 1 0 21 15"/>')+'<span>10</span></button>';el.shortStage.appendChild(seek);
  document.getElementById('srhR12Back10').onclick=e=>{e.stopPropagation();srhR12Seek(-10)};document.getElementById('srhR12Forward10').onclick=e=>{e.stopPropagation();srhR12Seek(10)};document.getElementById('srhR12Play').onclick=e=>{e.stopPropagation();srhR12TogglePlay()};
  const progress=document.createElement('div');progress.className='srh-r12-progress';progress.innerHTML='<span id="srhR12ProgressFill"></span>';el.shortStage.appendChild(progress);
  srhR12SetFit(srhR12StoredFit());srhR12UpdatePlay();srhR12SyncFullscreen();
}

const srhR12OpenShortBase=openShort;
openShort=function(item,resumeAt=0){
  srhR12OpenShortBase(item,resumeAt);srhR12ShowControls();srhR12ApplyMeta({title:itemTitle(item),cover:itemImage(item),synopsis:''},item);
  const id=itemId(item);srhR12LoadMeta(item).then(meta=>{if(String(state.current?.streamId||'')===String(id))srhR12ApplyMeta(meta,item)});
};

const srhR12RenderGridBase=renderGrid;
renderGrid=function(force=false){
  if(force){if(srhR12GridFrame){cancelAnimationFrame(srhR12GridFrame);srhR12GridFrame=0}return srhR12RenderGridBase(true)}
  if(srhR12GridFrame)return;srhR12GridFrame=requestAnimationFrame(()=>{srhR12GridFrame=0;srhR12RenderGridBase(false)});
};

srhR12InstallUi();
el.shortVideo.addEventListener('play',()=>{srhR12UpdatePlay();srhR12ScheduleHide()});
el.shortVideo.addEventListener('pause',()=>{srhR12UpdatePlay();srhR12ShowControls()});
el.shortVideo.addEventListener('timeupdate',srhR12Progress,{passive:true});
el.shortVideo.addEventListener('loadedmetadata',srhR12Progress,{passive:true});
el.shortStage.addEventListener('pointerdown',srhR12ShowControls,{passive:true});
el.shortStage.addEventListener('pointermove',srhR12ShowControls,{passive:true});
document.addEventListener('fullscreenchange',srhR12SyncFullscreen);
