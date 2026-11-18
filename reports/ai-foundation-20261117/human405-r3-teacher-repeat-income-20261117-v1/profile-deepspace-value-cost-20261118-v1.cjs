// Usage: node this.cjs <candidate-root> [before-root]
process.chdir(require('node:path').resolve(process.argv[2]||process.cwd()));
'use strict';
const fs=require('node:fs'),z=require('node:zlib'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),assert=require('node:assert/strict');
const D='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1',out=D+'/deepspace-value-cost-profile-20261118-v1.json';assert(!fs.existsSync(out));
const file=path.resolve('randomizer/game/ai/state-value.js'),moduleSource=fs.readFileSync(file,'utf8'),valueRows=[];globalThis.__setiValueProfile=valueRows;
const needle='const result = evaluateStateValue(observation, seatId, { weights }), c = result.components;';assert(moduleSource.includes(needle));
const code=moduleSource.replace(needle,`const started=performance.now();${needle}
const elapsed=performance.now()-started,bytes=JSON.stringify(observation),hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');globalThis.__setiValueProfile.push({ms:elapsed,hash,bytes:bytes.length,value:result.total,components:result.components});`);
const instrumented=new Module(file,module);instrumented.filename=file;instrumented.paths=Module._nodeModulePaths(path.dirname(file));require.cache[file]=instrumented;instrumented._compile(code,file);instrumented.loaded=true;
const {open}=require('./native-root-harness-20261118-v1.cjs'),root=JSON.parse(z.gunzipSync(fs.readFileSync(D+'/teacher-r4-point289-search-20261118-v1.json.gz'))).root,m=open(root),counts={},traceCounts={},alienCounts={};let nativeInputs=0;
const facade={...m.c,counterfactualPort:{...m.c.counterfactualPort,createFork(...args){const f=m.c.counterfactualPort.createFork(...args),comp=f.composition||f,port={...comp.inputPort};
 for(const name of ['submitAction','submitQuickAction','submitDecision'])if(typeof port[name]==='function'){const fn=port[name];port[name]=function(...a){const input=name==='submitDecision'?a[0].choice:a[0],head=comp.inspect().session?.currentEffect;
 nativeInputs++;const key=[input.family,head?.type||'idle'].join(':');counts[key]=(counts[key]||0)+1;
 if(input.target?.traceType){const k=JSON.stringify({head:head?.type,trace:input.target.traceType,species:input.target.speciesId,kind:input.target.kind,position:input.target.position});traceCounts[k]=(traceCounts[k]||0)+1;}
 if(input.target?.speciesId&&input.family==='choose_card'){const k=JSON.stringify({head:head?.type,target:input.target});alienCounts[k]=(alienCounts[k]||0)+1;}
 return fn(...a);};}return {...f,composition:{...comp,inputPort:port}};}}};
const p=require(require('node:path').resolve('randomizer/game/ai/analysis-port')).createAnalysisPort({composition:facade,seatId:'player-white',maxCacheEntries:0});
try{const q=require(require('node:path').resolve('randomizer/game/ai/search-agent')).createSearchAgent({seatId:'player-white',analysisPort:p}).decide({seatId:'player-white',legalActions:m.menu()}).search;assert.equal(q.value,230);assert.equal(nativeInputs,463);assert.deepEqual(m.save(),root);
 const hashes=new Map();let repeated=0,repeatedMs=0;for(const r of valueRows){if(hashes.has(r.hash)){assert.deepEqual(r.components,hashes.get(r.hash).components);repeated++;repeatedMs+=r.ms;}else hashes.set(r.hash,r);}
 const summary={kind:'instrumented Native/value CPU distribution, not timing admission and not a game',runtimeSourceSha256:crypto.createHash('sha256').update(fs.readFileSync('randomizer/game/ai/analysis-port.js')).digest('hex'),originalValueSourceSha256:crypto.createHash('sha256').update(moduleSource).digest('hex'),native:nativeInputs,complete:q.complete,value:q.value,counts,traceCounts,alienCounts,valueCalls:valueRows.length,exactObservationUnique:hashes.size,exactObservationRepeats:repeated,valueMilliseconds:valueRows.reduce((a,r)=>a+r.ms,0),repeatValueMilliseconds:repeatedMs,observationSerializedBytes:valueRows.reduce((a,r)=>a+r.bytes,0),rows:valueRows,rootAndRngPreserved:true};fs.writeFileSync(out,JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,rows:undefined,alienCounts:undefined}));
}finally{p.close();m.dispose()}
