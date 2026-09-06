"use strict";

// 扫描流串尾统一扇区结算（SCAN_FINALIZE）：
// - 同一扫描 flow 内完成扇区不提前重置（P13），后续节点命中已满扇区只放额外标记；
// - 跳过任意扫描节点后，串尾 SCAN_FINALIZE 仍触发一次 SETTLE；
// - 一次扫描行动只结算一次（SETTLE 数量 = 1），且位于 SCAN_FINALIZE 之后。
// 场景：p1 拥有紫2（水星扫描）+ 紫3（手牌扫描），地球扇区预填满只剩 1 个未替换，
// 地球扫描补满扇区 → 水星扫描跳过 → 手牌扫描命中已满的地球扇区（额外标记）。

const assert = require("node:assert/strict");
const scienceSession = require("./science-session");
const standardAction = require("../actions/standard-action");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const { createRuleComposition } = require("../rule-composition");
const data = require("../data");
const players = require("../players");
const tech = require("../tech");
const solar = require("../../solar-system/core");
const rockets = require("../rockets");
const aliens = require("../aliens");

function createActionContext(root) {
  return {
    state: root,
    players: root.players,
    cards: root.cards,
    pieces: root.pieces,
    solarSystem: root.solarSystem,
    data: root.data,
    planets: root.planets,
    tech: root.tech,
    aliens: root.aliens,
    turn: root.turn,
    match: root.match,
    standardActionAuthority: {
      actorId: root.turn.currentPlayerId,
      stateVersion: root.meta.stateVersion,
      decisionVersion: root.match.decisionVersion,
    },
  };
}

function toCommitted(root) {
  return stateStoreApi.createCommittedGameState({
    stateVersion: root.meta.stateVersion,
    gameId: root.meta.gameId,
    rulesetVersion: root.meta.rulesetVersion,
    seed: root.meta.seed,
    rngState: root.meta.rngState,
    sequences: root.meta.sequences,
    match: root.match,
    turn: root.turn,
    players: root.players,
    solarSystem: root.solarSystem,
    pieces: root.pieces,
    planets: root.planets,
    data: root.data,
    cards: root.cards,
    tech: root.tech,
    aliens: root.aliens,
    finalScoring: {},
  });
}

function createCanonicalState() {
  const meta = {
    stateVersion: 0,
    gameId: "scan-flow-finalize",
    rulesetVersion: "test-v1",
    seed: 7,
    rngState: {},
    sequences: {
      card: 100,
      dataToken: 200,
      finalMark: 1,
      nebulaToken: 1,
      nebulaReplacement: 1,
      rocket: 1,
    },
  };
  const dataState = data.createDefaultNebulaDataState();
  const techGameState = tech.createState(() => 0);
  for (const stack of Object.values(techGameState.stacks)) {
    stack.bonusQueue[stack.bonusIndex] = "bonus_3f";
    stack.bonusId = "bonus_3f";
  }
  data.fillAllNebulaData(dataState, { source: "setup", root: { meta } });

  const solarSystem = solar.createBaselineState();
  const snapshot = solar.createSolarSnapshot(solarSystem);
  const earth = snapshot.planetLocations.find((planet) => planet.planetId === "earth");
  const earthNebula = solar.getNebulaAtCoordinate(
    solar.mod8(earth.x),
    5,
    solarSystem.sectorBySlot,
  ).id;
  const earthCapacity = data.getNebulaCapacity(earthNebula);
  const player = {
    id: "p1",
    color: "brown",
    resources: {
      credits: 10,
      energy: 10,
      publicity: 2,
      score: 0,
      availableData: 0,
      computerCapacity: 5,
      handSize: 1,
    },
    income: {},
    hand: [],
    reservedCards: [],
    techState: players.normalizePlayerTechState({
      ownedTiles: { purple2: true, purple3: true },
    }),
    mainActionCompleted: false,
  };
  // 地球扇区预填满只剩 1 个未替换 token：地球扫描补满 → 本扫描 flow 内完成。
  for (let index = 0; index < earthCapacity - 1; index += 1) {
    data.replaceNextNebulaDataToken(dataState, earthNebula, player, {
      source: "test",
      scoreSourceKey: "test",
      root: { meta },
    });
  }
  // 手牌扫描卡：扫描代码映射到包含地球扇区的颜色族（紫3 命中已满扇区 → 额外标记）。
  const SCAN_CODE_PAIRS = [
    ["sector-4-a", "sector-3-a"],
    ["sector-2-b", "sector-3-b"],
    ["sector-2-a", "sector-1-a"],
    ["sector-1-b", "sector-4-b"],
  ];
  const code = SCAN_CODE_PAIRS.findIndex((pair) => pair.includes(earthNebula));
  const handCard = {
    id: "hand-scan-card",
    cardId: "b_2.webp",
    scanActionCode: code,
  };
  player.hand.push(handCard);
  player.resources.handSize = player.hand.length;

  const root = {
    meta,
    players: { players: [player] },
    cards: { discardPile: [], publicCards: [] },
    pieces: rockets.createRocketState(),
    solarSystem,
    data: dataState,
    planets: {},
    tech: techGameState,
    aliens: aliens.createDefaultAlienState(),
    turn: { currentPlayerId: "p1" },
    match: { decisionVersion: 0 },
  };
  return { root, earthNebula };
}

