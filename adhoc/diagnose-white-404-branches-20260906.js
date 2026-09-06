"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const verify = process.argv.includes("--verify");
const output = verify ? "reports/iteration/white-404-overflow-fixed-20260906.json"
  : "reports/iteration/white-404-branches-20260906-v4.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const env = createSimulationEnv(), report = { scope: "真实404隔离分支直接执行普通发射/两次逆时针移动/下一己方回合/登陆黄色奖励；按现有AI不选取消，仅展开拿牌；不运行AI搜索", routes: [], failures: [], submissions: 0 };
  const cp = JSON.parse(fs.readFileSync("reports/iteration/company-before-step-404-20260906.json"));
  delete cp.replaySteps;
  const legal = fork => { const i = fork.inspect(); return i.phase === "awaiting_input" && i.session?.decision
    ? i.session.decision.choices : fork.inputPort.enumerateActions({ actorId: "player-white" }); };
  function submit(fork, action, chain) {
    assert.ok(action, `缺少路径动作 ${chain.join(" → ")}`);
    const i = fork.inspect(), d = i.session?.decision;
    const result = i.phase === "awaiting_input" && d
      ? fork.inputPort.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action }, { skipProjection: true })
      : fork.inputPort.submitAction(action, { skipProjection: true });
    report.submissions++;
    if (!result.ok) report.failures.push({ chain: [...chain, action.summary || action.actionId], action, failure: result.failure || result });
    return result.ok;
  }
  function walk(fork, chain, depth) {
    const inspection = fork.inspect();
    if (inspection.phase !== "awaiting_input") return;
    assert.ok(depth < 8 && report.submissions < 180, "诊断边界耗尽，不能称为遍历完成");
    const envelope = fork.lifecycle.save().envelope;
    for (const action of legal(fork).filter(a => a.target?.source !== "cancel")) {
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      if (submit(fork, action, chain)) walk(fork, [...chain, action.summary || action.actionId], depth + 1);
    }
    assert.equal(fork.lifecycle.restore(envelope).ok, true);
  }
  try {
    env.loadCheckpoint(cp);
    for (const useCard of [false]) for (const destination of ["venus"]) {
      const { composition: fork } = env.createCounterfactualFork();
      try {
        const start = legal(fork).find(a => useCard ? a.family === "play_card" && a.summary === "b_138.webp" : a.family === "launch");
        const chain = [useCard ? "b138发射" : "普通发射"];
        assert.ok(submit(fork, start, []));
        const move = legal(fork).find(a => a.family === "move" && a.target?.deltaX === -1);
        assert.ok(submit(fork, move, chain)); chain.push(move.summary);
        const payment = legal(fork).find(a => a.family === "choose_payment" && a.target?.choiceId === "energy");
        assert.ok(submit(fork, payment, chain)); chain.push(payment.summary);
        assert.ok(submit(fork, legal(fork).find(a => a.family === "end_turn"), chain));
        assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn("player-white").ok, true);
        chain.push("正式规划推进下一己方回合");
        const secondMove = legal(fork).find(a => a.family === "move"
          && (destination === "venus" ? a.target?.deltaX === -1 : a.target?.deltaY === 1));
        assert.ok(submit(fork, secondMove, chain)); chain.push(secondMove.summary);
        const secondPayment = legal(fork).find(a => a.family === "choose_payment" && a.target?.choiceId === "energy");
        assert.ok(submit(fork, secondPayment, chain)); chain.push(secondPayment.summary);
        const next = fork.lifecycle.save().envelope;
        report.routes.push({ useCard, destination, actions: legal(fork).map(a => ({ family: a.family, summary: a.summary })) });
        const endpoints = legal(fork).filter(a => a.family === "land");
        assert.equal(endpoints.length, 1, "必须真实进入登陆奖励链");
        for (const endpoint of endpoints) {
          assert.equal(fork.lifecycle.restore(next).ok, true);
          if (submit(fork, endpoint, chain)) walk(fork, [...chain, endpoint.summary], 0);
        }
      } finally { fork.dispose(); }
    }
    assert.equal(report.failures.length, verify ? 0 : 6);
    if (!verify) assert.ok(report.failures.every(f => f.failure.message === "数据池已满（6/6），本次数据被弃置"));
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    env.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, passed: report.passed, submissions: report.submissions,
      failures: report.failures.map(f => ({ action: f.action.summary, failure: f.failure })), error: report.error }, null, 2));
  }
}
