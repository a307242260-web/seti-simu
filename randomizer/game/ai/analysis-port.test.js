"use strict";
const assert = require("node:assert/strict");
const { createAnalysisPort } = require("./analysis-port");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition");
const { createSeededRandom, RNG_ALGORITHM } = require("../random");
const { buildRuleObservation } = require("../../app/rule-observation");
const { createSimulationEnv } = require("../../app/simulation-env");
const { evaluateStateValue } = require("./state-value");
const { searchDecision, VERSION: SEARCH_VERSION } = require("./decision-search");

const seed = "analysis-port-isolation-v1";
const random = createSeededRandom(seed);
let counterfactualProjections = 0;
const kernel = createSimulationRuleComposition({
  seed, random, activePlayerCount: 4, trustedProjectionReader: true,
  rngState: { algorithm: RNG_ALGORITHM, state: random.getState() },
  projectCounterfactualState: (state, viewer) => {
    counterfactualProjections += 1;
    return buildRuleObservation(state, seed, viewer?.playerId);
  },
});
kernel.newGame({ seed, activePlayerCount: 4 });
kernel.composition.inputPort.beginDrain({});
const comp = kernel.composition;
const beforeStart = comp.lifecycle.save().envelope;
const startDecision = comp.inspect().session.decision;
const startChoice = startDecision.choices.find(action => action.target?.kind === "start_initial_setup");
const startPort = createAnalysisPort({ composition: comp, seatId: startChoice.actorId });
const startRoot = startPort.openRoot(), offered = startPort.expand(startRoot, startChoice.actionId);
assert.equal(offered.status, "information-barrier", "发出未知初始选项后不能继续规划选择");
assert.deepEqual(offered.legalActions, []);
assert.equal(offered.observation.publicState.resident.initialSetup.offer, null);
const maskedOffer = offered.observation;
startPort.releaseBoundaryObservation(offered);
assert.deepEqual(offered.observation,maskedOffer,"已评分边界的完整观察可精确重建，遮蔽与全部字段不变");
assert(Object.isFrozen(maskedOffer));assert.equal(startPort.getDiagnostics().observationReleases,1);
assert.throws(()=>startPort.releaseBoundaryObservation(startRoot),/BOUNDARY_REQUIRED/);
assert.deepEqual(comp.lifecycle.save().envelope, beforeStart);
startPort.close();
assert.equal(comp.inputPort.submitDecision({ decisionId: startDecision.decisionId,
  decisionVersion: startDecision.decisionVersion, ownerId: startDecision.ownerId, choice: startChoice }).ok, true);
// 初始选项实际可见后，再验证纯点击选择、取消与缓存；不能跨屏障沿用旧分支。
const before = comp.lifecycle.save().envelope;
const first = comp.inputPort.enumerateActions({})[0];
const port = createAnalysisPort({ composition: comp, seatId: first.actorId });
const root = port.openRoot();
const rootActionId = root.legalActions[0].actionId;
assert.equal(Object.isFrozen(root.observation), true);
assert.deepEqual(Object.keys(root).sort(), ["boundary", "legalActions", "observation", "status"]);
assert.throws(() => port.expand(root, "unknown"), /NOT_LEGAL/);
const projectionsBeforeExpand = counterfactualProjections;
const branch = port.expand(root, rootActionId);
assert.equal(branch.status, "decision");
assert.equal(counterfactualProjections, projectionsBeforeExpand, "正式模拟输入不生成未消费的内核返回观察");
assert.equal(port.getDiagnostics().observationCount, 0, "内部节点不预先生成未消费的观察");
assert.equal(port.expand(root, rootActionId), branch, "相同已验证输入复用精确结果");
assert.equal(port.getDiagnostics().cacheHits, 1);
const branchBefore = JSON.stringify(branch);
assert.equal(port.getDiagnostics().observationCount, 1, "首次读取才投影且冻结观察");
assert.equal(counterfactualProjections, projectionsBeforeExpand + 1, "首次读取只生成一次完整内核观察");
const initialChoice = branch.legalActions.find(action => action.target?.selectionKind === "initial");
const selected = port.expand(branch, initialChoice.actionId);
assert.equal(selected.status, "decision");
const decodesBeforeCancel = port.getDiagnostics().committedDecodeCount;
assert(decodesBeforeCancel > 0);
assert.notEqual(port.identity(selected), port.identity(branch), "选中状态不同不能合并");
const toggle = selected.legalActions.find(action => action.target?.cardId === initialChoice.target.cardId);
assert(toggle, "开局选择可取消");
const cancelled = port.expand(selected, toggle.actionId);
assert.equal(port.identity(cancelled), port.identity(branch), "选择再取消只有日志/版本差异，应回到同一向前状态");
assert.deepEqual(Object.keys(port.identity(branch)), [], "身份是不透明令牌，不能读到隐藏世界键");
assert.equal(JSON.stringify(branch), branchBefore, "后继执行不能冻结或修改已有节点观察");
assert.equal(port.getDiagnostics().observationCount, 1, "已物化观察不会因分支变化重复投影");
assert.equal(port.getDiagnostics().committedDecodeCount, decodesBeforeCancel,
  "不同pending信封的已提交字节相同时，不重复解码，工作Session仍各自恢复");
