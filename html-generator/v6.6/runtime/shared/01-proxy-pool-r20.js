/* SRHELL v6.6 — R20 CORS relay affinity.
   No browser-side benchmark. GitHub Actions owns proxy validation/ranking.
   Request order: direct provider -> manual proxy -> cached automatic proxy ->
   workflow-ranked fallbacks. The automatic winner is scoped by app + DNS.
*/
const SRH_PROXY_POOL_R20='proxy-pool-r20';
const SRH_R20_POOL_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json';
const SRH_R20_DIRECT_TIMEOUT=6500;
const SRH_R20_PROXY_TIMEOUT=10000;
const SRH_R20_MAX_FALLBACKS=2;
const srhR20State={pool:null,loading:null,profiles:new Map()};

function srhR20Origin(cfg=CONFIG){try{return new URL(normalizeServer(cfg?.server||CONFIG.server)).origin}catch{return normalizeServer(cfg?.server||CONFIG.server)||'unknown'}}
function srhR20AppId(cfg=CONFIG){const raw=typeof APP_ID!=='undefined'?APP_ID:(cfg?.appId||cfg?.appName||CONFIG?.appId||CONFIG?.appName||'app');return String(raw||'app')}
function srhR20Safe(v){return String(v||'').toLowerCase().replace(/[^a-z0-9._-]+/g,'_').slice(0,140)}
function srhR20ProfileKey(cfg=CONFIG){return 'srhell:r20:proxy:'+srhR20Safe(srhR20AppId(cfg))+':'+srhR20Safe(srhR20Origin(cfg))}
function srhR20Read(k,f={}){try{return JSON.parse(localStorage.getItem(k)||'null')||f}catch{return f}}
function srhR20Write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
function srhR20Profile(cfg=CONFIG){const k=srhR20ProfileKey(cfg);if(!srhR20State.profiles.has(k)){const c=srhR20Read(k,{});srhR20State.profiles.set(k,{selected:c.selected||null,selectedId:String(c.selectedId||''),useCount:Number(c.useCount||0),revision:String(c.revision||'')})}return srhR20State.profiles.get(k)}
function srhR20Persist(cfg,entry,useCount,revision=''){const p=srhR20Profile(cfg);p.selected=entry||null;p.selectedId=entry?.id||'';p.useCount=Math.max(0,Number(useCount||0));p.revision=String(revision||p.revision||'');srhR20Write(srhR20ProfileKey(cfg),{selected:p.selected,selectedId:p.selectedId,useCount:p.useCount,revision:p.revision})}

function srhR20ProxyUrl(template,target){const base=String(template||'').trim(),raw=String(target||'').trim();if(!base||!raw)return'';const enc=encodeURIComponent(raw);if(base.includes('{rawUrl}'))return base.split('{rawUrl}').join(raw);if(base.includes('{raw}'))return base.split('{raw}').join(raw);if(base.includes('{url}'))return base.split('{url}').join(enc);if(/[?&](?:url|target|uri|quest|q)=$/i.test(base)||base.endsWith('=')||base.endsWith('?'))return base+enc;try{const u=new URL(base),keys=['url','target','uri','quest','q'],key=keys.find(k=>u.searchParams.has(k));u.searchParams.set(key||'url',raw);return u.toString()}catch{return''}}
function srhR20HttpsTwin(url){try{const u=new URL(String(url||''));if(u.protocol!=='http:')return'';u.protocol='https:';return u.href}catch{return''}}
function srhR20Push(out,v){v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)}
function srhR20Parse(text){if(typeof srhR16ParseJsonBody==='function')return srhR16ParseJsonBody(text);let s=String(text??'').replace(/^\uFEFF+/,'').replace(/\u0000/g,'').trim();try{return JSON.parse(s)}catch{}const a=s.indexOf('{'),b=s.indexOf('['),start=a<0?b:b<0?a:Math.min(a,b);if(start>=0){const end=s.lastIndexOf(s[start]==='{'?'}':']');if(end>start)return JSON.parse(s.slice(start,end+1))}throw new Error('Resposta da API não pôde ser interpretada.')}
async function srhR20FetchJson(url,timeoutMs){const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeoutMs):0;try{const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});if(!r.ok)throw new Error('HTTP '+r.status);return srhR20Parse(await r.text())}finally{if(t)clearTimeout(t)}}

