(()=>{const z=window.__srhA;if(!z||z.k!=="e4c98a71"||z.m!=="s"||!Object.isFrozen(z)||typeof z.u!=='function'||typeof z.t!=='function')return;(() => {
'use strict';
const BASE_CONFIG=JSON.parse(document.getElementById('app-config').textContent);
const TYPE={live:{label:'Canais',categories:'get_live_categories',content:'get_live_streams'},vod:{label:'Filmes',categories:'get_vod_categories',content:'get_vod_streams'},series:{label:'Séries',categories:'get_series_categories',content:'get_series'}};
const $=s=>document.querySelector(s);
const el={app:$('#appRoot'),title:$('#appTitle'),meta:$('#appMeta'),daysChip:$('#daysChip'),searchButton:$('#searchButton'),searchWrap:$('#searchWrap'),settingsButton:$('#settingsButton'),settingsPanel:$('#settingsPanel'),expiryDate:$('#expiryDate'),expiryDays:$('#expiryDays'),updateAccordionButton:$('#updateAccordionButton'),updateAccordionBody:$('#updateAccordionBody'),updateAccordionIcon:$('#updateAccordionIcon'),updateM3u:$('#updateM3uInput'),updateLoad:$('#updateLoadButton'),updateApply:$('#updateApplyButton'),updateStatus:$('#updateStatus'),updateGroups:$('#updateGroups'),search:$('#globalSearch'),homeStatus:$('#homeStatus'),continueSection:$('#continueSection'),continueRow:$('#continueRow'),content:$('#contentRoot'),bottomNav:$('#bottomNav'),collectionView:$('#collectionView'),collectionClose:$('#collectionClose'),collectionTitle:$('#collectionTitle'),collectionScroller:$('#collectionScroller'),collectionSpacer:$('#collectionSpacer'),detailLayer:$('#detailLayer'),detailHeadTitle:$('#detailHeadTitle'),detailClose:$('#detailClose'),detailScroll:$('#detailScroll'),detailBody:$('#detailBody'),playerLayer:$('#playerLayer'),playerTitle:$('#playerTitle'),playerClose:$('#playerClose'),playerWrap:$('#playerWrap'),video:$('#videoPlayer'),playerExpand:$('#playerExpand'),playerStatus:$('#playerStatus'),toast:$('#toast')};
function storageKey(){return 'tj_xtream_runtime_'+String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_')}
function loadRuntime(){try{return JSON.parse(localStorage.getItem(storageKey())||'null')}catch{return null}}
let CONFIG={...BASE_CONFIG,...(loadRuntime()||{})};
const STANDARD_APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const STANDARD_DB='srhell-standard-state-v1',STANDARD_STORE='state',STANDARD_COMPLETED_KEY=`srhell:${STANDARD_APP_NS}:standard:completed:v1`,STANDARD_LAST_WATCHED_PREFIX=`srhell:${STANDARD_APP_NS}:standard:last-watched:`;
let standardDbPromise=null,standardWriteTail=Promise.resolve(),standardWritesQueued=0,standardWritesDone=0;
const standardCompletedMemory={},standardLastWatchedMemory={vod:null,series:null};
function standardDbOpen(){if(standardDbPromise)return standardDbPromise;standardDbPromise=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('IndexedDB indisponível'));return}let q;try{q=indexedDB.open(STANDARD_DB,1)}catch(e){standardDbPromise=null;reject(e);return}q.onupgradeneeded=()=>{try{if(!q.result.objectStoreNames.contains(STANDARD_STORE))q.result.createObjectStore(STANDARD_STORE)}catch{}};q.onsuccess=()=>{const db=q.result;db.onversionchange=()=>{try{db.close()}catch{}standardDbPromise=null};resolve(db)};q.onerror=()=>{standardDbPromise=null;reject(q.error||new Error('IndexedDB falhou'))};q.onblocked=()=>{}});return standardDbPromise}
function standardWriteLock(task){standardWritesQueued++;const run=async()=>{try{if(navigator.locks?.request)return await navigator.locks.request('srhell-standard:'+STANDARD_APP_NS,{mode:'exclusive'},task);return await task()}finally{standardWritesDone++}};const next=standardWriteTail.catch(()=>{}).then(run);standardWriteTail=next.catch(()=>{});return next}
async function standardStateGet(key){try{const db=await standardDbOpen();return await new Promise(resolve=>{let r;try{r=db.transaction(STANDARD_STORE,'readonly').objectStore(STANDARD_STORE).get(key)}catch{resolve(null);return}r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>resolve(null)})}catch{return null}}
function standardStateSet(key,value){return standardWriteLock(async()=>{try{const db=await standardDbOpen();return await new Promise(resolve=>{let tx;try{tx=db.transaction(STANDARD_STORE,'readwrite');tx.objectStore(STANDARD_STORE).put(value,key)}catch{resolve(false);return}tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false)})}catch{return false}})}
function standardStateDelete(key){return standardWriteLock(async()=>{try{const db=await standardDbOpen();return await new Promise(resolve=>{let tx;try{tx=db.transaction(STANDARD_STORE,'readwrite');tx.objectStore(STANDARD_STORE).delete(key)}catch{resolve(false);return}tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false)})}catch{return false}})}
function standardProviderId(cfg=CONFIG){let raw=String(cfg?.server||'').trim();if(!raw)return'';if(!/^https?:\/\//i.test(raw))raw='http://'+raw;try{return String(new URL(raw).hostname||'').toLowerCase().replace(/\.$/,'')}catch{return raw.toLowerCase().replace(/^https?:\/\//,'').split('/')[0].split(':')[0].replace(/\.$/,'')}}
async function hydrateStandardRuntime(){const legacy=loadRuntime(),stored=await standardStateGet(storageKey()),runtime=stored&&typeof stored==='object'?stored:legacy;if(runtime&&typeof runtime==='object'){CONFIG={...BASE_CONFIG,...runtime};if(!stored)void standardStateSet(storageKey(),runtime)}try{localStorage.removeItem(storageKey())}catch{}const [completed,lastVod,lastSeries]=await Promise.all([standardStateGet(STANDARD_COMPLETED_KEY),standardStateGet(STANDARD_LAST_WATCHED_PREFIX+'vod'),standardStateGet(STANDARD_LAST_WATCHED_PREFIX+'series')]);if(completed&&typeof completed==='object')Object.assign(standardCompletedMemory,completed);if(lastVod&&typeof lastVod==='object')standardLastWatchedMemory.vod=lastVod;if(lastSeries&&typeof lastSeries==='object')standardLastWatchedMemory.series=lastSeries;return runtime}
function getStandardCompleted(key){return standardCompletedMemory[String(key||'')]||null}
function completedTitleKey(type,tmdbId,providerId=''){
  const t=type==='series'?'series':'vod',tid=String(tmdbId||'').trim();
  if(tid)return 'title:'+t+':tmdb:'+tid;
  const pid=String(providerId||'').trim();
  return pid?'title:'+t+':provider:'+standardProviderId()+':'+pid:''
}
function getStandardTitleCompleted(type,tmdbId,providerId=''){
  const tmdbKey=String(tmdbId||'').trim()?completedTitleKey(type,tmdbId,''):'';
  if(tmdbKey&&standardCompletedMemory[tmdbKey])return standardCompletedMemory[tmdbKey];
  const providerKey=completedTitleKey(type,'',providerId);
  return providerKey?standardCompletedMemory[providerKey]||null:null
}
function persistCompletedRow(key,row){
  if(!key)return false;
  standardCompletedMemory[key]={...row,key,completedAt:row.completedAt||Date.now()};
  const rows=Object.values(standardCompletedMemory).sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0)).slice(0,900),next={};
  for(const x of rows)next[x.key]=x;
  for(const k of Object.keys(standardCompletedMemory))delete standardCompletedMemory[k];
  Object.assign(standardCompletedMemory,next);
  void standardStateSet(STANDARD_COMPLETED_KEY,next);
  return true
}
function getStandardLastWatched(type){return standardLastWatchedMemory[type==='series'?'series':'vod']||null}
function markStandardLastWatched(entry){
  if(!entry||!['vod','series'].includes(entry.type))return false;
  const type=entry.type,key=String(entry.key||''),prev=standardLastWatchedMemory[type],now=Date.now();
  const row={type,key,title:entry.title||'',image:entry.image||'',tmdbId:entry.tmdbId||entry.itemSnapshot?.tmdb_id||null,seriesId:entry.seriesId,season:entry.season,episodeNumber:entry.episodeNumber,containerExtension:entry.containerExtension||'',itemSnapshot:entry.itemSnapshot||null,updatedAt:now};
  standardLastWatchedMemory[type]=row;
  if(!prev||prev.key!==key||now-Number(prev.updatedAt||0)>60000)void standardStateSet(STANDARD_LAST_WATCHED_PREFIX+type,row);
  return true
}
function markStandardEpisodeCompleted(entry,duration){
  if(!entry||entry.type!=='series'||!entry.key)return false;
  return persistCompletedRow(String(entry.key),{scope:'episode',type:'series',seriesId:entry.seriesId,season:entry.season,episodeNumber:entry.episodeNumber,title:entry.title,image:entry.image,tmdbId:entry.tmdbId||null,containerExtension:entry.containerExtension||'',itemSnapshot:entry.itemSnapshot||null,duration:Number(duration)||Number(entry.duration)||0,position:Number(duration)||Number(entry.duration)||0})
}
function markStandardTitleCompleted(entry,duration){
  if(!entry||!['vod','series'].includes(entry.type))return false;
  const providerId=entry.type==='series'?(entry.seriesId||entry.itemSnapshot?.series_id):(entry.itemSnapshot?.stream_id||String(entry.key||'').split(':')[1]);
  const key=completedTitleKey(entry.type,entry.tmdbId||entry.itemSnapshot?.tmdb_id,providerId);
  return persistCompletedRow(key,{scope:'title',type:entry.type,tmdbId:entry.tmdbId||entry.itemSnapshot?.tmdb_id||null,providerId:String(providerId||''),seriesId:entry.seriesId,title:String(entry.title||'').replace(/\s+[—-]\s+Epis[oó]dio\s+\d+.*$/i,''),image:entry.image||'',itemSnapshot:entry.itemSnapshot||null,duration:Number(duration)||Number(entry.duration)||0,position:Number(duration)||Number(entry.duration)||0})
}
function markStandardCompleted(entry,duration){return entry?.type==='series'?markStandardEpisodeCompleted(entry,duration):markStandardTitleCompleted(entry,duration)}
window.__SRH_STANDARD_STORAGE__={backend:'indexeddb',db:STANDARD_DB,stats:()=>({queuedWrites:Math.max(0,standardWritesQueued-standardWritesDone),writesQueued:standardWritesQueued,writesDone:standardWritesDone,webLocks:!!navigator.locks?.request})};
const state={activeType:null,categoryMaps:new Map(),railInstances:[],gridInstance:null,categoryObserver:null,retentionObserver:null,renderToken:0,detailToken:0,seriesPlayToken:0,hls:null,currentMedia:null,currentDetail:null,currentSeries:null,seriesVideo:null,saveTick:0,playerActive:false,updateCandidate:null,updateCategories:[],updateSelected:new Set(),searchTimer:0,searchDataset:null,searchType:null,synopsisExpanded:false,synopsisText:'',synopsisNode:null,collectionOpen:false};
let resolveCatalogMetadata=null,normalizeCatalogLogo=null,tuneCatalogLogoContrast=null;
function isDetailCurrent(token){return token===state.detailToken&&!el.detailLayer.classList.contains('is-hidden')}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
const UI_ICON_PLAY='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" fill="currentColor"/></svg>';
const UI_ICON_CHEVRON_DOWN='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 9.25L12 14.75l5.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UI_ICON_CHEVRON_UP='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 14.75L12 9.25l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const UI_ICON_RATING_STAR='<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.6l2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83L12 3.6z" fill="currentColor"/></svg>';
function setUpdateAccordionIcon(hidden){if(!el.updateAccordionIcon)return;el.updateAccordionIcon.innerHTML=hidden?UI_ICON_CHEVRON_DOWN:UI_ICON_CHEVRON_UP}
function toast(msg){el.toast.textContent=msg;el.toast.classList.add('is-show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.toast.classList.remove('is-show'),2200)}
const SERIES_PROVIDER_GUARD_LIMIT=3,SERIES_PROVIDER_GUARD_KEY='srhell:'+STANDARD_APP_NS+':series-provider-guard:v1';
function seriesProviderGuardFingerprint(){
  const origin=(()=>{try{return new URL(normalizeServer(CONFIG.server)).origin.toLowerCase()}catch{return normalizeServer(CONFIG.server).toLowerCase()}})();
  let h=2166136261;for(const ch of String(CONFIG.username||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return origin+'#'+(h>>>0).toString(36)
}
function readSeriesProviderGuard(){
  const fingerprint=seriesProviderGuardFingerprint();
  try{const all=JSON.parse(sessionStorage.getItem(SERIES_PROVIDER_GUARD_KEY)||'{}'),row=all?.[fingerprint];if(row&&typeof row==='object')return{fingerprint,count:Number(row.count)||0,blocked:!!row.blocked,lastAt:Number(row.lastAt)||0,lastKind:String(row.lastKind||''),lastMessage:String(row.lastMessage||'')}}
  catch{}
  return{fingerprint,count:0,blocked:false,lastAt:0,lastKind:'',lastMessage:''}
}
function writeSeriesProviderGuard(row){
  try{const all=JSON.parse(sessionStorage.getItem(SERIES_PROVIDER_GUARD_KEY)||'{}');all[row.fingerprint]={count:Number(row.count)||0,blocked:!!row.blocked,lastAt:Number(row.lastAt)||Date.now(),lastKind:String(row.lastKind||''),lastMessage:String(row.lastMessage||'')};sessionStorage.setItem(SERIES_PROVIDER_GUARD_KEY,JSON.stringify(all))}catch{}
  state.seriesProviderGuard=row;
  return row
}
function currentSeriesProviderGuard(){const fingerprint=seriesProviderGuardFingerprint(),row=state.seriesProviderGuard;if(row?.fingerprint===fingerprint)return row;return state.seriesProviderGuard=readSeriesProviderGuard()}
function seriesProviderGuardBlocked(){return !!currentSeriesProviderGuard().blocked}
function seriesProviderGuardSuccess(){
  const row=currentSeriesProviderGuard();
  if(!row.count&&!row.blocked)return row;
  const next={...row,count:0,blocked:false,lastAt:Date.now(),lastKind:'',lastMessage:''};
  writeSeriesProviderGuard(next);
  playbackDebug('series-provider-guard-reset',{provider:standardProviderId(),reason:'series-detail-success'});
  return next
}
function classifySeriesProviderFailure(error){
  const kind=String(error?.srhKind||error?.cause?.srhKind||'provider-detail');
  const raw=String(error?.srhRawMessage||error?.cause?.srhRawMessage||error?.message||'Falha ao carregar episódios');
  return{kind,raw}
}
function seriesProviderGuardFailure(error,item){
  const row=currentSeriesProviderGuard(),failure=classifySeriesProviderFailure(error),count=Math.min(SERIES_PROVIDER_GUARD_LIMIT,row.count+1),blocked=count>=SERIES_PROVIDER_GUARD_LIMIT,next={...row,count,blocked,lastAt:Date.now(),lastKind:failure.kind,lastMessage:failure.raw};
  writeSeriesProviderGuard(next);
  playbackDebug('series-provider-guard-failure',{provider:standardProviderId(),mediaId:String(item?.series_id||''),consecutive:count,limit:SERIES_PROVIDER_GUARD_LIMIT,blocked,errorType:failure.kind,rawMessage:failure.raw});
  if(blocked)playbackDebug('series-provider-guard-tripped',{provider:standardProviderId(),consecutive:count,errorType:failure.kind,rawMessage:failure.raw});
  return next
}
function ensureSeriesProviderGuardUi(){
  let layer=document.getElementById('srhSeriesProviderGuardLayer');
  if(layer)return layer;
  const style=document.createElement('style');style.id='srhSeriesProviderGuardStyle';style.textContent='#srhSeriesProviderGuardLayer{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.72);backdrop-filter:blur(10px)}#srhSeriesProviderGuardLayer.is-hidden{display:none}#srhSeriesProviderGuardLayer .srh-provider-guard-card{width:min(430px,100%);padding:22px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:#14181d;color:#f3f4f5;box-shadow:0 24px 70px rgba(0,0,0,.48)}#srhSeriesProviderGuardLayer h3{margin:0 0 10px;font-size:20px;line-height:1.15}#srhSeriesProviderGuardLayer p{margin:0;color:rgba(243,244,245,.78);font-size:14px;line-height:1.48}#srhSeriesProviderGuardLayer button{width:100%;margin-top:18px;padding:12px 16px;border:0;border-radius:12px;background:#f1f3f5;color:#101317;font-weight:800;font-size:14px}';document.head.appendChild(style);
  layer=document.createElement('div');layer.id='srhSeriesProviderGuardLayer';layer.className='is-hidden';layer.innerHTML='<div class="srh-provider-guard-card" role="dialog" aria-modal="true" aria-labelledby="srhSeriesProviderGuardTitle"><h3 id="srhSeriesProviderGuardTitle">Problema na rota de séries</h3><p>O URL do seu provedor está com problemas ao carregar os episódios, provavelmente por uma falha na rota interna da API. Troque para outro URL para continuar usando Séries.</p><button type="button">Entendi</button></div>';document.body.appendChild(layer);layer.querySelector('button').onclick=()=>layer.classList.add('is-hidden');return layer
}
function showSeriesProviderGuardPopup(){const layer=ensureSeriesProviderGuardUi();layer.classList.remove('is-hidden');layer.querySelector('button')?.focus?.()}
function renderSeriesProviderGuardBlocked(){
  destroyVirtualizers();state.searchDataset=null;state.searchType=null;el.continueSection.classList.add('is-hidden');el.continueRow.innerHTML='';el.homeStatus.textContent='Séries indisponíveis para este URL.';el.content.innerHTML='<div class="rail-load-error" role="status"><span>O provedor falhou três vezes seguidas ao carregar episódios. O catálogo de Séries foi interrompido para evitar novas tentativas sem resultado. Troque o URL do provedor nas configurações.</span><button type="button" data-series-provider-settings>Abrir configurações</button></div>';el.content.querySelector('[data-series-provider-settings]')?.addEventListener('click',()=>{el.settingsPanel.classList.remove('is-hidden');el.updateAccordionBody?.classList.remove('is-hidden');setUpdateAccordionIcon(false);el.updateM3u?.focus?.()});renderTabs()
}
async function activateSeriesProviderGuard(){
  try{await closeDetail()}catch{}
  if(state.collectionOpen)closeCollection(false);
  if(state.activeType==='series')renderActiveType();
  showSeriesProviderGuardPopup()
}
const IMAGE_PLACEHOLDER='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#20242b"/><stop offset="1" stop-color="#111318"/></linearGradient></defs><rect width="180" height="300" rx="10" fill="url(#g)"/><path d="M55 168l25-27 18 18 17-14 24 28" fill="none" stroke="#7f8792" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="113" cy="112" r="10" fill="none" stroke="#7f8792" stroke-width="5"/><rect x="40" y="88" width="100" height="96" rx="10" fill="none" stroke="#59616d" stroke-width="4"/></svg>`);
function isBrandingImage(img){return !!img?.matches?.('.stream-hero__logo,.srh-playback-feedback__logo,.srh-art-brand img,.srh-art-brand__logo,[data-srh-clean-logo]')}
function installImageFallback(){document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.fallback==='1'||img.dataset.srhImageChain==='1'||isBrandingImage(img))return;img.dataset.fallback='1';img.classList.add('image-fallback');img.src=IMAGE_PLACEHOLDER},true)}
function stripEmoji(value,fallback='Categoria'){let s=String(value||'');try{s=s.replace(/\p{Extended_Pictographic}/gu,'')}catch{}try{s=s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu,'')}catch{}s=s.replace(/[\u200D\u20E3\uFE0E\uFE0F]/g,'').replace(/[\u2600-\u27BF]/g,'').replace(/^[\s|•·:;,_—–-]+|[\s|•·:;,_—–-]+$/g,'').replace(/\s{2,}/g,' ').trim();return s||fallback}
function normalizeServer(s){return String(s||'').trim().replace(/\/+$/,'')}
function parseLogin(raw){let text=String(raw||'').trim();if(!text)throw new Error('Informe o novo M3U.');if(!/^https?:\/\//i.test(text))text='http://'+text;let u;try{u=new URL(text)}catch{throw new Error('URL inválida.')}let username=u.searchParams.get('username')||u.searchParams.get('user'),password=u.searchParams.get('password')||u.searchParams.get('pass');const path=u.pathname.split('/').filter(Boolean);if((!username||!password)&&path.length>=2&&!/\.php$/i.test(path[path.length-1])){username=username||decodeURIComponent(path[0]);password=password||decodeURIComponent(path[1])}if(!username||!password)throw new Error('Não encontrei username e password.');return{server:normalizeServer(u.origin),username,password,liveExtension:(u.searchParams.get('output')||'m3u8').toLowerCase()==='ts'?'ts':'m3u8'}}
const xuiRouteState={bases:[],discovery:null,preferred:new Map()};
function playerApiUrl(base,params={},cfg=CONFIG,endpoint='player_api.php'){const root=normalizeServer(base||cfg.server),u=new URL(root+'/'+String(endpoint||'player_api.php').replace(/^\/+/,''));u.searchParams.set('username',cfg.username);u.searchParams.set('password',cfg.password);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));return u.toString()}
function apiUrl(params={},cfg=CONFIG){return playerApiUrl(cfg.server,params,cfg,'player_api.php')}
function proxyUrl(url,cfg=CONFIG){const p=String(cfg.corsProxy||'').trim();if(!p)return url;return p.includes('{url}')?p.replace('{url}',encodeURIComponent(url)):p+encodeURIComponent(url)}
function xuiBaseFromParts(raw,protocol='',port=''){let value=String(raw||'').trim();if(!value)return'';try{if(!/^https?:\/\//i.test(value))value=(protocol||'http')+'://'+value;const u=new URL(value),scheme=String(protocol||'').replace(/:$/,'');if(scheme)u.protocol=scheme+':';if(port)u.port=String(port);u.pathname='/';u.search='';u.hash='';return normalizeServer(u.origin)}catch{return''}}
function protocolTwinBase(base){try{const u=new URL(normalizeServer(base));u.protocol=u.protocol==='http:'?'https:':'http:';return normalizeServer(u.origin)}catch{return''}}
function rememberXuiServerInfo(payload,cfg=CONFIG){if(cfg!==CONFIG)return[];const info=payload?.server_info;if(!info||typeof info!=='object')return[];const found=[],seen=new Set(xuiRouteState.bases);const add=v=>{v=normalizeServer(v);if(!v||v===normalizeServer(cfg.server)||seen.has(v))return;seen.add(v);xuiRouteState.bases.push(v);found.push(v)};const raw=info.url||info.server_url||info.host||info.server||'',protocol=String(info.server_protocol||info.protocol||'http').replace(/:$/,''),port=info.port||'',httpsPort=info.https_port||info.httpsPort||'';add(xuiBaseFromParts(raw,protocol,port));add(xuiBaseFromParts(raw,'http',port));if(httpsPort)add(xuiBaseFromParts(raw,'https',httpsPort));else add(xuiBaseFromParts(raw,'https',''));if(found.length)playbackDebug('xui-route-discovered',{count:found.length,origins:found.map(v=>{try{return new URL(v).origin}catch{return v}})});return found}
function addDetailCandidate(out,seen,base,endpoint,params,cfg,kind,proxied=false){if(!base)return;let raw='';try{raw=playerApiUrl(base,params,cfg,endpoint)}catch{return}const url=proxied?proxyUrl(raw,cfg):raw;if(!url||seen.has(url))return;seen.add(url);out.push({url,base:normalizeServer(base),endpoint,kind,proxied,signature:[normalizeServer(base),endpoint,proxied?'proxy':'direct'].join('|')})}
function seriesXuiCandidates(params,cfg=CONFIG,seen=new Set()){const out=[],provider=normalizeServer(cfg.server),pref=xuiRouteState.preferred.get(provider+'|get_series_info');if(pref)addDetailCandidate(out,seen,pref.base,pref.endpoint,params,cfg,'xui-preferred',pref.proxied);const roots=[],rootSeen=new Set(),addRoot=v=>{v=normalizeServer(v);if(v&&!rootSeen.has(v)){rootSeen.add(v);roots.push(v)}};addRoot(cfg.server);addRoot(protocolTwinBase(cfg.server));xuiRouteState.bases.forEach(v=>{addRoot(v);addRoot(protocolTwinBase(v))});for(const base of roots){for(const endpoint of ['player_api.php','player_api']){addDetailCandidate(out,seen,base,endpoint,params,cfg,endpoint==='player_api.php'?'xui-player':'xui-player-alias',false);if(cfg.corsProxy)addDetailCandidate(out,seen,base,endpoint,params,cfg,endpoint==='player_api.php'?'xui-player-proxy':'xui-player-alias-proxy',true)}}return out}
async function ensureXuiRouteDiscovery(cfg=CONFIG,timeout=5200){if(cfg!==CONFIG||xuiRouteState.bases.length)return xuiRouteState.bases;if(xuiRouteState.discovery)return xuiRouteState.discovery;xuiRouteState.discovery=(async()=>{const seen=new Set(),roots=[normalizeServer(cfg.server),protocolTwinBase(cfg.server)].filter(Boolean),attempts=[];for(const base of roots){addDetailCandidate(attempts,seen,base,'player_api.php',{},cfg,'xui-account',false);if(cfg.corsProxy)addDetailCandidate(attempts,seen,base,'player_api.php',{},cfg,'xui-account-proxy',true)}for(const candidate of attempts){try{const data=await requestJson(candidate.url,timeout,{srhBypassCircuit:true});if(data?.server_info){rememberXuiServerInfo(data,cfg);break}}catch{}}return xuiRouteState.bases})().finally(()=>{xuiRouteState.discovery=null});return xuiRouteState.discovery}
async function requestJson(url,timeout=12000,fetchInit=null){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{cache:'no-store',...(fetchInit||{}),signal:controller.signal});
    if(!response.ok){const e=new Error('HTTP '+response.status);e.srhKind='http';e.srhStatus=response.status;throw e}
    return await response.json();
  }catch(error){
    if(error?.srhKind)throw error;
    let out;
    if(error?.name==='AbortError'){out=new Error('A conexão demorou demais. Tente novamente.');out.srhKind='timeout'}
    else if(error?.name==='SyntaxError'){out=new Error('O provedor retornou uma resposta inválida.');out.srhKind='invalid-json'}
    else{out=new Error('Não foi possível carregar os dados. Verifique a conexão.');out.srhKind='network'}
    out.srhRawMessage=String(error?.message||'');
    out.srhName=String(error?.name||'');
    throw out
  }finally{clearTimeout(timer)}
}
async function request(params={},cfg=CONFIG){
  const target=apiUrl(params,cfg);
  try{const data=await requestJson(target);if(!params?.action)rememberXuiServerInfo(data,cfg);return data}
  catch(error){if(!cfg.corsProxy)throw error;const data=await requestJson(proxyUrl(target,cfg));if(!params?.action)rememberXuiServerInfo(data,cfg);return data}
}
const detailRequestInflight=new Map();
const detailResponseCache=new Map();
const DETAIL_CACHE_TTL=6*60*1000,DETAIL_STALE_TTL=60*60*1000;
function cloneDetailPayload(value){
  try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}
}
async function requestProviderDetailStable(params={},cfg=CONFIG,timeout=12000,opts=null){
  const action=String(params?.action||''),mediaId=String(params?.series_id??params?.vod_id??params?.stream_id??'');
  const provider=normalizeServer(cfg.server),cacheKey=[provider,String(cfg.username||''),action,mediaId].join('|');
  const force=!!opts?.force,accept=typeof opts?.accept==='function'?opts.accept:null;
  let cached=detailResponseCache.get(cacheKey),age=cached?Date.now()-Number(cached.at||0):Infinity;
  if(cached&&!force&&age<DETAIL_CACHE_TTL){
    const value=cloneDetailPayload(cached.data);
    if(!accept||accept(value))return value;
    detailResponseCache.delete(cacheKey);
    playbackDebug('detail-stable-cache-rejected',{action,mediaId,ageMs:Math.round(age)});
    cached=null;age=Infinity
  }
  const seen=new Set(),routes=[];
  addDetailCandidate(routes,seen,cfg.server,'player_api.php',params,cfg,'configured-direct',false);
  if(cfg.corsProxy)addDetailCandidate(routes,seen,cfg.server,'player_api.php',params,cfg,'configured-proxy',true);
  let last=null;
  const tryRoutes=async list=>{
    for(const candidate of list){
      try{
        const started=performance.now(),data=await requestJson(candidate.url,timeout,{srhBypassCircuit:true});
        if(!data||typeof data!=='object')throw new Error('O provedor retornou um detalhe inválido.');
        if(accept&&!accept(data)){
          playbackDebug('detail-stable-payload-rejected',{action,mediaId,transport:candidate.kind,endpoint:candidate.endpoint,origin:(()=>{try{return new URL(candidate.url).origin}catch{return''}})(),ms:Math.round(performance.now()-started)});
          throw new Error('O provedor respondeu sem os dados necessários.')
        }
        detailResponseCache.set(cacheKey,{at:Date.now(),data:cloneDetailPayload(data)});
        if(detailResponseCache.size>24)detailResponseCache.delete(detailResponseCache.keys().next().value);
        if(action==='get_series_info'&&candidate.base)xuiRouteState.preferred.set(provider+'|get_series_info',{base:candidate.base,endpoint:candidate.endpoint,proxied:candidate.proxied});
        playbackDebug('detail-stable-provider',{action,mediaId,transport:candidate.kind,endpoint:candidate.endpoint,origin:(()=>{try{return new URL(candidate.url).origin}catch{return''}})(),ms:Math.round(performance.now()-started),forced:force});
        return data
      }catch(e){
        last=e;
        playbackDebug('detail-stable-failed',{action,mediaId,transport:candidate.kind,endpoint:candidate.endpoint,origin:(()=>{try{return new URL(candidate.url).origin}catch{return''}})(),message:e?.message||String(e),forced:force})
      }
    }
    return null
  };
  let data=await tryRoutes(routes);
  if(!data&&action==='get_series_info'){
    await ensureXuiRouteDiscovery(cfg,Math.min(timeout,5200)).catch(()=>[]);
    data=await tryRoutes(seriesXuiCandidates(params,cfg,seen))
  }
  if(data)return cloneDetailPayload(data);
  if(cached&&age<DETAIL_STALE_TTL){
    const value=cloneDetailPayload(cached.data);
    if(!accept||accept(value)){
      playbackDebug('detail-stable-stale-cache',{action,mediaId,ageMs:Math.round(age),message:last?.message||'provider-failure',forced:force});
      return value
    }
  }
  throw last||new Error('Não foi possível carregar os detalhes.')
}
async function requestDetail(params={},cfg=CONFIG){
  const action=String(params?.action||''),mediaId=String(params?.series_id??params?.vod_id??params?.stream_id??''),origin=(()=>{try{return new URL(apiUrl({},cfg)).origin}catch{return''}})();
  const key=[normalizeServer(cfg.server),String(cfg.username||''),action,mediaId].join('|');
  const cached=detailResponseCache.get(key),age=cached?Date.now()-Number(cached.at||0):Infinity;
  if(cached&&age<DETAIL_CACHE_TTL){
    playbackDebug('detail-cache-hit',{action,mediaId,ageMs:Math.round(age)});
    return cloneDetailPayload(cached.data)
  }
  if(detailRequestInflight.has(key))return detailRequestInflight.get(key);
  const job=(async()=>{
    const target=apiUrl(params,cfg),urls=[target];if(cfg.corsProxy)urls.push(proxyUrl(target,cfg));
    const started=performance.now();let last=null;
    for(const url of urls){
      try{
        const data=await requestJson(url,14000,{srhProbe:true});
        const ms=Math.round(performance.now()-started);
        if(ms>2600)window.SRHDebug?.noteSlow?.({kind:'detail.api',action,mediaId,origin,layer:'fetch',ms,message:'Detalhe demorou para carregar'});
        window.SRHDebug?.noteRecovery?.({kind:'detail.api',action,mediaId,origin,layer:'fetch',ms,status:200});
        detailResponseCache.set(key,{at:Date.now(),data:cloneDetailPayload(data)});
        if(detailResponseCache.size>18)detailResponseCache.delete(detailResponseCache.keys().next().value);
        return data
      }catch(e){last=e}
    }
    const ms=Math.round(performance.now()-started);
    if(cached&&age<DETAIL_STALE_TTL){
      window.SRHDebug?.noteRecovery?.({kind:'detail.api',action,mediaId,origin,layer:'fetch',ms,status:200,message:'Detalhe recuperado do cache após falha do provedor'});
      playbackDebug('detail-cache-stale',{action,mediaId,ageMs:Math.round(age),reason:last?.message||'provider-failure'});
      return cloneDetailPayload(cached.data)
    }
    window.SRHDebug?.noteFailure?.({kind:'detail.api',action,mediaId,origin,layer:'fetch',ms,message:last?.message||'Falha ao carregar detalhe'});
    throw last||new Error('Não foi possível carregar os detalhes.')
  })().finally(()=>detailRequestInflight.delete(key));
  detailRequestInflight.set(key,job);return job
}
function targetId(t){return String(t?.id??t?.category_id??t?.categoryId??'').trim()}
function targetKey(t){const id=targetId(t);return String(t?.type||'')+'::'+(id?'id:'+id:'name:'+String(t?.name||''))}
function targetsFor(type){const out=[],seen=new Set();for(const t of (CONFIG.targets||[])){if(t?.type!==type)continue;const key=targetKey(t);if(seen.has(key))continue;seen.add(key);out.push(t)}return out}
function selectedTypes(){return [...new Set((CONFIG.targets||[]).map(t=>t.type).filter(t=>TYPE[t]))]}
function configuredTargetIds(type){return new Set(targetsFor(type).map(targetId).filter(Boolean))}
function buildCategoryLookup(raw){
  const map=new Map(),duplicates=new Set(),ids=new Set();
  for(const c of (Array.isArray(raw)?raw:[])){
    const name=String(c?.category_name??c?.name??''),id=String(c?.category_id??c?.id??'').trim();
    if(!id)continue;ids.add(id);
    if(map.has(name)&&map.get(name)!==id)duplicates.add(name);else if(!map.has(name))map.set(name,id)
  }
  map.__duplicates=duplicates;map.__ids=ids;return map
}
function itemDeclaredCategoryIds(item){
  const vals=[item?.category_id,item?.categoryId,item?.category_ids,item?.categoryIds],out=new Set();
  for(const v of vals){if(v===undefined||v===null||v==='')continue;const parts=Array.isArray(v)?v:String(v).split(/[,;|\s]+/);for(const x of parts){const s=String(x??'').trim();if(s)out.add(s)}}
  return out
}
function scopeCategoryItems(raw,type,id){
  const requested=String(id||''),out=[],membership=new Set();
  for(const item of (Array.isArray(raw)?raw:[])){
    if(!item||typeof item!=='object')continue;
    const declared=itemDeclaredCategoryIds(item);if(declared.size&&!declared.has(requested))continue;
    try{item._srhCategoryId=requested}catch{}
    const iid=String(itemId(item,type)||'');if(iid)membership.add(iid);out.push(item)
  }
  if(!state.srhCatalogMembership)state.srhCatalogMembership=new Map();
  state.srhCatalogMembership.set(type+':'+requested,membership);
  return out
}
function itemTitle(item){return stripEmoji(String(item?.name||item?.title||'Sem título'),'Sem título')}
function itemId(item,type){return type==='series'?item.series_id:item.stream_id}
function imageFor(item,type){if(type==='series')return item.cover||item.stream_icon||item.movie_image||'';return item.stream_icon||item.movie_image||item.cover||''}
function uniqueById(items,type){const seen=new Set();return items.filter(x=>{const k=String(itemId(x,type)??itemTitle(x));if(seen.has(k))return false;seen.add(k);return true})}
function historyKey(type){const app=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_'),bucket=type==='series'?'series':'vod';return `srhell:${app}:standard:continue:${bucket}`}
function getHistory(type){if(type==='live')return[];try{return JSON.parse(localStorage.getItem(historyKey(type))||'[]')}catch{return[]}}
function saveHistory(entry){if(!entry||entry.type==='live')return;const type=entry.type==='series'?'series':'vod';let list=getHistory(type).filter(x=>x.key!==entry.key);list.unshift(entry);localStorage.setItem(historyKey(type),JSON.stringify(list.slice(0,40)));renderContinue()}
function removeHistory(key,type){if(type==='live')return;const bucket=type==='series'?'series':'vod';localStorage.setItem(historyKey(bucket),JSON.stringify(getHistory(bucket).filter(x=>x.key!==key)));renderContinue()}
function formatExpiry(account){const raw=account?.user_info?.exp_date;if(raw===null||raw===undefined||raw===''||String(raw)==='0')return{chip:'∞',date:'Sem expiração informada',days:'Sem limite informado'};const n=Number(raw);if(!Number.isFinite(n))return{chip:'—',date:'Não informada',days:'Não informado'};const d=new Date(n*1000);if(Number.isNaN(d.getTime()))return{chip:'—',date:'Não informada',days:'Não informado'};const diff=Math.ceil((d.getTime()-Date.now())/86400000);return{chip:diff<0?'0d':diff+'d',date:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}),days:diff<0?'Expirada':diff===0?'Expira hoje':diff===1?'1 dia restante':diff+' dias restantes'}}
async function refreshAccount(){el.meta.textContent='Atualizando validade…';try{const account=await request({});const exp=formatExpiry(account);el.daysChip.textContent=exp.chip;el.expiryDate.textContent=exp.date;el.expiryDays.textContent=exp.days;const status=String(account?.user_info?.status||'').trim();el.meta.textContent=(status?status+' · ':'')+exp.days}catch{el.daysChip.textContent='—';el.expiryDate.textContent='Indisponível';el.expiryDays.textContent='Não foi possível consultar';el.meta.textContent='Falha ao consultar validade'}}
async function categoryMap(type,force=false,cfg=CONFIG){if(!force&&cfg===CONFIG&&state.categoryMaps.has(type))return state.categoryMaps.get(type);const raw=await request({action:TYPE[type].categories},cfg),map=buildCategoryLookup(raw);if(cfg===CONFIG)state.categoryMaps.set(type,map);return map}
async function resolveCategoryId(target){
  const explicit=targetId(target),allowed=configuredTargetIds(target?.type);
  if(explicit){if(allowed.size&&!allowed.has(explicit))throw new Error('Categoria fora do escopo configurado.');return explicit}
  const map=await categoryMap(target.type),name=String(target?.name||'');
  if(map.__duplicates?.has(name))throw new Error('Categoria ambígua no HTML legado: '+stripEmoji(name)+'. Reconfigure a categoria.');
  const id=map.get(name);if(!id)throw new Error('Categoria não encontrada: '+stripEmoji(name));return id
}
async function loadTargetItems(target){const id=await resolveCategoryId(target),raw=await request({action:TYPE[target.type].content,category_id:id});return scopeCategoryItems(raw,target.type,id)}
function streamUrl(type,item){const base=normalizeServer(CONFIG.server),u=encodeURIComponent(CONFIG.username),p=encodeURIComponent(CONFIG.password),id=item?.id||item?.stream_id;let ext=item?.container_extension||item?.containerExtension||'';if(type==='live')return `${base}/live/${u}/${p}/${id}.${CONFIG.liveExtension||'m3u8'}`;if(type==='series')return `${base}/series/${u}/${p}/${id}.${ext||'mp4'}`;return `${base}/movie/${u}/${p}/${id}.${ext||'mp4'}`}
function uniqueMediaUrls(values){const out=[];for(const raw of values||[]){const v=String(raw||'').trim();if(v&&!out.includes(v))out.push(v)}return out}
function normalizeMediaUrl(value){const v=String(value||'').trim();if(!v)return'';if(/^https?:\/\//i.test(v))return v;if(v.startsWith('/'))return normalizeServer(CONFIG.server)+v;return''}
function httpsTwin(url){return /^http:\/\//i.test(String(url||''))?String(url).replace(/^http:/i,'https:'):''}
function mediaErrorInfo(video,extra){const e=video?.error,code=e?.code||0,status=Number(extra?.status||extra?.response?.code||extra?.response?.status||extra?.networkDetails?.status||extra?.networkDetails?.statusCode||0),map={1:'reprodução interrompida',2:'erro de rede ao carregar a mídia',3:'o navegador não conseguiu decodificar o vídeo',4:'formato ou codec não suportado pelo navegador'};return{code,status:Number.isFinite(status)&&status>0?status:0,message:extra?.details||extra?.type||map[code]||'falha de mídia desconhecida',networkState:video?.networkState,readyState:video?.readyState}}
function mediaCandidates(value){const curated=Array.isArray(value),list=curated?value:[value],out=[];for(const u of list){out.push(u);if(!curated)out.push(httpsTwin(u))}return uniqueMediaUrls(out)}
function mediaUrlWithExtension(type,id,ext){const base=normalizeServer(CONFIG.server),u=encodeURIComponent(CONFIG.username),p=encodeURIComponent(CONFIG.password),safe=String(ext||'mp4').replace(/^\./,'').toLowerCase();return `${base}/${type==='series'?'series':'movie'}/${u}/${p}/${id}.${safe}`}
function vodSourcesFromInfo(data,item){
  const info=data?.info||{},movie=data?.movie_data||item,id=movie?.stream_id||item?.stream_id;
  const direct=normalizeMediaUrl(movie?.direct_source||info?.direct_source||data?.direct_source||'');
  const exts=uniqueMediaUrls([
    String(movie?.container_extension||'').replace(/^\./,'').toLowerCase(),
    String(info?.container_extension||'').replace(/^\./,'').toLowerCase(),
    String(item?.container_extension||'').replace(/^\./,'').toLowerCase()
  ]).filter(ext=>ext&&ext!=='m3u8');
  if(!exts.length)exts.push('mp4');
  const native=exts.map(ext=>mediaUrlWithExtension('vod',id,ext));
  if(!exts.includes('mkv'))native.push(mediaUrlWithExtension('vod',id,'mkv'));
  const hls=mediaUrlWithExtension('vod',id,'m3u8');
  return uniqueMediaUrls([direct,...native,hls])
}
function qualityRank(q){const s=String(q).toUpperCase();if(s.includes('4K'))return 0;if(s.includes('UHD'))return 1;if(s.includes('FHD')||s.includes('FULL HD'))return 2;if(/^HD/.test(s))return 3;if(/^SD/.test(s))return 4;if(s.includes('265')||s.includes('HEVC'))return 5;if(s.includes('TESTE'))return 9;return 6}
function parseChannelName(raw){let name=String(raw||'Canal').trim();const patterns=[/\s*(?:[-|•:]\s*)?(TESTE)\s*$/i,/\s*(?:[-|•:]\s*)?(4K|UHD|FHD|FULL\s*HD|FULLHD|HD|SD)(?:\s*([1-9¹²³⁴⁵⁶⁷⁸⁹]))?\s*$/i,/\s*(?:[-|•:]\s*)?(\[\s*(?:H\.?\s*)?265\s*\]|H\.?265|HEVC)(?:\s*([1-9¹²³⁴⁵⁶⁷⁸⁹]))?\s*$/i];let quality='Padrão',base=name;for(const re of patterns){const m=base.match(re);if(m){quality=(m[1]||'').replace(/FULLHD/i,'FULL HD').replace(/\s+/g,' ').toUpperCase()+(m[2]||'');if(/265|HEVC/i.test(quality)){const suffix=m[2]||'';quality=/HEVC/i.test(m[1])?'HEVC'+suffix:/^\[/i.test(m[1])?'[265]'+suffix:'H.265'+suffix;}base=base.slice(0,m.index).replace(/[\s|•:,_—–-]+$/g,'').trim()||name;break}}return{base,quality}}
function groupChannels(items){const map=new Map();for(const item of items){const p=parseChannelName(itemTitle(item)),key=p.base.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9à-ÿ]+/g,'');if(!map.has(key))map.set(key,{baseName:p.base,image:imageFor(item,'live'),variants:[]});map.get(key).variants.push({...item,_quality:p.quality,_baseName:p.base})}return [...map.values()].map(g=>{g.variants.sort((a,b)=>qualityRank(a._quality)-qualityRank(b._quality)||a._quality.localeCompare(b._quality));return g})}
function cardDataImage(item,type){return type==='live'?item.image:imageFor(item,type)}
function cardDataName(item,type){return type==='live'?item.baseName:itemTitle(item)}
function mediaLoaderMarkup(label='Carregando'){return `<div class="media-loader"><div class="media-loader__core"><span class="media-loader__ring"></span><span class="media-loader__label">${escapeHtml(label)}</span></div></div>`}
function cardHtml(item,type,cls,index,left,width){const img=cardDataImage(item,type)||IMAGE_PLACEHOLDER,name=cardDataName(item,type),ratio=type==='live'?16/9:16/9;return `<article class="${cls}${type==='live'?' '+cls+'--live':''}" data-index="${index}" style="left:${left}px;width:${width}px;height:${Math.round(width*ratio)}px" aria-label="${escapeHtml(name)}"><img class="poster-card__image" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">${type==='live'?`<div class="live-flare"><div class="live-flare__name">${escapeHtml(name)}</div></div>`:''}</article>`}
class RailVirtualizer{constructor(section,type,items,onOpen){this.section=section;this.type=type;this.items=items;this.onOpen=onOpen;this.viewport=section.querySelector('.rail-viewport');this.track=section.querySelector('.rail-track');this.sig='';this.scroll=()=>this.render();this.viewport.addEventListener('scroll',this.scroll,{passive:true});this.resizeRaf=0;this.ro=new ResizeObserver(()=>{cancelAnimationFrame(this.resizeRaf);this.resizeRaf=requestAnimationFrame(()=>this.render(true))});this.ro.observe(this.viewport);this.render(true)}metrics(){const w=innerWidth<680?112:136,gap=8,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));return{w,gap,slot,visible}}render(force=false){const m=this.metrics(),ratio=this.type==='live'?16/9:16/9,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length].join(':');if(!force&&sig===this.sig)return;this.sig=sig;this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';this.track.style.height=Math.round(m.w*ratio)+'px';this.track.innerHTML=this.items.slice(start,end).map((item,off)=>cardHtml(item,this.type,'poster-card',start+off,(start+off)*m.slot,m.w)).join('');this.track.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type))}destroy(){this.viewport.removeEventListener('scroll',this.scroll);cancelAnimationFrame(this.resizeRaf||0);this.ro.disconnect();this.track.innerHTML='';this.items=[]}}
class GridVirtualizer{constructor(scroller,spacer,type,items,onOpen){this.scroller=scroller;this.spacer=spacer;this.type=type;this.items=items;this.onOpen=onOpen;this.sig='';this.scroll=()=>this.render();this.scroller.addEventListener('scroll',this.scroll,{passive:true});this.resizeRaf=0;this.ro=new ResizeObserver(()=>{cancelAnimationFrame(this.resizeRaf);this.resizeRaf=requestAnimationFrame(()=>this.render(true))});this.ro.observe(this.scroller);this.render(true)}metrics(){const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?6:9,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(126+gap))),w=(available-gap*(cols-1))/cols,ratio=this.type==='live'?16/9:16/9,h=w*ratio,rowH=h+gap;return{available,gap,cols,w,h,rowH}}render(force=false){const m=this.metrics(),rows=Math.ceil(this.items.length/m.cols),firstRow=Math.max(0,Math.floor(this.scroller.scrollTop/m.rowH)-1),visibleRows=Math.max(1,Math.ceil(this.scroller.clientHeight/m.rowH)),lastRow=Math.min(rows,firstRow+visibleRows*2+1),start=firstRow*m.cols,end=Math.min(this.items.length,lastRow*m.cols),sig=[start,end,m.cols,Math.round(m.w),this.items.length].join(':');if(!force&&sig===this.sig)return;this.sig=sig;this.spacer.style.height=Math.max(1,rows*m.rowH-m.gap)+'px';this.spacer.innerHTML=this.items.slice(start,end).map((item,off)=>{const idx=start+off,row=Math.floor(idx/m.cols),col=idx%m.cols,left=col*(m.w+m.gap),top=row*m.rowH,img=cardDataImage(item,this.type)||IMAGE_PLACEHOLDER,name=cardDataName(item,this.type);return `<article class="grid-card${this.type==='live'?' grid-card--live':''}" data-index="${idx}" style="left:${left}px;top:${top}px;width:${m.w}px;height:${m.h}px" aria-label="${escapeHtml(name)}"><img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">${this.type==='live'?`<div class="live-flare"><div class="live-flare__name">${escapeHtml(name)}</div></div>`:''}</article>`}).join('');this.spacer.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type))}destroy(){this.scroller.removeEventListener('scroll',this.scroll);cancelAnimationFrame(this.resizeRaf||0);this.ro.disconnect();this.spacer.innerHTML='';this.spacer.style.height='';this.items=[]}}
function destroyVirtualizers(){state.railInstances.forEach(x=>x.destroy());state.railInstances=[];state.gridInstance?.destroy();state.gridInstance=null;state.categoryObserver?.disconnect();state.categoryObserver=null;state.retentionObserver?.disconnect();state.retentionObserver=null;el.content.querySelectorAll('.rail-section').forEach(s=>clearTimeout(s._evictTimer))}
function freezePage(on){document.body.classList.toggle('modal-open',!!on)}
function closeCollection(rebuild=true){state.gridInstance?.destroy();state.gridInstance=null;el.collectionSpacer.innerHTML='';el.collectionSpacer.style.height='';el.collectionView.classList.add('is-hidden');state.collectionOpen=false;freezePage(false);if(rebuild)renderActiveType()}
function openCollection(title,type,items){clearTimeout(state.searchTimer);++state.renderToken;closeDetail();closePlayer(false);state.searchDataset=null;destroyVirtualizers();el.content.innerHTML='';el.continueRow.innerHTML='';el.continueSection.classList.add('is-hidden');el.collectionTitle.textContent=stripEmoji(title);el.collectionView.classList.remove('is-hidden');state.collectionOpen=true;freezePage(true);state.gridInstance=new GridVirtualizer(el.collectionScroller,el.collectionSpacer,type,items.slice(),openItem);el.collectionScroller.scrollTop=0}
el.collectionClose.onclick=()=>closeCollection(true);
function renderTabs(){const types=selectedTypes();if(types.length<2){el.bottomNav.classList.add('is-hidden');el.app.classList.remove('has-bottom-nav');return}const icons={live:'<svg class="tab-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6.5" width="16" height="11" rx="2"/><path d="M9 20h6M10 3.5l2 3 2-3"/></svg>',vod:'<svg class="tab-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v12H5zM5 10h14M8 6.5l2 3.5M13 6.5l2 3.5"/></svg>',series:'<svg class="tab-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="12" height="15" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'};el.bottomNav.innerHTML=types.map(t=>`<button class="tab-button${t===state.activeType?' is-active':''}" data-type="${t}">${icons[t]||''}<span>${TYPE[t].label}</span></button>`).join('');el.bottomNav.classList.remove('is-hidden');el.app.classList.add('has-bottom-nav');el.bottomNav.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>switchType(b.dataset.type))}
function renderContinue(){const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&x.position>5).slice(0,12);if(!list.length||type==='live'){el.continueSection.classList.add('is-hidden');el.continueRow.innerHTML='';return}el.continueSection.classList.remove('is-hidden');el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><img src="${escapeHtml(x.image||'')}" alt="" loading="lazy"><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');el.continueRow.querySelectorAll('[data-history]').forEach(c=>c.onclick=()=>{const x=list[Number(c.dataset.history)];if(x)openGeneralPlayer(x.sources||x.url,x.title,x)})}
async function renderRail(section,target,token){if(token!==state.renderToken)return;const body=section.querySelector('.rail-body');body.innerHTML=mediaLoaderMarkup('Carregando conteúdo');try{const raw=await loadTargetItems(target);if(token!==state.renderToken)return;const items=target.type==='live'?groupChannels(raw):uniqueById(raw,target.type);if(!items.length){body.innerHTML='<div class="skeleton">Sem conteúdos nesta categoria.</div>';return}body.innerHTML='<div class="rail-viewport"><div class="rail-track"></div></div>';const v=new RailVirtualizer(section,target.type,items,openItem);section._railV=v;state.railInstances.push(v);section.querySelector('[data-all]').onclick=()=>openCollection(target.name,target.type,items)}catch(e){body.innerHTML='<div class="skeleton">'+escapeHtml(e.message)+'</div>'}}
function evictRail(section){if(!section||section.dataset.loaded!=='1'||state.collectionOpen)return;const v=section._railV;if(v){v.destroy();state.railInstances=state.railInstances.filter(x=>x!==v);section._railV=null}section.querySelector('.rail-body').innerHTML=mediaLoaderMarkup('Liberado da memória');delete section.dataset.loaded;state.categoryObserver?.observe(section)}
function renderActiveType(){clearTimeout(state.searchTimer);document.body.classList.remove('srh-searching');destroyVirtualizers();state.searchDataset=null;state.searchType=null;const token=++state.renderToken;el.search.value='';el.search.placeholder='Buscar em '+TYPE[state.activeType].label.toLocaleLowerCase('pt-BR')+'…';if(state.activeType==='series'&&seriesProviderGuardBlocked()){renderSeriesProviderGuardBlocked();return}const targets=targetsFor(state.activeType);el.content.innerHTML=targets.map((t,i)=>`<section class="rail-section" data-target="${i}"><header class="rail-head"><h2 class="rail-title">${escapeHtml(stripEmoji(t.name))}</h2><button class="rail-all" data-all>Ver todos</button></header><div class="rail-body">${mediaLoaderMarkup('Preparando')}</div></section>`).join('');el.homeStatus.textContent=targets.length+' categoria(s) em '+TYPE[state.activeType].label+'.';state.categoryObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;const section=e.target;if(section.dataset.loaded)return;section.dataset.loaded='1';state.categoryObserver.unobserve(section);renderRail(section,targets[Number(section.dataset.target)],token)}),{rootMargin:'260px 0px'});state.retentionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{const s=e.target;clearTimeout(s._evictTimer);if(!e.isIntersecting&&s.dataset.loaded==='1')s._evictTimer=setTimeout(()=>evictRail(s),30000)}),{rootMargin:'900px 0px'});el.content.querySelectorAll('.rail-section').forEach(s=>{state.categoryObserver.observe(s);state.retentionObserver.observe(s)});renderContinue();renderTabs()}
function switchType(type){if(!TYPE[type]||type===state.activeType)return;closeDetail();closePlayer(false);closeCollection(false);state.searchDataset=null;state.searchType=null;el.search.value='';window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;state.activeType=type;renderActiveType();requestAnimationFrame(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0})}
function normalizeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim()}
async function getSearchDataset(type,token){
  if(state.searchDataset&&state.searchType===type)return{items:state.searchDataset,failed:0};
  const targets=targetsFor(type);
  const results=await Promise.allSettled(targets.map(target=>loadTargetItems(target,token)));
  const failed=results.filter(result=>result.status==='rejected').length;
  let items=results.filter(result=>result.status==='fulfilled').flatMap(result=>result.value);
  items=type==='live'?groupChannels(items):uniqueById(items,type);
  if(token===state.renderToken&&type===state.activeType&&!failed){state.searchDataset=items;state.searchType=type}
  return{items,failed};
}
async function runSearch(){
  const q=normalizeSearch(el.search.value),type=state.activeType,token=++state.renderToken;
  destroyVirtualizers();
  if(type==='series'&&seriesProviderGuardBlocked()){renderSeriesProviderGuardBlocked();return}
  if(!q){renderActiveType();return}
  document.body.classList.add('srh-searching');
  el.homeStatus.textContent='Buscando em '+TYPE[type].label+'…';
  el.content.innerHTML=mediaLoaderMarkup('Buscando conteúdo');
  try{
    const result=await getSearchDataset(type,token);
    if(token!==state.renderToken||type!==state.activeType)return;
    const items=result.items.filter(item=>normalizeSearch(cardDataName(item,type)).includes(q));
    el.homeStatus.textContent=items.length+' resultado(s) em '+TYPE[type].label+'.'+(result.failed?' Consulta incompleta: '+result.failed+' categoria(s) indisponível(is).':'');
    const message=result.failed?'Parte do catálogo não carregou. Você pode tentar novamente.':!items.length?'Nenhum título encontrado. Tente outro nome.':'';
    el.content.innerHTML=(message?'<div class="rail-load-error" role="status"><span>'+message+'</span><button type="button" data-search-retry>'+(result.failed?'Tentar novamente':'Limpar busca')+'</button></div>':'')+(items.length?'<section class="search-results"><div class="grid-scroller" id="searchGrid"><div class="grid-spacer" id="searchSpacer"></div></div></section>':'');
    const retry=el.content.querySelector('[data-search-retry]');
    if(retry)retry.onclick=()=>{
      if(token!==state.renderToken)return;
      if(result.failed){state.searchDataset=null;runSearch()}
      else{el.search.value='';renderActiveType();el.search.focus()}
    };
    if(!items.length)return;
    const sc=$('#searchGrid'),sp=$('#searchSpacer');
    sc.style.height='calc(100dvh - 145px)';sc.style.overflowY='auto';sc.style.overflowX='hidden';
    state.gridInstance=new GridVirtualizer(sc,sp,type,items,openItem);
  }catch(error){
    if(token!==state.renderToken||type!==state.activeType)return;
    el.content.innerHTML='<div class="rail-load-error" role="status"><span>Não foi possível concluir a busca.</span><button type="button">Tentar novamente</button></div>';
    el.content.querySelector('button').onclick=()=>{if(token===state.renderToken)runSearch()};
  }
}
el.search.oninput=()=>{
  clearTimeout(state.searchTimer);
  const token=++state.renderToken;
  state.searchTimer=setTimeout(()=>{if(token===state.renderToken)runSearch()},220);
};
function toggleSearch(){const opening=!el.searchWrap.classList.contains('is-open');el.searchWrap.classList.toggle('is-open',opening);el.searchButton.classList.toggle('is-active',opening);if(opening){el.search.placeholder='Buscar em '+TYPE[state.activeType].label.toLocaleLowerCase('pt-BR')+'…';setTimeout(()=>el.search.focus(),20)}else{el.search.value='';state.searchDataset=null;state.searchType=null;renderActiveType()}}
el.searchButton.onclick=toggleSearch;
const HLS_CDN='https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js';
const MPEGTS_CDN='https://cdn.jsdelivr.net/npm/mpegts.js@1.8.2/dist/mpegts.min.js';
let hlsLoader=null,mpegTsLoader=null;
function playbackDebug(event,data={}){try{window.SRHDebug?.log?.('info','standard.playback.'+event,data);window.SRHDebug?.state?.patch?.('player',{compat:'standard-playback-v1',event,...data,at:Date.now()})}catch{}}
const warmedMediaOrigins=new Set();
const standardMediaOrigins=window.__SRH_STANDARD_MEDIA_ORIGINS__ instanceof Set?window.__SRH_STANDARD_MEDIA_ORIGINS__:new Set();window.__SRH_STANDARD_MEDIA_ORIGINS__=standardMediaOrigins;
function mediaOrigin(url){try{return new URL(String(url||''),location.href).origin}catch{return'media'}}
function mediaHost(url){try{return new URL(String(url||''),location.href).host.toLowerCase()}catch{return''}}
function registerMediaResource(url){try{const origin=mediaOrigin(url);if(origin&&origin!=='null'&&origin!=='media')standardMediaOrigins.add(origin);return origin}catch{return'media'}}
function warmMediaOrigin(url){try{const origin=registerMediaResource(url);if(!origin||origin==='null'||origin==='media'||warmedMediaOrigins.has(origin))return;warmedMediaOrigins.add(origin);for(const rel of ['dns-prefetch','preconnect']){const link=document.createElement('link');link.rel=rel;link.href=origin;document.head.appendChild(link)}playbackDebug('origin-warm',{origin})}catch{}}
function liveExtensionFallback(url){try{const u=new URL(String(url||''),location.href),path=u.pathname;if(/\.m3u8$/i.test(path))u.pathname=path.replace(/\.m3u8$/i,'.ts');else if(/\.ts$/i.test(path))u.pathname=path.replace(/\.ts$/i,'.m3u8');else return'';return u.toString()}catch{return''}}
const onDemandFormatPreference=new Map(),onDemandHlsHealth=new Map();
function onDemandPreferenceKey(url,type){return mediaHost(url)+'|'+String(type||'vod')}
function rememberOnDemandFormat(url,type){const ext=mediaExtension(url),key=onDemandPreferenceKey(url,type);if(!key.startsWith('|')&&ext){const prior=onDemandFormatPreference.get(key)||'';onDemandFormatPreference.set(key,ext);if(prior!==ext)playbackDebug('ondemand-format-learn',{type,host:mediaHost(url),extension:ext,previous:prior||'none'})}}
function noteOnDemandHlsFailure(url,type,details=''){if(type==='live')return;const key=onDemandPreferenceKey(url,type),now=Date.now(),prior=onDemandHlsHealth.get(key),fresh=prior&&now-prior.lastAt<15*60*1000,row={count:fresh?prior.count+1:1,lastAt:now};onDemandHlsHealth.set(key,row);playbackDebug('ondemand-hls-failure',{type,host:mediaHost(url),count:row.count,cooldown:row.count>=3,details:String(details||'').slice(0,120)})}
function onDemandHlsSuppressed(url,type){if(type==='live')return false;const row=onDemandHlsHealth.get(onDemandPreferenceKey(url,type));return !!row&&row.count>=3&&Date.now()-row.lastAt<15*60*1000}
function rememberOnDemandHlsSuccess(url,type){if(type==='live')return;const key=onDemandPreferenceKey(url,type);if(onDemandHlsHealth.has(key)){onDemandHlsHealth.delete(key);playbackDebug('ondemand-hls-recovered',{type,host:mediaHost(url)})}}
function preferOnDemandSources(values,type,pinned='',pinnedStartupMs=0){const list=uniqueMediaUrls(Array.isArray(values)?values:[values]);if(type==='live'||list.length<2)return list;const pin=String(pinned||'').trim(),base=pin?list.filter(x=>x!==pin):list.slice(),probe=base[0]||pin,pref=probe?onDemandFormatPreference.get(onDemandPreferenceKey(probe,type)):'',slowPin=!!pin&&Number(pinnedStartupMs)>6500;if(pref&&pref!=='m3u8')base.sort((a,b)=>(mediaExtension(b)===pref?1:0)-(mediaExtension(a)===pref?1:0));base.sort((a,b)=>(mediaExtension(a)==='m3u8'?1:0)-(mediaExtension(b)==='m3u8'?1:0));if(slowPin)playbackDebug('slow-source-demoted',{type,host:mediaHost(pin),extension:mediaExtension(pin),lastStartupMs:Math.round(Number(pinnedStartupMs)||0),alternatives:base.length});return uniqueMediaUrls(slowPin?[...base,pin]:[pin,...base])}
function applySavedPosition(video,position,kind='native'){const target=Math.max(0,Number(position)||0);if(target<=1||!Number.isFinite(video?.duration)||video.duration<=0||target>=video.duration-3)return false;const current=Number(video.currentTime)||0;if(Math.abs(current-target)<=1.1)return false;try{video.currentTime=target;playbackDebug('resume-position',{position:Math.round(target*1000)/1000,kind});return true}catch{return false}}
function ensureHls(){if(window.Hls?.isSupported)return Promise.resolve(window.Hls);if(hlsLoader)return hlsLoader;hlsLoader=new Promise((resolve,reject)=>{const found=document.querySelector('script[data-srh-hls]');if(found){if(window.Hls?.isSupported){resolve(window.Hls);return}found.addEventListener('load',()=>window.Hls?.isSupported?resolve(window.Hls):reject(Error('Hls.js inválido')),{once:true});found.addEventListener('error',()=>reject(Error('Hls.js indisponível')),{once:true});return}const s=document.createElement('script'),timer=setTimeout(()=>{s.remove();reject(Error('Hls.js timeout'))},9000);s.src=HLS_CDN;s.async=true;s.dataset.srhHls='1';s.onload=()=>{clearTimeout(timer);window.Hls?.isSupported?resolve(window.Hls):reject(Error('Hls.js inválido'))};s.onerror=()=>{clearTimeout(timer);reject(Error('Hls.js indisponível'))};document.head.appendChild(s)}).catch(e=>{hlsLoader=null;throw e});return hlsLoader}
function ensureMpegTs(){if(window.mpegts?.createPlayer)return Promise.resolve(window.mpegts);if(mpegTsLoader)return mpegTsLoader;mpegTsLoader=new Promise((resolve,reject)=>{const found=document.querySelector('script[data-srh-mpegts]');if(found){found.addEventListener('load',()=>resolve(window.mpegts),{once:true});found.addEventListener('error',()=>reject(Error('mpegts indisponível')),{once:true});return}const s=document.createElement('script'),timer=setTimeout(()=>{s.remove();reject(Error('mpegts timeout'))},9000);s.src=MPEGTS_CDN;s.async=true;s.dataset.srhMpegts='1';s.onload=()=>{clearTimeout(timer);window.mpegts?.createPlayer?resolve(window.mpegts):reject(Error('mpegts inválido'))};s.onerror=()=>{clearTimeout(timer);reject(Error('mpegts indisponível'))};document.head.appendChild(s)}).catch(e=>{mpegTsLoader=null;throw e});return mpegTsLoader}
function mediaKind(url){const s=String(url||'');if(/\.m3u8(?:$|\?)/i.test(s))return'hls';if(/\.m2ts(?:$|\?)/i.test(s))return'm2ts';if(/\.ts(?:$|\?)/i.test(s))return'mpegts';return'native'}
function mediaExtension(url){try{return(new URL(String(url||''),location.href).pathname.match(/\.([a-z0-9]{2,5})$/i)||[])[1]?.toLowerCase()||''}catch{return''}}
function destroyHls(){state.mediaEpoch=(state.mediaEpoch||0)+1;if(state.mediaCleanup){const fn=state.mediaCleanup;state.mediaCleanup=null;try{fn()}catch{}}if(state.mpegtsPlayer){try{state.mpegtsPlayer.pause?.();state.mpegtsPlayer.unload?.();state.mpegtsPlayer.detachMediaElement?.();state.mpegtsPlayer.destroy?.()}catch{}state.mpegtsPlayer=null}if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}}
function attachVideo(video,url,onReady,onError){
 const queue=mediaCandidates(url);let index=0,last=null,lastUrl='',readyNotified=false,resumeAt=state.currentMedia?.type==='live'?0:Math.max(0,Number(state.currentMedia?.position)||0),fallbackCount=0;const failedOrigins=new Set();
 const isLive=()=>state.currentMedia?.type==='live';
 const finalProviderStatus=async url=>{
   const src=String(url||'');if(!src)return 0;
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),1400);
   try{const r=await fetch(src,{cache:'no-store',headers:{Range:'bytes=0-1'},signal:ctrl.signal,srhProbe:true});return Number(r.status)||0}catch{return 0}finally{clearTimeout(timer)}
 };
 const exhausted=async()=>{const err=last||{message:'mídia indisponível'};if(!isLive()&&!err.status&&lastUrl){const status=await finalProviderStatus(lastUrl);if(status>=400)err.status=status}onError?.(err)};
 const next=()=>{if(index>=queue.length){exhausted();return}start(queue[index++],0)};
 const start=async(current,attempt)=>{
  destroyHls();const token=state.mediaEpoch,kind=mediaKind(current),sourceStartedAt=Date.now(),mediaType=String(state.currentMedia?.type||'live');let sourceFailed=false,sourceReady=false,retryTimer=0,watchdog=0,metadataTimer=0,liveStartupTimer=0,lastAdvanceAt=Date.now(),lastTime=0,hlsNetworkRecoveries=0,hlsMediaRecoveries=0;
  if(kind==='hls'&&onDemandHlsSuppressed(current,mediaType)){playbackDebug('ondemand-hls-skip',{mediaId:String(state.currentMedia?.key||''),type:mediaType,host:mediaHost(current),reason:'recent-failures'});last={message:'HLS temporariamente rebaixado após falhas recentes',code:0,status:0};lastUrl=current;fallbackCount++;next();return}
  lastUrl=current;video.pause();video.onerror=null;video.onloadedmetadata=null;video.dataset.srhMediaId=String(state.currentMedia?.key||'');video.dataset.srhMediaType=String(state.currentMedia?.type||'');video.dataset.srhSourceKind=kind+(mediaExtension(current)?':'+mediaExtension(current):'');video.dataset.srhMediaKind=kind;video.dataset.srhContainerExtension=mediaExtension(current);video.dataset.srhMediaOrigin=registerMediaResource(current);video.removeAttribute('src');video.preload='auto';try{video.load()}catch{}warmMediaOrigin(current)
  const alive=()=>token===state.mediaEpoch;
  const markAdvance=()=>{if(!alive())return;const t=Number(video.currentTime)||0;if(Math.abs(t-lastTime)>.08){lastTime=t;lastAdvanceAt=Date.now()}};
  const applyResume=()=>applySavedPosition(video,resumeAt,kind);
  const markReady=()=>{
    if(!alive())return;
    clearTimeout(metadataTimer);clearTimeout(liveStartupTimer);
    const mediaId=String(video.dataset.srhMediaId||state.currentMedia?.key||''),mediaType=String(video.dataset.srhMediaType||state.currentMedia?.type||''),sourceKind=String(video.dataset.srhSourceKind||kind),startupMs=Math.max(0,Date.now()-sourceStartedAt);
    if(state.currentMedia&&mediaType!=='live'){
      state.currentMedia.lastWorkingUrl=current;
      state.currentMedia.lastStartupMs=startupMs;
      state.currentMedia.containerExtension=mediaExtension(current)||state.currentMedia.containerExtension||'';
      rememberOnDemandFormat(current,mediaType);
      if(kind==='hls')rememberOnDemandHlsSuccess(current,mediaType)
    }
    lastAdvanceAt=Date.now();markAdvance();sourceReady=true;
    playbackDebug('source-ready',{kind,sourceKind,mediaId,live:isLive(),startupMs,readyState:video.readyState,networkState:video.networkState});
    try{
      const stallRecovery={kind:'player.stall',layer:'media',origin:mediaOrigin(current),status:200,message:'Reprodução retomada',details:{kind,sourceKind,currentTime:Number(video.currentTime)||0,startupMs}};
      window.SRHDebug?.noteRecovery?.({...stallRecovery,mediaId});
      window.SRHDebug?.noteRecovery?.({...stallRecovery,mediaId:''})
    }catch{}
    applyResume();
    if(failedOrigins.size){
      for(const origin of failedOrigins){
        try{
          const recovery={layer:'media',origin,status:200,message:'Fonte alternativa iniciou a reprodução',details:{fallbackCount,sourceKind,winningOrigin:mediaOrigin(current)}};
          window.SRHDebug?.noteRecovery?.({kind:'player.error',mediaId,...recovery});
          window.SRHDebug?.noteRecovery?.({kind:'player.error',mediaId:'',...recovery});
          window.SRHDebug?.noteRecovery?.({kind:'player.stall',mediaId,...recovery});
          window.SRHDebug?.noteRecovery?.({kind:'playlist',layer:'fetch',mediaId,origin,status:200,message:'Fonte alternativa iniciou a reprodução',details:{fallbackCount,sourceKind,winningOrigin:mediaOrigin(current)}})
        }catch{}
      }
      playbackDebug('recovered',{mediaId,mediaType,sourceKind,fallbackCount,failedOrigins:[...failedOrigins],winningOrigin:mediaOrigin(current)});
      failedOrigins.clear()
    }
    if(!readyNotified){readyNotified=true;onReady?.(current)}
    playbackDebug('ready',{kind,sourceKind,mediaId,attempt,live:isLive(),preload:video.preload});
    const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})
  };
  const fail=extra=>{
    if(!alive()||sourceFailed)return;
    sourceFailed=true;clearTimeout(metadataTimer);fallbackCount++;failedOrigins.add(mediaOrigin(current));
    if(Number.isFinite(video.currentTime)&&video.currentTime>1)resumeAt=video.currentTime;
    last=mediaErrorInfo(video,extra);
    const ext=mediaExtension(current),origin=mediaOrigin(current),host=mediaHost(current);
    playbackDebug('fallback',{kind,attempt,live:isLive(),message:last.message,code:last.code||0,fallbackCount,origin,sourceKind:video.dataset.srhSourceKind||kind,ext});
    const liveRetryLimit=kind==='hls'?0:1;
    if(isLive()&&attempt<liveRetryLimit){retryTimer=setTimeout(()=>start(current,attempt+1),900+attempt*450);return}
    if(!isLive()&&last.code===4&&(kind==='mpegts'||kind==='m2ts')&&attempt!==99){retryTimer=setTimeout(()=>start(current,99),40);return}
    if(last.code===4){
      let skipped=0;
      while(index<queue.length&&mediaExtension(queue[index])===ext&&mediaHost(queue[index])===host){index++;skipped++}
      if(skipped)playbackDebug('skip-equivalent',{reason:'src-not-supported',ext,host,skipped});
      if(isLive()){
        const alternate=liveExtensionFallback(current);
        if(alternate&&!queue.includes(alternate)){queue.splice(index,0,alternate);playbackDebug('live-format-fallback',{from:ext,to:mediaExtension(alternate),host})}
      }
    }
    next()
  };
  const onWaiting=()=>{if(isLive())playbackDebug('waiting',{kind,readyState:video.readyState})};
  const onPlaying=()=>markReady();
  video.addEventListener('timeupdate',markAdvance,{passive:true});video.addEventListener('playing',onPlaying,{passive:true});video.addEventListener('waiting',onWaiting,{passive:true});video.addEventListener('stalled',onWaiting,{passive:true});
  state.mediaCleanup=()=>{clearTimeout(retryTimer);clearTimeout(metadataTimer);clearTimeout(liveStartupTimer);clearInterval(watchdog);video.removeEventListener('timeupdate',markAdvance);video.removeEventListener('playing',onPlaying);video.removeEventListener('waiting',onWaiting);video.removeEventListener('stalled',onWaiting)};
  if(isLive()){watchdog=setInterval(()=>{if(!alive()||sourceFailed||video.paused||video.ended||document.hidden)return;markAdvance();if(Date.now()-lastAdvanceAt>9000&&(video.readyState<3||Number(video.currentTime)===lastTime))fail({type:'stall',details:'stream sem avanço'})},2500)}
  playbackDebug('source',{kind,attempt,live:isLive(),candidate:index,total:queue.length,origin:mediaOrigin(current),preload:video.preload});
  if(isLive())liveStartupTimer=setTimeout(()=>{if(!alive()||sourceFailed||sourceReady||video.readyState>=2)return;if(video.networkState===2){playbackDebug('live-startup-slow',{kind,origin:mediaOrigin(current),readyState:video.readyState,networkState:video.networkState,elapsedMs:Date.now()-sourceStartedAt});liveStartupTimer=setTimeout(()=>{if(alive()&&!sourceFailed&&!sourceReady&&video.readyState<2){playbackDebug('live-startup-timeout',{kind,origin:mediaOrigin(current),readyState:video.readyState,networkState:video.networkState,elapsedMs:Date.now()-sourceStartedAt});fail({type:'live-startup-timeout',details:'live não iniciou após janela de tolerância'})}},3500);return}playbackDebug('live-startup-timeout',{kind,origin:mediaOrigin(current),readyState:video.readyState,networkState:video.networkState,elapsedMs:Date.now()-sourceStartedAt});fail({type:'live-startup-timeout',details:'live não iniciou em 7000ms'})},7000);
  if(!isLive()&&index<queue.length)metadataTimer=setTimeout(()=>{if(!alive()||sourceFailed||sourceReady||video.readyState>=1)return;if(video.networkState===2){playbackDebug('metadata-slow-loading',{kind,origin:mediaOrigin(current),readyState:video.readyState,networkState:video.networkState,elapsedMs:Date.now()-sourceStartedAt});metadataTimer=setTimeout(()=>{if(alive()&&!sourceFailed&&!sourceReady&&video.readyState<1)fail({type:'metadata-timeout',details:'metadados não chegaram em 8000ms'})},2800);return}fail({type:'metadata-timeout',details:'fonte sem metadados após 5200ms'})},5200);
  if((kind==='mpegts'||kind==='m2ts')&&(isLive()||attempt===99)){
   let lib=null;try{lib=await ensureMpegTs()}catch(e){playbackDebug('mpegts-unavailable',{message:e?.message||String(e)})}
   if(!alive())return;
   const supported=!!lib?.createPlayer&&(!lib.isSupported||lib.isSupported());
   if(supported){
    try{state.mpegtsPlayer=lib.createPlayer({type:kind==='m2ts'?'m2ts':'mpegts',isLive:isLive(),url:current},isLive()?{enableStashBuffer:true,stashInitialSize:384*1024,liveBufferLatencyChasing:false,lazyLoad:false,autoCleanupSourceBuffer:true,autoCleanupMaxBackwardDuration:30,autoCleanupMinBackwardDuration:10}:{enableStashBuffer:true,lazyLoad:false,autoCleanupSourceBuffer:true});state.mpegtsPlayer.on?.(lib.Events.ERROR,(type,detail)=>fail({type,details:detail}));state.mpegtsPlayer.attachMediaElement(video);state.mpegtsPlayer.load();const p=state.mpegtsPlayer.play();if(p&&typeof p.catch==='function')p.catch(()=>{});return}catch(e){fail({type:'mpegts-init',details:e?.message||String(e)});return}
   }
  }
  if(kind==='hls'){
   let H=null;try{H=await ensureHls()}catch(e){playbackDebug('hlsjs-unavailable',{message:e?.message||String(e)})}
   if(!alive())return;
   if(H?.isSupported?.()){
    try{const hlsStart=!isLive()&&resumeAt>1?resumeAt:-1,hlsCfg=isLive()?{enableWorker:true,lowLatencyMode:false,startLevel:-1,capLevelToPlayerSize:false,startFragPrefetch:true,maxBufferLength:12,maxMaxBufferLength:20,backBufferLength:8,liveSyncDurationCount:2,liveMaxLatencyDurationCount:5,maxLiveSyncPlaybackRate:1.0}:{enableWorker:true,progressive:true,autoStartLoad:true,startFragPrefetch:true,lowLatencyMode:false,startLevel:-1,startPosition:hlsStart,capLevelToPlayerSize:false,maxBufferLength:24,maxMaxBufferLength:36,backBufferLength:20,liveSyncDurationCount:3,liveMaxLatencyDurationCount:8};state.hls=new H(hlsCfg);state.hls.loadSource(current);state.hls.attachMedia(video);state.hls.on(H.Events.MANIFEST_PARSED,()=>{if(!alive())return;playbackDebug('hlsjs-manifest',{live:isLive(),origin:mediaOrigin(current),startPosition:hlsStart,progressive:!isLive()});const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})});state.hls.on(H.Events.ERROR,(_,d)=>{if(!d?.fatal||!alive())return;if(!isLive())noteOnDemandHlsFailure(current,mediaType,d?.details||d?.type||'fatal');const networkRecoveryLimit=sourceReady?2:1;if(isLive()&&d.type===H.ErrorTypes.NETWORK_ERROR&&hlsNetworkRecoveries<networkRecoveryLimit){hlsNetworkRecoveries++;playbackDebug('hls-network-recover',{count:hlsNetworkRecoveries,details:d?.details||''});try{state.hls.startLoad()}catch{fail(d)}return}if(isLive()&&d.type===H.ErrorTypes.MEDIA_ERROR&&hlsMediaRecoveries<1){hlsMediaRecoveries++;playbackDebug('hls-media-recover',{count:hlsMediaRecoveries,details:d?.details||''});try{state.hls.recoverMediaError()}catch{fail(d)}return}fail({type:d?.type||'hls-fatal',details:d?.details||'',status:d?.response?.code||d?.response?.status||d?.networkDetails?.status||d?.networkDetails?.statusCode||0})});return}catch(e){fail({type:'hls-init',details:e?.message||String(e)});return}
   }
   const nativeHls=!!(video.canPlayType?.('application/vnd.apple.mpegurl')||video.canPlayType?.('application/x-mpegURL'));
   if(nativeHls){playbackDebug('hls-native-fallback',{origin:mediaOrigin(current)});video.src=current;video.onerror=()=>fail();video.onloadedmetadata=()=>{applyResume();const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})};try{video.load()}catch{}return}
   fail({type:'hls-unavailable',details:'Hls.js/MSE e HLS nativo indisponíveis'});return
  }
  video.src=current;video.onerror=()=>fail();video.onloadedmetadata=()=>{applyResume();const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})};try{video.load()}catch{}const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})
 };
 next()
}

const CONTINUE_FRAME_VERSION=2;
const continueFrameCaptureAt=new Map();
const continueFramePayloadMemory=new Map();
function exactContinueFramePayload(payload){
  return !!payload&&((payload.kind==='data-url'&&payload.dataUrl)||(payload.kind==='blob'&&payload.blob instanceof Blob))
}
function captureContinueFrameDataUrl(video){
  try{
    if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return'';
    const vw=video.videoWidth,vh=video.videoHeight,targetRatio=16/9,sourceRatio=vw/vh;
    let sx=0,sy=0,sw=vw,sh=vh;
    if(sourceRatio>targetRatio){sw=vh*targetRatio;sx=(vw-sw)/2}
    else if(sourceRatio<targetRatio){sh=vw/targetRatio;sy=(vh-sh)/2}
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=270;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return'';
    ctx.drawImage(video,sx,sy,sw,sh,0,0,480,270);
    return canvas.toDataURL('image/webp',.82)||''
  }catch{return''}
}
function continueIdentity(entry){
  if(entry?.type==='series'){
    const sid=String(entry?.seriesId??entry?.itemSnapshot?.series_id??'').trim();
    if(sid)return 'series:'+sid
  }
  return String(entry?.key||'unknown')
}
function continueFrameKey(entry){
  const provider=standardProviderId()||'provider';
  return 'srhell:'+STANDARD_APP_NS+':standard:continue-frame:v'+CONTINUE_FRAME_VERSION+':'+provider+':'+encodeURIComponent(continueIdentity(entry));
}
function continueFrameMediaKey(entry){
  if(!entry)return'';
  if(entry.type==='series'){
    const snap=entry?.itemSnapshot&&typeof entry.itemSnapshot==='object'?entry.itemSnapshot:{};
    const sid=String(entry.seriesId??snap.series_id??'').trim(),stream=String(snap.stream_id??entry.streamId??'').trim(),season=String(entry.season??'').trim(),episode=String(entry.episodeNumber??'').trim();
    return ['series',sid,season,episode,stream].join(':')
  }
  return String(entry.key||('vod:'+String(entry?.itemSnapshot?.stream_id??'')))
}
function continueFrameSources(entry,video=null){
  const snap=entry?.itemSnapshot&&typeof entry.itemSnapshot==='object'?entry.itemSnapshot:{};
  const out=[video?.currentSrc,entry?.lastWorkingUrl,...(Array.isArray(entry?.sources)?entry.sources:[])];
  if(entry?.type==='vod'){
    const id=String(entry?.key||'').split(':')[1]||snap.stream_id||'';
    const ext=String(entry?.containerExtension||snap.container_extension||'mp4').replace(/^\./,'').toLowerCase();
    if(id){out.push(mediaUrlWithExtension('vod',id,ext));if(ext!=='mkv')out.push(mediaUrlWithExtension('vod',id,'mkv'));out.push(mediaUrlWithExtension('vod',id,'m3u8'))}
  }else if(entry?.type==='series'){
    const id=snap.stream_id||entry?.streamId||'';
    const ext=String(entry?.containerExtension||snap.container_extension||'mp4').replace(/^\./,'').toLowerCase();
    if(id){out.push(mediaUrlWithExtension('series',id,ext));if(ext!=='mkv')out.push(mediaUrlWithExtension('series',id,'mkv'));out.push(mediaUrlWithExtension('series',id,'m3u8'))}
  }
  return uniqueMediaUrls(out);
}
async function captureContinueFrameBlob(video){
  try{
    if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return null;
    await new Promise(resolve=>{
      if(typeof video.requestVideoFrameCallback==='function'){
        let done=false;
        try{video.requestVideoFrameCallback(()=>{if(!done){done=true;resolve()}});setTimeout(()=>{if(!done){done=true;resolve()}},160)}
        catch{requestAnimationFrame(()=>resolve())}
      }else requestAnimationFrame(()=>resolve())
    });
    const vw=video.videoWidth,vh=video.videoHeight,targetRatio=16/9,sourceRatio=vw/vh;
    let sx=0,sy=0,sw=vw,sh=vh;
    if(sourceRatio>targetRatio){sw=vh*targetRatio;sx=(vw-sw)/2}
    else if(sourceRatio<targetRatio){sh=vw/targetRatio;sy=(vh-sh)/2}
    const width=480,height=270,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;
    ctx.drawImage(video,sx,sy,sw,sh,0,0,width,height);
    return await new Promise(resolve=>{
      try{canvas.toBlob(blob=>resolve(blob||null),'image/webp',.82)}
      catch{resolve(null)}
    });
  }catch{return null}
}
async function storeContinueFrame(entry,video,force=false){
  if(!entry||!video||!['vod','series'].includes(entry.type))return false;
  const now=Date.now(),key=continueFrameKey(entry),last=Number(continueFrameCaptureAt.get(key)||0);
  if(!force&&now-last<20000)return false;
  continueFrameCaptureAt.set(key,now);
  const position=Number(video.currentTime)||Number(entry.position)||0;
  const sources=continueFrameSources(entry,video);
  const dataUrl=captureContinueFrameDataUrl(video);
  const blob=!dataUrl&&force?await captureContinueFrameBlob(video):null;
  let existing=continueFramePayloadMemory.get(key)||null;
  if(!existing){try{existing=await standardStateGet(key)}catch{}}
  const mediaKey=continueFrameMediaKey(entry),pending={pendingPosition:position,pendingSource:video.currentSrc||entry.lastWorkingUrl||sources[0]||'',pendingSources:sources,pendingMediaKey:mediaKey,refreshRequestedAt:Date.now()};
  const payload=dataUrl
    ?{version:CONTINUE_FRAME_VERSION,kind:'data-url',dataUrl,position,mediaKey,capturedAt:Date.now()}
    :blob
      ?{version:CONTINUE_FRAME_VERSION,kind:'blob',blob,position,mediaKey,capturedAt:Date.now()}
      :exactContinueFramePayload(existing)
        ?{...existing,...pending,version:CONTINUE_FRAME_VERSION}
        :{version:CONTINUE_FRAME_VERSION,kind:'reference',position,mediaKey,source:pending.pendingSource,sources,capturedAt:Date.now()};
  const ok=await standardStateSet(key,payload);
  if(ok)continueFramePayloadMemory.set(key,payload);
  playbackDebug('continue-frame-save',{type:entry.type,key:entry.key,kind:payload.kind,position:Number(position.toFixed?.(2)||position),pending:!dataUrl&&!blob&&exactContinueFramePayload(existing),forced:!!force,ok});
  if(ok&&(dataUrl||blob))setTimeout(()=>{if(!state.playerActive&&state.activeType===entry.type)renderContinue()},40);
  if(ok&&!dataUrl&&!blob&&(force||(!state.playerActive&&!state.seriesVideo&&!state.detailInlineVideo)))queueMicrotask(()=>window.__srhUpgradeContinueFrame?.({...entry,position,frameKey:key}).catch?.(()=>{}));
  return ok
}
function removeContinueForEntry(entry){
  if(!entry)return;
  if(entry.type==='series'&&entry.seriesId){
    for(const row of getHistory('series').filter(x=>String(x.seriesId||'')===String(entry.seriesId)))removeHistory(row.key,'series')
  }else removeHistory(entry.key,entry.type)
}
function seriesAllEpisodesCompleted(){
  const s=state.currentSeries;if(!s?.item||!s?.episodes)return false;
  const all=[];
  for(const season of Object.keys(s.episodes))for(const ep of (Array.isArray(s.episodes[season])?s.episodes[season]:[]))all.push(ep);
  return !!all.length&&all.every(ep=>!!getStandardCompleted(episodeKey(s.item,ep)))
}
function clearContinueFrame(entry){
  if(!entry)return;
  const key=continueFrameKey(entry);
  continueFramePayloadMemory.delete(key);
  void standardStateDelete(key);
  try{window.__srhDropContinueFrameCache?.(entry,key)}catch{}
  playbackDebug('continue-frame-delete',{type:entry.type,key:entry.key,reason:'completed'})
}
function finalizeSeriesEpisode(entry,duration){
  markStandardEpisodeCompleted(entry,duration);
  if(seriesAllEpisodesCompleted()){
    markStandardTitleCompleted(entry,duration);
    clearContinueFrame(entry);
    removeContinueForEntry(entry);
    playbackDebug('series-completed',{seriesId:String(entry.seriesId||''),tmdbId:String(entry.tmdbId||'')});
    return true
  }
  return false
}
async function persistProgress(video=el.video,opts=null){
  if(!state.currentMedia||state.currentMedia.type==='live'||!Number.isFinite(video.duration)||video.duration<=0||!Number.isFinite(video.currentTime))return;
  const entry=state.currentMedia,remaining=Math.max(0,video.duration-video.currentTime);
  markStandardLastWatched(entry);
  if(entry.type==='vod'&&remaining<=120){
    markStandardTitleCompleted(entry,video.duration);
    clearContinueFrame(entry);
    removeContinueForEntry(entry);
    playbackDebug('vod-completed-threshold',{key:entry.key,tmdbId:String(entry.tmdbId||''),remaining:Math.round(remaining)});
    return
  }
  if(entry.type==='series'&&remaining<=120){
    if(finalizeSeriesEpisode(entry,video.duration))return
  }
  const row={...entry,position:video.currentTime,duration:video.duration,updatedAt:Date.now(),frameKey:continueFrameKey(entry),frameVersion:CONTINUE_FRAME_VERSION};
  saveHistory(row);
  return storeContinueFrame(row,video,!!opts?.frame)
}
function isMobile(){return matchMedia('(max-width: 820px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)}
function srhFullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null}
let srhWakeLockSentinel=null,srhWakeLockUnsupportedLogged=false,srhFullscreenUiState=null,srhFullscreenUiTimer=0;
async function srhReleaseWakeLock(reason='release'){
  const lock=srhWakeLockSentinel;srhWakeLockSentinel=null;
  if(lock){try{await lock.release?.()}catch{}playbackDebug('wake-lock-release',{reason})}
}
async function srhAcquireWakeLock(video){
  if(!video||video.paused||video.ended||document.hidden||!srhFullscreenElement())return false;
  if(srhWakeLockSentinel&&!srhWakeLockSentinel.released)return true;
  if(!navigator.wakeLock?.request){
    if(!srhWakeLockUnsupportedLogged){srhWakeLockUnsupportedLogged=true;playbackDebug('wake-lock-unavailable',{reason:'api-unsupported'})}
    return false
  }
  try{
    const lock=await navigator.wakeLock.request('screen');
    if(!srhFullscreenElement()||video.paused||video.ended){try{await lock.release?.()}catch{}return false}
    srhWakeLockSentinel=lock;
    lock.addEventListener?.('release',()=>{if(srhWakeLockSentinel===lock)srhWakeLockSentinel=null},{once:true});
    playbackDebug('wake-lock-acquired',{mediaId:String(video.dataset?.srhMediaId||state.currentMedia?.key||''),type:String(video.dataset?.srhMediaType||state.currentMedia?.type||'')});
    return true
  }catch(e){playbackDebug('wake-lock-failed',{message:e?.message||String(e)});return false}
}
function srhPlayerTime(value){
  const total=Math.max(0,Math.floor(Number(value)||0)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;
  return h?String(h)+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m)+':'+String(s).padStart(2,'0')
}
function installFullscreenPlaybackUi(){
  if(window.__srhFullscreenPlaybackUiV1)return;
  window.__srhFullscreenPlaybackUiV1=true;
  const style=document.createElement('style');style.id='srhFullscreenPlaybackStyle';
  style.textContent='.srh-custom-fs-active{background:#000!important;position:relative!important;overflow:hidden!important}.srh-custom-fs-active>video,.srh-custom-fs-active video.detail-inline-video,.srh-custom-fs-active #seriesInlineVideo,.srh-custom-fs-active #videoPlayer{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;background:#000!important}.srh-custom-fs-active .detail-inline-status,.srh-custom-fs-active .detail-inline-actions,.srh-custom-fs-active #seriesVideoActions,.srh-custom-fs-active #playerExpand{display:none!important}.srh-fs-controls{position:absolute;z-index:2147483000;left:0;right:0;bottom:0;padding:0 max(14px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));opacity:1;transform:translate3d(0,0,0);transition:opacity .16s ease,transform .16s ease;box-sizing:border-box;pointer-events:none}.srh-fs-controls.is-hidden{opacity:0;transform:translate3d(0,5px,0)}.srh-fs-controls__panel{width:min(1040px,100%);margin:0 auto;display:grid;grid-template-columns:auto auto 1fr auto;grid-template-rows:auto auto;align-items:center;column-gap:8px;row-gap:3px;pointer-events:auto}.srh-fs-controls__progress{grid-column:1/-1;grid-row:1;width:100%;height:16px;margin:0;padding:0;accent-color:#fff;background:transparent}.srh-fs-controls__progress::-webkit-slider-runnable-track{height:3px;border-radius:999px;background:rgba(255,255,255,.38)}.srh-fs-controls__progress::-webkit-slider-thumb{margin-top:-6px;width:15px;height:15px}.srh-fs-controls button{grid-row:2;width:32px;height:32px;display:grid;place-items:center;border:0;padding:0;border-radius:50%;background:rgba(0,0,0,.16);color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.75);filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}.srh-fs-controls button:active{background:rgba(255,255,255,.14)}.srh-fs-controls svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.srh-fs-controls .srh-fs-play svg{fill:currentColor;stroke:none}.srh-fs-controls__time{grid-row:2;color:#fff;font:500 11px/1 system-ui,-apple-system,Segoe UI,sans-serif;font-variant-numeric:tabular-nums;text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap}.srh-fs-current{min-width:34px;text-align:left}.srh-fs-duration{justify-self:end;min-width:34px;text-align:right}.srh-fs-exit{justify-self:end}.srh-custom-fs-active.srh-fs-cursor-hidden{cursor:none}@media(max-width:520px){.srh-fs-controls{padding-left:max(9px,env(safe-area-inset-left));padding-right:max(9px,env(safe-area-inset-right));padding-bottom:max(7px,env(safe-area-inset-bottom))}.srh-fs-controls__panel{column-gap:6px}.srh-fs-controls button{width:30px;height:30px}.srh-fs-controls__time{font-size:10px}}';
  document.head.appendChild(style);
  const cleanup=()=>{
    clearTimeout(srhFullscreenUiTimer);
    const st=srhFullscreenUiState;srhFullscreenUiState=null;
    if(st){
      st.root.classList.remove('srh-custom-fs-active','srh-fs-cursor-hidden');
      try{st.ui.remove()}catch{}
      for(const [target,type,fn,opts] of st.listeners)try{target.removeEventListener(type,fn,opts)}catch{}
      try{st.video.controls=st.priorControls}catch{}
    }
    void srhReleaseWakeLock('fullscreen-exit')
  };
  const mount=()=>{
    const root=srhFullscreenElement();
    if(!root){cleanup();return}
    const video=root instanceof HTMLVideoElement?root:[...root.querySelectorAll('video')].find(v=>!v.classList.contains('is-hidden')&&(v.currentSrc||v.src))||root.querySelector('video');
    if(!video)return;
    if(srhFullscreenUiState?.root===root&&srhFullscreenUiState?.video===video)return;
    cleanup();
    const priorControls=video.controls;video.controls=false;root.classList.add('srh-custom-fs-active');
    const ui=document.createElement('div');ui.className='srh-fs-controls';ui.innerHTML='<div class="srh-fs-controls__panel"><input class="srh-fs-controls__progress" type="range" min="0" max="1000" step="1" value="0" aria-label="Progresso do vídeo"><button type="button" class="srh-fs-play" aria-label="Reproduzir ou pausar"></button><span class="srh-fs-controls__time srh-fs-current">0:00</span><span class="srh-fs-controls__time srh-fs-duration">0:00</span><button type="button" class="srh-fs-exit" aria-label="Sair da tela cheia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg></button></div>';
    root.appendChild(ui);
    const play=ui.querySelector('.srh-fs-play'),range=ui.querySelector('.srh-fs-controls__progress'),current=ui.querySelector('.srh-fs-current'),duration=ui.querySelector('.srh-fs-duration'),exit=ui.querySelector('.srh-fs-exit'),listeners=[];
    const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);listeners.push([target,type,fn,opts])};
    const playIcon=()=>{play.innerHTML=video.paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'};
    const sync=()=>{const d=Number(video.duration)||0,t=Number(video.currentTime)||0;current.textContent=srhPlayerTime(t);duration.textContent=srhPlayerTime(d);if(d>0&&!range.matches(':active'))range.value=String(Math.max(0,Math.min(1000,Math.round(t/d*1000))));playIcon()};
    const hide=()=>{if(video.paused||video.ended)return;ui.classList.add('is-hidden');root.classList.add('srh-fs-cursor-hidden')};
    const schedule=()=>{clearTimeout(srhFullscreenUiTimer);if(!video.paused&&!video.ended)srhFullscreenUiTimer=setTimeout(hide,4000)};
    const show=()=>{ui.classList.remove('is-hidden');root.classList.remove('srh-fs-cursor-hidden');schedule()};
    on(play,'click',e=>{e.stopPropagation();if(video.paused){const p=video.play();if(p?.catch)p.catch(()=>{})}else video.pause();show()});
    on(range,'input',()=>{const d=Number(video.duration)||0;if(d>0){try{video.currentTime=d*(Number(range.value)||0)/1000}catch{}}sync();show()});
    on(exit,'click',e=>{e.stopPropagation();leaveFullscreenPortrait()});
    for(const type of ['pointermove','pointerdown','touchstart','mousemove'])on(root,type,show,{passive:true});
    on(video,'timeupdate',sync,{passive:true});on(video,'durationchange',sync,{passive:true});on(video,'loadedmetadata',sync,{passive:true});
    on(video,'play',()=>{sync();void srhAcquireWakeLock(video);schedule()},{passive:true});
    on(video,'pause',()=>{sync();show();void srhReleaseWakeLock('pause')},{passive:true});
    on(video,'ended',()=>{sync();show();void srhReleaseWakeLock('ended')},{passive:true});
    srhFullscreenUiState={root,video,ui,priorControls,listeners};sync();show();if(!video.paused)void srhAcquireWakeLock(video)
  };
  document.addEventListener('fullscreenchange',mount);
  document.addEventListener('webkitfullscreenchange',mount);
  document.addEventListener('visibilitychange',()=>{const video=srhFullscreenUiState?.video;if(document.hidden)void srhReleaseWakeLock('hidden');else if(video&&!video.paused&&!video.ended&&srhFullscreenElement())void srhAcquireWakeLock(video)});
  window.__srhFullscreenPlaybackUi={mount,cleanup}
}
installFullscreenPlaybackUi();
async function enterFullscreen(node){
  try{if(!srhFullscreenElement()){if(node.requestFullscreen)await node.requestFullscreen();else if(node.webkitRequestFullscreen)await node.webkitRequestFullscreen()}}catch(e){playbackDebug('fullscreen-enter-failed',{message:e?.message||String(e)})}
  try{window.__srhFullscreenPlaybackUi?.mount?.();setTimeout(()=>window.__srhFullscreenPlaybackUi?.mount?.(),60)}catch{}
  if(isMobile()){try{await screen.orientation?.lock?.('landscape')}catch{}}
}
async function leaveFullscreenPortrait(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)await document.webkitExitFullscreen()}catch{}
  if(isMobile()){try{await screen.orientation?.lock?.('portrait')}catch{}}
}
async function toggleFullscreen(node){if(srhFullscreenElement()){await leaveFullscreenPortrait()}else await enterFullscreen(node)}
function openGeneralPlayer(url,title,entry=null){const sources=preferOnDemandSources(mediaCandidates(entry?.sources||url),entry?.type||'live',entry?.lastWorkingUrl||'',entry?.lastStartupMs||0);state.playerActive=true;state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};state.saveTick=0;el.playerTitle.textContent=title;el.playerStatus.textContent='Carregando…';el.playerLayer.classList.remove('is-hidden');freezePage(true);attachVideo(el.video,sources,()=>{el.playerStatus.textContent='Reproduzindo';applySavedPosition(el.video,entry?.position,'callback')},err=>{el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')});el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};el.video.onpause=()=>persistProgress(el.video,{frame:true});el.video.onended=()=>{const cur=state.currentMedia;if(!cur)return;if(cur.type==='vod'){markStandardTitleCompleted(cur,el.video.duration);clearContinueFrame(cur);removeContinueForEntry(cur)}else if(cur.type==='series')finalizeSeriesEpisode(cur,el.video.duration)}}
async function closePlayer(restoreFreeze=true){if(!state.playerActive)return;el.video.onpause=null;await persistProgress(el.video,{frame:true});el.video.pause();destroyHls();el.video.onloadedmetadata=null;el.video.onerror=null;el.video.removeAttribute('src');el.video.load();el.playerLayer.classList.add('is-hidden');state.currentMedia=null;state.playerActive=false;if(restoreFreeze)freezePage(!el.detailLayer.classList.contains('is-hidden')||!el.collectionView.classList.contains('is-hidden'));await leaveFullscreenPortrait()}
el.playerClose.onclick=()=>closePlayer(true);el.playerExpand.onclick=()=>toggleFullscreen(el.playerWrap);
function synopsisMarkup(text,expanded=false){const full=String(text||'Sem sinopse disponível.').trim(),cut=!expanded&&full.length>200,value=cut?full.slice(0,200).trimEnd()+'…':full;return escapeHtml(value)+(cut?' <span class="synopsis__hint">mais</span>':'')}
function detailModal(){return el.detailLayer.querySelector('.detail-modal')}
function setSynopsisState(node,text,expanded){state.synopsisNode=node;state.synopsisText=String(text||'');state.synopsisExpanded=!!expanded;if(node)node.innerHTML=synopsisMarkup(state.synopsisText,state.synopsisExpanded)}
function collapseSynopsis(){if(state.synopsisExpanded&&state.synopsisNode){state.synopsisExpanded=false;state.synopsisNode.innerHTML=synopsisMarkup(state.synopsisText,false)}}
function openDetail(title){closePlayer(false);detailModal()?.classList.remove('is-series');el.detailHeadTitle.textContent=title;el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';el.detailScroll.scrollTop=0;el.detailLayer.classList.remove('is-hidden');freezePage(true);state.currentDetail={title};state.synopsisExpanded=false;state.synopsisText='';state.synopsisNode=null}
async function closeDetail(){if(state.seriesVideo){state.seriesVideo.video.onpause=null;await persistProgress(state.seriesVideo.video,{frame:true});state.seriesVideo.video.pause();destroyHls();state.seriesVideo=null}await leaveFullscreenPortrait();el.detailLayer.classList.add('is-hidden');detailModal()?.classList.remove('is-series');state.currentDetail=null;state.currentSeries=null;state.synopsisNode=null;state.synopsisText='';state.synopsisExpanded=false;freezePage(!el.collectionView.classList.contains('is-hidden'))}
el.detailClose.onclick=closeDetail;
el.detailLayer.addEventListener('click',e=>{if(e.target===el.detailLayer)closeDetail()});detailModal()?.addEventListener('click',e=>{if(state.synopsisExpanded&&!e.target.closest('.synopsis'))collapseSynopsis()},true);
async function openFilm(item){openDetail(itemTitle(item));const token=state.detailToken;await waitDetailSkeletonPaint(token);if(!isDetailCurrent(token))return;try{const detailParams={action:'get_vod_info',vod_id:item.stream_id};let data=null;try{data=await requestProviderDetailStable(detailParams)}catch(detailError){data={info:{plot:item?.plot||item?.description||'',description:item?.description||item?.plot||'',movie_image:item?.movie_image||item?.stream_icon||item?.cover||'',backdrop_path:item?.backdrop_path||'',tmdb_id:item?.tmdb_id||''},movie_data:{...item,stream_id:item.stream_id,name:itemTitle(item),container_extension:item?.container_extension||'mp4'}};playbackDebug('vod-detail-catalog-fallback',{mediaId:String(item?.stream_id||''),message:detailError?.message||String(detailError)})}if(!isDetailCurrent(token))return;const modalPackage=await resolveModalDetailPackage('vod',item,data);if(!isDetailCurrent(token))return;const info=data?.info||{},movie=data?.movie_data||item,art=modalPackage.art||IMAGE_PLACEHOLDER,title=modalPackage.title||movie.name||itemTitle(item),plot=modalPackage.overview||'',sources=vodSourcesFromInfo(data,item),url=sources[0]||streamUrl('vod',{...movie,stream_id:movie.stream_id||item.stream_id,container_extension:movie.container_extension||item.container_extension}),entry={key:'vod:'+(movie.stream_id||item.stream_id),type:'vod',title,image:art,url,sources,tmdbId:data?.__tmdb?.id||info?.tmdb_id||null,containerExtension:String(movie.container_extension||info.container_extension||item.container_extension||'mp4').toLowerCase(),itemSnapshot:{stream_id:movie.stream_id||item.stream_id,name:title,stream_icon:movie.stream_icon||item.stream_icon,movie_image:info.movie_image||movie.movie_image||'',cover:item.cover||'',cover_big:info.cover_big||'',backdrop_path:info.backdrop_path||'',tmdb_id:data?.__tmdb?.id||info?.tmdb_id||null,container_extension:movie.container_extension||info.container_extension||item.container_extension||'mp4'},position:0,duration:0};sources.forEach(warmMediaOrigin);state.currentDetail={type:'vod',entry};state.srhDetailPackage={token,type:'vod',mediaId:String(movie.stream_id||item.stream_id||''),brand:modalPackage.brand};if(state.srhOpeningContinue&&state.srhContinueFramePromise){await state.srhContinueFramePromise.catch(()=>null);if(!isDetailCurrent(token))return}const displayArt=state.srhOpeningContinue&&state.srhContinueFrameUrl?state.srhContinueFrameUrl:art;el.detailBody.innerHTML=`<div class="detail-content"><div class="detail-art"><img src="${escapeHtml(displayArt||IMAGE_PLACEHOLDER)}" alt=""></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(title)}</h2><button class="watch-button" id="watchFilm"><svg class="watch-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12z"/></svg><span>Assistir</span></button></div><div class="synopsis" id="filmSynopsis">${synopsisMarkup(plot,false)}</div></div>`;const filmImage=el.detailBody.querySelector('.detail-art img');applyManagedImageChain(filmImage,[displayArt,modalPackage.brand?.backdrop,modalPackage.brand?.providerBackdrop,modalPackage.brand?.poster,modalPackage.brand?.providerCover,info?.backdrop_path,info?.movie_image,movie?.movie_image,movie?.stream_icon,item?.stream_icon,item?.movie_image,item?.cover],{label:'vod-detail',eager:true});const filmSynopsis=$('#filmSynopsis');setSynopsisState(filmSynopsis,plot,false);filmSynopsis.onclick=e=>{e.stopPropagation();setSynopsisState(filmSynopsis,plot,!state.synopsisExpanded)};$('#watchFilm').onclick=()=>{const old=getHistory('vod').find(x=>x.key===entry.key);openGeneralPlayer(entry.sources||url,title,old?{...entry,...old,tmdbId:entry.tmdbId||old.tmdbId||old.itemSnapshot?.tmdb_id||null,itemSnapshot:{...(old.itemSnapshot||{}),...(entry.itemSnapshot||{})},sources:entry.sources}:entry)}}catch(e){if(!isDetailCurrent(token))return;el.detailBody.innerHTML='<div class="rail-load-error"><span>'+escapeHtml(e.message)+'</span><button type="button">Tentar novamente</button></div>';el.detailBody.querySelector('button').onclick=()=>openItem(item,item.series_id!==undefined?'series':'vod')}}
function normalizeEpisodes(v){if(Array.isArray(v))return{'1':v};return v&&typeof v==='object'?v:{}}
function normalizeSeriesDetailPayload(data){if(!data||typeof data!=='object')return data;const roots=[data,data.data,data.result,data.response,data.series_info,data.series].filter(v=>v&&typeof v==='object'),root=roots.find(v=>Array.isArray(v.episodes)||(v.episodes&&typeof v.episodes==='object'));if(!root||root===data)return data;return{...data,info:data.info||root.info||root.series_info||{},seasons:data.seasons||root.seasons||[],episodes:root.episodes}}
function episodeKey(series,ep){const seriesId=series?.series_id??series?.id??'',episodeId=ep?.id??ep?.stream_id??'';return seriesId&&episodeId?`series:${seriesId}:${episodeId}`:''}
const SERIES_DETAIL_CACHE_VERSION=1;
function seriesDetailCacheKey(item){
  return 'srhell:'+STANDARD_APP_NS+':standard:series-detail:'+standardProviderId()+':'+String(item?.series_id??item?.id??'')+':v'+SERIES_DETAIL_CACHE_VERSION
}
function seriesEpisodeStats(data){
  const normalized=normalizeSeriesDetailPayload(data),groups=normalizeEpisodes(normalized?.episodes),seasons=Object.keys(groups);
  let episodes=0;for(const season of seasons)episodes+=Array.isArray(groups[season])?groups[season].length:0;
  return{data:normalized,groups,seasons,episodes}
}
async function readSeriesDetailCache(item){
  const cached=await standardStateGet(seriesDetailCacheKey(item));
  if(!cached||Number(cached.version||0)!==SERIES_DETAIL_CACHE_VERSION)return null;
  const stats=seriesEpisodeStats(cached.data);
  if(!stats.episodes)return null;
  return{...cached,stats}
}
async function saveSeriesDetailCache(item,data,source='provider'){
  const stats=seriesEpisodeStats(data);if(!stats.episodes)return false;
  const payload={version:SERIES_DETAIL_CACHE_VERSION,at:Date.now(),source,data:cloneDetailPayload(stats.data),seasonCount:stats.seasons.length,episodeCount:stats.episodes};
  const ok=await standardStateSet(seriesDetailCacheKey(item),payload);
  playbackDebug('series-detail-cache-save',{mediaId:String(item?.series_id||''),source,seasons:stats.seasons.length,episodes:stats.episodes,ok});
  return ok
}
const seriesDetailStableInflight=new Map();
async function loadSeriesDetailStable(item,{force=false}={}){
  const mediaId=String(item?.series_id??item?.id??''),params={action:'get_series_info',series_id:mediaId},stableKey=seriesDetailCacheKey(item);
  const cached=await readSeriesDetailCache(item);
  if(cached&&!force){
    playbackDebug('series-detail-cache-hit',{mediaId,ageMs:Date.now()-Number(cached.at||0),seasons:cached.stats.seasons.length,episodes:cached.stats.episodes});
    return cloneDetailPayload(cached.data)
  }
  if(seriesDetailStableInflight.has(stableKey))return seriesDetailStableInflight.get(stableKey);
  const job=(async()=>{
    const attempts=[
      ['distributed-request',()=>request(params,CONFIG)],
      ['legacy-request-detail',()=>requestDetail(params,CONFIG)],
      ['xui-last-resort',()=>requestProviderDetailStable(params,CONFIG,12000,{force:true,accept:value=>seriesEpisodeStats(value).episodes>0})]
    ];
    let last=null;
    for(const [source,run] of attempts){
      try{
        const raw=await run(),stats=seriesEpisodeStats(raw),data=stats.data;
        if(!stats.episodes)throw new Error('O provedor respondeu sem temporadas/episódios.');
        await saveSeriesDetailCache(item,data,source);
        playbackDebug('series-detail-restored',{mediaId,source,seasons:stats.seasons.length,episodes:stats.episodes});
        return data
      }catch(e){
        last=e;
        playbackDebug('series-detail-source-failed',{mediaId,source,message:e?.message||String(e)})
      }
    }
    if(cached){
      playbackDebug('series-detail-cache-stale',{mediaId,ageMs:Date.now()-Number(cached.at||0),reason:last?.message||'provider-failure'});
      return cloneDetailPayload(cached.data)
    }
    throw last||new Error('Não foi possível carregar temporadas e episódios.')
  })().finally(()=>seriesDetailStableInflight.delete(stableKey));
  seriesDetailStableInflight.set(stableKey,job);
  return job
}
function seriesDetailFallback(item,error=null){
  const rows=getHistory('series')
    .filter(x=>String(x?.seriesId??x?.itemSnapshot?.series_id??'')===String(item?.series_id??''))
    .sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0));
  const resume=rows[0]||null,season=String(resume?.season??'1');
  const streamId=resume?.itemSnapshot?.stream_id||'';
  const episode=streamId?{
    id:streamId,stream_id:streamId,
    episode_num:resume?.episodeNumber||1,
    container_extension:resume?.containerExtension||resume?.itemSnapshot?.container_extension||'mp4',
    direct_source:resume?.lastWorkingUrl||'',
    info:{
      duration:resume?.duration||'',
      movie_image:resume?.image||resume?.itemSnapshot?.movie_image||'',
      container_extension:resume?.containerExtension||resume?.itemSnapshot?.container_extension||'mp4',
      direct_source:resume?.lastWorkingUrl||''
    }
  }:null;
  const info={
    name:itemTitle(item),
    plot:item?.plot||item?.description||'',
    description:item?.description||item?.plot||'',
    cover:item?.cover||item?.stream_icon||item?.movie_image||'',
    cover_big:item?.cover_big||item?.cover||item?.stream_icon||'',
    movie_image:item?.movie_image||item?.cover||item?.stream_icon||'',
    backdrop_path:item?.backdrop_path||item?.backdrop||'',
    tmdb_id:item?.tmdb_id||resume?.tmdbId||resume?.itemSnapshot?.tmdb_id||'',
    rating:item?.rating??item?.rating_5based??''
  };
  return{
    info,
    episodes:episode?{[season]:[episode]}:{},
    __srhPartialSeries:true,
    __srhDetailError:error?.message||String(error||''),
    __srhResumeRecovered:!!episode
  }
}
async function renderSeriesRecoveryModal(item,error,token){
  try{
    const data=seriesDetailFallback(item,error),info=data?.info||{};
    let tmdb=null;
    try{tmdb=await resolveCatalogMetadata?.('tv',item,null)}catch{}
    if(!isDetailCurrent(token))return false;
    const title=stripEmoji(tmdb?.title||info.name||itemTitle(item),'Sem título');
    const plot=String(tmdb?.overview||info.plot||info.description||item?.plot||item?.description||'').trim();
    const art=String(tmdb?.backdrop||modalImageValue(info.backdrop_path,info.backdrop,info.cover_big,info.movie_image,info.cover,item?.backdrop_path,item?.backdrop,item?.cover_big,item?.cover,item?.stream_icon)||IMAGE_PLACEHOLDER).trim();
    const brand={
      ...(tmdb||{}),
      id:tmdb?.id||String(info.tmdb_id||item?.tmdb_id||''),
      title,backdrop:art,overview:plot,
      year:String(tmdb?.year||info.year||item?.year||''),
      vote:tmdb?.vote??(Number.isFinite(Number(info.rating??item?.rating))?Number(info.rating??item?.rating):null),
      logo:String(tmdb?.logo||'').trim(),
      metadataVersion:Math.max(Number(tmdb?.metadataVersion||0),3),
      artSource:tmdb?.backdrop?'tmdb-backdrop':'catalog-fallback'
    };
    state.currentSeries={item,data,episodes:normalizeEpisodes(data?.episodes),backdrop:art,tmdbId:brand.id||null};
    state.srhDetailPackage={token,type:'series',mediaId:String(item?.series_id||''),brand};
    el.detailBody.innerHTML='<div class="detail-content"><div class="series-static"><div class="detail-art" id="seriesArt"><img class="backdrop" id="seriesImage" src="'+escapeHtml(art)+'" alt=""></div><div class="detail-title-row"><h2 class="detail-title">'+escapeHtml(title)+'</h2></div><div class="synopsis" id="seriesSynopsis">'+synopsisMarkup(plot,false)+'</div><div class="season-box"><button class="season-trigger" type="button" disabled><span>Temporadas</span></button></div></div><div class="episode-container"><div class="episode-list"><div class="rail-load-error srh-series-detail-partial"><span>As informações da série foram carregadas, mas os episódios não chegaram do provedor.</span><button type="button" data-series-detail-retry>Tentar carregar episódios</button></div></div></div></div>';
    const syn=el.detailBody.querySelector('#seriesSynopsis');
    setSynopsisState(syn,plot,false);
    if(syn)syn.onclick=e=>{e.stopPropagation();setSynopsisState(syn,plot,!state.synopsisExpanded)};
    const retry=el.detailBody.querySelector('[data-series-detail-retry]');
    if(retry)retry.onclick=e=>{e.stopPropagation();retry.disabled=true;retry.textContent='Carregando…';openSeries(item,{forceEpisodes:true})};
    playbackDebug('series-detail-safe-shell',{mediaId:String(item?.series_id||''),tmdb:!!tmdb,message:error?.message||String(error||'')});
    return true
  }catch(shellError){
    playbackDebug('series-detail-safe-shell-failed',{mediaId:String(item?.series_id||''),message:shellError?.message||String(shellError)});
    return false
  }
}
async function stopInlineSeriesVideo(){const sv=state.seriesVideo;if(!sv)return;srhClearPlaybackFeedback(sv.art,{restoreBrand:true});sv.video.onpause=null;await persistProgress(sv.video,{frame:true});sv.video.pause();destroyHls();sv.video.onloadedmetadata=null;sv.video.onerror=null;sv.video.removeAttribute('src');sv.video.load();sv.video.classList.add('is-hidden');sv.image.classList.remove('is-hidden');sv.actions.classList.add('is-hidden');state.seriesVideo=null;state.currentMedia=null;await leaveFullscreenPortrait()}
async function openSeries(item,opts=null){if(seriesProviderGuardBlocked()){showSeriesProviderGuardPopup();if(state.activeType==='series')renderActiveType();return}openDetail(itemTitle(item));const token=state.detailToken;detailModal()?.classList.add('is-series');await waitDetailSkeletonPaint(token);if(!isDetailCurrent(token))return;try{let data=null;try{data=await loadSeriesDetailStable(item,{force:!!opts?.forceEpisodes});seriesProviderGuardSuccess()}catch(detailError){const guard=seriesProviderGuardFailure(detailError,item);if(guard.blocked){await activateSeriesProviderGuard();return}data=seriesDetailFallback(item,detailError);playbackDebug('series-detail-partial-fallback',{mediaId:String(item?.series_id||''),resumeRecovered:!!data.__srhResumeRecovered,message:detailError?.message||String(detailError),errorType:detailError?.srhKind||'',rawMessage:detailError?.srhRawMessage||''})}if(!isDetailCurrent(token))return;const modalPackage=await resolveModalDetailPackage('series',item,data);if(!isDetailCurrent(token))return;const info=data?.info||{},episodes=normalizeEpisodes(data?.episodes),seasons=Object.keys(episodes).sort((a,b)=>Number(a)-Number(b)),backdrop=modalPackage.art||IMAGE_PLACEHOLDER,plot=modalPackage.overview||'';state.currentSeries={item,data,episodes,backdrop,tmdbId:modalPackage.brand?.id||info?.tmdb_id||null,tmdbBackdrop:String(modalPackage.brand?.tmdbBackdrop||modalPackage.brand?.backdrop||'').trim(),tmdbPoster:String(modalPackage.brand?.poster||'').trim(),providerBackdrop:String(modalPackage.brand?.providerBackdrop||'').trim(),providerCover:String(modalPackage.brand?.providerCover||'').trim()};state.srhDetailPackage={token,type:'series',mediaId:String(item.series_id||''),brand:modalPackage.brand};if(state.srhOpeningContinue&&state.srhContinueFramePromise){await state.srhContinueFramePromise.catch(()=>null);if(!isDetailCurrent(token))return}const displayBackdrop=state.srhOpeningContinue&&state.srhContinueFrameUrl?state.srhContinueFrameUrl:backdrop;el.detailBody.innerHTML=`<div class="detail-content"><div class="series-static"><div class="detail-art" id="seriesArt"><img class="backdrop" id="seriesImage" src="${escapeHtml(displayBackdrop||IMAGE_PLACEHOLDER)}" alt=""><video class="is-hidden" id="seriesInlineVideo" controls autoplay playsinline></video><div class="detail-art__actions is-hidden" id="seriesVideoActions"><button class="floating-action" id="seriesStop" title="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="floating-action" id="seriesExpand" title="Expandir ou minimizar"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button></div></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(itemTitle(item))}</h2></div><div class="synopsis" id="seriesSynopsis">${synopsisMarkup(plot,false)}</div><div class="season-box"><button class="season-trigger" id="seasonTrigger"><span id="seasonLabel">${seasons[0]?'Temporada '+escapeHtml(seasons[0]):'Temporadas'}</span><span class="season-trigger__icon" aria-hidden="true">${UI_ICON_CHEVRON_DOWN}</span></button><div class="season-menu is-hidden${seasons.length>4?' season-menu--scroll':''}" id="seasonMenu"></div></div></div><div class="episode-container"><div class="episode-list" id="episodeList"></div></div></div>`;const art=$('#seriesArt'),image=$('#seriesImage'),video=$('#seriesInlineVideo'),actions=$('#seriesVideoActions'),seasonMenu=$('#seasonMenu'),seasonLabel=$('#seasonLabel'),list=$('#episodeList'),syn=$('#seriesSynopsis');applyManagedImageChain(image,[displayBackdrop,modalPackage.brand?.backdrop,modalPackage.brand?.providerBackdrop,modalPackage.brand?.poster,modalPackage.brand?.providerCover,item?.backdrop_path,item?.backdrop,item?.cover_big,item?.cover,item?.stream_icon],{label:'series-detail',eager:true});setSynopsisState(syn,plot,false);syn.onclick=e=>{e.stopPropagation();setSynopsisState(syn,plot,!state.synopsisExpanded)};seasonMenu.innerHTML=seasons.map((s,i)=>`<button class="season-option${i===0?' is-active':''}" data-season="${escapeHtml(s)}">Temporada ${escapeHtml(s)}</button>`).join('');$('#seasonTrigger').onclick=e=>{e.stopPropagation();seasonMenu.classList.toggle('is-hidden')};function drawSeason(key){seasonLabel.textContent='Temporada '+key;seasonMenu.classList.add('is-hidden');seasonMenu.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('is-active',b.dataset.season===key));const eps=Array.isArray(episodes[key])?episodes[key]:[],history=new Map(getHistory('series').map(x=>[x.key,x]));list.innerHTML=eps.map((ep,idx)=>{const n=ep.episode_num??idx+1,thumb=ep.__srhEpisodeThumb||ep.info?.movie_image||ep.info?.cover_big||ep.info?.cover||ep.stream_icon||backdrop||IMAGE_PLACEHOLDER,h=history.get(episodeKey(item,ep)),done=getStandardCompleted(episodeKey(item,ep)),pct=h?.duration?Math.min(100,h.position/h.duration*100):(done?100:0);return `<article class="episode" data-ep="${idx}"><img class="episode__thumb" src="${escapeHtml(thumb)}" alt="" loading="${idx<6?'eager':'lazy'}" decoding="async"><div><div class="episode__title">Episódio ${escapeHtml(n)}</div><div class="episode__meta">${escapeHtml(ep.info?.duration||'')}</div><div class="episode__progress"><span style="width:${pct}%"></span></div></div><div class="episode__play"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M9 6.5v11l8-5.5z"/></svg></div></article>`}).join('');list.querySelectorAll('[data-ep]').forEach(row=>{const epIndex=Number(row.dataset.ep),ep=eps[epIndex],img=row.querySelector('.episode__thumb');applyManagedImageChain(img,[ep?.__tmdbStill,ep?.__providerEpisodeArt,ep?.info?.movie_image,ep?.info?.cover_big,ep?.info?.cover,ep?.stream_icon,state.currentSeries?.tmdbBackdrop,state.currentSeries?.tmdbPoster,state.currentSeries?.providerBackdrop,state.currentSeries?.providerCover,backdrop,item?.backdrop_path,item?.backdrop,item?.cover_big,item?.cover,item?.stream_icon],{label:'episode-'+String(ep?.episode_num??ep?.episode_number??epIndex+1),eager:epIndex<6});row.onclick=()=>playEpisode(ep,epIndex,key)});list.scrollTop=0}async function playEpisode(ep,idx,season){const playToken=++state.seriesPlayToken;await stopInlineSeriesVideo();if(!isDetailCurrent(token)||playToken!==state.seriesPlayToken)return;const n=ep.episode_num??idx+1,eid=ep?.id||ep?.stream_id,catalogExt=String(ep?.container_extension||'mp4').replace(/^\./,'').toLowerCase(),infoExt=String(ep?.info?.container_extension||'').replace(/^\./,'').toLowerCase(),declaredExt=infoExt||catalogExt||'mp4',direct=normalizeMediaUrl(ep?.direct_source||ep?.info?.direct_source||''),declaredUrl=mediaUrlWithExtension('series',eid,declaredExt),catalogUrl=catalogExt&&catalogExt!==declaredExt?mediaUrlWithExtension('series',eid,catalogExt):'',hls=mediaUrlWithExtension('series',eid,'m3u8'),mkv=(declaredExt!=='mkv'&&catalogExt!=='mkv')?mediaUrlWithExtension('series',eid,'mkv'):'',sources=uniqueMediaUrls([direct,declaredUrl,catalogUrl,mkv,hls]),key=episodeKey(item,ep),old=getHistory('series').find(x=>String(x.seriesId??'')===String(item.series_id)&&String(x.season??'')===String(season)&&(String(x.itemSnapshot?.stream_id??'')===String(eid)||String(x.episodeNumber??'')===String(n))),entry={key,type:'series',title:itemTitle(item)+' — Episódio '+n,image:ep.__srhWaitingArt||ep.__tmdbStill||ep.info?.movie_image||ep.info?.cover_big||ep.info?.cover||ep.stream_icon||backdrop,providerEpisodeImage:providerEpisodeArt(ep),url:sources[0],sources,seriesId:item.series_id,season,episodeNumber:n,tmdbId:state.currentSeries?.tmdbId||data?.__tmdb?.id||null,containerExtension:infoExt||catalogExt,itemSnapshot:{series_id:item.series_id,stream_id:eid,name:itemTitle(item),cover:item.cover||backdrop,series_cover:item.cover||item.stream_icon||'',series_backdrop:state.currentSeries?.providerBackdrop||item.backdrop_path||item.backdrop||'',episode_image:providerEpisodeArt(ep),tmdb_id:state.currentSeries?.tmdbId||data?.__tmdb?.id||null,container_extension:infoExt||catalogExt,movie_image:ep.info?.movie_image||''},position:0,duration:0};sources.forEach(warmMediaOrigin);const episodeArt=ep.__srhWaitingArt||ep.__tmdbStill||ep.info?.movie_image||ep.info?.cover_big||ep.info?.cover||ep.stream_icon||backdrop||IMAGE_PLACEHOLDER;applyManagedImageChain(image,ep.__srhEpisodeArtCandidates||[ep.__tmdbStill,providerEpisodeArt(ep),state.currentSeries?.tmdbBackdrop,state.currentSeries?.tmdbPoster,state.currentSeries?.providerBackdrop,state.currentSeries?.providerCover,episodeArt,backdrop],{label:'series-playing-'+String(n),eager:true});image.classList.remove('is-hidden');video.classList.add('is-hidden');video.muted=false;video.volume=1;video.controls=true;video.autoplay=true;actions.classList.remove('is-hidden');const playbackSources=preferOnDemandSources(uniqueMediaUrls([old?.lastWorkingUrl,...sources]),'series',old?.lastWorkingUrl||'',old?.lastStartupMs||0);state.currentMedia=old?{...entry,...old,tmdbId:entry.tmdbId||old.tmdbId||old.itemSnapshot?.tmdb_id||null,itemSnapshot:{...(old.itemSnapshot||{}),...(entry.itemSnapshot||{})},sources:playbackSources}:entry;state.saveTick=0;state.seriesVideo={video,image,actions,art};srhShowPlaybackLoading(art,itemTitle(item));attachVideo(video,playbackSources,()=>{srhClearPlaybackFeedback(art,{restoreBrand:true});applySavedPosition(video,old?.position,'callback');image.classList.add('is-hidden');video.classList.remove('is-hidden');art.classList.add('is-playing')},err=>{image.classList.remove('is-hidden');video.classList.add('is-hidden');art.classList.remove('is-playing');srhShowProviderError(art,err);toast('Não foi possível reproduzir este episódio.')});video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};video.onpause=()=>persistProgress(video,{frame:true});video.onended=()=>{const cur=state.currentMedia||entry;finalizeSeriesEpisode(cur,video.duration);drawSeason(season)};const stopButton=$('#seriesStop');if(stopButton)stopButton.onclick=e=>{e.stopPropagation();stopInlineSeriesVideo().then(()=>drawSeason(season))};$('#seriesExpand').onclick=e=>{e.stopPropagation();toggleFullscreen(art)}}seasonMenu.querySelectorAll('[data-season]').forEach(b=>b.onclick=e=>{e.stopPropagation();drawSeason(b.dataset.season)});if(seasons[0])drawSeason(seasons[0]);else{list.innerHTML='<div class="rail-load-error srh-series-detail-partial"><span>'+escapeHtml(data?.__srhPartialSeries?'Os dados dos episódios não chegaram do provedor.':'A API não retornou episódios.')+'</span><button type="button">Tentar carregar episódios</button></div>';const retry=list.querySelector('button');if(retry)retry.onclick=e=>{e.stopPropagation();retry.disabled=true;retry.textContent='Carregando…';openSeries(item,{forceEpisodes:true})}}if(data?.__srhPartialSeries){playbackDebug('series-detail-partial-rendered',{mediaId:String(item?.series_id||''),seasons:seasons.length,resumeRecovered:!!data.__srhResumeRecovered})}}catch(e){if(!isDetailCurrent(token))return;const recovered=await renderSeriesRecoveryModal(item,e,token);if(!recovered&&isDetailCurrent(token)){el.detailBody.innerHTML='<div class="rail-load-error srh-series-detail-partial"><span>Não foi possível montar os episódios agora.</span><button type="button">Tentar novamente</button></div>';el.detailBody.querySelector('button').onclick=()=>openSeries(item,{forceEpisodes:true})}}}
async function openLive(group){openDetail(group.baseName);const token=state.detailToken;await waitDetailSkeletonPaint(token);if(!isDetailCurrent(token))return;state.currentDetail={type:'live',group};const logo=group.image||IMAGE_PLACEHOLDER,variants=group.variants||[];el.detailBody.innerHTML=`<div class="detail-content"><div class="detail-art"><img class="channel-logo" src="${escapeHtml(logo)}" alt=""></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(group.baseName)}</h2></div><div class="quality-list">${variants.map((v,i)=>`<button class="quality-row" data-quality-index="${i}"><span class="quality-row__name">${escapeHtml(group.baseName)}</span><span class="quality-row__quality">${escapeHtml(v._quality||'Padrão')}</span></button>`).join('')}</div></div>`;el.detailBody.querySelectorAll('[data-quality-index]').forEach(b=>b.onclick=()=>{const v=variants[Number(b.dataset.qualityIndex)],url=streamUrl('live',v);warmMediaOrigin(url);playbackDebug('live-stable-route',{mediaId:String(v?.stream_id??v?.id??''),extension:String(CONFIG.liveExtension||'m3u8')});openGeneralPlayer(url,group.baseName+' · '+(v._quality||'Padrão'),{key:'live:'+v.stream_id,type:'live',title:group.baseName,url,image:logo,position:0,duration:0})})}
function openItem(item,type){if(type==='live')openLive(item);else if(type==='series')openSeries(item);else openFilm(item)}
function normalizeUpdateCategories(raw,type){return(Array.isArray(raw)?raw:[]).map((c,i)=>({type,id:String(c.category_id??c.id??'').trim(),name:String(c.category_name??c.name??('Categoria '+(i+1)))})).filter(c=>c.id)}
function updateCategoryKey(c){return String(c?.type||'')+'::'+String(c?.id||'')}
function renderUpdateGroups(){const grouped={live:[],vod:[],series:[]};state.updateCategories.forEach(c=>grouped[c.type]?.push(c));el.updateGroups.innerHTML=Object.entries(grouped).map(([type,cats])=>cats.length?`<section class="update-group"><div class="update-group__title">${TYPE[type].label}</div><div class="update-list">${cats.map(c=>{const key=updateCategoryKey(c);return `<label class="update-option"><input type="checkbox" data-update-key="${escapeHtml(key)}" ${state.updateSelected.has(key)?'checked':''}><span>${escapeHtml(stripEmoji(c.name))}</span></label>`}).join('')}</div></section>`:'').join('');el.updateGroups.querySelectorAll('[data-update-key]').forEach(ch=>ch.onchange=()=>{ch.checked?state.updateSelected.add(ch.dataset.updateKey):state.updateSelected.delete(ch.dataset.updateKey);el.updateApply.disabled=!state.updateSelected.size})}
async function loadUpdateCategories(){state.updateCategories=[];state.updateSelected.clear();el.updateApply.disabled=true;el.updateGroups.innerHTML='';try{const candidate={...CONFIG,...parseLogin(el.updateM3u.value)};state.updateCandidate=candidate;el.updateStatus.textContent='Validando login e lendo categorias…';el.updateLoad.disabled=true;const account=await request({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');if(!active)throw new Error('O novo login não retornou uma conta ativa.');const groups=await Promise.all(Object.entries(TYPE).map(async([type,meta])=>normalizeUpdateCategories(await request({action:meta.categories},candidate),type)));state.updateCategories=groups.flat();const oldIds=new Set((CONFIG.targets||[]).map(t=>targetId(t)?String(t.type)+'::'+targetId(t):'').filter(Boolean)),legacy=(CONFIG.targets||[]).filter(t=>!targetId(t));state.updateCategories.forEach(c=>{const k=updateCategoryKey(c);if(oldIds.has(k)){state.updateSelected.add(k);return}const matches=state.updateCategories.filter(x=>x.type===c.type&&x.name===c.name);if(matches.length===1&&legacy.some(t=>t.type===c.type&&t.name===c.name))state.updateSelected.add(k)});renderUpdateGroups();el.updateStatus.textContent=state.updateCategories.length+' categorias disponíveis.'}catch(e){el.updateStatus.textContent=e.message}finally{el.updateLoad.disabled=false}}
async function applyUpdate(){if(!state.updateCandidate||!state.updateSelected.size)return;const targets=state.updateCategories.filter(c=>state.updateSelected.has(updateCategoryKey(c))).map(c=>({type:c.type,id:String(c.id),name:c.name})),runtime={server:state.updateCandidate.server,username:state.updateCandidate.username,password:state.updateCandidate.password,liveExtension:state.updateCandidate.liveExtension,targets},providerChanged=!!standardProviderId(CONFIG)&&!!standardProviderId(runtime)&&standardProviderId(CONFIG)!==standardProviderId(runtime);try{if(providerChanged){for(const key of [`srhell:${STANDARD_APP_NS}:standard:favorites:v1`,`srhell:${STANDARD_APP_NS}:standard:continue:vod`,`srhell:${STANDARD_APP_NS}:standard:continue:series`,STANDARD_COMPLETED_KEY,STANDARD_LAST_WATCHED_PREFIX+'vod',STANDARD_LAST_WATCHED_PREFIX+'series','srhell:'+STANDARD_APP_NS+':standard:similar:'+standardProviderId(CONFIG)+':v1'])await standardStateDelete(key)}const ok=await standardStateSet(storageKey(),runtime);if(!ok)throw new Error('IndexedDB');try{localStorage.removeItem(storageKey())}catch{}toast('Lista atualizada. Recarregando…');setTimeout(()=>location.reload(),350)}catch{toast('Não foi possível salvar a lista no IndexedDB.')}}
setUpdateAccordionIcon(el.updateAccordionBody?.classList.contains('is-hidden')!==false);el.settingsButton.onclick=()=>{const opening=el.settingsPanel.classList.contains('is-hidden');el.settingsPanel.classList.toggle('is-hidden');if(opening)refreshAccount()};el.updateAccordionButton.onclick=()=>{const hidden=el.updateAccordionBody.classList.toggle('is-hidden');setUpdateAccordionIcon(hidden)};el.updateLoad.onclick=loadUpdateCategories;el.updateApply.onclick=applyUpdate;
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&isMobile())screen.orientation?.lock?.('portrait')?.catch?.(()=>{})});
function init(){installImageFallback();document.body.dataset.theme=CONFIG.theme||'graphene';document.title=CONFIG.appName;el.title.textContent=CONFIG.appName;const types=selectedTypes();if(!types.length){el.homeStatus.textContent='Nenhuma categoria configurada.';return}state.activeType=types[0];renderActiveType();refreshAccount()}
/* SRHELL v6.6 detail/player fixes — loaded after standard/03.js */
function srhFeedbackBrandMarkup(art,title){
  const brand=art?.querySelector('.srh-art-brand'),logo=brand?.querySelector('img:not(.is-hidden)'),fallback=brand?.querySelector('.srh-art-brand__fallback:not(.is-hidden)');
  const src=String(logo?.currentSrc||logo?.src||'').trim(),text=String(fallback?.textContent||title||state.currentMedia?.title||'').trim();
  if(src)return '<img class="srh-playback-feedback__logo" crossorigin="anonymous" src="'+escapeHtml(src)+'" alt="">';
  return '<div class="srh-playback-feedback__name">'+escapeHtml(text||'Carregando')+'</div>'
}
function srhClearPlaybackFeedback(art,{restoreBrand=true}={}){
  if(!art)return;
  art.querySelectorAll('.srh-playback-feedback').forEach(x=>x.remove());
  art.classList.remove('srh-playback-loading','srh-playback-error');
  if(restoreBrand)art.querySelector('.srh-art-brand')?.classList.remove('srh-feedback-brand-hidden')
}
function srhFeedbackLuminance(rgb){
  if(!rgb)return.12;
  const f=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
  return .2126*f(rgb[0])+.7152*f(rgb[1])+.0722*f(rgb[2])
}
function srhFeedbackColorDistance(a,b){return Math.hypot((a?.[0]||0)-(b?.[0]||0),(a?.[1]||0)-(b?.[1]||0),(a?.[2]||0)-(b?.[2]||0))}
function srhAverageLogoColor(img){
  try{
    const cv=document.createElement('canvas');cv.width=64;cv.height=32;
    const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,64,32);
    const d=cx.getImageData(0,0,64,32).data;let r=0,g=0,b=0,w=0,dark=0,light=0;
    for(let i=0;i<d.length;i+=4){
      const a=d[i+3]/255;if(a<.11)continue;
      r+=d[i]*a;g+=d[i+1]*a;b+=d[i+2]*a;w+=a;
      const l=srhFeedbackLuminance([d[i],d[i+1],d[i+2]]);if(l<.2)dark+=a;if(l>.8)light+=a
    }
    if(!w)return null;
    const rgb=[r/w,g/w,b/w];return{rgb,lum:srhFeedbackLuminance(rgb),darkShare:dark/w,lightShare:light/w}
  }catch{return null}
}
function srhArtworkColorBehind(art,target){
  try{
    const image=[...art.children].find(x=>x.tagName==='IMG'&&!x.classList.contains('srh-playback-feedback__logo'))||art.querySelector('img');
    if(!image?.naturalWidth||!image?.naturalHeight)return null;
    const ir=image.getBoundingClientRect(),tr=target.getBoundingClientRect();
    if(ir.width<2||ir.height<2)return null;
    const iw=image.naturalWidth,ih=image.naturalHeight,fit=getComputedStyle(image).objectFit||'cover';
    let scaleX=ir.width/iw,scaleY=ir.height/ih,scale=fit==='contain'?Math.min(scaleX,scaleY):fit==='fill'?null:Math.max(scaleX,scaleY);
    let dw=ir.width,dh=ir.height,ox=0,oy=0;
    if(scale){dw=iw*scale;dh=ih*scale;ox=(ir.width-dw)/2;oy=(ir.height-dh)/2}
    const sx0=scale?(tr.left-ir.left-ox)/scale:(tr.left-ir.left)/Math.max(.001,scaleX),sy0=scale?(tr.top-ir.top-oy)/scale:(tr.top-ir.top)/Math.max(.001,scaleY);
    const sw0=scale?tr.width/scale:tr.width/Math.max(.001,scaleX),sh0=scale?tr.height/scale:tr.height/Math.max(.001,scaleY);
    const sx=Math.max(0,Math.min(iw-1,sx0)),sy=Math.max(0,Math.min(ih-1,sy0)),sw=Math.max(1,Math.min(iw-sx,sw0)),sh=Math.max(1,Math.min(ih-sy,sh0));
    const cv=document.createElement('canvas');cv.width=48;cv.height=24;
    const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(image,sx,sy,sw,sh,0,0,48,24);
    const d=cx.getImageData(0,0,48,24).data;let r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){if(d[i+3]<24)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}
    if(!n)return null;const rgb=[r/n,g/n,b/n];return{rgb,lum:srhFeedbackLuminance(rgb)}
  }catch{return null}
}
async function srhWaitFeedbackImage(img,timeout=1800){
  if(img?.complete&&img.naturalWidth>0)return true;
  return new Promise(resolve=>{
    let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(!!ok)},timer=setTimeout(()=>finish(false),timeout);
    img.onload=()=>finish(true);img.onerror=()=>finish(false)
  })
}
async function srhTunePlaybackFeedbackBrand(art,box){
  const inner=box?.querySelector('.srh-playback-feedback__inner'),img=inner?.querySelector('.srh-playback-feedback__logo');
  if(!inner)return;
  inner.classList.remove('srh-feedback-outline-light','srh-feedback-outline-dark','srh-feedback-outline-neutral');
  if(!img){inner.classList.add('srh-feedback-outline-dark');return}
  await srhWaitFeedbackImage(img);
  if(!box.isConnected)return;
  try{
    if(typeof normalizeCatalogLogo==='function'&&img.dataset.srhFeedbackNormalized!=='1'){
      const normalized=await normalizeCatalogLogo(img);
      if(normalized?.src&&normalized.src!==img.src){
        img.dataset.srhFeedbackNormalized='1';img.src=normalized.src;
        await srhWaitFeedbackImage(img)
      }
    }
  }catch{}
  if(!box.isConnected)return;
  try{if(typeof tuneCatalogLogoContrast==='function')await tuneCatalogLogoContrast(img,inner)}catch{}
  const logo=srhAverageLogoColor(img),bg=srhArtworkColorBehind(art,img);
  if(!logo||!bg){inner.classList.add(logo?.lightShare>.65?'srh-feedback-outline-dark':'srh-feedback-outline-light');return}
  const lumDiff=Math.abs(logo.lum-bg.lum),colorDiff=srhFeedbackColorDistance(logo.rgb,bg.rgb),similar=lumDiff<.22||colorDiff<105;
  if(similar){
    inner.classList.add(bg.lum>.52?'srh-feedback-outline-dark':'srh-feedback-outline-light')
  }else if(logo.darkShare>.66&&bg.lum<.34){
    inner.classList.add('srh-feedback-outline-light')
  }else if(logo.lightShare>.72&&bg.lum>.67){
    inner.classList.add('srh-feedback-outline-dark')
  }else{
    inner.classList.add('srh-feedback-outline-neutral')
  }
  playbackDebug('loading-logo-contrast',{logoLum:Number(logo.lum.toFixed(3)),bgLum:Number(bg.lum.toFixed(3)),colorDistance:Math.round(colorDiff),outline:inner.classList.contains('srh-feedback-outline-light')?'light':inner.classList.contains('srh-feedback-outline-dark')?'dark':'neutral'})
}
function srhShowPlaybackLoading(art,title){
  if(!art)return null;
  srhClearPlaybackFeedback(art,{restoreBrand:true});
  const brand=art.querySelector('.srh-art-brand');brand?.classList.add('srh-feedback-brand-hidden');
  const box=document.createElement('div');box.className='srh-playback-feedback srh-playback-feedback--loading';
  box.innerHTML='<div class="srh-playback-feedback__inner">'+srhFeedbackBrandMarkup(art,title)+'<span class="srh-playback-feedback__spinner" aria-hidden="true"></span><span class="srh-playback-feedback__label">Carregando</span></div>';
  art.appendChild(box);art.classList.add('srh-playback-loading');
  requestAnimationFrame(()=>srhTunePlaybackFeedbackBrand(art,box));
  return box
}
function srhShowProviderError(art,err){
  if(!art)return;
  srhClearPlaybackFeedback(art,{restoreBrand:false});
  art.querySelector('.srh-art-brand')?.classList.add('srh-feedback-brand-hidden');
  const status=Number(err?.status||0),detail=status?'HTTP '+status:'Mídia indisponível',box=document.createElement('div');
  box.className='srh-playback-feedback srh-playback-feedback--error';
  box.innerHTML='<div class="srh-playback-feedback__error"><strong>Erro</strong><span>Erro do provedor</span><small>'+escapeHtml(detail)+'</small></div>';
  art.appendChild(box);art.classList.add('srh-playback-error')
}
function srhFixInlineState(){
  return state.detailInlineVideo || null;
}
async function srhFixStopInlineDetailVideo(restoreImage=true){
  const iv=srhFixInlineState();
  if(!iv)return;
  const mediaAtStop=state.currentMedia;
  srhClearPlaybackFeedback(iv.art,{restoreBrand:true});
  iv.video.onpause=null;
  try{await persistProgress(iv.video,{frame:true})}catch(e){playbackDebug('continue-frame-teardown-failed',{type:mediaAtStop?.type||'',key:mediaAtStop?.key||'',message:e?.message||String(e)})}
  try{iv.video.pause()}catch{}
  try{destroyHls()}catch{}
  iv.video.onloadedmetadata=null;iv.video.onerror=null;
  try{iv.video.removeAttribute('src');iv.video.load()}catch{}
  if(restoreImage&&iv.image)iv.image.classList.remove('is-hidden');
  if(iv.art)iv.art.classList.remove('is-playing');
  try{iv.video.remove()}catch{}
  try{iv.actions.remove()}catch{}
  try{iv.status.remove()}catch{}
  if(state.detailInlineVideo===iv)state.detailInlineVideo=null;
  if(state.currentMedia===mediaAtStop)state.currentMedia=null;
  if(!state.detailInlineVideo)state.playerActive=false;
}
function srhFixOverlayPlayer(url,title,entry=null){
  const rawSources=mediaCandidates(entry?.lastWorkingUrl?[entry.lastWorkingUrl,...(Array.isArray(entry?.sources)?entry.sources:[entry?.sources||url])]:entry?.sources||url),sources=preferOnDemandSources(rawSources,entry?.type||'live',entry?.lastWorkingUrl||'',entry?.lastStartupMs||0);
  state.playerActive=true;
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.saveTick=0;
  el.playerTitle.textContent=title;
  el.playerStatus.textContent='Carregando…';
  el.playerLayer.classList.remove('is-hidden');
  freezePage(true);
  attachVideo(el.video,sources,()=>{
    el.playerStatus.textContent='Reproduzindo';
    applySavedPosition(el.video,entry?.position,'callback')
  },err=>{
    el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')
  });
  el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};
  el.video.onpause=()=>persistProgress(el.video,{frame:true});
  el.video.onended=()=>{const cur=state.currentMedia;if(!cur)return;if(cur.type==='vod'){markStandardTitleCompleted(cur,el.video.duration);clearContinueFrame(cur);removeContinueForEntry(cur)}else if(cur.type==='series')finalizeSeriesEpisode(cur,el.video.duration)}
}
async function srhFixInlinePlayer(url,title,entry=null){
  const art=el.detailBody.querySelector('.detail-art');
  if(!art)return srhFixOverlayPlayer(url,title,entry);
  await srhFixStopInlineDetailVideo(false);

  const rawSources=mediaCandidates(entry?.lastWorkingUrl?[entry.lastWorkingUrl,...(Array.isArray(entry?.sources)?entry.sources:[entry?.sources||url])]:entry?.sources||url),sources=preferOnDemandSources(rawSources,entry?.type||'live',entry?.lastWorkingUrl||'',entry?.lastStartupMs||0);
  const image=art.querySelector('img');
  const video=document.createElement('video');
  video.className='detail-inline-video is-hidden';
  video.controls=true;
  video.autoplay=true;
  video.playsInline=true;
  video.preload='auto';

  const status=document.createElement('div');
  status.className='detail-inline-status is-hidden';
  status.textContent='Carregando…';

  const actions=document.createElement('div');
  actions.className='detail-inline-actions';
  actions.innerHTML='<button class="detail-inline-action" data-inline-close aria-label="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="detail-inline-action" data-inline-expand aria-label="Expandir vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';

  if(image)image.classList.remove('is-hidden');
  art.classList.remove('is-playing');
  art.append(video,status,actions);

  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.playerActive=false;
  state.saveTick=0;
  state.detailInlineVideo={video,image,actions,status,art};
  srhShowPlaybackLoading(art,title);

  attachVideo(video,sources,()=>{
    srhClearPlaybackFeedback(art,{restoreBrand:true});
    status.textContent='Reproduzindo';
    applySavedPosition(video,entry?.position,'callback');
    if(image)image.classList.add('is-hidden');
    video.classList.remove('is-hidden');
    art.classList.add('is-playing');
  },err=>{
    if(image)image.classList.remove('is-hidden');
    video.classList.add('is-hidden');
    art.classList.remove('is-playing');
    srhShowProviderError(art,err);
    status.textContent='Falha: '+(err?.message||'mídia indisponível');
  });

  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};
  video.onpause=()=>persistProgress(video,{frame:true});
  video.onended=()=>{
    const cur=state.currentMedia;
    if(cur?.type==='vod'){markStandardTitleCompleted(cur,video.duration);clearContinueFrame(cur);removeContinueForEntry(cur)}
    else if(cur?.type==='series')finalizeSeriesEpisode(cur,video.duration);
    status.textContent='Finalizado';
  };

  actions.querySelector('[data-inline-close]').onclick=async e=>{
    e.stopPropagation();
    await srhFixStopInlineDetailVideo(true);
  };
  actions.querySelector('[data-inline-expand]').onclick=e=>{
    e.stopPropagation();
    toggleFullscreen(art);
  };
}
function openGeneralPlayer(url,title,entry=null){
  const detailOpen=!el.detailLayer.classList.contains('is-hidden');
  const inlineType=state.currentDetail?.type;
  if(detailOpen&&(inlineType==='vod'||inlineType==='live'))return srhFixInlinePlayer(url,title,entry);
  return srhFixOverlayPlayer(url,title,entry);
}
function openDetail(title){
  state.detailToken++;
  state.seriesPlayToken++;
  state.srhTmdbSeriesId=null;
  srhFixStopInlineDetailVideo(false);
  closePlayer(false);
  detailModal()?.classList.remove('is-series');
  el.detailHeadTitle.textContent='';
  el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';
  el.detailScroll.scrollTop=0;
  el.detailLayer.classList.remove('is-hidden');
  freezePage(true);
  state.currentDetail={title};
  state.srhDetailPackage=null;
  state.srhDetailBrandingToken=0;
  state.synopsisExpanded=false;
  state.synopsisText='';
  state.synopsisNode=null;
}
function waitDetailSkeletonPaint(token){
  return new Promise(resolve=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(isDetailCurrent(token))))
  })
}
function modalImageValue(...values){
  const visit=value=>{
    if(Array.isArray(value)){for(const x of value){const hit=visit(x);if(hit)return hit}return''}
    if(value&&typeof value==='object'){
      for(const k of ['url','path','file_path','backdrop','backdrop_path','cover_big','movie_image','cover','stream_icon']){const hit=visit(value[k]);if(hit)return hit}
      return''
    }
    const raw=String(value||'').trim();
    if(!raw)return'';
    if((raw.startsWith('[')||raw.startsWith('{'))){try{const hit=visit(JSON.parse(raw));if(hit)return hit}catch{}}
    if(/^\/\//.test(raw))return'https:'+raw;
    if(/^https?:\/\//i.test(raw)||/^data:image\//i.test(raw)||/^blob:/i.test(raw))return raw;
    if(raw.startsWith('/'))return normalizeServer(CONFIG.server)+raw;
    return raw
  };
  for(const value of values){const hit=visit(value);if(hit)return hit}
  return''
}
function preloadModalAsset(url,timeout=5200){
  const src=String(url||'').trim();if(!src)return Promise.resolve(false);
  return new Promise(resolve=>{
    const img=new Image();let done=false;
    const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(!!ok)};
    const timer=setTimeout(()=>finish(false),timeout);
    img.onload=()=>finish(true);img.onerror=()=>finish(false);img.src=src;
    if(img.complete)finish(img.naturalWidth>0)
  })
}
function managedImageCandidates(values){
  const out=[];
  const add=value=>{
    if(Array.isArray(value)){value.forEach(add);return}
    const src=modalImageValue(value);
    if(!src||src===IMAGE_PLACEHOLDER||out.includes(src))return;
    out.push(src)
  };
  add(values);
  return out
}
function applyManagedImageChain(img,candidates,{label='image',eager=false,onExhausted=null}={}){
  if(!(img instanceof HTMLImageElement))return false;
  const list=managedImageCandidates(candidates);
  img.dataset.srhImageChain='1';delete img.dataset.fallback;img.classList.remove('image-fallback');
  if(eager){try{img.loading='eager';img.fetchPriority='high'}catch{}}
  let index=0;
  const next=()=>{
    if(index>=list.length){
      img.onerror=null;img.dataset.srhImageChain='0';
      if(typeof onExhausted==='function'){try{onExhausted()}catch{}}
      if(!img.src||!String(img.src).includes(String(IMAGE_PLACEHOLDER).slice(0,32)))img.src=IMAGE_PLACEHOLDER;
      playbackDebug('image-chain-exhausted',{label,candidates:list.length});
      return false
    }
    const src=list[index++];
    img.dataset.srhImageChainIndex=String(index-1);
    img.onerror=()=>{playbackDebug('image-chain-fallback',{label,index:index-1});next()};
    img.src=src;
    return true
  };
  return next()
}
async function resolveModalDetailPackage(type,item,providerData){
  const kind=type==='series'?'tv':'movie',info=providerData?.info||{},movie=providerData?.movie_data||{},root=providerData||{};
  const providerBackdrop=modalImageValue(
    info.backdrop_path,info.backdrop,root.backdrop_path,root.backdrop,
    movie.backdrop_path,movie.backdrop,item?.backdrop_path,item?.backdrop
  );
  const providerCover=modalImageValue(
    info.cover_big,info.movie_image,info.cover,
    movie.movie_image,movie.stream_icon,movie.cover,
    item?.cover_big,item?.movie_image,item?.cover,item?.stream_icon
  );
  const providerTitle=stripEmoji(movie.name||info.name||info.title||itemTitle(item),'Sem título');
  const providerOverview=String(info.plot||info.description||movie.plot||movie.description||root.plot||root.description||item?.plot||item?.description||'').trim();
  const providerYear=String(info.year||String(info.releasedate||info.release_date||movie.year||movie.releasedate||item?.year||'').match(/\b(19|20)\d{2}\b/)?.[0]||'').trim();
  const rawVote=info.rating??info.vote_average??movie.rating??movie.vote_average??item?.rating??item?.vote_average;
  const providerVote=Number.isFinite(Number(rawVote))?Number(rawVote):null;
  let tmdb=null;
  try{tmdb=await resolveCatalogMetadata?.(kind,item,providerData)}catch(e){playbackDebug('detail-package-tmdb-fallback',{type,mediaId:String(itemId(item,type)||''),message:e?.message||String(e)})}
  const candidates=[
    {src:String(tmdb?.backdrop||'').trim(),source:'tmdb-backdrop'},
    {src:providerBackdrop,source:'provider-backdrop'},
    {src:String(tmdb?.poster||'').trim(),source:'tmdb-poster'},
    {src:providerCover,source:'provider-cover'}
  ].filter(x=>x.src);
  let art='',artSource='none';
  const logoCandidate=String(tmdb?.logo||'').trim();
  const [ready,logoReady]=await Promise.all([
    Promise.all(candidates.map(candidate=>preloadModalAsset(candidate.src))),
    logoCandidate?preloadModalAsset(logoCandidate,4200):Promise.resolve(false)
  ]);
  const chosenIndex=ready.findIndex(Boolean);
  if(chosenIndex>=0){art=candidates[chosenIndex].src;artSource=candidates[chosenIndex].source}
  else if(candidates[0]){art=candidates[0].src;artSource=candidates[0].source}
  const logo=logoCandidate&&logoReady?logoCandidate:'';
  const overview=String(tmdb?.overview||providerOverview||'').trim();
  const title=stripEmoji(tmdb?.title||providerTitle,'Sem título');
  const year=String(tmdb?.year||providerYear||'').trim();
  const vote=tmdb?.vote??providerVote??null;
  const brand={
    ...(tmdb||{}),
    id:tmdb?.id||String(info.tmdb_id||item?.tmdb_id||''),
    title,logo,backdrop:art,tmdbBackdrop:String(tmdb?.backdrop||'').trim(),overview,year,vote,
    posterHero:artSource==='provider-cover',
    artSource,providerBackdrop,providerCover,
    metadataVersion:Math.max(Number(tmdb?.metadataVersion||0),3)
  };
  playbackDebug('detail-package-ready',{
    type,mediaId:String(itemId(item,type)||''),artSource,logo:!!logo,
    overviewSource:tmdb?.overview?'tmdb':providerOverview?'provider':'none',
    overviewChars:Array.from(overview).length,tmdb:!!tmdb
  });
  return{art,artSource,title,overview,year,vote,logo,brand,tmdb}
}
async function closeDetail(){
  state.detailToken++;
  state.seriesPlayToken++;
  state.srhTmdbSeriesId=null;
  srhFixStopInlineDetailVideo(false);
  if(state.seriesVideo){
    state.seriesVideo.video.onpause=null;
    await persistProgress(state.seriesVideo.video,{frame:true});
    const video=state.seriesVideo.video;
    video.pause();
    destroyHls();
    video.onloadedmetadata=null;video.onerror=null;
    video.removeAttribute('src');video.load();
    state.seriesVideo=null;
    state.currentMedia=null;
  }
  el.detailLayer.classList.add('is-hidden');
  detailModal()?.classList.remove('is-series');
  state.currentDetail=null;
  state.currentSeries=null;
  state.srhDetailPackage=null;
  state.srhDetailBrandingToken=0;
  state.synopsisNode=null;
  state.synopsisText='';
  state.synopsisExpanded=false;
  detailModal()?.querySelector('.srh-resume-gate')?.remove();
  freezePage(!el.collectionView.classList.contains('is-hidden'));
  await leaveFullscreenPortrait();
}
/* SRHELL v6.6 — lightweight restoration of later UI organization.
   No MutationObserver, iframe favorites, extra transport or background network work. */
(function installLiteUiOrganization(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const FAVORITES_TAB_KEY=`srhell:${APP_NS}:standard:favorites:tab:v1`;
  const MIN_CONTINUE_SECONDS=60;
  function installPageZoomLock(){
    if(window.__srhZoomLock)return;
    window.__srhZoomLock=true;
    const style=document.createElement('style');
    style.textContent='html,body{touch-action:pan-x pan-y!important;-ms-touch-action:pan-x pan-y!important}';
    document.head.appendChild(style);
    const stop=e=>{e.preventDefault()};
    ['gesturestart','gesturechange','gestureend'].forEach(type=>document.addEventListener(type,stop,{passive:false}));
    document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
    document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)e.preventDefault()},{passive:false});
    document.addEventListener('keydown',e=>{
      if(!(e.ctrlKey||e.metaKey))return;
      if(['+','-','=','_','0'].includes(e.key))e.preventDefault();
    },true);
  }
  installPageZoomLock();
  if(!document.getElementById('srhContinueFrameStyle')){
    const s=document.createElement('style');s.id='srhContinueFrameStyle';
    s.textContent='body.srh-main-stream-style .home-status{height:0!important;min-height:0!important;margin:0!important;padding:0!important;line-height:0!important;overflow:hidden!important;opacity:0!important}body.srh-main-stream-style .stream-hero{margin-top:-12px!important}body.srh-main-stream-style .stream-hero__brand{opacity:0;transform:translate3d(0,14px,0);transition:opacity .42s ease,transform .52s cubic-bezier(.2,.72,.22,1);will-change:opacity,transform}body.srh-main-stream-style .stream-hero__brand.is-ready{opacity:1;transform:translate3d(0,0,0)}@media(prefers-reduced-motion:reduce){body.srh-main-stream-style .stream-hero__brand{transition:none;transform:none}}@media(max-width:680px){body.srh-main-stream-style .stream-hero__content{left:0!important;right:0!important;width:100%!important;max-width:none!important;padding-left:max(22px,env(safe-area-inset-left))!important;padding-right:max(22px,env(safe-area-inset-right))!important;box-sizing:border-box!important}body.srh-main-stream-style .stream-hero__brand,body.srh-main-stream-style .stream-hero__meta,body.srh-main-stream-style .stream-hero__plot,body.srh-main-stream-style .stream-hero__actions{max-width:100%!important}body.srh-main-stream-style .stream-hero__actions{padding-left:0!important}}.continue-card__media{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#080a0c;contain:layout paint style;isolation:isolate}.continue-card__media>img{display:block;width:100%!important;height:100%!important;aspect-ratio:auto!important;object-fit:cover!important;pointer-events:none}.continue-card__frame-video{position:absolute!important;inset:0!important;display:none!important;width:0!important;height:0!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}.srh-watched-note{margin:7px 0 12px;padding:8px 11px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.055);font-size:13px;font-weight:700;line-height:1.25;display:inline-flex;align-items:center;gap:6px}body.srh-main-stream-style,body.srh-main-stream-style *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}body.srh-main-stream-style input,body.srh-main-stream-style textarea,body.srh-main-stream-style [contenteditable="true"],body.srh-main-stream-style .detail-modal .synopsis,body.srh-main-stream-style .detail-modal .srh-full-title-reveal{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}';
    document.head.appendChild(s)
  }
  if(!window.__srhSelectionGuard){
    window.__srhSelectionGuard=true;
    const ALLOW_SELECT='input,textarea,[contenteditable="true"],.detail-modal .synopsis,.detail-modal .srh-full-title-reveal';
    const allowed=node=>{
      const elNode=node?.nodeType===1?node:node?.parentElement;
      return !!elNode?.closest?.(ALLOW_SELECT)
    };
    document.addEventListener('selectstart',e=>{if(!allowed(e.target))e.preventDefault()},true);
    document.addEventListener('copy',e=>{
      const sel=window.getSelection?.(),anchor=sel?.anchorNode;
      if(allowed(e.target)||allowed(anchor))return;
      e.preventDefault()
    },true)
  }
  const STAR='<svg class="srh-lite-icon srh-lite-icon--star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH='<svg class="srh-lite-icon srh-lite-icon--trash" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  const FAVORITES_MEMORY_KEY='__srhFavorites_'+APP_NS;
  function readFavorites(){return Array.isArray(window[FAVORITES_MEMORY_KEY])?window[FAVORITES_MEMORY_KEY].slice():[]}
  function clearDisposableStorage(){
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const k=localStorage.key(i)||'';
        if(/^srhell:tmdb:cache:/i.test(k))localStorage.removeItem(k);
      }
    }catch{}
  }
  function writeFavorites(list){const compact=(Array.isArray(list)?list:[]).slice(0,160);window[FAVORITES_MEMORY_KEY]=compact;void standardStateSet(FAVORITES_KEY,compact);return true}
  function favoriteKey(type,item){
    if(type==='live'){
      const id=item?.variants?.[0]?.stream_id||item?.variants?.[0]?.id||'';
      return 'live:'+(id||String(item?.baseName||'canal').toLocaleLowerCase('pt-BR'));
    }
    if(type==='series')return 'series:'+String(item?.series_id??item?.id??'');
    return 'vod:'+String(item?.stream_id??item?.id??'');
  }
  function compactFavorite(type,item){
    const key=favoriteKey(type,item);
    if(type==='live'){
      const variants=(item?.variants||[]).map(v=>({stream_id:v.stream_id??v.id,name:v.name||v.title||item.baseName,stream_icon:v.stream_icon||item.image||'',container_extension:v.container_extension||'',_quality:v._quality||'Padrão'}));
      return{key,type,title:item?.baseName||'Canal',image:item?.image||variants[0]?.stream_icon||'',item:{baseName:item?.baseName||'Canal',image:item?.image||'',variants}};
    }
    if(type==='series')return{key,type,title:itemTitle(item),image:imageFor(item,'series'),item:{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')}};
    return{key,type,title:itemTitle(item),image:imageFor(item,'vod'),item:{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod'),container_extension:item?.container_extension||'mp4'}};
  }
  function isFavorite(type,item){const key=favoriteKey(type,item);return readFavorites().some(x=>x.key===key)}
  function toggleFavorite(type,item){
    const entry=compactFavorite(type,item),list=readFavorites(),idx=list.findIndex(x=>x.key===entry.key);let active=false;
    if(idx>=0)list.splice(idx,1);else{list.unshift(entry);active=true}
    if(!writeFavorites(list)){toast('Não foi possível salvar Favoritos.');return isFavorite(type,item)}
    toast(active?'Adicionado aos Favoritos.':'Removido dos Favoritos.');
    if(state.srhFavoritesOpen){
      favoriteEntries=readFavorites();
      renderFavoriteType(favoriteTab);
    }
    return active;
  }
  window.__srhStandardFavorites={toggle:toggleFavorite,is:isFavorite};

  const CONT_MEMORY_KEY='__srhContinue_'+APP_NS;
  const contMemory=window[CONT_MEMORY_KEY]||(window[CONT_MEMORY_KEY]={vod:[],series:[]});
  const continueCardResources=new Set();
  const continueFrameUrlCache=new Map();
  const continueFrameUpgradeInflight=new Map();
  const continueArtMemory=new Map();
  const continueArtInflight=new Map();
  const CONTINUE_ART_VERSION=3;
  let continueFrameCardTail=Promise.resolve();
  window.__srhDropContinueFrameCache=(entry,key=continueFrameKey(entry))=>{
    const url=continueFrameUrlCache.get(key);
    if(url&&url.startsWith('blob:'))try{URL.revokeObjectURL(url)}catch{}
    continueFrameUrlCache.delete(key);
    continueFramePayloadMemory.delete(key)
  };

  function continueArtSignature(entry,type){
    const kind=type==='series'?'series':'vod',snap=entry?.itemSnapshot&&typeof entry.itemSnapshot==='object'?entry.itemSnapshot:{};
    if(kind==='series')return ['series',String(entry?.seriesId??snap.series_id??''),String(entry?.season??''),String(entry?.episodeNumber??''),String(snap.stream_id??entry?.streamId??'')].join(':');
    return ['vod',String(entry?.key||('vod:'+String(snap.stream_id??'')))].join(':')
  }
  function continueArtKey(entry,type){
    return 'srhell:'+APP_NS+':standard:continue-art:v'+CONTINUE_ART_VERSION+':'+standardProviderId()+':'+encodeURIComponent(continueArtSignature(entry,type))
  }
  function preloadContinueArt(url,timeout=5200){
    const src=String(url||'').trim();
    if(!src)return Promise.resolve(false);
    return new Promise(resolve=>{
      const img=new Image();let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(!!ok)};
      const timer=setTimeout(()=>finish(false),timeout);
      img.onload=()=>finish(img.naturalWidth>0&&img.naturalHeight>0);
      img.onerror=()=>finish(false);
      img.src=src;
      if(img.complete)finish(img.naturalWidth>0&&img.naturalHeight>0)
    })
  }
  async function readPreferredContinueArt(entry,type){
    const key=continueArtKey(entry,type),signature=continueArtSignature(entry,type);
    if(continueArtMemory.has(key))return continueArtMemory.get(key);
    const stored=await standardStateGet(key);
    if(!stored||Number(stored.version||0)!==CONTINUE_ART_VERSION||stored.signature!==signature||!stored.url)return null;
    const valid=await preloadContinueArt(stored.url,3200).catch(()=>false);
    if(!valid){void standardStateDelete(key);return null}
    continueArtMemory.set(key,stored);
    return stored
  }
  async function resolvePreferredContinueArt(entry,type){
    if(!entry||!['vod','series'].includes(type))return null;
    const key=continueArtKey(entry,type);
    if(continueArtInflight.has(key))return continueArtInflight.get(key);
    const job=(async()=>{
      const cached=await readPreferredContinueArt(entry,type).catch(()=>null);
      if(cached)return cached;
      const resolver=window.__srhResolveContinueTmdbArt;
      if(typeof resolver!=='function')return null;
      const resolved=await resolver(entry,type).catch(()=>null);
      const candidates=(Array.isArray(resolved?.candidates)?resolved.candidates:[resolved]).filter(x=>String(x?.url||'').trim());
      if(!candidates.length)return null;
      const ready=await Promise.all(candidates.map(x=>preloadContinueArt(String(x.url||''),5200).catch(()=>false)));
      const chosenIndex=ready.findIndex(Boolean);
      if(chosenIndex<0)return null;
      const chosen=candidates[chosenIndex],alternates=candidates.filter((_,i)=>i!==chosenIndex&&ready[i]).map(x=>({url:String(x.url||''),source:String(x.source||'fallback')}));
      const url=String(chosen.url||'').trim();
      const payload={version:CONTINUE_ART_VERSION,signature:continueArtSignature(entry,type),type,source:String(chosen?.source||resolved?.source||'tmdb'),url,alternates,tmdbId:String(resolved?.tmdbId||chosen?.tmdbId||''),season:String(resolved?.season??chosen?.season??''),episodeNumber:String(resolved?.episodeNumber??chosen?.episodeNumber??''),savedAt:Date.now()};
      const ok=await standardStateSet(key,payload);
      if(ok)continueArtMemory.set(key,payload);
      playbackDebug('continue-art-resolved',{type,key:entry.key,source:payload.source,tmdbId:payload.tmdbId,season:payload.season,episodeNumber:payload.episodeNumber,ok});
      return payload
    })().finally(()=>continueArtInflight.delete(key));
    continueArtInflight.set(key,job);
    return job
  }
  function purgeContinueFrameWorkers(){
    document.querySelectorAll('video.continue-card__frame-video,video.srh-resume-frame-worker').forEach(video=>{
      try{video.pause();video.removeAttribute('src');video.load();video.remove()}catch{}
    })
  }

  function releaseContinueCardResources(){
    for(const r of continueCardResources){
      try{r.hls?.destroy?.()}catch{}
      try{r.video?.pause?.();r.video?.removeAttribute?.('src');r.video?.load?.()}catch{}
      try{if(r.url)URL.revokeObjectURL(r.url)}catch{}
    }
    continueCardResources.clear()
  }

  function writeHistoryBucket(type,list){
    const bucket=type==='series'?'series':'vod',prev=Array.isArray(contMemory[bucket])?contMemory[bucket]:[],compact=(Array.isArray(list)?list:[]).slice(0,60);
    const keep=new Set(compact.map(continueIdentity));
    for(const row of prev){
      const identity=continueIdentity(row);
      if(identity&&!keep.has(identity)){
        const frameKey=row.frameKey||continueFrameKey(row),cachedUrl=continueFrameUrlCache.get(frameKey);
        if(cachedUrl&&cachedUrl.startsWith('blob:'))try{URL.revokeObjectURL(cachedUrl)}catch{}
        continueFrameUrlCache.delete(frameKey);
        continueFramePayloadMemory.delete(frameKey);
        void standardStateDelete(frameKey);
        const artKey=continueArtKey(row,bucket);
        continueArtMemory.delete(artKey);
        void standardStateDelete(artKey)
      }
    }
    contMemory[bucket]=compact;
    void standardStateSet(historyKey(bucket),compact);
    return true
  }

  const baseGetHistory=getHistory;
  getHistory=function(type){if(type==='live')return[];const bucket=type==='series'?'series':'vod';return Array.isArray(contMemory[bucket])?contMemory[bucket].slice():[]};

  saveHistory=function(entry){
    if(!entry||entry.type==='live')return false;
    const bucket=entry.type==='series'?'series':'vod',identity=continueIdentity(entry),current=getHistory(bucket);
    const previous=current.find(x=>continueIdentity(x)===identity)||null;
    const qualified=Number(entry.position)>=MIN_CONTINUE_SECONDS||!!previous?.resumeQualified||(entry.type==='series'&&!!previous);
    if(!qualified)return false;
    let list=current.filter(x=>continueIdentity(x)!==identity);
    if(previous&&bucket==='series'&&continueArtSignature(previous,'series')!==continueArtSignature(entry,'series')){
      const oldArtKey=continueArtKey(previous,'series');
      continueArtMemory.delete(oldArtKey);
      void standardStateDelete(oldArtKey)
    }
    const normalized={...entry,resumeQualified:true,frameKey:continueFrameKey(entry)};
    list.unshift(normalized);
    const ok=writeHistoryBucket(bucket,list);
    renderContinue();
    return ok;
  };

  removeHistory=function(key,type){
    if(type==='live')return false;
    const bucket=type==='series'?'series':'vod';
    const next=getHistory(bucket).filter(x=>x.key!==key);
    const ok=writeHistoryBucket(bucket,next);
    renderContinue();
    return ok;
  };

  function pruneShortContinueEntries(){for(const type of ['vod','series']){const list=getHistory(type),clean=list.filter(x=>Number(x.duration)>0&&(Number(x.position)>=MIN_CONTINUE_SECONDS||!!x.resumeQualified));if(clean.length!==list.length)writeHistoryBucket(type,clean)}}
  function legacyList(key){for(const store of [localStorage,sessionStorage])try{const raw=store.getItem(key);if(raw!==null){const rows=JSON.parse(raw||'[]');if(Array.isArray(rows))return rows}}catch{}return[]}
  function mergeRows(primary,legacy,type='vod'){
    const map=new Map();
    const rows=[...(Array.isArray(primary)?primary:[]),...(Array.isArray(legacy)?legacy:[])].sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0));
    for(const row of rows){
      const key=type==='series'?continueIdentity({...row,type:'series'}):String(row?.key||row?.id||'');
      if(!key||map.has(key))continue;
      map.set(key,row)
    }
    return[...map.values()]
  }
  async function migrateStableSeriesFrame(row){
    if(!row?.seriesId)return row;
    const stableKey=continueFrameKey({...row,type:'series'}),oldKey=String(row.frameKey||'');
    if(oldKey&&oldKey!==stableKey){
      const current=await standardStateGet(stableKey);
      if(!current){
        const legacy=await standardStateGet(oldKey);
        if(legacy)await standardStateSet(stableKey,legacy)
      }
    }
    return{...row,type:'series',frameKey:stableKey}
  }
  window.__srhHydrateStandardPersonal=async()=>{
    const dbFav=await standardStateGet(FAVORITES_KEY),legacyFav=legacyList(FAVORITES_KEY),fav=mergeRows(dbFav,legacyFav,'vod').slice(0,160);
    window[FAVORITES_MEMORY_KEY]=fav;void standardStateSet(FAVORITES_KEY,fav);
    for(const type of ['vod','series']){
      const key=historyKey(type),dbRows=await standardStateGet(key),legacy=legacyList(key);
      let rows=mergeRows(dbRows,legacy,type).sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0)).slice(0,60);
      if(type==='series')rows=await Promise.all(rows.map(migrateStableSeriesFrame));
      contMemory[type]=rows;void standardStateSet(key,rows);
      try{localStorage.removeItem(key);sessionStorage.removeItem(key)}catch{}
    }
    try{localStorage.removeItem(FAVORITES_KEY);sessionStorage.removeItem(FAVORITES_KEY)}catch{}
    pruneShortContinueEntries();
    purgeContinueFrameWorkers();
    setTimeout(()=>{
      const run=()=>migrateContinueFrames().catch(()=>{});
      if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:1800});
      else run()
    },700);
    return true
  };

  function startedEntry(type,item){
    if(type==='vod'){
      const key='vod:'+String(item?.stream_id??item?.id??'');
      return getHistory('vod').find(x=>x.key===key&&Number(x.position)>=MIN_CONTINUE_SECONDS&&Number(x.duration)>0)||null;
    }
    if(type==='series'){
      const sid=String(item?.series_id??item?.id??'');
      return getHistory('series').find(x=>String(x.seriesId??'')===sid&&Number(x.position)>=MIN_CONTINUE_SECONDS&&Number(x.duration)>0)||null;
    }
    return null;
  }
  function detachRemovedCurrentMedia(type,started,item){
    const media=state.currentMedia;
    if(!media)return;
    if(type==='vod'){
      if(media.key===started?.key)state.currentMedia=null;
      return;
    }
    if(type==='series'){
      const sid=String(started?.seriesId??item?.series_id??item?.id??'');
      if(String(media.seriesId??'')===sid)state.currentMedia=null;
    }
  }

  function removeStarted(type,item){
    const started=startedEntry(type,item);
    if(!started)return false;
    let ok=false;
    if(type==='vod'){
      /* Clear the active paused resume object before any pause/close handler can
         persist it again after deletion. */
      detachRemovedCurrentMedia('vod',started,item);
      ok=removeHistory(started.key,'vod');
      if(ok)renderContinue();
      toast(ok?'Filme removido de Continuar assistindo.':'Não foi possível remover o filme.');
      return ok;
    }
    if(type==='series'){
      const sid=String(started.seriesId??item?.series_id??item?.id??'');
      detachRemovedCurrentMedia('series',started,item);
      const next=getHistory('series').filter(x=>String(x.seriesId??'')!==sid);
      ok=writeHistoryBucket('series',next);
      if(ok)renderContinue();
      toast(ok?'Série removida de Continuar assistindo.':'Não foi possível remover a série.');
      return ok;
    }
    return false;
  }

  function actionButton(kind,type,item){
    const active=kind==='favorite'&&isFavorite(type,item),b=document.createElement('button');
    b.type='button';b.className='srh-lite-action srh-lite-action--'+kind+(active?' is-active':'');
    if(kind==='favorite'){
      b.setAttribute('aria-label',active?'Remover dos favoritos':'Adicionar aos favoritos');
      b.innerHTML=STAR;
      b.onclick=e=>{
        e.stopPropagation();
        const on=toggleFavorite(type,item);
        b.classList.toggle('is-active',on);
        b.setAttribute('aria-label',on?'Remover dos favoritos':'Adicionar aos favoritos');
      };
    }else{
      b.setAttribute('aria-label','Remover de Continuar assistindo');
      b.innerHTML=TRASH;
      b.onclick=e=>{
        e.stopPropagation();
        if(removeStarted(type,item))b.remove();
      };
    }
    return b;
  }
  function actionGroup(type,item){
    const g=document.createElement('div');g.className='srh-lite-actions';
    if((type==='vod'||type==='series')&&startedEntry(type,item))g.appendChild(actionButton('trash',type,item));
    g.appendChild(actionButton('favorite',type,item));
    return g;
  }
  function markModal(type){
    const modal=detailModal();if(!modal)return;
    modal.classList.remove('is-vod','is-series','is-live');
    modal.classList.add('is-'+type);
    el.detailHeadTitle.textContent='';
  }
  function decorateDetail(type,item){
    markModal(type);
    const body=el.detailBody,row=body.querySelector('.detail-title-row'),syn=body.querySelector('.synopsis');
    if(!row)return;
    row.querySelector('.srh-lite-actions')?.remove();
    body.querySelector('.srh-lite-film-actions')?.remove();
    if(type==='vod'){
      const watch=row.querySelector('.watch-button')||body.querySelector('.watch-button');
      if(watch)watch.remove();
      const actions=document.createElement('div');
      actions.className='srh-lite-film-actions';
      actions.appendChild(actionGroup(type,item));
      if(watch)actions.appendChild(watch);
      (syn||row).insertAdjacentElement('afterend',actions);
    }else{
      row.appendChild(actionGroup(type,item));
    }
    if(type==='series')body.querySelector('#seriesStop')?.remove();
  }

  /* Poster/card geometry only. Keep the stable virtualizers and simply restore 2:3 math. */
  RailVirtualizer.prototype.metrics=function(){
    const live=this.type==='live',w=innerWidth<680?(live?116:108):(live?146:132),gap=9,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));
    return{w,gap,slot,visible};
  };
  RailVirtualizer.prototype.render=function(force=false){
    const m=this.metrics(),ratio=this.type==='live'?1:1.5,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length,this.type].join(':');
    if(!force&&sig===this.sig)return;
    this.sig=sig;
    const h=Math.round(m.w*ratio);
    this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';
    this.track.style.height=h+'px';
    this.track.innerHTML=this.items.slice(start,end).map((item,off)=>cardHtml(item,this.type,'poster-card',start+off,(start+off)*m.slot,m.w).replace(/height:[^;"]+px/,`height:${h}px`)).join('');
    this.track.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type));
  };
  GridVirtualizer.prototype.metrics=function(){
    const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:10,live=this.type==='live',base=live?138:122,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(base+gap))),w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
    return{available,gap,cols,w,h,rowH};
  };

  function detailSkeleton(type){
    const title='<span class="srh-shimmer-line srh-shimmer-line--title"></span>';
    const synopsis='<div class="synopsis srh-skeleton-synopsis"><span class="srh-shimmer-line"></span><span class="srh-shimmer-line"></span><span class="srh-shimmer-line"></span></div>';
    const actions='<div class="srh-skeleton-actions"><span class="srh-shimmer-button"></span><span class="srh-shimmer-button"></span><span class="srh-shimmer-button srh-shimmer-button--wide"></span></div>';
    if(type==='live'){
      return '<div class="detail-content srh-modal-loading"><div class="detail-art srh-shimmer-block"></div><div class="detail-title-row">'+title+'</div><div class="quality-list srh-skeleton-quality"><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span></div></div>';
    }
    if(type==='series'){
      return '<div class="detail-content srh-modal-loading"><div class="series-static"><div class="detail-art srh-shimmer-block"></div><div class="detail-title-row">'+title+'<div class="srh-lite-actions"><span class="srh-shimmer-button"></span><span class="srh-shimmer-button"></span></div></div>'+synopsis+'<div class="season-box"><span class="season-trigger srh-shimmer-row"></span></div></div><div class="episode-container"><div class="episode-list srh-skeleton-episodes"><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span><span class="srh-shimmer-row"></span></div></div></div>';
    }
    return '<div class="detail-content srh-modal-loading"><div class="detail-art srh-shimmer-block"></div><div class="detail-title-row">'+title+'</div>'+synopsis+actions+'</div>';
  }

  const baseOpenDetail=openDetail;
  openDetail=function(title){
    const r=baseOpenDetail(title);
    const type=state.srhPendingDetailType||'';
    const modal=detailModal();
    modal?.classList.remove('is-vod','is-series','is-live');
    if(type){
      modal?.classList.add('is-'+type);
      el.detailBody.innerHTML=detailSkeleton(type);
    }
    return r;
  };
  const baseOpenFilm=openFilm;
  openFilm=async function(item){
    state.srhPendingDetailType='vod';
    const loading=baseOpenFilm(item),token=state.detailToken;
    state.srhPendingDetailType='';
    await loading;
    if(!isDetailCurrent(token))return;
    decorateDetail('vod',item);
    const pkg=state.srhDetailPackage;
    if(pkg?.token===token&&pkg.type==='vod'&&pkg.brand&&window.__srhInstallDetailBranding){
      window.__srhInstallDetailBranding('vod',item,pkg.brand);
      state.srhDetailBrandingToken=token
    }
  };
  const baseOpenSeries=openSeries;
  openSeries=async function(item,opts=null){
    state.srhPendingDetailType='series';
    const loading=baseOpenSeries(item,opts),token=state.detailToken;
    state.srhPendingDetailType='';
    await loading;
    if(!isDetailCurrent(token))return;
    decorateDetail('series',item);
    const pkg=state.srhDetailPackage;
    if(pkg?.token===token&&pkg.type==='series'&&pkg.brand&&window.__srhInstallDetailBranding){
      window.__srhInstallDetailBranding('series',item,pkg.brand);
      state.srhDetailBrandingToken=token
    }
  };
  const baseOpenLive=openLive;
  openLive=async function(group){
    state.srhPendingDetailType='live';
    const loading=baseOpenLive(group),token=state.detailToken;
    state.srhPendingDetailType='';
    const r=await loading;
    if(isDetailCurrent(token))decorateDetail('live',group);
    return r
  };

  /* Settings behaves as a dismissible popover: interactions inside it keep it open,
     while any pointer press elsewhere closes it. */
  if(!window.__srhSettingsClickAway){
    window.__srhSettingsClickAway=true;
    document.addEventListener('pointerdown',e=>{
      if(el.settingsPanel?.classList.contains('is-hidden'))return;
      const target=e.target;
      if(el.settingsPanel?.contains(target)||el.settingsButton?.contains(target))return;
      el.settingsPanel.classList.add('is-hidden');
    },true);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!el.settingsPanel?.classList.contains('is-hidden'))el.settingsPanel.classList.add('is-hidden');
    },true);
  }

  /* Stable rail loading: one category-map request per type, fixed-size shimmer
     placeholders, abortable content requests and one controlled retry. */
  const srhRailCategoryInflight=new Map();
  const srhRailScheduler={active:0,max:2,queue:[],seq:0};
  function pumpRailQueue(){
    while(srhRailScheduler.active<srhRailScheduler.max&&srhRailScheduler.queue.length){
      srhRailScheduler.queue.sort((a,b)=>(b.priority||0)-(a.priority||0)||(a.seq||0)-(b.seq||0));
      const job=srhRailScheduler.queue.shift();
      if(job.token!==state.renderToken){job.resolve([]);continue}
      srhRailScheduler.active++;
      Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{
        srhRailScheduler.active=Math.max(0,srhRailScheduler.active-1);
        pumpRailQueue();
      });
    }
  }
  function scheduleRailTask(task,token,priority=0){
    return new Promise((resolve,reject)=>{
      srhRailScheduler.queue.push({task,token,resolve,reject,priority:Number(priority)||0,seq:++srhRailScheduler.seq});
      pumpRailQueue();
    });
  }
  function railCardMetrics(type){
    /* Loading geometry mirrors the FINAL Main Stream cards only.
       Do not override RailVirtualizer here: the stable render path below
       computes its own height from the final metrics override. */
    const live=type==='live',mobile=innerWidth<680;
    const w=mobile?(live?124:116):(live?178:168);
    const gap=mobile?8:10,h=Math.round(w*(live?1:1.5));
    return{w,h,gap,slot:w+gap,live};
  }
  function railSkeletonMarkup(type){
    const m=railCardMetrics(type);
    const available=Math.max(260,document.documentElement.clientWidth-(innerWidth<680?24:40));
    const count=Math.max(3,Math.min(12,Math.ceil((available+m.gap)/m.slot)+1));
    /* Restore the proven skeleton mechanism: rail-skeleton-card is ONLY a
       loading placeholder. CSS owns the shimmer animation; it is never
       treated as a poster-card and never participates in the virtualizer. */
    const card='<span class="rail-skeleton-card" aria-hidden="true" style="box-sizing:border-box;border:0;border-radius:7px;overflow:hidden"></span>';
    return '<div class="rail-skeleton-row rail-skeleton-row--'+(m.live?'live':'poster')+'" style="--sk-w:'+m.w+'px;--sk-h:'+m.h+'px;gap:'+m.gap+'px;height:'+m.h+'px;min-height:'+m.h+'px;max-height:'+m.h+'px">'+Array.from({length:count},()=>card).join('')+'</div>';
  }
  function railFetchJson(params,timeout=7200,opts=null){
    const target=apiUrl(params,CONFIG);
    const urls=[target];
    if(CONFIG.corsProxy)urls.push(proxyUrl(target,CONFIG));
    let index=0,last=null;
    const next=async()=>{
      if(index>=urls.length)throw(last||new Error('Falha ao carregar categoria.'));
      const url=urls[index++];
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),timeout);
      try{
        const r=await fetch(url,{cache:'no-store',signal:ctrl.signal,srhBypassCircuit:true,...(opts?.probe?{srhProbe:true}:{})});
        if(!r.ok)throw new Error('HTTP '+r.status);
        return await r.json();
      }catch(e){last=e;return next()}
      finally{clearTimeout(timer)}
    };
    return next();
  }
  async function stableRailCategoryMap(type){
    if(state.categoryMaps.has(type))return state.categoryMaps.get(type);
    if(srhRailCategoryInflight.has(type))return srhRailCategoryInflight.get(type);
    const p=railFetchJson({action:TYPE[type].categories},6500).then(raw=>{
      const map=buildCategoryLookup(raw);
      state.categoryMaps.set(type,map);
      return map;
    }).finally(()=>srhRailCategoryInflight.delete(type));
    srhRailCategoryInflight.set(type,p);
    return p;
  }
  const catalogInflight=new Map(),catalogCache=new Map();
  function rememberCatalog(key,items){
    if(items.length>4000)return;
    catalogCache.delete(key);
    catalogCache.set(key,{items,at:Date.now()});
    let size=[...catalogCache.values()].reduce((n,entry)=>n+entry.items.length,0);
    while(catalogCache.size>4||size>4000){
      const first=catalogCache.keys().next().value;
      size-=catalogCache.get(first).items.length;
      catalogCache.delete(first);
    }
  }
  loadTargetItems=async function(target,token=state.renderToken,opts=null){
    if(token!==state.renderToken)return[];
    let id=targetId(target),allowed=configuredTargetIds(target?.type);
    if(id&&allowed.size&&!allowed.has(id))throw new Error('Categoria fora do escopo configurado.');
    if(!id){
      const map=await stableRailCategoryMap(target.type),name=String(target?.name||'');
      if(map.__duplicates?.has(name))throw new Error('Categoria ambígua no HTML legado: '+stripEmoji(name)+'.');
      id=map.get(name)
    }
    if(token!==state.renderToken)return[];
    if(!id)throw new Error('Categoria não encontrada: '+stripEmoji(target.name));
    const key=target.type+':'+id,cached=catalogCache.get(key);
    if(cached&&Date.now()-cached.at<240000){
      catalogCache.delete(key);catalogCache.set(key,cached);
      return cached.items;
    }
    catalogCache.delete(key);
    const flightKey=token+':'+key+':'+(opts?.probe?'probe':'ui');
    if(catalogInflight.has(flightKey))return catalogInflight.get(flightKey);
    const pending=scheduleRailTask(async()=>{
      if(token!==state.renderToken)return[];
      const raw=await railFetchJson({action:TYPE[target.type].content,category_id:id},10500,{probe:!!opts?.probe});
      if(!Array.isArray(raw))throw new Error('A categoria retornou dados inválidos.');
      const scoped=scopeCategoryItems(raw,target.type,id);
      if(token===state.renderToken)rememberCatalog(key,scoped);
      return scoped;
    },token,Number(opts?.priority)||0).finally(()=>catalogInflight.delete(flightKey));
    catalogInflight.set(flightKey,pending);
    return pending;
  };
  function mountRailItems(section,target,items){
    const body=section.querySelector('.rail-body');
    body.innerHTML='<div class="rail-viewport"><div class="rail-track"></div></div>';
    const v=new RailVirtualizer(section,target.type,items,openItem);
    section._railV=v;
    state.railInstances.push(v);
    section.querySelector('[data-all]').onclick=()=>openCollection(target.name,target.type,items);
  }
  const railRecoveryTimers=new WeakMap();
  function scheduleRailRecovery(section,target,token,attempt=1){
    const previous=railRecoveryTimers.get(section);if(previous)clearTimeout(previous);
    if(attempt>3||token!==state.renderToken)return;
    const delay=attempt===1?1600:attempt===2?4200:8500;
    const timer=setTimeout(()=>{
      railRecoveryTimers.delete(section);
      if(token!==state.renderToken||state.collectionOpen||!section?.isConnected)return;
      if(section._railV)return;
      const body=section.querySelector('.rail-body');if(!body)return;
      body.innerHTML=railSkeletonMarkup(target.type);
      renderRail(section,target,token,{recoveryAttempt:attempt}).catch(()=>{})
    },delay);
    railRecoveryTimers.set(section,timer)
  }
  renderRail=async function(section,target,token,opts=null){
    if(token!==state.renderToken)return;
    const body=section.querySelector('.rail-body');
    body.innerHTML=railSkeletonMarkup(target.type);
    let error=null;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const raw=await loadTargetItems(target,token,{priority:opts?.recoveryAttempt?5:0});
        if(token!==state.renderToken)return;
        const items=target.type==='live'?groupChannels(raw):uniqueById(raw,target.type);
        if(!items.length){
          body.innerHTML='<div class="skeleton">Sem conteúdos nesta categoria.</div>';
          return;
        }
        const timer=railRecoveryTimers.get(section);if(timer){clearTimeout(timer);railRecoveryTimers.delete(section)}
        mountRailItems(section,target,items);
        playbackDebug('catalog-rail-ready',{type:target.type,categoryId:targetId(target),recoveryAttempt:Number(opts?.recoveryAttempt||0),items:items.length});
        return;
      }catch(e){
        error=e;
        if(token!==state.renderToken)return;
        if(attempt<2){
          await new Promise(resolve=>setTimeout(resolve,attempt===0?360:920));
          body.innerHTML=railSkeletonMarkup(target.type)
        }
      }
    }
    if(token!==state.renderToken)return;
    const recoveryAttempt=Number(opts?.recoveryAttempt||0);
    body.innerHTML='<div class="rail-load-error"><span>Categoria aguardando nova tentativa.</span><button type="button">Tentar agora</button></div>';
    body.querySelector('button').onclick=()=>{
      const timer=railRecoveryTimers.get(section);if(timer)clearTimeout(timer);
      railRecoveryTimers.delete(section);
      section.dataset.loaded='1';
      renderRail(section,target,state.renderToken,{recoveryAttempt:Math.max(1,recoveryAttempt)}).catch(()=>{})
    };
    playbackDebug('catalog-rail-retry',{type:target.type,categoryId:targetId(target),attempt:recoveryAttempt+1,message:error?.message||String(error||'')});
    scheduleRailRecovery(section,target,token,recoveryAttempt+1)
  };
  evictRail=function(section){
    if(!section||section.dataset.loaded!=='1'||state.collectionOpen)return;
    const v=section._railV;
    if(v){
      v.destroy();
      state.railInstances=state.railInstances.filter(x=>x!==v);
      section._railV=null;
    }
    const timer=railRecoveryTimers.get(section);if(timer){clearTimeout(timer);railRecoveryTimers.delete(section)}
    const idx=Number(section.dataset.target);
    const target=targetsFor(state.activeType)[idx];
    section.querySelector('.rail-body').innerHTML=railSkeletonMarkup(target?.type||state.activeType);
    delete section.dataset.loaded;
    state.categoryObserver?.observe(section);
  };
  const baseRenderActiveType=renderActiveType;
  renderActiveType=function(){
    srhRailScheduler.queue.splice(0).forEach(job=>job.resolve([]));
    el.content.querySelectorAll('.rail-section').forEach(section=>{const timer=railRecoveryTimers.get(section);if(timer)clearTimeout(timer)});
    baseRenderActiveType();
    const targets=targetsFor(state.activeType);
    el.content.querySelectorAll('.rail-section').forEach(section=>{
      const target=targets[Number(section.dataset.target)];
      const body=section.querySelector('.rail-body');
      if(target&&body&&!section.dataset.loaded)body.innerHTML=railSkeletonMarkup(target.type);
    });
  };

  /* Favorites has its own tab state and remains mounted behind detail modals.
     Closing a favorite returns to Favorites, never to a destroyed home grid. */
  const head=el.collectionTitle?.parentElement;
  const favTabs=document.createElement('div');
  favTabs.className='srh-favorites-tabs is-hidden';
  favTabs.innerHTML='<button class="srh-favorites-tab" data-fav-type="live">Ao vivo</button><button class="srh-favorites-tab" data-fav-type="vod">Filmes</button><button class="srh-favorites-tab" data-fav-type="series">Séries</button>';
  head?.insertAdjacentElement('afterend',favTabs);
  let favoriteEntries=[];
  let favoriteTab;
  try{favoriteTab=localStorage.getItem(FAVORITES_TAB_KEY)}catch{}
  if(!['live','vod','series'].includes(favoriteTab))favoriteTab='vod';

  function renderFavoriteType(type){
    if(!['live','vod','series'].includes(type))type='vod';
    favoriteTab=type;
    try{localStorage.setItem(FAVORITES_TAB_KEY,type)}catch{}
    state.gridInstance?.destroy();
    state.gridInstance=null;
    el.collectionSpacer.innerHTML='';
    el.collectionSpacer.style.height='';
    favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.favType===type));
    const list=favoriteEntries.filter(x=>x.type===type);
    if(!list.length){
      el.collectionSpacer.innerHTML='<div class="srh-favorites-empty">Nenhum favorito nesta seção.</div>';
      el.collectionScroller.scrollTop=0;
      return;
    }
    const items=list.map(x=>x.item);
    state.gridInstance=new GridVirtualizer(
      el.collectionScroller,
      el.collectionSpacer,
      type,
      items,
      (item,itemType)=>openItem(item,itemType)
    );
    el.collectionScroller.scrollTop=0;
  }

  function openFavorites(){
    clearTimeout(state.searchTimer);++state.renderToken;
    closeDetail();
    closePlayer(false);
    state.searchDataset=null;
    state.searchType=null;
    state.gridInstance?.destroy();
    state.gridInstance=null;
    el.collectionSpacer.innerHTML='';
    el.collectionSpacer.style.height='';
    favoriteEntries=readFavorites();
    el.collectionTitle.textContent='Favoritos';
    el.collectionView.classList.remove('is-hidden');
    state.collectionOpen=true;
    state.srhFavoritesOpen=true;
    freezePage(true);
    favTabs.classList.remove('is-hidden');
    renderFavoriteType(favoriteTab);
  }

  favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.onclick=()=>renderFavoriteType(b.dataset.favType));

  const baseOpenCollection=openCollection;
  openCollection=function(title,type,items){
    state.srhFavoritesOpen=false;
    favTabs.classList.add('is-hidden');
    return baseOpenCollection(title,type,items);
  };

  const baseCloseCollection=closeCollection;
  closeCollection=function(rebuild=true){
    state.srhFavoritesOpen=false;
    favTabs.classList.add('is-hidden');
    return baseCloseCollection(rebuild);
  };

  if(!document.getElementById('favoritesTopButton')){
    const b=document.createElement('button');
    b.type='button';b.className='icon-button';b.id='favoritesTopButton';b.setAttribute('aria-label','Favoritos');b.innerHTML=STAR;b.onclick=openFavorites;
    el.searchButton.insertAdjacentElement('afterend',b);
  }

  /* Continue watching opens the same full detail modal used by catalog items.
     The saved time is used to seek the media and freeze the exact frame in-place;
     no image/video frame bytes are stored in localStorage. */
  function historyVodItem(entry){const raw=String(entry?.key||'').split(':')[1]||'',snap=entry?.itemSnapshot&&typeof entry.itemSnapshot==='object'?entry.itemSnapshot:{},ext=String(entry?.containerExtension||snap.container_extension||'mp4').toLowerCase();return{...snap,stream_id:raw,name:entry?.title||snap.name||'Filme',stream_icon:entry?.image||snap.stream_icon||snap.movie_image||'',container_extension:ext}}
  function historySeriesItem(entry){const snap=entry?.itemSnapshot&&typeof entry.itemSnapshot==='object'?entry.itemSnapshot:{},name=String(entry?.title||snap.name||'Série').replace(/\s+[—-]\s+Epis[oó]dio\s+\d+.*$/i,'').trim()||'Série';return{...snap,series_id:entry?.seriesId||snap.series_id,name,cover:entry?.image||snap.cover||snap.movie_image||''}}
  function beginResumeGate(){
    const modal=detailModal();
    if(!modal)return()=>{};
    modal.querySelector('.srh-resume-gate')?.remove();
    const gate=document.createElement('div');
    gate.className='srh-resume-gate';
    gate.innerHTML='<div class="srh-resume-gate__art"></div><div class="srh-resume-gate__line"></div><div class="srh-resume-gate__line"></div><div class="srh-resume-gate__line"></div><div class="srh-resume-gate__actions"><span class="srh-resume-gate__button"></span><span class="srh-resume-gate__button"></span><span class="srh-resume-gate__button"></span></div>';
    modal.appendChild(gate);
    let done=false;
    const release=()=>{if(done)return;done=true;gate.remove()};
    setTimeout(release,8500);
    return release;
  }

  function waitForSavedFrame(video,position,onDone){
    return new Promise(resolve=>{
      if(!video||!(Number(position)>0)){onDone?.();resolve();return}
      const target=Math.max(0,Number(position)||0);
      let finished=false,timer=0;
      const finish=()=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        try{video.pause()}catch{}
        try{video.muted=false}catch{}
        const final=()=>{onDone?.();resolve()};
        if(typeof video.requestVideoFrameCallback==='function'){
          let fired=false;
          try{
            video.requestVideoFrameCallback(()=>{if(fired)return;fired=true;final()});
            setTimeout(()=>{if(fired)return;fired=true;final()},260);
            return;
          }catch{}
        }
        requestAnimationFrame(()=>requestAnimationFrame(final));
      };
      const seek=()=>{
        try{
          const end=Number.isFinite(video.duration)&&video.duration>0?Math.max(0,video.duration-.35):target;
          const at=Math.min(target,end);
          if(Math.abs((video.currentTime||0)-at)<.65&&video.readyState>=2){finish();return}
          video.currentTime=at;
        }catch{}
      };
      try{video.muted=true}catch{}
      video.addEventListener('loadedmetadata',seek,{once:true});
      video.addEventListener('seeked',finish,{once:true});
      timer=setTimeout(()=>{seek();setTimeout(finish,350)},6200);
      if(video.readyState>=1)seek();
    });
  }

  function clearResumePreview(){
    const p=state.srhResumePreview;
    if(!p)return;
    state.srhResumePreview=null;
    try{p.hls?.destroy?.()}catch{}
    try{p.video?.pause?.();p.video?.removeAttribute?.('src');p.video?.load?.()}catch{}
    try{if(p.url)URL.revokeObjectURL(p.url)}catch{}
    try{if(p.owned)p.video?.remove?.()}catch{}
  }
  const resumeBaseOpenDetail=openDetail;
  openDetail=function(title){clearResumePreview();return resumeBaseOpenDetail(title)};
  const resumeBaseCloseDetail=closeDetail;
  closeDetail=async function(){
    clearResumePreview();
    state.srhContinueOpening=false;
    state.srhOpeningContinue=false;
    state.srhContinueFramePromise=null;
    state.srhContinueFrameUrl='';
    el.detailLayer.style.removeProperty('visibility');
    el.detailLayer.style.removeProperty('pointer-events');
    return resumeBaseCloseDetail.apply(this,arguments)
  };

  function holdContinueDetail(){
    el.detailLayer.style.setProperty('visibility','hidden','important');
    el.detailLayer.style.setProperty('pointer-events','none','important');
    let done=false;
    return()=>{
      if(done)return;done=true;
      requestAnimationFrame(()=>{
        el.detailLayer.style.removeProperty('visibility');
        el.detailLayer.style.removeProperty('pointer-events')
      })
    }
  }

  function seekPreviewFrame(video,position,timeout=5200){
    return new Promise(resolve=>{
      let done=false,timer=0;
      const target=Math.max(0,Number(position)||0);
      const finish=ok=>{
        if(done)return;done=true;clearTimeout(timer);
        video.removeEventListener('seeked',onSeek);video.removeEventListener('loadeddata',onData);
        try{video.pause()}catch{}
        const final=()=>resolve(!!ok);
        if(ok&&typeof video.requestVideoFrameCallback==='function'){
          let fired=false;
          try{video.requestVideoFrameCallback(()=>{if(!fired){fired=true;final()}});setTimeout(()=>{if(!fired){fired=true;final()}},180);return}catch{}
        }
        requestAnimationFrame(()=>requestAnimationFrame(final))
      };
      const onSeek=()=>{if(video.readyState>=2&&Math.abs((Number(video.currentTime)||0)-target)<1.35)finish(true)};
      const onData=()=>{if(Math.abs((Number(video.currentTime)||0)-target)<1.35)finish(true)};
      const seek=()=>{try{const end=Number.isFinite(video.duration)&&video.duration>0?Math.max(0,video.duration-.35):target;video.currentTime=Math.min(target,end)}catch{finish(false)}};
      video.addEventListener('seeked',onSeek);
      video.addEventListener('loadeddata',onData);
      timer=setTimeout(()=>finish(video.readyState>=2&&Math.abs((Number(video.currentTime)||0)-target)<1.8),timeout);
      if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});
    })
  }

  async function loadIsolatedFrame(video,sources,position,timeout=5200){
    const queue=mediaCandidates(Array.isArray(sources)?sources:[sources]);
    video.autoplay=false;video.muted=true;video.controls=false;video.playsInline=true;video.preload='metadata';
    for(const src of queue){
      if(!src)continue;
      const kind=mediaKind(src);
      if(kind==='mpegts'||kind==='m2ts')continue;
      let hls=null;
      try{
        video.pause();video.removeAttribute('src');video.load();
        if(kind==='hls'){
          const native=!!(video.canPlayType?.('application/vnd.apple.mpegurl')||video.canPlayType?.('application/x-mpegURL'));
          if(!native){playbackDebug('background-hls-skip',{reason:'native-hls-unavailable',origin:mediaOrigin(src)});continue}
          video.src=src;video.load()
        }else{video.src=src;video.load()}
        const ok=await seekPreviewFrame(video,position,timeout);
        if(ok){try{hls?.stopLoad?.()}catch{}return{ok:true,hls,src}}
        try{hls?.destroy?.()}catch{}
      }catch{try{hls?.destroy?.()}catch{}}
    }
    return{ok:false,hls:null,src:''}
  }

  async function loadResumePreview(video,sources,position){
    const queue=uniqueMediaUrls([...(state.currentMedia?.lastWorkingUrl?[state.currentMedia.lastWorkingUrl]:[]),...(Array.isArray(sources)?sources:[sources])]);
    const result=await loadIsolatedFrame(video,queue,position,6200);
    if(result.ok){
      state.srhResumePreview={video,hls:result.hls,owned:video.classList.contains('srh-resume-preview-video')};
      return true
    }
    return false
  }

  async function readContinueFrame(entry){
    const key=entry?.frameKey||continueFrameKey(entry);
    if(continueFramePayloadMemory.has(key))return continueFramePayloadMemory.get(key);
    const payload=await standardStateGet(key);
    if(!payload||Number(payload.version||0)!==CONTINUE_FRAME_VERSION)return null;
    continueFramePayloadMemory.set(key,payload);
    return payload
  }
  function isExactFramePayload(payload){return exactContinueFramePayload(payload)}
  function frameTargetPosition(entry,payload){
    const pending=Number(payload?.pendingPosition);
    if(Number.isFinite(pending)&&pending>0)return pending;
    const current=Number(entry?.position);
    if(Number.isFinite(current)&&current>0)return current;
    return Math.max(0,Number(payload?.position)||0)
  }
  function isFrameFreshForEntry(payload,entry){
    if(!isExactFramePayload(payload))return false;
    const expectedMedia=continueFrameMediaKey(entry),storedMedia=String(payload?.mediaKey||'');
    if(expectedMedia&&storedMedia!==expectedMedia)return false;
    const stored=Math.max(0,Number(payload?.position)||0),target=frameTargetPosition(entry,payload);
    if(String(payload?.pendingMediaKey||'')&&String(payload.pendingMediaKey)!==expectedMedia)return false;
    if(Number(payload?.pendingPosition)>0&&Math.abs(Number(payload.pendingPosition)-stored)>1.5)return false;
    return !(target>0&&Math.abs(target-stored)>2.5)
  }
  function frameProxyCandidates(sources){
    if(!CONFIG.corsProxy)return[];
    const out=[];
    for(const src of sources){
      if(!/^https?:\/\//i.test(String(src||'')))continue;
      try{const p=proxyUrl(src,CONFIG);if(p&&p!==src)out.push(p)}catch{}
    }
    return uniqueMediaUrls(out)
  }

  async function ensureContinueFrameRecord(entry,type){
    if(!entry)return null;
    const existing=await readContinueFrame(entry);
    if(isFrameFreshForEntry(existing,entry))return existing;
    const target=frameTargetPosition(entry,existing);
    const normalized={...entry,position:target,type:type==='series'?'series':'vod',frameKey:continueFrameKey({...entry,type:type==='series'?'series':'vod'})};
    const direct=uniqueMediaUrls([
      normalized?.lastWorkingUrl,existing?.pendingSource,
      ...continueFrameSources(normalized),
      ...(existing?.pendingSources||[]),existing?.source,...(existing?.sources||[])
    ]);
    if(!direct.length)return existing||null;
    const proxied=frameProxyCandidates(direct).slice(0,2),groups=[];
    if(location.protocol==='file:'&&proxied.length)groups.push({name:'cors-proxy',sources:proxied,cors:true});
    groups.push({name:'direct-cors',sources:direct.slice(0,2),cors:true});
    if(location.protocol!=='file:'&&proxied.length)groups.push({name:'cors-proxy',sources:proxied,cors:true});
    for(const group of groups){
      const video=document.createElement('video');
      video.className='srh-resume-frame-worker';video.dataset.srhBackgroundMedia='1';
      video.muted=true;video.playsInline=true;video.preload='metadata';
      if(group.cors)video.crossOrigin='anonymous';
      let result=null;
      try{
        result=await loadIsolatedFrame(video,group.sources,target,5600);
        if(!result.ok)continue;
        const dataUrl=captureContinueFrameDataUrl(video);
        if(!dataUrl){
          playbackDebug('continue-frame-capture-skip',{type,key:entry.key,path:group.name,reason:'canvas-unavailable',position:target});
          continue
        }
        const payload={version:CONTINUE_FRAME_VERSION,kind:'data-url',dataUrl,position:Number(video.currentTime)||target,mediaKey:continueFrameMediaKey(normalized),capturedAt:Date.now(),migrated:true,capturePath:group.name};
        const ok=await standardStateSet(normalized.frameKey,payload);
        if(ok)continueFramePayloadMemory.set(normalized.frameKey,payload);
        if(entry.frameKey!==normalized.frameKey){
          const bucket=type==='series'?'series':'vod',rows=getHistory(bucket).map(row=>continueIdentity(row)===continueIdentity(normalized)?{...row,frameKey:normalized.frameKey,frameVersion:CONTINUE_FRAME_VERSION}:row);
          contMemory[bucket]=rows;void standardStateSet(historyKey(bucket),rows)
        }
        playbackDebug('continue-frame-migrate',{type,key:entry.key,kind:'data-url',position:payload.position,path:group.name,ok});
        if(ok)setTimeout(()=>{if(!state.playerActive&&state.activeType===type)renderContinue()},40);
        return payload
      }finally{
        try{result?.hls?.destroy?.()}catch{}
        try{video.pause();video.removeAttribute('src');video.load()}catch{}
      }
    }
    return existing||null
  }
  function ensureContinueFrameOnce(entry,type){
    const key=continueFrameKey({...entry,type:type==='series'?'series':'vod'});
    if(continueFrameUpgradeInflight.has(key))return continueFrameUpgradeInflight.get(key);
    const job=ensureContinueFrameRecord(entry,type).finally(()=>continueFrameUpgradeInflight.delete(key));
    continueFrameUpgradeInflight.set(key,job);
    return job
  }
  window.__srhUpgradeContinueFrame=entry=>ensureContinueFrameOnce(entry,entry?.type||'vod');

  let continueMigrationTimer=0,continueMigrationRunning=false;
  function scheduleContinueFrameMigration(delay=900){
    clearTimeout(continueMigrationTimer);
    continueMigrationTimer=setTimeout(()=>{
      const run=()=>migrateContinueFrames().catch(()=>{});
      if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:1800});
      else run()
    },Math.max(0,delay))
  }
  async function migrateContinueFrames(){
    if(continueMigrationRunning)return false;
    continueMigrationRunning=true;
    let interrupted=false;
    try{
      const first=state.activeType==='series'?'series':'vod',types=first==='series'?['series','vod']:['vod','series'],rows=[];
      for(const type of types){
        for(const entry of getHistory(type).filter(x=>Number(x.duration)>0&&(Number(x.position)>=MIN_CONTINUE_SECONDS||!!x.resumeQualified)).slice(0,12))rows.push({type,entry})
      }
      for(const row of rows){
        if(state.playerActive||!el.detailLayer.classList.contains('is-hidden')){interrupted=true;break}
        const preferred=await resolvePreferredContinueArt(row.entry,row.type).catch(()=>null);
        if(!preferred){
          const payload=await readContinueFrame(row.entry);
          if(!isFrameFreshForEntry(payload,row.entry))await ensureContinueFrameOnce(row.entry,row.type).catch(()=>null)
        }
        await new Promise(resolve=>setTimeout(resolve,90))
      }
    }finally{
      continueMigrationRunning=false;
      if(interrupted)scheduleContinueFrameMigration(2400)
    }
    if(['vod','series'].includes(state.activeType))renderContinue();
    return true
  }

  function queueContinueCardFrame(task){
    continueFrameCardTail=continueFrameCardTail.catch(()=>{}).then(task);
    return continueFrameCardTail
  }

  function storedFrameUrl(entry,payload){
    if(!payload)return'';
    if(payload.kind==='data-url'&&payload.dataUrl)return String(payload.dataUrl);
    if(payload.kind==='blob'&&payload.blob instanceof Blob){
      const key=entry?.frameKey||continueFrameKey(entry);
      let url=continueFrameUrlCache.get(key);
      if(!url){url=URL.createObjectURL(payload.blob);continueFrameUrlCache.set(key,url)}
      return url
    }
    return''
  }

  function applyFrameToContinueCard(card,entry,type,payload){
    if(!isFrameFreshForEntry(payload,entry)||!card?.isConnected)return false;
    const img=card.querySelector('.continue-card__media img'),url=storedFrameUrl(entry,payload);
    if(!url||!img)return false;
    img.onerror=null;img.src=url;card.dataset.srhContinueArt='exact-frame';
    playbackDebug('continue-frame-use',{type,key:entry.key,target:'card',kind:payload.kind,fresh:true});
    return true
  }
  function applyPreferredArtToContinueCard(card,entry,type,art){
    if(!art?.url||!card?.isConnected)return false;
    const img=card.querySelector('.continue-card__media img');if(!img)return false;
    const chain=[art.url,...(Array.isArray(art.alternates)?art.alternates.map(x=>x?.url):[])];
    applyManagedImageChain(img,chain,{label:'continue-'+type,eager:true,onExhausted:()=>{
      const artKey=continueArtKey(entry,type);
      continueArtMemory.delete(artKey);
      void standardStateDelete(artKey);
      card.dataset.srhContinueArt='';
      void hydrateContinueFrameFallback(card,entry,type)
    }});
    card.dataset.srhContinueArt=art.source||'tmdb';
    playbackDebug('continue-art-use',{type,key:entry.key,target:'card',source:art.source||'tmdb',alternates:Math.max(0,chain.length-1)});
    return true
  }
  async function hydrateContinueFrameFallback(card,entry,type){
    if(!card?.isConnected)return false;
    const payload=await readContinueFrame(entry).catch(()=>null);
    if(applyFrameToContinueCard(card,entry,type,payload))return true;
    const updated=await queueContinueCardFrame(()=>ensureContinueFrameOnce(entry,type)).catch(()=>null);
    return applyFrameToContinueCard(card,entry,type,updated)
  }
  async function hydrateContinueCard(card,entry,type){
    if(!card?.isConnected)return;
    const cached=await readPreferredContinueArt(entry,type).catch(()=>null);
    if(cached&&applyPreferredArtToContinueCard(card,entry,type,cached))return;
    const framePromise=hydrateContinueFrameFallback(card,entry,type).catch(()=>false);
    const preferred=await resolvePreferredContinueArt(entry,type).catch(()=>null);
    if(!card?.isConnected)return;
    if(preferred){applyPreferredArtToContinueCard(card,entry,type,preferred);return}
    await framePromise
  }

  function useStoredFrameImage(image,entry,payload){
    if(!image||!payload)return false;
    const url=storedFrameUrl(entry,payload);
    if(!url)return false;
    image.src=url;
    image.classList.remove('is-hidden');
    playbackDebug('continue-frame-use',{type:entry?.type||'',key:entry?.key||'',target:'modal',kind:payload.kind,fresh:isFrameFreshForEntry(payload,entry)});
    return true
  }

  function refreshModalFrame(entry,type,token,image){
    const seed=continueFramePayloadMemory.get(entry?.frameKey||continueFrameKey(entry))||null;
    if(isFrameFreshForEntry(seed,entry))return Promise.resolve(seed);
    return ensureContinueFrameOnce(entry,type).then(updated=>{
      if(isDetailCurrent(token)&&isExactFramePayload(updated))useStoredFrameImage(image,{...entry,type},updated);
      return updated
    }).catch(()=>null)
  }

  async function openContinueMovie(entry){
    const item=historyVodItem(entry);
    if(!item.stream_id)return;
    clearResumePreview();
    const framePromise=readContinueFrame(entry).catch(()=>null).then(frame=>{
      const exact=isExactFramePayload(frame)?frame:null;
      state.srhContinueFrameUrl=exact?storedFrameUrl({...entry,type:'vod'},exact):'';
      return exact
    });
    state.srhContinueFramePromise=framePromise;
    const loading=openFilm(item),token=state.detailToken;
    try{
      const frame=await framePromise;
      await loading;
      if(!isDetailCurrent(token))return;
      const art=el.detailBody.querySelector('.detail-art'),image=art?.querySelector('img'),watch=el.detailBody.querySelector('#watchFilm');
      if(!art)return;
      const exact=useStoredFrameImage(image,{...entry,type:'vod'},frame);
      playbackDebug('continue-frame-gate',{type:'vod',key:entry.key,exact,source:exact?'indexeddb':'catalog-fallback',modalSkeleton:true,fastRead:true});
      void refreshModalFrame(entry,'vod',token,image);
      if(watch)watch.addEventListener('click',()=>{clearResumePreview();art.classList.remove('srh-resume-previewing')},{once:true,capture:true})
    }finally{
      if(state.srhContinueFramePromise===framePromise){state.srhContinueFramePromise=null;state.srhContinueFrameUrl=''}
    }
  }

  async function openContinueSeries(entry){
    const item=historySeriesItem(entry);
    if(!item.series_id)return;
    clearResumePreview();
    const framePromise=readContinueFrame(entry).catch(()=>null).then(frame=>{
      const exact=isExactFramePayload(frame)?frame:null;
      state.srhContinueFrameUrl=exact?storedFrameUrl({...entry,type:'series'},exact):'';
      return exact
    });
    state.srhContinueFramePromise=framePromise;
    const loading=openSeries(item),token=state.detailToken;
    try{
      const frame=await framePromise;
      await loading;
      if(!isDetailCurrent(token))return;
      const season=String(entry.season??''),collections=state.currentSeries?.episodes||{},seasonKey=season&&collections[season]?season:Object.keys(collections).sort((a,b)=>Number(a)-Number(b))[0];
      if(seasonKey){const option=[...el.detailBody.querySelectorAll('[data-season]')].find(b=>String(b.dataset.season)===String(seasonKey));option?.click()}
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!isDetailCurrent(token))return;
      const image=el.detailBody.querySelector('#seriesImage'),art=el.detailBody.querySelector('#seriesArt');
      if(!art||!image)return;
      const exact=useStoredFrameImage(image,{...entry,type:'series'},frame);
      const video=el.detailBody.querySelector('#seriesInlineVideo');
      if(video){try{video.pause()}catch{};video.classList.add('is-hidden');video.muted=false;video.volume=1;video.controls=true}
      image.classList.remove('is-hidden');
      art.classList.remove('srh-resume-previewing','is-playing');
      playbackDebug('continue-frame-gate',{type:'series',key:entry.key,exact,source:exact?'indexeddb':'catalog-fallback',modalSkeleton:true,fastRead:true});
      void refreshModalFrame(entry,'series',token,image)
    }finally{
      if(state.srhContinueFramePromise===framePromise){state.srhContinueFramePromise=null;state.srhContinueFrameUrl=''}
    }
  }

  let continueOpenSeq=0;
  async function openContinueEntry(entry,type){
    if(!entry||state.srhContinueOpening)return;
    const seq=++continueOpenSeq;
    state.srhContinueOpening=true;
    state.srhOpeningContinue=true;
    try{
      if(type==='series')await openContinueSeries(entry);
      else await openContinueMovie(entry)
    }finally{
      if(seq===continueOpenSeq){state.srhContinueOpening=false;state.srhOpeningContinue=false}
    }
  }

  renderContinue=function(){
    purgeContinueFrameWorkers();
    releaseContinueCardResources();
    const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&(x.position>=MIN_CONTINUE_SECONDS||!!x.resumeQualified)).slice(0,12);
    if(!list.length||type==='live'){
      el.continueSection.classList.add('is-hidden');el.continueRow.innerHTML='';return
    }
    el.continueSection.classList.remove('is-hidden');
    el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><div class="continue-card__media"><img src="${escapeHtml(IMAGE_PLACEHOLDER)}" alt="" loading="eager" decoding="async"></div><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');
    el.continueRow.querySelectorAll('[data-history]').forEach(card=>{
      const x=list[Number(card.dataset.history)];
      card.onclick=()=>{if(!state.srhContinueOpening&&x)openContinueEntry(x,type)};
      if(x)void hydrateContinueCard(card,x,type)
    })
  };

})();
/* TMDB enrichment — TMDB-first detail render + art branding. */
(function installTmdbEnrichment(){
  const TMDB_CONFIG_URL=window.__srhA.u('m');
  const KEY_STORE='srhell:tmdb:key:v1';
  const KEY_META='srhell:tmdb:key-meta:v1';
  const CACHE_STORE='srhell:tmdb:cache:v4';
  const CONFIG_TTL=24*60*60*1000;
  const CACHE_TTL=7*24*60*60*1000;
  const MAX_CACHE=42;
  const MAX_CACHE_BYTES=720000;
  const TMDB_METADATA_VERSION=3;
  let tmdbConfig=null;
  let coverActive=0;
  const coverQueue=[];
  const coverQueued=new Set();
  const detailTmdb=new Map();
  const logoRefreshTried=new Set();

  function readJson(k,f){try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}

  async function getTmdbConfig(force=false){
    if(tmdbConfig&&!force)return tmdbConfig;
    let savedKey='';
    try{savedKey=localStorage.getItem(KEY_STORE)||''}catch{}
    const meta=readJson(KEY_META,{});
    if(!force&&savedKey&&Date.now()-Number(meta.savedAt||0)<CONFIG_TTL){
      tmdbConfig={apiKey:savedKey,apiBase:meta.apiBase||'https://api.themoviedb.org/3',imageBase:meta.imageBase||'https://image.tmdb.org/t/p'};
      return tmdbConfig;
    }
    const cfg=await requestJson(TMDB_CONFIG_URL+'?t='+Date.now(),6500);
    if(!cfg?.apiKey)throw new Error('TMDB key ausente');
    try{localStorage.setItem(KEY_STORE,String(cfg.apiKey))}catch{}
    writeJson(KEY_META,{savedAt:Date.now(),apiBase:cfg.apiBase,imageBase:cfg.imageBase,version:cfg.version||1});
    tmdbConfig={apiKey:String(cfg.apiKey),apiBase:cfg.apiBase||'https://api.themoviedb.org/3',imageBase:cfg.imageBase||'https://image.tmdb.org/t/p'};
    return tmdbConfig;
  }

  async function tmdbFetch(path,params={},retry=true){
    const cfg=await getTmdbConfig();
    const u=new URL(cfg.apiBase+path);
    u.searchParams.set('api_key',cfg.apiKey);
    Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
    try{
      const r=await fetch(u.toString(),{cache:'force-cache',signal:ctrl.signal});
      if(r.status===401&&retry){
        localStorage.removeItem(KEY_STORE);localStorage.removeItem(KEY_META);tmdbConfig=null;
        await getTmdbConfig(true);
        return tmdbFetch(path,params,false);
      }
      if(!r.ok)throw new Error('TMDB HTTP '+r.status);
      return await r.json();
    }finally{clearTimeout(timer)}
  }

  function imageUrl(path,size='w780'){
    if(!path)return'';
    const base=tmdbConfig?.imageBase||'https://image.tmdb.org/t/p';
    return base+'/'+size+path;
  }

  function explicitTmdbId(...sources){
    const seen=new Set();
    function walk(src,depth=0){
      if(!src||typeof src!=='object'||depth>3||seen.has(src))return'';
      seen.add(src);
      for(const k of ['tmdb_id','tmdb','tmdbId']){
        const v=src[k];
        if(v===undefined||v===null)continue;
        const m=String(v).match(/\d{2,}/);
        if(m)return m[0];
      }
      for(const k of ['info','movie_data','series','metadata']){
        const v=src[k];
        const found=walk(v,depth+1);
        if(found)return found;
      }
      return'';
    }
    for(const src of sources){const found=walk(src);if(found)return found}
    return'';
  }

  function titleYear(raw){
    const m=String(raw||'').match(/[\[(\s](19\d{2}|20\d{2})(?=[\])\s]|$)/);
    return m?m[1]:'';
  }

  function cleanTitle(raw){
    let s=stripEmoji(String(raw||'').trim(),'').trim();
    const cuts=[s.indexOf('['),s.indexOf('(')].filter(i=>i>=0);
    if(cuts.length)s=s.slice(0,Math.min(...cuts));
    return s
      .replace(/\b(?:4K|UHD|FHD|FULL\s*HD|1080P|720P|2160P|HDR|HEVC|H\.265|H265|DUBLADO|DUB|LEGENDADO|LEG|DUAL\s*AUDIO|LATINO|PT[- ]?BR)\b/gi,' ')
      .replace(/[._|]+/g,' ')
      .replace(/\s{2,}/g,' ')
      .replace(/[\s\-–—:;,_|]+$/g,'')
      .trim();
  }

  function cacheRead(key){
    const all=readJson(CACHE_STORE,{}),x=all[key];
    if(!x||Date.now()-Number(x.savedAt||0)>CACHE_TTL)return null;
    return x.data||null;
  }
  function cacheReadStale(key){
    const all=readJson(CACHE_STORE,{}),x=all[key];
    if(!x||Date.now()-Number(x.savedAt||0)>30*24*60*60*1000)return null;
    return x.data||null;
  }
  function cacheWrite(key,data){
    const all=readJson(CACHE_STORE,{});
    all[key]={savedAt:Date.now(),data};
    const entries=Object.entries(all)
      .sort((a,b)=>Number(b[1].savedAt||0)-Number(a[1].savedAt||0))
      .slice(0,MAX_CACHE);
    const out={};
    let bytes=2;
    for(const [k,v] of entries){
      const piece=JSON.stringify({[k]:v});
      if(bytes+piece.length>MAX_CACHE_BYTES)continue;
      out[k]=v;bytes+=piece.length;
    }
    try{localStorage.setItem(CACHE_STORE,JSON.stringify(out))}
    catch{
      try{localStorage.removeItem(CACHE_STORE)}catch{}
    }
  }

  function chooseLogo(logos=[]){
    const valid=(Array.isArray(logos)?logos:[]).filter(x=>x?.file_path);
    return valid.find(x=>x.iso_639_1==='pt')||
           valid.find(x=>x.iso_639_1==='en')||
           valid.find(x=>!x.iso_639_1)||
           valid[0]||null;
  }

  async function detailsById(kind,id,language='pt-BR'){
    return tmdbFetch('/'+kind+'/'+id,{language,append_to_response:'images',include_image_language:'pt,en,null'});
  }

  function resultYear(kind,result){
    const raw=kind==='movie'?result?.release_date:result?.first_air_date;
    return /^\d{4}/.test(String(raw||''))?String(raw).slice(0,4):'';
  }

  async function resolveTmdb(kind,item,extra){
    const explicit=explicitTmdbId(item,extra);
    const rawTitle=String(
      item?.name||item?.title||
      extra?.name||extra?.title||
      extra?.movie_data?.name||extra?.info?.name||''
    ).trim();
    const clean=cleanTitle(rawTitle);
    const year=titleYear(rawTitle)||titleYear(extra?.name||extra?.title||'');
    const cacheKey=kind+':'+(explicit?'id:'+explicit:'q:'+clean.toLocaleLowerCase('pt-BR')+':'+year);
    const cached=cacheRead(cacheKey),stale=cached||cacheReadStale(cacheKey);
    if(Number(cached?.metadataVersion||0)>=TMDB_METADATA_VERSION)return cached;

    let id=explicit||String(stale?.id||''),picked=null;
    if(!id&&clean){
      try{
        const params={query:clean,language:'pt-BR',include_adult:false};
        if(year)params[kind==='movie'?'year':'first_air_date_year']=year;
        const search=await tmdbFetch('/search/'+kind,params);
        const results=Array.isArray(search?.results)?search.results:[];
        picked=year?results.find(r=>resultYear(kind,r)===year):results[0];
        if(year&&!picked)return stale||null;
        id=picked?.id?String(picked.id):'';
      }catch(e){
        if(stale)return stale;
        throw e
      }
    }
    if(!id)return stale||null;

    let pt=null,en=null;
    try{pt=await detailsById(kind,id,'pt-BR')}
    catch(e){
      if(picked?.backdrop_path||picked?.poster_path){
        return{
          ...(stale||{}),
          id:String(id),
          title:picked?.title||picked?.name||stale?.title||clean||rawTitle,
          backdrop:imageUrl(picked?.backdrop_path,'w1280')||stale?.backdrop||'',
          poster:imageUrl(picked?.poster_path,'w500')||stale?.poster||'',
          visualVersion:Number(stale?.visualVersion||0)
        }
      }
      if(stale)return stale;
      throw e
    }

    const ptLogo=chooseLogo(pt?.images?.logos);
    if(!pt?.overview||!ptLogo||!pt?.backdrop_path||!pt?.poster_path){
      try{en=await detailsById(kind,id,'en-US')}catch{}
    }
    const logo=ptLogo||chooseLogo(en?.images?.logos);
    const backdropPath=pt?.backdrop_path||en?.backdrop_path||
      pt?.images?.backdrops?.find?.(x=>x?.file_path)?.file_path||
      en?.images?.backdrops?.find?.(x=>x?.file_path)?.file_path||'';
    const posterPath=pt?.poster_path||en?.poster_path||
      pt?.images?.posters?.find?.(x=>x?.file_path)?.file_path||
      en?.images?.posters?.find?.(x=>x?.file_path)?.file_path||'';
    const releaseRaw=kind==='movie'?(pt?.release_date||en?.release_date):(pt?.first_air_date||en?.first_air_date);
    const voteRaw=Number(pt?.vote_average??en?.vote_average);
    const data={
      id:String(id),
      title:pt?.title||pt?.name||en?.title||en?.name||clean||rawTitle,
      overview:pt?.overview||en?.overview||'',
      backdrop:imageUrl(backdropPath,'w1280'),
      poster:imageUrl(posterPath,'w500'),
      logo:imageUrl(logo?.file_path,'w500'),
      year:/^\d{4}/.test(String(releaseRaw||''))?String(releaseRaw).slice(0,4):'',
      vote:Number.isFinite(voteRaw)&&voteRaw>0?Math.round(voteRaw*10)/10:null,
      posterHero:!backdropPath&&!!posterPath,
      visualVersion:2,
      metadataVersion:TMDB_METADATA_VERSION
    };
    cacheWrite(cacheKey,data);
    return data;
  }
  async function seasonData(tvId,season){
    const key='season:'+tvId+':'+season;
    const cached=cacheRead(key);if(cached)return cached;
    const data=await tmdbFetch('/tv/'+tvId+'/season/'+season,{language:'pt-BR'});
    const out={episodes:(Array.isArray(data?.episodes)?data.episodes:[]).map((ep,i)=>({
      episode_number:ep?.episode_number??i+1,
      still_path:ep?.still_path||null
    }))};
    cacheWrite(key,out);
    return out;
  }
  window.__srhResolveContinueTmdbArt=async function(entry,type){
    if(!entry||!['vod','series'].includes(type))return null;
    const snap=entry?.itemSnapshot&&typeof entry.itemSnapshot==='object'?entry.itemSnapshot:{};
    const clean=url=>{const value=modalImageValue(url);return value&&value!==IMAGE_PLACEHOLDER?value:''};
    const push=(list,url,source)=>{const value=clean(url);if(value&&!list.some(x=>x.url===value))list.push({url:value,source})};
    if(type==='vod'){
      const item={...snap,stream_id:snap.stream_id??String(entry?.key||'').split(':')[1]??'',name:snap.name||entry.title||'',tmdb_id:entry.tmdbId||snap.tmdb_id||''};
      const meta=await resolveTmdb('movie',item,null).catch(()=>null),candidates=[];
      push(candidates,meta?.backdrop,'tmdb-backdrop');
      push(candidates,meta?.poster,'tmdb-poster');
      push(candidates,snap.backdrop_path||snap.backdrop,'provider-backdrop');
      push(candidates,snap.cover_big||snap.movie_image||snap.cover||snap.stream_icon||entry?.image,'provider-cover');
      if(!candidates.length)return null;
      return{...candidates[0],candidates,tmdbId:String(meta?.id||entry.tmdbId||snap.tmdb_id||'')}
    }
    const seriesId=String(entry?.seriesId??snap.series_id??''),seasonNo=Number(entry?.season),episodeNo=Number(entry?.episodeNumber);
    const item={...snap,series_id:seriesId,name:String(snap.name||entry.title||'').replace(/\s+[—-]\s+Epis[oó]dio\s+\d+.*$/i,'').trim(),tmdb_id:entry.tmdbId||snap.tmdb_id||''};
    const meta=await resolveTmdb('tv',item,null).catch(()=>null),candidates=[];
    let still='';
    if(meta?.id&&Number.isFinite(seasonNo)&&Number.isFinite(episodeNo)&&episodeNo>=1){
      const season=await seasonData(meta.id,seasonNo).catch(()=>null),episodes=Array.isArray(season?.episodes)?season.episodes:[],episode=episodes.find((ep,i)=>Number(ep?.episode_number??i+1)===episodeNo);
      still=imageUrl(episode?.still_path,'w780')
    }
    push(candidates,still,'tmdb-episode-still');
    push(candidates,snap.episode_image||snap.episodeImage||snap.movie_image||entry?.providerEpisodeImage,'provider-episode');
    push(candidates,meta?.backdrop,'tmdb-series-backdrop');
    push(candidates,meta?.poster,'tmdb-series-poster');
    push(candidates,snap.series_backdrop||snap.backdrop_path||snap.backdrop,'provider-series-backdrop');
    push(candidates,snap.series_cover||snap.cover_big||snap.cover||snap.stream_icon||entry?.image,'provider-series-cover');
    if(!candidates.length)return null;
    return{...candidates[0],candidates,tmdbId:String(meta?.id||entry.tmdbId||snap.tmdb_id||''),season:seasonNo,episodeNumber:episodeNo}
  };
  setTimeout(()=>{if(['vod','series'].includes(state.activeType))renderContinue()},0);

  function episodeCollections(data){
    const eps=data?.episodes;
    if(Array.isArray(eps))return{'1':eps};
    return eps&&typeof eps==='object'?eps:{};
  }

  async function tmdbFirstProviderResponse(action,params,data,{waitForTmdb=false}={}){
    if(!data||typeof data!=='object')return data;
    const kind=action==='get_vod_info'?'movie':action==='get_series_info'?'tv':'';
    if(!kind)return data;
    try{
      const info=data.info||{};
      const movie=data.movie_data||{};
      const probe=kind==='movie'
        ?{...movie,...info,name:movie.name||info.name||info.title||''}
        :{...info,name:info.name||info.title||data.name||''};
      const tmdbPromise=resolveTmdb(kind,probe,data);
      const tmdb=state.srhOpeningContinue&&!waitForTmdb
        ?await Promise.race([tmdbPromise,new Promise(resolve=>setTimeout(()=>resolve(null),1600))])
        :await tmdbPromise;
      if(!tmdb){
        if(state.srhOpeningContinue)tmdbPromise.then(x=>{
          if(!x)return;
          const id=params?.vod_id??params?.series_id??probe.stream_id??probe.series_id;
          if(id!==undefined)detailTmdb.set((kind==='movie'?'vod:':'series:')+String(id),x);
        }).catch(()=>{});
        return data;
      }
      data.__tmdb=tmdb;

      if(kind==='movie'){
        data.info={...info};
        data.movie_data={...movie};
        if(tmdb.backdrop)data.info.backdrop_path=[tmdb.backdrop];
        else if(tmdb.poster)data.info.backdrop_path=[tmdb.poster];
        if(tmdb.overview){data.info.plot=tmdb.overview;data.info.description=tmdb.overview}
        if(tmdb.year){data.info.year=tmdb.year;if(!data.info.releasedate)data.info.releasedate=tmdb.year}
        if(tmdb.vote!==null&&tmdb.vote!==undefined){data.info.rating=tmdb.vote;data.info.rating_5based=Math.round(Number(tmdb.vote)*5)/10}
        if(tmdb.poster){data.info.movie_image=tmdb.poster;data.movie_data.stream_icon=tmdb.poster;data.movie_data.movie_image=tmdb.poster}
        const id=params?.vod_id??movie.stream_id??probe.stream_id;
        if(id!==undefined)detailTmdb.set('vod:'+String(id),tmdb);
      }else{
        data.info={...info};
        if(tmdb.backdrop){data.info.backdrop_path=[tmdb.backdrop];data.info.backdrop=tmdb.backdrop}
        else if(tmdb.poster){data.info.backdrop_path=[tmdb.poster];data.info.backdrop=tmdb.poster}
        if(tmdb.poster){data.info.cover_big=tmdb.poster;data.info.cover=tmdb.poster}
        if(tmdb.overview){data.info.plot=tmdb.overview;data.info.description=tmdb.overview}
        if(tmdb.year){data.info.year=tmdb.year;if(!data.info.releasedate)data.info.releasedate=tmdb.year}
        if(tmdb.vote!==null&&tmdb.vote!==undefined){data.info.rating=tmdb.vote;data.info.rating_5based=Math.round(Number(tmdb.vote)*5)/10}
        const id=params?.series_id??probe.series_id;
        if(id!==undefined)detailTmdb.set('series:'+String(id),tmdb);

        const collections=episodeCollections(data);
        const firstSeason=Object.keys(collections).sort((a,b)=>Number(a)-Number(b))[0];
        if(firstSeason&&!state.srhOpeningContinue){
          try{
            const season=await seasonData(tmdb.id,firstSeason);
            const byNo=new Map((season.episodes||[]).map((e,i)=>[String(e.episode_number??i+1),e]));
            const list=collections[firstSeason]||[];
            list.forEach((ep,idx)=>{
              const n=String(ep.episode_num??ep.episode_number??idx+1);
              const hit=byNo.get(n);
              const providerArt=String(ep?.info?.movie_image||ep?.info?.cover_big||ep?.info?.cover||ep?.stream_icon||'').trim();
              if(providerArt&&!ep.__providerEpisodeArt)ep.__providerEpisodeArt=providerArt;
              if(hit?.still_path)ep.__tmdbStill=imageUrl(hit.still_path,'w500');
            });
          }catch{}
        }
      }
    }catch(e){
      console.debug('TMDB provider enrichment fallback',e);
    }
    return data;
  }

  /* Critical order change: detail provider data is enriched before the base
     renderer receives it. Skeleton stays visible until this promise settles. */
  const providerRequest=request;
  const fastDetailInflight=new Map(),fastDetailFailureAt=new Map();
  function detailTransportUrls(params,cfg=CONFIG){
    const target=apiUrl(params,cfg),out=[];
    const add=url=>{const s=String(url||'').trim();if(s&&!out.includes(s))out.push(s)};
    let secure='';
    try{const u=new URL(target);if(u.protocol==='http:'){u.protocol='https:';secure=u.toString()}}catch{}
    const localFile=location.protocol==='file:';
    if(localFile&&cfg.corsProxy){add(proxyUrl(target,cfg));if(secure)add(proxyUrl(secure,cfg))}
    add(target);if(secure)add(secure);
    if(!localFile&&cfg.corsProxy){add(proxyUrl(target,cfg));if(secure)add(proxyUrl(secure,cfg))}
    return out
  }
  window.__srhFastProviderDetail=async function(params={},cfg=CONFIG){
    const action=String(params?.action||''),mediaId=String(params?.series_id??params?.vod_id??params?.stream_id??'');
    const key=[normalizeServer(cfg.server),String(cfg.username||''),action,mediaId].join('|');
    const cached=detailResponseCache.get(key),age=cached?Date.now()-Number(cached.at||0):Infinity;
    if(cached&&age<DETAIL_CACHE_TTL){
      playbackDebug('detail-fast-cache',{action,mediaId,ageMs:Math.round(age)});
      return cloneDetailPayload(cached.data)
    }
    if(fastDetailInflight.has(key))return fastDetailInflight.get(key);
    const lastFail=Number(fastDetailFailureAt.get(key)||0);
    if(!cached&&lastFail&&Date.now()-lastFail<1800)throw new Error('Detalhe temporariamente indisponível.');
    const job=(async()=>{
      const started=performance.now(),urls=detailTransportUrls(params,cfg);let last=null,attempt=0;
      for(const url of urls){
        attempt++;
        try{
          const data=await requestJson(url,7800,{srhBypassCircuit:true});
          const ms=Math.round(performance.now()-started);
          detailResponseCache.set(key,{at:Date.now(),data:cloneDetailPayload(data)});
          fastDetailFailureAt.delete(key);
          if(detailResponseCache.size>24)detailResponseCache.delete(detailResponseCache.keys().next().value);
          if(ms>2600)window.SRHDebug?.noteSlow?.({kind:'detail.api',action,mediaId,origin:(()=>{try{return new URL(apiUrl({},cfg)).origin}catch{return''}})(),layer:'fetch',ms,message:'Detalhe demorou para carregar'});
          playbackDebug('detail-fast-provider',{action,mediaId,ms,attempt,transport:url===apiUrl(params,cfg)?'direct':url.startsWith('https:')?'https':'proxy'});
          return cloneDetailPayload(data)
        }catch(e){last=e;playbackDebug('detail-fast-attempt-failed',{action,mediaId,attempt,message:e?.message||String(e)})}
      }
      const ms=Math.round(performance.now()-started);
      if(cached&&age<DETAIL_STALE_TTL){
        playbackDebug('detail-fast-stale',{action,mediaId,ageMs:Math.round(age),ms,reason:last?.message||'provider-failure'});
        return cloneDetailPayload(cached.data)
      }
      fastDetailFailureAt.set(key,Date.now());
      playbackDebug('detail-fast-failure',{action,mediaId,ms,attempts:urls.length,message:last?.message||String(last)});
      throw last||new Error('Não foi possível carregar os detalhes.')
    })().finally(()=>fastDetailInflight.delete(key));
    fastDetailInflight.set(key,job);
    return job
  };
  request=async function(params={},cfg=CONFIG){
    const data=await providerRequest(params,cfg);
    if(cfg!==CONFIG)return data;
    const action=params?.action;
    if(action==='get_vod_info'||action==='get_series_info'){
      return tmdbFirstProviderResponse(action,params,data);
    }
    return data;
  };
  const providerDetailRequest=requestDetail;
  requestDetail=async function(params={},cfg=CONFIG){
    const data=await providerDetailRequest(params,cfg);
    if(cfg!==CONFIG)return data;
    const action=params?.action;
    if(action==='get_vod_info'||action==='get_series_info'){
      return tmdbFirstProviderResponse(action,params,data,{waitForTmdb:true});
    }
    return data;
  };

  const providerHeroArtCache=new Map();
  let heroProviderDetailBlockedUntil=0;
  function providerImageValue(...values){
    const visit=value=>{
      if(Array.isArray(value)){for(const x of value){const hit=visit(x);if(hit)return hit}return''}
      if(value&&typeof value==='object'){
        for(const k of ['url','path','file_path','backdrop','backdrop_path','cover','cover_big','movie_image','stream_icon']){const hit=visit(value[k]);if(hit)return hit}
        return''
      }
      const raw=String(value||'').trim();
      if(!raw)return'';
      if((raw.startsWith('[')||raw.startsWith('{'))){
        try{const parsed=JSON.parse(raw),hit=visit(parsed);if(hit)return hit}catch{}
      }
      if(/^\/\//.test(raw))return'https:'+raw;
      if(/^https?:\/\//i.test(raw)||/^data:image\//i.test(raw)||/^blob:/i.test(raw))return raw;
      if(raw.startsWith('/'))return normalizeServer(CONFIG.server)+raw;
      return raw
    };
    for(const value of values){const hit=visit(value);if(hit)return hit}
    return''
  }
  window.__srhProviderHeroArt=async function(item,type){
    if(!['vod','series'].includes(type))return{backdrop:'',cover:''};
    const id=String(itemId(item,type)||''),key=type+':'+id;
    if(providerHeroArtCache.has(key))return providerHeroArtCache.get(key);
    const job=(async()=>{
      const action=type==='series'?'get_series_info':'get_vod_info';
      const params=type==='series'?{action,series_id:id}:{action,vod_id:id};
      let data=null;
      if(Date.now()>=heroProviderDetailBlockedUntil){
        try{data=await window.__srhFastProviderDetail(params,CONFIG)}
        catch(e){
          heroProviderDetailBlockedUntil=Date.now()+60000;
          playbackDebug('hero-provider-detail-circuit',{type,mediaId:id,blockedMs:60000,message:e?.message||String(e)})
        }
      }
      const info=data?.info||{},movie=data?.movie_data||{},root=data||{};
      const backdrop=providerImageValue(
        info.backdrop_path,info.backdrop,root.backdrop_path,root.backdrop,
        movie.backdrop_path,movie.backdrop,
        item?.backdrop_path,item?.backdrop
      );
      const cover=providerImageValue(
        info.cover_big,info.movie_image,info.cover,
        movie.movie_image,movie.stream_icon,movie.cover,
        item?.cover_big,item?.movie_image,item?.cover,item?.stream_icon
      );
      const overview=String(info.plot||info.description||movie.plot||movie.description||root.plot||root.description||item?.plot||item?.description||'').trim();
      const year=String(info.year||String(info.releasedate||info.release_date||movie.year||movie.releasedate||item?.year||'').match(/\b(19|20)\d{2}\b/)?.[0]||'').trim();
      const rawVote=info.rating??info.vote_average??movie.rating??movie.vote_average??item?.rating??item?.vote_average;
      const vote=Number.isFinite(Number(rawVote))?Number(rawVote):null;
      return{backdrop,cover,overview,year,vote}
    })();
    providerHeroArtCache.set(key,job);
    return job
  };

  function luminance(rgb){
    if(!rgb)return.12;
    const f=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
    return .2126*f(rgb[0])+.7152*f(rgb[1])+.0722*f(rgb[2]);
  }

  function colorDistance(a,b){
    return Math.hypot((a[0]-b[0]),(a[1]-b[1]),(a[2]-b[2]));
  }

  async function normalizeLogoBitmap(img){
    try{
      await img.decode?.();
      const nw=img.naturalWidth||1,nh=img.naturalHeight||1;
      const scale=Math.min(1,512/Math.max(nw,nh));
      const w=Math.max(1,Math.round(nw*scale)),h=Math.max(1,Math.round(nh*scale));
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      const cx=cv.getContext('2d',{willReadFrequently:true});
      cx.drawImage(img,0,0,w,h);
      const im=cx.getImageData(0,0,w,h),d=im.data;
      const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>{
        const i=(y*w+x)*4;return[d[i],d[i+1],d[i+2],d[i+3]];
      });
      const opaque=corners.filter(c=>c[3]>220);
      let bg=null;
      if(opaque.length>=3){
        const avg=[0,1,2].map(k=>opaque.reduce((s,c)=>s+c[k],0)/opaque.length);
        const similar=opaque.every(c=>colorDistance(c,avg)<28);
        const lum=(avg[0]+avg[1]+avg[2])/3;
        if(similar&&(lum<42||lum>218))bg=avg;
      }
      if(bg){
        for(let i=0;i<d.length;i+=4){
          if(d[i+3]<8)continue;
          const dist=colorDistance([d[i],d[i+1],d[i+2]],bg);
          if(dist<24)d[i+3]=0;
          else if(dist<48)d[i+3]=Math.round(d[i+3]*((dist-24)/24));
        }
        cx.putImageData(im,0,0);
      }
      const px=cx.getImageData(0,0,w,h).data;
      let minX=w,minY=h,maxX=-1,maxY=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        if(px[(y*w+x)*4+3]<20)continue;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      }
      if(maxX<minX||maxY<minY)return null;
      const pad=Math.max(2,Math.round(Math.min(w,h)*.015));
      minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
      maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad);
      const cw=maxX-minX+1,ch=maxY-minY+1;
      const out=document.createElement('canvas');out.width=cw;out.height=ch;
      out.getContext('2d').drawImage(cv,minX,minY,cw,ch,0,0,cw,ch);
      return{src:out.toDataURL('image/png'),width:cw,height:ch};
    }catch{return null}
  }

  function fitLogo(box,img,w,h){
    const art=box.closest('.detail-art');
    if(!art)return;
    const qW=Math.max(40,art.clientWidth*.5-18),qH=Math.max(34,art.clientHeight*.5-16);
    const ratio=w/Math.max(1,h);
    let maxW=.96,maxH=.72;
    if(ratio<=1.25){maxW=.88;maxH=.94;box.classList.add('is-square')}
    else if(ratio<=2.15){maxW=.96;maxH=.88;box.classList.add('is-compact')}
    else if(ratio<=4){maxW=.98;maxH=.68}
    else{maxW=.99;maxH=.56}
    const scale=Math.min((qW*maxW)/w,(qH*maxH)/h);
    img.style.setProperty('--srh-logo-w',Math.max(28,Math.round(w*scale))+'px');
    img.style.setProperty('--srh-logo-h',Math.max(18,Math.round(h*scale))+'px');
  }

  async function tuneLogoContrast(img,box){
    box.classList.remove('srh-logo-flare-light','srh-logo-flare-dark','srh-logo-flare-neutral');
    try{await img.decode?.()}catch{}
    const art=box.closest('.detail-art');
    const logo=typeof srhAverageLogoColor==='function'?srhAverageLogoColor(img):null;
    const bg=art&&typeof srhArtworkColorBehind==='function'?srhArtworkColorBehind(art,img):null;
    if(logo&&bg){
      const lumDiff=Math.abs(logo.lum-bg.lum),colorDiff=typeof srhFeedbackColorDistance==='function'?srhFeedbackColorDistance(logo.rgb,bg.rgb):colorDistance(logo.rgb,bg.rgb),similar=lumDiff<.22||colorDiff<105;
      if(similar){
        box.classList.add(bg.lum>.52?'srh-logo-flare-dark':'srh-logo-flare-light');
      }else if(logo.darkShare>.66&&bg.lum<.34){
        box.classList.add('srh-logo-flare-light');
      }else if(logo.lightShare>.72&&bg.lum>.67){
        box.classList.add('srh-logo-flare-dark');
      }else{
        box.classList.add('srh-logo-flare-neutral');
      }
      playbackDebug('detail-logo-contrast',{logoLum:Number(logo.lum.toFixed(3)),bgLum:Number(bg.lum.toFixed(3)),colorDistance:Math.round(colorDiff),outline:box.classList.contains('srh-logo-flare-light')?'light':box.classList.contains('srh-logo-flare-dark')?'dark':'neutral'});
      return
    }
    let dark=0,light=0,total=0;
    try{
      const cv=document.createElement('canvas');cv.width=64;cv.height=32;
      const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,64,32);
      const d=cx.getImageData(0,0,64,32).data;
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]<28)continue;
        const l=luminance([d[i],d[i+1],d[i+2]]);total++;if(l<.18)dark++;if(l>.82)light++
      }
    }catch{}
    const darkShare=total?dark/total:0,lightShare=total?light/total:0;
    if(darkShare>.58)box.classList.add('srh-logo-flare-light');
    else if(lightShare>.72)box.classList.add('srh-logo-flare-dark');
    else box.classList.add('srh-logo-flare-neutral')
  }

  function pseudoLogoText(title){
    const clean=cleanTitle(title)||String(title||'').trim();
    const words=clean.split(/\s+/).filter(Boolean);
    if(words.length<=2)return clean;
    const connectors=new Set(['a','o','e','ou','de','da','do','das','dos','em','no','na','nos','nas','por','para','com','sem','um','uma']);
    const out=[];
    let meaningful=0,i=0;
    for(;i<words.length;i++){
      const w=words[i];
      out.push(w);
      if(!connectors.has(w.toLocaleLowerCase('pt-BR')))meaningful++;
      if(meaningful>=2){
        while(i+1<words.length&&connectors.has(words[i+1].toLocaleLowerCase('pt-BR'))){
          out.push(words[++i]);
          if(i+1<words.length)out.push(words[++i]);
          break;
        }
        break;
      }
    }
    return out.join(' ')+(i<words.length-1?'…':'');
  }

  function collapseFullTitle(){
    el.detailBody.querySelectorAll('.srh-full-title-reveal:not(.is-hidden)').forEach(x=>x.classList.add('is-hidden'));
  }

  function moveSeriesActions(){
    const modal=detailModal();
    if(!modal?.classList.contains('is-series'))return;
    const row=el.detailBody.querySelector('.detail-title-row');
    const actions=row?.querySelector('.srh-lite-actions');
    const seasonBox=el.detailBody.querySelector('.season-box');
    const menu=seasonBox?.querySelector('.season-menu');
    if(!seasonBox)return;

    let wrap=seasonBox.querySelector('.srh-series-season-actions');
    if(!wrap){wrap=document.createElement('div');wrap.className='srh-series-season-actions'}
    if(actions){
      const fav=actions.querySelector('.srh-lite-action--favorite');
      const trash=actions.querySelector('.srh-lite-action--trash');
      if(fav)wrap.appendChild(fav);
      if(trash)wrap.appendChild(trash);
      actions.remove();
    }
    if(wrap.children.length){
      seasonBox.classList.add('srh-season-actions');
      seasonBox.insertBefore(wrap,menu||null);
    }
  }

  function applyTmdbDetailText(type,data){
    const overview=String(data?.overview||'').trim();
    const syn=el.detailBody.querySelector(type==='series'?'#seriesSynopsis':'#filmSynopsis');
    if(syn&&overview){
      setSynopsisState(syn,overview,false);
      syn.onclick=e=>{e.stopPropagation();setSynopsisState(syn,overview,!state.synopsisExpanded)}
    }
  }

  function applyTmdbDetailBackdrop(type,data){
    const src=String(data?.backdrop||'').trim();if(!src)return;
    const token=state.detailToken,art=el.detailBody.querySelector('.detail-art');
    const img=type==='series'?el.detailBody.querySelector('#seriesImage'):art?.querySelector(':scope > img');
    if(!art||!img)return;
    const probe=new Image();
    probe.onload=()=>{
      if(!isDetailCurrent(token)||!img.isConnected)return;
      if(type==='series'){
        applyManagedImageChain(img,[src,state.currentSeries?.tmdbPoster,state.currentSeries?.providerBackdrop,state.currentSeries?.providerCover,state.currentSeries?.backdrop],{label:'series-tmdb-backdrop',eager:true});
        if(state.currentSeries){state.currentSeries.backdrop=src;state.currentSeries.tmdbBackdrop=src}
      }else{
        const snap=state.currentDetail?.entry?.itemSnapshot||{};
        applyManagedImageChain(img,[src,data?.poster,snap.backdrop_path,snap.movie_image,snap.cover_big,snap.cover,snap.stream_icon,state.currentDetail?.entry?.image],{label:'vod-tmdb-backdrop',eager:true});
        if(state.currentDetail?.entry){
          state.currentDetail.entry.image=src;
          if(state.currentDetail.entry.itemSnapshot)state.currentDetail.entry.itemSnapshot.backdrop_path=[src]
        }
      }
      img.classList.add('srh-tmdb-backdrop');
      art.classList.remove('srh-poster-hero-fallback');
      playbackDebug('tmdb-backdrop-applied',{type,mediaId:String(type==='series'?(state.currentSeries?.item?.series_id||''):(state.currentDetail?.entry?.itemSnapshot?.stream_id||''))})
    };
    probe.onerror=()=>playbackDebug('tmdb-backdrop-fallback',{type});
    probe.src=src
  }

  function installWatchedStatus(type,item,data){
    const providerId=type==='series'?String(item?.series_id??item?.id??''):String(item?.stream_id??item?.id??'');
    let completed=getStandardTitleCompleted(type,data?.id||data?.tmdbId,providerId);
    if(completed&&data?.id&&!standardCompletedMemory[completedTitleKey(type,data.id,'')]){
      const promotedKey=completedTitleKey(type,data.id,'');
      persistCompletedRow(promotedKey,{...completed,tmdbId:String(data.id),providerId:completed.providerId||providerId,promotedAt:Date.now()});
      completed=standardCompletedMemory[promotedKey]||completed;
      playbackDebug('watched-id-promoted',{type,providerId,tmdbId:String(data.id)})
    }
    el.detailBody.querySelector('.srh-watched-note')?.remove();
    if(!completed)return;
    const note=document.createElement('div');
    note.className='srh-watched-note';
    note.textContent=type==='series'?'Esta série você já assistiu.':'Este filme você já assistiu.';
    const row=el.detailBody.querySelector('.detail-title-row');
    if(row)row.insertAdjacentElement('afterend',note);
    else el.detailBody.querySelector('.detail-content')?.prepend(note)
  }

  function installBranding(type,item,data){
    if(!['vod','series'].includes(type))return;
    const modal=detailModal();
    const art=el.detailBody.querySelector('.detail-art');
    const row=el.detailBody.querySelector('.detail-title-row');
    if(!modal||!art)return;

    modal.classList.add('srh-branded-detail');
    if(data?.id){
      if(type==='vod'&&state.currentDetail?.entry){
        state.currentDetail.entry.tmdbId=data.id;
        if(state.currentDetail.entry.itemSnapshot)state.currentDetail.entry.itemSnapshot.tmdb_id=data.id
      }
      if(type==='series'&&state.currentSeries){
        state.currentSeries.tmdbId=data.id;
        if(state.currentMedia?.type==='series'&&String(state.currentMedia.seriesId||'')===String(item?.series_id||'')){
          state.currentMedia.tmdbId=data.id;
          if(state.currentMedia.itemSnapshot)state.currentMedia.itemSnapshot.tmdb_id=data.id
        }
      }
    }
    art.classList.toggle('srh-poster-hero-fallback',!!data?.posterHero);
    applyTmdbDetailText(type,data);
    if(!data?.artSource&&!(state.srhOpeningContinue&&state.srhContinueFrameUrl))applyTmdbDetailBackdrop(type,data);
    art.querySelector('.srh-art-brand')?.remove();
    art.parentElement?.querySelector(':scope > .srh-full-title-reveal')?.remove();

    const providerTitle=stripEmoji(itemTitle(item)||data?.title||'','Sem título');
    const title=stripEmoji(data?.title||providerTitle,'Sem título');
    const box=document.createElement('div');
    box.className='srh-art-brand';

    if(data?.logo){
      const img=document.createElement('img');
      img.alt=title||'Logo';
      img.crossOrigin='anonymous';
      img.onload=async()=>{
        if(img.dataset.srhNormalized!=='1'){
          const normalized=await normalizeLogoBitmap(img);
          if(normalized?.src&&normalized.src!==img.src){
            img.dataset.srhNormalized='1';
            img.dataset.srhW=String(normalized.width);
            img.dataset.srhH=String(normalized.height);
            img.src=normalized.src;
            return;
          }
        }
        const w=Number(img.dataset.srhW)||img.naturalWidth||1;
        const h=Number(img.dataset.srhH)||img.naturalHeight||1;
        fitLogo(box,img,w,h);
        tuneLogoContrast(img,box);
        img.setAttribute('role','button');
        img.setAttribute('tabindex','0');
        img.setAttribute('aria-label','Mostrar título completo');
        bindFallback(img,providerTitle,art);
        img.onkeydown=e=>{
          if(e.key==='Enter'||e.key===' '){e.preventDefault();img.click()}
        };
      };
      img.onerror=()=>{
        box.replaceChildren();
        const b=document.createElement('button');
        b.type='button';b.className='srh-art-brand__fallback';b.textContent=pseudoLogoText(title);
        box.appendChild(b);
        bindFallback(b,providerTitle,art);
      };
      img.src=data.logo;
      box.appendChild(img);
    }else{
      const b=document.createElement('button');
      b.type='button';
      b.className='srh-art-brand__fallback';
      b.textContent=pseudoLogoText(title);
      box.appendChild(b);
      bindFallback(b,providerTitle,art);
    }
    art.appendChild(box);

    if(type==='series')moveSeriesActions();
    row?.querySelector('.detail-title')?.setAttribute('aria-hidden','true');
    installWatchedStatus(type,item,data);

    const video=art.querySelector('video');
    if(video){
      const active=()=>art.classList.add('srh-media-active');
      video.addEventListener('playing',active,{passive:true});
      video.addEventListener('loadeddata',()=>{if(!video.classList.contains('is-hidden'))active()},{passive:true});
    }
  }

  window.__srhInstallDetailBranding=installBranding;

  function bindFallback(button,title,art){
    let reveal=art.parentElement?.querySelector(':scope > .srh-full-title-reveal');
    if(!reveal){
      reveal=document.createElement('div');
      reveal.className='srh-full-title-reveal is-hidden';
      reveal.textContent=title;
      art.insertAdjacentElement('afterend',reveal);
    }
    button.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const willShow=reveal.classList.contains('is-hidden');
      collapseFullTitle();
      reveal.classList.toggle('is-hidden',!willShow);
    };
  }

  detailModal()?.addEventListener('click',e=>{
    if(e.target.closest?.('.srh-art-brand__fallback,.srh-art-brand img,.srh-full-title-reveal'))return;
    collapseFullTitle();
  },true);

  const episodeArtProbeCache=new Map();
  function providerEpisodeArt(ep){
    return String(ep?.__providerEpisodeArt||ep?.info?.movie_image||ep?.info?.cover_big||ep?.info?.cover||ep?.stream_icon||'').trim()
  }
  function episodeArtDimensions(url,timeout=4200){
    const src=String(url||'').trim();if(!src)return Promise.resolve({w:0,h:0,area:0});
    const key='dim:'+src;if(episodeArtProbeCache.has(key))return episodeArtProbeCache.get(key);
    const p=new Promise(resolve=>{
      const img=new Image();let done=false;
      const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve({w:img.naturalWidth||0,h:img.naturalHeight||0,area:(img.naturalWidth||0)*(img.naturalHeight||0)})};
      const timer=setTimeout(finish,timeout);img.onload=finish;img.onerror=finish;img.src=src;if(img.complete)finish()
    });
    episodeArtProbeCache.set(key,p);return p
  }
  function episodeArtHash(url,timeout=4200){
    const src=String(url||'').trim();if(!src)return Promise.resolve('');
    const key='hash:'+src;if(episodeArtProbeCache.has(key))return episodeArtProbeCache.get(key);
    const p=new Promise(resolve=>{
      const img=new Image();img.crossOrigin='anonymous';let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value||'')};
      const timer=setTimeout(()=>finish(''),timeout);
      img.onload=()=>{
        try{
          const cv=document.createElement('canvas');cv.width=16;cv.height=9;
          const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,16,9);
          const d=cx.getImageData(0,0,16,9).data,gray=[];let sum=0;
          for(let i=0;i<d.length;i+=4){const g=d[i]*.299+d[i+1]*.587+d[i+2]*.114;gray.push(g);sum+=g}
          const avg=sum/Math.max(1,gray.length);
          finish(gray.map(v=>v>=avg?'1':'0').join(''))
        }catch{finish('')}
      };
      img.onerror=()=>finish('');img.src=src
    });
    episodeArtProbeCache.set(key,p);return p
  }
  function episodeHashSimilarity(a,b){
    if(!a||!b||a.length!==b.length)return 0;
    let same=0;for(let i=0;i<a.length;i++)if(a[i]===b[i])same++;
    return same/a.length
  }
  async function episodeQualityScore(url){
    const d=await episodeArtDimensions(url);if(!d.area)return 0;
    const ratio=d.w/Math.max(1,d.h),target=16/9,fit=Math.max(0,1-Math.min(1,Math.abs(ratio-target)/target));
    return d.area*(.78+.22*fit)
  }
  async function assessProviderSeasonArt(eps){
    const urls=(Array.isArray(eps)?eps:[]).map(providerEpisodeArt).filter(Boolean);
    if(urls.length<2)return{generic:false,similarity:0,providerUrl:urls[0]||''};
    const first=urls[0],allExact=urls.every(u=>u===first);
    if(allExact)return{generic:true,similarity:1,providerUrl:first};
    const firstHash=await episodeArtHash(first);
    if(!firstHash)return{generic:false,similarity:0,providerUrl:first};
    let min=1;
    for(let i=1;i<urls.length;i++){
      if(urls[i]===first)continue;
      const hash=await episodeArtHash(urls[i]);if(!hash)return{generic:false,similarity:0,providerUrl:first};
      const sim=episodeHashSimilarity(firstHash,hash);min=Math.min(min,sim);
      if(sim<.90)return{generic:false,similarity:min,providerUrl:first}
    }
    return{generic:true,similarity:min,providerUrl:first}
  }

  async function enrichVisibleSeason(tvId,season){
    if(!tvId||season===undefined||season===null)return;
    const token=state.detailToken;
    try{
      const data=await seasonData(tvId,season);
      const visibleSeason=(el.detailBody.querySelector('#seasonLabel')?.textContent||'').match(/(\d+)/)?.[1];
      if(!isDetailCurrent(token)||state.srhTmdbSeriesId!==tvId||String(season)!==visibleSeason)return;
      const eps=Array.isArray(state.currentSeries?.episodes?.[season])?state.currentSeries.episodes[season]:[];
      const byNo=new Map((data.episodes||[]).map((ep,i)=>[String(ep.episode_number??i+1),ep]));
      eps.forEach((ep,idx)=>{
        const n=String(ep?.episode_num??ep?.episode_number??idx+1),hit=byNo.get(n);
        const provider=providerEpisodeArt(ep);if(provider&&!ep.__providerEpisodeArt)ep.__providerEpisodeArt=provider;
        if(hit?.still_path)ep.__tmdbStill=imageUrl(hit.still_path,'w500')
      });
      const assessment=await assessProviderSeasonArt(eps);
      if(!isDetailCurrent(token)||String(season)!==(el.detailBody.querySelector('#seasonLabel')?.textContent||'').match(/(\d+)/)?.[1])return;
      let source='provider-episode',providerQuality=0,tmdbQuality=0;
      if(assessment.generic){
        const firstWithTmdb=eps.find(ep=>ep.__tmdbStill)||null;
        providerQuality=await episodeQualityScore(assessment.providerUrl);
        tmdbQuality=await episodeQualityScore(firstWithTmdb?.__tmdbStill||'');
        source=tmdbQuality>providerQuality?'tmdb-still':'provider-generic'
      }
      eps.forEach(ep=>{
        const provider=providerEpisodeArt(ep),tmdb=String(ep.__tmdbStill||'').trim();
        const candidates=managedImageCandidates([
          tmdb,provider,
          state.currentSeries?.tmdbBackdrop,state.currentSeries?.tmdbPoster,
          state.currentSeries?.providerBackdrop,state.currentSeries?.providerCover,
          state.currentSeries?.backdrop
        ]);
        const chosen=candidates[0]||'';
        ep.__srhEpisodeThumb=chosen;
        ep.__srhWaitingArt=chosen;
        ep.__srhEpisodeArtCandidates=candidates;
        ep.__srhProviderGeneric=assessment.generic;
        ep.__srhEpisodeArtSource=tmdb?'tmdb-still':provider?'provider-episode':state.currentSeries?.tmdbBackdrop?'tmdb-series-backdrop':state.currentSeries?.tmdbPoster?'tmdb-series-poster':'series-fallback'
      });
      [...el.detailBody.querySelectorAll('.episode')].forEach((row,idx)=>{
        const title=row.querySelector('.episode__title')?.textContent||'',m=title.match(/(\d+)/);
        const n=String(m?.[1]??idx+1),ep=eps.find((x,i)=>String(x?.episode_num??x?.episode_number??i+1)===n)||eps[idx],img=row.querySelector('.episode__thumb');
        if(!img||!ep)return;
        applyManagedImageChain(img,ep.__srhEpisodeArtCandidates||[ep.__srhEpisodeThumb,state.currentSeries?.backdrop],{label:'episode-enriched-'+n,eager:idx<6});
        img.classList.toggle('srh-tmdb-still',ep.__srhEpisodeArtSource==='tmdb-still')
      });
      if(state.currentSeries){
        state.currentSeries.episodeArtPolicy=state.currentSeries.episodeArtPolicy||{};
        state.currentSeries.episodeArtPolicy[String(season)]={generic:assessment.generic,similarity:assessment.similarity,source,providerQuality,tmdbQuality}
      }
      playbackDebug('episode-art-policy',{
        season:String(season),generic:assessment.generic,similarity:Number((assessment.similarity||0).toFixed(3)),
        source,providerQuality:Math.round(providerQuality),tmdbQuality:Math.round(tmdbQuality),episodes:eps.length
      })
    }catch(e){playbackDebug('episode-art-policy-error',{season:String(season),message:e?.message||String(e)})}
  }

  resolveCatalogMetadata=async function(kind,item,extra){
    const type=kind==='tv'?'series':'vod';
    const id=String(kind==='tv'?(item?.series_id??item?.id??''):(item?.stream_id??item?.id??''));
    const rich=id?detailTmdb.get(type+':'+id):null;
    if(Number(rich?.metadataVersion||0)>=TMDB_METADATA_VERSION)return rich;
    const resolved=await resolveTmdb(kind,item,extra);
    if(rich){
      if(!resolved)return rich;
      return{
        ...rich,
        ...resolved,
        title:resolved.title||rich.title||'',
        logo:resolved.logo||rich.logo||'',
        backdrop:resolved.backdrop||rich.backdrop||'',
        poster:resolved.poster||rich.poster||'',
        overview:resolved.overview||rich.overview||'',
        year:resolved.year||rich.year||'',
        vote:resolved.vote??rich.vote??null,
        visualVersion:Math.max(Number(rich.visualVersion||0),Number(resolved.visualVersion||0)),
        metadataVersion:Math.max(Number(rich.metadataVersion||0),Number(resolved.metadataVersion||0))
      };
    }
    return resolved;
  };
  normalizeCatalogLogo=normalizeLogoBitmap;
  tuneCatalogLogoContrast=tuneLogoContrast;

  const tmdbOpenFilm=openFilm;
  openFilm=async function(item){
    const loading=tmdbOpenFilm(item),token=state.detailToken;
    await loading;
    if(!isDetailCurrent(token))return;
    const pkg=state.srhDetailPackage;
    if(state.srhDetailBrandingToken===token&&pkg?.type==='vod')return;
    const key='vod:'+String(item?.stream_id??item?.id??'');
    const data=(pkg?.token===token&&pkg?.type==='vod'&&pkg.brand)
      ?pkg.brand
      :await resolveCatalogMetadata('movie',item,null).catch(()=>detailTmdb.get(key)||null);
    if(!isDetailCurrent(token))return;
    installBranding('vod',item,data);
    state.srhDetailBrandingToken=token
  };

  const tmdbOpenSeries=openSeries;
  openSeries=async function(item,opts=null){
    const loading=tmdbOpenSeries(item,opts),token=state.detailToken;
    await loading;
    if(!isDetailCurrent(token))return;
    const pkg=state.srhDetailPackage;
    const key='series:'+String(item?.series_id??item?.id??'');
    const data=(pkg?.token===token&&pkg?.type==='series'&&pkg.brand)
      ?pkg.brand
      :await resolveCatalogMetadata('tv',item,state.currentSeries?.data||null).catch(()=>detailTmdb.get(key)||null);
    if(!isDetailCurrent(token))return;
    if(data?.id)state.srhTmdbSeriesId=data.id;
    if(state.srhDetailBrandingToken!==token){
      installBranding('series',item,data);
      state.srhDetailBrandingToken=token
    }
    const label=el.detailBody.querySelector('#seasonLabel')?.textContent||'';
    const season=(label.match(/(\d+)/)||[])[1];
    if(data?.id&&season)enrichVisibleSeason(data.id,season);
  };

  el.detailBody.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-season]');
    if(!b||!state.srhTmdbSeriesId)return;
    const token=state.detailToken,tvId=state.srhTmdbSeriesId,season=b.dataset.season;
    setTimeout(()=>{if(isDetailCurrent(token))enrichVisibleSeason(tvId,season)},35);
  });

  /* Catalog poster fallback: provider first only when it actually works.
     Missing/broken covers are resolved from TMDB with two concurrent lookups. */
  const baseCardDataImage=cardDataImage;
  cardDataImage=function(item,type){return item?.__tmdbPoster||baseCardDataImage(item,type)};

  function queueCover(item,type,img,force=false){
    if(!item||!img||!['vod','series'].includes(type))return;
    if(!force&&baseCardDataImage(item,type))return;
    const key=type+':'+String(itemId(item,type)||itemTitle(item));
    if(item.__tmdbPoster||coverQueued.has(key))return;
    coverQueued.add(key);
    coverQueue.push({item,type,img,key});
    pumpCoverQueue();
  }

  function pumpCoverQueue(){
    while(coverActive<2&&coverQueue.length){
      const job=coverQueue.shift();coverActive++;
      resolveTmdb(job.type==='series'?'tv':'movie',job.item,null).then(data=>{
        if(data?.poster){
          job.item.__tmdbPoster=data.poster;
          if(job.img.isConnected){
            job.img.src=data.poster;
            job.img.classList.add('srh-tmdb-cover');
          }
        }
      }).catch(()=>{}).finally(()=>{
        coverActive--;coverQueued.delete(job.key);pumpCoverQueue();
      });
    }
  }

  function hookCover(v,container){
    if(!v||!['vod','series'].includes(v.type))return;
    container.querySelectorAll('[data-index]').forEach(card=>{
      const idx=Number(card.dataset.index),item=v.items[idx],img=card.querySelector('img');
      if(!item||!img)return;
      const failed=img.complete&&img.naturalWidth===0;
      queueCover(item,v.type,img,failed);
      if(img.dataset.tmdbErrorHook!=='1'){
        img.dataset.tmdbErrorHook='1';
        img.addEventListener('error',()=>queueCover(item,v.type,img,true),{once:true});
      }
    });
  }

  const tmdbRailRender=RailVirtualizer.prototype.render;
  RailVirtualizer.prototype.render=function(force=false){
    const out=tmdbRailRender.call(this,force);
    hookCover(this,this.track);
    return out;
  };

  const tmdbGridRender=GridVirtualizer.prototype.render;
  GridVirtualizer.prototype.render=function(force=false){
    const out=tmdbGridRender.call(this,force);
    hookCover(this,this.spacer);
    return out;
  };

  window.__srhTmdbRecommendations={
    resolve:resolveTmdb,
    explicitId:explicitTmdbId,
    cleanTitle,
    imageUrl,
    async list(type,id,page=1){
      const kind=type==='series'?'tv':'movie';
      const data=await tmdbFetch('/'+kind+'/'+id+'/recommendations',{language:'pt-BR',page});
      return Array.isArray(data?.results)?data.results:[];
    }
  };
  getTmdbConfig().catch(()=>{});
})();

/* Standard recommendations: TMDB candidates -> current configured categories -> silent availability probe. */
(function installStandardRecommendations(){
  const SIMILAR='<svg class="srh-lite-icon srh-lite-icon--similar" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5h6v-3h-6zM13.5 7.5h6v-3h-6zM4.5 19.5h6v-8h-6zM13.5 19.5h6v-8h-6z"/></svg>';
  const CLOSE='<svg class="ui-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
  const recCache=new Map(),probeCache=new Map(),configuredIndexCache=new Map();
  const similarStoreKey=()=> 'srhell:'+STANDARD_APP_NS+':standard:similar:'+standardProviderId()+':v1';
  let recSeq=0,endRecoSeq=0,similarStorePromise=null,similarStoreBoundKey='',similarWriteTail=Promise.resolve(),similarJobTail=Promise.resolve();
  const similarJobs=new Map();
  function similarIdle(ms=850){return new Promise(resolve=>{if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:ms+500});else setTimeout(resolve,ms)})}
  function queueSimilarDiscovery(type,source,limit){
    const key=standardProviderId()+':'+type+':'+String(itemId(source,type)||'');if(similarJobs.has(key))return similarJobs.get(key);
    const job=similarJobTail.catch(()=>{}).then(async()=>{await similarIdle();return getRecommendations(type,source,limit,{budgetMs:22000,preferCache:false})}).finally(()=>similarJobs.delete(key));
    similarJobTail=job.catch(()=>{});similarJobs.set(key,job);return job
  }

  function similarLocalKey(type,item){return type+':'+String(itemId(item,type)||'')}
  function compactRecoItem(type,item){
    const categoryId=String(item?._srhCategoryId??item?.category_id??item?.categoryId??'').trim();
    if(type==='series')return{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')||item?.cover||'',tmdb_id:item?.tmdb_id??item?.tmdb??item?.tmdbId??'',categoryId,_srhCategoryId:categoryId};
    return{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod')||item?.stream_icon||'',container_extension:item?.container_extension||'mp4',tmdb_id:item?.tmdb_id??item?.tmdb??item?.tmdbId??'',categoryId,_srhCategoryId:categoryId}
  }
  function compactTmdbRow(row,type){
    if(!row)return null;
    return{id:row.id||'',title:row.title||'',name:row.name||'',original_title:row.original_title||'',original_name:row.original_name||'',poster_path:row.poster_path||'',release_date:row.release_date||'',first_air_date:row.first_air_date||''}
  }
  async function readSimilarStore(){
    const key=similarStoreKey();
    if(similarStorePromise&&similarStoreBoundKey===key)return similarStorePromise;
    similarStoreBoundKey=key;
    similarStorePromise=standardStateGet(key).then(v=>v&&typeof v==='object'?v:{entries:{}}).catch(()=>({entries:{}}));
    return similarStorePromise
  }
  function queueSimilarStoreWrite(store){
    const entries=store.entries||{},keys=Object.keys(entries).sort((a,b)=>Number(entries[b]?.at||0)-Number(entries[a]?.at||0));
    for(const k of keys.slice(120))delete entries[k];
    const key=similarStoreKey();similarWriteTail=similarWriteTail.catch(()=>{}).then(()=>standardStateSet(key,{version:1,provider:standardProviderId(),updatedAt:Date.now(),entries}));
    return similarWriteTail
  }
  function mergeRecoRows(a=[],b=[],type){
    const out=[],seen=new Set();
    for(const row of [...a,...b]){
      const item=row?.item||row,id=String(itemId(item,type)||'');if(!id||seen.has(id))continue;
      seen.add(id);out.push({item:compactRecoItem(type,item),type,tmdb:compactTmdbRow(row?.tmdb,type)})
    }
    return out.slice(0,12)
  }
  async function saveRecommendationCluster(type,source,rows){
    if(!source||rows.length<3)return;
    const store=await readSimilarStore(),entries=store.entries||(store.entries={}),sourceItemLocal=compactRecoItem(type,source),sourceKey=similarLocalKey(type,sourceItemLocal),participants=[{item:sourceItemLocal,type,tmdb:null},...rows.map(r=>({item:compactRecoItem(type,r.item),type,tmdb:compactTmdbRow(r.tmdb,type)}))];
    const now=Date.now();
    for(const part of participants){
      const key=similarLocalKey(type,part.item);if(!key||/:$/.test(key))continue;
      const related=participants.filter(x=>similarLocalKey(type,x.item)!==key),prev=entries[key]?.rows||[];
      entries[key]={at:now,verifiedAt:now,sourceKey,rows:mergeRecoRows(related,prev,type)}
    }
    queueSimilarStoreWrite(store)
  }
  async function revalidateCachedRows(type,rows,limit=12){
    const allowed=configuredTargetIds(type),out=[];
    for(const saved of rows||[]){
      const item=saved?.item||saved,cid=String(item?._srhCategoryId??item?.categoryId??item?.category_id??'').trim(),iid=String(itemId(item,type)||'');
      if(!cid||!allowed.has(cid)||!iid)continue;
      const membership=state.srhCatalogMembership?.get(type+':'+cid);
      if(membership&&membership.size&&!membership.has(iid))continue;
      out.push({item,type,tmdb:saved?.tmdb||null});if(out.length>=limit)break
    }
    return out
  }
  async function cachedRecommendations(type,item,limit=12){
    const store=await readSimilarStore(),entry=store.entries?.[similarLocalKey(type,item)];
    if(!entry?.rows?.length)return[];
    return revalidateCachedRows(type,entry.rows,limit)
  }

  function recoApi(){return window.__srhTmdbRecommendations}
  function recoYield(){
    return new Promise(resolve=>{
      if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:70});
      else setTimeout(resolve,0)
    })
  }
  function recoTitle(result,type){return String(type==='series'?(result?.name||result?.original_name):(result?.title||result?.original_title)||'').trim()}
  function recoKey(raw){
    const api=recoApi();
    const clean=api?.cleanTitle?api.cleanTitle(raw):String(raw||'');
    return stripEmoji(clean,'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function sourceItem(type,source){
    if(!source)return null;
    const snap=source.itemSnapshot&&typeof source.itemSnapshot==='object'?source.itemSnapshot:{};
    if(type==='series')return{...snap,series_id:source.seriesId||snap.series_id||source.series_id,name:source.title||snap.name||source.name||'Série'};
    return{...snap,stream_id:String(source.key||'').split(':')[1]||snap.stream_id||source.stream_id,name:source.title||snap.name||source.name||'Filme',container_extension:source.containerExtension||snap.container_extension||source.container_extension||'mp4'}
  }
  async function rawProvider(params,timeout=4800){
    const urls=[apiUrl(params,CONFIG)];
    if(CONFIG.corsProxy)urls.push(proxyUrl(urls[0],CONFIG));
    let last=null;
    for(const url of urls){
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
      try{
        const r=await fetch(url,{cache:'no-store',signal:ctrl.signal,srhProbe:true});
        if(!r.ok)throw new Error('HTTP '+r.status);
        return await r.json()
      }catch(e){last=e}
      finally{clearTimeout(timer)}
    }
    throw last||new Error('probe API indisponível')
  }
  function firstSeriesEpisode(data){
    const groups=normalizeEpisodes(data?.episodes),seasons=Object.keys(groups).sort((a,b)=>Number(a)-Number(b));
    for(const season of seasons){const list=Array.isArray(groups[season])?groups[season]:[];if(list.length)return{season,ep:list[0]}}
    return null
  }
  function seriesProbeSources(ep){
    const eid=ep?.id||ep?.stream_id;if(!eid)return[];
    const catalogExt=String(ep?.container_extension||'mp4').toLowerCase(),infoExt=String(ep?.info?.container_extension||'').toLowerCase(),native=mediaUrlWithExtension('series',eid,catalogExt),direct=normalizeMediaUrl(ep?.direct_source||ep?.info?.direct_source||''),corrected=infoExt&&infoExt!==catalogExt?mediaUrlWithExtension('series',eid,infoExt):'',mkv=(catalogExt!=='mkv'&&infoExt!=='mkv')?mediaUrlWithExtension('series',eid,'mkv'):'';
    return uniqueMediaUrls([native,direct,corrected,mkv,mediaUrlWithExtension('series',eid,'m3u8')])
  }
  function probeNative(url,timeout=3300){
    return new Promise(resolve=>{
      const v=document.createElement('video');v.className='srh-probe-media';v.dataset.srhBackgroundMedia='1';v.muted=true;v.playsInline=true;v.preload='metadata';
      let done=false,timer=0;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);v.onloadedmetadata=v.onerror=null;try{v.pause();v.removeAttribute('src');v.load()}catch{}resolve(!!ok)};
      v.onloadedmetadata=()=>finish(true);v.onerror=()=>finish(false);timer=setTimeout(()=>finish(false),timeout);
      try{v.src=url;v.load()}catch{finish(false)}
    })
  }
  async function probeSource(url){
    const kind=mediaKind(url);
    if(kind==='hls'){
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),3400);
      try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal,srhProbe:true});if(!r.ok)return false;const text=await r.text();return /^\s*#EXTM3U/i.test(text)}
      catch{return false}finally{clearTimeout(timer)}
    }
    if(kind==='mpegts'||kind==='m2ts'){
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),3000);
      try{const r=await fetch(url,{cache:'no-store',headers:{Range:'bytes=0-65535'},signal:ctrl.signal,srhProbe:true});return r.ok||r.status===206}
      catch{return false}finally{clearTimeout(timer)}
    }
    return probeNative(url)
  }
  async function probeItem(item,type){
    const id=String(itemId(item,type)||'');if(!id)return false;
    const key=standardProviderId()+':'+type+':'+id,cached=probeCache.get(key);
    if(cached&&Date.now()-cached.at<15*60*1000)return cached.ok;
    let sources=[];
    try{
      if(type==='series'){
        const data=await rawProvider({action:'get_series_info',series_id:item.series_id??item.id}),first=firstSeriesEpisode(data);
        if(first?.ep)sources=seriesProbeSources(first.ep)
      }else{
        const data=await rawProvider({action:'get_vod_info',vod_id:item.stream_id??item.id});
        sources=vodSourcesFromInfo(data,item)
      }
      for(const url of sources.slice(0,5)){if(await probeSource(url)){probeCache.set(key,{ok:true,at:Date.now()});return true}}
    }catch{}
    probeCache.set(key,{ok:false,at:Date.now()});return false
  }
  async function candidateResults(type,current,maxPages=3){
    const api=recoApi();if(!api)return[];
    const base=sourceItem(type,current)||current,kind=type==='series'?'tv':'movie';
    let meta=null;try{meta=await api.resolve(kind,base,null)}catch{}
    if(!meta?.id)return[];
    const cacheKey=type+':'+meta.id,cached=recCache.get(cacheKey);
    if(cached&&Date.now()-cached.at<10*60*1000)return cached.results;
    const results=[],seen=new Set();
    for(let page=1;page<=maxPages;page++){
      let rows=[];try{rows=await api.list(type,meta.id,page)}catch{break}
      if(!rows.length)break;
      for(const row of rows){const k=recoKey(recoTitle(row,type));if(!k||seen.has(k))continue;seen.add(k);results.push(row)}
      if(results.length>=50)break
    }
    recCache.set(cacheKey,{at:Date.now(),results});
    return results
  }
  function recommendationAliases(row,type){
    const vals=type==='series'?[row?.name,row?.original_name]:[row?.title,row?.original_title];
    return [...new Set(vals.map(recoKey).filter(Boolean))]
  }
  function tokenScore(a,b){
    if(!a||!b)return 0;if(a===b)return 1;
    const A=new Set(a.split(' ').filter(Boolean)),B=new Set(b.split(' ').filter(Boolean));if(!A.size||!B.size)return 0;
    let hit=0;for(const x of A)if(B.has(x))hit++;
    const j=hit/(A.size+B.size-hit),cover=hit/Math.min(A.size,B.size);
    return Math.max(j,cover*.92)
  }
  async function matchConfigured(type,recommended,limit,budgetMs=11000){
    const recs=recommended.map((row,i)=>({row,i,aliases:recommendationAliases(row,type),id:String(row?.id||'')})).filter(x=>x.aliases.length||x.id);
    if(!recs.length)return[];
    const direct=[],fuzzy=[],seenLocal=new Set(),token=state.renderToken,deadline=Date.now()+budgetMs,api=recoApi(),kind=type==='series'?'tv':'movie';
    for(const target of targetsFor(type)){
      if(Date.now()>deadline||token!==state.renderToken)break;
      let raw=[];try{raw=await loadTargetItems(target,token,{priority:-30,probe:true})}catch{continue}
      const localSeen=new Set();
      for(let localIndex=0;localIndex<raw.length;localIndex++){
        const item=raw[localIndex],localId=String(itemId(item,type)||'');if(!localId||localSeen.has(localId)||seenLocal.has(localId)){if(localIndex&&localIndex%180===0)await recoYield();continue}
        localSeen.add(localId);
        const localKey=recoKey(itemTitle(item)),explicit=String(api?.explicitId?.(item)||'');
        let best=null,bestScore=0;
        for(const rec of recs){
          if(explicit&&rec.id&&explicit===rec.id){best=rec;bestScore=1;break}
          for(const alias of rec.aliases){const score=tokenScore(localKey,alias);if(score>bestScore){bestScore=score;best=rec}}
        }
        if(best){
          if(bestScore>=.995){seenLocal.add(localId);direct.push({item,type,tmdb:best.row,rank:best.i})}
          else if(bestScore>=.67){seenLocal.add(localId);fuzzy.push({item,type,tmdb:best.row,rank:best.i,score:bestScore})}
        }
        if(localIndex&&localIndex%180===0)await recoYield()
      }
    }
    const verified=[];
    fuzzy.sort((a,b)=>b.score-a.score||a.rank-b.rank);
    for(let i=0;i<fuzzy.length&&i<24&&Date.now()<deadline;i+=2){
      const batch=fuzzy.slice(i,i+2);
      const metas=await Promise.all(batch.map(x=>api?.resolve?.(kind,x.item,null).catch?.(()=>null)??Promise.resolve(null)));
      batch.forEach((x,j)=>{if(String(metas[j]?.id||'')===String(x.tmdb?.id||''))verified.push(x)})
    }
    const merged=[...direct,...verified].sort((a,b)=>a.rank-b.rank),out=[],seen=new Set();
    for(const row of merged){
      const id=String(itemId(row.item,type)||'');if(!id||seen.has(id)||Date.now()>deadline)continue;
      seen.add(id);if(await probeItem(row.item,type)){out.push(row);if(out.length>=limit)break}
    }
    return out
  }
  async function getRecommendations(type,current,limit=6,{budgetMs=12000,preferCache=true}={}){
    if(!['vod','series'].includes(type)||!current)return[];
    if(preferCache){const cached=await cachedRecommendations(type,sourceItem(type,current)||current,limit);if(cached.length>=Math.min(3,limit))return cached.slice(0,limit)}
    ++recSeq;const raw=await candidateResults(type,current,4),rows=await matchConfigured(type,raw,limit,budgetMs);
    if(rows.length>=3)await saveRecommendationCluster(type,sourceItem(type,current)||current,rows);
    return rows
  }
  window.__srhStandardRecommendations={get:getRecommendations,probe:probeItem,cached:cachedRecommendations};

  function closeSimilar(){
    const panel=el.detailBody.querySelector('.srh-similar-panel');
    if(panel)panel.remove();
    el.detailBody.querySelectorAll('.srh-lite-action--similar.is-active').forEach(x=>x.classList.remove('is-active'))
  }
  function similarCard(row,type){
    const title=itemTitle(row.item),img=row.tmdb?.poster_path?recoApi()?.imageUrl?.(row.tmdb.poster_path,'w500'):imageFor(row.item,type);
    return '<button class="srh-similar-card" data-srh-reco-id="'+escapeHtml(String(itemId(row.item,type)||''))+'"><img src="'+escapeHtml(img||IMAGE_PLACEHOLDER)+'" alt=""><span>'+escapeHtml(title)+'</span></button>'
  }
  function renderSimilarRows(panel,rows,type){
    const grid=panel?.querySelector('.srh-similar-grid');if(!grid)return;
    grid.innerHTML=rows.map(x=>similarCard(x,type)).join('');
    grid.querySelectorAll('[data-srh-reco-id]').forEach((card,i)=>card.onclick=e=>{e.stopPropagation();const row=rows[i];closeSimilar();if(row)openItem(row.item,type)})
  }
  function toggleSimilar(type,item,button){
    const existing=el.detailBody.querySelector('.srh-similar-panel');
    if(existing){closeSimilar();return}
    const limit=matchMedia('(max-width: 680px)').matches?6:12,rows=(button._srhRows||[]).slice(0,limit);
    if(rows.length<3)return;
    el.detailBody.querySelector('.season-menu')?.classList.add('is-hidden');
    button.classList.add('is-active');
    const panel=document.createElement('section');
    panel.className='srh-similar-panel';
    panel.innerHTML='<div class="srh-similar-head"><strong>Parecidos</strong><button type="button" class="srh-similar-close" aria-label="Fechar">'+CLOSE+'</button></div><div class="srh-similar-grid"></div>';
    const anchor=type==='series'?el.detailBody.querySelector('.season-box'):el.detailBody.querySelector('.srh-lite-film-actions');
    (anchor||el.detailBody.querySelector('.synopsis')||el.detailBody).insertAdjacentElement?.('afterend',panel);
    panel.querySelector('.srh-similar-close').onclick=e=>{e.stopPropagation();closeSimilar()};
    renderSimilarRows(panel,rows,type)
  }
  function installSimilarButton(type,item,rows){
    if(!['vod','series'].includes(type)||!Array.isArray(rows)||rows.length<3)return null;
    const group=type==='series'?el.detailBody.querySelector('.srh-series-season-actions'):el.detailBody.querySelector('.srh-lite-film-actions .srh-lite-actions');
    if(!group)return null;
    let b=group.querySelector('.srh-lite-action--similar');
    if(!b){
      b=document.createElement('button');b.type='button';b.className='srh-lite-action srh-lite-action--similar';b.setAttribute('aria-label','Parecidos');b.innerHTML=SIMILAR+'<span>Parecidos</span>';
      const fav=group.querySelector('.srh-lite-action--favorite'),trash=group.querySelector('.srh-lite-action--trash');
      if(fav)group.insertBefore(b,fav);else group.appendChild(b);
      if(type==='series'&&trash)group.appendChild(trash);
      b.onclick=e=>{e.stopPropagation();toggleSimilar(type,item,b)};
      fav?.addEventListener('click',closeSimilar,{capture:true});
      trash?.addEventListener('click',closeSimilar,{capture:true});
      el.detailBody.querySelector('#seasonTrigger')?.addEventListener('click',closeSimilar,{capture:true})
    }
    b._srhRows=rows.slice(0,12);
    const panel=el.detailBody.querySelector('.srh-similar-panel');
    if(panel&&b.classList.contains('is-active'))renderSimilarRows(panel,b._srhRows.slice(0,matchMedia('(max-width: 680px)').matches?6:12),type);
    return b
  }
  async function prepareSimilar(type,item,token){
    const source=sourceItem(type,item)||item,limit=matchMedia('(max-width: 680px)').matches?6:12;
    let rows=[];try{rows=await cachedRecommendations(type,source,limit)}catch{}
    if(token===state.detailToken&&!el.detailLayer.classList.contains('is-hidden')&&rows.length>=3)installSimilarButton(type,item,rows);
    if(rows.length>=limit)return rows;
    queueSimilarDiscovery(type,source,limit).then(async full=>{
      if(!Array.isArray(full)||full.length<3)return;
      const merged=mergeRecoRows(full,rows,type);await saveRecommendationCluster(type,source,merged);
      if(token===state.detailToken&&!el.detailLayer.classList.contains('is-hidden'))installSimilarButton(type,item,merged)
    }).catch(()=>{});
    return rows
  }

  const recoOpenFilm=openFilm;
  openFilm=async function(item){const r=await recoOpenFilm(item);if(!el.detailLayer.classList.contains('is-hidden')){const token=state.detailToken;state.currentDetail={...(state.currentDetail||{}),recommendationItem:item};prepareSimilar('vod',item,token)}return r};
  const recoOpenSeries=openSeries;
  openSeries=async function(item,opts=null){const r=await recoOpenSeries(item,opts);if(!el.detailLayer.classList.contains('is-hidden')){const token=state.detailToken;state.currentDetail={...(state.currentDetail||{}),recommendationItem:item};prepareSimilar('series',item,token)}return r};

  document.addEventListener('pointerdown',e=>{
    const panel=el.detailBody.querySelector('.srh-similar-panel');if(!panel)return;
    if(panel.contains(e.target)||e.target.closest?.('.srh-lite-action--similar'))return;
    closeSimilar()
  },true);

  function nextEpisodeInfo(){
    const cur=state.currentMedia,series=state.currentSeries;if(cur?.type!=='series'||!series?.episodes)return null;
    const seasons=Object.keys(series.episodes).sort((a,b)=>Number(a)-Number(b)),season=String(cur.season??''),si=Math.max(0,seasons.indexOf(season)),list=Array.isArray(series.episodes[season])?series.episodes[season]:[],epIndex=list.findIndex((ep,i)=>String(ep?.id||ep?.stream_id||'')===String(cur.itemSnapshot?.stream_id||'')||String(ep?.episode_num??ep?.episode_number??i+1)===String(cur.episodeNumber??''));
    if(epIndex>=0&&epIndex+1<list.length)return{season,ep:list[epIndex+1],index:epIndex+1};
    for(let i=si+1;i<seasons.length;i++){const nextList=Array.isArray(series.episodes[seasons[i]])?series.episodes[seasons[i]]:[];if(nextList.length)return{season:seasons[i],ep:nextList[0],index:0}}
    return null
  }
  function activateEpisode(next){
    if(!next)return;
    const select=()=>{const row=[...el.detailBody.querySelectorAll('.episode')].find((r,i)=>{const n=next.ep?.episode_num??next.ep?.episode_number??next.index+1;return new RegExp('Epis[oó]dio\\s+'+String(n)+'(?:\\D|$)','i').test(r.querySelector('.episode__title')?.textContent||'')});row?.click()};
    const current=(el.detailBody.querySelector('#seasonLabel')?.textContent||'').match(/(\d+)/)?.[1];
    if(String(current)!==String(next.season)){[...el.detailBody.querySelectorAll('[data-season]')].find(b=>String(b.dataset.season)===String(next.season))?.click();setTimeout(select,60)}else select()
  }
  function showNextEpisode(next){
    const art=el.detailBody.querySelector('#seriesArt');if(!art||!next)return;
    let box=art.querySelector('.srh-next-episode');
    if(!box){box=document.createElement('button');box.type='button';box.className='srh-next-episode';art.appendChild(box)}
    const n=next.ep?.episode_num??next.ep?.episode_number??next.index+1,thumb=next.ep?.__srhEpisodeThumb||next.ep?.info?.movie_image||next.ep?.info?.cover_big||next.ep?.info?.cover||next.ep?.stream_icon||state.currentSeries?.backdrop||IMAGE_PLACEHOLDER;
    box.innerHTML='<img src="'+escapeHtml(thumb)+'" alt=""><span><small>A seguir</small><strong>Temporada '+escapeHtml(next.season)+' · Episódio '+escapeHtml(n)+'</strong></span>';
    box.onclick=e=>{e.stopPropagation();box.remove();activateEpisode(next)}
  }
  function removeNextEpisode(){el.detailBody.querySelector('.srh-next-episode')?.remove()}

  async function showEndRecommendations(type,item){
    const art=type==='series'?el.detailBody.querySelector('#seriesArt'):el.detailBody.querySelector('.detail-art');if(!art||art.querySelector('.srh-end-recos'))return;
    const seq=++endRecoSeq,box=document.createElement('aside');box.className='srh-end-recos';box.innerHTML='<strong>Você também pode gostar</strong><div class="srh-end-recos__list"><span>Buscando…</span></div>';art.appendChild(box);
    const rows=await getRecommendations(type,item,3,{budgetMs:9500});if(seq!==endRecoSeq||!box.isConnected)return;
    const list=box.querySelector('.srh-end-recos__list');
    if(!rows.length){box.remove();return}
    list.innerHTML=rows.map(row=>'<button type="button"><img src="'+escapeHtml((row.tmdb?.poster_path&&recoApi()?.imageUrl?.(row.tmdb.poster_path,'w342'))||imageFor(row.item,type)||IMAGE_PLACEHOLDER)+'" alt=""><span>'+escapeHtml(itemTitle(row.item))+'</span></button>').join('');
    [...list.children].forEach((b,i)=>b.onclick=e=>{e.stopPropagation();const row=rows[i];if(row)openItem(row.item,type)})
  }
  function removeEndRecommendations(){el.detailBody.querySelectorAll('.srh-end-recos').forEach(x=>x.remove())}

  document.addEventListener('timeupdate',e=>{
    const video=e.target;if(!(video instanceof HTMLVideoElement))return;
    const dur=Number(video.duration)||0,pos=Number(video.currentTime)||0,remaining=dur-pos;if(!dur||remaining<=0||remaining>121)return;
    if(video.id==='seriesInlineVideo'&&state.currentMedia?.type==='series'){
      const next=nextEpisodeInfo();
      if(next){removeEndRecommendations();showNextEpisode(next)}
      else{removeNextEpisode();const item=state.currentDetail?.recommendationItem||state.currentSeries?.item;if(item)showEndRecommendations('series',item)}
    }else if(video.classList.contains('detail-inline-video')&&state.currentMedia?.type==='vod'){
      removeNextEpisode();const item=state.currentDetail?.recommendationItem||sourceItem('vod',state.currentMedia);if(item)showEndRecommendations('vod',item)
    }
  },true);
  document.addEventListener('ended',e=>{
    if(e.target?.id!=='seriesInlineVideo'||state.currentMedia?.type!=='series')return;
    const next=nextEpisodeInfo();if(next)setTimeout(()=>activateEpisode(next),90)
  },true);
  document.addEventListener('play',e=>{if(e.target instanceof HTMLVideoElement){removeEndRecommendations();if(e.target.id!=='seriesInlineVideo')removeNextEpisode()}},true);
})();

/* SRHELL Main Stream Style — default presentation for every classic palette. */
(function installMainStreamStyle(){
  document.body.classList.add('srh-main-stream-style');

  function resetMainStreamScroll(){
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{window.scrollTo(0,0)}
    if(document.scrollingElement)document.scrollingElement.scrollTop=0;
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
  }

  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('.tab-button[data-type]');
    if(!tab)return;
    const next=tab.dataset.type;
    if(next&&next!==state.activeType){
      resetMainStreamScroll();
      requestAnimationFrame(resetMainStreamScroll);
    }
  },true);

  /* SRHELL R24 feed hero polish */
  let heroToken=0,heroTimer=0,heroViewToken=0,heroItems=[],heroIndex=0,heroNode=null,heroSetBucket=-1,heroSetMode='auto',heroSetExpiresAt=0;
  const heroMeta=new Map(),heroPrecacheMemory=new Map(),HERO_SET_MS=10*60*1000,HERO_TMDB_METADATA_VERSION=3,HERO_PRECACHE_VERSION=1,HERO_PRECACHE_LIMIT=10,HERO_PRECACHE_TTL=7*24*60*60*1000,HERO_FAVORITE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  function heroIsVisible(){return !document.hidden&&!state.playerActive&&!state.collectionOpen&&el.detailLayer.classList.contains('is-hidden')&&!document.body.classList.contains('srh-searching')}
  function compactChannelTitle(value){
    const s=stripEmoji(String(value||'Canal'),'Canal').replace(/\s{2,}/g,' ').trim();
    if(s.length<=34)return s;
    const words=s.split(/\s+/),out=[];let chars=0;
    for(const w of words){if(out.length>=5||chars+w.length+(out.length?1:0)>31)break;out.push(w);chars+=w.length+(out.length>1?1:0)}
    return (out.join(' ')||s.slice(0,31)).trim()+'…'
  }
  async function heroCycleMode(type,bucket,hasHistory){
    if(type==='live'||!hasHistory)return'auto';
    const key='srhell:'+STANDARD_APP_NS+':feed:'+type+':cycle:v1',saved=await standardStateGet(key);
    if(saved&&Number(saved.bucket)===bucket)return saved.mode==='recommended'?'recommended':'auto';
    const mode=saved?.mode==='auto'?'recommended':'auto';
    void standardStateSet(key,{bucket,mode,at:Date.now()});
    return mode
  }

  function heroHost(){
    if(heroNode?.isConnected)return heroNode;
    heroNode=document.createElement('section');
    heroNode.className='stream-hero';
    heroNode.innerHTML='<div class="stream-hero__skeleton"></div><div class="stream-hero__bg-stack"><div class="stream-hero__bg stream-hero__bg--a is-active"></div><div class="stream-hero__bg stream-hero__bg--b"></div></div><div class="stream-hero__shade"></div><div class="stream-hero__content"><div class="stream-hero__brand"><img class="stream-hero__logo is-hidden" alt=""><div class="srh-art-brand__fallback stream-hero__brand-fallback is-hidden"></div></div><div class="stream-hero__meta"></div><p class="stream-hero__plot"></p><div class="stream-hero__actions"><button class="stream-hero__action" data-stream-open>'+UI_ICON_PLAY+'<span>Abrir</span></button><button class="stream-hero__action stream-hero__action--ghost stream-hero__favorite" data-stream-favorite aria-label="Adicionar aos favoritos">'+HERO_FAVORITE+'<span>Favoritar</span></button></div></div><div class="stream-hero__dots"></div>';
    el.homeStatus.insertAdjacentElement('afterend',heroNode);
    heroNode.addEventListener('click',e=>{
      if(e.target.closest?.('button,.stream-hero__content'))return;
      const r=heroNode.getBoundingClientRect(),x=e.clientX-r.left;
      if(x<r.width*.34)showHero(heroIndex-1,true);
      else if(x>r.width*.66)showHero(heroIndex+1,true);
    });
    return heroNode;
  }

  function stableShuffle(items,type,salt=''){
    const day=Math.floor(Date.now()/86400000),seed=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app')+':'+type+':'+day+':'+String(salt);
    let h=2166136261;
    for(const ch of seed){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    const out=[...items];
    for(let i=out.length-1;i>0;i--){
      h=(Math.imul(h,1664525)+1013904223)|0;
      const j=Math.abs(h)%(i+1);
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  }

  function heroYield(){
    return new Promise(resolve=>{
      if(typeof requestIdleCallback==='function')requestIdleCallback(()=>resolve(),{timeout:90});
      else setTimeout(resolve,0)
    })
  }
  function heroSample(raw,type,bucket,limit=64){
    const list=Array.isArray(raw)?raw:[];if(!list.length)return[];
    const take=Math.min(list.length,type==='live'?180:96),sample=[];
    let seed=(Number(bucket)||0)^list.length^String(type).length;
    const start=Math.abs(seed*1103515245+12345)%list.length,step=Math.max(1,Math.floor(list.length/take));
    for(let i=0,pos=start;i<take;i++,pos=(pos+step)%list.length)sample.push(list[pos]);
    if(type==='live')return groupChannels(sample).slice(0,limit);
    const out=[],seen=new Set();
    for(const item of sample){const id=String(itemId(item,type)||itemTitle(item));if(!id||seen.has(id))continue;seen.add(id);out.push(item);if(out.length>=limit)break}
    return out
  }

  function heroCatalogProviderArt(item,type){
    if(type==='live')return{backdrop:'',cover:item?.image||item?.variants?.[0]?.stream_icon||''};
    const pick=value=>{
      if(Array.isArray(value))return String(value.find(Boolean)||'').trim();
      const raw=String(value||'').trim();
      if(raw.startsWith('[')){try{const x=JSON.parse(raw);if(Array.isArray(x))return String(x.find(Boolean)||'').trim()}catch{}}
      return raw
    };
    return{
      backdrop:pick(item?.backdrop_path)||pick(item?.backdrop),
      cover:imageFor(item,type)||''
    }
  }
  async function heroProviderArt(item,type){
    const local={
      ...heroCatalogProviderArt(item,type),
      overview:String(item?.plot||item?.description||'').trim(),
      year:String(item?.year||'').trim(),
      vote:Number.isFinite(Number(item?.rating??item?.vote_average))?Number(item?.rating??item?.vote_average):null
    };
    if(type==='live')return local;
    try{
      const remote=await Promise.race([
        window.__srhProviderHeroArt?.(item,type),
        new Promise(resolve=>setTimeout(()=>resolve(null),5200))
      ]);
      return{
        backdrop:String(remote?.backdrop||local.backdrop||'').trim(),
        cover:String(remote?.cover||local.cover||'').trim(),
        overview:String(remote?.overview||local.overview||'').trim(),
        year:String(remote?.year||local.year||'').trim(),
        vote:remote?.vote??local.vote??null
      }
    }catch{return local}
  }
  function heroImage(item,type,meta,providerArt=null){
    if(type==='live')return item?.image||item?.variants?.[0]?.stream_icon||'';
    return String(meta?.backdrop||providerArt?.backdrop||providerArt?.cover||'').trim();
  }

  function heroSynopsis(value,max=200){
    const clean=String(value||'').replace(/\s+/g,' ').trim();
    const chars=Array.from(clean);
    if(chars.length<=max)return clean;
    return chars.slice(0,Math.max(1,max-1)).join('').trimEnd()+'…';
  }

  function heroMetaKey(item,type){return type+':'+String(itemId(item,type)||itemTitle(item))}
  async function heroTmdb(item,type){
    if(type==='live')return null;
    const key=heroMetaKey(item,type),cached=heroMeta.get(key);
    if(Number(cached?.metadataVersion||0)>=HERO_TMDB_METADATA_VERSION)return cached;
    try{
      const data=await resolveCatalogMetadata?.(type==='series'?'tv':'movie',item,null);
      const best=data?.backdrop||data?.poster||data?.logo?data:(cached||data||null);
      heroMeta.set(key,best);
      return best;
    }catch{
      heroMeta.set(key,null);
      return null;
    }
  }
  async function heroItemsWithCleanLogo(items,type,token,limit=10){
    if(type==='live')return items.slice(0,limit);
    const source=Array.isArray(items)?items:[],out=[];let scanned=0;
    for(let i=0;i<source.length&&out.length<limit;i+=5){
      if(token!==state.renderToken||state.activeType!==type)return[];
      const batch=source.slice(i,i+5),results=await Promise.all(batch.map(async item=>{
        const meta=await heroTmdb(item,type);scanned++;
        const logo=String(meta?.logo||'').trim();if(!logo)return null;
        const ready=await preloadHeroCleanLogo(logo,4200).catch(()=>false);
        return ready?item:null
      }));
      if(token!==state.renderToken||state.activeType!==type)return[];
      for(const item of results)if(item&&out.length<limit)out.push(item)
    }
    playbackDebug('hero-logo-filter',{type,scanned,accepted:out.length,rejected:Math.max(0,scanned-out.length)});
    return out
  }
  async function collectCleanLogoHeroItems(targets,type,token,bucket,limit=10){
    const out=[],seen=new Set();let categoriesScanned=0,candidatesScanned=0;
    const ordered=stableShuffle(Array.isArray(targets)?targets.slice():[],type+':hero-categories',bucket);
    for(let ti=0;ti<ordered.length&&out.length<limit;ti++){
      if(token!==state.renderToken||state.activeType!==type)return[];
      let raw=[];try{raw=await loadTargetItems(ordered[ti],token,{priority:100-ti})}catch{continue}
      if(token!==state.renderToken||state.activeType!==type)return[];
      categoriesScanned++;
      const sampled=stableShuffle(heroSample(raw,type,bucket+ti,96),type+':hero-items',bucket+ti),candidates=[];
      for(const item of sampled){
        const id=String(itemId(item,type)||itemTitle(item));if(!id||seen.has(id))continue;
        seen.add(id);candidates.push(item)
      }
      const need=limit-out.length,found=await heroItemsWithCleanLogo(candidates,type,token,need);
      candidatesScanned+=candidates.length;
      for(const item of found)if(out.length<limit)out.push(item)
    }
    playbackDebug('hero-clean-logo-set',{type,categoriesScanned,candidatesScanned,count:out.length,limit});
    return out
  }

  function heroPrecacheTargetSignature(type,targets){
    return (Array.isArray(targets)?targets:[]).map(t=>[type,String(targetId(t)||''),String(t?.name||'')].join(':')).join('|')
  }
  function heroPrecacheKey(type){
    return 'srhell:'+STANDARD_APP_NS+':standard:hero-precache:v'+HERO_PRECACHE_VERSION+':'+encodeURIComponent(seriesProviderGuardFingerprint())+':'+type
  }
  function cloneHeroCacheValue(value){
    try{return JSON.parse(JSON.stringify(value))}catch{return null}
  }
  async function readHeroPrecache(type,targets){
    if(type==='live')return[];
    const key=heroPrecacheKey(type),sig=heroPrecacheTargetSignature(type,targets);
    let row=heroPrecacheMemory.get(key)||null;
    if(!row){row=await standardStateGet(key);if(row)heroPrecacheMemory.set(key,row)}
    if(!row||Number(row.version)!==HERO_PRECACHE_VERSION||row.targetSignature!==sig||Date.now()-Number(row.savedAt||0)>HERO_PRECACHE_TTL)return[];
    const out=[];
    for(const entry of Array.isArray(row.entries)?row.entries:[]){
      const item=entry?.item,meta=entry?.meta;
      if(!item||!meta?.logo||Number(meta?.metadataVersion||0)<HERO_TMDB_METADATA_VERSION)continue;
      const art=String(meta?.backdrop||heroCatalogFallback(item)?.backdrop||heroCatalogFallback(item)?.cover||'').trim();
      if(!art)continue;
      heroMeta.set(heroMetaKey(item,type),meta);
      out.push(item);
      if(out.length>=HERO_PRECACHE_LIMIT)break
    }
    if(out.length){
      playbackDebug('hero-precache-hit',{type,count:out.length,ageMs:Math.max(0,Date.now()-Number(row.savedAt||0))});
      for(const item of out.slice(0,3)){
        const meta=heroMeta.get(heroMetaKey(item,type));
        if(meta?.logo)preloadHeroCleanLogo(meta.logo,3200).catch(()=>{});
        const image=heroImage(item,type,meta,heroCatalogFallback(item));
        if(image)preloadHeroImage(image,3200).catch(()=>{})
      }
    }
    return out
  }
  async function writeHeroPrecache(type,items,targets){
    if(type==='live')return false;
    const entries=[];
    for(const item of (Array.isArray(items)?items:[])){
      const meta=heroMeta.get(heroMetaKey(item,type));
      if(!meta?.logo||Number(meta?.metadataVersion||0)<HERO_TMDB_METADATA_VERSION)continue;
      const catalog=heroCatalogFallback(item),art=String(meta?.backdrop||catalog.backdrop||catalog.cover||'').trim();
      if(!art)continue;
      const cleanItem=cloneHeroCacheValue(item),cleanMeta=cloneHeroCacheValue(meta);
      if(!cleanItem||!cleanMeta)continue;
      entries.push({item:cleanItem,meta:cleanMeta});
      if(entries.length>=HERO_PRECACHE_LIMIT)break
    }
    if(!entries.length)return false;
    const row={version:HERO_PRECACHE_VERSION,type,targetSignature:heroPrecacheTargetSignature(type,targets),savedAt:Date.now(),entries};
    const key=heroPrecacheKey(type);heroPrecacheMemory.set(key,row);
    const ok=await standardStateSet(key,row);
    playbackDebug('hero-precache-save',{type,count:entries.length,ok});
    return ok
  }

  function dots(){
    if(!heroNode)return;
    heroNode.querySelector('.stream-hero__dots').innerHTML=heroItems.map((_,i)=>'<button class="stream-hero__dot'+(i===heroIndex?' is-active is-worm':'')+'" data-stream-dot="'+i+'" aria-label="Destaque '+(i+1)+'"></button>').join('');
    heroNode.querySelectorAll('[data-stream-dot]').forEach(b=>b.onclick=()=>showHero(Number(b.dataset.streamDot),true));
  }

  function preloadHeroImage(url,timeout=5000){
    const src=String(url||'').trim();
    if(!src)return Promise.resolve(false);
    return new Promise(resolve=>{
      const img=new Image();
      let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(!!ok)};
      const timer=setTimeout(()=>finish(false),timeout);
      img.onload=()=>finish(true);
      img.onerror=()=>finish(false);
      img.src=src;
      if(img.complete)finish(img.naturalWidth>0);
    });
  }
  function preloadHeroCleanLogo(url,timeout=5000){
    const src=String(url||'').trim();
    if(!src)return Promise.resolve(false);
    return new Promise(resolve=>{
      const img=new Image();
      let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(!!ok)};
      const timer=setTimeout(()=>finish(false),timeout);
      img.crossOrigin='anonymous';
      img.onload=()=>finish(img.naturalWidth>0&&img.naturalHeight>0);
      img.onerror=()=>finish(false);
      img.src=src;
      if(img.complete)finish(img.naturalWidth>0&&img.naturalHeight>0);
    });
  }

  function clearHeroBackground(node,isLive=false){
    if(!node)return;
    node.dataset.srhPainted='';
    const layers=[...node.querySelectorAll('.stream-hero__bg')];
    layers.forEach((layer,i)=>{layer.classList.toggle('is-active',i===0);layer.classList.toggle('is-live',!!isLive);layer.style.backgroundImage='none';layer.dataset.srhUrl=''})
  }

  function clearHeroVisual(node,isLive=false){
    if(!node)return;
    clearHeroBackground(node,isLive);
    const logo=node.querySelector('.stream-hero__logo'),fallback=node.querySelector('.stream-hero__brand-fallback'),box=node.querySelector('.stream-hero__brand');
    if(logo){logo.onload=null;logo.onerror=null;hideHeroLogo(logo);logo.removeAttribute('src');logo.removeAttribute('data-srh-normalized')}
    fallback?.classList.add('is-hidden');if(fallback)fallback.textContent='';
    box?.classList.remove('srh-logo-flare-light','srh-logo-flare-dark','has-logo','has-fallback','is-ready');
    const meta=node.querySelector('.stream-hero__meta'),plot=node.querySelector('.stream-hero__plot'),dots=node.querySelector('.stream-hero__dots');
    if(meta)meta.textContent='';if(plot)plot.textContent='';if(dots)dots.innerHTML='';
    node.querySelector('.stream-hero__skeleton')?.classList.remove('is-hidden')
  }

  async function paintHeroBackground(node,url,isLive,local){
    const src=String(url||'').trim();
    const layers=[...node.querySelectorAll('.stream-hero__bg')];
    if(!src||layers.length<2){if(local===heroToken&&heroViewToken===state.renderToken)clearHeroBackground(node,isLive);return false}
    let current=layers.find(x=>x.classList.contains('is-active'))||layers[0];
    if(current.dataset.srhUrl===src){
      current.classList.toggle('is-live',!!isLive);
      current.style.backgroundSize='cover';
      current.style.backgroundPosition='center center';
      current.style.backgroundRepeat='no-repeat';
      node.dataset.srhPainted='1';
      return true;
    }
    const ready=await preloadHeroImage(src);
    if(!ready||local!==heroToken||heroViewToken!==state.renderToken){if(!ready&&local===heroToken&&heroViewToken===state.renderToken)clearHeroBackground(node,isLive);return false}
    let next=layers.find(x=>x!==current);
    next.classList.remove('is-active');
    next.classList.toggle('is-live',!!isLive);
    next.style.backgroundImage='url("'+src.replace(/"/g,'%22')+'")';
    next.style.backgroundSize='cover';
    next.style.backgroundPosition='center center';
    next.style.backgroundRepeat='no-repeat';
    next.dataset.srhUrl=src;
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(local!==heroToken||heroViewToken!==state.renderToken)return false;
    next.classList.add('is-active');
    current.classList.remove('is-active');
    node.dataset.srhPainted='1';
    setTimeout(()=>{
      if(!current.classList.contains('is-active')){
        current.style.backgroundImage='none';
        current.dataset.srhUrl='';
        current.classList.remove('is-live');
      }
    },920);
    return true;
  }

  function hideHeroLogo(logo){
    if(!logo)return;
    logo.classList.add('is-hidden');
    logo.style.setProperty('display','none','important')
  }
  function showHeroLogo(logo){
    if(!logo)return;
    logo.style.removeProperty('display');
    logo.classList.remove('is-hidden')
  }
  function holdHeroBrand(node,title=''){
    const box=node.querySelector('.stream-hero__brand'),logo=node.querySelector('.stream-hero__logo'),fallback=node.querySelector('.stream-hero__brand-fallback');
    if(!box||!logo||!fallback)return;
    box.classList.remove('srh-logo-flare-light','srh-logo-flare-dark','has-logo','has-fallback','is-ready');
    logo.onload=null;logo.onerror=null;hideHeroLogo(logo);logo.removeAttribute('src');logo.removeAttribute('data-srh-normalized');
    fallback.classList.add('is-hidden');fallback.textContent='';
    box.setAttribute('aria-label',String(title||'').trim())
  }

  function revealHeroBrand(box,local){if(!box||local!==heroToken)return;box.classList.remove('is-ready');requestAnimationFrame(()=>{if(local!==heroToken)return;requestAnimationFrame(()=>{if(local===heroToken)box.classList.add('is-ready')})})}

  function setHeroBrand(node,title,data,local,allowFallback=true){
    const box=node.querySelector('.stream-hero__brand');
    const logo=node.querySelector('.stream-hero__logo');
    const fallback=node.querySelector('.stream-hero__brand-fallback');
    if(!box||!logo||!fallback)return;
    box.classList.remove('srh-logo-flare-light','srh-logo-flare-dark','has-logo','has-fallback','is-ready');
    logo.onload=null;logo.onerror=null;
    hideHeroLogo(logo);
    logo.removeAttribute('src');
    logo.removeAttribute('data-srh-normalized');
    fallback.classList.add('is-hidden');
    fallback.textContent=String(title||'').trim();
    box.setAttribute('aria-label',String(title||'').trim());

    const showFallback=()=>{
      if(local!==heroToken)return;
      logo.onload=null;logo.onerror=null;
      hideHeroLogo(logo);
      logo.removeAttribute('src');
      box.classList.remove('has-logo','is-ready');
      if(!allowFallback){
        fallback.textContent='';
        fallback.classList.add('is-hidden');
        box.classList.remove('has-fallback');
        playbackDebug('hero-clean-logo-display-reject',{mediaId:String(state.activeType==='series'?(state.currentSeries?.item?.series_id||''):'')||'',type:state.activeType,reason:'logo-render-failed'});
        return
      }
      fallback.textContent=String(title||'').trim();
      fallback.classList.remove('is-hidden');
      box.classList.add('has-fallback');
      revealHeroBrand(box,local);
    };

    if(!data?.logo){showFallback();return}

    logo.alt=title||'Logo';
    logo.crossOrigin='anonymous';
    logo.onload=async()=>{
      if(local!==heroToken)return;
      if(logo.dataset.srhNormalized!=='1'&&typeof normalizeCatalogLogo==='function'){
        const normalized=await normalizeCatalogLogo(logo);
        if(local!==heroToken)return;
        if(normalized?.src&&normalized.src!==logo.src){
          logo.dataset.srhNormalized='1';
          logo.src=normalized.src;
          return;
        }
      }
      if(typeof tuneCatalogLogoContrast==='function')await tuneCatalogLogoContrast(logo,box);
      if(local!==heroToken)return;
      fallback.classList.add('is-hidden');
      showHeroLogo(logo);
      box.classList.remove('has-fallback');
      box.classList.add('has-logo');
      revealHeroBrand(box,local);
    };
    logo.onerror=showFallback;
    logo.src=data.logo;
  }

  function heroMetaMarkup(type,data){
    if(type==='live')return 'TV ao vivo';
    const parts=['<span>'+(type==='series'?'Série':'Filme')+'</span>'];
    if(data?.year)parts.push('<span>'+escapeHtml(data.year)+'</span>');
    const vote=Number(data?.vote);
    if(Number.isFinite(vote)&&vote>0)parts.push('<span class="stream-hero__rating">'+UI_ICON_RATING_STAR+'<span>'+vote.toFixed(1).replace('.',',')+'</span></span>');
    return parts.join('<span class="stream-hero__meta-separator" aria-hidden="true"> · </span>');
  }

  function heroCatalogFallback(item){
    const backdrop=String(item?.backdrop_path||item?.backdrop||'').trim();
    const cover=String(item?.cover_big||item?.movie_image||item?.cover||item?.stream_icon||'').trim();
    const overview=String(item?.plot||item?.description||'').trim();
    const year=String(item?.year||String(item?.releasedate||item?.release_date||'').match(/\b(19|20)\d{2}\b/)?.[0]||'').trim();
    const rawVote=item?.rating??item?.vote_average;
    const vote=Number.isFinite(Number(rawVote))?Number(rawVote):null;
    return{backdrop,cover,overview,year,vote}
  }
  function heroNeedsProviderFallback(data,catalog){
    const art=String(data?.backdrop||catalog?.backdrop||catalog?.cover||'').trim();
    const overview=String(data?.overview||catalog?.overview||'').trim();
    return !art||!overview
  }
  function warmHero(index,type){
    const item=heroItems[index];
    if(!item)return;
    if(type==='live'){
      preloadHeroImage(heroImage(item,type,null)).catch(()=>{});
      return;
    }
    heroTmdb(item,type).then(async data=>{
      const catalog=heroCatalogFallback(item);
      let providerArt=null;
      if(heroNeedsProviderFallback(data,catalog))providerArt=await heroProviderArt(item,type);
      const fallback=providerArt?{...catalog,...providerArt}:catalog;
      const jobs=[preloadHeroImage(heroImage(item,type,data,fallback))];
      if(data?.logo)jobs.push(preloadHeroImage(data.logo));
      return Promise.allSettled(jobs)
    }).catch(()=>{});
  }

  async function showHero(index,user=false){
    clearTimeout(heroTimer);
    if(!heroItems.length||heroViewToken!==state.renderToken)return;
    heroIndex=((index%heroItems.length)+heroItems.length)%heroItems.length;
    const local=++heroToken,item=heroItems[heroIndex],type=state.activeType,node=heroHost();
    const plot=node.querySelector('.stream-hero__plot'),metaNode=node.querySelector('.stream-hero__meta'),skeleton=node.querySelector('.stream-hero__skeleton');
    if(node.dataset.srhPainted!=='1')skeleton?.classList.remove('is-hidden');
    node.querySelector('[data-stream-open]').onclick=()=>openItem(item,type);

    const quickTitle=type==='live'?compactChannelTitle(item.baseName||'Canal'):'';
    const quickImage=type==='live'?heroImage(item,type,null):'';
    if(type==='live'){
      setHeroBrand(node,quickTitle,null,local);
      metaNode.textContent='TV ao vivo';
    }else{
      holdHeroBrand(node);
      plot.textContent='';
      metaNode.textContent='';
    }
    const quickPaint=type==='live'
      ?paintHeroBackground(node,quickImage,true,local).then(ok=>{if(ok&&local===heroToken)skeleton?.classList.add('is-hidden')}).catch(()=>false)
      :Promise.resolve(false);

    const fav=node.querySelector('[data-stream-favorite]'),favApi=window.__srhStandardFavorites;
    if(fav){
      const syncFav=()=>{const on=!!favApi?.is?.(type,item);fav.classList.toggle('is-active',on);fav.setAttribute('aria-label',on?'Remover dos favoritos':'Adicionar aos favoritos');fav.querySelector('span').textContent=on?'Favorito':'Favoritar'};
      syncFav();fav.onclick=e=>{e.stopPropagation();favApi?.toggle?.(type,item);syncFav()}
    }
    dots();

    let data=null,providerArt=null,catalogArt=null;
    if(type!=='live'){
      await heroYield();
      if(local!==heroToken||heroViewToken!==state.renderToken)return;
      data=await heroTmdb(item,type);
      if(!data?.logo){
        playbackDebug('hero-logo-reject',{type,mediaId:String(itemId(item,type)||''),reason:'missing-clean-logo'});
        heroItems.splice(heroIndex,1);
        if(!heroItems.length){node.classList.add('is-hidden');return}
        heroIndex%=heroItems.length;dots();setTimeout(()=>showHero(heroIndex),0);return
      }
      catalogArt=heroCatalogFallback(item);
      if(heroNeedsProviderFallback(data,catalogArt))providerArt=await heroProviderArt(item,type);
    }
    if(local!==heroToken||heroViewToken!==state.renderToken||state.activeType!==type)return;

    const fallbackArt=providerArt?{...(catalogArt||{}),...providerArt}:(catalogArt||{});
    const title=type==='live'?compactChannelTitle(item.baseName||'Canal'):stripEmoji(data?.title||itemTitle(item),'Sem título');
    const heroOverview=String(data?.overview||fallbackArt?.overview||'').trim();
    const heroData=type==='live'?data:{...(fallbackArt||{}),...(data||{}),overview:heroOverview,year:data?.year||fallbackArt?.year||'',vote:data?.vote??fallbackArt?.vote??null};
    const image=heroImage(item,type,data,fallbackArt);
    const heroArtSource=type==='live'?'live':data?.backdrop?'tmdb':providerArt?.backdrop?'provider-backdrop':providerArt?.cover?'provider-cover':fallbackArt?.backdrop?'catalog-backdrop':fallbackArt?.cover?'catalog-cover':'none';
    let brandData=heroData;
    if(type!=='live'&&data?.logo){
      const logoReady=await preloadHeroCleanLogo(data.logo,5000).catch(()=>false);
      if(!logoReady){
        playbackDebug('hero-logo-reject',{type,mediaId:String(itemId(item,type)||''),reason:'logo-load-failed'});
        heroItems.splice(heroIndex,1);
        if(!heroItems.length){node.classList.add('is-hidden');return}
        heroIndex%=heroItems.length;dots();setTimeout(()=>showHero(heroIndex),0);return
      }
    }

    await quickPaint;
    if(local!==heroToken||heroViewToken!==state.renderToken||state.activeType!==type)return;

    if(type!=='live'){
      await paintHeroBackground(node,image,false,local).catch(()=>false);
      if(local!==heroToken||heroViewToken!==state.renderToken||state.activeType!==type)return;
      playbackDebug('hero-tmdb-package',{
        mediaId:String(itemId(item,type)||''),
        type,
        backdrop:!!data?.backdrop,
        providerBackdrop:!!providerArt?.backdrop,
        providerCover:!!providerArt?.cover,
        providerRequested:!!providerArt,
        artSource:heroArtSource,
        logo:!!data?.logo,
        overviewChars:Array.from(heroOverview).length,
        overviewSource:data?.overview?'tmdb':providerArt?.overview?'provider':'catalog',
        year:String(heroData?.year||''),
        vote:heroData?.vote??null
      });
    }

    setHeroBrand(node,title,brandData,local,type==='live');
    plot.textContent=type==='live'?'':heroSynopsis(heroOverview,200);
    metaNode.innerHTML=heroMetaMarkup(type,heroData);
    skeleton?.classList.add('is-hidden');

    heroTimer=setTimeout(()=>{
      if(!heroIsVisible()){heroTimer=setTimeout(()=>showHero(heroIndex),1000);return}
      const bucket=Math.floor(Date.now()/HERO_SET_MS);
      if(bucket!==heroSetBucket||Date.now()>=heroSetExpiresAt){buildHero(state.renderToken);return}
      showHero(heroIndex+1)
    },user?8500:7000);
    warmHero((heroIndex+1)%Math.max(1,heroItems.length),type);
  }

  async function buildHero(token){
    const node=heroHost(),type=state.activeType,bucket=Math.floor(Date.now()/HERO_SET_MS),targets=targetsFor(type);
    if(type==='series'&&seriesProviderGuardBlocked()){node.classList.add('is-hidden');playbackDebug('hero-suppressed',{type,reason:'series-provider-guard'});return}
    if(node.dataset.srhPainted!=='1')node.querySelector('.stream-hero__skeleton')?.classList.remove('is-hidden');
    heroSetBucket=bucket;heroSetExpiresAt=(bucket+1)*HERO_SET_MS;

    let cachePainted=false;
    if(type!=='live'){
      const cached=await readHeroPrecache(type,targets).catch(()=>[]);
      if(token!==state.renderToken||state.activeType!==type)return;
      if(cached.length){
        heroItems=cached.slice(0,HERO_PRECACHE_LIMIT);heroIndex=0;heroSetMode='precache';cachePainted=true;
        node.classList.remove('is-hidden');
        playbackDebug('hero-set',{type,mode:'precache',bucket,count:heroItems.length,cleanLogoOnly:true,expiresAt:heroSetExpiresAt});
        showHero(0)
      }
    }

    const last=type==='live'?null:(getStandardLastWatched(type)||getHistory(type)[0]||null),mode=await heroCycleMode(type,bucket,!!last);
    if(token!==state.renderToken||state.activeType!==type)return;
    heroSetMode=mode;

    let fresh=[];
    if(type==='live'){
      const liveTargets=targets.slice(0,Math.min(5,targets.length)),lists=[];
      for(let i=0;i<liveTargets.length&&lists.flat().length<32;i++){
        if(token!==state.renderToken)return;
        try{const raw=await loadTargetItems(liveTargets[i],token,{priority:100-i});if(token!==state.renderToken)return;lists.push(heroSample(raw,type,bucket+i,i===0?72:48))}catch{}
      }
      let items=lists.flat(),seen=new Set();
      items=items.filter(item=>{const key=item.baseName||itemTitle(item);if(!key||seen.has(key))return false;seen.add(key);return true});
      fresh=stableShuffle(items,type,bucket).slice(0,10)
    }else{
      fresh=await collectCleanLogoHeroItems(targets,type,token,bucket,HERO_PRECACHE_LIMIT)
    }
    if(token!==state.renderToken||state.activeType!==type)return;

    if(fresh.length){
      heroItems=fresh.slice(0,HERO_PRECACHE_LIMIT);heroIndex=0;
      if(type!=='live')void writeHeroPrecache(type,heroItems,targets);
      node.classList.remove('is-hidden');
      playbackDebug('hero-set',{type,mode:'auto-fast',requestedMode:mode,bucket,count:heroItems.length,cleanLogoOnly:type!=='live',cacheReplaced:cachePainted,expiresAt:heroSetExpiresAt});
      showHero(0)
    }else if(!cachePainted){
      node.classList.add('is-hidden');
      playbackDebug('hero-suppressed',{type,reason:type==='live'?'empty':'no-clean-logo'});
      return
    }else{
      heroSetMode='precache';
      playbackDebug('hero-precache-retained',{type,count:heroItems.length,reason:'fresh-empty'})
    }

    if(mode==='recommended'&&last&&window.__srhStandardRecommendations?.get){
      setTimeout(async()=>{
        if(token!==state.renderToken||state.activeType!==type)return;
        let recommended=[];try{recommended=await window.__srhStandardRecommendations.get(type,last,24,{budgetMs:12000})}catch{}
        if(token!==state.renderToken||state.activeType!==type||recommended.length<10)return;
        const recommendedItems=recommended.map(x=>x.item),filtered=type==='live'?recommendedItems.slice(0,10):await heroItemsWithCleanLogo(recommendedItems,type,token,HERO_PRECACHE_LIMIT);
        if(token!==state.renderToken||state.activeType!==type||filtered.length<HERO_PRECACHE_LIMIT)return;
        heroSetMode='recommended';heroItems=filtered.slice(0,HERO_PRECACHE_LIMIT);heroIndex=0;
        if(type!=='live')void writeHeroPrecache(type,heroItems,targets);
        playbackDebug('hero-set-upgrade',{type,mode:'recommended',bucket,count:heroItems.length,cleanLogoOnly:type!=='live'});
        showHero(0)
      },650)
    }else if(!cachePainted||fresh.length)heroSetMode='auto'
  }

  const baseRenderActiveType=renderActiveType;
  renderActiveType=function(){
    clearTimeout(heroTimer);
    heroToken++;heroItems=[];
    clearHeroVisual(heroHost(),state.activeType==='live');
    const out=baseRenderActiveType();
    heroViewToken=state.renderToken;
    const token=state.renderToken,targets=targetsFor(state.activeType);
    buildHero(token);
    requestAnimationFrame(()=>{
      if(token!==state.renderToken)return;
      const first=el.content.querySelector('.rail-section[data-target="0"]'),target=targets[0];
      if(first&&target&&!first.dataset.loaded){
        first.dataset.loaded='1';state.categoryObserver?.unobserve(first);
        renderRail(first,target,token)
      }
    });
    return out;
  };

  const baseMainStreamCardDataName=cardDataName;
  cardDataName=function(item,type){const name=baseMainStreamCardDataName(item,type);return type==='live'?compactChannelTitle(name):name};

  const baseRailMetrics=RailVirtualizer.prototype.metrics;
  RailVirtualizer.prototype.metrics=function(){
    const live=this.type==='live';
    const w=innerWidth<680?(live?124:116):(live?178:168);
    const gap=innerWidth<680?8:10,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));
    return{w,gap,slot,visible};
  };

  const baseGridMetrics=GridVirtualizer.prototype.metrics;
  GridVirtualizer.prototype.metrics=function(){
    const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:12,live=this.type==='live',base=live?150:142;
    const cols=innerWidth<680?3:Math.max(4,Math.floor((available+gap)/(base+gap)));
    const w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
    return{available,gap,cols,w,h,rowH};
  };

  if(state.activeType)buildHero(state.renderToken);
})();

/* SRHELL DEBUG STANDARD R56 — modal lifecycle + skeleton scroll guard */
(function installStandardR56Guards(){
  if(el.detailClose){
    let closing=false;
    el.detailClose.onclick=async e=>{
      e?.stopPropagation?.();
      if(closing)return;
      closing=true;
      try{await closeDetail()}finally{closing=false}
    };
  }
  let scrollTimer=0;
  const markSkeletonScroll=()=>{
    if(!document.body.classList.contains('srh-skeleton-scrolling'))document.body.classList.add('srh-skeleton-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>document.body.classList.remove('srh-skeleton-scrolling'),180)
  };
  addEventListener('scroll',markSkeletonScroll,{passive:true});
  el.detailScroll?.addEventListener?.('scroll',markSkeletonScroll,{passive:true});
})();

/* Floating classic header: hero/content passes underneath; hide only beyond first category. */
(function installClassicFloatingHeader(){
  const topbar=document.querySelector('.topbar');if(!topbar)return;
  let raf=0;
  const sync=()=>{
    raf=0;
    if(state.collectionOpen||document.body.classList.contains('srh-searching')){
      document.body.classList.remove('srh-topbar-hidden');
      return
    }
    const first=el.content?.querySelector('.rail-section');
    if(!first){document.body.classList.remove('srh-topbar-hidden');return}
    const boundary=Math.max(6,Math.round(topbar.getBoundingClientRect().height*.18));
    const passed=first.getBoundingClientRect().top<=boundary;
    document.body.classList.toggle('srh-topbar-hidden',passed)
  };
  const schedule=()=>{if(raf)return;raf=requestAnimationFrame(sync)};
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('.tab-button[data-type],.collection-close,[data-stream-open]'))setTimeout(schedule,60)},true);
  const baseHeaderRender=renderActiveType;
  renderActiveType=function(){const out=baseHeaderRender.apply(this,arguments);requestAnimationFrame(()=>requestAnimationFrame(sync));return out};
  requestAnimationFrame(sync)
})();
Promise.resolve().then(()=>hydrateStandardRuntime()).then(()=>window.__srhHydrateStandardPersonal?.()).catch(e=>playbackDebug('indexeddb-hydrate-failed',{message:e?.message||String(e)})).finally(()=>{playbackDebug('indexeddb-ready',{db:STANDARD_DB,provider:standardProviderId(),storage:window.__SRH_STANDARD_STORAGE__?.stats?.()||{}});init();setTimeout(()=>ensureHls().then(()=>playbackDebug('hlsjs-warm',{version:window.Hls?.version||''})).catch(e=>playbackDebug('hlsjs-warm-failed',{message:e?.message||String(e)})),700)});
})();
})();
