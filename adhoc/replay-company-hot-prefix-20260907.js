"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-hot-prefix-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "以当前内核正式重放历史最多引用公司前置链，保存当前可达公司边界；非历史隐藏抽牌/RNG逐字等价，不运行AI，不注入资源", steps: [] };
  let fork;
  try {
    const entry = JSON.parse(fs.readFileSync("reports/iteration/company-entry-prefixes-20260907.json")).entries[0];
    report.prefixId = entry.prefixId;
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    for (const { action: expected } of entry.prefix.slice(0,-1)) {
      const i = fork.inspect();
      const choices = i.phase === "awaiting_input" ? i.session.decision.choices : fork.inputPort.enumerateActions();
      const action = choices.find(a=>a.actionId === expected.actionId);
      assert.ok(action, `正式前置动作必须存在：${expected.summary}`);
      const result = action.phase === "conditional"
        ? fork.inputPort.submitDecision({ decisionId: i.session.decision.decisionId,
          decisionVersion: i.session.decision.decisionVersion, ownerId: i.session.decision.ownerId, choice: action },{skipProjection:true})
        : fork.inputPort.submitAction(action,{skipProjection:true});
      assert.equal(result.ok,true,JSON.stringify(result.failure));
      report.steps.push({action,ok:result.ok});
      if (action.family === "end_turn") {
        const advanced = fork.counterfactualPort.advanceFocalPlanningTurn(action.actorId);
        assert.equal(advanced.ok,true,JSON.stringify(advanced));
      }
    }
    report.envelope = fork.lifecycle.save().envelope;
    report.observation = fork.projection({playerId:"player-green",role:"player"}).state;
    const company = fork.inputPort.enumerateActions().find(a=>a.actionId===entry.prefix.at(-1).action.actionId);
    assert.ok(company); assert.equal(fork.inputPort.submitAction(company,{skipProjection:true}).ok,true);
    report.companyChoices = fork.inspect().session.decision.choices;
    report.verified = true;
  } catch(error) {
    report.verified=false; report.error={message:error.message,stack:error.stack}; process.exitCode=1;
  } finally {
    fork?.dispose();env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({output,verified:report.verified,steps:report.steps.length,
      companyChoices:report.companyChoices?.map(c=>c.summary),error:report.error},null,2));
  }
}
