/* SRHELL v6.6 — keep detail information; remove only redundant player close controls.
   Title, synopsis and normal modal actions must remain part of the detail layout. */

(function installDetailCleanup(){
  const baseOpenDetail=openDetail;
  openDetail=function(title){
    baseOpenDetail(title);
    const modal=detailModal();
    modal?.classList.remove('is-vod','is-series');
  };

  const baseOpenFilm=openFilm;
  openFilm=async function(item){
    await baseOpenFilm(item);
    const modal=detailModal();
    modal?.classList.remove('is-series');
    modal?.classList.add('is-vod');
    el.detailBody.querySelectorAll('[data-inline-close]').forEach(n=>n.remove());
  };

  const baseOpenSeries=openSeries;
  openSeries=async function(item){
    await baseOpenSeries(item);
    const modal=detailModal();
    modal?.classList.remove('is-vod');
    modal?.classList.add('is-series');
    document.getElementById('seriesStop')?.remove();
    el.detailBody.querySelectorAll('[data-inline-close]').forEach(n=>n.remove());
  };

  const baseOpenLive=openLive;
  openLive=function(group){
    const modal=detailModal();
    modal?.classList.remove('is-vod','is-series');
    return baseOpenLive(group);
  };
})();
