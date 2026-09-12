"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const data = require("../randomizer/game/data");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const outcomeModel = require("../randomizer/game/ai/outcome-model");
const policyChoices = process.argv.includes("--policy-choices");
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
const scanStep = 33;
const cases = [];
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps.slice(0, scanStep - 1)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
  }
  const actorId = save.replaySteps[scanStep - 1].action.actorId;
  for (const pool of [4, 5, 6]) {
    for (const prepare of (policyChoices ? [0, 1, 2] : [0, ...pool > 4 ? [pool - 4] : []])) {
      const comp = env.createCounterfactualFork(null, { branchKey: `scan-capacity-${pool}-${prepare}` }).composition;
      try {
        const envelope = comp.lifecycle.save().envelope;
        const base = JSON.parse(envelope.committedState);
        const player = base.players.players.find(p => p.id === actorId);
        // 正式开局未设置该标记；规则以truthy判断主行动已完成。
        assert.equal(Boolean(player.mainActionCompleted), false);
        assert.equal(data.listPoolTokens(player).length, 0);
        const placedBefore = data.listComputerPlacedTokens(player).length;
        assert.equal(placedBefore, 4, "保留正式回放已有的四个计算机数据");
        for (let index = 0; index < pool; index += 1) assert.equal(data.gainData(player, { root: base }).ok, true);
        assert.equal(comp.lifecycle.restore({ ...envelope, committedState: JSON.stringify(base) }).ok, true);
        const viewer = { role: "player", playerId: actorId };
        const preparationObservation = comp.projection(viewer).state;
        const initialScan = comp.inputPort.enumerateActions({}).find(a => a.family === "scan");
        const scanTarget = policyChoices ? evaluator.enumerateSecondaryAgentRootTargets({
          rootObservation: preparationObservation, focalSeatId: actorId,
          legalActions: comp.inputPort.enumerateActions({}),
        }).find(target => target.targetId.startsWith("sector:win:")
          && target.compatibleActionIds.includes(initialScan?.actionId)) : null;
        if (policyChoices) assert(scanTarget, "正式扫描必须有可检验的扇区目标");
        const rootAction = prepare
          ? comp.inputPort.enumerateActions({}).find(a => a.family === "place_data") : initialScan;
        if (policyChoices) assert(scanTarget.compatibleActionIds.includes(rootAction.actionId),
          "准备方案必须从真实根目录进入，不能由脚本凭空绑定");
        const actionsTaken = [];
        const selectionEvidence = [];
        function decide(decision, choice) {
          assert(choice);
          assert.equal(comp.inputPort.submitDecision({ decisionId: decision.decisionId,
            decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice }).ok, true);
          actionsTaken.push({ family: choice.family, target: choice.target });
        }
        for (let index = 0; index < prepare; index += 1) {
          const place = comp.inputPort.enumerateActions({}).find(a => a.family === "place_data");
          assert(place);
          assert.equal(comp.inputPort.submitAction(place).ok, true);
          actionsTaken.push({ family: place.family, target: place.target });
          const decision = comp.inspect().session.decision;
          decide(decision, decision.choices.find(c => c.target.target === "computer"));
          assert.equal(comp.inspect().session, null, "第五/六个计算机位置不应留下待选奖励");
          if (policyChoices) {
            assert.deepEqual(evaluator.selectSecondaryAgentRouteTarget({
              rootObservation: preparationObservation, branchObservation: comp.projection(viewer).state,
              focalSeatId: actorId, currentAction: place,
              routeTargetId: scanTarget.targetId, routePlanId: scanTarget.planId,
            }), { targetId: scanTarget.targetId, planId: scanTarget.planId },
            "为扫描腾容量不能被数据分析启发式改绑为另一个主行动目标");
          }
        }
        const scan = comp.inputPort.enumerateActions({}).find(a => a.family === "scan");
        assert(scan);
        assert.equal(comp.inputPort.submitAction(scan).ok, true);
        actionsTaken.push({ family: scan.family, target: scan.target });
        let currentAction = scan;
        for (let index = scanStep; comp.inspect().session; index += 1) {
          assert(index - scanStep < 40, "只读窄扫描案例不得无限执行条件选择");
          const inspection = comp.inspect();
          assert.equal(inspection.phase, "awaiting_input");
          const decision = inspection.session.decision;
          let selected;
          if (policyChoices) {
            const candidates = evaluator.selectSecondaryAgentSuccessors({
              branchObservation: comp.projection(viewer).state, focalSeatId: actorId,
              legalSuccessors: decision.choices, currentAction,
              routeTargetId: scanTarget.targetId, routePlanId: scanTarget.planId,
            });
            assert.equal(candidates.length, 1,
              "该窄案例必须由现有选择器唯一决定，不能用取第一项隐藏未解析分支");
            selected = decision.choices.find(choice => choice.actionId === candidates[0].actionId);
            selectionEvidence.push({ targetId: scanTarget.targetId, legalCount: decision.choices.length,
              selectedActionId: selected?.actionId, selectedTarget: selected?.target });
          } else {
            const recorded = save.replaySteps[index]?.action;
            assert.equal(recorded?.phase, "conditional");
            selected = decision.choices.find(c => c.actionId === recorded.actionId);
          }
          decide(decision, selected);
          currentAction = selected;
        }
        const after = JSON.parse(comp.lifecycle.save().envelope.committedState);
        const result = after.players.players.find(p => p.id === actorId);
        const discarded = result.dataState.discardedCount - player.dataState.discardedCount;
        const publicAfter = comp.projection(viewer).state;
        const projectedDiscarded = publicAfter.publicState.players.find(p => p.playerId === actorId)
          .dataProgress.discardedCount;
        assert.equal(projectedDiscarded - player.dataState.discardedCount, discarded);
        assert.equal(outcomeModel.createDecisionObservation(publicAfter, { seatId: actorId })
          .outcomeProjection.progress.dataProgress.discardedCount, projectedDiscarded);
        const poolAfter = data.listPoolTokens(result).length;
        const placedAfter = data.listComputerPlacedTokens(result).length;
        assert.equal(discarded, Math.max(0, pool - prepare + 2 - 6));
        assert.equal(poolAfter + placedAfter + discarded, pool + placedBefore + 2);
        assert.equal(placedAfter, placedBefore + prepare);
        assert.equal(result.mainActionCompleted, true);
        assert(comp.inputPort.enumerateActions({}).some(a => a.family === "end_turn"));
        const rootObservation = outcomeModel.createDecisionObservation(preparationObservation, { seatId: actorId });
        const evaluation = policyChoices ? evaluator.evaluateOutcome({ seatId: actorId,
          observation: rootObservation, legalActions: [rootAction], actionOutcomes: [{
            schemaVersion: evaluator.OUTCOME_SCHEMA_VERSION, actionId: rootAction.actionId,
            status: "settled", rootObservation, leaves: [{ leafId: `prepare-${prepare}`,
              status: "settled", terminalReason: "scan-settled",
              observation: outcomeModel.createDecisionObservation(publicAfter, { seatId: actorId }),
              executionStepCount: actionsTaken.length,
            }],
          }] }, rootAction) : null;
        cases.push({ poolBefore: pool, placedBefore, prepared: prepare, poolAfter, placedAfter, discarded,
          mainActionCompleted: true, actionsTaken,
          ...(policyChoices ? { scanTarget, selectionEvidence, evaluation: {
            selectable: evaluation.selectable, primaryValue: evaluation.primaryValue,
            code: evaluation.code,
            dataDiscardDelta: evaluation.dataDiscardDelta, sortKey: evaluation.sortKey,
            executionStepCount: evaluation.executionStepCount,
          } } : {}) });
      } finally { comp.dispose(); }
    }
  }
  console.log(JSON.stringify({ source, scanStep, actorId,
    fixture: "从既有正式扫描前状态起，用正式gainData构造池4/5/6；后续放置、扫描和条件选择全部经共享inputPort。",
    scope: policyChoices
      ? "现有扫描目标的根目录包含准备动作；枚举0/1/2次准备后，由现有后继选择器唯一决定扫描条件链并原生提交。只比较这一完整扫描事务，不外推目标获胜、AI最终选择或其他科技；若无primary收益仍必须不可选。"
      : "固定同一可见扫描选择链的容量必要性；不预测其他可选扫描、隐藏补牌或对手，不证明AI会主动先放数据。",
    cases }, null, 2));
} finally { env.dispose(); }
