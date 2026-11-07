'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const fixture=process.argv[2],proof=process.argv[3],f=JSON.parse(fs.readFileSync(fixture)),p=JSON.parse(fs.readFileSync(proof)),seed=f.source.seed,seat=f.seatId;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
const save=()=>c.lifecycle.save().envelope;
function replay(route){for(const row of route){
 const d=c.inspect().session?.decision,menu=d?.choices||c.inputPort.enumerateActions({});
 const a=menu.find(a=>a.actionId===row.id);assert(a);assert.equal(a.actorId,seat);assert.equal(a.family,row.family);assert.deepEqual(a.target,row.target);
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));
}}
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=save();
 replay(p.knownPrefix);assert.deepEqual(save(),p.root);
 replay(p.steps);assert.deepEqual(save(),p.endEnvelope);
 assert(c.inputPort.enumerateActions({}).some(a=>a.actorId===seat&&a.family==='pass'));
 assert(c.lifecycle.restore(before).ok);assert.deepEqual(save(),before);
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const r={fixture,fixtureSha256:sha(fixture),proof,proofSha256:sha(proof),inputs:p.knownPrefix.length+p.steps.length,bothStateSessionRngExact:true,rootAndRngRestored:true,round:p.end.round,score:p.end.score,technologies:Object.keys(p.end.tech.ownedTiles),permanentIncome:p.end.income,newAutonomousRuns:0};
 fs.writeFileSync(process.argv[4],JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(r));
}finally{c.dispose();}
