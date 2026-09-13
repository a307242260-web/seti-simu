"use strict";
const assert = require("node:assert/strict");
const { createReportSave } = require("./robot-report-fixture");
const { checkpointFromSave } = require("./run_research_validation");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const aliens = require("../randomizer/game/aliens");
const cards = require("../randomizer/game/cards/deck");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const save = createReportSave("seti-free-analyze-v1");
const hiddenSpeciesResults = [];
for (const [slotId, speciesKey, hiddenKind = "cards"] of [[1, "amiba"], [2, "chong"], [1, "chong"],
  ...["aomomo", "banrenma", "runezu", "yichangdian", "jiuzhe", "fangzhou"].map(key => [1, key]),
  [1, "fangzhou", "rewards"]]) {
const env = createSimulationEnv();
try {
  env.loadCheckpoint(checkpointFromSave(save, { seed: save.seed, activePlayerCount: 4 }));
  const fork = createSimulationRuleComposition({ seed: save.seed, random: createSeededRandom(save.seed),
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, save.seed, viewer?.playerId, []) }).composition;
  try {
    const envelope = env.createCheckpoint().coreState.compositionEnvelope;
    const state = JSON.parse(envelope.committedState);
    if (slotId === 1 && speciesKey === "chong") {
      state.aliens.aliens[1].assignedAlienId = aliens.chong.ALIEN_ID;
      state.aliens.aliens[2].assignedAlienId = aliens.amiba.ALIEN_ID;
    }
    if (!["amiba", "chong"].includes(speciesKey)) {
      // 其余物种为独立规则场景，不改变405盘面的生产配置；每例仍只有两个物种配置。
      state.aliens.amiba.initialConfiguration = null;
      state.aliens.aliens[slotId].assignedAlienId = aliens[speciesKey].ALIEN_ID;
      state.aliens[speciesKey].initialConfiguration = aliens[speciesKey].createInitialConfiguration(
        createSeededRandom(`hidden-reveal:${speciesKey}`), state.players.players);
    }
    const actor = state.players.players.find(player => player.id === state.turn.currentPlayerId);
    const knownIndex = state.cards.drawPileCardIds.indexOf("b_11.webp");
    assert.ok(knownIndex >= 0);
    state.cards.drawPileCardIds.unshift(...state.cards.drawPileCardIds.splice(knownIndex, 1));
    assert.equal(cards.blindDraw(state.cards, state.players, actor, () => 0, { root: state }).ok, true);
    actor.mainActionCompleted = true;
    for (const color of aliens.TRACE_TYPES) assert.equal(aliens.placeFirstTrace(state.aliens, slotId, color, actor.color).ok, true);
    const observations = [];
    const actualCards = [];
    for (const reverse of [false, true]) {
    const variant = structuredClone(state);
    if (reverse) {
      const configuration = variant.aliens[speciesKey].initialConfiguration;
      if (hiddenKind === "rewards") configuration.card1Deck.reverse();
      else if (speciesKey === "fangzhou") {
        for (const variants of Object.values(configuration.playerCard2Variants)) {
          for (const color of Object.keys(variants)) variants[color] = 5 - variants[color];
        }
      } else configuration.cardDeck.reverse();
    }
    const restored = fork.lifecycle.restore({ ...envelope, committedState: JSON.stringify(variant), session: null });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    const actions = fork.inputPort.enumerateActions({});
    const end = actions.find(action => action.family === "end_turn");
    assert.ok(end, JSON.stringify(actions));
    const before = fork.lifecycle.save().envelope;
    const results = fork.counterfactualPort.evaluate([end], {
      viewer: { role: "player", playerId: actor.id }, maxNodes: 8, maxExecutionNodes: 64,
      maxFrontierNodes: 16,
      secondaryAgentSearch: { focalSeatId: actor.id, maxProxyDepth: 1,
        selectSuccessors: () => [], selectRouteTarget: () => null },
    });
    assert.equal(results[0].status, "settled");
    assert.equal(results[0].confidence, "low");
    assert.ok(results[0].reasonCodes.includes("counterfactual-hidden-information"));
    assert.ok(results[0].leaves.length);
    const knownPreparations = results[0].rootObservation.techGainRequirements.publicityPreparationPlans
      .filter(plan => plan.cardInstanceId);
    assert.ok(knownPreparations.length, "夹具必须包含已知牌宣传准备，验证不会过度过滤");
    for (const leaf of results[0].leaves) {
      assert.equal(leaf.observation.informationBoundary?.code, "alien_reveal_turn_end");
      assert.equal(leaf.observation.publicState.board.aliens.slots[slotId - 1].revealed, false);
      assert.equal(leaf.observation.publicState.board.aliens.slots[slotId - 1].alienId, null);
      for (const known of knownPreparations) assert.ok(
        leaf.observation.techGainRequirements.publicityPreparationPlans.some(plan => plan.planId === known.planId),
        "已知牌的合法宣传准备仍保留");
    }
    assert.deepEqual(fork.lifecycle.save().envelope, before);
    observations.push(results[0].leaves.map(leaf => leaf.observation));
    if (slotId === 1 && !reverse && hiddenKind === "cards") hiddenSpeciesResults.push({
      speciesKey, root: results[0].rootObservation, observations: observations[0],
    });
    assert.equal(fork.inputPort.submitAction(end).ok, true);
    const actualEnvelope = fork.lifecycle.save().envelope;
    const actual = actualEnvelope.session?.session?.workingState || JSON.parse(actualEnvelope.committedState);
    assert.equal(actual.aliens.aliens[slotId].revealed, true);
    actualCards.push(hiddenKind === "rewards" ? actual.aliens.fangzhou.card1Revealed : speciesKey === "jiuzhe"
      ? actual.aliens.jiuzhe.playerCardsById[actor.id].cards
      : speciesKey === "fangzhou" ? actual.aliens.fangzhou.playerCard2ById[actor.id].cards
      : actual.players.players.find(player => player.id === actor.id).hand.map(card => card.cardId));
    console.log(`${speciesKey}/${hiddenKind} reverse=${reverse} status=${results[0].status} leaves=${results[0].leaves.length} confidence=${results[0].confidence} code=${results[0].code} reasons=${JSON.stringify(results[0].reasonCodes)}`);
    }
    assert.notDeepEqual(actualCards[0], actualCards[1], "真实揭示必须实际消费不同的隐藏牌序");
    const differences = [];
    function compare(left, right, path = "$") {
      if (Object.is(left, right)) return;
      if (left && right && typeof left === "object" && typeof right === "object") {
        for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) compare(left[key], right[key], `${path}.${key}`);
      } else differences.push({ path, left, right });
    }
    compare(observations[0], observations[1]);
    assert.equal(differences.length, 0, `仅隐藏牌序变化不得影响搜索可见观察：${JSON.stringify(differences)}`);
  } finally { fork.dispose(); }
} finally { env.dispose(); }
}
console.log("alien reveal hidden information tests passed");
for (const result of hiddenSpeciesResults.slice(1)) {
  assert.deepEqual(result.root, hiddenSpeciesResults[0].root, "隐藏物种差分的根玩家信息必须相同");
  assert.deepEqual(result.observations, hiddenSpeciesResults[0].observations,
    `真实隐藏物种${result.speciesKey}不得改变同一公开根的搜索结果`);
}

