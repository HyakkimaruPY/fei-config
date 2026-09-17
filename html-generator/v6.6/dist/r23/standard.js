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
/* ===== R23 MODULES ===== */
/* ===== runtime/standard/04-fixes.js ===== */
/* SRHELL v6.6 runtime patch.
   IMPORTANT: standard.html injects this source INSIDE the core IIFE, immediately
   before its final })(); so these replacements share the original runtime scope. */

/* --------------------------------------------------------------------------
 * Aura channel grouping recovered from redirect_6-25_chain
 * ----------------------------------------------------------------------- */
const SRH_AURA_QUALITY_RE=/\s(?:SD|HD\+|FHD|UHD|4K|HEVC|H26[45]|HDR\+|HDR10|HDR|\+HD|HD|720P|1080P|\[H?26[45]\]|POTÊNCIA\s?[\d¹²³⁴⁵⁶⁷⁸⁹])\b/i;
function srhAuraQuality(raw){
  const name=String(raw||'').trim(),m=name.match(SRH_AURA_QUALITY_RE);
  return m?m[0].trim().replace(/\s+/g,' ').toUpperCase():'Padrão';
}
function srhAuraBaseChannel(raw){
  return String(raw||'Canal')
    .replace(SRH_AURA_QUALITY_RE,'')
    .replace(/\s+(?:TESTE)\s*$/i,'')
    .replace(/[\s|•:,_—–-]+$/g,'')
    .replace(/\s{2,}/g,' ')
    .trim()||String(raw||'Canal').trim()||'Canal';
}
function parseChannelName(raw){return{base:srhAuraBaseChannel(raw),quality:srhAuraQuality(raw)}}
function qualityRank(q){
  const s=String(q||'').toUpperCase();
  if(s.includes('4K'))return 0;
  if(s.includes('UHD'))return 1;
  if(s.includes('HDR10')||s.includes('HDR+'))return 2;
  if(s.includes('HDR'))return 3;
  if(s.includes('FHD')||s.includes('1080P')||s.includes('FULL HD'))return 4;
  if(s.includes('HD+')||s==='HD'||s.includes('720P')||s.includes('+HD'))return 5;
  if(s.includes('HEVC')||s.includes('H265')||s.includes('[H265]'))return 6;
  if(s.includes('H264')||s.includes('[H264]'))return 7;
  if(s.includes('POTÊNCIA'))return 8;
  if(s.includes('SD'))return 9;
  if(s.includes('TESTE'))return 20;
  return 10;
}
function groupChannels(items){
  const map=new Map();
  for(const item of items||[]){
    const p=parseChannelName(itemTitle(item));
    const key=p.base.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
    if(!map.has(key))map.set(key,{baseName:p.base,image:imageFor(item,'live'),variants:[]});
    const group=map.get(key);
    if(!group.image)group.image=imageFor(item,'live');
    group.variants.push({...item,_quality:p.quality,_baseName:p.base});
  }
  return[...map.values()].map(g=>{g.variants.sort((a,b)=>qualityRank(a._quality)-qualityRank(b._quality)||String(a.name||'').localeCompare(String(b.name||'')));return g});
}

/* --------------------------------------------------------------------------
 * Aura poster/card proportions and labels
 * ----------------------------------------------------------------------- */
function cardHtml(item,type,cls,index,left,width){
  const img=cardDataImage(item,type)||IMAGE_PLACEHOLDER,name=cardDataName(item,type),live=type==='live';
  return `<article class="${cls} ${cls}--${type}${live?' '+cls+'--live':''}" data-index="${index}" style="left:${left}px;width:${width}px" aria-label="${escapeHtml(name)}"><img class="poster-card__image" src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async"><div class="aura-card-shade"></div><div class="aura-card-title">${escapeHtml(name)}</div></article>`;
}
RailVirtualizer.prototype.metrics=function(){
  const live=this.type==='live',w=innerWidth<680?(live?116:108):(live?146:132),gap=10,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));
  return{w,gap,slot,visible};
};
RailVirtualizer.prototype.render=function(force=false){
  const m=this.metrics(),ratio=this.type==='live'?1:1.5,start=Math.max(0,Math.floor(this.viewport.scrollLeft/m.slot)-1),end=Math.min(this.items.length,start+m.visible*2+1),sig=[start,end,m.w,this.items.length,this.type].join(':');
  if(!force&&sig===this.sig)return;
  this.sig=sig;
  this.track.style.width=Math.max(this.viewport.clientWidth,this.items.length*m.slot-m.gap)+'px';
  this.track.style.height=Math.round(m.w*ratio)+'px';
  this.track.innerHTML=this.items.slice(start,end).map((item,off)=>{const idx=start+off;return cardHtml(item,this.type,'poster-card',idx,idx*m.slot,m.w)}).join('');
  this.track.querySelectorAll('[data-index]').forEach(c=>{c.style.height=Math.round(m.w*ratio)+'px';c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type)});
};
GridVirtualizer.prototype.metrics=function(){
  const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:11,live=this.type==='live',base=live?138:122,cols=innerWidth<680?3:Math.max(3,Math.floor((available+gap)/(base+gap))),w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
  return{available,gap,cols,w,h,rowH};
};
GridVirtualizer.prototype.render=function(force=false){
  const m=this.metrics(),rows=Math.ceil(this.items.length/m.cols),firstRow=Math.max(0,Math.floor(this.scroller.scrollTop/m.rowH)-1),visibleRows=Math.max(1,Math.ceil(this.scroller.clientHeight/m.rowH)),lastRow=Math.min(rows,firstRow+visibleRows*2+1),start=firstRow*m.cols,end=Math.min(this.items.length,lastRow*m.cols),sig=[start,end,m.cols,Math.round(m.w),this.items.length,this.type].join(':');
  if(!force&&sig===this.sig)return;
  this.sig=sig;
  this.spacer.style.height=Math.max(1,rows*m.rowH-m.gap)+'px';
  this.spacer.innerHTML=this.items.slice(start,end).map((item,off)=>{const idx=start+off,row=Math.floor(idx/m.cols),col=idx%m.cols,left=col*(m.w+m.gap),top=row*m.rowH,img=cardDataImage(item,this.type)||IMAGE_PLACEHOLDER,name=cardDataName(item,this.type);return `<article class="grid-card grid-card--${this.type}${this.type==='live'?' grid-card--live':''}" data-index="${idx}" style="left:${left}px;top:${top}px;width:${m.w}px;height:${m.h}px" aria-label="${escapeHtml(name)}"><img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async"><div class="aura-card-shade"></div><div class="aura-card-title">${escapeHtml(name)}</div></article>`}).join('');
  this.spacer.querySelectorAll('[data-index]').forEach(c=>c.onclick=()=>this.onOpen(this.items[Number(c.dataset.index)],this.type));
};

/* --------------------------------------------------------------------------
 * Static-HTML stream fallback: direct first, then scheme/extension variants;
 * browser redirect resolution runs only after a real playback failure.
 * ----------------------------------------------------------------------- */
