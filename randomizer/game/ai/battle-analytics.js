(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAIBattleAnalytics = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const BASIC_MAIN_ACTIONS = Object.freeze(["launch", "orbit", "land", "scan", "analyze"]);
  const ENGINE_ACTIONS = Object.freeze(["playCard", "researchTech"]);
  const QUICK_ACTIONS = Object.freeze(["move", "placeData"]);
  const PACE_QUICK_ACTIONS = Object.freeze(["move", "placeData", "cardCorner", "quickTrade", "industry"]);
  const PACE_MAIN_ACTIONS = Object.freeze([...BASIC_MAIN_ACTIONS, ...ENGINE_ACTIONS]);
  const PASS_ACTIONS = Object.freeze(["pass", "end-turn"]);
  const MEANINGFUL_RESOURCE_UNLOCK_SCORE = 8;
  const LOW_PLAYER_CANDIDATE_ACTIONS = Object.freeze([
    "playCard",
    "researchTech",
    "scan",
    "analyze",
    "placeData",
    "cardCorner",
    "quickTrade",
    "move",
    "orbit",
    "land",
    "launch",
    "pass",
    "end-turn",
  ]);
  const DEFAULT_SEQUENCE_WINDOW_TURNS = 6;
  const HIGH_SCORE_NEAR_MISS_TARGET = 300;
  const HIGH_SCORE_NEAR_MISS_MIN = 280;
  const FINAL_PUBLIC_REFILL_SHORTFALL_SCORE = 20;
  const PUBLIC_REFILL_TRADE_IDS = Object.freeze([
    "credits-for-card",
    "energy-for-card",
    "publicity-for-card",
    "cards-for-pick-card",
  ]);
  const RESOURCE_SHORTFALL_KEYS = Object.freeze(["credits", "energy", "publicity", "handSize"]);
  const D1_TECH_TYPES = Object.freeze(["orange", "blue", "purple"]);
  const HIGH_SCORE_NEAR_MISS_REFERENCE_METRICS = Object.freeze([
    "baseScore",
    "tileScore",
    "cardScore",
    "mainActionCount",
    "quickStepCount",
    "resourceQuickStepCount",
    "playCardCount",
    "researchTechCount",
    "scanCount",
    "analyzeCount",
    "placeDataCount",
    "techCount",
    "completedTaskCount",
  ]);
  const KEY_SEQUENCE_DECISIONS = Object.freeze([
    "play-card",
    "tech-placement",
    "scan-target",
    "land-target",
    "alien-trace",
    "alien-use",
    "final-score-mark",
    "pick-card",
    "hand-scan",
    "move-payment",
    "data-placement",
    "scan-action-4",
  ]);
  const POLICY_ACTION_BIAS = Object.freeze({
    land: 7,
    orbit: 6,
    researchTech: 5,
    playCard: 5,
    launch: 4,
    scan: 1.5,
    analyze: 1,
    placeData: 2,
    move: 0,
    "end-turn": 0,
    pass: -12,
  });

  function increment(map, key, amount = 1) {
    const normalizedKey = key == null || key === "" ? "unknown" : String(key);
    map[normalizedKey] = (map[normalizedKey] || 0) + amount;
    return map[normalizedKey];
  }

  function incrementNested(map, parentKey, childKey, amount = 1) {
    const normalizedParent = parentKey == null || parentKey === "" ? "unknown" : String(parentKey);
    if (!map[normalizedParent]) map[normalizedParent] = {};
    return increment(map[normalizedParent], childKey, amount);
  }

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundRatio(value) {
    return Math.round(numeric(value) * 1000) / 1000;
  }

  function rankCounts(counts = {}, limit = 10) {
    return Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
      .slice(0, limit);
  }

  function getActionCategory(actionId) {
    if (BASIC_MAIN_ACTIONS.includes(actionId)) return "basicMain";
    if (ENGINE_ACTIONS.includes(actionId)) return "engine";
    if (QUICK_ACTIONS.includes(actionId)) return "quick";
    if (PASS_ACTIONS.includes(actionId)) return "pass";
    return "other";
  }

  function getActionPaceCategory(actionId, action = {}) {
    const id = String(actionId || "");
    if (PASS_ACTIONS.includes(id)) return "idle";
    if (PACE_MAIN_ACTIONS.includes(id) || action.kind === "main") return "main";
    if (PACE_QUICK_ACTIONS.includes(id) || action.kind === "quick") return "quick";
    return "other";
  }

  function getCandidateStats(stats, actionId) {
    const key = actionId == null || actionId === "" ? "unknown" : String(actionId);
    if (!stats[key]) {
      stats[key] = {
        offered: 0,
        available: 0,
        selected: 0,
        availableNotSelected: 0,
      };
    }
    return stats[key];
  }

  function getCandidateId(candidate) {
    return String(candidate?.id || candidate?.actionId || "unknown");
  }

  function getFiniteScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score : null;
  }

  function scoreNestedPlayCardCandidate(candidate) {
    const explicitScore = getFiniteScore(candidate?.score);
    const price = Math.max(0, Math.round(Number(candidate?.price) || 0));
    const priceTieBreaker = Math.max(0, 5 - price) * 0.2;
    return (explicitScore ?? 0) + priceTieBreaker;
  }

  function getBestNestedScore(items = [], scoreFn = () => 0) {
    return (items || []).reduce((best, item) => {
      const score = getFiniteScore(scoreFn(item));
      return score == null ? best : Math.max(best, score);
    }, -Infinity);
  }

  function getCandidatePolicyScore(candidate) {
    if (!candidate) return null;
    const graphNet = getCandidateActionGraphNet(candidate);
    if (graphNet != null) return graphNet;
    const actionId = getCandidateId(candidate);
    const explicitScore = getFiniteScore(candidate.score);
    let valueScore = explicitScore ?? 0;
    if (actionId === "researchTech") {
      const bestTechScore = getBestNestedScore(candidate.takeable || [], (entry) => entry?.score);
      if (Number.isFinite(bestTechScore)) valueScore = Math.max(valueScore, bestTechScore);
    } else if (actionId === "playCard") {
      const bestCardScore = getBestNestedScore(candidate.playableCards || [], scoreNestedPlayCardCandidate);
      if (Number.isFinite(bestCardScore)) valueScore = Math.max(valueScore, bestCardScore);
    }
    return (POLICY_ACTION_BIAS[actionId] ?? 0) + valueScore;
  }

  function getCandidateActionGraphNet(candidate) {
    return getFiniteScore(candidate?.actionGraph?.net ?? candidate?.net);
  }

  function isCandidateAvailable(candidate) {
    return candidate && candidate.available !== false;
  }

  function candidateMatchesAction(candidate, action) {
    if (!candidate || !action) return false;
    if (getCandidateId(candidate) !== String(action.id || "")) return false;
    if (action.rocketId != null && candidate.rocketId != null && action.rocketId !== candidate.rocketId) return false;
    if (action.direction != null && candidate.direction != null && action.direction !== candidate.direction) return false;
    if (action.cardInstanceId != null && candidate.cardInstanceId != null && action.cardInstanceId !== candidate.cardInstanceId) return false;
    if (action.cardId != null && candidate.cardId != null && action.cardId !== candidate.cardId) return false;
    return true;
  }

  function hasAvailableKind(candidates = [], kind) {
    return candidates.some((candidate) => isCandidateAvailable(candidate) && candidate.kind === kind);
  }

  function hasAvailableAction(candidates = [], actionId) {
    return candidates.some((candidate) => isCandidateAvailable(candidate) && getCandidateId(candidate) === actionId);
  }

  function getSelectedAction(entry) {
    return entry?.details?.action || null;
  }

  function getSelectedActionId(entry) {
    return String(getSelectedAction(entry)?.id || "unknown");
  }

  function summarizeOpportunityCandidate(candidate = {}) {
    return {
      id: getCandidateId(candidate),
      kind: candidate.kind || null,
      tradeId: candidate.tradeId || null,
      label: candidate.label || candidate.planetName || candidate.cardLabel || null,
      score: roundRatio(candidate.score),
      policyScore: roundRatio(getCandidatePolicyScore(candidate)),
      directScoreGain: roundRatio(candidate.directScoreGain),
      reason: candidate.reason || null,
    };
  }

  function buildPassOpportunitySample(entry, candidates = [], limit = 3) {
    const availableCandidates = (candidates || []).filter(isCandidateAvailable);
    const availableMain = availableCandidates
      .filter((candidate) => candidate.kind === "main")
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || getCandidateId(left).localeCompare(getCandidateId(right))
      ));
    const topCandidates = availableCandidates
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || getCandidateId(left).localeCompare(getCandidateId(right))
      ))
      .slice(0, limit)
      .map(summarizeOpportunityCandidate);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
      bestMain: availableMain[0] ? summarizeOpportunityCandidate(availableMain[0]) : null,
      topCandidates,
    };
  }

  function buildEndTurnMoveOpportunitySample(entry, candidates = [], limit = 3) {
    const availableCandidates = (candidates || []).filter(isCandidateAvailable);
    const availableMoves = availableCandidates
      .filter((candidate) => getCandidateId(candidate) === "move")
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || getCandidateId(left).localeCompare(getCandidateId(right))
      ));
    const topCandidates = availableCandidates
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || getCandidateId(left).localeCompare(getCandidateId(right))
      ))
      .slice(0, limit)
      .map(summarizeOpportunityCandidate);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
      bestMove: availableMoves[0] ? summarizeOpportunityCandidate(availableMoves[0]) : null,
      bestMovePositive: numeric(availableMoves[0]?.score) > 0,
      topCandidates,
    };
  }

  function getPlayCardCandidate(candidates = []) {
    return (candidates || []).find((candidate) => getCandidateId(candidate) === "playCard") || null;
  }

  function getSelectedCandidate(entry, candidates = []) {
    const action = getSelectedAction(entry);
    return (candidates || []).find((candidate) => candidateMatchesAction(candidate, action)) || action || null;
  }

  function isPassResourceLockedPlayCard(entry, candidates = []) {
    if (getSelectedActionId(entry) !== "pass") return false;
    const playCardCandidate = getPlayCardCandidate(candidates);
    if (!playCardCandidate || isCandidateAvailable(playCardCandidate)) return false;
    const reason = String(playCardCandidate.reason || "");
    if (!reason.includes("没有资源可支付")) return false;
    return numeric(entry?.playerResources?.handSize) >= 2;
  }

  function buildPassResourceLockSample(entry, candidates = [], limit = 4) {
    const playCardCandidate = getPlayCardCandidate(candidates);
    const availableCandidates = (candidates || []).filter(isCandidateAvailable);
    const topCandidates = availableCandidates
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || getCandidateId(left).localeCompare(getCandidateId(right))
      ))
      .slice(0, limit)
      .map(summarizeOpportunityCandidate);
    const unavailableMain = (candidates || [])
      .filter((candidate) => candidate.kind === "main" && !isCandidateAvailable(candidate))
      .slice(0, limit)
      .map(summarizeOpportunityCandidate);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
      playCard: playCardCandidate ? summarizeOpportunityCandidate(playCardCandidate) : null,
      unavailableMain,
      resourceLockTradePreviews: Array.isArray(entry.details?.resourceLockTradePreviews)
        ? entry.details.resourceLockTradePreviews.slice(0, limit)
        : [],
      topCandidates,
    };
  }

  function sortByCandidatePolicy(candidates = []) {
    return [...(candidates || [])].sort((left, right) => (
      numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
      || getCandidateId(left).localeCompare(getCandidateId(right))
    ));
  }

  function getBestResourceLockTradePreview(previews = []) {
    return [...(previews || [])]
      .filter((preview) => preview && getFiniteScore(preview.bestAction?.score) != null)
      .sort((left, right) => (
        numeric(right.bestAction?.score) - numeric(left.bestAction?.score)
        || String(left.tradeId || "").localeCompare(String(right.tradeId || ""))
      ))[0] || null;
  }

  function classifyEarlyPassNoMain(profile = {}) {
    if (!profile.candidateCount) return "missing-pass-candidates";
    if (numeric(profile.bestMain?.policyScore) > 0) return "positive-main-available";
    const bestTradeScore = numeric(profile.bestResourceLockTrade?.bestAction?.score);
    if (bestTradeScore >= MEANINGFUL_RESOURCE_UNLOCK_SCORE) return "resource-trade-unlocks-main";
    if (bestTradeScore > 0) return "resource-trade-unlocks-low-main";
    if (profile.availableMainCount > 0) return "negative-main-only";
    const playCardReason = String(profile.playCard?.reason || "");
    if (playCardReason.includes("没有资源可支付")) {
      return numeric(profile.resources?.handSize) >= 2 ? "resource-locked-hand" : "low-hand-resource-lock";
    }
    if (profile.unavailableMainCount > 0) return "no-main-available";
    return "no-main-candidate";
  }

  function buildEarlyPassCandidateProfile(entry, candidates = [], limit = 5) {
    const availableCandidates = (candidates || []).filter(isCandidateAvailable);
    const availableMain = sortByCandidatePolicy(
      availableCandidates.filter((candidate) => candidate.kind === "main"),
    );
    const unavailableMain = (candidates || [])
      .filter((candidate) => candidate.kind === "main" && !isCandidateAvailable(candidate));
    const resourceLockTradePreviews = Array.isArray(entry.details?.resourceLockTradePreviews)
      ? entry.details.resourceLockTradePreviews.slice(0, limit)
      : [];
    const playCardCandidate = getPlayCardCandidate(candidates);
    const profile = {
      resources: entry.playerResources || null,
      candidateCount: (candidates || []).length,
      availableMainCount: availableMain.length,
      unavailableMainCount: unavailableMain.length,
      bestMain: availableMain[0] ? summarizeOpportunityCandidate(availableMain[0]) : null,
      topCandidates: sortByCandidatePolicy(availableCandidates)
        .slice(0, limit)
        .map(summarizeOpportunityCandidate),
      unavailableMain: unavailableMain
        .slice(0, limit)
        .map(summarizeOpportunityCandidate),
      playCard: playCardCandidate ? summarizeOpportunityCandidate(playCardCandidate) : null,
      resourceLockTradePreviews,
      bestResourceLockTrade: getBestResourceLockTradePreview(resourceLockTradePreviews),
    };
    return {
      ...profile,
      reasonTag: classifyEarlyPassNoMain(profile),
    };
  }

  function getTurnGroupKey(entry = {}) {
    return [
      entry.playerId || entry.playerLabel || "unknown",
      entry.roundNumber ?? "unknown",
      entry.rawTurnNumber ?? entry.turnNumber ?? "unknown",
    ].join("|");
  }

  function summarizeGroupedTurnAction(action = {}) {
    const id = String(action?.id || "unknown");
    return {
      id,
      kind: action?.kind || null,
      tradeId: action?.tradeId || null,
      label: action?.label || action?.cardLabel || action?.planetName || null,
      score: roundRatio(action?.score),
      pace: getActionPaceCategory(id, action),
    };
  }

  function getRoundPaceKey(roundNumber) {
    if (roundNumber == null || roundNumber === "") return "unknown";
    return String(roundNumber);
  }

  function ensureRoundPaceBucket(profile, roundNumber) {
    const key = getRoundPaceKey(roundNumber);
    if (!profile.roundPaceCounts[key]) {
      profile.roundPaceCounts[key] = {
        roundNumber: Number.isFinite(Number(roundNumber)) ? Number(roundNumber) : null,
        turnActionCount: 0,
        actionCounts: {},
        paceCounts: {},
      };
    }
    return profile.roundPaceCounts[key];
  }

  function summarizeRoundPaceBucket(bucket = {}) {
    const actionCounts = bucket.actionCounts || {};
    const paceCounts = bucket.paceCounts || {};
    const mainActionCount = numeric(paceCounts.main);
    const quickStepCount = numeric(paceCounts.quick);
    const idleTurnCount = numeric(paceCounts.idle);
    const otherTurnActionCount = numeric(paceCounts.other);
    const turnActionCount = numeric(bucket.turnActionCount);
    const resourceQuickStepCount = numeric(actionCounts.placeData)
      + numeric(actionCounts.cardCorner)
      + numeric(actionCounts.quickTrade);
    return {
      roundNumber: bucket.roundNumber ?? null,
      turnActionCount,
      mainActionCount,
      quickStepCount,
      resourceQuickStepCount,
      productiveActionCount: mainActionCount + quickStepCount,
      idleTurnCount,
      otherTurnActionCount,
      quickToMainRatio: mainActionCount ? roundRatio(quickStepCount / mainActionCount) : 0,
      idleTurnRatio: turnActionCount ? roundRatio(idleTurnCount / turnActionCount) : 0,
      playCardCount: numeric(actionCounts.playCard),
      researchTechCount: numeric(actionCounts.researchTech),
      scanCount: numeric(actionCounts.scan),
      analyzeCount: numeric(actionCounts.analyze),
      moveCount: numeric(actionCounts.move),
      placeDataCount: numeric(actionCounts.placeData),
      cardCornerCount: numeric(actionCounts.cardCorner),
      quickTradeCount: numeric(actionCounts.quickTrade),
      passCount: numeric(actionCounts.pass),
      actionCounts: { ...actionCounts },
    };
  }

  function recordRoundPace(profile, entry, actionId, action) {
    const bucket = ensureRoundPaceBucket(profile, entry.roundNumber);
    bucket.turnActionCount += 1;
    increment(bucket.actionCounts, actionId);
    increment(bucket.paceCounts, getActionPaceCategory(actionId, action));
  }

  function buildEarlyPassNoMainSamples(logs = [], playerResults = [], limit = Infinity) {
    const playerResultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const groups = new Map();
    for (const entry of logs || []) {
      if (entry.type !== "turn-action") continue;
      const action = getSelectedAction(entry) || {};
      const actionId = getSelectedActionId(entry);
      const key = getTurnGroupKey(entry);
      if (!groups.has(key)) {
        groups.set(key, {
          playerId: entry.playerId || null,
          playerLabel: entry.playerLabel || entry.playerId || "unknown",
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          resources: entry.playerResources || null,
          passResources: null,
          actions: [],
          mainActionCount: 0,
          quickStepCount: 0,
          quickBeforePassCount: 0,
          quickAfterPassCount: 0,
          passed: false,
          passCandidateProfile: null,
        });
      }
      const group = groups.get(key);
      const pace = getActionPaceCategory(actionId, action);
      if (pace === "main") group.mainActionCount += 1;
      if (pace === "quick") {
        group.quickStepCount += 1;
        if (group.passed) group.quickAfterPassCount += 1;
        else group.quickBeforePassCount += 1;
      }
      if (actionId === "pass") {
        group.passed = true;
        group.passResources = entry.playerResources || group.passResources;
        group.passCandidateProfile = buildEarlyPassCandidateProfile(entry, entry.details?.candidates || []);
      }
      group.actions.push(summarizeGroupedTurnAction(action));
      group.resources = entry.playerResources || group.resources;
    }
    const samples = [...groups.values()]
      .filter((group) => group.passed && group.mainActionCount <= 0)
      .map((group) => {
        const result = playerResultById.get(group.playerId) || {};
        const resources = group.passResources || group.resources || {};
        return {
          playerId: group.playerId,
          playerLabel: group.playerLabel,
          finalScore: roundRatio(result.finalScore),
          roundNumber: group.roundNumber,
          turnNumber: group.turnNumber,
          rawTurnNumber: group.rawTurnNumber,
          resources,
          quickStepCount: group.quickStepCount,
          quickBeforePassCount: group.quickBeforePassCount,
          quickAfterPassCount: group.quickAfterPassCount,
          reasonTag: group.passCandidateProfile?.reasonTag || null,
          candidateProfile: group.passCandidateProfile || null,
          actionIds: group.actions.map((action) => action.tradeId ? `${action.id}:${action.tradeId}` : action.id),
          actions: group.actions,
          resourceProfile: {
            credits: roundRatio(resources.credits),
            energy: roundRatio(resources.energy),
            publicity: roundRatio(resources.publicity),
            handSize: roundRatio(resources.handSize),
            availableData: roundRatio(resources.availableData),
          },
        };
      });
    return sortEarlyPassNoMainSamples(samples, limit);
  }

  function sortEarlyPassNoMainSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.rawTurnNumber) - numeric(right.rawTurnNumber)
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function getResourceLockMainUnlockScore(sample = {}) {
    return numeric(
      sample?.bestResourceLockTrade?.bestAction?.score
      ?? sample?.candidateProfile?.bestResourceLockTrade?.bestAction?.score,
    );
  }

  function sortResourceLockMainUnlockSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || getResourceLockMainUnlockScore(right) - getResourceLockMainUnlockScore(left)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.rawTurnNumber) - numeric(right.rawTurnNumber)
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function buildResourceLockMainUnlockSamples(earlyPassSamples = [], limit = 12) {
    const samples = (earlyPassSamples || [])
      .filter((sample) => getResourceLockMainUnlockScore(sample) >= MEANINGFUL_RESOURCE_UNLOCK_SCORE)
      .map((sample) => ({
        playerId: sample.playerId || null,
        playerLabel: sample.playerLabel || null,
        finalScore: roundRatio(sample.finalScore),
        roundNumber: sample.roundNumber ?? null,
        turnNumber: sample.turnNumber ?? null,
        rawTurnNumber: sample.rawTurnNumber ?? null,
        resources: sample.resources || null,
        resourceProfile: sample.resourceProfile || null,
        quickStepCount: numeric(sample.quickStepCount),
        quickBeforePassCount: numeric(sample.quickBeforePassCount),
        quickAfterPassCount: numeric(sample.quickAfterPassCount),
        reasonTag: sample.reasonTag || null,
        bestResourceLockTrade: sample.candidateProfile?.bestResourceLockTrade || null,
        resourceLockTradePreviews: sample.candidateProfile?.resourceLockTradePreviews || [],
        bestMain: sample.candidateProfile?.bestMain || null,
        playCard: sample.candidateProfile?.playCard || null,
        topCandidates: sample.candidateProfile?.topCandidates || [],
        unavailableMain: sample.candidateProfile?.unavailableMain || [],
        actionIds: sample.actionIds || [],
        actions: sample.actions || [],
      }));
    return sortResourceLockMainUnlockSamples(samples, limit);
  }

  function countEarlyPassNoMainReasons(samples = []) {
    const counts = {};
    for (const sample of samples || []) {
      increment(counts, sample?.reasonTag || "unknown");
    }
    return counts;
  }

  function getResourceDelta(fromResources = {}, toResources = {}) {
    const keys = ["credits", "energy", "handSize", "availableData", "publicity"];
    const delta = {};
    for (const key of keys) {
      delta[key] = roundRatio(numeric(fromResources?.[key]) - numeric(toResources?.[key]));
    }
    delta.totalDrain = roundRatio(keys.reduce((total, key) => total + Math.max(0, numeric(delta[key])), 0));
    return delta;
  }

  function findPassEntryForEarlyPassSample(turnEntries = [], sample = {}) {
    return turnEntries.find((entry) => (
      entry.playerId === sample.playerId
      && numeric(entry.roundNumber) === numeric(sample.roundNumber)
      && numeric(entry.rawTurnNumber ?? entry.turnNumber) === numeric(sample.rawTurnNumber)
      && getSelectedActionId(entry) === "pass"
    )) || null;
  }

  function findPreviousNonIdleTurnAction(turnEntries = [], passEntry = null) {
    if (!passEntry) return null;
    const passIndex = turnEntries.indexOf(passEntry);
    for (let index = passIndex - 1; index >= 0; index -= 1) {
      const entry = turnEntries[index];
      if (entry.playerId !== passEntry.playerId) continue;
      if (numeric(entry.roundNumber) !== numeric(passEntry.roundNumber)) continue;
      if (numeric(entry.rawTurnNumber ?? entry.turnNumber) > numeric(passEntry.rawTurnNumber ?? passEntry.turnNumber)) continue;
      const actionId = getSelectedActionId(entry);
      if (actionId === "pass" || actionId === "end-turn") continue;
      return entry;
    }
    return null;
  }

  function summarizePreNoMainPassResourceDrainAction(entry = {}) {
    const action = getSelectedAction(entry) || {};
    return {
      id: getSelectedActionId(entry),
      kind: action.kind || null,
      tradeId: action.tradeId || null,
      label: action.label || action.cardLabel || action.planetName || null,
      score: roundRatio(action.score),
      policyScore: roundRatio(getCandidatePolicyScore(action)),
      directScoreGain: roundRatio(action.directScoreGain),
      cardId: action.cardId || null,
      cardLabel: action.cardLabel || null,
      routeTarget: action.routeTarget || null,
      valueBreakdown: action.valueBreakdown || action.breakdown || null,
    };
  }

  function buildPreNoMainPassResourceDrainSamples(logs = [], playerResults = [], earlyPassSamples = [], limit = 12) {
    const playerResultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const turnEntries = (logs || []).filter((entry) => entry.type === "turn-action");
    const samples = [];
    for (const passSample of earlyPassSamples || []) {
      const passEntry = findPassEntryForEarlyPassSample(turnEntries, passSample);
      const previousEntry = findPreviousNonIdleTurnAction(turnEntries, passEntry);
      if (!passEntry || !previousEntry) continue;
      const delta = getResourceDelta(previousEntry.playerResources || {}, passEntry.playerResources || {});
      if (numeric(delta.totalDrain) <= 0) continue;
      const result = playerResultById.get(passSample.playerId) || {};
      samples.push({
        playerId: passSample.playerId,
        playerLabel: passSample.playerLabel,
        finalScore: roundRatio(result.finalScore ?? passSample.finalScore),
        roundNumber: passSample.roundNumber,
        rawTurnNumber: passSample.rawTurnNumber,
        reasonTag: passSample.reasonTag || null,
        passResources: passEntry.playerResources || null,
        previousRoundNumber: previousEntry.roundNumber ?? null,
        previousRawTurnNumber: previousEntry.rawTurnNumber ?? previousEntry.turnNumber ?? null,
        previousResources: previousEntry.playerResources || null,
        rawTurnDistance: roundRatio(
          numeric(passEntry.rawTurnNumber ?? passEntry.turnNumber)
            - numeric(previousEntry.rawTurnNumber ?? previousEntry.turnNumber),
        ),
        previousAction: summarizePreNoMainPassResourceDrainAction(previousEntry),
        resourceDeltaToPass: delta,
        passActionIds: passSample.actionIds || [],
        candidateProfile: passSample.candidateProfile || null,
      });
    }
    return sortPreNoMainPassResourceDrainSamples(samples, limit);
  }

  function sortPreNoMainPassResourceDrainSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(right.resourceDeltaToPass?.totalDrain) - numeric(left.resourceDeltaToPass?.totalDrain)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.rawTurnNumber) - numeric(right.rawTurnNumber)
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function getMovePaymentAfterEntry(entries = [], startIndex = 0) {
    for (let index = startIndex + 1; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry?.type === "move-payment") return entry;
      if (entry?.type === "turn-action") return null;
    }
    return null;
  }

  function summarizePostPassQuickAction(entry = {}, entries = [], entryIndex = 0) {
    const action = getSelectedAction(entry) || {};
    const actionId = getSelectedActionId(entry);
    const valueBreakdown = action.valueBreakdown || {};
    const movePayment = actionId === "move" ? getMovePaymentAfterEntry(entries, entryIndex) : null;
    const selectedHandIndices = Array.isArray(movePayment?.details?.selectedHandIndices)
      ? movePayment.details.selectedHandIndices
      : null;
    const moveCardSpent = selectedHandIndices
      ? selectedHandIndices.length
      : Math.max(0, numeric(valueBreakdown.moveCardSpent));
    const moveEnergySpent = movePayment?.details?.energyCost != null
      ? Math.max(0, numeric(movePayment.details.energyCost))
      : Math.max(0, numeric(valueBreakdown.moveEnergySpent));
    const followupMainAction = action.followupMainAction || null;
    const followupScore = numeric(followupMainAction?.score ?? valueBreakdown.followupScore);
    const resources = entry.playerResources || {};
    const handSize = Math.max(0, numeric(resources.handSize));
    const handAfterMovePayment = Math.max(0, handSize - moveCardSpent);
    const routeTarget = action.routeTarget || null;
    const routeTargetDistance = Math.max(0, Math.round(numeric(routeTarget?.newDistance)));
    const isPaidMoveNoFollowup = actionId === "move"
      && (moveCardSpent > 0 || moveEnergySpent > 0)
      && followupScore <= 0;
    const isThinHandNoFollowupMove = isPaidMoveNoFollowup
      && moveCardSpent > 0
      && Math.max(0, numeric(resources.energy)) <= 0
      && handAfterMovePayment <= 1
      && routeTarget?.kind === "planet"
      && routeTargetDistance <= 1;
    return {
      action: summarizeGroupedTurnAction(action),
      resources,
      payment: actionId === "move"
        ? {
          requiredMovePoints: roundRatio(valueBreakdown.requiredMovePoints ?? movePayment?.details?.requiredMovePoints),
          moveCardSpent: roundRatio(moveCardSpent),
          moveEnergySpent: roundRatio(moveEnergySpent),
          handAfterMovePayment: roundRatio(handAfterMovePayment),
        }
        : null,
      routeTarget: routeTarget
        ? {
          kind: routeTarget.kind || null,
          id: routeTarget.id || routeTarget.planetId || null,
          planetId: routeTarget.planetId || routeTarget.id || null,
          newDistance: roundRatio(routeTarget.newDistance),
        }
        : null,
      followupMainAction: followupMainAction
        ? {
          actionId: followupMainAction.actionId || null,
          timing: followupMainAction.timing || null,
          planetId: followupMainAction.planetId || null,
          score: roundRatio(followupMainAction.score),
          directScoreGain: roundRatio(followupMainAction.directScoreGain),
        }
        : null,
      flags: {
        paidMoveNoFollowup: isPaidMoveNoFollowup,
        thinHandNoFollowupMove: isThinHandNoFollowupMove,
      },
      valueBreakdown: actionId === "move"
        ? {
          routeScore: roundRatio(valueBreakdown.routeScore),
          routeScoreForGain: roundRatio(valueBreakdown.routeScoreForGain),
          followupScore: roundRatio(valueBreakdown.followupScore),
          followupTiming: valueBreakdown.followupTiming || null,
          paymentCost: roundRatio(valueBreakdown.paymentCost),
          movementCost: roundRatio(valueBreakdown.movementCost),
        }
        : null,
    };
  }

  function buildPostPassQuickAnalysis(logs = [], playerResults = [], limit = Infinity) {
    const playerResultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const groups = new Map();
    for (const entry of logs || []) {
      if (!["turn-action", "move-payment"].includes(entry.type)) continue;
      const key = getTurnGroupKey(entry);
      if (!groups.has(key)) {
        groups.set(key, {
          playerId: entry.playerId || null,
          playerLabel: entry.playerLabel || entry.playerId || "unknown",
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          entries: [],
        });
      }
      groups.get(key).entries.push(entry);
    }

    const counts = {
      postPassQuickAfterPass: 0,
      postPassPaidMoveNoFollowup: 0,
      postPassThinHandNoFollowupMove: 0,
    };
    const samples = [];
    for (const group of groups.values()) {
      let seenPass = false;
      const turnActions = group.entries.filter((entry) => entry.type === "turn-action");
      const actionIds = turnActions.map((entry) => {
        const action = getSelectedAction(entry) || {};
        return action.tradeId ? `${getSelectedActionId(entry)}:${action.tradeId}` : getSelectedActionId(entry);
      });
      for (let index = 0; index < group.entries.length; index += 1) {
        const entry = group.entries[index];
        if (entry.type !== "turn-action") continue;
        const actionId = getSelectedActionId(entry);
        const action = getSelectedAction(entry) || {};
        if (actionId === "pass") {
          seenPass = true;
          continue;
        }
        if (!seenPass || getActionPaceCategory(actionId, action) !== "quick") continue;
        counts.postPassQuickAfterPass += 1;
        const postAction = summarizePostPassQuickAction(entry, group.entries, index);
        if (postAction.flags.paidMoveNoFollowup) counts.postPassPaidMoveNoFollowup += 1;
        if (postAction.flags.thinHandNoFollowupMove) counts.postPassThinHandNoFollowupMove += 1;
        if (samples.length < limit) {
          const result = playerResultById.get(group.playerId) || {};
          samples.push({
            playerId: group.playerId,
            playerLabel: group.playerLabel,
            finalScore: roundRatio(result.finalScore),
            roundNumber: group.roundNumber,
            turnNumber: group.turnNumber,
            rawTurnNumber: group.rawTurnNumber,
            actionIds,
            postAction,
          });
        }
      }
    }
    samples.sort((left, right) => (
      numeric(left.finalScore) - numeric(right.finalScore)
      || numeric(left.roundNumber) - numeric(right.roundNumber)
      || numeric(left.rawTurnNumber) - numeric(right.rawTurnNumber)
    ));
    return {
      counts,
      samples: samples.slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined),
    };
  }

  function buildFinalLowHandPassRecoverySample(entry) {
    const diagnostic = entry?.details?.finalLowHandPassRecoveryDiagnostic || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
      currentScore: roundRatio(diagnostic.currentScore),
      finalMarkCount: numeric(diagnostic.finalMarkCount),
      nextFinalMarkThreshold: diagnostic.nextFinalMarkThreshold ?? null,
      handSize: numeric(diagnostic.handSize),
      bestPublicTradeCardScore: roundRatio(diagnostic.bestPublicTradeCardScore),
      topPublicTradeCards: Array.isArray(diagnostic.topPublicTradeCards)
        ? diagnostic.topPublicTradeCards.slice(0, 5)
        : [],
      cardsForPickCardPreview: diagnostic.cardsForPickCardPreview || null,
      tradeChecks: Array.isArray(diagnostic.tradeChecks)
        ? diagnostic.tradeChecks.slice(0, 8)
        : [],
      lateRecoveryGate: diagnostic.lateRecoveryGate || null,
      availableQuick: Array.isArray(diagnostic.availableQuick)
        ? diagnostic.availableQuick.slice(0, 5)
        : [],
      lateRecoveryPreviewCandidates: Array.isArray(diagnostic.lateRecoveryPreviewCandidates)
        ? diagnostic.lateRecoveryPreviewCandidates.slice(0, 5)
        : [],
      unavailableMain: Array.isArray(diagnostic.unavailableMain)
        ? diagnostic.unavailableMain.slice(0, 6)
        : [],
    };
  }

  function getFinalPublicRefillResources(entry, diagnostic = {}) {
    const resources = entry?.playerResources || {};
    return {
      credits: numeric(resources.credits ?? diagnostic.credits),
      energy: numeric(resources.energy ?? diagnostic.energy),
      publicity: numeric(resources.publicity ?? diagnostic.publicity),
      handSize: numeric(resources.handSize ?? diagnostic.handSize),
    };
  }

  function getBestPublicRefillCard(diagnostic = {}) {
    if (Array.isArray(diagnostic.topPublicTradeCards) && diagnostic.topPublicTradeCards.length) {
      return diagnostic.topPublicTradeCards[0];
    }
    return diagnostic.cardsForPickCardPreview?.bestPublicTradeCard || null;
  }

  function getFinalPublicRefillTradeChecks(diagnostic = {}) {
    return (Array.isArray(diagnostic.tradeChecks) ? diagnostic.tradeChecks : [])
      .filter((check) => PUBLIC_REFILL_TRADE_IDS.includes(check?.tradeId));
  }

  function buildResourceShortfallForTrade(check = {}, resources = {}) {
    const cost = check.cost || {};
    const missing = [];
    for (const key of RESOURCE_SHORTFALL_KEYS) {
      const required = numeric(cost[key]);
      if (required <= 0) continue;
      const available = Math.max(0, numeric(resources[key]));
      if (available >= required) continue;
      missing.push({
        resource: key,
        required: roundRatio(required),
        available: roundRatio(available),
        missing: roundRatio(required - available),
      });
    }
    if (!missing.length) return null;
    return {
      tradeId: check.tradeId || null,
      reason: check.reason || null,
      cost: check.cost || null,
      missing,
      totalMissing: roundRatio(missing.reduce((total, item) => total + numeric(item.missing), 0)),
    };
  }

  function buildFinalPublicRefillShortfalls(entry) {
    const diagnostic = entry?.details?.finalLowHandPassRecoveryDiagnostic || {};
    const resources = getFinalPublicRefillResources(entry, diagnostic);
    return getFinalPublicRefillTradeChecks(diagnostic)
      .filter((check) => check && !check.ok)
      .map((check) => buildResourceShortfallForTrade(check, resources))
      .filter(Boolean);
  }

  function isFinalPublicRefillShortfall(entry) {
    const diagnostic = entry?.details?.finalLowHandPassRecoveryDiagnostic;
    if (!diagnostic) return false;
    const bestScore = getFiniteScore(diagnostic.bestPublicTradeCardScore)
      ?? getFiniteScore(getBestPublicRefillCard(diagnostic)?.tradeScore)
      ?? getFiniteScore(diagnostic.cardsForPickCardPreview?.bestPublicTradeCardScore);
    if (bestScore == null || bestScore < FINAL_PUBLIC_REFILL_SHORTFALL_SCORE) return false;
    const refillChecks = getFinalPublicRefillTradeChecks(diagnostic);
    if (!refillChecks.length || refillChecks.some((check) => check?.ok)) return false;
    return buildFinalPublicRefillShortfalls(entry).length > 0;
  }

  function buildFinalPublicRefillShortfallSample(entry) {
    const diagnostic = entry?.details?.finalLowHandPassRecoveryDiagnostic || {};
    const resources = getFinalPublicRefillResources(entry, diagnostic);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources,
      selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
      currentScore: roundRatio(diagnostic.currentScore),
      finalMarkCount: numeric(diagnostic.finalMarkCount),
      handSize: numeric(diagnostic.handSize),
      bestPublicTradeCardScore: roundRatio(diagnostic.bestPublicTradeCardScore),
      bestPublicTradeCard: getBestPublicRefillCard(diagnostic),
      shortfalls: buildFinalPublicRefillShortfalls(entry),
      tradeChecks: getFinalPublicRefillTradeChecks(diagnostic),
      cardsForPickCardPreview: diagnostic.cardsForPickCardPreview || null,
      unavailableMain: Array.isArray(diagnostic.unavailableMain)
        ? diagnostic.unavailableMain.slice(0, 6)
        : [],
    };
  }

  function isNegativeCardCornerGraphLift(entry) {
    const action = getSelectedAction(entry);
    if (getCandidateId(action) !== "cardCorner") return false;
    const rawScore = getFiniteScore(action?.score);
    const graphNet = getFiniteScore(action?.actionGraph?.net ?? action?.net);
    return rawScore != null && rawScore < 0 && graphNet != null && graphNet > rawScore;
  }

  function buildNegativeCardCornerGraphLiftSample(entry) {
    const action = getSelectedAction(entry) || {};
    const graph = action.actionGraph || {};
    const breakdown = action.breakdown || action.valueBreakdown || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(action),
      cardId: action.cardId || null,
      cardInstanceId: action.cardInstanceId || null,
      cardLabel: action.cardLabel || action.label || null,
      actionKind: action.actionKind || null,
      rawScore: roundRatio(action.score),
      policyScore: roundRatio(getCandidatePolicyScore(action)),
      graphNet: roundRatio(graph.net),
      graphGain: roundRatio(graph.gain),
      graphCost: roundRatio(graph.cost),
      finalMarginal: roundRatio(graph.finalMarginal),
      goalBonus: roundRatio(graph.goalBonus),
      rewardValue: roundRatio(breakdown.rewardValue),
      discardCost: roundRatio(breakdown.discardCost),
      handPressure: roundRatio(breakdown.handPressure),
      followupMainActionScore: roundRatio(breakdown.followupMainActionScore),
      moveFollowupScore: roundRatio(breakdown.moveFollowupScore),
      noCashoutMovePenalty: roundRatio(breakdown.noCashoutMovePenalty),
    };
  }

  function isResearchTechEffectType(type) {
    return type === "card_research_tech" || type === "research_tech_select" || type === "research_tech";
  }

  function getNestedPlayCardPolicyScore(card) {
    return POLICY_ACTION_BIAS.playCard + scoreNestedPlayCardCandidate(card);
  }

  function getBestPlayableCard(playCardCandidate = {}) {
    const playableCards = Array.isArray(playCardCandidate?.playableCards)
      ? playCardCandidate.playableCards
      : [];
    return playableCards
      .filter(isCandidateAvailable)
      .sort((left, right) => (
        numeric(getNestedPlayCardPolicyScore(right)) - numeric(getNestedPlayCardPolicyScore(left))
        || String(left.cardId || left.cardInstanceId || "").localeCompare(String(right.cardId || right.cardInstanceId || ""))
      ))[0] || null;
  }

  function isPlayCardNearMiss(entry, candidates = []) {
    if (getSelectedActionId(entry) === "playCard") return false;
    const playCardCandidate = getPlayCardCandidate(candidates);
    if (!isCandidateAvailable(playCardCandidate)) return false;
    if (!getBestPlayableCard(playCardCandidate)) return false;
    const selectedCandidate = getSelectedCandidate(entry, candidates);
    const playPolicyScore = getFiniteScore(getCandidatePolicyScore(playCardCandidate));
    const selectedPolicyScore = getFiniteScore(getCandidatePolicyScore(selectedCandidate));
    if (playPolicyScore == null || selectedPolicyScore == null) return false;
    const policyScoreGap = selectedPolicyScore - playPolicyScore;
    if (playPolicyScore >= 20 && policyScoreGap <= 18) return true;
    if (playPolicyScore >= 45) return true;
    const playGraphNet = getCandidateActionGraphNet(playCardCandidate);
    const selectedGraphNet = getCandidateActionGraphNet(selectedCandidate);
    return playGraphNet != null && selectedGraphNet != null && playGraphNet >= selectedGraphNet - 12;
  }

  function summarizePlayCardPlan(plan = null) {
    if (!plan) return null;
    return {
      type: plan.type || null,
      actionId: plan.actionId || null,
      score: roundRatio(plan.score),
      label: plan.label || plan.targetLabel || plan.planetName || null,
    };
  }

  function summarizePlayCardValueBreakdown(card = {}) {
    const breakdown = card.valueBreakdown || card.breakdown || {};
    return {
      planScore: roundRatio(breakdown.planScore ?? card.plan?.score),
      lateCardEnginePressure: roundRatio(breakdown.lateCardEnginePressure),
      playCardConversionPressure: roundRatio(breakdown.playCardConversionPressure),
      cFinalTaskProgressValue: roundRatio(breakdown.cFinalTaskProgressValue),
      c2Type3ProgressValue: roundRatio(breakdown.c2Type3ProgressValue),
      endGameExpectedScore: roundRatio(breakdown.endGameExpectedScore),
      standardActionPremium: roundRatio(breakdown.standardActionPremium),
      finalSecondMarkNoDirectSetupPenalty: roundRatio(breakdown.finalSecondMarkNoDirectSetupPenalty),
    };
  }

  function getPlayCardNearMissConcreteValue(sample = {}) {
    const breakdown = sample.bestCard?.valueBreakdown || {};
    return [
      sample.bestCard?.directScoreGain,
      breakdown.planScore,
      breakdown.lateCardEnginePressure,
      breakdown.playCardConversionPressure,
      breakdown.cFinalTaskProgressValue,
      breakdown.c2Type3ProgressValue,
      breakdown.endGameExpectedScore,
      breakdown.standardActionPremium,
    ].reduce((total, value) => total + Math.max(0, numeric(value)), 0);
  }

  function sortPlayCardNearMissSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        (getFiniteScore(left.finalScore) ?? Infinity) - (getFiniteScore(right.finalScore) ?? Infinity)
        || numeric(left.policyScoreGap) - numeric(right.policyScoreGap)
        || getPlayCardNearMissConcreteValue(right) - getPlayCardNearMissConcreteValue(left)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.turnNumber) - numeric(right.turnNumber)
      ))
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function buildPlayCardNearMissSample(entry, candidates = [], playerResultById = new Map()) {
    const playCardCandidate = getPlayCardCandidate(candidates);
    const selectedCandidate = getSelectedCandidate(entry, candidates);
    const bestCard = getBestPlayableCard(playCardCandidate);
    const playGraphNet = getCandidateActionGraphNet(playCardCandidate);
    const selectedGraphNet = getCandidateActionGraphNet(selectedCandidate);
    const result = playerResultById?.get?.(entry.playerId) || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      finalScore: roundRatio(result.finalScore),
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(selectedCandidate || {}),
      playCard: playCardCandidate ? summarizeOpportunityCandidate(playCardCandidate) : null,
      policyScoreGap: roundRatio(numeric(getCandidatePolicyScore(selectedCandidate)) - numeric(getCandidatePolicyScore(playCardCandidate))),
      actionGraphNetGap: selectedGraphNet == null || playGraphNet == null
        ? null
        : roundRatio(selectedGraphNet - playGraphNet),
      bestCard: bestCard
        ? {
          cardId: bestCard.cardId || null,
          cardInstanceId: bestCard.cardInstanceId || null,
          label: bestCard.cardLabel || bestCard.label || null,
          price: numeric(bestCard.price),
          typeCode: numeric(bestCard.typeCode),
          score: roundRatio(bestCard.score),
          policyScore: roundRatio(getNestedPlayCardPolicyScore(bestCard)),
          directScoreGain: roundRatio(bestCard.directScoreGain),
          effectTypes: bestCard.effectTypes || [],
          plan: summarizePlayCardPlan(bestCard.plan),
          valueBreakdown: summarizePlayCardValueBreakdown(bestCard),
        }
        : null,
    };
  }

  function getScanCandidate(candidates = []) {
    return (candidates || []).find((candidate) => getCandidateId(candidate) === "scan") || null;
  }

  function resultHasB2SectorBottleneck(result = {}) {
    const progress = result?.b2Progress || null;
    if (!progress) return false;
    if (String(progress.bottleneck || "") === "sectorWins") return true;
    const sectorWins = numeric(progress.sectorWins);
    const orbitLandCount = numeric(progress.orbitLandCount);
    return numeric(progress.deficit) > 0 && sectorWins < orbitLandCount;
  }

  function scanPreviewChoiceHasB2Value(choice = {}, options = {}) {
    const b2 = choice?.b2 || null;
    if (!b2) return false;
    if (options.requireCommittedB2 && !b2.marked && !options.finalB2SectorBottleneck) return false;
    return Boolean(
      b2.marked
      || b2.winsAfterScan
      || numeric(b2.focus) > 0
      || numeric(b2.deficit) > 0
    );
  }

  function summarizeB2ScanPreviewChoice(choice = {}) {
    const b2 = choice.b2 || {};
    return {
      targetRank: choice.targetRank == null ? null : numeric(choice.targetRank),
      effectType: choice.effectType || null,
      pendingType: choice.pendingType || null,
      nebulaId: choice.nebulaId || null,
      sectorX: choice.sectorX ?? null,
      label: choice.label || null,
      score: roundRatio(choice.score),
      directScoreGain: roundRatio(choice.directScoreGain),
      b2: {
        focus: roundRatio(b2.focus),
        active: Boolean(b2.active),
        marked: Boolean(b2.marked),
        sectorWins: numeric(b2.sectorWins),
        orbitLandCount: numeric(b2.orbitLandCount),
        deficit: numeric(b2.deficit),
        multiplier: numeric(b2.multiplier),
        ownCount: numeric(b2.ownCount),
        openCount: numeric(b2.openCount),
        markedCount: numeric(b2.markedCount),
        maxOtherCount: numeric(b2.maxOtherCount),
        winsAfterScan: Boolean(b2.winsAfterScan),
      },
    };
  }

  function compareB2ScanPreviewUrgency(left = {}, right = {}) {
    return (
      numeric(right.b2?.winsAfterScan) - numeric(left.b2?.winsAfterScan)
      || numeric(right.b2?.deficit) - numeric(left.b2?.deficit)
      || numeric(right.b2?.focus) - numeric(left.b2?.focus)
      || numeric(right.score) - numeric(left.score)
      || numeric(left.targetRank) - numeric(right.targetRank)
    );
  }

  function getBestB2ScanPreviewChoice(choices = []) {
    return [...(choices || [])].sort(compareB2ScanPreviewUrgency)[0] || null;
  }

  function getB2ScanPreviewChoices(scanCandidate = {}, limit = 6, options = {}) {
    const preview = scanCandidate?.targetPreview || {};
    const effectChoices = (preview.effects || []).flatMap((effect) => (
      (effect.topChoices || []).map((choice) => ({
        ...choice,
        effectType: choice.effectType || effect.effectType || null,
        pendingType: choice.pendingType || effect.pendingType || null,
      }))
    ));
    const sourceChoices = Array.isArray(preview.topChoices) && preview.topChoices.length
      ? preview.topChoices
      : effectChoices;
    const seen = new Set();
    return (sourceChoices || [])
      .map((choice, index) => ({ ...choice, targetRank: index + 1 }))
      .filter((choice) => scanPreviewChoiceHasB2Value(choice, options))
      .map(summarizeB2ScanPreviewChoice)
      .filter((choice) => {
        const key = [
          choice.effectType || "effect",
          choice.pendingType || "scan",
          choice.nebulaId || "nebula",
          choice.sectorX ?? "x",
        ].join(":");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function isB2ScanNearMiss(entry, candidates = [], playerResultById = new Map()) {
    if (getSelectedActionId(entry) === "scan") return false;
    const scanCandidate = getScanCandidate(candidates);
    if (!isCandidateAvailable(scanCandidate)) return false;
    const result = playerResultById?.get?.(entry.playerId) || {};
    return getB2ScanPreviewChoices(scanCandidate, 1, {
      requireCommittedB2: true,
      finalB2SectorBottleneck: numeric(entry.roundNumber) >= 3 && resultHasB2SectorBottleneck(result),
    }).length > 0;
  }

  function getB2ScanNearMissUrgency(sample = {}) {
    const bestChoice = sample.bestB2Choice || getBestB2ScanPreviewChoice(sample.topChoices || []) || {};
    const b2 = bestChoice.b2 || {};
    return numeric(b2.deficit) + (b2.winsAfterScan ? 3 : 0) + Math.max(0, numeric(b2.focus)) * 0.1;
  }

  function sortB2ScanNearMissSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        (getFiniteScore(left.finalScore) ?? Infinity) - (getFiniteScore(right.finalScore) ?? Infinity)
        || getB2ScanNearMissUrgency(right) - getB2ScanNearMissUrgency(left)
        || numeric(left.policyScoreGap) - numeric(right.policyScoreGap)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.turnNumber) - numeric(right.turnNumber)
      ))
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function buildB2ScanNearMissSample(entry, candidates = [], playerResultById = new Map()) {
    const scanCandidate = getScanCandidate(candidates);
    const selectedCandidate = getSelectedCandidate(entry, candidates);
    const selectedPolicyScore = getFiniteScore(getCandidatePolicyScore(selectedCandidate));
    const scanPolicyScore = getFiniteScore(getCandidatePolicyScore(scanCandidate));
    const selectedGraphNet = getCandidateActionGraphNet(selectedCandidate);
    const scanGraphNet = getCandidateActionGraphNet(scanCandidate);
    const result = playerResultById?.get?.(entry.playerId) || {};
    const finalB2SectorBottleneck = numeric(entry.roundNumber) >= 3 && resultHasB2SectorBottleneck(result);
    const topChoices = getB2ScanPreviewChoices(scanCandidate, 6, {
      requireCommittedB2: true,
      finalB2SectorBottleneck,
    });
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      finalScore: roundRatio(result.finalScore),
      resources: entry.playerResources || null,
      b2Progress: result.b2Progress || null,
      selected: summarizeOpportunityCandidate(selectedCandidate || {}),
      scan: scanCandidate
        ? {
          ...summarizeOpportunityCandidate(scanCandidate),
          scoreCapReason: scanCandidate.scoreCapReason || null,
          valueBreakdown: scanCandidate.valueBreakdown || null,
        }
        : null,
      policyScoreGap: selectedPolicyScore == null || scanPolicyScore == null
        ? null
        : roundRatio(selectedPolicyScore - scanPolicyScore),
      actionGraphNetGap: selectedGraphNet == null || scanGraphNet == null
        ? null
        : roundRatio(selectedGraphNet - scanGraphNet),
      topChoices,
      bestB2Choice: getBestB2ScanPreviewChoice(topChoices),
    };
  }

  function getB2TradeCandidates(candidates = []) {
    return (candidates || [])
      .filter((candidate) => (
        isCandidateAvailable(candidate)
        && getCandidateId(candidate) === "quickTrade"
        && (
          String(candidate.reason || "").includes("B2")
          || String(candidate.label || "").includes("B2")
          || numeric(candidate.valueBreakdown?.b2SectorScanUnlockByTrade?.[candidate.tradeId]) > 0
        )
      ))
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || numeric(right.score) - numeric(left.score)
        || String(left.tradeId || "").localeCompare(String(right.tradeId || ""))
      ));
  }

  function isB2TradeNearMiss(entry, candidates = [], playerResultById = new Map()) {
    const selected = getSelectedCandidate(entry, candidates);
    if (getCandidateId(selected) === "quickTrade" && String(selected?.reason || "").includes("B2")) return false;
    const b2Trades = getB2TradeCandidates(candidates);
    if (!b2Trades.length) return false;
    const result = playerResultById?.get?.(entry.playerId) || {};
    const finalScore = numeric(result.finalScore);
    return finalScore >= 260
      || resultHasB2SectorBottleneck(result)
      || numeric(b2Trades[0].score) >= 35;
  }

  function sortB2TradeNearMissSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .filter(Boolean)
      .sort((left, right) => (
        Math.abs(numeric(left.scoreTo300)) - Math.abs(numeric(right.scoreTo300))
        || numeric(left.policyScoreGap) - numeric(right.policyScoreGap)
        || numeric(right.bestTrade?.score) - numeric(left.bestTrade?.score)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.turnNumber) - numeric(right.turnNumber)
      ))
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function buildB2TradeNearMissSample(entry, candidates = [], playerResultById = new Map()) {
    const b2Trades = getB2TradeCandidates(candidates);
    const bestTrade = b2Trades[0] || null;
    const selectedCandidate = getSelectedCandidate(entry, candidates);
    const selectedPolicyScore = getFiniteScore(getCandidatePolicyScore(selectedCandidate));
    const tradePolicyScore = getFiniteScore(getCandidatePolicyScore(bestTrade));
    const selectedGraphNet = getCandidateActionGraphNet(selectedCandidate);
    const tradeGraphNet = getCandidateActionGraphNet(bestTrade);
    const result = playerResultById?.get?.(entry.playerId) || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      finalScore: roundRatio(result.finalScore),
      scoreTo300: roundRatio(300 - numeric(result.finalScore)),
      resources: entry.playerResources || null,
      b2Progress: result.b2Progress || null,
      selected: summarizeOpportunityCandidate(selectedCandidate || {}),
      bestTrade: bestTrade
        ? {
          ...summarizeOpportunityCandidate(bestTrade),
          valueBreakdown: bestTrade.valueBreakdown || bestTrade.breakdown || null,
        }
        : null,
      policyScoreGap: selectedPolicyScore == null || tradePolicyScore == null
        ? null
        : roundRatio(selectedPolicyScore - tradePolicyScore),
      actionGraphNetGap: selectedGraphNet == null || tradeGraphNet == null
        ? null
        : roundRatio(selectedGraphNet - tradeGraphNet),
      tradeCandidates: b2Trades.slice(0, 4).map((candidate) => ({
        ...summarizeOpportunityCandidate(candidate),
        valueBreakdown: candidate.valueBreakdown || candidate.breakdown || null,
      })),
    };
  }

  function getCompoundResearchTechCards(candidates = []) {
    const playCardCandidate = (candidates || [])
      .filter(isCandidateAvailable)
      .find((candidate) => getCandidateId(candidate) === "playCard");
    const playableCards = Array.isArray(playCardCandidate?.playableCards)
      ? playCardCandidate.playableCards
      : [];
    return playableCards
      .filter((card) => {
        if (!isCandidateAvailable(card)) return false;
        const effectTypes = Array.isArray(card.effectTypes) ? card.effectTypes : [];
        const hasResearchTech = effectTypes.some(isResearchTechEffectType);
        if (!hasResearchTech) return false;
        const breakdown = card.valueBreakdown || card.breakdown || {};
        return Number(card.typeCode) === 2
          || Number(card.typeCode) === 3
          || numeric(breakdown.cFinalTaskProgressValue) > 0
          || numeric(breakdown.endGameExpectedScore) > 0
          || numeric(breakdown.lateCardEnginePressure) > 0;
      })
      .sort((left, right) => (
        numeric(getNestedPlayCardPolicyScore(right)) - numeric(getNestedPlayCardPolicyScore(left))
        || String(left.cardId || "").localeCompare(String(right.cardId || ""))
      ));
  }

  function buildResearchTechCompoundCardSample(entry, candidates = []) {
    const availableCandidates = (candidates || []).filter(isCandidateAvailable);
    const researchTech = availableCandidates
      .filter((candidate) => getCandidateId(candidate) === "researchTech")
      .sort((left, right) => numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left)))[0] || null;
    const compoundCard = getCompoundResearchTechCards(availableCandidates)[0] || null;
    const bestTechTile = (researchTech?.takeable || [])
      .filter(isCandidateAvailable)
      .sort((left, right) => numeric(right.score) - numeric(left.score))[0] || null;
    const compoundPolicyScore = compoundCard
      ? getNestedPlayCardPolicyScore(compoundCard)
      : null;
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
      researchTech: researchTech ? summarizeOpportunityCandidate(researchTech) : null,
      bestTechTile: bestTechTile
        ? {
          tileId: bestTechTile.tileId || null,
          techType: bestTechTile.techType || null,
          score: roundRatio(bestTechTile.score),
          directScoreGain: roundRatio(bestTechTile.directScoreGain),
        }
        : null,
      compoundCard: compoundCard
        ? {
          cardId: compoundCard.cardId || null,
          cardInstanceId: compoundCard.cardInstanceId || null,
          label: compoundCard.cardLabel || compoundCard.label || null,
          price: numeric(compoundCard.price),
          typeCode: numeric(compoundCard.typeCode),
          score: roundRatio(compoundCard.score),
          policyScore: roundRatio(compoundPolicyScore),
          directScoreGain: roundRatio(compoundCard.directScoreGain),
          effectTypes: compoundCard.effectTypes || [],
        }
        : null,
      policyScoreGap: roundRatio(numeric(getCandidatePolicyScore(researchTech)) - numeric(compoundPolicyScore)),
    };
  }

  function getMainUnlockBestPlayCard(action = {}) {
    const breakdown = action.valueBreakdown || action.breakdown || {};
    return breakdown.bestPlayCard || null;
  }

  function isMainUnlockLowConcretePlay(entry) {
    const action = getSelectedAction(entry);
    if (getCandidateId(action) !== "quickTrade") return false;
    const breakdown = action?.valueBreakdown || action?.breakdown || {};
    if (!breakdown.mainUnlockTrade) return false;
    const bestPlay = getMainUnlockBestPlayCard(action);
    if (!bestPlay) return false;
    const concreteSignals = [
      bestPlay.directScoreGain,
      bestPlay.finalDeltaValue,
      bestPlay.c2Type3ProgressValue,
      bestPlay.cFinalTaskProgressValue,
      bestPlay.endGameExpectedScore,
    ];
    return concreteSignals.every((value) => numeric(value) <= 0);
  }

  function buildMainUnlockLowConcretePlaySample(entry) {
    const action = getSelectedAction(entry) || {};
    const breakdown = action.valueBreakdown || action.breakdown || {};
    const bestPlay = getMainUnlockBestPlayCard(action) || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(action),
      tradeId: action.tradeId || null,
      bestPlayCard: {
        handIndex: Number.isFinite(Number(bestPlay.handIndex)) ? Number(bestPlay.handIndex) : null,
        cardId: bestPlay.cardId || null,
        cardLabel: bestPlay.cardLabel || null,
        score: roundRatio(bestPlay.score),
        continuationValue: roundRatio(bestPlay.continuationValue),
        directScoreGain: roundRatio(bestPlay.directScoreGain),
        finalDeltaValue: roundRatio(bestPlay.finalDeltaValue),
        c2Type3ProgressValue: roundRatio(bestPlay.c2Type3ProgressValue),
        cFinalTaskProgressValue: roundRatio(bestPlay.cFinalTaskProgressValue),
        endGameExpectedScore: roundRatio(bestPlay.endGameExpectedScore),
      },
      currentBestPlayScore: roundRatio(breakdown.currentBestPlayScore),
      concreteFinalValue: roundRatio(breakdown.concreteFinalValue),
      discardCost: roundRatio(breakdown.discardCost),
      finalMarkCount: roundRatio(breakdown.finalMarkCount),
      nextFinalMarkThreshold: breakdown.nextFinalMarkThreshold || null,
      thresholdBonus: roundRatio(breakdown.thresholdBonus),
      finalLowTailOneCreditUnlock: Boolean(breakdown.finalLowTailOneCreditUnlock),
      finalHighScoreOneCreditUnlock: Boolean(breakdown.finalHighScoreOneCreditUnlock),
      highScoreProjectedScore: roundRatio(breakdown.highScoreProjectedScore),
    };
  }

  function isNonPositivePublicRefillPick(entry) {
    if (entry?.type !== "pick-card") return false;
    if (entry.details?.pendingType !== "trade") return false;
    const score = getFiniteScore(entry.details?.score);
    return score != null && score <= 0;
  }

  function buildNonPositivePublicRefillSample(entry) {
    const card = entry.details?.card || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      slotIndex: Number.isFinite(Number(entry.details?.slotIndex)) ? Number(entry.details.slotIndex) : null,
      score: roundRatio(entry.details?.score),
      cardId: card.cardId || card.id || null,
      cardLabel: card.cardName || card.label || entry.details?.cardLabel || null,
      price: roundRatio(card.price),
      typeCode: Number.isFinite(Number(card.cardTypeCode)) ? Number(card.cardTypeCode) : null,
      discardActionCode: card.discardActionCode ?? null,
      scanActionCode: card.scanActionCode ?? null,
      incomeCode: card.incomeCode ?? null,
    };
  }

  function isHighHandDrainEnergyTrade(entry) {
    const action = getSelectedAction(entry);
    if (getCandidateId(action) !== "quickTrade") return false;
    if (action?.tradeId !== "cards-for-energy") return false;
    const breakdown = action.valueBreakdown || action.breakdown || {};
    return numeric(breakdown.cardsForEnergyHandDrainPenalty) >= 8;
  }

  function isSameRawTurnEntry(left = {}, right = {}) {
    return left.playerId === right.playerId
      && numeric(left.roundNumber) === numeric(right.roundNumber)
      && numeric(left.rawTurnNumber ?? left.turnNumber) === numeric(right.rawTurnNumber ?? right.turnNumber);
  }

  function countPriorSameRawTurnActions(logs = [], entry = {}, predicate = () => false) {
    const entryIndex = logs.indexOf(entry);
    const limit = entryIndex >= 0 ? entryIndex : logs.length;
    let count = 0;
    for (let index = 0; index < limit; index += 1) {
      const candidate = logs[index];
      if (candidate?.type !== "turn-action") continue;
      if (!isSameRawTurnEntry(candidate, entry)) continue;
      if (predicate(candidate)) count += 1;
    }
    return count;
  }

  function findLaterSameRawTurnAction(logs = [], entry = {}, predicate = () => false) {
    const entryIndex = logs.indexOf(entry);
    const start = entryIndex >= 0 ? entryIndex + 1 : 0;
    for (let index = start; index < logs.length; index += 1) {
      const candidate = logs[index];
      if (candidate?.type !== "turn-action") continue;
      if (!isSameRawTurnEntry(candidate, entry)) continue;
      if (predicate(candidate)) return candidate;
    }
    return null;
  }

  function isCardsForEnergyTurnAction(entry = {}) {
    const action = getSelectedAction(entry);
    return getCandidateId(action) === "quickTrade" && action?.tradeId === "cards-for-energy";
  }

  function buildHighHandDrainEnergyTradeSample(entry, logs = []) {
    const action = getSelectedAction(entry) || {};
    const breakdown = action.valueBreakdown || action.breakdown || {};
    const planetPlan = breakdown.planetCashoutRecoveryPlan || null;
    const priorCardsForEnergyThisRawTurn = countPriorSameRawTurnActions(logs, entry, isCardsForEnergyTurnAction);
    const laterLastCardMove = findLaterSameRawTurnAction(logs, entry, isLastCardPreserveEnergyMove);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(action),
      priorCardsForEnergyThisRawTurn,
      handDrainPenalty: roundRatio(breakdown.cardsForEnergyHandDrainPenalty),
      currentScore: roundRatio(breakdown.currentScore),
      finalMarkCount: numeric(breakdown.finalMarkCount),
      canReachAnalyze: Boolean(breakdown.canReachAnalyze),
      planetCashoutRecoveryScore: roundRatio(breakdown.planetCashoutRecoveryScore),
      launchMoveRecoveryScore: roundRatio(breakdown.launchMoveRecoveryScore),
      planetPlan: planetPlan
        ? {
          kind: planetPlan.kind || null,
          planetId: planetPlan.planetId || null,
          targetEnergy: roundRatio(planetPlan.targetEnergy),
          directScore: roundRatio(planetPlan.directScore),
          rewardValue: roundRatio(planetPlan.rewardValue),
          energyAfterTrade: roundRatio(planetPlan.energyAfterTrade),
          afterTradeGap: roundRatio(planetPlan.afterTradeGap),
          reachesNextThreshold: Boolean(planetPlan.reachesNextThreshold),
          score: roundRatio(planetPlan.score),
        }
        : null,
      laterLastCardPreserveEnergyMove: laterLastCardMove
        ? buildLastCardPreserveEnergyMoveSample(laterLastCardMove)
        : null,
    };
  }

  function isLastCardPreserveEnergyMove(entry) {
    const action = getSelectedAction(entry);
    if (getCandidateId(action) !== "move") return false;
    const breakdown = action.valueBreakdown || action.breakdown || {};
    if (!breakdown.preserveEnergyForRouteCashout) return false;
    const handSize = numeric(entry?.playerResources?.handSize);
    const moveCardSpent = numeric(breakdown.moveCardSpent);
    return handSize > 0 && moveCardSpent > 0 && moveCardSpent >= handSize;
  }

  function summarizeRouteTarget(target = {}) {
    if (!target) return null;
    return {
      kind: target.kind || null,
      id: target.id || target.planetId || target.locationType || null,
      planetId: target.planetId || target.id || null,
      newDistance: target.newDistance == null ? null : roundRatio(target.newDistance),
      distance: target.distance == null ? null : roundRatio(target.distance),
      score: target.score == null ? null : roundRatio(target.score),
    };
  }

  function summarizeFollowupMainAction(followup = {}) {
    if (!followup) return null;
    return {
      actionId: followup.actionId || null,
      planetId: followup.planetId || null,
      timing: followup.timing || null,
      score: roundRatio(followup.score),
      directScoreGain: roundRatio(followup.directScoreGain),
      rewardValue: roundRatio(followup.rewardValue),
      energyCost: roundRatio(followup.energyCost),
    };
  }

  function buildLastCardPreserveEnergyMoveSample(entry) {
    const action = getSelectedAction(entry) || {};
    const breakdown = action.valueBreakdown || action.breakdown || {};
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(action),
      requiredMovePoints: roundRatio(breakdown.requiredMovePoints),
      moveCardSpent: roundRatio(breakdown.moveCardSpent),
      moveEnergySpent: roundRatio(breakdown.moveEnergySpent),
      energyAfterMovePayment: roundRatio(breakdown.energyAfterMovePayment),
      paymentCost: roundRatio(breakdown.paymentCost),
      pathPenalty: roundRatio(breakdown.pathPenalty),
      routeScore: roundRatio(breakdown.routeScore),
      routeScoreForGain: roundRatio(breakdown.routeScoreForGain),
      followupScore: roundRatio(breakdown.followupScore),
      followupTiming: breakdown.followupTiming || null,
      routeTarget: summarizeRouteTarget(action.routeTarget),
      followupMainAction: summarizeFollowupMainAction(action.followupMainAction),
    };
  }

  function getPlayerKey(entry) {
    return entry?.playerId || entry?.playerLabel || "unknown";
  }

  function getFinalScoreMarkSelection(entry) {
    return entry?.details?.selected || entry?.details?.mark || {};
  }

  function getFinalScoreMarkKey(entry) {
    const selected = getFinalScoreMarkSelection(entry);
    const tileId = selected.tileId || entry?.details?.mark?.tileId || "unknown";
    const formulaId = selected.formulaId || "unknown";
    return `${tileId}:${formulaId}`;
  }

  function getAvailableFinalScoreMarkCandidates(entry) {
    const candidates = Array.isArray(entry?.details?.candidates) ? entry.details.candidates : [];
    return candidates.filter((candidate) => candidate && candidate.available !== false);
  }

  function isNegativeThirdFinalMark(entry) {
    if (entry?.type !== "final-score-mark") return false;
    const selected = getFinalScoreMarkSelection(entry);
    const selectedScore = getFiniteScore(selected?.score);
    if (selectedScore == null || selectedScore >= 0) return false;
    const threshold = numeric(selected?.threshold ?? entry?.details?.pending?.threshold);
    if (threshold < 70) return false;
    const availableCandidates = getAvailableFinalScoreMarkCandidates(entry);
    if (!availableCandidates.length) return false;
    return availableCandidates.every((candidate) => numeric(candidate.score) <= 0);
  }

  function summarizeFinalScoreMarkCandidate(candidate = {}) {
    const breakdown = candidate.scoreBreakdown || {};
    return {
      tileId: candidate.tileId || null,
      formulaId: candidate.formulaId || null,
      threshold: numeric(candidate.threshold),
      baseValue: roundRatio(candidate.baseValue),
      multiplier: roundRatio(candidate.multiplier),
      immediateScore: roundRatio(candidate.immediateScore),
      score: roundRatio(candidate.score),
      zeroBaseLatePenalty: roundRatio(breakdown.zeroBaseLatePenalty),
      weakCFormulaPenalty: roundRatio(breakdown.weakCFormulaPenalty),
      b1FeasibilityPenalty: roundRatio(breakdown.b1FeasibilityPenalty),
      b2FeasibilityPenalty: roundRatio(breakdown.b2FeasibilityPenalty),
      b2OrbitLandCount: roundRatio(breakdown.b2OrbitLandCount),
      b2SectorWins: roundRatio(breakdown.b2SectorWins),
    };
  }

  function buildNegativeThirdFinalMarkSample(entry) {
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeFinalScoreMarkCandidate(getFinalScoreMarkSelection(entry) || {}),
      candidates: getAvailableFinalScoreMarkCandidates(entry)
        .slice(0, 6)
        .map(summarizeFinalScoreMarkCandidate),
    };
  }

  function ensurePlayerProfile(profiles, playerId, playerLabel) {
    const key = playerId || playerLabel || "unknown";
    if (!profiles[key]) {
      profiles[key] = {
        playerId: playerId || null,
        playerLabel: playerLabel || playerId || "unknown",
        finalScore: 0,
        baseScore: 0,
        tileScore: 0,
        cardScore: 0,
        completedTaskCount: 0,
        reservedCount: 0,
        handSize: 0,
        techCount: 0,
        rocketCount: 0,
        turnActionCount: 0,
        actionCounts: {},
        actionCategoryCounts: {},
        actionCategoryRatios: {},
        paceCounts: {},
        roundPaceCounts: {},
        roundPace: [],
        techTypeCounts: {},
        scanTargetCounts: {},
        routeTargetCounts: {},
        moveFollowupCounts: {},
        turnPlanCounts: {},
        turnPlanTypeCounts: {},
        turnPlanActionCounts: {},
        decisionCounts: {},
        metrics: {},
      };
    }
    return profiles[key];
  }

  function addProfileMetric(profile, metric, amount = 1) {
    profile.metrics[metric] = numeric(profile.metrics[metric]) + numeric(amount);
  }

  function getCandidateScoreStat(stats, actionId) {
    const key = actionId == null || actionId === "" ? "unknown" : String(actionId);
    if (!stats[key]) {
      stats[key] = {
        offered: 0,
        available: 0,
        selected: 0,
        bestAvailable: 0,
        missedAsBest: 0,
        offeredScoreTotal: 0,
        availableScoreTotal: 0,
        selectedScoreTotal: 0,
        bestAvailableScoreTotal: 0,
        missedGapTotal: 0,
        maxMissedGap: 0,
      };
    }
    return stats[key];
  }

  function addScoreStatValue(stat, field, score) {
    const value = getFiniteScore(score);
    if (value == null) return;
    stat[field] += value;
  }

  function finalizeCandidateScoreStat(stat = {}) {
    return {
      offered: numeric(stat.offered),
      available: numeric(stat.available),
      selected: numeric(stat.selected),
      bestAvailable: numeric(stat.bestAvailable),
      missedAsBest: numeric(stat.missedAsBest),
      offeredScoreTotal: roundRatio(stat.offeredScoreTotal),
      availableScoreTotal: roundRatio(stat.availableScoreTotal),
      selectedScoreTotal: roundRatio(stat.selectedScoreTotal),
      bestAvailableScoreTotal: roundRatio(stat.bestAvailableScoreTotal),
      missedGapTotal: roundRatio(stat.missedGapTotal),
      maxMissedGap: roundRatio(stat.maxMissedGap),
      averageOfferedScore: stat.offered ? roundRatio(stat.offeredScoreTotal / stat.offered) : 0,
      averageAvailableScore: stat.available ? roundRatio(stat.availableScoreTotal / stat.available) : 0,
      averageSelectedScore: stat.selected ? roundRatio(stat.selectedScoreTotal / stat.selected) : 0,
      averageBestAvailableScore: stat.bestAvailable ? roundRatio(stat.bestAvailableScoreTotal / stat.bestAvailable) : 0,
      averageMissedGap: stat.missedAsBest ? roundRatio(stat.missedGapTotal / stat.missedAsBest) : 0,
    };
  }

  function finalizeCandidateScoreStats(stats = {}) {
    return Object.fromEntries(
      Object.entries(stats).map(([actionId, stat]) => [actionId, finalizeCandidateScoreStat(stat)]),
    );
  }

  function buildTopScoreGaps(stats = {}, limit = 8) {
    return Object.entries(stats)
      .map(([actionId, stat]) => ({ actionId, ...finalizeCandidateScoreStat(stat) }))
      .filter((entry) => entry.missedAsBest > 0)
      .sort((left, right) => right.missedGapTotal - left.missedGapTotal || left.actionId.localeCompare(right.actionId))
      .slice(0, limit);
  }

  function buildTopMissedCandidates(candidateStats = {}, limit = 8) {
    return Object.entries(candidateStats || {})
      .map(([actionId, stats]) => ({
        actionId,
        availableNotSelected: numeric(stats.availableNotSelected),
        available: numeric(stats.available),
        selected: numeric(stats.selected),
      }))
      .filter((entry) => entry.availableNotSelected > 0)
      .sort((left, right) => (
        right.availableNotSelected - left.availableNotSelected
        || left.actionId.localeCompare(right.actionId)
      ))
      .slice(0, limit);
  }

  function mergeCandidateScoreStats(target, source = {}) {
    for (const [actionId, sourceStat] of Object.entries(source || {})) {
      const stat = getCandidateScoreStat(target, actionId);
      stat.offered += numeric(sourceStat.offered);
      stat.available += numeric(sourceStat.available);
      stat.selected += numeric(sourceStat.selected);
      stat.bestAvailable += numeric(sourceStat.bestAvailable);
      stat.missedAsBest += numeric(sourceStat.missedAsBest);
      stat.offeredScoreTotal += numeric(sourceStat.offeredScoreTotal);
      stat.availableScoreTotal += numeric(sourceStat.availableScoreTotal);
      stat.selectedScoreTotal += numeric(sourceStat.selectedScoreTotal);
      stat.bestAvailableScoreTotal += numeric(sourceStat.bestAvailableScoreTotal);
      stat.missedGapTotal += numeric(sourceStat.missedGapTotal);
      stat.maxMissedGap = Math.max(stat.maxMissedGap, numeric(sourceStat.maxMissedGap));
    }
  }

  function getTechTypeFromTile(tileId) {
    const match = String(tileId || "").match(/^(orange|purple|blue)/);
    return match ? match[1] : null;
  }

  function normalizeTechTypeCounts(counts = {}) {
    return Object.fromEntries(D1_TECH_TYPES.map((type) => [
      type,
      Math.max(0, Math.round(numeric(counts?.[type]))),
    ]));
  }

  function getTechTypeCountsTotal(counts = {}) {
    return D1_TECH_TYPES.reduce((total, type) => total + numeric(counts?.[type]), 0);
  }

  function getRouteTargetKey(routeTarget) {
    if (!routeTarget) return null;
    return [
      routeTarget.kind || "route",
      routeTarget.locationType || routeTarget.planetId || routeTarget.id || "unknown",
    ].join(":");
  }

  function getRouteTargetFromEntry(entry) {
    return entry?.details?.action?.routeTarget
      || entry?.details?.selected?.routeTarget
      || entry?.details?.routeTarget
      || null;
  }

  function getMoveFollowupKey(entry) {
    const followup = entry?.details?.action?.followupMainAction
      || entry?.details?.selected?.followupMainAction
      || entry?.details?.followupMainAction
      || null;
    if (!followup?.actionId) return null;
    return [
      followup.actionId,
      followup.planetId || "unknown",
    ].join(":");
  }

  function getTurnPlanKey(entry) {
    const action = entry?.details?.action || null;
    const plan = getTurnPlanFromEntry(entry);
    if (!plan?.type) return null;
    const mainActionId = plan.mainActionId || action.id || "unknown";
    const quickActionId = getTurnPlanActionId(plan);
    return `${plan.type}:${mainActionId}->${quickActionId}`;
  }

  function getTurnPlanFromEntry(entry) {
    return entry?.details?.action?.plan || null;
  }

  function getTurnPlanActionId(plan) {
    return plan?.quickActionId || plan?.actionId || "none";
  }

  function normalizeSequenceWindowTurns(value) {
    if (value === "all") return "all";
    const turns = Math.round(Number(value));
    return Number.isFinite(turns) && turns > 0 ? turns : DEFAULT_SEQUENCE_WINDOW_TURNS;
  }

  function isWithinSequenceWindow(turnCount, windowTurns) {
    return windowTurns === "all" || numeric(turnCount) <= numeric(windowTurns);
  }

  function getDecisionTargetKey(entry) {
    if (!entry) return "unknown";
    if (entry.type === "final-score-mark") return getFinalScoreMarkKey(entry);
    if (entry.type === "tech-placement") return entry.details?.tileId || entry.details?.selected?.tileId || "unknown";
    if (entry.type === "scan-target") {
      return [
        entry.details?.pendingType || "scan",
        entry.details?.nebulaId || entry.details?.sectorX || "unknown",
      ].join(":");
    }
    if (entry.type === "play-card") {
      const card = entry.details?.selected || entry.details?.card || {};
      return card.cardLabel || card.cardId || card.cardInstanceId || "unknown";
    }
    if (entry.type === "land-target") return entry.details?.planetId || entry.details?.label || "target";
    if (entry.type === "alien-trace") return entry.details?.alienSlot || entry.details?.traceType || entry.details?.mode || "trace";
    if (entry.type === "alien-use") {
      return [
        entry.details?.pendingType || "alien",
        entry.details?.selected?.choice || "choice",
      ].join(":");
    }
    if (entry.type === "data-placement") {
      const selected = entry.details?.selected || {};
      return [
        selected.target || "data",
        selected.placementSlot || selected.blueSlot || "slot",
      ].join(":");
    }
    if (entry.type === "pick-card") return entry.details?.pendingType || entry.details?.cardLabel || "pick";
    if (entry.type === "hand-scan") return entry.details?.pendingType || entry.details?.choice || "hand";
    if (entry.type === "move-payment") return `pay:${numeric(entry.details?.requiredMovePoints)}`;
    return entry.details?.pendingType || entry.details?.kind || entry.details?.label || "unknown";
  }

  function compactTokenPart(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/[>|]/g, "/")
      .slice(0, 48);
  }

  function buildTurnActionToken(entry) {
    const action = getSelectedAction(entry) || {};
    const actionId = getSelectedActionId(entry);
    const parts = [`r${numeric(entry.roundNumber)}t${numeric(entry.turnNumber)}`, actionId];
    const plan = getTurnPlanFromEntry(entry);
    if (plan?.type) parts.push(`plan:${compactTokenPart(plan.type)}`);
    const routeTarget = getRouteTargetKey(getRouteTargetFromEntry(entry));
    if (routeTarget) parts.push(`route:${compactTokenPart(routeTarget)}`);
    const followup = getMoveFollowupKey(entry);
    if (followup) parts.push(`follow:${compactTokenPart(followup)}`);
    if (action.planetId) parts.push(`planet:${compactTokenPart(action.planetId)}`);
    if (action.direction) parts.push(`dir:${compactTokenPart(action.direction)}`);
    return parts.join("|");
  }

  function buildDecisionToken(entry) {
    return [
      `r${numeric(entry.roundNumber)}t${numeric(entry.turnNumber)}`,
      compactTokenPart(entry.type),
      compactTokenPart(getDecisionTargetKey(entry)),
    ].join("|");
  }

  function ensureSequenceProfile(map, playerId, playerLabel, isWinner = false) {
    const key = playerId || playerLabel || "unknown";
    if (!map[key]) {
      map[key] = {
        playerId: playerId || null,
        playerLabel: playerLabel || playerId || "unknown",
        isWinner,
        turnCount: 0,
        mainActionCount: 0,
        tokens: [],
        mainActionTokens: [],
      };
    }
    map[key].isWinner = Boolean(map[key].isWinner || isWinner);
    return map[key];
  }

  function rankSequenceCounts(counts = {}, limit = 10) {
    return Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .filter((entry) => entry.key)
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
      .slice(0, limit);
  }

  function incrementSequenceCount(map, tokens = []) {
    if (!tokens.length) return;
    increment(map, tokens.join(" > "));
  }

  function buildWinnerDeltaSequences(winnerCounts = {}, nonWinnerCounts = {}, limit = 10) {
    return Object.entries(winnerCounts)
      .map(([key, count]) => ({
        key,
        winnerCount: numeric(count),
        nonWinnerCount: numeric(nonWinnerCounts[key]),
        delta: numeric(count) - numeric(nonWinnerCounts[key]),
      }))
      .filter((entry) => entry.delta > 0)
      .sort((left, right) => right.delta - left.delta || right.winnerCount - left.winnerCount || left.key.localeCompare(right.key))
      .slice(0, limit);
  }

  function buildScoreBuckets(playerResults = [], logs = []) {
    const sorted = [...(playerResults || [])].sort((left, right) => numeric(right.finalScore) - numeric(left.finalScore));
    const makeEntry = (result, metric) => ({
      playerId: result.playerId || null,
      playerLabel: result.playerLabel || result.playerId || "unknown",
      value: numeric(result[metric]),
    });
    const topByMetric = (metric, threshold = 1) => {
      const best = Math.max(...sorted.map((result) => numeric(result[metric])), 0);
      if (best < threshold) return [];
      return sorted.filter((result) => numeric(result[metric]) === best).map((result) => makeEntry(result, metric));
    };
    const firstTracePlayers = [];
    const seenTracePlayers = new Set();
    for (const entry of logs || []) {
      if (entry.type !== "alien-trace") continue;
      const key = entry.playerId || entry.playerLabel || "unknown";
      if (seenTracePlayers.has(key)) continue;
      seenTracePlayers.add(key);
      firstTracePlayers.push({
        playerId: entry.playerId || null,
        playerLabel: entry.playerLabel || entry.playerId || "unknown",
        roundNumber: numeric(entry.roundNumber),
        turnNumber: numeric(entry.turnNumber),
      });
    }
    const firstRound25Players = [];
    const seen25Players = new Set();
    for (const entry of logs || []) {
      const pending = entry.details?.pending || {};
      const selected = getFinalScoreMarkSelection(entry);
      if (entry.type !== "final-score-mark" || numeric(entry.roundNumber) > 1 || numeric(pending.threshold || selected.threshold) !== 25) continue;
      const key = entry.playerId || entry.playerLabel || "unknown";
      if (seen25Players.has(key)) continue;
      seen25Players.add(key);
      firstRound25Players.push({
        playerId: entry.playerId || null,
        playerLabel: entry.playerLabel || entry.playerId || "unknown",
        value: 25,
      });
    }
    return {
      highTotalScore: sorted.filter((result) => numeric(result.finalScore) >= 25).map((result) => makeEntry(result, "finalScore")),
      highTileScore: topByMetric("tileScore"),
      highTaskScore: topByMetric("completedTaskCount"),
      highTechScore: topByMetric("techCount"),
      highCardScore: topByMetric("cardScore"),
      firstAlienTrace: firstTracePlayers,
      firstRound25: firstRound25Players,
    };
  }

  function buildActionSequences(logs = [], playerResults = [], options = {}) {
    const windowTurns = normalizeSequenceWindowTurns(options.sequenceWindowTurns);
    const winnerId = playerResults[0]?.playerId || null;
    const winnerLabel = playerResults[0]?.playerLabel || null;
    const byPlayer = {};
    const globalTokens = [];
    const winnerSequenceCounts = {};
    const nonWinnerSequenceCounts = {};
    const mainActionSequenceCounts = {};
    const globalSequenceCounts = {};

    for (const result of playerResults || []) {
      ensureSequenceProfile(byPlayer, result.playerId, result.playerLabel, result.playerId === winnerId);
    }

    for (const entry of logs || []) {
      const playerId = entry.playerId || null;
      const playerLabel = entry.playerLabel || playerId || "unknown";
      const isWinner = (winnerId && playerId === winnerId) || (!winnerId && winnerLabel && playerLabel === winnerLabel);
      const profile = ensureSequenceProfile(byPlayer, playerId, playerLabel, isWinner);

      if (entry.type === "turn-action") {
        profile.turnCount += 1;
        if (isWithinSequenceWindow(profile.turnCount, windowTurns)) {
          const token = buildTurnActionToken(entry);
          profile.tokens.push(token);
          globalTokens.push(`${compactTokenPart(playerLabel)}:${token}`);
          const action = getSelectedAction(entry);
          if (action?.kind === "main") {
            profile.mainActionCount += 1;
            profile.mainActionTokens.push(token);
          }
        }
      } else if (
        KEY_SEQUENCE_DECISIONS.includes(entry.type)
        && profile.turnCount > 0
        && isWithinSequenceWindow(profile.turnCount, windowTurns)
      ) {
        const token = buildDecisionToken(entry);
        profile.tokens.push(token);
        globalTokens.push(`${compactTokenPart(playerLabel)}:${token}`);
      }
    }

    const playerSequences = Object.values(byPlayer).map((profile) => {
      const targetCounts = profile.isWinner ? winnerSequenceCounts : nonWinnerSequenceCounts;
      incrementSequenceCount(targetCounts, profile.tokens);
      incrementSequenceCount(mainActionSequenceCounts, profile.mainActionTokens);
      return {
        ...profile,
        sequenceKey: profile.tokens.join(" > "),
        mainActionSequenceKey: profile.mainActionTokens.join(" > "),
      };
    });
    incrementSequenceCount(globalSequenceCounts, globalTokens);

    return {
      windowTurns,
      playerSequences,
      globalTokens,
      sequenceCounts: {
        winner: winnerSequenceCounts,
        nonWinner: nonWinnerSequenceCounts,
        mainAction: mainActionSequenceCounts,
        global: globalSequenceCounts,
      },
      winnerTopSequences: rankSequenceCounts(winnerSequenceCounts),
      nonWinnerTopSequences: rankSequenceCounts(nonWinnerSequenceCounts),
      winnerDeltaSequences: buildWinnerDeltaSequences(winnerSequenceCounts, nonWinnerSequenceCounts),
      mainActionTopSequences: rankSequenceCounts(mainActionSequenceCounts),
      globalTopSequences: rankSequenceCounts(globalSequenceCounts),
    };
  }

  function mergeSequenceCounts(target = {}, source = {}) {
    for (const [bucket, counts] of Object.entries(source || {})) {
      if (!target[bucket]) target[bucket] = {};
      for (const [key, count] of Object.entries(counts || {})) {
        increment(target[bucket], key, count);
      }
    }
    return target;
  }

  function summarizeSequenceCounts(counts = {}, windowTurns = DEFAULT_SEQUENCE_WINDOW_TURNS) {
    const winner = counts.winner || {};
    const nonWinner = counts.nonWinner || {};
    return {
      windowTurns,
      sequenceCounts: counts,
      winnerTopSequences: rankSequenceCounts(winner),
      nonWinnerTopSequences: rankSequenceCounts(nonWinner),
      winnerDeltaSequences: buildWinnerDeltaSequences(winner, nonWinner),
      mainActionTopSequences: rankSequenceCounts(counts.mainAction || {}),
      globalTopSequences: rankSequenceCounts(counts.global || {}),
    };
  }

  function mergeScoreBuckets(target = {}, source = {}) {
    for (const [bucket, entries] of Object.entries(source || {})) {
      if (!target[bucket]) target[bucket] = {};
      for (const entry of entries || []) {
        const key = entry.playerId || entry.playerLabel || "unknown";
        if (!target[bucket][key]) {
          target[bucket][key] = {
            playerId: entry.playerId || null,
            playerLabel: entry.playerLabel || entry.playerId || "unknown",
            count: 0,
            valueTotal: 0,
            maxValue: 0,
          };
        }
        target[bucket][key].count += 1;
        target[bucket][key].valueTotal += numeric(entry.value);
        target[bucket][key].maxValue = Math.max(target[bucket][key].maxValue, numeric(entry.value));
      }
    }
    return target;
  }

  function finalizeScoreBuckets(buckets = {}) {
    return Object.fromEntries(Object.entries(buckets).map(([bucket, entries]) => [
      bucket,
      Object.values(entries || {})
        .map((entry) => ({
          ...entry,
          averageValue: entry.count ? roundRatio(entry.valueTotal / entry.count) : 0,
          valueTotal: roundRatio(entry.valueTotal),
          maxValue: roundRatio(entry.maxValue),
        }))
        .sort((left, right) => right.count - left.count || right.maxValue - left.maxValue || left.playerLabel.localeCompare(right.playerLabel)),
    ]));
  }

  function recordProfileTurnPlan(profile, entry) {
    const plan = getTurnPlanFromEntry(entry);
    const planKey = getTurnPlanKey(entry);
    if (!planKey || !plan?.type) return;
    const actionId = getTurnPlanActionId(plan);
    increment(profile.turnPlanCounts, planKey);
    increment(profile.turnPlanTypeCounts, plan.type);
    increment(profile.turnPlanActionCounts, actionId);
    if (plan.type === "card-synergy") addProfileMetric(profile, "cardSynergyCount", 1);
    if (plan.type === "tech-synergy") addProfileMetric(profile, "techSynergyCount", 1);
    if (plan.type === "main-then-quick") addProfileMetric(profile, "mainThenQuickCount", 1);
    if (actionId === "move") addProfileMetric(profile, "planMoveCount", 1);
    if (actionId === "scan") addProfileMetric(profile, "planScanCount", 1);
    if (actionId === "launch") addProfileMetric(profile, "planLaunchCount", 1);
    if (actionId === "researchTech") addProfileMetric(profile, "planResearchTechCount", 1);
    if (actionId === "orbit" || actionId === "land") addProfileMetric(profile, "planOrbitLandCount", 1);
    if (actionId === "task") addProfileMetric(profile, "planTaskCount", 1);
    if (actionId === "final") addProfileMetric(profile, "planFinalCount", 1);
  }

  function recordTurnCandidateScores(candidateScoreStats, candidates = [], action = null) {
    const scoredAvailable = [];
    let selectedEntry = null;
    for (const candidate of candidates || []) {
      const actionId = getCandidateId(candidate);
      const score = getCandidatePolicyScore(candidate);
      const stat = getCandidateScoreStat(candidateScoreStats, actionId);
      stat.offered += 1;
      addScoreStatValue(stat, "offeredScoreTotal", score);
      if (isCandidateAvailable(candidate)) {
        stat.available += 1;
        addScoreStatValue(stat, "availableScoreTotal", score);
        if (score != null) scoredAvailable.push({ actionId, candidate, score });
      }
      if (candidateMatchesAction(candidate, action)) {
        selectedEntry = { actionId, candidate, score };
      }
    }

    if (!selectedEntry && action) {
      selectedEntry = {
        actionId: getCandidateId(action),
        candidate: action,
        score: getCandidatePolicyScore(action),
      };
    }

    if (selectedEntry) {
      const selectedStat = getCandidateScoreStat(candidateScoreStats, selectedEntry.actionId);
      selectedStat.selected += 1;
      addScoreStatValue(selectedStat, "selectedScoreTotal", selectedEntry.score);
    }

    const bestEntry = scoredAvailable
      .sort((left, right) => right.score - left.score || left.actionId.localeCompare(right.actionId))[0] || null;
    if (bestEntry) {
      const bestStat = getCandidateScoreStat(candidateScoreStats, bestEntry.actionId);
      bestStat.bestAvailable += 1;
      addScoreStatValue(bestStat, "bestAvailableScoreTotal", bestEntry.score);
      const selectedScore = getFiniteScore(selectedEntry?.score);
      const gap = selectedScore == null ? 0 : bestEntry.score - selectedScore;
      if (gap > 0.001 && !candidateMatchesAction(bestEntry.candidate, action)) {
        bestStat.missedAsBest += 1;
        bestStat.missedGapTotal += gap;
        bestStat.maxMissedGap = Math.max(bestStat.maxMissedGap, gap);
        return {
          selectedActionId: selectedEntry?.actionId || null,
          selectedScore,
          bestActionId: bestEntry.actionId,
          bestScore: bestEntry.score,
          gap,
        };
      }
      return {
        selectedActionId: selectedEntry?.actionId || null,
        selectedScore,
        bestActionId: bestEntry.actionId,
        bestScore: bestEntry.score,
        gap: 0,
      };
    }

    return {
      selectedActionId: selectedEntry?.actionId || null,
      selectedScore: getFiniteScore(selectedEntry?.score),
      bestActionId: null,
      bestScore: null,
      gap: 0,
    };
  }

  function attachPlayerResultToProfile(profile, result = {}) {
    profile.finalScore = numeric(result.finalScore);
    profile.baseScore = numeric(result.baseScore);
    profile.tileScore = numeric(result.tileScore);
    profile.cardScore = numeric(result.cardScore);
    profile.completedTaskCount = numeric(result.completedTaskCount);
    profile.reservedCount = numeric(result.reservedCount);
    profile.handSize = numeric(result.handSize);
    profile.techCount = numeric(result.techCount);
    profile.rocketCount = numeric(result.rocketCount);
    addProfileMetric(profile, "finalScore", profile.finalScore);
    addProfileMetric(profile, "tileScore", profile.tileScore);
    addProfileMetric(profile, "cardScore", profile.cardScore);
    addProfileMetric(profile, "completedTaskCount", profile.completedTaskCount);
    addProfileMetric(profile, "techCount", profile.techCount);
    addProfileMetric(profile, "rocketCount", profile.rocketCount);
  }

  function summarizePaceProfile(profile = {}) {
    const metrics = profile.metrics || {};
    return {
      playerId: profile.playerId || null,
      playerLabel: profile.playerLabel || profile.playerId || "unknown",
      finalScore: roundRatio(profile.finalScore),
      mainActionCount: roundRatio(metrics.mainActionCount),
      quickStepCount: roundRatio(metrics.quickStepCount),
      resourceQuickStepCount: roundRatio(metrics.resourceQuickStepCount),
      productiveActionCount: roundRatio(metrics.productiveActionCount),
      idleTurnCount: roundRatio(metrics.idleTurnCount),
      quickToMainRatio: roundRatio(metrics.quickToMainRatio),
      idleTurnRatio: roundRatio(metrics.idleTurnRatio),
      playCardCount: roundRatio(metrics.playCardCount),
      researchTechCount: roundRatio(metrics.researchTechCount),
      techCount: roundRatio(metrics.techCount),
      completedTaskCount: roundRatio(metrics.completedTaskCount),
    };
  }

  function buildPaceSummary(playerProfiles = []) {
    const profiles = (playerProfiles || []).filter(Boolean);
    const average = averageProfileMetrics(profiles);
    const scoreLeaders = [...profiles]
      .sort((left, right) => numeric(right.finalScore) - numeric(left.finalScore) || left.playerLabel.localeCompare(right.playerLabel));
    const lowTailPlayers = [...profiles]
      .sort((left, right) => numeric(left.finalScore) - numeric(right.finalScore) || left.playerLabel.localeCompare(right.playerLabel))
      .slice(0, 3)
      .map(summarizePaceProfile);
    const quickStepLeaders = [...profiles]
      .sort((left, right) => (
        numeric(right.metrics?.quickStepCount) - numeric(left.metrics?.quickStepCount)
        || numeric(right.finalScore) - numeric(left.finalScore)
        || left.playerLabel.localeCompare(right.playerLabel)
      ))
      .slice(0, 3)
      .map(summarizePaceProfile);
    return {
      playerCount: profiles.length,
      averageMainActionCount: roundRatio(average.mainActionCount),
      averageQuickStepCount: roundRatio(average.quickStepCount),
      averageResourceQuickStepCount: roundRatio(average.resourceQuickStepCount),
      averageProductiveActionCount: roundRatio(average.productiveActionCount),
      averageQuickToMainRatio: roundRatio(average.quickToMainRatio),
      averageIdleTurnRatio: roundRatio(average.idleTurnRatio),
      winner: scoreLeaders[0] ? summarizePaceProfile(scoreLeaders[0]) : null,
      lowTail: lowTailPlayers[0] || null,
      lowTailPlayers,
      quickStepLeaders,
    };
  }

  const ROUND_PACE_METRICS = Object.freeze([
    "turnActionCount",
    "mainActionCount",
    "quickStepCount",
    "resourceQuickStepCount",
    "productiveActionCount",
    "idleTurnCount",
    "otherTurnActionCount",
    "playCardCount",
    "researchTechCount",
    "scanCount",
    "analyzeCount",
    "moveCount",
    "placeDataCount",
    "cardCornerCount",
    "quickTradeCount",
    "passCount",
  ]);

  function getAverageRoundPaceKey(metric) {
    return `average${metric.charAt(0).toUpperCase()}${metric.slice(1)}`;
  }

  function buildRoundPaceAverageMap(playerProfiles = []) {
    const byRound = new Map();
    for (const profile of playerProfiles || []) {
      for (const round of profile?.roundPace || []) {
        const key = getRoundPaceKey(round.roundNumber);
        if (!byRound.has(key)) {
          const initial = {
            roundNumber: round.roundNumber ?? null,
            playerCount: 0,
            totals: {},
          };
          for (const metric of ROUND_PACE_METRICS) initial.totals[metric] = 0;
          byRound.set(key, initial);
        }
        const bucket = byRound.get(key);
        bucket.playerCount += 1;
        for (const metric of ROUND_PACE_METRICS) {
          bucket.totals[metric] += numeric(round[metric]);
        }
      }
    }

    const averaged = new Map();
    for (const [key, bucket] of byRound.entries()) {
      const count = Math.max(1, numeric(bucket.playerCount));
      const roundAverage = {
        roundNumber: bucket.roundNumber,
        playerCount: numeric(bucket.playerCount),
      };
      for (const metric of ROUND_PACE_METRICS) {
        roundAverage[metric] = roundRatio(bucket.totals[metric] / count);
      }
      averaged.set(key, roundAverage);
    }
    return averaged;
  }

  function summarizeRoundPaceAverage(roundAverage = {}) {
    const summary = {
      roundNumber: roundAverage.roundNumber ?? null,
      playerCount: numeric(roundAverage.playerCount),
    };
    for (const metric of ROUND_PACE_METRICS) {
      summary[getAverageRoundPaceKey(metric)] = roundRatio(roundAverage[metric]);
    }
    return summary;
  }

  function summarizeLowRoundPaceSample(profile = {}, round = {}, averageRound = {}, referenceRound = {}) {
    const referenceMainActionCount = roundRatio(referenceRound.mainActionCount ?? averageRound.mainActionCount);
    const averageMainActionCount = roundRatio(averageRound.mainActionCount);
    const mainActionGap = roundRatio(Math.max(0, referenceMainActionCount - numeric(round.mainActionCount)));
    return {
      playerId: profile.playerId || null,
      playerLabel: profile.playerLabel || profile.playerId || "unknown",
      finalScore: roundRatio(profile.finalScore),
      roundNumber: round.roundNumber ?? null,
      turnActionCount: roundRatio(round.turnActionCount),
      mainActionCount: roundRatio(round.mainActionCount),
      quickStepCount: roundRatio(round.quickStepCount),
      resourceQuickStepCount: roundRatio(round.resourceQuickStepCount),
      productiveActionCount: roundRatio(round.productiveActionCount),
      idleTurnCount: roundRatio(round.idleTurnCount),
      passCount: roundRatio(round.passCount),
      quickToMainRatio: roundRatio(round.quickToMainRatio),
      playCardCount: roundRatio(round.playCardCount),
      researchTechCount: roundRatio(round.researchTechCount),
      scanCount: roundRatio(round.scanCount),
      analyzeCount: roundRatio(round.analyzeCount),
      moveCount: roundRatio(round.moveCount),
      referenceMainActionCount,
      averageMainActionCount,
      mainActionGap,
      actionCounts: round.actionCounts || {},
    };
  }

  function buildLowRoundPaceSamples(playerProfiles = [], roundAverages = buildRoundPaceAverageMap(playerProfiles), limit = 12) {
    const profiles = (playerProfiles || []).filter(Boolean);
    if (!profiles.length) return [];

    const average = averageProfileMetrics(profiles);
    const lowScoreCutoff = Math.min(245, numeric(average.finalScore) - 15);
    const scoreAscending = [...profiles]
      .sort((left, right) => numeric(left.finalScore) - numeric(right.finalScore) || left.playerLabel.localeCompare(right.playerLabel));
    const scoreDescending = [...profiles]
      .sort((left, right) => numeric(right.finalScore) - numeric(left.finalScore) || left.playerLabel.localeCompare(right.playerLabel));
    const fallbackLowCount = Math.max(1, Math.ceil(profiles.length * 0.35));
    const highProfiles = scoreDescending.filter((profile) => numeric(profile.finalScore) >= 300);
    const referenceProfiles = highProfiles.length
      ? highProfiles
      : scoreDescending.slice(0, Math.max(1, Math.ceil(profiles.length * 0.25)));
    const referenceAverages = buildRoundPaceAverageMap(referenceProfiles);
    const lowKeys = new Set([
      ...scoreAscending
        .filter((profile) => numeric(profile.finalScore) <= lowScoreCutoff)
        .map((profile) => profile.playerId || profile.playerLabel),
      ...scoreAscending
        .slice(0, fallbackLowCount)
        .map((profile) => profile.playerId || profile.playerLabel),
    ]);

    const samples = [];
    for (const profile of profiles) {
      const profileKey = profile.playerId || profile.playerLabel;
      if (!lowKeys.has(profileKey)) continue;
      for (const round of profile.roundPace || []) {
        const key = getRoundPaceKey(round.roundNumber);
        const averageRound = roundAverages.get(key) || {};
        const referenceRound = referenceAverages.get(key) || averageRound;
        const sample = summarizeLowRoundPaceSample(profile, round, averageRound, referenceRound);
        const lowMainRound = numeric(sample.mainActionCount) <= 5 || numeric(sample.mainActionGap) >= 2;
        if (!lowMainRound && numeric(sample.finalScore) > lowScoreCutoff) continue;
        samples.push(sample);
      }
    }

    return samples
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.mainActionCount) - numeric(right.mainActionCount)
        || numeric(right.mainActionGap) - numeric(left.mainActionGap)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
      ))
      .slice(0, limit);
  }

  function getLowRoundSamplePlayerKey(sample = {}) {
    return sample.playerId || sample.playerLabel || "unknown";
  }

  function getLowRoundSampleKey(sample = {}) {
    return [
      getLowRoundSamplePlayerKey(sample),
      getRoundPaceKey(sample.roundNumber),
    ].join("|");
  }

  function summarizeLowRoundTailAction(entry = {}, limit = 4) {
    const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
    const availableCandidates = sortByCandidatePolicy(candidates.filter(isCandidateAvailable));
    const availableMain = availableCandidates.filter((candidate) => candidate.kind === "main");
    const availableQuick = availableCandidates.filter((candidate) => candidate.kind === "quick");
    const selected = getSelectedAction(entry) || {};
    const selectedId = getSelectedActionId(entry);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(selected),
      pace: getActionPaceCategory(selectedId, selected),
      bestMain: availableMain[0] ? summarizeOpportunityCandidate(availableMain[0]) : null,
      bestQuick: availableQuick[0] ? summarizeOpportunityCandidate(availableQuick[0]) : null,
      topCandidates: availableCandidates
        .slice(0, limit)
        .map(summarizeOpportunityCandidate),
    };
  }

  function getResourceCount(resources = {}, key) {
    return numeric(resources?.[key]);
  }

  function summarizeLowRoundTailResourceDelta(firstResources = null, lastResources = null) {
    if (!firstResources || !lastResources) return null;
    return {
      score: roundRatio(getResourceCount(lastResources, "score") - getResourceCount(firstResources, "score")),
      credits: roundRatio(getResourceCount(lastResources, "credits") - getResourceCount(firstResources, "credits")),
      energy: roundRatio(getResourceCount(lastResources, "energy") - getResourceCount(firstResources, "energy")),
      publicity: roundRatio(getResourceCount(lastResources, "publicity") - getResourceCount(firstResources, "publicity")),
      availableData: roundRatio(getResourceCount(lastResources, "availableData") - getResourceCount(firstResources, "availableData")),
      handSize: roundRatio(getResourceCount(lastResources, "handSize") - getResourceCount(firstResources, "handSize")),
    };
  }

  function buildLowRoundTailTags(tailEntries = [], lastPassCandidateProfile = null, firstResources = null, lastResources = null) {
    const tags = [];
    const add = (tag) => {
      if (tag && !tags.includes(tag)) tags.push(tag);
    };
    const selectedActions = (tailEntries || [])
      .map((entry) => getSelectedAction(entry) || {})
      .filter(Boolean);
    const quickTradeCounts = {};
    for (const action of selectedActions) {
      if (getCandidateId(action) !== "quickTrade") continue;
      increment(quickTradeCounts, action.tradeId || "unknown");
    }
    for (const [tradeId, count] of Object.entries(quickTradeCounts)) {
      if (numeric(count) >= 2) add(`repeated-${tradeId}`);
    }

    const firstHand = getResourceCount(firstResources, "handSize");
    const lastHand = getResourceCount(lastResources, "handSize");
    if (firstHand >= 4 && lastHand <= 1) add("hand-drain-tail");
    if (getResourceCount(lastResources, "credits") <= 0) add("zero-credit-tail");
    if (getResourceCount(lastResources, "energy") <= 0) add("zero-energy-tail");
    if (getResourceCount(lastResources, "availableData") <= 0) add("zero-data-tail");
    if (lastHand <= 1 && getResourceCount(lastResources, "credits") <= 0) add("low-hand-credit-tail");

    for (let index = 1; index < tailEntries.length; index += 1) {
      const entry = tailEntries[index];
      const action = getSelectedAction(entry) || {};
      const actionId = getCandidateId(action);
      if (getActionPaceCategory(actionId, action) !== "main") continue;
      const previousResources = tailEntries[index - 1]?.playerResources || {};
      const previousHand = getResourceCount(previousResources, "handSize");
      const previousCredits = getResourceCount(previousResources, "credits");
      const previousEnergy = getResourceCount(previousResources, "energy");
      if (previousHand <= 1 || previousCredits <= 0 || previousEnergy <= 0) {
        add(`cashout-after-resource-drain:${actionId}`);
      }
    }

    const reasonTag = lastPassCandidateProfile?.reasonTag || null;
    if (reasonTag) add(`pass-${reasonTag}`);
    const bestTrade = lastPassCandidateProfile?.bestResourceLockTrade || null;
    const bestTradeActionId = bestTrade?.bestAction?.actionId || bestTrade?.bestAction?.id || null;
    if (bestTrade?.tradeId && bestTradeActionId) {
      add(`pass-${bestTrade.tradeId}-unlocks-${bestTradeActionId}`);
      const resourcesAfterTrade = bestTrade.resourcesAfterTrade || {};
      if (getResourceCount(resourcesAfterTrade, "handSize") <= 0) add("pass-trade-unlock-no-hand");
    }

    const unavailableReasons = (lastPassCandidateProfile?.unavailableMain || [])
      .map((candidate) => String(candidate?.reason || ""));
    if (unavailableReasons.some((reason) => reason.includes("扫描") && reason.includes("能量"))) add("scan-energy-lock");
    if (unavailableReasons.some((reason) => reason.includes("研究科技") && reason.includes("宣传"))) add("tech-publicity-lock");
    const playCardReason = String(lastPassCandidateProfile?.playCard?.reason || "");
    if (
      unavailableReasons.some((reason) => reason.includes("打牌") || reason.includes("普通手牌"))
      || playCardReason.includes("普通手牌")
      || playCardReason.includes("资源")
    ) {
      add("play-card-resource-lock");
    }

    return tags;
  }

  function sortLowRoundActionTailSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .filter(Boolean)
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.mainActionCount) - numeric(right.mainActionCount)
        || numeric(right.mainActionGap) - numeric(left.mainActionGap)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || String(left.playerLabel || "").localeCompare(String(right.playerLabel || ""))
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function buildLowRoundActionTailSamples(
    logs = [],
    playerResults = [],
    lowRoundPaceSamples = [],
    earlyPassNoMainSamples = [],
    preNoMainPassResourceDrainSamples = [],
    limit = 12,
  ) {
    const targetSamples = sortLowRoundActionTailSamples(lowRoundPaceSamples, limit);
    if (!targetSamples.length) return [];

    const targetKeys = new Set(targetSamples.map(getLowRoundSampleKey));
    const turnEntriesByRound = new Map();
    for (const entry of logs || []) {
      if (entry?.type !== "turn-action") continue;
      const key = [
        entry.playerId || entry.playerLabel || "unknown",
        getRoundPaceKey(entry.roundNumber),
      ].join("|");
      if (!targetKeys.has(key)) continue;
      if (!turnEntriesByRound.has(key)) turnEntriesByRound.set(key, []);
      turnEntriesByRound.get(key).push(entry);
    }

    const passSamplesByRound = new Map();
    for (const sample of earlyPassNoMainSamples || []) {
      const key = getLowRoundSampleKey(sample);
      if (!targetKeys.has(key)) continue;
      if (!passSamplesByRound.has(key)) passSamplesByRound.set(key, []);
      passSamplesByRound.get(key).push(sample);
    }

    const drainSamplesByRound = new Map();
    for (const sample of preNoMainPassResourceDrainSamples || []) {
      const key = getLowRoundSampleKey(sample);
      if (!targetKeys.has(key)) continue;
      if (!drainSamplesByRound.has(key)) drainSamplesByRound.set(key, []);
      drainSamplesByRound.get(key).push(sample);
    }

    const playerResultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const samples = targetSamples.map((roundSample) => {
      const key = getLowRoundSampleKey(roundSample);
      const turnEntries = turnEntriesByRound.get(key) || [];
      const passEntries = turnEntries.filter((entry) => getSelectedActionId(entry) === "pass");
      const lastPass = passEntries[passEntries.length - 1] || null;
      const result = playerResultById.get(roundSample.playerId) || {};
      const tailEntries = turnEntries.slice(-8);
      const firstResources = turnEntries[0]?.playerResources || null;
      const lastResources = turnEntries[turnEntries.length - 1]?.playerResources || null;
      const lastPassCandidateProfile = lastPass
        ? buildEarlyPassCandidateProfile(lastPass, lastPass.details?.candidates || [], 5)
        : null;
      return {
        playerId: roundSample.playerId || null,
        playerLabel: roundSample.playerLabel || roundSample.playerId || "unknown",
        finalScore: roundRatio(result.finalScore ?? roundSample.finalScore),
        roundNumber: roundSample.roundNumber ?? null,
        mainActionCount: roundRatio(roundSample.mainActionCount),
        quickStepCount: roundRatio(roundSample.quickStepCount),
        resourceQuickStepCount: roundRatio(roundSample.resourceQuickStepCount),
        idleTurnCount: roundRatio(roundSample.idleTurnCount),
        passCount: roundRatio(roundSample.passCount),
        referenceMainActionCount: roundRatio(roundSample.referenceMainActionCount),
        averageMainActionCount: roundRatio(roundSample.averageMainActionCount),
        mainActionGap: roundRatio(roundSample.mainActionGap),
        actionCounts: roundSample.actionCounts || {},
        roundActionCount: turnEntries.length,
        firstResources,
        lastResources,
        tailResourceDelta: summarizeLowRoundTailResourceDelta(firstResources, lastResources),
        tailTags: buildLowRoundTailTags(tailEntries, lastPassCandidateProfile, firstResources, lastResources),
        actionTail: tailEntries.map((entry) => summarizeLowRoundTailAction(entry, 4)),
        lastPassCandidateProfile,
        noMainPassSamples: (passSamplesByRound.get(key) || [])
          .slice(-3)
          .map((sample) => ({
            rawTurnNumber: sample.rawTurnNumber ?? null,
            resources: sample.resources || null,
            reasonTag: sample.reasonTag || null,
            quickStepCount: numeric(sample.quickStepCount),
            quickBeforePassCount: numeric(sample.quickBeforePassCount),
            quickAfterPassCount: numeric(sample.quickAfterPassCount),
            actionIds: sample.actionIds || [],
            candidateProfile: sample.candidateProfile || null,
          })),
        resourceDrainSamples: (drainSamplesByRound.get(key) || [])
          .slice(-3)
          .map((sample) => ({
            rawTurnNumber: sample.rawTurnNumber ?? null,
            reasonTag: sample.reasonTag || null,
            previousAction: sample.previousAction || null,
            resourceDeltaToPass: sample.resourceDeltaToPass || null,
            passActionIds: sample.passActionIds || [],
            candidateProfile: sample.candidateProfile || null,
          })),
      };
    });

    return sortLowRoundActionTailSamples(samples, limit);
  }

  function buildRoundPaceSummary(playerProfiles = []) {
    const profiles = (playerProfiles || []).filter(Boolean);
    const roundAverages = buildRoundPaceAverageMap(profiles);
    return {
      rounds: [...roundAverages.values()]
        .map(summarizeRoundPaceAverage)
        .sort((left, right) => numeric(left.roundNumber) - numeric(right.roundNumber)),
      lowRoundPaceSamples: buildLowRoundPaceSamples(profiles, roundAverages),
    };
  }

  function getProfileMetric(profile = {}, key) {
    return numeric(profile.metrics?.[key] ?? profile[key]);
  }

  function buildLowEngineThroughputSamples(playerProfiles = []) {
    const profiles = (playerProfiles || []).filter(Boolean);
    if (!profiles.length) return [];

    const scoreSorted = [...profiles]
      .sort((left, right) => numeric(right.finalScore) - numeric(left.finalScore) || left.playerLabel.localeCompare(right.playerLabel));
    const highProfiles = scoreSorted.filter((profile) => numeric(profile.finalScore) >= 300);
    const referenceProfiles = highProfiles.length
      ? highProfiles
      : scoreSorted.slice(0, Math.max(1, Math.ceil(scoreSorted.length * 0.25)));
    const reference = averageProfileMetrics(referenceProfiles);
    const average = averageProfileMetrics(profiles);

    const buildGap = (profile, key) => roundRatio(Math.max(0, numeric(reference[key]) - getProfileMetric(profile, key)));
    const lowScoreCutoff = Math.min(230, numeric(average.finalScore) - 25);
    const samples = profiles
      .map((profile) => {
        const placeDataGap = buildGap(profile, "placeDataCount");
        const scanGap = buildGap(profile, "scanCount");
        const analyzeGap = buildGap(profile, "analyzeCount");
        const playGap = buildGap(profile, "playCardCount");
        const techActionGap = buildGap(profile, "researchTechCount");
        const techCountGap = buildGap(profile, "techCount");
        const taskGap = buildGap(profile, "completedTaskCount");
        const baseScoreGap = roundRatio(Math.max(0, numeric(reference.baseScore) - numeric(profile.baseScore)));
        const reasons = [];
        if (placeDataGap >= 8) reasons.push("low-place-data");
        if (scanGap >= 2) reasons.push("low-scan");
        if (analyzeGap >= 1.5) reasons.push("low-analyze");
        if (playGap >= 2) reasons.push("low-play-card");
        if (techActionGap >= 1.5 || techCountGap >= 2) reasons.push("low-tech");
        if (taskGap >= 1.5) reasons.push("low-task");
        if (baseScoreGap >= 35) reasons.push("low-base-score");
        if (getProfileMetric(profile, "idleTurnRatio") > numeric(reference.idleTurnRatio) + 0.04) reasons.push("high-idle");

        const score = numeric(profile.finalScore);
        const throughputGap = roundRatio(
          placeDataGap * 0.35
          + scanGap * 2
          + analyzeGap * 2.5
          + playGap * 1.5
          + techActionGap * 1.5
          + techCountGap * 1.2
          + taskGap * 2,
        );
        const shouldKeep = score <= lowScoreCutoff
          || (score < numeric(average.finalScore) - 35 && throughputGap >= 10)
          || (score < 260 && reasons.length >= 4);
        if (!shouldKeep || !reasons.length) return null;

        return {
          playerId: profile.playerId || null,
          playerLabel: profile.playerLabel || profile.playerId || "unknown",
          finalScore: roundRatio(score),
          baseScore: roundRatio(profile.baseScore),
          tileScore: roundRatio(profile.tileScore),
          cardScore: roundRatio(profile.cardScore),
          techCount: roundRatio(profile.techCount),
          completedTaskCount: roundRatio(profile.completedTaskCount),
          throughputGap,
          reasons,
          counts: {
            playCard: roundRatio(getProfileMetric(profile, "playCardCount")),
            researchTech: roundRatio(getProfileMetric(profile, "researchTechCount")),
            scan: roundRatio(getProfileMetric(profile, "scanCount")),
            analyze: roundRatio(getProfileMetric(profile, "analyzeCount")),
            placeData: roundRatio(getProfileMetric(profile, "placeDataCount")),
            cardCorner: roundRatio(getProfileMetric(profile, "cardCornerCount")),
            quickTrade: roundRatio(getProfileMetric(profile, "quickTradeCount")),
            mainAction: roundRatio(getProfileMetric(profile, "mainActionCount")),
            quickStep: roundRatio(getProfileMetric(profile, "quickStepCount")),
            resourceQuickStep: roundRatio(getProfileMetric(profile, "resourceQuickStepCount")),
            idleTurnRatio: roundRatio(getProfileMetric(profile, "idleTurnRatio")),
          },
          referenceGaps: {
            baseScore: baseScoreGap,
            playCard: playGap,
            researchTech: techActionGap,
            techCount: techCountGap,
            scan: scanGap,
            analyze: analyzeGap,
            placeData: placeDataGap,
            completedTask: taskGap,
          },
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.throughputGap - left.throughputGap || numeric(left.finalScore) - numeric(right.finalScore))
      .slice(0, 8);

    return samples;
  }

  function matchesPlayerResult(entry = {}, result = {}) {
    const resultId = result.playerId == null ? null : String(result.playerId);
    const resultLabel = result.playerLabel == null ? null : String(result.playerLabel);
    const entryId = entry.playerId == null ? null : String(entry.playerId);
    const entryLabel = entry.playerLabel == null ? null : String(entry.playerLabel);
    return Boolean(
      (resultId && entryId && resultId === entryId)
      || (resultLabel && entryLabel && resultLabel === entryLabel)
    );
  }

  function getBestAvailableCandidate(candidates = []) {
    return (candidates || [])
      .filter(isCandidateAvailable)
      .map((candidate) => ({
        candidate,
        score: getCandidatePolicyScore(candidate),
        actionId: getCandidateId(candidate),
      }))
      .filter((entry) => getFiniteScore(entry.score) != null)
      .sort((left, right) => right.score - left.score || left.actionId.localeCompare(right.actionId))[0]
      || null;
  }

  function buildCandidateGapSample(entry, candidates = [], scoreGap = {}) {
    const bestEntry = getBestAvailableCandidate(candidates);
    const topCandidates = [...(candidates || [])]
      .filter(isCandidateAvailable)
      .sort((left, right) => (
        numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
        || getCandidateId(left).localeCompare(getCandidateId(right))
      ))
      .slice(0, 5)
      .map(summarizeOpportunityCandidate);
    return {
      roundNumber: entry.roundNumber ?? null,
      turnNumber: entry.turnNumber ?? null,
      playerId: entry.playerId || null,
      playerLabel: entry.playerLabel || null,
      resources: entry.playerResources || null,
      selected: summarizeOpportunityCandidate(getSelectedCandidate(entry, candidates) || {}),
      bestCandidate: bestEntry ? summarizeOpportunityCandidate(bestEntry.candidate) : null,
      selectedActionId: scoreGap.selectedActionId || null,
      bestActionId: scoreGap.bestActionId || null,
      selectedScore: roundRatio(scoreGap.selectedScore),
      bestScore: roundRatio(scoreGap.bestScore),
      gap: roundRatio(scoreGap.gap),
      topCandidates,
    };
  }

  function buildFocusedCandidateRows(candidateStats = {}, candidateScoreStats = {}) {
    const finalizedScoreStats = finalizeCandidateScoreStats(candidateScoreStats);
    return LOW_PLAYER_CANDIDATE_ACTIONS
      .map((actionId) => {
        const stats = candidateStats[actionId] || {};
        const scoreStats = finalizedScoreStats[actionId] || {};
        const available = numeric(stats.available);
        const availableNotSelected = numeric(stats.availableNotSelected);
        const selected = numeric(stats.selected);
        if (!available && !selected && !numeric(stats.offered)) return null;
        return {
          actionId,
          offered: numeric(stats.offered),
          available,
          selected,
          availableNotSelected,
          availableNotSelectedRate: available ? roundRatio(availableNotSelected / available) : 0,
          bestAvailable: numeric(scoreStats.bestAvailable),
          missedAsBest: numeric(scoreStats.missedAsBest),
          averageAvailableScore: roundRatio(scoreStats.averageAvailableScore),
          averageSelectedScore: roundRatio(scoreStats.averageSelectedScore),
          averageBestAvailableScore: roundRatio(scoreStats.averageBestAvailableScore),
          averageMissedGap: roundRatio(scoreStats.averageMissedGap),
          maxMissedGap: roundRatio(scoreStats.maxMissedGap),
        };
      })
      .filter(Boolean);
  }

  function buildLowPlayerCandidateStats(logs = [], playerResults = [], options = {}) {
    const results = (playerResults || []).filter(Boolean);
    if (!results.length) return [];
    const averageFinalScore = results.reduce((total, result) => total + numeric(result.finalScore), 0) / results.length;
    const lowCutoff = Math.max(230, averageFinalScore - 25);
    const lowResults = results
      .filter((result) => (
        numeric(result.finalScore) <= lowCutoff
        || (result.finalMarkCount != null && Number.isFinite(Number(result.finalMarkCount)) && numeric(result.finalMarkCount) < 3)
      ))
      .sort((left, right) => numeric(left.finalScore) - numeric(right.finalScore) || String(left.playerLabel || "").localeCompare(String(right.playerLabel || "")))
      .slice(0, Math.max(1, Math.round(numeric(options.lowPlayerCandidateLimit) || 6)));

    return lowResults.map((result) => {
      const candidateStats = {};
      const candidateScoreStats = {};
      const actionCounts = {};
      const scoreOpportunities = {
        selectedBelowBest: 0,
        totalGap: 0,
        maxGap: 0,
      };
      const topGapSamples = [];
      const turnActionLogs = (logs || []).filter((entry) => (
        entry?.type === "turn-action"
        && matchesPlayerResult(entry, result)
      ));

      for (const entry of turnActionLogs) {
        const action = getSelectedAction(entry);
        const actionId = getSelectedActionId(entry);
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        increment(actionCounts, actionId);
        const scoreGap = recordTurnCandidateScores(candidateScoreStats, candidates, action);
        if (scoreGap.gap > 0) {
          scoreOpportunities.selectedBelowBest += 1;
          scoreOpportunities.totalGap += scoreGap.gap;
          scoreOpportunities.maxGap = Math.max(scoreOpportunities.maxGap, scoreGap.gap);
          if (topGapSamples.length < 8) {
            topGapSamples.push(buildCandidateGapSample(entry, candidates, scoreGap));
          }
        }

        let matchedSelectedCandidate = false;
        for (const candidate of candidates) {
          const candidateId = getCandidateId(candidate);
          const stats = getCandidateStats(candidateStats, candidateId);
          stats.offered += 1;
          if (isCandidateAvailable(candidate)) stats.available += 1;
          if (candidateMatchesAction(candidate, action)) {
            stats.selected += 1;
            matchedSelectedCandidate = true;
          } else if (isCandidateAvailable(candidate)) {
            stats.availableNotSelected += 1;
          }
        }
        if (!matchedSelectedCandidate) {
          getCandidateStats(candidateStats, actionId).selected += 1;
        }
      }

      return {
        playerId: result.playerId || null,
        playerLabel: result.playerLabel || result.playerId || "unknown",
        finalScore: roundRatio(result.finalScore),
        baseScore: roundRatio(result.baseScore),
        tileScore: roundRatio(result.tileScore),
        cardScore: roundRatio(result.cardScore),
        finalMarkCount: result.finalMarkCount == null ? null : numeric(result.finalMarkCount),
        completedTaskCount: numeric(result.completedTaskCount),
        techCount: numeric(result.techCount),
        turnActionCount: turnActionLogs.length,
        actionCounts,
        focusedCandidateRows: buildFocusedCandidateRows(candidateStats, candidateScoreStats),
        topMissedCandidates: buildTopMissedCandidates(candidateStats),
        topScoreGaps: buildTopScoreGaps(candidateScoreStats),
        scoreOpportunities: {
          selectedBelowBest: scoreOpportunities.selectedBelowBest,
          totalGap: roundRatio(scoreOpportunities.totalGap),
          maxGap: roundRatio(scoreOpportunities.maxGap),
          averageGap: scoreOpportunities.selectedBelowBest
            ? roundRatio(scoreOpportunities.totalGap / scoreOpportunities.selectedBelowBest)
            : 0,
        },
        topGapSamples,
      };
    });
  }

  function getLowPlayerResults(playerResults = [], options = {}) {
    const results = (playerResults || []).filter(Boolean);
    if (!results.length) return [];
    const averageFinalScore = results.reduce((total, result) => total + numeric(result.finalScore), 0) / results.length;
    const lowCutoff = Math.max(230, averageFinalScore - 25);
    return results
      .filter((result) => (
        numeric(result.finalScore) <= lowCutoff
        || (result.finalMarkCount != null && Number.isFinite(Number(result.finalMarkCount)) && numeric(result.finalMarkCount) < 3)
      ))
      .sort((left, right) => numeric(left.finalScore) - numeric(right.finalScore) || String(left.playerLabel || "").localeCompare(String(right.playerLabel || "")))
      .slice(0, Math.max(1, Math.round(numeric(options.lowPlayerCandidateLimit) || 6)));
  }

  function summarizeUnplayedCard(card = {}, zone = "hand") {
    if (!card) return null;
    const typeCode = Number.isFinite(Number(card.typeCode ?? card.cardTypeCode))
      ? Number(card.typeCode ?? card.cardTypeCode)
      : null;
    const taskCount = Math.max(0, Math.round(numeric(card.taskCount)));
    const tasks = Array.isArray(card.tasks) ? card.tasks.filter(Boolean) : [];
    const remainingTaskCount = Number.isFinite(Number(card.remainingTaskCount))
      ? Math.max(0, Math.round(Number(card.remainingTaskCount)))
      : tasks.length
        ? tasks.filter((task) => !task.completed).length
        : taskCount;
    const endGameScoring = Boolean(card.endGameScoring);
    const effectTypes = Array.isArray(card.effectTypes) ? card.effectTypes.filter(Boolean) : [];
    if (!taskCount && !endGameScoring && typeCode !== 3) return null;
    return {
      zone,
      cardId: card.cardId || card.id || null,
      cardInstanceId: card.id || null,
      label: card.label || card.cardName || card.cardLabel || null,
      price: roundRatio(card.price),
      typeCode,
      taskCount,
      remainingTaskCount,
      tasks,
      endGameScoring,
      effectTypes,
      discardActionCode: card.discardActionCode ?? null,
      scanActionCode: card.scanActionCode ?? null,
      incomeCode: card.incomeCode ?? null,
    };
  }

  function buildLowUnplayedCardSamples(playerResults = [], options = {}) {
    return getLowPlayerResults(playerResults, options)
      .map((result) => {
        const cards = [
          ...(result.handCards || []).map((card) => summarizeUnplayedCard(card, "hand")),
          ...(result.reservedCards || []).map((card) => summarizeUnplayedCard(card, "reserved")),
        ].filter(Boolean);
        if (!cards.length) return null;
        return {
          playerId: result.playerId || null,
          playerLabel: result.playerLabel || result.playerId || "unknown",
          finalScore: roundRatio(result.finalScore),
          baseScore: roundRatio(result.baseScore),
          tileScore: roundRatio(result.tileScore),
          cardScore: roundRatio(result.cardScore),
          completedTaskCount: numeric(result.completedTaskCount),
          techCount: numeric(result.techCount),
          finalMarkCount: result.finalMarkCount == null ? null : numeric(result.finalMarkCount),
          finalFormulas: result.finalFormulas || [],
          b2Progress: result.b2Progress || null,
          handSize: numeric(result.handSize),
          reservedCount: numeric(result.reservedCount),
          cards: cards.slice(0, 12),
        };
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  function getPlayerResultForProfile(profile = {}, resultById = new Map(), resultByLabel = new Map()) {
    const playerId = profile.playerId == null ? null : String(profile.playerId);
    const playerLabel = profile.playerLabel == null ? null : String(profile.playerLabel);
    return (playerId && resultById.get(playerId))
      || (playerLabel && resultByLabel.get(playerLabel))
      || null;
  }

  function averageProfilesByMetric(profiles = [], metric) {
    const rows = (profiles || []).filter(Boolean);
    if (!rows.length) return 0;
    return roundRatio(rows.reduce((total, profile) => total + getProfileMetric(profile, metric), 0) / rows.length);
  }

  function buildHighScoreReferenceMetrics(referenceProfiles = []) {
    const reference = {};
    for (const metric of HIGH_SCORE_NEAR_MISS_REFERENCE_METRICS) {
      reference[metric] = averageProfilesByMetric(referenceProfiles, metric);
    }
    return reference;
  }

  function buildHighScoreNearMissCounts(profile = {}) {
    return {
      mainAction: roundRatio(getProfileMetric(profile, "mainActionCount")),
      quickStep: roundRatio(getProfileMetric(profile, "quickStepCount")),
      resourceQuickStep: roundRatio(getProfileMetric(profile, "resourceQuickStepCount")),
      playCard: roundRatio(getProfileMetric(profile, "playCardCount")),
      researchTech: roundRatio(getProfileMetric(profile, "researchTechCount")),
      scan: roundRatio(getProfileMetric(profile, "scanCount")),
      analyze: roundRatio(getProfileMetric(profile, "analyzeCount")),
      placeData: roundRatio(getProfileMetric(profile, "placeDataCount")),
      techCount: roundRatio(getProfileMetric(profile, "techCount")),
      completedTask: roundRatio(getProfileMetric(profile, "completedTaskCount")),
    };
  }

  function buildHighScoreNearMissReferenceGaps(profile = {}, reference = {}) {
    return {
      baseScore: roundRatio(Math.max(0, numeric(reference.baseScore) - getProfileMetric(profile, "baseScore"))),
      tileScore: roundRatio(Math.max(0, numeric(reference.tileScore) - getProfileMetric(profile, "tileScore"))),
      cardScore: roundRatio(Math.max(0, numeric(reference.cardScore) - getProfileMetric(profile, "cardScore"))),
      mainAction: roundRatio(Math.max(0, numeric(reference.mainActionCount) - getProfileMetric(profile, "mainActionCount"))),
      quickStep: roundRatio(Math.max(0, numeric(reference.quickStepCount) - getProfileMetric(profile, "quickStepCount"))),
      resourceQuickStep: roundRatio(Math.max(0, numeric(reference.resourceQuickStepCount) - getProfileMetric(profile, "resourceQuickStepCount"))),
      playCard: roundRatio(Math.max(0, numeric(reference.playCardCount) - getProfileMetric(profile, "playCardCount"))),
      researchTech: roundRatio(Math.max(0, numeric(reference.researchTechCount) - getProfileMetric(profile, "researchTechCount"))),
      scan: roundRatio(Math.max(0, numeric(reference.scanCount) - getProfileMetric(profile, "scanCount"))),
      analyze: roundRatio(Math.max(0, numeric(reference.analyzeCount) - getProfileMetric(profile, "analyzeCount"))),
      placeData: roundRatio(Math.max(0, numeric(reference.placeDataCount) - getProfileMetric(profile, "placeDataCount"))),
      techCount: roundRatio(Math.max(0, numeric(reference.techCount) - getProfileMetric(profile, "techCount"))),
      completedTask: roundRatio(Math.max(0, numeric(reference.completedTaskCount) - getProfileMetric(profile, "completedTaskCount"))),
    };
  }

  function getHighScoreNearMissGapScore(referenceGaps = {}) {
    return roundRatio(
      numeric(referenceGaps.cardScore) * 1.2
      + numeric(referenceGaps.completedTask) * 4
      + numeric(referenceGaps.techCount) * 2
      + numeric(referenceGaps.playCard) * 2
      + numeric(referenceGaps.researchTech) * 1.5
      + numeric(referenceGaps.scan) * 1.5
      + numeric(referenceGaps.analyze) * 2
      + numeric(referenceGaps.resourceQuickStep) * 0.35
      + numeric(referenceGaps.mainAction) * 1.5,
    );
  }

  function buildHighScoreNearMissReasons(sample = {}, referenceGaps = {}) {
    const reasons = [];
    if (numeric(sample.scoreTo300) <= 10) reasons.push("near-300");
    const b2 = sample.b2Progress || {};
    const b2Bottleneck = String(b2.bottleneck || "");
    const sectorDeficit = Math.max(0, numeric(b2.sectorWinDeficit ?? b2.sectorWinsDeficit));
    const orbitLandDeficit = Math.max(0, numeric(b2.orbitLandDeficit));
    if (sectorDeficit > 0 && (sectorDeficit >= 2 || b2Bottleneck.includes("sector"))) reasons.push("b2-sector");
    if (orbitLandDeficit > 0 && (orbitLandDeficit >= 2 || b2Bottleneck.includes("orbit"))) reasons.push("b2-orbit-land");
    if (sample.finalMarkCount != null && numeric(sample.finalMarkCount) < 3) reasons.push("missing-final-mark");
    if (numeric(referenceGaps.cardScore) >= 8) reasons.push("card-score-gap");
    if (numeric(referenceGaps.playCard) >= 2) reasons.push("play-card-gap");
    if (numeric(referenceGaps.techCount) >= 2 || numeric(referenceGaps.researchTech) >= 1.5) reasons.push("tech-gap");
    if (numeric(referenceGaps.scan) >= 2) reasons.push("scan-gap");
    if (numeric(referenceGaps.analyze) >= 1.5) reasons.push("analyze-gap");
    if (numeric(referenceGaps.resourceQuickStep) >= 8 || numeric(referenceGaps.mainAction) >= 4) reasons.push("throughput-gap");
    if ((sample.cards || []).length) reasons.push("unplayed-scoring-card");
    return reasons;
  }

  function buildDTechNearMissPlan(result = {}, profile = {}) {
    const entries = Array.isArray(result.finalFormulaProgress?.entries)
      ? result.finalFormulaProgress.entries
      : [];
    const dEntries = entries.filter((entry) => entry?.formulaId === "d1" || entry?.formulaId === "d2");
    if (!dEntries.length) return null;
    const techCount = Math.max(0, Math.round(numeric(result.techCount ?? profile.techCount)));
    const d2Entries = dEntries.filter((entry) => entry.formulaId === "d2");
    const d2Multiplier = d2Entries.reduce((total, entry) => total + Math.max(0, numeric(entry.multiplier)), 0);
    const currentD2Base = Math.floor(techCount / 2);
    const nextTechD2Base = Math.floor((techCount + 1) / 2);
    const nextTwoTechD2Base = Math.floor((techCount + 2) / 2);
    return {
      techCount: roundRatio(techCount),
      formulas: dEntries.map((entry) => ({
        formulaId: entry.formulaId || null,
        multiplier: roundRatio(entry.multiplier),
        baseValue: roundRatio(entry.baseValue),
        score: roundRatio(entry.score),
      })),
      hasD2: d2Entries.length > 0,
      d2Multiplier: roundRatio(d2Multiplier),
      d2CurrentBase: roundRatio(currentD2Base),
      d2NextTechScore: roundRatio(Math.max(0, nextTechD2Base - currentD2Base) * d2Multiplier),
      d2NextTwoTechScore: roundRatio(Math.max(0, nextTwoTechD2Base - currentD2Base) * d2Multiplier),
      techsToNextD2Step: d2Entries.length ? (techCount % 2 === 0 ? 2 : 1) : null,
    };
  }

  function buildRecentHighScoreTurnTail(logs = [], result = {}, limit = 8) {
    const turnActionLogs = (logs || []).filter((entry) => (
      entry?.type === "turn-action"
      && matchesPlayerResult(entry, result)
    ));
    return turnActionLogs
      .slice(-Math.max(0, Math.round(numeric(limit) || 0)))
      .map((entry) => {
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        const availableCandidates = candidates
          .filter(isCandidateAvailable)
          .sort((left, right) => (
            numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
            || getCandidateId(left).localeCompare(getCandidateId(right))
          ));
        const availableMain = availableCandidates
          .filter((candidate) => candidate.kind === "main");
        const researchTechCandidate = candidates.find((candidate) => getCandidateId(candidate) === "researchTech");
        const playCardCandidate = candidates.find((candidate) => getCandidateId(candidate) === "playCard");
        return {
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          resources: entry.playerResources || null,
          selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
          bestMain: availableMain[0] ? summarizeOpportunityCandidate(availableMain[0]) : null,
          researchTech: researchTechCandidate ? summarizeOpportunityCandidate(researchTechCandidate) : null,
          playCard: playCardCandidate ? summarizeOpportunityCandidate(playCardCandidate) : null,
          topCandidates: availableCandidates.slice(0, 4).map(summarizeOpportunityCandidate),
        };
      });
  }

  function buildDTechSetupWindowTail(logs = [], result = {}, limit = 16) {
    const formulas = new Set((result.finalFormulas || []).map((formulaId) => String(formulaId || "")));
    const entries = Array.isArray(result.finalFormulaProgress?.entries)
      ? result.finalFormulaProgress.entries
      : [];
    const hasDTechPlan = formulas.has("d1")
      || formulas.has("d2")
      || entries.some((entry) => entry?.formulaId === "d1" || entry?.formulaId === "d2");
    if (!hasDTechPlan) return [];

    const normalizedLimit = Math.max(0, Math.round(numeric(limit) || 0));
    if (!normalizedLimit) return [];

    return (logs || [])
      .filter((entry) => {
        if (entry?.type !== "turn-action" || !matchesPlayerResult(entry, result)) return false;
        if (numeric(entry.roundNumber) < 3) return false;
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        const selected = getSelectedAction(entry) || {};
        const selectedId = getCandidateId(selected);
        const researchTechCandidate = candidates.find((candidate) => getCandidateId(candidate) === "researchTech");
        if (selectedId === "researchTech") return true;
        if (!researchTechCandidate) return false;
        const resources = entry.playerResources || {};
        const reason = String(researchTechCandidate.reason || researchTechCandidate.message || "");
        return (
          reason.includes("宣传")
          || numeric(resources.publicity) >= 3
          || numeric(getCandidatePolicyScore(researchTechCandidate)) > 0
        );
      })
      .slice(-normalizedLimit)
      .map((entry) => {
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        const availableCandidates = candidates
          .filter(isCandidateAvailable)
          .sort((left, right) => (
            numeric(getCandidatePolicyScore(right)) - numeric(getCandidatePolicyScore(left))
            || getCandidateId(left).localeCompare(getCandidateId(right))
          ));
        const researchTechCandidate = candidates.find((candidate) => getCandidateId(candidate) === "researchTech");
        const bestMain = availableCandidates.find((candidate) => candidate.kind === "main") || null;
        const bestQuick = availableCandidates.find((candidate) => candidate.kind === "quick") || null;
        const bestSetupQuick = availableCandidates.find((candidate) => (
          candidate.kind === "quick"
          && ["cardCorner", "quickTrade", "move", "placeData"].includes(getCandidateId(candidate))
        )) || null;
        return {
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          resources: entry.playerResources || null,
          selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
          researchTech: researchTechCandidate ? summarizeOpportunityCandidate(researchTechCandidate) : null,
          bestMain: bestMain ? summarizeOpportunityCandidate(bestMain) : null,
          bestQuick: bestQuick ? summarizeOpportunityCandidate(bestQuick) : null,
          bestSetupQuick: bestSetupQuick ? summarizeOpportunityCandidate(bestSetupQuick) : null,
          topCandidates: availableCandidates.slice(0, 5).map(summarizeOpportunityCandidate),
        };
      });
  }

  function getD1FormulaEntries(result = {}) {
    const entries = Array.isArray(result.finalFormulaProgress?.entries)
      ? result.finalFormulaProgress.entries
      : [];
    return entries.filter((entry) => entry?.formulaId === "d1");
  }

  function getProfileForResult(result = {}, profileById = new Map(), profileByLabel = new Map()) {
    const playerId = result.playerId == null ? null : String(result.playerId);
    const playerLabel = result.playerLabel == null ? null : String(result.playerLabel);
    return (playerId && profileById.get(playerId))
      || (playerLabel && profileByLabel.get(playerLabel))
      || null;
  }

  function buildLogTechTypeCounts(logs = [], result = {}) {
    const counts = normalizeTechTypeCounts();
    for (const entry of logs || []) {
      if (entry?.type !== "tech-placement" || !matchesPlayerResult(entry, result)) continue;
      const selected = entry.details?.selected || null;
      if (!selected?.tileId && Array.isArray(entry.details?.availableSlots)) continue;
      const tileId = selected?.tileId || entry.details?.tileId || null;
      const techType = selected?.techType || entry.details?.techType || getTechTypeFromTile(tileId);
      if (D1_TECH_TYPES.includes(techType)) counts[techType] += 1;
    }
    return counts;
  }

  function getD1TechTypeCounts(logs = [], result = {}, profile = null) {
    const profileCounts = normalizeTechTypeCounts(profile?.techTypeCounts || {});
    if (getTechTypeCountsTotal(profileCounts) > 0) return profileCounts;
    const logCounts = buildLogTechTypeCounts(logs, result);
    if (getTechTypeCountsTotal(logCounts) > 0) return logCounts;
    return normalizeTechTypeCounts(result.techTypeCounts || {});
  }

  function summarizeD1FormulaEntries(entries = []) {
    return (entries || []).map((entry) => ({
      tileId: entry.tileId || null,
      slotIndex: entry.slotIndex ?? null,
      multiplier: roundRatio(entry.multiplier),
      baseValue: roundRatio(entry.baseValue),
      score: roundRatio(entry.score),
    }));
  }

  function summarizeD1TechCardOption(card = {}, zone = "hand") {
    if (!card) return null;
    const effectTypes = Array.isArray(card.effectTypes) ? card.effectTypes.filter(Boolean) : [];
    const hasResearchTechEffect = effectTypes.includes("card_research_tech");
    const endGameScoring = Boolean(card.endGameScoring);
    const taskCount = Math.max(0, Math.round(numeric(card.taskCount)));
    const remainingTaskCount = Number.isFinite(Number(card.remainingTaskCount))
      ? Math.max(0, Math.round(Number(card.remainingTaskCount)))
      : taskCount;
    if (!hasResearchTechEffect && !endGameScoring && !taskCount) return null;
    return {
      zone,
      cardId: card.cardId || card.id || null,
      cardInstanceId: card.id || null,
      label: card.label || card.cardName || card.cardLabel || null,
      price: roundRatio(card.price),
      typeCode: card.typeCode ?? card.cardTypeCode ?? null,
      taskCount,
      remainingTaskCount,
      endGameScoring,
      effectTypes,
      discardActionCode: card.discardActionCode ?? null,
      scanActionCode: card.scanActionCode ?? null,
      incomeCode: card.incomeCode ?? null,
      researchTechEffect: hasResearchTechEffect,
    };
  }

  function buildD1TechCardOptions(result = {}) {
    return [
      ...(result.handCards || []).map((card) => summarizeD1TechCardOption(card, "hand")),
      ...(result.reservedCards || []).map((card) => summarizeD1TechCardOption(card, "reserved")),
    ].filter((card) => card && (card.researchTechEffect || card.endGameScoring || numeric(card.remainingTaskCount) > 0));
  }

  function summarizeD1TechPlan(plan = null) {
    if (!plan) return null;
    return {
      type: plan.type || null,
      mainActionId: plan.mainActionId || null,
      actionId: plan.actionId || plan.quickActionId || null,
      label: plan.label || null,
      score: roundRatio(plan.score),
      tileId: plan.tileId || null,
      techType: plan.techType || null,
    };
  }

  function summarizeD1TechTileCandidate(candidate = {}) {
    if (!candidate) return null;
    const tileId = candidate.tileId || null;
    const techType = candidate.techType || getTechTypeFromTile(tileId);
    if (!D1_TECH_TYPES.includes(techType)) return null;
    return {
      tileId,
      techType,
      bonusId: candidate.bonusId || null,
      available: candidate.available !== false,
      score: roundRatio(candidate.score),
      directScoreGain: roundRatio(candidate.directScoreGain),
      finalFormulaDeltas: candidate.finalFormulaDeltas || null,
      plan: summarizeD1TechPlan(candidate.plan),
    };
  }

  function sortD1TechTileCandidates(candidates = []) {
    return (candidates || [])
      .map(summarizeD1TechTileCandidate)
      .filter(Boolean)
      .sort((left, right) => (
        numeric(right.score) - numeric(left.score)
        || String(left.tileId || "").localeCompare(String(right.tileId || ""))
      ));
  }

  function buildD1BestTechCandidateByType(candidates = []) {
    const bestByType = {};
    for (const type of D1_TECH_TYPES) {
      bestByType[type] = (candidates || []).find((candidate) => candidate.techType === type) || null;
    }
    return bestByType;
  }

  function summarizeD1ResearchTechActionCandidate(candidate = null) {
    if (!candidate) return null;
    const topTechCandidates = sortD1TechTileCandidates(candidate.takeable || []);
    const summary = summarizeOpportunityCandidate(candidate);
    const bestTechType = candidate.techType
      || candidate.valueBreakdown?.bestTechType
      || topTechCandidates[0]?.techType
      || null;
    return {
      ...summary,
      available: candidate.available !== false,
      techType: bestTechType,
      bestTechTileId: candidate.valueBreakdown?.bestTechTileId || topTechCandidates[0]?.tileId || null,
      bestTechType,
      finalFormulaDeltas: candidate.finalFormulaDeltas || null,
      topTechCandidates: topTechCandidates.slice(0, 6),
      bestByType: buildD1BestTechCandidateByType(topTechCandidates),
    };
  }

  function buildD1ResearchTechChoices(logs = [], result = {}, missingTechTypes = [], limit = 8) {
    const missingSet = new Set(missingTechTypes || []);
    return (logs || [])
      .filter((entry) => entry?.type === "tech-placement" && matchesPlayerResult(entry, result))
      .map((entry) => {
        const candidates = sortD1TechTileCandidates(entry.details?.candidates || []);
        const selected = summarizeD1TechTileCandidate(entry.details?.selected || {});
        const bestByType = buildD1BestTechCandidateByType(candidates);
        const missingTypeCandidates = D1_TECH_TYPES
          .filter((type) => missingSet.has(type))
          .map((type) => bestByType[type])
          .filter(Boolean);
        const bestMissingScore = missingTypeCandidates.reduce((best, candidate) => Math.max(best, numeric(candidate.score)), -Infinity);
        return {
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          resources: entry.playerResources || null,
          selected,
          bestCandidate: candidates[0] || null,
          bestByType,
          missingTypeCandidates,
          selectedVsBestMissingGap: Number.isFinite(bestMissingScore)
            ? roundRatio(numeric(selected?.score) - bestMissingScore)
            : null,
        };
      })
      .filter((entry) => entry.selected || entry.bestCandidate)
      .slice(-Math.max(0, Math.round(numeric(limit) || 0)));
  }

  function buildD1ResearchTechWindows(logs = [], result = {}, missingTechTypes = [], limit = 8) {
    const missingSet = new Set(missingTechTypes || []);
    return (logs || [])
      .filter((entry) => {
        if (entry?.type !== "turn-action" || !matchesPlayerResult(entry, result)) return false;
        if (numeric(entry.roundNumber) < 3) return false;
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        return getSelectedActionId(entry) === "researchTech"
          || candidates.some((candidate) => getCandidateId(candidate) === "researchTech");
      })
      .map((entry) => {
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        const availableCandidates = sortByCandidatePolicy(candidates.filter(isCandidateAvailable));
        const researchTechCandidate = candidates.find((candidate) => getCandidateId(candidate) === "researchTech") || null;
        const researchTech = summarizeD1ResearchTechActionCandidate(researchTechCandidate);
        const bestMain = availableCandidates.find((candidate) => candidate.kind === "main") || null;
        const missingTypeCandidates = D1_TECH_TYPES
          .filter((type) => missingSet.has(type))
          .map((type) => researchTech?.bestByType?.[type])
          .filter(Boolean);
        return {
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          resources: entry.playerResources || null,
          selected: summarizeOpportunityCandidate(getSelectedAction(entry) || {}),
          researchTech,
          missingTypeCandidates,
          bestMain: bestMain ? summarizeOpportunityCandidate(bestMain) : null,
          topCandidates: availableCandidates.slice(0, 5).map(summarizeOpportunityCandidate),
        };
      })
      .slice(-Math.max(0, Math.round(numeric(limit) || 0)));
  }

  function buildD1TechBalanceReasons(sample = {}) {
    const reasons = [];
    if (numeric(sample.minTechTypeCount) <= 1) reasons.push("low-d1-base");
    if ((sample.missingTechTypesForNextD1 || []).length > 1) reasons.push("multi-color-shortfall");
    if (numeric(sample.finalScore) <= 230) reasons.push("low-final-score");
    if (numeric(sample.techCount) <= 7) reasons.push("low-tech-count");
    if ((sample.techCardOptions || []).some((card) => card.researchTechEffect)) reasons.push("has-tech-card-option");
    if (!(sample.techCardOptions || []).some((card) => card.researchTechEffect)) reasons.push("no-tech-card-option");
    if ((sample.researchTechWindows || []).some((window) => window.researchTech && window.researchTech.available === false)) {
      reasons.push("late-tech-resource-lock");
    }
    return reasons;
  }

  function sortD1TechBalanceBottleneckSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .filter(Boolean)
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.minTechTypeCount) - numeric(right.minTechTypeCount)
        || numeric(right.techsToNextD1Step) - numeric(left.techsToNextD1Step)
        || String(left.playerLabel || "").localeCompare(String(right.playerLabel || ""))
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function buildD1TechBalanceBottleneckSamples(logs = [], playerResults = [], playerProfiles = [], options = {}) {
    const profileById = new Map((playerProfiles || [])
      .filter((profile) => profile?.playerId != null)
      .map((profile) => [String(profile.playerId), profile]));
    const profileByLabel = new Map((playerProfiles || [])
      .filter((profile) => profile?.playerLabel != null)
      .map((profile) => [String(profile.playerLabel), profile]));

    const samples = getLowPlayerResults(playerResults, options)
      .map((result) => {
        const d1Entries = getD1FormulaEntries(result);
        if (!d1Entries.length) return null;
        const profile = getProfileForResult(result, profileById, profileByLabel);
        const techTypeCounts = getD1TechTypeCounts(logs, result, profile);
        const counts = D1_TECH_TYPES.map((type) => numeric(techTypeCounts[type]));
        const minTechTypeCount = Math.min(...counts);
        const maxTechTypeCount = Math.max(...counts);
        const d1BaseValue = Math.min(...d1Entries.map((entry) => numeric(entry.baseValue)));
        const weakD1 = d1BaseValue <= 1
          || minTechTypeCount <= 1
          || maxTechTypeCount - minTechTypeCount >= 2;
        const lowScoreContext = numeric(result.finalScore) <= 240
          || (result.finalMarkCount != null && numeric(result.finalMarkCount) < 3)
          || numeric(result.baseScore) < 160;
        if (!weakD1 && !lowScoreContext) return null;

        const missingTechTypesForNextD1 = D1_TECH_TYPES.filter((type) => numeric(techTypeCounts[type]) === minTechTypeCount);
        const d1MultiplierTotal = d1Entries.reduce((total, entry) => total + Math.max(0, numeric(entry.multiplier)), 0);
        const techCardOptions = buildD1TechCardOptions(result).slice(0, 10);
        const sample = {
          playerId: result.playerId || null,
          playerLabel: result.playerLabel || result.playerId || "unknown",
          finalScore: roundRatio(result.finalScore),
          baseScore: roundRatio(result.baseScore),
          tileScore: roundRatio(result.tileScore),
          cardScore: roundRatio(result.cardScore),
          finalMarkCount: result.finalMarkCount == null ? null : roundRatio(result.finalMarkCount),
          techCount: roundRatio(Math.max(numeric(result.techCount), getTechTypeCountsTotal(techTypeCounts))),
          completedTaskCount: roundRatio(result.completedTaskCount),
          resources: result.resources || null,
          d1: {
            entries: summarizeD1FormulaEntries(d1Entries),
            multiplierTotal: roundRatio(d1MultiplierTotal),
            baseValue: roundRatio(d1BaseValue),
            score: roundRatio(d1Entries.reduce((total, entry) => total + numeric(entry.score), 0)),
          },
          techTypeCounts,
          minTechTypeCount: roundRatio(minTechTypeCount),
          maxTechTypeCount: roundRatio(maxTechTypeCount),
          missingTechTypesForNextD1,
          techsToNextD1Step: missingTechTypesForNextD1.length,
          nextD1StepScore: roundRatio(d1MultiplierTotal),
          techCardOptions,
          researchTechChoices: buildD1ResearchTechChoices(logs, result, missingTechTypesForNextD1, 8),
          researchTechWindows: buildD1ResearchTechWindows(logs, result, missingTechTypesForNextD1, 8),
        };
        sample.reasons = buildD1TechBalanceReasons(sample);
        return sample;
      })
      .filter(Boolean);

    return sortD1TechBalanceBottleneckSamples(samples, options.d1TechBalanceBottleneckLimit ?? 12);
  }

  function sortHighScoreNearMissSamples(samples = [], limit = 12) {
    const normalizedLimit = Math.max(0, Math.round(limit == null ? 12 : numeric(limit)));
    if (!normalizedLimit) return [];
    return [...(samples || [])]
      .filter(Boolean)
      .sort((left, right) => (
        numeric(left.scoreTo300) - numeric(right.scoreTo300)
        || numeric(right.referenceGapScore) - numeric(left.referenceGapScore)
        || numeric(right.finalScore) - numeric(left.finalScore)
        || String(left.playerLabel || "").localeCompare(String(right.playerLabel || ""))
      ))
      .slice(0, normalizedLimit);
  }

  function buildHighScoreNearMissSamples(playerProfiles = [], playerResults = [], options = {}, logs = []) {
    const profiles = (playerProfiles || []).filter(Boolean);
    if (!profiles.length) return [];

    const limit = Math.max(0, Math.round(options.highScoreNearMissLimit == null ? 12 : numeric(options.highScoreNearMissLimit)));
    if (!limit) return [];

    const scoreSorted = [...profiles]
      .sort((left, right) => numeric(right.finalScore) - numeric(left.finalScore) || left.playerLabel.localeCompare(right.playerLabel));
    const highProfiles = scoreSorted.filter((profile) => numeric(profile.finalScore) >= HIGH_SCORE_NEAR_MISS_TARGET);
    const referenceProfiles = highProfiles.length
      ? highProfiles
      : scoreSorted.slice(0, Math.max(1, Math.ceil(scoreSorted.length * 0.25)));
    const reference = buildHighScoreReferenceMetrics(referenceProfiles);
    const resultById = new Map((playerResults || [])
      .filter((result) => result?.playerId != null)
      .map((result) => [String(result.playerId), result]));
    const resultByLabel = new Map((playerResults || [])
      .filter((result) => result?.playerLabel != null)
      .map((result) => [String(result.playerLabel), result]));

    const samples = scoreSorted
      .filter((profile) => {
        const score = numeric(profile.finalScore);
        return score >= HIGH_SCORE_NEAR_MISS_MIN && score < HIGH_SCORE_NEAR_MISS_TARGET;
      })
      .map((profile) => {
        const result = getPlayerResultForProfile(profile, resultById, resultByLabel) || {};
        const cards = [
          ...(result.handCards || []).map((card) => summarizeUnplayedCard(card, "hand")),
          ...(result.reservedCards || []).map((card) => summarizeUnplayedCard(card, "reserved")),
        ].filter(Boolean).slice(0, 8);
        const referenceGaps = buildHighScoreNearMissReferenceGaps(profile, reference);
        const sample = {
          playerId: profile.playerId || null,
          playerLabel: profile.playerLabel || profile.playerId || "unknown",
          finalScore: roundRatio(profile.finalScore),
          scoreTo300: roundRatio(HIGH_SCORE_NEAR_MISS_TARGET - numeric(profile.finalScore)),
          baseScore: roundRatio(profile.baseScore),
          tileScore: roundRatio(profile.tileScore),
          cardScore: roundRatio(profile.cardScore),
          finalMarkCount: result.finalMarkCount == null
            ? (profile.metrics?.finalScoreMarkCount == null ? null : roundRatio(profile.metrics.finalScoreMarkCount))
            : roundRatio(result.finalMarkCount),
          finalFormulas: result.finalFormulas || [],
          finalFormulaProgress: result.finalFormulaProgress || null,
          b2Progress: result.b2Progress || null,
          resources: result.resources || null,
          handSize: numeric(result.handSize ?? profile.handSize),
          reservedCount: numeric(result.reservedCount ?? profile.reservedCount),
          techCount: roundRatio(profile.techCount),
          completedTaskCount: roundRatio(profile.completedTaskCount),
          counts: buildHighScoreNearMissCounts(profile),
          reference,
          referenceGaps,
          referenceGapScore: getHighScoreNearMissGapScore(referenceGaps),
          cards,
          dTechPlan: buildDTechNearMissPlan(result, profile),
          recentTurnTail: buildRecentHighScoreTurnTail(logs, result, 8),
          dTechSetupWindows: buildDTechSetupWindowTail(logs, result, 16),
        };
        sample.reasons = buildHighScoreNearMissReasons(sample, referenceGaps);
        return sample;
      });

    return sortHighScoreNearMissSamples(samples, limit);
  }

  function finalizePlayerProfile(profile) {
    for (const [category, count] of Object.entries(profile.actionCategoryCounts || {})) {
      profile.actionCategoryRatios[category] = profile.turnActionCount
        ? roundRatio(count / profile.turnActionCount)
        : 0;
    }
    profile.metrics.basicMainRatio = profile.actionCategoryRatios.basicMain || 0;
    profile.metrics.engineRatio = profile.actionCategoryRatios.engine || 0;
    profile.metrics.quickRatio = profile.actionCategoryRatios.quick || 0;
    profile.metrics.passRatio = profile.actionCategoryRatios.pass || 0;
    profile.metrics.mainActionCount = numeric(profile.paceCounts.main);
    profile.metrics.quickStepCount = numeric(profile.paceCounts.quick);
    profile.metrics.idleTurnCount = numeric(profile.paceCounts.idle);
    profile.metrics.otherTurnActionCount = numeric(profile.paceCounts.other);
    profile.metrics.productiveActionCount = profile.metrics.mainActionCount + profile.metrics.quickStepCount;
    profile.metrics.quickToMainRatio = profile.metrics.mainActionCount
      ? roundRatio(profile.metrics.quickStepCount / profile.metrics.mainActionCount)
      : 0;
    profile.metrics.productiveActionRatio = profile.turnActionCount
      ? roundRatio(profile.metrics.productiveActionCount / profile.turnActionCount)
      : 0;
    profile.metrics.idleTurnRatio = profile.turnActionCount
      ? roundRatio(profile.metrics.idleTurnCount / profile.turnActionCount)
      : 0;
    profile.metrics.scanCount = numeric(profile.actionCounts.scan);
    profile.metrics.analyzeCount = numeric(profile.actionCounts.analyze);
    profile.metrics.playCardCount = numeric(profile.actionCounts.playCard);
    profile.metrics.researchTechCount = numeric(profile.actionCounts.researchTech);
    profile.metrics.moveCount = numeric(profile.actionCounts.move);
    profile.metrics.placeDataCount = numeric(profile.actionCounts.placeData);
    profile.metrics.cardCornerCount = numeric(profile.actionCounts.cardCorner);
    profile.metrics.quickTradeCount = numeric(profile.actionCounts.quickTrade);
    profile.metrics.resourceQuickStepCount = profile.metrics.placeDataCount
      + profile.metrics.cardCornerCount
      + profile.metrics.quickTradeCount;
    profile.metrics.orbitLandCount = numeric(profile.actionCounts.orbit) + numeric(profile.actionCounts.land);
    profile.metrics.passCount = numeric(profile.actionCounts.pass);
    profile.metrics.routeTargetCount = Object.values(profile.routeTargetCounts || {})
      .reduce((total, count) => total + numeric(count), 0);
    profile.metrics.moveFollowupCount = Object.values(profile.moveFollowupCounts || {})
      .reduce((total, count) => total + numeric(count), 0);
    profile.metrics.turnPlanCount = Object.values(profile.turnPlanCounts || {})
      .reduce((total, count) => total + numeric(count), 0);
    profile.roundPace = Object.values(profile.roundPaceCounts || {})
      .map(summarizeRoundPaceBucket)
      .sort((left, right) => numeric(left.roundNumber) - numeric(right.roundNumber));
    delete profile.roundPaceCounts;
    return profile;
  }

  function buildPlayerProfiles(logs = [], playerResults = []) {
    const profiles = {};
    for (const result of playerResults || []) {
      const profile = ensurePlayerProfile(profiles, result.playerId, result.playerLabel);
      attachPlayerResultToProfile(profile, result);
    }

    for (const entry of logs || []) {
      const profile = ensurePlayerProfile(profiles, entry.playerId, entry.playerLabel);
      if (entry.type === "turn-action") {
        const actionId = getSelectedActionId(entry);
        const action = getSelectedAction(entry);
        const category = getActionCategory(actionId);
        increment(profile.actionCounts, actionId);
        increment(profile.actionCategoryCounts, category);
        increment(profile.paceCounts, getActionPaceCategory(actionId, action));
        recordRoundPace(profile, entry, actionId, action);
        profile.turnActionCount += 1;
        const routeTargetKey = getRouteTargetKey(getRouteTargetFromEntry(entry));
        if (routeTargetKey) increment(profile.routeTargetCounts, routeTargetKey);
        const followupKey = getMoveFollowupKey(entry);
        if (followupKey) increment(profile.moveFollowupCounts, followupKey);
        recordProfileTurnPlan(profile, entry);
      } else if (entry.type === "tech-placement") {
        const selected = entry.details?.selected || null;
        if (!selected?.tileId && Array.isArray(entry.details?.availableSlots)) continue;
        const tileId = selected?.tileId || entry.details?.tileId || "unknown";
        const techType = getTechTypeFromTile(tileId);
        increment(profile.techTypeCounts, techType || "unknown");
        addProfileMetric(profile, "techPlacementCount", 1);
      } else if (entry.type === "scan-target") {
        const target = [
          entry.details?.pendingType || "scan",
          entry.details?.nebulaId || entry.details?.sectorX || "unknown",
        ].join(":");
        increment(profile.scanTargetCounts, target);
        addProfileMetric(profile, "scanTargetCount", 1);
      } else if (entry.type === "move-path") {
        const routeTargetKey = getRouteTargetKey(getRouteTargetFromEntry(entry));
        if (routeTargetKey) increment(profile.routeTargetCounts, routeTargetKey);
        const followupKey = getMoveFollowupKey(entry);
        if (followupKey) increment(profile.moveFollowupCounts, followupKey);
      } else if (entry.type === "final-score-mark") {
        const selected = getFinalScoreMarkSelection(entry);
        increment(profile.decisionCounts, entry.type);
        addProfileMetric(profile, "finalScoreMarkCount", 1);
        addProfileMetric(profile, "finalScoreImmediateValue", numeric(selected.immediateScore));
      } else if (["play-card", "pick-card", "hand-scan", "land-target", "alien-trace", "alien-use", "move-payment", "data-placement"].includes(entry.type)) {
        increment(profile.decisionCounts, entry.type);
      }
    }

    return Object.values(profiles)
      .map(finalizePlayerProfile)
      .sort((left, right) => right.finalScore - left.finalScore || left.playerLabel.localeCompare(right.playerLabel));
  }

  const ROUTE_METRICS = Object.freeze([
    "finalScore",
    "tileScore",
    "cardScore",
    "completedTaskCount",
    "techCount",
    "rocketCount",
    "mainActionCount",
    "quickStepCount",
    "resourceQuickStepCount",
    "productiveActionCount",
    "idleTurnCount",
    "otherTurnActionCount",
    "quickToMainRatio",
    "productiveActionRatio",
    "idleTurnRatio",
    "placeDataCount",
    "cardCornerCount",
    "quickTradeCount",
    "basicMainRatio",
    "engineRatio",
    "quickRatio",
    "passRatio",
    "scanCount",
    "analyzeCount",
    "playCardCount",
    "researchTechCount",
    "moveCount",
    "orbitLandCount",
    "passCount",
    "techPlacementCount",
    "scanTargetCount",
    "routeTargetCount",
    "moveFollowupCount",
    "turnPlanCount",
    "cardSynergyCount",
    "techSynergyCount",
    "mainThenQuickCount",
    "planMoveCount",
    "planScanCount",
    "planLaunchCount",
    "planResearchTechCount",
    "planOrbitLandCount",
    "planTaskCount",
    "planFinalCount",
    "finalScoreMarkCount",
    "finalScoreImmediateValue",
  ]);

  const STRATEGY_WEIGHT_KEYS = Object.freeze([
    "engine",
    "playCard",
    "tech",
    "scan",
    "route",
    "move",
    "orbitLand",
    "task",
    "final",
    "pass",
  ]);

  const DEFAULT_STRATEGY_WEIGHTS = Object.freeze(
    STRATEGY_WEIGHT_KEYS.reduce((weights, key) => ({ ...weights, [key]: 1 }), {}),
  );

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, numeric(value)));
  }

  function normalizeStrategyWeights(weights = {}) {
    const normalized = {};
    for (const key of STRATEGY_WEIGHT_KEYS) {
      normalized[key] = roundRatio(clamp(weights[key] ?? DEFAULT_STRATEGY_WEIGHTS[key], 0.6, 1.6));
    }
    return normalized;
  }

  function applyStrategyWeightDelta(weights, rationale, key, delta, reason) {
    if (!key || !Number.isFinite(Number(delta)) || Number(delta) === 0) return;
    weights[key] = (weights[key] || 1) + Number(delta);
    rationale.push({
      key,
      delta: roundRatio(delta),
      reason,
    });
  }

  function deriveStrategyTuning(analysis = {}) {
    const deltas = analysis.winnerProfileDeltas || analysis.winnerProfileComparison?.delta || {};
    const ratios = analysis.actionCategoryRatios || {};
    const opportunities = analysis.opportunities || {};
    const candidateStats = analysis.candidateStats || {};
    const candidateScoreStats = analysis.candidateScoreStats || {};
    const gameCount = Math.max(1, numeric(analysis.gameCount || 1));
    const completionRate = analysis.completionRate == null ? 1 : clamp(analysis.completionRate, 0, 1);
    const blockedGames = numeric(analysis.blockedGames);
    const confidence = roundRatio(Math.max(0.2, completionRate - Math.min(0.4, blockedGames / gameCount)));
    const weights = { ...DEFAULT_STRATEGY_WEIGHTS };
    const rationale = [];

    const engineDelta = numeric(deltas.engineRatio);
    if (engineDelta > 0.04) {
      applyStrategyWeightDelta(weights, rationale, "engine", Math.min(0.12, engineDelta * 0.7), "胜者卡牌/科技行动占比更高");
      applyStrategyWeightDelta(weights, rationale, "playCard", Math.min(0.08, engineDelta * 0.4), "胜者路线更依赖打牌");
    } else if (engineDelta < -0.08 && numeric(ratios.engine) > 0.35) {
      applyStrategyWeightDelta(weights, rationale, "engine", Math.max(-0.1, engineDelta * 0.4), "引擎行动占比偏高但未体现胜者优势");
    }

    if (numeric(deltas.playCardCount) > 0 || numeric(deltas.cardScore) >= 3) {
      applyStrategyWeightDelta(weights, rationale, "playCard", Math.min(0.12, 0.04 + numeric(deltas.cardScore) * 0.01), "胜者打牌或终局牌收益更高");
      applyStrategyWeightDelta(weights, rationale, "final", Math.min(0.1, Math.max(0.03, numeric(deltas.cardScore) * 0.01)), "胜者终局牌得分领先");
    }

    if (numeric(deltas.completedTaskCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "task", Math.min(0.14, 0.06 + numeric(deltas.completedTaskCount) * 0.03), "胜者任务完成数领先");
      applyStrategyWeightDelta(weights, rationale, "playCard", 0.04, "任务路线需要更重视保留和打牌");
    }

    if (numeric(deltas.techCount) >= 0.5 || numeric(deltas.researchTechCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "tech", Math.min(0.16, 0.06 + Math.max(numeric(deltas.techCount), numeric(deltas.researchTechCount)) * 0.04), "胜者科技路线领先");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.04, "科技属于核心引擎行动");
    }

    if (numeric(deltas.scanCount) >= 0.5 || numeric(deltas.scanTargetCount) >= 1) {
      applyStrategyWeightDelta(weights, rationale, "scan", Math.min(0.16, 0.05 + Math.max(numeric(deltas.scanCount), numeric(deltas.scanTargetCount) * 0.03)), "胜者扫描推进领先");
    }

    if (numeric(deltas.moveCount) >= 1 || numeric(deltas.rocketCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "move", Math.min(0.12, 0.04 + numeric(deltas.moveCount) * 0.02), "胜者移动/探测器布局更积极");
      applyStrategyWeightDelta(weights, rationale, "route", 0.04, "移动优势需要路线目标支撑");
    }

    if (numeric(deltas.routeTargetCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "route", Math.min(0.12, 0.04 + numeric(deltas.routeTargetCount) * 0.03), "胜者移动更常服务明确路线目标");
      applyStrategyWeightDelta(weights, rationale, "move", 0.04, "目标导向移动体现胜者优势");
    }

    if (numeric(deltas.moveFollowupCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "move", Math.min(0.1, 0.03 + numeric(deltas.moveFollowupCount) * 0.025), "胜者更常用移动衔接后续主行动");
      applyStrategyWeightDelta(weights, rationale, "orbitLand", Math.min(0.12, 0.04 + numeric(deltas.moveFollowupCount) * 0.03), "移动后接环绕/登陆体现胜者优势");
      applyStrategyWeightDelta(weights, rationale, "route", 0.04, "路线前瞻需要更高权重");
    }

    if (numeric(deltas.turnPlanCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "move", Math.min(0.1, 0.03 + numeric(deltas.turnPlanCount) * 0.025), "胜者更常执行一回合组合计划");
      applyStrategyWeightDelta(weights, rationale, "route", 0.04, "组合计划需要路线目标支撑");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.03, "一回合组合计划体现引擎化行动优势");
    }

    if (numeric(deltas.cardSynergyCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "playCard", Math.min(0.12, 0.05 + numeric(deltas.cardSynergyCount) * 0.025), "胜者更常通过打牌组合计划补足行动收益");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.03, "打牌组合计划属于核心引擎路线");
    }

    if (numeric(deltas.techSynergyCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "tech", Math.min(0.12, 0.05 + numeric(deltas.techSynergyCount) * 0.025), "胜者更常通过科技组合计划补足行动收益");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.03, "科技组合计划属于核心引擎路线");
    }

    if (numeric(deltas.mainThenQuickCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "move", Math.min(0.08, 0.03 + numeric(deltas.mainThenQuickCount) * 0.02), "胜者更常主行动后衔接快速行动");
      applyStrategyWeightDelta(weights, rationale, "route", 0.03, "主行动后快速行动需要路线目标支撑");
    }

    if (numeric(deltas.planScanCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "scan", Math.min(0.1, 0.04 + numeric(deltas.planScanCount) * 0.02), "胜者组合计划更常服务扫描路线");
    }

    if (numeric(deltas.planResearchTechCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "tech", Math.min(0.1, 0.04 + numeric(deltas.planResearchTechCount) * 0.02), "胜者组合计划更常服务科技路线");
    }

    if (numeric(deltas.planOrbitLandCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "orbitLand", Math.min(0.1, 0.04 + numeric(deltas.planOrbitLandCount) * 0.02), "胜者组合计划更常服务环绕/登陆路线");
      applyStrategyWeightDelta(weights, rationale, "route", 0.03, "环绕/登陆组合需要路线目标支撑");
    }

    if (numeric(deltas.planTaskCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "task", Math.min(0.1, 0.04 + numeric(deltas.planTaskCount) * 0.02), "胜者组合计划更常服务任务路线");
      applyStrategyWeightDelta(weights, rationale, "playCard", 0.03, "任务路线通常需要保留牌和打牌支撑");
    }

    if (numeric(deltas.planFinalCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "final", Math.min(0.1, 0.04 + numeric(deltas.planFinalCount) * 0.02), "胜者组合计划更常服务终局路线");
      applyStrategyWeightDelta(weights, rationale, "playCard", 0.03, "终局路线通常需要终局牌和打牌支撑");
    }

    if (numeric(deltas.finalScoreMarkCount) >= 0.5 || numeric(deltas.finalScoreImmediateValue) >= 2) {
      applyStrategyWeightDelta(weights, rationale, "final", Math.min(0.12, 0.04 + numeric(deltas.finalScoreImmediateValue) * 0.01), "胜者终局板块标记价值更高");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.02, "终局板块需要提前用引擎行动铺垫");
    }

    if (numeric(deltas.orbitLandCount) >= 0.5) {
      applyStrategyWeightDelta(weights, rationale, "orbitLand", Math.min(0.12, 0.05 + numeric(deltas.orbitLandCount) * 0.03), "胜者环绕/登陆数量领先");
      applyStrategyWeightDelta(weights, rationale, "route", 0.04, "星球路线收益更高");
    }

    if (numeric(deltas.passRatio) < -0.05 || numeric(opportunities.passWithAvailableMain) > 0) {
      applyStrategyWeightDelta(weights, rationale, "pass", -0.08, "PASS 机会成本偏高，需要降低过早 PASS 倾向");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.03, "PASS 前优先尝试高价值引擎行动");
    } else if (numeric(deltas.passRatio) > 0.08 && numeric(deltas.finalScore) > 0) {
      applyStrategyWeightDelta(weights, rationale, "pass", 0.04, "胜者 PASS 比例更高且得分领先，保留收入/轮序价值");
    }

    if ((candidateStats.playCard?.availableNotSelected || 0) > (candidateStats.playCard?.selected || 0) * 2) {
      applyStrategyWeightDelta(weights, rationale, "playCard", 0.08, "大量可打牌未被选择");
      applyStrategyWeightDelta(weights, rationale, "task", 0.04, "打牌价值应更多绑定任务路线");
    }

    if ((candidateStats.researchTech?.availableNotSelected || 0) > (candidateStats.researchTech?.selected || 0) * 2) {
      applyStrategyWeightDelta(weights, rationale, "tech", 0.08, "大量可研究科技未被选择");
    }

    if (numeric(candidateScoreStats.playCard?.missedAsBest) > 0) {
      applyStrategyWeightDelta(weights, rationale, "playCard", Math.min(0.1, 0.04 + numeric(candidateScoreStats.playCard.averageMissedGap) * 0.01), "高分打牌候选多次成为最佳但未被选择");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.02, "高分打牌候选被错过说明引擎行动仍需更高权重");
    }

    if (numeric(candidateScoreStats.researchTech?.missedAsBest) > 0) {
      applyStrategyWeightDelta(weights, rationale, "tech", Math.min(0.1, 0.04 + numeric(candidateScoreStats.researchTech.averageMissedGap) * 0.01), "高分科技候选多次成为最佳但未被选择");
      applyStrategyWeightDelta(weights, rationale, "engine", 0.02, "高分科技候选被错过说明引擎行动仍需更高权重");
    }

    if (numeric(candidateScoreStats.scan?.missedAsBest) > 0) {
      applyStrategyWeightDelta(weights, rationale, "scan", Math.min(0.08, 0.03 + numeric(candidateScoreStats.scan.averageMissedGap) * 0.006), "高分扫描候选多次成为最佳但未被选择");
    }

    if (numeric(ratios.basicMain) >= 0.45 && numeric(ratios.engine) < 0.25) {
      applyStrategyWeightDelta(weights, rationale, "engine", 0.1, "基础主行动占比偏高，引擎行动占比偏低");
      applyStrategyWeightDelta(weights, rationale, "task", 0.04, "基础行动需要服务任务路线");
      applyStrategyWeightDelta(weights, rationale, "final", 0.04, "基础行动需要服务终局路线");
    }

    return {
      id: "winner-delta-v1",
      confidence,
      weights: normalizeStrategyWeights(weights),
      baselineWeights: { ...DEFAULT_STRATEGY_WEIGHTS },
      deltas: { ...deltas },
      rationale,
    };
  }

  function getStrategyHistorySummary(entry = {}) {
    return entry.summary || entry.batchSummary || entry.analysisSummary || entry;
  }

  function getStrategyHistoryTuning(entry = {}) {
    const summary = getStrategyHistorySummary(entry);
    return entry.strategyTuning || summary.strategyTuning || deriveStrategyTuning(summary);
  }

  function getStrategyHistoryABComparison(entry = {}) {
    return entry.abComparison || entry.strategyABComparison || entry.comparison || null;
  }

  function getStrategyHistorySelectedVariant(entry = {}, tuning = {}) {
    if (entry.selectedVariant || entry.abSelection) return entry.selectedVariant || entry.abSelection;
    if (tuning?.id === "ab-baseline-v1") return "baseline";
    if (tuning?.id === "ab-tuned-v1") return "tuned";
    return null;
  }

  function getStrategyHistoryEntryWeight(entry = {}) {
    const summary = getStrategyHistorySummary(entry);
    const tuning = getStrategyHistoryTuning(entry);
    const gameCount = Math.max(1, numeric(summary.gameCount || summary.gamesRun || entry.gamesRun || 1));
    const completedGames = numeric(summary.completedGames);
    const blockedGames = numeric(summary.blockedGames);
    const completionRate = summary.completionRate == null
      ? (completedGames ? completedGames / gameCount : 1)
      : clamp(summary.completionRate, 0, 1);
    const confidence = clamp(tuning?.confidence ?? 0.5, 0.05, 1);
    const blockedPenalty = Math.min(0.5, blockedGames / gameCount);
    let weight = gameCount * confidence * Math.max(0.1, completionRate - blockedPenalty);
    const abComparison = getStrategyHistoryABComparison(entry);
    if (abComparison) {
      const selectedVariant = getStrategyHistorySelectedVariant(entry, tuning);
      const scoreDelta = numeric(abComparison.verdict?.scoreDelta ?? abComparison.deltas?.averageWinnerScore);
      const blockedDelta = numeric(abComparison.verdict?.blockedDelta ?? abComparison.deltas?.blockedGames);
      const completionDelta = numeric(abComparison.verdict?.completionDelta ?? abComparison.deltas?.completionRate);
      if (abComparison.verdict?.improved || (scoreDelta > 0 && blockedDelta <= 0 && completionDelta >= 0)) {
        weight *= 1.25 + Math.min(0.75, scoreDelta / 10);
      } else if (selectedVariant === "baseline") {
        weight *= 1.1
          + Math.min(0.9, Math.max(0, -scoreDelta) / 10)
          + Math.min(0.5, Math.max(0, blockedDelta) * 0.25)
          + Math.min(0.4, Math.max(0, -completionDelta) * 0.5);
      } else if (scoreDelta < 0 || blockedDelta > 0 || completionDelta < 0) {
        weight *= 0.15;
      } else {
        weight *= 0.35;
      }
    }
    return Math.max(0.05, weight);
  }

  function addWeightedValues(target, source = {}, weight = 1) {
    for (const [key, value] of Object.entries(source || {})) {
      target[key] = numeric(target[key]) + numeric(value) * weight;
    }
  }

  function divideWeightedValues(source = {}, totalWeight = 1) {
    const divisor = Math.max(0.0001, numeric(totalWeight) || 1);
    return Object.fromEntries(
      Object.entries(source || {}).map(([key, value]) => [key, roundRatio(numeric(value) / divisor)]),
    );
  }

  function aggregateStrategyRationale(entries = []) {
    const grouped = {};
    for (const entry of entries) {
      const tuning = getStrategyHistoryTuning(entry);
      for (const item of tuning?.rationale || []) {
        const key = [item.key || "unknown", item.reason || ""].join("|");
        if (!grouped[key]) {
          grouped[key] = {
            key: item.key || "unknown",
            reason: item.reason || "",
            count: 0,
            totalDelta: 0,
          };
        }
        grouped[key].count += 1;
        grouped[key].totalDelta += numeric(item.delta);
      }
    }
    return Object.values(grouped)
      .map((item) => ({
        key: item.key,
        reason: item.reason,
        count: item.count,
        averageDelta: roundRatio(item.totalDelta / Math.max(1, item.count)),
      }))
      .sort((left, right) => right.count - left.count || Math.abs(right.averageDelta) - Math.abs(left.averageDelta))
      .slice(0, 12);
  }

  function compactStrategyHistoryEntry(entry = {}) {
    const summary = getStrategyHistorySummary(entry);
    const tuning = getStrategyHistoryTuning(entry);
    return {
      kind: entry.kind || (getStrategyHistoryABComparison(entry) ? "ab-test" : "batch"),
      id: entry.id || null,
      label: entry.label || null,
      createdAt: entry.createdAt || null,
      gameCount: numeric(summary.gameCount || summary.gamesRun || entry.gamesRun),
      completedGames: numeric(summary.completedGames),
      blockedGames: numeric(summary.blockedGames),
      completionRate: summary.completionRate == null ? null : roundRatio(summary.completionRate),
      averageWinnerScore: numeric(summary.averageWinnerScore),
      confidence: tuning?.confidence == null ? null : roundRatio(tuning.confidence),
      weights: tuning?.weights ? normalizeStrategyWeights(tuning.weights) : null,
      selectedVariant: getStrategyHistorySelectedVariant(entry, tuning),
      abVerdict: getStrategyHistoryABComparison(entry)?.verdict || null,
    };
  }

  function summarizeStrategyTuningHistory(entries = [], options = {}) {
    const validEntries = (entries || [])
      .filter((entry) => getStrategyHistoryTuning(entry)?.weights);
    const baseWeights = normalizeStrategyWeights(options.baseWeights || options.currentWeights || DEFAULT_STRATEGY_WEIGHTS);
    const learningRate = clamp(options.learningRate ?? 0.5, 0, 1);
    if (!validEntries.length) {
      return {
        id: "strategy-history-v1",
        entryCount: 0,
        totalGames: 0,
        completedGames: 0,
        blockedGames: 0,
        completionRate: 0,
        confidence: 0,
        learningRate,
        baselineWeights: { ...DEFAULT_STRATEGY_WEIGHTS },
        baseWeights,
        targetWeights: { ...baseWeights },
        weights: { ...baseWeights },
        averageDeltas: {},
        rationale: [],
        entries: [],
      };
    }

    const weightedWeights = {};
    const weightedDeltas = {};
    let totalWeight = 0;
    let totalGames = 0;
    let completedGames = 0;
    let blockedGames = 0;
    let totalWinnerScore = 0;
    let winnerScoreGameCount = 0;

    for (const entry of validEntries) {
      const summary = getStrategyHistorySummary(entry);
      const tuning = getStrategyHistoryTuning(entry);
      const weight = getStrategyHistoryEntryWeight(entry);
      totalWeight += weight;
      addWeightedValues(weightedWeights, normalizeStrategyWeights(tuning.weights), weight);
      addWeightedValues(weightedDeltas, tuning.deltas || summary.winnerProfileDeltas || {}, weight);

      const gameCount = Math.max(1, numeric(summary.gameCount || summary.gamesRun || entry.gamesRun || 1));
      totalGames += gameCount;
      completedGames += numeric(summary.completedGames);
      blockedGames += numeric(summary.blockedGames);
      if (summary.averageWinnerScore != null) {
        totalWinnerScore += numeric(summary.averageWinnerScore) * gameCount;
        winnerScoreGameCount += gameCount;
      }
    }

    const targetWeights = normalizeStrategyWeights(divideWeightedValues(weightedWeights, totalWeight));
    const weights = {};
    for (const key of STRATEGY_WEIGHT_KEYS) {
      weights[key] = roundRatio(numeric(baseWeights[key]) + (numeric(targetWeights[key]) - numeric(baseWeights[key])) * learningRate);
    }

    return {
      id: "strategy-history-v1",
      entryCount: validEntries.length,
      totalGames,
      completedGames,
      blockedGames,
      completionRate: totalGames ? roundRatio(completedGames / totalGames) : 0,
      averageWinnerScore: winnerScoreGameCount ? roundRatio(totalWinnerScore / winnerScoreGameCount) : 0,
      confidence: roundRatio(Math.min(1, totalWeight / Math.max(1, totalGames))),
      learningRate,
      baselineWeights: { ...DEFAULT_STRATEGY_WEIGHTS },
      baseWeights,
      targetWeights,
      weights: normalizeStrategyWeights(weights),
      averageDeltas: divideWeightedValues(weightedDeltas, totalWeight),
      rationale: aggregateStrategyRationale(validEntries),
      entries: validEntries.map(compactStrategyHistoryEntry),
    };
  }

  function getBattleSummary(result = {}) {
    return result.summary || result.batchSummary || result;
  }

  function diffNumericMaps(tuned = {}, baseline = {}) {
    const keys = new Set([...Object.keys(tuned || {}), ...Object.keys(baseline || {})]);
    const diff = {};
    for (const key of keys) {
      diff[key] = roundRatio(numeric(tuned?.[key]) - numeric(baseline?.[key]));
    }
    return diff;
  }

  function diffCandidateScoreStats(tuned = {}, baseline = {}) {
    const fields = [
      "offered",
      "available",
      "selected",
      "bestAvailable",
      "missedAsBest",
      "missedGapTotal",
      "averageMissedGap",
      "maxMissedGap",
    ];
    const keys = new Set([...Object.keys(tuned || {}), ...Object.keys(baseline || {})]);
    const diff = {};
    for (const key of keys) {
      diff[key] = {};
      for (const field of fields) {
        diff[key][field] = roundRatio(numeric(tuned?.[key]?.[field]) - numeric(baseline?.[key]?.[field]));
      }
    }
    return diff;
  }

  function compareStrategyBatchResults(baselineResult = {}, tunedResult = {}, options = {}) {
    const baseline = getBattleSummary(baselineResult);
    const tuned = getBattleSummary(tunedResult);
    const baselineGames = numeric(baseline.gameCount || baselineResult.gamesRun);
    const tunedGames = numeric(tuned.gameCount || tunedResult.gamesRun);
    const gameCount = Math.min(baselineGames || 0, tunedGames || 0);
    const scoreDelta = roundRatio(numeric(tuned.averageWinnerScore) - numeric(baseline.averageWinnerScore));
    const completionDelta = roundRatio(numeric(tuned.completionRate) - numeric(baseline.completionRate));
    const blockedDelta = roundRatio(numeric(tuned.blockedGames) - numeric(baseline.blockedGames));
    return {
      id: "strategy-ab-v1",
      label: options.label || null,
      seedBase: options.seedBase || options.seed || null,
      gameCount,
      baseline: {
        gameCount: baselineGames,
        completedGames: numeric(baseline.completedGames),
        blockedGames: numeric(baseline.blockedGames),
        completionRate: numeric(baseline.completionRate),
        averageWinnerScore: numeric(baseline.averageWinnerScore),
        actionCategoryRatios: baseline.actionCategoryRatios || {},
        scoreOpportunities: baseline.scoreOpportunities || {},
        candidateScoreStats: baseline.candidateScoreStats || {},
        topScoreGaps: baseline.topScoreGaps || [],
        winnerProfileDeltas: baseline.winnerProfileDeltas || {},
        routeTargetCounts: baseline.routeTargetCounts || {},
        moveFollowupCounts: baseline.moveFollowupCounts || {},
        turnPlanCounts: baseline.turnPlanCounts || {},
        turnPlanTypeCounts: baseline.turnPlanTypeCounts || {},
        turnPlanActionCounts: baseline.turnPlanActionCounts || {},
        actionSequences: baseline.actionSequences || {},
        winnerTopSequences: baseline.winnerTopSequences || [],
        winnerDeltaSequences: baseline.winnerDeltaSequences || [],
        strategyWeights: baselineResult.strategyWeights || baseline.strategyWeights || null,
      },
      tuned: {
        gameCount: tunedGames,
        completedGames: numeric(tuned.completedGames),
        blockedGames: numeric(tuned.blockedGames),
        completionRate: numeric(tuned.completionRate),
        averageWinnerScore: numeric(tuned.averageWinnerScore),
        actionCategoryRatios: tuned.actionCategoryRatios || {},
        scoreOpportunities: tuned.scoreOpportunities || {},
        candidateScoreStats: tuned.candidateScoreStats || {},
        topScoreGaps: tuned.topScoreGaps || [],
        winnerProfileDeltas: tuned.winnerProfileDeltas || {},
        routeTargetCounts: tuned.routeTargetCounts || {},
        moveFollowupCounts: tuned.moveFollowupCounts || {},
        turnPlanCounts: tuned.turnPlanCounts || {},
        turnPlanTypeCounts: tuned.turnPlanTypeCounts || {},
        turnPlanActionCounts: tuned.turnPlanActionCounts || {},
        actionSequences: tuned.actionSequences || {},
        winnerTopSequences: tuned.winnerTopSequences || [],
        winnerDeltaSequences: tuned.winnerDeltaSequences || [],
        strategyWeights: tunedResult.strategyWeights || tuned.strategyWeights || null,
      },
      deltas: {
        averageWinnerScore: scoreDelta,
        completionRate: completionDelta,
        blockedGames: blockedDelta,
        actionCategoryRatios: diffNumericMaps(tuned.actionCategoryRatios, baseline.actionCategoryRatios),
        scoreOpportunities: diffNumericMaps(tuned.scoreOpportunities, baseline.scoreOpportunities),
        candidateScoreStats: diffCandidateScoreStats(tuned.candidateScoreStats, baseline.candidateScoreStats),
        winnerProfileDeltas: diffNumericMaps(tuned.winnerProfileDeltas, baseline.winnerProfileDeltas),
        routeTargetCounts: diffNumericMaps(tuned.routeTargetCounts, baseline.routeTargetCounts),
        moveFollowupCounts: diffNumericMaps(tuned.moveFollowupCounts, baseline.moveFollowupCounts),
        turnPlanCounts: diffNumericMaps(tuned.turnPlanCounts, baseline.turnPlanCounts),
        turnPlanTypeCounts: diffNumericMaps(tuned.turnPlanTypeCounts, baseline.turnPlanTypeCounts),
        turnPlanActionCounts: diffNumericMaps(tuned.turnPlanActionCounts, baseline.turnPlanActionCounts),
        winnerSequenceCounts: diffNumericMaps(
          tuned.actionSequences?.sequenceCounts?.winner,
          baseline.actionSequences?.sequenceCounts?.winner,
        ),
        nonWinnerSequenceCounts: diffNumericMaps(
          tuned.actionSequences?.sequenceCounts?.nonWinner,
          baseline.actionSequences?.sequenceCounts?.nonWinner,
        ),
        mainActionSequenceCounts: diffNumericMaps(
          tuned.actionSequences?.sequenceCounts?.mainAction,
          baseline.actionSequences?.sequenceCounts?.mainAction,
        ),
      },
      verdict: {
        improved: scoreDelta > 0 && blockedDelta <= 0 && completionDelta >= 0,
        scoreDelta,
        completionDelta,
        blockedDelta,
      },
    };
  }

  function averageProfileMetrics(profiles = []) {
    const averages = {};
    const count = profiles.length;
    if (!count) return averages;
    for (const metric of ROUTE_METRICS) {
      averages[metric] = roundRatio(
        profiles.reduce((total, profile) => total + numeric(profile.metrics?.[metric]), 0) / count,
      );
    }
    return averages;
  }

  function diffProfileMetrics(left = {}, right = {}) {
    const delta = {};
    for (const metric of ROUTE_METRICS) {
      delta[metric] = roundRatio(numeric(left[metric]) - numeric(right[metric]));
    }
    return delta;
  }

  function compareWinnerProfile(playerProfiles = []) {
    if (!playerProfiles.length) return null;
    const winner = playerProfiles[0];
    const rest = playerProfiles.slice(1);
    const winnerMetrics = averageProfileMetrics([winner]);
    const nonWinnerMetrics = averageProfileMetrics(rest);
    return {
      winner,
      nonWinnerAverage: nonWinnerMetrics,
      delta: diffProfileMetrics(winnerMetrics, nonWinnerMetrics),
    };
  }

  function normalizePlayerResults(playerResults = []) {
    return (playerResults || [])
      .map((player) => ({
        playerId: player.playerId || player.id || null,
        playerLabel: player.playerLabel || player.label || player.name || player.playerId || "unknown",
        finalScore: numeric(player.finalScore ?? player.totalScore ?? player.resources?.score),
        baseScore: numeric(player.baseScore ?? player.resources?.score),
        tileScore: numeric(player.tileScore),
        cardScore: numeric(player.cardScore),
        resources: player.resources || {},
        completedTaskCount: numeric(player.completedTaskCount),
        reservedCount: numeric(player.reservedCount),
        handSize: numeric(player.handSize ?? player.resources?.handSize),
        handCards: Array.isArray(player.handCards) ? player.handCards : [],
        reservedCards: Array.isArray(player.reservedCards) ? player.reservedCards : [],
        techCount: numeric(player.techCount),
        techTypeCounts: normalizeTechTypeCounts(player.techTypeCounts || {}),
        rocketCount: numeric(player.rocketCount),
        finalMarkCount: player.finalMarkCount != null && Number.isFinite(Number(player.finalMarkCount))
          ? numeric(player.finalMarkCount)
          : null,
        finalFormulas: Array.isArray(player.finalFormulas) ? player.finalFormulas : [],
        finalFormulaProgress: player.finalFormulaProgress || null,
        b2Progress: player.b2Progress || null,
      }))
      .sort((left, right) => right.finalScore - left.finalScore || left.playerLabel.localeCompare(right.playerLabel));
  }

  function normalizeInitialNumbers(numbers = []) {
    return (numbers || [])
      .map((number) => Number(number))
      .filter((number) => Number.isFinite(number))
      .sort((left, right) => left - right);
  }

  function getInitialNumbersKey(numbers = []) {
    return normalizeInitialNumbers(numbers).join(",");
  }

  function getOpeningLogInitialNumbers(entry = {}) {
    return (entry.details?.initialCards || [])
      .map((card) => {
        const idMatch = String(card?.id || "").match(/initial:(\d+)/);
        if (idMatch) return Number(idMatch[1]);
        const labelMatch = String(card?.label || "").match(/(\d+)/);
        return labelMatch ? Number(labelMatch[1]) : null;
      })
      .filter((number) => Number.isFinite(number));
  }

  function summarizeOpeningPlan(plan = {}, selectedScore = 0) {
    const score = roundRatio(plan.score);
    return {
      score,
      scoreGap: roundRatio(numeric(selectedScore) - score),
      industryLabel: plan.industryLabel || null,
      initialNumbers: normalizeInitialNumbers(plan.initialNumbers || []),
      summary: plan.summary || null,
      goals: plan.goals || null,
    };
  }

  function sortOpeningPlanNearMissSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.bestAlternativeGap) - numeric(right.bestAlternativeGap)
        || String(left.playerLabel || "").localeCompare(String(right.playerLabel || ""), "zh-Hans-CN")
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function buildOpeningPlanNearMissSamples(logs = [], playerResults = [], limit = 12) {
    const resultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const samples = (logs || [])
      .filter((entry) => entry?.type === "initial-selection")
      .map((entry) => {
        const openingPlan = entry.details?.openingPlan || {};
        const topPlans = Array.isArray(openingPlan.topPlans) ? openingPlan.topPlans : [];
        if (topPlans.length < 2) return null;
        const selectedNumbers = getOpeningLogInitialNumbers(entry);
        const selectedKey = getInitialNumbersKey(selectedNumbers);
        const selectedScore = numeric(openingPlan.score ?? topPlans[0]?.score);
        const alternatives = topPlans
          .filter((plan) => getInitialNumbersKey(plan.initialNumbers || []) !== selectedKey)
          .slice(0, 4)
          .map((plan) => summarizeOpeningPlan(plan, selectedScore));
        if (!alternatives.length) return null;
        const player = resultById.get(entry.playerId) || {};
        const bestAlternativeGap = roundRatio(alternatives[0].scoreGap);
        if (bestAlternativeGap > 1.5 && numeric(player.finalScore) > 240) return null;
        return {
          playerId: entry.playerId || null,
          playerLabel: entry.playerLabel || player.playerLabel || null,
          finalScore: roundRatio(player.finalScore),
          industryLabel: entry.details?.industryCard?.label || null,
          aiStyle: entry.details?.aiStyle || null,
          selected: {
            score: roundRatio(selectedScore),
            initialNumbers: normalizeInitialNumbers(selectedNumbers),
            summary: openingPlan.summary || null,
            goals: openingPlan.goals || null,
          },
          bestAlternativeGap,
          alternatives,
        };
      })
      .filter(Boolean);
    return sortOpeningPlanNearMissSamples(samples, limit);
  }

  function getOpeningPlanEarlyActionWindow(logs = [], playerId, maxRoundNumber = 2) {
    const actual = {
      turnActionCount: 0,
      mainActionCount: 0,
      quickStepCount: 0,
      resourceQuickStepCount: 0,
      idleTurnCount: 0,
      playCardCount: 0,
      researchTechCount: 0,
      scanCount: 0,
      analyzeCount: 0,
      placeDataCount: 0,
      cardCornerCount: 0,
      quickTradeCount: 0,
      moveCount: 0,
      launchCount: 0,
      orbitCount: 0,
      landCount: 0,
      orbitLandCount: 0,
      scanTargetCount: 0,
      alienTraceCount: 0,
      dataPlacementCount: 0,
      firstResources: null,
      lastResources: null,
      actionCounts: {},
    };
    for (const entry of logs || []) {
      if ((entry.playerId || null) !== playerId) continue;
      const roundNumber = Number(entry.roundNumber);
      if (!Number.isFinite(roundNumber) || roundNumber > maxRoundNumber) continue;
      if (entry.playerResources) {
        if (!actual.firstResources) actual.firstResources = entry.playerResources;
        actual.lastResources = entry.playerResources;
      }
      if (entry.type === "turn-action") {
        const action = getSelectedAction(entry);
        const actionId = getSelectedActionId(entry);
        const pace = getActionPaceCategory(actionId, action);
        actual.turnActionCount += 1;
        increment(actual.actionCounts, actionId);
        if (pace === "main") actual.mainActionCount += 1;
        else if (pace === "quick") actual.quickStepCount += 1;
        else if (pace === "idle") actual.idleTurnCount += 1;
        if (["placeData", "cardCorner", "quickTrade"].includes(actionId)) actual.resourceQuickStepCount += 1;
        if (actionId === "playCard") actual.playCardCount += 1;
        else if (actionId === "researchTech") actual.researchTechCount += 1;
        else if (actionId === "scan") actual.scanCount += 1;
        else if (actionId === "analyze") actual.analyzeCount += 1;
        else if (actionId === "placeData") actual.placeDataCount += 1;
        else if (actionId === "cardCorner") actual.cardCornerCount += 1;
        else if (actionId === "quickTrade") actual.quickTradeCount += 1;
        else if (actionId === "move") actual.moveCount += 1;
        else if (actionId === "launch") actual.launchCount += 1;
        else if (actionId === "orbit") actual.orbitCount += 1;
        else if (actionId === "land") actual.landCount += 1;
      } else if (entry.type === "scan-target") {
        actual.scanTargetCount += 1;
      } else if (entry.type === "alien-trace") {
        actual.alienTraceCount += 1;
      } else if (entry.type === "data-placement") {
        actual.dataPlacementCount += 1;
      }
    }
    actual.orbitLandCount = actual.orbitCount + actual.landCount;
    return actual;
  }

  function getOpeningPlanSummaryValue(summary = {}, key) {
    return roundRatio(summary?.[key]);
  }

  function buildOpeningPlanConversionReasons(selectedSummary = {}, earlyActual = {}, finalScore = 0) {
    const reasons = [];
    const plannedScan = getOpeningPlanSummaryValue(selectedSummary, "scan");
    const plannedData = getOpeningPlanSummaryValue(selectedSummary, "data");
    const plannedTraces = getOpeningPlanSummaryValue(selectedSummary, "traces");
    const plannedOrbits = getOpeningPlanSummaryValue(selectedSummary, "orbits");
    const earlyScanProgress = numeric(earlyActual.scanCount) + numeric(earlyActual.scanTargetCount);
    const earlyDataProgress = numeric(earlyActual.analyzeCount) + numeric(earlyActual.placeDataCount) + numeric(earlyActual.dataPlacementCount);
    const earlyTraceProgress = numeric(earlyActual.alienTraceCount);
    const engineActionCount = numeric(earlyActual.playCardCount) + numeric(earlyActual.researchTechCount);
    const routeActionCount = numeric(earlyActual.launchCount) + numeric(earlyActual.moveCount) + numeric(earlyActual.orbitLandCount);
    if (plannedScan >= 2 && earlyScanProgress <= 0) reasons.push("scan-plan-unconverted");
    else if (plannedScan >= 2 && earlyScanProgress < plannedScan) reasons.push("scan-plan-underconverted");
    if (plannedTraces >= 1 && earlyTraceProgress <= 0) reasons.push("trace-plan-unconverted");
    else if (plannedTraces >= 1 && earlyTraceProgress < plannedTraces) reasons.push("trace-plan-underconverted");
    if (plannedData >= 1 && earlyDataProgress <= 0) reasons.push("data-plan-unconverted");
    else if (plannedData >= 1 && earlyDataProgress < plannedData) reasons.push("data-plan-underconverted");
    if (plannedOrbits >= 1 && numeric(earlyActual.orbitLandCount) <= 0) reasons.push("orbit-plan-unconverted");
    else if (plannedOrbits >= 1 && numeric(earlyActual.orbitLandCount) < plannedOrbits) reasons.push("orbit-plan-underconverted");
    if (numeric(finalScore) < 245 && engineActionCount <= 1) reasons.push("early-engine-thin");
    if (numeric(finalScore) < 245 && numeric(earlyActual.mainActionCount) <= 8) reasons.push("low-early-main-throughput");
    if (
      routeActionCount >= 4
      && plannedScan + plannedData + plannedTraces >= 2
      && earlyScanProgress + numeric(earlyActual.analyzeCount) <= 1
    ) {
      reasons.push("route-only-before-engine");
    }
    if (numeric(earlyActual.resourceQuickStepCount) >= 4 && engineActionCount <= 1) {
      reasons.push("resource-roll-without-engine");
    }
    return reasons;
  }

  function getOpeningPlanConversionGapScore(selectedSummary = {}, earlyActual = {}, finalScore = 0) {
    const plannedScan = getOpeningPlanSummaryValue(selectedSummary, "scan");
    const plannedData = getOpeningPlanSummaryValue(selectedSummary, "data");
    const plannedTraces = getOpeningPlanSummaryValue(selectedSummary, "traces");
    const plannedOrbits = getOpeningPlanSummaryValue(selectedSummary, "orbits");
    const earlyScanProgress = numeric(earlyActual.scanCount) + numeric(earlyActual.scanTargetCount);
    const earlyDataProgress = numeric(earlyActual.analyzeCount) + numeric(earlyActual.placeDataCount) + numeric(earlyActual.dataPlacementCount);
    const earlyTraceProgress = numeric(earlyActual.alienTraceCount);
    const engineActionCount = numeric(earlyActual.playCardCount) + numeric(earlyActual.researchTechCount);
    let gap = 0;
    gap += Math.max(0, plannedScan - earlyScanProgress) * 3;
    gap += Math.max(0, plannedTraces - earlyTraceProgress) * 3;
    gap += Math.max(0, plannedData - earlyDataProgress) * 2;
    gap += Math.max(0, plannedOrbits - numeric(earlyActual.orbitLandCount)) * 1.5;
    if (numeric(finalScore) < 245 && numeric(earlyActual.mainActionCount) <= 8) gap += 2;
    if (numeric(finalScore) < 245 && engineActionCount <= 1) gap += 1.5;
    return roundRatio(gap);
  }

  function sortOpeningPlanConversionSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(right.conversionGapScore) - numeric(left.conversionGapScore)
        || String(left.playerLabel || "").localeCompare(String(right.playerLabel || ""), "zh-Hans-CN")
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function buildOpeningPlanConversionSamples(logs = [], playerResults = [], playerProfiles = [], limit = 12) {
    const resultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const profiles = (playerProfiles || []).filter(Boolean);
    const averageScore = profiles.length
      ? profiles.reduce((total, profile) => total + numeric(profile.finalScore), 0) / profiles.length
      : 0;
    const lowScoreCutoff = Math.min(245, averageScore ? averageScore - 15 : 245);
    const lowKeys = new Set(
      [...profiles]
        .sort((left, right) => numeric(left.finalScore) - numeric(right.finalScore) || left.playerLabel.localeCompare(right.playerLabel))
        .slice(0, Math.max(1, Math.ceil(Math.max(1, profiles.length) * 0.35)))
        .map((profile) => profile.playerId || profile.playerLabel),
    );
    const samples = (logs || [])
      .filter((entry) => entry?.type === "initial-selection")
      .map((entry) => {
        const openingPlan = entry.details?.openingPlan || {};
        const selectedSummary = openingPlan.summary || null;
        if (!selectedSummary) return null;
        const player = resultById.get(entry.playerId) || {};
        const finalScore = numeric(player.finalScore);
        const earlyActual = getOpeningPlanEarlyActionWindow(logs, entry.playerId, 2);
        const reasons = buildOpeningPlanConversionReasons(selectedSummary, earlyActual, finalScore);
        const conversionGapScore = getOpeningPlanConversionGapScore(selectedSummary, earlyActual, finalScore);
        const playerKey = entry.playerId || entry.playerLabel;
        const lowPlayer = finalScore <= lowScoreCutoff || lowKeys.has(playerKey);
        if (!reasons.length && conversionGapScore <= 0) return null;
        if (!lowPlayer && !reasons.length) return null;
        if (!lowPlayer && conversionGapScore < 2) return null;
        return {
          playerId: entry.playerId || null,
          playerLabel: entry.playerLabel || player.playerLabel || null,
          finalScore: roundRatio(finalScore),
          industryLabel: entry.details?.industryCard?.label || null,
          aiStyle: entry.details?.aiStyle || null,
          selected: {
            score: roundRatio(openingPlan.score),
            initialNumbers: normalizeInitialNumbers(getOpeningLogInitialNumbers(entry)),
            summary: selectedSummary,
            goals: openingPlan.goals || null,
          },
          earlyWindow: {
            rounds: 2,
            actual: earlyActual,
          },
          conversionGapScore,
          reasons,
        };
      })
      .filter(Boolean);
    return sortOpeningPlanConversionSamples(samples, limit);
  }

  function summarizePassReserveCard(card = {}) {
    if (!card) return null;
    return {
      cardId: card.cardId || card.id || null,
      cardLabel: card.cardName || card.label || card.name || null,
      price: numeric(card.price),
      typeCode: card.cardTypeCode ?? card.typeCode ?? null,
      discardActionCode: card.discardActionCode ?? null,
      scanActionCode: card.scanActionCode ?? null,
      incomeCode: card.incomeCode ?? null,
    };
  }

  function isSelectedPassReserveIncomeCandidate(details = {}, preview = {}) {
    const selected = summarizePassReserveCard(details.card || {});
    const selectedIds = [selected?.cardId].filter(Boolean).map(String);
    if (!selectedIds.length || !Array.isArray(preview?.incomeCandidates)) return false;
    return preview.incomeCandidates.some((entry) => selectedIds.includes(String(entry?.cardId || "")));
  }

  function sortPassReserveResourcePressureMissSamples(samples = [], limit = 12) {
    return [...(samples || [])]
      .sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(right.previewScore) - numeric(left.previewScore)
        || String(left.playerLabel || "").localeCompare(String(right.playerLabel || ""), "zh-Hans-CN")
      ))
      .slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : undefined);
  }

  function buildPassReserveResourcePressureMissSamples(logs = [], playerResults = [], limit = 12) {
    const resultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const samples = (logs || [])
      .filter((entry) => entry?.type === "pass-reserve")
      .map((entry) => {
        const details = entry.details || {};
        const actual = details.passReserveResourcePressure || {};
        const preview = details.passReserveResourcePressurePreview || null;
        if (!details.passReserveResourcePressureMiss || actual.active || !preview?.active) return null;
        if (isSelectedPassReserveIncomeCandidate(details, preview)) return null;
        const result = resultById.get(entry.playerId) || {};
        return {
          playerId: entry.playerId || null,
          playerLabel: entry.playerLabel || result.playerLabel || null,
          finalScore: roundRatio(result.finalScore),
          roundNumber: entry.roundNumber ?? null,
          turnNumber: entry.turnNumber ?? null,
          rawTurnNumber: entry.rawTurnNumber ?? entry.turnNumber ?? null,
          resources: entry.playerResources || null,
          selectedCard: summarizePassReserveCard(details.card || {}),
          previewReasons: Array.isArray(preview.reasons) ? preview.reasons : [],
          previewIncomeCandidates: Array.isArray(preview.incomeCandidates)
            ? preview.incomeCandidates.slice(0, 6)
            : [],
          previewScore: roundRatio(preview.score),
          selectedScore: details.selectedScore == null ? null : roundRatio(details.selectedScore),
          rankedCandidateCount: Array.isArray(details.candidates) ? details.candidates.length : 0,
          rankedCandidates: Array.isArray(details.candidates) ? details.candidates.slice(0, 5) : [],
        };
      })
      .filter(Boolean);
    return sortPassReserveResourcePressureMissSamples(samples, limit);
  }

  function getPassOpportunityBestMainScore(sample = {}) {
    const bestMain = sample?.bestMain || {};
    const policyScore = getFiniteScore(bestMain.policyScore);
    if (policyScore != null) return policyScore;
    const score = getFiniteScore(bestMain.score);
    return score == null ? null : score;
  }

  function hasPositivePassOpportunitySample(samples = []) {
    return (samples || []).some((sample) => {
      const bestMainScore = getPassOpportunityBestMainScore(sample);
      return bestMainScore != null && bestMainScore > 0;
    });
  }

  function buildRecommendations(analysis) {
    const recommendations = [];
    const actionTotal = analysis.turnActionCount || 0;
    const ratios = analysis.actionCategoryRatios || {};
    const opportunities = analysis.opportunities || {};
    const candidateStats = analysis.candidateStats || {};
    const candidateScoreStats = analysis.candidateScoreStats || {};
    const passOpportunitySamples = Array.isArray(analysis.passOpportunitySamples)
      ? analysis.passOpportunitySamples
      : [];
    const lowEngineThroughputSamples = Array.isArray(analysis.lowEngineThroughputSamples)
      ? analysis.lowEngineThroughputSamples
      : [];
    const highScoreNearMissSamples = Array.isArray(analysis.highScoreNearMissSamples)
      ? analysis.highScoreNearMissSamples
      : [];
    const d1TechBalanceBottleneckSamples = Array.isArray(analysis.d1TechBalanceBottleneckSamples)
      ? analysis.d1TechBalanceBottleneckSamples
      : [];

    if (actionTotal >= 10 && ratios.basicMain >= 0.45 && ratios.engine < 0.25) {
      recommendations.push({
        id: "raise-engine-synergy",
        priority: "high",
        message: "基础主要行动占比偏高，下一步应让卡牌、科技、终局板块为行动评分提供加成，而不是只按固定行动优先级选择。",
      });
    }
    if (opportunities.passWithAvailableMain > 0) {
      if (!passOpportunitySamples.length || hasPositivePassOpportunitySample(passOpportunitySamples)) {
        recommendations.push({
          id: "score-pass-opportunity-cost",
          priority: "high",
          message: "出现 PASS 时仍有正收益主行动的局面，需要显式计算 PASS 收入/轮序收益与剩余行动机会成本。",
        });
      } else {
        recommendations.push({
          id: "classify-negative-pass-opportunity",
          priority: "medium",
          message: "PASS 样本里的最高主行动均为非正收益，后续应先按样本确认是否为合理 PASS，而不是直接放宽行动阈值。",
        });
      }
    }
    if (numeric(opportunities.earlyPassNoMain) > 0) {
      recommendations.push({
        id: "inspect-early-pass-no-main",
        priority: "medium",
        message: "存在无主行动即 PASS 的回合，应按样本区分资源锁、公共牌/交易不可转化和已验证负收益的强开行动。",
      });
    }
    if (numeric(opportunities.resourceLockMainUnlock) > 0) {
      recommendations.push({
        id: "inspect-resource-lock-main-unlock",
        priority: "medium",
        message: "无主行动 PASS 样本里存在资源交易后可打开较高分主行动的窗口，应按具体 seed 验证是否会扰动共享牌流和高分席位后再放行为。",
      });
    }
    if (numeric(opportunities.finalPublicRefillShortfall) > 0) {
      recommendations.push({
        id: "inspect-final-public-refill-shortfall",
        priority: "medium",
        message: "终局低手牌 PASS 存在高价值公共牌但缺关键资源的样本，应先按缺口验证前序信用点、能量、宣传或手牌保留链，而不是直接放宽精选行为。",
      });
    }
    if (numeric(opportunities.quickBeforePassNoMain) > 0) {
      recommendations.push({
        id: "inspect-quick-before-pass-no-main",
        priority: "medium",
        message: "存在已执行快速行动但仍未接上主行动即 PASS 的回合，应检查资源滚动是否只消耗了手牌/资源而没有打开有效主行动。",
      });
    }
    if (numeric(opportunities.preNoMainPassResourceDrain) > 0) {
      recommendations.push({
        id: "inspect-pre-no-main-resource-drain",
        priority: "medium",
        message: "无主行动 PASS 前存在资源/手牌消耗动作，应按前一动作到 PASS 的资源差定位哪类资源滚动没有接上主行动。",
      });
    }
    if (numeric(opportunities.postPassQuickNoMain) > 0) {
      recommendations.push({
        id: "inspect-post-pass-quick-no-main",
        priority: "medium",
        message: "存在 PASS 后继续快速行动但没有后续主行动的回合，应区分有效路线铺垫和消耗手牌/资源的尾随动作。",
      });
    }
    if (opportunities.endTurnWithPositiveMove > 0) {
      recommendations.push({
        id: "targeted-post-action-move",
        priority: "medium",
        message: "出现结束回合时仍有正收益移动的局面，移动评分应绑定星球、星云、任务牌或终局目标距离。",
      });
    } else if (opportunities.endTurnWithAvailableMove > 0) {
      recommendations.push({
        id: "classify-negative-end-turn-move",
        priority: "low",
        message: "结束回合时虽有移动候选，但最高移动为非正收益；后续应先验证是否存在真实兑现链，而不是直接放宽移动。",
      });
    }
    if (opportunities.selectedBelowBestScore > 0) {
      recommendations.push({
        id: "inspect-score-gap",
        priority: "high",
        message: "出现实际选择低于最高分可用候选的局面，需要检查行动基础偏置、候选 score 和策略选择函数是否一致。",
      });
    }
    if (lowEngineThroughputSamples.length) {
      recommendations.push({
        id: "inspect-low-engine-throughput",
        priority: "medium",
        message: "低分玩家的数据/扫描/分析/科技或打牌吞吐明显落后，应优先定位可闭合的资源滚动链，而不是单独放宽补牌或移动。",
      });
    }
    if (highScoreNearMissSamples.length) {
      recommendations.push({
        id: "inspect-high-score-near-miss",
        priority: "medium",
        message: "存在 280-299 分的高分近失席位，应按样本拆解终局板、B2、行动吞吐和未兑现手牌缺口，优先提高 300+ 命中率。",
      });
    }
    if (numeric(opportunities.openingPlanConversionGap) > 0) {
      recommendations.push({
        id: "inspect-opening-plan-conversion",
        priority: "medium",
        message: "低分玩家存在开局计划未兑现到前两轮行动的样本，应先定位扫描、数据、痕迹或科技/打牌链断点，再调整开局偏置。",
      });
    }
    if (numeric(opportunities.passReserveResourcePressureMiss) > 0) {
      recommendations.push({
        id: "inspect-pass-reserve-resource-pressure",
        priority: "medium",
        message: "存在非第 2 轮 PASS 预留资源压力窗口，应先按样本验证收入牌能否接上下一轮行动，再决定是否放宽预留排序。",
      });
    }
    if (d1TechBalanceBottleneckSamples.length) {
      recommendations.push({
        id: "inspect-d1-tech-chain-closure",
        priority: "medium",
        message: "低分 D1 样本存在三色科技短板，应结合研究科技候选、科技牌和剩余主行动窗口验证闭环，不能只按颜色平衡硬改科技选择。",
      });
    }
    if ((candidateStats.playCard?.availableNotSelected || 0) > (candidateStats.playCard?.selected || 0) * 2) {
      recommendations.push({
        id: "improve-card-value",
        priority: "high",
        message: "可打牌机会大量未被选择，应按卡牌即时收益、任务/终局协同、左上角机会成本重新计算卡牌价值。",
      });
    }
    if (numeric(candidateScoreStats.playCard?.missedAsBest) > 0) {
      recommendations.push({
        id: "inspect-card-score-gap",
        priority: "high",
        message: "打牌曾是最高分候选但未被选择，应检查打牌候选分与顶层行动偏置是否被其他行动压过。",
      });
    }
    if (numeric(opportunities.playCardNearMiss) > 0) {
      recommendations.push({
        id: "inspect-play-card-near-miss",
        priority: "medium",
        message: "打牌候选多次接近实际行动分值但被跳过，应按样本确认具体牌链是否能闭合任务、科技、终局或资源滚动。",
      });
    }
    if (numeric(opportunities.b2TradeNearMiss) > 0) {
      recommendations.push({
        id: "inspect-b2-trade-near-miss",
        priority: "medium",
        message: "B2 扫描解锁交易被其它行动压过，应按样本区分 raw 分接近、action graph 差距过大或扫描后无法闭合。",
      });
    }
    if ((candidateStats.researchTech?.availableNotSelected || 0) > (candidateStats.researchTech?.selected || 0) * 2) {
      recommendations.push({
        id: "contextual-tech-value",
        priority: "medium",
        message: "可研究科技机会大量未被选择，应按当前资源、扫描收益、路线目标和科技板 bonus 调整科技价值。",
      });
    }
    if (numeric(candidateScoreStats.researchTech?.missedAsBest) > 0) {
      recommendations.push({
        id: "inspect-tech-score-gap",
        priority: "medium",
        message: "科技曾是最高分候选但未被选择，应检查科技候选分、顶层 engine 权重和行动基础偏置。",
      });
    }
    if ((analysis.movePayment?.count || 0) > 0 && ratios.quick > 0.25) {
      const hasMoveRiskWithoutPositiveFollowup = numeric(opportunities.endTurnWithAvailableMove) > 0
        && numeric(opportunities.endTurnWithPositiveMove) <= 0;
      const hasPostPassPaidMoveRisk = numeric(opportunities.postPassPaidMoveNoFollowup) > 0;
      if (hasMoveRiskWithoutPositiveFollowup || hasPostPassPaidMoveRisk) {
        recommendations.push({
          id: "classify-route-payment-risk",
          priority: "medium",
          message: "移动付费样本存在无跟进或负收益窗口，应先按目标链验证可兑现性，不要直接上调全局路线/移动权重。",
        });
      } else {
        recommendations.push({
          id: "route-planner",
          priority: "high",
          message: "移动占比不低，建议先实现目标导向路线评分，避免只按方向偏好移动。",
        });
      }
    }
    if ((analysis.bugs || []).length > 0) {
      recommendations.push({
        id: "close-blocking-decisions",
        priority: "high",
        message: "仍有 AI 阻塞，需要优先把阻塞类型对应的 pending 子决策收口或过滤掉不可结算候选。",
      });
    }
    const routeDelta = analysis.winnerProfileComparison?.delta || analysis.winnerProfileDeltas || {};
    if (numeric(routeDelta.engineRatio) >= 0.08) {
      recommendations.push({
        id: "winner-engine-route",
        priority: "medium",
        message: "胜者更依赖卡牌/科技行动，后续策略应继续把任务、终局和科技触发反向接入 playCard/researchTech 评分。",
      });
    }
    if (numeric(routeDelta.completedTaskCount) >= 1 || numeric(routeDelta.cardScore) >= 4) {
      recommendations.push({
        id: "winner-task-card-route",
        priority: "medium",
        message: "胜者任务/终局牌收益更高，建议优先优化任务牌条件识别、保留牌路线需求和任务完成前置行动评分。",
      });
    }
    if (numeric(routeDelta.techCount) >= 1 || numeric(routeDelta.researchTechCount) >= 1) {
      recommendations.push({
        id: "winner-tech-route",
        priority: "medium",
        message: "胜者科技数量或研究行动明显领先，科技评分应继续按终局 D 板、任务科技颜色和触发器需求动态加权。",
      });
    }
    if (numeric(routeDelta.scanCount) >= 1 || numeric(routeDelta.scanTargetCount) >= 2) {
      recommendations.push({
        id: "winner-scan-route",
        priority: "medium",
        message: "胜者扫描推进更明显，扫描评分应继续纳入任务牌颜色、终局 B 板和对手即将完成扇区的阻断价值。",
      });
    }
    if (numeric(routeDelta.routeTargetCount) >= 1) {
      recommendations.push({
        id: "winner-targeted-route",
        priority: "medium",
        message: "胜者移动更常指向明确路线目标，应继续扩展任务牌和终局目标识别，并用同 seed 验证具体兑现链。",
      });
    }
    if (numeric(routeDelta.moveFollowupCount) >= 1) {
      recommendations.push({
        id: "winner-move-followup-route",
        priority: "medium",
        message: "胜者更常用移动衔接环绕/登陆，应继续优化一回合内“移动 -> 主行动”的组合估值。",
      });
    }
    if (numeric(routeDelta.turnPlanCount) >= 1) {
      recommendations.push({
        id: "winner-turn-plan-route",
        priority: "medium",
        message: "胜者更常执行一回合组合计划，应继续扩展“主行动 -> 快速行动”和“快速行动 -> 主行动”的浅搜索。",
      });
    }
    if (numeric(routeDelta.cardSynergyCount) >= 1) {
      recommendations.push({
        id: "winner-card-synergy-route",
        priority: "medium",
        message: "胜者更常通过打牌组合计划补足基础行动收益，应继续细化卡牌任务完成概率、触发器可达性和终局牌预期分。",
      });
    }
    if (numeric(routeDelta.techSynergyCount) >= 1) {
      recommendations.push({
        id: "winner-tech-synergy-route",
        priority: "medium",
        message: "胜者更常通过科技组合计划补足基础行动收益，应继续让路线、扫描、任务和终局需求反向影响科技颜色选择。",
      });
    }
    if (numeric(routeDelta.planScanCount) >= 1) {
      recommendations.push({
        id: "winner-plan-scan-route",
        priority: "medium",
        message: "胜者组合计划更常服务扫描，应继续把任务颜色、终局 B 板和对手扇区威胁纳入扫描评分。",
      });
    }
    if (numeric(routeDelta.planTaskCount) >= 1 || numeric(routeDelta.planFinalCount) >= 1) {
      recommendations.push({
        id: "winner-plan-engine-goals",
        priority: "medium",
        message: "胜者组合计划更常服务任务/终局，应继续把任务完成前置条件和终局公式预期分接入打牌与科技评分。",
      });
    }

    return recommendations;
  }

  function analyzeBattleReport(report = {}, options = {}) {
    const logs = Array.isArray(report.logs) ? report.logs : [];
    const bugs = Array.isArray(report.bugs) ? report.bugs : [];
    const playerResults = normalizePlayerResults(report.playerResults || []);
    const playerResultById = new Map((playerResults || []).map((player) => [player.playerId, player]));
    const typeCounts = {};
    const actionCounts = {};
    const actionCategoryCounts = {};
    const playerActionCounts = {};
    const candidateStats = {};
    const candidateScoreStats = {};
    const effectCounts = {};
    const playCards = {};
    const techTiles = {};
    const scanTargets = {};
    const moveDirections = {};
    const routeTargets = {};
    const moveFollowups = {};
    const turnPlans = {};
    const turnPlanTypes = {};
    const turnPlanActions = {};
    const finalScoreMarks = {};
    const finalScoreFormulas = {};
    const decisionTargets = {};
    const bugCounts = {};
    const opportunities = {
      passWithAvailableMain: 0,
      passWithResourceLockedHand: 0,
      openingPlanNearMiss: 0,
      openingPlanConversionGap: 0,
      passReserveResourcePressureMiss: 0,
      earlyPassNoMain: 0,
      resourceLockMainUnlock: 0,
      quickBeforePassNoMain: 0,
      preNoMainPassResourceDrain: 0,
      postPassQuickNoMain: 0,
      postPassQuickAfterPass: 0,
      postPassPaidMoveNoFollowup: 0,
      postPassThinHandNoFollowupMove: 0,
      finalLowHandPassNoRecovery: 0,
      finalPublicRefillShortfall: 0,
      negativeCardCornerGraphLift: 0,
      endTurnWithAvailableMove: 0,
      endTurnWithPositiveMove: 0,
      researchTechOverCompoundTechCard: 0,
      playCardNearMiss: 0,
      b2ScanNearMiss: 0,
      b2TradeNearMiss: 0,
      mainUnlockLowConcretePlay: 0,
      nonPositivePublicRefill: 0,
      highHandDrainEnergyTrade: 0,
      lastCardPreserveEnergyMove: 0,
      negativeThirdFinalMark: 0,
      d1TechBalanceBottleneck: 0,
      selectedUnavailableCandidate: 0,
      selectedBelowBestScore: 0,
    };
    const passOpportunitySamples = [];
    const passResourceLockSamples = [];
    const openingPlanNearMissSamples = [];
    const openingPlanConversionSamples = [];
    const passReserveResourcePressureMissSamples = [];
    const earlyPassNoMainSamples = [];
    const resourceLockMainUnlockSamples = [];
    const quickBeforePassNoMainSamples = [];
    const preNoMainPassResourceDrainSamples = [];
    const postPassQuickNoMainSamples = [];
    const finalLowHandPassRecoverySamples = [];
    const finalPublicRefillShortfallSamples = [];
    const negativeCardCornerGraphLiftSamples = [];
    const endTurnMoveOpportunitySamples = [];
    const researchTechCompoundCardSamples = [];
    const playCardNearMissSamples = [];
    const b2ScanNearMissSamples = [];
    const b2TradeNearMissSamples = [];
    const mainUnlockLowConcretePlaySamples = [];
    const nonPositivePublicRefillSamples = [];
    const highHandDrainEnergyTradeSamples = [];
    const lastCardPreserveEnergyMoveSamples = [];
    const negativeThirdFinalMarkSamples = [];
    const scoreOpportunities = {
      selectedBelowBest: 0,
      totalGap: 0,
      maxGap: 0,
    };
    const movePayment = {
      count: 0,
      requiredMovePoints: 0,
      energyCost: 0,
      discardedMoveCards: 0,
    };

    for (const entry of logs) {
      increment(typeCounts, entry.type);
      if (entry.type === "effect") {
        increment(effectCounts, entry.details?.effectType || entry.details?.effectId || "unknown");
      }
      if (entry.type === "turn-action") {
        const action = getSelectedAction(entry);
        const actionId = getSelectedActionId(entry);
        const candidates = Array.isArray(entry.details?.candidates) ? entry.details.candidates : [];
        increment(actionCounts, actionId);
        increment(actionCategoryCounts, getActionCategory(actionId));
        incrementNested(playerActionCounts, getPlayerKey(entry), actionId);
        const scoreGap = recordTurnCandidateScores(candidateScoreStats, candidates, action);
        if (scoreGap.gap > 0) {
          opportunities.selectedBelowBestScore += 1;
          scoreOpportunities.selectedBelowBest += 1;
          scoreOpportunities.totalGap += scoreGap.gap;
          scoreOpportunities.maxGap = Math.max(scoreOpportunities.maxGap, scoreGap.gap);
        }

        let matchedSelectedCandidate = false;
        for (const candidate of candidates) {
          const candidateId = getCandidateId(candidate);
          const stats = getCandidateStats(candidateStats, candidateId);
          stats.offered += 1;
          if (isCandidateAvailable(candidate)) stats.available += 1;
          if (candidateMatchesAction(candidate, action)) {
            stats.selected += 1;
            matchedSelectedCandidate = true;
          } else if (isCandidateAvailable(candidate)) {
            stats.availableNotSelected += 1;
          }
        }
        if (!matchedSelectedCandidate) {
          getCandidateStats(candidateStats, actionId).selected += 1;
        }
        if (actionId === "pass" && hasAvailableKind(candidates, "main")) {
          opportunities.passWithAvailableMain += 1;
          if (passOpportunitySamples.length < 12) {
            passOpportunitySamples.push(buildPassOpportunitySample(entry, candidates));
          }
        }
        if (isPassResourceLockedPlayCard(entry, candidates)) {
          opportunities.passWithResourceLockedHand += 1;
          if (passResourceLockSamples.length < 12) {
            passResourceLockSamples.push(buildPassResourceLockSample(entry, candidates));
          }
        }
        if (entry.details?.finalLowHandPassRecoveryDiagnostic) {
          opportunities.finalLowHandPassNoRecovery += 1;
          if (finalLowHandPassRecoverySamples.length < 12) {
            finalLowHandPassRecoverySamples.push(buildFinalLowHandPassRecoverySample(entry));
          }
          if (isFinalPublicRefillShortfall(entry)) {
            opportunities.finalPublicRefillShortfall += 1;
            if (finalPublicRefillShortfallSamples.length < 12) {
              finalPublicRefillShortfallSamples.push(buildFinalPublicRefillShortfallSample(entry));
            }
          }
        }
        if (isNegativeCardCornerGraphLift(entry)) {
          opportunities.negativeCardCornerGraphLift += 1;
          if (negativeCardCornerGraphLiftSamples.length < 12) {
            negativeCardCornerGraphLiftSamples.push(buildNegativeCardCornerGraphLiftSample(entry));
          }
        }
        if (actionId === "end-turn" && hasAvailableAction(candidates, "move")) {
          opportunities.endTurnWithAvailableMove += 1;
          const endTurnMoveSample = buildEndTurnMoveOpportunitySample(entry, candidates);
          if (endTurnMoveSample.bestMovePositive) {
            opportunities.endTurnWithPositiveMove += 1;
          }
          if (endTurnMoveOpportunitySamples.length < 12) {
            endTurnMoveOpportunitySamples.push(endTurnMoveSample);
          }
        }
        if (actionId === "researchTech" && getCompoundResearchTechCards(candidates).length) {
          opportunities.researchTechOverCompoundTechCard += 1;
          if (researchTechCompoundCardSamples.length < 12) {
            researchTechCompoundCardSamples.push(buildResearchTechCompoundCardSample(entry, candidates));
          }
        }
        if (isPlayCardNearMiss(entry, candidates)) {
          opportunities.playCardNearMiss += 1;
          playCardNearMissSamples.push(buildPlayCardNearMissSample(entry, candidates, playerResultById));
        }
        if (isB2ScanNearMiss(entry, candidates, playerResultById)) {
          opportunities.b2ScanNearMiss += 1;
          b2ScanNearMissSamples.push(buildB2ScanNearMissSample(entry, candidates, playerResultById));
        }
        if (isB2TradeNearMiss(entry, candidates, playerResultById)) {
          opportunities.b2TradeNearMiss += 1;
          b2TradeNearMissSamples.push(buildB2TradeNearMissSample(entry, candidates, playerResultById));
        }
        if (isMainUnlockLowConcretePlay(entry)) {
          opportunities.mainUnlockLowConcretePlay += 1;
          if (mainUnlockLowConcretePlaySamples.length < 12) {
            mainUnlockLowConcretePlaySamples.push(buildMainUnlockLowConcretePlaySample(entry));
          }
        }
        if (isHighHandDrainEnergyTrade(entry)) {
          opportunities.highHandDrainEnergyTrade += 1;
          if (highHandDrainEnergyTradeSamples.length < 12) {
            highHandDrainEnergyTradeSamples.push(buildHighHandDrainEnergyTradeSample(entry, logs));
          }
        }
        if (isLastCardPreserveEnergyMove(entry)) {
          opportunities.lastCardPreserveEnergyMove += 1;
          if (lastCardPreserveEnergyMoveSamples.length < 12) {
            lastCardPreserveEnergyMoveSamples.push(buildLastCardPreserveEnergyMoveSample(entry));
          }
        }
        if (candidates.length && action && candidates.some((candidate) => candidateMatchesAction(candidate, action) && !isCandidateAvailable(candidate))) {
          opportunities.selectedUnavailableCandidate += 1;
        }
        const routeTargetKey = getRouteTargetKey(getRouteTargetFromEntry(entry));
        if (routeTargetKey) increment(routeTargets, routeTargetKey);
        const followupKey = getMoveFollowupKey(entry);
        if (followupKey) increment(moveFollowups, followupKey);
        const turnPlanKey = getTurnPlanKey(entry);
        if (turnPlanKey) {
          const turnPlan = getTurnPlanFromEntry(entry);
          increment(turnPlans, turnPlanKey);
          increment(turnPlanTypes, turnPlan?.type || "unknown");
          increment(turnPlanActions, getTurnPlanActionId(turnPlan));
        }
      } else if (isNonPositivePublicRefillPick(entry)) {
        opportunities.nonPositivePublicRefill += 1;
        if (nonPositivePublicRefillSamples.length < 12) {
          nonPositivePublicRefillSamples.push(buildNonPositivePublicRefillSample(entry));
        }
      } else if (entry.type === "play-card") {
        const card = entry.details?.selected || entry.details?.card || {};
        increment(playCards, card.cardLabel || card.cardId || card.cardInstanceId || "unknown");
      } else if (entry.type === "tech-placement") {
        increment(techTiles, entry.details?.tileId || entry.details?.selected?.tileId || "unknown");
      } else if (entry.type === "scan-target") {
        const target = [
          entry.details?.pendingType || "scan",
          entry.details?.nebulaId || entry.details?.sectorX || "unknown",
        ].join(":");
        increment(scanTargets, target);
      } else if (entry.type === "move" || entry.type === "move-path") {
        const action = entry.details?.action || entry.details?.selected || {};
        increment(moveDirections, action.direction || "unknown");
        if (entry.type === "move-path") {
          const routeTargetKey = getRouteTargetKey(getRouteTargetFromEntry(entry));
          if (routeTargetKey) increment(routeTargets, routeTargetKey);
          const followupKey = getMoveFollowupKey(entry);
          if (followupKey) increment(moveFollowups, followupKey);
        }
      } else if (entry.type === "move-payment") {
        movePayment.count += 1;
        movePayment.requiredMovePoints += numeric(entry.details?.requiredMovePoints);
        movePayment.energyCost += numeric(entry.details?.energyCost);
        movePayment.discardedMoveCards += Array.isArray(entry.details?.selectedHandIndices)
          ? entry.details.selectedHandIndices.length
          : 0;
      } else if (entry.type === "final-score-mark") {
        const selected = getFinalScoreMarkSelection(entry);
        const markKey = getFinalScoreMarkKey(entry);
        increment(finalScoreMarks, markKey);
        increment(finalScoreFormulas, selected.formulaId || "unknown");
        incrementNested(decisionTargets, entry.type, markKey);
        if (isNegativeThirdFinalMark(entry)) {
          opportunities.negativeThirdFinalMark += 1;
          if (negativeThirdFinalMarkSamples.length < 12) {
            negativeThirdFinalMarkSamples.push(buildNegativeThirdFinalMarkSample(entry));
          }
        }
      } else if (["discard", "pass-reserve", "pick-card", "hand-scan", "land-target", "alien-trace"].includes(entry.type)) {
        incrementNested(decisionTargets, entry.type, entry.details?.pendingType || entry.details?.kind || entry.details?.label || "unknown");
      }
    }

    for (const bug of bugs) {
      increment(bugCounts, bug.message || "unknown");
    }

    const turnActionCount = Object.values(actionCounts).reduce((total, count) => total + count, 0);
    const actionCategoryRatios = {};
    for (const [category, count] of Object.entries(actionCategoryCounts)) {
      actionCategoryRatios[category] = turnActionCount ? roundRatio(count / turnActionCount) : 0;
    }

    const playerProfiles = buildPlayerProfiles(logs, playerResults);
    const winnerProfileComparison = compareWinnerProfile(playerProfiles);
    const roundPaceSummary = buildRoundPaceSummary(playerProfiles);
    const lowEngineThroughputSamples = buildLowEngineThroughputSamples(playerProfiles);
    const highScoreNearMissSamples = buildHighScoreNearMissSamples(playerProfiles, playerResults, options, logs);
    const allOpeningPlanNearMissSamples = buildOpeningPlanNearMissSamples(logs, playerResults, Infinity);
    openingPlanNearMissSamples.push(...allOpeningPlanNearMissSamples.slice(0, 12));
    opportunities.openingPlanNearMiss = allOpeningPlanNearMissSamples.length;
    const allOpeningPlanConversionSamples = buildOpeningPlanConversionSamples(
      logs,
      playerResults,
      playerProfiles,
      Infinity,
    );
    openingPlanConversionSamples.push(...allOpeningPlanConversionSamples.slice(0, 12));
    opportunities.openingPlanConversionGap = allOpeningPlanConversionSamples.length;
    const allPassReserveResourcePressureMissSamples = buildPassReserveResourcePressureMissSamples(
      logs,
      playerResults,
      Infinity,
    );
    passReserveResourcePressureMissSamples.push(...allPassReserveResourcePressureMissSamples.slice(0, 12));
    opportunities.passReserveResourcePressureMiss = allPassReserveResourcePressureMissSamples.length;
    const allEarlyPassNoMainSamples = buildEarlyPassNoMainSamples(logs, playerResults);
    const earlyPassNoMainReasonCounts = countEarlyPassNoMainReasons(allEarlyPassNoMainSamples);
    earlyPassNoMainSamples.push(...allEarlyPassNoMainSamples.slice(0, 12));
    opportunities.earlyPassNoMain = allEarlyPassNoMainSamples.length;
    const allResourceLockMainUnlockSamples = buildResourceLockMainUnlockSamples(allEarlyPassNoMainSamples, Infinity);
    resourceLockMainUnlockSamples.push(...allResourceLockMainUnlockSamples.slice(0, 12));
    opportunities.resourceLockMainUnlock = allResourceLockMainUnlockSamples.length;
    const allQuickBeforePassNoMainSamples = allEarlyPassNoMainSamples
      .filter((sample) => numeric(sample.quickBeforePassCount) > 0);
    quickBeforePassNoMainSamples.push(...allQuickBeforePassNoMainSamples.slice(0, 12));
    opportunities.quickBeforePassNoMain = allQuickBeforePassNoMainSamples.length;
    const allPreNoMainPassResourceDrainSamples = buildPreNoMainPassResourceDrainSamples(
      logs,
      playerResults,
      allEarlyPassNoMainSamples,
    );
    preNoMainPassResourceDrainSamples.push(...allPreNoMainPassResourceDrainSamples.slice(0, 12));
    opportunities.preNoMainPassResourceDrain = allPreNoMainPassResourceDrainSamples.length;
    const lowRoundActionTailSamples = buildLowRoundActionTailSamples(
      logs,
      playerResults,
      roundPaceSummary.lowRoundPaceSamples,
      allEarlyPassNoMainSamples,
      allPreNoMainPassResourceDrainSamples,
    );
    const allPostPassQuickNoMainSamples = allEarlyPassNoMainSamples
      .filter((sample) => numeric(sample.quickAfterPassCount) > 0);
    postPassQuickNoMainSamples.push(...allPostPassQuickNoMainSamples.slice(0, 12));
    opportunities.postPassQuickNoMain = allPostPassQuickNoMainSamples.length;
    const postPassQuickAnalysis = buildPostPassQuickAnalysis(logs, playerResults);
    opportunities.postPassQuickAfterPass = postPassQuickAnalysis.counts.postPassQuickAfterPass;
    opportunities.postPassPaidMoveNoFollowup = postPassQuickAnalysis.counts.postPassPaidMoveNoFollowup;
    opportunities.postPassThinHandNoFollowupMove = postPassQuickAnalysis.counts.postPassThinHandNoFollowupMove;
    const lowPlayerCandidateStats = buildLowPlayerCandidateStats(logs, playerResults, options);
    const lowUnplayedCardSamples = buildLowUnplayedCardSamples(playerResults, options);
    const d1TechBalanceBottleneckSamples = buildD1TechBalanceBottleneckSamples(
      logs,
      playerResults,
      playerProfiles,
      options,
    );
    opportunities.d1TechBalanceBottleneck = d1TechBalanceBottleneckSamples.length;
    const actionSequences = buildActionSequences(logs, playerResults, options);
    const scoreBuckets = buildScoreBuckets(playerResults, logs);
    const analysis = {
      summary: report.lastSummary || report.summary || null,
      totalLogs: logs.length,
      turnActionCount,
      typeCounts,
      actionCounts,
      actionCategoryCounts,
      actionCategoryRatios,
      playerActionCounts,
      candidateStats,
      candidateScoreStats: finalizeCandidateScoreStats(candidateScoreStats),
      topScoreGaps: buildTopScoreGaps(candidateScoreStats),
      topMissedCandidates: buildTopMissedCandidates(candidateStats),
      effectCounts,
      topEffects: rankCounts(effectCounts),
      playCards: rankCounts(playCards),
      techTiles: rankCounts(techTiles),
      scanTargets: rankCounts(scanTargets),
      moveDirections: rankCounts(moveDirections),
      routeTargetCounts: routeTargets,
      routeTargets: rankCounts(routeTargets),
      moveFollowupCounts: moveFollowups,
      moveFollowups: rankCounts(moveFollowups),
      turnPlanCounts: turnPlans,
      turnPlans: rankCounts(turnPlans),
      turnPlanTypeCounts: turnPlanTypes,
      turnPlanTypes: rankCounts(turnPlanTypes),
      turnPlanActionCounts: turnPlanActions,
      turnPlanActions: rankCounts(turnPlanActions),
      finalScoreMarkCounts: finalScoreMarks,
      finalScoreMarks: rankCounts(finalScoreMarks),
      finalScoreFormulaCounts: finalScoreFormulas,
      finalScoreFormulas: rankCounts(finalScoreFormulas),
      decisionTargets,
      movePayment,
      opportunities,
      passOpportunitySamples,
      passResourceLockSamples,
      openingPlanNearMissSamples,
      openingPlanConversionSamples,
      passReserveResourcePressureMissSamples,
      earlyPassNoMainSamples,
      resourceLockMainUnlockSamples,
      earlyPassNoMainReasonCounts,
      quickBeforePassNoMainSamples,
      preNoMainPassResourceDrainSamples,
      postPassQuickNoMainSamples,
      postPassQuickSamples: postPassQuickAnalysis.samples.slice(0, 12),
      finalLowHandPassRecoverySamples,
      finalPublicRefillShortfallSamples,
      negativeCardCornerGraphLiftSamples,
      endTurnMoveOpportunitySamples,
      researchTechCompoundCardSamples,
      playCardNearMissSamples: sortPlayCardNearMissSamples(playCardNearMissSamples),
      b2ScanNearMissSamples: sortB2ScanNearMissSamples(b2ScanNearMissSamples),
      b2TradeNearMissSamples: sortB2TradeNearMissSamples(b2TradeNearMissSamples),
      mainUnlockLowConcretePlaySamples,
      nonPositivePublicRefillSamples,
      highHandDrainEnergyTradeSamples,
      lastCardPreserveEnergyMoveSamples,
      negativeThirdFinalMarkSamples,
      scoreOpportunities: {
        selectedBelowBest: scoreOpportunities.selectedBelowBest,
        totalGap: roundRatio(scoreOpportunities.totalGap),
        maxGap: roundRatio(scoreOpportunities.maxGap),
        averageGap: scoreOpportunities.selectedBelowBest
          ? roundRatio(scoreOpportunities.totalGap / scoreOpportunities.selectedBelowBest)
          : 0,
      },
      bugs: rankCounts(bugCounts),
      playerResults,
      playerProfiles,
      winnerProfileComparison,
      winnerProfileDeltas: winnerProfileComparison?.delta || {},
      winner: playerResults[0] || null,
      paceSummary: buildPaceSummary(playerProfiles),
      roundPaceSummary,
      lowRoundPaceSamples: roundPaceSummary.lowRoundPaceSamples,
      lowRoundActionTailSamples,
      lowEngineThroughputSamples,
      highScoreNearMissSamples,
      lowPlayerCandidateStats,
      lowUnplayedCardSamples,
      d1TechBalanceBottleneckSamples,
      sequenceWindowTurns: actionSequences.windowTurns,
      actionSequences,
      scoreBuckets,
    };
    analysis.recommendations = buildRecommendations(analysis);
    analysis.strategyTuning = deriveStrategyTuning(analysis);
    return analysis;
  }

  function summarizeBattleAnalyses(analyses = [], options = {}) {
    const validAnalyses = (analyses || []).filter(Boolean);
    const mergedActionCounts = {};
    const mergedActionCategoryCounts = {};
    const mergedTypeCounts = {};
    const mergedCandidateStats = {};
    const mergedCandidateScoreStats = {};
    const mergedOpportunities = {};
    const mergedScoreOpportunities = {
      selectedBelowBest: 0,
      totalGap: 0,
      maxGap: 0,
    };
    const mergedPassOpportunitySamples = [];
    const mergedPassResourceLockSamples = [];
    const mergedOpeningPlanNearMissSamples = [];
    const mergedOpeningPlanConversionSamples = [];
    const mergedPassReserveResourcePressureMissSamples = [];
    const mergedEarlyPassNoMainSamples = [];
    const mergedResourceLockMainUnlockSamples = [];
    const mergedEarlyPassNoMainReasonCounts = {};
    const mergedQuickBeforePassNoMainSamples = [];
    const mergedPreNoMainPassResourceDrainSamples = [];
    const mergedPostPassQuickNoMainSamples = [];
    const mergedPostPassQuickSamples = [];
    const mergedFinalLowHandPassRecoverySamples = [];
    const mergedFinalPublicRefillShortfallSamples = [];
    const mergedNegativeCardCornerGraphLiftSamples = [];
    const mergedEndTurnMoveOpportunitySamples = [];
    const mergedResearchTechCompoundCardSamples = [];
    const mergedPlayCardNearMissSamples = [];
    const mergedB2ScanNearMissSamples = [];
    const mergedB2TradeNearMissSamples = [];
    const mergedMainUnlockLowConcretePlaySamples = [];
    const mergedNonPositivePublicRefillSamples = [];
    const mergedHighHandDrainEnergyTradeSamples = [];
    const mergedLastCardPreserveEnergyMoveSamples = [];
    const mergedNegativeThirdFinalMarkSamples = [];
    const mergedLowPlayerCandidateStats = [];
    const mergedLowUnplayedCardSamples = [];
    const mergedD1TechBalanceBottleneckSamples = [];
    const mergedHighScoreNearMissSamples = [];
    const mergedLowRoundActionTailSamples = [];
    const mergedMovePayment = {
      count: 0,
      requiredMovePoints: 0,
      energyCost: 0,
      discardedMoveCards: 0,
    };
    const mergedBugCounts = {};
    const mergedRouteTargets = {};
    const mergedMoveFollowups = {};
    const mergedTurnPlans = {};
    const mergedTurnPlanTypes = {};
    const mergedTurnPlanActions = {};
    const mergedFinalScoreMarks = {};
    const mergedFinalScoreFormulas = {};
    const mergedSequenceCounts = {};
    const mergedScoreBuckets = {};
    const winnerCounts = {};
    const allProfiles = [];
    const winnerProfiles = [];
    const nonWinnerProfiles = [];
    let totalSteps = 0;
    let completedGames = 0;
    let blockedGames = 0;
    let totalWinnerScore = 0;

    for (const analysis of validAnalyses) {
      const summary = analysis.summary || {};
      totalSteps += numeric(summary.steps);
      if (summary.gameEnded) completedGames += 1;
      if (summary.blocked || analysis.bugs?.length) blockedGames += 1;
      for (const [key, count] of Object.entries(analysis.actionCounts || {})) increment(mergedActionCounts, key, count);
      for (const [key, count] of Object.entries(analysis.actionCategoryCounts || {})) increment(mergedActionCategoryCounts, key, count);
      for (const [key, count] of Object.entries(analysis.typeCounts || {})) increment(mergedTypeCounts, key, count);
      for (const [actionId, stats] of Object.entries(analysis.candidateStats || {})) {
        const mergedStats = getCandidateStats(mergedCandidateStats, actionId);
        mergedStats.offered += numeric(stats.offered);
        mergedStats.available += numeric(stats.available);
        mergedStats.selected += numeric(stats.selected);
        mergedStats.availableNotSelected += numeric(stats.availableNotSelected);
      }
      mergeCandidateScoreStats(mergedCandidateScoreStats, analysis.candidateScoreStats || {});
      for (const [key, count] of Object.entries(analysis.opportunities || {})) increment(mergedOpportunities, key, count);
      if (mergedPassOpportunitySamples.length < 12 && Array.isArray(analysis.passOpportunitySamples)) {
        mergedPassOpportunitySamples.push(...analysis.passOpportunitySamples.slice(0, 12 - mergedPassOpportunitySamples.length));
      }
      if (mergedPassResourceLockSamples.length < 12 && Array.isArray(analysis.passResourceLockSamples)) {
        mergedPassResourceLockSamples.push(
          ...analysis.passResourceLockSamples.slice(0, 12 - mergedPassResourceLockSamples.length),
        );
      }
      if (Array.isArray(analysis.openingPlanNearMissSamples)) {
        mergedOpeningPlanNearMissSamples.push(...analysis.openingPlanNearMissSamples);
      }
      if (Array.isArray(analysis.openingPlanConversionSamples)) {
        mergedOpeningPlanConversionSamples.push(...analysis.openingPlanConversionSamples);
      }
      if (Array.isArray(analysis.passReserveResourcePressureMissSamples)) {
        mergedPassReserveResourcePressureMissSamples.push(...analysis.passReserveResourcePressureMissSamples);
      }
      if (Array.isArray(analysis.earlyPassNoMainSamples)) {
        mergedEarlyPassNoMainSamples.push(...analysis.earlyPassNoMainSamples);
      }
      if (Array.isArray(analysis.resourceLockMainUnlockSamples)) {
        mergedResourceLockMainUnlockSamples.push(...analysis.resourceLockMainUnlockSamples);
      }
      for (const [key, count] of Object.entries(analysis.earlyPassNoMainReasonCounts || {})) {
        increment(mergedEarlyPassNoMainReasonCounts, key, count);
      }
      if (Array.isArray(analysis.quickBeforePassNoMainSamples)) {
        mergedQuickBeforePassNoMainSamples.push(...analysis.quickBeforePassNoMainSamples);
      }
      if (Array.isArray(analysis.preNoMainPassResourceDrainSamples)) {
        mergedPreNoMainPassResourceDrainSamples.push(...analysis.preNoMainPassResourceDrainSamples);
      }
      if (Array.isArray(analysis.postPassQuickNoMainSamples)) {
        mergedPostPassQuickNoMainSamples.push(...analysis.postPassQuickNoMainSamples);
      }
      if (mergedPostPassQuickSamples.length < 12 && Array.isArray(analysis.postPassQuickSamples)) {
        mergedPostPassQuickSamples.push(
          ...analysis.postPassQuickSamples.slice(0, 12 - mergedPostPassQuickSamples.length),
        );
      }
      if (
        mergedFinalLowHandPassRecoverySamples.length < 12
        && Array.isArray(analysis.finalLowHandPassRecoverySamples)
      ) {
        mergedFinalLowHandPassRecoverySamples.push(
          ...analysis.finalLowHandPassRecoverySamples.slice(0, 12 - mergedFinalLowHandPassRecoverySamples.length),
        );
      }
      if (
        mergedFinalPublicRefillShortfallSamples.length < 12
        && Array.isArray(analysis.finalPublicRefillShortfallSamples)
      ) {
        mergedFinalPublicRefillShortfallSamples.push(
          ...analysis.finalPublicRefillShortfallSamples.slice(
            0,
            12 - mergedFinalPublicRefillShortfallSamples.length,
          ),
        );
      }
      if (
        mergedNegativeCardCornerGraphLiftSamples.length < 12
        && Array.isArray(analysis.negativeCardCornerGraphLiftSamples)
      ) {
        mergedNegativeCardCornerGraphLiftSamples.push(
          ...analysis.negativeCardCornerGraphLiftSamples.slice(0, 12 - mergedNegativeCardCornerGraphLiftSamples.length),
        );
      }
      if (mergedEndTurnMoveOpportunitySamples.length < 12 && Array.isArray(analysis.endTurnMoveOpportunitySamples)) {
        mergedEndTurnMoveOpportunitySamples.push(
          ...analysis.endTurnMoveOpportunitySamples.slice(0, 12 - mergedEndTurnMoveOpportunitySamples.length),
        );
      }
      if (mergedResearchTechCompoundCardSamples.length < 12 && Array.isArray(analysis.researchTechCompoundCardSamples)) {
        mergedResearchTechCompoundCardSamples.push(
          ...analysis.researchTechCompoundCardSamples.slice(0, 12 - mergedResearchTechCompoundCardSamples.length),
        );
      }
      if (Array.isArray(analysis.playCardNearMissSamples)) {
        mergedPlayCardNearMissSamples.push(...analysis.playCardNearMissSamples);
      }
      if (Array.isArray(analysis.b2ScanNearMissSamples)) {
        mergedB2ScanNearMissSamples.push(...analysis.b2ScanNearMissSamples);
      }
      if (Array.isArray(analysis.b2TradeNearMissSamples)) {
        mergedB2TradeNearMissSamples.push(...analysis.b2TradeNearMissSamples);
      }
      if (mergedMainUnlockLowConcretePlaySamples.length < 12 && Array.isArray(analysis.mainUnlockLowConcretePlaySamples)) {
        mergedMainUnlockLowConcretePlaySamples.push(
          ...analysis.mainUnlockLowConcretePlaySamples.slice(0, 12 - mergedMainUnlockLowConcretePlaySamples.length),
        );
      }
      if (mergedNonPositivePublicRefillSamples.length < 12 && Array.isArray(analysis.nonPositivePublicRefillSamples)) {
        mergedNonPositivePublicRefillSamples.push(
          ...analysis.nonPositivePublicRefillSamples.slice(0, 12 - mergedNonPositivePublicRefillSamples.length),
        );
      }
      if (mergedHighHandDrainEnergyTradeSamples.length < 12 && Array.isArray(analysis.highHandDrainEnergyTradeSamples)) {
        mergedHighHandDrainEnergyTradeSamples.push(
          ...analysis.highHandDrainEnergyTradeSamples.slice(0, 12 - mergedHighHandDrainEnergyTradeSamples.length),
        );
      }
      if (mergedLastCardPreserveEnergyMoveSamples.length < 12 && Array.isArray(analysis.lastCardPreserveEnergyMoveSamples)) {
        mergedLastCardPreserveEnergyMoveSamples.push(
          ...analysis.lastCardPreserveEnergyMoveSamples.slice(0, 12 - mergedLastCardPreserveEnergyMoveSamples.length),
        );
      }
      if (mergedNegativeThirdFinalMarkSamples.length < 12 && Array.isArray(analysis.negativeThirdFinalMarkSamples)) {
        mergedNegativeThirdFinalMarkSamples.push(
          ...analysis.negativeThirdFinalMarkSamples.slice(0, 12 - mergedNegativeThirdFinalMarkSamples.length),
        );
      }
      if (mergedLowPlayerCandidateStats.length < 16 && Array.isArray(analysis.lowPlayerCandidateStats)) {
        mergedLowPlayerCandidateStats.push(
          ...analysis.lowPlayerCandidateStats.slice(0, 16 - mergedLowPlayerCandidateStats.length),
        );
      }
      if (mergedLowUnplayedCardSamples.length < 16 && Array.isArray(analysis.lowUnplayedCardSamples)) {
        mergedLowUnplayedCardSamples.push(
          ...analysis.lowUnplayedCardSamples.slice(0, 16 - mergedLowUnplayedCardSamples.length),
        );
      }
      if (mergedD1TechBalanceBottleneckSamples.length < 16 && Array.isArray(analysis.d1TechBalanceBottleneckSamples)) {
        mergedD1TechBalanceBottleneckSamples.push(
          ...analysis.d1TechBalanceBottleneckSamples.slice(0, 16 - mergedD1TechBalanceBottleneckSamples.length),
        );
      }
      if (Array.isArray(analysis.highScoreNearMissSamples)) {
        mergedHighScoreNearMissSamples.push(...analysis.highScoreNearMissSamples);
      }
      if (Array.isArray(analysis.lowRoundActionTailSamples)) {
        mergedLowRoundActionTailSamples.push(...analysis.lowRoundActionTailSamples);
      }
      mergedScoreOpportunities.selectedBelowBest += numeric(analysis.scoreOpportunities?.selectedBelowBest);
      mergedScoreOpportunities.totalGap += numeric(analysis.scoreOpportunities?.totalGap);
      mergedScoreOpportunities.maxGap = Math.max(mergedScoreOpportunities.maxGap, numeric(analysis.scoreOpportunities?.maxGap));
      for (const [key, count] of Object.entries(analysis.routeTargetCounts || {})) increment(mergedRouteTargets, key, count);
      for (const [key, count] of Object.entries(analysis.moveFollowupCounts || {})) increment(mergedMoveFollowups, key, count);
      for (const [key, count] of Object.entries(analysis.turnPlanCounts || {})) increment(mergedTurnPlans, key, count);
      for (const [key, count] of Object.entries(analysis.turnPlanTypeCounts || {})) increment(mergedTurnPlanTypes, key, count);
      for (const [key, count] of Object.entries(analysis.turnPlanActionCounts || {})) increment(mergedTurnPlanActions, key, count);
      for (const [key, count] of Object.entries(analysis.finalScoreMarkCounts || {})) increment(mergedFinalScoreMarks, key, count);
      for (const [key, count] of Object.entries(analysis.finalScoreFormulaCounts || {})) increment(mergedFinalScoreFormulas, key, count);
      mergeSequenceCounts(mergedSequenceCounts, analysis.actionSequences?.sequenceCounts || {});
      mergeScoreBuckets(mergedScoreBuckets, analysis.scoreBuckets || {});
      for (const [key, count] of Object.entries(analysis.movePayment || {})) {
        if (Object.hasOwn(mergedMovePayment, key)) mergedMovePayment[key] += numeric(count);
      }
      for (const bug of analysis.bugs || []) increment(mergedBugCounts, bug.key, bug.count);
      if (analysis.winner) {
        increment(winnerCounts, analysis.winner.playerId || analysis.winner.playerLabel);
        totalWinnerScore += numeric(analysis.winner.finalScore);
      }
      const profiles = analysis.playerProfiles || [];
      if (profiles.length) {
        allProfiles.push(...profiles);
        winnerProfiles.push(profiles[0]);
        nonWinnerProfiles.push(...profiles.slice(1));
      }
    }

    const gameCount = validAnalyses.length;
    const turnActionCount = Object.values(mergedActionCounts).reduce((total, count) => total + count, 0);
    const actionCategoryRatios = {};
    for (const [category, count] of Object.entries(mergedActionCategoryCounts)) {
      actionCategoryRatios[category] = turnActionCount ? roundRatio(count / turnActionCount) : 0;
    }
    const topMissedCandidates = buildTopMissedCandidates(mergedCandidateStats);
    const averageWinnerProfile = averageProfileMetrics(winnerProfiles);
    const averageNonWinnerProfile = averageProfileMetrics(nonWinnerProfiles);
    const winnerProfileDeltas = diffProfileMetrics(averageWinnerProfile, averageNonWinnerProfile);
    const paceSummary = buildPaceSummary(allProfiles);
    const roundPaceSummary = buildRoundPaceSummary(allProfiles);
    const lowEngineThroughputSamples = buildLowEngineThroughputSamples(allProfiles);
    const highScoreNearMissSamples = sortHighScoreNearMissSamples(
      mergedHighScoreNearMissSamples,
      options.highScoreNearMissLimit ?? 12,
    );
    const d1TechBalanceBottleneckSamples = sortD1TechBalanceBottleneckSamples(
      mergedD1TechBalanceBottleneckSamples,
      options.d1TechBalanceBottleneckLimit ?? 12,
    );
    const summaryForRecommendations = {
      turnActionCount,
      actionCategoryRatios,
      candidateStats: mergedCandidateStats,
      candidateScoreStats: finalizeCandidateScoreStats(mergedCandidateScoreStats),
      topScoreGaps: buildTopScoreGaps(mergedCandidateScoreStats),
      opportunities: mergedOpportunities,
      passOpportunitySamples: mergedPassOpportunitySamples,
      highScoreNearMissSamples,
      d1TechBalanceBottleneckSamples,
      resourceLockMainUnlockSamples: sortResourceLockMainUnlockSamples(mergedResourceLockMainUnlockSamples),
      quickBeforePassNoMainSamples: mergedQuickBeforePassNoMainSamples,
      preNoMainPassResourceDrainSamples: mergedPreNoMainPassResourceDrainSamples,
      postPassQuickNoMainSamples: mergedPostPassQuickNoMainSamples,
      scoreOpportunities: {
        selectedBelowBest: mergedScoreOpportunities.selectedBelowBest,
        totalGap: roundRatio(mergedScoreOpportunities.totalGap),
        maxGap: roundRatio(mergedScoreOpportunities.maxGap),
        averageGap: mergedScoreOpportunities.selectedBelowBest
          ? roundRatio(mergedScoreOpportunities.totalGap / mergedScoreOpportunities.selectedBelowBest)
          : 0,
      },
      movePayment: mergedMovePayment,
      bugs: rankCounts(mergedBugCounts),
      winnerProfileDeltas,
      lowEngineThroughputSamples,
      lowRoundActionTailSamples: sortLowRoundActionTailSamples(mergedLowRoundActionTailSamples),
    };
    const sequenceWindowTurns = normalizeSequenceWindowTurns(
      options.sequenceWindowTurns
      ?? validAnalyses.find((analysis) => analysis?.sequenceWindowTurns != null)?.sequenceWindowTurns
      ?? DEFAULT_SEQUENCE_WINDOW_TURNS,
    );
    const actionSequences = summarizeSequenceCounts(mergedSequenceCounts, sequenceWindowTurns);
    const summary = {
      gameCount,
      completedGames,
      blockedGames,
      completionRate: gameCount ? roundRatio(completedGames / gameCount) : 0,
      averageSteps: gameCount ? roundRatio(totalSteps / gameCount) : 0,
      averageWinnerScore: gameCount ? roundRatio(totalWinnerScore / gameCount) : 0,
      turnActionCount,
      actionCounts: mergedActionCounts,
      actionCategoryCounts: mergedActionCategoryCounts,
      actionCategoryRatios,
      typeCounts: mergedTypeCounts,
      candidateStats: mergedCandidateStats,
      candidateScoreStats: finalizeCandidateScoreStats(mergedCandidateScoreStats),
      topScoreGaps: buildTopScoreGaps(mergedCandidateScoreStats),
      topMissedCandidates,
      opportunities: mergedOpportunities,
      passOpportunitySamples: mergedPassOpportunitySamples,
      passResourceLockSamples: mergedPassResourceLockSamples,
      openingPlanNearMissSamples: sortOpeningPlanNearMissSamples(mergedOpeningPlanNearMissSamples),
      openingPlanConversionSamples: sortOpeningPlanConversionSamples(mergedOpeningPlanConversionSamples),
      passReserveResourcePressureMissSamples: sortPassReserveResourcePressureMissSamples(
        mergedPassReserveResourcePressureMissSamples,
      ),
      earlyPassNoMainSamples: sortEarlyPassNoMainSamples(mergedEarlyPassNoMainSamples),
      resourceLockMainUnlockSamples: sortResourceLockMainUnlockSamples(mergedResourceLockMainUnlockSamples),
      earlyPassNoMainReasonCounts: mergedEarlyPassNoMainReasonCounts,
      quickBeforePassNoMainSamples: sortEarlyPassNoMainSamples(mergedQuickBeforePassNoMainSamples),
      preNoMainPassResourceDrainSamples: sortPreNoMainPassResourceDrainSamples(mergedPreNoMainPassResourceDrainSamples),
      postPassQuickNoMainSamples: sortEarlyPassNoMainSamples(mergedPostPassQuickNoMainSamples),
      postPassQuickSamples: [...mergedPostPassQuickSamples].sort((left, right) => (
        numeric(left.finalScore) - numeric(right.finalScore)
        || numeric(left.roundNumber) - numeric(right.roundNumber)
        || numeric(left.rawTurnNumber) - numeric(right.rawTurnNumber)
      )),
      finalLowHandPassRecoverySamples: mergedFinalLowHandPassRecoverySamples,
      finalPublicRefillShortfallSamples: mergedFinalPublicRefillShortfallSamples,
      negativeCardCornerGraphLiftSamples: mergedNegativeCardCornerGraphLiftSamples,
      endTurnMoveOpportunitySamples: mergedEndTurnMoveOpportunitySamples,
      researchTechCompoundCardSamples: mergedResearchTechCompoundCardSamples,
      playCardNearMissSamples: sortPlayCardNearMissSamples(mergedPlayCardNearMissSamples),
      b2ScanNearMissSamples: sortB2ScanNearMissSamples(mergedB2ScanNearMissSamples),
      b2TradeNearMissSamples: sortB2TradeNearMissSamples(mergedB2TradeNearMissSamples),
      mainUnlockLowConcretePlaySamples: mergedMainUnlockLowConcretePlaySamples,
      nonPositivePublicRefillSamples: mergedNonPositivePublicRefillSamples,
      highHandDrainEnergyTradeSamples: mergedHighHandDrainEnergyTradeSamples,
      lastCardPreserveEnergyMoveSamples: mergedLastCardPreserveEnergyMoveSamples,
      negativeThirdFinalMarkSamples: mergedNegativeThirdFinalMarkSamples,
      scoreOpportunities: {
        selectedBelowBest: mergedScoreOpportunities.selectedBelowBest,
        totalGap: roundRatio(mergedScoreOpportunities.totalGap),
        maxGap: roundRatio(mergedScoreOpportunities.maxGap),
        averageGap: mergedScoreOpportunities.selectedBelowBest
          ? roundRatio(mergedScoreOpportunities.totalGap / mergedScoreOpportunities.selectedBelowBest)
          : 0,
      },
      movePayment: mergedMovePayment,
      bugCounts: mergedBugCounts,
      routeTargetCounts: mergedRouteTargets,
      moveFollowupCounts: mergedMoveFollowups,
      turnPlanCounts: mergedTurnPlans,
      turnPlanTypeCounts: mergedTurnPlanTypes,
      turnPlanActionCounts: mergedTurnPlanActions,
      finalScoreMarkCounts: mergedFinalScoreMarks,
      finalScoreFormulaCounts: mergedFinalScoreFormulas,
      actionSequences,
      scoreBuckets: finalizeScoreBuckets(mergedScoreBuckets),
      winnerCounts,
      paceSummary,
      roundPaceSummary,
      lowRoundPaceSamples: roundPaceSummary.lowRoundPaceSamples,
      lowRoundActionTailSamples: sortLowRoundActionTailSamples(mergedLowRoundActionTailSamples),
      lowEngineThroughputSamples,
      highScoreNearMissSamples,
      lowPlayerCandidateStats: mergedLowPlayerCandidateStats,
      lowUnplayedCardSamples: mergedLowUnplayedCardSamples,
      d1TechBalanceBottleneckSamples,
      averageWinnerProfile,
      averageNonWinnerProfile,
      winnerProfileDeltas,
      topActions: rankCounts(mergedActionCounts),
      routeTargets: rankCounts(mergedRouteTargets),
      moveFollowups: rankCounts(mergedMoveFollowups),
      turnPlans: rankCounts(mergedTurnPlans),
      turnPlanTypes: rankCounts(mergedTurnPlanTypes),
      turnPlanActions: rankCounts(mergedTurnPlanActions),
      finalScoreMarks: rankCounts(mergedFinalScoreMarks),
      finalScoreFormulas: rankCounts(mergedFinalScoreFormulas),
      winnerTopSequences: actionSequences.winnerTopSequences,
      nonWinnerTopSequences: actionSequences.nonWinnerTopSequences,
      winnerDeltaSequences: actionSequences.winnerDeltaSequences,
      mainActionTopSequences: actionSequences.mainActionTopSequences,
      globalTopSequences: actionSequences.globalTopSequences,
      topBugs: rankCounts(mergedBugCounts),
      recommendations: buildRecommendations(summaryForRecommendations),
    };
    summary.strategyTuning = deriveStrategyTuning(summary);
    return summary;
  }

  function summarizeBattleReports(reports = [], options = {}) {
    return summarizeBattleAnalyses((reports || []).map((report) => analyzeBattleReport(report, options)), options);
  }

  return Object.freeze({
    DEFAULT_SEQUENCE_WINDOW_TURNS,
    DEFAULT_STRATEGY_WEIGHTS,
    analyzeBattleReport,
    deriveStrategyTuning,
    compareStrategyBatchResults,
    normalizeStrategyWeights,
    summarizeStrategyTuningHistory,
    summarizeBattleAnalyses,
    summarizeBattleReports,
  });
});
