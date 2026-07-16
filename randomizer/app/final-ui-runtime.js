(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppFinalUiRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  function createFinalUiRuntime(context = {}) {
    const document = context.document || root.document;
    const {
      els,
      players,
      finalScoring,
      finalScoringState,
      endGameScoring,
      alienGameState,
      playerState,
      turnState,
      uiRuntimeState,
      FINAL_SCORE_SLOT_POINTS,
      FINAL_ROUND_NUMBER,
      SCORE_SOURCE_KEYS,
      getCurrentPlayer,
      getActivePlayers,
      getDisplayedTurnNumber,
      getNormalTokenAssetForPlayer,
      getHistoryForSource,
      createActionLogImpactSnapshot,
      appendActionLogStep,
      actionLogOptionsFromHistoryStep,
      rememberHistoryStep,
      historyCommands,
      queueStateReadoutRender,
      computePlayerFinalScoreBreakdown,
      getPlayerScoreSource,
      getCurrentPlayerLabel,
      updateActionButtons,
      renderPlayerStats,
      isGameEnded,
      countPlayerOwnedTech,
    } = context;

    const HISTORY_SOURCE_QUICK = context.HISTORY_SOURCE_QUICK || "quick";
    const SCORE_SOURCE_KEY_SET = new Set(Object.values(SCORE_SOURCE_KEYS || {}));
    const FINAL_RESULT_PLAYER_COLOR_ORDER = Object.freeze(["white", "brown", "blue", "green"]);

    function normalizeScoreSourceAmount(value) {
      const numeric = Number(value) || 0;
      return Math.round(numeric * 100) / 100;
    }

    function syncFinalScorePendingMarks() {
      const result = finalScoring.syncPendingMarks(finalScoringState, playerState.players);
      const currentPlayer = getCurrentPlayer();
      const currentAdded = (result.added || []).filter((pending) => pending.playerId === currentPlayer?.id);
      if (currentAdded.length) {
        const thresholds = currentAdded.map((pending) => `${pending.threshold}分`).join("、");
        const label = getCurrentPlayerLabel?.() || currentPlayer?.colorLabel || "";
        context.rocketState.statusNote = `${label}玩家达到 ${thresholds}，请选择终局计分板块标记`;
      }
      return result;
    }

    function getFinalScoreTokenPoint(mark) {
      const slotIndex = Number(mark?.slotIndex) || 3;
      const slot = FINAL_SCORE_SLOT_POINTS[slotIndex] || FINAL_SCORE_SLOT_POINTS[3];
      if (slotIndex !== 3) return slot;

      const order = Math.max(1, Number(mark?.slot3Order) || 1) - 1;
      const columns = Math.max(1, Number(slot.columns) || 1);
      return {
        x: slot.x + (order % columns) * slot.stepX,
        y: slot.y + Math.floor(order / columns) * slot.stepY,
      };
    }

    function createFinalScoreTokenElement(mark) {
      const image = document.createElement("img");
      const point = getFinalScoreTokenPoint(mark);
      image.className = "final-score-token";
      image.dataset.finalSlot = String(mark.slotIndex);
      image.dataset.playerColor = mark.playerColor || "";
      image.src = mark.tokenSrc || "../assets/tokens/normal_token.png";
      image.alt = "";
      image.width = 296;
      image.height = 296;
      image.decoding = "async";
      image.setAttribute("aria-hidden", "true");
      image.style.setProperty("--final-token-x", `${point.x}%`);
      image.style.setProperty("--final-token-y", `${point.y}%`);
      return image;
    }

    function renderFinalScoreBoard() {
      const currentPlayer = getCurrentPlayer();
      const pending = finalScoring.getNextPendingMarkForPlayer(finalScoringState, currentPlayer?.id);

      els.finalScoreTileWraps.forEach((wrap) => {
        const tileId = wrap.dataset.finalId;
        const tile = finalScoringState.tiles?.[tileId];
        const layer = wrap.querySelector(".final-score-token-layer");
        const canMark = pending
          ? finalScoring.canMarkTile(finalScoringState, tileId, currentPlayer)
          : { ok: false };

        wrap.disabled = !canMark.ok;
        wrap.classList.toggle("is-selectable", canMark.ok);
        wrap.title = canMark.ok
          ? `${currentPlayer.colorLabel}玩家标记 ${pending.threshold} 分门槛`
          : "";

        if (layer) {
          layer.replaceChildren(...(tile?.marks || []).map(createFinalScoreTokenElement));
        }
      });
    }

    function recordFinalScoreMarkActionLog(result, player, beforeFinalScoringState) {
      if (!result?.ok) return null;

      const history = getHistoryForSource(HISTORY_SOURCE_QUICK);
      const label = "标记终局";
      let step = null;

      if (!history.hasSession()) {
        history.beginSession("quick", "快速行动");
      }
      history.beginStep({
        source: HISTORY_SOURCE_QUICK,
        type: "final_score_mark",
        label,
        effectIndex: null,
        logBefore: createActionLogImpactSnapshot(player),
      });
      if (beforeFinalScoringState) {
        history.record(historyCommands.createRestoreObjectCommand(
          finalScoringState,
          beforeFinalScoringState,
          "恢复终局标记前状态",
        ));
      }
      step = history.endStep();
      if (step) {
        rememberHistoryStep(HISTORY_SOURCE_QUICK, step.id);
        appendActionLogStep(HISTORY_SOURCE_QUICK, step.label, result.message, actionLogOptionsFromHistoryStep(step));
      }
      return step;
    }

    function handleFinalScoreTileClick(tileId) {
      const currentPlayer = getCurrentPlayer();
      syncFinalScorePendingMarks();
      const beforeFinalScoringState = root.structuredClone(finalScoringState);

      const result = finalScoring.markTile(finalScoringState, tileId, currentPlayer, {
        tokenSrc: getNormalTokenAssetForPlayer(currentPlayer),
      });

      context.rocketState.statusNote = result.message;
      if (result.ok) recordFinalScoreMarkActionLog(result, currentPlayer, beforeFinalScoringState);
      renderFinalScoreBoard();
      renderPlayerStats();
      updateActionButtons();
      queueStateReadoutRender();
      return result;
    }

    function formatFinalResultScore(value) {
      const number = Number(value) || 0;
      return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100);
    }

    function hasJiuzheFinalResultRow(summaries) {
      return Boolean(alienGameState.jiuzhe?.revealInitialized)
        || summaries.some((summary) => (
          Number(summary.breakdown.jiuzheCardScore || 0) !== 0
          || Number(summary.breakdown.jiuzhePenaltyScore || 0) !== 0
          || Number(summary.breakdown.jiuzheThreat || 0) !== 0
        ));
    }

    function hasRunezuFinalResultRow(summaries) {
      return Boolean(alienGameState.runezu?.revealInitialized)
        || summaries.some((summary) => Number(summary.breakdown.runezuSymbolScore || 0) !== 0);
    }

    function getFinalResultPlayers() {
      const activeOrder = new Map((turnState.activePlayerIds || []).map((playerId, index) => [playerId, index]));
      const colorOrder = new Map(FINAL_RESULT_PLAYER_COLOR_ORDER.map((color, index) => [color, index]));
      return getActivePlayers().sort((left, right) => {
        const colorDelta = (colorOrder.get(left.color) ?? 99) - (colorOrder.get(right.color) ?? 99);
        if (colorDelta) return colorDelta;
        return (activeOrder.get(left.id) ?? 999) - (activeOrder.get(right.id) ?? 999);
      });
    }

    function buildFinalResultPlayerSummaries() {
      return getFinalResultPlayers().map((player) => ({
        player,
        breakdown: computePlayerFinalScoreBreakdown(player),
        scoreSources: Object.fromEntries(
          Object.values(SCORE_SOURCE_KEYS).map((key) => [key, getPlayerScoreSource(player, key)]),
        ),
      }));
    }

    function getTrackedBaseScoreTotal(summary) {
      return Object.values(summary.scoreSources || {}).reduce((total, value) => (
        total + normalizeScoreSourceAmount(value)
      ), 0);
    }

    function getUntrackedBaseScore(summary) {
      return normalizeScoreSourceAmount(
        (Number(summary.breakdown?.baseScore) || 0) - getTrackedBaseScoreTotal(summary),
      );
    }

    function getFinalResultScoreItems(summaries) {
      const items = [
        { key: "totalScore", label: "总分" },
        { key: "baseScore", label: "裸分" },
        { key: "untrackedBaseScore", label: "未拆分裸分" },
        { key: "finalA", label: "final_a" },
        { key: "finalB", label: "final_b" },
        { key: "finalC", label: "final_c" },
        { key: "finalD", label: "final_d" },
        { key: "cardScore", label: "终局计分牌" },
        { key: SCORE_SOURCE_KEYS.INITIAL, label: "开局分数" },
        { key: SCORE_SOURCE_KEYS.SCAN, label: "扫描数据槽分数" },
        { key: SCORE_SOURCE_KEYS.TECH_BONUS, label: "科技 bonus" },
        { key: SCORE_SOURCE_KEYS.BLUE_TECH, label: "蓝色科技分数" },
        { key: SCORE_SOURCE_KEYS.CARD_QUICK, label: "卡牌快速行动分数" },
        { key: SCORE_SOURCE_KEYS.CARD_EFFECT, label: "卡牌即时分数" },
        { key: SCORE_SOURCE_KEYS.TASK_CARD, label: "任务牌获得分数" },
        { key: SCORE_SOURCE_KEYS.ORBIT, label: "环绕分数" },
        { key: SCORE_SOURCE_KEYS.LAND, label: "登陆分数" },
        { key: SCORE_SOURCE_KEYS.ALIEN_TRACE_PINK, label: "粉色外星人痕迹分数" },
        { key: SCORE_SOURCE_KEYS.ALIEN_TRACE_YELLOW, label: "黄色外星人痕迹分数" },
        { key: SCORE_SOURCE_KEYS.ALIEN_TRACE_BLUE, label: "蓝色外星人痕迹分数" },
        { key: SCORE_SOURCE_KEYS.ALIEN_CARD_QUICK, label: "外星人快速行动分数" },
        { key: SCORE_SOURCE_KEYS.ALIEN_EFFECT, label: "外星机制分数" },
        { key: SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, label: "公司能力分数" },
      ];
      if (hasJiuzheFinalResultRow(summaries)) {
        items.push(
          { key: "jiuzheCardScore", label: "九折卡牌分数" },
          { key: "jiuzhePenaltyScore", label: "九折损失分数" },
        );
      }
      if (hasRunezuFinalResultRow(summaries)) {
        items.push({ key: "runezuSymbolScore", label: "符文族 symbol 分数" });
      }
      return items;
    }

    function getFinalResultScoreValue(summary, key) {
      const breakdown = summary.breakdown || {};
      const tileScores = breakdown.tileScoresById || {};
      if (SCORE_SOURCE_KEY_SET.has(key)) {
        return summary.scoreSources?.[key] || 0;
      }
      switch (key) {
        case "totalScore":
          return breakdown.totalScore;
        case "baseScore":
          return breakdown.baseScore;
        case "untrackedBaseScore":
          return getUntrackedBaseScore(summary);
        case "finalA":
          return tileScores.a || 0;
        case "finalB":
          return tileScores.b || 0;
        case "finalC":
          return tileScores.c || 0;
        case "finalD":
          return tileScores.d || 0;
        case "cardScore":
          return breakdown.cardScore;
        case "jiuzheCardScore":
          return breakdown.jiuzheCardScore;
        case "jiuzhePenaltyScore":
          return breakdown.jiuzhePenaltyScore;
        case "runezuSymbolScore":
          return breakdown.runezuSymbolScore;
        default:
          return 0;
      }
    }

    function createFinalResultPlayerHeaderCell(summary) {
      const cell = document.createElement("th");
      const wrap = document.createElement("span");
      const marker = document.createElement("span");
      const name = document.createElement("span");
      const color = players.getPlayerColorDefinition(summary.player.color);

      cell.className = "final-result-player-cell";
      cell.scope = "col";
      wrap.className = "final-result-player";
      marker.className = "final-result-player-marker";
      marker.style.setProperty("--player-color", color.uiColor);
      marker.setAttribute("aria-hidden", "true");
      name.textContent = color.label;
      wrap.append(marker, name);
      cell.append(wrap);
      return cell;
    }

    function createFinalResultScoreLabelCell(item) {
      const cell = document.createElement("th");
      cell.scope = "row";
      cell.className = "final-result-score-label-cell";
      cell.textContent = item.label;
      return cell;
    }

    function createFinalResultScoreCell(summary, item, maxScore) {
      const cell = document.createElement("td");
      const value = getFinalResultScoreValue(summary, item.key);
      cell.className = "final-result-number-cell";
      cell.textContent = formatFinalResultScore(value);
      if (item.key === "totalScore" && (Number(value) || 0) === maxScore) {
        cell.classList.add("is-winner-score");
        cell.title = "最高分";
      }
      if (Number(value) < 0) {
        cell.classList.add("is-negative");
      }
      return cell;
    }

    function renderFinalResultDialog() {
      if (!els.finalResultHead || !els.finalResultBody) return;
      const summaries = buildFinalResultPlayerSummaries();
      const items = getFinalResultScoreItems(summaries);
      const maxScore = summaries.reduce((max, summary) => Math.max(max, Number(summary.breakdown.totalScore) || 0), -Infinity);
      const headerRow = document.createElement("tr");

      const firstHeader = document.createElement("th");
      firstHeader.scope = "col";
      firstHeader.textContent = "得分项目";
      firstHeader.className = "final-result-score-label-cell";
      headerRow.append(firstHeader, ...summaries.map(createFinalResultPlayerHeaderCell));

      const bodyRows = items.map((item) => {
        const tr = document.createElement("tr");
        if (item.key === "totalScore") tr.classList.add("is-total-row");
        tr.append(createFinalResultScoreLabelCell(item));
        tr.append(...summaries.map((summary) => createFinalResultScoreCell(summary, item, maxScore)));
        return tr;
      });

      els.finalResultHead.replaceChildren(headerRow);
      els.finalResultBody.replaceChildren(...bodyRows);
      if (els.finalResultSubtitle) {
        const winnerCount = summaries.filter((summary) => (Number(summary.breakdown.totalScore) || 0) === maxScore).length;
        const phaseLabel = isGameEnded()
          ? `第 ${turnState.roundNumber} 轮结束`
          : `第 ${turnState.roundNumber} 轮第 ${getDisplayedTurnNumber()} 回合`;
        els.finalResultSubtitle.textContent = summaries.length
          ? `${phaseLabel} · ${summaries.length} 名玩家 · ${winnerCount > 1 ? "并列最高分" : "最高分"} ${formatFinalResultScore(maxScore)}`
          : "暂无玩家分数";
      }
    }

    function syncFinalResultButton() {
      if (els.finalResultButton) {
        els.finalResultButton.hidden = false;
        els.finalResultButton.disabled = false;
        els.finalResultButton.setAttribute("aria-expanded", String(!els.finalResultOverlay?.hidden));
        els.finalResultButton.setAttribute("aria-disabled", "false");
      }
      if (!isGameEnded()) {
        uiRuntimeState.finalResultAutoOpened = false;
      }
      if (els.finalResultOverlay && !els.finalResultOverlay.hidden) {
        renderFinalResultDialog();
      }
    }

    function openFinalResultDialog(options = {}) {
      if (!els.finalResultOverlay) return { ok: false, message: "统计窗口不可用" };
      renderFinalResultDialog();
      els.finalResultOverlay.hidden = false;
      els.finalResultOverlay.setAttribute("aria-hidden", "false");
      els.finalResultButton?.setAttribute("aria-expanded", "true");
      if (options.auto) uiRuntimeState.finalResultAutoOpened = true;
      return { ok: true };
    }

    function closeFinalResultDialog(options = {}) {
      if (!els.finalResultOverlay) return;
      els.finalResultOverlay.hidden = true;
      els.finalResultOverlay.setAttribute("aria-hidden", "true");
      els.finalResultButton?.setAttribute("aria-expanded", "false");
      if (!options.silent) {
        els.finalResultButton?.focus?.();
      }
    }

    function minimizeFinalResultDialog() {
      closeFinalResultDialog();
    }

    function maybeAutoOpenFinalResultDialog() {
      syncFinalResultButton();
      if (!isGameEnded() || uiRuntimeState.finalResultAutoOpened) return;
      openFinalResultDialog({ auto: true });
    }

    function buildActionLogExportPlayerResults() {
      return buildFinalResultPlayerSummaries().map((summary) => {
        const player = summary.player || {};
        const breakdown = summary.breakdown || {};
        return {
          playerId: player.id || null,
          playerLabel: player.colorLabel || player.name || player.id || "未知玩家",
          finalScore: breakdown.totalScore ?? player.resources?.score ?? 0,
          baseScore: breakdown.baseScore ?? player.resources?.score ?? 0,
          tileScore: breakdown.tileScore ?? 0,
          cardScore: breakdown.cardScore ?? 0,
          jiuzheCardScore: breakdown.jiuzheCardScore ?? 0,
          jiuzhePenaltyScore: breakdown.jiuzhePenaltyScore ?? 0,
          runezuSymbolScore: breakdown.runezuSymbolScore ?? 0,
          completedTaskCount: player.completedTaskCount || 0,
          techCount: typeof countPlayerOwnedTech === "function"
            ? countPlayerOwnedTech(player)
            : 0,
          passed: context.isPlayerPassedThisRound(player.id),
        };
      });
    }

    return {
      syncFinalScorePendingMarks,
      renderFinalScoreBoard,
      handleFinalScoreTileClick,
      buildFinalResultPlayerSummaries,
      renderFinalResultDialog,
      syncFinalResultButton,
      openFinalResultDialog,
      closeFinalResultDialog,
      minimizeFinalResultDialog,
      maybeAutoOpenFinalResultDialog,
      buildActionLogExportPlayerResults,
    };
  }

  return {
    createFinalUiRuntime,
  };
});