function srhAuraAddUrl(out,value){const u=String(value||'').trim();if(/^https?:\/\//i.test(u)&&!out.includes(u))out.push(u)}
function srhAuraSchemeTwin(url,scheme){try{const u=new URL(String(url||''));u.protocol=scheme+':';return u.href}catch{return''}}
function srhAuraXtreamVariants(url){
  const out=[];srhAuraAddUrl(out,url);
  let u;try{u=new URL(String(url||''))}catch{return out}
  const isXtream=/\/(?:live|movie|series)\/[^/]+\/[^/]+\/[^/?#]+/i.test(u.pathname);
  if(isXtream){
    const m=u.pathname.match(/^(.*\/[^/.?#]+)(?:\.([a-z0-9]{2,6}))$/i);
    if(m){
      const originalPath=u.pathname,base=m[1],ext=m[2].toLowerCase();
      const addPath=p=>{const x=new URL(u.href);x.pathname=p;srhAuraAddUrl(out,x.href)};
      if(ext!=='m3u8')addPath(base+'.m3u8');
      addPath(originalPath);
      if(ext!=='mp4')addPath(base+'.mp4');
      if(ext!=='ts')addPath(base+'.ts');
      addPath(base);
    }
  }
  return out;
}
function mediaCandidates(value){
  const input=Array.isArray(value)?value:[value],out=[],preferHttps=location.protocol==='https:';
  for(const raw of input){
    const variants=srhAuraXtreamVariants(raw);
    for(const v of variants){
      if(preferHttps){srhAuraAddUrl(out,srhAuraSchemeTwin(v,'https'));srhAuraAddUrl(out,v);srhAuraAddUrl(out,srhAuraSchemeTwin(v,'http'))}
      else{srhAuraAddUrl(out,v);srhAuraAddUrl(out,srhAuraSchemeTwin(v,'https'));srhAuraAddUrl(out,srhAuraSchemeTwin(v,'http'))}
    }
  }
  return out;
}
async function srhAuraResolveRedirect(url,timeoutMs=2600){
  for(const method of ['HEAD','GET']){
    const c=new AbortController(),tid=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const r=await fetch(url,{method,redirect:'follow',cache:'no-store',credentials:'omit',signal:c.signal});
      clearTimeout(tid);
      if(r.status>=200&&r.status<400&&r.url&&r.url!==url)return r.url;
    }catch{clearTimeout(tid)}
  }
  return'';
}
function attachVideo(video,url,onReady,onError){
  const queue=mediaCandidates(url),resolved=new Set();let index=0,last=null,finished=false;
  const next=()=>{
    if(finished)return;
    if(index>=queue.length){finished=true;onError?.(last);return}
    const current=queue[index++];let failed=false;
    destroyHls();video.pause();video.onerror=null;video.onloadedmetadata=null;video.removeAttribute('src');video.load();
    const fail=async extra=>{
      if(failed||finished)return;failed=true;last=mediaErrorInfo(video,extra);
      if(!resolved.has(current)){
        resolved.add(current);
        const finalUrl=await srhAuraResolveRedirect(current,2200);
        if(finalUrl&&finalUrl!==current){
          const additions=mediaCandidates(finalUrl).filter(x=>!queue.includes(x));
          if(additions.length)queue.splice(index,0,...additions);
        }
      }
      next();
    };
    const ready=()=>{if(finished)return;finished=true;onReady?.(current);const p=video.play();p?.catch?.(()=>{})};
    const isHls=/\.m3u8(?:$|\?)/i.test(current);
    if(isHls&&window.Hls&&Hls.isSupported()){
      state.hls=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:30,maxMaxBufferLength:48,backBufferLength:18,manifestLoadingTimeOut:9000,levelLoadingTimeOut:12000,fragLoadingTimeOut:16000});
      state.hls.loadSource(current);state.hls.attachMedia(video);
      state.hls.on(Hls.Events.MANIFEST_PARSED,ready);
      state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)});
    }else{
      video.src=current;video.onloadedmetadata=ready;video.onerror=()=>fail();video.load();const p=video.play();p?.catch?.(()=>{});
    }
  };
  next();
}

/* --------------------------------------------------------------------------
 * Inline playback in detail media area (film/live), preserving series logic.
 * ----------------------------------------------------------------------- */
function srhFixInlineState(){return state.detailInlineVideo||null}
function srhFixStopInlineDetailVideo(restoreImage=true){
  const iv=srhFixInlineState();if(!iv)return;
  try{persistProgress(iv.video)}catch{}
  try{iv.video.pause()}catch{}
  try{destroyHls()}catch{}
  try{iv.video.removeAttribute('src');iv.video.load()}catch{}
  if(restoreImage&&iv.image)iv.image.classList.remove('is-hidden');
  if(iv.art)iv.art.classList.remove('is-playing');
  try{iv.video.remove()}catch{}try{iv.actions.remove()}catch{}try{iv.status.remove()}catch{}
  state.detailInlineVideo=null;state.currentMedia=null;state.playerActive=false;
}
function srhFixOverlayPlayer(url,title,entry=null){
  const sources=mediaCandidates(entry?.sources||url);
  state.playerActive=true;
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.saveTick=0;el.playerTitle.textContent=title;el.playerStatus.textContent='Carregando…';el.playerLayer.classList.remove('is-hidden');freezePage(true);
  attachVideo(el.video,sources,()=>{el.playerStatus.textContent='Reproduzindo';if(entry?.position>5&&entry.position<el.video.duration-5)el.video.currentTime=entry.position},err=>{el.playerStatus.textContent='Falha: '+(err?.message||'mídia indisponível')});
  el.video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress()};el.video.onpause=()=>persistProgress();el.video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type)};
}
function srhFixInlinePlayer(url,title,entry=null){
  const art=el.detailBody.querySelector('.detail-art');if(!art)return srhFixOverlayPlayer(url,title,entry);
  srhFixStopInlineDetailVideo(false);
  const sources=mediaCandidates(entry?.sources||url),image=art.querySelector('img'),video=document.createElement('video');
  video.className='detail-inline-video';video.controls=true;video.autoplay=true;video.playsInline=true;video.preload='metadata';
  const status=document.createElement('div');status.className='detail-inline-status';status.textContent='Carregando…';
  const actions=document.createElement('div');actions.className='detail-inline-actions';actions.innerHTML='<button class="detail-inline-action" data-inline-close aria-label="Fechar vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button><button class="detail-inline-action" data-inline-expand aria-label="Expandir vídeo"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';
  if(image)image.classList.add('is-hidden');art.classList.add('is-playing');art.append(video,status,actions);
  state.currentMedia=entry?{...entry,sources,url:entry.url||sources[0]}:{key:'tmp:'+Date.now(),type:'live',title,url:sources[0],sources,image:'',position:0,duration:0};
  state.playerActive=false;state.saveTick=0;state.detailInlineVideo={video,image,actions,status,art};
  attachVideo(video,sources,()=>{status.textContent='Reproduzindo';if(entry?.position>5&&Number.isFinite(video.duration)&&entry.position<video.duration-5)video.currentTime=entry.position},err=>{status.textContent='Falha: '+(err?.message||'mídia indisponível')});
  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};video.onpause=()=>persistProgress(video);video.onended=()=>{if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type);status.textContent='Finalizado'};
  actions.querySelector('[data-inline-close]').onclick=e=>{e.stopPropagation();srhFixStopInlineDetailVideo(true)};
  actions.querySelector('[data-inline-expand]').onclick=e=>{e.stopPropagation();toggleFullscreen(art)};
}
function openGeneralPlayer(url,title,entry=null){
  const detailOpen=!el.detailLayer.classList.contains('is-hidden'),inlineType=state.currentDetail?.type;
  if(detailOpen&&(inlineType==='vod'||inlineType==='live'))return srhFixInlinePlayer(url,title,entry);
  return srhFixOverlayPlayer(url,title,entry);
}
function openDetail(title){
  srhFixStopInlineDetailVideo(false);closePlayer(false);detailModal()?.classList.remove('is-series');el.detailHeadTitle.textContent='';el.detailBody.innerHTML='<div class="skeleton">Carregando…</div>';el.detailScroll.scrollTop=0;el.detailLayer.classList.remove('is-hidden');freezePage(true);state.currentDetail={title};state.synopsisExpanded=false;state.synopsisText='';state.synopsisNode=null;
}
async function closeDetail(){
  srhFixStopInlineDetailVideo(false);
  if(state.seriesVideo){persistProgress(state.seriesVideo.video);state.seriesVideo.video.pause();destroyHls();state.seriesVideo=null}
  await leaveFullscreenPortrait();el.detailLayer.classList.add('is-hidden');detailModal()?.classList.remove('is-series');state.currentDetail=null;state.currentSeries=null;state.synopsisNode=null;state.synopsisText='';state.synopsisExpanded=false;freezePage(!el.collectionView.classList.contains('is-hidden'));
}

