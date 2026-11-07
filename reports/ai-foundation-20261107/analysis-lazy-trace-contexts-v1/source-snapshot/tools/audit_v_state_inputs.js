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
    const nativeChoiceValues=pending.legalActions.map(action=>evaluator(port.expand(pending,action.actionId).observation));
    if (!result.complete || result.value !== Math.max(...nativeChoiceValues) || rawBound !== standardBound
      || !independentValue.supportsLegacyValueProof(pending.observation)&&result.diagnostics.cardChoiceProofNodes!==0) {
      throw new Error("已知牌价值路径的原始/标准输入、原生最佳后继或模型证明门禁不一致");
    }
    const compact = port.valueObservation(pending);
    const full = pending.observation;
    if (JSON.stringify(compact.publicState)!==JSON.stringify(full.publicState)
      ||JSON.stringify(compact.selfState)!==JSON.stringify(full.selfState)
      ||compact.terminal!==full.terminal
      ||evaluator(compact)!==evaluator(full))throw new Error("精简估值投影改变正式字段或V");
    const weighted=independentValue.createStateValueEvaluator(actor.actorId,{weights:{credits:2,handSize:3}});
    if(weighted(compact)!==weighted(full))throw new Error("自定义线性权重的投影输入不一致");
    console.log(`[PASS] independent-value-projection: total=${evaluator(compact)} fullFactsEqual=true weightedEqual=true`);
    port.close();
    console.log(`[PASS] independent-card-choice-model-guard: total=${result.value} nativeChoices=${nativeChoiceValues.length} inputs=${result.diagnostics.transitions}`);
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
            const leafValue = evaluateSector(attained.node.observation), upper = rawValue + bound.maximumValueIncrease;
            if (leafValue > upper) throw new Error("原生继续路径超过组合上界");
            // Attainment belongs to the legacy linear-model contract. A funded
            // purpose ceiling is an upper bound and need not be attainable.
            const legacy = independentValue.supportsLegacyValueProof(root.observation);
            if (legacy && leafValue !== upper) throw new Error("线性模型静止继续路径未达到组合上界");
            console.log(`[PASS] independent-quiet-bound-composition: root=${rawValue} leaf=${leafValue} upper=${upper} legacyAttainment=${legacy}`);
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
        if (!proof || !result.complete || result.diagnostics.transitions !== (independentValue.supportsLegacyValueProof(root.observation)?1:root.legalActions.length) || leaf.status !== "other-owner"
          || result.value !== evaluate(leaf.observation) || result.value !== independentValue.evaluateHandCountDelta(evaluate, root.observation, 1)
          || result.value !== evaluate(outcomeModel.createDecisionObservation(leaf.observation, { seatId: sectorFixture.seatId }))) {
          throw new Error("PASS预留的数量界、边界或标准估值不一致");
        }
        console.log(`[PASS] independent-pass-reserve-choice: total=${result.value} inputs=${result.diagnostics.transitions}`);
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
      const savedPrefix=prefixEnv.createCheckpoint(),coldPrefix=createSimulationEnv();
      try {
        // Reuse is valid for a truly simulated prefix. Compare it to a fresh
        // planner with the same native checkpoint and no saved AI evidence.
        savedPrefix.machineAI={};coldPrefix.loadCheckpoint(savedPrefix);
        const next = prefixEnv.runAgentDecision(), cold=coldPrefix.runAgentDecision(), evaluate = independentValue.createStateValueEvaluator(prefixFixture.seatId);
        if (!first.searches[0].planEvidence || !next.searches[0].complete || !cold.searches[0].complete
          || first.searches[0].value!==next.searches[0].value || next.actionId!==cold.actionId || next.searches[0].value!==cold.searches[0].value
          || evaluate(raw)!==evaluate(next.agentTrace.context.observation))throw new Error("资源准备前缀证据、冷算或原始/标准输入不一致");
        if(next.searches[0].diagnostics.planContinuation==="hit" &&(next.searches[0].diagnostics.transitions!==0
          ||next.searches[0].reusedCoverage?.evidenceId!==first.searches[0].planEvidence.evidenceId))throw new Error("资源前缀复用没有绑定原完成证据");
        console.log(`[PASS] independent-resource-prefix-evidence: root=${evaluate(raw)} leaf=${next.searches[0].value} mode=${next.searches[0].diagnostics.planContinuation} coldInputs=${cold.searches[0].diagnostics.transitions}`);
      }finally{coldPrefix.dispose();}
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
        const rootV=independentValue.evaluateStateValue(root.observation,moneyFixture.seatId),poorV=independentValue.evaluateStateValue(poor.observation,moneyFixture.seatId);
        const missionDelta=rootV.components.probePotential-poorV.components.probePotential;
        if (!proof || moneyPort.knownCardMoneyOrder(poor)?.group !== proof.group
          || evaluate(root.observation) !== evaluate(outcomeModel.createDecisionObservation(root.observation, { seatId: moneyFixture.seatId }))
          || evaluate(poor.observation) !== evaluate(outcomeModel.createDecisionObservation(poor.observation, { seatId: moneyFixture.seatId }))
          || missionDelta<0 || rootV.total-poorV.total!==2+missionDelta) throw new Error("已知模型钱包证明、原始/标准V或含任务资金门槛的余额差不一致");
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
        if (!independentValue.supportsLegacyValueProof(root.observation)) {
          if (bound!==null||optimal!==null) throw new Error("早轮探测任务仍套用未证明的钱包上界");
          const end=port.expand(root,root.legalActions.find(a=>a.family==='end_turn').actionId);
          if(evaluate(end.observation)!==evaluate(outcomeModel.createDecisionObservation(end.observation,{seatId:fixture.seatId})))throw new Error("实际收尾原始/标准V不一致");
          console.log('[PASS] independent-post-main-continuation: earlyProbeDeclined=true actualNativeEnd=true');
        } else {
        if (!bound || !optimal || optimal.submissions !== 10) throw new Error("主行动后最优计划审计缺少上界或完整最短计划");
        const attained = port.expandPostMainOptimalPlan(root);
        for (const node of [...attained.prefixes.map(prefix => prefix.node), attained.node]) {
          if (evaluate(node.observation) !== evaluate(outcomeModel.createDecisionObservation(node.observation, { seatId: fixture.seatId }))) {
            throw new Error("达到上界的内部前缀原始/标准V不一致");
          }
        }
        const leafValue = evaluate(attained.node.observation), upper = evaluate(root.observation)+bound.maximumValueIncrease;
        const legacy = independentValue.supportsLegacyValueProof(root.observation);
        if (!attained.complete || attained.submissions !== 10 || leafValue > upper
          || legacy && leafValue !== upper) throw new Error("主行动后原生继续路径与适用模型的上界契约不一致");
        console.log(`[PASS] independent-post-main-continuation: root=${evaluate(root.observation)} leaf=${leafValue} upper=${upper} legacyAttainment=${legacy} prefixes=${attained.prefixes.length}`);
        }
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
      try{port.setResourcePlanning(true);const root=port.openRoot(),plans=port.resourceSpec(root).plans.filter(p=>p.goal.kind==="research_tech"),evaluate=independentValue.createStateValueEvaluator(fixture.seatId);
        for(const plan of plans){const macro=port.expandResourcePlan(root,plan,()=>null);if(!macro.complete||macro.submissions!==8)throw new Error("共享前缀改变科技路径");
          for(const node of [...macro.prefixes.map(p=>p.node),macro.node])if(evaluate(node.observation)!==evaluate(outcomeModel.createDecisionObservation(node.observation,{seatId:fixture.seatId})))throw new Error("共享前缀原始/标准估值不一致");}
        if(port.getDiagnostics().submissionCount!==18||port.getResourcePrefixGraph().nodes.length!==19)throw new Error("共享前缀未合并实际执行");
        if(JSON.stringify(comp.lifecycle.save().envelope)!==before)throw new Error("共享前缀改变权威根");
        console.log('[PASS] independent-shared-resource-prefix: goals=11 nativeInputs=18 states=19');
      }finally{port.close();}
    }
    {
      const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/fixed-decision-final-mark-20261028-v1.json"))),comp=auditKernel.composition;
      if(!comp.lifecycle.restore(fixture.compositionEnvelope).ok)throw new Error("局部标记审计恢复失败");
      const port=createAnalysisPort({composition:comp,seatId:fixture.seatId});try{port.setDecisionPlanning({finalMarkPlanning:true});const root=port.openRoot(),spec=port.localDecisionSpec(root),child=port.expand(root,spec.selectedActionId),evaluate=independentValue.createStateValueEvaluator(fixture.seatId);
        for(const n of [root,child])if(evaluate(n.observation)!==evaluate(outcomeModel.createDecisionObservation(n.observation,{seatId:fixture.seatId})))throw new Error("局部标记原始/标准估值不一致");
        const own=o=>o.publicState.players.find(p=>p.playerId===fixture.seatId);if(own(child.observation).finalScore-own(root.observation).finalScore!==spec.scores[0].currentValue)throw new Error("局部标记公式与正式分不一致");
        console.log('[PASS] independent-local-final-mark: nativeFormulaAndSelectedSuccessor');
      }finally{port.close();}
    }
    {
      const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json"))),comp=auditKernel.composition;if(!comp.lifecycle.restore(fixture.compositionEnvelope).ok)throw new Error("扫描目的审计恢复失败");
      const port=createAnalysisPort({composition:comp,seatId:fixture.seatId,maxCacheEntries:0});try{port.setResourcePlanning(true);port.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});const root=port.openRoot(),plans=port.resourceSpec(root).plans.filter(p=>p.goal.kind==='scan-flow'),evaluate=independentValue.createStateValueEvaluator(fixture.seatId);
        for(const p of plans){const r=port.expandResourcePlan(root,p,()=>null);if(!r.complete)throw new Error("扫描目的未完成");for(const n of [...r.prefixes.map(p=>p.node),r.node])if(evaluate(n.observation)!==evaluate(outcomeModel.createDecisionObservation(n.observation,{seatId:fixture.seatId})))throw new Error("扫描目的原始/标准估值不一致");}
        console.log('[PASS] independent-scan-purpose: allNativePrefixes');
      }finally{port.close();}
    }
    {
      const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json"))),comp=auditKernel.composition;
      if(!comp.lifecycle.restore(f.compositionEnvelope).ok)throw new Error("固定数据计划审计恢复失败");
      const p=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0});try{p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true});const root=p.openRoot(),goal=p.resourceSpec(root).plans.find(g=>g.goal.kind==='income'),r=p.expandResourcePlan(root,goal,()=>null),evaluate=independentValue.createStateValueEvaluator(f.seatId);
        if(!r.complete||r.fallbackReason)throw new Error("数据计划回退到搜索");
        for(const n of [...r.prefixes.map(x=>x.node),r.node])if(evaluate(n.observation)!==evaluate(outcomeModel.createDecisionObservation(n.observation,{seatId:f.seatId})))throw new Error("固定数据原始/标准估值不一致");
        const income=r.prefixes.find(x=>x.action.target?.choiceId?.startsWith('income:')),fixed=p.localDecisionSpec(income.node);if(!fixed||fixed.retainedActionIds.length!==1)throw new Error("收入没有固定");
        console.log('[PASS] independent-fixed-data-plan: nativePrefixesAndSingleIncome');
      }finally{p.close();}
    }
    {
      const captured=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/six-greedy-plan-fixtures-20261028-v1.json")));
      const paid=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json")));
      for(const [name,f] of [...Object.entries(captured.cases),['paid',paid]]){
        const comp=auditKernel.composition;if(!comp.lifecycle.restore(f.compositionEnvelope).ok)throw new Error("六类贪心审计恢复失败");
        const p=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0});try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});const n=p.openRoot(),evaluate=independentValue.createStateValueEvaluator(f.seatId);let nodes=[n];
          if(name==='paid'){const plan=p.resourceSpec(n).plans.find(g=>g.goal.paidRewardPolicy),r=p.expandResourcePlan(n,plan,()=>null);if(!r.complete)throw new Error("付款计划未完成");nodes.push(...r.prefixes.map(s=>s.node),r.node);}
          else if(name==='advance'){const r=p.expandGoalMovementPlan(n,()=>true);if(!r.complete)throw new Error("移动计划未完成");nodes.push(...r.prefixes.map(s=>s.node),r.node);}
          else if(name!=='income'&&name!=='blue'){const spec=p.localDecisionSpec(n),r=p.expandWithCardPick(n,spec.selectedActionId,()=>null);if(!r.complete)throw new Error("固定决定未完成");nodes.push(...r.prefixes.map(s=>s.node),r.node);}
          for(const node of nodes)if(evaluate(node.observation)!==evaluate(outcomeModel.createDecisionObservation(node.observation,{seatId:f.seatId})))throw new Error("六类贪心原始/标准估值不一致");
        }finally{p.close();}
      }
      console.log('[PASS] independent-six-greedy-plans: allNativePrefixesAndPolicyRoots');
    }
    {
      const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../adhoc/six-greedy-plan-fixtures-20261028-v1.json"))).cases.advance,comp=auditKernel.composition;
      if(!comp.lifecycle.restore(f.compositionEnvelope).ok)throw new Error("几何缓存审计恢复失败");const before=JSON.stringify(comp.lifecycle.save().envelope),p=createAnalysisPort({composition:comp,seatId:f.seatId});
      try{p.setResourcePlanning(true);p.setMovementPlanning(true);const root=p.openRoot(),r=p.expandGoalMovementPlan(root,()=>true),evaluate=independentValue.createStateValueEvaluator(f.seatId);
        if(!r.complete)throw new Error("几何复用路径未完成");
        for(const n of [...r.prefixes.map(s=>s.node),r.node])if(evaluate(n.observation)!==evaluate(outcomeModel.createDecisionObservation(n.observation,{seatId:f.seatId})))throw new Error("观察复用原始/标准估值不一致");
        if(JSON.stringify(comp.lifecycle.save().envelope)!==before)throw new Error("观察复用污染权威根");console.log('[PASS] independent-movement-preview-copy: frozenObservationsAndNativePrefixes');
      }finally{p.close();}
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

// A plan-value boundary has no native successor observation. Audit its value
// against a completed native plan, rather than passing a fictitious leaf to V.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{searchDecision}=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent');
  const f=JSON.parse(fs.readFileSync(require('node:path').resolve(__dirname,'../adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-037-20261030-v1.json'))),seed=f.source.seed;
  kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(state,viewer)=>buildRuleObservation(state,seed,viewer?.playerId)});kernel.newGame({seed});const comp=kernel.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);const decision=comp.inspect().session.decision,pick=decision.choices.find(a=>a.summary==='b_2.webp');assert(pick);assert(comp.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:pick}).ok);const before=comp.lifecycle.save().envelope;port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0});const root=port.openRoot(),evaluate=independentValue.createStateValueEvaluator(f.seatId),r=searchDecision({port,root,evaluate,...agent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:5000}});assert(r.complete);assert(r.diagnostics.nativeExecutions>0);assert.equal(r.diagnostics.incomePlanProofs,0);
  const summary=port.incomePlanSummary(root);assert.equal(summary,null);const demand=require('../randomizer/game/ai/resource-demand'),data=require('../randomizer/game/data'),state=JSON.parse(before.committedState),owner=state.players.players.find(p=>p.id===f.seatId),goal=demand.catalog({state,seatId:f.seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(owner)}}).find(g=>g.kind==='blue-data');assert(goal);const first=demand.step({state,seatId:f.seatId,goal,actions:root.legalActions,status:root.status});assert(first.actionId);const native=port.expandResourcePlan(root,{goal,operation:{},firstActionId:first.actionId,mode:'greedy'},()=>null);assert(native.complete);assert(r.value>=evaluate(native.node.observation),'complete search retains continuations after the native fixed preparation');assert.deepEqual(comp.lifecycle.save().envelope,before);
  console.log(`[PASS] independent-probe-plan-native-fallback: value=${r.value} nativeControlInputs=${native.submissions} inventedSuccessor=false`);
 }catch(error){console.log(`[FAIL] independent-probe-plan-native-fallback: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

{
 let kernel, port;
 try {
  const fs = require('node:fs'), assert = require('node:assert/strict');
  const { createSimulationRuleComposition } = require('../randomizer/training/simulation-rule-composition');
  const { createSeededRandom } = require('../randomizer/game/random');
  const { buildRuleObservation } = require('../randomizer/app/rule-observation');
  const { createAnalysisPort } = require('../randomizer/game/ai/analysis-port');
  const values = require('../randomizer/game/ai/state-value'), demand = require('../randomizer/game/ai/resource-demand');
  const nativePass = require('../randomizer/game/effects/probe-turn-session');
  for (const [name, legacyValue, windows] of [['autonomous', 54.5, 3], ['teacher58', 57.5, 2]]) {
   const expected=values.sumValueParts([legacyValue,(values.FORECAST.usefulScansPerLaterRound-2)*windows,11/3]);
   const f = JSON.parse(fs.readFileSync('adhoc/ai-decision-corpus-20261031-v98-pass-boundary-v1/'+name+'-after-pass-20261031-v1.json'));
   const seed = f.source.seed;
   kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
    trustedProjectionReader: true, projectCounterfactualState: (s, viewer) => buildRuleObservation(s, seed, viewer?.playerId) });
   kernel.newGame({ seed }); const c = kernel.composition; assert(c.lifecycle.restore(f.compositionEnvelope).ok);
   const original = c.lifecycle.save().envelope, session = original.session.session;
   assert(session.queue.some(e => e.type === nativePass.EFFECT_TYPES.PASS_COMMIT));
   assert(!session.workingState.turn.passedPlayerIds.includes(f.seatId));
   port = createAnalysisPort({ composition: c, seatId: f.seatId, maxCacheEntries: 0 });
   const root = port.openRoot(), full = values.evaluateStateValue(root.observation, f.seatId);
   assert(root.observation.publicState.passingPlayerIds.includes(f.seatId));
   assert.equal(full.total, expected); assert.deepEqual(values.evaluateStateValue(port.valueObservation(root), f.seatId), full);
   const state = { ...session.workingState, passingPlayerIds: nativePass.getPassingPlayerIds(session.workingState, session) };
   const owner = state.players.players.find(p => p.id === f.seatId);
   assert.equal(demand.heldAndResearchCapital(state, owner), full.components.handPotential + full.components.researchPotential);
   assert.deepEqual(c.lifecycle.save().envelope, original);
   port.close(); port = null; c.dispose(); kernel = null;
  }
  console.log('[PASS] independent-pass-investment-window: native PASS queue, formal IDs unchanged, held/paid terms and full/compact/canonical agree');
 } catch(error) { console.log(`[FAIL] independent-pass-investment-window: ${error.message}`); allPass=false; }
 finally { port?.close(); kernel?.composition.dispose(); }
}

// New typed inputs: computer progress and occupied blue slots must reach both
// state-backed preparation and formal observations without a fake successor.
{
 let kernel;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),demand=require('../randomizer/game/ai/resource-demand');
  const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-038-20261104-v1.json'))),seed=f.source.seed;
  kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:f.seatId}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:f.seatId,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(raw,f.seatId),state=JSON.parse(before.committedState),player=state.players.players.find(p=>p.id===f.seatId);
  assert.deepEqual(independentValue.evaluateStateValue(formal,f.seatId),value);assert.equal(value.total,independentValue.sumValueParts([64.5,11/3]));assert.equal(independentValue.probePotential(raw,f.seatId),value.components.probePotential);assert.equal(demand.planningCapital(state,player),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert.deepEqual(c.lifecycle.save().envelope,before);
  console.log('[PASS] independent-mission-data-continuation: state/formal occupied-blue and computer progress agree; shared native-funded purpose with prepaid computer ledger; root/RNG unchanged');
 }catch(error){console.log(`[FAIL] independent-mission-data-continuation: ${error.message}`);allPass=false;}
 finally{kernel?.composition.dispose();}
}

// Public income optionality must consume the same company mark, wallet and
// confirmed unknown-slot presence in formal observation and planning facts.
{
 let kernel;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),rules=require('../randomizer/game/rule-composition'),demand=require('../randomizer/game/ai/resource-demand');
  const ref=JSON.parse(fs.readFileSync('reports/ai-foundation-20261104/two-rounds-teacher-v2/v165-public-refill-funding-native-20261105-v2.json')),plan=ref.plans.find(p=>p.incomeCode===0&&!p.useSwap),seed=JSON.parse(plan.rootEnvelope.committedState).meta.seed,seat='player-white';
  kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(plan.rootEnvelope).ok);const original=c.lifecycle.save().envelope,root=c.projection({role:'player',playerId:seat}).state,known=new Set([...root.selfState.hand,...root.publicState.board.publicCards].filter(Boolean).map(c=>c.id));let checks=0;
  for(let i=0;i<=8;i++){
   const before=c.lifecycle.save().envelope;
   if(!before.session){
    const raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(raw,seat),state=JSON.parse(before.committedState),owner=state.players.players.find(p=>p.id===seat),capital=v=>independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>v.components[k]));
    assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.equal(demand.planningCapital(state,owner),capital(value));
    if(owner.hand.every(card=>known.has(card.id))){const masked=rules.sanitizeHiddenInformationObservation(root,raw,{code:'hidden_card_reveal'}),slots=state.cards.publicCards.flatMap((card,index)=>card&&!known.has(card.id)?[index]:[]),planning={...state,cards:{...state.cards,publicCards:state.cards.publicCards.map(card=>card&&known.has(card.id)?card:null),unknownPublicSlotIndices:slots}};assert.equal(demand.planningCapital(planning,owner),capital(independentValue.evaluateStateValue(masked,seat)));}
    assert.deepEqual(c.lifecycle.save().envelope,before);checks++;
   }
   if(i===8)break;const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===plan.steps[i].actionId);assert(a);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
  }
  assert(checks>=3);assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);console.log('[PASS] independent-public-income-option: '+checks+' native prefixes, formal/state/confirmed-hidden-slot parity; root/RNG restored');
 }catch(error){console.log(`[FAIL] independent-public-income-option: ${error.message}`);allPass=false;}
 finally{kernel?.composition.dispose();}
}

// Existing signal counts and funded computer5/6 preparation are visible
// inputs; their plan quote must match canonical and formal native checkpoints.
{
 let auditEnv;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),demand=require('../randomizer/game/ai/resource-demand'),w=JSON.parse(fs.readFileSync('reports/ai-foundation-20261104/two-rounds-teacher-v2/v178-known-sector-card-continuation-native-20261105-v2.json'));
  auditEnv=createSimulationEnv();let checks=0;
  for(const row of w.checkpoints){auditEnv.loadCheckpoint(row.checkpoint);const before=auditEnv.createCheckpoint(),raw=auditEnv.observe('player-white'),formal=outcomeModel.createDecisionObservation(raw,{seatId:'player-white',stateVersion:0,decisionVersion:0}),v=independentValue.evaluateStateValue(raw,'player-white'),state=JSON.parse(before.coreState.committedState),owner=state.players.players.find(p=>p.id==='player-white');assert.equal(v.total,82.5);assert.deepEqual(independentValue.evaluateStateValue(formal,'player-white'),v);assert.equal(demand.planningCapital(state,owner),['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].reduce((n,k)=>n+v.components[k],0));assert.deepEqual(auditEnv.createCheckpoint().coreState,before.coreState);checks++;}
  console.log('[PASS] independent-known-sector-analysis: '+checks+' existing native checkpoints, formal/state parity82.5, no invented observation or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-known-sector-analysis: ${error.message}`);allPass=false;}
 finally{auditEnv?.dispose();}
}

