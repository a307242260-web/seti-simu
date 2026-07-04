(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAbilityChain = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function normalizeInsertionSource(source) {
    if (!source || typeof source !== "object") return null;
    const effectIndex = Number.isInteger(source.effectIndex) ? source.effectIndex : null;
    const normalized = {
      chainId: source.chainId || null,
      effectIndex,
      effectId: source.effectId || null,
      effectType: source.effectType || null,
    };
    return (
      normalized.effectId
      || normalized.effectType
      || normalized.effectIndex !== null
    ) ? normalized : null;
  }

  function cloneInsertionSource(source) {
    const normalized = normalizeInsertionSource(source);
    return normalized ? { ...normalized } : null;
  }

  function normalizeNode(node, index) {
    return {
      id: node.id || `ability-chain-node-${index}`,
      abilityId: node.abilityId || null,
      type: node.type || node.abilityId || null,
      icon: node.icon || null,
      label: node.label || node.abilityId || `能力 ${index + 1}`,
      status: node.status || "pending",
      undoable: node.undoable ?? true,
      required: Boolean(node.required || node.options?.required),
      playerId: node.playerId || node.options?.playerId || null,
      playerColor: node.playerColor || node.options?.playerColor || null,
      options: { ...(node.options || {}) },
      preHistoryCommands: Array.isArray(node.preHistoryCommands) ? [...node.preHistoryCommands] : [],
      preHistoryCommandsApplied: Boolean(node.preHistoryCommandsApplied),
      needsUserChoice: Boolean(node.needsUserChoice),
      result: node.result || null,
      insertedByEffect: cloneInsertionSource(node.insertedByEffect),
    };
  }

  function startAbilityChain(chainId, label, nodes = []) {
    return {
      chainId,
      actionType: chainId,
      label: label || chainId,
      effects: nodes.map(normalizeNode),
      currentIndex: 0,
      freeMoveMode: false,
      completed: false,
    };
  }

  function getCurrentChainNode(chain) {
    if (!chain || chain.completed) return null;
    return chain.effects[chain.currentIndex] || null;
  }

  function createInsertionSource(chain, node = null) {
    const current = node || getCurrentChainNode(chain);
    if (!chain || !current) return null;
    return normalizeInsertionSource({
      chainId: chain.chainId || null,
      effectIndex: chain.currentIndex,
      effectId: current.id || null,
      effectType: current.type || current.abilityId || null,
    });
  }

  function markInsertedNode(node, source) {
    const insertedByEffect = normalizeInsertionSource(source);
    if (!node || !insertedByEffect) return node;
    return {
      ...node,
      insertedByEffect,
    };
  }

  function insertionOriginMatchesSource(origin, source) {
    const normalizedOrigin = normalizeInsertionSource(origin);
    const normalizedSource = normalizeInsertionSource(source);
    if (!normalizedOrigin || !normalizedSource) return false;
    if (
      normalizedOrigin.chainId
      && normalizedSource.chainId
      && normalizedOrigin.chainId !== normalizedSource.chainId
    ) return false;
    if (
      normalizedOrigin.effectId
      && normalizedSource.effectId
      && normalizedOrigin.effectId !== normalizedSource.effectId
    ) return false;
    if (
      normalizedOrigin.effectType
      && normalizedSource.effectType
      && normalizedOrigin.effectType !== normalizedSource.effectType
    ) return false;
    if (
      normalizedOrigin.effectIndex !== null
      && normalizedSource.effectIndex !== null
      && normalizedOrigin.effectIndex !== normalizedSource.effectIndex
    ) return false;
    return Boolean(
      (normalizedOrigin.effectId && normalizedSource.effectId)
      || (normalizedOrigin.effectType && normalizedSource.effectType)
      || (normalizedOrigin.effectIndex !== null && normalizedSource.effectIndex !== null)
    );
  }

  function removeInsertedNodesBySource(chain, source) {
    if (!chain?.effects?.length) return 0;
    const normalizedSource = normalizeInsertionSource(source);
    if (!normalizedSource) return 0;
    let removed = 0;
    for (let index = chain.effects.length - 1; index >= 0; index -= 1) {
      if (!insertionOriginMatchesSource(chain.effects[index]?.insertedByEffect, normalizedSource)) continue;
      chain.effects.splice(index, 1);
      if (index < chain.currentIndex) {
        chain.currentIndex = Math.max(0, chain.currentIndex - 1);
      }
      removed += 1;
    }
    return removed;
  }

  function activateNext(chain) {
    if (!chain) return null;
    const nextIndex = chain.effects.findIndex((node) => node.status === "pending");
    if (nextIndex < 0) {
      chain.completed = true;
      return null;
    }
    chain.currentIndex = nextIndex;
    chain.effects[nextIndex].status = "active";
    return chain.effects[nextIndex];
  }

  function activateNextIfIdle(chain) {
    if (!chain || chain.completed) return null;
    const current = getCurrentChainNode(chain);
    if (current?.status === "active") return null;
    return activateNext(chain);
  }

  function resolveCurrentChainNode(chain, result = {}) {
    const node = getCurrentChainNode(chain);
    if (!node || node.status !== "active") {
      return { ok: false, message: "当前没有可结算的能力" };
    }
    node.result = result;
    node.undoable = result.undoable ?? node.undoable;
    node.status = "completed";
    return { ok: true, node, next: activateNext(chain), completed: Boolean(chain.completed) };
  }

  function skipCurrentChainNode(chain) {
    const node = getCurrentChainNode(chain);
    if (!node || node.status !== "active") {
      return { ok: false, message: "当前没有可跳过的能力" };
    }
    node.status = "skipped";
    return { ok: true, node, next: activateNext(chain), completed: Boolean(chain.completed) };
  }

  function undoLastChainStep(chain) {
    if (!chain) return { ok: false, message: "没有能力链" };
    for (let index = chain.effects.length - 1; index >= 0; index -= 1) {
      const node = chain.effects[index];
      if (node.status !== "completed" || node.undoable === false) continue;
      node.status = "active";
      node.result = null;
      chain.currentIndex = index;
      chain.completed = false;
      for (let reset = index + 1; reset < chain.effects.length; reset += 1) {
        if (chain.effects[reset].status !== "pending") {
          chain.effects[reset].status = "pending";
          chain.effects[reset].result = null;
        }
      }
      return { ok: true, node };
    }
    return { ok: false, message: "没有可撤销的能力节点" };
  }

  function finishAbilityChain(chain) {
    if (!chain) return { ok: false, message: "没有能力链" };
    chain.completed = true;
    return { ok: true, chain };
  }

  return Object.freeze({
    startAbilityChain,
    createInsertionSource,
    markInsertedNode,
    removeInsertedNodesBySource,
    activateNext,
    activateNextIfIdle,
    getCurrentChainNode,
    resolveCurrentChainNode,
    skipCurrentChainNode,
    undoLastChainStep,
    finishAbilityChain,
  });
});
