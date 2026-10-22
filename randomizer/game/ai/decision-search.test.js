"use strict";
const assert = require("node:assert/strict");
const { searchDecision } = require("./decision-search");

function graph(spec, start = "root") {
  const nodes = new Map();
  function read(name) {
    const entry = spec[name];
    const node = { observation: { value: entry.value }, status: entry.status || "stable",
      legalActions: Object.keys(entry.next || {}).map(actionId => ({ actionId })) };
    nodes.set(node, name);
    return node;
  }
  const port = {
    identity: node => nodes.get(node),
    expand: (node, actionId) => read(spec[nodes.get(node)].next[actionId]),
  };
  return { port, root: read(start), evaluate: obs => obs.value };
}

const fixture = {
  root: { next: { prepare: "prepared", immediate: "ordinary", cycle: "loop" } },
  prepared: { next: { pay: "paid", cancel: "root" } },
  paid: { next: { choose: "reward" } },
  reward: { next: { good: "best", bad: "ordinary" } },
  ordinary: { status: "other-owner", value: 3 },
  best: { status: "other-owner", value: 11 },
  loop: { next: { back: "root", stuck: "closed" } },
  closed: { next: { forever: "closed" } },
};
const result = searchDecision(graph(fixture));
assert.equal(result.complete, true);
assert.equal(result.actionId, "prepare", "不能因一步分低而漏掉付款及条件奖励链");
assert.equal(result.value, 11);
assert.equal(result.roots.find(root => root.actionId === "cycle").value, 11,
  "回边的根归属保留，不能用 DFS 栈剪枝把可返回主图的路径误判无解");
assert.equal(result.lines.find(line => line.edges.some(edge => edge.actionId === "forever")).completion, "unreachable",
  "完整闭合且无比较边界的强连通部分才可证明无解");
assert.deepEqual(result.unresolved, []);
assert(result.diagnostics.equivalents >= 3);

for (const budget of [{ transitions: 2 }, { nodes: 2 }, { frontier: 1 }]) {
  const limited = searchDecision({ ...graph(fixture), budget });
  assert.equal(limited.complete, false);
  assert.equal(limited.actionId, null, "未闭合不能把当前最佳叶作为正式选择");
  assert(limited.unresolved.length);
}
let tick = 0;
const timed = searchDecision({ ...graph(fixture), now: () => tick += 10, budget: { milliseconds: 15 } });
assert.equal(timed.complete, false);
assert.equal(timed.stopReason, "watchdog");
assert.equal(timed.actionId, null);
assert.throws(() => searchDecision({ ...graph(fixture), evaluate: () => NaN }), /VALUE_INVALID/);

const ties = { root: { next: { b: "best", a: "best", detour: "via" } },
  via: { next: { finish: "best" } }, best: { status: "terminal", value: 4 } };
assert.equal(searchDecision(graph(ties)).actionId, "a", "平分按最短路径与稳定 actionId 选择");
assert.equal(searchDecision(graph(ties)).diagnostics.transitions, 4);
console.log("complete decision graph coverage, cycles, preparation chains and budget failures passed");
