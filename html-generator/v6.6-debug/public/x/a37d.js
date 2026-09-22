(()=>{const z=window.__srhA;if(!z||z.k!=="e4c98a71"||z.m!=="h"||!Object.isFrozen(z)||typeof z.u!=='function'||typeof z.t!=='function')return;(()=>{'use strict';
const BASE_CONFIG=JSON.parse(document.getElementById('app-config').textContent);
const $=s=>document.querySelector(s);
const clean=s=>String(s??'').trim();
const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const runtimeKey='srh25:'+APP_NS+':runtime:v1';
function readRuntimeLegacy(){try{const x=JSON.parse(localStorage.getItem(runtimeKey)||'null');return x&&typeof x==='object'?x:null}catch{return null}}
const cfg={...BASE_CONFIG,...(readRuntimeLegacy()||{})};
const S={cfg,baseConfig:BASE_CONFIG,runtimeKey,state:{items:[],filtered:[],history:[],favorites:new Set(),pool:null,poolPromise:null,proxy:null,proxyChoice:null,hls:null,current:null,requests:new Map()},$};
window.SRH25=S;
const RUNTIME_DB='srh25-runtime-v2',RUNTIME_STORE='state';let runtimeDbPromise=null,runtimeWriteTail=Promise.resolve(),runtimeQueued=0,runtimeDone=0;
function runtimeDbOpen(){if(runtimeDbPromise)return runtimeDbPromise;runtimeDbPromise=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('IndexedDB indisponível'));return}let q;try{q=indexedDB.open(RUNTIME_DB,1)}catch(e){runtimeDbPromise=null;reject(e);return}q.onupgradeneeded=()=>{try{if(!q.result.objectStoreNames.contains(RUNTIME_STORE))q.result.createObjectStore(RUNTIME_STORE)}catch{}};q.onsuccess=()=>{const db=q.result;db.onversionchange=()=>{try{db.close()}catch{}runtimeDbPromise=null};resolve(db)};q.onerror=()=>{runtimeDbPromise=null;reject(q.error||new Error('IndexedDB falhou'))};q.onblocked=()=>{}});return runtimeDbPromise}
async function runtimeDbGet(key){const db=await runtimeDbOpen();return await new Promise((resolve,reject)=>{let tx,r;try{tx=db.transaction(RUNTIME_STORE,'readonly');r=tx.objectStore(RUNTIME_STORE).get(key)}catch(e){reject(e);return}r.onsuccess=()=>resolve(r.result==null?null:r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB leitura falhou'))})}
async function runtimeDbWriteRaw(key,value,remove=false){const db=await runtimeDbOpen();return await new Promise((resolve,reject)=>{let tx;try{tx=db.transaction(RUNTIME_STORE,'readwrite');const os=tx.objectStore(RUNTIME_STORE);remove?os.delete(key):os.put(value,key)}catch(e){reject(e);return}tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error('IndexedDB escrita falhou'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB escrita abortada'))})}
function runtimeWriteLock(task){runtimeQueued++;const run=async()=>{try{if(navigator.locks?.request)return await navigator.locks.request('srh25-runtime:'+APP_NS,{mode:'exclusive'},task);return await task()}finally{runtimeDone++}};const next=runtimeWriteTail.catch(()=>{}).then(run);runtimeWriteTail=next.catch(()=>{});return next}
S.storage={backend:'indexeddb',db:RUNTIME_DB,get:key=>runtimeDbGet(key),set:(key,value)=>runtimeWriteLock(()=>runtimeDbWriteRaw(key,value,false)),delete:key=>runtimeWriteLock(()=>runtimeDbWriteRaw(key,null,true)),open:runtimeDbOpen,stats:()=>({backend:'indexeddb',db:RUNTIME_DB,connection:runtimeDbPromise?'open/pending':'closed',queuedWrites:Math.max(0,runtimeQueued-runtimeDone),writesQueued:runtimeQueued,writesDone:runtimeDone,webLocks:!!navigator.locks?.request})};
S.hydrateRuntime=async()=>{const legacy=readRuntimeLegacy();let stored=null;try{stored=await S.storage.get(runtimeKey)}catch{}if(!stored&&legacy){try{await S.storage.set(runtimeKey,legacy);stored=legacy;try{localStorage.removeItem(runtimeKey)}catch{}}catch{stored=legacy}}if(stored&&typeof stored==='object')Object.assign(cfg,stored);return stored};
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
S.saveRuntime=async runtime=>{if(!runtime||typeof runtime!=='object')throw new Error('Runtime inválido');await S.storage.set(runtimeKey,runtime);Object.assign(cfg,runtime);try{localStorage.removeItem(runtimeKey)}catch{}return true};
function parseJson(t){let s=String(t??'').replace(/^\uFEFF/,'').trim();try{return JSON.parse(s)}catch{}const a=s.indexOf('{'),b=s.indexOf('['),i=a<0?b:b<0?a:Math.min(a,b);if(i>=0){const j=s.lastIndexOf(s[i]==='{'?'}':']');if(j>i)return JSON.parse(s.slice(i,j+1))}throw new Error('Resposta inválida')}
async function fetchText(url,timeout=5000,options={}){const c=new AbortController(),relay=()=>{try{c.abort(options.signal?.reason||'superseded')}catch{c.abort()}},t=setTimeout(()=>{try{c.abort('timeout')}catch{c.abort()}},timeout);if(options.signal){if(options.signal.aborted)relay();else options.signal.addEventListener('abort',relay,{once:true})}try{const r=await fetch(url,{cache:'no-cache',redirect:'follow',credentials:'omit',signal:c.signal,srhProbe:options.probe===true});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(t);try{options.signal?.removeEventListener('abort',relay)}catch{}}}
function transportDelay(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(signal.reason||new DOMException('Aborted','AbortError'));return}const t=setTimeout(done,ms);function done(){cleanup();resolve()}function abort(){cleanup();reject(signal.reason||new DOMException('Aborted','AbortError'))}function cleanup(){clearTimeout(t);try{signal?.removeEventListener('abort',abort)}catch{}}try{signal?.addEventListener('abort',abort,{once:true})}catch{}})}
async function firstJsonResponse(urls,timeout,options={}){const list=[...new Set((urls||[]).filter(Boolean))],ctrls=list.map(()=>new AbortController()),relay=()=>{for(const c of ctrls)if(!c.signal.aborted)try{c.abort(options.signal?.reason||'route-lost')}catch{c.abort()}};if(options.signal){if(options.signal.aborted)relay();else options.signal.addEventListener('abort',relay,{once:true})}try{return await Promise.any(list.map((u,i)=>fetchText(u,timeout,{probe:true,signal:ctrls[i].signal}).then(parseJson)))}finally{try{options.signal?.removeEventListener('abort',relay)}catch{}relay()}}
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
const proxyMemory=new Map();function proxyLegacyRead(source=cfg){try{return JSON.parse(localStorage.getItem(proxyKey(source))||'null')}catch{return null}}
function readProxy(source=cfg){const k=proxyKey(source);return proxyMemory.get(k)||proxyLegacyRead(source)}
function saveProxy(x,source=cfg){const k=proxyKey(source),value={...x,at:Date.now()};proxyMemory.set(k,value);void S.storage?.set(k,value).catch(()=>{});return value}
function clearProxy(source=cfg){const k=proxyKey(source);proxyMemory.delete(k);void S.storage?.delete(k).catch(()=>{});try{localStorage.removeItem(k)}catch{}}
S.hydrateProxy=async(source=cfg)=>{const k=proxyKey(source),legacy=proxyLegacyRead(source);let saved=null;try{saved=await S.storage?.get(k)}catch{}if(!saved&&legacy){saved=legacy;try{await S.storage?.set(k,legacy);localStorage.removeItem(k)}catch{}}if(saved)proxyMemory.set(k,saved);return saved};
async function chooseProxy(target,source=cfg,options={}){
  const pool=(await loadPool()).slice(0,4),saved=readProxy(source),rows=[],seen=new Set();
  const add=(template,id,label)=>{template=clean(template);if(!template||seen.has(template))return;seen.add(template);rows.push({template,id:id||'',label})};
  add(source.corsProxy,'configured','configured-proxy');
  if(saved?.template)add(saved.template,saved.id||'saved','saved-proxy');
  for(const p of pool)add(p.template,p.id||'', 'pool-proxy');
  if(!rows.length)throw new Error('Nenhum proxy CORS disponível');
  const ctrls=rows.map(()=>new AbortController()),outer=options.signal,relay=()=>{for(const c of ctrls)if(!c.signal.aborted)try{c.abort(outer?.reason||'proxy-lost')}catch{c.abort()}};
  if(outer){if(outer.aborted)relay();else outer.addEventListener('abort',relay,{once:true})}
  const started=performance.now(),timeout=Number(options.timeout)||18000;
  try{
    const winner=await Promise.any(rows.map(async(row,i)=>{
      if(i)await transportDelay(Math.min(900,i*250),ctrls[i].signal);
      const data=parseJson(await fetchText(proxyUrl(row.template,target),timeout,{signal:ctrls[i].signal}));
      return{data,route:row.label,template:row.template,id:row.id,ms:Math.round(performance.now()-started)}
    }));
    saveProxy({template:winner.template,id:winner.id,uses:Number(saved?.uses||0)+1,lastMs:winner.ms,lastRoute:winner.route},source);
    return winner
  }catch{throw new Error('Nenhum proxy CORS respondeu')}
  finally{try{outer?.removeEventListener('abort',relay)}catch{}relay()}
}
function requestFor(params={},source=cfg){
  const target=apiUrl(params,source),key=target,action=String(params?.action||''),categoryId=String(params?.category_id||''),directTimeout=action==='get_vod_streams'?9000:4200,proxyTimeout=action==='get_vod_streams'?18000:14000;
  if(S.state.requests.has(key))return S.state.requests.get(key);
  const job=(async()=>{
    const started=performance.now(),directCtrl=new AbortController(),proxyCtrl=new AbortController(),candidates=[target,httpsTwin(target)].filter(Boolean),useProxy=!!source.corsProxy||source.autoCorsProxy!==false;
    const tasks=[];
    if(candidates.length)tasks.push(firstJsonResponse(candidates,directTimeout,{signal:directCtrl.signal}).then(data=>({data,route:'direct'})));
    if(useProxy)tasks.push((async()=>{if(location.protocol!=='file:')await transportDelay(700,proxyCtrl.signal);return await chooseProxy(target,source,{timeout:proxyTimeout,signal:proxyCtrl.signal})})());
    try{
      const winner=await Promise.any(tasks);
      if(!directCtrl.signal.aborted)try{directCtrl.abort('transport-won')}catch{}
      if(!proxyCtrl.signal.aborted)try{proxyCtrl.abort('transport-won')}catch{}
      const detail={route:winner.route||'unknown',action,categoryId,ms:Math.round(performance.now()-started)};
      S.state.lastTransport=detail;window.dispatchEvent(new CustomEvent('srh25:transport',{detail}));
      return winner.data
    }catch(e){
      if(!directCtrl.signal.aborted)try{directCtrl.abort('transport-failed')}catch{}
      if(!proxyCtrl.signal.aborted)try{proxyCtrl.abort('transport-failed')}catch{}
      throw e?.errors?.at?.(-1)||e||new Error('Falha de conexão')
    }
  })();
  S.state.requests.set(key,job);
  job.then(()=>S.state.requests.delete(key),()=>S.state.requests.delete(key));
  return job
}
S.request=params=>requestFor(params,cfg);
S.requestWithConfig=(params,source)=>requestFor(params,{...cfg,...source});
S.coverProxyCandidates=url=>{const out=[url];try{if(cfg.corsProxy)out.push(proxyUrl(cfg.corsProxy,url));const saved=readProxy(cfg);if(saved?.template)out.push(proxyUrl(saved.template,url))}catch{}return[...new Set(out.filter(Boolean))]};
const ns=APP_NS;
const favKey='srh25:'+ns+':favorites',histKey='srh25:'+ns+':history',continueHiddenKey='srh25:'+ns+':continue-hidden:v1';
let continueHiddenMemory={};
function normalizeContinueHidden(map){
  const rows=Object.entries(map&&typeof map==='object'&&!Array.isArray(map)?map:{})
    .filter(([id,v])=>id&&v&&typeof v==='object')
    .sort((a,b)=>Number(b[1]?.at||0)-Number(a[1]?.at||0))
    .slice(0,200);
  return Object.fromEntries(rows)
}
function continueHiddenLocalRead(){
  try{
    const x=JSON.parse(localStorage.getItem(continueHiddenKey)||'{}');
    return normalizeContinueHidden(x)
  }catch{return{}}
}
function continueHiddenLocalWrite(map){
  try{localStorage.setItem(continueHiddenKey,JSON.stringify(normalizeContinueHidden(map)));return true}catch{return false}
}
async function continueHiddenDbRead(){
  try{
    const db=await historyDbOpen();
    return await new Promise(resolve=>{
      let tx,r;
      try{tx=db.transaction(HISTORY_STORE,'readonly');r=tx.objectStore(HISTORY_STORE).get(continueHiddenKey)}
      catch{resolve({});return}
      r.onsuccess=()=>resolve(normalizeContinueHidden(r.result));
      r.onerror=()=>resolve({})
    })
  }catch{return{}}
}
async function continueHiddenDbWrite(map){
  try{
    const db=await historyDbOpen(),value=normalizeContinueHidden(map);
    await new Promise(resolve=>{
      let tx;
      try{tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).put(value,continueHiddenKey)}
      catch{resolve();return}
      tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()
    });
    return true
  }catch{return false}
}
function mergeContinueHidden(a,b){
  const out={};
  for(const source of [a,b]){
    for(const [id,v] of Object.entries(source||{})){
      const prev=out[id];
      if(!prev||Number(v?.at||0)>=Number(prev?.at||0))out[id]=v
    }
  }
  return normalizeContinueHidden(out)
}
S.readContinueHidden=()=>normalizeContinueHidden(continueHiddenMemory);
S.writeContinueHidden=map=>{
  const value=normalizeContinueHidden(map);
  continueHiddenMemory=value;
  void continueHiddenDbWrite(value);
  return true
};
S.hydrateContinueHidden=async()=>{
  const local=continueHiddenLocalRead(),db=await continueHiddenDbRead();
  continueHiddenMemory=mergeContinueHidden(local,db);
  void continueHiddenDbWrite(continueHiddenMemory);
  try{localStorage.removeItem(continueHiddenKey)}catch{}
  return continueHiddenMemory
};
S.continueHiddenReason=item=>S.readContinueHidden()[S.id(item)]?.reason||'';
S.hideContinue=(item,reason='manual')=>{
  const id=S.id(item);if(!id)return false;
  const map=S.readContinueHidden();
  map[id]={reason,at:Date.now()};
  S.writeContinueHidden(map);
  S.refreshLibraryView?.();
  return true
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
S.reconcileContinueHidden=()=>{
  const map=S.readContinueHidden(),history=S.readHistory(),byId=new Map(history.map(h=>[String(h?.id||''),h]));
  let changed=false;
  for(const id of Object.keys(map)){
    const mark=map[id];
    if(mark?.reason!=='complete')continue;
    const h=byId.get(String(id));
    const pos=Number(h?.position||0),dur=Number(h?.duration||0);
    if(!h||!Number.isFinite(dur)||dur<60||!Number.isFinite(pos)||dur-pos>30){
      delete map[id];changed=true
    }
  }
  if(changed)S.writeContinueHidden(map);
  return changed
};
let favoritesMemory=new Set();function favoritesLegacyRead(){try{return JSON.parse(localStorage.getItem(favKey)||'[]').map(String)}catch{return[]}}
S.readFavorites=()=>new Set(favoritesMemory);
S.writeFavorites=set=>{favoritesMemory=new Set([...set].map(String));void S.storage?.set(favKey,[...favoritesMemory]).catch(()=>{});return true};
S.hydrateFavorites=async()=>{const legacy=favoritesLegacyRead();let db=null;try{db=await S.storage?.get(favKey)}catch{}const rows=Array.isArray(db)?db:legacy;favoritesMemory=new Set(rows.map(String));if(!db&&legacy.length)try{await S.storage?.set(favKey,legacy);localStorage.removeItem(favKey)}catch{}return new Set(favoritesMemory)};

let historyMemory=[];
const HISTORY_DB='srh25-history-v1',HISTORY_STORE='state';
function historyNormalize(list){
  const out=[],seen=new Set();
  for(const row of Array.isArray(list)?list:[]){
    const id=String(row?.id||'');if(!id||seen.has(id))continue;
    seen.add(id);out.push(row)
  }
  out.sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0));
  return out.slice(0,80)
}
function historyMerge(a,b){return historyNormalize([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])])}
function historySnapshot(item){
  return {
    stream_id:item?.stream_id,
    id:item?.id,
    movie_id:item?.movie_id,
    name:item?.name,
    title:item?.title,
    stream_icon:item?.stream_icon,
    movie_image:item?.movie_image,
    cover:item?.cover,
    cover_big:item?.cover_big,
    backdrop_path:item?.backdrop_path,
    container_extension:item?.container_extension
  }
}
function historyTitleKey(value){
  let s=String(value||'').trim().toLocaleLowerCase('pt-BR');
  try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch{}
  return s.replace(/[^a-z0-9]+/g,' ').trim()
}
S.reconcileHistoryWithCatalog=items=>{
  const catalog=Array.isArray(items)?items.filter(Boolean):[];
  if(!catalog.length||!S.state.history?.length)return false;

  const byId=new Map();
  const byTitle=new Map();
  for(const item of catalog){
    const id=S.id(item);
    if(id)byId.set(String(id),item);
    const key=historyTitleKey(S.title(item));
    if(!key)continue;
    const rows=byTitle.get(key)||[];
    rows.push(item);byTitle.set(key,rows)
  }

  let changed=false;
  const repaired=[];
  for(const h of S.state.history){
    let current=byId.get(String(h?.id||''))||null;
    if(!current){
      const key=historyTitleKey(h?.title||S.title(h?.item));
      const matches=key?byTitle.get(key)||[]:[];
      if(matches.length===1)current=matches[0]
    }

    if(!current){repaired.push(h);continue}

    const nextId=S.id(current);
    const next={
      ...h,
      id:nextId,
      title:S.title(current),
      image:S.image(current),
      item:historySnapshot(current)
    };

    const oldStream=String(h?.item?.stream_id??h?.item?.id??h?.item?.movie_id??'');
    const newStream=String(current?.stream_id??current?.id??current?.movie_id??'');
    const oldExt=String(h?.item?.container_extension||'');
    const newExt=String(current?.container_extension||'');
    if(String(h?.id||'')!==String(nextId)||oldStream!==newStream||oldExt!==newExt||h?.title!==next.title)changed=true;
    repaired.push(next)
  }

  if(!changed)return false;

  S.state.history=historyNormalize(repaired);
  historyMemory=S.state.history.slice();
  void historyDbWrite(S.state.history);
  return true
};
let historyDbPromise=null;function historyDbOpen(){
  if(historyDbPromise)return historyDbPromise;
  historyDbPromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB indisponível'));return}
    let q;try{q=indexedDB.open(HISTORY_DB,1)}catch(e){historyDbPromise=null;reject(e);return}
    q.onupgradeneeded=()=>{try{if(!q.result.objectStoreNames.contains(HISTORY_STORE))q.result.createObjectStore(HISTORY_STORE)}catch{}};
    q.onsuccess=()=>{const db=q.result;db.onversionchange=()=>{try{db.close()}catch{}historyDbPromise=null};resolve(db)};q.onerror=()=>{historyDbPromise=null;reject(q.error||new Error('IndexedDB falhou'))}
  });return historyDbPromise
}
S.historyDbOpen=historyDbOpen;
function providerIdentity(value){let raw=String(value||'').trim();if(!raw)return'';if(!/^https?:\/\//i.test(raw))raw='http://'+raw;try{return String(new URL(raw).hostname||'').toLowerCase().replace(/\.$/,'')}catch{return String(value||'').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0].split(':')[0].replace(/\.$/,'')}}
S.providerIdentity=providerIdentity;
S.clearProviderState=async(oldSource,newSource)=>{const from=providerIdentity(oldSource?.server),to=providerIdentity(newSource?.server),changed=!!from&&!!to&&from!==to;if(!changed)return{changed:false,from,to,cleared:0};const miniBase='srh25:'+APP_NS,historyKeys=[histKey,continueHiddenKey,miniBase+':mini-resume:v1',miniBase+':mini-resume-dismissed:v1',miniBase+':mini-resume-position:v2',miniBase+':mini-resume-position:v1'];let cleared=0;try{await S.storage?.delete(favKey);cleared++}catch{}try{clearProxy(oldSource||cfg);cleared++}catch{}try{const db=await historyDbOpen();await new Promise(resolve=>{let tx;try{tx=db.transaction(HISTORY_STORE,'readwrite');const os=tx.objectStore(HISTORY_STORE);for(const key of historyKeys)os.delete(key)}catch{resolve();return}tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()});cleared+=historyKeys.length}catch{}for(const key of [favKey,...historyKeys])try{localStorage.removeItem(key)}catch{}favoritesMemory=new Set();historyMemory=[];continueHiddenMemory={};S.state.favorites=new Set();S.state.history=[];const detail={changed:true,from,to,cleared};try{window.SRHDebug?.log('warn','storage.provider_switch',detail)}catch{}try{window.dispatchEvent(new CustomEvent('srh25:provider-switch',{detail}))}catch{}return detail};
async function historyDbRead(){
  try{
    const db=await historyDbOpen();
    return await new Promise(resolve=>{
      let tx,r;try{tx=db.transaction(HISTORY_STORE,'readonly');r=tx.objectStore(HISTORY_STORE).get(histKey)}
      catch{resolve([]);return}
      r.onsuccess=()=>resolve(Array.isArray(r.result)?r.result:[]);
      r.onerror=()=>resolve([])
    })
  }catch{return[]}
}
async function historyDbWrite(list){
  try{
    const db=await historyDbOpen();
    const rows=historyNormalize(list);
    await new Promise(resolve=>{
      let tx;try{tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).put(rows,histKey)}
      catch{resolve();return}
      tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()
    });
    return true
  }catch{return false}
}
function historyLocalRead(){
  try{const x=JSON.parse(localStorage.getItem(histKey)||'[]');return Array.isArray(x)?x:[]}catch{return[]}
}
function historyLocalWrite(rows){
  try{localStorage.setItem(histKey,JSON.stringify(rows));return true}catch{return false}
}
S.readHistory=()=>historyMemory.slice();
S.writeHistory=list=>{
  const rows=historyNormalize(list);
  historyMemory=rows;
  void historyDbWrite(rows);
  return true
};
S.hydrateHistory=async()=>{
  const local=historyLocalRead(),db=await historyDbRead();
  historyMemory=historyMerge(local,db);
  void historyDbWrite(historyMemory);
  try{localStorage.removeItem(histKey)}catch{}
  return historyMemory.slice()
};
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
  const id=S.id(item);if(!id)return false;
  const safeDuration=Number.isFinite(duration)&&duration>0?duration:0;
  const record={id,title:S.title(item),image:S.image(item),position,duration:safeDuration,updatedAt:Date.now(),item:historySnapshot(item)};
  const list=S.readHistory().filter(x=>String(x?.id)!==id);
  list.unshift(record);
  S.writeHistory(list);
  S.state.history=S.readHistory();
  if(!S.state.history.some(x=>String(x?.id)===id)){
    S.state.history=historyNormalize([record,...S.state.history]);
    historyMemory=S.state.history.slice();
    void historyDbWrite(S.state.history)
  }
  S.refreshLibraryView?.();
  return S.state.history.some(x=>String(x?.id)===id)
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
S.boot=async()=>{await S.hydrateRuntime?.();await S.hydrateProxy?.();document.body.dataset.theme=cfg.theme||'graphene';$('#appTitle').textContent=cfg.appName||'Meu App';S.lockZoom();S.state.favorites=await S.hydrateFavorites?.()||S.readFavorites();S.state.history=await S.hydrateHistory();await S.hydrateContinueHidden?.();if(S.hydrateMiniUiState)await S.hydrateMiniUiState();S.reconcileContinueHidden?.();S.bindShell?.();await S.loadCatalog?.();window.dispatchEvent(new Event('srh25:ready'));setTimeout(()=>S.account(),0)};
})();
(()=>{'use strict';const S=window.SRH25,$=S.$;
const BATCH=30,CACHE_MAX_AGE=6*60*60*1000;let shown=0,observer=null,imgObserver=null,activeLibrary=null,updateCandidate=null,updateCategories=[],updateSelected=new Set();
function cleanName(s){return String(s||'').replace(/[\uFE0F\u200D]/g,'').trim()}
function normName(s){return cleanName(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim()}
function mergeUnique(base,extra){const seen=new Set(),out=[];for(const item of [...(base||[]),...(extra||[])]){const id=S.id(item);if(!id||seen.has(id))continue;seen.add(id);out.push(item)}return out}
function interleaveGroups(groups){const rows=(groups||[]).map(x=>Array.isArray(x)?x:[]),seen=new Set(),out=[],pos=rows.map(()=>0);let added=true;while(added){added=false;for(let r=0;r<rows.length;r++){const row=rows[r];while(pos[r]<row.length){const item=row[pos[r]++],id=S.id(item);if(!id||seen.has(id))continue;seen.add(id);out.push(item);added=true;break}}}return out}
const CATEGORY_MERGE_VERSION='balanced-v1';
const cacheTargetKey=(S.cfg.targets||[]).filter(t=>t.type==='vod').map(t=>String(t.id??t.category_id??t.name??'')).join(',');
const cacheKey='catalog:v2mix:'+(S.cfg.appId||S.cfg.appName||'app')+':'+cacheTargetKey;
const CATALOG_DB_VERSION=2,CATALOG_CHUNK=100;let catalogDbPromise=null,catalogWriteTail=Promise.resolve(),progressiveCacheTimer=0,progressiveCachePending=null;function openCache(){if(catalogDbPromise)return catalogDbPromise;catalogDbPromise=new Promise((resolve,reject)=>{let q;try{q=indexedDB.open('srh-shorts-cache',CATALOG_DB_VERSION)}catch(e){catalogDbPromise=null;reject(e);return}q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('catalogs'))db.createObjectStore('catalogs');if(!db.objectStoreNames.contains('catalogMeta'))db.createObjectStore('catalogMeta');if(!db.objectStoreNames.contains('catalogChunks'))db.createObjectStore('catalogChunks')};q.onsuccess=()=>{const db=q.result;db.onversionchange=()=>{try{db.close()}catch{}catalogDbPromise=null};resolve(db)};q.onerror=()=>{catalogDbPromise=null;reject(q.error||new Error('IndexedDB falhou'))};q.onblocked=()=>{catalogDbPromise=null;reject(new Error('IndexedDB bloqueado por outra aba'))}});return catalogDbPromise}function cacheLock(task){const run=catalogWriteTail.then(task,task);catalogWriteTail=run.catch(()=>{});return run}function reqValue(r){return new Promise(resolve=>{r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>resolve(null)})}async function cacheRead(){try{const db=await openCache();if(db.objectStoreNames.contains('catalogMeta')&&db.objectStoreNames.contains('catalogChunks')){const tx=db.transaction(['catalogMeta','catalogChunks'],'readonly'),meta=await reqValue(tx.objectStore('catalogMeta').get(cacheKey));if(meta?.chunks>0){const store=tx.objectStore('catalogChunks'),parts=await Promise.all(Array.from({length:meta.chunks},(_,i)=>reqValue(store.get(cacheKey+':'+i))));const items=parts.flatMap(x=>Array.isArray(x?.items)?x.items:[]);if(items.length)return{time:Number(meta.time||meta.updatedAt||Date.now()),items,complete:meta.complete!==false,chunked:true}}}const tx=db.transaction('catalogs','readonly'),legacy=await reqValue(tx.objectStore('catalogs').get(cacheKey));return legacy||null}catch{return null}}async function cacheWriteSnapshot(items,complete=true){if(!items?.length)return false;const snapshot=items.slice(),chunks=[];for(let i=0;i<snapshot.length;i+=CATALOG_CHUNK)chunks.push(snapshot.slice(i,i+CATALOG_CHUNK));return cacheLock(async()=>{const db=await openCache();return await new Promise((resolve,reject)=>{let tx;try{tx=db.transaction(['catalogMeta','catalogChunks'],'readwrite')}catch(e){reject(e);return}const metaStore=tx.objectStore('catalogMeta'),chunkStore=tx.objectStore('catalogChunks'),old=metaStore.get(cacheKey);old.onsuccess=()=>{const oldCount=Number(old.result?.chunks||0);for(let i=0;i<chunks.length;i++)chunkStore.put({items:chunks[i],index:i,updatedAt:Date.now()},cacheKey+':'+i);for(let i=chunks.length;i<oldCount;i++)chunkStore.delete(cacheKey+':'+i);metaStore.put({time:Date.now(),updatedAt:Date.now(),count:snapshot.length,chunks:chunks.length,chunkSize:CATALOG_CHUNK,complete:!!complete},cacheKey)};old.onerror=()=>{for(let i=0;i<chunks.length;i++)chunkStore.put({items:chunks[i],index:i,updatedAt:Date.now()},cacheKey+':'+i);metaStore.put({time:Date.now(),updatedAt:Date.now(),count:snapshot.length,chunks:chunks.length,chunkSize:CATALOG_CHUNK,complete:!!complete},cacheKey)};tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error('Falha ao gravar catálogo'));tx.onabort=()=>reject(tx.error||new Error('Gravação do catálogo abortada'))})})}async function cacheWrite(items){try{return await cacheWriteSnapshot(items,true)}catch{return false}}function cacheWriteProgress(items){if(!items?.length)return;progressiveCachePending=items.slice();if(progressiveCacheTimer)return;progressiveCacheTimer=setTimeout(()=>{progressiveCacheTimer=0;const next=progressiveCachePending;progressiveCachePending=null;if(next?.length)void cacheWriteSnapshot(next,false)},550)}S.clearCatalogCache=async()=>cacheLock(async()=>{try{const db=await openCache();await new Promise(resolve=>{const names=['catalogs','catalogMeta','catalogChunks'].filter(n=>db.objectStoreNames.contains(n)),tx=db.transaction(names,'readwrite');if(names.includes('catalogs'))tx.objectStore('catalogs').delete(cacheKey);if(names.includes('catalogMeta')){const meta=tx.objectStore('catalogMeta').get(cacheKey);meta.onsuccess=()=>{const oldCount=Number(meta.result?.chunks||0);if(names.includes('catalogChunks'))for(let i=0;i<oldCount;i++)tx.objectStore('catalogChunks').delete(cacheKey+':'+i);tx.objectStore('catalogMeta').delete(cacheKey)}}tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()})}catch{}});
S.clearAllCatalogCache=async()=>cacheLock(async()=>{try{const db=await openCache(),prefix='catalog:v2mix:'+(S.cfg.appId||S.cfg.appName||'app')+':',names=['catalogs','catalogMeta','catalogChunks'].filter(n=>db.objectStoreNames.contains(n));if(!names.length)return 0;return await new Promise(resolve=>{let removed=0,tx;try{tx=db.transaction(names,'readwrite')}catch{resolve(0);return}for(const name of names){const os=tx.objectStore(name),q=os.openCursor();q.onsuccess=()=>{const cur=q.result;if(!cur)return;const key=String(cur.key||'');if(key.startsWith(prefix)){cur.delete();removed++}cur.continue()}}tx.oncomplete=()=>resolve(removed);tx.onerror=()=>resolve(removed);tx.onabort=()=>resolve(removed)})}catch{return 0}});
async function resolveTargets(){
  const targets=(S.cfg.targets||[]).filter(t=>t.type==='vod');
  if(targets.every(t=>String(t.id??t.category_id??'').trim()))return targets.map(t=>({...t,_id:String(t.id??t.category_id)}));
  const cats=await S.request({action:'get_vod_categories'}),rows=Array.isArray(cats)?cats:[];
  const exact=new Map(rows.map(c=>[cleanName(c.category_name??c.name),String(c.category_id??c.id??'')]));
  const normalized=new Map(rows.map(c=>[normName(c.category_name??c.name),String(c.category_id??c.id??'')]));
  return targets.map(t=>({...t,_id:String(t.id??t.category_id??exact.get(cleanName(t.name))??normalized.get(normName(t.name))??'')}));
}
const CATEGORY_BATCH=100;
const catalogYield=()=>new Promise(resolve=>{'requestIdleCallback'in window?requestIdleCallback(()=>resolve(),{timeout:90}):setTimeout(resolve,0)});
async function fetchItems(onGroup){
  const targets=(await resolveTargets()).filter(t=>t._id),groups=new Array(targets.length).fill(null).map(()=>[]);let failed=0,completed=0,nextIndex=0,loadedItems=0;
  const loadOne=async index=>{
    const t=targets[index];let items=null,lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      try{const r=await S.request({action:'get_vod_streams',category_id:t._id});items=Array.isArray(r)?r:[];break}
      catch(e){lastError=e;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,450))}
    }
    if(items===null){
      failed++;completed++;
      onGroup?.([],t,{index:completed,total:targets.length,categoryIndex:index,merged:interleaveGroups(groups),failed,categoryLoaded:0,categoryTotal:0,error:lastError?.message||String(lastError||'Falha')});
      return
    }
    for(let offset=0;offset<items.length;offset+=CATEGORY_BATCH){
      const batch=items.slice(offset,offset+CATEGORY_BATCH);
      groups[index].push(...batch);loadedItems+=batch.length;
      const merged=interleaveGroups(groups);
      S.state.categoryMerge={version:CATEGORY_MERGE_VERSION,batch:CATEGORY_BATCH,total:targets.length,completed,failed,loadedItems,counts:groups.map(x=>x.length),merged:merged.length};
      onGroup?.(batch,t,{index:completed+1,total:targets.length,categoryIndex:index,merged:merged.slice(),failed,categoryLoaded:Math.min(offset+CATEGORY_BATCH,items.length),categoryTotal:items.length,loadedItems});
      await catalogYield()
    }
    completed++;
    const merged=interleaveGroups(groups);
    S.state.categoryMerge={version:CATEGORY_MERGE_VERSION,batch:CATEGORY_BATCH,total:targets.length,completed,failed,loadedItems,counts:groups.map(x=>x.length),merged:merged.length}
  };
  const worker=async()=>{for(;;){const index=nextIndex++;if(index>=targets.length)return;await loadOne(index)}};
  await Promise.all(Array.from({length:Math.min(2,targets.length)},()=>worker()));
  const merged=interleaveGroups(groups);
  if(!merged.length&&failed)throw new Error('As categorias selecionadas não responderam.');
  if(failed)S.toast(failed+' categoria(s) não responderam; exibindo as demais.');
  return merged
}
function ensureContinueStyles(){
  if(document.getElementById('srh25ContinueStyle'))return;
  const s=document.createElement('style');s.id='srh25ContinueStyle';
  s.textContent='.srh25-card-wrap{position:relative;min-width:0}.srh25-card-wrap>.srh25-card{width:100%;display:block}.srh25-card-delete{position:absolute;z-index:7;top:7px;right:7px;width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(8,11,15,.72);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.srh25-card-delete:active{transform:scale(.94)}.srh25-card-delete svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.srh25-card-progress-ui{position:absolute;z-index:5;left:0;right:0;bottom:0;height:58px;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(0,0,0,.15) 30%,rgba(0,0,0,.72) 100%)}.srh25-card-ep{position:absolute;right:8px;bottom:12px;color:#fff;font-size:10px;font-weight:850;letter-spacing:.03em;text-shadow:0 2px 8px rgba(0,0,0,.85)}.srh25-card-progress-track{position:absolute;left:7px;right:7px;bottom:5px;height:3px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.24)}.srh25-card-progress-fill{display:block;height:100%;width:0;border-radius:inherit;background:var(--accent,#d8dee7);box-shadow:0 0 8px color-mix(in srgb,var(--accent,#d8dee7) 55%,transparent)}';
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
  del.onclick=e=>{e.preventDefault();e.stopPropagation();if(S.hideContinue(item,'manual')){wrap.remove();requestAnimationFrame(()=>S.refreshLibraryView?.())}};
  const hist=S.historyFor(item);
  const pos=Math.max(0,Number(hist?.position)||0),dur=Math.max(0,Number(hist?.duration)||0);
  const progress=document.createElement('span');progress.className='srh25-card-progress-ui';
  const ep=document.createElement('span');ep.className='srh25-card-ep';ep.textContent='EP'+(Math.floor(pos/120)+1);
  const track=document.createElement('span');track.className='srh25-card-progress-track';
  const fill=document.createElement('i');fill.className='srh25-card-progress-fill';fill.style.width=(dur>0?Math.max(0,Math.min(100,pos/dur*100)):0)+'%';
  track.appendChild(fill);progress.append(ep,track);b.appendChild(progress);
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
function reconcileFeed(items){const grid=$('#shortGrid');if(!grid)return;ensureImageObserver();const keep=Math.max(Math.min(shown,items.length),Math.min(BATCH,items.length)),wanted=items.slice(0,keep),existing=new Map([...grid.children].map(n=>[String(n?.dataset?.id||''),n]).filter(x=>x[0]));for(let i=0;i<wanted.length;i++){const item=wanted[i],id=S.id(item);let node=existing.get(id);if(!node)node=card(item);const at=grid.children[i];if(at!==node)grid.insertBefore(node,at||null);existing.delete(id)}for(const node of existing.values())node.remove();shown=keep}
function renderItems(items){S.state.items=items;S.state.filtered=items.slice();S.reconcileHistoryWithCatalog?.(items);reconcileFeed(S.state.filtered);S.refreshLibraryView?.();$('#appMeta').textContent=items.length+' Shorts · '+((S.cfg.targets||[]).filter(t=>t.type==='vod').length)+' categoria(s)';if(!S.__variantApplying)window.dispatchEvent(new CustomEvent('srh25:catalog-render',{detail:{items:items.slice(),incremental:true}}))}
S.renderCatalogItems=renderItems;
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
  const oldSource={server:S.cfg.server,username:S.cfg.username,password:S.cfg.password,targets:Array.isArray(S.cfg.targets)?S.cfg.targets.slice():[]},from=S.providerIdentity?.(oldSource.server)||'',to=S.providerIdentity?.(runtime.server)||'',providerChanged=!!from&&!!to&&from!==to;
  try{await S.saveRuntime(runtime)}catch(e){if(status)status.textContent='Falha ao salvar no IndexedDB: '+(e?.message||e);S.toast('Não foi possível salvar a atualização.');return}
  if(providerChanged){if(status)status.textContent='Nova DNS detectada. Limpando dados da lista anterior…';await S.clearProviderState?.(oldSource,runtime);await S.clearAllCatalogCache?.()}
  if(status)status.textContent=providerChanged?'Novo provedor salvo. Reconstruindo catálogo…':'Mesma DNS: histórico e catálogo preservados. Recarregando…';
  S.toast(providerChanged?'Novo provedor: dados antigos removidos.':'Lista atualizada; dados preservados.');setTimeout(()=>location.reload(),350)
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
        partial=progress?.merged?.length?progress.merged.slice():mergeUnique(partial,group);if(partial.length)cacheWriteProgress(partial);
        if(partial.length){
          renderItems(partial);
          $('#feedStatus').textContent='Carregando catálogo · '+partial.length+' itens'+(progress.categoryTotal?(' · '+progress.categoryLoaded+' / '+progress.categoryTotal):'');
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
const MINI_POS_KEY=MINI_BASE+':mini-resume-position:v2';
const MINI_POS_LEGACY_KEY=MINI_BASE+':mini-resume-position:v1';
const MINI_TTL=7*24*60*60*1000;
const MINI_EXPANDED_MS=4800;
let miniDock=null,miniOpen=null,miniImage=null,miniTitle=null,miniEpisode=null,miniProgress=null,miniClose=null,miniMemoryRecord=null,miniPositionMemory=null,miniDismissedId='';
let miniCompactTimer=0,miniExpiryTimer=0,miniSuppressOpen=false,miniSuppressTimer=0,miniDrag=null,miniLastLayoutWidth=Math.max(1,Number(window.innerWidth)||1);

function miniClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function miniUiDbOpen(){return S.historyDbOpen?S.historyDbOpen():Promise.reject(new Error('IndexedDB indisponível'))}
async function miniUiDbRead(key){
  try{
    const db=await miniUiDbOpen();
    return await new Promise(resolve=>{
      let tx,r;
      try{tx=db.transaction('state','readonly');r=tx.objectStore('state').get(key)}
      catch{resolve(null);return}
      r.onsuccess=()=>resolve(r.result==null?null:r.result);
      r.onerror=()=>resolve(null)
    })
  }catch{return null}
}
async function miniUiDbWrite(key,value){
  try{
    const db=await miniUiDbOpen();
    await new Promise(resolve=>{
      let tx;
      try{tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,key)}
      catch{resolve();return}
      tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()
    });
    return true
  }catch{return false}
}
async function miniUiDbDelete(key){
  try{
    const db=await miniUiDbOpen();
    await new Promise(resolve=>{
      let tx;
      try{tx=db.transaction('state','readwrite');tx.objectStore('state').delete(key)}
      catch{resolve();return}
      tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()
    })
  }catch{}
}
function normalizeMiniPosition(p){
  if(!p||typeof p!=='object')return null;
  const side=p.side==='right'?'right':'left';
  const top=Number(p.top);
  if(Number.isFinite(top))return {side,top:Math.max(0,top)};
  const bottomOffset=Number(p.bottomOffset);
  if(Number.isFinite(bottomOffset))return {side,bottomOffset:Math.max(0,bottomOffset)};
  const y=Number(p.y);
  if(Number.isFinite(y))return {side,y:miniClamp(y,0,1)};
  return null
}
function saveMiniPosition(p){
  const value=normalizeMiniPosition(p);
  if(!value)return;
  miniPositionMemory=value
}
function resetMiniPositionSession(){
  miniPositionMemory=null;
  if(miniDock){
    miniDock.style.transform='';
    miniDock.style.top='auto';
    miniDock.style.bottom='18px';
    miniDock.style.right='auto';
    miniDock.style.left='12px'
  }
}
function clearMiniDismissal(){
  miniDismissedId='';
  miniRemove(MINI_DISMISS_KEY);
  void miniUiDbDelete(MINI_DISMISS_KEY)
}
function dismissMiniResume(){
  const record=readMiniResume();
  if(!record)return;
  miniDismissedId=String(record.id||'');
  void miniUiDbWrite(MINI_DISMISS_KEY,miniDismissedId);
  hideMiniResume()
}
S.hydrateMiniUiState=async()=>{
  miniPositionMemory=null;miniRemove(MINI_POS_KEY);miniRemove(MINI_POS_LEGACY_KEY);await miniUiDbDelete(MINI_POS_KEY);await miniUiDbDelete(MINI_POS_LEGACY_KEY);
  const [dbDismiss,dbResume]=await Promise.all([miniUiDbRead(MINI_DISMISS_KEY),miniUiDbRead(MINI_KEY)]);
  const legacyDismiss=miniRead(MINI_DISMISS_KEY,''),legacyResume=miniRead(MINI_KEY,null);
  miniDismissedId=String(dbDismiss||legacyDismiss||'');miniMemoryRecord=miniFresh(dbResume)?dbResume:(miniFresh(legacyResume)?legacyResume:null);
  if(!dbDismiss&&legacyDismiss)void miniUiDbWrite(MINI_DISMISS_KEY,legacyDismiss);if(!dbResume&&miniMemoryRecord)void miniUiDbWrite(MINI_KEY,miniMemoryRecord);
  miniRemove(MINI_DISMISS_KEY);miniRemove(MINI_KEY);return true
};
function miniRead(key,fallback=null){try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw)}catch{return fallback}}
function miniWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function miniRemove(key){try{localStorage.removeItem(key)}catch{}}
function miniFresh(record){const updated=Number(record?.updatedAt||0);return !!record?.item&&updated>0&&Date.now()-updated<MINI_TTL}
function readMiniResume(){
  const record=miniFresh(miniMemoryRecord)?miniMemoryRecord:null;
  if(record){
    miniMemoryRecord=record;
    return record
  }
  miniMemoryRecord=null;
  miniRemove(MINI_KEY);miniRemove(MINI_DISMISS_KEY);
  return null
}
function miniItemSnapshot(item){
  return {stream_id:item?.stream_id,id:item?.id,movie_id:item?.movie_id,name:item?.name,title:item?.title,stream_icon:item?.stream_icon,movie_image:item?.movie_image,cover:item?.cover,cover_big:item?.cover_big,backdrop_path:item?.backdrop_path,container_extension:item?.container_extension}
}
function clearMiniResume(item){
  const record=readMiniResume();
  if(item&&record?.id&&String(record.id)!==String(S.id(item)))return;
  miniMemoryRecord=null;
  miniRemove(MINI_KEY);void miniUiDbDelete(MINI_KEY);
  clearMiniDismissal();
  clearTimeout(miniCompactTimer);clearTimeout(miniExpiryTimer);
  if(miniDock)hideMiniResume()
}
function saveMiniResume(item,position,duration){
  const pos=Number(position),dur=Number(duration);
  if(!item||!Number.isFinite(pos)||pos<0)return null;
  if(Number.isFinite(dur)&&dur>0&&dur-pos<=30){clearMiniResume(item);return null}
  const record={id:S.id(item),title:S.title(item),image:S.image(item),position:pos,duration:Number.isFinite(dur)&&dur>0?dur:0,updatedAt:Date.now(),item:miniItemSnapshot(item)};
  miniMemoryRecord=record;
  void miniUiDbWrite(MINI_KEY,record);
  clearMiniDismissal();
  return record
}
function miniEpisodeLabel(position){return 'EP'+(Math.max(0,Math.floor((Number(position)||0)/120))+1)}
function hideMiniResume(){if(miniDock){miniDock.hidden=true;miniDock.classList.add('is-hidden');miniDock.style.display='none'}}
function ensureMiniStyles(){
  if(document.getElementById('srh25MiniResumeStyle'))return;
  const style=document.createElement('style');style.id='srh25MiniResumeStyle';
  style.textContent=
    '.srh25-mini-resume{position:fixed;z-index:94;left:12px;right:12px;bottom:16px;display:grid;grid-template-columns:66px 1fr 34px;align-items:center;gap:10px;min-height:92px;padding:9px;box-sizing:border-box;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(12,16,21,.97);box-shadow:0 18px 50px rgba(0,0,0,.48);overflow:hidden;opacity:1;transform:translate3d(0,0,0);transition:transform .22s ease,opacity .18s ease,width .24s ease,height .24s ease,left .22s ease,bottom .22s ease;touch-action:none;-webkit-user-select:none;user-select:none}' +
    '.srh25-mini-resume[hidden],.srh25-mini-resume.is-hidden{display:none!important}' +
    '.srh25-mini-resume.is-dragging{transition:none!important}' +
    '.srh25-mini-thumb{position:relative;width:66px;height:72px;padding:0;border:1px solid rgba(255,255,255,.24);border-radius:9px;overflow:hidden;background:#111820;box-shadow:0 10px 28px rgba(0,0,0,.38);touch-action:none}' +
    '.srh25-mini-thumb img{width:100%;height:100%;display:block;object-fit:cover;background:#111820;pointer-events:none;-webkit-user-drag:none}' +
    '.srh25-mini-play{position:absolute;left:50%;top:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.3);border-radius:50%;background:rgba(0,0,0,.56)}' +
    '.srh25-mini-play svg{width:13px;height:13px;fill:none;stroke:#fff;stroke-width:2;stroke-linejoin:round}' +
    '.srh25-mini-copy{min-width:0;align-self:center}' +
    '.srh25-mini-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.2;font-weight:800}' +
    '.srh25-mini-episode{display:block;margin-top:4px;color:#929aa5;font-size:10px;font-weight:720}' +
    '.srh25-mini-progress{display:block;height:3px;margin-top:9px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.15)}' +
    '.srh25-mini-progress i{display:block;width:0;height:100%;border-radius:999px;background:var(--accent,#d8dee7)}' +
    '.srh25-mini-close{width:30px;height:30px;padding:0;display:grid;place-items:center;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:rgba(255,255,255,.05);color:#c7cdd6}' +
    '.srh25-mini-close svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}' +
    '.srh25-mini-resume.is-compact{right:auto;width:96px;height:144px;min-height:144px;padding:0;grid-template-columns:1fr;gap:0;border-radius:9px;background:#111;box-shadow:0 18px 42px rgba(0,0,0,.5)}' +
    '.srh25-mini-resume.is-compact .srh25-mini-thumb{width:100%;height:100%;border:0;border-radius:0;box-shadow:none}' +
    '.srh25-mini-resume.is-compact .srh25-mini-thumb:after{content:"";position:absolute;z-index:1;left:0;right:0;bottom:0;height:40%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.10) 40%,rgba(0,0,0,.46));pointer-events:none}' +
    '.srh25-mini-resume.is-compact .srh25-mini-play{display:none!important}' +
    '.srh25-mini-resume.is-compact .srh25-mini-copy{display:block!important;position:absolute;z-index:3;left:7px;right:7px;bottom:7px;min-width:0;pointer-events:none}' +
    '.srh25-mini-resume.is-compact .srh25-mini-title{display:none!important}' +
    '.srh25-mini-resume.is-compact .srh25-mini-episode{display:block;margin:0 0 5px;text-align:right;color:rgba(255,255,255,.68);font-size:9px;font-weight:760;line-height:1;text-shadow:0 2px 7px rgba(0,0,0,.52)}' +
    '.srh25-mini-resume.is-compact .srh25-mini-progress{display:block;height:2px;margin:0;background:rgba(255,255,255,.13);opacity:.82}' +
    '.srh25-mini-resume.is-compact .srh25-mini-progress i{opacity:.74}' +
    '.srh25-mini-resume.is-compact .srh25-mini-close{display:grid!important;position:absolute;z-index:5;top:6px;right:6px;width:28px;height:28px;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(8,11,15,.72);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.28)}' +
    '@media(min-width:700px){.srh25-mini-resume.is-compact{width:120px;height:180px;min-height:180px}}';
  document.head.appendChild(style)
}
function ensureMiniDock(){
  if(miniDock)return;
  ensureMiniStyles();
  miniDock=document.createElement('aside');
  miniDock.className='srh25-mini-resume is-hidden is-compact';
  miniDock.hidden=true;
  miniDock.setAttribute('aria-label','Continuar episódio');
  miniDock.innerHTML='<button class="srh25-mini-thumb" type="button" aria-label="Retomar episódio"><img alt="" draggable="false"><span class="srh25-mini-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg></span></button><div class="srh25-mini-copy"><strong class="srh25-mini-title"></strong><small class="srh25-mini-episode"></small><span class="srh25-mini-progress"><i></i></span></div><button class="srh25-mini-close" type="button" aria-label="Reduzir miniatura"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
  document.body.appendChild(miniDock);
  miniOpen=miniDock.querySelector('.srh25-mini-thumb');
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
  miniClose.setAttribute('aria-label','Ocultar miniatura');
  miniClose.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    clearTimeout(miniCompactTimer);
    dismissMiniResume()
  });
  if(window.PointerEvent)miniDock.addEventListener('pointerdown',startMiniDrag);
  else miniDock.addEventListener('touchstart',startMiniTouch,{passive:true})
}
function compactMiniSize(){
  return (Number(window.innerWidth)||0)>=700?{width:120,height:180}:{width:96,height:144}
}
function miniFrameBounds(rect){
  const vw=Math.max(1,Number(window.innerWidth||document.documentElement.clientWidth||0));
  const vh=Math.max(1,Number(window.innerHeight||document.documentElement.clientHeight||0));
  const margin=12;
  let top=margin;
  const header=!$('#libraryView')?.classList.contains('is-hidden')?$('#libraryView .srh25-library__head'):$('.srh25-topbar');
  if(header){
    const h=header.getBoundingClientRect();
    if(Number.isFinite(h.bottom))top=Math.max(top,h.bottom+10)
  }
  const bottom=Math.max(top,vh-rect.height-18);
  const left=margin;
  const right=Math.max(left,vw-rect.width-margin);
  return {left,right,top,bottom,center:vw/2}
}
function readMiniPosition(){
  return normalizeMiniPosition(miniPositionMemory)||{side:'left',y:1}
}
function applyMiniDockMetrics(compact){
  if(!miniDock)return;
  if(compact){
    const size=compactMiniSize();
    miniDock.style.right='auto';
    miniDock.style.width=size.width+'px';
    miniDock.style.height=size.height+'px';
    miniDock.style.minHeight=size.height+'px'
  }else{
    miniDock.style.left='12px';
    miniDock.style.right='12px';
    miniDock.style.width='auto';
    miniDock.style.height='auto';
    miniDock.style.minHeight='92px'
  }
}
function pinExpandedMiniDock(){
  if(!miniDock||miniDock.hidden)return;
  miniDock.style.transform='';
  miniDock.style.top='auto';
  miniDock.style.left='12px';
  miniDock.style.right='12px';
  miniDock.style.bottom='16px'
}
function placeMiniDock(force){
  if(!miniDock||miniDock.hidden||!miniDock.classList.contains('is-compact'))return;
  if(miniDrag&&!force)return;
  const rect=miniDock.getBoundingClientRect();
  const bounds=miniFrameBounds(rect),p=readMiniPosition();
  let top;
  if(Number.isFinite(p.top))top=p.top;
  else if(Number.isFinite(p.bottomOffset))top=bounds.bottom-p.bottomOffset;
  else top=bounds.top+(bounds.bottom-bounds.top)*Number(p.y==null?1:p.y);
  top=miniClamp(top,bounds.top,bounds.bottom);
  saveMiniPosition({side:p.side,top});
  miniDock.style.bottom='auto';
  miniDock.style.top=top+'px';
  miniDock.style.right='auto';
  miniDock.style.left=(p.side==='right'?bounds.right:bounds.left)+'px';
  miniDock.style.transform=''
}
function compactMiniDock(){
  if(!miniDock||miniDock.hidden)return;
  miniDock.classList.add('is-compact');
  applyMiniDockMetrics(true);
  setTimeout(()=>placeMiniDock(true),280)
}
function scheduleMiniExpiry(record){
  clearTimeout(miniExpiryTimer);miniExpiryTimer=0;
  if(!record)return;
  const remaining=MINI_TTL-(Date.now()-Number(record.updatedAt||0));
  if(remaining<=0){clearMiniResume();return}
  miniExpiryTimer=setTimeout(()=>clearMiniResume(),Math.min(remaining,2147483000))
}
function resolveHistoryItem(h){
  if(!h)return null;
  const id=String(h.id??S.id(h.item)??'');
  if(id){
    const fromCatalog=(S.state.items||[]).find(x=>S.id(x)===id);
    if(fromCatalog)return fromCatalog
  }
  return h.item||null
}
function seedMiniFromHistory(){
  const existing=readMiniResume();
  if(existing)return existing;
  const history=[...(S.state.history?.length?S.state.history:S.readHistory())]
    .sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0));
  for(const h of history){
    const item=resolveHistoryItem(h);
    if(!item)continue;
    const position=Math.max(0,Number(h.position)||0);
    const duration=Math.max(0,Number(h.duration)||0);
    if(!S.isContinueVisible(item))continue;
    const record={id:S.id(item),title:S.title(item),image:S.image(item),position,duration,updatedAt:Number(h.updatedAt||Date.now()),item:miniItemSnapshot(item)};
    miniMemoryRecord=record;
    miniWrite(MINI_KEY,record);
    return record
  }
  return null
}
function renderMiniResume(expand=false){
  ensureMiniDock();
  const record=readMiniResume()||seedMiniFromHistory();
  if(!record){hideMiniResume();return}
  if(miniDismissedId&&String(record.id||'')===miniDismissedId){hideMiniResume();return}
  if(record.image&&miniImage.src!==record.image)miniImage.src=record.image;
  miniImage.alt=record.title||'Continuar';
  miniTitle.textContent=record.title||'Continuar';
  miniEpisode.textContent=miniEpisodeLabel(record.position);
  miniProgress.style.width=(record.duration>0?miniClamp(record.position/record.duration,0,1)*100:0)+'%';

  miniDock.hidden=false;
  miniDock.classList.remove('is-hidden');
  miniDock.style.display='grid';
  clearTimeout(miniCompactTimer);

  if(expand){
    miniDock.classList.remove('is-compact');
    applyMiniDockMetrics(false);
    pinExpandedMiniDock();
    miniCompactTimer=setTimeout(compactMiniDock,MINI_EXPANDED_MS)
  }else{
    miniDock.classList.add('is-compact');
    applyMiniDockMetrics(true);
    placeMiniDock(true)
  }
  scheduleMiniExpiry(record);
  setTimeout(()=>verifyMiniDockLayout(expand),40);
  setTimeout(()=>verifyMiniDockLayout(expand),320)
}
function verifyMiniDockLayout(expand){
  if(!miniDock||miniDock.hidden)return;
  let rect;
  try{rect=miniDock.getBoundingClientRect()}catch{return}
  const vw=Math.max(1,Number(window.innerWidth||document.documentElement.clientWidth||0));
  const vh=Math.max(1,Number(window.innerHeight||document.documentElement.clientHeight||0));
  const bad=!rect||rect.width<40||rect.height<50||rect.right<=0||rect.left>=vw||rect.bottom<=0||rect.top>=vh;
  if(!bad)return;
  try{document.body.appendChild(miniDock)}catch{}
  miniDock.hidden=false;
  miniDock.classList.remove('is-hidden');
  miniDock.style.position='fixed';
  miniDock.style.zIndex='2147483000';
  miniDock.style.top='auto';
  miniDock.style.transform='none';
  miniDock.style.opacity='1';
  miniDock.style.visibility='visible';
  miniDock.style.boxSizing='border-box';
  if(expand&&!miniDock.classList.contains('is-compact')){
    miniDock.style.display='grid';
    miniDock.style.left='12px';
    miniDock.style.right='12px';
    miniDock.style.bottom='16px';
    miniDock.style.width='auto';
    miniDock.style.minHeight='92px';
    miniDock.style.height='auto'
  }else{
    const size=compactMiniSize();
    miniDock.classList.add('is-compact');
    miniDock.style.display='grid';
    miniDock.style.right='auto';
    miniDock.style.width=size.width+'px';
    miniDock.style.height=size.height+'px';
    miniDock.style.minHeight=size.height+'px';
    const thumb=miniDock.querySelector('.srh25-mini-thumb');
    if(thumb){thumb.style.display='block';thumb.style.width='100%';thumb.style.height='100%'}
    if(miniImage){miniImage.style.display='block';miniImage.style.width='100%';miniImage.style.height='100%';miniImage.style.objectFit='cover'}
    setTimeout(()=>placeMiniDock(true),0)
  }
}
function finishMiniDragPosition(lastLeft,lastTop,rect,bounds){
  const side=lastLeft+rect.width/2<=bounds.center?'left':'right';
  const top=miniClamp(lastTop,bounds.top,bounds.bottom);
  saveMiniPosition({side,top});
  miniDock.style.transform='';
  miniDock.style.bottom='auto';
  miniDock.style.top=top+'px';
  miniDock.style.right='auto';
  miniDock.style.left=(side==='right'?bounds.right:bounds.left)+'px'
}
function startMiniDrag(event){
  if(!miniDock||miniDock.hidden||!miniDock.classList.contains('is-compact'))return;
  if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||event.target.closest('.srh25-mini-close'))return;
  const rect=miniDock.getBoundingClientRect(),bounds=miniFrameBounds(rect);
  const startX=event.clientX,startY=event.clientY,shiftX=startX-rect.left,shiftY=startY-rect.top;
  const originLeft=rect.left,originTop=rect.top;
  let lastLeft=originLeft,lastTop=originTop,moved=false,finished=false;
  miniDrag={pointerId:event.pointerId};miniDock.classList.add('is-dragging');
  try{miniDock.setPointerCapture?.(event.pointerId)}catch{}
  const move=e=>{
    if(finished||e.pointerId!==event.pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(!moved&&Math.hypot(dx,dy)<4)return;
    moved=true;e.preventDefault();
    lastLeft=miniClamp(e.clientX-shiftX,bounds.left,bounds.right);
    lastTop=miniClamp(e.clientY-shiftY,bounds.top,bounds.bottom);
    miniDock.style.transform='translate3d('+(lastLeft-originLeft)+'px,'+(lastTop-originTop)+'px,0)'
  };
  const finish=e=>{
    if(finished||(Number.isFinite(e?.pointerId)&&e.pointerId!==event.pointerId))return;
    finished=true;
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',finish);
    window.removeEventListener('pointercancel',finish);
    try{if(miniDock.hasPointerCapture?.(event.pointerId))miniDock.releasePointerCapture(event.pointerId)}catch{}
    miniDrag=null;miniDock.classList.remove('is-dragging');
    if(!moved){miniDock.style.transform='';return}
    miniSuppressOpen=true;clearTimeout(miniSuppressTimer);
    miniSuppressTimer=setTimeout(()=>{miniSuppressOpen=false},220);
    finishMiniDragPosition(lastLeft,lastTop,rect,bounds)
  };
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',finish)
}
function startMiniTouch(event){
  if(!miniDock||miniDock.hidden||!miniDock.classList.contains('is-compact'))return;
  const touch=event.touches&&event.touches[0];if(!touch)return;
  const rect=miniDock.getBoundingClientRect(),bounds=miniFrameBounds(rect);
  const startX=touch.clientX,startY=touch.clientY,shiftX=startX-rect.left,shiftY=startY-rect.top;
  const originLeft=rect.left,originTop=rect.top;
  let lastLeft=originLeft,lastTop=originTop,moved=false,finished=false;
  miniDock.classList.add('is-dragging');
  const move=e=>{
    if(finished)return;
    const t=e.touches&&e.touches[0];if(!t)return;
    const dx=t.clientX-startX,dy=t.clientY-startY;
    if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;
    moved=true;if(e.cancelable)e.preventDefault();
    lastLeft=miniClamp(t.clientX-shiftX,bounds.left,bounds.right);
    lastTop=miniClamp(t.clientY-shiftY,bounds.top,bounds.bottom);
    miniDock.style.transform='translate3d('+(lastLeft-originLeft)+'px,'+(lastTop-originTop)+'px,0)'
  };
  const finish=()=>{
    if(finished)return;finished=true;
    window.removeEventListener('touchmove',move,false);
    window.removeEventListener('touchend',finish,false);
    window.removeEventListener('touchcancel',finish,false);
    miniDock.classList.remove('is-dragging');
    if(!moved){miniDock.style.transform='';return}
    miniSuppressOpen=true;clearTimeout(miniSuppressTimer);
    miniSuppressTimer=setTimeout(()=>{miniSuppressOpen=false},240);
    finishMiniDragPosition(lastLeft,lastTop,rect,bounds)
  };
  window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('touchend',finish,false);
  window.addEventListener('touchcancel',finish,false)
}
window.addEventListener('resize',()=>{
  const width=Math.max(1,Number(window.innerWidth)||1);
  if(Math.abs(width-miniLastLayoutWidth)<4)return;
  miniLastLayoutWidth=width;
  if(miniDock&&!miniDock.hidden&&miniDock.classList.contains('is-compact')){
    applyMiniDockMetrics(true);
    placeMiniDock(true)
  }
},{passive:true});


