'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const oldSource=zlib.gunzipSync(fs.readFileSync('adhoc/search-buffer-variants-20261029-v2/analysis-port.js.gz')).toString(),newSource=fs.readFileSync('randomizer/game/ai/analysis-port.js','utf8');
function implementation(source){const a=source.indexOf('  function forwardIdentity('),b=source.indexOf('  function createAnalysisPort(',a);return Function('return ('+source.slice(a,b).trim()+')')();}
const old=implementation(oldSource),fresh=implementation(newSource),cache=new WeakMap(),rows=[];
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
for(const id of ['001','003','008','011','009','062','105','152']){
 const f=JSON.parse(fs.readFileSync(`adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`));
 const state=freeze(f.compositionEnvelope.session?.session?.workingState||JSON.parse(f.compositionEnvelope.committedState));
 for(const status of ['stable','decision','other-owner'])for(const boundary of [null,'hidden-draw']){
  const expected=old(f.compositionEnvelope,status,boundary,state);assert.equal(fresh(f.compositionEnvelope,status,boundary,state,cache),expected);assert.equal(fresh(f.compositionEnvelope,status,boundary,state,cache),expected);
  rows.push({id,status,boundary,sha256:crypto.createHash('sha256').update(expected).digest('hex')});
 }
 if(f.compositionEnvelope.session){
  const source=structuredClone(state),envelope=structuredClone(f.compositionEnvelope),session=envelope.session.session;
  source.meta.effectId=session.sessionId+':effect:123';freeze(source);
  for(let i=0;i<3;i++){
   const expected=old(envelope,'decision',null,source);assert.equal(fresh(envelope,'decision',null,source,cache),expected);
   session.queue.reverse();session.queue.push({effectId:session.sessionId+':effect:'+(700+i),parentEffectId:source.meta.effectId,payload:{}});
  }
 }
}
fs.writeFileSync('reports/ai-foundation-20261023/search-identity-cache-control-20261029-v1.json',JSON.stringify({status:'passed',comparisons:rows.length,rows,sourceSha256:crypto.createHash('sha256').update(newSource).digest('hex')},null,2)+'\n');console.log('Complete identity bytes match, including pending reference renumbering and cache reuse');
