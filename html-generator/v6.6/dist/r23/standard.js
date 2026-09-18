/* ===== runtime/standard/01.js ===== */
(() => {
'use strict';
const BASE_CONFIG=JSON.parse(document.getElementById('app-config').textContent);
const TYPE={live:{label:'Canais',categories:'get_live_categories',content:'get_live_streams'},vod:{label:'Filmes',categories:'get_vod_categories',content:'get_vod_streams'},series:{label:'Séries',categories:'get_series_categories',content:'get_series'}};
const $=s=>document.querySelector(s);
const el={app:$('#appRoot'),title:$('#appTitle'),meta:$('#appMeta'),daysChip:$('#daysChip'),searchButton:$('#searchButton'),searchWrap:$('#searchWrap'),settingsButton:$('#settingsButton'),settingsPanel:$('#settingsPanel'),expiryDate:$('#expiryDate'),expiryDays:$('#expiryDays'),updateAccordionButton:$('#updateAccordionButton'),updateAccordionBody:$('#updateAccordionBody'),updateAccordionIcon:$('#updateAccordionIcon'),updateM3u:$('#updateM3uInput'),updateLoad:$('#updateLoadButton'),updateApply:$('#updateApplyButton'),updateStatus:$('#updateStatus'),updateGroups:$('#updateGroups'),search:$('#globalSearch'),homeStatus:$('#homeStatus'),continueSection:$('#continueSection'),continueRow:$('#continueRow'),content:$('#contentRoot'),bottomNav:$('#bottomNav'),collectionView:$('#collectionView'),collectionClose:$('#collectionClose'),collectionTitle:$('#collectionTitle'),collectionScroller:$('#collectionScroller'),collectionSpacer:$('#collectionSpacer'),detailLayer:$('#detailLayer'),detailHeadTitle:$('#detailHeadTitle'),detailClose:$('#detailClose'),detailScroll:$('#detailScroll'),detailBody:$('#detailBody'),playerLayer:$('#playerLayer'),playerTitle:$('#playerTitle'),playerClose:$('#playerClose'),playerWrap:$('#playerWrap'),video:$('#videoPlayer'),playerExpand:$('#playerExpand'),playerStatus:$('#playerStatus'),toast:$('#toast')};
function storageKey(){return 'tj_xtream_runtime_'+String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_')}
function loadRuntime(){try{return JSON.parse(localStorage.getItem(storageKey())||'null')}catch{return null}}
let CONFIG={...BASE_CONFIG,...(loadRuntime()||{})};
const state={activeType:null,categoryMaps:new Map(),railInstances:[],gridInstance:null,categoryObserver:null,retentionObserver:null,renderToken:0,hls:null,currentMedia:null,currentDetail:null,currentSeries:null,seriesVideo:null,saveTick:0,playerActive:false,updateCandidate:null,updateCategories:[],updateSelected:new Set(),searchTimer:0,searchDataset:null,searchType:null,synopsisExpanded:false,synopsisText:'',synopsisNode:null,collectionOpen:false};
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){el.toast.textContent=msg;el.toast.classList.add('is-show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.toast.classList.remove('is-show'),2200)}
const IMAGE_PLACEHOLDER='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#20242b"/><stop offset="1" stop-color="#111318"/></linearGradient></defs><rect width="180" height="300" rx="10" fill="url(#g)"/><path d="M55 168l25-27 18 18 17-14 24 28" fill="none" stroke="#7f8792" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="113" cy="112" r="10" fill="none" stroke="#7f8792" stroke-width="5"/><rect x="40" y="88" width="100" height="96" rx="10" fill="none" stroke="#59616d" stroke-width="4"/></svg>`);
function installImageFallback(){document.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||img.dataset.fallback==='1')return;img.dataset.fallback='1';img.classList.add('image-fallback');img.src=IMAGE_PLACEHOLDER},true)}
function stripEmoji(value){let s=String(value||'');try{s=s.replace(/\p{Extended_Pictographic}/gu,'')}catch{}s=s.replace(/[\uFE0F\u200D]/g,'').replace(/[\u{1F1E6}-\u{1F1FF}]/gu,'').replace(/^[\s|•·:;,_—–-]+|[\s|•·:;,_—–-]+$/g,'').replace(/\s{2,}/g,' ').trim();return s||'Categoria'}
function normalizeServer(s){return String(s||'').trim().replace(/\/+$/,'')}
function parseLogin(raw){let text=String(raw||'').trim();if(!text)throw new Error('Informe o novo M3U.');if(!/^https?:\/\//i.test(text))text='http://'+text;let u;try{u=new URL(text)}catch{throw new Error('URL inválida.')}let username=u.searchParams.get('username')||u.searchParams.get('user'),password=u.searchParams.get('password')||u.searchParams.get('pass');const path=u.pathname.split('/').filter(Boolean);if((!username||!password)&&path.length>=2&&!/\.php$/i.test(path[path.length-1])){username=username||decodeURIComponent(path[0]);password=password||decodeURIComponent(path[1])}if(!username||!password)throw new Error('Não encontrei username e password.');return{server:normalizeServer(u.origin),username,password,liveExtension:(u.searchParams.get('output')||'m3u8').toLowerCase()==='ts'?'ts':'m3u8'}}
function apiUrl(params={},cfg=CONFIG){const u=new URL(normalizeServer(cfg.server)+'/player_api.php');u.searchParams.set('username',cfg.username);u.searchParams.set('password',cfg.password);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));return u.toString()}
function proxyUrl(url,cfg=CONFIG){const p=String(cfg.corsProxy||'').trim();if(!p)return url;return p.includes('{url}')?p.replace('{url}',encodeURIComponent(url)):p+encodeURIComponent(url)}
async function request(params={},cfg=CONFIG){const target=apiUrl(params,cfg);try{const r=await fetch(target,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(first){if(!cfg.corsProxy)throw new Error(first.message+' — possivelmente CORS.');const r=await fetch(proxyUrl(target,cfg),{cache:'no-store'});if(!r.ok)throw new Error('Proxy HTTP '+r.status);return await r.json()}}
function selectedTypes(){return [...new Set((CONFIG.targets||[]).map(t=>t.type).filter(t=>TYPE[t]))]}
function targetsFor(type){return (CONFIG.targets||[]).filter(t=>t.type===type)}
function targetKey(t){return t.type+'::'+t.name}
function itemTitle(item){return String(item?.name||item?.title||'Sem título')}
function itemId(item,type){return type==='series'?item.series_id:item.stream_id}
function imageFor(item,type){if(type==='series')return item.cover||item.stream_icon||item.movie_image||'';return item.stream_icon||item.movie_image||item.cover||''}
function uniqueById(items,type){const seen=new Set();return items.filter(x=>{const k=String(itemId(x,type)??itemTitle(x));if(seen.has(k))return false;seen.add(k);return true})}
function historyKey(type){const app=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_'),bucket=type==='series'?'series':'vod';return `srhell:${app}:standard:continue:${bucket}`}
function getHistory(type){if(type==='live')return[];try{return JSON.parse(localStorage.getItem(historyKey(type))||'[]')}catch{return[]}}
function saveHistory(entry){if(!entry||entry.type==='live')return;const type=entry.type==='series'?'series':'vod';let list=getHistory(type).filter(x=>x.key!==entry.key);list.unshift(entry);localStorage.setItem(historyKey(type),JSON.stringify(list.slice(0,40)));renderContinue()}
function removeHistory(key,type){if(type==='live')return;const bucket=type==='series'?'series':'vod';localStorage.setItem(historyKey(bucket),JSON.stringify(getHistory(bucket).filter(x=>x.key!==key)));renderContinue()}
function formatExpiry(account){const raw=account?.user_info?.exp_date;if(raw===null||raw===undefined||raw===''||String(raw)==='0')return{chip:'∞',date:'Sem expiração informada',days:'Sem limite informado'};const n=Number(raw);if(!Number.isFinite(n))return{chip:'—',date:'Não informada',days:'Não informado'};const d=new Date(n*1000);if(Number.isNaN(d.getTime()))return{chip:'—',date:'Não informada',days:'Não informado'};const diff=Math.ceil((d.getTime()-Date.now())/86400000);return{chip:diff<0?'0d':diff+'d',date:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}),days:diff<0?'Expirada':diff===0?'Expira hoje':diff===1?'1 dia restante':diff+' dias restantes'}}
async function refreshAccount(){el.meta.textContent='Atualizando validade…';try{const account=await request({});const exp=formatExpiry(account);el.daysChip.textContent=exp.chip;el.expiryDate.textContent=exp.date;el.expiryDays.textContent=exp.days;const status=String(account?.user_info?.status||'').trim();el.meta.textContent=(status?status+' · ':'')+exp.days}catch{el.daysChip.textContent='—';el.expiryDate.textContent='Indisponível';el.expiryDays.textContent='Não foi possível consultar';el.meta.textContent='Falha ao consultar validade'}}
async function categoryMap(type,force=false,cfg=CONFIG){if(!force&&cfg===CONFIG&&state.categoryMaps.has(type))return state.categoryMaps.get(type);const raw=await request({action:TYPE[type].categories},cfg);const map=new Map((Array.isArray(raw)?raw:[]).map(c=>[String(c.category_name??c.name??''),String(c.category_id??c.id??'')]));if(cfg===CONFIG)state.categoryMaps.set(type,map);return map}
async function resolveCategoryId(target){const map=await categoryMap(target.type);const id=map.get(target.name);if(!id)throw new Error('Categoria não encontrada: '+stripEmoji(target.name));return id}
async function loadTargetItems(target){const id=await resolveCategoryId(target);const raw=await request({action:TYPE[target.type].content,category_id:id});return Array.isArray(raw)?raw:[]}
function streamUrl(type,item){const base=normalizeServer(CONFIG.server),u=encodeURIComponent(CONFIG.username),p=encodeURIComponent(CONFIG.password),id=item?.id||item?.stream_id;let ext=item?.container_extension||item?.containerExtension||'';if(type==='live')return `${base}/live/${u}/${p}/${id}.${CONFIG.liveExtension||'m3u8'}`;if(type==='series')return `${base}/series/${u}/${p}/${id}.${ext||'mp4'}`;return `${base}/movie/${u}/${p}/${id}.${ext||'mp4'}`}
function uniqueMediaUrls(values){const out=[];for(const raw of values||[]){const v=String(raw||'').trim();if(v&&!out.includes(v))out.push(v)}return out}
function normalizeMediaUrl(value){const v=String(value||'').trim();if(!v)return'';if(/^https?:\/\//i.test(v))return v;if(v.startsWith('/'))return normalizeServer(CONFIG.server)+v;return''}
function httpsTwin(url){return /^http:\/\//i.test(String(url||''))?String(url).replace(/^http:/i,'https:'):''}
function mediaErrorInfo(video,extra){const e=video?.error,code=e?.code||0,map={1:'reprodução interrompida',2:'erro de rede ao carregar a mídia',3:'o navegador não conseguiu decodificar o vídeo',4:'formato ou codec não suportado pelo navegador'};return{code,message:extra?.details||extra?.type||map[code]||'falha de mídia desconhecida',networkState:video?.networkState,readyState:video?.readyState}}
function mediaCandidates(value){const list=Array.isArray(value)?value:[value],out=[];for(const u of list){out.push(u,httpsTwin(u))}return uniqueMediaUrls(out)}
function vodSourcesFromInfo(data,item){const info=data?.info||{},movie=data?.movie_data||item,direct=normalizeMediaUrl(movie?.direct_source||info?.direct_source||data?.direct_source||''),merged={...item,...movie,stream_id:movie.stream_id||item.stream_id,container_extension:movie.container_extension||item.container_extension},standard=streamUrl('vod',merged),hls=`${normalizeServer(CONFIG.server)}/movie/${encodeURIComponent(CONFIG.username)}/${encodeURIComponent(CONFIG.password)}/${merged.stream_id}.m3u8`;return uniqueMediaUrls([direct,httpsTwin(direct),standard,httpsTwin(standard),hls,httpsTwin(hls)])}
function qualityRank(q){const s=String(q).toUpperCase();if(s.includes('4K'))return 0;if(s.includes('UHD'))return 1;if(s.includes('FHD')||s.includes('FULL HD'))return 2;if(/^HD/.test(s))return 3;if(/^SD/.test(s))return 4;if(s.includes('265')||s.includes('HEVC'))return 5;if(s.includes('TESTE'))return 9;return 6}
function parseChannelName(raw){let name=String(raw||'Canal').trim();const patterns=[/\s*(?:[-|•:]\s*)?(TESTE)\s*$/i,/\s*(?:[-|•:]\s*)?(4K|UHD|FHD|FULL\s*HD|FULLHD|HD|SD)(?:\s*([1-9¹²³⁴⁵⁶⁷⁸⁹]))?\s*$/i,/\s*(?:[-|•:]\s*)?(\[\s*(?:H\.?\s*)?265\s*\]|H\.?265|HEVC)(?:\s*([1-9¹²³⁴⁵⁶⁷⁸⁹]))?\s*$/i];let quality='Padrão',base=name;for(const re of patterns){const m=base.match(re);if(m){quality=(m[1]||'').replace(/FULLHD/i,'FULL HD').replace(/\s+/g,' ').toUpperCase()+(m[2]||'');if(/265|HEVC/i.test(quality)){const suffix=m[2]||'';quality=/HEVC/i.test(m[1])?'HEVC'+suffix:/^\[/i.test(m[1])?'[265]'+suffix:'H.265'+suffix;}base=base.slice(0,m.index).replace(/[\s|•:,_—–-]+$/g,'').trim()||name;break}}return{base,quality}}
function groupChannels(items){const map=new Map();for(const item of items){const p=parseChannelName(itemTitle(item)),key=p.base.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9à-ÿ]+/g,'');if(!map.has(key))map.set(key,{baseName:p.base,image:imageFor(item,'live'),variants:[]});map.get(key).variants.push({...item,_quality:p.quality,_baseName:p.base})}return [...map.values()].map(g=>{g.variants.sort((a,b)=>qualityRank(a._quality)-qualityRank(b._quality)||a._quality.localeCompare(b._quality));return g})}
function cardDataImage(item,type){return type==='live'?item.image:imageFor(item,type)}
function cardDataName(item,type){return type==='live'?item.baseName:itemTitle(item)}
function mediaLoaderMarkup(label='Carregando'){return `<div class="media-loader"><div class="media-loader__core"><span class="media-loader__ring"></span><span class="media-loader__label">${escapeHtml(label)}</span></div></div>`}
function cardHtml(item,type,cls,index,left,width){const img=cardDataImage(item,type)||IMAGE_PLACEHOLDER,name=cardDataName(item,type),ratio=type==='live'?16/9:16/9;return `<article class="${cls}${type==='live'?' '+cls+'--live':''}" data-index="${index}" style="left:${left}px;width:${width}px;height:${Math.round(width*ratio)}px" aria-label="${escapeHtml(name)}"><img class="poster-card__image" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">${type==='live'?`<div class="live-flare"><div class="live-flare__name">${escapeHtml(name)}</div></div>`:''}</article>`}

/* ===== runtime/standard/02.js ===== */
class RailVirtualizer{constructor(section,type,items,onOpen){this.section=section;this.type=type;this.items=items;this.onOpen=onOpen;this.viewport=section.querySelector('.rail-viewport');this.track=section.querySelector('.rail-track');this.sig='';this.scroll=()=>this.render();this.viewport.addEventListener('scroll',this.scroll,{passive:true});this.ro=new ResizeObserver(()=>this.render(true));this.ro.observe(this.viewport);this.render(true)}metrics(){const w=innerWidth<680?112:136,gap=8,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));return{w,gap,slot,visible}}render(force=false){const m=this.metrics(),ratio=this.type==='live'?16/9:16/9,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length].join(':');if(!force&&sig===this.sig)return;this.sig=sig;this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';this.track.style.height=Math.round(m.w*ratio)+'px';this.track.innerHTML=this.items.slice(start,end).map((item,off)=>cardHtml(item,this.type,'poster-card',start+off,(start+off)*m.slot,m.w)).join('');this.track.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type))}destroy(){this.viewport.removeEventListener('scroll',this.scroll);this.ro.disconnect();this.track.innerHTML='';this.items=[]}}
class GridVirtualizer{constructor(scroller,spacer,type,items,onOpen){this.scroller=scroller;this.spacer=spacer;this.type=type;this.items=items;this.onOpen=onOpen;this.sig='';this.scroll=()=>this.render();this.scroller.addEventListener('scroll',this.scroll,{passive:true});this.ro=new ResizeObserver(()=>this.render(true));this.ro.observe(this.scroller);this.render(true)}metrics(){const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?6:9,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(126+gap))),w=(available-gap*(cols-1))/cols,ratio=this.type==='live'?16/9:16/9,h=w*ratio,rowH=h+gap;return{available,gap,cols,w,h,rowH}}render(force=false){const m=this.metrics(),rows=Math.ceil(this.items.length/m.cols),firstRow=Math.max(0,Math.floor(this.scroller.scrollTop/m.rowH)-1),visibleRows=Math.max(1,Math.ceil(this.scroller.clientHeight/m.rowH)),lastRow=Math.min(rows,firstRow+visibleRows*2+1),start=firstRow*m.cols,end=Math.min(this.items.length,lastRow*m.cols),sig=[start,end,m.cols,Math.round(m.w),this.items.length].join(':');if(!force&&sig===this.sig)return;this.sig=sig;this.spacer.style.height=Math.max(1,rows*m.rowH-m.gap)+'px';this.spacer.innerHTML=this.items.slice(start,end).map((item,off)=>{const idx=start+off,row=Math.floor(idx/m.cols),col=idx%m.cols,left=col*(m.w+m.gap),top=row*m.rowH,img=cardDataImage(item,this.type)||IMAGE_PLACEHOLDER,name=cardDataName(item,this.type);return `<article class="grid-card${this.type==='live'?' grid-card--live':''}" data-index="${idx}" style="left:${left}px;top:${top}px;width:${m.w}px;height:${m.h}px" aria-label="${escapeHtml(name)}"><img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">${this.type==='live'?`<div class="live-flare"><div class="live-flare__name">${escapeHtml(name)}</div></div>`:''}</article>`}).join('');this.spacer.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type))}destroy(){this.scroller.removeEventListener('scroll',this.scroll);this.ro.disconnect();this.spacer.innerHTML='';this.spacer.style.height='';this.items=[]}}
function destroyVirtualizers(){state.railInstances.forEach(x=>x.destroy());state.railInstances=[];state.gridInstance?.destroy();state.gridInstance=null;state.categoryObserver?.disconnect();state.categoryObserver=null;state.retentionObserver?.disconnect();state.retentionObserver=null;el.content.querySelectorAll('.rail-section').forEach(s=>clearTimeout(s._evictTimer))}
function freezePage(on){document.body.classList.toggle('modal-open',!!on)}
function closeCollection(rebuild=true){state.gridInstance?.destroy();state.gridInstance=null;el.collectionSpacer.innerHTML='';el.collectionSpacer.style.height='';el.collectionView.classList.add('is-hidden');state.collectionOpen=false;freezePage(false);if(rebuild)renderActiveType()}
function openCollection(title,type,items){closeDetail();closePlayer(false);state.searchDataset=null;destroyVirtualizers();el.content.innerHTML='';el.continueRow.innerHTML='';el.continueSection.classList.add('is-hidden');el.collectionTitle.textContent=stripEmoji(title);el.collectionView.classList.remove('is-hidden');state.collectionOpen=true;freezePage(true);state.gridInstance=new GridVirtualizer(el.collectionScroller,el.collectionSpacer,type,items.slice(),openItem);el.collectionScroller.scrollTop=0}
el.collectionClose.onclick=()=>closeCollection(true);
function renderTabs(){const types=selectedTypes();if(types.length<2){el.bottomNav.classList.add('is-hidden');el.app.classList.remove('has-bottom-nav');return}const icons={live:'<svg class="tab-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6.5" width="16" height="11" rx="2"/><path d="M9 20h6M10 3.5l2 3 2-3"/></svg>',vod:'<svg class="tab-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v12H5zM5 10h14M8 6.5l2 3.5M13 6.5l2 3.5"/></svg>',series:'<svg class="tab-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="12" height="15" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'};el.bottomNav.innerHTML=types.map(t=>`<button class="tab-button${t===state.activeType?' is-active':''}" data-type="${t}">${icons[t]||''}<span>${TYPE[t].label}</span></button>`).join('');el.bottomNav.classList.remove('is-hidden');el.app.classList.add('has-bottom-nav');el.bottomNav.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>switchType(b.dataset.type))}
function renderContinue(){const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&x.position>5&&x.position/x.duration<.97).slice(0,12);if(!list.length||type==='live'){el.continueSection.classList.add('is-hidden');el.continueRow.innerHTML='';return}el.continueSection.classList.remove('is-hidden');el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><img src="${escapeHtml(x.image||'')}" alt="" loading="lazy"><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');el.continueRow.querySelectorAll('[data-history]').forEach(c=>c.onclick=()=>{const x=list[Number(c.dataset.history)];if(x)openGeneralPlayer(x.sources||x.url,x.title,x)})}
async function renderRail(section,target,token){if(token!==state.renderToken)return;const body=section.querySelector('.rail-body');body.innerHTML=mediaLoaderMarkup('Carregando conteúdo');try{const raw=await loadTargetItems(target);if(token!==state.renderToken)return;const items=target.type==='live'?groupChannels(raw):uniqueById(raw,target.type);if(!items.length){body.innerHTML='<div class="skeleton">Sem conteúdos nesta categoria.</div>';return}body.innerHTML='<div class="rail-viewport"><div class="rail-track"></div></div>';const v=new RailVirtualizer(section,target.type,items,openItem);section._railV=v;state.railInstances.push(v);section.querySelector('[data-all]').onclick=()=>openCollection(target.name,target.type,items)}catch(e){body.innerHTML='<div class="skeleton">'+escapeHtml(e.message)+'</div>'}}
function evictRail(section){if(!section||section.dataset.loaded!=='1'||state.collectionOpen)return;const v=section._railV;if(v){v.destroy();state.railInstances=state.railInstances.filter(x=>x!==v);section._railV=null}section.querySelector('.rail-body').innerHTML=mediaLoaderMarkup('Liberado da memória');delete section.dataset.loaded;state.categoryObserver?.observe(section)}
function renderActiveType(){destroyVirtualizers();state.searchDataset=null;state.searchType=null;const token=++state.renderToken,targets=targetsFor(state.activeType);el.search.value='';el.search.placeholder='Buscar em '+TYPE[state.activeType].label.toLocaleLowerCase('pt-BR')+'…';el.content.innerHTML=targets.map((t,i)=>`<section class="rail-section" data-target="${i}"><header class="rail-head"><h2 class="rail-title">${escapeHtml(stripEmoji(t.name))}</h2><button class="rail-all" data-all>Ver todos</button></header><div class="rail-body">${mediaLoaderMarkup('Preparando')}</div></section>`).join('');el.homeStatus.textContent=targets.length+' categoria(s) em '+TYPE[state.activeType].label+'.';state.categoryObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;const section=e.target;if(section.dataset.loaded)return;section.dataset.loaded='1';state.categoryObserver.unobserve(section);renderRail(section,targets[Number(section.dataset.target)],token)}),{rootMargin:'260px 0px'});state.retentionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{const s=e.target;clearTimeout(s._evictTimer);if(!e.isIntersecting&&s.dataset.loaded==='1')s._evictTimer=setTimeout(()=>evictRail(s),30000)}),{rootMargin:'900px 0px'});el.content.querySelectorAll('.rail-section').forEach(s=>{state.categoryObserver.observe(s);state.retentionObserver.observe(s)});renderContinue();renderTabs()}
function switchType(type){if(!TYPE[type]||type===state.activeType)return;closeDetail();closePlayer(false);closeCollection(false);state.searchDataset=null;state.searchType=null;el.search.value='';state.activeType=type;renderActiveType()}
async function getSearchDataset(){if(state.searchDataset&&state.searchType===state.activeType)return state.searchDataset;const lists=await Promise.all(targetsFor(state.activeType).map(loadTargetItems));let items=lists.flat();items=state.activeType==='live'?groupChannels(items):uniqueById(items,state.activeType);state.searchDataset=items;state.searchType=state.activeType;return items}
async function runSearch(){const q=el.search.value.trim().toLocaleLowerCase('pt-BR'),token=++state.renderToken;destroyVirtualizers();if(!q){renderActiveType();return}el.homeStatus.textContent='Buscando em '+TYPE[state.activeType].label+'…';el.content.innerHTML=mediaLoaderMarkup('Buscando conteúdo');try{const all=await getSearchDataset();if(token!==state.renderToken)return;const items=all.filter(x=>cardDataName(x,state.activeType).toLocaleLowerCase('pt-BR').includes(q));el.homeStatus.textContent=items.length+' resultado(s) em '+TYPE[state.activeType].label+'.';el.content.innerHTML='<section class="search-results"><div class="grid-scroller" id="searchGrid"><div class="grid-spacer" id="searchSpacer"></div></div></section>';const sc=$('#searchGrid'),sp=$('#searchSpacer');sc.style.height='calc(100dvh - 145px)';sc.style.overflowY='auto';sc.style.overflowX='hidden';state.gridInstance=new GridVirtualizer(sc,sp,state.activeType,items,openItem)}catch(e){el.content.innerHTML='<div class="skeleton">'+escapeHtml(e.message)+'</div>'}}
el.search.oninput=()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(runSearch,220)};
function toggleSearch(){const opening=!el.searchWrap.classList.contains('is-open');el.searchWrap.classList.toggle('is-open',opening);el.searchButton.classList.toggle('is-active',opening);if(opening){el.search.placeholder='Buscar em '+TYPE[state.activeType].label.toLocaleLowerCase('pt-BR')+'…';setTimeout(()=>el.search.focus(),20)}else{el.search.value='';state.searchDataset=null;state.searchType=null;renderActiveType()}}
el.searchButton.onclick=toggleSearch;
function destroyHls(){if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}}
function attachVideo(video,url,onReady,onError){const queue=mediaCandidates(url);let index=0,last=null,finished=false;const next=()=>{if(finished)return;if(index>=queue.length){finished=true;onError?.(last);return}const current=queue[index++];destroyHls();video.pause();video.onerror=null;video.onloadedmetadata=null;video.removeAttribute('src');video.load();const fail=extra=>{last=mediaErrorInfo(video,extra);next()},ready=()=>{if(finished)return;finished=true;onReady?.(current);const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})},isHls=/\.m3u8(?:$|\?)/i.test(current);if(isHls&&window.Hls&&Hls.isSupported()){state.hls=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:30});state.hls.loadSource(current);state.hls.attachMedia(video);state.hls.on(Hls.Events.MANIFEST_PARSED,ready);state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)})}else{video.src=current;video.onloadedmetadata=ready;video.onerror=()=>fail();video.load();const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>{})}};next()}
function persistProgress(video=el.video){if(!state.currentMedia||state.currentMedia.type==='live'||!Number.isFinite(video.duration)||video.duration<=0||!Number.isFinite(video.currentTime))return;if(video.currentTime/video.duration>=.97){removeHistory(state.currentMedia.key,state.currentMedia.type);return}saveHistory({...state.currentMedia,position:video.currentTime,duration:video.duration,updatedAt:Date.now()})}
function isMobile(){return matchMedia('(max-width: 820px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)}
async function enterFullscreen(node){try{if(!document.fullscreenElement)await node.requestFullscreen?.()}catch{}if(isMobile()){try{await screen.orientation?.lock?.('landscape')}catch{}}}
async function leaveFullscreenPortrait(){try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}if(isMobile()){try{await screen.orientation?.lock?.('portrait')}catch{}}}
async function toggleFullscreen(node){if(document.fullscreenElement){await leaveFullscreenPortrait()}else await enterFullscreen(node)}

/* ===== runtime/standard/03.js ===== */
function openGeneralPlayer(url,title,entry=null){const sources=mediaCandidates(entry?.sources||url);state.playerActive=true;state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};state.saveTick=0;el.playerTitle.textContent=title;el.playerStatus.textContent='Carregando…';el.playerLayer.classList.remove('is-hidden');freezePage(true);attachVideo(el.video,sources,()=>{el.playerStatus.textContent='Reproduzindo';if(entry?.position>5&&entry.position<el.video.duration-5)el.video.currentTime=entry.position},err=>{el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')});el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};el.video.onpause=()=>persistProgress();el.video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type)}}
async function closePlayer(restoreFreeze=true){if(!state.playerActive)return;persistProgress();el.video.pause();destroyHls();await leaveFullscreenPortrait();el.playerLayer.classList.add('is-hidden');state.currentMedia=null;state.playerActive=false;if(restoreFreeze)freezePage(!el.detailLayer.classList.contains('is-hidden')||!el.collectionView.classList.contains('is-hidden'))}
el.playerClose.onclick=()=>closePlayer(true);el.playerExpand.onclick=()=>toggleFullscreen(el.playerWrap);
function synopsisMarkup(text,expanded=false){const full=String(text||'Sem sinopse disponível.').trim(),cut=!expanded&&full.length>200,value=cut?full.slice(0,200).trimEnd()+'…':full;return escapeHtml(value)+(cut?' <span class="synopsis__hint">mais</span>':'')}
function detailModal(){return el.detailLayer.querySelector('.detail-modal')}
function setSynopsisState(node,text,expanded){state.synopsisNode=node;state.synopsisText=String(text||'');state.synopsisExpanded=!!expanded;if(node)node.innerHTML=synopsisMarkup(state.synopsisText,state.synopsisExpanded)}
function collapseSynopsis(){if(state.synopsisExpanded&&state.synopsisNode){state.synopsisExpanded=false;state.synopsisNode.innerHTML=synopsisMarkup(state.synopsisText,false)}}
function openDetail(title){closePlayer(false);detailModal()?.classList.remove('is-series');el.detailHeadTitle.textContent=title;el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';el.detailScroll.scrollTop=0;el.detailLayer.classList.remove('is-hidden');freezePage(true);state.currentDetail={title};state.synopsisExpanded=false;state.synopsisText='';state.synopsisNode=null}
async function closeDetail(){if(state.seriesVideo){persistProgress(state.seriesVideo.video);state.seriesVideo.video.pause();destroyHls();state.seriesVideo=null}await leaveFullscreenPortrait();el.detailLayer.classList.add('is-hidden');detailModal()?.classList.remove('is-series');state.currentDetail=null;state.currentSeries=null;state.synopsisNode=null;state.synopsisText='';state.synopsisExpanded=false;freezePage(!el.collectionView.classList.contains('is-hidden'))}
el.detailClose.onclick=closeDetail;
el.detailLayer.addEventListener('click',e=>{if(e.target===el.detailLayer)closeDetail()});detailModal()?.addEventListener('click',e=>{if(state.synopsisExpanded&&!e.target.closest('.synopsis'))collapseSynopsis()},true);
async function openFilm(item){openDetail(itemTitle(item));try{const data=await request({action:'get_vod_info',vod_id:item.stream_id}),info=data?.info||{},movie=data?.movie_data||item,art=(info.backdrop_path&&Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path)||info.movie_image||movie.stream_icon||imageFor(item,'vod'),title=movie.name||itemTitle(item),plot=info.plot||info.description||movie.plot||item.plot||'',sources=vodSourcesFromInfo(data,item),url=sources[0]||streamUrl('vod',{...movie,stream_id:movie.stream_id||item.stream_id,container_extension:movie.container_extension||item.container_extension}),entry={key:'vod:'+(movie.stream_id||item.stream_id),type:'vod',title,image:art,url,sources,position:0,duration:0};state.currentDetail={type:'vod',entry};el.detailBody.innerHTML=`<div class="detail-content"><div class="detail-art"><img src="${escapeHtml(art||IMAGE_PLACEHOLDER)}" alt=""></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(title)}</h2><button class="watch-button" id="watchFilm"><svg class="watch-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12z"/></svg><span>Assistir</span></button></div><div class="synopsis" id="filmSynopsis">${synopsisMarkup(plot,false)}</div></div>`;const filmSynopsis=$('#filmSynopsis');setSynopsisState(filmSynopsis,plot,false);filmSynopsis.onclick=e=>{e.stopPropagation();setSynopsisState(filmSynopsis,plot,!state.synopsisExpanded)};$('#watchFilm').onclick=()=>{const old=getHistory('vod').find(x=>x.key===entry.key);openGeneralPlayer(entry.sources||url,title,old?{...entry,...old,sources:entry.sources}:entry)}}catch(e){el.detailBody.innerHTML='<div class="skeleton">'+escapeHtml(e.message)+'</div>'}}
function normalizeEpisodes(v){if(Array.isArray(v))return{'1':v};return v&&typeof v==='object'?v:{}}
function episodeKey(series,ep){return `series:${series.series_id}:${ep.id||ep.stream_id}`}
async function stopInlineSeriesVideo(){const sv=state.seriesVideo;if(!sv)return;persistProgress(sv.video);sv.video.pause();destroyHls();await leaveFullscreenPortrait();sv.video.classList.add('is-hidden');sv.image.classList.remove('is-hidden');sv.actions.classList.add('is-hidden');state.seriesVideo=null;state.currentMedia=null}
async function openSeries(item){openDetail(itemTitle(item));detailModal()?.classList.add('is-series');try{const data=await request({action:'get_series_info',series_id:item.series_id}),info=data?.info||{},episodes=normalizeEpisodes(data?.episodes),seasons=Object.keys(episodes).sort((a,b)=>Number(a)-Number(b)),backdrop=(Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path)||info.backdrop||info.cover_big||info.cover||item.cover||'',plot=info.plot||info.description||item.plot||'';state.currentSeries={item,data,episodes,backdrop};el.detailBody.innerHTML=`<div class="detail-content"><div class="series-static"><div class="detail-art" id="seriesArt"><img class="backdrop" id="seriesImage" src="${escapeHtml(backdrop||IMAGE_PLACEHOLDER)}" alt=""><video class="is-hidden" id="seriesInlineVideo" controls autoplay playsinline></video><div class="detail-art__actions is-hidden" id="seriesVideoActions"><button class="floating-action" id="seriesStop" title="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="floating-action" id="seriesExpand" title="Expandir ou minimizar"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button></div></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(itemTitle(item))}</h2></div><div class="synopsis" id="seriesSynopsis">${synopsisMarkup(plot,false)}</div><div class="season-box"><button class="season-trigger" id="seasonTrigger"><span id="seasonLabel">${seasons[0]?'Temporada '+escapeHtml(seasons[0]):'Temporadas'}</span><span>⌄</span></button><div class="season-menu is-hidden${seasons.length>4?' season-menu--scroll':''}" id="seasonMenu"></div></div></div><div class="episode-container"><div class="episode-list" id="episodeList"></div></div></div>`;const art=$('#seriesArt'),image=$('#seriesImage'),video=$('#seriesInlineVideo'),actions=$('#seriesVideoActions'),seasonMenu=$('#seasonMenu'),seasonLabel=$('#seasonLabel'),list=$('#episodeList'),syn=$('#seriesSynopsis');setSynopsisState(syn,plot,false);syn.onclick=e=>{e.stopPropagation();setSynopsisState(syn,plot,!state.synopsisExpanded)};seasonMenu.innerHTML=seasons.map((s,i)=>`<button class="season-option${i===0?' is-active':''}" data-season="${escapeHtml(s)}">Temporada ${escapeHtml(s)}</button>`).join('');$('#seasonTrigger').onclick=e=>{e.stopPropagation();seasonMenu.classList.toggle('is-hidden')};function drawSeason(key){seasonLabel.textContent='Temporada '+key;seasonMenu.classList.add('is-hidden');seasonMenu.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('is-active',b.dataset.season===key));const eps=Array.isArray(episodes[key])?episodes[key]:[],history=new Map(getHistory('series').map(x=>[x.key,x]));list.innerHTML=eps.map((ep,idx)=>{const n=ep.episode_num??idx+1,thumb=ep.info?.movie_image||ep.info?.cover_big||ep.info?.cover||ep.stream_icon||backdrop||IMAGE_PLACEHOLDER,h=history.get(episodeKey(item,ep)),pct=h?.duration?Math.min(100,h.position/h.duration*100):0;return `<article class="episode" data-ep="${idx}"><img class="episode__thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy"><div><div class="episode__title">Episódio ${escapeHtml(n)}</div><div class="episode__meta">${escapeHtml(ep.info?.duration||'')}</div><div class="episode__progress"><span style="width:${pct}%"></span></div></div><div class="episode__play"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M9 6.5v11l8-5.5z"/></svg></div></article>`}).join('');list.querySelectorAll('[data-ep]').forEach(row=>row.onclick=()=>playEpisode(eps[Number(row.dataset.ep)],Number(row.dataset.ep),key));list.scrollTop=0}async function playEpisode(ep,idx,season){await stopInlineSeriesVideo();const n=ep.episode_num??idx+1,url=streamUrl('series',ep),key=episodeKey(item,ep),old=getHistory('series').find(x=>x.key===key),entry={key,type:'series',title:itemTitle(item)+' — Episódio '+n,image:ep.info?.movie_image||backdrop,url,seriesId:item.series_id,season,episodeNumber:n,position:0,duration:0};image.classList.add('is-hidden');video.classList.remove('is-hidden');actions.classList.remove('is-hidden');state.currentMedia=old?{...entry,...old}:entry;state.saveTick=0;state.seriesVideo={video,image,actions,art};attachVideo(video,url,()=>{if(old?.position>5&&old.position<video.duration-5)video.currentTime=old.position},()=>toast('Não foi possível reproduzir este episódio.'));video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};video.onpause=()=>persistProgress(video);video.onended=()=>{removeHistory(key,'series');drawSeason(season)};$('#seriesStop').onclick=e=>{e.stopPropagation();stopInlineSeriesVideo().then(()=>drawSeason(season))};$('#seriesExpand').onclick=e=>{e.stopPropagation();toggleFullscreen(art)}}seasonMenu.querySelectorAll('[data-season]').forEach(b=>b.onclick=e=>{e.stopPropagation();drawSeason(b.dataset.season)});if(seasons[0])drawSeason(seasons[0]);else list.innerHTML='<div class="skeleton">A API não retornou episódios.</div>'}catch(e){el.detailBody.innerHTML='<div class="skeleton">'+escapeHtml(e.message)+'</div>'}}
function openLive(group){openDetail(group.baseName);state.currentDetail={type:'live',group};const logo=group.image||IMAGE_PLACEHOLDER,variants=group.variants||[];el.detailBody.innerHTML=`<div class="detail-content"><div class="detail-art"><img class="channel-logo" src="${escapeHtml(logo)}" alt=""></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(group.baseName)}</h2></div><div class="quality-list">${variants.map((v,i)=>`<button class="quality-row" data-quality-index="${i}"><span class="quality-row__name">${escapeHtml(group.baseName)}</span><span class="quality-row__quality">${escapeHtml(v._quality||'Padrão')}</span></button>`).join('')}</div></div>`;el.detailBody.querySelectorAll('[data-quality-index]').forEach(b=>b.onclick=()=>{const v=variants[Number(b.dataset.qualityIndex)],url=streamUrl('live',v);openGeneralPlayer(url,group.baseName+' · '+(v._quality||'Padrão'),{key:'live:'+v.stream_id,type:'live',title:group.baseName,url,image:logo,position:0,duration:0})})}
function openItem(item,type){if(type==='live')openLive(item);else if(type==='series')openSeries(item);else openFilm(item)}
function normalizeUpdateCategories(raw,type){return(Array.isArray(raw)?raw:[]).map((c,i)=>({type,name:String(c.category_name??c.name??('Categoria '+(i+1)))}))}
function renderUpdateGroups(){const grouped={live:[],vod:[],series:[]};state.updateCategories.forEach(c=>grouped[c.type]?.push(c));el.updateGroups.innerHTML=Object.entries(grouped).map(([type,cats])=>cats.length?`<section class="update-group"><div class="update-group__title">${TYPE[type].label}</div><div class="update-list">${cats.map(c=>{const key=type+'::'+c.name;return `<label class="update-option"><input type="checkbox" data-update-key="${escapeHtml(key)}" ${state.updateSelected.has(key)?'checked':''}><span>${escapeHtml(stripEmoji(c.name))}</span></label>`}).join('')}</div></section>`:'').join('');el.updateGroups.querySelectorAll('[data-update-key]').forEach(ch=>ch.onchange=()=>{ch.checked?state.updateSelected.add(ch.dataset.updateKey):state.updateSelected.delete(ch.dataset.updateKey);el.updateApply.disabled=!state.updateSelected.size})}
async function loadUpdateCategories(){state.updateCategories=[];state.updateSelected.clear();el.updateApply.disabled=true;el.updateGroups.innerHTML='';try{const candidate={...CONFIG,...parseLogin(el.updateM3u.value)};state.updateCandidate=candidate;el.updateStatus.textContent='Validando login e lendo categorias…';el.updateLoad.disabled=true;const account=await request({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');if(!active)throw new Error('O novo login não retornou uma conta ativa.');const groups=await Promise.all(Object.entries(TYPE).map(async([type,meta])=>normalizeUpdateCategories(await request({action:meta.categories},candidate),type)));state.updateCategories=groups.flat();const old=new Set((CONFIG.targets||[]).map(t=>t.type+'::'+t.name));state.updateCategories.forEach(c=>{const k=c.type+'::'+c.name;if(old.has(k))state.updateSelected.add(k)});renderUpdateGroups();el.updateStatus.textContent=state.updateCategories.length+' categorias disponíveis.'}catch(e){el.updateStatus.textContent=e.message}finally{el.updateLoad.disabled=false}}
function applyUpdate(){if(!state.updateCandidate||!state.updateSelected.size)return;const targets=state.updateCategories.filter(c=>state.updateSelected.has(c.type+'::'+c.name)).map(c=>({type:c.type,name:c.name})),runtime={server:state.updateCandidate.server,username:state.updateCandidate.username,password:state.updateCandidate.password,liveExtension:state.updateCandidate.liveExtension,targets};try{localStorage.setItem(storageKey(),JSON.stringify(runtime));toast('Lista atualizada. Recarregando…');setTimeout(()=>location.reload(),350)}catch{toast('O navegador bloqueou o armazenamento local deste arquivo.')}}
el.settingsButton.onclick=()=>{const opening=el.settingsPanel.classList.contains('is-hidden');el.settingsPanel.classList.toggle('is-hidden');if(opening)refreshAccount()};el.updateAccordionButton.onclick=()=>{const hidden=el.updateAccordionBody.classList.toggle('is-hidden');el.updateAccordionIcon.textContent=hidden?'⌄':'⌃'};el.updateLoad.onclick=loadUpdateCategories;el.updateApply.onclick=applyUpdate;
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&isMobile())screen.orientation?.lock?.('portrait')?.catch?.(()=>{})});
function init(){installImageFallback();document.body.dataset.theme=CONFIG.theme||'graphene';document.title=CONFIG.appName;el.title.textContent=CONFIG.appName;const types=selectedTypes();if(!types.length){el.homeStatus.textContent='Nenhuma categoria configurada.';return}state.activeType=types[0];renderActiveType();refreshAccount()}
/* ===== DIAGNOSTIC MODULES ===== */
/* ===== runtime/standard/04-fixes.js @ 46b9cd4bbf7d403a31634a4f46417856b6903e5a ===== */
/* SRHELL v6.6 detail/player fixes — loaded after standard/03.js */
function srhFixInlineState(){
  return state.detailInlineVideo || null;
}
function srhFixStopInlineDetailVideo(restoreImage=true){
  const iv=srhFixInlineState();
  if(!iv)return;
  try{persistProgress(iv.video)}catch{}
  try{iv.video.pause()}catch{}
  try{destroyHls()}catch{}
  try{iv.video.removeAttribute('src');iv.video.load()}catch{}
  if(restoreImage&&iv.image)iv.image.classList.remove('is-hidden');
  if(iv.art)iv.art.classList.remove('is-playing');
  try{iv.video.remove()}catch{}
  try{iv.actions.remove()}catch{}
  try{iv.status.remove()}catch{}
  state.detailInlineVideo=null;
  state.currentMedia=null;
  state.playerActive=false;
}
function srhFixOverlayPlayer(url,title,entry=null){
  const sources=mediaCandidates(entry?.sources||url);
  state.playerActive=true;
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.saveTick=0;
  el.playerTitle.textContent=title;
  el.playerStatus.textContent='Carregando…';
  el.playerLayer.classList.remove('is-hidden');
  freezePage(true);
  attachVideo(el.video,sources,()=>{
    el.playerStatus.textContent='Reproduzindo';
    if(entry?.position>5&&entry.position<el.video.duration-5)el.video.currentTime=entry.position
  },err=>{
    el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')
  });
  el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};
  el.video.onpause=()=>persistProgress();
  el.video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type)}
}
function srhFixInlinePlayer(url,title,entry=null){
  const art=el.detailBody.querySelector('.detail-art');
  if(!art)return srhFixOverlayPlayer(url,title,entry);
  srhFixStopInlineDetailVideo(false);

  const sources=mediaCandidates(entry?.sources||url);
  const image=art.querySelector('img');
  const video=document.createElement('video');
  video.className='detail-inline-video';
  video.controls=true;
  video.autoplay=true;
  video.playsInline=true;
  video.preload='metadata';

  const status=document.createElement('div');
  status.className='detail-inline-status';
  status.textContent='Carregando…';

  const actions=document.createElement('div');
  actions.className='detail-inline-actions';
  actions.innerHTML='<button class="detail-inline-action" data-inline-close aria-label="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="detail-inline-action" data-inline-expand aria-label="Expandir vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';

  if(image)image.classList.add('is-hidden');
  art.classList.add('is-playing');
  art.append(video,status,actions);

  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.playerActive=false;
  state.saveTick=0;
  state.detailInlineVideo={video,image,actions,status,art};

  attachVideo(video,sources,()=>{
    status.textContent='Reproduzindo';
    if(entry?.position>5&&Number.isFinite(video.duration)&&entry.position<video.duration-5)video.currentTime=entry.position;
  },err=>{
    status.textContent='Falha: '+(err?.message||'mídia indisponível');
  });

  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};
  video.onpause=()=>persistProgress(video);
  video.onended=()=>{
    if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type);
    status.textContent='Finalizado';
  };

  actions.querySelector('[data-inline-close]').onclick=e=>{
    e.stopPropagation();
    srhFixStopInlineDetailVideo(true);
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
  srhFixStopInlineDetailVideo(false);
  closePlayer(false);
  detailModal()?.classList.remove('is-series');
  el.detailHeadTitle.textContent='';
  el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';
  el.detailScroll.scrollTop=0;
  el.detailLayer.classList.remove('is-hidden');
  freezePage(true);
  state.currentDetail={title};
  state.synopsisExpanded=false;
  state.synopsisText='';
  state.synopsisNode=null;
}
async function closeDetail(){
  srhFixStopInlineDetailVideo(false);
  if(state.seriesVideo){
    persistProgress(state.seriesVideo.video);
    state.seriesVideo.video.pause();
    destroyHls();
    state.seriesVideo=null;
  }
  await leaveFullscreenPortrait();
  el.detailLayer.classList.add('is-hidden');
  detailModal()?.classList.remove('is-series');
  state.currentDetail=null;
  state.currentSeries=null;
  state.synopsisNode=null;
  state.synopsisText='';
  state.synopsisExpanded=false;
  freezePage(!el.collectionView.classList.contains('is-hidden'));
}
/* ===== runtime/standard/15-ui-organization-lite.js ===== */
/* SRHELL v6.6 — lightweight restoration of later UI organization.
   No MutationObserver, iframe favorites, extra transport or background network work. */