assert(port.getDiagnostics().committedDecodeHits >= 1);
assert.deepEqual(comp.lifecycle.save().envelope, before, "分支不能改变真实根或RNG");
const other = createAnalysisPort({ composition: comp, seatId: "wrong-owner" });
assert.throws(() => other.openRoot(), /OWNER_MISMATCH/);
port.close();
assert.equal(port.getDiagnostics().decodedStateCacheBytes, 0);
assert.equal(port.getDiagnostics().decodedStateCacheEntries, 0, "关闭必须释放已提交状态缓存");
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
assert.equal(mainPort.selectionSpec(mainRoot), null, "普通行动不能套用纯选中状态证明");
const spec = mainPort.selectionSpec(discardRoot);
assert.equal(spec.requiredCount, 2);
const plans = [...mainPort.selectionPlans(discardRoot)];
assert.equal(plans.length, spec.cardIds.length * (spec.cardIds.length - 1) / 2, "每个弃牌集合保留最短有序执行路径");
const component = [discardRoot];
const seenSelections = new Set([mainPort.identity(discardRoot)]);
let fullSelections = 0;
for (let cursor = 0; cursor < component.length; cursor += 1) {
  const current = component[cursor];
  const currentSpec = mainPort.selectionSpec(current);
  assert.deepEqual(currentSpec.cardIds, spec.cardIds, "确认前手牌和所有可选项不变");
  if (currentSpec.selectedIds.length === 2) fullSelections += 1;
  for (const action of current.legalActions.filter(action => !action.target?.confirm)) {
    const child = mainPort.expand(current, action.actionId);
    assert(mainPort.selectionSpec(child), "所有点击仍留在同一纯选中状态部分");
    const token = mainPort.identity(child);
    if (!seenSelections.has(token)) {
      seenSelections.add(token);
      component.push(child);
    }
  }
  assert(component.length <= 1 + spec.cardIds.length + plans.length * 2, "点击循环不能制造新的规则状态");
}
assert.equal(component.length, 1 + spec.cardIds.length + plans.length * 2);
assert.equal(fullSelections, plans.length * 2, "每个集合的两种原始确认顺序都可达");
for (const plan of plans) {
  let direct = discardRoot;
  for (const id of plan.selectedIds) direct = mainPort.expand(direct,
    direct.legalActions.find(action => action.target?.cardInstanceId === id).actionId);
  direct = mainPort.expand(direct, direct.legalActions.find(action => action.target?.confirm).actionId);
  const macro = mainPort.expandSelection(discardRoot, plan.selectedIds);
  assert.equal(macro.submissions, plan.submissions);
  assert.equal(macro.actions[0].actionId, plan.firstActionId);
  assert.deepEqual(macro.node, direct, "宏步逐次正式提交，不能伪造确认后的盘面或信封");
  const reverse = mainPort.expandSelection(discardRoot, [...plan.selectedIds].reverse()).node;
  assert.equal(mainPort.identity(macro.node), mainPort.identity(reverse), "只差弃牌堆顺序的结果是同一向前状态");
  assert.deepEqual(macro.node, reverse);
  for (const action of macro.node.legalActions) {
    const left = mainPort.expand(macro.node, action.actionId);
    const right = mainPort.expand(reverse, action.actionId);
    assert.equal(mainPort.identity(left), mainPort.identity(right));
    assert.deepEqual(left, right, "全部后续公共取牌/盲抽保持相同规则结果与信息边界");
  }
}
const reversedPlan = [...mainPort.selectionPlans(selectedAB)]
  .find(plan => plan.selectedIds.includes(secondCard.target.cardInstanceId)
    && plan.selectedIds.includes(undoDiscard.target.cardInstanceId));
