"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/company-stage-42-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实42公司首次六方向各执行一次，只读第二阶段合法描述符；不运行搜索，不把阶段样本外推全部公司", cases: [] };
  let fork;
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/company-movement-input-42-20260906.json")).checkpoint;
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const company = fork.inputPort.enumerateActions().find(a=>a.family === "industry");
    assert.equal(company.target.abilityId,"huanyu_free_moves");
    assert.equal(fork.inputPort.submitAction(company,{skipProjection:true}).ok,true);
    const start = fork.lifecycle.save().envelope;
    const first = fork.inspect().session.decision.choices.filter(a=>a.target.rocketId != null);
    assert.equal(first.length,6);
    for(const action of first) {
      assert.equal(fork.lifecycle.restore(start).ok,true);
      const d = fork.inspect().session.decision;
      assert.equal(fork.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,
        ownerId:d.ownerId,choice:action},{skipProjection:true}).ok,true);
      const i = fork.inspect(), second = i.session.decision.choices;
      assert.ok(second.some(a=>a.target.skip === true));
      assert.ok(second.filter(a=>a.target.rocketId != null).every(a=>a.target.rocketId !== action.target.rocketId));
      assert.equal(second.filter(a=>a.target.rocketId != null).length,3);
      report.cases.push({ first: action, second, ownerPayload: i.session.currentEffect.payload });
    }
    report.passed = true;
  } catch(error) {report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally {fork?.dispose();env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({output,passed:report.passed,cases:report.cases.length,error:report.error}));}
}
