(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppEffectSessionHost = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...clone(details) };
  }

  function requireFunction(source, key, owner) {
    if (typeof source?.[key] !== "function") {
      throw new TypeError(`${owner} 缺少 ${key}()`);
    }
    return source[key].bind(source);
  }

  function normalizeFlow(flow, family) {
    if (!flow || typeof flow !== "object") {
      throw new TypeError(`Effect Session browser host 缺少 ${family} flow`);
    }
    return Object.freeze({
      dispatch: requireFunction(flow, "dispatch", `${family} flow`),
      inspect: requireFunction(flow, "inspect", `${family} flow`),
      observe: requireFunction(flow, "observe", `${family} flow`),
      advance: requireFunction(flow, "advance", `${family} flow`),
      drain: requireFunction(flow, "drain", `${family} flow`),
      resolveDecision: requireFunction(flow, "resolveDecision", `${family} flow`),
      abort: requireFunction(flow, "abort", `${family} flow`),
      interrupt: typeof flow.interrupt === "function" ? flow.interrupt.bind(flow) : null,
    });
  }

  function choiceIdentity(choice) {
    const identity = choice?.actionId
      ?? choice?.choiceId
      ?? choice?.id
      ?? choice?.tileId
      ?? choice?.targetId
      ?? choice?.value;
    return identity == null ? null : String(identity);
  }

  function createBrowserEffectSessionHost(options = {}) {
    const actionRegistry = options.actionRegistry;
    if (!actionRegistry?.enumerate || !actionRegistry?.validate) {
      throw new TypeError("Effect Session browser host 缺少 Standard Action registry");
    }
    const stateStore = options.stateStore;
    const getSnapshot = requireFunction(stateStore, "getSnapshot", "Effect Session state store");
    const flowOwnsCommit = options.flowOwnsCommit === true;
    const compareAndCommit = flowOwnsCommit
      ? null
      : requireFunction(stateStore, "compareAndCommit", "Effect Session state store");
    const renderProjection = typeof options.renderProjection === "function"
      ? options.renderProjection
      : () => undefined;
    const projectCommittedState = typeof options.projectCommittedState === "function"
      ? options.projectCommittedState
      : (state) => clone(state);
    const onStableResult = typeof options.onStableResult === "function"
      ? options.onStableResult
      : () => undefined;
    const flows = new Map(Object.entries(options.flows || {}).map(([family, flow]) => (
      [family, normalizeFlow(flow, family)]
    )));
    const autoDrain = options.autoDrain !== false;
    let active = null;
    let stableResult = null;
    let lastRenderFailure = null;
    let unsubscribeCommit = null;

    function getCommittedState() {
      const snapshot = getSnapshot();
      const state = snapshot?.meta?.schemaVersion ? snapshot : snapshot?.state;
      if (!state) throw new TypeError("Effect Session state store snapshot 缺少 committed state");
      return clone(state);
    }

    function render() {
      const projection = active
        ? active.flow.observe(active.session, options.viewer ?? null)
        : { phase: "idle", state: projectCommittedState(getCommittedState(), options.viewer ?? null) };
      try {
        renderProjection(clone(projection), inspect());
        lastRenderFailure = null;
      } catch (error) {
        lastRenderFailure = {
          code: "EFFECT_HOST_RENDER_FAILED",
          message: error?.message || "浏览器渲染失败",
        };
      }
      return clone(projection);
    }

    function publishStableResult(result) {
      stableResult = clone(result);
      try {
        onStableResult(clone(stableResult));
      } catch (_error) {
        // 稳定结果通知是宿主服务；失败不能反向改变规则 session。
      }
      return clone(stableResult);
    }

    function settleTerminal() {
      if (!active || !TERMINAL_PHASES.has(active.session.phase)) return null;
      const { family, session } = active;
      const sessionSnapshot = active.flow.inspect(session);
      if (session.phase === "completed") {
        const committed = flowOwnsCommit
          ? { ok: true, snapshot: getCommittedState() }
          : compareAndCommit(session.baseVersion, clone(session.committedState), {
            sessionId: session.sessionId,
            journal: clone(session.journal),
          });
        if (!committed?.ok) {
          const failedCommit = fail(
            committed?.code || "EFFECT_HOST_COMMIT_FAILED",
            committed?.message || "浏览器宿主原子提交失败",
            { family, session: sessionSnapshot },
          );
          active = null;
          render();
          return publishStableResult(failedCommit);
        }
        const completed = {
          ok: true,
          phase: "completed",
          family,
          committedState: clone(session.committedState),
          journal: clone(session.journal),
        };
        active = null;
        render();
        return publishStableResult(completed);
      }
      const failed = fail(
        session.failure?.code || "EFFECT_SESSION_TERMINATED",
        session.failure?.message || "Effect Session 未完成",
        {
          phase: session.phase,
          family,
          workingState: clone(session.workingState),
          irreversibleBarrier: clone(session.irreversibleBarrier),
          journal: clone(session.journal),
        },
      );
      active = null;
      render();
      return publishStableResult(failed);
    }

    function afterRuntimeCall(result, shouldDrain) {
      if (!result?.ok) {
        render();
        return settleTerminal() || clone(result);
      }
      if (active && shouldDrain && !TERMINAL_PHASES.has(active.session.phase)) {
        const drained = active.flow.drain(active.session);
        if (!drained?.ok) {
          render();
          return settleTerminal() || clone(drained);
        }
      }
      render();
      return settleTerminal() || { ok: true, snapshot: inspect() };
    }

    function enumerateActions(request = {}) {
      const state = active ? clone(active.session.workingState) : getCommittedState();
      return clone(actionRegistry.enumerate(state, clone(request)) || []);
    }

    function dispatchAction(action, dispatchOptions = {}) {
      if (active) return fail("EFFECT_HOST_SESSION_ACTIVE", "已有 Effect Session 正在执行");
      const state = getCommittedState();
      const validation = actionRegistry.validate(state, clone(action));
      if (!validation?.ok) return clone(validation);
      const flow = flows.get(action.family);
      if (!flow) {
        return fail("EFFECT_HOST_FAMILY_UNMIGRATED", `浏览器宿主未迁移 action family: ${action.family}`);
      }
      const dispatched = flow.dispatch(state, clone(action), clone(dispatchOptions.meta || {}));
      if (!dispatched?.ok) return clone(dispatched);
      active = { family: action.family, flow, session: dispatched.session };
      stableResult = null;
      return afterRuntimeCall(dispatched, dispatchOptions.autoDrain ?? autoDrain);
    }

    function submitActionById(actionId, dispatchOptions = {}) {
      const inferredFamily = typeof actionId === "string" ? actionId.split(":", 1)[0] : null;
      const request = dispatchOptions.request || (inferredFamily ? { family: inferredFamily } : {});
      const action = enumerateActions(request)
        .find((candidate) => candidate.actionId === actionId);
      return action
        ? dispatchAction(action, dispatchOptions)
        : fail("EFFECT_HOST_ACTION_NOT_LEGAL", "actionId 不在当前合法 Standard Action 中", { actionId });
    }

    function resolveDecision(submission, resolveOptions = {}) {
      if (!active) return fail("EFFECT_HOST_SESSION_REQUIRED", "当前没有等待输入的 Effect Session");
      const result = active.flow.resolveDecision(active.session, clone(submission));
      return afterRuntimeCall(result, resolveOptions.autoDrain ?? autoDrain);
    }

    function submitDecisionChoice(decisionId, decisionVersion, choiceId, resolveOptions = {}) {
      if (!active) return fail("EFFECT_HOST_SESSION_REQUIRED", "当前没有等待输入的 Effect Session");
      const decision = active.flow.inspect(active.session).decision;
      if (!decision || decision.decisionId !== decisionId || decision.decisionVersion !== decisionVersion) {
        return fail("EFFECT_HOST_DECISION_STALE", "DOM decision identity 已过期", { decision: clone(decision) });
      }
      const choice = decision.choices.find((candidate) => choiceIdentity(candidate) === String(choiceId));
      if (!choice) return fail("EFFECT_HOST_CHOICE_NOT_LEGAL", "choiceId 不在当前合法项中", { choiceId });
      return resolveDecision({ decisionId, decisionVersion, choice }, resolveOptions);
    }

    function dispatchQuickAction(action, interruptOptions = {}) {
      if (!active) return fail("EFFECT_HOST_SESSION_REQUIRED", "Quick Action 需要活跃 Effect Session");
      if (!active.flow.interrupt) {
        return fail("EFFECT_HOST_QUICK_UNSUPPORTED", `${active.family} flow 未注册 Quick Action interrupt`);
      }
      const result = active.flow.interrupt(active.session, clone(action), clone(interruptOptions.runtime || {}));
      return afterRuntimeCall(result, interruptOptions.autoDrain ?? autoDrain);
    }

    function advance() {
      if (!active) return fail("EFFECT_HOST_SESSION_REQUIRED", "当前没有可推进的 Effect Session");
      return afterRuntimeCall(active.flow.advance(active.session), false);
    }

    function drain() {
      if (!active) return fail("EFFECT_HOST_SESSION_REQUIRED", "当前没有可推进的 Effect Session");
      return afterRuntimeCall(active.flow.drain(active.session), false);
    }

    function abort(reason = {}) {
      if (!active) return fail("EFFECT_HOST_SESSION_REQUIRED", "当前没有可中止的 Effect Session");
      return afterRuntimeCall(active.flow.abort(active.session, clone(reason)), false);
    }

    function inspect() {
      const session = active ? active.flow.inspect(active.session) : null;
      return clone({
        phase: session?.phase || "idle",
        family: active?.family || null,
        session,
        stableResult,
        renderFailure: lastRenderFailure,
      });
    }

    if (options.subscribeToCommits !== false && typeof stateStore.subscribe === "function") {
      unsubscribeCommit = stateStore.subscribe(() => {
        if (!active) render();
      });
    }

    return Object.freeze({
      enumerateActions,
      dispatchAction,
      submitActionById,
      resolveDecision,
      submitDecisionChoice,
      dispatchQuickAction,
      advance,
      drain,
      abort,
      inspect,
      render,
      dispose() {
        unsubscribeCommit?.();
        unsubscribeCommit = null;
      },
    });
  }

  function createBrowserEffectInputAdapter(host, options = {}) {
    if (!host?.submitActionById || !host?.submitDecisionChoice || !host?.dispatchQuickAction) {
      throw new TypeError("Browser Effect input adapter 缺少 host API");
    }
    const onViewIntent = typeof options.onViewIntent === "function" ? options.onViewIntent : () => undefined;

    function handleIntent(intent = {}) {
      if (intent.kind === "standard_action") return host.submitActionById(intent.actionId, intent.options);
      if (intent.kind === "standard_decision") {
        return host.submitDecisionChoice(
          intent.decisionId,
          Number(intent.decisionVersion),
          intent.choiceId,
          intent.options,
        );
      }
      if (intent.kind === "quick_action") return host.dispatchQuickAction(clone(intent.action), intent.options);
      if (intent.kind === "view") {
        onViewIntent(clone(intent));
        return { ok: true, viewOnly: true };
      }
      return fail("EFFECT_HOST_INPUT_UNKNOWN", `未知 browser intent: ${intent.kind || "<missing>"}`);
    }

    function handleDomEvent(event) {
      const target = event?.target?.closest?.("[data-seti-input]");
      if (!target) return { ok: true, ignored: true };
      const inputKind = target.dataset.setiInput;
      if (inputKind === "action") {
        return handleIntent({ kind: "standard_action", actionId: target.dataset.actionId });
      }
      if (inputKind === "decision") {
        return handleIntent({
          kind: "standard_decision",
          decisionId: target.dataset.decisionId,
          decisionVersion: target.dataset.decisionVersion,
          choiceId: target.dataset.choiceId,
        });
      }
      if (inputKind === "view") {
        return handleIntent({ kind: "view", name: target.dataset.viewIntent || null });
      }
      return fail("EFFECT_HOST_DOM_INPUT_UNKNOWN", `未知 data-seti-input: ${inputKind || "<missing>"}`);
    }

    function bind(rootNode) {
      if (!rootNode?.addEventListener || !rootNode?.removeEventListener) {
        throw new TypeError("Browser Effect input adapter 需要 EventTarget root");
      }
      rootNode.addEventListener("click", handleDomEvent);
      return () => rootNode.removeEventListener("click", handleDomEvent);
    }

    return Object.freeze({ handleIntent, handleDomEvent, bind });
  }

  return Object.freeze({
    createBrowserEffectSessionHost,
    createBrowserEffectInputAdapter,
  });
});
