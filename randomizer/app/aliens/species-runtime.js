(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiAppAlienSpeciesRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const RENDER_METHODS = Object.freeze([
    "renderJiuzheThresholds", "renderYichangdianCardDisplays", "renderBanrenmaScoremarks",
    "renderBanrenmaCardDisplays", "renderChongCardDisplays", "renderAmibaCardDisplays",
    "renderAomomoCardDisplays", "renderRunezuCardDisplays", "renderBanrenmaBonusMarkers",
    "renderFangzhouCardDisplays", "renderAlienPanels", "alignAlienPanelsToPlanets",
  ]);
  const INPUT_METHODS = Object.freeze([
    "confirmFangzhouCard2Unlock", "openRunezuCardGainDialog", "finishRunezuCardGain",
    "handleRunezuCardGainChoice", "openAmibaCardGainDialog", "finishAmibaCardGain",
    "handleAmibaCardGainChoice", "openAomomoCardGainDialog", "finishAomomoCardGain",
    "handleAomomoCardGainChoice", "openAmibaSymbolChoiceDialog", "finishAmibaSymbolChoice",
    "handleAmibaSymbolChoice", "openAmibaTraceRemovalDialog", "handleAmibaTraceRemovalChoice",
    "openYichangdianCardGainDialog", "finishYichangdianCardGain",
    "handleYichangdianCardGainChoice", "openBanrenmaCardGainDialog",
    "finishBanrenmaCardGain", "handleBanrenmaCardGainChoice", "openChongCardGainDialog",
    "finishChongCardGain", "handleChongCardGainChoice", "openChongFossilChoiceDialog",
    "handleChongFossilChoice", "openJiuzheCardDialog", "handleJiuzheCardChoice",
    "handleJiuzheOpportunitySkip", "openBanrenmaCardConditionCompletionPicker",
    "openBanrenmaOpportunityDialog", "handleBanrenmaBonusChoice",
    "handleBanrenmaCardConditionChoice", "openRunezuFaceSymbolPlacement",
    "handleRunezuFaceSymbolChoice", "openRunezuSymbolBranchDialog",
    "handleRunezuSymbolBranchChoice",
  ]);
  const BROWSER_INPUT_NAMES = Object.freeze([...INPUT_METHODS]);
  const PROJECTION_METHODS = Object.freeze([
    "getPendingChongFossilChoice", "getPendingAmibaSymbolChoice",
    "getPendingRunezuSymbolBranch", "getPendingRunezuFaceSymbolPlacement",
    "getPendingRunezuCardGain", "getPendingAmibaCardGain", "getPendingAomomoCardGain",
    "getPendingYichangdianCardGain", "getPendingBanrenmaCardGain",
    "getPendingChongCardGain", "getPendingAmibaTraceRemoval", "getPendingJiuzheCardPlay",
    "getPendingBanrenmaOpportunity",
  ]);
  const REMOVED_RULE_METHODS = Object.freeze([
    "applyFangzhouUnlockStateTraceReward", "createFangzhouReservedButtons",
    "buildFangzhouCard1EffectQueue", "getFangzhouCard1RewardTargetOptions",
    "enqueueFangzhouCard1RewardEffects", "flipFangzhouCard1Rewards",
    "applyFangzhouCard1Rewards", "applyFangzhouCard1Reward", "queueFangzhouBasicRewards",
    "applyFangzhouTraceRewardToPlayer", "findPlayerForJiuzheEntry",
    "applyJiuzheRewardToPlayer", "findPlayerForYichangdianEntry",
    "applyYichangdianRewardToPlayer", "spendAvailableDataTokens",
    "applyBanrenmaRewardToPlayer", "applyAomomoRewardToPlayer", "applyChongRewardToPlayer",
    "applyAmibaRewardToPlayer", "applyRunezuRewardToPlayer", "applyRunezuSymbolReward",
    "claimRunezuSourceSymbolWithHistory", "applyChongFossilRewardToPlayer",
    "createChongTransportTokenForFossil", "openChongPickCardFollowUp",
    "failChongTaskCompletion", "finishChongFossilEffect",
    "completeChongTraceTaskWithFossil", "openChongTraceTaskCompletionPicker",
    "enqueueJiuzheOpportunity", "queueJiuzheThresholdEffectForPlayer",
    "queueJiuzheOpportunitiesForPlayer", "queueBanrenmaPanelBonusEffectForPlayer",
    "enqueueBanrenmaOpportunity", "queueBanrenmaOpportunitiesForPlayer",
    "executeJiuzheThresholdCardEffect", "executeBanrenmaPanelBonusEffect",
    "completeBanrenmaOpportunityStep", "openChongRewardFollowUps",
    "openAmibaRewardFollowUps", "openRunezuRewardFollowUps",
    "executeStandardRunezuFaceSymbol", "executeRunezuSymbolRewardEffect",
  ]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("alien_species input port 需要已校验 registry");
    }
    return registry.registerTarget("alien_species", BROWSER_INPUT_NAMES, getTarget);
  }

  function createAlienSpeciesRuntime(context = {}) {
    const {
      aliens, amiba, aomomo, banrenma, chong, fangzhou, jiuzhe, players, runezu, yichangdian,
    } = context.speciesRules || {};
    const { document, els, window, banrenmaBonusMarkerElements } = context.renderPort || {};
    const hostPort = context.hostPort || {};

    function requireProjection(root) {
      root = root?.alienGameState ? root : hostPort.readProjection?.();
      if (!root?.alienGameState || !root?.playerState) {
        throw new TypeError("alien species renderer 需要正式 working projection");
      }
      return root;
    }
    function findElement(collection, slotId) {
      return [...(collection || [])].find((element) => (
        Number(element.dataset.alienSlot) === Number(slotId)
      )) || null;
    }
    const getAlienTraceLayer = (slotId) => findElement(els?.alienTraceLayers, slotId);
    const getAlienJiuzheTraceLayer = (slotId) => findElement(els?.alienJiuzheTraceLayers, slotId);
    const getAlienYichangdianCardArea = (slotId) => findElement(els?.alienYichangdianCardAreas, slotId);
    const getAlienBanrenmaCardArea = (slotId) => findElement(els?.alienBanrenmaCardAreas, slotId);
    const getAlienChongCardArea = (slotId) => findElement(els?.alienChongCardAreas, slotId);
    const getAlienAmibaCardArea = (slotId) => findElement(els?.alienAmibaCardAreas, slotId);
    const getAlienAomomoCardArea = (slotId) => findElement(els?.alienAomomoCardAreas, slotId);
    const getAlienRunezuCardArea = (slotId) => findElement(els?.alienRunezuCardAreas, slotId);
    const getAlienFangzhouCardArea = (slotId) => findElement(els?.alienFangzhouCardAreas, slotId);
    const getAlienJiuzheThresholdElement = (slotId) => findElement(els?.alienJiuzheThresholds, slotId);
    const getAlienBanrenmaScoremarkElement = (slotId) => findElement(els?.alienBanrenmaScoremarks, slotId);
    const getAlienBackImage = (slotId) => document?.querySelector(
      `.alien-panel[data-alien-slot="${slotId}"] .alien-back`,
    ) || null;

    function createJiuzheThresholdNode(kind, iconSrc, score) {
      const item = document.createElement("div");
      item.className = "alien-jiuzhe-threshold";
      item.dataset.jiuzheThreshold = kind;
      const icon = document.createElement("img");
      icon.className = "alien-jiuzhe-threshold-icon";
      icon.src = iconSrc || "";
      icon.alt = "";
      const scoreElement = document.createElement("span");
      scoreElement.className = "alien-jiuzhe-threshold-score";
      scoreElement.textContent = score == null ? "-" : String(score);
      item.append(icon, scoreElement);
      return item;
    }

    function renderJiuzheThresholds(root) {
      const { alienGameState } = requireProjection(root);
      for (const slotId of aliens.ALIEN_SLOT_IDS) {
        const container = getAlienJiuzheThresholdElement(slotId);
        if (!container) continue;
        const visible = jiuzhe.isJiuzheRevealedSlot(alienGameState, slotId);
        container.hidden = !visible;
        container.replaceChildren();
        if (!visible) continue;
        const state = alienGameState.jiuzhe || {};
        container.append(
          createJiuzheThresholdNode(
            "free", context.constants?.RESOURCE_ICON_SRC?.jiuzheTimeFree, state.freeScoreThreshold,
          ),
          createJiuzheThresholdNode(
            "paid", context.constants?.RESOURCE_ICON_SRC?.jiuzheTimePaid, state.paidScoreThreshold,
          ),
        );
      }
    }

    function renderCardDisplay(root, options) {
      const { alienGameState } = requireProjection(root);
      for (const slotId of aliens.ALIEN_SLOT_IDS) {
        const area = options.getArea(slotId);
        if (!area) continue;
        const visible = options.isRevealed(alienGameState, slotId);
        const cardIndex = options.getIndex(alienGameState);
        area.hidden = !visible;
        area.replaceChildren();
        if (!visible) continue;
        const title = document.createElement("div");
        title.className = `${options.className}-title`;
        title.textContent = options.title;
        const image = document.createElement("img");
        image.className = `${options.className}-image`;
        image.src = cardIndex == null ? options.backSrc : options.getSrc(cardIndex);
        image.alt = cardIndex == null ? `${options.title}牌背` : `${options.title} ${cardIndex}`;
        image.width = 747;
        image.height = 1040;
        area.append(title, image);
      }
    }

    const renderYichangdianCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienYichangdianCardArea,
      isRevealed: yichangdian.isYichangdianRevealedSlot,
      getIndex: (state) => state.yichangdian?.displayedCardIndex,
      getSrc: yichangdian.getCardSrc,
      backSrc: yichangdian.CARD_BACK_SRC || "",
      title: "异常点展示牌",
      className: "alien-yichangdian-card",
    });
    const renderBanrenmaCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienBanrenmaCardArea,
      isRevealed: banrenma.isBanrenmaRevealedSlot,
      getIndex: (state) => state.banrenma?.displayedCardIndex,
      getSrc: banrenma.getCardSrc,
      backSrc: banrenma.CARD_BACK_SRC,
      title: "半人马展示牌",
      className: "alien-banrenma-card",
    });
    const renderChongCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienChongCardArea,
      isRevealed: chong.isChongRevealedSlot,
      getIndex: (state) => state.chong?.displayedCardIndex,
      getSrc: chong.getCardSrc,
      backSrc: chong.CARD_BACK_SRC,
      title: "虫族展示牌",
      className: "alien-chong-card",
    });
    const renderAmibaCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienAmibaCardArea,
      isRevealed: amiba.isAmibaRevealedSlot,
      getIndex: (state) => state.amiba?.displayedCardIndex,
      getSrc: amiba.getCardSrc,
      backSrc: amiba.CARD_BACK_SRC,
      title: "阿米巴展示牌",
      className: "alien-amiba-card",
    });
    const renderAomomoCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienAomomoCardArea,
      isRevealed: aomomo.isAomomoRevealedSlot,
      getIndex: (state) => state.aomomo?.displayedCardIndex,
      getSrc: aomomo.getCardSrc,
      backSrc: aomomo.CARD_BACK_SRC,
      title: "奥陌陌展示牌",
      className: "alien-aomomo-card",
    });
    const renderRunezuCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienRunezuCardArea,
      isRevealed: runezu.isRunezuRevealedSlot,
      getIndex: (state) => state.runezu?.displayedCardIndex,
      getSrc: runezu.getCardSrc,
      backSrc: runezu.CARD_BACK_SRC,
      title: "符文族展示牌",
      className: "alien-runezu-card",
    });
    const renderFangzhouCardDisplays = (root) => renderCardDisplay(root, {
      getArea: getAlienFangzhouCardArea,
      isRevealed: fangzhou.isFangzhouRevealedSlot,
      getIndex: (state) => state.fangzhou?.displayedCard1Index,
      getSrc: fangzhou.getCard1Src,
      backSrc: fangzhou.CARD1_BACK_SRC,
      title: "方舟奖励牌",
      className: "alien-fangzhou-card",
    });

    function renderBanrenmaScoremarks(root) {
      const { alienGameState, playerState } = requireProjection(root);
      for (const slotId of aliens.ALIEN_SLOT_IDS) {
        const container = getAlienBanrenmaScoremarkElement(slotId);
        if (!container) continue;
        const visible = banrenma.isBanrenmaRevealedSlot(alienGameState, slotId);
        const marks = visible ? (playerState.players || []).flatMap((player) => (
          banrenma.getPlayerScoreMarks(alienGameState, player)
            .filter((mark) => mark.source === "panel")
            .map((mark) => ({ player, mark }))
        )) : [];
        container.hidden = !marks.length;
        container.replaceChildren(...marks.map(({ player, mark }) => {
          const item = document.createElement("div");
          item.className = "alien-banrenma-scoremark";
          item.dataset.playerId = player.id;
          item.textContent = String(mark.threshold);
          return item;
        }));
      }
    }

    function renderBanrenmaBonusMarkers(root) {
      const { alienGameState } = requireProjection(root);
      const active = new Set();
      const state = alienGameState.banrenma || {};
      const slotId = Number(state.revealedSlotId || 0);
      const layer = slotId ? getAlienJiuzheTraceLayer(slotId) : null;
      for (const [position, marker] of Object.entries(state.bonusSlots || {})) {
        const layout = window.SetiAlienPlacement?.getBanrenmaBonusMarkerLayout?.(slotId, Number(position));
        if (!layer || !layout || !marker) continue;
        const key = `${slotId}:${position}`;
        active.add(key);
        let element = banrenmaBonusMarkerElements.get(key);
        if (!element) {
          element = document.createElement("img");
          element.className = "alien-trace-token alien-trace-token-positioned alien-trace-token-banrenma-bonus";
          layer.append(element);
          banrenmaBonusMarkerElements.set(key, element);
        }
        element.src = banrenma.getPlayerMarkSrc(marker.playerColor);
        element.style.left = `${layout.percentX}%`;
        element.style.top = `${layout.percentY}%`;
        element.dataset.banrenmaBonusPosition = String(position);
      }
      for (const [key, element] of banrenmaBonusMarkerElements) {
        if (active.has(key)) continue;
        element.remove();
        banrenmaBonusMarkerElements.delete(key);
      }
    }

    function renderAlienPanels(root) {
      const { alienGameState } = requireProjection(root);
      aliens.renderAllAlienBackImages(getAlienBackImage, alienGameState);
      const presentation = {
        tokenSrc: aliens.ALIEN_TRACE_TOKEN_SRC,
        showStateTraceSlots: false,
        getPlayerTokenAsset: (color) => (
          players.getPlayerColorDefinition(color)?.normalTokenAsset || aliens.ALIEN_TRACE_TOKEN_SRC
        ),
        getPlayerOrbitAsset: (color) => (
          players.getPlayerColorDefinition(color)?.satelliteAsset || aliens.ALIEN_TRACE_TOKEN_SRC
        ),
        getPlayerLandingAsset: (color) => (
          players.getPlayerColorDefinition(color)?.landdingAsset || aliens.ALIEN_TRACE_TOKEN_SRC
        ),
        getPlayerLabel: (color) => players.getPlayerColorDefinition(color)?.label || color,
      };
      aliens.renderAllAlienTraceMarkers(getAlienTraceLayer, alienGameState, presentation);
      aliens.renderAllJiuzheTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllYichangdianTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllFangzhouTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllBanrenmaTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllChongTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllAmibaTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllAomomoTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      aliens.renderAllRunezuTraceMarkers?.(getAlienJiuzheTraceLayer, alienGameState, presentation);
      renderJiuzheThresholds(root);
      renderYichangdianCardDisplays(root);
      renderBanrenmaScoremarks(root);
      renderBanrenmaCardDisplays(root);
      renderChongCardDisplays(root);
      renderAmibaCardDisplays(root);
      renderAomomoCardDisplays(root);
      renderRunezuCardDisplays(root);
      renderFangzhouCardDisplays(root);
      renderBanrenmaBonusMarkers(root);
      context.renderPort?.renderRunezuBoardSymbols?.();
    }

    function alignAlienPanelsToPlanets() {
      els.appWrap.style.removeProperty("--alien-panel-min-height");
      if (window.innerWidth <= 1180 || els.alienPanels.length < 2 || !els.planetsReferenceImage) return;
      const panels = [...els.alienPanels];
      const first = panels[0].getBoundingClientRect();
      const second = panels[1].getBoundingClientRect();
      const bottomGap = els.planetsReferenceImage.getBoundingClientRect().bottom - second.bottom;
      if (bottomGap > 0) {
        els.appWrap.style.setProperty(
          "--alien-panel-min-height",
          `${Math.ceil(Math.max(first.height, (first.height + bottomGap / panels.length) * 0.75))}px`,
        );
      }
    }

    const productionDecisionOwnedBySession = () => ({
      ok: false,
      code: "ALIEN_DECISION_INPUT_OWNED_BY_SESSION",
      message: "物种 Decision 只能通过当前 Effect Session identity 提交",
    });
    const emptyDecisionProjection = () => null;

    const runtime = {
      getAlienTraceLayer, getAlienJiuzheTraceLayer, getAlienYichangdianCardArea,
      getAlienBanrenmaCardArea, getAlienChongCardArea, getAlienAmibaCardArea,
      getAlienAomomoCardArea, getAlienRunezuCardArea, getAlienFangzhouCardArea,
      getAlienJiuzheThresholdElement, getAlienBanrenmaScoremarkElement, getAlienBackImage,
      createJiuzheThresholdNode, renderJiuzheThresholds, renderYichangdianCardDisplays,
      renderBanrenmaScoremarks, renderBanrenmaCardDisplays, renderChongCardDisplays,
      renderAmibaCardDisplays, renderAomomoCardDisplays, renderRunezuCardDisplays,
      renderBanrenmaBonusMarkers, renderFangzhouCardDisplays, renderAlienPanels,
      alignAlienPanelsToPlanets,
      maybeRevealAlienAfterTrace(_root, slotId, result) {
        return result?.readyToReveal ? { ok: true, delayed: true, alienSlotId: slotId } : null;
      },
      isDebugAlienTraceMode: () => false,
      getAvailableDataTokenCount: (player) => Number(player?.resources?.availableData) || 0,
      getChongPlanetLabel: (planetId) => String(planetId || ""),
      formatChongGain: (gain) => JSON.stringify(gain || {}),
      formatChongFossilRewardSummary: (reward) => JSON.stringify(reward || {}),
      buildJiuzheCardConditionContext: emptyDecisionProjection,
      getJiuzheCardConditionLabel: () => "",
      buildJiuzheOpportunitySubtitle: () => "",
      getBanrenmaCardConditionLabel: () => "",
      getReadyBanrenmaCards: () => [],
      getReadyBanrenmaCardsForOpportunity: () => [],
      getReadyBanrenmaCardForOpportunity: () => null,
      getActiveAlienSharedOverlayPendingForManualGuard: emptyDecisionProjection,
      openFangzhouCard1Dialog: emptyDecisionProjection,
      randomizeAliens: () => ({
        ok: false,
        code: "ALIEN_INITIALIZATION_OWNED_BY_COMPOSITION",
        message: "外星人分配由 Composition 新局状态创建完成",
      }),
    };
    for (const name of PROJECTION_METHODS) runtime[name] = emptyDecisionProjection;
    for (const name of INPUT_METHODS) runtime[name] = productionDecisionOwnedBySession;
    for (const name of REMOVED_RULE_METHODS) runtime[name] = productionDecisionOwnedBySession;
    return Object.freeze(runtime);
  }

  function createBrowserAlienSpeciesRuntime(options = {}) {
    return createAlienSpeciesRuntime({
      speciesRules: options.speciesRules,
      renderPort: options.renderPort,
      constants: options.constants,
      hostPort: options.hostPort,
    });
  }

  function createAlienSpeciesPort(context = {}) {
    return new Proxy({}, {
      get(_target, name) {
        if (typeof name !== "string") return undefined;
        return (...args) => {
          const runtime = context.getRuntime?.();
          if (RENDER_METHODS.includes(name) || PROJECTION_METHODS.includes(name)) {
            return runtime?.[name]?.(...args);
          }
          return context.inputPort?.[name]
            ? context.inputPort[name](...args)
            : runtime?.[name]?.(...args);
        };
      },
    });
  }

  return Object.freeze({
    BROWSER_INPUT_NAMES,
    createBrowserInputPort,
    createAlienSpeciesPort,
    createAlienSpeciesRuntime,
    createBrowserAlienSpeciesRuntime,
  });
});