function srhR20NormalizePool(raw){const proxies=(Array.isArray(raw?.proxies)?raw.proxies:[]).filter(x=>x&&x.id&&x.template&&x.valid!==false&&x.enabled!==false).map(x=>({id:String(x.id),name:String(x.name||x.id),template:String(x.template),latencyMs:Number.isFinite(Number(x.latencyMs))?Number(x.latencyMs):999999,successRate:Number.isFinite(Number(x.successRate))?Number(x.successRate):1,priority:Number(x.priority||50)})).sort((a,b)=>(a.latencyMs-b.latencyMs)||(b.successRate-a.successRate)||(a.priority-b.priority));return{...raw,proxies,maxApiFallbacks:Math.max(1,Number(raw?.maxApiFallbacks||SRH_R20_MAX_FALLBACKS))}}
async function srhR20LoadPool(force=false){if(!force&&srhR20State.pool)return srhR20State.pool;if(srhR20State.loading)return srhR20State.loading;srhR20State.loading=(async()=>{const r=await fetch(SRH_R20_POOL_URL+'?v='+Date.now(),{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('Pool HTTP '+r.status);return srhR20State.pool=srhR20NormalizePool(await r.json())})().finally(()=>{srhR20State.loading=null});return srhR20State.loading}

async function srhR20DirectAndManual(params,cfg){const target=apiUrl(params,cfg),urls=[];srhR20Push(urls,target);const twin=srhR20HttpsTwin(target);if(twin)srhR20Push(urls,twin);const manual=String(cfg?.corsProxy||'').trim();if(manual){for(const raw of [...urls]){const p=srhR20ProxyUrl(manual,raw);if(p)srhR20Push(urls,p)}}let last=null;for(let i=0;i<urls.length;i++){const isProxy=i>=2&&!!manual;try{return await srhR20FetchJson(urls[i],isProxy?SRH_R20_PROXY_TIMEOUT:SRH_R20_DIRECT_TIMEOUT)}catch(e){last=e}}throw last||new Error('Falha na conexão direta.')}

async function srhR20Automatic(params,cfg,baseError){if(cfg?.autoCorsProxy===false)throw baseError;const target=apiUrl(params,cfg),profile=srhR20Profile(cfg);let selected=profile.selected, pool=null;
  /* Fast path: three automatic uses reuse the last proven relay without even
     downloading the pool JSON. The fourth refreshes workflow ranking first. */
  if(selected&&profile.useCount<3){try{const data=await srhR20FetchJson(srhR20ProxyUrl(selected.template,target),SRH_R20_PROXY_TIMEOUT);srhR20Persist(cfg,selected,profile.useCount+1,profile.revision);return data}catch{selected=null}}
  try{pool=await srhR20LoadPool(profile.useCount>=3||!selected)}catch(e){if(selected){try{const data=await srhR20FetchJson(srhR20ProxyUrl(selected.template,target),SRH_R20_PROXY_TIMEOUT);srhR20Persist(cfg,selected,1,profile.revision);return data}catch{}}throw baseError}
  const order=[],push=x=>{if(x&&!order.some(y=>y.id===x.id))order.push(x)};const current=pool.proxies.find(x=>x.id===profile.selectedId);if(profile.useCount<3)push(current);pool.proxies.forEach(push);let last=baseError,attempts=0;for(const entry of order){if(attempts>=pool.maxApiFallbacks)break;attempts++;const proxied=srhR20ProxyUrl(entry.template,target);if(!proxied)continue;try{const data=await srhR20FetchJson(proxied,SRH_R20_PROXY_TIMEOUT);const nextCount=(entry.id===profile.selectedId&&profile.useCount<3)?profile.useCount+1:1;srhR20Persist(cfg,entry,nextCount,String(pool.revision||''));return data}catch(e){last=e}}
  throw new Error(String(last?.message||'Falha na API Xtream.')+' · conexão direta e proxies CORS falharam.')
}

request=async function(params={},cfg=CONFIG){try{return await srhR20DirectAndManual(params,cfg)}catch(e){return srhR20Automatic(params,cfg,e)}};

/* Prime only the tiny ranking document while the browser is idle. This never
   benchmarks/probes a relay and never blocks app startup. */
(function(){const p=srhR20Profile(CONFIG);if(p.selected)return;const fn=()=>srhR20LoadPool(false).catch(()=>{});if(typeof requestIdleCallback==='function')requestIdleCallback(fn,{timeout:2200});else setTimeout(fn,1200)})();

try{window.SRHELL_PROXY_POOL={version:SRH_PROXY_POOL_R20,status:()=>{const p=srhR20Profile(CONFIG),pool=srhR20State.pool;return{profile:srhR20ProfileKey(CONFIG),origin:srhR20Origin(CONFIG),selectedId:p.selectedId,useCount:p.useCount,refreshOnNext:p.useCount>=3,poolRevision:pool?.revision||p.revision,available:pool?.proxies?.map(x=>({id:x.id,latencyMs:x.latencyMs,successRate:x.successRate}))||[]}},refresh:()=>srhR20LoadPool(true),proxyMediaUrl:(target,cfg=CONFIG)=>{const p=srhR20Profile(cfg);return p.selected?.template?srhR20ProxyUrl(p.selected.template,target):''}}}catch{}
