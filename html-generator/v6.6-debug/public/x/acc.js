(()=>{'use strict';
if(window.__srhVisualAccessibilityDebug)return;
window.__srhVisualAccessibilityDebug=true;
const A=window.__srhA||{};
let cfg={};try{cfg=JSON.parse(document.getElementById('app-config')?.textContent||'{}')}catch{}
const ns=String(cfg.appId||cfg.appName||'app').replace(/[^a-z0-9_-]/gi,'_');
const THEME_KEY='srhell:'+ns+':visual-theme:v1';
const VIDEO_KEY='srhell:'+ns+':visual-video:v1';
const THEMES=[
 ['graphene','Graphene','Padrão grafite e prata.'],
 ['obsidian','Obsidian','Escuro mineral e violeta.'],
 ['porcelain','Porcelain','Claro editorial.'],
 ['jade','Jade','Escuro verde mineral.'],
 ['aurora','Aurora','Ciano e violeta.'],
 ['ember','Ember','Carvão e cobre.'],
 ['graphene-contrast-dark','Grafeno — contraste reforçado escuro','Superfícies opacas e contraste reforçado.'],
 ['graphene-contrast-light','Grafeno — contraste reforçado claro','Polaridade clara real e superfícies opacas.'],
 ['graphene-soft-light','Grafeno — luminosidade suave','Escuro estável com branco suavizado.'],
 ['graphene-protan','Grafeno — diferenciação de cores P','Estados redundantes e paleta candidata para percepção do tipo protan.'],
 ['graphene-deutan','Grafeno — diferenciação de cores D','Estados redundantes e paleta candidata para percepção do tipo deutan.'],
 ['graphene-tritan','Grafeno — diferenciação de cores T','Estados redundantes e paleta candidata para percepção do tipo tritan.'],
 ['graphene-mono','Grafeno — monocromático reforçado','Semântica por luminância, texto e forma.']
];
const IDS=new Set(THEMES.map(x=>x[0]));
const SPECIAL=new Set(THEMES.slice(6).map(x=>x[0]));
const PDTO=new Set(['graphene-protan','graphene-deutan','graphene-tritan']);
const state={theme:cfg.theme||document.body.dataset.theme||'graphene',activeVideo:null,sessionEnabled:false,compare:false,panel:null,button:null,runtimeTheme:null};
function normalizeViewport(){const m=document.querySelector('meta[name="viewport"]');if(m)m.setAttribute('content','width=device-width, initial-scale=1, viewport-fit=cover')}
normalizeViewport();
function readJson(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:f}catch{return f}}
function saveJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
let videoPrefs=readJson(VIDEO_KEY,{mode:'original',intensity:50});
if(!['original','contrast','dim','mono'].includes(videoPrefs.mode))videoPrefs.mode='original';
videoPrefs.intensity=Math.max(0,Math.min(100,Number(videoPrefs.intensity)||50));
function special(){return SPECIAL.has(state.theme)}
function supportsFilter(){return !!window.CSS?.supports?.('filter','contrast(1.1)')}
function visibleVideo(v){if(!(v instanceof HTMLVideoElement)||!v.isConnected)return false;const r=v.getBoundingClientRect();return r.width>8&&r.height>8&&getComputedStyle(v).visibility!=='hidden'&&getComputedStyle(v).display!=='none'}
function bestVideo(){
  const vids=[...document.querySelectorAll('video')].filter(visibleVideo);
  return vids.find(v=>!v.paused&&!v.ended)||vids.find(v=>v.currentTime>0)||vids[0]||null
}
function activeVideo(){if(visibleVideo(state.activeVideo))return state.activeVideo;state.activeVideo=bestVideo();return state.activeVideo}
function filterValue(){
  if(!special()||!state.sessionEnabled||state.compare||videoPrefs.mode==='original')return '';
  const k=videoPrefs.intensity/100;
  if(videoPrefs.mode==='contrast')return 'contrast('+(1+.42*k).toFixed(3)+') brightness('+(1+.04*k).toFixed(3)+')';
  if(videoPrefs.mode==='dim')return 'brightness('+(1-.42*k).toFixed(3)+')';
  if(videoPrefs.mode==='mono')return 'grayscale('+k.toFixed(3)+') contrast('+(1+.12*k).toFixed(3)+')';
  return ''
}
function applyVideo(){
  document.querySelectorAll('video[data-srh-a11y-filter]').forEach(v=>{if(v!==activeVideo()){v.style.removeProperty('filter');delete v.dataset.srhA11yFilter}});
  const v=activeVideo();if(v){const f=filterValue();if(f){v.style.filter=f;v.dataset.srhA11yFilter='1'}else{v.style.removeProperty('filter');delete v.dataset.srhA11yFilter}}
  syncVideoUi()
}
function closePanel(){state.panel?.classList.add('is-hidden');state.button?.setAttribute('aria-expanded','false')}
function openPanel(){
  if(!special()||!supportsFilter()||!activeVideo())return;
  ensureImagePanel();state.panel.classList.remove('is-hidden');state.button?.setAttribute('aria-expanded','true');
  state.panel.querySelector('input,select,button')?.focus?.({preventScroll:true})
}
function controlHost(){
  const v=activeVideo();if(!v)return null;
  return v.closest('#shortPlayer')?.querySelector('.srh25-player__rail')||v.closest('.detail-art')?.querySelector('.detail-art__actions,.detail-inline-actions')||v.closest('#playerLayer')?.querySelector('.player-head')||v.parentElement
}
function ensurePlayerButton(){
  if(!special()||!supportsFilter()||!activeVideo()){state.button?.remove();state.button=null;closePanel();return}
  const host=controlHost();if(!host)return;
  if(state.button?.isConnected&&state.button.parentElement===host)return;
  state.button?.remove();
  const b=document.createElement('button');b.type='button';b.id='srhA11yImageButton';b.className=host.classList.contains('srh25-player__rail')?'srh25-player__action srh-a11y-image-button':'srh-a11y-image-button';
  b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','Ajustes de imagem');
  b.innerHTML=host.classList.contains('srh25-player__rail')?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M7 12h10M9 17h6"/></svg><small>Imagem</small>':'Imagem';
  b.onclick=e=>{e.preventDefault();e.stopPropagation();state.panel&&!state.panel.classList.contains('is-hidden')?closePanel():openPanel()};
  host.appendChild(b);state.button=b
}
function syncVideoUi(){
  if(!state.panel)return;
  const enabled=state.panel.querySelector('[data-a11y-video-enable]'),mode=state.panel.querySelector('[data-a11y-video-mode]'),range=state.panel.querySelector('[data-a11y-video-intensity]'),compare=state.panel.querySelector('[data-a11y-video-compare]'),status=state.panel.querySelector('[data-a11y-video-status]');
  if(enabled)enabled.checked=state.sessionEnabled;if(mode)mode.value=videoPrefs.mode;if(range)range.value=String(videoPrefs.intensity);if(compare)compare.checked=state.compare;
  if(status)status.textContent=!supportsFilter()?'Ajustes indisponíveis neste navegador.':PDTO.has(state.theme)?'Ajustes tonais disponíveis. Remapeamento cromático P/D/T permanece experimental e não foi ativado.':state.sessionEnabled?'Ativo nesta sessão.':'Desligado.'
}
function ensureImagePanel(){
  if(state.panel?.isConnected)return state.panel;
  const p=document.createElement('section');p.id='srhA11yImagePanel';p.className='srh-a11y-image-panel is-hidden';p.setAttribute('role','dialog');p.setAttribute('aria-modal','false');p.setAttribute('aria-label','Ajustes de imagem');
  p.innerHTML='<div class="srh-a11y-image-head"><strong>Ajustes de imagem</strong><button type="button" data-a11y-video-close aria-label="Fechar ajustes de imagem">×</button></div><label class="srh-a11y-check"><input type="checkbox" data-a11y-video-enable> Ativar nesta sessão</label><label>Modo<select data-a11y-video-mode><option value="original">Original</option><option value="contrast">Contraste</option><option value="dim">Atenuação</option><option value="mono">Monocromático</option></select></label><label>Intensidade <output data-a11y-video-output>50%</output><input type="range" min="0" max="100" step="5" data-a11y-video-intensity></label><label class="srh-a11y-check"><input type="checkbox" data-a11y-video-compare> Comparar com original</label><button type="button" data-a11y-video-reset>Restaurar original</button><div class="srh-a11y-note" data-a11y-video-status aria-live="polite"></div>';
  document.body.appendChild(p);state.panel=p;
  p.querySelector('[data-a11y-video-close]').onclick=closePanel;
  p.querySelector('[data-a11y-video-enable]').onchange=e=>{state.sessionEnabled=!!e.target.checked;state.compare=false;applyVideo()};
  p.querySelector('[data-a11y-video-mode]').onchange=e=>{videoPrefs.mode=e.target.value;saveJson(VIDEO_KEY,videoPrefs);applyVideo()};
  p.querySelector('[data-a11y-video-intensity]').oninput=e=>{videoPrefs.intensity=Number(e.target.value);p.querySelector('[data-a11y-video-output]').value=videoPrefs.intensity+'%';saveJson(VIDEO_KEY,videoPrefs);applyVideo()};
  p.querySelector('[data-a11y-video-compare]').onchange=e=>{state.compare=!!e.target.checked;applyVideo()};
  p.querySelector('[data-a11y-video-reset]').onclick=()=>{videoPrefs={mode:'original',intensity:50};state.sessionEnabled=false;state.compare=false;saveJson(VIDEO_KEY,videoPrefs);p.querySelector('[data-a11y-video-output]').value='50%';applyVideo()};
  syncVideoUi();return p
}
async function loadTheme(id,{persist=true}={}){
  if(!IDS.has(id))return false;const old=state.theme;
  try{
    const css=await A.t?.(id);if(typeof css!=='string'||css.length<20)throw Error('CSS indisponível');
    let style=document.getElementById('srhA11yRuntimeTheme');if(!style){style=document.createElement('style');style.id='srhA11yRuntimeTheme';document.head.appendChild(style)}
    style.textContent=css;state.runtimeTheme=style;state.theme=id;document.body.dataset.theme=id;
    if(!SPECIAL.has(id)){state.sessionEnabled=false;state.compare=false}
    if(persist)saveJson(THEME_KEY,{theme:id,updatedAt:Date.now()});
    refreshSettings();applyVideo();ensurePlayerButton();return true
  }catch(e){state.theme=old;document.body.dataset.theme=old;refreshSettings(String(e?.message||e));return false}
}
function settingsHost(){const p=document.getElementById('settingsPanel');return p?.querySelector('.settings-panel__inner')||p}
function refreshSettings(error=''){
  const sec=document.getElementById('srhA11ySettings');if(!sec)return;
  const sel=sec.querySelector('[data-a11y-theme]');if(sel)sel.value=state.theme;
  const note=sec.querySelector('[data-a11y-theme-note]');const row=THEMES.find(x=>x[0]===state.theme);
  if(note)note.textContent=error?'Falha ao carregar tema: '+error:(row?.[2]||'');
  sec.classList.toggle('is-special',special());
  const v=sec.querySelector('[data-a11y-open-video]');if(v){v.hidden=!special();v.disabled=!supportsFilter()}
}
function ensureSettings(){
  const host=settingsHost();if(!host||document.getElementById('srhA11ySettings')){refreshSettings();return}
  const sec=document.createElement('section');sec.id='srhA11ySettings';sec.className='srh-a11y-settings';
  sec.innerHTML='<div class="srh-a11y-settings__title">Acessibilidade visual</div><label>Perfil visual<select data-a11y-theme>'+THEMES.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></label><div class="srh-a11y-note" data-a11y-theme-note></div><div class="srh-a11y-preview"><span>Texto e estado</span><button type="button">Botão</button><span class="srh-a11y-preview__selected">✓ Selecionado</span></div><button type="button" data-a11y-open-video hidden>Ajustes de imagem</button>';
  host.appendChild(sec);
  sec.querySelector('[data-a11y-theme]').onchange=async e=>{e.target.disabled=true;await loadTheme(e.target.value);e.target.disabled=false};
  sec.querySelector('[data-a11y-open-video]').onclick=()=>openPanel();
  refreshSettings()
}
document.addEventListener('click',e=>{if(e.target?.closest?.('#settingsButton'))setTimeout(ensureSettings,0)},true);
document.addEventListener('play',e=>{if(e.target instanceof HTMLVideoElement){state.activeVideo=e.target;applyVideo();ensurePlayerButton()}},true);
document.addEventListener('loadeddata',e=>{if(e.target instanceof HTMLVideoElement&&visibleVideo(e.target)){state.activeVideo=e.target;applyVideo();ensurePlayerButton()}},true);
document.addEventListener('emptied',e=>{if(e.target===state.activeVideo){e.target.style.removeProperty('filter');state.activeVideo=null;ensurePlayerButton()}},true);
document.addEventListener('fullscreenchange',()=>{setTimeout(()=>{applyVideo();ensurePlayerButton()},0)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.panel&&!state.panel.classList.contains('is-hidden')){e.preventDefault();e.stopImmediatePropagation();closePanel()}},true);
window.addEventListener('resize',()=>{closePanel();ensurePlayerButton()},{passive:true});
setTimeout(()=>{ensureSettings();ensureImagePanel();state.activeVideo=bestVideo();ensurePlayerButton();applyVideo()},0);
window.SRHVisualAccessibility={themes:THEMES.map(x=>({id:x[0],label:x[1],special:SPECIAL.has(x[0])})),setTheme:id=>loadTheme(id),getTheme:()=>state.theme,applyVideo};
})();