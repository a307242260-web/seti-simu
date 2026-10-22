#!/usr/bin/env node
"use strict";
// V(state) 输入完整性审计（2026-08-18 用户要求"系统性解决 V 看不到东西"）：
// 对 V 评估的全部调用路径逐一验证喂给 evaluateStateValue 的 observation
// 是否都是标准结构（createDecisionObservation 装配，含 outcomeProjection）。
// 任何路径 THROW = 该调用点漏装配 → V=null → "看不到东西"。
// 用法: node tools/audit_v_state_inputs.js [seed]
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const ev = require("../randomizer/game/ai/expected-score-evaluator");
const independentValue = require("../randomizer/game/ai/state-value");

const seed = process.argv[2] || "seti-104-official-v1";

function auditObservation(label, obs, seatId, required = true) {
  const proj = obs?.outcomeProjection;
  const schemaOK = proj?.schemaVersion === outcomeModel.PROJECTION_SCHEMA_VERSION;
  const hasScoring = !!proj?.scoring;
  const hasProgress = !!proj?.progress;
  const hasAssets = !!proj?.assets;
  const hasSelf = !!obs?.selfState;
  const hasHand = Array.isArray(obs?.selfState?.hand);
  let vResult = "OK";
  try {
    const v = ev.evaluateStateValue(obs, seatId);
    vResult = `total=${v.total.toFixed(1)}`;
  } catch (e) {
    vResult = `THROW: ${e.message.slice(0, 50)}`;
  }
  const ok = vResult.startsWith("total=");
  const status = ok ? "PASS" : (required ? "FAIL" : "INFO(需装配)");
  console.log(`[${status}] ${label}: schema=${schemaOK} scoring=${hasScoring} progress=${hasProgress} assets=${hasAssets} hand=${hasHand} V=${vResult}`);
  return ok || !required;
}

function drain(env) {
  const selectionProgress = new Map();
  let guard = 0;
  while (env.legalActions()[0]?.family?.startsWith("choose_")) {
    const actions = env.legalActions();
    const actorId = actions[0].actorId;
    const progress = selectionProgress.get(actorId) || { industry: false, initialIds: new Set() };
    let action = actions.find((c) => c.target?.kind === "start_initial_setup")
      || actions.find((c) => c.target?.kind === "confirm_initial_setup");
    if (!action && !progress.industry) {
      action = actions.find((c) => (
        c.target?.kind === "select_initial_card" && c.target?.selectionKind === "industry"
      ));
      if (action) progress.industry = true;
    }
    if (!action && progress.initialIds.size < 2) {
      action = actions.find((c) => (
        c.target?.kind === "select_initial_card"
        && c.target?.selectionKind === "initial"
        && !progress.initialIds.has(c.target.cardId)
      ));
      if (action) progress.initialIds.add(action.target.cardId);
    }
    action = action || actions[0];
    selectionProgress.set(actorId, progress);
    env.step(action);
    guard++;
    if (guard > 50) break;
  }
}

const env = createSimulationEnv();
env.reset({ seed, activePlayerCount: 4, traceCounterfactualGoalClusters: true });
drain(env);
let guard = 0;
while (!env.isTerminal() && guard < 3) {
  const legal = env.legalActions();
  const hasMain = legal.some((a) => (
    ["play_card", "research_tech", "scan", "place_data", "launch"].includes(a.family)
  ));
  if (hasMain) break;
  env.step(legal[0]);
  guard++;
}
const seatId = "player-white";
let allPass = true;

// 路径 1：env.observe 原始观察 —— 预期需要装配（V 契约：标准结构）
// 注：env.observe 原始结构缺 outcomeProjection，直接喂 V 会 THROW——这是契约
// 红线（调用方必须 createDecisionObservation 装配），审计标记为"需装配"。
const rawObs = env.observe(seatId);
allPass = auditObservation("env.observe(原始, 需装配)", rawObs, seatId, false) && allPass;

