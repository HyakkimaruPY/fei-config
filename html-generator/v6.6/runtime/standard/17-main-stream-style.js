/* SRHELL Main Stream Style — default presentation for every classic palette. */
(function installMainStreamStyle(){
  document.body.classList.add('srh-main-stream-style');

  function resetMainStreamScroll(){
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch{window.scrollTo(0,0)}
    if(document.scrollingElement)document.scrollingElement.scrollTop=0;
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
  }

  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('.tab-button[data-type]');
    if(!tab)return;
    const next=tab.dataset.type;
    if(next&&next!==state.activeType){
      resetMainStreamScroll();
      requestAnimationFrame(resetMainStreamScroll);
    }
  },true);

  let heroToken=0,heroTimer=0,heroItems=[],heroIndex=0,heroNode=null;
  const heroMeta=new Map();

  function heroHost(){
    if(heroNode?.isConnected)return heroNode;
    heroNode=document.createElement('section');
    heroNode.className='stream-hero';
    heroNode.innerHTML='<div class="stream-hero__skeleton"></div><div class="stream-hero__bg"></div><div class="stream-hero__shade"></div><div class="stream-hero__content"><img class="stream-hero__logo is-hidden" alt=""><h2 class="stream-hero__title"></h2><div class="stream-hero__meta"></div><p class="stream-hero__plot"></p><div class="stream-hero__actions"><button class="stream-hero__action" data-stream-open>▶ <span>Abrir</span></button><button class="stream-hero__action stream-hero__action--ghost" data-stream-next>Próximo</button></div></div><div class="stream-hero__dots"></div>';
    el.homeStatus.insertAdjacentElement('afterend',heroNode);
    heroNode.querySelector('[data-stream-next]').onclick=()=>showHero((heroIndex+1)%Math.max(1,heroItems.length),true);
    return heroNode;
  }

  function stableShuffle(items,type){
    const day=Math.floor(Date.now()/86400000),seed=String(BASE_CONFIG.appId||BASE_CONFIG.appName||'app')+':'+type+':'+day;
    let h=2166136261;
    for(const ch of seed){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    const out=[...items];
    for(let i=out.length-1;i>0;i--){
      h=(Math.imul(h,1664525)+1013904223)|0;
      const j=Math.abs(h)%(i+1);
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  }

  function heroImage(item,type,meta){
    if(meta?.backdrop)return meta.backdrop;
    if(type==='live')return item?.image||item?.variants?.[0]?.stream_icon||'';
    return imageFor(item,type)||meta?.poster||'';
  }

  async function heroTmdb(item,type){
    if(type==='live')return null;
    const key=type+':'+String(itemId(item,type)||itemTitle(item));
    if(heroMeta.has(key))return heroMeta.get(key);
    try{
      const data=await resolveTmdb(type==='series'?'tv':'movie',item,null);
      heroMeta.set(key,data||null);
      return data||null;
    }catch{
      heroMeta.set(key,null);
      return null;
    }
  }

  function dots(){
    if(!heroNode)return;
    heroNode.querySelector('.stream-hero__dots').innerHTML=heroItems.map((_,i)=>'<button class="stream-hero__dot'+(i===heroIndex?' is-active':'')+'" data-stream-dot="'+i+'" aria-label="Destaque '+(i+1)+'"></button>').join('');
    heroNode.querySelectorAll('[data-stream-dot]').forEach(b=>b.onclick=()=>showHero(Number(b.dataset.streamDot),true));
  }

  async function showHero(index,user=false){
    clearTimeout(heroTimer);
    if(!heroItems.length)return;
    heroIndex=((index%heroItems.length)+heroItems.length)%heroItems.length;
    const local=++heroToken,item=heroItems[heroIndex],type=state.activeType,node=heroHost();
    const bg=node.querySelector('.stream-hero__bg'),title=node.querySelector('.stream-hero__title'),plot=node.querySelector('.stream-hero__plot'),metaNode=node.querySelector('.stream-hero__meta'),logo=node.querySelector('.stream-hero__logo'),skeleton=node.querySelector('.stream-hero__skeleton');
    skeleton?.classList.remove('is-hidden');
    logo.classList.add('is-hidden');logo.removeAttribute('src');
    title.textContent=type==='live'?(item.baseName||'Canal'):itemTitle(item);
    plot.textContent='';
    metaNode.textContent=type==='live'?'TV ao vivo':'';
    const initial=heroImage(item,type,null);
    bg.classList.toggle('is-live',type==='live');
    bg.style.backgroundImage=initial?'url("'+String(initial).replace(/"/g,'%22')+'")':'none';
    node.querySelector('[data-stream-open]').onclick=()=>openItem(item,type);
    dots();

    if(type!=='live'){
      const data=await heroTmdb(item,type);
      if(local!==heroToken||state.activeType!==type)return;
      const image=heroImage(item,type,data);
      if(image)bg.style.backgroundImage='url("'+String(image).replace(/"/g,'%22')+'")';
      title.textContent=data?.title||itemTitle(item);
      plot.textContent=data?.overview||String(item?.plot||item?.description||'');
      metaNode.textContent=type==='series'?'Série':'Filme';
      if(data?.logo){
        logo.src=data.logo;
        logo.onload=()=>{if(local===heroToken)logo.classList.remove('is-hidden')};
      }
    }
    skeleton?.classList.add('is-hidden');
    heroTimer=setTimeout(()=>showHero(heroIndex+1),user?8500:7000);
  }

  async function buildHero(token){
    const node=heroHost(),type=state.activeType;
    node.querySelector('.stream-hero__skeleton')?.classList.remove('is-hidden');
    const targets=targetsFor(type).slice(0,Math.min(5,targetsFor(type).length));
    const lists=[];
    for(const target of targets){
      if(token!==state.renderToken)return;
      try{
        const raw=await stableLoadTargetItems(target,token);
        if(token!==state.renderToken)return;
        lists.push(type==='live'?groupChannels(raw):uniqueById(raw,type));
      }catch{}
      if(lists.flat().length>=28)break;
    }
    let items=lists.flat();
    if(type!=='live')items=uniqueById(items,type);
    const seen=new Set();
    items=items.filter(item=>{
      const key=type==='live'?(item.baseName||itemTitle(item)):String(itemId(item,type)||itemTitle(item));
      if(!key||seen.has(key))return false;
      seen.add(key);
      return true;
    });
    heroItems=stableShuffle(items,type).slice(0,10);
    heroIndex=0;
    if(!heroItems.length){
      node.classList.add('is-hidden');
      return;
    }
    node.classList.remove('is-hidden');
    showHero(0);
  }

  const baseRenderActiveType=renderActiveType;
  renderActiveType=function(){
    clearTimeout(heroTimer);
    const out=baseRenderActiveType();
    const token=state.renderToken;
    buildHero(token);
    return out;
  };

  const baseRailMetrics=RailVirtualizer.prototype.metrics;
  RailVirtualizer.prototype.metrics=function(){
    const live=this.type==='live';
    const w=innerWidth<680?(live?124:116):(live?178:168);
    const gap=innerWidth<680?8:10,slot=w+gap,visible=Math.max(1,Math.ceil(this.viewport.clientWidth/slot));
    return{w,gap,slot,visible};
  };

  const baseGridMetrics=GridVirtualizer.prototype.metrics;
  GridVirtualizer.prototype.metrics=function(){
    const cs=getComputedStyle(this.scroller),pad=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0),available=Math.max(1,this.scroller.clientWidth-pad),gap=innerWidth<680?8:12,live=this.type==='live',base=live?150:142;
    const cols=innerWidth<680?3:Math.max(4,Math.floor((available+gap)/(base+gap)));
    const w=(available-gap*(cols-1))/cols,ratio=live?1:1.5,h=w*ratio,rowH=h+gap;
    return{available,gap,cols,w,h,rowH};
  };

  if(state.activeType)buildHero(state.renderToken);
})();
