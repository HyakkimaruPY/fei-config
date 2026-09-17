/* ===== runtime/shorts/01.js ===== */
(()=>{
'use strict';
const BASE_CONFIG=JSON.parse(document.getElementById('app-config').textContent),$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const APP_ID=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const el={title:$('#appTitle'),meta:$('#appMeta'),daysChip:$('#daysChip'),historyButton:$('#historyButton'),historyDot:$('#historyDot'),searchButton:$('#searchButton'),searchWrap:$('#searchWrap'),search:$('#shortSearch'),settingsButton:$('#settingsButton'),settingsPanel:$('#settingsPanel'),expiryDate:$('#expiryDate'),expiryDays:$('#expiryDays'),updateAccordionButton:$('#updateAccordionButton'),updateAccordionBody:$('#updateAccordionBody'),updateAccordionIcon:$('#updateAccordionIcon'),updateM3u:$('#updateM3uInput'),updateLoad:$('#updateLoadButton'),updateApply:$('#updateApplyButton'),updateStatus:$('#updateStatus'),updateGroups:$('#updateGroups'),favoritesButton:$('#favoritesButton'),homeStatus:$('#homeStatus'),feedScroller:$('#feedScroller'),feedSpacer:$('#feedSpacer'),historyView:$('#historyView'),historyClose:$('#historyClose'),historyGrid:$('#historyGrid'),favoritesView:$('#favoritesView'),favoritesClose:$('#favoritesClose'),favoritesGrid:$('#favoritesGrid'),shortPlayer:$('#shortPlayer'),shortStage:$('#shortStage'),shortVideo:$('#shortVideo'),shortTitle:$('#shortTitle'),shortClose:$('#shortClose'),arcPrev:$('#arcPrev'),shortArcs:$('#shortArcs'),arcNext:$('#arcNext'),shortFavorite:$('#shortFavorite'),arcDrawer:$('#arcDrawer'),arcHead:$('#arcHead'),arcGrid:$('#arcGrid'),toast:$('#toast')};
const key={runtime:`srhell:${APP_ID}:shorts:runtime`,history:`srhell:${APP_ID}:shorts:continue`,favorites:`srhell:${APP_ID}:shorts:favorites`};
function readJson(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??fallback}catch{return fallback}}
function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
let CONFIG={...BASE_CONFIG,...readJson(key.runtime,{})};
const state={categoryMap:null,items:[],filteredItems:null,hls:null,current:null,saveTick:0,pointerStart:null,gridSig:'',durationCache:{},probeQueue:[],probeQueued:new Set(),probeWanted:new Set(),probeActive:0,updateCandidate:null,updateCategories:[],updateSelected:new Set(),searchTimer:0};
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function cleanCategoryName(value){let x=String(value||'');try{x=x.replace(/\p{Extended_Pictographic}/gu,'')}catch{}return x.replace(/[\uFE0F\u200D]/g,'').replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/^[\s|•·:;,_—–-]+|[\s|•·:;,_—–-]+$/g,'').replace(/\s{2,}/g,' ').trim()||'Categoria'}
function normalizeServer(s){return String(s||'').trim().replace(/\/+$/,'')}
function toast(msg){el.toast.textContent=msg;el.toast.classList.add('is-show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.toast.classList.remove('is-show'),2200)}
const IMAGE_PLACEHOLDER='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#20242b"/><stop offset="1" stop-color="#111318"/></linearGradient></defs><rect width="180" height="300" rx="10" fill="url(#g)"/><path d="M55 168l25-27 18 18 17-14 24 28" fill="none" stroke="#7f8792" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="113" cy="112" r="10" fill="none" stroke="#7f8792" stroke-width="5"/><rect x="40" y="88" width="100" height="96" rx="10" fill="none" stroke="#59616d" stroke-width="4"/></svg>`);
function installImageFallback(){document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.fallback==='1')return;img.dataset.fallback='1';img.classList.add('image-fallback');img.src=IMAGE_PLACEHOLDER},true)}
function parseLogin(raw){let text=String(raw||'').trim();if(!text)throw new Error('Informe o novo M3U.');if(!/^https?:\/\//i.test(text))text='http://'+text;let u;try{u=new URL(text)}catch{throw new Error('URL inválida.')}let username=u.searchParams.get('username')||u.searchParams.get('user'),password=u.searchParams.get('password')||u.searchParams.get('pass');const path=u.pathname.split('/').filter(Boolean);if((!username||!password)&&path.length>=2&&!/\.php$/i.test(path[path.length-1])){username=username||decodeURIComponent(path[0]);password=password||decodeURIComponent(path[1])}if(!username||!password)throw new Error('Não encontrei username e password.');return{server:normalizeServer(u.origin),username,password,liveExtension:(u.searchParams.get('output')||'m3u8').toLowerCase()==='ts'?'ts':'m3u8'}}
function apiUrl(params={},cfg=CONFIG){const u=new URL(normalizeServer(cfg.server)+'/player_api.php');u.searchParams.set('username',cfg.username);u.searchParams.set('password',cfg.password);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));return u.toString()}
function proxyUrl(url,cfg=CONFIG){const p=String(cfg.corsProxy||'').trim();if(!p)return url;return p.includes('{url}')?p.replace('{url}',encodeURIComponent(url)):p+encodeURIComponent(url)}
async function request(params={},cfg=CONFIG){const target=apiUrl(params,cfg);try{const r=await fetch(target,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(first){if(!cfg.corsProxy)throw new Error(first.message+' — possivelmente CORS.');const r=await fetch(proxyUrl(target,cfg),{cache:'no-store'});if(!r.ok)throw new Error('Proxy HTTP '+r.status);return await r.json()}}
function formatExpiry(account){const raw=account?.user_info?.exp_date;if(raw===null||raw===undefined||raw===''||String(raw)==='0')return{chip:'∞',date:'Sem expiração informada',days:'Sem limite informado'};const n=Number(raw);if(!Number.isFinite(n))return{chip:'—',date:'Não informada',days:'Não informado'};const d=new Date(n*1000);if(Number.isNaN(d.getTime()))return{chip:'—',date:'Não informada',days:'Não informado'};const diff=Math.ceil((d.getTime()-Date.now())/86400000);return{chip:diff<0?'0d':diff+'d',date:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}),days:diff<0?'Expirada':diff===0?'Expira hoje':diff===1?'1 dia restante':diff+' dias restantes'}}
async function refreshAccount(){el.meta.textContent='Atualizando validade…';try{const account=await request({});const exp=formatExpiry(account);el.daysChip.textContent=exp.chip;el.expiryDate.textContent=exp.date;el.expiryDays.textContent=exp.days;const status=String(account?.user_info?.status||'').trim();el.meta.textContent=(status?status+' · ':'')+exp.days}catch{el.daysChip.textContent='—';el.expiryDate.textContent='Indisponível';el.expiryDays.textContent='Não foi possível consultar';el.meta.textContent='Falha ao consultar validade'}}
function itemTitle(item){return item?.name||item?.title||'Sem título'}function itemImage(item){return item?.stream_icon||item?.movie_image||item?.cover||''}function itemId(item){return String(item?.stream_id??'')}
function mediaLoaderMarkup(label='Carregando'){return `<div class="media-loader"><div class="media-loader__core"><span class="media-loader__ring"></span><span class="media-loader__label">${escapeHtml(label)}</span></div></div>`}
function streamUrl(item,cfg=CONFIG){return `${normalizeServer(cfg.server)}/movie/${encodeURIComponent(cfg.username)}/${encodeURIComponent(cfg.password)}/${item.stream_id}.${item.container_extension||'mp4'}`}
async function categoryMap(force=false,cfg=CONFIG){if(!force&&cfg===CONFIG&&state.categoryMap)return state.categoryMap;const raw=await request({action:'get_vod_categories'},cfg);const map=new Map((Array.isArray(raw)?raw:[]).map(c=>[String(c.category_name??c.name??''),String(c.category_id??c.id??'')]));if(cfg===CONFIG)state.categoryMap=map;return map}
async function loadTargetItems(target){const map=await categoryMap(),id=map.get(target.name);if(!id)throw new Error('Categoria não encontrada: '+cleanCategoryName(target.name));const raw=await request({action:'get_vod_streams',category_id:id});return Array.isArray(raw)?raw:[]}
function compactShort(item){return{stream_id:item?.stream_id,name:itemTitle(item),stream_icon:itemImage(item),container_extension:item?.container_extension||'mp4',duration:item?.duration||item?.duration_secs||'',duration_secs:item?.duration_secs||0}}
async function loadMergedItems(){const targets=(CONFIG.targets||[]).filter(t=>t.type==='vod'),seen=new Set(),out=[];for(const target of targets){try{const list=await loadTargetItems(target);for(const raw of list){const id=itemId(raw)||itemTitle(raw);if(seen.has(id))continue;seen.add(id);out.push(compactShort(raw))}}catch{}}return out}
function parseDurationText(v){if(Number.isFinite(Number(v))&&Number(v)>0)return Number(v);const s=String(v||'').trim();if(!s)return 0;const p=s.split(':').map(Number);if(p.some(x=>!Number.isFinite(x)))return 0;if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1];return 0}
function durationFrom(item,data){const info=data?.info||{},movie=data?.movie_data||{};return parseDurationText(item?.duration_secs||item?.duration||info.duration_secs||info.duration||movie.duration_secs||movie.duration)}
function durationFor(item){const id=itemId(item);return Number(state.durationCache[id]||durationFrom(item)||0)}

