"use strict";
const assert = require("node:assert/strict");
const { createAnalysisPort } = require("./analysis-port");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createSimulationEnv } = require("../../app/simulation-env");

const seed = "analysis-port-isolation-v1";
const random = createSeededRandom(seed);
const kernel = createSimulationRuleComposition({
  seed, random, activePlayerCount: 4, trustedProjectionReader: true,
  rngState: { algorithm: RNG_ALGORITHM, state: random.getState() },
  projectCounterfactualState: (state, viewer) => buildRuleObservation(state, seed, viewer?.playerId),
});
kernel.newGame({ seed, activePlayerCount: 4 });
kernel.composition.inputPort.beginDrain({});
const comp = kernel.composition;
const before = comp.lifecycle.save().envelope;
const first = comp.inputPort.enumerateActions({})[0];
const port = createAnalysisPort({ composition: comp, seatId: first.actorId });
const root = port.openRoot();
const rootActionId = root.legalActions[0].actionId;
assert.equal(Object.isFrozen(root.observation), true);
assert.deepEqual(Object.keys(root).sort(), ["boundary", "legalActions", "observation", "status"]);
assert.throws(() => port.expand(root, "unknown"), /NOT_LEGAL/);
const branch = port.expand(root, rootActionId);
assert.equal(branch.status, "decision");
assert.equal(port.expand(root, rootActionId), branch, "相同已验证输入复用精确结果");
assert.equal(port.getDiagnostics().cacheHits, 1);
const branchBefore = JSON.stringify(branch);
const selected = port.expand(branch, branch.legalActions[0].actionId);
assert.equal(selected.status, "decision");
assert.equal(JSON.stringify(branch), branchBefore, "后继执行不能冻结或修改已有节点观察");
assert.deepEqual(comp.lifecycle.save().envelope, before, "分支不能改变真实根或RNG");
const other = createAnalysisPort({ composition: comp, seatId: "wrong-owner" });
assert.throws(() => other.openRoot(), /OWNER_MISMATCH/);
port.close();
assert.throws(() => port.expand(root, rootActionId), /NODE_INVALID/);

// 用公共机器输入推进到首个主行动，检查同family不同选择、跨分支restore和关闭缓存。
const env = createSimulationEnv();
env.reset({ seed, agentType: "completion", compactReplay: true });
for (let step = 0; step < 64 && !env.legalActions().some(action => action.phase === "main"); step += 1) {
  env.runAgentDecision();
}
const actions = env.legalActions();
assert(actions.some(action => action.phase === "main"));
assert(!actions.some(action => action.target?.tradeId === "energy-for-move"),
  "没有本席在太阳系的探测器时，正式合法集不能提供必然执行失败的移动交易");
assert.equal(comp.lifecycle.restore(env.createCheckpoint().coreState.compositionEnvelope).ok, true);
const mainPort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId, maxCacheEntries: 1 });
const mainRoot = mainPort.openRoot();
const beforeMain = comp.lifecycle.save().envelope;
const evaluated = mainRoot.legalActions.slice(0, 3).map(action => mainPort.expand(mainRoot, action.actionId));
assert.equal(mainPort.getDiagnostics().cacheEntries, 1, "缓存容量有界");
const coldPort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId, maxCacheEntries: 0 });
const coldRoot = coldPort.openRoot();
assert.deepEqual(coldPort.expand(coldRoot, mainRoot.legalActions[0].actionId), evaluated[0]);
assert.deepEqual(mainPort.expand(mainRoot, mainRoot.legalActions[0].actionId), evaluated[0], "淘汰后重算结果不变");
assert.deepEqual(comp.lifecycle.save().envelope, beforeMain);
const trade = mainRoot.legalActions.find(action => action.family === "quick_trade"
  && action.target.tradeId === "cards-for-pick-card");
assert(trade, "本夹具必须能用两张牌精选");
const drawPath = [trade.actionId];
let pick = mainPort.expand(mainRoot, trade.actionId);
for (let step = 0; step < 4 && !pick.legalActions.some(action => action.target?.source === "blind"); step += 1) {
  const next = pick.legalActions.find(action => action.target?.confirm)
    || pick.legalActions.find(action => action.target?.kind === "discard-hand-card" && !action.presentation?.selected);
  assert(next, "正式弃牌必须可推进到选牌");
  drawPath.push(next.actionId);
  pick = mainPort.expand(pick, next.actionId);
}
const blind = pick.legalActions.find(action => action.target?.source === "blind");
assert(blind, "正式精选必须包含允许的盲抽");
drawPath.push(blind.actionId);
const hiddenResult = mainPort.expand(pick, blind.actionId);
assert.equal(hiddenResult.status, "information-barrier");
assert.deepEqual(hiddenResult.legalActions, []);
assert(hiddenResult.observation.selfState.hand.some(card => card.hidden === true));
assert.throws(() => mainPort.expand(hiddenResult, trade.actionId), /BOUNDARY_CLOSED/);

// 改变真实隐藏牌序不能改变同一可见输入的搜索结果。
const changed = structuredClone(beforeMain);
const committed = JSON.parse(changed.committedState);
const session = changed.session?.session;
for (const state of [committed, session?.baseState, session?.workingState, session?.committedState,
  ...(session?.undoFrames || []).map(frame => frame.stateBefore)]) {
  if (state?.cards?.drawPileCardIds) state.cards.drawPileCardIds.reverse();
}
changed.committedState = JSON.stringify(committed);
assert.equal(comp.lifecycle.restore(changed).ok, true);
const changedPort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId });
const changedRoot = changedPort.openRoot();
let changedLeaf = changedRoot;
for (const id of drawPath) changedLeaf = changedPort.expand(changedLeaf, id);
assert.deepEqual(changedLeaf, hiddenResult);
changedPort.close();
mainPort.close();
coldPort.close();
env.dispose();
comp.dispose();
console.log("trusted analysis fork isolation and exact reuse passed");
