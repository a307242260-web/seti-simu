'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),load=n=>require(path.resolve('randomizer',n));
const current='reports/ai-foundation-20261107/v353-fixed-symbol-layout-ranking-v1/source-manifest-20261107-v1.json',previous='reports/ai-foundation-20261107/v352-data-source-capital-handoff-v1/source-manifest-20261107-v1.json',oldRoot=process.argv[2];
const modulePath='randomizer/game/ai/known-symbol-capital.js';assert.equal(sha(modulePath),read(current).sourceHashes[modulePath]);assert.equal(sha(path.resolve(oldRoot,modulePath)),read(previous).sourceHashes[modulePath]);
const old=require(path.resolve(oldRoot,modulePath)),api=load('game/ai/known-symbol-capital'),probe=load('game/ai/probe-capital'),{DEFAULT_WEIGHTS:weights}=load('game/ai/state-value'),amiba=load('game/aliens/amiba');
const root='reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-133-20261105-v1.checkpoint.json',c=read(root),state=JSON.parse(c.coreState.compositionEnvelope.committedState),seat='player-white';
const facts=probe.factsFromState(state,state.players.players.find(p=>p.id===seat));assert(facts.hand.some(api.supported));
const clone=v=>structuredClone(v),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const layouts=[clone(facts.researchSymbols)];
for(const slot of Object.keys(layouts[0].symbolSlots).slice(0,3)){
 const context={amiba:amiba.copyPublicSymbolState(layouts[0])};assert(amiba.resolveSymbolAtSlot(context,slot).ok);
 const {symbolSlots,symbolsById}=context.amiba;layouts.push({...layouts[0],symbolSlots,symbolsById});
}
let controls=0,chosen=0;
for(const layout of layouts)for(const score of [0,49,91])for(const availableData of [0,4,6])for(const publicity of [0,9,10]){
 const fixed=freeze(clone(layout)),mutable=clone(layout),player={...facts.player,score,availableData,publicity};
 const source=JSON.stringify(fixed),w={...weights,availableData:.75};
 for(const selectedWeights of [weights,w]){
  const input={...facts,player,researchSymbols:fixed};const p=next=>next.player.availableData*.5;
  const reference=old.quote(input,selectedWeights,p,0);if(reference.selected)chosen++;
  assert.deepEqual(api.quote(input,selectedWeights,p,0),reference);
  assert.deepEqual(api.quote(input,selectedWeights,p,0),reference);
  assert.deepEqual(api.quote({...input,researchSymbols:mutable},selectedWeights,p,0),reference);
  assert.equal(JSON.stringify(fixed),source);controls++;
 }
}
assert(chosen>0);const out={sourceManifest:current,sourceManifestSha256:sha(current),referenceManifest:previous,referenceManifestSha256:sha(previous),root,rootSha256:sha(root),layouts:layouts.length,controls,chosen,eachComparedWithFrozenColdWarmAndMutable:true,newAutonomousRuns:0};
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(out));
