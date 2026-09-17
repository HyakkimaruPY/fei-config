/* SRHELL v6.6 runtime patch.
   IMPORTANT: standard.html injects this source INSIDE the core IIFE, immediately
   before its final })(); so these replacements share the original runtime scope. */

/* --------------------------------------------------------------------------
 * Aura channel grouping recovered from redirect_6-25_chain
 * ----------------------------------------------------------------------- */
const SRH_AURA_QUALITY_RE=/\s(?:SD|HD\+|FHD|UHD|4K|HEVC|H26[45]|HDR\+|HDR10|HDR|\+HD|HD|720P|1080P|\[H?26[45]\]|POTÊNCIA\s?[\d¹²³⁴⁵⁶⁷⁸⁹])\b/i;
function srhAuraQuality(raw){
  const name=String(raw||'').trim(),m=name.match(SRH_AURA_QUALITY_RE);
  return m?m[0].trim().replace(/\s+/g,' ').toUpperCase():'Padrão';
}
function srhAuraBaseChannel(raw){
  return String(raw||'Canal')
    .replace(SRH_AURA_QUALITY_RE,'')
    .replace(/\s+(?:TESTE)\s*$/i,'')
    .replace(/[\s|•:,_—–-]+$/g,'')
    .replace(/\s{2,}/g,' ')
    .trim()||String(raw||'Canal').trim()||'Canal';
}
function parseChannelName(raw){return{base:srhAuraBaseChannel(raw),quality:srhAuraQuality(raw)}}
function qualityRank(q){
  const s=String(q||'').toUpperCase();
  if(s.includes('4K'))return 0;
  if(s.includes('UHD'))return 1;
  if(s.includes('HDR10')||s.includes('HDR+'))return 2;
  if(s.includes('HDR'))return 3;
  if(s.includes('FHD')||s.includes('1080P')||s.includes('FULL HD'))return 4;
  if(s.includes('HD+')||s==='HD'||s.includes('720P')||s.includes('+HD'))return 5;
  if(s.includes('HEVC')||s.includes('H265')||s.includes('[H265]'))return 6;
  if(s.includes('H264')||s.includes('[H264]'))return 7;
  if(s.includes('POTÊNCIA'))return 8;
  if(s.includes('SD'))return 9;
  if(s.includes('TESTE'))return 20;
  return 10;
}
function groupChannels(items){
  const map=new Map();
  for(const item of items||[]){
    const p=parseChannelName(itemTitle(item));
    const key=p.base.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
    if(!map.has(key))map.set(key,{baseName:p.base,image:imageFor(item,'live'),variants:[]});
    const group=map.get(key);
    if(!group.image)group.image=imageFor(item,'live');
    group.variants.push({...item,_quality:p.quality,_baseName:p.base});
  }
  return[...map.values()].map(g=>{g.variants.sort((a,b)=>qualityRank(a._quality)-qualityRank(b._quality)||String(a.name||'').localeCompare(String(b.name||'')));return g});
}

/* --------------------------------------------------------------------------
 * Aura poster/card proportions and labels
 * ----------------------------------------------------------------------- */
function cardHtml(item,type,cls,index,left,width){
  const img=cardDataImage(item,type)||IMAGE_PLACEHOLDER,name=cardDataName(item,type),live=type==='live';
  return `<article class="${cls} ${cls}--${type}${live?' '+cls+'--live':''}" data-index="${index}" style="left:${left}px;width:${width}px" aria-label="${escapeHtml(name)}"><img class="poster-card__image" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async"><div class="aura-card-shade"></div><div class="aura-card-title">${escapeHtml(name)}</div></article>`;
}
RailVirtualizer.prototype.metrics=function(){
  const live=this.type==='live',w=innerWidth<680?(live?116:108):(live?146:132),gap=10,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));
  return{w,gap,slot,visible};
};
RailVirtualizer.prototype.render=function(force=false){
  const m=this.metrics(),ratio=this.type==='live'?1:1.5,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length,this.type].join(':');
  if(!force&&sig===this.sig)return;
  this.sig=sig;
  this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';
  this.track.style.height=Math.round(m.w*ratio)+'px';
  this.track.innerHTML=this.items.slice(start,end).map((item,off)=>{const idx=start+off;return cardHtml(item,this.type,'poster-card',idx,idx*m.slot,m.w)}).join('');
  this.track.querySelectorAll('[data-index]').forEach(c=>{c.style.height=Math.round(m.w*ratio)+'px';c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type)});
};
GridVirtualizer.prototype.metrics=function(){
  const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:11,live=this.type==='live',base=live?138:122,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(base+gap))),w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
  return{available,gap,cols,w,h,rowH};
};
GridVirtualizer.prototype.render=function(force=false){
  const m=this.metrics(),rows=Math.ceil(this.items.length/m.cols),firstRow=Math.max(0,Math.floor(this.scroller.scrollTop/m.rowH)-1),visibleRows=Math.max(1,Math.ceil(this.scroller.clientHeight/m.rowH)),lastRow=Math.min(rows,firstRow+visibleRows*2+1),start=firstRow*m.cols,end=Math.min(this.items.length,lastRow*m.cols),sig=[start,end,m.cols,Math.round(m.w),this.items.length,this.type].join(':');
  if(!force&&sig===this.sig)return;
  this.sig=sig;
  this.spacer.style.height=Math.max(1,rows*m.rowH-m.gap)+'px';
  this.spacer.innerHTML=this.items.slice(start,end).map((item,off)=>{const idx=start+off,row=Math.floor(idx/m.cols),col=idx%m.cols,left=col*(m.w+m.gap),top=row*m.rowH,img=cardDataImage(item,this.type)||IMAGE_PLACEHOLDER,name=cardDataName(item,this.type);return `<article class="grid-card grid-card--${this.type}${this.type==='live'?' grid-card--live':''}" data-index="${idx}" style="left:${left}px;top:${top}px;width:${m.w}px;height:${m.h}px" aria-label="${escapeHtml(name)}"><img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async"><div class="aura-card-shade"></div><div class="aura-card-title">${escapeHtml(name)}</div></article>`}).join('');
  this.spacer.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type));
};

