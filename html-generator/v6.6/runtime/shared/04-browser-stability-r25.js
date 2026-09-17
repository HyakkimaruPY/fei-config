/* SRHELL v6.6 — R25 browser stability guard.
   Protects Android/WebView browsers from oversized/stalled API bodies and aborts
   pending requests when the page is unloaded. Loaded after the R23 API router. */
const SRH_BROWSER_STABILITY_R25='browser-stability-r25';
const SRH_R25_DETAIL_MAX_BYTES=12*1024*1024;
const SRH_R25_CATALOG_MAX_BYTES=32*1024*1024;
const srhR25PendingControllers=new Set();
const srhR25DetailControllers=new Set();

function srhR25DecodedUrl(url){
  let value=String(url||'');
  for(let i=0;i<2;i++){
    try{const next=decodeURIComponent(value);if(next===value)break;value=next}catch{break}
  }
  return value;
}
function srhR25Action(url){
  const m=srhR25DecodedUrl(url).match(/[?&]action=([^&#]+)/i);
  return m?String(m[1]||'').toLowerCase():'';
}
function srhR25IsDetail(url){
  const action=srhR25Action(url);
  return action==='get_vod_info'||action==='get_series_info';
}
function srhR25MaxBytes(url){
  const action=srhR25Action(url);
  return /^(?:get_live_streams|get_vod_streams|get_series)$/.test(action)?SRH_R25_CATALOG_MAX_BYTES:SRH_R25_DETAIL_MAX_BYTES;
}
function srhR25BodyError(message){
  const e=new Error(message);e.srhBodyGuard=true;return e;
}
async function srhR25ReadText(response,controller,maxBytes){
  const type=String(response.headers?.get?.('content-type')||'').toLowerCase();
  if(/^(?:video|audio|image)\//.test(type)||type.includes('application/octet-stream')){
    try{controller?.abort?.()}catch{}
    throw srhR25BodyError('A API retornou mídia/binário no lugar de JSON.');
  }
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(Number.isFinite(declared)&&declared>maxBytes){
    try{controller?.abort?.()}catch{}
    throw srhR25BodyError('A resposta da API excedeu o limite de segurança do navegador.');
  }
  if(response.body?.getReader&&typeof TextDecoder==='function'){
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let total=0,text='';
    try{
      for(;;){
        const part=await reader.read();
        if(part.done)break;
        const chunk=part.value;
        total+=chunk?.byteLength||0;
        if(total>maxBytes){
          try{controller?.abort?.()}catch{}
          try{await reader.cancel()}catch{}
          throw srhR25BodyError('A resposta da API ficou grande demais e foi interrompida.');
        }
        if(chunk)text+=decoder.decode(chunk,{stream:true});
      }
      text+=decoder.decode();
      return text;
    }finally{try{reader.releaseLock?.()}catch{}}
  }
  return response.text();
}
function srhR25AbortSet(set){
  for(const controller of [...set]){try{controller.abort()}catch{}}
  set.clear();
}
function srhR25AbortDetails(){srhR25AbortSet(srhR25DetailControllers)}
function srhR25AbortPending(){srhR25AbortSet(srhR25PendingControllers);srhR25DetailControllers.clear()}

srhR23FetchJson=async function(url,timeout=7000){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeout):0;
  const detail=srhR25IsDetail(url);
  if(controller){srhR25PendingControllers.add(controller);if(detail)srhR25DetailControllers.add(controller)}
  try{
    let response;
    try{
      response=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});
    }catch(err){
      const e=new Error(err?.name==='AbortError'?'Tempo limite ao consultar a API.':'O navegador não conseguiu ler a resposta da API.');
      e.srhCors=true;e.cause=err;throw e;
    }
    if(!response.ok)throw new Error('HTTP '+response.status);
    let text;
    try{text=await srhR25ReadText(response,controller,srhR25MaxBytes(url))}
    catch(err){if(err?.srhBodyGuard)throw err;const e=new Error('A resposta chegou, mas o navegador não conseguiu ler o corpo.');e.srhCors=true;e.cause=err;throw e}
    return srhR23Parse(text);
  }finally{
    if(timer)clearTimeout(timer);
    if(controller){srhR25PendingControllers.delete(controller);srhR25DetailControllers.delete(controller)}
  }
};

window.addEventListener('pagehide',srhR25AbortPending,{capture:true});
window.addEventListener('beforeunload',srhR25AbortPending,{capture:true});
try{
  const current=window.SRHELL_PROXY_POOL||{};
  window.SRHELL_PROXY_POOL={...current,stability:SRH_BROWSER_STABILITY_R25,abortDetails:srhR25AbortDetails,abortPending:srhR25AbortPending};
}catch{}
