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
    common ? require("../aliens") : root.SetiAliens,
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
    common ? require("../aliens/jiuzhe") : root.SetiAlienJiuzhe,
    common ? require("../aliens/chong") : root.SetiAlienChong,
    common ? require("../effects/residual-domain-session") : root.SetiResidualDomainSession,
    common ? require("../effects/session-runtime") : root.SetiEffectSession,
    common ? require("../state/state-store").copyForkData : root.SetiStateStore.copyForkData);
  if (common) module.exports = api;
  else root.SetiAnalysisPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (ruleComposition, cardEffects, cards, industryCatalog, turnFlow, data, alienState, aliens, quickTrades, scanEffects, rocketAbilities, techResolver, probeTurnSession, techBoardState, solar, rockets, players, scienceSession, goalMovement, productionKernel, cardPickPlanningApi, resourceDemand, localPlans, stateValue, fundedMovement, endScoring, jiuzhe, chong, residualSession, effectSession, copyForkData) {
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
  const STATIC_IDENTITY_SLICES = new Set(["aliens","data","finalScoring","pieces","planets","solarSystem","tech"]);
  function forwardIdentity(envelope, status, boundary, stateOverride = null, stateCache = null, subtreeCache = null, sliceCache = null) {
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
    let unstableSubtrees=0, trackSlice=false;
    function normalize(value, key = "") {
      // Cached children must be independent of every Session prefix, including
      // a different future prefix. Shallow freezing cannot protect a child.
      if((subtreeCache||trackSlice)&&typeof value==="string"&&referenceKeys.has(key)&&/effect-session-[0-9]+:(?:effect|group):[0-9]+/.test(value))unstableSubtrees++;
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
      const before=unstableSubtrees,immutable=(subtreeCache||trackSlice)&&Object.isFrozen(value);
      if((subtreeCache||trackSlice)&&!immutable)unstableSubtrees++;
      if(subtreeCache&&immutable&&subtreeCache.values.has(value)){subtreeCache.hits++;return subtreeCache.values.get(value);}
      const result=normalizeObject(value);
      if(subtreeCache&&immutable&&unstableSubtrees===before){subtreeCache.values.set(value,result);subtreeCache.stores++;}
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
    function serializeState(state) {
      if (!sliceCache || !Object.isFrozen(source)) return JSON.stringify(normalize(state));
      const names=Object.keys(state).sort();
      if(names.some(name=>/^\d+$/.test(name))||state.schemaVersion==="seti-standard-action-v1")
        return JSON.stringify(normalize(state));
      const fields=[];
      for(const name of names){
        const value=state[name],memoizable=value&&typeof value==="object"&&STATIC_IDENTITY_SLICES.has(name)&&Object.isFrozen(value);
        let bytes=memoizable?sliceCache.values.get(value):undefined;
        if(bytes!==undefined)sliceCache.hits++;
        else{
          const before=unstableSubtrees;
          trackSlice=Boolean(memoizable);
          bytes=JSON.stringify(normalize(value,name));
          trackSlice=false;
          if(memoizable&&before===unstableSubtrees&&bytes!==undefined){sliceCache.values.set(value,bytes);sliceCache.stores++;}
        }
        if(bytes!==undefined)fields.push(JSON.stringify(name)+":"+bytes);
      }
      return "{"+fields.join(",")+"}";
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
      normalizedState=serializeState(buildState());
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
    let resourcePlanning = false, finalMarkPlanning = false, scanPlanning = false, rankKnownFossilTraces = false;
    let localSpecs=new WeakMap();
    let resourceSpecs = new WeakMap();
    const resolvedPublicAnalysis = new WeakSet();
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
    const identitySlices={values:new WeakMap(),hits:0,stores:0};
    const identitySubtrees={values:new WeakMap(),hits:0,stores:0};
    const identities = new Map(), physicalIdentityBuckets = new Map();
    let nextPhysicalIdentity=0, identityBucketCollisions=0;
    function physicalBucket(envelope,status,boundary){
      const state=readIdentityState(envelope),session=envelope.session?.session,turn=state.turn;
      // Only raw scalar fields that survive forwardIdentity are allowed.
      // A bucket hit is never accepted as equality; the full key decides it.
      return JSON.stringify([status,boundary,turn.roundNumber,turn.turnNumber,turn.currentPlayerId,
        state.meta.sequences.card,state.meta.sequences.nebulaReplacement,state.meta.sequences.rocket,
        state.match?.cardPlayContext?.lastScanNebulaId,
        state.players.players.map(p=>[p.id,p.resources.score,p.resources.credits,p.resources.energy,
          p.resources.publicity,p.resources.availableData,p.resources.handSize,p.hand.map(c=>c.id),p.reservedCards.map(c=>c.id)]),
        state.pieces.rockets.map(r=>[r.id,r.sectorX,r.sectorY,r.surface]),
        state.cards.publicCards.map(c=>c?.id),session?.queue.map(e=>[e.type,e.kind,e.ownerId])]);
    }
    function physicalCollisionKey(envelope){
      const state=readIdentityState(envelope), board=state.aliens;
      // Equal canonical states have the same occupied positions and entity
      // sequences. They are a discriminator only; compare the full key on a hit.
      const traceGrids=[board.amiba,board.chong].map(species=>[1,2].map(id=>{
        const grid=species?.traceSlotsByAlienSlotId?.[id];
        return grid&&["blue","pink","yellow"].map(color=>[1,2,3,4].map(position=>{
          const mark=grid[color]?.[position];
          return mark&&[mark.sequence,mark.playerId];
        }));
      }));
      const symbols=board.amiba?.symbolSlots;
      return JSON.stringify([
        traceGrids,symbols&&Object.keys(symbols).sort().map(key=>[key,typeof symbols[key]==="string"?symbols[key]:null]),
        [1,2].map(id=>["blue","pink","yellow"].map(color=>{
          const t=state.aliens.aliens[id]?.traces?.[color];
          return t&&[t.firstPlaced,t.ownerPlayerColor,t.neutral,t.extraCount,t.extraMarkers?.length];
        })),
        state.players.players.map(p=>[p.blueBonusResources?.credits,p.blueBonusResources?.energy]),
        data.NEBULA_IDS.map(id=>state.data.nebulae[id]?.tokens.map(t=>[t.replacementOrder,t.replacedByPlayerId])),
      ]);
    }
    function internPhysicalIdentity(stored,envelope,status,boundary){
      const key=physicalBucket(envelope,status,boundary);
      let bucket=physicalIdentityBuckets.get(key);
      if(!bucket){bucket=[];physicalIdentityBuckets.set(key,bucket);}
      else{
        identityBucketCollisions++;
        const collision=stored.collisionKey;
        let exact;
        for(const prior of bucket){
          if(prior.stored.collisionKey!==collision)continue;
          exact??=stored.physicalKey;
          if(prior.stored.physicalKey===exact)return prior.id;
        }
      }
      const id=nextPhysicalIdentity++;
      bucket.push({id,stored});
      return id;
    }
    function nodeIdentity(physicalId,intent,cardControl,resourceControl,knowledge = null) {
      const parts=[physicalId,intent,cardControl,resourceControl];
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
    let committedReferences=new WeakMap();
    let lazyCommittedEnvelopes=0,lazyPreviewSerializations=0;
    const maxDecodedStateCacheEntries = 64, maxDecodedStateCacheBytes = 8 * 1024 * 1024;
    let decodedStateCacheBytes = 0;
    let envelopeObservations = new WeakMap(), valueObservations = new WeakMap(), stateRequirements = new WeakMap(), goalCatalogs = new WeakMap();
    let observationCacheHits = 0, resourceQueryHits = 0, resourceQueryMisses = 0, goalCatalogHits = 0, goalCatalogMisses = 0;
    let committedDecodeCount = 0, committedDecodeHits = 0, committedReferenceCount = 0, committedReferenceHits=0;
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
    let submissionCount = 0, provedFinalDataPlacements = {}, provedFinalDataMenuInputs = 0;
    let quietDataMenuTemplate = null;
    const dataRewardMenuTemplates = new Map();
    let provedBlueTwoPickInputs = 0, provedComputerIncomeMenus = 0, provedCurrencyIncomeInputs = 0, provedFinalResourceCorners = 0;
    let provedChongTransportInputs=0, provedChongTraceSkips=0, provedChongTraceMenus=0;
    let chongTraceMenuTemplate=null,provedChongEndMenus=0;
    const chongEndTemplates=new Map(),chongQueuedTemplates=new Map();
    let provedChongQueuedTasks=0;
    let provedAmibaYellowLandingInputs=0,provedAlienDisplays=0,provedPinkCardMenus=0,provedQuietSpecifiedScans=0;
    let provedActiveFinalTaskInputs = 0, provedFinalEndTaskInputs = 0, provedBluePickSettlements = 0, provedResearchPicks = 0, provedResearchSelections = 0, provedEmptyAmibaResearch = 0;
    let provedPinkRefills=0,provedPinkFossilMenus=0,provedLastPlainPinkInputs=0,quietEndPreludeTemplate=null, quietEndMarkTemplate=null, provedQuietEndMenus=0, provedQuietEndHandovers=0, provedOwnEndHandovers=0;
    let provedScan4QuietMoves=0, provedScan4QuietLaunchSkips=0, provedPublicScanChoices=0;
    const scan4RefillCache=new Map();
    let scan4RefillHits=0;
    let moveMenuTemplate=null, provedMoveMenus=0, provedMovePayments=0;
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
      const saved = comp.lifecycle.save({ trustedFork: true, deferSerialization:true });
      milliseconds.checkpoint += now() - startedAt;
      if (!saved.ok) throw new Error(`ANALYSIS_SAVE_FAILED: ${saved.code || saved.message}`);
      if (saved.trustedState) {
        committedReferences.set(saved.envelope,saved.trustedState);
        committedReferenceCount++;
      }
      return saved.envelope;
    }

    function withEnvelopeSession(source,session){
      const envelope=Object.freeze({schemaVersion:source.schemaVersion,get committedState(){return source.committedState;},session});
      const state=committedReferences.get(source);
      if(state)committedReferences.set(envelope,state);
      return envelope;
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
      let physicalKey,physicalId,collisionKey,identity;
      nodes.set(node, { envelope, serial: nodeCount,
        get physicalKey(){
          if(physicalKey===undefined){physicalKey=forwardIdentity(envelope,status,boundary,readIdentityState(envelope),normalizedIdentityStates,null,identitySlices);identityMaterializations++;}
          return physicalKey;
        },
        get collisionKey(){return collisionKey??=physicalCollisionKey(envelope);},
        get physicalId(){
          if(physicalId===undefined)physicalId=internPhysicalIdentity(this,envelope,status,boundary);
          return physicalId;
        },
        get identity(){
          if(identity===undefined)identity=nodeIdentity(this.physicalId,this.intent,this.cardControl,this.resourceControl,cardKnowledgeKey(this.envelope));
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
      const captured=committedReferences.get(envelope);
      if(captured){committedReferenceHits++;return captured;}
      // External byte snapshots still decode by exact serialization.
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
      submissionCount = 0; provedQuietSpecifiedScans=0; provedPinkCardMenus=0; provedAlienDisplays=0; provedAmibaYellowLandingInputs=0; provedFinalDataPlacements = {}; provedFinalDataMenuInputs = 0; provedBlueTwoPickInputs = 0; provedComputerIncomeMenus = 0; provedCurrencyIncomeInputs = 0; provedFinalResourceCorners = 0; provedActiveFinalTaskInputs = 0; provedFinalEndTaskInputs = 0; provedBluePickSettlements = 0; provedResearchPicks = 0; provedResearchSelections = 0; provedEmptyAmibaResearch = 0;
      provedPinkRefills=0;provedPinkFossilMenus=0;provedLastPlainPinkInputs=0;quietEndPreludeTemplate=null; quietEndMarkTemplate=null; provedQuietEndMenus=0; provedQuietEndHandovers=0; provedOwnEndHandovers=0; provedScan4QuietMoves=0;provedScan4QuietLaunchSkips=0; provedPublicScanChoices=0; scan4RefillHits=0; scan4RefillCache.clear();
      moveMenuTemplate=null; provedMoveMenus=0; provedMovePayments=0;
      cacheHits = 0;stableRestoreSkips=0;movementTimingCacheHits=0;movementTimingCacheMisses=0;
      observationCount = 0; observationReleases = 0;
      committedDecodeCount = 0; committedDecodeHits = 0; committedReferenceCount = 0; committedReferenceHits=0; lazyCommittedEnvelopes=0; lazyPreviewSerializations=0;
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
      const state = readIdentityState(authoritative);
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
      knownChongDisplayIndex=offered?.target?.cardIndex??rootObservation.publicState.board.aliens.chongOffer?.displayedCardIndex??null;
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

    function quietSavedMeta(meta,stateVersion=meta.stateVersion){
      const saved={...meta,stateVersion};
      if(saved.rngState?.branch===true){saved.rngState={...saved.rngState};delete saved.rngState.branch;}
      return saved;
    }

    function quietR3AmibaOnly(state) {
      return knownRootAlienIds.size===1&&knownRootAlienIds.has("阿米巴")
        &&Object.values(state.aliens.aliens).every(slot=>slot.revealed
          ?slot.alienId==="阿米巴":!alienState.isAlienReadyToReveal(slot));
    }

    function quietR3BluePickSource(state, owner) {
      const t=state.turn;
      return t.roundNumber===3&&owner.mainActionCompleted
        &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        &&(quietR3AmibaOnly(state)||knownRootAlienIds.has("阿米巴")&&knownRootAlienIds.has("虫"))
        &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        &&data.getBlueBonusPlacementReward(owner,2)?.type==="choose_card";
    }

    // The same quiet data steps can prepare the main action after both
    // species are public. A live shipment still needs Native settlement.
    function quietR3RevealedData(state) {
      const t=state.turn;
      return t.roundNumber===3&&knownRootAlienIds.size===2&&knownRootAlienIds.has("阿米巴")&&knownRootAlienIds.has("虫")
        &&Object.values(state.aliens.aliens).every(slot=>slot.revealed&&knownRootAlienIds.has(slot.alienId))
        &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length;
    }

    function quietR3AmibaPostMain(state, owner) {
      const t=state.turn;
      return t.roundNumber===3&&owner.mainActionCompleted
        &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))&&quietR3AmibaOnly(state);
    }

    function isUnrevealedRoundThree(state) {
      return state.turn.roundNumber===3&&Object.values(state.aliens.aliens).every(slot=>
        !slot.revealed&&!alienState.isAlienReadyToReveal(slot));
    }

    // The first white turn can use the same inert placement proof. The
    // original effect, owner, payload and trigger guards still apply.
    function quietFinalRoundMark(state){
      const t=state.turn;
      return t.roundNumber===4
        &&knownRootAlienIds.has("奥陌陌")&&Object.values(state.aliens.aliens).every(slot=>!slot.revealed||knownRootAlienIds.has(slot.alienId));
    }

    function quietEarlySameSeatHandover(state) {
      const t=state.turn;
      if(!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id)))return false;
      return t.roundNumber===2&&Object.values(state.aliens.aliens).every(slot=>!slot.revealed&&!alienState.isAlienReadyToReveal(slot))
        ||t.roundNumber===3&&Object.values(state.aliens.aliens).every(slot=>slot.revealed
          ?knownRootAlienIds.has(slot.alienId):!alienState.isAlienReadyToReveal(slot));
    }

    function quietFirstTurnData(state) {
      return state.turn.roundNumber===1&&state.turn.turnNumber===1
        &&Object.values(state.aliens.aliens).every(slot=>!slot.revealed&&!alienState.isAlienReadyToReveal(slot));
    }

    function quietDataMenuSource(stored, action) {
      if (!resourcePlanning || stored.envelope.session || stored.resourceControl || action.family !== "place_data"
        || action.phase !== "quick" || action.target?.kind !== "place-data" || Object.keys(action.payload).length) return null;
      const state = readIdentityState(stored.envelope), t = state.turn, owner = state.players.players.find(p => p.id === seatId);
      // Opening a data menu has no placement or reward to settle. Its
      // witnessed session is independent of the resulting Blue 3 menu.
      if ((t.roundNumber !== 4 && !quietFirstTurnData(state) && !isUnrevealedRoundThree(state) && !quietR3RevealedData(state) && !quietR3AmibaPostMain(state,owner) && !quietEarlySameSeatHandover(state)
        && !(quietR3BluePickSource(state,owner)&&data.listEligibleBlueBonusSlots(owner).includes(2)))
        || t.currentPlayerId !== seatId || t.gameEnded || t.passedPlayerIds.includes(seatId)
        || owner.passCompletionPending || t.cardTurnEventBonuses?.length&&!quietSignalBonusesOnly(state)&&!residualSession.hasOnlyAomomoScanScoreBonus(t,seatId)
        || localPlans.hasPendingFossilArrival(state)
        || action.stateVersion !== state.meta.stateVersion || action.decisionVersion !== (state.match?.decisionVersion ?? 0)) return null;
      return state;
    }

    function rememberQuietDataMenu(action, child) {
      const checkpoint = nodes.get(child).envelope.session;
      const s = checkpoint?.session, effect = s?.queue?.[0];
      if (child.status !== "decision" || s?.phase !== "awaiting_input" || s.queue.length !== 1
        || effect.type !== scienceSession.EFFECT_TYPES.PLACE_DATA || effect.ownerId !== seatId || effect.allowQuickActions
        || s.committedState || s.failure || s.irreversibleBarrier || s.interruptContext || s.undoFrames.length
        || s.journal.actions.length !== 1 || s.journal.actions[0].action.actionId !== action.actionId
        || s.journal.replay.length !== 1 || s.journal.replay[0].kind !== "action"
        || s.journal.effects.length !== 1 || s.journal.events.length || s.journal.rng.length
        || s.journal.decisions.length || s.journal.history.length || s.journal.logs.length
        || JSON.stringify(s.baseState) !== JSON.stringify(s.workingState)) return;
      quietDataMenuTemplate = { ...checkpoint, session:{...s, baseState:null, workingState:null} };
    }

    function makeQuietDataMenu(envelope, state, action) {
      const template = quietDataMenuTemplate, s = template?.session;
      if (s?.journal.actions[0].action.actionId !== action.actionId) return null;
      const effect = s.queue[0],working=state.meta.rngState?.branch===true?{...state,meta:quietSavedMeta(state.meta)}:state;
      return withEnvelopeSession(envelope,freeze({...template, session:{...s,
        baseState:working, workingState:working, baseVersion:state.meta.stateVersion,
        queue:[{...effect, payload:{...effect.payload, action}}],
        journal:{...s.journal, actions:[{...s.journal.actions[0], action}], replay:[{...s.journal.replay[0], action}]},
      }}));
    }

    function previewDataRewardMenu(stored, action) {
      if (!resourcePlanning || stored.resourceControl || action.family !== "choose_target") return null;
      const computer=action.target?.choiceId==="data:computer"&&action.target?.target==="computer";
      const blue=action.target?.choiceId==="data:blueBonus:2"&&action.target?.target==="blueBonus"&&action.target?.blueSlot===2;
      if(!computer&&!blue)return null;
      const s = stored.envelope.session?.session, effect = s?.queue?.[0];
      if (s?.phase !== "awaiting_input" || s.queue.length !== 1 || s.interruptContext || s.irreversibleBarrier
        || effect.type !== scienceSession.EFFECT_TYPES.PLACE_DATA || effect.ownerId !== seatId || effect.allowQuickActions
        || s.journal.actions.length !== 1 || s.journal.actions[0].action.family !== "place_data"
        || s.journal.effects.length !== 1 || s.journal.events.length || s.journal.decisions.length
        || s.journal.replay.length !== 1 || s.undoFrames.length) return null;
      const state = s.workingState, t = state.turn, owner = state.players.players.find(p => p.id === seatId);
      if ((t.roundNumber !== 4 && !(computer&&(quietFirstTurnData(state)||isUnrevealedRoundThree(state)||quietR3RevealedData(state))) && !(blue&&quietR3BluePickSource(state,owner)))
        || t.currentPlayerId !== seatId || t.gameEnded || t.passedPlayerIds.includes(seatId)
        || owner.passCompletionPending || t.cardTurnEventBonuses?.length&&!residualSession.hasOnlyAomomoScanScoreBonus(t,seatId) || localPlans.hasPendingFossilArrival(state)
        || computer&&data.listComputerPlacedTokens(owner).length!==3
        || blue&&(!owner.mainActionCompleted||data.getBlueBonusPlacementReward(owner, 2)?.type!=="choose_card"
          ||!state.cards.publicCards.some(Boolean))) return null;
      const player = {...owner, resources:{...owner.resources}, dataState:copyForkData(owner.dataState),
        reservedCards:copyForkData(owner.reservedCards)};
      const placed = data.placeDataToComputer(player, blue?{target:"blueBonus",blueSlot:2}:undefined);
      const placementKind=computer?"computer":"blueBonus",bonus=computer?"income":"choose_card";
      if(!placed.ok||placed.placementKind!==placementKind||(computer?placed.placementSlot!==4:placed.blueSlot!==2)
        ||placed.slotBonuses.length!==1||placed.slotBonuses[0].type!==bonus)return null;
      const event={type:"placeData",playerId:seatId,placementKind,...(computer?{placementSlot:4}:{blueSlot:2})};
      if(cardEffects.collectMatchingTriggers(player,event).length)return null;
      const next={...state,players:{...state.players,players:state.players.players.map(p=>p===owner?player:p)}};
      const choices=computer?scienceSession.listIncomeChoices(next,seatId):scienceSession.listPickCardChoices(next);
      if(!choices.length)return null;
      return {state:next,choices,event,type:computer?scienceSession.EFFECT_TYPES.INCOME:scienceSession.EFFECT_TYPES.PICK_CARD};
    }

    function rememberDataRewardMenu(stored, action, preview, child) {
      const before = stored.envelope.session.session, next = nodes.get(child).envelope.session?.session;
      const q = next?.queue?.[0], j = next?.journal;
      if (child.status !== "decision" || next?.phase !== "awaiting_input" || next.queue.length !== 1
        || q.type !== preview.type || q.ownerId !== seatId || q.allowQuickActions
        || (preview.type===scienceSession.EFFECT_TYPES.PICK_CARD?q.payload?.blueBonusSource!==true:Object.keys(q.payload).length!==0)
        || next.failure || next.irreversibleBarrier || next.undoFrames.length
        || j.effects.length !== 2 || j.events.length !== 1 || j.decisions.length !== 1 || j.replay.length !== 2
        || j.decisions[0].choice.actionId!==action.actionId || JSON.stringify(preview.state)!==JSON.stringify(next.workingState)
        || JSON.stringify(preview.event)!==JSON.stringify(j.events[0]))return;
      dataRewardMenuTemplates.set(preview.type,{sessionId:before.sessionId,revision:before.revision,
        effectSeq:before.nextEffectSequence,groupSeq:before.nextGroupSequence,
        nextRevision:next.revision,nextEffectSeq:next.nextEffectSequence,nextGroupSeq:next.nextGroupSequence,
        queue:q,effect:j.effects[1],event:j.events[0]});
    }

    function makeDataRewardMenu(envelope, action, preview) {
      const s=envelope.session.session,template=dataRewardMenuTemplates.get(preview.type);
      if (!template || s.revision !== template.revision || s.nextEffectSequence !== template.effectSeq
        || s.nextGroupSequence !== template.groupSeq) return null;
      const rebase = id => id == null ? id : s.sessionId + id.slice(template.sessionId.length);
      const remap = entry => Object.fromEntries(Object.entries(entry).map(([key,value]) => (
        [key, ["effectId", "groupId", "parentEffectId"].includes(key) ? rebase(value) : value]
      )));
      const q = {...remap(template.queue), source:remap(template.queue.source)};
      const decision = {decisionId:s.queue[0].effectId, decisionVersion:s.revision, ownerId:seatId, choice:action};
      return withEnvelopeSession(envelope,freeze({...envelope.session, replayCursor:2, session:{...s, workingState:preview.state, queue:[q],
        revision:template.nextRevision, nextEffectSequence:template.nextEffectSeq, nextGroupSequence:template.nextGroupSeq,
        journal:{...s.journal, effects:[...s.journal.effects, remap(template.effect)], events:[remap(template.event)],
          decisions:[decision], replay:[...s.journal.replay, {cursor:1,kind:"decision",confirmed:true,...decision}]},
      }}));
    }

    // A completed computer placement grants the same known currency
    // income on each distinct state. Reuse the rule operations, not a
    // settled wallet from a different branch.
    function previewCurrencyIncome(stored,action){
      if(!resourcePlanning||stored.resourceControl||action.family!=="choose_card")return null;
      const s=stored.envelope.session?.session,head=s?.queue?.[0];
      if(s?.phase!=="awaiting_input"||s.queue.length!==1||head?.type!==scienceSession.EFFECT_TYPES.INCOME
        ||head.ownerId!==seatId||head.allowQuickActions||Object.keys(head.payload).length
        ||s.interruptContext||s.irreversibleBarrier||s.failure||s.undoFrames.length
        ||s.journal.actions[0]?.action.family!=="place_data"||s.journal.events.length!==1
        ||s.journal.events[0].type!=="placeData"||s.journal.events[0].placementSlot!==4)return null;
      const state=s.workingState,t=state.turn,p=state.players.players.find(p=>p.id===seatId);
      const id=action.target?.cardInstanceId,ix=p.hand.findIndex(c=>c.id===id),card=p.hand[ix],known=knownCards(stored.envelope);
      if((t.roundNumber!==4&&!isUnrevealedRoundThree(state)&&!quietR3RevealedData(state))||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length&&!residualSession.hasOnlyAomomoScanScoreBonus(t,seatId)||state.meta.stateVersion!==s.baseVersion||localPlans.hasPendingFossilArrival(state)
        ||!card||!known.has(id)||action.target.choiceId!==`income:${id}`
        ||p.reservedCards.some(c=>!known.has(c.id)))return null;
      const gain=cards.getIncomeGainForCard(card),keys=Object.keys(gain||{});
      if(keys.length!==1||!["credits","energy","publicity"].includes(keys[0])||gain[keys[0]]!==1)return null;
      const player={...p,hand:[...p.hand],income:{...p.income},resources:{...p.resources},reservedCards:copyForkData(p.reservedCards)};
      if(cardEffects.collectMatchingTriggers(player,{type:"place_data_income",playerId:seatId,cardInstanceId:id}).length)return null;
      const deck={...state.cards,removedFromGameCardIds:[...state.cards.removedFromGameCardIds],drawPileCardIds:[...state.cards.drawPileCardIds]};
      const result=cards.discardFromHandAtIndex(player,ix);
      if(!result.ok)throw Error("ANALYSIS_FIXED_INCOME_CARD_MISSING");
      cards.addRemovedFromGame(deck,result.card);
      players.gainIncome(player,gain);
      const meta=quietSavedMeta(state.meta,s.baseVersion+1);
      return {...state,cards:deck,meta,players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
    }

    function previewQuietFinalDataPlacement(stored, action) {
      const computer = action.target?.choiceId === "data:computer" && action.target?.target === "computer";
      const blueSlot = action.target?.target === "blueBonus" && [1, 2, 3].includes(action.target?.blueSlot)
        && action.target.choiceId === `data:blueBonus:${action.target.blueSlot}` ? action.target.blueSlot : null;
      if (action.family !== "choose_target" || !computer && !blueSlot) return null;
      const session = stored.envelope.session?.session, effect = session?.queue?.[0];
      if (!resourcePlanning || stored.resourceControl || !session || session.phase !== "awaiting_input"
        || session.queue.length !== 1 || session.interruptContext || session.irreversibleBarrier
        || effect.type !== scienceSession.EFFECT_TYPES.PLACE_DATA || effect.ownerId !== seatId || effect.allowQuickActions
        || session.journal?.actions?.[0]?.action?.family !== "place_data") return null;
      const state = session.workingState, t = state.turn, owner = state.players.players.find(p => p.id === seatId);
      if ((t.roundNumber !== 4 && !(computer&&quietFirstTurnData(state)) && !isUnrevealedRoundThree(state) && !quietR3RevealedData(state) && !quietR3AmibaPostMain(state,owner) && !quietEarlySameSeatHandover(state)) || t.currentPlayerId !== seatId || t.gameEnded || t.passedPlayerIds.includes(seatId)
        || owner.passCompletionPending || t.cardTurnEventBonuses?.length&&!quietSignalBonusesOnly(state)&&!residualSession.hasOnlyAomomoScanScoreBonus(t,seatId)
        || localPlans.hasPendingFossilArrival(state)
        || owner.reservedCards.some(c=>!knownCards(stored.envelope).has(c.id))
        || owner.resources.availableData !== owner.dataState.poolTokens.length
        || state.meta.stateVersion !== session.baseVersion) return null;
      const player = {...owner, resources:{...owner.resources}, dataState:copyForkData(owner.dataState),
        reservedCards:copyForkData(owner.reservedCards), scoreSources:{...owner.scoreSources}};
      const placement = data.placeDataToComputer(player, blueSlot ? {target:"blueBonus", blueSlot} : undefined);
      const placementKind = computer ? "computer" : "blueBonus";
      if (!placement.ok || placement.placementKind !== placementKind || blueSlot&&placement.blueSlot!==blueSlot) return null;
      const slot=computer?{placementSlot:placement.placementSlot}:{blueSlot};
      const events=[{type:"placeData",playerId:seatId,placementKind,...slot}];
      for(const bonus of placement.slotBonuses){
        const resource=bonus.type;
        if(!["credits","energy","publicity","score"].includes(resource)
          ||!Number.isSafeInteger(bonus[resource])||bonus[resource]<=0
          ||Object.keys(bonus).some(k=>k!=="type"&&k!==resource))return null;
        const gain={[resource]:bonus[resource]};
        players.gainResources(player,gain,"blueTechScore");
        events.push({type:"science_resource_bonus",playerId:seatId,gain,sourceKey:"blueTechScore"});
      }
      if (events.some(event => cardEffects.collectMatchingTriggers(player, event).length)) return null;
      const meta=quietSavedMeta(state.meta,session.baseVersion+1);
      return {kind:computer ? `computer${placement.placementSlot}` : `blue${blueSlot}:${placement.slotBonuses.map(b=>b.type).join("+")}`, state:{...state, meta,
        players:{...state.players, players:state.players.players.map(p => p === owner ? player : p)}}};
    }

    const quietEndMarkQueue=["alien:turn_end_neutral_milestone","alien:turn_end_reveal","company:turn_end","card_trigger:turn_end"];
    function quietEndMarkTail(queue,state){
      if(queue.length!==6||queue.some(e=>e.ownerId!==seatId||e.allowQuickActions))return false;
      const [mark,...tail]=queue,end=tail.pop(),t=state.turn;
      const boundary=data=>data?.roundNumber===t.roundNumber&&data?.turnNumber===t.turnNumber&&data?.didPass===false;
      return mark.type==="residual_final_mark"&&mark.kind==="decision"&&!Object.keys(mark.payload).length
        &&end.type==="probe_turn_advance"&&end.kind==="effect"&&boundary(end.payload)
        &&tail.every((e,i)=>e.type==="game_domain_handoff"&&e.kind==="effect"
          &&e.payload.domain+":"+e.payload.effectType===quietEndMarkQueue[i]&&boundary(e.payload.data));
    }

    function rememberQuietEndMark(action,child,state){
      const cp=nodes.get(child).envelope.session,s=cp?.session,j=s?.journal;
      if(child.status!=="decision"||s?.phase!=="awaiting_input"||s.revision!==2||s.interruptContext||s.irreversibleBarrier
        ||s.failure||s.undoFrames.length||!quietEndMarkTail(s.queue,state)||j.actions.length!==1
        ||j.actions[0].action.actionId!==action.actionId||j.replay.length!==1||j.effects.length!==2||j.decisions.length
        ||j.rng.length||j.logs.length||j.history.length!==1||j.events.length!==2
        ||j.events[0].type!=="end_turn_handoffs_started"||j.events[1].type!=="final_milestone_pending"
        ||JSON.stringify(s.baseState)!==JSON.stringify(s.workingState))return;
      quietEndMarkTemplate={...cp,session:{...s,baseState:null,workingState:null}};
    }

    function makeQuietEndMark(stored,action,state){
      const template=quietEndMarkTemplate,s=template?.session;
      if(s?.journal.actions[0].action.actionId!==action.actionId)return null;
      const choices=residualSession.listFinalMarkChoices({...state,finalScoring:copyForkData(state.finalScoring)},seatId);
      if(!choices.length)return null;
      const working=state.meta.rngState?.branch===true?{...state,meta:quietSavedMeta(state.meta)}:state;
      const session=freeze({...template,session:{...s,baseState:working,workingState:working,baseVersion:state.meta.stateVersion,
        journal:{...s.journal,actions:[{...s.journal.actions[0],action}],replay:[{...s.journal.replay[0],action}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function rememberQuietEndPrelude(action,child,preview){
      const checkpoint=nodes.get(child).envelope.session,s=checkpoint?.session,j=s?.journal;
      if(child.status!=="decision"||s?.phase!=="awaiting_input"||s.queue.length!==2||s.interruptContext
        ||s.irreversibleBarrier||s.failure||s.undoFrames.length||s.queue[0].type!=="residual_card_decision"
        ||s.queue[0].ownerId!==seatId||s.queue[0].payload?.cardInstanceId!==preview.task.cardInstanceId
        ||s.queue[0].payload?.ruleId!==preview.task.ruleId||s.queue[1].type!=="probe_turn_advance"
        ||s.queue[1].ownerId!==seatId||s.queue[1].payload?.didPass!==false||j.actions.length!==1
        ||j.actions[0].action.actionId!==action.actionId||j.replay.length!==1||j.replay[0].kind!=="action"
        ||j.effects.length!==6||j.decisions.length||j.rng.length||j.logs.length||j.history.length!==1
        ||j.events.length!==1||j.events[0].type!=="end_turn_handoffs_started"
        ||JSON.stringify(s.baseState)!==JSON.stringify(s.workingState))return;
      quietEndPreludeTemplate={...checkpoint,session:{...s,baseState:null,workingState:null}};
    }

    function makeQuietEndPrelude(envelope, action, preview){
      const template=quietEndPreludeTemplate,s=template?.session;
      if(s?.journal.actions[0].action.actionId!==action.actionId)return null;
      const [head,advance]=s.queue,{source,working,task}=preview;
      const prepared={...head,payload:task};
      const choices=localPlans.finalEndTaskChoices(working,prepared);
      if(choices.length!==2)return null;
      const session=freeze({...template,session:{...s,baseState:working,workingState:working,baseVersion:source.meta.stateVersion,
        queue:[prepared,{...advance,payload:{roundNumber:source.turn.roundNumber,turnNumber:source.turn.turnNumber,didPass:false}}],
        journal:{...s.journal,actions:[{...s.journal.actions[0],action}],replay:[{...s.journal.replay[0],action}]}}});
      return {envelope:withEnvelopeSession(envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function chongQueuedKey(stored,preview){
      const s=stored.envelope.session.session;
      return JSON.stringify([s.queue[0].payload.ruleId,s.revision,s.nextEffectSequence,s.nextGroupSequence,
        s.journal.replay.length,Boolean(preview.opensFossils)]);
    }

    function rememberChongQueuedTask(stored,action,child,preview){
      const prior=stored.envelope.session.session,before=prior.journal,head=prior.queue[0];
      const after=nodes.get(child).envelope.session?.session,j=after?.journal;
      if(child.status!=="decision"||after?.phase!=="awaiting_input"||after.interruptContext||after.irreversibleBarrier
        ||after.failure||after.undoFrames.length||after.queue.length!==2||after.revision!==prior.revision+1
        ||j.actions.length!==before.actions.length||j.history.length!==before.history.length||j.rng.length!==before.rng.length
        ||j.logs.length!==before.logs.length||j.effects.length!==before.effects.length+1||j.events.length!==before.events.length+1
        ||j.decisions.length!==before.decisions.length+1||j.replay.length!==before.replay.length+1
        ||j.decisions.at(-1).choice.actionId!==action.actionId||JSON.stringify(j.events.at(-1))!==JSON.stringify(preview.event)
        ||JSON.stringify(after.workingState)!==JSON.stringify(preview.working))return;
      const opened=preview.opensFossils?after.queue[0]:null;
      if(opened&&(opened.type!=="residual_chong_task_fossil"||opened.ownerId!==seatId||opened.allowQuickActions
        ||Object.keys(opened.payload).length||opened.source?.parentEffectId!==head.effectId))return;
      if(JSON.stringify(opened?after.queue.slice(1):after.queue)!==JSON.stringify(prior.queue.slice(1)))return;
      chongQueuedTemplates.set(chongQueuedKey(stored,preview),{sessionId:prior.sessionId,effect:j.effects.at(-1),opened,
        effectDelta:after.nextEffectSequence-prior.nextEffectSequence,groupDelta:after.nextGroupSequence-prior.nextGroupSequence});
    }

    function makeChongQueuedTask(stored,action,preview){
      const template=chongQueuedTemplates.get(chongQueuedKey(stored,preview));
      if(!template)return null;
      const envelope=stored.envelope.session,s=envelope.session,j=s.journal,head=s.queue[0],queue=s.queue.slice(1);
      if(template.opened){
        const rebase=id=>s.sessionId+id.slice(template.sessionId.length),f=template.opened;
        queue.unshift({...f,effectId:rebase(f.effectId),groupId:rebase(f.groupId),source:{...f.source,parentEffectId:head.effectId}});
      }
      const choices=template.opened?localPlans.chongTaskFossilChoices(preview.working,queue[0])
        :localPlans.finalEndTaskChoices(preview.working,queue[0]);
      if(!choices.length)return null;
      const decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      const session=freeze({...envelope,replayCursor:j.replay.length+1,session:{...s,workingState:preview.working,queue,
        revision:s.revision+1,nextEffectSequence:s.nextEffectSequence+template.effectDelta,nextGroupSequence:s.nextGroupSequence+template.groupDelta,
        journal:{...j,effects:[...j.effects,{...template.effect,effectId:head.effectId,groupId:head.groupId,groupKind:head.groupKind,type:head.type,revision:s.revision+1}],
          events:[...j.events,preview.event],decisions:[...j.decisions,decision],replay:[...j.replay,{cursor:j.replay.length,kind:"decision",confirmed:true,...decision}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function rememberChongEndMenu(action,child,preview){
      const checkpoint=nodes.get(child).envelope.session,s=checkpoint?.session,j=s?.journal;
      if(child.status!=="decision"||s?.phase!=="awaiting_input"||s.interruptContext||s.irreversibleBarrier
        ||s.failure||s.undoFrames.length||s.queue.length!==preview.settlements.length+1
        ||j.actions.length!==1||j.actions[0].action.actionId!==action.actionId||j.replay.length!==1||j.replay[0].kind!=="action"
        ||j.effects.length!==6||j.decisions.length||j.rng.length||j.logs.length||j.history.length!==1
        ||j.events.length!==1||j.events[0].type!=="end_turn_handoffs_started"
        ||JSON.stringify(s.workingState)!==JSON.stringify(preview.working)||JSON.stringify(s.baseState)!==JSON.stringify(s.workingState))return;
      const advance=s.queue.at(-1);
      if(advance.type!=="probe_turn_advance"||advance.ownerId!==seatId||advance.payload?.didPass!==false
        ||!preview.settlements.every((task,i)=>s.queue[i].type==="residual_card_decision"&&s.queue[i].ownerId===seatId
          &&!s.queue[i].allowQuickActions&&JSON.stringify(s.queue[i].payload)===JSON.stringify(task)))return;
      chongEndTemplates.set(preview.shape,{...checkpoint,session:{...s,baseState:null,workingState:null}});
    }

    function makeChongEndMenu(stored,action,preview){
      const template=chongEndTemplates.get(preview.shape),s=template?.session;
      if(!s)return null;
      const {source,working,settlements}=preview,j=s.journal;
      const queue=settlements.map((task,i)=>({...s.queue[i],payload:task}));
      queue.push({...s.queue.at(-1),payload:{roundNumber:source.turn.roundNumber,turnNumber:source.turn.turnNumber,didPass:false}});
      const choices=localPlans.finalEndTaskChoices(working,queue[0]);
      if(choices.length!==2)return null;
      const session=freeze({...template,session:{...s,baseVersion:source.meta.stateVersion,baseState:working,workingState:working,queue,
        journal:{...j,actions:[{...j.actions[0],action}],replay:[{...j.replay[0],action}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function rememberChongTraceMenu(action,child,preview){
      const checkpoint=nodes.get(child).envelope.session,s=checkpoint?.session,j=s?.journal,head=s?.queue?.[0];
      if(child.status!=="decision"||s?.phase!=="awaiting_input"||s.queue.length!==1||s.interruptContext||s.irreversibleBarrier
        ||s.failure||s.undoFrames.length||head.type!=="residual_chong_task_fossil"||head.ownerId!==seatId
        ||head.kind!=="decision"||head.allowQuickActions||Object.keys(head.payload).length
        ||j.actions.length!==1||j.actions[0].action.actionId!==action.actionId||j.effects.length!==1
        ||j.replay.length!==1||j.decisions.length||j.events.length!==1||j.events[0].type!=="complete_task"
        ||j.history.length!==1||j.history[0].type!=="complete_task"||j.rng.length||j.logs.length
        ||JSON.stringify(s.workingState)!==JSON.stringify(preview.working)
        ||JSON.stringify(s.baseState)!==JSON.stringify(s.workingState))return;
      chongTraceMenuTemplate={...checkpoint,session:{...s,baseState:null,workingState:null}};
    }

    function makeChongTraceMenu(stored,action,preview){
      const template=chongTraceMenuTemplate,s=template?.session;
      if(!s)return null;
      const {source,working,event}=preview,j=s.journal;
      const choices=localPlans.chongTaskFossilChoices(working,s.queue[0]);
      if(!choices.length)return null;
      const session=freeze({...template,session:{...s,baseVersion:source.meta.stateVersion,baseState:working,workingState:working,
        journal:{...j,actions:[{...j.actions[0],action}],replay:[{...j.replay[0],action}],events:[event],
          history:[{...j.history[0],...event}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function quietSignalBonusesOnly(state){
      return state.turn.roundNumber===3&&(state.turn.cardTurnEventBonuses||[]).every(bonus=>
        bonus.eventType==="signalMarked"&&["b28-yellow-signal-bonus","b132-blue-signal-score"].includes(bonus.id));
    }

    function quietPaidMoveSource(stored,action,allowQuietR3=false){
      // These reveals can keep their original mask while a known probe moves.
      // Payment still rejects any card that was not known at the root.
      const barrier=stored.informationBarrier;
      if(!resourcePlanning||!movementPlanning||stored.resourceControl
        ||barrier&&!["hidden_card_reveal","tech_bonus_reveal"].includes(barrier.code)
        ||action?.family!=="move"||action.phase!=="quick"||![1,2].includes(action.payload?.requiredMovePoints))return null;
      const state=readIdentityState(stored.envelope),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      const tasks=state.aliens.chong?.transportTasksByRocketId||{};
      // The same ordinary payment is quiet before either alien can reveal.
      const quietThirdRound=allowQuietR3&&isUnrevealedRoundThree(state)&&!Object.keys(tasks).length;
      if((t.roundNumber!==4&&!quietThirdRound)||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending
        ||t.passedPlayerIds.includes(seatId)||t.cardTurnEventBonuses?.length&&!quietSignalBonusesOnly(state)||t.type1TriggerEvents?.length
        ||!state.pieces.rockets.some(r=>r.id===action.target.rocketId&&r.playerId===seatId&&(r.kind||"standard")==="standard")
        ||p.reservedCards.some(c=>!knownCards(stored.envelope).has(c.id)))return null;
      const stationaryCargo=Object.values(tasks).some(job=>!job.delivered);
      // A standard probe does not move the fossil. Keep native settlement
      // when there is already an arrival to record or the moved ID is bound.
      if(stationaryCargo&&(tasks[String(action.target.rocketId)]||localPlans.hasPendingFossilArrival(state)))return null;
      return {state,player:p,stationaryCargo};
    }

    function rememberMoveMenu(child,action){
      const checkpoint=nodes.get(child).envelope.session,s=checkpoint?.session,j=s?.journal,e=s?.queue[0];
      if(child.status!=="decision"||s?.phase!=="awaiting_input"||s.queue.length!==1||s.interruptContext
        ||s.irreversibleBarrier||s.failure||s.undoFrames.length||e.type!==probeTurnSession.EFFECT_TYPES.MOVE_PAYMENT
        ||e.ownerId!==seatId||e.allowQuickActions||j.actions.length!==1||j.actions[0].action.actionId!==action.actionId
        ||j.effects.length!==1||j.replay.length!==1||j.decisions.length||j.events.length!==1
        ||j.events[0].type!=="move_payment_requested"||j.rng.length||j.logs.length||j.history.length!==1
        ||JSON.stringify(s.baseState)!==JSON.stringify(s.workingState))return;
      moveMenuTemplate={...checkpoint,session:{...s,baseState:null,workingState:null}};
    }

    function makeMoveMenu(stored,action,state){
      const s=moveMenuTemplate?.session;
      if(!s)return null;
      const e=s.queue[0],head={...e,payload:{action}};
      const choices=probeTurnSession.getMovePaymentChoices(state,head);
      if(!choices.length)return null;
      const j=s.journal;
      const session=freeze({...moveMenuTemplate,session:{...s,baseState:state,workingState:state,baseVersion:state.meta.stateVersion,
        queue:[head],journal:{...j,actions:[{...j.actions[0],action}],replay:[{...j.replay[0],action}],
          events:[{...j.events[0],rocketId:action.target.rocketId}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function previewQuietMovePayment(stored,action){
      const s=stored.envelope.session?.session,e=s?.queue[0],origin=e?.payload?.action;
      if(action.family!=="choose_payment"||s?.phase!=="awaiting_input"||s.queue.length!==1||s.interruptContext
        ||s.irreversibleBarrier||s.failure||s.undoFrames.length||e.type!==probeTurnSession.EFFECT_TYPES.MOVE_PAYMENT
        ||e.ownerId!==seatId||e.allowQuickActions||s.journal.actions[0]?.action?.family!=="move")return null;
      const source=quietPaidMoveSource(stored,origin,true);
      if(!source)return null;
      const {state,player:p,stationaryCargo}=source,ship=state.pieces.rockets.find(r=>r.id===origin.target.rocketId);
      const known=knownCards(stored.envelope);
      if(action.target?.cardIds?.some(id=>!known.has(id)))return null;
      const player={...p,resources:{...p.resources},blueBonusResources:{...p.blueBonusResources},
        hand:[...p.hand],reservedCards:structuredClone(p.reservedCards)};
      const next={...state,meta:{...state.meta,stateVersion:s.baseVersion+1},
        cards:{...state.cards,discardPile:[...state.cards.discardPile]},
        pieces:{...state.pieces,rockets:state.pieces.rockets.map(r=>r===ship?{...r}:r)},
        players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
      const moved=probeTurnSession.settleMovePayment(next,seatId,origin,action);
      if(!moved.ok||stationaryCargo&&moved.events.some(event=>event.type!=="move")
        ||moved.events.some(event=>event.type==="signalMarked"||cardEffects.collectMatchingTriggers(player,event).length))return null;
      return next;
    }

    function refillQuietScan4(state,missing){
      const {cards:deck,players:owners,meta}=state;
      const claimed=cards.collectClaimedCardIds(deck,owners);
      const slots=deck.publicCards.map((card,i)=>card?null:i).filter(i=>i!==null);
      // Deck sanitization only consults whether a pile entry is already
      // claimed. Its order, empty slots and the entity counter stay exact.
      const key=JSON.stringify([meta.sequences.card,slots,deck.drawPileCardIds,
        deck.drawPileCardIds.filter(id=>claimed.has(String(id)))]);
      const cached=scan4RefillCache.get(key);
      if(cached){
        scan4RefillHits++;
        for(let i=0;i<slots.length;i++)deck.publicCards[slots[i]]=cached.cards[i];
        deck.drawPileCardIds=cached.pile;
        meta.sequences.card=cached.nextCard;
        return true;
      }
      let random=false,filled=0;
      for(const i of slots){
        if(cards.replenishPublicSlot(deck,owners,i,()=>{random=true;return 0;},{root:state}))filled++;
      }
      if(random||filled!==missing)return false;
      if(scan4RefillCache.size<32)scan4RefillCache.set(key,freeze({
        cards:slots.map(i=>deck.publicCards[i]),pile:deck.drawPileCardIds,nextCard:meta.sequences.card,
      }));
      return true;
    }

    function quietMercuryScanStep(effect){
      const options=effect?.payload?.options;
      return effect?.type===scienceSession.EFFECT_TYPES.SCAN_STEP&&effect.kind==="effect"
        &&Object.keys(effect.payload).length===1&&options?.mode==="specified"&&options.gainData===true
        &&Number.isSafeInteger(options.sectorX)&&options.skippable===true&&options.label==="水星扇区扫描"
        &&options.cost?.publicity===1&&Object.keys(options.cost).length===1
        &&Object.keys(options).every(k=>["mode","sectorX","gainData","cost","label","skippable"].includes(k));
    }

    function quietFossilOffer(state,effect,session,known){
      const card=effect.payload?.cardEffect,id=effect.payload?.cardInstanceId;
      if(effect.type!=="card_play_domain_effect:effect:chong_pickup_fossil"||effect.kind!=="effect"
        ||effect.ownerId!==seatId||effect.allowQuickActions||card?.type!=="chong_pickup_fossil"
        ||!known.has(id)||session.journal.actions[0]?.action.target?.cardInstanceId!==id)return null;
      const actor=state.players.players.find(p=>p.id===seatId),picks=chong.listPickupChoices(state,card,actor);
      if(!picks.length)return null;
      const descriptor={effectId:card.id||null,effectType:card.type};
      return {picks,result:{ok:true,spawnedEffects:[{effect:{type:"card_play_domain_effect:decision:chong_pickup_fossil",kind:"decision",
        decisionKind:"choose_target",ownerId:seatId,payload:effect.payload}}],
        events:[{type:"card_effect",...descriptor,playerId:seatId,awaitingDecision:true,legalChoiceCount:picks.length}],
        history:[{type:"card_effect",...descriptor,executorId:"card_play:executor:v1"}]}};
    }

    function previewQuietSpecifiedScan(node,stored,action){
      if(!resourcePlanning||!scanPlanning||node.status!=="decision"||action.family!=="choose_target")return null;
      const checkpoint=stored.envelope.session,s=checkpoint?.session,types=scienceSession.EFFECT_TYPES;
      const [head,finalize]=s?.queue||[],opts=head?.payload?.options;
      const simple=o=>o?.mode==="specified"&&o.gainData===true
        &&Object.keys(o).every(k=>["mode","sectorX","nebulaIds","gainData","label","skippable","cost"].includes(k))
        &&(!o.cost||Object.keys(o.cost).length===1&&o.cost.publicity===1);
      if(s?.phase!=="awaiting_input"||s.failure||s.interruptContext||s.undoFrames.length
        ||head.type!==types.SCAN_STEP||head.kind!=="decision"||head.ownerId!==seatId||head.allowQuickActions||!simple(opts)
        ||finalize?.type!==types.SCAN_FINALIZE||finalize.kind!=="effect"||finalize.ownerId!==seatId
        ||Object.keys(head.payload).length!==1)return null;
      const base=s.workingState,turn=base.turn,known=knownCards(stored.envelope);
      const owner=base.players.players.find(p=>p.id===seatId);
      if(turn.roundNumber!==4||turn.currentPlayerId!==seatId||turn.gameEnded||!owner.mainActionCompleted
        ||owner.passCompletionPending||turn.cardTurnEventBonuses?.length||turn.passedPlayerIds.includes(seatId)
        ||owner.reservedCards.some(c=>!known.has(c.id))||localPlans.hasPendingFossilArrival(base))return null;
      // Native scan helpers may write these slices; they remain privately owned.
      const playersCopy=base.players.players.map(p=>({...p,resources:{...p.resources},scoreSources:{...p.scoreSources},
        ...(p===owner?{dataState:copyForkData(p.dataState),reservedCards:copyForkData(p.reservedCards)}:{})}));
      const actor=playersCopy.find(p=>p.id===seatId);
      const state={...base,meta:{...base.meta,sequences:{...base.meta.sequences}},data:copyForkData(base.data),
        aliens:copyForkData(base.aliens),players:{...base.players,players:playersCopy},
        match:{...base.match,cardPlayContext:{...base.match.cardPlayContext}}};
      const journal={...s.journal,events:[...s.journal.events],history:[...s.journal.history],effects:[...s.journal.effects]};
      const scratch={...s,workingState:state,journal,queue:s.queue.slice()};
      const scan=(target,o)=>{
        if(target?.skip)return {ok:true,events:[{type:"scanStepSkipped",playerId:seatId}]};
        const id=target?.nebulaId;
        if(!id||!knownRootNebulaIds.has(id))return null;
        if(o.cost&&!players.spendResources(actor,o.cost).ok)return null;
        const result=scienceSession.executeNebulaScan(state,seatId,{target:{choiceId:"nebula:"+id,nebulaId:id}},
          {nebulaIds:[id],gainData:o.gainData,source:"science",label:o.label});
        return result.ok?{ok:true,events:result.events,history:[{type:"science_scan",nebulaId:id}]}:null;
      };
      const apply=(effect,result)=>{
        if(!result?.ok||result.irreversible||result.rng?.length||result.log)return false;
        const augmented=residualSession.augmentEffectResult(state,result,effect);
        if(augmented.spawnedEffects.length!==(result.spawnedEffects?.length||0)
          ||(augmented.events?.length||0)!==(result.events?.length||0)
          ||augmented.spawnedEffects.some(e=>e.effect?.ownerId!==seatId))return false;
        scratch.queue.shift();
        scratch.queue.unshift(...effectSession.normalizeSpawnedEffects(augmented.spawnedEffects,scratch,effect));
        journal.effects.push({effectId:effect.effectId,groupId:effect.groupId,groupKind:effect.groupKind,
          type:effect.type,revision:++scratch.revision});
        journal.events.push(...(augmented.events||[]));
        journal.history.push(...(result.history||[]));
        return true;
      };
      if(!apply(head,scan(action.target,opts)))return null;
      const barrier=s.irreversibleBarrier;let choices=null;
      // This is one conditional input and a bounded forced queue, never a
      // second choice or a scan-path search. Unsupported suffixes go Native.
      for(let i=0;i<8&&scratch.queue.length;i++){
        const effect=scratch.queue[0],type=effect.type;
        if(effect.ownerId!==seatId||effect.allowQuickActions)return null;
        if(effect.kind==="decision"){
          if(type===types.ALIEN_TRACE)choices=scienceSession.alienTraceDecisionChoices(state,effect);
          else if(type===types.SCAN_STEP&&simple(effect.payload?.options)){
            choices=scienceSession.formalizeChoices(state,seatId,scienceSession.listScanStepChoices(state,actor,effect.payload.options));
          }else return null;
          break;
        }
        let result;
        if(type===types.SCAN_FINALIZE)result=scienceSession.finalizeScanFlow(state,effect);
        else if(type===types.SETTLE)result=scienceSession.settleScanFlow(state,effect);
        else if(type==="probe_turn_reward"){
          const delegated=probeTurnSession.describeRewardEffect(state,effect);
          if(!delegated||![types.SCAN_STEP,types.ALIEN_TRACE].includes(delegated.type))return null;
          const spawnedEffects=[{effect:delegated}];
          if(delegated.type===types.SCAN_STEP)spawnedEffects.push(scienceSession.scanFinalizeEffect(seatId));
          result={ok:true,spawnedEffects};
        }else if(type===types.SCAN_STEP&&simple(effect.payload?.options)){
          const o=effect.payload.options,raw=scienceSession.listScanStepChoices(state,actor,o);
          const forced=o.nebulaIds?.length===1&&!o.skippable&&!o.cost;
          if(forced){
            const selected=raw.find(a=>a.target.nebulaId===o.nebulaIds[0]);
            if(!selected)return null;
            result=scan(selected.target,o);
          }else result={ok:true,spawnedEffects:raw.length?[scienceSession.scanDecisionEffect(types.SCAN_STEP,seatId,{options:o})]:[],
            events:raw.length?[]:[{type:"scanStepSkipped",reason:"no_legal_target"}]};
        }else if(type==="card_play_domain_effect:effect:chong_pickup_fossil"){
          const offer=quietFossilOffer(state,effect,s,known);
          if(!offer||!apply(effect,offer.result))return null;
          choices=scienceSession.formalizeChoices(state,seatId,offer.picks);break;
        }else return null;
        if(!apply(effect,result))return null;
      }
      if(!scratch.queue.length){
        state.meta=quietSavedMeta(state.meta,s.baseVersion+1);
        const envelope=provedCommittedEnvelope(stored,state);
        return {envelope,inspection:{phase:"idle",session:null},barrier};
      }
      if(!choices?.length)return null;
      const cursor=journal.replay.length,decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      scratch.journal={...journal,decisions:[...journal.decisions,decision],
        replay:[...journal.replay,{cursor,kind:"decision",confirmed:true,...decision}]};
      const session=freeze({...checkpoint,replayCursor:cursor+1,session:scratch});
      return {envelope:withEnvelopeSession(stored.envelope,session),
        inspection:{phase:"awaiting_input",session:{irreversibleBarrier:barrier,decision:{choices}}},barrier};
    }

    // These scan and pick prefixes never move cargo. Require the original
    // public shipment and no arrival that Native would settle on this input.
    function knownStationaryCargoForScan(state) {
      const turn=state.turn;
      if(turn.roundNumber!==4||!knownRootAlienIds.has("虫"))return false;
      const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
      if(jobs.length!==1||jobs[0].delivered||!jobs[0].fossilId||!visibleRootCargo().has(jobs[0].fossilId))return false;
      const cargo=state.pieces.rockets.find(r=>r.kind==="chong-fossil"&&r.fossilId===jobs[0].fossilId);
      return Boolean(cargo&&cargo.playerId===seatId&&!localPlans.hasPendingFossilArrival(state));
    }

    function knownPublicScanMarkerTail(effect, source, known) {
      const card=effect?.payload?.cardEffect,options=card?.options;
      return effect?.type==="card_play_domain_direct"&&effect.kind==="effect"
        &&source?.family==="play_card"&&known.has(source.target?.cardInstanceId)
        &&effect.payload.cardInstanceId===source.target.cardInstanceId
        &&card?.id==="dlc13-public-scan-marker"&&card.type==="gain_resources"
        &&options?.gain?.additionalPublicScan===1&&Object.keys(options.gain).length===1
        &&(options.repeat??1)===1&&Object.keys(options).every(k=>k==="gain"||k==="repeat");
    }

    function previewQuietPublicScan(node,stored,action){
      if(!resourcePlanning||!scanPlanning||node.status!=="decision"||stored.informationBarrier||stored.resourceControl
        ||action.family!=="choose_card")return null;
      const checkpoint=stored.envelope.session,s=checkpoint?.session,types=scienceSession.EFFECT_TYPES;
      const [head,purple,third,fourth,last]=s?.queue||[],opts=head?.payload?.options;
      const repeatOnly=s?.queue.length===2&&purple?.type===types.SCAN_FINALIZE;
      const mercury=s?.queue.length===4&&quietMercuryScanStep(third),finalize=repeatOnly?purple:mercury?fourth:third,extra=mercury?null:fourth;
      if(s?.phase!=="awaiting_input"||s.interruptContext||s.irreversibleBarrier||s.failure||s.undoFrames.length
        ||head.type!==types.SCAN_STEP||head.kind!=="decision"||opts?.mode!=="public"
        ||Object.keys(opts).some(k=>!["mode","max","selected","consumeMarkers"].includes(k))
        ||!Number.isSafeInteger(opts.max)||!Number.isSafeInteger(opts.selected)||opts.selected>=opts.max
        ||!repeatOnly&&(purple?.type!==types.SCAN_ACTION_4||purple.kind!=="decision")||finalize?.type!==types.SCAN_FINALIZE
        ||s.queue.some(e=>e.ownerId!==seatId||e.allowQuickActions))return null;
      const actionSource=s.journal.actions[0]?.action,source=actionSource?.family;
      const known=knownCards(stored.envelope);
      const b9=s.queue.length===5&&extra?.type===types.SCAN_STEP
        &&extra.payload?.cardEffect?.id==="b9-any-sector-scan"&&last.type===types.SCAN_FINALIZE;
      // The DLC13 marker stays in the original queue and settles natively,
      // after the scan's real Purple 4 decision and public refill.
      const aomomoScan=source==="play_card"&&s.queue.length===3&&residualSession.hasOnlyAomomoScanScoreBonus(s.workingState.turn,seatId);
      const markerTail=s.queue.length===4&&!mercury&&knownPublicScanMarkerTail(extra,actionSource,known);
      if(source==="scan"&&!repeatOnly&&s.queue.length!==(mercury?4:3)
        ||source==="play_card"&&!b9&&!markerTail&&!aomomoScan||source!=="scan"&&source!=="play_card")return null;
      const root=s.workingState,t=root.turn,p=root.players.players.find(q=>q.id===seatId);
      // With only root-visible Amiba and no pending species reveal, this
      // prefix still stops at the native Purple 4 menu, before sector settlement.
      const quietAmiba=source==="scan"&&quietR3AmibaPostMain(root,p);
      const quietRoundThree=quietAmiba||source==="scan"&&(isUnrevealedRoundThree(root)||quietEarlySameSeatHandover(root));
      // A repeat can be reused before the next public choice, but ending
      // a scan without the Purple 4 menu would also settle the sector.
      if(repeatOnly&&(!quietAmiba||finalize.kind!=="effect"||Object.keys(finalize.payload).length
        ||action.target?.done||opts.selected+1>=opts.max))return null;
      if((t.roundNumber!==4&&!quietRoundThree)||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length&&!aomomoScan||t.type1TriggerEvents?.length
        ||(mercury?localPlans.hasPendingFossilArrival(root):Object.values(root.aliens.chong?.transportTasksByRocketId||{}).some(job=>!job.delivered)&&!knownStationaryCargoForScan(root))
        ||p.reservedCards.some(c=>!known.has(c.id)))return null;
      const done=action.target?.done===true;
      const offered=root.cards.publicCards[action.target?.publicSlotIndex];
      if(done?action.target.choiceId!=="public:done":!offered||!known.has(offered.id)||offered.id!==action.target.cardInstanceId
        ||action.target.choiceId!==`public:${offered.id}:${action.target.nebulaId}`||action.payload.gainData!==true)return null;
      const player={...p,resources:{...p.resources},dataState:copyForkData(p.dataState),scoreSources:{...p.scoreSources},
        reservedCards:copyForkData(p.reservedCards)};
      const state={...root,...(aomomoScan?{turn:{...t,cardTurnEventBonuses:copyForkData(t.cardTurnEventBonuses)}}:{}),meta:{...root.meta,sequences:{...root.meta.sequences}},data:copyForkData(root.data),
        match:{...root.match,cardPlayContext:{...root.match.cardPlayContext}},cards:{...root.cards,publicCards:[...root.cards.publicCards],discardPile:[...root.cards.discardPile]},
        players:{...root.players,players:root.players.players.map(q=>q===p?player:q)}};
      let repeat=null,events,history=[];
      if(done)events=[{type:"publicScanCompleted",selected:opts.selected||0}];
      else{
        const id=action.target.nebulaId;
        const result=scienceSession.executeNebulaScan(state,seatId,{target:{choiceId:"nebula:"+id,nebulaId:id}},
          {nebulaIds:[id],source:"science"});
        if(!result.ok)return null;
        events=result.events||[];
        history=[{type:"science_scan",nebulaId:id}];
        repeat=scienceSession.consumePublicScanCard(state,player,action,opts);
      }
      if(aomomoScan){
        const adjusted=residualSession.augmentEffectResult(state,{ok:true,events},head);
        if(adjusted.spawnedEffects.length||adjusted.events.length!==events.length)return null;
        events=adjusted.events;
      }
      if(repeatOnly&&!repeat||events.some(event=>cardEffects.collectMatchingTriggers(player,event).length))return null;
      const offset=Number(Boolean(repeat)),revision=s.revision+1;
      const nextEffectSequence=s.nextEffectSequence+offset,nextGroupSequence=s.nextGroupSequence+offset;
      const queue=s.queue.slice(1);
      if(repeat)queue.unshift({...head,effectId:s.sessionId+":effect:"+nextEffectSequence,
        groupId:s.sessionId+":group:"+nextGroupSequence,groupKind:"spawned",payload:{options:repeat},
        source:{parentEffectId:head.effectId,priority:"direct"},groupIndex:0});
      const choices=repeat
        ?scienceSession.formalizeChoices(state,seatId,scienceSession.listScanStepChoices(state,player,repeat))
        :scienceSession.scanAction4DecisionChoices(state,purple);
      if(!choices.length)return null;
      const j=s.journal,cursor=j.replay.length;
      const decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      const effectRow={effectId:head.effectId,groupId:head.groupId,groupKind:head.groupKind,type:head.type,revision};
      const session=freeze({...checkpoint,replayCursor:cursor+1,session:{...s,workingState:state,queue,revision,
        nextEffectSequence,nextGroupSequence,journal:{...j,decisions:[...j.decisions,decision],events:[...j.events,...events],
          history:[...j.history,...history],effects:[...j.effects,effectRow],
          replay:[...j.replay,{cursor,kind:"decision",confirmed:true,...decision}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function previewQuietScan4Action(node,stored,action){
      const mode=action.target?.mode,moving=mode==="move";
      if(!resourcePlanning||!scanPlanning||!movementPlanning||node.status!=="decision"
        ||stored.resourceControl&&(moving||stored.resourceControl.goal.kind!=="scan-flow")
        ||stored.informationBarrier||action.family!=="choose_target"
        ||(moving?action.payload?.requiredMovePoints!==1:!["launch","skip"].includes(mode)||action.target.choiceId!==`scan4:${mode}`))return null;
      const checkpoint=stored.envelope.session, s=checkpoint?.session;
      const [head,second,third,last]=s?.queue||[],types=scienceSession.EFFECT_TYPES;
      const mercury=s?.queue.length===3&&quietMercuryScanStep(second)?second:null;
      const finalize=mercury?third:second,extra=mercury?null:third;
      if(s?.phase!=="awaiting_input"||s.interruptContext||s.irreversibleBarrier||s.failure||s.undoFrames.length
        ||head.type!==types.SCAN_ACTION_4||head.kind!=="decision"||head.allowQuickActions||!head.payload?.skippable
        ||!finalize||finalize.type!==types.SCAN_FINALIZE
        ||s.queue.some(e=>e.ownerId!==seatId||e.allowQuickActions))return null;
      const source=s.journal.actions[0]?.action?.family;
      const aomomoScan=source==="play_card"&&s.queue.length===2&&residualSession.hasOnlyAomomoScanScoreBonus(s.workingState.turn,seatId);
      if(source==="scan"&&s.queue.length!==(mercury?3:2)||source==="play_card"&&!aomomoScan&&(s.queue.length!==4||extra?.type!==types.SCAN_STEP
        ||extra.kind!=="effect"||last.type!==types.SCAN_FINALIZE||extra.payload?.cardEffect?.id!=="b9-any-sector-scan"
        ||extra.payload?.options?.mode!=="any"||extra.payload.options.sameSectorRemaining!==1)
        ||source!=="scan"&&source!=="play_card")return null;
      const state=s.workingState,t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(!moving&&(mercury
        ||industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId!=="deepspace_swap_cards"))return null;
      const ship=moving&&state.pieces.rockets.find(r=>r.id===action.target.rocketId);
      const known=knownCards(stored.envelope);
      const jobs=state.aliens.chong?.transportTasksByRocketId||{};
      const inTransit=!mercury&&Object.values(jobs).some(job=>!job.delivered);
      const stationaryCargo=!mercury&&inTransit&&knownStationaryCargoForScan(state);
      if((t.roundNumber!==4&&!(source==="scan"&&quietEarlySameSeatHandover(state)))||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length&&!aomomoScan||t.type1TriggerEvents?.length
        ||(mercury?localPlans.hasPendingFossilArrival(state):inTransit&&!stationaryCargo)
        ||p.reservedCards.some(c=>!known.has(c.id))
        ||moving&&(!ship||ship.playerId!==seatId||(ship.kind||"standard")!=="standard"
          ||jobs[String(ship.id)])
        ||!mercury&&data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(state.data,id)))return null;
      const missing=state.cards.publicCards.filter(c=>!c).length;
      if(!missing)return null;
      const player={...p,resources:{...p.resources},reservedCards:structuredClone(p.reservedCards)};
      const next={...state,meta:{...state.meta,sequences:{...state.meta.sequences}},
        pieces:moving?{...state.pieces,rockets:state.pieces.rockets.map(r=>r===ship?{...r}:r)}
          :mode==="launch"?copyForkData(state.pieces):state.pieces,
        cards:{...state.cards,publicCards:[...state.cards.publicCards],drawPileCardIds:[...state.cards.drawPileCardIds]},
        players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
      const context=scienceSession.createActionContext(next,seatId);
      let actionEvents=[{type:"scanAction4Skipped",playerId:seatId}];
      if(moving){
        const move=rocketAbilities.moveProbe(context,{
          ...action.target,cost:{},skipCost:true,movementPoints:scanEffects.SCAN_ACTION_4_MOVE_POINTS,
        });
        if(!move.ok||move.events[0]?.type!=="move"||move.payload.requiredMovePoints!==1)return null;
        actionEvents=move.events;
        if(actionEvents.length!==1||stationaryCargo){
          // The regular probe collects comet publicity while the public
          // cargo stays still. Other cargo visits use Native handling.
          const visitType=actionEvents[1]?.type;
          if(actionEvents.length!==2||(stationaryCargo
            ?visitType!=="visitComet"||localPlans.hasPendingFossilArrival(next)
            :visitType!=="visitPlanet"||Object.keys(jobs).length))return null;
          const arrival=residualSession.augmentEffectResult(next,{ok:true,events:actionEvents},head);
          if(arrival.spawnedEffects.length)return null;
          actionEvents=arrival.events;
        }
      }else if(mode==="launch"){
        const launch=rocketAbilities.launchProbe(context,{cost:{energy:scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY}});
        if(!launch.ok||launch.events.length!==1||launch.events[0].type!=="launch")return null;
        actionEvents=launch.events;
      }
      if(mercury){
        // The paid Mercury scan remains a real decision. No sector reward
        // or refill is resolved while preparing its native menu.
        if(actionEvents.some(event=>cardEffects.collectMatchingTriggers(player,event).length))return null;
        const choices=scienceSession.formalizeChoices(next,seatId,scienceSession.listScanStepChoices(next,player,mercury.payload.options));
        if(!choices.length)return null;
        const revision=s.revision+2,nextEffectSequence=s.nextEffectSequence+1,nextGroupSequence=s.nextGroupSequence+1;
        const queue=[{...mercury,effectId:s.sessionId+":effect:"+nextEffectSequence,groupId:s.sessionId+":group:"+nextGroupSequence,
          groupKind:"spawned",kind:"decision",decisionKind:"choose_target",source:{parentEffectId:mercury.effectId,priority:"direct"},groupIndex:0},finalize];
        const j=s.journal,cursor=j.replay.length;
        const decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
        const effects=[head,mercury].map((e,i)=>({effectId:e.effectId,groupId:e.groupId,groupKind:e.groupKind,type:e.type,revision:s.revision+i+1}));
        const session=freeze({...checkpoint,replayCursor:cursor+1,session:{...s,workingState:next,queue,revision,nextEffectSequence,nextGroupSequence,
          journal:{...j,decisions:[...j.decisions,decision],events:[...j.events,...actionEvents],effects:[...j.effects,...effects],
            replay:[...j.replay,{cursor,kind:"decision",confirmed:true,...decision}]}}});
        return {prepared:{envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}}};
      }
      if(!refillQuietScan4(next,missing))return null;
      const events=[...actionEvents,{type:"publicRefill",count:missing}];
      if(events.some(e=>cardEffects.collectMatchingTriggers(player,e).length||aomomoScan&&e.type==="signalMarked"))return null;
      const eid=n=>s.sessionId+":effect:"+(s.nextEffectSequence+n);
      const gid=n=>s.sessionId+":group:"+(s.nextGroupSequence+n);
      const barrier={effectId:eid(2),revision:s.revision+4,code:"hidden_card_reveal",reason:"公共牌补牌翻出新牌"};
      if(!extra){
        next.meta.stateVersion=s.baseVersion+1;
        return {next,barrier};
      }

      // The first scan has no sector reward. Refill remains before the
      // unchanged second scan; its real menu is enumerated on the new state.
      const choices=scienceSession.formalizeChoices(next,seatId,scienceSession.listScanStepChoices(next,player,extra.payload.options));
      if(!choices.length)return null;
      const row=(e,advance)=>({effectId:e.effectId,groupId:e.groupId,groupKind:e.groupKind,type:e.type,revision:s.revision+advance});
      const spawned=(n,type)=>({effectId:eid(n),groupId:gid(n),groupKind:"spawned",type});
      const decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      const queueHead={...extra,...spawned(3,types.SCAN_STEP),kind:"decision",decisionKind:"choose_target",
        payload:{options:extra.payload.options},source:{parentEffectId:extra.effectId,priority:"direct"}};
      const j=s.journal,replayCursor=j.replay.length;
      const session=freeze({...checkpoint,replayCursor:replayCursor+1,session:{...s,workingState:next,
        queue:[queueHead,last],irreversibleBarrier:barrier,revision:s.revision+5,
        nextEffectSequence:s.nextEffectSequence+3,nextGroupSequence:s.nextGroupSequence+3,
        journal:{...j,decisions:[...j.decisions,decision],events:[...j.events,...events],
          effects:[...j.effects,row(head,1),row(finalize,2),row(spawned(1,types.SETTLE),3),row(spawned(2,types.PUBLIC_REFILL),4),row(extra,5)],
          rng:[...j.rng,{owner:"science",cursor:next.meta.rngState?.science?.cursor||0}],
          replay:[...j.replay,{cursor:replayCursor,kind:"decision",confirmed:true,...decision}]}}});
      return {prepared:{envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{irreversibleBarrier:barrier,decision:{choices}}}}};
    }

    function previewFixedBluePickSettlement(node, stored, action) {
      if (!resourcePlanning || !cardPickPlanning || node.status !== "decision" || stored.resourceControl
        || action.family !== "choose_card" || !Number.isInteger(action.target?.publicSlotIndex)) return null;
      const session=stored.envelope.session?.session, head=session?.queue?.[0];
      if (session?.phase !== "awaiting_input" || session.queue.length !== 1 || session.interruptContext
        || session.irreversibleBarrier || head.type !== scienceSession.EFFECT_TYPES.PICK_CARD
        || head.kind !== "decision" || head.allowQuickActions || head.ownerId !== seatId || head.payload?.blueBonusSource !== true
        || session.journal.actions[0]?.action?.family !== "place_data") return null;
      const state=session.workingState, t=state.turn, p=state.players.players.find(p=>p.id===seatId);
      const i=action.target.publicSlotIndex, offered=state.cards.publicCards[i], known=knownCards(stored.envelope);
      // A company swap can leave an already revealed Amiba instance in
      // the public slot. Native takes that instance and refills the same way.
      const publicAmiba = t.roundNumber === 4 && knownRootAlienIds.has("阿米巴")
        && offered?.set === "alien:阿米巴" && aliens.amiba.getCardDefinition(offered)?.cardId === offered.cardId;
      const r3BlueSlot=session.journal.events.find(e=>e.type==="placeData"&&e.placementKind==="blueBonus")?.blueSlot;
      if (t.roundNumber !== 4 && !(r3BlueSlot===2&&quietR3BluePickSource(state,p))
        || t.currentPlayerId !== seatId || t.gameEnded || p.passCompletionPending
        || t.passedPlayerIds.includes(seatId) || t.cardTurnEventBonuses?.length
        || Object.values(state.aliens.chong?.transportTasksByRocketId || {}).some(job=>!job.delivered)&&!knownStationaryCargoForScan(state)
        || !offered || !known.has(offered.id) || offered.id !== action.target.cardInstanceId
        || action.target.choiceId !== `pick:${offered.id}` || (!publicAmiba && !cards.getCatalogEntryForCard(offered))
        || p.reservedCards.some(c=>!known.has(c.id))) return null;
      const policy=cardPickSpec(node);
      if (!policy?.fixed || policy.selectedActionId !== action.actionId) return null;

      const player={...p,resources:{...p.resources},hand:[...p.hand],reservedCards:structuredClone(p.reservedCards)};
      const next={...state,meta:{...state.meta,stateVersion:session.baseVersion+1,sequences:{...state.meta.sequences}},
        cards:{...state.cards,publicCards:[...state.cards.publicCards],drawPileCardIds:[...state.cards.drawPileCardIds]},
        players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
      next.cards.publicCards[i]={...offered};
      let usedRandom=false;
      const picked=cards.pickFromPublic(next.cards,next.players,player,i,()=>{usedRandom=true;return 0;},{root:next});
      if (!picked.ok || usedRandom || !picked.replenished) return null;
      picked.card.blueBonusOwnerId=seatId;
      if (cardEffects.collectMatchingTriggers(player,{type:"place_data_pick_card",playerId:seatId,cardInstanceId:offered.id}).length) return null;
      // The replacement card stays private to the rules fork. finishChild
      // applies the original information mask before any search continuation.
      return next;
    }

    // Preserve the real refill and journal while the search only sees
    // identities already known at the current root.
    function previewFixedResearchPick(node,stored,action){
      if(!resourcePlanning||!cardPickPlanning||node.status!=="decision"||action.family!=="choose_card"
        ||!Number.isInteger(action.target?.publicSlotIndex))return null;
      const checkpoint=stored.envelope.session,s=checkpoint?.session,head=s?.queue[0],types=scienceSession.EFFECT_TYPES;
      const source=s?.journal.actions[0]?.action?.family;
      if(s?.phase!=="awaiting_input"||s.failure||s.interruptContext||s.undoFrames.length||s.queue.length>3
        ||!["research_tech","play_card"].includes(source)
        ||!["tech_bonus_reveal","hidden_card_reveal"].includes(s.irreversibleBarrier?.code)
        ||head?.type!==types.PICK_CARD||head.kind!=="decision"||Object.keys(head.payload).length
        ||s.queue.some(e=>e.ownerId!==seatId||e.kind!=="decision"||e.allowQuickActions
          ||![types.PICK_CARD,"residual_card_decision"].includes(e.type)))return null;
      const state=s.workingState,t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      const known=knownCards(stored.envelope),i=action.target.publicSlotIndex,offer=state.cards.publicCards[i];
      if((t.roundNumber!==4&&!quietEarlySameSeatHandover(state))||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length||localPlans.hasPendingFossilArrival(state)
        ||!offer||!known.has(offer.id)||offer.id!==action.target.cardInstanceId||action.target.choiceId!==`pick:${offer.id}`
        ||!cards.getCatalogEntryForCard(offer)||p.reservedCards.some(c=>!known.has(c.id)))return null;
      const pick=cardPickSpec(node);
      if(!pick?.fixed||pick.selectedActionId!==action.actionId)return null;
      const player={...p,resources:{...p.resources},hand:[...p.hand],reservedCards:structuredClone(p.reservedCards)};
      const next={...state,meta:{...quietSavedMeta(state.meta,s.baseVersion+Number(s.queue.length===1)),sequences:{...state.meta.sequences}},
        cards:{...state.cards,publicCards:[...state.cards.publicCards],drawPileCardIds:[...state.cards.drawPileCardIds]},
        players:{...state.players,players:state.players.players.map(q=>q===p?player:q)}};
      next.cards.publicCards[i]={...offer};
      let usedRandom=false;
      const picked=cards.pickFromPublic(next.cards,next.players,player,i,()=>{usedRandom=true;return 0;},{root:next});
      const event={type:"place_data_pick_card",playerId:seatId,cardInstanceId:offer.id};
      if(!picked.ok||usedRandom||!picked.replenished||cardEffects.collectMatchingTriggers(player,event).length)return null;
      return prepareDecisionContinuation(stored,next,action,{
        irreversible:{code:"hidden_card_reveal",reason:"公共牌补牌翻出新牌"},events:[event],
        rng:[{owner:"science",cursor:next.meta.rngState?.science?.cursor||0}],
      });
    }

    function cardInstanceIdForB38(state,origin){
      const id=origin.target?.cardInstanceId;
      const isB38=c=>c.id===id&&c.cardId==="b_38.webp";
      return state.cards.discardPile.find(isB38)?.id||state.players.players.find(p=>p.id===seatId).reservedCards.find(isB38)?.id;
    }

    function previewFixedResearchSelection(node,stored,action){
      if(!resourcePlanning||node.status!=="decision"||action.family!=="choose_target"||!action.target?.tileId)return null;
      const s=stored.envelope.session?.session,head=s?.queue[0],options=head?.payload?.options,origin=s?.journal.actions[0]?.action;
      const finalize=s?.queue[1],scanTail=s?.queue.length===2&&finalize.type===scienceSession.EFFECT_TYPES.SCAN_FINALIZE
        &&finalize.kind==="effect"&&finalize.ownerId===seatId&&!finalize.allowQuickActions&&!Object.keys(finalize.payload).length;
      if(s?.phase!=="awaiting_input"||s.failure||s.interruptContext||s.irreversibleBarrier||s.undoFrames.length||s.queue.length!==1&&!scanTail
        ||head.type!==scienceSession.EFFECT_TYPES.RESEARCH||head.kind!=="decision"||head.ownerId!==seatId||head.allowQuickActions
        ||!["research_tech","play_card"].includes(origin?.family)
        ||!options||(options.repeat??1)!==1||options.afterResearchReward&&options.afterResearchReward.kind!=="repeatBonus")return null;
      const state=s.workingState,t=state.turn,p=state.players.players.find(q=>q.id===seatId),known=knownCards(stored.envelope);
      const tile=state.tech.stacks[action.target.tileId];
      const quietEarlyRound=quietEarlySameSeatHandover(state);
      if((t.roundNumber!==4&&!quietEarlyRound)||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending||t.cardTurnEventBonuses?.length
        ||!tile||tile.bonusHidden||tile.bonusIndex!==knownRootTechIndices.get(action.target.tileId)
        ||p.reservedCards.some(c=>!known.has(c.id))
        ||origin.family==="play_card"&&!known.has(origin.target.cardInstanceId))return null;
      if(scanTail&&(t.roundNumber!==2||!quietEarlyRound||origin.family!=="play_card"
        ||origin.target?.cardId!=="b_38.webp"&&cardInstanceIdForB38(state,origin)!==origin.target?.cardInstanceId
        ||!options.skipCost||options.techTypes?.length!==1||options.techTypes[0]!=="purple"
        ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        ||data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(state.data,id))))return null;
      // Rotation and research can write several rule slices. Give the same
      // Production resolver an isolated copy; only deterministic exits qualify.
      const next=scanTail?copyForkData(state):structuredClone(state),result=scienceSession.resolveResearchSelection(next,head,action);
      if(!result.ok||result.events.length!==1||result.events[0].type!=="researchTech"
        ||JSON.stringify(next.meta.rngState)!==JSON.stringify(state.meta.rngState)
        ||localPlans.hasPendingFossilArrival(next))return null;
      const augmented=localPlans.augmentEffectResult(next,result,head);
      if(augmented.events.length!==1||augmented.spawnedEffects.length>3||augmented.spawnedEffects.some(x=>
        (x.priority??"direct")!=="direct"||x.effect?.ownerId!==seatId||x.effect.kind!=="decision"
        ||x.effect.allowQuickActions||![scienceSession.EFFECT_TYPES.PICK_CARD,"residual_card_decision"].includes(x.effect.type)))return null;
      if(scanTail){
        if(augmented.spawnedEffects.length||data.NEBULA_IDS.some(id=>data.isSectorReadyToSettle(next.data,id)))return null;
        const missing=next.cards.publicCards.filter(c=>!c).length;
        if(missing&&!refillQuietScan4(next,missing))return null;
        if(missing){
          const refill={ownerId:seatId,type:scienceSession.EFFECT_TYPES.PUBLIC_REFILL};
          const events=localPlans.augmentEffectResult(next,{ok:true,events:[{type:"publicRefill",count:missing}]},refill);
          if(events.spawnedEffects.length||events.events.length!==1)return null;
        }
        next.meta=quietSavedMeta(next.meta,s.baseVersion+1);
        return {state:next,barrier:missing?{effectId:s.sessionId+":effect:"+(s.nextEffectSequence+2),
          revision:s.revision+4,code:"hidden_card_reveal",reason:"公共牌补牌翻出新牌"}
          :{effectId:head.effectId,revision:s.revision+1,...augmented.irreversible}};
      }
      next.meta=quietSavedMeta(next.meta,s.baseVersion+Number(!augmented.spawnedEffects.length));
      return prepareDecisionContinuation(stored,next,action,augmented);
    }

    function prepareDecisionContinuation(stored,next,action,result,traceCardMenu=false){
      const checkpoint=stored.envelope.session,s=checkpoint.session,head=s.queue[0],types=scienceSession.EFFECT_TYPES;
      const revision=s.revision+1,barrier=traceCardMenu?s.irreversibleBarrier:{effectId:head.effectId,revision,...result.irreversible};
      let nextEffectSequence=s.nextEffectSequence,nextGroupSequence=s.nextGroupSequence;
      const queue=[...(result.spawnedEffects||[]).map(({effect})=>({
        schemaVersion:head.schemaVersion,effectId:s.sessionId+":effect:"+(++nextEffectSequence),
        groupId:s.sessionId+":group:"+(++nextGroupSequence),groupKind:"spawned",type:effect.type,kind:effect.kind,
        ownerId:seatId,decisionKind:effect.decisionKind||null,allowQuickActions:false,payload:effect.payload,
        source:{parentEffectId:head.effectId,priority:"direct"},groupIndex:0,
      })),...s.queue.slice(1)];
      if(!queue.length)return {barrier,state:next};
      const pending=queue[0],choices=traceCardMenu
        ?residualSession.alienCardChoices(next,seatId,pending.payload.speciesId)
        :pending.type===types.PICK_CARD
          ?scienceSession.formalizeChoices(next,seatId,scienceSession.listPickCardChoices(next))
          :localPlans.residualCardChoices(next,pending);
      if(!choices.length)return null;
      const j=s.journal,cursor=j.replay.length,decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      const effect={effectId:head.effectId,groupId:head.groupId,groupKind:head.groupKind,type:head.type,revision};
      const session=freeze({...checkpoint,replayCursor:cursor+1,session:{...s,workingState:next,queue,revision,irreversibleBarrier:barrier,
        nextEffectSequence,nextGroupSequence,
        journal:{...j,decisions:[...j.decisions,decision],effects:[...j.effects,effect],events:[...j.events,...result.events],
          history:[...j.history,...(result.history||[])],rng:[...j.rng,...(result.rng||[])],
          replay:[...j.replay,{cursor,kind:"decision",confirmed:true,...decision}]}}});
      return {barrier,prepared:{envelope:withEnvelopeSession(stored.envelope,session),
        inspection:{phase:"awaiting_input",session:{irreversibleBarrier:barrier,decision:{choices}}}}};
    }

    function previewQuietAomomoCard(node,stored,action){
      const s=stored.envelope.session?.session,head=s?.queue[0],tail=s?.queue[1],source=action.target?.source;
      if(!resourcePlanning||!cardPickPlanning||node.status!=="decision"||action.family!=="choose_card"
        ||!["display","blind","cancel"].includes(source)||stored.informationBarrier&&stored.informationBarrier.code!=="hidden_card_reveal"
        ||s?.phase!=="awaiting_input"||s.failure||s.interruptContext||s.irreversibleBarrier&&s.irreversibleBarrier.code!=="hidden_card_reveal"||s.undoFrames.length
        ||head?.type!=="residual_alien_card_decision"||head.kind!=="decision"||head.ownerId!==seatId||head.allowQuickActions
        ||head.payload.speciesId!=="aomomo"||head.payload.source!=="trace_reward"||s.queue.length>2
        ||tail&&(tail.type!==scienceSession.EFFECT_TYPES.PUBLIC_REFILL||tail.kind!=="effect"||tail.ownerId!==seatId
          ||tail.allowQuickActions||Object.keys(tail.payload).length))return null;
      const state=s.workingState,t=state.turn,p=state.players.players.find(q=>q.id===seatId),deck=state.aliens.aomomo;
      if(t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length&&!residualSession.hasOnlyAomomoScanScoreBonus(t,seatId)||t.passedPlayerIds.includes(seatId)||!knownRootAlienIds.has("奥陌陌")
        ||p.reservedCards.some(c=>!knownCards(stored.envelope).has(c.id))||localPlans.hasPendingFossilArrival(state)
        ||!deck?.revealInitialized)return null;
      const player={...p,resources:{...p.resources},hand:[...p.hand],reservedCards:structuredClone(p.reservedCards)};
      const next={...state,meta:{...quietSavedMeta(state.meta,s.baseVersion+1),sequences:{...state.meta.sequences}},
        players:{...state.players,players:state.players.players.map(q=>q===p?player:q)},
        aliens:{...state.aliens,aomomo:{...deck,cardDeck:[...deck.cardDeck]}}};
      let random=false;
      const result=residualSession.resolveAlienCardSelection(next,head,action,()=>{random=true;return 0;});
      const expected=source!=="cancel";
      if(!result.ok||random||(result.irreversible?.code==="hidden_alien_card")!==expected
        ||(result.events?.length||0)!==Number(expected))return null;
      const augmented=residualSession.augmentEffectResult(next,result,head);
      if((augmented.spawnedEffects?.length||0)||(augmented.events?.length||0)!==Number(expected))return null;
      const barrier=expected?{effectId:head.effectId,revision:s.revision+1,...result.irreversible}:s.irreversibleBarrier||null;
      return tail?prepareQuietPublicRefill(stored,s,next,1,0,2)
        :{envelope:provedCommittedEnvelope(stored,next),inspection:{phase:"idle",session:null},barrier};
    }

    function previewQuietAlienDisplay(node,stored,action){
      if(stored.envelope.session?.session?.queue[0]?.payload?.speciesId==="aomomo")
        return previewQuietAomomoCard(node,stored,action);
      if(!resourcePlanning||!cardPickPlanning||node.status!=="decision"||action.family!=="choose_card"
        ||action.target?.source!=="display")return null;
      const s=stored.envelope.session?.session,head=s?.queue[0],species=head?.payload?.speciesId;
      if(s?.phase!=="awaiting_input"||s.failure||s.interruptContext||s.undoFrames.length
        ||head?.type!=="residual_alien_card_decision"||head.kind!=="decision"||head.ownerId!==seatId||head.allowQuickActions
        ||!["chong","amiba"].includes(species))return null;
      const pending=s.queue[1],pairedTrigger=pending?.type==="residual_card_decision"&&pending.kind==="decision"
        &&pending.ownerId===seatId&&!pending.allowQuickActions&&pending.payload?.event?.type==="alienTrace"
        &&pairedTracePickupScope(s.workingState,s);
      const region=species==="amiba"&&pending?.type==="card_play_domain_effect:effect:amiba_resolve_region_reward"?pending:null;
      const refillIndex=region?2:1,tail=s.queue[refillIndex];
      const fossil=region&&tail?.type==="card_play_domain_effect:effect:chong_pickup_fossil";
      const trace=tail?.type===scienceSession.EFFECT_TYPES.ALIEN_TRACE&&tail.kind==="decision"
        &&tail.ownerId===seatId&&!tail.allowQuickActions;
      const nextRefill=trace&&s.queue[refillIndex+1];
      if(!pairedTrigger&&(s.queue.length>refillIndex+1+Number(Boolean(nextRefill))
        ||nextRefill&&(nextRefill.type!==scienceSession.EFFECT_TYPES.PUBLIC_REFILL||nextRefill.kind!=="effect"
          ||nextRefill.ownerId!==seatId||nextRefill.allowQuickActions)
        ||region&&(region.kind!=="effect"||region.ownerId!==seatId||region.allowQuickActions
          ||region.payload?.cardInstanceId!==null)
        ||tail&&!fossil&&!trace&&(tail.type!==scienceSession.EFFECT_TYPES.PUBLIC_REFILL||tail.kind!=="effect"
          ||tail.ownerId!==seatId||Object.keys(tail.payload).length)))return null;
      const state=s.workingState,t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      const knownIndex=species==="chong"?knownChongDisplayIndex:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex;
      const known=knownCards(stored.envelope),deck=state.aliens[species];
      if(t.roundNumber!==4&&!pairedTrigger||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length||t.passedPlayerIds.includes(seatId)
        ||!Number.isSafeInteger(knownIndex)||knownIndex!==deck?.displayedCardIndex||knownIndex!==action.target.cardIndex
        ||!knownRootAlienIds.has(species==="chong"?"虫":"阿米巴")
        ||p.reservedCards.some(c=>!known.has(c.id))||localPlans.hasPendingFossilArrival(state))return null;
      const pick=cardPickSpec(node),pair=pairedTrigger&&pairedTracePickupPlan(node,stored,readPlanningState(stored));
      if((!pick?.fixed||pick.selectedActionId!==action.actionId)
        &&(pair?.retainedActionIds?.length!==1||pair.retainedActionIds[0]!==action.actionId))return null;
      // Production consumes the shown card and advances its real deck. Only
      // the inherited public identity may enter the search after either refill.
      const player={...p,resources:{...p.resources},hand:[...p.hand],reservedCards:structuredClone(p.reservedCards),
        ...(region?{scoreSources:{...p.scoreSources}}:{})};
      const meta=fossil||trace||pairedTrigger?state.meta:quietSavedMeta(state.meta,s.baseVersion+1);
      const next={...state,meta:{...meta,sequences:{...state.meta.sequences}},
        players:{...state.players,players:state.players.players.map(q=>q===p?player:q)},
        aliens:{...state.aliens,[species]:region?structuredClone(deck):{...deck,cardDeck:[...deck.cardDeck]}}};
      let usedRandom=false;
      const result=residualSession.resolveAlienCardSelection(next,head,action,()=>{usedRandom=true;return 0;});
      if(!result.ok||usedRandom||result.irreversible?.code!=="hidden_alien_card"
        ||result.events.length!==1||result.events[0].type!=="alien_card_gain")return null;
      const augmented=residualSession.augmentEffectResult(next,result,head);
      if(augmented.spawnedEffects.length||augmented.events.length!==1)return null;
      const regionResult=region&&residualSession.previewQuietAmibaRegion(next,region);
      if(region&&!regionResult)return null;
      const barrier={effectId:head.effectId,revision:s.revision+1,...result.irreversible};
      if(pairedTrigger){
        const choices=localPlans.residualCardChoices(next,pending);
        if(!choices.length)return null;
        return prepareQuietTailMenu(stored,action,{state:next,barrier,drained:1,choices,events:augmented.events,histories:[]});
      }
      if(fossil){
        const offer=quietFossilOffer(next,tail,s,known);
        if(!offer)return null;
        const opened=residualSession.augmentEffectResult(next,offer.result,tail);
        if(opened.spawnedEffects.length!==1||opened.events.length!==1)return null;
        return prepareQuietTailMenu(stored,action,{state:next,barrier,spawned:opened.spawnedEffects,
          events:[...augmented.events,...regionResult.events,...opened.events],
          histories:[regionResult.history,...offer.result.history],
          choices:scienceSession.formalizeChoices(next,seatId,offer.picks)});
      }
      if(trace){
        const choices=scienceSession.alienTraceDecisionChoices(next,tail);
        if(!choices.length)return null;
        return prepareQuietTailMenu(stored,action,{state:next,barrier,drained:refillIndex,choices,
          events:[...augmented.events,...(regionResult?.events||[])],
          histories:regionResult?[regionResult.history]:[]});
      }
      if(tail)return prepareQuietPublicRefill(stored,s,next,refillIndex);
      const envelope=provedCommittedEnvelope(stored,next);
      return {envelope,inspection:{phase:"idle",session:null},barrier};
    }

    function provedCommittedEnvelope(stored, state) {
      const captured=freeze(state);
      let bytes;
      const envelope=Object.freeze({schemaVersion:stored.envelope.schemaVersion,
        get committedState(){
          if(bytes===undefined){lazyPreviewSerializations++;bytes=JSON.stringify(captured);}
          return bytes;
        },session:null});
      committedReferences.set(envelope,captured);
      lazyCommittedEnvelopes++;
      return envelope;
    }

    function prepareQuietTailMenu(stored,action,preview){
      const checkpoint=stored.envelope.session,s=checkpoint.session,[head,...tail]=s.queue,j=s.journal;
      const pickup=tail.at(-1),barrier=preview.barrier||s.irreversibleBarrier;
      const scratch={nextEffectSequence:s.nextEffectSequence,nextGroupSequence:s.nextGroupSequence,sessionId:s.sessionId};
      const spawned=preview.spawned||[{effect:{...pickup,effectId:null,source:null,
        type:"card_play_domain_effect:decision:chong_pickup_fossil",kind:"decision",decisionKind:"choose_target"}}];
      const drained=preview.drained??s.queue.length;
      const queue=preview.drained?s.queue.slice(drained):effectSession.normalizeSpawnedEffects(spawned,scratch,pickup);
      const revision=s.revision+drained;
      const decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      const effects=s.queue.slice(0,drained).map((e,i)=>({effectId:e.effectId,groupId:e.groupId,groupKind:e.groupKind,type:e.type,revision:s.revision+1+i}));
      const cursor=j.replay.length;
      const session=freeze({...checkpoint,replayCursor:cursor+1,session:{...s,workingState:preview.state,queue,
        nextEffectSequence:scratch.nextEffectSequence,nextGroupSequence:scratch.nextGroupSequence,revision,irreversibleBarrier:barrier,
        journal:{...j,decisions:[...j.decisions,decision],events:[...j.events,...preview.events],
          history:[...j.history,...(preview.histories||[preview.history])],effects:[...j.effects,...effects],
          replay:[...j.replay,{cursor,kind:"decision",confirmed:true,...decision}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),barrier,
        inspection:{phase:"awaiting_input",session:{irreversibleBarrier:barrier,decision:{choices:preview.choices}}}};
    }

    function prepareQuietPublicRefill(stored,session,state,refillIndex=1,extraEffects=0,maxMissing=1){
      const missing=state.cards.publicCards.filter(c=>!c).length;
      if(missing<1||missing>maxMissing)return null;
      const refill=session.queue[refillIndex];
      state.cards={...state.cards,publicCards:[...state.cards.publicCards],drawPileCardIds:[...state.cards.drawPileCardIds]};
      // The cached native refill declines reshuffles. The card drawn into the
      // public row remains masked; only root-known post-main plans may continue.
      if(!refillQuietScan4(state,missing))return null;
      const event={type:"publicRefill",count:missing};
      const augmented=localPlans.augmentEffectResult(state,{ok:true,events:[event]},refill);
      if(augmented.spawnedEffects.length||augmented.events.length!==1)return null;
      state.meta.stateVersion=session.baseVersion+1;
      const envelope=provedCommittedEnvelope(stored,state);
      return {envelope,inspection:{phase:"idle",session:null},
        barrier:{effectId:refill.effectId,revision:session.revision+refillIndex+1+extraEffects,code:"hidden_card_reveal",reason:"公共牌补牌翻出新牌"}};
    }

    function quietCurrencyTradeSource(stored,action) {
      if(!resourcePlanning||action.family!=="choose_payment")return null;
      const session=stored.envelope.session?.session,head=session?.queue[0],pending=head?.payload?.decisionContext;
      const start=session?.journal.actions[0]?.action,tradeId=pending?.tradeId;
      if(session?.phase!=="awaiting_input"||session.queue.length!==1||session.interruptContext||session.irreversibleBarrier
        ||session.failure||session.undoFrames.length||head.type!=="standard_action_session_decision"||head.allowQuickActions
        ||head.ownerId!==seatId||pending?.kind!=="discard"||pending.type!=="trade"||pending.playerId!==seatId
        ||!["cards-for-credit","cards-for-energy"].includes(tradeId)||pending.count!==2||pending.required!==true
        ||!Array.isArray(pending.selected)||pending.selected.length>2||new Set(pending.selected).size!==pending.selected.length
        ||start?.family!=="quick_trade"||start.target.tradeId!==tradeId)return null;
      const source=session.workingState,turn=source.turn,p=source.players.players.find(p=>p.id===seatId);
      if(turn.roundNumber!==4||turn.currentPlayerId!==seatId||turn.gameEnded||p.passCompletionPending
        ||turn.cardTurnEventBonuses?.length||turn.type1TriggerEvents?.length
        ||Object.keys(source.aliens.chong?.transportTasksByRocketId||{}).length)return null;
      const known=knownCards(stored.envelope);
      return pending.selected.some(id=>!known.has(id))?null:{session,head,pending,source,p,known,tradeId};
    }

    function previewQuietCurrencyTradeSelection(stored,action){
      if(action.target?.kind!=="discard-hand-card"||stored.informationBarrier)return null;
      const entry=quietCurrencyTradeSource(stored,action);
      if(!entry)return null;
      const {session:s,head,pending,source,p,known,tradeId}=entry,id=action.target.cardInstanceId;
      const selected=[...pending.selected],index=selected.indexOf(id);
      if(!known.has(id)||!p.hand.some(c=>c.id===id)||index<0&&selected.length===2)return null;
      if(index<0)selected.push(id);else selected.splice(index,1);
      const event={type:"quick_trade_discard_selection",tradeId,playerId:seatId,cardInstanceId:id,selected};
      if(cardEffects.collectMatchingTriggers(p,event).length)return null;
      const offered=head.payload.choices.filter(a=>!a.target?.confirm);
      if(offered.length!==p.hand.length||offered.some((a,i)=>a.target?.kind!=="discard-hand-card"
        ||a.target.cardInstanceId!==p.hand[i].id||a.family!=="choose_payment"||!known.has(a.target.cardInstanceId)))return null;
      const choices=offered.map(a=>a.presentation?{...a,presentation:{...a.presentation,selected:selected.includes(a.target.cardInstanceId)}}:a);
      if(selected.length===2)choices.push(...scienceSession.formalizeChoices(source,seatId,[{
        family:"choose_payment",target:{kind:"confirm",confirm:true},payload:{},summary:"确认弃牌（2/2）",
      }]));
      const j=s.journal,cursor=j.replay.length,revision=s.revision+1,nextEffectSequence=s.nextEffectSequence+1,nextGroupSequence=s.nextGroupSequence+1;
      const effect={effectId:head.effectId,groupId:head.groupId,groupKind:head.groupKind,type:head.type,revision};
      const decision={decisionId:head.effectId,decisionVersion:s.revision,ownerId:seatId,choice:action};
      const checkpoint=stored.envelope.session;
      const session=freeze({...checkpoint,replayCursor:cursor+1,session:{...s,revision,nextEffectSequence,nextGroupSequence,
        queue:[{...head,effectId:s.sessionId+":effect:"+nextEffectSequence,groupId:s.sessionId+":group:"+nextGroupSequence,
          source:{parentEffectId:head.effectId,priority:"direct"},payload:{choices,decisionContext:{...pending,selected}}}],
        journal:{...j,decisions:[...j.decisions,decision],events:[...j.events,event],effects:[...j.effects,effect],
          replay:[...j.replay,{cursor,kind:"decision",confirmed:true,...decision}]}}});
      return {envelope:withEnvelopeSession(stored.envelope,session),inspection:{phase:"awaiting_input",session:{decision:{choices}}}};
    }

    function previewQuietCurrencyTrade(stored,action) {
      if(action.target?.confirm!==true)return null;
      const entry=quietCurrencyTradeSource(stored,action);
      if(!entry||entry.pending.selected.length!==2)return null;
      const {session,head,pending,source,p,tradeId}=entry;
      const player={...p,hand:[...p.hand],resources:{...p.resources},blueBonusResources:{...p.blueBonusResources}};
      const next={...source,meta:{...source.meta,stateVersion:session.baseVersion+1},
        cards:{...source.cards,discardPile:[...source.cards.discardPile]},
        players:{...source.players,players:source.players.players.map(q=>q===p?player:q)}};
      for(const id of pending.selected){
        const index=player.hand.findIndex(card=>card.id===id);
        if(index<0)return null;
        const removed=cards.discardFromHandAtIndex(player,index);
        if(!removed.ok)return null;
        cards.addToDiscardPile(next.cards,removed.card);
      }
      const settled=quickTrades.finalizeTradeAfterDiscard(tradeId,next,player);
      if(!settled.ok||settled.awaitingCardSelection)return null;
      const event={type:"quick_trade_payment",tradeId,playerId:seatId,cardInstanceIds:[...pending.selected]};
      const audited=localPlans.augmentEffectResult(next,{ok:true,events:[event]},head);
      return !audited.spawnedEffects.length&&audited.events.length===1?next:null;
    }

    function finishProvedCommittedState(node, stored, action, state) {
      restoreEnvelope(provedCommittedEnvelope(stored, state), true);
      return finishChild({session:null}, {}, movementPlanning ? nextMovementIntent(node, action) : null,
        null, stored.informationBarrier, action, stored);
    }

    function finishProvedTurnBoundary(stored, action, state) {
      const envelope=provedCommittedEnvelope(stored,state), barrier=stored.informationBarrier;
      inheritCardKnowledge(envelope,stored,action);
      // The completed turn never reads the next menu, even when the same
      // seat acts again. Keep a prior information barrier if one was carried.
      const own=state.turn.currentPlayerId===seatId;
      return createNode(envelope,null,[],barrier?"information-barrier":own?"turn-boundary":"other-owner",
        barrier||(own?{code:"own-turn-complete"}:null));
    }

    function expand(node, actionId, previewOnly = false) {
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
      const activeClaim = resourcePlanning && node.status === "stable" && !stored.resourceControl && requested.family === "complete_task"
        ? localPlans.previewFinalPositiveTaskClaim({state:readIdentityState(stored.envelope),seatId,
          action:requested,knownCards:knownCards(stored.envelope)}) : null;
      if (activeClaim) {
        provedActiveFinalTaskInputs++;
        const child = finishProvedCommittedState(node, stored, requested, activeClaim);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const cargoClaim=resourcePlanning&&node.status==="stable"&&!stored.resourceControl&&!stored.intent
        &&requested.family==="complete_task"&&requested.target?.ruleId==="transport"
        ?localPlans.previewChongTransportQuick({state:readIdentityState(stored.envelope),seatId,action:requested,
          knownCards:knownCards(stored.envelope),knownFossilIds:visibleRootCargo()}):null;
      if(cargoClaim){
        const child=finishProvedCommittedState(node,stored,requested,cargoClaim);
        provedChongTransportInputs++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const tracePreview=resourcePlanning&&node.status==="stable"&&!stored.resourceControl&&!stored.intent
        &&stored.informationBarrier&&requested.family==="complete_task"&&requested.target?.ruleId==="trace"
        ?localPlans.previewChongTraceMenu({state:readIdentityState(stored.envelope),seatId,action:requested,
          knownCards:knownCards(stored.envelope)}):null;
      const traceMenu=tracePreview&&makeChongTraceMenu(stored,requested,tracePreview);
      if(traceMenu){
        const child=finishChild({session:null},{},null,null,stored.informationBarrier,requested,stored,traceMenu);
        provedChongTraceMenus++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const taskSession=stored.envelope.session?.session;
      const pairedTrace=taskSession&&pairedTracePickupScope(taskSession.workingState,taskSession);
      const pinkTraceCards=resourcePlanning&&node.status==="decision"&&!stored.resourceControl&&taskSession
        &&requested.family==="choose_target"&&(requested.target?.traceType==="pink"||pairedTrace&&requested.target?.traceType
          ||requested.target?.traceType==="blue"&&taskSession.journal.actions[0]?.action?.family==="analyze"
          ||requested.target?.traceType==="yellow"&&taskSession.queue[0]?.payload?.cardEffect?.id==="b32-yellow-trace")
        &&knownCards(stored.envelope);
      const species=pinkTraceCards&&requested.target?.speciesId;
      const knownDisplay=species&&(species==="chong"?knownChongDisplayIndex:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex);
      const traceCard=pinkTraceCards&&cardPickPlanning&&["amiba","chong"].includes(species)
        &&Number.isSafeInteger(knownDisplay)&&taskSession.workingState.aliens[species]?.displayedCardIndex===knownDisplay
        ?residualSession.previewPinkTraceCardMenu(taskSession,requested,pinkTraceCards,pairedTrace):null;
      const traceCardMenu=traceCard&&prepareDecisionContinuation(stored,traceCard.state,requested,traceCard,true);
      if(traceCardMenu){
        const child=finishChild({session:{irreversibleBarrier:taskSession.irreversibleBarrier}},{},
          movementPlanning?nextMovementIntent(node,requested):null,null,stored.informationBarrier,requested,stored,traceCardMenu.prepared);
        provedPinkCardMenus++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const plainPink=pinkTraceCards&&!pairedTrace?localPlans.previewLastPlainPinkTrace(taskSession,requested,pinkTraceCards):null;
      if(plainPink){
        const child=finishProvedCommittedState(node,stored,requested,plainPink);
        provedLastPlainPinkInputs++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const pinkFossil=pinkTraceCards?localPlans.previewPinkTraceFossilMenu(taskSession,requested,pinkTraceCards,pairedTrace):null;
      if(pinkFossil){
        const prepared=prepareQuietTailMenu(stored,requested,pinkFossil);
        const child=finishChild({session:{irreversibleBarrier:taskSession.irreversibleBarrier}},{},
          movementPlanning?nextMovementIntent(node,requested):null,null,stored.informationBarrier,requested,stored,prepared);
        provedPinkFossilMenus++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const pinkBeforeRefill=pinkTraceCards&&!pairedTrace?localPlans.previewPinkTraceBeforeRefill(taskSession,requested,pinkTraceCards):null;
      const pinkRefill=pinkBeforeRefill&&prepareQuietPublicRefill(stored,taskSession,pinkBeforeRefill.state,
        1,Number(pinkBeforeRefill.regionSettled),2);
      if(pinkRefill){
        restoreEnvelope(pinkRefill.envelope,true);
        const child=finishChild({session:{irreversibleBarrier:taskSession.irreversibleBarrier}},
          {irreversibleBarrier:pinkRefill.barrier},movementPlanning?nextMovementIntent(node,requested):null,
          null,stored.informationBarrier,requested,stored,pinkRefill);
        provedPinkRefills++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const queuedPreview=resourcePlanning&&node.status==="decision"&&!stored.resourceControl&&!stored.intent
        &&stored.informationBarrier&&taskSession?.queue[0]?.payload?.kind==="chong_task"&&requested.family==="accept_optional_effect"
        ?localPlans.previewQuietQueuedChongTask({state:taskSession.workingState,seatId,session:taskSession,action:requested,
          knownCards:knownCards(stored.envelope),knownFossilIds:visibleRootCargo()}):null;
      const queuedTask=queuedPreview&&makeChongQueuedTask(stored,requested,queuedPreview);
      if(queuedTask){
        const child=finishChild({session:null},{},null,null,stored.informationBarrier,requested,stored,queuedTask);
        provedChongQueuedTasks++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const traceSkip=resourcePlanning&&node.status==="decision"&&!stored.resourceControl&&!stored.intent
        &&stored.informationBarrier&&taskSession&&requested.family==="accept_optional_effect"
        ?localPlans.previewQuietChongTraceSkip({state:taskSession.workingState,seatId,session:taskSession,
          action:requested,knownCards:knownCards(stored.envelope)}):null;
      if(traceSkip){
        // The previous information barrier still closes the new turn.
        const child=finishProvedTurnBoundary(stored,requested,traceSkip);
        provedChongTraceSkips++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const amibaYellow=resourcePlanning&&node.status==="decision"&&!stored.resourceControl&&!stored.informationBarrier
        &&taskSession&&requested.family==="accept_optional_effect"
        ?localPlans.previewQuietAmibaYellowLanding(taskSession,requested,knownCards(stored.envelope)):null;
      if(amibaYellow){
        provedAmibaYellowLandingInputs++;
        const child=finishProvedCommittedState(node,stored,requested,amibaYellow);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const endClaim=resourcePlanning&&node.status==="decision"&&!stored.resourceControl&&taskSession&&requested.family==="accept_optional_effect"
        ?localPlans.previewFinalPositiveEndTask({state:taskSession.workingState,seatId,actions:node.legalActions,
          session:taskSession,action:requested,knownCards:knownCards(stored.envelope)}):null;
      if(endClaim){
        provedFinalEndTaskInputs++;
        const child=finishProvedTurnBoundary(stored,requested,endClaim);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const chongEndPrelude=resourcePlanning&&node.status==="stable"&&!stored.resourceControl&&!stored.intent
        &&stored.informationBarrier&&requested.family==="end_turn"&&knownRootAlienIds.has("虫")
        ?localPlans.previewQuietChongEndPrelude({state:readIdentityState(stored.envelope),seatId,action:requested,
          knownCards:knownCards(stored.envelope)}):null;
      const chongEndMenu=chongEndPrelude&&makeChongEndMenu(stored,requested,chongEndPrelude);
      if(chongEndMenu){
        const child=finishChild({session:null},{},null,null,stored.informationBarrier,requested,stored,chongEndMenu);
        provedChongEndMenus++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const markSource=resourcePlanning&&node.status==="stable"&&!stored.resourceControl&&requested.family==="end_turn"
        ?readIdentityState(stored.envelope):null;
      const quietMark=markSource&&(quietFinalRoundMark(markSource)||markSource.turn.roundNumber===3&&quietEarlySameSeatHandover(markSource))
        &&localPlans.quietSingleEndMark(markSource,seatId);
      const markMenu=quietMark&&makeQuietEndMark(stored,requested,markSource);
      if(markMenu){
        const child=finishChild({session:null},{},movementPlanning?nextMovementIntent(node,requested):null,
          null,stored.informationBarrier,requested,stored,markMenu);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const markState=taskSession?.workingState;
      const markCommit=resourcePlanning&&node.status==="decision"&&!stored.resourceControl&&requested.family==="choose_target"
        &&taskSession?.queue[0]?.type==="residual_final_mark"&&taskSession.phase==="awaiting_input"
        &&!taskSession.failure&&!taskSession.interruptContext&&!taskSession.irreversibleBarrier&&!taskSession.undoFrames.length
        &&(quietFinalRoundMark(markState)||markState.turn.roundNumber===3&&quietEarlySameSeatHandover(markState))&&quietEndMarkTail(taskSession.queue,markState)
        ?localPlans.previewSingleEndMarkCommit({state:markState,seatId,tileId:requested.target.tileId,
          action:taskSession.journal.actions[0]?.action,knownCards:knownCards(stored.envelope)}):null;
      if(markCommit){
        const child=finishProvedTurnBoundary(stored,requested,markCommit);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const endPrelude=resourcePlanning&&node.status==="stable"&&!stored.resourceControl&&requested.family==="end_turn"
        ?localPlans.previewFinalEndPrelude({state:readIdentityState(stored.envelope),seatId,
          action:requested,knownCards:knownCards(stored.envelope),allowSameSeat:true,allowQuietEarlyRound:isUnrevealedRoundThree(readIdentityState(stored.envelope))
            ||quietEarlySameSeatHandover(readIdentityState(stored.envelope))}):null;
      if(endPrelude?.finished){
        const child=finishProvedTurnBoundary(stored,requested,endPrelude.finished);
        if(endPrelude.finished.turn.currentPlayerId===seatId)provedOwnEndHandovers++;
        else provedQuietEndHandovers++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const endMenu=endPrelude?.task&&makeQuietEndPrelude(stored.envelope,requested,endPrelude);
      if(endMenu){
        const child=finishChild({session:null},{},movementPlanning?nextMovementIntent(node,requested):null,
          null,stored.informationBarrier,requested,stored,endMenu);
        provedQuietEndMenus++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const moveSource=node.status==="stable"&&quietPaidMoveSource(stored,requested,true);
      const moveEvent={type:"move_payment_requested",playerId:seatId,rocketId:requested.target?.rocketId};
      const quietMoveMenu=moveSource&&!cardEffects.hasMatchingTrigger(moveSource.player,moveEvent);
      const moveMenu=quietMoveMenu&&makeMoveMenu(stored,requested,moveSource.state);
      if(moveMenu){
        const child=finishChild({session:null},{},nextMovementIntent(node,requested),null,stored.informationBarrier,requested,stored,moveMenu);
        provedMoveMenus++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const paidMove=previewQuietMovePayment(stored,requested);
      if(paidMove){
        const envelope=provedCommittedEnvelope(stored,paidMove);
        restoreEnvelope(envelope);
        const child=finishChild({session:null},{},nextMovementIntent(node,requested),null,stored.informationBarrier,requested,stored,
          {envelope,inspection:{phase:"idle",session:null}});
        provedMovePayments++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const publicScan=previewQuietPublicScan(node,stored,requested);
      if(publicScan){
        const child=finishChild({session:null},{},nextMovementIntent(node,requested),null,null,requested,stored,publicScan);
        provedPublicScanChoices++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const scanAction=previewQuietScan4Action(node,stored,requested);
      if(scanAction){
        let prepared=scanAction.prepared;
        if(!prepared){
          const envelope=provedCommittedEnvelope(stored,scanAction.next);
          restoreEnvelope(envelope);
          prepared={envelope,inspection:{phase:"idle",session:null}};
        }
        const child=finishChild({session:{irreversibleBarrier:null}},{irreversibleBarrier:scanAction.barrier},
          nextMovementIntent(node,requested),
          stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null,
          stored.informationBarrier,requested,stored,prepared);
        if(requested.target.mode==="move")provedScan4QuietMoves++;
        else provedScan4QuietLaunchSkips++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const alienDisplay=previewQuietAlienDisplay(node,stored,requested);
      if(alienDisplay){
        restoreEnvelope(alienDisplay.envelope);
        const child=finishChild({session:{irreversibleBarrier:taskSession.irreversibleBarrier}},
          {irreversibleBarrier:alienDisplay.barrier},movementPlanning?nextMovementIntent(node,requested):null,
          stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null,
          stored.informationBarrier,requested,stored,alienDisplay);
        provedAlienDisplays++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const fixedScan=previewQuietSpecifiedScan(node,stored,requested);
      if(fixedScan){
        restoreEnvelope(fixedScan.envelope);
        const child=finishChild({session:{irreversibleBarrier:taskSession.irreversibleBarrier}},
          {irreversibleBarrier:fixedScan.barrier},movementPlanning?nextMovementIntent(node,requested):null,
          stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null,
          stored.informationBarrier,requested,stored,fixedScan);
        provedQuietSpecifiedScans++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const researchPick=previewFixedResearchPick(node,stored,requested);
      const researchSelection=previewFixedResearchSelection(node,stored,requested);
      const research=researchPick||researchSelection;
      const emptyAmibaResearch=resourcePlanning&&node.status==="decision"&&requested.family==="accept_optional_effect"&&taskSession
        ?localPlans.previewEmptyAmibaResearchTrigger(taskSession,requested,knownCards(stored.envelope)):null;
      if(research||emptyAmibaResearch){
        const before={session:{irreversibleBarrier:taskSession.irreversibleBarrier}},barrier=research?.barrier;
        const control=stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"
          ?stored.resourceControl:null;
        let prepared=research?.prepared;
        if(!prepared){
          const envelope=provedCommittedEnvelope(stored,research?.state||emptyAmibaResearch);
          restoreEnvelope(envelope,true);
          prepared={envelope,inspection:{phase:"idle",session:null}};
        }
        const child=finishChild(before,{irreversibleBarrier:barrier},movementPlanning?nextMovementIntent(node,requested):null,
          control,stored.informationBarrier,requested,stored,prepared);
        if(researchPick)provedResearchPicks++;else if(researchSelection)provedResearchSelections++;else provedEmptyAmibaResearch++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const fixedBluePick=previewFixedBluePickSettlement(node,stored,requested);
      if(fixedBluePick){
        const boundary={effectId:taskSession.queue[0].effectId,revision:taskSession.revision+1,
          code:"hidden_card_reveal",reason:"公共牌补牌翻出新牌"};
        const envelope=provedCommittedEnvelope(stored,fixedBluePick);
        restoreEnvelope(envelope);
        const child=finishChild({session:{irreversibleBarrier:null}},{irreversibleBarrier:boundary},
          movementPlanning?nextMovementIntent(node,requested):null,null,stored.informationBarrier,requested,stored,
          {envelope,inspection:{phase:"idle",session:null}});
        provedBluePickSettlements++;
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const resourceCorner=resourcePlanning&&node.status==="stable"&&!stored.resourceControl
        &&requested.family==="card_corner"&&requested.payload?.kind==="resource"
        ?localPlans.previewQuietResourceCorner(readIdentityState(stored.envelope),requested,knownCards(stored.envelope),isUnrevealedRoundThree(readIdentityState(stored.envelope))):null;
      if(resourceCorner){
        provedFinalResourceCorners++;
        return rememberPrefix(key,node,actionId,remember(key,finishProvedCommittedState(node,stored,requested,resourceCorner)));
      }
      const quietSource = quietDataMenuSource(stored, requested);
      const menuPreview = quietSource && makeQuietDataMenu(stored.envelope, quietSource, requested);
      if (menuPreview) {
        // Native still enumerates the exact legal menu on this isolated
        // session. Only its already witnessed, inert opening is reused.
        const choices = scienceSession.formalizeChoices(quietSource, seatId, scienceSession.listPlaceDataChoices(quietSource, seatId));
        if (!choices.length) throw new Error("ANALYSIS_FIXED_DATA_MENU_EMPTY");
        const inspection = {phase:"awaiting_input", session:{decision:{choices}}};
        provedFinalDataMenuInputs++;
        const child = finishChild({session:null}, {}, movementPlanning ? nextMovementIntent(node, requested) : null,
          null, stored.informationBarrier, requested, stored, {envelope:menuPreview, inspection});
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const dataReward=previewDataRewardMenu(stored,requested);
      const rewardMenu=dataReward&&makeDataRewardMenu(stored.envelope,requested,dataReward);
      if(rewardMenu){
        const choices=scienceSession.formalizeChoices(dataReward.state,seatId,dataReward.choices);
        if(!choices.length)throw Error("ANALYSIS_FIXED_DATA_REWARD_MENU_EMPTY");
        if(dataReward.type===scienceSession.EFFECT_TYPES.INCOME)provedComputerIncomeMenus++;else provedBlueTwoPickInputs++;
        const inspection={phase:"awaiting_input",session:{decision:{choices}}};
        const child=finishChild({session:null},{},movementPlanning?nextMovementIntent(node,requested):null,
          null,stored.informationBarrier,requested,stored,{envelope:rewardMenu,inspection});
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const currencyIncome=previewCurrencyIncome(stored,requested);
      if(currencyIncome){
        provedCurrencyIncomeInputs++;
        return rememberPrefix(key,node,actionId,remember(key,finishProvedCommittedState(node,stored,requested,currencyIncome)));
      }
      const fixedData = previewQuietFinalDataPlacement(stored, requested);
      if (fixedData) {
        const {kind, state} = fixedData;
        // The stored menu already owns the precise legal decision. Only the
        // placement with no unresolved effect is reconstructed in this isolated fork.
        // Prefix accounting still charges the exact logical input for the witness.
        provedFinalDataPlacements[kind] = (provedFinalDataPlacements[kind] || 0) + 1;
        const child = finishProvedCommittedState(node, stored, requested, state);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const currencySelection=previewQuietCurrencyTradeSelection(stored,requested);
      if(currencySelection){
        const control=stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null;
        const child=finishChild({session:null},{},movementPlanning?nextMovementIntent(node,requested):null,
          control,stored.informationBarrier,requested,stored,currencySelection);
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      const currencyTrade=previewQuietCurrencyTrade(stored,requested);
      if(currencyTrade){
        const envelope=provedCommittedEnvelope(stored,currencyTrade);
        restoreEnvelope(envelope);
        const control=stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null;
        const child=finishChild({session:null},{},movementPlanning?nextMovementIntent(node,requested):null,
          control,stored.informationBarrier,requested,stored,{envelope,inspection:{phase:"idle",session:null}});
        return rememberPrefix(key,node,actionId,remember(key,child));
      }
      if(previewOnly)return null;
      restoreEnvelope(stored.envelope, true);
      const { before, result } = executeCurrent(requested);
      const child = finishChild(before, result, movementPlanning ? nextMovementIntent(node, requested) : null,
        stored.resourceControl&&resourceStep(node,stored.resourceControl.goal,stored.resourceControl.operation).kind!=="complete"?stored.resourceControl:null,
        stored.informationBarrier, requested, stored);
      if(queuedPreview&&!chongQueuedTemplates.has(chongQueuedKey(stored,queuedPreview)))rememberChongQueuedTask(stored,requested,child,queuedPreview);
      if(chongEndPrelude&&!chongEndTemplates.has(chongEndPrelude.shape))rememberChongEndMenu(requested,child,chongEndPrelude);
      if(tracePreview&&!chongTraceMenuTemplate)rememberChongTraceMenu(requested,child,tracePreview);
      if(quietMoveMenu&&!moveMenuTemplate)rememberMoveMenu(child,requested);
      if(quietMark&&!quietEndMarkTemplate)rememberQuietEndMark(requested,child,markSource);
      if(endPrelude?.task&&!quietEndPreludeTemplate)rememberQuietEndPrelude(requested,child,endPrelude);
      if (quietSource && !quietDataMenuTemplate) rememberQuietDataMenu(requested, child);
      if(dataReward&&!dataRewardMenuTemplates.has(dataReward.type))rememberDataRewardMenu(stored,requested,dataReward,child);
      return rememberPrefix(key,node,actionId,remember(key,child));
    }

    function setMovementPlanning(enabled) {
      movementPlanning = enabled === true;
      if (movementPlanning && openedRoot) {
        const stored = nodes.get(openedRoot);
        if (!stored.intent) {
          stored.intent = recoverMovementIntent(stored.envelope);
          if (stored.intent) {
            stored.policyKey=undefined;
            stored.identity=nodeIdentity(stored.physicalId,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope));
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
      const chong=state.aliens.chong,hideChong=chong?.displayedCardIndex!=null&&chong.displayedCardIndex!==knownChongDisplayIndex;
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

    // Only the named public supplier, backed by its already-earned task.
    function blueLaunchTaskSupply(state,known){
      const t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||!p||p.mainActionCompleted
        ||p.passCompletionPending||p.industryBorrowedTechTileId||t.cardTurnEventBonuses?.length
        ||p.resources.availableData<1||p.resources.availableData!==p.dataState.poolTokens.length
        ||localPlans.hasPendingFossilArrival(state))return null;
      const scan=p.hand.find(c=>c.cardId==="b_9.webp"&&known.has(c.id));
      if(!scan)return null;
      const launch=state.cards.publicCards.filter(c=>c?.cardId==="b_60.webp"&&known.has(c.id));
      if(launch.length!==1)return null;
      const [card]=launch,model=cardEffects.getCardModel(card),task=model?.tasks?.[0],cost=cardEffects.getCardPlayCost(card);
      if(model?.cardType!==2||model.tasks.length!==1||task?.condition.type!=="planetOrbitOrLand"
        ||model.playEffects?.length!==2||model.playEffects[0].type!=="launch"||model.playEffects[1].type!=="gain_data"
        ||Object.keys(cost).length!==1||cost.credits!==3||p.resources.credits<cost.credits+cardEffects.getCardPlayCost(scan).credits
        ||!cardEffects.taskConditionMet(task,p,state)
        ||rocketAbilities.getActiveRocketCountForPlayer(state.pieces,p.id)>=rocketAbilities.getRocketLimitForPlayer(p,state))return null;
      const count=data.listComputerPlacedTokens(p).length;
      const slots=data.listBluePlacementRequirements(p).filter(r=>r.requiredComputerSlot<=count
        &&data.getBlueBonusPlacementReward(p,r.blueSlot)?.type==="choose_card");
      if(slots.length!==1)return null;
      const blueSlot=slots[0].blueSlot;
      if(cardEffects.collectMatchingTriggers(p,{type:"placeData",playerId:seatId,placementKind:"blueBonus",blueSlot}).length)return null;
      return {id:"data:known-launch-task:"+card.id,kind:"blue-launch-task",required:{},
        blueSlot,cardId:card.id,scanId:scan.id,price:cost.credits};
    }

    function blueLaunchTaskStep(node,session,goal){
      const head=session?.queue?.[0];
      const a=node.legalActions.find(a=>node.status==="stable"?a.family==="place_data"
        :head?.type===scienceSession.EFFECT_TYPES.PLACE_DATA?a.family==="choose_target"&&a.target?.blueSlot===goal.blueSlot
        :head?.type===scienceSession.EFFECT_TYPES.PICK_CARD&&head.payload.blueBonusSource
          &&a.family==="choose_card"&&a.target?.cardInstanceId===goal.cardId);
      return a?{kind:"fixed",actionId:a.actionId,reason:"free-blue-slot-for-known-launch-task"}
        :{kind:"infeasible",reason:"known-blue-launch-supply-menu-changed"};
    }

    function blueLaunchContinuationSource(){
      const stored=nodes.get(openedRoot),session=stored?.envelope.session?.session,head=session?.queue[0];
      if(!stored||stored.informationBarrier||!["stable","decision"].includes(openedRoot.status))return null;
      if(session&&(session.failure||session.interruptContext||session.irreversibleBarrier||head?.ownerId!==seatId
        ||session.journal.actions[0]?.action.family!=="place_data"
        ||![scienceSession.EFFECT_TYPES.PLACE_DATA,scienceSession.EFFECT_TYPES.PICK_CARD].includes(head.type)))return null;
      const base=session?.baseState||readPlanningState(stored),goal=blueLaunchTaskSupply(base,knownRootCardIds);
      if(!goal||!knownRootAlienIds.has("阿米巴")||!Number.isSafeInteger(base.aliens.amiba?.displayedCardIndex))return null;
      if(head?.type===scienceSession.EFFECT_TYPES.PICK_CARD
        &&(!head.payload.blueBonusSource||!session.journal.decisions.some(({choice})=>choice?.family==="choose_target"
          &&choice.target?.target==="blueBonus"&&choice.target.blueSlot===goal.blueSlot)))return null;
      const next=blueLaunchTaskStep(openedRoot,session,goal);
      if(!next.actionId)return null;
      return {...goal,firstId:next.actionId,display:base.aliens.amiba.displayedCardIndex};
    }

    // A single bounded witness, separate from the ordinary graph. Match
    // only root-known cards, one unambiguous sector and public rewards.
    // Actual new reveals never enter the action choice or leaf valuation.
    function quoteBlueLaunchContinuation(source,evaluate,admit){
      const root=nodes.get(openedRoot),comp=fork.composition||fork,previous=loadedEnvelope||root.envelope,first=submissionCount;
      const owner=s=>s.players.players.find(p=>p.id===seatId),initial=readIdentityState(root.envelope);
      let e=root.envelope,barrier=null,recording=true;
      const prefix=[],state=()=>readIdentityState(e);
      const menu=()=>legalActions(comp);
      const one=pred=>{const matches=menu().filter(pred);return matches.length===1?matches[0]:null;};
      const input=a=>{
        if(!a||a.actorId!==seatId||a.target?.source==="blind"
          ||a.target?.cardInstanceId&&!knownCards(e).has(a.target.cardInstanceId)
          ||submissionCount-first>=16||!admit(submissionCount-first,submissionCount))return false;
        const before=e;if(recording)prefix.push({envelope:e,actions:menu(),action:a});
        restoreEnvelope(e,true);
        const r=executeCurrent(a).result;e=snapshot(comp);
        inheritCardKnowledge(e,{envelope:before},a);
        const reveal=r.irreversibleBarrier||e.session?.session?.irreversibleBarrier;
        if(reveal){
          if(!["hidden_card_reveal","hidden_alien_card"].includes(reveal.code))return false;
          barrier ||= reveal;
        }
        const t=state().turn,rng=state().meta.rngState;
        return t.roundNumber===initial.turn.roundNumber&&t.turnNumber===initial.turn.turnNumber
          &&t.currentPlayerId===seatId&&rng?.algorithm===initial.meta.rngState?.algorithm
          &&rng?.state===initial.meta.rngState?.state;
      };
      const occupied=s=>data.listComputerPlacedTokens(owner(s)).map(x=>x.placementSlot).join(",");
      const tokens=(s,id)=>data.listNebulaTokens(s.data,id);
      const open=(s,id)=>tokens(s,id).filter(x=>!x.replacedByPlayerId&&!x.replacedByPlayerColor).length;
      try{
        restoreEnvelope(e);
        if(!e.session&&!input(one(a=>a.family==="place_data")))return null;
        if(e.session?.session?.queue[0]?.type===scienceSession.EFFECT_TYPES.PLACE_DATA
          &&!input(one(a=>a.target?.target==="blueBonus"&&a.target.blueSlot===source.blueSlot)))return null;
        if(!input(one(a=>a.family==="choose_card"&&a.target?.cardInstanceId===source.cardId))||e.session||!barrier)return null;
        recording=false;
        if(!input(one(a=>a.family==="play_card"&&a.target?.cardInstanceId===source.scanId)))return null;
        const s=state(),p=owner(s);
        if(s.aliens.amiba?.displayedCardIndex!==source.display||occupied(s)!=="1,2,3,4")return null;
        const select=one(a=>{
          const id=a.target?.nebulaId;
          return a.family==="choose_target"&&id&&knownRootNebulaIds.has(id)&&id!==data.AOMOMO_NEBULA_ID&&open(s,id)===2
            &&tokens(s,id).filter(x=>x.replacedByPlayerId===seatId||x.replacedByPlayerColor===p.color).length+2>tokens(s,id).length/2;
        });
        if(!select||!input(select))return null;
        const sector=select.target.nebulaId;
        const side=one(a=>{
          const id=a.target?.nebulaId,c=state().cards.publicCards[a.target?.publicSlotIndex];
          return a.family==="choose_card"&&id&&id!==sector&&id!==data.AOMOMO_NEBULA_ID
            &&c&&knownRootCardIds.has(c.id)&&c.cardId==="dlc_15.png"&&open(state(),id)>1
            &&tokens(state(),id).filter(x=>!x.replacedByPlayerId&&!x.replacedByPlayerColor)
              .every(x=>data.getNebulaSlotScoreReward(id,x.slotIndex)===0);
        });
        if(!input(side)||!input(one(a=>a.family==="choose_card"&&a.target?.done))
          ||!input(one(a=>a.family==="choose_target"&&a.target?.mode==="skip"))
          ||!input(one(a=>a.family==="choose_target"&&a.target?.nebulaId===sector)))return null;
        const trace=one(a=>a.family==="choose_target"&&a.target?.speciesId==="amiba"
          &&a.target.traceType==="pink"&&a.target.position===4);
        if(!input(trace)||!input(one(a=>a.family==="choose_card"&&a.target?.source==="display"
          &&a.target.cardIndex===source.display&&a.target.choiceId===`amiba:display:${source.display}`))||e.session)return null;
        if(!input(one(a=>a.family==="place_data"))
          ||!input(one(a=>a.target?.target==="computer"))||e.session||occupied(state())!=="1,2,3,4,5")return null;
        const cash=data.listBluePlacementRequirements(owner(state())).filter(x=>x.requiredComputerSlot<=5
          &&data.getBlueBonusPlacementReward(owner(state()),x.blueSlot)?.credits===1);
        if(cash.length!==1||!input(one(a=>a.family==="place_data"))
          ||!input(one(a=>a.target?.target==="blueBonus"&&a.target.blueSlot===cash[0].blueSlot))||e.session)return null;
        const after=state(),done=owner(after);
        const won=s=>(s.data.sectorSettlements.winsByPlayerId[seatId]||[]).filter(w=>w.sectorId===sector).length;
        if(won(after)!==won(initial)+1||!done.mainActionCompleted||done.resources.credits<source.price||!done.hand.some(c=>c.id===source.cardId)
          ||after.cards.publicCards.some(c=>c?.id===source.cardId)||!menu().some(a=>a.family==="end_turn")
          ||localPlans.hasPendingFossilArrival(after))return null;
        const detail=evaluate.details(observeEnvelope(e,barrier,true));
        return {actionId:source.firstId,value:detail.value,realization:-detail.unrealizedPurposeValue,
          preparationDebt:detail.purposePreparationDebt,cardId:source.cardId,
          scanId:source.scanId,sector,blueSlot:source.blueSlot,
          prefix:prefix.map(({envelope,actions,action})=>({
            node:envelope===root.envelope?openedRoot:createNode(envelope,null,actions,envelope.session?"decision":"stable"),action,
          }))};
      }finally{restoreEnvelope(previous);}
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
        knownChongDisplayIndex:knownRootAlienIds.has("虫")?knownChongDisplayIndex:null,
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
          stored.identity=nodeIdentity(stored.physicalId,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope));
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

    function setDecisionPlanning(options={}){finalMarkPlanning=options.finalMarkPlanning===true;scanPlanning=options.scanPlanning===true;rankKnownFossilTraces=options.rankKnownFossilTraces===true;localSpecs=new WeakMap();resourceSpecs=new WeakMap();}
    const chongTaskPeekBoundaries = new WeakMap(), chongDirectClaims = new Map();
    function chongClaimKey(stored, cardId) {
      // Queue identity still governs executable nodes. This key is only for
      // the closed value after the shared task settlement and before a peek.
      const state = readIdentityState(stored.envelope);
      const physical = forwardIdentity({},
        "chong-claim-value", null, state, normalizedIdentityStates, identitySubtrees);
      return JSON.stringify([cardId, stored.informationBarrier?.code || null, cardKnowledgeKey(stored.envelope), physical]);
    }

    function pairedChongClaimBoundary(node, actionId) {
      const stored = nodes.get(node), session = stored?.envelope.session?.session, head = session?.queue?.[0];
      if (!fork || !chongDirectClaims.size || node.status !== "decision" || stored.intent || stored.resourceControl
        || head?.type !== "residual_card_decision" || head.ownerId !== seatId || head.allowQuickActions || session.interruptContext
        || session.journal?.actions?.[0]?.action?.family !== "end_turn") return null;
      const task = head.payload;
      if (task?.kind !== "chong_task" || task.ruleId !== "trace" || task.chooseFossilRewardOnly !== true) return null;
      if (!node.legalActions.some(a => a.actionId === actionId && a.actorId === seatId && a.family === "accept_optional_effect"
        && a.target.choiceId === `confirm:chong_task:${task.cardInstanceId}:trace`)) return null;
      return chongDirectClaims.get(chongClaimKey(stored, task.cardInstanceId)) || null;
    }

    function chongTaskPeekBoundary(node, actionId) {
      const stored = nodes.get(node), session = stored?.envelope.session?.session;
      const head = session?.queue?.[0];
      if (!fork || node.status !== "decision" || stored.intent || stored.resourceControl
        || stored.informationBarrier && !["tech_bonus_reveal", "hidden_card_reveal", "hidden_alien_card"].includes(stored.informationBarrier.code)
        || head?.type !== "residual_chong_task_fossil" || head.ownerId !== seatId || head.payload?.planetId
        || head.allowQuickActions || session.interruptContext) return null;
      const action = node.legalActions.find(a => a.actionId === actionId);
      const planetId = action?.target?.planetId;
      if (action?.family !== "choose_target" || action.actorId !== seatId
        || !["jupiter", "saturn"].includes(planetId) || action.target.choiceId !== `chong-task-planet:${planetId}`) return null;
      const state = readIdentityState(stored.envelope);
      const fossils = chong.getAvailablePlanetFossils(state.aliens, planetId);
      if (!fossils.length || fossils.some(f => f.visibleToPlayerIds?.includes(seatId))) return null;
      let boundary = chongTaskPeekBoundaries.get(node);
      if (!boundary) {
        // Selecting an unseen planet writes private knowledge only. The
        // public ledger is the existing checkpoint; this leaf cannot expand.
        // A prior alien-card refill does not change that ledger. Use the
        // same inherited card knowledge when projecting this closed leaf.
        boundary = createNode(stored.envelope, null, [], "information-barrier", { code: "hidden_chong_task_fossils" });
        chongTaskPeekBoundaries.set(node, boundary);
      }
      return boundary;
    }

    function quietScanTracePlan(node,stored,state){
      const session=stored.envelope.session?.session,head=session?.queue?.[0];
      if(!scanPlanning||!movementPlanning||!cardPickPlanning||stored.intent?.path.length||stored.informationBarrier
        ||session?.journal?.actions?.[0]?.action?.family!=="scan"||session.queue.length!==2
        ||head.type!==scienceSession.EFFECT_TYPES.ALIEN_TRACE||head.ownerId!==seatId
        ||head.payload?.traceType!=="pink"||Object.keys(head.payload).length!==1
        ||session.queue[1].type!==scienceSession.EFFECT_TYPES.PUBLIC_REFILL
        ||!openedRoot.legalActions.some(a=>a.family==="complete_task"&&a.target?.ruleId==="transport"))return null;
      const owner=state.players.players.find(p=>p.id===seatId);
      if(state.turn.roundNumber!==4||!owner.mainActionCompleted||owner.resources.availableData!==6
        ||owner.industryBorrowedTechTileId||state.turn.cardTurnEventBonuses?.length
        ||!state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        ||Object.values(state.aliens.aliens).some(slot=>!slot.revealed||!knownRootAlienIds.has(slot.alienId)||alienState.isAlienReadyToReveal(slot))
        ||!owner.hand.every(c=>knownCards(stored.envelope).has(c.id))
        ||!owner.reservedCards.every(c=>knownRootCardIds.has(c.id))
        ||data.listComputerPlacedTokens(owner).length<4||data.listBluePlacementRequirements(owner).length)return null;
      const transition=previewTurn(state);
      if(!transition.turnAdvanced||transition.roundAdvanced||transition.gameEnded||transition.nextPlayerId!==seatId)return null;
      const cargo=localPlans.knownDeliveredCargo({state,seatId,knownCards:knownRootCardIds,knownFossilIds:visibleRootCargo()});
      if(Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length&&!cargo)return null;
      const passiveChong=c=>c.id===cargo?.card.id||c.set==="alien:虫"&&cardEffects.getCardModel(c)?.cardType===3
        &&endScoring.resolveCardEndGameRule(c,cardEffects)?.kind==="chongTraceCount"
        &&!cardEffects.getCardModel(c)?.triggers?.length&&!cardEffects.getCardModel(c)?.tasks?.length
        &&!c.chongTask&&!chong.getCardTask(c);
      if(owner.reservedCards.some(c=>c.set==="alien:虫"&&!passiveChong(c)))return null;
      const native=productionKernel||globalThis.SetiProductionKernel;
      const noUse=(preview,p,capital)=>{
        if(!quietTailHasNoAcquisition(preview,capital)||blueLandingGoalFor(preview))return false;
        if(resourceDemand.catalog({state:preview,seatId,requirements:{bluePlacements:[]}}).some(goal=>{
          if(goal.kind!=="computer-prefix")return true;
          const q=localPlans.computerCompletion({state:preview,seatId,goal});
          return q.available&&q.selected;
        }))return false;
        const objective=goalMovement.plan({state:preview,seatId,actions:[{family:"end_turn",actionId:"trace-proof-quiet-end"}],status:"stable",intent:stored.intent,objectiveOnly:true,routeCache:movementRouteCache,
          endpoints:()=>native.getProbeRouteRequirements(preview,seatId)?.candidates||[],compareTiming:timingForOneGoalQuery(preview)});
        goalMovementGeometryNodes+=objective?.routingNodes||0;
        const guard={...preview,aliens:{...preview.aliens,chong:{...preview.aliens.chong,transportTasksByRocketId:{}}},
          players:{...preview.players,players:preview.players.players.map(q=>q===p?{...p,reservedCards:p.reservedCards.filter(c=>!passiveChong(c))}:q)}};
        return !objective?.intent?.path.length&&hasPostMainInertReservations(guard,false,true,true);
      };
      const ranks=[],open=[];
      for(const a of node.legalActions){
        const preview=localPlans.previewQuietPinkTrace({state,seatId,action:a});
        if(!preview){open.push(a.actionId);continue;}
        const {state:q,player:p}=preview,end=localPlans.quietEndCompletion({state:q,seatId});
        if(!end.available||end.markedTiles.length||end.netGain)return null;
        const capital=resourceDemand.planningCapital(q,p);
        if(!noUse(q,p,capital))return null;
        const quote=cargo&&quietCargoEndQuote(q,p,cargo,capital);
        if(cargo&&(!quote||!noUse(quote.after,quote.after.players.players.find(x=>x.id===seatId),quote.afterCapital)))return null;
        const established=endScoring.computePlayerFinalScore({...q,players:q.players.players,aliens:structuredClone(q.aliens),
          finalScoring:structuredClone(q.finalScoring),cardEffects,
          getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},p).totalScore;
        const purpose=stateValue.sumValueParts([capital,quote?.claim?quote.capital:0]);
        const value=stateValue.sumValueParts([established,purpose,quote?.claim?quote.gain-quote.capital:0]);
        ranks.push({actionId:a.actionId,value,purpose});
      }
      ranks.sort((a,b)=>b.value-a.value||a.purpose-b.purpose||a.actionId.localeCompare(b.actionId));
      if(ranks.length<2)return null;
      return {policy:"seti-known-scan-trace-score-tail-v1",kind:"rank-automatic-scan-traces",fixed:false,isEquivalence:false,
        retainedActionIds:[ranks[0].actionId,...open],excludedActionIds:ranks.slice(1).map(x=>x.actionId),scores:ranks};
    }

    function pairedTracePickupScope(state,session) {
      if(!session||state.turn.roundNumber!==3||state.turn.currentPlayerId!==seatId
        ||!knownRootAlienIds.has("阿米巴")||!knownRootAlienIds.has("虫")
        ||state.turn.activePlayerIds.some(id=>id!==seatId&&!state.turn.passedPlayerIds.includes(id))
        ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        ||state.turn.cardTurnEventBonuses?.length||session.interruptContext||session.failure
        ||session.queue.some(e=>e.ownerId!==seatId||e.allowQuickActions))return false;
      const original=session.journal.actions[0]?.action,pickup=session.queue.at(-1);
      return original?.family==="play_card"&&original.actorId===seatId
        &&pickup?.payload?.cardEffect?.type==="chong_pickup_fossil"
        &&pickup.payload.cardInstanceId===original.target.cardInstanceId
        &&session.journal.decisions.some(d=>d.choice?.target?.actionType==="land"&&d.choice.target.landTarget?.satelliteId==="titan")
        &&chong.getAvailablePlanetFossils(state.aliens,"saturn").some(f=>!f.visibleToPlayerIds?.includes(seatId));
    }
    function pairedTracePickupPlan(node,stored,state) {
      const session=stored.envelope.session?.session;
      if(!pairedTracePickupScope(state,session))return null;
      const head=session.queue[0],p=state.players.players.find(v=>v.id===seatId),actions=node.legalActions;
      if(!p.mainActionCompleted||p.passCompletionPending||p.reservedCards.some(c=>!knownCards(stored.envelope).has(c.id)))return null;
      const make=(retained,kind,quotes)=>retained.length===actions.length?null:{
        policy:"seti-r3-two-traces-before-pickup-v1",kind,isEquivalence:false,
        retainedActionIds:retained.map(a=>a.actionId),excludedActionIds:actions.filter(a=>!retained.includes(a)).map(a=>a.actionId),quotes,
      };
      if(head.type==="residual_alien_card_decision"&&head.payload.speciesId==="chong"
        &&head.payload.source==="trace_reward"&&actions.every(a=>a.family==="choose_card")
        &&["display","blind"].every(source=>!cardEffects.hasMatchingTrigger(p,{type:"alien_card_gain",
          playerId:seatId,alienId:"虫",source}))){
        const visible=actions.find(a=>a.target.source==="display"&&a.target.cardIndex===knownChongDisplayIndex);
        const blind=actions.find(a=>a.target.source==="blind");
        return make(visible?[visible]:blind?[blind]:actions,"fixed-visible-free-card",[]);
      }
      if(head.type==="residual_card_decision"&&head.payload.kind==="trigger"&&actions.length===2
        &&p.resources.availableData<players.RESOURCE_LIMITS.availableData&&head.payload.matches?.length===1){
        const action=actions.find(a=>a.family==="accept_optional_effect"&&a.target.choiceId.startsWith("confirm:trigger:"));
        const settled=action&&residualSession.queryCardSettlement(state,seatId,{...head.payload,cardInstanceId:action.target.cardInstanceId,ruleId:action.target.ruleId});
        const card=action&&p.reservedCards.find(c=>c.id===action.target.cardInstanceId);
        if(card?.cardId==="amiba_0.webp"&&head.payload.event?.type==="alienTrace"
          &&settled?.effects?.length===1&&settled.effects[0].type==="gain_data"&&settled.effects[0].options.count===1
          &&!cardEffects.hasMatchingTrigger(p,{type:"card_rule_settled",playerId:seatId,cardInstanceId:card.id,
            ruleId:action.target.ruleId,ruleKind:"trigger"}))
          return make([action],"fixed-funded-data-trigger",[]);
      }
      if(head.type!==scienceSession.EFFECT_TYPES.ALIEN_TRACE||head.payload.traceType!==null
        ||!['label','traceType'].every(k=>Object.hasOwn(head.payload,k))||Object.keys(head.payload).length!==2)return null;
      const [later,tail]=session.queue.slice(1);
      if(tail&&(session.queue.length!==3||later.type!=="probe_turn_reward"||later.payload?.reward?.type!=="alien_trace"
        ||later.payload.reward.options?.traceType!==null))return null;
      if(state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles)
        .some(t=>t.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
      const getCardTypeCode=c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType);
      const score=(aliens,player)=>endScoring.computePlayerFinalScore({...state,aliens,finalScoring:structuredClone(state.finalScoring),
        players:state.players.players,cardEffects,getCardTypeCode},player);
      const base=score(structuredClone(state.aliens),p);
      if(base.tiles.some(t=>!["b1","c1","d2"].includes(t.formulaId))
        ||base.cards.some(c=>!["planetLandingPairs","amibaTraceCount","chongTraceCount"].includes(c.rule.kind)))return null;
      const matchPlayer={...p,reservedCards:structuredClone(p.reservedCards)};
      const c=endScoring.getPlayerTraceCounts(p,state.aliens),types=["blue","pink","yellow"];
      const afterOther=session.queue[1]?.type==="probe_turn_reward"?[null,...types]:[null];
      const multiplier=base.tiles.filter(t=>t.formulaId==="b1").reduce((n,t)=>n+t.multiplier,0);
      const contribution=(selected,other)=>multiplier*Math.min(...types.map(t=>c[t]+Number(t===selected)+Number(t===other)));
      const groups=new Map(),keep=[];
      for(const a of actions){
        const t=a.target,slot=alienState.getAlienSlot(state.aliens,t.alienSlotId);
        const species=t.speciesId||(slot.alienId==="虫"?"chong":"amiba");
        const api=species==="chong"?chong:species==="amiba"?aliens.amiba:null;
        if(!t.stateExtra&&species==="chong"&&t.traceType==="blue"
          &&(chong.LOCKED_BLUE_POSITIONS.includes(t.position)||t.position===chong.PANEL_FOSSIL_INITIAL_POSITION)){
          keep.push(a);continue;
        }
        const reward=t.stateExtra?{gain:{score:3}}:api?.getTraceReward(state.aliens,t.traceType,t.position,{readOnlyRewards:true});
        if(!reward||Object.keys(reward.gain||{}).some(k=>k!=="score")
          ||Object.keys(reward).some(k=>!["gain","region","pickAlienCard"].includes(k)&&reward[k])){keep.push(a);continue;}
        const triggers=cardEffects.collectMatchingTriggers(matchPlayer,{type:"alienTrace",playerId:seatId,
          traceType:t.traceType,alienSlotId:t.alienSlotId,region:reward.region||null});
        if(triggers.some(v=>v.trigger?.effect?.type!=="gain_data")){keep.push(a);continue;}
        const key=JSON.stringify([reward.region||null,reward.pickAlienCard?species:null,
          triggers.map(v=>[v.card.id,v.trigger.id])]);
        const board=structuredClone(state.aliens),preview={...p,resources:{...p.resources},scoreSources:{...p.scoreSources}};
        const placed=aliens.placeTraceForActor(players,board,preview,t.alienSlotId,t.traceType,t.position,
          {stateExtra:!!t.stateExtra,sequence:state.meta.sequences.alienEntity});
        if(!placed.ok)throw Error("PAIRED_TRACE_PLAN_STALE:"+a.actionId);
        if(!t.stateExtra)players.gainResources(preview,reward.gain||{});
        const observed=endScoring.getPlayerTraceCounts(preview,board);
        if(types.some(type=>observed[type]!==c[type]+Number(type===t.traceType))){keep.push(a);continue;}
        const after=score(board,preview).totalScore;
        const v=afterOther.map(other=>after+contribution(t.traceType,other)-contribution(t.traceType,null));
        const group=groups.get(key)||[];group.push({a,v});groups.set(key,group);
      }
      for(const group of groups.values())for(const a of group){
        if(!group.some(b=>b!==a&&b.v.every((v,i)=>v>a.v[i])))keep.push(a.a);
      }
      // Only strict score dominance within the same reward and trigger
      // matters. On the first mark, compare every possible next color too.
      return make(keep,"same-trace-effects-score-dominance",[...groups.entries()].map(([key,v])=>[key,v.map(x=>[x.a.actionId,x.v])]));
    }
    const incomePaymentAlternatives=new WeakMap();
    function incomePaymentAlternative(node,stored,state){
      if(node!==openedRoot||node.status!=="decision"||stored.resourceControl||stored.informationBarrier)return null;
      const session=stored.envelope.session?.session;
      if(session?.queue.length!==1||session.queue[0].type!==scienceSession.EFFECT_TYPES.INCOME
        ||session.interruptContext||session.failure||session.journal.actions[0]?.action.family!=="place_data")return null;
      if(incomePaymentAlternatives.has(node))return incomePaymentAlternatives.get(node);
      const t=state.turn,p=state.players.players.find(x=>x.id===seatId);
      let result=null;
      if(t.roundNumber===3&&p.mainActionCompleted
        &&!p.passCompletionPending&&!t.cardTurnEventBonuses?.length&&p.resources.energy===0&&p.resources.availableData===0&&p.resources.credits>0&&p.income.energy<=2
        &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        &&node.legalActions.every(a=>a.target?.choiceId?.startsWith("income:"))
        &&p.hand.every(c=>knownCards(stored.envelope).has(c.id))
        &&state.cards.publicCards.some(c=>c&&knownCards(stored.envelope).has(c.id))){
        const rows=node.legalActions.map(a=>{
          const card=p.hand.find(c=>c.id===a.target.cardInstanceId);
          return {a,card,gain:cards.getIncomeGainForCard(card),value:resourceDemand.incomeCardValue(state,seatId,card)};
        });
        const best=Math.max(...rows.map(x=>x.value));
        const money=rows.find(x=>x.gain.credits===1&&x.value===best);
        const electric=rows.filter(x=>{
          if(x.gain.energy!==1||x.value!==best)return false;
          const body=cardEffects.buildPlayEffects(x.card),sector=body[0]?.options?.nebulaId;
          return body.length===2&&sector&&body.every(e=>e.type==="card_scan_nebula"&&e.options.nebulaId===sector&&e.options.gainData===true)
            &&data.listNebulaTokens(state.data,sector).filter(t=>!t.replacedByPlayerId&&!t.replacedByPlayerColor).length>body.length;
        });
        const cost=scanEffects.getStandardScanCost(p);
        const trade=quickTrades.getTradeAction("credits-for-energy");
        const pay=(income)=>Math.ceil(Math.max(0,(cost.energy||0)-(income.gain.energy||0))/trade.gain.energy)
          *trade.cost.credits+(cost.credits||0);
        if(money&&electric.length===1){
          const e=electric[0],left=p.resources.credits-pay(e),base=p.resources.credits+1-pay(money);
          const body=cardEffects.buildPlayEffects(money.card),cost=cardEffects.getCardPlayCost(money.card);
          const corner=cards.getDiscardActionRewardForCard(money.card);
          if(base===0&&left===1&&cost?.credits===1&&Object.keys(cost).length===1
            &&corner?.dataCount===1&&Object.keys(corner.gain).every(k=>k==="score")
            &&body.some(e=>e.type==="pick_card")&&body.some(e=>e.type==="amiba_choose_symbol_reward"))
            result={actionId:e.a.actionId,baseline:money.a.actionId,left,base};
        }
      }
      incomePaymentAlternatives.set(node,result);return result;
    }
    function localDecisionSpec(node){
      if((!finalMarkPlanning&&!resourcePlanning)||node.status!=="decision")return null;
      if(localSpecs.has(node))return localSpecs.get(node);
      const stored=nodes.get(node),state=readPlanningState(stored);
      let result=finalMarkPlanning?localPlans.finalMark({state,seatId,actions:node.legalActions}):null;
      if(!result&&resourcePlanning)result=localPlans.reorganization({state,seatId,actions:node.legalActions,session:stored.envelope.session?.session})||localPlans.passDiscard({state,seatId,actions:node.legalActions,goal:stored.resourceControl?.goal})||localPlans.blueResearch({state,seatId,actions:node.legalActions})||localPlans.pureOptional({state,seatId,actions:node.legalActions,session:stored.envelope.session?.session,knownCards:knownCards(stored.envelope)});
      if(!result&&resourcePlanning&&cardPickPlanning)result=localPlans.pinkScoreBeforeUnknownFossil({
        state,seatId,actions:node.legalActions,session:stored.envelope.session?.session,knownCards:knownCards(stored.envelope),
        knownFossilIds:knownRootFossilIds,knownAmibaDisplay:rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex,
        knownChongDisplay:knownRootAlienIds.has("虫")?knownChongDisplayIndex:null,rankKnownFossilTraces,
      });
      if(!result&&resourcePlanning)result=pairedTracePickupPlan(node,stored,state)||quietScanTracePlan(node,stored,state);
      if(!result&&resourcePlanning){
        const fixed=resourceDemand.paidChoice({state,seatId,actions:node.legalActions,session:stored.envelope.session?.session})
          ||resourceDemand.fixedDataChoice({state,seatId,actions:node.legalActions,goal:stored.resourceControl?.goal});
        if(fixed&&!incomePaymentAlternative(node,stored,state))result={policy:fixed.reason==="fixed-positive-paid-repeat"?"seti-greedy-paid-budget-v1":"seti-greedy-data-execution-v1",kind:fixed.reason==="fixed-positive-paid-repeat"?"fixed-paid-repeat":"fixed-data-choice",fixed:true,isEquivalence:false,
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
      const owner=state.players.players.find(p=>p.id===seatId);
      // Completed main actions cannot consume the pre-main launch, route,
      // research or scan quotes. The catalog reads only blue placements.
      const requirements=owner?.mainActionCompleted?{bluePlacements:data.listBluePlacementRequirements(owner)}:resourceQuery(state);
      const result = freeze(resourceDemand.catalog({state,seatId,requirements,actions}));
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

    // A single affordable data corner should not bind an inactive shipment
    // to the blue slot before the fourth computer slot can be compared.
    function stationaryCargoIncomeWindow(state,stored,node) {
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.gameEnded||!p.mainActionCompleted||p.passCompletionPending
        ||t.passedPlayerIds.includes(seatId)||p.industryBorrowedTechTileId||stored.intent||stored.resourceControl||stored.informationBarrier
        ||p.resources.energy!==0||p.resources.credits>1
        ||!t.activePlayerIds.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||t.cardTurnEventBonuses?.length||industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId!=="deepspace_swap_cards"
        ||node.legalActions.some(goalMovement.isDirection))return false;
      // The known 3-score/1-credit task can remain a separate Native option.
      // A data corner or placement cannot change its planet-count condition.
      const tasks=node.legalActions.filter(a=>a.family==="complete_task");
      const claim=tasks.length===1&&tasks[0].target.ruleId==="b117-orbit-land-count-task"?tasks[0]:null;
      if(tasks.length&&!claim)return false;
      const owned=state.pieces.rockets.filter(r=>[r.playerId,r.playerColor,r.color].some(id=>id===p.id||id===p.color));
      const slots=data.listComputerPlacedTokens(p);
      if(owned.length!==1||owned[0].kind!=="chong-fossil"||!owned[0].fossilId||!knownRootAlienIds.has("虫")
        ||p.hand.some(c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints)
        ||slots.length!==3||slots.some((x,i)=>x.placementSlot!==i+1))return false;
      const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{}),known=knownCards(stored.envelope);
      return jobs.length===1&&jobs[0].fossilId===owned[0].fossilId&&!jobs[0].delivered&&!localPlans.hasPendingFossilArrival(state)
        &&p.hand.every(c=>known.has(c.id))&&state.players.players.every(q=>q.reservedCards.every(c=>{
          const model=cardEffects.getCardModel(c);
          const task=model?.tasks?.[0],gain=task?.rewards?.[0]?.options?.gain;
          const auditedClaim=claim?.target.cardInstanceId===c.id&&model?.tasks?.length===1&&task.id===claim.target.ruleId
            &&task.condition?.type==="orbitOrLandCount"&&task.rewards?.length===1
            &&task.rewards[0].type==="gain_resources"&&gain?.credits===1&&gain.score===3&&Object.keys(gain).length===2;
          return q.id===seatId&&known.has(c.id)&&model&&(!model.tasks?.length||auditedClaim)
            &&!model.temporaryTasks?.length&&!model.triggers?.length;
        }));
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
      const computer=7-p.resources.availableData;
      const shape=t.roundNumber===3&&!p.mainActionCompleted&&!p.passCompletionPending&&p.hand.length===5
        &&p.resources.credits===0&&p.resources.energy===0
        &&(computer===6||computer===4&&p.techState.ownedTiles.orange1)
        &&data.listComputerPlacedTokens(p).length===computer&&hasPostMainInertReservations(state,true,true,true)
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
          waitPoints:timing.waitPaidPoints,remainingPoints:advanced.remainingPaidPoints,
          ...(computer===4?{publicityPayerId:funding[0].id,publicityGain:missing-1}:{})}};
    }

    function waitForKnownBlueColumn(node,state,known){
      if(node!==openedRoot||node.status!=="stable"||state.turn.roundNumber!==3)return false;
      const p=state.players.players.find(q=>q.id===seatId);
      if(!p.mainActionCompleted||!p.techState.ownedTiles.orange1||p.techState.ownedTiles.blue1
        ||p.resources.credits||p.resources.energy||p.resources.availableData!==3||p.hand.length!==5
        ||data.listComputerPlacedTokens(p).length!==4||data.listBluePlacementRequirements(p).length
        ||!node.legalActions.some(a=>a.family==="end_turn")||node.legalActions.some(a=>a.family==="complete_task")
        ||!hasPostMainInertReservations(state,true,true,true))return false;
      const prepared=structuredClone(state),q=prepared.players.players.find(v=>v.id===seatId);
      const quiet=localPlans.quietEndCompletion({state:prepared,seatId});
      const advance=turnFlow.advanceTurnAfterPlayerAction(prepared,seatId);
      if(!quiet.available||quiet.netGain||quiet.markedTiles.length||!advance.turnAdvanced
        ||advance.roundAdvanced||advance.gameEnded||advance.nextPlayerId!==seatId)return false;
      q.mainActionCompleted=false;
      const actions=rocketAbilities.listPlayerMoveChoices(prepared,q,{maxPoints:1}).map((target,i)=>
        ({family:"move",actionId:String(i),target,payload:{requiredMovePoints:target.requiredMovePoints}}));
      if(!researchMovementPlan(prepared,actions,known))return false;
      // No intervening actor or observer gains anything from these empty
      // columns. The same placements are still legal before the next main.
      for(const placementSlot of [5,6]){
        const r=data.placeDataToComputer(q);
        if(!r.ok||r.placementSlot!==placementSlot||r.slotBonuses?.length
          ||cardEffects.collectMatchingTriggers(q,{type:"placeData",playerId:seatId,placementKind:"computer",placementSlot}).length)return false;
      }
      return true;
    }

    const blueCashAnalysisTail={id:"data:computer6-blue1-cash",kind:"blue-cash-analysis-tail",required:{}};
    function hasDeferredBlueCashTail(state,known){
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn,count=7-p.resources.availableData;
      return t.roundNumber===3&&t.currentPlayerId===seatId&&p.mainActionCompleted&&!p.passCompletionPending
        &&p.techState.blueBoardSlots.blue1===3&&!p.techState.disabledTiles.blue1&&p.techState.ownedTiles.orange1
        &&!p.resources.credits&&!p.resources.energy&&[4,5].includes(count)&&p.hand.length===3
        &&data.listComputerPlacedTokens(p).length===count&&data.listBlueBonusPlacedTokens(p).length===2
        &&p.hand.every(c=>known.has(c.id))
        &&p.hand.filter(c=>localPlans.blueCashCard(c)).length===1&&localPlans.knownBlueCashOffers(state,known).length===2
        &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))&&!t.cardTurnEventBonuses?.length
        &&hasPostMainInertReservations(state,true,true,true);
    }

    function isFossilResearchMovePayer(card){
      const effects=cardEffects.getCardModel(card)?.playEffects;
      return cards.getDiscardActionMoveRewardForCard(card)?.movementPoints===1
        &&effects?.length===1&&effects[0].type==="chong_probe_planet_fossil_reward";
    }

    function retainedScoredTransportPayer(hand){
      const movers=hand.filter(c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1);
      if(movers.length!==2||!movers.every(c=>{
        const gain=cards.getDiscardActionMoveRewardForCard(c).gain;
        return gain.score===1&&Object.keys(gain).length===1;
      }))return null;
      const first=movers.find(isFossilResearchMovePayer),retained=first&&movers.find(c=>c!==first);
      return retained&&cardEffects.getCardModel(retained)?.playEffects?.some(e=>e.type==="card_research_tech"&&e.options?.skipCost)
        ?retained:null;
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
      const movePayers=p.hand.filter(isFossilResearchMovePayer);
      const plain=p.hand.filter(c=>{
        const r=cards.getDiscardActionMoveRewardForCard(c);
        return r?.movementPoints===1&&!Object.keys(r.gain).length;
      });
      const ships=state.pieces.rockets.filter(r=>r.playerId===seatId&&r.surface==="solar-board"&&!r.fossilId);
      if(suppliers.length!==1||movePayers.length!==1||ships.length!==1)return null;
      let publicityPayer=publicity.length===1&&plain.length===1?publicity[0]:null;
      let heldPayments=false;
      if(!publicityPayer&&!plain.length){
        // A second scored corner can be the landing payer. Keep its paid
        // research play until the first move is funded. Spend a passive
        // publicity corner before an active play, then keep the better
        // income option. No alternative payment enters the search.
        const scored=retainedScoredTransportPayer(p.hand);
        if(scored&&scored!==suppliers[0]&&publicity.length){
          publicityPayer=publicity.length===1?publicity[0]:publicity.map(c=>({c,
            active:Number(Boolean(cardEffects.getCardModel(c)?.playEffects?.length)),
            cost:resourceDemand.cardOpportunityCost(state,seatId,c)
          })).sort((a,b)=>a.active-b.active||a.cost-b.cost||a.c.id.localeCompare(b.c.id))[0].c;
          heldPayments=true;
        }
      }
      if(!publicityPayer)return null;
      const payer=movePayers[0];
      const reward=cards.getDiscardActionMoveRewardForCard(payer);
      const committedCorner=source?.family==="card_corner";
      const corner=(committedCorner?[source]:!source?actions:[]).find(a=>a.family==="card_corner"
        &&a.target.cardInstanceId===payer.id&&a.payload.kind==="move"&&a.payload.multiplier===1);
      // The remaining unscored payer keeps the later landing unchanged.
      // Do not alter the separate two-scored-card ordering proof.
      const scored=!heldPayments&&corner&&reward?.gain?.score===1&&Object.keys(reward.gain).length===1
        &&!cardEffects.hasMatchingTrigger(p,{type:"cardCorner",playerId:seatId,cardInstanceId:payer.id,
          cornerCode:cards.normalizeDiscardActionTriggerCode(cards.getDiscardActionCodeForCard(payer)),cornerKind:"move"})
        &&!state.finalScoring.thresholds.includes(p.resources.score+1);
      if(committedCorner&&!scored)return null;
      const candidates=committedCorner?rocketAbilities.listPlayerMoveChoices(state,p,{maxPoints:1}).map(target=>({
        family:"move",actionId:null,target,payload:{requiredMovePoints:target.requiredMovePoints},
      })):source?[source]:actions;
      const moves=candidates.filter(a=>a.family==="move"&&a.target.rocketId===ships[0].id
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
        movementFunding:{cardId:payer.id,publicityPayerId:publicityPayer.id,firstMoveId:moves[0].actionId,publicity:p.resources.publicity,
          ...(scored?{scoredCornerId:corner.actionId,cornerTarget:moves[0].target}:{})},
        ...(heldPayments?{heldPayments:true,probeId:ships[0].id}:{})};
    }

    function displayedTransportResearchMove(state,actions,known,source=null,proof=displayedAnalysisTransportSource()){
      if(!proof)return null;
      const p=state.players.players.find(x=>x.id===seatId),required=techResolver.getResearchPublicityCost(p);
      if(required-p.resources.publicity!==2||p.mainActionCompleted||p.techState.ownedTiles.blue1
        ||!p.hand.every(c=>known.has(c.id))||!techResolver.listTakeableTiles(state.tech,p.techState).includes("blue1")
        ||state.tech.stacks.blue1?.bonusHidden||state.tech.stacks.blue1?.bonusIndex!==knownRootTechIndices.get("blue1"))return null;
      const movers=p.hand.filter(c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1);
      const payment=movers.filter(c=>Object.keys(cards.getDiscardActionMoveRewardForCard(c).gain).length===0);
      if(movers.length!==3||payment.length!==1)return null;
      const others=p.hand.filter(c=>!movers.includes(c));
      if(others.length!==3)return null;
      const publicity=others.filter(c=>{
        const r=cards.getDiscardActionRewardForCard(c);
        return r?.gain?.publicity===1&&Object.keys(r.gain).length===1&&!r.dataCount;
      }).sort((a,b)=>resourceDemand.cardOpportunityCost(state,seatId,a)-resourceDemand.cardOpportunityCost(state,seatId,b)
        ||a.id.localeCompare(b.id));
      if(!publicity.length)return null;
      const [payer]=publicity;
      const slots=Object.keys(data.BLUE_BONUS_DATA_SLOTS).map(Number).filter(slot=>!Object.values(p.techState.blueBoardSlots).includes(slot)
        &&data.getRequiredComputerSlotForBlueBonus(slot)<=data.listComputerPlacedTokens(p).length+1);
      if(slots.length!==1)return null;
      const native=productionKernel||globalThis.SetiProductionKernel;
      const moves=(source?[source]:actions).filter(a=>a.family==="move"&&a.target.rocketId===proof.probeId&&a.payload?.requiredMovePoints===1)
        .filter(({target})=>{
          const preview=structuredClone(state),q=preview.players.players.find(x=>x.id===seatId);
          const moved=rocketAbilities.moveProbe(preview,{...target,movementPoints:1,cost:{},source:"move"});
          if(!moved.ok||q.resources.publicity!==p.resources.publicity+1
            ||(moved.events||[]).some(e=>cardEffects.collectMatchingTriggers(p,{...e,...(e.type==="visitPlanet"?{hasOwnOrbit:true}:{})}).length))return false;
          const rotated=techResolver.rotateForResearch(scienceSession.createActionContext(preview,seatId),1);
          return rotated.ok&&!rotated.events.length&&(native.getProbeRouteRequirements(preview,seatId)?.candidates||[]).some(c=>
            c.rocketId===proof.probeId&&!c.launchRequired&&c.endpointFamily==="land"&&c.endpointTarget?.type==="planet"
            &&["jupiter","saturn"].includes(c.planetId)&&c.path.length===2&&c.required.paidMovementPoints===2
            &&chong.getRemainingPlanetFossilCount(preview.aliens,c.planetId)>0);
        });
      if(moves.length!==1)return null;
      return {id:"tech:blue1:"+slots[0]+":displayed-analysis-transport",kind:"research_tech",tileId:"blue1",blueSlot:slots[0],required:{publicity:required},
        movementFunding:{cardId:payment[0].id,publicityPayerId:payer.id,firstMoveId:moves[0].actionId,publicity:p.resources.publicity}};
    }

    function visibleEarthCargo(state,p,job) {
      const card=p.reservedCards.find(c=>c.id===job.cardId&&knownRootCardIds.has(c.id));
      const ship=state.pieces.rockets.find(r=>r.playerId===seatId&&r.kind==="chong-fossil"&&r.fossilId===job.fossilId);
      if(!card||chong.getCardTask(card)?.kind!=="transport"||!ship||job.destinationPlanetId!=="earth"
        ||!rootObservation.publicState.board.rockets.some(r=>r.id===ship.id&&r.fossilId===ship.fossilId))return null;
      return ship;
    }

    function adjacentEarthCargo(state,p,ship,earth) {
      const from=rockets.getRocketSectorCoordinate(ship);
      if(!from||rocketAbilities.getRequiredMovePointsFromCoordinate(state,p,from)!==1)return null;
      const canMove=rockets.createStaticCoordinateMoveQuery(state.pieces,ship.id);
      const step=rocketAbilities.MOVE_DIRECTIONS.find(({deltaX,deltaY})=>{
        const next=canMove(from,deltaX,deltaY);
        return next.ok&&next.to.x===earth.x&&next.to.y===earth.y;
      });
      return step?{rocketId:ship.id,fossilId:ship.fossilId,from,to:{x:earth.x,y:earth.y},...step}:null;
    }

    // After a genuine research reveal the old certificate may have a
    // different menu. Start from the new public facts, not a relaxed key.
    function resumeKnownCargo(node,stored,state) {
      if(node!==openedRoot||stored.intent||stored.resourceControl||stored.informationBarrier
        ||state.turn.roundNumber!==4||state.turn.currentPlayerId!==seatId||!knownRootAlienIds.has("虫"))return null;
      const p=state.players.players.find(q=>q.id===seatId),session=stored.envelope.session?.session;
      if(!p.mainActionCompleted||p.passCompletionPending||p.industryBorrowedTechTileId||state.turn.cardTurnEventBonuses?.length)return null;
      const source=session?.journal?.actions[0]?.action;
      const paid=source?.family==="quick_trade"&&source.target?.tradeId==="energy-for-move"
        &&session.queue[0]?.payload?.decisionContext?.kind==="move";
      if(node.status==="decision"){
        if(source?.family!=="research_tech"&&!paid)return null;
      }else if(node.status!=="stable")return null;
      const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{}),pending=jobs.filter(t=>!t.delivered);
      if(jobs.length!==2||!pending.length||p.resources.energy+(paid?1:0)<pending.length)return null;
      const earth=solar.collectPlanetLocations(state.solarSystem).find(v=>v.planetId==="earth"),projected=[];
      for(const job of jobs){
        const ship=visibleEarthCargo(state,p,job);
        if(!ship)return null;
        if(!job.delivered){
          const step=adjacentEarthCargo(state,p,ship,earth);
          if(!step)return null;
          projected.push(step);
        }
      }
      return {id:"cargo:known-adjacent-after-main",kind:"cargo-research-corner",required:{},projected,cards:jobs.map(t=>t.cardId),paid};
    }

    // One named corner prefix for two visible cargo jobs, conditional on
    // actually starting standard research. No simulated reward or future
    // free move enters the lower bound, and no direction is a search root.
    function cargoResearchCorner(node,stored,state) {
      if(node!==openedRoot||stored.intent||stored.resourceControl||stored.informationBarrier
        ||state.turn.roundNumber!==4||state.turn.currentPlayerId!==seatId||!knownRootAlienIds.has("虫"))return null;
      const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
      if(jobs.length!==2||jobs.some(t=>t.delivered||t.destinationPlanetId!=="earth"))return null;
      const p=state.players.players.find(q=>q.id===seatId),session=stored.envelope.session?.session;
      if(p.mainActionCompleted||p.passCompletionPending||p.industryBorrowedTechTileId||state.turn.cardTurnEventBonuses?.length
        ||p.resources.energy<2||p.resources.publicity<techResolver.getResearchPublicityCost(p)
        ||!techResolver.listTakeableTiles(state.tech,p.techState).length)return null;
      const research=a=>a.family==="research_tech"&&!a.payload?.skipRotate&&!a.payload?.skipCost;
      const corner=a=>a?.family==="card_corner"&&a.payload?.kind==="move"&&a.payload.multiplier===1;
      let payer;
      if(node.status==="stable"){
        if(!node.legalActions.some(research))return null;
        const payments=node.legalActions.filter(a=>corner(a)&&p.hand.some(c=>c.id===a.target.cardInstanceId&&knownRootCardIds.has(c.id)
          &&cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1));
        if(payments.length!==1)return null;
        payer=payments[0];
      }else{
        payer=session?.journal?.actions?.[0]?.action;
        if(node.status!=="decision"||!corner(payer)||session.queue.length!==1||session.queue[0].ownerId!==seatId
          ||session.queue[0].payload?.remaining!==1||session.queue[0].payload?.cardEffect?.type!=="card_move"
          ||session.queue[0].payload.cardEffect.options?.movementPoints!==1)return null;
      }
      const earth=s=>solar.collectPlanetLocations(s.solarSystem).find(v=>v.planetId==="earth");
      const equal=(a,b)=>a?.x===b?.x&&a?.y===b?.y,position=(s,id)=>rockets.getRocketSectorCoordinate(s.pieces.rockets.find(r=>r.id===id));
      const dest=earth(state),targets=[];
      for(const job of jobs){
        const ship=visibleEarthCargo(state,p,job);
        if(!ship)return null;
        const from=position(state,ship.id),deltaY=Math.sign(dest.y-from?.y);
        if(from?.x!==dest.x||!deltaY||rocketAbilities.getRequiredMovePointsFromCoordinate(state,p,from)!==1)return null;
        const move=rockets.canMoveFromCoordinate(state.pieces,from,0,deltaY,ship.id);
        if(!move.ok)return null;
        targets.push({rocketId:ship.id,fossilId:ship.fossilId,from,to:move.to,deltaX:0,deltaY,delivers:equal(move.to,dest)});
      }
      const direct=targets.find(t=>t.delivers),stage=targets.find(t=>!t.delivers);
      if(!direct||!stage)return null;
      // Three projections of the same board. Distance in the ring supplies
      // an optimistic lower bound on the two rejected alternatives.
      const rotate=move=>{
        const next=structuredClone(state);
        if(move&&!rockets.moveRocket(next.pieces,move.rocketId,0,move.deltaY).ok)throw Error("CARGO_RESEARCH_MOVE_PROJECTION_FAILED");
        const r=turnFlow.rotateSolarSystem(next,1,seatId,{captureSnapshots:false});
        if(!r.ok)throw Error("CARGO_RESEARCH_ROTATION_PROJECTION_FAILED");
        return next;
      };
      const lowerBound=(next,job)=>{
        const at=position(next,job.rocketId),to=earth(next),dx=Math.abs(at.x-to.x);
        return Math.min(dx,8-dx)+Math.abs(at.y-to.y);
      };
      const staged=rotate(stage),after=earth(staged);
      const projected=targets.map(t=>{
        if(lowerBound(staged,t)!==1)return null;
        return adjacentEarthCargo(staged,p,staged.pieces.rockets.find(r=>r.id===t.rocketId),after);
      });
      if(projected.some(t=>!t))return null;
      const directLower=lowerBound(rotate(direct),stage),waiting=rotate(null),waitLower=targets.reduce((n,t)=>n+lowerBound(waiting,t),0);
      if(directLower<=2||waitLower<=2)return null;
      return {id:"cargo:research-corner:"+payer.target.cardInstanceId,kind:"cargo-research-corner",required:{},
        payerId:payer.target.cardInstanceId,cornerActionId:payer.actionId,stage,projected,cards:jobs.map(t=>t.cardId),
        timing:{paid:2,directLower,waitLower}};
    }

    // One current-turn delivery; the two visible movement corners and
    // one Blue 2 energy point pay an all-one-point route to Earth.
    function simpleCargoScanReward(reward){
      return reward&&!reward.dataCount&&!reward.drawCards&&!reward.pickCard&&!reward.pickAlienCard&&!reward.chooseFossilRewardOnly
        &&Object.keys(reward.gain||{}).length===1&&(reward.gain.credits===2||reward.gain.energy===2);
    }

    function dataFundedCargoPlan(node,stored,state){
      if(node!==openedRoot||node.status!=="stable"||stored.envelope.session||stored.intent||stored.informationBarrier
        ||state.turn.roundNumber!==3||state.turn.currentPlayerId!==seatId||!knownRootAlienIds.has("虫"))return null;
      const t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.gameEnded||t.passedPlayerIds.includes(seatId)||!t.activePlayerIds.includes(seatId)
        ||p.passCompletionPending||p.industryBorrowedTechTileId||t.cardTurnEventBonuses?.length
        ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||p.resources.availableData!==3||p.resources.energy||!p.techState.ownedTiles.blue2||p.techState.disabledTiles.blue2
        ||p.techState.blueBoardSlots.blue2!==1||data.listComputerPlacedTokens(p).length||data.listBlueBonusPlacedTokens(p).length
        ||!p.hand.every(c=>knownRootCardIds.has(c.id))
        ||!p.reservedCards.every(c=>{
          const model=cardEffects.getCardModel(c);
          return knownRootCardIds.has(c.id)&&model&&!model.triggers?.length&&!model.temporaryTasks?.length;
        })
        ||state.pieces.rockets.some(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r)))return null;
      const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
      if(jobs.length!==1||jobs[0].delivered)return null;
      const job=jobs[0],ship=visibleEarthCargo(state,p,job),fossil=state.aliens.chong?.fossilsById?.[job.fossilId];
      if(!ship||ship.movementLocked||fossil?.status!=="transported"||fossil.taskCompleted)return null;
      const rule=chong.getCardTask(p.reservedCards.find(c=>c.id===job.cardId)),reward=chong.getFossilReward(job.fossilId);
      if(rule?.dataCount!==2||rule.fossilRewardRepeat!==1||Object.keys(rule.gain||{}).length
        ||rule.effects||rule.rewards||rule.pickCard||rule.pickAlienCard||rule.drawCards
        ||!simpleCargoScanReward(reward))return null;
      const earth=solar.collectPlanetLocations(state.solarSystem).find(x=>x.planetId==="earth"),at=rockets.getRocketSectorCoordinate(ship);
      if(!earth||!at)return null;
      const dx=Math.abs(at.x-earth.x),lower=Math.min(dx,8-dx)+Math.abs(at.y-earth.y);
      if(lower!==3)return null;
      const path=shortEarthPath(state,p,ship,at,earth,3);
      const payers=p.hand.filter(c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1);
      if(path?.length!==3||payers.length!==2||payers.some(c=>
        Object.keys(cards.getDiscardActionMoveRewardForCard(c).gain).some(k=>k!=="score")))return null;
      const place=node.legalActions.find(a=>a.family==="place_data");
      if(!place)return null;
      const sources=p.hand.filter(c=>!payers.includes(c)&&cards.getIncomeGainForCard(c)?.energy===1
        &&Object.keys(cards.getIncomeGainForCard(c)).length===1).sort((a,b)=>
          resourceDemand.cardOpportunityCost(state,seatId,a)-resourceDemand.cardOpportunityCost(state,seatId,b)||a.id.localeCompare(b.id));
      if(!sources.length)return null;
      const goal={id:"cargo:data-funded:"+job.cardId,kind:"data-funded-cargo",required:{},cardId:job.cardId,
        path,payers:payers.map(c=>c.id),incomeCardId:sources[0].id,fossilId:job.fossilId,energyIncome:p.income.energy};
      return {id:goal.id,goal,operation:{},firstActionId:place.actionId,mode:"greedy",reason:"data-funded-current-turn-cargo"};
    }

    function dataFundedCargoStep(node,state,goal,operation){
      const i=operation.cargoInput??0;
      if(i===18){
        const p=state.players.players.find(q=>q.id===seatId);
        return node.status==="stable"&&state.aliens.chong?.fossilsById?.[goal.fossilId]?.taskCompleted
          &&p.income.energy===goal.energyIncome+1&&!p.hand.some(c=>c.id===goal.incomeCardId)
          ?{kind:"complete",reason:"data-funded-cargo-settled"}
          :{kind:"infeasible",reason:"data-funded-cargo-endpoint-changed"};
      }
      const find=f=>node.legalActions.find(f);
      let a;
      if([0,2,11,13,15].includes(i))a=find(q=>q.family==="place_data");
      else if([1,12,14,16].includes(i))a=find(q=>q.family==="choose_target"&&q.target?.target==="computer");
      else if(i===3)a=find(q=>q.family==="choose_target"&&q.target?.target==="blueBonus"&&q.target.blueSlot===1);
      else if(i===10)a=find(q=>q.family==="complete_task"&&q.target?.cardInstanceId===goal.cardId&&q.target.ruleId==="transport");
      else if(i===17)a=find(q=>q.family==="choose_card"&&q.target?.choiceId==="income:"+goal.incomeCardId);
      else{
        const index=(i-4)>>1,move=goal.path[index],id=goal.payers[index];
        const direction=q=>q.target.rocketId===move.rocketId&&q.target.deltaX===move.deltaX&&q.target.deltaY===move.deltaY;
        if(id)a=i%2===0?find(q=>q.family==="card_corner"&&q.payload?.kind==="move"&&q.payload.multiplier===1&&q.target.cardInstanceId===id)
          :find(q=>q.family==="choose_target"&&direction(q));
        else a=i%2===0?find(q=>q.family==="move"&&direction(q))
          :find(q=>q.family==="choose_payment"&&q.target?.kind==="move-payment"&&!q.target.cardIds.length);
      }
      return a?{kind:"fixed",actionId:a.actionId,reason:"data-funded-cargo-step",cargoInput:i+1}
        :{kind:"infeasible",reason:"data-funded-cargo-menu-changed"};
    }

    function resourceStep(node,goal,operation={}) {
      const stored=nodes.get(node),state=readPlanningState(stored),session=stored.envelope.session?.session;
      if(goal.kind==="data-funded-cargo")return dataFundedCargoStep(node,state,goal,operation);
      if(goal.kind==="funded-earth-shipment"){
        const find=f=>node.legalActions.find(f),fixed=(a,reason)=>({kind:"fixed",actionId:a.actionId,reason});
        if (goal.directEnergy) {
          const input = operation.cargoInput ?? 0;
          if (input === 2 * goal.path.length + 1) return {kind:"complete",reason:"funded-earth-shipment-settled"};
          const move = goal.path[Math.floor(input / 2)];
          const source = session?.journal?.actions?.[0]?.action;
          const matches = action => action?.target?.rocketId === move.rocketId
            && action.target.deltaX === move.deltaX && action.target.deltaY === move.deltaY;
          const action = !move ? find(a => a.family === "complete_task" && a.target?.cardInstanceId === goal.cardId
            && a.target.ruleId === "transport")
            : input % 2 === 0 ? find(a => a.family === "move" && matches(a) && a.payload?.requiredMovePoints === 1)
            : source?.family === "move" && matches(source) && find(a => a.family === "choose_payment"
              && a.target?.kind === "move-payment" && a.target.choiceId === "energy" && a.payload?.energyCost === 1);
          return action ? {...fixed(action,"execute-funded-earth-shipment"),cargoInput:input+1}
            : {kind:"infeasible",reason:"funded-earth-shipment-menu-changed"};
        }
        if(node.status==="stable"){
          const claim=find(a=>a.family==="complete_task"&&a.target?.cardInstanceId===goal.cardId&&a.target.ruleId==="transport");
          if(claim)return fixed(claim,"settle-funded-earth-shipment");
          if(!Object.values(state.aliens.chong?.transportTasksByRocketId||{}).some(t=>t.cardId===goal.cardId))
            return {kind:"complete",reason:"funded-earth-shipment-settled"};
        }
        const step=fundedEarthShipmentStep(node,stored,state,session);
        return step?.quote.cardId===goal.cardId?fixed(step.action,"execute-funded-earth-shipment")
          :{kind:"infeasible",reason:"funded-earth-shipment-menu-changed"};
      }
      if(goal.kind==="cargo-research-corner"){
        const p=state.players.players.find(q=>q.id===seatId),stage=goal.stage,head=session?.queue?.[0];
        if(operation.targetStarted){
          const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
          const next=[...goal.projected].reverse().find(t=>jobs.some(j=>j.fossilId===t.fossilId&&!j.delivered));
          const find=f=>node.legalActions.find(f);
          const fixed=(a,reason)=>a?{kind:"fixed",actionId:a.actionId,reason}:{kind:"infeasible",reason};
          if(node.status==="decision"){
            const source=session?.journal?.actions?.[0]?.action;
            if(source?.family==="quick_trade"&&source.target?.tradeId==="energy-for-move"
              &&head?.payload?.decisionContext?.kind==="move"){
              return fixed(next&&find(a=>a.family==="choose_target"&&a.target?.rocketId===next.rocketId
                &&a.target.deltaX===next.deltaX&&a.target.deltaY===next.deltaY),"known-research-delivery-direction");
            }
            if(source?.family==="place_data"&&head?.type===scienceSession.EFFECT_TYPES.PLACE_DATA){
              const slots=data.listPlaceDataChoices(p);
              return fixed(slots.length===1&&find(a=>a.family==="choose_target"&&a.target?.target===slots[0].target
                &&(a.target.blueSlot??null)===(slots[0].blueSlot??null)),"make-room-in-data-pool-before-known-cargo-claim");
            }
            if(head?.payload?.kind==="chong_task"){
              const local=localDecisionSpec(node);
              return fixed(find(a=>a.actionId===local?.selectedActionId)
                ||find(a=>a.family==="accept_optional_effect"&&a.target?.choiceId?.startsWith("skip:chong_task:")),
                "known-research-delivery-optional");
            }
            const choices=source?.family==="research_tech"?node.legalActions.filter(a=>a.target?.tileId):[];
            if(choices.length){
              const tiles=resourceDemand.greedyTechPlans({state,seatId,plans:choices.map(a=>({...a.target,blueSlot:a.target.blueSlot??null,actionId:a.actionId}))});
              return {kind:"fallback",reason:"known-cargo-research-tile",actionIds:tiles.map(t=>t.actionId)};
            }
            const local=localDecisionSpec(node);
            return local?.selectedActionId?fixed(find(a=>a.actionId===local.selectedActionId),"known-research-delivery-local")
              :{kind:"fallback",reason:"known-cargo-research-native-choice",actionIds:node.legalActions.map(a=>a.actionId)};
          }
          if(!next){
            const first=chong.listDeliveredFossilsForDestination(state.aliens,"earth")[0];
            if(first){
              const fossil=chong.getFossilReward(first.fossilId);
              if(!fossil||fossil.pickCard||fossil.pickAlienCard||fossil.drawCards||fossil.chooseFossilRewardOnly)
                return {kind:"infeasible",reason:"unknown-research-cargo-reward"};
              const options=node.legalActions.flatMap(a=>{
                if(a.family!=="complete_task"||a.target.ruleId!=="transport"||!goal.cards.includes(a.target.cardInstanceId))return [];
                const card=p.reservedCards.find(c=>c.id===a.target.cardInstanceId),task=card&&(card.chongTask||chong.getCardTask(card));
                if(task?.kind!=="transport"||task.destinationPlanetId!=="earth"||task.effects||task.rewards
                  ||task.drawCards||task.pickCard||task.pickAlienCard||task.fossilRewardRepeat!==1)return [];
                const total=(task.dataCount||0)+(fossil.dataCount||0);
                return [{a,overflow:Math.max(0,p.resources.availableData+total-players.RESOURCE_LIMITS.availableData)}];
              }).sort((a,b)=>a.overflow-b.overflow||a.a.actionId.localeCompare(b.a.actionId));
              const claim=options[0];
              if(!claim)return {kind:"infeasible",reason:"known-research-cargo-claim-unavailable"};
              const slots=claim.overflow?data.listPlaceDataChoices(p):[];
              if(slots.length===1&&(slots[0].target==="computer"||data.getBlueBonusPlacementReward(p,slots[0].blueSlot)?.type!=="choose_card")){
                return fixed(find(a=>a.family==="place_data"),"make-room-in-data-pool-before-known-cargo-claim");
              }
              if(slots.length>1)return {kind:"complete",reason:"distinct-data-sinks-require-existing-policy"};
              return fixed(claim.a,"claim-known-research-cargo");
            }
            return fixed(find(a=>a.family==="end_turn"),"finish-funded-research-and-cargo-turn");
          }
          const at=rockets.getRocketSectorCoordinate(state.pieces.rockets.find(r=>r.id===next.rocketId));
          const dest=solar.collectPlanetLocations(state.solarSystem).find(v=>v.planetId==="earth");
          const legal=at?.x===next.from.x&&at.y===next.from.y&&dest.x===next.to.x&&dest.y===next.to.y
            &&rocketAbilities.getRequiredMovePointsFromCoordinate(state,p,at)===1
            &&rockets.canMoveFromCoordinate(state.pieces,at,next.deltaX,next.deltaY,next.rocketId).ok;
          return fixed(legal&&p.mainActionCompleted&&find(a=>a.family==="quick_trade"&&a.target?.tradeId==="energy-for-move"),
            "pay-one-point-for-known-research-delivery");
        }
        const a=node.legalActions.find(a=>{
          if(node.status==="decision")return head?.payload?.cardEffect?.type==="card_move"&&head.payload.remaining===1
            &&session.journal.actions[0]?.action.actionId===goal.cornerActionId&&a.family==="choose_target"
            &&a.target?.rocketId===stage.rocketId&&a.target.deltaX===stage.deltaX&&a.target.deltaY===stage.deltaY
            &&a.payload?.requiredMovePoints===1;
          if(p.hand.some(c=>c.id===goal.payerId))return a.actionId===goal.cornerActionId;
          const at=rockets.getRocketSectorCoordinate(state.pieces.rockets.find(r=>r.id===stage.rocketId));
          return at?.x===stage.to.x&&at.y===stage.to.y&&a.family==="research_tech"&&!a.payload?.skipRotate&&!a.payload?.skipCost;
        });
        return a?{kind:a.family==="research_tech"?"start-target":"fixed",actionId:a.actionId,reason:"advance-known-fossil-before-funded-research"}
          :{kind:"infeasible",reason:"known-cargo-research-prefix-changed"};
      }
      if(goal.kind==="blue-cash-analysis-tail"){
        const p=state.players.players.find(q=>q.id===seatId),count=data.listComputerPlacedTokens(p).length;
        if(node.status==="stable"&&data.listBlueBonusPlacedTokens(p).some(t=>t.blueSlot===3))
          return {kind:"complete",reason:"known-analysis-computer-and-cash-ready"};
        const a=node.legalActions.find(a=>node.status==="stable"?a.family==="place_data":
          a.family==="choose_target"&&(count<6?a.target.target==="computer":a.target.blueSlot===3));
        return a?{kind:"fixed",actionId:a.actionId,reason:"fill-blue-column-before-cash-for-analysis"}
          :{kind:"infeasible",reason:"known-analysis-computer-or-cash-unavailable"};
      }
      if(goal.kind==="transport-data-prep"){
        const p=state.players.players.find(q=>q.id===seatId),computer=data.listComputerPlacedTokens(p).length;
        const acquired=p.hand.some(c=>c.id===goal.cardId);
        if(node.status==="stable"&&acquired&&computer===5){
          const end=node.legalActions.find(a=>a.family==="end_turn");
          return end&&p.resources.availableData===1&&!node.legalActions.some(a=>a.family==="complete_task")
            ?{kind:"fixed",actionId:end.actionId,reason:"finish-known-transport-preparation-turn"}
            :{kind:"infeasible",reason:"known-transport-data-wallet-changed"};
        }
        const head=session?.queue?.[0];
        const action=node.legalActions.find(a=>{
          if(node.status==="stable")return goal.swapOutId&&!acquired?a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards":a.family==="place_data";
          if(head?.type===scienceSession.EFFECT_TYPES.PLACE_DATA)return a.family==="choose_target"&&(computer===4
            ?a.target?.target==="computer":a.target?.target==="blueBonus"&&a.target.blueSlot===goal.blueSlot);
          if(head?.type==="residual_company_decision"){
            const outgoing=head.payload.step==="swap_hand";
            return (outgoing||head.payload.step==="swap_public"&&head.payload.handCardInstanceId===goal.swapOutId)
              &&a.family==="choose_card"&&a.target?.cardInstanceId===(outgoing?goal.swapOutId:goal.cardId);
          }
          return head?.type===scienceSession.EFFECT_TYPES.PICK_CARD&&a.family==="choose_card"&&a.target?.cardInstanceId===goal.cardId;
        });
        return action?{kind:"fixed",actionId:action.actionId,reason:"fixed-computer-and-public-transport-payment"}
          :{kind:"infeasible",reason:"known-transport-data-input-unavailable"};
      }
      if(goal.movementFunding){
        const payment=goal.movementFunding,p=state.players.players.find(v=>v.id===seatId);
        const fundingSource=session?.journal?.actions?.[0]?.action;
        if(node.status==="decision"&&payment.scoredCornerId&&fundingSource?.actionId===payment.scoredCornerId){
          const head=session.queue[0],target=payment.cornerTarget;
          const action=session.queue.length===1&&head.ownerId===seatId&&!head.allowQuickActions
            &&head.payload?.cardEffect?.type==="card_move"&&head.payload.remaining===1
            &&node.legalActions.find(a=>a.family==="choose_target"&&a.payload?.requiredMovePoints===1
              &&a.target.rocketId===target.rocketId&&a.target.deltaX===target.deltaX&&a.target.deltaY===target.deltaY);
          return action?{kind:"fixed",actionId:action.actionId,reason:"known-scored-research-direction"}
            :{kind:"infeasible",reason:"known-scored-research-direction-changed"};
        }
        if(node.status==='decision'&&fundingSource?.actionId===payment.firstMoveId){
          const a=node.legalActions.find(x=>x.target?.kind==='move-payment'&&x.target.cardIds?.length===1
            &&x.target.cardIds[0]===payment.cardId&&x.payload?.energyCost===0);
          return a?{kind:'fixed',actionId:a.actionId,reason:'pay-purposeful-research-move'}
            :{kind:'infeasible',reason:'known-research-move-payment-changed'};
        }
        if(node.status==='stable'&&!p.mainActionCompleted&&p.hand.some(c=>c.id===payment.cardId)){
          const a=node.legalActions.find(x=>x.actionId===(payment.scoredCornerId||payment.firstMoveId));
          return a&&p.resources.publicity===payment.publicity?{kind:'fixed',actionId:a.actionId,reason:payment.scoredCornerId
            ?'scored-corner-funds-same-research-route':'one-known-route-step-funds-research'}
            :{kind:'infeasible',reason:'known-research-move-source-changed'};
        }
        if(payment.publicityPayerId&&node.status==="stable"&&!p.mainActionCompleted&&p.resources.publicity<goal.required.publicity){
          const corner=node.legalActions.find(a=>a.family==="card_corner"&&a.target.cardInstanceId===payment.publicityPayerId
            &&a.payload.kind==="resource"&&(a.payload.multiplier??1)===1);
          return corner&&p.resources.publicity+(payment.publicityGain??1)===goal.required.publicity?{kind:"fixed",actionId:corner.actionId,reason:"retain-transport-supplier-during-research-payment"}
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
      if(goal.kind==="satellite-scan-setup")return satelliteScanSetupStep(node,state,session,goal);
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
      const currency=ready.filter(r=>data.getBlueBonusPlacementReward(p,r.blueSlot)?.type==="credits");
      if(currency.length!==1)return null;
      const goal={id:"data:blue:"+currency[0].blueSlot,kind:"blue-data",blueSlot:currency[0].blueSlot,required:{}};
      const competing=ready.length!==1;
      if(competing&&!knownRootAlienIds.has("虫"))return null;
      const q=localPlans.previewBlueCompletion({state,seatId,goal});
      if(!q.available||q.requiredNativeInputs!==2||q.player.resources.credits!==1||q.player.resources.availableData!==0)return null;
      const next=previewTurn(state);
      if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
      const funded={...q.player,mainActionCompleted:false};
      const future={...state,players:{...state.players,players:state.players.players.map(a=>a===p?funded:a)}};
      const native=productionKernel||globalThis.SetiProductionKernel;
      const route=resourceDemand.heldLandingGoal({state:future,seatId,compareTiming:timingForOneGoalQuery(future),
        candidates:()=>native.getProbeRouteRequirements(future,seatId)?.candidates||[]});
      return route?.embeddedMove?{...goal,knownTransport:route.id,knownTransportValue:route.value,...(competing?{competingTransportCash:true}:{})}:null;
    }

    function satelliteScanSetup(state,stored){
      const turn=state.turn,owner=state.players.players.find(p=>p.id===seatId);
      if(!scanPlanning||!movementPlanning||turn.roundNumber!==4||turn.currentPlayerId!==seatId||turn.gameEnded
        ||owner.mainActionCompleted||owner.passCompletionPending||turn.passedPlayerIds.includes(seatId)
        ||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
        ||turn.cardTurnEventBonuses?.length||owner.industryBorrowedTechTileId
        ||owner.reservedCards.some(c=>!knownCards(stored.envelope).has(c.id))
        ||localPlans.hasPendingFossilArrival(state))return null;
      const pickup=goalMovement.knownSatellitePickup(owner),cost=scanEffects.getStandardScanCost(owner);
      if(!pickup||!knownCards(stored.envelope).has(pickup.card.id)||owner.resources.credits<(cost.credits||0)+pickup.cost.credits
        ||!players.canAfford(owner,cost)||owner.resources.publicity<1)return null;
      const types=scanEffects.EFFECT_TYPES,queue=scanEffects.buildScanEffectQueue(owner,{fullScanAction:true,turn});
      if(queue.length!==4||![types.EARTH_SECTOR_SCAN,types.IMPROVED_SECTOR_SCAN].includes(queue[0].type)
        ||queue[1].type!==types.PUBLIC_CARD_SCAN||queue[2].type!==types.SCAN_ACTION_4
        ||queue[3].type!==types.MERCURY_SECTOR_SCAN||queue[3].options?.cost?.publicity!==1)return null;
      const tiles=type=>scienceSession.listNebulaChoices(state,{
        ...scienceSession.getPlanetScanSource(state,type),gainData:true});
      const earth=tiles(queue[0].type),mercury=tiles(queue[3].type);
      if(earth.length!==1||mercury.length!==1)return null;
      const prepare=Math.max(0,owner.resources.availableData+3-players.RESOURCE_LIMITS.availableData);
      const computer=data.listComputerPlacedTokens(owner).map(t=>t.placementSlot).join(",");
      const blue=data.listBluePlacementRequirements(owner);
      if(owner.resources.availableData+3-prepare!==players.RESOURCE_LIMITS.availableData
        ||prepare>1||owner.resources.availableData!==owner.dataState.poolTokens.length
        ||computer!==(prepare?"1":"1,2")||blue.length!==2
        ||blue[0].requiredComputerSlot!==1||blue[1].requiredComputerSlot!==3
        ||blue.some((slot,i)=>{
          const reward=data.getBlueBonusPlacementReward(owner,slot.blueSlot);
          return i===0?reward?.type!=="energy"||reward.energy!==1:reward?.type!=="credits"||reward.credits!==1;
        }))return null;
      const planet=(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(state,seatId);
      const routes=planet?.candidates.filter(route=>route.endpointFamily==="land"&&route.endpointTarget?.type==="satellite"
        &&["jupiter","saturn"].includes(route.planetId)&&route.path?.length===1&&route.required.movementPoints===1
        &&route.endpointFacts.rewards.filter(r=>r.type==="choose_colored_nebula_scan").length>=2
        &&state.pieces.rockets.some(r=>r.id===route.rocketId&&!r.fossilId))||[];
      if(!routes.length)return null;
      const publicOffers=scienceSession.listPublicScanChoices(state),candidates=[];
      const empty=id=>data.listNebulaTokens(state.data,id).filter(t=>!t.replacedByPlayerColor&&!t.playerColor).length;
      for(const offer of publicOffers){
        if(!knownCards(stored.envelope).has(offer.target.cardInstanceId))continue;
        const scans=[earth[0].target.nebulaId,offer.target.nebulaId,mercury[0].target.nebulaId];
        if(new Set(scans).size!==3||scans.some(id=>empty(id)<2))continue;
        for(const route of routes){
          const rewards=route.endpointFacts.rewards;
          if(goalMovement.knownSatelliteSectorCount(state,owner,rewards)>=2
            ||goalMovement.knownSatelliteSectorCount(state,owner,rewards,scans)<2)continue;
          const at=solar.collectPlanetLocations(state.solarSystem).find(p=>p.planetId===route.planetId);
          if(!at)continue;
          candidates.push({id:"scan:prepare:"+route.requirementId,kind:"satellite-scan-setup",required:{},cardId:pickup.card.id,
            price:pickup.cost.credits,scanData:owner.resources.availableData-prepare,blueSlots:blue.map(x=>x.blueSlot),
            scans,publicCardId:offer.target.cardInstanceId,rocketId:route.rocketId,at:{x:at.x,y:at.y},
            dx:route.path[0].deltaX,dy:route.path[0].deltaY,routeId:route.requirementId,rewards});
        }
      }
      // Competing feasible routes need their ordinary policies; this proof is
      // for a unique funded target and does not enumerate routes in search.
      return candidates.length===1?candidates[0]:null;
    }

    function satelliteScanSetupStep(node,state,session,goal){
      const p=state.players.players.find(q=>q.id===seatId);
      const pick=(test,reason)=>{
        const action=node.legalActions.find(test);
        return action?{kind:"fixed",actionId:action.actionId,reason}:{kind:"infeasible",reason};
      };
      const computer=data.listComputerPlacedTokens(p).map(t=>t.placementSlot).join(",");
      const blue=data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot).sort().join(",");
      const [first,second]=goal.blueSlots;
      // Claim the two known currency slots without reaching the income slot
      // that could consume the funded satellite card.
      const tail=computer==="1,2"&&!blue&&p.resources.availableData===6?first
        :computer==="1,2"&&blue===String(first)&&p.resources.availableData===5?"computer"
          :computer==="1,2,3"&&blue===String(first)&&p.resources.availableData===4?second:null;
      if(node.status==="stable"){
        if(!p.mainActionCompleted){
          if(computer==="1"&&p.resources.availableData===goal.scanData+1)
            return pick(a=>a.family==="place_data","one-computer-slot-before-three-scans");
          return computer==="1,2"&&p.resources.availableData===goal.scanData
            ?pick(a=>a.family==="scan","start-satellite-scan"):{kind:"infeasible",reason:"satellite-scan-data-capacity-mismatch"};
        }
        const probe=state.pieces.rockets.find(r=>r.id===goal.rocketId),at=probe&&rockets.getRocketSectorCoordinate(probe);
        if(at?.x!==goal.at.x||at?.y!==goal.at.y||!p.hand.some(c=>c.id===goal.cardId)
          ||p.resources.credits<goal.price||goalMovement.knownSatelliteSectorCount(state,p,goal.rewards)<2)
          return {kind:"infeasible",reason:"satellite-scan-funded-landing-missing"};
        if(tail!==null)return pick(a=>a.family==="place_data","bank-currency-without-consuming-satellite-card");
        return computer==="1,2,3"&&blue===[first,second].sort().join(",")&&p.resources.availableData===3
          ?pick(a=>a.family==="end_turn","close-known-scan-preparation")
          :{kind:"infeasible",reason:"satellite-scan-unproved-data-tail"};
      }
      const source=session?.journal?.actions?.[0]?.action?.family,head=session?.queue?.[0];
      if(source==="place_data"&&head?.type===scienceSession.EFFECT_TYPES.PLACE_DATA){
        const target=p.mainActionCompleted?tail:computer==="1"?"computer":null;
        return pick(a=>target==="computer"?a.target?.target==="computer":target!==null&&a.target?.blueSlot===target,
          "fixed-satellite-scan-data-placement");
      }
      if(source==="scan"&&head?.type===scienceSession.EFFECT_TYPES.SCAN_ACTION_4)
        return pick(a=>a.target?.mode==="move"&&a.target.rocketId===goal.rocketId
          &&a.target.deltaX===goal.dx&&a.target.deltaY===goal.dy&&a.payload?.requiredMovePoints===1,"free-move-to-funded-satellite");
      if(source==="scan"&&head?.type===scienceSession.EFFECT_TYPES.SCAN_STEP){
        const opts=head.payload?.options;
        if(opts?.mode==="public")return pick(a=>a.target?.nebulaId===goal.scans[1]
          &&a.target.cardInstanceId===goal.publicCardId,"leave-public-sector-one-short");
        const paid=opts?.cost?.publicity===1;
        return pick(a=>a.target?.nebulaId===goal.scans[paid?2:0]&&a.payload?.gainData===true,"scan-known-earth-or-mercury-sector");
      }
      return {kind:"infeasible",reason:"satellite-scan-unproved-native-followup"};
    }

    function resourceSpec(node) {
      const stored=nodes.get(node);
      if(!fork||!stored)throw new Error("ANALYSIS_NODE_INVALID");
      if(!resourcePlanning||!["stable","decision"].includes(node.status)||!node.legalActions.length)return null;
      if(resourceSpecs.has(node))return resourceSpecs.get(node);
      const pending=stored.envelope.session?.session;
      // A regular Native reward menu cannot supply a new resource plan.
      // Retain its complete menu and policy shape without rebuilding wallets,
      // except for typed preparation, scan, payment, or root recovery.
      if(node.status==="decision"&&node!==openedRoot&&!stored.resourceControl){
        const source=pending?.journal?.actions?.[0]?.action,decision=pending?.queue?.[0]?.payload?.decisionContext;
        if(!resourceDemand.isPreparation(source||{})&&source?.family!=="move"
          &&!(scanPlanning&&localPlans.scanDecision(node.legalActions))
          &&!(decision?.kind==="discard"&&resourceDemand.MONEY.has(decision.tradeId))){
          const spec=cardPickSpec(node)?.fixed?null:freeze({policy:resourceDemand.VERSION,isEquivalence:false,
            plans:[],retainedActionIds:node.legalActions.map(a=>a.actionId),excludedActionIds:[]});
          resourceSpecs.set(node,spec);return spec;
        }
      }
      const shipment=node===openedRoot&&!stored.resourceControl&&!stored.intent
        &&(fundedEarthShipmentStep(node,stored,null,pending)||directEarthShipment(node,stored));
      const shipmentPlan=shipment&&{id:"cargo:funded:"+shipment.quote.cardId,
        goal:{...shipment.quote,id:"cargo:funded:"+shipment.quote.cardId,required:{}},operation:{},
        firstActionId:shipment.action.actionId,mode:"greedy",reason:"funded-earth-shipment"};
      if(shipmentPlan&&node.status==="decision"){
        const fixed=freeze({policy:resourceDemand.VERSION,isEquivalence:false,cargoCommittedMovement:true,
          plans:[shipmentPlan],retainedActionIds:[],excludedActionIds:node.legalActions.map(a=>a.actionId)});
        resourceSpecs.set(node,fixed);return fixed;
      }
      const cashBase=node.status==="stable"&&node.legalActions.some(a=>a.family==="end_turn"&&a.actorId===seatId)
        &&!node.legalActions.some(a=>a.family==="complete_task")
        ?readPlanningState(stored)
        :node.status==="decision"&&pending?.queue?.length===1&&pending.queue[0].type===scienceSession.EFFECT_TYPES.PLACE_DATA
          &&pending.journal?.actions?.[0]?.action.family==="place_data"&&pending.baseState
          ?planningState(pending.baseState,stored.informationBarrier,knownCards(stored.envelope)):null;
      const cash=cashBase&&transportCashGoal(cashBase,stored);
      let competingCash=null;
      if(cash){
        const a=node.legalActions.find(a=>node.status==="stable"?a.family==="place_data":a.target?.target==="blueBonus"&&a.target.blueSlot===cash.blueSlot);
        if(!a)throw Error("HELD_TRANSPORT_BLUE_CASH_TARGET_MISSING");
        const plan={id:cash.id,goal:cash,operation:{finalPlacement:node.status==="decision"},firstActionId:a.actionId,mode:"greedy",reason:"known-blue-cash-funds-held-transport"};
        const fixed=freeze({policy:resourceDemand.VERSION,isEquivalence:false,plans:[plan],retainedActionIds:[],
          excludedActionIds:node.legalActions.map(a=>a.actionId)});
        if(!cash.competingTransportCash){resourceSpecs.set(node,fixed);return fixed;}
        competingCash=plan;
      }
      const preparation=node===openedRoot?transportPreparationPurpose()
        :node.status==="stable"&&stored.informationBarrier?.code==="hidden_card_reveal"
          &&upstreamTransportSource()&&upstreamTransportState(readPlanningState(stored),false)?transportPreparationPurpose(node):null;
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
          if(source.family==="move"||source.target?.tradeId==="cards-for-credit"){
            const native=productionKernel||globalThis.SetiProductionKernel;
            const landing=resourceDemand.heldLandingGoal({state:base,seatId,compareTiming:timingForOneGoalQuery(base),
              candidates:()=>native.getProbeRouteRequirements(base,seatId)?.candidates||[]});
            if(landing?.directTransport)goals=[...goals,landing];
          }
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
            // A completed free move toward a next-turn landing carries no
            // current payment. Keep the route as evidence, but compare the
            // already funded income exactly as at a cold post-scan root.
            const move=stored.intent;
            const completedFreeVisit=move?.free===true&&move.path.length===0&&move.goal.kind==='land'
              &&move.goal.timing==='advance-before-rotation'&&move.startedRound===turn.roundNumber
              &&move.startedTurn===turn.turnNumber&&stored.informationBarrier?.code==='hidden_card_reveal';
            if(turn.roundNumber===3&&data.listComputerPlacedTokens(p).length===0
              &&([2,3].includes(p.resources.availableData)||threeCorners)&&p.resources.credits===0&&p.resources.energy===0
              &&(!move||completedFreeVisit)
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
          :(source?.family==="move"||source?.family==="card_corner"&&source.payload?.kind==="move")&&session?.baseState
            ?(()=>{
              const known=knownCards(envelope);
              const sourceKnown=source.family==="card_corner"?new Set([...known,source.target.cardInstanceId]):known;
              return transportResearchMove(planningState(session.baseState,stored.informationBarrier,sourceKnown),[],sourceKnown,source);
            })():null;
        if(transport&&(!transport.heldPayments||fixedResearchTransportValue(
          session?.baseState?planningState(session.baseState,stored.informationBarrier,knownCards(envelope)):state,
          knownCards(envelope),transport.probeId,true)))goals=[...goals,transport];
        const displayedMove=node.status==="stable"&&node.legalActions.some(a=>a.family==="move")
          ?displayedTransportResearchMove(state,node.legalActions,knownCards(envelope))
          :source?.family==="move"&&session?.baseState
            ?displayedTransportResearchMove(planningState(session.baseState,stored.informationBarrier,knownCards(envelope)),[],knownCards(envelope),source):null;
        if(displayedMove)goals=[...goals,displayedMove];
      }
      const preparationBase=state.turn.roundNumber!==3?null
        :node.status==='stable'&&node.legalActions.some(a=>a.family==='place_data')?state
        :node.status==='decision'&&source?.family==='place_data'&&session?.baseState
          ?planningState(session.baseState,stored.informationBarrier,knownCards(stored.envelope)):null;
      const deferColumn=preparationBase&&waitForKnownBlueColumn(node,preparationBase,knownCards(envelope));
      if(deferColumn){
        goals=goals.filter(goal=>goal.kind!=="computer-prefix");
        computerTail=null;
      }
      const special=preparationBase&&!deferColumn&&analysisPreparation(preparationBase,stored,node);
      // Complete the quiet slots before choosing a main action. The existing
      // analyze goal binds preparation to immediate analysis and cannot price
      // the public region action with an analysis still in reserve.
      if(preparationBase&&node===openedRoot&&!stored.intent&&!stored.resourceControl){
        const prep=publicRegionComputerPreparation(preparationBase,knownCards(envelope));
        if(prep)goals=[...goals,prep];
      }
      if(special)goals=[...goals,special];
      const cashColumn=preparationBase&&!stored.intent&&!stored.resourceControl
        &&!node.legalActions.some(a=>a.family==="complete_task")&&hasDeferredBlueCashTail(preparationBase,knownCards(envelope));
      if(cashColumn)goals=[...goals,blueCashAnalysisTail];
      const satelliteBase=node===openedRoot&&state.turn.roundNumber===4&&!stored.resourceControl&&!stored.intent
        ?node.status==="stable"?state:["place_data","scan"].includes(source?.family)&&session?.baseState
          ?planningState(session.baseState,stored.informationBarrier,knownCards(envelope)):null:null;
      const satellite=satelliteBase&&satelliteScanSetup(satelliteBase,stored);
      if(satellite)goals=[...goals,satellite];
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
      const adjacentCargo=resumeKnownCargo(node,stored,state),cargoCorner=adjacentCargo||cargoResearchCorner(node,stored,state);
      if(cargoCorner){
        const op={targetStarted:Boolean(adjacentCargo)},step=resourceStep(node,cargoCorner,op);
        if(step.actionId)plans.push({id:cargoCorner.id,goal:cargoCorner,operation:op,firstActionId:step.actionId,mode:"greedy",reason:step.reason});
        else if(step.kind==="fallback")for(const id of step.actionIds)plans.push({id:cargoCorner.id+":"+id,goal:cargoCorner,operation:op,
          firstActionId:id,mode:"search-fallback",fallbackReason:step.reason});
      }
      const dataCargo=dataFundedCargoPlan(node,stored,state);
      if(dataCargo)plans.push(dataCargo);
      if(shipmentPlan)plans.push(shipmentPlan);
      if(preparation)plans.push(preparation.plan);
      if(competingCash){
        const i=plans.findIndex(x=>x.goal.id===competingCash.goal.id&&x.firstActionId===competingCash.firstActionId);
        if(i>=0)plans[i]=competingCash;else plans.push(competingCash);
      }
      const owner=state.players.players.find(p=>p.id===seatId);
      const fixedPrefix=computerTail?.selected&&plans.find(p=>p.goal.kind==="computer-prefix");
      if(node.status==="stable"&&state.turn.roundNumber===3&&owner.mainActionCompleted
        &&!stored.intent&&fixedPrefix&&plans.every(p=>p.goal.kind==="computer-prefix"
          ||p.goal.kind==="blue-data"&&p.goal.targetComputerSlot<=computerTail.targetComputerSlot)
        &&!cardPick?.goal&&!node.legalActions.some(a=>a.family==="complete_task")&&!hasOwnVisitSource(state)
        &&owner.hand.every(c=>knownCards(envelope).has(c.id))
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        &&industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId==="deepspace_swap_cards"
        &&hasPostMainInertReservations(state,false,true,true)){
        const transition=previewTurn(state);
        if(transition.turnAdvanced&&!transition.roundAdvanced&&!transition.gameEnded&&transition.nextPlayerId===seatId
          &&localPlans.deferredComputerPublicity({state,seatId,goal:fixedPrefix.goal,blueTail:plans.some(p=>p.goal.kind==="blue-data"),noAcquisition:quietTailHasNoAcquisition,
            knownTech:(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id))})){
          plans.length=0;computerTail=null;
        }
      }
      let sharedDataFunding=null;
      if(node.status==="stable"&&plans.length===1&&plans[0].goal.kind==="blue-data"
        &&incomeTail?.reason==="income-tail-needs-additional-funding"&&owner.resources.availableData===0){
        const blue=plans[0],action=node.legalActions.find(a=>a.actionId===blue.firstActionId);
        const cargoIncome=owner.hand.length===2&&stationaryCargoIncomeWindow(state,stored,node)
          &&owner.hand.some(c=>c.id!==action?.target.cardInstanceId&&cards.getIncomeGainForCard(c)?.energy===1);
        if(action?.family==="card_corner"&&action.payload?.kind==="resource"&&(action.payload.multiplier??1)===1
          &&(quietScoredIncomeState(state,stored)||cargoIncome)){
          const prepared=localPlans.previewScoredAmibaDataCorner({state,seatId,cardId:action.target.cardInstanceId});
          const future=prepared&&(quietScoredIncomeState(prepared,stored)||cargoIncome&&stationaryCargoIncomeWindow(prepared,stored,node))
            &&localPlans.quietEndCompletion({state:prepared,seatId}).markedTiles?.length===0;
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
      const rootCargo=openedRoot?.legalActions.find(a=>a.family==="complete_task"&&a.target?.ruleId==="transport");
      const rootCargoCard=rootCargo&&readIdentityState(nodes.get(openedRoot).envelope).players.players
        .find(p=>p.id===seatId)?.reservedCards.find(c=>c.id===rootCargo.target.cardInstanceId);
      const scoredCorner=node.status==="stable"&&rootCargoCard&&knownRootAlienIds.has("虫")
        &&state.cards.removedFromGameCardIds.includes(rootCargoCard.cardId)
        &&node.legalActions.some(a=>a.family==="end_turn")&&!node.legalActions.some(a=>a.family==="complete_task")
        ?localPlans.scoredEndCorner({state,seatId,actions:node.legalActions,knownCards:knownCards(stored.envelope)}):null;
      const deferredCappedTask=cappedSectorTaskToKeep(state,owner,node);
      const excluded=node.status==="stable"?node.legalActions.filter(a=>a.actionId===deferredCappedTask?.actionId||scoredCorner&&a.family==="end_turn"||a.family==="industry"&&["turing_borrow_tech","helios_remove_tech_income"].includes(a.target?.abilityId)||plans.some(p=>p.goal.kind==="effect-purpose"&&p.firstActionId===a.actionId)||a.family==="play_card"&&plans.some(p=>p.goal.cardId===a.target.cardInstanceId&&p.goal.paidRewardPolicy)||resourceDemand.isPreparation(a)&&a.actionId!==scoredCorner?.actionId||scanPlanning&&plans.some(p=>p.goal.kind==="scan-flow")&&a.family==="scan"||!owner.mainActionCompleted&&["orbit","land","research_tech",...(plans.some(p=>p.goal.kind==="route")?["move"]:[])].includes(a.family)):adjacentCargo?.paid||plans.some(p=>p.goal.kind!=="cargo-research-corner")?node.legalActions:[];
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
      const compareFixedPurposes=Boolean(competingCash||preparation||cashColumn||cargoCorner||shipmentPlan||satellite);
      // A known ready transport that fits in the pool commutes with the
      // already funded computer-income prefix after a public analysis. Join
      // the collected state before replaying those same four placements.
      if(resolvedPublicAnalysis.has(node)&&forcedKind==="income"&&!swapAction&&!compareFixedPurposes
        &&incomeTail.placements===4&&state.turn.roundNumber===4&&rootCargoCard&&knownRootAlienIds.has("虫")
        &&!stored.intent&&!stored.informationBarrier&&!owner.industryBorrowedTechTileId
        &&!state.turn.cardTurnEventBonuses?.length
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        &&owner.resources.availableData===4&&owner.dataState.poolTokens.length===4
        &&owner.reservedCards.every(c=>knownRootCardIds.has(c.id))){
        const ready=node.legalActions.filter(a=>a.family==="complete_task");
        const cargo=ready.length===1&&ready[0].target.cardInstanceId===rootCargoCard.id
          &&ready[0].target.ruleId==="transport"
          &&localPlans.knownDeliveredCargo({state,seatId,knownCards:knownRootCardIds,knownFossilIds:visibleRootCargo()});
        if(cargo?.card?.id===rootCargoCard.id){
          const fossil=cargo.job.fossilId;
          const id=ready[0].actionId,spec=freeze({policy:resourceDemand.VERSION,isEquivalence:false,
            plans:[],retainedActionIds:[id],excludedActionIds:node.legalActions.filter(a=>a.actionId!==id).map(a=>a.actionId),
            fundedCargoJoin:{cardId:rootCargoCard.id,fossilId:fossil,incomeCardId:plans.find(p=>p.goal.kind==="income").goal.incomeCardId}});
          resourceSpecs.set(node,spec);return spec;
        }
      }
      const alternateIncome=incomePaymentAlternative(node,stored,state);
      const result=freeze({policy:resourceDemand.VERSION,isEquivalence:false,
        ...(alternateIncome?{alternateIncome}:{}),
        ...(adjacentCargo?.paid&&plans.some(p=>p.goal===adjacentCargo)?{cargoCommittedMovement:true}:{}),
        plans:compareFixedPurposes?plans:swapAction?[...supplyPlans,...plans.filter(p=>p.goal.analysisPreparation||p===dataCargo)]:forcedKind?plans.filter(p=>p.goal.kind===forcedKind||p.goal.kind==="blue-landing-supply"||p.goal.analysisPreparation||p===dataCargo):plans,
        ...(scoredCorner?{scoredCorner}:{}),...(deferredCappedTask?{deferredCappedTask}:{}),...(protectedIncome?{protectedIncome:protectedIncome.proof}:{}),
        ...(incomeTail?{incomeTail}:{}),...(blueTail?{fixedBlueTail:blueTail}:{}),...(blueTails.length?{blueTails}:{}),...(computerTail?{fixedComputerTail:computerTail}:{}),
        ...(swapAction?{fixedCompanySwap:{goal:competingSwap.goal,netGain:swapGain,replaces:forcedKind,replacesGain:forcedGain}}:{}),
        ...(sharedDataFunding?{sharedDataFunding}:{}),...(deferColumn?{deferredBlueColumn:true}:{}),
        ...(recoveredDataOrder?{recoveredDataOrder:{income:recoveredDataOrder.income,blue:recoveredDataOrder.blue.netGain,selected:forcedKind}}:{}),
        retainedActionIds:node.legalActions.filter(a=>a.actionId===alternateIncome?.actionId||(forcedKind&&!compareFixedPurposes?a===swapAction:!excluded.includes(a))).map(a=>a.actionId),excludedActionIds:(forcedKind&&!compareFixedPurposes?node.legalActions.filter(a=>a!==swapAction):excluded).filter(a=>a.actionId!==alternateIncome?.actionId).map(a=>a.actionId)});
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
        const step=spec?.fixed&&!["transport-data-prep","funded-earth-shipment","satellite-scan-setup","data-funded-cargo"].includes(plan.goal.kind)?{kind:"fixed",actionId:spec.selectedActionId,reason:"fixed-card-in-resource-plan"}
          :tail?.selectedActionId?{kind:"fixed",actionId:tail.selectedActionId,reason:tail.reason||tail.kind}:resourceStep(current,plan.goal,operation);
        if(step.kind==="complete"){
          if(nodes.get(current).resourceControl){const blocked=hasCapacity(prefixes.length,contexts+1,false,work({additionalStates:1}));if(blocked)return stop(blocked);current=resourceView(current,null);sharedStates.push(current);contexts++;}
          return finish({goalStatus:"completed"});
        }
        if(step.kind==="infeasible")return invalid(step.reason);
        if(plan.goal.kind==="funded-earth-shipment"&&prefixes.length>=12)throw Error("FUNDED_EARTH_SHIPMENT_PROGRESS_INVALID");
        if(plan.goal.kind==="satellite-scan-setup"&&prefixes.length>=14)throw Error("SATELLITE_SCAN_PROGRESS_INVALID");
        if(step.kind==="fallback"&&!forced)return bind(step.reason,operation);
        const id=forced||step.actionId,action=current.legalActions.find(a=>a.actionId===id);
        if(!action)throw new Error("RESOURCE_PLAN_ACTION_NOT_LEGAL");
        const chosen=step.kind==="fallback"?step.candidates?.find(c=>c.actionId===id)||{}:step;
        const key=expansionKey(nodes.get(current),id),shared=resourcePlanning?prefixEdges.get(key):null;
        const next=shared?.node||cache.get(key)||null;
        const blocked=hasCapacity(prefixes.length,contexts,true,work({nextNode:next,nextNewInput:shared?0:1,additionalStates:next?0:1}));if(blocked)return stop(blocked);
        preparations.push({input:prefixes.length,reason:step.reason,goalId:plan.goal.id,demand:resourceDemand.needs(readPlanningState(nodes.get(current)),seatId,plan.goal),actionId:id});
        // Discard identities belong to one native action, not the whole resource goal.
        operation={...operation,...(current.status==="stable"?{discardIds:null}:{}),...(chosen.discardIds?{discardIds:chosen.discardIds}:{}),...(chosen.placing!==undefined?{placing:chosen.placing}:{}),...(chosen.scanLaunchCompleted?{scanLaunchCompleted:true}:{}),...(chosen.cargoInput!==undefined?{cargoInput:chosen.cargoInput}:{}),...(chosen.finalPlacement!==undefined?{finalPlacement:chosen.finalPlacement}:{}),...(chosen.resourceBlueSlot!==undefined?{resourceBlueSlot:chosen.resourceBlueSlot}:{}),...(chosen.finalResourceBlue!==undefined?{finalResourceBlue:chosen.finalResourceBlue}:{}),...(step.kind==="start-target"?{targetStarted:true}:{})};
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

    // A bounded geometry query for an existing Earth shipment. The one
    // energy trade only pays one point; asteroid exits cannot use this plan.
    function shortEarthPath(state,owner,ship,from,earth,limit){
      const canMove=rockets.createStaticCoordinateMoveQuery(state.pieces,ship.id);
      const key=p=>p.x+":"+p.y,seen=new Set([key(from)]),queue=[{at:from,path:[]}];
      for(const {at,path} of queue){
        if(key(at)===key(earth))return path;
        if(path.length===limit||rocketAbilities.getRequiredMovePointsFromCoordinate(state,owner,at)!==1)continue;
        for(const d of rocketAbilities.MOVE_DIRECTIONS){
          const m=canMove(at,d.deltaX,d.deltaY);
          if(!m.ok||seen.has(key(m.to)))continue;
          seen.add(key(m.to));queue.push({at:m.to,path:[...path,{rocketId:ship.id,deltaX:d.deltaX,deltaY:d.deltaY}]});
        }
      }
      return null;
    }

    function directEarthShipment(node, stored) {
      if (node.status !== "stable" || stored.informationBarrier || rootObservation.publicState.roundNumber !== 4
        || !knownRootAlienIds.has("虫") || !node.legalActions.some(a => a.family === "move")) return null;
      const state = readPlanningState(stored), turn = state.turn, p = state.players.players.find(p => p.id === seatId);
      if (turn.currentPlayerId !== seatId || turn.gameEnded || p.mainActionCompleted || p.passCompletionPending
        || p.industryBorrowedTechTileId || turn.cardTurnEventBonuses?.length || p.resources.energy < 1
        || p.reservedCards.some(card => {
          const model = cardEffects.getCardModel(card);
          return !knownRootCardIds.has(card.id) || !model || model.triggers?.length || model.temporaryTasks?.length;
        })) return null;
      const jobs = Object.values(state.aliens.chong?.transportTasksByRocketId || {});
      if (jobs.length !== 1 || jobs[0].delivered) return null;
      const [job] = jobs, ship = visibleEarthCargo(state, p, job);
      if (!ship || ship.movementLocked) return null;
      const from = rockets.getRocketSectorCoordinate(ship);
      const earth = solar.collectPlanetLocations(state.solarSystem).find(planet => planet.planetId === "earth");
      const path = from && earth && shortEarthPath(state, p, ship, from, earth, Math.min(3, p.resources.energy));
      if (!path?.length) return null;
      const [first] = path;
      const action = node.legalActions.find(a => a.family === "move" && a.target.rocketId === ship.id
        && a.target.deltaX === first.deltaX && a.target.deltaY === first.deltaY && a.payload?.requiredMovePoints === 1);
      return action ? {action,quote:{kind:"funded-earth-shipment",directEnergy:true,path,cardId:job.cardId}} : null;
    }

    function knownEarthShipment(state,known){
      const t=state.turn,p=state.players.players.find(p=>p.id===seatId);
      if(t.roundNumber!==4||t.currentPlayerId!==seatId||t.gameEnded||p.passCompletionPending
        ||!t.activePlayerIds.includes(seatId)||t.passedPlayerIds.includes(seatId)
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||t.cardTurnEventBonuses?.length||p.industryBorrowedTechTileId
        ||industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId!=="deepspace_swap_cards"
        ||!knownRootAlienIds.has("虫")||[...p.hand,...p.reservedCards].some(c=>!known.has(c.id))
        ||state.pieces.rockets.some(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r)))return null;
      // A trade, play or arrival that wakes a card effect needs its own
      // Native policy. Do not treat that extra action as part of this proof.
      if(p.reservedCards.some(c=>{
        const model=cardEffects.getCardModel(c);
        return !model||model.triggers?.length||model.temporaryTasks?.length;
      }))return null;
      const jobs=Object.entries(state.aliens.chong?.transportTasksByRocketId||{});
      if(jobs.length!==1)return null;
      const [jobKey,job]=jobs[0],ship=visibleEarthCargo(state,p,job);
      if(!ship||job.delivered||ship.movementLocked)return null;
      const marks=Object.values(state.finalScoring.tiles).flatMap(tile=>tile.marks);
      if(state.finalScoring.thresholds.some(n=>!marks.some(m=>m.playerId===seatId&&m.threshold===n)))return null;
      const from=rockets.getRocketSectorCoordinate(ship),earth=solar.collectPlanetLocations(state.solarSystem).find(p=>p.planetId==="earth");
      return from&&earth?{p,job,jobKey,ship,from,earth}:null;
    }

    // Price exactly one fully funded delivery. Quote the known face only;
    // the replacement market card and any newly revealed facts are never used.
    function fundedEarthShipment(state,known){
      const v=knownEarthShipment(state,known);
      if(!v)return null;
      const {p,job,jobKey,ship,from,earth}=v,path=shortEarthPath(state,p,ship,from,earth,2);
      if(!path?.length)return null;
      const remaining=path.length,energy=p.resources.energy;
      let supplier=null,pick=null,supplierGain=0,discard=[];
      if(remaining>energy){
        if(!energy){
          if(p.mainActionCompleted)return null;
          const supply=c=>{
            if(!c||!known.has(c.id)||Object.keys(cardEffects.getCardPlayCost(c)).length)return 0;
            const model=cardEffects.getCardModel(c);
            if(model?.cardType!==0||model.reserveAfterPlay)return 0;
            const play=cardEffects.buildPlayEffects(c),condition=play[0]?.options?.condition,rewards=play[0]?.options?.rewards;
            const reward=rewards?.[0];
            const o=reward?.options;
            return play.length===1&&play[0].type==="card_conditional_reward"&&play[0].options.repeat===1&&rewards?.length===1&&condition?.type==="resourceEquals"
              &&condition.resource==="energy"&&condition.count===0&&reward.type==="card_count_rockets_reward"
              &&o.resource==="energy"&&o.owner==="current"&&o.location==="solar"&&o.per===1
              &&o.includeNonStandard===false&&o.includeTransportedChongFossils===true
              ?cardEffects.countRocketsForReward(state.pieces.rockets,p,o):0;
          };
          const own=p.hand.filter(supply);
          const pub=p.resources.publicity>=quickTrades.getTradeAction("publicity-for-card").cost.publicity
            ?state.cards.publicCards.filter(supply):[];
          if(own.length===1)supplier=own[0];
          else if(!own.length&&pub.length===1)supplier=pick=pub[0];
          if(!supplier)return null;
          supplierGain=supply(supplier);
        }
        if(remaining>energy+supplierGain){
          discard=p.hand.filter(c=>c!==supplier);
          if(discard.length!==2||remaining!==energy+supplierGain+quickTrades.getTradeAction("cards-for-energy").gain.energy)return null;
        }
      }
      const next=structuredClone(state),q=next.players.players.find(p=>p.id===seatId);
      if(pick)q.resources.publicity-=quickTrades.getTradeAction("publicity-for-card").cost.publicity;
      q.hand=q.hand.filter(c=>c.id!==supplier?.id&&!discard.some(d=>d.id===c.id));q.resources.handSize=q.hand.length;
      q.resources.energy+=supplierGain+Number(discard.length>0);
      for(const step of path){
        const m=rocketAbilities.moveProbe(next,{...step,movementPoints:1,cost:{energy:1},source:"quick_trade"});
        if(!m.ok)return null;
      }
      const arrivals=chong.listTransportArrivalEvents(next.aliens,next.pieces.rockets,id=>id==="earth"?earth:null,{source:"rocket-move"});
      if(arrivals.length!==1||arrivals[0].rocketId!==Number(jobKey))return null;
      if(!chong.markTransportedFossilDelivered(next.aliens,Number(jobKey),"earth").ok)return null;
      const cargo=localPlans.knownDeliveredCargo({state:next,seatId,knownCards:known,knownFossilIds:new Set([job.fossilId])});
      const applied=cargo&&localPlans.previewKnownCargoClaim({state:next,seatId,cargo});
      if(!applied)return null;
      const total=(s,p)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,cardEffects,
        finalScoring:structuredClone(s.finalScoring),aliens:structuredClone(s.aliens),
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},p).totalScore;
      const w=stateValue.DEFAULT_WEIGHTS,after=applied.player;
      const value=stateValue.sumValueParts([total(applied.state,after),-total(state,p),
        ...Object.entries(w).map(([key,weight])=>(after.resources[key]-p.resources[key])*weight)]);
      return value>0?{kind:"funded-earth-shipment",value,path,cardId:job.cardId,fossilId:job.fossilId,
        supplierId:supplier?.id,pickId:pick?.id,discardIds:discard.map(c=>c.id)}:null;
    }

    function fundedEarthShipmentStep(node,stored,state,session){
      const a=node.legalActions,source=session?.journal?.actions?.[0]?.action,tradeId=source?.target?.tradeId;
      if(node.status==="stable"){
        if(!a.some(x=>x.family==="quick_trade"&&["publicity-for-card","cards-for-energy","energy-for-move"].includes(x.target?.tradeId)
          ||x.family==="play_card"))return null;
      }else if(node.status!=="decision"||source?.family!=="quick_trade"||
        !["publicity-for-card","cards-for-energy","energy-for-move"].includes(tradeId))return null;
      const known=knownCards(stored.envelope);
      const anchor=session?.baseState?planningState(session.baseState,stored.informationBarrier,known):state||readPlanningState(stored);
      const quote=fundedEarthShipment(anchor,known);
      if(!quote)return null;
      const trade=id=>a.find(x=>x.family==="quick_trade"&&x.target?.tradeId===id);
      const first=quote.path[0];
      let action;
      if(node.status==="stable"){
        action=quote.pickId?trade("publicity-for-card"):quote.supplierId
          ?a.find(x=>x.family==="play_card"&&x.target?.cardInstanceId===quote.supplierId)
          :trade(quote.discardIds.length?"cards-for-energy":"energy-for-move");
      }else if(tradeId==="publicity-for-card"&&quote.pickId){
        action=a.find(x=>x.family==="choose_card"&&x.target?.cardInstanceId===quote.pickId);
      }else if(tradeId==="cards-for-energy"&&quote.discardIds.length===2&&!quote.supplierId){
        const selected=session.queue[0]?.payload?.decisionContext?.selected;
        if(!Array.isArray(selected)||selected.some(id=>!quote.discardIds.includes(id)))return null;
        action=selected.length===quote.discardIds.length?a.find(x=>x.family==="choose_payment"&&x.target?.confirm)
          :a.find(x=>x.family==="choose_payment"&&x.target?.select&&quote.discardIds.includes(x.target.cardInstanceId)
            &&!selected.includes(x.target.cardInstanceId));
      }else if(tradeId==="energy-for-move"&&!quote.supplierId&&!quote.discardIds.length){
        action=a.find(x=>x.family==="choose_target"&&x.target?.kind==="quick-move"&&x.target.rocketId===first.rocketId
          &&x.target.deltaX===first.deltaX&&x.target.deltaY===first.deltaY);
      }
      return action?{action,quote}:null;
    }

    // A scan can pay the last move of a known delivery. Offer exactly
    // that native direction alongside the existing ordinary-probe plan.
    function knownFreeScanDelivery(node,stored,state) {
      const head=stored.envelope.session?.session?.queue?.[0];
      if(node.status!=="decision"||stored.intent||state.turn.roundNumber!==4
        ||head?.type!==scienceSession.EFFECT_TYPES.SCAN_ACTION_4||head.ownerId!==seatId
        ||!knownRootAlienIds.has("虫"))return null;
      const tasks=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
      if(tasks.length!==1)return null;
      const task=tasks[0],owner=state.players.players.find(p=>p.id===seatId);
      const card=owner.reservedCards.find(c=>c.id===task.cardId&&knownRootCardIds.has(c.id));
      const ship=state.pieces.rockets.find(r=>r.playerId===seatId&&r.kind==="chong-fossil"&&r.fossilId===task.fossilId);
      if(!card||!ship||task.delivered||task.destinationPlanetId!=="earth"
        ||!rootObservation.publicState.board.rockets.some(r=>r.id===ship.id&&r.fossilId===ship.fossilId))return null;
      const fossil=state.aliens.chong.fossilsById?.[task.fossilId],job=chong.getCardTask(card);
      const reward=chong.getFossilReward(task.fossilId);
      if(!job||job.kind!=="transport"||job.destinationPlanetId!=="earth"||!reward||job.pickCard
        ||reward.pickCard||reward.pickAlienCard||reward.drawCards||fossil?.status!=="transported"||fossil.taskCompleted)return null;
      const at=rockets.getRocketSectorCoordinate(ship),dest=solar.collectPlanetLocations(state.solarSystem).find(p=>p.planetId==="earth");
      if(!at||!dest||at.x===dest.x&&at.y===dest.y)return null;
      const canMove=rockets.createStaticCoordinateMoveQuery(state.pieces,ship.id);
      const moves=node.legalActions.filter(a=>{
        if(a.family!=="choose_target"||a.target?.mode!=="move"||a.target.rocketId!==ship.id||a.payload?.requiredMovePoints!==1)return false;
        const next=canMove(at,a.target.deltaX,a.target.deltaY);
        return next.ok&&next.to.x===dest.x&&next.to.y===dest.y;
      });
      if(moves.length===1)return {actionId:moves[0].actionId,rocketId:ship.id,fossilId:task.fossilId,cardId:card.id};
      const known=knownCards(stored.envelope),shipment=knownEarthShipment(state,known);
      if(!shipment||shortEarthPath(state,owner,ship,at,dest,2))return null;
      for(const a of node.legalActions){
        if(a.target?.mode!=="move"||a.target.rocketId!==ship.id||a.payload?.requiredMovePoints!==1)continue;
        const step=canMove(at,a.target.deltaX,a.target.deltaY);
        if(!step.ok||!shortEarthPath(state,owner,ship,step.to,dest,2))continue;
        const next=structuredClone(state),q=next.players.players.find(p=>p.id===seatId);
        const m=rocketAbilities.moveProbe(next,{...a.target,movementPoints:1,cost:{},source:"scan"});
        if(!m.ok)continue;
        q.mainActionCompleted=false;
        const funded=fundedEarthShipment(next,known);
        if(funded)return {actionId:a.actionId,rocketId:ship.id,fossilId:task.fossilId,cardId:card.id,remaining:funded.path};
      }
      return null;
    }

    function stayForFreePickupLanding(node,stored,state) {
      const session=stored.envelope.session?.session,[move,land,pick]=session?.queue||[];
      const source=session?.journal.actions[0]?.action,card=source?.target?.cardInstanceId;
      if(node.status!=="decision"||session?.queue.length!==3||session.interruptContext
        ||state.turn.roundNumber!==3||source?.family!=="play_card"||source.actorId!==seatId||!knownRootAlienIds.has("虫")
        ||[move,land,pick].some(e=>e.ownerId!==seatId||e.payload?.cardInstanceId!==card)
        ||move.payload.cardEffect?.type!=="card_move"||move.payload.remaining!==1
        ||land.payload.cardEffect?.type!=="chong_land_for_pickup"||land.payload.cardEffect.options?.skipCost===false
        ||pick.payload.cardEffect?.type!=="chong_pickup_fossil")return null;
      const stop=node.legalActions.find(a=>a.target?.skip===true);
      const directions=node.legalActions.filter(goalMovement.isDirection);
      if(!stop||!directions.length||directions.length+1!==node.legalActions.length)return null;
      const owned=state.pieces.rockets.filter(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r));
      if(owned.length!==1||owned[0].fossilId)return null;
      const ship=owned[0],at=rockets.getRocketSectorCoordinate(ship);
      const planet=solar.resolveVisibleContent(at.x,at.y,state.solarSystem).content.planetId;
      if(!["jupiter","saturn"].includes(planet)||directions.some(a=>{
        const next=rockets.canMoveFromCoordinate(state.pieces,at,a.target.deltaX,a.target.deltaY,ship.id);
        if(!next.ok||a.target.rocketId!==ship.id)return true;
        return solar.resolveVisibleContent(next.to.x,next.to.y,state.solarSystem).content.kind==="planet";
      }))return null;
      const native=productionKernel||globalThis.SetiProductionKernel;
      if(!native.getProbeRouteRequirements(state,seatId,move).candidates.some(c=>
        c.rocketId===ship.id&&c.endpointFamily==="land"&&c.planetId===planet&&c.path.length===0))return null;
      return freeze({policy:"seti-current-free-pickup-landing-v1",isEquivalence:false,reason:"preserve-current-free-landing",
        selectedActionId:stop.actionId,retainedActionIds:[stop.actionId],excludedActionIds:directions.map(a=>a.actionId),
        excludedDirectionCount:directions.length,routingNodes:0});
    }

    function goalMovementSpec(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (movementPolicies.has(node)) return movementPolicies.get(node);
      const state = readPlanningState(stored);
      const stay=stayForFreePickupLanding(node,stored,state);
      if(stay){movementPolicies.set(node,stay);return stay;}
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
      const delivery=result&&knownFreeScanDelivery(node,stored,state);
      const frozen=result&&freeze(!delivery?result:{...result,
        knownFreeScanDelivery:delivery,
        retainedActionIds:[...new Set([...result.retainedActionIds,delivery.actionId])],
        excludedActionIds:result.excludedActionIds.filter(id=>id!==delivery.actionId),
        excludedDirectionCount:result.excludedDirectionCount-Number(result.excludedActionIds.includes(delivery.actionId))});
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
      const session=loadedEnvelope?.session?.session,head=session?.queue?.[0];
      // restoreEnvelope loaded this exact private checkpoint. The formal
      // submit port below still checks identity and enumerates native legality.
      const before=loadedEnvelope&&(session?.phase!=="awaiting_input"||head?.kind==="decision")
        ?{phase:session?.phase||"idle",session:session?{irreversibleBarrier:session.irreversibleBarrier,
          decision:head?.kind==="decision"?{decisionId:head.effectId,decisionVersion:session.revision,ownerId:head.ownerId}:null}:null}
        :comp.inspect(true);
      if (!current || current.actorId !== seatId) throw new Error("ANALYSIS_ACTION_STALE");
      loadedEnvelope = null;
      const executeAt = now();
      const result = before.phase === "awaiting_input"
        ? comp.inputPort.submitDecision({
          decisionId: before.session.decision.decisionId,
          decisionVersion: before.session.decision.decisionVersion,
          ownerId: before.session.decision.ownerId, choice: current,
        }, { skipProjection: true, omitTrustedResult: true })
        : current.phase === "quick" ? comp.inputPort.submitQuickAction(current, { skipProjection: true, omitTrustedResult: true })
          : comp.inputPort.submitAction(current, { skipProjection: true, omitTrustedResult: true });
      milliseconds.execute += now() - executeAt;
      if (!result?.ok) {
        const failure = result?.failure || result;
        throw new Error(`ANALYSIS_EXECUTION_FAILED: ${failure?.code || failure?.message || "unknown"}`);
      }
      submissionCount += 1;
      return { before, result };
    }

    // Root-only purpose: preserve a held data corner for a paid public pick
    // and known regional reward. A fixed company swap can fund its play.
    function retainedRegionCardSource() {
      if(openedRoot?.status!=="stable"||rootObservation.publicState.roundNumber!==3) return null;
      const end=openedRoot.legalActions.find(a=>a.family==="end_turn");
      const corners=openedRoot.legalActions.filter(a=>a.family==="card_corner"&&a.payload?.kind==="resource");
      const swap=openedRoot.legalActions.find(a=>a.family==="industry"&&a.target?.abilityId==="deepspace_swap_cards");
      if(!end||!corners.length||!knownRootAlienIds.has("阿米巴")||!knownRootAlienIds.has("虫"))return null;
      const root=nodes.get(openedRoot),state=readPlanningState(root),t=state.turn;
      const p=state.players.players.find(p=>p.id===seatId);
      if(!p.mainActionCompleted||p.passCompletionPending||!p.hand.length||p.hand.length>2
        ||p.hand.some(c=>!knownRootCardIds.has(c.id))
        ||t.cardTurnEventBonuses?.length||p.industryBorrowedTechTileId
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||localPlans.hasPendingFossilArrival(state)
        ||p.reservedCards.some(c=>{
          const model=cardEffects.getCardModel(c);
          return !knownRootCardIds.has(c.id)||!model||model.triggers?.length||model.temporaryTasks?.length;
        }))return null;
      const job=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
      if(job.length!==1||job[0].delivered||!visibleEarthCargo(state,p,job[0]))return null;
      const regionCards=p.hand.flatMap(c=>{
        const region=localPlans.blueCashCard(c),reward=cards.getDiscardActionRewardForCard(c);
        return region&&reward?.dataCount===1&&Object.keys(reward.gain).every(k=>k==="score")?[{c,region}]:[];
      });
      if(regionCards.length!==1||!state.cards.publicCards.some(c=>c&&knownRootCardIds.has(c.id)))return null;
      const {c:card,region}=regionCards[0],corner=corners.find(a=>a.target.cardInstanceId===card.id);
      if(!corner)return null;
      const next=previewTurn(state);
      if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
      const tasks=openedRoot.legalActions.filter(a=>a.family==="complete_task");
      if(tasks.length>1)return null;
      const claim=tasks[0],reserved=claim&&p.reservedCards.find(c=>c.id===claim.target?.cardInstanceId);
      const task=reserved&&cardEffects.getCardModel(reserved)?.tasks?.find(x=>x.id===claim.target.ruleId);
      const taskReward=task?.rewards?.length===1&&task.rewards[0],gain=taskReward?.options?.gain;
      if(claim&&(task?.condition?.type!=="orbitOrLandCount"||taskReward?.type!=="gain_resources"||(taskReward.options.repeat??1)!==1
        ||!Number.isSafeInteger(gain?.credits)||gain.credits<1||Object.keys(gain).some(k=>k!=="credits"&&k!=="score")))return null;
      const retained={firstId:claim?.actionId||end.actionId,claimId:claim?.actionId,claimGain:gain,cornerId:corner.actionId,cardId:card.id,region};
      if(p.hand.length===1&&corners.length===1&&!p.resources.availableData&&p.resources.credits>=1)return retained;
      // One known spare card, one fixed fourth-slot cash source, no other
      // data purchase or trade. The swap itself must not expose a refill.
      const count=data.listComputerPlacedTokens(p);
      const outgoing=p.hand.find(c=>c.id!==card.id),printed=outgoing&&cards.getDiscardActionRewardForCard(outgoing);
      if(!swap||!claim||p.resources.credits||p.resources.energy||!printed?.gain?.publicity||printed.dataCount
        ||Object.keys(printed.gain).length!==1||count.length<1||count.length>3
        ||count.some((x,i)=>x.placementSlot!==i+1)||p.resources.availableData!==4-count.length)return null;
      const income=state.cards.publicCards.find(c=>{
        const gain=c&&cards.getIncomeGainForCard(c);
        return c&&knownRootCardIds.has(c.id)&&gain?.credits===1&&Object.keys(gain).length===1;
      });
      return income?{...retained,firstId:swap.actionId,
        cash:{outgoingId:outgoing.id,incomeId:income.id,placements:4-count.length}}:null;
    }

    // One fixed Native witness after the closed graph, using the same card
    // picker. A public refill is masked; only a root-known symbol can follow.
    function quoteRetainedRegionCard(source, evaluate, admit) {
      const root=nodes.get(openedRoot),initial=readIdentityState(root.envelope),comp=fork.composition||fork;
      const previous=loadedEnvelope||root.envelope,firstCount=submissionCount;
      const owner=s=>s.players.players.find(p=>p.id===seatId);
      const limit=(source.claimId?5:4)+(source.cash?4+2*source.cash.placements:0),prefix=[];
      let e=root.envelope,barrier=null,recording=Boolean(source.cash);
      const input=a=>{
        if(!a||a.actorId!==seatId||submissionCount-firstCount>=limit||!admit(submissionCount-firstCount,submissionCount))return false;
        if(recording)prefix.push({envelope:e,actions:legalActions(comp),action:a});
        restoreEnvelope(e,true);
        const r=executeCurrent(a).result;
        if(r.irreversibleBarrier){
          if(!["choose_card","choose_target"].includes(a.family)||r.irreversibleBarrier.code!=="hidden_card_reveal"||barrier)return false;
          barrier=r.irreversibleBarrier;
        }
        e=snapshot(comp);return true;
      };
      const menu=()=>legalActions(comp);
      try{
        restoreEnvelope(e);
        if(source.cash){
          const {outgoingId,incomeId,placements}=source.cash;
          if(!input(menu().find(a=>a.actionId===source.firstId))||!e.session
            ||!input(menu().find(a=>a.family==="choose_card"&&a.target?.cardInstanceId===outgoingId))||!e.session
            ||!input(menu().find(a=>a.family==="choose_card"&&a.target?.cardInstanceId===incomeId))||e.session)return null;
          const swapped=owner(readIdentityState(e));
          if(swapped.hand.length!==2||![incomeId,source.cardId].every(id=>swapped.hand.some(c=>c.id===id)))return null;
          for(let i=0;i<placements;i++){
            if(!input(menu().find(a=>a.family==="place_data"))||!e.session
              ||!input(menu().find(a=>a.family==="choose_target"&&a.target?.target==="computer")))return null;
            if(Boolean(e.session)!==(i===placements-1))return null;
          }
          if(!input(menu().find(a=>a.family==="choose_card"&&a.target?.choiceId===`income:${incomeId}`))||e.session)return null;
          const ready=owner(readIdentityState(e)),old=owner(initial);
          if(ready.income.credits!==old.income.credits+1||ready.income.energy!==old.income.energy
            ||ready.resources.credits!==old.resources.credits+1||ready.resources.availableData
            ||ready.hand.length!==1||ready.hand[0].id!==source.cardId)return null;
        }
        if(source.claimId){
          const old=owner(readIdentityState(e));
          if(!input(menu().find(a=>a.actionId===source.claimId))||e.session)return null;
          const paid=owner(readIdentityState(e));
          if(!Object.keys(old.resources).every(k=>paid.resources[k]===old.resources[k]+(source.claimGain[k]||0)))return null;
        }
        const staged=readIdentityState(e),before=owner(staged);
        if(!input(menu().find(a=>a.family==="end_turn"))||e.session)return null;
        recording=false;
        const next=readIdentityState(e),p=owner(next);
        if(next.turn.roundNumber!==3||next.turn.turnNumber!==initial.turn.turnNumber+1
          ||next.turn.currentPlayerId!==seatId||p.mainActionCompleted||p.hand.length!==1||p.hand[0].id!==source.cardId
          ||Object.keys(before.resources).some(k=>before.resources[k]!==p.resources[k])
          ||next.cards.publicCards.some((c,i)=>c?.id!==staged.cards.publicCards[i]?.id))return null;
        if(!input(menu().find(a=>a.family==="play_card"&&a.target?.cardInstanceId===source.cardId))||!e.session)return null;
        const offers=menu(),pick=describeCardPick(e,offers,"decision",null);
        const choice=pick?.fixed&&offers.find(a=>a.actionId===pick.selectedActionId&&a.family==="choose_card"&&a.target?.source==="public");
        const card=choice&&next.cards.publicCards[choice.target.slotIndex];
        if(!card||!knownRootCardIds.has(card.id)||!input(choice)||!e.session)return null;
        const state=readIdentityState(e),original=aliens.amiba.listSymbolsInRegion(initial.aliens,source.region,{readOnlyRewards:true});
        const rewardOptions=menu().flatMap(a=>{
          const known=original.find(s=>s.slotId===a.target?.slotId&&s.symbolId===a.target?.symbolId);
          const r=known?.reward,g=r?.gain;
          return a.family==="choose_target"&&a.target?.region===source.region&&g
            &&Object.keys(g).every(k=>k==="score"||k==="publicity")&&!r.dataCount&&!r.drawCards&&!r.pickCard&&!r.pickAlienCard
            &&!initial.finalScoring.thresholds.some(n=>n>p.resources.score&&n<=p.resources.score+(g.score||0))
            ?[{a,g}]:[];
        });
        const pub=owner(state).resources.publicity,need=Math.max(0,techResolver.getResearchPublicityCost(p)-pub);
        const corner=cards.getDiscardActionRewardForCard(card)?.gain?.publicity||0;
        const priority=g=>Number(need>corner&&(g.publicity||0)>=need);
        const reward=rewardOptions.sort((a,b)=>priority(b.g)-priority(a.g)||(b.g.score||0)-(a.g.score||0)
          ||(b.g.publicity||0)-(a.g.publicity||0)||a.a.actionId.localeCompare(b.a.actionId))[0];
        if(!reward||!input(reward.a)||e.session||!barrier)return null;
        const after=readIdentityState(e),done=owner(after);
        if(after.turn.turnNumber!==next.turn.turnNumber||!done.mainActionCompleted
          ||after.cards.publicCards.some((c,i)=>i!==choice.target.slotIndex&&c?.id!==next.cards.publicCards[i]?.id)
          ||done.hand.length!==1||done.hand[0].id!==card.id
          ||done.resources.credits!==before.resources.credits-1
          ||done.resources.score!==before.resources.score+(reward.g.score||0)
          ||done.resources.publicity!==before.resources.publicity+(reward.g.publicity||0))return null;
        return {value:evaluate(observeEnvelope(e,barrier,true)),pickedCardId:card.id,symbolSlot:reward.a.target.slotId,cardId:source.cardId,
          ...(source.claimId?{claimId:source.claimId}:{}),
          ...(source.cash?{incomeCardId:source.cash.incomeId,prefix:prefix.map(({envelope,actions,action})=>({
            node:envelope===root.envelope?openedRoot:createNode(envelope,null,actions,envelope.session?"decision":"stable"),action,
          }))}:{})};
      }finally{restoreEnvelope(previous);}
    }

    function visibleFossilTransportSource() {
      if(openedRoot?.status!=="decision"||rootObservation.publicState.roundNumber!==3||!knownRootAlienIds.has("虫"))return null;
      const root=nodes.get(openedRoot),session=root.envelope.session?.session,head=session?.queue[0];
      if(root.informationBarrier||session?.queue.length!==1||session.failure||session.interruptContext
        ||head?.ownerId!==seatId||head.type!=="card_play_domain_effect:decision:chong_probe_planet_fossil_reward")return null;
      const s=session.workingState,t=s.turn,p=s.players.players.find(x=>x.id===seatId);
      if(t.currentPlayerId!==seatId||!p.mainActionCompleted||p.passCompletionPending||t.passedPlayerIds.includes(seatId)
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))||t.cardTurnEventBonuses?.length
        ||p.resources.energy||p.hand.length!==1||!knownRootCardIds.has(p.hand[0].id)
        ||Object.keys(s.aliens.chong?.transportTasksByRocketId||{}).length)return null;
      const [card]=p.hand,model=cardEffects.getCardModel(card),effects=model?.playEffects,cost=cardEffects.getCardPlayCost(card);
      if(effects?.length!==2||effects[0].type!=="chong_land_for_pickup"||effects[1].type!=="chong_pickup_fossil"
        ||Object.keys(cost).length!==1||!Number.isSafeInteger(cost.credits)||cost.credits<=p.resources.credits)return null;
      const offers=openedRoot.legalActions;
      const planetId=offers[0]?.target?.planetId;
      if(!planetId||offers.length<2||offers.some(a=>a.family!=="choose_target"||a.target?.planetId!==planetId
        ||!knownRootFossilIds.has(a.target?.fossilId)))return null;
      const cash=offers.filter(a=>{
        const r=chong.getFossilReward(a.target.fossilId);
        return r&&Object.keys(r.gain).length===1&&Number.isSafeInteger(r.gain.credits)
          &&p.resources.credits+r.gain.credits>=cost.credits
          &&!r.dataCount&&!r.drawCards&&!r.pickCard&&!r.pickAlienCard;
      });
      return cash.length===1?{action:cash[0],cardId:card.id,planetId,cost:cost.credits,turn:t.turnNumber}:null;
    }

    // One fixed paid landing, two visible score marks and the visible cargo.
    // No new display, hidden fossil, rotation, or arbitrary next-turn graph.
    function quoteVisibleFossilTransport(source,evaluate,admit) {
      const root=nodes.get(openedRoot),comp=fork.composition||fork,first=submissionCount,previous=loadedEnvelope||root.envelope;
      const owner=s=>s.players.players.find(x=>x.id===seatId),limit=8;
      let e=root.envelope;
      const menu=()=>legalActions(comp);
      const input=a=>{
        const inputs=submissionCount-first;
        if(!a||a.actorId!==seatId||inputs>=limit||!admit(inputs,submissionCount))return false;
        restoreEnvelope(e,true);
        const {result}=executeCurrent(a);
        if(ruleComposition.isHiddenInformationBarrier(result.irreversibleBarrier))return false;
        e=snapshot(comp);
        return !ruleComposition.isHiddenInformationBarrier(e.session?.session?.irreversibleBarrier);
      };
      try{
        restoreEnvelope(e);
        if(!input(source.action)||e.session||!input(menu().find(a=>a.family==="end_turn"))||e.session)return null;
        const next=readIdentityState(e),p=owner(next),t=next.turn;
        if(t.roundNumber!==3||t.turnNumber!==source.turn+1||t.currentPlayerId!==seatId||p.mainActionCompleted
          ||p.passCompletionPending||p.resources.credits<source.cost||p.hand.length!==1||p.hand[0].id!==source.cardId)return null;
        const native=productionKernel||globalThis.SetiProductionKernel;
        const destinations=native.getProbeRouteRequirements(next,seatId)?.candidates.filter(c=>{
          const rewards=c.endpointFacts.rewards;
          return !c.launchRequired&&!c.path.length&&c.endpointFamily==="land"&&c.planetId===source.planetId
            &&rewards.length===3&&rewards.filter(r=>r.type==="alien_trace"&&r.options.traceType===null).length===2
            &&rewards.some(r=>r.type==="gain_resources"&&Object.keys(r.options.gain).length===1&&r.options.gain.score>0);
        });
        if(destinations?.length!==1)return null;
        const [land]=destinations,target=land.endpointTarget;
        if(!input(menu().find(a=>a.family==="play_card"&&a.target?.cardInstanceId===source.cardId))
          ||!input(menu().find(a=>a.target?.actionType==="land"&&a.target.rocketId===land.rocketId
            &&a.target.planetId===land.planetId&&a.target.landTarget?.type===target.type
            &&a.target.landTarget?.satelliteId===target.satelliteId)))return null;
        const colors=new Set(),marks=[];
        for(let i=0;i<2;i++){
          const state=readIdentityState(e);
          const options=menu().flatMap(a=>{
            const k=a.target;
            if(a.family!=="choose_target"||k.speciesId!=="chong"||!["yellow","pink"].includes(k.traceType)
              ||k.stateExtra||colors.has(k.traceType))return [];
            const r=chong.getTraceReward(state.aliens,k.traceType,k.position);
            return r&&Object.keys(r.gain).length===1&&r.gain.score>0&&!r.dataCount&&!r.drawCards
              &&!r.pickCard&&!r.pickAlienCard&&!r.fossilPanel&&!r.chooseFossilRewardOnly?[{a,score:r.gain.score}]:[];
          });
          options.sort((a,b)=>b.score-a.score||a.a.actionId.localeCompare(b.a.actionId));
          const a=options[0]?.a;
          if(!input(a))return null;
          colors.add(a.target.traceType);marks.push(a.target.choiceId);
          const q=e.session?.session?.queue[0],choices=menu();
          if(choices.every(a=>a.family==="accept_optional_effect")&&choices.length){
            const trigger=choices.find(a=>a.target.ruleId==="amiba0-yellow-data"&&knownRootCardIds.has(a.target.cardInstanceId));
            if(choices.length!==2||q?.payload?.matches?.length!==1||!trigger||!input(trigger))return null;
          }
        }
        const fossils=menu(),fossilId=source.action.target.fossilId;
        if(!fossils.length||fossils.some(a=>!knownRootFossilIds.has(a.target?.fossilId))
          ||!input(fossils.find(a=>a.target.fossilId===fossilId))||e.session)return null;
        const after=readIdentityState(e),job=after.aliens.chong?.transportTasksByRocketId?.[land.rocketId];
        if(job?.fossilId!==fossilId||!owner(after).mainActionCompleted||after.turn.turnNumber!==t.turnNumber
          ||JSON.stringify(after.meta.rngState)!==JSON.stringify(next.meta.rngState))return null;
        return {value:evaluate(observeEnvelope(e,null,true)),actionId:source.action.actionId,
          fossilId,cardId:source.cardId,rocketId:land.rocketId,marks};
      }finally{restoreEnvelope(previous);}
    }

    // Spend the remaining decision budget on one already closed scan line.
    // The real current-turn graph and its fork checkpoints stay unchanged.
    function quoteScanBeforeOrbit(scanLeaf, orbitLeaf, goal, admit) {
      const root=nodes.get(openedRoot), scan=nodes.get(turnTailBase(scanLeaf)), orbit=nodes.get(turnTailBase(orbitLeaf));
      const state=readIdentityState(root.envelope),t=state.turn;
      const owner=s=>s.players.players.find(p=>p.id===seatId),p=owner(state);
      const ownShips=state.pieces.rockets.filter(r=>r.playerId===seatId&&(r.surface??"solar-board")==="solar-board");
      if(t.roundNumber!==4||t.currentPlayerId!==seatId||p.mainActionCompleted||p.hand.length
        ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||ownShips.length!==1||ownShips[0].id!==goal.rocketId||(ownShips[0].kind||"standard")!=="standard"
        ||goal.family!=="orbit"||goal.endpointTarget?.type!=="planet"||goal.movementPoints<1||goal.movementPoints>2
        ||orbit.informationBarrier||scan.informationBarrier&&scan.informationBarrier.code!=="hidden_card_reveal")return null;
      const trade=quickTrades.getTradeAction("credits-for-energy").cost.credits;
      const native=productionKernel||globalThis.SetiProductionKernel;
      const comp=fork.composition||fork,previous=loadedEnvelope||root.envelope,initialInputs=submissionCount;
      let e=previous,proof=null;
      const current=()=>readIdentityState(e);
      const ownerNow=()=>owner(current());
      const load=stored=>{e=stored.envelope;restoreEnvelope(e);};
      const ownTurn=n=>!e.session&&current().turn.roundNumber===4&&current().turn.currentPlayerId===seatId
        &&current().turn.turnNumber===t.turnNumber+n&&!ownerNow().mainActionCompleted;
      const knownCardAction=a=>!a.target?.cardInstanceId||knownRootCardIds.has(a.target.cardInstanceId);
      const input=(family,match=()=>true)=>{
        if(submissionCount-initialInputs>=16||!admit(submissionCount-initialInputs,submissionCount))return false;
        const a=legalActions(comp).find(x=>x.family===family&&x.actorId===seatId&&match(x));
        if(!a||!knownCardAction(a)||a.target?.source==="blind"||a.target?.cardIds?.some(id=>!knownRootCardIds.has(id)))return false;
        restoreEnvelope(e,true);
        executeCurrent(a);
        e=snapshot(comp);
        const s=current(),actor=owner(s);
        // Native serialization drops the fork marker without advancing its RNG.
        const rng=s.meta.rngState, initialRng=state.meta.rngState;
        return rng?.algorithm===initialRng?.algorithm&&rng?.state===initialRng?.state
          &&!actor.hand.length&&[...actor.reservedCards,...(actor.privateAlienCards||[])].every(c=>knownRootCardIds.has(c.id));
      };
      try {
        load(orbit);
        if(!input("end_turn")||!ownTurn(1))return null;
        const direct=ownerNow(),cost=scanEffects.getStandardScanCost(direct);
        const short=cost.credits+trade*Math.max(0,cost.energy-direct.resources.energy)-direct.resources.credits;
        if(short<=0||direct.resources.availableData||direct.hand.length)return null;

        load(scan);
        if(!input("end_turn")||!ownTurn(1))return null;
        const scanned=ownerNow().resources;
        const route=native.getProbeRouteRequirements(planningState(current(),scan.informationBarrier,knownRootCardIds),seatId)
          .candidates.find(x=>x.requirementId===goal.id);
        if(!route||route.path.length>2||route.required.movementPoints>=goal.movementPoints
          ||route.endpointFacts.cost.energy!==goal.endpointCost.energy||route.endpointFacts.cost.credits!==goal.endpointCost.credits)return null;
        const trades=Math.max(0,route.required.energy-scanned.energy);
        if(trades>2||scanned.credits<route.required.credits+trade*trades)return null;
        for(let i=0;i<trades;i++)if(!input("quick_trade",a=>a.target.tradeId==="credits-for-energy"))return null;
        for(const step of route.path){
          if(!input("move",a=>a.target.rocketId===goal.rocketId&&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY)
            ||!input("choose_payment",a=>a.target.choiceId==="energy"))return null;
        }
        if(!input("orbit",a=>a.target.rocketId===goal.rocketId&&a.target.planetId===goal.planetId)||e.session)return null;
        const tasks=legalActions(comp).filter(a=>a.family==="complete_task"&&a.actorId===seatId&&knownRootCardIds.has(a.target?.cardInstanceId));
        if(tasks.length!==1||!input("complete_task",a=>a.actionId===tasks[0].actionId)||e.session
          ||!input("end_turn")||!ownTurn(2)||!input("research_tech"))return null;
        const tiles=legalActions(comp).filter(a=>{
          const stack=current().tech.stacks[a.target?.tileId],initial=state.tech.stacks[a.target?.tileId];
          return a.family==="choose_target"&&a.actorId===seatId&&a.target?.blueSlot
            &&stack&&!stack.bonusHidden&&!initial?.bonusHidden&&stack.bonusId==="bonus_1p"
            &&initial?.bonusId===stack.bonusId&&knownRootTechIndices.get(a.target.tileId)===stack.bonusIndex;
        });
        if(new Set(tiles.map(a=>a.target.tileId)).size!==1)return null;
        const tile=tiles.sort((a,b)=>a.target.blueSlot-b.target.blueSlot)[0];
        if(!input("choose_target",a=>a.actionId===tile.actionId))return null;
        if(e.session){
          const choices=legalActions(comp).filter(a=>a.family==="accept_optional_effect"&&a.target?.ruleId&&knownRootCardIds.has(a.target?.cardInstanceId));
          if(choices.length!==1||!input("accept_optional_effect",a=>a.actionId===choices[0].actionId)||e.session)return null;
        }
        if(!input("end_turn")||!ownTurn(3)||!input("pass")||e.session||!current().turn.gameEnded)return null;
        const score=project(comp,true).publicState.players.find(v=>v.playerId===seatId).finalScore;
        proof={score,orbitGoalId:goal.id,tileId:tile.target.tileId,firstOrbitScanCashShort:short};
      } finally {
        restoreEnvelope(previous);
        // Declined quotes still spent real inputs. Search accounts for them
        // via the port counter even on an early return.
      }
      return proof;
    }

    function isKnownSatelliteScanAfterBlindDraw(envelope,barrier) {
      if(!resourcePlanning||barrier?.code!=="hidden_alien_card"||!barrier.effectId)return false;
      const session=envelope.session?.session,head=session?.queue?.[0],opts=head?.payload?.options;
      if(head?.type!==scienceSession.EFFECT_TYPES.SCAN_STEP||head.ownerId!==seatId
        ||head.kind!=="decision"||head.groupKind!=="spawned"||head.allowQuickActions||session.interruptContext
        ||opts?.mode!=="specified"||opts.sectorX!==null||opts.gainData!==true
        ||!Array.isArray(opts.nebulaIds)||!opts.nebulaIds.length||opts.nebulaIds.length>2
        ||opts.nebulaIds.some(id=>!knownRootNebulaIds.has(id))
        ||Object.keys(opts).some(k=>!["mode","sectorX","nebulaIds","gainData","label"].includes(k)))return false;
      const state=session.workingState,turn=state.turn,owner=state.players.players.find(p=>p.id===seatId);
      if(turn.roundNumber!==4||turn.gameEnded||turn.currentPlayerId!==seatId||!owner.mainActionCompleted
        ||owner.passCompletionPending||turn.passedPlayerIds.includes(seatId)
        ||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
        ||[...owner.reservedCards,...(owner.privateAlienCards||[])].some(c=>!knownCards(envelope).has(c.id)))return false;
      // The blind reward adds an anonymous hand card, not a new reserved
      // trigger. Continue only the public, card-free steps of that landing.
      const replay=session.journal.replay,draw=replay.findIndex(e=>e.kind==="decision"&&e.decisionId===barrier.effectId
        &&e.ownerId===seatId&&e.choice?.family==="choose_card"&&e.choice.target?.choiceId==="chong:blind");
      const ordinary=session.journal.actions[0]?.action?.family==="land";
      return draw>0&&replay.slice(0,draw).some(e=>e.kind==="decision"&&e.ownerId===seatId
        &&e.choice?.target?.landTarget?.type==="satellite"&&(ordinary||e.choice.target.actionType==="land"));
    }

    function knownRewardChoices(envelope,actions,anonymousSatelliteScan=false) {
      const session=envelope.session?.session,head=session?.queue?.[0],state=readIdentityState(envelope);
      const owner=state.players.players.find(p=>p.id===seatId);
      if(head?.ownerId!==seatId)return [];
      if(anonymousSatelliteScan){
        return actions.length&&actions.every(a=>a.actorId===seatId&&a.family==="choose_target"
          &&!a.target?.cardInstanceId&&head.payload.options.nebulaIds.includes(a.target?.nebulaId)
          &&a.payload?.gainData===true)?actions:[];
      }
      if([...owner.hand,...owner.reservedCards].some(c=>!knownCards(envelope).has(c.id)))return [];
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

    function finishChild(before, result, intent = null, resourceControl = null, carriedBarrier = null, sourceAction = null, source = null, prepared = null) {
      const comp = fork.composition || fork;
      const inspection = prepared?.inspection || comp.inspect();
      const nativeBarrier = result.irreversibleBarrier || inspection.session?.irreversibleBarrier;
      const envelope = prepared?.envelope || snapshot(comp);
      const head = envelope.session?.session?.queue?.[0], effect = head?.payload?.cardEffect;
      // The landing resolves before Native presents the destination's
      // previously hidden fossils. Search may value the settled landing,
      // but cannot select from the newly disclosed IDs.
      const thirdRoundPeek=rootObservation.publicState.roundNumber===3&&effect?.type==="chong_probe_planet_fossil_reward";
      const fossilReveal = head?.ownerId===seatId && (effect?.type==="chong_pickup_fossil"||thirdRoundPeek)
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
      if (!prepared) loadedEnvelope = envelope;
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
      if (newBarrier && cardPickPlanning
        && JSON.stringify([childState.turn.roundNumber,childState.turn.turnNumber,childState.turn.actionCycleNumber])===rootTurnKey) {
        const satelliteScan=inspection.phase==="awaiting_input"&&isKnownSatelliteScanAfterBlindDraw(envelope,barrier);
        const known=knownAlienAcquisition||["tech_bonus_reveal","hidden_card_reveal","hidden_card_draw"].includes(barrier.code);
        if(known||satelliteScan){
          const nativeActions=legalActions(comp,inspection);
          if(known)postMainActions=knownPostMainActions(envelope,nativeActions);
          if(inspection.phase==="awaiting_input")knownRewardActions=knownRewardChoices(envelope,nativeActions,satelliteScan);
        }
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
        if (prepared) restoreEnvelope(envelope);
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
      if (resourcePlanning && status === "decision" && source && !source.envelope.session && !source.intent && !source.resourceControl
        && sourceAction?.family === "complete_task" && sourceAction.target?.ruleId === "trace"
        && head?.type === "residual_chong_task_fossil" && child.legalActions.length) {
        const leaves = child.legalActions.map(a => chongTaskPeekBoundary(child, a.actionId));
        if (leaves.every(leaf => leaf && leaf === leaves[0])) {
          const key = chongClaimKey(source, sourceAction.target.cardInstanceId);
          if (!chongDirectClaims.has(key) && chongDirectClaims.size >= 64)
            chongDirectClaims.delete(chongDirectClaims.keys().next().value);
          chongDirectClaims.set(key, leaves[0]);
        }
      }
      if(status==="stable"&&!newBarrier&&!turnChanged&&sourceAction?.family==="choose_target"
        &&source?.envelope.session?.session?.journal?.actions?.[0]?.action?.family==="analyze")resolvedPublicAnalysis.add(child);
      return child;
    }

    function knownPostdrawDataView(envelope,inspection,barrier,intent,resourceControl){
      // Newly held identities do not affect a fixed plan paid entirely with
      // existing pool data. Materialize its Native inputs when competing
      // columns prevent the compound scalar proof; never execute the new card.
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||intent||resourceControl
        ||!["hidden_card_draw","hidden_card_reveal"].includes(barrier?.code))return null;
      const state=readIdentityState(envelope),owner=state.players.players.find(p=>p.id===seatId);
      const known=knownCards(envelope);
      // A Native acquisition can establish one public display even when
      // the company's swap remains available. Its replacement and the
      // simultaneous blind draw remain opaque. Below we still reject any
      // competing card or movement purpose and require a fixed data tail.
      const visibleDisplayTail=state.turn.roundNumber===3&&cardKnowledgeKey(envelope)
        &&owner.hand.some(c=>c.amibaCard===true&&!knownRootCardIds.has(c.id)&&known.has(c.id))
        &&owner.hand.filter(c=>!known.has(c.id)).length===1;
      if(industryCatalog.getPlayerIndustryDefinition(owner)?.activeAbilityId!=="deepspace_swap_cards"
        ||owner.industryRoundMarkRound!==state.turn.roundNumber&&!visibleDisplayTail
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
      const neutral = withEnvelopeSession(envelope,{ ...envelope.session, session: { ...session,
        queue: [{ ...head, payload: { ...head.payload, choices: [],
          decisionContext: { ...head.payload.decisionContext, selected: [] } } }, ...session.queue.slice(1)],
      } });
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

    function reusePlan(node, token, modelKey, requiredGoal = null) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      const saved = token && planCertificate?.token === token ? planCertificate : null;
      if (!saved) return { hit: false, reason: "unknown-evidence" };
      if (saved.modelKey !== modelKey) return { hit: false, reason: "model-changed" };
      const actions=actionSetKey(node.legalActions);
      let row = saved.rows.find(entry => (!requiredGoal||entry.committedGoal===requiredGoal) && entry.key === (entry.committedGoal?policyPhysicalKey(stored):policyDependencyKey(stored)) && entry.actions === actions);
      // Between native movement sessions a cold root has no pending session
      // from which to recover the selected route. Restore the saved policy
      // only after exact physical/RNG, menu, turn, position and model matching.
      if(!row&&!requiredGoal&&movementPlanning){
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
          stored.identity=nodeIdentity(stored.physicalId,stored.intent,stored.cardControl,stored.resourceControl,cardKnowledgeKey(stored.envelope));
          movementPolicies.delete(node);movementValueBounds.delete(node);turnTailSpecs.delete(node);turnTailNodes.delete(node);resourceSpecs.delete(node);movementIntentRecoveries++;
          if(!stored.intent.path.length)completedMovementRecoveries++;
        }
      }
      if (!row) return { hit: false, reason: "dependencies-changed" };
      const income=resourcePlanning&&node.status==="decision"
        &&stored.envelope?.session?.session?.queue[0]?.type===scienceSession.EFFECT_TYPES.INCOME
        &&incomePaymentAlternative(node,stored,readPlanningState(stored));
      // The original preparation proved the data placement, not both
      // uses of the resulting currency. Reprice only this ready menu.
      if(income&&row.actionId!==income.actionId&&row.roots.some(r=>r.actionId===income.actionId&&r.value==null))
        return {hit:false,reason:"fixed-income-prefix-competing-payment"};
      if(node.status==="stable"&&row.actionId.startsWith("card_corner:")
        &&cardPickSpec(node)?.companySwap?.reason==="compare-funded-fourth-slot-energy")
        return {hit:false,reason:"fixed-corner-prefix-competing-income-swap"};
      // A fixed Blue 3 prefix proves its own continuation, not the alternate
      // use of the last data token for a now-ready electricity income.
      const fixedBlue=row.roots.find(r=>r.actionId===row.actionId&&r.goalId==="data:blue:2"
        &&r.completion==="committed-goal-plan-execution");
      if(fixedBlue&&node.status==="decision"){
        const session=stored.envelope.session?.session,state=session?.workingState,t=state?.turn;
        const other=node.legalActions.find(a=>a.family==="choose_target"&&a.target?.choiceId==="data:computer");
        if(t?.roundNumber===3&&t.currentPlayerId===seatId&&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
          &&session.queue.length===1&&session.queue[0].type===scienceSession.EFFECT_TYPES.PLACE_DATA
          &&other&&row.roots.some(r=>r.actionId===other.actionId&&r.valueType==="not-executed")){
          const owner=state.players.players.find(p=>p.id===seatId),card=owner.hand[0],gain=card&&cards.getIncomeGainForCard(card);
          if(owner.mainActionCompleted&&owner.resources.availableData===1&&owner.hand.length===1&&gain?.energy===1
            &&Object.keys(gain).length===1&&knownCards(stored.envelope).has(card.id)
            &&data.listComputerPlacedTokens(owner).map(p=>p.placementSlot).join(",")==="1,2,3")
            return {hit:false,reason:"fixed-blue-prefix-competing-income"};
        }
      }
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
      // turn_end replays historical events. The read-only check already
      // normalizes stale consumption records just like Native collection.
      if((state.turn.type1TriggerEvents||[]).some(event=>cardEffects.hasMatchingTrigger(owner,event)))return false;
      const unreachableEvents = new Set(["launch", "orbit", "land", "researchTech", "signalMarked", "playCard"]);
      if(allowAmiba)unreachableEvents.add("alienTrace");
      if (!hasOwnRockets) for (const type of ["move", "visitPlanet", "visitAsteroid", "visitComet"]) unreachableEvents.add(type);
      return owner.reservedCards.every(card => {
        const model = cardEffects.getCardModel(card), scoring = model.endGameScoring;
        // Only the container can be assigned by normalization; the arrays
        // are read below and are never consumed by this proof.
        const effectState=cardEffects.ensureCardEffectState({...card,cardEffectState:card.cardEffectState&&{...card.cardEffectState}});
        if (scoring && !["sectorWinsByColor", "traceCount", "techCount", "distinctSignalSectors", "planetOrbitOrLand",
          "unmarkedFinalRightmost", "planetLandingPairs", "allOrbitOrLand"].includes(scoring.kind)
          || model.tasks != null && !Array.isArray(model.tasks)) return false;
        if ((model.triggers || []).some(trigger => !effectState.consumedTriggerIds.includes(trigger.id)
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
            || effectState.completedTaskIds.includes(task.id)
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
    function quietBluePublicPick({state,owner,node,stored,plan,transition,deferredTask,firstFamily="place_data",paidDrawCount=null,quoteAfterPick=null,finalRoundQuiet=false,blue3=false,foreignFive=false}) {
      const hasProbe=hasOwnVisitSource(state);
      const noMovementAllowance=p=>p.resources.energy===0&&p.hand.every(c=>!c.hidden&&!cards.getDiscardActionMoveRewardForCard(c)?.movementPoints);
      const singleIncomeWindow=owner.resources.availableData===2&&data.listComputerPlacedTokens(owner).length===3
        &&(!hasProbe||owner.resources.credits===0&&owner.resources.energy===0);
      if(hasProbe&&(!movementPlanning||!finalRoundQuiet&&!noMovementAllowance(owner)||deferredTask&&!deferredTask.requiresIncome&&!deferredTask.stationaryCapped))return null;
      const boundRoute=foreignFive&&stored.intent?.path.length===0&&goalMovementSpec(node)?.reason==="objective-reached";
      const stationary=current=>{
        const p=current.players.players.find(q=>q.id===seatId);
        if(boundRoute||noMovementAllowance(p))return true;
        if(!finalRoundQuiet&&!singleIncomeWindow&&paidDrawCount==null)return false;
        const objective=goalMovement.plan({state:current,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          compareTiming:timingForOneGoalQuery(current),endpoints:()=>(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(current,seatId)?.candidates||[]});
        goalMovementGeometryNodes+=objective?.routingNodes||0;
        return !objective?.intent?.path.length;
      };
      const anotherSeat=state.turn.activePlayerIds.some(id=>id!==seatId&&!state.turn.passedPlayerIds.includes(id));
      if(stored.intent&&!boundRoute||stored.resourceControl||state.turn.roundNumber!==(finalRoundQuiet?4:3)
        ||(foreignFive?transition.nextPlayerId===seatId||!anotherSeat:transition.nextPlayerId!==seatId||anotherSeat)
        ||rootPublicLandingOffer
        ||!(blue3?[1,2,3,4,5,6]:finalRoundQuiet?[1,2,3]:[1,2]).includes(owner.resources.availableData)
        ||plan.goal.id!==(blue3?"data:blue:3":"data:blue:2")||plan.goal.blueSlot!==(blue3?3:2)
        ||!data.listComputerPlacedTokens(owner).some(t=>t.placementSlot===data.getRequiredComputerSlotForBlueBonus(plan.goal.blueSlot))
        ||!state.cards.publicCards.some(Boolean)||state.cards.publicCards.some(c=>c&&!knownCards(stored.envelope).has(c.id))
        ||!node.legalActions.some(a=>a.family===firstFamily&&a.actionId===plan.firstActionId))return null;
      const p={...owner,resources:{...owner.resources},dataState:structuredClone(owner.dataState),hand:[...owner.hand]};
      const placed=data.placeDataToComputer(p,{target:data.PLACEMENT_KIND_BLUE_BONUS,blueSlot:plan.goal.blueSlot});
      if(!placed.ok||placed.slotBonuses.length!==1||placed.slotBonuses[0].type!=="choose_card")return null;
      const working={...state,players:{...state.players,players:state.players.players.map(x=>x===owner?p:x)}};
      const actions=scienceSession.formalizeChoices(working,seatId,scienceSession.listPickCardChoices(working));
      const menu=cardPickPlanner.plan({state:working,seatId,status:"decision",actions});
      const choice=actions.find(a=>a.actionId===menu?.selectedActionId),index=choice?.target.publicSlotIndex;
      if(!Number.isInteger(index)||menu.selection.blind)return null;
      const card=state.cards.publicCards[index],drawCount=state.cards.drawPileCardIds.length;
      if(foreignFive&&cardEffects.hasMatchingTrigger(owner,{type:"place_data_pick_card",playerId:seatId,cardInstanceId:card.id}))return null;
      if(!drawCount||(paidDrawCount==null?cards.getAvailablePool({...state.cards},state.players).length!==drawCount
        :drawCount!==paidDrawCount||state.cards.drawPileCardIds.some(Boolean)))return null;
      p.hand.push({...card,blueBonusOwnerId:seatId});p.resources.handSize=p.hand.length;
      // A retained known data supplier is safe only when the normal
      // completion query below confirms it opens no additional plan.
      if(p.hand.some(c=>c.hidden)||!finalRoundQuiet&&cards.getDiscardActionRewardForCard(card)?.dataCount>0
        ||hasProbe&&!singleIncomeWindow&&!stationary(working))return null;
      // The shared movement tool has no forecast in the final round.
      const debt=finalRoundQuiet?()=>0:(s,v)=>{const tool=resourceDemand.movementToolPlan(s,v);return tool.value>0?tool.selected.preparationDebt:0;};
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
      if(foreignFive&&completion.plans?.length){
        const reward=data.getBlueBonusPlacementReward(p,3);
        if(!nextPlan||nextPlan.goal.id!=="data:blue:3"||reward?.type!=="credits"||reward.credits!==1
          ||Object.keys(reward).some(k=>k!=="type"&&k!=="credits")
          ||nextPlan.requiredNativeInputs!==2||nextPlan.immediateScoreGain!==0||nextPlan.dataCornerIds?.length
          ||cardEffects.hasMatchingTrigger(p,{type:"placeData",playerId:seatId,placementKind:"blueBonus",blueSlot:3})
          ||cardEffects.hasMatchingTrigger(p,{type:"science_resource_bonus",playerId:seatId,gain:{credits:reward.credits},sourceKey:"blueTechScore"}))return null;
      }
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

    function quietR4ComputerFiveBlue({state,owner,node,stored,plan,transition}){
      const placements=data.listComputerPlacedTokens(owner).map(t=>t.placementSlot).sort((a,b)=>a-b);
      if(stored.resourceControl||transition.nextPlayerId===seatId
        ||goalMovementSpec(node)?.reason!=="objective-reached"
        ||placements.length!==5||placements.some((slot,i)=>slot!==i+1)
        ||data.getBlueBonusPlacementReward(owner,2)?.type!=="choose_card"
        ||Object.values(state.aliens.chong?.transportTasksByRocketId||{}).some(job=>!job.delivered)
        ||!hasPostMainInertReservations(state,false,true,true)
        ||cardEffects.hasMatchingTrigger(owner,{type:"placeData",playerId:seatId,placementKind:"blueBonus",blueSlot:2}))return null;
      const end=turnTailSummary(node,"end-turn");
      if(!end||end.netGain!==0||end.requiredNativeInputs!==1||end.markedTiles.length||end.deferredPublicity)return null;
      const result=quietBluePublicPick({state,owner,node,stored,plan,transition,finalRoundQuiet:true,foreignFive:true});
      return result&&{...result,computerFiveForeignBlue:true};
    }

    function quietR4Blue3Pick({state,owner,node,stored,plan,transition}){
      const goal=plan.goal;
      if(goal.id!=="data:blue:3"||data.getBlueBonusPlacementReward(owner,3)?.type!=="choose_card"
        ||owner.hand.some(c=>{const reward=cards.getDiscardActionRewardForCard(c);
          return reward?.dataCount===1&&reward.gain?.score===1;})
        ||cardEffects.hasMatchingTrigger(owner,{type:"placeData",playerId:seatId,placementKind:"blueBonus",blueSlot:3}))return null;
      const placed=data.listComputerPlacedTokens(owner).length;
      if(placed>=5){
        const pick=quietBluePublicPick({state,owner,node,stored,plan,transition,finalRoundQuiet:true,blue3:true});
        return pick&&{...pick,blue3PublicProof:true};
      }
      if(placed!==4||owner.resources.availableData<2||!quietTailHasNoAcquisition(state)
        ||cardEffects.hasMatchingTrigger(owner,{type:"placeData",playerId:seatId,placementKind:"computer",placementSlot:5}))return null;
      const p={...owner,resources:{...owner.resources},dataState:structuredClone(owner.dataState),hand:[...owner.hand]};
      const fill=data.placeDataToComputer(p);
      if(!fill.ok||fill.placementSlot!==5||fill.slotBonuses.length)return null;
      const next={...state,players:{...state.players,players:state.players.players.map(q=>q===owner?p:q)}};
      if(!quietTailHasNoAcquisition(next))return null;
      const native=productionKernel||globalThis.SetiProductionKernel;
      const objective=goalMovement.plan({state:next,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
        endpoints:()=>native.getProbeRouteRequirements(next,seatId)?.candidates||[],compareTiming:timingForOneGoalQuery(next)});
      goalMovementGeometryNodes+=objective?.routingNodes||0;
      if(objective?.intent?.path.length)return null;
      const pick=quietBluePublicPick({state:next,owner:p,node,stored,plan,transition,finalRoundQuiet:true,blue3:true});
      if(!pick)return null;
      const value=(s,p)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
        aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},p).totalScore;
      const delta=stateValue.sumValueParts([resourceDemand.planningCapital(next,p),-resourceDemand.planningCapital(state,owner)]);
      return {...pick,netGain:stateValue.sumValueParts([pick.netGain,delta,value(next,p),-value(state,owner),-stateValue.DEFAULT_WEIGHTS.availableData]),
        requiredNativeInputs:pick.requiredNativeInputs+2,
        unrealizedPurposeDelta:stateValue.sumValueParts([pick.unrealizedPurposeDelta,delta]),
        blue3PublicProof:true,bluePublicPick:{...pick.bluePublicPick,fundedComputerPlacement:5}};
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
      const chongOffer=rootObservation.publicState.board.aliens.chongOffer;
      const useChong=owner.hand.length===4&&Number.isSafeInteger(chongOffer?.displayedCardIndex);
      if(stored.informationBarrier?.code!=='tech_bonus_reveal'||owner.hand.length!==3&&!useChong
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
      if(useChong)return localPlans.quoteFundedChongSector({state:charged,seatId,knownCards:knownRootCardIds,offer:chongOffer});
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

    function quietCargoEndQuote(state,owner,cargo,sourceCapital=null){
      const applied=localPlans.previewKnownCargoClaim({state,seatId,cargo});
      if(!applied)return null;
      const debt=(s,p)=>{const m=resourceDemand.movementToolPlan(s,p);return m.value>0?m.selected.preparationDebt:0;};
      const score=(s,p)=>endScoring.computePlayerFinalScore({...s,players:s.players.players,
        aliens:structuredClone(s.aliens),finalScoring:structuredClone(s.finalScoring),cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},p).totalScore;
      const after=applied.state,p=applied.player;
      if(debt(state,owner)!==debt(after,p))return null;
      const afterCapital=resourceDemand.planningCapital(after,p);
      const capital=stateValue.sumValueParts([afterCapital,-(sourceCapital??resourceDemand.planningCapital(state,owner))]);
      const weights=stateValue.DEFAULT_WEIGHTS;
      const gain=stateValue.sumValueParts([score(after,p),-score(state,owner),capital,
        applied.credits*weights.credits,applied.dataGain*weights.availableData]);
      return {claim:gain>0||gain===0&&capital<0,gain,capital,after,afterCapital};
    }

    function quietR4CargoBlue3({state,owner,node,stored,plan,cargo,transition}){
      if(stored.intent||stored.resourceControl||transition.nextPlayerId!==seatId
        ||plan?.goal.id!=="data:blue:3"||data.getBlueBonusPlacementReward(owner,3)?.type!=="publicity"
        ||owner.resources.availableData<4||!quietTailHasNoAcquisition(state))return null;
      const observed=e=>cardEffects.hasMatchingTrigger(owner,{type:"placeData",playerId:seatId,...e});
      if(observed({placementKind:"blueBonus",blueSlot:3}))return null;
      const prep=localPlans.previewBlueCompletion({state,seatId,goal:plan.goal});
      if(!prep.available||prep.incomeCardId||prep.dataCornerIds.length||prep.computerPlacements>1||prep.immediateScoreGain
        ||prep.computerPlacements&&observed({placementKind:"computer",placementSlot:5}))return null;
      const p=prep.player,after={...state,players:{...state.players,players:state.players.players.map(v=>v===owner?p:v)}};
      const end=localPlans.quietEndCompletion({state:after,seatId});
      if(!end.available||end.netGain||end.markedTiles.length)return null;
      const quote=quietCargoEndQuote(after,p,cargo);
      if(!quote)return null;
      const noPlan=preview=>{
        if(!quietTailHasNoAcquisition(preview)||blueLandingGoalFor(preview))return false;
        if(resourceCatalog(preview,[]).some(goal=>{
          if(goal.kind!=="computer-prefix")return true;
          const completion=localPlans.computerCompletion({state:preview,seatId,goal});
          return completion.available&&completion.selected;
        }))return false;
        const native=productionKernel||globalThis.SetiProductionKernel;
        const objective=goalMovement.plan({state:preview,seatId,actions:[],status:"stable",objectiveOnly:true,routeCache:movementRouteCache,
          endpoints:()=>native.getProbeRouteRequirements(preview,seatId)?.candidates||[],compareTiming:timingForOneGoalQuery(preview)});
        goalMovementGeometryNodes+=objective?.routingNodes||0;
        return !objective?.intent?.path.length;
      };
      if(!noPlan(after)||!noPlan(quote.after))return null;
      const {player,capital,...dataPlan}=prep;
      const {claim,gain,capital:claimCapital}=quote;
      return {firstActionId:plan.firstActionId,netGain:stateValue.sumValueParts([prep.netGain,claim?gain:0]),
        unrealizedPurposeDelta:stateValue.sumValueParts([capital.afterCapital,-capital.beforeCapital,claim?claimCapital:0]),
        requiredNativeInputs:prep.requiredNativeInputs+2,markedTiles:[],dataPlans:[{goal:plan.goal,...dataPlan}],
        quietCargoChoice:{cardId:cargo.card.id,ruleId:cargo.ruleId,claim,gain,capital:claimCapital},cargoAfterBlue3:true};
    }

    function stableFinalClaimPolicy(node){
      const stored=nodes.get(node);
      if(node.status!=="stable"||stored.intent||stored.resourceControl||stored.envelope.session)return null;
      const res=resourceSpec(node),pick=cardPickSpec(node);
      if(res?.bound||pick?.fixed)return null;
      const move=movementPlanning&&node.legalActions.some(a=>Number.isInteger(a.target?.deltaX)
        ||a.target?.kind==="move-payment"||a.target?.tradeId==="energy-for-move"
        ||a.family==="card_corner"&&a.payload?.kind==="move")?goalMovementSpec(node):null;
      if(move?.selectedActionId&&move.chosenGoal?.timing==="advance-before-rotation")return null;
      return {plans:res?.plans||[], actions:node.legalActions.filter(a=>(!res||res.retainedActionIds.includes(a.actionId))
        &&(!pick||pick.retainedActionIds.includes(a.actionId))&&(!move||move.retainedActionIds.includes(a.actionId)))};
    }

    function exactClaimState(left,right){
      if(Object.is(left,right))return true;
      if(!left||!right||typeof left!=="object"||typeof right!=="object"||Array.isArray(left)!==Array.isArray(right))return false;
      if(Array.isArray(left)&&left.length!==right.length)return false;
      const keys=Object.keys(left);
      return keys.length===Object.keys(right).length&&keys.every(k=>Object.hasOwn(right,k)&&exactClaimState(left[k],right[k]));
    }

    function sameFinalClaimEnd(source,claimed,action,lateEnd,earlyEnd){
      const original=nodes.get(source),paid=nodes.get(claimed),known=knownCards(original.envelope);
      const late=localPlans.previewFinalEndPrelude({state:readIdentityState(original.envelope),seatId,action:lateEnd,knownCards:known});
      if(!late?.task||late.task.cardInstanceId!==action.target.cardInstanceId||late.task.ruleId!==action.target.ruleId)return false;
      const early=localPlans.previewFinalEndPrelude({state:readIdentityState(paid.envelope),seatId,action:earlyEnd,knownCards:known})?.finished;
      const menu=early&&makeQuietEndPrelude(original.envelope,lateEnd,late);
      const choices=menu?.inspection.session.decision.choices;
      const confirm=choices?.find(a=>a.target?.choiceId==="confirm:task:"+late.task.cardInstanceId+":"+late.task.ruleId);
      const delayed=confirm&&localPlans.previewFinalPositiveEndTask({state:late.working,seatId,actions:choices,
        session:menu.envelope.session.session,action:confirm,knownCards:known});
      if(!delayed)return false;
      // The late claim is inside END_TURN's transaction; the early one
      // commits separately. This version difference does not govern a
      // subsequent own action across the proved foreign-seat boundary.
      return early.meta.stateVersion===delayed.meta.stateVersion+1
        &&exactClaimState({...early,meta:{...early.meta,stateVersion:delayed.meta.stateVersion}},delayed);
    }

    function proveDeferredFinalDataClaim(node, actionId, endId, witness, hasTime){
      const stored=nodes.get(node),action=node.legalActions.find(a=>a.actionId===actionId);
      if(node===openedRoot||node.status!=="stable"||stored.intent||stored.resourceControl||stored.envelope.session
        ||action?.family!=="complete_task"||action.target?.ruleId!=="b117-orbit-land-count-task")return null;
      const {plan,execution}=witness,steps=execution.prefixes.map(x=>x.action);
      if(!execution.complete||execution.goalStatus!=="completed"||![2,3].includes(steps.length)
        ||steps[0].family!=="place_data"||steps[1].family!=="choose_target"||steps[1].target?.blueSlot!==plan.goal.blueSlot
        ||steps.length===3&&steps[2].family!=="choose_card"||!hasTime())return null;
      const dataNode=execution.node;
      if(dataNode.status!=="stable")return null;
      const delayedPolicy=stableFinalClaimPolicy(dataNode);
      if(!delayedPolicy?.actions.some(a=>a.actionId===actionId))return null;
      const claimed=expand(node,actionId,true);
      if(claimed?.status!=="stable")return null;
      const earlyPolicy=stableFinalClaimPolicy(claimed);
      if(!earlyPolicy||earlyPolicy.plans.length!==1||JSON.stringify(earlyPolicy.plans[0])!==JSON.stringify(plan)
        ||earlyPolicy.actions.some(a=>a.family!=="end_turn")||earlyPolicy.actions.length>1||!hasTime())return null;
      // Exact blue completion, not a broader scalar tail that has no
      // executable data-first witness.
      if(turnTailSummary(claimed,"blue-end-turn"))return null;
      const earlyEnd=earlyPolicy.actions[0],lateEnd=node.legalActions.find(a=>a.actionId===endId);
      if(earlyEnd&&(!lateEnd||!sameFinalClaimEnd(node,claimed,action,lateEnd,earlyEnd)))return null;
      let current=claimed;
      for(const [index,step] of steps.entries()){
        if(!hasTime()||!current.legalActions.some(a=>a.actionId===step.actionId))return null;
        if(index===1&&resourceStep(current,plan.goal,{...plan.operation,placing:true,finalPlacement:true}).actionId!==step.actionId)return null;
        if(index===2){const pick=cardPickSpec(current);if(!pick?.fixed||pick.selectedActionId!==step.actionId||pick.selection?.blind)return null;}
        current=expand(current,step.actionId,true);
        if(!current)return null;
      }
      if(current.status!=="stable"||!hasTime())return null;
      const delayed=expand(dataNode,actionId,true);
      if(delayed?.status!=="stable"||current.boundary!==delayed.boundary)return null;
      const a=nodes.get(current),b=nodes.get(delayed);
      if(a.intent||b.intent||a.resourceControl||b.resourceControl||a.cardControl||b.cardControl
        ||a.envelope.session||b.envelope.session||cardKnowledgeKey(a.envelope)!==cardKnowledgeKey(b.envelope)
        ||!exactClaimState(readIdentityState(a.envelope),readIdentityState(b.envelope)))return null;
      return {proof:"seti-final-claim-blue-order-v1",goal:plan.goal.id,steps:steps.map(a=>a.actionId),
        equivalentTo:plan.firstActionId,...(earlyEnd?{equivalentEnd:endId}:{})};
    }

    function redundantQuietFinalClaim(node, actionId, endId, hasTime) {
      const stored=nodes.get(node),action=node.legalActions.find(a=>a.actionId===actionId);
      if(node===openedRoot||node.status!=="stable"||stored.intent||stored.resourceControl||stored.envelope.session
        ||action?.family!=="complete_task"||action.target?.ruleId!=="b117-orbit-land-count-task"||!hasTime())return null;
      const early=expand(node,actionId,true);
      if(!early||early.status!=="stable")return null;
      // Query the same admitted goals on the new wallet. A newly fundable
      // conversion, data/computer plan, purchase or route forbids delaying.
      const policy=stableFinalClaimPolicy(early);
      if(!policy||policy.plans.length||policy.actions.length!==1||policy.actions[0].family!=="end_turn"
        ||turnTailSummary(node,"end-turn")||!hasTime())return null;
      const late=expand(node,endId,true),confirm=late?.status==="decision"&&late.legalActions.find(a=>
        a.target?.choiceId==="confirm:task:"+action.target.cardInstanceId+":"+action.target.ruleId);
      if(!confirm||localDecisionSpec(late)?.selectedActionId!==confirm.actionId)return null;
      const lateEnd=expand(late,confirm.actionId,true);
      if(!["turn-boundary","information-barrier"].includes(lateEnd?.status))return null;
      const a=nodes.get(early),b=nodes.get(lateEnd);
      if(b.envelope.session||b.intent||b.resourceControl||b.cardControl||cardKnowledgeKey(a.envelope)!==cardKnowledgeKey(b.envelope)
        ||!exactClaimState(a.informationBarrier,b.informationBarrier)
        ||!exactClaimState(b.informationBarrier,stored.informationBarrier))return null;
      // The redundant route needs no second search node or committed
      // envelope. Run its existing quiet handover directly for comparison.
      const x=localPlans.previewFinalEndPrelude({state:readIdentityState(a.envelope),seatId,
        action:policy.actions[0],knownCards:knownCards(a.envelope),allowSameSeat:true})?.finished;
      const y=readIdentityState(b.envelope),source=readIdentityState(stored.envelope);
      if(!x||y.turn.turnNumber!==source.turn.turnNumber+1||y.turn.currentPlayerId!==seatId)return null;
      // Claiming separately adds one authority version. All other state,
      // including the same-seat handover, must match exactly.
      if(x.meta.stateVersion!==y.meta.stateVersion+1
        ||!exactClaimState({...x,meta:{...x.meta,stateVersion:y.meta.stateVersion}},y))return null;
      return {proof:"seti-quiet-final-claim-and-handover-equivalence-v1",equivalentTo:endId,
        earlySteps:[actionId,policy.actions[0].actionId],delayedSteps:[endId,confirm.actionId]};
    }

    function redundantCargoClaim(node, actionId) {
      const stored=nodes.get(node);
      if(node===openedRoot||!resourcePlanning||!movementPlanning||node.status!=="stable"
        ||stored.resourceControl||stored.envelope.session)return null;
      const action=node.legalActions.find(a=>a.actionId===actionId);
      if(action?.family!=="complete_task"||action.target?.ruleId!=="transport")return null;
      const state=readPlanningState(stored),owner=state.players.players.find(p=>p.id===seatId);
      if(stored.intent?.path.length)return null;
      if(state.turn.roundNumber!==4||!owner.mainActionCompleted
        ||data.listComputerPlacedTokens(owner).length<4||data.listBluePlacementRequirements(owner).length)return null;
      const tail=turnTailSummary(node,"end-turn");
      if(!tail?.quietCargoChoice?.claim||tail.quietCargoChoice.cardId!==action.target.cardInstanceId)return null;
      const cargo=localPlans.knownDeliveredCargo({state,seatId,knownCards:knownRootCardIds,knownFossilIds:visibleRootCargo()});
      const applied=cargo&&localPlans.previewKnownCargoClaim({state,seatId,cargo});
      if(!applied)return null;
      const after=applied.state;
      const moreData=resourceCatalog(after,[]).some(goal=>{
        if(goal.kind!=="computer-prefix")return true;
        const completion=localPlans.computerCompletion({state:after,seatId,goal});
        return completion.available&&completion.selected;
      });
      if(moreData||!quietTailHasNoAcquisition(after)||blueLandingGoalFor(after))return null;
      const native=productionKernel||globalThis.SetiProductionKernel;
      const end=node.legalActions.find(a=>a.actionId===tail.firstActionId);
      const objective=goalMovement.plan({state:after,seatId,actions:[end],status:"stable",intent:stored.intent,objectiveOnly:true,
        routeCache:movementRouteCache,endpoints:()=>native.getProbeRouteRequirements(after,seatId)?.candidates||[],compareTiming:timingForOneGoalQuery(after)});
      goalMovementGeometryNodes+=objective?.routingNodes||0;
      if(objective?.intent?.path.length)return null;
      return {proof:"seti-cargo-claim-and-quiet-end-equivalence-v1",equivalentTo:tail.firstActionId,
        valueDelta:tail.netGain,cardId:tail.quietCargoChoice.cardId};
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
      const publicAmibaQuiet=company?.activeAbilityId==="deepspace_swap_cards"
        &&state.aliens.amiba?.revealInitialized===true&&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="阿米巴")
        &&owner.hand.every(knownOrOpaque)&&owner.reservedCards.every(card=>knownCards(stored.envelope).has(card.id))
        &&owner.reservedCards.every(card=>!cardEffects.getCardModel(card)?.temporaryTasks?.length)
        &&!cardEffects.listPendingTriggerKeys({...owner,reservedCards:owner.hand},state.turn).length;
      const publicAmibaPlainEnd=kind==="end-turn"&&publicAmibaQuiet;
      const cargoBlue3=kind==="blue-end-turn"&&computerPolicy?.plans.length===1&&computerPolicy.plans[0].goal.id==="data:blue:3"
        &&data.getBlueBonusPlacementReward(owner,3)?.type==="publicity";
      // A revealed Chong board without a live transport cannot settle
      // an arrival on ordinary END. Keep the same trigger, task, mark and
      // turn-flow proof as the known Amiba tail, with no new draw or probe move.
      const cargoTasks=(kind==="end-turn"||cargoBlue3)&&state.turn.roundNumber===4&&publicAmibaQuiet&&knownRootAlienIds.has("虫")
        &&openedRoot.legalActions.some(a=>a.family==="complete_task"&&a.target?.ruleId==="transport")
        ?node.legalActions.filter(a=>a.family==="complete_task"):null;
      const cargoAtEnd=cargoTasks?.length===1&&cargoTasks[0].target.ruleId==="transport"
        ?localPlans.knownDeliveredCargo({state,seatId,knownCards:knownRootCardIds,
          knownFossilIds:visibleRootCargo()}):null;
      const quietR4ChongEnd=(kind==="end-turn"||cargoBlue3&&cargoAtEnd)&&state.turn.roundNumber===4
        &&openedRoot.legalActions.some(a=>a.family==="complete_task"&&a.target?.ruleId==="transport")
        &&knownRootAlienIds.has("虫")&&publicAmibaQuiet
        &&state.turn.activePlayerIds.every(id=>id===seatId||state.turn.passedPlayerIds.includes(id))
        &&(!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
          ||cargoAtEnd?.card.id===cargoTasks?.[0]?.target.cardInstanceId)
        &&owner.reservedCards.filter(c=>c.set==="alien:虫"&&c.id!==cargoAtEnd?.card.id).every(c=>{
          const model=cardEffects.getCardModel(c),rule=endScoring.resolveCardEndGameRule(c,cardEffects);
          return model?.cardType===3&&rule?.kind==="chongTraceCount"
            &&!model.triggers?.length&&!model.tasks?.length&&!model.temporaryTasks?.length&&!c.chongTask&&!chong.getCardTask(c);
        });
      // Already reserved type-3 Chong scoring cards contribute to V, but
      // cannot receive an END event. Remove them only from the trigger audit.
      const publicChongPlainEnd=kind==="end-turn"&&state.turn.roundNumber===3
        &&company?.activeAbilityId==="deepspace_swap_cards"&&knownRootAlienIds.has("虫")
        &&Object.values(state.aliens.aliens).some(slot=>slot.revealed&&slot.alienId==="虫")
        &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
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
      const quietR4ChongData=fixedR4DeepSpace&&knownRootAlienIds.has("虫")
        &&openedRoot.legalActions.some(a=>a.family==="complete_task"&&a.target?.ruleId==="transport")
        &&owner.reservedCards.filter(c=>c.set==="alien:虫").every(c=>{
          const model=cardEffects.getCardModel(c),rule=endScoring.resolveCardEndGameRule(c,cardEffects);
          return model?.cardType===3&&rule?.kind==="chongTraceCount"
            &&!model.triggers?.length&&!model.tasks?.length&&!model.temporaryTasks?.length&&!c.chongTask&&!chong.getCardTask(c);
        });
      const endGuard=quietR4ChongEnd||quietR4ChongData?{...state,
        ...(cargoAtEnd?{aliens:{...state.aliens,chong:{...state.aliens.chong,transportTasksByRocketId:{}}}}:{}),
        players:{...state.players,players:state.players.players.map(p=>p===owner
        ?{...owner,reservedCards:owner.reservedCards.filter(c=>c.set!=="alien:虫")}:p)}}:state;
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
          ||(knownAmibaTail||publicAmibaPlainEnd||publicAmibaCurrencyTail||fixedR4DeepSpace||quietR4ChongEnd)&&slot.alienId==="阿米巴"
          ||(quietR4ChongEnd||quietR4ChongData)&&slot.alienId==="虫"
          ||(fixedR4DeepSpace||publicChongPlainEnd||state.turn.roundNumber===3
            &&(publicAmibaPlainEnd||!hasOwnVisitSource(state)&&(publicAmibaCurrencyTail||quietR3Computer))
            &&!Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length)
            &&slot.alienId==="虫"&&owner.reservedCards.every(card=>card.set!=="alien:虫"))
          &&!alienState.isAlienReadyToReveal(slot))
        // A plain end cannot move a probe; the helper still checks historical
        // matching triggers, tasks and scoring. Compound plans keep their
        // visit-capable guard until their complete event set is proved.
        // Plain end never moves; compound previews below separately certify
        // that no movement policy starts at any intermediate goal boundary.
        &&hasPostMainInertReservations(endGuard,false,knownAmibaTail||publicAmibaPlainEnd||publicAmibaCurrencyTail||quietR4ChongData||quietR4ChongEnd,publicAmibaPlainEnd||publicChongPlainEnd||publicAmibaCurrencyTail||stationaryAmibaPrefix||quietR3Computer||fixedProbeComputer||quietR4ChongData||quietR4ChongEnd,deferredTask)
        &&(deferredTask||quietR4ChongEnd&&cargoAtEnd||!node.legalActions.some(a=>a.family==="complete_task"))){
        const transition=previewTurn(state);
        if(transition.turnAdvanced&&!transition.roundAdvanced&&!transition.gameEnded){
          if(kind==="end-turn"){
            const completion=localPlans.quietEndCompletion({state,seatId});
            if(quietR4ChongEnd&&cargoAtEnd&&completion.available&&!completion.netGain&&!completion.markedTiles.length
              &&transition.nextPlayerId===seatId){
              const quote=quietCargoEndQuote(state,owner,cargoAtEnd);
              if(quote){
                const {claim,gain,capital}=quote;
                spec={firstActionId:end.actionId,netGain:claim?gain:0,requiredNativeInputs:2,markedTiles:[],
                  unrealizedPurposeDelta:claim?capital:0,
                  quietCargoChoice:{cardId:cargoAtEnd.card.id,ruleId:cargoAtEnd.ruleId,claim,gain,capital}};
              }
            }
            if(!cargoAtEnd&&!deferredTask?.compareClaim&&completion.available&&(!deferredTask||completion.markedTiles.length===0&&completion.netGain===0&&transition.nextPlayerId===seatId))
              spec={firstActionId:end.actionId,netGain:completion.netGain,requiredNativeInputs:completion.requiredNativeInputs+Number(Boolean(deferredTask)),markedTiles:completion.markedTiles,
                ...(deferredTask?.fixedSkip?{quietDeferredTask:{cardId:deferredTask.cardId,taskId:deferredTask.taskId},...(deferredTask.forecast?{deferredPublicity:deferredTask.forecast}:{})}:deferredTask?{deferredPublicity:deferredTask}:{}),
                ...(publicAmibaPlainEnd?{publicAmibaPlainEnd:true,unrealizedPurposeDelta:completion.purposeDelta}:
                  publicChongPlainEnd?{publicChongPlainEnd:true,unrealizedPurposeDelta:completion.purposeDelta}:{})};
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
          else if(cargoAtEnd){
            spec=quietR4CargoBlue3({state,owner,node,stored,plan:computerPolicy.plans[0],cargo:cargoAtEnd,transition});
          }else{
            const policy=resourceSpec(node),plan=policy?.plans.length===1&&policy.plans[0],tail=policy?.fixedBlueTail
              ||(publicAmibaCurrencyTail||inertVisitBonus)&&plan?.goal.kind==="blue-data"&&localPlans.blueCompletion({state,seatId,goal:plan.goal});
            if(kind==="blue-end-turn"&&publicAmibaCurrencyTail&&plan?.goal.id==="data:blue:1")
              spec=deferredTask?quietCappedTaskBlueCurrency({state,owner,node,stored,plan,transition,deferredTask})
                :quietScoredCornerThenBlueCurrency({state,owner,node,stored,plan,transition});
            if(kind==="blue-end-turn"&&publicAmibaCurrencyTail&&plan?.goal.kind==="blue-data"&&plan.goal.blueSlot===2)
              spec=owner.resources.availableData===0&&!deferredTask?quietScoredCornerThenBluePick({state,owner,node,stored,plan,transition}):
                quietBluePublicPick({state,owner,node,stored,plan,transition,deferredTask});
            if(!spec&&kind==="blue-end-turn"&&publicAmibaCurrencyTail&&!deferredTask
              &&state.turn.roundNumber===4&&stored.informationBarrier?.code==="hidden_card_reveal"
              &&stored.intent?.path.length===0&&plan?.goal.id==="data:blue:2")
              spec=quietR4ComputerFiveBlue({state,owner,node,stored,plan,transition});
            if(!spec&&kind==="blue-end-turn"&&quietR4ChongData&&!deferredTask&&plan)
              spec=quietR4Blue3Pick({state,owner,node,stored,plan,transition});
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
                scoredFinish:quietR4ChongData?preview=>localPlans.scoredEndCorner({state:preview,seatId,
                  actions:openedRoot.legalActions,knownCards:knownCards(stored.envelope)}):null,
                cornerPolicy:quietR4ChongData&&plan.goal.kind==="income"?(preview,goal)=>{
                  const p=preview.players.players.find(q=>q.id===seatId);
                  const actions=node.legalActions.filter(a=>a.family==="card_corner"&&a.payload?.kind==="resource"
                    &&p.hand.some(c=>c.id===a.target.cardInstanceId));
                  const prep=resourceDemand.preparations({state:preview,seatId,goal,actions,selectionOnly:true}).find(x=>!x.observer);
                  const action=actions.find(a=>a.actionId===prep?.actionId);
                  const card=action&&p.hand.find(c=>c.id===action.target.cardInstanceId&&knownCards(stored.envelope).has(c.id));
                  const reward=card&&cards.getDiscardActionRewardForCard(card);
                  if(!card||action.payload.multiplier!==1||reward?.dataCount!==1
                    ||Object.keys(reward.gain||{}).some(k=>k!=="score"))return null;
                  return {card,score:reward.gain?.score||0};
                }:null,
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
                spec={firstActionId:plan.firstActionId,netGain:compound.netGain,requiredNativeInputs:compound.requiredNativeInputs,dataPlans:compound.plans,markedTiles:compound.markedTiles,...(compound.scoredFinish?{scoredFinish:compound.scoredFinish}:{}),...(compound.skippedFundedBlue?{skippedFundedBlue:compound.skippedFundedBlue}:{}),...(compound.primaryOnly?{primaryOnly:true}:{}),
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
        ...(quietR4ChongEnd?{quietR4ChongEnd:true}:{}),
        ...(quietR4ChongData?{quietR4ChongData:true}:{}),
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
        if(Array.isArray(active)&&active.length>0&&active.every(id=>id===seatId||passed.includes(id))){
          const state=readIdentityState(stored.envelope);
          // The shared observation publishes this rule-derived mark unchanged
          // through a card or tech reveal. This bound needs no other projection.
          const direct=state.turn.roundNumber===2&&quietEarlySameSeatHandover(state)
            &&Object.hasOwn(rootObservation.selfState||{},"nextFinalMark");
          const mark=direct?endScoring.describeNextFinalMark({...state,cardEffects,
            getCardTypeCode:card=>cardEffects.getRuntimeCardTypeCode(card,cardEffects.getCardModel(card)?.cardType)},
            state.players.players.find(p=>p.id===seatId)):node.observation.selfState?.nextFinalMark;
          if(mark?.valuationSafe&&mark.options.some(option=>option.currentValue>0)){postMainValueBounds.set(node,null);return null;}
        }
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
      decodedStates.clear(); decodedStateCacheBytes = 0; committedReferences=new WeakMap();
      envelopeObservations = new WeakMap();valueObservations=new WeakMap(); stateRequirements = new WeakMap(); goalCatalogs = new WeakMap();
      nodes = new WeakMap();
      movementValueBounds=new WeakMap();movementBoundQueries=0;movementRuleQueries=0;movementIntentRecoveries=0;completedMovementRecoveries=0;
      observationReleasers = new WeakMap();
      normalizedIdentityStates = new Map();
      identitySubtrees.values=new WeakMap();
      identitySlices.values=new WeakMap(); identitySlices.hits=0; identitySlices.stores=0;
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
      chongDirectClaims.clear();
      quietDataMenuTemplate = null;
      dataRewardMenuTemplates.clear();
      identities.clear();physicalIdentityBuckets.clear();nextPhysicalIdentity=0;identityBucketCollisions=0;
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

    function knownPickupFundingEnabled(){
      const node=openedRoot,stored=nodes.get(node),head=stored?.envelope.session?.session?.queue?.[0];
      if(rootObservation?.publicState.roundNumber!==3)return false;
      if(node.status==="decision"&&head?.type==="card_play_domain_effect:decision:chong_pickup_fossil"&&head.ownerId===seatId)
        return node.legalActions.length>1&&node.legalActions.every(a=>a.target?.fossilId&&knownRootFossilIds.has(a.target.fossilId));
      if(node.status!=="stable"||stored.envelope.session||!node.legalActions.some(a=>a.family==="end_turn")
        ||!node.legalActions.some(a=>a.family==="place_data")||!rootObservation.publicState.board.rockets.some(r=>r.fossilId))return false;
      const state=readPlanningState(stored),p=state.players.players.find(x=>x.id===seatId);
      return p.mainActionCompleted&&!p.passCompletionPending
        &&p.resources.availableData>=2&&data.listComputerPlacedTokens(p).length>=5
        &&Object.values(state.aliens.chong?.transportTasksByRocketId||{}).some(job=>
          !job.delivered&&visibleEarthCargo(state,p,job)&&simpleCargoScanReward(chong.getFossilReward(job.fossilId)));
    }

    function quoteKnownPickupFunding(node){
      if(node.status!=="turn-boundary"||node.boundary!=="own-turn-complete")return null;
      const stored=nodes.get(node),state=stored&&!stored.envelope.session&&!stored.informationBarrier&&readPlanningState(stored);
      if(!state)return null;
      const t=state.turn,p=state.players.players.find(x=>x.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.gameEnded||p.mainActionCompleted||p.passCompletionPending
        ||p.industryBorrowedTechTileId||t.passedPlayerIds.includes(seatId)||!t.activePlayerIds.includes(seatId)
        ||t.cardTurnEventBonuses?.length||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||p.hand.some(c=>!knownRootCardIds.has(c.id))
        ||state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles).some(tile=>
          tile.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
      const jobs=Object.values(state.aliens.chong?.transportTasksByRocketId||{});
      if(jobs.length!==1)return null;
      const job=jobs[0];
      const knownCargo=knownRootFossilIds.has(job.fossilId)||Boolean(visibleEarthCargo(state,p,job));
      const reward=knownCargo&&chong.getFossilReward(job.fossilId);
      const fossil=state.aliens.chong?.fossilsById?.[job.fossilId];
      if(job.delivered||job.destinationPlanetId!=="earth"||fossil?.status!=="transported"||fossil.taskCompleted
        ||!simpleCargoScanReward(reward))return null;
      const rule=chong.getCardTask(p.reservedCards.find(c=>c.id===job.cardId));
      if(rule?.kind!=="transport"||rule.dataCount!==2||rule.fossilRewardRepeat!==1||Object.keys(rule.gain||{}).length
        ||rule.effects||rule.rewards||rule.pickCard||rule.pickAlienCard||rule.drawCards)return null;
      const ship=state.pieces.rockets.find(r=>r.playerId===seatId&&r.kind==="chong-fossil"&&r.fossilId===job.fossilId);
      const earth=solar.collectPlanetLocations(state.solarSystem).find(x=>x.planetId==="earth");
      const at=ship&&rockets.getRocketSectorCoordinate(ship);
      const payers=p.hand.filter(c=>cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1);
      if(!at||!earth||ship.movementLocked||payers.length!==2
        ||payers.some(c=>Object.keys(cards.getDiscardActionMoveRewardForCard(c).gain).some(k=>k!=="score"))
        ||state.pieces.rockets.some(r=>r.playerId===seatId&&rockets.isControllablePlayerRocket(r)))return null;
      const dx=Math.abs(at.x-earth.x);
      if(Math.min(dx,8-dx)+Math.abs(at.y-earth.y)!==3||shortEarthPath(state,p,ship,at,earth,3)?.length!==3)return null;
      const knownAlienDisplay=rootObservation.publicState.board.aliens.amibaTraces?.displayedCardIndex;
      const prep=localPlans.previewPickupAnalysisForCargo({state,seatId,knownAlienDisplay,knownCards:knownRootCardIds});
      if(!prep)return null;
      // The Blue 2 point is spent on the third move. Only the
      // deterministic task reward changes the wallet before income.
      const q=prep.p,payerIds=new Set(payers.map(c=>c.id));
      q.hand=q.hand.filter(c=>!payerIds.has(c.id));q.resources.handSize=q.hand.length;
      players.gainResources(q,reward.gain);
      for(let i=0;i<rule.dataCount;i++)if(!data.gainData(q,{root:prep.next}).ok)return null;
      const source=q.hand.filter(c=>cards.getIncomeGainForCard(c)?.energy===1&&Object.keys(cards.getIncomeGainForCard(c)).length===1)
        .sort((a,b)=>resourceDemand.cardOpportunityCost(prep.next,seatId,a)-resourceDemand.cardOpportunityCost(prep.next,seatId,b)||a.id.localeCompare(b.id))[0];
      const income=source&&resourceDemand.previewIncomeTail({state:prep.next,seatId,goal:{incomeCardId:source.id}});
      if(!income?.available||income.placements!==3||income.player.resources.availableData)return null;
      const wallet=income.player,cost=scanEffects.getStandardScanCost(wallet);
      const first=scanEffects.buildScanEffectQueue(wallet,{turn:t})[0];
      const scanSource=first&&scienceSession.getPlanetScanSource(prep.next,first.type);
      if(!scanSource||!scienceSession.listNebulaChoices(prep.next,{...scanSource,gainData:true}).some(a=>
        data.listNebulaTokens(state.data,a.target.nebulaId).some(token=>!token.replacedByPlayerId&&!token.replacedByPlayerColor)))return null;
      const exchange=quickTrades.getTradeAction("credits-for-energy");
      const count=Math.max(0,Math.ceil((cost.energy-wallet.resources.energy)/exchange.gain.energy));
      const credits=wallet.resources.credits-count*exchange.cost.credits-cost.credits;
      if(credits<0)return null;
      const energy=wallet.resources.energy+count*exchange.gain.energy-cost.energy;
      return {rank:1+credits+energy,credits,energy,exchangeCount:count,fossilId:job.fossilId};
    }

    function visibleRootCargo(){
      return new Set(rootObservation.publicState.board.rockets.filter(r=>r.fossilId).map(r=>r.fossilId));
    }

    function deferredCargoEnabled(){
      if(!resourcePlanning||rootObservation?.publicState.roundNumber!==4||!knownRootAlienIds.has("虫"))return false;
      const head=nodes.get(openedRoot)?.envelope.session?.session?.queue?.[0];
      if(head?.ownerId===seatId&&(head.type===scienceSession.EFFECT_TYPES.SCAN_ACTION_4
        ||head.payload?.kind==="chong_task"))return true;
      const stored=nodes.get(openedRoot),plan=fundedEarthShipmentStep(openedRoot,stored,null,stored.envelope.session?.session);
      return Boolean(plan?.quote.pickId);
    }

    function quoteDeferredCargo(node){
      if(!["turn-boundary","information-barrier"].includes(node.status))return null;
      const stored=nodes.get(node);
      if(!stored?.envelope||stored.envelope.session)return null;
      const t=readIdentityState(stored.envelope).turn;
      if(t.currentPlayerId!==seatId)return null;
      const sameTurn=JSON.stringify([t.roundNumber,t.turnNumber,t.actionCycleNumber])===rootTurnKey;
      const state=planningState(readIdentityState(stored.envelope),stored.informationBarrier,knownRootCardIds);
      if(sameTurn){
        if(node.status!=="information-barrier")return null;
        const root=nodes.get(openedRoot),purchase=fundedEarthShipmentStep(openedRoot,root,null,root.envelope.session?.session);
        if(!purchase?.quote.pickId)return null;
        const funded=fundedEarthShipment(state,knownRootCardIds);
        return funded?.supplierId===purchase.quote.pickId&&!funded.pickId?funded:null;
      }
      const knownFossilIds=visibleRootCargo();
      const delivered=localPlans.quoteDeferredCargo({state,seatId,knownCards:knownRootCardIds,knownFossilIds});
      if(delivered)return delivered;
      const root=nodes.get(openedRoot),head=root.envelope.session?.session?.queue?.[0];
      if(head?.type!==scienceSession.EFFECT_TYPES.SCAN_ACTION_4)return null;
      const origin=readPlanningState(root),cargo=knownEarthShipment(origin,knownRootCardIds);
      if(!cargo||shortEarthPath(origin,cargo.p,cargo.ship,cargo.from,cargo.earth,2))return null;
      return fundedEarthShipment(state,knownRootCardIds);
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

    function displayedAnalysisTransportSource(){
      if(!knownRootAlienIds.has("虫")||!Number.isSafeInteger(knownChongDisplayIndex))return null;
      const stored=nodes.get(openedRoot),session=stored.envelope.session?.session;
      const root=["research_tech","move"].includes(session?.journal?.actions?.[0]?.action.family)
        ?planningState(session.baseState,stored.informationBarrier,knownRootCardIds)
        :!session&&readPlanningState(stored);
      if(!root)return null;
      const t=root.turn,p=root.players.players.find(q=>q.id===seatId);
      const card=chong.getCardDefinition(knownChongDisplayIndex);
      const list=card&&cardEffects.getCardModel({cardId:card.cardId,set:"alien:虫"})?.playEffects;
      if(list?.length!==2||list[0].type!=="chong_land_for_pickup"||list[1].type!=="chong_pickup_fossil"
        ||t.roundNumber!==3||t.currentPlayerId!==seatId||p.mainActionCompleted||p.passCompletionPending
        ||p.resources.energy||p.resources.credits||p.resources.availableData<1
        ||data.listComputerPlacedTokens(p).length+p.resources.availableData!==7
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))||t.cardTurnEventBonuses?.length
        ||p.hand.some(c=>!knownRootCardIds.has(c.id))
        ||!hasPostMainInertReservations(root,true,true,true))return null;
      const probes=root.pieces.rockets.filter(q=>q.playerId===seatId&&q.surface==="solar-board"&&!q.fossilId);
      const offer=rootObservation.publicState.board.aliens.chongOffer;
      if(probes.length>1||offer?.displayedCardIndex!==knownChongDisplayIndex
        ||!chong.isChongRevealedSlot(root.aliens,offer.slotId))return null;
      if(!probes.length&&(!root.cards.publicCards.some(c=>c&&knownRootCardIds.has(c.id)
        &&cards.getDiscardActionMoveRewardForCard(c)?.movementPoints===1)||p.resources.publicity<techResolver.getResearchPublicityCost(p)))return null;
      return {turn:t.turnNumber,probeId:probes[0]?.id??null,owned:p.techState.ownedTiles,hand:p.hand.map(c=>c.id),
        index:offer.displayedCardIndex,alienSlot:offer.slotId};
    }

    function quoteDisplayedAnalysisTransport(node,purpose){
      const tail=node.status==="turn-tail-value"?node.planSummary:null;
      if(tail?(tail.kind!=="end-turn"||tail.netGain||tail.markedTiles.length):node.status!=="turn-boundary")return null;
      const stored=nodes.get(tail?nodes.get(node).turnTailBase:node);
      if(!stored?.envelope||stored.envelope.session||stored.intent
        ||stored.informationBarrier&&!["tech_bonus_reveal","hidden_card_reveal"].includes(stored.informationBarrier.code))return null;
      const s=readPlanningState(stored),t=s.turn,p=s.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.turnNumber!==purpose.turn+Number(!tail)
        ||p.mainActionCompleted!==Boolean(tail)||p.resources.energy
        ||s.aliens.chong.displayedCardIndex!==purpose.index
        ||p.hand.some(c=>!knownRootCardIds.has(c.id)))return null;
      if(purpose.probeId===null)return quoteLaunchForDisplayedAnalysisTransport(s,p,purpose,Boolean(tail));
      return previewDisplayedAnalysisTransport(s,p,purpose,Boolean(tail));
    }

    function previewDisplayedAnalysisTransport(s,p,purpose,advance){
      if(p.resources.credits!==1)return null;
      const added=Object.keys(p.techState.ownedTiles).filter(id=>!purpose.owned[id]);
      const cashSlot=added.length===1&&p.techState.blueBoardSlots[added[0]];
      if(!cashSlot||data.getBlueBonusPlacementReward(p,cashSlot)?.type!=="credits"
        ||!data.listBlueBonusPlacedTokens(p).some(x=>x.blueSlot===cashSlot))return null;
      const slots=data.listComputerPlacedTokens(p).map(x=>x.placementSlot);
      if(![5,6].includes(slots.length)||slots.some((slot,i)=>slot!==i+1)
        ||slots.length+p.resources.availableData!==6)return null;
      const next=structuredClone(s),q=next.players.players.find(x=>x.id===seatId);
      if(advance){
        const a=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
        if(!a.turnAdvanced||a.roundAdvanced||a.gameEnded||a.nextPlayerId!==seatId)return null;
        q.mainActionCompleted=false;
      }
      if(slots.length===5){
        const r=data.placeDataToComputer(q);
        if(!r.ok||r.placementSlot!==6||r.slotBonuses?.length
          ||cardEffects.collectMatchingTriggers(q,{type:"placeData",playerId:seatId,placementKind:"computer",placementSlot:6}).length)return null;
      }
      if(!data.analyzeDataWithoutEnergy(q).ok)return null;
      const triggers=type=>q.reservedCards.some(c=>cardEffects.getCardModel(c)?.triggers?.some(x=>(x.event.types||[x.event.type]).includes(type)));
      if(triggers("analyze")||triggers("alien_card_gain"))return null;
      const available=Object.entries(chong.TRACE_REWARDS.blue).flatMap(([k,r])=>{
        const position=Number(k);
        return r.pickAlienCard&&r.gain?.score>0&&chong.canPlaceChongTrace(next.aliens,purpose.alienSlot,"blue",position,q).ok
          ?[{position,score:r.gain.score}]:[];
      }).sort((a,b)=>b.score-a.score||a.position-b.position);
      const trace=available[0],event={type:"alienTrace",traceType:"blue",playerId:seatId,alienSlotId:purpose.alienSlot,region:null};
      if(!trace||cardEffects.collectMatchingTriggers(q,event).length
        ||cardEffects.collectMatchingTriggers(q,{...event,alienId:"虫"}).length)return null;
      const serial=next.meta.sequences.alienEntity,card=chong.createAlienCard(purpose.index,serial+1);
      if(!card||q.hand.some(c=>c.id===card.id))return null;
      // No next display, no unknown cargo, and no new scoring mark enter this proof.
      next.aliens.chong.displayedCardIndex=null;
      if(!chong.placeChongTrace(next.aliens,purpose.alienSlot,"blue",trace.position,q,{sequence:serial}).ok)return null;
      players.gainResources(q,{score:trace.score});
      if(next.finalScoring.thresholds.some(n=>!Object.values(next.finalScoring.tiles).some(x=>x.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
      const a=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
      if(!a.turnAdvanced||a.roundAdvanced||a.gameEnded||a.nextPlayerId!==seatId)return null;
      q.mainActionCompleted=false;
      q.hand.push(card);q.resources.handSize=q.hand.length;
      let directory;
      const route=resourceDemand.heldLandingGoal({state:next,seatId,compareTiming:timingForOneGoalQuery(next),
        candidates:()=>directory??=(productionKernel||globalThis.SetiProductionKernel).getProbeRouteRequirements(next,seatId)?.candidates||[]});
      if(!route?.directTransport||route.cardId!==card.id||route.rocketId!==purpose.probeId||route.creditPaymentIds.length!==2)return null;
      const land=directory.find(c=>route.id.startsWith(c.requirementId+":direct-transport:"));
      const landingScore=land?.targetBenefit.score,landData=land?.targetBenefit.dataCount;
      if(!Number.isSafeInteger(landingScore)||!Number.isSafeInteger(landData))return null;
      const yellow=knownPublicLandingTrace(next,q,land),task=knownLandingTask(next,q),w=stateValue.DEFAULT_WEIGHTS;
      const value=stateValue.sumValueParts([trace.score,landingScore,yellow?.score||0,task?.score||0,
        (landData-p.resources.availableData)*w.availableData,(task?.credits||0)*w.credits,
        -p.resources.credits*w.credits,-(route.path.length+route.creditPaymentIds.length)*w.handSize]);
      return value>0?{kind:"known-display-analysis-transport",value,cashSlot,
        display:purpose.index,trace:trace.position,routeId:route.id,landingScore,landData,
        ...(yellow?{knownYellowTrace:yellow}:{}),...(task?{knownLandingTask:task}:{})}:null;
    }

    function quoteLaunchForDisplayedAnalysisTransport(s,p,purpose,advance){
      const tiles=Object.keys(p.techState.ownedTiles).filter(id=>!purpose.owned[id]);
      if(tiles.length!==1||s.tech.stacks[tiles[0]]?.techType!=="orange"||p.resources.credits||p.resources.energy
        ||purpose.hand.length+1!==p.hand.length||purpose.hand.some(id=>!p.hand.some(c=>c.id===id))
        ||p.resources.availableData!==3||data.listComputerPlacedTokens(p).length!==4)return null;
      const probes=s.pieces.rockets.filter(q=>q.playerId===seatId&&q.surface==="solar-board"&&!q.fossilId);
      if(probes.length!==1)return null;
      const moveCard=p.hand.find(c=>!purpose.hand.includes(c.id));
      const move=cards.getDiscardActionMoveRewardForCard(moveCard);
      if(move?.movementPoints!==1||Object.keys(move.gain).length)return null;
      const next=structuredClone(s),q=next.players.players.find(x=>x.id===seatId);
      if(advance){
        const a=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
        if(!a.turnAdvanced||a.roundAdvanced||a.gameEnded||a.nextPlayerId!==seatId)return null;
        q.mainActionCompleted=false;
      }
      const candidates=rocketAbilities.listPlayerMoveChoices(next,q,{maxPoints:1}).map((target,i)=>
        ({family:"move",actionId:String(i),target,payload:{requiredMovePoints:target.requiredMovePoints}}));
      const launched={...purpose,probeId:probes[0].id,owned:p.techState.ownedTiles};
      const funding=displayedTransportResearchMove(next,candidates,knownRootCardIds,null,launched);
      if(!funding||funding.movementFunding.cardId!==moveCard.id)return null;
      const {firstMoveId,cardId,publicityPayerId}=funding.movementFunding;
      const action=candidates.find(x=>x.actionId===firstMoveId);
      q.hand=q.hand.filter(c=>c.id!==cardId&&c.id!==publicityPayerId);
      q.resources.handSize=q.hand.length;
      const moved=rocketAbilities.moveProbe(next,{...action.target,movementPoints:1,cost:{},source:"move"});
      if(!moved.ok)return null;
      players.gainResources(q,{publicity:1});
      const stack=next.tech.stacks[funding.tileId],idx=stack.bonusIndex;
      if(stack.bonusHidden||idx!==knownRootTechIndices.get(funding.tileId))return null;
      stack.bonusQueue=stack.bonusQueue.map((id,i)=>i===idx?id:null);
      const rotated=techResolver.rotateForResearch(scienceSession.createActionContext(next,seatId),1);
      const options={skipRotate:true};
      const choice=rotated.ok&&!rotated.events.length&&scienceSession.listResearchChoices(next,seatId,options)
        .find(a=>a.target.tileId===funding.tileId&&a.target.blueSlot===funding.blueSlot);
      const result=choice&&scienceSession.executeResearchChoice(next,seatId,choice,options);
      if(!result?.ok||result.awaitingCardSelection||result.events.length!==1||result.events[0].type!=="researchTech"
        ||cardEffects.collectMatchingTriggers(q,result.events[0]).length)return null;
      q.mainActionCompleted=true;
      const cash=localPlans.previewBlueCompletion({state:next,seatId,goal:{id:"data:blue:"+funding.blueSlot,kind:"blue-data",blueSlot:funding.blueSlot,required:{}}});
      if(!cash.available||cash.computerPlacements!==1||cash.incomeCardId||cash.dataCornerId||cash.player.resources.credits!==1)return null;
      const funded=cash.player;
      next.players.players=next.players.players.map(x=>x===q?funded:x);
      const quiet=localPlans.quietEndCompletion({state:next,seatId});
      if(!quiet.available||quiet.markedTiles.length||quiet.netGain)return null;
      const route=previewDisplayedAnalysisTransport(next,funded,launched,true);
      if(!route)return null;
      const w=stateValue.DEFAULT_WEIGHTS;
      const total=(st,player)=>endScoring.computePlayerFinalScore({...st,players:st.players.players,cardEffects,
        finalScoring:structuredClone(st.finalScoring),aliens:structuredClone(st.aliens),
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},player).totalScore;
      const value=stateValue.sumValueParts([route.value,total(next,funded),-total(s,p),
        stateValue.technologyCapital(funded.techState,3),-stateValue.technologyCapital(p.techState,3),
        ...Object.keys(w).map(k=>(funded.resources[k]-p.resources[k])*w[k])]);
      return value>0?{...route,kind:"known-launch-and-displayed-transport",value,launchTile:tiles[0],moveCardId:moveCard.id}:null;
    }

    function researchTransportPurpose() {
      const stored=nodes.get(openedRoot);
      if(!knownRootAlienIds.has("虫"))return null;
      const state=readPlanningState(stored),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.passCompletionPending
        ||p.resources.credits!==0||p.resources.energy!==0||p.resources.availableData!==1||p.dataState.poolTokens.length!==1
        ||data.listComputerPlacedTokens(p).length!==5||t.cardTurnEventBonuses?.length
        ||!t.activePlayerIds.includes(seatId)||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length||!hasPostMainInertReservations(state,true,true,true)
        ||!p.hand.some(c=>knownRootCardIds.has(c.id)&&cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil")))return null;
      if(p.mainActionCompleted){
        const base=stored.envelope.session?.session?.baseState||state;
        const cash=transportCashGoal(base,stored);
        if(!cash?.competingTransportCash)return null;
        return {hand:p.hand.map(c=>c.id),player:p,probeId:state.pieces.rockets.find(r=>r.playerId===seatId&&r.surface==="solar-board")?.id,
          turn:t.turnNumber,cashSlot:cash.blueSlot};
      }
      const probes=state.pieces.rockets.filter(r=>r.playerId===seatId&&r.surface==="solar-board");
      if(probes.length!==1)return null;
      const menu=openedRoot.legalActions,session=stored.envelope.session?.session;
      const paidChoice=session?.queue?.[0]?.type===scienceSession.EFFECT_TYPES.RESEARCH
        &&session.journal?.actions?.[0]?.action?.family==="research_tech";
      let payerIds=[],heldPayments=false;
      if(!paidChoice&&!menu.some(a=>a.family==="research_tech")){
        const plans=resourceSpec(openedRoot)?.plans||[];
        const transport=plans.find(x=>x.goal.movementFunding?.publicityPayerId)?.goal;
        if(transport){
          const {cardId,publicityPayerId}=transport.movementFunding;
          payerIds=[cardId,publicityPayerId];
          heldPayments=Boolean(transport.heldPayments);
        }else {
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
      return {hand:p.hand.filter(c=>!payerIds.includes(c.id)).map(c=>c.id),player:p,probeId:probes[0].id,turn:t.turnNumber,heldPayments};
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
          &&(purpose.cashSlot===blueSlot||!data.getBlueBonusPlacementReward(purpose.player,blueSlot));
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
      const quote=publicHeldTransport(future,probe.id,p,{priceKnownYellow:purpose.heldPayments,priceLandingTask:purpose.heldPayments});
      return quote&&{...quote,blueSlot:cash.blueSlot};
    }

    function publicHeldTransport(future,probeId,p,{priceKnownYellow=false,priceLandingTask=false}={}) {
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
      const yellow=priceKnownYellow&&knownPublicLandingTrace(future,p,landing);
      const task=priceLandingTask&&knownLandingTask(future,p);
      const w=stateValue.DEFAULT_WEIGHTS,value=stateValue.sumValueParts([score,yellow?.score||0,landData*w.availableData,
        movePublicity*w.publicity,-w.credits,-w.handSize,-w.handSize,task?.score||0,(task?.credits||0)*w.credits]);
      return value>0?{value,landingScore:score,landData,movePublicity,routeId:route.id,
        ...(yellow?{knownYellowTrace:yellow}:{}),...(task?{knownLandingTask:task}:{})}:null;
    }

    function knownLandingTask(state,p){
      // The already validated destination adds exactly one ordinary landing
      // marker. Price one newly satisfied persistent task with only score and
      // credits; no reward choice, cargo, future card or new scoring mark.
      if(state.finalScoring.thresholds.some(n=>!Object.values(state.finalScoring.tiles)
        .some(t=>t.marks.some(m=>m.playerId===seatId&&m.threshold===n))))return null;
      const context={planets:state.planets,aliens:state.aliens};
      const tasks=p.reservedCards.flatMap(card=>{
        const model=cardEffects.getCardModel(card),task=model?.tasks?.length===1&&model.tasks[0];
        const reward=task?.rewards?.length===1&&task.rewards[0],gain=reward?.options?.gain,count=task?.condition?.count;
        if(card.hidden||!knownRootCardIds.has(card.id)||model?.cardType!==2||model.triggers?.length||model.endGameScoring
          ||model.temporaryTasks?.length||task?.condition?.type!=="orbitOrLandCount"||!Number.isSafeInteger(count)||count<2
          ||card.cardEffectState?.completedTaskIds?.includes(task.id)||reward?.type!=="gain_resources"
          ||(reward.options.repeat??1)!==1||!gain||Object.keys(gain).length!==2
          ||!Number.isSafeInteger(gain.score)||gain.score<=0||!Number.isSafeInteger(gain.credits)||gain.credits<=0
          ||cardEffects.taskConditionMet(task,p,context)
          ||!cardEffects.taskConditionMet({...task,condition:{...task.condition,count:count-1}},p,context))return [];
        return [{cardId:card.id,taskId:task.id,score:gain.score,credits:gain.credits}];
      });
      return tasks.length===1?tasks[0]:null;
    }

    function knownPublicLandingTrace(state,player,landing){
      // Include only the printed score of an available revealed position.
      // The replacement display, hidden cargo, and task rewards are not used.
      if(!knownRootAlienIds.has("虫")||landing.endpointFacts.rewards.filter(r=>r.type==="alien_trace").length!==1
        ||!landing.endpointFacts.rewards.some(r=>r.type==="alien_trace"&&r.options.traceType==="yellow"))return null;
      const slotId=Number(Object.keys(state.aliens.aliens).find(id=>chong.isChongRevealedSlot(state.aliens,id)));
      if(!Number.isSafeInteger(slotId)||!chong.getTraceGrid(state.aliens,slotId))return null;
      let best=null;
      for(const position of chong.getPositionsForTraceType("yellow")){
        if(!chong.canPlaceChongTrace(state.aliens,slotId,"yellow",position,player).ok)continue;
        const r=chong.getTraceReward(state.aliens,"yellow",position);
        if(!r||r.pickAlienCard||r.pickCard||r.drawCards||r.dataCount||r.fossilPanel||r.chooseFossilRewardOnly
          ||Object.keys(r.gain).some(k=>k!=="score")||!(r.gain.score>0))continue;
        if(!best||r.gain.score>best.score)best={slotId,position,score:r.gain.score};
      }
      return best;
    }

    function fixedResearchTransportValue(source,known,probeId,alreadyAdvanced=false,comparison=false) {
      // Future action selection is fixed before applying any rule preview.
      const next=structuredClone(source),p=next.players.players.find(q=>q.id===seatId);
      if(!alreadyAdvanced){
        const transition=turnFlow.advanceTurnAfterPlayerAction(next,seatId);
        if(!transition.turnAdvanced||transition.roundAdvanced||transition.gameEnded||transition.nextPlayerId!==seatId)return null;
        p.mainActionCompleted=false;
      }
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
      const route=publicHeldTransport(next,probeId,q,{priceKnownYellow:true,priceLandingTask:goal.heldPayments});
      if(!route)return null;
      const score=endScoring.computePlayerFinalScore({...next,players:next.players.players,cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},q).totalScore;
      const w=stateValue.DEFAULT_WEIGHTS,competing=resourceDemand.planningCapital(next,q);
      const value=stateValue.sumValueParts([score,stateValue.technologyCapital(q.techState,3),Math.max(competing,route.value),
        ...Object.keys(w).map(k=>(q.resources[k]+q.income[k])*w[k])]);
      return {value,route,blueCashSlot:goal.blueSlot,...(comparison?{competing}: {})};
    }

    const transportPreparationByRoot=new WeakMap();
    function transportPreparationPurpose(root=openedRoot){
      const stored=nodes.get(root);
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||!knownRootAlienIds.has("虫"))return null;
      if(transportPreparationByRoot.has(root))return transportPreparationByRoot.get(root);
      const purpose=computeTransportPreparationPurpose(root,stored);
      transportPreparationByRoot.set(root,purpose);
      return purpose;
    }

    function computeTransportPreparationPurpose(root,stored){
      const session=stored.envelope.session?.session,head=session?.queue?.[0];
      const start=session?.journal?.actions?.[0]?.action,swapPending=head?.type==="residual_company_decision"
        &&start?.family==="industry"&&start.target?.abilityId==="deepspace_swap_cards"
        &&["swap_hand","swap_public"].includes(head.payload.step);
      if(session&&(session.queue.length!==1||!swapPending&&(start?.family!=="place_data"
        ||head.type!==scienceSession.EFFECT_TYPES.PLACE_DATA
          &&!(head.type===scienceSession.EFFECT_TYPES.PICK_CARD&&head.payload?.blueBonusSource))))return null;
      const state=session?.baseState||readPlanningState(stored);
      if(root.legalActions.some(a=>a.family==="complete_task"))return null;
      const preview=previewTransportPreparation(state,knownRootCardIds,{head,swapPending});
      if(!preview)return null;
      const step=resourceStep(root,preview.goal);
      if(step.kind!=="fixed")return null;
      const plan={id:preview.goal.id,goal:preview.goal,operation:{},firstActionId:step.actionId,mode:"greedy",reason:step.reason};
      return {...preview,plan};
    }

    function previewTransportPreparation(state,known,{head,swapPending=false,comparison=false}={}){
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      const count=data.listComputerPlacedTokens(p).length,stock=count+p.resources.availableData;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||!p.mainActionCompleted||p.passCompletionPending
        ||t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))||t.cardTurnEventBonuses?.length
        ||p.resources.credits||p.resources.energy||![4,5].includes(count)||![6,7].includes(stock)
        ||p.resources.availableData!==p.dataState.poolTokens.length
        ||techResolver.getResearchPublicityCost(p)-p.resources.publicity!==2
        ||!p.hand.every(c=>known.has(c.id))
        ||!p.hand.some(c=>cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil"))
        ||!hasPostMainInertReservations(state,true,true,true))return null;
      const probes=state.pieces.rockets.filter(q=>q.playerId===seatId&&q.surface==="solar-board"&&!q.fossilId);
      if(probes.length!==1||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length)return null;
      const isKnownPayment=c=>{
        if(!c||!known.has(c.id))return false;
        const reward=cards.getDiscardActionMoveRewardForCard(c);
        return !c.set?.startsWith("alien:")&&reward?.movementPoints===1&&!Object.keys(reward.gain).length;
      };
      const index=state.cards.publicCards.findIndex(isKnownPayment),held=p.hand.filter(isKnownPayment);
      let card=state.cards.publicCards[index],blueSlot=null,swapOutId=null;
      const heldPayments=stock===6&&!swapPending&&!held.length&&p.industryRoundMarkRound===t.roundNumber
        &&head?.type!==scienceSession.EFFECT_TYPES.PICK_CARD&&retainedScoredTransportPayer(p.hand);
      if(heldPayments)card=heldPayments;
      else if(stock===7){
        if(swapPending||!card||held.length)return null;
        const ready=data.listBluePlacementRequirements(p).filter(r=>data.getRequiredComputerSlotForBlueBonus(r.blueSlot)<=count
          &&data.getBlueBonusPlacementReward(p,r.blueSlot)?.type==="choose_card");
        if(ready.length!==1)return null;
        blueSlot=ready[0].blueSlot;
      }else if(held.length===1&&count===4&&!swapPending&&head?.type!==scienceSession.EFFECT_TYPES.PICK_CARD)card=held[0];
      else {
        if(!card||held.length||p.industryRoundMarkRound===t.roundNumber||head?.type===scienceSession.EFFECT_TYPES.PICK_CARD
          ||industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId!=="deepspace_swap_cards")return null;
        const pure=p.hand.filter(c=>{
          const reward=cards.getDiscardActionRewardForCard(c);
          return reward?.gain?.publicity===1&&Object.keys(reward.gain).length===1&&!reward.dataCount;
        });
        if(pure.length!==2)return null;
        // Both publicity corners would fund the same single point. Keep
        // the electric income option until the actual research payment.
        pure.sort((a,b)=>(cards.getIncomeGainForCard(a)?.energy||0)-(cards.getIncomeGainForCard(b)?.energy||0)||a.id.localeCompare(b.id));
        swapOutId=pure[0].id;
        if(swapPending&&head.payload.step==="swap_public"&&head.payload.handCardInstanceId!==swapOutId)return null;
      }
      const projected=structuredClone(state),after=projected.players.players.find(q=>q.id===seatId);
      if(swapOutId){
        const outgoing=after.hand.findIndex(c=>c.id===swapOutId),received=projected.cards.publicCards[index];
        const sent=after.hand[outgoing];
        if(outgoing<0||received?.id!==card.id)return null;
        after.hand[outgoing]=received;
        projected.cards.publicCards[index]=sent;
        after.industryRoundMarkRound=t.roundNumber;
        after.industryRoundMarkTurn=t.turnNumber;
      }
      if(count===4){
        if(head?.type===scienceSession.EFFECT_TYPES.PICK_CARD)return null;
        const comp=data.placeDataToComputer(after);
        if(!comp.ok||comp.placementSlot!==5||comp.slotBonuses?.length
          ||cardEffects.collectMatchingTriggers(after,{type:"placeData",playerId:seatId,placementKind:"computer",placementSlot:5}).length)return null;
      }
      if(blueSlot!==null){
        const blue=data.placeDataToComputer(after,{target:"blueBonus",blueSlot});
        if(!blue.ok||blue.slotBonuses?.length!==1||blue.slotBonuses[0].type!=="choose_card"
          ||cardEffects.collectMatchingTriggers(after,{type:"placeData",playerId:seatId,placementKind:"blueBonus",blueSlot}).length)return null;
        after.hand.push(structuredClone(card));
        after.resources.handSize=after.hand.length;
        projected.cards.publicCards[index]=null;
        projected.cards.unknownPublicSlotIndices=[...new Set([...(projected.cards.unknownPublicSlotIndices||[]),index])];
        projected.cards.drawPileCardIds=new Array(Math.max(0,projected.cards.drawPileCardIds.length-1)).fill(null);
      }
      if(after.resources.availableData!==1)return null;
      const quiet=localPlans.quietEndCompletion({state:projected,seatId});
      if(!quiet.available||quiet.netGain!==0||quiet.markedTiles.length)return null;
      const quote=fixedResearchTransportValue(projected,known,probes[0].id,false,comparison);
      if(!quote)return null;
      const goal={id:"data:known-transport-payment:"+(blueSlot??(swapOutId?"company":heldPayments?"held-scored":"held")),kind:"transport-data-prep",blueSlot,cardId:card.id,
        ...(swapOutId?{swapOutId,swapPublicSlot:index}:{}),required:{}};
      return {goal,quote,after,turn:t.turnNumber,probe:probes[0],rotation:state.solarSystem.rotation};
    }

    const upstreamTransportRoots=new WeakMap();
    function upstreamTransportSource(){
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||!knownRootAlienIds.has("虫"))return null;
      if(upstreamTransportRoots.has(openedRoot))return upstreamTransportRoots.get(openedRoot);
      const stored=nodes.get(openedRoot),session=stored.envelope.session?.session;
      const ready=session
        ?session.queue?.[0]?.type===scienceSession.EFFECT_TYPES.RESEARCH&&session.journal?.actions?.[0]?.action?.family==="research_tech"
        :openedRoot.legalActions.some(a=>a.family==="research_tech");
      const source=ready&&readPlanningState(stored);
      const p=source&&source.players.players.find(q=>q.id===seatId),t=source?.turn;
      const heldPayments=p&&p.industryRoundMarkRound===t.roundNumber
        &&p.hand.every(c=>knownRootCardIds.has(c.id))&&retainedScoredTransportPayer(p.hand);
      const eligible=p&&t.roundNumber===3&&t.currentPlayerId===seatId&&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        &&!t.cardTurnEventBonuses?.length&&!p.mainActionCompleted&&!p.passCompletionPending&&!p.resources.credits&&!p.resources.energy
        &&p.resources.availableData===2&&p.dataState.poolTokens.length===2&&data.listComputerPlacedTokens(p).length===4
        &&(heldPayments||p.industryRoundMarkRound!==t.roundNumber)
        &&industryCatalog.getPlayerIndustryDefinition(p)?.activeAbilityId==="deepspace_swap_cards"
        &&!source.pieces.rockets.some(r=>r.playerId===seatId&&r.surface==="solar-board")
        &&p.hand.some(c=>knownRootCardIds.has(c.id)&&cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="chong_pickup_fossil"));
      const value=eligible?{source,p,turn:t.turnNumber,heldPayments}:null;
      upstreamTransportRoots.set(openedRoot,value);
      return value;
    }

    function upstreamTransportState(state,advanced){
      const root=upstreamTransportSource();
      if(!root)return null;
      const t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.turnNumber!==root.turn+Number(advanced)||t.currentPlayerId!==seatId
        ||p.mainActionCompleted===advanced||p.passCompletionPending||p.resources.credits||p.resources.energy
        ||p.resources.availableData!==(advanced?1:2)||p.dataState.poolTokens.length!==p.resources.availableData
        ||data.listComputerPlacedTokens(p).length!==(advanced?5:4)||t.cardTurnEventBonuses?.length
        ||!hasPostMainInertReservations(state,true,true,true)||Object.keys(state.aliens.chong?.transportTasksByRocketId||{}).length
        ||p.hand.some(c=>!knownRootCardIds.has(c.id)))return null;
      const tiles=Object.keys(p.techState.ownedTiles).filter(id=>!root.p.techState.ownedTiles[id]);
      const probes=state.pieces.rockets.filter(r=>r.playerId===seatId&&r.surface==="solar-board"&&!r.fossilId);
      if(tiles.length!==1||state.tech.stacks[tiles[0]]?.techType!=="orange"||probes.length!==1
        ||p.hand.length!==root.p.hand.length+1)return null;
      const gained=p.hand.filter(c=>!root.p.hand.some(old=>c.id===old.id));
      const lost=root.p.hand.filter(c=>!p.hand.some(now=>c.id===now.id));
      const originalSlot=c=>root.source.cards.publicCards.findIndex(old=>old?.id===c.id);
      if(!advanced||root.heldPayments){
        if(p.industryRoundMarkRound!==root.p.industryRoundMarkRound
          ||root.heldPayments&&p.industryRoundMarkTurn!==root.p.industryRoundMarkTurn
          ||gained.length!==1||lost.length||originalSlot(gained[0])<0)return null;
        return {p,probe:probes[0],...(root.heldPayments?{payer:root.heldPayments}:{})};
      }
      if(p.industryRoundMarkRound!==3||p.industryRoundMarkTurn!==root.turn||gained.length!==2||lost.length!==1
        ||gained.some(c=>originalSlot(c)<0))return null;
      const payer=gained.find(c=>state.cards.publicCards[originalSlot(c)]?.id===lost[0].id);
      if(!payer)return null;
      const move=cards.getDiscardActionMoveRewardForCard(payer);
      if(!move||move.movementPoints!==1||Object.keys(move.gain).length)return null;
      return {p,probe:probes[0],payer,swapOut:lost[0]};
    }

    function displayedTransportPurpose(){
      if(!resourcePlanning||!cardPickPlanning||!movementPlanning||!knownRootAlienIds.has("虫")
        ||!Number.isSafeInteger(knownChongDisplayIndex))return null;
      const root=openedRoot,stored=nodes.get(root),state=readPlanningState(stored),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      const transport=chong.getCardDefinition?.(knownChongDisplayIndex);
      const model=transport&&cardEffects.getCardModel({cardId:transport.cardId,set:"alien:虫"});
      if(!model?.playEffects?.some(e=>e.type==="chong_pickup_fossil")||model.playEffects[0].type!=="card_move")return null;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||p.passCompletionPending
        ||p.industryRoundMarkRound===3||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||state.pieces.rockets.some(r=>r.playerId===seatId&&r.surface==="solar-board")
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        ||p.techState.ownedTiles.orange1||state.tech.stacks.orange1?.bonusId!=="bonus_1c"
        ||stored.envelope.session?.session?.queue?.[0]?.type!==scienceSession.EFFECT_TYPES.SCAN_STEP
          &&!root.legalActions.some(a=>a.family==="scan"||a.target?.traceType==="pink"
            ||a.target?.kind==="residual-domain"&&a.target.choiceId===`chong:display:${knownChongDisplayIndex}`))return null;
      return {turn:t.turnNumber,display:knownChongDisplayIndex};
    }

    function displayedTransportCard(stored,purpose){
      const envelope=stored.envelope;
      if(!cardKnowledgeKey(envelope))return null;
      const known=knownCards(envelope),state=readIdentityState(envelope);
      return state.players.players.find(q=>q.id===seatId).hand.find(c=>
        known.has(c.id)&&!knownRootCardIds.has(c.id)&&c.chongCard&&c.alienCardId===purpose.display)||null;
    }

    function displayedTransportTailRelevant(node,purpose){
      // These exact quiet tails cannot create a new alien-card acquisition.
      return Boolean(displayedTransportCard(nodes.get(node),purpose));
    }

    function quoteDisplayedTransport(node,purpose,baseValue){
      const synthetic=node.status==="turn-tail-value";
      if(synthetic){
        const tail=node.planSummary;
        if(tail.kind!=="end-turn"||tail.netGain!==0||tail.requiredNativeInputs!==1||tail.markedTiles.length)return null;
      }else if(!["information-barrier","turn-boundary"].includes(node.status))return null;
      const stored=nodes.get(synthetic?nodes.get(node).turnTailBase:node);
      if(!stored?.envelope||stored.envelope.session||stored.intent)return null;
      const acquired=displayedTransportCard(stored,purpose);
      if(!acquired)return null;
      const state=readPlanningState(stored),t=state.turn,p=state.players.players.find(q=>q.id===seatId),known=knownCards(stored.envelope);
      if(!p.hand.some(c=>c.id===acquired.id)||t.roundNumber!==3||t.turnNumber!==purpose.turn+Number(!synthetic)
        ||t.currentPlayerId!==seatId||p.mainActionCompleted!==synthetic||p.passCompletionPending
        ||p.resources.credits||p.resources.energy||p.resources.availableData!==2||p.dataState.poolTokens.length!==2
        ||p.resources.publicity!==techResolver.getResearchPublicityCost(p)*2-2||data.listComputerPlacedTokens(p).length!==4
        ||p.industryRoundMarkRound===3||!p.hand.every(c=>known.has(c.id))||t.cardTurnEventBonuses?.length
        ||state.pieces.rockets.some(r=>r.playerId===seatId&&r.surface==="solar-board")
        ||!hasPostMainInertReservations(state,false,true,true))return null;
      const market=state.cards.publicCards;
      const offers=market.filter(c=>{
        if(!c||!knownRootCardIds.has(c.id))return false;
        const r=cards.getDiscardActionRewardForCard(c);
        return r?.gain?.publicity===1&&Object.keys(r.gain).length===1&&!r.dataCount;
      });
      if(offers.length!==1||!state.cards.drawPileCardIds.length)return null;
      const s=structuredClone(state),owner=s.players.players.find(q=>q.id===seatId);
      if(synthetic){
        const next=turnFlow.advanceTurnAfterPlayerAction(s,seatId);
        if(!next.turnAdvanced||next.roundAdvanced||next.gameEnded||next.nextPlayerId!==seatId)return null;
        owner.mainActionCompleted=false;
      }
      const supply=s.tech.stacks.orange1,options={skipRotate:true};
      if(supply.bonusHidden||supply.bonusId!=="bonus_1c"||supply.bonusIndex!==knownRootTechIndices.get("orange1"))return null;
      supply.bonusQueue=supply.bonusQueue.map((id,i)=>i===supply.bonusIndex?id:null);
      const rotated=techResolver.rotateForResearch(scienceSession.createActionContext(s,seatId),1);
      if(!rotated.ok||rotated.events.length)return null;
      const choice=scienceSession.listResearchChoices(s,seatId,options).find(a=>a.target.tileId==="orange1");
      const research=choice&&scienceSession.executeResearchChoice(s,seatId,choice,options);
      if(!research?.ok||!research.awaitingCardSelection||research.events.length!==1
        ||cardEffects.collectMatchingTriggers(owner,research.events[0]).length)return null;
      const launch=rocketAbilities.launchProbe(scienceSession.createActionContext(s,seatId),{skipCost:true,source:"tech"});
      if(!launch.ok||launch.events.length!==1||cardEffects.collectMatchingTriggers(owner,launch.events[0]).length)return null;
      owner.mainActionCompleted=true;
      const index=market.indexOf(offers[0]);
      owner.hand.push(s.cards.publicCards[index]);owner.resources.handSize=owner.hand.length;
      s.cards.publicCards[index]=null;
      s.cards.unknownPublicSlotIndices=[...(s.cards.unknownPublicSlotIndices||[]),index];
      s.cards.drawPileCardIds=new Array(s.cards.drawPileCardIds.length-1).fill(null);
      const prep=previewTransportPreparation(s,known,{comparison:true});
      if(!prep?.goal.swapOutId||!prep.quote.route.knownYellowTrace)return null;
      const competing=Math.max(resourceDemand.planningCapital(state,p),prep.quote.competing);
      const additional=stateValue.sumValueParts([prep.quote.route.value,-competing]);
      const gain=Math.min(additional,stateValue.sumValueParts([prep.quote.value,-baseValue]));
      return gain>0?{gain,competing,upperValue:prep.quote.value,route:prep.quote.route,cardId:acquired.id,
        rewardCardId:offers[0].id,paymentCardId:prep.goal.cardId}:null;
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
      if(!purpose){
        if(synthetic)return null;
        const completed=upstreamTransportState(state,true);
        if(!completed)return null;
        const quote=fixedResearchTransportValue(state,knownRootCardIds,completed.probe.id,true);
        return quote&&{...quote,bluePickSlot:null,...(completed.swapOut
          ?{publicPaymentCard:completed.payer.id,swapOutId:completed.swapOut.id}
          :{heldPaymentCard:completed.payer.id})};
      }
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.turnNumber!==purpose.turn+Number(!synthetic)
        ||p.mainActionCompleted!==synthetic||JSON.stringify(p.resources)!==JSON.stringify(purpose.after.resources)
        ||JSON.stringify(p.techState)!==JSON.stringify(purpose.after.techState)
        ||p.hand.length!==purpose.after.hand.length||p.hand.some((c,i)=>c.id!==purpose.after.hand[i].id)
        ||JSON.stringify(p.dataState)!==JSON.stringify(purpose.after.dataState)
        ||JSON.stringify(state.solarSystem.rotation)!==JSON.stringify(purpose.rotation)
        ||!state.pieces.rockets.some(r=>r.id===purpose.probe.id&&r.sectorX===purpose.probe.sectorX&&r.sectorY===purpose.probe.sectorY))return null;
      const goal=purpose.plan.goal;
      if(goal.swapOutId&&(state.cards.publicCards[goal.swapPublicSlot]?.id!==goal.swapOutId
        ||p.industryRoundMarkRound!==purpose.after.industryRoundMarkRound||p.industryRoundMarkTurn!==purpose.after.industryRoundMarkTurn))return null;
      return {...purpose.quote,publicPaymentCard:goal.cardId,bluePickSlot:goal.blueSlot,...(goal.swapOutId?{swapOutId:goal.swapOutId}:{})};
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

    function publicRegionComputerPreparation(state,known){
      const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      if(t.roundNumber!==3||p.mainActionCompleted||p.passCompletionPending||p.resources.credits!==0
        ||p.resources.energy!==1||p.hand.length!==4
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
        ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id))
        ||!knownRootAlienIds.has("阿米巴")||!knownRootAlienIds.has("虫")
        ||t.cardTurnEventBonuses?.length)return null;
      const goal={id:"data:region-with-analysis-ready:6",kind:"computer-prefix",targetComputerSlot:6,required:{}};
      const slots=data.listComputerPlacedTokens(p).length;
      if(slots<4||slots>=6||p.resources.availableData+slots!==8
        ||!resourceDemand.capacity(state,seatId,goal))return null;
      const q={...p,resources:{...p.resources},dataState:structuredClone(p.dataState)};
      for(let i=slots+1;i<=6;i++){
        const r=data.placeDataToComputer(q);
        if(!r.ok||r.placementSlot!==i||r.slotBonuses?.length
          ||cardEffects.collectMatchingTriggers(p,{type:"placeData",playerId:seatId,
            placementKind:"computer",placementSlot:i}).length)return null;
      }
      const choices=p.hand.filter(c=>known.has(c.id)&&c.set==="alien:阿米巴"
        &&!Object.keys(cardEffects.getCardPlayCost(c)).length
        &&cardEffects.buildPlayEffects(c).some(e=>e.type===aliens.amiba.EFFECT_TYPES.REMOVE_TRACE_FOR_REGION_REWARD));
      if(choices.length!==1)return null;
      const visible=structuredClone(state.aliens),slot=visible.amiba?.revealedSlotId;
      if(!slot)return null;
      let nextSequence=state.meta.sequences.alienEntity;
      aliens.amiba.migrateLegacyTraces(visible,slot,{takeSequence:()=>nextSequence++});
      if(!aliens.amiba.listPlayerTraceOptions(visible,slot,p).length)return null;
      return {...goal,kind:"play_card",cardId:choices[0].id};
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

    function canDeferCompanyIncomeForScan(node,swap) {
      const stored=nodes.get(node);
      if(node!==openedRoot||node.status!=="stable"||!stored?.envelope||stored.informationBarrier
        ||swap?.goal?.kind!=="known-income-swap"||swap.selection?.blind!==false||swap.discardIds?.length!==1)return false;
      const state=readIdentityState(stored.envelope),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||!p.mainActionCompleted||p.passCompletionPending
        ||p.industryRoundMarkRound===t.roundNumber||p.hand.length!==1||p.hand[0].id!==swap.discardIds[0]
        ||p.resources.availableData!==3||data.listComputerPlacedTokens(p).length!==3
        ||state.pieces.rockets.some(r=>r.playerId===seatId)||node.legalActions.some(a=>a.family==="complete_task")
        ||!t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id)))return false;
      const offer=state.cards.publicCards.find(c=>c?.id===swap.selection.cardId);
      const gain=offer&&cards.getIncomeGainForCard(offer);
      if(!gain||Object.keys(gain).length!==1||gain.energy!==1||!knownRootCardIds.has(offer.id))return false;
      const cost=scanEffects.getStandardScanCost(p),types=scanEffects.EFFECT_TYPES,
        queue=scanEffects.buildScanEffectQueue(p,{fullScanAction:true,turn:t});
      if(p.resources.credits<(cost.credits||0)||p.resources.energy<(cost.energy||0)+scanEffects.SCAN_ACTION_4_LAUNCH_ENERGY
        ||queue.length!==4||queue[1].type!==types.PUBLIC_CARD_SCAN||queue[2].type!==types.SCAN_ACTION_4
        ||queue[3].type!==types.MERCURY_SECTOR_SCAN||!players.canAfford(p,queue[3].options?.cost||{}))return false;
      const next=previewTurn(state);
      return next.turnAdvanced&&!next.roundAdvanced&&!next.gameEnded&&next.nextPlayerId===seatId;
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

    function fundedScanAnalysisSource(){
      const stored=nodes.get(openedRoot);
      return Boolean(openedRoot?.status==="stable"&&!stored?.envelope.session
        &&openedRoot.legalActions.some(a=>a.family==="scan")&&localPlans.fundedScanAnalysisSource(readPlanningState(stored),seatId));
    }

    function quoteFundedScanAnalysis(node){
      if(node.status!=="turn-tail-value"||node.planSummary.kind!=="data-end-turn"||node.planSummary.markedTiles.length)return null;
      const stored=nodes.get(nodes.get(node).turnTailBase);
      if(!stored?.envelope||stored.envelope.session)return null;
      return localPlans.quoteFundedScanAnalysis(readPlanningState(stored),seatId,node.planSummary.dataPlans,knownRootCardIds);
    }

    function heldScanSectorTieSource(){
      const stored=nodes.get(openedRoot),s=stored?.envelope.session?.session;
      const head=s?.queue[0];
      if(s?.phase!=="awaiting_input"||s.journal.actions[0]?.action.family!=="scan"||s.journal.decisions.length
        ||s.irreversibleBarrier||s.interruptContext||head?.type!==scienceSession.EFFECT_TYPES.SCAN_STEP
        ||head.payload.options?.mode!=="specified")return null;
      const state=readIdentityState(stored.envelope),t=state.turn;
      if(!resourcePlanning||!scanPlanning||t?.roundNumber!==3||t.currentPlayerId!==seatId
        ||t.activePlayerCount!==4||t.passedPlayerIds.length!==3||t.passedPlayerIds.includes(seatId)
        ||t.cardTurnEventBonuses?.length
        ||!Object.values(state.aliens.aliens).every(slot=>slot.revealed))return null;
      const p=state.players.players.find(q=>q.id===seatId),card=p.hand.find(c=>c.cardId==="b_9.webp"
        &&knownRootCardIds.has(c.id));
      if(!card||p.industryBorrowedTechTileId)return null;
      const cost=cardEffects.getCardPlayCost(card),effects=cardEffects.buildPlayEffects(card),types=scanEffects.EFFECT_TYPES;
      if(Object.keys(cost).length!==1||cost.credits!==3||effects.length!==2
        ||effects[0].type!=="card_scan_action"||effects[0].options?.skipCost!==true
        ||(effects[0].options.repeat??1)!==1||Object.keys(effects[0].options).some(k=>!["skipCost","repeat"].includes(k))
        ||effects[1].type!=="card_any_sector_scan"||effects[1].options?.gainData!==true
        ||Object.keys(effects[1].options).length!==1
        ||p.income.credits<cost.credits
        ||scanEffects.buildScanEffectQueue(p,{turn:t}).map(e=>e.type).join(",")!==
          [types.IMPROVED_SECTOR_SCAN,types.PUBLIC_CARD_SCAN,types.SCAN_ACTION_4].join(","))return null;
      const choices=root=>scienceSession.listNebulaChoices(root,
        scienceSession.getPlanetScanSource(root,types.IMPROVED_SECTOR_SCAN)).map(a=>a.target.nebulaId);
      // The current round has already rotated. Before the next own main
      // action either zero or one rotation has occurred because of the new round's
      // first PASS rotation. Require the same target in both menus.
      const rotated={...state,solarSystem:{...state.solarSystem,
        rotation:solar.applySolarOrbitRotation(state.solarSystem.rotation,1)}};
      const after=choices(rotated);
      const open=(root,id)=>data.listNebulaTokens(root.data,id).filter(x=>!x.replacedByPlayerId&&!x.replacedByPlayerColor);
      const sectors=choices(state).filter(id=>id!==data.AOMOMO_NEBULA_ID&&after.includes(id)&&open(state,id).length===3);
      return sectors.length?{cardId:card.id,credits:cost.credits,sectors}:null;
    }

    function heldScanSectorTie(node,sectorId,proof){
      if(!proof.sectors.includes(sectorId))return null;
      const stored=nodes.get(node);
      if(!stored||stored.envelope.session||node.status!=="stable")return null;
      const state=readIdentityState(stored.envelope),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||!p.mainActionCompleted||p.passCompletionPending
        ||t.cardTurnEventBonuses?.length||p.income.credits<proof.credits
        ||p.hand.length>probeTurnSession.PASS_HAND_LIMIT||!p.hand.some(c=>c.id===proof.cardId)
        ||p.reservedCards.some(c=>!knownRootCardIds.has(c.id)||!cardEffects.getCardModel(c)
          ||cardEffects.getCardModel(c).triggers?.length))return null;
      const tokens=data.listNebulaTokens(state.data,sectorId);
      const empty=tokens.filter(x=>!x.replacedByPlayerId&&!x.replacedByPlayerColor).length;
      const owned=tokens.filter(x=>x.replacedByPlayerId===seatId).length;
      if(empty!==2||owned+empty<=tokens.length/2)return null;
      // One already-known public card can discharge the mandatory public
      // scan elsewhere, without settling that other sector. The optional
      // public repeat and Purple 4 step can be skipped. No reward is priced.
      const publicCards=state.cards.publicCards.map(c=>c&&knownRootCardIds.has(c.id)?c:null);
      const known={...state,cards:{...state.cards,publicCards}};
      const side=scienceSession.listScanStepChoices(known,p,{mode:"public",selected:0,max:1}).find(a=>
        a.target.nebulaId&&a.target.nebulaId!==sectorId&&a.target.nebulaId!==data.AOMOMO_NEBULA_ID
        &&data.listNebulaTokens(state.data,a.target.nebulaId).filter(x=>!x.replacedByPlayerId&&!x.replacedByPlayerColor).length>1);
      return side?{sectorId,cardId:proof.cardId,publicCardId:side.target.cardInstanceId,empty,owned}:null;
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
      const computer=visible?.dataProgress?.computerSlots.length;
      const unpaid=visible?.credits===0&&[4,5,6].includes(computer)&&visible.availableData===7-computer
        &&visible.handCount>=3&&visible.handCount<=5;
      if(visible?.energy===0&&(paid&&computer===6||unpaid)){
        const source=session?.baseState?planningState(session.baseState,root.informationBarrier,knownRootCardIds):readPlanningState(root);
        const p=source.players.players.find(q=>q.id===seatId),t=source.turn;
        const qualifies=t.roundNumber===3&&(!paid||p.mainActionCompleted)&&!p.passCompletionPending
          &&(computer===6||p.techState.ownedTiles.orange1&&p.industryRoundMarkRound!==t.roundNumber
            &&data.listBlueBonusPlacedTokens(p).length===2&&localPlans.knownBlueCashOffers(source,knownRootCardIds).length===2)
          &&hasOwnVisitSource(source)&&hasPostMainInertReservations(source,true,true,true)
          &&industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes('deepspace_free_analyze')
          &&t.activePlayerIds.every(id=>id===seatId||t.passedPlayerIds.includes(id));
        const held=qualifies&&p.hand.filter(c=>knownRootCardIds.has(c.id)&&localPlans.blueCashCard(c));
        if(held?.length===1)return {turn:t.turnNumber,cardId:held[0].id};
      }
    }
    // A blind region draw may still leave a payable plan made entirely
    // from the old hand, public tech and the currently displayed alien.
    function retainedRegionIncomeSource(stored, session, offers) {
      const a=session?.journal.actions[0]?.action;
      if(session ? !["play_card","place_data"].includes(a?.family) : !openedRoot.legalActions.some(a=>a.family==="play_card"))return null;
      const state=session?planningState(session.baseState,stored.informationBarrier,knownRootCardIds):readPlanningState(stored);
      const p=state.players.players.find(q=>q.id===seatId),turn=state.turn;
      const computer=data.listComputerPlacedTokens(p).length;
      const prepared=p.resources.availableData===2&&computer===6;
      if((!prepared||a?.family==="place_data")&&!publicRegionComputerPreparation(state,knownRootCardIds))return null;
      if(turn.roundNumber!==3||p.mainActionCompleted||p.passCompletionPending
        ||turn.activePlayerIds.some(id=>id!==seatId&&!turn.passedPlayerIds.includes(id))
        ||p.resources.credits!==0||p.resources.energy!==1||p.hand.length!==4
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        ||!hasPostMainInertReservations(state,false,true,true))return null;
      const removal=p.hand.find(c=>(a?.family==="play_card"?c.id===a.target.cardInstanceId:knownRootCardIds.has(c.id))
        &&cardEffects.getCardModel(c)?.playEffects?.some(e=>e.type==="amiba_remove_trace_for_region_reward"));
      if(!removal)return null;
      return {regionIncome:{turn:turn.turnNumber,retained:p.hand.filter(c=>c!==removal).map(c=>c.id),
        removal:removal.id,amibaOffer:offers.amibaTraces.displayedCardIndex,chongOffer:offers.chongOffer}};
    }

    function quoteRetainedRegionIncome(node,purpose){
      if(node.status!=="information-barrier")return null;
      const stored=nodes.get(node);
      if(stored?.informationBarrier?.code!=="hidden_card_draw"||stored.envelope.session||stored.intent)return null;
      const state=readPlanningState(stored),turn=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(turn.turnNumber!==purpose.turn||!p.mainActionCompleted||p.resources.availableData!==3
        ||p.hand.some(c=>c.id===purpose.removal)||p.hand.filter(c=>c.hidden&&!c.id&&!c.cardId).length!==1
        ||purpose.retained.some(id=>!p.hand.some(c=>c.id===id))||!hasPostMainInertReservations(state,false,true,true))return null;
      const plan=localPlans.previewMatchedAnalysisScan({state,seatId,knownCards:knownRootCardIds,retainedRegion:true,
        amibaOffer:purpose.amibaOffer,chongOffer:purpose.chongOffer,
        knownTech:(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id))});
      return plan&&{order:"retained-region-income",value:plan.funding.value,originValue:plan.originValue,
        tileId:plan.tileId,analysis:plan.funding.analysis,income:plan.funding.dataIncome,scan:plan.funding.sector};
    }

    function matchedAnalysisScanSource(){
      const stored=nodes.get(openedRoot),session=stored?.envelope.session?.session;
      if(!stored||!['stable','decision'].includes(openedRoot.status))return null;
      const visible=rootObservation.publicState;
      const offers=visible.board?.aliens,amibaOffer=offers?.amibaTraces?.displayedCardIndex,chongOffer=offers?.chongOffer;
      if(visible.roundNumber!==3||!Number.isSafeInteger(amibaOffer)||!Number.isSafeInteger(chongOffer?.displayedCardIndex))return null;
      const retained=retainedRegionIncomeSource(stored,session,offers);
      if(retained)return retained;
      const state=session?(['analyze','research_tech'].includes(session.journal?.actions?.[0]?.action.family)
        ?planningState(session.baseState,stored.informationBarrier,knownRootCardIds):null):readPlanningState(stored);
      if(!state||!hasPostMainInertReservations(state,false,true,true))return null;
      const proof=localPlans.previewMatchedAnalysisScan({state,seatId,knownCards:knownRootCardIds,amibaOffer,chongOffer,
        knownTech:(id,stack)=>Boolean(stack&&!stack.bonusHidden&&stack.bonusIndex===knownRootTechIndices.get(id))});
      if(!proof)return null;
      const rows=Object.entries({analysis:proof.analysis,research:proof.research,scan:proof.scan}).filter(([,r])=>r)
        .map(([order,r])=>({order,first:r.first,value:r.value,scope:{tileId:proof.tileId,task:proof.task,
          sector:r.sector,analysis:r.analysis,income:r.dataIncome}}));
      return {turn:state.turn.turnNumber,rows};
    }

    function matchAnalysisScanStage(node,purpose,advanced=false,blueGoal=null){
      const stored=nodes.get(node);
      if(!stored?.envelope||stored.envelope.session||stored.intent)return null;
      let state=readPlanningState(stored);const p=state.players.players.find(q=>q.id===seatId),t=state.turn;
      const deferredTask=purpose.rows.find(r=>r.order==='scan').scope.task;
      if(t.roundNumber!==3||t.currentPlayerId!==seatId||t.turnNumber!==purpose.turn+Number(advanced)||p.mainActionCompleted===advanced
        ||t.cardTurnEventBonuses?.length||hasOwnVisitSource(state)
        ||!hasPostMainInertReservations(state,false,true,true,deferredTask))return null;
      if(blueGoal){
        const preview=localPlans.previewBlueCompletion({state,seatId,goal:blueGoal});
        if(!preview.available||preview.computerPlacements||preview.incomeCardId||preview.dataCornerId)return null;
        state={...state,players:{...state.players,players:state.players.players.map(v=>v===p?preview.player:v)}};
      }
      const signature=localPlans.matchedAnalysisScanSignature(state,seatId,knownRootCardIds);
      return purpose.rows.find(r=>r.first===signature)||null;
    }

    function matchedAnalysisScanEnd(node,purpose){
      if(purpose.regionIncome)return null;
      const end=node.status==='stable'&&node.legalActions.find(a=>a.family==='end_turn');
      return end&&matchAnalysisScanStage(node,purpose)?end.actionId:null;
    }

    function quoteMatchedAnalysisScan(node,purpose){
      if(purpose.regionIncome)return quoteRetainedRegionIncome(node,purpose.regionIncome);
      const tail=node.status==='turn-tail-value'?node.planSummary:null;
      if(!tail&&node.status!=='turn-boundary'||tail?.markedTiles.length)return null;
      const blue=tail?.kind==='blue-end-turn'&&tail.requiredNativeInputs===3&&tail.dataPlans?.length===1
        &&tail.dataPlans[0].goal?.kind==='blue-data'?tail.dataPlans[0].goal:null;
      if(tail&&!blue&&(tail.kind!=='end-turn'||tail.netGain))return null;
      const proved=matchAnalysisScanStage(tail?nodes.get(node).turnTailBase:node,purpose,!tail,blue);
      return proved?{order:proved.order,value:proved.value,...proved.scope}:null;
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

    // Compare the real settled wallets, before their proved quiet end turns.
    // This ranks two already complete plans; it neither opens nor removes one.
    function sameElectricityIncomeTie(source, blue, income, incomeCardId, multi = false) {
      const [start, blueEnd, incomeEnd]=[source,blue,income].map(node=>nodes.get(node));
      if([start,blueEnd,incomeEnd].some(stored=>!stored?.envelope||stored.informationBarrier)
        ||blue.status!=="stable"||income.status!=="stable"||blueEnd.envelope.session||incomeEnd.envelope.session)return false;
      const state=readIdentityState(start.envelope),turn=state.turn;
      const player=state.players.players.find(p=>p.id===seatId),filled=data.listComputerPlacedTokens(player).length;
      if(turn.roundNumber!==3||turn.currentPlayerId!==seatId||!player.mainActionCompleted||player.passCompletionPending
        ||!turn.activePlayerIds?.includes(seatId)||turn.passedPlayerIds.includes(seatId)
        ||!turn.activePlayerIds.every(id=>id===seatId||turn.passedPlayerIds.includes(id))
        ||(multi?filled<1||filled>2||player.resources.availableData!==4-filled:player.resources.availableData!==1||filled!==3)
        ||player.hand.length!==1||player.hand[0].id!==incomeCardId||!knownCards(start.envelope).has(incomeCardId))return false;
      const [a,b]=[blueEnd,incomeEnd].map(stored=>readIdentityState(stored.envelope).players.players.find(p=>p.id===seatId));
      const sameExcept=(left,right,key)=>Object.keys(left).every(k=>k===key||left[k]===right[k])
        &&Object.keys(right).every(k=>k===key||left[k]===right[k]);
      return (!multi||data.listComputerPlacedTokens(a).length===3&&data.listComputerPlacedTokens(b).length===4)
        &&a.resources.energy===player.resources.energy+1&&a.resources.availableData===0
        &&sameExcept(a.resources,b.resources,"handSize")
        &&a.hand.length===1&&a.hand[0].id===incomeCardId&&b.hand.length===0
        &&sameExcept(a.income,player.income,"energy")&&a.income.energy===player.income.energy
        &&sameExcept(a.income,b.income,"energy")&&b.income.energy===a.income.energy+1;
    }

    function tiedKnownEnergySwap(source,blueEnd,incomeEnd,swap) {
      const start=nodes.get(source),ends=[blueEnd,incomeEnd].map(node=>nodes.get(node));
      if(!start?.envelope||start.envelope.session||!stationaryCargoIncomeWindow(readIdentityState(start.envelope),start,source)
        ||ends.some(end=>!end?.envelope||end.envelope.session||end.informationBarrier))return false;
      const read=end=>readIdentityState(end.envelope).players.players.find(p=>p.id===seatId);
      const [before,blue,income]=[start,...ends].map(read);
      const sameExcept=(a,b,key)=>Object.keys(a).every(k=>k===key||a[k]===b[k])
        &&Object.keys(b).every(k=>k===key||a[k]===b[k]);
      return blue.resources.energy===before.resources.energy+1&&blue.resources.availableData===0
        &&sameExcept(blue.resources,income.resources,'handSize')
        &&blue.hand.length===1&&blue.hand[0].id===swap.discardIds[0]&&income.hand.length===0
        &&sameExcept(blue.income,before.income,'energy')&&blue.income.energy===before.income.energy
        &&sameExcept(blue.income,income.income,'energy')&&income.income.energy===blue.income.energy+1
        &&data.listComputerPlacedTokens(blue).length===3&&data.listComputerPlacedTokens(income).length===4;
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

    // The default last-round evaluator has no future income or tech value.
    // Use its same Native final score and existing probe portfolio on these
    // completed leaves. Do not bypass an earned but unsettled scoring mark.
    function quietFinalValue(node){
      if(!knownRootAlienIds.has("奥陌陌")||!knownRootAlienIds.has("阿米巴")
        ||!["turn-boundary","other-owner","information-barrier"].includes(node.status))return null;
      const stored=nodes.get(node);
      if(!stored?.envelope||stored.envelope.session||stored.informationBarrier
        &&!["hidden_card_reveal","hidden_alien_card","tech_bonus_reveal"].includes(stored.informationBarrier.code))return null;
      const state=readIdentityState(stored.envelope),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.roundNumber!==4||t.gameEnded||!p||p.passCompletionPending||t.passedPlayerIds.includes(seatId)
        ||(state.passingPlayerIds||t.passedPlayerIds).includes(seatId)||state.match.initialSetup
        ||p.resources.handSize!==p.hand.length||p.reservedCards.some(c=>!knownCards(stored.envelope).has(c.id))
        ||Object.values(state.aliens.aliens).some(s=>s.revealed&&!knownRootAlienIds.has(s.alienId)))return null;
      const board=state.finalScoring,tiles=Object.values(board.tiles||{});
      if(!Number.isSafeInteger(p.resources.score)||!Array.isArray(board.thresholds)||!tiles.length
        ||!["a","b","c","d"].every(id=>board.tiles[id]?.id===id&&Array.isArray(board.tiles[id].marks))
        ||!board.tileVariants
        ||!board.thresholds.every(n=>Number.isSafeInteger(n)&&(n>p.resources.score||tiles.some(tile=>
          tile.marks?.some(m=>m.playerId===seatId&&Number(m.threshold)===n)))))return null;
      const probe=state.pieces.rockets.some(r=>r.surface==="solar-board"&&(r.kind||"standard")==="standard"&&r.fossilId==null&&r.playerId===seatId);
      const ready=probe&&readPlanningState(stored);
      const mission=probe?resourceDemand.planningCapital(ready,ready.players.players.find(q=>q.id===seatId)):0;
      const wallet=p.resources,parts=[wallet.credits,wallet.energy,wallet.publicity/2,wallet.availableData/2,wallet.additionalPublicScan/2,p.hand.length];
      if(!parts.every(n=>Number.isSafeInteger(n*2)))return null;
      const finalScore=endScoring.computePlayerFinalScore({...state,finalScoring:{...board,tiles:{...board.tiles},tileVariants:{...board.tileVariants}},
        players:state.players.players,currentPlayer:p,cardEffects,
        getCardTypeCode:c=>cardEffects.getRuntimeCardTypeCode(c,cardEffects.getCardModel(c)?.cardType)},p).totalScore;
      return {value:stateValue.sumValueParts([finalScore,...parts,mission]),unrealizedPurposeValue:mission,purposePreparationDebt:0};
    }

    function finalDataSalarySource(){
      const stored=nodes.get(openedRoot);
      if(!stored?.envelope||rootObservation?.publicState.roundNumber!==3)return null;
      const state=readIdentityState(stored.envelope),t=state.turn,p=state.players.players.find(q=>q.id===seatId);
      if(t.activePlayerIds.some(id=>id!==seatId&&!t.passedPlayerIds.includes(id))
        ||!p.income.availableData||p.mainActionCompleted||p.passCompletionPending
        ||p.resources.credits||p.resources.energy||p.resources.availableData<players.RESOURCE_LIMITS.availableData-2
        ||!industryCatalog.getPlayerIndustryDefinition(p)?.passiveIds.includes("deepspace_free_analyze")
        ||openedRoot.legalActions.some(a=>a.phase==="main"&&!["pass","analyze"].includes(a.family)))return null;
      const claims=p.reservedCards.flatMap(c=>{
        if(!knownRootCardIds.has(c.id))return [];
        const rule=endScoring.resolveCardEndGameRule(c,cardEffects);
        return rule?.kind==="remainingResource"&&rule.resource==="availableData"&&rule.scorePer>0?[{id:c.id,multiplier:rule.scorePer}]:[];
      });
      return claims.length===1?claims[0]:null;
    }
    function finalDataSalaryQuote(node,source){
      if(node.status!=="turn-boundary"&&!(node.status==="information-barrier"
        &&["hidden_pass_reserve_offer","alien_reveal_turn_end"].includes(node.boundary)))return null;
      const stored=nodes.get(node),state=readIdentityState(stored.envelope),p=state.players.players.find(q=>q.id===seatId);
      if(!p?.reservedCards.some(c=>c.id===source.id)||state.turn.roundNumber!==3)return null;
      const score=p.resources.score,pool=p.resources.availableData,income=p.income.availableData;
      if(![score,pool,income].every(Number.isSafeInteger)||pool<0||pool>players.RESOURCE_LIMITS.availableData||income<=0)return null;
      const keep=Math.min(income,players.RESOURCE_LIMITS.availableData-pool);
      return {score,keep,overflow:income-keep,gain:source.multiplier*keep-(income-keep)*stateValue.DEFAULT_WEIGHTS.availableData};
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
        companyIntentGuardRejectsThisRoot:picks.companyIntentGuardRejects-cardPickRootStats.companyIntentGuardRejects}, goalMovementGeometryNodes, movementRouteCacheEntries: movementRouteCache.size, maxMovementRouteCacheEntries: 64, nodeCount, submissionCount, provedPinkRefills, provedPinkFossilMenus, provedLastPlainPinkInputs, provedQuietSpecifiedScans, provedPinkCardMenus, provedAlienDisplays, provedAmibaYellowLandingInputs, provedChongTransportInputs, provedChongTraceSkips, provedChongTraceMenus, provedChongEndMenus, provedChongQueuedTasks, provedFinalDataMenuInputs, provedBlueTwoPickInputs, provedComputerIncomeMenus, provedCurrencyIncomeInputs, provedFinalResourceCorners, provedActiveFinalTaskInputs, provedFinalEndTaskInputs, provedBluePickSettlements, provedResearchPicks, provedResearchSelections, provedEmptyAmibaResearch, provedQuietEndMenus, provedQuietEndHandovers, provedOwnEndHandovers, provedScan4QuietMoves, provedScan4QuietLaunchSkips, scan4RefillHits, scan4RefillCacheEntries:scan4RefillCache.size, provedMoveMenus, provedMovePayments, provedPublicScanChoices, provedFinalDataPlacements:{...provedFinalDataPlacements}, cacheHits, stableRestoreSkips, timingPrefixBuilds, timingPrefixReuses, movementTimingCacheHits, movementTimingCacheMisses, cacheEntries: cache.size,
        observationCount, observationReleases, movementTimingCacheEntries:movementTimingCache.size,maxMovementTimingCacheEntries:256, normalizedIdentityCacheEntries:normalizedIdentityStates.size, maxNormalizedIdentityCacheEntries:64, identityCount: identities.size, identityMaterializations, physicalBucketCount:physicalIdentityBuckets.size, identityBucketCollisions, identitySubtreeCacheHits:identitySubtrees.hits,identitySubtreeCacheStores:identitySubtrees.stores, identitySliceHits:identitySlices.hits, identitySliceStores:identitySlices.stores, maxCacheEntries, sharedPrefixEdges:prefixEdges.size,sharedPrefixNodes:prefixNodes.size,sharedPrefixHits:prefixHits,
        decodedStateCacheEntries: decodedStates.size, maxDecodedStateCacheEntries, decodedStateCacheBytes, maxDecodedStateCacheBytes,
        observationCacheHits, resourceQueryHits, resourceQueryMisses, goalCatalogHits, goalCatalogMisses,movementBoundQueries,movementRuleQueries,movementIntentRecoveries,completedMovementRecoveries,
        committedDecodeCount, committedDecodeHits, committedReferenceCount, committedReferenceHits, lazyCommittedEnvelopes,lazyPreviewSerializations,
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

    return Object.freeze({ openRoot, expand, identity, blueLaunchContinuationSource, quoteBlueLaunchContinuation, hasMovementIntent, releaseBoundaryObservation, valueObservation, quietFinalValue, finalDataSalarySource, finalDataSalaryQuote, landingCompanyRetained, deferredSectorPublicityEnabled, deferredSectorPublicityQuote, deferredCargoEnabled, quoteDeferredCargo, researchDataPurpose, quoteResearchDataPurpose, researchTransportPurpose, quoteResearchTransport, displayedAnalysisTransportSource, quoteDisplayedAnalysisTransport, transportPreparationPurpose, displayedTransportPurpose, displayedTransportTailRelevant, quoteDisplayedTransport, upstreamTransportEnabled:()=>Boolean(upstreamTransportSource()), quoteTransportPreparation, amibaRegionPurpose, quoteAmibaRegionPurpose, amibaRegionNeedsNativeTail, canDeferCompanyIncomeForScan, deferredComputerIncomeSource, quoteDeferredComputerIncome, researchScanPurpose, quoteResearchScanPurpose, heldScanSectorTieSource, heldScanSectorTie, scanTimingPurpose, quoteScanTimingPurpose, fundedScanAnalysisSource, quoteFundedScanAnalysis, analysisFundingSource, quoteAnalysisFunding,analysisFundingEnd,matchedAnalysisScanSource,matchedAnalysisScanEnd,quoteMatchedAnalysisScan, quoteScanBeforeOrbit, visibleFossilTransportSource, quoteVisibleFossilTransport, retainedRegionCardSource, quoteRetainedRegionCard, sameElectricityIncomeTie, tiedKnownEnergySwap, retainedPublicDataCard, getResourcePrefixGraph, setDecisionPlanning, localDecisionSpec, setResourcePlanning, resourceSpec, expandResourcePlan, setCardPickPlanning, cardPickSpec, expandWithCardPick, setMovementPlanning, goalMovementSpec, expandGoalMovementPlan, selectionSpec, selectionPlans, expandSelection,
      rememberSelection, reuseSelection, rememberPlan, reusePlan, exportPlan, importPlan, knownCardMoneyOrder, postMainResourceOrder, openingResourceOrder, openingMoneyCapacity, openingPlanSpec, expandOpeningPass, knownPickupFundingEnabled, quoteKnownPickupFunding,
      cardTradeBound, passReserveChoiceSpec, preMainDataPlanSpec, postMainCornerChoiceSpec, postMainPlanSpec, postMainBorrowSpec, expandPostMainBorrow, standardScanValueBound, postMainValueBound,movementPlanValueBound,redundantCargoClaim,redundantQuietFinalClaim,proveDeferredFinalDataClaim, incomePlanSummary, incomePlanBoundary, incomePlanBase, turnTailSummary, turnTailBoundary, turnTailBase, chongTaskPeekBoundary, pairedChongClaimBoundary, postMainOptimalPlanSpec, expandPostMainOptimalPlan, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
