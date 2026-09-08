// 只用既有规则公式的显式公司基数接口重算，不修改生产，不重跑对局。
const fs = require('node:fs'), assert = require('node:assert/strict');
const scoring = require('../randomizer/game/end-game-scoring');
const initial = require('../randomizer/game/initial-cards');
const cardEffects = require('../randomizer/game/cards/effects');
const output = 'reports/iteration/company-income-scoring-evidence-20260908.json';
if (fs.existsSync(output)) { console.log('已有证据：' + output); process.exit(0); }
const resolver = p => initial.getIndustryEffect(p.initialSelection.industry).baseIncome;
const p = JSON.parse(fs.readFileSync('reports/iteration/step24-winning-plan-execution-20260908-v2.json')).variants[0].steps.at(-1).player;
const rootCase = { company: p.initialSelection.industry, income: p.income, catalogBase: resolver(p),
  currentResolvedBase: scoring.getPlayerCompanyBaseIncome(p),
  a2Current: scoring.getFormulaBaseValue('a2', p, {}),
  a2WithExplicitCatalogBase: scoring.getFormulaBaseValue('a2', p, { getPlayerCompanyBaseIncome: resolver }) };
assert.equal(rootCase.a2Current, 2); assert.equal(rootCase.a2WithExplicitCatalogBase, 0);
const records = [];
for (const file of ['7dfcf27e.aaaed8d0.full.json', '197640a3.f520347d.full.json']) {
  const r = JSON.parse(fs.readFileSync('reports/research/' + file));
  const state = JSON.parse(JSON.parse(fs.readFileSync(r.savePath)).committedState);
  const context = { ...state, players: state.players.players, cardEffects,
    getCardTypeCode: c => cardEffects.getRuntimeCardTypeCode(c, cardEffects.getCardModel(c)?.cardType) };
  const seats = state.players.players.map(p => ({ seat: p.id,
    original: scoring.computePlayerFinalScore(context, p),
    withExplicitCatalogBase: scoring.computePlayerFinalScore({ ...context, getPlayerCompanyBaseIncome: resolver }, p) }));
  for (const seat of seats) assert.equal(seat.original.totalScore, r.summary.scores[seat.seat]);
  records.push({ file, seats, originalMean: r.summary.avgScore,
    rescoredMean: seats.reduce((sum, s) => sum + s.withExplicitCatalogBase.totalScore, 0) / seats.length });
}
const report = { rootCase, records,
  scope: '反事实实验假设：仅通过已有显式resolver传入正式公司目录基数；同轨迹重计分，不是修复后AI成绩，不覆盖原记录。',
  finding: '默认计分resolver没有读取initialSelection.industry的正式目录，真实玩家没有冗余baseIncome字段，因此公司默认收入被计入a1/a2；影响待标记预估与正式终局。',
  rankingImplication: '第24步捕获的发射叶95.5含错误待标记22分，去除此项为73.5；捕获的放数据叶92未跨25分阈值、不含此项。仅比较两条已捕获叶，尚未运行修复后重新搜索。' };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, rootCase, means: records.map(r => ({ file: r.file, original: r.originalMean, rescored: r.rescoredMean })) }));
