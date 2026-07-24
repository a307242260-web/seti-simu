"use strict";

const stateStoreApi = require("../game/state/state-store");
const highCouplingStateApi = require("../game/state/high-coupling-slices");
const effectRuntimeApi = require("../game/effects/session-runtime");
const standardActionApi = require("../game/actions/standard-action");
const actions = require("../game/actions");
const initialGameStateApi = require("../game/state/initial-game-state");
const players = require("../game/players");
const solar = require("../solar-system/core");
const rockets = require("../game/rockets");
const planetStats = require("../game/planet-stats");
const planetRewards = require("../game/actions/planet-rewards");
const data = require("../game/data");
const cards = require("../game/cards/deck");
const cardEffects = require("../game/cards/effects");
const quickTrades = require("../game/actions/quick-trades");
const tech = require("../game/tech");
const industry = require("../game/industry");
const aliens = require("../game/aliens");
const finalScoring = require("../game/final-scoring");
const actionHistory = require("../game/history/action-history");
const initialCards = require("../game/initial-cards");
const ai = require("../game/ai");
const { createHeuristicPolicyAdapter } = require("./heuristic-policy-adapter");
const planetReferenceLayout = require("../game/planet-reference-layout");
const rocketAbility = require("../game/abilities/rocket");
const planetAbility = require("../game/abilities/planet");
const { createRuleComposition } = require("../game/rule-composition");
const productionCompositionApi = require("../game/production-composition");
const turnFlowApi = require("../game/turn-flow");

const RULESET_VERSION = "seti-runtime-v1";
const DEFAULT_FINAL_SCORE_IDS = Object.freeze(["a", "b", "c", "d"]);
const INDUSTRY_CARD_FILES = Object.freeze([
  "层云核心.png", "芬威克研究中心.png", "赫利昂联合体.png", "寰宇动力.png",
  "任务中继站.png", "哨兵探测网络.png", "深空探测.png", "图灵系统.png",
  "未来跨度研究所.png", "异星实验室.png", "宇宙战略集团.png",
]);

