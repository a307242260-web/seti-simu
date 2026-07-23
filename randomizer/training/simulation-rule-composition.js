"use strict";

const stateStoreApi = require("../game/state/state-store");
const highCouplingStateApi = require("../game/state/high-coupling-slices");
const effectRuntimeApi = require("../game/effects/session-runtime");
const standardActionDomainApi = require("../game/effects/standard-action-session");
const standardActionApi = require("../game/actions/standard-action");
const actions = require("../game/actions");
const initialGameStateApi = require("../game/state/initial-game-state");
const players = require("../game/players");
const solar = require("../solar-system/core");
const rockets = require("../game/rockets");
const planetStats = require("../game/planet-stats");
const data = require("../game/data");
const cards = require("../game/cards/deck");
const tech = require("../game/tech");
const industry = require("../game/industry");
const aliens = require("../game/aliens");
const finalScoring = require("../game/final-scoring");
const actionHistory = require("../game/history/action-history");
const turnFlowApi = require("../app/turn-flow");
const initialCards = require("../game/initial-cards");
const ai = require("../game/ai");
const planetReferenceLayout = require("../game/planet-reference-layout");
const rocketAbility = require("../game/abilities/rocket");
const { createRuleComposition } = require("../game/rule-composition");

const RULESET_VERSION = "seti-runtime-v1";
const DEFAULT_FINAL_SCORE_IDS = Object.freeze(["a", "b", "c", "d"]);
const INDUSTRY_CARD_FILES = Object.freeze([
  "层云核心.png", "芬威克研究中心.png", "赫利昂联合体.png", "寰宇动力.png",
  "任务中继站.png", "哨兵探测网络.png", "深空探测.png", "图灵系统.png",
  "未来跨度研究所.png", "异星实验室.png", "宇宙战略集团.png",
]);
const SIMULATION_FAMILY_CONTRACTS = Object.freeze([
  { family: "launch", obligation: "生产发射规则枚举、校验并提交火箭" },
  { family: "orbit", obligation: "生产环绕规则枚举目标并提交轨道占位" },
  { family: "land", obligation: "生产登陆规则枚举目标并提交星球占位" },
  {
    family: "scan",
    obligation: "扫描必须由生产望远镜规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入望远镜扫描规则端口",
  },
  {
    family: "analyze",
    obligation: "分析必须由生产数据轨规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入数据分析规则端口",
  },
  { family: "research_tech", obligation: "生产科技规则枚举科技板目标并提交研究" },
  {
    family: "play_card",
    obligation: "打牌必须由生产卡牌规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入卡牌效果执行端口",
  },
  { family: "pass", obligation: "生产回合规则提交 PASS 并建立预留牌 continuation" },
  { family: "move", obligation: "生产火箭规则枚举移动并建立支付 continuation" },
  {
    family: "quick_trade",
    obligation: "快速交易必须由生产资源规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入快速交易规则端口",
  },
  { family: "industry", obligation: "生产公司能力规则枚举并提交公司行动" },
  { family: "card_corner", obligation: "生产卡角规则枚举手牌并提交弃牌收益" },
  {
    family: "place_data",
    obligation: "放置数据必须由生产数据规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入数据放置规则端口",
  },
  {
    family: "runezu_face_symbol",
    obligation: "符号面行动必须由生产外星种族规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入 RUNEZU 符号面规则端口",
  },
  { family: "end_turn", obligation: "生产回合规则结算收入并切换 owner" },
  { family: "choose_card", obligation: "生产 continuation 枚举并提交预留牌选择" },
  { family: "choose_target", obligation: "生产 continuation 枚举并提交移动或科技目标" },
  { family: "choose_payment", obligation: "生产 continuation 枚举并提交弃牌或移动支付" },
  {
    family: "choose_reward",
    obligation: "奖励选择必须由生产效果 continuation 提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入奖励选择 continuation",
  },
  {
    family: "choose_branch",
    obligation: "分支选择必须由生产效果 continuation 提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入分支选择 continuation",
  },
  {
    family: "choose_final_scoring",
    obligation: "终局计分选择必须由生产终局规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入终局计分选择 continuation",
  },
  {
    family: "accept_optional_effect",
    obligation: "可选效果必须由生产效果 continuation 提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入可选效果 continuation",
  },
]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function replaceMutable(target, source) {
  for (const key of Reflect.ownKeys(target || {})) delete target[key];
  Object.assign(target, clone(source || {}));
  return target;
}

function createModules() {
  return {
    players,
    solar,
    rocketActions: rockets,
    planetStats,
    data,
    cards,
    tech,
    aliens,
    finalScoring,
    createTurnState: turnFlowApi.createTurnState,
  };
}

function createWorkingState(options = {}, random = Math.random) {
  restoreSequences({
    actionLog: 1, card: 1, dataToken: 1, finalMark: 1, handCard: 1,
    historyStep: 1, nebulaReplacement: 1, nebulaToken: 1, rocket: 1,
  });
  const state = initialGameStateApi.createSessionState(createModules(), {
    defaultInitialPlayerColor: players.DEFAULT_PLAYER_COLOR,
    activePlayerCount: options.activePlayerCount || 4,
    finalScoreIds: DEFAULT_FINAL_SCORE_IDS,
    random,
  });
  state.meta = {
    seed: options.seed ?? "seti-simulation",
    rngState: clone(options.rngState || { algorithm: "seti-simulation-mulberry32-v1", state: 1 }),
  };
  state.match.decisionVersion = 0;
  state.match.actionLog = [];
  if (options.initialize === true) initializeProductionGame(state, options, random);
  state.meta.sequences = readSequences(state);
  return state;
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    [result[index], result[pick]] = [result[pick], result[index]];
  }
  return result;
}

