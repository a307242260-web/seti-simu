"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const ability = require("../randomizer/game/abilities/rocket"), rockets = require("../randomizer/game/rockets");
const input = "reports/iteration/turn-visit-routes-20260907.json";
const output = "reports/iteration/turn-visit-routes-formal-20260907.json";
if (fs.existsSync(output)) console.log(`已有正式路线证据：${output}`);
else {
  const fixtures = JSON.parse(fs.readFileSync("reports/iteration/current-movement-hotspots-20260907.json"));
  const routes = JSON.parse(fs.readFileSync(input));
  const report = { scope: "真实148/497直接打收益牌后按目的路线正式执行，不加资源，不结束回合；逐输入恢复重交一致，非AI性能验收", input, rows: [] };
  try {
    for (const route of routes.rows) {
      const env = createSimulationEnv(); let fork;
      try {
        const fixture = fixtures.entries.find(e => e.step === route.step), cp = structuredClone(fixture.checkpoint);
        // 检查点已是正式前缀后的状态；其附带轨迹不是从该状态再次执行的输入。
        delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const initial = fork.projection({ role: "simulation" }).state;
        const actor = initial.players.players.find(p => p.id === fixture.actorId);
        const card = actor.hand.find(c => c.cardId === route.cardId);
        const row = { step: route.step, companyAllowance: route.companyAllowance, inputs: [], moves: [] };
        const submit = action => {
          assert.ok(action, "目的路线每个输入必须在正式合法集中");
          const before = fork.lifecycle.save().envelope;
          const decision = fork.inspect().session?.decision;
          const run = () => action.phase === "conditional"
            ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
              ownerId: decision.ownerId, choice: action }, { skipProjection: true })
            : fork.inputPort.submitAction(action, { skipProjection: true });
          const result = run(); assert.equal(result.ok, true, JSON.stringify(result.failure));
          const after = fork.lifecycle.save().envelope;
          assert.equal(fork.lifecycle.restore(before).ok, true);
          assert.deepEqual(run(), result, "输入恢复重交结果与事件一致");
          assert.deepEqual(fork.lifecycle.save().envelope, after, "恢复重交状态/RNG/序号一致");
          row.inputs.push(action);
        };
        const choices = () => fork.inspect().session.decision.choices;
        const finish = () => {
          if (fork.inspect().phase === "awaiting_input") submit(choices().find(a => a.target.skip));
          assert.notEqual(fork.inspect().phase, "awaiting_input");
        };
        submit(fork.inputPort.enumerateActions().find(a => a.family === "play_card" && a.target.cardInstanceId === card.id));
        assert.equal(fork.inspect().session.decision.allowQuickActions, false);
        for (const step of route.path) {
          if (step.mode === "finish-card") { finish(); continue; }
          const d = ability.MOVE_DIRECTIONS.find(d => d.id === step.direction);
          if (step.mode === "card") {
            submit(choices().find(a => a.target.rocketId === route.rocketId && a.target.deltaX === d.deltaX && a.target.deltaY === d.deltaY));
          } else {
            finish();
            if (step.mode === "company") {
              submit(fork.inputPort.enumerateActions().find(a => a.family === "industry" && a.target.abilityId === "huanyu_free_moves"));
              submit(choices().find(a => a.target.rocketId === route.rocketId && a.payload.direction === step.direction));
              finish();
            } else {
              assert.equal(step.mode, "paid");
              submit(fork.inputPort.enumerateActions().find(a => a.family === "move" && a.target.rocketId === route.rocketId
                && a.target.deltaX === d.deltaX && a.target.deltaY === d.deltaY));
              if (fork.inspect().phase === "awaiting_input") submit(choices().find(a => a.family === "choose_payment"
                && a.target.kind === "move-payment" && a.target.cardIds.length === 0));
            }
          }
          const state = fork.projection({ role: "simulation" }).state;
          const player = state.players.players.find(p => p.id === actor.id);
          assert.deepEqual(rockets.getRocketSectorCoordinate(state.pieces.rockets.find(r => r.id === route.rocketId)), step.to);
          row.moves.push({ mode: step.mode, direction: step.direction, to: step.to,
            scoreGain: player.resources.score - actor.resources.score, bonuses: state.turn.cardTurnEventBonuses });
        }
        finish();
        const final = fork.projection({ role: "simulation" }).state;
        row.finalResources = final.players.players.find(p => p.id === actor.id).resources;
        row.scoreGain = row.finalResources.score - actor.resources.score;
        assert.equal(row.scoreGain, route.step === 148 ? 4 : 3);
        if (route.step === 497) assert.equal(row.moves[0].scoreGain, 0, "第一行星只推进进度，不提前得分");
        assert.ok(row.inputs.every(a => a.family !== "end_turn"));
        row.recoveryEqual = true; report.rows.push(row);
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) {
    report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified,
    rows: report.rows.map(r => ({ step: r.step, company: r.companyAllowance, inputs: r.inputs.length,
      scoreGain: r.scoreGain, resources: r.finalResources })), error: report.error }, null, 2));
}
