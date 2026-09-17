import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT='html-generator/v6.6';
const OLD='aefc61c6f386b16ac321df3a3c697baf3335c193';
const DIST=join(ROOT,'dist/r24');
const BRIDGE=join(ROOT,'runtime/shorts-r24/proxy-affinity.js');
const STABILITY=join(ROOT,'runtime/shorts-r24/browser-stability.js');
const POLISH_CSS=join(ROOT,'runtime/shorts-r24/ui-polish.css');
const POLISH_JS=join(ROOT,'runtime/shorts-r24/ui-polish.js');

function old(path){
  return execFileSync('git',['show',`${OLD}:${ROOT}/${path}`],{encoding:'utf8',maxBuffer:8*1024*1024});
}
function mustReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`R24 build: padrão não encontrado em ${label}: ${from.slice(0,90)}`);
  return source.split(from).join(to);
}
function hash(text){return createHash('sha256').update(text).digest('hex').slice(0,16)}

mkdirSync(DIST,{recursive:true});

const css=[
  old('runtime/shorts/01.css'),
  old('runtime/shorts/02.css'),
  old('runtime/shorts/03.css'),
  readFileSync(POLISH_CSS,'utf8')
].join('\n\n');
let js1=old('runtime/shorts/01.js');
let js2=old('runtime/shorts/02.js');
let js3=old('runtime/shorts/03.js');
const bridge=readFileSync(BRIDGE,'utf8');
const stability=readFileSync(STABILITY,'utf8');
const polish=readFileSync(POLISH_JS,'utf8');

// The historical modular core is preserved. Only the arc unit changes from 10 min to 2 min.
js2=mustReplace(js2,'Math.ceil(seconds/600)','Math.ceil(seconds/120)','02.js arcCount');
js3=mustReplace(js3,'Math.ceil(d/600)','Math.ceil(d/120)','03.js arc count');
js3=mustReplace(js3,'Math.floor(el.shortVideo.currentTime/600)','Math.floor(el.shortVideo.currentTime/120)','03.js current arc');
js3=mustReplace(js3,'i*600','i*120','03.js seek arc');
js3=mustReplace(js3,"10 min cada","2 min cada",'03.js arc label');
js3=mustReplace(js3,'Math.floor(i*10)','Math.floor(i*2)','03.js arc minutes');

// Install the small R24 polish after every historical function/event exists, but before init().
js3=mustReplace(js3,'init();\n})();',`${polish.trim()}\n\ninit();\n})();`,'03.js final init');

// 01.js opens the IIFE and 03.js closes it. The bridge and browser guard stay inside
// that historical scope, replacing only request()/fetch safety; UI polish is last.
const js=[js1,bridge,stability,js2,js3].join('\n\n');
const revision='r24-'+hash(css+'\n'+js);

const cssPath=join(DIST,'shorts.css');
const jsPath=join(DIST,'shorts.js');
writeFileSync(cssPath,css);
writeFileSync(jsPath,js);
execFileSync(process.execPath,['--check',jsPath],{stdio:'inherit'});

const manifest={revision,generatedAt:new Date().toISOString(),sourceCommit:OLD,architecture:'historical-modular-rebuild',arcSeconds:120,css:'shorts.css',js:'shorts.js'};
writeFileSync(join(DIST,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({revision,cssBytes:Buffer.byteLength(css),jsBytes:Buffer.byteLength(js)},null,2));
