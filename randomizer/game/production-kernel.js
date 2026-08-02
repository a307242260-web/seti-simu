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
const scanEffects = loadProductionDependency("./actions/scan-effects", "SetiScanEffects");
const researchTechAction = loadProductionDependency("./actions/research-tech", "SetiActionResearchTech");
const data = loadProductionDependency("./data", "SetiData");
const cards = loadProductionDependency("./cards/deck", "SetiCards");
const cardEffects = loadProductionDependency("./cards/effects", "SetiCardEffects");
const tech = loadProductionDependency("./tech", "SetiTech");
const aliens = loadProductionDependency("./aliens", "SetiAliens");
const finalScoring = loadProductionDependency("./final-scoring", "SetiFinalScoring");
const rocketAbility = loadProductionDependency("./abilities/rocket", "SetiAbilityRocket");
const planetAbility = loadProductionDependency("./abilities/planet", "SetiAbilityPlanet");
const industryPassives = loadProductionDependency("./industry/passives", "SetiIndustryPassives");
const industryCatalog = loadProductionDependency("./industry/catalog", "SetiIndustryCatalog");
const { createRuleComposition } = loadProductionDependency("./rule-composition", "SetiRuleComposition");
const productionCompositionApi = loadProductionDependency("./production-composition", "SetiProductionComposition");
const turnFlowApi = loadProductionDependency("./turn-flow", "SetiTurnFlow");

const RULESET_VERSION = "seti-runtime-v1";
const INTERNAL_RULE_SCOPE = Symbol("seti-production-kernel-rule-scope");
const DEFAULT_FINAL_SCORE_IDS = Object.freeze(["a", "b", "c", "d"]);
const NEBULA_IDS_BY_SCAN_CODE = Object.freeze([
  Object.freeze(["sector-4-a", "sector-3-a"]),
  Object.freeze(["sector-2-b", "sector-3-b"]),
  Object.freeze(["sector-2-a", "sector-1-a"]),
  Object.freeze(["sector-1-b", "sector-4-b"]),
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
  { family: "pass", obligation: "生产回合规则提交 PASS 并建立预留牌 DecisionEffect" },
  { family: "move", obligation: "生产火箭规则枚举移动并建立支付 DecisionEffect" },
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
  { family: "end_turn", obligation: "生产回合规则结束当前行动，并在跨轮时统一结算下一轮收入" },
  { family: "choose_card", obligation: "生产 DecisionEffect 枚举并提交预留牌选择" },
  { family: "choose_target", obligation: "生产 DecisionEffect 枚举并提交移动或科技目标" },
  { family: "choose_payment", obligation: "生产 DecisionEffect 枚举并提交弃牌或移动支付" },
  { family: "choose_reward", obligation: "生产效果 DecisionEffect 枚举并提交奖励选择" },
  {
    family: "choose_branch",
    obligation: "分支选择必须由生产 DecisionEffect 提供合法描述符",
  },
  {
    family: "choose_final_scoring",
    obligation: "终局计分选择必须由生产终局规则提供合法描述符",
  },
  {
    family: "accept_optional_effect",
    obligation: "可选效果必须由生产 DecisionEffect 提供合法描述符",
  },
]);

