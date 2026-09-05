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
  let stateSequences = root.SetiStateSequences;
  let cardEffects = root.SetiCardEffects;
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
    stateSequences = stateSequences || require("../state/sequences");
    cardEffects = cardEffects || require("../cards/effects");
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
    stateSequences,
    cardEffects,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiScienceSession = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
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
  stateSequences,
  cardEffects,
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
    // 统一扫描节点：一次「往扇区放信号」由 SCAN_STEP 完成（按 mode 枚举目标、
    // 可选跳过、逐次扫描；hand/public 模式含弃牌与多步流）。扫描流结束后由
    // SCAN_FINALIZE 串尾节点统一触发一次扇区结算（规则书 P13：同一 flow 内
    // 完成扇区不提前重置，后续信号只能放额外标记）。
    SCAN_STEP: "science_domain_scan_step",
    SCAN_FINALIZE: "science_domain_scan_finalize",
    SCAN_ACTION_4: "science_domain_scan_action_4",
    PLACE_DATA: "science_domain_place_data",
    INCOME: "science_domain_income",
    PICK_CARD: "science_domain_pick_card",
    ANALYZE: "science_domain_analyze",
    RESEARCH: "science_domain_research",
    ALIEN_TRACE: "science_domain_alien_trace",
    SETTLE: "science_domain_settle",
    PUBLIC_REFILL: "science_domain_public_refill",
  });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function getWorkingRoot(state, workingContext) {
    return workingContext?.state || workingContext || state;
  }

  function getWorkingSlice(root, key) {
    return root?.[key] || {};
  }

  function getActor(root, actorId = null) {
    const playersState = getWorkingSlice(root, "players");
    const resolvedId = actorId || root?.turn?.currentPlayerId || null;
    return (playersState.players || []).find((player) => player.id === resolvedId) || null;
  }

  function createActionContext(root, actorId) {
    const playersState = getWorkingSlice(root, "players");
    const solarSystemState = getWorkingSlice(root, "solarSystem");
    const context = {
      state: root,
      players: playersState,
      cards: getWorkingSlice(root, "cards"),
      pieces: getWorkingSlice(root, "pieces"),
      solarSystem: solarSystemState,
      data: getWorkingSlice(root, "data"),
      planets: getWorkingSlice(root, "planets"),
      tech: getWorkingSlice(root, "tech"),
      aliens: getWorkingSlice(root, "aliens"),
      turn: { ...getWorkingSlice(root, "turn"), currentPlayerId: actorId || root.turn?.currentPlayerId },
      match: root.match,
      standardActionAuthority: {
        actorId,
        stateVersion: root?.meta?.stateVersion ?? 0,
        decisionVersion: root?.match?.decisionVersion ?? 0,
      },
      ensurePlayerTechState(player) {
        if (!player.techState) player.techState = players.normalizePlayerTechState(null);
      },
      getPlanetLocations: () => solar.createSolarSnapshot(solarSystemState).planetLocations,
    };
    context.getEarthSectorCoordinate = () => {
      const earth = context.getPlanetLocations().find((planet) => planet.planetId === "earth");
      return earth ? { x: earth.x, y: earth.y } : null;
    };
    context.rotateSolarOrbit = (count = 1) => {
      const before = clone(solarSystemState.rotation);
      solarSystemState.rotation = solar.applySolarOrbitRotation(solarSystemState.rotation, count);
      return abilities.rocket.settleRocketsAfterSolarRotation(
        context,
        before,
        solarSystemState.rotation,
      );
    };
    // 统一抽牌上下文：drawBasicCardToPlayer 共用 cards.createCardDrawContext
    const drawContext = cards.createCardDrawContext(
      context.cards,
      playersState,
      () => nextCommittedRandom(root),
      { root },
    );
    context.drawBasicCardToPlayer = (player) => drawContext.blindDraw(player);
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

  function makeChoice(family, choiceId, target = {}, payload = {}, summary = choiceId, presentation = null) {
    return {
      family,
      phase: "conditional",
      target: { choiceId, ...target },
      payload,
      summary,
      // 选择卡面等展示信息（精选牌、扫描选牌等），formalizeChoices 会原样保留
      ...(presentation ? { presentation } : {}),
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
      // choices 由 makeChoice 等每次新建 fresh 对象；session runtime
      // getDecisionSnapshot 存储时会再 clone，此处不再防御性克隆。
      const target = choice.target || null;
      const payload = choice.payload || {};
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
        // 保留选择卡面等展示信息（精选牌等），不能在此丢弃
        ...(choice.presentation ? { presentation: clone(choice.presentation) } : {}),
      };
    });
  }

  function canStartMain(root, actor) {
    if (!actor) return fail("SCIENCE_ACTOR_MISSING", "没有当前玩家");
    if (actor.mainActionCompleted) return fail("SCIENCE_MAIN_ACTION_COMPLETE", "主要行动已经完成");
    return { ok: true };
  }

  function consumeAlienLabPanel(actor, panelId) {
    if (!industryPassives?.hasActiveAlienLabPanel?.(actor, panelId)) return null;
    if (industryPassives.hasPermanentAlienLabPanels?.(actor)) return null;
    return industryState?.consumeAlienLabPanel?.(actor, panelId) || null;
  }

  function listNebulaChoices(root, options = {}) {
    const nebulaState = getWorkingSlice(root, "data");
    let nebulaIds = options.nebulaIds || [];
    if (options.sectorX != null) {
      const found = solar.getNebulaAtCoordinate(
        solar.mod8(options.sectorX),
        5,
        getWorkingSlice(root, "solarSystem").sectorBySlot,
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

  // 扫描结算统一出口：任何扫描流（扫描主行动、卡牌扫描、行星奖励扫描等）在
  // 串尾追加一次 SCAN_FINALIZE，由它统一触发一次 SETTLE。SETTLE executor 幂等，
  // 只结算已完成的扇区，因此每个扫描流后调用一次是安全且统一的。
  function settleAfterScan(ownerId) {
    return { priority: "direct", effect: { type: EFFECT_TYPES.SETTLE, ownerId } };
  }

  // 扫描流串尾判定节点：非决策，executor 只负责触发一次 SETTLE。独立节点保证
  // 跳过任意扫描节点后仍会触发扇区结算（跳过时若该节点是扫描 flow 最后节点
  // 仍触发结算），且撤销最后一次扫描时随尾部节点一起移除/重排。
  function scanFinalizeEffect(ownerId) {
    return { priority: "direct", effect: { type: EFFECT_TYPES.SCAN_FINALIZE, ownerId } };
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
    const techState = getWorkingSlice(root, "tech");
    if (!actor || !techState) return [];
    if (options.requireCondition?.type === "resourceEquals"
      && Number(actor.resources?.[options.requireCondition.resource] || 0)
        !== Number(options.requireCondition.count || 0)) return [];
    if (options.requireCondition?.type === "resourceThreshold"
      && Number(actor.resources?.[options.requireCondition.resource] || 0)
        < Number(options.requireCondition.count || 0)) return [];
    let tileIds = tech.resolver.listTakeableTiles(
      techState,
      actor.techState || players.normalizePlayerTechState(null),
      options.techTypes?.length ? { techTypes: options.techTypes } : {},
    );
    if (options.researchedByOthersOnly) {
      const playersState = getWorkingSlice(root, "players");
      tileIds = tileIds.filter((tileId) => playersState.players.some((player) => (
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

  function appendResourceBonus(actor, bonus, events, sourceKey = null) {
    const gain = {};
    for (const key of ["credits", "energy", "publicity", "score", "aomomoFossils"]) {
      if (bonus?.[key]) gain[key] = Number(bonus[key]);
    }
    if (Object.keys(gain).length) {
      players.gainResources(actor, gain, sourceKey);
      events.push({ type: "science_resource_bonus", playerId: actor.id, gain, sourceKey });
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
      appendResourceBonus(actor, reward, events, "industryEffectScore");
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
      // 规则书：研究科技先公转、后选择。
      if (!options.skipRotate) {
        const rotated = tech.resolver.rotateForResearch(context, 1);
        if (!rotated.ok) return rotated;
      }
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
      // skipBonus 单步取科技路径（蓝槽科技）：takeSelectedTechTile 不执行
      // firstTake 类型奖励给分（只有 executeTakeTech 的 applyTechBonus 会给），
      // 这里补上首次拿取同类型科技板块的 +2 分（记 techBonusScore）。
      if (result?.ok && result.firstTake) {
        const firstTakeScore = Math.max(0, Math.round(Number(tech?.FIRST_TAKE_TYPE_SCORE) || 0));
        if (firstTakeScore > 0) {
          players.gainResources(actor, { score: firstTakeScore }, "techBonusScore");
          result = { ...result, rewards: {
            ...(result.rewards || {}),
            firstTakeScore: (Number(result.rewards?.firstTakeScore) || 0) + firstTakeScore,
          } };
        }
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
      getWorkingSlice(root, "aliens"),
      result.tileId,
      actor,
      {},
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
      players.gainResources(actor, { score: count * Math.max(0, Number(after.scorePer) || 0) }, "techBonusScore");
    } else if (after?.kind === "resourceValueScore") {
      players.gainResources(actor, {
        score: Math.max(0, Number(actor.resources?.[after.resource]) || 0),
      }, "techBonusScore");
    } else if (after?.kind === "publicityIfNotFirstTake" && !result.firstTake) {
      players.gainResources(actor, { publicity: Math.max(0, Number(after.publicity) || 0) });
    }
    return { ...result, events };
  }

  function listAlienTraceChoices(root, actorId, traceType) {
    const actor = getActor(root, actorId);
    const alienState = getWorkingSlice(root, "aliens");
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
      const species = aliens.getSpeciesTraceApi(slot);
      // 已揭示槽位仍可把痕迹追加到 state 额外痕迹位（3 分/枚），规则书 P20 冗余位。
      if (slot.traces?.[traceType]?.firstPlaced) {
        choices.push(makeChoice(
          "choose_target",
          `trace:${alienSlotId}:${traceType}:state-extra`,
          { kind: "planet-reward-alien-trace", alienSlotId, traceType, stateExtra: true },
          {},
          `${aliens.getAlienSlotLabel(alienSlotId)} 额外痕迹位（3分）`,
        ));
      }
      // 方舟：痕迹可用来解锁对应颜色的 card2 解锁牌（文档 assets/aliens/方舟/implementation.md）。
      if (species?.speciesId === "fangzhou"
        && typeof aliens.fangzhou?.canUnlockCard2ForTrace === "function"
        && aliens.fangzhou.canUnlockCard2ForTrace(alienState, actor, traceType)) {
        choices.push(makeChoice(
          "choose_target",
          `trace:${alienSlotId}:${traceType}:fangzhou-unlock`,
          { kind: "planet-reward-alien-trace", alienSlotId, traceType, fangzhouUnlock: true },
          {},
          `${aliens.getAlienSlotLabel(alienSlotId)} 解锁方舟牌`,
        ));
      }
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
        if (check?.ok) {
          // 选项带奖励描述（如「虫族 黄3号：3分+虫族牌」），让玩家看清每个位置得到什么
          const reward = typeof species.api.getTraceReward === "function"
            ? species.api.getTraceReward(alienState, traceType, position)
            : null;
          const rewardText = formatTraceRewardLabel(reward);
          choices.push(makeChoice(
            "choose_target",
            `trace:${alienSlotId}:${traceType}:${species.speciesId}:${position}`,
            { kind: "planet-reward-alien-trace", alienSlotId, traceType, speciesId: species.speciesId, position },
            {},
            `${aliens.getAlienSlotLabel(alienSlotId)} ${traceTypeLabel(traceType)}${position}号位${rewardText ? `（${rewardText}）` : ""}`,
          ));
        }
      }
    }
    return choices;
  }

  function traceTypeLabel(traceType) {
    const labels = { pink: "粉", yellow: "黄", blue: "蓝" };
    return labels[traceType] || traceType;
  }

  // 统一痕迹位置奖励描述：gain（宣传/分/信用点/能量/数据）+ 盲抽/精选/外星人牌/化石面板。
  function formatTraceRewardLabel(reward) {
    if (!reward) return "";
    const parts = [];
    const gain = reward.gain || {};
    if (gain.score) parts.push(`${gain.score}分`);
    if (gain.publicity) parts.push(`${gain.publicity}宣传`);
    if (gain.credits) parts.push(`${gain.credits}信用点`);
    if (gain.energy) parts.push(`${gain.energy}能量`);
    if (gain.additionalPublicScan) parts.push(`${gain.additionalPublicScan}额外扫描`);
    if (reward.dataCount) parts.push(`${reward.dataCount}数据`);
    if (reward.drawCards) parts.push(`盲抽${reward.drawCards}`);
    if (reward.pickCard) parts.push("精选牌");
    if (reward.pickAlienCard) parts.push("外星人牌");
    if (reward.fossilPanel) parts.push("化石奖励");
    return parts.join("+");
  }

  function placeAlienTrace(root, actorId, choice) {
    const actor = getActor(root, actorId);
    const alienState = getWorkingSlice(root, "aliens");
    const legal = listAlienTraceChoices(root, actorId, choice?.target?.traceType)
      .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
    if (!actor || !legal) return fail("SCIENCE_TRACE_CHOICE_STALE", "外星人痕迹选择已失效");
    // 方舟：解锁对应颜色 card2 解锁牌，进手牌（痕迹入口统一选项，先于放置）。
    if (legal.target.fangzhouUnlock) {
      const unlocked = aliens.fangzhou?.unlockCard2?.(
        alienState,
        actor,
        legal.target.traceType,
      );
      if (!unlocked?.ok) return unlocked || fail("SCIENCE_FANGZHOU_UNLOCK_FAILED", "方舟解锁失败");
      if (unlocked.handCard) {
        const added = cards.addCardToHand(actor, unlocked.handCard);
        if (added && getWorkingSlice(root, "players")) {
          actor.resources.handSize = actor.hand.length;
        }
      }
      return { ok: true, ...unlocked };
    }
    // 统一痕迹放置内核：首次/额外（含 state 额外位）/物种正面放置 + 奖励。
    // 与卡牌效果、初始牌来源共用 aliens.placeTraceForActor。alienEntity 序列
    // 只在已揭示槽物种正面放置时消耗（旧行为，未揭示首次/额外放置不消耗）。
    const slot = aliens.getAlienSlot(alienState, legal.target.alienSlotId);
    const isSpeciesPlacement = Boolean(
      slot?.revealed && !legal.target.stateExtra && !legal.target.fangzhouUnlock,
    );
    return aliens.placeTraceForActor(
      players,
      alienState,
      actor,
      legal.target.alienSlotId,
      legal.target.traceType,
      legal.target.position,
      {
        stateExtra: Boolean(legal.target.stateExtra),
        sequence: isSpeciesPlacement
          ? stateSequences.take(root, "alienEntity")
          : undefined,
      },
    );
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
          const root = actionContext?.state || actionContext;
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
          const root = actionContext?.state || actionContext;
          const actor = getActor(root, actionContext?.standardActionAuthority?.actorId);
          if (!actor) return fail("SCIENCE_ACTOR_MISSING", "没有当前玩家");
          // PASS 后回合已结束：与 quick_trade/industry/complete_task 等其余快速
          // 行动一致，放置数据不再可枚举（规则书：PASS 结束回合，不再执行任何
          // 快速行动）。
          if ((root.turn?.passedPlayerIds || []).includes(actor.id) || actor.passCompletionPending) {
            return fail("SCIENCE_PLACE_DATA_AFTER_PASS", "PASS 后不能放置数据");
          }
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
          const root = actionContext?.state || actionContext;
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
          const root = actionContext?.state || actionContext;
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

    // 统一扫描节点 spawn：非决策形态（execute 内自动决定直接扫描或提升决策）。
    function scanStepEffect(ownerId, options) {
      return {
        priority: "direct",
        effect: {
          type: EFFECT_TYPES.SCAN_STEP,
          ownerId,
          payload: { options: clone(options) },
        },
      };
    }

    function scanQueue(root, actor, options = {}) {
      const queue = scanEffects.buildScanEffectQueue(actor, {
        fullScanAction: true,
        includeFinalize: true,
        turn: getWorkingSlice(root, "turn"),
      });
      const mappedQueue = queue.map((entry) => {
        if ([scanEffects.EFFECT_TYPES.EARTH_SECTOR_SCAN,
          scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN,
          scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN].includes(entry.type)) {
          const isImproved = entry.type === scanEffects.EFFECT_TYPES.IMPROVED_SECTOR_SCAN;
          const source = getPlanetScanSource(root, entry.type);
          if (!source) return null;
          if (entry.options?.cost && !players.canAfford(actor, entry.options.cost)) return null;
          if (isImproved) {
            // 紫1：可不在地球扇区标记信号，而改在相邻扇区标记（规则书：地球及相邻扇区三选一）。
            const { nebulaIds } = source;
            if (!listNebulaChoices(root, { nebulaIds, gainData: true }).length) return null;
            return scanStepEffect(actor.id, {
              mode: "specified",
              nebulaIds,
              gainData: true,
              cost: entry.options?.cost || null,
              label: entry.label,
            });
          }
          if (!listNebulaChoices(root, { ...source, gainData: true }).length) return null;
          return scanStepEffect(actor.id, {
            mode: "specified",
            sectorX: source.sectorX,
            gainData: true,
            cost: entry.options?.cost || null,
            label: entry.label,
            // 紫2（水星扫描）按规则书「可以」可选执行：提供跳过。
            skippable: entry.type === scanEffects.EFFECT_TYPES.MERCURY_SECTOR_SCAN,
          });
        }
        if (entry.type === scanEffects.EFFECT_TYPES.PUBLIC_CARD_SCAN) {
          if (!publicScanChoices(root).length) return null;
          return scanStepEffect(actor.id, {
            mode: "public",
            selected: 0,
            // 信号标记（额外公共牌区扫描）：每次扫描行动最多通过弃置信号标记
            // 额外标记 2 个信号（规则书 FAQ：供应区只在行动完成后补满，因此封顶 2）。
            max: Math.min(
              1 + 2,
              1 + Math.max(0, Number(actor.resources?.additionalPublicScan) || 0),
            ),
            consumeMarkers: true,
          });
        }
        if (entry.type === scanEffects.EFFECT_TYPES.HAND_SCAN) {
          if (!handScanChoices(root, actor.id).length) return null;
          return scanStepEffect(actor.id, {
            mode: "hand",
            // 紫3（手牌扫描）按规则书「可以」可选执行：提供跳过。
            skippable: true,
          });
        }
        if (entry.type === scanEffects.EFFECT_TYPES.SCAN_ACTION_4) {
          if (!listScanAction4Choices(root, actor.id).length) return null;
          return scanDecisionEffect(EFFECT_TYPES.SCAN_ACTION_4, actor.id, {
            // 紫4（发射/移动）按规则书「可以」可选执行：提供跳过。
            skippable: true,
          }, "choose_target");
        }
        return null;
      }).filter(Boolean);
      // 串尾统一判定节点：整串扫描结束后触发一次扇区结算（P13：不逐节点结算、
      // 同一 flow 内完成扇区不提前重置；跳过任意节点后仍触发）。紫4 哨兵地球
      // 扫描等流内派生扫描发生在 FINALIZE 之前，同样被本次结算覆盖。
      mappedQueue.push(scanFinalizeEffect(actor.id));
      return mappedQueue;
    }

    function listScanAction4Choices(root, actorId) {
      const actor = getActor(root, actorId);
      if (!actor) return [];
      const choices = [];
      // 紫4 发射选项需校验探测器上限：已达上限时不提供发射，只能移动/跳过
      // （规则书：支付 1 能量发射一个探测器；发射行动本身受太空探测器上限约束）。
      const piecesState = getWorkingSlice(root, "pieces");
      const activeRocketCount = (piecesState?.rockets || []).filter((rocket) => (
        rocket?.playerId === actor.id
        && rocket?.surface === "solar-board"
        && (rocket.kind || "standard") === "standard"
      )).length;
      const context = createActionContext(root, actor.id);
      const rocketLimit = typeof abilities.rocket.getRocketLimitForPlayer === "function"
        ? abilities.rocket.getRocketLimitForPlayer(actor, context)
        : 1;
      if (activeRocketCount < rocketLimit && players.canAfford(actor, { energy: 1 })) {
        choices.push(makeChoice(
          "choose_target",
          "scan4:launch",
          { mode: "launch" },
          {},
          "发射探测器",
        ));
      }
      for (const move of abilities.rocket.listPlayerMoveChoices(context, actor, {
        maxPoints: 1,
        ignoreAsteroidRestriction: false,
      })) {
        choices.push(makeChoice(
          "choose_target",
          `scan4:move:${move.rocketId}:${move.directionId}`,
          {
            mode: "move",
            rocketId: move.rocketId,
            deltaX: move.deltaX,
            deltaY: move.deltaY,
          },
          { requiredMovePoints: move.requiredMovePoints },
          `移动 ${move.rocketId} ${move.label}`,
        ));
      }
      return choices;
    }

    function listIncomeChoices(root, actorId) {
      const actor = getActor(root, actorId);
      return (actor?.hand || []).map((card) => {
        const entry = cards.getCatalogEntryForCard(card);
        return {
          ...makeChoice(
            "choose_card",
            `income:${card.id}`,
            { cardInstanceId: card.id },
            {},
            `收入 ${cards.getCardLabel(card)}`,
          ),
          // 收入选择携带手牌卡面，决策弹窗显示牌面而非编号
          presentation: cards.getCardPickPresentation(card),
        };
      });
    }

    function listPickCardChoices(root) {
      return (getWorkingSlice(root, "cards").publicCards || []).flatMap((card, index) => {
        if (!card) return [];
        const entry = cards.getCatalogEntryForCard(card);
        return [{
          ...makeChoice(
            "choose_card",
            `pick:${card.id}`,
            { cardInstanceId: card.id, publicSlotIndex: index },
            {},
            cards.getCardLabel(card),
          ),
          // 科技精选牌直接携带公共牌卡面，decision-ui 显示牌面而非编号
          presentation: cards.getCardPickPresentation(card),
        }];
      });
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
        // 消耗主行动的判定由标准行动入口（createEffectGroup）传入 consumeMainAction；
        // 卡牌展开的扫描直接 spawn EXECUTE、不带该标记，不消耗主行动。
        if (effect.payload?.consumeMainAction) actor.mainActionCompleted = true;
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
              payload: {
                action: clone(action),
                consumeMainAction: Boolean(effect.payload?.consumeMainAction),
              },
            },
          }],
        });
      }
      return scienceResult(state, root, action.family, {
        spawnedEffects: [scanDecisionEffect(EFFECT_TYPES.RESEARCH, actor.id, {
          options: clone(action.payload || {}),
          consumeMainAction: Boolean(effect.payload?.consumeMainAction),
        })],
      });
    });

    // —— 统一扫描节点 SCAN_STEP ——
    // 任何「往扇区放信号」都是一次 SCAN_STEP：mode 决定目标枚举，共享扫描结算
    // （scanNebula → placeNebulaToken）+ 统一扇区结算。hand/public 模式带弃牌与
    // 多步流；planet/probe/landing/conditional 按实时状态枚举（与卡牌/奖励共用）。
    function getNebulaSectorX(root, nebulaId) {
      const locations = solar.createSolarSnapshot(
        getWorkingSlice(root, "solarSystem"),
      ).nebulaLocations || {};
      const location = Array.isArray(locations)
        ? locations.find((entry) => entry.id === nebulaId)
        : locations[nebulaId] || null;
      return location?.x == null ? null : solar.mod8(Number(location.x));
    }

    function countSignalsInSector(root, actor, sectorX) {
      return Object.keys(cardEffects.NEBULA_IDS_BY_COLOR)
        .flatMap((color) => cardEffects.NEBULA_IDS_BY_COLOR[color])
        .filter((nebulaId) => getNebulaSectorX(root, nebulaId) === solar.mod8(sectorX))
        .reduce((count, nebulaId) => count + (
          data.listNebulaTokens(getWorkingSlice(root, "data"), nebulaId)
            .filter((token) => (
              token.replacedByPlayerId === actor.id
              || token.replacedByPlayerColor === actor.color
            )).length
        ), 0);
    }

    function scanStepChoices(root, actor, opts) {
      const choices = [];
      const mode = opts.mode || "specified";
      if (mode === "any") {
        choices.push(...listNebulaChoices(root, { gainData: opts.gainData }));
      } else if (mode === "color") {
        choices.push(...listNebulaChoices(root, {
          nebulaIds: cardEffects.NEBULA_IDS_BY_COLOR[opts.color] || [],
          gainData: opts.gainData,
        }));
      } else if (mode === "specified") {
        choices.push(...listNebulaChoices(root, {
          nebulaIds: opts.nebulaIds || [],
          sectorX: opts.sectorX,
          gainData: opts.gainData,
        }));
      } else if (mode === "planet" || mode === "landing") {
        const planetId = mode === "landing"
          ? root.match?.cardPlayContext?.lastLanding?.planetId
          : opts.planetId;
        const planet = planetId
          ? solar.createSolarSnapshot(getWorkingSlice(root, "solarSystem")).planetLocations
            .find((candidate) => candidate.planetId === planetId)
          : null;
        if (planet?.x != null) {
          choices.push(...listNebulaChoices(root, { sectorX: planet.x, gainData: opts.gainData }));
        }
      } else if (mode === "probe") {
        const sectorBySlot = getWorkingSlice(root, "solarSystem").sectorBySlot;
        const ids = [...new Set((getWorkingSlice(root, "pieces").rockets || [])
          .filter((rocket) => rocket.playerId === actor.id && rocket.surface === "solar-board")
          .map((rocket) => rockets.getRocketSectorCoordinate(rocket)?.x)
          .filter((x) => x != null)
          .map((x) => solar.getNebulaAtCoordinate(x, 5, sectorBySlot)?.id)
          .filter(Boolean))];
        choices.push(...listNebulaChoices(root, { nebulaIds: ids, gainData: opts.gainData }));
      } else if (mode === "conditional") {
        const sectorXs = [...new Set(Object.values(cardEffects.NEBULA_IDS_BY_COLOR)
          .flat().map((nebulaId) => getNebulaSectorX(root, nebulaId)).filter((x) => x != null))];
        const matching = cardEffects.getMatchingConditionalSectorXs(
          opts.condition,
          sectorXs,
          (sectorX) => countSignalsInSector(root, actor, sectorX),
        );
        const ids = Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat()
          .filter((nebulaId) => matching.includes(getNebulaSectorX(root, nebulaId)));
        choices.push(...listNebulaChoices(root, { nebulaIds: ids, gainData: opts.gainData }));
      } else if (mode === "hand") {
        choices.push(...handScanChoices(root, actor.id));
      } else if (mode === "public") {
        choices.push(...publicScanChoices(root));
        if (opts.selected > 0) {
          choices.push(makeChoice("choose_card", "public:done", { done: true }, {}, "结束公共牌扫描"));
        }
      }
      if (opts.skippable && mode !== "public") {
        const skipFamily = mode === "hand" ? "choose_card" : "choose_target";
        choices.push(makeChoice(skipFamily, "skip", { skip: true }, {}, "跳过"));
      }
      return choices;
    }

    // 共享扫描结算：支付附加费用 → scanNebula → placeNebulaToken → 统一扇区结算；
    // hand/public 模式含弃牌与多步流（公共牌结束统一补牌）。
    function resolveScanStep(state, root, effect, opts, actor, legal) {
      const mode = opts.mode || "specified";
      if (opts.cost) {
        const spent = players.spendResources(actor, opts.cost);
        if (!spent.ok) return spent;
      }
      const result = executeNebulaScan(root, actor.id, makeChoice(
        "choose_target",
        `nebula:${legal.target.nebulaId}`,
        { nebulaId: legal.target.nebulaId },
        { gainData: opts.gainData !== false },
      ), {
        nebulaIds: [legal.target.nebulaId],
        gainData: opts.gainData,
        source: opts.source || "science",
        label: opts.label,
      });
      if (!result.ok) return result;
      // 不逐节点结算：扇区结算由扫描流串尾 SCAN_FINALIZE 统一触发（P13），
      // 同一 flow 内完成扇区不提前重置，后续信号只能放额外标记。
      const spawnedEffects = [];
      const events = clone(result.events || []);
      if (mode === "hand") {
        const index = actor.hand.findIndex((card) => card.id === legal.target.cardInstanceId);
        const removed = cards.discardFromHandAtIndex(actor, index);
        if (!removed.ok) return removed;
        cards.addToDiscardPile(getWorkingSlice(root, "cards"), removed.card);
      } else if (mode === "public") {
        const cardsState = getWorkingSlice(root, "cards");
        const card = cardsState.publicCards[legal.target.publicSlotIndex];
        cardsState.publicCards[legal.target.publicSlotIndex] = null;
        cards.addToDiscardPile(cardsState, card);
        const selected = (Number(opts.selected) || 0) + 1;
        if (selected > 1 && opts.consumeMarkers) {
          actor.resources.additionalPublicScan = Math.max(
            0,
            (Number(actor.resources.additionalPublicScan) || 0) - 1,
          );
        }
        // 公共牌扫描放置后空位保持空置，不立即补牌；补牌统一由扫描流串尾
        // SCAN_FINALIZE 在 SETTLE（扇区结算痕迹/盲抽奖励）之后触发。
        const scanFlowEnded = selected >= (Number(opts.max) || 1) || !publicScanChoices(root).length;
        if (!scanFlowEnded) {
          spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.SCAN_STEP, actor.id, {
            options: { ...clone(opts), selected },
          }, "choose_card"));
        }
      }
      return scienceResult(state, root, EFFECT_TYPES.SCAN_STEP, {
        spawnedEffects,
        events,
        history: [{ type: "science_scan", nebulaId: legal.target.nebulaId }],
      });
    }

    runtime.registerExecutor(EFFECT_TYPES.SCAN_STEP, {
      // 非决策路径：固定单目标直接扫描；公共牌/多目标/可跳过提升为决策。
      execute(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const opts = effect.payload?.options || {};
        const mode = opts.mode || "specified";
        const actor = getActor(root, effect.ownerId);
        if (!actor) return fail("SCIENCE_SCAN_STEP_STALE", "扫描玩家已失效");
        if (mode === "public") {
          // 公共牌扫描多步流：prepare → 决策（选牌/结束）→ 结束统一补牌。
          const choices = publicScanChoices(root);
          return scienceResult(state, root, `${EFFECT_TYPES.SCAN_STEP}:prepare`, {
            spawnedEffects: choices.length ? [scanDecisionEffect(
              EFFECT_TYPES.SCAN_STEP,
              actor.id,
              { options: clone(opts) },
              "choose_card",
            )] : [],
            events: choices.length ? [] : [{ type: "scanStepSkipped", reason: "no_legal_target" }],
          });
        }
        // 固定单目标（指定且唯一、不可跳过、无附加费用）：自动直接扫描。
        const forcedSingle = mode === "specified"
          && (opts.nebulaIds || []).length === 1
          && !opts.skippable
          && !opts.cost;
        if (forcedSingle) {
          const nebulaId = opts.nebulaIds[0];
          const legal = scanStepChoices(root, actor, opts)
            .find((candidate) => candidate.target.nebulaId === nebulaId);
          if (!legal) return fail("SCIENCE_SCAN_TARGET_STALE", "扫描目标已失效");
          return resolveScanStep(state, root, effect, opts, actor, legal);
        }
        // 其余：有合法目标则提升为决策（含跳过选项），无目标则跳过。
        const choices = scanStepChoices(root, actor, opts);
        return scienceResult(state, root, `${EFFECT_TYPES.SCAN_STEP}:prepare`, {
          spawnedEffects: choices.length ? [scanDecisionEffect(
            EFFECT_TYPES.SCAN_STEP,
            actor.id,
            { options: clone(opts) },
            mode === "hand" ? "choose_card" : "choose_target",
          )] : [],
          events: choices.length ? [] : [{ type: "scanStepSkipped", reason: "no_legal_target" }],
        });
      },
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const opts = effect.payload?.options || {};
        const actor = getActor(root, effect.ownerId);
        if (!actor) return [];
        return formalizeChoices(root, effect.ownerId, scanStepChoices(root, actor, opts));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const opts = effect.payload?.options || {};
        const mode = opts.mode || "specified";
        const actor = getActor(root, effect.ownerId);
        if (!actor) return fail("SCIENCE_SCAN_STEP_STALE", "扫描玩家已失效");
        if (choice?.target?.skip) {
          return scienceResult(state, root, EFFECT_TYPES.SCAN_STEP, {
            spawnedEffects: [],
            events: [{ type: "scanStepSkipped", playerId: effect.ownerId }],
          });
        }
        if (mode === "public" && choice?.target?.done) {
          // 公共牌扫描结束：空位不在此补牌。补牌由扫描流串尾 SCAN_FINALIZE
          // 在 SETTLE（扇区结算痕迹/盲抽奖励）之后统一触发——保证盲抽 RNG
          // 消费顺序先痕迹盲抽、后公共牌补牌（老档逐节点结算顺序一致）。
          return scienceResult(state, root, EFFECT_TYPES.SCAN_STEP, {
            spawnedEffects: [],
            events: [{ type: "publicScanCompleted", selected: opts.selected || 0 }],
          });
        }
        const legal = scanStepChoices(root, actor, opts)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        if (!legal) return fail("SCIENCE_SCAN_STEP_STALE", "扫描选择已失效");
        return resolveScanStep(state, root, effect, opts, actor, legal);
      },
    });

    function publicScanChoices(root) {
      const cardsState = getWorkingSlice(root, "cards");
      return (cardsState.publicCards || []).flatMap((card, publicSlotIndex) => {
        if (!card) return [];
        const entry = cards.getCatalogEntryForCard(card);
        const code = Number(card.scanActionCode ?? cards.getCatalogEntryForCard(card)?.scan_action_code);
        return listNebulaChoices(root, { nebulaIds: NEBULA_IDS_BY_SCAN_CODE[code] || [], gainData: true })
          .map((choice) => makeChoice(
            "choose_card",
            `public:${card.id}:${choice.target.nebulaId}`,
            { cardInstanceId: card.id, publicSlotIndex, nebulaId: choice.target.nebulaId },
            { gainData: true },
            `${cards.getCardLabel(card)} → ${data.getNebulaLabel(choice.target.nebulaId)}`,
            // 卡面统一由 cards.getCardPickPresentation 提供
            cards.getCardPickPresentation(card),
          ));
      });
    }

    runtime.registerExecutor(EFFECT_TYPES.PUBLIC_REFILL, (state, effect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const cardsState = getWorkingSlice(root, "cards");
      const playersState = getWorkingSlice(root, "players");
      let filled = 0;
      // 统一抽牌上下文：公共牌补牌共用 cards.createCardDrawContext
      const drawContext = cards.createCardDrawContext(
        cardsState,
        playersState,
        () => nextCommittedRandom(root),
        { root },
      );
      for (let index = 0; index < (cardsState.publicCards || []).length; index += 1) {
        if (cardsState.publicCards[index]) continue;
        const replenished = cards.replenishPublicSlot(
          cardsState,
          playersState,
          index,
          () => nextCommittedRandom(root),
          { createCardInstance: drawContext.createCardInstance },
        );
        if (replenished) filled += 1;
      }
      return scienceResult(state, root, EFFECT_TYPES.PUBLIC_REFILL, {
        ...(filled
          ? {
            irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
            rng: [{ owner: DOMAIN_ID, cursor: root.meta?.rngState?.science?.cursor || 0 }],
          }
          : {}),
        events: filled
          ? [{ type: "publicRefill", count: filled }]
          : [{ type: "publicRefillSkipped" }],
      });
    });

    // 扫描流串尾统一判定节点：整串 SCAN_STEP 结束后触发一次 SETTLE（幂等，
    // 只结算已完成的扇区）。独立节点保证跳过任意扫描节点后仍触发扇区结算。
    // 公共牌补牌（PUBLIC_REFILL）在 SETTLE 之后执行：扇区结算的痕迹/盲抽奖励
    // 先于公共牌补牌（规则书 P13 扇区奖励在补牌前；老档逐节点结算顺序亦然），
    // 保证盲抽 RNG 消费顺序与规则一致。
    runtime.registerExecutor(EFFECT_TYPES.SCAN_FINALIZE, (state, effect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const spawnedEffects = [settleAfterScan(effect.ownerId)];
      // 公共牌补牌在 SETTLE 之后执行：扇区结算的痕迹/盲抽奖励先于补牌
      // （规则书 P13；老档逐节点结算顺序亦然），保证盲抽 RNG 消费顺序一致。
      // 只有本次扫描流产生了空公共牌位才补牌，避免无公共牌扫描的流多出空节点。
      const cardsState = getWorkingSlice(root, "cards");
      const hasEmptyPublicSlot = Array.isArray(cardsState.publicCards)
        && cardsState.publicCards.some((card) => !card);
      if (hasEmptyPublicSlot) {
        spawnedEffects.push({
          priority: "direct",
          effect: { type: EFFECT_TYPES.PUBLIC_REFILL, ownerId: effect.ownerId },
        });
      }
      return scienceResult(state, root, EFFECT_TYPES.SCAN_FINALIZE, { spawnedEffects });
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

    runtime.registerExecutor(EFFECT_TYPES.SCAN_ACTION_4, {
      getLegalChoices(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const choices = listScanAction4Choices(root, effect.ownerId);
        if (effect.payload?.skippable) {
          choices.push(makeChoice("choose_target", "scan4:skip", { mode: "skip" }, {}, "跳过"));
        }
        return formalizeChoices(root, effect.ownerId, choices);
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        if (choice?.target?.mode === "skip") {
          return scienceResult(state, root, EFFECT_TYPES.SCAN_ACTION_4, {
            spawnedEffects: [],
            events: [{ type: "scanAction4Skipped", playerId: effect.ownerId }],
          });
        }
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
          const earth = solar.createSolarSnapshot(getWorkingSlice(root, "solarSystem"))
            .planetLocations.find((planet) => planet.planetId === "earth");
          if (listNebulaChoices(root, { sectorX: earth?.x, gainData: true }).length) {
            spawnedEffects.push(scanStepEffect(actor.id, {
              mode: "specified",
              sectorX: earth.x,
              gainData: true,
              label: "哨兵发射扫描地球",
            }));
          }
        }
        // 紫4 本身不替换数据 token，不触发扇区结算；若触发哨兵发射扫描，
        // 该扫描会经由 SCAN_STEP 统一结算。
        return scienceResult(state, root, EFFECT_TYPES.SCAN_ACTION_4, {
          spawnedEffects,
          events: clone(result.events || []),
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.SETTLE, (state, effect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const nebulaState = getWorkingSlice(root, "data");
      const playersState = getWorkingSlice(root, "players");
      const actor = getActor(root, effect.ownerId);
      // 同一批多个待结算扇区时，先排当前玩家为赢家的扇区，再排其他玩家获胜
      // 或无赢家的扇区；同组内维持原具名扇区顺序（规则书 P13）。
      const sectorIds = typeof data.orderSectorIdsByPlayerWinPriority === "function"
        ? data.orderSectorIdsByPlayerWinPriority(nebulaState, undefined, actor)
        : undefined;
      const result = data.settleCompletedSectors(nebulaState, {
        sectorIds,
        players: playersState.players,
        source: "science",
        root,
        settledAt: `state:${root.meta?.stateVersion ?? 0}:science-settlement`,
      });
      const spawnedEffects = [];
      const events = [];
      for (const settlement of result.settlements || []) {
        const winner = getActor(root, settlement.winner?.playerId)
          || playersState.players.find((player) => player.color === settlement.winner?.playerColor);
        const runezuClaim = winner
          ? aliens.runezu?.claimSectorSymbol?.(
            getWorkingSlice(root, "aliens"),
            settlement.sectorId,
            winner,
            {},
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
            || playersState.players.find((player) => player.color === reward.owner?.playerColor);
          if (!owner) continue;
          if (reward.kind === "resource") appendResourceBonus(owner, reward.gain, events, "scanScore");
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
          // 计算机数据位覆盖奖励：4 号位 = 获得 1 次收入行动（插入一张收入牌）。
          if (bonus.type === "income" && listIncomeChoices(root, actor.id).length) {
            spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.INCOME, actor.id, {}, "choose_card"));
          } else if (bonus.type === "choose_card" && listPickCardChoices(root).length) {
            spawnedEffects.push(scanDecisionEffect(EFFECT_TYPES.PICK_CARD, actor.id, {
              blueBonusSource: result.placementKind === "blueBonus",
            }, "choose_card"));
          } else {
            appendResourceBonus(actor, bonus, events, "blueTechScore");
          }
        }
        return scienceResult(state, root, EFFECT_TYPES.PLACE_DATA, { spawnedEffects, events });
      },
    });

    // 放置数据（计算机 4 号位数据覆盖奖励）获得的收入行动：选一张手牌插入
    // 收入列（收入栏增长 + 立即获得收入效果 + 移出游戏）。
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
        // 收入牌插入起始收入牌下方，移出游戏（不进弃牌堆、不会被洗回主牌库）。
        cards.addRemovedFromGame(getWorkingSlice(root, "cards"), discarded.card);
        // 统一抽牌上下文：收入盲抽共用 cards.createCardDrawContext
        const drawContext = cards.createCardDrawContext(
          getWorkingSlice(root, "cards"),
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        players.gainIncome(actor, gain, {
          blindDraw: (target) => drawContext.blindDraw(target),
          gainData: (target) => data.gainData(target, { source: "place_data_income", root }),
        });
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
        // 统一抽牌上下文：精选公共牌共用 cards.createCardDrawContext
        const drawContext = cards.createCardDrawContext(
          getWorkingSlice(root, "cards"),
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        const result = drawContext.pickFromPublic(actor, legal.target.publicSlotIndex);
        if (!result.ok) return result;
        if (effect.payload?.blueBonusSource) {
          if (!result.card || !actor.hand.includes(result.card)) throw new Error("蓝槽精选奖励缺少已入手的真实卡实例");
          result.card.blueBonusOwnerId = actor.id;
        }
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
      // 消耗主行动由标准行动入口传入的 consumeMainAction 决定（当前无卡牌触发
      // analyze，标准 analyze 必然带标记；与 scan/research 保持同一解耦结构）。
      if (effect.payload?.consumeMainAction) actor.mainActionCompleted = true;
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
        const choices = traceTypes.flatMap((traceType) => (
          listAlienTraceChoices(root, effect.ownerId, traceType)
        ));
        // 来源标签（如「任意外星人标记 1/2」）拼到每个选项前，玩家能看清这是第几次放置
        const sourceLabel = effect.payload?.label;
        if (sourceLabel && choices.length) {
          for (const choice of choices) {
            choice.summary = `${sourceLabel} → ${choice.summary || choice.family}`;
          }
        }
        return formalizeChoices(root, effect.ownerId, choices);
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const actor = getActor(root, effect.ownerId);
        const result = placeAlienTrace(root, effect.ownerId, choice);
        if (!actor || !result?.ok) return result || fail("SCIENCE_TRACE_ACTOR_STALE", "外星人痕迹放置者已失效");
        const spawnedEffects = [];
        let irreversible = null;
        // 阿米巴痕迹位置分值奖励（2/4 号位 +1 分等）→ 计入对应颜色踪迹得分来源
        if (result.reward?.gain && Object.keys(result.reward.gain).some((key) => Number(result.reward.gain[key]) !== 0)) {
          const traceType = String(choice?.target?.traceType || "yellow");
          players.gainResources(
            actor,
            result.reward.gain,
            `alienTrace${traceType[0].toUpperCase()}${traceType.slice(1)}Score`,
          );
        }
        // 痕迹位置奖励：选一张当前外星人的牌（pickAlienCard，如黄色/粉色痕迹 3/4 号位）。
        // 从放置的槽位推断物种，不能写死阿米巴（虫族等同样有 pickAlienCard 奖励）。
        if (result.reward?.pickAlienCard) {
          const alienSlotId = choice?.target?.alienSlotId;
          const slot = aliens.getAlienSlot(getWorkingSlice(root, "aliens"), alienSlotId);
          const species = slot ? aliens.getSpeciesTraceApi(slot) : null;
          const speciesId = species?.speciesId || "amiba";
          spawnedEffects.push({
            priority: "direct",
            effect: {
              type: "residual_alien_card_decision",
              kind: "decision",
              decisionKind: "choose_card",
              ownerId: effect.ownerId,
              payload: { speciesId, source: "trace_reward" },
            },
          });
        }
        // 阿米巴痕迹区域奖励：让玩家逐个选择该区域细胞器（symbol），选择顺序
        // 影响 symbol 移动后的位置。统一走 play-domain 的 CHOOSE_SYMBOL_REWARD
        // 决策（card_play_domain_effect:decision:...，跨域 spawn，与阿米巴牌效果同一入口）。
        if (result.reward?.region) {
          const alienState = getWorkingSlice(root, "aliens");
          if (aliens.amiba.listSymbolsInRegion(alienState, result.reward.region).length) {
            spawnedEffects.push({
              priority: "direct",
              effect: {
                type: "card_play_domain_effect:decision:amiba_choose_symbol_reward",
                kind: "decision",
                decisionKind: "choose_target",
                ownerId: effect.ownerId,
                payload: {
                  cardEffect: {
                    type: aliens.amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD,
                    options: { region: result.reward.region },
                  },
                  cardInstanceId: null,
                  // 放置痕迹触发区域结算：结算区域内全部细胞器（最多 3 个）
                  maxSettles: 3,
                },
              },
            });
          }
        }
        return scienceResult(state, root, EFFECT_TYPES.ALIEN_TRACE, {
          spawnedEffects,
          irreversible,
          events: [{
            type: "alienTrace",
            playerId: effect.ownerId,
            traceType: choice.target.traceType,
            alienSlotId: choice.target.alienSlotId,
            region: result.reward?.region || null,
          }],
        });
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.RESEARCH, {
      execute(state, effect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const options = effect.payload?.options || {};
        const choices = listResearchChoices(root, effect.ownerId, options);
        // 规则书：卡牌效果研究科技时，即使已获得该种类所有科技（无合法目标），
        // 也「依然执行公转」。因此无合法目标时先公转再跳过。
        if (!choices.length) {
          const context = createActionContext(root, effect.ownerId);
          if (typeof context.rotateSolarOrbit === "function" && !options.skipRotate) {
            const rotated = context.rotateSolarOrbit(1);
            if (rotated && rotated.ok === false) return rotated;
          }
          return scienceResult(state, root, `${EFFECT_TYPES.RESEARCH}:prepare`, {
            spawnedEffects: [],
            events: [{ type: "researchTechSkipped", reason: "no_legal_target", rotated: true }],
          });
        }
        return scienceResult(state, root, `${EFFECT_TYPES.RESEARCH}:prepare`, {
          spawnedEffects: [scanDecisionEffect(
            EFFECT_TYPES.RESEARCH,
            effect.ownerId,
            clone(effect.payload || {}),
          )],
          events: [],
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
        if (effect.payload?.consumeMainAction && actor) actor.mainActionCompleted = true;
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
      // 消耗主行动的判定只在标准行动入口：主相位 action 由 createEffectGroup
      // 打上 consumeMainAction 标记，执行器只按标记置位；卡牌展开的 science
      // 效果直接 spawn EXECUTE/RESEARCH，不带标记，不消耗主行动。
      return {
        kind: action.phase === "quick" ? "quick" : "action",
        ownerId: action.actorId || null,
        action: clone(action),
        effects: [{
          type: EFFECT_TYPES.EXECUTE,
          ownerId: action.actorId || null,
          payload: {
            action: clone(action),
            consumeMainAction: action.phase !== "quick",
          },
        }],
      };
    }

    return Object.freeze({ actionFamilies: ACTION_FAMILIES, createEffectGroup });
  }

  // 正式扫描队列与公共依赖目录共用同一几何来源；不判断费用或剩余信号。
  function getPlanetScanSource(root, effectType) {
    const types = scanEffects.EFFECT_TYPES;
    if (![types.EARTH_SECTOR_SCAN, types.IMPROVED_SECTOR_SCAN, types.MERCURY_SECTOR_SCAN].includes(effectType)) {
      throw new TypeError(`PLANET_SCAN_TYPE_INVALID: ${effectType}`);
    }
    const solarState = getWorkingSlice(root, "solarSystem");
    const planetId = effectType === types.MERCURY_SECTOR_SCAN ? "mercury" : "earth";
    const planet = solar.collectPlanetLocations(solarState)
      .find((candidate) => candidate.planetId === planetId);
    if (planet?.x == null) return null;
    if (effectType === types.IMPROVED_SECTOR_SCAN) {
      return { nebulaIds: [-1, 0, 1].map((offset) => (
        solar.getNebulaAtCoordinate(solar.mod8(planet.x + offset), 5, solarState.sectorBySlot)?.id
      )).filter(Boolean) };
    }
    return { sectorX: planet.x };
  }

  return Object.freeze({
    DOMAIN_ID,
    ACTION_FAMILIES,
    EXECUTOR_ID,
    EFFECT_TYPES,
    createActionDefinitions,
    createScienceDomain,
    createActionContext,
    getPlanetScanSource,
    listNebulaChoices,
    executeNebulaScan,
    settleAfterScan,
    scanFinalizeEffect,
    listResearchChoices,
    executeResearchChoice,
    formalizeChoices,
  });
});
