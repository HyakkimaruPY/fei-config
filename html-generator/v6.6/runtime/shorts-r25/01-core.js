(()=>{'use strict';
const BASE_CONFIG=JSON.parse(document.getElementById('app-config').textContent);
const $=s=>document.querySelector(s);
const clean=s=>String(s??'').trim();
const APP_NS=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const runtimeKey='srh25:'+APP_NS+':runtime:v1';
function readRuntime(){try{const x=JSON.parse(localStorage.getItem(runtimeKey)||'null');return x&&typeof x==='object'?x:null}catch{return null}}
const cfg={...BASE_CONFIG,...(readRuntime()||{})};
const S={cfg,baseConfig:BASE_CONFIG,runtimeKey,state:{items:[],filtered:[],history:[],favorites:new Set(),pool:null,poolPromise:null,proxy:null,proxyChoice:null,hls:null,current:null,requests:new Map()},$};
window.SRH25=S;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=(source=cfg)=>clean(source?.server).replace(/\/+$/,'');
const enc=encodeURIComponent;
S.id=item=>String(item?.stream_id??item?.id??item?.movie_id??item?.name??'');
S.title=item=>clean(item?.name||item?.title||'Sem título');
S.image=item=>clean(item?.stream_icon||item?.movie_image||item?.cover||'');
S.stream=item=>`${server()}/movie/${enc(cfg.username)}/${enc(cfg.password)}/${S.id(item)}.${clean(item?.container_extension)||'mp4'}`;
S.toast=msg=>{const n=$('#toast');if(!n)return;n.textContent=msg;n.classList.add('is-on');clearTimeout(S.toast.t);S.toast.t=setTimeout(()=>n.classList.remove('is-on'),1800)};
S.parseLogin=raw=>{let text=clean(raw);if(!text)throw new Error('Informe o novo M3U / login Xtream.');if(!/^https?:\/\//i.test(text))text='http://'+text;let u;try{u=new URL(text)}catch{throw new Error('URL inválida.')}let username=u.searchParams.get('username')||u.searchParams.get('user'),password=u.searchParams.get('password')||u.searchParams.get('pass');const parts=u.pathname.split('/').filter(Boolean);if((!username||!password)&&parts.length>=2&&!/\.php$/i.test(parts.at(-1)||'')){username=username||decodeURIComponent(parts[0]);password=password||decodeURIComponent(parts[1])}if(!username||!password)throw new Error('Não encontrei username e password.');return{server:u.origin.replace(/\/+$/,''),username,password,liveExtension:(u.searchParams.get('output')||cfg.liveExtension||'m3u8').toLowerCase()==='ts'?'ts':'m3u8'}};
S.saveRuntime=runtime=>{try{localStorage.setItem(runtimeKey,JSON.stringify(runtime));return true}catch{return false}};
function parseJson(t){let s=String(t??'').replace(/^\uFEFF/,'').trim();try{return JSON.parse(s)}catch{}const a=s.indexOf('{'),b=s.indexOf('['),i=a<0?b:b<0?a:Math.min(a,b);if(i>=0){const j=s.lastIndexOf(s[i]==='{'?'}':']');if(j>i)return JSON.parse(s.slice(i,j+1))}throw new Error('Resposta inválida')}
async function fetchText(url,timeout=5000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-cache',redirect:'follow',credentials:'omit',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(t)}}
function httpsTwin(url){try{const u=new URL(url);if(u.protocol!=='http:')return'';u.protocol='https:';return u.href}catch{return''}}
function proxyUrl(template,target){const b=clean(template),raw=clean(target),e=enc(raw);if(!b)return'';if(b.includes('{rawUrl}'))return b.replaceAll('{rawUrl}',raw);if(b.includes('{raw}'))return b.replaceAll('{raw}',raw);if(b.includes('{url}'))return b.replaceAll('{url}',e);if(b.endsWith('=')||b.endsWith('?'))return b+e;try{const u=new URL(b),k=['url','target','uri','q'].find(x=>u.searchParams.has(x))||'url';u.searchParams.set(k,raw);return u.toString()}catch{return''}}
function apiUrl(params={},source=cfg){const u=new URL(server(source)+'/player_api.php');u.searchParams.set('username',source.username);u.searchParams.set('password',source.password);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,v);return u.toString()}
async function loadPool(){
  if(S.state.pool)return S.state.pool;
  if(S.state.poolPromise)return S.state.poolPromise;
  S.state.poolPromise=(async()=>{const r=await fetch('https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/runtime/shared/proxy-pool.json',{cache:'default'});if(!r.ok)throw new Error('Pool '+r.status);const j=await r.json();return S.state.pool=(Array.isArray(j.proxies)?j.proxies:[]).filter(x=>x&&x.template&&x.valid!==false&&x.enabled!==false).sort((a,b)=>(+a.latencyMs||9e9)-(+b.latencyMs||9e9))})();
  try{return await S.state.poolPromise}finally{S.state.poolPromise=null}
}
function proxyKey(source=cfg){let h='host';try{h=new URL(server(source)).host}catch{}return 'srh25:proxy:'+(source.appId||BASE_CONFIG.appId||source.appName||BASE_CONFIG.appName||'app')+':'+h}
function readProxy(source=cfg){try{return JSON.parse(localStorage.getItem(proxyKey(source))||'null')}catch{return null}}
function saveProxy(x,source=cfg){try{localStorage.setItem(proxyKey(source),JSON.stringify(x))}catch{}}
function clearProxy(source=cfg){try{localStorage.removeItem(proxyKey(source))}catch{}}
async function chooseProxy(target,source=cfg){
  if(S.state.proxyChoice)return S.state.proxyChoice;
  const job=(async()=>{
    const pool=(await loadPool()).slice(0,4);
    const tests=await Promise.all(pool.map(async p=>{const u=proxyUrl(p.template,target),t=performance.now();try{parseJson(await fetchText(u,2600));return{p,ms:performance.now()-t}}catch{return null}}));
    const ok=tests.filter(Boolean).sort((a,b)=>a.ms-b.ms)[0];
    if(!ok)throw new Error('Nenhum proxy CORS respondeu');
    saveProxy({template:ok.p.template,id:ok.p.id||'',uses:1,at:Date.now()},source);return ok.p.template
  })();
  S.state.proxyChoice=job;
  job.then(()=>{S.state.proxyChoice=null},()=>{S.state.proxyChoice=null});
  return job
}
function requestFor(params={},source=cfg){
  const target=apiUrl(params,source),key=target;
  if(S.state.requests.has(key))return S.state.requests.get(key);
  const job=(async()=>{
    const candidates=[target,httpsTwin(target)].filter(Boolean);
    let last;
    if(candidates.length){
      try{return await Promise.any(candidates.map(async u=>parseJson(await fetchText(u,1900))))}catch(e){last=e}
    }
    if(source.corsProxy){
      try{return parseJson(await fetchText(proxyUrl(source.corsProxy,target),3600))}catch(e){last=e}
    }
    if(source.autoCorsProxy!==false){
      const saved=readProxy(source);
      if(saved?.template){
        try{
          saved.uses=Number(saved.uses||0)+1;saveProxy(saved,source);
          return parseJson(await fetchText(proxyUrl(saved.template,target),3600));
        }catch(e){last=e;clearProxy(source)}
      }
      try{
        const p=await chooseProxy(target,source);
        return parseJson(await fetchText(proxyUrl(p,target),4200));
      }catch(e){last=e}
    }
    throw last||new Error('Falha de conexão')
  })();
  S.state.requests.set(key,job);
  job.then(()=>S.state.requests.delete(key),()=>S.state.requests.delete(key));
  return job
}
S.request=params=>requestFor(params,cfg);
S.requestWithConfig=(params,source)=>requestFor(params,{...cfg,...source});
const ns=APP_NS;
const favKey='srh25:'+ns+':favorites',histKey='srh25:'+ns+':history';
S.readFavorites=()=>{try{return new Set(JSON.parse(localStorage.getItem(favKey)||'[]').map(String))}catch{return new Set()}};
S.writeFavorites=set=>{try{localStorage.setItem(favKey,JSON.stringify([...set]));return true}catch{return false}};
S.readHistory=()=>{try{const x=JSON.parse(localStorage.getItem(histKey)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
S.writeHistory=list=>{try{localStorage.setItem(histKey,JSON.stringify(list.slice(0,80)));return true}catch{return false}};
S.toggleFavorite=item=>{
  const id=S.id(item),current=S.state.favorites,next=new Set(current);
  if(next.has(id))next.delete(id);else next.add(id);
  if(!S.writeFavorites(next))return current.has(id);
  S.state.favorites=next;
  S.refreshLibraryView?.();
  return next.has(id)
};
S.historyFor=item=>S.state.history.find(x=>x.id===S.id(item))||null;
S.saveProgress=(item,position,duration)=>{
  if(!item||!Number.isFinite(position)||position<60)return false;
  const id=S.id(item),safeDuration=Number.isFinite(duration)&&duration>0?duration:0;
  const list=S.readHistory().filter(x=>x.id!==id);
  list.unshift({id,title:S.title(item),image:S.image(item),position,duration:safeDuration,updatedAt:Date.now(),item:{stream_id:item.stream_id,id:item.id,name:item.name,title:item.title,stream_icon:item.stream_icon,movie_image:item.movie_image,cover:item.cover,container_extension:item.container_extension}});
  if(!S.writeHistory(list))return false;
  S.state.history=S.readHistory();
  S.refreshLibraryView?.();
  return true
};
S.removeHistory=item=>{
  const next=S.readHistory().filter(x=>x.id!==S.id(item));
  if(!S.writeHistory(next))return false;
  S.state.history=S.readHistory();
  S.refreshLibraryView?.();
  return true
};
S.lockZoom=()=>{
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
  document.addEventListener('touchmove',e=>{if(e.touches?.length>1)e.preventDefault()},{passive:false});
  window.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['+','-','=','0'].includes(e.key))e.preventDefault()});
};
S.account=async()=>{try{const a=await S.request({}),raw=a?.user_info?.exp_date,n=Number(raw);if(n>0){const d=new Date(n*1000),days=Math.ceil((d-Date.now())/86400000);$('#expiryDate').textContent=d.toLocaleDateString('pt-BR');$('#expiryDays').textContent=days+' dias';$('#appMeta').textContent=(a?.user_info?.status||'Active')+' · '+days+' dias restantes'}else $('#appMeta').textContent=a?.user_info?.status||'Active'}catch{$('#appMeta').textContent='Conta conectada'}};
S.boot=async()=>{document.body.dataset.theme=cfg.theme||'graphene';$('#appTitle').textContent=cfg.appName||'Meu App';S.lockZoom();S.state.favorites=S.readFavorites();S.state.history=S.readHistory();S.bindShell?.();await S.loadCatalog?.();window.dispatchEvent(new Event('srh25:ready'));setTimeout(()=>S.account(),0)};
})();