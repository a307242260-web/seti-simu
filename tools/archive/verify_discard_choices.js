"use strict";
// 验证：2张牌→1信用点 弃牌决策 = 单张手牌列表（卡面）+ 确认弃牌。
// 交互：select 一张 → 再 select 一张 → confirm → 弃 2 张 +1 信用点。
const fs = require("node:fs");
const { createSeededRandom } = require("../randomizer/game/random");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");

const SAVE_PATH = process.argv[2] || "seti-saves/seti-save-为什么登陆不了木星-v207.json";
const raw = fs.readFileSync(SAVE_PATH, "utf8");
const save = JSON.parse(raw);
const state = JSON.parse(save.committedState);
if (state?.meta?.rngState) state.meta.rngState.algorithm = "seti-simulation-mulberry32-v1";
const kernel = createSimulationRuleComposition({
  seed: "verify-discard2",
  random: createSeededRandom("verify-discard2"),
  activePlayerCount: Number(state?.turn?.activePlayerCount) || 4,
  trustedProjectionReader: true,
});
kernel.composition.lifecycle.restore({
  schemaVersion: "seti-rule-composition-save-v1",
  committedState: JSON.stringify(state),
  session: save.session ?? null,
});

const actions = kernel.composition.inputPort.enumerateActions({});
const trade = actions.find((a) => a.family === "quick_trade" && a.target?.tradeId === "cards-for-credit");
if (!trade) { console.error("FAIL: cards-for-credit 不可用"); process.exit(1); }
const submit = kernel.composition.inputPort.submitQuickAction({
  schemaVersion: trade.schemaVersion, family: "quick_trade", phase: trade.phase,
  actionId: trade.actionId, actorId: trade.actorId, stateVersion: trade.stateVersion,
  decisionVersion: trade.decisionVersion, target: { tradeId: "cards-for-credit" },
  payload: JSON.parse(JSON.stringify(trade.payload)),
});
if (submit?.ok !== true) { console.error("FAIL: 提交:", JSON.stringify(submit).slice(0, 300)); process.exit(1); }

function getDecision() {
  const insp = kernel.composition.inspect();
  return insp?.session?.decision || null;
}
function submitChoice(choice) {
  const d = getDecision();
  return kernel.composition.inputPort.submitDecision({
    decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId,
    choice: JSON.parse(JSON.stringify(choice)),
  });
}
function show(label) {
  const d = getDecision();
  const player = kernel.composition.projection()?.state?.players?.players?.[0]
    || (() => { const s = kernel.composition.lifecycle.save().envelope.committedState; return JSON.parse(s).players.players[0]; })();
  console.log(`--- ${label} ---`);
  console.log("手牌:", (player?.hand || []).map((c) => c.id).join(", "));
  if (!d) { console.log("(无决策)"); return null; }
  console.log("kind:", d.decisionKind, "choices:", (d.choices || []).length);
  for (const c of d.choices || []) {
    const sel = c.presentation?.selected;
    const target = c.target?.kind;
    console.log(`- [${target}]${sel ? "★选中" : ""} ${c.summary || c.label}${c.disabledReason ? " (disabled: " + c.disabledReason + ")" : ""}`);
  }
  return d;
}

const d1 = show("初始弃牌决策");
const cardChoice = (d1.choices || []).find((c) => c.target?.kind === "discard-hand-card");
const confirmChoice = (d1.choices || []).find((c) => c.target?.kind === "confirm");
if (!cardChoice) { console.error("FAIL: 没有手牌选择项"); process.exit(1); }
if (!confirmChoice?.disabledReason) { console.error("FAIL: 未选满时确认应禁用"); process.exit(1); }
if (!cardChoice.presentation?.cardKind) { console.error("FAIL: 手牌选项应带卡面 presentation"); process.exit(1); }
console.log("PASS: 单张手牌列表 + 卡面 + 确认禁用");

const sel1 = (d1.choices || []).find((c) => c.target?.kind === "discard-hand-card" && !c.disabledReason);
const r1 = submitChoice(sel1);
if (r1?.ok !== true) { console.error("FAIL: 选第1张:", JSON.stringify(r1).slice(0, 300)); process.exit(1); }
const d2 = show("选第1张后");
const confirm2 = (d2.choices || []).find((c) => c.target?.kind === "confirm");
if (!confirm2?.disabledReason) { console.error("FAIL: 选1张后确认仍应禁用（还差1张）"); process.exit(1); }
const sel2 = (d2.choices || []).find((c) => c.target?.kind === "discard-hand-card" && String(c.target.cardInstanceId) !== String(sel1.target.cardInstanceId));
const r2 = submitChoice(sel2);
if (r2?.ok !== true) { console.error("FAIL: 选第2张:", JSON.stringify(r2).slice(0, 300)); process.exit(1); }
const d3 = show("选第2张后");
const confirm3 = (d3.choices || []).find((c) => c.target?.kind === "confirm");
if (confirm3?.disabledReason) { console.error("FAIL: 选满2张后确认应可用"); process.exit(1); }
console.log("PASS: 选满 2 张后确认可用");

const r3 = submitChoice(confirm3);
if (r3?.ok !== true) { console.error("FAIL: 确认弃牌:", JSON.stringify(r3).slice(0, 400)); process.exit(1); }
const after = kernel.composition.inspect();
console.log("--- 结算后 ---");
console.log("phase:", after?.phase, "| session:", after?.session?.phase || null);
const finalSave = JSON.parse(kernel.composition.lifecycle.save().envelope.committedState);
const fp = finalSave.players.players[0];
console.log("手牌:", fp.hand.map((c) => c.id).join(", "), "| credits:", fp.resources.credits, "| energy:", fp.resources.energy);
console.log("\n=== 验证完成 ===");
