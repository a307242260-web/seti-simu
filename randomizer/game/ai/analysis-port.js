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
    common ? require("./local-decision-plans") : root.SetiLocalDecisionPlans,
    common ? require("./state-value") : root.SetiStateValue,
    common ? require("./funded-movement-tail") : root.SetiFundedMovementTail,
    common ? require("../end-game-scoring") : root.SetiEndGameScoring,
    common ? require("../aliens/jiuzhe") : root.SetiAlienJiuzhe);
  if (common) module.exports = api;
  else root.SetiAnalysisPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (ruleComposition, cardEffects, cards, industryCatalog, turnFlow, data, alienState, quickTrades, scanEffects, rocketAbilities, techResolver, probeTurnSession, techBoardState, solar, rockets, players, scienceSession, goalMovement, productionKernel, cardPickPlanningApi, resourceDemand, localPlans, stateValue, fundedMovement, endScoring, jiuzhe) {
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
  function forwardIdentity(envelope, status, boundary, stateOverride = null, stateCache = null, subtreeCache = null) {
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
    let unstableSubtrees=0;
    function normalize(value, key = "") {
      // Cached children must be independent of every Session prefix, including
      // a different future prefix. Shallow freezing cannot protect a child.
      if(subtreeCache&&typeof value==="string"&&referenceKeys.has(key)&&/effect-session-[0-9]+:(?:effect|group):[0-9]+/.test(value))unstableSubtrees++;
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
      const before=unstableSubtrees,immutable=subtreeCache&&Object.isFrozen(value);
      if(subtreeCache&&!immutable)unstableSubtrees++;
      if(immutable&&subtreeCache.values.has(value)){subtreeCache.hits++;return subtreeCache.values.get(value);}
      const result=normalizeObject(value);
      if(immutable&&unstableSubtrees===before){subtreeCache.values.set(value,result);subtreeCache.stores++;}
      return result;
    }
    function normalizeObject(value) {
      // Most canonical slices already have sorted keys and need no change.
      // Keep them read-only; allocate only when normalization actually differs.
      if (Array.isArray(value)) {
        let result=null;
        for(let i=0;i<value.length;i++){
          const item=normalize(value[i]);
          if(!result&&item!==value[i])result=value.slice(0,i);
          if(result)result.push(item);
        }
        return result||value;
      }
      const descriptor = value.schemaVersion === "seti-standard-action-v1";
      const keys=Object.keys(value);let ordered=true;
      for(let i=1;i<keys.length;i++)if(keys[i-1]>keys[i]){ordered=false;break;}
      if(!ordered)keys.sort();
      const prototype=Object.getPrototypeOf(value);
      let result=ordered&&!descriptor&&(prototype===Object.prototype||prototype===null)?null:Object.create(null);
      for(let i=0;i<keys.length;i++){
        const name=keys[i];
        if(descriptor&&["actionId","stateVersion","decisionVersion"].includes(name))continue;
        const item=normalize(value[name],name);
        if(!result&&item!==value[name]){
          result=Object.create(null);
          for(let j=0;j<i;j++)result[keys[j]]=value[keys[j]];
        }
        if(result)result[name]=item;
      }
      return result||value;
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
      normalizedState=JSON.stringify(normalize(buildState()));
      if(stateCache&&Object.isFrozen(source)){
        if(!variants){
          if(stateCache.size>=64)stateCache.delete(stateCache.keys().next().value);
          variants=new Map();stateCache.set(source,variants);
        }
        variants.set(key,normalizedState);
      }
    }
    return `{"boundary":${JSON.stringify(boundary)},"pending":${JSON.stringify(normalizedPending)},"state":${normalizedState},"status":${JSON.stringify(status)}}`;
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
    let envelopeCompanyIntents = new WeakMap();
    let goalMovementGeometryNodes = 0;
    let openedRoot = null;
    let rootPublicLandingOffer = null;
    let movementPolicies = new WeakMap();
    const movementRouteCache = new Map();
    const movementTimingCache = new Set();
    const movementTimingGroups = new Map();
    let nodes = new WeakMap();
    let observationReleasers = new WeakMap(), observationReleases = 0;
    let normalizedIdentityStates = new Map();
    const identitySubtrees={values:new WeakMap(),hits:0,stores:0};
    const identities = new Map(), physicalIdentityKeys = new Map();
    // Intern exact full-state bytes once. Search control keys need only the
    // collision-free local integer; durable plan dependencies retain the
    // original complete serialized keys below.
    function nodeIdentity(physicalKey,intent,cardControl,resourceControl,knowledge = null) {
      if(!physicalIdentityKeys.has(physicalKey))physicalIdentityKeys.set(physicalKey,physicalIdentityKeys.size);
      const parts=[physicalIdentityKeys.get(physicalKey),intent,cardControl,resourceControl];
      if(knowledge)parts.push(knowledge);
      const key=JSON.stringify(parts);
      if(!identities.has(key))identities.set(key,Object.freeze({}));
      return identities.get(key);
    }
    function policyPhysicalKey(stored) {
      const key=cardKnowledgeKey(stored.envelope);
      return key?JSON.stringify([stored.physicalKey,{knownAcquiredCardIds:key}]):stored.physicalKey;
    }
    function policyDependencyKey(stored) {
      if(stored.policyKey===undefined){
        const physical=policyPhysicalKey(stored);
        const movementKey=stored.intent?JSON.stringify([physical,stored.intent]):physical;
        stored.policyKey=stored.cardControl?JSON.stringify([movementKey,stored.cardControl]):movementKey;
      }
      return stored.policyKey;
    }
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
    let incomeProofSpecs = new WeakMap(), incomeProofNodes = new WeakMap();
    let turnTailSpecs=new WeakMap(),turnTailNodes=new WeakMap();
    let movementValueBounds=new WeakMap(),movementBoundQueries=0,movementRuleQueries=0,movementIntentRecoveries=0,completedMovementRecoveries=0;
    let postMainValueBounds = new WeakMap();
    let postMainOptimalPlans = new WeakMap();
    const resourceGroups = new Map();
    let fork = null;
    let loadedEnvelope = null;
    const decodedStates = new Map();
    const maxDecodedStateCacheEntries = 64, maxDecodedStateCacheBytes = 8 * 1024 * 1024;
    let decodedStateCacheBytes = 0;
    let envelopeObservations = new WeakMap(), valueObservations = new WeakMap(), stateRequirements = new WeakMap(), goalCatalogs = new WeakMap();
    let observationCacheHits = 0, resourceQueryHits = 0, resourceQueryMisses = 0, goalCatalogHits = 0, goalCatalogMisses = 0;
    let committedDecodeCount = 0, committedDecodeHits = 0, committedReferenceCount = 0;
    let rootObservation = null, knownChongDisplayIndex=null, knownRootCardIds = new Set(), knownRootNebulaIds = new Set(), knownRootTechIndices = new Map(), knownRootAlienIds = new Set();
    let knownRootFossilIds = new Set();
    let planningStates = new WeakMap(), acquiredPlanningStates = new WeakMap();
    // Each immutable Native envelope owns one immutable knowledge context.
    // Sharing a view of that envelope preserves knowledge; siblings never mutate it.
    let envelopeKnowledge = new WeakMap();
    function knownCards(envelope) { return envelopeKnowledge.get(envelope)?.ids || knownRootCardIds; }
    function cardKnowledgeKey(envelope) { return envelopeKnowledge.get(envelope)?.key || null; }
    function inheritCardKnowledge(envelope, source, action) {
      if(!source)return;
      const inherited=envelopeKnowledge.get(source.envelope);
      if(inherited)envelopeKnowledge.set(envelope,inherited);
      const target=action?.target,chong=target?.choiceId?.startsWith("chong:display:"),
        species=chong?"chong":"amiba",index=chong?knownChongDisplayIndex:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex;
      if(action?.actorId!==seatId || action.family!=="choose_card" || target?.kind!=="residual-domain"
        ||target.source!=="display" || !Number.isSafeInteger(index) || target.cardIndex!==index
        ||target.choiceId!==`${species}:display:${index}` || !knownRootAlienIds.has(chong?"虫":"阿米巴"))return;
      const before=readIdentityState(source.envelope),after=readIdentityState(envelope);
      if(before.aliens[species]?.displayedCardIndex!==index)return;
      const previous=new Set(before.players.players.find(p=>p.id===seatId).hand.map(c=>c.id));
      const acquired=after.players.players.find(p=>p.id===seatId).hand.filter(c=>!previous.has(c.id)
        &&c[chong?"chongCard":"amibaCard"]===true&&c.alienCardId===index&&c.cardId===`${species}_${index}.webp`);
      if(acquired.length!==1)throw new Error("ANALYSIS_PUBLIC_ALIEN_ACQUISITION_UNPROVED");
      const ids=new Set(inherited?.ids||knownRootCardIds);ids.add(acquired[0].id);
      const added=[...ids].filter(id=>!knownRootCardIds.has(id)).sort();
      envelopeKnowledge.set(envelope,{ids,key:JSON.stringify(added)});
    }
    let publicSeed = null, rootTurnKey = null;
    let nodeCount = 0, identityMaterializations = 0;
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

    function project(comp, valueOnly = false) {
      const state = comp.projection(valueOnly?{...viewer,valueOnly:true}:viewer).state;
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
      if (saved.trustedState && !decodedStates.has(saved.envelope.committedState)) {
        cacheCommittedState(saved.envelope.committedState, saved.trustedState);
        committedReferenceCount++;
      }
      return saved.envelope;
    }

    function restoreEnvelope(envelope, forWrite = false) {
      // trusted save 会冻结当前 session。只读投影可直接复用，下一次提交必须恢复可写副本。
      if(loadedEnvelope===envelope&&(!forWrite||!envelope.session)){if(forWrite)stableRestoreSkips++;return;}
      const restoreAt = now();
      const comp = fork.composition || fork;
      const restored = comp.lifecycle.restore(envelope, {
        silent: true, inPlace: true, trustedFork: true, skipProjection: true,
        readOnly: !forWrite,
        trustedState: readCommittedState(envelope),
      });
      milliseconds.restore += now() - restoreAt;
      if (!restored.ok) throw new Error(`ANALYSIS_RESTORE_FAILED: ${restored.code || restored.message}`);
      loadedEnvelope = envelope;
    }

    function observeEnvelope(envelope, barrier, valueOnly = false) {
      if (!fork) throw new Error("ANALYSIS_NODE_INVALID");
      const observations=valueOnly?valueObservations:envelopeObservations;
      let variants = observations.get(envelope);
      if (variants?.has(barrier)) { observationCacheHits++; return variants.get(barrier); }
      restoreEnvelope(envelope);
      const observationAt = now();
      const observation = project(fork.composition || fork,valueOnly);
      const visible = barrier && ruleComposition.isHiddenInformationBarrier(barrier)
        ? ruleComposition.sanitizeHiddenInformationObservation(rootObservation, observation, barrier, knownCards(envelope))
        : observation;
      observationCount += 1;
      // Native non-cheap projection already owns and freezes its complete state.
      // Sanitization creates only new wrappers over that immutable snapshot.
      const result = freeze(visible);
      milliseconds.observation += now() - observationAt;
      if (!variants) { variants = new Map(); observations.set(envelope, variants); }
      variants.set(barrier, result);
      return result;
    }

    // Native enumeration owns fresh target/payload objects; decision menus
    // are already deep-frozen snapshots. Freeze fresh descriptor children in
    // place instead of cloning the complete private menu a second time.
    function ownLegalActions(actions) {
      if(Object.isFrozen(actions))return actions;
      for(const action of actions){Object.values(action).forEach(freeze);Object.freeze(action);}
      return Object.freeze(actions);
    }

    function createNode(envelope, observation, actions, status, barrier = null, intent = null, resourceControl = null) {
      let visible = observation && freeze(observation);
      // 搜索内部节点只用合法集与身份；首次估值/记录时才投影。getter 不暴露快照。
      const node = Object.freeze({
        get observation() {
          if (!visible) visible = observeEnvelope(envelope, barrier);
          return visible;
        },
        legalActions: ownLegalActions(actions), status, boundary: barrier?.code || null,
      });
      const boundary = barrier?.code || null;
      if (movementPlanning && !intent) intent = recoverMovementIntent(envelope,barrier);
      const pick = cardPickPlanning && status === "decision" && actions.length ? describeCardPick(envelope,actions,status,barrier) : null;
      const cardControl = pick?.fixed ? {goal:pick.goal,selection:pick.selection&&{cardId:pick.selection.cardId,blind:pick.selection.blind},discardIds:pick.discardIds} : null;
      observationReleasers.set(node, () => { visible = null; envelopeObservations.delete(envelope); valueObservations.delete(envelope); observationReleases++; });
      // Fixed native prefixes may be charged only as certificate steps, never
      // compared by the graph. Delay their large exact key until identity or
      // durable plan evidence actually consumes it; no equality fields change.
      let physicalKey,identity;
      nodes.set(node, { envelope, serial: nodeCount,
        get physicalKey(){
          if(physicalKey===undefined){physicalKey=forwardIdentity(envelope,status,boundary,readIdentityState(envelope),normalizedIdentityStates);identityMaterializations++;}
          return physicalKey;
        },
        get identity(){
          if(identity===undefined)identity=nodeIdentity(this.physicalKey,this.intent,this.cardControl,this.resourceControl,cardKnowledgeKey(this.envelope));
          return identity;
        },
        set identity(value){identity=value;},
        intent,cardControl,resourceControl,informationBarrier:ruleComposition.isHiddenInformationBarrier(barrier)?barrier:null });
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
      const result = freeze(JSON.parse(key));
      cacheCommittedState(key, result);
      return result;
    }

    function cacheCommittedState(key, result) {
      const bytes = key.length * 2;
      if (bytes <= maxDecodedStateCacheBytes) {
        while (decodedStates.size && (decodedStates.size >= maxDecodedStateCacheEntries || decodedStateCacheBytes + bytes > maxDecodedStateCacheBytes)) {
          const oldest = decodedStates.keys().next().value;
          decodedStates.delete(oldest); decodedStateCacheBytes -= oldest.length * 2;
        }
        decodedStates.set(key, result); decodedStateCacheBytes += bytes;
      }
    }

    function openRoot() {
      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");
      clearPrefixGraph();
      goalMovementGeometryNodes = 0;
      cardPickRootStats = cardPickPlanner.getDiagnostics();
      nodeCount = 0;
      movementBoundQueries=0;movementRuleQueries=0;movementIntentRecoveries=0;completedMovementRecoveries=0;
      submissionCount = 0;
      cacheHits = 0;stableRestoreSkips=0;movementTimingCacheHits=0;movementTimingCacheMisses=0;
      observationCount = 0; observationReleases = 0;
      committedDecodeCount = 0; committedDecodeHits = 0; committedReferenceCount = 0;
      observationCacheHits = 0; resourceQueryHits = 0; resourceQueryMisses = 0; goalCatalogHits = 0; goalCatalogMisses = 0;
      for (const key of Object.keys(milliseconds)) milliseconds[key] = 0;
      rootObservation = project(composition);
      const actions = legalActions(composition);
      if (!actions.length || actions.some(action => action.actorId !== seatId)) {
        throw new Error("ANALYSIS_ROOT_OWNER_MISMATCH");
      }
      knownRootCardIds = new Set([...(rootObservation.publicState.board.publicCards || []),
        ...(rootObservation.selfState.hand || []), ...(rootObservation.selfState.reservedCards || []),
        ...(rootObservation.selfState.privateAlienCards || [])].filter(Boolean).map(c => c.id));
      // The current native PASS menu already discloses these identities. Retain
      // them when a later income draw closes the window; future menus stay hidden.
      for (const action of actions) {
        if (action.family === "choose_card" && action.target?.kind === "pass-reserve-card"
          && action.target.cardId && action.target.choiceId
          && action.payload?.cardInstanceId === action.target.choiceId) {
          knownRootCardIds.add(action.target.choiceId);
        }
      }
      // 同一回合的已知输入不重抽未知世界；恢复仅依赖正式公开配置和回合身份。
      // 完整节点身份仍包括假设/RNG，不能因种子稳定而忽略实际依赖变化。
      const authoritative = snapshot(composition);
      const state = authoritative.session?.session?.workingState || JSON.parse(authoritative.committedState);
      const player=state.players.players.find(p=>p.id===seatId);
      const supplier=state.turn.roundNumber===3&&player.mainActionCompleted&&player.industryRoundMarkRound!==3
        &&industryCatalog.getPlayerIndustryDefinition(player)?.activeAbilityId==="deepspace_swap_cards"&&resourceDemand.publicLandingSupplier(state);
      rootPublicLandingOffer=supplier&&supplier.card.blueBonusOwnerId!==seatId?supplier.card.id:null;
      knownRootNebulaIds = new Set(Object.keys(state.data.nebulae).filter(id => id.startsWith("sector-")));
      knownRootTechIndices = new Map(Object.values(state.tech.stacks).map(stack=>[stack.tileId,stack.bonusIndex]));
      knownRootAlienIds = new Set((rootObservation.publicState.board.aliens.slots||[]).filter(a=>a.revealed).map(a=>a.alienId));
      knownRootFossilIds = new Set(actions.flatMap(action => action.target?.fossilId ? [action.target.fossilId] : []));
      const head=authoritative.session?.session?.queue?.[0];
      const offered=head?.type==="residual_alien_card_decision"&&head.ownerId===seatId&&head.payload?.speciesId==="chong"
        &&knownRootAlienIds.has("虫")&&actions.find(a=>a.family==="choose_card"&&a.target?.kind==="residual-domain"
          &&a.target.source==="display"&&Number.isSafeInteger(a.target.cardIndex)&&a.target.choiceId===`chong:display:${a.target.cardIndex}`);
      knownChongDisplayIndex=offered?offered.target.cardIndex:null;
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
      if (["information-barrier", "other-owner", "terminal", "plan-infeasible","turn-boundary","income-plan-value","turn-tail-value"].includes(node.status)) {
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
      const { before, result } = executeCurrent(requested);
      return rememberPrefix(key,node,actionId,remember(key, finishChild(before, result, movementPlanning ? nextMovementIntent(node, requested) : null, stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null, stored.informationBarrier, requested, stored)));
    }

    function setMovementPlanning(enabled) {
      movementPlanning = enabled === true;
      if (movementPlanning && openedRoot) {
        const stored = nodes.get(openedRoot);
        if (!stored.intent) {
          stored.intent = recoverMovementIntent(stored.envelope);
          if (stored.intent) {
            stored.policyKey=undefined;
            stored.identity=nodeIdentity(stored.physicalKey,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope));
          }
        }
      }
    }

    const opaqueHeldCard=Object.freeze({hidden:true,faceUp:false});
    function planningState(state, barrier, knownCardIds = knownRootCardIds) {
      if (!barrier) return state;
      let memo=planningStates;
      if(knownCardIds!==knownRootCardIds){
        if(!acquiredPlanningStates.has(knownCardIds))acquiredPlanningStates.set(knownCardIds,new WeakMap());
        memo=acquiredPlanningStates.get(knownCardIds);
      }
      if (memo.has(state)) return memo.get(state);
      const amiba=state.aliens.amiba;
      const rootDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex;
      const hiddenDisplay=amiba&&(!knownRootAlienIds.has("阿米巴")||amiba.displayedCardIndex!==rootDisplay);
      const chong=state.aliens.chong,hideChong=knownChongDisplayIndex!==null&&chong?.displayedCardIndex!==knownChongDisplayIndex;
      const result = { ...state,
        ...(hiddenDisplay||hideChong?{aliens:{...state.aliens,
          ...(hiddenDisplay?{amiba:{...amiba,displayedCardIndex:null,displayedCardHidden:amiba.displayedCardIndex!=null,
            ...(!knownRootAlienIds.has("阿米巴")?{revealInitialized:false}:{})}}:{}),
          ...(hideChong?{chong:{...chong,displayedCardIndex:null}}:{})}}:{}),
        // Anonymous slots preserve the actual hand quantity for pure ledgers.
        // Their Native identities/models never enter planning or selections.
        players:{...state.players,players:state.players.players.map(p=>p.id===seatId?{...p,
          hand:p.hand.map(card=>knownCardIds.has(card.id)?card:opaqueHeldCard)}:p)},
        cards: { ...state.cards, publicCards: state.cards.publicCards.map(card=>card&&knownCardIds.has(card.id)?card:null),
          unknownPublicSlotIndices: state.cards.publicCards.flatMap((card,index)=>card&&!knownCardIds.has(card.id)?[index]:[]) },
        tech: { ...state.tech, stacks: Object.fromEntries(Object.entries(state.tech.stacks).map(([id,stack])=>[id,
          stack.bonusIndex===knownRootTechIndices.get(id)?stack:{...stack,depleted:true,remaining:0,bonusId:null}])) },
      };
      freeze(result);memo.set(state,result); return result;
    }

    function passPlanningState(state,session) {
      return session?.queue?.some(effect=>effect.type===probeTurnSession.EFFECT_TYPES.PASS_COMMIT)
        ? {...state,passingPlayerIds:probeTurnSession.getPassingPlayerIds(state,session)} : state;
    }

    const pendingPlanningStates=new WeakMap();
    function readPlanningState(stored) {
      let state=planningState(readIdentityState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope));
      const session=stored.envelope.session?.session;
      if(session?.queue?.length){
        let states=pendingPlanningStates.get(session);if(!states){states=new WeakMap();pendingPlanningStates.set(session,states);}
        if(!states.has(state))states.set(state,freeze({...state,pendingEffectOwnerIds:[...new Set(session.queue.map(effect=>effect.ownerId).filter(Boolean))]}));
        state=states.get(state);
      }
      return passPlanningState(state,session);
    }

    function blueLandingGoalFor(state) {
      const native=productionKernel||globalThis.SetiProductionKernel;
      return resourceDemand.blueLandingSupplyGoal({state,seatId,compareTiming:timingForOneGoalQuery(state),
        candidates:()=>native.getProbeRouteRequirements(state,seatId)?.candidates||[]});
    }

    function describeCardPick(envelope,actions,status,barrier=null) {
      if (envelopeCardSpecs.has(envelope)) return envelopeCardSpecs.get(envelope);
      const state=readPlanningState({envelope,informationBarrier:barrier});
      const session=envelope.session?.session;
      const policySession=barrier&&session?{...session,baseState:planningState(session.baseState,barrier,knownCards(envelope)),workingState:state}:session;
      const head=session?.queue?.[0];
      if(resourcePlanning&&status==="decision"&&head?.type===scienceSession.EFFECT_TYPES.PICK_CARD&&head.ownerId===seatId
        &&head.payload.blueBonusSource&&session.journal?.actions?.[0]?.action?.family==="place_data"){
        const base=policySession.baseState,goal=base&&blueLandingGoalFor(base);
        const slot=session.journal.actions.find(row=>row.action?.family==="choose_target"&&row.action.target?.target==="blueBonus");
        if(goal&&slot?.action.target.blueSlot===goal.blueSlot){
          const action=actions.find(a=>a.family==="choose_card"&&a.target?.choiceId?.startsWith("pick:")&&a.target.cardInstanceId===goal.cardId);
          if(!action)throw new Error("BLUE_LANDING_PUBLIC_SUPPLIER_UNAVAILABLE");
          const result=freeze({policy:"seti-fixed-blue-landing-supply-v1",isEquivalence:false,kind:"fixed-card-plan",fixed:true,
            goal,selection:{cardId:goal.cardId,blind:false},discardIds:[],selectedActionId:action.actionId,
            retainedActionIds:[action.actionId],excludedActionIds:actions.filter(a=>a!==action).map(a=>a.actionId),
            reason:"take-known-landing-supplier"});
          envelopeCardSpecs.set(envelope,result);return result;
        }
      }
      if(status==='decision'&&state.turn.roundNumber===3&&session?.queue?.length===2
        &&head.type==='card_play_domain_pick_card'&&head.ownerId===seatId
        &&head.payload.cardEffect?.type==='pick_card'&&head.payload.cardEffect.options?.count===1
        &&session.queue[1].ownerId===seatId&&session.queue[1].payload?.cardInstanceId===head.payload.cardInstanceId
        &&session.queue[1].payload?.cardEffect?.type==='amiba_choose_symbol_reward'
        &&actions.every(a=>a.family==='choose_card'&&['public','blind'].includes(a.target?.source))){
        const p=state.players.players.find(q=>q.id===seatId);
        const next=industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&hasOwnVisitSource(state)&&hasPostMainInertReservations(state,true,true,true)&&previewTurn(state);
        const match=next?.turnAdvanced&&!next.roundAdvanced&&!next.gameEnded&&next.nextPlayerId===seatId
          &&localPlans.quoteLatePublicDataPick({state,seatId,knownCards:knownCards(envelope),
            knownAlienDisplay:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null,
            region:session.queue[1].payload.cardEffect.options?.region,
            offers:actions.filter(a=>a.target.source==='public').map(action=>({action,card:state.cards.publicCards[action.target.slotIndex]})).filter(x=>x.card)});
        if(match){
          const result=freeze({policy:'seti-fixed-late-public-data-income-v1',isEquivalence:false,kind:'fixed-card-plan',fixed:true,
            goal:{id:'income:late-public-data:'+match.cardId,kind:'late-public-data-income',...match.quote},
            selection:{cardId:match.cardId,blind:false},discardIds:[],selectedActionId:match.action.actionId,
            retainedActionIds:[match.action.actionId],excludedActionIds:actions.filter(a=>a!==match.action).map(a=>a.actionId),
            reason:'take-known-data-corner-for-electricity-income'});
          envelopeCardSpecs.set(envelope,result);return result;
        }
      }
      if(status==="decision"&&state.turn.roundNumber===3&&head?.type===scienceSession.EFFECT_TYPES.PICK_CARD
        &&head.ownerId===seatId&&session.queue.length===1
        &&session.journal?.actions?.[0]?.action?.family==="research_tech"
        &&session.baseState?.players.players.find(p=>p.id===seatId)?.techState.ownedTiles.orange1!==true){
        const p=state.players.players.find(q=>q.id===seatId);
        const ready=p.techState.ownedTiles.orange1&&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&hasOwnVisitSource(state)&&hasPostMainInertReservations(state,true,true,true)&&previewTurn(state);
        const offers=ready?.turnAdvanced&&!ready.roundAdvanced&&!ready.gameEnded&&ready.nextPlayerId===seatId
          &&actions.flatMap(action=>{
            const i=action.target?.publicSlotIndex??action.target?.slotIndex,card=state.cards.publicCards[i];
            return action.family==="choose_card"&&card&&(action.target?.cardInstanceId===card.id||action.target?.source==="public")
              ?[{action,card}]:[];
          });
        const match=offers&&localPlans.quoteAnalysisLaunchPick({state,seatId,knownCards:knownCards(envelope),
          knownAlienDisplay:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null,offers});
        if(match){
          const result=freeze({policy:"seti-fixed-launch-data-income-v1",isEquivalence:false,kind:"fixed-card-plan",fixed:true,
            goal:{id:"income:launch-data:"+match.cardId,kind:"launch-data-income",...match.quote},
            selection:{cardId:match.cardId,blind:false},discardIds:[],selectedActionId:match.action.actionId,
            retainedActionIds:[match.action.actionId],excludedActionIds:actions.filter(a=>a!==match.action).map(a=>a.actionId),
            reason:"take-visible-launch-data-to-fund-income"});
          envelopeCardSpecs.set(envelope,result);return result;
        }
      }
      const swap=actions.some(a=>a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards");
      const swapSource=swap&&status==="stable"?state:status==="decision"&&head?.type==="residual_company_decision"
        &&["swap_hand","swap_public"].includes(head.payload?.step)?policySession.baseState:null;
      const supply=swapSource&&swapSource.turn.roundNumber===3&&previewAnalysisSwapSupply(swapSource,envelope);
      const result=cardPickPlanner.plan({state,seatId,actions,status,session:policySession,
        committedCompanySwap:envelopeCompanyIntents.get(envelope)||supply||null,
        endpoints:(candidateState=state)=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(candidateState,seatId)?.candidates||[]});
      const frozen=result&&freeze(result);envelopeCardSpecs.set(envelope,frozen);return frozen;
    }

    function cardPickSpec(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!cardPickPlanning||!["stable","decision"].includes(node.status)||!node.legalActions.length)return null;
      if(cardPickSpecs.has(node))return cardPickSpecs.get(node);
      const result=describeCardPick(stored.envelope,node.legalActions,node.status,stored.informationBarrier);cardPickSpecs.set(node,result);return result;
    }

    function setCardPickPlanning(enabled) {
      cardPickPlanning=enabled===true;
      if(cardPickPlanning&&openedRoot){
        const stored=nodes.get(openedRoot),pick=cardPickSpec(openedRoot);
        if(pick?.fixed&&!stored.cardControl){
          stored.cardControl={goal:pick.goal,selection:pick.selection&&{cardId:pick.selection.cardId,blind:pick.selection.blind},discardIds:pick.discardIds};
          stored.policyKey=undefined;
          stored.identity=nodeIdentity(stored.physicalKey,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope));
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
      const stored=nodes.get(node),state=readPlanningState(stored);
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
      // Node legal menus are immutable. Exact object identity is a stricter
      // memo key than serializing and sorting every action on a cache miss.
      // Ephemeral mutable source menus are queried without caching.
      const key = Object.isFrozen(actions) ? actions : null;
      if (key&&variants?.has(key)) { goalCatalogHits++; return variants.get(key); }
      goalCatalogMisses++;
      const result = freeze(resourceDemand.catalog({state,seatId,requirements:resourceQuery(state),actions}));
      if(key){
        if (!variants) { variants = new WeakMap(); goalCatalogs.set(state,variants); }
        variants.set(key,result);
      }
      return result;
    }

    function lateIncomePayment(state,stored,actions,goals){
      if(state.turn.roundNumber!==3)return null;
      const trade=actions.find(a=>a.family==='quick_trade'&&a.target?.tradeId==='cards-for-credit');
      if(!trade)return null;
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      if(p.mainActionCompleted||p.resources.energy!==0||p.resources.credits!==0||p.resources.availableData!==1||p.hand.length!==5
        ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
        ||!hasOwnVisitSource(state)||!hasPostMainInertReservations(state,true,true,true))return null;
      const next=previewTurn(state);
      if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
      const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
      return localPlans.lateIncomePayment({state,seatId,knownCards:knownCards(stored.envelope),knownAlienDisplay,goals,trade});
    }

    function scanLaunchDataSupply(state,stored,actions,goal,session){
      const opts=session?.queue?.[0]?.payload?.options;
      if(state.turn.roundNumber!==3||opts?.mode!=="public"||opts.selected!==0||opts.max!==1
        ||session.journal?.actions?.[0]?.action?.family!=="scan")return null;
      const p=state.players.players.find(q=>q.id===seatId);
      if(p.resources.credits!==0||p.resources.energy!==0||p.resources.availableData!==1||p.hand.length!==3
        ||data.listComputerPlacedTokens(p).length!==4||hasOwnVisitSource(state)
        ||p.hand.some(c=>(cards.getDiscardActionRewardForCard(c)?.dataCount||0)>0)
        ||!p.hand.some(c=>cards.getIncomeGainForCard(c)?.energy===1)||p.techState.ownedTiles.orange1
        ||state.tech.stacks.orange1?.bonusId!=="bonus_1c"
        ||state.tech.stacks.orange1?.bonusIndex!==knownRootTechIndices.get("orange1")
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        ||!state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id)))return null;
      const native=actions.filter(a=>a.target?.nebulaId===goal.nebulaId&&a.target?.cardInstanceId);
      if(native.length<2||!native.every(a=>a.payload?.gainData===true)
        ||data.listNebulaTokens(state.data,goal.nebulaId).filter(t=>!t.replacedByPlayerId&&!t.replacedByPlayerColor).length!==1)return null;
      const known=knownCards(stored.envelope),offered=native.map(a=>state.cards.publicCards[a.target.publicSlotIndex]);
      if(offered.some(c=>!c||!known.has(c.id)))return null;
      const dataCards=offered.filter(c=>{
        const corner=cards.getDiscardActionRewardForCard(c);
        return corner?.dataCount===1&&!Object.keys(corner.gain).length;
      });
      const displayed=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex;
      if(dataCards.length!==1||!offered.some(c=>!(cards.getDiscardActionRewardForCard(c)?.dataCount>0))||displayed!==state.aliens.amiba?.displayedCardIndex
        ||!localPlans.visibleAmibaDataCorner(displayed))return null;
      return dataCards[0].id;
    }

    function quietScoredIncomeState(state,stored){
      const p=state.players.players.find(p=>p.id===seatId),t=state.turn;
      return t.roundNumber===3&&t.currentPlayerId===seatId&&p.mainActionCompleted&&!p.passCompletionPending
        &&industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId==="deepspace_swap_cards"
        &&!p.industryBorrowedTechTileId&&data.listComputerPlacedTokens(p).length===3&&!stored.intent&&!hasOwnVisitSource(state)
        &&t.activePlayerIds.includes(seatId)&&!t.passedPlayerIds.includes(seatId)
        &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))&&!t.cardTurnEventBonuses?.length
        &&state.aliens.amiba?.revealInitialized===true
        &&Object.values(state.aliens.aliens).every(s=>(!s.revealed||s.alienId==="阿米巴")&&!alienState.isAlienReadyToReveal(s))
        &&[...p.hand,...p.reservedCards].every(c=>knownCards(stored.envelope).has(c.id))
        &&hasPostMainInertReservations(state,false,true,true)&&quietTailHasNoAcquisition(state);
    }

    function computerResearchPayment(node,stored,state,goal) {
      const turn=state.turn;
      if(node.status!=="stable"||goal.kind!=="research_tech"||goal.publicityCornerCardId||goal.continuationCardId
        ||turn.roundNumber!==3||turn.currentPlayerId!==seatId||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
        ||turn.cardTurnEventBonuses?.length||scienceSession.getResearchDataCount(goal.tileId)!==2)return null;
      const p=state.players.players.find(q=>q.id===seatId),needed=resourceDemand.needs(state,seatId,goal);
      if(needed.publicity!==1||needed.credits||needed.energy||needed.data||p.mainActionCompleted||p.passCompletionPending
        ||p.resources.availableData<2||p.resources.availableData!==p.dataState.poolTokens.length
        ||industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId!=="deepspace_swap_cards"
        ||hasOwnVisitSource(state)||Object.values(state.aliens.aliens).some(alienState.isAlienReadyToReveal))return null;
      const occupied=data.listComputerPlacedTokens(p);
      if(occupied.length>=2||occupied.some((slot,i)=>slot.placementSlot!==i+1)
        ||occupied.length+p.resources.availableData!==3||data.getComputerSlotBonus(2)?.publicity!==1)return null;
      const known=knownCards(stored.envelope);
      if([...p.hand,...p.reservedCards].some(c=>!known.has(c.id))
        ||p.reservedCards.some(c=>{const m=cardEffects.getCardModel(c);return !m||m.temporaryTasks?.length
          ||m.triggers?.some(t=>(t.event.types||[t.event.type]).some(type=>["placeData","cardCorner","researchTech"].includes(type)));}))return null;
      const hasExtraCard=p.hand.some(c=>{
        const reward=cards.getDiscardActionRewardForCard(c);
        return reward?.gain?.publicity===1&&Object.keys(reward.gain).length===1&&!reward.dataCount
          &&node.legalActions.some(a=>a.family==="card_corner"&&a.target.cardInstanceId===c.id&&a.payload.multiplier===1);
      });
      const income=p.hand.some(c=>{const gain=cards.getIncomeGainForCard(c);return gain&&Object.keys(gain).length===1&&(gain.credits===1||gain.energy===1);});
      const place=node.legalActions.find(a=>a.family==="place_data");
      return hasExtraCard&&income&&place?{kind:"fixed",actionId:place.actionId,placing:true,reason:"fund-research-with-held-computer-data",demand:needed}:null;
    }

    function researchMovementPlan(state,actions,known,source=null){
      const p=state.players.players.find(v=>v.id===seatId),t=state.turn;
      const shape=t.roundNumber===3&&!p.mainActionCompleted&&!p.passCompletionPending&&p.hand.length===5
        &&p.resources.credits===0&&p.resources.energy===0&&p.resources.availableData===1
        &&data.listComputerPlacedTokens(p).length===6&&hasPostMainInertReservations(state,true,true,true)
        &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
        &&p.industryRoundMarkRound!==t.roundNumber&&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        &&p.hand.every(c=>known.has(c.id))&&!t.cardTurnEventBonuses?.length;
      if(!shape||p.techState.ownedTiles.blue1||state.tech.stacks.blue1?.bonusHidden
        ||state.tech.stacks.blue1?.bonusIndex!==knownRootTechIndices.get('blue1')
        ||Object.values(p.techState.blueBoardSlots).sort().join(',')!=='1,2'
        ||!techResolver.listTakeableTiles(state.tech,p.techState).includes('blue1'))return null;
      const card=p.hand.filter(c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1);
      const missing=techResolver.getResearchPublicityCost(p)-p.resources.publicity;
      const funding=p.hand.filter(c=>{
        const corner=cards.getDiscardActionRewardForCard(c);
        return corner?.gain?.publicity===missing-1&&Object.keys(corner.gain).length===1&&!corner.dataCount;
      });
      if(card.length!==1||missing<2||funding.length!==1||p.hand.filter(c=>localPlans.blueCashCard(c)).length!==1
        ||localPlans.knownBlueCashOffers(state,known).length!==2
        ||p.hand.some(c=>(cards.getDiscardActionRewardForCard(c)?.gain?.publicity||0)>=missing))return null;
      const ships=state.pieces.rockets.filter(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r));
      if(ships.length!==1||ships[0].fossilId!=null)return null;
      const available=(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(state,seatId)?.candidates||[];
      const nextWallet=p.income.energy+2,targets=available.filter(r=>r.rocketId===ships[0].id&&r.endpointFamily==='land'
        &&r.endpointTarget?.type==='planet'&&r.targetBenefit.dataCount>=2&&r.required.credits===0
        &&r.required.energy===nextWallet+1&&r.nextStep);
      if(targets.length!==1)return null;
      const target=targets[0],step=target.nextStep;
      const move=(source?[source]:actions).find(a=>a.family==='move'&&a.target.rocketId===step?.rocketId
        &&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY&&a.payload?.requiredMovePoints===1);
      if(!move)return null;
      const timing=timingForOneGoalQuery(state)(target.requirementId,[{...step,requiredMovePoints:1}],0);
      const advanced=timing.comparable&&timing.alternatives.find(a=>a.prefixLength===1);
      if(!advanced||advanced.prefixMovementPoints!==1||advanced.remainingPaidPoints!==timing.waitPaidPoints-1
        ||advanced.remainingPaidPoints+(target.endpointFacts.cost.energy||0)>nextWallet)return null;
      const copy={...p,resources:{...p.resources}},future={...state,pieces:structuredClone(state.pieces),
        players:{...state.players,players:state.players.players.map(x=>x===p?copy:x)}};
      const context={state:future,players:future.players,pieces:future.pieces,solarSystem:future.solarSystem,turn:future.turn,planets:future.planets};
      const result=rocketAbilities.moveProbe(context,{rocketId:step.rocketId,deltaX:step.deltaX,deltaY:step.deltaY,movementPoints:1,cost:{},source:'move'});
      if(!result.ok||copy.resources.publicity!==p.resources.publicity+1
        ||(result.events||[]).some(e=>cardEffects.collectMatchingTriggers(p,{...e,...(e.type==='visitPlanet'?{hasOwnOrbit:true}:{})}).length))return null;
      return {id:'tech:blue1:3:funded-route',kind:'research_tech',tileId:'blue1',blueSlot:3,
        required:{publicity:techResolver.getResearchPublicityCost(p)},
        movementFunding:{cardId:card[0].id,firstMoveId:move.actionId,endpointId:target.requirementId,publicity:p.resources.publicity,
          waitPoints:timing.waitPaidPoints,remainingPoints:advanced.remainingPaidPoints}};
    }

    // Price one move only as payment for the cash-column research purpose.
    // The rule preview selects a unique current publicity stop; no move tree.
    function transportResearchMove(state,actions,known,source=null) {
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      const missing=techResolver.getResearchPublicityCost(p)-p.resources.publicity;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending||missing!==2
        ||p.resources.credits||p.resources.energy||p.resources.availableData!==1
        ||data.listComputerPlacedTokens(p).length!==5||!knownRootAlienIds.has("虫")
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||t.cardTurnEventBonuses?.length||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        ||!p.hand.every(c=>known.has(c.id))||!hasPostMainInertReservations(state,true,true,true)
        ||!techResolver.listTakeableTiles(state.tech,p.techState).includes("blue1"))return null;
      const slots=Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number).filter(slot=>!Object.values(p.techState.blueBoardSlots).includes(slot)
        &&data.listComputerPlacedTokens(p).some(t=>t.placementSlot===data.getRequiredComputerSlotForBlueBonus(slot)));
      if(slots.length!==1)return null;
      const suppliers=p.hand.filter(c=>cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil")
        &&cardEffects.getCardModel(c)?.playEffects?.[0]?.type==="card_move");
      const publicity=p.hand.filter(c=>{
        const reward=cards.getDiscardActionRewardForCard(c);
        return reward?.gain?.publicity===1&&Object.keys(reward.gain).length===1&&!reward.dataCount;
      });
      // Prefer the card whose only main effect would need a still-unrevealed
      // fossil reward. Preserve the plain movement payer for the named route.
      const movePayers=p.hand.filter(c=>{
        const effects=cardEffects.getCardModel(c)?.playEffects;
        return cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1
          &&effects?.length===1&&effects[0].type==="chong_probe_planet_fossil_reward";
      });
      const plain=p.hand.filter(c=>{
        const r=cards.getDiscardActionMoveRewardForCard(c);
        return r?.movementPoints===1&&!Object.keys(r.gain).length;
      });
      const ships=state.pieces.rockets.filter(r=>r.playerId===seatId&&r.surface==="solar-board"&&!r.fossilId);
      if(suppliers.length!==1||publicity.length!==1||movePayers.length!==1||plain.length!==1||ships.length!==1)return null;
      const moves=(source?[source]:actions).filter(a=>a.family==="move"&&a.target.rocketId===ships[0].id
        &&a.payload?.requiredMovePoints===1).filter(({target})=>{
        const copy={...p,resources:{...p.resources}},future={...state,pieces:structuredClone(state.pieces),
          players:{...state.players,players:state.players.players.map(x=>x===p?copy:x)}};
        const moved=rocketAbilities.moveProbe(future,{...target,movementPoints:1,cost:{},source:"move"});
        return moved.ok&&copy.resources.publicity===p.resources.publicity+1
          &&!(moved.events||[]).some(e=>cardEffects.collectMatchingTriggers(p,{...e,...(e.type==="visitPlanet"?{hasOwnOrbit:true}:{})}).length);
      });
      if(moves.length!==1)return null;
      const required={publicity:techResolver.getResearchPublicityCost(p)};
      return {id:"tech:blue1:"+slots[0]+":transport-funding",kind:"research_tech",tileId:"blue1",blueSlot:slots[0],required,
        movementFunding:{cardId:movePayers[0].id,publicityPayerId:publicity[0].id,firstMoveId:moves[0].actionId,publicity:p.resources.publicity}};
    }

    function resourceStep(node,goal,operation={}) {
      const stored=nodes.get(node),state=readPlanningState(stored),session=stored.envelope.session?.session;
      if(goal.kind==="transport-data-prep"){
        const p=state.players.players.find(q=>q.id===seatId),computer=data.listComputerPlacedTokens(p).length;
        if(node.status==="stable"&&p.hand.some(c=>c.id===goal.cardId)){
          const end=node.legalActions.find(a=>a.family==="end_turn");
          return end&&computer===5&&p.resources.availableData===1&&!node.legalActions.some(a=>a.family==="complete_task")
            ?{kind:"fixed",actionId:end.actionId,reason:"finish-known-transport-preparation-turn"}
            :{kind:"infeasible",reason:"known-transport-data-wallet-changed"};
        }
        const head=session?.queue?.[0];
        const action=node.legalActions.find(a=>node.status==="stable"?a.family==="place_data"
          :head?.type===scienceSession.EFFECT_TYPES.PLACE_DATA?a.family==="choose_target"&&(computer===4
            ?a.target?.target==="computer":a.target?.target==="blueBonus"&&a.target.blueSlot===goal.blueSlot)
            :head?.type===scienceSession.EFFECT_TYPES.PICK_CARD&&a.family==="choose_card"&&a.target?.cardInstanceId===goal.cardId);
        return action?{kind:"fixed",actionId:action.actionId,reason:"fixed-computer-and-public-transport-payment"}
          :{kind:"infeasible",reason:"known-transport-data-input-unavailable"};
      }
      if(goal.movementFunding){
        const payment=goal.movementFunding,p=state.players.players.find(v=>v.id===seatId);
        if(node.status==='decision'&&session?.journal?.actions?.[0]?.action.actionId===payment.firstMoveId){
          const a=node.legalActions.find(x=>x.target?.kind==='move-payment'&&x.target.cardIds?.length===1
            &&x.target.cardIds[0]===payment.cardId&&x.payload?.energyCost===0);
          return a?{kind:'fixed',actionId:a.actionId,reason:'pay-purposeful-research-move'}
            :{kind:'infeasible',reason:'known-research-move-payment-changed'};
        }
        if(node.status==='stable'&&!p.mainActionCompleted&&p.hand.some(c=>c.id===payment.cardId)){
          const a=node.legalActions.find(x=>x.actionId===payment.firstMoveId);
          return a&&p.resources.publicity===payment.publicity?{kind:'fixed',actionId:a.actionId,reason:'one-known-route-step-funds-research'}
            :{kind:'infeasible',reason:'known-research-move-source-changed'};
        }
        if(payment.publicityPayerId&&node.status==="stable"&&!p.mainActionCompleted&&p.resources.publicity<goal.required.publicity){
          const corner=node.legalActions.find(a=>a.family==="card_corner"&&a.target.cardInstanceId===payment.publicityPayerId
            &&a.payload.kind==="resource"&&(a.payload.multiplier??1)===1);
          return corner&&p.resources.publicity+1===goal.required.publicity?{kind:"fixed",actionId:corner.actionId,reason:"retain-transport-supplier-during-research-payment"}
            :{kind:"infeasible",reason:"transport-research-publicity-payer-changed"};
        }
      }
      if(goal.kind==="scored-data-funding"){
        const p=state.players.players.find(p=>p.id===seatId),card=p.hand.find(c=>c.id===goal.cardId);
        if(!card&&node.status==="stable"&&p.resources.availableData===1)return{kind:"complete",reason:"income-and-blue-now-share-paid-data"};
        const a=card&&node.legalActions.find(a=>a.actionId===goal.actionId&&a.target.cardInstanceId===card.id);
        return a&&node.status==="stable"&&p.resources.availableData===0?{kind:"fixed",actionId:a.actionId,reason:"single-known-scored-data-corner"}
          :{kind:"infeasible",reason:"scored-data-funding-native-state-mismatch"};
      }
      const local=localDecisionSpec(node);if(["fixed-final-mark","fixed-paid-repeat","fixed-positive-optional","fixed-pass-discard","fixed-reorganization"].includes(local?.kind))return{kind:"fixed",actionId:local.selectedActionId,reason:local.kind};
      if(goal.kind==="effect-purpose"&&operation.targetStarted){
        if(node.status==="stable")return{kind:"complete",reason:"purpose-effect-completed"};
        const fixed=local?.selectedActionId?{kind:"fixed",actionId:local.selectedActionId,reason:local.kind}:null;
        if(fixed)return fixed;
        const income=resourceDemand.incomeChoice({state,seatId,goal:{...goal,required:{}},actions:node.legalActions});if(income)return income;
        return{kind:"fallback",reason:"purpose-effect-native-choice",actionIds:local?.retainedActionIds||node.legalActions.map(a=>a.actionId)};
      }
      if(goal.kind==="scan-flow"){
        if(operation.resourceBlueSlot)return resourceDemand.step({state,seatId,goal:{...goal,kind:"scan"},actions:node.legalActions,status:node.status,session,operation});
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
        const retainedSupply=scanLaunchDataSupply(state,stored,node.legalActions,goal,session);
        return localPlans.scanStep({state,seatId,goal,actions:node.legalActions,status:node.status,session,operation,retainedSupply});
      }
      return computerResearchPayment(node,stored,state,goal)
        ||resourceDemand.step({state,seatId,goal,actions:node.legalActions,status:node.status,session,operation});
    }

    // The two task-count consumers are the C tile and Jiuzhe's printed
    // score condition. Reveal itself reads traces and score, not tasks.
    // Keep the reveal Native and price no potential species/card identity.
    const taskCountScoreThreshold=Math.min(...jiuzhe.CARD_DEFINITIONS
      .filter(card=>card.condition?.type==="completedTasks").map(card=>card.condition.count));
    function cappedSectorTaskToKeep(state,owner,node) {
      const turn=state.turn,slots=Object.values(state.aliens.aliens);
      // A revealed but inactive Chong board adds no observer of task count
      // or of the ordinary data tail. Live cargo and reserved Chong effects
      // keep the previous native decision path.
      const inactiveChong=slots.some(s=>s.revealed&&s.alienId==="虫")
        &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        &&owner.reservedCards.every(card=>card.set!=="alien:虫");
      if(node.status!=="stable"||turn.roundNumber!==3||turn.currentPlayerId!==seatId
        ||!owner.mainActionCompleted||owner.passCompletionPending||owner.resources.publicity!==players.RESOURCE_LIMITS.publicity
        ||industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId!=="deepspace_swap_cards"
        ||node.legalActions.some(goalMovement.isDirection)&&(!inactiveChong||turn.cardTurnEventBonuses?.length)
        ||!node.legalActions.some(a=>a.family==="end_turn")
        ||slots.some(s=>s.revealed&&s.alienId!=="阿米巴"&&(s.alienId!=="虫"||!inactiveChong)))return null;
      if(Object.values(state.aliens.aliens).some(alienState.isAlienReadyToReveal)
        &&(!Number.isSafeInteger(owner.completedTaskCount)||owner.completedTaskCount<0
          ||!Number.isSafeInteger(taskCountScoreThreshold)||owner.completedTaskCount+1>=taskCountScoreThreshold))return null;
      const ready=node.legalActions.filter(a=>a.family==="complete_task");
      if(ready.length!==1||!knownRootCardIds.has(ready[0].target.cardInstanceId))return null;
      const marks=Object.entries(state.finalScoring.tiles).flatMap(([tileId,tile])=>tile.marks
        .filter(mark=>mark.playerId===seatId).map(mark=>({tileId,threshold:mark.threshold})));
      if(marks.some(mark=>mark.tileId==="c")||state.finalScoring.thresholds.some(n=>!marks.some(m=>m.threshold===n)))return null;
      const next={...state,players:{...state.players,players:state.players.players.map(p=>p===owner?{...p,mainActionCompleted:false}:p)}};
      const hold=localPlans.deferredSectorPublicityQuote({state:next,seatId,knownCards:knownRootCardIds});
      return hold?.cardId===ready[0].target.cardInstanceId&&hold.taskId===ready[0].target.ruleId
        ?{...hold,actionId:ready[0].actionId,reason:"reserve-capped-task-for-known-publicity-payment"}:null;
    }

    // Spend one held data to fund the fee of an already-known transport.
    // This is a fixed preparation for the next uninterrupted own main,
    // not a second search tree or an estimate based on future fossil IDs.
    function transportCashGoal(state,stored) {
      const turn=state.turn,p=state.players.players.find(a=>a.id===seatId);
      if(turn.roundNumber!==3||turn.currentPlayerId!==seatId||!p.mainActionCompleted||p.passCompletionPending
        ||p.resources.credits!==0||p.resources.availableData!==1||p.dataState.poolTokens.length!==1
        ||!p.hand.some(c=>cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil"))
        ||!p.hand.every(c=>knownCards(stored.envelope).has(c.id))
        ||data.listComputerPlacedTokens(p).length!==5
        ||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
        ||turn.cardTurnEventBonuses?.length||stored.intent||stored.resourceControl
        ||!hasPostMainInertReservations(state,true,true,true))return null;
      const ready=data.listBluePlacementRequirements(p).filter(r=>
        data.listComputerPlacedTokens(p).some(t=>t.placementSlot===data.getRequiredComputerSlotForBlueBonus(r.blueSlot)));
      if(ready.length!==1||data.getBlueBonusPlacementReward(p,ready[0].blueSlot)?.type!=="credits")return null;
      const goal={id:"data:blue:"+ready[0].blueSlot,kind:"blue-data",blueSlot:ready[0].blueSlot,required:{}};
      const q=localPlans.previewBlueCompletion({state,seatId,goal});
      if(!q.available||q.requiredNativeInputs!==2||q.player.resources.credits!==1||q.player.resources.availableData!==0)return null;
      const next=previewTurn(state);
      if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
      const funded={...q.player,mainActionCompleted:false};
      const future={...state,players:{...state.players,players:state.players.players.map(a=>a===p?funded:a)}};
      const native=productionKernel||globalThis.SetiProductionKernel;
      const route=resourceDemand.heldLandingGoal({state:future,seatId,compareTiming:timingForOneGoalQuery(future),
        candidates:()=>native.getProbeRouteRequirements(future,seatId)?.candidates||[]});
      return route?.embeddedMove?{...goal,knownTransport:route.id,knownTransportValue:route.value}:null;
    }

    function resourceSpec(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!resourcePlanning||!["stable","decision"].includes(node.status)||!node.legalActions.length)return null;
      if(resourceSpecs.has(node))return resourceSpecs.get(node);
      const pending=stored.envelope.session?.session;
      const cashBase=node.status==="stable"&&node.legalActions.some(a=>a.family==="end_turn"&&a.actorId===seatId)
        &&!node.legalActions.some(a=>a.family==="complete_task")
        ?readPlanningState(stored)
        :node.status==="decision"&&pending?.queue?.length===1&&pending.queue[0].type===scienceSession.EFFECT_TYPES.PLACE_DATA
          &&pending.journal?.actions?.[0]?.action.family==="place_data"&&pending.baseState
          ?planningState(pending.baseState,stored.informationBarrier,knownCards(stored.envelope)):null;
      const cash=cashBase&&transportCashGoal(cashBase,stored);
      if(cash){
        const a=node.legalActions.find(a=>node.status==="stable"?a.family==="place_data":a.target?.target==="blueBonus"&&a.target.blueSlot===cash.blueSlot);
        if(!a)throw Error("HELD_TRANSPORT_BLUE_CASH_TARGET_MISSING");
        const plan={id:cash.id,goal:cash,operation:{finalPlacement:node.status==="decision"},firstActionId:a.actionId,mode:"greedy",reason:"known-blue-cash-funds-held-transport"};
        const fixed=freeze({policy:resourceDemand.VERSION,isEquivalence:false,plans:[plan],retainedActionIds:[],
          excludedActionIds:node.legalActions.map(a=>a.actionId)});
        resourceSpecs.set(node,fixed);return fixed;
      }
      const preparation=node===openedRoot?transportPreparationPurpose():null;
      const cardPick=cardPickSpec(node);
      if(preparation&&node.status==="decision"){
        const fixed=freeze({policy:resourceDemand.VERSION,isEquivalence:false,plans:[preparation.plan],retainedActionIds:[],
          excludedActionIds:node.legalActions.map(a=>a.actionId)});
        resourceSpecs.set(node,fixed);return fixed;
      }
      if(cardPick?.fixed){resourceSpecs.set(node,null);return null;}
      const envelope=stored.envelope,state=readPlanningState(stored),session=envelope.session?.session;
      let goals=[],source=null,operation={},incomeTail=null,blueTails=[],computerTail=null,protectedIncome=null;
      if(stored.resourceControl){
        const control=stored.resourceControl,step=resourceStep(node,control.goal,control.operation);
        const ids=step.kind==="fallback"?step.actionIds:step.actionId?[step.actionId]:[];
        if(step.kind==="complete"){resourceSpecs.set(node,null);return null;}
        const result=freeze({policy:resourceDemand.VERSION,isEquivalence:false,bound:true,goal:control.goal,operation:control.operation,step,
          retainedActionIds:[],excludedActionIds:node.legalActions.map(a=>a.actionId),plans:ids.map(id=>({id:control.goal.id+":"+id,goal:control.goal,operation:control.operation,firstActionId:id,mode:step.kind==="fallback"?"search-fallback":"greedy",fallbackReason:step.kind==="fallback"?step.reason:null}))});
        resourceSpecs.set(node,result);return result;
      }
      if(node.status==="stable"){
        const p=state.players.players.find(p=>p.id===seatId),t=state.turn;
        const ready=node.legalActions.filter(a=>a.family==="complete_task");
        // A persistent, public publicity reward that fits now is fixed
        // preparation. An over-cap reward still uses the native defer policy.
        if(p.mainActionCompleted&&t.roundNumber===3&&t.activePlayerIds?.includes(seatId)
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
          &&!stored.intent&&!hasOwnVisitSource(state)&&!t.cardTurnEventBonuses?.length&&ready.length===1){
          const task=ready[0],card=p.reservedCards.find(c=>c.id===task.target.cardInstanceId);
          const model=card&&knownCards(stored.envelope).has(card.id)&&localPlans.sectorPublicityReward(card);
          if(model&&model.task.id===task.target.ruleId&&model.model.cardType===2&&!model.model.endGameScoring
            &&p.resources.publicity+model.gain.publicity<=players.RESOURCE_LIMITS.publicity){
            const spec=freeze({policy:resourceDemand.VERSION,isEquivalence:false,plans:[],
              retainedActionIds:[task.actionId],excludedActionIds:node.legalActions.filter(a=>a!==task).map(a=>a.actionId),
              fixedPublicityTask:{cardId:card.id,gain:model.gain.publicity}});
            resourceSpecs.set(node,spec);return spec;
          }
        }
        goals=resourceCatalog(state,node.legalActions);
        protectedIncome=lateIncomePayment(state,stored,node.legalActions,goals);
        if(protectedIncome)goals=goals.map(g=>g.id===protectedIncome.goal.id?protectedIncome.goal:g);
        if(node.legalActions.some(a=>a.family==="place_data"||a.family==="card_corner"&&a.payload?.kind==="resource")){
          const supply=blueLandingGoalFor(state);if(supply)goals=[...goals,supply];
        }
        const native=productionKernel||globalThis.SetiProductionKernel;
        if(node.legalActions.some(a=>goalMovement.isDirection(a))){
          const landing=resourceDemand.heldLandingGoal({state,seatId,compareTiming:timingForOneGoalQuery(state),
            candidates:()=>native.getProbeRouteRequirements(state,seatId)?.candidates||[]});
          if(landing)goals=[...goals,landing];
        }
      }else{
        source=session?.journal?.actions?.[0]?.action;
        if(session?.baseState&&(resourceDemand.isPreparation(source||{})||source?.family==="move")){
          const base=planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope));
          goals=resourceCatalog(base,[source]);
          protectedIncome=lateIncomePayment(base,stored,[source],goals);
          if(protectedIncome)goals=goals.map(g=>g.id===protectedIncome.goal.id?protectedIncome.goal:g);
          goals=goals.filter(goal=>{
              const first=resourceDemand.step({state:base,seatId,goal,actions:[source],status:"stable"});
              return first.actionId===source.actionId||first.kind==="fallback"&&first.actionIds.includes(source.actionId);
            });
          operation={placing:source.family==="place_data",finalPlacement:false};
          if(source.family==="place_data"){
            const base=planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope));
            const supply=blueLandingGoalFor(base);if(supply)goals=[...goals,supply];
          }
        }
      }
      if(goals.some(g=>g.kind==="computer-prefix")){
        const prefixState=node.status==="decision"&&session?.baseState?planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope)):state;
        const ranked=goals.filter(g=>g.kind==="computer-prefix").map(goal=>({goal,tail:localPlans.computerCompletion({state:prefixState,seatId,goal})}))
          .filter(p=>p.tail.available&&p.tail.selected).sort((a,b)=>b.tail.netGain-a.tail.netGain||a.tail.requiredNativeInputs-b.tail.requiredNativeInputs||a.goal.targetComputerSlot-b.goal.targetComputerSlot);
        const selected=ranked[0];computerTail=selected?.tail||null;
        goals=goals.filter(g=>g.kind!=="computer-prefix"||g===selected?.goal);
      }
      if(state.players.players.find(p=>p.id===seatId).mainActionCompleted){
        let goal=goals.find(g=>g.kind==="income");
        if(goal){incomeTail=localPlans.incomeCompletion({state:node.status==="decision"&&session?.baseState?passPlanningState(planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope)),session):state,seatId,goal});
          if(node.status==="stable"&&incomeTail.reason==="income-tail-needs-additional-funding"){
            const p=state.players.players.find(v=>v.id===seatId),turn=state.turn;
            // Complete a fresh analysis with the minimum known data
            // payments; later income effects still materialize through Native.
            const supplier=p.hand.length===4&&p.hand.find(c=>c.id===goal.incomeCardId);
            const gain=supplier&&cards.getIncomeGainForCard(supplier);
            // One separate supplier remains after the exact three known
            // data payments. Do not protect a card that must fund a slot.
            const separateIncome=Boolean(gain?.energy===1&&Object.keys(gain).length===1
              &&!(cards.getDiscardActionRewardForCard(supplier)?.dataCount>0));
            const threeCorners=turn.roundNumber===3&&p.resources.availableData===1&&hasOwnVisitSource(state)
              &&(separateIncome||p.hand.length===6||p.hand.length===5&&p.industryRoundMarkRound===turn.roundNumber
                &&p.industryRoundMarkTurn===turn.turnNumber)
              &&p.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount===1).length===3;
            if(turn.roundNumber===3&&data.listComputerPlacedTokens(p).length===0
              &&([2,3].includes(p.resources.availableData)||threeCorners)&&p.resources.credits===0&&p.resources.energy===0&&!stored.intent
              &&industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId==="deepspace_swap_cards"
              &&turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id))
              &&p.hand.every(c=>knownCards(stored.envelope).has(c.id))&&!node.legalActions.some(a=>a.family==="complete_task")
              &&hasPostMainInertReservations(state,hasOwnVisitSource(state),true,true)){
              const protectedGoal=threeCorners?localPlans.preserveResearchInThreeCornerIncome(state,p,goal):null;
              const fundedGoal=protectedGoal||goal;
              const payment=resourceDemand.dataIncomeFunding({state,seatId,goal:fundedGoal,actions:node.legalActions,maxCorners:threeCorners?3:2});
              if(payment&&localPlans.quietEndCompletion({state:payment.state,seatId}).markedTiles?.length===0){
                const paid=localPlans.incomeCompletion({state:payment.state,seatId,goal:fundedGoal});
                if(Number.isFinite(paid.netGain)){
                  const prepared=payment.state.players.players.find(v=>v.id===seatId);
                  const netGain=stateValue.sumValueParts([paid.netGain,payment.resourceDelta,
                    resourceDemand.planningCapital(payment.state,prepared),-resourceDemand.planningCapital(state,p)]);
                  if(netGain>0){
                    if(protectedGoal){goals=goals.map(g=>g===goal?protectedGoal:g);goal=protectedGoal;}
                    incomeTail={...paid,netGain,selected:true,cornerFunding:payment.corners.length===1
                     ?{cardId:payment.cardId,actionId:payment.actionId}:{cardId:payment.cardId,actionId:payment.actionId,corners:payment.corners}};
                  }
                }
              }
            }
          }
          goals=goals.filter(g=>g.kind!=="income"||incomeTail.selected);
        }
      }
      if(node.status==="stable"&&state.players.players.find(p=>p.id===seatId).mainActionCompleted){
        const player=state.players.players.find(p=>p.id===seatId),company=industryCatalog.getPlayerIndustryDefinition(player);
        // With these active skills disabled there is no remaining company
        // resource sink. Keep preparatory/main-action and movement opportunities.
        const noMovement=!state.pieces.rockets.some(r=>(r.surface??"solar-board")==="solar-board"&&[r.playerId,r.playerColor,r.color].some(id=>id===seatId||id===player.color));
        if((["turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId)&&noMovement
          ||company?.activeAbilityId==="deepspace_swap_cards"&&hasTradeInertReservations(state,true))
          &&!player.industryBorrowedTechTileId&&!node.legalActions.some(a=>a.family==="complete_task")){
          goals=goals.filter(goal=>{
            if(goal.kind!=="blue-data")return true;
            const tail=localPlans.blueCompletion({state,seatId,goal});blueTails.push({goalId:goal.id,...tail});
            return !tail.available||tail.selected;
          });
        }
      }
      if(scanPlanning){
        const purposeState=node.status==="decision"&&resourceDemand.isPreparation(source||{})?planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope)):state;
        const preparing=node.status==="decision"&&resourceDemand.isPreparation(source||{}),p=purposeState.players.players.find(p=>p.id===seatId),scanCost=scanEffects.getStandardScanCost(p);
        const launchPossible=!p.mainActionCompleted&&(node.status==="stable"||preparing)&&scanEffects.playerOwnsPurpleTech(p,4,{turn:purposeState.turn})
          &&p.resources.energy<(scanCost.energy||0)+scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY&&resourceQuery(purposeState).launchPossible;
        const build=required=>localPlans.scanGoals({state:purposeState,seatId,actions:node.legalActions,session:node.status==="decision"&&!preparing?session:null,required,launchPossible});
        const needed=goals.some(g=>g.kind==="scan");goals=goals.flatMap(g=>g.kind==="scan"?build(g.required):[g]);
        if(!needed&&(node.status==="stable"&&node.legalActions.some(a=>a.family==="scan")||node.status==="decision"&&localPlans.scanDecision(node.legalActions)))goals.push(...build(node.status==="stable"?scanCost:{}));
        else if(!needed&&preparing&&launchPossible)goals.push(...build(scanCost).filter(goal=>{
          if(!goal.launch)return false;const first=resourceDemand.step({state:purposeState,seatId,goal:{...goal,kind:"scan"},actions:[source],status:"stable"});
          return first.actionId===source.actionId||first.kind==="fallback"&&first.actionIds.includes(source.actionId);
        }));
      }
      const plans=[];
      if(node===openedRoot&&state.turn.roundNumber===3){
        const candidate=node.status==='stable'&&node.legalActions.some(a=>a.family==='move')
          ?researchMovementPlan(state,node.legalActions,knownCards(envelope))
          :source?.family==='move'&&session?.baseState
            ?researchMovementPlan(planningState(session.baseState,stored.informationBarrier,knownCards(envelope)),[],knownCards(envelope),source):null;
        if(candidate)goals=[...goals,candidate];
        const transport=node.status==="stable"?transportResearchMove(state,node.legalActions,knownCards(envelope))
          :source?.family==="move"&&session?.baseState
            ?transportResearchMove(planningState(session.baseState,stored.informationBarrier,knownCards(envelope)),[],knownCards(envelope),source):null;
        if(transport)goals=[...goals,transport];
      }
      const preparationBase=state.turn.roundNumber!==3?null
        :node.status==='stable'&&node.legalActions.some(a=>a.family==='place_data')?state
        :node.status==='decision'&&source?.family==='place_data'&&session?.baseState
          ?planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope)):null;
      const special=preparationBase&&analysisPreparation(preparationBase,stored,node);
      if(special)goals=[...goals,special];
      for(const goal of goals){
        const op={...operation,finalPlacement:source?.family==="place_data"&&goal.kind==="blue-data"};
        if(node.status==="decision"&&source?.family==="place_data"&&session?.baseState){
          const first=resourceDemand.step({state:planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope)),seatId,goal:goal.kind==="scan-flow"?{...goal,kind:"scan"}:goal,actions:[source],status:"stable"});
          if(first.resourceBlueSlot)Object.assign(op,{resourceBlueSlot:first.resourceBlueSlot,finalResourceBlue:first.finalResourceBlue});
        }
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
      if(preparation)plans.push(preparation.plan);
      const owner=state.players.players.find(p=>p.id===seatId);
      let sharedDataFunding=null;
      if(node.status==="stable"&&plans.length===1&&plans[0].goal.kind==="blue-data"
        &&incomeTail?.reason==="income-tail-needs-additional-funding"&&owner.resources.availableData===0){
        const blue=plans[0],action=node.legalActions.find(a=>a.actionId===blue.firstActionId);
        if(action?.family==="card_corner"&&action.payload?.kind==="resource"&&(action.payload.multiplier??1)===1&&quietScoredIncomeState(state,stored)){
          const prepared=localPlans.previewScoredAmibaDataCorner({state,seatId,cardId:action.target.cardInstanceId});
          const future=prepared&&quietScoredIncomeState(prepared,stored)&&localPlans.quietEndCompletion({state:prepared,seatId}).markedTiles?.length===0;
          const targets=future&&resourceDemand.catalog({state:prepared,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(prepared.players.players.find(p=>p.id===seatId))}});
          const income=targets?.find?.(g=>g.kind==="income"),blueStill=targets?.find?.(g=>g.id===blue.goal.id);
          if(income&&blueStill&&targets.length===2){
            const a=localPlans.incomeCompletion({state:prepared,seatId,goal:income}),b=localPlans.blueCompletion({state:prepared,seatId,goal:blueStill});
            if(a.selected&&b.available&&(!b.selected||a.netGain>=b.netGain)){
              sharedDataFunding={cardId:action.target.cardInstanceId,incomeCardId:income.incomeCardId,income:a.netGain,blue:b.netGain};
              const goal={id:"data:shared-scored-corner",kind:"scored-data-funding",cardId:action.target.cardInstanceId,actionId:action.actionId,required:{}};
              plans[0]={id:goal.id,goal,operation:{},firstActionId:action.actionId,mode:"greedy",reason:"pay-known-data-then-resolve-fixed-income"};
            }
          }
        }
      }
      const deferredCappedTask=cappedSectorTaskToKeep(state,owner,node);
      const excluded=node.status==="stable"?node.legalActions.filter(a=>a.actionId===deferredCappedTask?.actionId||a.family==="industry"&&["turing_borrow_tech","helios_remove_tech_income"].includes(a.target?.abilityId)||plans.some(p=>p.goal.kind==="effect-purpose"&&p.firstActionId===a.actionId)||a.family==="play_card"&&plans.some(p=>p.goal.cardId===a.target.cardInstanceId&&p.goal.paidRewardPolicy)||resourceDemand.isPreparation(a)||scanPlanning&&plans.some(p=>p.goal.kind==="scan-flow")&&a.family==="scan"||!owner.mainActionCompleted&&["orbit","land","research_tech",...(plans.some(p=>p.goal.kind==="route")?["move"]:[])].includes(a.family)):plans.length?node.legalActions:[];
      const company=industryCatalog.getPlayerIndustryDefinition(owner),bluePlan=plans.find(p=>p.goal.kind==="blue-data");
      let recoveredDataOrder=null;
      // A cold snapshot can be taken between the shared place-data action
      // and its slot menu. Recover the same ordered income/blue plan from
      // the original wallet rather than rank the two partially run paths.
      if(node.status==="decision"&&source?.family==="place_data"&&session?.queue.length===1
        &&(session.queue[0].type===scienceSession.EFFECT_TYPES.PLACE_DATA
          &&node.legalActions.every(a=>a.family==="choose_target"&&["computer","blueBonus"].includes(a.target?.target))
          ||session.queue[0].type===scienceSession.EFFECT_TYPES.INCOME
          &&session.journal.events.some(e=>e.type==="placeData"&&e.playerId===seatId&&e.placementKind==="computer"&&e.placementSlot===4)
          &&node.legalActions.every(a=>a.family==="choose_card"&&a.target?.choiceId?.startsWith("income:")))
        &&incomeTail?.selected&&bluePlan&&plans.length===2&&plans.some(p=>p.goal.kind==="income")){
        const base=planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope));
        const p=base.players.players.find(p=>p.id===seatId);
        if(p.resources.availableData===1&&quietScoredIncomeState(base,stored)){
          const alternative=localPlans.blueCompletion({state:base,seatId,goal:bluePlan.goal});
          if(alternative.available&&!alternative.dataCornerId&&!alternative.incomeCardId)
            recoveredDataOrder={blue:alternative,income:incomeTail.netGain};
        }
      }
      const incomeCandidate=(node.status==="stable"||recoveredDataOrder)&&incomeTail?.selected&&plans.some(p=>p.goal.kind==="income");
      const blueTail=node.status==="stable"&&owner.mainActionCompleted&&bluePlan
        &&["deepspace_swap_cards","turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId)
        &&!owner.industryBorrowedTechTileId&&!state.turn.cardTurnEventBonuses?.length
        &&!node.legalActions.some(a=>a.family==="complete_task"||a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards")
        &&hasPostMainInertReservations(state,hasOwnVisitSource(state))?localPlans.blueCompletion({state,seatId,goal:bluePlan.goal}):null;
      // Fixed preparation order follows the shared purpose value. Income
      // cannot take unconditional precedence when a blue reward funds a more
      // valuable held-card or mission purpose; a cold pending slot must see the same opportunity.
      const competingBlue=recoveredDataOrder?.blue||blueTail||blueTails.find(t=>t.goalId===bluePlan?.goal.id);
      const forceBlue=competingBlue?.available&&competingBlue.selected
        &&(!incomeCandidate||competingBlue.netGain>incomeTail.netGain);
      const forceIncome=incomeCandidate&&!forceBlue;
      const forceComputer=node.status==="stable"&&computerTail?.selected
        &&(!incomeCandidate||computerTail.netGain>incomeTail.netGain)&&(!forceBlue||computerTail.netGain>competingBlue.netGain);
      let forcedKind=forceComputer?"computer-prefix":forceIncome?"income":forceBlue?"blue-data":null;
      let forcedGain=forceComputer?computerTail.netGain:forceIncome?incomeTail.netGain:forceBlue?competingBlue.netGain:0;
      const analysisFunding=plans.find(p=>p.goal.kind==="analysis-publicity");
      if(analysisFunding&&analysisFunding.goal.fundingNetGain>Math.max(0,stateValue.normalizeValue(forcedGain))){
        forcedKind="analysis-publicity";forcedGain=analysisFunding.goal.fundingNetGain;
      }
      // Use the same greedy preparation ranking for a known company swap.
      // Compare canonical ledger units: subtracting two portfolio scalars can
      // otherwise make an exact4.75 tie look like4.750000000000002.
      const competingSwap=forcedKind&&cardPick?.companySwap;
      const swapGain=competingSwap?stateValue.normalizeValue(competingSwap.goal.netGain):0;
      const swapAction=swapGain>Math.max(0,stateValue.normalizeValue(forcedGain))&&node.legalActions.find(a=>a.actionId===cardPick.selectedActionId
        &&a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards");
      // Preserve the existing fixed tail, adding only the single known
      // supplier. Its arrival must not reopen other data/corner purposes.
      const supplyPlans=plans.filter(p=>p.goal.kind==="blue-landing-supply");
      const result=freeze({policy:resourceDemand.VERSION,isEquivalence:false,
        plans:swapAction?[...supplyPlans,...plans.filter(p=>p.goal.analysisPreparation)]:forcedKind?plans.filter(p=>p.goal.kind===forcedKind||p.goal.kind==="blue-landing-supply"||p.goal.analysisPreparation):plans,
        ...(deferredCappedTask?{deferredCappedTask}:{}),...(protectedIncome?{protectedIncome:protectedIncome.proof}:{}),
        ...(incomeTail?{incomeTail}:{}),...(blueTail?{fixedBlueTail:blueTail}:{}),...(blueTails.length?{blueTails}:{}),...(computerTail?{fixedComputerTail:computerTail}:{}),
        ...(swapAction?{fixedCompanySwap:{goal:competingSwap.goal,netGain:swapGain,replaces:forcedKind,replacesGain:forcedGain}}:{}),
        ...(sharedDataFunding?{sharedDataFunding}:{}),
        ...(recoveredDataOrder?{recoveredDataOrder:{income:recoveredDataOrder.income,blue:recoveredDataOrder.blue.netGain,selected:forcedKind}}:{}),
        retainedActionIds:forcedKind?(swapAction?[swapAction.actionId]:[]):node.legalActions.filter(a=>!excluded.includes(a)).map(a=>a.actionId),excludedActionIds:forcedKind?node.legalActions.filter(a=>a!==swapAction).map(a=>a.actionId):excluded.map(a=>a.actionId)});
      resourceSpecs.set(node,result);return result;
    }

    function resourceView(node,control) {
      const stored=nodes.get(node),session=stored.envelope.session?.session,head=session?.queue?.[0],effect=head?.payload?.cardEffect;
      // Once a pure research card has been paid, completed income/data funding
      // cannot affect its pending tile choice. Keep the full rule/RNG key and
      // goal; normalize only these obsolete private preparation fields.
      if(control?.goal.kind==="effect-purpose"&&control.goal.purpose==="tech"&&control.operation?.targetStarted
        &&node.status==="decision"&&session.queue.length===1&&head.payload.cardInstanceId===control.goal.cardId
        &&effect?.type==="card_research_tech"&&!effect.options?.afterResearchReward&&(effect.options?.repeat??1)===1){
        const state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId),played=owner.reservedCards.find(c=>c.id===control.goal.cardId),play=played&&cardEffects.buildPlayEffects(played);
        if(play?.length===1&&play[0].type==="card_research_tech"&&!play[0].options?.afterResearchReward
          &&data.listComputerPlacedTokens(owner).some(t=>t.placementSlot===4)
          &&!owner.hand.some(c=>c.id===control.goal.incomeCardId)
          &&owner.reservedCards.every(c=>{const model=cardEffects.getCardModel(c);return model&&!model.triggers?.length&&!model.temporaryTasks?.length;})
          &&Object.values(state.aliens.aliens).every(slot=>!slot.revealed&&!alienState.isAlienReadyToReveal(slot))){
          const goal={...control.goal},operation={...control.operation};
          for(const key of ["targetComputerSlot","incomeCardId","incomeFunding","publicityData","incomeBefore"])delete goal[key];
          for(const key of ["placing","finalPlacement","discardIds","resourceBlueSlot","finalResourceBlue"])delete operation[key];
          control={goal,operation};
        }
      }
      return createNode(stored.envelope,null,node.legalActions,node.status,stored.informationBarrier,stored.intent,control);
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
        current=createNode(stored.envelope,null,[],"plan-infeasible",stored.informationBarrier,stored.intent);sharedStates.push(current);contexts++;
        return finish({goalStatus:"infeasible",reason});
      }
      while(true){
        if(["other-owner","information-barrier","terminal","turn-boundary"].includes(current.status))return finish({goalStatus:"boundary"});
        const spec=cardPickSpec(current),tail=targetReached?localDecisionSpec(current):null;
        if(targetReached&&!spec?.fixed&&!tail?.selectedActionId)return finish({goalStatus:"completed"});
        const step=spec?.fixed&&plan.goal.kind!=="transport-data-prep"?{kind:"fixed",actionId:spec.selectedActionId,reason:"fixed-card-in-resource-plan"}
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
        preparations.push({input:prefixes.length,reason:step.reason,goalId:plan.goal.id,demand:resourceDemand.needs(readPlanningState(nodes.get(current)),seatId,plan.goal),actionId:id});
        // Discard identities belong to one native action, not the whole resource goal.
        operation={...operation,...(current.status==="stable"?{discardIds:null}:{}),...(chosen.discardIds?{discardIds:chosen.discardIds}:{}),...(chosen.placing!==undefined?{placing:chosen.placing}:{}),...(chosen.scanLaunchCompleted?{scanLaunchCompleted:true}:{}),...(chosen.finalPlacement!==undefined?{finalPlacement:chosen.finalPlacement}:{}),...(chosen.resourceBlueSlot!==undefined?{resourceBlueSlot:chosen.resourceBlueSlot}:{}),...(chosen.finalResourceBlue!==undefined?{finalResourceBlue:chosen.finalResourceBlue}:{}),...(step.kind==="start-target"?{targetStarted:true}:{})};
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

    let timingPrefixBuilds = 0, timingPrefixReuses = 0;
    function timingForOneGoalQuery(state) {
      let prefix, query;
      const native = productionKernel || globalThis.SetiProductionKernel;
      return (id, path, freePoints) => {
        if (prefix === undefined) {
          timingPrefixBuilds++;
          prefix = native.plannedMovementTimingKeyPrefix(state, seatId);
        } else timingPrefixReuses++;
        // Both pieces are exact Native JSON bytes. Avoid concatenating and
        // hashing the whole board on every lookup of a different route.
        const key = native.appendMovementTimingKey("", id, path, freePoints);
        let group = movementTimingGroups.get(prefix);
        const hit = group?.get(key);
        if (hit) { movementTimingCacheHits++; return hit.result; }
        movementTimingCacheMisses++;
        query ||= native.createPlannedMovementTimingQuery(state, seatId);
        const result = query(id,path,freePoints);
        if (movementTimingCache.size >= 256) {
          const oldest = movementTimingCache.values().next().value;
          const oldGroup = movementTimingGroups.get(oldest.prefix);
          oldGroup.delete(oldest.key);
          if (!oldGroup.size) movementTimingGroups.delete(oldest.prefix);
          movementTimingCache.delete(oldest);
          if (oldGroup === group && !group.size) group = null;
        }
        if (!group) { group = new Map(); movementTimingGroups.set(prefix,group); }
        const entry = {prefix,key,result};
        group.set(key,entry);
        movementTimingCache.add(entry);
        return result;
      };
    }

    function recoverMovementIntent(envelope,barrier=null) {
      const session = envelope.session?.session, head = session?.queue?.[0], effect = head?.payload?.cardEffect;
      const source = session?.journal?.actions?.[0]?.action;
      const prepaid = source?.family === "quick_trade" && source.target?.tradeId === "energy-for-move"
        && head?.payload?.decisionContext?.kind === "move" && head.payload.decisionContext.tradeId === "energy-for-move";
      if ((source?.family === "move" || prepaid) && session.baseState) {
        const state = planningState(session.baseState,barrier,knownCards(envelope));
        const selected = goalMovement.plan({state,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          compareTiming:timingForOneGoalQuery(state),
          endpoints:()=> (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(state,seatId)?.candidates || []});
        goalMovementGeometryNodes += selected?.routingNodes || 0;
        const intent = selected?.intent, first = intent?.path[0];
        // A prepaid step is the execution of the original movement purpose.
        // Preserve it through the native trade session, including cold restore.
        if (first && prepaid) return { ...intent, free: true, prefixOnly: true };
        if (first && source.target.rocketId === intent.rocketId && source.target.deltaX === first.deltaX && source.target.deltaY === first.deltaY) return intent;
      }
      // Bind a currently played known tool to the same funded named prefix
      // that was quoted before its real native card input. No quoted launch or
      // future identity can become an executable direction.
      if(source?.family==="play_card"&&effect?.type==="card_move"&&session.baseState
        &&source.target?.cardInstanceId===head.payload.cardInstanceId){
        const anchor=planningState(session.baseState,barrier,knownCards(envelope)),owner=anchor.players.players.find(p=>p.id===seatId);
        const card=owner?.hand.find(c=>c.id===head.payload.cardInstanceId);
        if(card&&(!barrier||knownCards(envelope).has(card.id))&&stateValue.hasKnownMovementTool([card])
          &&(!barrier||owner.reservedCards.every(c=>knownCards(envelope).has(c.id)))){
          const visibleOwner=barrier?{...owner,hand:owner.hand.filter(c=>knownCards(envelope).has(c.id))}:owner;
          const quote=resourceDemand.movementToolPlan(anchor,visibleOwner),selected=quote.selected;
          if(quote.value>0&&!selected.prospectiveLaunch&&selected.cardId===card.id&&selected.rocketId>0){
            const first=selected.path[0],at=rockets.getRocketSectorCoordinate(session.workingState.pieces.rockets.find(r=>r.id===selected.rocketId));
            if(first&&at?.x===first.from.x&&at.y===first.from.y)return{rocketId:selected.rocketId,path:[first],free:true,prefixOnly:true,
              startedTurn:anchor.turn.turnNumber,startedRound:anchor.turn.roundNumber,
              goal:{id:"known-tool:"+card.id+":"+selected.goalId,kind:"known-tool-preparation",timing:"preparation",
                coordinate:first.to,targetCoordinate:selected.path.at(-1).to,label:"已筹资的数据/移动准备"}};
          }
        }
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
        compareTiming: timingForOneGoalQuery(frame.stateBefore),
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
      const state = readPlanningState(stored);
      if(node.status==="stable"&&!stored.intent&&node.legalActions.some(a=>a.family==="end_turn")){
        const wait=resourceDemand.blueLandingWait({state,seatId,compareTiming:timingForOneGoalQuery(state),
          candidates:()=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(state,seatId)?.candidates||[]});
        if(wait){
          const movement=node.legalActions.filter(a=>goalMovement.isDirection(a)||a.target?.tradeId==="energy-for-move"
            ||a.family==="card_corner"&&a.payload?.kind==="move");
          const policy=freeze({policy:"seti-fixed-blue-landing-supply-v1",selectedActionId:null,chosenGoal:{id:wait,timing:"defer"},
            retainedActionIds:node.legalActions.filter(a=>!movement.includes(a)).map(a=>a.actionId),
            excludedActionIds:movement.map(a=>a.actionId),excludedDirectionCount:movement.filter(goalMovement.isDirection).length,
            routingNodes:0,reason:"reserve-income-and-wait-for-known-landing"});
          movementPolicies.set(node,policy);return policy;
        }
      }
      const result = goalMovement.plan({ state, seatId,
        actions: node.legalActions, status: node.status, session: stored.envelope.session?.session,
        intent: stored.intent, routeCache: movementRouteCache,
        compareTiming: timingForOneGoalQuery(state), endpoints: () => (productionKernel || globalThis.SetiProductionKernel).getProbeRouteRequirements(state, seatId, stored.envelope.session?.session?.queue?.[0])?.candidates || [] });
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
        current = createNode(stored.envelope, null, [], "plan-infeasible", stored.informationBarrier, stored.intent);
        goalStatus = reason;
      }
      while (prefixes.length < maxInputs) {
        if (["terminal", "other-owner", "information-barrier","turn-boundary"].includes(current.status)) { goalStatus = "boundary"; break; }
        if (spec.intent.prefixOnly && prefixes.length && current.status === "stable") { goalStatus = "preparation-step-completed"; break; }
        const stored = nodes.get(current), intent = current === node ? spec.intent : stored.intent;
        const state = readPlanningState(stored), owner = state.players.players.find(p => p.id === seatId);
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

    function executeCurrent(current) {
      const comp = fork.composition || fork;
      // The immutable node/menu already supplied this descriptor. The native
      // submit port still validates it against the restored authority and
      // decision version; do not enumerate the same full menu a second time.
      const before = comp.inspect(true);
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

    function knownRewardChoices(envelope,actions) {
      const session=envelope.session?.session,head=session?.queue?.[0],state=readIdentityState(envelope);
      const owner=state.players.players.find(p=>p.id===seatId);
      if(head?.ownerId!==seatId || [...owner.hand,...owner.reservedCards].some(c=>!knownCards(envelope).has(c.id)))return [];
      if(head.type===scienceSession.EFFECT_TYPES.PICK_CARD)return actions.filter(a=>a.actorId===seatId&&cardPickPlanningApi.isOffer(a)
        &&a.target?.source!=="blind"&&knownCards(envelope).has(a.target.cardInstanceId||a.payload?.cardInstanceId||state.cards.publicCards[a.target.publicSlotIndex]?.id));
      if(head.type===scienceSession.EFFECT_TYPES.INCOME)return actions.filter(a=>a.actorId===seatId&&a.family==="choose_card"
        &&a.target?.choiceId?.startsWith("income:")&&knownCards(envelope).has(a.target.cardInstanceId));
      if(head.type===scienceSession.EFFECT_TYPES.SCAN_STEP&&head.payload?.options?.mode==="specified")return actions.filter(a=>a.actorId===seatId&&a.family==="choose_target"
        &&!a.target?.cardInstanceId&&(knownRootNebulaIds.has(a.target?.nebulaId)||a.target?.skip||a.target?.done));
      return [];
    }

    function knownPostMainActions(envelope, actions, anonymousHand = false) {
      const state=readIdentityState(envelope),owner=state.players.players.find(p=>p.id===seatId);
      if(!resourcePlanning||state.turn.gameEnded||!owner.mainActionCompleted||actions.some(a=>a.actorId!==seatId)
        ||[...owner.reservedCards,...(owner.privateAlienCards||[])].some(card=>!knownCards(envelope).has(card.id))
        ||!anonymousHand&&owner.hand.some(card=>!knownCards(envelope).has(card.id)))return [];
      function known(value,key="") {
        if(value==null)return true;
        if(key==="cardInstanceId"||key==="cardId")return knownCards(envelope).has(value);
        if(key==="cardInstanceIds"||key==="cardIds")return Array.isArray(value)&&value.every(id=>knownCards(envelope).has(id));
        if(key==="alienId")return knownRootAlienIds.has(value);
        if(Array.isArray(value))return value.every(item=>known(item));
        return typeof value!=="object"||Object.entries(value).every(([name,item])=>known(item,name));
      }
      return actions.filter(action=>{
        if(!known(action.target)||!known(action.payload))return false;
        const target=action.target||{};
        if(action.family==="choose_card"&&target.kind==="residual-domain"&&target.source==="display"
          &&target.choiceId?.startsWith("amiba:display:")
          &&target.cardIndex!==rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex)return false;
        if(action.family==="choose_card"&&target.kind==="residual-domain"&&target.source==="display"
          &&target.choiceId?.startsWith("chong:display:")&&target.cardIndex!==knownChongDisplayIndex)return false;
        if(Number.isInteger(target.publicSlotIndex)&&!knownCards(envelope).has(state.cards.publicCards[target.publicSlotIndex]?.id))return false;
        if(target.tileId&&state.tech.stacks[target.tileId]
          &&(action.family==="research_tech"||envelope.session?.session?.queue?.[0]?.type===scienceSession.EFFECT_TYPES.RESEARCH)
          &&state.tech.stacks[target.tileId].bonusIndex!==knownRootTechIndices.get(target.tileId))return false;
        return true;
      });
    }

    function finishChild(before, result, intent = null, resourceControl = null, carriedBarrier = null, sourceAction = null, source = null) {
      const comp = fork.composition || fork;
      const inspection = comp.inspect();
      const nativeBarrier = result.irreversibleBarrier || inspection.session?.irreversibleBarrier;
      const envelope = snapshot(comp);
      const head = envelope.session?.session?.queue?.[0], effect = head?.payload?.cardEffect;
      // The landing resolves before Native presents the destination's
      // previously hidden fossils. Search may value the settled landing,
      // but cannot select from the newly disclosed IDs.
      const fossilReveal = head?.ownerId===seatId && effect?.type==="chong_pickup_fossil" && effect.options?.cardIndex===3
        && inspection.session?.decision?.choices.some(a=>a.target?.fossilId&&!knownRootFossilIds.has(a.target.fossilId));
      const revealed = fossilReveal || ruleComposition.isHiddenInformationBarrier(nativeBarrier)
        && JSON.stringify(nativeBarrier) !== JSON.stringify(before.session?.irreversibleBarrier);
      const barrier = fossilReveal ? {code:"hidden_chong_fossil_offer"} : revealed ? nativeBarrier : carriedBarrier || nativeBarrier;
      const newBarrier = Boolean(carriedBarrier) || revealed;
      inheritCardKnowledge(envelope,source,sourceAction);
      if(cardPickPlanning&&source&&sourceAction){
        const intent=envelopeCardSpecs.get(source.envelope)?.companySwap,head=envelope.session?.session?.queue?.[0],previous=source.envelope.session?.session?.queue?.[0];
        if(intent&&head?.type==='residual_company_decision'&&head.ownerId===seatId
          &&(sourceAction.family==='industry'&&sourceAction.target?.abilityId==='deepspace_swap_cards'&&head.payload?.step==='swap_hand'
            ||previous?.type==='residual_company_decision'&&previous.payload?.step==='swap_hand'&&sourceAction.family==='choose_card'
              &&sourceAction.target?.cardInstanceId===intent.discardIds[0]&&head.payload?.step==='swap_public'
              &&head.payload.handCardInstanceId===intent.discardIds[0]))envelopeCompanyIntents.set(envelope,intent);
      }
      loadedEnvelope = envelope;
      const childState = readIdentityState(envelope);
      // A refill does not end a root-known post-main plan. Unknown owned
      // identities, alien reveals, other owners and actual turn changes still close it.
      let knownRewardActions = [], postMainActions = [];
      // A proved acquired displayed alien card is root-known; only the replacement
      // stays hidden. Carry this permission through the same turn, but a new
      // alien-card barrier must itself prove a new public acquisition.
      const acquired=cardKnowledgeKey(envelope);
      const knownAlienAcquisition=barrier?.code==="hidden_alien_card"&&acquired
        &&(!revealed||acquired!==cardKnowledgeKey(source?.envelope));
      if (newBarrier && cardPickPlanning && (knownAlienAcquisition||["tech_bonus_reveal","hidden_card_reveal","hidden_card_draw"].includes(barrier.code))
        && JSON.stringify([childState.turn.roundNumber,childState.turn.turnNumber,childState.turn.actionCycleNumber])===rootTurnKey) {
        const nativeActions=legalActions(comp,inspection);
        postMainActions=knownPostMainActions(envelope,nativeActions);
        if(inspection.phase==="awaiting_input")knownRewardActions=knownRewardChoices(envelope,nativeActions);
      }
      const continueKnown = postMainActions.length > 0 || knownRewardActions.length > 0;
      const actions = postMainActions.length ? postMainActions : knownRewardActions.length ? knownRewardActions : newBarrier ? [] : legalActions(comp, inspection);
      // Native terminal state closes the window even if the host still lists
      // residual controls. A pending required Decision must still be completed.
      const terminal = childState.turn.gameEnded === true && inspection.phase !== "awaiting_input";
      const observation = !newBarrier && (!actions.length || terminal) ? observeEnvelope(envelope) : null;
      if (observation && observation.terminal !== true) {
        throw new Error("ANALYSIS_EMPTY_NONTERMINAL");
      }
      const turnChanged = JSON.stringify([childState.turn.roundNumber,childState.turn.turnNumber,childState.turn.actionCycleNumber]) !== rootTurnKey;
      const status = continueKnown ? inspection.phase==="awaiting_input"?"decision":"stable" : newBarrier ? "information-barrier"
        : terminal ? "terminal"
          : actions.some(action => action.actorId !== seatId) ? "other-owner"
          : !actions.length ? "terminal"
            : turnChanged ? "turn-boundary"
              : inspection.phase === "awaiting_input" ? "decision" : "stable";
      if(status==="information-barrier"&&!turnChanged){
        const knownTail=knownPostdrawTailView(envelope,inspection,barrier,intent,resourceControl,sourceAction);
        if(knownTail)return knownTail;
        const knownData=knownPostdrawDataView(envelope,inspection,barrier,intent,resourceControl);
        if(knownData)return knownData;
      }
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

    function knownPostdrawDataView(envelope,inspection,barrier,intent,resourceControl){
      // Newly held identities do not affect a fixed plan paid entirely with
      // existing pool data. Materialize its Native inputs when competing
      // columns prevent the compound scalar proof; never execute the new card.
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||intent||resourceControl
        ||!["hidden_card_draw","hidden_card_reveal"].includes(barrier?.code))return null;
      const state=readIdentityState(envelope),owner=state.players.players.find(p=>p.id===seatId);
      if(industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId!=="deepspace_swap_cards"
        ||owner.industryRoundMarkRound!==state.turn.roundNumber
        ||!owner.hand.some(card=>!knownCards(envelope).has(card.id))
        ||[...owner.reservedCards,...(owner.privateAlienCards||[])].some(card=>!knownCards(envelope).has(card.id))
        ||Object.values(state.aliens.aliens).some(slot=>slot.revealed&&!knownRootAlienIds.has(slot.alienId))
        ||!state.turn.activePlayerIds?.length
        ||!state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id)))return null;
      const actions=knownPostMainActions(envelope,legalActions(fork.composition||fork,inspection),true);
      if(!actions.length)return null;
      const pending=envelope.session?.session;
      if(pending){
        if(inspection.phase!=="awaiting_input"||pending.queue.length!==1
          ||pending.queue[0].type!==scienceSession.EFFECT_TYPES.PLACE_DATA
          ||pending.journal?.actions?.[0]?.action?.family!=="place_data"
          ||!actions.every(a=>a.family==="choose_target"&&["computer","blueBonus"].includes(a.target?.target)))return null;
        return createNode(envelope,null,actions,"decision",barrier);
      }
      if(inspection.phase!=="idle")return null;
      const view=createNode(envelope,null,actions,"stable",barrier),policy=resourceSpec(view);
      if(cardPickSpec(view)?.goal||goalMovementSpec(view)?.selectedActionId)return null;
      const plan=policy?.plans.length===1&&policy.plans[0];
      if(plan&&policy.retainedActionIds.length===0
        &&actions.some(a=>a.actionId===plan.firstActionId&&a.family==="place_data")){
        const projected=readPlanningState(nodes.get(view));
        const proof=plan.goal.kind==="computer-prefix"?localPlans.computerCompletion({state:projected,seatId,goal:plan.goal})
          :plan.goal.kind==="blue-data"?localPlans.blueCompletion({state:projected,seatId,goal:plan.goal}):null;
        if(proof?.available&&!proof.dataCornerId&&!proof.incomeCardId)return view;
      }
      if(policy?.plans.length===0&&policy.retainedActionIds.every(id=>actions.find(a=>a.actionId===id)?.family==="end_turn")
        &&turnTailSummary(view,"end-turn"))return view;
      return null;
    }

    function knownPostdrawTailView(envelope,inspection,barrier,intent,resourceControl,sourceAction){
      // Only an actual free Amiba card reward may open this view. The
      // complete Native snapshot is unchanged; unknown cards stay anonymous.
      // Every retained alternative must already have an exact fixed-tail proof.
      const freeCard=sourceAction?.family==="choose_card"&&sourceAction.target?.kind==="residual-domain"
        &&/^amiba:(display:\d+|blind)$/.test(sourceAction.target?.choiceId||"");
      if(!resourcePlanning||!cardPickPlanning||inspection.phase!=="idle"||envelope.session
        ||intent||sourceAction?.actorId!==seatId||!freeCard)return null;
      const state=readIdentityState(envelope),owner=state.players.players.find(p=>p.id===seatId);
      if(resourceControl)return null;
      if(industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId!=="deepspace_swap_cards"
        ||owner.industryRoundMarkRound!==state.turn.roundNumber
        ||!owner.hand.some(card=>!knownCards(envelope).has(card.id))
        ||!state.turn.activePlayerIds?.length
        ||!state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id)))return null;
      const actions=knownPostMainActions(envelope,legalActions(fork.composition||fork,inspection),true);
      if(!actions.length)return null;
      const view=createNode(envelope,null,actions,"stable",barrier),policy=resourceSpec(view);
      const plan=policy?.plans.length===1&&policy.plans[0];
      if(plan?.goal?.kind!=="income"||policy.retainedActionIds.length
        ||!knownCards(envelope).has(plan.goal.incomeCardId)||cardPickSpec(view)?.goal)return null;
      const gain=cards.getIncomeGainForCard(owner.hand.find(card=>card.id===plan.goal.incomeCardId));
      if(!gain||!Object.keys(gain).length||Object.keys(gain).some(k=>!["credits","energy"].includes(k)))return null;
      return turnTailSummary(view,"data-end-turn")?view:null;
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
        outcome = executeCurrent(current);
      }
      return remember(key, freeze({ node: finishChild(outcome.before, outcome.result, null, null, stored.informationBarrier, null, stored), actions,
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
        forwardIdentity(neutral, "selection-component", null),cardKnowledgeKey(envelope)]);
    }

    function rememberSelection(node, entries, modelKey) {
      const spec = selectionSpec(node);
      if (!spec || typeof modelKey !== "string" || !modelKey) throw new Error("ANALYSIS_SELECTION_EVIDENCE_INVALID");
      const expected = new Set([...selectionPlans(node)].map(plan => selectionTargetKey(plan.selectedIds, spec.unordered)));
      if (!Array.isArray(entries) || entries.length !== expected.size) throw new Error("ANALYSIS_SELECTION_EVIDENCE_INCOMPLETE");
      for (const entry of entries) {
        const key = selectionTargetKey(entry.selectedIds, spec.unordered);
        if (!expected.delete(key) || entry.preparationDebt!==undefined&&entry.preparationDebt!==null&&(!Number.isSafeInteger(entry.preparationDebt)||entry.preparationDebt<0) || entry.realization!==undefined&&entry.realization!==null&&!Number.isFinite(entry.realization) || (entry.value === null ? entry.distance !== null
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
        const realization = entry.realization ?? 0, preparationDebt=entry.preparationDebt??0;
        if (!best || entry.value > best.value || (entry.value === best.value
          && (preparationDebt < best.preparationDebt || preparationDebt === best.preparationDebt
            && (realization > best.realization || realization === best.realization
              && (distance < best.distance || (distance === best.distance && plan.firstActionId < best.actionId)))))) {
          best = { actionId: plan.firstActionId, selectedIds: plan.selectedIds, value: entry.value, realization, preparationDebt, distance };
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

    function savedMovementIntent(intent){
      const coordinate=p=>Number.isSafeInteger(p?.x)&&Number.isSafeInteger(p?.y);
      if(!intent||!Array.isArray(intent.path)||typeof intent.goal?.id!=="string"
        ||!Number.isSafeInteger(intent.rocketId)||intent.rocketId<=0
        ||!Number.isSafeInteger(intent.startedRound)||intent.startedRound<=0||!Number.isSafeInteger(intent.startedTurn)||intent.startedTurn<=0
        ||typeof intent.free!=="boolean"||typeof intent.prefixOnly!=="boolean"||!coordinate(intent.goal.coordinate))return false;
      return intent.path.every((step,i)=>coordinate(step.from)&&coordinate(step.to)
        &&Number.isSafeInteger(step.deltaX)&&Number.isSafeInteger(step.deltaY)&&Math.abs(step.deltaX)+Math.abs(step.deltaY)===1
        &&Number.isSafeInteger(step.requiredMovePoints)&&step.requiredMovePoints>0
        &&(!i||step.from.x===intent.path[i-1].to.x&&step.from.y===intent.path[i-1].to.y))
        &&(!intent.path.length||intent.path.at(-1).to.x===intent.goal.coordinate.x&&intent.path.at(-1).to.y===intent.goal.coordinate.y);
    }

    function rememberPlan(entries, modelKey, source) {
      if (typeof modelKey !== "string" || !modelKey || !Array.isArray(entries) || !entries.length
        || !Number.isSafeInteger(source?.nodeCount) || source.nodeCount < 1) throw new Error("ANALYSIS_PLAN_EVIDENCE_INVALID");
      const rows = entries.slice(0, 32).map(entry => {
        const stored = nodes.get(entry.node);
        if (!fork || !stored || !["stable", "decision"].includes(entry.node.status)
          || !entry.node.legalActions.some(action => action.actionId === entry.actionId)
          || !Number.isFinite(entry.value) || entry.preparationDebt!==undefined&&(!Number.isSafeInteger(entry.preparationDebt)||entry.preparationDebt<0) || entry.realization!==undefined&&!Number.isFinite(entry.realization) || !Number.isSafeInteger(entry.distance) || entry.distance < 1
          || !Array.isArray(entry.roots) || entry.roots.length !== entry.node.legalActions.length
          || new Set(entry.roots.map(row => row.actionId)).size !== entry.roots.length
          || entry.node.legalActions.some(action => !entry.roots.some(row => row.actionId === action.actionId))) {
          throw new Error("ANALYSIS_PLAN_EVIDENCE_INVALID");
        }
        if(entry.committedGoal!==undefined&&(typeof entry.committedGoal!=="string"||!entry.committedGoal))throw new Error("ANALYSIS_PLAN_EVIDENCE_INVALID");
        return { key: entry.committedGoal ? policyPhysicalKey(stored) : policyDependencyKey(stored),
          ...(entry.committedGoal?{committedGoal:entry.committedGoal}:{}), actions: actionSetKey(entry.node.legalActions), actionId: entry.actionId,
          ...(!entry.committedGoal&&savedMovementIntent(stored.intent)?{movementIntent:freeze(structuredClone(stored.intent))}:{}),
          value: entry.value, ...(entry.preparationDebt!==undefined?{preparationDebt:entry.preparationDebt}:{}), ...(entry.realization!==undefined?{realization:entry.realization}:{}), distance: entry.distance, sourceNode: entry.sourceNode, roots: freeze(structuredClone(entry.roots)) };
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
      const actions=actionSetKey(node.legalActions);
      let row = saved.rows.find(entry => entry.key === (entry.committedGoal?policyPhysicalKey(stored):policyDependencyKey(stored)) && entry.actions === actions);
      // Between native movement sessions a cold root has no pending session
      // from which to recover the selected route. Restore the saved policy
      // only after exact physical/RNG, menu, turn, position and model matching.
      if(!row&&movementPlanning){
        const state=readPlanningState(stored);
        row=saved.rows.find(entry=>{
          const intent=entry.movementIntent;if(entry.committedGoal||!savedMovementIntent(intent)||entry.actions!==actions
            ||intent.startedRound!==state.turn.roundNumber||intent.startedTurn!==state.turn.turnNumber)return false;
          const ship=state.pieces.rockets.find(r=>r.id===intent.rocketId&&r.playerId===seatId),at=ship&&rockets.getRocketSectorCoordinate(ship);
          const expected=intent.path[0]?.from||intent.goal.coordinate;
          if(!at||at.x!==expected.x||at.y!==expected.y)return false;
          const key=JSON.stringify([policyPhysicalKey(stored),intent]);
          return entry.key===(stored.cardControl?JSON.stringify([key,stored.cardControl]):key);
        });
        if(row){
          stored.intent=freeze(structuredClone(row.movementIntent));stored.policyKey=undefined;
          stored.identity=nodeIdentity(stored.physicalKey,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope));
          movementPolicies.delete(node);movementValueBounds.delete(node);turnTailSpecs.delete(node);turnTailNodes.delete(node);resourceSpecs.delete(node);movementIntentRecoveries++;
          if(!stored.intent.path.length)completedMovementRecoveries++;
        }
      }
      if (!row) return { hit: false, reason: "dependencies-changed" };
      return freeze({ hit: true, actionId: row.actionId, value: row.value, realization: row.realization ?? 0, preparationDebt:row.preparationDebt??0, distance: row.distance, roots: row.roots,
        proof: "seti-complete-window-best-prefix-reuse-v1", evidenceId: saved.evidenceId,
        sourceNode: row.sourceNode, source: saved.source, ...(row.committedGoal?{committedGoal:row.committedGoal}:{}) });
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
          || !Number.isFinite(row.value) || row.preparationDebt!==undefined&&(!Number.isSafeInteger(row.preparationDebt)||row.preparationDebt<0) || row.realization!==undefined&&!Number.isFinite(row.realization) || !Number.isSafeInteger(row.distance) || row.distance < 1 || !Array.isArray(row.roots)
          || row.committedGoal!==undefined&&(typeof row.committedGoal!=="string"||!row.committedGoal)
          || row.movementIntent!==undefined&&!savedMovementIntent(row.movementIntent))) {
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

    const inertReservationsByState=new WeakMap();
    function inertReservationAnswers(state){
      if(!Object.isFrozen(state)||!resourceDemand.immutableCapitalInput(state))return null;
      let answers=inertReservationsByState.get(state);
      if(!answers){answers=[];inertReservationsByState.set(state,answers);}
      return answers;
    }
    function hasTradeInertReservations(state, allowAmiba = false) {
      const answers=inertReservationAnswers(state),key=Number(allowAmiba);
      if(answers?.[key]!==undefined)return answers[key];
      const answer=checkTradeInertReservations(state,allowAmiba);
      if(answers)answers[key]=answer;
      return answer;
    }
    function checkTradeInertReservations(state, allowAmiba) {
      // 交易不推进回合或执行complete_task；任务可就绪，但不能在本队列中兑付。
      // 化石运输会在任意effect后补visitPlanet，不能只检查显式交易事件。
      if (Object.keys(state.aliens.chong?.transportTasksByRocketId || {}).length) return false;
      const fields = ["cardType", "playEffects", "tasks", "temporaryTasks", "triggers", "endGameScoring", "source",
        "reserveAfterPlay", "displayRow", "countsAsType3", "pluto"];
      return state.players.players.every(player => player.reservedCards.every(card => {
        const model = cardEffects.getCardModel(card);
        const knownCard=["basic", "space-agency"].includes(card.set)&&cards.getCatalogEntryForCard(card)
          ||allowAmiba&&card.set==="alien:阿米巴"&&/^amiba_[0-9]\.webp$/.test(card.cardId);
        if (!knownCard || !model
          || ![0, 1, 2, 3].includes(model.cardType) || Object.keys(model).some(key => !fields.includes(key))) return false;
        // 事件只投给交易owner，对手不会在此信息边界前取得行动或任务结算。
        if (player.id !== seatId) return true;
        if (model.triggers && (!Array.isArray(model.triggers) || !model.triggers.every(trigger => {
          const event = trigger.event;
          if (Object.keys(trigger).some(key => !["id", "event", "effect"].includes(key)) || !event
            || Object.keys(event).some(key => !["type", "types", "planetIds", "includePlanetIds", "excludePlanetIds",
              "requiresOwnOrbit", "techType", "color", "cornerKind", "cornerCode", "timing", "price", "cardIds",
              "includeCardIds", "excludeCardIds",...(allowAmiba?["traceType"]:[])].includes(key)) || event.types != null && !Array.isArray(event.types)) return false;
          return (event.types?.length ? event.types : [event.type]).every(type => MONEY_INDEPENDENT_EVENTS.has(type)||allowAmiba&&type==="alienTrace");
        }))) return false;
        const scoring = model.endGameScoring || (allowAmiba&&card.set==="alien:阿米巴"
          ?endScoring.resolveCardEndGameRule(card,cardEffects):null);
        if (model.cardType === 3 && !scoring) return false;
        return !scoring || Object.keys(scoring).every(key => ["kind", "color", "traceType", "techType", "planetId",
          "scorePer", "locationType", "score", "resource", "count"].includes(key))
          && ["sectorWinsByColor", "traceCount", ...(allowAmiba?["amibaTraceCount"]:[]), "techCount", "distinctSignalSectors", "planetOrbitOrLand", "probeLocation",
            "unmarkedFinalRightmost", "remainingResource", "planetLandingPairs", "allOrbitOrLand"].includes(scoring.kind)
          && (scoring.kind !== "remainingResource" || ["availableData", "publicity"].includes(scoring.resource));
      }));
    }

    function hasPostMainInertReservations(state, hasOwnRockets, allowAmiba = false, plainEnd = false, deferredTask = null) {
      const answers=deferredTask?null:inertReservationAnswers(state);
      const key=2+Number(hasOwnRockets)+2*Number(allowAmiba)+4*Number(plainEnd);
      if(answers?.[key]!==undefined)return answers[key];
      const answer=checkPostMainInertReservations(state,hasOwnRockets,allowAmiba,plainEnd,deferredTask);
      if(answers)answers[key]=answer;
      return answer;
    }
    function checkPostMainInertReservations(state, hasOwnRockets, allowAmiba, plainEnd, deferredTask) {
      if (!hasTradeInertReservations(state,allowAmiba)) return false;
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
      if(allowAmiba)unreachableEvents.add("alienTrace");
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
            completedSectorsByColor: ["color", "count"], orbitOrLandCount: ["count"], ...(plainEnd?{probeDistanceFromEarth:["minDistance"]}:{}) }[condition?.type];
          const amount=condition?.type==="probeDistanceFromEarth"?condition.minDistance:condition?.count;
          if (!fields || Object.keys(task).some(key => !["id", "condition", "rewards"].includes(key))
            || Object.keys(condition).some(key => key !== "type" && !fields.includes(key))
            || !Number.isSafeInteger(amount) || amount < 1
            || condition.type === "traceCount" && !["blue", "pink", "yellow"].includes(condition.traceType)) return false;
          return deferredTask?.cardId===card.id&&deferredTask.taskId===task.id
            || card.cardEffectState.completedTaskIds.includes(task.id)
            || !cardEffects.taskConditionMet(task, owner, { data: state.data, aliens: state.aliens, planets:state.planets,
              ...(condition.type==="probeDistanceFromEarth"?{probeLocationDetails:rockets.buildProbeLocationData({...state,state}).details}:{}) });
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
      const state = readPlanningState(stored), owner = state.players.players.find(player => player.id === seatId);
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
      const state = readPlanningState(stored), owner = state.players.players.find(player => player.id === seatId);
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
      const state = readPlanningState(stored), owner = state.players.players.find(player => player.id === seatId);
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
      const state=readPlanningState(stored);
      const owner=state.players.players.find(player=>player.id===seatId),company=industryCatalog.getPlayerIndustryDefinition(owner);
      // A scan can fund the new mission/data continuation. The old linear
      // scan bound did not cover that increase in purpose capital. Final-round
      // deployed missions now stay open regardless of active blue technology.
      if(hasUnprovedProbeCapital(state)&&(state.turn.roundNumber===4||Object.entries(owner.techState.blueBoardSlots).some(([id,slot])=>slot<=2&&owner.techState.ownedTiles[id]&&!owner.techState.disabledTiles[id]
        &&["blue1","blue2","blue4"].includes(id))))return null;
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

    function hasOwnVisitSource(state){
      const owner=state.players.players.find(p=>p.id===seatId);
      return state.pieces.rockets.some(r=>[r.playerId,r.playerColor,r.color].some(id=>id===owner.id||id===owner.color));
    }

    function hasUnprovedProbeCapital(state) {
      const owner=state.players.players.find(p=>p.id===seatId);
      return (state.pieces.rockets||[]).some(r=>r.playerId===owner.id
        &&r.surface==="solar-board"&&(r.kind||"standard")==="standard"&&r.fossilId==null);
    }

    // The quiet contract below changes no probe/planet/scan/tech/known-card
    // facts on native end-turn and forbids round advancement. Income/blue
    // previews include the shared mission delta before this unchanged tail.
    function movementPlanValueBound(node){
      const stored=nodes.get(node);if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||!finalMarkPlanning||node.status!=="stable"||stored.envelope.session)return null;
      if(movementValueBounds.has(node))return movementValueBounds.get(node);
      let bound=null;
      const end=turnTailSummary(node,"end-turn"),state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId),company=industryCatalog.getPlayerIndustryDefinition(owner);
      if(end&&state.turn.roundNumber<=4&&["turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId)
        &&[...owner.hand,...owner.reservedCards].every(c=>knownCards(stored.envelope).has(c.id))){
        const policy=goalMovementSpec(node),action=node.legalActions.find(a=>a.actionId===policy?.selectedActionId);
        if(action?.family==="move"&&policy.intent?.path.length){
          movementBoundQueries++;
          const preview=fundedMovement.quote({state,seatId,intent:policy.intent});movementRuleQueries+=preview.nativeMoveQueries||0;
          if(preview.available)bound=freeze({proof:"seti-fixed-funded-movement-tail-upper-v1",firstActionId:action.actionId,
            valueDelta:preview.netGain,requiredNativeInputs:preview.requiredNativeInputs,movementPlan:policy.plan,
            nativeMovementRuleQueries:preview.nativeMoveQueries,scope:preview.scope,sourceQuietProof:end.proof,
            observationAvailable:false,successorEnvelopeAvailable:false});
        }
      }
      movementValueBounds.set(node,bound);return bound;
    }

    function completedPaidPrefix(state,intent){
      if(!intent||intent.free||intent.prefixOnly||!Array.isArray(intent.path)||intent.path.length
        ||intent.goal?.timing!=="advance-before-rotation"||intent.startedTurn!==state.turn.turnNumber
        ||intent.startedRound!==state.turn.roundNumber)return false;
      const ship=state.pieces.rockets.find(r=>r.id===intent.rocketId);
      if(!ship||ship.playerId!==seatId||ship.surface!=="solar-board"||(ship.kind||"standard")!=="standard"||ship.fossilId!=null)return false;
      const at=rockets.getRocketSectorCoordinate(ship);
      return Boolean(at&&Number.isInteger(at.x)&&Number.isInteger(at.y)&&at.x===intent.goal.coordinate?.x&&at.y===intent.goal.coordinate?.y);
    }

    // Include each acquisition that can become legal after the quoted wallet
    // or hand changes. A newly admitted purpose still needs a Native path.
    function quietTailHasNoAcquisition(current,knownSourceCapital) {
      const player=current.players.players.find(x=>x.id===seatId);
      const actions=["publicity-for-card","cards-for-pick-card","credits-for-card","energy-for-card"].map(id=>quickTrades.getTradeAction(id))
        .filter(t=>players.canAfford(player,t.cost)).map(t=>({family:"quick_trade",actionId:t.id,target:{tradeId:t.id},payload:{cost:t.cost}}));
      if(player.industryRoundMarkRound!==current.turn.roundNumber)actions.push({family:"industry",actionId:"deepspace_swap_cards",target:{abilityId:"deepspace_swap_cards"}});
      return !cardPickPlanner.plan({state:current,seatId,status:"stable",actions,knownSourceCapital})?.goal;
    }

    // A known card pick may finish with one previously held data remaining.
    // Reuse the existing compound currency/income proof for that exact stock.
    // The public refill is always anonymous and cannot create a new purpose.
    function quietBluePublicPick({state,owner,node,stored,plan,transition,deferredTask,firstFamily="place_data",paidDrawCount=null,quoteAfterPick=null,finalRoundQuiet=false}) {
      const hasProbe=hasOwnVisitSource(state);
      const noMovementAllowance=p=>p.resources.energy===0&&p.hand.every(c=>!c.hidden&&!cards.getDiscardActionMoveRewardForCard(c)?.movementPoints);
      const singleIncomeWindow=owner.resources.availableData===2&&data.listComputerPlacedTokens(owner).length===3
        &&(!hasProbe||owner.resources.credits===0&&owner.resources.energy===0);
      if(hasProbe&&(!movementPlanning||!finalRoundQuiet&&!noMovementAllowance(owner)||deferredTask&&!deferredTask.requiresIncome&&!deferredTask.stationaryCapped))return null;
      const stationary=current=>{
        const p=current.players.players.find(q=>q.id===seatId);
        if(noMovementAllowance(p))return true;
        if(!finalRoundQuiet&&!singleIncomeWindow&&paidDrawCount==null)return false;
        const objective=goalMovement.plan({state:current,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          compareTiming:timingForOneGoalQuery(current),endpoints:()=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(current,seatId)?.candidates||[]});
        goalMovementGeometryNodes+=objective?.routingNodes||0;
        return !objective?.intent?.path.length;
      };
      if(stored.intent||stored.resourceControl||state.turn.roundNumber!==(finalRoundQuiet?4:3)||transition.nextPlayerId!==seatId
        ||state.turn.activePlayerIds.some(id=>id!==seatId&&!state.turn.passedPlayerIds.includes(id))
        ||rootPublicLandingOffer
        ||!(finalRoundQuiet?[1,2,3]:[1,2]).includes(owner.resources.availableData)||plan.goal.id!=="data:blue:2"||plan.goal.blueSlot!==2
        ||!data.listComputerPlacedTokens(owner).some(t=>t.placementSlot===data.getRequiredComputerSlotForBlueBonus(2))
        ||!state.cards.publicCards.some(Boolean)||state.cards.publicCards.some(c=>c&&!knownCards(stored.envelope).has(c.id))
        ||!node.legalActions.some(a=>a.family===firstFamily&&a.actionId===plan.firstActionId))return null;
      const p={...owner,resources:{...owner.resources},dataState:structuredClone(owner.dataState),hand:[...owner.hand]};
      const placed=data.placeDataToComputer(p,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:2});
      if(!placed.ok||placed.slotBonuses.length!==1||placed.slotBonuses[0].type!=="choose_card")return null;
      const working={...state,players:{...state.players,players:state.players.players.map(x=>x===owner?p:x)}};
      const actions=scienceSession.formalizeChoices(working,seatId,scienceSession.listPickCardChoices(working));
      const menu=cardPickPlanner.plan({state:working,seatId,status:"decision",actions});
      const choice=actions.find(a=>a.actionId===menu?.selectedActionId),index=choice?.target.publicSlotIndex;
      if(!Number.isInteger(index)||menu.selection.blind)return null;
      const card=state.cards.publicCards[index],drawCount=state.cards.drawPileCardIds.length;
      if(!drawCount||(paidDrawCount==null?cards.getAvailablePool({...state.cards},state.players).length!==drawCount
        :drawCount!==paidDrawCount||state.cards.drawPileCardIds.some(Boolean)))return null;
      p.hand.push({...card,blueBonusOwnerId:seatId});p.resources.handSize=p.hand.length;
      // A retained known data supplier is safe only when the normal
      // completion query below confirms it opens no additional plan.
      if(p.hand.some(c=>c.hidden)||!finalRoundQuiet&&cards.getDiscardActionRewardForCard(card)?.dataCount>0
        ||hasProbe&&!singleIncomeWindow&&!stationary(working))return null;
      const debt=(s,v)=>{const tool=resourceDemand.movementToolPlan(s,v);return tool.value>0?tool.selected.preparationDebt:0;};
      const retainedDataCorner=p.hand.some(c=>cards.getDiscardActionRewardForCard(c)?.dataCount>0);
      const preview={...working,cards:{...state.cards,publicCards:state.cards.publicCards.map((c,i)=>i===index?null:c),
        unknownPublicSlotIndices:[...(state.cards.unknownPublicSlotIndices||[]),index],drawPileCardIds:new Array(drawCount-1).fill(null)}};
      if(deferredTask){
        // The adjacent research/scan quote can only keep original root-hand
        // identities. A known public pick of one of them needs native closure.
        if(rootObservation.selfState.hand.some(c=>c.id===card.id))return null;
        const suffix=current=>localPlans.dataTailCompletion({state:current,seatId,trackPurposeDelta:true,canContinue:quietTailHasNoAcquisition,
          canLeaveProbeStationary:hasProbe?stationary:null});
        const keepTail=suffix(preview),incomePlan=singleIncomeWindow&&keepTail.plans?.length===1&&keepTail.plans[0];
        let paid=preview,paidOwner=p;
        if(!keepTail.available||keepTail.primaryOnly||keepTail.markedTiles.length)return null;
        if(incomePlan?.goal?.kind==="income"&&incomePlan.requiredNativeInputs===3){
          const funding=resourceDemand.previewIncomeTail({state:preview,seatId,goal:incomePlan.goal});
          const source=p.hand.find(c=>c.id===incomePlan.incomeCardId);
          if(!funding.available||!source||funding.player.resources.availableData!==0)return null;
          paidOwner=funding.player;
          paid={...preview,players:{...preview.players,players:preview.players.players.map(v=>v===p?paidOwner:v)},
            cards:{...preview.cards,removedFromGameCardIds:[...preview.cards.removedFromGameCardIds,source.cardId]}};
        }else if(deferredTask.requiresIncome||keepTail.plans.length||keepTail.netGain!==0)return null;
        const claim=localPlans.previewCappedSectorClaim({state:paid,seatId,task:deferredTask,allowPublicityGain:deferredTask.requiresIncome});
        if(!claim)return null;
        // The fixed income is completed before the task becomes the remaining
        // choice. No additional purpose may start after the claim.
        const claimTail=suffix(claim);
        if(!claimTail.available||claimTail.primaryOnly||claimTail.plans.length||claimTail.markedTiles.length||claimTail.netGain!==0)return null;
        const next={...paid,players:{...paid.players,players:paid.players.players.map(v=>v===paidOwner?{...paidOwner,mainActionCompleted:false}:v)}};
        const hold=localPlans.deferredSectorPublicityQuote({state:next,seatId,knownCards:knownRootCardIds});
        if((hold||!deferredTask.requiresIncome)&&(hold?.cardId!==deferredTask.cardId||hold.taskId!==deferredTask.taskId
          ||deferredTask.value!==undefined&&hold.value!==deferredTask.value))return null;
        const settled=claim.players.players.find(v=>v.id===seatId);
        if(hasProbe&&[debt(preview,p),debt(paid,paidOwner),debt(claim,settled)].some(d=>d!==debt(state,owner)))return null;
        const value=(s,v)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
          aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
          getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},v).totalScore;
        const before=resourceDemand.planningCapital(state,owner),afterBlue=resourceDemand.planningCapital(preview,p),
          afterKeep=paid===preview?afterBlue:resourceDemand.planningCapital(paid,paidOwner),afterClaim=resourceDemand.planningCapital(claim,settled);
        const keepCapital=stateValue.sumValueParts([afterKeep,-before]),claimCapital=stateValue.sumValueParts([afterClaim,-before]);
        const resources=stateValue.DEFAULT_WEIGHTS.handSize-stateValue.DEFAULT_WEIGHTS.availableData;
        const keep=stateValue.sumValueParts([resources,afterBlue,-before,keepTail.netGain]);
        const publicity=(settled.resources.publicity-paidOwner.resources.publicity)*stateValue.DEFAULT_WEIGHTS.publicity;
        const taken=stateValue.sumValueParts([keep,afterClaim,-afterKeep,value(claim,settled),-value(paid,paidOwner),publicity]);
        // The deferred publicity belongs to the same root-scoped valuation
        // used for a materialized end/skip leaf. Nothing was awarded at cap.
        const deferredValue=hold&&deferredSectorPublicityEnabled()?hold.value:0;
        const keepRanking=stateValue.sumValueParts([keep,deferredValue]);
        const takeNow=taken>keepRanking||taken===keepRanking&&claimCapital<=keepCapital;
        const requiredNativeInputs=3+keepTail.requiredNativeInputs+1;
        const bluePublicPick={cardId:card.id,cardActionId:choice.actionId,publicSlotIndex:index,
          ordinaryDrawCountBefore:drawCount,ordinaryDrawCountAfter:drawCount-1,
          ...(paid!==preview?{singleCurrencyIncome:true,continuingDataPlans:keepTail.plans}:{}),
          taskChoice:{id:deferredTask.cardId,ruleId:deferredTask.taskId,selected:takeNow?"claim":"defer",
            claim:{netGain:taken,unrealizedPurposeDelta:claimCapital,requiredNativeInputs},
            defer:{netGain:keep,unrealizedPurposeDelta:keepCapital,forecast:deferredValue,requiredNativeInputs}}};
        return {firstActionId:plan.firstActionId,netGain:takeNow?taken:keep,requiredNativeInputs,markedTiles:[],
          unrealizedPurposeDelta:takeNow?claimCapital:keepCapital,bluePublicPick,...(!takeNow&&hold?{deferredPublicity:hold}:{})};
      }
      const before=resourceDemand.planningCapital(state,owner),after=resourceDemand.planningCapital(preview,p);
      const capital=stateValue.sumValueParts([after,-before]);
      let completion;
      if(p.resources.availableData===0&&!retainedDataCorner){
        if(!quietTailHasNoAcquisition(preview,after))return null;
        completion=localPlans.quietEndCompletion({state:preview,seatId});
      }else{
        completion=localPlans.dataTailCompletion({state:preview,seatId,trackPurposeDelta:true,canContinue:quietTailHasNoAcquisition,
          fixedDataOrdering:finalRoundQuiet,exactFixedBlueTie:finalRoundQuiet,stationaryFinalData:finalRoundQuiet&&!hasProbe,
          canLeaveProbeStationary:current=>hasProbe&&stationary(current)});
      }
      const nextPlan=completion.plans?.length===1&&completion.plans[0];
      const singleIncome=Boolean(singleIncomeWindow&&nextPlan?.goal?.kind==="income"&&nextPlan.requiredNativeInputs===3);
      if(!completion.available||completion.primaryOnly||completion.markedTiles.length
        ||!finalRoundQuiet&&retainedDataCorner&&completion.plans?.length&&!singleIncome)return null;
      if(hasProbe){
        if(!finalRoundQuiet&&completion.plans?.length&&!singleIncome||!completion.plans?.length&&!stationary(preview))return null;
        const beforeDebt=debt(state,owner);
        if(beforeDebt!==debt(preview,p))return null;
        if(singleIncome){
          const tail=resourceDemand.previewIncomeTail({state:preview,seatId,goal:nextPlan.goal});
          if(!tail.available||tail.player.resources.availableData!==0||beforeDebt!==debt(preview,tail.player))return null;
        }
      }
      const nextFundedScan=quoteAfterPick&&!completion.plans?.length&&quoteAfterPick(preview,card);
      return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([stateValue.DEFAULT_WEIGHTS.handSize,
        -stateValue.DEFAULT_WEIGHTS.availableData,capital,completion.netGain]),requiredNativeInputs:3+completion.requiredNativeInputs,markedTiles:[],
        ...(nextFundedScan?{nextFundedScan}:{}),
        unrealizedPurposeDelta:stateValue.sumValueParts([capital,completion.purposeDelta]),bluePublicPick:{cardId:card.id,cardActionId:choice.actionId,publicSlotIndex:index,
          ordinaryDrawCountBefore:drawCount,ordinaryDrawCountAfter:drawCount-1,...(hasProbe?{stationaryProbe:true}:{}),...(singleIncome?{singleCurrencyIncome:true}:{}),
          ...(completion.plans?.length?{continuingDataPlans:completion.plans}:{})}};
    }

    // Same fixed blue goal, but its public pick sits behind funded computer
    // prerequisites. Price only pure known corners and score/publicity slots;
    // the shared pick proof still owns the refill and the remainder of the turn.
    function quietR4FundedPublicBlue({state,owner,node,stored,plan,transition}){
      const slots=data.listComputerPlacedTokens(owner).map(t=>t.placementSlot).sort((a,b)=>a-b);
      const target=data.getRequiredComputerSlotForBlueBonus(2),count=target-slots.length;
      const need=count+1-owner.resources.availableData,hasProbe=hasOwnVisitSource(state);
      if(plan.goal.id!=="data:blue:2"||plan.goal.targetComputerSlot!==target||target>=4||count<1
        ||need<1||need>3||count+1>players.RESOURCE_LIMITS.availableData||hasProbe&&!movementPlanning
        ||slots.some((slot,i)=>slot!==i+1)||owner.resources.availableData!==owner.dataState.poolTokens.length)return null;
      const stationary=current=>{
        if(!hasProbe)return true;
        const objective=goalMovement.plan({state:current,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          compareTiming:timingForOneGoalQuery(current),endpoints:()=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(current,seatId)?.candidates||[]});
        goalMovementGeometryNodes+=objective?.routingNodes||0;
        return !objective?.intent?.path.length;
      };
      if(!stationary(state))return null;
      if(owner.resources.availableData>0&&!node.legalActions.some(a=>a.family==="place_data"))return null;
      const p={...owner,resources:{...owner.resources},hand:[...owner.hand],dataState:structuredClone(owner.dataState)};
      const meta=structuredClone(state.meta),discardPile=[...state.cards.discardPile],cornerIds=[];
      const prepared={...state,meta,players:{...state.players,players:state.players.players.map(q=>q===owner?p:q)},
        cards:{...state.cards,discardPile}};
      for(let i=0;i<need;i++){
        const actions=node.legalActions.filter(a=>a.family!=="card_corner"||p.hand.some(c=>c.id===a.target?.cardInstanceId));
        const step=resourceDemand.preparations({state:prepared,seatId,goal:plan.goal,actions,selectionOnly:true}).find(c=>!c.observer);
        const corner=actions.find(a=>a.actionId===step?.actionId&&a.family==="card_corner"&&a.payload?.kind==="resource");
        const card=corner&&p.hand.find(c=>c.id===corner.target.cardInstanceId),reward=card&&cards.getDiscardActionRewardForCard(card);
        if(!card||i===0&&corner.actionId!==plan.firstActionId||!knownCards(stored.envelope).has(card.id)
          ||(corner.payload.multiplier??1)!==1||reward?.dataCount!==1||Object.keys(reward.gain||{}).length)return null;
        p.hand=p.hand.filter(c=>c!==card);p.resources.handSize=p.hand.length;
        if(!data.gainData(p,{root:{meta}}).ok)return null;
        discardPile.push(card);cornerIds.push(card.id);
        if(!quietTailHasNoAcquisition(prepared)||!stationary(prepared))return null;
      }
      for(let i=0;i<count;i++){
        const r=data.placeDataToComputer(p);
        if(!r.ok||r.placementSlot!==slots.length+i+1)return null;
        for(const reward of r.slotBonuses||[]){
          if(!["score","publicity"].includes(reward.type))return null;
          players.gainResources(p,{[reward.type]:reward[reward.type]});
        }
        if(!quietTailHasNoAcquisition(prepared)||!stationary(prepared))return null;
      }
      const pick=quietBluePublicPick({state:prepared,owner:p,node,stored,plan,transition,firstFamily:"card_corner",finalRoundQuiet:true});
      if(!pick)return null;
      const final=(s,q)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
        aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},q).totalScore;
      const capital=stateValue.sumValueParts([resourceDemand.planningCapital(prepared,p),-resourceDemand.planningCapital(state,owner)]);
      const resource=Object.entries(stateValue.DEFAULT_WEIGHTS).reduce((sum,[k,w])=>sum+w*((p.resources[k]||0)-(owner.resources[k]||0)),0);
      const bluePublicPick={...pick.bluePublicPick,fundedComputerPrefix:{cornerIds,placements:count}};
      return {...pick,netGain:stateValue.sumValueParts([pick.netGain,capital,final(prepared,p),-final(state,owner),resource]),
        requiredNativeInputs:cornerIds.length+2*count+pick.requiredNativeInputs,
        unrealizedPurposeDelta:stateValue.sumValueParts([pick.unrealizedPurposeDelta,capital]),
        exactFixedBlueTie:true,bluePublicPick,dataPlans:[{goal:plan.goal,bluePublicPick}]};
    }

    function quietScoredCornerThenBluePick({state,owner,node,stored,plan,transition,quoteAfterPick=null}){
      if(owner.resources.availableData!==0||hasOwnVisitSource(state)
        ||owner.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount>0).length!==1)return null;
      const action=node.legalActions.find(a=>a.actionId===plan.firstActionId&&a.family==="card_corner"&&a.payload?.kind==="resource"
        &&(a.payload.multiplier??1)===1);
      if(!action)return null;
      const prepared=localPlans.previewScoredAmibaDataCorner({state,seatId,cardId:action.target.cardInstanceId});
      if(!prepared||!quietTailHasNoAcquisition(prepared))return null;
      const p=prepared.players.players.find(v=>v.id===seatId);
      if(p.resources.availableData!==1||localPlans.quietEndCompletion({state:prepared,seatId}).markedTiles?.length!==0)return null;
      const pick=quietBluePublicPick({state:prepared,owner:p,node,stored,plan,transition,firstFamily:"card_corner",quoteAfterPick});
      if(!pick||pick.bluePublicPick.continuingDataPlans)return null;
      const value=(s,v)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
        aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},v).totalScore;
      const delta=stateValue.sumValueParts([resourceDemand.planningCapital(prepared,p),-resourceDemand.planningCapital(state,owner)]);
      return {...pick,netGain:stateValue.sumValueParts([pick.netGain,delta,value(prepared,p),-value(state,owner),
        stateValue.DEFAULT_WEIGHTS.availableData,-stateValue.DEFAULT_WEIGHTS.handSize]),requiredNativeInputs:1+pick.requiredNativeInputs,
        unrealizedPurposeDelta:stateValue.sumValueParts([pick.unrealizedPurposeDelta,delta]),
        bluePublicPick:{...pick.bluePublicPick,scoredFundingCornerId:action.target.cardInstanceId}};
    }

    // The exact scored corner is already the fixed funding input for this
    // blue slot. There is no public draw or other purpose after its currency.
    function quietScoredCornerThenBlueCurrency({state,owner,node,stored,plan,transition}){
      const hasProbe=hasOwnVisitSource(state);
      if(stored.intent||stored.resourceControl||hasProbe&&!movementPlanning||rootPublicLandingOffer
        ||state.turn.roundNumber!==3||transition.nextPlayerId!==seatId
        ||state.turn.activePlayerIds.some(id=>id!==seatId&&!state.turn.passedPlayerIds.includes(id))
        ||plan.goal.id!=="data:blue:1"||owner.resources.availableData!==0
        ||owner.hand.filter(c=>cards.getDiscardActionRewardForCard(c)?.dataCount>0).length!==1)return null;
      const action=node.legalActions.find(a=>a.actionId===plan.firstActionId&&a.family==="card_corner"
        &&a.payload?.kind==="resource"&&(a.payload.multiplier??1)===1);
      const funded=action&&localPlans.previewScoredAmibaDataCorner({state,seatId,cardId:action.target.cardInstanceId});
      if(!funded||!quietTailHasNoAcquisition(funded))return null;
      const debt=(current,p)=>{const tool=resourceDemand.movementToolPlan(current,p);return tool.value>0?tool.selected.preparationDebt:0;};
      const beforeDebt=hasProbe?debt(state,owner):0;
      const stationary=current=>{
        if(!hasProbe)return true;
        if(debt(current,current.players.players.find(v=>v.id===seatId))!==beforeDebt)return false;
        const objective=goalMovement.plan({state:current,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          compareTiming:timingForOneGoalQuery(current),endpoints:()=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(current,seatId)?.candidates||[]});
        goalMovementGeometryNodes+=objective?.routingNodes||0;
        return !objective?.intent?.path.length;
      };
      if(!stationary(state)||!stationary(funded))return null;
      const p=funded.players.players.find(v=>v.id===seatId),blue=localPlans.previewBlueCompletion({state:funded,seatId,goal:plan.goal});
      if(!blue.available||blue.computerPlacements||blue.dataCornerId||blue.incomeCardId||blue.player.resources.availableData!==0)return null;
      const after={...funded,players:{...funded.players,players:funded.players.players.map(v=>v===p?blue.player:v)}};
      const end=localPlans.dataTailCompletion({state:after,seatId,trackPurposeDelta:true,canContinue:quietTailHasNoAcquisition,canLeaveProbeStationary:stationary});
      if(!end.available||end.primaryOnly||end.plans?.length||end.markedTiles.length||end.netGain!==0)return null;
      const total=(s,v)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
        aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},v).totalScore;
      const beforeCapital=resourceDemand.planningCapital(state,owner);
      const cornerCapital=resourceDemand.planningCapital(funded,p);
      const purposeDelta=stateValue.sumValueParts([resourceDemand.planningCapital(after,blue.player),-beforeCapital]);
      return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([blue.netGain,total(funded,p),-total(state,owner),
        stateValue.DEFAULT_WEIGHTS.availableData,-stateValue.DEFAULT_WEIGHTS.handSize,cornerCapital,-beforeCapital]),
        requiredNativeInputs:1+blue.requiredNativeInputs+end.requiredNativeInputs,markedTiles:[],
        unrealizedPurposeDelta:purposeDelta,scoredCornerBlueCurrency:{cardId:action.target.cardInstanceId,blueSlot:1}};
    }

    function quietCappedTaskBlueCurrency({state,owner,node,stored,plan,transition,deferredTask}) {
      if(stored.intent||stored.resourceControl||hasOwnVisitSource(state)||plan.goal.id!=="data:blue:1"
        ||!deferredTask||transition.nextPlayerId!==seatId||owner.resources.availableData<1)return null;
      const blue=localPlans.previewBlueCompletion({state,seatId,goal:plan.goal});
      if(!blue.available||blue.computerPlacements!==0||blue.dataCornerId||blue.incomeCardId
        ||blue.player.resources.publicity!==owner.resources.publicity)return null;
      const p=blue.player,charged={...state,players:{...state.players,players:state.players.players.map(v=>v===owner?p:v)}};
      if(!quietTailHasNoAcquisition(charged,blue.capital.afterCapital))return null;
      const end=localPlans.quietEndCompletion({state:charged,seatId});
      if(!end.available||end.netGain!==0||end.markedTiles.length)return null;
      const next=resourceDemand.catalog({state:charged,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(p)}});
      let pick=null;
      if(next.length===1&&next[0].id==="data:blue:2"){
        pick=quietBluePublicPick({state:charged,owner:p,node,stored,plan:{goal:next[0],firstActionId:plan.firstActionId},transition,deferredTask});
        if(!pick?.deferredPublicity||pick.bluePublicPick.taskChoice?.selected!=="defer"
          ||pick.deferredPublicity.value!==deferredTask.value)return null;
      }else if(next.length)return null;
      const take=pick&&(pick.netGain>0||pick.netGain===0&&pick.unrealizedPurposeDelta<0);
      return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([blue.netGain,take?pick.netGain:0]),
        requiredNativeInputs:blue.requiredNativeInputs+(take?pick.requiredNativeInputs:2),markedTiles:[],
        unrealizedPurposeDelta:stateValue.sumValueParts([blue.capital.afterCapital,-blue.capital.beforeCapital,take?pick.unrealizedPurposeDelta:0]),
        deferredPublicity:deferredTask,cappedTaskBlueCurrency:{blueInputs:blue.requiredNativeInputs,
          selected:take?"public-pick":"end",pick:pick?.bluePublicPick||null}};
    }

    function quietComputerThenKnownBluePick({state,owner,node,stored,plan,transition}) {
      if(stored.resourceControl||plan.goal.id!=="data:computer-prefix:3"
        ||!node.legalActions.some(a=>a.family==="place_data"&&a.actionId===plan.firstActionId))return null;
      const computer=localPlans.previewComputerCompletion({state,seatId,goal:plan.goal});
      if(!computer.available||!computer.selected)return null;
      const p=computer.player,ready={...state,players:{...state.players,players:state.players.players.map(q=>q===owner?p:q)}};
      const actions=node.legalActions;
      if(p.resources.availableData!==1||actions.some(a=>a.family!=="place_data"&&a.family!=="end_turn"
        &&!(a.family==="quick_trade"&&a.target.tradeId==="publicity-for-card")))return null;
      const goals=resourceDemand.catalog({state:ready,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(p)}});
      if(goals.length!==1||goals[0].id!=="data:blue:2")return null;
      const end=localPlans.quietEndCompletion({state:ready,seatId});
      const pick=quietBluePublicPick({state:ready,owner:p,node,stored,plan:{goal:goals[0],firstActionId:plan.firstActionId},transition});
      if(!end.available||end.netGain!==0||end.markedTiles.length||!pick||pick.bluePublicPick.continuingDataPlans)return null;
      const market=cardPickPlanner.plan({state:ready,seatId,status:"stable",actions});
      const paid=market?.goal&&quietPaidIncomeTail(node,stored,ready,market);
      if(market?.goal&&!paid)return null;
      const variants=[{...end,id:"end",unrealizedPurposeDelta:0},{...pick,id:"blue"},...(paid?[{...paid,id:"paid"}]:[])];
      variants.sort((a,b)=>b.netGain-a.netGain||a.unrealizedPurposeDelta-b.unrealizedPurposeDelta||a.requiredNativeInputs-b.requiredNativeInputs);
      const selected=variants[0],next=variants[1];
      if(selected.netGain===next.netGain&&selected.unrealizedPurposeDelta===next.unrealizedPurposeDelta
        &&selected.requiredNativeInputs===next.requiredNativeInputs)return null;
      const delta=stateValue.sumValueParts([computer.capital.afterCapital,-computer.capital.beforeCapital]);
      return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([computer.netGain,selected.netGain]),
        requiredNativeInputs:computer.requiredNativeInputs+selected.requiredNativeInputs,markedTiles:[],
        unrealizedPurposeDelta:stateValue.sumValueParts([delta,selected.unrealizedPurposeDelta??0]),
        computerThenKnownBluePick:{placements:computer.placements,selected:selected.id,variants}};
    }

    function quietFixedIncomeTail({state,owner,node,stored,plan,policy,transition}) {
      const liveProbe=hasOwnVisitSource(state);
      if(stored.intent||stored.resourceControl||rootPublicLandingOffer
        ||liveProbe&&(owner.resources.credits!==0||owner.resources.energy!==0
          ||owner.hand.some(c=>c.hidden||cards.getDiscardActionMoveRewardForCard(c)?.movementPoints)
          ||node.legalActions.some(goalMovement.isDirection))
        ||state.turn.roundNumber!==3||transition.nextPlayerId!==seatId
        ||state.turn.activePlayerIds.some(id=>id!==seatId&&!state.turn.passedPlayerIds.includes(id))
        ||plan.goal.kind!=="income"||!policy.incomeTail?.selected)return null;
      const card=owner.hand.find(c=>c.id===plan.goal.incomeCardId),gain=card&&cards.getIncomeGainForCard(card);
      if(!gain||Object.keys(gain).length!==1||!["credits","energy"].some(k=>gain[k]===1))return null;
      const income=resourceDemand.previewIncomeTail({state,seatId,goal:plan.goal});
      if(!income.available||income.placements<1||income.placements>4||income.player.resources.availableData>2)return null;
      const p=income.player,projected={...state,players:{...state.players,players:state.players.players.map(q=>q===owner?p:q)},
        cards:{...state.cards,removedFromGameCardIds:[...state.cards.removedFromGameCardIds,card.cardId]}};
      const end=localPlans.quietEndCompletion({state:projected,seatId});
      if(!end.available||end.markedTiles.length||end.netGain!==0)return null;
      if(!quietTailHasNoAcquisition(projected))return null;
      const goals=resourceDemand.catalog({state:projected,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(p)}});
      if(!goals.length&&(p.resources.availableData===0||liveProbe)){
        if(liveProbe){
          const native=productionKernel||globalThis.SetiProductionKernel;
          const route=goalMovement.plan({state:projected,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
            compareTiming:timingForOneGoalQuery(projected),endpoints:()=>native.getProbeRouteRequirements(projected,seatId)?.candidates||[]});
          goalMovementGeometryNodes+=route?.routingNodes||0;
          const debt=(s,p)=>{const m=resourceDemand.movementToolPlan(s,p);return m.value>0?m.selected.preparationDebt:0;};
          if(route?.intent?.path.length||debt(projected,p)!==debt(state,owner))return null;
        }
        const inputs=2*income.placements+1;
        return {firstActionId:plan.firstActionId,netGain:policy.incomeTail.netGain,requiredNativeInputs:inputs+1,markedTiles:[],
          unrealizedPurposeDelta:stateValue.sumValueParts([resourceDemand.planningCapital(projected,p),-resourceDemand.planningCapital(state,owner)]),
          incomeThenQuietEnd:{incomeCardId:card.id,placements:income.placements,requiredIncomeInputs:inputs,gain}};
      }
      if(liveProbe)return null;
      if(p.resources.availableData===1&&goals.length===1&&goals[0].id==="data:blue:1"){
        const blue=localPlans.previewBlueCompletion({state:projected,seatId,goal:goals[0]});
        if(!blue.available||!blue.selected||blue.computerPlacements!==0||blue.dataCornerId||blue.incomeCardId)return null;
        const q=blue.player,charged={...projected,players:{...projected.players,players:projected.players.players.map(v=>v===p?q:v)}};
        if(q.resources.availableData!==0||!quietTailHasNoAcquisition(charged))return null;
        const end=localPlans.quietEndCompletion({state:charged,seatId});
        if(!end.available||end.netGain!==0||end.markedTiles.length)return null;
        const next=resourceDemand.catalog({state:charged,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(q)}});
        const opportunity=quoteDataFundedScan(node,stored,charged,q);
        let pick=null;
        if(next.length===1&&next[0].id==="data:blue:2"){
          const candidates=resourceDemand.preparations({state:charged,seatId,goal:next[0],actions:node.legalActions});
          const first=candidates[0];
          if(!first||first.observer)return null;
          const quoteAfterPick=opportunity?(preview,card)=>{
            if(card.id===opportunity.publicCardId)return null;
            const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
            const scan=localPlans.quoteFundedSector({state:preview,seatId,knownCards:knownRootCardIds,knownAlienDisplay});
            return scan?.publicCardId===opportunity.publicCardId&&scan.sectorId===opportunity.sectorId?scan:null;
          }:null;
          pick=quietScoredCornerThenBluePick({state:charged,owner:q,node,stored,plan:{goal:next[0],firstActionId:first.actionId},transition,quoteAfterPick});
          if(!pick)return null;
        }else if(next.length)return null;
        const pickValue=pick&&stateValue.sumValueParts([pick.netGain,pick.nextFundedScan?.value||0]);
        const take=pick&&(opportunity?.value<pickValue||!opportunity&&(pickValue>0||pickValue===0&&pick.unrealizedPurposeDelta<0));
        const chosenScan=take?pick.nextFundedScan:opportunity;
        const capital=stateValue.sumValueParts([resourceDemand.planningCapital(charged,q),-resourceDemand.planningCapital(state,owner)]);
        const incomeInputs=2*income.placements+1;
        return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([policy.incomeTail.netGain,blue.netGain,take?pick.netGain:0]),
          requiredNativeInputs:incomeInputs+blue.requiredNativeInputs+(take?pick.requiredNativeInputs:1),markedTiles:[],
          unrealizedPurposeDelta:stateValue.sumValueParts([capital,take?pick.unrealizedPurposeDelta:0]),
          incomeThenBlueCurrency:{incomeCardId:card.id,incomeInputs,blueSlot:1,blueInputs:blue.requiredNativeInputs,
            selected:take?"public-pick":"end",pick:pick?.bluePublicPick||null},
          ...(chosenScan?{nextFundedScan:chosenScan}:{})};
      }
      if(income.placements!==1||![1,2].includes(p.resources.availableData)||goals.length!==1||goals[0].id!=="data:blue:2")return null;
      const pick=quietBluePublicPick({state:projected,owner:p,node,stored,plan:{goal:goals[0],firstActionId:plan.firstActionId},transition});
      if(!pick||pick.bluePublicPick.continuingDataPlans||rootObservation.selfState.hand.some(c=>c.id===pick.bluePublicPick.cardId))return null;
      const capital=stateValue.sumValueParts([resourceDemand.planningCapital(projected,p),-resourceDemand.planningCapital(state,owner)]);
      const take=pick.netGain>0||pick.netGain===0&&pick.unrealizedPurposeDelta<0;
      return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([policy.incomeTail.netGain,take?pick.netGain:0]),
        requiredNativeInputs:3+(take?pick.requiredNativeInputs:1),markedTiles:[],
        unrealizedPurposeDelta:stateValue.sumValueParts([capital,take?pick.unrealizedPurposeDelta:0]),
        incomeThenKnownBlue:{incomeCardId:card.id,gain,requiredIncomeInputs:3,take,
          alternatives:{end:{netGain:0,requiredNativeInputs:1},blue:{netGain:pick.netGain,
            unrealizedPurposeDelta:pick.unrealizedPurposeDelta,requiredNativeInputs:pick.requiredNativeInputs,
            card:pick.bluePublicPick}}}};
    }

    function quoteDataFundedScan(node,stored,charged,owner){
      if(stored.informationBarrier?.code!=='tech_bonus_reveal'||owner.hand.length!==3
        ||openedRoot?.observation.publicState.roundNumber!==3)return null;
      const base=nodes.get(openedRoot),session=base?.envelope.session?.session;
      const state=session?.journal?.actions?.[0]?.action?.family==='research_tech'&&session.baseState
        ?planningState(session.baseState,base.informationBarrier,knownRootCardIds)
        :openedRoot.status==='stable'&&!session?readPlanningState(base):null;
      if(!state)return null;
      const p=state.players.players.find(q=>q.id===seatId),cost=scanEffects.getStandardScanCost(p);
      if(p.mainActionCompleted||p.resources.credits!==cost.credits-1||p.resources.energy!==cost.energy-1
        ||p.hand.length!==owner.hand.length+1||p.hand.some(c=>!knownRootCardIds.has(c.id))
        ||p.income.credits+1!==owner.income.credits||!owner.hand.every(c=>p.hand.some(h=>h.id===c.id)))return null;
      const slots=data.listComputerPlacedTokens(p).map(x=>x.placementSlot),missing=4-slots.length+1-p.resources.availableData;
      if(missing<=0||slots.some((s,i)=>s!==i+1))return null;
      const researched=Object.keys(owner.techState.ownedTiles).filter(id=>!p.techState.ownedTiles[id]);
      if(researched.length!==1||scienceSession.getResearchDataCount(researched[0])!==missing)return null;
      const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
      return localPlans.quoteFundedSector({state:charged,seatId,knownCards:knownRootCardIds,knownAlienDisplay});
    }

    function paidIncomeWithReadyTask({node,stored,bought,q,transition,deferredTask,drawCount}){
      const blueGoal={id:"data:blue:2",kind:"blue-data",blueSlot:2,targetComputerSlot:3,required:{}};
      const start=node.legalActions.find(a=>a.family==="place_data");
      if(!start||!data.listBluePlacementRequirements(q).some(x=>x.blueSlot===2))return null;
      const plans={goal:blueGoal,firstActionId:start.actionId};
      const claim=localPlans.previewCappedSectorClaim({state:bought,seatId,task:deferredTask,allowPublicityGain:true});
      if(!claim)return null;
      const settled=claim.players.players.find(v=>v.id===seatId);
      const paidCapital=resourceDemand.planningCapital(bought,q),settledCapital=resourceDemand.planningCapital(claim,settled);
      if(!quietTailHasNoAcquisition(claim,settledCapital))return null;
      const end=localPlans.quietEndCompletion({state:claim,seatId});
      if(!end.available||end.netGain!==0||end.markedTiles.length)return null;
      const blueAfterClaim=quietBluePublicPick({state:claim,owner:settled,node,stored,plan:plans,transition,paidDrawCount:drawCount-1});
      const blueBeforeClaim=quietBluePublicPick({state:bought,owner:q,node,stored,plan:plans,transition,paidDrawCount:drawCount-1,
        deferredTask:{cardId:deferredTask.cardId,taskId:deferredTask.taskId,requiresIncome:true}});
      if(!blueAfterClaim?.bluePublicPick.singleCurrencyIncome||!blueBeforeClaim?.bluePublicPick.singleCurrencyIncome
        ||blueBeforeClaim.bluePublicPick.taskChoice?.selected!=="claim"||blueBeforeClaim.deferredPublicity)return null;
      const value=(s,v)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
        aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},v).totalScore;
      const delta=stateValue.sumValueParts([settledCapital,-paidCapital]);
      const task=stateValue.sumValueParts([delta,value(claim,settled),-value(bought,q),
        (settled.resources.publicity-q.resources.publicity)*stateValue.DEFAULT_WEIGHTS.publicity]);
      const rows=[
        {id:"end-skip",netGain:0,unrealizedPurposeDelta:0,requiredNativeInputs:2},
        {id:"claim-end",netGain:task,unrealizedPurposeDelta:delta,requiredNativeInputs:2},
        {id:"claim-blue",netGain:stateValue.sumValueParts([task,blueAfterClaim.netGain]),
          unrealizedPurposeDelta:stateValue.sumValueParts([delta,blueAfterClaim.unrealizedPurposeDelta]),
          requiredNativeInputs:1+blueAfterClaim.requiredNativeInputs,blue:blueAfterClaim.bluePublicPick},
        {id:"blue-claim",netGain:blueBeforeClaim.netGain,unrealizedPurposeDelta:blueBeforeClaim.unrealizedPurposeDelta,
          requiredNativeInputs:blueBeforeClaim.requiredNativeInputs,blue:blueBeforeClaim.bluePublicPick},
      ];
      rows.sort((a,b)=>b.netGain-a.netGain||a.unrealizedPurposeDelta-b.unrealizedPurposeDelta||a.requiredNativeInputs-b.requiredNativeInputs
        ||(a.id==="claim-blue"?-1:b.id==="claim-blue"?1:a.id.localeCompare(b.id)));
      return {...rows[0],task:{cardId:deferredTask.cardId,ruleId:deferredTask.taskId},alternatives:rows};
    }

    function quietPaidIncomeTail(node,stored,state,market=cardPickSpec(node)){
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      const deferredTask=p.resources.availableData===2?cappedSectorTaskToKeep(state,p,node):null;
      if(!p.mainActionCompleted||p.passCompletionPending||p.hand.length||p.resources.availableData!==(deferredTask?2:1)
        ||p.resources.availableData!==p.dataState.poolTokens.length||stored.intent||stored.resourceControl
        ||rootPublicLandingOffer||t.roundNumber!==3||t.currentPlayerId!==seatId||t.cardTurnEventBonuses?.length
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId!=="deepspace_swap_cards"
        ||Object.values(state.aliens.aliens).some(s=>s.revealed&&s.alienId!=="阿米巴"||alienState.isAlienReadyToReveal(s))
        ||!node.legalActions.some(a=>a.family==="end_turn")||node.legalActions.some(a=>a.family==="complete_task"&&!deferredTask||goalMovement.isDirection(a))
        ||!hasPostMainInertReservations(state,false,true,true,deferredTask)
        ||market?.goal?.id!=="income:computer:4"||market.selection?.blind||market.discardIds?.length)return null;
      const action=node.legalActions.find(a=>a.actionId===market.selectedActionId&&a.family==="quick_trade"&&a.target.tradeId==="publicity-for-card");
      if(!action)return null;
      const card=state.cards.publicCards.find(c=>c?.id===market.selection.cardId),known=knownCards(stored.envelope);
      if(!card||!known.has(card.id)||p.reservedCards.some(c=>!known.has(c.id))
        ||cards.getDiscardActionRewardForCard(card)?.dataCount||cards.getDiscardActionMoveRewardForCard(card)?.movementPoints)return null;
      const income=cards.getIncomeGainForCard(card);
      if(!income||Object.keys(income).length!==1||![income.credits,income.energy].includes(1))return null;
      const slots=data.listComputerPlacedTokens(p);
      if(slots.length!==3||slots.some((x,i)=>x.placementSlot!==i+1))return null;
      const drawCount=state.cards.drawPileCardIds.length,index=state.cards.publicCards.indexOf(card);
      if(!drawCount||cards.getAvailablePool({...state.cards},state.players).length!==drawCount)return null;
      const q={...p,resources:{...p.resources},hand:[card]};
      if(!players.spendResources(q,quickTrades.getTradeAction("publicity-for-card").cost).ok)return null;
      q.resources.handSize=1;
      const bought={...state,players:{...state.players,players:state.players.players.map(v=>v===p?q:v)},
        cards:{...state.cards,publicCards:state.cards.publicCards.map((c,i)=>i===index?null:c),
          unknownPublicSlotIndices:[...(state.cards.unknownPublicSlotIndices||[]),index],drawPileCardIds:new Array(drawCount-1).fill(null)}};
      const transition=previewTurn(state);
      if(!transition.turnAdvanced||transition.roundAdvanced||transition.gameEnded||transition.nextPlayerId!==seatId)return null;
      const after=resourceDemand.planningCapital(bought,q),before=resourceDemand.planningCapital(state,p);
      if(!quietTailHasNoAcquisition(bought,after))return null;
      const end=localPlans.quietEndCompletion({state:bought,seatId});
      if(!end.available||end.netGain!==0||end.markedTiles.length)return null;
      const incomeGoal={id:"data:income:4",kind:"income",incomeCardId:card.id,targetComputerSlot:4,required:{}};
      const incomeTail=localPlans.incomeCompletion({state:bought,seatId,goal:incomeGoal});
      if(!incomeTail.available&&incomeTail.reason||incomeTail.selected)return null;
      const purchaseValue=stateValue.sumValueParts([stateValue.DEFAULT_WEIGHTS.handSize,
        (q.resources.publicity-p.resources.publicity)*stateValue.DEFAULT_WEIGHTS.publicity]);
      const purchaseCapital=stateValue.sumValueParts([after,-before]);
      if(deferredTask){
        if(deferredTask.gain!==p.resources.publicity-q.resources.publicity)return null;
        const follow=paidIncomeWithReadyTask({node,stored,bought,q,transition,deferredTask,drawCount});
        if(!follow)return null;
        return {firstActionId:action.actionId,netGain:stateValue.sumValueParts([purchaseValue,purchaseCapital,follow.netGain]),
          requiredNativeInputs:2+follow.requiredNativeInputs,markedTiles:[],
          unrealizedPurposeDelta:stateValue.sumValueParts([purchaseCapital,follow.unrealizedPurposeDelta]),
          paidPublicIncome:{cardId:card.id,index,selected:follow.id,incomeNet:incomeTail.netGain,
            endDelta:purchaseValue+purchaseCapital,follow}};
      }
      const goals=resourceDemand.catalog({state:bought,seatId,requirements:{bluePlacements:data.listBluePlacementRequirements(q)}})
        .filter(g=>g.kind!=="income"||g.incomeCardId!==card.id);
      let blue=null;
      if(goals.length===1&&goals[0].id==="data:blue:2"){
        const start=node.legalActions.find(a=>a.family==="place_data");
        if(!start)return null;
        blue=quietBluePublicPick({state:bought,owner:q,node,stored,plan:{goal:goals[0],firstActionId:start.actionId},
          transition,paidDrawCount:drawCount-1});
        if(!blue||blue.bluePublicPick?.continuingDataPlans)return null;
      }else if(goals.length)return null;
      const delta=stateValue.sumValueParts([after,-before]);
      const take=blue&&(blue.netGain>0||blue.netGain===0&&blue.unrealizedPurposeDelta<0);
      const resource=stateValue.sumValueParts([stateValue.DEFAULT_WEIGHTS.handSize,
        (q.resources.publicity-p.resources.publicity)*stateValue.DEFAULT_WEIGHTS.publicity]);
      return {firstActionId:action.actionId,netGain:stateValue.sumValueParts([resource,delta,take?blue.netGain:0]),
        requiredNativeInputs:2+(take?blue.requiredNativeInputs:1),markedTiles:[],
        unrealizedPurposeDelta:stateValue.sumValueParts([delta,take?blue.unrealizedPurposeDelta:0]),
        paidPublicIncome:{cardId:card.id,index,selected:take?"blue":"end",blue:blue?.bluePublicPick||null,
          endDelta:resource+delta,incomeNet:incomeTail.netGain}};
    }

    function turnTailSummary(node,kind="end-turn") {
      const stored=nodes.get(node);if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!resourcePlanning||!cardPickPlanning||node.status!=="stable"||stored.envelope.session)return null;
      if(!["end-turn","blue-end-turn","data-end-turn","paid-income-end-turn"].includes(kind))throw new Error("ANALYSIS_TURN_TAIL_KIND_INVALID");
      // A compound live-probe proof is conditional on this policy, including
      // cached proofs when a caller changes the planning mode on the same port.
      if(kind!=="end-turn"&&!movementPlanning&&hasUnprovedProbeCapital(readPlanningState(stored)))return null;
      let variants=turnTailSpecs.get(node);if(variants?.has(kind))return variants.get(kind);
      const state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId),company=industryCatalog.getPlayerIndustryDefinition(owner);
      if(kind==="paid-income-end-turn"){
        const proof=quietPaidIncomeTail(node,stored,state);
        const answer=proof&&freeze({proof:"seti-known-paid-income-and-blue-tail-v1",kind,...proof,
          scope:"exact-known-paid-public-card-and-quiet-tail-value",observationAvailable:false,successorEnvelopeAvailable:false});
        if(!variants){variants=new Map();turnTailSpecs.set(node,variants);}variants.set(kind,answer);return answer;
      }
      const companyPolicy=kind!=="end-turn"?cardPickSpec(node):null;
      if(kind!=="end-turn"&&node.legalActions.some(a=>a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards"&&(!companyPolicy||companyPolicy.retainedActionIds.includes(a.actionId)))){
        // The joint policy already fixed all three placements before any
        // alternative swap. The end-of-prefix proof below still asks again
        // on the new wallet; it cannot hide a newly useful acquisition.
        const rejectedSwap=kind==="data-end-turn"&&state.turn.roundNumber===3&&owner.resources.availableData===3
          &&owner.hand.filter(c=>(cards.getDiscardActionRewardForCard(c)?.dataCount||0)>0).length===2&&resourceSpec(node);
        if(!rejectedSwap||rejectedSwap.retainedActionIds.length||rejectedSwap.plans.length!==1
          ||rejectedSwap.plans[0].goal.id!=="data:computer-prefix:3")return null;
      }
      const end=node.legalActions.find(a=>a.family==="end_turn"),minimum=Math.min(...state.finalScoring.thresholds);
      const passives={deepspace_swap_cards:"deepspace_free_analyze",turing_borrow_tech:"turing_blue_tech_publicity",helios_remove_tech_income:"helios_passive_reward_slots"};
      const quietCompany=company&&passives[company.activeAbilityId]&&company.passiveIds.length===1&&company.passiveIds[0]===passives[company.activeAbilityId];
      const computerPolicy=kind!=="end-turn"?resourceSpec(node):null;
      // An already committed movement intent needs its materialized cold path.
      // An unbound probe may use the existing per-boundary stationary proof.
      const computerPrefix=computerPolicy?.plans.some(p=>p.goal.kind==="computer-prefix");
      const completedPrefix=completedPaidPrefix(state,stored.intent);
      if(computerPrefix&&stored.intent)return null;
      const stationaryComputerPrefix=computerPrefix&&hasOwnVisitSource(state);
      const fixedProbeComputer=kind==="data-end-turn"&&state.turn.roundNumber===3&&stationaryComputerPrefix
        &&company?.activeAbilityId==="deepspace_swap_cards"&&!rootPublicLandingOffer&&!owner.hand.length
        &&owner.resources.credits===0&&owner.resources.energy===0&&owner.resources.availableData===3
        &&computerPolicy.retainedActionIds.length===0&&computerPolicy.plans.length===1
        &&computerPolicy.fixedComputerTail?.selected&&computerPolicy.plans[0].goal.id==="data:computer-prefix:3"
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id));
      if(stationaryComputerPrefix&&!fixedProbeComputer&&cardPickSpec(node)?.goal)return null;
      const knownAmibaTail=computerPolicy?.plans.length===1&&computerPolicy.plans[0].goal.kind==="computer-prefix"
        &&computerPolicy.retainedActionIds.length===0&&state.aliens.amiba?.revealInitialized===true
        &&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="阿米巴");
      const knownOrOpaque=card=>knownCards(stored.envelope).has(card.id)
        ||Boolean(stored.informationBarrier&&card.hidden&&!card.id&&!card.cardId);
      const publicAmibaPlainEnd=kind==="end-turn"&&company?.activeAbilityId==="deepspace_swap_cards"
        &&state.aliens.amiba?.revealInitialized===true&&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="阿米巴")
        &&owner.hand.every(knownOrOpaque)&&owner.reservedCards.every(card=>knownCards(stored.envelope).has(card.id))
        &&owner.reservedCards.every(card=>!cardEffects.getCardModel(card)?.temporaryTasks?.length)
        &&!cardEffects.listPendingTriggerKeys({...owner,reservedCards:owner.hand},state.turn).length;
      const publicAmibaCurrencyTail=kind!=="end-turn"&&computerPolicy?.plans.length===1
        &&["blue-data","income"].includes(computerPolicy.plans[0].goal.kind)&&company?.activeAbilityId==="deepspace_swap_cards"
        &&state.aliens.amiba?.revealInitialized===true&&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="阿米巴")
        &&owner.hand.every(knownOrOpaque)&&owner.reservedCards.every(card=>knownCards(stored.envelope).has(card.id))
        &&owner.reservedCards.every(card=>!cardEffects.getCardModel(card)?.temporaryTasks?.length)
        &&!cardEffects.listPendingTriggerKeys({...owner,reservedCards:owner.hand},state.turn).length;
      // A filled computer prefix and the ordinary end step do not move a
      // probe or change the distance of a reserved task. Use that same task
      // domain only after public Amiba acquisition and with no own visit source.
      const stationaryAmibaPrefix=state.turn.roundNumber===4&&knownAmibaTail
        &&stored.informationBarrier?.code==='hidden_alien_card'
        &&company?.activeAbilityId==='deepspace_swap_cards'&&!hasOwnVisitSource(state)
        &&owner.hand.every(knownOrOpaque)&&owner.reservedCards.every(card=>knownCards(stored.envelope).has(card.id));
      const fixedR4DeepSpace=kind!=="end-turn"&&state.turn.roundNumber===4&&company?.activeAbilityId==="deepspace_swap_cards"
        &&!stored.intent&&!stored.resourceControl&&computerPolicy?.plans.length===1
        &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        &&owner.hand.every(knownOrOpaque)&&owner.reservedCards.every(card=>knownCards(stored.envelope).has(card.id));
      const quietR3Computer=state.turn.roundNumber===3&&knownAmibaTail&&company?.activeAbilityId==="deepspace_swap_cards"
        &&!hasOwnVisitSource(state)&&!rootPublicLandingOffer&&owner.hand.every(c=>knownCards(stored.envelope).has(c.id))
        &&owner.reservedCards.every(c=>knownCards(stored.envelope).has(c.id))
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id));
      let deferredTask=publicAmibaCurrencyTail&&(kind==="data-end-turn"&&computerPolicy.plans[0].goal.kind==="income"
        ||kind==="blue-end-turn"&&computerPolicy.plans[0].goal.id==="data:blue:1")?computerPolicy.deferredCappedTask??null:null;
      const taskBlue=kind==="blue-end-turn"&&publicAmibaCurrencyTail
        &&computerPolicy.plans[0].goal.id==="data:blue:2"&&owner.resources.publicity===players.RESOURCE_LIMITS.publicity;
      const taskBlueIncome=kind==="blue-end-turn"&&publicAmibaCurrencyTail&&computerPolicy.plans[0].goal.id==="data:blue:2"
        &&owner.resources.availableData===2&&data.listComputerPlacedTokens(owner).length===3;
      const ready=kind==="end-turn"||taskBlue||taskBlueIncome?node.legalActions.filter(a=>a.family==="complete_task"):[];
      if((publicAmibaPlainEnd||taskBlue)&&ready.length===1&&state.turn.roundNumber===3&&!hasOwnVisitSource(state)){
        // The audited end/skip sequence changes no wallet or assets. Use the
        // same post-advance reserve quote on the same solo seat's public facts.
        const next={...state,players:{...state.players,players:state.players.players.map(p=>p===owner?{...p,mainActionCompleted:false}:p)}};
        const candidate=localPlans.deferredSectorPublicityQuote({state:next,seatId,knownCards:knownRootCardIds});
        if(candidate?.cardId===ready[0].target.cardInstanceId&&candidate.taskId===ready[0].target.ruleId)deferredTask=candidate;
      }
      if(!deferredTask&&taskBlue&&ready.length===1&&hasOwnVisitSource(state)){
        const capped=cappedSectorTaskToKeep(state,owner,node);
        if(capped)deferredTask={...capped,stationaryCapped:true};
      }
      if(!deferredTask&&kind==="end-turn"&&publicAmibaPlainEnd&&ready.length===1&&state.turn.roundNumber===3){
        const {cardInstanceId:cardId,ruleId:taskId}=ready[0].target;
        if(localPlans.canDeferSectorPublicityTask({state,seatId,cardId,taskId,single:true})){
          const next={...state,players:{...state.players,players:state.players.players.map(p=>p===owner?{...p,mainActionCompleted:false}:p)}};
          const reserve=localPlans.deferredSectorPublicityQuote({state:next,seatId,knownCards:knownRootCardIds});
          deferredTask={cardId,taskId,fixedSkip:true,forecast:reserve};
        }else{
          const task=localPlans.knownSectorPublicityTask({state,seatId,cardId,taskId,single:true});
          if(task&&owner.resources.publicity+task.gain.publicity<=players.RESOURCE_LIMITS.publicity)
            deferredTask={cardId,taskId,compareClaim:true};
        }
      }
      if(!deferredTask&&taskBlueIncome&&ready.length===1&&state.turn.roundNumber===3){
        const {cardInstanceId:cardId,ruleId:taskId}=ready[0].target,card=owner.reservedCards.find(c=>c.id===cardId);
        const known=card&&localPlans.sectorPublicityReward(card);
        if(known?.task.id===taskId&&known.model.cardType===2&&!known.model.endGameScoring)
          deferredTask={cardId,taskId,requiresIncome:true};
      }
      const bonuses=state.turn.cardTurnEventBonuses||[];
      // A completed free route has no pending visit. The production turn-end
      // handler only clears these score bonuses; ordinary data cannot fire them.
      const inertVisitBonus=bonuses.length>0&&state.turn.roundNumber===4
        &&["turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId)
        &&stored.intent?.free===true&&stored.intent.path?.length===0
        &&stored.intent.startedTurn===state.turn.turnNumber&&stored.intent.startedRound===4
        &&goalMovementSpec(node)?.reason==="objective-reached"
        &&bonuses.every(b=>(b.ownerId||b.playerId)===seatId&&b.eventType==="visitPlanet"&&b.duration==="turn"
          &&!b.publicityToMoveFollowup&&Array.isArray(b.rewards)&&b.rewards.length===1
          &&b.rewards[0].type==="gain_resources"&&Object.keys(b.rewards[0].options?.gain||{}).length===1
          &&Number.isSafeInteger(b.rewards[0].options?.gain.score));
      let spec=null;
      if(owner.mainActionCompleted&&!owner.passCompletionPending&&end&&state.turn.currentPlayerId===seatId
        &&quietCompany&&state.turn.activePlayerCount===4
        &&!owner.industryBorrowedTechTileId&&(!bonuses.length||inertVisitBonus)
        &&!state.match.initialSetup&&!state.turn.gameEnded&&!state.turn.passedPlayerIds.includes(seatId)
        &&Number.isSafeInteger(minimum)&&minimum>0&&state.players.players.every(p=>Number.isSafeInteger(p.resources.score)&&(p.id===seatId||p.resources.score<minimum))
        &&Object.values(state.aliens.aliens).every(slot=>(!slot.revealed
          ||(knownAmibaTail||publicAmibaPlainEnd||publicAmibaCurrencyTail||fixedR4DeepSpace)&&slot.alienId==="阿米巴"
          ||(fixedR4DeepSpace||state.turn.roundNumber===3
            &&(publicAmibaPlainEnd||!hasOwnVisitSource(state)&&(publicAmibaCurrencyTail||quietR3Computer))
            &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length)
            &&slot.alienId==="虫"&&owner.reservedCards.every(card=>card.set!=="alien:虫"))
          &&!alienState.isAlienReadyToReveal(slot))
        // A plain end cannot move a probe; the helper still checks historical
        // matching triggers, tasks and scoring. Compound plans keep their
        // visit-capable guard until their complete event set is proved.
        // Plain end never moves; compound previews below separately certify
        // that no movement policy starts at any intermediate goal boundary.
        &&hasPostMainInertReservations(state,false,knownAmibaTail||publicAmibaPlainEnd||publicAmibaCurrencyTail,publicAmibaPlainEnd||publicAmibaCurrencyTail||stationaryAmibaPrefix||quietR3Computer||fixedProbeComputer,deferredTask)
        &&(deferredTask||!node.legalActions.some(a=>a.family==="complete_task"))){
        const transition=previewTurn(state);
        if(transition.turnAdvanced&&!transition.roundAdvanced&&!transition.gameEnded){
          if(kind==="end-turn"){
            const completion=localPlans.quietEndCompletion({state,seatId});
            if(!deferredTask?.compareClaim&&completion.available&&(!deferredTask||completion.markedTiles.length===0&&completion.netGain===0&&transition.nextPlayerId===seatId))
              spec={firstActionId:end.actionId,netGain:completion.netGain,requiredNativeInputs:completion.requiredNativeInputs+Number(Boolean(deferredTask)),markedTiles:completion.markedTiles,
                ...(deferredTask?.fixedSkip?{quietDeferredTask:{cardId:deferredTask.cardId,taskId:deferredTask.taskId},...(deferredTask.forecast?{deferredPublicity:deferredTask.forecast}:{})}:deferredTask?{deferredPublicity:deferredTask}:{}),
                ...(publicAmibaPlainEnd?{publicAmibaPlainEnd:true,unrealizedPurposeDelta:completion.purposeDelta}:{} )};
            if(deferredTask?.compareClaim&&completion.available&&!completion.netGain&&!completion.markedTiles.length
              &&transition.nextPlayerId===seatId){
              const claimed=localPlans.previewCappedSectorClaim({state,seatId,task:deferredTask,allowPublicityGain:true});
              if(claimed){
                const p=claimed.players.players.find(q=>q.id===seatId),endClaim=localPlans.quietEndCompletion({state:claimed,seatId});
                const debt=(s,p)=>{const m=resourceDemand.movementToolPlan(s,p);return m.value>0?m.selected.preparationDebt:0;};
                if(endClaim.available&&!endClaim.netGain&&!endClaim.markedTiles.length&&debt(state,owner)===debt(claimed,p)){
                  const score=(s,p)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
                    aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
                    getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},p).totalScore;
                  const delta=stateValue.sumValueParts([resourceDemand.planningCapital(claimed,p),-resourceDemand.planningCapital(state,owner)]);
                  const gain=stateValue.sumValueParts([delta,score(claimed,p),-score(state,owner),
                    (p.resources.publicity-owner.resources.publicity)*stateValue.DEFAULT_WEIGHTS.publicity]);
                  if(gain!==0||delta!==0){
                    const claim=gain>0||gain===0&&delta<0;
                    spec={firstActionId:end.actionId,netGain:claim?gain:0,requiredNativeInputs:2,markedTiles:[],
                      unrealizedPurposeDelta:claim?delta:0,quietTaskChoice:{cardId:deferredTask.cardId,taskId:deferredTask.taskId,claim,gain,delta}};
                  }
                }
              }
            }
          }
          else{
            const policy=resourceSpec(node),plan=policy?.plans.length===1&&policy.plans[0],tail=policy?.fixedBlueTail
              ||(publicAmibaCurrencyTail||inertVisitBonus)&&plan?.goal.kind==="blue-data"&&localPlans.blueCompletion({state,seatId,goal:plan.goal});
            if(kind==="blue-end-turn"&&publicAmibaCurrencyTail&&plan?.goal.id==="data:blue:1")
              spec=deferredTask?quietCappedTaskBlueCurrency({state,owner,node,stored,plan,transition,deferredTask})
                :quietScoredCornerThenBlueCurrency({state,owner,node,stored,plan,transition});
            if(kind==="blue-end-turn"&&publicAmibaCurrencyTail&&plan?.goal.kind==="blue-data"&&plan.goal.blueSlot===2)
              spec=owner.resources.availableData===0&&!deferredTask?quietScoredCornerThenBluePick({state,owner,node,stored,plan,transition}):
                quietBluePublicPick({state,owner,node,stored,plan,transition,deferredTask});
            if(!spec&&kind==="blue-end-turn"&&fixedR4DeepSpace&&!deferredTask&&plan)
              spec=quietR4FundedPublicBlue({state,owner,node,stored,plan,transition});
            if(kind==="data-end-turn"&&publicAmibaCurrencyTail&&plan?.goal.kind==="income"){
              const income=quietFixedIncomeTail({state,owner,node,stored,plan,policy,transition});
              if(income)spec=deferredTask?{...income,requiredNativeInputs:income.requiredNativeInputs+1,deferredPublicity:deferredTask}:income;
            }
            if(fixedProbeComputer&&!deferredTask&&transition.nextPlayerId===seatId&&plan)
              spec=quietComputerThenKnownBluePick({state,owner,node,stored,plan,transition});
            if(kind==="data-end-turn"&&quietR3Computer&&!deferredTask&&transition.nextPlayerId===seatId
              &&plan?.goal.targetComputerSlot===3&&policy.fixedComputerTail?.selected
              &&node.legalActions.some(a=>a.actionId===plan.firstActionId&&a.family==="place_data")){
              const tail=localPlans.computerThenScoredCurrency({state,seatId,goal:plan.goal,noAcquisition:quietTailHasNoAcquisition});
              if(tail)spec={firstActionId:plan.firstActionId,...tail};
            }
            // A new direct-END quote must not shadow an existing compound
            // proof that a multi-turn purpose may still use.
            const directEnd=spec?.incomeThenQuietEnd||spec?.computerThenQuietEnd?spec:null;
            if(directEnd)spec=null;
            const activeBlue=Object.keys(owner.techState.ownedTiles).filter(id=>id.startsWith("blue")&&owner.techState.ownedTiles[id]&&!owner.techState.disabledTiles[id]);
            const fixedDataOrdering=stationaryAmibaPrefix||fixedR4DeepSpace||state.turn.roundNumber===4&&["turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId)
              &&hasPostMainInertReservations(state,hasOwnVisitSource(state));
            if(!spec&&!deferredTask&&plan&&((plan.goal.kind==="blue-data"&&tail?.available&&(tail.selected||publicAmibaCurrencyTail||fixedDataOrdering))||(kind==="data-end-turn"&&(plan.goal.kind==="income"&&policy.incomeTail?.selected||plan.goal.kind==="computer-prefix"&&policy.fixedComputerTail?.selected)))){
              let stationary,reachedIntent,noMovementPayment,checkedNewAcquisition=false;
              const exactFixedBlueTie=fixedR4DeepSpace||fixedDataOrdering&&state.turn.roundNumber===4&&plan.goal.kind==="income"
                &&!stored.intent&&!stored.resourceControl
                &&["turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId);
              // The evaluator's sole preparation debt is the known movement
              // tool quote, which cannot exist in round four. The movement
              // policy below still verifies no route starts at any boundary.
              const moveCards=p=>p.hand.reduce((n,card)=>n+(cards.getDiscardActionMoveRewardForCard(card)?.movementPoints||0),0);
              const sourceMoveCards=moveCards(owner);
              const publicBlue=finalState=> {
                const current=finalState.state,p=current.players.players.find(q=>q.id===seatId),goal=finalState.goal;
                if(!fixedR4DeepSpace||goal.id!=="data:blue:2"||!quietTailHasNoAcquisition(current,finalState.capital))return null;
                if(p.resources.availableData===0){
                  const actions=node.legalActions.filter(a=>a.family==="card_corner"&&a.payload?.kind==="resource"
                    &&p.hand.some(c=>c.id===a.target.cardInstanceId));
                  const prep=resourceDemand.preparations({state:current,seatId,goal,actions})[0];
                  const corner=actions.find(a=>a.actionId===prep?.actionId),card=p.hand.find(c=>c.id===corner?.target.cardInstanceId);
                  const reward=card&&cards.getDiscardActionRewardForCard(card);
                  if(!corner||prep.observer||!knownCards(stored.envelope).has(card.id)||corner.payload.multiplier!==1
                    ||reward?.dataCount!==1||Object.keys(reward.gain||{}).length)return null;
                  const owner={...p,resources:{...p.resources},dataState:structuredClone(p.dataState),hand:p.hand.filter(c=>c!==card)};
                  owner.resources.handSize=owner.hand.length;
                  const meta=structuredClone(current.meta);
                  if(!data.gainData(owner,{root:{meta}}).ok||owner.resources.availableData!==1)return null;
                  const prepared={...current,meta,players:{...current.players,players:current.players.players.map(q=>q===p?owner:q)},
                    cards:{...current.cards,discardPile:[...current.cards.discardPile,card]}};
                  if(!quietTailHasNoAcquisition(prepared))return null;
                  const pick=quietBluePublicPick({state:prepared,owner,node,stored,plan:{goal,firstActionId:corner.actionId},transition,firstFamily:"card_corner",finalRoundQuiet:true});
                  if(!pick)return null;
                  const capital=stateValue.sumValueParts([resourceDemand.planningCapital(prepared,owner),-(finalState.capital??resourceDemand.planningCapital(current,p))]);
                  const scoring=(s,v)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,aliens:structuredClone(s.aliens),
                    finalScoring:structuredClone(s.finalScoring),cardEffects,getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},v).totalScore;
                  return {...pick,netGain:stateValue.sumValueParts([pick.netGain,capital,scoring(prepared,owner),-scoring(current,p),
                    stateValue.DEFAULT_WEIGHTS.availableData,-stateValue.DEFAULT_WEIGHTS.handSize]),
                    requiredNativeInputs:1+pick.requiredNativeInputs,unrealizedPurposeDelta:stateValue.sumValueParts([pick.unrealizedPurposeDelta,capital]),
                    bluePublicPick:{...pick.bluePublicPick,fixedDataCornerId:card.id}};
                }
                const action=node.legalActions.find(a=>a.family==="place_data");
                if(!action)return null;
                return quietBluePublicPick({state:current,owner:p,node,stored,plan:{goal,firstActionId:action.actionId},transition,finalRoundQuiet:true});
              };
              const compound=localPlans.dataTailCompletion({state,seatId,trackPurposeDelta:publicAmibaCurrencyTail||stationaryAmibaPrefix||inertVisitBonus||exactFixedBlueTie||fixedR4DeepSpace,
                publicBlue:fixedR4DeepSpace?publicBlue:null,
                fixedDataOrdering,stationaryFinalData:stationaryAmibaPrefix,exactFixedBlueTie,
                initialIncomeGoal:plan.goal.kind==="income"?plan.goal:null,initialIncomeTail:policy.incomeTail,
                firstBlueGoal:(publicAmibaCurrencyTail||fixedDataOrdering)&&plan.goal.kind==="blue-data"?plan.goal:null,
                canContinue:publicAmibaCurrencyTail||stationaryAmibaPrefix||fixedDataOrdering?(preview,knownSourceCapital)=>{
                  const p=preview.players.players.find(p=>p.id===seatId),cost=quickTrades.getTradeAction('publicity-for-card').cost.publicity;
                  // A newly affordable acquisition is outside this fixed tail.
                  if(fixedR4DeepSpace)return quietTailHasNoAcquisition(preview,knownSourceCapital);
                  if(exactFixedBlueTie){
                    if(owner.resources.publicity<cost&&p.resources.publicity>=cost){
                      checkedNewAcquisition=true;
                      const actions=["publicity-for-card","cards-for-pick-card","credits-for-card","energy-for-card"]
                        .map(quickTrades.getTradeAction).filter(t=>players.canAfford(p,t.cost))
                        .map(t=>({family:"quick_trade",actionId:t.id,target:{tradeId:t.id},payload:{cost:t.cost}}));
                      return !cardPickPlanner.plan({state:preview,seatId,status:"stable",actions})?.goal;
                    }
                  }
                  if(owner.resources.publicity<cost&&p.resources.publicity>=cost)return false;
                  return !cardPickPlanner.plan({state:preview,seatId,status:"stable",actions:node.legalActions,knownSourceCapital})?.goal;
                }:null,
                canLeaveProbeStationary: preview => {
                  if(completedPrefix||fixedR4DeepSpace&&!hasOwnVisitSource(preview))return true;
                  if(stationary===undefined){
                    const policy=goalMovementSpec(node);
                    noMovementPayment=stationaryComputerPrefix&&!policy&&owner.resources.energy===0
                      &&owner.resources.credits===0&&sourceMoveCards===0&&!node.legalActions.some(goalMovement.isDirection);
                    stationary=!stored.intent?.path.length&&!policy?.selectedActionId
                      &&(noMovementPayment||["defer-movement","no-affordable-objective","objective-reached"].includes(policy?.reason));
                    reachedIntent=policy?.reason==="objective-reached"&&stored.intent?.path.length===0;
                  }
                  const p=preview.players.players.find(p=>p.id===seatId);
                  if(stationaryComputerPrefix){
                    const trade=quickTrades.getTradeAction('publicity-for-card');
                    // Recheck the unchanged native acquisition menu and the
                    // sole newly affordable trade at every data boundary.
                    const actions=node.legalActions.filter(a=>cardPickPlanningApi.isTrade(a)
                      ||a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards");
                    if(p.resources.publicity>=trade.cost.publicity&&!actions.some(a=>a.target?.tradeId===trade.id))
                      actions.push({family:"quick_trade",actionId:"quiet-prefix-publicity-pick",target:{tradeId:trade.id},payload:{cost:trade.cost}});
                    const pick=cardPickPlanner.plan({state:preview,seatId,status:"stable",actions});
                    if(pick?.goal)return false;
                  }
                  if(noMovementPayment&&(p.resources.credits!==0||p.resources.energy!==0||moveCards(p)!==0))return false;
                  // In an uncontested round, query the existing objective
                  // policy on this exact wallet instead of assuming every new
                  // energy can enable an urgent move. No actions or node are
                  // made; an affordable current-turn objective rejects the proof.
                  if((publicAmibaCurrencyTail||fixedR4DeepSpace)&&!stored.intent&&preview.turn.activePlayerIds?.includes(seatId)
                    &&preview.turn.activePlayerIds.every(id=>id===seatId||preview.turn.passedPlayerIds.includes(id))){
                    const objective=goalMovement.plan({state:preview,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
                      endpoints:()=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(preview,seatId)?.candidates||[]});
                    goalMovementGeometryNodes+=objective?.routingNodes||0;
                    return !objective?.intent?.path.length;
                  }
                  // At stable post-main nodes this policy's paid movement
                  // depends on energy/corner points, not credit affordability.
                  // No new energy/move cards and no lower publicity can create
                  // an objective or a cheaper pre-rotation prefix. Other board,
                  // reservation, technology and temporary-ability facts do not
                  // change in these already-audited currency/data previews.
                  // Native data/currency steps retain a completed movement intent.
                  // With no route left and no reduced wallet, its endpoint
                  // payment remains valid even when this income adds energy.
                  if(reachedIntent&&p.resources.credits>=owner.resources.credits
                    &&p.resources.energy>=owner.resources.energy)return true;
                  // Experimental: exact existing movement policy on each R4 wallet.
                  // No successor/Native state is made and no coarse value bound is restored.
                  if(stationary&&p.resources.energy<=owner.resources.energy
                    &&p.resources.publicity>=owner.resources.publicity&&moveCards(p)<=sourceMoveCards)return true;
                  if(!stored.intent&&state.turn.roundNumber===4
                    &&["turing_borrow_tech","helios_remove_tech_income"].includes(company?.activeAbilityId)){
                    const native=productionKernel||globalThis.SetiProductionKernel;
                    const objective=goalMovement.plan({state:preview,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
                      endpoints:()=>native.getProbeRouteRequirements(preview,seatId)?.candidates||[],
                      compareTiming:timingForOneGoalQuery(preview)});
                    goalMovementGeometryNodes+=objective?.routingNodes||0;
                    return !objective?.intent?.path.length;
                  }
                  return stationary&&p.resources.energy<=owner.resources.energy
                    &&p.resources.publicity>=owner.resources.publicity&&moveCards(p)<=sourceMoveCards;
                }});
              // Keep an exact value for every root option. The new R4
              // shortcut never substitutes a primary-only upper bound.
              if(compound.available&&(!(checkedNewAcquisition||fixedR4DeepSpace)||!compound.primaryOnly)&&compound.plans[0]?.goal.id===plan.goal.id
                &&node.legalActions.some(a=>a.actionId===plan.firstActionId&&["place_data","card_corner"].includes(a.family)))
                spec={firstActionId:plan.firstActionId,netGain:compound.netGain,requiredNativeInputs:compound.requiredNativeInputs,dataPlans:compound.plans,markedTiles:compound.markedTiles,...(compound.primaryOnly?{primaryOnly:true}:{}),
                  ...(publicAmibaCurrencyTail||stationaryAmibaPrefix?{publicAmibaCurrencyTail:true,unrealizedPurposeDelta:compound.purposeDelta}:inertVisitBonus||exactFixedBlueTie||fixedR4DeepSpace?{inertVisitBonus,exactFixedBlueTie,unrealizedPurposeDelta:compound.purposeDelta}:{})};
              else if(!deferredTask&&!hasUnprovedProbeCapital(state)&&plan.goal.kind==="blue-data"&&tail&&!tail.dataCornerId&&activeBlue.length===1&&owner.resources.score+tail.immediateScoreGain<minimum
                &&node.legalActions.some(a=>a.actionId===plan.firstActionId&&a.family==="place_data"))
                spec={firstActionId:plan.firstActionId,netGain:tail.netGain,requiredNativeInputs:tail.requiredNativeInputs+1,
                  blueSlot:plan.goal.blueSlot,computerPlacements:tail.computerPlacements,incomeCardId:tail.incomeCardId};
            }
            if(directEnd&&(!spec||spec.primaryOnly))spec=directEnd;
          }
        }
      }
      spec=spec&&freeze({proof:spec.computerThenKnownBluePick?"seti-forced-computer-and-visible-blue-pick-v1":spec.cappedTaskBlueCurrency?"seti-fixed-blue-currency-and-deferred-task-v1":spec.computerThenQuietEnd?"seti-funded-computer-quiet-end-v1":spec.incomeThenQuietEnd?"seti-fixed-currency-income-quiet-end-v1":spec.computerThenScoredBlue?"seti-computer-prefix-and-scored-blue-v1":spec.incomeThenKnownBlue?"seti-fixed-income-then-public-blue-v1":spec.incomeThenBlueCurrency?"seti-fixed-income-then-blue-currency-v1":spec.bluePublicPick?.taskChoice?"seti-capped-task-and-public-blue-pick-v1":spec.bluePublicPick?"seti-quiet-public-blue-pick-value-v1":"seti-audited-company-quiet-turn-tail-value-v2",kind,...spec,
        scope:kind==="end-turn"?"exact-native-end-turn-and-greedy-final-marks-value":"exact-fixed-blue-then-end-turn-and-greedy-final-marks-policy-value",
        ...(fixedR4DeepSpace&&spec.dataPlans?.length?{r4DeepSpaceDataTail:true}:{}),
        observationAvailable:false,successorEnvelopeAvailable:false});
      if(!variants){variants=new Map();turnTailSpecs.set(node,variants);}variants.set(kind,spec);return spec;
    }
    function turnTailBoundary(node,spec){
      if(!spec||spec.primaryOnly||turnTailSummary(node,spec.kind)!==spec)throw new Error("ANALYSIS_TURN_TAIL_PROOF_INVALID");
      let variants=turnTailNodes.get(node);if(variants?.has(spec.kind))return variants.get(spec.kind);
      const leaf=Object.freeze({status:"turn-tail-value",boundary:"quiet-turn-tail-value",legalActions:Object.freeze([]),planSummary:spec,
        get observation(){throw new Error("ANALYSIS_PLAN_PROOF_HAS_NO_SUCCESSOR_OBSERVATION");}});
      nodes.set(leaf,{identity:Object.freeze({}),turnTailBase:node});nodeCount++;
      if(!variants){variants=new Map();turnTailNodes.set(node,variants);}variants.set(spec.kind,leaf);return leaf;
    }
    function turnTailBase(node){
      const stored=nodes.get(node);if(!fork||!stored?.turnTailBase)throw new Error("ANALYSIS_TURN_TAIL_PROOF_INVALID");return stored.turnTailBase;
    }

    // This strict plan only fills computer slots, consumes one known supplier
    // and draws one unknown card. Its local preview now includes mission
    // capital with that exact resource/known-hand change; no refill identity
    // or invented successor is needed to quote its scalar boundary value.
    // The shared preview includes the exact mission change from computer data,
    // publicity, the consumed known supplier and one unknown hand count. The
    // root policy must still have exactly this one fixed income plan; competing
    // blue plans retain their separate native policy and are never hidden here.
    function incomePlanSummary(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!resourcePlanning||!cardPickPlanning||node.status!=="stable"||stored.envelope.session)return null;
      if(incomeProofSpecs.has(node))return incomeProofSpecs.get(node);
      const state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId);
      const company=industryCatalog.getPlayerIndustryDefinition(owner),audited={
        deepspace_swap_cards:"deepspace_free_analyze",turing_borrow_tech:"turing_blue_tech_publicity",helios_remove_tech_income:"helios_passive_reward_slots"};
      const stationaryRevealedChong=state.turn.roundNumber===4&&company?.activeAbilityId==="deepspace_swap_cards"
        // The ordinary hidden-draw tail requires a spent company use. Here
        // this fixed income must end at the unknown owned-card boundary.
        &&owner.industryRoundMarkRound!==state.turn.roundNumber
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        &&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="虫")
        &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        &&owner.reservedCards.every(card=>card.set!=="alien:虫")
        &&hasPostMainInertReservations(state,false,true,true);
      const publicAmibaBlindIncome=company?.activeAbilityId==="deepspace_swap_cards"&&state.aliens.amiba?.revealInitialized===true
        &&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="阿米巴")
        &&[...owner.hand,...owner.reservedCards].every(card=>knownCards(stored.envelope).has(card.id))
        &&(!(state.turn.type1TriggerEvents||[]).length||stationaryRevealedChong)
        &&owner.reservedCards.every(card=>!cardEffects.getCardModel(card)?.temporaryTasks?.length);
      let result=null;
      if(owner.mainActionCompleted&&!owner.passCompletionPending&&!owner.industryBorrowedTechTileId
        &&state.turn.currentPlayerId===seatId&&!state.turn.gameEnded&&!state.match.initialSetup
        &&!(state.turn.cardTurnEventBonuses||[]).length
        &&company&&audited[company.activeAbilityId]&&company.passiveIds.every(id=>id===audited[company.activeAbilityId])
        &&Object.values(state.aliens.aliens).every(slot=>(!slot.revealed||publicAmibaBlindIncome&&slot.alienId==="阿米巴"
          ||publicAmibaBlindIncome&&stationaryRevealedChong&&slot.alienId==="虫")&&!alienState.isAlienReadyToReveal(slot))
        &&hasTradeInertReservations(state,publicAmibaBlindIncome)){
        const policy=resourceSpec(node),plan=policy?.plans.length===1&&policy.plans[0];
        const goal=plan?.goal,card=owner.hand.find(c=>c.id===goal?.incomeCardId),gain=card&&cards.getIncomeGainForCard(card);
        const placements=data.listComputerPlacedTokens(owner).map(t=>t.placementSlot).sort((a,b)=>a-b);
        const first=node.legalActions.find(a=>a.actionId===plan?.firstActionId);
        if(goal?.kind==="income"&&!policy.bound&&policy.retainedActionIds.length===0&&policy.incomeTail?.selected
          &&first?.family==="place_data"&&gain?.handSize===1&&Object.keys(gain).length===1
          &&placements.length<4&&placements.every((slot,index)=>slot===index+1)
          &&owner.resources.availableData===owner.dataState.poolTokens.length
          &&owner.resources.availableData>=4-placements.length
          &&cards.getAvailablePool({...state.cards},state.players).length>0
          &&(publicAmibaBlindIncome||Number.isSafeInteger(policy.incomeTail.netGain*2))){
          const capital=publicAmibaBlindIncome?resourceDemand.blindIncomeBoundaryCapital({state,seatId,goal}):null;
          if(publicAmibaBlindIncome&&!capital){incomeProofSpecs.set(node,null);return null;}
          result=freeze({proof:"seti-known-blind-income-plan-value-v1",scope:"exact-value-of-fixed-native-plan-to-unknown-owned-card-boundary",
            firstActionId:first.actionId,goal,netGain:capital?stateValue.sumValueParts([policy.incomeTail.netGain,capital.afterCapital,-capital.originalAfterCapital]):policy.incomeTail.netGain,
            placements:4-placements.length,requiredNativeInputs:(4-placements.length)*2+1,blindDrawCount:1,
            ...(stationaryRevealedChong?{r4RevealedChongIncome:true}:{}),
            ...(capital?{publicAmibaBlindIncome:true,unrealizedPurposeDelta:stateValue.sumValueParts([capital.afterCapital,-capital.beforeCapital]),ordinaryDrawCountBefore:capital.ordinaryDrawCountBefore,ordinaryDrawCountAfter:capital.ordinaryDrawCountAfter}:{}),
            observationAvailable:false,successorEnvelopeAvailable:false});
        }
      }
      incomeProofSpecs.set(node,result);return result;
    }

    function incomePlanBoundary(node,spec) {
      if(!spec||incomePlanSummary(node)!==spec)throw new Error("ANALYSIS_INCOME_PROOF_INVALID");
      if(incomeProofNodes.has(node))return incomeProofNodes.get(node);
      const boundary=Object.freeze({status:"income-plan-value",boundary:"known-income-plan-value",legalActions:Object.freeze([]),planSummary:spec,
        get observation(){throw new Error("ANALYSIS_PLAN_PROOF_HAS_NO_SUCCESSOR_OBSERVATION");}});
      nodes.set(boundary,{identity:Object.freeze({}),incomeProofBase:node});nodeCount++;
      incomeProofNodes.set(node,boundary);return boundary;
    }

    function incomePlanBase(node) {
      const stored=nodes.get(node);
      if(!fork||!stored?.incomeProofBase)throw new Error("ANALYSIS_INCOME_PROOF_INVALID");
      return stored.incomeProofBase;
    }

    function postMainValueBound(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (postMainValueBounds.has(node)) return postMainValueBounds.get(node);
      const sourceState=readPlanningState(stored),sourceOwner=sourceState.players.players.find(p=>p.id===seatId);
      // The legacy capital ceiling omits nonlinear growth of an owned D mark.
      // Keep native continuation until that broader bound has its own proof.
      if(sourceState.turn.roundNumber<4&&sourceState.finalScoring.tiles.d.marks.some(m=>m.playerId===seatId)){postMainValueBounds.set(node,null);return null;}
      if(sourceState.turn.roundNumber<4&&sourceOwner.reservedCards.some(card=>cardEffects.getCardModel(card)?.triggers?.some(t=>
        (t.event?.type==='researchTech'||t.event?.types?.includes('researchTech'))&&!card.cardEffectState?.consumedTriggerIds?.includes(t.id)))){postMainValueBounds.set(node,null);return null;}
      if(hasUnprovedProbeCapital(sourceState)||sourceState.turn.roundNumber<4&&(stateValue.hasKnownSectorTool([...sourceOwner.hand,...sourceState.cards.publicCards.filter(Boolean)])||industryCatalog.getPlayerIndustryDefinition(sourceOwner)?.activeAbilityId==='deepspace_swap_cards'&&stateValue.hasKnownMovementTool([...sourceOwner.hand,...sourceState.cards.publicCards.filter(Boolean)]))){postMainValueBounds.set(node,null);return null;}
      // The legacy ceiling has no allowance for research earning a new mark.
      // In an uncontested round a later funded pick may unlock that opportunity;
      // keep the native continuation until this broader ceiling is proved.
      if(sourceState.turn.roundNumber<4){
        const active=sourceState.turn.activePlayerIds,passed=sourceState.passingPlayerIds||sourceState.turn.passedPlayerIds||[];
        const mark=node.observation.selfState?.nextFinalMark;
        if(Array.isArray(active)&&active.length>0&&active.filter(id=>id!==seatId).every(id=>passed.includes(id))
          &&mark?.valuationSafe&&mark.options.some(option=>option.currentValue>0)){postMainValueBounds.set(node,null);return null;}
      }
      // Prefer the already-audited quiet-window bound; avoid rebuilding its
      // rejected unfiltered company catalog first for every known continuation.
      const policyNode=resourcePlanning?{status:node.status,legalActions:node.legalActions.filter(action=>!(action.family==="industry"&&["turing_borrow_tech","helios_remove_tech_income"].includes(action.target?.abilityId)))}:null;
      const quiet=policyNode?describePostMainPlan(stored,policyNode,true):null;
      const result=quiet?{proof:"seti-quiet-post-main-policy-value-bound-v1",maximumValueIncrease:quiet.maximumValueIncrease,maximumPublicity:quiet.maximumPublicity,sourceProof:quiet}:describePostMainValueBound(stored,node);
      // No admitted post-main action in either source contract can gain a
      // permanent technology. Existing capital is constant (or expires at a
      // round boundary); only a known public pick can increase held-card capital.
      // Held options use a maximum, so multiple picks do not multiply this term.
      let bound=result;
      if(result){
        const state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId);
        const funding={resources:owner.resources,income:owner.income,startingIncome:0};
        const current=stateValue.handCapital(owner.hand,owner.techState,state.tech,state.turn.roundNumber,stateValue.DEFAULT_WEIGHTS,funding);
        // Receiving money can advance an already-held card as well as a pick.
        const heldUpper=stateValue.handCapital(owner.hand,owner.techState,state.tech,state.turn.roundNumber);
        const offered=Math.max(heldUpper,stateValue.handCapital(state.cards.publicCards.filter(Boolean),owner.techState,state.tech,state.turn.roundNumber));
        const currentResearch=resourceDemand.heldAndResearchCapital(state,owner)-current;
        const researchCost=techResolver.getResearchPublicityCost(owner);
        // Fixed post-main data goals reach computer4 for income, or an
        // existing blue prerequisite. They cannot invent computer6 unless a
        // blue slot actually requires it; raw unplanned data retains the ceiling.
        const computerSlots=data.listComputerPlacedTokens(owner).map(t=>t.placementSlot);
        const analysisReachable=!resourcePlanning||computerSlots.includes(4)
          ||Object.entries(owner.techState.blueBoardSlots).some(([id,slot])=>owner.techState.ownedTiles[id]&&!owner.techState.disabledTiles[id]
            &&data.getRequiredComputerSlotForBlueBonus(slot)>=4)
          ||resourceSpec(node)?.plans.some(p=>p.goal.kind==="income");
        const analysisUpper=state.turn.roundNumber<4&&analysisReachable?stateValue.readyAnalysisUpperBound(node.observation.publicState.board.aliens.slots,{techState:owner.techState,computerSlots}):{linear:0,publicity:0};
        const researchUpper=result.maximumPublicity+analysisUpper.publicity<researchCost?0:stateValue.researchCapitalCeiling({techState:owner.techState,supply:state.tech,round:state.turn.roundNumber,
          researchCost});
        // With no live mission, a ready analysis can only add its known trace
        // and one blue resource tail plus these same held/research ceilings.
        // Ignore its costs for the upper bound, but subtract source capital.
        const sourceCapital=resourceDemand.planningCapital(state,owner),sourceAnalysis=sourceCapital-current-currentResearch;
        const bridge=stateValue.researchIncomeUpperBound({round:state.turn.roundNumber,computerSlots:data.listComputerPlacedTokens(owner).map(t=>t.placementSlot),techState:owner.techState,supply:state.tech,publicCards:state.cards.publicCards,maximumPublicity:result.maximumPublicity,researchCost});
        const secondResearch=bridge.secondResearchPossible?stateValue.researchCapitalCeiling({techState:owner.techState,supply:state.tech,round:state.turn.roundNumber,researchCost}):0;
        const prepaidUpper=state.turn.roundNumber<4&&industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId==="deepspace_swap_cards"
          ?Math.max(0,...node.observation.publicState.board.aliens.slots.flatMap(slot=>slot.revealed?[]:[alienState.getExtraTraceReward().gain,alienState.getFirstTraceRewardForSlot(slot.slotId).gain].map(g=>(g.score||0)+(g.publicity||0)*stateValue.DEFAULT_WEIGHTS.publicity)))*5/6:0;
        const maximumCapital=Math.max(offered+researchUpper+analysisUpper.linear,offered+bridge.linear+secondResearch,offered+researchUpper+prepaidUpper);
        const capitalUpperIncrease=Math.max(0,maximumCapital-sourceCapital);
        bound=freeze({...result,proof:"seti-post-main-capital-upper-v4",linearSourceProof:result.proof,
          maximumValueIncrease:result.maximumValueIncrease+capitalUpperIncrease,capitalUpperIncrease,
          capitalValueModel:stateValue.MODEL_VERSION,sourceHandCapital:current,maximumPublicHandCapital:offered,sourceResearchCapital:currentResearch,maximumResearchCapital:researchUpper,sourceAnalysisCapital:sourceAnalysis,maximumAnalysisLinear:analysisUpper.linear,maximumAnalysisPublicity:analysisUpper.publicity,maximumPrepaidAnalysisCapital:prepaidUpper,analysisReachableByFixedDataPolicy:analysisReachable,
          maximumResearchIncomeLinear:bridge.linear,maximumResearchAfterIncome:secondResearch,sourcePurposeCapital:sourceCapital,maximumPurposeCapital:maximumCapital,
          permanentTechnologyGainAdmitted:false});
      }
      postMainValueBounds.set(node, bound);
      return bound;
    }

    function describePostMainValueBound(stored, node) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = readPlanningState(stored), owner = state.players.players.find(player => player.id === seatId);
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
      // The audited window has only one-publicity hand corners, one computer
      // publicity reward, one currency income, and one-use visit slots. Card
      // purchases cannot grow publicity: known picks cost2cards or3publicity;
      // money purchases/blind income stop at the unknown-owned-card barrier.
      const visitMoney=slots.reduce((n,s)=>n+(s.trigger.effect.options?.gain?.credits||0)+(s.trigger.effect.options?.gain?.energy||0),0);
      const visitPublicity=slots.reduce((n,s)=>n+(s.trigger.effect.options?.gain?.publicity||0),0);
      const visitCards=slots.reduce((n,s)=>n+(["draw_cards","pick_card"].includes(s.trigger.effect.type)?Math.max(1,s.trigger.effect.options?.count||1):0),0);
      const maximumMovePoints=probes.length?owner.resources.energy+Math.floor(owner.resources.credits/2)+owner.hand.length+visitCards+visitMoney+Number(incomePossible):0;
      const maximumPublicity=owner.resources.publicity+owner.hand.length+visitCards+visitPublicity+maximumMovePoints
        +Number(!occupied.includes(2)&&stockUpper>=2);
      return freeze({ proof: "seti-post-main-visit-income-value-bound-v2", maximumValueIncrease: movementUpper+incomeUpper,
        maximumPublicity,maximumMovePoints,
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
        const state = readPlanningState(stored), owner = state.players.players.find(player => player.id === seatId);
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
        const stored = nodes.get(current), state = readPlanningState(stored);
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
      const state = readPlanningState(stored), owner = state.players.players.find(player => player.id === seatId);
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
      executeCurrent(start);
      const choices = legalActions(comp);
      if (choices.length !== spec.availableTileIds.length || choices.some(action => action.family !== "choose_target"
        || !spec.availableTileIds.includes(action.target?.tileId))) throw new Error("ANALYSIS_POST_MAIN_BORROW_CHOICES_CHANGED");
      const choice = choices.find(action => action.target.tileId === tileId), outcome = executeCurrent(choice);
      const child = finishChild(outcome.before, outcome.result, null, null, stored.informationBarrier, choice, stored);
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

    function describePostMainPlan(stored, node, allowNoExclusions = false) {
      if (node.status !== "stable" || stored.envelope.session) return null;
      const state = planningState(readCommittedState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope));
      const owner = state.players.players.find(player => player.id === seatId);
      const company = industryCatalog.getPlayerIndustryDefinition(owner);
      const quietCompany = company && ((company.activeAbilityId === "helios_remove_tech_income"
        && company.passiveIds.every(id => id === "helios_passive_reward_slots"))
        || (company.activeAbilityId === null && company.passiveIds.length === 1 && company.passiveIds[0] === "alien_lab_panels")
        || (company.activeAbilityId === "deepspace_swap_cards" && company.passiveIds.length===1&&company.passiveIds[0]==="deepspace_free_analyze")
        || (company.activeAbilityId === "turing_borrow_tech" && company.passiveIds.length===1&&company.passiveIds[0]==="turing_blue_tech_publicity"));
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
      const boundedSwap=allowNoExclusions&&resourcePlanning&&company.activeAbilityId==="deepspace_swap_cards";
      if(boundedSwap&&state.cards.publicCards.filter(Boolean).some(card=>{
        const gain=cards.getIncomeGainForCard(card),code=cards.getIncomeCodeForCard(card),key=["credits","energy","handSize"][code];
        return !["basic","space-agency"].includes(card.set)||!cards.getCatalogEntryForCard(card)||!key||!gain
          ||Object.keys(gain).length!==1||gain[key]!==1||![0,1,2].includes(cards.getDiscardActionCodeForCard(card));
      }))return null;
      if (node.legalActions.some(action => {
        if(boundedSwap&&action.family==="industry")return action.target?.abilityId!=="deepspace_swap_cards";
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
      if (!kept.some(action => action.family === "end_turn") || !allowNoExclusions && !excluded.length) return null;
      const poolCount = owner.dataState.poolTokens.length;
      if (owner.resources.availableData !== poolCount) return null;
      const occupied = data.listComputerPlacedTokens(owner).map(token => token.placementSlot);
      // At most the root-known public instances can be acquired before the
      // unknown-owned-card boundary. Grant all of them as extra data sources in
      // the bound, even when their native corner is not data or unaffordable.
      const paidPublicDataAllowance=allowNoExclusions&&resourcePlanning&&cardPickPlanning?state.cards.publicCards.filter(Boolean).length:0;
      const maximumDataCount = poolCount + dataCornerIds.size+paidPublicDataAllowance;
      const reachable = Object.keys(data.COMPUTER_DATA_SLOTS).map(Number).sort((a, b) => a - b)
        .filter(slot => !occupied.includes(slot)).slice(0, maximumDataCount);
      const incomeReachable = reachable.includes(4);
      if (incomeReachable) {
        let blindCards = 0;
        for (const card of owner.hand) {
          const code = cards.getIncomeCodeForCard(card), gain = cards.getIncomeGainForCard(card);
          const key = ["credits", "energy", "handSize"][code];
          if (!key || !gain || Object.keys(gain).length !== 1 || gain[key] !== 1) return null;
          if (code === 2 && !allowNoExclusions && (++blindCards > 1 || !dataCornerIds.has(card.id))) return null;
        }
        // 新收入改变a板公式；本版数值增益界只覆盖没有本席a板标记的窗口。
        if (state.finalScoring.tiles.a?.marks.some(mark => mark.playerId === seatId)) return null;
      }
      // In the policy bound a data corner consumes a 1V hand card for
      // at most .5V data, so it cannot increase value on its own. The legacy
      // gross bound remains unchanged for its independent normal-form callers.
      let maximumValueIncrease = allowNoExclusions?0:dataCornerIds.size * weights.availableData, additionalScore = 0;
      let publicityGain=0,freeCards=0,moneyGain=0;
      function includeBonus(bonus) {
        if (!bonus) return true;
        if (bonus.type === "income" && Object.keys(bonus).length === 1 && incomeReachable) {
          maximumValueIncrease += (allowNoExclusions?4:5) - state.turn.roundNumber;
          return true;
        }
        if (bonus.type === "choose_card" && Object.keys(bonus).length === 1) { maximumValueIncrease += 1; freeCards++; return true; }
        const weight = bonus.type === "score" ? 1 : weights[bonus.type];
        if (!["score", "credits", "energy", "publicity"].includes(bonus.type)
          || Object.keys(bonus).some(key => key !== "type" && key !== bonus.type)
          || !Number.isSafeInteger(bonus[bonus.type]) || bonus[bonus.type] < 0) return false;
        if(bonus.type==="publicity")publicityGain+=bonus.publicity;
        if(["credits","energy"].includes(bonus.type))moneyGain+=bonus[bonus.type];
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
      let allocationUpper=null;
      if(allowNoExclusions&&resourcePlanning&&cardPickPlanning){
        const candidates=[];let supported=true;
        const pureValue=bonus=>{
          if(!bonus)return 0;
          if(bonus.type==="income")return Math.max(0,4-state.turn.roundNumber);
          if(bonus.type==="choose_card"){supported=false;return 0;}
          const w=bonus.type==="score"?1:weights[bonus.type];
          if(w==null){supported=false;return 0;}return bonus[bonus.type]*w;
        };
        for(let count=0;count<=reachable.length;count++){
          const filled=reachable.slice(0,count),all=new Set([...occupied,...filled]);
          let base=0;for(const slot of filled)base+=pureValue(data.getComputerSlotBonus(slot))+pureValue(data.getComputerSlotBlueColumnBonus(owner,slot));
          const blue=[];
          for(const slot of Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number)){
            if(!data.hasBlueTechInBoardSlot(owner,slot)||data.listBlueBonusPlacedTokens(owner).some(t=>t.blueSlot===slot)
              ||!all.has(data.getRequiredComputerSlotForBlueBonus(slot)))continue;
            blue.push(pureValue(data.getBlueBonusPlacementReward(owner,slot)));
          }
          for(let mask=0;mask<(1<<blue.length);mask++){
            let blueCount=0,gain=base;for(let i=0;i<blue.length;i++)if(mask&(1<<i)){blueCount++;gain+=blue[i];}
            const spent=count+blueCount;if(spent>maximumDataCount)continue;
            // Spend existing data first (.5V), then native hand corners (1V).
            // A known public card converted to data costs at least 1.5V to
            // acquire. DeepSpace may exchange an existing hand card instead,
            // so its conservative public-data cost is only the lost 1V card.
            // Free blue card rewards decline this allocation proof above.
            const poolSpent=Math.min(spent,poolCount),extra=spent-poolSpent;
            const corners=Math.min(extra,dataCornerIds.size),publicData=extra-corners;
            const publicCost=boundedSwap?weights.handSize:1.5;
            candidates.push(gain-poolSpent*weights.availableData-corners*weights.handSize-publicData*publicCost);
          }
        }
        if(supported)allocationUpper=Math.max(0,...candidates);
      }
      if(allocationUpper!=null)maximumValueIncrease=allocationUpper;
      const thresholds = state.finalScoring.thresholds;
      if (!thresholds.length || thresholds.some(value => !Number.isSafeInteger(value) || value <= 0)) return null;
      const scoreThreshold = Math.min(...thresholds), scoreUpperBound = owner.resources.score + additionalScore;
      if (scoreUpperBound >= scoreThreshold) return null;
      const transition = previewTurn(state);
      if (!transition.turnAdvanced || transition.roundAdvanced || transition.gameEnded || !allowNoExclusions&&transition.nextPlayerId === seatId) return null;
      const maximumMovePoints=ownRockets.length?owner.resources.energy+Math.floor(owner.resources.credits/2)+owner.hand.length+freeCards+moneyGain+Number(incomeReachable):0;
      const maximumPublicity=owner.resources.publicity+owner.hand.length+freeCards+publicityGain+maximumMovePoints;
      return freeze({ maximumPublicity,maximumMovePoints,proof: allowNoExclusions?"seti-quiet-single-turn-net-resource-upper-v4":"seti-quiet-post-main-default-value-plan-v6", retainedActionIds: kept.map(action => action.actionId),
        excludedActionIds: excluded.map(action => action.actionId), maximumValueIncrease, scoreUpperBound, scoreThreshold,
        incomeReachable, retainedDataCardCount: dataCornerIds.size,
        ...(allocationUpper!=null?{dataAllocationUpper:allocationUpper,paidPublicDataAllowance,maximumDataCount,boundedSwap}:{} ) });
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
        const state = planningState(readCommittedState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope));
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
      const state = planningState(readCommittedState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope));
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
      const state = planningState(readCommittedState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope));
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
      const state = planningState(readCommittedState(stored.envelope),stored.informationBarrier,knownCards(stored.envelope));
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
      envelopeObservations = new WeakMap();valueObservations=new WeakMap(); stateRequirements = new WeakMap(); goalCatalogs = new WeakMap();
      nodes = new WeakMap();
      movementValueBounds=new WeakMap();movementBoundQueries=0;movementRuleQueries=0;movementIntentRecoveries=0;completedMovementRecoveries=0;
      observationReleasers = new WeakMap();
      normalizedIdentityStates = new Map();
      identitySubtrees.values=new WeakMap();
      movementPolicies = new WeakMap();
      movementRouteCache.clear();
      movementTimingCache.clear();
      movementTimingGroups.clear();
      movementPlanning = false;
      cardPickPlanning = false;
      resourcePlanning = false;finalMarkPlanning=false;scanPlanning=false;localSpecs=new WeakMap();
      resourceSpecs = new WeakMap();
      cardPickSpecs = new WeakMap();
      envelopeCardSpecs = new WeakMap();
      envelopeCompanyIntents = new WeakMap();
      openedRoot = null;
      identities.clear();physicalIdentityKeys.clear();
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
      incomeProofSpecs=new WeakMap();incomeProofNodes=new WeakMap();turnTailSpecs=new WeakMap();turnTailNodes=new WeakMap();
      postMainValueBounds = new WeakMap();
      postMainOptimalPlans = new WeakMap();
      resourceGroups.clear();
      cache.clear();
      clearPrefixGraph();
      rootObservation = null;knownChongDisplayIndex=null;knownRootCardIds=new Set();knownRootNebulaIds=new Set();knownRootTechIndices=new Map();knownRootAlienIds=new Set();planningStates=new WeakMap();acquiredPlanningStates=new WeakMap();envelopeKnowledge=new WeakMap();
      publicSeed = null;rootTurnKey=null;
    }

    function landingCompanyRetained(node) {
      if(!rootPublicLandingOffer)return 0;
      const stored=nodes.get(node),base=stored?.incomeProofBase||stored?.turnTailBase;
      const state=readIdentityState((base?nodes.get(base):stored).envelope),player=state.players.players.find(p=>p.id===seatId);
      // Inspect only the supplier that was visible before this window; neither
      // the replenishment identity nor any blind draw enters the tie break.
      return Number(state.turn.roundNumber===3&&player.industryRoundMarkRound!==3
        &&player.hand.some(c=>c.id===rootPublicLandingOffer&&c.blueBonusOwnerId===seatId)
        &&player.hand.some(c=>knownRootCardIds.has(c.id)&&cards.getIncomeGainForCard(c)?.handSize===1)
        &&data.listComputerPlacedTokens(player).length===3);
    }

    function deferredSectorPublicityEnabled() {
      const stored=nodes.get(openedRoot);
      if(!stored?.envelope)return false;
      const state=readIdentityState(stored.envelope),turn=state.turn;
      if(turn.roundNumber!==3||!turn.activePlayerIds?.length||turn.passedPlayerIds.includes(seatId)
        ||!turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id)))return false;
      const player=state.players.players.find(p=>p.id===seatId);
      return industryCatalog.getPlayerIndustryDefinition(player)?.activeAbilityId==="deepspace_swap_cards"
        &&player.reservedCards.some(c=>knownRootCardIds.has(c.id)&&localPlans.sectorPublicityReward(c)!==null);
    }

    function deferredSectorPublicityQuote(node) {
      if(!resourcePlanning||rootObservation?.publicState.roundNumber!==3)return null;
      if(node.status==="turn-tail-value")return node.planSummary.deferredPublicity||null;
      if(!["turn-boundary","information-barrier"].includes(node.status))return null;
      const stored=nodes.get(node);
      if(!stored?.envelope||stored.envelope.session)return null;
      const state=readIdentityState(stored.envelope),turn=state.turn;
      if(turn.currentPlayerId!==seatId||JSON.stringify([turn.roundNumber,turn.turnNumber,turn.actionCycleNumber])===rootTurnKey)return null;
      const player=state.players.players.find(p=>p.id===seatId);
      // Deep Space has a stable standard fee. The existing movement and
      // post-main value bounds exclude this company; the synthetic quiet
      // turn tail excludes ready card tasks and cannot create a sector win.
      if(industryCatalog.getPlayerIndustryDefinition(player)?.activeAbilityId!=="deepspace_swap_cards")return null;
      return localPlans.deferredSectorPublicityQuote({state,seatId,knownCards:knownRootCardIds});
    }

    function researchTransportPurpose() {
      const stored=nodes.get(openedRoot);
      if(!knownRootAlienIds.has("虫"))return null;
      const state=readPlanningState(stored),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending
        ||p.resources.credits!==0||p.resources.energy!==0||p.resources.availableData!==1||p.dataState.poolTokens.length!==1
        ||data.listComputerPlacedTokens(p).length!==5||t.cardTurnEventBonuses?.length
        ||!t.activePlayerIds.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length||!hasPostMainInertReservations(state,true,true,true)
        ||!p.hand.some(c=>knownRootCardIds.has(c.id)&&cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil")))return null;
      const probes=state.pieces.rockets.filter(r=>r.playerId===seatId&&r.surface==="solar-board");
      if(probes.length!==1)return null;
      const menu=openedRoot.legalActions,session=stored.envelope.session?.session;
      const paidChoice=session?.queue?.[0]?.type===scienceSession.EFFECT_TYPES.RESEARCH
        &&session.journal?.actions?.[0]?.action?.family==="research_tech";
      let payerIds=[];
      if(!paidChoice&&!menu.some(a=>a.family==="research_tech")){
        const plans=resourceSpec(openedRoot)?.plans||[];
        const transport=plans.find(x=>x.goal.movementFunding?.publicityPayerId)?.goal.movementFunding;
        if(transport)payerIds=[transport.cardId,transport.publicityPayerId];
        else {
          if(openedRoot.status!=="stable")return null;
          const plan=plans.find(({goal,mode})=>mode==="greedy"&&goal.kind==="research_tech"
            &&goal.required.publicity===p.resources.publicity+1&&data.getBlueTileDataBonus(goal.tileId)?.type==="credits");
          const payer=menu.find(a=>a.actionId===plan?.firstActionId&&a.family==="card_corner"
            &&a.payload.kind==="resource"&&(a.payload.multiplier??1)===1);
          const card=payer&&p.hand.find(c=>c.id===payer.target.cardInstanceId&&knownRootCardIds.has(c.id));
          const reward=card&&cards.getDiscardActionRewardForCard(card);
          if(!reward||reward.dataCount||reward.gain?.publicity!==1||Object.keys(reward.gain).length!==1)return null;
          payerIds=[card.id];
        }
      }
      return {hand:p.hand.filter(c=>!payerIds.includes(c.id)).map(c=>c.id),player:p,probeId:probes[0].id,turn:t.turnNumber};
    }

    function quoteResearchTransport(node,purpose) {
      let stored=nodes.get(node),synthetic=node.status==="turn-tail-value";
      if(synthetic){
        const tail=node.planSummary;
        if(tail.kind!=="end-turn"||tail.netGain!==0||tail.requiredNativeInputs!==1||tail.markedTiles.length)return null;
        stored=nodes.get(stored.turnTailBase);
      }else if(node.status!=="turn-boundary")return null;
      if(!stored?.envelope||stored.envelope.session||stored.intent
        ||stored.informationBarrier&&stored.informationBarrier.code!=="tech_bonus_reveal")return null;
      const state=readPlanningState(stored),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.turnNumber!==purpose.turn+Number(!synthetic)
        ||p.mainActionCompleted!==synthetic||p.passCompletionPending||p.resources.credits!==1||p.resources.energy!==0
        ||p.resources.availableData!==0||p.hand.length!==purpose.hand.length
        ||p.hand.some((c,i)=>!knownRootCardIds.has(c.id)||c.id!==purpose.hand[i])
        ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length)return null;
      const probe=state.pieces.rockets.find(r=>r.id===purpose.probeId&&r.playerId===seatId&&r.surface==="solar-board");
      // Research itself can rotate the board. Read the real post-research
      // coordinates, and do not reuse a route from the root before rotation.
      if(!probe)return null;
      const cash=data.listBlueBonusPlacedTokens(p).find(({id,blueSlot})=>{
        const reward=data.getBlueBonusPlacementReward(p,blueSlot);
        return id===purpose.player.dataState.poolTokens[0].id&&reward?.type==="credits"&&reward.credits===1
          &&!data.getBlueBonusPlacementReward(purpose.player,blueSlot);
      });
      if(!cash||data.listComputerPlacedTokens(p).length!==5)return null;
      if(synthetic){
        const next=previewTurn(state);
        if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
      }
      // The audited END changes neither probe geometry nor wallet. Price the
      // fixed paid landing from the production route directory, with no
      // speculative value from traces, card draws or the unidentified cargo.
      const future=synthetic?{...state,players:{...state.players,players:state.players.players.map(q=>q===p?{...q,mainActionCompleted:false}:q)}}:state;
      const quote=publicHeldTransport(future,probe.id,p);
      return quote&&{...quote,blueSlot:cash.blueSlot};
    }

    function publicHeldTransport(future,probeId,p) {
      const native=productionKernel||globalThis.SetiProductionKernel;
      let directory;
      const route=resourceDemand.heldLandingGoal({state:future,seatId,compareTiming:timingForOneGoalQuery(future),
        candidates:()=>directory??=(native.getProbeRouteRequirements(future,seatId)?.candidates||[])});
      if(!route?.embeddedMove||route.rocketId!==probeId||route.required.credits!==1||!route.movementCardId)return null;
      const landing=directory.find(c=>route.id.startsWith(c.requirementId+":held-transport:"));
      const score=landing?.targetBenefit.score;
      if(!Number.isSafeInteger(score))return null;
      const landData=Math.min(landing.targetBenefit.dataCount,players.RESOURCE_LIMITS.availableData);
      const movePublicity=Math.min(landing.publicityStops,players.RESOURCE_LIMITS.publicity-p.resources.publicity);
      if(![landData,movePublicity].every(v=>Number.isSafeInteger(v)&&v>=0))return null;
      const w=stateValue.DEFAULT_WEIGHTS,value=stateValue.sumValueParts([score,landData*w.availableData,movePublicity*w.publicity,-w.credits,-w.handSize,-w.handSize]);
      return value>0?{value,landingScore:score,landData,movePublicity,routeId:route.id}:null;
    }

    function fixedResearchTransportValue(source,known,probeId) {
      // Future action selection is fixed before applying any rule preview.
      const next=structuredClone(source),p=next.players.players.find(q=>q.id===seatId);
      const transition=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
      if(!transition.turnAdvanced||transition.roundAdvanced||transition.gameEnded||transition.nextPlayerId!==seatId)return null;
      p.mainActionCompleted=false;
      const actions=rocketAbilities.listPlayerMoveChoices(next,p,{maxPoints:1}).map((target,i)=>
        ({family:"move",actionId:String(i),target,payload:{requiredMovePoints:target.requiredMovePoints}}));
      const goal=transportResearchMove(next,actions,known);
      if(!goal)return null;
      const payment=goal.movementFunding;
      for(const id of [payment.cardId,payment.publicityPayerId]){
        if(!cards.discardFromHandAtIndex(p,p.hand.findIndex(c=>c.id===id)).ok)return null;
      }
      const movement=actions.find(a=>a.actionId===payment.firstMoveId);
      const moved=rocketAbilities.moveProbe(next,{...movement.target,movementPoints:1,cost:{},source:"move"});
      if(!moved.ok||p.resources.publicity!==payment.publicity+1)return null;
      players.gainResources(p,{publicity:1});
      const supply=next.tech.stacks[goal.tileId];
      if(!supply||supply.bonusHidden||supply.bonusIndex!==knownRootTechIndices.get(goal.tileId))return null;
      supply.bonusQueue=supply.bonusQueue.map((id,i)=>i===supply.bonusIndex?id:null);
      const rotated=techResolver.rotateForResearch(scienceSession.createActionContext(next,seatId),1);
      if(!rotated.ok||rotated.events.length)return null;
      const options={skipRotate:true};
      const choice=scienceSession.listResearchChoices(next,seatId,options).find(a=>a.target.tileId===goal.tileId&&a.target.blueSlot===goal.blueSlot);
      const research=choice&&scienceSession.executeResearchChoice(next,seatId,choice,options);
      if(!research?.ok||research.awaitingCardSelection||research.events.length!==1||research.events[0].type!=="researchTech"
        ||cardEffects.collectMatchingTriggers(p,research.events[0]).length)return null;
      p.mainActionCompleted=true;
      const cash=localPlans.previewBlueCompletion({state:next,seatId,goal:{id:"data:blue:"+goal.blueSlot,kind:"blue-data",blueSlot:goal.blueSlot,required:{}}});
      if(!cash.available||cash.requiredNativeInputs!==2||cash.player.resources.credits!==1||cash.player.resources.availableData!==0)return null;
      const q=cash.player;
      next.players.players=next.players.players.map(owner=>owner===p?q:owner);
      const quiet=localPlans.quietEndCompletion({state:next,seatId});
      if(!quiet.available||quiet.markedTiles.length||quiet.netGain!==0)return null;
      const advanced=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
      if(!advanced.turnAdvanced||advanced.roundAdvanced||advanced.gameEnded||advanced.nextPlayerId!==seatId)return null;
      q.mainActionCompleted=false;
      const route=publicHeldTransport(next,probeId,q);
      if(!route)return null;
      const score=endScoring.computePlayerFinalScore({...next,players:next.players.players,cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},q).totalScore;
      const w=stateValue.DEFAULT_WEIGHTS;
      const value=stateValue.sumValueParts([score,stateValue.technologyCapital(q.techState,3),Math.max(resourceDemand.planningCapital(next,q),route.value),
        ...Object.keys(w).map(k=>(q.resources[k]+q.income[k])*w[k])]);
      return {value,route,blueCashSlot:goal.blueSlot};
    }

    const transportPreparationByRoot=new WeakMap();
    function transportPreparationPurpose(){
      const root=openedRoot,stored=nodes.get(root);
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||!knownRootAlienIds.has("虫"))return null;
      if(transportPreparationByRoot.has(root))return transportPreparationByRoot.get(root);
      const purpose=computeTransportPreparationPurpose(root,stored);
      transportPreparationByRoot.set(root,purpose);
      return purpose;
    }

    function computeTransportPreparationPurpose(root,stored){
      const session=stored.envelope.session?.session,head=session?.queue?.[0];
      if(session&&(session.queue.length!==1||session.journal?.actions?.[0]?.action?.family!=="place_data"
        ||head.type!==scienceSession.EFFECT_TYPES.PLACE_DATA
          &&!(head.type===scienceSession.EFFECT_TYPES.PICK_CARD&&head.payload?.blueBonusSource)))return null;
      const state=session?.baseState||readPlanningState(stored),p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      const count=data.listComputerPlacedTokens(p).length;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||!p.mainActionCompleted||p.passCompletionPending
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))||t.cardTurnEventBonuses?.length
        ||p.resources.credits||p.resources.energy||![4,5].includes(count)||count+p.resources.availableData!==7
        ||p.resources.availableData!==p.dataState.poolTokens.length
        ||techResolver.getResearchPublicityCost(p)-p.resources.publicity!==2
        ||!p.hand.every(c=>knownRootCardIds.has(c.id))
        ||!p.hand.some(c=>cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil"))
        ||!hasPostMainInertReservations(state,true,true,true)
        ||root.legalActions.some(a=>a.family==="complete_task"))return null;
      const probes=state.pieces.rockets.filter(q=>q.playerId===seatId&&q.surface==="solar-board"&&!q.fossilId);
      if(probes.length!==1||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length)return null;
      const ready=data.listBluePlacementRequirements(p).filter(r=>data.getRequiredComputerSlotForBlueBonus(r.blueSlot)<=count
        &&data.getBlueBonusPlacementReward(p,r.blueSlot)?.type==="choose_card");
      if(ready.length!==1)return null;
      const blueSlot=ready[0].blueSlot;
      const index=state.cards.publicCards.findIndex(c=>{
        if(!c||!knownRootCardIds.has(c.id))return false;
        const reward=cards.getDiscardActionMoveRewardForCard(c);
        return !c.set?.startsWith("alien:")&&reward?.movementPoints===1&&!Object.keys(reward.gain).length;
      });
      if(index<0)return null;
      const card=state.cards.publicCards[index];
      const projected=structuredClone(state),after=projected.players.players.find(q=>q.id===seatId);
      if(count===4){
        if(head?.type===scienceSession.EFFECT_TYPES.PICK_CARD)return null;
        const comp=data.placeDataToComputer(after);
        if(!comp.ok||comp.placementSlot!==5||comp.slotBonuses?.length)return null;
      }
      const blue=data.placeDataToComputer(after,{target:"blueBonus",blueSlot});
      if(!blue.ok||blue.slotBonuses?.length!==1||blue.slotBonuses[0].type!=="choose_card"||after.resources.availableData!==1)return null;
      after.hand.push(structuredClone(card));
      after.resources.handSize=after.hand.length;
      projected.cards.publicCards[index]=null;
      projected.cards.unknownPublicSlotIndices=[...new Set([...(projected.cards.unknownPublicSlotIndices||[]),index])];
      projected.cards.drawPileCardIds=new Array(Math.max(0,projected.cards.drawPileCardIds.length-1)).fill(null);
      const quiet=localPlans.quietEndCompletion({state:projected,seatId});
      if(!quiet.available||quiet.netGain!==0||quiet.markedTiles.length)return null;
      const quote=fixedResearchTransportValue(projected,knownRootCardIds,probes[0].id);
      if(!quote)return null;
      const goal={id:"data:known-transport-payment:"+blueSlot,kind:"transport-data-prep",blueSlot,cardId:card.id,required:{}};
      const step=resourceStep(root,goal);
      if(step.kind!=="fixed")return null;
      const plan={id:goal.id,goal,operation:{},firstActionId:step.actionId,mode:"greedy",reason:step.reason};
      return {plan,quote,after,turn:t.turnNumber,probe:probes[0],rotation:state.solarSystem.rotation};
    }

    function quoteTransportPreparation(node,purpose){
      const synthetic=node.status==="turn-tail-value";
      if(synthetic){
        const tail=node.planSummary;
        if(tail.kind!=="end-turn"||tail.netGain!==0||tail.requiredNativeInputs!==1||tail.markedTiles.length)return null;
      }else if(!["turn-boundary","information-barrier"].includes(node.status))return null;
      const stored=nodes.get(synthetic?nodes.get(node).turnTailBase:node);
      if(!stored?.envelope||stored.envelope.session||stored.intent
        ||stored.informationBarrier&&!["hidden_card_reveal","own-turn-complete"].includes(stored.informationBarrier.code))return null;
      const state=readPlanningState(stored),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.turnNumber!==purpose.turn+Number(!synthetic)
        ||p.mainActionCompleted!==synthetic||JSON.stringify(p.resources)!==JSON.stringify(purpose.after.resources)
        ||JSON.stringify(p.techState)!==JSON.stringify(purpose.after.techState)
        ||p.hand.length!==purpose.after.hand.length||p.hand.some((c,i)=>c.id!==purpose.after.hand[i].id)
        ||JSON.stringify(p.dataState)!==JSON.stringify(purpose.after.dataState)
        ||JSON.stringify(state.solarSystem.rotation)!==JSON.stringify(purpose.rotation)
        ||!state.pieces.rockets.some(r=>r.id===purpose.probe.id&&r.sectorX===purpose.probe.sectorX&&r.sectorY===purpose.probe.sectorY))return null;
      return {...purpose.quote,publicPaymentCard:purpose.plan.goal.cardId,bluePickSlot:purpose.plan.goal.blueSlot};
    }

    function researchDataPurpose() {
      if(!openedRoot?.legalActions.some(a=>a.family==='research_tech'))return null;
      const state=readPlanningState(nodes.get(openedRoot));
      return localPlans.researchDataPurpose({state,seatId,knownCards:knownRootCardIds});
    }

    function quoteResearchDataPurpose(node,purpose) {
      let stored=nodes.get(node);
      if(node.status==='turn-tail-value'){
        // Only the zero-delta, no-input-change native end-turn certificate.
        if(node.planSummary.kind!=='end-turn'||node.planSummary.netGain!==0)return null;
        stored=nodes.get(stored.turnTailBase);
      }else if(!['turn-boundary','information-barrier'].includes(node.status))return null;
      if(!stored?.envelope||stored.envelope.session)return null;
      const state=readPlanningState(stored),turn=state.turn;
      if(turn.roundNumber!==3||turn.currentPlayerId!==seatId)return null;
      if(node.status!=='turn-tail-value'&&JSON.stringify([turn.roundNumber,turn.turnNumber,turn.actionCycleNumber])===rootTurnKey)return null;
      return localPlans.quoteResearchDataPurpose({state,seatId,purpose});
    }

    function lateEmptyPoolAnalysis(state){
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      return t.roundNumber===3&&p.mainActionCompleted&&p.resources.availableData===0&&p.hand.length===3
        &&p.resources.energy===0&&p.resources.credits===0&&data.listComputerPlacedTokens(p).length===6
        &&p.hand.filter(c=>{const gain=cards.getIncomeGainForCard(c);
          return gain?.energy===1&&Object.keys(gain).length===1&&!(cards.getDiscardActionRewardForCard(c)?.dataCount>0);
        }).length===1;
    }

    function previewAnalysisSwapSupply(state,envelope){
      const p=state.players.players.find(q=>q.id===seatId);
      const readyNow=!p.mainActionCompleted&&p.resources.availableData===1&&data.listComputerPlacedTokens(p).length===6;
      const emptyPool=lateEmptyPoolAnalysis(state);
      if(!emptyPool&&!readyNow&&(!p.mainActionCompleted||p.resources.availableData!==3)
        ||p.resources.credits!==0||p.resources.energy!==0||!emptyPool&&p.hand.length!==5
        ||!hasOwnVisitSource(state)||!hasPostMainInertReservations(state,true,true,true)
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze'))return null;
      if(!readyNow){
        const next=previewTurn(state);
        if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
      }
      return localPlans.previewAnalysisSwapSupply({state,seatId,knownCards:knownCards(envelope),readyNow,emptyPool,
        knownAlienDisplay:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null});
    }

    function isKnownAnalysisProducer(card){
      if(card.set!=='alien:阿米巴')return false;
      const cost=cardEffects.getCardPlayCost(card),play=cardEffects.buildPlayEffects(card);
      return cost.credits===2&&Object.keys(cost).length===1&&play.length===2
        &&play[0].type==='gain_data'&&play[0].options?.count===3&&play[1].type==='amiba_choose_symbol_reward';
    }

    function analysisPreparation(state,stored,node){
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      if(t.roundNumber!==3||!p.mainActionCompleted||p.resources.credits!==0
        ||p.resources.availableData<2||p.resources.availableData>4||stored.intent||stored.resourceControl
        ||node.legalActions.some(a=>a.family==='complete_task')
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze'))return null;
      const known=knownCards(stored.envelope),knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
      let quote=null;
      if(p.resources.energy===1){
        const purpose=localPlans.preparedRegionPurpose({state,seatId,knownCards:known});
        const knownTech=(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id));
        if(purpose)quote=localPlans.previewAnalysisPreparation({state,seatId,knownCards:known,knownTech,knownAlienDisplay,purpose});
        if(!quote&&p.hand.length===3&&p.resources.availableData>=3
          &&p.reservedCards.some(c=>known.has(c.id)&&isKnownAnalysisProducer(c))
          &&hasPostMainInertReservations(state,false,true,true)){
          const next=previewTurn(state);
          if(next.turnAdvanced&&!next.roundAdvanced&&!next.gameEnded&&next.nextPlayerId===seatId)
            quote=localPlans.previewReversedAnalysisPreparation({state,seatId,knownCards:known,knownTech,knownAlienDisplay});
        }
      }else if(p.resources.energy===0&&hasOwnVisitSource(state)&&hasPostMainInertReservations(state,true,true,true)){
        const next=previewTurn(state);
        if(next.turnAdvanced&&!next.roundAdvanced&&!next.gameEnded&&next.nextPlayerId===seatId)
          quote=localPlans.quoteLateAnalysisIncome({state,seatId,knownCards:known,knownAlienDisplay,prepare:true});
      }
      return quote?{id:'data:prepared-analysis:6',kind:'computer-prefix',targetComputerSlot:6,required:{},analysisPreparation:true}:null;
    }

    function amibaRegionPurpose() {
      const stored=nodes.get(openedRoot);
      if(!stored)return null;
      const session=stored.envelope.session?.session,source=session?.journal?.actions?.[0]?.action;
      const visible=openedRoot.observation.publicState.players.find(p=>p.playerId===seatId);
      if(visible?.industryAbilityId!=='deepspace_swap_cards')return null;
      const pending=['play_card','place_data'].includes(source?.family)&&session.baseState;
      const readyEnd=visible.credits===0&&visible.energy===1&&visible.handCount===3&&visible.availableData>=1&&visible.availableData<=3
        &&openedRoot.legalActions.some(a=>a.family==='end_turn');
      const play=openedRoot.legalActions.some(a=>a.family==='play_card');
      if(!pending&&!readyEnd&&!play)return null;
      const known=knownCards(stored.envelope),state=pending?planningState(session.baseState,stored.informationBarrier,known):readPlanningState(stored);
      return readyEnd||source?.family==='place_data'?localPlans.preparedRegionPurpose({state,seatId,knownCards:known})
        :localPlans.amibaRegionFollowup({state,seatId,knownCards:known});
    }

    function amibaRegionNeedsNativeTail(node,purpose) {
      const stored=nodes.get(node);if(!stored?.envelope)return false;
      const owner=readPlanningState(stored).players.players.find(p=>p.id===seatId);
      return owner.reservedCards.some(c=>c.id===purpose.source)&&owner.hand.some(c=>c.id===purpose.card);
    }

    function quoteAmibaRegionPurpose(node,purpose) {
      let stored=nodes.get(node);
      if(node.status==="turn-tail-value"){
        if(node.planSummary.kind!=="end-turn"||node.planSummary.netGain!==0
          ||node.planSummary.markedTiles.length||node.planSummary.deferredPublicity)return null;
        stored=nodes.get(stored.turnTailBase);
      }else if(node.status!=="turn-boundary")return null;
      if(!stored?.envelope||stored.envelope.session)return null;
      const state=readPlanningState(stored),turn=state.turn;
      if(turn.roundNumber!==3||turn.currentPlayerId!==seatId
        ||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
        ||hasOwnVisitSource(state))return null;
      if(node.status==="turn-tail-value"){
        const t=previewTurn(state);if(!t.turnAdvanced||t.roundAdvanced||t.gameEnded||t.nextPlayerId!==seatId)return null;
      }
      const owner=state.players.players.find(p=>p.id===seatId);
      if(owner.resources.credits===0&&owner.resources.energy===1&&owner.resources.availableData===1&&owner.hand.length===3
        &&owner.dataState.placedTokens.length>=6){
        const known=knownCards(stored.envelope);
        const knownTech=(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id));
        const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
        const prepared=localPlans.quotePreparedRegionAnalysis({state,seatId,knownCards:known,knownTech,knownAlienDisplay,purpose});
        if(prepared?.analysisFunding)return prepared;
      }
      return localPlans.quoteAmibaRegionFollowup({state,seatId,purpose,continueKnownSwap:(q,owner,capital)=>{
        if(owner.industryRoundMarkRound===q.turn.roundNumber||owner.hand.length<1
          ||[...owner.hand,...owner.reservedCards,...q.cards.publicCards.filter(Boolean)].some(c=>!knownCards(stored.envelope).has(c.id)))return null;
        const action={family:"industry",actionId:"known-region-deepspace-swap",target:{abilityId:"deepspace_swap_cards"}};
        const policy=cardPickPlanner.plan({state:q,seatId,status:"stable",actions:[action],knownSourceCapital:capital})?.companySwap;
        if(!policy||policy.goal.kind!=="known-portfolio-swap"||policy.discardIds.length!==1||policy.selection.blind)return null;
        const incoming=q.cards.publicCards.find(c=>c?.id===policy.selection.cardId);
        const gain=incoming&&cards.getIncomeGainForCard(incoming);
        if(!gain||Object.keys(gain).length!==1||!["credits","energy"].some(k=>gain[k]===1))return null;
        return {value:policy.goal.netGain,incoming:incoming.id,outgoing:policy.discardIds[0]};
      }});
    }

    function deferredComputerIncomeSource() {
      const stored=nodes.get(openedRoot);
      if(openedRoot?.status!=="stable"||!openedRoot.legalActions.some(a=>a.family==="end_turn"))return null;
      const state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId);
      if(!owner.mainActionCompleted||industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId!=="deepspace_swap_cards")return null;
      const purpose=localPlans.deferredComputerIncomeSource({state,seatId,knownCards:knownCards(stored.envelope)});
      return purpose&&hasPostMainInertReservations(state,false,true,true)?purpose:null;
    }

    function quoteDeferredComputerIncome(node,source) {
      let stored=nodes.get(node);
      if(node.status==="turn-tail-value"){
        if(node.planSummary.kind!=="end-turn"||node.planSummary.netGain!==0||node.planSummary.markedTiles.length
          ||node.planSummary.deferredPublicity)return null;
        stored=nodes.get(stored.turnTailBase);
      }else if(node.status!=="turn-boundary")return null;
      if(!stored?.envelope||stored.envelope.session)return null;
      const state=readPlanningState(stored);
      if(node.status==="turn-tail-value"){
        const t=previewTurn(state);
        if(!t.turnAdvanced||t.roundAdvanced||t.gameEnded||t.nextPlayerId!==seatId)return null;
      }
      if(state.tech.stacks[source.tileId]?.bonusIndex!==knownRootTechIndices.get(source.tileId)
        ||!hasPostMainInertReservations(state,false,true,true))return null;
      return localPlans.quoteDeferredComputerIncome({state,seatId,knownCards:knownCards(stored.envelope),source});
    }

    function researchScanPurpose() {
      const stored=nodes.get(openedRoot),session=stored?.envelope.session?.session;
      if(session?.journal?.actions?.[0]?.action?.family==='research_tech'&&session.baseState){
        return localPlans.researchScanPurpose({state:planningState(session.baseState,stored.informationBarrier,knownRootCardIds),seatId,knownCards:knownRootCardIds});
      }
      if(!openedRoot?.legalActions.some(a=>a.family==='research_tech'))return null;
      return localPlans.researchScanPurpose({state:readPlanningState(stored),seatId,knownCards:knownRootCardIds});
    }

    function quoteResearchScanPurpose(node,purpose) {
      let stored=nodes.get(node);
      if(node.status==='turn-tail-value'){
        if(node.planSummary.kind!=='end-turn'||node.planSummary.netGain!==0||node.planSummary.markedTiles.length)return null;
        stored=nodes.get(stored.turnTailBase);
      }else if(!['turn-boundary','information-barrier'].includes(node.status))return null;
      if(!stored?.envelope||stored.envelope.session)return null;
      const state=readPlanningState(stored),turn=state.turn;
      if(turn.roundNumber!==3||turn.currentPlayerId!==seatId||turn.passedPlayerIds.includes(seatId))return null;
      if(node.status!=='turn-tail-value'&&JSON.stringify([turn.roundNumber,turn.turnNumber,turn.actionCycleNumber])===rootTurnKey)return null;
      return localPlans.quoteResearchScanPurpose({state,seatId,purpose});
    }

    function scanTimingPurpose() {
      const stored=nodes.get(openedRoot);
      if(!stored)return null;
      const session=stored.envelope.session?.session;
      let state;
      if(session?.journal?.actions?.[0]?.action?.family==='play_card'&&session.baseState){
        state=planningState(session.baseState,stored.informationBarrier,knownRootCardIds);
      }else if(openedRoot.status==='stable'&&!session)state=readPlanningState(stored);
      else return null;
      return localPlans.scanTimingSource({state,seatId,knownCards:knownRootCardIds,trade:quickTrades.getTradeAction('cards-for-energy')});
    }
    function quoteScanTimingPurpose(node,purpose) {
      let stored=nodes.get(node);
      if(node.status==='turn-tail-value'){
        if(node.planSummary.kind!=='end-turn'||node.planSummary.netGain!==0||node.planSummary.markedTiles.length)return null;
        stored=nodes.get(stored.turnTailBase);
        const t=stored&&previewTurn(readPlanningState(stored));
        if(!t?.turnAdvanced||t.roundAdvanced||t.gameEnded||t.nextPlayerId!==seatId)return null;
      }else if(node.status!=='turn-boundary')return null;
      if(!stored?.envelope||stored.envelope.session)return null;
      const state=readPlanningState(stored);
      return localPlans.quoteScanTiming({state,seatId,knownCards:knownRootCardIds,trade:purpose.trade,
        knownTech:(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id))});
    }

    const analysisFundingQuotes=new WeakMap();
    const blueCashFundingQuotes=new WeakMap();
    function blueCashFundingSource(){
      const root=nodes.get(openedRoot),session=root?.envelope.session?.session;
      const visible=openedRoot?.observation.publicState.players.find(p=>p.playerId===seatId);
      const paid=visible?.credits===1&&visible.availableData===0&&visible.handCount===3;
      const unpaid=visible?.credits===0&&visible.availableData===1&&visible.handCount>=3&&visible.handCount<=5;
      if(visible?.energy===0&&(paid||unpaid)&&visible.dataProgress?.computerSlots.length===6){
        const source=session?.baseState?planningState(session.baseState,root.informationBarrier,knownRootCardIds):readPlanningState(root);
        const p=source.players.players.find(q=>q.id===seatId),t=source.turn;
        const qualifies=t.roundNumber===3&&(!paid||p.mainActionCompleted)&&!p.passCompletionPending&&hasOwnVisitSource(source)
          &&hasPostMainInertReservations(source,true,true,true)
          &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id));
        const held=qualifies&&p.hand.filter(c=>knownRootCardIds.has(c.id)&&localPlans.blueCashCard(c));
        if(held?.length===1)return {turn:t.turnNumber,cardId:held[0].id};
      }
    }
    function analysisFundingSource(){
      const cash=blueCashFundingSource(),standard=standardAnalysisFundingSource();
      return cash?{...standard,blueCash:cash,standard:standard||null}:standard;
    }
    function standardAnalysisFundingSource(){
      const root=nodes.get(openedRoot),session=root?.envelope.session?.session;
      const visible=openedRoot?.observation.publicState.players.find(p=>p.playerId===seatId);
      const playSource=session?.journal?.actions?.[0]?.action;
      const emptyCandidates=playSource?.family==='play_card'?[playSource]:openedRoot?.legalActions.filter(a=>a.family==='play_card');
      if(emptyCandidates?.length&&visible?.energy===0&&visible.credits<=1&&visible.availableData===0
        &&visible.dataProgress?.computerSlots.length===6){
        const source=session?.baseState?planningState(session.baseState,root.informationBarrier,knownRootCardIds):readPlanningState(root);
        const p=source.players.players.find(q=>q.id===seatId),t=source.turn;
        const knownShape=t.roundNumber===3&&!p.mainActionCompleted&&p.resources.credits===1&&p.resources.energy===0
          &&p.resources.availableData===0&&p.hand.length===3&&data.listComputerPlacedTokens(p).length===6
          &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
          &&hasOwnVisitSource(source)&&hasPostMainInertReservations(source,true,true,true);
        const play=knownShape&&p.hand.find(c=>{
          if(!knownRootCardIds.has(c.id)||!emptyCandidates.some(a=>a.target?.cardInstanceId===c.id))return false;
          const cost=cardEffects.getCardPlayCost(c),effects=cardEffects.buildPlayEffects(c);
          return cost.credits===1&&Object.keys(cost).length===1&&effects.length===2
            &&effects[0].type==='pick_card'&&effects[0].options?.count===1&&effects[1].type==='amiba_choose_symbol_reward';
        });
        if(play)return {lateElectricity:true,emptyPool:true,turn:t.turnNumber,minimumHand:3};
      }
      if(visible?.energy===0&&visible.credits===0&&visible.availableData===0&&visible.handCount===3
        &&visible.dataProgress?.computerSlots.length===6){
        const source=session?.baseState?planningState(session.baseState,root.informationBarrier,knownRootCardIds):readPlanningState(root);
        const p=source.players.players.find(q=>q.id===seatId);
        if(lateEmptyPoolAnalysis(source)&&hasOwnVisitSource(source)&&hasPostMainInertReservations(source,true,true,true)
          &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')){
          const t=previewTurn(source);
          if(t.turnAdvanced&&!t.roundAdvanced&&!t.gameEnded&&t.nextPlayerId===seatId)
            return {lateElectricity:true,emptyPool:true,turn:source.turn.turnNumber,minimumHand:3};
        }
      }
      if(visible?.energy===0&&visible.availableData===1&&visible.dataProgress?.computerSlots.length===6
        &&visible.handCount>=2&&visible.handCount<=5&&visible.credits<=1){
        const source=session?.journal?.actions?.[0]?.action;
        const payable=source?.family==='quick_trade'&&source.target?.tradeId==='cards-for-credit';
        const play=source?.family==='play_card'||openedRoot.legalActions.some(a=>a.family==='play_card');
        const trade=openedRoot.legalActions.some(a=>a.family==='quick_trade'&&a.target?.tradeId==='cards-for-credit');
        if(payable||play||trade){
          const late=session?.baseState||readPlanningState(root),p=late.players.players.find(q=>q.id===seatId),t=late.turn;
          if(!p.mainActionCompleted&&t.roundNumber===3&&hasOwnVisitSource(late)
            &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
            &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id)))
            return {lateElectricity:true,turn:t.turnNumber,minimumHand:3};
        }
      }
      if(visible?.credits===0&&visible.energy===0&&[3,4].includes(visible.availableData)&&visible.handCount===4
        &&visible.dataProgress?.computerSlots.length===4
        &&(session?.journal?.actions?.[0]?.action?.family==='research_tech'||openedRoot.legalActions.some(a=>a.family==='research_tech'))){
        const state=session?.baseState||readPlanningState(root),p=state.players.players.find(q=>q.id===seatId),t=state.turn;
        const launch=state.tech.stacks.orange1;
        if(t.roundNumber===3&&!p.mainActionCompleted&&!p.techState.ownedTiles.orange1&&launch?.remaining>0
          &&launch.bonusIndex===knownRootTechIndices.get('orange1')&&launch.bonusId==='bonus_1c'
          &&!hasOwnVisitSource(state)&&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id)))
          return {lateElectricity:true,turn:t.turnNumber,allowPool2:visible.availableData===4};
      }
      if(visible?.energy===1&&visible.credits<=2&&visible.availableData>=1&&visible.availableData<=4
        &&visible.handCount>=3&&visible.handCount<=4&&visible.dataProgress?.computerSlots.length>=4){
        const source=session?.journal?.actions?.[0]?.action;
        const state=session?.baseState?planningState(session.baseState,root.informationBarrier,knownRootCardIds):readPlanningState(root);
        const p=state.players.players.find(q=>q.id===seatId),t=state.turn,computer=data.listComputerPlacedTokens(p).length;
        if(t.roundNumber===3&&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))&&!hasOwnVisitSource(state)){
          const beforePlay=!p.mainActionCompleted&&p.resources.credits===2&&p.resources.availableData===1&&p.hand.length===4&&computer===4
            &&p.hand.some(c=>knownRootCardIds.has(c.id)&&isKnownAnalysisProducer(c)
             &&(source?.target?.cardInstanceId===c.id||openedRoot.legalActions.some(a=>a.family==='play_card'&&a.target.cardInstanceId===c.id)));
          const beforeEnd=p.mainActionCompleted&&p.resources.credits===0&&computer+p.resources.availableData===8&&p.hand.length===3
            &&p.reservedCards.some(c=>knownRootCardIds.has(c.id)&&isKnownAnalysisProducer(c));
          if(beforePlay||beforeEnd)return {turn:t.turnNumber,beforeAnalysis:true,reversePreparation:true};
        }
      }
      if(!visible||visible.credits!==0)return null;
      if(visible.energy===0&&visible.handCount>=4&&visible.handCount<=5&&visible.availableData>=1&&visible.availableData<=4
        &&(session?.journal?.actions?.[0]?.action?.family==='place_data'||openedRoot.legalActions.some(a=>a.family==='end_turn'))){
        const late=session?.baseState||readPlanningState(root),p=late.players.players.find(q=>q.id===seatId),t=late.turn;
        if(p.mainActionCompleted&&t.roundNumber===3&&hasOwnVisitSource(late)
          &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id)))
          return {lateElectricity:true,turn:t.turnNumber,allowPool2:data.listComputerPlacedTokens(p).length+p.resources.availableData===8};
      }
      if(visible.energy!==1||visible.handCount<2||visible.handCount>4)return null;
      const dataCount=visible.availableData,computerCount=visible.dataProgress?.computerSlots.length;
      const stableShape=openedRoot.status==='stable'&&!session
        &&(computerCount===6&&[1,2].includes(dataCount)||computerCount===0&&dataCount===3);
      const state=['analyze','play_card'].includes(session?.journal?.actions?.[0]?.action?.family)&&session.baseState
        ?planningState(session.baseState,root.informationBarrier,knownRootCardIds)
        :stableShape?readPlanningState(root):null;
      if(!state)return null;
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||p.resources.credits!==0||p.resources.energy!==1)return null;
      const computer=data.listComputerPlacedTokens(p).length;
      if(!p.mainActionCompleted&&p.resources.availableData===1&&p.hand.length===3&&computer===6
        &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze'))
        return {turn:t.turnNumber,beforeAnalysis:true};
      if(!p.mainActionCompleted&&p.resources.availableData===2&&p.hand.length===3&&computer===6)
        return {turn:t.turnNumber,completed:false};
      if(p.mainActionCompleted&&p.resources.availableData===3&&p.hand.length===4&&computer===0)
        return {turn:t.turnNumber,completed:true};
      if(p.mainActionCompleted&&p.resources.availableData===2&&p.hand.length===3&&computer===6
        &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze'))
        return {turn:t.turnNumber,beforeAnalysis:true,completed:true};
      return null;
    }
    function quoteBlueCashFunding(node,purpose){
      const summary=node.status==='turn-tail-value'?node.planSummary:null;
      if(summary&&(summary.markedTiles.length||summary.kind==='end-turn'&&summary.netGain!==0||summary.kind!=='end-turn'
        &&(summary.kind!=='blue-end-turn'||summary.dataPlans?.length!==1||summary.dataPlans[0].goal.id!=='data:blue:3')))return null;
      if(!summary&&node.status!=='turn-boundary')return null;
      const stored=nodes.get(summary?nodes.get(node).turnTailBase:node);
      if(!stored?.envelope||stored.envelope.session)return null;
      if(blueCashFundingQuotes.has(node))return blueCashFundingQuotes.get(node);
      let state=readPlanningState(stored);
      const p=state.players.players.find(q=>q.id===seatId);
      if(state.turn.roundNumber!==3||state.turn.currentPlayerId!==seatId
        ||state.turn.turnNumber!==(summary?purpose.turn:purpose.turn+1)
        ||p.techState.blueBoardSlots.blue1!==3||!p.techState.ownedTiles.blue1||p.techState.disabledTiles.blue1)return null;
      if(summary){
        const t=previewTurn(state);
        if(!p.mainActionCompleted||!t.turnAdvanced||t.roundAdvanced||t.gameEnded||t.nextPlayerId!==seatId)return null;
      }
      if(summary?.kind==='blue-end-turn'){
        if(p.resources.credits||p.resources.availableData!==1)return null;
        const q=localPlans.previewBlueCompletion({state,seatId,goal:summary.dataPlans[0].goal});
        if(!q.available||q.computerPlacements||q.dataCornerId||q.incomeCardId||q.player.resources.credits!==1)return null;
        state={...state,players:{...state.players,players:state.players.players.map(v=>v===p?q.player:v)}};
      }
      const quote=localPlans.quoteBlueCashAnalysis({state,seatId,knownCards:knownCards(stored.envelope),
        knownAlienDisplay:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null,cardId:purpose.cardId});
      blueCashFundingQuotes.set(node,quote);return quote;
    }

    function quoteAnalysisFunding(node,purpose){
      if(purpose.blueCash){
        const cash=quoteBlueCashFunding(node,purpose.blueCash),normal=purpose.standard&&quoteAnalysisFunding(node,purpose.standard);
        return cash&&cash.value>(normal?.value||0)?cash:normal;
      }
      if(node.status==='turn-tail-value'){
        if(node.planSummary.kind!=='end-turn'||node.planSummary.netGain!==0||node.planSummary.markedTiles.length)return null;
        return quoteAnalysisFunding(nodes.get(node).turnTailBase,purpose);
      }
      const hidden=purpose.beforeAnalysis&&node.status==='information-barrier'&&node.boundary==='hidden_card_draw';
      if(!hidden&&!['stable','turn-boundary'].includes(node.status))return null;
      const stored=nodes.get(node);
      if(!stored?.envelope||stored.envelope.session)return null;
      if(analysisFundingQuotes.has(node))return analysisFundingQuotes.get(node);
      const state=readPlanningState(stored),p=state.players.players.find(q=>q.id===seatId),known=knownCards(stored.envelope);
      let answer=null;
      const correctTurn=node.status==='stable'||hidden?state.turn.turnNumber===purpose.turn&&p.mainActionCompleted
        :state.turn.turnNumber===purpose.turn+1&&!p.mainActionCompleted;
      if(purpose.lateElectricity){
        if(!correctTurn||(purpose.emptyPool?p.resources.availableData!==0:p.resources.availableData!==1&&!(purpose.allowPool2&&p.resources.availableData===2))||data.listComputerPlacedTokens(p).length!==6)return null;
        if(node.status==='stable'){
          const t=previewTurn(state);
          if(!hasPostMainInertReservations(state,true,true,true)||!t.turnAdvanced||t.roundAdvanced||t.gameEnded||t.nextPlayerId!==seatId)return null;
        }
        const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
        const quote=localPlans.quoteLateAnalysisIncome({state,seatId,knownCards:known,knownAlienDisplay,minimumHand:purpose.minimumHand,allowThreeCorners:true,emptyPool:purpose.emptyPool});
        analysisFundingQuotes.set(node,quote);
        return quote;
      }
      const ready=purpose.beforeAnalysis?p.resources.availableData===2&&p.hand.length===3&&data.listComputerPlacedTokens(p).length===6
        :(purpose.completed||p.hand.some(c=>known.has(c.id)&&!knownRootCardIds.has(c.id)))
          &&p.resources.availableData===3&&p.hand.length===4&&data.listComputerPlacedTokens(p).length===0;
      if(correctTurn&&ready){
        const quiet=node.status==='stable'?turnTailSummary(node,'end-turn'):
          hidden&&hasPostMainInertReservations(state,false,true,true)?localPlans.quietEndCompletion({state,seatId}):null;
        const t=quiet?previewTurn(state):null;
        if(node.status==='turn-boundary'||quiet&&quiet.netGain===0&&quiet.markedTiles.length===0
          &&t.turnAdvanced&&!t.roundAdvanced&&!t.gameEnded&&t.nextPlayerId===seatId){
          const knownTech=(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id));
          const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex??null;
          answer=purpose.beforeAnalysis?localPlans.quoteReadyAnalysisFunding({state,seatId,knownCards:known,knownTech,knownAlienDisplay})
            :localPlans.quoteResearchIncomeScan({state,seatId,knownCards:known,knownTech});
        }
      }
      analysisFundingQuotes.set(node,answer);return answer;
    }
    function analysisFundingEnd(node,purpose){
      const end=node.status==='stable'&&node.legalActions.find(a=>a.family==='end_turn');
      return end&&quoteAnalysisFunding(node,purpose)?end.actionId:null;
    }

    function retainedPublicDataCard(node) {
      let stored=nodes.get(node);
      if(!resourcePlanning||rootObservation.publicState.roundNumber!==3||!stored)return null;
      if(node.status==='turn-tail-value'){
        if(node.planSummary.kind!=='end-turn'||node.planSummary.netGain!==0||node.planSummary.markedTiles.length)return null;
        stored=nodes.get(stored.turnTailBase);
      }else if(!['turn-boundary','information-barrier'].includes(node.status))return null;
      const inherited=envelopeKnowledge.get(stored?.envelope);
      if(!inherited||stored.envelope.session)return null;
      const state=readPlanningState(stored),t=state.turn,p=state.players.players.find(p=>p.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.passedPlayerIds.includes(seatId)
        ||!t.activePlayerIds?.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||p.passCompletionPending||hasOwnVisitSource(state)||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze'))return null;
      const occupied=data.listComputerPlacedTokens(p).map(token=>token.placementSlot);
      if(occupied.length<4||occupied.length>5||occupied.some((slot,i)=>slot!==i+1)
        ||p.resources.availableData<6-occupied.length)return null;
      const card=p.hand.find(c=>{
        if(!inherited.ids.has(c.id)||knownRootCardIds.has(c.id))return false;
        const reward=cards.getDiscardActionRewardForCard(c);
        return reward?.dataCount===1&&reward.gain?.score===1&&Object.keys(reward.gain).length===1;
      });
      return card?{cardId:card.id,computerPlacements:6-occupied.length,dataAvailable:p.resources.availableData}:null;
    }

    function valueObservation(node) {
      const stored=nodes.get(node);if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(stored.incomeProofBase||stored.turnTailBase)throw new Error("ANALYSIS_PLAN_PROOF_HAS_NO_SUCCESSOR_OBSERVATION");
      return node===openedRoot?node.observation:observeEnvelope(stored.envelope,stored.informationBarrier,true);
    }

    function releaseBoundaryObservation(node) {
      if (!fork || !nodes.has(node)) throw new Error("ANALYSIS_NODE_INVALID");
      if (!["other-owner","terminal","information-barrier","turn-boundary"].includes(node.status)) throw new Error("ANALYSIS_BOUNDARY_REQUIRED");
      observationReleasers.get(node)();
    }

    function getDiagnostics() {
      const picks=cardPickPlanner.getDiagnostics();
      return freeze({ cardPick:{...picks,rankingCacheHitsThisRoot:picks.rankingCacheHits-cardPickRootStats.rankingCacheHits,
        rankingCacheMissesThisRoot:picks.rankingCacheMisses-cardPickRootStats.rankingCacheMisses,rankedCardsThisRoot:picks.rankedCards-cardPickRootStats.rankedCards,
        companyIntentReusesThisRoot:picks.companyIntentReuses-cardPickRootStats.companyIntentReuses,
        companyIntentRecoveriesThisRoot:picks.companyIntentRecoveries-cardPickRootStats.companyIntentRecoveries,
        companyIntentGuardRejectsThisRoot:picks.companyIntentGuardRejects-cardPickRootStats.companyIntentGuardRejects}, goalMovementGeometryNodes, movementRouteCacheEntries: movementRouteCache.size, maxMovementRouteCacheEntries: 64, nodeCount, submissionCount, cacheHits, stableRestoreSkips, timingPrefixBuilds, timingPrefixReuses, movementTimingCacheHits, movementTimingCacheMisses, cacheEntries: cache.size,
        observationCount, observationReleases, movementTimingCacheEntries:movementTimingCache.size,maxMovementTimingCacheEntries:256, normalizedIdentityCacheEntries:normalizedIdentityStates.size, maxNormalizedIdentityCacheEntries:64, identityCount: identities.size, identityMaterializations, identitySubtreeCacheHits:identitySubtrees.hits,identitySubtreeCacheStores:identitySubtrees.stores, maxCacheEntries, sharedPrefixEdges:prefixEdges.size,sharedPrefixNodes:prefixNodes.size,sharedPrefixHits:prefixHits,
        decodedStateCacheEntries: decodedStates.size, maxDecodedStateCacheEntries, decodedStateCacheBytes, maxDecodedStateCacheBytes,
        observationCacheHits, resourceQueryHits, resourceQueryMisses, goalCatalogHits, goalCatalogMisses,movementBoundQueries,movementRuleQueries,movementIntentRecoveries,completedMovementRecoveries,
        committedDecodeCount, committedDecodeHits, committedReferenceCount,
        selectionEvidenceEntries: selectionCertificate ? 1 : 0, maxSelectionEvidenceEntries: 1,
        planEvidenceEntries: planCertificate ? 1 : 0, planPrefixEntries: planCertificate?.rows.length || 0, maxPlanPrefixEntries: 32,
        milliseconds: { ...milliseconds } });
    }

    function identity(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      return stored.identity;
    }

    function hasMovementIntent(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      return Boolean(stored.intent);
    }

    return Object.freeze({ openRoot, expand, identity, hasMovementIntent, releaseBoundaryObservation, valueObservation, landingCompanyRetained, deferredSectorPublicityEnabled, deferredSectorPublicityQuote, researchDataPurpose, quoteResearchDataPurpose, researchTransportPurpose, quoteResearchTransport, transportPreparationPurpose, quoteTransportPreparation, amibaRegionPurpose, quoteAmibaRegionPurpose, amibaRegionNeedsNativeTail, deferredComputerIncomeSource, quoteDeferredComputerIncome, researchScanPurpose, quoteResearchScanPurpose, scanTimingPurpose, quoteScanTimingPurpose, analysisFundingSource, quoteAnalysisFunding, analysisFundingEnd, retainedPublicDataCard, getResourcePrefixGraph, setDecisionPlanning, localDecisionSpec, setResourcePlanning, resourceSpec, expandResourcePlan, setCardPickPlanning, cardPickSpec, expandWithCardPick, setMovementPlanning, goalMovementSpec, expandGoalMovementPlan, selectionSpec, selectionPlans, expandSelection,
      rememberSelection, reuseSelection, rememberPlan, reusePlan, exportPlan, importPlan, knownCardMoneyOrder, postMainResourceOrder, openingResourceOrder, openingMoneyCapacity, openingPlanSpec, expandOpeningPass,
      cardTradeBound, passReserveChoiceSpec, preMainDataPlanSpec, postMainCornerChoiceSpec, postMainPlanSpec, postMainBorrowSpec, expandPostMainBorrow, standardScanValueBound, postMainValueBound,movementPlanValueBound, incomePlanSummary, incomePlanBoundary, incomePlanBase, turnTailSummary, turnTailBoundary, turnTailBase, postMainOptimalPlanSpec, expandPostMainOptimalPlan, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