function createScanComposition(root, counterfactualEnabled = false) {
  const initialState = toCommitted(root);
  return createRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createInitialState() { return structuredClone(initialState); },
    createActionContext,
    createActionRegistry() {
      const registry = standardAction.createRegistry({
        getAuthority: (context) => context.standardActionAuthority,
      });
      for (const definition of scienceSession.createActionDefinitions()) {
        registry.register(definition);
      }
      return registry;
    },
    effectDomains: [{
      id: scienceSession.DOMAIN_ID,
      families: scienceSession.ACTION_FAMILIES,
      create: scienceSession.createScienceDomain,
    }],
    projectState: (state) => state,
    createCounterfactualFork: counterfactualEnabled ? (envelope) => {
      const fork = createScanComposition(root);
      const restored = fork.lifecycle.restore(envelope);
      assert.equal(restored.ok, true);
      return fork;
    } : null,
  });
}

function getScanAction(composition) {
  const actions = composition.inputPort.enumerateActions({ family: "scan" });
  assert.ok(actions.length >= 1, "扫描主行动必须可枚举");
  const action = actions.find((candidate) => (
    candidate.target?.kind === "standard-scan"
  )) || actions[0];
  assert.equal(action.family, "scan");
  assert.equal(action.actorId, "p1");
  return action;
}

function submitDecision(composition, choice) {
  const inspected = composition.inspect();
  assert.equal(inspected.phase, "awaiting_input", "必须处于等待输入状态");
  const decision = inspected.session.decision;
  const result = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    ownerId: decision.ownerId,
    choice,
  });
  assert.equal(result.ok, true, `决策必须可提交: ${result.code || result.message || ""}`);
  return result;
}

function pickChoice(composition, predicate, message) {
  const inspected = composition.inspect();
  assert.equal(inspected.phase, "awaiting_input", "必须处于等待输入状态");
  const decision = inspected.session.decision;
  const choice = decision.choices.find(predicate);
  assert.ok(choice, message);
  return choice;
}

// 紫1首步仍由地球及相邻扇区组成；共享几何函数不改变正式Decision的目标集合。
for (let rotation = 0; rotation < 8; rotation += 1) {
  const { root } = createCanonicalState();
  root.solarSystem.rotation.wheel1Steps = rotation;
  root.players.players[0].techState.ownedTiles.purple1 = { tileId: "purple1" };
  const earth = solar.createSolarSnapshot(root.solarSystem).planetLocations.find((p) => p.planetId === "earth");
  const expected = [...new Set([-1, 0, 1].map((offset) => (
    solar.getNebulaAtCoordinate(solar.mod8(earth.x + offset), 5, root.solarSystem.sectorBySlot).id
  )))].sort();
  const composition = createScanComposition(root);
  assert.equal(composition.inputPort.submitAction(getScanAction(composition)).ok, true);
  assert.deepEqual(composition.inspect().session.decision.choices.map((choice) => choice.target.nebulaId).sort(), expected);
}