assert.equal(reversedPlan.submissions, 1, "同一弃牌集合已有两张时直接确认，不为了顺序取消重选");
const reversedIds = [secondCard.target.cardInstanceId, undoDiscard.target.cardInstanceId];
const reversed = mainPort.expandSelection(selectedAB, reversedIds);
assert.equal(reversed.submissions, 3, "显式要求反序时仍按正式最短点击执行");
const beforeCache = mainPort.getDiagnostics().submissionCount;
assert.equal(mainPort.expandSelection(selectedAB, reversedIds), reversed);
assert.equal(mainPort.getDiagnostics().submissionCount, beforeCache, "宏步命中不再次提交");
const expectedReversed = mainPort.expand(selectedBA,
  selectedBA.legalActions.find(action => action.target?.confirm).actionId);
assert.equal(mainPort.identity(reversed.node), mainPort.identity(expectedReversed));
assert.deepEqual(reversed.node.observation, expectedReversed.observation);
assert.throws(() => mainPort.expandSelection(discardRoot, [spec.cardIds[0], spec.cardIds[0]]), /SELECTION_INVALID/);
assert.throws(() => mainPort.expandSelection(mainRoot, spec.cardIds.slice(0, 2)), /SELECTION_UNSUPPORTED/);
const readySearch = searchDecision({ port: mainPort, root: selectedAB,
  evaluate: observation => evaluateStateValue(observation, actions[0].actorId).total,
  budget: { transitions: 256, nodes: 257, frontier: 256, milliseconds: 2000 } });
assert.equal(readySearch.complete, true, "真实弃牌决策的全部后续选牌到信息边界必须闭合");
assert.equal(readySearch.actionId, selectedAB.legalActions.find(action => action.target?.confirm).actionId,
  "已选满且当前选择同分时直接确认，不为等价出口重新取消重选");
assert.equal(readySearch.unresolved.length, 0);
assert.equal(readySearch.roots.every(root => root.completion === "complete"), true);
assert.equal(readySearch.selectionPlan.complete, true);
for (const tradeId of ["cards-for-credit", "cards-for-energy"]) {
  const entry = mainPort.expand(mainRoot, mainRoot.legalActions.find(action => action.target?.tradeId === tradeId).actionId);
  const pair = mainPort.selectionSpec(entry).cardIds.slice(0, 2);
  const ab = mainPort.expandSelection(entry, pair).node;
  const ba = mainPort.expandSelection(entry, [...pair].reverse()).node;
  assert.equal(mainPort.identity(ab), mainPort.identity(ba));
  assert.deepEqual(ab, ba);
  for (const action of ab.legalActions) {
    const left = mainPort.expand(ab, action.actionId);
    const right = mainPort.expand(ba, action.actionId);
    assert.equal(mainPort.identity(left), mainPort.identity(right));
    assert.deepEqual(left, right, "钱/电弃牌后的每个正式行动不依赖弃牌堆排列");
  }
}
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

// 跨真实点击复用整个竞争集，不只验证旧计划下一步仍合法。
assert.equal(comp.lifecycle.restore(beforeMain).ok, true);
const actualTrade = comp.inputPort.enumerateActions({}).find(action => action.target?.tradeId === "cards-for-pick-card");
assert.equal(comp.inputPort.submitQuickAction(actualTrade).ok, true);
const reusePort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId });
const modelKey = `state-value-v1/default/${SEARCH_VERSION}`;
const searchOptions = { evaluate: observation => evaluateStateValue(observation, actions[0].actorId).total,
  budget: { transitions: 256, nodes: 257, frontier: 256, milliseconds: 2000 }, modelKey };
