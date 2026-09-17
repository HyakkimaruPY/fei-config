import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.resolve('html-generator/v6.6');
const outDir=path.join(root,'dist/r23');
fs.mkdirSync(outDir,{recursive:true});
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(outDir,p),s.endsWith('\n')?s:s+'\n');
const join=files=>files.map(f=>`/* ===== ${f} ===== */\n${read(f).trim()}\n`).join('\n');

const standardCss=[
  'runtime/standard/01.css','runtime/standard/02.css','runtime/standard/03-fixes.css',
  'runtime/standard/04-aura-reference.css','runtime/standard/05-player-cleanup.css','runtime/standard/06-spacing-fix.css',
  'runtime/standard/07-detail-cleanup.css','runtime/standard/08-favorites-continue.css','runtime/standard/09-detail-hierarchy.css',
  'runtime/standard/10-design-balance.css'
];
const standardCore=['runtime/standard/01.js','runtime/standard/02.js','runtime/standard/03.js'];
const standardPatches=[
  'runtime/standard/04-fixes.js','runtime/standard/05-proxy-fix.js','runtime/standard/06-player-cleanup.js',
  'runtime/standard/07-detail-cleanup.js','runtime/standard/08-favorites-continue.js','runtime/standard/09-detail-hierarchy.js',
  'runtime/standard/10-actions-accessibility.js','runtime/standard/11-aura-transport-r11.js',
  'runtime/standard/12-catalog-resilience-r12.js','runtime/standard/13-transport-r15.js',
  'runtime/shared/03-api-router-r23.js'
];
const shortsCss=[
  'runtime/shorts/01.css','runtime/shorts/02.css','runtime/shorts/03.css',
  'runtime/shorts/04-aura-player-r12.css','runtime/shorts/05-theme-variants-r13.css','runtime/shorts/09-feed-r23.css'
];
const shortsCore=['runtime/shorts/01.js','runtime/shorts/02.js','runtime/shorts/03.js'];
const shortsPatches=[
  'runtime/shorts/04-proxy-fix.js','runtime/shorts/05-aura-transport-r5.js','runtime/shorts/06-aura-player-r12.js',
  'runtime/shared/03-api-router-r23.js','runtime/shorts/10-feed-controller-r23.js'
];

function assembleJs(coreFiles,patchFiles,label){
  const core=join(coreFiles);
  const patches=join(patchFiles);
  const marker=/\ninit\(\);\s*\n\}\)\(\);\s*$/;
  if(!marker.test(core))throw new Error(`${label}: marcador final init()/IIFE não encontrado`);
  const bundle=core.replace(marker,`\n/* ===== R23 MODULES ===== */\n${patches}\ninit();\n})();\n`);
  const initCount=(bundle.match(/\binit\(\);/g)||[]).length;
  if(initCount!==1)throw new Error(`${label}: esperado 1 init();, encontrado ${initCount}`);
  return bundle;
}

const standardJs=assembleJs(standardCore,standardPatches,'standard');
const shortsJs=assembleJs(shortsCore,shortsPatches,'shorts');
const standardCssBundle=join(standardCss);
const shortsCssBundle=join(shortsCss);
write('standard.js',standardJs);write('shorts.js',shortsJs);write('standard.css',standardCssBundle);write('shorts.css',shortsCssBundle);

for(const f of ['standard.js','shorts.js']){
  const full=path.join(outDir,f),r=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`${f} falhou no node --check:\n${r.stderr||r.stdout}`);
}
const builder=path.join(root,'builder/generator-r23-clean.js');
const br=spawnSync(process.execPath,['--check',builder],{encoding:'utf8'});
if(br.status!==0)throw new Error(`generator-r23-clean.js inválido:\n${br.stderr||br.stdout}`);

const themeFiles=['graphene','obsidian','porcelain','jade','aurora','ember'].map(x=>`themes/${x}.css`);
const hash=crypto.createHash('sha256');
for(const s of [standardJs,shortsJs,standardCssBundle,shortsCssBundle,...themeFiles.map(read)])hash.update(s);
const revision='r23-'+hash.digest('hex').slice(0,16);
const manifest={revision,generatedAt:new Date().toISOString(),standard:{js:'standard.js',css:'standard.css'},shorts:{js:'shorts.js',css:'shorts.css'},themes:themeFiles.map(x=>path.basename(x,'.css'))};
write('manifest.json',JSON.stringify(manifest,null,2));

function validateTemplate(file){
  const full=path.join(root,'templates',file),html=fs.readFileSync(full,'utf8');
  if(!html.includes('__APP_CONFIG__'))throw new Error(`${file}: __APP_CONFIG__ ausente`);
  if(/generator-r(?:1[4-9]|2[0-2])|\beval\s*\(/.test(html))throw new Error(`${file}: referência a builder antigo/eval encontrada`);
  const sample=html.replace('__APP_CONFIG__',JSON.stringify({appId:'ci_test',appMode:file.startsWith('shorts')?'shorts':'standard',appName:'CI',server:'http://example.invalid',username:'u',password:'p',liveExtension:'m3u8',corsProxy:'',autoCorsProxy:true,theme:'graphene',targets:[]}));
  const scripts=[...sample.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()&&!/type=["']application\/json/i.test(m?.[0]||''));
  scripts.forEach((s,i)=>{const tmp=path.join(outDir,`.template-${file}-${i}.js`);fs.writeFileSync(tmp,s);const r=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});fs.unlinkSync(tmp);if(r.status!==0)throw new Error(`${file} script ${i} inválido:\n${r.stderr||r.stdout}`)});
}
for(const file of ['standard-r23.html','shorts-r23.html'])if(fs.existsSync(path.join(root,'templates',file)))validateTemplate(file);

console.log(`R23 build OK: ${revision}`);
