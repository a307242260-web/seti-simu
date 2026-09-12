"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
const useGoal = process.argv.includes("--use-goal");
let evidence = null;
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps) {
    const legal = env.legalActions();
    const trade = legal.find(a => a.family === "quick_trade" && a.target?.tradeId === "energy-for-card");
    if (trade && legal.some(a => a.family === "end_turn")) {
      const comp = env.createCounterfactualFork(null, { branchKey: "specific-public-card" }).composition;
      try {
        const viewer = { role: "player", playerId: trade.actorId };
        const before = comp.projection(viewer).state;
        const root = JSON.parse(comp.lifecycle.save().envelope.committedState);
        assert.equal(root.players.players.find(p => p.id === trade.actorId).mainActionCompleted, true);
        const catalog = evaluator.enumerateSecondaryAgentRootTargets({
          rootObservation: before, focalSeatId: trade.actorId,
          legalActions: legal.filter(a => evaluator.requiresRootCounterfactual(a, before)),
        });
        assert.equal(comp.inputPort.submitAction(trade).ok, true);
        const decision = comp.inspect().session?.decision;
        assert(decision);
        const choices = decision.choices.filter(a => a.target?.source === "public");
        assert(choices.length > 1, "须有多个公共牌供精确选择");
        const acquisition = useGoal ? catalog.find(t => t.targetId.startsWith("card:acquire:")
          && t.compatibleActionIds.includes(trade.actionId)) : null;
        if (useGoal) assert(acquisition, "正式边界必须产生公共牌获取目标");
        const planned = useGoal ? evaluator.selectSecondaryAgentSuccessors({
          focalSeatId: trade.actorId, branchObservation: comp.projection(viewer).state,
          currentAction: trade, routeTargetId: acquisition.targetId, routePlanId: acquisition.planId,
          legalSuccessors: decision.choices,
        })[0] : choices.at(-1);
        // 与正式搜索相同：目标绑定元数据用于规划，提交须重新取原生合法descriptor。
        const selected = decision.choices.find(choice => choice.actionId === planned?.actionId);
        assert(selected);
        const wanted = root.cards.publicCards[selected.target.slotIndex];
        assert(wanted);
        const submitted = comp.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: selected });
        assert.equal(submitted.ok, true, JSON.stringify(submitted));
        assert.equal(comp.inspect().session, null, "取牌事务应完成");
        const after = comp.projection(viewer).state;
        assert(after.selfState.hand.some(c => c.id === wanted.id));
        if (useGoal) assert.equal(evaluator.completesSecondaryAgentRouteTarget({
          action: selected, targetId: acquisition.targetId, branchObservation: after,
          focalSeatId: trade.actorId,
        }), true);
        const publicPlayer = before.publicState.players.find(p => p.playerId === trade.actorId);
        evidence = { source, beforeStep: step.stepIndex + 1, actor: trade.actorId,
          committedMainActionCompleted: true,
          publicMainActionFieldPresent: Object.hasOwn(publicPlayer, "mainActionCompleted"),
          privateMainActionFieldPresent: Object.hasOwn(before.selfState, "mainActionCompleted"),
          trade, targetCatalog: catalog, publicChoices: choices,
          wantedCardId: wanted.id, chosenSlot: selected.target.slotIndex,
          wantedCardInHand: true, terminalDecisionResolved: true,
          ...(useGoal ? { acquisitionTarget: acquisition.targetId, targetCompleted: true } : {}),
          scope: useGoal
            ? "正式主行动后按目标目录及后继选择器取得指定公共牌并验证完成；不证明整体AI收益，不读取补牌身份、不重跑AI。"
            : "正式主行动后交易与精确公共牌选择接口证据；选择最后一个合法公共选项以验证身份绑定，不证明该牌在策略上值得获取，不读取补牌身份、不重跑AI。" };
      } finally { comp.dispose(); }
      break;
    }
    const recorded = legal.find(a => a.actionId === step.action.actionId);
    assert(recorded);
    assert.equal(env.step(recorded).ok, true);
  }
  assert(evidence, "基线中必须找到主行动后可精选的正式边界");
  console.log(JSON.stringify(evidence, null, 2));
} finally { env.dispose(); }
