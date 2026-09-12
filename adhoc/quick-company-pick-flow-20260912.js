"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const cards = require("../randomizer/game/cards/deck");
const movementCase = process.argv.includes("--fenwick-move");
const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const scriptHash = crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex");
const output = `reports/iteration/quick-company-pick-flow-20260912-${gitCommit.slice(0, 8)}-${scriptHash.slice(0, 8)}${movementCase ? "-fenwick-move" : ""}.json`;
if (fs.existsSync(output)) { process.stdout.write(`已有checkpoint：${output}\n`); process.exit(0); }
const source = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
const cases = [];
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps.slice(0, 47)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
  }
  const actorId = env.legalActions()[0].actorId;
  for (const label of movementCase ? ["芬威克研究中心"]
    : ["任务中继站", "芬威克研究中心", "深空探测", "未来跨度研究所", "宇宙战略集团"]) {
    const comp = env.createCounterfactualFork().composition;
    try {
      const envelope = comp.lifecycle.save().envelope;
      const root = JSON.parse(envelope.committedState);
      const player = root.players.players.find(p => p.id === actorId);
      assert.equal(player.mainActionCompleted, true);
      player.initialSelection.industry = label;
      player.industryRoundMarkRound = 0;
      player.industryRoundMarkTurn = 0;
      player.resources.publicity = 3;
      player.industryStrategyPassiveSlots = { yellow: true, red: true, blue: true };
      let movementCardId = null;
      if (movementCase) {
        // 基线b_65既有移动角标，也有当前目标目录认可的研究用途；不改牌面定义。
        const owner = root.players.players.find(p => p.hand.some(card => card.cardId === "b_65.webp"));
        assert(owner, "基线必须有可交换到公开区的真实移动角标牌");
        const index = owner.hand.findIndex(card => card.cardId === "b_65.webp");
        const movedCard = owner.hand[index];
        assert(cards.getDiscardActionMoveRewardForCard(movedCard));
        owner.hand[index] = root.cards.publicCards[0];
        root.cards.publicCards[0] = movedCard;
        movementCardId = root.cards.publicCards[0].id;
      }
      if (label === "未来跨度研究所") {
        assert(player.hand.length > 1);
        player.industryFutureSpan = { card: player.hand.pop(), targetScore: 20, playing: false };
        player.resources.handSize = player.hand.length;
      }
      assert.equal(comp.lifecycle.restore({ ...envelope, committedState: JSON.stringify(root) }).ok, true);
      const viewer = { role: "player", playerId: actorId };
      const before = comp.projection(viewer).state;
      const legal = comp.inputPort.enumerateActions({ actorId });
      const action = legal.find(a => a.family === "industry");
      assert(action, `${label}应有正式合法入口`);
      const catalog = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: before,
        focalSeatId: actorId, legalActions: legal });
      const acquisition = catalog.find(target => target.targetId.startsWith("card:acquire:")
        && (!movementCardId || target.targetId === `card:acquire:${movementCardId}`)
        && target.compatibleActionIds.includes(action.actionId));
      assert(acquisition, `${label}必须由真实根目录进入取牌目标`);
      const wanted = root.cards.publicCards.find(card => `card:acquire:${card?.id}` === acquisition.targetId);
      assert(wanted);
      const routeTargetId = `card:acquire:${wanted.id}`;
      const allowed = evaluator.allowsQuickActionTiming({ observation: before, action,
        legalActions: legal, routeTargetId, routePlanId: routeTargetId });
      assert.equal(allowed, true, "正式公司来源必须通过时机准入");
      assert.equal(comp.inputPort.submitAction(action).ok, true);
      const steps = [];
      while (comp.inspect().session) {
        assert(steps.length < 20, "必须有限排空公司条件链");
        const inspection = comp.inspect();
        const decision = inspection.session.decision;
        assert(decision, "正式提交应排到输入边界");
        const phase = inspection.session.currentEffect.payload.step;
        const successors = evaluator.selectSecondaryAgentSuccessors({ branchObservation: comp.projection(viewer).state,
          focalSeatId: actorId, currentAction: steps.at(-1)?.action || action,
          routeTargetId, routePlanId: acquisition.planId, legalSuccessors: decision.choices });
        if (["public_card", "swap_public"].includes(phase)) {
          assert.equal(successors.length, 1);
          assert.equal(successors[0].target.cardInstanceId, wanted.id);
        }
        const planned = movementCase && phase === "free_move"
          ? successors.find(choice => choice.target.skip !== true)
          : successors.find(choice => choice.target.skip === true) || successors[0];
        const selected = decision.choices.find(choice => choice.actionId === planned?.actionId);
        assert(selected, `${label}/${phase}必须有合法选项`);
        steps.push({ phase, action: selected,
          ...(phase === "free_move" ? {
            legalMoves: decision.choices.filter(choice => !choice.target.skip).length,
            selectedMoves: successors.filter(choice => !choice.target.skip).length,
            targetAlreadyInHand: comp.projection(viewer).state.selfState.hand.some(card => card.id === wanted.id),
          } : {}) });
        const result = comp.inputPort.submitDecision({ decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: selected });
        assert.equal(result.ok, true, JSON.stringify(result));
      }
      const afterRoot = JSON.parse(comp.lifecycle.save().envelope.committedState);
      const afterPlayer = afterRoot.players.players.find(p => p.id === actorId);
      assert(afterPlayer.hand.some(card => card.id === wanted.id));
      if (movementCase) {
        const movement = steps.find(step => step.phase === "free_move");
        assert(movement, "移动角标必须产生正式免费移动Decision");
        assert(movement.legalMoves > 0, "需要真实可执行方向，而非无探测器空奖励");
        assert(movement.targetAlreadyInHand);
        assert.equal(movement.action.target.skip === true, false, "补例必须实际移动，不仅选择跳过");
        const rocketId = movement.action.target.rocketId;
        const beforeRocket = before.publicState.board.rockets.find(rocket => rocket.id === rocketId);
        const afterRocket = comp.projection(viewer).state.publicState.board.rockets.find(rocket => rocket.id === rocketId);
        assert(beforeRocket && afterRocket);
        assert.notDeepEqual([afterRocket.sectorX, afterRocket.sectorY], [beforeRocket.sectorX, beforeRocket.sectorY]);
        movement.positionBefore = [beforeRocket.sectorX, beforeRocket.sectorY];
        movement.positionAfter = [afterRocket.sectorX, afterRocket.sectorY];
      }
      assert.equal(afterPlayer.mainActionCompleted, true);
      if (label === "未来跨度研究所") assert.equal(afterPlayer.industryFutureSpan.targetScore, 22);
      if (label === "宇宙战略集团") assert.deepEqual(afterPlayer.industryStrategyPassiveSlots,
        { yellow: false, red: false, blue: false });
      const after = comp.projection(viewer).state;
      assert.equal(evaluator.completesSecondaryAgentRouteTarget({ action, targetId: routeTargetId,
        focalSeatId: actorId, branchObservation: after }), true);
      cases.push({ label, action, wantedCardId: wanted.id, allowed, steps,
        beforeResources: player.resources, afterResources: afterPlayer.resources,
        targetInHand: true, sessionDrained: true,
        futureTargetScore: afterPlayer.industryFutureSpan?.targetScore ?? null,
        strategySlots: afterPlayer.industryStrategyPassiveSlots,
        publicPlayerKeys: Object.keys(before.publicState.players.find(p => p.playerId === actorId)),
        privatePlayerKeys: Object.keys(before.selfState) });
    } finally { comp.dispose(); }
  }
  fs.writeFileSync(output, JSON.stringify({ gitCommit, scriptHash, source, beforeStep: 48,
    scope: "正式回放边界的隔离公司变体；真实根目录、时机与后继选择器指定公共牌，正式Action/Decision执行。多个交换手牌/奖励候选仍取首项或skip，不是完整AI搜索或整局。",
    cases }, null, 2) + "\n", { flag: "wx" });
  process.stdout.write(`${JSON.stringify(cases.map(c => ({ label: c.label, allowed: c.allowed,
    steps: c.steps.map(s => ({ phase: s.phase, legalMoves: s.legalMoves, selectedMoves: s.selectedMoves })),
    targetInHand: c.targetInHand })), null, 2)}\ncheckpoint=${output}\n`);
} finally { env.dispose(); }
