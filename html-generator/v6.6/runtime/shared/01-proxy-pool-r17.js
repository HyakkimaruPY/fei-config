/* SRHELL v6.6 — R17 adaptive CORS proxy pool.
   API/metadata only: this module never rewires video/segment transport.
   The remote pool JSON is fetched on every app boot, while the fastest healthy
   proxy for each Xtream origin is cached in localStorage for immediate reuse. */

const SRH_PROXY_POOL_R17='proxy-pool-r17';
const SRH_R17_POOL_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json';
const SRH_R17_DEFAULTS={refreshMs:21600000,probeTimeoutMs:4200,maxConcurrent:2,maxApiFallbacks:2};
const srhR17PoolState={pool:null,loading:null,servers:new Map()};
const srhR17BaseRequest=request;

function srhR17ServerOrigin(cfg=CONFIG){
  try{return new URL(normalizeServer(cfg?.server||CONFIG.server)).origin}catch{return normalizeServer(cfg?.server||CONFIG.server)||'unknown'}
}
function srhR17SafeKey(value){return String(value||'unknown').toLowerCase().replace(/[^a-z0-9._-]+/g,'_').slice(0,120)}
function srhR17StorageKey(cfg=CONFIG){return 'srhell:r17:proxy:'+srhR17SafeKey(srhR17ServerOrigin(cfg))}
function srhR17MetricsKey(cfg=CONFIG){return 'srhell:r17:proxy-metrics:'+srhR17SafeKey(srhR17ServerOrigin(cfg))}
function srhR17ReadStorage(key,fallback){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch{return fallback}}
function srhR17WriteStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function srhR17AddUnique(out,value){const v=String(value||'').trim();if(v&&!out.includes(v))out.push(v)}

function srhR17ProxyUrl(template,target){
  const base=String(template||'').trim(),raw=String(target||'').trim();
  if(!base||!raw)return'';
  const encoded=encodeURIComponent(raw);
  if(base.includes('{rawUrl}'))return base.split('{rawUrl}').join(raw);
  if(base.includes('{raw}'))return base.split('{raw}').join(raw);
  if(base.includes('{url}'))return base.split('{url}').join(encoded);
  if(/[?&](?:url|target|uri|quest|q)=$/i.test(base)||base.endsWith('='))return base+encoded;
  if(base.endsWith('?'))return base+encoded;
  if(/\/fetch\/$/i.test(base))return base+raw;
  try{const u=new URL(base),keys=['url','target','uri','quest','q'],key=keys.find(k=>u.searchParams.has(k));u.searchParams.set(key||'url',raw);return u.toString()}catch{return''}
}

function srhR17CleanJsonText(value){
  let text=String(value??'').replace(/^\uFEFF+/,'').replace(/\u0000/g,'').trim();
  if(!text)return'';
  text=text.replace(/^\)\]\}',?\s*/,'').trim();
  if(/^\s*</.test(text)&&typeof DOMParser==='function'){
    try{const doc=new DOMParser().parseFromString(text,'text/html'),body=String(doc?.body?.textContent||'').trim();if(body)text=body}catch{}
  }
  return text;
}
function srhR17ParseJson(value){
  if(typeof srhR16ParseJsonBody==='function')return srhR16ParseJsonBody(value);
  const text=srhR17CleanJsonText(value);
  if(!text)throw new Error('A API respondeu sem conteúdo.');
  try{return JSON.parse(text)}catch{}
  const obj=text.indexOf('{'),arr=text.indexOf('[');let start=-1;
  if(obj>=0&&arr>=0)start=Math.min(obj,arr);else start=Math.max(obj,arr);
  if(start>=0){const opener=text[start],end=text.lastIndexOf(opener==='{'?'}':']');if(end>start)return JSON.parse(text.slice(start,end+1))}
  throw new Error('Resposta recebida, mas não foi possível interpretar o JSON.');
}
async function srhR17FetchJson(url,timeoutMs=14000){
  const controller=typeof AbortController==='function'?new AbortController():null,t=controller?setTimeout(()=>controller.abort(),timeoutMs):0;
  try{
    const response=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return srhR17ParseJson(await response.text());
  }finally{if(t)clearTimeout(t)}
}

