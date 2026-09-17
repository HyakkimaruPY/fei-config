/* SRHELL v6.6 — R20 builder.
   Shorts gets stable-flow virtualization. Standard keeps R15/R16 transport.
   Both generated modes use per-app/DNS proxy affinity from the validated pool. */
(async()=>{
  const BASE='https://raw.githubusercontent.com/HyakkimaruPY/fei-config/main/html-generator/v6.6';
  const url=BASE+'/builder/generator-r14.js?v=builder-r20-base';
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('Falha ao carregar builder base: HTTP '+r.status);
  let src=await r.text();
  src=src
    .replace("const BUILD='aura-generator-r14';","const BUILD='aura-generator-r20';")
    .replace(/shorts-aura-r14/g,'shorts-aura-r20')
    .replace(/aura625-r14/g,'aura625-r20')
    .replace(/App Shorts Aura R14/g,'App Shorts Aura R20')
    .replace(/App padrão R14/g,'App padrão R20');
  src=src.replace("corsProxy:String(el.corsProxy.value||'').trim(),theme:chosenTheme()","corsProxy:String(el.corsProxy.value||'').trim(),autoCorsProxy:(document.getElementById('autoCorsProxyInput')?.checked!==false),theme:chosenTheme()");
  src=src.replace("BASE+'/runtime/shorts/06-aura-player-polish-r14.css']","BASE+'/runtime/shorts/06-aura-player-polish-r14.css',BASE+'/runtime/shorts/07-performance-r20.css']");
  src=src.replace("BASE+'/runtime/shorts/07-aura-player-polish-r14.js']","BASE+'/runtime/shorts/07-aura-player-polish-r14.js',BASE+'/runtime/shared/01-proxy-pool-r20.js',BASE+'/runtime/shorts/08-performance-r20.js']");
  const needle="const mark=\"const allAssets=[...CSS_CORE,theme,...CSS_PATCHES,...JS_CORE,...JS_PATCHES];let loaded=0;\";";
  if(src.includes(needle)){
    const inject="if(!t.includes('13-transport-r15.js'))t=t.replace(\"BASE+'/runtime/standard/12-catalog-resilience-r12.js'];\",\"BASE+'/runtime/standard/12-catalog-resilience-r12.js',BASE+'/runtime/standard/13-transport-r15.js'];\");"+"if(!t.includes('14-api-parser-r16.js'))t=t.replace(\"BASE+'/runtime/standard/13-transport-r15.js'];\",\"BASE+'/runtime/standard/13-transport-r15.js',BASE+'/runtime/standard/14-api-parser-r16.js'];\");"+"if(!t.includes('01-proxy-pool-r20.js'))t=t.replace(\"BASE+'/runtime/standard/14-api-parser-r16.js'];\",\"BASE+'/runtime/standard/14-api-parser-r16.js',BASE+'/runtime/shared/01-proxy-pool-r20.js'];\");"+needle;
    src=src.replace(needle,inject);
  }
  (0,eval)(src+'\n//# sourceURL=generator-r20-runtime.js');
  const proxyInput=document.getElementById('corsProxyInput');
  if(proxyInput&&!document.getElementById('autoCorsProxyInput')){
    const label=document.createElement('label');label.className='srh-auto-proxy-toggle';label.style.cssText='display:flex;align-items:center;gap:9px;margin-top:8px;padding:9px 10px;border:1px solid var(--line,#2c394a);border-radius:12px;font-size:11px;cursor:pointer';label.innerHTML='<input id="autoCorsProxyInput" type="checkbox" checked style="accent-color:var(--accent,#7aa2f7)"><span><strong>Proxy CORS automático</strong><br><small style="opacity:.68">Usar a lista validada pelo GitHub somente quando a conexão direta falhar.</small></span>';proxyInput.insertAdjacentElement('afterend',label);
  }
})().catch(e=>{const box=document.getElementById('statusBox');if(box){box.textContent='Falha ao iniciar R20: '+String(e?.message||e);box.className='status-strip err'}else console.error(e)});