// The known movement/data preparation consumes only current visible wallet,
// coordinates and a disclosed card; projection modes must retain that contract.
{
 let kernel;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),demand=require('../randomizer/game/ai/resource-demand'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
  const rows=JSON.parse(fs.readFileSync('reports/ai-foundation-20261104/two-rounds-teacher-v2/v186-dlc5-native-prefix-20261105-v1.json')).rows.filter(x=>['before-first-tool','after-teacher-input-80','after-teacher-input-83'].includes(x.label));
  const seed=JSON.parse(rows[0].envelope.committedState).meta.seed,seat='player-white';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;let checks=0;
  for(const row of rows){assert(c.lifecycle.restore(row.envelope).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),valueOnly=c.projection({role:'player',playerId:seat,valueOnly:true}).state,value=independentValue.evaluateStateValue(raw,seat),state=JSON.parse(before.committedState),owner=state.players.players.find(p=>p.id===seat);assert.equal(value.total,94.08333333333333);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(independentValue.evaluateStateValue(valueOnly,seat),value);assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert.deepEqual(c.lifecycle.save().envelope,before);checks++;}
  console.log('[PASS] independent-known-movement-tool: '+checks+' native prefixes, formal/valueOnly/state quote and preparation debt agree; no invented observation or root/RNG change');
 }catch(error){console.log(`[FAIL] independent-known-movement-tool: ${error.message}`);allPass=false;}
 finally{kernel?.composition.dispose();}
}

