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
