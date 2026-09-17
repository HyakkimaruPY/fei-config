/* SRHELL v6.6 — R18 validated CORS pool consumer.
   Validation/benchmarking is performed only by GitHub Actions. The browser
   consumes proxy-pool.json, caches the selected relay and refreshes the remote
   ranking after every three successful automatic-proxy uses. API/metadata only. */

const SRH_PROXY_POOL_R18='proxy-pool-r18';
const SRH_R18_POOL_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json';
const SRH_R18_DEFAULT_MAX_FALLBACKS=2;
const srhR18BaseRequest=request;
const srhR18State={pool:null,loading:null,servers:new Map()};

function srhR18Origin(cfg=CONFIG){try{return new URL(normalizeServer(cfg?.server||CONFIG.server)).origin}catch{return normalizeServer(cfg?.server||CONFIG.server)||'unknown'}}
function srhR18Safe(value){return String(value||'unknown').toLowerCase().replace(/[^a-z0-9._-]+/g,'_').slice(0,120)}
function srhR18Key(cfg=CONFIG){return 'srhell:r18:proxy:'+srhR18Safe(srhR18Origin(cfg))}
function srhR18Read(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??fallback}catch{return fallback}}
function srhR18Write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}

function srhR18ProxyUrl(template,target){
  const base=String(template||'').trim(),raw=String(target||'').trim();if(!base||!raw)return'';
  const encoded=encodeURIComponent(raw);
  if(base.includes('{rawUrl}'))return base.split('{rawUrl}').join(raw);
  if(base.includes('{raw}'))return base.split('{raw}').join(raw);
  if(base.includes('{url}'))return base.split('{url}').join(encoded);
  if(/[?&](?:url|target|uri|quest|q)=$/i.test(base)||base.endsWith('=')||base.endsWith('?'))return base+encoded;
  try{const u=new URL(base),keys=['url','target','uri','quest','q'],key=keys.find(k=>u.searchParams.has(k));u.searchParams.set(key||'url',raw);return u.toString()}catch{return''}
}

function srhR18NormalizePool(raw){
  const proxies=(Array.isArray(raw?.proxies)?raw.proxies:[])
    .filter(p=>p&&p.id&&p.template&&p.valid!==false&&p.enabled!==false)
    .map(p=>({
      id:String(p.id),name:String(p.name||p.id),template:String(p.template),
      priority:Number(p.priority||50),latencyMs:Number.isFinite(Number(p.latencyMs))?Number(p.latencyMs):Infinity,
      successRate:Number.isFinite(Number(p.successRate))?Number(p.successRate):1,
      validatedAt:String(p.validatedAt||'')
    }))
    .sort((a,b)=>(a.latencyMs-b.latencyMs)||(b.successRate-a.successRate)||(a.priority-b.priority)||a.id.localeCompare(b.id));
  if(!proxies.length)throw new Error('Pool validado sem proxies CORS disponíveis.');
  return {...raw,maxApiFallbacks:Math.max(1,Number(raw?.maxApiFallbacks||SRH_R18_DEFAULT_MAX_FALLBACKS)),proxies};
}

