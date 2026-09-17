/* SRHELL v6.6 — R16 builder shim.
   Keeps R14/R15 UI and media fixes, adds tolerant Xtream API detail parsing. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r14.js?v=builder-r16-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src
    .replace("const BUILD='aura-generator-r14';","const BUILD='aura-generator-r16';")
    .replace(/shorts-aura-r14/g,'shorts-aura-r16')
    .replace(/aura625-r14/g,'aura625-r16')
    .replace(/App Shorts Aura R14/g,'App Shorts Aura R16')
    .replace(/App padrão R14/g,'App padrão R16');

  const needle="const mark=\"const allAssets=[...CSS_CORE,theme,...CSS_PATCHES,...JS_CORE,...JS_PATCHES];let loaded=0;\";";
  if(src.includes(needle)){
    const inject=
      "if(!t.includes('13-transport-r15.js'))t=t.replace(\"BASE+'/runtime/standard/12-catalog-resilience-r12.js'];\",\"BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js'];\");"+
      "if(!t.includes('14-api-parser-r16.js'))t=t.replace(\"BASE+'/runtime/standard/13-transport-r15.js'];\",\"BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js'];\");"+
      needle;
    src=src.replace(needle,inject);
  }

  (0,eval)(src+'\n//# sourceURL=generator-r16-runtime.js');
})().catch(e=>{
  const box=document.getElementById('statusBox');
  if(box){box.textContent='Falha ao iniciar R16: '+String(e?.message||e);box.className='status-strip err'}
  else console.error(e);
});
