const assert = require("assert");
const exportLog = require("./action-log-export");

const context = {
  generatedAt: new Date("2026-06-24T01:02:03.000Z"),
  isGameEnded: true,
  gameEndReason: "final_round_all_passed",
  roundNumber: 4,
  turnNumber: 7,
  turnState: {
    passedPlayerIds: ["player-white", "player-blue"],
  },
  playerResults: [
    {
      playerId: "player-white",
      playerLabel: "白|色\n玩家",
      finalScore: 42,
      baseScore: 30,
      tileScore: 7,
      cardScore: 5,
      completedTaskCount: 3,
      techCount: 4,
    },
    {
      playerId: "player-blue",
      playerLabel: "蓝色玩家",
      finalScore: 42,
      baseScore: 32,
      tileScore: 4,
      cardScore: 6,
      completedTaskCount: 2,
      techCount: 3,
      passed: true,
    },
  ],
  entries: [
    {
      id: 1,
      title: "初始选择",
      playerId: "player-white",
      playerLabel: "白|色\n玩家",
      actionType: "initialSelection",
      actionLabel: "初始选择",
      recoverySnapshot: { hiddenDeck: ["secret"] },
      steps: [
        { source: "setup", text: "选择公司：星际|矿业" },
      ],
    },
    {
      id: 2,
      roundNumber: 1,
      turnNumber: 1,
      playerId: "player-white",
      playerLabel: "白|色\n玩家",
      actionType: "playCard",
      actionLabel: "打牌行动",
      steps: [
        {
          source: "main",
          text: "打出卡牌：轨道实验室",
          irreversibleReason: "公共牌补牌翻出新牌",
          playedCard: { label: "轨道实验室" },
        },
        { source: "quick", text: "快速行动：移动 R1" },
      ],
    },
    {
      id: 3,
      roundNumber: 4,
      turnNumber: 7,
      playerId: "player-blue",
      playerLabel: "蓝色玩家",
      actionType: "pass",
      actionLabel: "PASS",
      passed: true,
      steps: [],
    },
  ],
};

const markdown = exportLog.buildActionLogMarkdown(context);

assert.ok(markdown.includes("# SETI 行动日志"));
assert.ok(markdown.includes("## 游戏元信息"));
assert.ok(markdown.includes("## 终局分数"));
assert.ok(markdown.includes("## 路线摘要"));
assert.ok(markdown.includes("## 完整行动流水"));
assert.ok(markdown.includes("- 游戏状态：已结束"));
assert.ok(markdown.includes("- 结束原因：final_round_all_passed"));
assert.ok(markdown.includes("| 白\\|色<br>玩家 | 42 | 30 | 7 | 5 | 3 | 4 | 是 | 是 |"));
assert.ok(markdown.includes("| 蓝色玩家 | 42 | 32 | 4 | 6 | 2 | 3 | 是 | 是 |"));
assert.ok(markdown.includes("| 白\\|色<br>玩家 | 打牌行动 | 1 | 1 | 无 |"));
assert.ok(markdown.includes("| 蓝色玩家 | PASS | 1 | 0 | R4 |"));
assert.ok(markdown.includes("### #2 第1轮 第1回合 - 白|色 玩家 - 打牌行动"));
assert.ok(markdown.includes("- [main] 打出卡牌：轨道实验室；不可撤销：公共牌补牌翻出新牌；卡牌：轨道实验室"));
assert.ok(markdown.includes("- [quick] 快速行动：移动 R1"));
assert.ok(!markdown.includes("recoverySnapshot"));
assert.ok(!markdown.includes("hiddenDeck"));

const jiuzheScoreMarkdown = exportLog.buildActionLogMarkdown({
  isGameEnded: true,
  roundNumber: 4,
  turnNumber: 8,
  playerResults: [
    {
      playerId: "player-white",
      playerLabel: "白色玩家",
      finalScore: 52,
      baseScore: 40,
      tileScore: 0,
      cardScore: 0,
      jiuzheCardScore: 12,
      completedTaskCount: 5,
      techCount: 6,
      passed: true,
    },
  ],
  entries: [],
});

assert.ok(jiuzheScoreMarkdown.includes("| 玩家 | 总分 | 基础分 | 板块分 | 卡牌分 | 九折分 | 任务数 | 科技数 | PASS | 最高分 |"));
assert.ok(jiuzheScoreMarkdown.includes("| 白色玩家 | 52 | 40 | 0 | 0 | 12 | 5 | 6 | 是 | 是 |"));

const emptyMarkdown = exportLog.buildActionLogMarkdown({
  isGameEnded: false,
  roundNumber: 2,
  turnNumber: 3,
  entries: [],
  playerResults: [],
}, { generatedAt: new Date("2026-06-24T02:00:00.000Z") });

assert.ok(emptyMarkdown.includes("- 游戏状态：未结束"));
assert.ok(emptyMarkdown.includes("暂无终局分数。"));
assert.ok(emptyMarkdown.includes("暂无路线摘要。"));
assert.ok(emptyMarkdown.includes("暂无行动日志。"));

assert.equal(
  exportLog.markdownTableCell("a|b\nc"),
  "a\\|b<br>c",
);

assert.equal(
  exportLog.createActionLogMarkdownFilename(new Date(2026, 5, 24, 3, 4, 5)),
  "seti-action-log-20260624-030405.md",
);
assert.doesNotMatch(
  exportLog.createActionLogMarkdownFilename(new Date(2026, 5, 24, 3, 4, 5)),
  /[\\/:*?"<>|]/,
);

{
  const calls = [];
  let ended = false;
  const controller = exportLog.createActionLogExportController({
    createReadoutRoot: () => ({
      turnState: { roundNumber: 2, turnNumber: 3, gameEndReason: null, passedPlayerIds: [] },
      playerState: { currentPlayerId: "p1" },
    }),
    getDisplayedTurnNumber: () => 4,
    isGameEnded: () => ended,
    getEntries: () => [{ id: 1, playerId: "p1", actionLabel: "扫描", steps: [] }],
    getPlayerResults: () => [],
    download: (request) => { calls.push(["download", request]); return { ok: true }; },
    setStatus: (message) => calls.push(["status", message]),
    renderStateReadout: () => calls.push(["render"]),
  });
  const generatedAt = new Date(2026, 5, 24, 3, 4, 5);
  const rejected = controller.downloadActionLogMarkdown({ generatedAt });
  assert.equal(rejected.ok, false);
  assert.equal(calls[0][0], "status");
  ended = true;
  calls.length = 0;
  const saved = controller.downloadActionLogMarkdown({ generatedAt });
  assert.equal(saved.ok, true);
  assert.equal(saved.filename, "seti-action-log-20260624-030405.md");
  assert.equal(calls[0][0], "download");
  assert.equal(calls[0][1].mimeType, "text/markdown;charset=utf-8");
  assert.ok(controller.getActionLogMarkdown({ generatedAt }).includes("第 2 轮 / 第 4 回合"));
  assert.equal(exportLog.countOwnedTech({ techState: { ownedTiles: { a: [1, 2], b: 3 } } }), 3);
}

console.log("action-log-export tests passed");
