"use strict";
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

// 报告窄接口夹具：只执行正式开局选择和一次交易，不运行机器人搜索。
function createReportSave(seed = "report-replay-fixture", activePlayerCount = 4) {
  const env = createSimulationEnv();
  const progress = new Map();
  try {
    env.reset({ seed, activePlayerCount });
    for (let index = 0; index < 50; index += 1) {
      const actions = env.legalActions();
      const quick = actions.find(action => action.family === "quick_trade");
      if (quick) {
        const result = env.step(quick);
        assert.equal(result.ok, true, JSON.stringify(result));
        return env.saveBrowserSave();
      }
      const actor = actions[0]?.actorId;
      const selected = progress.get(actor) || { industry: false, initial: new Set() };
      let action = actions.find(a => a.target?.kind === "start_initial_setup")
        || actions.find(a => a.target?.kind === "confirm_initial_setup")
        || actions.find(a => a.family === "choose_payment" && a.target?.kind === "discard-hand-cards");
      if (!action && !selected.industry) {
        action = actions.find(a => a.target?.selectionKind === "industry");
        if (action) selected.industry = true;
      }
      if (!action && selected.initial.size < 2) {
        action = actions.find(a => a.target?.selectionKind === "initial"
          && !selected.initial.has(a.target.cardId));
        if (action) selected.initial.add(action.target.cardId);
      }
      assert.ok(action, `报告夹具遇到未定义开局选择: ${JSON.stringify(actions)}`);
      progress.set(actor, selected);
      const result = env.step(action);
      assert.equal(result.ok, true, JSON.stringify(result));
    }
    throw new Error("报告夹具开局未在50步内结束");
  } finally { env.dispose(); }
}
module.exports = { createReportSave };
