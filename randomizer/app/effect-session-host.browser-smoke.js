(function () {
  "use strict";

  const output = document.querySelector("#result");
  const traces = {};

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function state() {
    return {
      version: 1,
      stateVersion: 1,
      decisionVersion: 0,
      actorId: "p1",
      quickKinds: ["boost"],
      value: 0,
      trace: [],
    };
  }

  function store(initial = state()) {
    let committed = structuredClone(initial);
    let commitCount = 0;
    return {
      getSnapshot: () => ({ state: structuredClone(committed) }),
      beginWorkingCopy(baseVersion = committed.version) {
        return baseVersion === committed.version
          ? { ok: true, baseVersion, state: structuredClone(committed) }
          : { ok: false, code: "VERSION_CONFLICT", baseVersion, currentVersion: committed.version };
      },
      compareAndCommit(baseVersion, nextState) {
        if (committed.version !== baseVersion) return { ok: false, code: "VERSION_CONFLICT" };
        committed = structuredClone(nextState);
        committed.version = baseVersion + 1;
        committed.stateVersion = baseVersion + 1;
        commitCount += 1;
        return { ok: true, snapshot: structuredClone(committed) };
      },
      state: () => structuredClone(committed),
      commits: () => commitCount,
    };
  }

  function registry() {
    const result = SetiStandardAction.createRegistry({
      getAuthority: (current) => ({
        actorId: current.actorId,
        stateVersion: current.stateVersion,
        decisionVersion: current.decisionVersion,
      }),
    });
    for (const family of ["research_tech", "scan", "play_card", "quick_trade"]) {
      result.register(SetiStandardAction.createOptionDefinition(family, {
        getOptions: (current) => ({
          ok: true,
          choices: family === "quick_trade"
            ? current.quickKinds.map((kind) => ({ target: { kind } }))
            : [{ target: { id: family } }],
        }),
        canExecute: () => ({ ok: true }),
        execute: () => { throw new Error("legacy execute must stay unreachable"); },
      }));
    }
    return result;
  }

  function flow(family, stateStore, actionRegistry, options = {}) {
    const runtime = SetiEffectSession.createRuntime({
      stateStore,
      projectState: (workingState) => structuredClone(workingState),
    });
    runtime.registerExecutor("browser-smoke-mark", (workingState, effect) => {
      workingState.trace.push(effect.payload.label);
      workingState.value += effect.payload.amount || 0;
      return { ok: true, nextState: workingState };
    });
    runtime.registerExecutor("browser-smoke-decision", {
      getLegalChoices: (_workingState, effect) => effect.payload.choices.map((id) => ({ id })),
      resolveDecision(workingState, effect, choice) {
        workingState.trace.push(`${effect.payload.label}:${choice.id}`);
        workingState.decisionVersion += 1;
        return { ok: true, nextState: workingState };
      },
    });
    runtime.registerExecutor("browser-smoke-fail", () => { throw new Error("fixture failure"); });

    function mark(label, amount = 0) {
      return { type: "browser-smoke-mark", payload: { label, amount } };
    }
    function decision(label, choices, allowQuickActions = false) {
      return {
        type: "browser-smoke-decision",
        kind: "decision",
        ownerId: "p1",
        allowQuickActions,
        payload: { label, choices },
      };
    }
    function effects() {
      if (options.fail) return [mark("before-failure"), { type: "browser-smoke-fail" }];
      if (family === "research_tech") {
        return [mark("rotate"), decision("tech", ["purple1", "blue2"], true), mark("place"), mark("reward", 3)];
      }
      if (family === "scan") {
        return [decision("target", ["nebula-a", "nebula-b"]), mark("scan"), decision("sector", ["yellow", "blue"]), mark("reward"), mark("draw")];
      }
      return [decision("payment", ["energy", "data"]), mark("play"), mark("card-effect"), mark("trigger"), decision("trigger-reward", ["data", "score"])];
    }
    function dispatch(_committedState, action) {
      return runtime.dispatchStandardAction(action, actionRegistry, () => ({
        kind: "action",
        ownerId: action.actorId,
        effects: effects(),
      }));
    }
    runtime.registerExecutor("browser-smoke-quick", (workingState) => ({
      ok: true,
      nextState: { ...workingState, value: workingState.value + 2, trace: [...workingState.trace, "quick:boost"] },
    }));
    const quick = SetiQuickActionSession.createQuickActionCoordinator({
      runtime,
      registry: actionRegistry,
      buildEffectGroup: () => ({ effects: [{ type: "browser-smoke-quick" }] }),
    });
    return {
      dispatch,
      inspect: runtime.inspect,
      observe: runtime.observe,
      advance: runtime.advance,
      drain: runtime.drain,
      resolveDecision: runtime.resolveDecision,
      abort: runtime.abort,
      interrupt: quick.interrupt,
    };
  }

  function harness(family, options = {}) {
    const stateStore = store();
    const actionRegistry = registry();
    const runtimeFlow = flow(family, stateStore, actionRegistry, options);
    const host = SetiAppEffectSessionHost.createBrowserEffectSessionHost({
      stateStore,
      actionRegistry,
      flows: { [family]: runtimeFlow },
      autoDrain: options.autoDrain,
      renderProjection: options.renderPoison ? () => { throw new Error("render poison"); } : () => undefined,
    });
    return { host, stateStore };
  }

  function action(host, family) {
    return host.enumerateActions({ family })[0];
  }

  function choose(host, id) {
    const decision = host.inspect().session.decision;
    return host.submitDecisionChoice(decision.decisionId, decision.decisionVersion, id);
  }

  function run() {
    const research = harness("research_tech");
    research.host.dispatchAction(action(research.host, "research_tech"));
    const beforeQuick = research.host.inspect().session.decision;
    const quickAction = research.host.enumerateActions({ family: "quick_trade" })[0];
    assert(research.host.dispatchQuickAction(quickAction).ok, "quick interrupt failed");
    const afterQuick = research.host.inspect().session.decision;
    assert(afterQuick.decisionVersion !== beforeQuick.decisionVersion, "quick did not stale decision");
    choose(research.host, "purple1");
    traces.research = research.stateStore.state().trace;
    assert(research.stateStore.state().value === 5, "research/quick result mismatch");

    const scan = harness("scan");
    scan.host.dispatchAction(action(scan.host, "scan"));
    choose(scan.host, "nebula-b");
    choose(scan.host, "blue");
    traces.scan = scan.stateStore.state().trace;

    const card = harness("play_card");
    card.host.dispatchAction(action(card.host, "play_card"));
    choose(card.host, "energy");
    choose(card.host, "score");
    traces.card = card.stateStore.state().trace;

    const failed = harness("research_tech", { fail: true, renderPoison: true });
    const failure = failed.host.dispatchAction(action(failed.host, "research_tech"));
    assert(!failure.ok && failure.phase === "aborted", "failure did not recover");
    assert(failed.stateStore.commits() === 0 && failed.stateStore.state().trace.length === 0, "failure polluted committed state");
    traces.failure = failure.phase;

    const automatic = harness("research_tech");
    automatic.host.dispatchAction(action(automatic.host, "research_tech"));
    choose(automatic.host, "blue2");
    const animated = harness("research_tech", { autoDrain: false });
    animated.host.dispatchAction(action(animated.host, "research_tech"));
    while (animated.host.inspect().phase !== "awaiting_input") animated.host.advance();
    choose(animated.host, "blue2");
    while (animated.host.inspect().phase !== "idle") animated.host.advance();
    assert(JSON.stringify(animated.stateStore.state()) === JSON.stringify(automatic.stateStore.state()), "advance/drain mismatch");
    traces.animation = "equivalent";
  }

  try {
    run();
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, traces });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();
