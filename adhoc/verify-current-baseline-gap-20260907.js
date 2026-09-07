"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),util=require("node:util");
const {createSimulationEnv}=require("../randomizer/app/simulation-env"),evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const output="reports/iteration/current-baseline-gap-verification-20260907.json";
if(fs.existsSync(output))console.log("已有首差核验，不重复执行");else{
  const evidence=JSON.parse(fs.readFileSync("reports/iteration/current-baseline-gap-42-20260907.json"));
  const cp=JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
  const oldAdmission=JSON.parse(fs.readFileSync("reports/iteration/movement-root-admission-42-20260907.json")).rows.find(r=>r.code==="96e60c14");
  const rows=[];let currentRoots;
  for(const candidate of evidence.candidates){
    const env=createSimulationEnv();let fork;
    try{
      env.loadCheckpoint(cp);fork=env.createCounterfactualFork().composition;
      const input={focalSeatId:"player-green",rootObservation:fork.projection({playerId:"player-green",role:"player"}).state,legalActions:fork.inputPort.enumerateActions()};
      assert.deepEqual(input.legalActions,oldAdmission.legalActions);
      currentRoots=evaluator.selectSecondaryAgentRootActions(input).map(a=>a.actionId);
      let pending=false;const actions=[];
      for(const expected of candidate.plan){
        const state=fork.inspect(),legal=state.phase==="awaiting_input"?state.session.decision.choices:fork.inputPort.enumerateActions();
        const action=legal.find(a=>a.actionId===expected.actionId);assert.ok(action,`正式计划动作缺失:${expected.actionId}`);
        const d=state.session?.decision;
        const result=action.phase==="conditional"?fork.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action},{skipProjection:true}):fork.inputPort.submitAction(action,{skipProjection:true});
        assert.equal(result.ok,true);actions.push(action.actionId);
        if(action.family==="end_turn")pending=true;
        if(pending){const advance=fork.counterfactualPort.advanceFocalPlanningTurn("player-green");if(advance.ok)pending=false;else assert.equal(advance.code,"COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");}
      }
      const envelope=fork.lifecycle.save().envelope,player=JSON.parse(envelope.committedState).players.players.find(p=>p.id==="player-green"),e=candidate.evaluation;
      assert.equal(player.resources.score,e.leafValue.realizedScore);
      assert.deepEqual(player.income,e.leafValue.infrastructure.income);
      rows.push({family:candidate.action.family,inputs:actions.length,actions,score:e.score,realizedDelta:e.leafValue.realizedScore-e.rootValue.realizedScore,
        currentEndGameBonus:e.leafValue.securedEndGameBonus,incomeValue:e.incomeValue,otherInfrastructure:e.infrastructureValue-e.incomeValue,publicityValue:e.publicityResearchValue,envelope});
    }finally{fork?.dispose();env.dispose();}
  }
  assert.equal(oldAdmission.roots.some(a=>a.family==="industry"),false);assert.ok(currentRoots.includes("industry:5bda1856"));
  assert.equal(evidence.candidates.find(c=>c.action.family==="place_data").oldWinningPlanRetained,true);
  const records=evidence.records.map(name=>JSON.parse(fs.readFileSync(`reports/research/${name}`))),saves=records.map(r=>JSON.parse(fs.readFileSync(r.savePath)));
  const states=saves.map(s=>JSON.parse(s.committedState));
  const seats=evidence.seatDeltas.map(delta=>{
    const sequences=saves.map(s=>s.replaySteps.map((a,i)=>({...a,step:i+1})).filter(a=>a.actorPlayerId===delta.seat));
    let i=0;const semantics=a=>({family:a.family,target:a.target,payload:a.payload});
    while(i<Math.min(...sequences.map(s=>s.length))&&util.isDeepStrictEqual(semantics(sequences[0][i].action),semantics(sequences[1][i].action)))i++;
    return {...delta,firstOwnActionDifference:sequences.map(s=>({step:s[i].step,round:s[i].after.r,action:s[i].action})),tiles:states.map(s=>s.match.finalScores.find(p=>p.playerId===delta.seat).tiles),scoreSources:states.map(s=>s.players.players.find(p=>p.id===delta.seat).scoreSources)};
  });
  fs.writeFileSync(output,JSON.stringify({scope:"当前108.5与109.5首差42：根准入、旧叶保留、两条计划正式重放及分席差额；不外推全部终局因果",passed:true,oldRoots:oldAdmission.roots.map(a=>a.actionId),currentRoots,rows,seats},null,2)+"\n");
  console.log(JSON.stringify({passed:true,rows:rows.map(({envelope,actions,...r})=>r),seats:seats.map(s=>({seat:s.seat,delta:s.delta,first:s.firstOwnActionDifference.map(a=>({step:a.step,action:a.action.summary}))}))},null,2));
}
