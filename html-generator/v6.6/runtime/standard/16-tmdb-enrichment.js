/* TMDB enrichment — remote runtime fallback for Standard mode only. */
(function installTmdbEnrichment(){
  const TMDB_CONFIG_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/tmdb-config.json';
  const KEY_STORE='srhell:tmdb:key:v1';
  const KEY_META='srhell:tmdb:key-meta:v1';
  const CACHE_STORE='srhell:tmdb:cache:v2';
  const CONFIG_TTL=24*60*60*1000;
  const CACHE_TTL=7*24*60*60*1000;
  const MAX_CACHE=90;
  let tmdbConfig=null;
  let coverActive=0;
  const coverQueue=[];
  const coverQueued=new Set();

  function readJson(k,f){try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
  async function getTmdbConfig(force=false){
    if(tmdbConfig&&!force)return tmdbConfig;
    const savedKey=localStorage.getItem(KEY_STORE)||'';
    const meta=readJson(KEY_META,{});
    if(!force&&savedKey&&Date.now()-Number(meta.savedAt||0)<CONFIG_TTL){
      tmdbConfig={apiKey:savedKey,apiBase:meta.apiBase||'https://api.themoviedb.org/3',imageBase:meta.imageBase||'https://image.tmdb.org/t/p'};
      return tmdbConfig;
    }
    const r=await fetch(TMDB_CONFIG_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('TMDB config HTTP '+r.status);
    const cfg=await r.json();
    if(!cfg?.apiKey)throw new Error('TMDB key ausente');
    localStorage.setItem(KEY_STORE,String(cfg.apiKey));
    writeJson(KEY_META,{savedAt:Date.now(),apiBase:cfg.apiBase,imageBase:cfg.imageBase,version:cfg.version||1});
    tmdbConfig={apiKey:String(cfg.apiKey),apiBase:cfg.apiBase||'https://api.themoviedb.org/3',imageBase:cfg.imageBase||'https://image.tmdb.org/t/p'};
    return tmdbConfig;
  }
  async function tmdbFetch(path,params={},retry=true){
    const cfg=await getTmdbConfig();
    const u=new URL(cfg.apiBase+path);
    u.searchParams.set('api_key',cfg.apiKey);
    Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
    try{
      const r=await fetch(u.toString(),{cache:'force-cache',signal:ctrl.signal});
      if(r.status===401&&retry){
        localStorage.removeItem(KEY_STORE);localStorage.removeItem(KEY_META);tmdbConfig=null;
        await getTmdbConfig(true);
        return tmdbFetch(path,params,false);
      }
      if(!r.ok)throw new Error('TMDB HTTP '+r.status);
      return await r.json();
    }finally{clearTimeout(timer)}
  }
  function imageUrl(path,size='w780'){
    if(!path)return'';
    const base=tmdbConfig?.imageBase||'https://image.tmdb.org/t/p';
    return base+'/'+size+path;
  }
  function explicitTmdbId(...sources){
    for(const src of sources){
      if(!src||typeof src!=='object')continue;
      for(const k of ['tmdb_id','tmdb','tmdbId']){
        const v=src[k];
        if(v===undefined||v===null)continue;
        const m=String(v).match(/\d{2,}/);
        if(m)return m[0];
      }
      if(src.info) {
        const nested=explicitTmdbId(src.info);
        if(nested)return nested;
      }
    }
    return'';
  }
  function titleYear(raw){
    const s=String(raw||'').trim();
    const ym=s.match(/(?:\(|\[|\b)(19\d{2}|20\d{2})(?:\)|\]|\b)/);
    return ym?ym[1]:'';
  }
  function cleanTitle(raw){
    return String(raw||'')
      .replace(/\[[^\]]*\]/g,' ')
      .replace(/\((?:19\d{2}|20\d{2})\)/g,' ')
      .replace(/\b(?:4K|UHD|FHD|FULL\s*HD|1080P|720P|2160P|HDR|HEVC|H\.265|H265|DUBLADO|DUB|LEGENDADO|LEG|DUAL\s*AUDIO|LATINO|PT[- ]?BR)\b/gi,' ')
      .replace(/[._|]+/g,' ')
      .replace(/\s{2,}/g,' ')
      .trim();
  }
  function cacheRead(key){
    const all=readJson(CACHE_STORE,{});
    const x=all[key];
    if(!x||Date.now()-Number(x.savedAt||0)>CACHE_TTL)return null;
    return x.data||null;
  }
  function cacheWrite(key,data){
    const all=readJson(CACHE_STORE,{});
    all[key]={savedAt:Date.now(),data};
    const entries=Object.entries(all).sort((a,b)=>Number(b[1].savedAt||0)-Number(a[1].savedAt||0)).slice(0,MAX_CACHE);
    writeJson(CACHE_STORE,Object.fromEntries(entries));
  }
  function chooseLogo(logos=[]){
    const valid=(Array.isArray(logos)?logos:[]).filter(x=>x?.file_path);
    return valid.find(x=>x.iso_639_1==='pt')||valid.find(x=>x.iso_639_1==='en')||valid.find(x=>!x.iso_639_1)||valid[0]||null;
  }
  async function detailsById(kind,id,language='pt-BR'){
    const data=await tmdbFetch('/'+kind+'/'+id,{language,append_to_response:'images',include_image_language:'pt,en,null'});
    return data;
  }
  async function resolveTmdb(kind,item,extra){
    const explicit=explicitTmdbId(item,extra);
    const rawTitle=itemTitle(item)||extra?.name||extra?.title||'';
    const clean=cleanTitle(rawTitle);
    const year=titleYear(rawTitle);
    const cacheKey=kind+':'+(explicit?'id:'+explicit:'q:'+clean.toLocaleLowerCase('pt-BR')+':'+year);
    const cached=cacheRead(cacheKey);
    if(cached)return cached;
    let id=explicit;
    if(!id&&clean){
      const params={query:clean,language:'pt-BR',include_adult:false};
      if(year)params[kind==='movie'?'year':'first_air_date_year']=year;
      const search=await tmdbFetch('/search/'+kind,params);
      id=search?.results?.[0]?.id?String(search.results[0].id):'';
    }
    if(!id)return null;
    let pt=await detailsById(kind,id,'pt-BR');
    let en=null;
    const ptLogo=chooseLogo(pt?.images?.logos);
    if(!pt?.overview||!ptLogo){
      try{en=await detailsById(kind,id,'en-US')}catch{}
    }
    const logo=ptLogo||chooseLogo(en?.images?.logos);
    const data={
      id:String(id),
      title:pt?.title||pt?.name||en?.title||en?.name||clean||rawTitle,
      overview:pt?.overview||en?.overview||'',
      backdrop:imageUrl(pt?.backdrop_path||en?.backdrop_path,'w1280'),
      poster:imageUrl(pt?.poster_path||en?.poster_path,'w500'),
      logo:imageUrl(logo?.file_path,'w500')
    };
    cacheWrite(cacheKey,data);
    return data;
  }
  function parseRgb(v){
    const m=String(v||'').match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/i);
    return m?[+m[1],+m[2],+m[3]]:null;
  }
  function luminance(rgb){
    if(!rgb)return.12;
    const f=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
    return .2126*f(rgb[0])+.7152*f(rgb[1])+.0722*f(rgb[2]);
  }
  async function tuneLogoContrast(img,box){
    box.classList.remove('srh-logo-flare-light','srh-logo-flare-dark');
    const modal=detailModal();
    const themeLum=luminance(parseRgb(getComputedStyle(modal||document.body).backgroundColor)||parseRgb(getComputedStyle(document.body).backgroundColor));
    let avg=.5,dark=0,light=0,total=0;
    try{
      await img.decode?.();
      const cv=document.createElement('canvas');cv.width=64;cv.height=32;
      const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,64,32);
      const d=cx.getImageData(0,0,64,32).data;
      let sum=0;
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]<28)continue;
        const l=luminance([d[i],d[i+1],d[i+2]]);
        sum+=l;total++;
        if(l<.18)dark++;
        if(l>.82)light++;
      }
      if(total)avg=sum/total;
    }catch{}
    const darkShare=total?dark/total:0,lightShare=total?light/total:0;
    if((darkShare>.88&&themeLum<.38)||(total&&Math.abs(avg-themeLum)<.14&&themeLum<.5))box.classList.add('srh-logo-flare-light');
    else if((lightShare>.88&&themeLum>.62)||(total&&Math.abs(avg-themeLum)<.14&&themeLum>=.5))box.classList.add('srh-logo-flare-dark');
  }
  function installLogo(data){
    if(!data?.logo)return;
    const row=el.detailBody.querySelector('.detail-title-row');
    if(!row)return;
    row.querySelector('.srh-tmdb-logo-box')?.remove();
    const box=document.createElement('div');box.className='srh-tmdb-logo-box';
    const img=document.createElement('img');img.alt=data.title||'Logo';img.crossOrigin='anonymous';
    img.onload=()=>{row.classList.add('has-tmdb-logo');tuneLogoContrast(img,box)};
    img.onerror=()=>box.remove();
    img.src=data.logo;box.appendChild(img);row.insertBefore(box,row.firstChild);
  }
  function synopsisNeedsFallback(node){
    const txt=String(state.synopsisText||node?.textContent||'').trim();
    return !txt||/sinopse\s+(?:n[aã]o\s+informada|indispon[ií]vel)|sem\s+sinopse/i.test(txt);
  }
  function applyDetailData(kind,item,data){
    if(!data)return;
    const art=el.detailBody.querySelector('.detail-art img');
    if(art&&data.backdrop){art.src=data.backdrop;art.classList.add('srh-tmdb-backdrop')}
    const syn=el.detailBody.querySelector('.synopsis');
    if(syn&&data.overview&&synopsisNeedsFallback(syn)){
      setSynopsisState(syn,data.overview,false);
      syn.onclick=e=>{e.stopPropagation();setSynopsisState(syn,data.overview,!state.synopsisExpanded)};
    }
    installLogo(data);
    if(kind==='movie'&&state.currentDetail?.entry){
      if(data.backdrop)state.currentDetail.entry.image=data.backdrop;
    }
    if(kind==='tv'&&state.currentSeries&&data.backdrop)state.currentSeries.backdrop=data.backdrop;
  }
  async function seasonData(tvId,season){
    const key='season:'+tvId+':'+season;
    const cached=cacheRead(key);if(cached)return cached;
    let data=await tmdbFetch('/tv/'+tvId+'/season/'+season,{language:'pt-BR'});
    if(!Array.isArray(data?.episodes))data={episodes:[]};
    cacheWrite(key,data);return data;
  }
  async function enrichVisibleSeason(tvId,season){
    if(!tvId||season===undefined||season===null)return;
    try{
      const data=await seasonData(tvId,season);
      const rows=[...el.detailBody.querySelectorAll('.episode')];
      rows.forEach((row,idx)=>{
        const ep=data.episodes?.[idx];
        if(!ep?.still_path)return;
        const img=row.querySelector('.episode__thumb');if(!img)return;
        img.src=imageUrl(ep.still_path,'w500');img.classList.add('srh-tmdb-still');
      });
    }catch{}
  }
  async function enrichMovie(item){
    try{
      const data=await resolveTmdb('movie',item,state.currentDetail?.entry);
      if(!data)return;
      applyDetailData('movie',item,data);
    }catch(e){console.debug('TMDB movie fallback',e)}
  }
  async function enrichSeries(item){
    try{
      const extra=state.currentSeries?.data?.info||state.currentSeries?.data||{};
      const data=await resolveTmdb('tv',item,extra);
      if(!data)return;
      state.srhTmdbSeriesId=data.id;
      applyDetailData('tv',item,data);
      const label=el.detailBody.querySelector('#seasonLabel')?.textContent||'';
      const season=(label.match(/(\d+)/)||[])[1];
      if(season)enrichVisibleSeason(data.id,season);
    }catch(e){console.debug('TMDB series fallback',e)}
  }

  const tmdbOpenFilm=openFilm;
  openFilm=async function(item){
    await tmdbOpenFilm(item);
    enrichMovie(item);
  };
  const tmdbOpenSeries=openSeries;
  openSeries=async function(item){
    await tmdbOpenSeries(item);
    enrichSeries(item);
  };
  el.detailBody.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-season]');
    if(!b||!state.srhTmdbSeriesId)return;
    const season=b.dataset.season;
    setTimeout(()=>enrichVisibleSeason(state.srhTmdbSeriesId,season),40);
  });

  const baseCardDataImage=cardDataImage;
  cardDataImage=function(item,type){return item?.__tmdbPoster||baseCardDataImage(item,type)};

  function queueCover(item,type,img,force=false){
    if(!item||!img||!['vod','series'].includes(type))return;
    if(!force&&baseCardDataImage(item,type))return;
    const key=type+':'+String(itemId(item,type)||itemTitle(item));
    if(item.__tmdbPoster||coverQueued.has(key))return;
    coverQueued.add(key);
    coverQueue.push({item,type,img,key});
    pumpCoverQueue();
  }
  function pumpCoverQueue(){
    while(coverActive<2&&coverQueue.length){
      const job=coverQueue.shift();coverActive++;
      resolveTmdb(job.type==='series'?'tv':'movie',job.item,null).then(data=>{
        if(data?.poster){
          job.item.__tmdbPoster=data.poster;
          if(job.img.isConnected){job.img.src=data.poster;job.img.classList.add('srh-tmdb-cover')}
        }
      }).catch(()=>{}).finally(()=>{
        coverActive--;coverQueued.delete(job.key);pumpCoverQueue();
      });
    }
  }
  function inspectRail(v){
    if(!v||!['vod','series'].includes(v.type))return;
    v.track.querySelectorAll('[data-index]').forEach(card=>{
      const idx=Number(card.dataset.index),item=v.items[idx],img=card.querySelector('img');
      if(item&&img){
        queueCover(item,v.type,img,img.classList.contains('image-fallback'));
        if(img.dataset.tmdbErrorHook!=='1'){
          img.dataset.tmdbErrorHook='1';
          img.addEventListener('error',()=>queueCover(item,v.type,img,true),{once:true});
        }
      }
    });
  }
  function inspectGrid(v){
    if(!v||!['vod','series'].includes(v.type))return;
    v.spacer.querySelectorAll('[data-index]').forEach(card=>{
      const idx=Number(card.dataset.index),item=v.items[idx],img=card.querySelector('img');
      if(item&&img){
        queueCover(item,v.type,img,img.classList.contains('image-fallback'));
        if(img.dataset.tmdbErrorHook!=='1'){
          img.dataset.tmdbErrorHook='1';
          img.addEventListener('error',()=>queueCover(item,v.type,img,true),{once:true});
        }
      }
    });
  }
  const tmdbRailRender=RailVirtualizer.prototype.render;
  RailVirtualizer.prototype.render=function(force=false){const out=tmdbRailRender.call(this,force);inspectRail(this);return out};
  const tmdbGridRender=GridVirtualizer.prototype.render;
  GridVirtualizer.prototype.render=function(force=false){const out=tmdbGridRender.call(this,force);inspectGrid(this);return out};

  getTmdbConfig().catch(()=>{});
})();