/* ===== runtime/shorts/02.js ===== */
function arcCount(seconds){return seconds>0?Math.max(1,Math.ceil(seconds/600)):0}
function saveDuration(id,seconds){if(!id||!Number.isFinite(seconds)||seconds<=0)return;state.durationCache[id]=Math.round(seconds);const entries=Object.entries(state.durationCache);if(entries.length>260)state.durationCache=Object.fromEntries(entries.slice(-220));updateArcBadges(id)}
function updateArcBadges(id){const sec=Number(state.durationCache[id]||0),count=arcCount(sec);document.querySelectorAll('[data-stream-id]').forEach(card=>{if(String(card.dataset.streamId)!==String(id))return;const n=card.querySelector('.arc-badge');if(n)n.textContent=count?count+' arco'+(count>1?'s':''):'…'})}
function setProbeWindow(items){state.probeWanted=new Set(items.map(itemId).filter(Boolean));state.probeQueue=state.probeQueue.filter(x=>state.probeWanted.has(itemId(x)));for(const item of items)queueDurationProbe(item);runProbeQueue()}
function queueDurationProbe(item){const id=itemId(item);if(!id||!state.probeWanted.has(id)||durationFor(item)>0||state.probeQueued.has(id))return;state.probeQueued.add(id);state.probeQueue.push(item)}
function runProbeQueue(){while(state.probeActive<3&&state.probeQueue.length){const item=state.probeQueue.shift(),id=itemId(item);if(!state.probeWanted.has(id)){state.probeQueued.delete(id);continue}state.probeActive++;request({action:'get_vod_info',vod_id:id}).then(data=>{const d=durationFrom(item,data);if(d>0)saveDuration(id,d)}).catch(()=>{}).finally(()=>{state.probeActive--;runProbeQueue()})}}
function history(){return readJson(key.history,[])}function favorites(){return readJson(key.favorites,[])}
function saveHistory(entry){let list=history().filter(x=>x.key!==entry.key);list.unshift(entry);writeJson(key.history,list.slice(0,60));updateHistoryButton()}
function removeHistory(k){writeJson(key.history,history().filter(x=>x.key!==k));updateHistoryButton()}
function updateHistoryButton(){el.historyDot.classList.toggle('is-hidden',!history().some(x=>x.duration>0&&x.position>5&&x.position/x.duration<.97))}
function isFavorite(id){return favorites().some(x=>String(x.streamId)===String(id))}
function toggleFavorite(){if(!state.current)return;let list=favorites(),id=state.current.streamId;if(list.some(x=>String(x.streamId)===String(id))){list=list.filter(x=>String(x.streamId)!==String(id));toast('Removido dos favoritos')}else{list.unshift({streamId:id,title:state.current.title,image:state.current.image,containerExtension:state.current.containerExtension});toast('Adicionado aos favoritos')}writeJson(key.favorites,list.slice(0,100));drawFavoriteState()}
function playableFromSaved(x){return{stream_id:x.streamId,name:x.title,stream_icon:x.image,container_extension:x.containerExtension||'mp4'}}
function drawSavedGrid(root,list,kind){if(!list.length){root.innerHTML='<div class="skeleton">Nenhum item aqui.</div>';return}root.innerHTML=list.map((x,i)=>`<article class="history-card" data-saved="${i}"><img src="${escapeHtml(x.image||IMAGE_PLACEHOLDER)}" alt="" loading="lazy"><div class="history-card__shade"></div><div class="history-card__meta">${escapeHtml(x.title||'')}</div>${kind==='history'?`<div class="history-card__progress"><span style="width:${Math.min(100,(x.position||0)/(x.duration||1)*100)}%"></span></div>`:''}</article>`).join('');root.querySelectorAll('[data-saved]').forEach(c=>c.onclick=()=>{const x=list[Number(c.dataset.saved)];if(!x)return;root.closest('.overlay').classList.add('is-hidden');openShort(playableFromSaved(x),kind==='history'?x.position:0)})}
function openHistory(){const list=history().filter(x=>x.duration>0&&x.position>5&&x.position/x.duration<.97);drawSavedGrid(el.historyGrid,list,'history');el.historyView.classList.remove('is-hidden')}
function openFavorites(){drawSavedGrid(el.favoritesGrid,favorites(),'favorites');el.favoritesView.classList.remove('is-hidden')}
el.historyButton.onclick=openHistory;el.historyClose.onclick=()=>el.historyView.classList.add('is-hidden');el.favoritesClose.onclick=()=>el.favoritesView.classList.add('is-hidden');el.favoritesButton.onclick=openFavorites;el.historyView.addEventListener('click',e=>{if(e.target===el.historyView)el.historyView.classList.add('is-hidden')});el.favoritesView.addEventListener('click',e=>{if(e.target===el.favoritesView)el.favoritesView.classList.add('is-hidden')});
function currentShortItems(){return state.filteredItems||state.items}
function gridMetrics(){const cs=getComputedStyle(el.feedScroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),width=Math.max(220,el.feedScroller.clientWidth-pad),cols=innerWidth>=1200?12:innerWidth>=900?6:2,gap=innerWidth>=900?10:8,cardW=(width-gap*(cols-1))/cols,rowH=cardW*1.5+gap,visibleRows=Math.max(1,Math.ceil(el.feedScroller.clientHeight/rowH));return{width,cols,gap,cardW,rowH,visibleRows}}
function renderGrid(force=false){const items=currentShortItems();if(!items.length){el.feedSpacer.style.height='auto';el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';return}const m=gridMetrics(),first=Math.max(0,Math.floor(el.feedScroller.scrollTop/m.rowH)-1),rows=Math.ceil(items.length/m.cols),last=Math.min(rows,first+m.visibleRows*2+1),sig=[first,last,m.cols,Math.round(m.cardW),items.length].join(':');if(!force&&sig===state.gridSig)return;state.gridSig=sig;el.feedSpacer.style.height=(rows*m.rowH)+'px';let html='',probeItems=[];const hmap=new Map(history().map(x=>[String(x.streamId),x]));for(let r=first;r<last;r++)for(let c=0;c<m.cols;c++){const idx=r*m.cols+c;if(idx>=items.length)break;const item=items[idx],id=itemId(item),sec=durationFor(item),count=arcCount(sec),h=hmap.get(id),pct=h?.duration?Math.min(100,h.position/h.duration*100):0;probeItems.push(item);html+=`<article class="short-card" data-index="${idx}" data-stream-id="${escapeHtml(id)}" style="left:${c*(m.cardW+m.gap)}px;top:${r*m.rowH}px;width:${m.cardW}px;height:${m.cardW*1.5}px"><img class="short-card__image" src="${escapeHtml(itemImage(item)||IMAGE_PLACEHOLDER)}" alt="" loading="lazy" decoding="async"><div class="short-card__shade"></div><div class="arc-badge">${count?count+' arco'+(count>1?'s':''):'…'}</div>${pct>0?`<div class="card-progress"><span style="width:${pct}%"></span></div>`:''}</article>`}el.feedSpacer.innerHTML=html;setProbeWindow(probeItems);el.feedSpacer.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>openShort(items[Number(c.dataset.index)],0))}
el.feedScroller.addEventListener('scroll',()=>renderGrid(),{passive:true});new ResizeObserver(()=>renderGrid(true)).observe(el.feedScroller);
function uniqueMediaUrls(values){const out=[];for(const raw of values||[]){const v=String(raw||'').trim();if(v&&!out.includes(v))out.push(v)}return out}function httpsTwin(url){return /^http:\/\//i.test(String(url||''))?String(url).replace(/^http:/i,'https:'):''}function normalizeMediaUrl(v){v=String(v||'').trim();if(/^https?:\/\//i.test(v))return v;if(v.startsWith('/'))return normalizeServer(CONFIG.server)+v;return''}
function vodSourcesFromInfo(data,item){const info=data?.info||{},movie=data?.movie_data||item,direct=normalizeMediaUrl(movie?.direct_source||info?.direct_source||data?.direct_source||''),merged={...item,...movie,stream_id:movie.stream_id||item.stream_id,container_extension:movie.container_extension||item.container_extension},standard=streamUrl(merged),hls=`${normalizeServer(CONFIG.server)}/movie/${encodeURIComponent(CONFIG.username)}/${encodeURIComponent(CONFIG.password)}/${merged.stream_id}.m3u8`;return uniqueMediaUrls([direct,httpsTwin(direct),standard,httpsTwin(standard),hls,httpsTwin(hls)])}
function destroyHls(){if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}}
function mediaErrorInfo(video,extra){const e=video?.error,code=e?.code||0,map={1:'reprodução interrompida',2:'erro de rede ao carregar a mídia',3:'o navegador não conseguiu decodificar o vídeo',4:'formato ou codec não suportado'};return{code,message:extra?.details||extra?.type||map[code]||'falha de mídia'}}
function attachCandidates(candidates,onReady,onError){const queue=uniqueMediaUrls(candidates),v=el.shortVideo;let i=0,last=null,done=false;const next=()=>{if(done)return;if(i>=queue.length){done=true;onError?.(last);return}const current=queue[i++];destroyHls();v.pause();v.onerror=null;v.onloadedmetadata=null;v.removeAttribute('src');v.load();const fail=extra=>{last=mediaErrorInfo(v,extra);next()},ready=()=>{if(done)return;done=true;onReady?.(current);v.play().catch(()=>{})},isHls=/\.m3u8(?:$|\?)/i.test(current);if(isHls&&window.Hls&&Hls.isSupported()){state.hls=new Hls({enableWorker:true,maxBufferLength:30});state.hls.loadSource(current);state.hls.attachMedia(v);state.hls.on(Hls.Events.MANIFEST_PARSED,ready);state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)})}else{v.src=current;v.onloadedmetadata=ready;v.onerror=()=>fail();v.load();v.play().catch(()=>{})}};next()}
async function fallbackSources(item,primary){try{return vodSourcesFromInfo(await request({action:'get_vod_info',vod_id:item.stream_id}),item).filter(x=>!primary.includes(x))}catch{return[]}}
function isMobile(){return matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<1000}async function enterPortraitFullscreen(){if(!isMobile())return;try{if(el.shortPlayer.requestFullscreen&&!document.fullscreenElement)await el.shortPlayer.requestFullscreen();if(screen.orientation?.lock)try{await screen.orientation.lock('portrait')}catch{}}catch{}}async function leavePortraitFullscreen(){try{screen.orientation?.unlock?.()}catch{}try{if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen()}catch{}}

