(()=>{'use strict';const S=window.SRH25,$=S.$;
const BATCH=30;let shown=0,observer=null,imgObserver=null;
function cleanName(s){return String(s||'').replace(/[\uFE0F\u200D]/g,'').trim()}
async function fetchItems(){
  const cats=await S.request({action:'get_vod_categories'}),map=new Map((Array.isArray(cats)?cats:[]).map(c=>[String(c.category_name??c.name??''),String(c.category_id??c.id??'')]));
  const targets=(S.cfg.targets||[]).filter(t=>t.type==='vod');
  const groups=await Promise.all(targets.map(async t=>{const id=map.get(String(t.name));if(!id)return[];try{const r=await S.request({action:'get_vod_streams',category_id:id});return Array.isArray(r)?r:[]}catch{return[]}}));
  const seen=new Set(),out=[];for(const item of groups.flat()){const id=S.id(item);if(!id||seen.has(id))continue;seen.add(id);out.push(item)}return out
}
function card(item){
  const b=document.createElement('button');b.type='button';b.className='srh25-card';b.dataset.id=S.id(item);
  const img=document.createElement('img');img.className='srh25-card__image';img.alt='';img.loading='lazy';img.decoding='async';
  const ph=document.createElement('div');ph.className='srh25-card__placeholder';
  b.append(img,ph);
  img.onload=()=>img.classList.add('is-ready');img.onerror=()=>{img.removeAttribute('src');img.classList.remove('is-ready')};
  const src=S.image(item);if(src){img.dataset.src=src;if(imgObserver)imgObserver.observe(img);else img.src=src}
  b.onclick=()=>S.openPlayer?.(item);return b
}
function ensureImageObserver(){
  if(imgObserver||!('IntersectionObserver'in window))return;
  imgObserver=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const img=e.target;if(img.dataset.src&&!img.src)img.src=img.dataset.src;imgObserver.unobserve(img)}},{rootMargin:'420px 0px'});
}
function appendBatch(){
  const grid=$('#shortGrid'),list=S.state.filtered,end=Math.min(list.length,shown+BATCH),frag=document.createDocumentFragment();
  for(let i=shown;i<end;i++)frag.appendChild(card(list[i]));grid.appendChild(frag);shown=end;
  $('#feedStatus').textContent=list.length?shown+' de '+list.length+' Shorts':'Nenhum Short encontrado';
}
function reset(){
  shown=0;$('#shortGrid').replaceChildren();ensureImageObserver();appendBatch();
}
function filter(){
  const q=$('#shortSearch').value.trim().toLocaleLowerCase('pt-BR');
  S.state.filtered=q?S.state.items.filter(x=>S.title(x).toLocaleLowerCase('pt-BR').includes(q)):S.state.items.slice();reset()
}
function libraryItems(kind){
  if(kind==='favorites')return S.state.items.filter(x=>S.state.favorites.has(S.id(x)));
  const byId=new Map(S.state.items.map(x=>[S.id(x),x]));
  return S.state.history.map(h=>byId.get(h.id)||h.item).filter(Boolean)
}
function openLibrary(kind){
  const view=$('#libraryView'),grid=$('#libraryGrid'),title=$('#libraryTitle'),items=libraryItems(kind);title.textContent=kind==='favorites'?'Favoritos':'Continuar assistindo';grid.replaceChildren();
  if(!items.length){const e=document.createElement('div');e.className='srh25-empty';e.textContent='Nada aqui por enquanto.';grid.appendChild(e)}else items.forEach(x=>grid.appendChild(card(x)));
  view.classList.remove('is-hidden')
}
S.bindShell=()=>{
  ensureImageObserver();
  $('#searchButton').onclick=()=>{$('#searchWrap').classList.toggle('is-hidden');if(!$('#searchWrap').classList.contains('is-hidden'))$('#shortSearch').focus()};
  $('#shortSearch').oninput=filter;
  $('#historyButton').onclick=()=>openLibrary('history');$('#favoritesButton').onclick=()=>openLibrary('favorites');$('#libraryClose').onclick=()=>$('#libraryView').classList.add('is-hidden');
  $('#settingsButton').onclick=e=>{e.stopPropagation();$('#settingsPanel').classList.toggle('is-hidden')};
  document.addEventListener('click',e=>{const p=$('#settingsPanel');if(!p.classList.contains('is-hidden')&&!e.target.closest('#settingsPanel')&&!e.target.closest('#settingsButton'))p.classList.add('is-hidden')});
  observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)&&shown<S.state.filtered.length)appendBatch()},{rootMargin:'700px 0px'});observer.observe($('#feedSentinel'))
};
S.loadCatalog=async()=>{
  $('#feedStatus').textContent='Carregando catálogo…';
  try{S.state.items=await fetchItems();S.state.filtered=S.state.items.slice();reset();$('#appMeta').textContent=(S.state.items.length||0)+' Shorts · '+((S.cfg.targets||[]).filter(t=>t.type==='vod').length)+' categoria(s)'}
  catch(e){$('#feedStatus').textContent='Falha ao carregar: '+e.message;S.toast('Não foi possível carregar o catálogo')}
};
})();