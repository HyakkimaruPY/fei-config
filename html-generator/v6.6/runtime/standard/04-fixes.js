/* SRHELL v6.6 detail/player fixes — loaded after standard/03.js */
function srhFixInlineState(){
  return state.detailInlineVideo || null;
}
function srhFixStopInlineDetailVideo(restoreImage=true){
  const iv=srhFixInlineState();
  if(!iv)return;
  try{persistProgress(iv.video)}catch{}
  try{iv.video.pause()}catch{}
  try{destroyHls()}catch{}
  try{iv.video.removeAttribute('src');iv.video.load()}catch{}
  if(restoreImage&&iv.image)iv.image.classList.remove('is-hidden');
  if(iv.art)iv.art.classList.remove('is-playing');
  try{iv.video.remove()}catch{}
  try{iv.actions.remove()}catch{}
  try{iv.status.remove()}catch{}
  state.detailInlineVideo=null;
  state.currentMedia=null;
  state.playerActive=false;
}
function srhFixOverlayPlayer(url,title,entry=null){
  const sources=mediaCandidates(entry?.sources||url);
  state.playerActive=true;
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.saveTick=0;
  el.playerTitle.textContent=title;
  el.playerStatus.textContent='Carregando…';
  el.playerLayer.classList.remove('is-hidden');
  freezePage(true);
  attachVideo(el.video,sources,()=>{
    el.playerStatus.textContent='Reproduzindo';
    if(entry?.position>5&&entry.position<el.video.duration-5)el.video.currentTime=entry.position
  },err=>{
    el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')
  });
  el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};
  el.video.onpause=()=>persistProgress();
  el.video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type)}
}
function srhFixInlinePlayer(url,title,entry=null){
  const art=el.detailBody.querySelector('.detail-art');
  if(!art)return srhFixOverlayPlayer(url,title,entry);
  srhFixStopInlineDetailVideo(false);

  const sources=mediaCandidates(entry?.sources||url);
  const image=art.querySelector('img');
  const video=document.createElement('video');
  video.className='detail-inline-video';
  video.controls=true;
  video.autoplay=true;
  video.playsInline=true;
  video.preload='metadata';

  const status=document.createElement('div');
  status.className='detail-inline-status';
  status.textContent='Carregando…';

  const actions=document.createElement('div');
  actions.className='detail-inline-actions';
  actions.innerHTML='<button class="detail-inline-action" data-inline-close aria-label="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="detail-inline-action" data-inline-expand aria-label="Expandir vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';

  if(image)image.classList.add('is-hidden');
  art.classList.add('is-playing');
  art.append(video,status,actions);

  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.playerActive=false;
  state.saveTick=0;
  state.detailInlineVideo={video,image,actions,status,art};

  attachVideo(video,sources,()=>{
    status.textContent='Reproduzindo';
    if(entry?.position>5&&Number.isFinite(video.duration)&&entry.position<video.duration-5)video.currentTime=entry.position;
  },err=>{
    status.textContent='Falha: '+(err?.message||'mídia indisponível');
  });

  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};
  video.onpause=()=>persistProgress(video);
  video.onended=()=>{
    if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type);
    status.textContent='Finalizado';
  };

  actions.querySelector('[data-inline-close]').onclick=e=>{
    e.stopPropagation();
    srhFixStopInlineDetailVideo(true);
  };
  actions.querySelector('[data-inline-expand]').onclick=e=>{
    e.stopPropagation();
    toggleFullscreen(art);
  };
}
function openGeneralPlayer(url,title,entry=null){
  const detailOpen=!el.detailLayer.classList.contains('is-hidden');
  const inlineType=state.currentDetail?.type;
  if(detailOpen&&(inlineType==='vod'||inlineType==='live'))return srhFixInlinePlayer(url,title,entry);
  return srhFixOverlayPlayer(url,title,entry);
}
function openDetail(title){
  srhFixStopInlineDetailVideo(false);
  closePlayer(false);
  detailModal()?.classList.remove('is-series');
  el.detailHeadTitle.textContent='';
  el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';
  el.detailScroll.scrollTop=0;
  el.detailLayer.classList.remove('is-hidden');
  freezePage(true);
  state.currentDetail={title};
  state.synopsisExpanded=false;
  state.synopsisText='';
  state.synopsisNode=null;
}
async function closeDetail(){
  srhFixStopInlineDetailVideo(false);
  if(state.seriesVideo){
    persistProgress(state.seriesVideo.video);
    state.seriesVideo.video.pause();
    destroyHls();
    state.seriesVideo=null;
  }
  await leaveFullscreenPortrait();
  el.detailLayer.classList.add('is-hidden');
  detailModal()?.classList.remove('is-series');
  state.currentDetail=null;
  state.currentSeries=null;
  state.synopsisNode=null;
  state.synopsisText='';
  state.synopsisExpanded=false;
  freezePage(!el.collectionView.classList.contains('is-hidden'));
}