async function srhR17LoadPool(){
  if(srhR17PoolState.loading)return srhR17PoolState.loading;
  srhR17PoolState.loading=(async()=>{
    const bucket=Math.floor(Date.now()/300000),url=SRH_R17_POOL_URL+'?v='+bucket;
    const response=await fetch(url,{cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('Pool HTTP '+response.status);
    const raw=await response.json(),proxies=(Array.isArray(raw?.proxies)?raw.proxies:[])
      .filter(x=>x&&x.enabled!==false&&x.id&&x.template)
      .map(x=>({id:String(x.id),name:String(x.name||x.id),template:String(x.template),priority:Number(x.priority||50)}));
    if(!proxies.length)throw new Error('Pool remoto sem proxies ativos.');
    srhR17PoolState.pool={...SRH_R17_DEFAULTS,...raw,proxies};
    return srhR17PoolState.pool;
  })().finally(()=>{srhR17PoolState.loading=null});
  return srhR17PoolState.loading;
}

function srhR17Metrics(cfg=CONFIG){return srhR17ReadStorage(srhR17MetricsKey(cfg),{})||{}}
function srhR17Record(entry,cfg,ok,latency){
  if(!entry?.id)return;
  const all=srhR17Metrics(cfg),m=all[entry.id]||{ok:0,fail:0,ewma:0,lastOk:0,lastFail:0};
  if(ok){m.ok++;m.lastOk=Date.now();if(Number.isFinite(latency)&&latency>0)m.ewma=m.ewma?Math.round(m.ewma*.68+latency*.32):Math.round(latency)}
  else{m.fail++;m.lastFail=Date.now()}
  all[entry.id]=m;srhR17WriteStorage(srhR17MetricsKey(cfg),all);
}
function srhR17Score(entry,cfg,probeLatency){
  const m=srhR17Metrics(cfg)[entry.id]||{},base=Number.isFinite(probeLatency)?probeLatency:(Number(m.ewma)||2500),total=(m.ok||0)+(m.fail||0),failRate=total?Number(m.fail||0)/total:0;
  return base*(1+failRate*2.5)+Number(entry.priority||50)*5;
}

async function srhR17Probe(entry,cfg=CONFIG,pool=srhR17PoolState.pool){
  const target=srhR17ServerOrigin(cfg)+'/',proxied=srhR17ProxyUrl(entry.template,target);
  if(!proxied)return{entry,ok:false,latency:Infinity};
  const controller=typeof AbortController==='function'?new AbortController():null,started=performance.now(),timer=controller?setTimeout(()=>controller.abort(),Number(pool?.probeTimeoutMs||4200)):0;
  try{
    const r=await fetch(proxied,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal});
    const latency=Math.max(1,Math.round(performance.now()-started)),ok=r.status>0&&r.status<500&&r.status!==429;
    srhR17Record(entry,cfg,ok,latency);return{entry,ok,latency,status:r.status};
  }catch(e){srhR17Record(entry,cfg,false,Infinity);return{entry,ok:false,latency:Infinity,error:e}}
  finally{if(timer)clearTimeout(timer)}
}

async function srhR17ProbeAll(cfg=CONFIG,excludeId=''){
  const pool=await srhR17LoadPool(),list=pool.proxies.filter(x=>x.id!==excludeId),results=new Array(list.length);let cursor=0;
  const workers=Array.from({length:Math.min(Number(pool.maxConcurrent||2),list.length)},async()=>{
    while(cursor<list.length){const i=cursor++;results[i]=await srhR17Probe(list[i],cfg,pool)}
  });
  await Promise.all(workers);
  return results.filter(x=>x?.ok).sort((a,b)=>srhR17Score(a.entry,cfg,a.latency)-srhR17Score(b.entry,cfg,b.latency));
}

function srhR17ServerState(cfg=CONFIG){
  const origin=srhR17ServerOrigin(cfg);
  if(!srhR17PoolState.servers.has(origin)){
    const cached=srhR17ReadStorage(srhR17StorageKey(cfg),null);
    srhR17PoolState.servers.set(origin,{selected:cached?.selected||null,selectedId:String(cached?.selectedId||''),chosenAt:Number(cached?.chosenAt||0),revision:String(cached?.revision||''),refreshing:null});
  }
  return srhR17PoolState.servers.get(origin);
}
function srhR17PersistSelected(entry,cfg,pool){
  const s=srhR17ServerState(cfg);s.selected=entry;s.selectedId=entry?.id||'';s.chosenAt=Date.now();s.revision=String(pool?.revision||'');
  srhR17WriteStorage(srhR17StorageKey(cfg),{selected:entry,selectedId:s.selectedId,chosenAt:s.chosenAt,revision:s.revision});
}

async function srhR17RefreshSelection(cfg=CONFIG,force=false,excludeId=''){
  const s=srhR17ServerState(cfg);
  if(s.refreshing)return s.refreshing;
  s.refreshing=(async()=>{
    const pool=await srhR17LoadPool(),cachedEntry=s.selectedId?pool.proxies.find(x=>x.id===s.selectedId):null,age=Date.now()-s.chosenAt,stale=force||!cachedEntry||s.revision!==String(pool.revision||'')||age>Number(pool.refreshMs||21600000);
    if(!stale&&cachedEntry&&!excludeId){s.selected=cachedEntry;return cachedEntry}
    if(cachedEntry&&!force&&cachedEntry.id!==excludeId){
      const check=await srhR17Probe(cachedEntry,cfg,pool);
      if(check.ok){srhR17PersistSelected(cachedEntry,cfg,pool);return cachedEntry}
    }
    const ranked=await srhR17ProbeAll(cfg,excludeId),winner=ranked[0]?.entry||null;
    if(winner)srhR17PersistSelected(winner,cfg,pool);else if(excludeId&&s.selectedId===excludeId){s.selected=null;s.selectedId=''}
    return winner;
  })().finally(()=>{s.refreshing=null});
  return s.refreshing;
}

async function srhR17CandidateOrder(cfg=CONFIG,excludeId=''){
  const pool=await srhR17LoadPool(),s=srhR17ServerState(cfg),out=[],push=e=>{if(e&&e.id!==excludeId&&!out.some(x=>x.id===e.id))out.push(e)};
  push(pool.proxies.find(x=>x.id===s.selectedId));
  const metrics=srhR17Metrics(cfg),rest=pool.proxies.filter(x=>x.id!==excludeId).sort((a,b)=>{
    const ma=metrics[a.id]||{},mb=metrics[b.id]||{};return srhR17Score(a,cfg,Number(ma.ewma)||Infinity)-srhR17Score(b,cfg,Number(mb.ewma)||Infinity)
  });
  rest.forEach(push);return out;
}

/* Every boot fetches the pool module. A cached winner is immediately available,
   then revalidated/refreshed in the background without exposing credentials. */
(function srhR17BootPool(){
  srhR17ServerState(CONFIG);
  srhR17LoadPool().then(()=>srhR17RefreshSelection(CONFIG,false)).catch(()=>{});
})();

/* Preserve direct/manual transport first. The public pool is an API-only fallback.
   At most two public relays receive an authenticated Xtream URL for one failed call. */
request=async function(params={},cfg=CONFIG){
  try{return await srhR17BaseRequest(params,cfg)}catch(baseError){
    let pool;
    try{pool=await srhR17LoadPool()}catch{return Promise.reject(baseError)}
    let order=await srhR17CandidateOrder(cfg),attempts=0,last=baseError;
    if(!order.length){const winner=await srhR17RefreshSelection(cfg,true);if(winner)order=[winner]}
    for(const entry of order){
      if(attempts>=Number(pool.maxApiFallbacks||2))break;attempts++;
      const target=apiUrl(params,cfg),proxied=srhR17ProxyUrl(entry.template,target),started=performance.now();
      if(!proxied)continue;
      try{
        const data=await srhR17FetchJson(proxied,15000),latency=Math.max(1,Math.round(performance.now()-started));
        srhR17Record(entry,cfg,true,latency);srhR17PersistSelected(entry,cfg,pool);return data;
      }catch(e){last=e;srhR17Record(entry,cfg,false,Infinity);if(srhR17ServerState(cfg).selectedId===entry.id)srhR17RefreshSelection(cfg,true,entry.id).catch(()=>{})}
    }
    throw new Error(String(last?.message||baseError?.message||'Falha ao consultar a API Xtream.')+' · Pool automático também foi testado.');
  }
};

/* Small diagnostic surface for DevTools without exposing usernames/passwords. */
try{
  window.SRHELL_PROXY_POOL={
    version:SRH_PROXY_POOL_R17,
    status:()=>{const s=srhR17ServerState(CONFIG);return{origin:srhR17ServerOrigin(CONFIG),selectedId:s.selectedId,chosenAt:s.chosenAt,poolRevision:srhR17PoolState.pool?.revision||'',available:srhR17PoolState.pool?.proxies?.map(x=>x.id)||[]}},
    refresh:()=>srhR17RefreshSelection(CONFIG,true)
  };
}catch{}
