(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let scanEffects = root.SetiScanEffects;
  let researchTechAction = root.SetiActionResearchTech;
  let players = root.SetiPlayers;
  let abilities = root.SetiAbilities;
  let data = root.SetiData;
  let tech = root.SetiTech;
  let cards = root.SetiCards;
  let solar = root.SetiSolarSystem;
  let aliens = root.SetiAliens;
  let industryPassives = root.SetiIndustryPassives;
  let industryState = root.SetiIndustryState;
  let helios = root.SetiIndustryHeliosPassive;
  if (typeof require === "function") {
    standardAction = standardAction || require("../actions/standard-action");
    scanEffects = scanEffects || require("../actions/scan-effects");
    researchTechAction = researchTechAction || require("../actions/research-tech");
    players = players || require("../players");
    abilities = abilities || require("../abilities");
    data = data || require("../data");
    tech = tech || require("../tech");
    cards = cards || require("../cards/deck");
    solar = solar || require("../../solar-system/core");
    aliens = aliens || require("../aliens");
    industryPassives = industryPassives || require("../industry/passives");
    industryState = industryState || require("../industry/state");
    helios = helios || require("../industry/helios-passive");
  }

  const api = factory(
    standardAction,
    scanEffects,
    researchTechAction,
    players,
    abilities,
    data,
    tech,
    cards,
    solar,
    aliens,
    industryPassives,
    industryState,
    helios,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiScienceSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  scanEffects,
  researchTechAction,
  players,
  abilities,
  data,
  tech,
  cards,
  solar,
  aliens,
  industryPassives,
  industryState,
  helios,
) {
  "use strict";

  const DOMAIN_ID = "science";
  const ACTION_FAMILIES = Object.freeze(["scan", "place_data", "analyze", "research_tech"]);
  const EXECUTOR_ID = `${DOMAIN_ID}:executor:v1`;
  const NEBULA_IDS_BY_SCAN_CODE = Object.freeze([
    Object.freeze(["sector-4-a", "sector-3-a"]),
    Object.freeze(["sector-2-b", "sector-3-b"]),
    Object.freeze(["sector-2-a", "sector-1-a"]),
    Object.freeze(["sector-1-b", "sector-4-b"]),
  ]);
  const EFFECT_TYPES = Object.freeze({
    EXECUTE: "science_domain_execute",
    SCAN_TARGET: "science_domain_scan_target",
    PUBLIC_SCAN: "science_domain_public_scan",
    HAND_SCAN: "science_domain_hand_scan",
    SCAN_ACTION_4: "science_domain_scan_action_4",
    PLACE_DATA: "science_domain_place_data",
    INCOME: "science_domain_income",
    PICK_CARD: "science_domain_pick_card",
    ANALYZE: "science_domain_analyze",
    RESEARCH: "science_domain_research",
    ALIEN_TRACE: "science_domain_alien_trace",
    SETTLE: "science_domain_settle",
  });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function getWorkingRoot(state, workingContext) {
    return workingContext?.workingRoot || workingContext || state;
  }

  function getSlice(root, browserKey, committedKey) {
    return root?.[browserKey] || root?.[committedKey] || {};
  }

  function getTechGameState(root) {
    if (root?.techGameState) return root.techGameState;
    if (!root?.tech) return {};
    if (root.tech.board) return root.tech;
    return { board: root.tech, ui: root.match?.techUi || null };
  }

  function getActor(root, actorId = null) {
    const playerState = getSlice(root, "playerState", "players");
    const resolvedId = actorId || playerState.currentPlayerId || root?.turn?.currentPlayerId || null;
    return (playerState.players || []).find((player) => player.id === resolvedId) || null;
  }

  function createActionContext(root, actorId) {
    const playerState = getSlice(root, "playerState", "players");
    const techGameState = getTechGameState(root);
    const solarState = getSlice(root, "solarState", "solarSystem");
    const actionPlayerState = actorId === playerState.currentPlayerId
      ? playerState
      : { ...playerState, currentPlayerId: actorId, players: playerState.players };
    const context = {
      workingRoot: root,
      playerState: actionPlayerState,
      cardState: getSlice(root, "cardState", "cards"),
      rocketState: getSlice(root, "rocketState", "pieces"),
      solarState,
      nebulaDataState: getSlice(root, "nebulaDataState", "data"),
      planetStatsState: getSlice(root, "planetStatsState", "planets"),
      techGameState,
      techBoardState: techGameState.board,
      techUiState: techGameState.ui,
      alienGameState: getSlice(root, "alienGameState", "aliens"),
      turnState: getSlice(root, "turnState", "turn"),
      match: root.match,
      standardActionAuthority: {
        actorId,
        stateVersion: root?.meta?.stateVersion ?? 0,
        decisionVersion: root?.match?.decisionVersion ?? 0,
      },
      ensurePlayerTechState(player) {
        if (!player.techState) player.techState = players.normalizePlayerTechState(null);
      },
      getPlanetLocations: () => solar.createSolarSnapshot(solarState).planetLocations,
    };
    context.getEarthSectorCoordinate = () => {
      const earth = context.getPlanetLocations().find((planet) => planet.planetId === "earth");
      return earth ? { x: earth.x, y: earth.y } : null;
    };
    context.rotateSolarOrbit = (count = 1) => {
      const before = clone(solarState.rotation);
      solarState.rotation = solar.applySolarOrbitRotation(solarState.rotation, count);
      solarState.wheelSteps = solar.rotationToWheelSteps(solarState.rotation);
      return abilities.rocket.settleRocketsAfterSolarRotation(
        context,
        before,
        solarState.rotation,
      );
    };
    context.drawBasicCardToPlayer = (player) => cards.blindDraw(
      context.cardState,
      actionPlayerState,
      player,
      () => nextCommittedRandom(root),
      { createCardInstance: (entry) => cards.createCommittedCardInstance(root, entry) },
    );
    return context;
  }

  function hashSeed(value) {
    let hash = 2166136261;
    for (const character of String(value ?? "seti-science")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function nextCommittedRandom(root) {
    if (!root?.meta) throw new TypeError("Science deterministic random 缺少 meta");
    if (!root.meta.rngState || typeof root.meta.rngState !== "object") root.meta.rngState = {};
    const previous = root.meta.rngState.science;
    const state = Number.isSafeInteger(previous?.state)
      ? previous.state >>> 0
      : hashSeed(root.meta.seed);
    const nextState = (state + 0x6D2B79F5) >>> 0;
    let value = nextState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    root.meta.rngState.science = {
      algorithm: "mulberry32-v1",
      state: nextState,
      cursor: (Number(previous?.cursor) || 0) + 1,
    };
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function makeChoice(family, choiceId, target = {}, payload = {}, summary = choiceId) {
    return {
      family,
      phase: "conditional",
      target: { choiceId, ...target },
      payload,
      summary,
    };
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
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

  function formalizeChoices(root, actorId, choices) {
    return (choices || []).map((choice) => {
      const target = clone(choice.target || null);
      const payload = clone(choice.payload || {});
      const identity = { family: choice.family, actorId, target, payload };
      return {
        schemaVersion: standardAction.SCHEMA_VERSION,
        family: choice.family,
        phase: "conditional",
        actionId: `${choice.family}:${stableHash(identity)}`,
        actorId,
        stateVersion: root?.meta?.stateVersion ?? 0,
        decisionVersion: root?.match?.decisionVersion ?? 0,
        target,
        payload,
        decision: null,
        summary: choice.summary || choice.family,
      };
    });
  }

  function canStartMain(root, actor) {
    if (!actor) return fail("SCIENCE_ACTOR_MISSING", "没有当前玩家");
    if (actor.mainActionCompleted) return fail("SCIENCE_MAIN_ACTION_COMPLETE", "主要行动已经完成");
    if (root?.match?.pendingDecision) return fail("SCIENCE_PENDING_DECISION", "请先完成当前选择");
    return { ok: true };
  }

  function consumeAlienLabPanel(actor, panelId) {
    if (!industryPassives?.hasActiveAlienLabPanel?.(actor, panelId)) return null;
    if (industryPassives.hasPermanentAlienLabPanels?.(actor)) return null;
    return industryState?.consumeAlienLabPanel?.(actor, panelId) || null;
  }

  function listNebulaChoices(root, options = {}) {
    const nebulaState = getSlice(root, "nebulaDataState", "data");
    let nebulaIds = options.nebulaIds || [];
    if (options.sectorX != null) {
      const found = solar.getNebulaAtCoordinate(
        solar.mod8(options.sectorX),
        5,
        getSlice(root, "solarState", "solarSystem").sectorBySlot,
      );
      nebulaIds = found ? [found.id] : [];
    }
    return [...new Set(nebulaIds)].flatMap((nebulaId) => {
      const next = data.getNextReplaceableNebulaToken(nebulaState, nebulaId);
      const tokens = data.listNebulaTokens(nebulaState, nebulaId);
      return next || tokens.length
        ? [makeChoice(
          "choose_target",
          `nebula:${nebulaId}`,
          { nebulaId, sectorX: options.sectorX ?? null },
          { gainData: options.gainData !== false },
          `扫描 ${data.getNebulaLabel(nebulaId)}`,
        )]
        : [];
    });
  }

  function executeNebulaScan(root, actorId, choice, options = {}) {
    const actor = getActor(root, actorId);
    if (!actor) return fail("SCIENCE_SCAN_ACTOR_STALE", "扫描玩家已失效");
    const legal = listNebulaChoices(root, {
      nebulaIds: options.nebulaIds || [choice?.target?.nebulaId],
      sectorX: options.sectorX,
      gainData: options.gainData,
    }).find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
    if (!legal) return fail("SCIENCE_SCAN_TARGET_STALE", "扫描目标已失效");
    return abilities.executeAbility("scanNebula", createActionContext(root, actor.id), {
      nebulaId: legal.target.nebulaId,
      gainData: options.gainData ?? legal.payload.gainData,
      source: options.source || "science",
      prefix: options.label || "扫描",
    });
  }

  function listResearchChoices(root, actorId, options = {}) {
    const actor = getActor(root, actorId);
    const techGameState = getTechGameState(root);
    if (!actor || !techGameState?.board) return [];
    if (options.requireCondition?.type === "resourceEquals"
      && Number(actor.resources?.[options.requireCondition.resource] || 0)
        !== Number(options.requireCondition.count || 0)) return [];
    if (options.requireCondition?.type === "resourceThreshold"
      && Number(actor.resources?.[options.requireCondition.resource] || 0)
        < Number(options.requireCondition.count || 0)) return [];
    let tileIds = tech.resolver.listTakeableTiles(
      techGameState.board,
      actor.techState || players.normalizePlayerTechState(null),
      options.techTypes?.length ? { techTypes: options.techTypes } : {},
    );
    tileIds = tileIds.filter((tileId) => !industryPassives?.isTechBlockedByPirates?.(actor, tileId));
    if (options.researchedByOthersOnly) {
      const playerState = getSlice(root, "playerState", "players");
      tileIds = tileIds.filter((tileId) => playerState.players.some((player) => (
        player.id !== actor.id && Boolean(player.techState?.ownedTiles?.[tileId])
      )));
    }
    const blueSlots = tech.getAvailableBlueSlots(
      actor.techState || players.normalizePlayerTechState(null),
    );
    return tileIds.flatMap((tileId) => (
      (tech.getTechType(tileId) === "blue" ? blueSlots : [null]).map((blueSlot) => makeChoice(
        "choose_target",
        blueSlot == null ? `tech:${tileId}` : `tech:${tileId}:slot:${blueSlot}`,
        { tileId, blueSlot },
        {
          skipCost: Boolean(options.skipCost),
          skipRotate: Boolean(options.skipRotate),
          skipBonus: Boolean(options.skipBonus),
        },
        blueSlot == null ? `研究 ${tileId}` : `研究 ${tileId}（蓝槽 ${blueSlot}）`,
      ))
    ));
  }

  function appendResourceBonus(actor, bonus, events) {
    const gain = {};
    for (const key of ["credits", "energy", "publicity", "score", "aomomoFossils"]) {
      if (bonus?.[key]) gain[key] = Number(bonus[key]);
    }
    if (Object.keys(gain).length) {
      players.gainResources(actor, gain);
      events.push({ type: "science_resource_bonus", playerId: actor.id, gain });
    }
  }

  function applyHeliosReward(root, actor, techType, tileId, events) {
    const descriptor = helios?.buildHeliosPassiveRewardEffect?.(actor, techType, tileId);
    if (!descriptor) return;
    const slotId = descriptor.options?.slotId;
    const placed = helios.placeHeliosPassiveSlot(actor, slotId);
    if (!placed.ok) return;
    const reward = helios.getHeliosSlotReward(slotId);
    if (reward?.data) {
      for (let index = 0; index < reward.data; index += 1) {
        data.gainData(actor, { source: "industry_helios", root });
      }
    } else {
      appendResourceBonus(actor, reward, events);
    }
    events.push({ type: "industry_helios_passive_reward", playerId: actor.id, slotId });
  }

  function executeResearchChoice(root, actorId, choice, options = {}) {
    const actor = getActor(root, actorId);
    const legal = listResearchChoices(root, actorId, options)
      .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
    if (!actor || !legal) return fail("SCIENCE_TECH_CHOICE_STALE", "科技选择已失效");
    const context = createActionContext(root, actor.id);
    const takeOptions = {
      tileId: legal.target.tileId,
      blueSlot: legal.target.blueSlot,
      techTypes: options.techTypes,
      skipCost: Boolean(options.skipCost),
      skipRotation: Boolean(options.skipRotate),
    };
    let result;
    if (options.skipBonus) {
      const selected = tech.resolver.selectTechTile(context, takeOptions);
      if (!selected.ok || selected.needsBlueSlotChoice) return selected;
      if (!takeOptions.skipCost) {
        const cost = tech.resolver.getResearchPublicityCost(actor);
        const spent = players.spendResources(actor, { publicity: cost });
        if (!spent.ok) return spent;
      }
      result = tech.resolver.takeSelectedTechTile(context, {
        ...takeOptions,
        expectedBonusId: selected.bonusId,
        expectedFirstTake: selected.firstTake,
      });
      if (result.ok && !options.skipRotate) {
        const rotated = tech.resolver.rotateForResearch(context, 1);
        if (!rotated.ok) return rotated;
      }
    } else {
      result = tech.resolver.executeTakeTech(context, takeOptions);
    }
    if (!result?.ok) return result;
    const events = [{
      type: "researchTech",
      playerId: actor.id,
      tileId: result.tileId,
      techType: result.techType,
      firstTake: Boolean(result.firstTake),
    }];
    const runezuClaim = aliens.runezu?.claimTechSymbol?.(
      getSlice(root, "alienGameState", "aliens"),
      result.tileId,
      actor,
      { claimedAt: `state:${root.meta?.stateVersion ?? 0}:tech:${result.tileId}` },
    );
    if (runezuClaim?.ok) {
      events.push({
        type: "runezuTechSymbolClaimed",
        playerId: actor.id,
        tileId: result.tileId,
        symbolId: runezuClaim.symbolId,
      });
    }
    if (industryPassives?.shouldApplyTuringBlueTechPublicity?.(actor, result.tileId)) {
      players.gainResources(actor, {
        publicity: industryPassives.getTuringBlueTechPublicityGain(),
      });
    }
    if (result.tileId === "purple1") {
      data.gainData(actor, { source: "purple1", root });
      data.gainData(actor, { source: "purple1", root });
    }
    applyHeliosReward(root, actor, result.techType, result.tileId, events);
    const after = options.afterResearchReward;
    if (after?.kind === "techTypeCountScore") {
      const count = Object.keys(actor.techState?.ownedTiles || {}).filter((tileId) => (
        actor.techState.ownedTiles[tileId] && tech.getTechType(tileId) === result.techType
      )).length;
      players.gainResources(actor, { score: count * Math.max(0, Number(after.scorePer) || 0) });
    } else if (after?.kind === "resourceValueScore") {
      players.gainResources(actor, {
        score: Math.max(0, Number(actor.resources?.[after.resource]) || 0),
      });
    } else if (after?.kind === "publicityIfNotFirstTake" && !result.firstTake) {
      players.gainResources(actor, { publicity: Math.max(0, Number(after.publicity) || 0) });
    }
    return { ...result, events };
  }

  function getSpeciesTraceApi(slot) {
    const byId = {
      "九折": ["jiuzhe", "canPlaceJiuzheTrace", "placeJiuzheTrace"],
      "异常点": ["yichangdian", "canPlaceYichangdianTrace", "placeYichangdianTrace"],
      "方舟": ["fangzhou", "canPlaceFangzhouTrace", "placeFangzhouTrace"],
      "半人马": ["banrenma", "canPlaceBanrenmaTrace", "placeBanrenmaTrace"],
      "虫": ["chong", "canPlaceChongTrace", "placeChongTrace"],
      "阿米巴": ["amiba", "canPlaceAmibaTrace", "placeAmibaTrace"],
      "奥陌陌": ["aomomo", "canPlaceAomomoTrace", "placeAomomoTrace"],
      "符文族": ["runezu", "canPlaceRunezuTrace", "placeRunezuTrace"],
    };
    const descriptor = byId[slot?.alienId || slot?.assignedAlienId];
    if (!descriptor) return null;
    const [speciesId, canMethod, placeMethod] = descriptor;
    return aliens[speciesId] ? { speciesId, api: aliens[speciesId], canMethod, placeMethod } : null;
  }

  function listAlienTraceChoices(root, actorId, traceType) {
    const actor = getActor(root, actorId);
    const alienState = getSlice(root, "alienGameState", "aliens");
    if (!actor) return [];
    const choices = [];
    for (const alienSlotId of aliens.ALIEN_SLOT_IDS || []) {
      const slot = aliens.getAlienSlot(alienState, alienSlotId);
      if (!slot) continue;
      if (!slot.revealed) {
        choices.push(makeChoice(
          "choose_target",
          `trace:${alienSlotId}:${traceType}`,
          { kind: "planet-reward-alien-trace", alienSlotId, traceType },
          {},
          `${aliens.getAlienSlotLabel(alienSlotId)} ${aliens.getTraceTypeLabel(traceType)}`,
        ));
        continue;
      }
      const species = getSpeciesTraceApi(slot);
      const positions = species?.api?.TRACE_POSITIONS
        || species?.api?.getPositionsForTraceType?.(traceType)
        || [];
      for (const position of positions) {
        const check = species.api[species.canMethod]?.(
          alienState,
          alienSlotId,
          traceType,
          position,
          actor,
          {},
        );
        if (check?.ok) choices.push(makeChoice(
          "choose_target",
          `trace:${alienSlotId}:${traceType}:${species.speciesId}:${position}`,
          { kind: "planet-reward-alien-trace", alienSlotId, traceType, speciesId: species.speciesId, position },
          {},
          `${aliens.getAlienSlotLabel(alienSlotId)} ${position}`,
        ));
      }
    }
    return choices;
  }

  function placeAlienTrace(root, actorId, choice) {
    const actor = getActor(root, actorId);
    const alienState = getSlice(root, "alienGameState", "aliens");
    const legal = listAlienTraceChoices(root, actorId, choice?.target?.traceType)
      .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
    if (!actor || !legal) return fail("SCIENCE_TRACE_CHOICE_STALE", "外星人痕迹选择已失效");
    const slot = aliens.getAlienSlot(alienState, legal.target.alienSlotId);
    if (!slot?.traces?.[legal.target.traceType]?.firstPlaced) {
      const placed = aliens.placeFirstTrace(
        alienState,
        legal.target.alienSlotId,
        legal.target.traceType,
        actor.color,
      );
      if (placed?.ok && !placed.extraOnly && legal.target.traceType === "yellow") {
        players.gainResources(actor, { publicity: 1 });
        if (!Array.isArray(actor.alienCards)) actor.alienCards = [];
        actor.alienCards.push({
          id: `alien-trace-reward:${legal.target.alienSlotId}:${actor.id}`,
          kind: "alien",
          source: "first-yellow-trace",
          alienSlotId: legal.target.alienSlotId,
        });
      }
      return placed;
    }
    if (!slot.revealed) {
      return aliens.addExtraTrace(
        alienState,
        legal.target.alienSlotId,
        legal.target.traceType,
        actor.color,
      );
    }
    const species = getSpeciesTraceApi(slot);
    return species?.api?.[species.placeMethod]?.(
      alienState,
      legal.target.alienSlotId,
      legal.target.traceType,
      legal.target.position,
      actor,
      {},
    ) || fail("SCIENCE_TRACE_OWNER_MISSING", "外星人痕迹 owner 缺失");
  }

  function createActionDefinitions() {
    const sessionRequired = () => fail(
      "SCIENCE_SESSION_REQUIRED",
      "Science action 必须由 Effect Session 执行",
    );
    return [
      standardAction.createOptionDefinition("scan", {
        label: "扫描",
        getOptions(actionContext) {
          const root = actionContext?.workingRoot || actionContext;
          const actor = getActor(root, actionContext?.standardActionAuthority?.actorId);
          const start = canStartMain(root, actor);
          if (!start.ok) return start;
          const check = scanEffects.canExecuteScan(actor, { standardAction: true });
          return check.ok
            ? { ok: true, choices: [{ target: { kind: "standard-scan" }, label: "扫描" }] }
            : check;
        },
        canExecute(actionContext) { return this.getOptions(actionContext); },
        execute: sessionRequired,
      }),
      standardAction.createOptionDefinition("place_data", {
        label: "放置数据",
        getOptions(actionContext) {
          const root = actionContext?.workingRoot || actionContext;
          const actor = getActor(root, actionContext?.standardActionAuthority?.actorId);
          const result = abilities.data.listPlacementChoices(actor);
          return result.ok ? {
            ok: true,
            choices: [{ target: { kind: "place-data" }, label: "放置数据" }],
          } : result;
        },
        canExecute(actionContext) { return this.getOptions(actionContext); },
        execute: sessionRequired,
      }),
      standardAction.createOptionDefinition("analyze", {
        label: "分析",
        getOptions(actionContext) {
          const root = actionContext?.workingRoot || actionContext;
          const actor = getActor(root, actionContext?.standardActionAuthority?.actorId);
          const start = canStartMain(root, actor);
          if (!start.ok) return start;
          const skipCost = Boolean(industryPassives?.canAnalyzeWithoutEnergy?.(actor));
          const check = data.canAnalyzeData(actor, { skipEnergyCost: skipCost });
          return check.ok ? {
            ok: true,
            choices: [{
              target: { kind: "computer", requiredSlot: 6 },
              payload: { skipCost },
              label: "分析",
            }],
          } : check;
        },
        canExecute(actionContext) { return this.getOptions(actionContext); },
        execute: sessionRequired,
      }),
      standardAction.createOptionDefinition("research_tech", {
        label: "科技",
        getOptions(actionContext) {
          const root = actionContext?.workingRoot || actionContext;
          const actorId = actionContext?.standardActionAuthority?.actorId;
          const actor = getActor(root, actorId);
          const start = canStartMain(root, actor);
          if (!start.ok) return start;
          const availability = researchTechAction.getResearchOptions(
            createActionContext(root, actorId),
            {},
          );
          if (!availability.ok) return availability;
          return availability.choices?.length ? {
            ok: true,
            choices: [{
              target: { kind: "research-tech" },
              payload: { skipCost: false, skipRotate: false, skipBonus: false },
              label: "研究科技",
            }],
          } : fail("SCIENCE_TECH_UNAVAILABLE", "没有可研究科技");
        },
        canExecute(actionContext) { return this.getOptions(actionContext); },
        execute: sessionRequired,
      }),
    ];
  }

  function createScienceDomain(options = {}) {
    const runtime = options.runtime;
    const commitWorkingState = options.commitWorkingState;
    if (typeof runtime?.registerExecutor !== "function") {
      throw new TypeError("Science domain 缺少 Effect runtime");
    }
    if (typeof commitWorkingState !== "function") {
      throw new TypeError("Science domain 缺少 commitWorkingState");
    }

    function committed(state, root, source) {
      return commitWorkingState(state, { source, executorId: EXECUTOR_ID });
    }

    function scienceResult(state, root, source, extra = {}) {
      return { ok: true, nextState: committed(state, root, source), ...extra };
    }

    function scanDecisionEffect(type, ownerId, payload, decisionKind = "choose_target") {
      return {
        priority: "direct",
        effect: { type, kind: "decision", decisionKind, ownerId, payload: clone(payload) },
      };
    }

    function scanQueue(root, actor, options = {}) {
      const queue = scanEffects.buildScanEffectQueue(actor, {
        fullScanAction: true,
        includeFinalize: true,
        turnState: getSlice(root, "turnState", "turn"),
      });
      return queue.map((entry) => {
        if ([scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN,
          scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN,
          scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN].includes(entry.type)) {
          const planetId = entry.type === scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN
            ? "mercury"
            : "earth";
          const planet = solar.createSolarSnapshot(getSlice(root, "solarState", "solarSystem"))
            .planetLocations.find((candidate) => candidate.planetId === planetId);
          if (entry.options?.cost && !players.canAfford(actor, entry.options.cost)) return null;
          if (!listNebulaChoices(root, { sectorX: planet?.x, gainData: true }).length) return null;
          return scanDecisionEffect(EFFECT_TYPES.SCAN_TARGET, actor.id, {
            sectorX: planet?.x ?? null,
            gainData: true,
            cost: entry.options?.cost || null,
            label: entry.label,
          });
        }
        if (entry.type === scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN) {
          if (!publicScanChoices(root).length) return null;
          return scanDecisionEffect(EFFECT_TYPES.PUBLIC_SCAN, actor.id, {
            selected: 0,
            max: 1 + Math.max(0, Number(actor.resources?.additionalPublicScan) || 0),
            consumeMarkers: true,
          }, "choose_card");
        }
        if (entry.type === scanEffects.EFFECT_TYPES.HAND_SCAN) {
          if (!handScanChoices(root, actor.id).length) return null;
          return scanDecisionEffect(EFFECT_TYPES.HAND_SCAN, actor.id, {}, "choose_card");
        }
        if (entry.type === scanEffects.EFFECT_TYPES.SCAN_ACTION_4) {
          if (!listScanAction4Choices(root, actor.id).length) return null;
          return scanDecisionEffect(EFFECT_TYPES.SCAN_ACTION_4, actor.id, {}, "choose_target");
        }
        return null;
      }).filter(Boolean);
    }

    function listScanAction4Choices(root, actorId) {
      const actor = getActor(root, actorId);
      if (!actor) return [];
      const choices = [];
      if (players.canAfford(actor, { energy: 1 })) {
        choices.push(makeChoice(
          "choose_target",
          "scan4:launch",
          { mode: "launch" },
          {},
          "发射探测器",
        ));
      }
      const context = createActionContext(root, actor.id);
      for (const rocket of getSlice(root, "rocketState", "pieces").rockets || []) {
        if (rocket.playerId !== actor.id) continue;
        for (const move of abilities.rocket.listMoveRequirements(context, actor, rocket.id)) {
          if (move.requiredMovePoints > 1) continue;
          choices.push(makeChoice(
            "choose_target",
            `scan4:move:${rocket.id}:${move.id}`,
            {
              mode: "move",
              rocketId: rocket.id,
              deltaX: move.deltaX,
              deltaY: move.deltaY,
            },
            { requiredMovePoints: move.requiredMovePoints },
            `移动 ${rocket.id} ${move.id}`,
          ));
        }
      }
      return choices;
    }

    function listIncomeChoices(root, actorId) {
      const actor = getActor(root, actorId);
      return (actor?.hand || []).map((card) => makeChoice(
        "choose_card",
        `income:${card.id}`,
        { cardInstanceId: card.id },
        {},
        `收入 ${cards.getCardLabel(card)}`,
      ));
    }

    function listPickCardChoices(root) {
      return (getSlice(root, "cardState", "cards").publicCards || []).flatMap((card, index) => (
        card ? [makeChoice(
          "choose_card",
          `pick:${card.id}`,
          { cardInstanceId: card.id, publicSlotIndex: index },
          {},
          cards.getCardLabel(card),
        )] : []
      ));
    }

    runtime.registerExecutor(EFFECT_TYPES.EXECUTE, (state, effect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const action = effect.payload?.action;
      const actor = getActor(root, action?.actorId);
      if (!actor || !ACTION_FAMILIES.includes(action?.family)) {
        return fail("SCIENCE_ACTION_STALE", "Science action 已失效");
      }
      if (action.family === "scan") {
        const cost = action.payload?.skipCost ? {} : scanEffects.getStandardScanCost(actor);
        const paid = abilities.executeAbility("payScanCost", createActionContext(root, actor.id), { cost });
        if (!paid.ok) return paid;
        if (!action.payload?.skipCost) consumeAlienLabPanel(actor, "yellow");
        if (!action.payload?.nestedCardEffect) actor.mainActionCompleted = true;
        return scienceResult(state, root, action.family, {
          spawnedEffects: scanQueue(root, actor),
          events: [{ type: "scanAction", playerId: actor.id, executorId: EXECUTOR_ID }],
          history: [{ type: "science_action", family: action.family, cost }],
        });
      }
      if (action.family === "place_data") {
        return scienceResult(state, root, action.family, {
          spawnedEffects: [scanDecisionEffect(
            EFFECT_TYPES.PLACE_DATA,
            actor.id,
            { action: clone(action) },
            "choose_target",
          )],
        });
      }
      if (action.family === "analyze") {
        return scienceResult(state, root, action.family, {
          spawnedEffects: [{
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.ANALYZE,
              ownerId: actor.id,
              payload: { action: clone(action) },
            },
          }],
        });
      }
      return scienceResult(state, root, action.family, {
        spawnedEffects: [scanDecisionEffect(EFFECT_TYPES.RESEARCH, actor.id, {
          options: clone(action.payload || {}),
          mainAction: true,
        })],
      });
    });

    runtime.registerExecutor(EFFECT_TYPES.SCAN_TARGET, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, listNebulaChoices(root, {
          sectorX: effect.payload?.sectorX,
          nebulaIds: effect.payload?.nebulaIds,
          gainData: effect.payload?.gainData,
        }));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        if (effect.payload?.cost) {
          const actor = getActor(root, effect.ownerId);
          const spent = players.spendResources(actor, effect.payload.cost);
          if (!spent.ok) return spent;
        }
        const result = executeNebulaScan(root, effect.ownerId, choice, effect.payload || {});
        if (!result.ok) return result;
        return scienceResult(state, root, EFFECT_TYPES.SCAN_TARGET, {
          spawnedEffects: [{
            priority: "direct",
            effect: { type: EFFECT_TYPES.SETTLE, ownerId: effect.ownerId },
          }],
          events: clone(result.events || []),
          history: [{ type: "science_scan", nebulaId: choice.target.nebulaId }],
        });
      },
    });

    function publicScanChoices(root) {
      const cardState = getSlice(root, "cardState", "cards");
      return (cardState.publicCards || []).flatMap((card, publicSlotIndex) => {
        if (!card) return [];
        const code = Number(card.scanActionCode ?? cards.getCatalogEntryForCard(card)?.scan_action_code);
        return listNebulaChoices(root, { nebulaIds: NEBULA_IDS_BY_SCAN_CODE[code] || [], gainData: true })
          .map((choice) => makeChoice(
            "choose_card",
            `public:${card.id}:${choice.target.nebulaId}`,
            { cardInstanceId: card.id, publicSlotIndex, nebulaId: choice.target.nebulaId },
            { gainData: true },
            `${cards.getCardLabel(card)} → ${data.getNebulaLabel(choice.target.nebulaId)}`,
          ));
      });
    }

    runtime.registerExecutor(EFFECT_TYPES.PUBLIC_SCAN, {
      execute(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const choices = publicScanChoices(root);
        return scienceResult(state, root, `${EFFECT_TYPES.PUBLIC_SCAN}:prepare`, {
          spawnedEffects: choices.length ? [scanDecisionEffect(
            EFFECT_TYPES.PUBLIC_SCAN,
            effect.ownerId,
            clone(effect.payload || {}),
            "choose_card",
          )] : [],
          events: choices.length ? [] : [{ type: "publicScanSkipped", reason: "no_legal_target" }],
        });
      },
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const choices = publicScanChoices(root);
        if ((Number(effect.payload?.selected) || 0) > 0) {
          choices.push(makeChoice("choose_card", "public:done", { done: true }, {}, "结束公共牌扫描"));
        }
        return formalizeChoices(root, effect.ownerId, choices);
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        if (choice?.target?.done) {
          return scienceResult(state, root, EFFECT_TYPES.PUBLIC_SCAN, {
            events: [{ type: "publicScanCompleted", selected: effect.payload?.selected || 0 }],
          });
        }
        const legal = publicScanChoices(root)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        if (!legal) return fail("SCIENCE_PUBLIC_SCAN_STALE", "公共牌扫描选择已失效");
        const actor = getActor(root, effect.ownerId);
        const cardState = getSlice(root, "cardState", "cards");
        const card = cardState.publicCards[legal.target.publicSlotIndex];
        const result = executeNebulaScan(root, actor.id, makeChoice(
          "choose_target",
          `nebula:${legal.target.nebulaId}`,
          { nebulaId: legal.target.nebulaId },
          { gainData: true },
        ), { nebulaIds: [legal.target.nebulaId], gainData: true, source: "public_scan" });
        if (!result.ok) return result;
        cardState.publicCards[legal.target.publicSlotIndex] = null;
        cards.addToDiscardPile(cardState, card);
        const replenished = cards.replenishPublicSlot(
          cardState,
          getSlice(root, "playerState", "players"),
          legal.target.publicSlotIndex,
          () => nextCommittedRandom(root),
          { createCardInstance: (entry) => cards.createCommittedCardInstance(root, entry) },
        );
        const selected = (Number(effect.payload?.selected) || 0) + 1;
        if (selected > 1 && effect.payload?.consumeMarkers) {
          actor.resources.additionalPublicScan = Math.max(
            0,
            (Number(actor.resources.additionalPublicScan) || 0) - 1,
          );
        }
        const spawnedEffects = [{
          priority: "direct",
          effect: { type: EFFECT_TYPES.SETTLE, ownerId: actor.id },
        }];
        if (selected < (Number(effect.payload?.max) || 1) && publicScanChoices(root).length) {
          spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.PUBLIC_SCAN, actor.id, {
            selected,
            max: effect.payload.max,
            consumeMarkers: Boolean(effect.payload?.consumeMarkers),
          }, "choose_card"));
        }
        return scienceResult(state, root, EFFECT_TYPES.PUBLIC_SCAN, {
          spawnedEffects,
          irreversible: replenished ? { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" } : null,
          rng: replenished ? [{ owner: DOMAIN_ID, cursor: root.meta?.rngState?.science?.cursor || 0 }] : [],
          events: clone(result.events || []),
        });
      },
    });

    function handScanChoices(root, actorId) {
      const actor = getActor(root, actorId);
      if (!actor) return [];
      return (actor.hand || []).flatMap((card) => {
        const code = Number(card.scanActionCode ?? cards.getCatalogEntryForCard(card)?.scan_action_code);
        return listNebulaChoices(root, { nebulaIds: NEBULA_IDS_BY_SCAN_CODE[code] || [], gainData: true })
          .map((choice) => makeChoice(
            "choose_card",
            `hand:${card.id}:${choice.target.nebulaId}`,
            { cardInstanceId: card.id, nebulaId: choice.target.nebulaId },
            { gainData: true },
            `${cards.getCardLabel(card)} → ${data.getNebulaLabel(choice.target.nebulaId)}`,
          ));
      });
    }

    runtime.registerExecutor(EFFECT_TYPES.HAND_SCAN, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, handScanChoices(root, effect.ownerId));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const legal = handScanChoices(root, effect.ownerId)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        const actor = getActor(root, effect.ownerId);
        if (!actor || !legal) return fail("SCIENCE_HAND_SCAN_STALE", "手牌扫描选择已失效");
        const result = executeNebulaScan(root, actor.id, makeChoice(
          "choose_target",
          `nebula:${legal.target.nebulaId}`,
          { nebulaId: legal.target.nebulaId },
          { gainData: true },
        ), { nebulaIds: [legal.target.nebulaId], gainData: true, source: "hand_scan" });
        if (!result.ok) return result;
        const index = actor.hand.findIndex((card) => card.id === legal.target.cardInstanceId);
        const removed = cards.discardFromHandAtIndex(actor, index);
        if (!removed.ok) return removed;
        cards.addToDiscardPile(getSlice(root, "cardState", "cards"), removed.card);
        return scienceResult(state, root, EFFECT_TYPES.HAND_SCAN, {
          spawnedEffects: [{ priority: "direct", effect: { type: EFFECT_TYPES.SETTLE, ownerId: actor.id } }],
          events: clone(result.events || []),
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.SCAN_ACTION_4, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, listScanAction4Choices(root, effect.ownerId));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const legal = listScanAction4Choices(root, effect.ownerId)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        if (!legal) return fail("SCIENCE_SCAN4_STALE", "发射/移动选择已失效");
        const result = abilities.executeAbility("scanAction4", createActionContext(root, effect.ownerId), {
          ...legal.target,
          choice: legal.target.mode,
          skipCost: legal.target.mode === "move",
          movementPoints: legal.target.mode === "move" ? 1 : undefined,
        });
        if (!result.ok) return result;
        const actor = getActor(root, effect.ownerId);
        const spawnedEffects = [];
        if (legal.target.mode === "launch" && industryPassives?.shouldScanEarthOnLaunch?.(actor)) {
          const earth = solar.createSolarSnapshot(getSlice(root, "solarState", "solarSystem"))
            .planetLocations.find((planet) => planet.planetId === "earth");
          if (listNebulaChoices(root, { sectorX: earth?.x, gainData: true }).length) {
            spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.SCAN_TARGET, actor.id, {
              sectorX: earth.x,
              gainData: true,
              label: "哨兵发射扫描地球",
            }));
          }
        }
        return scienceResult(state, root, EFFECT_TYPES.SCAN_ACTION_4, {
          spawnedEffects,
          events: clone(result.events || []),
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.SETTLE, (state, effect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const nebulaState = getSlice(root, "nebulaDataState", "data");
      const playerState = getSlice(root, "playerState", "players");
      const result = data.settleCompletedSectors(nebulaState, {
        players: playerState.players,
        source: "science",
        root,
        settledAt: `state:${root.meta?.stateVersion ?? 0}:science-settlement`,
      });
      const spawnedEffects = [];
      const events = [];
      for (const settlement of result.settlements || []) {
        const winner = getActor(root, settlement.winner?.playerId)
          || playerState.players.find((player) => player.color === settlement.winner?.playerColor);
        const runezuClaim = winner
          ? aliens.runezu?.claimSectorSymbol?.(
            getSlice(root, "alienGameState", "aliens"),
            settlement.sectorId,
            winner,
            { claimedAt: `state:${root.meta?.stateVersion ?? 0}:sector:${settlement.sectorId}` },
          )
          : null;
        if (runezuClaim?.ok) {
          events.push({
            type: "runezuSectorSymbolClaimed",
            sectorId: settlement.sectorId,
            playerId: winner.id,
            symbolId: runezuClaim.symbolId,
          });
        }
        for (const reward of data.buildSectorRewardDescriptors(settlement)) {
          const owner = getActor(root, reward.owner?.playerId)
            || playerState.players.find((player) => player.color === reward.owner?.playerColor);
          if (!owner) continue;
          if (reward.kind === "resource") appendResourceBonus(owner, reward.gain, events);
          if (reward.kind === "alien_trace") spawnedEffects.push(scanDecisionEffect(
            EFFECT_TYPES.ALIEN_TRACE,
            owner.id,
            { traceType: reward.traceType },
          ));
        }
        events.push({ type: "sectorCompleted", ...clone(settlement) });
      }
      return scienceResult(state, root, EFFECT_TYPES.SETTLE, { spawnedEffects, events });
    });

    function listPlaceDataChoices(root, actorId) {
      const actor = getActor(root, actorId);
      const result = abilities.data.listPlacementChoices(actor);
      if (!result.ok) return [];
      return result.choices.map((choice) => makeChoice(
        "choose_target",
        choice.blueSlot == null ? `data:${choice.target}` : `data:${choice.target}:${choice.blueSlot}`,
        { target: choice.target, blueSlot: choice.blueSlot ?? null },
        {},
        choice.label || "放置数据",
      ));
    }

    runtime.registerExecutor(EFFECT_TYPES.PLACE_DATA, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, listPlaceDataChoices(root, effect.ownerId));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const actor = getActor(root, effect.ownerId);
        const legal = listPlaceDataChoices(root, effect.ownerId)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        if (!actor || !legal) return fail("SCIENCE_PLACE_DATA_STALE", "放置数据已失效");
        const result = abilities.executeAbility("placeData", createActionContext(root, effect.ownerId), {
          target: legal.target.target,
          blueSlot: legal.target.blueSlot,
        });
        if (!result.ok) return result;
        const spawnedEffects = [];
        const events = [{
          type: "placeData",
          playerId: actor.id,
          placementKind: result.placementKind,
          placementSlot: result.placementSlot,
          blueSlot: result.blueSlot ?? null,
        }];
        for (const bonus of result.slotBonuses || (result.slotBonus ? [result.slotBonus] : [])) {
          if (bonus.type === "income" && listIncomeChoices(root, actor.id).length) {
            spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.INCOME, actor.id, {}, "choose_card"));
          } else if (bonus.type === "choose_card" && listPickCardChoices(root).length) {
            spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.PICK_CARD, actor.id, {}, "choose_card"));
          } else {
            appendResourceBonus(actor, bonus, events);
          }
        }
        return scienceResult(state, root, EFFECT_TYPES.PLACE_DATA, { spawnedEffects, events });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.INCOME, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, listIncomeChoices(root, effect.ownerId));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const actor = getActor(root, effect.ownerId);
        const legal = listIncomeChoices(root, effect.ownerId)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        const handIndex = actor?.hand?.findIndex((entry) => entry.id === legal?.target?.cardInstanceId) ?? -1;
        const card = handIndex >= 0 ? actor.hand[handIndex] : null;
        if (!actor || !card) return fail("SCIENCE_INCOME_STALE", "收入选择已失效");
        const gain = cards.getIncomeGainForCard(card);
        const discarded = cards.discardFromHandAtIndex(actor, handIndex);
        if (!discarded.ok) return discarded;
        cards.addToDiscardPile(getSlice(root, "cardState", "cards"), discarded.card);
        const result = players.gainIncome(actor, gain, {
          blindDraw: (target) => cards.blindDraw(
            getSlice(root, "cardState", "cards"),
            getSlice(root, "playerState", "players"),
            target,
            () => nextCommittedRandom(root),
            { createCardInstance: (entry) => cards.createCommittedCardInstance(root, entry) },
          ),
          gainData: (target) => data.gainData(target, { source: "place_data_income", root }),
        });
        if (!result?.ok) return result;
        return scienceResult(state, root, EFFECT_TYPES.INCOME, {
          events: [{ type: "place_data_income", playerId: actor.id, cardInstanceId: card.id }],
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.PICK_CARD, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, listPickCardChoices(root));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const legal = listPickCardChoices(root)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        const actor = getActor(root, effect.ownerId);
        if (!actor || !legal) return fail("SCIENCE_PICK_CARD_STALE", "精选牌选择已失效");
        const result = cards.pickFromPublic(
          getSlice(root, "cardState", "cards"),
          getSlice(root, "playerState", "players"),
          actor,
          legal.target.publicSlotIndex,
          () => nextCommittedRandom(root),
          { createCardInstance: (entry) => cards.createCommittedCardInstance(root, entry) },
        );
        if (!result.ok) return result;
        return scienceResult(state, root, EFFECT_TYPES.PICK_CARD, {
          irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
          rng: [{ owner: DOMAIN_ID, cursor: root.meta?.rngState?.science?.cursor || 0 }],
          events: [{ type: "place_data_pick_card", playerId: actor.id, cardInstanceId: result.card?.id }],
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.ANALYZE, (state, effect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, effect.ownerId);
      const result = abilities.executeAbility("analyzeData", createActionContext(root, actor?.id), {
        skipCost: Boolean(effect.payload?.action?.payload?.skipCost),
      });
      if (!actor || !result.ok) return result || fail("SCIENCE_ANALYZE_STALE", "分析已失效");
      actor.mainActionCompleted = true;
      const choices = listAlienTraceChoices(root, actor.id, "blue");
      return scienceResult(state, root, EFFECT_TYPES.ANALYZE, {
        spawnedEffects: choices.length
          ? [scanDecisionEffect(EFFECT_TYPES.ALIEN_TRACE, actor.id, { traceType: "blue" })]
          : [],
        events: [{ type: "analyze", playerId: actor.id, clearedCount: result.clearedCount }],
      });
    });

    runtime.registerExecutor(EFFECT_TYPES.ALIEN_TRACE, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const traceTypes = effect.payload?.traceType
          ? [effect.payload.traceType]
          : (aliens.TRACE_TYPES || ["pink", "yellow", "blue"]);
        return formalizeChoices(root, effect.ownerId, traceTypes.flatMap((traceType) => (
          listAlienTraceChoices(root, effect.ownerId, traceType)
        )));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const result = placeAlienTrace(root, effect.ownerId, choice);
        if (!result?.ok) return result;
        return scienceResult(state, root, EFFECT_TYPES.ALIEN_TRACE, {
          events: [{
            type: "alienTrace",
            playerId: effect.ownerId,
            traceType: choice.target.traceType,
            alienSlotId: choice.target.alienSlotId,
          }],
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.RESEARCH, {
      execute(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const choices = listResearchChoices(root, effect.ownerId, effect.payload?.options || {});
        return scienceResult(state, root, `${EFFECT_TYPES.RESEARCH}:prepare`, {
          spawnedEffects: choices.length ? [scanDecisionEffect(
            EFFECT_TYPES.RESEARCH,
            effect.ownerId,
            clone(effect.payload || {}),
          )] : [],
          events: choices.length ? [] : [{ type: "researchTechSkipped", reason: "no_legal_target" }],
        });
      },
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        return formalizeChoices(root, effect.ownerId, listResearchChoices(
          root,
          effect.ownerId,
          effect.payload?.options || {},
        ));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const result = executeResearchChoice(
          root,
          effect.ownerId,
          choice,
          effect.payload?.options || {},
        );
        if (!result.ok) return result;
        const actor = getActor(root, effect.ownerId);
        if (!effect.payload?.options?.skipCost) consumeAlienLabPanel(actor, "pink");
        if (effect.payload?.mainAction && actor) actor.mainActionCompleted = true;
        const spawnedEffects = [];
        if (result.awaitingCardSelection) {
          spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.PICK_CARD, effect.ownerId, {}, "choose_card"));
        }
        if (result.tileId === "orange1") {
          const launch = abilities.executeAbility("launchProbe", createActionContext(root, effect.ownerId), {
            skipCost: true,
            source: "tech",
          });
          if (!launch.ok) return launch;
        }
        if (effect.payload?.options?.afterResearchReward?.kind === "repeatBonus"
          && !effect.payload.options.skipBonus) {
          const repeated = tech.resolver.applyTechBonus(createActionContext(root, effect.ownerId), {
            bonusId: result.bonusId,
            firstTake: false,
            skipCardSelection: true,
          });
          if (!repeated.ok) return repeated;
          if (repeated.awaitingCardSelection) {
            spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.PICK_CARD, effect.ownerId, {}, "choose_card"));
          }
        }
        return scienceResult(state, root, EFFECT_TYPES.RESEARCH, {
          spawnedEffects,
          irreversible: { code: "tech_bonus_reveal", reason: "拿取科技后露出下一张 bonus" },
          events: clone(result.events || []),
          history: [{ type: "science_research", tileId: result.tileId, executorId: EXECUTOR_ID }],
        });
      },
    });

    function createEffectGroup(_state, action) {
      if (!ACTION_FAMILIES.includes(action?.family)) {
        return fail("SCIENCE_FAMILY_INVALID", `Science domain 不接受 ${action?.family || "<missing>"}`);
      }
      return {
        kind: action.phase === "quick" ? "quick" : "action",
        ownerId: action.actorId || null,
        action: clone(action),
        effects: [{
          type: EFFECT_TYPES.EXECUTE,
          ownerId: action.actorId || null,
          payload: { action: clone(action) },
        }],
      };
    }

    return Object.freeze({ actionFamilies: ACTION_FAMILIES, createEffectGroup });
  }

  return Object.freeze({
    DOMAIN_ID,
    ACTION_FAMILIES,
    EXECUTOR_ID,
    EFFECT_TYPES,
    createActionDefinitions,
    createScienceDomain,
    createActionContext,
    listNebulaChoices,
    executeNebulaScan,
    listResearchChoices,
    executeResearchChoice,
    formalizeChoices,
  });
});
