/* TMDB enrichment — TMDB-first detail render + art branding. */
(function installTmdbEnrichment(){
  const TMDB_CONFIG_URL='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/tmdb-config.json';
  const KEY_STORE='srhell:tmdb:key:v1';
  const KEY_META='srhell:tmdb:key-meta:v1';
  const CACHE_STORE='srhell:tmdb:cache:v3';
  const CONFIG_TTL=24*60*60*1000;
  const CACHE_TTL=7*24*60*60*1000;
  const MAX_CACHE=100;
  let tmdbConfig=null;
  let coverActive=0;
  const coverQueue=[];
  const coverQueued=new Set();
  const detailTmdb=new Map();

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
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
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
    const seen=new Set();
    function walk(src,depth=0){
      if(!src||typeof src!=='object'||depth>3||seen.has(src))return'';
      seen.add(src);
      for(const k of ['tmdb_id','tmdb','tmdbId']){
        const v=src[k];
        if(v===undefined||v===null)continue;
        const m=String(v).match(/\d{2,}/);
        if(m)return m[0];
      }
      for(const k of ['info','movie_data','series','metadata']){
        const v=src[k];
        const found=walk(v,depth+1);
        if(found)return found;
      }
      return'';
    }
    for(const src of sources){const found=walk(src);if(found)return found}
    return'';
  }

  function titleYear(raw){
    const m=String(raw||'').match(/[\[(\s](19\d{2}|20\d{2})(?=[\])\s]|$)/);
    return m?m[1]:'';
  }

  function cleanTitle(raw){
    let s=String(raw||'').trim();
    const cuts=[s.indexOf('['),s.indexOf('(')].filter(i=>i>=0);
    if(cuts.length)s=s.slice(0,Math.min(...cuts));
    return s
      .replace(/\b(?:4K|UHD|FHD|FULL\s*HD|1080P|720P|2160P|HDR|HEVC|H\.265|H265|DUBLADO|DUB|LEGENDADO|LEG|DUAL\s*AUDIO|LATINO|PT[- ]?BR)\b/gi,' ')
      .replace(/[._|]+/g,' ')
      .replace(/\s{2,}/g,' ')
      .replace(/[\s\-–—:;,_|]+$/g,'')
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
    return valid.find(x=>x.iso_639_1==='pt')||
           valid.find(x=>x.iso_639_1==='en')||
           valid.find(x=>!x.iso_639_1)||
           valid[0]||null;
  }

  async function detailsById(kind,id,language='pt-BR'){
    return tmdbFetch('/'+kind+'/'+id,{language,append_to_response:'images',include_image_language:'pt,en,null'});
  }

  function resultYear(kind,result){
    const raw=kind==='movie'?result?.release_date:result?.first_air_date;
    return /^\d{4}/.test(String(raw||''))?String(raw).slice(0,4):'';
  }

  async function resolveTmdb(kind,item,extra){
    const explicit=explicitTmdbId(item,extra);
    const rawTitle=String(
      item?.name||item?.title||
      extra?.name||extra?.title||
      extra?.movie_data?.name||extra?.info?.name||''
    ).trim();
    const clean=cleanTitle(rawTitle);
    const year=titleYear(rawTitle)||titleYear(extra?.name||extra?.title||'');
    const cacheKey=kind+':'+(explicit?'id:'+explicit:'q:'+clean.toLocaleLowerCase('pt-BR')+':'+year);
    const cached=cacheRead(cacheKey);
    if(cached)return cached;

    let id=explicit;
    if(!id&&clean){
      const params={query:clean,language:'pt-BR',include_adult:false};
      if(year)params[kind==='movie'?'year':'first_air_date_year']=year;
      const search=await tmdbFetch('/search/'+kind,params);
      const results=Array.isArray(search?.results)?search.results:[];
      const picked=year?results.find(r=>resultYear(kind,r)===year):results[0];
      if(year&&!picked)return null;
      id=picked?.id?String(picked.id):'';
    }
    if(!id)return null;

    const pt=await detailsById(kind,id,'pt-BR');
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

  async function seasonData(tvId,season){
    const key='season:'+tvId+':'+season;
    const cached=cacheRead(key);if(cached)return cached;
    const data=await tmdbFetch('/tv/'+tvId+'/season/'+season,{language:'pt-BR'});
    const out=Array.isArray(data?.episodes)?data:{episodes:[]};
    cacheWrite(key,out);
    return out;
  }

  function episodeCollections(data){
    const eps=data?.episodes;
    if(Array.isArray(eps))return{'1':eps};
    return eps&&typeof eps==='object'?eps:{};
  }

  async function tmdbFirstProviderResponse(action,params,data){
    if(!data||typeof data!=='object')return data;
    const kind=action==='get_vod_info'?'movie':action==='get_series_info'?'tv':'';
    if(!kind)return data;
    try{
      const info=data.info||{};
      const movie=data.movie_data||{};
      const probe=kind==='movie'
        ?{...movie,...info,name:movie.name||info.name||info.title||''}
        :{...info,name:info.name||info.title||data.name||''};
      const tmdb=await resolveTmdb(kind,probe,data);
      if(!tmdb)return data;
      data.__tmdb=tmdb;

      if(kind==='movie'){
        data.info={...info};
        data.movie_data={...movie};
        if(tmdb.backdrop)data.info.backdrop_path=[tmdb.backdrop];
        if(tmdb.overview){data.info.plot=tmdb.overview;data.info.description=tmdb.overview}
        if(tmdb.poster){data.info.movie_image=tmdb.poster;data.movie_data.stream_icon=tmdb.poster;data.movie_data.movie_image=tmdb.poster}
        const id=params?.vod_id??movie.stream_id??probe.stream_id;
        if(id!==undefined)detailTmdb.set('vod:'+String(id),tmdb);
      }else{
        data.info={...info};
        if(tmdb.backdrop){data.info.backdrop_path=[tmdb.backdrop];data.info.backdrop=tmdb.backdrop}
        if(tmdb.poster){data.info.cover_big=tmdb.poster;data.info.cover=tmdb.poster}
        if(tmdb.overview){data.info.plot=tmdb.overview;data.info.description=tmdb.overview}
        const id=params?.series_id??probe.series_id;
        if(id!==undefined)detailTmdb.set('series:'+String(id),tmdb);

        const collections=episodeCollections(data);
        const firstSeason=Object.keys(collections).sort((a,b)=>Number(a)-Number(b))[0];
        if(firstSeason){
          try{
            const season=await seasonData(tmdb.id,firstSeason);
            const byNo=new Map((season.episodes||[]).map((e,i)=>[String(e.episode_number??i+1),e]));
            const list=collections[firstSeason]||[];
            list.forEach((ep,idx)=>{
              const n=String(ep.episode_num??ep.episode_number??idx+1);
              const hit=byNo.get(n);
              if(!hit?.still_path)return;
              ep.info={...(ep.info||{}),movie_image:imageUrl(hit.still_path,'w500')};
            });
          }catch{}
        }
      }
    }catch(e){
      console.debug('TMDB provider enrichment fallback',e);
    }
    return data;
  }

  /* Critical order change: detail provider data is enriched before the base
     renderer receives it. Skeleton stays visible until this promise settles. */
  const providerRequest=request;
  request=async function(params={},cfg=CONFIG){
    const data=await providerRequest(params,cfg);
    if(cfg!==CONFIG)return data;
    const action=params?.action;
    if(action==='get_vod_info'||action==='get_series_info'){
      return tmdbFirstProviderResponse(action,params,data);
    }
    return data;
  };

  function luminance(rgb){
    if(!rgb)return.12;
    const f=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
    return .2126*f(rgb[0])+.7152*f(rgb[1])+.0722*f(rgb[2]);
  }

  async function tuneLogoContrast(img,box){
    box.classList.remove('srh-logo-flare-light','srh-logo-flare-dark');
    let dark=0,light=0,total=0;
    try{
      await img.decode?.();
      const cv=document.createElement('canvas');cv.width=64;cv.height=32;
      const cx=cv.getContext('2d',{willReadFrequently:true});
      cx.drawImage(img,0,0,64,32);
      const d=cx.getImageData(0,0,64,32).data;
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]<28)continue;
        const l=luminance([d[i],d[i+1],d[i+2]]);
        total++;
        if(l<.18)dark++;
        if(l>.82)light++;
      }
    }catch{}
    const darkShare=total?dark/total:0,lightShare=total?light/total:0;
    if(darkShare>.72)box.classList.add('srh-logo-flare-light');
    else if(lightShare<.12&&darkShare>.45)box.classList.add('srh-logo-flare-light');
    else if(lightShare>.9)box.classList.add('srh-logo-flare-dark');
  }

  function pseudoLogoText(title){
    const chars=Array.from(cleanTitle(title)||String(title||'').trim());
    return chars.length>10?chars.slice(0,10).join('')+'…':chars.join('');
  }

  function collapseFullTitle(){
    el.detailBody.querySelectorAll('.srh-full-title-reveal:not(.is-hidden)').forEach(x=>x.classList.add('is-hidden'));
  }

  function moveSeriesActions(){
    const modal=detailModal();
    if(!modal?.classList.contains('is-series'))return;
    const row=el.detailBody.querySelector('.detail-title-row');
    const actions=row?.querySelector('.srh-lite-actions');
    const seasonBox=el.detailBody.querySelector('.season-box');
    const menu=seasonBox?.querySelector('.season-menu');
    if(!seasonBox)return;

    let wrap=seasonBox.querySelector('.srh-series-season-actions');
    if(!wrap){wrap=document.createElement('div');wrap.className='srh-series-season-actions'}
    if(actions){
      const fav=actions.querySelector('.srh-lite-action--favorite');
      const trash=actions.querySelector('.srh-lite-action--trash');
      if(fav)wrap.appendChild(fav);
      if(trash)wrap.appendChild(trash);
      actions.remove();
    }
    if(wrap.children.length){
      seasonBox.classList.add('srh-season-actions');
      seasonBox.insertBefore(wrap,menu||null);
    }
  }

  function installBranding(type,item,data){
    if(!['vod','series'].includes(type))return;
    const modal=detailModal();
    const art=el.detailBody.querySelector('.detail-art');
    const row=el.detailBody.querySelector('.detail-title-row');
    if(!modal||!art)return;

    modal.classList.add('srh-branded-detail');
    art.querySelector('.srh-art-brand')?.remove();
    art.parentElement?.querySelector(':scope > .srh-full-title-reveal')?.remove();

    const title=data?.title||itemTitle(item);
    const box=document.createElement('div');
    box.className='srh-art-brand';

    if(data?.logo){
      const img=document.createElement('img');
      img.alt=title||'Logo';
      img.crossOrigin='anonymous';
      img.onload=()=>{
        const ratio=(img.naturalWidth||1)/(img.naturalHeight||1);
        box.classList.toggle('is-square',ratio>=.75&&ratio<=1.35);
        box.classList.toggle('is-compact',ratio>1.35&&ratio<2.15);
        tuneLogoContrast(img,box);
      };
      img.onerror=()=>{
        box.replaceChildren();
        const b=document.createElement('button');
        b.type='button';b.className='srh-art-brand__fallback';b.textContent=pseudoLogoText(title);
        box.appendChild(b);
        bindFallback(b,title,art);
      };
      img.src=data.logo;
      box.appendChild(img);
    }else{
      const b=document.createElement('button');
      b.type='button';
      b.className='srh-art-brand__fallback';
      b.textContent=pseudoLogoText(title);
      box.appendChild(b);
      bindFallback(b,title,art);
    }
    art.appendChild(box);

    if(type==='series')moveSeriesActions();
    row?.querySelector('.detail-title')?.setAttribute('aria-hidden','true');

    const video=art.querySelector('video');
    if(video){
      const active=()=>art.classList.add('srh-media-active');
      video.addEventListener('playing',active,{passive:true});
      video.addEventListener('loadeddata',()=>{if(!video.classList.contains('is-hidden'))active()},{passive:true});
    }
  }

  function bindFallback(button,title,art){
    let reveal=art.parentElement?.querySelector(':scope > .srh-full-title-reveal');
    if(!reveal){
      reveal=document.createElement('div');
      reveal.className='srh-full-title-reveal is-hidden';
      reveal.textContent=title;
      art.insertAdjacentElement('afterend',reveal);
    }
    button.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const willShow=reveal.classList.contains('is-hidden');
      collapseFullTitle();
      reveal.classList.toggle('is-hidden',!willShow);
    };
  }

  detailModal()?.addEventListener('click',e=>{
    if(e.target.closest?.('.srh-art-brand__fallback,.srh-full-title-reveal'))return;
    collapseFullTitle();
  },true);

  async function enrichVisibleSeason(tvId,season){
    if(!tvId||season===undefined||season===null)return;
    try{
      const data=await seasonData(tvId,season);
      const byNo=new Map((data.episodes||[]).map((ep,i)=>[String(ep.episode_number??i+1),ep]));
      [...el.detailBody.querySelectorAll('.episode')].forEach((row,idx)=>{
        const title=row.querySelector('.episode__title')?.textContent||'';
        const m=title.match(/(\d+)/);
        const hit=byNo.get(String(m?.[1]??idx+1));
        if(!hit?.still_path)return;
        const img=row.querySelector('.episode__thumb');
        if(!img)return;
        img.src=imageUrl(hit.still_path,'w500');
        img.classList.add('srh-tmdb-still');
      });
    }catch{}
  }

  const tmdbOpenFilm=openFilm;
  openFilm=async function(item){
    await tmdbOpenFilm(item);
    const key='vod:'+String(item?.stream_id??item?.id??'');
    const data=detailTmdb.get(key)||await resolveTmdb('movie',item,null).catch(()=>null);
    installBranding('vod',item,data);
  };

  const tmdbOpenSeries=openSeries;
  openSeries=async function(item){
    await tmdbOpenSeries(item);
    const key='series:'+String(item?.series_id??item?.id??'');
    const data=detailTmdb.get(key)||await resolveTmdb('tv',item,state.currentSeries?.data||null).catch(()=>null);
    if(data?.id)state.srhTmdbSeriesId=data.id;
    installBranding('series',item,data);
    const label=el.detailBody.querySelector('#seasonLabel')?.textContent||'';
    const season=(label.match(/(\d+)/)||[])[1];
    if(data?.id&&season)enrichVisibleSeason(data.id,season);
  };

  el.detailBody.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-season]');
    if(!b||!state.srhTmdbSeriesId)return;
    setTimeout(()=>enrichVisibleSeason(state.srhTmdbSeriesId,b.dataset.season),35);
  });

  /* Catalog poster fallback: provider first only when it actually works.
     Missing/broken covers are resolved from TMDB with two concurrent lookups. */
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
          if(job.img.isConnected){
            job.img.src=data.poster;
            job.img.classList.add('srh-tmdb-cover');
          }
        }
      }).catch(()=>{}).finally(()=>{
        coverActive--;coverQueued.delete(job.key);pumpCoverQueue();
      });
    }
  }

  function hookCover(v,container){
    if(!v||!['vod','series'].includes(v.type))return;
    container.querySelectorAll('[data-index]').forEach(card=>{
      const idx=Number(card.dataset.index),item=v.items[idx],img=card.querySelector('img');
      if(!item||!img)return;
      const failed=img.complete&&img.naturalWidth===0;
      queueCover(item,v.type,img,failed);
      if(img.dataset.tmdbErrorHook!=='1'){
        img.dataset.tmdbErrorHook='1';
        img.addEventListener('error',()=>queueCover(item,v.type,img,true),{once:true});
      }
    });
  }

  const tmdbRailRender=RailVirtualizer.prototype.render;
  RailVirtualizer.prototype.render=function(force=false){
    const out=tmdbRailRender.call(this,force);
    hookCover(this,this.track);
    return out;
  };

  const tmdbGridRender=GridVirtualizer.prototype.render;
  GridVirtualizer.prototype.render=function(force=false){
    const out=tmdbGridRender.call(this,force);
    hookCover(this,this.spacer);
    return out;
  };

  getTmdbConfig().catch(()=>{});
})();
