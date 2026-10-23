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
    common ? require("../effects/probe-turn-session") : root.SetiProbeTurnSession);
  if (common) module.exports = api;
  else root.SetiAnalysisPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (ruleComposition, cardEffects, cards, industryCatalog, turnFlow, data, alienState, quickTrades, scanEffects, rocketAbilities, techResolver, probeTurnSession) {
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

  // 只比较向前正式输入的行为；不提供 undo/abort，因而历史日志和撤销帧不参与身份。
  // 除下述已证明例外，实体编号、数组顺序、资源、规则 RNG 与剩余队列保留。会改变合法信封的
  // authority 版本单独由 expand 校验，不能作为循环状态的差异。
  function forwardIdentity(envelope, status, boundary, stateOverride = null) {
    const session = envelope.session?.session;
    const source = session?.workingState || stateOverride || JSON.parse(envelope.committedState);
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
    const references = new Map();
    const prefix = /^effect-session-[0-9]+$/.test(session?.sessionId) ? session.sessionId : null;
    const referenceKeys = new Set(["effectId", "parentEffectId", "groupId", "quickGroupId", "decisionId", "choiceId"]);
    function normalize(value, key = "") {
      if (typeof value === "string" && prefix && referenceKeys.has(key)) {
        // 引用按首次出现编号，保留相等关系；物理实体和普通文本绝不重命名。
        const parts = value.split(new RegExp(`(${prefix}:(?:effect|group):[0-9]+)`, "g"));
        if (parts.length > 1) return parts.map((part, index) => {
          if (index % 2 === 0) return part;
          if (!references.has(part)) references.set(part, references.size);
          return { reference: references.get(part) };
        });
      }
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(item => normalize(item));
      const descriptor = value.schemaVersion === "seti-standard-action-v1";
      return Object.fromEntries(Object.keys(value).sort()
        .filter(name => !descriptor || !["actionId", "stateVersion", "decisionVersion"].includes(name))
        .map(name => [name, normalize(value[name], name)]));
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
    return JSON.stringify(normalize({ state, pending, status, boundary }));
  }

  function createAnalysisPort({ composition, seatId, maxCacheEntries = 256 } = {}) {
    if (!composition?.counterfactualPort?.createFork || !composition?.counterfactualPort?.prepareRoot
      || typeof cardEffects?.getCardModel !== "function"
      || typeof seatId !== "string" || !seatId) throw new TypeError("ANALYSIS_PORT_INVALID");
    if (!Number.isSafeInteger(maxCacheEntries) || maxCacheEntries < 0) throw new TypeError("ANALYSIS_CACHE_LIMIT_INVALID");
    const viewer = Object.freeze({ playerId: seatId, role: "player" });
    let nodes = new WeakMap();
    const identities = new Map();
    let resourceOrders = new WeakMap();
    let knownMoneyOrders = new WeakMap();
    let openingOrders = new WeakMap();
    let openingCapacities = new WeakMap();
    let openingPlans = new WeakMap();
    let cardTradeBounds = new WeakMap();
    let passReserveBounds = new WeakMap();
    let cornerChoices = new WeakMap();
    let postMainPlans = new WeakMap();
    const resourceGroups = new Map();
    let fork = null;
    let loadedEnvelope = null;
    let decodedSerialized = null, decodedState = null;
    let committedDecodeCount = 0, committedDecodeHits = 0;
    let rootObservation = null;
    let publicSeed = null;
    let nodeCount = 0;
    let submissionCount = 0;
    let cacheHits = 0;
    let observationCount = 0;
    const cache = new Map();
    // 每席只保留最近一份完成证据；close 结束分支，不丢失下一次点击的证据。
    let selectionCertificate = null;
    let planCertificate = null;
    let nextCertificate = 0;
    const now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
    const milliseconds = { restore: 0, execute: 0, observation: 0, checkpoint: 0, resourceOrder: 0, valueBound: 0, postMainPlan: 0 };

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
      if (!forWrite && loadedEnvelope === envelope) return;
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
      restoreEnvelope(envelope);
      const observationAt = now();
      const observation = project(fork.composition || fork);
      const visible = barrier
        ? ruleComposition.sanitizeHiddenInformationObservation(rootObservation, observation, barrier)
        : observation;
      observationCount += 1;
      const result = freeze(structuredClone(visible));
      milliseconds.observation += now() - observationAt;
      return result;
    }

    function createNode(envelope, observation, actions, status, barrier = null) {
      let visible = observation && freeze(structuredClone(observation));
      // 搜索内部节点只用合法集与身份；首次估值/记录时才投影。getter 不暴露快照。
      const node = Object.freeze({
        get observation() {
          if (!visible) visible = observeEnvelope(envelope, barrier);
          return visible;
        },
        legalActions: freeze(structuredClone(actions)), status, boundary: barrier?.code || null,
      });
      const boundary = barrier?.code || null;
      const key = forwardIdentity(envelope, status, boundary, readIdentityState(envelope));
      if (!identities.has(key)) identities.set(key, Object.freeze({}));
      nodes.set(node, { envelope, serial: nodeCount, identity: identities.get(key), key });
      nodeCount += 1;
      return node;
    }

    function readIdentityState(envelope) {
      if (envelope.session?.session) return envelope.session.session.workingState;
      return readCommittedState(envelope);
    }

    function readCommittedState(envelope) {
      // 不同pending信封可有相同committed bytes。只共享完整冻结的已提交根，
      // store.beginWorkingCopy和Session恢复仍各自复制，不转移任何可写树。
      if (decodedSerialized !== envelope.committedState) {
        decodedState = freeze(JSON.parse(envelope.committedState));
        decodedSerialized = envelope.committedState;
        committedDecodeCount += 1;
      } else {
        committedDecodeHits += 1;
      }
      return decodedState;
    }

    function openRoot() {
      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");
      nodeCount = 0;
      submissionCount = 0;
      cacheHits = 0;
      observationCount = 0;
      committedDecodeCount = 0; committedDecodeHits = 0;
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
      publicSeed = JSON.stringify(["seti-turn-hypothesis-v1", state.meta.seed, state.meta.gameId, seatId,
        state.turn.roundNumber, state.turn.turnNumber, state.turn.actionCycleNumber, state.turn.activePlayerIds]);
      const rootEnvelope = composition.counterfactualPort.prepareRoot(authoritative, {
        publicSeed, restoreRandomState: true,
      });
      fork = composition.counterfactualPort.createFork(rootEnvelope, {
        branchKey: publicSeed, restoreRandomState: true,
      });
      loadedEnvelope = rootEnvelope;
      return createNode(rootEnvelope, rootObservation, actions,
        composition.inspect().phase === "awaiting_input" ? "decision" : "stable");
    }

    function expand(node, actionId) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (["information-barrier", "other-owner", "terminal"].includes(node.status)) {
        throw new Error(`ANALYSIS_BOUNDARY_CLOSED: ${node.status}`);
      }
      const requested = node.legalActions.find(action => action.actionId === actionId);
      if (!requested || requested.actorId !== seatId) throw new Error("ANALYSIS_ACTION_NOT_LEGAL");
      // serial 只在本端口生命周期内绑定这一不可变快照；不按观察摘要跨节点复用。
      const key = JSON.stringify([stored.serial, actionId]);
      if (cache.has(key)) {
        cacheHits += 1;
        return cache.get(key);
      }
      restoreEnvelope(stored.envelope, true);
      const { before, result } = executeCurrent(actionId);
      return remember(key, finishChild(before, result));
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

    function finishChild(before, result) {
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
      const status = newBarrier ? "information-barrier"
        : actions.some(action => action.actorId !== seatId) ? "other-owner"
          : !actions.length ? "terminal"
            : inspection.phase === "awaiting_input" ? "decision" : "stable";
      const child = createNode(envelope, observation,
        ["other-owner", "terminal"].includes(status) ? [] : actions, status,
        newBarrier ? barrier : null);
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
      if (node.status !== "decision") return null;
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
        return { key: stored.key, actions: actionSetKey(entry.node.legalActions), actionId: entry.actionId,
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
      const row = saved.rows.find(entry => entry.key === stored.key && entry.actions === actionSetKey(node.legalActions));
      if (!row) return { hit: false, reason: "dependencies-changed" };
      return freeze({ hit: true, actionId: row.actionId, value: row.value, distance: row.distance, roots: row.roots,
        proof: "seti-complete-window-best-prefix-reuse-v1", evidenceId: saved.evidenceId,
        sourceNode: row.sourceNode, source: saved.source });
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
      const transition = turnFlow.advanceTurnAfterPlayerAction(structuredClone(state), seatId);
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
      const preview = turnFlow.advanceTurnAfterPlayerAction(structuredClone(state), seatId, { passed: true });
      if (!preview.turnAdvanced || preview.roundAdvanced || preview.gameEnded || preview.nextPlayerId === seatId) return null;
      return freeze({ proof: "seti-standard-pass-reserve-choice-value-equivalence-v1", handDelta: 1, expectedStatus: "other-owner" });
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
        || !hasOnlyOwnInertReservations(state, { sectorTasks: true }) || (owner.reservedCards.length && ownRockets.length)
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
      const transition = turnFlow.advanceTurnAfterPlayerAction(structuredClone(state), seatId);
      if (!transition.turnAdvanced || transition.roundAdvanced || transition.gameEnded || transition.nextPlayerId === seatId) return null;
      return freeze({ proof: "seti-quiet-post-main-default-value-plan-v5", retainedActionIds: kept.map(action => action.actionId),
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
      const transition = turnFlow.advanceTurnAfterPlayerAction(structuredClone(state), seatId);
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
      const preview = structuredClone(state);
      const transition = turnFlow.advanceTurnAfterPlayerAction(preview, seatId);
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
      decodedSerialized = null; decodedState = null;
      nodes = new WeakMap();
      identities.clear();
      resourceOrders = new WeakMap();
      knownMoneyOrders = new WeakMap();
      openingOrders = new WeakMap();
      openingCapacities = new WeakMap();
      openingPlans = new WeakMap();
      cardTradeBounds = new WeakMap();
      passReserveBounds = new WeakMap();
      cornerChoices = new WeakMap();
      postMainPlans = new WeakMap();
      resourceGroups.clear();
      cache.clear();
      rootObservation = null;
      publicSeed = null;
    }

    function getDiagnostics() {
      return freeze({ nodeCount, submissionCount, cacheHits, cacheEntries: cache.size,
        observationCount, identityCount: identities.size, maxCacheEntries,
        decodedStateCacheEntries: decodedSerialized ? 1 : 0, maxDecodedStateCacheEntries: 1,
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

    return Object.freeze({ openRoot, expand, identity, selectionSpec, selectionPlans, expandSelection,
      rememberSelection, reuseSelection, rememberPlan, reusePlan, knownCardMoneyOrder, postMainResourceOrder, openingResourceOrder, openingMoneyCapacity, openingPlanSpec, expandOpeningPass,
      cardTradeBound, passReserveChoiceSpec, postMainCornerChoiceSpec, postMainPlanSpec, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
