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

function boundFixture(bestScore = 5, options = {}) {
  const drawn = wallet(1, 1);
  drawn.selfState.hand = [{ hidden: true }];
  const fixture = graph({ root: { next: { bad: "via", good: "best" } },
    via: { next: { trade: "pending" } },
    pending: { status: "decision", observation: wallet(1, 1), next: { pick: "drawn" } },
    drawn: { status: "information-barrier", observation: drawn },
    best: { status: "other-owner", observation: wallet(1, 1, bestScore) },
  });
  fixture.evaluate = createStateValueEvaluator("p1", options);
  fixture.port.cardTradeBound = node => fixture.port.identity(node) === "pending"
    ? { proof: "card-bound-fixture", handDelta: 1 } : null;
  return fixture;
}
const rawBound = searchDecision(boundFixture());
const prunedBound = searchDecision({ ...boundFixture(), cardTradePruning: true });
assert.equal(prunedBound.complete, true);
assert.equal(prunedBound.actionId, rawBound.actionId);
assert.equal(prunedBound.value, rawBound.value);
assert.equal(prunedBound.diagnostics.cardTradePrunes, 1);
assert.equal(prunedBound.diagnostics.transitions, rawBound.diagnostics.transitions - 1);
const boundedLine = prunedBound.lines.find(line => line.prunedByBound);
assert.equal(boundedLine.value, null, "估值上界不是该分支已执行得到的收益");
assert.equal(boundedLine.prunedByBound.upperBound, 3);
assert.equal(prunedBound.lines[boundedLine.prunedByBound.node].value, 7,
  "剪枝必须引用真正完成到比较边界的严格更优叶");
assert.equal(prunedBound.lines.find(line => line.edges.some(edge => edge.actionId === "trade")).completion,
  "covered-by-global-pruning", "祖先不能将有可达但被覆盖的边界误报成规则不可达");
assert.deepEqual(prunedBound.unresolved, []);
assert.equal(searchDecision({ ...boundFixture(1), cardTradePruning: true }).diagnostics.cardTradePrunes, 0,
  "仅相等时不能省略可能影响最短路径或actionId平分选择的分支");
const valuableCard = boundFixture(5, { weights: { handSize: 100 } });
const valuableResult = searchDecision({ ...valuableCard, cardTradePruning: true });
assert.equal(valuableResult.actionId, "bad", "取牌权重变高时必须按新模型保留有价值的分支");
assert.equal(valuableResult.value, 102);
assert.equal(valuableResult.diagnostics.cardTradePrunes, 0);
const unfinishedBound = searchDecision({ ...boundFixture(), cardTradePruning: true, budget: { transitions: 2 } });
assert.equal(unfinishedBound.complete, false);
assert.equal(unfinishedBound.actionId, null, "已有较优叶也不能跳过尚无上界的准备线");
const timedBound = boundFixture();
let boundClock = 0;
const boundFacts = timedBound.port.cardTradeBound;
timedBound.port.cardTradeBound = node => { const proof = boundFacts(node); if (proof) boundClock = 1000; return proof; };
const lateBound = searchDecision({ ...timedBound, cardTradePruning: true, now: () => boundClock,
  budget: { milliseconds: 100 } });
assert.equal(lateBound.complete, false);
assert.equal(lateBound.stopReason, "watchdog");
assert.equal(lateBound.actionId, null, "上界计算本身超时仍拒绝选招");
assert.throws(() => searchDecision({ ...boundFixture(), evaluate: () => 9, cardTradePruning: true }), /BOUND_MODEL_INVALID/);
assert.throws(() => searchDecision({ ...boundFixture(), evaluate: createStateValueEvaluator("p2"),
  cardTradePruning: true }), /BOUND_MODEL_INVALID/);
selectionFixture.port.cardTradeBound = () => { throw new Error("selection certificate needs exact exit values"); };
const selectionWithoutBounds = searchDecision({ ...selectionFixture, evaluate: selectionModel, cardTradePruning: true });
assert.equal(selectionWithoutBounds.complete, true);
assert.equal(selectionWithoutBounds.diagnostics.cardTradePruning, "disabled-for-selection-certificate");

