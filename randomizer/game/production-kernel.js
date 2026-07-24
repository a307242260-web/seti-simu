"use strict";

const productionRoot = typeof globalThis !== "undefined" ? globalThis : window;
const loadProductionDependency = (path, globalName) => (
  typeof require === "function" ? require(path) : productionRoot[globalName]
);
const stateStoreApi = loadProductionDependency("./state/state-store", "SetiStateStore");
const highCouplingStateApi = loadProductionDependency("./state/high-coupling-slices", "SetiHighCouplingState");
const effectRuntimeApi = loadProductionDependency("./effects/session-runtime", "SetiEffectSession");
const standardActionApi = loadProductionDependency("./actions/standard-action", "SetiStandardAction");
const initialGameStateApi = loadProductionDependency("./state/initial-game-state", "SetiInitialGameState");
const players = loadProductionDependency("./players", "SetiPlayers");
const solar = loadProductionDependency("../solar-system/core", "SetiSolarSystem");
const rockets = loadProductionDependency("./rockets", "SetiRocketActions");
const planetStats = loadProductionDependency("./planet-stats", "SetiPlanetStats");
const planetRewards = loadProductionDependency("./actions/planet-rewards", "SetiPlanetRewards");
const data = loadProductionDependency("./data", "SetiData");
const cards = loadProductionDependency("./cards/deck", "SetiCards");
const cardEffects = loadProductionDependency("./cards/effects", "SetiCardEffects");
const tech = loadProductionDependency("./tech", "SetiTech");
const industry = loadProductionDependency("./industry", "SetiIndustry");
const aliens = loadProductionDependency("./aliens", "SetiAliens");
const finalScoring = loadProductionDependency("./final-scoring", "SetiFinalScoring");
const actionHistory = loadProductionDependency("./history/action-history", "SetiActionHistory");
const initialCards = loadProductionDependency("./initial-cards", "SetiInitialCards");
const initialSetup = loadProductionDependency("./initial-setup", "SetiInitialSetup");
const ai = loadProductionDependency("./ai", "SetiAI");
const planetReferenceLayout = loadProductionDependency("./planet-reference-layout", "SetiPlanetReferenceLayout");
const rocketAbility = loadProductionDependency("./abilities/rocket", "SetiAbilityRocket");
const planetAbility = loadProductionDependency("./abilities/planet", "SetiAbilityPlanet");
const { createRuleComposition } = loadProductionDependency("./rule-composition", "SetiRuleComposition");
const productionCompositionApi = loadProductionDependency("./production-composition", "SetiProductionComposition");
const turnFlowApi = loadProductionDependency("./turn-flow", "SetiTurnFlow");

const RULESET_VERSION = "seti-runtime-v1";
const INTERNAL_RULE_SCOPE = Symbol("seti-production-kernel-rule-scope");
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

function installProductionKernel(options = {}) {
  const hostKind = options.hostKind;
  const stateAdapter = options.stateAdapter;
  const projectionAdapter = options.projectionAdapter;
  const hostServices = options.hostServices;
  const ruleOptions = options.ruleOptions || {};
  if (!["browser", "simulation"].includes(hostKind)) {
    throw new TypeError("Production Kernel 需要显式 hostKind: browser 或 simulation");
  }
  if (!stateAdapter || typeof stateAdapter.createWorkingState !== "function"
    || typeof stateAdapter.createCommittedState !== "function"
    || typeof stateAdapter.restoreWorkingState !== "function") {
    throw new TypeError(`Production Kernel ${hostKind} 缺少专属 state adapter`);
  }
  if (!projectionAdapter || typeof projectionAdapter.projectState !== "function") {
    throw new TypeError(`Production Kernel ${hostKind} 缺少专属 projection adapter`);
  }
  if (!hostServices || typeof hostServices !== "object" || Array.isArray(hostServices)) {
    throw new TypeError(`Production Kernel ${hostKind} 缺少专属 host services`);
  }
  if (options.standardActionDomainOptions != null) {
    throw new TypeError("Production Kernel 禁止 Host 注入 Standard Action continuation/Decision");
  }
  if (options.productionRules != null) {
    throw new TypeError(
      options.productionRules.conditionalActions != null
        ? "Production Kernel 禁止 Host 注入 conditional action registry"
        : "Production Kernel 禁止 Host 注入规则模块",
    );
  }
  if (ruleOptions.runWithWorkingState != null && options[INTERNAL_RULE_SCOPE] !== true) {
    throw new TypeError("Production Kernel 禁止 Host 注入 working-state rule transaction");
  }
  if (ruleOptions.stateAdapter && ruleOptions.stateAdapter !== stateAdapter) {
    throw new TypeError(`Production Kernel ${hostKind} state adapter identity 不一致`);
  }
  if (ruleOptions.projectState && ruleOptions.projectState !== projectionAdapter.projectState) {
    throw new TypeError(`Production Kernel ${hostKind} projection adapter identity 不一致`);
  }
  const production = productionCompositionApi.createProductionComposition({
    ruleCompositionApi: options.ruleCompositionApi,
    hostServices,
    getAuthority: options.getAuthority,
    ruleOptions: {
      ...ruleOptions,
      stateAdapter,
      projectWorkingState: projectionAdapter.projectWorkingState === true,
      projectState: projectionAdapter.projectState,
      readModels: projectionAdapter.readModels || ruleOptions.readModels,
    },
  });
  return Object.freeze({
    hostKind,
    composition: production.composition,
    domainPack: production.domainPack,
    stateAdapter,
    projectionAdapter,
    hostServices,
  });
}

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
  if (options.prepareBrowser === true) {
    randomizeBoard(state, random);
    createCardGame(state, random, 4);
    state.match.initialSetupConfig = {
      aiDifficulty: options.aiDifficulty || "laughable",
      industryLabels: clone(options.industryLabels || []),
    };
  } else if (options.initialize === true) {
    initializeProductionGame(state, options, random);
  }
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

