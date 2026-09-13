(function (root, factory) {
  "use strict";

  let catalog = root.SetiAlienCatalog;
  const fixedWorld = typeof require === "function" ? require("../state/fixed-world-config") : root.SetiFixedWorldConfig;
  let placement = root.SetiAlienPlacement;
  let state = root.SetiAlienState;
  let jiuzhe = root.SetiAlienJiuzhe;
  let yichangdian = root.SetiAlienYichangdian;
  let fangzhou = root.SetiAlienFangzhou;
  let banrenma = root.SetiAlienBanrenma;
  let chong = root.SetiAlienChong;
  let amiba = root.SetiAlienAmiba;
  let aomomo = root.SetiAlienAomomo;
  let runezu = root.SetiAlienRunezu;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    placement = placement || require("./placement");
    state = state || require("./state");
    jiuzhe = jiuzhe || require("./jiuzhe");
    yichangdian = yichangdian || require("./yichangdian");
    fangzhou = fangzhou || require("./fangzhou");
    banrenma = banrenma || require("./banrenma");
    chong = chong || require("./chong");
    amiba = amiba || require("./amiba");
    aomomo = aomomo || require("./aomomo");
    runezu = runezu || require("./runezu");
  }

  const api = factory(catalog, placement, state, jiuzhe, yichangdian, fangzhou, banrenma, chong, amiba, aomomo, runezu, fixedWorld);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiAlienRandomizer = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (catalog, placement, state, jiuzhe, yichangdian, fangzhou, banrenma, chong, amiba, aomomo, runezu, fixedWorld) {
  "use strict";

  const MIN_ALIEN_REVEAL_POOL_SIZE = Math.max(2, placement.ALIEN_SLOT_IDS.length);

  function normalizeAlienRevealPool(alienIds) {
    if (!Array.isArray(alienIds)) return [...catalog.ALIEN_TYPE_IDS];
    const requested = new Set(alienIds.map((alienId) => String(alienId)));
    return catalog.ALIEN_TYPE_IDS.filter((alienId) => requested.has(alienId));
  }

  function getDefaultAlienRevealPool() {
    return [...catalog.ALIEN_TYPE_IDS];
  }

  function getAlienRevealPool(alienState) {
    const pool = normalizeAlienRevealPool(alienState?.revealPoolAlienIds);
    return pool.length >= MIN_ALIEN_REVEAL_POOL_SIZE ? pool : getDefaultAlienRevealPool();
  }

  function setAlienRevealPool(alienState, alienIds) {
    if (!alienState) {
      return { ok: false, message: "缺少外星人状态" };
    }
    const pool = normalizeAlienRevealPool(alienIds);
    if (pool.length < MIN_ALIEN_REVEAL_POOL_SIZE) {
      return {
        ok: false,
        message: `至少需要选择 ${MIN_ALIEN_REVEAL_POOL_SIZE} 个外星人`,
        alienPoolIds: getAlienRevealPool(alienState),
      };
    }
    alienState.revealPoolAlienIds = [...pool];
    return {
      ok: true,
      alienPoolIds: [...alienState.revealPoolAlienIds],
      message: `外星人揭示池：${pool.join("、")}`,
    };
  }

  function ensureAlienRevealPool(alienState) {
    if (!alienState) {
      return { ok: false, message: "缺少外星人状态" };
    }
    const pool = getAlienRevealPool(alienState);
    alienState.revealPoolAlienIds = [...pool];
    return { ok: true, alienPoolIds: [...alienState.revealPoolAlienIds] };
  }

  function resetAlienSpecificStates(alienState) {
    if (jiuzhe?.createJiuzheState) {
      alienState.jiuzhe = jiuzhe.createJiuzheState();
    }
    if (yichangdian?.createYichangdianState) {
      alienState.yichangdian = yichangdian.createYichangdianState();
    }
    if (fangzhou?.createFangzhouState) {
      alienState.fangzhou = fangzhou.createFangzhouState();
    }
    if (banrenma?.createBanrenmaState) {
      alienState.banrenma = banrenma.createBanrenmaState();
    }
    if (chong?.createChongState) {
      alienState.chong = chong.createChongState();
    }
    if (amiba?.createAmibaState) {
      alienState.amiba = amiba.createAmibaState();
    }
    if (aomomo?.createAomomoState) {
      alienState.aomomo = aomomo.createAomomoState();
    }
    if (runezu?.createRunezuState) {
      alienState.runezu = runezu.createRunezuState();
    }
  }

  function randomizeAlienAssignments(alienState, options = {}) {
    const hasExplicitAlienPool = Object.prototype.hasOwnProperty.call(options, "alienPoolIds");
    const poolResult = hasExplicitAlienPool
      ? setAlienRevealPool(alienState, options.alienPoolIds)
      : ensureAlienRevealPool(alienState);
    if (!poolResult.ok) return poolResult;

    const assignments = {};
    const pool = [...poolResult.alienPoolIds];
    const fixed = fixedWorld.getFixedWorldConfig(options.seed)?.assignments;
    const random = options.random;
    if (!fixed && typeof random !== "function") throw new TypeError("外星人初始分配需要显式随机源");

    for (const alienSlotId of placement.ALIEN_SLOT_IDS) {
      let index;
      if (fixed) {
        index = pool.indexOf(fixed[alienSlotId]);
        if (index < 0) throw new Error("固定盘面物种与可选池冲突");
      } else {
        const value = random();
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
          throw new RangeError("外星人初始分配随机值必须在[0,1)内");
        }
        index = Math.floor(value * pool.length);
      }
      const [alienId] = pool.splice(index, 1);
      alienState.aliens[alienSlotId] = state.createDefaultAlienSlotState();
      alienState.aliens[alienSlotId].assignedAlienId = alienId;
      assignments[alienSlotId] = alienId;
    }
    resetAlienSpecificStates(alienState);

    return {
      ok: true,
      assignments,
      alienPoolIds: poolResult.alienPoolIds,
      message: "两个外星人已分配至隐藏槽位，主动发现时揭示既定身份",
    };
  }

  function getUnavailableAlienIdsForReveal(alienState, alienSlotId) {
    const unavailable = new Set();
    const normalizedSlotId = Number(alienSlotId);
    for (const otherSlotId of placement.ALIEN_SLOT_IDS) {
      if (Number(otherSlotId) === normalizedSlotId) continue;
      const otherSlot = state.getAlienSlot(alienState, otherSlotId);
      if (otherSlot?.alienId) unavailable.add(otherSlot.alienId);
      if (otherSlot?.assignedAlienId) unavailable.add(otherSlot.assignedAlienId);
    }
    return unavailable;
  }

  function pickRandomAlienIdForReveal(alienState, alienSlotId, random = Math.random) {
    const alienSlot = state.getAlienSlot(alienState, alienSlotId);
    if (!alienSlot) {
      return { ok: false, message: `未知外星人槽位 ${alienSlotId}` };
    }
    if (alienSlot.revealed) {
      return { ok: false, message: `${placement.getAlienSlotLabel(alienSlotId)} 已揭示` };
    }
    if (!state.isAlienReadyToReveal(alienSlot)) {
      return { ok: false, message: `${placement.getAlienSlotLabel(alienSlotId)} 尚未集齐三种首标记` };
    }

    const unavailable = getUnavailableAlienIdsForReveal(alienState, alienSlotId);
    const configuredPool = getAlienRevealPool(alienState);
    const pool = configuredPool.filter((alienId) => !unavailable.has(alienId));
    if (!pool.length) {
      return { ok: false, message: "外星人池不足以揭示不重复物种" };
    }
    const alienId = alienSlot.assignedAlienId;
    if (!alienId || !pool.includes(alienId)) {
      return { ok: false, code: "ALIEN_ASSIGNMENT_INVALID", message: "缺少有效的开局外星人分配" };
    }
    return { ok: true, alienId, pool };
  }

  function revealRandomAlien(alienState, alienSlotId, random = Math.random) {
    const pickResult = pickRandomAlienIdForReveal(alienState, alienSlotId, random);
    if (!pickResult.ok) return pickResult;

    const alienSlot = state.getAlienSlot(alienState, alienSlotId);
    alienSlot.assignedAlienId = pickResult.alienId;
    const revealResult = state.revealAlien(alienState, alienSlotId, pickResult.alienId);
    return {
      ...revealResult,
      pool: pickResult.pool,
    };
  }

  return Object.freeze({
    MIN_ALIEN_REVEAL_POOL_SIZE,
    getAlienRevealPool,
    setAlienRevealPool,
    randomizeAlienAssignments,
    pickRandomAlienIdForReveal,
    revealRandomAlien,
  });
});
