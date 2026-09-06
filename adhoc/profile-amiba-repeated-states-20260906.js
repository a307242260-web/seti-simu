"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const { createSeededRandom, RNG_ALGORITHM } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const { createHeuristicDecisionFunction } = require("../randomizer/game/ai/heuristic-decision-function");
const { createMachinePlayerCoordinator } = require("../randomizer/game/ai/machine-player-coordinator");
const output = process.argv[2] || "reports/iteration/amiba-repeated-states-210-20260906.json";
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  let composition, serial = 0, projectedRawState;
  const rawStates = new WeakMap(), rawHashes = new WeakMap(), allStateHashes = new Set(), allWithoutRng = new Set();
  const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const groups = new Map(), observations = new WeakMap();
  const report = { scope: "真实绿210只读selector观察分组；同公开观察不等于完整规则状态可合并；同观察对象标识用于区分共享来源调用", calls: 0 };
  try {
    const cp = JSON.parse(fs.readFileSync("reports/iteration/round-income-green-before-search-20260906.json"));
    const seed = cp.config.seed, random = createSeededRandom(seed);
    random.setState(JSON.parse(cp.coreState.committedState).meta.rngState.state);
    composition = createSimulationRuleComposition({ seed, activePlayerCount: cp.config.activePlayerCount, random,
      rngState: { algorithm: RNG_ALGORITHM, state: random.getState() }, trustedProjectionReader: true,
      projectCounterfactualState: (state, viewer) => {
        if (viewer?.cheap === true) projectedRawState = state;
        return buildRuleObservation(state, seed, viewer?.playerId || null, [], { cheap: viewer?.cheap === true });
      },
    }).composition;
    assert.equal(composition.lifecycle.restore(cp.coreState.compositionEnvelope).ok, true);
    const port = composition.counterfactualPort;
    const recorder = { getDiagnostics: () => port.getDiagnostics(), evaluate(actions, options) {
      if (!options.secondaryAgentSearch) return port.evaluate(actions, options);
      const select = options.secondaryAgentSearch.selectSuccessors;
      return port.evaluate(actions, { ...options, getBranchPriority(input) {
        rawStates.set(input.branchObservation, projectedRawState);
        return options.getBranchPriority(input);
      }, secondaryAgentSearch: { ...options.secondaryAgentSearch,
        selectSuccessors(input) {
          const selected = select(input), legal = input.legalSuccessors;
          if (legal.length && legal.every(a => a.family === "choose_target" && a.target?.symbolId && a.target?.slotId)) {
            report.calls++;
            let identity = observations.get(input.branchObservation);
            if (!identity) { identity = ++serial; observations.set(input.branchObservation, identity); }
            let hashes = rawHashes.get(input.branchObservation);
            if (!hashes) {
              const raw = rawStates.get(input.branchObservation); assert.ok(raw, "正式优先级观察必须对应刚投影的规则状态");
              hashes = { full: hash(raw), withoutRng: hash({ ...raw, meta: { ...raw.meta, rngState: null } }) };
              rawHashes.set(input.branchObservation, hashes);
            }
            allStateHashes.add(hashes.full); allWithoutRng.add(hashes.withoutRng);
            const key = crypto.createHash("sha256").update(JSON.stringify([input.branchObservation, legal])).digest("hex");
            const group = groups.get(key) || { key, calls: 0, observationIds: new Set(), targets: new Set(), fullStates: new Set(), withoutRngStates: new Set(), choiceCount: legal.length, chains: [] };
            group.fullStates.add(hashes.full); group.withoutRngStates.add(hashes.withoutRng);
            group.calls++; group.targets.add(input.routeTargetId);
            if (!group.observationIds.has(identity) && group.chains.length < 2) group.chains.push(input.actionChain);
            group.observationIds.add(identity); groups.set(key, group);
          }
          return selected;
        },
      } });
    } };
    const boundary = createMachinePlayerCoordinator({ composition, execute() { throw new Error("诊断禁止根提交"); } }).readBoundary();
    const result = createHeuristicDecisionFunction({ composition: { counterfactualPort: recorder }, difficulty: cp.config.aiDifficulty }).run(boundary);
    report.actionId = result.actionId; report.searches = result.searches;
    report.distinctObservationObjects = serial;
    report.distinctValueGroups = groups.size;
    report.sameObjectExtraCalls = report.calls - serial;
    report.sameValueExtraObjects = serial - groups.size;
    report.distinctFullRuleStates = allStateHashes.size;
    report.distinctRuleStatesWithoutRng = allWithoutRng.size;
    report.groups = [...groups.values()].map(g => ({ ...g, observationIds: [...g.observationIds], targets: [...g.targets], fullStates: [...g.fullStates], withoutRngStates: [...g.withoutRngStates] }))
      .sort((a, b) => b.observationIds.length - a.observationIds.length);
    assert.equal(result.actionId, "move:2bb2c433"); report.passed = true;
  } catch (error) { report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally { composition?.dispose(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    const { groups: omitted, searches, ...summary } = report; console.log(JSON.stringify(summary, null, 2)); }
}
