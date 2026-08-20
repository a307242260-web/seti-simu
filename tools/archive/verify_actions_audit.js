"use strict";
// 行动统一核对辅助脚本：枚举 23 个 Standard Action family 的登记/相位，
// 并实证 PASS 后快速行动的枚举行为。仅诊断用，不属于正式 Node 回归清单。

// 与官方 composition 测试保持相同模块加载顺序，避免加载顺序影响 RNG/目录状态。
require("../randomizer/game/actions/standard-action");
require("../randomizer/game/actions/quick-trades");
require("../randomizer/game/cards/deck");
require("../randomizer/game/cards/effects");
require("../randomizer/game/initial-cards");
require("../randomizer/game/players");
require("../randomizer/solar-system/core");
require("../randomizer/app/simulation-env");
require("../randomizer/game/card-catalog");

const productionComposition = require("../randomizer/game/production-composition");
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
  const begin = kernel.composition.inputPort.beginDrain();
  if (!begin.ok) throw new Error(`beginDrain 失败: ${JSON.stringify(begin)}`);
  const progressByPlayer = new Map();
  for (let step = 0; step < 60 && kernel.composition.inspect().phase === "awaiting_input"; step += 1) {
    const inspected = kernel.composition.inspect();
    const decision = inspected.session.decision;
    if (!decision) throw new Error(`opening 无 decision: ${inspected.phase}`);
    const progress = progressByPlayer.get(decision.ownerId)
      || { industry: false, initialIds: new Set() };
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
    if (process.env.AUDIT_TRACE) {
      const hands = kernel.composition.projection({ viewerId: "audit", role: "simulation", playerId: null }).state.players.players
        .map((player) => `${player.id}:${(player.hand || []).length}`);
      console.log(`step=${step} owner=${decision.ownerId} family=${choice.family} target=${JSON.stringify(choice.target)} hands=${hands.join(",")} ok=${submitted.ok}`);
    }
    if (!submitted.ok) throw new Error(`opening 失败: ${JSON.stringify(submitted)}`);
  }
  if (kernel.composition.inspect().phase !== "idle") {
    throw new Error(`opening 未完成: ${kernel.composition.inspect().phase}`);
  }
}

function enumeratePort(state, family) {
  const canonicalState = structuredClone(state);
  const context = {
    state: canonicalState,
    players: canonicalState.players,
    cards: canonicalState.cards,
    pieces: canonicalState.pieces,
    turn: canonicalState.turn,
    match: canonicalState.match,
  };
  const pack = productionComposition.createProductionDomainPack({
    getAuthority: () => ({
      actorId: state.turn.currentPlayerId,
      stateVersion: state.meta.stateVersion,
      decisionVersion: state.match.decisionVersion,
    }),
  });
  return { context, pack, actions: pack.actionRegistry.enumerate(context, { family }) };
}

const kernel = createSimulationRuleComposition({
  seed: "seti-140-production-standard-action",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
  random: createSeededRandom("seti-140-production-standard-action"),
});
if (!kernel.newGame({
  seed: "seti-140-production-standard-action",
  activePlayerCount: 4,
  aiDifficulty: "weak_start",
}).ok) throw new Error("newGame 失败");
finishOpening(kernel);

const state = kernel.composition.projection({ viewerId: "audit", role: "simulation", playerId: null }).state;
const { pack } = enumeratePort(state, null);

console.log("== 23 family 登记与相位 ==");
for (const entry of pack.actionRegistry.coverage()) {
  console.log(`${entry.phase.padEnd(9)} ${entry.family.padEnd(24)} registered=${entry.registered}`);
}
const unregistered = pack.actionRegistry.coverage().filter((entry) => !entry.registered);
console.log(unregistered.length
  ? `!! 未登记 family: ${unregistered.map((entry) => entry.family).join(", ")}`
  : "OK 23 个 family 全部登记");

