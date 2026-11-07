'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const D='reports/ai-foundation-20261107/case152-validator-paths-v1/';
function edit(s,old,replacement,count=1){assert.equal(s.split(old).length,count+1,old);return s.replaceAll(old,replacement);}
for(const name of ['low-coupling-slices','high-coupling-slices']){
 let s=fs.readFileSync(D+name+'-prototype-20261107-v1.js','utf8');
 if(name.startsWith('low')){
  s=edit(s,'      for (const [key, child] of Object.entries(value)) {','      for (const key of Object.keys(value)) {\n        const child = value[key];',2);
 }else{
  s=edit(s,'    for (const [key, child] of Object.entries(value)) {','    for (const key of Object.keys(value)) {\n      const child = value[key];');
  s=edit(s,'  function isPlainObject(value) {','  const FORBIDDEN_SLICE_KEYS = new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]);\n\n  function isPlainObject(value) {');
  s=edit(s,'", new Set([...HOST_KEYS, ...DERIVED_TASK_KEYS]), errors);','", FORBIDDEN_SLICE_KEYS, errors);',4);
 }
 fs.writeFileSync(D+name+'-prototype-20261107-v2.js',s,{flag:'wx'});
}
