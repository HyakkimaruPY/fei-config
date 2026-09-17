/* SRHELL v6.6 — R19 builder shim.
   Shorts receives the performance/virtualization and Aura bottom-sheet rewrite.
   Standard keeps the R15/R16 transport/parser and R18 GitHub-validated CORS pool. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r14.js?v=builder-r19-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src
    .replace("const BUILD='aura-generator-r14';","const BUILD='aura-generator-r19';")
    .replace(/shorts-aura-r14/g,'shorts-aura-r19')
    .replace(/aura625-r14/g,'aura625-r19')
    .replace(/App Shorts Aura R14/g,'App Shorts Aura R19')
    .replace(/App padrão R14/g,'App padrão R19');

  /* Shorts: preserve Aura R12/R14 player, then apply R19 as the final CSS/JS
     layer. The automatic CORS pool is the lightweight R18 consumer only. */
  src=src.replace(
    "BASE+'/runtime/shorts/06-aura-player-polish-r14.css']",
    "BASE+'/runtime/shorts/06-aura-player-polish-r14.css',BASE+'/runtime/shorts/07-performance-r19.css']"
  );
  src=src.replace(
    "BASE+'/runtime/shorts/07-aura-player-polish-r14.js']",
    "BASE+'/runtime/shorts/07-aura-player-polish-r14.js',BASE+'/runtime/shared/01-proxy-pool-r18.js',BASE+'/runtime/shorts/08-performance-r19.js']"
  );

  /* Standard remains functionally identical to R18, with a fresh revision key
     so stale browser assets cannot leak into newly generated R19 apps. */
  const needle="const mark=\"const allAssets=[...CSS_CORE,theme,...CSS_PATCHES,...JS_CORE,...JS_PATCHES];let loaded=0;\";";
  if(src.includes(needle)){
    const inject=
      "if(!t.includes('13-transport-r15.js'))t=t.replace(\"BASE+'/runtime/standard/12-catalog-resilience-r12.js'];\",\"BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js'];\");"+
      "if(!t.includes('14-api-parser-r16.js'))t=t.replace(\"BASE+'/runtime/standard/13-transport-r15.js'];\",\"BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js'];\");"+
      "if(!t.includes('01-proxy-pool-r18.js'))t=t.replace(\"BASE+'/runtime/standard/14-api-parser-r16.js'];\",\"BASE+'/runtime/standard/14-api-parser-r16.js',BASE+'/runtime/shared/01-proxy-pool-r18.js'];\");"+
      needle;
    src=src.replace(needle,inject);
  }

  (0,eval)(src+'\n//# sourceURL=generator-r19-runtime.js');
})().catch(e=>{
  const box=document.getElementById('statusBox');
  if(box){box.textContent='Falha ao iniciar R19: '+String(e?.message||e);box.className='status-strip err'}
  else console.error(e);
});
