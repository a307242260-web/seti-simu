"use strict";

const assert = require("node:assert/strict");
const fixture = require("./heuristic-policy.fixed-board.json");
const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
  projectFixedBoard,
  fingerprintFixedBoard,
} = require("./heuristic-policy.fixed-board");
const { createHeadlessEnv } = require("../app/headless-env");

assert.equal(fixture.boardId, FIXED_BOARD_ID);
assert.deepEqual(fixture.config, FIXED_BOARD_CONFIG);

function resetFingerprint(env, config = FIXED_BOARD_CONFIG) {
  const observation = env.reset(config);
  return fingerprintFixedBoard(projectFixedBoard(observation));
}

const firstEnv = createHeadlessEnv();
const first = resetFingerprint(firstEnv);
const sameInstance = resetFingerprint(firstEnv);
resetFingerprint(firstEnv, { ...FIXED_BOARD_CONFIG, seed: "seti-104-board-control-seed" });
const afterOtherSeed = resetFingerprint(firstEnv);
firstEnv.dispose();

const freshEnv = createHeadlessEnv();
const fresh = resetFingerprint(freshEnv);
freshEnv.dispose();

for (const [label, fingerprint] of Object.entries({ first, sameInstance, afterOtherSeed, fresh })) {
  assert.equal(fingerprint, fixture.fingerprint, `${label} 必须保持固定版面 ${FIXED_BOARD_ID}`);
}

console.log(`training/heuristic-policy.fixed-board.test.js ok (${FIXED_BOARD_ID})`);
