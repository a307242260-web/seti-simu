"use strict";

const assert = require("node:assert/strict");
const initialSetup = require("./initial-setup");
const finalScoring = require("./final-scoring");

// 任务中继站：开局确认公司在终局 c 板块 3 号位放置自己的标记。
// 通过初始选择 source 的 confirm 路径驱动，验证 wiring（initializeIndustryState → placeDirectMarkAtSlot）。
function createRoot() {
  const root = {
    meta: { seed: "mission-mark-test", sequences: { finalMark: 1 } },
    players: {
      players: [
        { id: "p1", name: "玩家一", color: "white" },
        { id: "p2", name: "玩家二", color: "blue" },
      ],
    },
    turn: { currentPlayerId: "p1", activePlayerIds: ["p1", "p2"] },
    finalScoring: finalScoring.createFinalScoringState(),
    match: {
      initialSetup: {
        phase: "selecting",
        currentPlayerId: "p1",
        playerIds: ["p1", "p2"],
        confirmedPlayerIds: [],
        offersByPlayerId: {
          p1: {
            playerId: "p1",
            industryOptions: [
              { id: "industry:任务中继站.png", kind: "industry", value: "任务中继站.png" },
              { id: "industry:深空探测.png", kind: "industry", value: "深空探测.png" },
            ],
            initialOptions: [
              { id: "initial:1", kind: "initial", value: 1 },
              { id: "initial:2", kind: "initial", value: 2 },
              { id: "initial:3", kind: "initial", value: 3 },
            ],
            selectedIndustryId: "industry:任务中继站.png",
            selectedInitialIds: ["initial:1", "initial:2"],
            confirmed: false,
          },
          p2: {
            playerId: "p2",
            industryOptions: [
              { id: "industry:哨兵探测网络.png", kind: "industry", value: "哨兵探测网络.png" },
              { id: "industry:图灵系统.png", kind: "industry", value: "图灵系统.png" },
            ],
            initialOptions: [
              { id: "initial:4", kind: "initial", value: 4 },
              { id: "initial:5", kind: "initial", value: 5 },
              { id: "initial:6", kind: "initial", value: 6 },
            ],
            selectedIndustryId: null,
            selectedInitialIds: [],
            confirmed: false,
          },
        },
      },
    },
  };
  return root;
}

function confirmFirstPlayer(industryFileName) {
  const candidate = createRoot();
  candidate.match.initialSetup.offersByPlayerId.p1.selectedIndustryId =
    `industry:${industryFileName}`;
  const source = initialSetup.createSource();
  const result = source.execute(
    { state: candidate },
    { target: { kind: "confirm_initial_setup" } },
  );
  assert.equal(result.ok, true, result.message || JSON.stringify(result));
  return candidate;
}

// 任务中继站：首名玩家确认后立即在终局 c 板块 3 号位放置标记。
const mission = confirmFirstPlayer("任务中继站.png");
const tileC = mission.finalScoring.tiles.c;
assert.ok(tileC, "终局 c 板块必须存在");
const missionMarks = tileC.marks.filter((mark) => mark.playerId === "p1");
assert.equal(missionMarks.length, 1, "任务中继站玩家必须恰好在 c 板块放置 1 个标记");
assert.equal(missionMarks[0].slotIndex, 3, "任务中继站标记必须位于 c 板块 3 号位");
assert.equal(missionMarks[0].slot3Order, 1);
assert.equal(missionMarks[0].source, "direct");
assert.equal(mission.players.players[0].initialSelection.industry.id,
  "industry:任务中继站.png");

// 对照：非任务中继站公司确认后不得放置任何 c 板块标记。
const control = confirmFirstPlayer("深空探测.png");
assert.equal(control.finalScoring.tiles.c.marks.length, 0,
  "非任务中继站公司不得放置终局 c 板块标记");

console.log("initial-setup mission startup final mark passed");