function hashCounterfactualSeed(seed) {
  const text = String(seed ?? "seti-counterfactual");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createCounterfactualRandomFromState(initialState) {
  let state = Number(initialState) >>> 0 || 1;
  const random = function counterfactualRandom() {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  random.resetSeed = (nextSeed) => {
    state = hashCounterfactualSeed(nextSeed) || 1;
  };
  random.getState = () => state >>> 0;
  return random;
}

function createCounterfactualRandom(seed) {
  return createCounterfactualRandomFromState(hashCounterfactualSeed(seed));
}
const SIMULATION_FAMILY_CONTRACTS = Object.freeze([
  { family: "launch", obligation: "生产发射规则枚举、校验并提交火箭" },
  { family: "orbit", obligation: "生产环绕规则枚举目标并提交轨道占位" },
  { family: "land", obligation: "生产登陆规则枚举目标并提交星球占位" },
  {
    family: "scan",
    obligation: "扫描必须由生产望远镜规则提供合法描述符",
  },
  {
    family: "analyze",
    obligation: "分析必须由生产数据轨规则提供合法描述符",
  },
  { family: "research_tech", obligation: "生产科技规则枚举科技板目标并提交研究" },
  { family: "play_card", obligation: "打牌使用生产手牌、费用、卡牌实体与 Effect journal" },
  { family: "pass", obligation: "生产回合规则提交 PASS 并建立预留牌 continuation" },
  { family: "move", obligation: "生产火箭规则枚举移动并建立支付 continuation" },
  { family: "quick_trade", obligation: "快速交易复用生产资源交易规则并提交真实资源变更" },
  { family: "industry", obligation: "生产公司能力规则枚举并提交公司行动" },
  { family: "card_corner", obligation: "生产卡角规则枚举手牌并提交弃牌收益" },
  {
    family: "place_data",
    obligation: "放置数据必须由生产数据规则提供合法描述符",
  },
  {
    family: "runezu_face_symbol",
    obligation: "符号面行动必须由生产外星种族规则提供合法描述符",
  },
  { family: "end_turn", obligation: "生产回合规则结算收入并切换 owner" },
  { family: "choose_card", obligation: "生产 continuation 枚举并提交预留牌选择" },
  { family: "choose_target", obligation: "生产 continuation 枚举并提交移动或科技目标" },
  { family: "choose_payment", obligation: "生产 continuation 枚举并提交弃牌或移动支付" },
  { family: "choose_reward", obligation: "生产效果 continuation 枚举并提交奖励选择" },
  {
    family: "choose_branch",
    obligation: "分支选择必须由生产效果 continuation 提供合法描述符",
  },
  {
    family: "choose_final_scoring",
    obligation: "终局计分选择必须由生产终局规则提供合法描述符",
  },
  {
    family: "accept_optional_effect",
    obligation: "可选效果必须由生产效果 continuation 提供合法描述符",
  },
]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function stableSerialize(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(",")}}`;
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
    actionLog: 1, finalMark: 1, handCard: 1,
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
    sequences: { card: 1, dataToken: 1 },
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

function createInitialSelectionInputPort() {
  let activeDecision = null;
  const registry = standardActionApi.createRegistry({
    getAuthority() {
      return activeDecision && {
        actorId: activeDecision.player.id,
        stateVersion: activeDecision.stateVersion,
        decisionVersion: activeDecision.decisionVersion,
      };
    },
  });

  registry.register({
    family: "choose_branch",
    enumerate() {
      if (!activeDecision) return [];
      return activeDecision.plans.map((plan, planIndex) => {
        const choiceId = `${plan.industry?.id || planIndex}:${plan.initialCards.map((card) => card.id).join("+")}`;
        return {
          target: {
            choiceId,
            industryId: plan.industry?.id || null,
            initialIds: plan.initialCards.map((card) => card.id),
          },
          payload: {},
          summary: `${plan.industry?.label || plan.industry?.id || "公司"} + 初始牌`,
        };
      });
    },
    validate() {
      return activeDecision
        ? { ok: true }
        : { ok: false, code: "INITIAL_SELECTION_DECISION_INACTIVE", message: "初始选择 Decision 已失效" };
    },
    execute(_context, action) {
      const plan = activeDecision?.plansByChoiceId.get(action.target?.choiceId);
      if (!plan) {
        return {
          ok: false,
          code: "INITIAL_SELECTION_CHOICE_NOT_LEGAL",
          message: "初始选择不在当前 legal set",
        };
      }
      activeDecision.player.initialSelection = {
        industry: clone(plan.industry),
        removedInitialCards: clone(plan.initialCards),
      };
      activeDecision.player.aiDifficulty = activeDecision.aiDifficulty;
      activeDecision = null;
      return { ok: true, progressed: true, events: [{ type: "initial_selection_submitted" }] };
    },
  });

  return Object.freeze({
    open(player, plans, decisionVersion, aiDifficulty) {
      if (activeDecision) throw new Error("上一个初始选择 Decision 尚未提交");
      const decisionId = `initial-selection:${player.id}`;
      activeDecision = {
        decisionId,
        stateVersion: 0,
        decisionVersion,
        player,
        plans,
        plansByChoiceId: new Map(plans.map((plan, planIndex) => [
          `${plan.industry?.id || planIndex}:${plan.initialCards.map((card) => card.id).join("+")}`,
          plan,
        ])),
        aiDifficulty,
      };
      const choices = registry.enumerate({});
      if (!choices.length) {
        activeDecision = null;
        throw new Error(`席位 ${player.id} 没有合法初始选择`);
      }
      return Object.freeze({
        decisionId,
        decisionVersion,
        stateVersion: 0,
        ownerId: player.id,
        choices,
      });
    },
    submitDecision(input = {}) {
      if (!activeDecision) {
        return { ok: false, code: "INITIAL_SELECTION_DECISION_INACTIVE", message: "初始选择 Decision 已失效" };
      }
      if (input.decisionId !== activeDecision.decisionId
        || input.decisionVersion !== activeDecision.decisionVersion) {
        return { ok: false, code: "INITIAL_SELECTION_DECISION_STALE", message: "初始选择 Decision 版本已失效" };
      }
      if (input.ownerId !== activeDecision.player.id) {
        return { ok: false, code: "INITIAL_SELECTION_DECISION_OWNER_MISMATCH", message: "初始选择 Decision owner 不匹配" };
      }
      return registry.execute({}, input.choice);
    },
  });
}

function getInitialPairs(cardsToChoose = [], count = 2) {
  if (count <= 0) return [[]];
  if (count === 1) return cardsToChoose.map((card) => [card]);
  const pairs = [];
  for (let left = 0; left < cardsToChoose.length; left += 1) {
    for (let right = left + 1; right < cardsToChoose.length; right += 1) {
      pairs.push([cardsToChoose[left], cardsToChoose[right]]);
    }
  }
  return pairs;
}

function submitOpeningPlans(workingState, offers, selectedPlans, aiDifficulty) {
  const inputPort = createInitialSelectionInputPort();
  for (const [index, offer] of offers.entries()) {
    const player = workingState.playerState.players
      .find((candidate) => candidate.id === offer.playerId);
    const decision = inputPort.open(player, offer.plans, index + 1, aiDifficulty);
    const selected = selectedPlans[index];
    const choice = decision.choices.find((candidate) => (
      candidate.target?.industryId === selected.industry?.id
      && stableSerialize(candidate.target?.initialIds || [])
        === stableSerialize(selected.initialCards.map((card) => card.id))
    ));
    const submitted = inputPort.submitDecision({
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      ownerId: decision.ownerId,
      choice,
    });
    if (!submitted?.ok) throw new Error(submitted?.message || "初始选择提交失败");
  }
}

function resolveOpeningRules(workingState, random) {
  const selectionResult = initialCards.resolveInitialSelections({
    playerState: workingState.playerState,
    cardState: workingState.cardState,
    rocketState: workingState.rocketState,
    nebulaDataState: workingState.nebulaDataState,
    planetStatsState: workingState.planetStatsState,
    alienGameState: workingState.alienGameState,
    techGameState: workingState.techGameState,
    blindDrawCard(player) {
      return cards.blindDraw(
        workingState.cardState,
        workingState.playerState,
        player,
        random,
        {
          createCardInstance: (entry, sequence) => (
            cards.createCommittedCardInstance(workingState, entry, sequence)
          ),
        },
      );
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
  return selectionResult;
}

function createOpeningObservation(workingState, playerId) {
  const player = workingState.playerState.players.find((candidate) => candidate.id === playerId);
  const publicPlayers = workingState.playerState.players.map((candidate) => ({
    id: candidate.id,
    playerId: candidate.id,
    resources: clone(candidate.resources || {}),
    handCount: (candidate.hand || []).length,
    techState: clone(candidate.techState || {}),
  }));
  return ai.outcomeModel.createDecisionObservation({
    publicState: {
      match: { terminal: false },
      players: publicPlayers,
      board: {
        rockets: clone(workingState.rocketState.rockets || []),
        aliens: clone(workingState.alienGameState || {}),
      },
    },
    selfState: {
      playerId,
      player: { id: playerId, resources: clone(player?.resources || {}) },
      hand: clone(player?.hand || []),
      reservedCards: clone(player?.reservedCards || []),
    },
    probeRouteRequirements: buildProbeRouteRequirements(workingState, playerId),
    terminal: false,
  }, { seatId: playerId, stateVersion: 0, decisionVersion: 0 });
}

function chooseInitialSelections(workingState, options, random) {
  const playerIds = workingState.turnState.activePlayerIds;
  const industryDeck = shuffle(INDUSTRY_CARD_FILES, random).slice(0, playerIds.length * 2);
  const initialDeck = shuffle(Array.from({ length: initialCards.INITIAL_CARD_COUNT }, (_item, index) => index + 1), random);
  const aiDifficulty = options.aiDifficulty || "laughable";
  const offers = playerIds.map((playerId, index) => {
    const industryOptions = industryDeck.slice(index * 2, index * 2 + 2)
      .map((fileName) => createSelectionCard("industry", fileName));
    const initialOptions = initialDeck.slice(index * 3, index * 3 + 3)
      .map((number) => createSelectionCard("initial", number));
    const plans = industryOptions.flatMap((industryCard) => (
      getInitialPairs(initialOptions, 2).map((initialSelection) => ({
        industry: industryCard,
        initialCards: initialSelection,
      }))
    ));
    return { playerId, plans };
  });
  const selectedPlans = offers.map((offer) => offer.plans[0]);
  const rootSequences = readSequences(workingState);
  const rootRandomState = random.getState?.() ?? null;
  for (const [playerIndex, offer] of offers.entries()) {
    const evaluated = offer.plans.map((candidate, planIndex) => {
      const fork = clone(workingState);
      const forkPlans = selectedPlans.map((selected, index) => (
        index === playerIndex ? candidate : selected
      ));
      restoreSequences(rootSequences);
      submitOpeningPlans(fork, offers, forkPlans, aiDifficulty);
      resolveOpeningRules(
        fork,
        rootRandomState == null
          ? createCounterfactualRandom(`${options.seed}:setup:${offer.playerId}`)
          : createCounterfactualRandomFromState(rootRandomState),
      );
      const observation = createOpeningObservation(fork, offer.playerId);
      const evaluation = ai.expectedScoreEvaluator.evaluateSetupProbeGoals(
        observation,
        offer.playerId,
      );
      return { candidate, evaluation, planIndex };
    }).sort((left, right) => (
      ai.expectedScoreEvaluator.compareSetupProbeGoals(left.evaluation, right.evaluation)
      || left.planIndex - right.planIndex
    ));
    selectedPlans[playerIndex] = evaluated[0].candidate;
  }
  restoreSequences(rootSequences);
  submitOpeningPlans(workingState, offers, selectedPlans, aiDifficulty);
}

function initializeProductionGame(workingState, options, random) {
  randomizeBoard(workingState, random);
  createCardGame(workingState, random, 4);
  chooseInitialSelections(workingState, options, random);
  resolveOpeningRules(workingState, random);
  workingState.match.decisionVersion = 1;
  installOpeningDiscard(workingState);
  workingState.meta.sequences = readSequences(workingState);
}

function readSequences(workingState) {
  const nebulaSequences = data.getDeterministicSequences?.() || {};
  return {
    actionLog: (workingState.match.actionLog || []).length + 1,
    card: workingState.meta?.sequences?.card ?? cards.getNextCardInstanceSequence(),
    dataToken: workingState.meta?.sequences?.dataToken ?? data.getNextDataTokenSequence(),
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

function rewardScore(effects) {
  return (effects || []).reduce((total, effect) => (
    total + Number(effect?.options?.gain?.score || 0)
  ), 0);
}

function routeRequirementKey(sourceId, choice) {
  return [
    sourceId,
    choice.actionType,
    choice.planetId,
    choice.target?.type || "planet",
    choice.target?.satelliteId || "",
  ].join(":");
}

function productionProbeDirections(player, coordinate) {
  const preferredDirectionId = player?.color === "blue" ? "out" : "ccw";
  if (preferredDirectionId === "out" && Number(coordinate?.y || 0) >= 3) return [];
  return rocketAbility.MOVE_DIRECTIONS.filter((direction) => direction.id === preferredDirectionId);
}

function buildProbeRouteRequirements(workingState, requestedPlayerId = null) {
  const player = requestedPlayerId == null
    ? players.getCurrentPlayer(workingState.playerState)
    : workingState.playerState.players.find((candidate) => candidate.id === requestedPlayerId);
  if (!player || workingState.turnState.gameEnded) return null;
  const context = {
    workingRoot: workingState,
    solarState: workingState.solarState,
    playerState: workingState.playerState,
    rocketState: workingState.rocketState,
    planetStatsState: workingState.planetStatsState,
    alienGameState: workingState.alienGameState,
    turnState: workingState.turnState,
    getPlanetLocations: () => solar.createSolarSnapshot(workingState.solarState).planetLocations,
  };
  const earth = getEarthCoordinate(workingState);
  const activeRockets = rockets.getRocketsForPlayer(workingState.rocketState, player.id)
    .filter((rocket) => rocket.surface === "solar-board");
  const sources = activeRockets.map((rocket) => ({
    sourceId: `rocket:${rocket.id}`,
    rocketId: rocket.id,
    launchRequired: false,
    coordinate: rockets.getRocketSectorCoordinate(rocket),
  }));
  const activeCount = rocketAbility.getActiveRocketCountForPlayer
    ? rocketAbility.getActiveRocketCountForPlayer(workingState.rocketState, player.id)
    : activeRockets.length;
  const launchSlotAvailable = rockets.findAvailableSlotIndex(
    workingState.rocketState,
    earth.x,
    earth.y,
  ) !== null;
  if (activeCount < rocketAbility.getRocketLimitForPlayer(player, context) && launchSlotAvailable) {
    sources.push({
      sourceId: "launch",
      rocketId: null,
      launchRequired: true,
      coordinate: earth,
    });
  }

  const candidates = [];
  for (const source of sources) {
    if (!source.coordinate) continue;
    const queue = [{
      coordinate: source.coordinate,
      path: [],
      movePoints: 0,
      publicityStops: 0,
    }];
    const visited = new Set([`${source.coordinate.x},${source.coordinate.y}`]);
    while (queue.length) {
      const route = queue.shift();
      const visible = solar.resolveVisibleContent(
        route.coordinate.x,
        route.coordinate.y,
        workingState.solarState,
      )?.content;
      if (visible?.kind === solar.layout.CONTENT_KIND.PLANET && visible.planetId !== "earth") {
        const planet = solar.layout.PLANETS[visible.planetId] || {};
        const placement = {
          rocket: { id: source.rocketId, playerId: player.id, surface: "solar-board" },
          currentPlayer: player,
          planet: {
            planetId: visible.planetId,
            name: planet.name || visible.label,
            label: visible.label,
            x: route.coordinate.x,
            y: route.coordinate.y,
          },
          sectorCoordinate: route.coordinate,
        };
        const endpointChoices = [
          ...planetAbility.listOrbitRequirementsAt(context, placement),
          ...planetAbility.listLandRequirementsAt(context, placement),
        ];
        for (const choice of endpointChoices) {
          const effects = choice.actionType === "orbit"
            ? planetRewards.buildOrbitRewardEffects(choice.planetId, choice.markerSequence)
            : choice.target?.type === "satellite"
              ? planetRewards.buildSatelliteLandRewardEffects(choice.target.satelliteId)
              : planetRewards.buildPlanetLandRewardEffects(
                choice.planetId,
                choice.rewardMarkerSequence ?? choice.markerSequence,
              );
          const scoreGain = rewardScore(effects);
          if (scoreGain <= 0) continue;
          const launchCost = source.launchRequired
            ? rocketAbility.getLaunchCost(context, player)
            : {};
          const endpointCost = choice.cost || {};
          const totalCost = {
            credits: Number(launchCost.credits || 0) + Number(endpointCost.credits || 0),
            energy: route.movePoints + Number(endpointCost.energy || 0),
          };
          const firstMove = route.path[0] || null;
          const targetId = [
            choice.actionType,
            choice.planetId,
            choice.target?.type || "planet",
            choice.target?.satelliteId || "",
          ].join(":");
          candidates.push({
            requirementId: routeRequirementKey(source.sourceId, choice),
            targetId,
            playerId: player.id,
            sourceId: source.sourceId,
            rocketId: source.rocketId,
            planetId: choice.planetId,
            endpointFamily: choice.actionType,
            endpointTarget: clone(choice.target || { type: "planet" }),
            targetBenefit: {
              score: scoreGain,
              rewardSummary: choice.rewardSummary,
              source: `planetRewards.${choice.actionType}:${choice.planetId}`,
            },
            required: {
              credits: totalCost.credits,
              energy: totalCost.energy,
              movementSteps: route.path.length,
              movementPoints: route.movePoints,
            },
            gap: {
              credits: Math.max(0, totalCost.credits - Number(player.resources?.credits || 0)),
              energy: Math.max(0, totalCost.energy - Number(player.resources?.energy || 0)),
              movementSteps: route.path.length,
            },
            nextStep: source.launchRequired
              ? { family: "launch" }
              : firstMove
                ? { family: "move", rocketId: source.rocketId, ...firstMove }
                : { family: choice.actionType, rocketId: source.rocketId, target: clone(choice.target || {}) },
            path: route.path.map((step) => ({ ...step })),
            publicityStops: route.publicityStops,
            fieldSources: {
              topology: "SetiRocketActions.canMoveFromCoordinate",
              movementCost: "SetiAbilityRocket.getRequiredMovePointsFromCoordinate",
              launchCost: "SetiAbilityRocket.getLaunchCost",
              endpointCost: choice.actionType === "land"
                ? "SetiAbilityPlanet.getLandEnergyCost"
                : "SetiAbilityPlanet.DEFAULT_ORBIT_COST",
              rewards: "SetiPlanetRewards",
            },
          });
        }
      }
      for (const direction of productionProbeDirections(player, route.coordinate)) {
        const move = rockets.canMoveFromCoordinate(
          workingState.rocketState,
          route.coordinate,
          direction.deltaX,
          direction.deltaY,
          source.rocketId,
        );
        if (!move.ok) continue;
        const key = `${move.to.x},${move.to.y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const destination = solar.resolveVisibleContent(
          move.to.x,
          move.to.y,
          workingState.solarState,
        )?.content;
        queue.push({
          coordinate: move.to,
          path: [...route.path, {
            directionId: direction.id,
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
          }],
          movePoints: route.movePoints + rocketAbility.getRequiredMovePointsFromCoordinate(
            context,
            player,
            route.coordinate,
          ),
          publicityStops: route.publicityStops + (
            destination?.kind === solar.layout.CONTENT_KIND.PLANET
            && destination.planetId !== "earth" ? 1 : 0
          ),
        });
      }
    }
  }
  const ranked = candidates.sort((left, right) => (
    right.targetBenefit.score - left.targetBenefit.score
    || left.required.credits + left.required.energy - right.required.credits - right.required.energy
    || left.required.movementSteps - right.required.movementSteps
    || String(left.requirementId).localeCompare(String(right.requirementId))
  )).slice(0, 12);
  return {
    schemaVersion: "seti-probe-route-requirements-v1",
    playerId: player.id,
    candidates: ranked,
  };
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
  const factoryOptions = {
    createCardInstance: (entry, sequence) => (
      cards.createCommittedCardInstance(workingState, entry, sequence)
    ),
  };
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
    cards.drawCardsToHand(
      workingState.cardState,
      workingState.playerState,
      player,
      handCount,
      random,
      factoryOptions,
    );
  }
  cards.ensurePublicCardsFilled(
    workingState.cardState,
    workingState.playerState,
    random,
    factoryOptions,
  );
  cards.preparePassReservePiles(workingState.cardState, workingState.playerState, {
    rounds: [1, 2, 3],
    activePlayerCount: workingState.turnState.activePlayerCount,
    random,
    ...factoryOptions,
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
  const count = Math.max(1, Math.round(Number(pending.count) || 1));
  function combinations(startIndex, selected) {
    if (selected.length === count) return [selected];
    const result = [];
    for (let index = startIndex; index < player.hand.length; index += 1) {
      result.push(...combinations(index + 1, [...selected, index]));
    }
    return result;
  }
  return combinations(0, []).map((handIndexes) => ({
    family: "choose_payment",
    target: {
      kind: "discard-hand-cards",
      choiceId: handIndexes.join("+"),
      handIndexes,
      cardIds: handIndexes.map((handIndex) => (
        player.hand[handIndex]?.cardId || player.hand[handIndex]?.id || null
      )),
    },
    payload: { handIndexes },
    summary: handIndexes.map((handIndex) => cards.getCardLabel(player.hand[handIndex])).join(" + "),
  }));
}

function hasPendingContinuation(workingState) {
  return Object.entries(workingState.match || {}).some(([key, value]) => (
    key !== "decisionVersion" && key !== "actionLog" && Boolean(value)
  ));
}

function openTradeDiscard(workingState, count, input = {}) {
  if (hasPendingContinuation(workingState)) {
    return { ok: false, code: "QUICK_TRADE_PENDING", message: "请先完成当前选择" };
  }
  workingState.match.pendingDecision = {
    kind: "discard",
    type: "trade",
    playerId: input.player?.id || workingState.playerState.currentPlayerId,
    tradeId: input.tradeId,
    count,
    required: true,
  };
  return { ok: true, message: `请选择 ${count} 张手牌` };
}

function openTradeCardSelection(workingState, input = {}) {
  if (hasPendingContinuation(workingState)) {
    return { ok: false, code: "QUICK_TRADE_PENDING", message: "请先完成当前选择" };
  }
  workingState.match.pendingDecision = {
    kind: "card_selection",
    type: "trade",
    playerId: input.player?.id || workingState.playerState.currentPlayerId,
    tradeId: input.tradeId,
    allowBlindDraw: Boolean(input.allowBlindDraw),
  };
  return { ok: true, message: "请选择一张公共牌" };
}

function createQuickTradeContext(workingState, random) {
  return {
    workingRoot: workingState,
    playerState: workingState.playerState,
    cardState: workingState.cardState,
    rocketState: workingState.rocketState,
    beginDiscardSelection: (count, input) => openTradeDiscard(workingState, count, input),
    beginCardSelection: (input) => openTradeCardSelection(workingState, input),
    random,
  };
}

function listCardSelectionChoices(workingState, pending) {
  if (pending?.kind !== "card_selection") return [];
  const publicChoices = (workingState.cardState.publicCards || []).flatMap((card, slotIndex) => (
    card ? [{
      target: {
        kind: "trade-card-selection",
        choiceId: `public:${slotIndex}:${card.id}`,
        source: "public",
        slotIndex,
        cardInstanceId: card.id,
      },
      payload: { slotIndex },
      summary: cards.getCardLabel(card),
    }] : []
  ));
  return pending.allowBlindDraw
    ? [...publicChoices, {
      target: {
        kind: "trade-card-selection",
        choiceId: "blind",
        source: "blind",
      },
      payload: {},
      summary: "盲抽 1 张牌",
    }]
    : publicChoices;
}

function createSimulationRuleComposition(options = {}) {
  if (typeof options.random !== "function") throw new TypeError("Simulation Rule Composition 缺少显式 random");
  let composition;
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
    enumerate(context, request) {
      const root = context?.workingRoot || context;
      const listed = baseRegistry.enumerate(context, request);
      const playerId = root?.playerState?.currentPlayerId || null;
      const passed = (root?.turnState?.passedPlayerIds || []).includes(playerId);
      const passCompletionPending = root?.playerState?.players
        ?.find((player) => player.id === playerId)?.passCompletionPending === true;
      if (!passed && !passCompletionPending) return listed;
      return listed.filter((action) => (
        action.phase === "conditional" || action.family === "end_turn"
      ));
    },
    validate: (...args) => baseRegistry.validate(...args),
    coverage: (...args) => baseRegistry.coverage(...args),
    execute(context, action) {
      const root = context.workingRoot || context;
      const before = root.match.decisionVersion || 0;
      const result = baseRegistry.execute(context, action);
      if (result?.ok && (root.match.decisionVersion || 0) === before) {
        root.match.decisionVersion = before + 1;
      }
      return result;
    },
  };

  registry.register({
    family: "choose_payment",
    enumerate(context) {
      const root = context.workingRoot || context;
      return discardChoices(root);
    },
    validate(context, action) {
      const root = context.workingRoot || context;
      return discardChoices(root).some((choice) => choice.target.choiceId === action.target?.choiceId)
        ? { ok: true }
        : { ok: false, code: "SIMULATION_DISCARD_STALE", message: "opening 弃牌选择已失效" };
    },
    execute(context, action) {
      const workingState = context.workingRoot || context;
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
              {
                createCardInstance: (entry, sequence) => (
                  cards.createCommittedCardInstance(workingState, entry, sequence)
                ),
              },
            ),
            gainData: (targetPlayer) => data.gainData(
              targetPlayer,
              { source: "initial_income", root: workingState },
            ),
          });
        }
      }
      if (pending.type === "trade") {
        delete workingState.match.pendingDecision;
        const traded = quickTrades.finalizeTradeAfterDiscard(
          pending.tradeId,
          createQuickTradeContext(workingState, options.random),
          player,
        );
        if (!traded.ok) return traded;
        return {
          ok: true,
          progressed: true,
          events: [{
            type: "quick_trade_payment",
            tradeId: pending.tradeId,
            playerId: player.id,
          }],
        };
      }
      workingState.match.initialIncomeQueue.shift();
      delete workingState.match.pendingDecision;
      installOpeningDiscard(workingState);
      return { ok: true, progressed: true, events: [{ type: "opening_discard" }] };
    },
  });

  registry.register({
    family: "choose_card",
    enumerate(context) {
      const root = context.workingRoot || context;
      const pending = root.match.pendingDecision;
      if (pending?.kind === "card_selection") return listCardSelectionChoices(root, pending);
      return [];
    },
    validate(context, action) {
      return this.enumerate(context).some((candidate) => candidate.target.choiceId === action.target?.choiceId)
        ? { ok: true } : { ok: false, code: "PASS_RESERVE_STALE", message: "PASS 预留牌选择已失效" };
    },
    execute(context, action) {
      const root = context.workingRoot || context;
      const cardSelection = root.match.pendingDecision?.kind === "card_selection"
        ? root.match.pendingDecision : null;
      if (cardSelection) {
        const player = root.playerState.players.find((candidate) => candidate.id === cardSelection.playerId);
        const picked = action.target?.source === "blind"
          ? cards.blindDraw(root.cardState, root.playerState, player, options.random, {
            createCardInstance: (entry, sequence) => (
              cards.createCommittedCardInstance(root, entry, sequence)
            ),
          })
          : cards.pickFromPublic(
            root.cardState,
            root.playerState,
            player,
            Number(action.target?.slotIndex),
            options.random,
            {
              createCardInstance: (entry, sequence) => (
                cards.createCommittedCardInstance(root, entry, sequence)
              ),
            },
          );
        if (!picked?.ok) return picked;
        delete root.match.pendingDecision;
        return {
          ok: true,
          progressed: true,
          events: [{
            type: "quick_trade_card_selected",
            tradeId: cardSelection.tradeId,
            playerId: player.id,
            cardInstanceId: picked.card?.id || null,
          }],
        };
      }
      return { ok: false, code: "SIMULATION_CARD_SELECTION_STALE", message: "卡牌选择已失效" };
    },
  });

  registry.register({
    family: "choose_reward",
    enumerate() { return []; },
    validate() {
      return {
        ok: false,
        code: "STANDARD_ACTION_NOT_LEGAL",
        message: "当前没有 Production Composition 外部奖励 Decision",
      };
    },
    execute() {
      return {
        ok: false,
        code: "STANDARD_ACTION_NOT_LEGAL",
        message: "奖励选择必须由当前 Effect Session Decision 提交",
      };
    },
  });

  const stateAdapter = {
    createWorkingState: (initialOptions) => createWorkingState(initialOptions, options.random),
    createProjectionState: (workingState, committedState) => ({
      ...createCommittedState(workingState, committedState.meta.stateVersion),
      probeRouteRequirements: buildProbeRouteRequirements(workingState),
    }),
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
      beginDiscardSelection: (count, input) => openTradeDiscard(workingRoot, count, input),
      beginCardSelection: (input) => openTradeCardSelection(workingRoot, input),
      random: options.random,
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

  const simulationContinuation = {
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
    resolveDecision(_workingState, choice) {
      _workingState = _workingState.workingRoot || _workingState;
      const descriptor = choice?.standardAction || choice;
      return registry.execute(_workingState, descriptor);
    },
  };

  const simulationRuleOptions = {
    stateStoreApi: {
      createStateStore(initialState, storeOptions) {
        return highCouplingStateApi.createHighCouplingStateStore(initialState, storeOptions);
      },
    },
    effectRuntimeApi,
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
    projectWorkingState: true,
    projectState(state, viewer, _session, projectionContext = {}) {
      const committed = state?.playerState
        ? createCommittedState(state, projectionContext.stateVersion || 0)
        : clone(state);
      const projectedState = {
        ...committed,
        probeRouteRequirements: state?.playerState
          ? buildProbeRouteRequirements(state)
          : null,
      };
      return typeof options.projectCounterfactualState === "function"
        ? options.projectCounterfactualState(projectedState, clone(viewer))
        : projectedState;
    },
    createCounterfactualFork: options.counterfactualEnabled === false
      ? null
      : (envelope, forkOptions = {}) => {
        const branchKey = [
          options.seed ?? "seti-simulation",
          "composition-fork",
          forkOptions.branchKey || "root",
        ].join(":");
        const branchRandom = createCounterfactualRandom(branchKey);
        const forkKernel = createSimulationRuleComposition({
          ...options,
          random: branchRandom,
          rngState: {
            algorithm: "seti-counterfactual-mulberry32-v1",
            state: hashCounterfactualSeed(branchKey),
            branch: true,
          },
          counterfactualEnabled: false,
        });
        const restored = forkKernel.composition.lifecycle.restore(envelope, { silent: true });
        if (!restored?.ok) {
          forkKernel.composition.dispose();
          throw new Error(restored?.message || restored?.code || "Simulation counterfactual fork 恢复失败");
        }
        return {
          composition: forkKernel.composition,
          resetBranch(nextBranchKey) {
            branchRandom.resetSeed([
              options.seed ?? "seti-simulation",
              "composition-fork",
              nextBranchKey || "root",
            ].join(":"));
          },
        };
      },
    reuseCounterfactualFork: true,
    initialOptions: {
      activePlayerCount: options.activePlayerCount || 4,
      seed: options.seed,
      rngState: options.rngState,
      initialize: false,
    },
  };
  const production = productionCompositionApi.createProductionComposition({
    ruleCompositionApi: { createRuleComposition },
    getStandardActionSource: () => registry,
    productionRules: { quickTrades },
    getAuthority(workingState) {
      const root = workingState.workingRoot || workingState;
      const pending = root.match.pendingDecision;
      return {
        actorId: pending?.playerId || root.playerState.currentPlayerId || null,
        stateVersion: composition?.stateSourcePort?.getSnapshot()?.meta?.stateVersion || 0,
        decisionVersion: root.match.decisionVersion || 0,
      };
    },
    standardActionDomainOptions: { continuation: simulationContinuation },
    ruleOptions: simulationRuleOptions,
  });
  composition = production.composition;

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
      const registrations = new Map(
        production.domainPack.actionRegistry.coverage().map((entry) => [entry.family, entry]),
      );
      return SIMULATION_FAMILY_CONTRACTS.map((contract) => Object.freeze({
        ...registrations.get(contract.family),
        obligation: contract.obligation,
        status: contract.unavailableReason ? "unavailable" : "supported",
        unavailableReason: contract.unavailableReason || null,
      }));
    },
  });

  return Object.freeze({
    composition,
    newGame,
    actionContract,
    productionDomainPackId: production.domainPack.packId,
    productionActionOwners: production.domainPack.actionOwners,
    productionActionExecutorOwners: production.domainPack.actionExecutorOwners,
  });
}

module.exports = { createSimulationRuleComposition };