/* --------------------------------------------------------------------------
 * Static-HTML stream fallback: direct first, then scheme/extension variants;
 * browser redirect resolution runs only after a real playback failure.
 * ----------------------------------------------------------------------- */
function srhAuraAddUrl(out,value){const u=String(value||'').trim();if(/^https?:\/\//i.test(u)&&!out.includes(u))out.push(u)}
function srhAuraSchemeTwin(url,scheme){try{const u=new URL(String(url||''));u.protocol=scheme+':';return u.href}catch{return''}}
function srhAuraXtreamVariants(url){
  const out=[];srhAuraAddUrl(out,url);
  let u;try{u=new URL(String(url||''))}catch{return out}
  const isXtream=/\/(?:live|movie|series)\/[^/]+\/[^/]+\/[^/?#]+/i.test(u.pathname);
  if(isXtream){
    const m=u.pathname.match(/^(.*\/[^/.?#]+)(?:\.([a-z0-9]{2,6}))$/i);
    if(m){
      const originalPath=u.pathname,base=m[1],ext=m[2].toLowerCase();
      const addPath=p=>{const x=new URL(u.href);x.pathname=p;srhAuraAddUrl(out,x.href)};
      if(ext!=='m3u8')addPath(base+'.m3u8');
      addPath(originalPath);
      if(ext!=='mp4')addPath(base+'.mp4');
      if(ext!=='ts')addPath(base+'.ts');
      addPath(base);
    }
  }
  return out;
}
function mediaCandidates(value){
  const input=Array.isArray(value)?value:[value],out=[],preferHttps=location.protocol==='https:';
  for(const raw of input){
    const variants=srhAuraXtreamVariants(raw);
    for(const v of variants){
      if(preferHttps){srhAuraAddUrl(out,srhAuraSchemeTwin(v,'https'));srhAuraAddUrl(out,v);srhAuraAddUrl(out,srhAuraSchemeTwin(v,'http'))}
      else{srhAuraAddUrl(out,v);srhAuraAddUrl(out,srhAuraSchemeTwin(v,'https'));srhAuraAddUrl(out,srhAuraSchemeTwin(v,'http'))}
    }
  }
  return out;
}
async function srhAuraResolveRedirect(url,timeoutMs=2600){
  for(const method of ['HEAD','GET']){
    const c=new AbortController(),tid=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const r=await fetch(url,{method,redirect:'follow',cache:'no-store',credentials:'omit',signal:c.signal});
      clearTimeout(tid);
      if(r.status>=200&&r.status<400&&r.url&&r.url!==url)return r.url;
    }catch{clearTimeout(tid)}
  }
  return'';
}
function attachVideo(video,url,onReady,onError){
  const queue=mediaCandidates(url),resolved=new Set();let index=0,last=null,finished=false;
  const next=()=>{
    if(finished)return;
    if(index>=queue.length){finished=true;onError?.(last);return}
    const current=queue[index++];let failed=false;
    destroyHls();video.pause();video.onerror=null;video.onloadedmetadata=null;video.removeAttribute('src');video.load();
    const fail=async extra=>{
      if(failed||finished)return;failed=true;last=mediaErrorInfo(video,extra);
      if(!resolved.has(current)){
        resolved.add(current);
        const finalUrl=await srhAuraResolveRedirect(current,2200);
        if(finalUrl&&finalUrl!==current){
          const additions=mediaCandidates(finalUrl).filter(x=>!queue.includes(x));
          if(additions.length)queue.splice(index,0,...additions);
        }
      }
      next();
    };
    const ready=()=>{if(finished)return;finished=true;onReady?.(current);const p=video.play();p?.catch?.(()=>{})};
    const isHls=/\.m3u8(?:$|\?)/i.test(current);
    if(isHls&&window.Hls&&Hls.isSupported()){
      state.hls=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:30,maxMaxBufferLength:48,backBufferLength:18,manifestLoadingTimeOut:9000,levelLoadingTimeOut:12000,fragLoadingTimeOut:16000});
      state.hls.loadSource(current);state.hls.attachMedia(video);
      state.hls.on(Hls.Events.MANIFEST_PARSED,ready);
      state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)});
    }else{
      video.src=current;video.onloadedmetadata=ready;video.onerror=()=>fail();video.load();const p=video.play();p?.catch?.(()=>{});
    }
  };
  next();
}

