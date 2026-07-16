(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppStartScreen = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function stripAssetExtension(value) {
    return String(value || "").replace(/\.[^./\\]+$/, "");
  }

  function normalizeAiDifficulty(value, options = {}) {
    const weakStart = options.weakStartValue || "weak_start";
    const defaultValue = options.defaultValue || "laughable";
    return String(value || "") === weakStart ? weakStart : defaultValue;
  }

  function normalizeStartPlayerCount(value, defaultActivePlayerCount) {
    const fallback = Math.max(1, Math.round(Number(defaultActivePlayerCount) || 4));
    const count = Math.round(Number(value) || fallback);
    return count === 3 ? 3 : fallback;
  }

  function getSelectedOptionIds(checkboxes, datasetKey, allowedIds, minSelected) {
    const selected = new Set((checkboxes || [])
      .filter((checkbox) => checkbox?.checked)
      .map((checkbox) => checkbox?.dataset?.[datasetKey])
      .filter(Boolean));
    const orderedIds = (allowedIds || []).filter((id) => selected.has(id));
    return orderedIds.length >= minSelected ? orderedIds : [...(allowedIds || [])];
  }

  function syncLockedCheckboxes(checkboxes, minSelected, lockedClassName) {
    const checkedCount = (checkboxes || []).filter((checkbox) => checkbox?.checked).length;
    for (const checkbox of checkboxes || []) {
      const locked = Boolean(checkbox?.checked) && checkedCount <= minSelected;
      if (checkbox) checkbox.disabled = locked;
      checkbox?.closest?.(lockedClassName)?.classList.toggle("is-locked", locked);
    }
  }

  function getSelectedStartAlienIds(options = {}) {
    return getSelectedOptionIds(
      options.checkboxes || [],
      "startAlienId",
      options.alienTypeIds || [],
      options.minSelected || 2,
    );
  }

  function syncStartScreenAlienOptions(options = {}) {
    const minSelected = options.minSelected || 2;
    const checkboxes = options.checkboxes || [];
    syncLockedCheckboxes(checkboxes, minSelected, ".start-screen-alien-choice");
    const selectedAlienIds = getSelectedStartAlienIds({
      checkboxes,
      alienTypeIds: options.alienTypeIds || [],
      minSelected,
    });
    if (options.startScreenState) {
      options.startScreenState.selectedAlienIds = selectedAlienIds;
    }
    return selectedAlienIds;
  }

  function handleStartAlienOptionChange(options = {}) {
    const checkbox = options.event?.target?.closest?.("[data-start-alien-id]");
    if (!checkbox) return null;
    const minSelected = options.minSelected || 2;
    const checkboxes = options.getCheckboxes ? options.getCheckboxes() : [];
    const checkedCount = checkboxes.filter((item) => item?.checked).length;
    if (checkedCount < minSelected) {
      checkbox.checked = true;
    }
    return options.syncOptions ? options.syncOptions() : null;
  }

  function getSelectedStartIndustryLabels(options = {}) {
    return getSelectedOptionIds(
      options.checkboxes || [],
      "startIndustryLabel",
      (options.industryCardFiles || []).map(stripAssetExtension),
      options.minSelected || 2,
    );
  }

  function syncStartScreenIndustryOptions(options = {}) {
    const minSelected = options.minSelected || 2;
    const checkboxes = options.checkboxes || [];
    syncLockedCheckboxes(checkboxes, minSelected, ".start-screen-company-choice");
    const selectedIndustryLabels = getSelectedStartIndustryLabels({
      checkboxes,
      industryCardFiles: options.industryCardFiles || [],
      minSelected,
    });
    if (options.startScreenState) {
      options.startScreenState.selectedIndustryLabels = selectedIndustryLabels;
    }
    return selectedIndustryLabels;
  }

  function handleStartIndustryOptionChange(options = {}) {
    const checkbox = options.event?.target?.closest?.("[data-start-industry-label]");
    if (!checkbox) return null;
    const minSelected = options.minSelected || 2;
    const checkboxes = options.getCheckboxes ? options.getCheckboxes() : [];
    const checkedCount = checkboxes.filter((item) => item?.checked).length;
    if (checkedCount < minSelected) {
      checkbox.checked = true;
    }
    return options.syncOptions ? options.syncOptions() : null;
  }

  function updateStartScreenContinueButton(options = {}) {
    const continueEnabled = options.continueEnabled !== false;
    const canContinue = continueEnabled && Boolean(options.hasPersistentGameState?.());
    if (options.startScreenState) {
      options.startScreenState.continueAvailable = canContinue;
    }
    const button = options.button || null;
    if (button) {
      button.hidden = !continueEnabled;
      button.setAttribute("aria-hidden", String(!continueEnabled));
      button.disabled = !canContinue;
      button.setAttribute("aria-disabled", String(!canContinue));
    }
    return canContinue;
  }

  function createStartScreenController(context = {}) {
    if (!context.startScreenState) {
      throw new Error("createStartScreenController requires startScreenState");
    }

    const {
      startScreenState,
      els,
      actionLogState,
      alienTypeIds = [],
      minAlienRevealPoolSize = 2,
      industryCardFiles = [],
      minIndustryPoolSize = 2,
      continueEnabled = false,
      defaultActivePlayerCount = 4,
      aiDifficultyWeakStart = "weak_start",
      aiDifficultyDefault = "laughable",
      hasPersistentGameState,
      restorePersistentGameState,
      refreshAfterGameRecovery,
      schedulePersistentGameStateSave,
      closeActionBriefing,
      setDebugOpen,
      setReportTab,
      resize,
      setLogOpen,
      startNewGame,
    } = context;

    function getStartAlienCheckboxes() {
      return [...(els?.startAlienCheckboxes || [])];
    }

    function getStartIndustryCheckboxes() {
      return [...(els?.startIndustryCheckboxes || [])];
    }

    function syncDebugOption() {
      const enabled = Boolean(els?.startDebugEnabled?.checked);
      if (els?.startDebugToggleText) {
        els.startDebugToggleText.textContent = enabled ? "开启" : "关闭";
      }
      return enabled;
    }

    function syncActionLogOption() {
      const enabled = els?.startActionLogEnabled ? Boolean(els.startActionLogEnabled.checked) : true;
      startScreenState.actionBriefingEnabled = enabled;
      if (els?.startActionLogToggleText) {
        els.startActionLogToggleText.textContent = enabled ? "开启" : "关闭";
      }
      if (!enabled) closeActionBriefing?.();
      return enabled;
    }

    function syncAlienOptions() {
      return syncStartScreenAlienOptions({
        checkboxes: getStartAlienCheckboxes(),
        startScreenState,
        alienTypeIds,
        minSelected: minAlienRevealPoolSize,
      });
    }

    function syncIndustryOptions() {
      return syncStartScreenIndustryOptions({
        checkboxes: getStartIndustryCheckboxes(),
        startScreenState,
        industryCardFiles,
        minSelected: minIndustryPoolSize,
      });
    }

    function updateContinueButton() {
      return updateStartScreenContinueButton({
        continueEnabled,
        hasPersistentGameState,
        startScreenState,
        button: els?.startScreenContinueButton,
      });
    }

    function setDebugToolsEnabled(enabled) {
      const isEnabled = Boolean(enabled);
      startScreenState.debugToolsEnabled = isEnabled;
      els?.appWrap?.classList.toggle("debug-tools-disabled", !isEnabled);
      els?.appWrap?.classList.toggle("state-log-disabled", !isEnabled);
      syncDebugOption();
      if (!isEnabled) {
        setDebugOpen?.(false);
        setReportTab?.("action");
      } else {
        setReportTab?.(actionLogState?.activeReportTab || "action");
      }
      resize?.();
      return isEnabled;
    }

    function applyOptions() {
      syncAlienOptions();
      syncIndustryOptions();
      syncActionLogOption();
      startScreenState.aiDifficulty = normalizeAiDifficulty(els?.startAiDifficulty?.value, {
        weakStartValue: aiDifficultyWeakStart,
        defaultValue: aiDifficultyDefault,
      });
      if (els?.startAiDifficulty) {
        els.startAiDifficulty.value = startScreenState.aiDifficulty;
      }
      startScreenState.activePlayerCount = normalizeStartPlayerCount(
        els?.startPlayerCount?.value,
        defaultActivePlayerCount,
      );
      if (els?.startPlayerCount) {
        els.startPlayerCount.value = String(startScreenState.activePlayerCount);
      }
      setDebugToolsEnabled(Boolean(els?.startDebugEnabled?.checked));
      return {
        aiDifficulty: startScreenState.aiDifficulty,
        activePlayerCount: startScreenState.activePlayerCount,
      };
    }

    function closeStartScreen() {
      if (els?.startScreen) {
        els.startScreen.hidden = true;
        els.startScreen.setAttribute("aria-hidden", "true");
      }
      setLogOpen?.(false);
      resize?.();
    }

    function startNewGameFromStartScreen() {
      startScreenState.entered = true;
      applyOptions();
      startNewGame?.({
        activePlayerCount: startScreenState.activePlayerCount,
        aiDifficulty: startScreenState.aiDifficulty,
        clearStorage: true,
        message: "新游戏已开始，请完成初始选择。",
      });
      closeStartScreen();
    }

    function continueGameFromStartScreen() {
      if (!updateContinueButton()) return;
      const restoreResult = restorePersistentGameState?.();
      if (!restoreResult?.ok) {
        updateContinueButton();
        return;
      }
      startScreenState.entered = true;
      applyOptions();
      closeStartScreen();
      refreshAfterGameRecovery?.(restoreResult.message || "已恢复上次保存的局面");
      schedulePersistentGameStateSave?.({ label: "继续后状态" });
    }

    return {
      syncDebugOption,
      syncActionLogOption,
      syncAlienOptions,
      handleAlienOptionChange(event) {
        return handleStartAlienOptionChange({
          event,
          minSelected: minAlienRevealPoolSize,
          getCheckboxes: getStartAlienCheckboxes,
          syncOptions: syncAlienOptions,
        });
      },
      syncIndustryOptions,
      handleIndustryOptionChange(event) {
        return handleStartIndustryOptionChange({
          event,
          minSelected: minIndustryPoolSize,
          getCheckboxes: getStartIndustryCheckboxes,
          syncOptions: syncIndustryOptions,
        });
      },
      updateContinueButton,
      setDebugToolsEnabled,
      applyOptions,
      closeStartScreen,
      startNewGameFromStartScreen,
      continueGameFromStartScreen,
    };
  }

  return {
    normalizeAiDifficulty,
    normalizeStartPlayerCount,
    getSelectedStartAlienIds,
    syncStartScreenAlienOptions,
    handleStartAlienOptionChange,
    getSelectedStartIndustryLabels,
    syncStartScreenIndustryOptions,
    handleStartIndustryOptionChange,
    updateStartScreenContinueButton,
    createStartScreenController,
  };
});