const all = enumeratePort(state, null);
console.log("\n== 当前玩家可枚举 action（按 family 去重）==");
const byFamily = new Map();
for (const action of all.actions) {
  if (!byFamily.has(action.family)) byFamily.set(action.family, { phase: action.phase, count: 0 });
  byFamily.get(action.family).count += 1;
}
for (const [family, info] of [...byFamily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${info.phase.padEnd(9)} ${family.padEnd(24)} ${info.count}`);
}

const playerId = state.turn.currentPlayerId;
const passedState = structuredClone(state);
passedState.turn.passedPlayerIds = [...(passedState.turn.passedPlayerIds || []), playerId];
const passedPlayer = passedState.players.players.find((player) => player.id === playerId);
passedPlayer.mainActionCompleted = true;
passedPlayer.passCompletionPending = true;
const afterPass = enumeratePort(passedState, null);
const quickAfterPass = afterPass.actions.filter((action) => action.phase === "quick" && !action.disabledReason);
console.log("\n== PASS 完成后仍可枚举的快速行动 ==");
if (!quickAfterPass.length) console.log("（无）");
for (const action of quickAfterPass) {
  console.log(`${action.family}  target=${JSON.stringify(action.target)}`);
}
const quickFamiliesAfterPass = [...new Set(quickAfterPass.map((action) => action.family))].sort();
console.log(`PASS 后快速行动 family: ${quickFamiliesAfterPass.join(", ") || "（无）"}`);

// 给玩家一枚停在水星上的火箭，再核对 move/orbit/land 枚举（含 PASS 后）
const rockets = require("../randomizer/game/rockets");
const solarCore = require("../randomizer/solar-system/core");
function withRocketOnPlanet(baseState) {
  const s = structuredClone(baseState);
  const p = s.players.players.find((player) => player.id === s.turn.currentPlayerId);
  const earth = solarCore.createSolarSnapshot(s.solarSystem).planetLocations.find((item) => item.planetId === "earth");
  const launch = rockets.launchRocketAtSector(s.pieces, earth, { playerId: p.id, color: p.color, root: s });
  if (!launch.ok) throw new Error(`launch 失败: ${launch.message}`);
  const mercury = solarCore.createSolarSnapshot(s.solarSystem).planetLocations.find((item) => item.planetId === "mercury");
  const moved = rockets.moveRocket(s.pieces, launch.rocket.id, mercury.x - launch.rocket.sectorX, mercury.y - launch.rocket.sectorY);
  if (!moved.ok) throw new Error(`move 失败: ${moved.message}`);
  p.resources.energy = 10;
  p.resources.credits = 10;
  return s;
}
const rocketState = withRocketOnPlanet(state);
const rocketActions = enumeratePort(rocketState, null);
console.log("\n== 有火箭在行星上时的行动枚举 ==");
for (const family of ["launch", "move", "orbit", "land"]) {
  const list = rocketActions.actions.filter((action) => action.family === family && !action.disabledReason);
  console.log(`${family.padEnd(12)} count=${list.length}${list[0] ? ` sample=${JSON.stringify(list[0].target)}` : ""}`);
}
const rocketPassed = structuredClone(rocketState);
const rp = rocketPassed.players.players.find((player) => player.id === rocketPassed.turn.currentPlayerId);
rocketPassed.turn.passedPlayerIds = [...(rocketPassed.turn.passedPlayerIds || []), rp.id];
rp.mainActionCompleted = true;
rp.passCompletionPending = true;
const rocketPassedActions = enumeratePort(rocketPassed, null);
const quickAfterPassWithRocket = rocketPassedActions.actions.filter((action) => action.phase === "quick" && !action.disabledReason);
console.log("\n== PASS 后（有火箭）仍可枚举的快速行动 ==");
for (const action of quickAfterPassWithRocket) {
  console.log(`${action.family}  target=${JSON.stringify(action.target)}`);
}
console.log(`PASS 后快速行动 family: ${[...new Set(quickAfterPassWithRocket.map((action) => action.family))].sort().join(", ") || "（无）"}`);
