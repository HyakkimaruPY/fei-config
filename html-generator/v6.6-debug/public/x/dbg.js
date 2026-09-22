(()=>{
'use strict';
if(window.SRHDebug)return;

const VERSION='debug-supervisor-2';
const STORAGE_SCHEMA=3;
const HISTORY_SCHEMA=3;
const CACHE_SCHEMA=2;
const startedAt=Date.now();
const qs=new URLSearchParams(location.search);
const safeMode=qs.get('srhSafe')==='1'||(()=>{try{return localStorage.getItem('srh:debug:safe')==='1'}catch{return false}})();
window.__SRH_SAFE_MODE__=safeMode;

const redactPattern=/(username|password|token|authorization|cookie|secret|key)=([^&\s]+)/ig;
const safeText=v=>String(v??'').replace(redactPattern,'$1=[redacted]').replace(/([?&](?:username|password|token|key)=)[^&#\s]+/ig,'$1[redacted]');
const clone=v=>{try{return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}catch{return String(v)}};
const now=()=>new Date().toISOString();
const uid=()=>Math.random().toString(36).slice(2,10);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const bus=new EventTarget();

const state={
  meta:{schema:1,supervisor:VERSION,startedAt,safeMode},
  boot:{status:'starting',phase:'bootstrap',startedAt},
  app:{mode:'',name:'',id:'',manifest:null},
  user:{},
  catalog:{},
  navigation:{id:0,status:'idle',reason:'boot'},
  modal:{},
  player:{status:'idle',session:null},
  history:{schema:HISTORY_SCHEMA,count:0},
  favorites:{count:0},
  tmdb:{},
  shorts:{},
  storage:{schema:STORAGE_SCHEMA,migrations:[]},
  cache:{schema:CACHE_SCHEMA,hits:0,misses:0,stale:0},
  network:{active:0,total:0,failed:0,retries:0,aborted:0},
  regression:{status:'idle',last:null},
  health:{},
  features:{safeMode}
};
const listeners=new Map();
function notify(path,value){for(const [key,set] of listeners){if(path===key||path.startsWith(key+'.'))for(const fn of set)try{fn(clone(value),path)}catch{}}}
function get(path=''){if(!path)return state;return path.split('.').reduce((o,k)=>o?.[k],state)}
function set(path,value){const p=path.split('.'),last=p.pop();let o=state;for(const k of p)o=o[k]||(o[k]={});o[last]=value;notify(path,value);return value}
function patch(path,value){const prev=get(path);return set(path,{...(prev&&typeof prev==='object'?prev:{}),...(value&&typeof value==='object'?value:{})})}
function subscribe(path,fn){if(!listeners.has(path))listeners.set(path,new Set());listeners.get(path).add(fn);return()=>listeners.get(path)?.delete(fn)}
function transaction(label,fn){const before=clone(state);try{const value=fn(state);log('info','state.transaction',{label});return value}catch(e){Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,before);log('error','state.transaction_rollback',{label,error:e?.message||String(e)});throw e}}

const logs=[];
function sanitize(v,depth=0){if(depth>5)return'[max-depth]';if(v==null||typeof v==='number'||typeof v==='boolean')return v;if(typeof v==='string')return safeText(v).slice(0,1800);if(Array.isArray(v))return v.slice(0,100).map(x=>sanitize(x,depth+1));if(typeof v==='object'){const out={};for(const [k,x] of Object.entries(v)){if(/pass|token|secret|cookie|authorization|credential/i.test(k))out[k]='[redacted]';else out[k]=sanitize(x,depth+1)}return out}return safeText(v)}
function log(level,event,data={}){const row={time:now(),level,event:safeText(event),data:sanitize(data)};logs.push(row);if(logs.length>600)logs.splice(0,logs.length-600);bus.dispatchEvent(new CustomEvent('log',{detail:row}));return row}

function readAppConfig(){try{return JSON.parse(document.getElementById('app-config')?.textContent||'{}')}catch{return{}}}
function readBuildManifest(){try{return JSON.parse(document.getElementById('srh-build-manifest')?.textContent||'null')}catch{return null}}
function syncAppState(){const cfg=readAppConfig(),manifest=readBuildManifest();patch('app',{mode:cfg.appMode||window.__SRH_DEBUG_BUILD__?.mode||'',name:cfg.appName||'',id:cfg.appId||'',manifest});return{cfg,manifest}}

const boot={
  tx:null,
  begin(meta={}){this.tx={id:uid(),startedAt:Date.now(),phases:[],meta:sanitize(meta)};set('boot',{status:'starting',phase:'begin',startedAt:this.tx.startedAt,tx:this.tx.id});log('info','boot.begin',meta);return this.tx.id},
  phase(name,meta={}){if(!this.tx)this.begin();this.tx.phases.push({name,at:Date.now(),meta:sanitize(meta)});patch('boot',{phase:name});log('info','boot.phase',{name,...meta})},
  commit(meta={}){patch('boot',{status:'ready',phase:'ready',readyAt:Date.now(),durationMs:Date.now()-(this.tx?.startedAt||startedAt)});log('info','boot.commit',meta);snapshotLastGood(meta)},
  fail(error,meta={}){patch('boot',{status:'error',phase:'failed',error:safeText(error?.message||error)});log('error','boot.fail',{error:error?.message||error,...meta})}
};

function storageKeys(){const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)out.push(k)}}catch{}return out}
const backupPrefix='srh:debug:backup:';
const tempPrefix='srh:debug:tmp:';
function encodedKey(key){try{return btoa(unescape(encodeURIComponent(key))).replace(/=+$/,'')}catch{return hash(key)}}
function backupKey(key){return backupPrefix+encodedKey(key)}
function tempKey(key){return tempPrefix+encodedKey(key)}
function backupStorage(key,value,schema){try{localStorage.setItem(backupKey(key),JSON.stringify({at:Date.now(),key,schema,value}));return true}catch{return false}}
function normalizeHistoryRow(row){
  if(!row||typeof row!=='object')return null;
  const item=row.item&&typeof row.item==='object'?row.item:{};
  const id=String(row.contentId??row.id??item.stream_id??item.id??item.movie_id??'');
  if(!id)return null;
  const transient=/^(url|streamUrl|playUrl|source|player|proxy|token|headers|resumeUrl)$/i;
  const cleanItem={};
  for(const [k,v] of Object.entries({
    stream_id:item.stream_id??row.stream_id,id:item.id??row.item_id,name:item.name??row.title,title:item.title??row.title,
    stream_icon:item.stream_icon??row.image,movie_image:item.movie_image??row.image,cover:item.cover??row.image,
    container_extension:item.container_extension??row.container_extension,series_id:item.series_id??row.series_id,episode_num:item.episode_num??row.episode_num
  }))if(v!=null&&v!==''&&!transient.test(k))cleanItem[k]=v;
  let position=Math.max(0,Number(row.position??row.progress??0)||0),duration=Math.max(0,Number(row.duration||0)||0);
  if(duration>0&&position>=duration-2)position=0;
  return{
    schema:HISTORY_SCHEMA,
    contentId:id,id,
    contentType:String(row.contentType??row.type??'vod'),
    episodeId:row.episodeId!=null?String(row.episodeId):undefined,
    title:String(row.title??item.name??item.title??''),
    image:String(row.image??item.stream_icon??item.movie_image??item.cover??''),
    position,duration,updatedAt:Number(row.updatedAt||Date.now()),item:cleanItem
  };
}
const migrations={
  history:[
    {from:0,to:1,up:list=>Array.isArray(list)?list.map(x=>({...x,contentId:String(x?.contentId??x?.id??x?.item?.stream_id??x?.item?.id??'')})).filter(x=>x.contentId):[]},
    {from:1,to:2,up:list=>(Array.isArray(list)?list:[]).map(normalizeHistoryRow).filter(Boolean)},
    {from:2,to:3,up:list=>(Array.isArray(list)?list:[]).map(normalizeHistoryRow).filter(Boolean).slice(0,100)}
  ],
  runtime:[
    {from:0,to:1,up:v=>v&&typeof v==='object'?v:{}},
    {from:1,to:2,up:v=>({...v,schema:2})},
    {from:2,to:3,up:v=>({...v,schema:3})}
  ]
};
function kindForKey(key){if(/history/i.test(key))return'history';if(/:runtime:/i.test(key))return'runtime';return null}
function migrateKey(key,kind){
  const schemaKey=key+':schema';
  let raw,parsed,current=0;
  try{raw=localStorage.getItem(key);if(raw==null)return{key,kind,changed:false,from:0,to:0};parsed=JSON.parse(raw);current=Math.max(0,Number(localStorage.getItem(schemaKey)||parsed?.schema||0)||0)}catch(e){log('warn','storage.parse_failed',{key,error:e?.message||String(e)});return{key,kind,changed:false,error:true}}
  const target=kind==='history'?HISTORY_SCHEMA:STORAGE_SCHEMA;
  if(current>=target)return{key,kind,changed:false,from:current,to:current};
  const originalRaw=raw,from=current;
  try{
    let value=parsed;
    for(const step of migrations[kind]||[]){if(step.from===current){value=step.up(value);current=step.to}}
    if(current!==target)throw new Error('Cadeia de migração incompleta: '+from+' → '+target);
    const next=JSON.stringify(value),tmp=tempKey(key);
    backupStorage(key,originalRaw,from);
    localStorage.setItem(tmp,next);
    JSON.parse(localStorage.getItem(tmp)||'null');
    localStorage.setItem(key,next);
    localStorage.setItem(schemaKey,String(target));
    localStorage.removeItem(tmp);
    log('info','storage.migrated_key',{key,kind,from,to:target});
    return{key,kind,changed:true,from,to:target}
  }catch(e){try{localStorage.setItem(key,originalRaw);localStorage.removeItem(tempKey(key))}catch{}log('error','storage.migration_failed',{key,kind,error:e?.message||String(e)});return{key,kind,changed:false,error:true,from,to:current}}
}
const storage={
  schema:STORAGE_SCHEMA,
  historySchema:HISTORY_SCHEMA,
  migrate(){
    const rows=[];
    for(const key of storageKeys()){const kind=kindForKey(key);if(kind)rows.push(migrateKey(key,kind))}
    const changed=rows.filter(x=>x.changed).length;
    patch('storage',{schema:STORAGE_SCHEMA,migrations:rows});
    syncLibraryState();
    log('info','storage.migration_summary',{scanned:rows.length,changed});
    return{scanned:rows.length,changed,rows}
  },
  rollback(key){try{const raw=localStorage.getItem(backupKey(key));if(!raw)return false;const b=JSON.parse(raw);if(b?.value==null)localStorage.removeItem(key);else localStorage.setItem(key,b.value);if(Number.isFinite(Number(b?.schema)))localStorage.setItem(key+':schema',String(b.schema));log('warn','storage.rollback',{key});syncLibraryState();return true}catch{return false}},
  export(includeSecrets=true){const data={version:VERSION,schemas:{storage:STORAGE_SCHEMA,history:HISTORY_SCHEMA},at:now(),build:clone(window.__SRH_DEBUG_BUILD__||{}),manifest:readBuildManifest(),safeMode,appConfig:readAppConfig(),storage:{}};for(const key of storageKeys()){if(key.startsWith(backupPrefix)||key.startsWith(tempPrefix))continue;try{data.storage[key]=localStorage.getItem(key)}catch{}}if(!includeSecrets){data.appConfig=sanitize(data.appConfig);data.storage=sanitize(data.storage)}return data},
  import(payload){if(!payload||typeof payload!=='object'||!payload.storage)throw new Error('Backup inválido');for(const [k,v] of Object.entries(payload.storage)){if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,String(v))}log('warn','storage.import',{keys:Object.keys(payload.storage).length});this.migrate();return true}
};

