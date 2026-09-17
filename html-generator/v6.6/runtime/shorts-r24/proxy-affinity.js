/* SRHELL Shorts R24 — API-only CORS affinity bridge.
   Loaded inside the original modular Shorts IIFE.
   Direct/manual first. The GitHub-validated automatic pool is only a fallback.
   No stream bytes are sent through the automatic proxy pool. */

const SRH_R24_POOL_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json';
const SRH_R24_DIRECT_TIMEOUT=5000;
const SRH_R24_PROXY_TIMEOUT=8500;
const srhR24ProxyState={pool:null,loading:null};

function srhR24Safe(v){return String(v||'').toLowerCase().replace(/[^a-z0-9._-]+/g,'_').slice(0,140)}
function srhR24Origin(cfg=CONFIG){try{return new URL(normalizeServer(cfg.server)).origin}catch{return normalizeServer(cfg.server)||'unknown'}}
function srhR24ProfileKey(cfg=CONFIG){return 'srhell:r24:shorts-proxy:'+srhR24Safe(APP_ID)+':'+srhR24Safe(srhR24Origin(cfg))}
function srhR24ReadProfile(cfg=CONFIG){try{return JSON.parse(localStorage.getItem(srhR24ProfileKey(cfg))||'null')||{}}catch{return{}}}
function srhR24WriteProfile(cfg,value){try{localStorage.setItem(srhR24ProfileKey(cfg),JSON.stringify(value));return true}catch{return false}}
function srhR24Https(url){try{const u=new URL(String(url||''));if(u.protocol!=='http:')return'';u.protocol='https:';return u.href}catch{return''}}
function srhR24Push(out,v){v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)}
function srhR24ProxyUrl(template,target){const b=String(template||'').trim(),raw=String(target||'').trim();if(!b||!raw)return'';const enc=encodeURIComponent(raw);if(b.includes('{rawUrl}'))return b.split('{rawUrl}').join(raw);if(b.includes('{raw}'))return b.split('{raw}').join(raw);if(b.includes('{url}'))return b.split('{url}').join(enc);if(/[?&](?:url|target|uri|quest|q)=$/i.test(b)||b.endsWith('=')||b.endsWith('?'))return b+enc;try{const u=new URL(b),keys=['url','target','uri','quest','q'],key=keys.find(k=>u.searchParams.has(k));u.searchParams.set(key||'url',raw);return u.toString()}catch{return''}}
function srhR24ParseJson(text){let s=String(text??'').replace(/^\uFEFF+/,'').replace(/\u0000/g,'').trim();if(/^<pre[\s>]/i.test(s))s=s.replace(/^<pre[^>]*>/i,'').replace(/<\/pre>\s*$/i,'').trim();try{let v=JSON.parse(s);if(typeof v==='string'){try{v=JSON.parse(v)}catch{}}return v}catch{}const a=s.indexOf('{'),b=s.indexOf('['),start=a<0?b:b<0?a:Math.min(a,b);if(start>=0){const end=s.lastIndexOf(s[start]==='{'?'}':']');if(end>start)return JSON.parse(s.slice(start,end+1))}throw new Error('Resposta Xtream não pôde ser interpretada como JSON.')}
async function srhR24FetchJson(url,timeoutMs){const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeoutMs):0;try{const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});if(!r.ok)throw new Error('HTTP '+r.status);return srhR24ParseJson(await r.text())}finally{if(t)clearTimeout(t)}}
async function srhR24LoadPool(force=false){if(!force&&srhR24ProxyState.pool)return srhR24ProxyState.pool;if(srhR24ProxyState.loading)return srhR24ProxyState.loading;srhR24ProxyState.loading=(async()=>{const r=await fetch(SRH_R24_POOL_URL+'?v='+Date.now(),{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('Pool HTTP '+r.status);const raw=await r.json(),proxies=(Array.isArray(raw?.proxies)?raw.proxies:[]).filter(x=>x&&x.id&&x.template&&x.valid!==false&&x.enabled!==false).sort((a,b)=>(Number(a.latencyMs)||999999)-(Number(b.latencyMs)||999999));return srhR24ProxyState.pool={...raw,proxies}})().finally(()=>{srhR24ProxyState.loading=null});return srhR24ProxyState.loading}
async function srhR24TryDirect(target,cfg){const urls=[];srhR24Push(urls,target);const twin=srhR24Https(target);if(twin)srhR24Push(urls,twin);const manual=String(cfg?.corsProxy||'').trim();if(manual){for(const raw of [...urls]){const p=srhR24ProxyUrl(manual,raw);if(p)srhR24Push(urls,p)}}let last=null;for(let i=0;i<urls.length;i++){try{return await srhR24FetchJson(urls[i],i<2?SRH_R24_DIRECT_TIMEOUT:SRH_R24_PROXY_TIMEOUT)}catch(e){last=e}}throw last||new Error('Falha na conexão direta.')}
async function srhR24TryAuto(target,cfg,baseError){if(cfg?.autoCorsProxy===false)throw baseError;const profile=srhR24ReadProfile(cfg),selected=profile.selected||null,useCount=Number(profile.useCount||0);let last=baseError;
  if(selected&&useCount<3){try{const data=await srhR24FetchJson(srhR24ProxyUrl(selected.template,target),SRH_R24_PROXY_TIMEOUT);srhR24WriteProfile(cfg,{selected,selectedId:selected.id||'',useCount:useCount+1,revision:profile.revision||''});return data}catch(e){last=e}}
  let pool=null;try{pool=await srhR24LoadPool(!selected||useCount>=3)}catch(e){last=e}
  if(!pool&&selected){try{const data=await srhR24FetchJson(srhR24ProxyUrl(selected.template,target),SRH_R24_PROXY_TIMEOUT);srhR24WriteProfile(cfg,{selected,selectedId:selected.id||'',useCount:1,revision:profile.revision||''});return data}catch(e){last=e}}
  if(pool){const order=[];const push=x=>{if(x&&!order.some(y=>y.id===x.id))order.push(x)};if(useCount<3)push(pool.proxies.find(x=>x.id===profile.selectedId));pool.proxies.forEach(push);for(const entry of order.slice(0,2)){const u=srhR24ProxyUrl(entry.template,target);if(!u)continue;try{const data=await srhR24FetchJson(u,SRH_R24_PROXY_TIMEOUT);srhR24WriteProfile(cfg,{selected:entry,selectedId:entry.id,useCount:1,revision:String(pool.revision||'')});return data}catch(e){last=e}}}
  throw new Error((last?.message||'Falha na API Xtream.')+' · conexão direta e proxies CORS falharam.')
}

request=async function(params={},cfg=CONFIG){const target=apiUrl(params,cfg);try{return await srhR24TryDirect(target,cfg)}catch(e){return srhR24TryAuto(target,cfg,e)}};