function createSelectionCard(kind, value) {
  if (kind === "industry") {
    return { id: `industry:${value}`, kind, label: value.replace(/\.[^.]+$/, ""), width: 1382, height: 1054 };
  }
  return { id: `initial:${value}`, kind, label: `初始牌 ${value}`, width: 744, height: 1039 };
}

function randomizeBoard(workingState, random) {
  const defaultPlayerId = workingState.playerState.players
    .find((player) => player.color === players.DEFAULT_PLAYER_COLOR)?.id || null;
  const others = workingState.playerState.players.map((player) => player.id)
    .filter((playerId) => playerId !== defaultPlayerId);
  const order = defaultPlayerId ? [defaultPlayerId, ...shuffle(others, random)] : shuffle(others, random);
  workingState.turnState.turnOrderPlayerIds = order;
  workingState.turnState.activePlayerIds = order.slice(0, workingState.turnState.activePlayerCount);
  workingState.turnState.startPlayerId = workingState.turnState.activePlayerIds[0] || null;
  workingState.playerState.currentPlayerId = workingState.turnState.startPlayerId;
  // 生产 TurnFlow 在确认轮序时会先准备一次 PASS 牌堆；随后正式初始化卡牌会重建牌区，
  // 但这一步仍属于显式 RNG 协议，必须保留以维持 Browser/Simulation 同种子同轨。
  cards.preparePassReservePiles(workingState.cardState, workingState.playerState, {
    rounds: [1, 2, 3],
    activePlayerCount: workingState.turnState.activePlayerCount,
    random,
  });

  workingState.solarState.wheelSteps = workingState.solarState.wheelSteps || [0, 0, 0, 0, 0];
  const wheelOffsets = [0, 0, 20, 11, 4];
  for (let wheel = 1; wheel <= 4; wheel += 1) {
    workingState.solarState.wheelSteps[wheel] -= Math.floor(random() * 8 + wheelOffsets[wheel]);
  }
  workingState.solarState.rotation = solar.normalizeRotationState(workingState.solarState.wheelSteps, 0);
  const sectors = [1, 2, 3, 4];
  while (sectors.length) {
    const slotId = sectors.length;
    const sectorId = sectors.splice(Math.floor(random() * sectors.length), 1)[0];
    workingState.solarState.sectorBySlot[slotId] = sectorId;
  }
  data.clearNebulaData(workingState.nebulaDataState);
  data.fillAllNebulaData(workingState.nebulaDataState, { source: "setup" });
  finalScoring.randomizeTileVariants(workingState.finalScoringState, DEFAULT_FINAL_SCORE_IDS, random);
  aliens.randomizeAlienAssignments(workingState.alienGameState);
  tech.setupBoardBonuses(workingState.techGameState, random);
}

function getEarthCoordinate(workingState) {
  const earth = solar.createSolarSnapshot(workingState.solarState).planetLocations
    .find((planet) => planet.planetId === "earth");
  return earth ? { x: earth.x, y: earth.y } : { x: 1, y: 1 };
}

function syncPlanetRockets(workingState) {
  workingState.rocketState.rockets = workingState.rocketState.rockets
    .filter((rocket) => rocket.surface !== "planets-reference");
  for (const planetId of planetReferenceLayout.PLANET_ORDER) {
    for (const marker of planetStats.getPlanetOrbitMarkers(workingState.planetStatsState, planetId)) {
      const slot = planetReferenceLayout.getPlanetSlot(planetId, "orbit", marker.sequence);
      if (!slot) continue;
      const rocket = {
        id: workingState.rocketState.nextRocketId++, playerId: marker.playerId, color: marker.color,
        referencePlacement: { ...slot, isPlanetMarker: true, playerId: marker.playerId, color: marker.color,
          referenceOffsetTokenWidths: 0, planetId, kind: "orbit", sequence: marker.sequence },
      };
      workingState.rocketState.rockets.push(rocket);
      rockets.placeRocketAtPlanetsReferencePoint(workingState.rocketState, rocket.id, {
        x: slot.x, y: slot.y, width: 1672, height: 941,
      });
    }
  }
}

function chooseInitialSelections(workingState, options, random) {
  const playerIds = workingState.turnState.activePlayerIds;
  const industryDeck = shuffle(INDUSTRY_CARD_FILES, random).slice(0, playerIds.length * 2);
  const initialDeck = shuffle(Array.from({ length: initialCards.INITIAL_CARD_COUNT }, (_item, index) => index + 1), random);
  for (const [index, playerId] of playerIds.entries()) {
    const player = workingState.playerState.players.find((candidate) => candidate.id === playerId);
    const industryOptions = industryDeck.slice(index * 2, index * 2 + 2)
      .map((fileName) => createSelectionCard("industry", fileName));
    const initialOptions = initialDeck.slice(index * 3, index * 3 + 3)
      .map((number) => createSelectionCard("initial", number));
    const pairs = ai.selectionEvaluator.getInitialPairs(initialOptions, 2);
    const plans = industryOptions.flatMap((industryCard) => pairs.map((initialSelection) => (
      ai.selectionEvaluator.scoreOpeningCombination(industryCard, initialSelection, {
        roundNumber: workingState.turnState.roundNumber,
        player,
        aiDifficulty: options.aiDifficulty || "laughable",
      })
    ))).sort((left, right) => Number(right.score || 0) - Number(left.score || 0)
      || String(left.industry?.id || "").localeCompare(String(right.industry?.id || "")));
    const policyResult = ai.heuristicPolicy.decideChoice({
      seatId: player.id,
      family: "choose_branch",
      stateVersion: workingState.turnState.roundNumber,
      decisionVersion: workingState.turnState.turnNumber,
      decisionId: "initial-selection",
      observation: { publicState: { roundNumber: workingState.turnState.roundNumber }, selfState: { playerId: player.id } },
      choices: plans.map((plan, planIndex) => ({
        choiceId: `${plan.industry?.id || planIndex}:${plan.initialCards.map((card) => card.id).join("+")}`,
        value: Number(plan.score || 0),
        target: { industryId: plan.industry?.id || null, initialIds: plan.initialCards.map((card) => card.id) },
        summary: `${plan.industry?.label || plan.industry?.id || "公司"} + 初始牌`,
        plan,
      })),
      policyOptions: { difficulty: options.aiDifficulty || "laughable" },
    });
    if (!policyResult.ok) throw new Error(policyResult.message);
    player.initialSelection = {
      industry: clone(policyResult.choice.plan.industry),
      removedInitialCards: clone(policyResult.choice.plan.initialCards),
    };
    player.aiDifficulty = options.aiDifficulty || "laughable";
  }
}

