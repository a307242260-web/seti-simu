"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const source = "reports/iteration/trace-analysis-hotspot-433-20260906.json";
const output = "reports/iteration/trace-permutations-433-20260906-v2.json";
// 只分析既有目标簇，不运行搜索。多重集合仅用于找候选，不是状态等价判定。
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === "object"
  && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
if (fs.existsSync(output)) console.log(`已有记录，跳过：${output}`);
else {
  const bytes = fs.readFileSync(source), input = JSON.parse(bytes);
  assert.equal(input.passed, true);
  const report = { source, sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    scope: "目标簇内family+target多重集合相同、执行顺序不同的候选；不是物理节点或语义等价数量",
    clusters: [], permutationGroups: [] };
  for (const cluster of input.diagnostics.goalClusters) {
    const groups = new Map();
    for (const [index, variant] of cluster.routeVariants.entries()) {
      const key = stable(variant.actions.map(action => stable([action.family, action.target])).sort());
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ index, variant });
    }
    const permutations = [...groups.values()].filter(group => group.length > 1);
    report.clusters.push({ path: cluster.path, variants: cluster.routeVariants.length,
      permutationGroupCount: permutations.length });
    for (const group of permutations) {
      const differences = [];
      for (let i = 0; i < group[0].variant.actions.length; i++) {
        const actions = group.map(entry => entry.variant.actions[i]);
        if (new Set(actions.map(action => stable([action.family, action.target]))).size > 1)
          differences.push({ index: i, choices: actions });
      }
      report.permutationGroups.push({ path: cluster.path,
        variantIndices: group.map(entry => entry.index), differences });
    }
  }
  report.allDifferencesAreBlindDisplayCardOrder = report.permutationGroups.length > 0
    && report.permutationGroups.every(group => group.differences.length === 2
      && group.differences.every(diff => diff.choices.every(action => action.family === "choose_card"
        && ["blind", "display"].includes(action.target.source))));
  const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-overflow-before-step-433-20260906.json"));
  const state = JSON.parse(cp.coreState.committedState);
  report.drawOrderCounterexamples = [];
  for (const species of ["amiba", "chong"]) {
    const module = require(`../randomizer/game/aliens/${species}`);
    const cases = [];
    for (const order of [["blindDrawCard", "takeDisplayedCard"], ["takeDisplayedCard", "blindDrawCard"]]) {
      const aliens = structuredClone(state.aliens), cards = [];
      // 受控相同随机数0证明两种操作不满足普遍交换律，不冒充搜索分支RNG重放。
      for (const [index, method] of order.entries()) {
        const result = module[method](aliens, () => 0, { sequence: index + 1 });
        assert.equal(result.ok, true);
        cards.push(result.card.cardId);
      }
      cases.push({ order, cards, displayedCardIndex: aliens[species].displayedCardIndex,
        remainingDeck: aliens[species].cardDeck });
    }
    const sameCards = stable([...cases[0].cards].sort()) === stable([...cases[1].cards].sort());
    assert.equal(sameCards, false, `${species}反例未产生不同手牌，不能声称反例成立`);
    report.drawOrderCounterexamples.push({ species, random: "固定0，正式primitive受控反例", cases, sameCards });
  }
  report.passed = true;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ output, clusters: report.clusters.length,
    permutationGroups: report.permutationGroups.length,
    allDifferencesAreBlindDisplayCardOrder: report.allDifferencesAreBlindDisplayCardOrder }));
}
