/* Shorts R24 — R25 browser/network stability guard.
   Caps Xtream JSON bodies and aborts outstanding fetches when the tab/page exits. */
const SRH_R24_STABILITY='shorts-r24-browser-stability-r25';
const SRH_R24_MAX_BYTES=32*1024*1024;
const srhR24PendingControllers=new Set();

async function srhR24ReadBounded(response,controller){
  const type=String(response.headers?.get?.('content-type')||'').toLowerCase();
  if(/^(?:video|audio|image)\//.test(type)||type.includes('application/octet-stream')){
    try{controller?.abort?.()}catch{}
    throw new Error('A API retornou mídia/binário no lugar de JSON.');
  }
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(Number.isFinite(declared)&&declared>SRH_R24_MAX_BYTES){
    try{controller?.abort?.()}catch{}
    throw new Error('A resposta Xtream excedeu o limite seguro do navegador.');
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
        if(total>SRH_R24_MAX_BYTES){
          try{controller?.abort?.()}catch{}
          try{await reader.cancel()}catch{}
          throw new Error('A resposta Xtream ficou grande demais e foi interrompida.');
        }
        if(chunk)text+=decoder.decode(chunk,{stream:true});
      }
      text+=decoder.decode();
      return text;
    }finally{try{reader.releaseLock?.()}catch{}}
  }
  return response.text();
}
function srhR24AbortPending(){for(const c of [...srhR24PendingControllers]){try{c.abort()}catch{}}srhR24PendingControllers.clear()}

srhR24FetchJson=async function(url,timeoutMs){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):0;
  if(controller)srhR24PendingControllers.add(controller);
  try{
    const response=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal,headers:{Accept:'application/json,text/plain;q=0.9,*/*;q=0.1'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return srhR24ParseJson(await srhR24ReadBounded(response,controller));
  }finally{
    if(timer)clearTimeout(timer);
    if(controller)srhR24PendingControllers.delete(controller);
  }
};
window.addEventListener('pagehide',srhR24AbortPending,{capture:true});
window.addEventListener('beforeunload',srhR24AbortPending,{capture:true});
try{window.SRHELL_SHORTS_STABILITY={version:SRH_R24_STABILITY,abortPending:srhR24AbortPending}}catch{}
