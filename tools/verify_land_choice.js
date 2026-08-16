"use strict";
// 验证：主行动多目标登陆统一走 choose_target 决策（与打牌登陆同一选择框）。
// 用「为什么登陆不了木星」存档：R10 在木星、多目标 → land 枚举含 select action
// → 提交 select → spawn choose_target 决策 → 选目标 → 登陆执行 + 奖励。
const fs = require("node:fs");
const { createSeededRandom } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const SAVE_PATH = process.argv[2] || "seti-saves/seti-save-为什么登陆不了木星-v207.json";
const raw = fs.readFileSync(SAVE_PATH, "utf8");
const save = JSON.parse(raw);
if (save.schema !== "seti-browser-save-v2") throw new Error(`schema: ${save.schema}`);
const state = JSON.parse(save.committedState);
if (state?.meta?.rngState) state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
const envelope = {
  schemaVersion: "seti-rule-composition-save-v1",
  committedState: JSON.stringify(state),
  session: save.session ?? null,
};

const kernel = createSimulationRuleComposition({
  seed: "verify-land-choice",
  random: createSeededRandom("verify-land-choice"),
  activePlayerCount: Number(state?.turn?.activePlayerCount) || 4,
  trustedProjectionReader: true,
});
const restored = kernel.composition.lifecycle.restore(envelope);
if (restored?.ok !== true) {
  console.error("restore 失败:", JSON.stringify(restored).slice(0, 500));
  process.exit(1);
}

const actions = kernel.composition.inputPort.enumerateActions({});
const landActions = actions.filter((a) => a.family === "land");
console.log("=== land 枚举 ===");
for (const a of landActions) {
  console.log(`- actionId=${a.actionId} select=${a.target?.select === true} label=${a.label}`);
  if (a.disabledReason) console.log(`  disabled: ${a.disabledReason}`);
}
const selectAction = landActions.find((a) => a.target?.select === true);
if (!selectAction) {
  console.error("FAIL: 未找到 select 动作（多目标登陆应追加「选择登陆目标」）");
  process.exit(1);
}
console.log("\nPASS: land 枚举包含 select 动作");

const submit = kernel.composition.inputPort.submitAction({
  schemaVersion: selectAction.schemaVersion,
  family: "land",
  phase: selectAction.phase,
  actionId: selectAction.actionId,
  actorId: selectAction.actorId,
  stateVersion: selectAction.stateVersion,
  decisionVersion: selectAction.decisionVersion,
  target: { select: true },
  payload: {},
});
if (submit?.ok !== true) {
  console.error("FAIL: 提交 select 动作失败:", JSON.stringify(submit).slice(0, 600));
  process.exit(1);
}
console.log("PASS: select 动作提交成功");

const inspect = kernel.composition.inspect();
const decision = inspect?.session?.decision || null;
if (!decision) {
  console.error("FAIL: 未生成决策。inspect:", JSON.stringify(inspect).slice(0, 800));
  process.exit(1);
}
console.log(`\n决策: kind=${decision.kind} decisionKind=${decision.decisionKind || "?"} type=${decision.type}`);
const choices = decision.choices || [];
console.log(`决策选项数: ${choices.length}`);
for (const c of choices) {
  console.log(`- choiceId=${c.choiceId} label=${c.label} rocketId=${c.target?.rocketId} target=${JSON.stringify(c.target?.landTarget || c.target)}`);
}
if (choices.length < 2) {
  console.error(`FAIL: 决策应含多个登陆目标，实际 ${choices.length}`);
  process.exit(1);
}
console.log(`\nPASS: 决策含 ${choices.length} 个登陆目标（choose_target，与打牌登陆同一选择框）`);

// 选第一个目标提交（内核要求与 legal choice 全等，直接提交完整 choice 对象）
const pick = choices[0];
const res = kernel.composition.inputPort.submitDecision({
  decisionId: decision.decisionId,
  decisionVersion: decision.decisionVersion,
  ownerId: decision.ownerId,
  choice: JSON.parse(JSON.stringify(pick)),
});
if (res?.ok !== true) {
  console.error("FAIL: 提交登陆目标失败:", JSON.stringify(res).slice(0, 600));
  process.exit(1);
}
const finalInspect = kernel.composition.inspect();
const playerState = finalInspect?.session?.workingState
  ? null
  : kernel.composition.projection()?.state;
console.log("\nPASS: 登陆目标决策已结算");
const summary = playerState?.players?.[0] || {};
console.log("当前玩家 energy:", summary.resources?.energy, "| mainActionCompleted:", summary.mainActionCompleted);
console.log("\n=== 验证完成 ===");