// 地球扇区扫描完成 → 水星扫描跳过 → 手牌扫描命中已满扇区（额外标记）→
// 串尾 SCAN_FINALIZE 统一触发一次 SETTLE。
function runFullScanFlow() {
  const { root, earthNebula } = createCanonicalState();
  const composition = createScanComposition(root);
  const action = getScanAction(composition);

  const opened = composition.inputPort.submitAction(action);
  assert.equal(opened.ok, true, "扫描主行动必须可执行");

  // 决策 1：地球扇区扫描（地球所在扇区唯一星云，补满扇区完成）。
  const earthChoice = pickChoice(
    composition,
    (choice) => choice.target?.nebulaId === earthNebula,
    "地球扫描决策必须提供地球扇区星云选项",
  );
  let finalResult = submitDecision(composition, earthChoice);

  // 决策 2：水星扫描（紫2，可跳过）——跳过，验证串尾 FINALIZE 仍会结算。
  const skipChoice = pickChoice(
    composition,
    (choice) => choice.target?.skip === true,
    "水星扫描必须提供跳过选项",
  );
  finalResult = submitDecision(composition, skipChoice);

  // 决策 3：手牌扫描（紫3，可跳过）——选择地球扇区星云：已满扇区 → 额外标记。
  const handEarthChoice = pickChoice(
    composition,
    (choice) => choice.target?.nebulaId === earthNebula,
    "手牌扫描决策必须提供地球扇区星云选项",
  );
  finalResult = submitDecision(composition, handEarthChoice);

  // 决策 4：扇区胜利奖励（首个完成扇区奖励含粉色痕迹）→ 选择任意外星人槽位。
  finalResult = submitDecision(composition, pickChoice(
    composition,
    (choice) => choice.target?.kind === "planet-reward-alien-trace",
    "扇区胜利粉色痕迹奖励必须提供外星人槽位选项",
  ));

  assert.equal(composition.inspect().phase, "idle", "扫描 flow 必须完整结算结束");
  return { composition, finalResult, earthNebula };
}

function testScanFlowSettlesOnceAtFinalize() {
  const { composition, finalResult, earthNebula } = runFullScanFlow();
  const committedState = composition.stateSourcePort.getSnapshot();

  // 扇区只结算一次，且发生在串尾：SETTLE 位于 SCAN_FINALIZE 之后。
  const effectTypes = (finalResult.journal?.effects || []).map((entry) => entry.type);
  const settleIndexes = effectTypes
    .map((type, index) => (type === scienceSession.EFFECT_TYPES.SETTLE ? index : -1))
    .filter((index) => index >= 0);
  const finalizeIndex = effectTypes.indexOf(scienceSession.EFFECT_TYPES.SCAN_FINALIZE);
  assert.ok(finalizeIndex >= 0, "扫描流必须包含 SCAN_FINALIZE 串尾节点");
  assert.equal(settleIndexes.length, 1, "一次扫描行动只能触发一次扇区结算");
  assert.ok(
    settleIndexes[0] > finalizeIndex,
    "SETTLE 必须位于 SCAN_FINALIZE 之后（统一在串尾判定）",
  );

  // 地球扇区完成并结算：settlementCount = 1，且已重置（数据 token 不再全部归属玩家）。
  const earthSettlements = committedState.data.sectorSettlements?.sectors?.[earthNebula];
  assert.equal(earthSettlements?.settlementCount, 1, "地球扇区必须结算 1 次");
  const earthTokens = data.listNebulaTokens(committedState.data, earthNebula);
  assert.equal(earthTokens.length, data.getNebulaCapacity(earthNebula));
  assert.ok(
    earthTokens.every((token) => !token.replacedByPlayerId),
    "结算后扇区必须重新填满且数据 token 不再归属玩家",
  );

  // P13：同一 flow 内手牌扫描命中已满扇区 → 额外标记（不提前重置、不获得数据）。
  // 额外标记计入本次扇区排名，结算后随扇区重置一并清空，故从 journal 的
  // signalMarked(extra:true) 事件断言（发生在 SCAN_FINALIZE/SETTLE 之前）。
  const extraSignal = (finalResult.journal?.events || []).find((event) => (
    event.type === "signalMarked" && event.extra === true && event.nebulaId === earthNebula
  ));
  assert.ok(extraSignal, "手牌扫描命中已满扇区必须写入额外标记（signalMarked extra:true）");

  // 手牌扫描卡已弃置；扫描主行动已消耗并支付费用。
  const player = committedState.players.players[0];
  assert.equal(player.hand.length, 0, "手牌扫描卡必须被弃置");
  assert.equal(player.mainActionCompleted, true, "扫描主行动必须消耗主行动");
  assert.equal(player.resources.credits, 9, "扫描主行动必须支付标准费用");
}

