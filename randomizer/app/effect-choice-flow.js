(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppEffectChoiceFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createEffectChoiceFlowHelpers requires function: ${name}`);
    }
    return fn;
  }

  function createEffectChoiceFlowHelpers(context = {}) {
    const documentRef = context.document || null;
    const getActionEffectFlow = (workingRoot) => requireWorkingRoot(workingRoot).match?.actionEffectFlow || null;
    const els = context.els || {};
    const requireWorkingRoot = (workingRoot) => {
      if (!workingRoot?.playerState || !workingRoot?.rocketState) {
        throw new TypeError("Effect choice method requires Composition workingRoot");
      }
      return workingRoot;
    };
    const ruleRocketState = (workingRoot) => requireWorkingRoot(workingRoot).rocketState;
    const ruleCardState = (workingRoot) => requireWorkingRoot(workingRoot).cardState;
    const rulePlayerState = (workingRoot) => requireWorkingRoot(workingRoot).playerState;
    const ruleNebulaDataState = (workingRoot) => requireWorkingRoot(workingRoot).nebulaDataState;
    const rulePlanetStatsState = (workingRoot) => requireWorkingRoot(workingRoot).planetStatsState;
    const getScanTargetContinuation = (workingRoot) => requireWorkingRoot(workingRoot).match?.scanTargetContinuation || null;
    function setScanTargetContinuation(workingRoot, continuation) {
      const activeRoot = requireWorkingRoot(workingRoot);
      if (!continuation) delete activeRoot.match.scanTargetContinuation;
      else activeRoot.match.scanTargetContinuation = structuredClone(continuation);
      return activeRoot.match.scanTargetContinuation || null;
    }
    const getProbeSectorScanSession = (workingRoot) => requireWorkingRoot(workingRoot).match?.probeSectorScanContinuation || null;
    const getProbeLocationRewardSession = (workingRoot) => requireWorkingRoot(workingRoot).match?.probeLocationRewardContinuation || null;
    function setProbeContinuation(workingRoot, field, continuation) {
      const activeRoot = requireWorkingRoot(workingRoot);
      if (!continuation) {
        delete activeRoot.match[field];
        return null;
      }
      activeRoot.match[field] = structuredClone(continuation);
      return activeRoot.match[field];
    }
    const cards = context.cards || {};
    const players = context.players || {};
    const data = context.data || {};
    const solar = context.solar || {};
    const rocketActions = context.rocketActions || {};
    const planetStats = context.planetStats || {};
    const planetReferenceLayout = context.planetReferenceLayout || {};
    const planetRewards = context.planetRewards || {};
    const cardEffects = context.cardEffects || {};
    const historyCommands = context.historyCommands || {};
    const aomomo = context.aomomo || null;
    const endGameScoring = context.endGameScoring || {};
    const SCORE_SOURCE_KEYS = context.SCORE_SOURCE_KEYS || {};

    const getCurrentPlayer = requireFunction("getCurrentPlayer", context.getCurrentPlayer);
    const getEffectOwnerPlayer = requireFunction("getEffectOwnerPlayer", context.getEffectOwnerPlayer);
    const getExplicitEffectOwnerPlayer = requireFunction("getExplicitEffectOwnerPlayer", context.getExplicitEffectOwnerPlayer);
    const getPendingOwnerFields = requireFunction("getPendingOwnerFields", context.getPendingOwnerFields);
    const getPendingOwnerPlayer = requireFunction("getPendingOwnerPlayer", context.getPendingOwnerPlayer);
    const withPendingOwnerPlayer = requireFunction("withPendingOwnerPlayer", context.withPendingOwnerPlayer);
    const closeScanTargetPicker = requireFunction("closeScanTargetPicker", context.closeScanTargetPicker);
    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const renderPlayerHand = requireFunction("renderPlayerHand", context.renderPlayerHand);
    const renderPlayerStats = requireFunction("renderPlayerStats", context.renderPlayerStats);
    const renderReservedCards = requireFunction(
      "renderReservedCards",
      context.renderReservedCards,
    );
    const renderRockets = requireFunction("renderRockets", context.renderRockets);
    const syncPlanetOrbitLandMarkers = requireFunction(
      "syncPlanetOrbitLandMarkers",
      context.syncPlanetOrbitLandMarkers,
    );
    const renderActionEffectBar = requireFunction("renderActionEffectBar", context.renderActionEffectBar);
    const beginEffectHistoryStep = requireFunction("beginEffectHistoryStep", context.beginEffectHistoryStep);
    const endEffectHistoryStep = requireFunction("endEffectHistoryStep", context.endEffectHistoryStep);
    const recordHistoryCommand = requireFunction("recordHistoryCommand", context.recordHistoryCommand);
    const finishAutomaticRewardEffect = requireFunction("finishAutomaticRewardEffect", context.finishAutomaticRewardEffect);
    const insertActionEffectsAfterCurrent = requireFunction("insertActionEffectsAfterCurrent", context.insertActionEffectsAfterCurrent);
    const completeCurrentActionEffect = requireFunction("completeCurrentActionEffect", context.completeCurrentActionEffect);
    const executeSectorXScanEffect = requireFunction("executeSectorXScanEffect", context.executeSectorXScanEffect);
    const buildSectorScanChoicesForX = requireFunction("buildSectorScanChoicesForX", context.buildSectorScanChoicesForX);
    const getSectorScanTargetLabel = requireFunction("getSectorScanTargetLabel", context.getSectorScanTargetLabel);
    const normalizeResourceCost = requireFunction("normalizeResourceCost", context.normalizeResourceCost);
    const formatIncomeGain = requireFunction("formatIncomeGain", context.formatIncomeGain);
    const applyIncomeFromCard = requireFunction("applyIncomeFromCard", context.applyIncomeFromCard);
    const recordScoreSourceForGainEffect = requireFunction("recordScoreSourceForGainEffect", context.recordScoreSourceForGainEffect);
    const addPlayerScoreSource = requireFunction("addPlayerScoreSource", context.addPlayerScoreSource);
    const addScoreSourceFromGain = requireFunction("addScoreSourceFromGain", context.addScoreSourceFromGain);
    const beginCardSelection = requireFunction("beginCardSelection", context.beginCardSelection);
    const beginDiscardSelection = requireFunction("beginDiscardSelection", context.beginDiscardSelection);
    const restoreObjectSnapshot = requireFunction("restoreObjectSnapshot", context.restoreObjectSnapshot);
    const applyCardCornerRewardFromCard = requireFunction("applyCardCornerRewardFromCard", context.applyCardCornerRewardFromCard);
    const buildRepeatedCardCornerMoveEffect = requireFunction("buildRepeatedCardCornerMoveEffect", context.buildRepeatedCardCornerMoveEffect);
    const formatRepeatedCardCornerMoveReward = requireFunction("formatRepeatedCardCornerMoveReward", context.formatRepeatedCardCornerMoveReward);
    const buildPlutoMarkerRemovalChoices = requireFunction("buildPlutoMarkerRemovalChoices", context.buildPlutoMarkerRemovalChoices);
    const removePlutoMarker = requireFunction("removePlutoMarker", context.removePlutoMarker);
    const getPlanetSectorCoordinate = requireFunction("getPlanetSectorCoordinate", context.getPlanetSectorCoordinate);
    const restoreMutableObject = requireFunction("restoreMutableObject", context.restoreMutableObject);
    const getSectorContentForMove = requireFunction("getSectorContentForMove", context.getSectorContentForMove);
    const isAsteroidContent = requireFunction("isAsteroidContent", context.isAsteroidContent);

    function createButton() {
      if (documentRef?.createElement) {
        return documentRef.createElement("button");
      }
      return {
        type: "button",
        className: "",
        dataset: {},
        disabled: false,
        hidden: false,
        title: "",
        innerHTML: "",
        textContent: "",
        classList: { toggle() {} },
      };
    }

    function setOverlayContent(title, subtitle, showCancel = true) {
      if (els.scanTargetTitle) els.scanTargetTitle.textContent = title || "";
      if (els.scanTargetSubtitle) els.scanTargetSubtitle.textContent = subtitle || "";
      if (els.scanTargetCancel) els.scanTargetCancel.hidden = !showCancel;
    }

    function openOverlayWithButtons(buttons) {
      if (!els.scanTargetOverlay || !els.scanTargetActions) return false;
      els.scanTargetActions.replaceChildren(...buttons);
      els.scanTargetOverlay.hidden = false;
      return true;
    }

    function signalOwnerMatches(item, player) {
      const keys = getPlayerOwnerKeys(player);
      return keys.has(item?.replacedByPlayerId)
        || keys.has(item?.playerId)
        || keys.has(item?.replacedByPlayerColor)
        || keys.has(item?.playerColor);
    }

    function countPlayerSignalsInNebula(workingRoot, player, nebulaId) {
      let count = data.listNebulaTokens(ruleNebulaDataState(workingRoot), nebulaId)
        .filter((token) => signalOwnerMatches(token, player))
        .length;
      if (typeof data.listSectorExtraMarks === "function") {
        count += data.listSectorExtraMarks(ruleNebulaDataState(workingRoot), nebulaId)
          .filter((mark) => signalOwnerMatches(mark, player))
          .length;
      }
      return count;
    }

    function countPlayerSignalsInSectorX(workingRoot, player, sectorX) {
      return buildSectorScanChoicesForX(sectorX)
        .filter((choice) => choice.nebulaId)
        .reduce((total, choice) => total + countPlayerSignalsInNebula(workingRoot, player, choice.nebulaId), 0);
    }

    function getSectorXsMatchingCondition(workingRoot, condition, player = players.getCurrentPlayer(workingRoot.playerState)) {
      return cardEffects.getMatchingConditionalSectorXs(
        condition,
        Array.from({ length: 8 }, (_item, x) => x),
        (sectorX) => countPlayerSignalsInSectorX(workingRoot, player, sectorX),
      );
    }

    function sectorXHasAvailableScanTarget(sectorX) {
      return buildSectorScanChoicesForX(solar.mod8(Number(sectorX) || 0))
        .some((choice) => choice.nebulaId && !choice.disabled);
    }

    function executeConditionalSectorScanEffect(workingRoot, effect) {
      const player = getEffectOwnerPlayer(workingRoot, effect) || players.getCurrentPlayer(workingRoot.playerState);
      const xs = getSectorXsMatchingCondition(workingRoot, effect.options?.condition, player)
        .filter(sectorXHasAvailableScanTarget);
      if (!xs.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有符合条件的扇区，已跳过`,
          payload: { sectorXs: [] },
        });
      }
      const repeat = Math.max(1, Math.round(Number(effect.options?.cornerRepeat || effect.options?.repeat || 1)));
      if (effect.options?.allMatching) {
        const followups = xs.map((sectorX) => ({
          id: `${effect.id || "conditional-sector-scan"}-${sectorX}`,
          type: cardEffects.EFFECT_TYPES.SECTOR_X_SCAN,
          label: `${effect.label}：扇区${sectorX}`,
          icon: "scan",
          options: { sectorX, gainData: effect.options?.gainData, skipIfNoTarget: true },
        }));
        insertActionEffectsAfterCurrent(followups);
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：已追加 ${followups.length} 次扫描`,
          payload: { sectorXs: xs },
        });
      }
      if (xs.length === 1) {
        const followups = [];
        for (let index = 0; index < repeat; index += 1) {
          followups.push({
            id: `${effect.id || "conditional-sector-scan"}-${xs[0]}-${index + 1}`,
            type: cardEffects.EFFECT_TYPES.SECTOR_X_SCAN,
            label: `${effect.label}：扇区${xs[0]} ${index + 1}/${repeat}`,
            icon: "scan",
            options: { sectorX: xs[0], gainData: effect.options?.gainData, skipIfNoTarget: true },
          });
        }
        insertActionEffectsAfterCurrent(followups);
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：已追加 ${followups.length} 次扫描`,
          payload: { sectorX: xs[0] },
        });
      }
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect, player), type: "conditional_sector_scan", effect, sectorXs: xs });
      setOverlayContent(effect.label, `选择一个符合条件的扇区，随后扫描 ${repeat} 次。`);
      const opened = openOverlayWithButtons(xs.map((sectorX) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.conditionalSectorX = String(sectorX);
        button.innerHTML = `扇区 ${sectorX}<small>自己信号 ${countPlayerSignalsInSectorX(workingRoot, player, sectorX)} 个</small>`;
        return button;
      }));
      if (!opened && !els.scanTargetActions) {
        ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择扇区`;
        return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
      }
      if (!opened) return { ok: false, message: "无法打开条件扇区选择" };
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择扇区`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleConditionalSectorChoice(workingRoot, sectorXValue) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "conditional_sector_scan") return { ok: false, message: "没有待处理的条件扇区扫描" };
      const effect = pending.effect;
      const sectorX = solar.mod8(Number(sectorXValue) || 0);
      if (!pending.sectorXs?.some((candidate) => solar.mod8(Number(candidate) || 0) === sectorX)) {
        ruleRocketState(workingRoot).statusNote = "所选扇区不符合当前条件";
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(workingRoot, pending, () => {
        const repeat = Math.max(1, Math.round(Number(effect.options?.repeat || 1)));
        const followups = [];
        for (let index = 0; index < repeat; index += 1) {
          followups.push({
            id: `${effect.id || "conditional-sector-scan"}-${sectorX}-${index + 1}`,
            type: cardEffects.EFFECT_TYPES.SECTOR_X_SCAN,
            label: `${effect.label}：扇区${sectorX} ${index + 1}/${repeat}`,
            icon: "scan",
            options: { sectorX, gainData: effect.options?.gainData, skipIfNoTarget: true },
          });
        }
        insertActionEffectsAfterCurrent(followups);
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：已追加 ${followups.length} 次扫描`,
          payload: { sectorX },
        });
      });
    }

    function renderDiscardIncomePicker(workingRoot) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "discard_any_income" || !els.scanTargetActions) return;
      const selected = new Set(uiRuntimeState.discardIncomeSelectedCardIds || []);
      const currentPlayer = getPendingOwnerPlayer(workingRoot, pending, pending.effect);
      const buttons = (currentPlayer?.hand || []).map((card) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.classList.toggle("is-selected", selected.has(card.id));
        button.dataset.discardIncomeCardId = card.id;
        const gain = cards.getIncomeGainForCard(card);
        button.innerHTML = `${cards.getCardLabel(card)}<small>${gain ? formatIncomeGain(gain) : "无收入图标"}</small>`;
        return button;
      });
      const confirm = createButton();
      confirm.type = "button";
      confirm.className = "scan-target-option-button";
      confirm.dataset.discardIncomeConfirm = "true";
      confirm.innerHTML = `确认<small>已选 ${selected.size} 张</small>`;
      buttons.push(confirm);
      els.scanTargetActions.replaceChildren(...buttons);
    }

    function executeDiscardAnyForIncomeEffect(workingRoot, effect) {
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      if (!currentPlayer?.hand?.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：没有手牌可弃，已跳过`,
        });
      }
      uiRuntimeState.discardIncomeSelectedCardIds = [];
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect), type: "discard_any_income", effect });
      setOverlayContent(effect.label, "选择任意数量手牌，确认后弃掉并逐张结算收入图标。");
      renderDiscardIncomePicker(workingRoot);
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = false;
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择要弃掉的手牌`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleDiscardIncomeCardChoice(workingRoot, cardId) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "discard_any_income") return { ok: false, message: "没有待处理的收入弃牌" };
      const selected = uiRuntimeState.discardIncomeSelectedCardIds || [];
      const existingIndex = selected.indexOf(cardId);
      if (existingIndex >= 0) selected.splice(existingIndex, 1);
      else selected.push(cardId);
      uiRuntimeState.discardIncomeSelectedCardIds = selected;
      renderDiscardIncomePicker(workingRoot);
      return { ok: true, message: `已选择 ${selected.length} 张` };
    }

    function confirmDiscardAnyForIncome(workingRoot) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "discard_any_income") return { ok: false, message: "没有待确认的收入弃牌" };
      const effect = pending.effect;
      const selected = new Set(uiRuntimeState.discardIncomeSelectedCardIds || []);
      uiRuntimeState.discardIncomeSelectedCardIds = [];
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(workingRoot, pending, () => {
        const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
        beginEffectHistoryStep(workingRoot, effect.label);
        const beforePlayer = structuredClone(currentPlayer);
        const beforeCardState = {
          publicCards: ruleCardState(workingRoot).publicCards.slice(),
          discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
        };
        const discarded = [];
        let irreversible = null;
        for (let index = (currentPlayer.hand || []).length - 1; index >= 0; index -= 1) {
          if (!selected.has(currentPlayer.hand[index].id)) continue;
          const result = cards.discardFromHandAtIndex(currentPlayer, index);
          if (result.ok) {
            cards.addToDiscardPile(ruleCardState(workingRoot), result.card);
            discarded.push(result.card);
            const incomeResult = applyIncomeFromCard(currentPlayer, result.card);
            if (incomeResult.irreversible) irreversible = incomeResult.irreversible;
          }
        }
        recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复任意弃牌收入前玩家状态",
        ));
        recordHistoryCommand(workingRoot, historyCommands.createRestorePublicCardsCommand(
          ruleCardState(workingRoot),
          beforeCardState.publicCards,
          beforeCardState.discardPile,
        ));
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: !irreversible,
          irreversible,
          message: `${effect.label}：弃掉 ${discarded.length} 张手牌`,
          payload: { discardedCount: discarded.length },
        }, [renderPlayerHand]);
      });
    }

    function expandPayCreditsForRewardEffect(workingRoot, effect) {
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const count = Math.max(0, Math.round(Number(currentPlayer?.resources?.credits) || 0));
      if (count <= 0) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：没有信用可支付，已跳过`,
        });
      }
      const followups = [];
      for (let index = 0; index < count; index += 1) {
        followups.push({
          ...effect,
          id: `${effect.id || "pay-credit"}-${index + 1}`,
          label: `${effect.label} ${index + 1}/${count}`,
          icon: "credits",
          options: { ...(effect.options || {}), single: true, groupId: effect.id || "pay-credit" },
        });
      }
      insertActionEffectsAfterCurrent(followups);
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${count} 个可选支付节点`,
        payload: { count },
      });
    }

    function executePayCreditsForRewardEffect(workingRoot, effect) {
      if (!effect.options?.single) return expandPayCreditsForRewardEffect(workingRoot, effect);
      if (!players.canAfford(players.getCurrentPlayer(workingRoot.playerState), { credits: 1 })) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          message: `${effect.label}：信用不足，已跳过`,
        });
      }
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect), type: "pay_credit_reward", effect });
      setOverlayContent(effect.label, "可以支付 1 信用获得奖励，也可以跳过剩余支付节点。");
      const pay = createButton();
      pay.type = "button";
      pay.className = "scan-target-option-button";
      pay.dataset.payCreditChoice = "pay";
      pay.innerHTML = "支付 1 信用<small>获得 2 分和 2 宣传</small>";
      const skip = createButton();
      skip.type = "button";
      skip.className = "scan-target-option-button";
      skip.dataset.payCreditChoice = "skip";
      skip.innerHTML = "跳过剩余<small>不再支付信用</small>";
      openOverlayWithButtons([pay, skip]);
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择支付或跳过`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handlePayCreditChoice(workingRoot, choice) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "pay_credit_reward") return { ok: false, message: "没有待处理的信用支付" };
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(workingRoot, pending, () => {
        if (choice === "skip") {
          if (getActionEffectFlow(workingRoot)) {
            const groupId = effect.options?.groupId;
            getActionEffectFlow(workingRoot).effects = getActionEffectFlow(workingRoot).effects.filter((item) => (
              item.status !== "pending" || item.options?.groupId !== groupId
            ));
          }
          effect.result = { ok: true, skipped: true, message: `${effect.label}：已跳过剩余支付` };
          ruleRocketState(workingRoot).statusNote = effect.result.message;
          completeCurrentActionEffect(workingRoot, "skipped");
          renderStateReadout();
          return effect.result;
        }
        const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
        beginEffectHistoryStep(workingRoot, effect.label);
        const beforePlayer = structuredClone(currentPlayer);
        const spend = players.spendResources(currentPlayer, { credits: 1 });
        if (!spend.ok) {
          endEffectHistoryStep(workingRoot);
          ruleRocketState(workingRoot).statusNote = spend.message;
          renderStateReadout();
          return spend;
        }
        const reward = effect.options?.reward;
        if (reward?.type === "gain_resources") {
          const gain = reward.options?.gain || {};
          players.gainResources(currentPlayer, gain);
          recordScoreSourceForGainEffect(currentPlayer, effect, gain);
        }
        recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复支付信用奖励前玩家状态",
        ));
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：支付1信用，${reward?.label || "获得奖励"}`,
        });
      });
    }

    function getFundamentalismExchangeChoiceSpecs(workingRoot, player = players.getCurrentPlayer(workingRoot.playerState)) {
      const score = Number(player?.resources?.score) || 0;
      const credits = Number(player?.resources?.credits) || 0;
      const energy = Number(player?.resources?.energy) || 0;
      const handCount = Array.isArray(player?.hand) ? player.hand.length : 0;
      const publicCount = Array.isArray(ruleCardState(workingRoot).publicCards) ? ruleCardState(workingRoot).publicCards.length : 0;
      return [
        { id: "score_to_credits", label: "3分换1信用点", description: "消耗3分，获得1信用点", cost: { score: 3 }, gain: { credits: 1 }, disabled: score < 3 },
        { id: "score_to_energy", label: "3分换1能量", description: "消耗3分，获得1能量", cost: { score: 3 }, gain: { energy: 1 }, disabled: score < 3 },
        { id: "score_to_card", label: "3分换1精选", description: "消耗3分，精选1张公共牌", cost: { score: 3 }, pickCard: true, disabled: score < 3 || publicCount <= 0 },
        { id: "credits_to_score", label: "1信用点换3分", description: "消耗1信用点，获得3分", cost: { credits: 1 }, gain: { score: 3 }, disabled: credits < 1 },
        { id: "energy_to_score", label: "1能量换3分", description: "消耗1能量，获得3分", cost: { energy: 1 }, gain: { score: 3 }, disabled: energy < 1 },
        { id: "card_to_score", label: "弃1牌换3分", description: "弃1张手牌，获得3分", discardCard: true, gain: { score: 3 }, disabled: handCount < 1 },
      ];
    }

    function getFundamentalismExchangeChoice(workingRoot, choiceId, player = players.getCurrentPlayer(workingRoot.playerState)) {
      return getFundamentalismExchangeChoiceSpecs(workingRoot, player).find((choice) => choice.id === choiceId) || null;
    }

    function executeIndustryFundamentalismExchangeEffect(workingRoot, effect) {
      const player = getEffectOwnerPlayer(workingRoot, effect);
      const choices = getFundamentalismExchangeChoiceSpecs(workingRoot, player);
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect, player), type: "industry_fundamentalism_exchange", effect });
      setOverlayContent(effect.label || "原教旨主义", "选择一次分数/资源兑换。资源不足的选项不可用。");
      const buttons = choices.map((choice) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.fundamentalismExchange = choice.id;
        button.disabled = Boolean(choice.disabled);
        button.title = choice.disabled ? "当前分数、资源或手牌不足" : "";
        button.innerHTML = `${choice.label}<small>${choice.description}</small>`;
        return button;
      });
      openOverlayWithButtons(buttons);
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择兑换方式`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function formatFundamentalismExchangeCost(cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      const parts = [];
      if (scoreCost) parts.push(`${scoreCost}分`);
      const resourceText = players.formatResourceCost(resourceCost);
      if (resourceText) parts.push(resourceText);
      return parts.join(" + ");
    }

    function canAffordFundamentalismExchangeCost(player, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      if (scoreCost > 0 && (Number(player?.resources?.score) || 0) < scoreCost) return false;
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      return players.canAfford(player, resourceCost);
    }

    function spendFundamentalismExchangeCost(player, cost) {
      const normalizedCost = normalizeResourceCost(cost) || {};
      if (!Object.keys(normalizedCost).length) return { ok: true };
      if (!canAffordFundamentalismExchangeCost(player, normalizedCost)) {
        return { ok: false, message: `资源不足，需要 ${formatFundamentalismExchangeCost(normalizedCost)}` };
      }
      const scoreCost = Math.max(0, Math.round(Number(normalizedCost.score) || 0));
      const resourceCost = { ...normalizedCost };
      delete resourceCost.score;
      if (scoreCost) {
        player.resources.score = (Number(player.resources.score) || 0) - scoreCost;
        addPlayerScoreSource(player, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, -scoreCost);
      }
      if (!Object.keys(resourceCost).length) return { ok: true };
      return players.spendResources(player, resourceCost);
    }

    function completeFundamentalismImmediateExchange(workingRoot, effect, player, choice) {
      beginEffectHistoryStep(workingRoot, effect.label);
      const beforePlayer = structuredClone(player);
      const spend = spendFundamentalismExchangeCost(player, choice.cost);
      if (!spend.ok) {
        endEffectHistoryStep(workingRoot);
        ruleRocketState(workingRoot).statusNote = spend.message;
        renderStateReadout();
        return spend;
      }
      if (choice.gain && Object.keys(choice.gain).length) {
        players.gainResources(player, choice.gain);
        addScoreSourceFromGain(player, SCORE_SOURCE_KEYS.INDUSTRY_EFFECT, choice.gain);
      }
      recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
        player,
        beforePlayer,
        "恢复原教旨主义兑换前玩家状态",
      ));
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `原教旨主义：${choice.label}`,
        payload: { choiceId: choice.id, cost: choice.cost || null, gain: choice.gain || null },
      }, [renderPlayerHand]);
    }

    function startFundamentalismPickExchange(workingRoot, effect, player, choice) {
      const beforePlayer = structuredClone(player);
      const beforeCardState = structuredClone(ruleCardState(workingRoot));
      const spend = spendFundamentalismExchangeCost(player, choice.cost);
      if (!spend.ok) {
        ruleRocketState(workingRoot).statusNote = spend.message;
        renderStateReadout();
        return spend;
      }
      const result = beginCardSelection({
        type: "fundamentalism_exchange_pick",
        player,
        effect,
        effectLabel: effect.label,
        beforePlayerState: beforePlayer,
        beforeCardState,
        choiceId: choice.id,
        allowBlindDraw: false,
        fromEffectFlow: true,
      });
      if (!result.ok) {
        restoreObjectSnapshot(player, beforePlayer);
        restoreObjectSnapshot(ruleCardState(workingRoot), beforeCardState);
        ruleRocketState(workingRoot).statusNote = result.message;
        renderStateReadout();
        return result;
      }
      ruleRocketState(workingRoot).statusNote = `原教旨主义：${choice.label}，请选择公共牌`;
      renderPlayerStats();
      renderStateReadout();
      return result;
    }

    function startFundamentalismDiscardExchange(workingRoot, effect, player) {
      const result = beginDiscardSelection(workingRoot, 1, {
        type: "industry_fundamentalism_score_discard",
        player,
        fromEffectFlow: true,
        effectLabel: effect.label,
        beforePlayerState: structuredClone(player),
        beforeCardState: structuredClone(ruleCardState(workingRoot)),
      });
      if (result.ok) {
        ruleRocketState(workingRoot).statusNote = "原教旨主义：请选择 1 张手牌弃掉换 3 分";
        renderStateReadout();
      }
      return result;
    }

    function handleFundamentalismExchangeChoice(workingRoot, choiceId) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "industry_fundamentalism_exchange") {
        return { ok: false, message: "没有待处理的原教旨主义兑换" };
      }
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(workingRoot, pending, (player) => {
        const choice = getFundamentalismExchangeChoice(workingRoot, choiceId, player);
        if (!choice) return { ok: false, message: "未知兑换方式" };
        if (choice.disabled) {
          ruleRocketState(workingRoot).statusNote = "当前分数、资源或手牌不足，无法执行该兑换";
          renderStateReadout();
          return { ok: false, message: ruleRocketState(workingRoot).statusNote };
        }
        if (choice.pickCard) return startFundamentalismPickExchange(workingRoot, effect, player, choice);
        if (choice.discardCard) return startFundamentalismDiscardExchange(workingRoot, effect, player);
        return completeFundamentalismImmediateExchange(workingRoot, effect, player, choice);
      });
    }

    function isAlienFamilyCard(card) {
      const setText = String(card?.set || "");
      const cardId = String(card?.cardId || "");
      return setText.startsWith("alien:") || /^(aomomo|yichangdian|chong|amiba|jiuzhe|banrenma|fangzhou|runezu)_/.test(cardId);
    }

    function executeDiscardCardCornerRepeatEffect(workingRoot, effect) {
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const choices = (currentPlayer?.hand || [])
        .filter((card) => !effect.options?.excludeAlienCards || !isAlienFamilyCard(card))
        .filter((card) => cards.getDiscardActionRewardForCard(card) || cards.getDiscardActionMoveRewardForCard?.(card));
      if (!choices.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有可弃除并结算角标的非外星人卡，已跳过`,
          payload: { cardIds: [] },
        });
      }
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect), type: "discard_corner_repeat", effect, choices });
      setOverlayContent(effect.label, "选择一张非外星人手牌弃掉，并重复结算其左上角奖励。");
      openOverlayWithButtons(choices.map((card) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.discardCornerCardId = card.id;
        button.innerHTML = `${cards.getCardLabel(card)}<small>${cards.getDiscardActionRewardForCard(card)?.label || cards.getDiscardActionMoveRewardForCard(card)?.label || "角标"}</small>`;
        return button;
      }));
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择手牌`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleDiscardCornerRepeatChoice(workingRoot, cardId) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "discard_corner_repeat") return { ok: false, message: "没有待处理的角标重复弃牌" };
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(workingRoot, pending, () => {
        const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
        const handIndex = (currentPlayer?.hand || []).findIndex((card) => card.id === cardId);
        if (handIndex < 0) return { ok: false, message: "无效手牌" };
        beginEffectHistoryStep(workingRoot, effect.label);
        const beforePlayer = structuredClone(currentPlayer);
        const beforeCardState = {
          publicCards: ruleCardState(workingRoot).publicCards.slice(),
          discardPile: (ruleCardState(workingRoot).discardPile || []).slice(),
        };
        const discard = cards.discardFromHandAtIndex(currentPlayer, handIndex);
        if (!discard.ok) {
          endEffectHistoryStep(workingRoot);
          ruleRocketState(workingRoot).statusNote = discard.message;
          renderStateReadout();
          return discard;
        }
        cards.addToDiscardPile(ruleCardState(workingRoot), discard.card);
        const repeat = Math.max(1, Math.round(Number(effect.options?.cornerRepeat || effect.options?.repeat || 1)));
        const messages = [];
        const moveReward = cards.getDiscardActionMoveRewardForCard?.(discard.card);
        for (let index = 0; index < repeat; index += 1) {
          const reward = applyCardCornerRewardFromCard(currentPlayer, discard.card, {
            source: "card_corner_repeat",
            insertMoveIntoCurrentFlow: !moveReward,
            effectId: `${effect.id || "repeat-corner"}-${index + 1}`,
          });
          if (!moveReward) messages.push(reward.message);
        }
        if (moveReward) {
          insertActionEffectsAfterCurrent([
            buildRepeatedCardCornerMoveEffect(effect, discard.card, moveReward, repeat),
          ]);
          messages.push(formatRepeatedCardCornerMoveReward(moveReward, repeat));
        }
        recordHistoryCommand(workingRoot, historyCommands.createRestorePlayerCommand(
          currentPlayer,
          beforePlayer,
          "恢复重复角标弃牌前玩家状态",
        ));
        recordHistoryCommand(workingRoot, historyCommands.createRestorePublicCardsCommand(
          ruleCardState(workingRoot),
          beforeCardState.publicCards,
          beforeCardState.discardPile,
        ));
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：弃掉 ${cards.getCardLabel(discard.card)}；${messages.join("；")}`,
          payload: { cardId: discard.card.id, repeat },
        }, [renderPlayerHand]);
      });
    }

    function getPlanetName(planetId) {
      return planetRewards?.PLANET_NAMES?.[planetId]
        || solar?.PLANETS?.[planetId]?.name
        || planetId
        || "星球";
    }

    function getPlayerOwnerKeys(player) {
      if (endGameScoring?.getPlayerKeys) return endGameScoring.getPlayerKeys(player);
      return new Set([player?.id, player?.color].filter(Boolean));
    }

    function markerBelongsToPlayer(marker, player) {
      const keys = getPlayerOwnerKeys(player);
      return keys.has(marker?.playerId) || keys.has(marker?.color) || keys.has(marker?.playerColor);
    }

    function buildOwnOrbitChoices(workingRoot) {
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const choices = [];
      const planetIds = planetReferenceLayout.PLANET_ORDER || planetStats.PLANET_IDS || [];
      for (const planetId of planetIds) {
        for (const marker of planetStats.getPlanetOrbitMarkers(rulePlanetStatsState(workingRoot), planetId)) {
          if (!markerBelongsToPlayer(marker, currentPlayer)) continue;
          choices.push({
            id: `${planetId}:${marker.sequence}`,
            planetId,
            sequence: marker.sequence,
            label: `${getPlanetName(planetId)} 环绕 ${marker.sequence}`,
          });
        }
      }
      for (const choice of buildPlutoMarkerRemovalChoices("current", new Set(["orbit"]))) {
        if (choice.sectorX == null || choice.sectorY == null) continue;
        choices.push({
          ...choice,
          id: `pluto:${choice.cardId}:${choice.sequence}`,
          kind: "plutoOrbit",
          label: `${choice.label}`,
        });
      }
      return choices;
    }

    function executeRemoveOrbitToProbeEffect(workingRoot, effect) {
      const choices = buildOwnOrbitChoices(workingRoot);
      if (!choices.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有可移除的己方环绕标记，已跳过`,
          payload: { markerIds: [] },
        });
      }
      setScanTargetContinuation(workingRoot, { ...getPendingOwnerFields(workingRoot, effect), type: "remove_orbit_to_probe", effect, choices });
      setOverlayContent(effect.label, "选择一个己方环绕标记，移除后在该星球当前扇区放置探测器。");
      openOverlayWithButtons(choices.map((choice) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.removeOrbitToProbe = choice.id;
        button.innerHTML = `${choice.label}<small>放置探测器到当前星球扇区</small>`;
        return button;
      }));
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择环绕标记`;
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function handleRemoveOrbitToProbeChoice(workingRoot, choiceId) {
      const pending = getScanTargetContinuation(workingRoot);
      if (pending?.type !== "remove_orbit_to_probe") return { ok: false, message: "没有待处理的环绕移除" };
      const choice = pending.choices.find((item) => item.id === choiceId);
      const effect = pending.effect;
      closeScanTargetPicker(workingRoot);
      if (!choice) return { ok: false, message: "无效环绕标记" };
      return withPendingOwnerPlayer(workingRoot, pending, () => {
        const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
        beginEffectHistoryStep(workingRoot, effect.label);
        const isPlutoChoice = choice.kind === "plutoOrbit";
        const beforePlanetStats = structuredClone(rulePlanetStatsState(workingRoot));
        const beforePlayerState = isPlutoChoice ? structuredClone(rulePlayerState(workingRoot)) : null;
        const beforeRocketState = structuredClone(ruleRocketState(workingRoot));
        const remove = isPlutoChoice
          ? removePlutoMarker(choice, currentPlayer, "current")
          : planetStats.removePlanetOrbitMarker(rulePlanetStatsState(workingRoot), choice.planetId, {
            sequence: choice.sequence,
            player: currentPlayer,
          });
        if (!remove.ok) {
          endEffectHistoryStep(workingRoot);
          ruleRocketState(workingRoot).statusNote = remove.message;
          renderStateReadout();
          return remove;
        }
        const coordinate = isPlutoChoice
          ? { x: choice.sectorX, y: choice.sectorY }
          : getPlanetSectorCoordinate(choice.planetId);
        const place = rocketActions.launchRocketAtSector(ruleRocketState(workingRoot), coordinate, {
          playerId: currentPlayer.id,
          color: currentPlayer.color,
        });
        if (!place.ok) {
          if (isPlutoChoice && beforePlayerState) {
            restoreMutableObject(rulePlayerState(workingRoot), beforePlayerState);
          } else {
            Object.assign(rulePlanetStatsState(workingRoot), beforePlanetStats);
          }
          Object.assign(ruleRocketState(workingRoot), beforeRocketState);
          endEffectHistoryStep(workingRoot);
          ruleRocketState(workingRoot).statusNote = place.message;
          renderStateReadout();
          return place;
        }
        recordHistoryCommand(workingRoot, historyCommands.createRestorePlanetStatsCommand(
          rulePlanetStatsState(workingRoot),
          beforePlanetStats,
          "恢复移除环绕前行星标记",
        ));
        if (isPlutoChoice && beforePlayerState) {
          recordHistoryCommand(workingRoot, historyCommands.createRestoreObjectCommand(
            rulePlayerState(workingRoot),
            beforePlayerState,
            "恢复冥王星轨道标记前玩家状态",
          ));
        }
        recordHistoryCommand(workingRoot, historyCommands.createRestoreRocketStateCommand(
          ruleRocketState(workingRoot),
          beforeRocketState,
          "恢复移除环绕前探测器状态",
        ));
        renderRockets();
        syncPlanetOrbitLandMarkers();
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：${choice.label} -> ${place.message}`,
          payload: { choice, rocketId: place.rocket?.id || null },
        }, [renderReservedCards]);
      });
    }

    function getProbeSectorScanRockets(workingRoot, effect) {
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const owner = effect.options?.owner || "current";
      return (ruleRocketState(workingRoot).rockets || [])
        .filter((rocket) => owner === "any" || rocket.playerId === currentPlayer?.id)
        .map((rocket) => ({ rocket, sector: rocketActions.getRocketSectorCoordinate(rocket) }))
        .filter((entry) => entry.sector)
        .sort((left, right) => Number(left.rocket.id) - Number(right.rocket.id));
    }

    function buildSectorScanEffectsForProbe(effect, rocket) {
      const sector = rocketActions.getRocketSectorCoordinate(rocket);
      if (!sector) return [];
      const xs = effect.options?.includeAdjacent
        ? [sector.x - 1, sector.x, sector.x + 1].map((x) => solar.mod8(x))
        : [solar.mod8(sector.x)];
      const repeat = Math.max(1, Math.round(Number(effect.options?.repeat) || 1));
      const effects = [];
      for (const sectorX of xs) {
        for (let index = 0; index < repeat; index += 1) {
          const sectorLabel = getSectorScanTargetLabel(sectorX);
          effects.push({
            id: `${effect.id || "probe-sector-scan"}-${rocket.id}-${sectorX}-${index + 1}`,
            type: cardEffects.EFFECT_TYPES.SECTOR_X_SCAN,
            label: `${effect.label}：${sectorLabel}${repeat > 1 ? ` ${index + 1}/${repeat}` : ""}`,
            icon: "scan",
            options: {
              sectorX,
              gainData: effect.options?.gainData,
              returnToHandIfSignalCount: effect.options?.returnToHandIfSignalCount,
            },
          });
        }
      }
      return effects;
    }

    function queueProbeSectorScanEffects(workingRoot, effect, selectedRockets) {
      const scanEffectsToInsert = [];
      for (const rocket of selectedRockets || []) {
        scanEffectsToInsert.push(...buildSectorScanEffectsForProbe(effect, rocket));
      }
      if (!scanEffectsToInsert.length) {
        ruleRocketState(workingRoot).statusNote = `${effect.label}：没有可扫描的探测器扇区`;
        renderStateReadout();
        return { ok: false, message: ruleRocketState(workingRoot).statusNote };
      }
      if (scanEffectsToInsert.length === 1) {
        return executeSectorXScanEffect(scanEffectsToInsert[0]);
      }
      insertActionEffectsAfterCurrent(scanEffectsToInsert);
      effect.result = {
        ok: true,
        undoable: true,
        message: `${effect.label}：已追加 ${scanEffectsToInsert.length} 个扇区扫描`,
        payload: { count: scanEffectsToInsert.length },
      };
      ruleRocketState(workingRoot).statusNote = effect.result.message;
      completeCurrentActionEffect(workingRoot);
      renderActionEffectBar();
      renderStateReadout();
      return effect.result;
    }

    function renderProbeSectorScanPicker(workingRoot) {
      const pending = getProbeSectorScanSession(workingRoot);
      if (!pending || !els.scanTargetActions) return;
      const selected = new Set(context.uiRuntimeState?.probeSectorSelectedRocketIds || []);
      const maxTargets = Math.max(1, Math.round(Number(pending.effect.options?.maxTargets) || 1));
      const buttons = pending.choices.map(({ rocket, sector }) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.probeScanRocketId = String(rocket.id);
        const active = selected.has(rocket.id);
        button.classList.toggle("is-selected", active);
        button.innerHTML = `${getSectorScanTargetLabel(sector.x)}<small>${active ? "已选择" : "点击选择该扇区"}</small>`;
        return button;
      });
      if (maxTargets > 1) {
        const confirm = createButton();
        confirm.type = "button";
        confirm.className = "scan-target-option-button";
        confirm.dataset.probeScanConfirm = "true";
        confirm.disabled = selected.size === 0;
        confirm.innerHTML = `确认扫描<small>已选 ${selected.size}/${maxTargets}</small>`;
        buttons.push(confirm);
      }
      els.scanTargetActions.replaceChildren(...buttons);
    }

    function openProbeSectorScanPicker(workingRoot, effect, choices) {
      setProbeContinuation(workingRoot, "probeSectorScanContinuation", {
        ...getPendingOwnerFields(workingRoot, effect),
        effect,
        choices,
      });
      context.uiRuntimeState.probeSectorSelectedRocketIds = [];
      setOverlayContent(effect.label, "请选择要扫描扇区的探测器", false);
      renderProbeSectorScanPicker(workingRoot);
      if (els.scanTargetOverlay) els.scanTargetOverlay.hidden = false;
      return { ok: true, pendingChoice: true, message: effect.label };
    }

    function executeProbeSectorScanEffect(workingRoot, effect) {
      const choices = getProbeSectorScanRockets(workingRoot, effect);
      if (!choices.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          skipped: true,
          undoable: true,
          message: `${effect.label}：没有位于太阳系扇区的合法探测器，已跳过`,
          payload: { rocketIds: [] },
        });
      }
      const maxTargets = Math.max(1, Math.round(Number(effect.options?.maxTargets) || 1));
      if (choices.length === 1 && maxTargets === 1) {
        return queueProbeSectorScanEffects(workingRoot, effect, [choices[0].rocket]);
      }
      return openProbeSectorScanPicker(workingRoot, effect, choices);
    }

    function handleProbeSectorScanChoice(workingRoot, rocketId) {
      const pending = getProbeSectorScanSession(workingRoot);
      if (!pending) return { ok: false, message: "没有待处理的探测器扫描" };
      const id = Number(rocketId);
      const choice = pending.choices.find((item) => Number(item.rocket.id) === id);
      if (!choice) return { ok: false, message: "无效探测器" };
      const maxTargets = Math.max(1, Math.round(Number(pending.effect.options?.maxTargets) || 1));
      if (maxTargets === 1) {
        const effect = pending.effect;
        setProbeContinuation(workingRoot, "probeSectorScanContinuation", null);
        context.uiRuntimeState.probeSectorSelectedRocketIds = [];
        closeScanTargetPicker(workingRoot);
        return withPendingOwnerPlayer(workingRoot, pending, () => queueProbeSectorScanEffects(workingRoot, effect, [choice.rocket]));
      }
      const selected = context.uiRuntimeState.probeSectorSelectedRocketIds || [];
      const existingIndex = selected.indexOf(choice.rocket.id);
      if (existingIndex >= 0) selected.splice(existingIndex, 1);
      else if (selected.length < maxTargets) selected.push(choice.rocket.id);
      context.uiRuntimeState.probeSectorSelectedRocketIds = selected;
      renderProbeSectorScanPicker(workingRoot);
      return { ok: true, message: `已选择 ${selected.length}/${maxTargets}` };
    }

    function confirmProbeSectorScanSelection(workingRoot, rocketIds = null, pendingContext = null) {
      const pending = pendingContext || getProbeSectorScanSession(workingRoot);
      if (!pending) return { ok: false, message: "没有待确认的探测器扫描" };
      const selected = new Set(rocketIds || []);
      const rockets = pending.choices
        .filter((choice) => selected.has(choice.rocket.id))
        .map((choice) => choice.rocket);
      const effect = pending.effect;
      setProbeContinuation(workingRoot, "probeSectorScanContinuation", null);
      context.uiRuntimeState.probeSectorSelectedRocketIds = [];
      closeScanTargetPicker(workingRoot);
      return withPendingOwnerPlayer(workingRoot, pending, () => queueProbeSectorScanEffects(workingRoot, effect, rockets));
    }

    function computeProbeLocationReward(effect, rocket) {
      const sector = rocketActions.getRocketSectorCoordinate(rocket);
      if (!sector) return { dataCount: 0, asteroid: false, adjacentAsteroids: 0 };
      const content = getSectorContentForMove(sector);
      const asteroid = isAsteroidContent(content);
      const adjacentAsteroids = [-1, 1].reduce((total, dx) => {
        const adjacent = { x: solar.mod8(sector.x + dx), y: sector.y };
        return total + (isAsteroidContent(getSectorContentForMove(adjacent)) ? 1 : 0);
      }, 0);
      const dataCount = (asteroid ? Math.max(0, Number(effect.options?.asteroidData) || 0) : 0)
        + adjacentAsteroids * Math.max(0, Number(effect.options?.adjacentAsteroidData) || 0);
      return { dataCount, asteroid, adjacentAsteroids };
    }

    function finishProbeLocationReward(workingRoot, effect, rocket) {
      const currentPlayer = getExplicitEffectOwnerPlayer(workingRoot, effect) || players.getCurrentPlayer(workingRoot.playerState);
      const reward = computeProbeLocationReward(effect, rocket);
      beginEffectHistoryStep(workingRoot, effect.label);
      const results = [];
      for (let index = 0; index < reward.dataCount; index += 1) {
        const gainResult = data.gainData(currentPlayer, { source: "probeLocationReward" });
        results.push(gainResult);
        recordHistoryCommand(workingRoot, historyCommands.createGainDataCommand(currentPlayer, gainResult));
      }
      return finishAutomaticRewardEffect(effect, {
        ok: true,
        undoable: true,
        message: `${effect.label}：获得 ${results.filter((item) => item.ok).length}/${reward.dataCount} 数据`,
        payload: { rocketId: rocket?.id, reward, results },
      });
    }

    function openProbeLocationRewardPicker(workingRoot, effect, choices) {
      setProbeContinuation(workingRoot, "probeLocationRewardContinuation", { ...getPendingOwnerFields(workingRoot, effect), effect, choices });
      ruleRocketState(workingRoot).statusNote = `${effect.label}：请选择探测器`;
      const buttons = choices.map(({ rocket }) => {
        const button = createButton();
        button.type = "button";
        button.className = "scan-target-option-button";
        button.dataset.probeLocationRewardRocketId = String(rocket.id);
        button.innerHTML = `探测器 R${rocket.id}<small>结算当前位置奖励</small>`;
        return button;
      });
      setOverlayContent(effect.label, "请选择要结算位置奖励的探测器", false);
      openOverlayWithButtons(buttons);
      renderStateReadout();
      return { ok: true, pendingChoice: true, message: ruleRocketState(workingRoot).statusNote };
    }

    function executeProbeLocationRewardEffect(workingRoot, effect) {
      const currentPlayer = players.getCurrentPlayer(workingRoot.playerState);
      const choices = (ruleRocketState(workingRoot).rockets || [])
        .filter((rocket) => rocket.playerId === currentPlayer?.id)
        .filter((rocket) => rocketActions.getRocketSectorCoordinate(rocket))
        .map((rocket) => ({ rocket }));
      if (!choices.length) {
        return finishAutomaticRewardEffect(effect, {
          ok: true,
          undoable: true,
          message: `${effect.label}：没有己方探测器`,
          payload: { count: 0 },
        });
      }
      if (choices.length === 1) return finishProbeLocationReward(workingRoot, effect, choices[0].rocket);
      return openProbeLocationRewardPicker(workingRoot, effect, choices);
    }

    function handleProbeLocationRewardChoice(workingRoot, rocketId, pendingContext = null) {
      const pending = pendingContext || getProbeLocationRewardSession(workingRoot);
      if (!pending) return { ok: false, message: "没有待处理的探测器位置奖励" };
      const rocket = (pending.choices || []).find((choice) => Number(choice.rocket.id) === Number(rocketId))?.rocket;
      const effect = pending.effect;
      setProbeContinuation(workingRoot, "probeLocationRewardContinuation", null);
      closeScanTargetPicker(workingRoot);
      if (!rocket) return { ok: false, message: "无效探测器" };
      return withPendingOwnerPlayer(workingRoot, pending, () => finishProbeLocationReward(workingRoot, effect, rocket));
    }

    return {
      executeConditionalSectorScanEffect,
      handleConditionalSectorChoice,
      renderDiscardIncomePicker,
      executeDiscardAnyForIncomeEffect,
      handleDiscardIncomeCardChoice,
      confirmDiscardAnyForIncome,
      executePayCreditsForRewardEffect,
      handlePayCreditChoice,
      executeIndustryFundamentalismExchangeEffect,
      handleFundamentalismExchangeChoice,
      executeDiscardCardCornerRepeatEffect,
      handleDiscardCornerRepeatChoice,
      executeRemoveOrbitToProbeEffect,
      handleRemoveOrbitToProbeChoice,
      executeProbeSectorScanEffect,
      handleProbeSectorScanChoice,
      confirmProbeSectorScanSelection,
      executeProbeLocationRewardEffect,
      handleProbeLocationRewardChoice,
    };
  }

  return {
    createEffectChoiceFlowHelpers,
  };
});