// Sector and mission use one paid wallet and the remaining known token ledger.
{
 let kernel;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),demand=require('../randomizer/game/ai/resource-demand'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
  const rows=JSON.parse(fs.readFileSync('reports/ai-foundation-20261104/two-rounds-teacher-v2/v187-sector-mission-prefix-native-20261105-v1.json')).rows.filter(x=>['before-sector-card','after-teacher-86','after-teacher-88','after-teacher-90','after-teacher-91'].includes(x.label));
  const seed=JSON.parse(rows[0].envelope.committedState).meta.seed,seat='player-white';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;let checks=0;
  for(const row of rows){assert(c.lifecycle.restore(row.envelope).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),valueOnly=c.projection({role:'player',playerId:seat,valueOnly:true}).state,value=independentValue.evaluateStateValue(raw,seat),state=JSON.parse(before.committedState),owner=state.players.players.find(p=>p.id===seat);assert.equal(value.total,94.08333333333333);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(independentValue.evaluateStateValue(valueOnly,seat),value);assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert.deepEqual(c.lifecycle.save().envelope,before);checks++;}
  console.log('[PASS] independent-sector-mission-composition: '+checks+' native prefixes, formal/valueOnly/state shared-wallet quote agrees; no invented refill, observation or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-sector-mission-composition: ${error.message}`);allPass=false;}
 finally{kernel?.composition.dispose();}
}

// A held region card may match history as soon as it becomes reserved. The
// same readonly hand-history facts and revealed layout must reach every V path.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital'),demand=require('../randomizer/game/ai/resource-demand');
  const cp=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-133-20261105-v1.checkpoint.json')),e=cp.coreState.compositionEnvelope,seed=JSON.parse(e.committedState).meta.seed,seat='player-white';
  kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(e).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(raw,seat),state=JSON.parse(e.committedState),owner=state.players.players.find(p=>p.id===seat);port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot();
  assert.deepEqual(raw.selfState.pendingHandCardTriggers,[]);assert.equal(value.total,115.75);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(independentValue.evaluateStateValue(port.valueObservation(root),seat),value);assert.equal(independentValue.purposeCapital({...probe.factsFromState(state,owner),supply:state.tech,researchCost:6,analyzeEnergyCost:0}).symbolCardPlan.value,2.5);assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert.deepEqual(c.lifecycle.save().envelope,before);
  state.turn.type1TriggerEvents=[...(state.turn.type1TriggerEvents||[]),{type:'alienTrace',traceType:'pink',playerId:seat}];const h=buildRuleObservation(state,seed,seat);assert(h.selfState.pendingHandCardTriggers.some(t=>t.cardInstanceId==='alien-amiba-0-1'));assert.equal(independentValue.purposeCapital({...probe.factsFromObservation(h,seat),supply:state.tech,researchCost:6,analyzeEnergyCost:0}).symbolCardPlan.value,0);
  console.log('[PASS] independent-known-symbol-card: native/formal/full/compact shared2.5 purpose, hand-history guard, current layout and root/RNG agree');
 }catch(error){console.log(`[FAIL] independent-known-symbol-card: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Complete current public trace counts include every revealed species.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital'),end=require('../randomizer/game/end-game-scoring');
  const control=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v264-ready-analysis-extra-blue-native-control-20261106-v1.json')),e=control.prefixes['1'],s=JSON.parse(e.committedState),seed=s.meta.seed,seat='player-white';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(e).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),owner=s.players.players.find(p=>p.id===seat),counts=end.getPlayerTraceCounts(owner,s.aliens),f={...probe.factsFromObservation(raw,seat),supply:s.tech,researchCost:6,analyzeEnergyCost:0};port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot(),compact=port.valueObservation(root);assert.deepEqual(counts,{blue:2,pink:2,yellow:1});for(const o of[raw,formal,compact]){assert.deepEqual(o.selfState.traceCounts,counts);assert.equal(independentValue.evaluateStateValue(o,seat).total,142);}assert.deepEqual(probe.factsFromState(s,owner).traceCounts,counts);assert.equal(independentValue.purposeCapital(f).analysisPlan.value,3);port.setResourcePlanning(true);assert(!port.resourceSpec(root).plans.some(p=>p.goal.kind==='blue-data'));assert.equal(port.postMainValueBound(root),null);assert.deepEqual(c.lifecycle.save().envelope,before);
  console.log('[PASS] independent-mixed-blue-analysis: formal/full/compact/native complete public counts2/2/1, funded analysis3V and last data retained for the next main purpose, no hidden future inputs or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-mixed-blue-analysis: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Revealed Amiba positions and draw quantities are public inputs. Its funded
// ready-analysis value must agree without inspecting either new card identity.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital'),demand=require('../randomizer/game/ai/resource-demand');
  const cp=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-160-20261105-v1.checkpoint.json')),e=cp.coreState.compositionEnvelope,state=JSON.parse(e.committedState),seed=state.meta.seed,seat='player-white';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(e).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(raw,seat),owner=state.players.players.find(p=>p.id===seat);port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot();
  assert.equal(value.total,124.08333333333333);assert.equal(value.components.analysisPotential,10.083333333333334);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(independentValue.evaluateStateValue(port.valueObservation(root),seat),value);assert.deepEqual(raw.publicState.board.aliens.amibaTraces,probe.factsFromState(state,owner).amibaTraces);assert.equal(raw.publicState.board.ordinaryDrawCount,state.cards.drawPileCardIds.length);assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert(!Object.hasOwn(raw.publicState.board.aliens.amibaTraces,'cardDeck'));assert.deepEqual(c.lifecycle.save().envelope,before);
  const factor=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v208-income-factor-prefixes-20261106-v1.checkpoint.json')),info=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v204-actual-safety-choice-native-20261106-v1.json')).branches.safety.observation,rule=require('../randomizer/game/rule-composition'),source=JSON.parse(factor.common.prefixes[1].committedState),masked=rule.sanitizeHiddenInformationObservation(info,buildRuleObservation(source,seed,seat),{code:'hidden_card_reveal'}),f={...probe.factsFromObservation(masked,seat),supply:masked.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0};assert.equal(independentValue.evaluateStateValue(masked,seat).total,116.5);assert.equal(independentValue.purposeCapital(f).analysisPlan.selected.incomeCardId,'card-18-0');const endpoint=rule.sanitizeHiddenInformationObservation(info,buildRuleObservation(JSON.parse(factor.branches['energy-B48'].envelope.committedState),seed,seat),{code:'hidden_card_reveal'});assert.equal(independentValue.evaluateStateValue(endpoint,seat).total,independentValue.evaluateStateValue(masked,seat).total,'the actually selected income supplier retains its same-wallet publicity purpose after analysis');assert.equal(independentValue.purposeCapital({...f,player:{...f.player,availableData:2}}).analysisPlan.value,0);assert.deepEqual(c.lifecycle.save().envelope,before);
  const pending=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v214-actual123-corner-safety-purple2-prefix-20261106-v1.checkpoint.json')),pendingState=JSON.parse(pending.prefixes[6].committedState),waiting=buildRuleObservation(pendingState,seed,seat),claimedState=JSON.parse(pending.prefixes[8].committedState),claimed=buildRuleObservation(claimedState,seed,seat);assert.equal(waiting.selfState.nextFinalMark.followingThreshold,70);assert.equal(claimed.selfState.nextFinalMark.followingThreshold,null);assert.equal(independentValue.evaluateStateValue(waiting,seat).total,120);assert.equal(independentValue.evaluateStateValue(claimed,seat).total,120);assert.deepEqual(probe.factsFromObservation(waiting,seat).sourcePendingFinalMarkChoice,probe.factsFromState(pendingState,pendingState.players.players.find(p=>p.id===seat)).sourcePendingFinalMarkChoice);
  console.log('[PASS] independent-ready-amiba-analysis: native/full/compact shared analysis, computer3 income116.5 and earned-B pending/claimed120; formal following threshold, no unknown identity funding or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-ready-amiba-analysis: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Current known research and later held-symbol use share one readonly ledger.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),demand=require('../randomizer/game/ai/resource-demand');
  const f=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v218-corner-safety-purple2-3-root-20261106-v1.json')),seed=f.source.seed,seat=f.seatId;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),state=JSON.parse(before.committedState),owner=state.players.players.find(p=>p.id===seat),value=independentValue.evaluateStateValue(raw,seat);port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot();
  assert.equal(value.total,123.58333333333333);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(independentValue.evaluateStateValue(port.valueObservation(root),seat),value);assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert.deepEqual(c.lifecycle.save().envelope,before);
  console.log('[PASS] independent-research-symbol-composition: native/formal/full/compact ledger123.583333 agrees; no fabricated Native observation/entity or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-research-symbol-composition: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// An actual free alien card may retain a certified root-known fixed tail.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
  const F='reports/ai-foundation-20261105/third-round-teacher-v1/',f=JSON.parse(fs.readFileSync(F+'v239-actual-before-132-root-20261106-v1.json')),cp=JSON.parse(fs.readFileSync(F+'v239-free-alien-card-boundary-control-20261106-v1.checkpoint.json')),seed=f.source.seed,seat=f.seatId;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope;port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setResourcePlanning(true);port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});let node=port.openRoot();for(const id of cp.contexts['387'].path)node=port.expand(node,id);node=port.expand(node,cp.contexts['387'].branches.blind.acceptedActionId);assert.equal(node.status,'stable');const full=node.observation,compact=port.valueObservation(node),value=independentValue.evaluateStateValue(full,seat),formal=outcomeModel.createDecisionObservation(full,{seatId:seat,stateVersion:0,decisionVersion:0});assert.deepEqual(independentValue.evaluateStateValue(compact,seat),value);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert(full.selfState.hand.some(c=>c.hidden&&!c.id&&!c.cardId));const spec=port.turnTailSummary(node,'data-end-turn');assert(spec);assert.equal(spec.requiredNativeInputs,6);assert.equal(independentValue.sumValueParts([value.total,spec.netGain]),125.25);const leaf=port.turnTailBoundary(node,spec);assert.throws(()=>leaf.observation,/NO_SUCCESSOR_OBSERVATION/);assert.deepEqual(c.lifecycle.save().envelope,original);
  console.log('[PASS] independent-known-postdraw-tail: full/formal/compact anonymous slots and fixed income/blue/end125.25 agree; no new identity, successor observation or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-known-postdraw-tail: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// New anonymous held cards leave an already-funded Native data plan usable.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
  const f=JSON.parse(fs.readFileSync('reports/ai-foundation-20261106/analysis-blue-choice-v1/teacher167-root-20261106-v1.json')),seed=f.source.seed,seat=f.seatId;
  kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope;
  port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setResourcePlanning(true);port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
  let node=port.openRoot();for(const id of ['play_card:5d3aef4d','choose_card:3fd1e1f1','choose_target:4ca50ef1'])node=port.expand(node,id);assert.equal(node.status,'stable');
  const done=port.expandResourcePlan(node,port.resourceSpec(node).plans[0],()=>null);assert(done.complete);assert.equal(done.submissions,4);
  for(const n of [node,...done.prefixes.slice(1).map(x=>x.node),done.node]){
   const full=n.observation,compact=port.valueObservation(n),formal=outcomeModel.createDecisionObservation(full,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(full,seat);
   assert.deepEqual(independentValue.evaluateStateValue(compact,seat),value);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert(full.selfState.hand.filter(c=>c.hidden).every(c=>!c.id&&!c.cardId));
  }
  assert.equal(independentValue.evaluateStateValue(port.valueObservation(done.node),seat).total,130.08333333333334);assert.deepEqual(c.lifecycle.save().envelope,original);
  console.log('[PASS] independent-known-postdraw-native-data: four actual held-data inputs, full/formal/compact130.08333333333334 and anonymous cards agree; root/RNG unchanged');
 }catch(error){console.log(`[FAIL] independent-known-postdraw-native-data: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Anonymous count cannot change a root-known held-pool-data continuation.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
  const f=JSON.parse(fs.readFileSync('reports/ai-foundation-20261107/anonymous-data-continuation-v1/actual156-blue4-known-data-native-20261107-v1.json')),seed=JSON.parse(f.root.committedState).meta.seed,seat='player-white';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.root).ok);const original=c.lifecycle.save().envelope;port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setResourcePlanning(true);port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});let node=port.openRoot();
  for(let i=0;i<f.sequence.length-1;i++){
   const id=i===1?node.legalActions.find(a=>a.target.choiceId==='amiba:blind').actionId:f.sequence[i];node=port.expand(node,id);if(i<1)continue;
   const full=node.observation,compact=port.valueObservation(node),formal=outcomeModel.createDecisionObservation(full,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(full,seat);
   assert.deepEqual(independentValue.evaluateStateValue(compact,seat),value);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(value,{...f.prefixes[i].maskedValue,modelVersion:independentValue.MODEL_VERSION});assert.equal(full.selfState.hand.filter(c=>c.hidden).length,2);assert(full.selfState.hand.filter(c=>c.hidden).every(c=>!c.id&&!c.cardId));
  }
  assert.equal(independentValue.evaluateStateValue(port.valueObservation(node),seat).total,140);assert.deepEqual(c.lifecycle.save().envelope,original);
  console.log('[PASS] independent-multi-anonymous-data: two opaque cards, full/formal/compact and each Native prefix138-to140 agree; no new entity payment or root/RNG change');
 }catch(error){console.log(`[FAIL] independent-multi-anonymous-data: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// A root-public alien model becomes a real known instance only on its display branch.
{
 let kernel,nativeKernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),rules=require('../randomizer/game/rule-composition');
  const f=JSON.parse(fs.readFileSync('reports/ai-foundation-20261107/anonymous-data-continuation-v1/actual156-blue4-known-data-native-20261107-v1.json')),seed=JSON.parse(f.root.committedState).meta.seed,seat='player-white';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.root).ok);const original=c.lifecycle.save().envelope;port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setResourcePlanning(true);port.setMovementPlanning(true);port.setCardPickPlanning(true);port.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});nativeKernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});nativeKernel.newGame({seed});const root=port.openRoot();assert.equal(root.observation.publicState.board.aliens.amibaTraces.displayedCardIndex,9);let node=root;
  for(let i=0;i<f.sequence.length-1;i++){
   node=port.expand(node,f.sequence[i]);if(i<1)continue;
   assert(nativeKernel.composition.lifecycle.restore(f.prefixes[i].envelope).ok);const full=node.observation,compact=port.valueObservation(node),formal=outcomeModel.createDecisionObservation(full,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(full,seat),native=rules.sanitizeHiddenInformationObservation(root.observation,nativeKernel.composition.projection({role:'player',playerId:seat}).state,{code:'hidden_card_draw'},['alien-amiba-9-5']);
   assert.deepEqual(independentValue.evaluateStateValue(compact,seat),value,"compact index"+i);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value,"formal index"+i);assert.deepEqual(independentValue.evaluateStateValue(native,seat),value,"native index"+i);assert.equal(full.selfState.hand.filter(c=>c.hidden).length,1);assert(full.selfState.hand.some(c=>c.id==='alien-amiba-9-5'&&c.cardId==='amiba_9.webp'));assert.equal(full.publicState.board.aliens.amibaTraces.displayedCardIndex,null);
  }
  assert.deepEqual(c.lifecycle.save().envelope,original);
  console.log('[PASS] independent-public-alien-acquisition: root-public model and actual new ID agree with Native, full/formal/compact and every known data prefix; blind/refill unknown and root/RNG unchanged');
 }catch(error){console.log(`[FAIL] independent-public-alien-acquisition: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();nativeKernel?.composition.dispose();}
}

