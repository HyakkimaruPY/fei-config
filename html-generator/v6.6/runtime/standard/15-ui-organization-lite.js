/* SRHELL v6.6 — lightweight restoration of later UI organization.
   No MutationObserver, iframe favorites, extra transport or background network work. */
(function installLiteUiOrganization(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const FAVORITES_TAB_KEY=`srhell:${APP_NS}:standard:favorites:tab:v1`;
  const MIN_CONTINUE_SECONDS=60;
  function installPageZoomLock(){
    if(window.__srhZoomLock)return;
    window.__srhZoomLock=true;
    const style=document.createElement('style');
    style.textContent='html,body{touch-action:pan-x pan-y!important;-ms-touch-action:pan-x pan-y!important}';
    document.head.appendChild(style);
    const stop=e=>{e.preventDefault()};
    ['gesturestart','gesturechange','gestureend'].forEach(type=>document.addEventListener(type,stop,{passive:false}));
    document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
    document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault()},{passive:false});
    document.addEventListener('keydown',e=>{
      if(!(e.ctrlKey||e.metaKey))return;
      if(['+','-','=','_','0'].includes(e.key))e.preventDefault();
    },true);
  }
  installPageZoomLock();
  const STAR='<svg class="srh-lite-icon srh-lite-icon--star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH='<svg class="srh-lite-icon srh-lite-icon--trash" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  const FAVORITES_MEMORY_KEY='__srhFavorites_'+APP_NS;
  function readFavorites(){
    try{
      const raw=localStorage.getItem(FAVORITES_KEY);
      if(raw!==null){
        const v=JSON.parse(raw||'[]');
        if(Array.isArray(v)){window[FAVORITES_MEMORY_KEY]=v;return v}
      }
    }catch{}
    try{
      const raw=sessionStorage.getItem(FAVORITES_KEY);
      if(raw!==null){
        const v=JSON.parse(raw||'[]');
        if(Array.isArray(v)){window[FAVORITES_MEMORY_KEY]=v;return v}
      }
    }catch{}
    return Array.isArray(window[FAVORITES_MEMORY_KEY])?window[FAVORITES_MEMORY_KEY]:[];
  }
  function clearDisposableStorage(){
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const k=localStorage.key(i)||'';
        if(/^srhell:tmdb:cache:/i.test(k))localStorage.removeItem(k);
      }
    }catch{}
  }
  function writeFavorites(list){
    const compact=list.slice(0,160),raw=JSON.stringify(compact);
    window[FAVORITES_MEMORY_KEY]=compact;
    try{
      localStorage.setItem(FAVORITES_KEY,raw);
      return true;
    }catch(e){
      const quota=e?.name==='QuotaExceededError'||e?.name==='NS_ERROR_DOM_QUOTA_REACHED'||e?.code===22||e?.code===1014;
      if(quota){
        clearDisposableStorage();
        try{localStorage.setItem(FAVORITES_KEY,raw);return true}catch{}
      }
      try{sessionStorage.setItem(FAVORITES_KEY,raw);return true}catch{}
      return false;
    }
  }
  function favoriteKey(type,item){
    if(type==='live'){
      const id=item?.variants?.[0]?.stream_id||item?.variants?.[0]?.id||'';
      return 'live:'+(id||String(item?.baseName||'canal').toLocaleLowerCase('pt-BR'));
    }
    if(type==='series')return 'series:'+String(item?.series_id??item?.id??'');
    return 'vod:'+String(item?.stream_id??item?.id??'');
  }
  function compactFavorite(type,item){
    const key=favoriteKey(type,item);
    if(type==='live'){
      const variants=(item?.variants||[]).map(v=>({stream_id:v.stream_id??v.id,name:v.name||v.title||item.baseName,stream_icon:v.stream_icon||item.image||'',container_extension:v.container_extension||'',_quality:v._quality||'Padrão'}));
      return{key,type,title:item?.baseName||'Canal',image:item?.image||variants[0]?.stream_icon||'',item:{baseName:item?.baseName||'Canal',image:item?.image||'',variants}};
    }
    if(type==='series')return{key,type,title:itemTitle(item),image:imageFor(item,'series'),item:{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')}};
    return{key,type,title:itemTitle(item),image:imageFor(item,'vod'),item:{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod'),container_extension:item?.container_extension||'mp4'}};
  }
  function isFavorite(type,item){const key=favoriteKey(type,item);return readFavorites().some(x=>x.key===key)}
  function toggleFavorite(type,item){
    const entry=compactFavorite(type,item),list=readFavorites(),idx=list.findIndex(x=>x.key===entry.key);let active=false;
    if(idx>=0)list.splice(idx,1);else{list.unshift(entry);active=true}
    if(!writeFavorites(list)){toast('Não foi possível salvar Favoritos.');return isFavorite(type,item)}
    toast(active?'Adicionado aos Favoritos.':'Removido dos Favoritos.');
    if(state.srhFavoritesOpen){
      favoriteEntries=readFavorites();
      renderFavoriteType(favoriteTab);
    }
    return active;
  }

  const CONT_MEMORY_KEY='__srhContinue_'+APP_NS;
  const contMemory=window[CONT_MEMORY_KEY]||(window[CONT_MEMORY_KEY]={vod:[],series:[]});

  function writeHistoryBucket(type,list){
    const bucket=type==='series'?'series':'vod';
    const compact=(Array.isArray(list)?list:[]).slice(0,40);
    contMemory[bucket]=compact;
    const raw=JSON.stringify(compact);
    try{
      localStorage.setItem(historyKey(bucket),raw);
      try{sessionStorage.removeItem(historyKey(bucket))}catch{}
      /* Read-after-write keeps the memory mirror identical to persistent storage. */
      try{
        const verified=JSON.parse(localStorage.getItem(historyKey(bucket))||'[]');
        contMemory[bucket]=Array.isArray(verified)?verified:compact;
      }catch{contMemory[bucket]=compact}
      return true;
    }catch(e){
      const quota=e?.name==='QuotaExceededError'||e?.name==='NS_ERROR_DOM_QUOTA_REACHED'||e?.code===22||e?.code===1014;
      if(quota){
        clearDisposableStorage();
        try{localStorage.setItem(historyKey(bucket),raw);return true}catch{}
      }
      try{sessionStorage.setItem(historyKey(bucket),raw);return true}catch{}
      return false;
    }
  }

  const baseGetHistory=getHistory;
  getHistory=function(type){
    if(type==='live')return[];
    const bucket=type==='series'?'series':'vod';
    try{
      const raw=localStorage.getItem(historyKey(bucket));
      if(raw!==null){
        const list=JSON.parse(raw||'[]');
        if(Array.isArray(list)){contMemory[bucket]=list;return list}
      }
    }catch{}
    try{
      const raw=sessionStorage.getItem(historyKey(bucket));
      if(raw!==null){
        const list=JSON.parse(raw||'[]');
        if(Array.isArray(list)){contMemory[bucket]=list;return list}
      }
    }catch{}
    const fallback=baseGetHistory(bucket);
    if(Array.isArray(fallback)&&fallback.length){contMemory[bucket]=fallback;return fallback}
    return Array.isArray(contMemory[bucket])?contMemory[bucket]:[];
  };

  saveHistory=function(entry){
    if(!entry||entry.type==='live')return false;
    if(Number(entry.position)<MIN_CONTINUE_SECONDS)return false;
    const bucket=entry.type==='series'?'series':'vod';
    let list=getHistory(bucket).filter(x=>x.key!==entry.key);
    list.unshift(entry);
    const ok=writeHistoryBucket(bucket,list);
    renderContinue();
    return ok;
  };

  removeHistory=function(key,type){
    if(type==='live')return false;
    const bucket=type==='series'?'series':'vod';
    const next=getHistory(bucket).filter(x=>x.key!==key);
    const ok=writeHistoryBucket(bucket,next);
    renderContinue();
    return ok;
  };

  (function pruneShortContinueEntries(){
    for(const type of ['vod','series']){
      const list=getHistory(type);
      const clean=list.filter(x=>Number(x.position)>=MIN_CONTINUE_SECONDS&&Number(x.duration)>0);
      if(clean.length!==list.length)writeHistoryBucket(type,clean);
    }
  })();

  function startedEntry(type,item){
    if(type==='vod'){
      const key='vod:'+String(item?.stream_id??item?.id??'');
      return getHistory('vod').find(x=>x.key===key&&Number(x.position)>=MIN_CONTINUE_SECONDS&&Number(x.duration)>0)||null;
    }
    if(type==='series'){
      const sid=String(item?.series_id??item?.id??'');
      return getHistory('series').find(x=>String(x.seriesId??'')===sid&&Number(x.position)>=MIN_CONTINUE_SECONDS&&Number(x.duration)>0)||null;
    }
    return null;
  }
  function detachRemovedCurrentMedia(type,started,item){
    const media=state.currentMedia;
    if(!media)return;
    if(type==='vod'){
      if(media.key===started?.key)state.currentMedia=null;
      return;
    }
    if(type==='series'){
      const sid=String(started?.seriesId??item?.series_id??item?.id??'');
      if(String(media.seriesId??'')===sid)state.currentMedia=null;
    }
  }

  function removeStarted(type,item){
    const started=startedEntry(type,item);
    if(!started)return false;
    let ok=false;
    if(type==='vod'){
      /* Clear the active paused resume object before any pause/close handler can
         persist it again after deletion. */
      detachRemovedCurrentMedia('vod',started,item);
      ok=removeHistory(started.key,'vod');
      if(ok)renderContinue();
      toast(ok?'Filme removido de Continuar assistindo.':'Não foi possível remover o filme.');
      return ok;
    }
    if(type==='series'){
      const sid=String(started.seriesId??item?.series_id??item?.id??'');
      detachRemovedCurrentMedia('series',started,item);
      const next=getHistory('series').filter(x=>String(x.seriesId??'')!==sid);
      ok=writeHistoryBucket('series',next);
      if(ok)renderContinue();
      toast(ok?'Série removida de Continuar assistindo.':'Não foi possível remover a série.');
      return ok;
    }
    return false;
  }

  function actionButton(kind,type,item){
    const active=kind==='favorite'&&isFavorite(type,item),b=document.createElement('button');
    b.type='button';b.className='srh-lite-action srh-lite-action--'+kind+(active?' is-active':'');
    if(kind==='favorite'){
      b.setAttribute('aria-label',active?'Remover dos favoritos':'Adicionar aos favoritos');
      b.innerHTML=STAR;
      b.onclick=e=>{
        e.stopPropagation();
        const on=toggleFavorite(type,item);
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-label',on?'Remover dos favoritos':'Adicionar aos favoritos');
      };
    }else{
      b.setAttribute('aria-label','Remover de Continuar assistindo');
      b.innerHTML=TRASH;
      b.onclick=e=>{
        e.stopPropagation();
        if(removeStarted(type,item))b.remove();
      };
    }
    return b;
  }
  function actionGroup(type,item){
    const g=document.createElement('div');g.className='srh-lite-actions';
    if((type==='vod'||type==='series')&&startedEntry(type,item))g.appendChild(actionButton('trash',type,item));
    g.appendChild(actionButton('favorite',type,item));
    return g;
  }
  function markModal(type){
    const modal=detailModal();if(!modal)return;
    modal.classList.remove('is-vod','is-series','is-live');
    modal.classList.add('is-'+type);
    el.detailHeadTitle.textContent='';
  }
  function decorateDetail(type,item){
    markModal(type);
    const body=el.detailBody,row=body.querySelector('.detail-title-row'),syn=body.querySelector('.synopsis');
    if(!row)return;
    row.querySelector('.srh-lite-actions')?.remove();
    body.querySelector('.srh-lite-film-actions')?.remove();
    if(type==='vod'){
      const watch=row.querySelector('.watch-button')||body.querySelector('.watch-button');
      if(watch)watch.remove();
      const actions=document.createElement('div');
      actions.className='srh-lite-film-actions';
      actions.appendChild(actionGroup(type,item));
      if(watch)actions.appendChild(watch);
      (syn||row).insertAdjacentElement('afterend',actions);
    }else{
      row.appendChild(actionGroup(type,item));
    }
    if(type==='series')body.querySelector('#seriesStop')?.remove();
  }

  /* Poster/card geometry only. Keep the stable virtualizers and simply restore 2:3 math. */
  RailVirtualizer.prototype.metrics=function(){
    const live=this.type==='live',w=innerWidth<680?(live?116:108):(live?146:132),gap=9,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));
    return{w,gap,slot,visible};
  };
  RailVirtualizer.prototype.render=function(force=false){
    const m=this.metrics(),ratio=this.type==='live'?1:1.5,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length,this.type].join(':');
    if(!force&&sig===this.sig)return;
    this.sig=sig;
    const h=Math.round(m.w*ratio);
    this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';
    this.track.style.height=h+'px';
    this.track.innerHTML=this.items.slice(start,end).map((item,off)=>cardHtml(item,this.type,'poster-card',start+off,(start+off)*m.slot,m.w).replace(/height:[^;"]+px/,`height:${h}px`)).join('');
    this.track.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type));
  };
  GridVirtualizer.prototype.metrics=function(){
    const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:10,live=this.type==='live',base=live?138:122,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(base+gap))),w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
    return{available,gap,cols,w,h,rowH};
  };

  function detailSkeleton(type){
    const title='<span class="srh-shimmer-line srh-shimmer-line--title"></span>';
    const synopsis='<div class="synopsis srh-skeleton-synopsis"><span class="srh-shimmer-line"></span><span class="srh-shimmer-line"></span><span class="srh-shimmer-line"></span></div>';
    const actions='<div class="srh-skeleton-actions"><span class="srh-shimmer-button"></span><span class="srh-shimmer-button"></span><span class="srh-shimmer-button srh-shimmer-button--wide"></span></div>';
    if(type==='live'){
      return '<div class="detail-content srh-modal-loading"><div class="detail-art srh-shimmer-block"></div><div class="detail-title-row">'+title+'</div><div class="quality-list srh-skeleton-quality"><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span></div></div>';
    }
    if(type==='series'){
      return '<div class="detail-content srh-modal-loading"><div class="series-static"><div class="detail-art srh-shimmer-block"></div><div class="detail-title-row">'+title+'<div class="srh-lite-actions"><span class="srh-shimmer-button"></span><span class="srh-shimmer-button"></span></div></div>'+synopsis+'<div class="season-box"><span class="season-trigger srh-shimmer-row"></span></div></div><div class="episode-container"><div class="episode-list srh-skeleton-episodes"><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span></div></div></div>';
    }
    return '<div class="detail-content srh-modal-loading"><div class="detail-art srh-shimmer-block"></div><div class="detail-title-row">'+title+'</div>'+synopsis+actions+'</div>';
  }

  const baseOpenDetail=openDetail;
  openDetail=function(title){
    const r=baseOpenDetail(title);
    const type=state.srhPendingDetailType||'';
    const modal=detailModal();
    modal?.classList.remove('is-vod','is-series','is-live');
    if(type){
      modal?.classList.add('is-'+type);
      el.detailBody.innerHTML=detailSkeleton(type);
    }
    return r;
  };
  const baseOpenFilm=openFilm;
  openFilm=async function(item){
    state.srhPendingDetailType='vod';
    try{await baseOpenFilm(item);decorateDetail('vod',item)}
    finally{state.srhPendingDetailType=''}
  };
  const baseOpenSeries=openSeries;
  openSeries=async function(item){
    state.srhPendingDetailType='series';
    try{await baseOpenSeries(item);decorateDetail('series',item)}
    finally{state.srhPendingDetailType=''}
  };
  const baseOpenLive=openLive;
  openLive=function(group){
    state.srhPendingDetailType='live';
    try{const r=baseOpenLive(group);decorateDetail('live',group);return r}
    finally{state.srhPendingDetailType=''}
  };

  /* Settings behaves as a dismissible popover: interactions inside it keep it open,
     while any pointer press elsewhere closes it. */
  if(!window.__srhSettingsClickAway){
    window.__srhSettingsClickAway=true;
    document.addEventListener('pointerdown',e=>{
      if(el.settingsPanel?.classList.contains('is-hidden'))return;
      const target=e.target;
      if(el.settingsPanel?.contains(target)||el.settingsButton?.contains(target))return;
      el.settingsPanel.classList.add('is-hidden');
    },true);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!el.settingsPanel?.classList.contains('is-hidden'))el.settingsPanel.classList.add('is-hidden');
    },true);
  }

  /* Stable rail loading: one category-map request per type, fixed-size shimmer
     placeholders, abortable content requests and one controlled retry. */
  const srhRailCategoryInflight=new Map();
  const srhRailScheduler={active:0,max:2,queue:[]};
  function pumpRailQueue(){
    while(srhRailScheduler.active<srhRailScheduler.max&&srhRailScheduler.queue.length){
      const job=srhRailScheduler.queue.shift();
      if(job.token!==state.renderToken){job.resolve([]);continue}
      srhRailScheduler.active++;
      Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{
        srhRailScheduler.active=Math.max(0,srhRailScheduler.active-1);
        pumpRailQueue();
      });
    }
  }
  function scheduleRailTask(task,token){
    return new Promise((resolve,reject)=>{
      srhRailScheduler.queue.push({task,token,resolve,reject});
      pumpRailQueue();
    });
  }
  function railCardMetrics(type){
    const live=type==='live';
    const w=innerWidth<680?(live?116:108):(live?146:132);
    return{w,h:Math.round(w*(live?1:1.5)),gap:9};
  }
  function railSkeletonMarkup(type){
    const m=railCardMetrics(type);
    const available=Math.max(260,document.documentElement.clientWidth-(innerWidth<680?24:40));
    const count=Math.max(3,Math.min(12,Math.ceil((available+m.gap)/(m.w+m.gap))+1));
    return '<div class="rail-skeleton-row" style="--sk-w:'+m.w+'px;--sk-h:'+m.h+'px">'+Array.from({length:count},()=>'<span class="rail-skeleton-card"></span>').join('')+'</div>';
  }
  function railFetchJson(params,timeout=7200){
    const target=apiUrl(params,CONFIG);
    const urls=[target];
    if(CONFIG.corsProxy)urls.push(proxyUrl(target,CONFIG));
    let index=0,last=null;
    const next=async()=>{
      if(index>=urls.length)throw(last||new Error('Falha ao carregar categoria.'));
      const url=urls[index++];
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),timeout);
      try{
        const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
        if(!r.ok)throw new Error('HTTP '+r.status);
        return await r.json();
      }catch(e){last=e;return next()}
      finally{clearTimeout(timer)}
    };
    return next();
  }
  async function stableRailCategoryMap(type){
    if(state.categoryMaps.has(type))return state.categoryMaps.get(type);
    if(srhRailCategoryInflight.has(type))return srhRailCategoryInflight.get(type);
    const p=railFetchJson({action:TYPE[type].categories},6500).then(raw=>{
      const map=new Map((Array.isArray(raw)?raw:[]).map(c=>[String(c.category_name??c.name??''),String(c.category_id??c.id??'')]));
      state.categoryMaps.set(type,map);
      return map;
    }).finally(()=>srhRailCategoryInflight.delete(type));
    srhRailCategoryInflight.set(type,p);
    return p;
  }
  async function stableLoadTargetItems(target,token=state.renderToken){
    const map=await stableRailCategoryMap(target.type);
    const id=map.get(target.name);
    if(!id)throw new Error('Categoria não encontrada: '+stripEmoji(target.name));
    return scheduleRailTask(async()=>{
      if(token!==state.renderToken)return[];
      const raw=await railFetchJson({action:TYPE[target.type].content,category_id:id},10500);
      return Array.isArray(raw)?raw:[];
    },token);
  }
  function mountRailItems(section,target,items){
    const body=section.querySelector('.rail-body');
    body.innerHTML='<div class="rail-viewport"><div class="rail-track"></div></div>';
    const v=new RailVirtualizer(section,target.type,items,openItem);
    section._railV=v;
    state.railInstances.push(v);
    section.querySelector('[data-all]').onclick=()=>openCollection(target.name,target.type,items);
  }
  renderRail=async function(section,target,token){
    if(token!==state.renderToken)return;
    const body=section.querySelector('.rail-body');
    body.innerHTML=railSkeletonMarkup(target.type);
    let error=null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const raw=await stableLoadTargetItems(target,token);
        if(token!==state.renderToken)return;
        const items=target.type==='live'?groupChannels(raw):uniqueById(raw,target.type);
        if(!items.length){
          body.innerHTML='<div class="skeleton">Sem conteúdos nesta categoria.</div>';
          return;
        }
        mountRailItems(section,target,items);
        return;
      }catch(e){
        error=e;
        if(attempt===0){
          await new Promise(resolve=>setTimeout(resolve,320));
          body.innerHTML=railSkeletonMarkup(target.type);
        }
      }
    }
    if(token!==state.renderToken)return;
    body.innerHTML='<div class="rail-load-error"><span>Não foi possível carregar esta categoria agora.</span><button type="button">Tentar novamente</button></div>';
    body.querySelector('button').onclick=()=>{
      section.dataset.loaded='1';
      renderRail(section,target,state.renderToken);
    };
    console.warn('Rail load failed',target?.name,error);
  };
  evictRail=function(section){
    if(!section||section.dataset.loaded!=='1'||state.collectionOpen)return;
    const v=section._railV;
    if(v){
      v.destroy();
      state.railInstances=state.railInstances.filter(x=>x!==v);
      section._railV=null;
    }
    const idx=Number(section.dataset.target);
    const target=targetsFor(state.activeType)[idx];
    section.querySelector('.rail-body').innerHTML=railSkeletonMarkup(target?.type||state.activeType);
    delete section.dataset.loaded;
    state.categoryObserver?.observe(section);
  };
  const baseRenderActiveType=renderActiveType;
  renderActiveType=function(){
    srhRailScheduler.queue.splice(0).forEach(job=>job.resolve([]));
    baseRenderActiveType();
    const targets=targetsFor(state.activeType);
    el.content.querySelectorAll('.rail-section').forEach(section=>{
      const target=targets[Number(section.dataset.target)];
      const body=section.querySelector('.rail-body');
      if(target&&body&&!section.dataset.loaded)body.innerHTML=railSkeletonMarkup(target.type);
    });
  };

  /* Favorites has its own tab state and remains mounted behind detail modals.
     Closing a favorite returns to Favorites, never to a destroyed home grid. */
  const head=el.collectionTitle?.parentElement;
  const favTabs=document.createElement('div');
  favTabs.className='srh-favorites-tabs is-hidden';
  favTabs.innerHTML='<button class="srh-favorites-tab" data-fav-type="live">Ao vivo</button><button class="srh-favorites-tab" data-fav-type="vod">Filmes</button><button class="srh-favorites-tab" data-fav-type="series">Séries</button>';
  head?.insertAdjacentElement('afterend',favTabs);
  let favoriteEntries=[];
  let favoriteTab=localStorage.getItem(FAVORITES_TAB_KEY);
  if(!['live','vod','series'].includes(favoriteTab))favoriteTab='vod';

  function renderFavoriteType(type){
    if(!['live','vod','series'].includes(type))type='vod';
    favoriteTab=type;
    try{localStorage.setItem(FAVORITES_TAB_KEY,type)}catch{}
    state.gridInstance?.destroy();
    state.gridInstance=null;
    el.collectionSpacer.innerHTML='';
    el.collectionSpacer.style.height='';
    favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.favType===type));
    const list=favoriteEntries.filter(x=>x.type===type);
    if(!list.length){
      el.collectionSpacer.innerHTML='<div class="srh-favorites-empty">Nenhum favorito nesta seção.</div>';
      el.collectionScroller.scrollTop=0;
      return;
    }
    const items=list.map(x=>x.item);
    state.gridInstance=new GridVirtualizer(
      el.collectionScroller,
      el.collectionSpacer,
      type,
      items,
      (item,itemType)=>openItem(item,itemType)
    );
    el.collectionScroller.scrollTop=0;
  }

  function openFavorites(){
    closeDetail();
    closePlayer(false);
    state.searchDataset=null;
    state.searchType=null;
    state.gridInstance?.destroy();
    state.gridInstance=null;
    el.collectionSpacer.innerHTML='';
    el.collectionSpacer.style.height='';
    favoriteEntries=readFavorites();
    el.collectionTitle.textContent='Favoritos';
    el.collectionView.classList.remove('is-hidden');
    state.collectionOpen=true;
    state.srhFavoritesOpen=true;
    freezePage(true);
    favTabs.classList.remove('is-hidden');
    renderFavoriteType(favoriteTab);
  }

  favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.onclick=()=>renderFavoriteType(b.dataset.favType));

  const baseOpenCollection=openCollection;
  openCollection=function(title,type,items){
    state.srhFavoritesOpen=false;
    favTabs.classList.add('is-hidden');
    return baseOpenCollection(title,type,items);
  };

  const baseCloseCollection=closeCollection;
  closeCollection=function(rebuild=true){
    const wasFavorites=!!state.srhFavoritesOpen;
    state.srhFavoritesOpen=false;
    favTabs.classList.add('is-hidden');
    return baseCloseCollection(wasFavorites?false:rebuild);
  };

  if(!document.getElementById('favoritesTopButton')){
    const b=document.createElement('button');
    b.type='button';b.className='icon-button';b.id='favoritesTopButton';b.setAttribute('aria-label','Favoritos');b.innerHTML=STAR;b.onclick=openFavorites;
    el.searchButton.insertAdjacentElement('afterend',b);
  }

  /* Continue watching opens the same full detail modal used by catalog items.
     The saved time is used to seek the media and freeze the exact frame in-place;
     no image/video frame bytes are stored in localStorage. */
  function historyVodItem(entry){
    const raw=String(entry?.key||'').split(':')[1]||'';
    let ext='mp4';
    try{
      const u=String(entry?.url||entry?.sources?.[0]||'');
      const m=u.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
      if(m)ext=m[1];
    }catch{}
    return{stream_id:raw,name:entry?.title||'Filme',stream_icon:entry?.image||'',container_extension:ext};
  }
  function historySeriesItem(entry){
    const name=String(entry?.title||'Série').replace(/\s+[—-]\s+Epis[oó]dio\s+\d+.*$/i,'').trim()||'Série';
    return{series_id:entry?.seriesId,name,cover:entry?.image||''};
  }
  function beginResumeGate(){
    const modal=detailModal();
    if(!modal)return()=>{};
    modal.querySelector('.srh-resume-gate')?.remove();
    const gate=document.createElement('div');
    gate.className='srh-resume-gate';
    gate.innerHTML='<div class="srh-resume-gate__art"></div><div class="srh-resume-gate__line"></div><div class="srh-resume-gate__line"></div><div class="srh-resume-gate__line"></div><div class="srh-resume-gate__actions"><span class="srh-resume-gate__button"></span><span class="srh-resume-gate__button"></span><span class="srh-resume-gate__button"></span></div>';
    modal.appendChild(gate);
    let done=false;
    const release=()=>{if(done)return;done=true;gate.remove()};
    setTimeout(release,8500);
    return release;
  }

  function waitForSavedFrame(video,position,onDone){
    return new Promise(resolve=>{
      if(!video||!(Number(position)>0)){onDone?.();resolve();return}
      const target=Math.max(0,Number(position)||0);
      let finished=false,timer=0;
      const finish=()=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        try{video.pause()}catch{}
        try{video.muted=false}catch{}
        const final=()=>{onDone?.();resolve()};
        if(typeof video.requestVideoFrameCallback==='function'){
          let fired=false;
          try{
            video.requestVideoFrameCallback(()=>{if(fired)return;fired=true;final()});
            setTimeout(()=>{if(fired)return;fired=true;final()},260);
            return;
          }catch{}
        }
        requestAnimationFrame(()=>requestAnimationFrame(final));
      };
      const seek=()=>{
        try{
          const end=Number.isFinite(video.duration)&&video.duration>0?Math.max(0,video.duration-.35):target;
          const at=Math.min(target,end);
          if(Math.abs((video.currentTime||0)-at)<.65&&video.readyState>=2){finish();return}
          video.currentTime=at;
        }catch{}
      };
      try{video.muted=true}catch{}
      video.addEventListener('loadedmetadata',seek,{once:true});
      video.addEventListener('seeked',finish,{once:true});
      timer=setTimeout(()=>{seek();setTimeout(finish,350)},6200);
      if(video.readyState>=1)seek();
    });
  }

  async function openContinueMovie(entry){
    const item=historyVodItem(entry);
    if(!item.stream_id)return;
    const release=beginResumeGate();
    try{
      await openFilm(item);
      const watch=el.detailBody.querySelector('#watchFilm');
      if(!watch){release();return}
      watch.click();
      const inline=state.detailInlineVideo;
      if(!inline?.video){release();return}
      await waitForSavedFrame(inline.video,entry.position,()=>{
        if(inline.status)inline.status.textContent='Pausado';
      });
    }finally{release()}
  }

  async function openContinueSeries(entry){
    const item=historySeriesItem(entry);
    if(!item.series_id)return;
    const release=beginResumeGate();
    try{
      await openSeries(item);
      const season=String(entry.season??'');
      if(season){
        const option=[...el.detailBody.querySelectorAll('[data-season]')].find(b=>String(b.dataset.season)===season);
        option?.click();
      }
      const episodeNo=String(entry.episodeNumber??'').trim();
      let row=null;
      if(episodeNo){
        row=[...el.detailBody.querySelectorAll('.episode')].find(r=>{
          const t=r.querySelector('.episode__title')?.textContent||'';
          return new RegExp('Epis[oó]dio\\s+'+episodeNo+'(?:\\D|$)','i').test(t);
        });
      }
      row=row||el.detailBody.querySelector('.episode');
      if(!row){release();return}
      row.click();
      const video=el.detailBody.querySelector('#seriesInlineVideo');
      if(!video){release();return}
      await waitForSavedFrame(video,entry.position);
    }finally{release()}
  }

  let continueOpenSeq=0;
  async function openContinueEntry(entry,type){
    if(!entry||state.srhContinueOpening)return;
    const seq=++continueOpenSeq;
    state.srhContinueOpening=true;
    state.srhOpeningContinue=true;
    try{
      if(type==='series')await openContinueSeries(entry);
      else await openContinueMovie(entry);
    }finally{
      if(seq===continueOpenSeq){
        state.srhContinueOpening=false;
        state.srhOpeningContinue=false;
      }
    }
  }

  renderContinue=function(){
    const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&x.position>=MIN_CONTINUE_SECONDS&&x.position/x.duration<.97).slice(0,12);
    if(!list.length||type==='live'){
      el.continueSection.classList.add('is-hidden');
      el.continueRow.innerHTML='';
      return;
    }
    el.continueSection.classList.remove('is-hidden');
    el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><img src="${escapeHtml(x.image||'')}" alt="" loading="lazy"><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');
    el.continueRow.querySelectorAll('[data-history]').forEach(c=>c.onclick=()=>{
      if(state.srhContinueOpening)return;
      const x=list[Number(c.dataset.history)];
      if(x)openContinueEntry(x,type);
    });
  };

})();
