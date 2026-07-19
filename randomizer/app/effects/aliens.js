(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppEffectAlienExecutors = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function createEffectAlienExecutors(context = {}) {
    const {
      SCORE_SOURCE_KEYS,
      abilities,
      addPlayerScoreSource,
      addScoreSourceFromGain,
      alienGameState,
      aomomo,
      applyIncomeFromCard,
      applyYichangdianRewardToPlayer,
      beginCardSelection,
      beginEffectHistoryStep,
      blindDrawCardForPlayer,
      buildPlanetRewardEffectsWithIndustry,
      buildSectorScanChoicesForX,
      buildSectorScanChoicesForXs,
      cardEffects,
      cardState,
      cards,
      chong,
      claimRunezuPlanetSymbolForTravelResult,
      completeCurrentActionEffect,
      createActionContext,
      data,
      decisionSessions,
      document,
      els,
      endEffectHistoryStep,
      executeCardLandEffect,
      executeGainResourcesRewardEffect,
      finishAutomaticRewardEffect,
      finishChongFossilEffect,
      formatIncomeGain,
      getActionResultOwnerPlayer,
      getAomomoCurrentX,
      getChongPlanetLabel,
      getCurrentActionEffect,
      getCurrentPlayer,
      getEarthSectorCoordinate,
      getEffectOwnerPlayer,
      getIrreversibleReason,
      getPlayerById,
      hasPlayerVisitedPlanetThisTurn,
      historyCommands,
      insertActionEffectsAfterCurrent,
      markCurrentActionIrreversible,
      maybeCompleteActionEffectFromScan,
      nebulaDataState,
      nebulaHasScannableData,
      openAlienTraceRewardEffect,
      openChongFossilChoiceDialog,
      openLandTargetPicker,
      openScanTargetPicker,
      pendingState,
      playerState,
      players,
      recordAbilityCommands,
      recordHistoryCommand,
      removeRocketElement,
      renderActionEffectBar,
      renderAlienPanels,
      renderPlayerHand,
      renderPlayerStats,
      renderPublicCards,
      renderReservedCardsFromTaskState,
      renderRockets,
      renderStateReadout,
      replaceNebulaDataForCurrentPlayer,
      rocketActions,
      rocketState,
      solar,
      solarState,
      syncPlanetOrbitLandMarkers,
      updateActionButtons,
      withEffectExecutionPlayer,
      yichangdian,
    } = context;
    const decisionState = context.decisionSessions?.createFacade?.({
      discardAction: "discard_action",
      cardSelectionAction: "card_selection_action",
      scanTargetAction: "scan_target_action",
      handScanAction: "hand_scan_action",
      alienTraceAction: "alien_trace_action",
      alienTracePickerState: "alien_trace_picker_state",
      alienRevealConfirmation: "alien_reveal_confirmation",
      actionEffectFlow: "action_effect_flow",
    }) || {};
    const getYichangdianCornerAction = () => decisionSessions.peek("yichangdian_corner_action");

    function countYichangdianAnomalySignals() {
      if (!yichangdian) return 0;
      let total = 0;
      for (const anomaly of alienGameState.yichangdian?.anomalies || []) {
        const nebula = solar.getNebulaAtCoordinate(anomaly.sectorX, 5, solarState.sectorBySlot);
        if (!nebula) continue;
        const tokens = nebulaDataState.nebulae?.[nebula.id]?.tokens || [];
        total += tokens.filter((token) => token.replacedByPlayerColor || token.playerColor).length;
      }
      return total;
    }

    function executeYichangdianAnomalySignalScoreEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const score = countYichangdianAnomalySignals();
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      if (score > 0) {
        players.gainResources(currentPlayer, { score });
        addPlayerScoreSource(currentPlayer, SCORE_SOURCE_KEYS.ALIEN_EFFECT, score);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复异常点信号得分前玩家状态",
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `异常扇区共有 ${score} 个信号，获得 ${score} 分`,
        payload: { score },
      }, [renderPlayerStats]);
    }

    function executeYichangdianNextAnomalyRewardEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const { anomaly } = resolveYichangdianNextAnomalyFromCurrentEarth();
      const reward = anomaly ? yichangdian.getAnomalyReward(anomaly.markerId) : null;
      if (!currentPlayer || !anomaly || !reward) {
        rocketState.statusNote = "没有可结算的即将触发异常奖励";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }

      beginEffectHistoryStep(effect.label);
      const beforePlayerState = structuredClone(playerState);
      const rewardResult = applyYichangdianRewardToPlayer(currentPlayer, reward, `异常点牌 ${anomaly.markerId}`);
      if (rewardResult.ok) addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.ALIEN_EFFECT, reward.gain);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复异常点牌奖励前玩家状态",
      ));
      if (getCurrentActionEffect()) {
        getCurrentActionEffect().result = {
          ok: true,
          undoable: true,
          message: rewardResult.message,
          payload: { anomaly, reward },
        };
      }
      if (reward.pickCard) {
        beginCardSelection({
          type: "yichangdian_anomaly_pick",
          player: currentPlayer,
          allowBlindDraw: true,
          fromEffectFlow: true,
        });
        return { ok: true, message: rewardResult.message };
      }
      completeCurrentActionEffect();
      renderPlayerStats();
      renderStateReadout();
      return { ok: true, message: rewardResult.message };
    }

    function resolveYichangdianNextAnomalyFromCurrentEarth() {
      if (!yichangdian || !alienGameState.yichangdian?.revealInitialized) {
        return { nextSectorX: null, anomaly: null };
      }
      const earth = getEarthSectorCoordinate();
      const nextSectorX = yichangdian.updateNextAnomaly(alienGameState, earth.x);
      const anomaly = nextSectorX == null
        ? null
        : yichangdian.getAnomalyBySectorX(alienGameState, nextSectorX);
      return { nextSectorX, anomaly };
    }

    function executeYichangdianPublicAllEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      beginEffectHistoryStep(effect.label);
      const beforePlayerState = structuredClone(playerState);
      const beforeCardState = structuredClone(cardState);
      const picked = [];
      for (let slotIndex = 0; slotIndex < cards.PUBLIC_CARD_COUNT; slotIndex += 1) {
        const result = cards.pickFromPublic(cardState, playerState, currentPlayer, slotIndex);
        if (result.ok) picked.push(result.card);
      }
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        beforePlayerState,
        "恢复异常点拿公共牌前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        beforeCardState,
        "恢复异常点拿公共牌前牌区状态",
      ));
      markCurrentActionIrreversible("公共牌补牌翻出新牌", "hidden_card_reveal");
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: false,
        irreversible: { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" },
        message: `获得公共牌区 ${picked.length} 张牌${picked.length ? `：${picked.map((card) => cards.getCardLabel(card)).join("、")}` : ""}`,
        payload: { cards: picked },
      }, [renderPublicCards, renderPlayerHand, renderPlayerStats]);
    }

    function executeYichangdianAlienTraceEffect(effect) {
      return openAlienTraceRewardEffect({
        ...effect,
        options: { ...(effect.options || {}) },
      });
    }

    function executeYichangdianNextAnomalyScanEffect(effect) {
      const { nextSectorX } = resolveYichangdianNextAnomalyFromCurrentEarth();
      if (nextSectorX == null) {
        rocketState.statusNote = "没有即将触发的异常扇区";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const nebula = solar.getNebulaAtCoordinate(nextSectorX, 5, solarState.sectorBySlot);
      if (!nebula) {
        rocketState.statusNote = `异常扇区 ${nextSectorX} 没有星云`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      if (!nebulaHasScannableData(nebula.id)) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${nebula.label || nebula.id}没有可扫描数据，已跳过`,
          payload: { nebulaId: nebula.id, sectorX: nextSectorX, skipped: true },
        });
      }
      const result = replaceNebulaDataForCurrentPlayer(nebula.id, {
        prefix: effect.label,
        source: "card",
        gainData: true,
      });
      maybeCompleteActionEffectFromScan(result);
      return result;
    }

    function applyYichangdianDiscardActionReward(card, messageParts) {
      const currentPlayer = getCurrentPlayer();
      const reward = cards.getDiscardActionRewardForCard(card);
      const moveReward = cards.getDiscardActionMoveRewardForCard(card);
      if (reward?.gain && Object.keys(reward.gain).length) {
        players.gainResources(currentPlayer, reward.gain);
        addScoreSourceFromGain(currentPlayer, SCORE_SOURCE_KEYS.ALIEN_EFFECT, reward.gain);
        messageParts.push(`${cards.getCardLabel(card)} 左上角：${players.formatResourceCost(reward.gain)}`);
      }
      if (reward?.dataCount) {
        for (let index = 0; index < reward.dataCount; index += 1) {
          data.gainData(currentPlayer, { source: "yichangdian_card" });
        }
        messageParts.push(`${cards.getCardLabel(card)} 左上角：${reward.dataCount}数据`);
      }
      if (moveReward) {
        insertActionEffectsAfterCurrent([{
          id: `yichangdian-corner-move-${card.id}`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: `${cards.getCardLabel(card)}：${moveReward.label}`,
          icon: "movement",
          status: "pending",
          options: { movementPoints: moveReward.movementPoints || 1 },
        }]);
        messageParts.push(`${cards.getCardLabel(card)} 左上角：${moveReward.label}`);
      }
    }

    function executeYichangdianDrawThenTwoCornersEffect(effect) {
      if (getYichangdianCornerAction()) {
        return openYichangdianCornerPicker();
      }

      const currentPlayer = getCurrentPlayer();
      if (effect?.options) effect.options.skippable = false;
      beginEffectHistoryStep(effect.label);
      const beforePlayerState = structuredClone(playerState);
      const beforeCardState = structuredClone(cardState);
      const drawn = [];
      for (let index = 0; index < 3; index += 1) {
        const drawResult = blindDrawCardForPlayer(currentPlayer);
        if (drawResult.ok) drawn.push(drawResult.card);
      }
      markCurrentActionIrreversible("盲抽翻出新牌", "hidden_card_reveal");
      decisionSessions.open("yichangdian_corner_action", {
        effect,
        playerId: currentPlayer.id,
        phase: "discard",
        drawnCardIds: drawn.map((card) => card.id),
        selectedDiscardCard: null,
        beforePlayerState,
        beforeCardState,
        messageParts: [`盲抽 ${drawn.length} 张`],
      });
      renderPlayerHand();
      renderPlayerStats();
      return openYichangdianCornerPicker();
    }

    function getPendingYichangdianCornerCards() {
      const pending = getYichangdianCornerAction();
      const player = pending ? getPlayerById(pending.playerId) : null;
      if (!pending || !player) return [];
      const usedIds = new Set([pending.selectedDiscardCard?.id].filter(Boolean));
      return pending.drawnCardIds
        .map((id) => player.hand.find((card) => card.id === id))
        .filter((card) => card && !usedIds.has(card.id));
    }

    function formatYichangdianCornerChoiceReward(card, phase) {
      if (phase === "discard") {
        const resourceReward = cards.getDiscardActionRewardForCard(card);
        const moveReward = cards.getDiscardActionMoveRewardForCard?.(card);
        return `结算左上角：${resourceReward?.label || moveReward?.label || "无可结算奖励"}`;
      }

      const gain = cards.getIncomeGainForCard(card);
      const rewardText = gain ? formatIncomeGain(gain) : "";
      return `结算收入角标：${rewardText || "无可结算收入"}`;
    }

    function openYichangdianCornerPicker() {
      const pending = getYichangdianCornerAction();
      if (!pending || !els.scanTargetOverlay || !els.scanTargetActions) {
        return { ok: false, message: "无法打开异常点角标选择" };
      }
      const choices = getPendingYichangdianCornerCards();
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = "异常点 8 号牌";
      if (els.scanTargetSubtitle) {
        els.scanTargetSubtitle.textContent = pending.phase === "discard"
          ? "请选择 1 张抽到的牌弃掉并结算左上角弃牌奖励。"
          : "请选择 1 张剩余抽到的牌弃掉并结算右下角收入奖励。";
      }
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = true;
      els.scanTargetActions.replaceChildren(...choices.map((card) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.yichangdianCornerCardId = card.id;
        button.append(document.createTextNode(cards.getCardLabel(card)));
        const detail = document.createElement("small");
        detail.textContent = formatYichangdianCornerChoiceReward(card, pending.phase);
        button.appendChild(detail);
        return button;
      }));
      els.scanTargetOverlay.hidden = false;
      rocketState.statusNote = pending.phase === "discard" ? "异常点：请选择左上角奖励牌" : "异常点：请选择收入奖励牌";
      renderActionEffectBar();
      updateActionButtons();
      renderStateReadout();
      return { ok: true, message: rocketState.statusNote };
    }

    function handleYichangdianCornerChoice(cardId) {
      const pending = getYichangdianCornerAction();
      const player = pending ? getPlayerById(pending.playerId) : null;
      if (!pending || !player) return { ok: false, message: "没有异常点角标选择流程" };
      const card = player.hand.find((item) => item.id === cardId);
      if (!card) return { ok: false, message: "选择的卡牌不在手牌中" };
      const handIndex = player.hand.findIndex((item) => item.id === card.id);
      const discardResult = cards.discardFromHandAtIndex(player, handIndex);
      if (!discardResult.ok) return discardResult;
      cards.addToDiscardPile(cardState, discardResult.card);

      if (pending.phase === "discard") {
        pending.selectedDiscardCard = discardResult.card;
        applyYichangdianDiscardActionReward(discardResult.card, pending.messageParts);
        pending.phase = "income";
        renderPlayerHand();
        renderPlayerStats();
        return openYichangdianCornerPicker();
      }

      const incomeResult = applyIncomeFromCard(player, discardResult.card);
      pending.messageParts.push(incomeResult.message);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        playerState,
        pending.beforePlayerState,
        "恢复异常点盲抽角标前玩家状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        cardState,
        pending.beforeCardState,
        "恢复异常点盲抽角标前牌区状态",
      ));
      decisionSessions.clear("yichangdian_corner_action");
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = true;
      return finishAutomaticRewardEffect(pending.effect, {
        ok: true,
        undoable: false,
        irreversible: { code: "hidden_card_reveal", reason: "盲抽翻出新牌" },
        message: pending.messageParts.join("；"),
        payload: {
          discardCard: pending.selectedDiscardCard,
          incomeCard: discardResult.card,
        },
      }, [renderPlayerHand, renderPlayerStats]);
    }

    function executeYichangdianLaunchAnomalyMoveEffect(effect) {
      const earth = getEarthSectorCoordinate();
      const anomaly = yichangdian?.getAnomalyBySectorX?.(alienGameState, earth.x);
      if (!anomaly) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: "发射不在异常扇区，不获得移动",
        });
      }
      insertActionEffectsAfterCurrent([{
        id: "yichangdian-launch-free-move",
        type: cardEffects.EFFECT_TYPES.CARD_MOVE,
        label: "异常扇区发射：1移动",
        icon: "movement",
        status: "pending",
        options: { movementPoints: 1 },
      }]);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: "发射在异常扇区，获得1移动",
      });
    }

    function findChongProbeFossilPlanet() {
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return null;
      const planetLocations = solar.createSolarSnapshot(solarState).planetLocations;
      const active = rocketActions.getActiveRocket(rocketState);
      const candidates = [
        ...(active ? [active] : []),
        ...rocketActions.getRocketsForPlayer(rocketState, currentPlayer.id),
        ...rocketActions.getMovableTokensForPlayer(rocketState, currentPlayer.id),
      ];
      const seen = new Set();
      for (const rocket of candidates) {
        if (!rocket || seen.has(rocket.id)) continue;
        seen.add(rocket.id);
        if (!rocketActions.isChongFossilRewardProbe(rocket, currentPlayer.id)) continue;
        const sector = rocketActions.getRocketSectorCoordinate(rocket);
        const planet = planetLocations.find((item) => item.x === sector?.x && item.y === sector?.y);
        if (planet?.planetId === "jupiter" || planet?.planetId === "saturn") {
          const transported = (rocket.kind || rocketActions.ROCKET_KIND.STANDARD) === rocketActions.ROCKET_KIND.CHONG_FOSSIL
            ? chong?.getTransportedFossilForRocket?.(alienGameState, rocket.id, currentPlayer)
            : null;
          return { rocket, planetId: planet.planetId, planet, transportedFossil: transported?.fossil || null };
        }
      }
      return null;
    }

    function listChongRewardFossilsAtPlacement(placement) {
      if (!placement?.planetId || !chong?.getAvailablePlanetFossils) return [];
      const choices = [];
      const seen = new Set();
      const addChoice = (fossil, source) => {
        if (!fossil?.fossilId || seen.has(fossil.fossilId)) return;
        seen.add(fossil.fossilId);
        choices.push({
          ...fossil,
          currentPlanetId: placement.planetId,
          rewardChoiceSource: source,
        });
      };
      addChoice(placement.transportedFossil, "transport");
      for (const fossil of chong.getAvailablePlanetFossils(alienGameState, placement.planetId)) {
        addChoice(fossil, "planet");
      }
      return choices;
    }

    function getChongLandProbeOptions(effect, target, rocketId) {
      return {
        skipCost: true,
        target: target || { type: "planet" },
        rocketId,
        source: "card",
        historyLabel: effect.label,
        allowSatelliteWithoutTech: Boolean(effect.options?.allowSatellite),
      };
    }

    function getChongPickupPlanetIds() {
      return ["jupiter", "saturn"];
    }

    function isChongPickupPlanetId(planetId) {
      return getChongPickupPlanetIds().includes(planetId);
    }

    function listChongTravelChoices(choices) {
      return (choices || []).filter(Boolean);
    }

    function normalizeChongChoiceOptions(baseOptions, choices, message) {
      if (!choices.length) {
        return {
          ok: false,
          message: message || "当前没有可执行虫族行动的目标",
        };
      }
      return {
        ...baseOptions,
        ok: true,
        planet: choices.length === 1
          ? choices[0].planet
          : { planetId: "multi-chong-travel", name: "虫族行动目标" },
        choices,
        needsChoice: choices.length > 1,
        defaultTarget: choices[0].target,
        defaultRocketId: choices[0].rocketId,
        energyCost: choices[0].energyCost,
        cost: { ...(choices[0].cost || {}) },
      };
    }

    function getChongLandOptions(effect) {
      const baseOptions = abilities.planet.getLandOptions(createActionContext(), {
        skipCost: true,
        allowSatelliteWithoutTech: Boolean(effect.options?.allowSatellite),
      });
      if (!baseOptions.ok) return baseOptions;
      const choices = listChongTravelChoices(baseOptions.choices);
      return normalizeChongChoiceOptions(baseOptions, choices, "当前没有可登陆目标");
    }

    function getChongOrbitOrLandOptions(effect) {
      const context = createActionContext();
      const orbitOptions = abilities.planet.getOrbitOptions(context, { skipCost: true });
      const landOptions = abilities.planet.getLandOptions(context, {
        skipCost: true,
        allowSatelliteWithoutTech: Boolean(effect.options?.allowSatellite),
      });
      const choices = [];
      if (orbitOptions.ok) {
        choices.push(...listChongTravelChoices(orbitOptions.choices).map((choice) => ({
          ...choice,
          kind: "orbit",
        })));
      }
      if (landOptions.ok) {
        choices.push(...listChongTravelChoices(landOptions.choices).map((choice) => ({
          ...choice,
          kind: "land",
        })));
      }
      return normalizeChongChoiceOptions(
        {
          ok: true,
          title: "选择虫族环绕/登陆目标",
          selectLabel: "行动目标",
          confirmText: "确认",
        },
        choices,
        orbitOptions.message || landOptions.message || "当前没有可环绕或登陆目标",
      );
    }

    function openChongLandTargetPicker(effect) {
      const options = getChongLandOptions(effect);
      if (!options.ok) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：${options.message || "无法登陆"}，已跳过`,
          payload: { reason: "no_chong_land_target" },
        });
      }

      if (options.choices.length <= 1) {
        return executeChongTravelForPickupChoice(effect, { ...options.choices[0], kind: "land" });
      }

      openLandTargetPicker({
        effect,
        title: "选择虫族登陆目标",
        selectLabel: "登陆到",
        confirmText: "确认登陆",
        ...options,
        getOptions: () => getChongLandOptions(effect),
        onConfirm: (choice) => withEffectExecutionPlayer(
          effect,
          () => executeChongTravelForPickupChoice(effect, { ...choice, kind: "land" }),
        ),
        onCancel: () => {
          rocketState.statusNote = "已取消虫族登陆目标选择";
          renderStateReadout();
        },
      });
      rocketState.statusNote = `${effect.label}：请选择登陆目标（木星/土星可拾取化石）`;
      renderStateReadout();
      return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
    }

    function openChongOrbitOrLandTargetPicker(effect) {
      const options = getChongOrbitOrLandOptions(effect);
      if (!options.ok) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：${options.message || "无法环绕或登陆"}，已跳过`,
          payload: { reason: "no_chong_travel_target" },
        });
      }
      if (options.choices.length <= 1) {
        return executeChongTravelForPickupChoice(effect, options.choices[0]);
      }
      openLandTargetPicker({
        effect,
        ...options,
        getOptions: () => getChongOrbitOrLandOptions(effect),
        onConfirm: (choice) => withEffectExecutionPlayer(effect, () => executeChongTravelForPickupChoice(effect, choice)),
        onCancel: () => {
          rocketState.statusNote = "已取消虫族环绕/登陆目标选择";
          renderStateReadout();
        },
      });
      rocketState.statusNote = `${effect.label}：请选择环绕或登陆目标（木星/土星可拾取化石）`;
      renderStateReadout();
      return { ok: true, awaitingChoice: true, message: rocketState.statusNote };
    }

    function executeChongTravelForPickupEffect(effect) {
      if (effect?.type === chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP) {
        return openChongOrbitOrLandTargetPicker(effect);
      }
      if (effect?.type === chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP) {
        return openChongLandTargetPicker(effect);
      }
      return executeChongTravelForPickupWithLandTarget(effect, { type: "planet" });
    }

    function executeChongTravelForPickupChoice(effect, choice = {}) {
      const actionKind = choice.kind === "orbit" ? "orbit" : "land";
      const target = choice.target || { type: "planet" };
      const rocketId = choice.rocketId ?? target.rocketId;
      return executeChongTravelForPickupWithLandTarget(effect, target, { actionKind, rocketId });
    }

    function executeChongTravelForPickupWithLandTarget(effect, landTarget = { type: "planet" }, options = {}) {
      if (!chong) return null;
      if (decisionState.actionEffectFlow) decisionState.actionEffectFlow.chongPickupContext = null;

      beginEffectHistoryStep(effect.label);
      let result = null;
      if (effect.type === chong.EFFECT_TYPES.CHONG_ORBIT_OR_LAND_FOR_PICKUP && options.actionKind === "orbit") {
        result = abilities.executeAbility("orbitProbe", createActionContext(), {
          skipCost: true,
          rocketId: options.rocketId,
          source: "card",
          historyLabel: effect.label,
        });
      } else {
        result = abilities.executeAbility("landProbe", createActionContext(), {
          ...getChongLandProbeOptions(effect, landTarget, options.rocketId),
        });
      }

      if (!result.ok) {
        endEffectHistoryStep();
        rocketState.statusNote = options.rocketId == null
          ? result.message
          : `${result.message}（请求火箭 R${options.rocketId}）`;
        renderStateReadout();
        return { ...result, message: rocketState.statusNote };
      }

      const travelActionType = result.abilityId === "orbitProbe"
        ? "orbit"
        : result.abilityId === "landProbe"
          ? "land"
          : null;
      const actionOwner = getActionResultOwnerPlayer(result, getEffectOwnerPlayer(effect));

      recordAbilityCommands(result);
      if (travelActionType) {
        claimRunezuPlanetSymbolForTravelResult(travelActionType, result, actionOwner);
      }
      if (result.removedRocketId != null) removeRocketElement(result.removedRocketId);
      syncPlanetOrbitLandMarkers();
      renderRockets();
      renderPlayerStats();

      const rewardEffects = travelActionType
        ? buildPlanetRewardEffectsWithIndustry(travelActionType, result, {
          player: actionOwner,
          scoreSourceKey: travelActionType === "orbit" ? SCORE_SOURCE_KEYS.ORBIT : SCORE_SOURCE_KEYS.LAND,
        })
        : [];
      if (rewardEffects.length) insertActionEffectsAfterCurrent(rewardEffects);

      if (decisionState.actionEffectFlow) {
        decisionState.actionEffectFlow.chongPickupContext = {
          planetId: result.planetId || null,
          actionEffectId: effect.id,
          cardId: decisionState.actionEffectFlow.card?.id || null,
          cardIndex: effect.options?.cardIndex ?? null,
        };
      }
      effect.result = {
        ...result,
        message: rewardEffects.length
          ? `${result.message}；追加 ${rewardEffects.length} 个地点奖励`
          : result.message,
        payload: {
          ...(result.payload || {}),
          chongPickupPlanetId: result.planetId || null,
          rewardCount: rewardEffects.length,
        },
      };
      rocketState.statusNote = effect.result.message;
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeChongPickupFossilEffect(effect) {
      if (!chong) return null;
      const currentPlayer = getCurrentPlayer();
      const card = decisionState.actionEffectFlow?.card || null;
      const task = card?.chongTask || chong.getCardTask(effect.options?.cardIndex);
      const beforeAlienState = structuredClone(alienGameState);
      const planetId = decisionState.actionEffectFlow?.chongPickupContext?.planetId || null;

      if (!planetId) {
        return finishChongFossilEffect(`${effect.label}：没有上一段登陆/环绕结果`, { planetId: null });
      }

      if (!isChongPickupPlanetId(planetId)) {
        return finishChongFossilEffect(`${effect.label}：不在木星/土星，不能拾取化石`, { planetId });
      }

      const available = chong.getAvailablePlanetFossils(alienGameState, planetId);
      if (!available.length) {
        return finishChongFossilEffect(`${effect.label}：${getChongPlanetLabel(planetId)}没有可拾取化石`, { planetId });
      }

      return openChongFossilChoiceDialog({
        mode: "pickup",
        player: currentPlayer,
        planetId,
        card,
        task,
        fromEffectFlow: true,
        effectLabel: effect.label,
        title: "拾取虫族化石",
        subtitle: `${getChongPlanetLabel(planetId)}化石已查看。选择 1 枚作为可移动棋子放到太阳系。`,
        beforeAlienState,
        beforePlayerState: structuredClone(playerState),
        beforeCardState: structuredClone(cardState),
      });
    }

    function executeChongProbePlanetFossilRewardEffect(effect) {
      if (!chong) return null;
      const placement = findChongProbeFossilPlanet();
      if (!placement) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: "虫族化石：当前没有探测器或搬运化石停在木星/土星",
        });
      }
      const fossils = listChongRewardFossilsAtPlacement(placement);
      if (!fossils.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${getChongPlanetLabel(placement.planetId)}没有可结算化石`,
        });
      }
      return openChongFossilChoiceDialog({
        mode: "reward",
        player: getCurrentPlayer(),
        planetId: placement.planetId,
        fossils,
        fromEffectFlow: true,
        effectLabel: effect.label,
        title: "查看并结算化石",
        subtitle: `${getChongPlanetLabel(placement.planetId)}化石已查看。选择 1 枚只结算奖励，不移除化石。`,
        beforeAlienState: structuredClone(alienGameState),
        beforePlayerState: structuredClone(playerState),
        beforeCardState: structuredClone(cardState),
      });
    }

    function executeChongChoosePlanetFossilRewardEffect(effect) {
      if (!chong) return null;
      const fossils = chong.getAvailablePlanetFossils(alienGameState);
      if (!fossils.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: "木星/土星没有可结算化石",
        });
      }
      return openChongFossilChoiceDialog({
        mode: "reward",
        player: getCurrentPlayer(),
        planetIds: ["jupiter", "saturn"],
        fromEffectFlow: true,
        effectLabel: effect.label,
        title: "选择星球化石奖励",
        subtitle: "选择木星或土星 1 枚化石，只结算奖励，不移除化石。",
        beforeAlienState: structuredClone(alienGameState),
        beforePlayerState: structuredClone(playerState),
        beforeCardState: structuredClone(cardState),
      });
    }

    function getPriorActionEffectFlowIrreversible(effect) {
      const effects = decisionState.actionEffectFlow?.effects || [];
      if (!effects.length) return null;
      let currentIndex = Number.isInteger(decisionState.actionEffectFlow?.currentIndex)
        ? decisionState.actionEffectFlow.currentIndex
        : effects.findIndex((item) => item === effect || (item?.id && item.id === effect?.id));
      if (!Number.isInteger(currentIndex) || currentIndex < 0) {
        currentIndex = effects.findIndex((item) => item === effect || (item?.id && item.id === effect?.id));
      }
      if (currentIndex <= 0) return null;
      for (let index = 0; index < currentIndex; index += 1) {
        const prior = effects[index];
        const reason = getIrreversibleReason(prior?.result, prior?.label)
          || (prior?.undoable === false ? prior.label || "前序效果不可撤销" : null);
        if (reason) {
          return {
            code: prior?.result?.irreversible?.code || prior?.irreversibleCode || "irreversible_effect",
            reason,
          };
        }
      }
      return null;
    }

    function executeChongTaskCleanupEffect(effect) {
      if (!chong) return null;
      const rocketId = Math.round(Number(effect.options?.rocketId));
      beginEffectHistoryStep(effect.label);
      const beforeAlienState = structuredClone(alienGameState);
      const beforeRocketState = structuredClone(rocketState);
      if (!Number.isInteger(rocketId)) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：没有可清理的搬运化石`,
        }, [renderAlienPanels, renderRockets, renderReservedCardsFromTaskState]);
      }

      const result = chong.completeTransportedFossil(alienGameState, rocketId, {
        cardId: effect.options?.cardId || null,
        destinationPlanetId: effect.options?.destinationPlanetId || null,
        task: effect.options?.task || null,
      });
      if (!result.ok) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          skipped: true,
          message: `${effect.label}：${result.message}`,
          payload: { cleanup: result },
        }, [renderAlienPanels, renderRockets, renderReservedCardsFromTaskState]);
      }

      const removeResult = rocketActions.removeRocket(rocketState, rocketId);
      if (removeResult.ok) removeRocketElement(rocketId);
      recordHistoryCommand(historyCommands.createRestoreObjectCommand(
        alienGameState,
        beforeAlienState,
        "恢复虫族任务清理前外星人状态",
      ));
      recordHistoryCommand(historyCommands.createRestoreRocketStateCommand(
        rocketState,
        beforeRocketState,
        "恢复虫族任务清理前火箭状态",
      ));
      const removedText = removeResult.ok
        ? `移除搬运化石 R${rocketId}`
        : "太阳系搬运化石已不在棋子区";
      const priorIrreversible = getPriorActionEffectFlowIrreversible(effect);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: !priorIrreversible,
        irreversible: priorIrreversible,
        message: `${effect.label}：${result.message}；${removedText}`,
        payload: { cleanup: result, removedRocketId: removeResult.ok ? rocketId : null },
      }, [renderAlienPanels, renderRockets, renderReservedCardsFromTaskState]);
    }

    function applyAomomoScanCostAndBonus(pending, result) {
      if (!pending || !result?.ok) return result;
      const currentPlayer = getCurrentPlayer();
      const beforePlayer = structuredClone(currentPlayer);
      const messages = [];
      const fossilCost = Math.max(0, Math.round(Number(pending.aomomoFossilCost) || 0));
      if (fossilCost > 0) {
        const cost = { aomomoFossils: fossilCost };
        if (!players.canAfford(currentPlayer, cost)) {
          Object.assign(currentPlayer, beforePlayer);
          rocketState.statusNote = `化石不足：需要 ${fossilCost} 化石`;
          renderPlayerStats();
          renderStateReadout();
          return { ok: false, message: rocketState.statusNote };
        }
        const spend = players.spendResources(currentPlayer, cost);
        if (!spend.ok) return spend;
        messages.push(`支付${fossilCost}化石`);
      }
      const isAomomoScan = result.nebulaId === aomomo?.NEBULA_ID;
      if (isAomomoScan && pending.aomomoScanBonus?.gainFossil) {
        players.gainResources(currentPlayer, { aomomoFossils: 1 });
        messages.push("奥陌陌扫描+1化石");
      }
      if (isAomomoScan && pending.aomomoScanBonus?.score) {
        const score = Math.max(0, Math.round(Number(pending.aomomoScanBonus.score) || 0));
        if (score > 0) {
          players.gainResources(currentPlayer, { score });
          addPlayerScoreSource(currentPlayer, SCORE_SOURCE_KEYS.ALIEN_EFFECT, score);
          messages.push(`奥陌陌扫描+${score}分`);
        }
      }
      if (messages.length) {
        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复奥陌陌扫描附加奖励前玩家状态",
        ));
        result.message = `${result.message}；${messages.join("；")}`;
        rocketState.statusNote = result.message;
      }
      return result;
    }

    function openAomomoCurrentXScanEffect(effect) {
      const currentX = getAomomoCurrentX();
      if (currentX == null) {
        rocketState.statusNote = "奥陌陌星球尚未启用，无法扫描奥陌陌所在扇区";
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const bonus = {};
      if (effect.type === aomomo.EFFECT_SCAN_AOMOMO_X_GAIN_FOSSIL) bonus.gainFossil = true;
      if (effect.type === aomomo.EFFECT_SCAN_AOMOMO_X_SCORE) bonus.score = effect.options?.score || 2;
      rocketState.statusNote = `${effect.label}：请选择奥陌陌当前 x=${currentX} 的扫描目标`;
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        fromEffectFlow: true,
        title: effect.label,
        subtitle: "选择外圈星云或奥陌陌星球；无可替换数据时追加扫描计数且不获得数据。",
        gainData: effect.options?.gainData,
        aomomoScanBonus: bonus,
        choices: buildSectorScanChoicesForX(currentX),
      });
    }

    function executeAomomoGainFossilsEffect(effect) {
      const count = Math.max(0, Math.round(Number(effect.options?.count) || 0));
      return executeGainResourcesRewardEffect({
        ...effect,
        options: { gain: { aomomoFossils: count } },
      });
    }

    function executeAomomoVisitThisTurnFossilEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const count = Math.max(0, Math.round(Number(effect.options?.count) || 1));
      const visited = hasPlayerVisitedPlanetThisTurn(currentPlayer, aomomo?.PLANET_ID);
      beginEffectHistoryStep(effect.label);
      const beforePlayer = structuredClone(currentPlayer);
      if (visited && count > 0) {
        players.gainResources(currentPlayer, { aomomoFossils: count });
        recordHistoryCommand(historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复奥陌陌访问奖励前玩家状态",
        ));
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: visited
          ? `${effect.label}：已访问奥陌陌，获得 ${count} 化石`
          : `${effect.label}：本回合尚未访问奥陌陌，未获得化石`,
        payload: { visited, count },
      });
    }

    function executeAomomoFossilForDataEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const cost = Math.max(1, Math.round(Number(effect.options?.cost) || 1));
      if (!players.canAfford(currentPlayer, { aomomoFossils: cost })) {
        if (effect.options?.optional) {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            undoable: true,
            message: `${effect.label}：没有足够化石，已跳过`,
          });
        }
        rocketState.statusNote = `化石不足：需要 ${cost} 化石`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(effect.label);
      players.spendResources(currentPlayer, { aomomoFossils: cost });
      const dataCount = Math.max(0, Math.round(Number(effect.options?.dataCount) || 1));
      const results = [];
      for (let index = 0; index < dataCount; index += 1) {
        results.push(data.gainData(currentPlayer, { source: "aomomo_card" }));
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复奥陌陌化石换数据前玩家状态",
      ));
      const gained = results.filter((item) => item.ok).length;
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：支付${cost}化石，获得${gained}/${dataCount}数据`,
        payload: { results },
      }, [renderPlayerHand]);
    }

    function openAomomoFossilAnyScanEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const cost = Math.max(1, Math.round(Number(effect.options?.cost) || 1));
      if (!players.canAfford(currentPlayer, { aomomoFossils: cost })) {
        if (effect.options?.optional) {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            undoable: true,
            message: `${effect.label}：没有足够化石，已跳过`,
          });
        }
        rocketState.statusNote = `化石不足：需要 ${cost} 化石`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      rocketState.statusNote = `${effect.label}：请选择 0-7 号扇区之一`;
      renderStateReadout();
      return openScanTargetPicker({
        type: "sector_scan",
        fromEffectFlow: true,
        title: effect.label,
        subtitle: "支付化石后扫描任意扇区。",
        gainData: effect.options?.gainData,
        aomomoFossilCost: cost,
        choices: buildSectorScanChoicesForXs(Array.from({ length: 8 }, (_item, x) => x)),
      });
    }

    function executeAomomoLandEffect(effect, options = {}) {
      if (effect.type === "aomomo_land_only") {
        const landOptions = abilities.planet?.getLandOptions?.(createActionContext(), { skipCost: true });
        if (!landOptions?.ok) {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            skipped: true,
            undoable: true,
            message: `${effect.label}：无法登陆（${landOptions?.message || "没有可登陆目标"}），已跳过`,
            payload: { failedMessage: landOptions?.message || null },
          }, [renderRockets, renderAlienPanels]);
        }
      }
      const score = Math.max(0, Math.round(Number(options.scoreIfAomomo ?? effect.options?.score) || 0));
      const afterLandRewards = Array.isArray(effect.options?.afterLandRewards)
        ? [...effect.options.afterLandRewards]
        : [];
      const scoreRewardId = `${effect.id || "aomomo-land"}-aomomo-score`;
      if (score > 0 && !afterLandRewards.some((reward) => reward?.effect?.id === scoreRewardId)) {
        afterLandRewards.push({
          planetIds: [aomomo?.PLANET_ID || "aomomo"],
          effect: {
            id: scoreRewardId,
            type: "gain_resources",
            label: `奥陌陌登陆：${score}分`,
            icon: "score",
            options: { gain: { score }, scoreSourceKey: SCORE_SOURCE_KEYS.LAND },
          },
        });
      }
      effect.options = {
        ...(effect.options || {}),
        skipCost: true,
        ...(afterLandRewards.length ? { afterLandRewards } : {}),
      };
      return executeCardLandEffect(effect);
    }

    function executeAomomoFossilMoveAndLandEffect(effect) {
      const currentPlayer = getEffectOwnerPlayer(effect) || getCurrentPlayer();
      const cost = Math.max(1, Math.round(Number(effect.options?.cost) || 1));
      if (!players.canAfford(currentPlayer, { aomomoFossils: cost })) {
        if (effect.options?.optional !== false) {
          return finishAutomaticRewardEffect(effect, {
            ok: true,
            undoable: true,
            message: `${effect.label}：没有足够化石，已跳过`,
          });
        }
        rocketState.statusNote = `化石不足：需要 ${cost} 化石`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(effect.label);
      players.spendResources(currentPlayer, { aomomoFossils: cost });
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复奥陌陌移动登陆前玩家状态",
      ));
      insertActionEffectsAfterCurrent([
        {
          id: `${effect.id || "aomomo"}-move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          playerId: currentPlayer?.id || null,
          playerColor: currentPlayer?.color || null,
          label: "奥陌陌：2移动",
          icon: "movement",
          options: { movementPoints: Math.max(1, Math.round(Number(effect.options?.movement) || 2)) },
        },
        {
          id: `${effect.id || "aomomo"}-land`,
          type: "aomomo_land_only",
          playerId: currentPlayer?.id || null,
          playerColor: currentPlayer?.color || null,
          label: "奥陌陌：登陆",
          icon: "land",
          options: { skipCost: true },
        },
      ]);
      effect.result = {
        ok: true,
        undoable: true,
        message: `${effect.label}：支付${cost}化石，追加2移动与登陆`,
      };
      rocketState.statusNote = effect.result.message;
      renderPlayerStats();
      completeCurrentActionEffect();
      renderStateReadout();
      return effect.result;
    }

    function executeAomomoSpendFossilsScoreEffect(effect) {
      const currentPlayer = getCurrentPlayer();
      const cost = Math.max(0, Math.round(Number(effect.options?.cost) || 0));
      const score = Math.max(0, Math.round(Number(effect.options?.score) || 0));
      if (!players.canAfford(currentPlayer, { aomomoFossils: cost })) {
        rocketState.statusNote = `化石不足：需要 ${cost} 化石`;
        renderStateReadout();
        return { ok: false, message: rocketState.statusNote };
      }
      const beforePlayer = structuredClone(currentPlayer);
      beginEffectHistoryStep(effect.label);
      if (cost > 0) players.spendResources(currentPlayer, { aomomoFossils: cost });
      if (score > 0) {
        players.gainResources(currentPlayer, { score });
        addPlayerScoreSource(currentPlayer, SCORE_SOURCE_KEYS.ALIEN_EFFECT, score);
      }
      recordHistoryCommand(historyCommands.createRestorePlayerCommand(
        currentPlayer,
        beforePlayer,
        "恢复奥陌陌化石得分前玩家状态",
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：支付${cost}化石，获得${score}分`,
      });
    }

    return {
      countYichangdianAnomalySignals,
      executeYichangdianAnomalySignalScoreEffect,
      executeYichangdianNextAnomalyRewardEffect,
      resolveYichangdianNextAnomalyFromCurrentEarth,
      executeYichangdianPublicAllEffect,
      executeYichangdianAlienTraceEffect,
      executeYichangdianNextAnomalyScanEffect,
      applyYichangdianDiscardActionReward,
      executeYichangdianDrawThenTwoCornersEffect,
      getPendingYichangdianCornerCards,
      formatYichangdianCornerChoiceReward,
      openYichangdianCornerPicker,
      handleYichangdianCornerChoice,
      executeYichangdianLaunchAnomalyMoveEffect,
      findChongProbeFossilPlanet,
      listChongRewardFossilsAtPlacement,
      getChongLandProbeOptions,
      getChongPickupPlanetIds,
      isChongPickupPlanetId,
      listChongTravelChoices,
      normalizeChongChoiceOptions,
      getChongLandOptions,
      getChongOrbitOrLandOptions,
      openChongLandTargetPicker,
      openChongOrbitOrLandTargetPicker,
      executeChongTravelForPickupEffect,
      executeChongTravelForPickupChoice,
      executeChongTravelForPickupWithLandTarget,
      executeChongPickupFossilEffect,
      executeChongProbePlanetFossilRewardEffect,
      executeChongChoosePlanetFossilRewardEffect,
      getPriorActionEffectFlowIrreversible,
      executeChongTaskCleanupEffect,
      applyAomomoScanCostAndBonus,
      openAomomoCurrentXScanEffect,
      executeAomomoGainFossilsEffect,
      executeAomomoVisitThisTurnFossilEffect,
      executeAomomoFossilForDataEffect,
      openAomomoFossilAnyScanEffect,
      executeAomomoLandEffect,
      executeAomomoFossilMoveAndLandEffect,
      executeAomomoSpendFossilsScoreEffect,
    };
  }

  return { createEffectAlienExecutors };
});
