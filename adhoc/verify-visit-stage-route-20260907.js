"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const { visitRoute } = require("./visit-stage-route-20260907");
const output = "reports/iteration/visit-stage-route-v4-20260907.json";
const sources = ["reports/iteration/turn-visit-routes-formal-20260907.json", "reports/iteration/current-movement-hotspots-20260907.json"];
if (fs.existsSync(output)) console.log(`已有阶段路线证据：${output}`);
else {
  const [routes, checkpoints] = sources.map(path => JSON.parse(fs.readFileSync(path)));
  const report = { scope: "真实148/497四条既有正式路线，逐阶段当前工作进度→单来源访问目的费用与全部同成本首步；公司额度沿用路线实验参数，不证明当前正式可启用，也不比较沿途其他奖励", sources,
    sha256: Object.fromEntries(sources.map(path => [path, crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")])),
    rows: [], verified: false };
  try {
    for (const route of routes.rows) {
      const env = createSimulationEnv(); let fork;
      try {
        const cp = structuredClone(checkpoints.entries.find(e => e.step === route.step).checkpoint);
        delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const actorId = route.inputs[0].actorId;
        const row = { step: route.step, companyAllowance: route.companyAllowance, stages: [] };
        report.rows.push(row);
        let usedCompany = false;
        for (let index = 0; index <= route.inputs.length; index++) {
          const inspection = fork.inspect(), effect = inspection.session?.currentEffect;
          const state = fork.projection({ role: "simulation" }).state;
          const bonus = state.turn.cardTurnEventBonuses.find(b => b.ownerId === actorId);
          const currentCard = effect?.payload?.cardEffect?.type === "card_move";
          const currentCompany = effect?.payload?.step === "free_move";
          if (bonus && (inspection.phase === "idle" || currentCard || currentCompany)) {
            const actor = state.players.players.find(p => p.id === actorId);
            const rocket = state.pieces.rockets.find(r => r.playerId === actorId && r.surface === "solar-board");
            assert.ok(rocket, "本组正式路线有唯一移动来源");
            const before = JSON.stringify(state);
            const start = performance.now();
            const result = visitRoute({ root: state, actor, rocket, bonus,
              cardPoints: currentCard ? effect.payload.remaining ?? effect.payload.cardEffect.options.movementPoints : 0,
              companyAvailable: route.companyAllowance === 1 && !usedCompany, companyPending: currentCompany });
            assert.equal(JSON.stringify(state), before, "路线读取不得写正式工作状态/RNG/序号");
            const next = route.inputs[index];
            const stage = { beforeInput: index, phase: inspection.phase,
              legalChoices: inspection.session?.decision?.choices.length ?? 0,
              bonus: structuredClone(bonus), result, wallMs: performance.now() - start };
            row.stages.push(stage);
            assert.equal(new Set(result.choices.map(c => JSON.stringify(c.first))).size, result.choices.length,
              "同一个首步只能输出一次，后续不同公司消耗路线保留为见证，不重复展开首步");
            if (index === route.inputs.length) assert.equal(result.status, "unreachable", "已领取的一次性访问奖励不得重新形成需求");
            else {
              assert.equal(result.status, "reachable");
              if (next.family === "industry") assert.ok(result.choices.some(c => c.first.mode === "company"));
              else if (next.target?.rocketId != null) assert.ok(result.choices.some(c =>
                c.first.rocketId === next.target.rocketId && c.first.deltaX === next.target.deltaX
                && c.first.deltaY === next.target.deltaY), "真实已验证路线下一步必须能推进该访问目的");
            }
          }
          if (index === route.inputs.length) break;
          const expected = route.inputs[index];
          const legal = inspection.phase === "awaiting_input" ? inspection.session.decision.choices : fork.inputPort.enumerateActions();
          const action = legal.find(a => a.actionId === expected.actionId); assert.deepEqual(action, expected);
          const submitted = action.phase === "conditional"
            ? fork.inputPort.submitDecision({ decisionId: inspection.session.decision.decisionId,
              decisionVersion: inspection.session.decision.decisionVersion,
              ownerId: inspection.session.decision.ownerId, choice: action }, { skipProjection: true })
            : fork.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(submitted.ok, true, JSON.stringify(submitted.failure));
          if (currentCompany && action.target?.rocketId != null) usedCompany = true;
        }
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, error: report.error,
    rows: report.rows.map(r => ({ step: r.step, company: r.companyAllowance,
      stages: r.stages.map(s => ({ beforeInput: s.beforeInput, status: s.result.status, paid: s.result.paid,
        moves: s.result.moves, expanded: s.result.expanded, choices: s.result.choices.length, wallMs: s.wallMs })) })) }, null, 2));
}
