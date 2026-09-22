(()=>{
'use strict';
if(window.SRHDebug)return;
const VERSION='debug-supervisor-1';
const startedAt=Date.now();
const redactPattern=/(username|password|token|authorization|cookie|secret|key)=([^&\s]+)/ig;
const safeText=v=>String(v??'').replace(redactPattern,'$1=[redacted]').replace(/([?&](?:username|password|token|key)=)[^&#\s]+/ig,'$1[redacted]');
const clone=v=>{try{return structuredClone(v)}catch{try{return JSON.parse(JSON.stringify(v))}catch{return String(v)}}};
const now=()=>new Date().toISOString();
const uid=()=>Math.random().toString(36).slice(2,10);
const qs=new URLSearchParams(location.search);
const safeMode=qs.get('srhSafe')==='1'||(()=>{try{return localStorage.getItem('srh:debug:safe')==='1'}catch{return false}})();
window.__SRH_SAFE_MODE__=safeMode;
const bus=new EventTarget();
const state={boot:{status:'starting',phase:'bootstrap',startedAt},user:{},catalog:{},navigation:{},modal:{},player:{status:'idle'},history:{schema:2},favorites:{},tmdb:{},shorts:{},network:{active:0,total:0,failed:0},health:{},features:{safeMode}};
const listeners=new Map();
function notify(path,value){for(const [key,set] of listeners){if(path===key||path.startsWith(key+'.'))for(const fn of set)try{fn(clone(value),path)}catch{}}}
function get(path=''){if(!path)return state;return path.split('.').reduce((o,k)=>o?.[k],state)}
function set(path,value){const p=path.split('.'),last=p.pop();let o=state;for(const k of p)o=o[k]||(o[k]={});o[last]=value;notify(path,value);return value}
function patch(path,value){const prev=get(path);return set(path,{...(prev&&typeof prev==='object'?prev:{}),...(value&&typeof value==='object'?value:{})})}
function subscribe(path,fn){if(!listeners.has(path))listeners.set(path,new Set());listeners.get(path).add(fn);return()=>listeners.get(path)?.delete(fn)}
const logs=[];
function log(level,event,data={}){const row={time:now(),level,event:safeText(event),data:sanitize(data)};logs.push(row);if(logs.length>500)logs.splice(0,logs.length-500);bus.dispatchEvent(new CustomEvent('log',{detail:row}));return row}
function sanitize(v,depth=0){if(depth>5)return'[max-depth]';if(v==null||typeof v==='number'||typeof v==='boolean')return v;if(typeof v==='string')return safeText(v).slice(0,1600);if(Array.isArray(v))return v.slice(0,80).map(x=>sanitize(x,depth+1));if(typeof v==='object'){const out={};for(const [k,x] of Object.entries(v)){if(/pass|token|secret|cookie|authorization|credential/i.test(k))out[k]='[redacted]';else out[k]=sanitize(x,depth+1)}return out}return safeText(v)}
const originalFetch=window.fetch?.bind(window);
const requests=new Map();
const circuits=new Map();
function originOf(input){try{return new URL(typeof input==='string'?input:input.url,location.href).origin}catch{return'unknown'}}
function circuit(origin){if(!circuits.has(origin))circuits.set(origin,{fails:0,openUntil:0,lastError:''});return circuits.get(origin)}
function recordCircuit(origin,ok,error){const c=circuit(origin);if(ok){c.fails=0;c.openUntil=0;c.lastError='';return}c.fails++;c.lastError=safeText(error?.message||error);if(c.fails>=4)c.openUntil=Date.now()+30000}
if(originalFetch){
  window.fetch=async function debugFetch(input,init={}){
    const id=uid(),url=typeof input==='string'?input:input?.url||String(input),origin=originOf(input),c=circuit(origin);
    if(c.openUntil>Date.now()&&!init?.srhBypassCircuit){log('warn','network.circuit_open',{origin,url});throw new Error('Serviço temporariamente em recuperação')}
    const started=performance.now();requests.set(id,{id,url:safeText(url),origin,startedAt:Date.now()});patch('network',{active:requests.size,total:state.network.total+1});
    bus.dispatchEvent(new CustomEvent('request:start',{detail:{id,url:safeText(url),origin}}));
    try{
      const res=await originalFetch(input,init);recordCircuit(origin,res.ok,res.ok?null:new Error('HTTP '+res.status));if(!res.ok)state.network.failed++;
      log(res.ok?'info':'warn','network.response',{id,url,status:res.status,ms:Math.round(performance.now()-started)});return res
    }catch(e){state.network.failed++;recordCircuit(origin,false,e);log('error','network.error',{id,url,error:e?.message||String(e),ms:Math.round(performance.now()-started)});throw e
    }finally{requests.delete(id);patch('network',{active:requests.size,total:state.network.total,failed:state.network.failed});bus.dispatchEvent(new CustomEvent('request:end',{detail:{id}}))}
  };
}
const requestManager={
  pending:new Map(),controllers:new Map(),
  async run(key,factory,{group='default',retries=2,baseDelay=350,dedupe=true,circuitKey=''}={}){
    if(dedupe&&this.pending.has(key))return this.pending.get(key);
    const job=(async()=>{let last;for(let attempt=0;attempt<=retries;attempt++){const ctrl=new AbortController();this.controllers.set(key,{ctrl,group});try{return await factory({signal:ctrl.signal,attempt})}catch(e){last=e;if(e?.name==='AbortError')throw e;if(attempt<retries)await new Promise(r=>setTimeout(r,baseDelay*(2**attempt)+Math.floor(Math.random()*120)))}finally{this.controllers.delete(key)}}throw last})();
    this.pending.set(key,job);job.finally(()=>this.pending.delete(key));return job
  },
  cancel(key){this.controllers.get(key)?.ctrl.abort()},
  cancelGroup(group){for(const [k,x] of this.controllers)if(x.group===group){x.ctrl.abort();this.controllers.delete(k)}},
  snapshot(){return[...this.controllers].map(([key,x])=>({key,group:x.group}))}
};
const boot={
  tx:null,
  begin(meta={}){this.tx={id:uid(),startedAt:Date.now(),phases:[],meta:sanitize(meta)};set('boot',{status:'starting',phase:'begin',startedAt:this.tx.startedAt,tx:this.tx.id});log('info','boot.begin',meta);return this.tx.id},
  phase(name,meta={}){if(!this.tx)this.begin();this.tx.phases.push({name,at:Date.now(),meta:sanitize(meta)});patch('boot',{phase:name});log('info','boot.phase',{name,...meta})},
  commit(meta={}){patch('boot',{status:'ready',phase:'ready',readyAt:Date.now(),durationMs:Date.now()-(this.tx?.startedAt||startedAt)});log('info','boot.commit',meta);snapshotLastGood(meta)},
  fail(error,meta={}){patch('boot',{status:'error',phase:'failed',error:safeText(error?.message||error)});log('error','boot.fail',{error:error?.message||error,...meta})}
};
function storageKeys(){const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)out.push(k)}}catch{}return out}
const backupPrefix='srh:debug:backup:';
function backupKey(key){return backupPrefix+btoa(unescape(encodeURIComponent(key))).replace(/=+$/,'')}
function backupStorage(key,value){try{localStorage.setItem(backupKey(key),JSON.stringify({at:Date.now(),key,value}));return true}catch{return false}}
function normalizeHistoryRow(row){if(!row||typeof row!=='object')return null;const item=row.item&&typeof row.item==='object'?row.item:{};const id=String(row.id??item.stream_id??item.id??item.movie_id??'');if(!id)return null;const cleanItem={stream_id:item.stream_id??row.stream_id,id:item.id??row.item_id,name:item.name??row.title,title:item.title??row.title,stream_icon:item.stream_icon??row.image,movie_image:item.movie_image??row.image,cover:item.cover??row.image,container_extension:item.container_extension??row.container_extension};for(const k of Object.keys(cleanItem))if(cleanItem[k]==null||cleanItem[k]==='')delete cleanItem[k];return{id,title:String(row.title??item.name??item.title??''),image:String(row.image??item.stream_icon??item.movie_image??item.cover??''),position:Number(row.position||0),duration:Number(row.duration||0),updatedAt:Number(row.updatedAt||Date.now()),item:cleanItem}}
const storage={
  schema:2,
  migrate(){let changed=0,scanned=0;for(const key of storageKeys()){if(!/:history$/i.test(key)&&!/history/i.test(key))continue;let value;try{value=localStorage.getItem(key);const parsed=JSON.parse(value||'null');if(!Array.isArray(parsed))continue;scanned++;const next=parsed.map(normalizeHistoryRow).filter(Boolean).slice(0,100);const text=JSON.stringify(next);if(text!==value){backupStorage(key,value);localStorage.setItem(key,text);localStorage.setItem(key+':schema',String(this.schema));changed++}}catch(e){log('warn','storage.migration_skip',{key,error:e?.message||String(e)})}}patch('history',{schema:this.schema,migrated:changed,scanned});log('info','storage.migrated',{scanned,changed});return{scanned,changed}},
  rollback(key){try{const raw=localStorage.getItem(backupKey(key));if(!raw)return false;const b=JSON.parse(raw);if(b?.value==null)localStorage.removeItem(key);else localStorage.setItem(key,b.value);log('warn','storage.rollback',{key});return true}catch{return false}},
  export(includeSecrets=true){const data={version:VERSION,at:now(),location:{origin:location.origin,path:location.pathname},safeMode,appConfig:clone(window.__APP_CONFIG__||readAppConfig()),storage:{}};for(const key of storageKeys()){if(key.startsWith(backupPrefix))continue;try{data.storage[key]=localStorage.getItem(key)}catch{}}if(!includeSecrets)data.appConfig=sanitize(data.appConfig);return data},
  import(payload){if(!payload||typeof payload!=='object'||!payload.storage)throw new Error('Backup inválido');for(const [k,v] of Object.entries(payload.storage)){if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,String(v))}log('warn','storage.import',{keys:Object.keys(payload.storage).length});return true}
};
function readAppConfig(){try{return JSON.parse(document.getElementById('app-config')?.textContent||'{}')}catch{return{}}}
function snapshotLastGood(meta={}){try{const snap={at:Date.now(),version:VERSION,mode:window.__srhA?.m||'',revision:window.__SRH_DEBUG_BUILD__?.revision||'',meta:sanitize(meta),health:clone(state.health)};localStorage.setItem('srh:debug:last-good',JSON.stringify(snap))}catch{}}
const player={
  active:null,
  begin(kind='video',meta={}){this.end('replace');this.active={id:uid(),kind,startedAt:Date.now(),meta:sanitize(meta)};set('player',{status:'opening',...this.active});log('info','player.begin',this.active);return this.active.id},
  ready(meta={}){if(!this.active)this.begin();patch('player',{status:'playing',readyAt:Date.now(),...sanitize(meta)});log('info','player.ready',meta)},
  error(error){patch('player',{status:'error',error:safeText(error?.message||error)});log('error','player.error',{error:error?.message||error})},
  end(reason='close'){if(this.active)log('info','player.end',{id:this.active.id,reason,durationMs:Date.now()-this.active.startedAt});this.active=null;set('player',{status:'idle',reason})}
};
const extensions=new Map();
function registerExtension(name,extension){if(!name||extensions.has(name))return false;extensions.set(name,extension||{});try{extension?.install?.(api)}catch(e){log('error','extension.install_failed',{name,error:e?.message||String(e)});return false}log('info','extension.installed',{name});return true}
const preload={
  seen:new Set(),
  link(url,as='fetch'){if(!url||this.seen.has(url)||safeMode)return false;try{const l=document.createElement('link');l.rel=as==='connect'?'preconnect':'prefetch';l.href=url;if(as!=='connect')l.as=as;document.head.appendChild(l);this.seen.add(url);return true}catch{return false}},
  idle(){if(safeMode)return;const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(c?.saveData||/2g/.test(c?.effectiveType||''))return;const run=()=>{this.link('https://cdn.jsdelivr.net','connect');this.link('https://image.tmdb.org','connect');if(window.__srhA?.m==='h')this.link('https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js','script')};'requestIdleCallback'in window?requestIdleCallback(run,{timeout:2200}):setTimeout(run,1200)}
};
async function healthCheck(){const h={dom:!!document.body,storage:false,router:!!window.__srhA,video:!!document.createElement('video').canPlayType,fetch:typeof window.fetch==='function',abort:typeof AbortController==='function',cache:'caches'in window,safeMode};try{const k='srh:debug:probe';localStorage.setItem(k,'1');h.storage=localStorage.getItem(k)==='1';localStorage.removeItem(k)}catch{}h.mode=window.__srhA?.m||'unknown';h.revision=window.__SRH_DEBUG_BUILD__?.revision||'unknown';set('health',h);log(h.dom&&h.router?'info':'warn','health.check',h);return h}
function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0)}
function diagnostic(){return{build:clone(window.__SRH_DEBUG_BUILD__||{}),supervisor:VERSION,uptimeMs:Date.now()-startedAt,mode:window.__srhA?.m||'',safeMode,state:clone(state),requests:requestManager.snapshot(),circuits:[...circuits].map(([origin,x])=>({origin,...x})),logs:logs.slice(-120)}}
function panel(){if(document.getElementById('srhDebugPanel'))return;const root=document.createElement('div');root.id='srhDebugPanel';root.className='srh-debug-panel is-hidden';root.innerHTML='<div class="srh-debug-head"><strong>Diagnóstico</strong><button data-x="close" aria-label="Fechar">×</button></div><div class="srh-debug-status" data-x="status"></div><div class="srh-debug-actions"><button data-x="copy">Copiar diagnóstico</button><button data-x="export">Exportar configuração</button><button data-x="import">Importar configuração</button><button data-x="safe">Modo seguro</button><button data-x="migrate">Reparar dados</button></div><pre class="srh-debug-output" data-x="out"></pre><input type="file" data-x="file" accept="application/json" hidden>';
  document.body.appendChild(root);const q=s=>root.querySelector(s),out=q('[data-x="out"]'),status=q('[data-x="status"]');
  const render=()=>{const d=diagnostic();status.textContent=(d.state.health?.router?'Router OK':'Router ?')+' · '+(d.state.health?.storage?'Storage OK':'Storage bloqueado')+' · '+d.state.network.active+' req ativa(s)';out.textContent=JSON.stringify(d,null,2)};root.render=render;q('[data-x="close"]').onclick=()=>root.classList.add('is-hidden');q('[data-x="copy"]').onclick=async()=>{const t=JSON.stringify(diagnostic(),null,2);try{await navigator.clipboard.writeText(t);status.textContent='Diagnóstico copiado.'}catch{download('srhell-diagnostico.json',t)}};q('[data-x="export"]').onclick=()=>download('srhell-backup-debug.json',JSON.stringify(storage.export(true),null,2));q('[data-x="import"]').onclick=()=>q('[data-x="file"]').click();q('[data-x="file"]').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{storage.import(JSON.parse(await f.text()));status.textContent='Configuração importada. Recarregue para aplicar.'}catch(err){status.textContent='Falha: '+safeText(err?.message||err)}};q('[data-x="safe"]').onclick=()=>{try{localStorage.setItem('srh:debug:safe',safeMode?'0':'1')}catch{}const u=new URL(location.href);if(safeMode)u.searchParams.delete('srhSafe');else u.searchParams.set('srhSafe','1');location.href=u.href};q('[data-x="migrate"]').onclick=()=>{const r=storage.migrate();status.textContent='Reparo: '+r.changed+' alterado(s) em '+r.scanned+' base(s).';render()};bus.addEventListener('log',()=>{if(!root.classList.contains('is-hidden'))render()});render()}
