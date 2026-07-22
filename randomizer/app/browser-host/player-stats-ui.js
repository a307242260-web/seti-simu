(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiBrowserPlayerStatsUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function requireFunction(context, name) {
    if (typeof context?.[name] !== "function") {
      throw new TypeError(`createPlayerStatsUi requires function: ${name}`);
    }
    return context[name];
  }

  function createPlayerStatsUi(context = {}) {
    const document = context.document;
    const players = context.players;
    const data = context.data;
    const aomomo = context.aomomo;
    const fangzhou = context.fangzhou;
    const runezu = context.runezu;
    const resourceIconSrc = context.resourceIconSrc || {};
    const getReadoutRoot = requireFunction(context, "getReadoutRoot");
    const getPlayerCompanyBaseIncome = requireFunction(context, "getPlayerCompanyBaseIncome");
    const isAiPlayer = requireFunction(context, "isAiPlayer");
    const isPlayerPassed = requireFunction(context, "isPlayerPassed");
    if (!document?.createElement || !players || !data) {
      throw new TypeError("createPlayerStatsUi requires document, players and data");
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
      icon.src = iconSrc;
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
      icon.src = iconSrc;
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
      icon.src = iconSrc;
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

    function getCurrentPlayerStatLabel(player) {
      const name = String(player?.name || "").trim();
      const colorLabel = String(player?.colorLabel || "").trim();
      const colorDefaultName = colorLabel ? `${colorLabel}玩家` : "";
      const strippedName = colorLabel && name.startsWith(colorLabel)
        ? name.slice(colorLabel.length).trim()
        : name;
      const base = name && name !== colorDefaultName ? strippedName || name : "玩家";
      return `${base}${isAiPlayer(player?.id) ? "(电脑)" : ""}`;
    }

    function createPlayerNameStat(player, score, finalTotalScore) {
      const color = players.getPlayerColorDefinition(player.color);
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
      item.style.setProperty("--player-color", color.uiColor);
      marker.className = "player-color-marker";
      marker.setAttribute("aria-hidden", "true");
      name.className = "player-stat-value";
      name.classList.toggle("is-player-passed", isPlayerPassed(player?.id));
      name.textContent = getCurrentPlayerStatLabel(player);
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

    function shouldShowAomomoFossils(player) {
      const readoutRoot = getReadoutRoot();
      return Boolean(aomomo && (readoutRoot.solarState.aomomoActive
        || readoutRoot.alienGameState.aomomo?.revealInitialized
        || Number(player?.resources?.aomomoFossils) > 0));
    }

    function shouldShowFangzhouUnlockStats() {
      return Boolean(fangzhou && getReadoutRoot().alienGameState.fangzhou?.revealInitialized);
    }

    function getPlayerFangzhouUnlockCount(player) {
      const count = Number(fangzhou?.getUnlockCount?.(getReadoutRoot().alienGameState, player)) || 0;
      return Math.min(3, Math.max(0, Math.round(count)));
    }

    function buildPlayerFangzhouStatNodes(player) {
      if (!shouldShowFangzhouUnlockStats()) return [];
      const label = document.createElement("span");
      label.className = "player-stat player-stat-fangzhou-label";
      label.textContent = "方舟";
      return [label, createStatText("🔒", `${getPlayerFangzhouUnlockCount(player)}/3`)];
    }

    function getPlayerDataPlacementProgress(player) {
      const placedCount = typeof data.listComputerPlacedTokens === "function"
        ? data.listComputerPlacedTokens(player).length
        : 0;
      const total = Object.keys(data.COMPUTER_DATA_SLOTS || {}).length || 6;
      return {
        placed: Math.min(total, Math.max(0, Math.round(Number(placedCount) || 0))),
        total,
      };
    }

    function buildPlayerResourceStatNodes(player, options = {}) {
      const resources = player.resources || players.DEFAULT_RESOURCES;
      const limits = players.RESOURCE_LIMITS;
      const dataPlacementProgress = getPlayerDataPlacementProgress(player);
      const nodes = [
        createStatIcon("信用点", resources.credits, resourceIconSrc.credits),
        createStatIcon("能量", resources.energy, resourceIconSrc.energy),
        createStatIcon("宣传", `${resources.publicity}/${limits.publicity}`, resourceIconSrc.publicity),
        createStatIcon("可用数据", resources.availableData, resourceIconSrc.data),
        createStatIcon("额外公共扫描", resources.additionalPublicScan || 0, resourceIconSrc.additionalPublicScan),
      ];
      if (shouldShowAomomoFossils(player)) {
        nodes.push(createStatIcon("奥陌陌化石", resources.aomomoFossils || 0, resourceIconSrc.aomomoFossil));
      }
      nodes.push(createStatIcon(
        "当前数据放置进展",
        `${dataPlacementProgress.placed}/${dataPlacementProgress.total}`,
        resourceIconSrc.analyzeData,
      ));
      if (options.includeHandSize) {
        const handCount = Array.isArray(player.hand) ? player.hand.length : (resources.handSize || 0);
        nodes.push(createStatIcon("手牌", handCount, resourceIconSrc.card));
      }
      return nodes;
    }

    function normalizeIncomeDisplayValue(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 0;
      return Math.max(0, Number.isInteger(number) ? number : Math.round(number * 100) / 100);
    }

    function getPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome) {
      const income = normalizedIncome || players.normalizeIncome(player?.income || null);
      const companyBaseIncome = normalizedCompanyBaseIncome || getPlayerCompanyBaseIncome(player);
      const total = normalizeIncomeDisplayValue(income?.[incomeKey]);
      const configuredBase = normalizeIncomeDisplayValue(companyBaseIncome?.[incomeKey]);
      const base = Math.min(total, configuredBase);
      return { total, base, increase: Math.max(0, normalizeIncomeDisplayValue(total - base)) };
    }

    function formatPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome) {
      const breakdown = getPlayerIncomeBreakdown(player, incomeKey, normalizedIncome, normalizedCompanyBaseIncome);
      return `${breakdown.total}(${breakdown.base}+${breakdown.increase})`;
    }

    function createIncomeStatIcon(label, player, incomeKey, iconSrc, income, companyBaseIncome, options = {}) {
      const breakdown = getPlayerIncomeBreakdown(player, incomeKey, income, companyBaseIncome);
      const value = options.showBasePlusIncrease
        ? `${breakdown.base}+${breakdown.increase}`
        : breakdown.total;
      const item = createStatIcon(label, value, iconSrc);
      const detail = options.showBasePlusIncrease
        ? `${label} ${breakdown.base}+${breakdown.increase}（总计 ${breakdown.total}）`
        : `${label} ${breakdown.total}`;
      item.setAttribute("aria-label", detail);
      item.title = detail;
      return item;
    }

    function buildPlayerIncomeStatNodes(player, options = {}) {
      const income = players.normalizeIncome(player?.income || null);
      const companyBaseIncome = getPlayerCompanyBaseIncome(player);
      return [
        createStatIconMarker("收入", resourceIconSrc.income),
        createIncomeStatIcon("收入信用点", player, "credits", resourceIconSrc.credits, income, companyBaseIncome, options),
        createIncomeStatIcon("收入能量", player, "energy", resourceIconSrc.energy, income, companyBaseIncome, options),
        createIncomeStatIcon("收入手牌", player, "handSize", resourceIconSrc.incomeCard, income, companyBaseIncome, options),
        createStatIcon("收入宣传", income.publicity || 0, resourceIconSrc.publicity),
        createStatIcon("收入数据", income.availableData || 0, resourceIconSrc.data),
        createStatIcon("收入额外公共扫描", income.additionalPublicScan || 0, resourceIconSrc.additionalPublicScan),
      ];
    }

    function buildPlayerRunezuStatNodes(player) {
      if (!runezu || !getReadoutRoot().alienGameState.runezu?.revealInitialized) return [];
      const counts = runezu.getPlayerSymbolCounts(player);
      return (runezu.SYMBOL_IDS || [])
        .filter((symbolId) => (counts[symbolId] || 0) > 0)
        .map((symbolId) => createStatIcon(
          runezu.formatSymbolLabel(symbolId),
          counts[symbolId],
          runezu.getSymbolSrc(symbolId),
        ));
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
      formatPlayerIncomeBreakdown,
    });
  }

  return { createPlayerStatsUi };
});
