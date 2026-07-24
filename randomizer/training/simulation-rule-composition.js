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
const turnFlowApi = require("../app/turn-flow");
const initialCards = require("../game/initial-cards");
const ai = require("../game/ai");
const { createHeuristicPolicyAdapter } = require("./heuristic-policy-adapter");
const planetReferenceLayout = require("../game/planet-reference-layout");
const rocketAbility = require("../game/abilities/rocket");
const planetAbility = require("../game/abilities/planet");
const { createRuleComposition } = require("../game/rule-composition");

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
    unavailableReason: "Simulation composition 尚未接入望远镜扫描规则端口",
  },
  {
    family: "analyze",
    obligation: "分析必须由生产数据轨规则提供合法描述符",
    unavailableReason: "Simulation composition 尚未接入数据分析规则端口",
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
  { family: "choose_reward", obligation: "生产效果 continuation 枚举并提交奖励选择" },
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

function listHandCornerRewardChoices(workingState, pending) {
  if (pending?.kind !== "play_card_effect" || pending.effect?.type !== cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD) {
    return [];
  }
  const player = workingState.playerState.players.find((candidate) => candidate.id === pending.playerId);
  return (player?.hand || []).flatMap((card, handIndex) => {
    const reward = cards.getDiscardActionRewardForCard(card);
    const moveReward = cards.getDiscardActionMoveRewardForCard(card);
    if (!reward && !moveReward) return [];
    return [{
      target: {
        kind: "play-card-hand-corner-reward",
        choiceId: card.id,
        cardInstanceId: card.id,
      },
      payload: { handIndex, reward: clone(reward), moveReward: clone(moveReward) },
      summary: cards.getCardLabel(card),
    }];
  });
}

function applySimulationCardEffect(workingState, player, effect, random) {
  if (effect.type === cardEffects.REWARD_TYPES.GAIN_RESOURCES) {
    players.gainResources(player, effect.options?.gain || {});
    return { ok: true, events: [{ type: "card_effect", effectId: effect.id, effectType: effect.type }] };
  }
  if (effect.type === cardEffects.REWARD_TYPES.GAIN_DATA) {
    const count = Math.max(0, Math.round(Number(effect.options?.count) || 0));
    for (let index = 0; index < count; index += 1) data.gainData(player, { source: "play_card" });
    return { ok: true, events: [{ type: "card_effect", effectId: effect.id, effectType: effect.type }] };
  }
  if (effect.type === cardEffects.REWARD_TYPES.DRAW_CARDS) {
    const count = Math.max(0, Math.round(Number(effect.options?.count) || 0));
    cards.drawCardsToHand(workingState.cardState, workingState.playerState, player, count, random);
    return { ok: true, events: [{ type: "card_effect", effectId: effect.id, effectType: effect.type }] };
  }
  if (effect.type === cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD) {
    return { ok: true, pending: { kind: "play_card_effect", playerId: player.id, effect: clone(effect) }, events: [] };
  }
  return {
    ok: false,
    code: "SIMULATION_CARD_EFFECT_UNSUPPORTED",
    message: `Simulation play_card 尚未接入卡牌效果 ${effect.type}`,
  };
}

function applyCornerReward(workingState, player, reward, source) {
  if (!reward) return;
  if (reward.gain && Object.keys(reward.gain).length) players.gainResources(player, reward.gain);
  const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
  for (let index = 0; index < dataCount; index += 1) {
    data.gainData(player, { source });
  }
}

function getActionOwner(workingState, result) {
  const ownerEvent = (result?.events || []).find((event) => event?.playerId || event?.playerColor) || {};
  const playerId = result?.playerId || ownerEvent.playerId || null;
  const playerColor = result?.playerColor || ownerEvent.playerColor || null;
  return (workingState.playerState.players || []).find((player) => (
    (playerId && player.id === playerId) || (playerColor && player.color === playerColor)
  )) || players.getCurrentPlayer(workingState.playerState);
}

function listAlienTraceChoices(workingState, pending) {
  const traceType = pending?.traceType || null;
  if (!traceType) return [];
  return [1, 2].flatMap((alienSlotId) => {
    const slot = aliens.getAlienSlot?.(workingState.alienGameState, alienSlotId);
    const trace = slot?.traces?.[traceType];
    if (!slot || (slot.revealed && !trace?.firstPlaced)) return [];
    return [{
      target: {
        kind: "planet-reward-alien-trace",
        choiceId: `${alienSlotId}:${traceType}`,
        alienSlotId,
        traceType,
      },
      payload: { alienSlotId, traceType },
      summary: `外星人${alienSlotId}：${traceType}痕迹`,
    }];
  });
}

function applyAlienTraceChoice(workingState, pending, choice) {
  const player = (workingState.playerState.players || [])
    .find((candidate) => candidate.id === pending?.playerId);
  const alienSlotId = Number(choice?.target?.alienSlotId);
  const traceType = choice?.target?.traceType;
  if (!player || !Number.isInteger(alienSlotId) || !traceType) {
    return { ok: false, code: "PLANET_REWARD_TRACE_STALE", message: "行星奖励痕迹选择已失效" };
  }
  const placed = aliens.placeFirstTrace(
    workingState.alienGameState,
    alienSlotId,
    traceType,
    player.color,
  );
  if (!placed?.ok) return placed;
  const firstYellowReward = !placed.extraOnly && traceType === "yellow"
    ? {
      gain: { publicity: 1 },
      alienCard: {
        id: `alien-trace-reward:${alienSlotId}:${player.id}`,
        kind: "alien",
        source: "first-yellow-trace",
        alienSlotId,
      },
    }
    : null;
  if (firstYellowReward) {
    players.gainResources(player, firstYellowReward.gain);
    if (!Array.isArray(player.alienCards)) player.alienCards = [];
    player.alienCards.push(firstYellowReward.alienCard);
  }
  let revealed = null;
  if (placed.readyToReveal) {
    const assignedAlienId = aliens.getAlienSlot?.(
      workingState.alienGameState,
      alienSlotId,
    )?.assignedAlienId;
    if (assignedAlienId) {
      revealed = aliens.revealAlien(workingState.alienGameState, alienSlotId, assignedAlienId);
    }
  }
  return {
    ok: true,
    progressed: true,
    events: [{
      type: "alienTracePlaced",
      source: "planet_reward",
      alienSlotId,
      traceType,
      playerId: player.id,
      reward: clone(firstYellowReward || null),
      revealed: revealed?.ok ? revealed.alienId : null,
    }],
  };
}

function applyPlanetRewardEffects(workingState, actionId, result, markerSequenceOverride = null) {
  const player = getActionOwner(workingState, result);
  if (!player) {
    return { ok: false, code: "PLANET_REWARD_OWNER_MISSING", message: "行星奖励 owner 不存在" };
  }
  const rewardResult = markerSequenceOverride != null
    ? {
      ...result,
      rewardMarkerSequence: markerSequenceOverride,
    }
    : result;
  const effects = planetRewards.buildRewardEffectsForAction(actionId, rewardResult);
  const events = [];
  let pendingTrace = null;
  for (const effect of effects) {
    if (effect.type === planetRewards.EFFECT_TYPES.GAIN_RESOURCES) {
      players.gainResources(player, effect.options?.gain || {});
      events.push({
        type: "planet_reward_resources",
        playerId: player.id,
        gain: clone(effect.options?.gain || {}),
      });
      continue;
    }
    if (effect.type === planetRewards.EFFECT_TYPES.GAIN_DATA) {
      const count = Math.max(0, Math.round(Number(effect.options?.count) || 0));
      const before = Number(player.resources?.availableData || 0);
      players.gainResources(player, { availableData: count });
      const gainedCount = Number(player.resources?.availableData || 0) - before;
      for (let index = 0; index < count; index += 1) {
        events.push({
          type: index < gainedCount ? "planet_reward_data" : "planet_reward_data_discarded",
          playerId: player.id,
          availableDataAfter: Number(player.resources?.availableData || 0),
        });
      }
      continue;
    }
    if (effect.type === planetRewards.EFFECT_TYPES.ALIEN_TRACE && !pendingTrace) {
      pendingTrace = {
        type: "planet_reward_alien_trace",
        playerId: player.id,
        traceType: effect.options?.traceType || null,
        sourceActionId: result.actionId,
      };
      continue;
    }
    return {
      ok: false,
      code: "SIMULATION_PLANET_REWARD_UNSUPPORTED",
      message: `Simulation composition 尚未接入${actionId}奖励效果 ${effect.type}`,
    };
  }
  return { ok: true, events, pendingTrace };
}

function createSimulationRuleComposition(options = {}) {
  if (typeof options.random !== "function") throw new TypeError("Simulation Rule Composition 缺少显式 random");
  let composition;
  function createConditionalDecisionEffect(workingRoot, kind, pending, family = "choose_target") {
    const choices = baseRegistry.enumerate(
      { workingRoot },
      {
        family,
        payload: {
          decisionContext: {
            kind,
            pending: clone(pending),
          },
        },
      },
    );
    if (!choices.length) throw new Error(`${kind} DecisionEffect 没有合法选项`);
    return {
      type: standardActionDomainApi.DECISION_EFFECT_TYPE,
      kind: "decision",
      ownerId: pending.playerId,
      decisionKind: family,
      payload: {
        choices,
        decisionContext: {
          kind,
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
      const landMarkerSequence = action.family === "land" && action.target?.type !== "satellite"
        ? planetStats.getPlanetLandingCount(root.planetStatsState, action.target?.planetId) + 1
        : null;
      const result = baseRegistry.execute(context, action);
      if (result?.ok) {
        if (action.family === "land" || action.family === "orbit") {
          const reward = applyPlanetRewardEffects(root, action.family, result, landMarkerSequence);
          if (!reward.ok) return reward;
          result.events = [...(result.events || []), ...(reward.events || [])];
          if (reward.pendingTrace) {
            result.decisionEffect = createConditionalDecisionEffect(
              root,
              "planet_reward_alien_trace",
              reward.pendingTrace,
            );
          }
        }
        if (action.family === "land" || action.family === "orbit") {
          const player = players.getCurrentPlayer(root.playerState);
          if (player) player.mainActionCompleted = true;
        }
        if ((root.match.decisionVersion || 0) === before) root.match.decisionVersion = before + 1;
      }
      return result;
    },
  };

  registry.register(standardActionApi.createOptionDefinition(
    "quick_trade",
    standardActionApi.createQuickTradeProvider({
      quickTrades,
      execute(actionContext, action) {
        const root = actionContext.workingRoot || actionContext;
        const result = quickTrades.executeTrade(
          action.target?.tradeId,
          createQuickTradeContext(root, options.random),
        );
        if (!result.ok) return result;
        return {
          ...result,
          progressed: true,
          events: [{
            type: "quick_trade",
            tradeId: action.target?.tradeId,
            playerId: root.playerState.currentPlayerId,
          }],
          history: [{
            type: "quick_trade",
            tradeId: action.target?.tradeId,
            playerId: root.playerState.currentPlayerId,
          }],
        };
      },
    }),
  ));

  registry.register(standardActionApi.createOptionDefinition(
    "play_card",
    standardActionApi.createPlayCardProvider({
      players,
      cards,
      getCardPlayCost: cardEffects.getCardPlayCost,
      canStart(actionContext) {
        const root = actionContext.workingRoot || actionContext;
        const player = players.getCurrentPlayer(root.playerState);
        return !hasPendingContinuation(root) && !player?.mainActionCompleted
          ? { ok: true }
          : { ok: false, message: "当前无法开始打牌行动" };
      },
      execute(actionContext, action) {
        const root = actionContext.workingRoot || actionContext;
        const player = players.getCurrentPlayer(root.playerState);
        const handIndex = player?.hand?.findIndex((card) => card.id === action.target?.cardInstanceId) ?? -1;
        const card = handIndex >= 0 ? player.hand[handIndex] : null;
        if (!card) {
          return { ok: false, code: "PLAY_CARD_STALE", message: "手牌实体已失效" };
        }
        const cost = cardEffects.getCardPlayCost(card);
        if (stableSerialize(cost) !== stableSerialize(action.payload?.cost || {})) {
          return { ok: false, code: "PLAY_CARD_COST_STALE", message: "卡牌费用已失效" };
        }
        const spent = players.spendResources(player, cost);
        if (!spent.ok) return spent;
        const removed = cards.discardFromHandAtIndex(player, handIndex);
        if (!removed.ok) return removed;
        const playedCard = removed.card;
        const model = cardEffects.getCardModel(playedCard);
        const cardType = cardEffects.getRuntimeCardTypeCode(playedCard);
        const reserved = [1, 2, 3].includes(cardType) || Boolean(model?.reserveAfterPlay);
        if (reserved) {
          cardEffects.ensureCardEffectState(playedCard);
          player.reservedCards.push(playedCard);
        } else {
          cards.addToDiscardPile(root.cardState, playedCard);
        }
        const events = [{
          type: "playCard",
          timing: "after_play_card",
          playerId: player.id,
          cardId: playedCard.cardId || null,
          sourceCardInstanceId: playedCard.id,
          price: Number(cost.credits || 0),
        }];
        let pending = null;
        for (const effect of cardEffects.buildPlayEffects(playedCard)) {
          const applied = applySimulationCardEffect(root, player, effect, options.random);
          if (!applied.ok) return applied;
          events.push(...(applied.events || []));
          if (applied.pending) {
            if (pending) {
              return {
                ok: false,
                code: "SIMULATION_CARD_MULTIPLE_DECISIONS",
                message: "单张牌产生多个未完成 Decision",
              };
            }
            pending = applied.pending;
          }
        }
        player.mainActionCompleted = true;
        return {
          ok: true,
          progressed: true,
          card: clone(playedCard),
          reserved,
          events,
          history: [{
            type: "play_card",
            playerId: player.id,
            cardInstanceId: playedCard.id,
            cardId: playedCard.cardId || null,
            cost: clone(cost),
          }],
          decisionEffect: pending
            ? createConditionalDecisionEffect(root, "play_card_effect", pending, "choose_reward")
            : null,
        };
      },
    }),
  ));

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
      return rocketAbility.listMoveRequirements(
        createActionContext(root),
        player,
        rocket.id,
      ).filter((direction) => (
        productionProbeDirections(player, rockets.getRocketSectorCoordinate(rocket))
          .some((allowed) => allowed.id === direction.id)
      )).map((direction) => ({
        target: { rocketId: rocket.id, deltaX: direction.deltaX, deltaY: direction.deltaY },
        payload: {
          requiredMovePoints: direction.requiredMovePoints,
        },
        summary: `移动火箭 ${rocket.id} ${direction.id}`,
      })).filter((candidate) => (
        Number(player.resources?.energy || 0) >= candidate.payload.requiredMovePoints
      ));
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
        const moved = rocketAbility.moveProbe(createActionContext(workingState), {
          rocketId: pendingMove.rocketId,
          deltaX: pendingMove.deltaX,
          deltaY: pendingMove.deltaY,
          cost: { energy: pendingMove.requiredMovePoints },
          providedMovePoints: pendingMove.requiredMovePoints,
          source: "move",
        });
        if (!moved.ok) return moved;
        delete workingState.match.pendingDecision;
        return {
          ok: true,
          progressed: true,
          events: moved.events?.length
            ? moved.events
            : [{ type: "move", rocketId: pendingMove.rocketId }],
        };
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
        decisionEffect = createConditionalDecisionEffect(root, "card_corner_free_move", pending);
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
      let decisionEffect = null;
      if (action.target?.companyLabel === "图灵系统") {
        decisionEffect = createConditionalDecisionEffect(root, "industry_ability", {
          flowType: "turing_borrow_tech",
          playerId: root.playerState.currentPlayerId,
        });
      } else if (action.target?.companyLabel === "层云核心") {
        for (const card of (root.cardState.publicCards || []).slice(0, 3)) {
          const reward = cards.getDiscardActionRewardForCard(card)
            || cards.getDiscardActionMoveRewardForCard(card);
          applyCornerReward(root, player, reward, "industry_stratus");
        }
      }
      return { ok: true, progressed: true, decisionEffect, events: [{ type: "industry" }] };
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
      if (sessionDecision?.kind === "industry_ability"
        && sessionDecision.pending?.flowType === "turing_borrow_tech") {
        return ["orange1", "orange2", "orange3", "orange4", "purple1", "purple2", "purple3", "purple4"]
          .map((tileId) => ({
          target: { kind: "research-tech-tile", choiceId: tileId, tileId },
          payload: { tileId },
          summary: `研究科技 ${tileId}`,
          }));
      }
      if (sessionDecision?.kind === "planet_reward_alien_trace") {
        return listAlienTraceChoices(root, sessionDecision.pending);
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
      return { ok: true, progressed: true, events: [{ type: "industry_borrow_tech", tileId: action.target.tileId }] };
    },
  });

  registry.register({
    family: "choose_card",
    enumerate(context) {
      const root = context.workingRoot || context;
      const pending = root.match.pendingDecision;
      if (pending?.kind === "card_selection") return listCardSelectionChoices(root, pending);
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
      const cardSelection = root.match.pendingDecision?.kind === "card_selection"
        ? root.match.pendingDecision : null;
      if (cardSelection) {
        const player = root.playerState.players.find((candidate) => candidate.id === cardSelection.playerId);
        const picked = action.target?.source === "blind"
          ? cards.blindDraw(root.cardState, root.playerState, player, options.random)
          : cards.pickFromPublic(
            root.cardState,
            root.playerState,
            player,
            Number(action.target?.slotIndex),
            options.random,
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
    family: "choose_reward",
    enumerate(context, { request } = {}) {
      const root = context.workingRoot || context;
      const pending = request?.payload?.decisionContext?.pending || null;
      return listHandCornerRewardChoices(root, pending);
    },
    validate(context, action, request) {
      return this.enumerate(context, request).some((candidate) => (
        candidate.target.choiceId === action.target?.choiceId
      ))
        ? { ok: true }
        : { ok: false, code: "PLAY_CARD_REWARD_STALE", message: "卡牌奖励选择已失效" };
    },
    execute() {
      return {
        ok: false,
        code: "PLAY_CARD_REWARD_SESSION_REQUIRED",
        message: "卡牌奖励必须由 Effect Session continuation 提交",
      };
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
              if (resolutionContext.decisionContext?.kind === "planet_reward_alien_trace") {
                return applyAlienTraceChoice(
                  _workingState,
                  resolutionContext.decisionContext.pending,
                  choice,
                );
              }
              if (resolutionContext.decisionContext?.kind === "play_card_effect") {
                const pending = resolutionContext.decisionContext.pending;
                const player = _workingState.playerState.players
                  .find((candidate) => candidate.id === pending?.playerId);
                if (!player || pending?.effect?.type !== cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD) {
                  return {
                    ok: false,
                    code: "PLAY_CARD_REWARD_STALE",
                    message: "卡牌奖励上下文已失效",
                  };
                }
                const current = listHandCornerRewardChoices(_workingState, pending)
                  .find((candidate) => candidate.target.choiceId === choice.target?.choiceId);
                if (!current) {
                  return {
                    ok: false,
                    code: "PLAY_CARD_REWARD_STALE",
                    message: "卡牌奖励选择已失效",
                  };
                }
                applyCornerReward(_workingState, player, current.payload.reward, "play_card");
                applyCornerReward(_workingState, player, current.payload.moveReward, "play_card");
                return {
                  ok: true,
                  progressed: true,
                  events: [{
                    type: "card_effect_choice",
                    effectId: pending.effect.id,
                    choiceId: current.target.choiceId,
                    playerId: player.id,
                  }],
                };
              }
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
              if (resolutionContext.decisionContext?.kind === "industry_ability") {
                const player = players.getCurrentPlayer(_workingState.playerState);
                const tileId = choice.target?.tileId;
                if (!tileId) {
                  return { ok: false, code: "INDUSTRY_TECH_STALE", message: "借用科技选择已失效" };
                }
                player.industryBorrowedTechTileId = tileId;
                player.industryBorrowedTechRound = _workingState.turnState.roundNumber;
                player.industryBorrowedTechTurn = _workingState.turnState.turnNumber;
                return {
                  ok: true,
                  progressed: true,
                  events: [{ type: "industry_borrow_tech", tileId }],
                };
              }
              const descriptor = choice?.standardAction || choice;
              return registry.execute(_workingState, descriptor);
            },
          },
        });
      },
    }],
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