/* ===== runtime/standard/05-proxy-fix.js ===== */
/* SRHELL v6.6 — explicit CORS proxy state.
   Injected inside the standard runtime IIFE before init().
   Empty field MUST mean: do not use any proxy, even if an older CONFIG had one. */

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
    const groups=await Promise.all(Object.entries(TYPE).map(async([type,meta])=>normalizeUpdateCategories(await request({action:meta.categories},candidate),type)));
    state.updateCategories=groups.flat();
    const old=new Set((CONFIG.targets||[]).map(t=>t.type+'::'+t.name));
    state.updateCategories.forEach(c=>{const k=c.type+'::'+c.name;if(old.has(k))state.updateSelected.add(k)});
    renderUpdateGroups();
    el.updateStatus.textContent=state.updateCategories.length+' categorias disponíveis'+(candidate.corsProxy?' · Proxy CORS ativo.':' · conexão direta, sem proxy.');
  }catch(e){
    el.updateStatus.textContent=e.message;
  }finally{
    el.updateLoad.disabled=false;
  }
}

function applyUpdate(){
  if(!state.updateCandidate||!state.updateSelected.size)return;
  const targets=state.updateCategories.filter(c=>state.updateSelected.has(c.type+'::'+c.name)).map(c=>({type:c.type,name:c.name}));
  const runtime={
    server:state.updateCandidate.server,
    username:state.updateCandidate.username,
    password:state.updateCandidate.password,
    liveExtension:state.updateCandidate.liveExtension,
    corsProxy:String(state.updateCandidate.corsProxy||'').trim(),
    targets
  };
  try{
    localStorage.setItem(storageKey(),JSON.stringify(runtime));
    CONFIG={...CONFIG,...runtime};
    toast(runtime.corsProxy?'Lista atualizada com Proxy CORS. Recarregando…':'Lista atualizada sem Proxy CORS. Recarregando…');
    setTimeout(()=>location.reload(),350);
  }catch{
    toast('O navegador bloqueou o armazenamento local deste arquivo.');
  }
}

/* ===== runtime/standard/06-player-cleanup.js ===== */
/* SRHELL v6.6 — modal/player lifecycle cleanup.
   Injected inside the standard runtime IIFE after the Aura/player patches. */

function srhDestroyDetailPlayback(){
  try{srhFixStopInlineDetailVideo(false)}catch{}
  if(state.seriesVideo){
    try{persistProgress(state.seriesVideo.video)}catch{}
    try{state.seriesVideo.video.pause()}catch{}
    try{state.seriesVideo.video.removeAttribute('src');state.seriesVideo.video.load()}catch{}
    state.seriesVideo=null;
  }
  try{destroyHls()}catch{}
  state.currentMedia=null;
  state.playerActive=false;
  el.detailBody?.querySelectorAll('video').forEach(v=>{
    try{v.pause()}catch{}
    try{v.removeAttribute('src');v.load()}catch{}
  });
}

/* Film/live player: the modal already has one close button, so the media area
   gets only the fullscreen control. */
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
  actions.innerHTML='<button class="detail-inline-action" data-inline-expand aria-label="Tela cheia"><svg class="ui-svg" viewBox="0 0 24 24"><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M8.5 19.5h-4v-4M15.5 19.5h4v-4"/></svg></button>';

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
  },err=>{status.textContent='Falha: '+(err?.message||'mídia indisponível')});

  video.ontimeupdate=()=>{if(++state.saveTick%25===0)persistProgress(video)};
  video.onpause=()=>persistProgress(video);
  video.onended=()=>{
    if(state.currentMedia?.key)removeHistory(state.currentMedia.key,state.currentMedia.type);
    status.textContent='Finalizado';
  };
  actions.querySelector('[data-inline-expand]').onclick=e=>{
    e.stopPropagation();
    toggleFullscreen(art);
  };
}

