"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const stateStoreApi = require("../game/state/state-store");
const effectRuntimeApi = require("../game/effects/session-runtime");
const researchTechSession = require("../game/effects/research-tech-session");
const { createBrowserRuleComposition, SAVE_SCHEMA_VERSION } = require("./browser-rule-composition");

function createState(value = 0) {
  return {
    meta: {
      schemaVersion: stateStoreApi.SCHEMA_VERSION,
      stateVersion: 0,
      gameId: "browser-composition-test",
      rulesetVersion: "test-v1",
      seed: "fixed",
      rngState: {},
      sequences: {},
    },
    match: { value },
    turn: {},
    players: {},
    solarSystem: {},
    pieces: {},
    planets: {},
    data: {},
    cards: {},
    tech: {},
    aliens: {},
    finalScoring: {},
  };
}

function createRegistry() {
  function descriptor(state, family, target = "default") {
    return {
      schemaVersion: "seti-standard-action-v1",
      family,
      phase: family === "quick_trade" ? "quick" : "main",
      actionId: `${family}:${target}:${state.meta.stateVersion}`,
      actorId: "player-1",
      stateVersion: state.meta.stateVersion,
      decisionVersion: state.match.decisionVersion || 0,
      target: { id: target },
      payload: {},
      summary: family,
    };
  }
  return {
    enumerate(state, request = {}) {
      const families = request.family ? [request.family] : ["launch", "scan", "quick_trade"];
      return families.map((family) => descriptor(state, family));
    },
    validate(state, action) {
      const current = this.enumerate(state, { family: action?.family })[0];
      return current?.actionId === action?.actionId
        ? { ok: true }
        : { ok: false, code: "STANDARD_ACTION_STALE", message: "stale" };
    },
  };
}

function createHarness(initialValue = 0) {
  let commitEvents = 0;
  const composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (options) => createState(options.value ?? initialValue),
    projectState: (state) => ({
      match: structuredClone(state.match),
      meta: { stateVersion: state.meta.stateVersion },
    }),
    createEffectGroup(_state, action) {
      if (action.family === "scan") {
        return {
          effects: [
            { type: "add", payload: { amount: 2 } },
            {
              type: "choose",
              kind: "decision",
              ownerId: "player-1",
              payload: { choices: [{ id: "left", amount: 3 }, { id: "right", amount: 5 }] },
              allowQuickActions: true,
            },
          ],
        };
      }
      if (action.family === "quick_trade") return { effects: [{ type: "add", payload: { amount: 7 } }] };
      return { effects: [{ type: "add", payload: { amount: 1 } }] };
    },
    effectExecutors: {
      add(state, effect) {
        state.match.value += effect.payload.amount;
        return { ok: true, nextState: state };
      },
      choose: {
        getLegalChoices(_state, effect) { return effect.payload.choices; },
        resolveDecision(state, _effect, choice) {
          state.match.value += choice.amount;
          return { ok: true, nextState: state };
        },
      },
      fail() { throw new Error("boom"); },
    },
  });
  composition.subscribe((event) => {
    if (event.source === "committed") commitEvents += 1;
  });
  return { composition, commitEvents: () => commitEvents };
}

{
  const { composition, commitEvents } = createHarness();
  const action = composition.inputPort.enumerateActions({ family: "launch" })[0];
  const result = composition.inputPort.submitAction(action);
  assert.equal(result.ok, true);
  assert.equal(result.phase, "completed");
  assert.equal(composition.projection().state.match.value, 1);
  assert.equal(composition.projection().stateVersion, 1);
  assert.equal(commitEvents(), 1, "完整 Effect Queue 只允许一次 CAS");
  assert.equal(Object.hasOwn(composition, "compareAndCommit"), false);
  assert.equal(Object.hasOwn(composition, "getSnapshot"), false);
  assert.equal(Object.hasOwn(composition, "actionRegistry"), false);
}

