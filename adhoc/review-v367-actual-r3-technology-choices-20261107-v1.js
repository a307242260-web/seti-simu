'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const dir='reports/ai-foundation-20261107/',candidate=dir+'v367-canonical-default-weights-v1/',gateFile=candidate+'serial-cold-gate-20261107-v1.json',controlFile=dir+'v335-research-layout-key-v1/v323-r3-blue1-purple2-equal-corner-20261107-v1.json.gz',officialFile='reports/research/614d33af.720da076.quick-400.json';
const read=f=>JSON.parse(fs.readFileSync(f)),readRaw=f=>JSON.parse(z.gunzipSync(fs.readFileSync(f))),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const gate=read(gateFile),control=readRaw(controlFile),official=read(officialFile),historical=read(official.savePath),choices=[];
assert(gate.allClosed&&gate.measuredUniqueRoots===825);assert.equal(control.recordSha256,sha(officialFile));
for(const step of [186,187,189,194]){
 const row=gate.rows.find(r=>r.label==='v323-actual-r3-step-'+step);assert(row?.decisionGatePassed);
 const f=read(row.fixture),e=read(row.evidence);assert.equal(sha(e.rawPath),e.rawSha256);
 const raw=readRaw(e.rawPath),seed=f.source.seed,seat=f.seatId,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});
 const c=k.composition;try{
  assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope;
  const menu=c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
  const choice=menu.find(a=>a.actionId===row.actionId);assert(choice);
  const originalAction=historical.replaySteps[step-1].action,originalSearch=official.metrics.searches.find(a=>a.step===step);
  assert.equal(originalSearch.actionId,originalAction.actionId);
  const roots=raw.roots.map(x=>({actionId:x.actionId,target:menu.find(a=>a.actionId===x.actionId)?.target??null,value:x.value,completion:x.completion}));
  choices.push({step,fixture:row.fixture,fixtureSha256:sha(row.fixture),coldEvidence:row.evidence,original:{actionId:originalAction.actionId,target:originalAction.target,value:originalSearch.value},candidate:{actionId:row.actionId,target:choice.target,value:row.value,nativeInputs:row.nativeInputs,milliseconds:row.milliseconds},roots});assert.deepEqual(c.lifecycle.save().envelope,original);
 }finally{c.dispose();}
}
assert.equal(choices[1].candidate.target.tileId,'blue1');assert.equal(choices[1].candidate.target.blueSlot,3);
assert.equal(choices[1].original.target.tileId,'purple1');assert.equal(choices[3].candidate.target.position,4);assert.equal(choices[3].original.target.position,2);
const arms=control.branches.map(({earlyTech,earlySlot,research,end})=>({earlyTech,earlySlot,research,score:end.score,tech:end.tech,wallet:end.wallet,income:end.income,data:end.data,hand:end.hand,rockets:end.rockets,scan:end.scan,trace:end.trace,projected:end.projected}));
const blue=arms.find(x=>x.earlyTech==='blue1'&&x.earlySlot===3),purple=arms.find(x=>x.earlyTech==='purple2');
assert.equal(blue.score,91);assert.equal(purple.score,91);assert.deepEqual(blue.income,purple.income);assert.equal(Object.keys(blue.tech.ownedTiles).length,4);assert.equal(Object.keys(purple.tech.ownedTiles).length,5);
assert.equal(blue.research.available+blue.research.heldCorner,5);assert.equal(purple.research.available+purple.research.heldCorner,6);
const summary={scope:'Same archived Native roots and fixed official-route fork; independently decoded legal menus. Cold value differences do not imply an autonomous round endpoint.',gate:gateFile,gateSha256:sha(gateFile),official:officialFile,officialSha256:sha(officialFile),fixedControl:controlFile,fixedControlSha256:sha(controlFile),choices,arms,newNativeInputs:0,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(process.argv[2],JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({r3Tech:choices[1].candidate.target,techRoots:choices[1].roots.filter(x=>x.value!==null&&['blue1','purple1','purple2'].includes(x.target?.tileId)),r3Trace:choices[3].candidate.target,arms:arms.map(x=>({tile:x.earlyTech,score:x.score,technologies:Object.keys(x.tech.ownedTiles).length,availableForResearch:x.research.available+x.research.heldCorner})),newAutonomousRuns:0}));