function initializeProductionGame(workingState, options, random) {
  randomizeBoard(workingState, random);
  createCardGame(workingState, random, 4);
  chooseInitialSelections(workingState, options, random);
  const selectionResult = initialCards.resolveInitialSelections({
    playerState: workingState.playerState,
    cardState: workingState.cardState,
    rocketState: workingState.rocketState,
    nebulaDataState: workingState.nebulaDataState,
    planetStatsState: workingState.planetStatsState,
    alienGameState: workingState.alienGameState,
    techGameState: workingState.techGameState,
    blindDrawCard(player) {
      return cards.blindDraw(workingState.cardState, workingState.playerState, player, random);
    },
    getEarthSectorCoordinate: () => getEarthCoordinate(workingState),
    launchRocketAtEarth(player) {
      return rockets.launchRocketAtSector(workingState.rocketState, getEarthCoordinate(workingState), {
        playerId: player.id, color: player.color,
      });
    },
  }, { playerIds: workingState.turnState.activePlayerIds });
  if (!selectionResult.ok) throw new Error(selectionResult.message);
  syncPlanetRockets(workingState);
  workingState.match.initialIncomeQueue = selectionResult.pendingIncomeIncreases.flatMap((entry) => (
    Array.from({ length: entry.count }, () => ({ playerId: entry.playerId, label: entry.label }))
  ));
  workingState.match.decisionVersion = 1;
  installOpeningDiscard(workingState);
}

function readSequences(workingState) {
  const nebulaSequences = data.getDeterministicSequences?.() || {};
  return {
    actionLog: (workingState.match.actionLog || []).length + 1,
    card: cards.getNextCardInstanceSequence(),
    dataToken: data.getNextDataTokenSequence(),
    finalMark: finalScoring.getNextFinalMarkSequence(),
    handCard: players.getNextHandCardSequence(),
    historyStep: actionHistory.getNextHistoryStepSequence(),
    nebulaReplacement: nebulaSequences.nebulaReplacement || 1,
    nebulaToken: nebulaSequences.nebulaToken || 1,
    rocket: workingState.rocketState.nextRocketId || 1,
  };
}

function restoreSequences(sequences = {}) {
  cards.restoreNextCardInstanceSequence(sequences.card || 1);
  players.restoreNextHandCardSequence(sequences.handCard || 1);
  finalScoring.restoreNextFinalMarkSequence(sequences.finalMark || 1);
  data.restoreNextDataTokenSequence(sequences.dataToken || 1);
  data.restoreDeterministicSequences({
    nebulaReplacement: sequences.nebulaReplacement || 1,
    nebulaToken: sequences.nebulaToken || 1,
  });
  actionHistory.restoreNextHistoryStepSequence(sequences.historyStep || 1);
}

function sequenceSnapshot(workingState) {
  return clone(workingState.meta?.sequences || readSequences(workingState));
}

function committedContext(workingState, overrides = {}) {
  return {
    gameId: "seti-simulation-runtime",
    rulesetVersion: RULESET_VERSION,
    seed: workingState.meta?.seed ?? "seti-simulation",
    rngState: clone(overrides.rngState || workingState.meta?.rngState || {}),
    sequences: sequenceSnapshot(workingState),
    ...clone(overrides),
  };
}

function createCommittedState(workingState, stateVersion, overrides = {}) {
  return highCouplingStateApi.purifyHighCouplingSlices(
    initialGameStateApi.createCommittedCandidate(
      workingState,
      committedContext(workingState, overrides),
      stateStoreApi.SCHEMA_VERSION,
      stateVersion,
    ),
  );
}

function restoreWorkingState(target, source, metadata = {}) {
  if (source?.playerState && source?.turnState) {
    for (const key of Object.keys(source)) {
      if (key === "meta") target.meta = clone(metadata.committedState?.meta || source.meta || {});
      else if (target[key] && typeof target[key] === "object") replaceMutable(target[key], source[key]);
      else target[key] = clone(source[key]);
    }
    restoreSequences(target.meta?.sequences || {});
    return target;
  }
  initialGameStateApi.restoreSessionState(target, source, replaceMutable);
  restoreSequences(source.meta?.sequences || {});
  return target;
}

function activePlayers(workingState) {
  const active = new Set(workingState.turnState.activePlayerIds || []);
  return (workingState.playerState.players || []).filter((player) => active.has(player.id));
}