/* ===== runtime/shorts/03.js ===== */
function drawFavoriteState(){el.shortFavorite.classList.toggle('is-active',!!(state.current&&isFavorite(state.current.streamId)))}
function drawArcs(){const d=el.shortVideo.duration;if(!Number.isFinite(d)||d<=0){el.arcGrid.innerHTML='<div class="update-status">Duração indisponível.</div>';return}const count=Math.max(1,Math.ceil(d/600)),current=Math.min(count-1,Math.floor(el.shortVideo.currentTime/600));el.arcHead.textContent=count+' arco(s) · 10 min cada';el.arcGrid.innerHTML=Array.from({length:count},(_,i)=>`<button class="arc-button${i===current?' is-active':''}" data-arc="${i}">Arco ${i+1}<br><small>${Math.floor(i*10)} min</small></button>`).join('');el.arcGrid.querySelectorAll('[data-arc]').forEach(b=>b.onclick=e=>{e.stopPropagation();seekArc(Number(b.dataset.arc));el.arcDrawer.classList.add('is-hidden')})}
function seekArc(index){const d=el.shortVideo.duration;if(!Number.isFinite(d)||d<=0)return;const count=Math.max(1,Math.ceil(d/600)),i=Math.max(0,Math.min(count-1,index));el.shortVideo.currentTime=Math.min(i*600,Math.max(0,d-.25));el.shortVideo.play().catch(()=>{});drawArcs()}
function currentArc(){return Math.max(0,Math.floor((el.shortVideo.currentTime||0)/600))}
function persistProgress(){if(!state.current)return;const v=el.shortVideo;if(!Number.isFinite(v.duration)||v.duration<=0||!Number.isFinite(v.currentTime))return;saveDuration(state.current.streamId,v.duration);if(v.currentTime/v.duration>=.97){removeHistory(state.current.key);return}saveHistory({...state.current,position:v.currentTime,duration:v.duration,updatedAt:Date.now()})}
function openShort(item,resumeAt=0){if(!item?.stream_id)return;const old=history().find(x=>String(x.streamId)===String(item.stream_id));state.current={key:'vod:'+item.stream_id,streamId:item.stream_id,title:itemTitle(item),image:itemImage(item),containerExtension:item.container_extension||'mp4',position:0,duration:0};state.saveTick=0;el.shortTitle.textContent=state.current.title;el.arcDrawer.classList.add('is-hidden');el.shortPlayer.classList.remove('is-hidden');drawFavoriteState();enterPortraitFullscreen();const first=streamUrl(item),primary=uniqueMediaUrls([first,httpsTwin(first)]),ready=()=>{const p=resumeAt>5?resumeAt:(old?.position||0);if(Number.isFinite(el.shortVideo.duration)&&el.shortVideo.duration>0){saveDuration(item.stream_id,el.shortVideo.duration);if(p>5&&p<el.shortVideo.duration-5)el.shortVideo.currentTime=p}drawArcs()},finalFail=err=>toast('Falha de reprodução: '+(err?.message||'mídia indisponível'));attachCandidates(primary,ready,async err=>{const extra=await fallbackSources(item,primary);if(extra.length)attachCandidates(extra,ready,finalFail);else finalFail(err)})}
async function closeShort(){persistProgress();el.shortVideo.pause();destroyHls();el.arcDrawer.classList.add('is-hidden');el.shortPlayer.classList.add('is-hidden');await leavePortraitFullscreen();state.current=null;renderGrid(true)}
el.shortVideo.addEventListener('timeupdate',()=>{if(++state.saveTick%20===0)persistProgress();if(!el.arcDrawer.classList.contains('is-hidden')&&state.saveTick%10===0)drawArcs()});el.shortVideo.addEventListener('pause',persistProgress);el.shortVideo.addEventListener('ended',()=>{if(state.current)removeHistory(state.current.key)});el.shortVideo.addEventListener('loadedmetadata',()=>{if(state.current)saveDuration(state.current.streamId,el.shortVideo.duration);drawArcs()});el.shortClose.onclick=closeShort;el.arcPrev.onclick=e=>{e.stopPropagation();seekArc(currentArc()-1)};el.arcNext.onclick=e=>{e.stopPropagation();seekArc(currentArc()+1)};el.shortArcs.onclick=e=>{e.stopPropagation();el.arcDrawer.classList.toggle('is-hidden');drawArcs()};el.shortFavorite.onclick=e=>{e.stopPropagation();toggleFavorite()};el.shortStage.addEventListener('click',e=>{if(!e.target.closest('#arcDrawer')&&!e.target.closest('#shortArcs'))el.arcDrawer.classList.add('is-hidden')});el.shortStage.addEventListener('pointerdown',e=>{state.pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId};try{el.shortStage.setPointerCapture(e.pointerId)}catch{}},{passive:true});el.shortStage.addEventListener('pointerup',e=>{const p=state.pointerStart;state.pointerStart=null;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y,threshold=Math.max(90,innerWidth*.16);if(dx>threshold&&Math.abs(dx)>Math.abs(dy)*1.25)closeShort()},{passive:true});
function normalizeUpdate(raw){return(Array.isArray(raw)?raw:[]).map((c,i)=>({type:'vod',name:String(c.category_name??c.name??('Categoria '+(i+1)))}))}function renderUpdateGroups(){const cats=state.updateCategories;el.updateGroups.innerHTML=cats.length?`<section class="update-group"><div class="update-group__title">Categorias de Shorts</div><div class="update-list">${cats.map(c=>{const k='vod::'+c.name;return `<label class="update-option"><input type="checkbox" data-update-key="${escapeHtml(k)}" ${state.updateSelected.has(k)?'checked':''}><span>${escapeHtml(cleanCategoryName(c.name))}</span></label>`}).join('')}</div></section>`:'';el.updateGroups.querySelectorAll('[data-update-key]').forEach(ch=>ch.onchange=()=>{ch.checked?state.updateSelected.add(ch.dataset.updateKey):state.updateSelected.delete(ch.dataset.updateKey);el.updateApply.disabled=!state.updateSelected.size})}
async function loadUpdateCategories(){state.updateCategories=[];state.updateSelected.clear();el.updateApply.disabled=true;el.updateGroups.innerHTML='';try{const candidate={...CONFIG,...parseLogin(el.updateM3u.value)};state.updateCandidate=candidate;el.updateStatus.textContent='Validando login e lendo categorias de filmes…';el.updateLoad.disabled=true;const account=await request({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');if(!active)throw new Error('O novo login não retornou uma conta ativa.');state.updateCategories=normalizeUpdate(await request({action:'get_vod_categories'},candidate));const old=new Set((CONFIG.targets||[]).map(t=>'vod::'+t.name));state.updateCategories.forEach(c=>{const k='vod::'+c.name;if(old.has(k))state.updateSelected.add(k)});renderUpdateGroups();el.updateStatus.textContent=state.updateCategories.length+' categorias disponíveis. As selecionadas serão mescladas em um único feed.'}catch(e){el.updateStatus.textContent=e.message}finally{el.updateLoad.disabled=false}}
function applyUpdate(){if(!state.updateCandidate||!state.updateSelected.size)return;const targets=state.updateCategories.filter(c=>state.updateSelected.has('vod::'+c.name)).map(c=>({type:'vod',name:c.name})),runtime={server:state.updateCandidate.server,username:state.updateCandidate.username,password:state.updateCandidate.password,liveExtension:state.updateCandidate.liveExtension,targets};if(writeJson(key.runtime,runtime)){toast('Lista atualizada. Recarregando…');setTimeout(()=>location.reload(),350)}else toast('O navegador bloqueou o armazenamento local deste arquivo.')}
function updateShortSearch(){const q=el.search.value.trim().toLocaleLowerCase('pt-BR');state.filteredItems=q?state.items.filter(x=>itemTitle(x).toLocaleLowerCase('pt-BR').includes(q)):null;el.feedScroller.scrollTop=0;state.gridSig='';const n=currentShortItems().length;el.homeStatus.textContent=q?n+' resultado(s) em Shorts':state.items.length+' Shorts';renderGrid(true)}
function toggleShortSearch(){const opening=!el.searchWrap.classList.contains('is-open');el.searchWrap.classList.toggle('is-open',opening);el.searchButton.classList.toggle('is-active',opening);document.body.classList.toggle('short-search-open',opening);if(opening)setTimeout(()=>el.search.focus(),20);else{el.search.value='';state.filteredItems=null;el.feedScroller.scrollTop=0;state.gridSig='';renderGrid(true)}}
el.searchButton.onclick=toggleShortSearch;el.search.oninput=()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(updateShortSearch,180)};
el.settingsButton.onclick=()=>{const opening=el.settingsPanel.classList.contains('is-hidden');el.settingsPanel.classList.toggle('is-hidden');if(opening)refreshAccount()};el.updateAccordionButton.onclick=()=>{const hidden=el.updateAccordionBody.classList.toggle('is-hidden');el.updateAccordionIcon.textContent=hidden?'⌄':'⌃'};el.updateLoad.onclick=loadUpdateCategories;el.updateApply.onclick=applyUpdate;
async function init(){installImageFallback();document.body.dataset.theme=CONFIG.theme||'graphene';document.title=CONFIG.appName;el.title.textContent=CONFIG.appName;updateHistoryButton();refreshAccount();const targets=(CONFIG.targets||[]).filter(t=>t.type==='vod');if(!targets.length){el.homeStatus.textContent='Nenhuma categoria de Shorts configurada.';el.feedSpacer.innerHTML='<div class="skeleton">Atualize a lista e selecione pelo menos uma categoria.</div>';return}el.homeStatus.textContent='Mesclando '+targets.length+' categoria(s)…';try{state.items=await loadMergedItems();el.homeStatus.textContent=state.items.length+' Shorts · '+targets.length+' categoria(s) mesclada(s)';renderGrid(true)}catch(e){el.homeStatus.textContent='Falha ao carregar';el.feedSpacer.innerHTML='<div class="skeleton">'+escapeHtml(e.message)+'</div>'}}
/* ===== R23 MODULES ===== */
/* ===== runtime/shorts/04-proxy-fix.js ===== */
/* SRHELL v6.6 Shorts — explicit CORS proxy state.
   Injected inside the Shorts runtime IIFE before init().
   Empty field MUST disable any previously stored proxy. */

(function installProxyStateFix(){
  let proxyInput=document.getElementById('updateCorsProxyInput');
  if(!proxyInput){
    proxyInput=document.createElement('input');
    proxyInput.className='input';
    proxyInput.id='updateCorsProxyInput';
    proxyInput.type='url';
    proxyInput.inputMode='url';
    proxyInput.autocomplete='off';
    proxyInput.spellcheck=false;
    proxyInput.placeholder='Proxy CORS opcional — deixe vazio para desativar';
    if(el.updateM3u?.parentNode)el.updateM3u.insertAdjacentElement('afterend',proxyInput);
  }
  el.updateCorsProxy=proxyInput;
  proxyInput.value=String(CONFIG.corsProxy||'').trim();
})();

function srhCurrentUpdateProxy(){
  return String(el.updateCorsProxy?.value||'').trim();
}

async function loadUpdateCategories(){
  state.updateCategories=[];
  state.updateSelected.clear();
  el.updateApply.disabled=true;
  el.updateGroups.innerHTML='';
  try{
    const parsed=parseLogin(el.updateM3u.value);
    const candidate={...CONFIG,...parsed,corsProxy:srhCurrentUpdateProxy()};
    state.updateCandidate=candidate;
    el.updateStatus.textContent=candidate.corsProxy?'Validando login com Proxy CORS…':'Validando login sem Proxy CORS…';
    el.updateLoad.disabled=true;
    const account=await request({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');
    if(!active)throw new Error('O novo login não retornou uma conta ativa.');
    state.updateCategories=normalizeUpdate(await request({action:'get_vod_categories'},candidate));
    const old=new Set((CONFIG.targets||[]).map(t=>'vod::'+t.name));
    state.updateCategories.forEach(c=>{const k='vod::'+c.name;if(old.has(k))state.updateSelected.add(k)});
    renderUpdateGroups();
    el.updateStatus.textContent=state.updateCategories.length+' categorias disponíveis · '+(candidate.corsProxy?'Proxy CORS ativo.':'conexão direta, sem proxy.');
  }catch(e){
    el.updateStatus.textContent=e.message;
  }finally{
    el.updateLoad.disabled=false;
  }
}

function applyUpdate(){
  if(!state.updateCandidate||!state.updateSelected.size)return;
  const targets=state.updateCategories.filter(c=>state.updateSelected.has('vod::'+c.name)).map(c=>({type:'vod',name:c.name}));
  const runtime={
    server:state.updateCandidate.server,
    username:state.updateCandidate.username,
    password:state.updateCandidate.password,
    liveExtension:state.updateCandidate.liveExtension,
    corsProxy:String(state.updateCandidate.corsProxy||'').trim(),
    targets
  };
  if(writeJson(key.runtime,runtime)){
    CONFIG={...CONFIG,...runtime};
    toast(runtime.corsProxy?'Lista atualizada com Proxy CORS. Recarregando…':'Lista atualizada sem Proxy CORS. Recarregando…');
    setTimeout(()=>location.reload(),350);
  }else toast('O navegador bloqueou o armazenamento local deste arquivo.');
}

/* ===== runtime/shorts/05-aura-transport-r5.js ===== */
/* SRHELL Shorts — Aura transport + render smoothing R5. */
const SRH_SHORTS_TRANSPORT_R5='shorts-aura-r5';
function srhShortsProxyBase(cfg=CONFIG){return String(cfg?.corsProxy||'').trim()}
function srhShortsPush(out,v){v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)}
function srhShortsTwin(url,scheme){try{const u=new URL(String(url||''));u.protocol=scheme+':';return u.href}catch{return''}}
function srhShortsBuildProxy(target,cfg=CONFIG){
  const base=srhShortsProxyBase(cfg),raw=String(target||'').trim();if(!base||!raw)return'';const enc=encodeURIComponent(raw);
  if(base.includes('{rawUrl}'))return base.split('{rawUrl}').join(raw);
  if(base.includes('{raw}'))return base.split('{raw}').join(raw);
  if(base.includes('{url}'))return base.split('{url}').join(enc);
  if(/[?&](?:url|target|uri|quest|q)=$/i.test(base)||base.endsWith('='))return base+enc;
  if(base.endsWith('?'))return base+enc;
  if(/\/fetch\/$/i.test(base))return base+raw;
  try{const u=new URL(base),known=['url','target','uri','quest','q'],k=known.find(x=>u.searchParams.has(x));u.searchParams.set(k||'url',raw);return u.toString()}catch{return base+(base.includes('?')?'&url=':'?url=')+enc}
}
function srhShortsProxyUrls(target,cfg=CONFIG){const out=[],p=srhShortsBuildProxy(target,cfg);if(!p)return out;if(location.protocol==='https:'&&/^http:\/\//i.test(p))srhShortsPush(out,srhShortsTwin(p,'https'));srhShortsPush(out,p);return out}
function proxyUrl(url,cfg=CONFIG){return srhShortsBuildProxy(url,cfg)||url}
async function srhShortsFetchJson(url){const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),13000):0;try{const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain,*/*'}});if(!r.ok)throw new Error('HTTP '+r.status);const text=await r.text();try{return JSON.parse(text)}catch{throw new Error('resposta não é JSON')}}finally{if(t)clearTimeout(t)}}
async function request(params={},cfg=CONFIG){const target=apiUrl(params,cfg),urls=[];if(location.protocol==='https:'&&/^http:\/\//i.test(target))srhShortsPush(urls,srhShortsTwin(target,'https'));srhShortsPush(urls,target);for(const p of srhShortsProxyUrls(target,cfg))srhShortsPush(urls,p);const errors=[];for(const u of urls){try{return await srhShortsFetchJson(u)}catch(e){errors.push(String(e?.message||e))}}throw new Error((errors.at(-1)||'Falha no fetch.')+(srhShortsProxyBase(cfg)?' Proxy CORS configurado também falhou.':' Sem Proxy CORS configurado.'))}
function srhShortsImageCandidates(src,cfg=CONFIG){const out=[],raw=String(src||'').trim();if(!/^https?:\/\//i.test(raw))return out;for(const p of srhShortsProxyUrls(raw,cfg))srhShortsPush(out,p);const https=srhShortsTwin(raw,'https');if(https&&https!==raw)srhShortsPush(out,https);for(const p of srhShortsProxyUrls(https,cfg))srhShortsPush(out,p);return out.filter(x=>x!==raw)}
function installImageFallback(){document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.srhImageFinal==='1')return;const initial=img.dataset.srhImageOriginal||img.getAttribute('src')||'';if(!img.dataset.srhImageOriginal)img.dataset.srhImageOriginal=initial;let q=[];try{q=JSON.parse(img.dataset.srhImageQueue||'[]')}catch{}if(!q.length){q=srhShortsImageCandidates(initial);img.dataset.srhImageQueue=JSON.stringify(q);img.dataset.srhImageIndex='0'}const i=Number(img.dataset.srhImageIndex||0);if(i<q.length){img.dataset.srhImageIndex=String(i+1);img.referrerPolicy='no-referrer';img.src=q[i];return}img.dataset.srhImageFinal='1';img.classList.add('image-fallback');img.src=IMAGE_PLACEHOLDER},true)}
function srhShortsHlsOptions(proxyAll){const o={enableWorker:true,lowLatencyMode:false,maxBufferLength:28,maxMaxBufferLength:44,backBufferLength:12,manifestLoadingTimeOut:10000,manifestLoadingMaxRetry:3,levelLoadingMaxRetry:4,fragLoadingMaxRetry:5};if(proxyAll&&srhShortsProxyBase(CONFIG))o.xhrSetup=(xhr,url)=>{const p=srhShortsBuildProxy(url,CONFIG);if(p&&p!==url&&xhr.readyState===0)xhr.open('GET',p,true)};return o}
function attachCandidates(candidates,onReady,onError){const direct=uniqueMediaUrls(candidates),queue=direct.map(url=>({url,proxyAll:false}));if(srhShortsProxyBase(CONFIG))for(const url of direct)queue.push({url,proxyAll:true});const v=el.shortVideo;let i=0,last=null,done=false;const next=()=>{if(done)return;if(i>=queue.length){done=true;onError?.(last);return}const entry=queue[i++],current=entry.url;destroyHls();v.pause();v.onerror=null;v.onloadedmetadata=null;v.removeAttribute('src');try{v.load()}catch{}const fail=extra=>{last=mediaErrorInfo(v,extra);next()},ready=()=>{if(done)return;done=true;onReady?.(current);v.play().catch(()=>{})},isHls=/\.m3u8(?:$|[?#])/i.test(current);if(isHls&&window.Hls&&Hls.isSupported()){try{state.hls=new Hls(srhShortsHlsOptions(entry.proxyAll));state.hls.loadSource(current);state.hls.attachMedia(v);state.hls.on(Hls.Events.MANIFEST_PARSED,ready);state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)})}catch(e){fail(e)}}else{v.src=entry.proxyAll?(srhShortsBuildProxy(current,CONFIG)||current):current;v.onloadedmetadata=ready;v.onerror=()=>fail();try{v.load()}catch{}v.play().catch(()=>{})}};next()}
const srhShortsRenderGridRaw=renderGrid;let srhShortsRenderRaf=0,srhShortsRenderForce=false,srhShortsMovingUntil=0;
renderGrid=function(force=false){srhShortsRenderForce=srhShortsRenderForce||!!force;if(srhShortsRenderRaf)return;srhShortsRenderRaf=requestAnimationFrame(()=>{srhShortsRenderRaf=0;const f=srhShortsRenderForce;srhShortsRenderForce=false;srhShortsRenderGridRaw(f)})};
el.feedScroller.addEventListener('scroll',()=>{srhShortsMovingUntil=performance.now()+180},{passive:true});
runProbeQueue=function(){if(performance.now()<srhShortsMovingUntil){setTimeout(runProbeQueue,190);return}const mem=Number(navigator.deviceMemory||0),cores=Number(navigator.hardwareConcurrency||0),mobile=/android|iphone|ipad|mobile/i.test(navigator.userAgent||''),limit=(mem&&mem<=2)||(mobile&&cores&&cores<=4)?1:2;while(state.probeActive<limit&&state.probeQueue.length){const item=state.probeQueue.shift(),id=itemId(item);if(!state.probeWanted.has(id)){state.probeQueued.delete(id);continue}state.probeActive++;request({action:'get_vod_info',vod_id:id}).then(data=>{const d=durationFrom(item,data);if(d>0)saveDuration(id,d)}).catch(()=>{}).finally(()=>{state.probeActive--;runProbeQueue()})}};

/* ===== runtime/shorts/06-aura-player-r12.js ===== */
/* SRHELL v6.6 — Shorts R12.
   UI/behavior adapted from aura-reels: custom controls, fit/fullscreen,
   API cover+synopsis, 2-minute arcs and lighter frame rendering.
   Share/audience/catalog-only controls are intentionally not ported. */

const SRH_R12_ARC_SECONDS=120;
const SRH_R12_HIDE_MS=4000;
const srhR12MetaCache=new Map();
const srhR12Frame=document.getElementById('shortFrame');
let srhR12HideTimer=0,srhR12GridFrame=0;

function srhR12Svg(body){return `<svg class="action-svg" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`}
function srhR12Button(id,label,svg,extra=''){const b=document.createElement('button');b.type='button';b.id=id;b.className='srh-r12-action '+extra;b.setAttribute('aria-label',label);b.innerHTML=srhR12Svg(svg)+`<small>${label}</small>`;return b}
function srhR12SetAction(btn,label,svg){if(!btn)return;btn.classList.add('srh-r12-action');btn.setAttribute('aria-label',label);btn.innerHTML=srhR12Svg(svg)+`<small>${label}</small>`}
function srhR12Time(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const m=Math.floor(sec/60),s=sec%60;return m+':'+String(s).padStart(2,'0')}

arcCount=function(seconds){return seconds>0?Math.max(1,Math.ceil(seconds/SRH_R12_ARC_SECONDS)):0};
drawArcs=function(){
  const d=el.shortVideo.duration;
  if(!Number.isFinite(d)||d<=0){el.arcGrid.innerHTML='<div class="update-status">Duração indisponível.</div>';return}
  const count=Math.max(1,Math.ceil(d/SRH_R12_ARC_SECONDS));
  const current=Math.min(count-1,Math.floor((el.shortVideo.currentTime||0)/SRH_R12_ARC_SECONDS));
  el.arcHead.textContent=count+' arco'+(count===1?'':'s')+' · 2 min cada';
  el.arcGrid.innerHTML=Array.from({length:count},(_,i)=>{const start=i*SRH_R12_ARC_SECONDS,end=Math.min(d,(i+1)*SRH_R12_ARC_SECONDS);return `<button class="arc-button${i===current?' is-active':''}" data-arc="${i}" aria-current="${i===current?'true':'false'}">Arco ${i+1}<br><small>${srhR12Time(start)}–${srhR12Time(end)}</small></button>`}).join('');
  el.arcGrid.querySelectorAll('[data-arc]').forEach(b=>b.onclick=e=>{e.stopPropagation();seekArc(Number(b.dataset.arc));el.arcDrawer.classList.add('is-hidden')});
};
seekArc=function(index){
  const d=el.shortVideo.duration;if(!Number.isFinite(d)||d<=0)return;
  const count=Math.max(1,Math.ceil(d/SRH_R12_ARC_SECONDS)),i=Math.max(0,Math.min(count-1,index));
  el.shortVideo.currentTime=Math.min(i*SRH_R12_ARC_SECONDS,Math.max(0,d-.25));
  el.shortVideo.play().catch(()=>{});drawArcs();srhR12ShowControls();
};
currentArc=function(){return Math.max(0,Math.floor((el.shortVideo.currentTime||0)/SRH_R12_ARC_SECONDS))};

function srhR12Synopsis(data,item){const info=data?.info||{},movie=data?.movie_data||{};return String(info.plot||info.description||info.overview||movie.plot||movie.description||item?.plot||'').trim()}
function srhR12Cover(data,item){const info=data?.info||{},movie=data?.movie_data||{};const back=Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path;return String(info.movie_image||info.cover_big||info.cover||movie.stream_icon||movie.movie_image||back||itemImage(item)||'').trim()}
async function srhR12LoadMeta(item){
  const id=itemId(item);if(!id)return null;if(srhR12MetaCache.has(id))return srhR12MetaCache.get(id);
  const task=request({action:'get_vod_info',vod_id:id}).then(data=>{const meta={title:String(data?.movie_data?.name||data?.info?.name||itemTitle(item)),cover:srhR12Cover(data,item),synopsis:srhR12Synopsis(data,item),duration:durationFrom(item,data)};if(meta.duration>0)saveDuration(id,meta.duration);return meta}).catch(()=>({title:itemTitle(item),cover:itemImage(item),synopsis:'',duration:durationFor(item)}));
  srhR12MetaCache.set(id,task);return task;
}
function srhR12ApplyMeta(meta,item){
  const title=document.getElementById('srhR12Title'),syn=document.getElementById('srhR12Synopsis'),img=document.getElementById('srhR12Cover');
  if(title)title.textContent=meta?.title||itemTitle(item);
  if(syn)syn.textContent=meta?.synopsis||'Sinopse não informada pela API.';
  if(img){img.dataset.fallback='0';img.src=meta?.cover||itemImage(item)||IMAGE_PLACEHOLDER}
}

function srhR12FitKey(){return `srhell:${APP_ID}:shorts:fit-r12`}
function srhR12SetFit(mode){mode=mode==='contain'?'contain':'cover';if(!srhR12Frame)return;srhR12Frame.classList.toggle('srh-fit-contain',mode==='contain');srhR12Frame.classList.toggle('srh-fit-cover',mode!=='contain');try{localStorage.setItem(srhR12FitKey(),mode)}catch{}const b=document.getElementById('srhR12Fit');if(b){const small=b.querySelector('small');if(small)small.textContent=mode==='contain'?'Ajustar':'Corte';b.setAttribute('aria-label',mode==='contain'?'Usar corte':'Ajustar vídeo à tela')}}
function srhR12ToggleFit(){srhR12SetFit(srhR12Frame?.classList.contains('srh-fit-contain')?'cover':'contain');srhR12ShowControls()}
function srhR12StoredFit(){try{return localStorage.getItem(srhR12FitKey())||'cover'}catch{return'cover'}}

function srhR12SyncFullscreen(){const b=document.getElementById('srhR12Expand');if(!b)return;const full=!!document.fullscreenElement;const small=b.querySelector('small');if(small)small.textContent=full?'Normal':'Tela cheia';b.setAttribute('aria-label',full?'Voltar à tela normal':'Abrir em tela cheia');b.classList.toggle('is-active',full)}
async function srhR12ToggleFullscreen(){
  try{
    if(document.fullscreenElement){await document.exitFullscreen?.();try{screen.orientation?.unlock?.()}catch{}}
    else{await el.shortPlayer.requestFullscreen?.({navigationUI:'hide'});if(isMobile())try{await screen.orientation?.lock?.('portrait-primary')}catch{}}
  }catch{toast('Tela cheia indisponível neste navegador.')}
  srhR12SyncFullscreen();srhR12ShowControls();
}

function srhR12NextContent(){
  const items=currentShortItems(),id=String(state.current?.streamId||''),idx=items.findIndex(x=>String(itemId(x))===id);
  if(idx<0||idx+1>=items.length){toast('Fim da lista.');return}
  persistProgress();openShort(items[idx+1],0);
}
function srhR12Seek(delta){const v=el.shortVideo;if(!Number.isFinite(v.duration)||v.duration<=0)return;v.currentTime=Math.max(0,Math.min(v.duration-.05,(v.currentTime||0)+delta));v.play().catch(()=>{});srhR12ShowControls()}
function srhR12TogglePlay(){const v=el.shortVideo;if(v.paused)v.play().catch(()=>{});else v.pause();srhR12UpdatePlay();srhR12ShowControls()}
function srhR12UpdatePlay(){const b=document.getElementById('srhR12Play');if(!b)return;b.innerHTML=el.shortVideo.paused?srhR12Svg('<path d="M8 5v14l11-7Z"/>'):srhR12Svg('<path d="M8 6v12M16 6v12"/>');b.setAttribute('aria-label',el.shortVideo.paused?'Reproduzir':'Pausar')}
function srhR12Progress(){const d=el.shortVideo.duration,p=el.shortVideo.currentTime,fill=document.getElementById('srhR12ProgressFill');if(fill)fill.style.width=Number.isFinite(d)&&d>0?Math.max(0,Math.min(100,p/d*100))+'%':'0%'}
function srhR12ScheduleHide(){clearTimeout(srhR12HideTimer);if(el.shortVideo.paused)return;srhR12HideTimer=setTimeout(()=>{if(el.arcDrawer.classList.contains('is-hidden')&&!el.shortVideo.paused)el.shortPlayer.classList.add('srh-r12-controls-hidden')},SRH_R12_HIDE_MS)}
function srhR12ShowControls(){el.shortPlayer.classList.remove('srh-r12-controls-hidden');srhR12ScheduleHide()}

function srhR12InstallUi(){
  if(document.getElementById('srhR12Actions'))return;
  el.shortVideo.controls=false;
  el.shortClose.classList.add('srh-r12-back');
  el.shortClose.innerHTML=srhR12Svg('<path d="M15 5 8 12l7 7"/>');
  el.shortStage.appendChild(el.shortClose);
  el.arcPrev.style.display='none';

  const actions=document.createElement('aside');actions.id='srhR12Actions';actions.className='srh-r12-actions';
  srhR12SetAction(el.shortFavorite,'Favorito','<path d="M12 3.8 14.7 9l5.8.8-4.2 4.1 1 5.8-5.3-2.8-5.2 2.8 1-5.8-4.2-4.1L9.3 9Z"/>');
  srhR12SetAction(el.shortArcs,'Arcos','<path d="M5 6h14M5 12h14M5 18h14M8 4v4M14 10v4M10 16v4"/>');
  srhR12SetAction(el.arcNext,'Próximo','<path d="M5 5v14l10-7Z"/><path d="M19 5v14"/>');
  el.arcNext.onclick=e=>{e.stopPropagation();srhR12NextContent()};
  const fit=srhR12Button('srhR12Fit','Corte','<path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3"/><rect x="8" y="7" width="8" height="10" rx="1.5"/>');fit.onclick=e=>{e.stopPropagation();srhR12ToggleFit()};
  const expand=srhR12Button('srhR12Expand','Tela cheia','<path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"/>');expand.onclick=e=>{e.stopPropagation();srhR12ToggleFullscreen()};
  actions.append(el.shortFavorite,fit,el.shortArcs,el.arcNext,expand);el.shortStage.appendChild(actions);

  const copy=document.createElement('section');copy.className='srh-r12-copy';copy.innerHTML='<span class="srh-r12-cover"><img id="srhR12Cover" alt=""></span><div class="srh-r12-copytext"><div class="srh-r12-copytitle" id="srhR12Title"></div><div class="srh-r12-synopsis" id="srhR12Synopsis"></div></div>';el.shortStage.appendChild(copy);
  const seek=document.createElement('div');seek.className='srh-r12-seek';seek.innerHTML='<button id="srhR12Back10" type="button" aria-label="Voltar 10 segundos">'+srhR12Svg('<path d="M9 7H4V2M4.5 7.5A9 9 0 1 1 3 15"/>')+'<span>10</span></button><button class="srh-r12-play" id="srhR12Play" type="button" aria-label="Reproduzir"></button><button id="srhR12Forward10" type="button" aria-label="Avançar 10 segundos">'+srhR12Svg('<path d="M15 7h5V2M19.5 7.5A9 9 0 1 0 21 15"/>')+'<span>10</span></button>';el.shortStage.appendChild(seek);
  document.getElementById('srhR12Back10').onclick=e=>{e.stopPropagation();srhR12Seek(-10)};document.getElementById('srhR12Forward10').onclick=e=>{e.stopPropagation();srhR12Seek(10)};document.getElementById('srhR12Play').onclick=e=>{e.stopPropagation();srhR12TogglePlay()};
  const progress=document.createElement('div');progress.className='srh-r12-progress';progress.innerHTML='<span id="srhR12ProgressFill"></span>';el.shortStage.appendChild(progress);
  srhR12SetFit(srhR12StoredFit());srhR12UpdatePlay();srhR12SyncFullscreen();
}

const srhR12OpenShortBase=openShort;
openShort=function(item,resumeAt=0){
  srhR12OpenShortBase(item,resumeAt);srhR12ShowControls();srhR12ApplyMeta({title:itemTitle(item),cover:itemImage(item),synopsis:''},item);
  const id=itemId(item);srhR12LoadMeta(item).then(meta=>{if(String(state.current?.streamId||'')===String(id))srhR12ApplyMeta(meta,item)});
};

const srhR12RenderGridBase=renderGrid;
renderGrid=function(force=false){
  if(force){if(srhR12GridFrame){cancelAnimationFrame(srhR12GridFrame);srhR12GridFrame=0}return srhR12RenderGridBase(true)}
  if(srhR12GridFrame)return;srhR12GridFrame=requestAnimationFrame(()=>{srhR12GridFrame=0;srhR12RenderGridBase(false)});
};

srhR12InstallUi();
el.shortVideo.addEventListener('play',()=>{srhR12UpdatePlay();srhR12ScheduleHide()});
el.shortVideo.addEventListener('pause',()=>{srhR12UpdatePlay();srhR12ShowControls()});
el.shortVideo.addEventListener('timeupdate',srhR12Progress,{passive:true});
el.shortVideo.addEventListener('loadedmetadata',srhR12Progress,{passive:true});
el.shortStage.addEventListener('pointerdown',srhR12ShowControls,{passive:true});
el.shortStage.addEventListener('pointermove',srhR12ShowControls,{passive:true});
document.addEventListener('fullscreenchange',srhR12SyncFullscreen);

/* ===== runtime/shared/03-api-router-r23.js ===== */
/* SRHELL v6.6 — R23 clean API router.
   One final request() implementation for Standard and Shorts.
   GitHub Actions validates/ranks proxy-pool.json; browser never benchmarks relays. */
const SRH_API_ROUTER_R23='api-router-r23';
const SRH_R23_POOL_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json';
const srhR23Api={pool:null,loading:null,profiles:new Map()};
function srhR23Safe(v){return String(v||'').toLowerCase().replace(/[^a-z0-9._-]+/g,'_').slice(0,140)}
function srhR23Origin(cfg=CONFIG){try{return new URL(normalizeServer(cfg?.server||CONFIG.server)).origin}catch{return normalizeServer(cfg?.server||CONFIG.server)||'unknown'}}
function srhR23App(cfg=CONFIG){return String((typeof APP_ID!=='undefined'&&APP_ID)||cfg?.appId||cfg?.appName||CONFIG?.appId||CONFIG?.appName||'app')}
function srhR23Key(cfg=CONFIG){return 'srhell:r23:proxy:'+srhR23Safe(srhR23App(cfg))+':'+srhR23Safe(srhR23Origin(cfg))}
function srhR23Read(k,f={}){try{return JSON.parse(localStorage.getItem(k)||'null')||f}catch{return f}}
function srhR23Write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
function srhR23Profile(cfg=CONFIG){const k=srhR23Key(cfg);if(!srhR23Api.profiles.has(k)){const c=srhR23Read(k,{});srhR23Api.profiles.set(k,{selected:c.selected||null,selectedId:String(c.selectedId||''),useCount:Number(c.useCount||0),revision:String(c.revision||'')})}return srhR23Api.profiles.get(k)}
function srhR23Persist(cfg,entry,useCount,revision=''){const p=srhR23Profile(cfg);p.selected=entry||null;p.selectedId=entry?.id||'';p.useCount=Math.max(0,Number(useCount||0));p.revision=String(revision||p.revision||'');srhR23Write(srhR23Key(cfg),{selected:p.selected,selectedId:p.selectedId,useCount:p.useCount,revision:p.revision})}
function srhR23ProxyUrl(template,target){const b=String(template||'').trim(),raw=String(target||'').trim();if(!b||!raw)return'';const enc=encodeURIComponent(raw);if(b.includes('{rawUrl}'))return b.split('{rawUrl}').join(raw);if(b.includes('{raw}'))return b.split('{raw}').join(raw);if(b.includes('{url}'))return b.split('{url}').join(enc);if(/[?&](?:url|target|uri|quest|q)=$/i.test(b)||b.endsWith('=')||b.endsWith('?'))return b+enc;try{const u=new URL(b),keys=['url','target','uri','quest','q'],key=keys.find(k=>u.searchParams.has(k));u.searchParams.set(key||'url',raw);return u.toString()}catch{return''}}
function srhR23Https(url){try{const u=new URL(String(url||''));if(u.protocol!=='http:')return'';u.protocol='https:';return u.href}catch{return''}}
function srhR23Parse(value){let text=String(value??'').replace(/^\uFEFF+/,'').replace(/\u0000/g,'').trim();if(/^\s*</.test(text)&&typeof DOMParser==='function'){try{const doc=new DOMParser().parseFromString(text,'text/html'),body=String(doc?.body?.textContent||'').trim();if(body)text=body}catch{}}const parse=s=>{let v=JSON.parse(s);if(typeof v==='string'&&/^[\[{]/.test(v.trim()))v=JSON.parse(v);return v};try{return parse(text)}catch(first){const a=text.indexOf('{'),b=text.indexOf('['),start=a<0?b:b<0?a:Math.min(a,b);if(start>=0){const end=text.lastIndexOf(text[start]==='{'?'}':']');if(end>start)try{return parse(text.slice(start,end+1))}catch{}}const e=new Error('A API respondeu, mas o corpo não pôde ser convertido em JSON.');e.srhParse=true;e.cause=first;throw e}}
async function srhR23FetchJson(url,timeout=7000){const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeout):0;try{let r;try{r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}})}catch(err){const e=new Error(err?.name==='AbortError'?'Tempo limite ao consultar a API.':'O navegador não conseguiu ler a resposta da API.');e.srhCors=true;e.cause=err;throw e}if(!r.ok)throw new Error('HTTP '+r.status);let text;try{text=await r.text()}catch(err){const e=new Error('A resposta chegou, mas o navegador bloqueou a leitura do corpo.');e.srhCors=true;e.cause=err;throw e}return srhR23Parse(text)}finally{if(t)clearTimeout(t)}}
function srhR23Pool(raw){const proxies=(Array.isArray(raw?.proxies)?raw.proxies:[]).filter(x=>x&&x.id&&x.template&&x.valid!==false&&x.enabled!==false).map(x=>({id:String(x.id),name:String(x.name||x.id),template:String(x.template),latencyMs:Number.isFinite(Number(x.latencyMs))?Number(x.latencyMs):999999,successRate:Number.isFinite(Number(x.successRate))?Number(x.successRate):1,priority:Number(x.priority||50)})).sort((a,b)=>(a.latencyMs-b.latencyMs)||(b.successRate-a.successRate)||(a.priority-b.priority));return{...raw,proxies,maxApiFallbacks:Math.max(1,Math.min(3,Number(raw?.maxApiFallbacks||2)))}}
async function srhR23LoadPool(force=false){if(!force&&srhR23Api.pool)return srhR23Api.pool;if(srhR23Api.loading)return srhR23Api.loading;srhR23Api.loading=(async()=>{const r=await fetch(SRH_R23_POOL_URL+'?v='+Date.now(),{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('Pool HTTP '+r.status);return srhR23Api.pool=srhR23Pool(await r.json())})().finally(()=>{srhR23Api.loading=null});return srhR23Api.loading}
async function srhR23Direct(target,cfg){const urls=[target],https=srhR23Https(target);if(https)urls.push(https);const manual=String(cfg?.corsProxy||'').trim(),build=typeof srhBuildProxyUrl==='function'?srhBuildProxyUrl:(typeof srhShortsBuildProxy==='function'?srhShortsBuildProxy:null);if(manual&&build){for(const raw of [...urls]){const p=build(raw,cfg);if(p&&!urls.includes(p))urls.push(p)}}let last=null;for(let i=0;i<urls.length;i++){try{return await srhR23FetchJson(urls[i],i<2?4500:8500)}catch(e){last=e}}throw last||new Error('Falha na conexão direta.')}
async function srhR23Auto(target,cfg,baseError){if(cfg?.autoCorsProxy===false)throw baseError;const profile=srhR23Profile(cfg);let selected=profile.selected,last=baseError,pool=null;if(selected&&profile.useCount<3){try{const data=await srhR23FetchJson(srhR23ProxyUrl(selected.template,target),8500);srhR23Persist(cfg,selected,profile.useCount+1,profile.revision);return data}catch(e){last=e}}try{pool=await srhR23LoadPool(!selected||profile.useCount>=3)}catch{if(selected){try{const data=await srhR23FetchJson(srhR23ProxyUrl(selected.template,target),8500);srhR23Persist(cfg,selected,1,profile.revision);return data}catch(e){last=e}}throw last}let attempts=0;for(const entry of pool.proxies){if(attempts>=pool.maxApiFallbacks)break;attempts++;const u=srhR23ProxyUrl(entry.template,target);if(!u)continue;try{const data=await srhR23FetchJson(u,8500);srhR23Persist(cfg,entry,1,String(pool.revision||''));return data}catch(e){last=e}}throw new Error(String(last?.message||'Falha na API Xtream.')+' · conexão direta e proxies CORS falharam.')}
request=async function(params={},cfg=CONFIG){const target=apiUrl(params,cfg),profile=srhR23Profile(cfg),manual=String(cfg?.corsProxy||'').trim();if(!manual&&cfg?.autoCorsProxy!==false&&profile.selected&&profile.useCount<3){try{const data=await srhR23FetchJson(srhR23ProxyUrl(profile.selected.template,target),8500);srhR23Persist(cfg,profile.selected,profile.useCount+1,profile.revision);return data}catch{}}try{return await srhR23Direct(target,cfg)}catch(e){return srhR23Auto(target,cfg,e)}};
try{window.SRHELL_PROXY_POOL={version:SRH_API_ROUTER_R23,status:()=>{const p=srhR23Profile(CONFIG),pool=srhR23Api.pool;return{profile:srhR23Key(CONFIG),origin:srhR23Origin(CONFIG),selectedId:p.selectedId,useCount:p.useCount,refreshOnNext:p.useCount>=3,poolRevision:pool?.revision||p.revision,available:pool?.proxies?.map(x=>({id:x.id,latencyMs:x.latencyMs,successRate:x.successRate}))||[]}},refresh:()=>srhR23LoadPool(true)}}catch{}

/* ===== runtime/shorts/10-feed-controller-r23.js ===== */
/* SRHELL Shorts R23 — clean feed/player controller.
   Replaces only the unstable feed/player lifecycle. No R14 prefetch layer. */
const SRH_SHORTS_FEED_R23='shorts-feed-r23';
const srhR23Feed={top:null,grid:null,bottom:null,nodes:new Map(),firstRow:-1,lastRow:-1,cols:0,rowH:0,cardW:0,raf:0,probeTimer:0,suspended:false,savedScroll:0};
const srhR23Images={queue:[],active:0,max:3};
let srhR23ArcSig='',srhR23ArcActive=-1,srhR23ArcTimer=0;

function srhR23Metrics(){
  const cs=getComputedStyle(el.feedScroller);
  const pad=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
  const width=Math.max(220,el.feedScroller.clientWidth-pad);
  const cols=innerWidth>=1200?8:innerWidth>=900?6:2;
  const gap=innerWidth>=900?10:8;
  const cardW=(width-gap*(cols-1))/cols;
  const cardH=cardW*1.5;
  const rowH=cardH+gap;
  const visibleRows=Math.max(1,Math.ceil(el.feedScroller.clientHeight/rowH));
  return{cols,gap,cardW,cardH,rowH,visibleRows};
}
function srhR23EnsureFeed(){
  if(srhR23Feed.top?.isConnected&&srhR23Feed.grid?.isConnected&&srhR23Feed.bottom?.isConnected)return;
  const top=document.createElement('div'),grid=document.createElement('div'),bottom=document.createElement('div');
  top.className='srh-r23-spacer-top';grid.className='srh-r23-grid';bottom.className='srh-r23-spacer-bottom';
  el.feedSpacer.replaceChildren(top,grid,bottom);
  srhR23Feed.top=top;srhR23Feed.grid=grid;srhR23Feed.bottom=bottom;
  srhR23Feed.nodes.clear();srhR23Feed.firstRow=-1;srhR23Feed.lastRow=-1;
}
function srhR23ImageCandidates(src){
  const out=[],push=v=>{v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)};
  push(src);
  if(typeof srhShortsImageCandidates==='function')for(const v of srhShortsImageCandidates(src))push(v);
  return out;
}
function srhR23PumpImages(){
  while(srhR23Images.active<srhR23Images.max&&srhR23Images.queue.length){
    const task=srhR23Images.queue.shift();
    if(!task.card.isConnected||task.card.dataset.coverToken!==task.token)continue;
    srhR23Images.active++;
    const candidates=srhR23ImageCandidates(task.src);let pos=0,finished=false;
    const finish=()=>{if(finished)return;finished=true;srhR23Images.active--;srhR23PumpImages()};
    const next=()=>{
      if(!task.card.isConnected||task.card.dataset.coverToken!==task.token)return finish();
      if(pos>=candidates.length)return finish();
      const candidate=candidates[pos++],probe=new Image();
      probe.decoding='async';probe.referrerPolicy='no-referrer';
      probe.onload=()=>{
        const reveal=()=>{if(task.card.isConnected&&task.card.dataset.coverToken===task.token)task.img.src=candidate;finish()};
        if(typeof probe.decode==='function')probe.decode().catch(()=>{}).finally(reveal);else reveal();
      };
      probe.onerror=next;probe.src=candidate;
    };
    next();
  }
}
function srhR23QueueImage(card,img,src){
  const token=String((Number(card.dataset.coverSeq)||0)+1);
  card.dataset.coverSeq=token;card.dataset.coverToken=token;img.src=IMAGE_PLACEHOLDER;
  if(!src||src===IMAGE_PLACEHOLDER)return;
  srhR23Images.queue.push({card,img,src,token});srhR23PumpImages();
}
function srhR23HistoryMap(){return new Map(history().map(x=>[String(x.streamId),x]))}
function srhR23CreateCard(item,idx,hmap){
  const id=itemId(item),card=document.createElement('article'),img=document.createElement('img');
  card.className='short-card';card.dataset.index=String(idx);card.dataset.streamId=id;
  img.className='short-card__image';img.alt='';img.loading='lazy';img.decoding='async';img.src=IMAGE_PLACEHOLDER;
  const shade=document.createElement('div');shade.className='short-card__shade';
  const badge=document.createElement('div');badge.className='arc-badge';
  const progress=document.createElement('div');progress.className='card-progress is-hidden';
  const fill=document.createElement('span');progress.appendChild(fill);
  card.append(img,shade,badge,progress);
  srhR23QueueImage(card,img,itemImage(item));
  card.onclick=()=>{const items=currentShortItems(),current=items[Number(card.dataset.index)];if(current)openShort(current,0)};
  srhR23UpdateCard(card,item,idx,hmap,0,{cols:1});
  return card;
}
function srhR23UpdateCard(card,item,idx,hmap,firstRow,m){
  const oldId=card.dataset.streamId,newId=itemId(item);
  card.dataset.index=String(idx);card.dataset.streamId=newId;
  if(oldId!==newId){const img=card.querySelector('.short-card__image');if(img)srhR23QueueImage(card,img,itemImage(item))}
  const row=Math.floor(idx/m.cols),col=idx%m.cols;
  card.style.gridColumn=String(col+1);card.style.gridRow=String(row-firstRow+1);
  const sec=durationFor(item),count=arcCount(sec),badge=card.querySelector('.arc-badge');
  if(badge)badge.textContent=count?count+' arco'+(count>1?'s':''):'…';
  const h=hmap.get(String(newId)),ratio=h?.duration?Math.max(0,Math.min(1,h.position/h.duration)):0;
  const progress=card.querySelector('.card-progress'),fill=progress?.querySelector('span');
  progress?.classList.toggle('is-hidden',ratio<=0);if(fill)fill.style.transform=`scaleX(${ratio})`;
}
function srhR23RemoveCard(idx){
  const card=srhR23Feed.nodes.get(idx);if(!card)return;
  card.dataset.coverToken='dead';card.remove();srhR23Feed.nodes.delete(idx);
}
function srhR23ResetFeed(){
  if(srhR23Feed.raf){cancelAnimationFrame(srhR23Feed.raf);srhR23Feed.raf=0}
  for(const idx of [...srhR23Feed.nodes.keys()])srhR23RemoveCard(idx);
  srhR23Feed.firstRow=-1;srhR23Feed.lastRow=-1;srhR23Feed.cols=0;srhR23Feed.rowH=0;srhR23Feed.cardW=0;
}
function srhR23ScheduleProbe(items){
  clearTimeout(srhR23Feed.probeTimer);
  if(srhR23Feed.suspended)return;
  srhR23Feed.probeTimer=setTimeout(()=>{
    if(srhR23Feed.suspended||!el.shortPlayer.classList.contains('is-hidden'))return;
    setProbeWindow(items);
  },650);
}
function srhR23RenderNow(force=false){
  if(srhR23Feed.suspended)return;
  const items=currentShortItems();
  if(!items.length){srhR23ResetFeed();el.feedSpacer.innerHTML='<div class="skeleton">Nenhum Short encontrado.</div>';srhR23Feed.top=srhR23Feed.grid=srhR23Feed.bottom=null;return}
  srhR23EnsureFeed();
  const m=srhR23Metrics(),rows=Math.ceil(items.length/m.cols),visibleFirst=Math.max(0,Math.floor(el.feedScroller.scrollTop/m.rowH));
  const first=Math.max(0,visibleFirst-2),last=Math.min(rows,visibleFirst+m.visibleRows+5);
  const geometryChanged=srhR23Feed.cols!==m.cols||Math.abs(srhR23Feed.cardW-m.cardW)>.5||Math.abs(srhR23Feed.rowH-m.rowH)>.5;
  if(!force&&!geometryChanged&&srhR23Feed.firstRow>=0&&first===srhR23Feed.firstRow&&last===srhR23Feed.lastRow)return;
  const wanted=new Set(),hmap=srhR23HistoryMap();
  srhR23Feed.grid.style.gridTemplateColumns=`repeat(${m.cols},minmax(0,1fr))`;
  srhR23Feed.grid.style.columnGap=m.gap+'px';srhR23Feed.grid.style.rowGap=m.gap+'px';srhR23Feed.grid.style.gridAutoRows=m.cardH+'px';
  for(let idx=first*m.cols;idx<Math.min(items.length,last*m.cols);idx++){
    wanted.add(idx);let card=srhR23Feed.nodes.get(idx);
    if(!card){card=srhR23CreateCard(items[idx],idx,hmap);srhR23Feed.nodes.set(idx,card);srhR23Feed.grid.appendChild(card)}
    srhR23UpdateCard(card,items[idx],idx,hmap,first,m);
  }
  for(const idx of [...srhR23Feed.nodes.keys()])if(!wanted.has(idx))srhR23RemoveCard(idx);
  srhR23Feed.top.style.height=(first*m.rowH)+'px';srhR23Feed.bottom.style.height=(Math.max(0,rows-last)*m.rowH)+'px';
  srhR23Feed.firstRow=first;srhR23Feed.lastRow=last;srhR23Feed.cols=m.cols;srhR23Feed.rowH=m.rowH;srhR23Feed.cardW=m.cardW;
  const probe=[],probeEnd=Math.min(items.length,(visibleFirst+m.visibleRows+1)*m.cols);
  for(let i=visibleFirst*m.cols;i<probeEnd;i++)probe.push(items[i]);
  srhR23ScheduleProbe(probe);
}
renderGrid=function(force=false){
  if(srhR23Feed.suspended)return;
  if(force){if(srhR23Feed.raf){cancelAnimationFrame(srhR23Feed.raf);srhR23Feed.raf=0}srhR23RenderNow(true);return}
  if(srhR23Feed.raf)return;
  srhR23Feed.raf=requestAnimationFrame(()=>{srhR23Feed.raf=0;srhR23RenderNow(false)});
};
runProbeQueue=function(){
  if(srhR23Feed.suspended||!el.shortPlayer.classList.contains('is-hidden'))return;
  if(state.probeActive>0||!state.probeQueue.length)return;
  const item=state.probeQueue.shift(),id=itemId(item);
  if(!state.probeWanted.has(id)){state.probeQueued.delete(id);setTimeout(runProbeQueue,0);return}
  state.probeActive=1;
  request({action:'get_vod_info',vod_id:id}).then(data=>{const d=durationFrom(item,data);if(d>0)saveDuration(id,d)}).catch(()=>{}).finally(()=>{state.probeActive=0;setTimeout(runProbeQueue,160)});
};

function srhR23Poster(){
  let img=document.getElementById('srhR23StagePoster');if(img)return img;
  img=document.createElement('img');img.id='srhR23StagePoster';img.className='srh-r23-stage-poster is-hidden';img.alt='';img.decoding='async';
  const frame=document.getElementById('shortFrame'),shade=frame?.querySelector('.short-player__shade');
  if(shade)frame.insertBefore(img,shade);else frame?.appendChild(img);return img;
}
function srhR23ShowPoster(item){
  const img=srhR23Poster(),session=String(Date.now())+'_'+Math.random();img.dataset.session=session;img.src=IMAGE_PLACEHOLDER;img.classList.remove('is-hidden');
  const src=itemImage(item);if(!src)return;
  const p=new Image();p.decoding='async';p.onload=()=>{const done=()=>{if(img.dataset.session===session){img.src=src;img.classList.remove('is-hidden')}};if(typeof p.decode==='function')p.decode().catch(()=>{}).finally(done);else done()};p.src=src;
}
function srhR23UpdatePoster(src){
  const img=srhR23Poster();if(!src||img.classList.contains('is-hidden'))return;
  const session=img.dataset.session,p=new Image();p.decoding='async';p.onload=()=>{if(img.dataset.session===session)img.src=src};p.src=src;
}
function srhR23HidePoster(){srhR23Poster().classList.add('is-hidden')}
function srhR23HidePosterOnFrame(){
  const v=el.shortVideo;
  if(typeof v.requestVideoFrameCallback==='function')v.requestVideoFrameCallback(()=>srhR23HidePoster());
  else requestAnimationFrame(()=>requestAnimationFrame(()=>{if(v.readyState>=2)srhR23HidePoster()}));
}
el.shortVideo.addEventListener('playing',srhR23HidePosterOnFrame,{passive:true});

function srhR23ArcBackdrop(){
  let b=document.getElementById('srhR23ArcBackdrop');if(b)return b;
  b=document.createElement('div');b.id='srhR23ArcBackdrop';b.className='srh-r23-arc-backdrop is-hidden';
  el.shortStage.insertBefore(b,el.arcDrawer);b.onclick=e=>{e.preventDefault();e.stopPropagation();srhR23CloseArcs()};return b;
}
function srhR23CloseArcs(immediate=false){
  clearTimeout(srhR23ArcTimer);const b=srhR23ArcBackdrop();
  el.arcDrawer.classList.remove('srh-r23-open');b.classList.remove('srh-r23-open');document.body.classList.remove('srh-r23-arc-open');
  const done=()=>{el.arcDrawer.classList.add('is-hidden');b.classList.add('is-hidden')};
  if(immediate)done();else srhR23ArcTimer=setTimeout(done,210);
}
function srhR23OpenArcs(){
  clearTimeout(srhR23ArcTimer);drawArcs();const b=srhR23ArcBackdrop();
  el.arcDrawer.classList.remove('is-hidden');b.classList.remove('is-hidden');
  requestAnimationFrame(()=>{el.arcDrawer.classList.add('srh-r23-open');b.classList.add('srh-r23-open');document.body.classList.add('srh-r23-arc-open');el.arcGrid.querySelector('.arc-button.is-active')?.scrollIntoView({block:'center',behavior:'auto'})});
  if(typeof srhR12ShowControls==='function')srhR12ShowControls();
}
drawArcs=function(){
  const d=el.shortVideo.duration;
  if(!Number.isFinite(d)||d<=0){srhR23ArcSig='';srhR23ArcActive=-1;el.arcHead.textContent='Arcos de 2 minutos';el.arcGrid.innerHTML='<div class="update-status">Duração indisponível.</div>';return}
  const seconds=120,count=Math.max(1,Math.ceil(d/seconds)),current=Math.min(count-1,Math.floor((el.shortVideo.currentTime||0)/seconds)),sig=count+':'+Math.round(d);
  el.arcHead.textContent=count+' arco'+(count===1?'':'s')+' · 2 min cada';
  if(sig!==srhR23ArcSig){
    srhR23ArcSig=sig;srhR23ArcActive=current;const frag=document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const start=i*seconds,end=Math.min(d,(i+1)*seconds),b=document.createElement('button');b.type='button';b.className='arc-button'+(i===current?' is-active':'');b.dataset.arc=String(i);b.setAttribute('aria-current',i===current?'true':'false');
      const fmt=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
      b.innerHTML='Arco '+(i+1)+'<br><small>'+fmt(start)+'–'+fmt(end)+'</small>';
      b.onclick=e=>{e.stopPropagation();seekArc(i);srhR23CloseArcs()};frag.appendChild(b);
    }
    el.arcGrid.replaceChildren(frag);
  }else if(current!==srhR23ArcActive){
    const old=el.arcGrid.querySelector(`[data-arc="${srhR23ArcActive}"]`),now=el.arcGrid.querySelector(`[data-arc="${current}"]`);
    old?.classList.remove('is-active');old?.setAttribute('aria-current','false');now?.classList.add('is-active');now?.setAttribute('aria-current','true');srhR23ArcActive=current;
  }
};
seekArc=function(index){
  const d=el.shortVideo.duration;if(!Number.isFinite(d)||d<=0)return;
  const seconds=120,count=Math.max(1,Math.ceil(d/seconds)),i=Math.max(0,Math.min(count-1,index));
  el.shortVideo.currentTime=Math.min(i*seconds,Math.max(0,d-.25));el.shortVideo.play().catch(()=>{});drawArcs();
};
currentArc=function(){return Math.max(0,Math.floor((el.shortVideo.currentTime||0)/120))};
el.shortArcs.onclick=e=>{e.preventDefault();e.stopPropagation();el.arcDrawer.classList.contains('is-hidden')?srhR23OpenArcs():srhR23CloseArcs()};
el.shortStage.addEventListener('click',e=>{if(!el.arcDrawer.classList.contains('is-hidden')&&!e.target.closest('#arcDrawer')&&!e.target.closest('#shortArcs'))srhR23CloseArcs()},true);

const srhR23OpenBase=openShort;
openShort=function(item,resumeAt=0){
  const alreadyOpen=!el.shortPlayer.classList.contains('is-hidden');
  if(!alreadyOpen)srhR23Feed.savedScroll=el.feedScroller.scrollTop;
  srhR23Feed.suspended=true;clearTimeout(srhR23Feed.probeTimer);document.body.classList.add('srh-r23-playing');srhR23CloseArcs(true);srhR23ShowPoster(item);
  const out=srhR23OpenBase(item,resumeAt),id=itemId(item);
  if(typeof srhR12LoadMeta==='function')srhR12LoadMeta(item).then(meta=>{if(String(state.current?.streamId||'')===String(id)&&meta?.cover)srhR23UpdatePoster(meta.cover)}).catch(()=>{});
  return out;
};
closeShort=async function(){
  persistProgress();try{el.shortVideo.pause()}catch{}destroyHls();srhR23CloseArcs(true);el.shortPlayer.classList.add('is-hidden');
  await leavePortraitFullscreen();state.current=null;srhR23HidePoster();document.body.classList.remove('srh-r23-playing');srhR23Feed.suspended=false;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  el.feedScroller.scrollTop=srhR23Feed.savedScroll;renderGrid(true);setTimeout(runProbeQueue,240);
};
el.shortClose.onclick=closeShort;
window.addEventListener('pageshow',()=>{if(el.shortPlayer.classList.contains('is-hidden')){srhR23Feed.suspended=false;renderGrid(true)}},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&el.shortPlayer.classList.contains('is-hidden')){srhR23Feed.suspended=false;renderGrid(true)}},{passive:true});

srhR23ArcBackdrop();srhR23Poster();

init();
})();
