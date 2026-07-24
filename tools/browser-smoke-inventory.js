"use strict";

module.exports = Object.freeze([
  Object.freeze({
    id: "production-start-button",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button'))",
    actionExpression: "document.querySelector('#start-screen-start-button').click()",
    successExpression: "document.querySelector('#start-screen')?.hidden === true && document.querySelector('#initial-selection-area')?.hidden === false && Boolean(document.querySelector('.initial-selection-card-button'))",
    obligation: "生产入口无未捕获异常、完成 SetiRandomizer 装配，且“开始游戏”可进入初始选择",
    counterexample: "app.js 初始化异常导致公开 API 或事件未装配，或点击后启动页/初始选择状态错误",
  }),
  Object.freeze({
    id: "production-browser-full-parity",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button'))",
    actionExpression: `(async () => {
      const waitFor = async (predicate, label, timeout = 12000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      document.querySelector("#start-screen-start-button").click();
      await waitFor(() => document.querySelectorAll(".initial-selection-card-button").length >= 5, "真人初始选择");
      const inputBefore = window.SetiRandomizer.inspect().input.submissionSequence;
      document.querySelector(".initial-selection-section-industry .initial-selection-card-button:not(:disabled)")?.click();
      await waitFor(() => Boolean(document.querySelector(".initial-selection-section-industry .initial-selection-card-button.is-selected")), "公司 DOM 选择");
      document.querySelector(".initial-selection-section-initial .initial-selection-card-button:not(:disabled):not(.is-selected)")?.click();
      await waitFor(() => document.querySelectorAll(".initial-selection-section-initial .initial-selection-card-button.is-selected").length === 1, "第一张初始牌 DOM 选择");
      document.querySelector(".initial-selection-section-initial .initial-selection-card-button:not(:disabled):not(.is-selected)")?.click();
      await waitFor(() => document.querySelectorAll(".initial-selection-section-initial .initial-selection-card-button.is-selected").length === 2, "第二张初始牌 DOM 选择");
      const confirm = document.querySelector(".initial-selection-confirm:not(:disabled)");
      if (!confirm) throw new Error("初始选择确认按钮未启用");
      confirm.click();
      await waitFor(() => {
        const input = window.SetiRandomizer.inspect().input;
        return input.submissionSequence >= inputBefore + 15
          && input.lastResult?.kind === "decision";
      }, "initial_setup Standard Action/Decision input facade");
      for (let guard = 0; guard < 12; guard += 1) {
        const beforePayment = window.SetiRandomizer.inspect();
        if (beforePayment.projection.source.phase === "idle") break;
        const decision = beforePayment.projection.decision;
        if (decision?.kind !== "choose_payment") {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }
        if (decision.ownerId !== beforePayment.projection.viewer.playerId) {
          await waitFor(() => {
            const next = window.SetiRandomizer.inspect();
            return next.projection.source.phase === "idle"
              || next.projection.decision?.decisionId !== decision.decisionId;
          }, "AI 初始收入 Decision");
          continue;
        }
        await waitFor(() => Boolean(
          document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]'),
        ), "初始收入 Decision DOM choice");
        const choice = document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]');
        if (!choice) throw new Error("初始收入 Decision 缺少 DOM choice");
        choice.click();
        await waitFor(() => Boolean(
          document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="confirm"]:not(:disabled)'),
        ), "初始收入 Decision 确认按钮");
        const paymentConfirm = document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="confirm"]:not(:disabled)');
        if (!paymentConfirm) throw new Error("初始收入 Decision 确认按钮未启用");
        paymentConfirm.click();
        await waitFor(() => {
          const next = window.SetiRandomizer.inspect();
          return next.projection.source.phase === "idle"
            || next.projection.decision?.decisionId !== decision.decisionId;
        }, "真人初始收入 Decision");
      }
      await waitFor(() => window.SetiRandomizer.inspect().projection.source.phase === "idle", "完成初始结算");
      await waitFor(() => !document.querySelector(".initial-selection-picker"), "完成多席位 Decision");
      await waitFor(() => document.querySelector("#player-stats")?.children.length > 0, "玩家资源 renderer");
      const setupInput = window.SetiRandomizer.inspect().input;
      if (setupInput.submissionSequence < 16 || setupInput.lastResult?.kind !== "decision") {
        throw new Error("真实初始选择未进入 Standard Action/Decision input facade: " + JSON.stringify(setupInput));
      }
      const beforeInspect = window.SetiRandomizer.inspect();
      const inputSequence = beforeInspect.input.submissionSequence;
      await waitFor(() => {
        const button = document.querySelector("#action-pass-button");
        return Boolean(button && !button.disabled);
      }, "人类 PASS 主行动就绪", 20000);
      const passButton = document.querySelector("#action-pass-button");
      if (!passButton || passButton.disabled) throw new Error("人类 PASS 主行动不可提交");
      passButton.click();
      await waitFor(() => {
        const next = window.SetiRandomizer.inspect();
        return next.input.submissionSequence > inputSequence
          && next.input.lastResult?.kind === "action";
      }, "人类主行动进入 Standard Action input port");
      const projection = window.SetiRandomizer.inspect().projection;
      const renderProjection = projection.resident?.browserReadModel?.render || {};
      const serialized = JSON.stringify(projection);
      const opponents = Object.values(projection.players || {}).filter(
        (entry) => String(entry?.id) !== String(projection.viewer?.playerId),
      );
      if (serialized.includes('"drawPile"') || serialized.includes('"deck"')
        || opponents.some((entry) => Object.hasOwn(entry || {}, "hand"))) {
        throw new Error("BrowserProjection 泄漏隐藏 deck 或他人手牌");
      }
      const required = {
        solar: document.querySelector("#wheel-1")?.dataset.projectionRotation != null,
        rockets: Boolean(document.querySelector("#token-layer")),
        players: document.querySelector("#player-stats")?.children.length > 0,
        hand: Boolean(document.querySelector("#player-hand-fan")),
        publicCards: document.querySelector("#public-card-row")?.children.length > 0,
        tech: document.querySelectorAll("[data-tech-id][data-projection-available]").length >= 12,
        scanData: Boolean(document.querySelector("#player-board-data-layer"))
          && Boolean(renderProjection.dataPresentation),
        aliens: document.querySelectorAll(".alien-panel[data-alien-slot]").length === 2
          && Boolean(renderProjection.markerPresentation),
        scoring: document.querySelectorAll("#final-score-grid .final-score-tile").length === 4
          && Boolean(renderProjection.finalScorePresentation),
      };
      const missing = Object.entries(required).filter(([, ok]) => !ok).map(([name]) => name);
      if (missing.length) throw new Error("真实页面 renderer 缺失: " + missing.join(", "));
      const captured = window.SetiRandomizer.capture();
      if (!captured.ok) throw new Error("真实页面保存失败");
      const restored = window.SetiRandomizer.restore(captured.envelope);
      if (!restored.ok) throw new Error("真实页面恢复失败");
      const beforeRenderFailure = window.SetiRandomizer.inspect().projection.source;
      const renderFailure = window.SetiBrowserResidentRenderer.createDesktopRenderPort({
        createRenderInput: () => ({ projection, viewState: {} }),
        renderer: { renderAll() { throw new Error("index renderer canary"); } },
        decisionRenderer: { render() {} },
      })();
      const afterRenderFailure = window.SetiRandomizer.inspect().projection.source;
      if (renderFailure.code !== "BROWSER_RENDER_FAILED"
        || JSON.stringify(beforeRenderFailure) !== JSON.stringify(afterRenderFailure)) {
        throw new Error("renderer 抛错污染规则状态");
      }
      window.__setiFullParitySmoke = { ok: true, required };
    })()`,
    successExpression: "window.__setiFullParitySmoke?.ok === true",
    obligation: "真实 index.html 覆盖 viewer 隐私、完整页面 renderer、人类主行动/多步 Decision、保存恢复和 renderer 异常隔离",
    counterexample: "极简壳、空 renderer、canonical root 泄漏、缺失真实 UI 或 renderer 抛错污染规则状态",
  }),
  Object.freeze({
    id: "page-projection-action",
    file: "randomizer/app/browser-host/browser-host.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "真实页面装配、projection 隐私、人类 Action 与 resident renderer",
    counterexample: "隐藏 deck 泄漏、ViewState 进入规则端口或 DOM Action 未原样提交",
  }),
  Object.freeze({
    id: "human-card-decision",
    file: "randomizer/app/browser-host/card-decision-ui.browser-smoke.html",
    resultSelector: "#card-decision-smoke-result",
    resultAttribute: "data-ok",
    obligation: "真实 DOM 多步卡牌 Decision 经公共输入端口推进",
    counterexample: "清空 DOM 后无法重建、非候选 choice 或隐藏手牌泄漏",
  }),
  Object.freeze({
    id: "policy-input",
    file: "randomizer/app/browser-host/policy-input-adapter.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "Policy 在 Chrome 中只经与人类共用的 Action/Decision input port",
    counterexample: "Policy 访问 renderer/picker 或绕过正式提交端口",
  }),
  Object.freeze({
    id: "save-recovery",
    file: "randomizer/app/browser-host/browser-services.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "真实 reload 后恢复 composition envelope 与独立 ViewState",
    counterexample: "刷新丢失 committed state、ViewState 或 facade 泄漏 authority",
  }),
  Object.freeze({
    id: "industry-alien-decision",
    file: "randomizer/app/browser-host/industry-alien-decision-ui.browser-smoke.html",
    resultSelector: "#industry-alien-decision-smoke-result",
    resultAttribute: "data-ok",
    obligation: "真实 DOM 公司/外星多 Decision、owner 隐私与固定 session trace",
    counterexample: "非 owner 看到选择、旧 resolver 被调用或 journal 丢步骤",
  }),
  Object.freeze({
    id: "alien-production-projection-input",
    file: "randomizer/app/aliens/species-runtime.browser-smoke.html",
    resultSelector: "body",
    resultAttribute: "data-result",
    obligation: "真实 residual 外星揭示由正式 projection 渲染，并由人类 Browser 输入提交正式物种 Decision",
    counterexample: "Browser 只做空投影、旧 runtime 自行 mutation，或人类点击绕过 residual Decision executor",
  }),
]);
