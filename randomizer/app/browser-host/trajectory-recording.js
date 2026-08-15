(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiBrowserTrajectoryRecording = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  // 与 self-play 的 buildLegalMask 同形状：每步记录提交时点的完整合法集摘要。
  function buildLegalMask(actions) {
    return (actions || []).map((action, maskIndex) => ({
      maskIndex,
      actionId: action?.actionId ?? action?.choiceId ?? null,
      family: action?.family ?? action?.kind ?? "decision",
      actorPlayerId: action?.actorPlayerId ?? action?.actorId ?? null,
    }));
  }

  // 录制器只读 projection 与标准输入链：所有规则提交仍走 rawDispatch/rawSubmit，
  // 录制失败（观测、reward、枚举异常）一律吞掉，绝不影响对局结果。
  function createTrajectoryRecordingAdapter(options = {}) {
    const {
      createRecorder,
      enumerateActions,
      inspectDecision,
      projectObservation,
      createReward,
      isMachineSeat,
      isTerminal,
      readFinalPlayers,
      onFinalized,
    } = options;
    if (typeof createRecorder !== "function" || typeof enumerateActions !== "function"
      || typeof projectObservation !== "function" || typeof createReward !== "function"
      || typeof isMachineSeat !== "function" || typeof isTerminal !== "function"
      || typeof readFinalPlayers !== "function") {
      throw new TypeError("TrajectoryRecording 需要 createRecorder/enumerateActions/projectObservation/createReward/isMachineSeat/isTerminal/readFinalPlayers ports");
    }

    let recorder = null;
    let sessionBase = 0;
    let finalized = false;

    function active() {
      return recorder != null && !finalized;
    }

    function reset() {
      recorder = createRecorder();
      sessionBase = 0;
      finalized = false;
      return recorder;
    }

    // 每个新 Effect Session 打开时记录当前已确认步数；撤销只能回滚当前 session，
    // 因此对齐目标 = sessionBase + 当前 session 的确认 replay 步数。
    function onSessionOpened() {
      sessionBase = recorder ? recorder.getStepCount() : 0;
    }

    function finishEpisode() {
      if (!recorder || finalized) return null;
      finalized = true;
      const players = (readFinalPlayers() || []).map((player) => ({
        playerId: String(player?.playerId ?? player?.id ?? ""),
        score: Number(player?.score ?? 0),
        finalScore: Number(player?.finalScore ?? player?.score ?? 0),
      }));
      recorder.finishEpisode({
        terminal: true,
        blocked: false,
        players,
      });
      if (typeof onFinalized === "function") {
        try { onFinalized(recorder); } catch (_error) { /* 下载/导出回调异常不影响规则结果 */ }
      }
      return recorder;
    }

    function recordStepFor(input) {
      if (!active()) return;
      recorder.recordStep({
        actorPlayerId: input.actorPlayerId,
        action: input.action,
        reward: input.reward,
        legalMask: input.legalMask,
        terminal: input.terminal,
        ok: true,
        actorKind: isMachineSeat(input.actorPlayerId) ? "machine" : "human",
      });
    }

    function safeProject(seatId) {
      if (seatId == null) return null;
      try { return projectObservation(String(seatId)); } catch (_error) { return null; }
    }

    function safeMask(provider) {
      try { return buildLegalMask(provider()); } catch (_error) { return []; }
    }

    function safeReward(before, after) {
      if (!before || !after) return null;
      try { return createReward(before, after); } catch (_error) { return null; }
    }

    function dispatchAction(action, rawDispatch) {
      if (!active()) return rawDispatch(action);
      const actorId = action?.actorId ?? null;
      const before = safeProject(actorId);
      const legalMask = safeMask(enumerateActions);
      const result = rawDispatch(action);
      if (result?.ok === true) {
        const after = safeProject(actorId);
        const terminal = safeTerminal();
        recordStepFor({
          actorPlayerId: actorId,
          action: describeAction(action),
          reward: safeReward(before, after),
          legalMask,
          terminal,
        });
        if (terminal) finishEpisode();
      }
      return result;
    }

    function submitDecision(submission, rawSubmit) {
      if (!active()) return rawSubmit(submission);
      const decision = safeDecision() || {};
      const ownerId = submission?.ownerId ?? decision.ownerId ?? null;
      const before = safeProject(ownerId);
      const legalMask = safeMask(() => decision.choices || []);
      const result = rawSubmit(submission);
      if (result?.ok === true) {
        const after = safeProject(ownerId);
        const terminal = safeTerminal();
        recordStepFor({
          actorPlayerId: ownerId,
          action: describeDecision(submission, decision),
          reward: safeReward(before, after),
          legalMask,
          terminal,
        });
        if (terminal) finishEpisode();
      }
      return result;
    }

    // 撤销后与当前 session 的确认 replay 对齐：只保留 sessionBase + replay.length 步。
    function reconcile(journalReplayLength) {
      if (!recorder || finalized) return 0;
      const target = sessionBase + Math.max(0, Number(journalReplayLength) || 0);
      return recorder.truncateToStepCount(target);
    }

    function safeDecision() {
      try { return inspectDecision() || null; } catch (_error) { return null; }
    }

    function safeTerminal() {
      try { return isTerminal() === true; } catch (_error) { return false; }
    }

    return Object.freeze({
      reset,
      onSessionOpened,
      dispatchAction,
      submitDecision,
      reconcile,
      getJsonl: () => (recorder ? recorder.getJsonl() : ""),
      getRecords: () => (recorder ? recorder.getRecords() : []),
      getStepCount: () => (recorder ? recorder.getStepCount() : 0),
      isActive: active,
      isFinalized: () => finalized,
      getRecorder: () => recorder,
    });
  }

  function describeAction(action) {
    return {
      schemaVersion: action?.schemaVersion || "seti-standard-action-v1",
      actionId: action?.actionId ?? null,
      family: action?.family ?? null,
      phase: action?.phase ?? null,
      actorId: action?.actorId ?? null,
      stateVersion: action?.stateVersion ?? null,
      decisionVersion: action?.decisionVersion ?? null,
      target: clone(action?.target ?? null),
      payload: clone(action?.payload ?? {}),
      summary: action?.summary ?? action?.family ?? null,
    };
  }

  function describeDecision(submission, decision) {
    const choice = submission?.choice || {};
    return {
      schemaVersion: "seti-standard-action-v1",
      actionId: choice?.actionId ?? choice?.choiceId ?? submission?.decisionId ?? null,
      family: choice?.family ?? decision?.decisionKind ?? "decision",
      phase: "conditional",
      actorId: submission?.ownerId ?? decision?.ownerId ?? null,
      stateVersion: choice?.stateVersion ?? decision?.stateVersion ?? null,
      decisionVersion: submission?.decisionVersion ?? decision?.decisionVersion ?? null,
      decisionId: submission?.decisionId ?? decision?.decisionId ?? null,
      choiceId: choice?.choiceId ?? null,
      target: clone(choice?.target ?? null),
      payload: clone(choice?.payload ?? {}),
      summary: choice?.summary ?? choice?.label ?? choice?.choiceId ?? "decision",
    };
  }

  return Object.freeze({ createTrajectoryRecordingAdapter, buildLegalMask });
});
