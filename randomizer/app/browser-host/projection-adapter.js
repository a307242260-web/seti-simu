(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserProjectionAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";
  const POLICY_ID = "seti-browser-default-deny-v1";

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

  function defaultVisibilityPolicy(state, viewer) {
    const playerId = viewer.role === "player" ? viewer.playerId : null;
    const playerSource = Array.isArray(state?.players?.players)
      ? state.players.players
      : (Array.isArray(state?.players) ? state.players : null);
    const playerEntries = playerSource
      ? playerSource.filter((player) => player?.id != null).map((player) => [String(player.id), player])
      : (state?.players && typeof state.players === "object" ? Object.entries(state.players) : []);
    const players = {};
    for (const [id, player] of playerEntries) {
      players[id] = id === playerId
        ? clone(player)
        : pick(player, ["id", "name", "color", "score", "resources", "income", "passed", "eliminated"]);
    }

    const cards = state?.cards || {};
    const hands = cards.hands || cards.handByPlayer || Object.fromEntries(
      playerEntries.map(([id, player]) => [id, player?.hand || []]),
    );
    const reserved = cards.reserved || cards.reservedByPlayer || Object.fromEntries(
      playerEntries.map(([id, player]) => [id, player?.reservedCards || []]),
    );
    const opponentCounts = {};
    for (const [id] of playerEntries) {
      if (id === playerId) continue;
      opponentCounts[id] = {
        hand: countCollection(hands[id]),
        reserved: countCollection(reserved[id]),
      };
    }

    return {
      match: {
        ...pick(state?.match, ["status", "phase", "round", "turn", "activePlayerId", "currentPlayerId", "terminal", "winnerId"]),
        ...pick(state?.turn, ["round", "turn", "actionCycle", "currentPlayerId", "activePlayerId", "phase"]),
      },
      board: {
        solarSystem: pick(state?.solarSystem || state?.board?.solarSystem, ["rotation", "visibleSectors", "publicMarkers"]),
        pieces: {
          ...pick(state?.pieces, ["public", "countsByPlayer"]),
          ...(Array.isArray(state?.pieces?.rockets) ? { public: clone(state.pieces.rockets) } : {}),
        },
        planets: pick(state?.planets, ["public", "markers", "occupancy", "planets"]),
        data: pick(state?.data, ["publicPool", "publicMarkers", "sectorPools", "computer"]),
        finalScoring: pick(state?.finalScoring, ["tiles", "publicMarkers", "scores"]),
      },
      players,
      cards: {
        hand: clone(hands[playerId] || []),
        reserved: clone(reserved[playerId] || []),
        market: clone(cards.market || cards.publicMarket || cards.publicCards || []),
        discard: clone(cards.discard || cards.discardPile || []),
        deckCount: countCollection(cards.deck || cards.drawPileCardIds || cards.drawPile),
        opponentCounts,
      },
      tech: {
        ...pick(state?.tech, ["supply", "publicBoards", "tracks"]),
        ...(state?.tech?.board && !state.tech.supply ? { supply: clone(state.tech.board) } : {}),
      },
      aliens: pick(state?.aliens, ["revealed", "public", "traces", "boards"]),
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
      summary: action.summary || action.family,
      disabledReason: null,
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

  function defaultDecisionPresenter(_rawDecision, choice, index) {
    const choiceId = choiceIdentity(choice, index);
    const inferredPresentation = choice?.tileId != null
      ? {
        tileId: choice.tileId,
        slotId: choice.slotId ?? null,
        tileLabel: choice.tileLabel ?? null,
        slotLabel: choice.slotLabel ?? null,
        color: choice.color ?? null,
        image: choice.image ?? null,
        role: choice.role ?? null,
      }
      : (choice?.role == null ? null : { role: choice.role });
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
    const sessionRuntime = options.sessionRuntime;
    const actionAdapter = options.actionAdapter || null;
    const visibilityPolicy = options.visibilityPolicy || defaultVisibilityPolicy;
    const createActionContext = options.createActionContext || ((input) => input);
    const decisionPresenter = options.decisionPresenter || defaultDecisionPresenter;
    const policyId = options.policyId || visibilityPolicy.policyId || "custom-viewer-policy";
    if (!stateStore?.getSnapshot) throw new TypeError("BrowserProjectionAdapter 需要 StateStore.getSnapshot()");
    if (sessionRuntime && (!sessionRuntime.inspect || !sessionRuntime.observe)) {
      throw new TypeError("sessionRuntime 必须实现 inspect/observe");
    }
    if (actionAdapter && typeof actionAdapter.enumerate !== "function") {
      throw new TypeError("actionAdapter 必须实现 enumerate()");
    }
    if (typeof visibilityPolicy !== "function") throw new TypeError("visibilityPolicy 必须是函数");
    if (typeof decisionPresenter !== "function") throw new TypeError("decisionPresenter 必须是函数");

    function buildProjection({ kind, state, viewer, inspection = null, observation = null }) {
      const visible = visibilityPolicy(clone(state), clone(viewer), {
        kind,
        inspection: clone(inspection),
        observation: clone(observation),
      });
      if (!visible || typeof visible !== "object" || Array.isArray(visible)) {
        throw new TypeError("visibilityPolicy 必须返回普通投影对象");
      }
      const stateVersion = state?.meta?.stateVersion ?? inspection?.baseVersion ?? null;
      const source = {
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
      const projectionId = `${kind}:${stableHash({ source, viewer, policyId })}`;
      return deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        projectionId,
        source,
        viewer: clone(viewer),
        match: clone(visible.match || {}),
        board: clone(visible.board || {}),
        players: clone(visible.players || {}),
        cards: clone(visible.cards || {}),
        tech: clone(visible.tech || {}),
        aliens: clone(visible.aliens || {}),
        controls: {
          actions: normalizedActions.filter((action) => action.phase !== "quick"),
          quickActions: normalizedActions.filter((action) => action.phase === "quick"),
          canUndo: Boolean(visible.controls?.canUndo),
          canEndTurn: normalizedActions.some((action) => action.family === "end_turn"),
        },
        decision,
        feedback: clone(visible.feedback || { events: [], logs: [], progress: null, notices: [] }),
      });
    }

    function projectCommitted(input = {}) {
      const viewer = assertViewer(input.viewer);
      const state = stateStore.getSnapshot();
      return buildProjection({ kind: "committed", state, viewer });
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
      return input.session ? projectSession(input.session, input) : projectCommitted(input);
    }

    return Object.freeze({ project, projectCommitted, projectSession });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    POLICY_ID,
    defaultVisibilityPolicy,
    defaultDecisionPresenter,
    createBrowserProjectionAdapter,
  });
});
