/* SRHELL v6.6 — favorites + continue-in-modal behavior. */
(function installFavoritesAndContinue(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const STAR_SVG='<svg class="srh-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH_SVG='<svg class="srh-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  function srhReadFavorites(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function srhWriteFavorites(list){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(list.slice(0,160)));return true}catch{return false}}
  function srhFavoriteKey(type,item){
    if(type==='live'){
      const id=item?.variants?.[0]?.stream_id||item?.variants?.[0]?.id||'';
      return 'live:'+(id||String(item?.baseName||'canal').toLocaleLowerCase('pt-BR'));
    }
    if(type==='series')return 'series:'+String(item?.series_id??item?.id??'');
    return 'vod:'+String(item?.stream_id??item?.id??'');
  }
  function srhCompactFavorite(type,item){
    const key=srhFavoriteKey(type,item);
    if(type==='live'){
      const variants=(item?.variants||[]).map(v=>({stream_id:v.stream_id??v.id,name:v.name||v.title||item.baseName,stream_icon:v.stream_icon||item.image||'',container_extension:v.container_extension||'',_quality:v._quality||'Padrão'}));
      return{key,type,title:item?.baseName||'Canal',image:item?.image||variants[0]?.stream_icon||'',item:{baseName:item?.baseName||'Canal',image:item?.image||'',variants}};
    }
    if(type==='series')return{key,type,title:itemTitle(item),image:imageFor(item,'series'),item:{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')}};
    return{key,type,title:itemTitle(item),image:imageFor(item,'vod'),item:{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod'),container_extension:item?.container_extension||'mp4'}};
  }
  function srhIsFavorite(type,item){const key=srhFavoriteKey(type,item);return srhReadFavorites().some(x=>x.key===key)}
  function srhToggleFavorite(type,item){
    const entry=srhCompactFavorite(type,item),list=srhReadFavorites(),idx=list.findIndex(x=>x.key===entry.key);let active;
    if(idx>=0){list.splice(idx,1);active=false}else{list.unshift(entry);active=true}
    if(!srhWriteFavorites(list)){toast('Não foi possível salvar Favoritos.');return srhIsFavorite(type,item)}
    toast(active?'Adicionado aos Favoritos.':'Removido dos Favoritos.');return active;
  }
  function srhSeriesTitleFromHistory(entry){return String(entry?.seriesTitle||entry?.title||'Série').replace(/\s+[—–-]\s*Episódio\s+\d+.*$/i,'').trim()||'Série'}
  function srhRemoveContinue(entry){
    if(!entry)return;
    if(entry.type==='series'&&entry.seriesId!==undefined&&entry.seriesId!==null){
      const list=getHistory('series').filter(x=>String(x.seriesId??'')!==String(entry.seriesId));
      try{localStorage.setItem(historyKey('series'),JSON.stringify(list))}catch{}
      renderContinue();toast('Série removida de Continuar assistindo.');return;
    }
    removeHistory(entry.key,entry.type);toast('Removido de Continuar assistindo.');
  }
  function srhAttachDetailToolbar(type,item,historyEntry=null){
    const art=el.detailBody.querySelector('.detail-art');if(!art)return;
    art.querySelector('.srh-detail-toolbar')?.remove();
    const title=type==='live'?(item?.baseName||'Canal'):itemTitle(item),fav=srhIsFavorite(type,item),wrap=document.createElement('div');
    wrap.className='srh-detail-toolbar';
    wrap.innerHTML=`<div class="srh-detail-toolbar__title">${escapeHtml(title)}</div><div class="srh-detail-toolbar__actions">${historyEntry&&type!=='live'?`<button class="srh-detail-tool srh-detail-tool--trash" data-srh-trash aria-label="Remover de Continuar assistindo">${TRASH_SVG}</button>`:''}<button class="srh-detail-tool${fav?' is-active':''}" data-srh-favorite aria-label="${fav?'Remover dos':'Adicionar aos'} favoritos">${STAR_SVG}</button></div>`;
    art.appendChild(wrap);
    const favBtn=wrap.querySelector('[data-srh-favorite]');
    favBtn.onclick=e=>{e.stopPropagation();const active=srhToggleFavorite(type,item);favBtn.classList.toggle('is-active',active);favBtn.setAttribute('aria-label',active?'Remover dos favoritos':'Adicionar aos favoritos')};
    const trash=wrap.querySelector('[data-srh-trash]');if(trash)trash.onclick=e=>{e.stopPropagation();srhRemoveContinue(historyEntry);trash.remove()};
  }

  const previousOpenFilm=openFilm;
  openFilm=async function(item){await previousOpenFilm(item);srhAttachDetailToolbar('vod',item,null)};
  const previousOpenSeries=openSeries;
  openSeries=async function(item){await previousOpenSeries(item);srhAttachDetailToolbar('series',item,null)};
  const previousOpenLive=openLive;
  openLive=function(group){const r=previousOpenLive(group);queueMicrotask(()=>srhAttachDetailToolbar('live',group,null));return r};

  async function srhOpenHistoryModal(entry){
    if(!entry)return;
    if(entry.type==='vod'){
      const id=String(entry.key||'').replace(/^vod:/,'')||String(entry.streamId||'');
      const item={stream_id:id,name:entry.title||'Filme',stream_icon:entry.image||'',container_extension:entry.containerExtension||'mp4'};
      await openFilm(item);srhAttachDetailToolbar('vod',item,entry);el.detailBody.querySelector('#watchFilm')?.click();return;
    }
    if(entry.type==='series'){
      const sid=entry.seriesId||String(entry.key||'').split(':')[1];
      const item={series_id:sid,name:srhSeriesTitleFromHistory(entry),cover:entry.image||''};
      await openSeries(item);srhAttachDetailToolbar('series',item,entry);
      const season=String(entry.season??'');
      if(season){const sBtn=[...el.detailBody.querySelectorAll('[data-season]')].find(b=>String(b.dataset.season)===season);sBtn?.click()}
      await new Promise(r=>setTimeout(r,0));
      const eps=state.currentSeries?.episodes?.[season]||state.currentSeries?.episodes?.[String(Number(season))]||[];
      let idx=eps.findIndex(ep=>episodeKey(item,ep)===entry.key);
      if(idx<0&&entry.episodeNumber!==undefined)idx=eps.findIndex(ep=>String(ep.episode_num??'')===String(entry.episodeNumber));
      if(idx<0&&entry.episodeNumber!==undefined)idx=Math.max(0,Number(entry.episodeNumber)-1);
      el.detailBody.querySelector(`[data-ep="${idx}"]`)?.click();
    }
  }

  renderContinue=function(){
    const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&x.position>5&&x.position/x.duration<.97).slice(0,12);
    if(!list.length||type==='live'){el.continueSection.classList.add('is-hidden');el.continueRow.innerHTML='';return}
    el.continueSection.classList.remove('is-hidden');
    el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><img src="${escapeHtml(x.image||'')}" alt="" loading="lazy"><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');
    el.continueRow.querySelectorAll('[data-history]').forEach(c=>c.onclick=()=>{const x=list[Number(c.dataset.history)];if(x)srhOpenHistoryModal(x)});
  };

  function srhFavoriteFrameMarkup(list){
    const data=JSON.stringify(list).replace(/</g,'\\u003c');
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07140f;color:#eef7f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}body{padding:16px}.head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:22px;font-weight:800}.close{width:42px;height:42px;border:1px solid rgba(162,208,236,.25);border-radius:14px;background:#10241c;color:#fff;font-size:23px}.tabs{display:flex;gap:8px;position:sticky;top:0;background:rgba(7,20,15,.94);padding:6px 0 12px;z-index:2}.tab{flex:1;min-height:42px;border:1px solid rgba(162,208,236,.2);border-radius:13px;background:#0c1d17;color:#aebdb6;font-weight:750}.tab.active{background:#1a3a2d;color:#fff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.card{position:relative;border:1px solid rgba(162,208,236,.22);border-radius:16px;overflow:hidden;background:#0c1d17;padding:0;text-align:left;color:#fff}.card img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;background:#13251f}.card.live img{aspect-ratio:1/1;object-fit:contain;padding:8px}.name{padding:8px 9px 10px;font-size:12px;font-weight:750;line-height:1.2}.empty{padding:54px 12px;text-align:center;color:#9fb0a8}@media(min-width:720px){.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}</style></head><body><div class="head"><div class="title">Favoritos</div><button class="close" id="close">×</button></div><div class="tabs"><button class="tab active" data-type="live">Ao vivo</button><button class="tab" data-type="vod">Filmes</button><button class="tab" data-type="series">Séries</button></div><div class="grid" id="grid"></div><script>const items=${data};let type='live';const grid=document.getElementById('grid');function esc(v){return String(v||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}function draw(){const list=items.filter(x=>x.type===type);grid.innerHTML=list.length?list.map(x=>'<button class="card '+(x.type==='live'?'live':'')+'" data-key="'+esc(x.key)+'"><img src="'+esc(x.image||'')+'" alt=""><div class="name">'+esc(x.title)+'</div></button>').join(''):'<div class="empty">Nenhum favorito nesta categoria.</div>';grid.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>parent.postMessage({srhFavorites:true,action:'open',key:b.dataset.key},'*'))}document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;document.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('active',x===b));draw()});document.getElementById('close').onclick=()=>parent.postMessage({srhFavorites:true,action:'close'},'*');draw();<\/script></body></html>`;
  }
  let favoritesOverlay=null,favoritesFrame=null;
  function srhCloseFavorites(){if(!favoritesOverlay)return;favoritesOverlay.remove();favoritesOverlay=null;favoritesFrame=null;freezePage(!el.detailLayer.classList.contains('is-hidden')||state.collectionOpen)}
  function srhOpenFavorites(){srhCloseFavorites();favoritesOverlay=document.createElement('section');favoritesOverlay.className='srh-favorites-overlay';favoritesOverlay.innerHTML='<iframe class="srh-favorites-frame" title="Favoritos"></iframe>';document.body.appendChild(favoritesOverlay);favoritesFrame=favoritesOverlay.querySelector('iframe');favoritesFrame.srcdoc=srhFavoriteFrameMarkup(srhReadFavorites());freezePage(true)}
  window.addEventListener('message',e=>{
    if(!favoritesFrame||e.source!==favoritesFrame.contentWindow||!e.data?.srhFavorites)return;
    if(e.data.action==='close'){srhCloseFavorites();return}
    if(e.data.action==='open'){
      const entry=srhReadFavorites().find(x=>x.key===e.data.key);if(!entry)return;
      srhCloseFavorites();if(entry.type==='live')openLive(entry.item);else if(entry.type==='series')openSeries(entry.item);else openFilm(entry.item);
    }
  });

  const favButton=document.createElement('button');
  favButton.className='icon-button';favButton.id='favoritesTopButton';favButton.setAttribute('aria-label','Favoritos');favButton.innerHTML=STAR_SVG;
  el.searchButton.insertAdjacentElement('afterend',favButton);favButton.onclick=srhOpenFavorites;
  renderContinue();
})();
