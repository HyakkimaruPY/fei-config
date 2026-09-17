/* SRHELL standard R25 — Android/WebView stability.
   Avoids unresolved orientation promises and lets the detail modal close before
   any fullscreen/orientation cleanup continues. */
function srhR25Settle(value,timeout=650){
  return Promise.race([
    Promise.resolve(value).catch(()=>null),
    new Promise(resolve=>setTimeout(resolve,timeout))
  ]);
}

enterFullscreen=async function(node){
  try{
    if(!document.fullscreenElement&&node?.requestFullscreen)await srhR25Settle(node.requestFullscreen(),800);
  }catch{}
  if(document.fullscreenElement&&isMobile()){
    try{if(screen.orientation?.lock)await srhR25Settle(screen.orientation.lock('landscape'),450)}catch{}
  }
};

leaveFullscreenPortrait=async function(){
  const hadFullscreen=!!document.fullscreenElement;
  if(hadFullscreen){
    try{await srhR25Settle(document.exitFullscreen?.(),650)}catch{}
  }
  /* lock('portrait') outside fullscreen can remain pending forever in some
     Android browsers. Releasing the lock is both cheaper and standards-safe. */
  try{screen.orientation?.unlock?.()}catch{}
};

closeDetail=async function(){
  try{window.SRHELL_PROXY_POOL?.abortDetails?.()}catch{}
  try{if(typeof srhFixStopInlineDetailVideo==='function')srhFixStopInlineDetailVideo(false)}catch{}
  if(state.seriesVideo){
    try{persistProgress(state.seriesVideo.video)}catch{}
    try{state.seriesVideo.video.pause()}catch{}
    try{state.seriesVideo.video.removeAttribute('src');state.seriesVideo.video.load()}catch{}
    try{destroyHls()}catch{}
    state.seriesVideo=null;
    state.currentMedia=null;
  }

  /* Close the visual layer first. The user must never wait on browser APIs. */
  el.detailLayer.classList.add('is-hidden');
  detailModal()?.classList.remove('is-series');
  state.currentDetail=null;
  state.currentSeries=null;
  state.synopsisNode=null;
  state.synopsisText='';
  state.synopsisExpanded=false;
  freezePage(!el.collectionView.classList.contains('is-hidden'));

  await leaveFullscreenPortrait();
};

/* onclick stored the older function object earlier in the bundle, so bind the
   final implementation explicitly. The backdrop listener resolves the binding
   dynamically and automatically uses this function. */
el.detailClose.onclick=e=>{e?.stopPropagation?.();closeDetail()};
