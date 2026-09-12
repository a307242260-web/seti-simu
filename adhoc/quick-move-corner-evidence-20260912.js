"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const cards = require("../randomizer/game/cards/deck");
const rockets = require("../randomizer/game/rockets");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const continuation = require("../randomizer/game/ai/plan-continuation");
const policyMode = process.argv.includes("--policy");
const source = "seti-saves/seti-save-research-quick-timing-20260912-60f8cca6-full-v261.json";
const output = policyMode ? "reports/iteration/quick-move-corner-policy-20260912.json"
  : "reports/iteration/quick-move-corner-evidence-20260912-ee4e74cb.json";
if (fs.existsSync(output)) { console.log(`已有 checkpoint：${output}`); process.exit(0); }
const save = JSON.parse(fs.readFileSync(source, "utf8"));
const env = createSimulationEnv();
let comp;
try {
  env.reset({ seed: save.seed, activePlayerCount: 4, aiDifficulty: "laughable" });
  for (const step of save.replaySteps.slice(0, 412)) {
    const action = env.legalActions().find(a => a.actionId === step.action.actionId);
    assert(action);
    assert.equal(env.step(action).ok, true);
  }
  comp = env.createCounterfactualFork().composition;
  const envelope = comp.lifecycle.save().envelope;
  const root = JSON.parse(envelope.committedState);
  const recordedMove = save.replaySteps[412].action;
  const actorId = recordedMove.actorId;
  const player = root.players.players.find(p => p.id === actorId);
  assert(player.mainActionCompleted && player.hand.length);
  const donor = root.players.players.find(p => p.hand.some(c => c.id === "alien-chong-9-10"));
  assert(donor && donor !== player);
  const donorIndex = donor.hand.findIndex(c => c.id === "alien-chong-9-10");
  const card = donor.hand[donorIndex];
  assert.equal(cards.getDiscardActionMoveRewardForCard(card).gain.score, 1);
  // 固定正式盘面的显式测试变体：交换既有手牌实例，保持卡牌总数/身份/序列不变。
  donor.hand[donorIndex] = player.hand[0];
  player.hand[0] = card;
  player.resources.energy = 0;
  const fixture = { ...envelope, committedState: JSON.stringify(root) };
  const matchesMove = a => a.target?.rocketId === recordedMove.target.rocketId
    && a.target?.deltaX === recordedMove.target.deltaX && a.target?.deltaY === recordedMove.target.deltaY;
  const outcomes = [];
  for (const mode of ["ordinary-payment", "corner"]) {
    assert.equal(comp.lifecycle.restore(fixture).ok, true);
    const observation = comp.projection({ role: "player", playerId: actorId }).state;
    const legal = comp.inputPort.enumerateActions({ actorId });
    const catalog = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: observation,
      focalSeatId: actorId, legalActions: legal });
    const goal = observation.probeRouteRequirements.candidates.find(g => g.moveTiming?.some(t =>
      matchesMove({ target: t }) && t.comparable && t.earlyMovementPoints < t.delayedMovementPoints)
      && (!policyMode || catalog.some(target => target.planId === `probe:${g.requirementId}`)));
    assert(goal, "必须沿用有明确转动损失证据的同探测器首步");
    const action = mode === "corner"
      ? legal.find(a => a.family === "card_corner" && a.target.cardInstanceId === card.id)
      : legal.find(a => a.family === "move" && matchesMove(a));
    assert(action);
    const allowed = evaluator.allowsQuickActionTiming({ observation, action, legalActions: legal,
      routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` });
    function checkReuse(obs, selected, legalActions) {
      const steps = continuation.compilePlanSteps([{ ...continuation.capturePlanStep({ observation: obs, action: selected }),
        routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` }]);
      assert(steps[0].valid, JSON.stringify(steps[0]));
      assert.equal(continuation.planReuseCheck({ schemaVersion: continuation.PLAN_SCHEMA_VERSION,
        nextActionId: selected.actionId, steps }, obs, legalActions).hit, true);
    }
    if (policyMode) {
      assert(catalog.some(t => t.planId === `probe:${goal.requirementId}` && t.compatibleActionIds.includes(action.actionId)));
      checkReuse(observation, action, legal);
    }
    assert.equal(comp.inputPort.submitAction(action).ok, true);
    const steps = [];
    while (comp.inspect().session) {
      assert(steps.length < 15);
      const decision = comp.inspect().session.decision;
      let selected;
      if (decision.choices.some(a => a.family === "choose_payment")) {
        selected = decision.choices.find(a => a.target.cardIds?.length === 1 && a.target.cardIds[0] === card.id);
      } else {
        selected = decision.choices.find(matchesMove)
          || decision.choices.find(a => a.target.skip === true) || decision.choices[0];
      }
      assert(selected);
      if (policyMode) {
        const obs = comp.projection({ role: "player", playerId: actorId }).state;
        const successors = evaluator.selectSecondaryAgentSuccessors({ branchObservation: obs,
          focalSeatId: actorId, currentAction: action, legalSuccessors: decision.choices,
          routeTargetId: goal.targetId, routePlanId: `probe:${goal.requirementId}` });
        assert(successors.some(a => a.actionId === selected.actionId), "同目标策略方向/付款必须保留实际选项");
        checkReuse(obs, selected, decision.choices);
      }
      steps.push(selected);
      assert.equal(comp.inputPort.submitDecision({ decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion, ownerId: decision.ownerId, choice: selected }).ok, true);
    }
    const after = JSON.parse(comp.lifecycle.save().envelope.committedState);
    const own = after.players.players.find(p => p.id === actorId);
    assert(!own.hand.some(c => c.id === card.id));
    outcomes.push({ mode, allowed, multiplier: action.payload.multiplier ?? null, steps,
      scoreDelta: own.resources.score - player.resources.score,
      energyDelta: own.resources.energy - player.resources.energy,
      coordinate: rockets.getRocketSectorCoordinate(after.pieces.rockets.find(r => r.id === recordedMove.target.rocketId)),
      targetId: goal.targetId, planId: `probe:${goal.requirementId}` });
  }
  assert.deepEqual(outcomes[0].coordinate, outcomes[1].coordinate);
  assert.equal(outcomes[0].energyDelta, outcomes[1].energyDelta);
  assert.equal(outcomes[1].scoreDelta - outcomes[0].scoreDelta, 1);
  assert.equal(outcomes[0].allowed, true);
  assert.equal(outcomes[1].allowed, policyMode, "机会移动角标准入应符合所验证版本");
  const result = { source, inputStep: 413, policyMode,
    policyEvidence: policyMode ? "根目录、同目标条件后继、逐步计划编译与复用断言全部通过；生产为0a81908e之后本批工作树" : null,
    fixture: { swappedCard: card.id, donor: donor.id,
    actorId, energy: 0 }, outcomes,
    scope: "正式合法输入及条件链对照；显式手牌交换变体，不是原完整局实际持牌，也不调用AI搜索。倍增接口无实现，当前正式枚举multiplier为1，未伪造倍增案例。" };
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(result, null, 2));
} finally { if (comp) comp.dispose(); env.dispose(); }
