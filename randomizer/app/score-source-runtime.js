(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppScoreSourceRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCORE_SOURCE_KEYS = Object.freeze({
    INITIAL: "initialScore",
    SCAN: "scanScore",
    TECH_BONUS: "techBonusScore",
    BLUE_TECH: "blueTechScore",
    CARD_QUICK: "cardQuickScore",
    CARD_EFFECT: "cardEffectScore",
    TASK_CARD: "taskCardScore",
    ORBIT: "orbitScore",
    LAND: "landScore",
    ALIEN_TRACE_PINK: "alienTracePinkScore",
    ALIEN_TRACE_YELLOW: "alienTraceYellowScore",
    ALIEN_TRACE_BLUE: "alienTraceBlueScore",
    ALIEN_CARD_QUICK: "alienCardQuickScore",
    ALIEN_EFFECT: "alienEffectScore",
    INDUSTRY_EFFECT: "industryEffectScore",
  });

  function createScoreSourceRuntime(context = {}) {
    const keySet = new Set(Object.values(SCORE_SOURCE_KEYS));

    function normalizeAmount(value) {
      const number = Number(value) || 0;
      return Number.isInteger(number) ? number : Math.round(number * 100) / 100;
    }

    function ensurePlayerScoreSources(player) {
      if (!player) return {};
      if (!player.scoreSources || typeof player.scoreSources !== "object") player.scoreSources = {};
      return player.scoreSources;
    }

    function addPlayerScoreSource(player, key, amount) {
      const value = normalizeAmount(amount);
      if (!player || !keySet.has(key) || value === 0) return 0;
      const sources = ensurePlayerScoreSources(player);
      sources[key] = normalizeAmount((Number(sources[key]) || 0) + value);
      return value;
    }

    function addScoreSourceFromGain(player, key, gain) {
      return addPlayerScoreSource(player, key, gain?.score || 0);
    }

    function getScoreAwardedFromScanResult(result) {
      return normalizeAmount(
        result?.scoreAwarded
          ?? result?.replaced?.scoreAwarded
          ?? result?.payload?.replaced?.scoreAwarded
          ?? 0,
      );
    }

    function createRestoreCommand(player, beforeSources, label) {
      const snapshot = structuredClone(beforeSources || {});
      return {
        label: label || "分数来源账本",
        describe: label || "恢复分数来源账本",
        undo() {
          if (player) player.scoreSources = structuredClone(snapshot);
        },
      };
    }

    function recordHistoryCommand(workingRoot, player, beforeSources, label, history) {
      const command = createRestoreCommand(player, beforeSources, label);
      if (history === context.quickActionHistory) context.recordQuickHistoryCommand(command);
      else context.recordHistoryCommand(workingRoot, command);
    }

    function recordScanScoreSource(workingRoot, player, result, history = null) {
      const amount = getScoreAwardedFromScanResult(result);
      if (!amount) return 0;
      const beforeSources = structuredClone(player?.scoreSources || {});
      const added = addPlayerScoreSource(player, SCORE_SOURCE_KEYS.SCAN, amount);
      if (added && history) {
        recordHistoryCommand(workingRoot, player, beforeSources, "恢复扫描分数来源", history);
      }
      return added;
    }

    function getScanScorePlayer(workingRoot, result) {
      const event = (result?.events || []).find((item) => (
        item?.type === "signalMarked" && (item.playerId || item.playerColor)
      ));
      const playerId = result?.playerId || event?.playerId || null;
      const playerColor = result?.playerColor || event?.playerColor || null;
      return (workingRoot.playerState.players || []).find((player) => (
        (playerId && player.id === playerId) || (playerColor && player.color === playerColor)
      )) || context.players.getCurrentPlayer(workingRoot.playerState);
    }

    function recordScanScoreSourcesFromAbilityResult(workingRoot, result, history = context.actionHistory) {
      const scanResults = [result, result?.payload?.industryLaunchScan].filter(Boolean);
      for (const scanResult of scanResults) {
        if (!getScoreAwardedFromScanResult(scanResult)) continue;
        recordScanScoreSource(workingRoot, getScanScorePlayer(workingRoot, scanResult), scanResult, history);
      }
    }

    function getAlienTraceScoreSourceKey(traceType) {
      return ({
        pink: SCORE_SOURCE_KEYS.ALIEN_TRACE_PINK,
        yellow: SCORE_SOURCE_KEYS.ALIEN_TRACE_YELLOW,
        blue: SCORE_SOURCE_KEYS.ALIEN_TRACE_BLUE,
      })[traceType] || null;
    }

    function recordAlienTraceScore(player, traceType, gain) {
      const key = getAlienTraceScoreSourceKey(traceType);
      return key ? addScoreSourceFromGain(player, key, gain) : 0;
    }

    function recordInitialSelectionScoreSources(result) {
      for (const entry of result?.results || []) {
        const player = context.getPlayerById(entry?.playerId) || context.getPlayerByColor(entry?.playerColor);
        if (!player) continue;
        for (const item of entry?.results || []) {
          if (item?.type === "resources") {
            addScoreSourceFromGain(player, SCORE_SOURCE_KEYS.INITIAL, item.gain);
          } else if (item?.type === "alienTraceReward") {
            recordAlienTraceScore(player, item.trace?.traceType, item.gain);
          } else if (item?.type === "scan") {
            recordScanScoreSource(null, player, item);
          }
        }
      }
    }

    function recordTechBonusScore(player, result) {
      if (!result?.ok) return 0;
      const rewards = result.rewards || result.payload?.rewards || {};
      return addPlayerScoreSource(
        player,
        SCORE_SOURCE_KEYS.TECH_BONUS,
        (Number(rewards.bonus?.score) || 0) + (Number(rewards.firstTakeScore) || 0),
      );
    }

    function getScoreSourceKeyForGainEffect(effect) {
      const explicit = effect?.options?.scoreSourceKey;
      if (keySet.has(explicit)) return explicit;
      const flow = context.getActionEffectFlow();
      switch (flow?.actionType) {
        case "orbit": return SCORE_SOURCE_KEYS.ORBIT;
        case "land": return SCORE_SOURCE_KEYS.LAND;
        case "cardTask":
        case "cardTrigger": return SCORE_SOURCE_KEYS.TASK_CARD;
        case "playCard":
          return context.isAlienFamilyCard(flow?.card)
            ? SCORE_SOURCE_KEYS.ALIEN_EFFECT
            : SCORE_SOURCE_KEYS.CARD_EFFECT;
        case "banrenmaCondition":
        case "fangzhouBasic":
        case "fangzhouAdvanced": return SCORE_SOURCE_KEYS.ALIEN_EFFECT;
        default:
          return String(flow?.actionType || "").startsWith("industry")
            ? SCORE_SOURCE_KEYS.INDUSTRY_EFFECT
            : null;
      }
    }

    function recordScoreSourceForGainEffect(player, effect, gain) {
      const key = getScoreSourceKeyForGainEffect(effect);
      return key ? addScoreSourceFromGain(player, key, gain) : 0;
    }

    function attachScoreSourceToEffects(effects, scoreSourceKey) {
      if (!keySet.has(scoreSourceKey)) return effects || [];
      return (effects || []).map((effect) => ({
        ...effect,
        options: {
          ...(effect.options || {}),
          scoreSourceKey: effect.options?.scoreSourceKey || scoreSourceKey,
        },
      }));
    }

    function getPlayerScoreSource(player, key) {
      return normalizeAmount(player?.scoreSources?.[key] || 0);
    }

    return Object.freeze({
      SCORE_SOURCE_KEY_SET: keySet,
      addPlayerScoreSource,
      addScoreSourceFromGain,
      attachScoreSourceToEffects,
      getPlayerScoreSource,
      getScanScorePlayer,
      recordAlienTraceScore,
      recordInitialSelectionScoreSources,
      recordScanScoreSourcesFromAbilityResult,
      recordScoreSourceForGainEffect,
      recordTechBonusScore,
    });
  }

  return Object.freeze({ SCORE_SOURCE_KEYS, createScoreSourceRuntime });
});
