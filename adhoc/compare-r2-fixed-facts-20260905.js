"use strict";
// 只重算已保存的同一组轻量事实，不加载Simulation、不执行搜索或游戏动作。
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const output = "reports/iteration/resource-r2-fixed-facts-comparison-20260905.json";
const evaluatorPath = "randomizer/game/ai/expected-score-evaluator.js";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sources = ["divergence", "step44", "step67", "step68", "baseline-step73", "step88"];

function loadEvaluator(commit) {
  const source = execFileSync("git", ["show", `${commit}:${evaluatorPath}`], { encoding: "utf8" });
  const module = { exports: {} };
  new vm.Script(source, { filename: `${commit}/${evaluatorPath}` }).runInNewContext({
    module, require: createRequire(path.resolve(evaluatorPath)), structuredClone,
  });
  return { commit, codeSha256: hash(source), api: module.exports };
}

function missingFacts(facts) {
  if (!facts) return ["facts"];
  const missing = ["viewerSeatId", "terminal", "realizedScore", "securedEndGameBonus",
    "ownedTechIds", "income", "researchOptions", "blueBonusAssets", "dataProgress",
    "traceCount", "resourceFacts", "roundNumber", "finalRoundNumber"]
    .filter((key) => !Object.hasOwn(facts, key));
  for (const [key, fields] of Object.entries({
    income: ["credits", "energy", "publicity", "availableData", "handSize", "additionalPublicScan"],
    resourceFacts: ["credits", "energy", "publicity", "availableData", "ordinaryCards", "alienCards", "additionalPublicScan"],
    blueBonusAssets: ["credits", "energy", "ordinaryCards"],
    dataProgress: ["computerPlacedCount", "analyzeReady", "blueBonusCount", "blueSlots"],
  })) {
    for (const field of fields) if (!Object.hasOwn(facts[key] || {}, field)) missing.push(`${key}.${field}`);
  }
  for (const [index, option] of (facts.researchOptions || []).entries()) {
    if (!option.tileId || !Number.isFinite(option.publicityCost)) missing.push(`researchOptions.${index}`);
  }
  return missing;
}

if (fs.existsSync(output)) {
  console.log(`已有checkpoint，未重算：${output}`);
} else {
  const evaluators = ["d9283ce5", "4f994f86", "fda901b9"].map(loadEvaluator);
  const report = {
    createdAt: new Date().toISOString(), gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scope: "固定已保存的rootFacts/leafFacts，仅比较evaluateStrategicFactsBreakdown；不比较完整Policy、V或终局成绩",
    dependencies: "三个评估器在独立VM加载各自git源码，共用当前不变的正式依赖；输入事实不重建，不更换搜索结果",
    evaluators: evaluators.map(({ api, ...identity }) => identity), cases: [],
  };
  for (const sourceName of sources) {
    const source = `reports/iteration/resource-r2-${sourceName}-20260905.json`;
    const input = fs.readFileSync(source, "utf8");
    const saved = JSON.parse(input);
    const sample = { source, inputSha256: hash(input), sourceCommit: saved.gitCommit,
      actions: [], excluded: [] };
    for (const outcome of saved.outcomes) {
      if (!outcome.leaves?.length) {
        sample.excluded.push({ actionId: outcome.actionId, reason: "无叶，不补造估值输入", status: outcome.status, code: outcome.code });
        continue;
      }
      const action = { actionId: outcome.actionId, leaves: [] };
      for (const [index, leaf] of outcome.leaves.entries()) {
        const missing = [...missingFacts(outcome.rootFacts).map((key) => `root.${key}`),
          ...missingFacts(leaf.facts).map((key) => `leaf.${key}`)];
        if (missing.length) {
          sample.excluded.push({ actionId: outcome.actionId, leafIndex: index, reason: "必要事实缺失", missing });
          continue;
        }
        const before = JSON.stringify([outcome.rootFacts, leaf.facts]);
        const values = Object.fromEntries(evaluators.map(({ commit, api }) => [commit,
          api.evaluateStrategicFactsBreakdown(outcome.rootFacts, leaf.facts)]));
        assert.equal(JSON.stringify([outcome.rootFacts, leaf.facts]), before, "评估不得改变固定输入");
        for (const value of Object.values(values)) assert.ok(Number.isFinite(value.primaryValue));
        action.leaves.push({ leafIndex: index, leafId: leaf.leafId, actionChain: leaf.actionChain, values });
      }
      if (action.leaves.length) {
        action.bestPrimary = Object.fromEntries(evaluators.map(({ commit }) => [commit,
          Math.max(...action.leaves.map((leaf) => leaf.values[commit].primaryValue))]));
        sample.actions.push(action);
      }
    }
    sample.bestByVersion = Object.fromEntries(evaluators.map(({ commit }) => [commit,
      sample.actions.map((action) => ({ actionId: action.actionId, primary: action.bestPrimary[commit] }))
        .sort((a, b) => b.primary - a.primary || a.actionId.localeCompare(b.actionId)).slice(0, 5)]));
    report.cases.push(sample);
  }
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.cases.map(({ source, actions, excluded, bestByVersion }) => ({
    source, actions: actions.length, leaves: actions.reduce((n, a) => n + a.leaves.length, 0),
    excluded: excluded.length, bestByVersion,
  })), null, 2));
}
