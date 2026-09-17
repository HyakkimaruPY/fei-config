/* SRHELL standard detail polish — guarantee final VOD watch action. */
(function installDetailActionPolish(){
  const PLAY='<svg class="watch-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12z"/></svg><span>Assistir</span>';
  let queued=false;

  function makeWatchButton(){
    const entry=state.currentDetail?.entry;
    if(!entry)return null;
    const b=document.createElement('button');
    b.type='button';
    b.id='watchFilm';
    b.className='watch-button srh-final-watch';
    b.innerHTML=PLAY;
    b.onclick=e=>{
      e.stopPropagation();
      const current=state.currentDetail?.entry||entry;
      const old=getHistory('vod').find(x=>x.key===current.key);
      openGeneralPlayer(current.sources||current.url,current.title,old?{...current,...old,sources:current.sources}:current);
    };
    return b;
  }

  function ensureFilmActions(){
    const modal=detailModal();
    if(!modal?.classList.contains('is-vod'))return;
    const body=el.detailBody;
    const row=body?.querySelector('.srh-final-actions--vod');
    if(!row)return;
    let watch=row.querySelector('.watch-button');
    if(!watch){
      watch=body.querySelector('.watch-button')||makeWatchButton();
      if(watch)row.appendChild(watch);
    }else if(watch.parentElement!==row){
      row.appendChild(watch);
    }
  }

  function schedule(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;ensureFilmActions()});
  }

  const previousOpenFilm=openFilm;
  openFilm=async function(item){
    await previousOpenFilm(item);
    ensureFilmActions();
  };

  const observer=new MutationObserver(schedule);
  observer.observe(el.detailBody,{childList:true,subtree:true});
})();
