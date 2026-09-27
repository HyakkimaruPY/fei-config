(()=>{const d=document,B=window.__srhPublicBase||'https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/public/',c=d.currentScript,x=c?.dataset?.x||(d.getElementById('app-config')?'a':'g'),S=window.__srhRouterState={status:'starting'};let M;const P=(a,z,h)=>{const b=d.getElementById('srhBoot')||d.getElementById('srh25Boot'),l=b?.querySelector('#srhBootLabel,#bootLabel,#bootSub'),p=b?.querySelector('#srhBootPhase'),n=b?.querySelector('#srhBootPct'),f=b?.querySelector('#srhBootFill');if(l)l.textContent=a;if(p)p.textContent=z;if(n)n.textContent=h+'%';if(f)f.style.width=h+'%'};const F=(u,o={})=>new Promise((a,z)=>{const q=typeof AbortController==='function'?new AbortController:null,t=setTimeout(()=>{q?.abort();z(Error('Tempo esgotado'))},12000);fetch(u,{...o,...(q?{signal:q.signal}:{})}).then(e=>{clearTimeout(t);a(e)},e=>{clearTimeout(t);z(e?.name==='AbortError'?Error('Tempo esgotado'):e)})});const U=k=>new URL(M.r[k],B).href;const R=async(k,raw=false)=>{const u=U(k)+(U(k).includes('?')?'&':'?')+'v='+encodeURIComponent(M.q)+'&t='+Date.now(),r=await F(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.text()};const J=async()=>{const urls=['https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6/public/x/0a7.dat?t='+Date.now(),new URL('x/0a7.dat',B)+'?t='+Date.now()];let last;for(const u of urls){try{const r=await F(u,{cache:'no-store'});if(r.ok)return r.json();last=Error('HTTP '+r.status)}catch(e){last=e}}throw last||Error('Mapa indisponível')};const Y=t=>{const s=d.createElement('style');s.textContent=t;d.head.appendChild(s)};const X=t=>{const s=d.createElement('script');s.textContent=t;d.body.appendChild(s)};const H=()=>{d.title=M.t;const h=d.querySelector('.brand h1');if(h)h.innerHTML=M.n+' <span>- GERADOR DE APP</span>';const b=d.querySelector('.srh-boot-title');if(b)b.textContent=M.n};const C=()=>{const p=d.querySelector('#settingsPanel .settings-panel__inner')||d.querySelector('#settingsPanel');if(!p||d.getElementById('srhCreator'))return;const e=d.createElement('div');e.id='srhCreator';e.textContent=M.l+' · '+M.c;e.style.cssText='font:600 9px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase;opacity:.52;margin:0 0 9px;padding:0 1px;color:inherit';p.prepend(e)};const D=()=>{S.status='ready';const b=d.getElementById('srhBoot')||d.getElementById('srh25Boot');d.body.classList.remove('srh-booting');if(b){b.classList?.add('is-done');setTimeout(()=>b.remove(),220)}};const E=e=>{S.status='error';S.error=String(e?.message||e);const b=d.getElementById('srhBoot')||d.getElementById('srh25Boot'),n=b?.querySelector('#srhBootLabel,#bootLabel,#bootSub'),p=b?.querySelector('#srhBootPhase'),v=b?.querySelector('#srhBootPct'),f=b?.querySelector('#srhBootFill'),r=b?.querySelector('#srhBootRetry');if(n)n.textContent='Falha ao carregar: '+S.error;if(p)p.textContent='Carregamento interrompido';if(v)v.textContent='—';if(f){f.style.width='100%';f.style.background='#b85c67'}if(b?.querySelector('.srh-boot-card'))b.querySelector('.srh-boot-card').classList.add('is-error');if(r){r.style.display='block';r.onclick=()=>location.reload()}};(async()=>{try{P('Carregando mapa…','Conectando',24);M=await J();if(!M||M.s!==1||!M.k)throw Error('Serviço indisponível');P('Mapa carregado','Preparando módulos',36);if(x==='g'){window.__srhA=Object.freeze({k:M.k,m:'g',u:U,t:R});H();P('Baixando interface…','Módulos do gerador',54);const [a,j]=await Promise.all([R('gc'),R('gj')]);P('Montando gerador…','Renderizando',84);Y(a);X(j);D();return}const cfg=JSON.parse(d.getElementById('app-config')?.textContent||'{}'),m=cfg.appMode==='shorts'?'h':'s';window.__srhA=Object.freeze({k:M.k,m,u:U,t:R});C();const ck=m==='h'?'hc':'sc',jk=m==='h'?'hj':'sj',th=M.r[cfg.theme]?cfg.theme:'graphene';P('Baixando aplicativo…','Módulos',54);const [a,t,j]=await Promise.all([R(ck),R(th),R(jk)]);P('Montando aplicativo…','Renderizando',84);Y(a+'\n'+t);X(j);if(m==='h'){window.addEventListener('srh25:ready',()=>{C();D()},{once:true});setTimeout(()=>{C();D()},9000)}else{C();D()}}catch(e){E(e)}})()})();
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