(function installLiteUiOrganization(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const STAR='<svg class="srh-lite-icon srh-lite-icon--star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH='<svg class="srh-lite-icon srh-lite-icon--trash" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  function readFavorites(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function writeFavorites(list){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(list.slice(0,160)));return true}catch{return false}}
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
    return active;
  }

  function startedEntry(type,item){
    if(type==='vod'){
      const key='vod:'+String(item?.stream_id??item?.id??'');
      return getHistory('vod').find(x=>x.key===key&&Number(x.position)>5&&Number(x.duration)>0)||null;
    }
    if(type==='series'){
      const sid=String(item?.series_id??item?.id??'');
      return getHistory('series').find(x=>String(x.seriesId??'')===sid&&Number(x.position)>5&&Number(x.duration)>0)||null;
    }
    return null;
  }
  function removeStarted(type,item){
    if(type==='vod'){
      const key='vod:'+String(item?.stream_id??item?.id??'');
      removeHistory(key,'vod');
      toast('Filme removido de Continuar assistindo.');
      return;
    }
    if(type==='series'){
      const sid=String(item?.series_id??item?.id??'');
      try{
        const next=getHistory('series').filter(x=>String(x.seriesId??'')!==sid);
        localStorage.setItem(historyKey('series'),JSON.stringify(next));
      }catch{}
      renderContinue();
      toast('Série removida de Continuar assistindo.');
    }
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
      b.onclick=e=>{e.stopPropagation();removeStarted(type,item);b.remove()};
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

  const baseOpenDetail=openDetail;
  openDetail=function(title){const r=baseOpenDetail(title);detailModal()?.classList.remove('is-vod','is-live');return r};
  const baseOpenFilm=openFilm;
  openFilm=async function(item){await baseOpenFilm(item);decorateDetail('vod',item)};
  const baseOpenSeries=openSeries;
  openSeries=async function(item){await baseOpenSeries(item);decorateDetail('series',item)};
  const baseOpenLive=openLive;
  openLive=function(group){const r=baseOpenLive(group);decorateDetail('live',group);return r};

  /* Favorites stays inside the existing collection view: one grid, no iframe. */
  const head=el.collectionTitle?.parentElement;
  const favTabs=document.createElement('div');
  favTabs.className='srh-favorites-tabs is-hidden';
  favTabs.innerHTML='<button class="srh-favorites-tab" data-fav-type="live">Ao vivo</button><button class="srh-favorites-tab" data-fav-type="vod">Filmes</button><button class="srh-favorites-tab" data-fav-type="series">Séries</button>';
  head?.insertAdjacentElement('afterend',favTabs);
  let favoriteEntries=[];
  function renderFavoriteType(type){
    state.gridInstance?.destroy();state.gridInstance=null;el.collectionSpacer.innerHTML='';el.collectionSpacer.style.height='';
    favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.classList.toggle('is-active',b.dataset.favType===type));
    const list=favoriteEntries.filter(x=>x.type===type);
    if(!list.length){el.collectionSpacer.innerHTML='<div class="srh-favorites-empty">Nenhum favorito nesta seção.</div>';return}
    const items=list.map(x=>x.item);
    state.gridInstance=new GridVirtualizer(el.collectionScroller,el.collectionSpacer,type,items,(item,itemType)=>{closeCollection(false);openItem(item,itemType)});
    el.collectionScroller.scrollTop=0;
  }
  function openFavorites(){
    closeDetail();closePlayer(false);state.searchDataset=null;destroyVirtualizers();el.content.innerHTML='';el.continueRow.innerHTML='';el.continueSection.classList.add('is-hidden');
    favoriteEntries=readFavorites();el.collectionTitle.textContent='Favoritos';el.collectionView.classList.remove('is-hidden');state.collectionOpen=true;freezePage(true);favTabs.classList.remove('is-hidden');
    const first=['vod','series','live'].find(t=>favoriteEntries.some(x=>x.type===t))||'vod';
    renderFavoriteType(first);
  }
  favTabs.querySelectorAll('[data-fav-type]').forEach(b=>b.onclick=()=>renderFavoriteType(b.dataset.favType));
  const baseOpenCollection=openCollection;
  openCollection=function(title,type,items){favTabs.classList.add('is-hidden');return baseOpenCollection(title,type,items)};
  const baseCloseCollection=closeCollection;
  closeCollection=function(rebuild=true){favTabs.classList.add('is-hidden');return baseCloseCollection(rebuild)};

  if(!document.getElementById('favoritesTopButton')){
    const b=document.createElement('button');
    b.type='button';b.className='icon-button';b.id='favoritesTopButton';b.setAttribute('aria-label','Favoritos');b.innerHTML=STAR;b.onclick=openFavorites;
    el.searchButton.insertAdjacentElement('afterend',b);
  }

  /* Continue watching opens the same full detail modal used by catalog items.
     The saved time is used to seek the media and freeze the exact frame in-place;
     no image/video frame bytes are stored in localStorage. */
  function historyVodItem(entry){
    const raw=String(entry?.key||'').split(':')[1]||'';
    let ext='mp4';
    try{
      const u=String(entry?.url||entry?.sources?.[0]||'');
      const m=u.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
      if(m)ext=m[1];
    }catch{}
    return{stream_id:raw,name:entry?.title||'Filme',stream_icon:entry?.image||'',container_extension:ext};
  }
  function historySeriesItem(entry){
    const name=String(entry?.title||'Série').replace(/\s+[—-]\s+Epis[oó]dio\s+\d+.*$/i,'').trim()||'Série';
    return{series_id:entry?.seriesId,name,cover:entry?.image||''};
  }
  function freezeAtSavedFrame(video,position,onDone){
    if(!video||!(Number(position)>0))return;
    const target=Math.max(0,Number(position)||0);
    let done=false,timer=0;
    const finish=()=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      try{video.pause()}catch{}
      try{video.muted=false}catch{}
      onDone?.();
    };
    const seek=()=>{
      try{
        const end=Number.isFinite(video.duration)&&video.duration>0?Math.max(0,video.duration-.35):target;
        video.currentTime=Math.min(target,end);
      }catch{}
    };
    try{video.muted=true}catch{}
    video.addEventListener('loadedmetadata',seek,{once:true});
    video.addEventListener('seeked',()=>requestAnimationFrame(finish),{once:true});
    video.addEventListener('playing',()=>{
      if(Math.abs((video.currentTime||0)-target)<1.2)requestAnimationFrame(finish);
    },{once:true});
    timer=setTimeout(()=>{
      seek();
      setTimeout(finish,180);
    },3200);
    if(video.readyState>=1)seek();
  }
  async function openContinueMovie(entry){
    const item=historyVodItem(entry);
    if(!item.stream_id)return;
    await openFilm(item);
    const watch=el.detailBody.querySelector('#watchFilm');
    if(!watch)return;
    watch.click();
    const inline=state.detailInlineVideo;
    if(!inline?.video)return;
    freezeAtSavedFrame(inline.video,entry.position,()=>{
      if(inline.status)inline.status.textContent='Pausado';
    });
  }
  async function openContinueSeries(entry){
    const item=historySeriesItem(entry);
    if(!item.series_id)return;
    await openSeries(item);
    const video=el.detailBody.querySelector('#seriesInlineVideo');
    if(!video)return;
    freezeAtSavedFrame(video,entry.position);
    const season=String(entry.season??'');
    if(season){
      const option=[...el.detailBody.querySelectorAll('[data-season]')].find(b=>String(b.dataset.season)===season);
      option?.click();
    }
    const episodeNo=String(entry.episodeNumber??'').trim();
    let row=null;
    if(episodeNo){
      row=[...el.detailBody.querySelectorAll('.episode')].find(r=>{
        const t=r.querySelector('.episode__title')?.textContent||'';
        return new RegExp('Epis[oó]dio\\s+'+episodeNo+'(?:\\D|$)','i').test(t);
      });
    }
    row=row||el.detailBody.querySelector('.episode');
    row?.click();
  }
  async function openContinueEntry(entry,type){
    if(!entry)return;
    if(type==='series')return openContinueSeries(entry);
    return openContinueMovie(entry);
  }

  renderContinue=function(){
    const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&x.position>5&&x.position/x.duration<.97).slice(0,12);
    if(!list.length||type==='live'){
      el.continueSection.classList.add('is-hidden');
      el.continueRow.innerHTML='';
      return;
    }
    el.continueSection.classList.remove('is-hidden');
    el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><img src="${escapeHtml(x.image||'')}" alt="" loading="lazy"><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');
    el.continueRow.querySelectorAll('[data-history]').forEach(c=>c.onclick=()=>{
      const x=list[Number(c.dataset.history)];
      if(x)openContinueEntry(x,type);
    });
  };

})();

init();
})();
