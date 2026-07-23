(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  if (!standardAction && typeof require === "function") {
    standardAction = require("../game/actions/standard-action");
  }
  const api = factory(standardAction);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiConditionalActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (standardAction) {
  "use strict";

  if (!standardAction?.CONDITIONAL_FAMILIES) {
    throw new Error("SetiStandardAction is required before SetiConditionalActionExecutor");
  }

  const DECISION_SCHEMA_VERSION = "seti-conditional-decision-v1";
  const ACTION_FAMILIES = Object.freeze([...standardAction.CONDITIONAL_FAMILIES]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...clone(details) };
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function stableHash(value) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function replaceMutable(target, source) {
    for (const key of Reflect.ownKeys(target || {})) delete target[key];
    Object.assign(target, clone(source || {}));
  }

  function restoreWorkingRoot(workingRoot, snapshot) {
    for (const key of Reflect.ownKeys(workingRoot)) {
      if (!Object.hasOwn(snapshot, key)) delete workingRoot[key];
    }
    for (const key of Reflect.ownKeys(snapshot)) {
      const current = workingRoot[key];
      const previous = snapshot[key];
      if (current && previous && typeof current === "object" && typeof previous === "object"
        && !Array.isArray(current) && !Array.isArray(previous)) {
        replaceMutable(current, previous);
      } else {
        workingRoot[key] = clone(previous);
      }
    }
  }

  function getVersions(workingRoot) {
    return {
      stateVersion: workingRoot?.meta?.stateVersion ?? workingRoot?.stateVersion ?? 0,
      decisionVersion: workingRoot?.match?.decisionVersion ?? workingRoot?.decisionVersion ?? 0,
    };
  }

  function normalizeRawDecision(workingRoot, rawDecision) {
    const ownerId = rawDecision?.ownerId || rawDecision?.actorPlayer?.id || null;
    const rawChoices = Array.isArray(rawDecision?.choices)
      ? rawDecision.choices
      : (Array.isArray(rawDecision?.candidates) ? rawDecision.candidates : []);
    if (!ownerId || !rawChoices.length) return null;
    const versions = getVersions(workingRoot);
    const choices = rawChoices.map((choice, index) => {
      const family = String(choice?.family || "");
      if (!ACTION_FAMILIES.includes(family)) {
        throw new TypeError(`未迁移 conditional family: ${family || "<missing>"}`);
      }
      const target = clone(choice.target || null);
      const choiceId = String(target?.choiceId ?? choice.choiceId ?? index);
      const handlerId = String(choice?.followup?.handlerId || target?.kind || "");
      if (!handlerId) throw new TypeError(`${family}/${choiceId} 缺少显式 followup handlerId`);
      const payload = Object.fromEntries(Object.entries(choice).filter(([key]) => (
        !["id", "family", "label", "target", "standardAction", "followup"].includes(key)
      )));
      return Object.freeze({
        choiceId,
        family,
        label: choice.label || family,
        target,
        payload: clone(payload),
        followup: Object.freeze({ kind: "choice_handler", handlerId }),
      });
    });
    const identity = {
      ownerId,
      decisionVersion: versions.decisionVersion,
      choices: choices.map((choice) => ({
        choiceId: choice.choiceId,
        family: choice.family,
        target: choice.target,
        payload: choice.payload,
        followup: choice.followup,
      })),
    };
    return Object.freeze({
      schemaVersion: DECISION_SCHEMA_VERSION,
      decisionId: `conditional:${stableHash(identity)}`,
      ownerId,
      stateVersion: versions.stateVersion,
      decisionVersion: versions.decisionVersion,
      choices: Object.freeze(choices),
      followup: Object.freeze({
        kind: "choice_handler",
        handlerIds: Object.freeze([...new Set(choices.map((choice) => choice.followup.handlerId))]),
      }),
    });
  }

  function createConditionalActionExecutor(options = {}) {
    const domain = options.domain;
    if (typeof domain?.describeDecision !== "function") {
      throw new TypeError("Conditional executor 缺少 domain.describeDecision(workingRoot)");
    }
    if (typeof domain?.executeChoice !== "function") {
      throw new TypeError("Conditional executor 缺少 domain.executeChoice(workingRoot, choice, decision)");
    }

    function inspect(workingRoot) {
      try {
        return normalizeRawDecision(workingRoot, domain.describeDecision(workingRoot));
      } catch (error) {
        return fail("CONDITIONAL_DECISION_INVALID", error?.message || "Conditional Decision 定义无效");
      }
    }

    function getOptions(workingRoot, family) {
      if (!ACTION_FAMILIES.includes(family)) {
        return fail("CONDITIONAL_FAMILY_INVALID", `Conditional executor 不接受 family: ${family || "<missing>"}`);
      }
      const decision = inspect(workingRoot);
      if (!decision || decision.ok === false) {
        return decision?.ok === false
          ? decision
          : fail("STANDARD_ACTION_NOT_LEGAL", `${family} 当前没有活动 Decision`);
      }
      const choices = decision.choices.filter((choice) => choice.family === family).map((choice) => ({
        target: clone(choice.target),
        payload: clone(choice.payload),
        decision: {
          decisionId: decision.decisionId,
          decisionOwnerId: decision.ownerId,
          decisionStateVersion: decision.stateVersion,
          domainDecisionVersion: decision.decisionVersion,
          followup: clone(choice.followup),
        },
        label: choice.label,
      }));
      return choices.length
        ? { ok: true, decision: clone(decision), choices }
        : fail("STANDARD_ACTION_NOT_LEGAL", `${family} 当前没有合法候选`);
    }

    function validate(workingRoot, descriptor) {
      if (!ACTION_FAMILIES.includes(descriptor?.family)) {
        return fail("CONDITIONAL_FAMILY_INVALID", `Conditional executor 不接受 family: ${descriptor?.family || "<missing>"}`);
      }
      const decision = inspect(workingRoot);
      if (!decision || decision.ok === false) {
        return decision?.ok === false
          ? decision
          : fail("CONDITIONAL_DECISION_REQUIRED", "当前没有活动 Conditional Decision");
      }
      if (descriptor.actorId !== decision.ownerId) {
        return fail("CONDITIONAL_DECISION_OWNER_MISMATCH", "descriptor actor 不是当前 Decision owner", {
          ownerId: decision.ownerId,
        });
      }
      if (descriptor.decision?.domainDecisionVersion !== decision.decisionVersion
        || descriptor.decision?.decisionId !== decision.decisionId) {
        return fail("CONDITIONAL_DECISION_STALE", "Conditional Decision descriptor 已过期", {
          decisionId: decision.decisionId,
          stateVersion: decision.stateVersion,
          decisionVersion: decision.decisionVersion,
        });
      }
      const choice = decision.choices.find((candidate) => (
        candidate.family === descriptor.family
        && stableSerialize(candidate.target) === stableSerialize(descriptor.target || null)
        && candidate.followup.handlerId === descriptor.decision?.followup?.handlerId
      ));
      return choice
        ? { ok: true, decision, choice }
        : fail("CONDITIONAL_CHOICE_NOT_LEGAL", "choice 不在当前 Decision choices 中");
    }

    function execute(workingRoot, descriptor, executeOptions = {}) {
      if (typeof executeOptions.validate === "function") {
        const actionValidation = executeOptions.validate(workingRoot, clone(descriptor));
        if (!actionValidation?.ok) return actionValidation;
      }
      const validation = validate(workingRoot, descriptor);
      if (!validation.ok) return validation;
      const before = clone(workingRoot);
      try {
        const result = domain.executeChoice(
          workingRoot,
          clone(validation.choice),
          clone(validation.decision),
        );
        if (!result?.ok) {
          restoreWorkingRoot(workingRoot, before);
          return result?.ok === false
            ? result
            : fail("CONDITIONAL_CHOICE_EXECUTION_FAILED", "Conditional choice 未返回成功结果");
        }
        return {
          ...result,
          action: clone(descriptor),
          decision: clone(validation.decision),
          followup: clone(validation.choice.followup),
        };
      } catch (error) {
        restoreWorkingRoot(workingRoot, before);
        return fail("CONDITIONAL_CHOICE_EXECUTOR_THROWN", error?.message || "Conditional choice 执行异常");
      }
    }

    function executeEffectChoice(workingRoot, rawChoice) {
      if (!workingRoot || typeof workingRoot !== "object") {
        return fail("CONDITIONAL_WORKING_ROOT_REQUIRED", "Effect Session choice 缺少 working root");
      }
      const descriptor = rawChoice?.standardAction || rawChoice;
      const family = String(rawChoice?.family || descriptor?.family || "");
      if (!ACTION_FAMILIES.includes(family)) {
        return fail("CONDITIONAL_FAMILY_INVALID", `Effect Session 不接受 conditional family: ${family || "<missing>"}`);
      }
      const target = clone(rawChoice?.target || descriptor?.target || null);
      const handlerId = String(
        descriptor?.decision?.followup?.handlerId
        || rawChoice?.followup?.handlerId
        || target?.kind
        || "",
      );
      if (!handlerId) return fail("CONDITIONAL_FOLLOWUP_UNMIGRATED", "Effect Session choice 缺少 followup handlerId");
      const payload = Object.fromEntries(Object.entries(rawChoice || {}).filter(([key]) => (
        !["id", "family", "label", "target", "standardAction", "followup"].includes(key)
      )));
      const choice = {
        choiceId: String(target?.choiceId ?? rawChoice?.choiceId ?? "0"),
        family,
        label: rawChoice?.label || descriptor?.summary || family,
        target,
        payload: clone(payload),
        followup: { kind: "choice_handler", handlerId },
      };
      const decision = {
        decisionId: descriptor?.decision?.decisionId || "effect-session-owned",
        ownerId: descriptor?.actorId || null,
        choices: [choice],
      };
      try {
        const result = domain.executeChoice(workingRoot, clone(choice), clone(decision));
        const cardSelection = rawChoice?.cardSelection || rawChoice?.payload?.cardSelection || null;
        if (
          result?.ok
          && cardSelection
          && options.shouldRestageCardSelection?.(workingRoot, cardSelection)
        ) {
          options.cardSelectionDecisionOwner.open(workingRoot, cardSelection);
        }
        return result;
      } catch (error) {
        return fail("CONDITIONAL_CHOICE_EXECUTOR_THROWN", error?.message || "Effect Session choice 执行异常");
      }
    }

    return Object.freeze({ actionFamilies: ACTION_FAMILIES, inspect, getOptions, validate, execute, executeEffectChoice });
  }

  function createConditionalCompositionRuntime(context = {}) {
    function createConditionalActionProvider(family) {
      return Object.freeze({
        label: family,
        getOptions(actionContext) {
          return context.executor.getOptions(actionContext.workingRoot, family);
        },
        canExecute(actionContext, descriptor) {
          return context.executor.validate(actionContext.workingRoot, descriptor);
        },
        execute() {
          return fail(
            "CONDITIONAL_ACTION_EXECUTOR_REQUIRED",
            "Conditional Standard Action 只允许由 working-root executor 执行",
          );
        },
      });
    }

    function enumerateConditionalActionsForRoot(workingRoot) {
      context.syncFinalScorePendingMarks(workingRoot);
      const decision = context.executor.inspect(workingRoot);
      const actorPlayer = decision?.ownerId
        ? (workingRoot.playerState.players || []).find((player) => player.id === decision.ownerId) || null
        : null;
      if (!actorPlayer?.id || !decision?.choices?.length) return { actorPlayer, candidates: [] };
      const listing = context.dispatchAction(
        { kind: "standard_enumerate", payload: { actorId: actorPlayer.id } },
        null,
        context.createActionContext(workingRoot),
      );
      const candidates = (listing.candidates || [])
        .filter((standardAction) => standardAction.phase === "conditional")
        .map((standardAction) => ({
          ...clone(standardAction.payload || {}),
          id: "conditionalChoice",
          family: standardAction.family,
          label: standardAction.summary,
          target: clone(standardAction.target || null),
          standardAction,
        }));
      return { actorPlayer, candidates };
    }

    function advanceDeterministicStateForRoot(workingRoot) {
      return null;
    }

    function executeCurrentActionEffectForRoot(workingRoot) {
      const effect = context.getCurrentActionEffect(workingRoot);
      if (!effect || effect.status !== "active") {
        return fail("ACTION_EFFECT_NOT_ACTIVE", "没有可直接推进的活动效果");
      }
      return context.executeActionEffect(workingRoot, effect);
    }

    return Object.freeze({
      createConditionalActionProvider,
      enumerateConditionalActionsForRoot,
      advanceDeterministicStateForRoot,
      executeCurrentActionEffectForRoot,
    });
  }

  function createStandardActionContinuation(context = {}) {
    const alienDraftConsumers = Object.freeze({
      "chong-fossil-choice": "takeChongFossilDecisionDraft",
      "amiba-symbol-choice": "takeAmibaSymbolDecisionDraft",
      "runezu-symbol-branch": "takeRunezuSymbolBranchDecisionDraft",
      "runezu-face-symbol-choice": "takeRunezuFaceSymbolDecisionDraft",
      "runezu-card-gain": "takeRunezuCardGainDecisionDraft",
      "amiba-card-gain": "takeAmibaCardGainDecisionDraft",
      "aomomo-card-gain": "takeAomomoCardGainDecisionDraft",
      "yichangdian-card-gain": "takeYichangdianCardGainDecisionDraft",
      "banrenma-card-gain": "takeBanrenmaCardGainDecisionDraft",
      "chong-card-gain": "takeChongCardGainDecisionDraft",
      "amiba-trace-removal": "takeAmibaTraceRemovalDecisionDraft",
      "jiuzhe-card-play": "takeJiuzheCardPlayDecisionDraft",
      "jiuzhe-card-skip": "takeJiuzheCardPlayDecisionDraft",
      "banrenma-panel-bonus": "takeBanrenmaOpportunityDecisionDraft",
      "banrenma-card-condition": "takeBanrenmaOpportunityDecisionDraft",
    });

    function consumeConditionalDraft(workingRoot, kind) {
      if (kind === "yichangdian-corner-choice") {
        context.getEffectExecutors()?.takeYichangdianCornerAction?.();
      } else {
        const method = alienDraftConsumers[kind];
        if (method) context.getAlienSpeciesRuntime()?.[method]?.();
      }
      if (kind === "probe-sector-selection") delete workingRoot.match.probeSectorScanContinuation;
      if (kind === "probe-location-reward") delete workingRoot.match.probeLocationRewardContinuation;
      if (kind === "sector-scan-target") context.closeScanTargetPickerForRoot(workingRoot);
    }

    function inspect(workingRoot) {
      const conditional = context.enumerateConditionalActionsForRoot(workingRoot);
      const candidates = (conditional.candidates || []).filter((candidate) => candidate?.available !== false);
      if (candidates.length) {
        consumeConditionalDraft(workingRoot, candidates[0]?.target?.kind);
        return {
          ok: true,
          boundary: "conditional_choice",
          decisionType: "conditional_choice",
          actorPlayer: conditional.actorPlayer || null,
          ownerId: conditional.actorPlayer?.id || null,
          family: candidates[0]?.family || null,
          candidates,
        };
      }
      const turnCandidates = context.enumerateTurnActionsForRoot(workingRoot);
      if (turnCandidates.length || workingRoot.turnState.gameEnded) {
        return {
          ok: true,
          boundary: workingRoot.turnState.gameEnded ? "terminal" : "turn_action",
          decisionType: "turn_action",
          actorPlayer: context.getCurrentPlayer(workingRoot.playerState),
          candidates: turnCandidates,
        };
      }
      const currentEffect = context.getCurrentActionEffect(workingRoot);
      return {
        ok: true,
        boundary: "draining",
        decisionType: null,
        candidates: [],
        actionEffectActive: context.isActionEffectFlowActive(workingRoot),
        currentEffect: structuredClone(currentEffect || null),
      };
    }

    function executeDeterministic(workingRoot, boundary) {
      const deterministic = context.advanceDeterministicStateForRoot(workingRoot);
      if (deterministic?.progressed) {
        return {
          ...deterministic,
          ok: deterministic.ok !== false,
          events: [{ type: "standard_action_deterministic_advance" }],
        };
      }
      if (boundary?.actionEffectActive) {
        const effectResult = context.executeCurrentActionEffectForRoot(workingRoot);
        return {
          ...(effectResult || {}),
          ok: effectResult?.ok !== false,
          progressed: effectResult?.ok !== false,
          events: [{
            type: "standard_action_deterministic_effect",
            effectType: boundary.currentEffect?.type || effectResult?.type || null,
            effectId: boundary.currentEffect?.id || effectResult?.effectId || null,
          }],
        };
      }
      return fail(
        "SIMULATION_UNSUPPORTED_PENDING",
        "存在未迁移的 simulation pending，Composition 拒绝 resolver/recover/skip fallback",
      );
    }

    function resolveDecision(workingRoot, choice) {
      return context.executeEffectChoice(workingRoot, choice);
    }

    return Object.freeze({ inspect, executeDeterministic, resolveDecision });
  }

  return Object.freeze({
    DECISION_SCHEMA_VERSION,
    ACTION_FAMILIES,
    createConditionalActionExecutor,
    createConditionalCompositionRuntime,
    createStandardActionContinuation,
  });
});
