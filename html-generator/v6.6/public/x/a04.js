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
const favKey='srh25:'+ns+':favorites',histKey='srh25:'+ns+':history',continueHiddenKey='srh25:'+ns+':continue-hidden:v1';
S.readContinueHidden=()=>{try{const x=JSON.parse(localStorage.getItem(continueHiddenKey)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return{}}};
S.writeContinueHidden=map=>{try{
  const rows=Object.entries(map||{}).sort((a,b)=>Number(b[1]?.at||0)-Number(a[1]?.at||0)).slice(0,200);
  localStorage.setItem(continueHiddenKey,JSON.stringify(Object.fromEntries(rows)));return true
}catch{return false}};
S.continueHiddenReason=item=>S.readContinueHidden()[S.id(item)]?.reason||'';
S.hideContinue=(item,reason='manual')=>{
  const id=S.id(item);if(!id)return false;
  const map=S.readContinueHidden(),current=map[id];
  if(current?.reason===reason)return true;
  map[id]={reason,at:Date.now()};
  if(!S.writeContinueHidden(map))return false;
  S.refreshLibraryView?.();return true
};
S.restoreCompletedContinue=item=>{
  const id=S.id(item),map=S.readContinueHidden();
  if(map[id]?.reason!=='complete')return false;
  delete map[id];S.writeContinueHidden(map);S.refreshLibraryView?.();return true
};
S.restoreContinue=item=>{
  const id=S.id(item),map=S.readContinueHidden();
  if(!map[id])return false;
  delete map[id];
  S.writeContinueHidden(map);
  S.refreshLibraryView?.();
  return true
};
S.isContinueVisible=item=>!S.readContinueHidden()[S.id(item)];
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
  if(!item||!Number.isFinite(position)||position<0)return false;
  const id=S.id(item),safeDuration=Number.isFinite(duration)&&duration>0?duration:0;
  const list=S.readHistory().filter(x=>x.id!==id);
  list.unshift({id,title:S.title(item),image:S.image(item),position,duration:safeDuration,updatedAt:Date.now(),item:{stream_id:item.stream_id,id:item.id,movie_id:item.movie_id,name:item.name,title:item.title,stream_icon:item.stream_icon,movie_image:item.movie_image,cover:item.cover,cover_big:item.cover_big,backdrop_path:item.backdrop_path,container_extension:item.container_extension}});
  if(!S.writeHistory(list))return false;
  S.state.history=S.readHistory();
  const remaining=safeDuration>0?safeDuration-position:Infinity;
  if(Number.isFinite(remaining)&&remaining<=30)S.hideContinue(item,'complete');
  else if(remaining>30)S.restoreCompletedContinue(item);
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
function ensureContinueStyles(){
  if(document.getElementById('srh25ContinueStyle'))return;
  const s=document.createElement('style');s.id='srh25ContinueStyle';
  s.textContent='.srh25-card-wrap{position:relative;min-width:0}.srh25-card-wrap>.srh25-card{width:100%;display:block}.srh25-card-delete{position:absolute;z-index:5;top:7px;right:7px;width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(8,11,15,.72);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.srh25-card-delete:active{transform:scale(.94)}.srh25-card-delete svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}';
  document.head.appendChild(s)
}
function card(item,options={}){
  const b=document.createElement('button');b.type='button';b.className='srh25-card';b.dataset.id=S.id(item);
  const img=document.createElement('img');img.className='srh25-card__image';img.alt='';img.loading='lazy';img.decoding='async';
  const ph=document.createElement('div');ph.className='srh25-card__placeholder';b.append(img,ph);
  img.onload=()=>img.classList.add('is-ready');img.onerror=()=>{img.removeAttribute('src');img.classList.remove('is-ready')};
  const src=S.image(item);if(src){img.dataset.src=src;if(imgObserver)imgObserver.observe(img);else img.src=src}
  b.onclick=()=>S.openPlayer?.(item);
  if(!options.continue)return b;
  ensureContinueStyles();
  const wrap=document.createElement('div');wrap.className='srh25-card-wrap';
  const del=document.createElement('button');del.type='button';del.className='srh25-card-delete';del.setAttribute('aria-label','Remover de Continuar assistindo');del.title='Remover de Continuar assistindo';
  del.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>';
  del.onclick=e=>{e.preventDefault();e.stopPropagation();S.hideContinue(item,'manual')};
  wrap.append(b,del);return wrap
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
function libraryItems(kind){if(kind==='favorites')return S.state.items.filter(x=>S.state.favorites.has(S.id(x)));const byId=new Map(S.state.items.map(x=>[S.id(x),x]));return S.state.history.map(h=>byId.get(h.id)||h.item).filter(Boolean).filter(x=>S.isContinueVisible(x))}
function renderLibrary(kind){const grid=$('#libraryGrid'),title=$('#libraryTitle'),items=libraryItems(kind);title.textContent=kind==='favorites'?'Favoritos':'Continuar assistindo';grid.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='srh25-empty';e.textContent='Nada aqui por enquanto.';grid.appendChild(e)}else items.forEach(x=>grid.appendChild(card(x,{continue:kind!=='favorites'})))}
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

const MINI_BASE='srh25:'+String(S.cfg.appId||S.cfg.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const MINI_KEY=MINI_BASE+':mini-resume:v1';
const MINI_DISMISS_KEY=MINI_BASE+':mini-resume-dismissed:v1';
const MINI_POS_KEY=MINI_BASE+':mini-resume-position:v1';
const MINI_TTL=7*24*60*60*1000;
const MINI_EXPANDED_MS=4800;
let miniDock=null,miniOpen=null,miniImage=null,miniTitle=null,miniEpisode=null,miniProgress=null,miniClose=null;
let miniCompactTimer=0,miniExpiryTimer=0,miniSuppressOpen=false,miniSuppressTimer=0,miniDrag=null;

function miniClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function miniRead(key,fallback=null){try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw)}catch{return fallback}}
function miniWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function miniRemove(key){try{localStorage.removeItem(key)}catch{}}
function miniFresh(record){const updated=Number(record?.updatedAt||0);return !!record?.item&&updated>0&&Date.now()-updated<MINI_TTL}
function readMiniResume(){
  const record=miniRead(MINI_KEY,null);
  if(miniFresh(record))return record;
  miniRemove(MINI_KEY);miniRemove(MINI_DISMISS_KEY);
  return null
}
function miniItemSnapshot(item){
  return {stream_id:item?.stream_id,id:item?.id,movie_id:item?.movie_id,name:item?.name,title:item?.title,stream_icon:item?.stream_icon,movie_image:item?.movie_image,cover:item?.cover,cover_big:item?.cover_big,backdrop_path:item?.backdrop_path,container_extension:item?.container_extension}
}
function clearMiniResume(item){
  const record=miniRead(MINI_KEY,null);
  if(item&&record?.id&&String(record.id)!==String(S.id(item)))return;
  miniRemove(MINI_KEY);miniRemove(MINI_DISMISS_KEY);
  clearTimeout(miniCompactTimer);clearTimeout(miniExpiryTimer);
  if(miniDock)miniDock.classList.add('is-hidden')
}
function saveMiniResume(item,position,duration){
  const pos=Number(position),dur=Number(duration);
  if(!item||!Number.isFinite(pos)||pos<0)return null;
  if(Number.isFinite(dur)&&dur>0&&dur-pos<=30){clearMiniResume(item);return null}
  const record={id:S.id(item),title:S.title(item),image:S.image(item),position:pos,duration:Number.isFinite(dur)&&dur>0?dur:0,updatedAt:Date.now(),item:miniItemSnapshot(item)};
  if(!miniWrite(MINI_KEY,record))return null;
  miniRemove(MINI_DISMISS_KEY);
  return record
}
function miniEpisodeLabel(position){return 'EP'+(Math.max(0,Math.floor((Number(position)||0)/120))+1)}
function hideMiniResume(){if(miniDock)miniDock.classList.add('is-hidden')}
function ensureMiniStyles(){
  if(document.getElementById('srh25MiniResumeStyle'))return;
  const style=document.createElement('style');style.id='srh25MiniResumeStyle';
  style.textContent='.srh25-mini-resume{position:fixed;z-index:88;left:12px;bottom:max(16px,env(safe-area-inset-bottom));width:min(310px,calc(100vw - 24px));height:82px;display:grid;grid-template-columns:minmax(0,1fr) 38px;align-items:stretch;border:1px solid var(--line,rgba(255,255,255,.16));border-radius:18px;background:color-mix(in srgb,var(--bg-elev,#10161d) 92%,transparent);box-shadow:0 18px 50px rgba(0,0,0,.42);overflow:hidden;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);transition:width .24s cubic-bezier(.22,1,.36,1),height .24s cubic-bezier(.22,1,.36,1),opacity .18s ease;touch-action:none}.srh25-mini-resume.is-hidden{display:none!important}.srh25-mini-resume.is-compact{width:min(190px,calc(100vw - 24px));height:68px}.srh25-mini-resume.is-dragging{transition:none!important}.srh25-mini-open{min-width:0;width:100%;height:100%;display:grid;grid-template-columns:66px minmax(0,1fr);align-items:center;gap:10px;padding:7px;background:transparent;color:inherit;text-align:left}.srh25-mini-resume.is-compact .srh25-mini-open{grid-template-columns:54px minmax(0,1fr);gap:8px;padding:6px}.srh25-mini-thumb{position:relative;width:66px;height:68px;border-radius:12px;overflow:hidden;background:var(--surface,#111820)}.srh25-mini-resume.is-compact .srh25-mini-thumb{width:54px;height:56px}.srh25-mini-thumb img{width:100%;height:100%;display:block;object-fit:cover;background:var(--surface,#111820)}.srh25-mini-play{position:absolute;left:50%;top:50%;width:28px;height:28px;transform:translate(-50%,-50%);display:grid;place-items:center;border:1px solid rgba(255,255,255,.28);border-radius:50%;background:rgba(0,0,0,.52)}.srh25-mini-play svg{width:13px;height:13px;fill:none;stroke:#fff;stroke-width:2;stroke-linejoin:round}.srh25-mini-copy{min-width:0;display:block}.srh25-mini-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:800}.srh25-mini-resume.is-compact .srh25-mini-title{font-size:10px}.srh25-mini-episode{display:block;margin-top:4px;color:var(--muted,#929aa5);font-size:10px;font-weight:760}.srh25-mini-progress{display:block;height:3px;margin-top:8px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.12)}.srh25-mini-progress i{display:block;width:0;height:100%;border-radius:inherit;background:var(--accent,#d8dee7)}.srh25-mini-close{width:38px;height:100%;display:grid;place-items:center;background:transparent;color:var(--muted,#929aa5)}.srh25-mini-close svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.srh25-mini-resume.is-compact .srh25-mini-close{width:32px}.srh25-mini-resume.is-compact .srh25-mini-progress{margin-top:6px}.srh25-mini-resume.is-compact .srh25-mini-play{width:24px;height:24px}@media(min-width:800px){.srh25-mini-resume{left:18px;bottom:18px}}';
  document.head.appendChild(style)
}
function ensureMiniDock(){
  if(miniDock)return;
  ensureMiniStyles();
  miniDock=document.createElement('aside');
  miniDock.className='srh25-mini-resume is-hidden is-compact';
  miniDock.setAttribute('aria-label','Continuar episódio');
  miniDock.innerHTML='<button class="srh25-mini-open" type="button" aria-label="Retomar episódio"><span class="srh25-mini-thumb"><img alt="" draggable="false"><span class="srh25-mini-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg></span></span><span class="srh25-mini-copy"><strong class="srh25-mini-title"></strong><small class="srh25-mini-episode"></small><span class="srh25-mini-progress"><i></i></span></span></button><button class="srh25-mini-close" type="button" aria-label="Fechar miniatura"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
  document.body.appendChild(miniDock);
  miniOpen=miniDock.querySelector('.srh25-mini-open');
  miniImage=miniDock.querySelector('img');
  miniTitle=miniDock.querySelector('.srh25-mini-title');
  miniEpisode=miniDock.querySelector('.srh25-mini-episode');
  miniProgress=miniDock.querySelector('.srh25-mini-progress i');
  miniClose=miniDock.querySelector('.srh25-mini-close');
  miniOpen.addEventListener('click',()=>{
    if(miniSuppressOpen){miniSuppressOpen=false;return}
    const record=readMiniResume();if(!record)return;
    hideMiniResume();
    S.openPlayer(record.item,record)
  });
  miniClose.addEventListener('click',e=>{
    e.stopPropagation();
    const record=readMiniResume();
    if(record)miniWrite(MINI_DISMISS_KEY,record.updatedAt);
    hideMiniResume()
  });
  miniDock.addEventListener('pointerdown',startMiniDrag);
}
function miniViewport(){const v=window.visualViewport;return {width:Number(v?.width)||window.innerWidth,height:Number(v?.height)||window.innerHeight}}
function miniBounds(rect){
  const vp=miniViewport(),margin=12,top=12,bottom=Math.max(top,vp.height-rect.height-18);
  return {left:margin,right:Math.max(margin,vp.width-rect.width-margin),top,bottom,center:vp.width/2}
}
function readMiniPosition(){const p=miniRead(MINI_POS_KEY,{side:'left',y:1})||{};return {side:p.side==='right'?'right':'left',y:miniClamp(Number(p.y??1),0,1)}}
function placeMiniDock(){
  if(!miniDock||miniDock.classList.contains('is-hidden')||!miniDock.classList.contains('is-compact')||miniDrag)return;
  const rect=miniDock.getBoundingClientRect(),bounds=miniBounds(rect),p=readMiniPosition();
  const top=bounds.top+(bounds.bottom-bounds.top)*p.y;
  miniDock.style.bottom='auto';miniDock.style.top=top+'px';miniDock.style.left=(p.side==='right'?bounds.right:bounds.left)+'px';miniDock.style.transform=''
}
function pinMiniDock(){if(!miniDock)return;miniDock.style.transform='';miniDock.style.top='auto';miniDock.style.left='12px';miniDock.style.bottom='max(16px, env(safe-area-inset-bottom))'}
function compactMiniDock(){
  if(!miniDock||miniDock.classList.contains('is-hidden'))return;
  miniDock.classList.add('is-compact');
  const record=readMiniResume();if(record)miniTitle.textContent='Retomar';
  requestAnimationFrame(placeMiniDock)
}
function scheduleMiniExpiry(record){
  clearTimeout(miniExpiryTimer);miniExpiryTimer=0;
  if(!record)return;
  const remaining=MINI_TTL-(Date.now()-Number(record.updatedAt||0));
  if(remaining<=0){clearMiniResume();return}
  miniExpiryTimer=setTimeout(()=>clearMiniResume(),Math.min(remaining,2147483000))
}
function seedMiniFromHistory(){
  const existing=readMiniResume();
  if(existing)return existing;
  const history=[...(S.state.history?.length?S.state.history:S.readHistory())]
    .sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0));
  for(const h of history){
    const item=h?.item;
    if(!item)continue;
    const position=Math.max(0,Number(h.position)||0);
    const duration=Math.max(0,Number(h.duration)||0);
    if(duration>0&&duration-position<=30){
      S.hideContinue(item,'complete');
      continue
    }
    if(!S.isContinueVisible(item))continue;
    return saveMiniResume(item,position,duration)
  }
  return null
}
function renderMiniResume(expand=false){
  ensureMiniDock();
  const record=readMiniResume()||seedMiniFromHistory();
  if(!record){hideMiniResume();return}
  const dismissed=Number(miniRead(MINI_DISMISS_KEY,0)||0);
  if(dismissed&&dismissed===Number(record.updatedAt)){hideMiniResume();return}
  if(record.image&&miniImage.src!==record.image)miniImage.src=record.image;
  miniImage.alt=record.title||'Continuar';
  miniTitle.textContent=expand?(record.title||'Continuar'):'Retomar';
  miniEpisode.textContent=miniEpisodeLabel(record.position);
  miniProgress.style.width=(record.duration>0?miniClamp(record.position/record.duration,0,1)*100:0)+'%';
  miniDock.classList.remove('is-hidden');
  clearTimeout(miniCompactTimer);
  if(expand){
    miniDock.classList.remove('is-compact');pinMiniDock();
    miniCompactTimer=setTimeout(compactMiniDock,MINI_EXPANDED_MS)
  }else{
    miniDock.classList.add('is-compact');requestAnimationFrame(placeMiniDock)
  }
  scheduleMiniExpiry(record)
}
function startMiniDrag(event){
  if(!miniDock||miniDock.classList.contains('is-hidden')||!miniDock.classList.contains('is-compact'))return;
  if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||event.target.closest('.srh25-mini-close'))return;
  const rect=miniDock.getBoundingClientRect(),bounds=miniBounds(rect),startX=event.clientX,startY=event.clientY,shiftX=event.clientX-rect.left,shiftY=event.clientY-rect.top;
  const originLeft=rect.left,originTop=rect.top;let lastLeft=originLeft,lastTop=originTop,moved=false,finished=false;
  miniDrag={pointerId:event.pointerId};miniDock.classList.add('is-dragging');
  try{miniDock.setPointerCapture?.(event.pointerId)}catch{}
  const move=e=>{
    if(finished||e.pointerId!==event.pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;if(!moved&&Math.hypot(dx,dy)<4)return;
    moved=true;e.preventDefault();
    lastLeft=miniClamp(e.clientX-shiftX,bounds.left,bounds.right);
    lastTop=miniClamp(e.clientY-shiftY,bounds.top,bounds.bottom);
    miniDock.style.transform='translate3d('+(lastLeft-originLeft)+'px,'+(lastTop-originTop)+'px,0)'
  };
  const finish=e=>{
    if(finished||(Number.isFinite(e?.pointerId)&&e.pointerId!==event.pointerId))return;finished=true;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);
    try{if(miniDock.hasPointerCapture?.(event.pointerId))miniDock.releasePointerCapture(event.pointerId)}catch{}
    miniDrag=null;miniDock.classList.remove('is-dragging');
    if(!moved){miniDock.style.transform='';return}
    miniSuppressOpen=true;clearTimeout(miniSuppressTimer);miniSuppressTimer=setTimeout(()=>{miniSuppressOpen=false},220);
    const side=lastLeft+rect.width/2<=bounds.center?'left':'right';
    const top=miniClamp(lastTop,bounds.top,bounds.bottom),span=Math.max(1,bounds.bottom-bounds.top);
    miniWrite(MINI_POS_KEY,{side,y:miniClamp((top-bounds.top)/span,0,1)});
    miniDock.style.transform='';miniDock.style.bottom='auto';miniDock.style.top=top+'px';miniDock.style.left=(side==='right'?bounds.right:bounds.left)+'px'
  };
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish)
}
window.addEventListener('resize',()=>{if(miniDock&&!miniDock.classList.contains('is-hidden'))placeMiniDock()},{passive:true});


