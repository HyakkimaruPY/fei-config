/* SRHELL v6.6 — R20 builder.
   Shorts gets stable-flow virtualization. Standard keeps R15/R16 transport.
   Both generated modes use per-app/DNS proxy affinity from the validated pool. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r14.js?v=builder-r20-base2';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src.replace("const BUILD='aura-generator-r14';","const BUILD='aura-generator-r20';").replace(/shorts-aura-r14/g,'shorts-aura-r20').replace(/aura625-r14/g,'aura625-r20').replace(/App Shorts Aura R14/g,'App Shorts Aura R20').replace(/App padrão R14/g,'App padrão R20');
  src=src.replace("corsProxy:String(el.corsProxy.value||'').trim(),theme:chosenTheme()","corsProxy:String(el.corsProxy.value||'').trim(),autoCorsProxy:(document.getElementById('autoCorsProxyInput')?.checked!==false),theme:chosenTheme()");
  const reqStart=src.indexOf("async function request(action=''){");
  const reqEnd=reqStart>=0?src.indexOf("\nasync function requestWithRetry",reqStart):-1;
  if(reqStart>=0&&reqEnd>reqStart){
    const replacement=`
const SRH_GEN_POOL_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json';
let srhGenPool=null,srhGenPoolLoading=null;
function srhGenAutoEnabled(){return document.getElementById('autoCorsProxyInput')?.checked===true}
function srhGenKey(){let origin='unknown';try{origin=new URL(normalizeServer(el.server.value)).origin}catch{}const app=(el.appName.value.trim()||'app').toLowerCase().replace(/[^a-z0-9._-]+/g,'_');return 'srhell:generator:r20:'+app+':'+origin.toLowerCase().replace(/[^a-z0-9._-]+/g,'_')}
function srhGenRead(){try{return JSON.parse(localStorage.getItem(srhGenKey())||'null')||{}}catch{return{}}}
function srhGenWrite(v){try{localStorage.setItem(srhGenKey(),JSON.stringify(v))}catch{}}
function srhGenProxyTpl(t,target){const b=String(t||''),raw=String(target||''),enc=encodeURIComponent(raw);if(b.includes('{rawUrl}'))return b.replaceAll('{rawUrl}',raw);if(b.includes('{raw}'))return b.replaceAll('{raw}',raw);if(b.includes('{url}'))return b.replaceAll('{url}',enc);if(/[?&](?:url|target|uri|quest|q)=$/i.test(b)||b.endsWith('=')||b.endsWith('?'))return b+enc;try{const u=new URL(b),k=['url','target','uri','quest','q'].find(x=>u.searchParams.has(x));u.searchParams.set(k||'url',raw);return u.toString()}catch{return''}}
async function srhGenPoolLoad(force=false){if(!force&&srhGenPool)return srhGenPool;if(srhGenPoolLoading)return srhGenPoolLoading;srhGenPoolLoading=(async()=>{const rr=await fetch(SRH_GEN_POOL_URL+'?v='+Date.now(),{cache:'no-store'});if(!rr.ok)throw new Error('Pool HTTP '+rr.status);const raw=await rr.json(),proxies=(Array.isArray(raw?.proxies)?raw.proxies:[]).filter(x=>x&&x.id&&x.template&&x.valid!==false&&x.enabled!==false).sort((a,b)=>(Number(a.latencyMs)||999999)-(Number(b.latencyMs)||999999));return srhGenPool={...raw,proxies}})().finally(()=>{srhGenPoolLoading=null});return srhGenPoolLoading}
async function srhGenFetch(url,timeout=7000){const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeout):0;try{const rr=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain,*/*'}});if(!rr.ok)throw new Error('HTTP '+rr.status);const tx=(await rr.text()).replace(/^\uFEFF+/,'').trim();try{return JSON.parse(tx)}catch{const a=tx.indexOf('{'),b=tx.indexOf('['),s=a<0?b:b<0?a:Math.min(a,b),e=s>=0?tx.lastIndexOf(tx[s]==='{'?'}':']'):-1;if(e>s)return JSON.parse(tx.slice(s,e+1));throw new Error('resposta não é JSON')}}finally{if(t)clearTimeout(t)}}
async function request(action=''){const target=apiUrl(action),urls=[];pushUnique(urls,target);if(/^http:\/\//i.test(target))pushUnique(urls,schemeTwin(target,'https'));if(String(el.corsProxy.value||'').trim())pushUnique(urls,proxyUrl(target));let last;for(const u of urls){try{return await srhGenFetch(u,u===target?6500:9000)}catch(e){last=e}}
  if(!srhGenAutoEnabled())throw new Error((last?.message||'Falha no fetch.')+' · proxy automático desativado.');
  const cached=srhGenRead();if(cached.selected&&Number(cached.useCount||0)<3){try{const data=await srhGenFetch(srhGenProxyTpl(cached.selected.template,target),9000);srhGenWrite({...cached,useCount:Number(cached.useCount||0)+1});return data}catch{}}
  let pool;try{pool=await srhGenPoolLoad(Number(cached.useCount||0)>=3||!cached.selected)}catch{if(cached.selected){try{return await srhGenFetch(srhGenProxyTpl(cached.selected.template,target),9000)}catch{}}throw last}
  for(const p of pool.proxies.slice(0,2)){try{const data=await srhGenFetch(srhGenProxyTpl(p.template,target),9000);srhGenWrite({selected:p,useCount:1,revision:String(pool.revision||'')});return data}catch(e){last=e}}
  throw new Error((last?.message||'Falha no fetch.')+' · proxies CORS automáticos também falharam.')
}`;
    src=src.slice(0,reqStart)+replacement+src.slice(reqEnd);
  }
  src=src.replace("BASE+'/runtime/shorts/06-aura-player-polish-r14.css']","BASE+'/runtime/shorts/06-aura-player-polish-r14.css',BASE+'/runtime/shorts/07-performance-r20.css']");
  src=src.replace("BASE+'/runtime/shorts/07-aura-player-polish-r14.js']","BASE+'/runtime/shorts/07-aura-player-polish-r14.js',BASE+'/runtime/shared/01-proxy-pool-r20.js',BASE+'/runtime/shorts/08-performance-r20.js']");
  const needle="const mark=\"const allAssets=[...CSS_CORE,theme,...CSS_PATCHES,...JS_CORE,...JS_PATCHES];let loaded=0;\";";
  if(src.includes(needle)){const inject="if(!t.includes('13-transport-r15.js'))t=t.replace(\"BASE+'/runtime/standard/12-catalog-resilience-r12.js'];\",\"BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js'];\");"+"if(!t.includes('14-api-parser-r16.js'))t=t.replace(\"BASE+'/runtime/standard/13-transport-r15.js'];\",\"BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js'];\");"+"if(!t.includes('01-proxy-pool-r20.js'))t=t.replace(\"BASE+'/runtime/standard/14-api-parser-r16.js'];\",\"BASE+'/runtime/standard/14-api-parser-r16.js',BASE+'/runtime/shared/01-proxy-pool-r20.js'];\");"+needle;src=src.replace(needle,inject)}
  (0,eval)(src+'\n//# sourceURL=generator-r20-runtime.js');
  const proxyInput=document.getElementById('corsProxyInput');
  if(proxyInput&&!document.getElementById('autoCorsProxyInput')){const label=document.createElement('label');label.className='srh-auto-proxy-toggle';label.style.cssText='display:flex;align-items:center;gap:9px;margin-top:8px;padding:9px 10px;border:1px solid var(--line,#2c394a);border-radius:12px;font-size:11px;cursor:pointer';label.innerHTML='<input id="autoCorsProxyInput" type="checkbox" checked style="accent-color:var(--accent,#7aa2f7)"><span><strong>Proxy CORS automático</strong><br><small style="opacity:.68">Usar a lista validada pelo GitHub somente quando a conexão direta falhar.</small></span>';proxyInput.insertAdjacentElement('afterend',label)}
})().catch(e=>{const box=document.getElementById('statusBox');if(box){box.textContent='Falha ao iniciar R20: '+String(e?.message||e);box.className='status-strip err'}else console.error(e)});