function testSkipStillSettles() {
  // 无紫色科技 + 无公共牌：队列只剩地球扫描（唯一决策）→ FINALIZE → SETTLE。
  const { root, earthNebula } = createCanonicalState();
  root.players.players[0].techState = players.normalizePlayerTechState(null);
  const composition = createScanComposition(root);
  const action = getScanAction(composition);
  const opened = composition.inputPort.submitAction(action);
  assert.equal(opened.ok, true);

  // 地球扫描决策（地球所在扇区唯一星云）。
  let finalResult = submitDecision(composition, pickChoice(
    composition,
    (choice) => choice.target?.nebulaId === earthNebula,
    "地球扫描决策必须提供地球扇区星云选项",
  ));
  // 扇区胜利粉色痕迹奖励 → 任意外星人槽位。
  finalResult = submitDecision(composition, pickChoice(
    composition,
    (choice) => choice.target?.kind === "planet-reward-alien-trace",
    "扇区胜利粉色痕迹奖励必须提供外星人槽位选项",
  ));

  assert.equal(composition.inspect().phase, "idle", "无跳过节点时扫描 flow 结算完成");
  const committedState = composition.stateSourcePort.getSnapshot();
  const earthSettlements = committedState.data.sectorSettlements?.sectors?.[earthNebula];
  assert.equal(earthSettlements?.settlementCount, 1, "地球扇区必须结算 1 次");
  // 串尾 SCAN_FINALIZE 只触发一次 SETTLE。
  const effectTypes = (finalResult.journal?.effects || []).map((entry) => entry.type);
  assert.equal(
    effectTypes.filter((type) => type === scienceSession.EFFECT_TYPES.SETTLE).length,
    1,
    "一次扫描行动只能触发一次扇区结算",
  );
}

testScanFlowSettlesOnceAtFinalize();
testSkipStillSettles();

