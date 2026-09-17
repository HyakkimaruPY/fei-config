/* SRHELL v6.6 — restore the intended detail hierarchy after favorites/history patches.
   Actions belong beside the title below the art, never beside the modal close button. */
(function installDetailHierarchyFix(){
  let queued=false;

  function applyHierarchy(){
    queued=false;
    const body=el.detailBody;
    if(!body)return;

    const row=body.querySelector('.detail-title-row');
    const toolbar=body.querySelector('.srh-detail-toolbar');

    if(row&&toolbar){
      toolbar.classList.add('srh-detail-toolbar--inline');
      toolbar.querySelector('.srh-detail-toolbar__title')?.remove();
      if(toolbar.parentElement!==row)row.appendChild(toolbar);
    }

    if(row){
      const title=row.querySelector('.detail-title');
      if(title)title.classList.add('srh-detail-title');
    }

    /* Film: keep the title/actions as one row, then render Assistir on its own row,
       followed by the synopsis. */
    const modal=detailModal();
    if(modal?.classList.contains('is-vod')){
      const watch=body.querySelector('.watch-button');
      if(watch){
        let watchRow=body.querySelector('.srh-watch-row');
        if(!watchRow){
          watchRow=document.createElement('div');
          watchRow.className='srh-watch-row';
          if(row)row.insertAdjacentElement('afterend',watchRow);
          else body.querySelector('.detail-art')?.insertAdjacentElement('afterend',watchRow);
        }
        if(watch.parentElement!==watchRow)watchRow.appendChild(watch);
      }
    }else{
      body.querySelector('.srh-watch-row')?.remove();
    }
  }

  function scheduleHierarchy(){
    if(queued)return;
    queued=true;
    queueMicrotask(applyHierarchy);
  }

  const observer=new MutationObserver(scheduleHierarchy);
  observer.observe(el.detailBody,{childList:true,subtree:true});

  const prevFilm=openFilm;
  openFilm=async function(item){
    await prevFilm(item);
    applyHierarchy();
  };

  const prevSeries=openSeries;
  openSeries=async function(item){
    await prevSeries(item);
    applyHierarchy();
  };

  const prevLive=openLive;
  openLive=function(group){
    const result=prevLive(group);
    scheduleHierarchy();
    return result;
  };
})();
