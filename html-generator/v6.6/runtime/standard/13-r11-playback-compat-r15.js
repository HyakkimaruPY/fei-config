/* SRHELL v6.6 — Standard R15 compatibility layer.
   Keeps the known-good R11 runtime as the playback base and only adds:
   1) scheme fallback for detail API calls even from file:// contexts;
   2) non-blocking VOD metadata so a get_vod_info failure never prevents play. */

const SRH_STANDARD_R15='r11-base-r15';
const srhR15RequestBase=request;

async function srhR15FetchJson(url,timeoutMs=12000){
  if(typeof srhFetchJsonUrl==='function')return srhFetchJsonUrl(url,timeoutMs);
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):0;
  try{
    const r=await fetch(url,{cache:'no-store',redirect:'follow',credentials:'omit',signal:controller?.signal,headers:{Accept:'application/json,text/plain,*/*'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const text=await r.text();
    try{return JSON.parse(text)}catch{throw new Error('resposta não é JSON')}
  }finally{if(timer)clearTimeout(timer)}
}

function srhR15PushUrl(out,url){const v=String(url||'').trim();if(v&&!out.includes(v))out.push(v)}

request=async function(params={},cfg=CONFIG){
  try{return await srhR15RequestBase(params,cfg)}
  catch(first){
    const action=String(params?.action||'');
    if(!/^(?:get_vod_info|get_series_info)$/.test(action))throw first;
    const target=apiUrl(params,cfg),alts=[];
    try{
      const u=new URL(target),original=u.protocol;
      u.protocol=original==='https:'?'http:':'https:';
      srhR15PushUrl(alts,u.href);
    }catch{}
    if(typeof srhProxyUrls==='function')for(const p of srhProxyUrls(target,cfg))srhR15PushUrl(alts,p);
    let last=first;
    for(const url of alts){
      try{return await srhR15FetchJson(url)}catch(e){last=e}
    }
    throw last;
  }
};

function srhR15VodEntry(item,data=null){
  const info=data?.info||{},movie=data?.movie_data||item,title=String(movie?.name||itemTitle(item));
  const art=(Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path)||info.movie_image||info.cover_big||info.cover||movie?.stream_icon||imageFor(item,'vod')||IMAGE_PLACEHOLDER;
  const plot=String(info.plot||info.description||info.overview||movie?.plot||item?.plot||'').trim();
  let sources=[];
  try{if(data)sources=vodSourcesFromInfo(data,item)}catch{}
  if(!sources.length)sources=mediaCandidates(streamUrl('vod',item));
  const url=sources[0]||streamUrl('vod',item);
  return{title,art,plot,sources,url,entry:{key:'vod:'+item.stream_id,type:'vod',title,image:art,url,sources,position:0,duration:0}}
}

function srhR15RenderFilm(item,model){
  if(!state.currentDetail||String(state.currentDetail?.itemId||'')!==String(item.stream_id))return;
  const {title,art,plot,entry}=model;
  state.currentDetail={type:'vod',entry,itemId:item.stream_id};
  el.detailHeadTitle.textContent=title;
  el.detailBody.innerHTML=`<div class="detail-content"><div class="detail-art"><img src="${escapeHtml(art||IMAGE_PLACEHOLDER)}" alt=""></div><div class="detail-title-row"><h2 class="detail-title">${escapeHtml(title)}</h2><button class="watch-button" id="watchFilm"><svg class="watch-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12z"/></svg><span>Assistir</span></button></div><div class="synopsis" id="filmSynopsis">${synopsisMarkup(plot||'Sinopse não informada pela API.',false)}</div></div>`;
  const syn=$('#filmSynopsis');
  setSynopsisState(syn,plot||'Sinopse não informada pela API.',false);
  syn.onclick=e=>{e.stopPropagation();setSynopsisState(syn,plot||'Sinopse não informada pela API.',!state.synopsisExpanded)};
  $('#watchFilm').onclick=()=>{
    const old=getHistory('vod').find(x=>x.key===entry.key),playEntry=old?{...entry,...old,sources:entry.sources}:entry;
    if(typeof srhFixInlinePlayer==='function')srhFixInlinePlayer(entry.sources||entry.url,title,playEntry);
    else openGeneralPlayer(entry.sources||entry.url,title,playEntry);
  };
}

openFilm=function(item){
  openDetail(itemTitle(item));
  state.currentDetail={type:'vod',itemId:item.stream_id};
  const fallback=srhR15VodEntry(item,null);
  srhR15RenderFilm(item,fallback);
  request({action:'get_vod_info',vod_id:item.stream_id}).then(data=>{
    if(String(state.currentDetail?.itemId||'')!==String(item.stream_id))return;
    srhR15RenderFilm(item,srhR15VodEntry(item,data));
  }).catch(()=>{});
};
