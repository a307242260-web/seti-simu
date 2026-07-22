(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppIncomeRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createIncomeRuntime(context = {}) {
    const {
      INCOME_GAIN_LABELS,
      players,
      data,
      blindDrawCardForPlayer,
      industry,
      getCardTypeCode,
      incrementCompletedTaskCount,
      cards,
      turnState,
      isWeakStartAiDifficulty,
      getPlayerById,
      appendConfirmedActionLogEntry,
      HISTORY_SOURCE_SETUP,
      getActivePlayers,
      renderPlayerStats,
      renderPlayerHand,
      renderInitialSelectionArea,
      renderStateReadout,
      getPlayerLabelById,
      FUNDAMENTALISM_ROUND_START_ROUNDS,
      getCurrentPlayer,
      HISTORY_SOURCE_QUICK,
      startCardEffectFlow,
      rocketState,
      renderActionEffectBar,
      updateActionButtons,
      beginDiscardSelection,
    } = context;

    function formatIncomeGain(gain) {
      return Object.entries(gain || {})
        .filter(([, value]) => value)
        .map(([key, value]) => `${INCOME_GAIN_LABELS[key] || key}+${value}`)
        .join("、");
    }

    function getBlindDrawIrreversible(drawnCount) {
      return drawnCount > 0
        ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
        : null;
    }

    function applyIncomeGainWithImmediateRewards(player, gain, dataSource = "income") {
      const drawnCards = [];
      const dataResults = [];
      const income = players.gainIncome(player, gain, {
        blindDraw: (targetPlayer) => {
          const result = blindDrawCardForPlayer(targetPlayer);
          if (result.ok && result.card) drawnCards.push(result.card);
          return result;
        },
        gainData: (targetPlayer) => {
          const result = data.gainData(targetPlayer, { source: dataSource });
          dataResults.push(result);
          return result;
        },
      });
      const irreversible = getBlindDrawIrreversible(drawnCards.length);
      return {
        income,
        drawnCards,
        dataResults,
        undoable: !irreversible,
        irreversible,
      };
    }

    function maybeCompleteFundamentalismIncomeTaskCard(player, card) {
      if (!industry?.shouldCompleteIncomeTaskCards?.(player)) return null;
      const typeCode = getCardTypeCode(card);
      if (typeCode !== 1 && typeCode !== 2) return null;
      return {
        typeCode,
        completedTaskCount: incrementCompletedTaskCount(player),
        scoreAwarded: 0,
      };
    }

    function applyIncomeFromCard(player, card) {
      if (!player) {
        return { ok: false, message: "没有当前玩家" };
      }

      const incomeCode = cards.getIncomeCodeForCard(card);
      const gain = cards.getIncomeGainForCard(card);
      if (!gain) {
        return {
          ok: false,
          message: `无法识别卡牌收入：${cards.getCardLabel(card) || "未知卡牌"}`,
        };
      }

      const incomeResult = applyIncomeGainWithImmediateRewards(player, gain, "income");
      const taskCompletion = maybeCompleteFundamentalismIncomeTaskCard(player, card);
      const taskMessage = taskCompletion
        ? `；原教旨主义：${taskCompletion.typeCode}型任务视为完成，完成任务+1`
        : "";
      return {
        ok: true,
        incomeCode,
        gain,
        drawnCards: incomeResult.drawnCards,
        dataResults: incomeResult.dataResults,
        undoable: incomeResult.undoable,
        irreversible: incomeResult.irreversible,
        taskCompletion,
        message: `收入：弃掉 ${cards.getCardLabel(card)}，${formatIncomeGain(gain)}（已即时获得）${taskMessage}`,
      };
    }

    function buildIncomeResourceGain(income) {
      const source = income || players.DEFAULT_INCOME;
      return {
        credits: source.credits || 0,
        energy: source.energy || 0,
        publicity: source.publicity || 0,
        availableData: source.availableData || 0,
        additionalPublicScan: source.additionalPublicScan || 0,
      };
    }

    function formatIncomeResourceSummary(resourceIncome, drawnCount, cardCount, drawError) {
      return [
        `信用点+${resourceIncome.credits || 0}`,
        `能量+${resourceIncome.energy || 0}`,
        `手牌+${drawnCount}${drawError ? `/${cardCount}` : ""}`,
        `宣传+${resourceIncome.publicity || 0}`,
        `数据+${resourceIncome.availableData || 0}`,
        `额外公共扫描+${resourceIncome.additionalPublicScan || 0}`,
      ].join("、");
    }

    function applyIncomeResourcesForPlayer(player, options = {}) {
      if (!player) {
        return { ok: false, message: "没有当前玩家" };
      }

      const income = player.income || players.DEFAULT_INCOME;
      const resourceIncome = buildIncomeResourceGain(income);
      const cardCount = Math.max(0, Math.round(income.handSize || 0));
      const drawnCards = [];
      let drawError = null;

      players.gainResources(player, resourceIncome);

      for (let index = 0; index < cardCount; index += 1) {
        const drawResult = blindDrawCardForPlayer(player);
        if (!drawResult.ok) {
          drawError = drawResult.message || "收入抽牌失败";
          break;
        }
        drawnCards.push(drawResult.card);
      }

      const label = options.label || "执行收入";
      const summary = formatIncomeResourceSummary(resourceIncome, drawnCards.length, cardCount, drawError);
      const message = drawError
        ? `${label}：${summary}，${drawError}`
        : `${label}：${summary}`;

      return {
        ok: !drawError,
        income: { ...income },
        resourceIncome,
        drawnCards,
        drawError,
        summary,
        message,
      };
    }

    function hasHuanyuSuperdriveRoundStartPending(player, roundNumber = turnState.roundNumber) {
      if (!player || !industry?.hasHuanyuSuperdriveRoundStart?.(player)) return false;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      return player.industryHuanyuSuperdriveRoundStartRound !== round;
    }

    function applyHuanyuSuperdriveRoundStartForPlayer(player, roundNumber = turnState.roundNumber) {
      if (!hasHuanyuSuperdriveRoundStartPending(player, roundNumber)) return null;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      const resourceGain = { energy: 1, publicity: 1 };
      players.gainResources(player, resourceGain);
      const shouldDraw = !isWeakStartAiDifficulty(player);
      const drawResult = shouldDraw ? blindDrawCardForPlayer(player) : { ok: true, card: null };
      player.industryHuanyuSuperdriveRoundStartRound = round;
      const drawnCount = drawResult?.ok && drawResult.card ? 1 : 0;
      const message = shouldDraw
        ? (drawResult?.ok
          ? `第${round}轮开始：获得 1能量、1宣传；盲抽 ${drawnCount}/1 张`
          : `第${round}轮开始：获得 1能量、1宣传；盲抽失败：${drawResult?.message || "未知错误"}`)
        : `第${round}轮开始：获得 1能量、1宣传`;
      return {
        ok: Boolean(drawResult?.ok),
        playerId: player.id,
        playerColorLabel: player.colorLabel || player.name || player.color || null,
        effect: { label: "寰宇超动力" },
        message,
        drawnCards: drawResult?.card ? [drawResult.card] : [],
        irreversible: drawnCount > 0
          ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
          : null,
        results: [{ message }],
      };
    }

    function hasCheatLabRoundStartPending(player, roundNumber = turnState.roundNumber) {
      if (!player || !industry?.hasCheatLabRoundStart?.(player)) return false;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      return player.industryCheatLabRoundStartRound !== round;
    }

    function applyCheatLabRoundStartForPlayer(player, roundNumber = turnState.roundNumber) {
      if (!hasCheatLabRoundStartPending(player, roundNumber)) return null;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      players.gainResources(player, { energy: 1 });
      const shouldDraw = !isWeakStartAiDifficulty(player);
      const drawResult = shouldDraw ? blindDrawCardForPlayer(player) : { ok: true, card: null };
      player.industryCheatLabRoundStartRound = round;
      const drawnCount = drawResult?.ok && drawResult.card ? 1 : 0;
      const message = shouldDraw
        ? (drawResult?.ok
          ? `第${round}轮开始：获得 1能量；盲抽 ${drawnCount}/1 张`
          : `第${round}轮开始：获得 1能量；盲抽失败：${drawResult?.message || "未知错误"}`)
        : `第${round}轮开始：获得 1能量`;
      return {
        ok: Boolean(drawResult?.ok),
        playerId: player.id,
        playerColorLabel: player.colorLabel || player.name || player.color || null,
        effect: { label: "作弊实验室" },
        message,
        drawnCards: drawResult?.card ? [drawResult.card] : [],
        irreversible: drawnCount > 0
          ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
          : null,
        results: [{ message }],
      };
    }

    function hasGrandStrategyRoundStartPending(player, roundNumber = turnState.roundNumber) {
      if (!player || !industry?.hasGrandStrategyRoundStart?.(player)) return false;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      return player.industryGrandStrategyRoundStartRound !== round;
    }

    function countStrategyPassiveSlotTokens(player) {
      return ["yellow", "red", "blue"]
        .filter((slotId) => Boolean(player?.industryStrategyPassiveSlots?.[slotId]))
        .length;
    }

    function applyGrandStrategyRoundStartForPlayer(player, roundNumber = turnState.roundNumber) {
      if (!hasGrandStrategyRoundStartPending(player, roundNumber)) return null;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      const clearedCount = countStrategyPassiveSlotTokens(player);
      industry?.clearStrategyPassiveSlots?.(player);
      player.industryGrandStrategyRoundStartRound = round;

      if (isWeakStartAiDifficulty(player)) {
        players.gainResources(player, { publicity: 1 });
        const message = `第${round}轮开始：清空奖励槽 ${clearedCount}/3；获得 1宣传`;
        return {
          ok: true,
          playerId: player.id,
          playerColorLabel: player.colorLabel || player.name || player.color || null,
          effect: { label: "宇宙大战略集团" },
          message,
          drawnCards: [],
          irreversible: null,
          results: [{ message }],
        };
      }

      const drawResult = blindDrawCardForPlayer(player);
      const drawnCount = drawResult?.ok && drawResult.card ? 1 : 0;
      const message = drawResult?.ok
        ? `第${round}轮开始：清空奖励槽 ${clearedCount}/3；盲抽 ${drawnCount}/1 张`
        : `第${round}轮开始：清空奖励槽 ${clearedCount}/3；盲抽失败：${drawResult?.message || "未知错误"}`;
      return {
        ok: Boolean(drawResult?.ok),
        playerId: player.id,
        playerColorLabel: player.colorLabel || player.name || player.color || null,
        effect: { label: "宇宙大战略集团" },
        message,
        drawnCards: drawResult?.card ? [drawResult.card] : [],
        irreversible: drawnCount > 0
          ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
          : null,
        results: [{ message }],
      };
    }

    function appendIndustryRoundStartLog(result, roundNumber = turnState.roundNumber) {
      if (!result) return null;
      const player = getPlayerById(result.playerId);
      const effectLabel = result.effect?.label || "公司";
      return appendConfirmedActionLogEntry({
        title: `第${roundNumber}轮开始`,
        player,
        actionType: "roundStart",
        actionLabel: "轮开始",
        roundNumber,
        rawTurnNumber: turnState.turnNumber,
        steps: [{
          source: HISTORY_SOURCE_SETUP,
          text: `${effectLabel}：${result.message}`,
          undoable: false,
          irreversibleCode: result.irreversible?.code || null,
          irreversibleReason: result.irreversible?.reason || null,
        }],
      });
    }

    function applyIndustryRoundStartBonuses(roundNumber = turnState.roundNumber, options = {}) {
      const results = getActivePlayers()
        .flatMap((player) => [
          applyHuanyuSuperdriveRoundStartForPlayer(player, roundNumber),
          applyCheatLabRoundStartForPlayer(player, roundNumber),
          applyGrandStrategyRoundStartForPlayer(player, roundNumber),
        ])
        .filter(Boolean);
      if (options.appendLog) {
        for (const result of results) appendIndustryRoundStartLog(result, roundNumber);
      }
      if (results.length) {
        renderPlayerStats();
        renderPlayerHand();
        renderInitialSelectionArea();
        renderStateReadout();
      }
      return {
        ok: results.every((result) => result.ok),
        results,
        message: results.map((result) => `${getPlayerLabelById(result.playerId)} ${result.message}`).join("；"),
      };
    }

    function getFundamentalismRoundStartIncomeRound(player, roundNumber = turnState.roundNumber) {
      if (!player || !industry?.hasFundamentalismRoundStartIncome?.(player)) return 0;
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      return FUNDAMENTALISM_ROUND_START_ROUNDS.includes(round) ? round : 0;
    }

    function hasFundamentalismRoundStartIncomePending(player, roundNumber = turnState.roundNumber) {
      const round = getFundamentalismRoundStartIncomeRound(player, roundNumber);
      return round > 0 && player?.industryFundamentalismRoundStartIncomeRound !== round;
    }

    function buildFundamentalismRoundStartIncomeEffect(player, roundNumber = turnState.roundNumber) {
      const round = Math.max(1, Math.round(Number(roundNumber) || 1));
      return {
        id: `industry-fundamentalism-income-${player?.id || "player"}-${round}`,
        type: "industry_fundamentalism_income",
        icon: "income",
        label: `原教旨主义：第${round}轮开始收入`,
        status: "pending",
        undoable: true,
        required: true,
        options: {
          playerId: player?.id || null,
          playerColor: player?.color || null,
          roundNumber: round,
        },
      };
    }

    function maybeStartFundamentalismRoundStartIncomeFlow(
      workingRoot,
      player = players.getCurrentPlayer(workingRoot?.playerState),
      roundNumber = workingRoot?.turnState?.roundNumber,
    ) {
      if (!workingRoot?.playerState || !workingRoot?.turnState || !workingRoot?.rocketState) {
        throw new TypeError("maybeStartFundamentalismRoundStartIncomeFlow 缺少 workingRoot");
      }
      if (!hasFundamentalismRoundStartIncomePending(player, roundNumber)) return null;
      const round = getFundamentalismRoundStartIncomeRound(player, roundNumber);
      if (!player?.hand?.length) {
        player.industryFundamentalismRoundStartIncomeRound = round;
        const result = {
          ok: true,
          skipped: true,
          playerId: player?.id || null,
          message: `原教旨主义：第${round}轮开始没有手牌可作为收入，已跳过`,
        };
        appendConfirmedActionLogEntry({
          title: `第${round}轮开始`,
          player,
          actionType: "roundStart",
          actionLabel: "轮开始",
          roundNumber: round,
          rawTurnNumber: workingRoot.turnState.turnNumber,
          steps: [{
            source: HISTORY_SOURCE_QUICK,
            text: result.message,
            undoable: false,
          }],
        });
        return result;
      }

      const started = startCardEffectFlow(
        `industry-fundamentalism-round-income-${player.id}-${round}`,
        "原教旨主义：轮开始收入",
        [buildFundamentalismRoundStartIncomeEffect(player, round)],
        {
          workingRoot,
          actionType: "industryFundamentalismRoundStartIncome",
          historySource: HISTORY_SOURCE_QUICK,
          consumesMainAction: false,
        },
      );
      if (started) {
        workingRoot.rocketState.statusNote = `原教旨主义：第${round}轮开始，请选择 1 张牌增加收入`;
        renderPlayerStats();
        renderPlayerHand();
        renderActionEffectBar();
        updateActionButtons();
        renderStateReadout();
      }
      return {
        ok: started,
        started,
        playerId: player.id,
        roundNumber: round,
        message: workingRoot.rocketState.statusNote,
      };
    }

    function beginIncomeForCurrentPlayer(options = {}) {
      const currentPlayer = getCurrentPlayer();
      return beginDiscardSelection(1, {
        type: "income",
        player: currentPlayer,
        source: options.source || null,
      });
    }

    return {
      formatIncomeGain,
      getBlindDrawIrreversible,
      applyIncomeGainWithImmediateRewards,
      maybeCompleteFundamentalismIncomeTaskCard,
      applyIncomeFromCard,
      buildIncomeResourceGain,
      formatIncomeResourceSummary,
      applyIncomeResourcesForPlayer,
      hasHuanyuSuperdriveRoundStartPending,
      applyHuanyuSuperdriveRoundStartForPlayer,
      hasCheatLabRoundStartPending,
      applyCheatLabRoundStartForPlayer,
      hasGrandStrategyRoundStartPending,
      countStrategyPassiveSlotTokens,
      applyGrandStrategyRoundStartForPlayer,
      appendIndustryRoundStartLog,
      applyIndustryRoundStartBonuses,
      getFundamentalismRoundStartIncomeRound,
      hasFundamentalismRoundStartIncomePending,
      buildFundamentalismRoundStartIncomeEffect,
      maybeStartFundamentalismRoundStartIncomeFlow,
      beginIncomeForCurrentPlayer,
    };
  }

  return { createIncomeRuntime };
});
