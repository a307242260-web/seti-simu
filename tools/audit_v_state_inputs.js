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
          if (cardId === "b_114.webp") {
            const bound = sectorPort.postMainValueBound(root), attained = sectorPort.expandPostMainOptimalPlan(root);
            if (!bound || bound.continuationProof !== proof.proof || !attained.complete) throw new Error("静止继续路径的组合界/实际见证缺失");
            for (const node of [...attained.prefixes.map(prefix => prefix.node), attained.node]) {
              if (evaluateSector(node.observation) !== evaluateSector(outcomeModel.createDecisionObservation(node.observation,
                { seatId: sectorFixture.seatId }))) throw new Error("静止继续路径组合的原始/标准估值不一致");
            }
            if (evaluateSector(attained.node.observation) !== rawValue + bound.maximumValueIncrease) throw new Error("静止继续路径未达到组合上界");
            console.log(`[PASS] independent-quiet-bound-composition: root=${rawValue} leaf=${evaluateSector(attained.node.observation)}`);
          }
          if (!cardId) {
            const scan = root.legalActions.find(action => action.family === "scan"), bound = sectorPort.standardScanValueBound(root);
            const first = sectorPort.expand(root, scan.actionId), firstBound = sectorPort.standardScanValueBound(first);
            if (!bound || !firstBound) throw new Error("普通扫描根/已付款收益界缺失");
            let leaves = 0;
            for (const chosen of first.legalActions) {
              const pub = sectorPort.expand(first, chosen.actionId), pubBound = sectorPort.standardScanValueBound(pub);
              if (!pubBound) throw new Error("公共扫描收益界缺失");
              for (const selected of pub.legalActions) {
                const leaf = sectorPort.expand(pub, selected.actionId);
                for (const node of [root, first, pub, leaf]) if (evaluateSector(node.observation) !== evaluateSector(
                  outcomeModel.createDecisionObservation(node.observation, { seatId: sectorFixture.seatId }))) throw new Error("扫描阶段原始/标准估值不一致");
                if (leaf.status !== "information-barrier" || evaluateSector(leaf.observation) > rawValue + bound.valueDelta
                  || evaluateSector(leaf.observation) > evaluateSector(first.observation) + firstBound.valueDelta
                  || evaluateSector(leaf.observation) > evaluateSector(pub.observation) + pubBound.valueDelta) throw new Error("真实补牌边界超出扫描上界");
                leaves += 1;
              }
            }
            console.log(`[PASS] independent-standard-scan-refill-bound: stages=3 leaves=${leaves}`);
          }
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
      if (!first.searches[0].planEvidence || next.searches[0].diagnostics.planContinuation === "hit"
        || next.searches[0].diagnostics.transitions <= 0 || first.searches[0].value !== next.searches[0].value
        || evaluate(raw) !== evaluate(next.agentTrace.context.observation)) throw new Error("资源准备重算的完成证据或原始/标准输入不一致");
      console.log(`[PASS] independent-resource-prefix-replan: root=${evaluate(raw)} leaf=${next.searches[0].value} inputs=${next.searches[0].diagnostics.transitions}`);
    } finally { prefixEnv.dispose(); }
    for (const id of ["062", "105", "152"]) {
      const moneyFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
        `../adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`)));
      const moneyComp = auditKernel.composition;
      if (!moneyComp.lifecycle.restore(moneyFixture.compositionEnvelope).ok) throw new Error("已知模型钱包审计恢复失败");
      const moneyPort = createAnalysisPort({ composition: moneyComp, seatId: moneyFixture.seatId });
      try {
        const root = moneyPort.openRoot(), proof = moneyPort.knownCardMoneyOrder(root);
        const first = moneyPort.expand(root, root.legalActions.find(action => action.target?.tradeId === "credits-for-energy").actionId);
        const poor = moneyPort.expand(first, first.legalActions.find(action => action.target?.tradeId === "energy-for-credit").actionId);
        const evaluate = independentValue.createStateValueEvaluator(moneyFixture.seatId);
        if (!proof || moneyPort.knownCardMoneyOrder(poor)?.group !== proof.group
          || evaluate(root.observation) !== evaluate(outcomeModel.createDecisionObservation(root.observation, { seatId: moneyFixture.seatId }))
          || evaluate(poor.observation) !== evaluate(outcomeModel.createDecisionObservation(poor.observation, { seatId: moneyFixture.seatId }))
          || evaluate(root.observation) - evaluate(poor.observation) !== 2) throw new Error("已知模型钱包证明、原始/标准V或严格余额差不一致");
        console.log(`[PASS] independent-known-card-money: case=${id} root=${evaluate(root.observation)} poor=${evaluate(poor.observation)}`);
        const purchase = moneyPort.expand(root, root.legalActions.find(action => action.target?.tradeId === "credits-for-card").actionId);
        const tradeBound = moneyPort.cardTradeBound(purchase);
        const acquired = moneyPort.expand(purchase, purchase.legalActions[0].actionId);
        if (!tradeBound || acquired.status !== "information-barrier"
          || evaluate(acquired.observation) !== independentValue.evaluateHandCountDelta(evaluate, purchase.observation, tradeBound.handDelta)
          || evaluate(acquired.observation) !== evaluate(outcomeModel.createDecisionObservation(acquired.observation, { seatId: moneyFixture.seatId }))) {
          throw new Error("保留牌交易数量界、实际出口或原始/标准V不一致");
        }
        console.log(`[PASS] independent-trade-reservation: case=${id} leaf=${evaluate(acquired.observation)}`);
      } finally { moneyPort.close(); }
    }
    {
      const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
        "../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json")));
      const comp = auditKernel.composition;
      if (!comp.lifecycle.restore(fixture.compositionEnvelope).ok) throw new Error("主行动后借用审计恢复失败");
      const play = comp.inputPort.enumerateActions({}).find(action => action.family === "play_card"
        && action.target?.cardInstanceId === "card-3-0");
      if (!play || !comp.inputPort.submitAction(play).ok) throw new Error("主行动后借用审计正式打牌失败");
      const port = createAnalysisPort({ composition: comp, seatId: fixture.seatId });
      try {
        const root = port.openRoot(), proof = port.postMainBorrowSpec(root);
        const evaluate = independentValue.createStateValueEvaluator(fixture.seatId);
        if (!proof || proof.retainedTileIds.join(",") !== "orange2") throw new Error("主行动后借用审计缺少可达移动科技");
        const macro = port.expandPostMainBorrow(root, "orange2");
        for (const node of [root, macro.node]) if (evaluate(node.observation)
          !== evaluate(outcomeModel.createDecisionObservation(node.observation, { seatId: fixture.seatId }))) {
          throw new Error("主行动后借用原始/标准V不一致");
        }
        if (macro.submissions !== 2 || evaluate(root.observation) !== evaluate(macro.node.observation)) {
          throw new Error("主行动后借用输入计数或即时V变化不一致");
        }
        console.log(`[PASS] independent-post-main-borrow: root=${evaluate(root.observation)} inputs=2 excluded=${proof.excludedTileIds.length}`);
        const bound = port.postMainValueBound(root), optimal = port.postMainOptimalPlanSpec(root);
        if (!bound || !optimal || optimal.submissions !== 10) throw new Error("主行动后最优计划审计缺少上界或完整最短计划");
        const attained = port.expandPostMainOptimalPlan(root);
        for (const node of [...attained.prefixes.map(prefix => prefix.node), attained.node]) {
          if (evaluate(node.observation) !== evaluate(outcomeModel.createDecisionObservation(node.observation, { seatId: fixture.seatId }))) {
            throw new Error("达到上界的内部前缀原始/标准V不一致");
          }
        }
        if (!attained.complete || attained.submissions !== 10 || evaluate(attained.node.observation)
          !== evaluate(root.observation)+bound.maximumValueIncrease) throw new Error("主行动后上界与实际最短完成见证不一致");
        console.log(`[PASS] independent-post-main-attainment: root=${evaluate(root.observation)} leaf=${evaluate(attained.node.observation)} prefixes=${attained.prefixes.length}`);
      } finally { port.close(); }
    }
    {
      const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
        "../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json")));
      const comp = auditKernel.composition;
      if (!comp.lifecycle.restore(fixture.compositionEnvelope).ok) throw new Error("目标移动审计恢复失败");
      const play = comp.inputPort.enumerateActions({}).find(a => a.family === "play_card" && a.target?.cardInstanceId === "card-40-0");
      if (!comp.inputPort.submitAction(play).ok) throw new Error("目标移动审计打牌失败");
      const port = createAnalysisPort({ composition: comp, seatId: fixture.seatId });
      try {
        port.setMovementPlanning(true);
        const root = port.openRoot(), spec = port.goalMovementSpec(root), evaluate = independentValue.createStateValueEvaluator(fixture.seatId);
        const macro = port.expandGoalMovementPlan(root);
        if (!spec?.chosenGoal || !macro.complete || macro.submissions !== 4) throw new Error("目标移动路线或成本错误");
        for (const node of [...macro.prefixes.map(p => p.node), macro.node]) if (evaluate(node.observation) !== evaluate(
          outcomeModel.createDecisionObservation(node.observation, { seatId: fixture.seatId }))) throw new Error("目标移动原始/标准估值不一致");
        console.log(`[PASS] independent-goal-movement: inputs=${macro.submissions} goal=${spec.chosenGoal.id}`);
      } finally { port.close(); }
    }
    {
      const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json")));
      const comp=auditKernel.composition;
      if(!comp.lifecycle.restore(fixture.compositionEnvelope).ok)throw new Error("固定选牌审计恢复失败");
      const start=comp.inputPort.enumerateActions({}).find(a=>a.target?.tradeId==="cards-for-pick-card");
      if(!comp.inputPort.submitQuickAction(start).ok)throw new Error("固定选牌审计启动失败");
      const port=createAnalysisPort({composition:comp,seatId:fixture.seatId});
      try{port.setCardPickPlanning(true);const root=port.openRoot(),spec=port.cardPickSpec(root),evaluate=independentValue.createStateValueEvaluator(fixture.seatId);
        const macro=port.expandWithCardPick(root,spec.selectedActionId,()=>null);
        if(!macro.complete||macro.submissions!==4)throw new Error("固定选牌原生输入数错误");
        for(const node of [...macro.prefixes.map(p=>p.node),macro.node])if(evaluate(node.observation)!==evaluate(outcomeModel.createDecisionObservation(node.observation,{seatId:fixture.seatId})))throw new Error("固定选牌原始/标准估值不一致");
        console.log(`[PASS] independent-fixed-card-pick: inputs=${macro.submissions} fixedChoices=${macro.fixedChoices.length}`);
      }finally{port.close();}
    }
    {
      const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json"))),comp=auditKernel.composition;
      if(!comp.lifecycle.restore(fixture.compositionEnvelope).ok)throw new Error("资源准备审计恢复失败");
      const before=JSON.stringify(comp.lifecycle.save().envelope),port=createAnalysisPort({composition:comp,seatId:fixture.seatId});
      try{port.setResourcePlanning(true);port.setCardPickPlanning(true);const root=port.openRoot(),spec=port.resourceSpec(root),evaluate=independentValue.createStateValueEvaluator(fixture.seatId);
        const plan=spec.plans.find(p=>p.goal.kind==="income");if(!plan)throw new Error("缺少收入数据目标");
        const macro=port.expandResourcePlan(root,plan,()=>null);if(!macro.complete||macro.goalStatus!=="completed")throw new Error("资源准备目标未完成");
        for(const node of [...macro.prefixes.map(p=>p.node),macro.node])if(evaluate(node.observation)!==evaluate(outcomeModel.createDecisionObservation(node.observation,{seatId:fixture.seatId})))throw new Error("资源准备原始/标准估值不一致");
        if(JSON.stringify(comp.lifecycle.save().envelope)!==before)throw new Error("资源准备改变权威根");
        console.log(`[PASS] independent-resource-goal-preparation: inputs=${macro.submissions} goal=${plan.goal.id}`);
      }finally{port.close();}
    }
    {
      const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json"))),comp=auditKernel.composition;
      if(!comp.lifecycle.restore(fixture.compositionEnvelope).ok)throw new Error("共享资源前缀审计恢复失败");
      const before=JSON.stringify(comp.lifecycle.save().envelope),port=createAnalysisPort({composition:comp,seatId:fixture.seatId,maxCacheEntries:0});
      try{port.setResourcePlanning(true);const root=port.openRoot(),plans=port.resourceSpec(root).plans.filter(p=>p.goal.kind==="research_tech").slice(0,20),evaluate=independentValue.createStateValueEvaluator(fixture.seatId);
        for(const plan of plans){const macro=port.expandResourcePlan(root,plan,()=>null);if(!macro.complete||macro.submissions!==8)throw new Error("共享前缀改变科技路径");
          for(const node of [...macro.prefixes.map(p=>p.node),macro.node])if(evaluate(node.observation)!==evaluate(outcomeModel.createDecisionObservation(node.observation,{seatId:fixture.seatId})))throw new Error("共享前缀原始/标准估值不一致");}
        if(port.getDiagnostics().submissionCount!==27||port.getResourcePrefixGraph().nodes.length!==28)throw new Error("共享前缀未合并实际执行");
        if(JSON.stringify(comp.lifecycle.save().envelope)!==before)throw new Error("共享前缀改变权威根");
        console.log('[PASS] independent-shared-resource-prefix: goals=20 nativeInputs=27 states=28');
      }finally{port.close();}
    }
    const cornerFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/post-main-corner-pair-20261023-v1.json")));
    const cornerComp = auditKernel.composition;
    if (!cornerComp.lifecycle.restore(cornerFixture.compositionEnvelope).ok) throw new Error("主行动后角标审计恢复失败");
    const cornerPort = createAnalysisPort({ composition: cornerComp, seatId: cornerFixture.seatId });
    try {
      const root = cornerPort.openRoot(), proof = cornerPort.postMainCornerChoiceSpec(root);
      const evaluate = independentValue.createStateValueEvaluator(cornerFixture.seatId);
      const values = root.legalActions.filter(action => action.family === "card_corner").map(action => {
        const next = cornerPort.expand(root, action.actionId), raw = next.observation;
        const normalized = outcomeModel.createDecisionObservation(raw, { seatId: cornerFixture.seatId });
        if (evaluate(raw) !== evaluate(normalized)) throw new Error("主行动后角标原始/标准V不一致");
        return evaluate(raw);
      });
      if (!proof || values.length !== 2 || values[0] !== values[1]) throw new Error("主行动后角标范围或实际一步值不一致");
      console.log(`[PASS] independent-post-main-corner-choice: value=${values[0]} excluded=${proof.excludedActionIds.length}`);
    } finally { cornerPort.close(); }
    const inertFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json")));
    if (!cornerComp.lifecycle.restore(inertFixture.compositionEnvelope).ok) throw new Error("不活动保留牌审计恢复失败");
    const inertPlay = cornerComp.inputPort.enumerateActions({}).find(action => action.family === "play_card"
      && action.target?.cardInstanceId === "card-41-0");
    if (!inertPlay || !cornerComp.inputPort.submitAction(inertPlay).ok) throw new Error("不活动保留牌审计出牌失败");
    const inertDecision = cornerComp.inspect().session.decision;
    const inertSkip = inertDecision.choices.find(action => action.target?.skip);
    if (!inertSkip || !cornerComp.inputPort.submitDecision({ decisionId: inertDecision.decisionId,
      decisionVersion: inertDecision.decisionVersion, ownerId: inertDecision.ownerId, choice: inertSkip }).ok) throw new Error("不活动保留牌审计结束移动失败");
    const inertPort = createAnalysisPort({ composition: cornerComp, seatId: inertFixture.seatId });
    try {
      const root = inertPort.openRoot(), proof = inertPort.postMainPlanSpec(root);
      const evaluate = independentValue.createStateValueEvaluator(inertFixture.seatId);
      const raw = root.observation, normalized = outcomeModel.createDecisionObservation(raw, { seatId: inertFixture.seatId });
      if (!proof || evaluate(raw) !== evaluate(normalized)) throw new Error("不活动保留牌原始/标准V不一致");
      const end = root.legalActions.find(action => action.family === "end_turn");
      const after = inertPort.expand(root, end.actionId);
      if (after.status !== "other-owner" || evaluate(after.observation) !== evaluate(raw)) throw new Error("不活动保留牌正式结束值改变");
      console.log(`[PASS] independent-post-main-inert-reservations: value=${evaluate(raw)} excluded=${proof.excludedActionIds.length}`);
    } finally { inertPort.close(); }
    const preDataFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname,
      "../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json")));
    if (!cornerComp.lifecycle.restore(preDataFixture.compositionEnvelope).ok) throw new Error("主行动前数据审计恢复失败");
    const preDataPort = createAnalysisPort({ composition: cornerComp, seatId: preDataFixture.seatId });
    try {
      const root = preDataPort.openRoot(), proof = preDataPort.preMainDataPlanSpec(root);
      const evaluate = independentValue.createStateValueEvaluator(preDataFixture.seatId);
      const raw = root.observation, normalized = outcomeModel.createDecisionObservation(raw, { seatId: preDataFixture.seatId });
      if (!proof || evaluate(raw) !== evaluate(normalized)) throw new Error("主行动前数据原始/标准V不一致");
      const corner = root.legalActions.find(action => action.family === "card_corner" && proof.excludedActionIds.includes(action.actionId));
      const spent = preDataPort.expand(root, corner.actionId);
      const oldPass = preDataPort.expand(spent, spent.legalActions.find(action => action.family === "pass").actionId);
      let node = root;
      for (let index = 0; index < 4; index += 1) {
        node = preDataPort.expand(node, node.legalActions.find(action => action.family === "place_data").actionId);
        node = preDataPort.expand(node, node.legalActions.find(action => action.target?.target === "computer").actionId);
      }
      node = preDataPort.expand(node, node.legalActions.find(action => action.target?.cardInstanceId === corner.target.cardInstanceId).actionId);
      const cashPass = preDataPort.expand(node, node.legalActions.find(action => action.family === "pass").actionId);
      if (![oldPass, cashPass].every(node => ["other-owner", "information-barrier"].includes(node.status))
        || evaluate(cashPass.observation) <= evaluate(oldPass.observation)) throw new Error("主行动前数据正式PASS替代不占优");
      console.log(`[PASS] independent-pre-main-data-plan: root=${evaluate(raw)} cashPass=${evaluate(cashPass.observation)} oldPass=${evaluate(oldPass.observation)}`);
    } finally { preDataPort.close(); }
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
