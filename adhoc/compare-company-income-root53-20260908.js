"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const projectRequire=require("node:module").createRequire("/private/tmp/seti-company-base-income-scoring-20260908/adhoc/check.js");
const evaluator=projectRequire("../randomizer/game/ai/expected-score-evaluator");
const outcomeModel=projectRequire("../randomizer/game/ai/outcome-model");
const {buildRuleObservation}=projectRequire("../randomizer/app/rule-observation");
const output="reports/iteration/company-income-root53-comparison-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,scope:"仅比较两个已保存优胜计划，并用同一正式观察计分修正其评分输入；不重跑搜索，不证明其他叶完整性",plans:[]};
try{
  const records=["baseline","candidate"].map(tag=>JSON.parse(fs.readFileSync(`reports/iteration/company-income-root53-${tag}-20260908.json`)));
  assert.ok(records.every(r=>r.passed));
  assert.equal(records[0].rootEnvelope.committedState,records[1].rootEnvelope.committedState);
  for(const r of records){
    const root=outcomeModel.createDecisionObservation(r.observation);
    const action=r.leaf.planSteps[0].action;
    const evaluate=(rootObservation,leaf)=>evaluator.evaluateOutcome({seatId:"player-brown",actionOutcomes:[{
      schemaVersion:evaluator.OUTCOME_SCHEMA_VERSION,status:"settled",actionId:action.actionId,
      rootObservation,leaves:[leaf],
    }]},action,{});
    const reproduced=evaluate(root,r.leaf);
    assert.equal(reproduced.value,r.evaluation.value,"同一保存叶必须复现原评分");
    const update=(observation,envelope)=>{
      const copy=structuredClone(observation);
      const state=JSON.parse(envelope.committedState);
      const actual=buildRuleObservation(state,null,"player-brown").publicState.players.find(p=>p.playerId==="player-brown");
      copy.outcomeProjection.scoring.realizedScore=actual.score;
      copy.outcomeProjection.scoring.securedEndGameBonus=actual.securedEndGameBonus;
      return copy;
    };
    const corrected=evaluate(update(root,r.rootEnvelope),{...r.leaf,observation:update(r.leaf.observation,r.verifiedEnvelope)});
    report.plans.push({tag:r.tag,originalValue:reproduced.value,correctedValue:corrected.value,
      originalScoreDelta:reproduced.actualScoreDelta,correctedScoreDelta:corrected.actualScoreDelta,
      originalBonus:reproduced.leafValue.securedEndGameBonus,correctedBonus:corrected.leafValue.securedEndGameBonus,
      incomeValue:corrected.incomeValue,techValue:corrected.techValue,
      actions:r.leaf.planSteps.map(s=>s.action),nodes:r.diagnostics.executedNodeCount,inputs:r.diagnostics.successfulInputSubmissionCount,ms:r.wallMs});
  }
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,plans:report.plans.map(({actions,...p})=>p)},null,2));}
