/* SRHELL v6.6 — R18 builder shim.
   Uses the GitHub-validated CORS pool consumer; no proxy benchmarking runs in
   the generator or generated apps. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r14.js?v=builder-r18-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src
    .replace("const BUILD='aura-generator-r14';","const BUILD='aura-generator-r18';")
    .replace(/shorts-aura-r14/g,'shorts-aura-r18')
    .replace(/aura625-r14/g,'aura625-r18')
    .replace(/App Shorts Aura R14/g,'App Shorts Aura R18')
    .replace(/App padrão R14/g,'App padrão R18');

  /* Shorts: keep Aura player/virtualization fixes and consume only the pool
     already validated by GitHub Actions. */
  src=src.replace(
    "BASE+'/runtime/shorts/07-aura-player-polish-r14.js']",
    "BASE+'/runtime/shorts/07-aura-player-polish-r14.js',BASE+'/runtime/shared/01-proxy-pool-r18.js']"
  );

  /* Standard: preserve R15 media transport + R16 parser. Automatic CORS is an
     API-only fallback and never rewires live/VOD media bytes. */
  const needle="const mark=\"const allAssets=[...CSS_CORE,theme,...CSS_PATCHES,...JS_CORE,...JS_PATCHES];let loaded=0;\";";
  if(src.includes(needle)){
    const inject=
      "if(!t.includes('13-transport-r15.js'))t=t.replace(\"BASE+'/runtime/standard/12-catalog-resilience-r12.js'];\",\"BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js'];\");"+
      "if(!t.includes('14-api-parser-r16.js'))t=t.replace(\"BASE+'/runtime/standard/13-transport-r15.js'];\",\"BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js'];\");"+
      "if(!t.includes('01-proxy-pool-r18.js'))t=t.replace(\"BASE+'/runtime/standard/14-api-parser-r16.js'];\",\"BASE+'/runtime/standard/14-api-parser-r16.js',BASE+'/runtime/shared/01-proxy-pool-r18.js'];\");"+
      needle;
    src=src.replace(needle,inject);
  }

  (0,eval)(src+'\n//# sourceURL=generator-r18-runtime.js');
})().catch(e=>{
  const box=document.getElementById('statusBox');
  if(box){box.textContent='Falha ao iniciar R18: '+String(e?.message||e);box.className='status-strip err'}
  else console.error(e);
});