function createCardGame(workingState, random, handCount = 5) {
  for (const player of workingState.playerState.players) {
    player.hand = [];
    player.reservedCards = [];
    player.completedTaskCount = 0;
    player.resources.handSize = 0;
  }
  workingState.cardState.publicCards = Array.from({ length: cards.PUBLIC_CARD_COUNT }, () => null);
  workingState.cardState.discardPile = [];
  workingState.cardState.drawPileCardIds = [];
  for (const player of activePlayers(workingState)) {
    cards.drawCardsToHand(workingState.cardState, workingState.playerState, player, handCount, random);
  }
  cards.ensurePublicCardsFilled(workingState.cardState, workingState.playerState, random);
  cards.preparePassReservePiles(workingState.cardState, workingState.playerState, {
    rounds: [1, 2, 3],
    activePlayerCount: workingState.turnState.activePlayerCount,
    random,
  });
}

function installOpeningDiscard(workingState) {
  const next = workingState.match.initialIncomeQueue?.[0] || null;
  const player = workingState.playerState.players.find((candidate) => candidate.id === next?.playerId) || null;
  if (!next || !player) {
    delete workingState.match.pendingDecision;
    delete workingState.match.initialIncomeQueue;
    workingState.playerState.currentPlayerId = workingState.turnState.startPlayerId;
    return false;
  }
  workingState.playerState.currentPlayerId = player.id;
  workingState.match.pendingDecision = {
    kind: "discard",
    type: "initial_income",
    playerId: player.id,
    count: 1,
    required: true,
  };
  return true;
}

function discardChoices(workingState) {
  const pending = workingState.match.pendingDecision;
  if (pending?.kind !== "discard") return [];
  const player = workingState.playerState.players.find((candidate) => candidate.id === pending.playerId);
  if (!player) return [];
  return player.hand.map((card, handIndex) => ({
    family: "choose_payment",
    target: {
      kind: "discard-hand-cards",
      choiceId: String(handIndex),
      handIndexes: [handIndex],
      cardIds: [card.cardId || card.id || null],
    },
    payload: { handIndexes: [handIndex] },
    summary: cards.getCardLabel(card),
  }));
}

function hasPendingContinuation(workingState) {
  return Object.entries(workingState.match || {}).some(([key, value]) => (
    key !== "decisionVersion" && key !== "actionLog" && Boolean(value)
  ));
}

function applyCornerReward(workingState, player, reward, source) {
  if (!reward) return;
  if (reward.gain && Object.keys(reward.gain).length) players.gainResources(player, reward.gain);
  const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
  for (let index = 0; index < dataCount; index += 1) {
    data.gainData(player, { source });
  }
}

