'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),input=process.argv[2];assert(input);
const bytes=fs.readFileSync(input),x=JSON.parse(bytes),nodes=new Map(x.nodes.map(a=>[a.id,a])),parents=new Map(),leaf=new Map(),inclusive=new Map();
for(const a of nodes.values())for(const child of a.children||[])parents.set(child,a.id);
for(let i=0;i<x.samples.length;i++){
 let a=nodes.get(x.samples[i]);const dt=(x.timeDeltas[i]||0)/1000,key=a=>`${a.callFrame.url.split('/').at(-1)}:${a.callFrame.lineNumber+1} ${a.callFrame.functionName}`;
 leaf.set(key(a),(leaf.get(key(a))||0)+dt);const seen=new Set();
 for(;a;a=nodes.get(parents.get(a.id))){const k=key(a);if(seen.has(k))continue;seen.add(k);inclusive.set(k,(inclusive.get(k)||0)+dt);}
}
const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([frame,ms])=>({frame,ms:+ms.toFixed(3)}));
console.log(JSON.stringify({scope:'Instrumented V325 CPU sample, separate from the first cold acceptance. Inclusive stack times overlap and must not be added.',profileSha256:crypto.createHash('sha256').update(bytes).digest('hex'),samples:x.samples.length,leaf:top(leaf),inclusive:top(inclusive)},null,2));