function postMainFixture() {
  const fixture = graph({ root: { observation: wallet(2, 1), next: { wasted: "low", keep: "via" } },
    via: { observation: wallet(2, 1), next: { settle: "high" } },
    low: { status: "other-owner", observation: wallet(1, 1) },
    high: { status: "other-owner", observation: wallet(2, 1) } });
  fixture.evaluate = createStateValueEvaluator("p1");
  fixture.port.postMainPlanSpec = node => node === fixture.root ? {
    proof: "local-post-main-fixture", retainedActionIds: ["keep"], excludedActionIds: ["wasted"], maximumValueIncrease: 0,
  } : null;
  return fixture;
}
const localRaw = searchDecision(postMainFixture());
const localPruned = searchDecision({ ...postMainFixture(), postMainPruning: true });
assert.equal(localPruned.actionId, localRaw.actionId);
assert.equal(localPruned.value, localRaw.value);
assert.equal(localPruned.lines[0].distance, localRaw.lines[0].distance);
assert.equal(localPruned.diagnostics.transitions, localRaw.diagnostics.transitions - 1);
const excludedRoot = localPruned.roots.find(row => row.prunedByPlan);
assert.equal(excludedRoot.value, null);
assert.equal(localPruned.lines[excludedRoot.prunedByPlan.witness.node].status, "other-owner");
assert.equal(excludedRoot.prunedByPlan.witness.scope, "local");
const localLimited = searchDecision({ ...postMainFixture(), postMainPruning: true, budget: { transitions: 1 } });
assert.equal(localLimited.complete, false);
assert.equal(localLimited.actionId, null);
assert.equal(localLimited.roots.find(row => row.prunedByPlan).completion, "pending-retained-search");
assert.equal(localLimited.roots.find(row => row.prunedByPlan).prunedByPlan.witness, null);
assert.deepEqual(localLimited.unresolved.map(row => row.actionIds), [["settle"]],
  "待展开只计保留图中的剩余输入，不把被证明省略的动作重新算作缺失");
const malformedLocal = postMainFixture();
malformedLocal.port.postMainPlanSpec = () => ({ retainedActionIds: ["keep"], excludedActionIds: ["unknown"], maximumValueIncrease: 0 });
assert.throws(() => searchDecision({ ...malformedLocal, postMainPruning: true }), /POST_MAIN_PROOF_INVALID/);
const unsafeLocal = postMainFixture();
unsafeLocal.root.observation.publicState.players[0].credits = Number.MAX_SAFE_INTEGER;
const unprunedUnsafe = searchDecision({ ...unsafeLocal, postMainPruning: true });
assert.equal(unprunedUnsafe.diagnostics.postMainExcludedActions, 0, "精确半整数范围外保留原图");
assert.equal(unprunedUnsafe.diagnostics.transitions, localRaw.diagnostics.transitions);
const noWitness = postMainFixture();
const expandLocal = noWitness.port.expand;
noWitness.port.expand = (node, actionId) => actionId === "keep" ? noWitness.root : expandLocal(node, actionId);
assert.throws(() => searchDecision({ ...noWitness, postMainPruning: true }), /POST_MAIN_WITNESS_MISSING/);
const slowProof = postMainFixture();
let localClock = 0;
const localSpec = slowProof.port.postMainPlanSpec;
slowProof.port.postMainPlanSpec = node => { localClock = 1000; return localSpec(node); };
const lateLocal = searchDecision({ ...slowProof, postMainPruning: true, now: () => localClock, budget: { milliseconds: 100 } });
assert.equal(lateLocal.complete, false);
assert.equal(lateLocal.actionId, null);
assert.equal(lateLocal.stopReason, "watchdog");
let certificateClock = 0;
selectionFixture.port.rememberSelection = () => { certificateClock = 1000; return Object.freeze({}); };
const lateCertificate = searchDecision({ ...selectionFixture, evaluate: selectionModel, modelKey: "late-certificate",
  now: () => certificateClock, budget: { milliseconds: 100 } });
assert.equal(lateCertificate.complete, false);
assert.equal(lateCertificate.stopReason, "watchdog");
assert.equal(lateCertificate.actionId, null);
assert.equal(lateCertificate.selectionContinuation, null, "生成复用证据的时间也计入决策门槛");
console.log("complete decision graph coverage, cycles, preparation chains and budget failures passed");
