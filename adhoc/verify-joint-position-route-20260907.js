"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const cards = require("../randomizer/game/cards/effects");
const { jointPositionRoute } = require("./joint-position-route-20260907");
const input = "reports/iteration/company-movement-input-42-20260906.json";
const output = process.argv[2] || "reports/iteration/joint-position-route-20260907.json";
if (fs.existsSync(output)) console.log(`已有联合路线证据：${output}`);
else {
  const report = { scope: "真实42位置与正式公司/付费移动，目标谓词取正式dlc7模型；该根未持有dlc7，不注入卡牌、不声称实际机器人任务或任务奖励；核对联合位置的路线、共享额度和恢复",
    input, inputSha256: crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex"),
    stages: [], submissions: [], verified: false };
  const env = createSimulationEnv(); let fork;
  try {
    const cp = structuredClone(JSON.parse(fs.readFileSync(input)).checkpoint); delete cp.replaySteps;
    env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const condition = cards.getCardModel("dlc_7.png").tasks[0].condition;
    const legal = () => {
      const inspection = fork.inspect();
      return inspection.phase === "awaiting_input" ? inspection.session.decision.choices : fork.inputPort.enumerateActions();
    };
    const submit = action => {
      assert.ok(action); assert.deepEqual(legal().find(a => a.actionId === action.actionId), action);
      const before = fork.lifecycle.save().envelope;
      const run = () => {
        const i = fork.inspect();
        return action.phase === "conditional" ? fork.inputPort.submitDecision({
          decisionId: i.session.decision.decisionId, decisionVersion: i.session.decision.decisionVersion,
          ownerId: i.session.decision.ownerId, choice: action,
        }, { skipProjection: true }) : fork.inputPort.submitAction(action, { skipProjection: true });
      };
      const result = run(); assert.equal(result.ok, true, JSON.stringify(result.failure));
      const after = fork.lifecycle.save().envelope;
      assert.equal(fork.lifecycle.restore(before).ok, true);
      assert.deepEqual(run(), result);
      assert.deepEqual(fork.lifecycle.save().envelope, after);
      report.submissions.push({ action, restoredResubmissionEqual: true });
    };
    const query = label => {
      const root = fork.projection({ role: "simulation" }).state, before = JSON.stringify(root);
      const actor = root.players.players.find(p => p.id === "player-green"), i = fork.inspect();
      const payload = i.session?.currentEffect?.payload;
      const pending = payload?.abilityId === "huanyu_free_moves" && payload.step === "free_move";
      const available = legal().some(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves");
      const start = performance.now();
      const result = jointPositionRoute({ root, actor, condition, stage: pending ? "company" : "paid",
        cardPoints: 0, companyRemaining: pending ? payload.remaining : available ? 2 : 0,
        usedRocketIds: pending ? payload.usedRocketIds : [] });
      const wallMs = performance.now() - start;
      assert.equal(JSON.stringify(root), before);
      report.stages.push({ label, result, wallMs }); return result;
    };
    const initial = query("before-company");
    assert.equal(initial.paid, 1); assert.equal(initial.moves, 3);
    assert.ok(initial.choices.some(c => c.first.mode === "start-company"));
    submit(legal().find(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves"));
    const first = query("first-company-step");
    assert.equal(first.choices.length, 4);
    const chosen = first.choices.find(c => c.first.direction === "out").first;
    submit(legal().find(a => a.target.rocketId === chosen.rocketId && a.target.deltaX === chosen.deltaX && a.target.deltaY === chosen.deltaY));
    const second = query("second-company-step");
    assert.equal(second.status, "reachable", "第一艘到达火星不等于联合目标完成");
    assert.ok(second.choices.every(c => c.first.rocketId !== chosen.rocketId));
    assert.ok(second.choices.every(c => c.first.direction === "ccw"));
    const next = second.choices[0].first;
    submit(legal().find(a => a.target.rocketId === next.rocketId && a.target.deltaX === next.deltaX && a.target.deltaY === next.deltaY));
    const remaining = query("company-settled");
    assert.equal(remaining.paid, 1); assert.equal(remaining.moves, 1);
    assert.ok(remaining.choices.every(c => c.first.mode === "paid"));
    const last = remaining.choices[0].first;
    submit(legal().find(a => a.family === "move" && a.target.rocketId === last.rocketId && a.target.deltaX === last.deltaX && a.target.deltaY === last.deltaY));
    submit(legal().find(a => a.family === "choose_payment" && a.target.choiceId === "energy"));
    const final = query("different-planets-reached");
    assert.equal(final.status, "satisfied"); assert.equal(final.expanded, 0);
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { fork?.dispose(); env.dispose(); }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, submissions: report.submissions.length,
    stages: report.stages.map(s => ({ label: s.label, status: s.result.status, paid: s.result.paid,
      moves: s.result.moves, expanded: s.result.expanded, firsts: s.result.choices.map(c => c.first), wallMs: s.wallMs })), error: report.error }, null, 2));
}