assert.equal(hiddenSpeciesResults.length, 8);
console.log("all eight hidden species yield the same search observation for an identical player-visible root");

// 正式角标→发射：根资源不足，只有假设抽到钱后才能发射，不用伪造合法集。
const env = createSimulationEnv();
try {
  env.loadCheckpoint(checkpointFromSave(save, { seed: save.seed, activePlayerCount: 4 }));
  const composition = createSimulationRuleComposition({ seed: save.seed, random: createSeededRandom(save.seed),
    projectCounterfactualState: (state, viewer) => buildRuleObservation(state, save.seed, viewer?.playerId, []) }).composition;
  try {
    const envelope = env.createCheckpoint().coreState.compositionEnvelope;
    const state = JSON.parse(envelope.committedState);
    const actor = state.players.players.find(player => player.id === state.turn.currentPlayerId);
    state.aliens.amiba.initialConfiguration = null;
    Object.assign(state.aliens.aliens[1], { assignedAlienId: "方舟", alienId: "方舟", revealed: true });
    state.aliens.fangzhou.initialConfiguration = aliens.fangzhou.createInitialConfiguration(
      createSeededRandom("known-fangzhou"), state.players.players);
    assert.equal(aliens.fangzhou.initializeFangzhouReveal(state.aliens, 1, actor, state.players.players).ok, true);
    const unlocked = aliens.fangzhou.unlockCard2(state.aliens, actor, "pink");
    assert.equal(unlocked.ok, true);
    actor.hand.push(unlocked.handCard);
    actor.resources.handSize = actor.hand.length;
    const launchCost = require("../randomizer/game/abilities/rocket").getLaunchCost({ state }, actor).credits;
    actor.resources.credits = launchCost - 1;
    actor.mainActionCompleted = false;
    let funded = false;
    let unfunded = false;
    // 有限公开状态集合验证两类假设；不是AI对局/策略调参实验。
    for (let publicity = 0; publicity < 32 && !(funded && unfunded); publicity += 1) {
      actor.resources.publicity = publicity;
      const restored = composition.lifecycle.restore({ ...envelope, committedState: JSON.stringify(state), session: null });
      assert.equal(restored.ok, true, JSON.stringify(restored));
      const actions = composition.inputPort.enumerateActions({});
      assert.ok(!actions.some(action => action.family === "launch"), "根缺1钱，不能发射");
      const corner = actions.find(action => action.family === "card_corner" && action.payload?.kind === "fangzhou_basic");
      assert.ok(corner);
      const before = composition.lifecycle.save().envelope;
      let fundedSuccessor = false;
      const result = composition.counterfactualPort.evaluate([corner], {
        viewer: { role: "player", playerId: actor.id }, maxNodes: 8, maxExecutionNodes: 64, maxFrontierNodes: 16,
        secondaryAgentSearch: { focalSeatId: actor.id, maxProxyDepth: 1,
          selectSuccessors: ({ legalSuccessors }) => {
            const launch = legalSuccessors.find(action => action.family === "launch");
            if (launch) fundedSuccessor = true;
            return launch ? [launch] : [];
          }, selectRouteTarget: () => null },
      })[0];
      assert.deepEqual(composition.lifecycle.save().envelope, before);
      for (const leaf of result.leaves) {
        assert.equal(leaf.observation.publicState.board.aliens.slots[0].alienId, "方舟", "已揭示身份不能重抽");
        assert.equal(leaf.observation.publicState.board.aliens.slots[0].revealed, true);
      }
      const launched = result.leaves.some(leaf => leaf.secondaryAgentTrace.some(action => action.family === "launch"));
      if (fundedSuccessor) {
        assert.ok(launched, "获得假设奖励的钱后必须真实执行后续发射并形成叶");
        funded = true;
      } else {
        assert.equal(launched, false);
        unfunded = true;
      }
    }
    assert.ok(funded && unfunded, "覆盖获得所需资源和未获得两种假设");
    console.log("fangzhou hypothesis resources fund a real subsequent launch; unfunded branch cannot launch");
  } finally { composition.dispose(); }
} finally { env.dispose(); }