let current = searchDecision({ ...searchOptions, port: reusePort, root: reusePort.openRoot() });
assert.equal(current.complete, true);
const certificate = current.selectionContinuation;
const firstSelectionAction = current.actionId;
assert(certificate);
assert.deepEqual(Object.keys(certificate), [], "续行证据不暴露完整状态键");
let hits = 0;
for (let step = 0; step < 3; step += 1) {
  reusePort.close();
  const decision = comp.inspect().session.decision;
  const choice = decision.choices.find(action => action.actionId === current.actionId);
  assert(choice, "只执行当前正式合法信封");
  assert.equal(comp.inputPort.submitDecision({ decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }).ok, true);
  const actualRoot = reusePort.openRoot();
  if (!reusePort.selectionSpec(actualRoot)) {
    assert.equal(reusePort.reuseSelection(actualRoot, certificate, modelKey).reason, "outside-selection-component");
    break;
  }
  assert.equal(reusePort.reuseSelection(actualRoot, certificate, "changed-model").reason, "model-changed");
  assert.throws(() => reusePort.rememberSelection(actualRoot, [], modelKey), /EVIDENCE_INCOMPLETE/);
  const unfinished = searchDecision({ ...searchOptions, port: reusePort, root: actualRoot,
    budget: { transitions: 1, nodes: 257, frontier: 256, milliseconds: 2000 } });
  assert.equal(unfinished.complete, false);
  assert.equal(unfinished.selectionContinuation, null, "未闭合结果不能作为完成证据流转");
  const beforeReuse = reusePort.getDiagnostics().submissionCount;
  current = searchDecision({ ...searchOptions, port: reusePort, root: actualRoot, continuation: certificate });
  assert.equal(current.diagnostics.continuation, "hit");
  assert.equal(current.diagnostics.transitions, 0);
  assert.equal(reusePort.getDiagnostics().submissionCount, beforeReuse, "续行不重新提交搜索分支");
  const referencePort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId });
  const referenceRoot = referencePort.openRoot();
  assert.equal(referencePort.reuseSelection(referenceRoot, certificate, modelKey).reason, "unknown-evidence",
    "证据不能跨实例或席位传递");
  const referenceSearch = searchDecision({ ...searchOptions, port: referencePort, root: referenceRoot });
  assert.equal(current.actionId, referenceSearch.actionId, "开关复用必须选择同一个当前 actionId");
  assert.equal(current.value, referenceSearch.value);
  referencePort.close();
  hits += 1;
}
assert.equal(hits, 2);
reusePort.close();
// 下一步仍合法也不足以续行：同一弃牌状态的资源变化必须使完整竞争证据失效。
const changedResources = structuredClone(beforeMain);
const resourceState = JSON.parse(changedResources.committedState);
resourceState.players.players.find(player => player.id === actions[0].actorId).resources.energy += 1;
changedResources.committedState = JSON.stringify(resourceState);
assert.equal(comp.lifecycle.restore(changedResources).ok, true);
const changedTrade = comp.inputPort.enumerateActions({}).find(action => action.target?.tradeId === "cards-for-pick-card");
assert.equal(comp.inputPort.submitQuickAction(changedTrade).ok, true);
const changedResourceRoot = reusePort.openRoot();
assert(changedResourceRoot.legalActions.some(action => action.actionId === firstSelectionAction),
  "资源变化后原首步仍合法，仍不能据此复用完整竞争结论");
assert.equal(reusePort.reuseSelection(changedResourceRoot, certificate, modelKey).reason, "dependencies-changed");
const replacement = searchDecision({ ...searchOptions, port: reusePort, root: changedResourceRoot });
assert.equal(replacement.complete, true);
assert.equal(reusePort.getDiagnostics().selectionEvidenceEntries, 1);
assert.equal(reusePort.reuseSelection(changedResourceRoot, certificate, modelKey).reason, "unknown-evidence",
  "新完成结果确定性替换旧证据，容量始终为1");
assert.equal(reusePort.reuseSelection(changedResourceRoot, replacement.selectionContinuation, modelKey).hit, true);
let validationClock = 0;
const lateReuse = searchDecision({ ...searchOptions, port: reusePort, root: changedResourceRoot,
  continuation: replacement.selectionContinuation, now: () => validationClock += 2,
  budget: { transitions: 256, nodes: 257, frontier: 256, milliseconds: 1 } });
