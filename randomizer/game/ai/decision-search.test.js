"use strict";
const assert = require("node:assert/strict");
const { searchDecision } = require("./decision-search");
const { createStateValueEvaluator } = require("./state-value");

function graph(spec, start = "root") {
  const nodes = new Map();
  function read(name) {
    const entry = spec[name];
    const node = { observation: entry.observation || { value: entry.value }, status: entry.status || "stable",
      legalActions: Object.keys(entry.next || {}).map(actionId => ({ actionId, actorId: "p1" })) };
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

// 与逐点击选择图比较：任一 toggle 可取消再重选，所以都可达全部确认出口。
const selectionGraph = {
  root: { next: { x: "x", y: "y" } },
  x: { next: { x: "root", y: "x", confirm: "ordinary" } },
  y: { next: { y: "root", x: "y", confirm: "best" } },
  ordinary: { status: "other-owner", value: 3 },
  best: { status: "other-owner", value: 11 },
};
const reference = searchDecision(graph(selectionGraph));
const folded = graph(selectionGraph);
folded.port.selectionSpec = node => node === folded.root ? {
  requiredCount: 1, cardIds: ["x", "y"], selectedIds: [], proof: "selection-fixture",
} : null;
folded.port.selectionPlans = () => ["x", "y"].map(id => ({ selectedIds: [id], firstActionId: id,
  submissions: 2, proof: "selection-fixture" }));
folded.port.expandSelection = (node, ids) => {
  const step = folded.port.expand(node, ids[0]);
  return { node: folded.port.expand(step, "confirm"), submissions: 2,
    actions: [{ actionId: ids[0] }, { actionId: "confirm" }] };
};
const compact = searchDecision(folded);
assert.equal(compact.complete, true);
assert.equal(compact.actionId, reference.actionId);
assert.equal(compact.value, reference.value);
assert.deepEqual(compact.roots.map(root => root.value), reference.roots.map(root => root.value),
  "根 x 虽然自身直接确认仅3分，仍保留取消后改选 y 的11分线路");
assert.equal(compact.diagnostics.transitions, 4, "每个宏步的两次真实输入都记入额度");
assert.deepEqual(compact.selectionPlan.selectedIds, ["y"]);
const incomplete = searchDecision({ ...folded, budget: { transitions: 3 } });
assert.equal(incomplete.complete, false);
assert.equal(incomplete.actionId, null);
assert.equal(incomplete.selectionPlan, null);
assert.equal(incomplete.unresolved[0].selectionPlansRemaining, 1, "不能把未枚举出口算进等价覆盖");

function wallet(credits, energy, score = 0) {
  return { terminal: false, publicState: { roundNumber: 4, players: [{ playerId: "p1", score, finalScore: score,
    credits, energy, publicity: 0, availableData: 0, additionalPublicScan: 0,
    income: { credits: 0, energy: 0, publicity: 0, availableData: 0, handSize: 0, additionalPublicScan: 0 } }] },
    selfState: { playerId: "p1", hand: [] } };
}
const money = {
  root: { next: { poor: "poor", rich: "rich" } },
  poor: { next: { settle: "low" } },
  rich: { next: { settle: "high", reward: "best" } },
  low: { status: "other-owner", observation: wallet(1, 1) },
  high: { status: "other-owner", observation: wallet(2, 2) },
  best: { status: "other-owner", observation: wallet(2, 2, 5) },
};
const orderGroup = Object.freeze({});
function moneyFixture() {
  const fixture = graph(money);
  fixture.evaluate = createStateValueEvaluator("p1");
  fixture.port.postMainResourceOrder = node => {
    const name = fixture.port.identity(node);
    return ["poor", "rich"].includes(name) ? { group: orderGroup,
      credits: name === "poor" ? 1 : 2, energy: name === "poor" ? 1 : 2,
      proof: "money-simulation-fixture" } : null;
  };
  return fixture;
}
const exhaustiveMoney = searchDecision(moneyFixture());
const prunedMoney = searchDecision({ ...moneyFixture(), resourceDominance: true });
assert.equal(prunedMoney.complete, true);
assert.equal(prunedMoney.actionId, exhaustiveMoney.actionId);
assert.equal(prunedMoney.value, exhaustiveMoney.value);
assert.equal(prunedMoney.diagnostics.dominancePrunes, 1);
const prunedLine = prunedMoney.lines.find(line => line.completion === "proof-pruned");
assert.equal(prunedLine.value, null, "不能把更富状态的收益伪装成较穷状态的可得收益");
assert.equal(prunedMoney.lines[prunedLine.prunedBy.node].status, "stable");
assert.equal(prunedMoney.diagnostics.transitions, exhaustiveMoney.diagnostics.transitions - 1);
assert.deepEqual(prunedMoney.unresolved, []);
assert.throws(() => searchDecision({ ...moneyFixture(), evaluate: () => 100, resourceDominance: true }), /PROOF_MODEL_INVALID/);
assert.throws(() => searchDecision({ ...moneyFixture(), evaluate: createStateValueEvaluator("p2"),
  resourceDominance: true }), /PROOF_MODEL_INVALID/);
assert.throws(() => searchDecision({ ...moneyFixture(), evaluate: createStateValueEvaluator("p1", { weights: { energy: 0 } }),
  resourceDominance: true }), /PROOF_MODEL_INVALID/);
const crossed = moneyFixture();
const originalOrder = crossed.port.postMainResourceOrder;
const otherAttributionGroup = Object.freeze({});
crossed.port.postMainResourceOrder = node => {
  const order = originalOrder(node);
  return order && { ...order, group: order.credits === 1 ? order.group : otherAttributionGroup };
};
const crossedResult = searchDecision({ ...crossed, resourceDominance: true });
assert.equal(crossedResult.diagnostics.dominancePrunes, 0, "蓝槽留存等其他事实不同的组不构成支配");
assert.equal(crossedResult.diagnostics.transitions, exhaustiveMoney.diagnostics.transitions);
const moneyLimited = searchDecision({ ...moneyFixture(), resourceDominance: true, budget: { transitions: 2 } });
assert.equal(moneyLimited.complete, false);
assert.equal(moneyLimited.actionId, null, "有剪枝证明也不能把剩余富分支未展开当作完成");
const selectionModel = createStateValueEvaluator("p1");
const selectionFixture = graph({
  root: { next: { x: "x", y: "y" } }, x: { next: { confirm: "low" } }, y: { next: { confirm: "high" } },
  low: { status: "other-owner", observation: wallet(1, 1) },
  high: { status: "other-owner", observation: wallet(2, 2) },
});
selectionFixture.port.selectionSpec = node => node === selectionFixture.root ? {
  requiredCount: 1, cardIds: ["x", "y"], selectedIds: [], proof: "selection-fixture",
} : null;
selectionFixture.port.selectionPlans = folded.port.selectionPlans;
selectionFixture.port.expandSelection = (node, ids) => ({
  node: selectionFixture.port.expand(selectionFixture.port.expand(node, ids[0]), "confirm"),
  submissions: 2, actions: [{ actionId: ids[0] }, { actionId: "confirm" }],
});
selectionFixture.port.postMainResourceOrder = () => { throw new Error("selection certificate must keep exact exits"); };
const exactSelection = searchDecision({ ...selectionFixture, evaluate: selectionModel, resourceDominance: true });
assert.equal(exactSelection.complete, true);
assert.equal(exactSelection.diagnostics.resourceDominance, "disabled-for-selection-certificate");
console.log("complete decision graph coverage, cycles, preparation chains and budget failures passed");
