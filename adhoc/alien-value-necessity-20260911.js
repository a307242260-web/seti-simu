"use strict";

// 必要性审查：合成公开事实，仅调用正式投影与评估；不是完整局实验。
const model = require("../randomizer/game/ai/outcome-model");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const { execFileSync } = require("node:child_process");
const seatId = "red";
function observe({ revealed = false, first = null, extra = [], score = 0,
  securedEndGameBonus = 0, roundNumber = 2, mixed = false } = {}) {
  const trace = owner => ({ firstPlaced: Boolean(owner), ownerPlayerColor: owner,
    extraCount: 0, extraMarkers: [] });
  return model.createDecisionObservation({
    publicState: { roundNumber, players: [{ playerId: seatId, color: seatId,
      resources: { score }, securedEndGameBonus }], board: { aliens: { slots: [{
      slotId: 1, revealed, alienId: revealed ? "chong" : null,
      traces: { yellow: { ...trace(first), extraCount: extra.length,
        extraMarkers: extra.map(ownerPlayerColor => ({ ownerPlayerColor })) },
      pink: trace(mixed ? "blue" : null), blue: trace(mixed ? "green" : null) },
    }] } } }, selfState: { playerId: seatId, hand: [] },
  }, { seatId, stateVersion: 1, decisionVersion: 1 });
}
const action = { actionId: "trace-choice", family: "choose_target", phase: "conditional" };
function compare(name, root, leaf) {
  const result = evaluator.evaluateOutcome({ seatId, actionOutcomes: [{
    schemaVersion: model.OUTCOME_SCHEMA_VERSION, actionId: action.actionId,
    status: "settled", rootObservation: root, leaves: [{ leafId: "leaf",
      status: "settled", observation: leaf, actionChain: [action.actionId] }],
  }] }, action);
  return { name, actualScoreDelta: result.actualScoreDelta, primaryValue: result.primaryValue,
    vDelta: evaluator.evaluateStateValue(leaf, seatId).total
      - evaluator.evaluateStateValue(root, seatId).total,
    rootTraces: root.outcomeProjection.progress.traceCount,
    leafTraces: leaf.outcomeProjection.progress.traceCount,
    leafSlot: leaf.outcomeProjection.progress.alienSlots[0] };
}
const results = [
  compare("首痕迹：正式即时5分与终局2分已投影", observe(),
    observe({ first: "red", score: 5, securedEndGameBonus: 2 })),
  compare("他人追加痕迹不改变我方任何收益", observe({ revealed: true, first: "red" }),
    observe({ revealed: true, first: "red", extra: ["blue"] })),
  compare("我在他人首痕迹下追加：正式3分", observe({ revealed: true, first: "blue" }),
    observe({ revealed: true, first: "blue", extra: ["red"], score: 3 })),
  compare("仅揭示公共身份，我方无首痕迹与奖励", observe(), observe({ revealed: true })),
  compare("混合归属三色齐", observe(), observe({ first: "red", mixed: true })),
];
console.log(JSON.stringify({ kind: "synthetic-valuation-diagnostic", date: "2026-09-11",
  codeCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: __dirname, encoding: "utf8" }).trim(),
  results }, null, 2));