function countStored(pattern){let count=0;for(const key of storageKeys()){if(!pattern.test(key))continue;try{const v=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(v))count+=v.length;else if(v&&typeof v==='object')count+=Object.keys(v).length}catch{}}return count}
function syncLibraryState(){patch('history',{schema:HISTORY_SCHEMA,count:countStored(/history/i)});patch('favorites',{count:countStored(/favorites/i)})}

const nativeStorageSet=Storage?.prototype?.setItem;
const nativeStorageRemove=Storage?.prototype?.removeItem;
if(nativeStorageSet&&nativeStorageRemove){
  Storage.prototype.setItem=function(k,v){const out=nativeStorageSet.call(this,k,v);if(this===localStorage){const key=String(k);if(/history|favorites/i.test(key))queueMicrotask(syncLibraryState);if(/:runtime:/i.test(key))queueMicrotask(()=>{cache.invalidate('catalog');cache.invalidate('api');navigation.begin('runtime-change')})}return out};
  Storage.prototype.removeItem=function(k){const out=nativeStorageRemove.call(this,k);if(this===localStorage){const key=String(k);if(/history|favorites/i.test(key))queueMicrotask(syncLibraryState);if(/:runtime:/i.test(key))queueMicrotask(()=>{cache.invalidate('catalog');cache.invalidate('api')})}return out};
}

