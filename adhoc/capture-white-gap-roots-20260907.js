"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env"),evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const output="reports/iteration/white-gap-roots-20260907.json";
if(fs.existsSync(output))console.log("已有白方首差根，不重复重放");else{
  const rows=[];
  for(const [recordId,step]of [["7feb57c3.96e60c14",164],["aed4e5db.1f55695a",191]]){
    const record=JSON.parse(fs.readFileSync(`reports/research/${recordId}.full.json`)),save=JSON.parse(fs.readFileSync(record.savePath));
    const cp=JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    const env=createSimulationEnv();let fork;
    try{
      env.loadCheckpoint(cp);
      for(let i=41;i<step-1;i++){
        const expected=save.replaySteps[i],action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
        assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
      }
      const checkpoint=env.createCheckpoint();delete checkpoint.replaySteps;
      fork=env.createCounterfactualFork().composition;
      const observation=fork.projection({playerId:"player-white",role:"player"}).state,legalActions=env.legalActions();
      const input={focalSeatId:"player-white",rootObservation:observation,legalActions};
      rows.push({recordId,step,checkpoint,observation,legalActions,catalog:evaluator.enumerateSecondaryAgentRootTargets(input),roots:evaluator.selectSecondaryAgentRootActions(input),
        historicalSearch:record.metrics.searches.filter(s=>s.step===step),player:JSON.parse(checkpoint.coreState.committedState).players.players.find(p=>p.id==="player-white")});
    }finally{fork?.dispose();env.dispose();}
  }
  fs.writeFileSync(output,JSON.stringify({scope:"两份真实白方前态正式重放；目录均由当前1f55695a实现读取，不冒充基线目录",rows,passed:true},null,2)+"\n");
  console.log(JSON.stringify(rows.map(r=>({step:r.step,resources:r.player.resources,income:r.player.income,hand:r.player.hand,roots:r.roots.map(a=>a.summary)})),null,2));
}
