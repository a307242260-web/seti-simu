(function (root, factory) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("../rule-composition") : root.SetiRuleComposition,
    common ? require("../cards/effects") : root.SetiCardEffects,
    common ? require("../cards/deck") : root.SetiCards,
    common ? require("../industry/catalog") : root.SetiIndustryCatalog,
    common ? require("../turn-flow") : root.SetiTurnFlow);
  if (common) module.exports = api;
  else root.SetiAnalysisPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (ruleComposition, cardEffects, cards, industryCatalog, turnFlow) {
  "use strict";

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
    let openingOrders = new WeakMap();
    let cardTradeBounds = new WeakMap();
    const resourceGroups = new Map();
    let fork = null;
    let loadedEnvelope = null;
    let rootObservation = null;
    let publicSeed = null;
    let nodeCount = 0;
    let submissionCount = 0;
    let cacheHits = 0;
    let observationCount = 0;
    const cache = new Map();
    // 每席只保留最近一份完成证据；close 结束分支，不丢失下一次点击的证据。
    let selectionCertificate = null;
    let nextCertificate = 0;
    const now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
    const milliseconds = { restore: 0, execute: 0, observation: 0, checkpoint: 0, resourceOrder: 0, valueBound: 0 };

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
      const key = forwardIdentity(envelope, status, boundary);
      if (!identities.has(key)) identities.set(key, Object.freeze({}));
      nodes.set(node, { envelope, serial: nodeCount, identity: identities.get(key) });
      nodeCount += 1;
      return node;
    }

    function openRoot() {
      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");
      nodeCount = 0;
      submissionCount = 0;
      cacheHits = 0;
      observationCount = 0;
      for (const key of Object.keys(milliseconds)) milliseconds[key] = 0;
      rootObservation = project(composition);
      const actions = legalActions(composition);
      if (!actions.length || actions.some(action => action.actorId !== seatId)) {
        throw new Error("ANALYSIS_ROOT_OWNER_MISMATCH");
      }
      // 公共事实确定假设世界；隐藏权威快照只留在本闭包。
      publicSeed = JSON.stringify(rootObservation);
      const rootEnvelope = composition.counterfactualPort.prepareRoot(snapshot(composition), {
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
        })
        : current.phase === "quick" ? comp.inputPort.submitQuickAction(current)
          : comp.inputPort.submitAction(current);
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
      if (state.turn.currentPlayerId !== seatId || owner.passCompletionPending
        || state.turn.passedPlayerIds.includes(seatId) || state.match.initialSetup
        || state.players.players.some(player => player.reservedCards.length)
        || state.turn.cardTurnEventBonuses?.length
        || Object.values(state.aliens.aliens).some(slot => slot.revealed)
        || company?.activeAbilityId !== "helios_remove_tech_income"
        || company.passiveIds.some(id => id !== "helios_passive_reward_slots")
        || owner.hand.some(card => !["basic", "space-agency"].includes(card.set))
        || state.cards.publicCards.some(card => card && !["basic", "space-agency"].includes(card.set))) return null;
      // getAvailablePool 会清理副本上的牌堆目录，不能写入冻结的工作状态。
      if (!cards.getAvailablePool({ ...state.cards }, state.players).length) return null;
      return freeze({ proof: "seti-card-trade-information-value-bound-v1", tradeId: pending.tradeId, handDelta });
    }

    function postMainResourceOrder(node) {
      return resourceOrder(node, resourceOrders, false);
    }

    function openingResourceOrder(node) {
      return resourceOrder(node, openingOrders, true);
    }

    function resourceOrder(node, orders, opening) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      if (orders.has(node)) return orders.get(node);
      const at = now();
      const result = describeResourceOrder(stored, node, opening);
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
      if (company?.activeAbilityId !== "helios_remove_tech_income"
        || company.passiveIds.some(id => id !== "helios_passive_reward_slots")) return null;
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
        proof: opening ? "seti-helios-opening-money-simulation-v1" : "seti-helios-post-main-money-simulation-v1" });
    }

    function close() {
      (fork?.composition || fork)?.dispose?.();
      fork = null;
      loadedEnvelope = null;
      nodes = new WeakMap();
      identities.clear();
      resourceOrders = new WeakMap();
      openingOrders = new WeakMap();
      cardTradeBounds = new WeakMap();
      resourceGroups.clear();
      cache.clear();
      rootObservation = null;
      publicSeed = null;
    }

    function getDiagnostics() {
      return freeze({ nodeCount, submissionCount, cacheHits, cacheEntries: cache.size,
        observationCount, identityCount: identities.size, maxCacheEntries,
        selectionEvidenceEntries: selectionCertificate ? 1 : 0, maxSelectionEvidenceEntries: 1,
        milliseconds: { ...milliseconds } });
    }

    function identity(node) {
      const stored = nodes.get(node);
      if (!fork || !stored) throw new Error("ANALYSIS_NODE_INVALID");
      return stored.identity;
    }

    return Object.freeze({ openRoot, expand, identity, selectionSpec, selectionPlans, expandSelection,
      rememberSelection, reuseSelection, postMainResourceOrder, openingResourceOrder, cardTradeBound, close, getDiagnostics });
  }

  return Object.freeze({ createAnalysisPort });
});