function safeSaveMiniResume(item,position,duration){
  try{return saveMiniResume(item,position,duration)}catch(e){return null}
}
function safeRenderMiniResume(expand){
  try{return renderMiniResume(expand)}catch(e){return null}
}
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
  if(titleNode&&title)titleNode.textContent=title;
  if(metaNode){
    metaNode.textContent='Episódio '+playerEpisodeNumber(position);
    metaNode.style.display='block'
  }
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
    style.textContent='.srh25-player{will-change:transform,opacity}.srh25-player__close,.srh25-player__rail,.srh25-player__info,.srh25-player__center-controls,.srh25-player__shade{transition:opacity .18s ease}.srh25-player:not(.controls-visible) .srh25-player__close,.srh25-player:not(.controls-visible) .srh25-player__rail,.srh25-player:not(.controls-visible) .srh25-player__info,.srh25-player:not(.controls-visible) .srh25-player__center-controls,.srh25-player:not(.controls-visible) .srh25-player__shade{opacity:0;pointer-events:none}.srh25-player__meta{display:block!important;margin-top:4px;font-size:11px;font-weight:650;letter-spacing:.01em;opacity:.68}.srh25-player__center-controls{position:absolute;z-index:10;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:18px}.srh25-player__transport{width:56px;height:56px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(8,11,15,.64);color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.28);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.srh25-player__transport--main{width:68px;height:68px;background:rgba(8,11,15,.74)}.srh25-player__transport svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.srh25-player__transport--main svg{width:30px;height:30px}.srh25-player__seek-label{font-size:12px;font-weight:850}.srh25-player.is-swiping{transition:none!important}.srh25-player.is-swipe-return{transition:transform .20s cubic-bezier(.22,1,.36,1),opacity .20s ease}.srh25-player.is-swipe-exit{transition:transform .24s cubic-bezier(.22,1,.36,1),opacity .22s ease}@media(max-width:420px){.srh25-player__center-controls{gap:14px}.srh25-player__transport{width:52px;height:52px}.srh25-player__transport--main{width:64px;height:64px}}';
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
function warmMediaOrigin(url){try{const u=new URL(url,location.href),origin=u.origin;if(!origin||origin==='null')return;const key='srh-media-'+btoa(unescape(encodeURIComponent(origin))).replace(/=+$/,'');if(document.querySelector('link[data-srh-media="'+key+'"]'))return;const dns=document.createElement('link');dns.rel='dns-prefetch';dns.href=origin;dns.dataset.srhMedia=key;document.head.appendChild(dns);const pre=document.createElement('link');pre.rel='preconnect';pre.href=origin;pre.dataset.srhMedia=key;document.head.appendChild(pre)}catch{}}
async function loadVideo(item,resume){
  const url=S.stream(item),hasResume=Number(resume?.position)>0,warm=()=>warmMediaOrigin(url),reveal=()=>{poster.classList.add('is-hidden');loading.classList.add('is-hidden')},ready=()=>{drawArcs();if(hasResume&&resume.position<video.duration-3){video.currentTime=resume.position;const done=()=>{video.play().catch(()=>{})};video.addEventListener('seeked',done,{once:true})}else if(video.paused){video.play().catch(()=>{})}};
  warm();video.preload='auto';video.addEventListener('playing',reveal,{once:true});
  if(/\.m3u8(?:$|\?)/i.test(url)){
    if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.onloadedmetadata=ready;video.onerror=()=>S.toast('Mídia indisponível');video.load();if(!hasResume)video.play().catch(()=>{});return}
    try{const H=await ensureHls();if(H?.isSupported?.()){const h=new H({enableWorker:true,maxBufferLength:30,capLevelToPlayerSize:false,startLevel:-1});S.state.hls=h;h.loadSource(url);h.attachMedia(video);h.on(H.Events.MANIFEST_PARSED,()=>{const highest=Math.max(0,(h.levels?.length||1)-1);h.autoLevelCapping=highest;h.currentLevel=highest;h.nextLevel=highest;ready()});h.on(H.Events.LEVEL_SWITCHED,()=>{const highest=Math.max(0,(h.levels?.length||1)-1);if(h.currentLevel!==highest)h.nextLevel=highest});h.on(H.Events.ERROR,(_,d)=>{if(d.fatal)S.toast('Falha ao iniciar o vídeo')});return}}catch(e){S.toast(e?.message||'HLS indisponível')}
  }
  video.src=url;video.onloadedmetadata=ready;video.onerror=()=>S.toast('Mídia indisponível');video.load();if(!hasResume)video.play().catch(()=>{})
}
S.openPlayer=(item,resumeOverride)=>{
  resetMiniPositionSession();
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
window.addEventListener('pagehide',()=>{if(S.state.current){S.saveProgress(S.state.current.item,Math.max(0,Number(video.currentTime)||0),Number(video.duration));safeSaveMiniResume(S.state.current.item,Math.max(0,Number(video.currentTime)||0),Number(video.duration))}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S.state.current)persistExitSnapshot()});
window.addEventListener('srh25:ready',()=>{try{localStorage.setItem('srh25:last-runtime','a30-r42')}catch{}miniRemove(MINI_DISMISS_KEY);ensurePlayerControls();safeRenderMiniResume(false);setTimeout(()=>safeRenderMiniResume(false),120)},{once:true});
Promise.resolve().then(()=>S.boot());
})();
})();

