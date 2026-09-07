"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const { cardMovementRouteGuidance } = require("./card-movement-route-guidance-20260907");
const output = "reports/iteration/card-movement-guidance-20260907.json";
const sources = ["reports/iteration/company-movement-input-42-20260906.json",
  "reports/iteration/current-movement-hotspots-20260907.json",
  "reports/iteration/turn-visit-routes-formal-20260907.json"];
if (fs.existsSync(output)) console.log(`已有首步接入证据：${output}`);
else {
  const [initial, checkpoints, visits] = sources.map(p => JSON.parse(fs.readFileSync(p)));
  const report = { scope: "目录自动选择目的→共享阶段路线→当前正式合法首步；真实42公司两阶段及148/497既有访问路线；不运行AI、不证明沿途完整收益支配或完整移动覆盖",
    sources, sha256: Object.fromEntries(sources.map(p => [p, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")])),
    stages: [], submitted: 0, verified: false };
  try {
    for (const step of [42, 148, 497]) {
      const cp = structuredClone(step === 42 ? initial.checkpoint : checkpoints.entries.find(e => e.step === step).checkpoint);
      delete cp.replaySteps;
      const env = createSimulationEnv(); let fork;
      try {
        env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const legal = () => {
          const inspection = fork.inspect();
          return inspection.phase === "awaiting_input" ? inspection.session.decision.choices : fork.inputPort.enumerateActions();
        };
        const submit = expected => {
          const action = legal().find(a => a.actionId === expected.actionId); assert.deepEqual(action, expected);
          const inspection = fork.inspect();
          const result = action.phase === "conditional" ? fork.inputPort.submitDecision({
            decisionId: inspection.session.decision.decisionId,
            decisionVersion: inspection.session.decision.decisionVersion,
            ownerId: inspection.session.decision.ownerId, choice: action,
          }, { skipProjection: true }) : fork.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(result.ok, true, JSON.stringify(result.failure)); report.submitted++;
        };
        const query = label => {
          const root = fork.projection({ role: "simulation" }).state, before = JSON.stringify(root);
          const actions = legal(), inspection = fork.inspect(), start = performance.now();
          const result = cardMovementRouteGuidance({ root, actorId: "player-green", inspection, legalActions: actions });
          const wallMs = performance.now() - start;
          assert.equal(JSON.stringify(root), before, "路线与正式能力枚举不能修改工作状态/RNG/序号");
          for (const route of result.routes) {
            assert.ok(route.purposeId && route.source.kind && Number.isInteger(route.rocketId));
            for (const action of route.nextActions) assert.deepEqual(actions.find(a => a.actionId === action.actionId), action);
            assert.equal(new Set(route.nextActions.map(a => a.actionId)).size, route.nextActions.length);
          }
          report.stages.push({ step, label, legalCount: actions.length, wallMs, result });
          return result;
        };
        if (step === 42) {
          const initialResult = query("before-company");
          assert.equal(initialResult.routes.length, 2);
          for (const route of initialResult.routes) assert.equal(route.result.paid, 1);
          const company = legal().find(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves");
          assert.ok(company); submit(company);
          const first = query("company-first");
          assert.equal(first.routes.length, 2);
          for (const route of first.routes) assert.deepEqual(route.nextActions.map(a => a.payload.direction).sort(), ["cw", "out"]);
          const firstMove = first.routes[0].nextActions.find(a => a.payload.direction === "out"); submit(firstMove);
          const second = query("company-second");
          assert.deepEqual(fork.inspect().session.currentEffect.payload.usedRocketIds, [firstMove.target.rocketId]);
          const used = second.routes.find(r => r.rocketId === firstMove.target.rocketId);
          assert.ok(used.nextActions.every(a => a.target.skip === true), "已用来源只能结束公司后再付费，不能再领公司点");
          const other = second.routes.find(r => r.rocketId !== firstMove.target.rocketId);
          assert.ok(other.nextActions.some(a => a.target.rocketId === other.rocketId));
          submit(other.nextActions.find(a => a.target.rocketId === other.rocketId));
          query("company-settled");
        } else {
          const route = visits.rows.find(r => r.step === step && r.companyAllowance === 1);
          assert.ok(route);
          for (let i = 0; i <= route.inputs.length; i++) {
            const guidance = query(`before-input-${i}`), expected = route.inputs[i];
            if (i === 0) assert.equal(guidance.deferred.length, 1, "未注册奖励必须先执行正式打牌，不能预支");
            else if (i === route.inputs.length) assert.ok(guidance.routes.every(r => r.result.status === "unreachable"), "一次性奖励领取后没有新的移动首步");
            else if (guidance.stage !== "other-decision") {
              assert.ok(guidance.routes.some(r => r.nextActions.some(a => a.actionId === expected.actionId)),
                `真实${step}/${i}访问路线的下一正式输入必须保留`);
            }
            if (expected) submit(expected);
          }
        }
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, submitted: report.submitted,
    stages: report.stages.map(s => ({ step: s.step, label: s.label, stage: s.result.stage, legal: s.legalCount,
      routeCount: s.result.routes.length, choices: [...new Set(s.result.routes.flatMap(r => r.nextActions.map(a => a.actionId)))].length,
      deferred: s.result.deferred.length, wallMs: s.wallMs })), error: report.error }, null, 2));
}
