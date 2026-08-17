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

function createScanComposition(root) {
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
console.log("science scan flow finalize tests passed");
