(()=>{'use strict';const S=window.SRH25,$=S.$;
const BATCH=30,CACHE_MAX_AGE=6*60*60*1000;let shown=0,observer=null,imgObserver=null,activeLibrary=null,updateCandidate=null,updateCategories=[],updateSelected=new Set();
function cleanName(s){return String(s||'').replace(/[\uFE0F\u200D]/g,'').trim()}
function normName(s){return cleanName(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim()}
function mergeUnique(base,extra){const seen=new Set(),out=[];for(const item of [...(base||[]),...(extra||[])]){const id=S.id(item);if(!id||seen.has(id))continue;seen.add(id);out.push(item)}return out}
const cacheKey='catalog:'+(S.cfg.appId||S.cfg.appName||'app');
function openCache(){return new Promise((resolve,reject)=>{try{const q=indexedDB.open('srh-shorts-cache',1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('catalogs'))q.result.createObjectStore('catalogs')};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)}catch(e){reject(e)}})}
async function cacheRead(){try{const db=await openCache();return await new Promise(resolve=>{const tx=db.transaction('catalogs','readonly'),r=tx.objectStore('catalogs').get(cacheKey);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)})}catch{return null}}
async function cacheWrite(items){if(!items?.length)return;try{const db=await openCache();await new Promise(resolve=>{const tx=db.transaction('catalogs','readwrite');tx.objectStore('catalogs').put({time:Date.now(),items},cacheKey);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()})}catch{}}
S.clearCatalogCache=async()=>{try{const db=await openCache();await new Promise(resolve=>{const tx=db.transaction('catalogs','readwrite');tx.objectStore('catalogs').delete(cacheKey);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()})}catch{}};
async function resolveTargets(){
  const targets=(S.cfg.targets||[]).filter(t=>t.type==='vod');
  if(targets.every(t=>String(t.id??t.category_id??'').trim()))return targets.map(t=>({...t,_id:String(t.id??t.category_id)}));
  const cats=await S.request({action:'get_vod_categories'}),rows=Array.isArray(cats)?cats:[];
  const exact=new Map(rows.map(c=>[cleanName(c.category_name??c.name),String(c.category_id??c.id??'')]));
  const normalized=new Map(rows.map(c=>[normName(c.category_name??c.name),String(c.category_id??c.id??'')]));
  return targets.map(t=>({...t,_id:String(t.id??t.category_id??exact.get(cleanName(t.name))??normalized.get(normName(t.name))??'')}));
}
async function fetchItems(onGroup){
  const targets=await resolveTargets(),jobs=targets.filter(t=>t._id).map(async t=>{
    try{const r=await S.request({action:'get_vod_streams',category_id:t._id}),items=Array.isArray(r)?r:[];if(items.length)onGroup?.(items,t);return items}catch{return[]}
  });
  const groups=await Promise.all(jobs);return mergeUnique([],groups.flat())
}
function card(item){
  const b=document.createElement('button');b.type='button';b.className='srh25-card';b.dataset.id=S.id(item);
  const img=document.createElement('img');img.className='srh25-card__image';img.alt='';img.loading='lazy';img.decoding='async';
  const ph=document.createElement('div');ph.className='srh25-card__placeholder';b.append(img,ph);
  img.onload=()=>img.classList.add('is-ready');img.onerror=()=>{img.removeAttribute('src');img.classList.remove('is-ready')};
  const src=S.image(item);if(src){img.dataset.src=src;if(imgObserver)imgObserver.observe(img);else img.src=src}
  b.onclick=()=>S.openPlayer?.(item);return b
}
function ensureImageObserver(){
  if(imgObserver||!('IntersectionObserver'in window))return;
  imgObserver=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const img=e.target;if(img.dataset.src&&!img.src)img.src=img.dataset.src;imgObserver.unobserve(img)}},{rootMargin:'520px 0px'});
}
function appendBatch(){
  const grid=$('#shortGrid'),list=S.state.filtered,end=Math.min(list.length,shown+BATCH),frag=document.createDocumentFragment();
  for(let i=shown;i<end;i++)frag.appendChild(card(list[i]));grid.appendChild(frag);shown=end;
  $('#feedStatus').textContent=list.length?shown+' de '+list.length+' Shorts':'Nenhum Short encontrado'
}
function reset(){shown=0;$('#shortGrid').replaceChildren();ensureImageObserver();appendBatch()}
function renderItems(items){S.state.items=items;S.state.filtered=items.slice();reset();$('#appMeta').textContent=items.length+' Shorts · '+((S.cfg.targets||[]).filter(t=>t.type==='vod').length)+' categoria(s)'}
function filter(){const q=$('#shortSearch').value.trim().toLocaleLowerCase('pt-BR');S.state.filtered=q?S.state.items.filter(x=>S.title(x).toLocaleLowerCase('pt-BR').includes(q)):S.state.items.slice();reset()}
function libraryItems(kind){if(kind==='favorites')return S.state.items.filter(x=>S.state.favorites.has(S.id(x)));const byId=new Map(S.state.items.map(x=>[S.id(x),x]));return S.state.history.map(h=>byId.get(h.id)||h.item).filter(Boolean)}
function renderLibrary(kind){const grid=$('#libraryGrid'),title=$('#libraryTitle'),items=libraryItems(kind);title.textContent=kind==='favorites'?'Favoritos':'Continuar assistindo';grid.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='srh25-empty';e.textContent='Nada aqui por enquanto.';grid.appendChild(e)}else items.forEach(x=>grid.appendChild(card(x)))}
function openLibrary(kind){activeLibrary=kind;renderLibrary(kind);$('#libraryView').classList.remove('is-hidden')}
S.refreshLibraryView=()=>{const view=$('#libraryView');if(activeLibrary&&!view.classList.contains('is-hidden'))renderLibrary(activeLibrary)}
function ensureUpdateUi(){
  const panel=$('#settingsPanel');if(!panel||$('#shortUpdate'))return;
  const wrap=document.createElement('section');wrap.id='shortUpdate';wrap.className='srh25-update';
  wrap.innerHTML='<button class="srh25-update__toggle" id="shortUpdateToggle" type="button"><span>Atualizar app</span><span id="shortUpdateIcon">⌄</span></button><div class="srh25-update__body is-hidden" id="shortUpdateBody"><input class="srh25-update__input" id="shortUpdateM3u" placeholder="Cole o novo M3U / login Xtream"><div class="srh25-update__actions"><button class="srh25-update__button" id="shortUpdateLoad" type="button">Ler categorias</button><button class="srh25-update__button srh25-update__button--accent" id="shortUpdateApply" type="button" disabled>Atualizar</button></div><div class="srh25-update__status" id="shortUpdateStatus">A atualização do Shorts usa somente categorias de filmes.</div><div class="srh25-update__list" id="shortUpdateList"></div></div>';
  panel.appendChild(wrap)
}
function renderUpdateCategories(){
  const list=$('#shortUpdateList'),apply=$('#shortUpdateApply');if(!list||!apply)return;list.replaceChildren();
  if(!updateCategories.length){apply.disabled=true;return}
  const frag=document.createDocumentFragment();
  for(const c of updateCategories){
    const label=document.createElement('label');label.className='srh25-update__option';
    const input=document.createElement('input');input.type='checkbox';input.checked=updateSelected.has(c.id);
    const span=document.createElement('span');span.textContent=cleanName(c.name)||'Categoria';
    input.onchange=()=>{input.checked?updateSelected.add(c.id):updateSelected.delete(c.id);apply.disabled=!updateSelected.size};
    label.append(input,span);frag.appendChild(label)
  }
  list.appendChild(frag);apply.disabled=!updateSelected.size
}
async function loadUpdateCategories(){
  const input=$('#shortUpdateM3u'),load=$('#shortUpdateLoad'),status=$('#shortUpdateStatus'),list=$('#shortUpdateList'),apply=$('#shortUpdateApply');
  updateCandidate=null;updateCategories=[];updateSelected.clear();if(list)list.replaceChildren();if(apply)apply.disabled=true;
  try{
    const login=S.parseLogin(input?.value||''),candidate={...S.cfg,...login};
    if(status)status.textContent='Validando login e lendo categorias de filmes…';if(load)load.disabled=true;
    const account=await S.requestWithConfig({},candidate),active=account?.user_info&&(String(account.user_info.auth)==='1'||String(account.user_info.status||'').toLowerCase()==='active');
    if(!active)throw new Error('O novo login não retornou uma conta ativa.');
    const raw=await S.requestWithConfig({action:'get_vod_categories'},candidate);
    updateCategories=(Array.isArray(raw)?raw:[]).map((c,i)=>({type:'vod',id:String(c.category_id??c.id??i),name:String(c.category_name??c.name??('Categoria '+(i+1)))}));
    updateCandidate=candidate;
    const oldIds=new Set((S.cfg.targets||[]).filter(t=>t.type==='vod').map(t=>String(t.id??t.category_id??''))),oldNames=new Set((S.cfg.targets||[]).filter(t=>t.type==='vod').map(t=>normName(t.name)));
    for(const c of updateCategories)if(oldIds.has(c.id)||oldNames.has(normName(c.name)))updateSelected.add(c.id);
    renderUpdateCategories();if(status)status.textContent=updateCategories.length+' categorias de filmes disponíveis.'
  }catch(e){if(status)status.textContent=e?.message||String(e)}
  finally{if(load)load.disabled=false}
}
async function applyUpdate(){
  const status=$('#shortUpdateStatus');if(!updateCandidate||!updateSelected.size)return;
  const targets=updateCategories.filter(c=>updateSelected.has(c.id)).map(c=>({type:'vod',id:c.id,name:c.name}));
  const runtime={server:updateCandidate.server,username:updateCandidate.username,password:updateCandidate.password,liveExtension:updateCandidate.liveExtension,targets};
  if(!S.saveRuntime(runtime)){S.toast('O navegador bloqueou o armazenamento local.');return}
  if(status)status.textContent='Atualização salva. Recarregando…';
  await S.clearCatalogCache?.();S.toast('Lista atualizada. Recarregando…');setTimeout(()=>location.reload(),350)
}
S.bindShell=()=>{
  ensureImageObserver();ensureUpdateUi();
  $('#shortUpdateToggle').onclick=()=>{const body=$('#shortUpdateBody'),hidden=body.classList.toggle('is-hidden');$('#shortUpdateIcon').textContent=hidden?'⌄':'⌃'};
  $('#shortUpdateLoad').onclick=loadUpdateCategories;$('#shortUpdateApply').onclick=applyUpdate;
  $('#searchButton').onclick=()=>{$('#searchWrap').classList.toggle('is-hidden');if(!$('#searchWrap').classList.contains('is-hidden'))$('#shortSearch').focus()};$('#shortSearch').oninput=filter;
  $('#historyButton').onclick=()=>openLibrary('history');$('#favoritesButton').onclick=()=>openLibrary('favorites');$('#libraryClose').onclick=()=>{activeLibrary=null;$('#libraryView').classList.add('is-hidden')};
  $('#settingsButton').onclick=e=>{e.stopPropagation();$('#settingsPanel').classList.toggle('is-hidden')};document.addEventListener('click',e=>{const p=$('#settingsPanel');if(!p.classList.contains('is-hidden')&&!e.target.closest('#settingsPanel')&&!e.target.closest('#settingsButton'))p.classList.add('is-hidden')});
  observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)&&shown<S.state.filtered.length)appendBatch()},{rootMargin:'700px 0px'});observer.observe($('#feedSentinel'))
};
S.loadCatalog=async()=>{
  $('#feedStatus').textContent='Carregando catálogo…';
  const cached=await cacheRead(),fresh=cached?.items?.length&&Date.now()-Number(cached.time||0)<CACHE_MAX_AGE;
  let painted=!!cached?.items?.length,partial=[],firstResolve;const firstPaint=new Promise(r=>firstResolve=r);
  if(painted){renderItems(cached.items);$('#feedStatus').textContent='Atualizando catálogo…'}
  const refresh=(async()=>{
    try{
      const items=await fetchItems(group=>{
        partial=mergeUnique(partial,group);
        if(!painted&&partial.length){painted=true;renderItems(partial);firstResolve?.();firstResolve=null}
      });
      if(items.length){renderItems(items);await cacheWrite(items);return items}
      if(!painted)throw new Error('Nenhum conteúdo retornado')
      return cached?.items||[]
    }catch(e){
      if(!painted){$('#feedStatus').textContent='Falha ao carregar: '+(e?.message||e);S.toast('Não foi possível carregar o catálogo');firstResolve?.();firstResolve=null}
      else $('#feedStatus').textContent=(cached?.items?.length||0)+' Shorts';
      return cached?.items||[]
    }
  })();
  if(painted){void refresh;return cached.items}
  await Promise.race([firstPaint,refresh]);return S.state.items
};
})();