assert.equal(lateReuse.complete, false);
assert.equal(lateReuse.actionId, null, "完成证据校验本身超时也不得返回可提交动作");
assert.equal(lateReuse.stopReason, "watchdog");
reusePort.close();
for (const eventType of ["quick_trade_payment", "quick_trade_discard_selection"]) {
  const withBonus = structuredClone(beforeMain);
  const state = JSON.parse(withBonus.committedState);
  state.turn.cardTurnEventBonuses = [{ id: "discard-order-observer", ownerId: actions[0].actorId,
    playerId: actions[0].actorId, duration: "turn", eventType,
    distinctBy: eventType === "quick_trade_payment" ? "cardInstanceIds" : "cardInstanceId",
    rewards: [{ id: "observed-discard-credit", type: "gain_resources", options: { gain: { credits: 1 } } }] }];
  withBonus.committedState = JSON.stringify(state);
  assert.equal(comp.lifecycle.restore(withBonus).ok, true);
  const trade = comp.inputPort.enumerateActions({}).find(action => action.target?.tradeId === "cards-for-credit");
  assert.equal(comp.inputPort.submitQuickAction(trade).ok, true);
  const observedPort = createAnalysisPort({ composition: comp, seatId: actions[0].actorId });
  const observedRoot = observedPort.openRoot();
  if (eventType === "quick_trade_payment") {
    const observedSpec = observedPort.selectionSpec(observedRoot);
    assert.equal(observedSpec.unordered, false, "支付事件可观察顺序时必须保留有序支付");
    const observedPlans = [...observedPort.selectionPlans(observedRoot)];
    assert.equal(observedPlans.length, observedSpec.cardIds.length * (observedSpec.cardIds.length - 1));
    const pair = observedSpec.cardIds.slice(0, 2);
    const left = observedPort.expandSelection(observedRoot, pair).node;
    const right = observedPort.expandSelection(observedRoot, [...pair].reverse()).node;
    assert.notEqual(observedPort.identity(left), observedPort.identity(right), "不同支付顺序写入不同事件进度，不能合并");
  } else {
    assert.equal(observedPort.selectionSpec(observedRoot), null, "点击也有规则效果时不再是纯选择部分");
    assert.throws(() => observedPort.expandSelection(observedRoot, spec.cardIds.slice(0, 2)), /SELECTION_UNSUPPORTED/);
    const beforeCredits = observedRoot.observation.publicState.players.find(player => player.playerId === actions[0].actorId).credits;
    const clicked = observedPort.expand(observedRoot, observedRoot.legalActions[0].actionId);
    assert.equal(clicked.observation.publicState.players.find(player => player.playerId === actions[0].actorId).credits,
      beforeCredits + 1, "反例确实产生了额外收益，不能按无效果 toggle 处理");
  }
  observedPort.close();
}
env.dispose();
comp.dispose();
console.log("trusted analysis fork isolation and exact reuse passed");

// When every opponent has passed, end_turn still closes this search window even
// though the same seat owns the next native turn.
{
 const fs=require('node:fs'),path=require('node:path'),f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261029-budget1024-v1/baseline-r2-t9-white-20261029-v1.json')));
 const state=JSON.parse(f.compositionEnvelope.committedState);state.players.players.find(p=>p.id===f.seatId).mainActionCompleted=true;
 const k=createSimulationRuleComposition({seed:f.source.seed,random:createSeededRandom(f.source.seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,f.source.seed,v?.playerId)});k.newGame({seed:f.source.seed});const c=k.composition;
 assert(c.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(state)}).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId});const root=p.openRoot(),end=root.legalActions.find(a=>a.family==='end_turn');assert(end);
 const next=p.expand(root,end.actionId);assert.equal(next.status,'turn-boundary');assert.equal(next.boundary,'own-turn-complete');assert.deepEqual(next.legalActions,[]);
 assert.equal(next.observation.publicState.turnNumber,state.turn.turnNumber+1);assert.equal(next.observation.publicState.currentPlayerId,f.seatId);
 assert.throws(()=>p.expand(next,end.actionId),/BOUNDARY_CLOSED/);assert.deepEqual(c.lifecycle.save().envelope,before);p.close();c.dispose();
}

