"use strict";
const fs=require("node:fs"),z=require("node:zlib"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");process.chdir(path.resolve(process.argv[2]));const {open}=require("./native-root-harness-20261118-v1.cjs"),read=n=>JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,n))));
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const hash=x=>crypto.createHash("sha256").update(JSON.stringify(ordered(x))).digest("hex");
const rename=(v,id)=>typeof v==="string"?v==="fossil_06"?id:v===id?"fossil_06":v:Array.isArray(v)?v.map(x=>rename(x,id)):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).map(([k,x])=>[rename(k,id),rename(x,id)])):v;
const tasks=read("pickup-task-all-hidden-identities-20261118-v1.json.gz");let inputs=0;
for(const row of tasks.rows){const m=open(row.root);try{for(const s of row.steps){m.apply(s.action);assert.deepEqual(m.save(),s.after);inputs++;}}finally{m.dispose()}}
const cargo=read("known-old-cargo-all-identities-20261118-v1.json.gz");for(const row of cargo.rows){const id=row.hiddenSwap[1],e=structuredClone(cargo.root),s=JSON.parse(e.committedState);s.aliens.chong=rename(s.aliens.chong,id);e.committedState=JSON.stringify(ordered(s));e.session=rename(e.session,id);const m=open(e);try{for(const a of row.actions){m.apply(a);inputs++;}assert.equal(hash(m.save()),row.expectedEnvelopeSha256);assert.deepEqual(JSON.parse(JSON.stringify(m.facts())),row.after);}finally{m.dispose()}}
console.log(JSON.stringify({taskIdentities:tasks.rows.length,cargoIdentities:cargo.rows.length,nativeInputs:inputs,fullEnvelopesExact:true,noAI:true}));
