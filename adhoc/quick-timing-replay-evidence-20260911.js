"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source,"utf8"));
const env = createSimulationEnv();
const scans = [], deferred = [];
let activeScan = null;
function playerState(id) {
  const state = env.createCheckpoint().coreState.committedState;
  const root = typeof state === "string" ? JSON.parse(state) : state;
  return root.players.players.find(p => p.id === id);
}
try {
  env.reset({seed:save.seed,activePlayerCount:4,aiDifficulty:"laughable"});
  for (const step of save.replaySteps) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action, `正式回放缺动作：${step.stepIndex+1}`);
    if (activeScan && action.phase !== "conditional") {
      const p = playerState(activeScan.actor);
      scans.push({...activeScan,poolAfter:p.dataState.poolTokens.length,
        discardedAfter:p.dataState.discardedCount});
      activeScan = null;
    }
    if (action.family === "scan") {
      const p = playerState(action.actorId);
      activeScan = {step:step.stepIndex+1,actor:action.actorId,poolBefore:p.dataState.poolTokens.length,
        discardedBefore:p.dataState.discardedCount};
    }
    if ([36,38].includes(step.stepIndex+1)) {
      const p = playerState(action.actorId);
      assert(p.mainActionCompleted);
      const fork = env.createCounterfactualFork(null,{branchKey:`defer-${step.stepIndex+1}`});
      const comp = fork.composition || fork;
      try {
        const end = comp.inputPort.enumerateActions({}).find(a=>a.family==="end_turn");
        assert(end);
        assert.equal(comp.inputPort.submitAction(end).ok,true);
        assert.equal(comp.counterfactualPort.advanceFocalPlanningTurn(action.actorId).ok,true);
        const legal = comp.inputPort.enumerateActions({});
        assert(legal.some(a=>a.family==="place_data"));
        const viewer = {playerId:action.actorId,viewerId:"quick-timing-proof",role:"player"};
        const obs = comp.projection(viewer).state;
        const after = obs.publicState.players.find(x=>x.playerId===action.actorId);
        assert.equal(after.availableData,p.dataState.poolTokens.length);
        deferred.push({step:step.stepIndex+1,pool:p.dataState.poolTokens.length,
          nextTurnPlaceDataLegal:true,scope:"正式end_turn加不模拟对手的可信focal推进；不推断对手抢占或被动收益"});
      } finally {comp.dispose();}
    }
    const result = env.step(action);
    assert.equal(result.ok,true,`回放失败${step.stepIndex+1}`);
  }
  assert(env.isTerminal());
  console.log(JSON.stringify({source,terminal:true,scans,deferred},null,2));
} finally {env.dispose();}
