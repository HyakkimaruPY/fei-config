/* SRHELL v6.6 — modal/player lifecycle cleanup.
   Injected inside the standard runtime IIFE after the Aura/player patches. */

function srhDestroyDetailPlayback(){
  try{srhFixStopInlineDetailVideo(false)}catch{}
  if(state.seriesVideo){
    try{persistProgress(state.seriesVideo.video)}catch{}
    try{state.seriesVideo.video.pause()}catch{}
    try{state.seriesVideo.video.removeAttribute('src');state.seriesVideo.video.load()}catch{}
    state.seriesVideo=null;
  }
  try{destroyHls()}catch{}
  state.currentMedia=null;
  state.playerActive=false;
  el.detailBody?.querySelectorAll('video').forEach(v=>{
    try{v.pause()}catch{}
    try{v.removeAttribute('src');v.load()}catch{}
  });
}

/* Film/live player: the modal already has one close button, so the media area
   gets only the fullscreen control. */
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
  actions.innerHTML='<button class="detail-inline-action" data-inline-expand aria-label="Tela cheia"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';

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
  },err=>{status.textContent='Falha: '+(err?.message||'mídia indisponível')});

  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};
  video.onpause=()=>persistProgress(video);
  video.onended=()=>{
    if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type);
    status.textContent='Finalizado';
  };
  actions.querySelector('[data-inline-expand]').onclick=e=>{
    e.stopPropagation();
    toggleFullscreen(art);
  };
}

async function closeDetail(){
  srhDestroyDetailPlayback();
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

/* Rebind after all function overrides so both the top-right X and clicking the
   backdrop always execute the destructive close path. */
el.detailClose.onclick=()=>closeDetail();
el.detailLayer.addEventListener('click',e=>{
  if(e.target===el.detailLayer)closeDetail();
});
