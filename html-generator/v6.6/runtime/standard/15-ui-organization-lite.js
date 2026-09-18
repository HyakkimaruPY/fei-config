/* SRHELL v6.6 — lightweight restoration of later UI organization.
   This patch deliberately avoids MutationObserver, iframe favorites and extra network work. */
(function installLiteUiOrganization(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const STAR='<svg class="srh-lite-icon srh-lite-icon--star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const SHARE='<svg class="srh-lite-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5V4.8M8.2 8.6L12 4.8l3.8 3.8M6.2 12.4H5.1A2.1 2.1 0 0 0 3 14.5v4.4A2.1 2.1 0 0 0 5.1 21h13.8a2.1 2.1 0 0 0 2.1-2.1v-4.4a2.1 2.1 0 0 0-2.1-2.1h-1.1"/></svg>';

  function readFavorites(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function writeFavorites(list){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(list.slice(0,160)));return true}catch{return false}}
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
    return active;
  }
  function mediaTitle(type,item){return type==='live'?String(item?.baseName||'Canal'):itemTitle(item)}
  async function shareMedia(type,item){
    const title=mediaTitle(type,item),text=type==='live'?`Canal: ${title}`:type==='series'?`Série: ${title}`:`Filme: ${title}`;
    try{
      if(navigator.share){await navigator.share({title,text});return}
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);toast('Título copiado para compartilhar.');return}
      const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Título copiado para compartilhar.');
    }catch(e){if(e?.name!=='AbortError')toast('Não foi possível compartilhar agora.')}
  }
  function actionButton(kind,type,item){
    const active=kind==='favorite'&&isFavorite(type,item),b=document.createElement('button');
    b.type='button';b.className='srh-lite-action'+(active?' is-active':'');
    b.setAttribute('aria-label',kind==='favorite'?(active?'Remover dos favoritos':'Adicionar aos favoritos'):'Compartilhar');
    b.innerHTML=kind==='favorite'?STAR:SHARE;
    if(kind==='favorite')b.onclick=e=>{e.stopPropagation();const on=toggleFavorite(type,item);b.classList.toggle('is-active',on);b.setAttribute('aria-label',on?'Remover dos favoritos':'Adicionar aos favoritos')};
    else b.onclick=e=>{e.stopPropagation();shareMedia(type,item)};
    return b;
  }
  function actionGroup(type,item){const g=document.createElement('div');g.className='srh-lite-actions';g.append(actionButton('favorite',type,item),actionButton('share',type,item));return g}
  function markModal(type){const modal=detailModal();if(!modal)return;modal.classList.remove('is-vod','is-series','is-live');modal.classList.add('is-'+type);el.detailHeadTitle.textContent=''}
  function decorateDetail(type,item){
    markModal(type);
    const body=el.detailBody,row=body.querySelector('.detail-title-row'),syn=body.querySelector('.synopsis');
    if(!row)return;
    row.querySelector('.srh-lite-actions')?.remove();
    body.querySelector('.srh-lite-film-actions')?.remove();
    if(type==='vod'){
      const watch=row.querySelector('.watch-button')||body.querySelector('.watch-button');
      if(watch)watch.remove();
      const actions=document.createElement('div');actions.className='srh-lite-film-actions';actions.appendChild(actionGroup(type,item));if(watch)actions.appendChild(watch);
      (syn||row).insertAdjacentElement('afterend',actions);
    }else{
      row.appendChild(actionGroup(type,item));
    }
    if(type==='series')body.querySelector('#seriesStop')?.remove();
  }

  /* Poster/card geometry only. Keep the stable virtualizers and simply restore 2:3 math. */
  RailVirtualizer.prototype.metrics=function(){const live=this.type==='live',w=innerWidth<680?(live?116:108):(live?146:132),gap=9,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));return{w,gap,slot,visible}};
  RailVirtualizer.prototype.render=function(force=false){
    const m=this.metrics(),ratio=this.type==='live'?1:1.5,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length,this.type].join(':');
    if(!force&&sig===this.sig)return;this.sig=sig;this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';this.track.style.height=Math.round(m.w*ratio)+'px';
    this.track.innerHTML=this.items.slice(start,end).map((item,off)=>cardHtml(item,this.type,'poster-card',start+off,(start+off)*m.slot,m.w).replace(/height:[^;"]+px/,`height:${Math.round(m.w*ratio)}px`)).join('');
    this.track.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type));
  };
  GridVirtualizer.prototype.metrics=function(){
    const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:10,live=this.type==='live',base=live?138:122,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(base+gap))),w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
    return{available,gap,cols,w,h,rowH};
  };

  const baseOpenDetail=openDetail;
  openDetail=function(title){const r=baseOpenDetail(title);detailModal()?.classList.remove('is-vod','is-live');return r};
  const baseOpenFilm=openFilm;
  openFilm=async function(item){await baseOpenFilm(item);decorateDetail('vod',item)};
  const baseOpenSeries=openSeries;
  openSeries=async function(item){await baseOpenSeries(item);decorateDetail('series',item)};
  const baseOpenLive=openLive;
  openLive=function(group){const r=baseOpenLive(group);decorateDetail('live',group);return r};

  /* Favorites stays inside the existing collection view: one grid, three tiny tabs, no iframe. */
  const head=el.collectionTitle?.parentElement;
  const favTabs=document.createElement('div');
  favTabs.className='srh-favorites-tabs is-hidden';
  favTabs.innerHTML='<button class="srh-favorites-tab" data-fav-type="live">Ao vivo</button><button class="srh-favorites-tab" data-fav-type="vod">Filmes</button><button class="srh-favorites-tab" data-fav-type="series">Séries</button>';
  head?.insertAdjacentElement('afterend',favTabs);
  let favoriteEntries=[];
  function renderFavoriteType(type){
    state.gridInstance?.destroy();state.gridInstance=null;el.collectionSpacer.innerHTML='';el.collectionSpacer.style.height='';
    favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.favType===type));
    const list=favoriteEntries.filter(x=>x.type===type);
    if(!list.length){el.collectionSpacer.innerHTML='<div class="srh-favorites-empty">Nenhum favorito nesta seção.</div>';return}
    const items=list.map(x=>x.item);
    state.gridInstance=new GridVirtualizer(el.collectionScroller,el.collectionSpacer,type,items,(item,itemType)=>{closeCollection(false);openItem(item,itemType)});
    el.collectionScroller.scrollTop=0;
  }
  function openFavorites(){
    closeDetail();closePlayer(false);state.searchDataset=null;destroyVirtualizers();el.content.innerHTML='';el.continueRow.innerHTML='';el.continueSection.classList.add('is-hidden');
    favoriteEntries=readFavorites();el.collectionTitle.textContent='Favoritos';el.collectionView.classList.remove('is-hidden');state.collectionOpen=true;freezePage(true);favTabs.classList.remove('is-hidden');
    const first=['vod','series','live'].find(t=>favoriteEntries.some(x=>x.type===t))||'vod';renderFavoriteType(first);
  }
  favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.onclick=()=>renderFavoriteType(b.dataset.favType));
  const baseOpenCollection=openCollection;
  openCollection=function(title,type,items){favTabs.classList.add('is-hidden');return baseOpenCollection(title,type,items)};
  const baseCloseCollection=closeCollection;
  closeCollection=function(rebuild=true){favTabs.classList.add('is-hidden');return baseCloseCollection(rebuild)};

  if(!document.getElementById('favoritesTopButton')){
    const b=document.createElement('button');b.type='button';b.className='icon-button';b.id='favoritesTopButton';b.setAttribute('aria-label','Favoritos');b.innerHTML=STAR;b.onclick=openFavorites;el.searchButton.insertAdjacentElement('afterend',b);
  }
})();
