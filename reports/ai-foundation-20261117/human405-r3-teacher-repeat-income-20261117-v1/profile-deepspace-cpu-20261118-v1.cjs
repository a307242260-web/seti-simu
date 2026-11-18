// Usage: node this.cjs <candidate-root> [before-root]
process.chdir(require('node:path').resolve(process.argv[2]||process.cwd()));
'use strict';
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict'),{open}=require('./native-root-harness-20261118-v1.cjs');
const D='reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1',out=D+'/deepspace-cpu-probe-20261118-v1.json';assert(!fs.existsSync(out));
const root=JSON.parse(z.gunzipSync(fs.readFileSync(D+'/teacher-r4-point289-search-20261118-v1.json.gz'))).root,m=open(root);
try{const q=m.automatic();assert.equal(q.value,230);assert.equal(q.n,463);assert.deepEqual(m.save(),root);fs.writeFileSync(out,JSON.stringify({kind:'instrumented CPU probe only, not admission or autonomous game',native:q.n,value:q.value,complete:q.complete,rootAndRngPreserved:true,analysis:q.analysis},null,2));console.log(JSON.stringify({native:q.n,value:q.value,complete:q.complete}));}finally{m.dispose()}
