/* SRHELL v6.6 — remove redundant VOD/series labels and internal close controls.
   Injected inside the core runtime IIFE after the player cleanup patch. */

(function installDetailCleanup(){
  const baseOpenDetail=openDetail;
  openDetail=function(title){
    baseOpenDetail(title);
    detailModal()?.classList.remove('is-vod');
  };

  const baseOpenFilm=openFilm;
  openFilm=async function(item){
    await baseOpenFilm(item);
    const modal=detailModal();
    modal?.classList.add('is-vod');
    el.detailBody.querySelector('.detail-title')?.remove();
    el.detailBody.querySelector('.synopsis')?.remove();
    el.detailBody.querySelectorAll('[data-inline-close]').forEach(n=>n.remove());
    state.synopsisNode=null;
    state.synopsisText='';
    state.synopsisExpanded=false;
    const row=el.detailBody.querySelector('.detail-title-row');
    if(row&&!row.querySelector('.watch-button'))row.remove();
  };

  const baseOpenSeries=openSeries;
  openSeries=async function(item){
    await baseOpenSeries(item);
    const modal=detailModal();
    modal?.classList.remove('is-vod');
    modal?.classList.add('is-series');
    document.getElementById('seriesStop')?.remove();
    el.detailBody.querySelector('.detail-title-row')?.remove();
    el.detailBody.querySelector('.synopsis')?.remove();
    state.synopsisNode=null;
    state.synopsisText='';
    state.synopsisExpanded=false;
  };

  const baseOpenLive=openLive;
  openLive=function(group){
    detailModal()?.classList.remove('is-vod');
    return baseOpenLive(group);
  };
})();
