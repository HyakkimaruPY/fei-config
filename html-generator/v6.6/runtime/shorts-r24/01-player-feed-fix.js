/* SRHELL Shorts R24 — stable feed + poster-first player patch. */
(function installR24FeedPlayerFix(){
  const frame=el.shortVideo?.closest('.short-player__frame')||document.getElementById('shortFrame');
  const poster=document.createElement('div');
  poster.className='srh-r24-poster is-hidden';
  poster.innerHTML='<img alt=""><div class="srh-r24-poster__control"><span class="srh-r24-poster__play"></span></div>';
  frame?.appendChild(poster);
  const posterImg=poster.querySelector('img');
  let posterToken=0;

  function showPoster(item){
    const src=itemImage(item)||IMAGE_PLACEHOLDER;
    posterToken++;
    poster.classList.remove('is-hidden','is-ready');
    posterImg.dataset.fallback='';
    posterImg.src=src;
  }
  function armFirstFrame(){
    const token=posterToken;
    const hide=()=>{
      if(token!==posterToken)return;
      const finish=()=>{
        if(token!==posterToken)return;
        poster.classList.add('is-ready');
        setTimeout(()=>{if(token===posterToken)poster.classList.add('is-hidden')},180);
      };
      if(typeof el.shortVideo.requestVideoFrameCallback==='function'){
        try{el.shortVideo.requestVideoFrameCallback(()=>finish());return}catch{}
      }
      requestAnimationFrame(()=>requestAnimationFrame(finish));
    };
    el.shortVideo.addEventListener('playing',hide,{once:true});
  }

  /* Static CSS grid: no innerHTML replacement while the user scrolls.
     Browser-native lazy images now handle the feed. */
  renderGrid=function(force=false){
    const items=currentShortItems();
    if(!items.length){
      state.srhFlowSig='';
      el.feedSpacer.classList.remove('srh-r24-flow');
      el.feedSpacer.style.height='auto';
      el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';
      return;
    }
    const sig=(state.filteredItems?'f:':'a:')+items.length+':'+itemId(items[0])+':'+itemId(items[items.length-1])+':'+(state.filteredItems?el.search.value:'');
    if(sig===state.srhFlowSig&&el.feedSpacer.children.length)return;
    state.srhFlowSig=sig;
    state.gridSig=sig;
    const hmap=new Map(history().map(x=>[String(x.streamId),x]));
    el.feedSpacer.classList.add('srh-r24-flow');
    el.feedSpacer.style.height='auto';
    el.feedSpacer.innerHTML=items.map((item,idx)=>{
      const id=itemId(item),sec=durationFor(item),count=arcCount(sec),h=hmap.get(id),pct=h?.duration?Math.min(100,h.position/h.duration*100):0,img=itemImage(item)||IMAGE_PLACEHOLDER;
      return `<article class="short-card" data-index="${idx}" data-stream-id="${escapeHtml(id)}"><img class="short-card__image" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async"><div class="arc-badge">${count?count+' arco'+(count>1?'s':''):'…'}</div>${pct>0?`<div class="card-progress"><span style="width:${pct}%"></span></div>`:''}</article>`;
    }).join('');
    el.feedSpacer.querySelectorAll('[data-index]').forEach(card=>card.onclick=()=>openShort(items[Number(card.dataset.index)],0));
    setProbeWindow(items.slice(0,Math.min(12,items.length)));
  };

  /* Faster failover for media sources. A bad source can no longer keep the
     loading poster spinning indefinitely before the next candidate is tried. */
  attachCandidates=function(candidates,onReady,onError){
    let queue=uniqueMediaUrls(candidates);
    if(location.protocol==='https:')queue.sort((a,b)=>Number(/^https:/i.test(b))-Number(/^https:/i.test(a)));
    const v=el.shortVideo;
    v.preload='auto';
    let i=0,last=null,done=false,timer=0;
    const cleanup=()=>{clearTimeout(timer);v.onerror=null;v.onloadedmetadata=null};
    const next=()=>{
      if(done)return;
      cleanup();
      if(i>=queue.length){done=true;onError?.(last);return}
      const current=queue[i++];
      destroyHls();
      try{v.pause()}catch{}
      v.removeAttribute('src');
      try{v.load()}catch{}
      const fail=extra=>{
        if(done)return;
        last=mediaErrorInfo(v,extra||{type:'timeout de carregamento'});
        next();
      };
      const ready=()=>{
        if(done)return;
        done=true;
        cleanup();
        onReady?.(current);
        const p=v.play();
        if(p&&typeof p.catch==='function')p.catch(()=>{});
      };
      timer=setTimeout(()=>fail({type:'timeout de carregamento'}),5200);
      const isHls=/\.m3u8(?:$|\?)/i.test(current);
      if(isHls&&window.Hls&&Hls.isSupported()){
        state.hls=new Hls({
          enableWorker:true,
          lowLatencyMode:false,
          maxBufferLength:12,
          backBufferLength:6,
          manifestLoadingTimeOut:4800,
          levelLoadingTimeOut:4800,
          fragLoadingTimeOut:6000
        });
        state.hls.loadSource(current);
        state.hls.attachMedia(v);
        state.hls.on(Hls.Events.MANIFEST_PARSED,ready);
        state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)});
      }else{
        v.src=current;
        v.onloadedmetadata=ready;
        v.onerror=()=>fail();
        v.load();
        const p=v.play();
        if(p&&typeof p.catch==='function')p.catch(()=>{});
      }
    };
    next();
  };

  currentArc=function(){return Math.max(0,Math.floor((el.shortVideo.currentTime||0)/120))};

  const baseOpenShort=openShort;
  openShort=function(item,resumeAt=0){
    showPoster(item);
    armFirstFrame();
    return baseOpenShort(item,resumeAt);
  };

  closeShort=async function(){
    persistProgress();
    try{el.shortVideo.pause()}catch{}
    destroyHls();
    el.arcDrawer.classList.add('is-hidden');
    state.current=null;
    /* The feed was never destroyed, so reveal it only after fullscreen exits. */
    await Promise.race([
      Promise.resolve(leavePortraitFullscreen()).catch(()=>{}),
      new Promise(resolve=>setTimeout(resolve,500))
    ]);
    el.shortPlayer.classList.add('is-hidden');
    poster.classList.add('is-hidden');
    try{el.shortVideo.removeAttribute('src');el.shortVideo.load()}catch{}
  };
  el.shortClose.onclick=closeShort;
})();
