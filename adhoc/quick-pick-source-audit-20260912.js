"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const model = require("../randomizer/game/ai/outcome-model");
const trades = require("../randomizer/game/actions/quick-trades");
const catalog = require("../randomizer/game/industry/catalog");
const abilities = require("../randomizer/game/industry/abilities");
const gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = `reports/iteration/quick-pick-source-audit-20260912-${gitCommit.slice(0, 8)}.json`;
if (fs.existsSync(output)) {
  process.stdout.write(`已有checkpoint：${output}\n`);
  process.exit(0);
}
// 有限正式交易目录的费用支配证明：所有资源转换的费用均被某种直接取牌覆盖。
const picks = trades.TRADE_ACTIONS.filter(trade => trade.gain.handSize === 1);
const conversions = trades.TRADE_ACTIONS.filter(trade => Object.entries(trade.gain)
  .some(([key, amount]) => key !== "handSize" && amount > 0));
const dominance = conversions.map(trade => {
  const covering = picks.filter(pick => Object.entries(pick.cost)
    .every(([resource, amount]) => amount <= (trade.cost[resource] || 0)));
  assert(covering.length, `${trade.id}需重新审查是否必须先准备再取牌`);
  return { conversion: trade.id, directPicksWithNoGreaterCost: covering.map(pick => pick.id) };
});
const wanted = { id: "wanted-launch", cardId: "b_117.webp" };
const observation = model.createDecisionObservation({
  publicState: { roundNumber: 2, players: [{ playerId: "p1", score: 0, credits: 0,
    energy: 0, publicity: 2, mainActionCompleted: true, income: {}, dataProgress: {},
    techState: { ownedTiles: {} } }], board: { publicCards: [wanted],
    planets: { planets: {} }, techSupply: { stacks: {} }, aliens: { slots: [] } } },
  selfState: { playerId: "p1", hand: [{ id: "own", cardId: "b_117.webp" }], reservedCards: [] },
}, { seatId: "p1" });
const targetId = `card:acquire:${wanted.id}`;
const companySources = ["任务中继站", "芬威克研究中心", "深空探测", "未来跨度研究所", "宇宙战略集团"]
  .map(label => {
    const player = { resources: { publicity: 2 }, hand: [{ id: "own" }],
      industryFutureSpan: { card: { id: "parked" }, targetScore: 10 } };
    const flow = abilities.buildActiveAbilityFlow(player, label, 2, 1);
    assert.equal(flow.ok, true);
    const action = { family: "industry", phase: "quick", actorId: "p1",
      actionId: `company:${label}`, target: { companyId: label,
        abilityId: catalog.getIndustryDefinition(label).activeAbilityId }, payload: {} };
    const allowed = evaluator.allowsQuickActionTiming({ observation, action,
      legalActions: [action], routeTargetId: targetId, routePlanId: targetId });
    const roots = evaluator.enumerateSecondaryAgentRootTargets({ rootObservation: observation,
      focalSeatId: "p1", legalActions: [action] });
    assert.equal(allowed, false, "本诊断固定记录修复前缺口，修复后须改为正式行为验收");
    assert(!roots.some(root => root.targetId === targetId));
    return { label, abilityId: flow.abilityId, flowType: flow.flowType,
      publicityCost: flow.publicityCost || 0, allowed, acquisitionRootPresent: false };
  });
const record = { gitCommit, scope: "纯策略入口与正式能力构建原语核对；描述符为窄接口输入，未执行Production规则或AI搜索，不证明完整行动合法性与费用结算。",
  dominance, companySources };
fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
process.stdout.write(`${JSON.stringify(record, null, 2)}\ncheckpoint=${output}\n`);
