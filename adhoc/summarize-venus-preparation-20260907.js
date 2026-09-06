"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const source = "reports/iteration/venus-preparation-433-20260907-v2.json";
const output = "reports/iteration/venus-preparation-facts-20260907.json";
if (fs.existsSync(output)) console.log(`已有证据，跳过：${output}`);
else {
  const replay = JSON.parse(fs.readFileSync(source));
  const paths = replay.paths.filter(p => p.completed).map(p => {
    const player = p.state.players.players.find(player => player.id === "player-white");
    assert.ok(player);
    return { index: p.index, hand: player.hand.map(c=>c.id).sort(), income: player.income, resources: player.resources };
  });
  const groups = [...Map.groupBy(paths, ({index, ...facts}) => JSON.stringify(facts)).values()].map(g=>g.map(p=>p.index));
  const report = { source, scope: "仅比较已完成的受控路径，排除历史、元数据和手牌排序；保留资源、收入和真实手牌身份；不是完整历史搜索重放或支配证明",
    paths, groups, missingPathIndices: replay.paths.filter(p=>!p.completed).map(p=>p.index) };
  assert.equal(paths.length, 10); assert.equal(groups.length, 10);
  assert.deepEqual(report.missingPathIndices, [7]);
  report.passed = true;
  fs.writeFileSync(output, JSON.stringify(report,null,2)+"\n"); console.log(JSON.stringify({output,groups,missing:report.missingPathIndices}));
}
