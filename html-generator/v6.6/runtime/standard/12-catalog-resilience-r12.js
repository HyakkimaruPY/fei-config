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