async function closeDetail(){
  srhDestroyDetailPlayback();
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

/* Rebind after all function overrides so both the top-right X and clicking the
   backdrop always execute the destructive close path. */
el.detailClose.onclick=()=>closeDetail();
el.detailLayer.addEventListener('click',e=>{
  if(e.target===el.detailLayer)closeDetail();
});

/* ===== runtime/standard/07-detail-cleanup.js ===== */
/* SRHELL v6.6 — keep detail information; remove only redundant player close controls.
   Title, synopsis and normal modal actions must remain part of the detail layout. */

(function installDetailCleanup(){
  const baseOpenDetail=openDetail;
  openDetail=function(title){
    baseOpenDetail(title);
    const modal=detailModal();
    modal?.classList.remove('is-vod','is-series');
  };

  const baseOpenFilm=openFilm;
  openFilm=async function(item){
    await baseOpenFilm(item);
    const modal=detailModal();
    modal?.classList.remove('is-series');
    modal?.classList.add('is-vod');
    el.detailBody.querySelectorAll('[data-inline-close]').forEach(n=>n.remove());
  };

  const baseOpenSeries=openSeries;
  openSeries=async function(item){
    await baseOpenSeries(item);
    const modal=detailModal();
    modal?.classList.remove('is-vod');
    modal?.classList.add('is-series');
    document.getElementById('seriesStop')?.remove();
    el.detailBody.querySelectorAll('[data-inline-close]').forEach(n=>n.remove());
  };

  const baseOpenLive=openLive;
  openLive=function(group){
    const modal=detailModal();
    modal?.classList.remove('is-vod','is-series');
    return baseOpenLive(group);
  };
})();

/* ===== runtime/standard/08-favorites-continue.js ===== */
/* SRHELL v6.6 — favorites + continue-in-modal behavior. */
(function installFavoritesAndContinue(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const STAR_SVG='<svg class="srh-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH_SVG='<svg class="srh-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  function srhReadFavorites(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function srhWriteFavorites(list){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(list.slice(0,160)));return true}catch{return false}}
  function srhFavoriteKey(type,item){
    if(type==='live'){
      const id=item?.variants?.[0]?.stream_id||item?.variants?.[0]?.id||'';
      return 'live:'+(id||String(item?.baseName||'canal').toLocaleLowerCase('pt-BR'));
    }
    if(type==='series')return 'series:'+String(item?.series_id??item?.id??'');
    return 'vod:'+String(item?.stream_id??item?.id??'');
  }
  function srhCompactFavorite(type,item){
    const key=srhFavoriteKey(type,item);
    if(type==='live'){
      const variants=(item?.variants||[]).map(v=>({stream_id:v.stream_id??v.id,name:v.name||v.title||item.baseName,stream_icon:v.stream_icon||item.image||'',container_extension:v.container_extension||'',_quality:v._quality||'Padrão'}));
      return{key,type,title:item?.baseName||'Canal',image:item?.image||variants[0]?.stream_icon||'',item:{baseName:item?.baseName||'Canal',image:item?.image||'',variants}};
    }
    if(type==='series')return{key,type,title:itemTitle(item),image:imageFor(item,'series'),item:{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')}};
    return{key,type,title:itemTitle(item),image:imageFor(item,'vod'),item:{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod'),container_extension:item?.container_extension||'mp4'}};
  }
  function srhIsFavorite(type,item){const key=srhFavoriteKey(type,item);return srhReadFavorites().some(x=>x.key===key)}
  function srhToggleFavorite(type,item){
    const entry=srhCompactFavorite(type,item),list=srhReadFavorites(),idx=list.findIndex(x=>x.key===entry.key);let active;
    if(idx>=0){list.splice(idx,1);active=false}else{list.unshift(entry);active=true}
    if(!srhWriteFavorites(list)){toast('Não foi possível salvar Favoritos.');return srhIsFavorite(type,item)}
    toast(active?'Adicionado aos Favoritos.':'Removido dos Favoritos.');return active;
  }
  function srhSeriesTitleFromHistory(entry){return String(entry?.seriesTitle||entry?.title||'Série').replace(/\s+[—–-]\s*Episódio\s+\d+.*$/i,'').trim()||'Série'}
  function srhRemoveContinue(entry){
    if(!entry)return;
    if(entry.type==='series'&&entry.seriesId!==undefined&&entry.seriesId!==null){
      const list=getHistory('series').filter(x=>String(x.seriesId??'')!==String(entry.seriesId));
      try{localStorage.setItem(historyKey('series'),JSON.stringify(list))}catch{}
      renderContinue();toast('Série removida de Continuar assistindo.');return;
    }
    removeHistory(entry.key,entry.type);toast('Removido de Continuar assistindo.');
  }
  function srhAttachDetailToolbar(type,item,historyEntry=null){
    const art=el.detailBody.querySelector('.detail-art');if(!art)return;
    art.querySelector('.srh-detail-toolbar')?.remove();
    const title=type==='live'?(item?.baseName||'Canal'):itemTitle(item),fav=srhIsFavorite(type,item),wrap=document.createElement('div');
    wrap.className='srh-detail-toolbar';
    wrap.innerHTML=`<div class="srh-detail-toolbar__title">${escapeHtml(title)}</div><div class="srh-detail-toolbar__actions">${historyEntry&&type!=='live'?`<button class="srh-detail-tool srh-detail-tool--trash" data-srh-trash aria-label="Remover de Continuar assistindo">${TRASH_SVG}</button>`:''}<button class="srh-detail-tool${fav?' is-active':''}" data-srh-favorite aria-label="${fav?'Remover dos':'Adicionar aos'} favoritos">${STAR_SVG}</button></div>`;
    art.appendChild(wrap);
    const favBtn=wrap.querySelector('[data-srh-favorite]');
    favBtn.onclick=e=>{e.stopPropagation();const active=srhToggleFavorite(type,item);favBtn.classList.toggle('is-active',active);favBtn.setAttribute('aria-label',active?'Remover dos favoritos':'Adicionar aos favoritos')};
    const trash=wrap.querySelector('[data-srh-trash]');if(trash)trash.onclick=e=>{e.stopPropagation();srhRemoveContinue(historyEntry);trash.remove()};
  }

  const previousOpenFilm=openFilm;
  openFilm=async function(item){await previousOpenFilm(item);srhAttachDetailToolbar('vod',item,null)};
  const previousOpenSeries=openSeries;
  openSeries=async function(item){await previousOpenSeries(item);srhAttachDetailToolbar('series',item,null)};
  const previousOpenLive=openLive;
  openLive=function(group){const r=previousOpenLive(group);queueMicrotask(()=>srhAttachDetailToolbar('live',group,null));return r};

  async function srhOpenHistoryModal(entry){
    if(!entry)return;
    if(entry.type==='vod'){
      const id=String(entry.key||'').replace(/^vod:/,'')||String(entry.streamId||'');
      const item={stream_id:id,name:entry.title||'Filme',stream_icon:entry.image||'',container_extension:entry.containerExtension||'mp4'};
      await openFilm(item);srhAttachDetailToolbar('vod',item,entry);el.detailBody.querySelector('#watchFilm')?.click();return;
    }
    if(entry.type==='series'){
      const sid=entry.seriesId||String(entry.key||'').split(':')[1];
      const item={series_id:sid,name:srhSeriesTitleFromHistory(entry),cover:entry.image||''};
      await openSeries(item);srhAttachDetailToolbar('series',item,entry);
      const season=String(entry.season??'');
      if(season){const sBtn=[...el.detailBody.querySelectorAll('[data-season]')].find(b=>String(b.dataset.season)===season);sBtn?.click()}
      await new Promise(r=>setTimeout(r,0));
      const eps=state.currentSeries?.episodes?.[season]||state.currentSeries?.episodes?.[String(Number(season))]||[];
      let idx=eps.findIndex(ep=>episodeKey(item,ep)===entry.key);
      if(idx<0&&entry.episodeNumber!==undefined)idx=eps.findIndex(ep=>String(ep.episode_num??'')===String(entry.episodeNumber));
      if(idx<0&&entry.episodeNumber!==undefined)idx=Math.max(0,Number(entry.episodeNumber)-1);
      el.detailBody.querySelector(`[data-ep="${idx}"]`)?.click();
    }
  }

  renderContinue=function(){
    const type=state.activeType,list=getHistory(type).filter(x=>x.duration>0&&x.position>5&&x.position/x.duration<.97).slice(0,12);
    if(!list.length||type==='live'){el.continueSection.classList.add('is-hidden');el.continueRow.innerHTML='';return}
    el.continueSection.classList.remove('is-hidden');
    el.continueRow.innerHTML=list.map((x,i)=>`<article class="continue-card" data-history="${i}"><img src="${escapeHtml(x.image||'')}" alt="" loading="lazy"><div class="progress"><div class="progress__bar" style="width:${Math.min(100,x.position/x.duration*100)}%"></div></div><div class="continue-card__body"><div class="continue-card__title">${escapeHtml(x.title)}</div><div class="continue-card__meta">${Math.round(x.position/x.duration*100)}%</div></div></article>`).join('');
    el.continueRow.querySelectorAll('[data-history]').forEach(c=>c.onclick=()=>{const x=list[Number(c.dataset.history)];if(x)srhOpenHistoryModal(x)});
  };

  function srhFavoriteFrameMarkup(list){
    const data=JSON.stringify(list).replace(/</g,'\\u003c');
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07140f;color:#eef7f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}body{padding:16px}.head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:22px;font-weight:800}.close{width:42px;height:42px;border:1px solid rgba(162,208,236,.25);border-radius:14px;background:#10241c;color:#fff;font-size:23px}.tabs{display:flex;gap:8px;position:sticky;top:0;background:rgba(7,20,15,.94);padding:6px 0 12px;z-index:2}.tab{flex:1;min-height:42px;border:1px solid rgba(162,208,236,.2);border-radius:13px;background:#0c1d17;color:#aebdb6;font-weight:750}.tab.active{background:#1a3a2d;color:#fff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.card{position:relative;border:1px solid rgba(162,208,236,.22);border-radius:16px;overflow:hidden;background:#0c1d17;padding:0;text-align:left;color:#fff}.card img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;background:#13251f}.card.live img{aspect-ratio:1/1;object-fit:contain;padding:8px}.name{padding:8px 9px 10px;font-size:12px;font-weight:750;line-height:1.2}.empty{padding:54px 12px;text-align:center;color:#9fb0a8}@media(min-width:720px){.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}</style></head><body><div class="head"><div class="title">Favoritos</div><button class="close" id="close">×</button></div><div class="tabs"><button class="tab active" data-type="live">Ao vivo</button><button class="tab" data-type="vod">Filmes</button><button class="tab" data-type="series">Séries</button></div><div class="grid" id="grid"></div><script>const items=${data};let type='live';const grid=document.getElementById('grid');function esc(v){return String(v||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}function draw(){const list=items.filter(x=>x.type===type);grid.innerHTML=list.length?list.map(x=>'<button class="card '+(x.type==='live'?'live':'')+'" data-key="'+esc(x.key)+'"><img src="'+esc(x.image||'')+'" alt=""><div class="name">'+esc(x.title)+'</div></button>').join(''):'<div class="empty">Nenhum favorito nesta categoria.</div>';grid.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>parent.postMessage({srhFavorites:true,action:'open',key:b.dataset.key},'*'))}document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{type=b.dataset.type;document.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('active',x===b));draw()});document.getElementById('close').onclick=()=>parent.postMessage({srhFavorites:true,action:'close'},'*');draw();<\/script></body></html>`;
  }
  let favoritesOverlay=null,favoritesFrame=null;
  function srhCloseFavorites(){if(!favoritesOverlay)return;favoritesOverlay.remove();favoritesOverlay=null;favoritesFrame=null;freezePage(!el.detailLayer.classList.contains('is-hidden')||state.collectionOpen)}
  function srhOpenFavorites(){srhCloseFavorites();favoritesOverlay=document.createElement('section');favoritesOverlay.className='srh-favorites-overlay';favoritesOverlay.innerHTML='<iframe class="srh-favorites-frame" title="Favoritos"></iframe>';document.body.appendChild(favoritesOverlay);favoritesFrame=favoritesOverlay.querySelector('iframe');favoritesFrame.srcdoc=srhFavoriteFrameMarkup(srhReadFavorites());freezePage(true)}
  window.addEventListener('message',e=>{
    if(!favoritesFrame||e.source!==favoritesFrame.contentWindow||!e.data?.srhFavorites)return;
    if(e.data.action==='close'){srhCloseFavorites();return}
    if(e.data.action==='open'){
      const entry=srhReadFavorites().find(x=>x.key===e.data.key);if(!entry)return;
      srhCloseFavorites();if(entry.type==='live')openLive(entry.item);else if(entry.type==='series')openSeries(entry.item);else openFilm(entry.item);
    }
  });

  const favButton=document.createElement('button');
  favButton.className='icon-button';favButton.id='favoritesTopButton';favButton.setAttribute('aria-label','Favoritos');favButton.innerHTML=STAR_SVG;
  el.searchButton.insertAdjacentElement('afterend',favButton);favButton.onclick=srhOpenFavorites;
  renderContinue();
})();

/* ===== runtime/standard/09-detail-hierarchy.js ===== */
/* SRHELL v6.6 — restore the intended detail hierarchy after favorites/history patches.
   Actions belong beside the title below the art, never beside the modal close button. */
(function installDetailHierarchyFix(){
  let queued=false;

  function applyHierarchy(){
    queued=false;
    const body=el.detailBody;
    if(!body)return;

    const row=body.querySelector('.detail-title-row');
    const toolbar=body.querySelector('.srh-detail-toolbar');

    if(row&&toolbar){
      toolbar.classList.add('srh-detail-toolbar--inline');
      toolbar.querySelector('.srh-detail-toolbar__title')?.remove();
      if(toolbar.parentElement!==row)row.appendChild(toolbar);
    }

    if(row){
      const title=row.querySelector('.detail-title');
      if(title)title.classList.add('srh-detail-title');
    }

    /* Film: keep the title/actions as one row, then render Assistir on its own row,
       followed by the synopsis. */
    const modal=detailModal();
    if(modal?.classList.contains('is-vod')){
      const watch=body.querySelector('.watch-button');
      if(watch){
        let watchRow=body.querySelector('.srh-watch-row');
        if(!watchRow){
          watchRow=document.createElement('div');
          watchRow.className='srh-watch-row';
          if(row)row.insertAdjacentElement('afterend',watchRow);
          else body.querySelector('.detail-art')?.insertAdjacentElement('afterend',watchRow);
        }
        if(watch.parentElement!==watchRow)watchRow.appendChild(watch);
      }
    }else{
      body.querySelector('.srh-watch-row')?.remove();
    }
  }

  function scheduleHierarchy(){
    if(queued)return;
    queued=true;
    queueMicrotask(applyHierarchy);
  }

  const observer=new MutationObserver(scheduleHierarchy);
  observer.observe(el.detailBody,{childList:true,subtree:true});

  const prevFilm=openFilm;
  openFilm=async function(item){
    await prevFilm(item);
    applyHierarchy();
  };

  const prevSeries=openSeries;
  openSeries=async function(item){
    await prevSeries(item);
    applyHierarchy();
  };

  const prevLive=openLive;
  openLive=function(group){
    const result=prevLive(group);
    scheduleHierarchy();
    return result;
  };
})();

/* ===== runtime/standard/10-actions-accessibility.js ===== */
/* SRHELL v6.6 — final film/series action layout, reliable history deletion and themed favorites. */
(function installFinalActionLayout(){
  const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
  const FAVORITES_KEY=`srhell:${APP_NS}:standard:favorites:v1`;
  const STAR='<svg class="srh-final-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8l2.52 5.1 5.63.82-4.08 3.97.96 5.61L12 16.65 6.97 19.3l.96-5.61L3.85 9.72l5.63-.82L12 3.8z"/></svg>';
  const TRASH='<svg class="srh-final-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8.2v9.1M12 8.2v9.1M16 8.2v9.1M5.5 6.1h13M9 4.3h6l.7 1.8H8.3L9 4.3zM6.7 6.1l.7 13.2h9.2l.7-13.2"/></svg>';

  let ctx=null;
  const suppressedKeys=new Set();
  const suppressedSeries=new Set();

  const originalSaveHistory=saveHistory;
  saveHistory=function(entry){
    if(!entry)return;
    if(suppressedKeys.has(String(entry.key||'')))return;
    if(entry.type==='series'&&suppressedSeries.has(String(entry.seriesId??'')))return;
    return originalSaveHistory(entry);
  };

  function readFavs(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
  function writeFavs(v){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(v.slice(0,160)));return true}catch{return false}}
  function favKey(type,item){
    if(type==='series')return 'series:'+String(item?.series_id??item?.id??'');
    return 'vod:'+String(item?.stream_id??item?.id??'');
  }
  function favEntry(type,item){
    if(type==='series')return{key:favKey(type,item),type,title:itemTitle(item),image:imageFor(item,'series'),item:{series_id:item?.series_id??item?.id,name:itemTitle(item),cover:imageFor(item,'series')}};
    return{key:favKey(type,item),type,title:itemTitle(item),image:imageFor(item,'vod'),item:{stream_id:item?.stream_id??item?.id,name:itemTitle(item),stream_icon:imageFor(item,'vod'),container_extension:item?.container_extension||'mp4'}};
  }
  function isFav(type,item){const k=favKey(type,item);return readFavs().some(x=>x.key===k)}
  function toggleFav(type,item){
    const e=favEntry(type,item),list=readFavs(),i=list.findIndex(x=>x.key===e.key);let active=false;
    if(i>=0)list.splice(i,1);else{list.unshift(e);active=true}
    if(!writeFavs(list)){toast('Não foi possível salvar Favoritos.');return isFav(type,item)}
    toast(active?'Adicionado aos Favoritos.':'Removido dos Favoritos.');return active;
  }

  function removeContinue(type,item){
    if(type==='vod'){
      const key='vod:'+String(item?.stream_id??item?.id??'');
      suppressedKeys.add(key);
      removeHistory(key,'vod');
      toast('Filme removido de Continuar assistindo.');
      return;
    }
    const sid=String(item?.series_id??item?.id??'');
    suppressedSeries.add(sid);
    try{
      const list=getHistory('series').filter(x=>String(x.seriesId??'')!==sid);
      localStorage.setItem(historyKey('series'),JSON.stringify(list));
    }catch{}
    renderContinue();
    toast('Série removida de Continuar assistindo.');
  }

  function buildIconButton(kind,active=false){
    const b=document.createElement('button');
    b.type='button';
    b.className='srh-final-action srh-final-action--'+kind+(active?' is-active':'');
    b.setAttribute('aria-label',kind==='favorite'?(active?'Remover dos favoritos':'Adicionar aos favoritos'):'Remover de Continuar assistindo');
    b.innerHTML=kind==='favorite'?STAR:TRASH;
    return b;
  }

  function normalizeContext(type,item,fromContinue=false){
    ctx={type,item,fromContinue:!!fromContinue};
    if(type==='vod')suppressedKeys.delete('vod:'+String(item?.stream_id??item?.id??''));
    if(type==='series')suppressedSeries.delete(String(item?.series_id??item?.id??''));
  }

  function installActions(){
    if(!ctx||!['vod','series'].includes(ctx.type))return;
    const body=el.detailBody;if(!body)return;

    /* Remove all legacy title/flare toolbars. Their functionality is rebuilt below. */
    body.querySelectorAll('.srh-detail-toolbar').forEach(n=>n.remove());
    body.querySelectorAll('.srh-final-actions').forEach(n=>n.remove());
    body.querySelectorAll('.detail-title-row').forEach(n=>n.remove());
    body.querySelectorAll('.detail-title').forEach(n=>n.remove());

    const synopsis=body.querySelector('.synopsis');
    const art=body.querySelector('.detail-art');
    const row=document.createElement('div');
    row.className='srh-final-actions srh-final-actions--'+ctx.type;

    if(ctx.type==='vod'){
      const watch=body.querySelector('.watch-button');
      if(watch){
        watch.classList.add('srh-final-watch');
        row.appendChild(watch);
      }
      const oldWatchRow=body.querySelector('.srh-watch-row');
      if(oldWatchRow&&!oldWatchRow.children.length)oldWatchRow.remove();
    }

    const iconGroup=document.createElement('div');
    iconGroup.className='srh-final-actions__icons';
    const fav=buildIconButton('favorite',isFav(ctx.type,ctx.item));
    fav.onclick=e=>{
      e.stopPropagation();
      const active=toggleFav(ctx.type,ctx.item);
      fav.classList.toggle('is-active',active);
      fav.setAttribute('aria-label',active?'Remover dos favoritos':'Adicionar aos favoritos');
    };
    iconGroup.appendChild(fav);

    if(ctx.fromContinue){
      const trash=buildIconButton('trash');
      trash.onclick=e=>{
        e.stopPropagation();
        removeContinue(ctx.type,ctx.item);
        ctx.fromContinue=false;
        trash.remove();
      };
      iconGroup.appendChild(trash);
    }
    row.appendChild(iconGroup);

    if(synopsis)synopsis.insertAdjacentElement('afterend',row);
    else if(art)art.insertAdjacentElement('afterend',row);
    else body.prepend(row);
  }

  const prevFilm=openFilm;
  openFilm=async function(item){
    normalizeContext('vod',item,false);
    await prevFilm(item);
    installActions();
  };

  const prevSeries=openSeries;
  openSeries=async function(item){
    normalizeContext('series',item,false);
    await prevSeries(item);
    installActions();
  };

  /* The R8 continue flow marks history-origin modals by inserting a temporary
     toolbar containing a trash button. Detect that marker, then replace it with
     the final low-position action row. */
  let pending=false;
  const detailObserver=new MutationObserver(()=>{
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{
      pending=false;
      if(!ctx||!['vod','series'].includes(ctx.type))return;
      const legacy=[...el.detailBody.querySelectorAll('.srh-detail-toolbar')];
      if(!legacy.length)return;
      if(legacy.some(x=>x.querySelector('[data-srh-trash]')))ctx.fromContinue=true;
      legacy.forEach(x=>x.remove());
      installActions();
    });
  });
  detailObserver.observe(el.detailBody,{childList:true,subtree:true});

  /* Make the Favorites iframe inherit the active theme instead of using a fixed green palette. */
  function cssVar(name,fallback){return getComputedStyle(document.body).getPropertyValue(name).trim()||fallback}
  function themeFavoritesFrame(frame){
    const doc=frame.contentDocument;if(!doc||!doc.head)return;
    doc.getElementById('srh-parent-theme')?.remove();
    const bg=cssVar('--bg','#0d151c'),elev=cssVar('--bg-elev','#101820'),surface=cssVar('--surface','#121a22'),surface2=cssVar('--surface-2','#182532'),line=cssVar('--line','rgba(162,208,236,.24)'),text=cssVar('--text','#eaeff3'),muted=cssVar('--muted','#aab3ba'),accent=cssVar('--accent','#a2d0ec'),buttonFg=cssVar('--button-fg','#0d151c');
    const s=doc.createElement('style');s.id='srh-parent-theme';
    s.textContent=`:root{color-scheme:${document.body.dataset.theme==='porcelain'?'light':'dark'}}html,body{background:${bg}!important;color:${text}!important}.tabs{background:${bg}!important}.title{color:${text}!important}.close,.tab{background:${surface}!important;border-color:${line}!important;color:${muted}!important}.tab.active{background:${accent}!important;color:${buttonFg}!important;border-color:${accent}!important}.card{background:${surface}!important;border-color:${line}!important;color:${text}!important}.card img{background:${surface2}!important}.card.live img{background:${surface2}!important}.name{background:${elev}!important;color:${text}!important}.empty{color:${muted}!important}*{scrollbar-color:${accent} transparent}`;
    doc.head.appendChild(s);
  }
  const frameObserver=new MutationObserver(records=>{
    for(const r of records)for(const n of r.addedNodes){
      if(!(n instanceof Element))continue;
      const frames=[...(n.matches?.('.srh-favorites-frame')?[n]:[]),...n.querySelectorAll?.('.srh-favorites-frame')||[]];
      frames.forEach(frame=>{frame.addEventListener('load',()=>themeFavoritesFrame(frame),{once:false});setTimeout(()=>themeFavoritesFrame(frame),0)});
    }
  });
  frameObserver.observe(document.body,{childList:true,subtree:true});

  /* Opening an item from Favorites must dismiss its iframe before the shared detail modal appears. */
  function forceCloseFavorites(){document.querySelectorAll('.srh-favorites-overlay').forEach(n=>n.remove())}
  window.addEventListener('message',e=>{if(e.data?.srhFavorites&&e.data.action==='open')forceCloseFavorites()},true);
  new MutationObserver(()=>{if(!el.detailLayer.classList.contains('is-hidden'))forceCloseFavorites()}).observe(el.detailLayer,{attributes:true,attributeFilter:['class']});
})();

/* ===== runtime/standard/11-aura-transport-r11.js ===== */
/* SRHELL v6.6 — R11 transport hardening.
   Direct first; configured CORS proxy is a fallback for API, images and media.
   For HLS proxy mode, every XHR (manifest/levels/fragments) is routed through
   the configured proxy instead of proxying only the first .m3u8 URL. */

const SRH_TRANSPORT_R11='aura-transport-r11';

function srhProxyBase(cfg=CONFIG){return String(cfg?.corsProxy||'').trim()}
function srhHttpUrl(value){return /^https?:\/\//i.test(String(value||'').trim())}
function srhSchemeTwin(url,scheme){try{const u=new URL(String(url||''));u.protocol=scheme+':';return u.href}catch{return''}}
function srhPushUnique(out,value){const v=String(value||'').trim();if(v&&!out.includes(v))out.push(v)}

function srhBuildProxyUrl(target,cfg=CONFIG){
  const base=srhProxyBase(cfg),raw=String(target||'').trim();
  if(!base||!raw)return'';
  const encoded=encodeURIComponent(raw);
  if(base.includes('{rawUrl}'))return base.split('{rawUrl}').join(raw);
  if(base.includes('{raw}'))return base.split('{raw}').join(raw);
  if(base.includes('{url}'))return base.split('{url}').join(encoded);
  if(/[?&](?:url|target|uri|quest|q)=$/i.test(base)||base.endsWith('='))return base+encoded;
  if(base.endsWith('?'))return base+encoded;
  if(/\/fetch\/$/i.test(base))return base+raw;
  try{
    const u=new URL(base);
    const known=['url','target','uri','quest','q'];
    const existing=known.find(k=>u.searchParams.has(k));
    u.searchParams.set(existing||'url',raw);
    return u.toString();
  }catch{
    return base+(base.includes('?')?'&url=':'?url=')+encoded;
  }
}

function srhProxyUrls(target,cfg=CONFIG){
  const out=[],p=srhBuildProxyUrl(target,cfg);
  if(!p)return out;
  if(location.protocol==='https:'&&/^http:\/\//i.test(p))srhPushUnique(out,srhSchemeTwin(p,'https'));
  srhPushUnique(out,p);
  return out;
}

function proxyUrl(url,cfg=CONFIG){return srhBuildProxyUrl(url,cfg)||url}

async function srhFetchJsonUrl(url,timeoutMs=13000){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):0;
  try{
    const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal,headers:{Accept:'application/json,text/plain,*/*'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const text=await r.text();
    try{return JSON.parse(text)}catch{throw new Error('resposta não é JSON')}
  }finally{if(timer)clearTimeout(timer)}
}

async function request(params={},cfg=CONFIG){
  const target=apiUrl(params,cfg),urls=[];
  if(location.protocol==='https:'&&/^http:\/\//i.test(target))srhPushUnique(urls,srhSchemeTwin(target,'https'));
  srhPushUnique(urls,target);
  for(const p of srhProxyUrls(target,cfg))srhPushUnique(urls,p);
  const errors=[];
  for(const url of urls){
    try{return await srhFetchJsonUrl(url)}
    catch(e){errors.push((url===target?'direto':'rota alternativa')+': '+String(e?.message||e))}
  }
  const suffix=srhProxyBase(cfg)?' Proxy CORS configurado também falhou.':' Sem Proxy CORS configurado.';
  throw new Error((errors.at(-1)||'Falha no fetch.')+suffix);
}

function srhImageCandidates(src,cfg=CONFIG){
  const out=[],raw=String(src||'').trim();
  if(!srhHttpUrl(raw))return out;
  for(const p of srhProxyUrls(raw,cfg))srhPushUnique(out,p);
  const https=srhSchemeTwin(raw,'https');
  if(https&&https!==raw)srhPushUnique(out,https);
  for(const p of srhProxyUrls(https,cfg))srhPushUnique(out,p);
  return out.filter(x=>x!==raw);
}

function installImageFallback(){
  document.addEventListener('error',e=>{
    const img=e.target;
    if(!(img instanceof HTMLImageElement))return;
    if(img.dataset.srhImageFinal==='1')return;
    const initial=img.dataset.srhImageOriginal||img.getAttribute('src')||'';
    if(!img.dataset.srhImageOriginal)img.dataset.srhImageOriginal=initial;
    let queue=[];
    try{queue=JSON.parse(img.dataset.srhImageQueue||'[]')}catch{}
    if(!queue.length){
      queue=srhImageCandidates(initial,CONFIG);
      img.dataset.srhImageQueue=JSON.stringify(queue);
      img.dataset.srhImageIndex='0';
    }
    const index=Number(img.dataset.srhImageIndex||0);
    if(index<queue.length){
      img.dataset.srhImageIndex=String(index+1);
      img.referrerPolicy='no-referrer';
      img.src=queue[index];
      return;
    }
    img.dataset.srhImageFinal='1';
    img.classList.add('image-fallback');
    img.src=IMAGE_PLACEHOLDER;
  },true);
}

function srhHlsOptions(proxyAll=false){
  const options={enableWorker:true,lowLatencyMode:false,maxBufferLength:30,maxMaxBufferLength:48,backBufferLength:18,manifestLoadingTimeOut:10000,manifestLoadingMaxRetry:3,levelLoadingTimeOut:12000,levelLoadingMaxRetry:4,fragLoadingTimeOut:16000,fragLoadingMaxRetry:5};
  if(proxyAll&&srhProxyBase(CONFIG)){
    options.xhrSetup=(xhr,url)=>{
      const p=srhBuildProxyUrl(url,CONFIG);
      if(p&&p!==url&&xhr.readyState===0)xhr.open('GET',p,true);
    };
  }
  return options;
}

function srhTransportEntries(value){
  const direct=mediaCandidates(value),out=direct.map(url=>({url,proxyAll:false}));
  if(srhProxyBase(CONFIG))for(const url of direct)out.push({url,proxyAll:true});
  return out;
}

function attachVideo(video,url,onReady,onError){
  const queue=srhTransportEntries(url),resolved=new Set();
  let index=0,last=null,finished=false;
  const next=()=>{
    if(finished)return;
    if(index>=queue.length){finished=true;onError?.(last);return}
    const entry=queue[index++],current=entry.url;let failed=false;
    destroyHls();
    try{video.pause()}catch{}
    video.onerror=null;video.onloadedmetadata=null;video.removeAttribute('src');
    try{video.load()}catch{}
    const fail=async extra=>{
      if(failed||finished)return;failed=true;last=mediaErrorInfo(video,extra);
      if(!entry.proxyAll&&!resolved.has(current)&&typeof srhAuraResolveRedirect==='function'){
        resolved.add(current);
        const finalUrl=await srhAuraResolveRedirect(current,2200);
        if(finalUrl&&finalUrl!==current){
          const additions=srhTransportEntries(finalUrl).filter(x=>!queue.some(q=>q.url===x.url&&q.proxyAll===x.proxyAll));
          if(additions.length)queue.splice(index,0,...additions);
        }
      }
      next();
    };
    const ready=()=>{
      if(finished)return;finished=true;
      const played=entry.proxyAll&&!/\.m3u8(?:$|[?#])/i.test(current)?(srhBuildProxyUrl(current,CONFIG)||current):current;
      onReady?.(played);
      const p=video.play();p?.catch?.(()=>{});
    };
    const isHls=/\.m3u8(?:$|[?#])/i.test(current);
    if(isHls&&window.Hls&&Hls.isSupported()){
      try{
        state.hls=new Hls(srhHlsOptions(entry.proxyAll));
        state.hls.loadSource(current);state.hls.attachMedia(video);
        state.hls.on(Hls.Events.MANIFEST_PARSED,ready);
        state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail(d)});
      }catch(e){fail(e)}
    }else{
      const actual=entry.proxyAll?(srhBuildProxyUrl(current,CONFIG)||current):current;
      video.src=actual;video.onloadedmetadata=ready;video.onerror=()=>fail();
      try{video.load()}catch{}
      const p=video.play();p?.catch?.(()=>{});
    }
  };
  next();
}

/* ===== runtime/standard/12-catalog-resilience-r12.js ===== */
/* SRHELL v6.6 — Standard R12 catalog resilience.
   Keeps the R11 transport intact and only adds short retries around category/content
   reads so a transient Xtream failure cannot silently remove Filmes from the app. */

const SRH_R12_RETRY_ACTION=/^(?:get_(?:live|vod|series)_categories|get_(?:live|vod)_streams|get_series)$/;
const srhR12Sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const srhR12RequestBase=request;
request=async function(params={},cfg=CONFIG){
  const action=String(params?.action||''),attempts=SRH_R12_RETRY_ACTION.test(action)?3:1;
  let last;
  for(let i=0;i<attempts;i++){
    try{return await srhR12RequestBase(params,cfg)}
    catch(e){last=e;if(i+1<attempts)await srhR12Sleep(180+180*i)}
  }
  throw last;
};

const srhR12CategoryMapBase=categoryMap;
categoryMap=async function(type,force=false,cfg=CONFIG){
  let map=await srhR12CategoryMapBase(type,force,cfg);
  if(map.size||!TYPE[type])return map;
  const expected=cfg===CONFIG?targetsFor(type).length:(cfg.targets||[]).filter(t=>t.type===type).length;
  if(!expected)return map;
  await srhR12Sleep(260);
  if(cfg===CONFIG)state.categoryMaps.delete(type);
  map=await srhR12CategoryMapBase(type,true,cfg);
  return map;
};

async function srhR12LoadUpdateCategories(){
  state.updateCategories=[];state.updateSelected.clear();el.updateApply.disabled=true;el.updateGroups.innerHTML='';
  try{
    const candidate={...CONFIG,...parseLogin(el.updateM3u.value)};state.updateCandidate=candidate;
    el.updateStatus.textContent='Validando login e lendo categorias…';el.updateLoad.disabled=true;
    const account=await request({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');
    if(!active)throw new Error('O novo login não retornou uma conta ativa.');
    const groups=[];
    for(const [type,meta] of Object.entries(TYPE)){
      let raw=await request({action:meta.categories},candidate);
      if(Array.isArray(raw)&&raw.length===0){await srhR12Sleep(220);raw=await request({action:meta.categories},candidate)}
      groups.push(normalizeUpdateCategories(raw,type));
    }
    state.updateCategories=groups.flat();
    const old=new Set((CONFIG.targets||[]).map(t=>t.type+'::'+t.name));
    state.updateCategories.forEach(c=>{const k=c.type+'::'+c.name;if(old.has(k))state.updateSelected.add(k)});
    renderUpdateGroups();el.updateStatus.textContent=state.updateCategories.length+' categorias disponíveis.';
  }catch(e){el.updateStatus.textContent=e.message}
  finally{el.updateLoad.disabled=false}
}
el.updateLoad.onclick=srhR12LoadUpdateCategories;

/* ===== runtime/standard/13-transport-r15.js ===== */
/* SRHELL v6.6 — R15 unified transport repair.
   Fixes API/detail fetches and media playback without inventing arbitrary
   Xtream extensions. Redirect query strings/tokens are preserved. */

const SRH_TRANSPORT_R15='aura-transport-r15';

function srhR15Push(out,value){const v=String(value||'').trim();if(/^https?:\/\//i.test(v)&&!out.includes(v))out.push(v)}
function srhR15Twin(url,scheme){try{const u=new URL(String(url||''));u.protocol=scheme+':';return u.href}catch{return''}}
function srhR15ReplaceExt(url,ext){try{const u=new URL(String(url||'')),m=u.pathname.match(/^(.*?)(?:\.([a-z0-9]{1,8}))$/i);if(!m)return'';u.pathname=m[1]+'.'+ext;return u.href}catch{return''}}
function srhR15Kind(url){try{const p=new URL(String(url||'')).pathname;if(/\/live\//i.test(p))return'live';if(/\/movie\//i.test(p))return'vod';if(/\/series\//i.test(p))return'series'}catch{}return''}
function srhR15Ext(url){try{const m=new URL(String(url||'')).pathname.match(/\.([a-z0-9]{1,8})$/i);return m?m[1].toLowerCase():''}catch{return''}}

/* Exact source first. Only protocol-supported Xtream fallbacks are added. */
function srhR15SourceVariants(url){
  const out=[],raw=String(url||'').trim();srhR15Push(out,raw);if(!raw)return out;
  const kind=srhR15Kind(raw),ext=srhR15Ext(raw);
  if(kind==='live'){
    if(ext==='ts')srhR15Push(out,srhR15ReplaceExt(raw,'m3u8'));
    else if(ext==='m3u8')srhR15Push(out,srhR15ReplaceExt(raw,'ts'));
  }else if((kind==='vod'||kind==='series')&&ext&&ext!=='m3u8'){
    srhR15Push(out,srhR15ReplaceExt(raw,'m3u8'));
  }
  return out;
}

mediaCandidates=function(value){
  const input=Array.isArray(value)?value:[value],out=[],securePage=location.protocol==='https:';
  for(const raw of input){
    for(const v of srhR15SourceVariants(raw)){
      if(securePage&&/^http:\/\//i.test(v)){srhR15Push(out,srhR15Twin(v,'https'));srhR15Push(out,v)}
      else{srhR15Push(out,v);if(/^http:\/\//i.test(v))srhR15Push(out,srhR15Twin(v,'https'))}
    }
  }
  return out;
};

async function srhR15FetchJson(url,timeoutMs=14000){
  const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeoutMs):0;
  try{
    const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:c?.signal,headers:{Accept:'application/json,text/plain,*/*'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const text=await r.text();
    try{return JSON.parse(text)}catch{throw new Error('resposta não é JSON ('+String(r.url||url)+')')}
  }finally{if(t)clearTimeout(t)}
}

/* One request implementation for account/categories/details/episodes. */
request=async function(params={},cfg=CONFIG){
  const target=apiUrl(params,cfg),urls=[];
  srhR15Push(urls,target);
  if(/^http:\/\//i.test(target))srhR15Push(urls,srhR15Twin(target,'https'));
  if(typeof srhProxyUrls==='function')for(const p of srhProxyUrls(target,cfg))srhR15Push(urls,p);
  /* Some proxies can reach HTTPS origin even when the browser cannot. */
  const secure=srhR15Twin(target,'https');
  if(secure&&secure!==target&&typeof srhProxyUrls==='function')for(const p of srhProxyUrls(secure,cfg))srhR15Push(urls,p);
  let last=null;
  for(const u of urls){try{return await srhR15FetchJson(u)}catch(e){last=e}}
  const suffix=String(cfg?.corsProxy||'').trim()?' · direto e Proxy CORS falharam.':' · conexão direta falhou; nenhum Proxy CORS ativo.';
  throw new Error(String(last?.message||'Falha no fetch.')+suffix);
};

async function srhR15ResolveFinal(url,timeoutMs=3000){
  const candidates=[String(url||'')];
  if(typeof srhProxyUrls==='function')candidates.push(...srhProxyUrls(url,CONFIG));
  for(const candidate of candidates){
    if(!candidate)continue;
    const c=typeof AbortController==='function'?new AbortController():null,t=c?setTimeout(()=>c.abort(),timeoutMs):0;
    try{
      const r=await fetch(candidate,{method:'GET',redirect:'follow',cache:'no-store',credentials:'omit',signal:c?.signal,headers:{Range:'bytes=0-1'}});
      if(t)clearTimeout(t);
      /* Only trust final URLs that are actual media origins, not proxy wrapper URLs. */
      if(candidate===url&&r.url&&r.url!==url&&/^https?:\/\//i.test(r.url))return r.url;
    }catch{if(t)clearTimeout(t)}
  }
  return'';
}

function srhR15TransportEntries(value){
  const direct=mediaCandidates(value),out=direct.map(url=>({url,proxyAll:false}));
  if(typeof srhProxyBase==='function'&&srhProxyBase(CONFIG))for(const url of direct)out.push({url,proxyAll:true});
  return out;
}

attachVideo=function(video,url,onReady,onError){
  const queue=srhR15TransportEntries(url),seen=new Set();let index=0,last=null,finished=false;
  const next=()=>{
    if(finished)return;
    if(index>=queue.length){finished=true;onError?.(last||{message:'Nenhuma rota de mídia funcionou.'});return}
    const entry=queue[index++],current=entry.url,key=(entry.proxyAll?'P:':'D:')+current;
    if(seen.has(key)){next();return}seen.add(key);
    let settled=false,startTimer=0;
    destroyHls();try{video.pause()}catch{}video.onerror=null;video.onloadedmetadata=null;video.oncanplay=null;video.removeAttribute('src');try{video.load()}catch{}
    const clear=()=>{if(startTimer){clearTimeout(startTimer);startTimer=0}};
    const ready=()=>{if(settled||finished)return;settled=true;clear();finished=true;onReady?.(current);const p=video.play();p?.catch?.(()=>{})};
    const fail=async extra=>{
      if(settled||finished)return;settled=true;clear();last=mediaErrorInfo(video,extra);
      if(!entry.proxyAll){
        const finalUrl=await srhR15ResolveFinal(current,2600);
        if(finalUrl&&finalUrl!==current){
          const additions=srhR15TransportEntries(finalUrl).filter(x=>!seen.has((x.proxyAll?'P:':'D:')+x.url)&&!queue.some(q=>q.url===x.url&&q.proxyAll===x.proxyAll));
          if(additions.length)queue.splice(index,0,...additions);
        }
      }
      next();
    };
    startTimer=setTimeout(()=>fail({type:'timeout',details:'tempo limite ao iniciar a mídia'}),11000);
    const isHls=/\.m3u8(?:$|[?#])/i.test(current);
    if(isHls&&window.Hls&&Hls.isSupported()){
      try{
        state.hls=new Hls(typeof srhHlsOptions==='function'?srhHlsOptions(entry.proxyAll):{});
        state.hls.loadSource(current);state.hls.attachMedia(video);
        state.hls.on(Hls.Events.MANIFEST_PARSED,ready);
        state.hls.on(Hls.Events.ERROR,(_,d)=>{if(d?.fatal)fail(d)});
      }catch(e){fail(e)}
    }else{
      const actual=entry.proxyAll&&typeof srhBuildProxyUrl==='function'?(srhBuildProxyUrl(current,CONFIG)||current):current;
      video.src=actual;video.onloadedmetadata=ready;video.oncanplay=ready;video.onerror=()=>fail();
      try{video.load()}catch{}
      const p=video.play();p?.catch?.(()=>{});
    }
  };
  next();
};

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

init();
})();
