(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserProjectionAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";
  const POLICY_ID = "seti-browser-default-deny-v1";
  const CONDITIONAL_FAMILIES = new Set([
    "choose_card", "choose_target", "choose_payment", "choose_reward", "choose_branch",
    "choose_final_scoring", "accept_optional_effect",
  ]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function stableSerialize(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(",")}}`;
  }

  function stableHash(value) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function fail(code, message, details = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(details) });
  }

  function pick(source, keys) {
    if (!source || typeof source !== "object") return {};
    const output = {};
    for (const key of keys) {
      if (Object.hasOwn(source, key)) output[key] = clone(source[key]);
    }
    return output;
  }

  function countCollection(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  }

  function createInitialIncomePresentation(inspection, viewerPlayerId) {
    const decisionContext = inspection?.currentEffect?.payload?.decisionContext;
    const queue = decisionContext?.kind === "initial_income"
      ? decisionContext.queue || []
      : [];
    const current = queue[0] || null;
    return {
      active: Boolean(current),
      interactive: Boolean(current) && String(current.playerId) === String(viewerPlayerId),
      currentPlayerId: current?.playerId == null ? null : String(current.playerId),
      companyLabel: current?.label || null,
      remainingCount: queue.length,
      currentPlayerRemainingCount: current
        ? queue.filter((entry) => String(entry?.playerId) === String(current.playerId)).length
        : 0,
    };
  }

  function defaultVisibilityPolicy(state, viewer, context = {}) {
    const playerId = viewer.role === "player" ? viewer.playerId : null;
    if (!Array.isArray(state?.players?.players)) {
      throw new TypeError("BrowserProjection 需要 canonical players.players");
    }
    const playerEntries = state.players.players
      .filter((player) => player?.id != null)
      .map((player) => [String(player.id), player]);
    const players = {};
    for (const [id, player] of playerEntries) {
      const visiblePlayer = id === playerId
        ? clone(player)
        : pick(player, [
          "id", "name", "color", "score", "resources", "income",
          "passed", "eliminated", "aiEnabled", "aiDifficulty", "aiDifficultyLabel",
        ]);
      players[id] = {
        ...visiblePlayer,
        id: String(player?.id ?? id),
        handCount: countCollection(player?.hand),
        reservedCount: countCollection(player?.reservedCards),
        tech: clone(player?.techState?.ownedTiles || {}),
      };
    }

    const cards = state?.cards || {};
    const solarSource = state?.solarSystem || {};
    const setup = state?.match?.initialSetup || null;
    const setupCurrentPlayerId = setup?.currentPlayerId == null
      ? null
      : String(setup.currentPlayerId);
    const projectionInspection = context?.inspection
      || (context?.currentEffect ? context : null);
    const setupPresentation = {
      active: setup?.phase === "selecting",
      interactive: setup?.phase === "selecting" && setupCurrentPlayerId === playerId,
      currentPlayerId: setupCurrentPlayerId,
      offer: setup?.phase === "selecting" && setupCurrentPlayerId === playerId
        ? clone(setup.offersByPlayerId?.[setupCurrentPlayerId] || null)
        : null,
      confirmedPlayerIds: clone(setup?.confirmedPlayerIds || []),
    };

    return {
      match: {
        ...pick(state?.match, ["status", "phase"]),
        roundNumber: Number(state?.turn?.roundNumber ?? 1),
        turnNumber: Number(state?.turn?.turnNumber ?? 1),
        actionCycleNumber: Number(state?.turn?.actionCycleNumber ?? 1),
        currentPlayerId: state?.turn?.currentPlayerId ?? null,
        terminal: Boolean(state?.turn?.gameEnded),
      },
      resident: {
        turn: pick(state?.turn, [
          "round", "turn", "roundNumber", "turnNumber", "actionCycle", "currentPlayerId",
          "activePlayerId", "activePlayerIds", "turnOrderPlayerIds", "passedPlayerIds",
          "completedTurnPlayerIds", "phase", "gameEnded", "gameEndReason",
        ]),
        players: {
          currentPlayerId: state?.turn?.currentPlayerId ?? null,
          players: Object.values(players).map(clone),
        },
        solar: {
          rotation: clone(solarSource.rotation || {}),
          sectorBySlot: clone(solarSource.sectorBySlot || {}),
          aomomoActive: Boolean(solarSource.aomomoActive),
        },
        pieces: clone(state?.pieces || {}),
        planets: clone(state?.planets || {}),
        data: clone(state?.data || {}),
        cards: {
          publicCards: clone(cards.publicCards || []),
          discardPile: clone(cards.discardPile || []),
          drawPileCount: countCollection(cards.drawPileCardIds),
        },
        tech: clone(state?.tech || {}),
        aliens: clone(state?.aliens || {}),
        finalScoring: clone(state?.finalScoring || {}),
        initialSetup: setupPresentation,
        initialIncome: createInitialIncomePresentation(projectionInspection, playerId),
      },
      feedback: { events: [], logs: [], progress: null, notices: [] },
    };
  }
  defaultVisibilityPolicy.policyId = POLICY_ID;

  function assertViewer(viewer) {
    if (!viewer || typeof viewer !== "object" || !viewer.viewerId || !viewer.role) {
      throw new TypeError("BrowserProjection viewer 需要 viewerId 和 role");
    }
    return {
      viewerId: String(viewer.viewerId),
      playerId: viewer.playerId == null ? null : String(viewer.playerId),
      role: String(viewer.role),
    };
  }

  function normalizeAction(action) {
    return {
      schemaVersion: action.schemaVersion,
      actionId: action.actionId,
      family: action.family,
      phase: action.phase,
      actorId: action.actorId,
      stateVersion: action.stateVersion,
      decisionVersion: action.decisionVersion,
      target: clone(action.target || null),
      payload: clone(action.payload || {}),
      decision: clone(action.decision || null),
      summary: action.summary || action.family,
      disabledReason: action.disabledReason || null,
    };
  }

  function choiceIdentity(choice, index) {
    const identity = choice?.actionId
      ?? choice?.choiceId
      ?? choice?.id
      ?? choice?.tileId
      ?? choice?.targetId
      ?? choice?.value;
    return identity == null ? `choice:${stableHash({ index, choice })}` : String(identity);
  }

  function defaultDecisionPresenter(rawDecision, choice, index) {
    const decisionKind = rawDecision?.kind || rawDecision?.decisionKind || null;
    if (CONDITIONAL_FAMILIES.has(decisionKind)
      && (!choice?.schemaVersion
        || !choice?.actionId
        || choice.family !== decisionKind
        || choice.actorId !== rawDecision.ownerId)) {
      throw new TypeError(
        `${decisionKind} Decision choice 缺少 Standard Action identity 或 owner/family 不匹配`,
      );
    }
    const choiceId = choiceIdentity(choice, index);
    let inferredPresentation = null;
    if (choice?.target?.kind === "select_initial_card") {
      const selectionKind = choice.target.selectionKind;
      const cardId = String(choice.target.cardId || "");
      const value = cardId.replace(/^[^:]+:/, "");
      const isIndustry = selectionKind === "industry";
      inferredPresentation = {
        cardId,
        cardKind: isIndustry ? "industry" : "initial",
        imageSrc: isIndustry
          ? `../assets/industry/${value}`
          : `../assets/initial_card/split/${value}.png`,
        imageAlt: choice?.summary || choice?.label || cardId,
        selected: /^(?:取消|已选)/.test(choice?.summary || ""),
      };
    } else if (choice?.target?.kind === "discard-hand-cards"
      && Array.isArray(choice.target.cardIds)
      && choice.target.cardIds.length === 1) {
      inferredPresentation = {
        cardId: String(choice.target.cardIds[0]),
        cardKind: "hand",
        imageSrc: null,
        imageAlt: choice?.summary || choice?.label || "手牌",
        selected: false,
      };
    } else if (choice?.target?.kind === "confirm_initial_setup") {
      inferredPresentation = { role: "setup-confirm" };
    }
    if (!inferredPresentation && choice?.tileId != null) {
      inferredPresentation = {
        tileId: choice.tileId,
        slotId: choice.slotId ?? null,
        tileLabel: choice.tileLabel ?? null,
        slotLabel: choice.slotLabel ?? null,
        color: choice.color ?? null,
        image: choice.image ?? null,
        role: choice.role ?? null,
      };
    } else if (!inferredPresentation
      && rawDecision?.decisionKind === "choose_target"
      && choice?.target) {
      inferredPresentation = { targetRef: clone(choice.target) };
    } else if (!inferredPresentation && rawDecision?.decisionKind === "choose_payment") {
      inferredPresentation = {
        cost: clone(choice?.payload?.cost || choice?.target?.cost || choice?.target || null),
        remaining: clone(choice?.payload?.remaining || null),
      };
    } else if (!inferredPresentation && choice?.role != null) {
      inferredPresentation = { role: choice.role };
    }
    return {
      choiceId,
      label: choice?.label || choice?.summary || choice?.name || String(choice?.tileId || choiceId),
      presentation: clone(choice?.presentation || inferredPresentation),
      disabledReason: choice?.disabledReason || null,
    };
  }

  function normalizeDecision(rawDecision, viewer, decisionPresenter) {
    if (!rawDecision || rawDecision.ok === false) return null;
    const ownerVisible = viewer.role === "player"
      && viewer.playerId != null
      && rawDecision.ownerId === viewer.playerId;
    return {
      decisionId: rawDecision.decisionId,
      decisionVersion: rawDecision.decisionVersion,
      ownerId: rawDecision.ownerId,
      kind: rawDecision.kind || rawDecision.decisionKind || "unknown",
      titleKey: rawDecision.titleKey || null,
      promptKey: rawDecision.promptKey || null,
      choices: ownerVisible ? (rawDecision.choices || []).map((choice, index) => (
        decisionPresenter(rawDecision, clone(choice), index)
      )) : [],
      minChoices: rawDecision.minChoices ?? 1,
      maxChoices: rawDecision.maxChoices ?? 1,
      optional: Boolean(rawDecision.optional),
      allowQuickActions: Boolean(rawDecision.allowQuickActions),
      presentationHint: rawDecision.presentationHint || null,
    };
  }

  function createBrowserProjectionAdapter(options = {}) {
    const stateStore = options.stateStore;
    const stateSource = options.stateSource || null;
    const sessionRuntime = options.sessionRuntime;
    const actionAdapter = options.actionAdapter || null;
    const visibilityPolicy = options.visibilityPolicy || defaultVisibilityPolicy;
    const createActionContext = options.createActionContext || ((input) => input);
    const decisionPresenter = options.decisionPresenter || defaultDecisionPresenter;
    const sourceStateIsVisible = options.sourceStateIsVisible === true;
    const policyId = options.policyId || visibilityPolicy.policyId || "custom-viewer-policy";
    if (!stateStore?.getSnapshot && !stateSource?.read) {
      throw new TypeError("BrowserProjectionAdapter 需要 StateStore.getSnapshot() 或 StateSource.read()");
    }
    if (sessionRuntime && (!sessionRuntime.inspect || !sessionRuntime.observe)) {
      throw new TypeError("sessionRuntime 必须实现 inspect/observe");
    }
    if (actionAdapter && typeof actionAdapter.enumerate !== "function") {
      throw new TypeError("actionAdapter 必须实现 enumerate()");
    }
    if (typeof visibilityPolicy !== "function") throw new TypeError("visibilityPolicy 必须是函数");
    if (typeof decisionPresenter !== "function") throw new TypeError("decisionPresenter 必须是函数");

    function buildProjection({ kind, state, viewer, inspection = null, observation = null, sourceEnvelope = null }) {
      const visible = sourceStateIsVisible
        ? clone(state)
        : visibilityPolicy(clone(state), clone(viewer), {
          kind,
          inspection: clone(inspection),
          observation: clone(observation),
        });
      if (!visible || typeof visible !== "object" || Array.isArray(visible)) {
        throw new TypeError("visibilityPolicy 必须返回普通投影对象");
      }
      const stateVersion = state?.meta?.stateVersion ?? inspection?.baseVersion ?? null;
      const source = sourceEnvelope ? {
        kind: sourceEnvelope.kind,
        stateVersion: sourceEnvelope.stateVersion,
        sessionId: sourceEnvelope.sessionId ?? null,
        sessionRevision: sourceEnvelope.sessionRevision ?? null,
        phase: sourceEnvelope.phase,
      } : {
        kind,
        stateVersion,
        sessionId: inspection?.sessionId || null,
        sessionRevision: inspection?.revision ?? null,
        phase: inspection?.phase || (kind === "committed" ? "committed" : null),
      };
      const actionContext = createActionContext({
        state: clone(state), viewer: clone(viewer), source: clone(source),
        inspection: clone(inspection), observation: clone(observation),
      });
      const actorId = viewer.role === "player" ? viewer.playerId : null;
      const actions = actionAdapter
        ? actionAdapter.enumerate(actionContext, actorId == null ? {} : { actorId })
        : [];
      if (!Array.isArray(actions)) throw new TypeError("actionAdapter.enumerate() 必须返回数组");
      const normalizedActions = actions.map(normalizeAction);
      const decision = normalizeDecision(observation?.decision || inspection?.decision, viewer, decisionPresenter);
      const quickAllowed = kind !== "session" || Boolean(
        inspection?.controls?.allowQuickActions ?? decision?.allowQuickActions,
      );
      const projectedActions = normalizedActions.map((action) => (
        action.phase === "quick" && !quickAllowed && !action.disabledReason
          ? { ...action, disabledReason: "当前 Effect 边界不允许快速行动" }
          : action
      ));
      const progress = clone(inspection?.progress || visible.feedback?.progress || null);
      const projectionId = `${kind}:${stableHash({ source, viewer, policyId })}`;
      return deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        projectionId,
        source,
        viewer: clone(viewer),
        match: clone(visible.match || {}),
        resident: clone(visible.resident || {}),
        controls: {
          actions: projectedActions.filter((action) => action.phase !== "quick"),
          quickActions: projectedActions.filter((action) => action.phase === "quick"),
          canUndo: Boolean(inspection?.controls?.canUndo ?? visible.controls?.canUndo),
          undoDisabledReason: inspection?.controls?.undoDisabledReason
            || visible.controls?.undoDisabledReason
            || null,
          canEndTurn: projectedActions.some((action) => (
            action.family === "end_turn" && !action.disabledReason
          )),
        },
        decision,
        feedback: {
          ...clone(visible.feedback || { events: [], logs: [], progress: null, notices: [] }),
          progress,
        },
      });
    }

    function projectCommitted(input = {}) {
      if (!stateStore?.getSnapshot) return projectSource(input);
      const viewer = assertViewer(input.viewer);
      const state = stateStore.getSnapshot();
      return buildProjection({ kind: "committed", state, viewer });
    }

    function projectSource(input = {}) {
      if (!stateSource?.read) throw new TypeError("BrowserProjectionAdapter 未配置 StateSource");
      const viewer = assertViewer(input.viewer);
      const envelope = stateSource.read(viewer);
      if (!envelope?.source || !envelope?.state) {
        throw new TypeError("StateSource.read() 必须返回 source/state envelope");
      }
      const kind = envelope.source.kind === "working" ? "session" : "committed";
      return buildProjection({
        kind,
        state: envelope.state,
        viewer,
        observation: { state: envelope.state, decision: envelope.decision || null },
        sourceEnvelope: envelope.source,
      });
    }

    function projectSession(session, input = {}) {
      if (!sessionRuntime) throw new TypeError("BrowserProjectionAdapter 未配置 sessionRuntime");
      const viewer = assertViewer(input.viewer);
      const inspection = sessionRuntime.inspect(session);
      const observation = sessionRuntime.observe(session, viewer);
      if (inspection?.ok === false) return fail(
        inspection.code || "BROWSER_PROJECTION_SESSION_INSPECT_FAILED",
        inspection.message || "Effect Session inspect 失败",
        { inspection },
      );
      if (!observation || observation.sessionId !== inspection.sessionId
        || observation.revision !== inspection.revision || observation.phase !== inspection.phase) {
        return fail("BROWSER_PROJECTION_SESSION_SOURCE_MISMATCH", "Effect Session inspect/observe envelope 不一致");
      }
      return buildProjection({
        kind: "session",
        state: observation.state,
        viewer,
        inspection,
        observation,
      });
    }

    function project(input = {}) {
      if (input.session) return projectSession(input.session, input);
      return stateSource ? projectSource(input) : projectCommitted(input);
    }

    return Object.freeze({ project, projectSource, projectCommitted, projectSession });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    POLICY_ID,
    defaultVisibilityPolicy,
    defaultDecisionPresenter,
    createBrowserProjectionAdapter,
  });
});
