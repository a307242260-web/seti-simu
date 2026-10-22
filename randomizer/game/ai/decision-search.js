(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiDecisionSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const VERSION = "seti-complete-decision-search-v1";
  const BOUNDARIES = new Set(["terminal", "other-owner", "information-barrier"]);
  // 这是单决策诊断额度，不是允许截断的棋力配置；超限绝不返回可提交动作。
  const DEFAULT_BUDGET = Object.freeze({ transitions: 128, nodes: 129, frontier: 128, milliseconds: 1000 });

  function searchDecision({ port, root, evaluate, budget = {}, now = () => performance.now() } = {}) {
    if (typeof port?.expand !== "function" || typeof port?.identity !== "function"
      || typeof evaluate !== "function" || !root) throw new TypeError("SEARCH_INPUT_INVALID");
    const limits = { ...DEFAULT_BUDGET, ...budget };
    for (const [key, value] of Object.entries(limits)) {
      if (!Object.hasOwn(DEFAULT_BUDGET, key) || !Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`SEARCH_BUDGET_INVALID: ${key}`);
      }
    }
    const startedAt = now();
    const nodes = [];
    const known = new Map();
    const queue = [];
    let cursor = 0;
    let transitions = 0;
    let equivalents = 0;
    let peakFrontier = 0;
    let stopReason = null;
    function add(node) {
      const identity = port.identity(node);
      if (known.has(identity)) return { index: known.get(identity), equivalent: true };
      const index = nodes.length;
      known.set(identity, index);
      const boundary = BOUNDARIES.has(node.status);
      if (!boundary && !node.legalActions?.length) throw new Error("SEARCH_EMPTY_NONTERMINAL");
      const value = boundary ? evaluate(node.observation) : null;
      if (boundary && !Number.isFinite(value)) throw new Error("SEARCH_VALUE_INVALID");
      nodes.push({ node, edges: [], expanded: boundary, value, distance: boundary ? 0 : Infinity, best: null });
      if (!boundary) queue.push(index);
      peakFrontier = Math.max(peakFrontier, queue.length - cursor);
      return { index, equivalent: false };
    }
    add(root);
    outer: while (cursor < queue.length) {
      const entry = nodes[queue[cursor]];
      for (const action of entry.node.legalActions) {
        if (transitions >= limits.transitions) stopReason = "transition-budget";
        else if (nodes.length >= limits.nodes) stopReason = "node-budget";
        else if (queue.length - cursor > limits.frontier) stopReason = "frontier-budget";
        else if (now() - startedAt >= limits.milliseconds) stopReason = "watchdog";
        if (stopReason) break outer;
        const child = port.expand(entry.node, action.actionId);
        transitions += 1;
        const added = add(child);
        if (added.equivalent) equivalents += 1;
        entry.edges.push({ actionId: action.actionId, target: added.index, equivalent: added.equivalent });
        if (now() - startedAt >= limits.milliseconds) {
          stopReason = "watchdog";
          break outer;
        }
      }
      entry.expanded = true;
      cursor += 1;
    }

    // 在完整有向图上从叶逆向传播；保留回边，不能把 DFS 栈上的节点误判成无解。
    // 分数相同优先最短路径，避免选中零收益循环。启发式分数不参与任何剪枝。
    if (!stopReason) {
      const parents = nodes.map(() => []);
      nodes.forEach((entry, index) => entry.edges.forEach(edge => parents[edge.target].push({ index, edge })));
      const changed = nodes.flatMap((entry, index) => entry.value == null ? [] : [index]);
      for (let head = 0; head < changed.length; head += 1) {
        const target = nodes[changed[head]];
        for (const { index, edge } of parents[changed[head]]) {
          const parent = nodes[index];
          const distance = target.distance + 1;
          if (parent.value == null || target.value > parent.value
            || (target.value === parent.value && (distance < parent.distance
              || (distance === parent.distance && edge.actionId < parent.best?.actionId)))) {
            parent.value = target.value;
            parent.distance = distance;
            parent.best = edge;
            changed.push(index);
          }
        }
      }
    }
    const unresolved = nodes.flatMap((entry, index) => entry.expanded ? [] : [{
      node: index, actionIds: entry.node.legalActions.slice(entry.edges.length).map(action => action.actionId),
    }]);
    const lines = nodes.map((entry, index) => ({
      node: index, status: entry.node.status, boundary: entry.node.boundary || null,
      expanded: entry.expanded, edges: entry.edges,
      value: entry.value, completion: entry.value == null ? (stopReason ? "pending" : "unreachable") : "reachable",
    }));
    const roots = root.legalActions.map(action => {
      const edge = nodes[0].edges.find(edge => edge.actionId === action.actionId);
      return {
        actionId: action.actionId, target: edge?.target ?? null,
        value: edge ? nodes[edge.target].value : null,
        completion: stopReason || !edge ? "pending" : nodes[edge.target].value == null ? "unreachable" : "complete",
      };
    });
    const complete = !stopReason;
    return {
      schemaVersion: VERSION, complete,
      actionId: complete ? nodes[0].best?.actionId || null : null,
      value: complete ? nodes[0].value : null,
      stopReason: stopReason || (nodes[0].value == null ? "no-reachable-boundary" : null),
      scope: "own-visible-decision-window-to-owner-information-or-terminal-boundary",
      roots, lines, unresolved,
      diagnostics: { transitions, nodes: nodes.length, equivalents, peakFrontier,
        milliseconds: now() - startedAt, limits },
    };
  }

  return Object.freeze({ VERSION, DEFAULT_BUDGET, searchDecision });
});