(()=>{
'use strict';
const S=window.SRH25;
if(!S||S.__srhLanguageVariants)return;
S.__srhLanguageVariants=true;

const VERSION='cover-language-v1';
const SIMILARITY_THRESHOLD=0.80;
const HASH_COLUMNS=9,HASH_ROWS=8,HASH_HEX_LENGTH=16;
const LOAD_TIMEOUT=6500;
const HASH_TTL=60*24*60*60*1000;
const DB_NAME='srh25-cover-vision-debug-v1',DB_STORE='hashes';
const memory=new Map();
const groupsById=new Map();
let sourceItems=[];
let scanTimer=0;
let scanGeneration=0;
let scanRunning=false;
let languageButton=null,languageSheet=null,languageBackdrop=null,languageList=null;
const pop=[0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4];

function clean(s){return String(s??'').trim()}
function norm(s){
  let v=clean(s).toLocaleLowerCase('pt-BR');
  try{v=v.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch{}
  return v
}
function variantKind(name){
  const raw=clean(name),n=norm(raw).replace(/[_.-]+/g,' ').replace(/\s+/g,' ');
  if(/\[\s*(?:l|leg|lg)\s*\]/i.test(raw)||/\b(?:legendad[oa]s?|legendas?|leg|lg|sub|subbed|subtitle[sd]?|idioma original|audio original)\b/.test(n))return'legendado';
  if(/\[\s*(?:d|dub)\s*\]/i.test(raw)||/\b(?:dublad[oa]s?|dublagem|dub|dubbed|pt\s*br|ptbr|portugues|audio portugues|voz portuguesa)\b/.test(n))return'dublado';
  return'';
}
function canonicalTitle(item){
  let s=norm(item?.name||item?.title||'');
  s=s.replace(/\[\s*(?:l|leg|lg|d|dub)\s*\]/g,' ');
  s=s.replace(/\([^)]{0,80}\)|\[[^\]]{0,80}\]|\{[^}]{0,80}\}/g,' ');
  s=s.replace(/\b(?:legendad[oa]s?|legendas?|leg|lg|sub|subbed|subtitle[sd]?|dublad[oa]s?|dublagem|dub|dubbed|pt\s*br|ptbr|portugues|audio portugues|voz portuguesa|idioma original|audio original)\b/g,' ');
  s=s.replace(/\b(?:versao|version)\s*\d+\b/g,' ');
  return s.replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
}
function coverUrl(item){return clean(S.image?.(item)||item?.stream_icon||item?.movie_image||item?.cover||'')}
function canonicalCover(url){
  const raw=clean(url);if(!raw)return'';
  try{const u=new URL(raw,location.href);return (u.origin+decodeURIComponent(u.pathname)).toLowerCase().replace(/\.(?:jpe?g|png|webp|avif)$/,'').replace(/[@_-](?:w\d+|h\d+|\d{2,4}x\d{2,4}|thumb(?:nail)?|small|medium|large|mini|original|hd|sd)$/,'')}
  catch{return norm(raw).replace(/[?#].*$/,'').replace(/\.(?:jpe?g|png|webp|avif)$/,'')}
}
function similarity(a,b){
  const x=String(a||''),y=String(b||'');if(!x||x.length!==y.length)return 0;
  let d=0;for(let i=0;i<x.length;i++){const xa=parseInt(x[i],16),xb=parseInt(y[i],16);if(!Number.isFinite(xa)||!Number.isFinite(xb))return 0;d+=pop[(xa^xb)&15]}
  return 1-d/(x.length*4)
}
function openDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB indisponível'));return}
    let q;try{q=indexedDB.open(DB_NAME,1)}catch(e){reject(e);return}
    q.onupgradeneeded=()=>{try{if(!q.result.objectStoreNames.contains(DB_STORE))q.result.createObjectStore(DB_STORE)}catch{}};
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error||new Error('IndexedDB falhou'))
  })
}
async function dbRead(key){
  try{const db=await openDb();return await new Promise(resolve=>{let r;try{r=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(key)}catch{resolve(null);return}r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)})}catch{return null}
}
async function dbWrite(key,value){
  try{const db=await openDb();await new Promise(resolve=>{let tx;try{tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(value,key)}catch{resolve();return}tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve()})}catch{}
}
function loadImage(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();let done=false;
    const timer=setTimeout(()=>{if(done)return;done=true;img.src='';reject(new Error('cover timeout'))},LOAD_TIMEOUT);
    img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';img.decoding='async';
    img.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve(img)};
    img.onerror=()=>{if(done)return;done=true;clearTimeout(timer);reject(new Error('cover load'))};
    img.src=url
  })
}
function imageHash(img){
  const canvas=document.createElement('canvas');canvas.width=HASH_COLUMNS;canvas.height=HASH_ROWS;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  ctx.drawImage(img,0,0,HASH_COLUMNS,HASH_ROWS);
  const data=ctx.getImageData(0,0,HASH_COLUMNS,HASH_ROWS).data,luma=new Float64Array(HASH_COLUMNS*HASH_ROWS);
  for(let i=0;i<luma.length;i++){const o=i*4;luma[i]=data[o]*.299+data[o+1]*.587+data[o+2]*.114}
  let out='',n=0,bits=0;
  for(let y=0;y<HASH_ROWS;y++)for(let x=0;x<HASH_COLUMNS-1;x++){
    const left=luma[y*HASH_COLUMNS+x],right=luma[y*HASH_COLUMNS+x+1];
    n=(n<<1)|(left>right?1:0);bits++;
    if(bits===4){out+=n.toString(16);n=0;bits=0}
  }
  return out.length===HASH_HEX_LENGTH?out:null
}
async function hashCover(url){
  const raw=clean(url);if(!raw)return null;
  const key=canonicalCover(raw)||raw;
  const cached=memory.get(key);if(cached)return cached;
  const stored=await dbRead(key);
  if(stored?.hash&&Date.now()-Number(stored.at||0)<HASH_TTL){memory.set(key,stored.hash);return stored.hash}
  const candidates=typeof S.coverProxyCandidates==='function'?S.coverProxyCandidates(raw):[raw];
  for(const candidate of [...new Set((candidates||[]).filter(Boolean))]){
    try{const img=await loadImage(candidate),h=imageHash(img);if(!h)continue;memory.set(key,h);void dbWrite(key,{hash:h,at:Date.now(),url:raw});return h}catch{}
  }
  return null
}
async function parallel(rows,fn,limit=2){
  let cursor=0;const out=new Array(rows.length);
  const worker=async()=>{for(;;){const i=cursor++;if(i>=rows.length)return;out[i]=await fn(rows[i],i)}};
  await Promise.all(Array.from({length:Math.min(limit,rows.length)},()=>worker()));return out
}
function buildCandidateRows(items){
  const byName=new Map(),byCover=new Map();
  for(const item of items){
    const id=S.id(item),name=canonicalTitle(item),cover=canonicalCover(coverUrl(item));
    if(!id)continue;
    if(name){if(!byName.has(name))byName.set(name,[]);byName.get(name).push(item)}
    if(cover){if(!byCover.has(cover))byCover.set(cover,[]);byCover.get(cover).push(item)}
  }
  const ids=new Set(),rows=[];
  for(const list of [...byName.values(),...byCover.values()])if(list.length>1)for(const item of list){const id=S.id(item);if(!ids.has(id)){ids.add(id);rows.push(item)}}
  return{rows,byName,byCover}
}
function parentHelpers(items){
  const parent=items.map((_,i)=>i),byId=new Map(items.map((x,i)=>[S.id(x),i]));
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
  const union=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parent[y]=x};
  return{parent,byId,find,union}
}
function labelledVariants(items,similarityToPrimary){
  const rank={dublado:0,legendado:1,'':2};
  const ordered=items.map((item,index)=>({item,index,kind:variantKind(item?.name||item?.title||'')})).sort((a,b)=>(rank[a.kind]??3)-(rank[b.kind]??3)||a.index-b.index);
  const totals=ordered.reduce((m,x)=>(m[x.kind]=(m[x.kind]||0)+1,m),{}),seen={};
  return ordered.map((x,index)=>{
    seen[x.kind]=(seen[x.kind]||0)+1;
    let label=x.kind==='dublado'?'Dublado':x.kind==='legendado'?'Legendado':'Versão '+(index+1);
    if(x.kind&&totals[x.kind]>1)label+=' '+seen[x.kind];
    return{item:x.item,id:S.id(x.item),kind:x.kind,label,similarity:Number(similarityToPrimary?.get(S.id(x.item))||1)}
  })
}
function makeGroups(items,hashes,byName,byCover){
  const {byId,find,union}=parentHelpers(items);
  for(const list of byCover.values())if(list.length>1){const base=byId.get(S.id(list[0]));for(let i=1;i<list.length;i++){const j=byId.get(S.id(list[i]));if(base!=null&&j!=null)union(base,j)}}
  for(const list of byName.values()){
    if(list.length<2)continue;
    for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++){
      const ia=byId.get(S.id(list[a])),ib=byId.get(S.id(list[b]));if(ia==null||ib==null)continue;
      const ca=canonicalCover(coverUrl(list[a])),cb=canonicalCover(coverUrl(list[b]));
      if(ca&&ca===cb){union(ia,ib);continue}
      const ha=hashes.get(S.id(list[a])),hb=hashes.get(S.id(list[b]));
      if(ha&&hb&&similarity(ha,hb)>=SIMILARITY_THRESHOLD)union(ia,ib)
    }
  }
  const clustered=new Map();
  items.forEach((item,i)=>{const root=find(i);if(!clustered.has(root))clustered.set(root,[]);clustered.get(root).push(item)});
  return[...clustered.values()].filter(x=>x.length>1)
}
function collapse(items,clusters,hashes){
  groupsById.clear();const hidden=new Set(),groups=[];
  for(const members of clusters){
    const sim=new Map(),first=members[0],firstHash=hashes.get(S.id(first));
    for(const item of members){const h=hashes.get(S.id(item));sim.set(S.id(item),firstHash&&h?similarity(firstHash,h):canonicalCover(coverUrl(first))===canonicalCover(coverUrl(item))?1:0)}
    const variants=labelledVariants(members,sim),primary=variants[0]?.item||members[0],group={id:'lang:'+S.id(primary),primary,variants,threshold:SIMILARITY_THRESHOLD};
    groups.push(group);
    for(const v of variants){groupsById.set(v.id,group);if(v.item!==primary)hidden.add(v.id)}
  }
  return{items:items.filter(item=>!hidden.has(S.id(item))),groups}
}
function patchDebug(stats){
  try{window.SRHDebug?.state.patch('shorts',{languageVariants:stats})}catch{}
  try{window.SRHDebug?.log('info','shorts.language_variants',stats)}catch{}
}
async function scan(items){
  if(scanRunning||window.__SRH_SAFE_MODE__)return;
  const generation=++scanGeneration,list=(Array.isArray(items)?items:[]).filter(Boolean);
  if(list.length<2)return;
  scanRunning=true;
  try{
    const {rows,byName,byCover}=buildCandidateRows(list);
    if(rows.length<2){groupsById.clear();syncLanguageUi(S.state.current?.item);patchDebug({version:VERSION,threshold:SIMILARITY_THRESHOLD,candidates:rows.length,groups:0,collapsed:0});return}
    const hashes=new Map();
    await parallel(rows,async item=>{const h=await hashCover(coverUrl(item));if(h)hashes.set(S.id(item),h);return h},2);
    if(generation!==scanGeneration)return;
    const clusters=makeGroups(list,hashes,byName,byCover),result=collapse(list,clusters,hashes);
    sourceItems=list.slice();
    S.state.languageVariantGroups=result.groups;
    S.languageVariantsFor=item=>groupsById.get(S.id(item))||null;
    S.languageVariantPrimary=item=>groupsById.get(S.id(item))?.primary||item;
    if(result.groups.length&&typeof S.renderCatalogItems==='function'){
      const y=window.scrollY||0;S.__variantApplying=true;
      try{S.renderCatalogItems(result.items)}finally{S.__variantApplying=false}
      requestAnimationFrame(()=>{try{window.scrollTo(0,y)}catch{}})
    }
    syncLanguageUi(S.state.current?.item);
    patchDebug({version:VERSION,threshold:SIMILARITY_THRESHOLD,candidates:rows.length,hashed:hashes.size,groups:result.groups.length,collapsed:list.length-result.items.length})
  }finally{scanRunning=false}
}
function schedule(items){
  if(S.__variantApplying||window.__SRH_SAFE_MODE__)return;
  sourceItems=(Array.isArray(items)?items:S.state.items||[]).slice();
  clearTimeout(scanTimer);scanGeneration++;
  const run=()=>{scanTimer=0;scan(sourceItems)};
  if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1800});else scanTimer=setTimeout(run,650)
}
function ensureUi(){
  if(languageButton)return;
  const rail=document.querySelector('#shortPlayer .srh25-player__rail'),stage=document.getElementById('playerStage');if(!rail||!stage)return;
  if(!document.getElementById('srh25LanguageVariantStyle')){
    const st=document.createElement('style');st.id='srh25LanguageVariantStyle';
    st.textContent='.srh25-language-sheet{position:absolute;z-index:28;left:12px;right:12px;bottom:14px;max-height:min(54vh,430px);overflow:auto;padding:12px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(10,14,19,.94);box-shadow:0 18px 54px rgba(0,0,0,.46);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.srh25-language-sheet.is-hidden,.srh25-language-backdrop.is-hidden{display:none!important}.srh25-language-backdrop{position:absolute;z-index:27;inset:0;background:rgba(0,0,0,.25)}.srh25-language-head{display:flex;align-items:center;justify-content:space-between;margin:2px 3px 10px}.srh25-language-head strong{font:800 14px/1.2 system-ui;color:#fff}.srh25-language-close{width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:20px}.srh25-language-list{display:grid;gap:7px}.srh25-language-option{min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 13px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.055);color:#fff;text-align:left;font:700 12px/1.2 system-ui}.srh25-language-option.is-active{border-color:rgba(255,255,255,.42);background:rgba(255,255,255,.13)}.srh25-language-option small{font-size:9px;font-weight:650;opacity:.6}.srh25-player__action[hidden]{display:none!important}';
    document.head.appendChild(st)
  }
  languageButton=document.createElement('button');languageButton.type='button';languageButton.id='playerLanguages';languageButton.className='srh25-player__action';languageButton.hidden=true;languageButton.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4.5 12h15M12 4c2.2 2.4 3.2 5.1 3.2 8S14.2 17.6 12 20M12 4C9.8 6.4 8.8 9.1 8.8 12S9.8 17.6 12 20"/></svg><small>Idiomas</small>';
  const favorite=document.getElementById('playerFavorite');favorite?.insertAdjacentElement('afterend',languageButton);
  languageBackdrop=document.createElement('div');languageBackdrop.className='srh25-language-backdrop is-hidden';
  languageSheet=document.createElement('section');languageSheet.className='srh25-language-sheet is-hidden';languageSheet.innerHTML='<div class="srh25-language-head"><strong>Idiomas</strong><button class="srh25-language-close" type="button" aria-label="Fechar">×</button></div><div class="srh25-language-list"></div>';
  languageList=languageSheet.querySelector('.srh25-language-list');stage.append(languageBackdrop,languageSheet);
  const close=()=>{languageBackdrop.classList.add('is-hidden');languageSheet.classList.add('is-hidden')};
  languageButton.onclick=e=>{e.stopPropagation();renderLanguageOptions(S.state.current?.item);languageBackdrop.classList.remove('is-hidden');languageSheet.classList.remove('is-hidden')};
  languageBackdrop.onclick=close;languageSheet.querySelector('.srh25-language-close').onclick=close
}
function renderLanguageOptions(item){
  ensureUi();if(!languageList)return;
  const group=groupsById.get(S.id(item));languageList.replaceChildren();if(!group)return;
  const current=S.id(S.state.current?.item);
  for(const v of group.variants){
    const b=document.createElement('button');b.type='button';b.className='srh25-language-option';b.classList.toggle('is-active',v.id===current);
    const score=Math.round(Math.max(0,Math.min(1,Number(v.similarity)||0))*100);
    b.innerHTML='<span>'+v.label+'</span><small>'+(v.id===current?'Em reprodução':score+'% capa')+'</small>';
    b.onclick=()=>{const pos=Math.max(0,Number(document.getElementById('shortVideo')?.currentTime)||0),dur=Math.max(0,Number(document.getElementById('shortVideo')?.duration)||0);languageBackdrop.classList.add('is-hidden');languageSheet.classList.add('is-hidden');if(v.id!==current)S.openPlayer(v.item,{position:pos,duration:dur})};
    languageList.appendChild(b)
  }
}
function syncLanguageUi(item){
  ensureUi();if(!languageButton)return;
  const group=item?groupsById.get(S.id(item)):null,show=!!group&&group.variants.length>1;
  languageButton.hidden=!show;
  if(show)languageButton.querySelector('small').textContent='Idiomas';
  else{languageBackdrop?.classList.add('is-hidden');languageSheet?.classList.add('is-hidden')}
}
S.languageVariantDebug={version:VERSION,threshold:SIMILARITY_THRESHOLD,canonicalTitle,variantKind,similarity,groups:()=>[...(S.state.languageVariantGroups||[])]};
const baseOpen=S.openPlayer;
if(typeof baseOpen==='function')S.openPlayer=function(item,resume){const out=baseOpen.apply(this,arguments);syncLanguageUi(item);return out};
window.addEventListener('srh25:catalog-render',e=>schedule(e.detail?.items||S.state.items));
window.addEventListener('srh25:ready',()=>{ensureUi();schedule(S.state.items);syncLanguageUi(S.state.current?.item)});
setTimeout(()=>{ensureUi();if(S.state.items?.length)schedule(S.state.items)},900);
})();
