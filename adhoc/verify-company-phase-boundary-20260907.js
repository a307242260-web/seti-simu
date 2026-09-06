"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const ability = require("../randomizer/game/abilities/rocket"), rockets = require("../randomizer/game/rockets");
const output = "reports/iteration/company-phase-boundary-v2-20260907.json";
if (fs.existsSync(output)) console.log(`已有验证：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "当前可达公司热点逐一正式提交7个首步，核对额度owner/剩余阶段/禁止快速中断/结束后不可恢复；不执行AI或非法输入", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps;env.loadCheckpoint(cp);
    fork = env.createCounterfactualFork().composition;
    const input = JSON.parse(fs.readFileSync("reports/iteration/company-hot-prefix-20260907.json"));
    assert.equal(fork.lifecycle.restore(input.envelope).ok,true);
    const company = fork.inputPort.enumerateActions().find(a=>a.family === "industry" && a.target.abilityId === "huanyu_free_moves");
    assert.ok(company); assert.equal(fork.inputPort.submitAction(company,{skipProjection:true}).ok,true);
    const initial = fork.lifecycle.save().envelope, start = fork.inspect().session;
    assert.equal(start.decision.allowQuickActions,false);
    assert.equal(start.currentEffect.payload.remaining,2);
    const moves = start.decision.choices.filter(c=>c.target.rocketId != null);
    assert.equal(moves.length,7);
    for (const choice of moves) {
      assert.equal(fork.lifecycle.restore(initial).ok,true);
      const d = fork.inspect().session.decision;
      const submitted = fork.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice},{skipProjection:true});
      assert.equal(submitted.ok,true,JSON.stringify(submitted.failure));
      const session = fork.inspect().session, payload = session.currentEffect.payload;
      assert.equal(payload.step,"free_move");
      assert.equal(payload.remaining,1);
      assert.deepEqual(payload.usedRocketIds,[choice.target.rocketId]);
      assert.equal(session.decision.allowQuickActions,false);
      assert.ok(session.decision.choices.every(c=>c.target.rocketId !== choice.target.rocketId));
      const root = fork.projection({role:"simulation"}).state;
      const player = root.players.players.find(p=>p.id === d.ownerId);
      const moved = root.pieces.rockets.find(r=>r.id === choice.target.rocketId);
      const points = ability.getRequiredMovePointsFromCoordinate({...root,state:root},player,rockets.getRocketSectorCoordinate(moved));
      const skip = session.decision.choices.find(c=>c.target.skip);
      assert.ok(skip);
      const beforeSkip = fork.lifecycle.save().envelope;
      const endInput = {decisionId:session.decision.decisionId,decisionVersion:session.decision.decisionVersion,ownerId:d.ownerId,choice:skip};
      assert.equal(fork.inputPort.submitDecision(endInput,{skipProjection:true}).ok,true);
      assert.notEqual(fork.inspect().phase,"awaiting_input");
      assert.ok(!fork.inputPort.enumerateActions().some(a=>a.family === "industry" && a.target.abilityId === "huanyu_free_moves"));
      const after = fork.lifecycle.save().envelope;
      assert.equal(fork.lifecycle.restore(beforeSkip).ok,true);
      assert.equal(fork.inputPort.submitDecision(endInput,{skipProjection:true}).ok,true);
      assert.deepEqual(fork.lifecycle.save().envelope,after,"结束公司保存恢复后状态及序号一致");
      report.cases.push({first:choice,remaining:payload.remaining,usedRocketIds:payload.usedRocketIds,
        nextExitMovePoints:points,remainingChoices:session.decision.choices,allowQuickActions:false,finishedWithoutReopening:true,recoveryEqual:true});
    }
    assert.ok(report.cases.some(c=>c.nextExitMovePoints === 2),"覆盖进入小行星后下一步为2点的实际状态");
    report.verified = true;
  } catch(error) {
    report.verified=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;
  } finally {
    fork?.dispose();env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({output,verified:report.verified,cases:report.cases.map(c=>({first:c.first.summary,
      remaining:c.remaining,used:c.usedRocketIds,nextExitMovePoints:c.nextExitMovePoints})),error:report.error},null,2));
  }
}
