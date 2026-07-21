"use strict";

const assert = require("node:assert/strict");
const audit = require("../../../tools/lib/state-authority-audit");

const cases = [
  {
    label: "第二可变 root",
    file: "randomizer/app/rogue-runtime.js",
    source: "let resident = createHighCouplingStateStore(seedState);",
    code: "SEMANTIC_SECOND_MUTABLE_ROOT",
  },
  {
    label: "直接 committed slice 写",
    file: "randomizer/app/rogue-runtime.js",
    source: "store.getSnapshot().players.score += 1;",
    code: "SEMANTIC_DIRECT_COMMITTED_WRITE",
  },
  {
    label: "改名 projection bridge",
    file: "randomizer/app/browser-host/renamed-view.js",
    source: "const display = { playerState: a, turnState: b, cardState: c, solarState: d }; return renderProjection(display);",
    code: "SEMANTIC_RENAMED_PROJECTION_BRIDGE",
  },
  {
    label: "保存时拼 root",
    file: "randomizer/app/rogue-save.js",
    source: "save(JSON.stringify({ match:a, turn:b, players:c, solarSystem:d, pieces:e, planets:f, data:g, cards:h, tech:i, aliens:j, finalScoring:k }));",
    code: "SEMANTIC_SAVE_ROOT_STITCH",
  },
  {
    label: "恢复时拆 root",
    file: "randomizer/app/rogue-recovery.js",
    source: "function restore(root){ playerState = root.players; turnState = root.turn; cardState = root.cards; solarState = root.solarSystem; }",
    code: "SEMANTIC_RECOVERY_ROOT_SPLIT",
  },
  {
    label: "旧 policy helper",
    file: "randomizer/game/ai/renamed-selector.js",
    source: "function choose(candidates){ return candidates[0]; }",
    code: "SEMANTIC_POLICY_FIRST_OPTION_FALLBACK",
  },
  {
    label: "双写",
    file: "randomizer/app/browser-state-authority.js",
    source: "store.compareAndCommit(version, next); shadowState.players = next.players;",
    code: "SEMANTIC_DUAL_WRITE",
  },
  {
    label: "旧 schema 字段",
    file: "randomizer/app/rogue-runtime.js",
    source: "const oldTiles = player.techState.ownedTileByType;",
    code: "SEMANTIC_LEGACY_SCHEMA_READ",
  },
  {
    label: "未知 family fallback",
    file: "randomizer/game/ai/renamed-selector.js",
    source: "switch (family) { default: return legalActions[0]; }",
    code: "SEMANTIC_UNKNOWN_FALLBACK",
  },
];

for (const fixture of cases) {
  const violations = audit.inspectSemanticSource(fixture.file, fixture.source);
  assert.ok(
    violations.some((entry) => entry.code === fixture.code),
    `${fixture.label} 应触发 ${fixture.code}，实际 ${JSON.stringify(violations)}`,
  );
}

assert.deepEqual(
  audit.inspectSemanticSource("randomizer/app/read-only-view.js", "const label = projection.players[0].name;"),
  [],
  "普通只读投影不能误报",
);

console.log(`semantic architecture audit negative fixtures passed (${cases.length})`);