{
  const { composition, commitEvents } = createHarness(10);
  const action = composition.inputPort.enumerateActions({ family: "scan" })[0];
  const opened = composition.inputPort.submitAction(action);
  assert.equal(opened.ok, true);
  assert.equal(opened.journal.actions.length, 1, "活跃 Session 输入结果必须携带冻结 journal 快照");
  assert.equal(composition.inspect().phase, "awaiting_input");
  assert.equal(composition.projection().state.match.value, 12, "同一 working root 立即消费顺序 Effect");
  assert.equal(composition.projection().state.meta.stateVersion, 0, "Decision 期间 committed version 不变");
  assert.equal(commitEvents(), 0);

  const staleQuick = composition.inputPort.enumerateActions({ family: "quick_trade" })[0];
  const quick = composition.inputPort.submitQuickAction(staleQuick);
  assert.equal(quick.ok, true);
  assert.equal(composition.inspect().phase, "awaiting_input");
  assert.equal(composition.projection().state.match.value, 19);

  const decision = composition.inspect().session.decision;
  const completed = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: decision.choices.find((choice) => choice.id === "right"),
  });
  assert.equal(completed.ok, true);
  assert.equal(composition.projection().state.match.value, 24);
  assert.equal(composition.projection().stateVersion, 1);
  assert.equal(commitEvents(), 1);
}

{
  const { composition, commitEvents } = createHarness(4);
  const legal = composition.inputPort.enumerateActions({ family: "launch" })[0];
  assert.equal(composition.lifecycle.newGame({ value: 8 }).ok, true);
  const before = JSON.stringify(composition.projection());
  const stale = composition.inputPort.submitAction(legal);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "STANDARD_ACTION_STALE");
  assert.equal(JSON.stringify(composition.projection()), before, "stale Action 必须零污染");
  assert.equal(commitEvents(), 0);
}

{
  const { composition } = createHarness(6);
  const saved = composition.lifecycle.save();
  assert.equal(saved.ok, true);
  assert.equal(saved.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(composition.lifecycle.newGame({ value: 99 }).ok, true);
  assert.equal(composition.lifecycle.restore(saved.envelope).ok, true);
  assert.equal(composition.projection().state.match.value, 6);
  assert.equal(composition.lifecycle.restore({ schemaVersion: "legacy-v0" }).code, "RULE_COMPOSITION_SAVE_SCHEMA_UNSUPPORTED");
}

{
  let runtimeCreations = 0;
  const sharedRuntimeApi = {
    ...effectRuntimeApi,
    createRuntime(options) {
      runtimeCreations += 1;
      return effectRuntimeApi.createRuntime(options);
    },
  };
  const composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi: sharedRuntimeApi,
    createInitialState: () => createState(0),
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    createActionRegistry() {
      const registry = createRegistry();
      return {
        enumerate(state, request = {}) {
          return request.family && request.family !== "research_tech"
            ? []
            : [{
              schemaVersion: "seti-standard-action-v1",
              family: "research_tech",
              phase: "main",
              actionId: `research_tech:default:${state.meta.stateVersion}`,
              actorId: "player-1",
              stateVersion: state.meta.stateVersion,
              decisionVersion: 0,
              target: { id: "default" },
              payload: {},
              summary: "research_tech",
            }];
        },
        validate(state, action) {
          const current = this.enumerate(state, { family: "research_tech" })[0];
          return current?.actionId === action?.actionId ? { ok: true } : registry.validate(state, action);
        },
      };
    },
    effectDomains: [{
      create: researchTechSession.createResearchTechRuntime,
      families: [researchTechSession.ACTION_FAMILY],
      options: {
        rotate(state) {
          state.match.rotation = (state.match.rotation || 0) + 1;
          return { ok: true, nextState: state };
        },
        listChoices: () => [{ tileId: "blue1" }],
        place(state, choice) {
          state.match.tech = choice.tileId;
          return { ok: true, nextState: state, placement: choice };
        },
        buildImmediateRewards: () => [],
        applyImmediateReward: (state) => ({ ok: true, nextState: state }),
      },
    }],
  });
  assert.equal(runtimeCreations, 1, "production Effect domain 必须注册进 composition 唯一 runtime");
  const action = composition.inputPort.enumerateActions({ family: "research_tech" })[0];
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  const decision = composition.inspect().session.decision;
  const completed = composition.inputPort.submitDecision({
    decisionId: decision.decisionId,
    decisionVersion: decision.decisionVersion,
    choice: decision.choices[0],
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.phase, "completed");
  assert.equal(composition.projection().state.match.tech, "blue1");
  assert.equal(composition.projection().stateVersion, 1);
}

