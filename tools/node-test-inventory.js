"use strict";

function lines(value) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function modulesFor(relative) {
  if (relative === "randomizer/full-flow/standard-flow.test.js") {
    return ["uniqueAction", "uniqueEffectQueue", "uniqueSessionState", "unifiedAuthorityState"];
  }
  if (/browser-host\/(?:heuristic-policy\.integration|policy-input-adapter)\.test|public-api-ai-contract/.test(relative)) return ["webUi"];
  if (/headless-(?:contract|final-scoring|legality)\.test/.test(relative)) return ["uniqueAction"];
  if (/headless-effect-failure\.test/.test(relative)) return ["uniqueEffectQueue"];
  if (/headless-(?:conditional-drain|decision-owner|effect-session-host|effect-session-worker-recovery|fail-closed|no-browser-globals|training-replay)\.test/.test(relative)) return ["uniqueSessionState"];
  if (/headless-state-checkpoint\.test/.test(relative)) return ["unifiedAuthorityState"];
  if (/\/training\/|\/game\/ai\/|\/app\/ai\/|headless-worker-resilience/.test(relative)) return ["robot"];
  if (/\/game\/effects\/|effect-session-host|decision-session-store/.test(relative)) return ["uniqueSessionState"];
  if (/\/app\/effects\/|effect-flow|effect-choice-flow/.test(relative)) return ["uniqueEffectQueue"];
  if (/\/game\/(?:actions|abilities|industry|aliens)\/|\/game\/(?:basic-cards|initial-cards)\.test|action-runtime|action-briefing/.test(relative)) return ["uniqueAction"];
  if (/\/game\/(?:state|cards|data|tech|history)\/|\/game\/(?:players|rockets|rockets\.move|planet-stats|final-scoring|end-game-scoring)\.test|\/solar-system\//.test(relative)) return ["unifiedAuthorityState"];
  if (/\/app\//.test(relative)) return ["webUi"];
  return [];
}

module.exports = Object.freeze({
  schemaVersion: "seti-node-test-inventory-v1",
  unit: lines(`
randomizer/app/action-log-export.test.js
randomizer/app/action-log-runtime.test.js
randomizer/app/alien-runtime.test.js
randomizer/app/alien-trace-reward-flow.test.js
randomizer/app/alien-ui.test.js
randomizer/app/aliens/species-runtime.test.js
randomizer/app/bootstrap.test.js
randomizer/app/browser-host/action-bar.test.js
randomizer/app/browser-host/browser-host.test.js
randomizer/app/browser-host/browser-services.test.js
randomizer/app/browser-host/card-decision-ui.test.js
randomizer/app/browser-host/decision-ui.test.js
randomizer/app/browser-host/industry-alien-decision-ui.test.js
randomizer/app/browser-host/resident-renderer.test.js
randomizer/app/browser-host/scan-data-land-session.test.js
randomizer/app/browser-rule-composition.test.js
randomizer/app/browser-state-authority.test.js
randomizer/app/card-runtime.test.js
randomizer/app/card-trigger-runtime.test.js
randomizer/app/constants.test.js
randomizer/app/debug-runtime.test.js
randomizer/app/dependencies.test.js
randomizer/app/effect-choice-flow.test.js
randomizer/app/effect-flow.test.js
randomizer/app/effect-session-host.test.js
randomizer/app/effects/executors.test.js
randomizer/app/final-ui-runtime.test.js
randomizer/app/game-recovery.test.js
randomizer/app/hand-flow.test.js
randomizer/app/primary-board-action-executor.test.js
randomizer/app/headless-conditional-drain.test.js
randomizer/app/headless-decision-owner.test.js
randomizer/app/headless-effect-failure.test.js
randomizer/app/headless-effect-session-host.test.js
randomizer/app/headless-effect-session-worker-recovery.test.js
randomizer/app/headless-fail-closed.test.js
randomizer/app/headless-no-browser-globals.test.js
randomizer/app/headless-state-checkpoint.test.js
randomizer/app/headless-training-replay.test.js
randomizer/app/income-runtime.test.js
randomizer/app/industry-runtime.test.js
randomizer/app/refresh.test.js
randomizer/app/render-runtime.test.js
randomizer/app/runtime.test.js
randomizer/app/scan-flow.test.js
randomizer/app/start-screen.test.js
randomizer/app/tech-runtime.test.js
randomizer/app/turn-flow.test.js
randomizer/app/view-adapter.test.js
randomizer/game/actions/actions.test.js
randomizer/game/actions/quick-trades.test.js
randomizer/game/aliens/amiba.test.js
randomizer/game/aliens/aomomo.test.js
randomizer/game/aliens/banrenma.test.js
randomizer/game/aliens/chong.test.js
randomizer/game/aliens/fangzhou.test.js
randomizer/game/aliens/jiuzhe.test.js
randomizer/game/aliens/reveal-card-grants.test.js
randomizer/game/aliens/runezu.test.js
randomizer/game/aliens/trace-placement-legality.test.js
randomizer/game/aliens/yichangdian.test.js
randomizer/game/cards/deck.test.js
randomizer/game/cards/effects.test.js
randomizer/game/cards/task-state.test.js
randomizer/game/data/data.test.js
randomizer/game/data/nebula.test.js
randomizer/game/effects/decision-session-store.test.js
randomizer/game/effects/industry-alien-session.test.js
randomizer/game/effects/quick-action-session.test.js
randomizer/game/effects/research-tech-session.test.js
randomizer/game/effects/scan-card-session.test.js
randomizer/game/effects/standard-action-session.test.js
randomizer/game/effects/session-journal.test.js
randomizer/game/effects/session-runtime.test.js
randomizer/game/effects/state-store-session.test.js
randomizer/game/end-game-scoring.test.js
randomizer/game/final-scoring.test.js
randomizer/game/history/action-history.test.js
randomizer/game/history/commands.test.js
randomizer/game/planet-stats.test.js
randomizer/game/players.test.js
randomizer/game/rockets.move.test.js
randomizer/game/rockets.test.js
randomizer/game/state/deterministic-sequences.test.js
randomizer/game/state/high-coupling-slices.test.js
randomizer/game/state/host-source.test.js
randomizer/game/state/low-coupling-slices.test.js
randomizer/game/state/state-store.test.js
randomizer/game/tech/bonuses.test.js
randomizer/game/tech/tech.test.js
randomizer/solar-system/core.test.js
  `),
  fullFlow: ["randomizer/full-flow/standard-flow.test.js"],
  architectureModules: Object.freeze({
    uniqueAction: "唯一 Action",
    uniqueEffectQueue: "唯一 Effect Queue",
    uniqueSessionState: "唯一 Session 状态",
    unifiedAuthorityState: "统一权威状态",
    webUi: "网页 UI",
    robot: "机器人",
  }),
  modulesFor,
});
