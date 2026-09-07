"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),zlib=require("node:zlib"),util=require("node:util");
const {Readable}=require("node:stream"),{pipeline}=require("node:stream/promises");
const {execFileSync}=require("node:child_process");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const base="reports/iteration/current-baseline-gap-42-20260907";
async function main(){
  if(fs.existsSync(`${base}.json`)||fs.existsSync(`${base}.capture.jsonl.gz`))return console.log("已有当前版本首差证据，不重跑");
  execFileSync("git",["diff","--exit-code","1f55695a","--","randomizer","assets"]);
  const records=["7feb57c3.96e60c14.full.json","aed4e5db.1f55695a.full.json"].map(name=>({...JSON.parse(fs.readFileSync(`reports/research/${name}`)),name}));
  const saves=records.map(r=>JSON.parse(fs.readFileSync(r.savePath)));
  for(let i=0;i<41;i++){assert.deepEqual(saves[0].replaySteps[i].action,saves[1].replaySteps[i].action);assert.deepEqual(saves[0].replaySteps[i].after,saves[1].replaySteps[i].after);}
  const cp=JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
  const env=createSimulationEnv();let primer;
  try{
    env.reset(cp.config);
    for(let i=0;i<41;i++){
      if(i===23){
        const checkpoint=env.createCheckpoint();delete checkpoint.replaySteps;
        const start=performance.now(),result=env.runHeuristicPolicyDecision();assert.equal(result.ok,true);
        primer={step:24,wallMs:performance.now()-start,diagnostics:env.getCounterfactualDiagnostics()};
        assert.deepEqual(primer.diagnostics.failedNodeCountByCode,{});env.loadCheckpoint(checkpoint);
        console.log(JSON.stringify({step:24,stage:"真实前序搜索",nodes:primer.diagnostics.executedNodeCount,inputs:primer.diagnostics.successfulInputSubmissionCount}));
      }
      const expected=saves[1].replaySteps[i],action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
      assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
    }
    assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,cp.coreState.compositionEnvelope);
    const legalActions=env.legalActions(),start=performance.now(),result=env.runHeuristicPolicyDecision(),wallMs=performance.now()-start,diagnostics=env.getCounterfactualDiagnostics();
    async function* lines(){
      const {actionOutcomes,...decision}=result;
      yield JSON.stringify({type:"header",codeCommit:"1f55695a",checkpoint:cp,legalActions,result:decision,wallMs,diagnostics,primer})+"\n";
      for(const outcome of actionOutcomes){const {leaves,...metadata}=outcome;yield JSON.stringify({type:"outcome",outcome:metadata})+"\n";for(const leaf of leaves||[])yield JSON.stringify({type:"leaf",actionId:outcome.actionId,leaf})+"\n";}
    }
    await pipeline(Readable.from(lines()),zlib.createGzip(),fs.createWriteStream(`${base}.capture.jsonl.gz`));
    assert.equal(result.ok,true);assert.deepEqual(diagnostics.failedNodeCountByCode,{});
    assert.equal(result.policyDecision.actionId,saves[1].replaySteps[41].action.actionId);
    const historical=records[1].metrics.searches.find(s=>s.step===42&&s.kind==="strategic").diagnostics;
    assert.equal(diagnostics.executedNodeCount,historical.executedNodeCount);
    assert.equal(diagnostics.successfulInputSubmissionCount,historical.successfulInputSubmissionCount);
    const observation=result.actionOutcomes.find(o=>o.rootObservation).rootObservation;
    const context={seatId:"player-green",legalActions,observation,actionOutcomes:result.actionOutcomes};
    const old=JSON.parse(fs.readFileSync("reports/iteration/asteroid-modifier-decision-42-20260907.json"));
    const oldIds=old.steps.map(s=>s.action.actionId);
    const candidates=legalActions.filter(a=>["industry","place_data"].includes(a.family)).map(action=>{
      const outcome=result.actionOutcomes.find(o=>o.actionId===action.actionId),evaluation=evaluator.evaluateAction(context,action);
      const selected=outcome.leaves.find(l=>l.leafId===evaluation.selectedLeafId);
      assert.ok(selected);
      return {action,evaluation,leafCount:outcome.leaves.length,plan:selected.planSteps.map(s=>s.action),
        oldWinningPlanRetained:outcome.leaves.some(l=>util.isDeepStrictEqual((l.planSteps||[]).map(s=>s.action.actionId),oldIds))};
    });
    const finals=saves.map(s=>JSON.parse(s.committedState).match.finalScores);
    const seatDeltas=finals[0].map(p=>{const q=finals[1].find(q=>q.playerId===p.playerId);return {seat:p.playerId,before:p.totalScore,after:q.totalScore,delta:q.totalScore-p.totalScore,baseDelta:q.baseScore-p.baseScore,tileDelta:q.tileScore-p.tileScore,cardDelta:q.cardScore-p.cardScore};});
    const output={scope:"仅比较109.5基线与当前108.5的首差42；按真实白24调用后搜索42，完整局不重跑",codeCommit:"1f55695a",records:records.map(r=>r.name),firstDivergence:42,wallMs,diagnostics,primer,candidates,seatDeltas,plan:result.plan,passed:true};
    fs.writeFileSync(`${base}.json`,JSON.stringify(output,null,2)+"\n");
    console.log(JSON.stringify({wallMs,nodes:diagnostics.executedNodeCount,inputs:diagnostics.successfulInputSubmissionCount,candidates:candidates.map(r=>({family:r.action.family,score:r.evaluation.score,leafId:r.evaluation.selectedLeafId,leaves:r.leafCount,oldWinningPlanRetained:r.oldWinningPlanRetained})),seatDeltas},null,2));
  }finally{env.dispose();}
}
main().catch(error=>{fs.writeFileSync(`${base}.failure.json`,JSON.stringify({message:error.message,stack:error.stack},null,2)+"\n");console.error(error);process.exitCode=1;});
