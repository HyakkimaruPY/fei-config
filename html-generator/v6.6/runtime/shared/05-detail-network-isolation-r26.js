/* SRHELL v6.6 — R26 detail-network isolation.
   VOD cards already contain enough information to render/play a movie, so
   get_vod_info must never be allowed to hold the browser/network process open.
   Series metadata still needs the API; use a small, abortable XHR path and
   never the automatic third-party proxy pool for detail requests. */
const SRH_DETAIL_NETWORK_R26='detail-network-isolation-r26';
const srhR26DetailXhrs=new Set();

function srhR26DetailError(message){
  const e=new Error(message);e.srhDetailNetwork=true;return e;
}
function srhR26ParseJson(value){
  let text=String(value??'').replace(/^\uFEFF+/,'').replace(/\u0000/g,'').trim();
  if(!text)throw srhR26DetailError('A API retornou uma resposta vazia.');
  try{
    let data=JSON.parse(text);
    if(typeof data==='string'&&/^[\[{]/.test(data.trim()))data=JSON.parse(data);
    return data;
  }catch(first){
    const a=text.indexOf('{'),b=text.indexOf('['),start=a<0?b:b<0?a:Math.min(a,b);
    if(start>=0){
      const end=text.lastIndexOf(text[start]==='{'?'}':']');
      if(end>start)try{return JSON.parse(text.slice(start,end+1))}catch{}
    }
    const e=srhR26DetailError('A resposta de detalhes não é JSON válido.');e.cause=first;throw e;
  }
}
function srhR26XhrJson(url,timeout=4200,maxBytes=6*1024*1024){
  return new Promise((resolve,reject)=>{
    if(typeof XMLHttpRequest!=='function'){reject(srhR26DetailError('XHR indisponível neste navegador.'));return}
    const xhr=new XMLHttpRequest();
    let done=false;
    const finish=(ok,value)=>{
      if(done)return;done=true;srhR26DetailXhrs.delete(xhr);ok?resolve(value):reject(value);
    };
    try{
      xhr.open('GET',url,true);
      xhr.timeout=timeout;
      xhr.responseType='text';
      try{xhr.setRequestHeader('Accept','application/json,text/plain;q=0.9,*/*;q=0.1')}catch{}
      xhr.onprogress=e=>{
        if(Number(e?.loaded||0)>maxBytes){
          try{xhr.abort()}catch{}
          finish(false,srhR26DetailError('A resposta de detalhes ficou grande demais e foi interrompida.'));
        }
      };
      xhr.onload=()=>{
        const status=Number(xhr.status||0);
        if(status<200||status>=300){finish(false,srhR26DetailError('Detalhes HTTP '+status));return}
        const text=String(xhr.responseText||'');
        if(text.length>maxBytes){finish(false,srhR26DetailError('A resposta de detalhes excedeu o limite seguro.'));return}
        try{finish(true,srhR26ParseJson(text))}catch(e){finish(false,e)}
      };
      xhr.onerror=()=>finish(false,srhR26DetailError('O navegador bloqueou a consulta direta de detalhes.'));
      xhr.ontimeout=()=>finish(false,srhR26DetailError('A consulta de detalhes excedeu '+Math.round(timeout/1000)+' s.'));
      xhr.onabort=()=>finish(false,srhR26DetailError('Consulta de detalhes cancelada.'));
      srhR26DetailXhrs.add(xhr);
      xhr.send();
    }catch(e){finish(false,e instanceof Error?e:srhR26DetailError(String(e)))}
  });
}
function srhR26HttpsTwin(url){
  try{const u=new URL(String(url||''));if(u.protocol!=='http:')return'';u.protocol='https:';return u.toString()}catch{return''}
}
function srhR26ManualProxy(target,cfg){
  const manual=String(cfg?.corsProxy||'').trim();
  if(!manual)return'';
  if(typeof srhR23ProxyUrl==='function')return srhR23ProxyUrl(manual,target);
  const encoded=encodeURIComponent(target);
  if(manual.includes('{url}'))return manual.split('{url}').join(encoded);
  if(manual.includes('{rawUrl}'))return manual.split('{rawUrl}').join(target);
  return manual+encoded;
}
async function srhR26SeriesInfo(params,cfg){
  const target=apiUrl(params,cfg),urls=[target],https=srhR26HttpsTwin(target);
  if(https&&https!==target)urls.push(https);
  const manual=srhR26ManualProxy(target,cfg);
  if(manual&&!urls.includes(manual))urls.push(manual);
  let last=null;
  for(const url of urls){
    try{return await srhR26XhrJson(url,4200,6*1024*1024)}catch(e){last=e}
  }
  throw last||srhR26DetailError('Não foi possível carregar os episódios.');
}
function srhR26AbortDetailNetwork(){
  for(const xhr of [...srhR26DetailXhrs]){try{xhr.abort()}catch{}}
  srhR26DetailXhrs.clear();
}

const srhR26BaseRequest=request;
request=async function(params={},cfg=CONFIG){
  const action=String(params?.action||'').toLowerCase();
  if(action==='get_vod_info'){
    /* Critical fix: never issue a network request for VOD details.
       openFilm()/Shorts can derive image/title/URL from the catalog item. */
    return{info:{},movie_data:{stream_id:params?.vod_id}};
  }
  if(action==='get_series_info')return srhR26SeriesInfo(params,cfg);
  return srhR26BaseRequest(params,cfg);
};

try{
  const current=window.SRHELL_PROXY_POOL||{};
  const previousAbort=typeof current.abortDetails==='function'?current.abortDetails:null;
  window.SRHELL_PROXY_POOL={
    ...current,
    detailNetwork:SRH_DETAIL_NETWORK_R26,
    abortDetails:()=>{
      try{previousAbort?.()}catch{}
      srhR26AbortDetailNetwork();
    }
  };
  window.SRHELL_DETAIL_NETWORK={
    version:SRH_DETAIL_NETWORK_R26,
    pending:()=>srhR26DetailXhrs.size,
    abort:srhR26AbortDetailNetwork
  };
}catch{}