/* --------------------------------------------------------------------------
 * Inline playback in detail media area (film/live), preserving series logic.
 * ----------------------------------------------------------------------- */
function srhFixInlineState(){return state.detailInlineVideo||null}
function srhFixStopInlineDetailVideo(restoreImage=true){
  const iv=srhFixInlineState();if(!iv)return;
  try{persistProgress(iv.video)}catch{}
  try{iv.video.pause()}catch{}
  try{destroyHls()}catch{}
  try{iv.video.removeAttribute('src');iv.video.load()}catch{}
  if(restoreImage&&iv.image)iv.image.classList.remove('is-hidden');
  if(iv.art)iv.art.classList.remove('is-playing');
  try{iv.video.remove()}catch{}try{iv.actions.remove()}catch{}try{iv.status.remove()}catch{}
  state.detailInlineVideo=null;state.currentMedia=null;state.playerActive=false;
}
function srhFixOverlayPlayer(url,title,entry=null){
  const sources=mediaCandidates(entry?.sources||url);
  state.playerActive=true;
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.saveTick=0;el.playerTitle.textContent=title;el.playerStatus.textContent='Carregando…';el.playerLayer.classList.remove('is-hidden');freezePage(true);
  attachVideo(el.video,sources,()=>{el.playerStatus.textContent='Reproduzindo';if(entry?.position>5&&entry.position<el.video.duration-5)el.video.currentTime=entry.position},err=>{el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')});
  el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};el.video.onpause=()=>persistProgress();el.video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type)};
}
function srhFixInlinePlayer(url,title,entry=null){
  const art=el.detailBody.querySelector('.detail-art');if(!art)return srhFixOverlayPlayer(url,title,entry);
  srhFixStopInlineDetailVideo(false);
  const sources=mediaCandidates(entry?.sources||url),image=art.querySelector('img'),video=document.createElement('video');
  video.className='detail-inline-video';video.controls=true;video.autoplay=true;video.playsInline=true;video.preload='metadata';
  const status=document.createElement('div');status.className='detail-inline-status';status.textContent='Carregando…';
  const actions=document.createElement('div');actions.className='detail-inline-actions';actions.innerHTML='<button class="detail-inline-action" data-inline-close aria-label="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="detail-inline-action" data-inline-expand aria-label="Expandir vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';
  if(image)image.classList.add('is-hidden');art.classList.add('is-playing');art.append(video,status,actions);
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.playerActive=false;state.saveTick=0;state.detailInlineVideo={video,image,actions,status,art};
  attachVideo(video,sources,()=>{status.textContent='Reproduzindo';if(entry?.position>5&&Number.isFinite(video.duration)&&entry.position<video.duration-5)video.currentTime=entry.position},err=>{status.textContent='Falha: '+(err?.message||'mídia indisponível')});
  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};video.onpause=()=>persistProgress(video);video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type);status.textContent='Finalizado'};
  actions.querySelector('[data-inline-close]').onclick=e=>{e.stopPropagation();srhFixStopInlineDetailVideo(true)};
  actions.querySelector('[data-inline-expand]').onclick=e=>{e.stopPropagation();toggleFullscreen(art)};
}
function openGeneralPlayer(url,title,entry=null){
  const detailOpen=!el.detailLayer.classList.contains('is-hidden'),inlineType=state.currentDetail?.type;
  if(detailOpen&&(inlineType==='vod'||inlineType==='live'))return srhFixInlinePlayer(url,title,entry);
  return srhFixOverlayPlayer(url,title,entry);
}
function openDetail(title){
  srhFixStopInlineDetailVideo(false);closePlayer(false);detailModal()?.classList.remove('is-series');el.detailHeadTitle.textContent='';el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';el.detailScroll.scrollTop=0;el.detailLayer.classList.remove('is-hidden');freezePage(true);state.currentDetail={title};state.synopsisExpanded=false;state.synopsisText='';state.synopsisNode=null;
}
async function closeDetail(){
  srhFixStopInlineDetailVideo(false);
  if(state.seriesVideo){persistProgress(state.seriesVideo.video);state.seriesVideo.video.pause();destroyHls();state.seriesVideo=null}
  await leaveFullscreenPortrait();el.detailLayer.classList.add('is-hidden');detailModal()?.classList.remove('is-series');state.currentDetail=null;state.currentSeries=null;state.synopsisNode=null;state.synopsisText='';state.synopsisExpanded=false;freezePage(!el.collectionView.classList.contains('is-hidden'));
}
