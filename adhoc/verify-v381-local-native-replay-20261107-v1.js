'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createSeededRandom}=require('../randomizer/game/random'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const [coldInputs,coldRuns,directInputs,directRuns,output]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p));
const seed='seti-free-analyze-v1',seatId='player-white',k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
const replay=(start,row)=>{
 assert(c.lifecycle.restore(start).ok);assert.deepEqual(save(),start);
 for(const {action,ms,native} of row.accepted){
  assert(ms<=600&&native<=256);
  const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===action.actionId);
  assert(a);assert.deepEqual(a.target,action.target);
  const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
 }
 assert.deepEqual(save(),row.stop.envelope);
 return {inputs:row.accepted.length,score:row.score,stop:row.stop.reason};
};
try{
 const rows={};for(const [inp,run] of [[coldInputs,coldRuns],[directInputs,directRuns]]){
  const start=read(inp).rows;
  for(const [name,trial] of Object.entries(read(run).rows))rows[name]=replay(start[name].analyzed.e,trial);
 }
 assert.equal(rows['cold-after-analysis'].score,103);assert.equal(rows['cold-before-computer1'].score,103);
 assert.equal(rows['after-direct-credit'].score,103);assert.equal(rows['after-direct-energy'].score,97);
 fs.writeFileSync(output,JSON.stringify(rows,null,2)+'\n',{flag:'wx'});console.log(rows);
}finally{c.dispose();}
