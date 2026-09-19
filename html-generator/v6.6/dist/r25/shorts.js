/* ===== 01-core.js ===== */
(()=>{'use strict';
const cfg=JSON.parse(document.getElementById('app-config').textContent);
const $=s=>document.querySelector(s);
const S={cfg,state:{items:[],filtered:[],history:[],favorites:new Set(),pool:null,proxy:null,hls:null,current:null},$};
window.SRH25=S;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s??'').trim();
const server=()=>clean(cfg.server).replace(/\/+$/,'');
const enc=encodeURIComponent;
S.id=item=>String(item?.stream_id??item?.id??item?.movie_id??item?.name??'');
S.title=item=>clean(item?.name||item?.title||'Sem título');
S.image=item=>clean(item?.stream_icon||item?.movie_image||item?.cover||'');
S.stream=item=>`${server()}/movie/${enc(cfg.username)}/${enc(cfg.password)}/${S.id(item)}.${clean(item?.container_extension)||'mp4'}`;
S.toast=msg=>{const n=$('#toast');if(!n)return;n.textContent=msg;n.classList.add('is-on');clearTimeout(S.toast.t);S.toast.t=setTimeout(()=>n.classList.remove('is-on'),1800)};
function parseJson(t){let s=String(t??'').replace(/^\uFEFF/,'').trim();try{return JSON.parse(s)}catch{}const a=s.indexOf('{'),b=s.indexOf('['),i=a<0?b:b<0?a:Math.min(a,b);if(i>=0){const j=s.lastIndexOf(s[i]==='{'?'}':']');if(j>i)return JSON.parse(s.slice(i,j+1))}throw new Error('Resposta inválida')}
async function fetchText(url,timeout=5000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(t)}}
function httpsTwin(url){try{const u=new URL(url);if(u.protocol!=='http:')return'';u.protocol='https:';return u.href}catch{return''}}
function proxyUrl(template,target){const b=clean(template),raw=clean(target),e=enc(raw);if(!b)return'';if(b.includes('{rawUrl}'))return b.replaceAll('{rawUrl}',raw);if(b.includes('{raw}'))return b.replaceAll('{raw}',raw);if(b.includes('{url}'))return b.replaceAll('{url}',e);if(b.endsWith('=')||b.endsWith('?'))return b+e;try{const u=new URL(b),k=['url','target','uri','q'].find(x=>u.searchParams.has(x))||'url';u.searchParams.set(k,raw);return u.toString()}catch{return''}}
function apiUrl(params={}){const u=new URL(server()+'/player_api.php');u.searchParams.set('username',cfg.username);u.searchParams.set('password',cfg.password);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,v);return u.toString()}
async function loadPool(){if(S.state.pool)return S.state.pool;const r=await fetch('https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('Pool '+r.status);const j=await r.json();return S.state.pool=(Array.isArray(j.proxies)?j.proxies:[]).filter(x=>x&&x.template&&x.valid!==false&&x.enabled!==false).sort((a,b)=>(+a.latencyMs||9e9)-(+b.latencyMs||9e9))}
function proxyKey(){let h='host';try{h=new URL(server()).host}catch{}return 'srh25:proxy:'+(cfg.appId||cfg.appName||'app')+':'+h}
function readProxy(){try{return JSON.parse(localStorage.getItem(proxyKey())||'null')}catch{return null}}
function saveProxy(x){try{localStorage.setItem(proxyKey(),JSON.stringify(x))}catch{}}
async function chooseProxy(target){
  const saved=readProxy();
  if(saved?.template&&Number(saved.uses||0)<3){saved.uses=Number(saved.uses||0)+1;saveProxy(saved);return saved.template}
  const pool=(await loadPool()).slice(0,5);
  const tests=await Promise.all(pool.map(async p=>{const u=proxyUrl(p.template,target),t=performance.now();try{parseJson(await fetchText(u,3200));return{p,ms:performance.now()-t}}catch{return null}}));
  const ok=tests.filter(Boolean).sort((a,b)=>a.ms-b.ms)[0];
  if(!ok)throw new Error('Nenhum proxy CORS respondeu');
  saveProxy({template:ok.p.template,id:ok.p.id||'',uses:1,at:Date.now()});return ok.p.template
}
S.request=async params=>{
  const target=apiUrl(params),candidates=[target,httpsTwin(target)].filter(Boolean);
  let last;
  for(const u of candidates){try{return parseJson(await fetchText(u,5200))}catch(e){last=e}}
  if(cfg.corsProxy){try{return parseJson(await fetchText(proxyUrl(cfg.corsProxy,target),6000))}catch(e){last=e}}
  if(cfg.autoCorsProxy!==false){const p=await chooseProxy(target);try{return parseJson(await fetchText(proxyUrl(p,target),6200))}catch(e){last=e}}
  throw last||new Error('Falha de conexão')
};
const ns=String(cfg.appId||cfg.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const favKey='srh25:'+ns+':favorites',histKey='srh25:'+ns+':history';
S.readFavorites=()=>{try{return new Set(JSON.parse(localStorage.getItem(favKey)||'[]').map(String))}catch{return new Set()}};
S.writeFavorites=set=>{try{localStorage.setItem(favKey,JSON.stringify([...set]));return true}catch{return false}};
S.readHistory=()=>{try{const x=JSON.parse(localStorage.getItem(histKey)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
S.writeHistory=list=>{try{localStorage.setItem(histKey,JSON.stringify(list.slice(0,80)));return true}catch{return false}};
S.toggleFavorite=item=>{const id=S.id(item),set=S.state.favorites;if(set.has(id))set.delete(id);else set.add(id);S.writeFavorites(set);return set.has(id)};
S.historyFor=item=>S.state.history.find(x=>x.id===S.id(item))||null;
S.saveProgress=(item,position,duration)=>{
  if(!item||!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0)return;
  const id=S.id(item);let list=S.readHistory().filter(x=>x.id!==id);
  if(position>=60&&position/duration<.97)list.unshift({id,title:S.title(item),image:S.image(item),position,duration,updatedAt:Date.now(),item:{stream_id:item.stream_id,id:item.id,name:item.name,title:item.title,stream_icon:item.stream_icon,movie_image:item.movie_image,cover:item.cover,container_extension:item.container_extension}});
  S.writeHistory(list);S.state.history=S.readHistory()
};
S.removeHistory=item=>{S.writeHistory(S.readHistory().filter(x=>x.id!==S.id(item)));S.state.history=S.readHistory()};
S.lockZoom=()=>{
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
  document.addEventListener('touchmove',e=>{if(e.touches?.length>1)e.preventDefault()},{passive:false});
  window.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault()});
};
S.account=async()=>{try{const a=await S.request({}),raw=a?.user_info?.exp_date,n=Number(raw);if(n>0){const d=new Date(n*1000),days=Math.ceil((d-Date.now())/86400000);$('#expiryDate').textContent=d.toLocaleDateString('pt-BR');$('#expiryDays').textContent=days+' dias';$('#appMeta').textContent=(a?.user_info?.status||'Active')+' · '+days+' dias restantes'}else $('#appMeta').textContent=a?.user_info?.status||'Active'}catch{$('#appMeta').textContent='Conta conectada'}};
S.boot=async()=>{document.body.dataset.theme=cfg.theme||'graphene';$('#appTitle').textContent=cfg.appName||'Meu App';S.lockZoom();S.state.favorites=S.readFavorites();S.state.history=S.readHistory();S.bindShell?.();S.account();await S.loadCatalog?.();window.dispatchEvent(new Event('srh25:ready'))};
})();

/* ===== 02-catalog.js ===== */
(()=>{'use strict';const S=window.SRH25,$=S.$;
const BATCH=30;let shown=0,observer=null,imgObserver=null;
function cleanName(s){return String(s||'').replace(/[\uFE0F\u200D]/g,'').trim()}
async function fetchItems(){
  const cats=await S.request({action:'get_vod_categories'}),map=new Map((Array.isArray(cats)?cats:[]).map(c=>[String(c.category_name??c.name??''),String(c.category_id??c.id??'')]));
  const targets=(S.cfg.targets||[]).filter(t=>t.type==='vod');
  const groups=await Promise.all(targets.map(async t=>{const id=map.get(String(t.name));if(!id)return[];try{const r=await S.request({action:'get_vod_streams',category_id:id});return Array.isArray(r)?r:[]}catch{return[]}}));
  const seen=new Set(),out=[];for(const item of groups.flat()){const id=S.id(item);if(!id||seen.has(id))continue;seen.add(id);out.push(item)}return out
}
function card(item){
  const b=document.createElement('button');b.type='button';b.className='srh25-card';b.dataset.id=S.id(item);
  const img=document.createElement('img');img.className='srh25-card__image';img.alt='';img.loading='lazy';img.decoding='async';
  const ph=document.createElement('div');ph.className='srh25-card__placeholder';
  const shade=document.createElement('div');shade.className='srh25-card__shade';
  const copy=document.createElement('div');copy.className='srh25-card__copy';
  const title=document.createElement('div');title.className='srh25-card__title';title.textContent=S.title(item);
  const arcs=document.createElement('span');arcs.className='srh25-card__arcs';arcs.textContent='Short';
  copy.append(title,arcs);b.append(img,ph,shade,copy);
  img.onload=()=>img.classList.add('is-ready');img.onerror=()=>{img.removeAttribute('src');img.classList.remove('is-ready')};
  const src=S.image(item);if(src){img.dataset.src=src;if(imgObserver)imgObserver.observe(img);else img.src=src}
  b.onclick=()=>S.openPlayer?.(item);return b
}
function ensureImageObserver(){
  if(imgObserver||!('IntersectionObserver'in window))return;
  imgObserver=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const img=e.target;if(img.dataset.src&&!img.src)img.src=img.dataset.src;imgObserver.unobserve(img)}},{rootMargin:'420px 0px'});
}
function appendBatch(){
  const grid=$('#shortGrid'),list=S.state.filtered,end=Math.min(list.length,shown+BATCH),frag=document.createDocumentFragment();
  for(let i=shown;i<end;i++)frag.appendChild(card(list[i]));grid.appendChild(frag);shown=end;
  $('#feedStatus').textContent=list.length?shown+' de '+list.length+' Shorts':'Nenhum Short encontrado';
}
function reset(){
  shown=0;$('#shortGrid').replaceChildren();ensureImageObserver();appendBatch();
}
function filter(){
  const q=$('#shortSearch').value.trim().toLocaleLowerCase('pt-BR');
  S.state.filtered=q?S.state.items.filter(x=>S.title(x).toLocaleLowerCase('pt-BR').includes(q)):S.state.items.slice();reset()
}
function libraryItems(kind){
  if(kind==='favorites')return S.state.items.filter(x=>S.state.favorites.has(S.id(x)));
  const byId=new Map(S.state.items.map(x=>[S.id(x),x]));
  return S.state.history.map(h=>byId.get(h.id)||h.item).filter(Boolean)
}
function openLibrary(kind){
  const view=$('#libraryView'),grid=$('#libraryGrid'),title=$('#libraryTitle'),items=libraryItems(kind);title.textContent=kind==='favorites'?'Favoritos':'Continuar assistindo';grid.replaceChildren();
  if(!items.length){const e=document.createElement('div');e.className='srh25-empty';e.textContent='Nada aqui por enquanto.';grid.appendChild(e)}else items.forEach(x=>grid.appendChild(card(x)));
  view.classList.remove('is-hidden')
}
S.bindShell=()=>{
  ensureImageObserver();
  $('#searchButton').onclick=()=>{$('#searchWrap').classList.toggle('is-hidden');if(!$('#searchWrap').classList.contains('is-hidden'))$('#shortSearch').focus()};
  $('#shortSearch').oninput=filter;
  $('#historyButton').onclick=()=>openLibrary('history');$('#favoritesButton').onclick=()=>openLibrary('favorites');$('#libraryClose').onclick=()=>$('#libraryView').classList.add('is-hidden');
  $('#settingsButton').onclick=e=>{e.stopPropagation();$('#settingsPanel').classList.toggle('is-hidden')};
  document.addEventListener('click',e=>{const p=$('#settingsPanel');if(!p.classList.contains('is-hidden')&&!e.target.closest('#settingsPanel')&&!e.target.closest('#settingsButton'))p.classList.add('is-hidden')});
  observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)&&shown<S.state.filtered.length)appendBatch()},{rootMargin:'700px 0px'});observer.observe($('#feedSentinel'))
};
S.loadCatalog=async()=>{
  $('#feedStatus').textContent='Carregando catálogo…';
  try{S.state.items=await fetchItems();S.state.filtered=S.state.items.slice();reset();$('#appMeta').textContent=(S.state.items.length||0)+' Shorts · '+((S.cfg.targets||[]).filter(t=>t.type==='vod').length)+' categoria(s)'}
  catch(e){$('#feedStatus').textContent='Falha ao carregar: '+e.message;S.toast('Não foi possível carregar o catálogo')}
};
})();

/* ===== 03-player.js ===== */
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
