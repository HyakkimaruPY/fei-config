(()=>{const z=window.__srhA;if(!z||z.k!=="e4c98a71"||z.m!=="h"||!Object.isFrozen(z)||typeof z.u!=='function'||typeof z.t!=='function')return;(()=>{'use strict';
const BASE_CONFIG=JSON.parse(document.getElementById('app-config').textContent);
const $=s=>document.querySelector(s);
const clean=s=>String(s??'').trim();
const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const runtimeKey='srh25:'+APP_NS+':runtime:v1';
function readRuntime(){try{const x=JSON.parse(localStorage.getItem(runtimeKey)||'null');return x&&typeof x==='object'?x:null}catch{return null}}
const cfg={...BASE_CONFIG,...(readRuntime()||{})};
const S={cfg,baseConfig:BASE_CONFIG,runtimeKey,state:{items:[],filtered:[],history:[],favorites:new Set(),pool:null,poolPromise:null,proxy:null,proxyChoice:null,hls:null,current:null,requests:new Map()},$};
window.SRH25=S;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=(source=cfg)=>clean(source?.server).replace(/\/+$/,'');
const enc=encodeURIComponent;
S.id=item=>String(item?.stream_id??item?.id??item?.movie_id??item?.name??'');
S.title=item=>clean(item?.name||item?.title||'Sem título');
function highQualityImage(item){
  const backdrop=Array.isArray(item?.backdrop_path)?item.backdrop_path[0]:item?.backdrop_path;
  let src=clean(item?.cover_big||item?.movie_image||item?.cover||backdrop||item?.stream_icon||'');
  if(!src)return'';
  try{
    const u=new URL(src,location.href);
    if(/(^|[.])image[.]tmdb[.]org$/i.test(u.hostname))u.pathname=u.pathname.replace(new RegExp('/t/p/(?:w[0-9]+|h[0-9]+|original)/','i'),'/t/p/original/');
    return u.href
  }catch{return src}
}
S.image=highQualityImage;
S.stream=item=>`${server()}/movie/${enc(cfg.username)}/${enc(cfg.password)}/${S.id(item)}.${clean(item?.container_extension)||'mp4'}`;
S.toast=msg=>{const n=$('#toast');if(!n)return;n.textContent=msg;n.classList.add('is-on');clearTimeout(S.toast.t);S.toast.t=setTimeout(()=>n.classList.remove('is-on'),1800)};
S.parseLogin=raw=>{let text=clean(raw);if(!text)throw new Error('Informe o novo M3U / login Xtream.');if(!/^https?:\/\//i.test(text))text='http://'+text;let u;try{u=new URL(text)}catch{throw new Error('URL inválida.')}let username=u.searchParams.get('username')||u.searchParams.get('user'),password=u.searchParams.get('password')||u.searchParams.get('pass');const parts=u.pathname.split('/').filter(Boolean);if((!username||!password)&&parts.length>=2&&!/\.php$/i.test(parts.at(-1)||'')){username=username||decodeURIComponent(parts[0]);password=password||decodeURIComponent(parts[1])}if(!username||!password)throw new Error('Não encontrei username e password.');return{server:u.origin.replace(/\/+$/,''),username,password,liveExtension:(u.searchParams.get('output')||cfg.liveExtension||'m3u8').toLowerCase()==='ts'?'ts':'m3u8'}};
S.saveRuntime=runtime=>{try{localStorage.setItem(runtimeKey,JSON.stringify(runtime));return true}catch{return false}};
function parseJson(t){let s=String(t??'').replace(/^\uFEFF/,'').trim();try{return JSON.parse(s)}catch{}const a=s.indexOf('{'),b=s.indexOf('['),i=a<0?b:b<0?a:Math.min(a,b);if(i>=0){const j=s.lastIndexOf(s[i]==='{'?'}':']');if(j>i)return JSON.parse(s.slice(i,j+1))}throw new Error('Resposta inválida')}
async function fetchText(url,timeout=5000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-cache',redirect:'follow',credentials:'omit',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(t)}}
function httpsTwin(url){try{const u=new URL(url);if(u.protocol!=='http:')return'';u.protocol='https:';return u.href}catch{return''}}
function proxyUrl(template,target){const b=clean(template),raw=clean(target),e=enc(raw);if(!b)return'';if(b.includes('{rawUrl}'))return b.replaceAll('{rawUrl}',raw);if(b.includes('{raw}'))return b.replaceAll('{raw}',raw);if(b.includes('{url}'))return b.replaceAll('{url}',e);if(b.endsWith('=')||b.endsWith('?'))return b+e;try{const u=new URL(b),k=['url','target','uri','q'].find(x=>u.searchParams.has(x))||'url';u.searchParams.set(k,raw);return u.toString()}catch{return''}}
function apiUrl(params={},source=cfg){const u=new URL(server(source)+'/player_api.php');u.searchParams.set('username',source.username);u.searchParams.set('password',source.password);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,v);return u.toString()}
async function loadPool(){
  if(S.state.pool)return S.state.pool;
  if(S.state.poolPromise)return S.state.poolPromise;
  S.state.poolPromise=(async()=>{const r=await fetch(window.__srhA.u('p'),{cache:'default'});if(!r.ok)throw new Error('Pool '+r.status);const j=await r.json();return S.state.pool=(Array.isArray(j.proxies)?j.proxies:[]).filter(x=>x&&x.template&&x.valid!==false&&x.enabled!==false).sort((a,b)=>(+a.latencyMs||9e9)-(+b.latencyMs||9e9))})();
  try{return await S.state.poolPromise}finally{S.state.poolPromise=null}
}
function proxyKey(source=cfg){let h='host';try{h=new URL(server(source)).host}catch{}return 'srh25:proxy:'+(source.appId||BASE_CONFIG.appId||source.appName||BASE_CONFIG.appName||'app')+':'+h}
function readProxy(source=cfg){try{return JSON.parse(localStorage.getItem(proxyKey(source))||'null')}catch{return null}}
function saveProxy(x,source=cfg){try{localStorage.setItem(proxyKey(source),JSON.stringify(x))}catch{}}
function clearProxy(source=cfg){try{localStorage.removeItem(proxyKey(source))}catch{}}
async function chooseProxy(target,source=cfg){
  if(S.state.proxyChoice)return S.state.proxyChoice;
  const job=(async()=>{
    const pool=(await loadPool()).slice(0,4);
    const tests=await Promise.all(pool.map(async p=>{const u=proxyUrl(p.template,target),t=performance.now();try{parseJson(await fetchText(u,2600));return{p,ms:performance.now()-t}}catch{return null}}));
    const ok=tests.filter(Boolean).sort((a,b)=>a.ms-b.ms)[0];
    if(!ok)throw new Error('Nenhum proxy CORS respondeu');
    saveProxy({template:ok.p.template,id:ok.p.id||'',uses:1,at:Date.now()},source);return ok.p.template
  })();
  S.state.proxyChoice=job;
  job.then(()=>{S.state.proxyChoice=null},()=>{S.state.proxyChoice=null});
  return job
}
function requestFor(params={},source=cfg){
  const target=apiUrl(params,source),key=target;
  if(S.state.requests.has(key))return S.state.requests.get(key);
  const job=(async()=>{
    const candidates=[target,httpsTwin(target)].filter(Boolean);
    let last;
    if(candidates.length){
      try{return await Promise.any(candidates.map(async u=>parseJson(await fetchText(u,1900))))}catch(e){last=e}
    }
    if(source.corsProxy){
      try{return parseJson(await fetchText(proxyUrl(source.corsProxy,target),3600))}catch(e){last=e}
    }
    if(source.autoCorsProxy!==false){
      const saved=readProxy(source);
      if(saved?.template){
        try{
          saved.uses=Number(saved.uses||0)+1;saveProxy(saved,source);
          return parseJson(await fetchText(proxyUrl(saved.template,target),3600));
        }catch(e){last=e;clearProxy(source)}
      }
      try{
        const p=await chooseProxy(target,source);
        return parseJson(await fetchText(proxyUrl(p,target),4200));
      }catch(e){last=e}
    }
    throw last||new Error('Falha de conexão')
  })();
  S.state.requests.set(key,job);
  job.then(()=>S.state.requests.delete(key),()=>S.state.requests.delete(key));
  return job
}
S.request=params=>requestFor(params,cfg);
S.requestWithConfig=(params,source)=>requestFor(params,{...cfg,...source});
const ns=APP_NS;
const favKey='srh25:'+ns+':favorites',histKey='srh25:'+ns+':history';
S.readFavorites=()=>{try{return new Set(JSON.parse(localStorage.getItem(favKey)||'[]').map(String))}catch{return new Set()}};
S.writeFavorites=set=>{try{localStorage.setItem(favKey,JSON.stringify([...set]));return true}catch{return false}};
S.readHistory=()=>{try{const x=JSON.parse(localStorage.getItem(histKey)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
S.writeHistory=list=>{try{localStorage.setItem(histKey,JSON.stringify(list.slice(0,80)));return true}catch{return false}};
S.toggleFavorite=item=>{
  const id=S.id(item),current=S.state.favorites,next=new Set(current);
  if(next.has(id))next.delete(id);else next.add(id);
  if(!S.writeFavorites(next))return current.has(id);
  S.state.favorites=next;
  S.refreshLibraryView?.();
  return next.has(id)
};
S.historyFor=item=>S.state.history.find(x=>x.id===S.id(item))||null;
S.saveProgress=(item,position,duration)=>{
  if(!item||!Number.isFinite(position)||position<60)return false;
  const id=S.id(item),safeDuration=Number.isFinite(duration)&&duration>0?duration:0;
  const list=S.readHistory().filter(x=>x.id!==id);
  list.unshift({id,title:S.title(item),image:S.image(item),position,duration:safeDuration,updatedAt:Date.now(),item:{stream_id:item.stream_id,id:item.id,name:item.name,title:item.title,stream_icon:item.stream_icon,movie_image:item.movie_image,cover:item.cover,container_extension:item.container_extension}});
  if(!S.writeHistory(list))return false;
  S.state.history=S.readHistory();
  S.refreshLibraryView?.();
  return true
};
S.removeHistory=item=>{
  const next=S.readHistory().filter(x=>x.id!==S.id(item));
  if(!S.writeHistory(next))return false;
  S.state.history=S.readHistory();
  S.refreshLibraryView?.();
  return true
};
S.lockZoom=()=>{
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
  document.addEventListener('touchmove',e=>{if(e.touches?.length>1)e.preventDefault()},{passive:false});
  window.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault()});
};
S.account=async()=>{try{const a=await S.request({}),raw=a?.user_info?.exp_date,n=Number(raw);if(n>0){const d=new Date(n*1000),days=Math.ceil((d-Date.now())/86400000);$('#expiryDate').textContent=d.toLocaleDateString('pt-BR');$('#expiryDays').textContent=days+' dias';$('#appMeta').textContent=(a?.user_info?.status||'Active')+' · '+days+' dias restantes'}else $('#appMeta').textContent=a?.user_info?.status||'Active'}catch{$('#appMeta').textContent='Conta conectada'}};
S.boot=async()=>{document.body.dataset.theme=cfg.theme||'graphene';$('#appTitle').textContent=cfg.appName||'Meu App';S.lockZoom();S.state.favorites=S.readFavorites();S.state.history=S.readHistory();S.bindShell?.();await S.loadCatalog?.();window.dispatchEvent(new Event('srh25:ready'));setTimeout(()=>S.account(),0)};
})();
(()=>{'use strict';const S=window.SRH25,$=S.$;
const BATCH=30,CACHE_MAX_AGE=6*60*60*1000;let shown=0,observer=null,imgObserver=null,activeLibrary=null,updateCandidate=null,updateCategories=[],updateSelected=new Set();
function cleanName(s){return String(s||'').replace(/[\uFE0F\u200D]/g,'').trim()}
function normName(s){return cleanName(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim()}
function mergeUnique(base,extra){const seen=new Set(),out=[];for(const item of [...(base||[]),...(extra||[])]){const id=S.id(item);if(!id||seen.has(id))continue;seen.add(id);out.push(item)}return out}
const cacheKey='catalog:'+(S.cfg.appId||S.cfg.appName||'app');
function openCache(){return new Promise((resolve,reject)=>{try{const q=indexedDB.open('srh-shorts-cache',1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('catalogs'))q.result.createObjectStore('catalogs')};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)}catch(e){reject(e)}})}
async function cacheRead(){try{const db=await openCache();return await new Promise(resolve=>{const tx=db.transaction('catalogs','readonly'),r=tx.objectStore('catalogs').get(cacheKey);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)})}catch{return null}}
async function cacheWrite(items){if(!items?.length)return;try{const db=await openCache();await new Promise(resolve=>{const tx=db.transaction('catalogs','readwrite');tx.objectStore('catalogs').put({time:Date.now(),items},cacheKey);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()})}catch{}}
S.clearCatalogCache=async()=>{try{const db=await openCache();await new Promise(resolve=>{const tx=db.transaction('catalogs','readwrite');tx.objectStore('catalogs').delete(cacheKey);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()})}catch{}};
async function resolveTargets(){
  const targets=(S.cfg.targets||[]).filter(t=>t.type==='vod');
  if(targets.every(t=>String(t.id??t.category_id??'').trim()))return targets.map(t=>({...t,_id:String(t.id??t.category_id)}));
  const cats=await S.request({action:'get_vod_categories'}),rows=Array.isArray(cats)?cats:[];
  const exact=new Map(rows.map(c=>[cleanName(c.category_name??c.name),String(c.category_id??c.id??'')]));
  const normalized=new Map(rows.map(c=>[normName(c.category_name??c.name),String(c.category_id??c.id??'')]));
  return targets.map(t=>({...t,_id:String(t.id??t.category_id??exact.get(cleanName(t.name))??normalized.get(normName(t.name))??'')}));
}
async function fetchItems(onGroup){
  const targets=(await resolveTargets()).filter(t=>t._id),merged=[];let failed=0;
  for(let index=0;index<targets.length;index++){
    const t=targets[index];let items=null;
    for(let attempt=0;attempt<2;attempt++){
      try{const r=await S.request({action:'get_vod_streams',category_id:t._id});items=Array.isArray(r)?r:[];break}
      catch(e){if(attempt===0)await new Promise(resolve=>setTimeout(resolve,220))}
    }
    if(items===null){failed++;continue}
    const next=mergeUnique(merged,items);merged.splice(0,merged.length,...next);
    onGroup?.(items,t,{index:index+1,total:targets.length,merged:merged.slice(),failed})
  }
  if(!merged.length&&failed)throw new Error('As categorias selecionadas não responderam.');
  if(failed)S.toast(failed+' categoria(s) não responderam; exibindo as demais.');
  return merged
}
function card(item){
  const b=document.createElement('button');b.type='button';b.className='srh25-card';b.dataset.id=S.id(item);
  const img=document.createElement('img');img.className='srh25-card__image';img.alt='';img.loading='lazy';img.decoding='async';
  const ph=document.createElement('div');ph.className='srh25-card__placeholder';b.append(img,ph);
  img.onload=()=>img.classList.add('is-ready');img.onerror=()=>{img.removeAttribute('src');img.classList.remove('is-ready')};
  const src=S.image(item);if(src){img.dataset.src=src;if(imgObserver)imgObserver.observe(img);else img.src=src}
  b.onclick=()=>S.openPlayer?.(item);return b
}
function ensureImageObserver(){
  if(imgObserver||!('IntersectionObserver'in window))return;
  imgObserver=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const img=e.target;if(img.dataset.src&&!img.src)img.src=img.dataset.src;imgObserver.unobserve(img)}},{rootMargin:'520px 0px'});
}
function appendBatch(){
  const grid=$('#shortGrid'),list=S.state.filtered,end=Math.min(list.length,shown+BATCH),frag=document.createDocumentFragment();
  for(let i=shown;i<end;i++)frag.appendChild(card(list[i]));grid.appendChild(frag);shown=end;
  $('#feedStatus').textContent=list.length?shown+' de '+list.length+' Shorts':'Nenhum Short encontrado'
}
function reset(){shown=0;$('#shortGrid').replaceChildren();ensureImageObserver();appendBatch()}
function renderItems(items){S.state.items=items;S.state.filtered=items.slice();reset();$('#appMeta').textContent=items.length+' Shorts · '+((S.cfg.targets||[]).filter(t=>t.type==='vod').length)+' categoria(s)'}
function filter(){const q=$('#shortSearch').value.trim().toLocaleLowerCase('pt-BR');S.state.filtered=q?S.state.items.filter(x=>S.title(x).toLocaleLowerCase('pt-BR').includes(q)):S.state.items.slice();reset()}
function libraryItems(kind){if(kind==='favorites')return S.state.items.filter(x=>S.state.favorites.has(S.id(x)));const byId=new Map(S.state.items.map(x=>[S.id(x),x]));return S.state.history.map(h=>byId.get(h.id)||h.item).filter(Boolean)}
function renderLibrary(kind){const grid=$('#libraryGrid'),title=$('#libraryTitle'),items=libraryItems(kind);title.textContent=kind==='favorites'?'Favoritos':'Continuar assistindo';grid.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='srh25-empty';e.textContent='Nada aqui por enquanto.';grid.appendChild(e)}else items.forEach(x=>grid.appendChild(card(x)))}
function openLibrary(kind){activeLibrary=kind;renderLibrary(kind);$('#libraryView').classList.remove('is-hidden')}
S.refreshLibraryView=()=>{const view=$('#libraryView');if(activeLibrary&&!view.classList.contains('is-hidden'))renderLibrary(activeLibrary)}
function ensureUpdateUi(){
  const panel=$('#settingsPanel');if(!panel||$('#shortUpdate'))return;
  const wrap=document.createElement('section');wrap.id='shortUpdate';wrap.className='srh25-update';
  wrap.innerHTML='<button class="srh25-update__toggle" id="shortUpdateToggle" type="button"><span>Atualizar app</span><span id="shortUpdateIcon">⌄</span></button><div class="srh25-update__body is-hidden" id="shortUpdateBody"><input class="srh25-update__input" id="shortUpdateM3u" placeholder="Cole o novo M3U / login Xtream"><div class="srh25-update__actions"><button class="srh25-update__button" id="shortUpdateLoad" type="button">Ler categorias</button><button class="srh25-update__button srh25-update__button--accent" id="shortUpdateApply" type="button" disabled>Atualizar</button></div><div class="srh25-update__status" id="shortUpdateStatus">A atualização do Shorts usa somente categorias de filmes.</div><div class="srh25-update__list" id="shortUpdateList"></div></div>';
  panel.appendChild(wrap)
}
function renderUpdateCategories(){
  const list=$('#shortUpdateList'),apply=$('#shortUpdateApply');if(!list||!apply)return;list.replaceChildren();
  if(!updateCategories.length){apply.disabled=true;return}
  const frag=document.createDocumentFragment();
  for(const c of updateCategories){
    const label=document.createElement('label');label.className='srh25-update__option';
    const input=document.createElement('input');input.type='checkbox';input.checked=updateSelected.has(c.id);
    const span=document.createElement('span');span.textContent=cleanName(c.name)||'Categoria';
    input.onchange=()=>{input.checked?updateSelected.add(c.id):updateSelected.delete(c.id);apply.disabled=!updateSelected.size};
    label.append(input,span);frag.appendChild(label)
  }
  list.appendChild(frag);apply.disabled=!updateSelected.size
}
async function loadUpdateCategories(){
  const input=$('#shortUpdateM3u'),load=$('#shortUpdateLoad'),status=$('#shortUpdateStatus'),list=$('#shortUpdateList'),apply=$('#shortUpdateApply');
  updateCandidate=null;updateCategories=[];updateSelected.clear();if(list)list.replaceChildren();if(apply)apply.disabled=true;
  try{
    const login=S.parseLogin(input?.value||''),candidate={...S.cfg,...login};
    if(status)status.textContent='Validando login e lendo categorias de filmes…';if(load)load.disabled=true;
    const account=await S.requestWithConfig({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');
    if(!active)throw new Error('O novo login não retornou uma conta ativa.');
    const raw=await S.requestWithConfig({action:'get_vod_categories'},candidate);
    updateCategories=(Array.isArray(raw)?raw:[]).map((c,i)=>({type:'vod',id:String(c.category_id??c.id??i),name:String(c.category_name??c.name??('Categoria '+(i+1)))}));
    updateCandidate=candidate;
    const oldIds=new Set((S.cfg.targets||[]).filter(t=>t.type==='vod').map(t=>String(t.id??t.category_id??''))),oldNames=new Set((S.cfg.targets||[]).filter(t=>t.type==='vod').map(t=>normName(t.name)));
    for(const c of updateCategories)if(oldIds.has(c.id)||oldNames.has(normName(c.name)))updateSelected.add(c.id);
    renderUpdateCategories();if(status)status.textContent=updateCategories.length+' categorias de filmes disponíveis.'
  }catch(e){if(status)status.textContent=e?.message||String(e)}
  finally{if(load)load.disabled=false}
}
async function applyUpdate(){
  const status=$('#shortUpdateStatus');if(!updateCandidate||!updateSelected.size)return;
  const targets=updateCategories.filter(c=>updateSelected.has(c.id)).map(c=>({type:'vod',id:c.id,name:c.name}));
  const runtime={server:updateCandidate.server,username:updateCandidate.username,password:updateCandidate.password,liveExtension:updateCandidate.liveExtension,targets};
  if(!S.saveRuntime(runtime)){S.toast('O navegador bloqueou o armazenamento local.');return}
  if(status)status.textContent='Atualização salva. Recarregando…';
  await S.clearCatalogCache?.();S.toast('Lista atualizada. Recarregando…');setTimeout(()=>location.reload(),350)
}
S.bindShell=()=>{
  ensureImageObserver();ensureUpdateUi();
  $('#shortUpdateToggle').onclick=()=>{const body=$('#shortUpdateBody'),hidden=body.classList.toggle('is-hidden');$('#shortUpdateIcon').textContent=hidden?'⌄':'⌃'};
  $('#shortUpdateLoad').onclick=loadUpdateCategories;$('#shortUpdateApply').onclick=applyUpdate;
  $('#searchButton').onclick=()=>{$('#searchWrap').classList.toggle('is-hidden');if(!$('#searchWrap').classList.contains('is-hidden'))$('#shortSearch').focus()};$('#shortSearch').oninput=filter;
  $('#historyButton').onclick=()=>openLibrary('history');$('#favoritesButton').onclick=()=>openLibrary('favorites');$('#libraryClose').onclick=()=>{activeLibrary=null;$('#libraryView').classList.add('is-hidden')};
  $('#settingsButton').onclick=e=>{e.stopPropagation();$('#settingsPanel').classList.toggle('is-hidden')};document.addEventListener('click',e=>{const p=$('#settingsPanel');if(!p.classList.contains('is-hidden')&&!e.target.closest('#settingsPanel')&&!e.target.closest('#settingsButton'))p.classList.add('is-hidden')});
  observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)&&shown<S.state.filtered.length)appendBatch()},{rootMargin:'700px 0px'});observer.observe($('#feedSentinel'))
};
S.loadCatalog=async()=>{
  $('#feedStatus').textContent='Carregando catálogo…';
  const cached=await cacheRead(),fresh=cached?.items?.length&&Date.now()-Number(cached.time||0)<CACHE_MAX_AGE;
  let painted=!!cached?.items?.length,partial=[],firstResolve;const firstPaint=new Promise(r=>firstResolve=r);
  if(painted){renderItems(cached.items);$('#feedStatus').textContent='Atualizando catálogo…'}
  const refresh=(async()=>{
    try{
      const items=await fetchItems((group,target,progress)=>{
        partial=mergeUnique(partial,group);
        if(partial.length){
          renderItems(partial);
          $('#feedStatus').textContent='Mesclando categorias · '+progress.index+' de '+progress.total;
          if(!painted){painted=true;firstResolve?.();firstResolve=null}
        }
      });
      if(items.length){renderItems(items);await cacheWrite(items);return items}
      if(!painted)throw new Error('Nenhum conteúdo retornado')
      return cached?.items||[]
    }catch(e){
      if(!painted){$('#feedStatus').textContent='Falha ao carregar: '+(e?.message||e);S.toast('Não foi possível carregar o catálogo');firstResolve?.();firstResolve=null}
      else $('#feedStatus').textContent=(cached?.items?.length||0)+' Shorts';
      return cached?.items||[]
    }
  })();
  if(painted){void refresh;return cached.items}
  await Promise.race([firstPaint,refresh]);return S.state.items
};
})();
(()=>{'use strict';const S=window.SRH25,$=S.$;const video=$('#shortVideo'),player=$('#shortPlayer'),poster=$('#shortPoster'),loading=$('#playerLoading'),arcDrawer=$('#arcDrawer'),arcGrid=$('#arcGrid');let arcBackdrop=$('#arcBackdrop');let startX=0,startY=0,lastSavedPosition=0,activeArc=-1;
let arcDragStartY=null;
const fitKey='srh:shorts:fit:'+(S.cfg.appId||S.cfg.appName||'app');
let fitMode='cover';try{fitMode=localStorage.getItem(fitKey)||'cover'}catch{}if(fitMode!=='contain')fitMode='cover';
function applyFitMode(){const contain=fitMode==='contain';player.classList.toggle('is-contain',contain);const b=$('#playerFit'),label=b?.querySelector('small');if(b){b.classList.toggle('is-active',!contain);b.setAttribute('aria-pressed',contain?'false':'true');b.setAttribute('aria-label',contain?'Ativar preenchimento de tela':'Usar resolução normal')}if(label)label.textContent=contain?'Tela cheia':'Normal'}
function toggleFitMode(){fitMode=fitMode==='contain'?'cover':'contain';try{localStorage.setItem(fitKey,fitMode)}catch{}applyFitMode()}

let hlsLoader=null;
function ensureHls(){
  if(window.Hls)return Promise.resolve(window.Hls);
  if(hlsLoader)return hlsLoader;
  hlsLoader=new Promise((resolve,reject)=>{
    const old=document.querySelector('script[data-srh-hls]');
    if(old){old.addEventListener('load',()=>resolve(window.Hls),{once:true});old.addEventListener('error',()=>reject(new Error('HLS indisponível')),{once:true});return}
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js';s.async=true;s.dataset.srhHls='1';
    const timer=setTimeout(()=>reject(new Error('Timeout ao carregar HLS')),6500);
    s.onload=()=>{clearTimeout(timer);window.Hls?resolve(window.Hls):reject(new Error('HLS indisponível'))};
    s.onerror=()=>{clearTimeout(timer);reject(new Error('Falha ao carregar HLS'))};
    document.head.appendChild(s)
  }).finally(()=>{hlsLoader=null});
  return hlsLoader
}
function destroyHls(){try{S.state.hls?.destroy()}catch{}S.state.hls=null}
function ensureArcSheetChrome(){
  if(!arcBackdrop){
    arcBackdrop=document.createElement('div');
    arcBackdrop.id='arcBackdrop';
    arcBackdrop.className='srh25-arc-backdrop is-hidden';
    arcDrawer.parentNode?.insertBefore(arcBackdrop,arcDrawer);
  }
  let handle=arcDrawer.querySelector('.srh25-arcs__handle');
  if(!handle){
    handle=document.createElement('div');
    handle.className='srh25-arcs__handle';
    handle.setAttribute('aria-label','Arraste para baixo para fechar');
    handle.innerHTML='<span></span>';
    arcDrawer.prepend(handle);
  }
  let head=arcDrawer.querySelector('.srh25-arcs__head');
  if(!head){
    head=document.createElement('div');
    head.className='srh25-arcs__head';
    const title=document.createElement('h3');title.textContent='Arcos';
    head.appendChild(title);
    handle.insertAdjacentElement('afterend',head);
  }
  let close=head.querySelector('#arcClose');
  if(!close){
    close=document.createElement('button');
    close.id='arcClose';
    close.type='button';
    close.className='srh25-arcs__close';
    close.setAttribute('aria-label','Fechar arcos');
    close.innerHTML='<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    head.appendChild(close);
  }
  arcBackdrop.onclick=closeArcs;
  close.onclick=closeArcs;
}
function closeArcs(){arcBackdrop?.classList.add('is-hidden');arcDrawer.classList.add('is-hidden')}
function stop(){const cur=S.state.current;if(cur)S.saveProgress(cur.item,video.currentTime,video.duration);closeArcs();destroyHls();video.pause();video.removeAttribute('src');video.load();S.state.current=null;player.classList.add('is-hidden')}
function setFavorite(){const cur=S.state.current;if(!cur)return;const on=S.toggleFavorite(cur.item);$('#playerFavorite').classList.toggle('is-active',on);$('#playerFavorite').querySelector('small').textContent=on?'Favoritado':'Favorito'}
function arcIndex(){const d=video.duration;if(!Number.isFinite(d)||d<=0)return 0;return Math.max(0,Math.min(Math.ceil(d/120)-1,Math.floor((Number(video.currentTime)||0)/120)))}
function syncArcSelection(scroll=false){if(arcDrawer.classList.contains('is-hidden'))return;const index=arcIndex();if(index===activeArc&&!scroll)return;activeArc=index;let active=null;arcGrid.querySelectorAll('[data-arc-index]').forEach(b=>{const on=Number(b.dataset.arcIndex)===index;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'true':'false');if(on)active=b});if(scroll&&active)requestAnimationFrame(()=>active.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'}))}
function drawArcs(){const d=video.duration;if(!Number.isFinite(d)||d<=0){arcGrid.innerHTML='<div class="srh25-empty">Aguardando duração…</div>';return}const n=Math.max(1,Math.ceil(d/120));arcGrid.replaceChildren();for(let i=0;i<n;i++){const start=i*120,b=document.createElement('button');b.className='srh25-arc';b.dataset.arcIndex=String(i);b.innerHTML='<strong>Arco '+(i+1)+'</strong>';b.onclick=()=>{video.currentTime=Math.min(Math.max(0,d-.1),start);activeArc=i;closeArcs();video.play().catch(()=>{})};arcGrid.appendChild(b)}syncArcSelection(true)}
function openArcs(){ensureArcSheetChrome();drawArcs();arcBackdrop.classList.remove('is-hidden');arcDrawer.classList.remove('is-hidden');activeArc=-1;syncArcSelection(true)}
async function loadVideo(item,resume){
  const url=S.stream(item),ready=()=>{if(resume?.position>0&&resume.position<video.duration-3){video.currentTime=resume.position;const done=()=>{poster.classList.add('is-hidden');loading.classList.add('is-hidden');video.play().catch(()=>{})};video.addEventListener('seeked',done,{once:true})}else{poster.classList.add('is-hidden');loading.classList.add('is-hidden');video.play().catch(()=>{})}drawArcs()};
  if(/\.m3u8(?:$|\?)/i.test(url)){
    if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.onloadedmetadata=ready;video.onerror=()=>S.toast('Mídia indisponível');video.load();return}
    try{const H=await ensureHls();if(H?.isSupported?.()){const h=new H({enableWorker:true,maxBufferLength:30,capLevelToPlayerSize:false,startLevel:-1});S.state.hls=h;h.loadSource(url);h.attachMedia(video);h.on(H.Events.MANIFEST_PARSED,()=>{const highest=Math.max(0,(h.levels?.length||1)-1);h.autoLevelCapping=highest;h.currentLevel=highest;h.nextLevel=highest;ready()});h.on(H.Events.LEVEL_SWITCHED,()=>{const highest=Math.max(0,(h.levels?.length||1)-1);if(h.currentLevel!==highest)h.nextLevel=highest});h.on(H.Events.ERROR,(_,d)=>{if(d.fatal)S.toast('Falha ao iniciar o vídeo')});return}}catch(e){S.toast(e?.message||'HLS indisponível')}
  }
  video.src=url;video.onloadedmetadata=ready;video.onerror=()=>S.toast('Mídia indisponível');video.load()
}
S.openPlayer=item=>{
  destroyHls();const hist=S.historyFor(item);S.state.current={item};lastSavedPosition=Number(hist?.position||0);activeArc=-1;player.classList.remove('is-hidden');applyFitMode();poster.classList.remove('is-hidden');loading.classList.remove('is-hidden');poster.src=S.image(item)||'';$('#playerTitle').textContent=S.title(item);$('#playerMeta').textContent=hist?'Retomando do ponto salvo':'Arcos de 2 minutos';$('#playerFavorite').classList.toggle('is-active',S.state.favorites.has(S.id(item)));closeArcs();loadVideo(item,hist)
};
function persistCurrentProgress(force=false){const cur=S.state.current,pos=Number(video.currentTime||0);if(!cur||pos<60)return false;if(!force&&lastSavedPosition>=60&&Math.abs(pos-lastSavedPosition)<10)return false;const ok=S.saveProgress(cur.item,pos,video.duration);if(ok)lastSavedPosition=pos;return ok}
video.ontimeupdate=()=>{persistCurrentProgress(false);syncArcSelection(false)};
video.onpause=()=>{if(!video.ended)persistCurrentProgress(true)};
video.onended=()=>{if(S.state.current)S.removeHistory(S.state.current.item);lastSavedPosition=0};
$('#playerClose').onclick=stop;$('#playerFavorite').onclick=setFavorite;
$('#playerArcs').onclick=()=>arcDrawer.classList.contains('is-hidden')?openArcs():closeArcs();
ensureArcSheetChrome();
document.addEventListener('pointerdown',e=>{
  if(arcDrawer.classList.contains('is-hidden'))return;
  if(arcDrawer.contains(e.target)||e.target.closest?.('#playerArcs'))return;
  e.preventDefault();
  e.stopPropagation();
  closeArcs();
},true);
arcDrawer.addEventListener('pointerdown',e=>{if(!e.target.closest('.srh25-arcs__handle,.srh25-arcs__head'))return;arcDragStartY=e.clientY},{passive:true});
arcDrawer.addEventListener('pointerup',e=>{if(arcDragStartY==null)return;const dy=e.clientY-arcDragStartY;arcDragStartY=null;if(dy>54)closeArcs()},{passive:true});
arcDrawer.addEventListener('pointercancel',()=>{arcDragStartY=null},{passive:true});
$('#playerNext').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration-.1,(Math.floor(video.currentTime/120)+1)*120)};
$('#playerFit').onclick=toggleFitMode;
$('#playerStage').addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY},{passive:true});
$('#playerStage').addEventListener('pointerup',e=>{const dx=e.clientX-startX,dy=e.clientY-startY;if(dx>85&&Math.abs(dy)<70)stop()},{passive:true});
window.addEventListener('pagehide',()=>{if(S.state.current)S.saveProgress(S.state.current.item,video.currentTime,video.duration)});
Promise.resolve().then(()=>S.boot());
})();
})();