const PLAYER_UI_HIDE_MS=4000;
let playerUiTimer=0,centerControls=null,back10Button=null,playPauseButton=null,forward10Button=null;
let swipeState=null,playerExitBusy=false;

function playerEpisodeNumber(position=video.currentTime){
  return Math.max(1,Math.floor(Math.max(0,Number(position)||0)/120)+1)
}
function updatePlayerHeading(position=video.currentTime){
  const item=S.state.current?.item;
  const title=item?S.title(item):'';
  const titleNode=$('#playerTitle'),metaNode=$('#playerMeta');
  if(titleNode&&title)titleNode.textContent=title+' - EP'+playerEpisodeNumber(position);
  if(metaNode){metaNode.textContent='';metaNode.style.display='none'}
}
function clearPlayerUiTimer(){clearTimeout(playerUiTimer);playerUiTimer=0}
function hidePlayerControls(){
  clearPlayerUiTimer();
  if(player.classList.contains('is-hidden')||video.paused||!arcDrawer.classList.contains('is-hidden'))return;
  player.classList.remove('controls-visible')
}
function schedulePlayerControlsHide(delay=PLAYER_UI_HIDE_MS){
  clearPlayerUiTimer();
  if(player.classList.contains('is-hidden')||video.paused)return;
  playerUiTimer=setTimeout(hidePlayerControls,delay)
}
function showPlayerControls(autoHide=true){
  ensurePlayerControls();
  player.classList.add('controls-visible');
  if(autoHide)schedulePlayerControlsHide();else clearPlayerUiTimer()
}
function syncPlayPauseButton(){
  if(!playPauseButton)return;
  const paused=video.paused;
  playPauseButton.setAttribute('aria-label',paused?'Reproduzir':'Pausar');
  playPauseButton.innerHTML=paused
    ?'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>'
    :'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'
}
function seekPlayer(delta){
  const duration=Number(video.duration),current=Number(video.currentTime)||0;
  const max=Number.isFinite(duration)&&duration>0?Math.max(0,duration-.05):Math.max(0,current+delta);
  video.currentTime=Math.max(0,Math.min(max,current+delta));
  updatePlayerHeading(video.currentTime);
  persistCurrentProgress(true);
  showPlayerControls(true)
}
function toggleCenterPlayback(){
  if(video.paused)video.play().catch(()=>{});
  else video.pause();
  syncPlayPauseButton();
  showPlayerControls(video.paused?false:true)
}
function ensurePlayerControls(){
  if(centerControls)return;
  if(!document.getElementById('srh25PlayerControlsStyle')){
    const style=document.createElement('style');
    style.id='srh25PlayerControlsStyle';
    style.textContent='.srh25-player{will-change:transform,opacity}.srh25-player__close,.srh25-player__rail,.srh25-player__info,.srh25-player__center-controls,.srh25-player__shade{transition:opacity .18s ease}.srh25-player:not(.controls-visible) .srh25-player__close,.srh25-player:not(.controls-visible) .srh25-player__rail,.srh25-player:not(.controls-visible) .srh25-player__info,.srh25-player:not(.controls-visible) .srh25-player__center-controls,.srh25-player:not(.controls-visible) .srh25-player__shade{opacity:0;pointer-events:none}.srh25-player__meta{display:none!important}.srh25-player__center-controls{position:absolute;z-index:10;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:18px}.srh25-player__transport{width:56px;height:56px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(8,11,15,.64);color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.28);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.srh25-player__transport--main{width:68px;height:68px;background:rgba(8,11,15,.74)}.srh25-player__transport svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.srh25-player__transport--main svg{width:30px;height:30px}.srh25-player__seek-label{font-size:12px;font-weight:850}.srh25-player.is-swiping{transition:none!important}.srh25-player.is-swipe-return{transition:transform .20s cubic-bezier(.22,1,.36,1),opacity .20s ease}.srh25-player.is-swipe-exit{transition:transform .24s cubic-bezier(.22,1,.36,1),opacity .22s ease}@media(max-width:420px){.srh25-player__center-controls{gap:14px}.srh25-player__transport{width:52px;height:52px}.srh25-player__transport--main{width:64px;height:64px}}';
    document.head.appendChild(style)
  }
  centerControls=document.createElement('div');
  centerControls.className='srh25-player__center-controls';
  centerControls.setAttribute('aria-label','Controles de reprodução');
  centerControls.innerHTML='<button class="srh25-player__transport" id="playerBack10" type="button" aria-label="Voltar 10 segundos"><span class="srh25-player__seek-label">-10</span></button><button class="srh25-player__transport srh25-player__transport--main" id="playerPlayPause" type="button" aria-label="Reproduzir"></button><button class="srh25-player__transport" id="playerForward10" type="button" aria-label="Avançar 10 segundos"><span class="srh25-player__seek-label">+10</span></button>';
  $('#playerStage')?.appendChild(centerControls);
  back10Button=$('#playerBack10');
  playPauseButton=$('#playerPlayPause');
  forward10Button=$('#playerForward10');
  back10Button.onclick=e=>{e.stopPropagation();seekPlayer(-10)};
  playPauseButton.onclick=e=>{e.stopPropagation();toggleCenterPlayback()};
  forward10Button.onclick=e=>{e.stopPropagation();seekPlayer(10)};
  centerControls.addEventListener('pointerdown',e=>e.stopPropagation());
  syncPlayPauseButton()
}

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
function finishPlayerExit(){
  const cur=S.state.current,pos=Math.max(0,Number(video.currentTime)||0),dur=Math.max(0,Number(video.duration)||0);
  if(cur){
    S.saveProgress(cur.item,pos,dur);
    saveMiniResume(cur.item,pos,dur)
  }
  clearPlayerUiTimer();
  closeArcs();
  destroyHls();
  video.pause();
  video.removeAttribute('src');
  video.load();
  S.state.current=null;
  player.classList.add('is-hidden');
  player.classList.remove('controls-visible','is-swiping','is-swipe-return','is-swipe-exit');
  player.style.transform='';
  player.style.opacity='';
  playerExitBusy=false;
  renderMiniResume(true)
}
function exitPlayer({animate=false}={}){
  if(playerExitBusy||player.classList.contains('is-hidden'))return;
  playerExitBusy=true;
  if(!animate){finishPlayerExit();return}
  player.classList.remove('is-swiping','is-swipe-return');
  player.classList.add('is-swipe-exit');
  player.style.transform='translate3d(100vw,0,0)';
  player.style.opacity='0';
  setTimeout(finishPlayerExit,245)
}
function stop(){exitPlayer({animate:false})}
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
S.openPlayer=(item,resumeOverride)=>{
  ensurePlayerControls();
  destroyHls();
  const hist=resumeOverride&&Number(resumeOverride.position)>=0?resumeOverride:S.historyFor(item);
  const startPosition=Math.max(0,Number(hist?.position)||0),startDuration=Math.max(0,Number(hist?.duration)||0);
  S.restoreContinue(item);
  S.saveProgress(item,startPosition,startDuration);
  saveMiniResume(item,startPosition,startDuration);
  S.state.current={item};
  lastSavedPosition=startPosition;
  activeArc=-1;
  hideMiniResume();
  player.classList.remove('is-hidden','is-swiping','is-swipe-return','is-swipe-exit');
  player.style.transform='';
  player.style.opacity='';
  player.classList.add('controls-visible');
  applyFitMode();
  poster.classList.remove('is-hidden');
  loading.classList.remove('is-hidden');
  poster.src=S.image(item)||'';
  updatePlayerHeading(startPosition);
  $('#playerFavorite').classList.toggle('is-active',S.state.favorites.has(S.id(item)));
  closeArcs();
  syncPlayPauseButton();
  loadVideo(item,hist)
};
function persistCurrentProgress(force=false){const cur=S.state.current,pos=Math.max(0,Number(video.currentTime)||0);if(!cur)return false;if(!force&&Math.abs(pos-lastSavedPosition)<10)return false;const ok=S.saveProgress(cur.item,pos,video.duration);if(ok){lastSavedPosition=pos;saveMiniResume(cur.item,pos,video.duration)}return ok}
video.ontimeupdate=()=>{
  const cur=S.state.current,pos=Number(video.currentTime||0),dur=Number(video.duration||0);
  updatePlayerHeading(pos);
  if(cur&&Number.isFinite(dur)&&dur>0&&Number.isFinite(pos)&&dur-pos<=30)S.hideContinue(cur.item,'complete');
  persistCurrentProgress(false);
  syncArcSelection(false)
};
video.onplay=()=>{syncPlayPauseButton();showPlayerControls(true)};
video.onplaying=()=>{syncPlayPauseButton();setTimeout(()=>{if(!video.paused)hidePlayerControls()},650)};
video.onpause=()=>{syncPlayPauseButton();if(!video.ended){persistCurrentProgress(true);showPlayerControls(false)}};
video.onended=()=>{if(S.state.current){S.saveProgress(S.state.current.item,video.currentTime,video.duration);S.hideContinue(S.state.current.item,'complete');clearMiniResume(S.state.current.item)}lastSavedPosition=0;hideMiniResume()};
$('#playerClose').onclick=stop;$('#playerFavorite').onclick=setFavorite;
$('#playerArcs').onclick=()=>{if(arcDrawer.classList.contains('is-hidden')){showPlayerControls(false);openArcs()}else{closeArcs();schedulePlayerControlsHide()}};
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
$('#playerStage').addEventListener('pointerdown',e=>{
  if(playerExitBusy||e.isPrimary===false||e.target.closest?.('button,.srh25-arcs'))return;
  startX=e.clientX;startY=e.clientY;
  swipeState={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,dx:0,active:false};
  try{$('#playerStage').setPointerCapture?.(e.pointerId)}catch{}
},{passive:true});
$('#playerStage').addEventListener('pointermove',e=>{
  const s=swipeState;if(!s||s.pointerId!==e.pointerId||playerExitBusy)return;
  const dx=Math.max(0,e.clientX-s.startX),dy=e.clientY-s.startY;
  if(!s.active){
    if(dx<8)return;
    if(dx<Math.abs(dy)*1.15){swipeState=null;return}
    s.active=true;
    clearPlayerUiTimer();
    player.classList.add('is-swiping');
    player.classList.remove('is-swipe-return')
  }
  s.dx=dx;
  e.preventDefault();
  const width=Math.max(1,window.innerWidth);
  player.style.transform='translate3d('+dx+'px,0,0)';
  player.style.opacity=String(Math.max(.35,1-(dx/width)*.58))
},{passive:false});
const finishPlayerSwipe=e=>{
  const s=swipeState;if(!s||(Number.isFinite(e?.pointerId)&&s.pointerId!==e.pointerId))return;
  swipeState=null;
  try{if($('#playerStage').hasPointerCapture?.(s.pointerId))$('#playerStage').releasePointerCapture(s.pointerId)}catch{}
  if(!s.active){
    if(player.classList.contains('controls-visible'))hidePlayerControls();else showPlayerControls(true);
    return
  }
  const threshold=Math.max(90,window.innerWidth*.22);
  if(s.dx>=threshold){
    exitPlayer({animate:true});
    return
  }
  player.classList.remove('is-swiping');
  player.classList.add('is-swipe-return');
  player.style.transform='translate3d(0,0,0)';
  player.style.opacity='1';
  setTimeout(()=>{player.classList.remove('is-swipe-return');player.style.transform='';player.style.opacity='';schedulePlayerControlsHide()},205)
};
$('#playerStage').addEventListener('pointerup',finishPlayerSwipe,{passive:true});
$('#playerStage').addEventListener('pointercancel',finishPlayerSwipe,{passive:true});
window.addEventListener('pagehide',()=>{if(S.state.current){S.saveProgress(S.state.current.item,video.currentTime,video.duration);saveMiniResume(S.state.current.item,video.currentTime,video.duration)}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S.state.current)saveMiniResume(S.state.current.item,video.currentTime,video.duration)});
window.addEventListener('srh25:ready',()=>{ensurePlayerControls();renderMiniResume(false)},{once:true});
Promise.resolve().then(()=>S.boot());
})();
})();