const cachePrefix='srh:debug:cache:';
const cacheVersions={catalog:3,tmdb:2,api:2};
function cachePolicy(url){
  const s=String(url);
  if(/image\.tmdb\.org/i.test(s))return null;
  if(/api\.themoviedb\.org|\/3\/(?:search|movie|tv|configuration)/i.test(s))return{ns:'tmdb',ttl:6*3600e3,stale:24*3600e3};
  if(/player_api\.php/i.test(s)&&/(get_(?:live|vod|series)_(?:categories|streams)|get_series_info|get_vod_info)/i.test(s))return{ns:'catalog',ttl:30000,stale:5*60e3};
  if(/player_api\.php|\.json(?:$|\?)/i.test(s))return{ns:'api',ttl:15000,stale:60000};
  return null;
}
function cacheKey(ns,url){return cachePrefix+ns+':v'+(cacheVersions[ns]||1)+':'+hash(url)}
const cache={
  schema:CACHE_SCHEMA,
  get(ns,url,{allowStale=true}={}){
    try{
      const raw=localStorage.getItem(cacheKey(ns,url));if(!raw){state.cache.misses++;return null}
      const x=JSON.parse(raw),age=Date.now()-Number(x.at||0),fresh=age<=Number(x.ttl||0),stale=allowStale&&age<=Number(x.stale||0);
      if(!fresh&&!stale){localStorage.removeItem(cacheKey(ns,url));state.cache.misses++;return null}
      if(fresh)state.cache.hits++;else state.cache.stale++;
      patch('cache',{hits:state.cache.hits,misses:state.cache.misses,stale:state.cache.stale,last:{ns,url:safeText(url),fresh,age}});
      return{...x,fresh,age}
    }catch{state.cache.misses++;return null}
  },
  put(ns,url,response,body,policy){
    try{if(body.length>700000)return false;const payload={at:Date.now(),ttl:policy.ttl,stale:policy.stale,status:response.status,statusText:response.statusText,contentType:response.headers?.get?.('content-type')||'application/json',body,build:window.__SRH_DEBUG_BUILD__?.baseRevision||''};localStorage.setItem(cacheKey(ns,url),JSON.stringify(payload));return true}catch{return false}
  },
  response(entry){try{return typeof Response==='function'?new Response(entry.body,{status:entry.status||200,statusText:entry.statusText||'OK',headers:{'content-type':entry.contentType||'application/json','x-srh-cache':entry.fresh?'hit':'stale'}}):null}catch{return null}},
  invalidate(ns){let removed=0;for(const key of storageKeys())if(key.startsWith(cachePrefix+ns+':')){try{localStorage.removeItem(key);removed++}catch{}}log('info','cache.invalidate',{ns,removed});return removed},
  invalidateAll(){return Object.keys(cacheVersions).reduce((n,ns)=>n+this.invalidate(ns),0)},
  prune(){let removed=0;for(const key of storageKeys())if(key.startsWith(cachePrefix)){const m=key.match(/^srh:debug:cache:([^:]+):v(\d+):/);if(!m||Number(m[2])!==(cacheVersions[m[1]]||1)){try{localStorage.removeItem(key);removed++}catch{}}}if(removed)log('info','cache.prune',{removed});return removed}
};

