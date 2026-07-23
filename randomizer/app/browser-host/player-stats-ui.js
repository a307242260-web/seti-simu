(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserPlayerStatsUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createPlayerStatsUi(context = {}) {
    const document = context.document;
    const resourceIconSrc = context.resourceIconSrc || {};
    if (!document?.createElement) {
      throw new TypeError("createPlayerStatsUi requires document");
    }

    function createStatText(label, value) {
      const item = document.createElement("span");
      item.className = "player-stat";
      const labelEl = document.createElement("span");
      labelEl.className = "player-stat-label";
      labelEl.textContent = label;
      const valueEl = document.createElement("span");
      valueEl.className = "player-stat-value";
      valueEl.textContent = value;
      item.append(labelEl, valueEl);
      return item;
    }

    function createStatIcon(label, value, iconSrc) {
      const item = document.createElement("span");
      const icon = document.createElement("img");
      const valueEl = document.createElement("span");
      item.className = "player-stat player-stat-with-icon";
      item.setAttribute("aria-label", `${label} ${value}`);
      icon.className = "player-stat-icon";
      icon.src = iconSrc || "";
      icon.alt = "";
      icon.width = 296;
      icon.height = 296;
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      valueEl.className = "player-stat-value";
      valueEl.textContent = value;
      item.append(icon, valueEl);
      return item;
    }

    function createStatIconMarker(label, iconSrc) {
      const item = document.createElement("span");
      const icon = document.createElement("img");
      item.className = "player-stat player-stat-icon-marker";
      item.setAttribute("aria-label", label);
      icon.className = "player-stat-icon player-stat-marker-icon";
      icon.src = iconSrc || "";
      icon.alt = "";
      icon.width = 296;
      icon.height = 296;
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      item.append(icon);
      return item;
    }

    function createInlineIconValue(label, value, iconSrc, className) {
      const item = document.createElement("span");
      const icon = document.createElement("img");
      const valueEl = document.createElement("span");
      item.className = className;
      item.setAttribute("aria-label", `${label} ${value}`);
      icon.className = "player-stat-icon";
      icon.src = iconSrc || "";
      icon.alt = "";
      icon.width = 296;
      icon.height = 296;
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      valueEl.className = "player-stat-value";
      valueEl.textContent = value;
      item.append(icon, valueEl);
      return item;
    }

    function createPlayerNameStat(player, score = player?.score, finalTotalScore = player?.finalTotalScore) {
      const item = document.createElement("span");
      const marker = document.createElement("span");
      const name = document.createElement("span");
      const scoreEl = createInlineIconValue("分数", score, resourceIconSrc.score, "player-stat-score");
      const finalScoreEl = createInlineIconValue(
        "终局总分",
        finalTotalScore,
        resourceIconSrc.finalScore,
        "player-stat-final-score",
      );
      item.className = "player-stat player-stat-current";
      item.style.setProperty("--player-color", player?.uiColor || "");
      marker.className = "player-color-marker";
      marker.setAttribute("aria-hidden", "true");
      name.className = "player-stat-value";
      name.classList.toggle("is-player-passed", Boolean(player?.passed));
      name.textContent = player?.displayName || "玩家";
      item.title = name.textContent;
      item.append(marker, name, scoreEl, finalScoreEl);
      return item;
    }

    function createStatSeparator() {
      const item = document.createElement("span");
      item.className = "player-stat-separator";
      item.setAttribute("aria-hidden", "true");
      item.textContent = "|";
      return item;
    }

    function createPlayerStatsRow(className, nodes) {
      const row = document.createElement("div");
      row.className = `player-stats-row ${className || ""}`.trim();
      row.append(...nodes);
      return row;
    }

    function mapIconStats(stats) {
      return (stats || []).map((stat) => {
        const item = createStatIcon(stat.label, stat.value, stat.iconSrc);
        if (stat.title) {
          item.title = stat.title;
          item.setAttribute("aria-label", stat.title);
        }
        return item;
      });
    }

    function buildPlayerResourceStatNodes(player, options = {}) {
      const nodes = mapIconStats(player?.resourceStats);
      if (options.includeHandSize) {
        nodes.push(createStatIcon("手牌", player?.handCount || 0, resourceIconSrc.card));
      }
      return nodes;
    }

    function buildPlayerIncomeStatNodes(player) {
      return [
        createStatIconMarker("收入", resourceIconSrc.income),
        ...mapIconStats(player?.incomeStats),
      ];
    }

    function buildPlayerRunezuStatNodes(player) {
      return mapIconStats(player?.runezuStats);
    }

    function buildPlayerFangzhouStatNodes(player) {
      if (!player?.fangzhouStats?.length) return [];
      const label = document.createElement("span");
      label.className = "player-stat player-stat-fangzhou-label";
      label.textContent = "方舟";
      return [
        label,
        ...player.fangzhouStats.map((stat) => createStatText(stat.label, stat.value)),
      ];
    }

    return Object.freeze({
      createPlayerNameStat,
      createStatSeparator,
      createStatIcon,
      createInlineIconValue,
      createPlayerStatsRow,
      buildPlayerResourceStatNodes,
      buildPlayerIncomeStatNodes,
      buildPlayerRunezuStatNodes,
      buildPlayerFangzhouStatNodes,
    });
  }

  return { createPlayerStatsUi };
});
