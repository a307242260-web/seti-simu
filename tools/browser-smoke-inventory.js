"use strict";

const smokes = [
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
        // 同步机器决策可能占满事件循环；功能检查报错前再读一次已完成的正式事实。
        // 这不是推理耗时验收，单局/单决策速度仍由独立基准判定。
        if (predicate()) return;
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
      // 本场景先验2钱换电，再通过真实UI补回发射缺口；不依赖初始资源额外送钱。
      const creditSequence = window.SetiRandomizer.inspect().input.submissionSequence;
      if (document.querySelector("#action-quick-button")?.getAttribute("aria-expanded") !== "true") {
        document.querySelector("#action-quick-button")?.click();
      }
      await waitFor(() => Boolean(document.querySelector(
        '[data-quick-trade="energy-for-credit"]:not(:disabled)[data-action-id]',
      )), "发射前换回信用点");
      document.querySelector('[data-quick-trade="energy-for-credit"]:not(:disabled)[data-action-id]').click();
      await waitFor(() => {
        const next = window.SetiRandomizer.inspect();
        return next.input.submissionSequence > creditSequence
          && next.input.lastResult?.kind === "action" && next.projection.source.phase === "idle";
      }, "补资源快速行动进入Standard Action端口");
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
        const machine = window.SetiRandomizer.inspect().machinePlayer;
        throw new Error(error.message + " " + JSON.stringify({ generation: machine.generation,
          submittedCount: machine.submittedCount, previousSubmissionCount: machineSubmissionCount, seatId: machine.seatId,
          lastResult: { ok: machine.lastResult?.ok, code: machine.lastResult?.code,
            message: machine.lastResult?.message, actionId: machine.lastResult?.actionId } }));
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
];

