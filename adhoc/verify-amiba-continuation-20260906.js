"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const output = "reports/iteration/amiba-continuation-contract-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const report = { scope: "真实橙区两种首选：可信保存恢复与独立保存直接提交的逐步完整状态等价", routes: [] };
  const env = createSimulationEnv();
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    delete cp.replaySteps; env.loadCheckpoint(cp);
    const example = JSON.parse(fs.readFileSync("reports/iteration/amiba-choice-profile-210-20260906.json")).examples[1];
    for (const actionId of example.actionChain.slice(0, -1)) {
      const action = env.legalActions().find(a => a.actionId === actionId);
      assert.ok(action, actionId); assert.equal(env.step(action).ok, true);
    }
    const origin = env.createCounterfactualFork();
    const before = origin.composition.lifecycle.save().envelope;
    origin.composition.dispose();
    for (const firstSlot of ["orange_1", "orange_2"]) {
      const old = env.createCounterfactualFork(before), next = env.createCounterfactualFork(before);
      const route = { firstSlot, choices: [] };
      try {
        for (let index = 0; index < 3; index++) {
          const decision = next.composition.inspect().session?.decision;
          if (!decision?.choices.every(c => c.target?.symbolId)) break;
          const choice = index === 0 ? decision.choices.find(c => c.target.slotId === firstSlot) : decision.choices[0];
          assert.ok(choice);
          const a = old.composition.lifecycle.save({ trustedFork: true });
          const b = next.composition.lifecycle.save();
          assert.deepEqual(b.envelope, a.envelope, "两种保存必须给出相同branchKey输入");
          // envelope相等且actionId相同，正式branchKey必相同；两分支使用同一非恒定种子。
          const key = `${index}:${choice.actionId}:${JSON.stringify(a.envelope)}`;
          old.resetBranch(key); next.resetBranch(key);
          assert.equal(old.composition.lifecycle.restore(a.envelope, { trustedFork: true, silent: true, inPlace: true }).ok, true);
          for (const fork of [old, next]) {
            const d = fork.composition.inspect().session.decision;
            const raw = d.choices.find(c => c.actionId === choice.actionId); assert.ok(raw);
            const result = fork.composition.inputPort.submitDecision({ decisionId: d.decisionId,
              decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: raw });
            assert.equal(result.ok, true, result.message);
          }
          assert.deepEqual(next.composition.lifecycle.save().envelope, old.composition.lifecycle.save().envelope,
            "逐步奖励、符号位置、手牌、数据id、RNG、session与history必须一致");
          route.choices.push({ slotId: choice.target.slotId, symbolId: choice.target.symbolId, legalCount: decision.choices.length });
        }
        assert.ok(route.choices.length >= 2);
        report.routes.push(route);
      } finally { old.composition.dispose(); next.composition.dispose(); }
    }
    report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2)); }
}