async function srhR18LoadPool(force=false){
  if(!force&&srhR18State.pool)return srhR18State.pool;
  if(srhR18State.loading)return srhR18State.loading;
  srhR18State.loading=(async()=>{
    const url=SRH_R18_POOL_URL+'?v='+Date.now();
    const response=await fetch(url,{cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('Pool HTTP '+response.status);
    const pool=srhR18NormalizePool(await response.json());srhR18State.pool=pool;return pool;
  })().finally(()=>{srhR18State.loading=null});
  return srhR18State.loading;
}

function srhR18ServerState(cfg=CONFIG){
  const origin=srhR18Origin(cfg);
  if(!srhR18State.servers.has(origin)){
    const cached=srhR18Read(srhR18Key(cfg),{})||{};
    srhR18State.servers.set(origin,{selectedId:String(cached.selectedId||''),selected:cached.selected||null,useCount:Number(cached.useCount||0),revision:String(cached.revision||'')});
  }
  return srhR18State.servers.get(origin);
}
function srhR18Persist(cfg,pool,entry,useCount){
  const s=srhR18ServerState(cfg);s.selectedId=entry?.id||'';s.selected=entry||null;s.revision=String(pool?.revision||'');s.useCount=Math.max(0,Number(useCount||0));
  srhR18Write(srhR18Key(cfg),{selectedId:s.selectedId,selected:s.selected,revision:s.revision,useCount:s.useCount});
}
function srhR18Best(pool){return pool?.proxies?.[0]||null}

async function srhR18SyncSelection(cfg=CONFIG,force=false){
  const s=srhR18ServerState(cfg),pool=await srhR18LoadPool(force),best=srhR18Best(pool);
  if(!best)return null;
  const current=pool.proxies.find(p=>p.id===s.selectedId);
  /* Ranking from the workflow is authoritative: on a new revision or forced
     refresh, switch to the fastest validated relay. */
  if(force||s.revision!==String(pool.revision||'')||!current||current.id!==best.id){srhR18Persist(cfg,pool,best,s.useCount);return best}
  s.selected=current;return current;
}

async function srhR18Order(cfg=CONFIG){
  const s=srhR18ServerState(cfg),out=[],push=p=>{if(p&&!out.some(x=>x.id===p.id))out.push(p)};
  /* Cached selection remains usable if GitHub is temporarily unreachable. */
  push(s.selected);
  try{const pool=await srhR18LoadPool(false),selected=await srhR18SyncSelection(cfg,false);push(selected);pool.proxies.forEach(push)}catch{}
  return out;
}

async function srhR18FetchJson(url,timeoutMs=15000){
  if(typeof srhR16FetchJson==='function')return srhR16FetchJson(url,timeoutMs);
  const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeoutMs):0;
  try{const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});if(!r.ok)throw new Error('HTTP '+r.status);const text=await r.text();return typeof srhR16ParseJsonBody==='function'?srhR16ParseJsonBody(text):JSON.parse(text)}finally{if(t)clearTimeout(t)}
}

function srhR18AfterSuccess(entry,cfg,pool){
  const s=srhR18ServerState(cfg),count=s.useCount+1;srhR18Persist(cfg,pool,entry,count);
  if(count>=3){
    s.useCount=0;srhR18Persist(cfg,pool,entry,0);
    /* No local validation: only re-download the workflow ranking. */
    srhR18SyncSelection(cfg,true).catch(()=>{});
  }
}

/* Load the already-validated ranking at boot. No network probe is made to any
   proxy here. */
(function srhR18Boot(){srhR18ServerState(CONFIG);srhR18SyncSelection(CONFIG,false).catch(()=>{})})();

request=async function(params={},cfg=CONFIG){
  try{return await srhR18BaseRequest(params,cfg)}catch(baseError){
    if(cfg?.autoCorsProxy===false)throw baseError;
    const order=await srhR18Order(cfg);if(!order.length)throw baseError;
    let pool=srhR18State.pool||{revision:'cached',maxApiFallbacks:SRH_R18_DEFAULT_MAX_FALLBACKS,proxies:order},last=baseError,attempts=0;
    const max=Math.max(1,Number(pool.maxApiFallbacks||SRH_R18_DEFAULT_MAX_FALLBACKS));
    const target=apiUrl(params,cfg);
    for(const entry of order){
      if(attempts>=max)break;attempts++;
      const proxied=srhR18ProxyUrl(entry.template,target);if(!proxied)continue;
      try{const data=await srhR18FetchJson(proxied,15000);srhR18AfterSuccess(entry,cfg,pool);return data}
      catch(e){last=e}
    }
    throw new Error(String(last?.message||baseError?.message||'Falha ao consultar a API Xtream.')+' · Proxies CORS validados também falharam.');
  }
};

try{window.SRHELL_PROXY_POOL={
  version:SRH_PROXY_POOL_R18,
  status:()=>{const s=srhR18ServerState(CONFIG),p=srhR18State.pool;return{origin:srhR18Origin(CONFIG),selectedId:s.selectedId,useCount:s.useCount,poolRevision:p?.revision||s.revision,generatedAt:p?.generatedAt||'',available:p?.proxies?.map(x=>({id:x.id,latencyMs:x.latencyMs,successRate:x.successRate}))||[]}},
  refresh:()=>srhR18SyncSelection(CONFIG,true)
}}catch{}
