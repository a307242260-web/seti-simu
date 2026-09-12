"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { REPO_ROOT, replaySaveEnriched, refreshActionLogReportMetadata, computeRegistry } = require("./robot-iteration-lib");
const savePath = "seti-saves/seti-save-research-quick-timing-20260912-60f8cca6-quick-24-v2.json";
const original = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, savePath), "utf8"));
assert(replaySaveEnriched(savePath) instanceof Map);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "seti-report-replay-test-"));
const fixture = path.join(temp, "invalid-save.json");
const relativeFixture = path.relative(REPO_ROOT, fixture);
try {
  fs.writeFileSync(fixture, JSON.stringify({ ...original, replaySteps: null }));
  assert.throws(() => replaySaveEnriched(relativeFixture), /REPORT_REPLAY_STEPS_MISSING/);
  fs.writeFileSync(fixture, JSON.stringify({ ...original, committedState: "invalid-json" }));
  assert.throws(() => replaySaveEnriched(relativeFixture), SyntaxError);
  for (const actor of ["player-white", "player-green"]) {
    const broken = structuredClone(original);
    const firstIndex = broken.replaySteps.findIndex((step) => step.actorPlayerId === actor);
    assert(firstIndex >= 0);
    const index = firstIndex + 1; // 已开始该席开局Decision，覆盖匹配不到选择的分支。
    broken.replaySteps = broken.replaySteps.slice(0, index + 1);
    broken.replaySteps[index].action = { family: "choose_card", actorId: actor,
      actionId: "choose_card:missing", target: { choiceId: "missing" }, summary: "missing" };
    fs.writeFileSync(fixture, JSON.stringify(broken));
    assert.throws(() => replaySaveEnriched(relativeFixture), /REPORT_REPLAY_CHOICE_MISSING/,
      `${actor}不能以部分结果或第一合法选项掩盖失败`);
  }
  const failedSubmission = structuredClone(original);
  assert.equal(failedSubmission.replaySteps[23].phase, "quick");
  failedSubmission.replaySteps[23].action.actorId = "player-green";
  fs.writeFileSync(fixture, JSON.stringify(failedSubmission));
  assert.throws(() => replaySaveEnriched(relativeFixture), /REPORT_REPLAY_SUBMISSION_FAILED/);
} finally {
  fs.rmSync(temp, { recursive: true });
}
const options = { versionId: "counted-card-move-20260909", versionName: "刷新标题",
  recordFile: "f14a863e.4bc44eb2.full.json", savePath: "保留历史存档路径", runKey: "fixture" };
const historical = fs.readFileSync(path.join(REPO_ROOT,
  "reports/iteration/counted-card-move-20260909/f14a863e.4bc44eb2.full.action-log.html"), "utf8");
const contentPanels = (html) => [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)]
  .map((match) => match[0]).filter((panel) => !panel.includes("<h2>搜索触限记录</h2>"));
const refreshed = refreshActionLogReportMetadata(historical, options);
assert.deepEqual(contentPanels(refreshed), contentPanels(historical), "所有历史得分与行动面板必须逐字保留");
assert(refreshed.includes('href="../../research/f14a863e.4bc44eb2.full.json"'));
assert(refreshed.includes("未记录，不等于零次"));
assert(refreshed.includes("研究 orange2，背面 bonus：1 能量"));
assert.equal(refreshActionLogReportMetadata(refreshed, options), refreshed, "刷新应幂等");
assert.throws(() => refreshActionLogReportMetadata(historical.replace('<div class="links">', '<div class="missing">'), options), /BOUNDARY_INVALID/);
assert.throws(() => refreshActionLogReportMetadata(historical + '<title>重复</title>', options), /BOUNDARY_INVALID/);
assert.throws(() => computeRegistry({ refreshReportMetadata: true, generateReports: true }), /REFRESH_MODE_CONFLICT/);
console.log("robot report replay failures and metadata preservation passed");