// 路径 2：createDecisionObservation 装配后（启发式/V 引导 root 用）—— 必须 PASS
const stdObs = outcomeModel.createDecisionObservation(rawObs, { seatId, stateVersion: 0, decisionVersion: 0 });
allPass = auditObservation("decisionObs(装配后)", stdObs, seatId) && allPass;
try {
  const rawValue = independentValue.evaluateStateValue(rawObs, seatId);
  const standardValue = independentValue.evaluateStateValue(stdObs, seatId);
  if (rawValue.total !== standardValue.total) throw new Error("原始与决策观察估值不一致");
  const evaluator = independentValue.createStateValueEvaluator(seatId);
  if (evaluator(rawObs) !== rawValue.total || evaluator(stdObs) !== standardValue.total) {
    throw new Error("冻结配置估值与直接估值不一致");
  }
  const addedHand = { ...rawObs, selfState: { ...rawObs.selfState, hand: [...rawObs.selfState.hand, { hidden: true }] } };
  const handBound = independentValue.evaluateHandCountDelta(evaluator, rawObs, 1);
  if (handBound !== independentValue.evaluateStateValue(addedHand, seatId).total
    || handBound !== independentValue.evaluateHandCountDelta(evaluator, stdObs, 1)) {
    throw new Error("手牌数量数值界与真实估值输入求和不一致");
  }
  console.log(`[PASS] independent-state-value: total=${standardValue.total} model=${standardValue.modelVersion}`);
} catch (error) {
  console.log(`[FAIL] independent-state-value: ${error.message}`);
  allPass = false;
}

