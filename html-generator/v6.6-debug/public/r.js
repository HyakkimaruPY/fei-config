(()=>{if(window.__srhRouterState?.status)return;const d=document,B=window.__srhPublicBase||"https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6-debug/public/",c=d.currentScript,x=c?.dataset?.x||(d.getElementById('app-config')?'a':'g'),S=window.__srhRouterState={status:'starting'};let M;const P=(a,z,h)=>{const b=d.getElementById('srhBoot')||d.getElementById('srh25Boot'),l=b?.querySelector('#srhBootLabel,#bootLabel,#bootSub'),p=b?.querySelector('#srhBootPhase'),n=b?.querySelector('#srhBootPct'),f=b?.querySelector('#srhBootFill');if(l)l.textContent=a;if(p)p.textContent=z;if(n)n.textContent=h+'%';if(f)f.style.width=h+'%'};const F=(u,o={})=>new Promise((a,z)=>{const q=typeof AbortController==='function'?new AbortController:null,t=setTimeout(()=>{q?.abort();z(Error('Tempo esgotado'))},12000);fetch(u,{...o,...(q?{signal:q.signal}:{})}).then(e=>{clearTimeout(t);a(e)},e=>{clearTimeout(t);z(e?.name==='AbortError'?Error('Tempo esgotado'):e)})});const DBGBASE="https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6-debug/public/",DBGBASES=[DBGBASE,B,"https://cdn.jsdelivr.net/gh/HyakkimaruPY/fei-config@main/html-generator/v6.6-debug/public/","https://fastly.jsdelivr.net/gh/HyakkimaruPY/fei-config@main/html-generator/v6.6-debug/public/"].filter((v,i,a)=>v&&a.indexOf(v)===i),SBASE="https://raw.githubusercontent.com/HyakkimaruPY/fei-config/9f9d16c9e4ef4f826ff82bc8cf6cb053f07ebfc5/html-generator/v6.6/public/",LOCAL=new Set(['dc','dj','st','ht','hj','sj','ac','graphene','obsidian','porcelain','jade','aurora','ember','graphene-contrast-dark','graphene-contrast-light','graphene-soft-light','graphene-protan','graphene-deutan','graphene-tritan','graphene-mono']),THEMES=new Set(["graphene","obsidian","porcelain","jade","aurora","ember","graphene-contrast-dark","graphene-contrast-light","graphene-soft-light","graphene-protan","graphene-deutan","graphene-tritan","graphene-mono"]);const U=(k,b)=>new URL(M.r[k],LOCAL.has(k)?(b||DBGBASE):SBASE).href;const R=async(k,raw=false)=>{const key='srh:debug:asset:v3:'+M.q+':'+k,last='srh:debug:asset:last:'+k,local=LOCAL.has(k),bases=local?DBGBASES:[SBASE];let lastErr=null;for(const base of bases){const root=U(k,base),u=root+(root.includes('?')?'&':'?')+'v='+encodeURIComponent(M.q)+'&t='+Date.now();try{const r=await F(u,{cache:local?'no-store':'force-cache'});if(!r.ok)throw Error('HTTP '+r.status);const text=await r.text();try{if(text.length<650000){localStorage.setItem(key,JSON.stringify({q:M.q,at:Date.now(),text,base}));localStorage.setItem(last,key)}}catch{}return text}catch(e){lastErr=e}}try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.text&&saved.q===M.q){S.rollback={key,from:saved.q,reason:String(lastErr?.message||lastErr||'network')};return saved.text}}catch{}throw lastErr||Error('Asset indisponível')};const J=async()=>{const key='srh:debug:delivery-map:v3';let lastErr=null;for(const base of DBGBASES){try{const r=await F(new URL('x/0a7.dat',base)+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const map=await r.json();if(!map?.k||!map?.r||map.s!==1)throw Error('Mapa inválido');const persist=()=>{try{const compact={s:map.s,k:map.k,q:map.q,t:map.t,n:map.n,c:map.c,l:map.l,r:map.r};localStorage.setItem(key,JSON.stringify(compact))}catch{}};if(typeof requestIdleCallback==='function')requestIdleCallback(persist,{timeout:2200});else setTimeout(persist,0);return map}catch(e){lastErr=e}}try{const map=JSON.parse(localStorage.getItem(key)||'null');if(map?.k&&map?.r){S.rollback={key,from:map.q||'unknown',reason:String(lastErr?.message||lastErr||'network')};return map}}catch{}throw lastErr||Error('Mapa indisponível')};let BT=0,BP=84;const W=()=>new Promise(r=>{const q=window.requestAnimationFrame||((f)=>setTimeout(f,16));q(()=>q(r))});const G=(label='Inicializando…')=>{clearInterval(BT);BP=84;P(label,'Inicializando bibliotecas',84);BT=setInterval(()=>{if(BP>=97)return;BP+=BP<92?1:.5;P(label,BP<93?'Inicializando bibliotecas':'Sincronizando catálogo',Math.floor(BP))},320)};const Z=()=>{clearInterval(BT);P('Pronto','Concluído',100)};const Y=t=>{const s=d.createElement('style');s.textContent=t;d.head.appendChild(s)};const X=t=>{const s=d.createElement('script');s.textContent=t;d.body.appendChild(s)};const K=t=>{const g=String(t||'').match(/z\.k!==["']([^"']+)["']/);if(g&&g[1]!==M.k)throw Error('Contrato de runtime incompatível: mapa '+M.k+' / módulo '+g[1])};const H=()=>{d.title=M.t;const h=d.querySelector('.brand h1');if(h)h.innerHTML=M.n+' <span>- GERADOR DE APP</span>';const b=d.querySelector('.srh-boot-title');if(b)b.textContent=M.n};const C=()=>{const p=d.querySelector('#settingsPanel .settings-panel__inner')||d.querySelector('#settingsPanel');if(!p||d.getElementById('srhCreator'))return;const e=d.createElement('div');e.id='srhCreator';e.textContent=M.l+' · '+M.c;e.style.cssText='font:600 9px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase;opacity:.52;margin:0 0 9px;padding:0 1px;color:inherit';p.prepend(e)};const D=()=>{S.status='ready';const b=d.getElementById('srhBoot')||d.getElementById('srh25Boot');d.body.classList.remove('srh-booting');if(b){b.classList?.add('is-done');setTimeout(()=>b.remove(),220)}};const E=e=>{S.status='error';S.error=String(e?.message||e);const b=d.getElementById('srhBoot')||d.getElementById('srh25Boot'),n=b?.querySelector('#srhBootLabel,#bootLabel,#bootSub'),p=b?.querySelector('#srhBootPhase'),v=b?.querySelector('#srhBootPct'),f=b?.querySelector('#srhBootFill'),r=b?.querySelector('#srhBootRetry');if(n)n.textContent='Falha ao carregar: '+S.error;if(p)p.textContent='Carregamento interrompido';if(v)v.textContent='—';if(f){f.style.width='100%';f.style.background='#b85c67'}if(b?.querySelector('.srh-boot-card'))b.querySelector('.srh-boot-card').classList.add('is-error');if(r){r.style.display='block';r.onclick=()=>location.reload()}};(async()=>{try{P('Carregando mapa…','Conectando',24);M=await J();if(!M||M.s!==1||!M.k)throw Error('Serviço indisponível');P('Mapa carregado','Preparando módulos',36);if(x==='g'){window.__srhA=Object.freeze({k:M.k,m:'g',u:U,t:R});H();P('Baixando interface…','Módulos do gerador',54);const [a,j,dc,dj]=await Promise.all([R('gc'),R('gj'),R('dc'),R('dj')]);P('Montando gerador…','Renderizando',84);G('Finalizando gerador…');await W();window.__SRH_DEBUG_BUILD__={revision:M.q,deliveryRouter:'debug-router-v3',baseCommit:"9f9d16c9e4ef4f826ff82bc8cf6cb053f07ebfc5",baseRevision:"d-shorts-history-repair-trash-via-r42-20260922",mode:'generator',schemas:{storage:3,history:3,cache:2}};Y(a+'\n'+dc);X(dj);window.SRHDebug?.boot.phase('generator-runtime');K(j);X(j);setTimeout(()=>window.SRHDebug?.attachButton?.(),0);Z();D();window.SRHDebug?.boot.commit({routerRollback:S.rollback||null});return}const cfg=JSON.parse(d.getElementById('app-config')?.textContent||'{}'),m=cfg.appMode==='shorts'?'h':'s';try{const ns=String(cfg.appId||cfg.appName||'app').replace(/[^a-z0-9_-]/gi,'_'),saved=JSON.parse(localStorage.getItem('srhell:'+ns+':visual-theme:v1')||'null'),id=String(saved?.theme||'');if(THEMES.has(id)&&M.r[id]){cfg.theme=id;const node=d.getElementById('app-config');if(node)node.textContent=JSON.stringify(cfg)}}catch{}window.__srhA=Object.freeze({k:M.k,m,u:U,t:R});C();const ck=m==='h'?'hc':'sc',jk=m==='h'?'hj':'sj',th=THEMES.has(cfg.theme)&&M.r[cfg.theme]?cfg.theme:'graphene';if(cfg.theme!==th){cfg.theme=th;const node=d.getElementById('app-config');if(node)node.textContent=JSON.stringify(cfg)}d.body.dataset.theme=th;P('Baixando aplicativo…','Módulos',54);const [a,t,j,dc,dj,ac]=await Promise.all([R(ck),R(th),R(jk),R('dc'),R('dj'),R('ac')]);P('Montando aplicativo…','Renderizando',84);G(m==='h'?'Preparando catálogo…':'Inicializando aplicativo…');await W();window.__SRH_DEBUG_BUILD__={revision:M.q,deliveryRouter:'debug-router-v4-a11y',baseCommit:"9f9d16c9e4ef4f826ff82bc8cf6cb053f07ebfc5",baseRevision:"d-shorts-history-repair-trash-via-r42-20260922",mode:m==='h'?'shorts':'standard',schemas:{storage:3,history:3,cache:2},standardPlayback:m==='h'?null:'standard-playback-v1'};Y(a+'\n'+t+'\n'+dc);X(dj);window.SRHDebug?.boot.phase('app-runtime',{mode:m});K(j);X(j);X(ac);setTimeout(()=>{window.SRHDebug?.bridge?.();window.SRHDebug?.attachButton?.()},0);if(m==='h'){window.addEventListener('srh25:ready',()=>{Z();C();D();window.SRHDebug?.boot.commit({routerRollback:S.rollback||null})},{once:true});setTimeout(()=>{Z();C();D();if(window.SRHDebug?.state.get('boot.status')==='starting')window.SRHDebug?.boot.commit({degraded:true,routerRollback:S.rollback||null})},9000)}else{Z();C();D();window.SRHDebug?.boot.commit({routerRollback:S.rollback||null})}}catch(e){E(e)}})()})();
(()=>{
  if(window.__srhKineticScroll)return;
  window.__srhKineticScroll=true;
  const d=document,reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gesture=null,flight=null,frame=0,blockedClickUntil=0;
  const now=()=>performance.now();
  const root=()=>d.scrollingElement||d.documentElement;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;flight=null;gesture=null};
  const extent=(node,axis)=>Math.max(0,axis==='x'?node.scrollWidth-node.clientWidth:node.scrollHeight-node.clientHeight);
  const position=(node,axis)=>axis==='x'?node.scrollLeft:node.scrollTop;
  const alive=node=>node.isConnected&&node.getClientRects().length>0&&(node!==root()||![getComputedStyle(d.documentElement).overflowY,getComputedStyle(d.body).overflowY].some(v=>v==='hidden'||v==='clip'));
  const find=(target,axis)=>{
    for(let node=target;node&&node!==d;node=node.parentElement){
      if(node===d.body||node===d.documentElement)break;
      const css=getComputedStyle(node),overflow=axis==='x'?css.overflowX:css.overflowY;
      if(/auto|scroll/.test(overflow)&&extent(node,axis)>1)return node;
      if(axis==='y'&&/fixed/.test(css.position))return null;
    }
    return axis==='y'&&alive(root())&&extent(root(),axis)>1?root():null;
  };
  const write=(state,value)=>{
    state.pos=Math.max(0,Math.min(extent(state.node,state.axis),value));
    if(state.axis==='x')state.node.scrollLeft=state.pos;else state.node.scrollTop=state.pos;
    state.actual=position(state.node,state.axis);
  };
  const tick=time=>{
    const state=flight;if(!state)return;
    if(reduced?.matches||d.hidden||!alive(state.node)||Math.abs(position(state.node,state.axis)-state.actual)>2){stop();return}
    const elapsed=time-state.time;
    if(elapsed>100){stop();return}
    const dt=Math.max(0,elapsed),decay=Math.exp(-dt/260);
    write(state,state.pos+state.speed*260*(1-decay));
    state.speed*=decay;state.time=time;
    if(Math.abs(state.speed)<.025||state.pos<=0||state.pos>=extent(state.node,state.axis)){stop();return}
    frame=requestAnimationFrame(tick);
  };
  d.addEventListener('touchstart',event=>{
    const interrupted=!!flight;stop();
    blockedClickUntil=interrupted?now()+400:0;
    const mode=window.__srhA?.m,target=event.target;
    if(!['h','s'].includes(mode)||reduced?.matches||event.touches.length!==1||!target?.closest)return;
    if(target.closest('input,textarea,select,[contenteditable="true"],video,audio,#playerStage,.srh25-player,.srh25-mini-resume,.srh25-arcs__handle,.srh25-arcs__head,.player-layer,.detail-art,.live-preview'))return;
    const touch=event.touches[0];
    gesture={target,mode,id:touch.identifier,x:touch.clientX,y:touch.clientY,time:now(),speed:0,axis:'',node:null};
  },{passive:true,capture:true});
  d.addEventListener('touchmove',event=>{
    const state=gesture;if(!state)return;
    if(event.touches.length!==1||!event.cancelable||event.defaultPrevented){stop();return}
    const touch=event.touches[0];if(touch.identifier!==state.id){stop();return}
    const dx=state.x-touch.clientX,dy=state.y-touch.clientY,time=now(),dt=Math.max(1,time-state.time);
    if(!state.axis){
      if(!dx&&!dy)return;
      state.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
      if(state.mode==='h'&&state.axis==='x'){stop();return}
      state.node=find(state.target,state.axis);
      if(!state.node){stop();return}
      state.pos=position(state.node,state.axis);state.actual=state.pos;
    }
    event.preventDefault();
    const delta=state.axis==='x'?dx:dy,sample=Math.max(-3,Math.min(3,delta/dt));
    state.speed=dt>80||sample*state.speed<0?sample:state.speed*.25+sample*.75;
    write(state,state.pos+delta);
    state.x=touch.clientX;state.y=touch.clientY;state.time=time;
    blockedClickUntil=time+400;
  },{passive:false});
  d.addEventListener('touchend',event=>{
    const state=gesture;gesture=null;
    if(!state?.node||event.touches.length||now()-state.time>80||Math.abs(state.speed)<.05)return;
    state.time=now();flight=state;frame=requestAnimationFrame(tick);
  },{passive:true});
  d.addEventListener('touchcancel',stop,{passive:true});
  d.addEventListener('click',event=>{if(event.detail&&now()<blockedClickUntil){event.preventDefault();event.stopImmediatePropagation()}},{capture:true});
  for(const name of ['wheel','keydown'])d.addEventListener(name,stop,{passive:true,capture:true});
  d.addEventListener('visibilitychange',stop,{passive:true});
  window.addEventListener('pagehide',stop,{passive:true});
  window.addEventListener('resize',stop,{passive:true});
})();
