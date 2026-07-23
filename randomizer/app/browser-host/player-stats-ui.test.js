"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createPlayerStatsUi } = require("./player-stats-ui");

function createElement(tagName) {
  return {
    tagName,
    className: "",
    textContent: "",
    title: "",
    children: [],
    attributes: {},
    style: { setProperty() {} },
    classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
}

(() => {
  const player = Object.freeze({
    id: "p1",
    color: "blue",
    colorLabel: "蓝色",
    displayName: "玩家(电脑)",
    uiColor: "#00f",
    passed: true,
    score: 4,
    finalTotalScore: 8,
    handCount: 1,
    resourceStats: Object.freeze([
      { label: "信用点", value: 2, iconSrc: "credits.png" },
      { label: "能量", value: 3, iconSrc: "energy.png" },
      { label: "宣传", value: "1/5", iconSrc: "publicity.png" },
      { label: "可用数据", value: 2, iconSrc: "data.png" },
      { label: "额外公共扫描", value: 0, iconSrc: "scan.png" },
      { label: "当前数据放置进展", value: "1/2", iconSrc: "analyze.png" },
    ]),
    incomeStats: Object.freeze([
      {
        label: "收入信用点",
        value: "1+2",
        iconSrc: "credits.png",
        title: "收入信用点 1+2（总计 3）",
      },
    ]),
    fangzhouStats: Object.freeze([{ label: "🔒", value: "2/3" }]),
    runezuStats: Object.freeze([{ label: "星", value: 1, iconSrc: "star.png" }]),
  });
  const ui = createPlayerStatsUi({
    document: { createElement },
    resourceIconSrc: new Proxy({}, { get: (_, key) => `${String(key)}.png` }),
  });

  const name = ui.createPlayerNameStat(player, 4, 8);
  assert.equal(name.children[1].textContent, "玩家(电脑)");
  assert.equal(ui.buildPlayerResourceStatNodes(player, { includeHandSize: true }).length, 7);
  assert.equal(ui.buildPlayerIncomeStatNodes(player, { showBasePlusIncrease: true })[1].title, "收入信用点 1+2（总计 3）");
  assert.equal(ui.buildPlayerFangzhouStatNodes(player)[1].children[1].textContent, "2/3");
  assert.equal(ui.buildPlayerRunezuStatNodes(player)[0].attributes["aria-label"], "星 1");
  assert.equal(
    /\bgetReadoutRoot\b|\bgetRuleReadout\b|\bplayers\.|\bdata\.|\brunezu\./.test(
      fs.readFileSync(require.resolve("./player-stats-ui"), "utf8"),
    ),
    false,
  );

  console.log("player stats UI tests passed");
})();
