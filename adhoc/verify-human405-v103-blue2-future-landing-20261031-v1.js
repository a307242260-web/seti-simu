'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const values=require('../randomizer/game/ai/state-value');
const source='reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step36-20261031-v1.json';
const report=JSON.parse(fs.readFileSync(source));
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(report.rawPath))).find(r=>r.name==='teacher-first');
const output='reports/ai-foundation-20261023/human405-v103-blue2-native-future-landing-20261031-v1.json';
assert(!fs.existsSync(output),'Reuse native control');
const seed='seti-free-analyze-v1',seatId='player-white';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(raw.envelope).ok);
const original=c.lifecycle.save().envelope,fork=c.counterfactualPort.createFork(original,{branchKey:'human405-blue2-mission-control',restoreRandomState:true}),n=fork.composition||fork,steps=[];
const observe=()=>n.projection({role:'player',playerId:seatId}).state;
function submit(predicate){const d=n.inspect().session?.decision,a=(d?.choices||n.inputPort.enumerateActions({})).find(predicate);assert(a);
 const r=d?n.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?n.inputPort.submitQuickAction(a):n.inputPort.submitAction(a);assert(r.ok);
 const view=observe();steps.push({family:a.family,summary:a.summary,target:a.target,value:values.evaluateStateValue(view,seatId),resources:view.publicState.players.find(p=>p.playerId===seatId)});}
try{
 const before=observe(),start=values.evaluateStateValue(before,seatId),forecast={value:start.components.probePotential};
 assert.equal(start.total,62);assert.equal(forecast.value,8.5);
 submit(a=>a.family==='quick_trade'&&a.target.tradeId==='credits-for-energy');
 submit(a=>a.family==='land');
 submit(a=>a.target?.kind==='planet-reward-alien-trace'&&a.target.alienSlotId===1&&a.target.traceType==='yellow');
 const after=observe(),value=values.evaluateStateValue(after,seatId);assert.equal(value.total,start.total);
 assert.equal(value.components.probePotential,0);
 const missionInputs=steps.length;
 submit(a=>a.family==='place_data');submit(a=>a.target?.target==='blueBonus'&&a.target.blueSlot===1);
 const afterBlue=values.evaluateStateValue(observe(),seatId);
 assert.deepEqual(c.lifecycle.save().envelope,original);
 const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(p)]));
 const result={schemaVersion:'seti-human405-funded-future-landing-native-control-v1',baseCommit:'1cd44bde189c9ce26f976bc4c9dd08391ecbde86',sourceRevision:'v103-unadmitted',source,sourceSha256:sha(source),sourceHashes,
  before:start,forecast,afterNativeMission:value,afterConsumedProbeForecast:0,afterBlue,missionInputs,steps,sourceRootAndRngUnchanged:true,
  scope:'Native counterfactual inputPort execution of one currently funded future white mission after the recorded blue2 income turn. No state patch, AI game rerun or unknown reward identity forecast. Additional blue-data follow-up is reported separately.',productionAdmitted:false};
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,before:start.total,forecast:forecast.value,after:value.total,afterBlue:afterBlue.total,missionInputs,steps:steps.map(s=>s.summary)}));
}finally{n.dispose();c.dispose();}