function attachButton(){panel();const settings=document.querySelector('#settingsPanel .settings-panel__inner')||document.querySelector('#settingsPanel');let b=document.getElementById('srhDebugButton');if(!b){b=document.createElement('button');b.id='srhDebugButton';b.type='button';b.className='srh-debug-button';b.textContent='Diagnóstico';b.onclick=e=>{e.stopPropagation();const p=document.getElementById('srhDebugPanel');p.classList.toggle('is-hidden');p.render?.()}}if(settings){b.classList.remove('is-floating');settings.prepend(b)}else if(!b.isConnected){b.classList.add('is-floating');document.body.appendChild(b)}}
function bridge(){const S=window.SRH25;if(!S||S.__debugBridge||typeof S.openPlayer!=='function')return;S.__debugBridge=true;patch('shorts',{connected:true,appId:S.cfg?.appId||'',items:S.state?.items?.length||0});const oldOpen=S.openPlayer;S.openPlayer=function(item){player.begin('shorts',{id:S.id?.(item),title:S.title?.(item)});try{return oldOpen.apply(this,arguments)}catch(e){player.error(e);throw e}}}
function observeVideos(){document.addEventListener('loadedmetadata',e=>{if(e.target instanceof HTMLMediaElement)player.ready({duration:e.target.duration,src:safeText(e.target.currentSrc||'')})},true);document.addEventListener('error',e=>{if(e.target instanceof HTMLMediaElement)player.error(new Error('media error'))},true);document.addEventListener('ended',e=>{if(e.target instanceof HTMLMediaElement)player.end('ended')},true)}
function installGlobalErrors(){addEventListener('error',e=>log('error','window.error',{message:e.message,source:e.filename,line:e.lineno,col:e.colno}),true);addEventListener('unhandledrejection',e=>log('error','promise.rejection',{reason:e.reason?.message||String(e.reason)}))}
function init(){boot.begin(window.__SRH_DEBUG_BUILD__||{});boot.phase('supervisor');installGlobalErrors();observeVideos();storage.migrate();healthCheck();attachButton();preload.idle();setTimeout(()=>{bridge();attachButton()},0);setTimeout(()=>{bridge();attachButton()},500);setTimeout(()=>{bridge();attachButton()},1800);setTimeout(()=>{if(state.boot.status==='starting')boot.commit({reason:'watchdog-ready'})},2500)}
const api={version:VERSION,bus,state:{get,set,patch,subscribe,snapshot:()=>clone(state)},log,logs,boot,requests:requestManager,storage,player,preload,healthCheck,diagnostic,registerExtension,features:{safeMode},attachButton,bridge};
window.SRHDebug=Object.freeze(api);
init();
})();