// Known publicity preparation is an existing asset, not a gain from burning cards early.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital');
  const control=JSON.parse(fs.readFileSync('reports/ai-foundation-20261107/publicity-deferral-learning-v1/native-commutation-20261107-v1.json')),seat='player-white';assert.equal(control.status,'exact');
  for(const fixture of control.results){const seed=JSON.parse(fixture.sourceEnvelope.committedState).meta.seed;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(fixture.sourceEnvelope).ok);const original=c.lifecycle.save().envelope;port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setResourcePlanning(true);port.setCardPickPlanning(true);port.setMovementPlanning(true);const root=port.openRoot(),full=root.observation,compact=port.valueObservation(root),formal=outcomeModel.createDecisionObservation(full,{seatId:seat}),value=independentValue.evaluateStateValue(full,seat);assert.equal(full.selfState.turnCardBonusCount,0);assert.equal(value.total,fixture.arms.early.value.total);assert.deepEqual(independentValue.evaluateStateValue(compact,seat),value);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);const state=JSON.parse(original.committedState),owner=state.players.players.find(p=>p.id===seat);assert.equal(probe.factsFromState(state,owner).turnCardBonusCount,probe.factsFromObservation(full,seat).turnCardBonusCount);assert(!port.resourceSpec(root).plans.some(p=>p.goal.kind==='analysis-publicity'));assert.deepEqual(c.lifecycle.save().envelope,original);port.close();port=null;for(const arm of ['early','late']){assert(c.lifecycle.restore(fixture.arms[arm].envelope).ok);assert.equal(independentValue.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat).total,value.total);}assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);c.dispose();kernel=null;}
  console.log('[PASS] independent-deferred-publicity-capital: original known sources already price exact Native early/late funded endpoint; full/formal/compact and Native0bonus fact agree, no forced future-purpose burn or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-deferred-publicity-capital: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// A bound singleton income still uses the real Native input and full value.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),demand=require('../randomizer/game/ai/resource-demand'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
  const factor=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v208-income-factor-prefixes-20261106-v1.checkpoint.json')),e=factor.common.envelope,seat='player-white',seed=JSON.parse(e.committedState).meta.seed;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(e).ok);const before=c.lifecycle.save().envelope,actions=c.inspect().session.decision.choices,choice=demand.incomeChoice({state:e.session.session.workingState,seatId:seat,goal:{kind:'analyze',required:{energy:0},incomeCardId:'card-18-0'},actions});assert.equal(choice.kind,'fixed');assert.equal(actions.find(a=>a.actionId===choice.actionId).target.cardInstanceId,'card-18-0');port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot(),after=port.expand(root,choice.actionId),full=after.observation,formal=outcomeModel.createDecisionObservation(full,{seatId:seat});assert.deepEqual(independentValue.evaluateStateValue(full,seat),independentValue.evaluateStateValue(formal,seat));assert.deepEqual(independentValue.evaluateStateValue(full,seat),independentValue.evaluateStateValue(port.valueObservation(after),seat));assert.deepEqual(c.lifecycle.save().envelope,before);console.log('[PASS] independent-singleton-income: fixed real known supplier, Native submission and full/formal/compact values agree; no fabricated zero loss, observation or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-singleton-income: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// A company fixed selection is control, never an added valuation input.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
  const proof=JSON.parse(fs.readFileSync('reports/ai-foundation-20261107/company-fixed-intent-v1/native-three-input-control-20261107-v1.json')),seat='player-white',seed=JSON.parse(proof.sourceEnvelope.committedState).meta.seed;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;
  for(const stage of [0,1,2]){const envelope=stage?proof.steps[stage-1].envelope:proof.sourceEnvelope;assert(c.lifecycle.restore(envelope).ok);const original=c.lifecycle.save().envelope;port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setCardPickPlanning(true);port.setResourcePlanning(true);const root=port.openRoot(),spec=port.cardPickSpec(root),full=root.observation,formal=outcomeModel.createDecisionObservation(full,{seatId:seat});assert.deepEqual(independentValue.evaluateStateValue(full,seat),independentValue.evaluateStateValue(port.valueObservation(root),seat));assert.deepEqual(independentValue.evaluateStateValue(full,seat),independentValue.evaluateStateValue(formal,seat));assert.equal(spec.companySwap.selection.cardId,proof.intent.selection.cardId);const action=stage===0?root.legalActions.find(a=>a.family==='industry'&&a.target.abilityId==='deepspace_swap_cards'):root.legalActions.find(a=>a.actionId===spec.selectedActionId),result=port.expandWithCardPick(root,action.actionId,()=>null);assert(result.complete);assert.equal(result.submissions,3-stage);assert.equal(port.getDiagnostics().cardPick.companyIntentRecoveriesThisRoot,stage?1:0);assert(port.getDiagnostics().cardPick.companyIntentReusesThisRoot>=2-stage);assert.deepEqual(independentValue.evaluateStateValue(result.node.observation,seat),independentValue.evaluateStateValue(port.valueObservation(result.node),seat));assert.deepEqual(c.lifecycle.save().envelope,original);port.close();port=null;}
  console.log('[PASS] independent-company-fixed-intent: original known source purpose, both cold menu restores, full/formal/compact values and charged Native3/2/1 inputs agree; no new valuation field or root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-company-fixed-intent: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Mutable planning wrappers can share only an exact complete-input scalar.
{
 let kernel;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),probe=require('../randomizer/game/ai/probe-capital'),demand=require('../randomizer/game/ai/resource-demand');
  const f=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v239-actual-before-132-root-20261106-v1.json')),seed=f.source.seed,seat=f.seatId;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,state=JSON.parse(original.committedState),owner=state.players.players.find(p=>p.id===seat),raw=c.projection({role:'player',playerId:seat}).state,value=independentValue.evaluateStateValue(raw,seat),facts={...probe.factsFromState(state,owner),supply:state.tech,researchCost:6,analyzeEnergyCost:0};
  assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));
  for(const credits of [owner.resources.credits,0,1]){const next=structuredClone(facts);next.player.credits=credits;assert.equal(independentValue.purposeCapitalValue(next),independentValue.purposeCapital(next).total);assert.equal(independentValue.purposeCapitalValue(structuredClone(next)),independentValue.purposeCapital(next).total);}
  const ordered={credits:90.66666666666667,energy:4.142857142857143,publicity:71.45454545454545,availableData:41.76923076923077,additionalPublicScan:17.647058823529413,handSize:3},reversed=Object.fromEntries(Object.entries(ordered).reverse());for(const weights of [ordered,reversed])assert.equal(independentValue.purposeCapitalValue(facts,weights),independentValue.purposeCapital(facts,weights).total);
  assert.deepEqual(c.lifecycle.save().envelope,original);console.log('[PASS] independent-scalar-capital-cache: complete mutable fact quotes match full portfolio and Native observation components; changed wallet rekeys, scalar only, no root/RNG mutation');
 }catch(error){console.log(`[FAIL] independent-scalar-capital-cache: ${error.message}`);allPass=false;}
 finally{kernel?.composition.dispose();}
}

