/* SRHELL Shorts R24 — keep current player behavior, restore first modular catalog renderer. */
(function installR24PlayerOnlyPatch(){
  function installShortsZoomLock(){
    if(window.__srhZoomLock)return;
    window.__srhZoomLock=true;
    const style=document.createElement('style');
    style.textContent='html,body{touch-action:pan-x pan-y!important;-ms-touch-action:pan-x pan-y!important}';
    document.head.appendChild(style);
    const stop=e=>e.preventDefault();
    ['gesturestart','gesturechange','gestureend'].forEach(type=>document.addEventListener(type,stop,{passive:false}));
    document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
    document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault()},{passive:false});
    document.addEventListener('keydown',e=>{
      if(!(e.ctrlKey||e.metaKey))return;
      if(['+','-','=','_','0'].includes(e.key))e.preventDefault();
    },true);
  }
  installShortsZoomLock();
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

  /* Player source failover retained from the current working player. */
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

  const baseCloseShort=closeShort;
  closeShort=async function(){
    const out=await baseCloseShort();
    poster.classList.add('is-hidden');
    return out;
  };
  el.shortClose.onclick=closeShort;
})();