// 新路径：正式待取牌的原始/标准观察、数量界及真实单步见证必须逐位一致。
{
  let auditKernel;
  try {
    const fs = require("node:fs"), path = require("node:path");
    const { createSimulationRuleComposition } = require("../randomizer/training/simulation-rule-composition");
    const { createSeededRandom } = require("../randomizer/game/random");
    const { buildRuleObservation } = require("../randomizer/app/rule-observation");
    const { createAnalysisPort } = require("../randomizer/game/ai/analysis-port");
    const { searchDecision } = require("../randomizer/game/ai/decision-search");
    const auditSeed = "card-choice-input-audit-v1";
    auditKernel = createSimulationRuleComposition({ seed: auditSeed, random: createSeededRandom(auditSeed), activePlayerCount: 4,
      trustedProjectionReader: true, projectCounterfactualState: (state, viewer) => buildRuleObservation(state, auditSeed, viewer?.playerId) });
    auditKernel.newGame({ seed: auditSeed });
    const checkpoint = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../reports/ai-foundation-20261022/analysis-root-input-v2.json")));
    const comp = auditKernel.composition;
    if (!comp.lifecycle.restore(checkpoint.coreState.compositionEnvelope).ok) throw new Error("取牌审计恢复失败");
    const actor = comp.inputPort.enumerateActions({}).find(action => action.target?.tradeId === "credits-for-card");
    const port = createAnalysisPort({ composition: comp, seatId: actor.actorId });
    const pending = port.expand(port.openRoot(), actor.actionId);
    const evaluator = independentValue.createStateValueEvaluator(actor.actorId);
    const rawBound = independentValue.evaluateHandCountDelta(evaluator, pending.observation, 1);
    const standardized = outcomeModel.createDecisionObservation(pending.observation, { seatId: actor.actorId });
    const standardBound = independentValue.evaluateHandCountDelta(evaluator, standardized, 1);
    const result = searchDecision({ port, root: pending, evaluate: evaluator, cardChoiceEquivalence: true });
    if (!result.complete || result.diagnostics.transitions !== 1 || result.value !== rawBound || rawBound !== standardBound) {
      throw new Error("取牌等价路径的观察、数值界与真实见证不一致");
    }
    port.close();
    console.log(`[PASS] independent-card-choice-equivalence: total=${result.value} inputs=1`);
    const publicPort = createAnalysisPort({ composition: comp, seatId: actor.actorId });
    const publicRoot = publicPort.openRoot();
    const grantId = publicRoot.observation.selfState.hand.find(card => card.cardId === "b_48.webp").id;
    const grant = publicPort.expand(publicRoot, publicRoot.legalActions.find(action => action.family === "play_card"
      && action.target?.cardInstanceId === grantId).actionId);
    const revealed = publicPort.expand(grant, grant.legalActions[0].actionId);
    if (revealed.status !== "information-barrier") throw new Error("公共补牌未停在信息边界");
    const publicStandard = outcomeModel.createDecisionObservation(revealed.observation, { seatId: actor.actorId });
    const publicValue = evaluator(revealed.observation);
    if (publicValue !== evaluator(publicStandard)) throw new Error("公共补牌屏障的原始/标准估值不一致");
    publicPort.close();
    console.log(`[PASS] independent-public-pick-barrier: total=${publicValue}`);
    const moneyPort = createAnalysisPort({ composition: comp, seatId: actor.actorId });
    const moneyRoot = moneyPort.openRoot(), upper = moneyPort.openingMoneyCapacity(moneyRoot);
    const converted = moneyPort.expand(moneyRoot, moneyRoot.legalActions.find(action =>
      action.target?.tradeId === "credits-for-energy").actionId);
    const lower = moneyPort.openingMoneyCapacity(converted);
    if (!upper || !lower || upper.group !== lower.group || upper.moneyCapacity.energy !== 2
      || upper.credits + upper.energy <= lower.credits + lower.energy) throw new Error("生产性钱包界审计未进入实际跨钱包关系");
    for (const node of [moneyRoot, converted]) {
      const standard = outcomeModel.createDecisionObservation(node.observation, { seatId: actor.actorId });
      if (evaluator(node.observation) !== evaluator(standard)) throw new Error("生产性钱包界的原始/标准估值不一致");
    }
    console.log(`[PASS] independent-opening-money-capacity: delta=${evaluator(moneyRoot.observation) - evaluator(converted.observation)}`);
    const opening = moneyPort.openingPlanSpec(moneyRoot);
    const corner = moneyRoot.legalActions.find(action => action.family === "card_corner" && action.payload?.kind === "resource");
    if (!opening || !opening.retainedActionIds.includes(corner?.actionId)) throw new Error("5手牌PASS角标未保留");
    const afterCorner = moneyPort.expand(moneyRoot, corner.actionId), afterOpening = moneyPort.openingPlanSpec(afterCorner);
    if (!afterOpening || afterCorner.legalActions.some(action => action.family === "card_corner"
      && !afterOpening.excludedActionIds.includes(action.actionId))) throw new Error("4手牌后的无收益角标未进入路径证明");
    const openingStandard = outcomeModel.createDecisionObservation(afterCorner.observation, { seatId: actor.actorId });
    if (evaluator(afterCorner.observation) !== evaluator(openingStandard)) throw new Error("开局准备路径的原始/标准估值不一致");
    console.log(`[PASS] independent-opening-plan: total=${evaluator(afterCorner.observation)}`);
    const passMacro = moneyPort.expandOpeningPass(moneyRoot, corner.actionId);
    const passStandard = outcomeModel.createDecisionObservation(passMacro.node.observation, { seatId: actor.actorId });
    if (passMacro.submissions !== 2 || evaluator(passMacro.node.observation) !== evaluator(passStandard)) {
      throw new Error("开局角标PASS合并路径的实际输入数或标准估值不一致");
    }
    console.log(`[PASS] independent-opening-pass-normal-form: total=${evaluator(passMacro.node.observation)}`);
    moneyPort.close();
    const initialEnv = createSimulationEnv();
    try {
      initialEnv.reset({ seed: "seti-free-analyze-v1", agentType: "completion", compactReplay: true });
      if (!comp.lifecycle.restore(initialEnv.createCheckpoint().coreState.compositionEnvelope).ok) throw new Error("初始发牌审计恢复失败");
      const ownerId = comp.inspect().session.decision.ownerId;
      const initialValue = independentValue.createStateValueEvaluator(ownerId);
      const startPort = createAnalysisPort({ composition: comp, seatId: ownerId }), startRoot = startPort.openRoot();
      const offered = startPort.expand(startRoot, startRoot.legalActions.find(action => action.target?.kind === "start_initial_setup").actionId);
      if (offered.status !== "information-barrier" || offered.observation.publicState.resident.initialSetup.offer !== null) {
        throw new Error("初始发牌未停在已遮蔽选项的信息边界");
      }
      if (initialValue(offered.observation) !== initialValue(outcomeModel.createDecisionObservation(offered.observation, { seatId: ownerId }))) {
        throw new Error("初始选项边界的原始/标准估值不一致");
      }
      startPort.close();
      for (let i = 0; i < 64 && !initialEnv.legalActions().some(action => action.target?.kind === "discard-hand-cards"); i += 1) initialEnv.runAgentDecision();
      if (!comp.lifecycle.restore(initialEnv.createCheckpoint().coreState.compositionEnvelope).ok) throw new Error("初始收入审计恢复失败");
      const incomeSeat = comp.inspect().session.decision.ownerId;
      const incomeValue = independentValue.createStateValueEvaluator(incomeSeat);
      const incomePort = createAnalysisPort({ composition: comp, seatId: incomeSeat }), incomeRoot = incomePort.openRoot();
      const incomeCard = incomeRoot.observation.selfState.hand.find(card => card.incomeCode === 2);
      const incomeAction = incomeRoot.legalActions.find(action => action.target?.cardIds?.includes(incomeCard?.cardId));
      if (!incomeAction) throw new Error("初始收入审计缺少真实盲抽来源");
      const incomeLeaf = incomePort.expand(incomeRoot, incomeAction.actionId);
      if (incomeLeaf.status !== "information-barrier" || incomeValue(incomeLeaf.observation)
        !== incomeValue(outcomeModel.createDecisionObservation(incomeLeaf.observation, { seatId: incomeSeat }))) {
        throw new Error("初始收入盲抽的边界或原始/标准估值不一致");
      }
      incomePort.close();
      console.log(`[PASS] independent-initial-information: offer=${initialValue(offered.observation)} income=${incomeValue(incomeLeaf.observation)}`);
    } finally { initialEnv.dispose(); }
    const incomeFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/case-011-20261023-v1.json")));
    const incomeSeed = incomeFixture.source.seed;
    const incomeKernel = createSimulationRuleComposition({ seed: incomeSeed, random: createSeededRandom(incomeSeed),
      activePlayerCount: 4, trustedProjectionReader: true,
      projectCounterfactualState: (state, viewer) => buildRuleObservation(state, incomeSeed, viewer?.playerId) });
    let incomePort;
    try {
      incomeKernel.newGame({ seed: incomeSeed });
      if (!incomeKernel.composition.lifecycle.restore(incomeFixture.compositionEnvelope).ok) throw new Error("主行动后收入审计恢复失败");
      incomePort = createAnalysisPort({ composition: incomeKernel.composition, seatId: incomeFixture.seatId });
      let node = incomePort.openRoot();
      const proof = incomePort.postMainPlanSpec(node);
      if (!proof?.incomeReachable || proof.retainedDataCardCount !== 2) throw new Error("主行动后收入审计未进入实际保留路径");
      const evaluateIncome = independentValue.createStateValueEvaluator(incomeFixture.seatId);
      for (let count = 0; count < 4; count += 1) {
        node = incomePort.expand(node, node.legalActions.find(action => action.family === "place_data").actionId);
        node = incomePort.expand(node, node.legalActions.find(action => action.target?.target === "computer").actionId);
      }
      const beforeValue = evaluateIncome(node.observation);
      const cashCard = node.observation.selfState.hand.find(card => card.incomeCode === 0);
      node = incomePort.expand(node, node.legalActions.find(action => action.target?.cardInstanceId === cashCard?.id).actionId);
      const rawValue = evaluateIncome(node.observation);
      const standardValue = evaluateIncome(outcomeModel.createDecisionObservation(node.observation, { seatId: incomeFixture.seatId }));
      const delta = rawValue - beforeValue;
      if (node.status !== "stable" || rawValue !== standardValue || delta !== 4 - node.observation.publicState.roundNumber) {
        throw new Error("主行动后现金收入的正式输入、原始/标准估值或未来窗口不一致");
      }
      console.log(`[PASS] independent-post-main-income: delta=${delta} retainedData=${proof.retainedDataCardCount}`);
    } finally { incomePort?.close(); incomeKernel.composition.dispose(); }
    const sectorFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json")));
    const sectorSeed = sectorFixture.source.seed;
    const sectorKernel = createSimulationRuleComposition({ seed: sectorSeed, random: createSeededRandom(sectorSeed),
      activePlayerCount: 4, trustedProjectionReader: true,
      projectCounterfactualState: (state, viewer) => buildRuleObservation(state, sectorSeed, viewer?.playerId) });
    try {
      sectorKernel.newGame({ seed: sectorSeed });
      const sectorComp = sectorKernel.composition;
      const evaluateSector = independentValue.createStateValueEvaluator(sectorFixture.seatId);
      for (const cardId of [null, "b_114.webp", "dlc_9.png"]) {
        if (!sectorComp.lifecycle.restore(sectorFixture.compositionEnvelope).ok) throw new Error("扇区任务审计恢复失败");
        if (cardId) {
          const state = JSON.parse(sectorFixture.compositionEnvelope.committedState);
          const instanceId = state.players.players.find(player => player.id === sectorFixture.seatId)
            .hand.find(card => card.cardId === cardId).id;
          const action = sectorComp.inputPort.enumerateActions({}).find(candidate => candidate.family === "play_card"
            && candidate.target?.cardInstanceId === instanceId);
          if (!action || !sectorComp.inputPort.submitAction(action).ok) throw new Error("扇区任务真实打牌失败");
          for (let step = 0; step < 24 && sectorComp.inspect().phase === "awaiting_input"; step += 1) {
            const decision = sectorComp.inspect().session.decision;
            if (!sectorComp.inputPort.submitDecision({ decisionId: decision.decisionId, decisionVersion: decision.decisionVersion,
              ownerId: decision.ownerId, choice: decision.choices[0] }).ok) throw new Error("扇区任务条件输入失败");
          }
        }
        const sectorPort = createAnalysisPort({ composition: sectorComp, seatId: sectorFixture.seatId });
        try {
          const root = sectorPort.openRoot();
          const proof = cardId ? sectorPort.postMainPlanSpec(root) : sectorPort.openingPlanSpec(root);
          const rawValue = evaluateSector(root.observation);
          if (!proof || rawValue !== evaluateSector(outcomeModel.createDecisionObservation(root.observation,
            { seatId: sectorFixture.seatId }))) throw new Error("异星实验室准备或扇区任务的证明/原始标准估值不一致");
          console.log(`[PASS] independent-alien-opening-sector-task: card=${cardId || "opening"} total=${rawValue}`);
          const trade = root.legalActions.find(action => action.target?.tradeId === "energy-for-card");
          const pending = sectorPort.expand(root, trade.actionId), bound = sectorPort.cardTradeBound(pending);
          const leaf = sectorPort.expand(pending, pending.legalActions[0].actionId);
          if (!bound || evaluateSector(leaf.observation) !== independentValue.evaluateHandCountDelta(evaluateSector, pending.observation, 1)
            || evaluateSector(leaf.observation) !== evaluateSector(outcomeModel.createDecisionObservation(leaf.observation,
              { seatId: sectorFixture.seatId }))) throw new Error("公司/扇区任务取牌的数量界或标准估值不一致");
          console.log(`[PASS] independent-company-card-trade: card=${cardId || "opening"} total=${evaluateSector(leaf.observation)}`);
        } finally { sectorPort.close(); }
      }
      if (!sectorKernel.composition.lifecycle.restore(sectorFixture.compositionEnvelope).ok) throw new Error("PASS预留审计恢复失败");
      const pass = sectorKernel.composition.inputPort.enumerateActions({}).find(action => action.family === "pass");
      if (!sectorKernel.composition.inputPort.submitAction(pass).ok) throw new Error("PASS预留审计提交失败");
      const passPort = createAnalysisPort({ composition: sectorKernel.composition, seatId: sectorFixture.seatId });
      try {
        const root = passPort.openRoot(), proof = passPort.passReserveChoiceSpec(root);
        const evaluate = independentValue.createStateValueEvaluator(sectorFixture.seatId);
        const result = searchDecision({ port: passPort, root, evaluate, cardChoiceEquivalence: true });
        const leaf = passPort.expand(root, result.actionId);
        if (!proof || !result.complete || result.diagnostics.transitions !== 1 || leaf.status !== "other-owner"
          || result.value !== evaluate(leaf.observation) || result.value !== independentValue.evaluateHandCountDelta(evaluate, root.observation, 1)
          || result.value !== evaluate(outcomeModel.createDecisionObservation(leaf.observation, { seatId: sectorFixture.seatId }))) {
          throw new Error("PASS预留的数量界、边界或标准估值不一致");
        }
        console.log(`[PASS] independent-pass-reserve-choice: total=${result.value} inputs=1`);
      } finally { passPort.close(); }
    } finally { sectorKernel.composition.dispose(); }
    const searchFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/case-003-20261023-v1.json")));
    const searchEnv = createSimulationEnv();
    try {
      searchEnv.reset({ seed: searchFixture.source.seed, agentType: "search", compactReplay: true });
      const checkpoint = searchEnv.createCheckpoint();
      checkpoint.coreState.committedState = searchFixture.compositionEnvelope.committedState;
      checkpoint.coreState.compositionEnvelope = searchFixture.compositionEnvelope;
      searchEnv.loadCheckpoint(checkpoint);
      const raw = searchEnv.observe(searchFixture.seatId);
      const result = searchEnv.runAgentDecision();
      const evaluate = independentValue.createStateValueEvaluator(searchFixture.seatId);
      if (result.agentTrace.coverage !== "complete" || result.searches.length !== 1
        || !result.searches[0].complete || evaluate(raw) !== evaluate(result.agentTrace.context.observation)) {
        throw new Error("共享搜索玩家的输入或完成证据不一致");
      }
      console.log(`[PASS] independent-shared-search-agent: root=${evaluate(raw)} leaf=${result.searches[0].value}`);
    } finally { searchEnv.dispose(); }
    const prefixFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/case-011-20261023-v1.json")));
    const prefixEnv = createSimulationEnv();
    try {
      prefixEnv.reset({ seed: prefixFixture.source.seed, agentType: "search", compactReplay: true });
      const checkpoint = prefixEnv.createCheckpoint();
      checkpoint.coreState.committedState = prefixFixture.compositionEnvelope.committedState;
      checkpoint.coreState.compositionEnvelope = prefixFixture.compositionEnvelope;
      prefixEnv.loadCheckpoint(checkpoint);
      const first = prefixEnv.runAgentDecision(), raw = prefixEnv.observe(prefixFixture.seatId);
      const next = prefixEnv.runAgentDecision(), evaluate = independentValue.createStateValueEvaluator(prefixFixture.seatId);
      if (!first.searches[0].planEvidence || next.searches[0].diagnostics.planContinuation !== "hit"
        || next.searches[0].diagnostics.transitions !== 0 || first.searches[0].value !== next.searches[0].value
        || evaluate(raw) !== evaluate(next.agentTrace.context.observation)) throw new Error("最优前缀复用的完成证据或原始/标准输入不一致");
      console.log(`[PASS] independent-plan-prefix-reuse: root=${evaluate(raw)} leaf=${next.searches[0].value} inputs=0`);
    } finally { prefixEnv.dispose(); }
  } catch (error) {
    console.log(`[FAIL] independent-card-choice-equivalence: ${error.message}`);
    allPass = false;
  } finally {
    auditKernel?.composition.dispose();
  }
}

