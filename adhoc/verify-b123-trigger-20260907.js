"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const effects = require("../randomizer/game/cards/effects");
const output = "reports/iteration/b123-trigger-finalized-20260907.json";
if (fs.existsSync(output)) console.log("已有三色正式验证，不重复执行");
else {
  const env = createSimulationEnv(); let fork; const results = [];
  try {
    env.loadCheckpoint(JSON.parse(fs.readFileSync("reports/iteration/executor-root-610-20260907.json")).checkpoint);
    fork = env.createCounterfactualFork().composition;
    const legal = () => { const s = fork.inspect(); return s.phase === "awaiting_input" ? s.session.decision.choices : fork.inputPort.enumerateActions(); };
    const submit = action => {
      const d = fork.inspect().session?.decision;
      const result = action.phase === "conditional" ? fork.inputPort.submitDecision({
        decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: action,
      }) : fork.inputPort.submitAction(action);
      assert.equal(result.ok, true, JSON.stringify(result.failure));
      return result;
    };
    const rows = JSON.parse(fs.readFileSync("reports/iteration/b123-trigger-formal-v2-20260907.json")).rows;
    for (const row of rows.slice(0, -1)) {
      const action = legal().find(a => a.actionId === row.action.actionId);
      assert.ok(action, row.label); submit(action);
      if (action.family === "end_turn") assert.equal(fork.counterfactualPort.advanceFocalPlanningTurn("player-brown").ok, true);
    }
    const beforeTrigger = fork.lifecycle.save().envelope;
    for (const color of ["yellow", "red", "blue"]) {
      assert.equal(fork.lifecycle.restore(beforeTrigger).ok, true);
      const trigger = legal().find(a => a.target.ruleId === `b123-scan-${color}`);
      assert.ok(trigger); submit(trigger);
      const inspection = fork.inspect();
      assert.equal(inspection.session.currentEffect.type, "science_domain_scan_step");
      const choices = legal(); assert.ok(choices.length);
      assert.ok(choices.every(a => effects.NEBULA_IDS_BY_COLOR[color].includes(a.target.nebulaId)), color);
      const pending = fork.lifecycle.save().envelope;
      const resolved = submit(choices[0]);
      // journal 是整次主行动累计值；只统计奖励 Decision 后新增的执行，排除先前主扫描。
      const types = resolved.journal.effects.slice(pending.session.session.journal.effects.length).map(e => e.type);
      assert.equal(types.filter(t => t === "science_domain_scan_finalize").length, 1);
      assert.equal(types.filter(t => t === "science_domain_settle").length, 1);
      assert.ok(types.indexOf("science_domain_scan_finalize") < types.indexOf("science_domain_settle"));
      assert.equal(fork.inspect().phase, "idle");
      const after = fork.lifecycle.save().envelope;
      const player = JSON.parse(after.committedState).players.players.find(p => p.id === "player-brown");
      assert.ok(player.reservedCards.find(c => c.id === "card-93-0").cardEffectState.consumedTriggerIds.includes(`b123-scan-${color}`));
      assert.equal(fork.lifecycle.restore(pending).ok, true);
      assert.deepEqual(legal(), choices);
      submit(choices[0]);
      assert.deepEqual(fork.lifecycle.save().envelope, after, "奖励Decision恢复后状态/RNG/序号/会话一致");
      // 独立满扇区边界 fixture：只将当前奖励目标预填至剩一槽，不冒充原盘面结果。
      const filled = structuredClone(pending);
      const root = filled.session.session.workingState;
      const nebulaId = choices[0].target.nebulaId;
      const tokens = root.data.nebulae[nebulaId].tokens;
      const empty = tokens.filter(t => !t.replacedByPlayerId);
      assert.ok(empty.length);
      for (const token of empty.slice(0, -1)) {
        token.replacedByPlayerId = "player-brown";
        token.replacedByPlayerColor = "brown";
        token.replacementOrder = root.meta.sequences.nebulaReplacement++;
      }
      const previousCount = root.data.sectorSettlements?.sectors?.[nebulaId]?.settlementCount || 0;
      assert.equal(fork.lifecycle.restore(filled).ok, true);
      const filledResult = submit(legal().find(a => a.actionId === choices[0].actionId));
      assert.ok(filledResult.journal.events.some(e => e.type === "sectorCompleted"));
      const filledAfter = fork.lifecycle.save().envelope;
      const filledRoot = filledAfter.session?.session.workingState || JSON.parse(filledAfter.committedState);
      assert.equal(filledRoot.data.sectorSettlements.sectors[nebulaId].settlementCount, previousCount + 1);
      assert.equal(fork.lifecycle.restore(filled).ok, true);
      submit(legal().find(a => a.actionId === choices[0].actionId));
      assert.deepEqual(fork.lifecycle.save().envelope, filledAfter, "满扇区奖励恢复后状态/RNG/序号一致");
      results.push({ color, candidates: choices.map(a => a.target.nebulaId), finalScore: player.resources.score, restoredIdentically: true, finalizeCount: 1, settleCount: 1,
        filledSectorFixture: { nebulaId, settlementDelta: 1, restoredIdentically: true } });
    }
    fs.writeFileSync(output, JSON.stringify({ source: "610正式检查点与已录制复现链，无AI", results }, null, 2) + "\n");
    console.log(JSON.stringify(results));
  } finally { fork?.dispose(); env.dispose(); }
}