const navigation={
  controller:null,
  seq:0,
  begin(reason='navigation'){
    if(this.controller)try{this.controller.abort('superseded')}catch{}
    this.controller=typeof AbortController==='function'?new AbortController():null;
    const id=++this.seq;
    set('navigation',{id,status:'active',reason,startedAt:Date.now()});
    log('info','navigation.begin',{id,reason});
    return this.controller?.signal||null
  },
  signal(){return this.controller?.signal||null},
  end(id=this.seq){if(id!==this.seq)return;patch('navigation',{status:'idle',endedAt:Date.now()})},
  abort(reason='cancelled'){if(this.controller)try{this.controller.abort(reason)}catch{}patch('navigation',{status:'aborted',reason});state.network.aborted++;log('info','navigation.abort',{reason})}
};
function combineSignals(a,b){
  if(!a)return b||undefined;if(!b)return a;
  if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.any==='function')return AbortSignal.any([a,b]);
  if(typeof AbortController!=='function')return a;
  const c=new AbortController(),abort=()=>{try{c.abort()}catch{}};
  if(a.aborted||b.aborted)abort();else{a.addEventListener('abort',abort,{once:true});b.addEventListener('abort',abort,{once:true})}
  return c.signal
}
function isNavigationRequest(url){return /player_api\.php|api\.themoviedb\.org/i.test(String(url))}
function classifyIntent(target){
  const el=target?.closest?.('button,a,[role="button"],[data-type],[data-id],[data-category-id],.card,.srh25-card');
  if(!el)return'';
  const text=((el.className||'')+' '+(el.id||'')+' '+Object.keys(el.dataset||{}).join(' ')).toLowerCase();
  if(/player|play|pause|volume|fit|arc|close|favorite|settings|debug/.test(text))return'';
  if(/card|category|tab|nav|hero|search|type|library|history/.test(text))return'ui:'+text.slice(0,80);
  return'';
}
document.addEventListener('click',e=>{const why=classifyIntent(e.target);if(why)navigation.begin(why)},true);
addEventListener('popstate',()=>navigation.begin('popstate'));
addEventListener('hashchange',()=>navigation.begin('hashchange'));

const requests=new Map();
const circuits=new Map();
function serviceKey(url){try{const u=new URL(url,location.href);let family='generic';if(/themoviedb/i.test(u.hostname))family='tmdb';else if(/player_api\.php/i.test(u.pathname))family='xtream';else if(/proxy|cors/i.test(u.hostname+u.pathname))family='proxy';return u.origin+'|'+family}catch{return'unknown'}}
function circuit(key){if(!circuits.has(key))circuits.set(key,{fails:0,openUntil:0,halfOpen:false,lastError:''});return circuits.get(key)}
function recordCircuit(key,ok,error){
  const c=circuit(key);
  if(ok){c.fails=0;c.openUntil=0;c.halfOpen=false;c.lastError='';return}
  c.fails++;c.lastError=safeText(error?.message||error);
  if(c.fails>=4){c.openUntil=Date.now()+30000;c.halfOpen=false}
}
function shouldRetry(response,error){
  if(error)return error?.name!=='AbortError';
  return [408,425,429,500,502,503,504].includes(response?.status);
}
function retryDelay(response,attempt){
  const h=response?.headers?.get?.('retry-after');
  if(h){const n=Number(h);if(Number.isFinite(n))return Math.min(5000,n*1000)}
  return Math.min(2400,350*(2**attempt)+Math.floor(Math.random()*180));
}
function canRetry(method,url){return method==='GET'&&!/\.(?:m3u8|ts|mp4|mkv|avi|webm|mp3|aac)(?:$|\?)/i.test(String(url))}
const originalFetch=window.fetch?.bind(window);
if(originalFetch){
  window.fetch=async function debugFetch(input,init={}){
    const url=typeof input==='string'?input:input?.url||String(input),method=String(init.method||input?.method||'GET').toUpperCase(),key=serviceKey(url),c=circuit(key),policy=!safeMode&&method==='GET'?cachePolicy(url):null;
    const cached=policy?cache.get(policy.ns,url,{allowStale:true}):null;
    if(cached?.fresh){const hit=cache.response(cached);if(hit){log('info','cache.hit',{ns:policy.ns,url});return hit}}
    if(c.openUntil>Date.now()&&!init?.srhBypassCircuit){if(cached){const stale=cache.response(cached);if(stale){log('warn','network.circuit_cache',{key,url});return stale}}log('warn','network.circuit_open',{key,url,until:c.openUntil});throw new Error('Serviço temporariamente em recuperação')}
    if(c.openUntil&&c.openUntil<=Date.now())c.halfOpen=true;
    const maxAttempts=!safeMode&&canRetry(method,url)?2:1;
    let lastError,lastResponse;
    for(let attempt=0;attempt<maxAttempts;attempt++){
      const id=uid(),started=performance.now(),navSignal=isNavigationRequest(url)?navigation.signal():null,signal=combineSignals(init.signal||input?.signal,navSignal);
      requests.set(id,{id,url:safeText(url),service:key,attempt,startedAt:Date.now()});
      patch('network',{active:requests.size,total:state.network.total+1,failed:state.network.failed,retries:state.network.retries,aborted:state.network.aborted});
      try{
        const res=await originalFetch(input,{...init,...(signal?{signal}:{})});
        lastResponse=res;
        const retryable=shouldRetry(res,null);
        if(res.ok){
          recordCircuit(key,true);
          if(policy){try{const copy=res.clone(),body=await copy.text();cache.put(policy.ns,url,res,body,policy)}catch{}}
          log('info','network.response',{id,url,status:res.status,attempt,ms:Math.round(performance.now()-started)});
          return res
        }
        if(!retryable){recordCircuit(key,false,new Error('HTTP '+res.status));state.network.failed++;log('warn','network.response',{id,url,status:res.status,attempt,ms:Math.round(performance.now()-started)});return res}
        lastError=new Error('HTTP '+res.status);
        recordCircuit(key,false,lastError);
      }catch(e){
        lastError=e;
        if(e?.name==='AbortError'){state.network.aborted++;log('info','network.aborted',{id,url,attempt});throw e}
        recordCircuit(key,false,e);
      }finally{requests.delete(id);patch('network',{active:requests.size,total:state.network.total,failed:state.network.failed,retries:state.network.retries,aborted:state.network.aborted})}
      if(attempt+1<maxAttempts&&shouldRetry(lastResponse,lastError)){state.network.retries++;const ms=retryDelay(lastResponse,attempt);log('warn','network.retry',{url,attempt:attempt+1,delayMs:ms,error:lastError?.message||'',status:lastResponse?.status||0});await sleep(ms);continue}
      break
    }
    state.network.failed++;
    if(cached){const stale=cache.response(cached);if(stale){log('warn','cache.stale_fallback',{ns:policy?.ns,url,error:lastError?.message||''});return stale}}
    log('error','network.error',{url,error:lastError?.message||String(lastError||'Falha'),status:lastResponse?.status||0});
    if(lastResponse)return lastResponse;
    throw lastError||new Error('Falha de rede');
  };
}