// 路径 3：启发式 actionOutcomes 的 leaf.observation —— 必须 PASS
// （evaluateActionOutcomes 旧入口已删除；统一用真实决策 runHeuristicPolicyDecision
// 返回的 actionOutcomes，与决策函数同一搜索参数）
const legal = env.legalActions();
const policyResult = env.runHeuristicPolicyDecision();
const proj = policyResult.actionOutcomes;
const leafWithObs = proj.find((o) => o?.leaves?.some((l) => l?.observation));
if (leafWithObs) {
  const leafObs = leafWithObs.leaves.find((l) => l?.observation)?.observation;
  allPass = auditObservation("heuristic-leaf(反事实叶)", leafObs, seatId) && allPass;
} else {
  console.log("[WARN] 无带 observation 的叶");
  allPass = false;
}

// 路径 4：V 引导 fork 的 projection().state —— 需经 v-guided-search 内部装配
const fork = env.createCounterfactualFork(null, { branchKey: "audit" });
const comp = fork.composition || fork;
const forkState = comp.projection().state;
allPass = auditObservation("vguided-fork(原始, 需装配)", forkState, seatId, false) && allPass;
try { comp.dispose?.(); } catch (_e) { /* noop */ }

// 路径 5：Browser projectBrowserState 信息层（host-unify 修复）—— 必须 PASS。
// 修复前 Browser 机器席位 projection.state 是 UI 展示视图（resident 被读模型替换），
// createDecisionObservation 取不到 players/hand → observation 失明（V=0 或 THROW）。
// 现在信息层与 Simulation buildRuleObservation 同源（app/rule-observation.js），
// 此路径必须与路径 2 一样完整。
{
  const productionKernel = require("../randomizer/game/production-kernel");
  const projectionAdapter = require("../randomizer/app/browser-host/projection-adapter");
  const browserRuleCompositionModule = require("../randomizer/app/browser-rule-composition");
  let randomState = 1;
  const browserRandom = () => {
    randomState = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
    randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), 61 | randomState);
    return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296;
  };
  browserRandom.getState = () => randomState >>> 0;
  browserRandom.setState = (next) => { randomState = Number(next) >>> 0 || 1; };
  const browserComp = browserRuleCompositionModule.createBrowserRuleComposition({
    productionKernelApi: productionKernel,
    random: browserRandom,
    seed: `${seed}:browser-audit`,
    activePlayerCount: 4,
    hostServices: {},
    browserProjection: {
      visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => ({ project: () => ({ players: [] }) }),
      getBrowserReadModelOwner: () => ({ project: () => ({ render: {} }) }),
      createRenderPresentation: () => ({}),
    },
  });
  browserComp.newGame({ seed: `${seed}:browser-audit`, activePlayerCount: 4 });
  browserComp.inputPort.beginDrain({ metadata: { source: "audit" } });
  const browserInspection = browserComp.inspect();
  const browserOwner = browserInspection.session?.decision?.ownerId
    || browserComp.projectionSource.read().state?.match?.currentPlayerId
    || null;
  if (!browserOwner) {
    console.log("[FAIL] Browser 路径无法解析决策 owner");
    allPass = false;
  } else {
    const browserProjected = browserComp.projection({
      viewerId: `machine:${browserOwner}`,
      playerId: browserOwner,
      role: "player",
    });
    const browserObs = outcomeModel.createDecisionObservation(browserProjected.state, {
      seatId: browserOwner,
      stateVersion: null,
      decisionVersion: null,
    });
    allPass = auditObservation("browser-info-layer(机器席位观察)", browserObs, browserOwner) && allPass;
    const rawPlayers = browserObs.publicState?.players;
    const playerCount = Array.isArray(rawPlayers)
      ? rawPlayers.length
      : (Array.isArray(rawPlayers?.players) ? rawPlayers.players.length : 0);
    if (playerCount < 1) {
      console.log("[FAIL] Browser 机器席位观察 publicState.players 为空（信息层缺失，修复前失明症状）");
      allPass = false;
    }
  }
  browserComp.dispose?.();
}

env.dispose();
console.log(allPass ? "\nV 输入审计全部通过" : "\nV 输入审计有 FAIL（见上，检查对应调用点装配）");
process.exit(allPass ? 0 : 1);
