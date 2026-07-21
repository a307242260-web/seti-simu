"use strict";

const assert = require("node:assert/strict");
const { createAppConstants } = require("./constants");

const constants = createAppConstants({
  aliens: {},
  players: {},
  rocketActions: {},
  planetReferenceLayout: {},
  initialCards: {},
});

assert.deepEqual(constants.INDUSTRY_CARD_FILES, [
  "层云核心.png",
  "芬威克研究中心.png",
  "赫利昂联合体.png",
  "寰宇动力.png",
  "任务中继站.png",
  "哨兵探测网络.png",
  "深空探测.png",
  "图灵系统.png",
  "未来跨度研究所.png",
  "异星实验室.png",
  "宇宙战略集团.png",
]);
assert.equal(constants.INDUSTRY_CARD_FILES.includes("原教旨主义.png"), false);
assert.equal(constants.INDUSTRY_CARD_FILES.includes("星际海盗.png"), false);

console.log("app constants tests passed");
