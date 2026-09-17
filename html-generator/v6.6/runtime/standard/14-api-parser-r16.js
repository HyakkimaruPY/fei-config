/* SRHELL v6.6 — R16 Xtream API body reader.
   Some providers answer player_api.php with HTTP 200 but text/plain/BOM/warnings
   instead of a clean application/json body. In browsers the same URL can also be
   navigable while fetch() cannot expose the body because of CORS. */

const SRH_API_R16='xtream-api-r16';

function srhR16CleanText(value){
  let text=String(value??'').replace(/^\uFEFF+/,'').replace(/\u0000/g,'').trim();
  if(!text)return'';
  /* Remove common XSSI prefixes without touching JSON content. */
  text=text.replace(/^\)\]\}',?\s*/,'').trim();
  /* A few relays/providers wrap the payload in PRE/HTML while still returning 200. */
  if(/^\s*</.test(text)&&typeof DOMParser==='function'){
    try{
      const doc=new DOMParser().parseFromString(text,'text/html');
      const body=String(doc?.body?.textContent||'').replace(/^\uFEFF+/,'').trim();
      if(body)text=body;
    }catch{}
  }
  return text;
}

function srhR16ParseJsonBody(value){
  let text=srhR16CleanText(value);
  if(!text)throw Object.assign(new Error('A API respondeu sem conteúdo.'),{srhParse:true});

  const parse=v=>{
    const out=JSON.parse(v);
    /* Handle JSON serialized as a JSON string by some simple proxies. */
    if(typeof out==='string'){
      const inner=srhR16CleanText(out);
      if(inner!==v&&/^[\[{]/.test(inner))return JSON.parse(inner);
    }
    return out;
  };

  try{return parse(text)}catch(first){
    /* PHP notices/warnings can be printed before otherwise valid JSON. */
    const obj=text.indexOf('{'),arr=text.indexOf('[');
    let start=-1;
    if(obj>=0&&arr>=0)start=Math.min(obj,arr);else start=Math.max(obj,arr);
    if(start>=0){
      const opener=text[start],closer=opener==='{'?'}':']',end=text.lastIndexOf(closer);
      if(end>start){
        const slice=text.slice(start,end+1).trim();
        try{return parse(slice)}catch{}
      }
    }

    /* Last compatibility pass for bodies HTML-entity encoded by a relay. */
    if(/&(?:quot|#34|#x22|amp|lt|gt);/i.test(text)&&typeof document!=='undefined'){
      try{
        const ta=document.createElement('textarea');ta.innerHTML=text;
        const decoded=ta.value.trim();
        if(decoded&&decoded!==text)return parse(decoded);
      }catch{}
    }
    const e=new Error('A API respondeu 200, mas o corpo não pôde ser interpretado como JSON.');
    e.srhParse=true;e.cause=first;throw e;
  }
}

async function srhR16FetchJson(url,timeoutMs=15000){
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):0;
  try{
    let response;
    try{
      response=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal,headers:{Accept:'application/json, text/plain;q=0.9, */*;q=0.1'}});
    }catch(err){
      if(err?.name==='AbortError')throw new Error('Tempo limite ao consultar a API Xtream.');
      const e=new Error('O navegador não conseguiu ler a resposta da API.');
      e.srhCors=err instanceof TypeError||/fetch|cors|network/i.test(String(err?.message||''));e.cause=err;throw e;
    }
    if(!response.ok)throw new Error('API Xtream respondeu HTTP '+response.status+'.');
    let text='';
    try{text=await response.text()}catch(err){
      const e=new Error('A API respondeu, mas o navegador bloqueou a leitura do corpo.');
      e.srhCors=true;e.cause=err;throw e;
    }
    return srhR16ParseJsonBody(text);
  }finally{if(timer)clearTimeout(timer)}
}

function srhR16RouteList(target,cfg=CONFIG){
  const routes=[];
  const add=(url,label)=>{url=String(url||'').trim();if(url&&!routes.some(x=>x.url===url))routes.push({url,label})};
  add(target,'direto');
  /* If a proxy is configured, use it immediately after the exact origin. */
  if(typeof srhProxyUrls==='function')for(const p of srhProxyUrls(target,cfg))add(p,'proxy');
  if(/^http:\/\//i.test(target)){
    const secure=typeof srhR15Twin==='function'?srhR15Twin(target,'https'):target.replace(/^http:/i,'https:');
    if(secure&&secure!==target){
      add(secure,'https');
      if(typeof srhProxyUrls==='function')for(const p of srhProxyUrls(secure,cfg))add(p,'proxy-https');
    }
  }
  return routes;
}

async function srhR16OpaqueProbe(url){
  try{
    const r=await fetch(url,{mode:'no-cors',cache:'no-store',redirect:'follow',credentials:'omit'});
    return r?.type==='opaque'||r?.ok===true;
  }catch{return false}
}

/* Override every Xtream JSON call: auth, category/content lists and detail calls. */
request=async function(params={},cfg=CONFIG){
  const target=apiUrl(params,cfg),routes=srhR16RouteList(target,cfg),errors=[];
  for(const route of routes){
    try{return await srhR16FetchJson(route.url)}
    catch(e){errors.push({route:route.label,error:e})}
  }

  const proxyActive=String(cfg?.corsProxy||'').trim();
  const corsLike=errors.some(x=>x.error?.srhCors);
  const parseLike=errors.some(x=>x.error?.srhParse);
  if(!proxyActive&&corsLike&&await srhR16OpaqueProbe(target)){
    throw new Error('A API respondeu, mas este navegador bloqueou o corpo por CORS. Configure um Proxy CORS para ler get_vod_info/get_series_info.');
  }
  if(parseLike)throw new Error('A API respondeu, porém o conteúdo recebido não pôde ser convertido em JSON mesmo após a limpeza de compatibilidade.');
  const last=errors.at(-1)?.error;
  throw new Error(String(last?.message||'Falha ao consultar a API Xtream.')+(proxyActive?' Proxy CORS também foi testado.':' Nenhum Proxy CORS está ativo.'));
};