{
  let composition = null;
  let unsafeCheckpoint = null;
  composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: () => createState(0),
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    createEffectGroup: () => ({ effects: [{ type: "checkpoint_probe" }] }),
    effectExecutors: {
      checkpoint_probe(state) {
        unsafeCheckpoint = composition.lifecycle.save();
        state.match.value += 1;
        return { ok: true, nextState: state };
      },
    },
  });
  const action = composition.inputPort.enumerateActions({ family: "launch" })[0];
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  assert.equal(unsafeCheckpoint.ok, false, "执行中的 unsafe checkpoint 不得伪装成成功存档");
  assert.equal(unsafeCheckpoint.code, "EFFECT_CHECKPOINT_UNSAFE_PHASE");
}

{
  let commitEvents = 0;
  const replace = (target, source) => {
    for (const key of Reflect.ownKeys(target)) delete target[key];
    Object.assign(target, structuredClone(source));
  };
  const composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState: () => createState(0),
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      createProjectionState: (workingState) => structuredClone(workingState),
      restoreWorkingState: replace,
    },
    executeHostCommand(workingState, command) {
      if (command.kind !== "increment") return { ok: false, code: "UNKNOWN" };
      workingState.match.value += command.amount;
      return { ok: true, amount: command.amount };
    },
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    createEffectGroup: () => ({ effects: [{ type: "noop" }] }),
    effectExecutors: { noop: (state) => ({ ok: true, nextState: state }) },
  });
  composition.stateSourcePort.subscribe(() => { commitEvents += 1; });
  const source = composition.stateSourcePort.read({ viewerId: "test", role: "spectator" });
  assert.equal(source.state.match.value, 0, "只读 StateSource 必须投影 Composition working state");
  assert.equal(Object.isFrozen(source), true, "StateSource envelope 必须冻结");
  assert.equal(Object.hasOwn(composition, "getWorkingState"), false, "Composition 不得公开 mutable working root accessor");
  const before = composition.projection();
  composition.inputPort.enumerateActions({ family: "launch" });
  assert.deepEqual(composition.projection(), before, "枚举必须保持 committed projection 不变");
  assert.equal(commitEvents, 0, "枚举不得隐式 compare-and-commit");
  const commandResult = composition.inputPort.submitHostCommand({ kind: "increment", amount: 4 });
  assert.equal(commandResult.ok, true);
  assert.equal(commandResult.stateVersion, 1);
  assert.equal(composition.stateSourcePort.read().state.match.value, 4);
  assert.equal(commitEvents, 1, "宿主命令必须由 composition 统一执行一次 CAS");
  const rejected = composition.inputPort.submitHostCommand({ kind: "unknown", amount: 99 });
  assert.equal(rejected.ok, false);
  assert.equal(composition.stateSourcePort.read().state.match.value, 4, "失败宿主命令必须零污染");
}

