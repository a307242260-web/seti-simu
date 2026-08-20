"use strict";
// PASS 自动结束回合的端到端验证：提交 pass → 驱动 PASS 链全部 Decision →
// 确认回合自动推进到下一名玩家（无需再提交 end_turn）。

const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");

function createSeededRandom(seed) {
  let state = [...String(seed)].reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  ) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function finishOpening(kernel) {
  kernel.composition.inputPort.beginDrain();
  const progressByPlayer = new Map();
  for (let step = 0; step < 60 && kernel.composition.inspect().phase === "awaiting_input"; step += 1) {
    const inspected = kernel.composition.inspect();
    const decision = inspected.session.decision;
    const progress = progressByPlayer.get(decision.ownerId) || { industry: false, initialIds: new Set() };
    let choice = decision.choices.find((candidate) => candidate.target?.kind === "start_initial_setup")
      || decision.choices.find((candidate) => candidate.target?.kind === "confirm_initial_setup");
    if (!choice && !progress.industry) {
      choice = decision.choices.find((candidate) => candidate.target?.selectionKind === "industry");
      if (choice) progress.industry = true;
    }
    if (!choice && progress.initialIds.size < 2) {
      choice = decision.choices.find((candidate) => (
        candidate.target?.selectionKind === "initial"
        && !progress.initialIds.has(candidate.target.cardId)
      ));
      if (choice) progress.initialIds.add(choice.target.cardId);
    }
    choice = choice || decision.choices[0];
    progressByPlayer.set(decision.ownerId, progress);
    const submitted = kernel.composition.inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice,
    });
    if (!submitted.ok) throw new Error(`opening 失败: ${JSON.stringify(submitted.failure || submitted)}`);
  }
  if (kernel.composition.inspect().phase !== "idle") {
    throw new Error(`opening 未完成: ${kernel.composition.inspect().phase}`);
  }
}

function driveToCompletion(kernel, maxSteps = 200) {
  for (let step = 0; step < maxSteps; step += 1) {
    const inspected = kernel.composition.inspect();
    const phase = inspected.phase;
    if (phase === "idle" || phase === "completed") return { ok: true, phase };
    if (phase === "aborted") {
      return { ok: false, phase, failure: inspected.session?.failure || null };
    }
    const decision = inspected.session?.decision;
    if (decision) {
      const choice = decision.choices[0];
      if (!choice) return { ok: false, phase, failure: { code: "NO_CHOICE", message: "无合法选项" } };
      const submitted = kernel.composition.inputPort.submitDecision({
        decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId,
        choice,
      });
      if (!submitted.ok) {
        return { ok: false, phase, failure: submitted.failure || submitted };
      }
      continue;
    }
    return { ok: false, phase, failure: { code: "UNHANDLED_PHASE" } };
  }
  return { ok: false, phase: kernel.composition.inspect().phase, failure: { code: "STEP_LIMIT" } };
}

function committedState(kernel) {
  return kernel.composition.projection({
    viewerId: "pass-auto-advance",
    role: "simulation",
    playerId: null,
  }).state;
}

const kernel = createSimulationRuleComposition({
  seed: "seti-pass-auto-advance",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
  random: createSeededRandom("seti-pass-auto-advance"),
});
if (!kernel.newGame({
  seed: "seti-pass-auto-advance",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
}).ok) throw new Error("newGame 失败");
finishOpening(kernel);

const before = committedState(kernel);
const playerId = before.turn.currentPlayerId;
console.log(`开局后当前玩家: ${playerId}，回合 R${before.turn.roundNumber}T${before.turn.turnNumber}`);

const passAction = kernel.composition.inputPort.enumerateActions({ family: "pass" })[0];
if (!passAction) throw new Error("当前玩家无法 PASS");
console.log(`提交 PASS action: ${passAction.actionId}`);
const submitted = kernel.composition.inputPort.submitAction(passAction);
if (!submitted.ok) throw new Error(`pass 提交失败: ${JSON.stringify(submitted.failure || submitted)}`);

const driven = driveToCompletion(kernel);
if (!driven.ok) {
  throw new Error(`PASS 链推进失败: ${JSON.stringify(driven.failure)}`);
}

const after = committedState(kernel);
const passedIds = after.turn.passedPlayerIds || [];
console.log(`PASS 链结算后当前玩家: ${after.turn.currentPlayerId}`);
console.log(`passedPlayerIds: ${passedIds.join(",")}`);
console.log(`回合: R${after.turn.roundNumber}T${after.turn.turnNumber}`);

// 断言：玩家已 PASS，回合推进到下一名玩家（currentPlayerId 变化），无需 end_turn。
if (!passedIds.includes(playerId)) throw new Error("玩家未记入 passedPlayerIds");
if (after.turn.currentPlayerId === playerId) {
  throw new Error("PASS 后回合未自动推进（currentPlayerId 未变化）");
}
console.log("OK PASS 后回合自动推进，无需再提交 end_turn");

// 再验证：当前新玩家此时不应出现 end_turn（未完成主行动）。
const endTurnForNext = kernel.composition.inputPort.enumerateActions({ family: "end_turn" });
if (endTurnForNext.length) {
  throw new Error(`新玩家不应出现 end_turn: ${endTurnForNext.length}`);
}
console.log("OK 新玩家（未完成主行动）不会出现 end_turn");
kernel.composition.dispose();
