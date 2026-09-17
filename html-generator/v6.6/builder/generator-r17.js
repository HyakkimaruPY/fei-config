/* SRHELL v6.6 — R17 builder shim.
   Adds the remotely refreshed API-only proxy pool to both Standard and Shorts. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r14.js?v=builder-r17-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src
    .replace("const BUILD='aura-generator-r14';","const BUILD='aura-generator-r17';")
    .replace(/shorts-aura-r14/g,'shorts-aura-r17')
    .replace(/aura625-r14/g,'aura625-r17')
    .replace(/App Shorts Aura R14/g,'App Shorts Aura R17')
    .replace(/App padrão R14/g,'App padrão R17');

  /* Shorts: keep Aura R14 controls/optimizations and append the shared API pool. */
  src=src.replace(
    "BASE+'/runtime/shorts/07-aura-player-polish-r14.js']",
    "BASE+'/runtime/shorts/07-aura-player-polish-r14.js',BASE+'/runtime/shared/01-proxy-pool-r17.js']"
  );

  /* Standard: preserve R15 media transport + R16 parser, then append API pool. */
  const needle="const mark=\"const allAssets=[...CSS_CORE,theme,...CSS_PATCHES,...JS_CORE,...JS_PATCHES];let loaded=0;\";";
  if(src.includes(needle)){
    const inject=
      "if(!t.includes('13-transport-r15.js'))t=t.replace(\"BASE+'/runtime/standard/12-catalog-resilience-r12.js'];\",\"BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js'];\");"+
      "if(!t.includes('14-api-parser-r16.js'))t=t.replace(\"BASE+'/runtime/standard/13-transport-r15.js'];\",\"BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js'];\");"+
      "if(!t.includes('01-proxy-pool-r17.js'))t=t.replace(\"BASE+'/runtime/standard/14-api-parser-r16.js'];\",\"BASE+'/runtime/standard/14-api-parser-r16.js',BASE+'/runtime/shared/01-proxy-pool-r17.js'];\");"+
      needle;
    src=src.replace(needle,inject);
  }

  (0,eval)(src+'\n//# sourceURL=generator-r17-runtime.js');
})().catch(e=>{
  const box=document.getElementById('statusBox');
  if(box){box.textContent='Falha ao iniciar R17: '+String(e?.message||e);box.className='status-strip err'}
  else console.error(e);
});
