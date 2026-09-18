import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';

const root=path.resolve('html-generator/v6.6');
const repoRoot='html-generator/v6.6';
const outDir=path.join(root,'dist/r23');
const HIST_STANDARD='46b9cd4bbf7d403a31634a4f46417856b6903e5a';
fs.mkdirSync(outDir,{recursive:true});
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const readAt=(ref,p)=>execFileSync('git',['show',`${ref}:${repoRoot}/${p}`],{encoding:'utf8',maxBuffer:8*1024*1024});
const write=(p,s)=>fs.writeFileSync(path.join(outDir,p),s.endsWith('\n')?s:s+'\n');
const join=files=>files.map(f=>`/* ===== ${f} ===== */\n${read(f).trim()}\n`).join('\n');

/* Deep diagnostic rollback.
   Standard is intentionally reduced to the original modular core plus the first
   inline-detail fix from 46b9cd4. This predates Aura rendering/redirect logic,
   mutation-observer action layers, proxy stacks and later transport patches. */
const standardCss=['runtime/standard/01.css','runtime/standard/02.css','runtime/standard/03-fixes.css','runtime/standard/12-ui-organization-lite.css'];
const standardCore=['runtime/standard/01.js','runtime/standard/02.js','runtime/standard/03.js'];
const historicalInlinePatch=`/* ===== runtime/standard/04-fixes.js @ ${HIST_STANDARD} ===== */\n${readAt(HIST_STANDARD,'runtime/standard/04-fixes.js').trim()}\n`;
const standardLitePatches=historicalInlinePatch+join(['runtime/standard/15-ui-organization-lite.js']);

const shortsCss=[
  'runtime/shorts/01.css','runtime/shorts/02.css','runtime/shorts/03.css',
  'runtime/shorts/04-aura-player-r12.css','runtime/shorts/05-theme-variants-r13.css','runtime/shorts/09-feed-r23.css'
];
const shortsCore=['runtime/shorts/01.js','runtime/shorts/02.js','runtime/shorts/03.js'];
const shortsPatches=[
  'runtime/shorts/04-proxy-fix.js','runtime/shorts/05-aura-transport-r5.js','runtime/shorts/06-aura-player-r12.js',
  'runtime/shared/03-api-router-r23.js','runtime/shorts/10-feed-controller-r23.js'
];

function assembleJsText(coreFiles,patches,label){
  const core=join(coreFiles);
  const marker=/\ninit\(\);\s*\n\}\)\(\);\s*$/;
  if(!marker.test(core))throw new Error(`${label}: marcador final init()/IIFE não encontrado`);
  const bundle=core.replace(marker,`\n/* ===== DIAGNOSTIC MODULES ===== */\n${patches}\ninit();\n})();\n`);
  const initCount=(bundle.match(/\binit\(\);/g)||[]).length;
  if(initCount!==1)throw new Error(`${label}: esperado 1 init();, encontrado ${initCount}`);
  return bundle;
}
function assembleJs(coreFiles,patchFiles,label){return assembleJsText(coreFiles,join(patchFiles),label)}

const standardJs=assembleJsText(standardCore,standardLitePatches,'standard');
const shortsJs=assembleJs(shortsCore,shortsPatches,'shorts');
const standardCssBundle=join(standardCss),shortsCssBundle=join(shortsCss);
write('standard.js',standardJs);write('shorts.js',shortsJs);write('standard.css',standardCssBundle);write('shorts.css',shortsCssBundle);

function checkFileJs(full,label){const r=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});if(r.status!==0)throw new Error(`${label} falhou no node --check:\n${r.stderr||r.stdout}`)}
for(const f of ['standard.js','shorts.js'])checkFileJs(path.join(outDir,f),f);
checkFileJs(path.join(root,'builder/generator-r23-clean.js'),'generator-r23-clean.js');

const themeFiles=['graphene','obsidian','porcelain','jade','aurora','ember'].map(x=>`themes/${x}.css`);
const hash=crypto.createHash('sha256');
for(const s of [standardJs,shortsJs,standardCssBundle,shortsCssBundle,...themeFiles.map(read)])hash.update(s);
const revision='r23-'+hash.digest('hex').slice(0,16);
const manifest={revision,generatedAt:new Date().toISOString(),diagnosticBaseline:{standard:'46b9cd4-pre-aura'},standardLayer:'lite-ui-r4-favorites-flow-60s',standard:{js:'standard.js',css:'standard.css'},shorts:{js:'shorts.js',css:'shorts.css'},themes:themeFiles.map(x=>path.basename(x,'.css'))};
write('manifest.json',JSON.stringify(manifest,null,2));

function checkJsText(source,label){
  const tmp=path.join(outDir,`.check-${crypto.createHash('md5').update(label).digest('hex')}.js`);
  fs.writeFileSync(tmp,source);const r=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});fs.unlinkSync(tmp);
  if(r.status!==0)throw new Error(`${label} inválido:\n${r.stderr||r.stdout}`);
}
function inlineScripts(html){
  const out=[];for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)){const attrs=m[1]||'',source=m[2]||'';if(/\bsrc\s*=|type=["']application\/json/i.test(attrs)||!source.trim())continue;out.push(source)}return out;
}
function validateTemplate(file){
  const html=read('templates/'+file);
  if(!html.includes('__APP_CONFIG__'))throw new Error(`${file}: __APP_CONFIG__ ausente`);
  if(/generator-r(?:1[4-9]|2[0-2])|\beval\s*\(/.test(html))throw new Error(`${file}: referência a builder antigo/eval encontrada`);
  const sample=html.replace('__APP_CONFIG__',JSON.stringify({appId:'ci_test',appMode:file.startsWith('shorts')?'shorts':'standard',appName:'CI',server:'http://example.invalid',username:'u',password:'p',liveExtension:'m3u8',corsProxy:'',autoCorsProxy:true,theme:'graphene',targets:[]}));
  inlineScripts(sample).forEach((s,i)=>checkJsText(s,`${file} inline script ${i}`));
}
function requiredIds(js){const ids=new Set();for(const m of js.matchAll(/\$\(['"]#([^'"]+)['"]\)/g))ids.add(m[1]);return [...ids]}
function assertIds(jsFile,htmlFile){const js=read(jsFile),html=read(htmlFile),missing=requiredIds(js).filter(id=>!new RegExp(`id=["']${id}["']`).test(html));if(missing.length)throw new Error(`${htmlFile}: IDs ausentes exigidos por ${jsFile}: ${missing.join(', ')}`)}
for(const file of ['standard-r23.html','shorts-r23.html'])validateTemplate(file);
assertIds('runtime/standard/01.js','templates/standard-r23.html');
assertIds('runtime/shorts/01.js','templates/shorts-r23.html');
assertIds('builder/generator-r23-clean.js','generator-r23.html');

const generatorR23=read('generator-r23.html'),generatorMain=read('generator.html');
if(generatorMain!==generatorR23)throw new Error('generator.html divergiu de generator-r23.html; a entrada principal deve ser exatamente a versão R23 validada.');
if(/generator-r(?:1[4-9]|2[0-2])|\beval\s*\(/.test(generatorR23))throw new Error('generator-r23.html contém builder antigo/eval');
inlineScripts(generatorR23).forEach((s,i)=>checkJsText(s,`generator-r23.html inline script ${i}`));
for(const bad of ['eval(','generator-r20.js','generator-r21.js','generator-r22.js'])if(read('builder/generator-r23-clean.js').includes(bad))throw new Error(`builder R23 contém dependência proibida: ${bad}`);

console.log(`R23 stable baseline + lightweight UI build OK: ${revision}`);
