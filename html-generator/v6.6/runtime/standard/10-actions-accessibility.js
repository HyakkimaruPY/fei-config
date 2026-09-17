/* SRHELL v6.6 — final film/series action layout, reliable history deletion and themed favorites. */
(function installFinalActionLayout(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const STAR='<svg class="srh-final-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH='<svg class="srh-final-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  let ctx=null;
  const suppressedKeys=new Set();
  const suppressedSeries=new Set();

  const originalSaveHistory=saveHistory;
  saveHistory=function(entry){
    if(!entry)return;
    if(suppressedKeys.has(String(entry.key||'')))return;
    if(entry.type==='series'&&suppressedSeries.has(String(entry.seriesId??'')))return;
    return originalSaveHistory(entry);
  };

  function readFavs(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function writeFavs(v){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(v.slice(0,160)));return true}catch{return false}}
  function favKey(type,item){
    if(type==='series')return 'series:'+String(item?.series_id??item?.id??'');
    return 'vod:'+String(item?.stream_id??item?.id??'');
  }
  function favEntry(type,item){
    if(type==='series')return{key:favKey(type,item),type,title:itemTitle(item),image:imageFor(item,'series'),item:{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')}};
    return{key:favKey(type,item),type,title:itemTitle(item),image:imageFor(item,'vod'),item:{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod'),container_extension:item?.container_extension||'mp4'}};
  }
  function isFav(type,item){const k=favKey(type,item);return readFavs().some(x=>x.key===k)}
  function toggleFav(type,item){
    const e=favEntry(type,item),list=readFavs(),i=list.findIndex(x=>x.key===e.key);let active=false;
    if(i>=0)list.splice(i,1);else{list.unshift(e);active=true}
    if(!writeFavs(list)){toast('Não foi possível salvar Favoritos.');return isFav(type,item)}
    toast(active?'Adicionado aos Favoritos.':'Removido dos Favoritos.');return active;
  }

  function removeContinue(type,item){
    if(type==='vod'){
      const key='vod:'+String(item?.stream_id??item?.id??'');
      suppressedKeys.add(key);
      removeHistory(key,'vod');
      toast('Filme removido de Continuar assistindo.');
      return;
    }
    const sid=String(item?.series_id??item?.id??'');
    suppressedSeries.add(sid);
    try{
      const list=getHistory('series').filter(x=>String(x.seriesId??'')!==sid);
      localStorage.setItem(historyKey('series'),JSON.stringify(list));
    }catch{}
    renderContinue();
    toast('Série removida de Continuar assistindo.');
  }

  function buildIconButton(kind,active=false){
    const b=document.createElement('button');
    b.type='button';
    b.className='srh-final-action srh-final-action--'+kind+(active?' is-active':'');
    b.setAttribute('aria-label',kind==='favorite'?(active?'Remover dos favoritos':'Adicionar aos favoritos'):'Remover de Continuar assistindo');
    b.innerHTML=kind==='favorite'?STAR:TRASH;
    return b;
  }

  function normalizeContext(type,item,fromContinue=false){
    ctx={type,item,fromContinue:!!fromContinue};
    if(type==='vod')suppressedKeys.delete('vod:'+String(item?.stream_id??item?.id??''));
    if(type==='series')suppressedSeries.delete(String(item?.series_id??item?.id??''));
  }

  function installActions(){
    if(!ctx||!['vod','series'].includes(ctx.type))return;
    const body=el.detailBody;if(!body)return;

    /* Remove all legacy title/flare toolbars. Their functionality is rebuilt below. */
    body.querySelectorAll('.srh-detail-toolbar').forEach(n=>n.remove());
    body.querySelectorAll('.srh-final-actions').forEach(n=>n.remove());
    body.querySelectorAll('.detail-title-row').forEach(n=>n.remove());
    body.querySelectorAll('.detail-title').forEach(n=>n.remove());

    const synopsis=body.querySelector('.synopsis');
    const art=body.querySelector('.detail-art');
    const row=document.createElement('div');
    row.className='srh-final-actions srh-final-actions--'+ctx.type;

    if(ctx.type==='vod'){
      const watch=body.querySelector('.watch-button');
      if(watch){
        watch.classList.add('srh-final-watch');
        row.appendChild(watch);
      }
      const oldWatchRow=body.querySelector('.srh-watch-row');
      if(oldWatchRow&&!oldWatchRow.children.length)oldWatchRow.remove();
    }

    const iconGroup=document.createElement('div');
    iconGroup.className='srh-final-actions__icons';
    const fav=buildIconButton('favorite',isFav(ctx.type,ctx.item));
    fav.onclick=e=>{
      e.stopPropagation();
      const active=toggleFav(ctx.type,ctx.item);
      fav.classList.toggle('is-active',active);
      fav.setAttribute('aria-label',active?'Remover dos favoritos':'Adicionar aos favoritos');
    };
    iconGroup.appendChild(fav);

    if(ctx.fromContinue){
      const trash=buildIconButton('trash');
      trash.onclick=e=>{
        e.stopPropagation();
        removeContinue(ctx.type,ctx.item);
        ctx.fromContinue=false;
        trash.remove();
      };
      iconGroup.appendChild(trash);
    }
    row.appendChild(iconGroup);

    if(synopsis)synopsis.insertAdjacentElement('afterend',row);
    else if(art)art.insertAdjacentElement('afterend',row);
    else body.prepend(row);
  }

  const prevFilm=openFilm;
  openFilm=async function(item){
    normalizeContext('vod',item,false);
    await prevFilm(item);
    installActions();
  };

  const prevSeries=openSeries;
  openSeries=async function(item){
    normalizeContext('series',item,false);
    await prevSeries(item);
    installActions();
  };

  /* The R8 continue flow marks history-origin modals by inserting a temporary
     toolbar containing a trash button. Detect that marker, then replace it with
     the final low-position action row. */
  let pending=false;
  const detailObserver=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{
      pending=false;
      if(!ctx||!['vod','series'].includes(ctx.type))return;
      const legacy=[...el.detailBody.querySelectorAll('.srh-detail-toolbar')];
      if(!legacy.length)return;
      if(legacy.some(x=>x.querySelector('[data-srh-trash]')))ctx.fromContinue=true;
      legacy.forEach(x=>x.remove());
      installActions();
    });
  });
  detailObserver.observe(el.detailBody,{childList:true,subtree:true});

  /* Make the Favorites iframe inherit the active theme instead of using a fixed green palette. */
  function cssVar(name,fallback){return getComputedStyle(document.body).getPropertyValue(name).trim()||fallback}
  function themeFavoritesFrame(frame){
    const doc=frame.contentDocument;if(!doc||!doc.head)return;
    doc.getElementById('srh-parent-theme')?.remove();
    const bg=cssVar('--bg','#0d151c'),elev=cssVar('--bg-elev','#101820'),surface=cssVar('--surface','#121a22'),surface2=cssVar('--surface-2','#182532'),line=cssVar('--line','rgba(162,208,236,.24)'),text=cssVar('--text','#eaeff3'),muted=cssVar('--muted','#aab3ba'),accent=cssVar('--accent','#a2d0ec'),buttonFg=cssVar('--button-fg','#0d151c');
    const s=doc.createElement('style');s.id='srh-parent-theme';
    s.textContent=`:root{color-scheme:${document.body.dataset.theme==='porcelain'?'light':'dark'}}html,body{background:${bg}!important;color:${text}!important}.tabs{background:${bg}!important}.title{color:${text}!important}.close,.tab{background:${surface}!important;border-color:${line}!important;color:${muted}!important}.tab.active{background:${accent}!important;color:${buttonFg}!important;border-color:${accent}!important}.card{background:${surface}!important;border-color:${line}!important;color:${text}!important}.card img{background:${surface2}!important}.card.live img{background:${surface2}!important}.name{background:${elev}!important;color:${text}!important}.empty{color:${muted}!important}*{scrollbar-color:${accent} transparent}`;
    doc.head.appendChild(s);
  }
  const frameObserver=new MutationObserver(records=>{
    for(const r of records)for(const n of r.addedNodes){
      if(!(n instanceof Element))continue;
      const frames=[...(n.matches?.('.srh-favorites-frame')?[n]:[]),...n.querySelectorAll?.('.srh-favorites-frame')||[]];
      frames.forEach(frame=>{frame.addEventListener('load',()=>themeFavoritesFrame(frame),{once:false});setTimeout(()=>themeFavoritesFrame(frame),0)});
    }
  });
  frameObserver.observe(document.body,{childList:true,subtree:true});

  /* Opening an item from Favorites must dismiss its iframe before the shared detail modal appears. */
  function forceCloseFavorites(){document.querySelectorAll('.srh-favorites-overlay').forEach(n=>n.remove())}
  window.addEventListener('message',e=>{if(e.data?.srhFavorites&&e.data.action==='open')forceCloseFavorites()},true);
  new MutationObserver(()=>{if(!el.detailLayer.classList.contains('is-hidden'))forceCloseFavorites()}).observe(el.detailLayer,{attributes:true,attributeFilter:['class']});
})();