function installProductionKernel(options = {}) {
  const hostKind = options.hostKind;
  const projectionAdapter = options.projectionAdapter;
  const hostServices = options.hostServices;
  const ruleOptions = options.ruleOptions || {};
  if (!["browser", "simulation"].includes(hostKind)) {
    throw new TypeError("Production Kernel 需要显式 hostKind: browser 或 simulation");
  }
  if (!projectionAdapter || typeof projectionAdapter.projectState !== "function") {
    throw new TypeError(`Production Kernel ${hostKind} 缺少专属 projection adapter`);
  }
  if (!hostServices || typeof hostServices !== "object" || Array.isArray(hostServices)) {
    throw new TypeError(`Production Kernel ${hostKind} 缺少专属 host services`);
  }
  if (options.standardActionDomainOptions != null) {
    throw new TypeError("Production Kernel 禁止 Host 注入 Standard Action Decision/事务规则");
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
  if (ruleOptions.projectState && ruleOptions.projectState !== projectionAdapter.projectState) {
    throw new TypeError(`Production Kernel ${hostKind} projection adapter identity 不一致`);
  }
  const production = productionCompositionApi.createProductionComposition({
    ruleCompositionApi: options.ruleCompositionApi,
    hostServices,
    getAuthority: options.getAuthority,
    ruleOptions: {
      ...ruleOptions,
      projectState: projectionAdapter.projectState,
      readModels: projectionAdapter.readModels || ruleOptions.readModels,
    },
  });
  return Object.freeze({
    hostKind,
    composition: production.composition,
    domainPack: production.domainPack,
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

function buildInitialState(options = {}, random = Math.random) {
  const state = initialGameStateApi.createInitialState(createModules(), {
    defaultInitialPlayerColor: players.DEFAULT_PLAYER_COLOR,
    activePlayerCount: options.activePlayerCount || 4,
    finalScoreIds: DEFAULT_FINAL_SCORE_IDS,
    random,
    schemaVersion: stateStoreApi.SCHEMA_VERSION,
    gameId: "seti-simulation-runtime",
    rulesetVersion: RULESET_VERSION,
    seed: options.seed ?? "seti-simulation",
    rngState: clone(options.rngState || { algorithm: "seti-simulation-mulberry32-v1", state: 1 }),
    sequences: {
      alienEntity: 1,
      card: 1,
      dataToken: 1,
      finalMark: 1,
      nebulaReplacement: 1,
      nebulaToken: 1,
      rocket: 1,
    },
  });
  state.match.decisionVersion = 0;
  if (options.prepareBrowser === true || options.initialize === true) {
    randomizeBoard(state, random);
    createCardGame(state, random, 4);
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

function randomizeBoard(workingState, random) {
  const defaultPlayerId = workingState.players.players
    .find((player) => player.color === players.DEFAULT_PLAYER_COLOR)?.id || null;
  const others = workingState.players.players.map((player) => player.id)
    .filter((playerId) => playerId !== defaultPlayerId);
  const order = defaultPlayerId ? [defaultPlayerId, ...shuffle(others, random)] : shuffle(others, random);
  workingState.turn.turnOrderPlayerIds = order;
  workingState.turn.activePlayerIds = order.slice(0, workingState.turn.activePlayerCount);
  workingState.turn.startPlayerId = workingState.turn.activePlayerIds[0] || null;
  workingState.turn.currentPlayerId = workingState.turn.startPlayerId;
  const wheelSteps = [0, 0, 0, 0, 0];
  const wheelOffsets = [0, 0, 20, 11, 4];
  for (let wheel = 1; wheel <= 4; wheel += 1) {
    wheelSteps[wheel] -= Math.floor(random() * 8 + wheelOffsets[wheel]);
  }
  workingState.solarSystem.rotation = solar.normalizeRotationState(wheelSteps, 0);
  const sectors = [1, 2, 3, 4];
  while (sectors.length) {
    const slotId = sectors.length;
    const sectorId = sectors.splice(Math.floor(random() * sectors.length), 1)[0];
    workingState.solarSystem.sectorBySlot[slotId] = sectorId;
  }
  data.clearNebulaData(workingState.data);
  data.fillAllNebulaData(workingState.data, { source: "setup", root: workingState });
  finalScoring.randomizeTileVariants(workingState.finalScoring, DEFAULT_FINAL_SCORE_IDS, random);
  aliens.randomizeAlienAssignments(workingState.aliens);
  tech.boardState.setupBoardBonuses(workingState.tech, random);
}

function getEarthCoordinate(workingState) {
  const earth = solar.createSolarSnapshot(workingState.solarSystem).planetLocations
    .find((planet) => planet.planetId === "earth");
  return earth ? { x: earth.x, y: earth.y } : { x: 1, y: 1 };
}

function readSequences(workingState) {
  return {
    alienEntity: workingState.meta?.sequences?.alienEntity ?? 1,
    card: workingState.meta?.sequences?.card ?? 1,
    dataToken: workingState.meta?.sequences?.dataToken ?? 1,
    finalMark: workingState.meta?.sequences?.finalMark ?? 1,
    nebulaReplacement: workingState.meta?.sequences?.nebulaReplacement ?? 1,
    nebulaToken: workingState.meta?.sequences?.nebulaToken ?? 1,
    rocket: workingState.meta?.sequences?.rocket ?? 1,
  };
}

function rewardScore(effects) {
  return (effects || []).reduce((total, effect) => (
    total + Number(effect?.options?.gain?.score || 0)
  ), 0);
}

function rewardDataCount(effects) {
  return (effects || []).reduce((total, effect) => (
    total + (
      effect?.type === planetRewards.EFFECT_TYPES.GAIN_DATA
        ? Math.max(0, Number(effect?.options?.count) || 0)
        : 0
    )
  ), 0);
}

const PROBE_VALUE_POINTS = Object.freeze({
  credits: 5,
  energy: 5,
  publicity: 2.5,
  ordinaryCard: 2.5,
  alienCard: 10 / 3,
});

function availableFirstYellowTraces(workingState) {
  return Object.values(workingState.aliens?.aliens || {}).filter((slot) => (
    !slot?.revealed && !slot?.traces?.yellow?.firstPlaced
  )).length;
}

function rewardEquivalentValue(effects, workingState) {
  let remainingFirstYellow = availableFirstYellowTraces(workingState);
  return (effects || []).reduce((total, effect) => {
    const gain = effect?.options?.gain || {};
    let value = Number(gain.score || 0)
      + Number(gain.credits || 0) * PROBE_VALUE_POINTS.credits
      + Number(gain.energy || 0) * PROBE_VALUE_POINTS.energy
      + Number(gain.publicity || 0) * PROBE_VALUE_POINTS.publicity;
    if (effect?.type === planetRewards.EFFECT_TYPES.DRAW_CARDS) {
      value += Number(effect.options?.count || 0) * PROBE_VALUE_POINTS.ordinaryCard;
    } else if (effect?.type === planetRewards.EFFECT_TYPES.PICK_CARD) {
      value += Number(effect.options?.count || 1) * PROBE_VALUE_POINTS.ordinaryCard;
    } else if (effect?.type === planetRewards.EFFECT_TYPES.AOMOMO_CARD) {
      value += Number(effect.options?.count || 1) * PROBE_VALUE_POINTS.alienCard;
    } else if (
      effect?.type === planetRewards.EFFECT_TYPES.ALIEN_TRACE
      && effect.options?.traceType === "yellow"
      && remainingFirstYellow > 0
    ) {
      remainingFirstYellow -= 1;
      value += PROBE_VALUE_POINTS.publicity + PROBE_VALUE_POINTS.alienCard;
    }
    return total + value;
  }, 0);
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

function buildProbeRouteRequirements(workingState, requestedPlayerId = null) {
  const playerId = requestedPlayerId ?? workingState.turn.currentPlayerId;
  const player = workingState.players.players.find((candidate) => candidate.id === playerId);
  if (!player || workingState.turn.gameEnded) return null;
  const context = {
    state: workingState,
    solarSystem: workingState.solarSystem,
    players: workingState.players,
    pieces: workingState.pieces,
    planets: workingState.planets,
    aliens: workingState.aliens,
    turn: workingState.turn,
    getPlanetLocations: () => solar.createSolarSnapshot(workingState.solarSystem).planetLocations,
  };
  const earth = getEarthCoordinate(workingState);
  const activeRockets = rockets.getRocketsForPlayer(workingState.pieces, player.id)
    .filter((rocket) => rocket.surface === "solar-board");
  const sources = activeRockets.map((rocket) => ({
    sourceId: `rocket:${rocket.id}`,
    rocketId: rocket.id,
    launchRequired: false,
    coordinate: rockets.getRocketSectorCoordinate(rocket),
  }));
  const activeCount = rocketAbility.getActiveRocketCountForPlayer
    ? rocketAbility.getActiveRocketCountForPlayer(workingState.pieces, player.id)
    : activeRockets.length;
  const launchSlotAvailable = rockets.findAvailableSlotIndex(
    workingState.pieces,
    earth.x,
    earth.y,
  ) !== null;
  if (
    activeRockets.length === 0
    && activeCount < rocketAbility.getRocketLimitForPlayer(player, context)
    && launchSlotAvailable
  ) {
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
    const initialRoute = {
      coordinate: source.coordinate,
      path: [],
      movePoints: 0,
      publicityStops: 0,
    };
    const queue = [initialRoute];
    const bestRouteByCoordinate = new Map([
      [`${source.coordinate.x},${source.coordinate.y}`, initialRoute],
    ]);
    while (queue.length) {
      const route = queue.shift();
      const routeKey = `${route.coordinate.x},${route.coordinate.y}`;
      if (bestRouteByCoordinate.get(routeKey) !== route) continue;
      const visible = solar.resolveVisibleContent(
        route.coordinate.x,
        route.coordinate.y,
        workingState.solarSystem,
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
          const dataCount = rewardDataCount(effects);
          const incomeCount = effects.filter((effect) => (
            effect?.type === planetRewards.EFFECT_TYPES.INCOME
          )).length;
          const launchCost = source.launchRequired
            ? rocketAbility.getLaunchCost(context, player)
            : {};
          const endpointCost = choice.cost || {};
          const totalCost = {
            credits: Number(launchCost.credits || 0) + Number(endpointCost.credits || 0),
            energy: route.movePoints + Number(endpointCost.energy || 0),
          };
          const publicityValue = route.publicityStops * PROBE_VALUE_POINTS.publicity;
          const grossEquivalentValue = rewardEquivalentValue(effects, workingState) + publicityValue;
          const resourceGap = {
            credits: Math.max(0, totalCost.credits - Number(player.resources?.credits || 0)),
            energy: Math.max(0, totalCost.energy - Number(player.resources?.energy || 0)),
            movementSteps: route.path.length,
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
              incomeCount,
              dataCount,
              grossEquivalentValue,
              rewardSummary: choice.rewardSummary,
              source: `planetRewards.${choice.actionType}:${choice.planetId}`,
            },
            required: {
              credits: totalCost.credits,
              energy: totalCost.energy,
              movementSteps: route.path.length,
              movementPoints: route.movePoints,
            },
            gap: resourceGap,
            nextStep: source.launchRequired
              ? { family: "launch" }
              : firstMove
                ? { family: "move", rocketId: source.rocketId, ...firstMove }
                : {
                  family: choice.actionType,
                  rocketId: source.rocketId,
                  planetId: choice.planetId,
                  target: clone(choice.target || {}),
                },
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
      for (const direction of rocketAbility.MOVE_DIRECTIONS) {
        const move = rockets.canMoveFromCoordinate(
          workingState.pieces,
          route.coordinate,
          direction.deltaX,
          direction.deltaY,
          source.rocketId,
        );
        if (!move.ok) continue;
        const key = `${move.to.x},${move.to.y}`;
        const destination = solar.resolveVisibleContent(
          move.to.x,
          move.to.y,
          workingState.solarSystem,
        )?.content;
        const candidateRoute = {
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
        };
        const existing = bestRouteByCoordinate.get(key);
        const better = !existing
          || candidateRoute.movePoints < existing.movePoints
          || (
            candidateRoute.movePoints === existing.movePoints
            && candidateRoute.path.length < existing.path.length
          )
          || (
            candidateRoute.movePoints === existing.movePoints
            && candidateRoute.path.length === existing.path.length
            && candidateRoute.publicityStops > existing.publicityStops
          );
        if (!better) continue;
        bestRouteByCoordinate.set(key, candidateRoute);
        queue.push(candidateRoute);
      }
    }
  }
  const shortestByRequirement = new Map();
  for (const candidate of candidates) {
    const current = shortestByRequirement.get(candidate.requirementId);
    if (
      !current
      || candidate.required.movementPoints < current.required.movementPoints
      || (
        candidate.required.movementPoints === current.required.movementPoints
        && candidate.required.movementSteps < current.required.movementSteps
      )
      || (
        candidate.required.movementPoints === current.required.movementPoints
        && candidate.required.movementSteps === current.required.movementSteps
        && candidate.publicityStops > current.publicityStops
      )
    ) shortestByRequirement.set(candidate.requirementId, candidate);
  }
  const ranked = [...shortestByRequirement.values()].sort((left, right) => (
    Number(right.gap.credits === 0 && right.gap.energy === 0)
      - Number(left.gap.credits === 0 && left.gap.energy === 0)
    || right.targetBenefit.grossEquivalentValue - left.targetBenefit.grossEquivalentValue
    || right.publicityStops - left.publicityStops
    || right.targetBenefit.score - left.targetBenefit.score
    || left.required.credits + left.required.energy - right.required.credits - right.required.energy
    || left.required.movementSteps - right.required.movementSteps
    || String(left.requirementId).localeCompare(String(right.requirementId))
  ));
  return {
    schemaVersion: "seti-probe-route-requirements-v1",
    playerId: player.id,
    candidates: ranked,
  };
}

function buildDataAnalyzeRequirements(
  workingState,
  requestedPlayerId = null,
  probeRequirements = null,
) {
  const playerId = requestedPlayerId ?? workingState.turn.currentPlayerId;
  const player = workingState.players.players.find((candidate) => candidate.id === playerId);
  if (!player || workingState.turn.gameEnded) return null;
  const computerSlots = data.listComputerPlacedTokens(player)
    .map((token) => Number(token.placementSlot))
    .filter(Number.isFinite);
  const computerPlacedCount = computerSlots.length;
  const analyzeReady = computerSlots.includes(data.ANALYZE_REQUIRED_COMPUTER_SLOT);
  const availableData = Number(player.resources?.availableData || 0);
  const remainingPlacements = Math.max(
    0,
    data.ANALYZE_REQUIRED_COMPUTER_SLOT - computerPlacedCount,
  );
  const dataNeeded = Math.max(0, remainingPlacements - availableData);
  const firstRowComplete = computerPlacedCount >= 4;
  const firstRowRemainingPlacements = Math.max(0, 4 - computerPlacedCount);
  const heldDataCanFillFirstRow = availableData >= firstRowRemainingPlacements;
  const eligible = firstRowComplete || heldDataCanFillFirstRow;
  const scanCost = scanEffects.getStandardScanCost(player);
  const analyzeCost = industryPassives.canAnalyzeWithoutEnergy(player)
    ? {}
    : { energy: data.ANALYZE_ENERGY_COST };
  const nextStep = !eligible
    ? null
    : analyzeReady
    ? "analyze"
    : availableData > 0
      ? "place_data"
      : "acquire_data";
  const nextCost = nextStep === "analyze"
    ? analyzeCost
    : {};
  const acquisitionPlans = [];
  if (eligible && nextStep === "acquire_data") {
    acquisitionPlans.push({
      planId: "data:scan",
      kind: "scan",
      dataCount: 1,
      nextStep: { family: "scan" },
      nextCost: {
        credits: Number(scanCost.credits || 0),
        energy: Number(scanCost.energy || 0),
      },
      resultTargetIds: ["data:analyze"],
    });
    for (const candidate of probeRequirements?.candidates || []) {
      const dataCount = Math.max(0, Number(candidate.targetBenefit?.dataCount) || 0);
      if (dataCount <= 0) continue;
      acquisitionPlans.push({
        planId: `data:probe:${candidate.requirementId}`,
        kind: "probe",
        dataCount,
        probeRequirementId: candidate.requirementId,
        probeTargetId: candidate.targetId,
        nextStep: clone(candidate.nextStep),
        resultTargetIds: ["data:analyze", candidate.targetId],
      });
    }
    for (const card of player.hand || []) {
      const dataCount = (cardEffects.buildPlayEffects(card) || []).reduce((total, effect) => (
        total + (
          effect?.type === cardEffects.REWARD_TYPES.GAIN_DATA
            ? Math.max(0, Number(effect?.options?.count) || 0)
            : 0
        )
      ), 0);
      if (dataCount > 0) {
        acquisitionPlans.push({
          planId: `data:card:${card.id}`,
          kind: "card",
          dataCount,
          cardInstanceId: card.id,
          nextStep: { family: "play_card", cardInstanceId: card.id },
          nextCost: clone(cardEffects.getCardPlayCost(card) || {}),
          resultTargetIds: ["data:analyze", `card:resolve:${card.id}`],
        });
      }
      const corner = cards.getDiscardActionRewardForCard(card);
      const cornerDataCount = Math.max(0, Number(corner?.dataCount) || 0);
      if (cornerDataCount > 0) {
        acquisitionPlans.push({
          planId: `data:corner:${card.id}`,
          kind: "card_corner",
          dataCount: cornerDataCount,
          cardInstanceId: card.id,
          nextStep: { family: "card_corner", cardInstanceId: card.id },
          resultTargetIds: ["data:analyze"],
        });
      }
    }
  }
  return {
    schemaVersion: "seti-data-analyze-requirements-v2",
    playerId: player.id,
    targetId: "data:analyze",
    computerPlacedCount,
    remainingPlacements,
    availableData,
    dataNeeded,
    firstRowComplete,
    firstRowRemainingPlacements,
    heldDataCanFillFirstRow,
    eligible,
    eligibilityReason: heldDataCanFillFirstRow
      ? "held-data-can-fill-first-row"
      : firstRowComplete
        ? "first-row-complete"
        : null,
    nextStep,
    nextCost: {
      credits: Number(nextCost.credits || 0),
      energy: Number(nextCost.energy || 0),
    },
    nextGap: {
      credits: Math.max(0, Number(nextCost.credits || 0) - Number(player.resources?.credits || 0)),
      energy: Math.max(0, Number(nextCost.energy || 0) - Number(player.resources?.energy || 0)),
    },
    acquisitionPlans,
    fieldSources: {
      dataProgress: "players[].dataProgress.computerSlots",
      availableData: "players[].resources.availableData",
      scanCost: "SetiScanEffects.getStandardScanCost",
      analyzeCost: "SetiIndustryPassives.canAnalyzeWithoutEnergy",
    },
  };
}

function nebulaAtSectorX(workingState, sectorX) {
  return solar.getNebulaAtCoordinate(
    solar.mod8(sectorX),
    5,
    workingState.solarSystem.sectorBySlot,
  )?.id || null;
}

function cardScanCode(card) {
  const catalog = cards.getCatalogEntryForCard(card);
  const code = Number(card?.scanActionCode ?? catalog?.scan_action_code);
  return Number.isInteger(code) ? code : null;
}

function standardScanSectorIds(workingState, player) {
  const sectorIds = new Set();
  const earth = getEarthCoordinate(workingState);
  const earthOffsets = scanEffects.playerOwnsPurpleTech(player, 1, {
    roundNumber: workingState.turn.roundNumber,
    turnNumber: workingState.turn.turnNumber,
  }) ? [-1, 0, 1] : [0];
  for (const offset of earthOffsets) {
    const sectorId = nebulaAtSectorX(workingState, earth.x + offset);
    if (sectorId) sectorIds.add(sectorId);
  }
  for (const card of workingState.cards?.publicCards || []) {
    for (const sectorId of NEBULA_IDS_BY_SCAN_CODE[cardScanCode(card)] || []) {
      sectorIds.add(sectorId);
    }
  }
  if (scanEffects.playerOwnsPurpleTech(player, 2, {
    roundNumber: workingState.turn.roundNumber,
    turnNumber: workingState.turn.turnNumber,
  })) {
    const mercury = solar.createSolarSnapshot(workingState.solarSystem)
      .planetLocations?.mercury;
    const sectorId = mercury ? nebulaAtSectorX(workingState, mercury.x) : null;
    if (sectorId) sectorIds.add(sectorId);
  }
  if (scanEffects.playerOwnsPurpleTech(player, 3, {
    roundNumber: workingState.turn.roundNumber,
    turnNumber: workingState.turn.turnNumber,
  })) {
    for (const card of player.hand || []) {
      for (const sectorId of NEBULA_IDS_BY_SCAN_CODE[cardScanCode(card)] || []) {
        sectorIds.add(sectorId);
      }
    }
  }
  return [...sectorIds].sort();
}

function cardDirectScanSectorIds(card) {
  const sectorIds = new Set();
  for (const effect of cardEffects.buildPlayEffects(card)) {
    if (effect?.type === cardEffects.EFFECT_TYPES.SCAN_NEBULA && effect.options?.nebulaId) {
      sectorIds.add(effect.options.nebulaId);
    } else if (effect?.type === cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE) {
      for (const sectorId of cardEffects.NEBULA_IDS_BY_COLOR?.[effect.options?.color] || []) {
        sectorIds.add(sectorId);
      }
    } else if (effect?.type === cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN) {
      for (const sectorId of data.NEBULA_IDS) {
        if (sectorId !== data.AOMOMO_NEBULA_ID) sectorIds.add(sectorId);
      }
    }
  }
  return [...sectorIds].sort();
}

function buildSectorWinRequirements(workingState, requestedPlayerId = null) {
  const playerId = requestedPlayerId ?? workingState.turn.currentPlayerId;
  const player = workingState.players.players.find((candidate) => candidate.id === playerId);
  if (!player || workingState.turn.gameEnded) return null;
  const playerKeys = new Set([player.id, player.color].filter(Boolean).map(String));
  const standardSectorIds = standardScanSectorIds(workingState, player);
  const specialAccess = (player.hand || [])
    .map((card) => ({
      sourceId: `card:${card.id}`,
      family: "play_card",
      cardInstanceId: card.id,
      sectorIds: cardDirectScanSectorIds(card),
    }))
    .filter((source) => source.sectorIds.length > 0);
  const candidates = data.NEBULA_IDS
    .filter((sectorId) => sectorId !== data.AOMOMO_NEBULA_ID)
    .map((sectorId) => {
      const tokens = data.listNebulaTokens(workingState.data, sectorId);
      const openSlotCount = tokens.filter((token) => (
        !token.replacedByPlayerId && !token.replacedByPlayerColor
      )).length;
      const ranking = data.getSectorRanking(workingState.data, sectorId);
      const own = ranking.find((entry) => (
        [entry.playerId, entry.playerKey, entry.playerColor]
          .filter(Boolean)
          .some((key) => playerKeys.has(String(key)))
      )) || null;
      const maxOpponentCount = ranking
        .filter((entry) => entry !== own)
        .reduce((maximum, entry) => Math.max(maximum, Number(entry.count) || 0), 0);
      const ownCount = Number(own?.count) || 0;
      const minimumOwnMarks = Math.max(
        openSlotCount,
        Math.max(0, maxOpponentCount - ownCount),
      );
      const settlementCount = Number(
        workingState.data?.sectorSettlements?.sectors?.[sectorId]?.settlementCount,
      ) || 0;
      return {
        targetId: `sector:win:${sectorId}:${settlementCount + 1}`,
        sectorId,
        nextSettlementNumber: settlementCount + 1,
        openSlotCount,
        ownCount,
        maxOpponentCount,
        minimumOwnMarks,
        ranking: ranking.map((entry) => ({
          playerId: entry.playerId || null,
          playerColor: entry.playerColor || null,
          count: Number(entry.count) || 0,
          latestReplacementOrder: Number(entry.latestReplacementOrder) || 0,
        })),
      };
    })
    .filter((candidate) => candidate.openSlotCount > 0)
    .sort((left, right) => (
      left.minimumOwnMarks - right.minimumOwnMarks
      || left.openSlotCount - right.openSlotCount
      || left.sectorId.localeCompare(right.sectorId)
    ));
  return {
    schemaVersion: "seti-sector-win-requirements-v1",
    playerId: player.id,
    candidates,
    standardScanCost: scanEffects.getStandardScanCost(player),
    accessSources: [
      {
        sourceId: "standard-scan",
        family: "scan",
        sectorIds: standardSectorIds,
      },
      ...specialAccess,
    ],
    wins: clone(
      workingState.data?.sectorSettlements?.winsByPlayerId?.[player.id]
      || workingState.data?.sectorSettlements?.winsByPlayerId?.[player.color]
      || [],
    ),
    fieldSources: {
      competition: "data.{nebulae,sectorExtraMarks}",
      tieBreak: "data.*.replacementOrder",
      completion: "data.sectorSettlements.winsByPlayerId",
    },
  };
}

function incomeBaseline(player) {
  return Object.fromEntries([
    "credits",
    "energy",
    "publicity",
    "availableData",
    "handSize",
    "additionalPublicScan",
  ].map((key) => [key, Number(player?.income?.[key]) || 0]));
}

function cardCanIncreaseIncome(card) {
  const incomeEffectTypes = new Set([
    cardEffects.EFFECT_TYPES.INCOME,
    cardEffects.EFFECT_TYPES.TUCK_PLAYED_CARD_TO_INCOME,
    cardEffects.EFFECT_TYPES.DISCARD_ANY_FOR_INCOME,
  ]);
  return cardEffects.buildPlayEffects(card).some((effect) => (
    incomeEffectTypes.has(effect?.type)
  ));
}

function buildIncomeGainRequirements(
  workingState,
  requestedPlayerId = null,
  probeRequirements = null,
) {
  const playerId = requestedPlayerId ?? workingState.turn.currentPlayerId;
  const player = workingState.players.players.find((candidate) => candidate.id === playerId);
  if (!player || workingState.turn.gameEnded) return null;
  const baseline = incomeBaseline(player);
  const baselineKey = Object.values(baseline).join(",");
  const targetId = `income:gain:${baselineKey}`;
  const plans = [];
  for (const candidate of probeRequirements?.candidates || []) {
    if (Number(candidate.targetBenefit?.incomeCount) <= 0) continue;
    plans.push({
      planId: `probe:${candidate.requirementId}`,
      kind: "probe",
      probeRequirementId: candidate.requirementId,
      nextStep: clone(candidate.nextStep),
    });
  }
  const computerSlots = data.listComputerPlacedTokens(player)
    .map((token) => Number(token.placementSlot))
    .filter(Number.isFinite);
  if (!computerSlots.includes(4) && computerSlots.length < 4) {
    const remainingPlacements = 4 - computerSlots.length;
    const availableData = Number(player.resources?.availableData) || 0;
    const nextStepFamily = availableData > 0 ? "place_data" : "scan";
    const scanCost = scanEffects.getStandardScanCost(player);
    const nextCost = nextStepFamily === "scan" ? scanCost : {};
    plans.push({
      planId: "income:data:computer-slot-4",
      kind: "data",
      targetComputerSlot: 4,
      remainingPlacements,
      nextStep: { family: nextStepFamily },
      nextCost: {
        credits: Number(nextCost.credits) || 0,
        energy: Number(nextCost.energy) || 0,
      },
    });
  }
  for (const card of player.hand || []) {
    if (!cardCanIncreaseIncome(card)) continue;
    plans.push({
      planId: `card:${card.id}`,
      kind: "card",
      cardInstanceId: card.id,
      nextStep: { family: "play_card", cardInstanceId: card.id },
    });
  }
  const industryAbilityId = industryCatalog.getPlayerIndustryDefinition(player)?.activeAbilityId
    || null;
  if (["helios_remove_tech_income", "mission_publicity_pick_income"].includes(industryAbilityId)) {
    plans.push({
      planId: `income:industry:${industryAbilityId}`,
      kind: "industry",
      abilityId: industryAbilityId,
      nextStep: { family: "industry", abilityId: industryAbilityId },
    });
  }
  return {
    schemaVersion: "seti-income-gain-requirements-v1",
    playerId: player.id,
    targetId,
    baseline,
    plans,
    fieldSources: {
      baseline: "players[].income",
      probe: "SetiPlanetRewards",
      data: "players[].dataProgress.computerSlots",
      cards: "SetiCardEffects.buildPlayEffects",
      industry: "SetiIndustryAbilities",
    },
  };
}

function buildTechGainRequirements(workingState, requestedPlayerId = null) {
  const playerId = requestedPlayerId ?? workingState.turn.currentPlayerId;
  const player = workingState.players.players.find((candidate) => candidate.id === playerId);
  if (!player || workingState.turn.gameEnded) return null;
  const context = {
    state: workingState,
    players: workingState.players,
    tech: workingState.tech,
    turn: { ...workingState.turn, currentPlayerId: player.id },
  };
  const researchCost = tech.resolver.getResearchPublicityCost(player);
  const options = researchTechAction.getResearchOptions(context, { skipCost: true });
  const computerSlots = data.listComputerPlacedTokens(player)
    .map((token) => Number(token.placementSlot))
    .filter(Number.isFinite);
  const computerPlacedCount = computerSlots.length;
  const publicityPreparationPlans = [];
  if (
    !computerSlots.includes(2)
    && computerPlacedCount < 2
    && Number(player.resources?.availableData) >= 2 - computerPlacedCount
  ) {
    publicityPreparationPlans.push({
      planId: "tech:publicity:data-slot-2",
      kind: "place_data",
      targetComputerSlot: 2,
      remainingPlacements: 2 - computerPlacedCount,
      publicityGain: 1,
      nextStep: { family: "place_data" },
    });
  }
  for (const card of player.hand || []) {
    const corner = cards.getDiscardActionRewardForCard(card);
    const publicityGain = Math.max(0, Number(corner?.gain?.publicity) || 0);
    if (!publicityGain) continue;
    publicityPreparationPlans.push({
      planId: `tech:publicity:corner:${card.id}`,
      kind: "card_corner",
      cardInstanceId: card.id,
      publicityGain,
      nextStep: { family: "card_corner", cardInstanceId: card.id },
    });
  }
  const plans = options.ok ? (options.choices || []).map((choice) => ({
    targetId: `tech:gain:${choice.tileId}`,
    planId: `tech:${choice.tileId}:${choice.blueSlot ?? ""}`,
    tileId: choice.tileId,
    blueSlot: choice.blueSlot ?? null,
    required: { publicity: researchCost },
    gap: {
      publicity: Math.max(0, researchCost - Number(player.resources?.publicity || 0)),
    },
    nextStep: { family: "research_tech" },
  })) : [];
  return {
    schemaVersion: "seti-tech-gain-requirements-v2",
    playerId: player.id,
    researchCost,
    publicityPreparationPlans,
    plans,
    fieldSources: {
      choices: "SetiActionResearchTech.getResearchOptions(skipCost)",
      researchCost: "SetiTech.resolver.getResearchPublicityCost",
      publicityPreparation: "SetiData.COMPUTER_SLOT_BONUSES + SetiCards.getDiscardActionRewardForCard",
      completion: "players[].techState.ownedTiles",
    },
  };
}

function activePlayers(workingState) {
  const active = new Set(workingState.turn.activePlayerIds || []);
  return (workingState.players.players || []).filter((player) => active.has(player.id));
}

function createCardGame(workingState, random, handCount = 5) {
  const factoryOptions = {
    createCardInstance: (entry, sequence) => (
      cards.createCommittedCardInstance(workingState, entry, sequence)
    ),
  };
  for (const player of workingState.players.players) {
    player.hand = [];
    player.reservedCards = [];
    player.completedTaskCount = 0;
    player.resources.handSize = 0;
  }
  workingState.cards.publicCards = Array.from({ length: cards.PUBLIC_CARD_COUNT }, () => null);
  workingState.cards.discardPile = [];
  workingState.cards.drawPileCardIds = [];
  for (const player of activePlayers(workingState)) {
    cards.drawCardsToHand(
      workingState.cards,
      workingState.players,
      player,
      handCount,
      random,
      factoryOptions,
    );
  }
  cards.ensurePublicCardsFilled(
    workingState.cards,
    workingState.players,
    random,
    factoryOptions,
  );
  cards.preparePassReservePiles(workingState.cards, workingState.players, {
    rounds: [1, 2, 3],
    activePlayerCount: workingState.turn.activePlayerCount,
    random,
    ...factoryOptions,
  });
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
  function projectedRequirements(state, viewer, session) {
    const probeRouteRequirements = buildProbeRouteRequirements(state, viewer?.playerId);
    return {
      probeRouteRequirements,
      dataAnalyzeRequirements: buildDataAnalyzeRequirements(
        state,
        viewer?.playerId,
        probeRouteRequirements,
      ),
      sectorWinRequirements: buildSectorWinRequirements(state, viewer?.playerId),
      incomeGainRequirements: buildIncomeGainRequirements(
        state,
        viewer?.playerId,
        probeRouteRequirements,
      ),
      techGainRequirements: buildTechGainRequirements(state, viewer?.playerId),
    };
  }

  function createActionContext(state) {
    return {
      state,
      solarSystem: state.solarSystem,
      players: state.players,
      pieces: state.pieces,
      planets: state.planets,
      data: state.data,
      cards: state.cards,
      tech: state.tech,
      aliens: state.aliens,
      finalScoring: state.finalScoring,
      turn: state.turn,
      match: state.match,
      stateVersion: state.meta?.stateVersion
        ?? composition?.stateSourcePort?.getSnapshot()?.meta?.stateVersion
        ?? 0,
      decisionVersion: state.match.decisionVersion || 0,
      random: options.random,
      blindDrawCard(player) {
        return cards.blindDraw(
          state.cards,
          state.players,
          player,
          options.random,
          {
            createCardInstance: (entry, sequence) => (
              cards.createCommittedCardInstance(state, entry, sequence)
            ),
          },
        );
      },
      getEarthSectorCoordinate: () => getEarthCoordinate(state),
      getPlanetLocations: () => solar.createSolarSnapshot(state.solarSystem).planetLocations,
      rotateSolarOrbit(count = 1) {
        const beforeRotation = clone(state.solarSystem.rotation);
        state.solarSystem.rotation = solar.applySolarOrbitRotation(
          state.solarSystem.rotation,
          count,
        );
        const settlement = rocketAbility.settleRocketsAfterSolarRotation(
          state,
          beforeRotation,
          state.solarSystem.rotation,
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
    createInitialState(initialOptions) {
      const state = buildInitialState(initialOptions, options.random);
      if (typeof options.random.getState === "function") {
        state.meta.rngState = {
          algorithm: options.rngAlgorithm
            || state.meta.rngState?.algorithm
            || "seti-production-rng-v1",
          state: options.random.getState(),
        };
      }
      return state;
    },
    runWithWorkingState(context, operation) {
      const workingState = context.state || context;
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
    projectState(state, viewer, _session, projectionContext = {}) {
      const requirements = projectedRequirements(state, viewer, _session);
      const projectionState = options.trustedProjectionReader === true ? state : clone(state);
      const projectedState = {
        ...projectionState,
        ...(options.trustedProjectionReader === true ? requirements : clone(requirements)),
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
            algorithm: "seti-counterfactual-mulberry32-v2",
            state: hashCounterfactualSeed(branchKey),
            branch: true,
          },
          counterfactualEnabled: false,
          trustedForkLifecycle: true,
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
    allowTrustedForkLifecycle: options.trustedForkLifecycle === true,
    initialOptions: {
      activePlayerCount: options.activePlayerCount || 4,
      seed: options.seed,
      rngState: options.rngState,
      initialize: false,
    },
  };
  const hostProjectionAdapter = Object.freeze({
    adapterId: `seti-${hostKind}-projection-v1`,
    projectState: hostRuleOptions.projectState,
  });
  const hostServices = Object.freeze({ ...(options.hostServices || {}) });
  const installedKernel = installProductionKernel({
    [INTERNAL_RULE_SCOPE]: true,
    hostKind,
    ruleCompositionApi: { createRuleComposition },
    getAuthority(state) {
      const root = state.state || state;
      const explicit = state.standardActionAuthority || null;
      return {
        actorId: explicit?.actorId || root.turn.currentPlayerId || null,
        stateVersion: explicit?.stateVersion
          ?? root.meta?.stateVersion
          ?? composition?.stateSourcePort?.getSnapshot()?.meta?.stateVersion
          ?? 0,
        decisionVersion: explicit?.decisionVersion ?? root.match.decisionVersion ?? 0,
      };
    },
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
    const rngState = config.rngState || options.rngState || (
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
      initialize: hostKind === "simulation" || config.initialize === true,
      prepareBrowser: hostKind === "browser",
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
