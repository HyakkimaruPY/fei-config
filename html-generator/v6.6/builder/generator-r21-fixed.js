/* SRHELL v6.6 — R21 fixed builder.
   Fixes the inherited R20 source injection that could emit an unexpected `if`.
   The R21 Shorts architecture remains unchanged. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r20.js?v=builder-r21-fixed-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();

  /* R20 dynamically injected three `if(!t.includes(...))` statements into the
     text of generator-r14. Remove that metaprogramming block entirely. R21 uses
     one deterministic replacement for the Standard runtime list instead. */
  const badStart=src.indexOf('  const needle="const mark=');
  const badEnd=badStart>=0?src.indexOf('\n  (0,eval)',badStart):-1;
  if(badStart>=0&&badEnd>badStart){
    const safeStandard=`  src=src.replace(
    "BASE+'/runtime/standard/12-catalog-resilience-r12.js'];",
    "BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js',BASE+'/runtime/shared/02-proxy-affinity-r21.js'];"
  );\n`;
    src=src.slice(0,badStart)+safeStandard+src.slice(badEnd);
  }

  src=src
    .replace(/aura-generator-r20/g,'aura-generator-r21-fixed')
    .replace(/shorts-aura-r20/g,'shorts-aura-r21-fixed')
    .replace(/aura625-r20/g,'aura625-r21-fixed')
    .replace(/App Shorts Aura R20/g,'App Shorts Aura R21')
    .replace(/App padrão R20/g,'App padrão R21')
    .replace(/srhell:generator:r20:/g,'srhell:generator:r21:')
    .replace(/07-performance-r20\.css/g,'08-architecture-r21.css')
    .replace(/08-performance-r20\.js/g,'09-architecture-r21.js')
    .replace(/01-proxy-pool-r20\.js/g,'02-proxy-affinity-r21.js')
    .replace(/Falha ao iniciar R20/g,'Falha ao iniciar R21');

  /* Validate the transformed builder before executing it. This catches syntax
     errors here instead of leaving the user with a half-mounted generator. */
  try{new Function(src)}catch(e){throw new Error('Builder R21 inválido: '+String(e?.message||e))}
  (0,eval)(src+'\n//# sourceURL=generator-r21-fixed-runtime.js');
})().catch(e=>{
  const box=document.getElementById('statusBox');
  if(box){box.textContent='Falha ao iniciar R21: '+String(e?.message||e);box.className='status-strip err'}
  else console.error(e);
});