{
  let commitEvents = 0;
  let composition = null;
  let outerArgument = null;
  let nestedArgument = null;
  const replace = (target, source) => {
    for (const key of Reflect.ownKeys(target)) delete target[key];
    Object.assign(target, structuredClone(source));
  };
  composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState: () => createState(0),
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      createProjectionState: (workingState) => structuredClone(workingState),
      restoreWorkingState: replace,
    },
    executeHostCommand(workingState, command) {
      if (command.kind === "outer") {
        outerArgument = { owner: workingState.match };
        const nested = composition.inputPort.submitHostCommand({ kind: "nested", argument: outerArgument });
        return nested.ok ? { ok: true } : nested;
      }
      if (command.kind === "nested") {
        nestedArgument = command.argument;
        assert.equal(nestedArgument, outerArgument, "嵌套命令不得克隆同一事务内的 capability 参数");
        assert.equal(nestedArgument.owner, workingState.match, "嵌套命令必须复用同一 working candidate identity");
        workingState.match.value += 3;
        return { ok: true };
      }
      return { ok: false, code: "UNKNOWN" };
    },
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    createEffectGroup: () => ({ effects: [{ type: "noop" }] }),
    effectExecutors: { noop: (state) => ({ ok: true, nextState: state }) },
  });
  composition.stateSourcePort.subscribe(() => { commitEvents += 1; });
  const result = composition.inputPort.submitHostCommand({ kind: "outer" });
  assert.equal(result.ok, true);
  assert.equal(composition.stateSourcePort.read().state.match.value, 3);
  assert.equal(commitEvents, 1, "嵌套宿主命令只允许由最外层 composition 执行一次 CAS");
}

{
  const composition = createBrowserRuleComposition({
    stateStoreApi,
    effectRuntimeApi,
    createActionRegistry: createRegistry,
    createInitialState: (_options, workingState) => structuredClone(workingState),
    stateAdapter: {
      createWorkingState: () => createState(0),
      createCommittedState: (workingState, committedState) => ({
        ...structuredClone(workingState),
        meta: structuredClone(committedState.meta),
      }),
      createProjectionState: (workingState) => structuredClone(workingState),
      createSavedState: (committedState, _workingState, saveOptions) => ({
        ...structuredClone(committedState),
        meta: { ...structuredClone(committedState.meta), rngState: structuredClone(saveOptions.rngState) },
      }),
      restoreWorkingState(target, source) {
        for (const key of Reflect.ownKeys(target)) delete target[key];
        Object.assign(target, structuredClone(source));
      },
    },
    projectState: (state) => ({ match: state.match, meta: { stateVersion: state.meta.stateVersion } }),
    createEffectGroup: () => ({
      effects: [{
        type: "choose",
        kind: "decision",
        ownerId: "player-1",
        payload: { choices: [{ id: "left", amount: 1 }] },
      }],
    }),
    effectExecutors: {
      choose: {
        getLegalChoices(_state, effect) { return effect.payload.choices; },
        resolveDecision(state) { return { ok: true, nextState: state }; },
      },
    },
  });
  const action = composition.inputPort.enumerateActions({ family: "scan" })[0];
  assert.equal(composition.inputPort.submitAction(action).ok, true);
  assert.equal(composition.inspect().phase, "awaiting_input");
  const saved = composition.lifecycle.save({ rngState: { algorithm: "test", state: 7 } });
  assert.equal(JSON.parse(saved.envelope.committedState).meta.rngState.state, 7,
    "活跃 Session 存档必须装饰 committed meta，且不得泄漏 working state");
}

