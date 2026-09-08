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
    id: "production-trajectory-recording",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button') && document.querySelector('#start-record-trajectory'))",
    actionExpression: `(async () => {
      const checkbox = document.querySelector("#start-record-trajectory");
      if (!checkbox || checkbox.checked !== true) {
        throw new Error("录制开关必须默认勾选: " + (checkbox && checkbox.checked));
      }
      const waitFor = async (predicate, label, timeout = 12000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      document.querySelector("#start-screen-start-button").click();
      await waitFor(() => (
        window.SetiRandomizer.isTrajectoryRecordingEnabled() === true
      ), "默认勾选后录制器装配");
      await waitFor(() => Boolean(document.querySelector(".initial-selection-card-button")), "初始选择");
      const jsonl = window.SetiRandomizer.getRecordedTrajectory();
      if (!jsonl) throw new Error("录制开启后轨迹为空");
      const lines = jsonl.split("\\n").filter(Boolean);
      if (!lines.length) throw new Error("轨迹 JSONL 无内容");
      let stepCount = 0;
      for (const line of lines) {
        const record = JSON.parse(line);
        if (record.schemaVersion !== "seti-self-play-log-v1") {
          throw new Error("轨迹必须使用 self-play log schema: " + record.schemaVersion);
        }
        if (record.type === "step") {
          stepCount += 1;
          if (!["human", "machine"].includes(record.actorKind)) {
            throw new Error("step 必须标记 human/machine actorKind: " + record.actorKind);
          }
          if (!record.action || !Array.isArray(record.legalMask)) {
            throw new Error("step 必须携带 action 与 legalMask");
          }
        }
      }
      if (stepCount === 0) throw new Error("轨迹没有任何已确认 step");
      checkbox.checked = false;
      document.querySelector("#start-screen-start-button").click();
      if (window.SetiRandomizer.isTrajectoryRecordingEnabled() !== false
        || window.SetiRandomizer.getRecordedTrajectory() !== null) {
        throw new Error("取消勾选后录制必须关闭");
      }
      window.__setiTrajectorySmoke = { ok: true, lines: lines.length, steps: stepCount };
    })()`,
    successExpression: "window.__setiTrajectorySmoke?.ok === true",
    obligation: "开局前录制开关默认勾选，勾选后每个已确认输入按 self-play JSONL 落轨迹且可关闭",
    counterexample: "开关默认态错误、轨迹 schema 不符、缺 action/legalMask/actorKind 或取消勾选后仍录制",
  }),
  Object.freeze({
    id: "production-fixed-board",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button') && document.querySelector('#start-fixed-board'))",
    actionExpression: `(async () => {
      const fixed = document.querySelector("#start-fixed-board");
      if (!fixed) throw new Error("缺少固定盘面下拉");
      fixed.value = "seti-107";
      fixed.dispatchEvent(new Event("change", { bubbles: true }));
      const seedInput = document.querySelector("#start-seed-input");
      if (!seedInput) throw new Error("缺少种子输入框");
      if (seedInput.disabled !== true || seedInput.value !== "seti-107") {
        throw new Error("选择固定盘面后种子输入框必须锁定为对应 seed: " + JSON.stringify({ disabled: seedInput.disabled, value: seedInput.value }));
      }
      document.querySelector("#start-screen-start-button").click();
      const waitFor = async (predicate, label, timeout = 12000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      await waitFor(() => Boolean(document.querySelector(".initial-selection-card-button")), "初始选择");
      const render = window.SetiRandomizer.inspect().projection.resident?.ui?.browserReadModel?.render || {};
      const sectors = (render.boardChrome?.sectors || []).map((entry) => [Number(entry.slotId), Number(entry.sectorId)]);
      const publicFaces = (render.cardPanels?.publicCards || []).map((card) => String(card.imageSrc || ""));
      const expectedSectors = [[1, 3], [2, 2], [3, 4], [4, 1]];
      const expectedFaces = ["dlc_20.png", "b_137.webp", "b_83.webp"];
      if (JSON.stringify(sectors) !== JSON.stringify(expectedSectors)) {
        throw new Error("固定盘面扇区布局与训练盘面不一致: " + JSON.stringify(sectors));
      }
      for (const face of expectedFaces) {
        if (!publicFaces.some((src) => src.endsWith(face))) {
          throw new Error("固定盘面公共牌与训练盘面不一致: " + JSON.stringify(publicFaces));
        }
      }
      const companyAlts = [...document.querySelectorAll(
        "#compositionDecisionRoot .decision-ui-card-image-industry",
      )].map((img) => img.getAttribute("alt") || "");
      if (!companyAlts.some((alt) => alt.includes("寰宇动力"))) {
        throw new Error("双发盘面初始公司必须含寰宇动力: " + JSON.stringify(companyAlts));
      }
      window.__setiFixedBoardSmoke = { ok: true, sectors, publicFaces, companyAlts };
    })()`,
    successExpression: "window.__setiFixedBoardSmoke?.ok === true",
    obligation: "勾选固定盘面后浏览器开局复现训练固定盘面（seti-104-board-v1 的扇区布局与公共牌）",
    counterexample: "固定盘面 seed 未接入随机源，或浏览器盘面与 Simulation 固定盘面不一致",
  }),
  Object.freeze({
    id: "production-custom-seed",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-seed-input'))",
    actionExpression: `(async () => {
      const seedInput = document.querySelector("#start-seed-input");
      seedInput.value = "hello-seti-2026";
      document.querySelector("#start-screen-start-button").click();
      const waitFor = async (predicate, label, timeout = 12000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      await waitFor(() => Boolean(document.querySelector(".initial-selection-card-button")), "初始选择");
      const render = window.SetiRandomizer.inspect().projection.resident?.ui?.browserReadModel?.render || {};
      const sectors = (render.boardChrome?.sectors || []).map((entry) => [Number(entry.slotId), Number(entry.sectorId)]);
      const publicFaces = (render.cardPanels?.publicCards || []).map((card) => String(card.imageSrc || ""));
      const expectedSectors = [[1, 3], [2, 4], [3, 1], [4, 2]];
      const expectedFaces = ["dlc_4.png", "b_5.webp", "b_10.webp"];
      if (JSON.stringify(sectors) !== JSON.stringify(expectedSectors)) {
        throw new Error("自定义种子盘面与 Simulation 不一致: " + JSON.stringify(sectors));
      }
      for (const face of expectedFaces) {
        if (!publicFaces.some((src) => src.endsWith(face))) {
          throw new Error("自定义种子公共牌与 Simulation 不一致: " + JSON.stringify(publicFaces));
        }
      }
      window.__setiCustomSeedSmoke = { ok: true, sectors, publicFaces };
    })()`,
    successExpression: "window.__setiCustomSeedSmoke?.ok === true",
    obligation: "开始界面输入自定义随机种子后，浏览器开局复现 Simulation 同 seed 盘面（RNG 起点契约）",
    counterexample: "种子未接入 RNG 起点或自定义种子盘面与 Simulation 不一致",
  }),
  Object.freeze({
    id: "production-fixed-board-free-analyze",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-fixed-board'))",
    actionExpression: `(async () => {
      const fixed = document.querySelector("#start-fixed-board");
      fixed.value = "seti-free-analyze-v1";
      fixed.dispatchEvent(new Event("change", { bubbles: true }));
      const seedInput = document.querySelector("#start-seed-input");
      if (seedInput.disabled !== true || seedInput.value !== "seti-free-analyze-v1") {
        throw new Error("免电盘面种子锁定失败: " + JSON.stringify({ disabled: seedInput.disabled, value: seedInput.value }));
      }
      document.querySelector("#start-screen-start-button").click();
      const waitFor = async (predicate, label, timeout = 12000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      await waitFor(() => Boolean(document.querySelector(".initial-selection-card-button")), "初始选择");
      const render = window.SetiRandomizer.inspect().projection.resident?.ui?.browserReadModel?.render || {};
      const sectors = (render.boardChrome?.sectors || []).map((entry) => [Number(entry.slotId), Number(entry.sectorId)]);
      const publicFaces = (render.cardPanels?.publicCards || []).map((card) => String(card.imageSrc || ""));
      const expectedSectors = [[1, 3], [2, 1], [3, 2], [4, 4]];
      const expectedFaces = ["b_2.webp", "b_48.webp", "dlc_21.png"];
      if (JSON.stringify(sectors) !== JSON.stringify(expectedSectors)) {
        throw new Error("免电分析盘面扇区与 Simulation 不一致: " + JSON.stringify(sectors));
      }
      for (const face of expectedFaces) {
        if (!publicFaces.some((src) => src.endsWith(face))) {
          throw new Error("免电分析盘面公共牌与 Simulation 不一致: " + JSON.stringify(publicFaces));
        }
      }
      const companyAlts = [...document.querySelectorAll(
        "#compositionDecisionRoot .decision-ui-card-image-industry",
      )].map((img) => img.getAttribute("alt") || "");
      if (!companyAlts.some((alt) => alt.includes("深空探测"))) {
        throw new Error("免电盘面初始公司必须含深空探测: " + JSON.stringify(companyAlts));
      }
      window.__setiFreeAnalyzeSmoke = { ok: true, sectors, publicFaces, companyAlts };
    })()`,
    successExpression: "window.__setiFreeAnalyzeSmoke?.ok === true",
    obligation: "免电分析固定盘面（free-analyze-board，白色可选深空探测）在浏览器复现 Simulation 盘面",
    counterexample: "免电盘面 seed 未接入或浏览器盘面与 Simulation 不一致",
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
      const inputBefore = window.SetiRandomizer.inspect().input.submissionSequence;
      const submitVisibleDecision = async (label, predicate) => {
        await waitFor(() => [...document.querySelectorAll(
          '#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]:not(:disabled),'
            + '#compositionDecisionRoot [data-decision-ui-intent="submit-choice"]:not(:disabled)',
        )].some(predicate), label + " choice");
        const choice = [...document.querySelectorAll(
          '#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]:not(:disabled),'
            + '#compositionDecisionRoot [data-decision-ui-intent="submit-choice"]:not(:disabled)',
        )].find(predicate);
        const beforeId = window.SetiRandomizer.inspect().projection.decision?.decisionId;
        choice.click();
        if (choice.dataset.decisionUiIntent !== "submit-choice") {
          await waitFor(() => Boolean(
            document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="confirm"]:not(:disabled)'),
          ), label + " confirm");
          document.querySelector(
            '#compositionDecisionRoot [data-decision-ui-intent="confirm"]:not(:disabled)',
          ).click();
        }
        await waitFor(() => (
          window.SetiRandomizer.inspect().projection.decision?.decisionId !== beforeId
        ), label + " advance");
      };
      await waitFor(() => (
        document.querySelectorAll("#compositionDecisionRoot .decision-ui-card-image-industry").length === 2
      ), "初始公司真实卡面");
      const setupShell = document.querySelector("#compositionDecisionRoot .decision-ui-shell-initial-setup");
      const setupGroups = document.querySelectorAll("#compositionDecisionRoot .decision-ui-choice-group");
      if (!setupShell || setupGroups.length !== 2) {
        throw new Error("初始选择未使用公司/资源双栏大弹窗");
      }
      const setupRect = setupShell.getBoundingClientRect();
      if (setupRect.right > window.innerWidth + 1
        || setupRect.bottom > window.innerHeight + 1
        || setupRect.width < Math.min(700, window.innerWidth * 0.88)) {
        throw new Error("初始选择弹窗尺寸或视口适配错误: " + JSON.stringify({
          width: setupRect.width,
          height: setupRect.height,
          viewport: [window.innerWidth, window.innerHeight],
        }));
      }
      const companyFaces = [...document.querySelectorAll(
        "#compositionDecisionRoot .decision-ui-card-image-industry",
      )];
      if (!companyFaces.every((image) => image.src.includes("/assets/industry/"))) {
        throw new Error("初始公司未展示真实公司图片");
      }
      if (document.querySelector(
        '#compositionDecisionRoot [data-decision-ui-intent="confirm"]',
      )) {
        throw new Error("初始选择仍要求每张卡先选中再确认");
      }
      const visibleDecisionId = window.SetiRandomizer.inspect().projection.decision.decisionId;
      document.querySelector(
        '#compositionDecisionRoot [data-decision-ui-intent="collapse"]',
      )?.click();
      await waitFor(() => Boolean(
        document.querySelector(
          '#compositionDecisionRoot.is-collapsed [data-decision-ui-intent="expand"]',
        ),
      ), "Decision 收起查看盘面");
      if (window.SetiRandomizer.inspect().projection.decision?.decisionId !== visibleDecisionId) {
        throw new Error("收起 Decision 错误地 resolve/cancel 了 Effect Session");
      }
      document.querySelector(
        '#compositionDecisionRoot [data-decision-ui-intent="expand"]',
      )?.click();
      await waitFor(() => (
        document.querySelectorAll("#compositionDecisionRoot .decision-ui-card-image-industry").length === 2
      ), "Decision 恢复同一选择");
      await submitVisibleDecision(
        "公司 DOM Decision",
        (button) => Boolean(button.querySelector(".decision-ui-card-image-industry")),
      );
      await waitFor(() => (
        document.querySelectorAll(
          "#compositionDecisionRoot .decision-ui-choice-group-industry .is-rule-selected",
        ).length === 1
      ), "公司 Session 投影选中态");
      await waitFor(() => (
        document.querySelectorAll("#compositionDecisionRoot .decision-ui-card-image-initial").length >= 3
      ), "初始资源牌真实卡面");
      if (![...document.querySelectorAll(
        "#compositionDecisionRoot .decision-ui-card-image-initial",
      )].every((image) => image.src.includes("/assets/initial_card/split/"))) {
        throw new Error("初始资源牌未展示真实卡面");
      }
      await submitVisibleDecision(
        "第一张初始牌 DOM Decision",
        (button) => Boolean(button.querySelector(".decision-ui-card-image-initial"))
          && button.getAttribute("aria-pressed") !== "true",
      );
      await waitFor(() => (
        document.querySelectorAll(
          "#compositionDecisionRoot .decision-ui-choice-group-initial .is-rule-selected",
        ).length === 1
      ), "第一张资源牌 Session 投影选中态");
      await submitVisibleDecision(
        "第二张初始牌 DOM Decision",
        (button) => Boolean(button.querySelector(".decision-ui-card-image-initial"))
          && button.getAttribute("aria-pressed") !== "true",
      );
      await waitFor(() => (
        document.querySelectorAll(
          "#compositionDecisionRoot .decision-ui-choice-group-initial .is-rule-selected",
        ).length === 2
        && document.querySelectorAll(
          "#compositionDecisionRoot .decision-ui-card-image-initial",
        ).length === 3
        && document.querySelectorAll(
          "#compositionDecisionRoot .decision-ui-choice-group-initial .decision-ui-card-choice:disabled",
        ).length === 1
        && Boolean(document.querySelector(
          '#compositionDecisionRoot .decision-ui-controls [data-decision-ui-intent="submit-choice"]',
        ))
      ), "两张资源牌选中态、第三张保留与最终确认");
      await submitVisibleDecision("初始选择确认 DOM Decision", (button) => button.textContent === "确认初始选择");
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
        if (document.querySelector("#compositionDecisionRoot .decision-ui-title")?.textContent !== "插入收入牌"
          || document.querySelectorAll("#compositionDecisionRoot .decision-ui-status-group").length !== 2
          || ![...document.querySelectorAll(
            "#compositionDecisionRoot .decision-ui-card-image-hand",
          )].every((image) => image.src.includes("/assets/cards/"))) {
          throw new Error("初始收入缺少阶段提示、资源/收入状态或真实手牌卡面 " + JSON.stringify({
            title: document.querySelector("#compositionDecisionRoot .decision-ui-title")?.textContent,
            statusGroups: document.querySelectorAll("#compositionDecisionRoot .decision-ui-status-group").length,
            cardFaces: [...document.querySelectorAll(
              "#compositionDecisionRoot .decision-ui-card-image-hand",
            )].map((image) => image.getAttribute("src")),
            initialIncome: window.SetiRandomizer.inspect().projection.resident?.initialIncome,
            decision: window.SetiRandomizer.inspect().projection.decision,
          }));
        }
        const choice = document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]');
        if (!choice) throw new Error("初始收入 Decision 缺少 DOM choice");
        choice.click();
        await waitFor(() => Boolean(document.querySelector(
          '#compositionDecisionRoot .decision-ui-card-image-hand'
            + ' ~ .decision-ui-card-label',
        )?.closest(".decision-ui-card-choice.is-rule-selected[aria-pressed='true']")),
        "收入牌 Decision 选中态");
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
      const quickSequence = setupInput.submissionSequence;
      document.querySelector("#action-quick-button")?.click();
      await waitFor(() => Boolean(
        document.querySelector('[data-quick-trade="credits-for-energy"]:not(:disabled)[data-action-id]'),
      ), "人类快速行动 descriptor 就绪 " + JSON.stringify({
        quickButton: {
          disabled: document.querySelector("#action-quick-button")?.disabled,
          title: document.querySelector("#action-quick-button")?.title,
          expanded: document.querySelector("#action-quick-button")?.getAttribute("aria-expanded"),
        },
        trade: {
          disabled: document.querySelector('[data-quick-trade="credits-for-energy"]')?.disabled,
          title: document.querySelector('[data-quick-trade="credits-for-energy"]')?.title,
          actionId: document.querySelector('[data-quick-trade="credits-for-energy"]')?.dataset.actionId,
        },
        controls: window.SetiRandomizer.inspect().projection.controls,
        viewer: window.SetiRandomizer.inspect().projection.viewer,
        match: window.SetiRandomizer.inspect().projection.match,
      }));
      document.querySelector('[data-quick-trade="credits-for-energy"]:not(:disabled)[data-action-id]')?.click();
      try {
        await waitFor(() => {
          const next = window.SetiRandomizer.inspect();
          return next.input.submissionSequence > quickSequence
            && next.input.lastResult?.kind === "action"
            && next.projection.source.phase === "idle";
        }, "人类快速行动进入 Standard Action input port");
      } catch (error) {
        const next = window.SetiRandomizer.inspect();
        throw new Error(error.message + " " + JSON.stringify({
          input: next.input,
          source: next.projection.source,
          decision: next.projection.decision,
          controls: next.projection.controls,
          statusNote: document.querySelector("#status-note")?.textContent,
        }));
      }
      const playableCard = window.SetiRandomizer.inspect().projection.controls.actions.find(
        (action) => action.family === "play_card" && !action.disabledReason,
      );
      if (playableCard) {
        const findPlayableHandButton = () => (
          [...document.querySelectorAll("#player-hand-fan [data-hand-card-id]")]
            .find((button) => (
            String(button.dataset.handCardId) === String(playableCard.target?.cardInstanceId)
            ))
        );
        const handButton = findPlayableHandButton();
        if (!handButton) throw new Error("可打出的 Standard Action 没有对应手牌 DOM identity");
        handButton.click();
        await waitFor(() => (
          findPlayableHandButton()?.classList.contains("is-selected")
          && findPlayableHandButton()?.getAttribute("aria-pressed") === "true"
          && document.querySelector("#action-play-card-button")?.dataset.actionId
            === playableCard.actionId
          && !document.querySelector("#action-play-card-button")?.disabled
        ), "先选手牌后顶部打牌按钮绑定唯一 Standard Action");
        findPlayableHandButton()?.click();
        await waitFor(() => (
          document.querySelector("#action-play-card-button")?.disabled
          && !document.querySelector("#action-play-card-button")?.dataset.actionId
        ), "取消手牌选择后禁用顶部打牌按钮");
      }
      const beforeInspect = window.SetiRandomizer.inspect();
      const inputSequence = beforeInspect.input.submissionSequence;
      await waitFor(() => {
        const button = document.querySelector("#action-launch-button");
        return Boolean(button && !button.disabled);
      }, "人类 launch 主行动就绪 " + JSON.stringify({
        title: document.querySelector("#action-launch-button")?.title,
        disabled: document.querySelector("#action-launch-button")?.disabled,
        controls: window.SetiRandomizer.inspect().projection.controls,
        viewer: window.SetiRandomizer.inspect().projection.viewer,
        match: window.SetiRandomizer.inspect().projection.match,
        players: window.SetiRandomizer.inspect().projection.resident?.ui?.browserReadModel?.render
          ?.playerPanels,
      }), 20000);
      const launchButton = document.querySelector("#action-launch-button");
      if (!launchButton || launchButton.disabled) throw new Error("人类 launch 主行动不可提交");
      launchButton.click();
      await waitFor(() => {
        const next = window.SetiRandomizer.inspect();
        return next.input.submissionSequence > inputSequence
          && next.input.lastResult?.kind === "action";
      }, "人类主行动进入 Standard Action input port");
      const projection = window.SetiRandomizer.inspect().projection;
      const renderProjection = projection.resident?.ui?.browserReadModel?.render || {};
      const serialized = JSON.stringify(projection);
      const opponents = (renderProjection.playerPanels?.players || []).filter(
        (entry) => String(entry?.id) !== String(projection.viewer?.playerId),
      );
      if (serialized.includes('"drawPile"') || serialized.includes('"deck"')
        || opponents.some((entry) => Object.hasOwn(entry || {}, "hand"))) {
        throw new Error("BrowserProjection 泄漏隐藏 deck 或他人手牌");
      }
      const required = {
        solar: document.querySelector("#wheel-1")?.style.transform.startsWith("rotate(")
          && document.querySelectorAll(".sector-wrap > .sector[data-sector-id]").length === 4
          && document.querySelector("#wheel-wrap")?.getBoundingClientRect().height > 400,
        rockets: Array.isArray(renderProjection.tokenPresentation?.tokens),
        players: document.querySelector("#player-stats")?.children.length > 0,
        hand: document.querySelectorAll("#player-hand-fan .player-hand-card").length > 0
          && [...document.querySelectorAll("#player-hand-fan .player-hand-card")]
            .every((image) => image.src.includes("/assets/cards/")),
        publicCards: [...document.querySelectorAll("#public-card-row .public-card")]
          .every((image) => image.src.includes("/assets/cards/"))
          && document.querySelectorAll("#public-card-row .public-card").length === 3,
        tech: document.querySelectorAll("[data-tech-id][data-projection-available]").length >= 12
          && document.querySelectorAll(".tech-bonus:not([hidden])").length === 12
          && [...document.querySelectorAll(".tech-bonus:not([hidden])")]
            .every((image) => image.src.includes("/assets/tech_tile/bonus_")),
        scanData: Boolean(document.querySelector("#player-board-data-layer"))
          && Array.isArray(renderProjection.dataPresentation?.playerTokens)
          && renderProjection.dataPresentation.playerTokens.every((token) => (
            Number.isFinite(Number(token.percentX)) && Number.isFinite(Number(token.percentY))
          ))
          && [...document.querySelectorAll("#player-board-data-layer .player-data-token")]
            .every((token) => (
              Boolean(token.style.getPropertyValue("--x"))
              && Boolean(token.style.getPropertyValue("--y"))
            ))
          && document.querySelectorAll(".sector .nebula-data-token").length > 0
          && [...document.querySelectorAll(".sector .nebula-data-token")].every((token) => {
            const scale = Number(token.style.getPropertyValue("--data-scale"));
            return scale > 0.3 && scale < 0.5;
          }),
        opponentStats: document.querySelectorAll("#opponent-stat-grid .opponent-stat-card").length === 3
          && [...document.querySelectorAll("#opponent-stat-grid .opponent-stat-card")]
            .every((card) => (
              card.querySelectorAll(".player-stat-with-icon").length >= 6
              && Boolean(card.querySelector('[aria-label^="手牌 "]'))
            )),
        aliens: document.querySelectorAll("[data-alien-slot-root][data-revealed]").length === 2
          && document.querySelectorAll("[data-alien-slot-root] .alien-projection-face img").length === 2
          && Array.isArray(renderProjection.alienPresentation?.slots)
          && renderProjection.alienPresentation.slots.length === 2,
        scoring: document.querySelectorAll("#final-score-grid .final-score-tile").length === 4
          && Boolean(renderProjection.finalScorePresentation),
      };
      const missing = Object.entries(required).filter(([, ok]) => !ok).map(([name]) => name);
      if (missing.length) throw new Error("真实页面 renderer 缺失: " + missing.join(", "));
      for (let guard = 0; guard < 8; guard += 1) {
        const current = window.SetiRandomizer.inspect();
        if (current.projection.source.phase !== "awaiting_input") break;
        const decisionId = current.projection.decision?.decisionId;
        await waitFor(() => Boolean(
          document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]'),
        ), "主行动后续 Decision DOM choice");
        document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="focus-choice"]')?.click();
        await waitFor(() => Boolean(
          document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="confirm"]:not(:disabled)'),
        ), "主行动后续 Decision 确认");
        document.querySelector('#compositionDecisionRoot [data-decision-ui-intent="confirm"]:not(:disabled)')?.click();
        await waitFor(() => {
          const next = window.SetiRandomizer.inspect();
          return next.projection.source.phase !== "awaiting_input"
            || next.projection.decision?.decisionId !== decisionId;
        }, "主行动后续 Decision 推进");
      }
      await waitFor(() => {
        const token = document.querySelector("#token-layer .browser-projection-token");
        return Boolean(
          token
          && token.src.includes("/assets/tokens/rocket-")
          && token.style.left.endsWith("%")
          && token.style.top.endsWith("%"),
        );
      }, "发射结果由 BrowserProjection 渲染为太阳系火箭");
      await waitFor(() => {
        const button = document.querySelector("#action-confirm-button");
        return Boolean(button && !button.disabled && button.dataset.actionId);
      }, "人类 end_turn descriptor 就绪");
      const endTurnSequence = window.SetiRandomizer.inspect().input.submissionSequence;
      const machineSubmissionCount = window.SetiRandomizer.inspect().machinePlayer.submittedCount || 0;
      document.querySelector("#action-confirm-button").click();
      await waitFor(() => {
        const next = window.SetiRandomizer.inspect();
        return next.input.submissionSequence > endTurnSequence
          && next.input.lastResult?.kind === "action";
      }, "人类 end_turn 进入 Standard Action input port");
      try {
        await waitFor(() => (
          (window.SetiRandomizer.inspect().machinePlayer.submittedCount || 0)
            > machineSubmissionCount
        ), "机器席位经协调器提交标准输入", 20000);
      } catch (error) {
        throw new Error(error.message + " " + JSON.stringify(
          window.SetiRandomizer.inspect().machinePlayer,
        ));
      }
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
      window.__setiFullParitySmoke = { ok: true, required, humanActions: ["quick_trade", "launch", "end_turn"] };
    })()`,
    successExpression: "window.__setiFullParitySmoke?.ok === true",
    obligation: "真实 index.html 覆盖 viewer 隐私、完整页面 renderer、人类主/快/回合动作、机器席位标准输入、多步 Decision、保存恢复和 renderer 异常隔离",
    counterexample: "极简壳、空 renderer、Browser 机器席位未接协调器、canonical root 泄漏、缺失真实 UI 或 renderer 抛错污染规则状态",
  }),
  Object.freeze({
    id: "production-action-log-and-card-viewer",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button'))",
    actionExpression: `(async () => {
      document.querySelector("#start-screen-start-button").click();
      const waitFor = async (predicate, label, timeout = 12000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      await waitFor(() => Boolean(document.querySelector(".initial-selection-card-button")), "初始选择");
      const logRows = document.querySelectorAll("#action-log-list .action-log-row").length;
      if (logRows < 1) throw new Error("行动日志为空");
      const publicCard = document.querySelector("#public-card-row .public-card");
      if (!publicCard) throw new Error("无公共牌");
      publicCard.click();
      await waitFor(() => (
        document.querySelector("#cardViewer")?.hidden === false
        && (document.querySelector("#cardViewerImage")?.src || "").includes("/assets/cards/")
      ), "卡牌查看器放大");
      document.querySelector("#cardViewer").click();
      await waitFor(() => document.querySelector("#cardViewer")?.hidden === true, "卡牌查看器关闭");
      window.__setiLogViewerSmoke = { ok: true, logRows };
    })()`,
    successExpression: "window.__setiLogViewerSmoke?.ok === true",
    obligation: "行动日志记录每个已确认输入且公共牌可点击放大查看",
    counterexample: "日志面板为空或公共牌点击无放大/放大后无法关闭",
  }),
  Object.freeze({
    id: "production-quick-move-button",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#action-quick-button'))",
    actionExpression: `(() => {
      const btn = document.querySelector('[data-quick-trade="energy-for-move"]');
      if (!btn) throw new Error("缺少能量移动按钮");
      if (btn.getAttribute("aria-label") !== "1能量移动1步") {
        throw new Error("能量移动按钮文案错误: " + btn.getAttribute("aria-label"));
      }
      const placeBtn = document.querySelector('[data-quick-action="place_data"]');
      if (!placeBtn) throw new Error("快速面板缺少放置数据按钮");
      if (document.querySelector('#action-place-data-button')) {
        throw new Error("放置数据不应占用主行动栏");
      }
      window.__setiQuickMoveSmoke = { ok: true, hasButton: true, hasPlaceData: true };
    })()`,
    successExpression: "window.__setiQuickMoveSmoke?.ok === true",
    obligation: "快速面板渲染 1 能量移动 1 步（energy-for-move）按钮",
    counterexample: "能量移动按钮缺失或文案错误",
  }),
  Object.freeze({
    id: "production-solar-preview",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#action-quick-button'))",
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
      await waitFor(() => document.querySelector("#start-screen")?.hidden === true, "开始游戏");
      const button = document.querySelector('#solar-preview-button');
      if (!button) throw new Error("缺少太阳系预览按钮");
      const panel = document.querySelector('#solar-preview-panel');
      if (!panel) throw new Error("缺少太阳系预览面板");
      if (panel.hidden !== true) throw new Error("预览面板初始应隐藏");
      button.click();
      if (panel.hidden !== false) throw new Error("点击后预览面板应显示");
      const rows = document.querySelectorAll('#solar-preview-body .solar-preview-row');
      const inspected = window.SetiRandomizer?.inspect?.()?.projection || null;
      const rotation = inspected?.resident?.solar?.rotation
        ?? inspected?.solarSystem?.rotation
        ?? null;
      const residentKeys = inspected?.resident ? Object.keys(inspected.resident) : [];
      if (rows.length < 2) {
        throw new Error("预览应显示当前+未来至少 2 行轮盘，实际 rows=" + rows.length
          + " rotation=" + JSON.stringify(rotation || null)
          + " residentKeys=" + JSON.stringify(residentKeys));
      }
      const firstRow = rows[0].textContent;
      if (!firstRow.includes("当前") || !firstRow.includes("轮1")) {
        throw new Error("预览首行应标记当前并含轮盘: " + firstRow);
      }
      document.querySelector('#solar-preview-close').click();
      if (panel.hidden !== true) throw new Error("关闭按钮应隐藏预览面板");
      window.__setiSolarPreviewSmoke = { ok: true, rows: rows.length, firstRow };
    })()`,
    successExpression: "window.__setiSolarPreviewSmoke?.ok === true",
    obligation: "太阳系转动预览按钮可展开/收起面板并显示当前与未来轮盘角度",
    counterexample: "预览按钮/面板缺失，或点击后未显示轮盘数据、关闭无效",
  }),
  Object.freeze({
    id: "production-replay-steps-recorded",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-screen-start-button'))",
    actionExpression: `(async () => {
      const waitFor = async (predicate, label, timeout = 15000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("等待超时: " + label);
      };
      document.querySelector("#start-screen-start-button").click();
      await waitFor(() => Boolean(document.querySelector(".initial-selection-card-button")), "初始选择");
      // 通过 capture() 拿 committedState，验证浏览器内核能提供 players/turn 摘要数据
      const cap = window.SetiRandomizer.capture();
      if (!cap || cap.ok !== true || !cap.envelope || !cap.envelope.rules) {
        throw new Error("capture 失败: " + JSON.stringify(cap).slice(0, 200));
      }
      const rulesEnv = cap.envelope.rules.envelope;
      if (!rulesEnv || !rulesEnv.committedState) {
        throw new Error("capture 缺少 rules.envelope.committedState");
      }
      const st = JSON.parse(rulesEnv.committedState);
      const players = st && st.players && st.players.players;
      if (!players || !Array.isArray(players) || players.length < 4) {
        throw new Error("committedState 缺少 players.players: " + JSON.stringify(st && Object.keys(st)));
      }
      const turn = st && st.turn;
      if (!turn || turn.roundNumber == null) {
        throw new Error("committedState 缺少 turn.roundNumber");
      }
      const white = players.find((p) => p.id === "player-white" || p.playerId === "player-white");
      if (!white || !white.resources) {
        throw new Error("committedState 缺少 white.resources");
      }
      return true;
    })`,
    successExpression: "Boolean(window.SetiRandomizer)",
    obligation: "浏览器内核 lifecycle.save 的 committedState 必须能提供 players/turn/resources（replaySteps after 摘要的状态源）",
    counterexample: "committedState 结构变化导致 after 摘要无法生成",
  }),
]);