module.exports = Object.freeze([...smokes, Object.freeze({
  id: "production-search-agent-entry",
  file: "randomizer/index.html",
  query: "agent=search",
  readyExpression: "Boolean(window.SetiRandomizer && window.SetiSearchAgent && window.SetiAnalysisPort)",
  actionExpression: `(async () => {
    const waitFor = async (predicate, label) => {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(label + ": " + JSON.stringify(window.SetiRandomizer.inspect().machinePlayer));
    };
    document.querySelector('#start-screen-start-button').click();
    const clickChoice = async predicate => {
      const find = () => [...document.querySelectorAll(
        '#compositionDecisionRoot [data-decision-ui-intent="submit-choice"]:not(:disabled)',
      )].find(predicate);
      await waitFor(() => Boolean(find()), "人类初始选择");
      const before = window.SetiRandomizer.inspect().projection.decision?.decisionId;
      find().click();
      await waitFor(() => window.SetiRandomizer.inspect().projection.decision?.decisionId !== before, "确认选择");
    };
    await clickChoice(button => Boolean(button.querySelector('.decision-ui-card-image-industry')));
    for (let count = 0; count < 2; count += 1) await clickChoice(button =>
      Boolean(button.querySelector('.decision-ui-card-image-initial')) && button.getAttribute('aria-pressed') !== 'true');
    await clickChoice(button => button.textContent === '确认初始选择');
    const completed = () => {
      const machine = window.SetiRandomizer.inspect().machinePlayer;
      return machine.submittedCount > 0 && machine.lastResult?.agentTrace?.policy.type === 'search'
        && machine.lastResult.agentTrace.coverage === 'complete';
    };
    await waitFor(completed, "搜索玩家真实提交");
    const first = window.SetiRandomizer.inspect().machinePlayer;
    for (const [key,value] of Object.entries(window.SetiSearchAgent.BUDGET)) {
      if (first.lastResult.searches[0].diagnostics.limits[key] !== value) throw new Error("搜索宿主未使用共享预算: " + key);
    }
    if (first.lastResult.agentTrace.search.selectionContinuation !== undefined
      || first.lastResult.agentTrace.search.planContinuation !== undefined
      || !first.lastResult.searches?.length) throw new Error("搜索证据丢失或泄漏临时token");
    const capture = window.SetiRandomizer.capture();
    if (!capture.ok) throw new Error("搜索后保存失败");
    const restored = window.SetiRandomizer.restore(capture.envelope);
    if (!restored.ok) throw new Error("搜索后恢复失败: " + JSON.stringify(restored));
    if (window.SetiRandomizer.inspect().machinePlayer.generation <= first.generation) throw new Error("恢复未清空算法状态");
    await waitFor(completed, "恢复后共享搜索重新决策");
    window.__setiSearchAgentSmoke = { ok: true, firstInputs: first.lastResult.searches[0].diagnostics.transitions,
      restoredInputs: window.SetiRandomizer.inspect().machinePlayer.lastResult.searches[0].diagnostics.transitions,
      wholeGames: 0 };
  })()`,
  successExpression: "window.__setiSearchAgentSmoke?.ok === true",
  obligation: "search URL真实装配共享搜索、完成机器正式输入并在保存恢复后重建算法状态，记录覆盖证据",
  counterexample: "脚本依赖顺序错误、旧AI代选、搜索图被丢弃或恢复仍携带临时计划token",
}), Object.freeze({
  id: "production-goal-movement-plan",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiGoalMovement && window.SetiAnalysisPort && window.SetiProductionKernel?.comparePlannedMovementTiming)",
  actionExpression: `(async () => {
    const f = await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json').then(r=>r.json());
    const seed=f.source.seed;
    const kernel=window.SetiProductionKernel.createSimulationRuleComposition({seed,
      random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
      projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});
    kernel.newGame({seed});const comp=kernel.composition;
    if(!comp.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('目标计划恢复失败');
    const play=comp.inputPort.enumerateActions({}).find(a=>a.family==='play_card'&&a.target?.cardInstanceId==='card-40-0');
    if(!comp.inputPort.submitAction(play).ok)throw new Error('目标计划打牌失败');
    const before=JSON.stringify(comp.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition:comp,seatId:f.seatId});
    try{const root=port.openRoot(),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId);
      const r=window.SetiDecisionSearch.searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,
        ...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:1500}});
      if(!r.complete||!r.actionId||!r.candidates.some(c=>c.kind==='goal-plan'))throw new Error('未生成完整目标计划');
      if(!r.lines.some(l=>l.edges.some(e=>e.goalPlan?.objective?.movementTiming)))throw new Error('缺少转盘时机比较');
      if(JSON.stringify(comp.lifecycle.save().envelope)!==before)throw new Error('计划试算污染真实状态');
      window.__setiGoalMovementSmoke={ok:true,inputs:r.diagnostics.transitions,wholeGames:0};
    }finally{port.close();comp.dispose();}
  })()`,
  successExpression: "window.__setiGoalMovementSmoke?.ok === true",
  obligation: "真实页面加载目标计划模块及延迟Production查询，执行DLC40目标路线与转盘对照，权威根不变",
  counterexample: "脚本装配缺失、只在Node能查询路线、浏览器仍方向展开或试算污染正式状态",
}), Object.freeze({
  id: "production-fixed-card-pick-plan",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiCardPickPlanning && window.SetiSearchAgent && window.SetiProductionKernel)",
  actionExpression: `(async () => {
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json').then(r=>r.json()),seed=f.source.seed;
    const kernel=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});
    kernel.newGame({seed});const comp=kernel.composition;
    if(!comp.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('固定选牌恢复失败');
    const start=comp.inputPort.enumerateActions({}).find(a=>a.target?.tradeId==='cards-for-pick-card');
    if(!comp.inputPort.submitQuickAction(start).ok)throw new Error('固定选牌启动失败');
    const before=JSON.stringify(comp.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition:comp,seatId:f.seatId});
    try{const root=port.openRoot(),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId);
      const r=window.SetiDecisionSearch.searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:1500}});
      if(!r.complete||r.candidates.length!==1||r.candidates[0].kind!=='fixed-card-plan'||r.diagnostics.transitions!==4||r.diagnostics.graphNodes!==2)throw new Error('选牌仍产生搜索分支或漏记原生输入');
      if(JSON.stringify(comp.lifecycle.save().envelope)!==before)throw new Error('固定选牌试算污染真实状态');
      window.__fixedCardPickSmoke={ok:true,inputs:r.diagnostics.transitions,graphNodes:r.diagnostics.graphNodes,cache:port.getDiagnostics().cardPick};
    }finally{port.close();comp.dispose();}
  })()`,
  successExpression: "window.__fixedCardPickSmoke?.ok === true",
  obligation: "真实页面将两张牌付款和精选折为固定计划，4次原生输入、2个图节点，权威状态不变",
  counterexample: "缺失脚本装配、逐卡分支、固定付款未记录回放或试算污染正式状态",
}), Object.freeze({
  id: "production-local-final-mark",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiLocalDecisionPlans && window.SetiAnalysisPort)",
  actionExpression: `(async () => {
    const f=await fetch('/adhoc/fixed-decision-final-mark-20261028-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('标记测试恢复失败');
    const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot(),r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:1500}});
      if(!r.complete||r.lines[0].decisionPolicy.scores.length!==4||r.lines[0].edges.length!==1||r.roots.filter(a=>a.completion==='excluded-by-local-decision-policy').length!==3)throw new Error('标记仍四路展开');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error('标记试算改变真实根');window.__localFinalMarkSmoke={ok:true,options:4,expanded:1};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__localFinalMarkSmoke?.ok === true",
  obligation: "真实页面按原生终局公式评分四个落点，只扩展固定标记，权威根不变",
  counterexample: "脚本依赖缺失、标记仍分四路、分数与原生公式不符或修改真实状态",
}), Object.freeze({
  id: "production-scan-purpose-plan",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiLocalDecisionPlans && window.SetiScienceSession?.listHandScanChoices)",
  actionExpression: `(async () => {
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('扫描目的恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{p.setResourcePlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});const root=p.openRoot(),spec=p.resourceSpec(root),plans=spec.plans.filter(p=>p.goal.kind==='scan-flow');if(plans.length<2)throw new Error('扫描丢失可达目的');
      for(const plan of plans){const r=p.expandResourcePlan(root,plan,()=>null);if(!r.complete||!r.preparations.some(p=>p.reason==='fixed-scan-card-and-sector'))throw new Error('扫描没有固定牌和扇区');}
      if(p.getDiagnostics().stableRestoreSkips<1||JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error('固定链执行或根隔离失效');window.__scanPurposeSmoke={ok:true,purposes:plans.length};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__scanPurposeSmoke?.ok === true",
  obligation: "真实页面保留已知可达扫描目的，每个目的按固定牌/扇区执行，稳定边界省恢复且权威根不变",
  counterexample: "扫描仍牌序组合展开、丢失所有目的、跨冻结Session跳过必要恢复或污染真实根",
}), Object.freeze({
  id: "production-search-hotpath",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiProductionKernel?.plannedMovementTimingKey && window.SetiAnalysisPort)",
  actionExpression: `(async () => {
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('热路径恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot(),obs=JSON.stringify(root.observation),r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:1500}});
      if(!r.complete||r.unresolved.length||p.getDiagnostics().movementTimingCacheHits<1)throw new Error('热路径未完整复用');
      if(!Object.isFrozen(root.observation.publicState)||JSON.stringify(root.observation)!==obs||JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error('观察复用污染根或只读事实');
      window.__searchHotpathSmoke={ok:true,inputs:r.diagnostics.nativeExecutions,timingHits:p.getDiagnostics().movementTimingCacheHits};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__searchHotpathSmoke?.ok === true",
  obligation: "真实页面完整闭合第3轮决策并复用移动几何时机，全部观察和权威状态保持只读",
  counterexample: "依赖键未装配、资源变化导致重复几何推演、冻结观察复用后根/RNG被污染",
}), Object.freeze({
  id: "production-six-greedy-plans",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiLocalDecisionPlans?.pureOptional && window.SetiResidualDomainSession?.queryCardSettlement)",
  actionExpression: `(async () => {
    const fixtures=await fetch('/adhoc/six-greedy-plan-fixtures-20261028-v1.json').then(r=>r.json());
    const rootFixture=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json').then(r=>r.json());
    const funding=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-047-20261030-v1.json').then(r=>r.json());
    const fundingPick=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-046-20261030-v1.json').then(r=>r.json());
    const knownRewards=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-040-20261030-v1.json').then(r=>r.json());
    for(const [name,f] of [...Object.entries(fixtures.cases),['paid',rootFixture],['income-funding',funding],['income-funding-pick',fundingPick],['known-rewards',knownRewards]]){
      const seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('固定计划恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
      try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});const n=p.openRoot();
        if(name==='advance'){const r=window.SetiDecisionSearch.searchDecision({port:p,root:n,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:1500}});if(!r.complete||!r.lines[0].movementPolicy?.forceExecution||r.lines[0].alternatives!==1)throw new Error('移动时机重新分叉');}
        else if(name==='income'){const s=p.resourceSpec(n);if(s.incomeTail?.selected!==false||s.plans.some(g=>g.goal.kind==='income'))throw new Error('无净收益收入仍展开');}
        else if(name==='paid'){const plans=p.resourceSpec(n).plans.filter(g=>g.goal.paidRewardPolicy);if(plans.length!==1)throw new Error('付款额度仍枚举');const r=p.expandResourcePlan(n,plans[0],()=>null);if(!r.complete||r.prefixes.filter(p=>p.action.target?.pay).length!==4)throw new Error('付款计划未固定');}
        else if(name==='income-funding'){const plan=p.resourceSpec(n).plans.find(p=>p.goal.cardId==='card-15-0'&&p.goal.incomeFunding);if(!plan)throw new Error('收入资助主牌候选缺失');const r=p.expandResourcePlan(n,plan,()=>null);if(!r.complete||r.submissions!==10||r.prefixes[8].action.target.cardInstanceId!=='card-41-0'||r.prefixes[9].action.target.cardInstanceId!=='card-15-0')throw new Error('收入资助链丢失受益牌');}
        else if(name==='income-funding-pick'){const s=p.cardPickSpec(n);if(s?.goal.fundsCardId!=='card-15-0'||s.selection.cardId!=='card-41-0')throw new Error('浏览器收入选牌未绑定资金目的');const r=p.expandWithCardPick(n,s.selectedActionId,()=>null);if(!r.complete)throw new Error('浏览器收入选牌执行失败');}
        else if(name==='known-rewards'){const picked=p.expand(n,f.source.teacherActionId);if(picked.status!=='decision')throw new Error('公共补牌截断已知奖励');const scan=picked.legalActions.find(a=>a.target.nebulaId==='sector-4-b'),scanned=scan&&p.expand(picked,scan.actionId),income=scanned?.legalActions.find(a=>a.target.cardInstanceId==='card-40-0');if(!income)throw new Error('已知扫描后收入丢失');const done=p.expand(scanned,income.actionId);if(done.status!=='stable'||window.SetiStateValue.evaluateStateValue(done.observation,f.seatId).total!==43.5||!done.observation.publicState.board.publicCards.some(c=>c?.hidden))throw new Error('已知奖励结算或遮蔽错误');const valueView=p.valueObservation(done);if(JSON.stringify(valueView.publicState)!==JSON.stringify(done.observation.publicState)||JSON.stringify(valueView.selfState)!==JSON.stringify(done.observation.selfState))throw new Error('估值投影改变正式事实');const tail=window.SetiDecisionSearch.searchDecision({port:p,root:done,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:1500}});if(!tail.complete||tail.value!==47||tail.diagnostics.transitions!==0||tail.diagnostics.provedIncomeInputs!==9||!tail.lines.some(l=>l.status==='income-plan-value'&&l.planSummary?.successorEnvelopeAvailable===false))throw new Error('已知尾部证明错误或仍重复模拟');}
        else{const s=p.localDecisionSpec(n),want=name==='blue'?10:1;if(!s||s.retainedActionIds.length!==want)throw new Error(name+'仍产生多余候选');if(name!=='blue'){const r=p.expandWithCardPick(n,s.selectedActionId,()=>null);if(!r.complete)throw new Error(name+'固定执行失败');}}
        if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error(name+'污染真实根');
      }finally{p.close();c.dispose();}
    }
    window.__sixGreedyPlansSmoke={ok:true,stages:6,incomeFunding:true,knownRewards:true};
  })()`,
  successExpression: "window.__sixGreedyPlansSmoke?.ok === true",
  obligation: "真实页面六类贪心计划均收束候选且通过原生执行，保存与真实根隔离",
  counterexample: "脚本导出缺失、付停或移动时机重开分支、PASS/蓝槽组合恢复或试算污染真实根",
}), Object.freeze({
  id: "production-shared-resource-prefix",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiAnalysisPort && window.SetiResourceDemand)",
  actionExpression: `(async () => {
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});
    k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('共享前缀恢复失败');
    const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot(),port={...p,resourceSpec(n){const s=p.resourceSpec(n);return n===root?{...s,retainedActionIds:[],plans:s.plans.filter(x=>x.goal.kind==='research_tech')}:s;}};
      const r=window.SetiDecisionSearch.searchDecision({port,root,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),resourcePlanning:true,budget:{transitions:18,nodes:19,frontier:256,milliseconds:1500}});
      if(!r.complete||r.lines[0].edges.length!==11||r.diagnostics.transitions!==18||r.diagnostics.nodes!==19||r.diagnostics.logicalResourceInputs!==88||r.diagnostics.sharedResourceInputHits!==70||p.getDiagnostics().submissionCount!==18)throw new Error('共享前缀重复执行/预算计费');
      if(r.lines[0].edges.some(e=>e.cost!==8||e.sharedPath.length!==8))throw new Error('共享改变真实执行长度');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error('共享前缀改变真实根');
      window.__sharedResourcePrefixSmoke={ok:true,goals:11,inputs:18,states:19,reused:70};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__sharedResourcePrefixSmoke?.ok === true",
  obligation: "真实页面11种科技目标共享7步原生前缀，18输入/19状态通过，保留每个目标8步路径及权威状态",
  counterexample: "页面未加载新版分析端口、复用后仍重复计费、科技种类被丢弃或试算污染根/RNG",
}), Object.freeze({
  id: "production-resource-goal-plan",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiResourceDemand && window.SetiProductionKernel?.getResourceGoalRequirements)",
  actionExpression: `(async () => {
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});
    k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('资源准备恢复失败');
    const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId});
    try{p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),spec=p.resourceSpec(root),goal=spec.plans.find(x=>x.goal.kind==='income');
      if(!goal||root.legalActions.filter(window.SetiResourceDemand.isPreparation).some(a=>spec.retainedActionIds.includes(a.actionId)))throw new Error('资源准备仍是独立搜索动作');
      const r=p.expandResourcePlan(root,goal,()=>null);if(!r.complete||r.goalStatus!=='completed'||r.submissions!==9)throw new Error('目标资源链未完整执行');
      const borrow=root.legalActions.find(a=>a.target?.abilityId==='turing_borrow_tech');if(borrow&&spec.retainedActionIds.includes(borrow.actionId))throw new Error('生产仍可发起借科技');
      const income=r.prefixes.find(p=>p.node.legalActions.every(a=>a.target?.choiceId?.startsWith('income:')));if(!income)throw new Error('缺少真实收入选择');
      const fixed=p.localDecisionSpec(income.node);if(fixed?.kind!=='fixed-data-choice'||fixed.retainedActionIds.length!==1)throw new Error('收入仍参与多路搜索');
      const tail=p.expandWithCardPick(income.node,fixed.selectedActionId,()=>null);if(!tail.complete||tail.fixedChoices.filter(c=>c.kind==='fixed-data-choice').length!==1)throw new Error('收入未作为固定计划执行');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error('资源试算改变真实根');
      window.__resourceGoalSmoke={ok:true,inputs:r.submissions,goal:goal.goal.id};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__resourceGoalSmoke?.ok === true",
  obligation: "真实页面按收入数据需求固定准备流程，原生输入逐笔计数且权威状态不变",
  counterexample: "模块装配丢失、兑换或角标独立展开、缺少需求仍准备、宏漏记输入或修改权威根",
}), Object.freeze({
  ...smokes.find(smoke => smoke.id === "production-browser-full-parity"),
  id: "production-completion-agent-parity",
  file: "randomizer/index.html",
  query: "agent=completion",
  obligation: "新completion AI在真实页面经共享factory完成初始选择、正式提交和保存恢复",
  counterexample: "新AI脚本未装配、绕过协调器提交或恢复后仍复用旧算法状态",
})]);
