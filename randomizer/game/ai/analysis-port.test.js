"use strict";
const assert = require("node:assert/strict");
const { createAnalysisPort } = require("./analysis-port");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createSimulationEnv } = require("../../app/simulation-env");
const { evaluateStateValue } = require("./state-value");

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
assert.equal(port.getDiagnostics().observationCount, 0, "内部节点不预先生成未消费的观察");
assert.equal(port.expand(root, rootActionId), branch, "相同已验证输入复用精确结果");
assert.equal(port.getDiagnostics().cacheHits, 1);
const branchBefore = JSON.stringify(branch);
assert.equal(port.getDiagnostics().observationCount, 1, "首次读取才投影且冻结观察");
const initialChoice = branch.legalActions.find(action => action.target?.selectionKind === "initial");
const selected = port.expand(branch, initialChoice.actionId);
assert.equal(selected.status, "decision");
assert.notEqual(port.identity(selected), port.identity(branch), "选中状态不同不能合并");
const toggle = selected.legalActions.find(action => action.target?.cardId === initialChoice.target.cardId);
assert(toggle, "开局选择可取消");
const cancelled = port.expand(selected, toggle.actionId);
assert.equal(port.identity(cancelled), port.identity(branch), "选择再取消只有日志/版本差异，应回到同一向前状态");
assert.deepEqual(Object.keys(port.identity(branch)), [], "身份是不透明令牌，不能读到隐藏世界键");
assert.equal(JSON.stringify(branch), branchBefore, "后继执行不能冻结或修改已有节点观察");
assert.equal(port.getDiagnostics().observationCount, 1, "已物化观察不会因分支变化重复投影");
assert.deepEqual(comp.lifecycle.save().envelope, before, "分支不能改变真实根或RNG");
const other = createAnalysisPort({ composition: comp, seatId: "wrong-owner" });
assert.throws(() => other.openRoot(), /OWNER_MISMATCH/);
port.close();
assert.throws(() => port.expand(root, rootActionId), /NODE_INVALID/);
assert.equal(JSON.stringify(branch), branchBefore, "已物化观察关闭后仍是稳定的只读值");
assert.throws(() => selected.observation, /NODE_INVALID/, "关闭后不能为未读取节点重新访问分支");

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
assert(Number.isFinite(evaluateStateValue(mainRoot.observation, actions[0].actorId).total));
const beforeMain = comp.lifecycle.save().envelope;
const evaluated = mainRoot.legalActions.slice(0, 3).map(action => mainPort.expand(mainRoot, action.actionId));
assert.equal(mainPort.getDiagnostics().observationCount, 0);
assert.equal(mainPort.getDiagnostics().cacheEntries, 1, "缓存容量有界");
const coldPort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId, maxCacheEntries: 0 });
const coldRoot = coldPort.openRoot();
assert.deepEqual(coldPort.expand(coldRoot, mainRoot.legalActions[0].actionId), evaluated[0]);
const firstObservation = evaluated[0].observation;
assert.equal(Object.isFrozen(firstObservation.publicState), true);
assert.equal(evaluated[0].observation, firstObservation, "跨分支读取同一观察保持对象与数值稳定");
assert.deepEqual(mainPort.expand(mainRoot, mainRoot.legalActions[0].actionId), evaluated[0], "淘汰后重算结果不变");
assert.deepEqual(comp.lifecycle.save().envelope, beforeMain);
const trade = mainRoot.legalActions.find(action => action.family === "quick_trade"
  && action.target.tradeId === "cards-for-pick-card");
assert(trade, "本夹具必须能用两张牌精选");
const drawPath = [trade.actionId];
let pick = mainPort.expand(mainRoot, trade.actionId);
const discardRoot = pick;
const oneDiscard = mainPort.expand(pick, pick.legalActions[0].actionId);
const undoDiscard = oneDiscard.legalActions.find(action => action.presentation?.selected);
const discardCancelled = mainPort.expand(oneDiscard, undoDiscard.actionId);
assert.equal(mainPort.identity(discardCancelled), mainPort.identity(discardRoot),
  "弃牌取消的完整队列虽有新effect编号，但剩余规则与随机状态相同");
assert.notEqual(mainPort.identity(oneDiscard), mainPort.identity(discardRoot));
const reselected = mainPort.expand(discardCancelled, discardCancelled.legalActions[0].actionId);
assert.equal(mainPort.identity(reselected), mainPort.identity(oneDiscard),
  "循环后后继状态一致，随机状态不能依赖路径长度");
const secondCard = oneDiscard.legalActions.find(action => action.target?.cardInstanceId
  && action.target.cardInstanceId !== undoDiscard.target.cardInstanceId);
const selectedAB = mainPort.expand(oneDiscard, secondCard.actionId);
const selectedB = mainPort.expand(discardRoot, discardRoot.legalActions.find(action =>
  action.target?.cardInstanceId === secondCard.target.cardInstanceId).actionId);
const selectedBA = mainPort.expand(selectedB, selectedB.legalActions.find(action =>
  action.target?.cardInstanceId === undoDiscard.target.cardInstanceId).actionId);
assert.notEqual(mainPort.identity(selectedAB), mainPort.identity(selectedBA),
  "相同弃牌集合但不同顺序保守保留，不能假设数组无序");
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
assert(Number.isFinite(evaluateStateValue(hiddenResult.observation, actions[0].actorId).total),
  "遮蔽后的未知牌只按公开数量估值");
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
