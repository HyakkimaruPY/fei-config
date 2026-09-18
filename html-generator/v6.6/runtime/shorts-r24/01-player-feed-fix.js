/* SRHELL Shorts R24 — clean normal-flow renderer.
   Feed DOM is created once. No scroll virtualization, no IntersectionObserver,
   no lazy images and no card replacement during scrolling. */
(function installR24CleanRenderer(){
  const frame=el.shortVideo?.closest('.short-player__frame')||document.getElementById('shortFrame');
  const poster=document.createElement('div');
  poster.className='srh-r24-poster is-hidden';
  poster.innerHTML='<img alt=""><div class="srh-r24-poster__control"><span class="srh-r24-poster__play"></span></div>';
  frame?.appendChild(poster);
  const posterImg=poster.querySelector('img');
  let posterToken=0;

  function showPoster(item){
    const src=itemImage(item)||IMAGE_PLACEHOLDER;
    const token=++posterToken;
    poster.classList.remove('is-hidden','is-ready');
    posterImg.removeAttribute('src');
    const preload=new Image();
    preload.decoding='async';
    preload.onload=async()=>{
      try{await preload.decode?.()}catch{}
      if(token!==posterToken)return;
      posterImg.src=src;
    };
    preload.onerror=()=>{if(token===posterToken)posterImg.src=IMAGE_PLACEHOLDER};
    preload.src=src;
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

  function stopCoverLoader(){
    const loader=state.srhCoverLoader;
    if(loader)loader.cancelled=true;
    state.srhCoverLoader=null;
  }
  function startCoverLoader(cards){
    stopCoverLoader();
    const loader={cards:[...cards],next:0,active:0,cancelled:false};
    state.srhCoverLoader=loader;

    const pump=()=>{
      if(loader.cancelled||state.srhCoverLoader!==loader)return;
      while(loader.active<3&&loader.next<loader.cards.length){
        const card=loader.cards[loader.next++];
        if(!card?.isConnected)continue;
        const src=card.dataset.coverSrc||'';
        if(!src){card.classList.add('is-cover-error');continue}
        loader.active++;
        const img=new Image();
        img.className='short-card__image';
        img.alt='';
        img.decoding='async';
        let committed=false,slotReleased=false;
        const releaseSlot=()=>{
          if(slotReleased)return;
          slotReleased=true;
          loader.active=Math.max(0,loader.active-1);
          pump();
        };
        const timeout=setTimeout(releaseSlot,2500);
        const done=async ok=>{
          if(committed)return;
          committed=true;
          clearTimeout(timeout);
          if(ok){try{await img.decode?.()}catch{}}
          if(!loader.cancelled&&state.srhCoverLoader===loader&&card.isConnected){
            if(ok){
              card.appendChild(img);
              card.classList.add('is-cover-ready');
            }else{
              card.classList.add('is-cover-error');
            }
          }
          releaseSlot();
        };
        img.onload=()=>done(true);
        img.onerror=()=>done(false);
        img.src=src;
      }
    };
    pump();
  }

  renderGrid=function(force=false){
    const items=currentShortItems();
    if(!items.length){
      stopCoverLoader();
      state.srhFlowSig='';
      el.feedSpacer.className='feed-spacer';
      el.feedSpacer.style.height='auto';
      el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';
      return;
    }

    const sig=(state.filteredItems?'f:':'a:')+items.length+':'+itemId(items[0])+':'+itemId(items[items.length-1])+':'+(state.filteredItems?el.search.value:'');
    if(sig===state.srhFlowSig&&el.feedSpacer.querySelector('.short-card'))return;

    state.srhFlowSig=sig;
    state.gridSig=sig;
    state.probeWanted=new Set();
    state.probeQueue=[];
    state.probeQueued=new Set();
    state.probeActive=0;

    const hmap=new Map(history().map(x=>[String(x.streamId),x]));
    el.feedSpacer.className='feed-spacer srh-r24-flow';
    el.feedSpacer.style.height='auto';
    el.feedSpacer.innerHTML=items.map((item,idx)=>{
      const id=itemId(item);
      const sec=durationFor(item);
      const count=arcCount(sec);
      const h=hmap.get(id);
      const pct=h?.duration?Math.min(100,h.position/h.duration*100):0;
      const img=itemImage(item)||'';
      return `<article class="short-card" data-index="${idx}" data-stream-id="${escapeHtml(id)}" data-cover-src="${escapeHtml(img)}" aria-label="${escapeHtml(itemTitle(item)||'Short')}"></article>`;
    }).join('');

    const cards=[...el.feedSpacer.querySelectorAll('.short-card')];
    cards.forEach(card=>{
      card.onclick=()=>openShort(items[Number(card.dataset.index)],0);
    });
    startCoverLoader(cards);
  };

  /* Disable the historical duration probe scheduler for feed cards. */
  setProbeWindow=function(){state.probeWanted=new Set();state.probeQueue=[]};
  queueDurationProbe=function(){};
  runProbeQueue=function(){};

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
    await Promise.race([
      Promise.resolve(leavePortraitFullscreen()).catch(()=>{}),
      new Promise(resolve=>setTimeout(resolve,450))
    ]);
    el.shortPlayer.classList.add('is-hidden');
    poster.classList.add('is-hidden');
    try{el.shortVideo.removeAttribute('src');el.shortVideo.load()}catch{}
  };
  el.shortClose.onclick=closeShort;
})();
