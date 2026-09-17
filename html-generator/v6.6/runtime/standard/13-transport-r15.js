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