const requestManager={
  pending:new Map(),controllers:new Map(),
  async run(key,factory,{group='default',retries=1,baseDelay=350,dedupe=true}={}){
    if(dedupe&&this.pending.has(key))return this.pending.get(key);
    const job=(async()=>{let last;for(let attempt=0;attempt<=retries;attempt++){const ctrl=typeof AbortController==='function'?new AbortController():null;this.controllers.set(key,{ctrl,group});try{return await factory({signal:ctrl?.signal,attempt})}catch(e){last=e;if(e?.name==='AbortError')throw e;if(attempt<retries)await sleep(baseDelay*(2**attempt)+Math.floor(Math.random()*120))}finally{this.controllers.delete(key)}}throw last})();
    this.pending.set(key,job);job.finally(()=>this.pending.delete(key));return job
  },
  cancel(key){this.controllers.get(key)?.ctrl?.abort()},
  cancelGroup(group){for(const [k,x] of this.controllers)if(x.group===group){x.ctrl?.abort();this.controllers.delete(k)}},
  snapshot(){return[...this.controllers].map(([key,x])=>({key,group:x.group}))}
};

const player={
  active:null,media:null,observer:null,
  begin(kind='video',meta={}){if(this.active)this.end('replace',false);this.active={id:uid(),kind,startedAt:Date.now(),meta:sanitize(meta)};set('player',{status:'opening',session:this.active});log('info','player.begin',this.active);return this.active.id},
  attach(media,meta={}){
    if(!(media instanceof HTMLMediaElement))return false;
    if(this.media&&this.media!==media)try{this.media.pause()}catch{}
    this.media=media;if(!this.active)this.begin('media',meta);
    patch('player',{status:media.paused?'ready':'playing',session:this.active,src:safeText(media.currentSrc||media.src||''),duration:Number(media.duration)||0,currentTime:Number(media.currentTime)||0});
    return true
  },
  ready(meta={}){if(!this.active)this.begin();patch('player',{status:'ready',session:this.active,readyAt:Date.now(),...sanitize(meta)});log('info','player.ready',meta)},
  play(media=this.media){if(media)this.attach(media);return media?.play?.()},
  pause(){try{this.media?.pause()}catch{}patch('player',{status:'paused'})},
  seek(seconds){if(this.media&&Number.isFinite(Number(seconds)))this.media.currentTime=Math.max(0,Number(seconds))},
  error(error){patch('player',{status:'error',error:safeText(error?.message||error)});log('error','player.error',{error:error?.message||error})},
  destroy(reason='destroy',clearSource=true){
    const media=this.media;
    if(media){try{media.pause()}catch{}if(clearSource&&!media.isConnected){try{media.removeAttribute('src');media.load()}catch{}}}
    this.end(reason,false);this.media=null
  },
  end(reason='close',clearSource=false){if(this.active)log('info','player.end',{id:this.active.id,reason,durationMs:Date.now()-this.active.startedAt});if(clearSource&&this.media&&!this.media.isConnected){try{this.media.removeAttribute('src');this.media.load()}catch{}}this.active=null;set('player',{status:'idle',session:null,reason})}
};
function observeVideos(){
  document.addEventListener('play',e=>{if(e.target instanceof HTMLMediaElement){if(player.media&&player.media!==e.target)try{player.media.pause()}catch{}player.attach(e.target,{tag:e.target.id||e.target.className||'media'});patch('player',{status:'playing'})}},true);
  document.addEventListener('loadedmetadata',e=>{if(e.target instanceof HTMLMediaElement){player.attach(e.target);player.ready({duration:e.target.duration,src:safeText(e.target.currentSrc||'')})}},true);
  document.addEventListener('timeupdate',e=>{if(e.target===player.media)patch('player',{currentTime:Number(e.target.currentTime)||0,duration:Number(e.target.duration)||0})},true);
  document.addEventListener('pause',e=>{if(e.target===player.media&&!e.target.ended)patch('player',{status:'paused'})},true);
  document.addEventListener('error',e=>{if(e.target instanceof HTMLMediaElement)player.error(new Error('media error'))},true);
  document.addEventListener('ended',e=>{if(e.target===player.media)player.end('ended')},true);
  if(typeof MutationObserver==='function'){player.observer=new MutationObserver(()=>{const m=player.media;if(m&&!m.isConnected)setTimeout(()=>{if(player.media===m&&!m.isConnected)player.destroy('detached',true)},180)});player.observer.observe(document.documentElement,{childList:true,subtree:true})}
}

