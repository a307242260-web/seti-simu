"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),util=require("node:util");
const {createSimulationEnv}=require("../randomizer/app/simulation-env"),evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const output="reports/iteration/white-round4-roots-20260907.json";
if(fs.existsSync(output))console.log("已有白方第四轮前态，不重复重放");else{
  const sources=JSON.parse(fs.readFileSync("reports/iteration/white-gap-roots-20260907.json")).rows,rows=[];
  for(const [index,step]of [[0,428],[1,458]]){
    const source=sources[index],record=JSON.parse(fs.readFileSync(`reports/research/${source.recordId}.full.json`)),save=JSON.parse(fs.readFileSync(record.savePath));
    const env=createSimulationEnv();let fork;
    try{
      env.loadCheckpoint(source.checkpoint);let previousIncome=source.player.income;const incomeEvents=[];
      for(let i=source.step-1;i<step-1;i++){
        const expected=save.replaySteps[i],action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
        assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
        assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
        const state=JSON.parse(env.createCheckpoint().coreState.committedState),player=state.players.players.find(p=>p.id==="player-white");
        if(!util.isDeepStrictEqual(previousIncome,player.income)){incomeEvents.push({step:i+1,round:expected.after.r,action,before:previousIncome,after:player.income});previousIncome=player.income;}
      }
      const checkpoint=env.createCheckpoint();delete checkpoint.replaySteps;
      const state=JSON.parse(checkpoint.coreState.committedState),player=state.players.players.find(p=>p.id==="player-white");
      fork=env.createCounterfactualFork().composition;
      const observation=fork.projection({playerId:"player-white",role:"player"}).state,legalActions=env.legalActions(),input={focalSeatId:"player-white",rootObservation:observation,legalActions};
      rows.push({recordId:source.recordId,step,checkpoint,player,pieces:state.pieces,planets:state.planets,incomeEvents,observation,legalActions,
        roots:evaluator.selectSecondaryAgentRootActions(input),catalog:evaluator.enumerateSecondaryAgentRootTargets(input),historicalSearch:record.metrics.searches.filter(s=>s.step===step)});
    }finally{fork?.dispose();env.dispose();}
  }
  fs.writeFileSync(output,JSON.stringify({scope:"从两份已验证白方第二轮前态正式重放到第四轮，记录收入变化和真实第四轮根；不运行AI",rows,passed:true},null,2)+"\n");
  console.log(JSON.stringify(rows.map(r=>({step:r.step,resources:r.player.resources,income:r.player.income,hand:r.player.hand,roots:r.roots.map(a=>a.summary),incomeEvents:r.incomeEvents.map(e=>({step:e.step,round:e.round,action:e.action.summary,after:e.after}))})),null,2));
}