function createSimulationRuleComposition(options = {}) {
  if (typeof options.random !== "function") throw new TypeError("Simulation Rule Composition 缺少显式 random");
  let composition;
  function createCardCornerDecisionEffect(workingRoot, pending) {
    const choices = baseRegistry.enumerate(
      { workingRoot },
      {
        family: "choose_target",
        payload: {
          decisionContext: {
            kind: "card_corner_free_move",
            pending: clone(pending),
          },
        },
      },
    );
    if (!choices.length) throw new Error("card_corner_free_move DecisionEffect 没有合法选项");
    return {
      type: standardActionDomainApi.DECISION_EFFECT_TYPE,
      kind: "decision",
      ownerId: pending.playerId,
      decisionKind: "choose_target",
      payload: {
        choices,
        decisionContext: {
          kind: "card_corner_free_move",
          pending: clone(pending),
        },
      },
    };
  }
  const turnFlow = turnFlowApi.createTurnFlowController({
    cards,
    industry,
    finalRoundNumber: 5,
    defaultActivePlayerCount: options.activePlayerCount || 4,
    computePlayerFinalScoreBreakdown(_workingRoot, player) {
      return { totalScore: Number(player?.resources?.score || 0) };
    },
  });
  const baseRegistry = actions.createStandardRegistry({
    getAuthority(workingState) {
      const root = workingState.workingRoot || workingState;
      const pending = root.match.pendingDecision;
      return {
        actorId: pending?.playerId || root.playerState.currentPlayerId || null,
        stateVersion: composition?.stateSourcePort?.getSnapshot()?.meta?.stateVersion || 0,
        decisionVersion: root.match.decisionVersion || 0,
      };
    },
  });

  const registry = {
    register: (...args) => baseRegistry.register(...args),
    enumerate: (...args) => baseRegistry.enumerate(...args),
    validate: (...args) => baseRegistry.validate(...args),
    coverage: (...args) => baseRegistry.coverage(...args),
    execute(context, action) {
      const root = context.workingRoot || context;
      const before = root.match.decisionVersion || 0;
      const result = baseRegistry.execute(context, action);
      if (result?.ok) {
        if (action.family === "land" || action.family === "orbit") {
          const player = players.getCurrentPlayer(root.playerState);
          if (player) player.mainActionCompleted = true;
        }
        if ((root.match.decisionVersion || 0) === before) root.match.decisionVersion = before + 1;
      }
      return result;
    },
  };

  registry.register({
    family: "move",
    enumerate(context) {
      const root = context.workingRoot || context;
      if (hasPendingContinuation(root)) return [];
      const playerId = root.playerState.currentPlayerId;
      const player = players.getCurrentPlayer(root.playerState);
      if (player?.mainActionCompleted) return [];
      const rocket = [...root.rocketState.rockets].reverse()
        .find((candidate) => candidate.playerId === playerId && candidate.surface === "solar-board");
      if (!rocket) return [];
      const preferredDirectionId = player?.color === "blue" ? "out" : "ccw";
      if (preferredDirectionId === "out" && Number(rocket.sectorY || 0) >= 3) return [];
      return [
        { id: "out", deltaX: 0, deltaY: 1 },
        { id: "cw", deltaX: 1, deltaY: 0 },
        { id: "ccw", deltaX: -1, deltaY: 0 },
        { id: "in", deltaX: 0, deltaY: -1 },
      ].filter((direction) => direction.id === preferredDirectionId && (
        rockets.canMoveRocket?.(root.rocketState, rocket.id, direction.deltaX, direction.deltaY)?.ok
      )).map((direction) => ({
        target: { rocketId: rocket.id, deltaX: direction.deltaX, deltaY: direction.deltaY },
        payload: { requiredMovePoints: 1 },
        summary: `移动火箭 ${rocket.id} ${direction.id}`,
      }));
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.rocketId === action.target?.rocketId)
        ? { ok: true } : { ok: false, code: "MOVE_STALE", message: "移动行动已失效" };
    },
    execute(context, action) {
      const root = context.workingRoot || context;
      root.match.pendingDecision = {
        kind: "move_payment",
        type: "move-payment", playerId: root.playerState.currentPlayerId,
        rocketId: action.target.rocketId, deltaX: action.target.deltaX, deltaY: action.target.deltaY,
        requiredMovePoints: action.payload?.requiredMovePoints || 1,
      };
      return { ok: true, progressed: true, events: [{ type: "move_payment_requested" }] };
    },
  });

  registry.register({
    family: "choose_payment",
    enumerate(context) {
      const root = context.workingRoot || context;
      const pendingMove = root.match.pendingDecision?.kind === "move_payment"
        ? root.match.pendingDecision : null;
      if (pendingMove) {
        const player = root.playerState.players.find((candidate) => candidate.id === pendingMove.playerId);
        return Number(player?.resources?.energy || 0) >= pendingMove.requiredMovePoints
          ? [{
            target: { kind: "move-payment", choiceId: "energy" },
            payload: { selectedHandIndices: [] },
            summary: `消耗 ${pendingMove.requiredMovePoints} 能量`,
          }]
          : [];
      }
      return discardChoices(root);
    },
    validate(context, action) {
      const root = context.workingRoot || context;
      const candidates = root.match.pendingDecision?.kind === "move_payment"
        ? [{ target: { choiceId: "energy" } }]
        : discardChoices(root);
      return candidates.some((choice) => choice.target.choiceId === action.target?.choiceId)
        ? { ok: true }
        : { ok: false, code: "SIMULATION_DISCARD_STALE", message: "opening 弃牌选择已失效" };
    },
    execute(context, action) {
      const workingState = context.workingRoot || context;
      const pendingMove = workingState.match.pendingDecision?.kind === "move_payment"
        ? workingState.match.pendingDecision : null;
      if (pendingMove) {
        const player = workingState.playerState.players.find((candidate) => candidate.id === pendingMove.playerId);
        const spend = players.spendResources(player, { energy: pendingMove.requiredMovePoints });
        if (!spend.ok) return spend;
        const moved = rockets.moveRocket(
          workingState.rocketState, pendingMove.rocketId, pendingMove.deltaX, pendingMove.deltaY,
        );
        if (!moved.ok) return moved;
        delete workingState.match.pendingDecision;
        return { ok: true, progressed: true, events: [{ type: "move", rocketId: pendingMove.rocketId }] };
      }
      const pending = workingState.match.pendingDecision?.kind === "discard"
        ? workingState.match.pendingDecision : null;
      const player = workingState.playerState.players.find((candidate) => candidate.id === pending?.playerId);
      if (!player) return { ok: false, code: "SIMULATION_DISCARD_OWNER_MISSING", message: "opening 弃牌 owner 不存在" };
      const indexes = (action.target?.handIndexes || [action.target?.handIndex])
        .filter(Number.isInteger)
        .sort((left, right) => right - left);
      for (const handIndex of indexes) {
        const result = cards.discardFromHandAtIndex(player, handIndex);
        if (!result?.ok) return result;
        cards.addToDiscardPile(workingState.cardState, result.card);
        const gain = cards.getIncomeGainForCard(result.card);
        if (gain) {
          players.gainIncome(player, gain, {
            blindDraw: (targetPlayer) => cards.blindDraw(
              workingState.cardState, workingState.playerState, targetPlayer, options.random,
            ),
            gainData: (targetPlayer) => data.gainData(targetPlayer, { source: "initial_income" }),
          });
        }
      }
      workingState.match.initialIncomeQueue.shift();
      delete workingState.match.pendingDecision;
      installOpeningDiscard(workingState);
      return { ok: true, progressed: true, events: [{ type: "opening_discard" }] };
    },
  });

  registry.register({
    family: "card_corner",
    enumerate(context) {
      const root = context.workingRoot || context;
      if (hasPendingContinuation(root)) return [];
      const player = players.getCurrentPlayer(root.playerState);
      return (player?.hand || []).flatMap((card, handIndex) => {
        const moveReward = cards.getDiscardActionMoveRewardForCard(card);
        const reward = cards.getDiscardActionRewardForCard(card);
        if (!reward && !moveReward) return [];
        const gain = reward?.gain || {};
        const label = gain.publicity ? `${gain.publicity}宣传`
          : gain.availableData ? `${gain.availableData}数据`
            : gain.credits ? `${gain.credits}信用点`
              : gain.energy ? `${gain.energy}能量`
                : `${moveReward?.movementPoints || 1}移动`;
        return [{
          target: { cardInstanceId: card.id },
          payload: { handIndex, actionKind: moveReward ? "move" : "resource", symbolId: null },
          summary: `弃牌换${label}`,
        }];
      });
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.cardInstanceId === action.target?.cardInstanceId)
        ? { ok: true } : { ok: false, code: "CARD_CORNER_STALE", message: "卡牌快速行动已失效" };
    },
    execute(context, action) {
      const root = context.workingRoot || context;
      const player = players.getCurrentPlayer(root.playerState);
      const index = player.hand.findIndex((card) => card.id === action.target?.cardInstanceId);
      const card = player.hand[index];
      const reward = cards.getDiscardActionRewardForCard(card);
      const moveReward = cards.getDiscardActionMoveRewardForCard(card);
      const discarded = cards.discardFromHandAtIndex(player, index);
      if (!discarded.ok) return discarded;
      cards.addToDiscardPile(root.cardState, discarded.card);
      applyCornerReward(root, player, reward, "card_corner");
      applyCornerReward(root, player, moveReward, "card_corner");
      let decisionEffect = null;
      if (moveReward) {
        const pending = {
          type: "card-corner-free-move", playerId: player.id,
          movementPoints: moveReward.movementPoints || 1,
        };
        decisionEffect = createCardCornerDecisionEffect(root, pending);
      }
      return {
        ok: true,
        progressed: true,
        decisionEffect,
        events: [{ type: "card_corner", playerId: player.id }],
      };
    },
  });

  registry.register({
    family: "industry",
    enumerate(context) {
      const root = context.workingRoot || context;
      if (hasPendingContinuation(root)) return [];
      const player = players.getCurrentPlayer(root.playerState);
      const companyLabel = player?.initialSelection?.industry?.label || null;
      return ["图灵系统", "层云核心"].includes(companyLabel) && !player.industryAbilityUsed
        ? [{ target: { companyLabel }, summary: companyLabel }]
        : [];
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.companyLabel === action.target?.companyLabel)
        ? { ok: true } : { ok: false, code: "INDUSTRY_STALE", message: "公司行动已失效" };
    },
    execute(context, action) {
      const root = context.workingRoot || context;
      const player = players.getCurrentPlayer(root.playerState);
      player.industryAbilityUsed = true;
      if (action.target?.companyLabel === "图灵系统") {
        root.match.industryAbilityContinuation = {
          type: "borrow-tech", playerId: root.playerState.currentPlayerId,
        };
      } else if (action.target?.companyLabel === "层云核心") {
        for (const card of (root.cardState.publicCards || []).slice(0, 3)) {
          const reward = cards.getDiscardActionRewardForCard(card)
            || cards.getDiscardActionMoveRewardForCard(card);
          applyCornerReward(root, player, reward, "industry_stratus");
        }
      }
      return { ok: true, progressed: true, events: [{ type: "industry" }] };
    },
  });

  registry.register({
    family: "choose_target",
    enumerate(context, { request } = {}) {
      const root = context.workingRoot || context;
      const sessionDecision = request?.payload?.decisionContext || null;
      if (sessionDecision?.kind === "card_corner_free_move") {
        const pending = sessionDecision.pending || {};
        const directions = [
          { id: "out", deltaX: 0, deltaY: 1 }, { id: "cw", deltaX: 1, deltaY: 0 },
          { id: "ccw", deltaX: -1, deltaY: 0 }, { id: "in", deltaX: 0, deltaY: -1 },
        ];
        return (root.rocketState.rockets || [])
          .filter((rocket) => rocket.playerId === pending.playerId && rocket.surface === "solar-board")
          .flatMap((rocket) => directions.filter((direction) => (
            rockets.canMoveRocket(
              root.rocketState,
              rocket.id,
              direction.deltaX,
              direction.deltaY,
            )?.ok
          )).map((direction) => ({
            target: {
              kind: "card-corner-free-move",
              choiceId: `${rocket.id}:${direction.id}`,
              rocketId: rocket.id,
              direction: direction.id,
            },
            payload: {
              rocketId: rocket.id,
              deltaX: direction.deltaX,
              deltaY: direction.deltaY,
            },
            summary: `${rockets.formatRocketLabel(rocket)} ${direction.id}`,
          })));
      }
      const pending = root.match.industryAbilityContinuation;
      if (pending?.type === "borrow-tech") {
        return ["orange1", "orange2", "orange3", "orange4", "purple1", "purple2", "purple3", "purple4"]
          .map((tileId) => ({
          target: { kind: "research-tech-tile", choiceId: tileId, tileId },
          payload: { tileId },
          summary: `研究科技 ${tileId}`,
          }));
      }
      return [];
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.choiceId === action.target?.choiceId)
        ? { ok: true } : { ok: false, code: "INDUSTRY_TECH_STALE", message: "借用科技选择已失效" };
    },
    execute(context, action) {
      const root = context.workingRoot || context;
      const player = players.getCurrentPlayer(root.playerState);
      player.industryBorrowedTechTileId = action.target.tileId;
      player.industryBorrowedTechRound = root.turnState.roundNumber;
      player.industryBorrowedTechTurn = root.turnState.turnNumber;
      delete root.match.industryAbilityContinuation;
      return { ok: true, progressed: true, events: [{ type: "industry_borrow_tech", tileId: action.target.tileId }] };
    },
  });

  registry.register({
    family: "choose_card",
    enumerate(context) {
      const root = context.workingRoot || context;
      const pending = root.match.pendingDecision;
      if (pending?.kind !== "pass_reserve") return [];
      return cards.getPassReservePile(root.cardState, pending.roundNumber).map((card) => ({
        target: { kind: "pass-reserve-card", choiceId: card.id, cardId: card.cardId || card.id || null },
        payload: { cardInstanceId: card.id },
        summary: cards.getCardLabel(card),
      }));
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.choiceId === action.target?.choiceId)
        ? { ok: true } : { ok: false, code: "PASS_RESERVE_STALE", message: "PASS 预留牌选择已失效" };
    },
    execute(context, action) {
      const root = context.workingRoot || context;
      const pending = root.match.pendingDecision?.kind === "pass_reserve"
        ? root.match.pendingDecision : null;
      const player = root.playerState.players.find((candidate) => candidate.id === pending?.playerId);
      const result = cards.pickPassReserveCard(root.cardState, player, pending.roundNumber, action.target.choiceId);
      if (!result.ok) return result;
      delete root.match.pendingDecision;
      player.passCompletionPending = true;
      return { ok: true, progressed: true, events: [{ type: "pass_reserve_pick", playerId: player.id }] };
    },
  });

  registry.register({
    family: "end_turn",
    enumerate(context) {
      const root = context.workingRoot || context;
      const player = players.getCurrentPlayer(root.playerState);
      return player?.passCompletionPending && !hasPendingContinuation(root)
        ? [{ target: { kind: "end-turn" }, summary: "结束回合" }]
        : [];
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.kind === action.target?.kind)
        ? { ok: true } : { ok: false, code: "END_TURN_STALE", message: "结束回合已失效" };
    },
    execute(context) {
      const root = context.workingRoot || context;
      const player = players.getCurrentPlayer(root.playerState);
      player.passCompletionPending = false;
      const income = player.income || players.DEFAULT_INCOME;
      players.gainResources(player, {
        credits: income.credits || 0,
        energy: income.energy || 0,
        publicity: income.publicity || 0,
        availableData: income.availableData || 0,
        additionalPublicScan: income.additionalPublicScan || 0,
      });
      for (let index = 0; index < Math.max(0, Math.round(Number(income.handSize) || 0)); index += 1) {
        cards.blindDraw(root.cardState, root.playerState, player, options.random);
      }
      const companyLabel = player.initialSelection?.industry?.label || null;
      if (companyLabel === "图灵系统") players.gainResources(player, { publicity: 2 });
      if (companyLabel === "层云核心") players.gainResources(player, { publicity: 1 });
      const transition = turnFlow.advanceTurnAfterPlayerAction(root, player.id, { passed: true });
      const nextPlayer = root.playerState.players
        .find((candidate) => candidate.id === transition.nextPlayerId);
      if (nextPlayer) {
        nextPlayer.mainActionCompleted = false;
      }
      return {
        ok: true,
        progressed: true,
        events: [{
          type: "end_turn",
          playerId: player.id,
          roundAdvanced: Boolean(transition.roundAdvanced),
          gameEnded: Boolean(transition.gameEnded),
        }],
      };
    },
  });

  registry.register({
    family: "pass",
    enumerate(context) {
      const workingState = context.workingRoot || context;
      const playerId = workingState.playerState.currentPlayerId;
      return hasPendingContinuation(workingState)
        || workingState.turnState.passedPlayerIds.includes(playerId)
        ? [] : [{ target: { kind: "pass" }, summary: "PASS" }];
    },
    validate() { return { ok: true }; },
    execute(context) {
      const workingState = context.workingRoot || context;
      const playerId = workingState.playerState.currentPlayerId;
      if (!(workingState.turnState.passedPlayerIds || []).length) {
        const beforeRotation = clone(workingState.solarState.rotation);
        workingState.solarState.rotation = solar.applySolarOrbitRotation(workingState.solarState.rotation, 1);
        workingState.solarState.wheelSteps = solar.rotationToWheelSteps(workingState.solarState.rotation);
        rocketAbility.settleRocketsAfterSolarRotation(
          workingState,
          beforeRotation,
          workingState.solarState.rotation,
        );
      }
      if (!workingState.turnState.passedPlayerIds.includes(playerId)) workingState.turnState.passedPlayerIds.push(playerId);
      const reserve = cards.getPassReservePile(workingState.cardState, workingState.turnState.roundNumber);
      if (reserve.length) {
        workingState.match.pendingDecision = {
          kind: "pass_reserve",
          type: "pass-reserve-pick", playerId, roundNumber: workingState.turnState.roundNumber,
        };
      } else {
        const player = workingState.playerState.players.find((candidate) => candidate.id === playerId);
        if (player) player.passCompletionPending = true;
      }
      return { ok: true, progressed: true, events: [{ type: "pass", playerId }] };
    },
  });

  for (const contract of SIMULATION_FAMILY_CONTRACTS) {
    if (!contract.unavailableReason) continue;
    registry.register({
      family: contract.family,
      enumerate() { return []; },
      validate() {
        return {
          ok: false,
          code: "SIMULATION_ACTION_FAMILY_UNAVAILABLE",
          message: contract.unavailableReason,
        };
      },
      execute() {
        return {
          ok: false,
          code: "SIMULATION_ACTION_FAMILY_UNAVAILABLE",
          message: contract.unavailableReason,
        };
      },
    });
  }

  const stateAdapter = {
    createWorkingState: (initialOptions) => createWorkingState(initialOptions, options.random),
    createProjectionState: (workingState, committedState) => createCommittedState(
      workingState,
      committedState.meta.stateVersion,
    ),
    createCommittedState: (workingState, committedState, overrides) => createCommittedState(
      workingState,
      committedState.meta.stateVersion,
      overrides,
    ),
    createSavedState: (committedState, workingState, overrides) => createCommittedState(
      workingState,
      committedState.meta.stateVersion,
      overrides,
    ),
    restoreWorkingState,
    onCommitted(workingState, committedState) { workingState.meta = clone(committedState.meta); },
  };

  function createActionContext(workingRoot) {
    return {
      workingRoot,
      solarState: workingRoot.solarState,
      playerState: workingRoot.playerState,
      rocketState: workingRoot.rocketState,
      planetStatsState: workingRoot.planetStatsState,
      nebulaDataState: workingRoot.nebulaDataState,
      cardState: workingRoot.cardState,
      techGameState: workingRoot.techGameState,
      techBoardState: workingRoot.techGameState.board,
      alienGameState: workingRoot.alienGameState,
      finalScoringState: workingRoot.finalScoringState,
      turnState: workingRoot.turnState,
      match: workingRoot.match,
      stateVersion: composition?.stateSourcePort?.getSnapshot()?.meta?.stateVersion || 0,
      decisionVersion: workingRoot.match.decisionVersion || 0,
      getEarthSectorCoordinate: () => getEarthCoordinate(workingRoot),
      getPlanetLocations: () => solar.createSolarSnapshot(workingRoot.solarState).planetLocations,
      rotateSolarOrbit(count = 1) {
        const beforeRotation = clone(workingRoot.solarState.rotation);
        workingRoot.solarState.rotation = solar.applySolarOrbitRotation(
          workingRoot.solarState.rotation,
          count,
        );
        workingRoot.solarState.wheelSteps = solar.rotationToWheelSteps(workingRoot.solarState.rotation);
        const settlement = rocketAbility.settleRocketsAfterSolarRotation(
          workingRoot,
          beforeRotation,
          workingRoot.solarState.rotation,
        );
        return {
          ok: settlement?.ok !== false,
          message: settlement?.message || "太阳系旋转",
          events: settlement?.events || [],
        };
      },
    };
  }

  composition = createRuleComposition({
    stateStoreApi: {
      createStateStore(initialState, storeOptions) {
        return highCouplingStateApi.createHighCouplingStateStore(initialState, storeOptions);
      },
    },
    effectRuntimeApi,
    createActionRegistry: () => registry,
    createActionContext,
    createInitialState(_initialOptions, workingState) { return createCommittedState(workingState, 0); },
    stateAdapter,
    runWithWorkingState(context, operation) {
      const workingState = context.workingRoot || context;
      restoreSequences(workingState.meta?.sequences || {});
      try {
        return operation();
      } finally {
        workingState.meta.sequences = readSequences(workingState);
      }
    },
    effectDomains: [{
      families: standardActionApi.ALL_FAMILIES,
      create(domainOptions) {
        return standardActionDomainApi.createStandardActionDomain({
          ...domainOptions,
          actionFamilies: standardActionApi.ALL_FAMILIES,
          continuation: {
            inspect(workingState) {
              workingState = workingState.workingRoot || workingState;
              const choices = composition.inputPort.enumerateActions({})
                .filter((candidate) => candidate.phase === "conditional");
              if (choices.length) {
                return {
                  ok: true,
                  boundary: "conditional_choice",
                  decisionType: "conditional_choice",
                  ownerId: workingState.match.pendingDecision?.playerId || null,
                  family: choices[0].family,
                  choices,
                };
              }
              return {
                ok: true,
                boundary: workingState.turnState.gameEnded ? "terminal" : "turn_action",
                decisionType: "turn_action",
                ownerId: workingState.playerState.currentPlayerId,
                choices: [],
              };
            },
            executeDeterministic() {
              return { ok: false, code: "SIMULATION_RULE_STALLED", message: "Rule Composition 没有可执行的确定性 Effect" };
            },
            resolveDecision(_workingState, choice, resolutionContext = {}) {
              _workingState = _workingState.workingRoot || _workingState;
              if (resolutionContext.decisionContext?.kind === "card_corner_free_move") {
                const moved = rockets.moveRocket(
                  _workingState.rocketState,
                  choice.target?.rocketId,
                  choice.payload?.deltaX,
                  choice.payload?.deltaY,
                );
                if (!moved.ok) return moved;
                return {
                  ok: true,
                  progressed: true,
                  events: [{ type: "card_corner_move", rocketId: choice.target?.rocketId }],
                };
              }
              const descriptor = choice?.standardAction || choice;
              return registry.execute(_workingState, descriptor);
            },
          },
        });
      },
    }],
    projectState(state) { return clone(state); },
    initialOptions: {
      activePlayerCount: options.activePlayerCount || 4,
      seed: options.seed,
      rngState: options.rngState,
      initialize: false,
    },
  });

  function newGame(config = {}) {
    return composition.lifecycle.newGame({
      activePlayerCount: config.activePlayerCount || 4,
      seed: config.seed,
      rngState: config.rngState,
      aiDifficulty: config.aiDifficulty,
      initialize: true,
    });
  }

  const actionContract = Object.freeze({
    coverage() {
      const registrations = new Map(registry.coverage().map((entry) => [entry.family, entry]));
      return SIMULATION_FAMILY_CONTRACTS.map((contract) => Object.freeze({
        ...registrations.get(contract.family),
        obligation: contract.obligation,
        status: contract.unavailableReason ? "unavailable" : "supported",
        unavailableReason: contract.unavailableReason || null,
      }));
    },
  });

  return Object.freeze({ composition, newGame, actionContract });
}

module.exports = { createSimulationRuleComposition };
