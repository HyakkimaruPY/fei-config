(()=>{
'use strict';
if(window.SRHDebug)return;

const VERSION='debug-supervisor-5';
const STORAGE_SCHEMA=3;
const HISTORY_SCHEMA=3;
const CACHE_SCHEMA=2;
const startedAt=Date.now();
const SESSION_ID=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
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
  incidents:{active:0,total:0,recovered:0,slow:0,last:null},
  performance:{longTasks:0,longestMs:0,slowResources:0,shorts:{enabled:false,interactionCount:0,slowInteractions:0,worstInteractionMs:0,renderMutations:0,renderBatches:0,largestMutationBatch:0,scrollBursts:0,jankBursts:0,worstFrameMs:0,missedFrames:0,layoutShifts:0,maxLayoutShift:0}},
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
const INCIDENT_STORE='srh:debug:incidents:v2';
let incidentHistory=(()=>{try{const x=JSON.parse(localStorage.getItem(INCIDENT_STORE)||'[]');return(Array.isArray(x)?x:[]).slice(-80).map(row=>row&&row.status==='active'&&row.sessionId!==SESSION_ID?{...row,status:'stale'}:row)}catch{return[]}})();
const activeIncidents=new Map();
const slowDedupe=new Map();
let persistIncidentTimer=0;

function safeUrl(value){
  try{
    const u=new URL(String(value),location.href);
    const keep=new URLSearchParams();
    for(const key of ['action','category_id','stream_id','series_id','vod_id']){const v=u.searchParams.get(key);if(v!=null)keep.set(key,v)}
    let p=u.pathname.replace(/\/(movie|series|live)\/[^/]+\/[^/]+\//i,'/$1/[user]/[pass]/');
    return u.origin+p+(keep.toString()?'?'+keep.toString():'')
  }catch{return safeText(value)}
}
function requestMeta(value){
  try{
    const u=new URL(typeof value==='string'?value:value?.url||String(value),location.href);
    const action=u.searchParams.get('action')||'';
    const categoryId=u.searchParams.get('category_id')||'';
    const path=u.pathname;
    const host=u.host;
    let kind='network.other';
    if(/proxy|cors/i.test(host+path))kind='proxy';
    else if(/player_api\.php/i.test(path)&&/^get_(?:live|vod|series)_categories$/.test(action))kind='catalog.categories';
    else if(/player_api\.php/i.test(path)&&/^(?:get_live_streams|get_vod_streams|get_series)$/.test(action))kind='catalog.items';
    else if(/player_api\.php/i.test(path)&&/^(?:get_vod_info|get_series_info)$/.test(action))kind='xtream.detail';
    else if(/player_api\.php/i.test(path))kind='xtream.api';
    else if(/get\.php/i.test(path)||/\.(?:m3u|m3u8)(?:$|\?)/i.test(path))kind='playlist';
    else if(/\/(?:movie|series|live)\//i.test(path)||/\.(?:ts|mp4|mkv|webm|aac|mp3)(?:$|\?)/i.test(path))kind='media';
    else if(/themoviedb/i.test(host))kind='tmdb';
    else if(/raw\.githubusercontent\.com|githubusercontent/i.test(host))kind='asset';
    return{kind,origin:u.origin,path,action,categoryId,url:safeUrl(u.href)}
  }catch{return{kind:'network.other',origin:'unknown',path:'',action:'',categoryId:'',url:safeText(value)}}
}
function incidentKey(meta={}){return [meta.kind||'unknown',meta.action||'',meta.categoryId||'',meta.mediaId||'',meta.origin||'',meta.layer||''].join('|')}
function abortReason(signal,error){
  const raw=signal?.reason?.message||signal?.reason||error?.message||error||'';
  return safeText(raw)
}
function isBenignTransportAbort(signal,error){
  const reason=abortReason(signal,error).toLowerCase();
  return !!reason&&/(transport-won|route-lost|proxy-lost|superseded)/.test(reason)
}
function recoverIncidentRow(row,meta={}){
  if(!row)return null;
  row.status='recovered';row.recoveredAt=Date.now();row.recoveryMs=row.recoveredAt-row.firstAt;row.lastSuccessMs=Number(meta.ms)||0;row.successStatus=Number(meta.status)||200;
  if(meta.message)row.recoveryMessage=safeText(meta.message);
  if(meta.details)row.recoveryDetails=sanitize(meta.details);
  activeIncidents.delete(row.key);
  const idx=incidentHistory.findIndex(x=>x.id===row.id);if(idx>=0)incidentHistory[idx]=clone(row);
  persistIncidents();syncIncidentState(row);bus.dispatchEvent(new CustomEvent('incident',{detail:clone(row)}));return row
}
function recoverTransportFailures(detail={}){
  const action=String(detail.action||''),categoryId=String(detail.categoryId||''),route=String(detail.route||'unknown');let count=0;
  for(const row of [...activeIncidents.values()]){
    if(row.kind!=='proxy'||row.layer!=='fetch')continue;
    if(action&&row.action&&row.action!==action)continue;
    if(categoryId&&row.categoryId&&row.categoryId!==categoryId)continue;
    recoverIncidentRow(row,{status:200,ms:detail.ms||0,message:'Rota alternativa concluiu a requisição',details:{winner:route}});count++
  }
  if(count)log('info','transport.losers_recovered',{action,categoryId,route,count});
  return count
}
function syncIncidentState(last=null){
  const all=incidentHistory,current=all.filter(x=>x?.sessionId===SESSION_ID);
  patch('incidents',{
    active:[...activeIncidents.values()].filter(x=>x.status==='active'&&x.sessionId===SESSION_ID).length,
    total:current.length,
    recovered:current.filter(x=>x.status==='recovered').length,
    slow:current.filter(x=>x.type==='slow').length,
    last:last?.sessionId===SESSION_ID?last:(current.at(-1)||null),
    historyTotal:all.length
  });
  updateDebugBadge()
}
function persistIncidents(){
  clearTimeout(persistIncidentTimer);
  persistIncidentTimer=setTimeout(()=>{try{localStorage.setItem(INCIDENT_STORE,JSON.stringify(incidentHistory.slice(-80)))}catch{}},80)
}
function noteFailure(meta={}){
  const key=incidentKey(meta),t=Date.now(),prev=activeIncidents.get(key);
  const row=prev||{id:uid(),key,type:meta.type||'failure',kind:meta.kind||'unknown',action:meta.action||'',categoryId:meta.categoryId||'',mediaId:meta.mediaId||'',origin:meta.origin||'',layer:meta.layer||'',firstAt:t,count:0,status:'active',sessionId:SESSION_ID};
  row.count++;row.lastAt=t;row.status='active';row.message=safeText(meta.message||meta.error||'Falha');row.ms=Number(meta.ms)||row.ms||0;row.statusCode=Number(meta.status)||0;row.details=sanitize(meta.details||{});
  activeIncidents.set(key,row);
  const idx=incidentHistory.findIndex(x=>x.id===row.id);if(idx>=0)incidentHistory[idx]=clone(row);else incidentHistory.push(clone(row));
  if(incidentHistory.length>80)incidentHistory=incidentHistory.slice(-80);
  persistIncidents();syncIncidentState(row);bus.dispatchEvent(new CustomEvent('incident',{detail:clone(row)}));return row
}
function noteRecovery(meta={}){
  const row=activeIncidents.get(incidentKey(meta));return recoverIncidentRow(row,meta)
}
function noteSlow(meta={}){
  const t=Date.now(),ms=Math.round(Number(meta.ms)||0),details=sanitize(meta.details||{}),start=Number(meta.details?.start);
  const sig=[meta.kind||'performance',meta.layer||'',meta.origin||'',meta.action||'',meta.categoryId||'',safeText(meta.message||'Operação lenta'),Math.round(ms/10)*10,Number.isFinite(start)?Math.round(start):''].join('|');
  const prior=slowDedupe.get(sig);
  if(prior&&t-prior.at<1800){
    const row=prior.row;row.count=Number(row.count||1)+1;row.lastAt=t;row.ms=Math.max(Number(row.ms)||0,ms);prior.at=t;
    const idx=incidentHistory.findIndex(x=>x.id===row.id);if(idx>=0)incidentHistory[idx]=clone(row);
    persistIncidents();syncIncidentState(row);return row
  }
  const row={id:uid(),key:incidentKey({...meta,type:'slow'}),type:'slow',kind:meta.kind||'performance',action:meta.action||'',categoryId:meta.categoryId||'',mediaId:meta.mediaId||'',origin:meta.origin||'',layer:meta.layer||'',firstAt:t,lastAt:t,count:1,status:'observed',sessionId:SESSION_ID,message:safeText(meta.message||'Operação lenta'),ms,details};
  slowDedupe.set(sig,{at:t,row});
  if(slowDedupe.size>120)for(const [k,v] of slowDedupe)if(t-v.at>15000)slowDedupe.delete(k);
  incidentHistory.push(row);if(incidentHistory.length>80)incidentHistory=incidentHistory.slice(-80);persistIncidents();syncIncidentState(row);bus.dispatchEvent(new CustomEvent('incident',{detail:clone(row)}));return row
}
function incidentSummary(){
  const history=incidentHistory.slice(-80).reverse(),rows=history.filter(x=>x?.sessionId===SESSION_ID);
  return{sessionId:SESSION_ID,active:rows.filter(x=>x.status==='active'),recovered:rows.filter(x=>x.status==='recovered'),slow:rows.filter(x=>x.type==='slow'),recent:rows,historyCount:history.length}
}
function issueExport(){
  const rows=incidentHistory.slice(-80).filter(x=>x?.sessionId===SESSION_ID&&(x.type==='slow'||x.status==='active'||x.status==='recovered')&&x.status!=='stale'&&!/transport-won|route-lost|proxy-lost|superseded/i.test(String(x.message||''))&&!(x.status==='recovered'&&x.kind==='proxy'&&/rota alternativa concluiu a requisição/i.test(String(x.recoveryMessage||'')))&&!(x.type==='slow'&&x.kind==='network.other'&&x.layer==='resource'&&String(x.details?.initiatorType||'').toLowerCase()==='img')).map(x=>({
    time:new Date(Number(x.lastAt||x.firstAt||Date.now())).toISOString(),
    kind:x.kind||'unknown',
    status:x.status||'unknown',
    type:x.type||'failure',
    message:x.message||'',
    ms:Math.round(Number(x.ms||0)),
    recoveryMs:Math.round(Number(x.recoveryMs||0)),
    count:Number(x.count||1),
    action:x.action||'',
    categoryId:x.categoryId||'',
    mediaId:x.mediaId||'',
    origin:x.origin||'',
    layer:x.layer||'',
    severity:x.status==='active'?'error':x.type==='slow'?'slow':'recovered',details:sanitize(x.details||{})
  }));
  const recommendation=sanitize(get('recommendation')||{}),performance=shortsPerformanceExport();
  return{sessionId:SESSION_ID,build:clone(window.__SRH_DEBUG_BUILD__||{}),recommendation,performance,count:rows.length,summary:{active:rows.filter(x=>x.severity==='error').length,slow:rows.filter(x=>x.severity==='slow').length,recovered:rows.filter(x=>x.severity==='recovered').length},issues:rows}
}
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
function serviceKey(url){
  try{
    const u=new URL(url,location.href),origin=u.origin;
    if(/themoviedb/i.test(u.hostname))return origin+'|tmdb';
    if(/player_api\.php/i.test(u.pathname)){
      const action=u.searchParams.get('action')||'account',category=u.searchParams.get('category_id')||'',media=u.searchParams.get('vod_id')||u.searchParams.get('series_id')||u.searchParams.get('stream_id')||'';
      if(/^get_(?:live|vod|series)_categories$/.test(action))return origin+'|xtream|categories|'+action;
      if(/^(?:get_live_streams|get_vod_streams|get_series)$/.test(action))return origin+'|xtream|catalog|'+action+'|'+(category||'*');
      if(/^(?:get_vod_info|get_series_info)$/.test(action))return origin+'|xtream|detail|'+action+'|'+(media||'*');
      return origin+'|xtream|'+action
    }
    if(/proxy|cors/i.test(u.hostname+u.pathname))return origin+'|proxy';
    return origin+'|generic'
  }catch{return'unknown'}
}
function circuit(key){if(!circuits.has(key))circuits.set(key,{fails:0,openUntil:0,halfOpen:false,lastError:'',reportedOpen:false});return circuits.get(key)}
function recordCircuit(key,ok,error){
  const c=circuit(key);
  if(ok){c.fails=0;c.openUntil=0;c.halfOpen=false;c.lastError='';c.reportedOpen=false;return}
  c.fails++;c.lastError=safeText(error?.message||error);
  if(c.fails>=4){c.openUntil=Date.now()+30000;c.halfOpen=false;c.reportedOpen=false}
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
    const url=typeof input==='string'?input:input?.url||String(input),method=String(init.method||input?.method||'GET').toUpperCase(),probe=!!init?.srhProbe,meta=requestMeta(url),traceId=uid(),key=serviceKey(url),c=circuit(key),policy=!safeMode&&method==='GET'?cachePolicy(url):null,bypassCircuit=!!init?.srhBypassCircuit,circuitEnabled=!probe&&!bypassCircuit&&!meta.kind.startsWith('catalog.');
    const {srhProbe,srhBypassCircuit,...nativeInit}=init||{};
    const cached=policy?cache.get(policy.ns,url,{allowStale:true}):null;
    if(cached?.fresh){const hit=cache.response(cached);if(hit){log('info','cache.hit',{ns:policy.ns,traceId,...meta});return hit}}
    if(circuitEnabled&&c.openUntil>Date.now()){if(cached){const stale=cache.response(cached);if(stale){log('warn','network.circuit_cache',{key,traceId,...meta});return stale}}if(!c.reportedOpen){c.reportedOpen=true;noteFailure({...meta,layer:'fetch',message:'Circuit breaker aberto'})}log('warn','network.circuit_open',{key,traceId,...meta,until:c.openUntil});throw new Error('Serviço temporariamente em recuperação')}
    if(c.openUntil&&c.openUntil<=Date.now()){c.halfOpen=true;c.reportedOpen=false}
    const maxAttempts=probe?1:(!safeMode&&canRetry(method,url)?2:1);
    let lastError,lastResponse;
    for(let attempt=0;attempt<maxAttempts;attempt++){
      const id=uid(),started=performance.now(),navSignal=isNavigationRequest(url)?navigation.signal():null,signal=combineSignals(init.signal||input?.signal,navSignal);
      requests.set(id,{id,traceId,...meta,service:key,attempt,startedAt:Date.now()});
      patch('network',{active:requests.size,total:state.network.total+1,failed:state.network.failed,retries:state.network.retries,aborted:state.network.aborted});
      try{
        const res=await originalFetch(input,{...nativeInit,...(signal?{signal}:{})});
        lastResponse=res;
        const retryable=shouldRetry(res,null);
        if(res.ok){
          if(circuitEnabled)recordCircuit(key,true);
          if(!probe&&policy){try{const copy=res.clone(),body=await copy.text();cache.put(policy.ns,url,res,body,policy)}catch{}}
          const ms=Math.round(performance.now()-started);if(!probe)noteRecovery({...meta,layer:'fetch',ms,status:res.status});if(!probe&&!meta.kind.startsWith('catalog.')&&ms>2600)noteSlow({...meta,layer:'fetch',ms,message:'Resposta lenta',details:{source:meta.url,path:meta.path,action:meta.action||''}});log('info','network.response',{id,traceId,...meta,status:res.status,attempt,ms,probe});
          return res
        }
        if(!retryable){const ms=Math.round(performance.now()-started);if(!probe){state.network.failed++;noteFailure({...meta,layer:'fetch',message:'HTTP '+res.status,status:res.status,ms})}log('warn','network.response',{id,traceId,...meta,status:res.status,attempt,ms,probe});return res}
        lastError=new Error('HTTP '+res.status);
      }catch(e){
        lastError=e;
        const ms=Math.round(performance.now()-started),reason=abortReason(signal,e),benignAbort=signal?.aborted&&isBenignTransportAbort(signal,e);
        if(benignAbort){state.network.aborted++;log('info','network.superseded',{id,traceId,...meta,attempt,ms,reason,probe});throw e}
        if(e?.name==='AbortError'||signal?.aborted){state.network.aborted++;if(!probe&&(meta.kind.startsWith('catalog.')||meta.kind==='playlist'))noteFailure({...meta,layer:'fetch',message:'Abortado/timeout: '+reason,ms});log('warn','network.aborted',{id,traceId,...meta,attempt,ms,reason,probe});throw e}
        if(!probe)noteFailure({...meta,layer:'fetch',message:e?.message||String(e),ms});
      }finally{requests.delete(id);patch('network',{active:requests.size,total:state.network.total,failed:state.network.failed,retries:state.network.retries,aborted:state.network.aborted})}
      if(attempt+1<maxAttempts&&shouldRetry(lastResponse,lastError)){state.network.retries++;const ms=retryDelay(lastResponse,attempt);log('warn','network.retry',{traceId,...meta,attempt:attempt+1,delayMs:ms,error:lastError?.message||'',status:lastResponse?.status||0});await sleep(ms);continue}
      break
    }
    if(!probe)state.network.failed++;
    if(circuitEnabled)recordCircuit(key,false,lastError||new Error('HTTP '+(lastResponse?.status||0)));
    if(!probe&&cached){const stale=cache.response(cached);if(stale){log('warn','cache.stale_fallback',{ns:policy?.ns,traceId,...meta,error:lastError?.message||''});return stale}}
    log('error','network.error',{traceId,...meta,error:lastError?.message||String(lastError||'Falha'),status:lastResponse?.status||0});
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
  const traces=new WeakMap();
  const trace=m=>{let x=traces.get(m);if(!x){x={loadAt:0,metadataMs:0,metadataReady:false,preMetadataWaitMs:0,firstPlaying:false,waitingAt:0,startupBufferMs:0,stallTimer:0,origin:'',mediaId:'',sourceKind:'',retrying:false};traces.set(m,x)}return x};
  const mediaOrigin=m=>{const tagged=String(m?.dataset?.srhMediaOrigin||'').trim();if(tagged&&tagged!=='null'&&tagged!=='media')return tagged;try{const origin=new URL(m.currentSrc||m.src||'',location.href).origin;return origin&&origin!=='null'?origin:'media'}catch{return'media'}};
  const mediaSourceKind=m=>String(m?.dataset?.srhSourceKind||'');
  document.addEventListener('loadstart',e=>{if(e.target instanceof HTMLMediaElement){const x=trace(e.target);clearTimeout(x.stallTimer);x.loadAt=performance.now();x.metadataMs=0;x.metadataReady=false;x.preMetadataWaitMs=0;x.firstPlaying=false;x.waitingAt=0;x.startupBufferMs=0;x.origin=mediaOrigin(e.target);const datasetMediaId=String(e.target.dataset?.srhMediaId||''),shortItem=window.SRH25?.state?.current?.item;x.mediaId=datasetMediaId||String(shortItem?(window.SRH25?.id?.(shortItem)||shortItem?.stream_id||shortItem?.id||''):'');x.sourceKind=mediaSourceKind(e.target);log('info','media.loadstart',{origin:x.origin,mediaId:x.mediaId,sourceKind:x.sourceKind,preload:e.target.preload})}},true);
  document.addEventListener('play',e=>{if(e.target instanceof HTMLMediaElement){if(player.media&&player.media!==e.target)try{player.media.pause()}catch{}player.attach(e.target,{tag:e.target.id||e.target.className||'media'});patch('player',{status:'playing'})}},true);
  document.addEventListener('loadedmetadata',e=>{if(e.target instanceof HTMLMediaElement){const x=trace(e.target),t=performance.now();x.metadataMs=x.loadAt?Math.round(t-x.loadAt):0;x.metadataReady=true;x.sourceKind=mediaSourceKind(e.target)||x.sourceKind;if(x.waitingAt){x.preMetadataWaitMs+=Math.max(0,Math.round(t-x.waitingAt));x.waitingAt=t}player.attach(e.target);player.ready({duration:e.target.duration,src:safeText(e.target.currentSrc||'')});log('info','player.metadata',{origin:x.origin||mediaOrigin(e.target),mediaId:x.mediaId,sourceKind:x.sourceKind||mediaSourceKind(e.target),ms:x.metadataMs,preload:e.target.preload,readyState:e.target.readyState,networkState:e.target.networkState})}},true);
  document.addEventListener('playing',e=>{if(e.target instanceof HTMLMediaElement){const x=trace(e.target),t=performance.now();if(x.waitingAt){const wait=Math.round(t-x.waitingAt);clearTimeout(x.stallTimer);if(!x.firstPlaying){if(x.metadataReady)x.startupBufferMs+=wait;else x.preMetadataWaitMs+=wait}else{noteRecovery({kind:'player.stall',layer:'media',origin:x.origin||mediaOrigin(e.target),ms:wait,status:200});if(wait>1200)noteSlow({kind:'player.stall',layer:'media',origin:x.origin||mediaOrigin(e.target),ms:wait,message:'Buffering perceptível',details:{currentTime:Number(e.target.currentTime)||0}})}x.waitingAt=0}if(!x.firstPlaying){noteRecovery({kind:'player.autoplay',layer:'media',mediaId:x.mediaId||'',origin:x.origin||mediaOrigin(e.target),status:200,message:'Reprodução iniciou automaticamente'});noteRecovery({kind:'player.startup_timeout',layer:'media',mediaId:x.mediaId||'',origin:x.origin||mediaOrigin(e.target),status:200,message:'Mídia iniciou após watchdog'});x.firstPlaying=true;const ms=x.loadAt?Math.round(t-x.loadAt):0;if(ms>4000){const metadataSharePct=ms?Math.round(((x.metadataMs||0)/ms)*100):0,metadataDominant=metadataSharePct>=75;noteSlow({kind:metadataDominant?'media.metadata':'player.startup',layer:'media',mediaId:x.mediaId||'',origin:x.origin||mediaOrigin(e.target),ms,message:metadataDominant?'Servidor demorou para entregar metadados do vídeo':'Vídeo demorou para iniciar',details:{phase:'first-playing',totalStartupMs:ms,metadataMs:x.metadataMs||0,metadataSharePct,preMetadataWaitMs:x.preMetadataWaitMs||0,startupBufferMs:x.startupBufferMs||0,currentTime:Number(e.target.currentTime)||0,resumed:Number(e.target.currentTime||0)>1,sourceKind:x.sourceKind||mediaSourceKind(e.target),preload:e.target.preload,readyState:e.target.readyState,networkState:e.target.networkState,dominant:metadataDominant?'metadata':'buffer'}})}else log('info','player.startup_ok',{origin:x.origin||mediaOrigin(e.target),mediaId:x.mediaId,ms,metadataMs:x.metadataMs||0,preMetadataWaitMs:x.preMetadataWaitMs||0,startupBufferMs:x.startupBufferMs||0,sourceKind:x.sourceKind||mediaSourceKind(e.target),preload:e.target.preload})}patch('player',{status:'playing'})}},true);
  const onWaiting=e=>{if(!(e.target instanceof HTMLMediaElement))return;const x=trace(e.target);if(x.waitingAt)return;x.waitingAt=performance.now();if(!x.firstPlaying)return;clearTimeout(x.stallTimer);x.stallTimer=setTimeout(()=>{if(!x.waitingAt||!x.firstPlaying)return;noteFailure({kind:'player.stall',layer:'media',origin:x.origin||mediaOrigin(e.target),message:'Reprodução aguardando dados',ms:Math.round(performance.now()-x.waitingAt),details:{currentTime:Number(e.target.currentTime)||0}})},1200)};
  document.addEventListener('waiting',onWaiting,true);document.addEventListener('stalled',onWaiting,true);
  document.addEventListener('timeupdate',e=>{if(e.target===player.media)patch('player',{currentTime:Number(e.target.currentTime)||0,duration:Number(e.target.duration)||0})},true);
  document.addEventListener('pause',e=>{if(e.target===player.media&&!e.target.ended)patch('player',{status:'paused'})},true);
  document.addEventListener('error',e=>{if(e.target instanceof HTMLMediaElement){const x=trace(e.target),code=e.target.error?.code||0,codeName=code===1?'MEDIA_ERR_ABORTED':code===2?'MEDIA_ERR_NETWORK':code===3?'MEDIA_ERR_DECODE':code===4?'MEDIA_ERR_SRC_NOT_SUPPORTED':'MEDIA_ERR_UNKNOWN';clearTimeout(x.stallTimer);if(code===4&&e.target.id==='shortVideo'){log('warn','media.error.retryable',{code,codeName,origin:x.origin||mediaOrigin(e.target),readyState:e.target.readyState,networkState:e.target.networkState});return}noteFailure({kind:'player.error',layer:'media',origin:x.origin||mediaOrigin(e.target),message:'Erro de mídia',details:{code,codeName,currentTime:Number(e.target.currentTime)||0,readyState:e.target.readyState,networkState:e.target.networkState}});player.error(new Error('media error'))}},true);
  document.addEventListener('ended',e=>{if(e.target===player.media){const x=trace(e.target);clearTimeout(x.stallTimer);player.end('ended')}},true);
  window.addEventListener('srh25:media-autoplay',e=>{const d=e.detail||{},phase=String(d.phase||''),mediaId=String(d.mediaId||''),origin=(()=>{try{return new URL(player.media?.currentSrc||player.media?.src||'',location.href).origin}catch{return'media'}})();log(phase==='rejected'?'warn':'info','media.autoplay',d);patch('player',{autoplay:{phase,stage:d.stage||'',mediaId,sourceKind:d.sourceKind||'',name:d.name||'',message:d.message||'',readyState:d.readyState||0,networkState:d.networkState||0}});if(phase==='rejected'&&String(d.name||'')==='NotAllowedError')noteFailure({kind:'player.autoplay',layer:'media',mediaId,origin,message:'Autoplay bloqueado pelo navegador',details:{stage:d.stage||'',name:d.name||'',message:d.message||'',readyState:d.readyState||0,networkState:d.networkState||0}})},{passive:true});
  window.addEventListener('srh25:recommendation-ready',e=>{const d=e.detail||{};log('info','recommendation.ready',d);patch('recommendation',{version:d.version||'',triggerSeconds:d.triggerSeconds||0,arcSeconds:d.arcSeconds||0,status:'ready'})},{passive:true});
  window.addEventListener('srh25:recommendation-prepared',e=>{const d=e.detail||{};log('info','recommendation.prepared',d);patch('recommendation',{status:d.state||'',sourceId:d.sourceId||'',targetId:d.targetId||'',keyword:d.keyword||'',pair:d.pair||'',score:Number(d.score)||0,sameCategory:!!d.sameCategory})},{passive:true});
  window.addEventListener('srh25:recommendation-transition',e=>{const d=e.detail||{};log('info','recommendation.transition',d);patch('recommendation',{status:'transition',sourceId:d.sourceId||'',targetId:d.targetId||'',keyword:d.keyword||'',pair:d.pair||'',score:Number(d.score)||0})},{passive:true});
  window.addEventListener('srh25:media-startup-watchdog',e=>{const d=e.detail||{},phase=String(d.phase||''),mediaId=String(d.mediaId||''),origin=(()=>{try{return new URL(player.media?.currentSrc||player.media?.src||'',location.href).origin}catch{return'media'}})();log(phase==='play-retry'?'warn':'error','media.startup_watchdog',d);patch('player',{watchdog:{phase,mediaId,readyState:d.readyState||0,networkState:d.networkState||0}});if(phase==='no-metadata'||phase==='play-timeout')noteFailure({kind:'player.startup_timeout',layer:'media',mediaId,origin,message:phase==='no-metadata'?'Mídia não entregou metadados a tempo':'Mídia não iniciou após metadata',details:{phase,readyState:d.readyState||0,networkState:d.networkState||0}})},{passive:true});
  window.addEventListener('srh25:media-retry',e=>{const d=e.detail||{};log('warn','media.retry',d);patch('player',{retrying:true,retry:{code:d.code||0,attempt:d.attempt||1,origin:d.origin||'',mediaId:d.mediaId||'',catalogExtension:d.catalogExtension||'',currentExtension:d.currentExtension||'',sourceKind:d.sourceKind||'',canPlayType:d.canPlayType||''}})},{passive:true});
  window.addEventListener('srh25:media-recovered',e=>{const d=e.detail||{};log('info','media.retry_recovered',d);patch('player',{retrying:false,retryRecovered:{attempts:d.attempts||1,origin:d.origin||'',mediaId:d.mediaId||'',catalogExtension:d.catalogExtension||'',currentExtension:d.currentExtension||'',sourceKind:d.sourceKind||''}})},{passive:true});
  window.addEventListener('srh25:media-vod-info',e=>{const d=e.detail||{};log(d.ok?'info':'warn','media.vod_info',d);patch('player',{vodInfo:{ok:!!d.ok,mediaId:d.mediaId||'',catalogExtension:d.catalogExtension||'',vodInfoExtension:d.vodInfoExtension||'',directSource:!!d.directSource,alternative:!!d.alternative,sourceKind:d.sourceKind||'',error:d.error||''}})},{passive:true});
  window.addEventListener('srh25:media-error-final',e=>{const d=e.detail||{},code=Number(d.code)||0,codeName=code===4?'MEDIA_ERR_SRC_NOT_SUPPORTED':'MEDIA_ERR_'+code,retryAttempted=!!d.retryAttempted,retrySuppressed=!!d.retrySuppressed,vodInfoChecked=!!d.vodInfoChecked,noAlternative=!!d.noAlternative,message=retryAttempted?(d.sourceKind==='extension_probe_mkv'?'Erro de mídia após fallback MKV':'Erro de mídia após fallback alternativo'):noAlternative?'Erro de mídia; provedor não informou alternativa compatível':retrySuppressed?'Erro de mídia; retry já esgotado para este item':'Erro de mídia';noteFailure({kind:'player.error',layer:'media',mediaId:String(d.mediaId||''),origin:d.origin||'media',message,details:{code,codeName,attempts:d.attempts||1,retryAttempted,retrySuppressed,vodInfoChecked,noAlternative,catalogExtension:d.catalogExtension||'',currentExtension:d.currentExtension||'',sourceKind:d.sourceKind||'',mkvAttempted:!!d.mkvAttempted,timeout:!!d.timeout,canPlayType:d.canPlayType||'',currentTime:Number(d.currentTime)||0,readyState:d.readyState||0,networkState:d.networkState||0}});player.error(new Error(message))},{passive:true});
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
function diagnostic(){return{build:clone(window.__SRH_DEBUG_BUILD__||{}),manifest:readBuildManifest(),supervisor:VERSION,sessionId:SESSION_ID,uptimeMs:Date.now()-startedAt,mode:window.__srhA?.m||'',safeMode,hotUpdate:{enabled:true,regenerationRequired:false,refreshRequired:true,channel:'v6.6-debug/public/x/dbg.js'},appStorage:sanitize(window.SRH25?.storage?.stats?.()||null),points:pointStatus(),incidents:incidentSummary(),state:clone(state),requests:requestManager.snapshot(),circuits:[...circuits].map(([service,x])=>({service,...x})),cache:{versions:cacheVersions,...clone(state.cache)},logs:logs.slice(-220)}}

function panel(){
  if(document.getElementById('srhDebugPanel'))return;
  const root=document.createElement('div');root.id='srhDebugPanel';root.className='srh-debug-panel is-hidden';root.dataset.srhDebugUi='1';
  root.innerHTML='<div class="srh-debug-head"><strong>Diagnóstico</strong><button data-x="close" aria-label="Fechar">×</button></div><div class="srh-debug-scroll"><div class="srh-debug-status" data-x="status"></div><div class="srh-debug-incidents" data-x="incidents"></div><div class="srh-debug-points" data-x="points"></div><div class="srh-debug-actions"><button data-x="issues">Copiar erros/lentidão</button><button data-x="incident">Copiar último incidente</button><button data-x="smoke">Rodar smoke test</button><button data-x="copy">Copiar diagnóstico</button><button data-x="export">Exportar configuração</button><button data-x="import">Importar configuração</button><button data-x="safe">Modo seguro</button><button data-x="migrate">Migrar dados</button><button data-x="cache">Limpar cache debug</button></div><pre class="srh-debug-output" data-x="out"></pre></div><input type="file" data-x="file" accept="application/json" hidden>';
  document.body.appendChild(root);
  const q=s=>root.querySelector(s),out=q('[data-x="out"]'),status=q('[data-x="status"]'),points=q('[data-x="points"]'),incidents=q('[data-x="incidents"]');
  const render=()=>{
    markDebugUiWork(220);
    const d=diagnostic(),ps=Object.values(d.points);
    status.textContent=(d.state?.health?.router?'Router OK':'Router ?')+' · '+(d.state?.health?.storage?'Storage OK':'Storage bloqueado')+' · '+Number(d.state?.network?.active||0)+' req ativa(s) · '+(Array.isArray(d.incidents?.active)?d.incidents.active.length:0)+' incidente(s) ativo(s)';
    const recent=d.incidents.recent;incidents.innerHTML='<div class="srh-debug-incidents__title">Incidentes capturados · sessão '+d.sessionId+'</div>'+(recent.length?recent.map(x=>'<div class="srh-debug-incident '+x.status+'"><b>'+String(x.kind||'erro')+'</b><span>'+String(x.message||'').replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))+'</span><em>'+Math.round(x.ms||x.recoveryMs||0)+' ms · '+x.status+'</em></div>').join(''):'<div class="srh-debug-incident empty">Nenhum incidente registrado nesta janela.</div>');
    points.innerHTML=ps.map((p,i)=>'<div class="'+(p.ok?'ok':'bad')+'"><span>'+(i+1)+'</span><b>'+p.name+'</b><em>'+(p.ok?'OK':'PENDENTE')+'</em></div>').join('');
    out.textContent=JSON.stringify(d,null,2)
  };
  root.render=render;
  q('[data-x="close"]').onclick=()=>root.classList.add('is-hidden');
  q('[data-x="issues"]').onclick=async()=>{const payload=issueExport(),t=JSON.stringify(payload,null,2);try{await navigator.clipboard.writeText(t);status.textContent=payload.count+' erro(s)/lentidão copiado(s).'}catch{download('srhell-erros-lentidao.json',t)}};
  q('[data-x="incident"]').onclick=async()=>{const row=incidentSummary().recent[0];const t=JSON.stringify(row||{message:'Nenhum incidente registrado'},null,2);try{await navigator.clipboard.writeText(t);status.textContent='Último incidente copiado.'}catch{download('srhell-incidente-debug.json',t)}};
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
  if(!b){b=document.createElement('button');b.id='srhDebugButton';b.type='button';b.className='srh-debug-button';b.dataset.srhDebugUi='1';b.textContent='Diagnóstico';b.onclick=e=>{markDebugUiWork(220);e.stopPropagation();const p=document.getElementById('srhDebugPanel');p.classList.toggle('is-hidden');p.render?.()}}
  if(settings){b.classList.remove('is-floating');settings.prepend(b)}else if(!b.isConnected){b.classList.add('is-floating');document.body.appendChild(b)}
}


function updateDebugBadge(){
  markDebugUiWork(48);
  const b=document.getElementById('srhDebugButton');if(!b)return;
  const n=Number(state.incidents?.active||0),slow=Number(state.incidents?.slow||0);
  b.textContent=n?'Diagnóstico · '+n:(slow?'Diagnóstico · '+slow+' lento(s)':'Diagnóstico');
  b.classList.toggle('has-incident',n>0)
}
function classifyAction(params={}){
  const action=String(params?.action||'');
  if(action==='get_vod_categories')return'catalog.categories';
  if(action==='get_vod_streams')return'catalog.items';
  if(action)return'xtream.'+action;
  return'xtream.account'
}
function instrumentShortsRequests(S){
  if(!S||S.__debugRequestsInstrumented)return;
  S.__debugRequestsInstrumented=true;
  for(const name of ['request','requestWithConfig']){
    const original=S[name];if(typeof original!=='function')continue;
    S[name]=async function(params={}){
      const started=performance.now(),kind=classifyAction(params),optionalAccount=kind==='xtream.account',meta={kind,action:String(params?.action||''),categoryId:String(params?.category_id||''),layer:'shorts.'+name,origin:'xtream'};
      log('info',optionalAccount?'account.request.start':'catalog.request.start',meta);
      try{
        const result=await original.apply(this,arguments),ms=Math.round(performance.now()-started),count=Array.isArray(result)?result.length:(result&&typeof result==='object'?Object.keys(result).length:0),thresholdMs=Math.round(Math.max(2500,1200+Math.min(6000,count*1.5))),msPerItem=count?Number((ms/count).toFixed(3)):0,itemsPerSecond=count&&ms?Math.round(count/(ms/1000)):0;
        if(optionalAccount){patch('account',{last:{ms,ok:true},updatedAt:Date.now()});log('info','account.request.ok',{...meta,ms});return result}
        noteRecovery({...meta,ms,status:200});
        if(ms>thresholdMs)noteSlow({...meta,ms,message:'Consulta de catálogo lenta',details:{count,thresholdMs,msPerItem,itemsPerSecond}});
        patch('catalog',{last:{...meta,ms,count,thresholdMs,msPerItem,itemsPerSecond,ok:true},updatedAt:Date.now()});
        log('info','catalog.request.ok',{...meta,ms,count,thresholdMs,msPerItem,itemsPerSecond});return result
      }catch(e){
        const ms=Math.round(performance.now()-started),error=safeText(e?.message||e);
        if(optionalAccount){patch('account',{last:{ms,ok:false,error},updatedAt:Date.now()});log('warn','account.request.optional_failed',{...meta,ms,error});throw e}
        noteFailure({...meta,ms,message:e?.message||String(e)});
        patch('catalog',{last:{...meta,ms,ok:false,error},updatedAt:Date.now()});
        log('error','catalog.request.error',{...meta,ms,error});throw e
      }
    }
  }
}
function observeCatalogStatus(){
  const node=document.querySelector('#feedStatus');if(!node||node.__srhDebugObserved)return;
  node.__srhDebugObserved=true;let last='';
  const read=()=>{
    const text=String(node.textContent||'').trim();if(!text||text===last)return;last=text;
    log('info','catalog.ui_status',{text});
    const bad=/falha|erro|error|timeout|tempo esgotado|abort|length|comprimento|lag|inválid/i.test(text);
    const ok=/shorts|mesclando|carregando|atualizando/i.test(text)&&!bad;
    const meta={kind:'catalog.ui',layer:'status',origin:'ui',message:text};
    if(bad)noteFailure(meta);else if(ok)noteRecovery(meta)
  };
  new MutationObserver(read).observe(node,{subtree:true,childList:true,characterData:true});read()
}
function installConsoleCapture(){
  if(console.__srhDebugCaptured)return;console.__srhDebugCaptured=true;
  for(const level of ['warn','error']){
    const original=console[level]?.bind(console);if(!original)continue;
    console[level]=function(){try{const message=[...arguments].map(x=>typeof x==='string'?x:JSON.stringify(sanitize(x))).join(' ').slice(0,1600);log(level==='error'?'error':'warn','console.'+level,{message});if(level==='error')noteFailure({kind:'console',layer:'console',origin:'page',message})}catch{}return original(...arguments)}
  }
}

const DEBUG_UI_SELECTOR='#srhDebugPanel,#srhDebugButton,.srh-debug-panel,.srh-debug-button,[data-srh-debug-ui="1"]';
const debugUiWorkWindows=[];
function perfClock(){try{return performance.now()}catch{return Date.now()}}
function markDebugUiWork(ms=180){
  const t=perfClock(),row={start:Math.max(0,t-4),end:t+Math.max(24,Number(ms)||0)};
  debugUiWorkWindows.push(row);
  if(debugUiWorkWindows.length>24)debugUiWorkWindows.splice(0,debugUiWorkWindows.length-24);
  return row
}
function overlapsDebugUiWork(start,duration=0){
  const a=Number(start)||0,b=a+Math.max(0,Number(duration)||0);
  for(let i=debugUiWorkWindows.length-1;i>=0;i--){const w=debugUiWorkWindows[i];if(w.end<a-1200)break;if(a<=w.end&&b>=w.start)return true}
  return false
}
function debugUiElement(node){
  try{
    const el=node?.nodeType===1?node:node?.parentElement;
    return !!el?.closest?.(DEBUG_UI_SELECTOR)
  }catch{return false}
}
function shortsPerfMode(){
  const cfg=readAppConfig(),mode=String(cfg?.appMode||window.__SRH_DEBUG_BUILD__?.mode||window.__srhA?.m||'').toLowerCase();
  return mode==='shorts'||mode==='h'
}
function perfTarget(node){
  try{
    const el=node?.nodeType===1?node:node?.parentElement;
    if(!el)return'unknown';
    const id=el.id?'#'+String(el.id).slice(0,48):'';
    const cls=[...el.classList].filter(x=>!/^is-|^has-/.test(x)).slice(0,2).map(x=>'.'+x).join('');
    return String(el.tagName||'node').toLowerCase()+id+cls
  }catch{return'unknown'}
}
function perfAction(node,type='interaction'){
  try{
    const el=node?.nodeType===1?node:node?.parentElement;
    if(!el)return type;
    if(el.closest('#shortGrid [data-id],#libraryGrid [data-id]'))return'open-short';
    if(el.closest('#shortPlayer,#playerStage'))return'player';
    if(el.closest('#arcDrawer,#arcBackdrop'))return'episode-arcs';
    if(el.closest('#searchButton,#searchWrap,#shortSearch'))return'search';
    if(el.closest('#settingsButton,#settingsPanel'))return'settings';
    if(el.closest('#historyButton,#favoritesButton,#libraryView'))return'library';
    if(el.closest('#shortUpdate'))return'update-source';
    if(el.closest('#miniResumeDock,[data-mini-resume]'))return'mini-resume';
    return type
  }catch{return type}
}
function relevantAppMutation(record){
  if(!record||debugUiElement(record.target))return false;
  const changed=[...(record.addedNodes||[]),...(record.removedNodes||[])];
  if(changed.length&&changed.every(debugUiElement))return false;
  return true
}

const shortsPerfRuntime={
  installed:false,pending:null,samples:[],scroll:null,scrollTimer:0,
  frameRunning:false,frameLast:0,frameUntil:0,lastJankAt:0,
  renderWindow:{start:0,records:0,batches:0,roots:new Set()}
};
function shortsPerfPatch(extra={}){
  patch('performance.shorts',{...(get('performance.shorts')||{}),...extra})
}
function shortsPerformanceExport(){
  const summary=sanitize(get('performance.shorts')||{});
  return{...summary,recentInteractions:shortsPerfRuntime.samples.slice(-12).map(x=>sanitize(x))}
}
function frameProbe(ms=1200){
  if(!shortsPerfMode()||typeof requestAnimationFrame!=='function')return;
  const now=perfClock();shortsPerfRuntime.frameUntil=Math.max(shortsPerfRuntime.frameUntil,now+ms);
  if(shortsPerfRuntime.frameRunning)return;
  shortsPerfRuntime.frameRunning=true;shortsPerfRuntime.frameLast=0;
  const tick=t=>{
    if(!shortsPerfRuntime.frameRunning)return;
    if(document.hidden||t>shortsPerfRuntime.frameUntil){shortsPerfRuntime.frameRunning=false;shortsPerfRuntime.frameLast=0;return}
    const prev=shortsPerfRuntime.frameLast;shortsPerfRuntime.frameLast=t;
    if(prev>0){
      const delta=t-prev;
      if(delta>34&&!overlapsDebugUiWork(prev,delta)){
        const missed=Math.max(1,Math.round(delta/16.67)-1),p=get('performance.shorts')||{};
        const worst=Math.max(Number(p.worstFrameMs)||0,Math.round(delta));
        let bursts=Number(p.jankBursts)||0;
        if(delta>=50&&t-shortsPerfRuntime.lastJankAt>220){bursts++;shortsPerfRuntime.lastJankAt=t}
        shortsPerfPatch({worstFrameMs:worst,missedFrames:(Number(p.missedFrames)||0)+missed,jankBursts:bursts});
        const row=shortsPerfRuntime.pending;if(row){row.worstFrameMs=Math.max(row.worstFrameMs||0,Math.round(delta));row.missedFrames=(row.missedFrames||0)+missed}
        const sc=shortsPerfRuntime.scroll;if(sc){sc.worstFrameMs=Math.max(sc.worstFrameMs||0,Math.round(delta));sc.missedFrames=(sc.missedFrames||0)+missed}
      }
    }
    requestAnimationFrame(tick)
  };
  requestAnimationFrame(tick)
}
function finalizePerfInteraction(row,reason='settled'){
  if(!row||row.done)return;row.done=true;
  clearTimeout(row.settleTimer);clearTimeout(row.maxTimer);clearTimeout(row.noMutationTimer);
  if(shortsPerfRuntime.pending===row)shortsPerfRuntime.pending=null;
  const t=perfClock(),hasMutation=(row.mutationCount||0)>0||row.lastMutationAt>0;
  row.settleMs=hasMutation?Math.max(row.settleMs||0,Math.round(row.lastMutationAt-row.start)):0;
  row.paintMs=Math.round(row.paintMs||0);row.handlerMs=Math.round(row.handlerMs||0);row.firstMutationMs=Math.round(row.firstMutationMs||0);
  row.totalMs=Math.max(row.handlerMs,row.paintMs,row.settleMs,row.firstMutationMs,row.worstFrameMs||0);
  row.reason=reason;
  row.slow=row.handlerMs>=120||row.paintMs>=140||(hasMutation&&row.settleMs>=320)||(row.worstFrameMs||0)>=80||(row.missedFrames||0)>=4;
  const p=get('performance.shorts')||{},count=Number(p.interactionCount)||0,slowCount=(Number(p.slowInteractions)||0)+(row.slow?1:0),worst=Math.max(Number(p.worstInteractionMs)||0,row.totalMs);
  shortsPerfPatch({interactionCount:count,slowInteractions:slowCount,worstInteractionMs:worst});
  const sample={time:new Date().toISOString(),type:row.type,action:row.action,target:row.target,handlerMs:row.handlerMs,firstMutationMs:row.firstMutationMs,paintMs:row.paintMs,settleMs:row.settleMs,mutationCount:row.mutationCount||0,mutationBatches:row.mutationBatches||0,worstFrameMs:row.worstFrameMs||0,missedFrames:row.missedFrames||0,totalMs:row.totalMs,slow:row.slow,reason};
  shortsPerfRuntime.samples.push(sample);if(shortsPerfRuntime.samples.length>24)shortsPerfRuntime.samples.splice(0,shortsPerfRuntime.samples.length-24);
  if(row.slow)noteSlow({kind:'ui.interaction',layer:'render',origin:'shorts',action:row.action,ms:row.totalMs,message:'Interação demorou para responder',details:sample});
  log(row.slow?'warn':'info','performance.interaction',sample)
}
function beginPerfInteraction(event,type){
  if(!shortsPerfMode()||debugUiElement(event?.target))return;
  const target=event?.target;if(!target)return;
  const action=perfAction(target,type),t=perfClock();
  if(shortsPerfRuntime.pending)finalizePerfInteraction(shortsPerfRuntime.pending,'superseded');
  const p=get('performance.shorts')||{},row={id:uid(),type,action,target:perfTarget(target),start:t,handlerMs:0,firstMutationMs:0,paintMs:0,settleMs:0,mutationCount:0,mutationBatches:0,worstFrameMs:0,missedFrames:0,lastMutationAt:0,done:false};
  shortsPerfRuntime.pending=row;shortsPerfPatch({enabled:true,interactionCount:(Number(p.interactionCount)||0)+1});
  setTimeout(()=>{if(!row.done)row.handlerMs=Math.max(row.handlerMs,Math.round(perfClock()-t))},0);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!row.done)row.paintMs=Math.max(row.paintMs,Math.round(perfClock()-t))}));
  row.noMutationTimer=setTimeout(()=>finalizePerfInteraction(row,'quiet-no-mutation'),360);
  row.maxTimer=setTimeout(()=>finalizePerfInteraction(row,'max-window'),1800);
  frameProbe(1800)
}
function finalizeScrollBurst(){
  const row=shortsPerfRuntime.scroll;if(!row)return;shortsPerfRuntime.scroll=null;clearTimeout(shortsPerfRuntime.scrollTimer);
  row.durationMs=Math.round(Math.max(0,row.last-row.start));row.slow=(row.worstFrameMs||0)>=80||(row.missedFrames||0)>=5;
  const p=get('performance.shorts')||{};
  shortsPerfPatch({scrollBursts:(Number(p.scrollBursts)||0)+1});
  if(row.slow)noteSlow({kind:'ui.scroll',layer:'render',origin:'shorts',ms:Math.max(row.durationMs,row.worstFrameMs||0),message:'Rolagem apresentou frames perdidos',details:{target:row.target,events:row.events,durationMs:row.durationMs,worstFrameMs:row.worstFrameMs||0,missedFrames:row.missedFrames||0}});
  log(row.slow?'warn':'info','performance.scroll',{target:row.target,events:row.events,durationMs:row.durationMs,worstFrameMs:row.worstFrameMs||0,missedFrames:row.missedFrames||0,slow:row.slow})
}
function installShortsPerformanceSupervisor(){
  if(shortsPerfRuntime.installed||!shortsPerfMode())return;
  shortsPerfRuntime.installed=true;shortsPerfPatch({enabled:true});
  const onInteraction=(e,type)=>{
    if(type==='keydown'&&!['Enter',' ','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(String(e.key||'')))return;
    if(type==='input'&&!e.target?.matches?.('#shortSearch,input,textarea'))return;
    beginPerfInteraction(e,type)
  };
  document.addEventListener('click',e=>onInteraction(e,'click'),true);
  document.addEventListener('keydown',e=>onInteraction(e,'keydown'),true);
  document.addEventListener('input',e=>onInteraction(e,'input'),true);
  document.addEventListener('scroll',e=>{
    if(debugUiElement(e.target))return;
    const t=perfClock(),target=perfTarget(e.target===document?document.scrollingElement||document.body:e.target);
    let row=shortsPerfRuntime.scroll;
    if(!row||row.target!==target){if(row)finalizeScrollBurst();row=shortsPerfRuntime.scroll={target,start:t,last:t,events:0,worstFrameMs:0,missedFrames:0}}
    row.last=t;row.events++;clearTimeout(shortsPerfRuntime.scrollTimer);shortsPerfRuntime.scrollTimer=setTimeout(finalizeScrollBurst,160);frameProbe(650)
  },true);
  if(typeof MutationObserver==='function'){
    const observer=new MutationObserver(records=>{
      const useful=records.filter(relevantAppMutation);if(!useful.length)return;
      const count=useful.length,t=perfClock(),p=get('performance.shorts')||{};
      const largest=Math.max(Number(p.largestMutationBatch)||0,count);
      shortsPerfPatch({renderMutations:(Number(p.renderMutations)||0)+count,renderBatches:(Number(p.renderBatches)||0)+1,largestMutationBatch:largest});
      const row=shortsPerfRuntime.pending;
      if(row){
        row.mutationCount+=count;row.mutationBatches++;row.lastMutationAt=t;
        if(!row.firstMutationMs)row.firstMutationMs=Math.round(t-row.start);
        clearTimeout(row.noMutationTimer);clearTimeout(row.settleTimer);row.settleTimer=setTimeout(()=>finalizePerfInteraction(row,'mutation-settled'),120)
      }
      const w=shortsPerfRuntime.renderWindow;
      if(!w.start||t-w.start>600){w.start=t;w.records=0;w.batches=0;w.roots.clear()}
      w.records+=count;w.batches++;
      for(const rec of useful){if(w.roots.size>=5)break;w.roots.add(perfTarget(rec.target))}
      if(count>=180||w.records>=450){
        noteSlow({kind:'ui.render',layer:'dom',origin:'shorts',ms:Math.round(t-w.start),message:'Renderização gerou muitas mutações DOM',details:{batchRecords:count,windowRecords:w.records,batches:w.batches,windowMs:Math.round(t-w.start),roots:[...w.roots]}});
        log('warn','performance.render_churn',{batchRecords:count,windowRecords:w.records,batches:w.batches,roots:[...w.roots]});
        w.start=t;w.records=0;w.batches=0;w.roots.clear()
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','src']})
  }
  try{
    if(typeof PerformanceObserver==='function'){
      const shifts=new PerformanceObserver(list=>{for(const e of list.getEntries()){
        const sources=Array.isArray(e.sources)?e.sources:[],allDebug=sources.length&&sources.every(x=>debugUiElement(x?.node));
        if(allDebug||overlapsDebugUiWork(e.startTime||0,0))continue;
        const score=Number(e.value)||0;if(score<=0)continue;
        const p=get('performance.shorts')||{},sample={time:new Date().toISOString(),score:Number(score.toFixed(4)),hadRecentInput:!!e.hadRecentInput,sources:sources.slice(0,4).map(x=>perfTarget(x?.node)).filter(Boolean)},recent=Array.isArray(p.recentLayoutShifts)?p.recentLayoutShifts.slice(-7):[];
        recent.push(sample);
        if(e.hadRecentInput){shortsPerfPatch({layoutShiftsInputIgnored:(Number(p.layoutShiftsInputIgnored)||0)+1,recentLayoutShifts:recent});continue}
        shortsPerfPatch({layoutShifts:(Number(p.layoutShifts)||0)+1,maxLayoutShift:Math.max(Number(p.maxLayoutShift)||0,Number(score.toFixed(4))),recentLayoutShifts:recent});
        if(score>=0.15)noteSlow({kind:'ui.layout',layer:'render',origin:'shorts',ms:0,message:'Mudança visual significativa durante renderização',details:sample})
      }});
      shifts.observe({entryTypes:['layout-shift']})
    }
  }catch{}
  log('info','performance.shorts_supervisor_ready',{debugUiExcluded:true,interactionWindowMs:1800,renderWindowMs:600})
}

function installPerformanceTracing(){
  if(typeof PerformanceObserver!=='function'||window.__SRH_DEBUG_PERF_V2__)return;window.__SRH_DEBUG_PERF_V2__=true;
  try{
    const recentLong=[];const longObserver=new PerformanceObserver(list=>{for(const e of list.getEntries()){if(overlapsDebugUiWork(e.startTime,e.duration))continue;const ms=Math.round(e.duration),t=performance.now();state.performance.longTasks++;state.performance.longestMs=Math.max(state.performance.longestMs,ms);patch('performance',{longTasks:state.performance.longTasks,longestMs:state.performance.longestMs,slowResources:state.performance.slowResources});if(ms>=120)log('info','performance.longtask',{ms,name:e.name,start:Math.round(e.startTime)});if(ms>=200){recentLong.push({t,ms});while(recentLong.length&&t-recentLong[0].t>6000)recentLong.shift()}if(ms>=400)noteSlow({kind:'main-thread',layer:'performance',origin:'page',ms,message:'Main thread bloqueada',details:{name:e.name,start:Math.round(e.startTime),burst:recentLong.length}});else if(recentLong.length>=3){const total=recentLong.reduce((a,x)=>a+x.ms,0);noteSlow({kind:'main-thread',layer:'performance',origin:'page',ms:Math.max(...recentLong.map(x=>x.ms)),message:'Rajada de bloqueios na main thread',details:{count:recentLong.length,totalMs:total,windowMs:6000}});recentLong.length=0}}});
    longObserver.observe({entryTypes:['longtask']})
  }catch{}
  try{
    const resourceObserver=new PerformanceObserver(list=>{for(const e of list.getEntries()){if(e.duration<2500)continue;const meta=requestMeta(e.name),initiator=String(e.initiatorType||'').toLowerCase();if(meta.kind.startsWith('catalog.')||meta.kind==='xtream.api'||meta.kind==='proxy'||meta.kind==='media'||initiator==='video'||initiator==='audio'||initiator==='img')continue;state.performance.slowResources++;patch('performance',{slowResources:state.performance.slowResources});noteSlow({...meta,layer:'resource',ms:Math.round(e.duration),message:'Recurso demorou para carregar',details:{initiatorType:e.initiatorType,transferSize:e.transferSize||0,source:meta.url,path:meta.path,action:meta.action||''}})}});
    resourceObserver.observe({entryTypes:['resource']})
  }catch{}
}

function bridge(){
  syncAppState();
  const S=window.SRH25;
  if(S&&!S.__debugBridge){
    S.__debugBridge=true;S.centralState=api.state;patch('shorts',{connected:true,appId:S.cfg?.appId||'',items:S.state?.items?.length||0});if(S.storage?.stats)patch('storage',{...get('storage'),runtimeBackend:'indexeddb',appDb:sanitize(S.storage.stats())});instrumentShortsRequests(S);observeCatalogStatus();window.addEventListener('srh25:transport',e=>{const detail=e.detail||{};recoverTransportFailures(detail);log('info','transport.winner',detail)},{passive:true});window.addEventListener('srh25:catalog-render',e=>{const count=Array.isArray(e.detail?.items)?e.detail.items.length:0;if(count>0){noteRecovery({kind:'catalog.ui',layer:'status',origin:'ui',ms:0,status:200});patch('catalog',{rendered:true,count,renderedAt:Date.now()});log('info','catalog.rendered',{count})}},{passive:true});
    if(typeof S.openPlayer==='function'){const oldOpen=S.openPlayer;S.openPlayer=function(item){player.begin('shorts',{id:S.id?.(item),title:S.title?.(item)});try{return oldOpen.apply(this,arguments)}catch(e){player.error(e);throw e}}}
  }
}

function installGlobalErrors(){addEventListener('error',e=>{
  const target=e.target&&e.target!==window?e.target:null;
  if(!e.message&&target){
    const tag=String(target.tagName||'resource').toLowerCase(),src=target.currentSrc||target.src||target.href||'';
    const meta={kind:'resource',layer:'resource',origin:'page',message:tag+' falhou ao carregar',details:{tag,source:safeUrl(src)}};
    const critical=['script','link'].includes(tag);
    if(tag==='video'||tag==='source'){log('warn','resource.media_error',meta);return}
    if(critical)noteFailure(meta);else log('warn','resource.error',meta);
    return
  }
  const err=e.error,meta={kind:'javascript',layer:'window',origin:'page',message:e.message||err?.message||'Erro JavaScript sem mensagem',details:{name:err?.name||'',source:safeUrl(e.filename||''),line:e.lineno||0,col:e.colno||0,stack:safeText(err?.stack||'').slice(0,2400)}};
  noteFailure(meta);log('error','window.error',meta)
},true);addEventListener('unhandledrejection',e=>{const reason=e.reason,meta={kind:'promise',layer:'window',origin:'page',message:reason?.message||String(reason),details:{name:reason?.name||'',stack:safeText(reason?.stack||'').slice(0,2400)}};noteFailure(meta);log('error','promise.rejection',meta)})}

function init(){
  boot.begin(window.__SRH_DEBUG_BUILD__||{});
  boot.phase('supervisor-v3');
  patch('meta',{sessionId:SESSION_ID,hotUpdate:true});syncIncidentState();
  syncAppState();
  installGlobalErrors();installConsoleCapture();installPerformanceTracing();installShortsPerformanceSupervisor();
  cache.prune();
  storage.migrate();
  navigation.begin('initial');
  observeVideos();
  panel();
  regression.installGeneratorGuard();
  healthCheck();
  attachButton();
  preload.idle();
  setTimeout(()=>{bridge();attachButton();observeCatalogStatus();regression.smoke()},0);
  setTimeout(()=>{bridge();attachButton();observeCatalogStatus()},500);
  setTimeout(()=>{bridge();attachButton();observeCatalogStatus()},1800);
  setTimeout(()=>{if(state.boot.status==='starting')boot.commit({reason:'watchdog-ready'})},2500)
}

const api={
  version:VERSION,bus,
  state:{get,set,patch,subscribe,transaction,snapshot:()=>clone(state)},
  log,logs,boot,navigation,requests:requestManager,storage,cache,player,regression,preload,healthCheck,diagnostic,incidentSummary,issueExport,noteFailure,noteRecovery,noteSlow,pointStatus,registerExtension,features:{safeMode,hotUpdate:true},attachButton,bridge
};
window.SRHDebug=Object.freeze(api);
init();
})();
