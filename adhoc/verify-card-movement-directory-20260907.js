"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const cards = require("../randomizer/game/cards/effects");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const { cardMovementPurposes, enumerateModelPurposes } = require("./card-movement-purpose-directory-20260907");
const output = "reports/iteration/card-movement-directory-20260907.json";
const sources = ["reports/iteration/company-movement-input-42-20260906.json",
  "reports/iteration/company-hot-prefix-20260907.json",
  "reports/iteration/current-movement-hotspots-20260907.json",
  "reports/iteration/turn-visit-routes-formal-20260907.json"];
if (fs.existsSync(output)) console.log(`已有需求目录核验：${output}`);
else {
  const [initial, hot, checkpoints, routes] = sources.map(p => JSON.parse(fs.readFileSync(p)));
  const report = { scope: "卡牌移动目的接入原型：全部242模型有限分类，真实42及后段/148/497实例和正式卡牌阶段读取；不是完整移动目录、AI搜索或性能验收",
    sources, sha256: Object.fromEntries(sources.map(p => [p, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")])),
    catalog: [], states: [], verified: false };
  try {
    for (const cardId of Object.keys(cards.MODELS)) {
      for (const entry of enumerateModelPurposes(cards.getCardModel(cardId))) {
        report.catalog.push({ cardId, kind: entry.kind, path: entry.path });
      }
    }
    report.counts = Object.fromEntries(["position", "trigger", "bonus", "movement-means"]
      .map(kind => [kind, report.catalog.filter(e => e.kind === kind).length]));
    assert.deepEqual(report.counts, { position: 8, trigger: 16, bonus: 11, "movement-means": 2 });
    function inspect(name, root) {
      const before = JSON.stringify(root), start = performance.now();
      const result = cardMovementPurposes(root, "player-green");
      const wallMs = performance.now() - start;
      assert.equal(JSON.stringify(root), before, "需求目录不得修改状态/RNG/实体序号");
      assert.equal(new Set(result.entries.map(e => e.id)).size, result.entries.length);
      for (const row of result.entries) {
        assert.ok(row.source.kind && row.source.ownerId && row.phase && row.id);
        if (row.source.kind === "card-instance") assert.ok(row.source.cardInstanceId && row.source.modelPath);
      }
      report.states.push({ name, result, wallMs }); return result;
    }
    for (const [name, serialized] of [["root42", initial.checkpoint.coreState.committedState],
      ["hot-prefix", hot.envelope.committedState]]) {
      const result = inspect(name, JSON.parse(serialized));
      const dlc11 = result.entries.filter(e => e.source.cardId === "dlc_11.png");
      assert.equal(dlc11.length, 1);
      assert.equal(dlc11[0].phase, "needs-position");
      assert.equal(dlc11[0].requiresPlay, true);
      assert.equal(dlc11[0].completion, "formal-task-claim");
    }
    for (const step of [148, 497]) {
      const cp = structuredClone(checkpoints.entries.find(e => e.step === step).checkpoint);
      delete cp.replaySteps;
      const env = createSimulationEnv(); let fork;
      try {
        env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const route = routes.rows.find(r => r.step === step && r.companyAllowance === 0);
        assert.ok(route);
        const prospective = inspect(`${step}:before-play`, fork.projection({ role: "simulation" }).state);
        const pending = prospective.entries.filter(e => e.kind === "bonus");
        assert.equal(pending.length, 1); assert.equal(pending[0].phase, "requires-play");
        for (let index = 0; index < route.inputs.length; index++) {
          const expected = route.inputs[index], inspection = fork.inspect();
          const legal = inspection.phase === "awaiting_input" ? inspection.session.decision.choices : fork.inputPort.enumerateActions();
          const actual = legal.find(a => a.actionId === expected.actionId);
          assert.deepEqual(actual, expected);
          const submitted = actual.phase === "conditional" ? fork.inputPort.submitDecision({
            decisionId: inspection.session.decision.decisionId,
            decisionVersion: inspection.session.decision.decisionVersion,
            ownerId: inspection.session.decision.ownerId, choice: actual,
          }, { skipProjection: true }) : fork.inputPort.submitAction(actual, { skipProjection: true });
          assert.equal(submitted.ok, true, JSON.stringify(submitted.failure));
          const result = inspect(`${step}:after-${index + 1}`, fork.projection({ role: "simulation" }).state);
          const registered = result.entries.filter(e => e.kind === "bonus");
          assert.equal(registered.length, 1, "打牌后只保留实际注册目的，不重复创建离手牌的待注册目的");
          assert.equal(registered[0].phase, "registered");
          if (step === 497 && index === 1) {
            assert.deepEqual(registered[0].bonus.usedKeys, ["saturn"]);
            assert.deepEqual(registered[0].bonus.claimedKeys, []);
          }
          if (index === route.inputs.length - 1) assert.ok(registered[0].bonus.claimedKeys.length > 0);
        }
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, counts: report.counts,
    states: report.states.map(s => ({ name: s.name, purposes: s.result.entries.length, wallMs: s.wallMs })), error: report.error }, null, 2));
}
