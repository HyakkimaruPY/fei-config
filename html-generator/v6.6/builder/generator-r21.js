/* SRHELL v6.6 — R21 builder.
   Shorts uses rebuilt Aura-style feed/player architecture.
   Standard keeps R15/R16 transport/parser. Both use direct-first proxy affinity. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r20.js?v=builder-r21-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src
    .replace(/aura-generator-r20/g,'aura-generator-r21')
    .replace(/shorts-aura-r20/g,'shorts-aura-r21')
    .replace(/aura625-r20/g,'aura625-r21')
    .replace(/App Shorts Aura R20/g,'App Shorts Aura R21')
    .replace(/App padrão R20/g,'App padrão R21')
    .replace(/srhell:generator:r20:/g,'srhell:generator:r21:')
    .replace(/07-performance-r20\.css/g,'08-architecture-r21.css')
    .replace(/08-performance-r20\.js/g,'09-architecture-r21.js')
    .replace(/01-proxy-pool-r20\.js/g,'02-proxy-affinity-r21.js')
    .replace(/Falha ao iniciar R20/g,'Falha ao iniciar R21');
  (0,eval)(src+'\n//# sourceURL=generator-r21-runtime.js');
})().catch(e=>{const box=document.getElementById('statusBox');if(box){box.textContent='Falha ao iniciar R21: '+String(e?.message||e);box.className='status-strip err'}else console.error(e)});