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
