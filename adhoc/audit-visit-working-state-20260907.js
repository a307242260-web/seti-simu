"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const cards = require("../randomizer/game/cards/effects");
const residual = require("../randomizer/game/effects/residual-domain-session");
const input = "reports/iteration/turn-visit-routes-formal-20260907.json";
const output = "reports/iteration/visit-working-state-20260907.json";
if (fs.existsSync(output)) console.log(`已有工作状态证据：${output}`);
else {
  const raw = fs.readFileSync(input), routes = JSON.parse(raw);
  const checkpoints = JSON.parse(fs.readFileSync("reports/iteration/current-movement-hotspots-20260907.json"));
  const report = { scope: "真实148/497既有路线的当前工作投影与committedState对照、奖励来源读取和进度；不运行AI、不证明全部模型来源唯一", input,
    inputSha256: crypto.createHash("sha256").update(raw).digest("hex"), rows: [] };
  try {
    for (const route of routes.rows.filter(r => r.companyAllowance === 0)) {
      const env = createSimulationEnv(); let fork;
      try {
        const cp = structuredClone(checkpoints.entries.find(e => e.step === route.step).checkpoint);
        delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
        const actorId = route.inputs[0].actorId, sourceCardInstanceId = route.inputs[0].target.cardInstanceId;
        const row = { step: route.step, sourceCardInstanceId, stages: [] };
        const inspect = label => {
          const state = fork.projection({ role: "simulation" }).state, session = fork.inspect().session;
          const committed = JSON.parse(fork.lifecycle.save().envelope.committedState);
          const player = state.players.players.find(p => p.id === actorId);
          const active = state.turn.cardTurnEventBonuses;
          const sources = [...player.hand, ...player.reservedCards, ...state.cards.discardPile];
          const before = JSON.stringify(active);
          const progress = active.map(bonus => {
            const matches = sources.filter(card => cards.getCardModel(card)?.playEffects?.some(effect =>
              effect.type === cards.EFFECT_TYPES.REGISTER_EVENT_BONUS && effect.id === bonus.effectId));
            assert.deepEqual(matches.map(c => c.id), [sourceCardInstanceId], "这两个真实状态的公开已打出卡可唯一对应bonus");
            return { bonusId: bonus.id, sourceMatches: matches.map(c => c.id), usedKeys: bonus.usedKeys,
              claimedKeys: bonus.claimedKeys, mars: residual.describeEventBonusProgress({ bonus, ownerId: actorId,
                event: { type: "visitPlanet", planetId: "mars" } }) };
          });
          assert.equal(JSON.stringify(active), before);
          row.stages.push({ label, phase: fork.inspect().phase,
            currentEffectType: session?.currentEffect?.type || "idle",
            currentEffectCard: session?.currentEffect?.payload?.cardInstanceId || "not-card-effect",
            workingBonuses: structuredClone(active), committedBonuses: committed.turn.cardTurnEventBonuses,
            score: player.resources.score, progress });
        };
        inspect("before-play");
        for (const expected of route.inputs) {
          const state = fork.inspect(), decision = state.session?.decision;
          const legal = state.phase === "awaiting_input" ? decision.choices : fork.inputPort.enumerateActions();
          const action = legal.find(a => a.actionId === expected.actionId);
          assert.deepEqual(action, expected);
          const result = action.phase === "conditional"
            ? fork.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
              ownerId: decision.ownerId, choice: action }, { skipProjection: true })
            : fork.inputPort.submitAction(action, { skipProjection: true });
          assert.equal(result.ok, true, JSON.stringify(result.failure));
          inspect(action.summary);
        }
        assert.equal(row.stages[0].workingBonuses.length, 0);
        assert.equal(row.stages[1].committedBonuses.length, 0);
        assert.equal(row.stages[1].workingBonuses.length, 1);
        assert.equal(row.stages[1].currentEffectCard, sourceCardInstanceId);
        if (route.step === 497) {
          assert.deepEqual(row.stages[2].progress[0].usedKeys, ["saturn"]);
          assert.equal(row.stages[2].progress[0].mars.status, "reward");
          assert.deepEqual(row.stages[2].committedBonuses, []);
          assert.deepEqual(row.stages[3].progress[0].claimedKeys, ["dlc12-two-planets"]);
        }
        assert.equal(row.stages.at(-1).score - row.stages[0].score, route.scoreGain);
        report.rows.push(row);
      } finally { fork?.dispose(); env.dispose(); }
    }
    report.verified = true;
  } catch (error) {
    report.verified = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, verified: report.verified, error: report.error,
    rows: report.rows.map(r => ({ step: r.step, stages: r.stages.map(s => ({ label: s.label, phase: s.phase,
      working: s.workingBonuses.length, committed: s.committedBonuses.length, progress: s.progress })) })) }, null, 2));
}