// Canonical completed tasks and one blue event/one slot reach every V path.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital'),demand=require('../randomizer/game/ai/resource-demand');
  const f=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/v254-blue-data-before-analysis-root-20261106-v1.json')),e=structuredClone(f.compositionEnvelope),state=JSON.parse(e.committedState),owner=state.players.players.find(p=>p.id===f.seatId),seat=f.seatId,seed=state.meta.seed;owner.completedTaskCount=2;owner.taskState={staleLegacy:true};owner.reservedCards.find(c=>c.cardId==='amiba_9.webp').cardEffectState.consumedTriggerIds=['amiba9-blue-data-1'];e.committedState=JSON.stringify(state);
  kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(e).ok);const original=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat,stateVersion:0,decisionVersion:0}),value=independentValue.evaluateStateValue(raw,seat),facts={...probe.factsFromState(state,owner),supply:state.tech,researchCost:6,analyzeEnergyCost:0};port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot();
  assert.equal(raw.publicState.players.find(p=>p.playerId===seat).completedTaskCount,2);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);assert.deepEqual(independentValue.evaluateStateValue(port.valueObservation(root),seat),value);const q=independentValue.purposeCapital(facts).analysisPlan;assert.equal(q.selected.blueDataTrigger.ruleId,'amiba9-blue-data-2');assert.equal(q.selected.blueDataTrigger.gainedData,1);assert.equal(q.selected.endpoint.resources.completedTaskCount,3);assert(!q.selected.endpoint.reservedCards.some(c=>c.cardId==='amiba_9.webp'));assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));assert.deepEqual(c.lifecycle.save().envelope,original);
  console.log('[PASS] independent-blue-data-analysis: canonical completion2 not legacy1; Native/formal/full/compact one-event-one-slot, consumed endpoint completion3 and same-wallet capital agree; root/RNG unchanged');
 }catch(error){console.log(`[FAIL] independent-blue-data-analysis: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}


// Existing public inputs, new final-income Earth-probe use: independent Native/formal/compact paths.
{
 const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital'),demand=require('../randomizer/game/ai/resource-demand');let kernel,port;
 try{const cp=JSON.parse(fs.readFileSync('reports/ai-foundation-20261107/orange-tech-fixed-tail-v1/scan-launch-final-tail-native-control-20261107-v1.checkpoint.json')),seat='player-white',source=cp.branches['orange2-launch'].envelope,seed=JSON.parse(source.committedState).meta.seed;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition,totals={};for(const name of ['orange2-skip','orange2-launch']){const e=cp.branches[name].envelope;assert(c.lifecycle.restore(e).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat}),value=independentValue.evaluateStateValue(raw,seat),state=JSON.parse(e.committedState),owner=state.players.players.find(p=>p.id===seat);assert.equal(value.components.probePotential,name==='orange2-launch'?2:0);assert.equal(value.components.income,11.5);assert.deepEqual(independentValue.evaluateStateValue(formal,seat),value);port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const root=port.openRoot();assert.deepEqual(independentValue.evaluateStateValue(port.valueObservation(root),seat),value);assert.equal(demand.planningCapital(state,owner),independentValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>value.components[k])));port.close();port=null;totals[name]=value.total;assert.deepEqual(c.lifecycle.save().envelope,before);}assert.equal(totals['orange2-launch']-totals['orange2-skip'],1);console.log('[PASS] independent-next-income-probe: existing known wallet/income/hand and public Earth layout, Native/full/formal/compact agree;2C replacement against1E, income not duplicated, root/RNG unchanged');}
 catch(error){console.log(`[FAIL] independent-next-income-probe: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Final-round proof applicability reads the same viewer and deployed public probes on every V path.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
  const proof=JSON.parse(fs.readFileSync('reports/ai-foundation-20261107/final-round-proof-audit-v1/native-income-vs-old-bound-20261107-v2.json')),cp=JSON.parse(fs.readFileSync(proof.checkpoint)),seat='player-blue',seed='seti-free-analyze-v1';kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;let pairs=0;
  for(const row of cp.rows){for(const envelope of [row.source,row.envelope]){assert(c.lifecycle.restore(envelope).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat});const compact=c.projection({role:'player',playerId:seat,valueOnly:true}).state;for(const o of [raw,formal,compact])assert.equal(independentValue.supportsLegacyValueProof(o),false);assert.deepEqual(independentValue.evaluateStateValue(raw,seat),independentValue.evaluateStateValue(formal,seat));assert.deepEqual(independentValue.evaluateStateValue(raw,seat),independentValue.evaluateStateValue(compact,seat));assert.deepEqual(c.lifecycle.save().envelope,before);}pairs++;}
  for(const old of proof.rows.filter(r=>r.violatesBound)){const row=cp.rows.find(r=>r.case===old.case);assert(c.lifecycle.restore(row.source).ok);port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.setResourcePlanning(true);const root=port.openRoot();assert.equal(independentValue.supportsLegacyValueProof(root.observation),false);assert.equal(independentValue.supportsLegacyValueProof(port.valueObservation(root)),false);assert.equal(port.postMainValueBound(root),null);port.close();port=null;const state=JSON.parse(row.source.committedState);state.pieces.rockets=state.pieces.rockets.filter(r=>r.playerId!==seat);assert(c.lifecycle.restore({...row.source,committedState:JSON.stringify(state)}).ok);assert.equal(independentValue.supportsLegacyValueProof(c.projection({role:'player',playerId:seat}).state),true);}
  assert.equal(pairs,14);console.log('[PASS] independent-final-round-proof-domain: deployed viewer probe rejects legacy linear proof in Native/formal/compact28 observations; two24-ceiling counterexamples declined, no-probe scope retained and source/RNG unchanged');
 }catch(error){console.log(`[FAIL] independent-final-round-proof-domain: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

// Derived one-research score ceiling uses only the same already-public symbol/trigger facts.
{
 let kernel,port;
 try{
  const fs=require('node:fs'),assert=require('node:assert/strict'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),probe=require('../randomizer/game/ai/probe-capital'),trigger=require('../randomizer/game/ai/research-trigger-capital'),amiba=require('../randomizer/game/aliens/amiba');
  const cp=JSON.parse(fs.readFileSync('reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-127-20261105-v1.checkpoint.json')),envelope=cp.coreState.compositionEnvelope,state=JSON.parse(envelope.committedState),seat='player-white',owner=state.players.players.find(p=>p.id===seat),seed=state.meta.seed;kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(envelope).ok);const before=c.lifecycle.save().envelope,raw=c.projection({role:'player',playerId:seat}).state,formal=outcomeModel.createDecisionObservation(raw,{seatId:seat});port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});const compact=port.valueObservation(port.openRoot()),native=trigger.describe(probe.factsFromState(state,owner),{resources:owner.resources,income:owner.income,startingIncome:0},owner.resources.publicity);assert(native.available);const ceiling=Math.max(0,...Object.keys(native.symbols.symbolsById).map(id=>amiba.getSymbolReward(id).gain?.score||0));assert.equal(native.maximumSingleScoreGain,ceiling);
  for(const o of [raw,formal,compact]){const p=o.publicState.players.find(p=>p.playerId===seat),f=probe.factsFromObservation(o,seat),ctx=trigger.describe(f,{resources:p,income:p.income,startingIncome:0},p.publicity);assert.deepEqual(ctx,native);assert.equal(ctx.maximumScoreGain,Math.min(2,ctx.rules.length)*ceiling);assert.deepEqual(independentValue.evaluateStateValue(o,seat),independentValue.evaluateStateValue(raw,seat));for(const id of ['orange2','purple2','blue3'])assert(trigger.gains(ctx,independentValue.DEFAULT_WEIGHTS).development([id]).scoreGain<=ceiling);}
  assert.deepEqual(c.lifecycle.save().envelope,before);console.log('[PASS] independent-single-research-score-ceiling: Native/full/formal/compact contexts derive the same bound from public symbols, one supported rule per color and unchanged value; source/RNG exact');
 }catch(error){console.log(`[FAIL] independent-single-research-score-ceiling: ${error.message}`);allPass=false;}
 finally{port?.close();kernel?.composition.dispose();}
}

env.dispose();
console.log(allPass ? "\nV 输入审计全部通过" : "\nV 输入审计有 FAIL（见上，检查对应调用点装配）");
process.exit(allPass ? 0 : 1);
