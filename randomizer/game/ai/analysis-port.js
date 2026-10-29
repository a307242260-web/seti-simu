(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("../rule-composition") : root.SetiRuleComposition,
    common ? require("../cards/effects") : root.SetiCardEffects,
    common ? require("../cards/deck") : root.SetiCards,
    common ? require("../industry/catalog") : root.SetiIndustryCatalog,
    common ? require("../turn-flow") : root.SetiTurnFlow,
    common ? require("../data") : root.SetiData,
    common ? require("../aliens/state") : root.SetiAlienState,
    common ? require("../actions/quick-trades") : root.SetiQuickTrades,
    common ? require("../actions/scan-effects") : root.SetiScanEffects,
    common ? require("../abilities/rocket") : root.SetiAbilityRocket,
    common ? require("../tech/resolver") : root.SetiTechResolver,
    common ? require("../effects/probe-turn-session") : root.SetiProbeTurnSession,
    common ? require("../tech/board-state") : root.SetiTechBoardState,
    common ? require("../../solar-system/core") : root.SetiSolarSystem,
    common ? require("../rockets") : root.SetiRocketActions,
    common ? require("../players") : root.SetiPlayers,
    common ? require("../effects/science-session") : root.SetiScienceSession,
    common ? require("./goal-movement") : root.SetiGoalMovement,
    common ? require("../production-kernel") : root.SetiProductionKernel,
    common ? require("./card-pick-planning") : root.SetiCardPickPlanning,
    common ? require("./resource-demand") : root.SetiResourceDemand,
    common ? require("./local-decision-plans") : root.SetiLocalDecisionPlans);
  if (common) module.exports = api;
  else root.SetiAnalysisPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (ruleComposition, cardEffects, cards, industryCatalog, turnFlow, data, alienState, quickTrades, scanEffects, rocketAbilities, techResolver, probeTurnSession, techBoardState, solar, rockets, players, scienceSession, goalMovement, productionKernel, cardPickPlanningApi, resourceDemand, localPlans) {
  "use strict";

  // 已逐项审计的 Production 公司组合：钱电模拟和取牌待选分别检查各自的队列前提。
  // 新主动/被动组合必须重审，不能因目录新增公司自动扩大证明范围。
  const POST_MAIN_MONEY_COMPANIES = Object.freeze({
    stratus_public_corners: [],
    turing_borrow_tech: ["turing_blue_tech_publicity"],
    sentinel_arm_play_corner: ["sentinel_launch_scan_earth"],
    huanyu_free_moves: ["huanyu_rocket_limit"],
    helios_remove_tech_income: ["helios_passive_reward_slots"],
    mission_publicity_pick_income: ["mission_play_type_publicity", "mission_startup_final_mark"],
    fenwick_publicity_pick_corner: ["fenwick_research_cost"],
    deepspace_swap_cards: ["deepspace_free_analyze"],
    future_span_pick_advance: ["future_span_parking"],
    no_active: ["alien_lab_panels"],
    strategy_pick_card: ["strategy_passive_reward_slots"],
  });

  // 已审计的效果及选项；新DSL字段不自动取得钱包单调性证明。
  const MONEY_MONOTONE_EFFECT_OPTIONS = Object.freeze({
    gain_resources: ["gain"], gain_data: ["count"], draw_cards: ["count"], pick_card: ["count"],
    launch: ["cost", "ignoreRocketLimit", "skipCost", "source"],
    card_move: ["movementPoints"], card_return_played_card_to_hand_if: ["condition"],
    card_orbit: ["grantRewards", "skipCost"], card_count_owned_tech_reward: ["per", "resource", "techType"],
    card_pluto_reserve: [], card_research_tech: ["afterResearchReward", "skipCost", "techTypes"],
    card_pay_credits_for_reward: ["reward"], card_discard_any_for_income: [],
    card_scan_nebula: ["gainData", "nebulaId", "repeat"], card_register_event_bonus: ["bonus"],
    card_planet_sector_scan: ["gainData", "planetId", "repeat"],
  });
  const MONEY_INDEPENDENT_CONDITIONS = Object.freeze({
    probeAdjacentEarth: [], dataTotal: ["count"], traceCount: ["traceType", "count"],
    completedSectorsByColor: ["color", "count"], resourceEquals: ["resource", "count"],
  });
  const MONEY_INDEPENDENT_EVENTS = new Set(["launch", "orbit", "land", "visitPlanet", "visitAsteroid",
    "visitComet", "researchTech", "signalMarked", "move", "playCard", "cardCorner"]);

  function hasMoneyMonotoneCardModel(card) {
    const model = cardEffects.getCardModel(card);
    if (!model || !["basic", "space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card)) return false;
    const bounded = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000;
    const keysWithin = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
      && Object.keys(value).every(key => keys.includes(key));
    function condition(value) {
      const keys = Object.hasOwn(MONEY_INDEPENDENT_CONDITIONS, value?.type) ? MONEY_INDEPENDENT_CONDITIONS[value.type] : null;
      return Boolean(keys && keysWithin(value, ["type", ...keys])
        && (value.type !== "resourceEquals" || ["publicity", "score", "availableData", "handSize", "aomomoFossils"].includes(value.resource)));
    }
    function effect(value) {
      const keys = Object.hasOwn(MONEY_MONOTONE_EFFECT_OPTIONS, value?.type) ? MONEY_MONOTONE_EFFECT_OPTIONS[value.type] : null;
      const options = value?.options || {};
      if (!keys || !keysWithin(value, ["id", "type", "label", "icon", "options"]) || !keysWithin(options, keys)) return false;
      for (const key of ["count", "per", "movementPoints", "repeat"]) if (Object.hasOwn(options, key) && !bounded(options[key])) return false;
      if (options.gain && (!keysWithin(options.gain, ["credits", "energy", "publicity", "score"])
        || Object.values(options.gain).some(value => !bounded(value)))) return false;
      if (options.cost && (!keysWithin(options.cost, ["credits", "energy", "publicity"])
        || Object.values(options.cost).some(value => !bounded(value)))) return false;
      if (options.resource && !["credits", "energy", "publicity", "score", "data"].includes(options.resource)) return false;
      if (options.condition && !condition(options.condition)) return false;
      if (options.reward && !effect(options.reward)) return false;
      if (options.afterResearchReward && (!keysWithin(options.afterResearchReward, ["kind", "publicity"])
        || options.afterResearchReward.kind !== "publicityIfNotFirstTake" || !bounded(options.afterResearchReward.publicity))) return false;
      if (options.bonus) {
        const bonus = options.bonus;
        if (!keysWithin(bonus, ["duration", "eventType", "includePlanetIds", "excludePlanetIds", "onceKey", "icon",
          "distinctBy", "minCount", "color", "rewards"]) || !MONEY_INDEPENDENT_EVENTS.has(bonus.eventType)
          || !["turn", "flow"].includes(bonus.duration)
          || bonus.distinctBy && !["planetId", "sectorX", "nebulaId", "cardInstanceId", "cardInstanceIds"].includes(bonus.distinctBy)
          || !Array.isArray(bonus.rewards) || !bonus.rewards.every(effect)) return false;
      }
      return true;
    }
    const taskSafe = task => keysWithin(task, ["id", "condition", "rewards"]) && condition(task.condition)
      && Array.isArray(task.rewards) && task.rewards.every(effect);
    if (!keysWithin(model, ["cardType", "playEffects", "tasks", "temporaryTasks", "triggers", "endGameScoring", "source",
      "reserveAfterPlay", "displayRow", "countsAsType3", "pluto"])
      || model.pluto && (!keysWithin(model.pluto, ["orbit", "land"]) || Object.values(model.pluto).some(value => typeof value !== "boolean"))
      || [model.playEffects, model.tasks, model.temporaryTasks, model.triggers].some(value => value != null && !Array.isArray(value))
      || !(model.playEffects || []).every(effect) || !(model.tasks || []).every(taskSafe)
      || !(model.temporaryTasks || []).every(taskSafe)) return false;
    if (!(model.triggers || []).every(trigger => keysWithin(trigger, ["id", "event", "effect"])
      && keysWithin(trigger.event, ["type", "types", "planetIds", "includePlanetIds",
      "excludePlanetIds", "requiresOwnOrbit", "techType", "color"])
      && (trigger.event.types == null || Array.isArray(trigger.event.types))
      && (trigger.event.types?.length ? trigger.event.types : [trigger.event.type]).every(type => MONEY_INDEPENDENT_EVENTS.has(type))
      && effect(trigger.effect))) return false;
    const scoring = model.endGameScoring;
    return !scoring || keysWithin(scoring, ["kind", "color", "traceType", "techType", "planetId", "scorePer", "locationType", "score", "resource", "count"])
      && Object.values(scoring).every(value => typeof value !== "number" || bounded(value))
      && ["sectorWinsByColor", "traceCount", "techCount", "distinctSignalSectors", "planetOrbitOrLand",
      "probeLocation", "unmarkedFinalRightmost", "remainingResource", "planetLandingPairs", "allOrbitOrLand"].includes(scoring.kind)
      && (scoring.kind !== "remainingResource" || ["availableData", "publicity"].includes(scoring.resource));
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const item of Object.values(value)) freeze(item);
    return Object.freeze(value);
  }

  function legalActions(composition, inspection = composition.inspect()) {
    return inspection.phase === "awaiting_input"
      ? inspection.session.decision.choices
      : composition.inputPort.enumerateActions({});
  }

  function actionSetKey(actions) {
    function ordered(value) {
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(ordered);
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
    }
    return JSON.stringify(actions.map(action => ordered({ actionId: action.actionId, actorId: action.actorId,
      stateVersion: action.stateVersion, decisionVersion: action.decisionVersion, decisionId: action.decisionId || null,
      family: action.family, phase: action.phase, target: action.target || {}, payload: action.payload || {} }))
      .sort((a, b) => a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));
  }

  // 规则身份只比较向前正式输入，不提供undo/abort。目标策略另从原生保存的移动起点
  // 重建执行意图并加入搜索控制身份；不把整份历史日志或撤销帧当成规则差异。
  // 除下述已证明例外，实体编号、数组顺序、资源、规则 RNG 与剩余队列保留。会改变合法信封的
  // authority 版本单独由 expand 校验，不能作为循环状态的差异。
  function forwardIdentity(envelope, status, boundary, stateOverride = null, stateCache = null) {
    const session = envelope.session?.session;
    const source = session?.workingState || stateOverride || JSON.parse(envelope.committedState);
    function buildState() {
    const state = { ...source, meta: { ...source.meta }, ...(source.match ? { match: { ...source.match } } : {}) };
    // 固定牌堆不从弃牌洗回；Production 仅按唯一实体ID查找/移除或读取集合。
    // UI 展示和 journal 的历史顺序不属于向前规则身份；其他数组仍保留顺序。
    if (Array.isArray(source.cards?.discardPile)) state.cards = { ...source.cards,
      discardPile: [...source.cards.discardPile].sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0) };
    // 移出游戏只按卡ID集合查重/排除抽取，没有按记录顺序执行的规则。
    // 正式状态与journal的收入顺序保留；这里只忽略集合的历史排列。
    if (Array.isArray(source.cards?.removedFromGameCardIds)) state.cards = { ...(state.cards || source.cards),
      removedFromGameCardIds: [...source.cards.removedFromGameCardIds].sort() };
    // 玩家数据标记可互换；编号/显示序号和池展示位置不进入正式选择或奖励。
    // 计算机与蓝色附加位仍按真实槽位区分，溢出数量等其余字段原样保留。
    if (Array.isArray(source.players?.players)) state.players = { ...source.players,
      players: source.players.players.map(player => {
        if (!player.dataState) return player;
        function tokenIdentity(token, pool) {
          const result = { ...token };
          delete result.id;
          delete result.index;
          if (pool) delete result.slotIndex;
          return result;
        }
        return { ...player, dataState: { ...player.dataState,
          poolTokens: player.dataState.poolTokens.map(token => tokenIdentity(token, true)),
          placedTokens: player.dataState.placedTokens.map(token => tokenIdentity(token, false))
            .sort((a, b) => (a.placementKind < b.placementKind ? -1 : a.placementKind > b.placementKind ? 1 : 0)
              || (a.placementSlot ?? a.blueSlot) - (b.placementSlot ?? b.blueSlot)),
        } };
      }),
    };
    if (source.meta?.sequences) {
      state.meta.sequences = { ...source.meta.sequences };
      delete state.meta.sequences.dataToken;
    }
    // prepareRoot 的诊断标记在第一次正式保存时消失；没有规则读取它。
    // 算法、数值状态及其他 RNG 子流仍逐字段保留。
    if (source.meta?.rngState) {
      state.meta.rngState = { ...source.meta.rngState };
      delete state.meta.rngState.branch;
    }
    delete state.meta.stateVersion;
    if (state.match) delete state.match.decisionVersion;
      return state;
    }
    const references = new Map();
    const prefix = /^effect-session-[0-9]+$/.test(session?.sessionId) ? session.sessionId : null;
    const referenceKeys = new Set(["effectId", "parentEffectId", "groupId", "quickGroupId", "decisionId", "choiceId"]);
    const referencePattern = prefix && new RegExp(`(${prefix}:(?:effect|group):[0-9]+)`, "g");
    function normalize(value, key = "") {
      if (typeof value === "string" && prefix && referenceKeys.has(key)) {
        // 引用按首次出现编号，保留相等关系；物理实体和普通文本绝不重命名。
        const parts = value.split(referencePattern);
        if (parts.length > 1) return parts.map((part, index) => {
          if (index % 2 === 0) return part;
          if (!references.has(part)) references.set(part, references.size);
          return { reference: references.get(part) };
        });
      }
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(item => normalize(item));
      const descriptor = value.schemaVersion === "seti-standard-action-v1";
      const result = Object.create(null);
      for (const name of Object.keys(value).sort()) {
        if (descriptor && ["actionId", "stateVersion", "decisionVersion"].includes(name)) continue;
        result[name] = normalize(value[name], name);
      }
      return result;
    }
    const pending = session ? {
      phase: session.phase, queue: session.queue,
      interruptContext: session.interruptContext,
      irreversibleBarrier: session.irreversibleBarrier && {
        code: session.irreversibleBarrier.code, reason: session.irreversibleBarrier.reason,
      },
      failure: session.failure,
      family: session.journal.actions[0]?.action?.family || null,
    } : null;
    // Preserve the original sorted traversal: boundary, pending, state, status.
    // Pending references are numbered first; their exact mapping is part of the cache key.
    const normalizedPending=normalize(pending);
    const key=JSON.stringify([prefix,Array.from(references)]);
    let variants=stateCache&&Object.isFrozen(source)?stateCache.get(source):null;
    let normalizedState;
    if(variants?.has(key))normalizedState=variants.get(key);
    else{
      normalizedState=normalize(buildState());
      if(stateCache&&Object.isFrozen(source)){
        if(!variants){
          if(stateCache.size>=64)stateCache.delete(stateCache.keys().next().value);
          variants=new Map();stateCache.set(source,variants);
        }
        variants.set(key,normalizedState);
      }
    }
    return JSON.stringify({boundary,pending:normalizedPending,state:normalizedState,status});
  }

  function createAnalysisPort({ composition, seatId, maxCacheEntries = 256 } = {}) {
    if (!composition?.counterfactualPort?.createFork || !composition?.counterfactualPort?.prepareRoot
      || typeof cardEffects?.getCardModel !== "function"
      || typeof seatId !== "string" || !seatId) throw new TypeError("ANALYSIS_PORT_INVALID");
    if (!Number.isSafeInteger(maxCacheEntries) || maxCacheEntries < 0) throw new TypeError("ANALYSIS_CACHE_LIMIT_INVALID");
    const viewer = Object.freeze({ playerId: seatId, role: "player" });
    let movementPlanning = false;
    let cardPickPlanning = false;
    let resourcePlanning = false, finalMarkPlanning = false, scanPlanning = false;
    let localSpecs=new WeakMap();
    let resourceSpecs = new WeakMap();
    const cardPickPlanner = cardPickPlanningApi.createCardPickPlanner();
    let cardPickRootStats = cardPickPlanner.getDiagnostics();
    let cardPickSpecs = new WeakMap();
    let envelopeCardSpecs = new WeakMap();
    let goalMovementGeometryNodes = 0;
    let openedRoot = null;
    let movementPolicies = new WeakMap();
    const movementRouteCache = new Map();
    const movementTimingCache = new Map();
    let nodes = new WeakMap();
    let observationReleasers = new WeakMap(), observationReleases = 0;
    let normalizedIdentityStates = new Map();
    const identities = new Map();
    let resourceOrders = new WeakMap();
    let knownMoneyOrders = new WeakMap();
    let openingOrders = new WeakMap();
    let openingCapacities = new WeakMap();
    let openingPlans = new WeakMap();
    let cardTradeBounds = new WeakMap();
    let passReserveBounds = new WeakMap();
    let cornerChoices = new WeakMap();
    let preMainDataPlans = new WeakMap();
    let postMainPlans = new WeakMap();
    let postMainBorrows = new WeakMap();
    let scanValueBounds = new WeakMap();
    let postMainValueBounds = new WeakMap();
    let postMainOptimalPlans = new WeakMap();
    const resourceGroups = new Map();
    let fork = null;
    let loadedEnvelope = null;
    const decodedStates = new Map();
    const maxDecodedStateCacheEntries = 64, maxDecodedStateCacheBytes = 8 * 1024 * 1024;
    let decodedStateCacheBytes = 0;
    let envelopeObservations = new WeakMap(), stateRequirements = new WeakMap(), goalCatalogs = new WeakMap();
    let observationCacheHits = 0, resourceQueryHits = 0, resourceQueryMisses = 0, goalCatalogHits = 0, goalCatalogMisses = 0;
    let committedDecodeCount = 0, committedDecodeHits = 0;
    let rootObservation = null;
    let publicSeed = null, rootTurnKey = null;
    let nodeCount = 0;
    let submissionCount = 0;
    let cacheHits = 0, stableRestoreSkips = 0, movementTimingCacheHits = 0, movementTimingCacheMisses = 0;
    let observationCount = 0;
    const cache = new Map();
    // Search-local native execution DAG. Keys use the exact immutable source node and input.
    let prefixEdges = new Map(), prefixNodes = new Map(), prefixHits = 0;
    function clearPrefixGraph(){prefixEdges=new Map();prefixNodes=new Map();prefixHits=0;}
    function expansionKey(stored,actionId){return JSON.stringify([stored.serial,actionId,movementPlanning,cardPickPlanning,resourcePlanning,finalMarkPlanning,scanPlanning]);}
    function prefixNodeId(node){if(!prefixNodes.has(node))prefixNodes.set(node,prefixNodes.size);return prefixNodes.get(node);}
    function rememberPrefix(key,node,actionId,child){
      if(resourcePlanning)prefixEdges.set(key,{id:prefixEdges.size,from:prefixNodeId(node),to:prefixNodeId(child),actionId,node:child});
      return child;
    }
    function getResourcePrefixGraph(){return freeze({
      nodes:Array.from(prefixNodes,([node,id])=>({id,status:node.status})),
      edges:Array.from(prefixEdges.values(),({node,...edge})=>edge),
    });}
    // 每席只保留最近一份完成证据；close 结束分支，不丢失下一次点击的证据。
    let selectionCertificate = null;
    let planCertificate = null;
    let nextCertificate = 0;
    const now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
    const milliseconds = { restore: 0, execute: 0, observation: 0, checkpoint: 0, resourceOrder: 0, valueBound: 0, postMainPlan: 0, preMainDataPlan: 0 };

    function project(comp) {
      const state = comp.projection(viewer).state;
      // Browser 的 resident UI 壳不属于分析输入；两种宿主只保留同源规则信息。
      const observation = {
        schemaVersion: "seti-analysis-observation-v1",
        publicState: state.publicState, selfState: state.selfState,
        terminal: state.terminal === true,
      };
      for (const key of ["probeRouteRequirements", "dataAnalyzeRequirements", "sectorWinRequirements",
        "incomeGainRequirements", "techGainRequirements"]) {
        observation[key] = state[key] || null;
      }
      return observation;
    }

    function snapshot(comp) {
      const startedAt = now();
      const saved = comp.lifecycle.save({ trustedFork: true });
      milliseconds.checkpoint += now() - startedAt;
      if (!saved.ok) throw new Error(`ANALYSIS_SAVE_FAILED: ${saved.code || saved.message}`);
      return saved.envelope;
    }

    function restoreEnvelope(envelope, forWrite = false) {
      // trusted save 会冻结当前 session。只读投影可直接复用，下一次提交必须恢复可写副本。
      if(loadedEnvelope===envelope&&(!forWrite||!envelope.session)){if(forWrite)stableRestoreSkips++;return;}
      const restoreAt = now();
      const comp = fork.composition || fork;
      const restored = comp.lifecycle.restore(envelope, {
        silent: true, inPlace: true, trustedFork: true, skipProjection: true,
        trustedState: readCommittedState(envelope),
      });
      milliseconds.restore += now() - restoreAt;
      if (!restored.ok) throw new Error(`ANALYSIS_RESTORE_FAILED: ${restored.code || restored.message}`);
      loadedEnvelope = envelope;
    }

    function observeEnvelope(envelope, barrier) {
      if (!fork) throw new Error("ANALYSIS_NODE_INVALID");
      let variants = envelopeObservations.get(envelope);
      if (variants?.has(barrier)) { observationCacheHits++; return variants.get(barrier); }
      restoreEnvelope(envelope);
      const observationAt = now();
      const observation = project(fork.composition || fork);
      const visible = barrier && ruleComposition.isHiddenInformationBarrier(barrier)
        ? ruleComposition.sanitizeHiddenInformationObservation(rootObservation, observation, barrier)
        : observation;
      observationCount += 1;
      // Native non-cheap projection already owns and freezes its complete state.
      // Sanitization creates only new wrappers over that immutable snapshot.
      const result = freeze(visible);
      milliseconds.observation += now() - observationAt;
      if (!variants) { variants = new Map(); envelopeObservations.set(envelope, variants); }
      variants.set(barrier, result);
      return result;
    }

    function createNode(envelope, observation, actions, status, barrier = null, intent = null, resourceControl = null) {
      let visible = observation && freeze(observation);
      // 搜索内部节点只用合法集与身份；首次估值/记录时才投影。getter 不暴露快照。
      const node = Object.freeze({
        get observation() {
          if (!visible) visible = observeEnvelope(envelope, barrier);
          return visible;
        },
        legalActions: freeze(structuredClone(actions)), status, boundary: barrier?.code || null,
      });
      const boundary = barrier?.code || null;
      if (movementPlanning && !intent) intent = recoverMovementIntent(envelope);
      const physicalKey = forwardIdentity(envelope, status, boundary, readIdentityState(envelope), normalizedIdentityStates);
      const movementKey = intent ? JSON.stringify([physicalKey, intent]) : physicalKey;
      const pick = cardPickPlanning && status === "decision" && actions.length ? describeCardPick(envelope,actions,status) : null;
      const cardControl = pick?.fixed ? {goal:pick.goal,selection:pick.selection&&{cardId:pick.selection.cardId,blind:pick.selection.blind},discardIds:pick.discardIds} : null;
      const cardKey = cardControl ? JSON.stringify([movementKey,cardControl]) : movementKey;
      const key = resourceControl ? JSON.stringify([cardKey,resourceControl]) : cardKey;
      if (!identities.has(key)) identities.set(key, Object.freeze({}));
      observationReleasers.set(node, () => { visible = null; envelopeObservations.delete(envelope); observationReleases++; });
      nodes.set(node, { envelope, serial: nodeCount, identity: identities.get(key), key, policyKey: cardKey, physicalKey, intent, cardControl, resourceControl });
      nodeCount += 1;
      return node;
    }

    // 正式回合预览只写 turn；其他规则切片继续共享冻结快照，越界写入会显式失败。
    function previewTurn(state, options = {}) {
      return turnFlow.advanceTurnAfterPlayerAction({ ...state, turn: structuredClone(state.turn) }, seatId, options);
    }

    function readIdentityState(envelope) {
      if (envelope.session?.session) return envelope.session.session.workingState;
      return readCommittedState(envelope);
    }

    function readCommittedState(envelope) {
      // Exact serialized bytes only; pending working copies remain separate and writable.
      const key = envelope.committedState;
      if (decodedStates.has(key)) {
        const result = decodedStates.get(key);
        decodedStates.delete(key); decodedStates.set(key, result);
        committedDecodeHits++;
        return result;
      }
      committedDecodeCount++;
      const result = freeze(JSON.parse(key)), bytes = key.length * 2;
      if (bytes <= maxDecodedStateCacheBytes) {
        while (decodedStates.size && (decodedStates.size >= maxDecodedStateCacheEntries || decodedStateCacheBytes + bytes > maxDecodedStateCacheBytes)) {
          const oldest = decodedStates.keys().next().value;
          decodedStates.delete(oldest); decodedStateCacheBytes -= oldest.length * 2;
        }
        decodedStates.set(key, result); decodedStateCacheBytes += bytes;
      }
      return result;
    }

    function openRoot() {
      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");
      clearPrefixGraph();
      goalMovementGeometryNodes = 0;
      cardPickRootStats = cardPickPlanner.getDiagnostics();
      nodeCount = 0;
      submissionCount = 0;
      cacheHits = 0;stableRestoreSkips=0;movementTimingCacheHits=0;movementTimingCacheMisses=0;
      observationCount = 0; observationReleases = 0;
      committedDecodeCount = 0; committedDecodeHits = 0;
      observationCacheHits = 0; resourceQueryHits = 0; resourceQueryMisses = 0; goalCatalogHits = 0; goalCatalogMisses = 0;
      for (const key of Object.keys(milliseconds)) milliseconds[key] = 0;
      rootObservation = project(composition);
      const actions = legalActions(composition);
      if (!actions.length || actions.some(action => action.actorId !== seatId)) {
        throw new Error("ANALYSIS_ROOT_OWNER_MISMATCH");
      }
      // 同一回合的已知输入不重抽未知世界；恢复仅依赖正式公开配置和回合身份。
      // 完整节点身份仍包括假设/RNG，不能因种子稳定而忽略实际依赖变化。
      const authoritative = snapshot(composition);
      const state = authoritative.session?.session?.workingState || JSON.parse(authoritative.committedState);
      rootTurnKey = JSON.stringify([state.turn.roundNumber,state.turn.turnNumber,state.turn.actionCycleNumber]);
      publicSeed = JSON.stringify(["seti-turn-hypothesis-v1", state.meta.seed, state.meta.gameId, seatId,
        state.turn.roundNumber, state.turn.turnNumber, state.turn.actionCycleNumber, state.turn.activePlayerIds]);
      const rootEnvelope = composition.counterfactualPort.prepareRoot(authoritative, {
        publicSeed, restoreRandomState: true,
      });
      fork = composition.counterfactualPort.createFork(rootEnvelope, {
        branchKey: publicSeed, restoreRandomState: true,
      });
      loadedEnvelope = rootEnvelope;
      openedRoot = createNode(rootEnvelope, rootObservation, actions,
        composition.inspect().phase === "awaiting_input" ? "decision" : "stable");
      return openedRoot;
    }

    function expand(node, actionId) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (["information-barrier", "other-owner", "terminal", "plan-infeasible","turn-boundary"].includes(node.status)) {
        throw new Error(`ANALYSIS_BOUNDARY_CLOSED: ${node.status}`);
      }
      const requested = node.legalActions.find(action => action.actionId === actionId);
      if (!requested || requested.actorId !== seatId) throw new Error("ANALYSIS_ACTION_NOT_LEGAL");
      // serial 只在本端口生命周期内绑定这一不可变快照；不按观察摘要跨节点复用。
      const key = expansionKey(stored,actionId);
      if(resourcePlanning&&prefixEdges.has(key)){prefixHits++;return prefixEdges.get(key).node;}
      if (cache.has(key)) {
        cacheHits += 1;
        return rememberPrefix(key,node,actionId,cache.get(key));
      }
      restoreEnvelope(stored.envelope, true);
      const { before, result } = executeCurrent(actionId);
      return rememberPrefix(key,node,actionId,remember(key, finishChild(before, result, movementPlanning ? nextMovementIntent(node, requested) : null, stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null)));
    }

    function setMovementPlanning(enabled) {
      movementPlanning = enabled === true;
      if (movementPlanning && openedRoot) {
        const stored = nodes.get(openedRoot);
        if (!stored.intent) {
          stored.intent = recoverMovementIntent(stored.envelope);
          if (stored.intent) {
            stored.key = JSON.stringify([stored.physicalKey, stored.intent]); stored.policyKey = stored.key;
            if (!identities.has(stored.key)) identities.set(stored.key, Object.freeze({}));
            stored.identity = identities.get(stored.key);
          }
        }
      }
    }

    function describeCardPick(envelope,actions,status) {
      if (envelopeCardSpecs.has(envelope)) return envelopeCardSpecs.get(envelope);
      const state=readIdentityState(envelope);
      const result=cardPickPlanner.plan({state,seatId,actions,status,session:envelope.session?.session,
        endpoints:(candidateState=state)=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(candidateState,seatId)?.candidates||[]});
      const frozen=result&&freeze(result);envelopeCardSpecs.set(envelope,frozen);return frozen;
    }

    function cardPickSpec(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!cardPickPlanning||!["stable","decision"].includes(node.status)||!node.legalActions.length)return null;
      if(cardPickSpecs.has(node))return cardPickSpecs.get(node);
      const result=describeCardPick(stored.envelope,node.legalActions,node.status);cardPickSpecs.set(node,result);return result;
    }

    function setCardPickPlanning(enabled) {
      cardPickPlanning=enabled===true;
      if(cardPickPlanning&&openedRoot){
        const stored=nodes.get(openedRoot),pick=cardPickSpec(openedRoot);
        if(pick?.fixed&&!stored.cardControl){
          stored.cardControl={goal:pick.goal,selection:pick.selection&&{cardId:pick.selection.cardId,blind:pick.selection.blind},discardIds:pick.discardIds};
          stored.key=JSON.stringify([stored.key,stored.cardControl]);stored.policyKey=stored.key;
          if(!identities.has(stored.key))identities.set(stored.key,Object.freeze({}));stored.identity=identities.get(stored.key);
        }
      }
    }

    function expandWithCardPick(node,actionId,hasCapacity) {
      const prefixes=[],fixedChoices=[];let current=node,next=actionId;
      while(next){
        const stopped=hasCapacity(prefixes.length);
        if(stopped)return{complete:false,stopReason:stopped,node:current,submissions:prefixes.length,prefixes,fixedChoices};
        const action=current.legalActions.find(a=>a.actionId===next);if(!action)throw new Error("ANALYSIS_FIXED_CARD_ACTION_STALE");
        const spec=cardPickSpec(current)?.fixed?cardPickSpec(current):localDecisionSpec(current);
        if(spec?.fixed||spec?.selectedActionId)fixedChoices.push({prefix:prefixes.length,...spec});
        prefixes.push({node:current,action});current=expand(current,next);
        const following=cardPickSpec(current)?.fixed?cardPickSpec(current):localDecisionSpec(current);
        next=following?.fixed||following?.selectedActionId?following.selectedActionId:null;
      }
      return{complete:true,node:current,submissions:prefixes.length,prefixes,fixedChoices};
    }

    function setResourcePlanning(enabled) { resourcePlanning=enabled===true;localSpecs=new WeakMap();clearPrefixGraph(); }

    function setDecisionPlanning(options={}){finalMarkPlanning=options.finalMarkPlanning===true;scanPlanning=options.scanPlanning===true;localSpecs=new WeakMap();resourceSpecs=new WeakMap();}
    function localDecisionSpec(node){
      if((!finalMarkPlanning&&!resourcePlanning)||node.status!=="decision")return null;
      if(localSpecs.has(node))return localSpecs.get(node);
      const stored=nodes.get(node),state=readIdentityState(stored.envelope);
      let result=finalMarkPlanning?localPlans.finalMark({state,seatId,actions:node.legalActions}):null;
      if(!result&&resourcePlanning)result=localPlans.reorganization({state,seatId,actions:node.legalActions,session:stored.envelope.session?.session})||localPlans.passDiscard({state,seatId,actions:node.legalActions,goal:stored.resourceControl?.goal})||localPlans.blueResearch({state,seatId,actions:node.legalActions})||localPlans.pureOptional({state,seatId,actions:node.legalActions,session:stored.envelope.session?.session});
      if(!result&&resourcePlanning){
        const fixed=resourceDemand.paidChoice({state,seatId,actions:node.legalActions,session:stored.envelope.session?.session})
          ||resourceDemand.fixedDataChoice({state,seatId,actions:node.legalActions,goal:stored.resourceControl?.goal});
        if(fixed)result={policy:fixed.reason==="fixed-positive-paid-repeat"?"seti-greedy-paid-budget-v1":"seti-greedy-data-execution-v1",kind:fixed.reason==="fixed-positive-paid-repeat"?"fixed-paid-repeat":"fixed-data-choice",fixed:true,isEquivalence:false,
          selectedActionId:fixed.actionId,retainedActionIds:[fixed.actionId],excludedActionIds:node.legalActions.filter(a=>a.actionId!==fixed.actionId).map(a=>a.actionId),reason:fixed.reason,...(fixed.netGain!==undefined?{netGain:fixed.netGain}:{})};
      }
      const spec=result&&freeze(result);localSpecs.set(node,spec);return spec;
    }

    function resourceQuery(state) {
      if (stateRequirements.has(state)) { resourceQueryHits++; return stateRequirements.get(state); }
      resourceQueryMisses++;
      const result = freeze((productionKernel||globalThis.SetiProductionKernel).getResourceGoalRequirements(state,seatId));
      stateRequirements.set(state,result); return result;
    }

    function resourceCatalog(state, actions) {
      let variants = goalCatalogs.get(state);
      const key = actionSetKey(actions);
      if (variants?.has(key)) { goalCatalogHits++; return variants.get(key); }
      goalCatalogMisses++;
      const result = freeze(resourceDemand.catalog({state,seatId,requirements:resourceQuery(state),actions}));
      if (!variants) { variants = new Map(); goalCatalogs.set(state,variants); }
      variants.set(key,result); return result;
    }

    function resourceStep(node,goal,operation={}) {
      const stored=nodes.get(node),state=readIdentityState(stored.envelope),session=stored.envelope.session?.session;
      const local=localDecisionSpec(node);if(["fixed-final-mark","fixed-paid-repeat","fixed-positive-optional","fixed-pass-discard","fixed-reorganization"].includes(local?.kind))return{kind:"fixed",actionId:local.selectedActionId,reason:local.kind};
      if(goal.kind==="effect-purpose"&&operation.targetStarted){
        if(node.status==="stable")return{kind:"complete",reason:"purpose-effect-completed"};
        const fixed=local?.selectedActionId?{kind:"fixed",actionId:local.selectedActionId,reason:local.kind}:null;
        if(fixed)return fixed;
        const income=resourceDemand.incomeChoice({state,seatId,goal:{...goal,required:{}},actions:node.legalActions});if(income)return income;
        return{kind:"fallback",reason:"purpose-effect-native-choice",actionIds:local?.retainedActionIds||node.legalActions.map(a=>a.actionId)};
      }
      if(goal.kind==="scan-flow"){
        const dataStep=resourceDemand.fixedDataChoice({state,seatId,goal,actions:node.legalActions});
        if(node.status==="decision"&&dataStep)return dataStep;
        const source=session?.journal?.actions?.[0]?.action;
        if(node.status==="stable"&&!state.players.players.find(p=>p.id===seatId).mainActionCompleted&&Object.values(resourceDemand.needs(state,seatId,goal)).some(v=>v>0)
          ||node.status==="decision"&&(resourceDemand.isPreparation(source||{})))
          return resourceDemand.step({state,seatId,goal:{...goal,kind:"scan"},actions:node.legalActions,status:node.status,session,operation});
        if(node.status==="decision"&&node.legalActions.some(a=>goalMovement.isDirection(a)||a.target?.kind==="move-payment")){
          const route=goalMovementSpec(node);if(route?.selectedActionId)return{kind:"fixed",actionId:route.selectedActionId,reason:"fixed-movement-in-scan"};
          if(route?.retainedActionIds?.length===1)return{kind:"fixed",actionId:route.retainedActionIds[0],reason:"fixed-movement-in-scan"};
        }
        return localPlans.scanStep({state,seatId,goal,actions:node.legalActions,status:node.status,session});
      }
      return resourceDemand.step({state,seatId,goal,actions:node.legalActions,status:node.status,session,operation});
    }

    function resourceSpec(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!resourcePlanning||!["stable","decision"].includes(node.status)||!node.legalActions.length)return null;
      if(resourceSpecs.has(node))return resourceSpecs.get(node);
      if(cardPickSpec(node)?.fixed){resourceSpecs.set(node,null);return null;}
      const envelope=stored.envelope,state=readIdentityState(envelope),session=envelope.session?.session;
      let goals=[],source=null,operation={},incomeTail=null;
      if(stored.resourceControl){
        const control=stored.resourceControl,step=resourceStep(node,control.goal,control.operation);
        const ids=step.kind==="fallback"?step.actionIds:step.actionId?[step.actionId]:[];
        if(step.kind==="complete"){resourceSpecs.set(node,null);return null;}
        const result=freeze({policy:resourceDemand.VERSION,isEquivalence:false,bound:true,goal:control.goal,operation:control.operation,step,
          retainedActionIds:[],excludedActionIds:node.legalActions.map(a=>a.actionId),plans:ids.map(id=>({id:control.goal.id+":"+id,goal:control.goal,operation:control.operation,firstActionId:id,mode:step.kind==="fallback"?"search-fallback":"greedy",fallbackReason:step.kind==="fallback"?step.reason:null}))});
        resourceSpecs.set(node,result);return result;
      }
      if(node.status==="stable"){
        goals=resourceCatalog(state,node.legalActions);
      }else{
        source=session?.journal?.actions?.[0]?.action;
        if(session?.baseState&&(resourceDemand.isPreparation(source||{})||source?.family==="move")){
          goals=resourceCatalog(session.baseState,[source])
            .filter(goal=>{
              const first=resourceDemand.step({state:session.baseState,seatId,goal,actions:[source],status:"stable"});
              return first.actionId===source.actionId||first.kind==="fallback"&&first.actionIds.includes(source.actionId);
            });
          operation={placing:source.family==="place_data",finalPlacement:false};
        }
      }
      if(state.players.players.find(p=>p.id===seatId).mainActionCompleted){
        const goal=goals.find(g=>g.kind==="income");
        if(goal){incomeTail=localPlans.incomeCompletion({state:node.status==="decision"&&session?.baseState?session.baseState:state,seatId,goal});
          goals=goals.filter(g=>g.kind!=="income"||incomeTail.selected);
        }
      }
      if(scanPlanning){
        const purposeState=node.status==="decision"&&resourceDemand.isPreparation(source||{})?session.baseState:state;
        const build=required=>localPlans.scanGoals({state:purposeState,seatId,actions:node.legalActions,session:node.status==="decision"&&!resourceDemand.isPreparation(source||{})?session:null,required});
        const needed=goals.some(g=>g.kind==="scan");goals=goals.flatMap(g=>g.kind==="scan"?build(g.required):[g]);
        if(!needed&&(node.status==="stable"&&node.legalActions.some(a=>a.family==="scan")||node.status==="decision"&&localPlans.scanDecision(node.legalActions)))goals.push(...build(node.status==="stable"?scanEffects.getStandardScanCost(state.players.players.find(p=>p.id===seatId)):{}));
      }
      const plans=[];
      for(const goal of goals){
        const op={...operation,finalPlacement:source?.family==="place_data"&&goal.kind==="blue-data"};
        const step=resourceStep(node,goal,op);
        if(step.actionId)plans.push({id:goal.id,goal,operation:op,firstActionId:step.actionId,mode:"greedy",reason:step.reason});
        else if(step.kind==="fallback")for(const id of step.actionIds)plans.push({id:goal.id+":"+id,goal,operation:op,firstActionId:id,mode:"search-fallback",fallbackReason:step.reason});
      }
      if(node.status==="decision"&&!plans.length){
        const pending=session?.queue?.[0]?.payload?.decisionContext;
        if(pending?.kind==="discard"&&resourceDemand.MONEY.has(pending.tradeId)){
          const goal={id:"committed-resource-payment:"+pending.tradeId,kind:"committed-payment",required:{}},op={committedPayment:true};
          const step=resourceStep(node,goal,op);
          if(step.actionId)plans.push({id:goal.id,goal,operation:op,firstActionId:step.actionId,mode:"greedy",reason:step.reason});
          else if(step.kind==="fallback")for(const id of step.actionIds)plans.push({id:goal.id+":"+id,goal,operation:op,firstActionId:id,mode:"search-fallback",fallbackReason:step.reason});
        }
      }
      const owner=state.players.players.find(p=>p.id===seatId);
      const excluded=node.status==="stable"?node.legalActions.filter(a=>a.family==="industry"&&a.target?.abilityId==="turing_borrow_tech"||plans.some(p=>p.goal.kind==="effect-purpose"&&p.firstActionId===a.actionId)||a.family==="play_card"&&plans.some(p=>p.goal.cardId===a.target.cardInstanceId&&p.goal.paidRewardPolicy)||resourceDemand.isPreparation(a)||scanPlanning&&plans.some(p=>p.goal.kind==="scan-flow")&&a.family==="scan"||!owner.mainActionCompleted&&["orbit","land","research_tech",...(plans.some(p=>p.goal.kind==="route")?["move"]:[])].includes(a.family)):plans.length?node.legalActions:[];
      const forceIncome=node.status==="stable"&&incomeTail?.selected&&plans.some(p=>p.goal.kind==="income");
      const result=freeze({policy:resourceDemand.VERSION,isEquivalence:false,plans:forceIncome?plans.filter(p=>p.goal.kind==="income"):plans,
        ...(incomeTail?{incomeTail}:{}),
        retainedActionIds:forceIncome?[]:node.legalActions.filter(a=>!excluded.includes(a)).map(a=>a.actionId),excludedActionIds:forceIncome?node.legalActions.map(a=>a.actionId):excluded.map(a=>a.actionId)});
      resourceSpecs.set(node,result);return result;
    }

    function resourceView(node,control) {
      const stored=nodes.get(node);
      return createNode(stored.envelope,null,node.legalActions,node.status,null,stored.intent,control);
    }

    function expandResourcePlan(node,plan,hasCapacity) {
      const prefixes=[],preparations=[],sharedPath=[],sharedStates=[];let newSubmissions=0;
      let current=node,operation={...plan.operation},contexts=0,forced=plan.firstActionId,targetReached=false;
      const work=(extra={})=>({newSubmissions,sharedStates,...extra});
      const finish=(extra={})=>({complete:true,node:current,submissions:prefixes.length,prefixes,contexts,preparations,goal:plan.goal,sharedPath,sharedStates,newSubmissions,...extra});
      function stop(reason){return{...finish(),complete:false,stopReason:reason};}
      function bind(reason,operationNext){
        const blocked=hasCapacity(prefixes.length,contexts+1,false,work({additionalStates:1}));if(blocked)return stop(blocked);
        current=resourceView(current,{goal:plan.goal,operation:operationNext});sharedStates.push(current);contexts++;
        return finish({fallbackReason:reason});
      }
      function invalid(reason){
        const stored=nodes.get(current),blocked=hasCapacity(prefixes.length,contexts+1,false,work({additionalStates:1}));if(blocked)return stop(blocked);
        current=createNode(stored.envelope,null,[],"plan-infeasible",null,stored.intent);sharedStates.push(current);contexts++;
        return finish({goalStatus:"infeasible",reason});
      }
      while(true){
        if(["other-owner","information-barrier","terminal","turn-boundary"].includes(current.status))return finish({goalStatus:"boundary"});
        const spec=cardPickSpec(current),tail=targetReached?localDecisionSpec(current):null;
        if(targetReached&&!spec?.fixed&&!tail?.selectedActionId)return finish({goalStatus:"completed"});
        const step=spec?.fixed?{kind:"fixed",actionId:spec.selectedActionId,reason:"fixed-card-in-resource-plan"}
          :tail?.selectedActionId?{kind:"fixed",actionId:tail.selectedActionId,reason:tail.reason||tail.kind}:resourceStep(current,plan.goal,operation);
        if(step.kind==="complete"){
          if(nodes.get(current).resourceControl){const blocked=hasCapacity(prefixes.length,contexts+1,false,work({additionalStates:1}));if(blocked)return stop(blocked);current=resourceView(current,null);sharedStates.push(current);contexts++;}
          return finish({goalStatus:"completed"});
        }
        if(step.kind==="infeasible")return invalid(step.reason);
        if(step.kind==="fallback"&&!forced)return bind(step.reason,operation);
        const id=forced||step.actionId,action=current.legalActions.find(a=>a.actionId===id);
        if(!action)throw new Error("RESOURCE_PLAN_ACTION_NOT_LEGAL");
        const chosen=step.kind==="fallback"?step.candidates?.find(c=>c.actionId===id)||{}:step;
        const key=expansionKey(nodes.get(current),id),shared=resourcePlanning?prefixEdges.get(key):null;
        const next=shared?.node||cache.get(key)||null;
        const blocked=hasCapacity(prefixes.length,contexts,true,work({nextNode:next,nextNewInput:shared?0:1,additionalStates:next?0:1}));if(blocked)return stop(blocked);
        preparations.push({input:prefixes.length,reason:step.reason,goalId:plan.goal.id,demand:resourceDemand.needs(readIdentityState(nodes.get(current).envelope),seatId,plan.goal),actionId:id});
        // Discard identities belong to one native action, not the whole resource goal.
        operation={...operation,...(current.status==="stable"?{discardIds:null}:{}),...(chosen.discardIds?{discardIds:chosen.discardIds}:{}),...(chosen.placing!==undefined?{placing:chosen.placing}:{}),...(chosen.finalPlacement!==undefined?{finalPlacement:chosen.finalPlacement}:{}),...(step.kind==="start-target"?{targetStarted:true}:{})};
        prefixes.push({node:current,action});current=expand(current,id);forced=null;
        sharedStates.push(current);if(!shared)newSubmissions++;
        if(resourcePlanning)sharedPath.push(prefixEdges.get(key).id);
        if(step.kind==="target"){
          if(nodes.get(current).resourceControl){const stopped=hasCapacity(prefixes.length,contexts+1,false,work({additionalStates:1}));if(stopped)return stop(stopped);current=resourceView(current,null);sharedStates.push(current);contexts++;}
          targetReached=true;
        }
        if(step.kind==="start-target"&&current.status!=="decision")targetReached=true;
        if(operation.committedPayment&&nodes.get(current).envelope.session?.session?.queue?.[0]?.payload?.decisionContext?.kind!=="discard")return finish({goalStatus:"committed-payment-completed"});
      }
    }

    function movementTiming(state, id, path, freePoints) {
      const native = productionKernel || globalThis.SetiProductionKernel;
      const key = native.plannedMovementTimingKey(state,seatId,id,path,freePoints);
      if (movementTimingCache.has(key)) { movementTimingCacheHits++; return movementTimingCache.get(key); }
      movementTimingCacheMisses++;
      const result = native.comparePlannedMovementTiming(state,seatId,id,path,freePoints);
      if (movementTimingCache.size >= 64) movementTimingCache.delete(movementTimingCache.keys().next().value);
      movementTimingCache.set(key,result);
      return result;
    }

    function recoverMovementIntent(envelope) {
      const session = envelope.session?.session, head = session?.queue?.[0], effect = head?.payload?.cardEffect;
      const source = session?.journal?.actions?.[0]?.action;
      if (source?.family === "move" && session.baseState) {
        const state = session.baseState;
        const selected = goalMovement.plan({state,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          compareTiming:(id,path,free)=>movementTiming(state,id,path,free),
          endpoints:()=> (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(state,seatId)?.candidates || []});
        goalMovementGeometryNodes += selected?.routingNodes || 0;
        const intent = selected?.intent, first = intent?.path[0];
        if (first && source.target.rocketId === intent.rocketId && source.target.deltaX === first.deltaX && source.target.deltaY === first.deltaY) return intent;
      }
      if (!effect || !session.undoFrames?.length || !(goalMovement.movementAllowance(head, session.workingState) > 0)) return null;
      const frame = session.undoFrames.find(frame => {
        const first = frame.queueBefore?.[0];
        return first?.ownerId === seatId && first.payload?.cardInstanceId === head.payload.cardInstanceId
          && first.payload?.cardEffect?.id === effect.id && goalMovement.movementAllowance(first, frame.stateBefore) > 0;
      });
      if (!frame) return null;
      const anchor = frame.queueBefore[0];
      const selected = goalMovement.plan({ state: frame.stateBefore, seatId, actions: [], status: "decision",
        session: { queue: [anchor] }, objectiveOnly: true, routeCache: movementRouteCache,
        compareTiming: (id,path,free) => movementTiming(frame.stateBefore,id,path,free),
        endpoints: () => (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(frame.stateBefore, seatId, anchor)?.candidates || [] });
      goalMovementGeometryNodes += selected?.routingNodes || 0;
      const intent = selected?.intent, ship = intent && session.workingState.pieces.rockets.find(r => r.id === intent.rocketId);
      const at = ship && rockets.getRocketSectorCoordinate(ship);
      if (!at || !intent) return null;
      if (at.x === intent.goal.coordinate.x && at.y === intent.goal.coordinate.y) return { ...intent, path: [] };
      const index = intent.path.findIndex(step => step.from.x === at.x && step.from.y === at.y);
      return index < 0 ? null : { ...intent, path: intent.path.slice(index) };
    }

    function goalMovementSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (movementPolicies.has(node)) return movementPolicies.get(node);
      const result = goalMovement.plan({ state: readIdentityState(stored.envelope), seatId,
        actions: node.legalActions, status: node.status, session: stored.envelope.session?.session,
        intent: stored.intent, routeCache: movementRouteCache,
        compareTiming: (id,path,free) => movementTiming(readIdentityState(stored.envelope),id,path,free), endpoints: () => (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(readIdentityState(stored.envelope), seatId, stored.envelope.session?.session?.queue?.[0])?.candidates || [] });
      goalMovementGeometryNodes += result?.routingNodes || 0;
      const frozen = result && freeze(result);
      movementPolicies.set(node, frozen);
      return frozen;
    }

    function nextMovementIntent(node, action) {
      const stored = nodes.get(node), spec = movementPolicies.get(node);
      if (spec?.selectedActionId === action.actionId && goalMovement.isDirection(action)) return spec.intent;
      if (spec?.selectedActionId === action.actionId && (action.target?.skip || action.target?.mode === "skip") || ["end_turn", "pass", "play_card", "scan", "analyze",
        "research_tech", "orbit", "land"].includes(action.family)
        || action.family === "card_corner" && action.payload?.kind === "move"
        || action.target?.tradeId === "energy-for-move") return null;
      return stored.intent;
    }

    function expandGoalMovementPlan(node, hasTime = () => true) {
      const spec = goalMovementSpec(node);
      if (!spec?.intent?.path.length || !spec.selectedActionId) throw new Error("ANALYSIS_GOAL_ROUTE_MISSING");
      const goal = spec.chosenGoal, prefixes = [];
      let current = node, endpointStarted = false, goalStatus = "route-in-progress";
      const maxInputs = spec.intent.path.length*2+3;
      function submit(action) {
        if (!hasTime()) return false;
        prefixes.push({ node: current, action });
        current = expand(current, action.actionId);
        return true;
      }
      function infeasible(reason) {
        const stored = nodes.get(current);
        current = createNode(stored.envelope, null, [], "plan-infeasible", null, stored.intent);
        goalStatus = reason;
      }
      while (prefixes.length < maxInputs) {
        if (["terminal", "other-owner", "information-barrier","turn-boundary"].includes(current.status)) { goalStatus = "boundary"; break; }
        if (spec.intent.prefixOnly && prefixes.length && current.status === "stable") { goalStatus = "preparation-step-completed"; break; }
        const stored = nodes.get(current), intent = current === node ? spec.intent : stored.intent;
        const state = readIdentityState(stored.envelope), owner = state.players.players.find(p => p.id === seatId);
        const ship = state.pieces.rockets.find(r => r.id === spec.intent.rocketId), at = ship && rockets.getRocketSectorCoordinate(ship);
        const reached = at?.x === goal.coordinate.x && at?.y === goal.coordinate.y;
        const direction = current.legalActions.filter(goalMovement.isDirection);
        if (current.status === "decision" && direction.length) {
          const policy = goalMovementSpec(current);
          const action = current.legalActions.find(a => a.actionId === policy?.selectedActionId);
          if (!action || policy.chosenGoal?.id !== goal.id) { infeasible("route-invalidated"); break; }
          if (!submit(action)) return { complete: false, node: current, submissions: prefixes.length, prefixes, goal };
          continue;
        }
        if (current.status === "decision") {
          const payment = current.legalActions.filter(a => a.family === "choose_payment" && a.target?.kind === "move-payment");
          if (payment.length) {
            const reserve = goal.timing === "current-turn" ? goal.endpointCost?.energy || 0 : 0;
            const choices = payment.filter(a => owner.resources.energy-(a.payload.energyCost||0) >= reserve)
              .sort((a,b) => (a.target.cardIds?.length||0)-(b.target.cardIds?.length||0) || (a.actionId<b.actionId?-1:1));
            if (!choices.length) { infeasible("goal-payment-unavailable"); break; }
            if (!submit(choices[0])) return { complete: false, node: current, submissions: prefixes.length, prefixes, goal };
            continue;
          }
          if (endpointStarted) {
            const target = goal.endpointTarget || {};
            const choice = current.legalActions.find(a => a.target?.rocketId === spec.intent.rocketId && a.target?.planetId === goal.planetId
              && (goal.kind !== "land" || a.target.landTarget?.type === target.type
                && a.target.landTarget?.satelliteId === target.satelliteId));
            if (choice) {
              if (!submit(choice)) return { complete: false, node: current, submissions: prefixes.length, prefixes, goal };
              goalStatus = "goal-completed"; break;
            }
          }
          goalStatus = "awaiting-rule-decision"; break;
        }
        if (!reached && !intent?.path.length) { infeasible("goal-route-missing"); break; }
        if (!reached) {
          const policy = goalMovementSpec(current), action = current.legalActions.find(a => a.actionId === policy?.selectedActionId);
          if (!action || policy.chosenGoal?.id !== goal.id) { infeasible("goal-route-unavailable"); break; }
          if (!submit(action)) return { complete: false, node: current, submissions: prefixes.length, prefixes, goal };
          continue;
        }
        if (goal.timing === "current-turn" && ["orbit","land"].includes(goal.kind) && !owner.mainActionCompleted) {
          const action = current.legalActions.find(a => a.family === goal.kind
            && (a.target.rocketId == null || a.target.rocketId === spec.intent.rocketId)
            && (a.target.planetId == null || a.target.planetId === goal.planetId));
          if (!action) { infeasible("goal-endpoint-unavailable"); break; }
          endpointStarted = true;
          if (!submit(action)) return { complete: false, node: current, submissions: prefixes.length, prefixes, goal };
          goalStatus = "goal-completed";
          if (current.status !== "decision") break;
          continue;
        }
        goalStatus = goal.timing === "advance-before-rotation" ? "required-prefix-completed" : "goal-completed";
        break;
      }
      return { complete: true, node: current, submissions: prefixes.length, prefixes, goal, goalStatus };
    }

    function executeCurrent(actionId) {
      const comp = fork.composition || fork;
      const before = comp.inspect();
      const current = legalActions(comp, before).find(action => action.actionId === actionId);
      if (!current || current.actorId !== seatId) throw new Error("ANALYSIS_ACTION_STALE");
      loadedEnvelope = null;
      const executeAt = now();
      const result = before.phase === "awaiting_input"
        ? comp.inputPort.submitDecision({
          decisionId: before.session.decision.decisionId,
          decisionVersion: before.session.decision.decisionVersion,
          ownerId: before.session.decision.ownerId, choice: current,
        }, { skipProjection: true })
        : current.phase === "quick" ? comp.inputPort.submitQuickAction(current, { skipProjection: true })
          : comp.inputPort.submitAction(current, { skipProjection: true });
      milliseconds.execute += now() - executeAt;
      if (!result?.ok) {
        const failure = result?.failure || result;
        throw new Error(`ANALYSIS_EXECUTION_FAILED: ${failure?.code || failure?.message || "unknown"}`);
      }
      submissionCount += 1;
      return { before, result };
    }

    function finishChild(before, result, intent = null, resourceControl = null) {
      const comp = fork.composition || fork;
      const inspection = comp.inspect();
      const barrier = result.irreversibleBarrier || inspection.session?.irreversibleBarrier;
      const newBarrier = ruleComposition.isHiddenInformationBarrier(barrier)
        && JSON.stringify(barrier) !== JSON.stringify(before.session?.irreversibleBarrier);
      const actions = newBarrier ? [] : legalActions(comp, inspection);
      const envelope = snapshot(comp);
      loadedEnvelope = envelope;
      const observation = !newBarrier && !actions.length ? observeEnvelope(envelope) : null;
      if (observation && observation.terminal !== true) {
        throw new Error("ANALYSIS_EMPTY_NONTERMINAL");
      }
      const childState = readIdentityState(envelope);
      const turnChanged = JSON.stringify([childState.turn.roundNumber,childState.turn.turnNumber,childState.turn.actionCycleNumber]) !== rootTurnKey;
      const status = newBarrier ? "information-barrier"
        : actions.some(action => action.actorId !== seatId) ? "other-owner"
          : !actions.length ? "terminal"
            : turnChanged ? "turn-boundary"
              : inspection.phase === "awaiting_input" ? "decision" : "stable";
      if (intent) {
        const state = readIdentityState(envelope), ship = state.pieces.rockets.find(r => r.id === intent.rocketId);
        const at = ship && rockets.getRocketSectorCoordinate(ship), step = intent.path[0];
        if (intent.prefixOnly && status === "stable" || ["other-owner", "terminal", "information-barrier","turn-boundary"].includes(status)
          || state.turn.turnNumber !== intent.startedTurn || state.turn.roundNumber !== intent.startedRound) intent = null;
        else if (step && at?.x === step.to.x && at?.y === step.to.y) intent = { ...intent, path: intent.path.slice(1) };
        else if (step && (at?.x !== step.from.x || at?.y !== step.from.y)) intent = null;
      }
      const child = createNode(envelope, observation,
        ["other-owner", "terminal", "turn-boundary"].includes(status) ? [] : actions, status,
        newBarrier ? barrier : status === "turn-boundary" ? {code:"own-turn-complete"} : null, intent, ["other-owner","terminal","information-barrier","turn-boundary"].includes(status)?null:resourceControl);
      return child;
    }

    function remember(key, child) {
      if (maxCacheEntries) {
        if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
        cache.set(key, child);
      }
      return child;
    }

    function selectionSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (node.status !== "decision" || cardPickPlanning && cardPickSpec(node)?.fixed || resourcePlanning && (resourceSpec(node)?.bound||resourceSpec(node)?.plans.length)) return null;
      const session = stored.envelope.session?.session;
      const effect = session?.queue?.[0];
      const pending = effect?.payload?.decisionContext;
      if (effect?.type !== "standard_action_session_decision" || effect.allowQuickActions
        || effect.ownerId !== seatId || pending?.kind !== "discard" || pending.type !== "trade"
        || pending.required !== true || pending.count !== 2
        || !["cards-for-credit", "cards-for-energy", "cards-for-pick-card"].includes(pending.tradeId)) return null;
      const cards = node.legalActions.filter(action => action.target?.kind === "discard-hand-card");
      if (cards.some(action => action.family !== "choose_payment" || action.actorId !== seatId)
        || node.legalActions.some(action => action.target?.kind !== "discard-hand-card" && !action.target?.confirm)) return null;
      const cardIds = cards.map(action => action.target.cardInstanceId);
      const selectedIds = pending.selected;
      if (cardIds.some(id => typeof id !== "string" || !id)
        || !Array.isArray(selectedIds) || new Set(cardIds).size !== cardIds.length
        || new Set(selectedIds).size !== selectedIds.length || selectedIds.length > pending.count
        || selectedIds.some(id => !cardIds.includes(id)) || pending.count > cardIds.length) return null;
      const owner = session.workingState.players.players.find(player => player.id === seatId);
      const observes = type => (owner?.reservedCards || []).some(card =>
        (cardEffects.getCardModel(card)?.triggers || []).some(trigger =>
          trigger.event?.types?.includes(type) || trigger.event?.type === type))
        || (session.workingState.turn.cardTurnEventBonuses || []).some(bonus =>
          (bonus.eventType || bonus.event?.type) === type);
      // 点击产生额外效果时不再是纯选择部分；支付事件有观察者时保留有序出口。
      if (observes("quick_trade_discard_selection")) return null;
      const unordered = !observes("quick_trade_payment");
      return freeze({ proof: `seti-quick-trade-discard-component-v${unordered ? 2 : 1}`,
        requiredCount: pending.count, unordered,
        cardIds, selectedIds: [...selectedIds] });
    }

    // 保留目标前缀中仍可按原顺序留下的最长子序列，删除其他项，再追加剩余目标。
    // 所有留下的项必须是目标前缀，故该路径的点击数最少；顺序仍有规则意义。
    function selectionEdits(selected, target) {
      let kept = 0;
      let cursor = 0;
      while (kept < target.length) {
        const next = selected.indexOf(target[kept], cursor);
        if (next < 0) break;
        cursor = next + 1;
        kept += 1;
      }
      const retained = new Set(target.slice(0, kept));
      return [...selected.filter(id => !retained.has(id)), ...target.slice(kept)];
    }

    function* selectionPlans(node) {
      const spec = selectionSpec(node);
      if (!spec) throw new Error("ANALYSIS_SELECTION_UNSUPPORTED");
      function planFor(target) {
        const edits = selectionEdits(spec.selectedIds, target);
        const first = edits.length
          ? node.legalActions.find(action => action.target?.cardInstanceId === edits[0])
          : node.legalActions.find(action => action.target?.confirm);
        if (!first) throw new Error("ANALYSIS_SELECTION_PATH_INVALID");
        return { selectedIds: [...target], submissions: edits.length + 1,
          firstActionId: first.actionId, proof: spec.proof };
      }
      function* visit(target, start = 0) {
        if (target.length === spec.requiredCount) {
          const forward = planFor(target);
          if (!spec.unordered) { yield freeze(forward); return; }
          const reversed = planFor([...target].reverse());
          yield freeze(reversed.submissions < forward.submissions
            || (reversed.submissions === forward.submissions && reversed.firstActionId < forward.firstActionId)
            ? reversed : forward);
          return;
        }
        for (let i = spec.unordered ? start : 0; i < spec.cardIds.length; i += 1) {
          if (!target.includes(spec.cardIds[i])) yield* visit([...target, spec.cardIds[i]], i + 1);
        }
      }
      yield* visit([]);
    }

    function expandSelection(node, selectedIds) {
      const spec = selectionSpec(node);
      if (!spec) throw new Error("ANALYSIS_SELECTION_UNSUPPORTED");
      if (!Array.isArray(selectedIds) || selectedIds.length !== spec.requiredCount
        || new Set(selectedIds).size !== selectedIds.length
        || selectedIds.some(id => !spec.cardIds.includes(id))) throw new Error("ANALYSIS_SELECTION_INVALID");
      const stored = nodes.get(node);
      const key = JSON.stringify([stored.serial, "selection", selectedIds]);
      if (cache.has(key)) {
        cacheHits += 1;
        return cache.get(key);
      }
      restoreEnvelope(stored.envelope, true);
      const comp = fork.composition || fork;
      const actions = [];
      let outcome;
      for (const id of [...selectionEdits(spec.selectedIds, selectedIds), null]) {
        const current = legalActions(comp).find(action => id == null
          ? action.target?.confirm : action.target?.cardInstanceId === id);
        if (!current) throw new Error("ANALYSIS_SELECTION_PATH_INVALID");
        actions.push(structuredClone(current));
        outcome = executeCurrent(current.actionId);
      }
      return remember(key, freeze({ node: finishChild(outcome.before, outcome.result), actions,
        proof: spec.proof, submissions: actions.length }));
    }

    function selectionDependencyKey(node) {
      const envelope = nodes.get(node).envelope;
      const session = envelope.session.session;
      const head = session.queue[0];
      // 只剥离已证明纯点击会改变的选中列表和由它生成的 choices；余下队列原样保留。
      const neutral = { ...envelope, session: { ...envelope.session, session: { ...session,
        queue: [{ ...head, payload: { ...head.payload, choices: [],
          decisionContext: { ...head.payload.decisionContext, selected: [] } } }, ...session.queue.slice(1)],
      } } };
      return JSON.stringify([node.legalActions[0].stateVersion, node.legalActions[0].decisionVersion,
        forwardIdentity(neutral, "selection-component", null)]);
    }

    function rememberSelection(node, entries, modelKey) {
      const spec = selectionSpec(node);
      if (!spec || typeof modelKey !== "string" || !modelKey) throw new Error("ANALYSIS_SELECTION_EVIDENCE_INVALID");
      const expected = new Set([...selectionPlans(node)].map(plan => selectionTargetKey(plan.selectedIds, spec.unordered)));
      if (!Array.isArray(entries) || entries.length !== expected.size) throw new Error("ANALYSIS_SELECTION_EVIDENCE_INCOMPLETE");
      for (const entry of entries) {
        const key = selectionTargetKey(entry.selectedIds, spec.unordered);
        if (!expected.delete(key) || (entry.value === null ? entry.distance !== null
          : !Number.isFinite(entry.value) || !Number.isSafeInteger(entry.distance) || entry.distance < 0)) {
          throw new Error("ANALYSIS_SELECTION_EVIDENCE_INVALID");
        }
      }
      const token = Object.freeze({});
      selectionCertificate = { token, key: selectionDependencyKey(node), modelKey,
        entries: freeze(structuredClone(entries)), evidenceId: `selection-evidence-${++nextCertificate}` };
      return token;
    }

    function reuseSelection(node, token, modelKey) {
      const saved = token && selectionCertificate?.token === token ? selectionCertificate : null;
      if (!saved) return { hit: false, reason: "unknown-evidence" };
      if (saved.modelKey !== modelKey) return { hit: false, reason: "model-changed" };
      const spec = selectionSpec(node);
      if (!spec) return { hit: false, reason: "outside-selection-component" };
      if (saved.key !== selectionDependencyKey(node)) return { hit: false, reason: "dependencies-changed" };
      const byTarget = new Map(saved.entries.map(entry => [selectionTargetKey(entry.selectedIds, spec.unordered), entry]));
      let best = null;
      for (const plan of selectionPlans(node)) {
        const entry = byTarget.get(selectionTargetKey(plan.selectedIds, spec.unordered));
        if (entry.value == null) continue;
        const distance = plan.submissions + entry.distance;
        if (!best || entry.value > best.value || (entry.value === best.value
          && (distance < best.distance || (distance === best.distance && plan.firstActionId < best.actionId)))) {
          best = { actionId: plan.firstActionId, selectedIds: plan.selectedIds, value: entry.value, distance };
        }
      }
      if (!best) return { hit: false, reason: "no-reachable-boundary" };
      const roots = node.legalActions.map(action => {
        const direct = action.target?.confirm
          ? byTarget.get(selectionTargetKey(spec.selectedIds, spec.unordered)) : null;
        const value = action.target?.confirm ? direct.value : best.value;
        return { actionId: action.actionId, value, completion: value == null ? "unreachable" : "complete",
          proof: spec.proof, equivalentExitSet: !action.target?.confirm };
      });
      return freeze({ hit: true, ...best, roots, cardIds: spec.cardIds, proof: spec.proof,
        evidenceId: saved.evidenceId, exitCount: saved.entries.length });
    }

    function selectionTargetKey(ids, unordered) {
      return Array.isArray(ids) ? JSON.stringify(unordered ? [...ids].sort() : ids) : null;
    }

    function rememberPlan(entries, modelKey, source) {
      if (typeof modelKey !== "string" || !modelKey || !Array.isArray(entries) || !entries.length
        || !Number.isSafeInteger(source?.nodeCount) || source.nodeCount < 1) throw new Error("ANALYSIS_PLAN_EVIDENCE_INVALID");
      const rows = entries.slice(0, 32).map(entry => {
        const stored = nodes.get(entry.node);
        if (!fork || !stored || !["stable", "decision"].includes(entry.node.status)
          || !entry.node.legalActions.some(action => action.actionId === entry.actionId)
          || !Number.isFinite(entry.value) || !Number.isSafeInteger(entry.distance) || entry.distance < 1
          || !Array.isArray(entry.roots) || entry.roots.length !== entry.node.legalActions.length
          || new Set(entry.roots.map(row => row.actionId)).size !== entry.roots.length
          || entry.node.legalActions.some(action => !entry.roots.some(row => row.actionId === action.actionId))) {
          throw new Error("ANALYSIS_PLAN_EVIDENCE_INVALID");
        }
        return { key: stored.policyKey, actions: actionSetKey(entry.node.legalActions), actionId: entry.actionId,
          value: entry.value, distance: entry.distance, sourceNode: entry.sourceNode, roots: freeze(structuredClone(entry.roots)) };
      });
      const token = Object.freeze({}), evidenceId = `plan-evidence-${++nextCertificate}`;
      planCertificate = { token, modelKey, rows, evidenceId, source: freeze(structuredClone(source)) };
      return { token, evidenceId };
    }

    function reusePlan(node, token, modelKey) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      const saved = token && planCertificate?.token === token ? planCertificate : null;
      if (!saved) return { hit: false, reason: "unknown-evidence" };
      if (saved.modelKey !== modelKey) return { hit: false, reason: "model-changed" };
      const row = saved.rows.find(entry => entry.key === stored.policyKey && entry.actions === actionSetKey(node.legalActions));
      if (!row) return { hit: false, reason: "dependencies-changed" };
      return freeze({ hit: true, actionId: row.actionId, value: row.value, distance: row.distance, roots: row.roots,
        proof: "seti-complete-window-best-prefix-reuse-v1", evidenceId: saved.evidenceId,
        sourceNode: row.sourceNode, source: saved.source });
    }

    // Optional AI sidecar, never rule state or public decision evidence. Revalidate exact
    // physical/queue/RNG identity, legal envelopes and complete model/options on every hit.
    function exportPlan(token) {
      if (!token || planCertificate?.token !== token) return null;
      const { token: ignored, ...saved } = planCertificate;
      return structuredClone({schemaVersion:"seti-search-plan-checkpoint-v1",...saved});
    }
    function importPlan(saved) {
      if (saved == null) return null;
      if (saved.schemaVersion !== "seti-search-plan-checkpoint-v1" || typeof saved.modelKey !== "string"
        || !Array.isArray(saved.rows) || !saved.rows.length || saved.rows.length > 32
        || !Number.isSafeInteger(saved.source?.nodeCount) || saved.source.nodeCount < 1
        || saved.rows.some(row=>typeof row.key!=="string" || typeof row.actions!=="string" || typeof row.actionId!=="string"
          || !Number.isFinite(row.value) || !Number.isSafeInteger(row.distance) || row.distance < 1 || !Array.isArray(row.roots))) {
        throw new Error("ANALYSIS_PLAN_CHECKPOINT_INVALID");
      }
      const token=Object.freeze({});
      planCertificate={...freeze(structuredClone(saved)),token}; return token;
    }

    function cardTradeBound(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (cardTradeBounds.has(node)) return cardTradeBounds.get(node);
      const at = now();
      const result = describeCardTradeBound(stored, node);
      milliseconds.valueBound += now() - at;
      cardTradeBounds.set(node, result);
      return result;
    }

    function hasOnlyOwnInertReservations(state, { sectorTasks = false } = {}) {
      return state.players.players.every(player => player.reservedCards.every(card => {
        if (player.id !== seatId) return false;
        const model = cardEffects.getCardModel(card);
        if (sectorTasks && ["b_114.webp", "dlc_9.png"].includes(card.cardId)) {
          return ["basic", "space-agency"].includes(card.set) && model?.cardType === 2
            && Object.keys(model).every(key => ["cardType", "playEffects", "tasks", "source"].includes(key))
            && Array.isArray(model.tasks) && model.tasks.length > 0
            && model.tasks.every(task => ["completedSectors", "completedSectorsByColor"].includes(task.condition?.type)
              && !cardEffects.taskConditionMet(task, player, { data: state.data }));
        }
        if (card.cardId !== "b_44.webp" || card.set !== "basic") return false;
        // 只审计过B44：没有任务、终局公式或其他阶段效果；types列表会覆盖单个type，必须排除。
        return model?.cardType === 1 && Array.isArray(model.triggers) && model.triggers.length > 0
          && Object.keys(model).every(key => ["cardType", "triggers", "source"].includes(key))
          && model.triggers.every(trigger => trigger.event?.type === "visitPlanet" && !trigger.event.types?.length);
      }));
    }

    function hasTradeInertReservations(state) {
      // 交易不推进回合或执行complete_task；任务可就绪，但不能在本队列中兑付。
      // 化石运输会在任意effect后补visitPlanet，不能只检查显式交易事件。
      if (Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length) return false;
      const fields = ["cardType", "playEffects", "tasks", "temporaryTasks", "triggers", "endGameScoring", "source",
        "reserveAfterPlay", "displayRow", "countsAsType3", "pluto"];
      return state.players.players.every(player => player.reservedCards.every(card => {
        const model = cardEffects.getCardModel(card);
        if (!["basic", "space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card) || !model
          || ![0, 1, 2, 3].includes(model.cardType) || Object.keys(model).some(key => !fields.includes(key))) return false;
        // 事件只投给交易owner，对手不会在此信息边界前取得行动或任务结算。
        if (player.id !== seatId) return true;
        if (model.triggers && (!Array.isArray(model.triggers) || !model.triggers.every(trigger => {
          const event = trigger.event;
          if (Object.keys(trigger).some(key => !["id", "event", "effect"].includes(key)) || !event
            || Object.keys(event).some(key => !["type", "types", "planetIds", "includePlanetIds", "excludePlanetIds",
              "requiresOwnOrbit", "techType", "color", "cornerKind", "cornerCode", "timing", "price", "cardIds",
              "includeCardIds", "excludeCardIds"].includes(key)) || event.types != null && !Array.isArray(event.types)) return false;
          return (event.types?.length ? event.types : [event.type]).every(type => MONEY_INDEPENDENT_EVENTS.has(type));
        }))) return false;
        const scoring = model.endGameScoring;
        if (model.cardType === 3 && !scoring) return false;
        return !scoring || Object.keys(scoring).every(key => ["kind", "color", "traceType", "techType", "planetId",
          "scorePer", "locationType", "score", "resource", "count"].includes(key))
          && ["sectorWinsByColor", "traceCount", "techCount", "distinctSignalSectors", "planetOrbitOrLand", "probeLocation",
            "unmarkedFinalRightmost", "remainingResource", "planetLandingPairs", "allOrbitOrLand"].includes(scoring.kind)
          && (scoring.kind !== "remainingResource" || ["availableData", "publicity"].includes(scoring.resource));
      }));
    }

    function hasPostMainInertReservations(state, hasOwnRockets) {
      if (!hasTradeInertReservations(state)) return false;
      const owner = state.players.players.find(player => player.id === seatId);
      const reserved = owner.reservedCards.map(card => {
        const copy = structuredClone(card);
        // 旧modelCardId下的消耗记录在正式流程中会重置，不能据此证明触发器已用完。
        cardEffects.ensureCardEffectState(copy);
        return copy;
      });
      // turn_end还会重新收集历史事件；没有新事件不等于没有待结算触发。
      if ((state.turn.type1TriggerEvents || []).some(event => cardEffects.collectMatchingTriggers(
        { ...owner, reservedCards: reserved }, event).length)) return false;
      const unreachableEvents = new Set(["launch", "orbit", "land", "researchTech", "signalMarked", "playCard"]);
      if (!hasOwnRockets) for (const type of ["move", "visitPlanet", "visitAsteroid", "visitComet"]) unreachableEvents.add(type);
      return reserved.every(card => {
        const model = cardEffects.getCardModel(card), scoring = model.endGameScoring;
        if (scoring && !["sectorWinsByColor", "traceCount", "techCount", "distinctSignalSectors", "planetOrbitOrLand",
          "unmarkedFinalRightmost", "planetLandingPairs", "allOrbitOrLand"].includes(scoring.kind)
          || model.tasks != null && !Array.isArray(model.tasks)) return false;
        if ((model.triggers || []).some(trigger => !card.cardEffectState.consumedTriggerIds.includes(trigger.id)
          && !(trigger.event.types?.length ? trigger.event.types : [trigger.event.type]).every(type => unreachableEvents.has(type)))) return false;
        return (model.tasks || []).every(task => {
          const condition = task.condition, fields = { traceCount: ["traceType", "count"], completedSectors: ["count"],
            completedSectorsByColor: ["color", "count"] }[condition?.type];
          if (!fields || Object.keys(task).some(key => !["id", "condition", "rewards"].includes(key))
            || Object.keys(condition).some(key => key !== "type" && !fields.includes(key))
            || !Number.isSafeInteger(condition.count) || condition.count < 1
            || condition.type === "traceCount" && !["blue", "pink", "yellow"].includes(condition.traceType)) return false;
          return card.cardEffectState.completedTaskIds.includes(task.id)
            || !cardEffects.taskConditionMet(task, owner, { data: state.data, aliens: state.aliens });
        });
      });
    }

    function describeCardTradeBound(stored, node) {
      const session = stored.envelope.session?.session;
      const effect = session?.queue?.[0];
      const pending = effect?.payload?.decisionContext;
      const source = session?.journal?.actions?.[0]?.action;
      if (node.status !== "decision" || session.queue.length !== 1 || session.interruptContext
        || effect.type !== "standard_action_session_decision" || effect.allowQuickActions
        || effect.ownerId !== seatId || pending?.type !== "trade" || pending.playerId !== seatId
        || source?.family !== "quick_trade" || source.target?.tradeId !== pending.tradeId
        || !["credits-for-card", "energy-for-card", "publicity-for-card", "cards-for-pick-card"].includes(pending.tradeId)) return null;
      let handDelta;
      if (pending.kind === "discard" && pending.tradeId === "cards-for-pick-card"
        && pending.required === true && pending.count === 2 && selectionSpec(node)) handDelta = -1;
      else if (pending.kind === "card_selection" && node.legalActions.every(action =>
        action.family === "choose_card" && action.target?.kind === "trade-card-selection")) handDelta = 1;
      else return null;
      const state = session.workingState;
      const owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      const passives = company && POST_MAIN_MONEY_COMPANIES[company.activeAbilityId ?? "no_active"];
      if (state.turn.currentPlayerId !== seatId || owner.passCompletionPending
        || state.turn.passedPlayerIds.includes(seatId) || state.match.initialSetup
        || !hasTradeInertReservations(state)
        || state.turn.cardTurnEventBonuses?.length
        || Object.values(state.aliens.aliens).some(slot => slot.revealed)
        || !passives || passives.length !== company.passiveIds.length
        || company.passiveIds.some(id => !passives.includes(id))
        || owner.hand.some(card => !["basic", "space-agency"].includes(card.set))
        || state.cards.publicCards.some(card => card && !["basic", "space-agency"].includes(card.set))) return null;
      // getAvailablePool 会清理副本上的牌堆目录，不能写入冻结的工作状态。
      if (!cards.getAvailablePool({ ...state.cards }, state.players).length) return null;
      return freeze({ proof: "seti-card-trade-information-value-bound-v4", tradeId: pending.tradeId, handDelta });
    }

    function postMainResourceOrder(node) {
      return resourceOrder(node, resourceOrders, false);
    }

    function knownCardMoneyOrder(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (knownMoneyOrders.has(node)) return knownMoneyOrders.get(node);
      const at = now(), result = describeKnownCardMoneyOrder(stored, node);
      milliseconds.resourceOrder += now() - at;
      knownMoneyOrders.set(node, result);
      return result;
    }

    function describeKnownCardMoneyOrder(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = readIdentityState(stored.envelope), owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner), passives = company && POST_MAIN_MONEY_COMPANIES[company.activeAbilityId ?? "no_active"];
      if (!owner || state.turn.currentPlayerId !== seatId || state.match.initialSetup || owner.passCompletionPending
        || state.turn.passedPlayerIds.includes(seatId) || state.turn.activePlayerCount !== 4
        || !hasStandardOpeningTrades() || Object.keys(state.tech.stacks).some(id => !/^(orange|purple|blue)[1-4]$/.test(id))
        || Object.keys(owner.techState.ownedTiles).some(id => !/^(orange|purple|blue)[1-4]$/.test(id))
        || node.legalActions.some(action => !["launch", "orbit", "land", "scan", "analyze", "research_tech", "play_card", "pass", "quick_trade",
          "card_corner", "place_data", "move", "end_turn", "industry", "complete_task"].includes(action.family))
        || state.turn.cardTurnEventBonuses?.length || Object.values(state.aliens.aliens).some(slot => slot.revealed)
        || owner.hand.length > 250 || owner.reservedCards.length > 250
        || !Number.isSafeInteger(owner.completedTaskCount ?? 0) || (owner.completedTaskCount ?? 0) < 0 || (owner.completedTaskCount ?? 0) > 1000000
        || !passives || passives.length !== company.passiveIds.length || company.passiveIds.some(id => !passives.includes(id))
        || [...Object.values(owner.resources), ...Object.values(owner.income)].some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000)
        || [...owner.hand, ...owner.reservedCards, ...(owner.industryLastPlayedCardThisRound ? [owner.industryLastPlayedCardThisRound] : []),
          ...(owner.industryFutureSpan?.card ? [owner.industryFutureSpan.card] : []),
          ...(company?.activeAbilityId === "deepspace_swap_cards" ? state.cards.publicCards.filter(Boolean) : [])]
          .some(card => !hasMoneyMonotoneCardModel(card))
        || state.players.players.some(player => player.reservedCards.some(card => !["basic", "space-agency"].includes(card.set)
          || !cards.getCatalogEntryForCard(card)))
        || state.cards.publicCards.some(card => card && (!["basic", "space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card)))) return null;
      const credits = owner.resources.credits, energy = owner.resources.energy;
      if (["credits", "energy"].some(key => !Number.isSafeInteger(owner.blueBonusResources?.[key] ?? 0)
        || (owner.blueBonusResources?.[key] ?? 0) < 0 || (owner.blueBonusResources?.[key] ?? 0) > owner.resources[key])) return null;
      const transition = previewTurn(state);
      if (!transition.turnAdvanced || transition.roundAdvanced || transition.gameEnded || transition.nextPlayerId === seatId) return null;
      const neutral = { ...state, players: { ...state.players, players: state.players.players.map(player => player.id === seatId
        ? { ...owner, resources: { ...owner.resources, credits: 0, energy: 0 } } : player) } };
      const key = forwardIdentity(stored.envelope, `known-card-money:${owner.mainActionCompleted ? "post-main" : "before-main"}`, null, neutral);
      if (!resourceGroups.has(key)) resourceGroups.set(key, Object.freeze({}));
      return freeze({ group: resourceGroups.get(key), credits, energy, proof: "seti-known-card-money-simulation-v1" });
    }

    function passReserveChoiceSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (passReserveBounds.has(node)) return passReserveBounds.get(node);
      const at = now(), result = describePassReserveChoice(stored, node);
      milliseconds.valueBound += now() - at;
      passReserveBounds.set(node, result);
      return result;
    }

    function describePassReserveChoice(stored, node) {
      const session = stored.envelope.session?.session, queue = session?.queue;
      const types = probeTurnSession.EFFECT_TYPES;
      if (node.status !== "decision" || session.interruptContext || queue.length !== 8
        || queue[0].type !== types.PASS_RESERVE || queue[1].type !== types.PASS_COMMIT || queue[7].type !== types.TURN_ADVANCE
        || queue.some(effect => effect.ownerId !== seatId || effect.allowQuickActions)
        || session.journal.actions[0]?.action?.family !== "pass") return null;
      const state = session.workingState, owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      const passives = company && POST_MAIN_MONEY_COMPANIES[company.activeAbilityId ?? "no_active"];
      if (state.turn.currentPlayerId !== seatId || state.turn.activePlayerCount !== 4 || state.match.initialSetup
        || state.turn.passedPlayerIds.includes(seatId) || owner.passCompletionPending || owner.industryBorrowedTechTileId
        || !passives || passives.length !== company.passiveIds.length || company.passiveIds.some(id => !passives.includes(id))
        || !hasOnlyOwnInertReservations(state, { sectorTasks: true }) || state.turn.cardTurnEventBonuses?.length
        || Object.values(state.aliens.aliens).some(slot => slot.revealed || alienState.isAlienReadyToReveal(slot))
        || owner.hand.some(card => !["basic", "space-agency"].includes(card.set))) return null;
      const round = state.turn.roundNumber, turn = state.turn.turnNumber;
      const boundaryMatches = payload => payload && Object.keys(payload).length === 3
        && payload.roundNumber === round && payload.turnNumber === turn && payload.didPass === true;
      if (Object.keys(queue[0].payload).length !== 1 || queue[0].payload.roundNumber !== round
        || Object.keys(queue[1].payload).length || !boundaryMatches(queue[7].payload)) return null;
      const handoffs = [["final_scoring", "milestone"], ["alien", "turn_end_neutral_milestone"],
        ["alien", "turn_end_reveal"], ["company", "turn_end"], ["card_trigger", "turn_end"]];
      if (handoffs.some(([domain, effectType], index) => {
        const effect = queue[index + 2], payload = effect.payload;
        return effect.type !== probeTurnSession.DOMAIN_HANDOFF_EFFECT_TYPE || Object.keys(payload).length !== 4
          || payload.schemaVersion !== probeTurnSession.DOMAIN_HANDOFF_SCHEMA_VERSION
          || payload.domain !== domain || payload.effectType !== effectType || !boundaryMatches(payload.data);
      })) return null;
      const thresholds = state.finalScoring.thresholds;
      if (!thresholds.length || thresholds.some(value => !Number.isSafeInteger(value) || value <= 0)
        || state.players.players.some(player => !Number.isSafeInteger(player.resources.score)
          || player.resources.score < 0 || player.resources.score >= Math.min(...thresholds))) return null;
      const pile = cards.getPassReservePile(state.cards, round);
      if (!pile.length || node.legalActions.length !== pile.length || new Set(pile.map(card => card.id)).size !== pile.length
        || pile.some(card => !["basic", "space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card))
        || node.legalActions.some(action => action.actorId !== seatId || action.family !== "choose_card"
          || action.target?.kind !== "pass-reserve-card" || action.payload?.cardInstanceId !== action.target.choiceId
          || !pile.some(card => card.id === action.target.choiceId))) return null;
      const preview = previewTurn(state, { passed: true });
      if (!preview.turnAdvanced || preview.roundAdvanced || preview.gameEnded || preview.nextPlayerId === seatId) return null;
      return freeze({ proof: "seti-standard-pass-reserve-choice-value-equivalence-v1", handDelta: 1, expectedStatus: "other-owner" });
    }

    function preMainDataPlanSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (preMainDataPlans.has(node)) return preMainDataPlans.get(node);
      const at = now(), result = describePreMainDataPlan(stored, node);
      milliseconds.preMainDataPlan += now() - at;
      preMainDataPlans.set(node, result);
      return result;
    }

    function describePreMainDataPlan(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = readIdentityState(stored.envelope), owner = state.players.players.find(player => player.id === seatId);
      if (!owner || owner.mainActionCompleted || owner.hand.length > 5 || probeTurnSession.PASS_HAND_LIMIT !== 4
        || Object.keys(owner.techState.ownedTiles).some(id => id.startsWith("blue") && owner.techState.ownedTiles[id])
        || owner.industryFutureSpan?.card || owner.industryBorrowedTechTileId && !/^(orange|purple)[1-4]$/.test(owner.industryBorrowedTechTileId)
        || Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length
        || Object.values(state.aliens.aliens).some(alienState.isAlienReadyToReveal)
        || state.pieces.rockets.some(rocket => [rocket.playerId, rocket.color, rocket.playerColor].some(id => id === seatId || id === owner.color)
          && ((rocket.kind ?? "standard") !== "standard" || rocket.fossilId != null))) return null;
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      if (![null, "turing_borrow_tech"].includes(company?.activeAbilityId) || !knownCardMoneyOrder(node)) return null;
      const occupied = data.listComputerPlacedTokens(owner).map(token => token.placementSlot).sort((a, b) => a - b);
      if (owner.resources.availableData !== owner.dataState.poolTokens.length
        || occupied.length !== owner.dataState.placedTokens.length || occupied.some((slot, index) => slot !== index + 1)
        || data.ANALYZE_REQUIRED_COMPUTER_SLOT !== 6
        || JSON.stringify(data.getComputerSlotBonus(2)) !== '{"type":"publicity","publicity":1}'
        || JSON.stringify(data.getComputerSlotBonus(4)) !== '{"type":"income"}'
        || Object.keys(data.COMPUTER_DATA_SLOTS).some(slot => ![2, 4].includes(Number(slot)) && data.getComputerSlotBonus(slot))) return null;
      const stock = occupied.length + owner.dataState.poolTokens.length;
      if (stock < 4 || owner.hand.length > 4 && (state.turn.roundNumber > 2 || occupied.includes(4))) return null;
      const sensitive = value => Boolean(value && typeof value === "object" && (value.type === "dataTotal"
        || value.type === "resourceEquals" || value.kind === "remainingResource" && value.resource === "availableData"
        || Object.values(value).some(sensitive)));
      if ([...owner.hand, ...owner.reservedCards].some(card => sensitive(cardEffects.getCardModel(card)))) return null;
      // 这些已审计原语在主行动前不增加数据/手牌身份；取牌一旦公开即到信息边界。
      const beforeMainReward = effect => ["gain_resources", "draw_cards", "pick_card", "card_move"].includes(effect.type);
      if (owner.reservedCards.some(card => {
        const model = cardEffects.getCardModel(card);
        return (model.tasks || []).some(task => !task.rewards.every(beforeMainReward))
          || (model.triggers || []).some(trigger => !beforeMainReward(trigger.effect)
            || (trigger.event.types?.length ? trigger.event.types : [trigger.event.type]).includes("cardCorner"));
      })) return null;
      const dataIds = new Set(), cashIds = new Set();
      for (const card of owner.hand) {
        const corner = cards.getDiscardActionCodeForCard(card), income = cards.getIncomeCodeForCard(card);
        const gain = cards.getIncomeGainForCard(card), key = ["credits", "energy", "handSize"][income];
        if (![0, 1, 2].includes(corner) || !key || !gain || Object.keys(gain).length !== 1 || gain[key] !== 1) return null;
        if (corner === 1) {
          const reward = cards.getDiscardActionRewardForCard(card);
          if (reward.dataCount !== 1 || Object.keys(reward.gain).length) return null;
          dataIds.add(card.id); if (income !== 2) cashIds.add(card.id);
        }
      }
      if (stock + dataIds.size >= 6 || node.legalActions.some(action => action.family === "card_corner" && action.payload?.multiplier !== 1)) return null;
      const excluded = node.legalActions.filter(action => action.family === "card_corner"
        && (cashIds.has(action.target?.cardInstanceId) || occupied.includes(4) && dataIds.has(action.target?.cardInstanceId))
        || action.family === "place_data" && occupied.includes(4));
      return excluded.length ? freeze({ proof: "seti-before-main-funded-data-strict-plan-v1",
        retainedActionIds: node.legalActions.filter(action => !excluded.includes(action)).map(action => action.actionId),
        excludedActionIds: excluded.map(action => action.actionId), passPreparationActionIds: [],
        stock, maximumBeforeMainData: stock + dataIds.size, analyzeRequiredData: 6, incomeAlreadyPlaced: occupied.includes(4),
        cashDataCardIds: [...cashIds], passCashIncomeReplacement: owner.hand.length > 4 }) : null;
    }

    function postMainCornerChoiceSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (cornerChoices.has(node)) return cornerChoices.get(node);
      const result = describePostMainCornerChoices(stored, node);
      cornerChoices.set(node, result);
      return result;
    }

    function describePostMainCornerChoices(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = readIdentityState(stored.envelope), owner = state.players.players.find(player => player.id === seatId);
      if (!owner?.mainActionCompleted) return null;
      const corners = node.legalActions.filter(action => action.family === "card_corner");
      if (corners.length < 2) return null;
      const handById = new Map(owner.hand.map(card => [card.id, card]));
      const signatureOf = action => JSON.stringify([cards.getDiscardActionCodeForCard(handById.get(action.target?.cardInstanceId)),
        cards.getIncomeCodeForCard(handById.get(action.target?.cardInstanceId)), action.payload?.kind, action.payload?.multiplier]);
      if (new Set(corners.map(signatureOf)).size === corners.length || !knownCardMoneyOrder(node)) return null;
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      // 图灵只借橙/紫科技；赫利昂的手牌输入仅为收入码。两者不读取手牌主行动牌面。
      const featureOnlyIndustry = ["turing_borrow_tech", "helios_remove_tech_income"].includes(company.activeAbilityId);
      if (company.activeAbilityId && !featureOnlyIndustry && owner.industryRoundMarkRound !== state.turn.roundNumber
        || node.legalActions.some(action => action.family === "industry"
          ? !featureOnlyIndustry || action.target?.abilityId !== company.activeAbilityId
          : !["end_turn", "place_data", "quick_trade", "card_corner", "move", "complete_task"].includes(action.family))
        || owner.industryFutureSpan?.card || company.activeAbilityId === "future_span_pick_advance" && !owner.industryFutureSpanInitialized
        || Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length
        || Object.values(state.aliens.aliens).some(alienState.isAlienReadyToReveal)
        || state.pieces.rockets.some(rocket => [rocket.playerId, rocket.color, rocket.playerColor].some(id => id === seatId || id === owner.color)
          && ((rocket.kind ?? "standard") !== "standard" || rocket.fossilId != null))) return null;
      const quietTypes = new Set(["gain_resources", "gain_data", "draw_cards", "pick_card", "card_move",
        "card_return_played_card_to_hand_if", "card_count_owned_tech_reward", "card_pay_credits_for_reward", "card_discard_any_for_income"]);
      const quietReward = effect => quietTypes.has(effect.type) && (!effect.options?.reward || quietReward(effect.options.reward));
      if (owner.reservedCards.some(card => {
        const model = cardEffects.getCardModel(card);
        return (model.tasks || []).some(task => !task.rewards.every(quietReward)) || (model.triggers || []).some(trigger =>
          !quietReward(trigger.effect) || (trigger.event.types?.length ? trigger.event.types : [trigger.event.type]).includes("cardCorner"));
      })) return null;
      const quietBonus = bonus => !bonus || ["income", "choose_card"].includes(bonus.type) && Object.keys(bonus).length === 1
        || ["credits", "energy", "publicity", "score"].includes(bonus.type)
          && Object.keys(bonus).every(key => key === "type" || key === bonus.type)
          && Number.isSafeInteger(bonus[bonus.type]) && bonus[bonus.type] >= 0;
      if (Object.keys(data.COMPUTER_DATA_SLOTS).some(slot => !quietBonus(data.getComputerSlotBonus(slot))
        || !quietBonus(data.getComputerSlotBlueColumnBonus(owner, Number(slot))))
        || Object.keys(data.BLUE_BONUS_DATA_SLOTS).some(slot => !quietBonus(data.getBlueBonusPlacementReward(owner, Number(slot))))) return null;
      const outside = { ...state, players: { ...state.players, players: state.players.players.map(player => player === owner
        ? { ...owner, hand: [] } : player) } };
      // 不以实体编号猜测引用位置，旧事件、对象key和编码引用也必须排除。
      const external = forwardIdentity(stored.envelope, "post-main-corner-references", null, outside);
      const groups = new Map();
      for (const action of corners) {
        const card = handById.get(action.target?.cardInstanceId);
        if (!card || external.includes(card.id)) continue;
        const corner = cards.getDiscardActionCodeForCard(card), income = cards.getIncomeCodeForCard(card);
        if (![0, 1, 2].includes(corner) || ![0, 1, 2].includes(income)
          || action.phase !== "quick" || Object.keys(action.target).some(key => key !== "cardInstanceId")
          || Object.keys(action.payload).some(key => !["kind", "multiplier"].includes(key))
          || ![1, 2].includes(action.payload.multiplier) || action.payload.kind !== (corner === 2 ? "move" : "resource")) return null;
        const gain = cards.getIncomeGainForCard(card), key = ["credits", "energy", "handSize"][income];
        if (!gain || Object.keys(gain).length !== 1 || gain[key] !== 1) return null;
        const signature = signatureOf(action);
        if (!groups.has(signature)) groups.set(signature, []);
        groups.get(signature).push(action.actionId);
      }
      const equivalentGroups = [...groups].filter(([, ids]) => ids.length > 1).map(([signature, ids]) => ({
        signature, representativeActionId: ids.slice().sort()[0], excludedActionIds: ids.slice().sort().slice(1),
      }));
      const excluded = equivalentGroups.flatMap(group => group.excludedActionIds);
      return excluded.length ? freeze({ proof: "seti-post-main-corner-behavior-equivalence-v1", groups: equivalentGroups,
        retainedActionIds: node.legalActions.filter(action => !excluded.includes(action.actionId)).map(action => action.actionId),
        excludedActionIds: excluded }) : null;
    }

    function standardScanValueBound(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (scanValueBounds.has(node)) return scanValueBounds.get(node);
      const result = describeStandardScanValueBound(stored,node);
      scanValueBounds.set(node,result); return result;
    }

    function describeStandardScanValueBound(stored,node) {
      const session=stored.envelope.session?.session;
      if (node.status!=="stable" && node.status!=="decision" || node.status==="decision" && session?.queue?.[0]?.type!==scienceSession.EFFECT_TYPES.SCAN_STEP) return null;
      const state=session?.workingState || readIdentityState(stored.envelope);
      const owner=state.players.players.find(player=>player.id===seatId),company=industryCatalog.getPlayerIndustryDefinition(owner);
      const quietCompany=company && (company.activeAbilityId==="turing_borrow_tech" && company.passiveIds.length===0
        || company.activeAbilityId===null && company.passiveIds.length===1 && company.passiveIds[0]==="alien_lab_panels");
      if (!quietCompany || !owner || state.turn.currentPlayerId!==seatId || state.match.initialSetup || owner.passCompletionPending
        || state.turn.activePlayerCount!==4 || state.turn.passedPlayerIds.includes(seatId)
        || state.turn.cardTurnEventBonuses?.length || state.turn.type1TriggerEvents && !Array.isArray(state.turn.type1TriggerEvents)
        || Object.values(state.aliens.aliens).some(slot=>slot.revealed || alienState.isAlienReadyToReveal(slot))
        || Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length
        || owner.industryFutureSpan?.card || owner.industryStrategyPlayInteractionPending
        || Object.values(state.finalScoring.tiles).some(tile=>tile.marks.some(mark=>[mark.playerId,mark.playerColor].some(id=>id===seatId || id===owner.color)))) return null;
      for (const card of owner.reservedCards) {
        const model=cardEffects.getCardModel(card),copy=structuredClone(card);cardEffects.ensureCardEffectState(copy);
        if (!hasMoneyMonotoneCardModel(card) || model.tasks?.length || model.temporaryTasks?.length || model.endGameScoring || model.pluto
          || (model.triggers||[]).some(trigger=>!copy.cardEffectState.consumedTriggerIds.includes(trigger.id)
            && (trigger.event.types?.length?trigger.event.types:[trigger.event.type]).includes("signalMarked"))
          || (state.turn.type1TriggerEvents||[]).some(event=>cardEffects.collectMatchingTriggers({...owner,reservedCards:[copy]},event).length)) return null;
      }
      if (owner.resources.availableData!==owner.dataState.poolTokens.length
        || owner.resources.additionalPublicScan!==0 || state.cards.publicCards.length!==3
        || state.cards.publicCards.some(card=>!card || !["basic","space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card))
        || !cards.getAvailablePool({...state.cards},state.players).length
        || Object.keys(state.data.nebulae).some(id=>data.isSectorReadyToSettle(state.data,id))) return null;
      let firstChoices,stage,cost={};
      if (node.status==="stable" && !session) {
        if (!node.legalActions.some(action=>action.family==="scan" && action.phase==="main" && action.target?.kind==="standard-scan"
          && Object.keys(action.target).length===1 && Object.keys(action.payload||{}).length===0)) return null;
        const queue=scanEffects.buildScanEffectQueue(owner,{fullScanAction:true,includeFinalize:true,turn:state.turn});
        if (queue.length!==2 || queue[0].type!==scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN
          || queue[1].type!==scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN || queue.some(effect=>Object.keys(effect.options||{}).length)) return null;
        const source=scienceSession.getPlanetScanSource(state,queue[0].type);if(!source)return null;
        firstChoices=scienceSession.listNebulaChoices(state,{...source,gainData:true});
        cost=scanEffects.getStandardScanCost(owner);if(Object.keys(cost).some(key=>!["credits","energy"].includes(key)||!Number.isSafeInteger(cost[key])||cost[key]<0))return null;
        stage="before-scan";
      } else if (node.status==="decision" && session && !session.interruptContext && !session.irreversibleBarrier
        && session.journal?.actions?.[0]?.action?.family==="scan") {
        const queue=session.queue,head=queue[0],opts=head?.payload?.options;
        if (![2,3].includes(queue.length) || queue.some(effect=>effect.ownerId!==seatId || effect.allowQuickActions)
          || queue.at(-1).type!==scienceSession.EFFECT_TYPES.SCAN_FINALIZE || Object.keys(queue.at(-1).payload||{}).length) return null;
        const pub=queue.at(-2),pubOptions=pub.payload?.options;
        if (pub.type!==scienceSession.EFFECT_TYPES.SCAN_STEP || pubOptions?.mode!=="public" || pubOptions.selected!==0
          || pubOptions.max!==1 || pubOptions.consumeMarkers!==true || Object.keys(pub.payload).some(key=>key!=="options")
          || Object.keys(pubOptions).some(key=>!["mode","selected","max","consumeMarkers"].includes(key))) return null;
        if (queue.length===3) {
          if (head.type!==scienceSession.EFFECT_TYPES.SCAN_STEP || opts?.mode!=="specified" || opts.gainData!==true
            || opts.skippable || opts.cost || Object.keys(head.payload).some(key=>key!=="options")
            || Object.keys(opts).some(key=>!["mode","sectorX","gainData","cost","label","skippable"].includes(key))
            || node.legalActions.some(action=>action.family!=="choose_target" || !action.target?.nebulaId)) return null;
          firstChoices=node.legalActions;stage="before-earth";
        } else {firstChoices=[null];stage="before-public";}
      } else return null;
      const publicChoices=stage==="before-public"?node.legalActions:scienceSession.listPublicScanChoices(state);
      if (!firstChoices.length || !publicChoices.length || publicChoices.some(action=>action.family!=="choose_card"
        || !action.target?.nebulaId || !action.target.cardInstanceId || action.payload?.gainData!==true)) return null;
      const openTokens=id=>data.listNebulaTokens(state.data,id).filter(token=>!token.replacedByPlayerColor && !token.playerColor)
        .sort((a,b)=>a.slotIndex-b.slotIndex || a.index-b.index);
      let maximumScore=0;
      for(const first of firstChoices)for(const pub of publicChoices){
        const a=first?.target.nebulaId,b=pub.target.nebulaId,firstTokens=a?openTokens(a):null,publicTokens=openTokens(b),same=a===b;
        if (a && firstTokens.length<=1 || publicTokens.length<=(same?2:1)) return null;
        const scores=[...(a?[data.getNebulaSlotScoreReward(a,firstTokens[0].slotIndex)]:[]),data.getNebulaSlotScoreReward(b,publicTokens[same?1:0].slotIndex)];
        if(scores.some(score=>!Number.isSafeInteger(score)||score<0))return null;
        maximumScore=Math.max(maximumScore,scores.reduce((sum,n)=>sum+n,0));
      }
      const thresholds=state.finalScoring.thresholds;
      if(!thresholds.length || thresholds.some(n=>!Number.isSafeInteger(n)||n<=owner.resources.score+maximumScore))return null;
      const scanCount=stage==="before-public"?1:2;
      const dataGain=Math.min(scanCount,Math.max(0,players.RESOURCE_LIMITS.availableData-owner.dataState.poolTokens.length));
      return freeze({proof:"seti-standard-scan-refill-value-upper-bound-v1",stage,maximumScore,dataGain,
        valueDelta:maximumScore+dataGain*0.5-(cost.credits||0)-(cost.energy||0),cost,
        firstChoiceCount:firstChoices.length,publicChoiceCount:publicChoices.length});
    }

    function postMainValueBound(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (postMainValueBounds.has(node)) return postMainValueBounds.get(node);
      const result = describePostMainValueBound(stored, node);
      postMainValueBounds.set(node, result);
      return result;
    }

    function describePostMainValueBound(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = readIdentityState(stored.envelope), owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      const quietPlan = postMainPlanSpec(node);
      if (!owner?.mainActionCompleted || ![null, "turing_borrow_tech"].includes(company?.activeAbilityId)
        || (!knownCardMoneyOrder(node) && !quietPlan) || owner.industryFutureSpan?.card || owner.industryStrategyPlayInteractionPending
        || owner.industryHuanyuFreeMovesLeft || owner.blueBonusResources?.credits || owner.blueBonusResources?.energy
        || Object.keys(owner.techState.ownedTiles).some(id => id.startsWith("blue") && owner.techState.ownedTiles[id])
        || owner.industryBorrowedTechTileId && !/^(orange|purple)[1-4]$/.test(owner.industryBorrowedTechTileId)
        || Object.values(state.aliens.aliens).some(alienState.isAlienReadyToReveal)
        || Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length
        || state.turn.type1TriggerEvents && (!Array.isArray(state.turn.type1TriggerEvents) || state.turn.type1TriggerEvents.length && !quietPlan)
        || node.legalActions.some(action => !["end_turn", "place_data", "quick_trade", "card_corner", "move", "industry"].includes(action.family)
          || action.family === "card_corner" && action.payload?.multiplier !== 1)) return null;
      const thresholds = state.finalScoring.thresholds;
      if (!thresholds.length || thresholds.some(n => !Number.isSafeInteger(n) || n <= 0)
        || owner.resources.score >= Math.min(...thresholds)
        || Object.values(state.finalScoring.tiles).some(tile => tile.marks.some(mark => [mark.playerId,mark.playerColor].some(id => id === seatId || id === owner.color)))) return null;
      const probes = state.pieces.rockets.filter(rocket => [rocket.playerId, rocket.color, rocket.playerColor]
        .some(id => id === seatId || id === owner.color));
      if (probes.some(rocket => (rocket.kind ?? "standard") !== "standard" || rocket.fossilId != null
        || (rocket.surface ?? "solar-board") !== "solar-board" || !Number.isInteger(rocket.sectorX)
        || rocket.sectorX < 0 || rocket.sectorX >= 8 || !Number.isInteger(rocket.sectorY)
        || rocket.sectorY < 1 || rocket.sectorY > 4)
        || rockets.SECTOR_RING_MIN !== 1 || rockets.SECTOR_RING_MAX !== 4
        || JSON.stringify(rocketAbilities.MOVE_DIRECTIONS.map(d => [d.deltaX, d.deltaY])) !== "[[0,1],[1,0],[-1,0],[0,-1]]") return null;
      const occupied = data.listComputerPlacedTokens(owner).map(token => token.placementSlot).sort((a,b) => a-b);
      if (owner.resources.availableData !== owner.dataState.poolTokens.length
        || owner.resources.handSize !== owner.hand.length || occupied.length !== owner.dataState.placedTokens.length
        || occupied.some((slot,index) => slot !== index+1)
        || JSON.stringify(data.getComputerSlotBonus(2)) !== '{"type":"publicity","publicity":1}'
        || JSON.stringify(data.getComputerSlotBonus(4)) !== '{"type":"income"}'
        || Object.keys(data.COMPUTER_DATA_SLOTS).some(slot => ![2,4].includes(Number(slot)) && data.getComputerSlotBonus(slot))) return null;
      let dataCorners = 0;
      for (const card of owner.hand) {
        const corner = cards.getDiscardActionCodeForCard(card), income = cards.getIncomeCodeForCard(card);
        const gain = cards.getIncomeGainForCard(card), key = ["credits", "energy", "handSize"][income];
        if (![0,1,2].includes(corner) || !key || !gain || Object.keys(gain).length !== 1 || gain[key] !== 1) return null;
        if (corner === 2) {
          const reward = cards.getDiscardActionMoveRewardForCard(card);
          if (reward.movementPoints !== 1 || Object.keys(reward.gain).length) return null;
        } else {
          const reward = cards.getDiscardActionRewardForCard(card);
          if (corner === 0 ? reward.dataCount !== 0 || JSON.stringify(reward.gain) !== '{"publicity":1}'
            : reward.dataCount !== 1 || Object.keys(reward.gain).length) return null;
          if (corner === 1) dataCorners += 1;
        }
      }
      const visitTypes = new Set(["visitPlanet", "visitAsteroid", "visitComet"]);
      const inertTypes = new Set(["launch", "orbit", "land", "researchTech", "signalMarked", "playCard"]);
      const slots = []; let remainingData = 0, maximumDrawCount = 1;
      for (const card of owner.reservedCards) {
        const model = cardEffects.getCardModel(card);
        if (model.pluto || model.endGameScoring || model.tasks?.length && !quietPlan || model.temporaryTasks?.length) return null;
        const copy = structuredClone(card); cardEffects.ensureCardEffectState(copy);
        for (const trigger of model.triggers || []) {
          if (copy.cardEffectState?.consumedTriggerIds.includes(trigger.id)) continue;
          const types = trigger.event.types?.length ? trigger.event.types : [trigger.event.type];
          if (types.some(type => !visitTypes.has(type) && !inertTypes.has(type))) return null;
          if (!types.some(type => visitTypes.has(type))) continue;
          const effect = trigger.effect, options = effect.options || {};
          let value;
          if (effect.type === "gain_resources") {
            if (Object.keys(options.gain || {}).some(key => !["credits", "energy", "publicity"].includes(key))) return null;
            value = (options.gain?.credits || 0) + (options.gain?.energy || 0) + (options.gain?.publicity || 0)*0.5;
          } else if (["gain_data", "draw_cards", "pick_card"].includes(effect.type)) {
            const count = Math.max(1, options.count || 1);
            value = count * (effect.type === "gain_data" ? 0.5 : 1);
            if (effect.type === "gain_data") remainingData += count;
            else maximumDrawCount = Math.max(maximumDrawCount, count);
          } else return null;
          slots.push({ card: copy, trigger, value });
        }
      }
      // 付款/插收入和访问抽牌在首次信息屏障结束；此之前不会增加牌堆可用量。
      if (cards.getAvailablePool({ ...state.cards }, state.players).length < maximumDrawCount) return null;
      let movementUpper = 0, minimumFirstPositiveMoves = null, positiveRewardSurplus = 0;
      if (probes.length && slots.some(slot => slot.value > 0.5)) {
        const cells = [];
        for (let y=1; y<=4; y+=1) for (let x=0; x<8; x+=1) {
          const content = solar.resolveVisibleContent(x,y,state.solarSystem).content;
          const type = content.kind === "planet" ? "visitPlanet" : content.kind === "asteroid" ? "visitAsteroid"
            : content.kind === "comet" ? "visitComet" : null;
          if (type) cells.push({ x,y,event: { type, planetId: content.planetId, playerId: seatId, source: "move", hasOwnOrbit: true } });
        }
        for (const slot of slots.filter(slot => slot.value > 0.5)) {
          const targets = cells.filter(cell => cardEffects.collectMatchingTriggers(
            { ...owner, reservedCards: [slot.card] }, cell.event).some(match => match.trigger.id === slot.trigger.id));
          if (!targets.length) continue;
          positiveRewardSurplus += slot.value - 0.5;
          for (const target of targets) for (const probe of probes) {
            const distance = Math.min(solar.mod8(target.x-probe.sectorX),solar.mod8(probe.sectorX-target.x))
              + Math.abs(target.y-probe.sectorY);
            minimumFirstPositiveMoves = Math.min(minimumFirstPositiveMoves ?? Infinity, Math.max(1,distance));
          }
        }
        // 每步支付至少1V、原生到达最多0.5V；每个访问槽最多抵消一次步数损失。
        const uncompensated = Math.max(0,(minimumFirstPositiveMoves || 0)-slots.length);
        movementUpper = Math.max(0,positiveRewardSurplus-uncompensated*0.5);
      }
      const stockUpper = occupied.length + owner.dataState.poolTokens.length + dataCorners + remainingData;
      const minimumDataCorners = Math.max(0,4-occupied.length-owner.dataState.poolTokens.length-remainingData);
      const incomePossible = !occupied.includes(4) && stockUpper >= 4 && owner.hand.length > minimumDataCorners;
      const incomeUpper = incomePossible ? Math.max(0,4-state.turn.roundNumber-(4-occupied.length)*0.5
        + (occupied.length < 2 ? 0.5 : 0)-minimumDataCorners*0.5) : 0;
      return freeze({ proof: "seti-post-main-visit-income-value-bound-v1", maximumValueIncrease: movementUpper+incomeUpper,
        movementUpper, incomeUpper, stockUpper, minimumDataCorners, minimumFirstPositiveMoves, positiveRewardSurplus,
        visitRewardSlots: slots.map(slot => ({ cardInstanceId: slot.card.id, ruleId: slot.trigger.id, value: slot.value })),
        minimumMoveCostValue: 1, maximumNativeArrivalValue: 0.5,
        ...(quietPlan ? { continuationProof: quietPlan.proof, continuationRetainedActionIds: quietPlan.retainedActionIds } : {}) });
    }

    function postMainOptimalPlanSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (postMainOptimalPlans.has(node)) return postMainOptimalPlans.get(node);
      const bound = postMainValueBound(node);
      let result = null;
      if (bound?.movementUpper === 0) {
        const state = readIdentityState(stored.envelope), owner = state.players.players.find(player => player.id === seatId);
        const income = bound.incomeUpper > 0;
        const fill = income ? 4-data.listComputerPlacedTokens(owner).length : 0;
        const corners = income ? Math.max(0,fill-owner.dataState.poolTokens.length) : 0;
        const canKeepBlind = (hand, needed) => hand.some(card => cards.getIncomeCodeForCard(card) === 2
          && hand.filter(other => other !== card && cards.getDiscardActionCodeForCard(other) === 1).length >= needed);
        const publicityFits = !income || fill <= 2 || owner.resources.publicity+1 <= players.RESOURCE_LIMITS.publicity;
        if (publicityFits && (!income || corners === bound.minimumDataCorners && owner.hand.length > corners
          && owner.hand.filter(card => cards.getDiscardActionCodeForCard(card) === 1).length >= corners)) {
          const resourcePlan=resourcePlanning&&income?resourceSpec(node)?.plans.find(p=>p.goal.kind==="income"):null;
          if(resourcePlanning&&income&&!resourcePlan){postMainOptimalPlans.set(node,null);return null;}
          const blind = income && (resourcePlan?cards.getIncomeCodeForCard(owner.hand.find(c=>c.id===resourcePlan.goal.incomeCardId))===2:canKeepBlind(owner.hand,corners));
          const first = node.legalActions.find(action => action.family === (corners ? "card_corner" : income ? "place_data" : "end_turn")
            && (!corners || cards.getDiscardActionCodeForCard(owner.hand.find(card => card.id === action.target?.cardInstanceId)) === 1));
          if (first) result = freeze({ proof: "seti-post-main-attained-value-shortest-plan-v1", bound,
            income, blind, ...(resourcePlan?{resourceGoal:resourcePlan.goal.id}:{}), dataCorners: corners, dataPlacements: fill,
            submissions: income ? corners+fill*2+1+(blind?0:1) : 1 });
        }
      }
      postMainOptimalPlans.set(node,result);
      return result;
    }

    function expandPostMainOptimalPlan(node, hasTime = () => true) {
      const spec = postMainOptimalPlanSpec(node);
      if (!spec) throw new Error("ANALYSIS_POST_MAIN_OPTIMAL_PLAN_INVALID");
      const prefixes = []; let current = node;
      if(resourcePlanning&&spec.income){
        const plan=resourceSpec(node)?.plans.find(p=>p.goal.kind==="income");
        const fixed=expandResourcePlan(node,plan,()=>hasTime()?null:"watchdog");
        prefixes.push(...fixed.prefixes);current=fixed.node;
        if(!fixed.complete)return{complete:false,node:current,prefixes,submissions:prefixes.length,proof:spec.proof};
        if(!["information-barrier","other-owner","terminal","turn-boundary"].includes(current.status)){
          if(fixed.goalStatus!=="completed")throw new Error("ANALYSIS_RESOURCE_ATTAINMENT_NOT_COMPLETE");
          const end=current.legalActions.find(a=>a.family==="end_turn");if(!end)throw new Error("ANALYSIS_RESOURCE_ATTAINMENT_END_MISSING");
          if(!hasTime())return{complete:false,node:current,prefixes,submissions:prefixes.length,proof:spec.proof};
          prefixes.push({node:current,action:end});current=expand(current,end.actionId);
        }
        return{complete:true,node:current,prefixes:prefixes.map((p,i)=>({...p,distance:prefixes.length-i})),submissions:prefixes.length,proof:spec.proof};
      }
      for (let step=0; step<spec.submissions; step+=1) {
        if (!hasTime()) return { complete: false, node: current, prefixes, submissions: step, proof: spec.proof };
        const stored = nodes.get(current), state = readIdentityState(stored.envelope);
        const owner = state.players.players.find(player => player.id === seatId);
        let choices;
        if (step < spec.dataCorners) {
          const remaining = spec.dataCorners-step-1;
          choices = current.legalActions.filter(action => {
            if (action.family !== "card_corner") return false;
            const card = owner.hand.find(card => card.id === action.target?.cardInstanceId);
            if (!card || cards.getDiscardActionCodeForCard(card) !== 1) return false;
            const hand = owner.hand.filter(other => other !== card);
            return hand.length > remaining && hand.filter(other => cards.getDiscardActionCodeForCard(other) === 1).length >= remaining
              && (!spec.blind || hand.some(blind => cards.getIncomeCodeForCard(blind) === 2
                && hand.filter(other => other !== blind && cards.getDiscardActionCodeForCard(other) === 1).length >= remaining));
          });
        } else if (spec.income && step < spec.dataCorners+spec.dataPlacements*2) {
          const place = (step-spec.dataCorners)%2 === 0;
          choices = current.legalActions.filter(action => place ? action.family === "place_data"
            : action.family === "choose_target" && action.target?.target === "computer");
          if (choices.length !== 1 || !place && current.legalActions.length !== 1) throw new Error("ANALYSIS_POST_MAIN_DATA_PLAN_CHANGED");
        } else if (spec.income && step === spec.dataCorners+spec.dataPlacements*2) {
          if (current.legalActions.some(action => action.family !== "choose_card" || !action.target?.choiceId?.startsWith("income:"))) {
            throw new Error("ANALYSIS_POST_MAIN_INCOME_PLAN_CHANGED");
          }
          choices = current.legalActions.filter(action => {
            const card = owner.hand.find(card => card.id === action.target?.cardInstanceId);
            return card && (cards.getIncomeCodeForCard(card) === 2) === spec.blind;
          });
        } else choices = current.legalActions.filter(action => action.family === "end_turn");
        choices.sort((a,b) => a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0);
        const action = choices[0];
        if (!action) throw new Error("ANALYSIS_POST_MAIN_OPTIMAL_ACTION_MISSING");
        prefixes.push({ node: current, action, distance: spec.submissions-step });
        current = expand(current,action.actionId);
        if (["information-barrier","other-owner","terminal","turn-boundary"].includes(current.status) !== (step === spec.submissions-1)) {
          throw new Error("ANALYSIS_POST_MAIN_OPTIMAL_BOUNDARY_CHANGED");
        }
      }
      return { complete: true, node: current, prefixes, submissions: spec.submissions, proof: spec.proof };
    }

    function postMainBorrowSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (postMainBorrows.has(node)) return postMainBorrows.get(node);
      const result = describePostMainBorrow(stored, node);
      postMainBorrows.set(node, result);
      return result;
    }

    function describePostMainBorrow(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = readIdentityState(stored.envelope), owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      const start = node.legalActions.find(action => action.family === "industry" && action.target?.abilityId === "turing_borrow_tech");
      if (!owner?.mainActionCompleted || owner.industryBorrowedTechTileId || !start
        || company?.activeAbilityId !== "turing_borrow_tech" || !knownCardMoneyOrder(node)
        || Object.values(state.aliens.aliens).some(alienState.isAlienReadyToReveal)
        || Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length
        || state.pieces.rockets.some(rocket => [rocket.playerId, rocket.color, rocket.playerColor].some(id => id === seatId || id === owner.color)
          && ((rocket.kind ?? "standard") !== "standard" || rocket.fossilId != null))
        || node.legalActions.some(action => !["end_turn", "place_data", "quick_trade", "card_corner", "move", "industry", "complete_task"].includes(action.family))) return null;
      // 主行动已结束，保留区不得再开启发射/扫描/轨道/登陆/研究等科技相关流程。
      // 后续移动仍保留 orange2；不把有收益的访问触发器当作无效任务。
      const quiet = effect => ["gain_resources", "gain_data", "draw_cards", "pick_card", "card_move"].includes(effect.type);
      if (owner.reservedCards.some(card => {
        const model = cardEffects.getCardModel(card);
        return Boolean(model.pluto) || [...(model.tasks || []), ...(model.temporaryTasks || [])].some(task => !task.rewards.every(quiet))
          || (model.triggers || []).some(trigger => !quiet(trigger.effect));
      })) return null;
      const available = Object.keys(state.tech.stacks).filter(id => /^(orange|purple)[1-4]$/.test(id)
        && techBoardState.isSlotAvailable(state.tech, id));
      const retained = available.filter(id => id === "orange2"
        && (!owner.techState.ownedTiles.orange2 || owner.techState.disabledTiles.orange2));
      const excluded = available.filter(id => !retained.includes(id));
      return excluded.length ? freeze({ proof: "seti-post-main-turing-shorter-continuation-v1",
        industryActionId: start.actionId, availableTileIds: available, retainedTileIds: retained,
        excludedTileIds: excluded, omittedSubmissions: 2 }) : null;
    }

    function expandPostMainBorrow(node, tileId) {
      const spec = postMainBorrowSpec(node);
      if (!spec?.retainedTileIds.includes(tileId)) throw new Error("ANALYSIS_POST_MAIN_BORROW_INVALID");
      const stored = nodes.get(node), key = JSON.stringify([stored.serial, "post-main-borrow", tileId]);
      if (cache.has(key)) { cacheHits += 1; return cache.get(key); }
      restoreEnvelope(stored.envelope, true);
      const comp = fork.composition || fork, start = node.legalActions.find(action => action.actionId === spec.industryActionId);
      executeCurrent(start.actionId);
      const choices = legalActions(comp);
      if (choices.length !== spec.availableTileIds.length || choices.some(action => action.family !== "choose_target"
        || !spec.availableTileIds.includes(action.target?.tileId))) throw new Error("ANALYSIS_POST_MAIN_BORROW_CHOICES_CHANGED");
      const choice = choices.find(action => action.target.tileId === tileId), outcome = executeCurrent(choice.actionId);
      const child = finishChild(outcome.before, outcome.result);
      if (child.status !== "stable") throw new Error("ANALYSIS_POST_MAIN_BORROW_BOUNDARY_CHANGED");
      return remember(key, freeze({ node: child, submissions: 2, actions: [start, choice], proof: spec.proof }));
    }

    function postMainPlanSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (postMainPlans.has(node)) return postMainPlans.get(node);
      const at = now();
      const beforeMain = node.status === "stable" && !stored.envelope.session
        && !readIdentityState(stored.envelope).players.players.find(player => player.id === seatId)?.mainActionCompleted;
      const result = beforeMain ? null : describePostMainPlan(stored, node);
      milliseconds.postMainPlan += now() - at;
      postMainPlans.set(node, result);
      return result;
    }

    function describePostMainPlan(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = JSON.parse(stored.envelope.committedState);
      const owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      const quietCompany = company && ((company.activeAbilityId === "helios_remove_tech_income"
        && company.passiveIds.every(id => id === "helios_passive_reward_slots"))
        || (company.activeAbilityId === null && company.passiveIds.length === 1 && company.passiveIds[0] === "alien_lab_panels"));
      const ownRockets = owner ? state.pieces.rockets.filter(rocket => [rocket.playerId, rocket.color, rocket.playerColor]
        .some(id => id === seatId || id === owner.color)) : [];
      if (state.turn.currentPlayerId !== seatId || !owner?.mainActionCompleted
        || owner.passCompletionPending || state.turn.passedPlayerIds.includes(seatId) || state.match.initialSetup
        || state.turn.activePlayerCount !== 4 || owner.industryBorrowedTechTileId
        || !hasPostMainInertReservations(state, ownRockets.length > 0)
        || state.turn.cardTurnEventBonuses?.length
        || Object.values(state.aliens.aliens).some(slot => slot.revealed || alienState.isAlienReadyToReveal(slot))
        || !quietCompany
        || ownRockets.some(rocket => (rocket.kind ?? "standard") !== "standard" || rocket.fossilId != null)) return null;
      const weights = { credits: 1, energy: 1, publicity: 0.5, availableData: 0.5, additionalPublicScan: 0.5, handSize: 1 };
      if (Object.keys(weights).some(key => !Number.isSafeInteger(owner.income[key]) || owner.income[key] < 0
        || (key !== "handSize" && (!Number.isSafeInteger(owner.resources[key]) || owner.resources[key] < 0)))
        || !Number.isSafeInteger(owner.resources.score) || owner.resources.score < 0) return null;
      const tradeIds = new Set(["credits-for-energy", "credits-for-card", "cards-for-credit", "cards-for-energy",
        "cards-for-pick-card", "energy-for-card", "energy-for-credit", "publicity-for-card"]);
      for (const trade of quickTrades.TRADE_ACTIONS) {
        if (trade.moveStep) {
          if (trade.id !== "energy-for-move" || trade.cost.energy !== 1 || Object.keys(trade.cost).length !== 1
            || Object.keys(trade.gain).length) return null;
          continue;
        }
        const costKeys = Object.keys(trade.cost), gainKeys = Object.keys(trade.gain);
        const costKey = costKeys[0], gainKey = gainKeys[0];
        if (!tradeIds.has(trade.id) || costKeys.length !== 1 || gainKeys.length !== 1
          || !["credits", "energy", "publicity", "handSize"].includes(costKey)
          || !["credits", "energy", "handSize"].includes(gainKey)
          || !Number.isSafeInteger(trade.cost[costKey]) || trade.cost[costKey] < 1 || trade.gain[gainKey] !== 1
          || trade.cost[costKey] * weights[costKey] <= weights[gainKey]) return null;
      }
      if (node.legalActions.some(action => {
        if (!["end_turn", "place_data", "quick_trade", "card_corner", "move"].includes(action.family)) return true;
        if (action.family === "move") return !Number.isSafeInteger(action.payload?.requiredMovePoints)
          || action.payload.requiredMovePoints < 1;
        if (action.family === "card_corner") return action.payload?.multiplier !== 1;
        if (action.family !== "quick_trade") return false;
        const trade = quickTrades.getTradeAction(action.target?.tradeId);
        return !trade || JSON.stringify(action.payload?.cost) !== JSON.stringify(trade.cost)
          || JSON.stringify(action.payload?.gain) !== JSON.stringify(trade.gain);
      })) return null;
      const dataCornerIds = new Set();
      for (const card of owner.hand) {
        if (!["basic", "space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card)) return null;
        const code = cards.getDiscardActionCodeForCard(card);
        if (code === 0) {
          const reward = cards.getDiscardActionRewardForCard(card);
          if (reward?.dataCount !== 0 || reward.gain.publicity !== 1 || Object.keys(reward.gain).length !== 1) return null;
        } else if (code === 1) {
          const reward = cards.getDiscardActionRewardForCard(card);
          if (reward?.dataCount !== 1 || Object.keys(reward.gain).length) return null;
          dataCornerIds.add(card.id);
        } else if (code === 2) {
          const reward = cards.getDiscardActionMoveRewardForCard(card);
          if (reward?.movementPoints !== 1 || Object.keys(reward.gain).length) return null;
        } else return null;
      }
      const kept = node.legalActions.filter(action => ["end_turn", "place_data"].includes(action.family)
        || (action.family === "card_corner" && dataCornerIds.has(action.target?.cardInstanceId)));
      const excluded = node.legalActions.filter(action => !kept.includes(action));
      if (!kept.some(action => action.family === "end_turn") || !excluded.length) return null;
      const poolCount = owner.dataState.poolTokens.length;
      if (owner.resources.availableData !== poolCount) return null;
      const occupied = data.listComputerPlacedTokens(owner).map(token => token.placementSlot);
      const maximumDataCount = poolCount + dataCornerIds.size;
      const reachable = Object.keys(data.COMPUTER_DATA_SLOTS).map(Number).sort((a, b) => a - b)
        .filter(slot => !occupied.includes(slot)).slice(0, maximumDataCount);
      const incomeReachable = reachable.includes(4);
      if (incomeReachable) {
        let blindCards = 0;
        for (const card of owner.hand) {
          const code = cards.getIncomeCodeForCard(card), gain = cards.getIncomeGainForCard(card);
          const key = ["credits", "energy", "handSize"][code];
          if (!key || !gain || Object.keys(gain).length !== 1 || gain[key] !== 1) return null;
          if (code === 2 && (++blindCards > 1 || !dataCornerIds.has(card.id))) return null;
        }
        // 新收入改变a板公式；本版数值增益界只覆盖没有本席a板标记的窗口。
        if (state.finalScoring.tiles.a?.marks.some(mark => mark.playerId === seatId)) return null;
      }
      let maximumValueIncrease = dataCornerIds.size * weights.availableData, additionalScore = 0;
      function includeBonus(bonus) {
        if (!bonus) return true;
        if (bonus.type === "income" && Object.keys(bonus).length === 1 && incomeReachable) {
          maximumValueIncrease += 5 - state.turn.roundNumber;
          return true;
        }
        if (bonus.type === "choose_card" && Object.keys(bonus).length === 1) { maximumValueIncrease += 1; return true; }
        const weight = bonus.type === "score" ? 1 : weights[bonus.type];
        if (!["score", "credits", "energy", "publicity"].includes(bonus.type)
          || Object.keys(bonus).some(key => key !== "type" && key !== bonus.type)
          || !Number.isSafeInteger(bonus[bonus.type]) || bonus[bonus.type] < 0) return false;
        maximumValueIncrease += bonus[bonus.type] * weight;
        if (bonus.type === "score") additionalScore += bonus.score;
        return true;
      }
      for (const slot of reachable) if (!includeBonus(data.getComputerSlotBonus(slot))
        || !includeBonus(data.getComputerSlotBlueColumnBonus(owner, slot))) return null;
      if (maximumDataCount) for (const slot of Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number)) {
        const required = data.getRequiredComputerSlotForBlueBonus(slot);
        if (!data.hasBlueTechInBoardSlot(owner, slot) || data.listBlueBonusPlacedTokens(owner).some(token => token.blueSlot === slot)
          || (!occupied.includes(required) && !reachable.includes(required))) continue;
        if (!includeBonus(data.getBlueBonusPlacementReward(owner, slot))) return null;
      }
      const thresholds = state.finalScoring.thresholds;
      if (!thresholds.length || thresholds.some(value => !Number.isSafeInteger(value) || value <= 0)) return null;
      const scoreThreshold = Math.min(...thresholds), scoreUpperBound = owner.resources.score + additionalScore;
      if (scoreUpperBound >= scoreThreshold) return null;
      const transition = previewTurn(state);
      if (!transition.turnAdvanced || transition.roundAdvanced || transition.gameEnded || transition.nextPlayerId === seatId) return null;
      return freeze({ proof: "seti-quiet-post-main-default-value-plan-v6", retainedActionIds: kept.map(action => action.actionId),
        excludedActionIds: excluded.map(action => action.actionId), maximumValueIncrease, scoreUpperBound, scoreThreshold,
        incomeReachable, retainedDataCardCount: dataCornerIds.size });
    }

    function openingResourceOrder(node) {
      return resourceOrder(node, openingOrders, true);
    }

    function openingMoneyCapacity(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (openingCapacities.has(node)) return openingCapacities.get(node);
      const order = openingResourceOrder(node);
      const result = order && describeOpeningMoneyCapacity(stored, node, order);
      openingCapacities.set(node, result || null);
      return result || null;
    }

    function openingPlanSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (openingPlans.has(node)) return openingPlans.get(node);
      const capacity = openingMoneyCapacity(node);
      let result = null;
      if (capacity && capacity.credits >= capacity.moneyCapacity.credits && capacity.energy >= capacity.moneyCapacity.energy) {
        const state = JSON.parse(stored.envelope.committedState);
        const owner = state.players.players.find(player => player.id === seatId);
        const researchCost = techResolver.getResearchPublicityCost(owner), handLimit = probeTurnSession.PASS_HAND_LIMIT;
        if (Number.isSafeInteger(researchCost) && researchCost >= 0 && owner.resources.publicity >= Math.max(3, researchCost)
          && handLimit === 4 && owner.hand.length <= handLimit + 1) {
          const unnecessaryTrades = new Set(["credits-for-energy", "energy-for-credit", "cards-for-credit", "cards-for-energy"]);
          // 无蓝科技时唯一现有数据只能放到无奖励的首位；首个主行动在信息边界前
          // 最多再给4数据，六格池不溢出。保留这枚数据严格多0.5V且不丢失行动资格。
          const skipFirstData = owner.dataState.poolTokens.length === 1 && owner.dataState.placedTokens.length === 0
            && Object.keys(data.DATA_POOL_SLOTS).length >= 5 && !data.getComputerSlotBonus(1)
            && !data.getComputerSlotBlueColumnBonus(owner, 1);
          const excluded = node.legalActions.filter(action => action.family === "quick_trade"
            ? unnecessaryTrades.has(action.target?.tradeId) : (action.family === "place_data" && skipFirstData)
              || (action.family === "card_corner" && (action.payload.kind === "move" || owner.hand.length <= handLimit)));
          const kept = node.legalActions.filter(action => !excluded.includes(action));
          if (excluded.length && kept.some(action => action.family === "pass")) result = freeze({
            proof: "seti-funded-opening-default-value-plan-v2", retainedActionIds: kept.map(action => action.actionId),
            excludedActionIds: excluded.map(action => action.actionId), handLimit, researchCost,
            dataPlacementPruned: skipFirstData,
            passPreparationActionIds: owner.hand.length > handLimit
              ? kept.filter(action => action.family === "card_corner" && action.payload.kind === "resource").map(action => action.actionId) : [],
          });
        }
      }
      if (!result) result = describeAlienLabOpeningPlan(stored, node);
      openingPlans.set(node, result);
      return result;
    }

    function describeAlienLabOpeningPlan(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = JSON.parse(stored.envelope.committedState);
      const owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      if (state.turn.currentPlayerId !== seatId || !owner || owner.mainActionCompleted || owner.passCompletionPending
        || state.turn.activePlayerCount !== 4 || state.turn.passedPlayerIds.includes(seatId) || state.match.initialSetup
        || company?.activeAbilityId !== null || company.passiveIds.length !== 1 || company.passiveIds[0] !== "alien_lab_panels"
        || owner.industryBorrowedTechTileId || Object.values(owner.techState.ownedTiles).some(Boolean)
        || state.players.players.some(player => player.reservedCards.length) || state.turn.cardTurnEventBonuses?.length
        || Object.values(state.aliens.aliens).some(slot => slot.revealed || alienState.isAlienReadyToReveal(slot))
        || state.pieces.rockets.some(rocket => [rocket.playerId, rocket.color, rocket.playerColor]
          .some(id => id === seatId || id === owner.color))
        || owner.blueBonusResources?.credits || owner.blueBonusResources?.energy
        || probeTurnSession.PASS_HAND_LIMIT !== 4 || !hasStandardOpeningTrades()
        || owner.resources.credits < 3 || owner.resources.energy < 2
        || owner.hand.length > 3 || new Set(owner.hand.map(card => card.cardId)).size !== owner.hand.length
        || state.cards.publicCards.length !== 3 || state.cards.publicCards.some(card => !card
          || !["basic", "space-agency"].includes(card.set) || !cards.getCatalogEntryForCard(card))
        || !state.cards.passReservePiles?.[state.turn.roundNumber]?.length) return null;
      if (Object.values(owner.resources).some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000)
        || Object.values(owner.income).some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000)
        || !state.finalScoring.thresholds.length || state.finalScoring.thresholds.some(value =>
          !Number.isSafeInteger(value) || value <= owner.resources.score)) return null;
      const audited = { "dlc_9.png": [1, 2], "b_86.webp": [1, 0], "b_114.webp": [2, 1] };
      let dataCorners = 0;
      for (const card of owner.hand) {
        const entry = cards.getCatalogEntryForCard(card), cost = cardEffects.getCardPlayCost(card);
        if (!Object.hasOwn(audited, card.cardId) || !entry || card.set !== entry.set || card.price !== entry.price
          || card.cardTypeCode !== entry.card_type_code || card.scanActionCode !== entry.scan_action_code
          || cards.getIncomeCodeForCard(card) !== audited[card.cardId][1]
          || cards.getDiscardActionCodeForCard(card) !== audited[card.cardId][0]
          || Object.keys(cost).some(key => key !== "credits") || !Number.isSafeInteger(cost.credits ?? 0)
          || (cost.credits ?? 0) < 0 || (cost.credits ?? 0) > 3) return null;
        if (cards.getDiscardActionCodeForCard(card) === 1) dataCorners += 1;
      }
      const occupied = data.listComputerPlacedTokens(owner).map(token => token.placementSlot).sort((a, b) => a - b);
      // 池、已放数据与剩余数据角标的总量不足6，主行动前不能解锁分析。
      if (data.ANALYZE_REQUIRED_COMPUTER_SLOT !== 6 || owner.resources.availableData !== owner.dataState.poolTokens.length
        || occupied.length !== owner.dataState.placedTokens.length || occupied.some((slot, index) => slot !== index + 1)
        || occupied.length + owner.dataState.poolTokens.length + dataCorners > 5
        || JSON.stringify(scanEffects.getStandardScanCost(owner)) !== '{"energy":2}'
        || JSON.stringify(rocketAbilities.getLaunchCost({ turn: state.turn }, owner)) !== '{"credits":1}'
        || owner.hand.some(card => ["dlc_9.png", "b_86.webp"].includes(card.cardId))
          && !["purple1", "purple2", "purple3", "purple4"].some(id => state.tech.stacks[id]?.remaining > 0)) return null;
      const transition = previewTurn(state);
      if (!transition.turnAdvanced || transition.roundAdvanced || transition.gameEnded || transition.nextPlayerId === seatId) return null;
      if (node.legalActions.some(action => !["launch", "scan", "research_tech", "play_card", "pass", "quick_trade",
        "card_corner", "place_data"].includes(action.family) || action.family === "card_corner" && action.payload?.multiplier !== 1)) return null;
      const unnecessaryTrades = new Set(["credits-for-energy", "energy-for-credit", "cards-for-credit", "cards-for-energy"]);
      const excluded = node.legalActions.filter(action => action.family === "quick_trade" ? unnecessaryTrades.has(action.target?.tradeId)
        : action.family === "card_corner" && action.payload.kind === "move");
      const kept = node.legalActions.filter(action => !excluded.includes(action));
      if (!excluded.length || !kept.some(action => action.family === "pass")) return null;
      return freeze({ proof: "seti-alien-lab-funded-money-opening-plan-v1",
        retainedActionIds: kept.map(action => action.actionId), excludedActionIds: excluded.map(action => action.actionId),
        handLimit: probeTurnSession.PASS_HAND_LIMIT, passPreparationActionIds: [] });
    }

    function expandOpeningPass(node, actionId) {
      const plan = openingPlanSpec(node);
      if (!plan?.passPreparationActionIds.includes(actionId)) throw new Error("ANALYSIS_OPENING_PASS_INVALID");
      const corner = node.legalActions.find(action => action.actionId === actionId);
      const prepared = expand(node, actionId);
      const pass = prepared.status === "stable" && prepared.legalActions.find(action => action.family === "pass");
      if (!pass) throw new Error("ANALYSIS_OPENING_PASS_CONTINUATION_MISSING");
      return freeze({ node: expand(prepared, pass.actionId), submissions: 2, actions: [corner, pass],
        proof: "seti-funded-opening-publicity-pass-normal-form-v1" });
    }

    function describeOpeningMoneyCapacity(stored, node, order) {
      const state = JSON.parse(stored.envelope.committedState);
      const owner = state.players.players.find(player => player.id === seatId);
      // 本界只覆盖一个生产性钱电支出；扫描/公共取牌在实际补牌屏障停止，
      // 发射和零效果牌之后仅剩已证明无收益的移动/交易及免费放数据。
      if (JSON.stringify(scanEffects.getStandardScanCost(owner)) !== '{"credits":1,"energy":2}'
        || JSON.stringify(rocketAbilities.getLaunchCost({ turn: state.turn }, owner)) !== '{"credits":2}') return null;
      if (state.turn.activePlayerCount !== 4 || owner.industryBorrowedTechTileId
        || Object.values(state.aliens.aliens).some(slot => alienState.isAlienReadyToReveal(slot))
        || owner.blueBonusResources?.credits || owner.blueBonusResources?.energy
        || owner.dataState.poolTokens.length + owner.dataState.placedTokens.length > 1
        || owner.resources.availableData !== owner.dataState.poolTokens.length
        || owner.hand.length > 5 || new Set(owner.hand.map(card => card.cardId)).size !== owner.hand.length
        || state.cards.publicCards.length !== 3 || state.cards.publicCards.some(card => !card)
        || state.cards.drawPileCardIds.length < 3
        || Object.keys(state.data.nebulae).some(id => data.getSectorRanking(state.data, id).some(entry =>
          (entry.playerId === seatId || entry.playerColor === owner.color) && entry.count >= 3))
        || state.cards.publicCards.some(card => !cards.getCatalogEntryForCard(card)
          || ![0, 1, 2].includes(cards.getDiscardActionCodeForCard(card)))) return null;
      if (Object.values(owner.resources).some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000)
        || Object.values(owner.income).some(value => !Number.isSafeInteger(value) || value < 0 || value > 1000000)
        || !state.finalScoring.thresholds.length
        || state.finalScoring.thresholds.some(value => !Number.isSafeInteger(value) || value <= owner.resources.score)) return null;
      for (const card of owner.hand) {
        const cost = cardEffects.getCardPlayCost(card), code = cards.getDiscardActionCodeForCard(card);
        if (Object.keys(cost).some(key => key !== "credits") || !Number.isSafeInteger(cost.credits ?? 0)
          || (cost.credits ?? 0) < 0 || (cost.credits ?? 0) > 1 || ![0, 2].includes(code)) return null;
        const reward = code === 0 ? cards.getDiscardActionRewardForCard(card) : cards.getDiscardActionMoveRewardForCard(card);
        if (code === 0 ? reward?.dataCount !== 0 || reward.gain.publicity !== 1 || Object.keys(reward.gain).length !== 1
          : reward?.movementPoints !== 1 || Object.keys(reward.gain).length) return null;
      }
      if (!hasStandardOpeningTrades()) return null;
      if (node.legalActions.some(action => !["launch", "scan", "research_tech", "play_card", "pass", "quick_trade",
        "card_corner", "place_data"].includes(action.family) || (action.family === "card_corner" && action.payload?.multiplier !== 1))) return null;
      return freeze({ ...order, moneyCapacity: { credits: 2, energy: 2 },
        capacityProof: "seti-helios-opening-money-capacity-v1" });
    }

    function hasStandardOpeningTrades() {
      const expectedTrades = {
        "credits-for-energy": [{ credits: 2 }, { energy: 1 }], "energy-for-credit": [{ energy: 2 }, { credits: 1 }],
        "credits-for-card": [{ credits: 2 }, { handSize: 1 }], "energy-for-card": [{ energy: 2 }, { handSize: 1 }],
        "cards-for-credit": [{ handSize: 2 }, { credits: 1 }], "cards-for-energy": [{ handSize: 2 }, { energy: 1 }],
        "cards-for-pick-card": [{ handSize: 2 }, { handSize: 1 }], "publicity-for-card": [{ publicity: 3 }, { handSize: 1 }],
      };
      return !quickTrades.TRADE_ACTIONS.some(trade => trade.moveStep ? trade.id !== "energy-for-move"
        || JSON.stringify(trade.cost) !== '{"energy":1}' || Object.keys(trade.gain).length
        : JSON.stringify([trade.cost, trade.gain]) !== JSON.stringify(expectedTrades[trade.id]));
    }

    function resourceOrder(node, orders, opening) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (orders.has(node)) return orders.get(node);
      const at = now();
      // 两份旧证明都排除本席保留牌；用已有私有解码先判定，避免重复解析整个存档。
      const hasReservation = node.status === "stable" && !stored.envelope.session
        && readIdentityState(stored.envelope).players.players.find(player => player.id === seatId)?.reservedCards.length;
      const result = hasReservation ? null : describeResourceOrder(stored, node, opening);
      milliseconds.resourceOrder += now() - at;
      orders.set(node, result);
      return result;
    }

    function describeResourceOrder(stored, node, opening) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = JSON.parse(stored.envelope.committedState);
      const owner = state.players.players.find(player => player.id === seatId);
      if (state.turn.currentPlayerId !== seatId || !owner || Boolean(owner.mainActionCompleted) !== !opening
        || owner.passCompletionPending || state.turn.passedPlayerIds.includes(seatId)
        || state.match.initialSetup || (owner.reservedCards || []).length
        || (state.turn.cardTurnEventBonuses || []).length
        || Object.values(state.aliens.aliens).some(slot => slot.revealed)) return null;
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      if (opening) {
        if (company?.activeAbilityId !== "helios_remove_tech_income"
          || company.passiveIds.some(id => id !== "helios_passive_reward_slots")) return null;
      } else {
        const passives = company && POST_MAIN_MONEY_COMPANIES[company.activeAbilityId ?? "no_active"];
        if (!passives || passives.length !== company.passiveIds.length
          || company.passiveIds.some(id => !passives.includes(id))
          || state.players.players.some(player => player.reservedCards.length)
          || state.cards.publicCards.some(card => card && (!["basic", "space-agency"].includes(card.set)
            || !cards.getCatalogEntryForCard(card)))
          || (owner.industryLastPlayedCardThisRound && (!["basic", "space-agency"].includes(owner.industryLastPlayedCardThisRound.set)
            || !cards.getCatalogEntryForCard(owner.industryLastPlayedCardThisRound)))) return null;
      }
      if (owner.hand.some(card => !["basic", "space-agency"].includes(card.set)
        || !cards.getCatalogEntryForCard(card))) return null;
      if (opening) {
        const knownCards = new Set(["dlc_27.png", "b_44.webp", "b_23.webp", "dlc_22.png", "b_48.webp"]);
        // 仅覆盖已逐张审计的首个主行动窗口；未审计的牌、科技和外部触发器不套用。
        if (owner.hand.some(card => !knownCards.has(card.cardId))
          || Object.values(owner.techState.ownedTiles).some(Boolean)
          || state.players.players.some(player => player.reservedCards.length)
          || state.pieces.rockets.some(rocket => [rocket.playerId, rocket.color, rocket.playerColor]
            .some(id => id === seatId || id === owner.color))
          || state.cards.publicCards.some(card => card && !["basic", "space-agency"].includes(card.set))) return null;
      }
      const credits = owner.resources.credits, energy = owner.resources.energy;
      const blueCredits = owner.blueBonusResources?.credits ?? 0;
      const blueEnergy = owner.blueBonusResources?.energy ?? 0;
      const vector = { credits, energy, blueCredits, blueEnergy };
      if (Object.values(vector).some(value => !Number.isSafeInteger(value) || value < 0)
        || blueCredits > credits || blueEnergy > energy) return null;
      // 复用正式推进规则；同 owner 的下一回合可能重新打出零资源条件牌，不能使用本证明。
      const transition = previewTurn(state);
      if (!transition.turnAdvanced || transition.roundAdvanced || transition.gameEnded
        || transition.nextPlayerId === seatId) return null;
      // 蓝槽留存已通过 blueBonusAssets 公开；此版仍保守要求精确相同，不扩大支配关系。
      const neutralOwner = { ...owner, resources: { ...owner.resources, credits: 0, energy: 0 } };
      const neutral = { ...state, players: { ...state.players,
        players: state.players.players.map(player => player.id === seatId ? neutralOwner : player) } };
      const scope = opening ? "opening-resource-order" : "post-main-resource-order";
      const key = forwardIdentity(stored.envelope, scope, null, neutral);
      if (!resourceGroups.has(key)) resourceGroups.set(key, Object.freeze({}));
      return freeze({ group: resourceGroups.get(key), credits, energy,
        proof: opening ? "seti-helios-opening-money-simulation-v1" : "seti-standard-company-post-main-money-simulation-v2" });
    }

    function close() {
      (fork?.composition || fork)?.dispose?.();
      fork = null;
      loadedEnvelope = null;
      decodedStates.clear(); decodedStateCacheBytes = 0;
      envelopeObservations = new WeakMap(); stateRequirements = new WeakMap(); goalCatalogs = new WeakMap();
      nodes = new WeakMap();
      observationReleasers = new WeakMap();
      normalizedIdentityStates = new Map();
      movementPolicies = new WeakMap();
      movementRouteCache.clear();
      movementTimingCache.clear();
      movementPlanning = false;
      cardPickPlanning = false;
      resourcePlanning = false;finalMarkPlanning=false;scanPlanning=false;localSpecs=new WeakMap();
      resourceSpecs = new WeakMap();
      cardPickSpecs = new WeakMap();
      envelopeCardSpecs = new WeakMap();
      openedRoot = null;
      identities.clear();
      resourceOrders = new WeakMap();
      knownMoneyOrders = new WeakMap();
      openingOrders = new WeakMap();
      openingCapacities = new WeakMap();
      openingPlans = new WeakMap();
      cardTradeBounds = new WeakMap();
      passReserveBounds = new WeakMap();
      cornerChoices = new WeakMap();
      preMainDataPlans = new WeakMap();
      postMainPlans = new WeakMap();
      postMainBorrows = new WeakMap();
      scanValueBounds = new WeakMap();
      postMainValueBounds = new WeakMap();
      postMainOptimalPlans = new WeakMap();
      resourceGroups.clear();
      cache.clear();
      clearPrefixGraph();
      rootObservation = null;
      publicSeed = null;rootTurnKey=null;
    }

    function releaseBoundaryObservation(node) {
      if (!fork || !nodes.has(node)) throw new Error("ANALYSIS_NODE_INVALID");
      if (!["other-owner","terminal","information-barrier","turn-boundary"].includes(node.status)) throw new Error("ANALYSIS_BOUNDARY_REQUIRED");
      observationReleasers.get(node)();
    }

    function getDiagnostics() {
      const picks=cardPickPlanner.getDiagnostics();
      return freeze({ cardPick:{...picks,rankingCacheHitsThisRoot:picks.rankingCacheHits-cardPickRootStats.rankingCacheHits,
        rankingCacheMissesThisRoot:picks.rankingCacheMisses-cardPickRootStats.rankingCacheMisses,rankedCardsThisRoot:picks.rankedCards-cardPickRootStats.rankedCards}, goalMovementGeometryNodes, movementRouteCacheEntries: movementRouteCache.size, maxMovementRouteCacheEntries: 64, nodeCount, submissionCount, cacheHits, stableRestoreSkips, movementTimingCacheHits, movementTimingCacheMisses, cacheEntries: cache.size,
        observationCount, observationReleases, normalizedIdentityCacheEntries:normalizedIdentityStates.size, maxNormalizedIdentityCacheEntries:64, identityCount: identities.size, maxCacheEntries, sharedPrefixEdges:prefixEdges.size,sharedPrefixNodes:prefixNodes.size,sharedPrefixHits:prefixHits,
        decodedStateCacheEntries: decodedStates.size, maxDecodedStateCacheEntries, decodedStateCacheBytes, maxDecodedStateCacheBytes,
        observationCacheHits, resourceQueryHits, resourceQueryMisses, goalCatalogHits, goalCatalogMisses,
        committedDecodeCount, committedDecodeHits,
        selectionEvidenceEntries: selectionCertificate ? 1 : 0, maxSelectionEvidenceEntries: 1,
        planEvidenceEntries: planCertificate ? 1 : 0, planPrefixEntries: planCertificate?.rows.length || 0, maxPlanPrefixEntries: 32,
        milliseconds: { ...milliseconds } });
    }

    function identity(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      return stored.identity;
    }

    return Object.freeze({ openRoot, expand, identity, releaseBoundaryObservation, getResourcePrefixGraph, setDecisionPlanning, localDecisionSpec, setResourcePlanning, resourceSpec, expandResourcePlan, setCardPickPlanning, cardPickSpec, expandWithCardPick, setMovementPlanning, goalMovementSpec, expandGoalMovementPlan, selectionSpec, selectionPlans, expandSelection,
      rememberSelection, reuseSelection, rememberPlan, reusePlan, exportPlan, importPlan, knownCardMoneyOrder, postMainResourceOrder, openingResourceOrder, openingMoneyCapacity, openingPlanSpec, expandOpeningPass,
      cardTradeBound, passReserveChoiceSpec, preMainDataPlanSpec, postMainCornerChoiceSpec, postMainPlanSpec, postMainBorrowSpec, expandPostMainBorrow, standardScanValueBound, postMainValueBound, postMainOptimalPlanSpec, expandPostMainOptimalPlan, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
