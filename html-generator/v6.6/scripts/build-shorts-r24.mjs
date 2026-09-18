import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT='html-generator/v6.6';
const OLD='aefc61c6f386b16ac321df3a3c697baf3335c193';
const DIST=join(ROOT,'dist/r24');
const PATCH_CSS=join(ROOT,'runtime/shorts-r24/01-player-feed-fix.css');
const PATCH_JS=join(ROOT,'runtime/shorts-r24/01-player-feed-fix.js');

function old(path){
  return execFileSync('git',['show',`${OLD}:${ROOT}/${path}`],{encoding:'utf8',maxBuffer:8*1024*1024});
}
function mustReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`R24 build: padrão não encontrado em ${label}: ${from.slice(0,90)}`);
  return source.split(from).join(to);
}
function hash(text){return createHash('sha256').update(text).digest('hex').slice(0,16)}

mkdirSync(DIST,{recursive:true});

/* Exact historical modular visual/runtime baseline. No proxy-affinity bridge,
   no browser guards, no detail interceptor and no later UI observers/polish. */
const css=[
  old('runtime/shorts/01.css'),
  old('runtime/shorts/02.css'),
  old('runtime/shorts/03.css'),
  readFileSync(PATCH_CSS,'utf8')
].join('\n\n');
let js1=old('runtime/shorts/01.js');
let js2=old('runtime/shorts/02.js');
let js3=old('runtime/shorts/03.js');

// Preserve only the user-requested 2-minute arc unit; everything else stays historical.
js2=mustReplace(js2,'Math.ceil(seconds/600)','Math.ceil(seconds/120)','02.js arcCount');
js3=mustReplace(js3,'Math.ceil(d/600)','Math.ceil(d/120)','03.js arc count');
js3=mustReplace(js3,'Math.floor(el.shortVideo.currentTime/600)','Math.floor(el.shortVideo.currentTime/120)','03.js current arc');
js3=mustReplace(js3,'i*600','i*120','03.js seek arc');
js3=mustReplace(js3,"10 min cada","2 min cada",'03.js arc label');
js3=mustReplace(js3,'Math.floor(i*10)','Math.floor(i*2)','03.js arc minutes');

const coreJs=[js1,js2,js3].join('\n\n');
const patchJs=readFileSync(PATCH_JS,'utf8').trim();
const js=mustReplace(coreJs,'\ninit();\n})();',`\n${patchJs}\ninit();\n})();`,'R24 patch insertion');
const revision='r24-'+hash(css+'\n'+js);

const cssPath=join(DIST,'shorts.css');
const jsPath=join(DIST,'shorts.js');
writeFileSync(cssPath,css);
writeFileSync(jsPath,js);
execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'});

const manifest={revision,generatedAt:new Date().toISOString(),sourceCommit:OLD,architecture:'historical-modular-core+stable-feed-player',arcSeconds:120,css:'shorts.css',js:'shorts.js'};
writeFileSync(join(DIST,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({revision,cssBytes:Buffer.byteLength(css),jsBytes:Buffer.byteLength(js)},null,2));