{
  const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.equal(fs.existsSync(path.join(__dirname, "browser-state-authority.js")), false, "旧 authority 文件必须物理删除");
  assert.match(appSource, /createBrowserRuleComposition\(/, "生产 app 必须实例化唯一 Rule Composition");
  assert.doesNotMatch(appSource, /createBrowserStateAuthority\(/, "生产 app 不得实例化旧 BrowserStateAuthority");
  assert.doesNotMatch(indexSource, /browser-state-authority\.js/, "生产脚本不得加载旧 authority owner");
  assert.match(indexSource, /browser-rule-composition\.js/, "生产脚本必须加载 Rule Composition");
  assert.match(appSource, /browserRuleComposition\.inputPort\.submitDecision\(/, "AI conditional caller 必须提交 Composition Decision");
  const dispatchInputSource = appSource.slice(
    appSource.indexOf("function dispatchBrowserRuleInput"),
    appSource.indexOf("const runtime = runtimeModule.createRuntime"),
  );
  assert.ok(
    dispatchInputSource.indexOf("browserRuleComposition.inputPort.enumerateActions")
      < dispatchInputSource.indexOf("return actionRuntimeController.dispatchAction"),
    "headless Standard Action 枚举必须先进入 composition inputPort",
  );
  assert.doesNotMatch(appSource, /replaceMutableObject\?\.|if \(!browserRuleCompositionModule\.replaceMutableObject\)/, "working root restore 不得保留 optional helper 双协议");
  const tradeSource = fs.readFileSync(path.join(__dirname, "../game/ai/trade-candidates.js"), "utf8");
  assert.match(tradeSource, /canAiMoveThisTurn\(workingRoot, player\.id\)/, "AI trade candidates 必须显式传 workingRoot");
  const standardActionSource = fs.readFileSync(path.join(__dirname, "../game/actions/standard-action.js"), "utf8");
  assert.doesNotMatch(standardActionSource, /_compositionCheckpointVersion|comparableDecision/, "Action identity 不得忽略 decisionStateVersion");
  const handFlowSource = fs.readFileSync(path.join(__dirname, "hand-flow.js"), "utf8");
  const cardRuntimeSource = fs.readFileSync(path.join(__dirname, "card-runtime.js"), "utf8");
  const conditionalSource = fs.readFileSync(path.join(__dirname, "conditional-decision-domain.js"), "utf8");
  const debugRuntimeSource = fs.readFileSync(path.join(__dirname, "debug-runtime.js"), "utf8");
  const migratedPaymentSources = [appSource, handFlowSource, cardRuntimeSource, conditionalSource, debugRuntimeSource].join("\n");
  assert.doesNotMatch(
    migratedPaymentSources,
    /["'](?:move_payment|play_card_selection|hand_card_play_action|card_corner_quick_action)["']/,
    "第一批旧 DecisionSession key 必须从生产调用物理删除",
  );
  assert.doesNotMatch(
    handFlowSource,
    /(?:movePayment|playCardSelection|handCardPlayAction|cardCornerQuickAction)Draft/,
    "hand-flow 不得用 module-local draft 同构替代规则 owner",
  );
  assert.match(handFlowSource, /workingRoot\.match\.movePaymentContinuation/, "支付上下文必须归 Composition continuation state");
  assert.match(conditionalSource, /workingRoot\.match\?\.movePaymentContinuation/, "支付 Decision 必须从 Composition working root 枚举");
  assert.doesNotMatch(conditionalSource, /isPlayCardSelectionActive|getPendingPlayCardSelection/, "规则枚举不得读取纯 UI 打牌选择");
  assert.match(appSource, /MOVE_PAYMENT_DECISION_REQUIRED[\s\S]*?inputPort\.submitDecision\(/, "人类支付确认必须提交 active DecisionEffect");
  assert.match(handFlowSource, /uiRuntimeState\.movePaymentSelectedHandIndices/, "未提交的手牌高亮只能进入 UI state");
  const aiProductionSource = [
    fs.readFileSync(path.join(__dirname, "ai/automation-runtime.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "ai/initial-card-pending.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "ai/interaction-pending.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "ai-controller.js"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(aiProductionSource, /pendingMovePayment|pendingPlayCardSelection|runAiMovePaymentDecision|runAiPlayCardSelectionDecision/, "AI 不得保留 UI/payment pending 旁路");
  const cardTriggerSource = fs.readFileSync(path.join(__dirname, "card-trigger-runtime.js"), "utf8");
  const speciesRuntimeSource = fs.readFileSync(path.join(__dirname, "aliens/species-runtime.js"), "utf8");
  const scanFlowSource = fs.readFileSync(path.join(__dirname, "scan-flow.js"), "utf8");
  const migratedCardDecisionSources = [
    appSource,
    cardRuntimeSource,
    cardTriggerSource,
    conditionalSource,
    debugRuntimeSource,
    speciesRuntimeSource,
    scanFlowSource,
  ].join("\n");
  assert.doesNotMatch(
    migratedCardDecisionSources,
    /["'](?:card_corner_free_move|card_trigger_free_move|card_trigger_action|card_task_completion|pass_reserve_selection)["']/,
    "第二批卡牌旧 DecisionSession key 必须从生产调用物理删除",
  );
  assert.match(cardTriggerSource, /workingRoot[\s\S]*?cardTriggerContinuation/, "卡牌触发选择必须归 Composition continuation");
  assert.match(cardTriggerSource, /workingRoot[\s\S]*?cardTaskCompletionContinuation/, "任务完成选择必须归 Composition continuation");
  assert.match(cardRuntimeSource, /workingRoot[\s\S]*?cardCornerFreeMoveContinuation/, "卡牌角标移动必须归 Composition continuation");
  assert.match(cardRuntimeSource, /workingRoot[\s\S]*?passReserveContinuation/, "PASS 预留决策必须归 Composition continuation");
  assert.doesNotMatch(
    aiProductionSource,
    /pendingPassReserve|pendingCardTrigger|pendingCardTaskCompletion|pendingCardCornerFreeMove|runAiPassReserveDecision|runAiCardTrigger|runAiCardTaskCompletionDecision|runAiCardCornerFreeMoveDecision/,
    "AI 必须只经 active Decision choice + submitDecision 处理卡牌决策",
  );
  assert.doesNotMatch(cardRuntimeSource, /passReserveContinuation[^\n]*selectedCardId|getPassReserveSelection\([^)]*\)\.selectedCardId/, "PASS continuation 不得持有 UI 选择");
  assert.match(cardRuntimeSource, /uiRuntimeState\.passReserveSelectedCardId/, "PASS 未确认高亮只能进入 uiRuntimeState");
  assert.match(appSource, /PASS_RESERVE_DECISION_REQUIRED[\s\S]*?inputPort\.submitDecision\(/, "PASS 人类确认必须映射 active Decision choice");
  assert.match(appSource, /function submitActiveCardDecision[\s\S]*?inputPort\.submitDecision\(/, "卡牌 trigger/task/free-move 人类输入必须提交 active Decision choice");
  assert.doesNotMatch([appSource, scanFlowSource, debugRuntimeSource].join("\n"), /["']public_scan_queue["']/, "公共扫描队列旧 store key 必须物理删除");
  assert.match(scanFlowSource, /workingRoot[\s\S]*?publicScanContinuation/, "公共扫描队列必须归 Composition continuation");
  const effectChoiceSource = fs.readFileSync(path.join(__dirname, "effect-choice-flow.js"), "utf8");
  assert.doesNotMatch(
    [appSource, scanFlowSource, debugRuntimeSource, effectChoiceSource].join("\n"),
    /["'](?:probe_sector_scan|probe_location_reward)["']/,
    "探测器扫描/位置奖励旧 store key 必须物理删除",
  );
  assert.match(effectChoiceSource, /workingRoot[\s\S]*?probeSectorScanContinuation/, "探测器扫描规则上下文必须归 Composition continuation");
  assert.match(effectChoiceSource, /uiRuntimeState\?\.probeSectorSelectedRocketIds/, "探测器多选高亮只能进入 uiRuntimeState");
  assert.doesNotMatch(aiProductionSource, /runAiProbeSectorScanDecision|runAiProbeLocationRewardDecision|pendingProbeSectorScanAction|pendingProbeLocationRewardAction/, "探测器选择 AI 不得保留专用 pending resolver");
}

console.log("browser-rule-composition tests passed");
