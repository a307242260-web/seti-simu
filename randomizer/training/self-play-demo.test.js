"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createBaselineAgent,
  ingestDemoLog,
  normalizeDemoLogs,
  runSelfPlay,
} = require("./self-play");

const demoDir = fs.mkdtempSync(path.join(os.tmpdir(), "seti-demo-test-"));
const demoPath = path.join(demoDir, "human.jsonl");

const jsonl = [
  JSON.stringify({
    schemaVersion: "seti-self-play-log-v1",
    type: "step",
    mode: "human-demo",
    episodeIndex: 0,
    stepIndex: 0,
    seed: "human-test",
    actorPlayerId: "p1",
    action: { family: "launch", actionId: "l1" },
    reward: { immediateScoreDelta: 2, terminalScoreDelta: 0, resourceDelta: {} },
    legalMask: [],
    terminal: false,
    ok: true,
    actorKind: "human",
  }),
  JSON.stringify({
    schemaVersion: "seti-self-play-log-v1",
    type: "step",
    mode: "human-demo",
    episodeIndex: 0,
    stepIndex: 1,
    seed: "human-test",
    actorPlayerId: "p1",
    action: { family: "scan", actionId: "s1" },
    reward: { immediateScoreDelta: 1, terminalScoreDelta: 1, resourceDelta: {} },
    legalMask: [],
    terminal: false,
    ok: true,
    actorKind: "human",
  }),
  JSON.stringify({
    schemaVersion: "seti-self-play-log-v1",
    type: "step",
    mode: "human-demo",
    episodeIndex: 0,
    stepIndex: 2,
    seed: "human-test",
    actorPlayerId: "p1",
    action: { family: "pass", actionId: "p1-pass" },
    reward: { immediateScoreDelta: 0, terminalScoreDelta: 3, resourceDelta: {} },
    legalMask: [],
    terminal: false,
    ok: true,
    actorKind: "human",
  }),
  JSON.stringify({
    schemaVersion: "seti-self-play-log-v1",
    type: "step",
    mode: "human-demo",
    episodeIndex: 0,
    stepIndex: 3,
    seed: "human-test",
    actorPlayerId: "p2",
    action: { family: "move", actionId: "m1" },
    reward: { immediateScoreDelta: 0, terminalScoreDelta: 0, resourceDelta: {} },
    legalMask: [],
    terminal: false,
    ok: true,
    actorKind: "machine",
  }),
  JSON.stringify({
    schemaVersion: "seti-self-play-log-v1",
    type: "step",
    mode: "human-demo",
    episodeIndex: 0,
    stepIndex: 4,
    seed: "human-test",
    actorPlayerId: "p1",
    action: { family: "end_turn", actionId: "e1" },
    reward: { immediateScoreDelta: 0, terminalScoreDelta: 0, resourceDelta: {} },
    legalMask: [],
    terminal: true,
    ok: true,
    actorKind: "human",
  }),
  JSON.stringify({
    schemaVersion: "seti-self-play-log-v1",
    type: "episode_summary",
    mode: "human-demo",
    episodeIndex: 0,
    seed: "human-test",
    steps: 5,
    terminal: true,
    blocked: false,
    illegalActionAttempts: 0,
    totalActionAttempts: 5,
    players: [
      { playerId: "p1", score: 15, finalScore: 15 },
      { playerId: "p2", score: 11, finalScore: 11 },
    ],
  }),
].join("\n");
fs.writeFileSync(demoPath, jsonl, "utf8");

try {
  // 默认只取人类席位步骤：launch/scan/pass/end_turn 共 4 步，机器 move 被跳过
  const agent = createBaselineAgent({ learningRate: 0.15 });
  const ingested = ingestDemoLog(agent, demoPath);
  assert.equal(ingested, 4, "默认只导入人类席位步骤");
  assert.ok(Math.abs(agent.actionValues.launch - 0.15 * (2 + 15)) < 1e-9, "launch target = reward + 终局分");
  assert.ok(Math.abs(agent.actionValues.scan - 0.15 * (2 + 15)) < 1e-9, "scan 立即+终局分合并");
  assert.ok(Math.abs(agent.actionValues.pass - (0.25 + 0.15 * (3 + 15 - 0.25))) < 1e-9, "pass 在基线值上更新");
  assert.ok(Math.abs(agent.actionValues.end_turn - 0.15 * (0 + 15)) < 1e-9, "end_turn 按注册 family 键更新（基线 end-turn 键不匹配不生效）");
  assert.equal(agent.actionValues.move, undefined, "机器席位步骤默认不导入");
  assert.equal(agent.actionVisits.launch, 1, "访问计数随示范步骤增加");
  assert.equal(agent.episodesTrained, 0, "示范导入不冒充 episode 训练数");

  // 显式包含机器席位
  const agentAll = createBaselineAgent({ learningRate: 0.15 });
  const ingestedAll = ingestDemoLog(agentAll, demoPath, { humanOnly: false });
  assert.equal(ingestedAll, 5, "humanOnly:false 导入全部步骤");
  assert.ok(Math.abs(agentAll.actionValues.move - 0.15 * (0 + 11)) < 1e-9, "机器步骤按机器终局分更新");

  // runSelfPlay 装配：demo 先于 episode 应用；episodes=0 不跑模拟局
  const result = runSelfPlay({ demoLogs: [demoPath], episodes: 0, learningRate: 0.15 });
  assert.equal(result.demoStepsIngested, 4);
  assert.equal(result.stats.completedEpisodes, 0);
  assert.ok(Math.abs(result.agent.actionValues.scan - 0.15 * 17) < 1e-9, "runSelfPlay 应用 demo 到 agent");

  // 指纹稳定：同一文件内容两次 normalize 得到相同 fingerprint，可去重
  const [first] = normalizeDemoLogs(demoPath);
  const [second] = normalizeDemoLogs(demoPath);
  assert.equal(first.fingerprint, second.fingerprint, "demo 指纹必须稳定");
  assert.equal(first.path, path.resolve(demoPath), "demo 路径必须解析为绝对路径");

  console.log("self-play demo ingestion tests passed");
} finally {
  fs.rmSync(demoDir, { recursive: true, force: true });
}