function submitOpeningPlans(workingState, selectedPlans, aiDifficulty, random) {
  const source = initialSetup.createSource();
  const setupContext = { workingRoot: workingState, random };
  workingState.match.initialSetupConfig = { aiDifficulty };
  if (!workingState.match.initialSetup) {
    const started = source.execute(setupContext, {
      family: "choose_card",
      target: { kind: "start_initial_setup" },
      payload: {},
    });
    if (!started?.ok) throw new Error(started?.message || "初始选择启动失败");
  }
  for (const selected of selectedPlans) {
    const selections = [
      { selectionKind: "industry", cardId: selected.industry.id },
      ...selected.initialCards.map((card) => ({ selectionKind: "initial", cardId: card.id })),
    ];
    for (const selection of selections) {
      const submitted = source.execute(setupContext, {
        family: "choose_card",
        target: { kind: "select_initial_card", ...selection },
        payload: {},
      });
      if (!submitted?.ok) throw new Error(submitted?.message || "初始选择提交失败");
    }
    const confirmed = source.execute(setupContext, {
      family: "choose_card",
      target: { kind: "confirm_initial_setup" },
      payload: {},
    });
    if (!confirmed?.ok) throw new Error(confirmed?.message || "初始选择确认失败");
  }
  syncPlanetRockets(workingState);
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
  const source = initialSetup.createSource();
  workingState.match.initialSetupConfig = { aiDifficulty: options.aiDifficulty || "laughable" };
  const started = source.execute({ workingRoot: workingState, random }, {
    family: "choose_card",
    target: { kind: "start_initial_setup" },
    payload: {},
  });
  if (!started?.ok) throw new Error(started?.message || "初始选择启动失败");
  const setupOffers = workingState.match.initialSetup.offersByPlayerId;
  const playerIds = workingState.match.initialSetup.playerIds;
  const aiDifficulty = options.aiDifficulty || "laughable";
  const offers = playerIds.map((playerId) => {
    const offer = setupOffers[playerId];
    const industryOptions = offer.industryOptions;
    const initialOptions = offer.initialOptions;
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
      submitOpeningPlans(
        fork,
        forkPlans,
        aiDifficulty,
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
  submitOpeningPlans(workingState, selectedPlans, aiDifficulty, random);
}

function initializeProductionGame(workingState, options, random) {
  randomizeBoard(workingState, random);
  createCardGame(workingState, random, 4);
  chooseInitialSelections(workingState, options, random);
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

function createHostCompositionFacade(composition) {
  return Object.freeze({
    SAVE_SCHEMA_VERSION: composition.SAVE_SCHEMA_VERSION,
    inputPort: composition.inputPort,
    lifecycle: composition.lifecycle,
    counterfactualPort: composition.counterfactualPort,
    projection: composition.projection,
    inspect: composition.inspect,
    ...(composition.readModelPort ? { readModelPort: composition.readModelPort } : {}),
    subscribe: composition.subscribe,
    dispose: composition.dispose,
  });
}

function createProductionHostComposition(options = {}) {
  const hostKind = options.hostKind || "simulation";
  if (!["browser", "simulation"].includes(hostKind)) {
    throw new TypeError(`未知 Production Host: ${hostKind}`);
  }
  if (typeof options.random !== "function") {
    throw new TypeError(`${hostKind} Production Composition 缺少显式 random`);
  }
  let composition;

  const stateAdapter = {
    createWorkingState(initialOptions) {
      const workingState = createWorkingState(initialOptions, options.random);
      if (typeof options.random.getState === "function") {
        workingState.meta.rngState = {
          algorithm: options.rngAlgorithm || "seti-production-rng-v1",
          state: options.random.getState(),
        };
      }
      return workingState;
    },
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
    restoreWorkingState(target, source, metadata) {
      const restored = restoreWorkingState(target, source, metadata);
      const rngState = restored.meta?.rngState;
      if (typeof options.random.setState === "function" && Number.isSafeInteger(rngState?.state)) {
        options.random.setState(rngState.state);
      }
      return restored;
    },
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
      random: options.random,
      blindDrawCard(player) {
        return cards.blindDraw(
          workingRoot.cardState,
          workingRoot.playerState,
          player,
          options.random,
          {
            createCardInstance: (entry, sequence) => (
              cards.createCommittedCardInstance(workingRoot, entry, sequence)
            ),
          },
        );
      },
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

  const hostRuleOptions = {
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
      const rngState = workingState.meta?.rngState;
      if (typeof options.random.setState === "function" && Number.isSafeInteger(rngState?.state)) {
        options.random.setState(rngState.state);
      }
      try {
        return operation();
      } finally {
        workingState.meta.sequences = readSequences(workingState);
        if (typeof options.random.getState === "function") {
          workingState.meta.rngState = {
            algorithm: options.rngAlgorithm || rngState?.algorithm || "seti-production-rng-v1",
            state: options.random.getState(),
          };
        }
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
      if (hostKind === "browser") {
        if (typeof options.projectBrowserState !== "function") {
          throw new TypeError("Browser Production Composition 缺少 viewer-safe projectBrowserState");
        }
        return options.projectBrowserState(
          projectedState,
          clone(viewer),
          clone(_session),
          clone(projectionContext),
        );
      }
      return typeof options.projectCounterfactualState === "function" && viewer?.role !== "simulation"
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
        const forkKernel = createProductionHostComposition({
          ...options,
          hostKind,
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
  const hostProjectionAdapter = Object.freeze({
    adapterId: `seti-${hostKind}-projection-v1`,
    projectWorkingState: hostRuleOptions.projectWorkingState,
    projectState: hostRuleOptions.projectState,
  });
  const hostServices = Object.freeze({ ...(options.hostServices || {}) });
  const installedKernel = installProductionKernel({
    [INTERNAL_RULE_SCOPE]: true,
    hostKind,
    ruleCompositionApi: { createRuleComposition },
    getAuthority(workingState) {
      const root = workingState.workingRoot || workingState;
      const pending = root.match.pendingDecision;
      return {
        actorId: pending?.playerId || root.playerState.currentPlayerId || null,
        stateVersion: composition?.stateSourcePort?.getSnapshot()?.meta?.stateVersion || 0,
        decisionVersion: root.match.decisionVersion || 0,
      };
    },
    stateAdapter,
    projectionAdapter: hostProjectionAdapter,
    hostServices,
    ruleOptions: hostRuleOptions,
  });
  const production = Object.freeze({
    composition: installedKernel.composition,
    domainPack: installedKernel.domainPack,
  });
  composition = production.composition;

  function newGame(config = {}) {
    const rngState = config.rngState || (
      typeof options.random.getState === "function"
        ? {
          algorithm: options.rngAlgorithm || "seti-production-rng-v1",
          state: options.random.getState(),
        }
        : undefined
    );
    return composition.lifecycle.newGame({
      activePlayerCount: config.activePlayerCount || 4,
      seed: config.seed,
      rngState,
      aiDifficulty: config.aiDifficulty,
      initialize: hostKind === "simulation" || config.initialize === true,
      prepareBrowser: hostKind === "browser",
      industryLabels: config.industryLabels || [],
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
    composition: createHostCompositionFacade(composition),
    newGame,
    actionContract,
    productionDomainPackId: production.domainPack.packId,
    productionActionOwners: production.domainPack.actionOwners,
    productionActionExecutorOwners: production.domainPack.actionExecutorOwners,
  });
}

function createSimulationRuleComposition(options = {}) {
  return createProductionHostComposition({ ...options, hostKind: "simulation" });
}

function createBrowserProductionKernel(options = {}) {
  return createProductionHostComposition({ ...options, hostKind: "browser" });
}

const productionKernelApi = Object.freeze({
  createProductionKernel(options = {}) {
    if (options.hostKind === "browser") return installProductionKernel(options);
    return createSimulationRuleComposition({ ...options, hostKind: "simulation" });
  },
  createBrowserProductionKernel,
  createSimulationRuleComposition,
  installProductionKernel,
});
if (typeof module === "object" && module.exports) module.exports = productionKernelApi;
productionRoot.SetiProductionKernel = productionKernelApi;
