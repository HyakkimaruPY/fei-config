(()=>{'use strict';const S=window.SRH25,$=S.$;const video=$('#shortVideo'),player=$('#shortPlayer'),poster=$('#shortPoster'),loading=$('#playerLoading'),arcDrawer=$('#arcDrawer'),arcGrid=$('#arcGrid');let saveTick=0,startX=0,startY=0;
function destroyHls(){try{S.state.hls?.destroy()}catch{}S.state.hls=null}
function stop(){const cur=S.state.current;if(cur)S.saveProgress(cur.item,video.currentTime,video.duration);destroyHls();video.pause();video.removeAttribute('src');video.load();S.state.current=null;player.classList.add('is-hidden');arcDrawer.classList.add('is-hidden')}
function setFavorite(){const cur=S.state.current;if(!cur)return;const on=S.toggleFavorite(cur.item);$('#playerFavorite').classList.toggle('is-active',on);$('#playerFavorite').querySelector('small').textContent=on?'Favoritado':'Favorito'}
function drawArcs(){const d=video.duration;if(!Number.isFinite(d)||d<=0){arcGrid.innerHTML='<div class="srh25-empty">Aguardando duração…</div>';return}const n=Math.max(1,Math.ceil(d/120));arcGrid.replaceChildren();for(let i=0;i<n;i++){const b=document.createElement('button');b.className='srh25-arc';b.innerHTML='<strong>Arco '+(i+1)+'</strong><small>'+Math.floor(i*2)+':00–'+Math.min(Math.ceil(d/60),Math.floor((i+1)*2))+':00</small>';b.onclick=()=>{video.currentTime=Math.min(d-.1,i*120);arcDrawer.classList.add('is-hidden');video.play().catch(()=>{})};arcGrid.appendChild(b)}}
function loadVideo(item,resume){
  const url=S.stream(item),ready=()=>{if(resume?.position>0&&resume.position<video.duration-3){video.currentTime=resume.position;const done=()=>{video.removeEventListener('seeked',done);poster.classList.add('is-hidden');loading.classList.add('is-hidden');video.play().catch(()=>{})};video.addEventListener('seeked',done,{once:true})}else{poster.classList.add('is-hidden');loading.classList.add('is-hidden');video.play().catch(()=>{})}drawArcs()};
  if(/\.m3u8(?:$|\?)/i.test(url)&&window.Hls&&Hls.isSupported()){const h=new Hls({enableWorker:true,maxBufferLength:20});S.state.hls=h;h.loadSource(url);h.attachMedia(video);h.on(Hls.Events.MANIFEST_PARSED,ready);h.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)S.toast('Falha ao iniciar o vídeo')})}else{video.src=url;video.onloadedmetadata=ready;video.onerror=()=>S.toast('Mídia indisponível');video.load()}
}
S.openPlayer=item=>{
  destroyHls();const hist=S.historyFor(item);S.state.current={item};saveTick=0;player.classList.remove('is-hidden');player.classList.remove('is-cover');poster.classList.remove('is-hidden');loading.classList.remove('is-hidden');poster.src=S.image(item)||'';$('#playerTitle').textContent=S.title(item);$('#playerMeta').textContent=hist?'Retomando do ponto salvo':'Arcos de 2 minutos';$('#playerFavorite').classList.toggle('is-active',S.state.favorites.has(S.id(item)));arcDrawer.classList.add('is-hidden');loadVideo(item,hist)
};
video.ontimeupdate=()=>{if(++saveTick%20===0&&S.state.current)S.saveProgress(S.state.current.item,video.currentTime,video.duration)};
video.onended=()=>{if(S.state.current)S.removeHistory(S.state.current.item)};
$('#playerClose').onclick=stop;$('#playerFavorite').onclick=setFavorite;
$('#playerCrop').onclick=()=>player.classList.toggle('is-cover');
$('#playerArcs').onclick=()=>{drawArcs();arcDrawer.classList.toggle('is-hidden')};
$('#playerNext').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration-.1,(Math.floor(video.currentTime/120)+1)*120)};
$('#playerFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#playerStage').requestFullscreen?.()}catch{}};
$('#playerStage').addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY},{passive:true});
$('#playerStage').addEventListener('pointerup',e=>{const dx=e.clientX-startX,dy=e.clientY-startY;if(dx>85&&Math.abs(dy)<70)stop()},{passive:true});
window.addEventListener('pagehide',()=>{if(S.state.current)S.saveProgress(S.state.current.item,video.currentTime,video.duration)});
Promise.resolve().then(()=>S.boot());
})();