// Captured v41 full-game failure: a last PASS can finish the native game while
// the composition still enumerates residual controls. They are not future moves.
{
 const fs=require('node:fs'),path=require('node:path'),f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261029-learning-v1/v41-step322-terminal-blue-20261029-v1.json')));
 const k=createSimulationRuleComposition({seed:f.source.seed,random:createSeededRandom(f.source.seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,f.source.seed,v?.playerId)});k.newGame({seed:f.source.seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);
 const original=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot(),pass=root.legalActions.find(a=>a.family==='pass');assert(pass);
 const ended=p.expandWithCardPick(root,pass.actionId,()=>null);assert(ended.complete);assert.equal(ended.node.status,'terminal');assert.deepEqual(ended.node.legalActions,[]);assert.equal(ended.node.observation.terminal,true);assert.throws(()=>p.expand(ended.node,pass.actionId),/BOUNDARY_CLOSED/);
 const agent=require('./search-agent'),{createStateValueEvaluator}=require('./state-value'),r=searchDecision({port:p,root,evaluate:createStateValueEvaluator(f.seatId),...agent.OPTIONS,budget:agent.BUDGET});assert(r.complete,r.stopReason);assert.deepEqual(r.unresolved,[]);assert(r.lines.some(n=>n.status==='terminal'));assert.deepEqual(c.lifecycle.save().envelope,original,'terminal probing preserves canonical root and RNG');p.close();c.dispose();
}

// A new technology bonus does not cancel the already-known PICK_CARD reward.
// Execute one fixed known public pick, then close before using the new card/bonus.
{
 const fs=require('node:fs'),path=require('node:path'),f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-036-20261030-v1.json'))),results=[];
 for(const reverse of [false,true]){
  const envelope=structuredClone(f.compositionEnvelope);if(reverse){const committed=JSON.parse(envelope.committedState);for(const state of [committed,envelope.session.session.baseState,envelope.session.session.workingState,...envelope.session.session.undoFrames.map(f=>f.stateBefore)]){if(!state?.tech)continue;for(const stack of Object.values(state.tech.stacks))stack.bonusQueue=[stack.bonusQueue[0],...stack.bonusQueue.slice(1).reverse()];state.cards.drawPileCardIds.reverse();}envelope.committedState=JSON.stringify(committed);}
  const k=createSimulationRuleComposition({seed:f.source.seed,random:createSeededRandom(f.source.seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,f.source.seed,v?.playerId)});k.newGame({seed:f.source.seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});p.setCardPickPlanning(true);
  try{const root=p.openRoot(),pending=p.expand(root,f.source.teacherActionId);assert.equal(pending.status,'decision','settle the guaranteed reward before closing the technology reveal');assert.equal(pending.boundary,'tech_bonus_reveal');const known=new Set(root.observation.publicState.board.publicCards.filter(Boolean).map(c=>c.id));assert(pending.legalActions.every(a=>a.target.source!=='blind'&&known.has(a.target.cardInstanceId)));
   const count=pending.observation.selfState.hand.length,prior=evaluateStateValue(pending.observation,f.seatId).total,spec=p.cardPickSpec(pending);assert(spec.fixed);const done=p.expandWithCardPick(pending,spec.selectedActionId,()=>null);assert(done.complete);assert.equal(done.submissions,1);assert.equal(done.node.status,'information-barrier');assert.deepEqual(done.node.legalActions,[]);assert.equal(done.node.observation.selfState.hand.length,count+1);assert.equal(evaluateStateValue(done.node.observation,f.seatId).total,prior+1);assert.throws(()=>p.expand(done.node,spec.selectedActionId),/BOUNDARY_CLOSED/);assert.deepEqual(c.lifecycle.save().envelope,before);results.push({actionId:spec.selectedActionId,value:evaluateStateValue(done.node.observation,f.seatId).total,observation:done.node.observation});
  }finally{p.close();c.dispose();}
 }
 assert.deepEqual(results[1],results[0],'hidden future bonus and draw order must not change the fixed choice, settled value or masked leaf');
}