// 同一Science owner的蓝槽奖励必须经正式Decision入账并随非零checkpoint恢复。
for (const tileId of ["blue1", "blue2", "blue3", "blue4"]) {
  const { root } = createCanonicalState();
  const actor = root.players.players[0];
  actor.techState.ownedTiles[tileId] = true;
  actor.techState.blueBoardSlots[tileId] = 1;
  for (let index = 0; index < 2; index += 1) assert.equal(data.gainData(actor, { root }).ok, true);
  assert.equal(data.placeDataToComputer(actor).ok, true);
  root.cards.publicCards = [{ id: "blue-reward-public", cardId: "b_117.webp" }];
  const composition = createScanComposition(root);
  const before = composition.stateSourcePort.getSnapshot();
  const action = composition.inputPort.enumerateActions({ family: "place_data" })[0];
  assert.ok(action);
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  submitDecision(composition, pickChoice(composition,
    (choice) => choice.target?.target === "blueBonus", "蓝槽必须可放置"));
  if (tileId === "blue3") {
    submitDecision(composition, pickChoice(composition,
      (choice) => choice.target?.publicSlotIndex === 0, "蓝3必须停在精选Decision"));
  }
  assert.equal(composition.inspect().phase, "idle");
  const after = composition.stateSourcePort.getSnapshot();
  const result = after.players.players[0];
  if (tileId === "blue1") assert.equal(result.blueBonusResources.credits, 1);
  if (tileId === "blue2") assert.equal(result.blueBonusResources.energy, 1);
  if (tileId === "blue3") assert.equal(result.hand.find((card) => card.id === "blue-reward-public").blueBonusOwnerId, actor.id);
  if (tileId === "blue4") assert.equal(result.resources.publicity - before.players.players[0].resources.publicity, 2);
  const saved = composition.lifecycle.save();
  assert.equal(saved.ok, true);
  const restored = createScanComposition(root);
  assert.equal(restored.lifecycle.restore(saved.envelope).ok, true);
  assert.deepEqual(restored.stateSourcePort.getSnapshot(), after);
  assert.deepEqual(restored.inputPort.enumerateActions({}), composition.inputPort.enumerateActions({}));
  assert.equal(before.players.players[0].blueBonusResources, undefined, "事务不得污染初始snapshot");
}
{
  const { root } = createCanonicalState();
  const actor = root.players.players[0];
  actor.resources.publicity = 6;
  const stack = root.tech.stacks.orange2;
  stack.bonusQueue[stack.bonusIndex] = "bonus_1c";
  stack.bonusId = "bonus_1c";
  root.cards.publicCards = [{ id: "tech-reward-public", cardId: "b_117.webp" }];
  const composition = createScanComposition(root);
  const action = composition.inputPort.enumerateActions({ family: "research_tech" })[0];
  assert.ok(action);
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  submitDecision(composition, pickChoice(composition,
    (choice) => choice.target?.tileId === "orange2", "正式研究候选必须存在"));
  submitDecision(composition, pickChoice(composition,
    (choice) => choice.target?.publicSlotIndex === 0, "科技背面精选必须可选"));
  const selected = composition.stateSourcePort.getSnapshot().players.players[0].hand
    .find((card) => card.id === "tech-reward-public");
  assert.ok(selected);
  assert.equal(selected.blueBonusOwnerId, undefined, "普通科技精选不得混入蓝槽来源");
}
// 真实Science规则分叉：不同蓝槽结算后的状态不可按评分摘要支配删除。
{
  const { root } = createCanonicalState();
  const actor = root.players.players[0];
  for (const [tileId, slot] of [["blue1", 1], ["blue2", 2]]) {
    actor.techState.ownedTiles[tileId] = true;
    actor.techState.blueBoardSlots[tileId] = slot;
  }
  for (let index = 0; index < 3; index += 1) {
    assert.equal(data.gainData(actor, { root }).ok, true);
    assert.equal(data.placeDataToComputer(actor).ok, true);
  }
  assert.equal(data.gainData(actor, { root }).ok, true);
  const composition = createScanComposition(root, true);
  const before = composition.lifecycle.save().envelope;
  const action = composition.inputPort.enumerateActions({ family: "place_data" })[0];
  assert.ok(action);
  function search() {
    return composition.counterfactualPort.evaluate([action], {
      viewer: { playerId: actor.id, role: "player" },
      maxDepth: 3, maxNodes: 8, maxExecutionNodes: 16,
      maxFrontierNodes: 8,
      secondaryAgentSearch: {
        focalSeatId: actor.id, maxProxyDepth: 1,
        selectRouteTarget: () => "blue:reward",
        completesRouteTarget: ({ action: current }) => current.target?.target === "blueBonus",
        selectSuccessors: ({ legalSuccessors }) => legalSuccessors.filter((choice) => choice.target?.target === "blueBonus"),
      },
    })[0];
  }
  const distinct = search();
  assert.equal(distinct.status, "settled", JSON.stringify(distinct));
  assert.equal(distinct.leaves.length, 2, "不同来源/槽位的两条真实完成路线都必须保留");
  assert.deepEqual(composition.lifecycle.save().envelope, before, "反事实比较不得污染canonical");
}
// 探测器扫描必须保留来源身份、份数与卡牌回手归属，不把模型字段视为已执行。
{
  const cardEffects = require("../cards/effects");
  const deck = require("../cards/deck");
  const cardPlay = require("../cards/play-domain");
  const executors = new Map();
  const options = { runtime: { registerExecutor(type, executor) {
    executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
  } }, commitWorkingState(_state, context) { return { committedBy: context.source }; } };
  scienceSession.createScienceDomain(options);
  cardPlay.createExperimentalCardPlayDomain(options);
  // 非探测器扫描沿用既有Decision边界，不携入卡牌桥接元数据改变搜索状态身份。
  for (const mode of ["specified", "color"]) {
    const { root } = createCanonicalState();
    const scanOptions = { mode, color: Object.keys(cardEffects.NEBULA_IDS_BY_COLOR)[0] };
    // specified使用明确的正式太阳系扇区，确保进入多目标Decision。
    if (mode === "specified") scanOptions.nebulaIds = [0, 1].map(x =>
      solar.getNebulaAtCoordinate(x, 5, root.solarSystem.sectorBySlot).id);
    const result = executors.get(scienceSession.EFFECT_TYPES.SCAN_STEP).execute(root, {
      ownerId: root.players.players[0].id,
      payload: { options: scanOptions, cardInstanceId: "source-card", cardEffect: { type: "SCAN" } },
    }, { state: root });
    assert.equal(result.ok, true);
    assert.equal(result.spawnedEffects.length, 1);
    assert.deepEqual(result.spawnedEffects[0].effect.payload, { options: scanOptions },
      "非probe扫描不得扩大Decision payload");
  }
  for (const [cardId, expectedSignals, existingSignals = 0, shouldReturn = cardId === "b_88.webp"] of [
    ["b_22.webp", 2], ["b_50.webp", 3], ["b_50.webp", 0], ["b_50.webp", 1], ["b_53.webp", 1],
    ["b_54.webp", 1], ["b_58.webp", 3], ["b_64.webp", 2], ["b_88.webp", 1],
    ["b_88.webp", 1, 1, false], ["b_88.webp", 1, "complete", true], ["b_96.webp", 3]]) {
    const { root } = createCanonicalState();
    const actor = root.players.players[0];
    root.data = data.createDefaultNebulaDataState();
    data.fillAllNebulaData(root.data, { root, source: "probe-scan-test" });
    actor.resources.availableData = 0;
    actor.techState = players.normalizePlayerTechState(null);
    for (const [playerId, color, x] of [[actor.id, actor.color, 5], [actor.id, actor.color, 5], ["p2", "blue", 6]]) {
      assert.equal(rockets.launchRocketAtSector(root.pieces, { x, y: 1 }, { root, playerId, color }).ok, true);
    }
    assert.equal(rockets.createMovableTokenAtSector(root.pieces, { x: 7, y: 1 }, { root,
      playerId: actor.id, color: actor.color, fossilId: "scan-excluded-fossil" }).ok, true);
    const sourceNebula = solar.getNebulaAtCoordinate(5, 5, root.solarSystem.sectorBySlot).id;
    const count = existingSignals === "complete" ? data.getNebulaCapacity(sourceNebula) - 1 : existingSignals;
    for (let index = 0; index < count; index += 1) {
      assert.equal(data.replaceNextNebulaDataToken(root.data, sourceNebula,
        existingSignals === "complete" ? { id: "p2", color: "blue", resources: {} } : actor, { root }).ok, true);
    }
    const card = deck.createCardInstance(deck.getCatalogEntryForCard({ cardId }), 901);
    actor.hand = [card]; actor.resources.handSize = 1;
    const playResult = executors.get(cardPlay.EFFECT_TYPES.PLAY).execute(root, { ownerId: actor.id, payload: {
      action: { actorId: actor.id, target: { cardInstanceId: card.id }, payload: { cost: cardEffects.getCardPlayCost(card) } },
    } }, { state: root });
    assert.equal(playResult.ok, true, JSON.stringify(playResult));
    const starts = playResult.spawnedEffects.filter(entry => entry.effect.type === scienceSession.EFFECT_TYPES.SCAN_STEP);
    assert.equal(starts.length, 1, `${cardId} 在来源选择前不得拆散重复扫描`);
    // 这是扫描owner单元验证；b54/b58/b64的前置移动由移动域测试/完整composition验证。
    const queue = [...starts], signals = [], sources = [];
    let steps = 0;
    while (queue.length) {
      assert.ok(++steps < 30, "扫描有限义务应全部完成");
      const effect = queue.shift().effect;
      const executor = executors.get(effect.type);
      assert.ok(executor, effect.type);
      let result;
      if (effect.kind === "decision") {
        const choices = executor.getLegalChoices(root, effect, { state: root });
        assert.ok(choices.length);
        if (effect.payload.options?.mode === "probe") {
          const probes = choices.filter(choice => choice.target.rocketId != null);
          assert.ok(probes.length);
          assert.ok(probes.every(choice => choice.target.rocketId !== 4), "化石不是扫描探测器");
          assert.ok(probes.every(choice => !sources.includes(choice.target.rocketId)));
          if (cardId !== "b_50.webp") assert.ok(probes.every(choice => choice.target.rocketId !== 3));
          if (cardId === "b_50.webp" && !sources.length) assert.ok(probes.some(choice => choice.target.rocketId === 3));
          const stop = cardId === "b_50.webp" && sources.length >= expectedSignals;
          const choice = stop ? choices.find(choice => choice.target.done) : probes.find(choice => choice.target.rocketId === 3) || probes[0];
          assert.ok(choice);
          if (!stop) sources.push(choice.target.rocketId);
          result = executor.resolveDecision(root, effect, choice, { state: root });
        } else result = executor.resolveDecision(root, effect, choices.at(-1), { state: root });
      } else result = executor.execute(root, effect, { state: root });
      assert.equal(result.ok, true, JSON.stringify(result));
      signals.push(...(result.events || []).filter(event => event.type === "signalMarked"));
      queue.unshift(...(result.spawnedEffects || []));
    }
    assert.equal(signals.length, expectedSignals, `${cardId} 实际标记次数`);
    assert.equal(sources.length, cardId === "b_50.webp" ? expectedSignals : 1);
    if (["b_22.webp", "b_64.webp", "b_96.webp"].includes(cardId)) assert.equal(new Set(signals.map(event => event.nebulaId)).size, 1);
    if (cardId === "b_58.webp") assert.deepEqual(signals.map(event => event.nebulaId).sort(),
      [4, 5, 6].map(x => solar.getNebulaAtCoordinate(x, 5, root.solarSystem.sectorBySlot).id).sort());
    if (cardId === "b_50.webp" && expectedSignals === 3) assert.equal(new Set(signals.map(event => event.nebulaId)).size, 2, "同格两艘仍有两份扫描");
    if (cardId === "b_96.webp") assert.equal(actor.resources.availableData, 0);
    if (cardId === "b_88.webp") {
      assert.equal(actor.hand.filter(candidate => candidate.id === card.id).length, shouldReturn ? 1 : 0, "仅对应扇区恰好一个己方信号才回手");
      assert.equal(root.cards.discardPile.some(candidate => candidate.id === card.id), !shouldReturn);
      if (existingSignals === "complete") assert.equal(data.isSectorReadyToSettle(root.data, sourceNebula), true, "回手先于扇区结算");
    }
  }
}
// 任意扫描的真实扇区合法集与单来源剩余义务。
{
  const cardEffects = require("../cards/effects");
  const executors = new Map();
  scienceSession.createScienceDomain({ runtime: { registerExecutor(type, executor) {
    executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
  } }, commitWorkingState() { return {}; } });
  const sectors = Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat();
  for (const gainData of [true, false]) for (const nebulaId of sectors) {
    const { root } = createCanonicalState();
    root.data = data.createDefaultNebulaDataState();
    data.fillAllNebulaData(root.data, { root, source: "any-scan-test" });
    const actor = root.players.players[0];
    actor.resources.availableData = 0;
    actor.techState = players.normalizePlayerTechState(null);
    assert.deepEqual(scienceSession.listNebulaChoices(root, { nebulaIds: [] }), [], "指定空集不得变成全盘");
    const executor = executors.get(scienceSession.EFFECT_TYPES.SCAN_STEP);
    const prepared = executor.execute(root, { ownerId: actor.id,
      payload: { options: { mode: "any", gainData, sameSectorRemaining: 2 } } }, { state: root });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.spawnedEffects.length, 1, "任意扫描不得静默跳过");
    const decision = prepared.spawnedEffects[0].effect;
    const choices = executor.getLegalChoices(root, decision, { state: root });
    assert.deepEqual(choices.map(c => c.target.nebulaId).sort(), [...sectors].sort());
    let result = executor.resolveDecision(root, decision, choices.find(c => c.target.nebulaId === nebulaId), { state: root });
    assert.equal(result.ok, true);
    const marks = [...result.events.filter(e => e.type === "signalMarked")];
    assert.equal(result.spawnedEffects.length, 1);
    const remaining = result.spawnedEffects[0].effect;
    assert.notEqual(remaining.kind, "decision", "同扇区重复不得再次选择来源");
    result = executor.execute(root, remaining, { state: root });
    assert.equal(result.ok, true);
    marks.push(...result.events.filter(e => e.type === "signalMarked"));
    assert.deepEqual(marks.map(e => e.nebulaId), [nebulaId, nebulaId]);
    assert.equal(result.spawnedEffects.length, 0);
    assert.equal(actor.resources.availableData, gainData ? 2 : 0);
  }
  const repeated = cardEffects.buildPlayEffects({ cardId: "banrenma_8.webp" })
    .filter(e => e.type === cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].options.repeat, 2);
}
console.log("science scan and blue reward tests passed");