const regression={
  installed:false,last:null,
  manifest(){const b=window.__SRH_DEBUG_BUILD__||{};return{profile:'debug',debugRevision:b.revision||'',baseCommit:b.baseCommit||'',baseRevision:b.baseRevision||'',storageSchema:STORAGE_SCHEMA,historySchema:HISTORY_SCHEMA,cacheSchema:CACHE_SCHEMA,generatedAt:now()}},
  validateHtml(html){
    const errors=[],warnings=[],text=String(html||'');
    if(!/^<!doctype html>/i.test(text.trimStart()))errors.push('DOCTYPE ausente');
    if(!/id=["']app-config["']/.test(text))errors.push('app-config ausente');
    if(text.includes('__APP_CONFIG__'))errors.push('marcador __APP_CONFIG__ não substituído');
    if(!text.includes('html-generator/v6.6-debug/public/r.js'))errors.push('bootstrap debug ausente');
    if(text.includes('html-generator/v6.6/public/r.js'))errors.push('bootstrap estável vazou para o HTML debug');
    if(!/id=["']srh-build-manifest["']/.test(text))errors.push('manifesto de build ausente');
    const rawGithub=[...text.matchAll(/https:\/\/raw\.githubusercontent\.com\/([^"'\\s<]+)/gi)].map(m=>m[1]);
    for(const ref of rawGithub)if(!/^HyakkimaruPY\/fei-config\//i.test(ref))errors.push('origem GitHub fora da allowlist');
    const generatorRoutes=[...text.matchAll(/html-generator\/([^/"'\\s<]+)\//gi)].map(m=>m[1]);
    for(const route of generatorRoutes)if(route!=='v6.6-debug')errors.push('rota de gerador fora da allowlist: '+route);
    const appCount=(text.match(/id=["']app-config["']/g)||[]).length;if(appCount!==1)errors.push('app-config duplicado: '+appCount);
    const result={ok:errors.length===0,errors,warnings,bytes:text.length,at:now()};
    this.last=result;set('regression',{status:result.ok?'pass':'fail',last:result});log(result.ok?'info':'error','regression.generated_html',result);return result
  },
  prepareHtml(html){
    let text=String(html||''),manifest=this.manifest(),tag='<script id="srh-build-manifest" type="application/json">'+JSON.stringify(manifest).replace(/</g,'\\u003c')+'</script>';
    if(/<script id=["']srh-build-manifest["'][\s\S]*?<\/script>/i.test(text))text=text.replace(/<script id=["']srh-build-manifest["'][\s\S]*?<\/script>/i,tag);else if(/<\/head>/i.test(text))text=text.replace(/<\/head>/i,tag+'\n</head>');else text=tag+'\n'+text;
    const result=this.validateHtml(text);if(!result.ok)throw new Error('Regressão detectada: '+result.errors.join(' · '));return text
  },
  smoke(){
    const checks={
      router:!!window.__srhA,
      centralState:!!state.meta,
      manifest:window.__srhA?.m==='g'||!!readBuildManifest(),
      migrations:storage.schema===STORAGE_SCHEMA&&storage.historySchema===HISTORY_SCHEMA,
      player:typeof player.destroy==='function',
      navigationAbort:typeof navigation.begin==='function',
      retry:!!originalFetch,
      circuitBreaker:!!circuits,
      cache:cache.schema===CACHE_SCHEMA,
      diagnostics:!!document.getElementById('srhDebugPanel'),
      regressionGuard:this.installed||window.__srhA?.m!=='g'
    };
    const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),result={ok:!failed.length,checks,failed,at:now()};
    set('regression',{status:result.ok?'pass':'fail',last:result});log(result.ok?'info':'error','regression.smoke',result);return result
  },
  installGeneratorGuard(){
    if(this.installed||window.__srhA?.m!=='g'||typeof window.Blob!=='function')return false;
    const NativeBlob=window.Blob,self=this;
    function GuardedBlob(parts=[],options={}){
      const type=String(options?.type||'').toLowerCase();
      if(type.includes('text/html')&&Array.isArray(parts)&&parts.every(x=>typeof x==='string'))parts=[self.prepareHtml(parts.join(''))];
      return new NativeBlob(parts,options)
    }
    GuardedBlob.prototype=NativeBlob.prototype;try{Object.setPrototypeOf(GuardedBlob,NativeBlob)}catch{}
    window.Blob=GuardedBlob;this.installed=true;patch('regression',{guardInstalled:true});log('info','regression.guard_installed');return true
  }
};

function snapshotLastGood(meta={}){try{const snap={at:Date.now(),version:VERSION,mode:window.__srhA?.m||'',revision:window.__SRH_DEBUG_BUILD__?.revision||'',baseRevision:window.__SRH_DEBUG_BUILD__?.baseRevision||'',meta:sanitize(meta),health:clone(state.health)};localStorage.setItem('srh:debug:last-good',JSON.stringify(snap))}catch{}}

const extensions=new Map();
function registerExtension(name,extension){if(!name||extensions.has(name))return false;extensions.set(name,extension||{});try{extension?.install?.(api)}catch(e){log('error','extension.install_failed',{name,error:e?.message||String(e)});return false}log('info','extension.installed',{name});return true}

const preload={
  seen:new Set(),
  link(url,as='fetch'){if(!url||this.seen.has(url)||safeMode)return false;try{const l=document.createElement('link');l.rel=as==='connect'?'preconnect':'prefetch';l.href=url;if(as!=='connect')l.as=as;document.head.appendChild(l);this.seen.add(url);return true}catch{return false}},
  idle(){if(safeMode)return;const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(c?.saveData||/2g/.test(c?.effectiveType||''))return;const run=()=>{this.link('https://cdn.jsdelivr.net','connect');this.link('https://image.tmdb.org','connect')};'requestIdleCallback'in window?requestIdleCallback(run,{timeout:2200}):setTimeout(run,1200)}
};

async function healthCheck(){
  syncAppState();syncLibraryState();
  const h={dom:!!document.body,storage:false,router:!!window.__srhA,video:!!document.createElement('video').canPlayType,fetch:typeof window.fetch==='function',abort:typeof AbortController==='function',response:typeof Response==='function',safeMode,manifest:window.__srhA?.m==='g'||!!readBuildManifest(),storageSchema:STORAGE_SCHEMA,historySchema:HISTORY_SCHEMA,cacheSchema:CACHE_SCHEMA};
  try{const k='srh:debug:probe';localStorage.setItem(k,'1');h.storage=localStorage.getItem(k)==='1';localStorage.removeItem(k)}catch{}
  h.mode=window.__srhA?.m||'unknown';h.revision=window.__SRH_DEBUG_BUILD__?.revision||'unknown';h.baseRevision=window.__SRH_DEBUG_BUILD__?.baseRevision||'unknown';
  set('health',h);log(h.dom&&h.router&&h.storage?'info':'warn','health.check',h);return h
}

function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0)}
function pointStatus(){
  const generator=window.__srhA?.m==='g';
  return{
    1:{name:'Estado central único',ok:!!state.meta&&typeof transaction==='function'},
    2:{name:'Manifesto por HTML',ok:generator||!!readBuildManifest()},
    3:{name:'Migração formal localStorage',ok:storage.schema===STORAGE_SCHEMA&&storage.historySchema===HISTORY_SCHEMA},
    4:{name:'Player isolado',ok:typeof player.destroy==='function'&&typeof player.attach==='function'},
    5:{name:'AbortController na navegação',ok:typeof navigation.begin==='function'},
    6:{name:'Retry inteligente',ok:!!originalFetch},
    7:{name:'Circuit breaker',ok:!!circuits},
    8:{name:'Cache versionado',ok:cache.schema===CACHE_SCHEMA},
    9:{name:'Diagnóstico embutido',ok:!!document.getElementById('srhDebugPanel')},
    10:{name:'Detector de regressão',ok:generator?regression.installed:!!readBuildManifest()}
  }
}
function diagnostic(){return{build:clone(window.__SRH_DEBUG_BUILD__||{}),manifest:readBuildManifest(),supervisor:VERSION,uptimeMs:Date.now()-startedAt,mode:window.__srhA?.m||'',safeMode,points:pointStatus(),state:clone(state),requests:requestManager.snapshot(),circuits:[...circuits].map(([service,x])=>({service,...x})),cache:{versions:cacheVersions,...clone(state.cache)},logs:logs.slice(-160)}}

function panel(){
  if(document.getElementById('srhDebugPanel'))return;
  const root=document.createElement('div');root.id='srhDebugPanel';root.className='srh-debug-panel is-hidden';
  root.innerHTML='<div class="srh-debug-head"><strong>Diagnóstico</strong><button data-x="close" aria-label="Fechar">×</button></div><div class="srh-debug-status" data-x="status"></div><div class="srh-debug-points" data-x="points"></div><div class="srh-debug-actions"><button data-x="smoke">Rodar smoke test</button><button data-x="copy">Copiar diagnóstico</button><button data-x="export">Exportar configuração</button><button data-x="import">Importar configuração</button><button data-x="safe">Modo seguro</button><button data-x="migrate">Migrar dados</button><button data-x="cache">Limpar cache debug</button></div><pre class="srh-debug-output" data-x="out"></pre><input type="file" data-x="file" accept="application/json" hidden>';
  document.body.appendChild(root);
  const q=s=>root.querySelector(s),out=q('[data-x="out"]'),status=q('[data-x="status"]'),points=q('[data-x="points"]');
  const render=()=>{
    const d=diagnostic(),ps=Object.values(d.points);
    status.textContent=(d.state.health?.router?'Router OK':'Router ?')+' · '+(d.state.health?.storage?'Storage OK':'Storage bloqueado')+' · '+d.state.network.active+' req ativa(s)';
    points.innerHTML=ps.map((p,i)=>'<div class="'+(p.ok?'ok':'bad')+'"><span>'+(i+1)+'</span><b>'+p.name+'</b><em>'+(p.ok?'OK':'PENDENTE')+'</em></div>').join('');
    out.textContent=JSON.stringify(d,null,2)
  };
  root.render=render;
  q('[data-x="close"]').onclick=()=>root.classList.add('is-hidden');
  q('[data-x="smoke"]').onclick=()=>{const r=regression.smoke();status.textContent=r.ok?'Smoke test passou.':'Falha: '+r.failed.join(', ');render()};
  q('[data-x="copy"]').onclick=async()=>{const t=JSON.stringify(diagnostic(),null,2);try{await navigator.clipboard.writeText(t);status.textContent='Diagnóstico copiado.'}catch{download('srhell-diagnostico.json',t)}};
  q('[data-x="export"]').onclick=()=>download('srhell-backup-debug.json',JSON.stringify(storage.export(true),null,2));
  q('[data-x="import"]').onclick=()=>q('[data-x="file"]').click();
  q('[data-x="file"]').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{storage.import(JSON.parse(await f.text()));status.textContent='Configuração importada. Recarregue para aplicar.'}catch(err){status.textContent='Falha: '+safeText(err?.message||err)}};
  q('[data-x="safe"]').onclick=()=>{try{localStorage.setItem('srh:debug:safe',safeMode?'0':'1')}catch{}const u=new URL(location.href);if(safeMode)u.searchParams.delete('srhSafe');else u.searchParams.set('srhSafe','1');location.href=u.href};
  q('[data-x="migrate"]').onclick=()=>{const r=storage.migrate();status.textContent='Migração: '+r.changed+' alterado(s) em '+r.scanned+' base(s).';render()};
  q('[data-x="cache"]').onclick=()=>{const n=cache.invalidateAll();status.textContent='Cache debug limpo: '+n+' entrada(s).';render()};
  bus.addEventListener('log',()=>{if(!root.classList.contains('is-hidden'))render()});render()
}
function attachButton(){
  panel();
  const settings=document.querySelector('#settingsPanel .settings-panel__inner')||document.querySelector('#settingsPanel');
  let b=document.getElementById('srhDebugButton');
  if(!b){b=document.createElement('button');b.id='srhDebugButton';b.type='button';b.className='srh-debug-button';b.textContent='Diagnóstico';b.onclick=e=>{e.stopPropagation();const p=document.getElementById('srhDebugPanel');p.classList.toggle('is-hidden');p.render?.()}}
  if(settings){b.classList.remove('is-floating');settings.prepend(b)}else if(!b.isConnected){b.classList.add('is-floating');document.body.appendChild(b)}
}

function bridge(){
  syncAppState();
  const S=window.SRH25;
  if(S&&!S.__debugBridge){
    S.__debugBridge=true;S.centralState=api.state;patch('shorts',{connected:true,appId:S.cfg?.appId||'',items:S.state?.items?.length||0});
    if(typeof S.openPlayer==='function'){const oldOpen=S.openPlayer;S.openPlayer=function(item){player.begin('shorts',{id:S.id?.(item),title:S.title?.(item)});try{return oldOpen.apply(this,arguments)}catch(e){player.error(e);throw e}}}
  }
}

function installGlobalErrors(){addEventListener('error',e=>log('error','window.error',{message:e.message,source:e.filename,line:e.lineno,col:e.colno}),true);addEventListener('unhandledrejection',e=>log('error','promise.rejection',{reason:e.reason?.message||String(e.reason)}))}

function init(){
  boot.begin(window.__SRH_DEBUG_BUILD__||{});
  boot.phase('supervisor-v2');
  syncAppState();
  installGlobalErrors();
  cache.prune();
  storage.migrate();
  navigation.begin('initial');
  observeVideos();
  panel();
  regression.installGeneratorGuard();
  healthCheck();
  attachButton();
  preload.idle();
  setTimeout(()=>{bridge();attachButton();regression.smoke()},0);
  setTimeout(()=>{bridge();attachButton()},500);
  setTimeout(()=>{bridge();attachButton()},1800);
  setTimeout(()=>{if(state.boot.status==='starting')boot.commit({reason:'watchdog-ready'})},2500)
}

const api={
  version:VERSION,bus,
  state:{get,set,patch,subscribe,transaction,snapshot:()=>clone(state)},
  log,logs,boot,navigation,requests:requestManager,storage,cache,player,regression,preload,healthCheck,diagnostic,pointStatus,registerExtension,features:{safeMode},attachButton,bridge
};
window.SRHDebug=Object.freeze(api);
init();
})();
