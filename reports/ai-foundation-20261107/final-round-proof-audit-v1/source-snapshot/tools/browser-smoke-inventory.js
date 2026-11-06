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
    id: "production-fixed-board-teaching-2",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-fixed-board'))",
    actionExpression: `(async () => {
      const fixed = document.querySelector("#start-fixed-board");
      fixed.value = "seti-teacher-20261104-07";
      if (fixed.selectedOptions[0]?.textContent !== "免电分析教学局2") throw new Error("教学局2名称或选项缺失");
      fixed.dispatchEvent(new Event("change", { bubbles: true }));
      const seed = document.querySelector("#start-seed-input");
      if (!seed.disabled || seed.value !== fixed.value) throw new Error("教学局2未锁定正确种子");
      if (!document.querySelector("#start-record-trajectory").checked) throw new Error("教学局默认轨迹录制未启用");
      document.querySelector("#start-screen-start-button").click();
      const deadline = Date.now() + 12000;
      while (!document.querySelector(".initial-selection-card-button")) {
        if (Date.now() >= deadline) throw new Error("教学局2初始选择未打开");
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const render = window.SetiRandomizer.inspect().projection.resident?.ui?.browserReadModel?.render || {};
      const sectors = (render.boardChrome?.sectors || []).map(e => [Number(e.slotId), Number(e.sectorId)]);
      const faces = (render.cardPanels?.publicCards || []).map(c => String(c.imageSrc || ""));
      if (JSON.stringify(sectors) !== JSON.stringify([[1,1],[2,2],[3,4],[4,3]])
        || !["b_135.webp","b_15.webp","b_39.webp"].every(f => faces.some(src => src.endsWith(f)))) throw new Error("教学局2盘面与原生种子不一致");
      const companies = [...document.querySelectorAll("#compositionDecisionRoot .decision-ui-card-image-industry")].map(img => img.alt);
      if (!["深空探测","芬威克研究中心"].every(name => companies.some(c => c.includes(name)))) throw new Error("教学局2白席公司不一致");
      window.__setiTeaching2Smoke = { ok: true };
    })()`,
    successExpression: "window.__setiTeaching2Smoke?.ok === true",
    obligation: "选择直观名称免电分析教学局2，以已验证的新种子打开四人盘面并提供深空探测，默认录制轨迹",
    counterexample: "只改显示名却仍使用旧种子、不能选到免电分析，或新教学局盘面无法复现",
  }),
  Object.freeze({
    id: "production-fixed-board-teaching-3",
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-fixed-board'))",
    actionExpression: `(async () => {
      const fixed = document.querySelector("#start-fixed-board"), seed = document.querySelector("#start-seed-input");
      fixed.value = "seti-teaching-437b8c7956";
      if (fixed.selectedOptions[0]?.textContent !== "免电分析教学局3") throw new Error("教学局3入口缺失");
      fixed.dispatchEvent(new Event("change", { bubbles: true }));
      if (!seed.disabled || seed.value !== fixed.value) throw new Error("教学局3种子未绑定");
      if (!document.querySelector("#start-record-trajectory").checked) throw new Error("教学局未启用轨迹录制");
      document.querySelector("#start-screen-start-button").click();
      const deadline = Date.now() + 12000;
      while (!document.querySelector(".initial-selection-card-button")) {
        if (Date.now() >= deadline) throw new Error("教学局3未进入初始选择");
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const companies = [...document.querySelectorAll("#compositionDecisionRoot .decision-ui-card-image-industry")].map(img => img.alt);
      if (!["深空探测","层云核心"].every(name => companies.some(c => c.includes(name)))) throw new Error("教学局3白席公司不一致");
      window.__setiTeaching3Smoke = { ok: true };
    })()`,
    successExpression: "window.__setiTeaching3Smoke?.ok === true",
    obligation: "随机教学局3按名称打开独立种子，白席能选免电分析且默认录制轨迹",
    counterexample: "菜单复用教学局2的种子、没有免电公司或关闭了轨迹录制",
  }),
  ...[{"name":"免电分析随机盘面01","seed":"seti-analyze-a2d78cbc07cf","companies":["深空探测","图灵系统"],"publicCards":["b_63.webp","b_43.webp","b_136.webp"],"number":1},{"name":"免电分析随机盘面02","seed":"seti-analyze-9a90ce3372d6","companies":["芬威克研究中心","深空探测"],"publicCards":["b_4.webp","b_38.webp","b_82.webp"],"number":2},{"name":"免电分析随机盘面03","seed":"seti-analyze-702b3104145a","companies":["哨兵探测网络","深空探测"],"publicCards":["b_16.webp","dlc_26.png","b_17.webp"],"number":3},{"name":"免电分析随机盘面04","seed":"seti-analyze-bef76f5fe6ae","companies":["深空探测","哨兵探测网络"],"publicCards":["b_10.webp","b_21.webp","b_8.webp"],"number":4},{"name":"免电分析随机盘面05","seed":"seti-analyze-5001578c1141","companies":["宇宙战略集团","深空探测"],"publicCards":["b_27.webp","b_98.webp","b_115.webp"],"number":5},{"name":"免电分析随机盘面06","seed":"seti-analyze-421f46598209","companies":["深空探测","寰宇动力"],"publicCards":["b_3.webp","b_91.webp","b_66.webp"],"number":6},{"name":"免电分析随机盘面07","seed":"seti-analyze-a4886c19154b","companies":["图灵系统","深空探测"],"publicCards":["b_107.webp","b_108.webp","dlc_1.png"],"number":7},{"name":"免电分析随机盘面08","seed":"seti-analyze-9c11af934643","companies":["深空探测","芬威克研究中心"],"publicCards":["b_72.webp","dlc_23.png","b_132.webp"],"number":8},{"name":"免电分析随机盘面09","seed":"seti-analyze-24169115909d","companies":["深空探测","异星实验室"],"publicCards":["b_45.webp","b_97.webp","b_123.webp"],"number":9},{"name":"免电分析随机盘面10","seed":"seti-analyze-2ec4582df1f6","companies":["任务中继站","深空探测"],"publicCards":["b_35.webp","b_69.webp","b_115.webp"],"number":10},{"name":"免电分析随机盘面11","seed":"seti-analyze-8cf6f23cc7c1","companies":["深空探测","未来跨度研究所"],"publicCards":["b_74.webp","b_7.webp","b_137.webp"],"number":11},{"name":"免电分析随机盘面12","seed":"seti-analyze-bd83842179ca","companies":["深空探测","未来跨度研究所"],"publicCards":["b_28.webp","b_10.webp","b_43.webp"],"number":12},{"name":"免电分析随机盘面13","seed":"seti-analyze-5c5ff536a8da","companies":["深空探测","宇宙战略集团"],"publicCards":["b_113.webp","b_49.webp","dlc_30.png"],"number":13},{"name":"免电分析随机盘面14","seed":"seti-analyze-ed3824aaebd6","companies":["图灵系统","深空探测"],"publicCards":["dlc_24.png","dlc_26.png","dlc_8.png"],"number":14},{"name":"免电分析随机盘面15","seed":"seti-analyze-3cf8ee390c56","companies":["深空探测","异星实验室"],"publicCards":["b_112.webp","b_121.webp","b_126.webp"],"number":15},{"name":"免电分析随机盘面16","seed":"seti-analyze-92c262b1b98c","companies":["深空探测","未来跨度研究所"],"publicCards":["b_14.webp","b_24.webp","dlc_36.png"],"number":16},{"name":"免电分析随机盘面17","seed":"seti-analyze-8c7ca70c141f","companies":["深空探测","哨兵探测网络"],"publicCards":["b_81.webp","b_63.webp","b_51.webp"],"number":17},{"name":"免电分析随机盘面18","seed":"seti-analyze-1466261ceeec","companies":["深空探测","哨兵探测网络"],"publicCards":["dlc_37.png","dlc_1.png","b_28.webp"],"number":18},{"name":"免电分析随机盘面19","seed":"seti-analyze-f54bea5e6f9c","companies":["任务中继站","深空探测"],"publicCards":["b_8.webp","b_127.webp","b_30.webp"],"number":19},{"name":"免电分析随机盘面20","seed":"seti-analyze-6b38bd2b8e98","companies":["未来跨度研究所","深空探测"],"publicCards":["b_9.webp","b_32.webp","b_88.webp"],"number":20}].map(board => Object.freeze({
    id: "production-fixed-board-random20-" + String(board.number).padStart(2, "0"),
    file: "randomizer/index.html",
    readyExpression: "Boolean(window.SetiRandomizer && document.querySelector('#start-fixed-board'))",
    actionExpression: `(async () => {
      const board = ${JSON.stringify(board)}, fixed = document.querySelector("#start-fixed-board"), seed = document.querySelector("#start-seed-input");
      const group = [...fixed.querySelectorAll("optgroup")].find(g => g.label === "免电分析随机盘面（20局）");
      if (!group || group.children.length !== 20 || new Set([...group.children].map(o => o.value)).size !== 20) throw new Error("随机盘面必须恰有20个独立入口");
      fixed.value = board.seed;
      if (fixed.selectedOptions[0]?.textContent !== board.name) throw new Error("随机盘面名称或种子不匹配");
      fixed.dispatchEvent(new Event("change", { bubbles: true }));
      if (!seed.disabled || seed.value !== board.seed) throw new Error("随机盘面种子未绑定");
      if (!document.querySelector("#start-record-trajectory").checked) throw new Error("随机盘面默认轨迹录制未启用");
      document.querySelector("#start-screen-start-button").click();
      const deadline = Date.now() + 12000;
      while (!document.querySelector(".initial-selection-card-button")) {
        if (Date.now() >= deadline) throw new Error("随机盘面未进入初始选择");
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const companies = [...document.querySelectorAll("#compositionDecisionRoot .decision-ui-card-image-industry")].map(img => img.alt);
      if (!board.companies.every(name => companies.some(c => c.includes(name))) || !companies.some(c => c.includes("深空探测"))) throw new Error("随机盘面白席公司与原生种子不一致");
      const render = window.SetiRandomizer.inspect().projection.resident?.ui?.browserReadModel?.render || {};
      const faces = (render.cardPanels?.publicCards || []).map(c => String(c.imageSrc || ""));
      if (!board.publicCards.every(f => faces.some(src => src.endsWith(f)))) throw new Error("随机盘面公共牌与原生种子不一致");
      window.__setiRandom20Smoke = { ok: true };
    })()`,
    successExpression: "window.__setiRandom20Smoke?.ok === true",
    obligation: "随机盘面按名称进入唯一原生种子，白席可选免电分析、公共牌一致且默认录制轨迹",
    counterexample: "随机编号串种子、免电公司缺失或浏览器随机世界与原生开局不一致",
  })),
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
  ...smokes.find(smoke => smoke.id === "production-browser-full-parity"),
  id: "production-browser-full-parity-search", query: "agent=search",
  obligation: "V2共享搜索在实际整页完成初始化、动作提交、机器协调和保存恢复；复用同一整页断言",
  counterexample: "只在默认旧启发式路径验证整页，V2宿主主行动后未提交或恢复失败",
}), Object.freeze({
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
    try{const proof=await fetch('/reports/ai-foundation-20261023/requested-owner-native-land-cost-counterexample-20261031-v1.json').then(r=>r.json());
      for(const [seat,expected] of [[proof.requestedOwner,proof.after],['player-blue',proof.before],[proof.requestedOwner,proof.after]]){
        const quotes=Object.fromEntries(c.projection({role:'player',playerId:seat}).state.probeRouteRequirements.candidates.filter(g=>g.endpointFamily==='land'&&g.endpointTarget.type==='planet').map(g=>[g.planetId,g.endpointFacts.cost.energy]));
        if(Object.keys(expected).some(id=>quotes[id]!==expected[id]))throw Error('登陆费用未按请求席位计算或跨viewer缓存串用');
      }
      // Typed value boundaries consume graph nodes without executing inputs.
      // Keep the 256 native-input gate; graph capacity is a separate guard.
      const root=p.openRoot(),obs=JSON.stringify(root.observation),r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:1500}});
      if(!r.complete||r.unresolved.length||p.getDiagnostics().movementTimingCacheHits<1)throw new Error('热路径未完整复用 '+JSON.stringify({stopReason:r.stopReason,diagnostics:r.diagnostics,timingHits:p.getDiagnostics().movementTimingCacheHits}));
      if(!Object.isFrozen(root.observation.publicState)||JSON.stringify(root.observation)!==obs||JSON.stringify(c.lifecycle.save().envelope)!==before)throw new Error('观察复用污染根或只读事实');
      if(r.diagnostics.nativeExecutions>256)throw new Error('超过256次原生输入');
      window.__searchHotpathSmoke={ok:true,inputs:r.diagnostics.nativeExecutions,nodes:r.diagnostics.nodes,timingHits:p.getDiagnostics().movementTimingCacheHits};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__searchHotpathSmoke?.ok === true",
  obligation: "真实页面按请求席位计算登陆费用，跨viewer缓存隔离，第3轮决策完整闭合并复用几何时机，权威状态只读",
  counterexample: "误用当前行动者的科技折扣、跨viewer缓存串用、重复几何推演或冻结观察复用污染根/RNG",
}), Object.freeze({
  id: "production-blue-exchange-funding",
  file: "randomizer/index.html",
  readyExpression: "Boolean(window.SetiResourceDemand && window.SetiAnalysisPort)",
  actionExpression: `(async()=>{
    const f=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v165-post-orbit-computer-funding-root-20261105-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('exchange funding root restore');
    const before=c.lifecycle.save().envelope,p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{
      p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),plan=p.resourceSpec(root).plans.find(p=>p.goal.kind==='effect-purpose'&&p.goal.cardId==='card-15-0');
      if(!plan)throw Error('energy blue funding lost the research candidate');const r=p.expandResourcePlan(root,plan,()=>null);
      if(!r.complete||r.submissions!==4||r.prefixes.map(p=>p.action.family).join(',')!=='place_data,choose_target,quick_trade,play_card'||r.prefixes[1].action.target.blueSlot!==1||r.prefixes[2].action.target.tradeId!=='energy-for-credit')throw Error('exchange funding plan differs from native source');
      if(JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(before))throw Error('exchange funding changed the original root');
      const submit=a=>{const d=c.inspect().session?.decision,result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!result.ok)throw Error('exchange funding native rejection');};
      for(const prefix of r.prefixes){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===prefix.action.actionId);if(!a)throw Error('exchange funding stale action');submit(a);}
      const a=c.inspect().session.decision.choices.find(a=>a.target?.tileId==='purple4');if(!a)throw Error('funded research choice missing');submit(a);const player=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id===f.seatId);
      if(!player.techState.ownedTiles.purple4||player.resources.credits!==0||player.resources.energy!==0||player.hand.length)throw Error('exchange funding native endpoint differs');
      if(!c.lifecycle.restore(before).ok||JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(before))throw Error('exchange funding RNG restoration failed');window.__blueExchangeFunding={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression: "window.__blueExchangeFunding?.ok === true",
  obligation: "蓝槽提供的电可以在保留两种支付成本后兑换为钱，真实页面保留免费研究候选并原生兑现及恢复",
  counterexample: "只按奖励同名资源判断筹资、重复使用钱包、未实际执行研究或污染原根RNG",
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
    const blindProof=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-037-20261030-v1.json').then(r=>r.json());
    for(const [name,f] of [...Object.entries(fixtures.cases),['paid',rootFixture],['income-funding',funding],['income-funding-pick',fundingPick],['known-rewards',knownRewards],['blind-income-proof',blindProof]]){
      const seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw new Error('固定计划恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
      try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});const n=p.openRoot();
        if(name==='advance'){const r=window.SetiDecisionSearch.searchDecision({port:p,root:n,evaluate:window.SetiStateValue.createStateValueEvaluator(f.seatId),...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:257,frontier:256,milliseconds:1500}});if(!r.complete||!r.lines[0].movementPolicy?.forceExecution||r.lines[0].alternatives!==1)throw new Error('移动时机重新分叉');}
        else if(name==='income'){const s=p.resourceSpec(n);if(s.incomeTail?.selected!==false||s.plans.some(g=>g.goal.kind==='income'))throw new Error('无净收益收入仍展开');}
        else if(name==='paid'){const plans=p.resourceSpec(n).plans.filter(g=>g.goal.paidRewardPolicy);if(plans.length!==1)throw new Error('付款额度仍枚举');const r=p.expandResourcePlan(n,plans[0],()=>null);if(!r.complete||r.prefixes.filter(p=>p.action.target?.pay).length!==4)throw new Error('付款计划未固定');}
        else if(name==='income-funding'){const plan=p.resourceSpec(n).plans.find(p=>p.goal.cardId==='card-15-0'&&p.goal.incomeFunding);if(!plan)throw new Error('收入资助主牌候选缺失');const r=p.expandResourcePlan(n,plan,()=>null);if(!r.complete||r.submissions!==10||r.prefixes[8].action.target.cardInstanceId!=='card-41-0'||r.prefixes[9].action.target.cardInstanceId!=='card-15-0')throw new Error('收入资助链丢失受益牌');}
        else if(name==='income-funding-pick'){const s=p.cardPickSpec(n);if(s?.goal.kind!=='known-income-swap'||!(s.goal.netGain>0)||s.selection.cardId!=='card-41-0')throw new Error('浏览器收入选牌未绑定已知筹资换牌目的');const r=p.expandWithCardPick(n,s.selectedActionId,()=>null);if(!r.complete)throw new Error('浏览器收入选牌执行失败');}
        else if(name==='known-rewards'){
          const fixed=p.cardPickSpec(n);if(fixed?.goal.kind!=='queued-income'||fixed.goal.fundsCardId!=='card-15-0'||fixed.selection.cardId!=='card-40-0'||fixed.retainedActionIds.length!==1)throw new Error('已承诺收入未传递到固定选牌目的');
          const picked=p.expand(n,f.source.teacherActionId);if(picked.status!=='decision')throw new Error('公共补牌截断已知奖励');
          const scan=picked.legalActions.find(a=>a.target.nebulaId==='sector-4-b'),scanned=scan&&p.expand(picked,scan.actionId),income=scanned?.legalActions.find(a=>a.target.cardInstanceId==='card-40-0');if(!income)throw new Error('已知扫描后收入丢失');
          const done=p.expand(scanned,income.actionId),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId);if(done.status!=='stable'||!done.observation.publicState.board.publicCards.some(c=>c?.hidden))throw new Error('已知奖励结算或遮蔽错误');
          const valueView=p.valueObservation(done);if(JSON.stringify(valueView.publicState)!==JSON.stringify(done.observation.publicState)||JSON.stringify(valueView.selfState)!==JSON.stringify(done.observation.selfState))throw new Error('估值投影改变正式事实');
          const budget={transitions:256,nodes:1024,frontier:256,milliseconds:1500},tail=window.SetiDecisionSearch.searchDecision({port:p,root:done,evaluate,...window.SetiSearchAgent.OPTIONS,budget});
          const q=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});try{
            q.setResourcePlanning(true);q.setCardPickPlanning(true);let control=q.openRoot();for(const id of [f.source.teacherActionId,scan.actionId,income.actionId])control=q.expand(control,id);
            if(evaluate(q.valueObservation(control))!==evaluate(valueView))throw new Error('已知奖励当前V与独立原生控制不一致');
            const reference=window.SetiDecisionSearch.searchDecision({port:{...q,incomePlanSummary:()=>null,turnTailSummary:()=>null,postMainValueBound:()=>null},root:control,evaluate,...window.SetiSearchAgent.OPTIONS,budget});
            if(!tail.complete||!reference.complete||tail.actionId!==reference.actionId||tail.value!==reference.value)throw new Error('已知尾部与完整原生策略不一致');
          }finally{q.close();}
        }
        else if(name==='blind-income-proof'){
          const ready=p.cardPickSpec(n);if(ready?.goal.kind!=='ready-income'||ready.goal.fundsCardId!=='card-15-0'||ready.selection.cardId!=='card-18-0'||ready.retainedActionIds.length!==1)throw new Error('已有数据收入未保留已知后续主牌的资金目的');
          const pick=n.legalActions.find(a=>a.summary==='b_2.webp');if(!pick)throw new Error('缺少真实低机会成本收入牌');const root=p.expand(n,pick.actionId),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId);
          const r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate,...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:1500}});
          if(!r.complete)throw new Error('已知收入窗口未闭合');const summary=p.incomePlanSummary(root),policy=p.resourceSpec(root);
          if(summary){const actual=p.expandResourcePlan(root,policy.plans.find(plan=>plan.goal.kind==='income'),()=>null);if(!actual.complete||actual.submissions!==summary.requiredNativeInputs||evaluate(p.valueObservation(actual.node))!==window.SetiStateValue.sumValueParts([evaluate(p.valueObservation(root)),summary.netGain])||r.value!==evaluate(p.valueObservation(actual.node)))throw Error('遮蔽补牌下的收入摘要与完整原生兑现不一致');const proof=p.incomePlanBoundary(root,summary);let rejected=false;try{p.valueObservation(proof);}catch{rejected=true;}if(!rejected)throw Error('收入值证明暴露虚构观察');}
          else{const blue=policy.blueTails.find(t=>t.available),first=root.legalActions.find(a=>a.family==='place_data');if(!blue||!first)throw Error('原生蓝槽反事实缺失');const goal={id:'data:blue:'+blue.blueSlot,kind:'blue-data',blueSlot:blue.blueSlot,targetComputerSlot:window.SetiData.getRequiredComputerSlotForBlueBonus(blue.blueSlot),required:{}},actual=p.expandResourcePlan(root,{goal,operation:{},firstActionId:first.actionId,mode:'greedy'},()=>null);if(!actual.complete||evaluate(p.valueObservation(actual.node))>r.value)throw Error('完整搜索丢失可兑现的蓝槽备选');}
        }
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
  id:'production-funded-travel-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiProbeCapital && window.SetiStateValue && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-025-20261104-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
    function submit(a){if(!a)throw Error('缺少真实移动输入');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitQuickAction(a);if(!r.ok)throw Error(JSON.stringify(r));}
    try{if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('途中探测器恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),obs=c.projection({role:'player',playerId:f.seatId}).state,v=window.SetiStateValue.evaluateStateValue(obs,f.seatId);
      if(v.modelVersion!==window.SetiStateValue.MODEL_VERSION||v.components.probePotential!==3.5-(window.SetiStateValue.FORECAST.usefulScansPerLaterRound-2)||v.components.handPotential!==3*window.SetiStateValue.FORECAST.usefulScansPerLaterRound-2.5)throw Error('完整路线未扣除持牌资金机会成本');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('估值改变原生根');submit(legal().find(a=>a.family==='quick_trade'&&a.target.tradeId==='energy-for-move'));submit(legal().find(a=>a.target?.deltaX===0&&a.target?.deltaY===1));
      const next=window.SetiStateValue.evaluateStateValue(c.projection({role:'player',playerId:f.seatId}).state,f.seatId);if(next.components.probePotential!==5.5||next.total<v.total)throw Error('真实费用或途中/到达用途不连续');if(!c.lifecycle.restore(JSON.parse(before)).ok||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('根/RNG恢复失败');window.__fundedTravel={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__fundedTravel?.ok === true',
  obligation:'真实页面计入当前资金可支付的完整探测路线，原生付费移动前后用途连续且不污染根',
  counterexample:'页面仍加载旧估值、未到位探测器归零、遗漏移动费或估值读取未来资金',
}), Object.freeze({
  id:'production-conditional-sector-flow',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiProductionKernel && window.SetiRuleObservation && window.SetiData)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-084-20261104-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),state=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);};
    const count=s=>window.SetiData.getSectorRanking(s.data,'sector-4-b').find(p=>p.playerId===f.seatId)?.count||0;
    function submit(a){if(!a)throw Error('条件扫描缺少原生输入');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);if(!r.ok)throw Error(JSON.stringify(r));}
    try{if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('教师扫描根恢复失败');const s=state(),p=s.players.players.find(p=>p.id===f.seatId),n=count(s),d=p.resources.availableData,card=p.hand.find(c=>c.cardId==='dlc_37.png');submit(legal().find(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id));
      const pending=JSON.parse(JSON.stringify(c.lifecycle.save().envelope));if(!c.lifecycle.restore(pending).ok)throw Error('条件扫描冷恢复失败');submit(legal().find(a=>a.target?.nebulaId==='sector-2-a'));
      if(count(state())!==n+1||state().players.players.find(p=>p.id===f.seatId).resources.availableData!==d)throw Error('DLC37漏扫匹配扇区或错误获得数据');
      if(legal().some(a=>a.target?.nebulaId))throw Error('已完成扫描重复选择');window.__conditionalSectorFlow={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__conditionalSectorFlow?.ok === true',
  obligation:'真实页面DLC37完成两个初始匹配扇区，冷恢复保留义务且不获得数据',
  counterexample:'Browser旧脚本丢失allMatching，仿真已修复但页面仍只扫描一次或恢复重扫',
}), Object.freeze({
  id:'production-conditional-research-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue && window.SetiAnalysisPort && window.SetiDecisionSearch)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/human405-two-rounds-20261104-v1/ai-v123-step095-pass-choice-20261104-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('条件选牌状态恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot();for(const a of root.legalActions){const child=p.expand(root,a.actionId),v=window.SetiStateValue.evaluateStateValue(child.observation,f.seatId);if(a.target.cardId==='dlc_18.png'&&v.components.handPotential!==0)throw Error('条件科技被当成无条件收益');if(a.target.cardId==='b_101.webp'&&v.components.handPotential<=0)throw Error('普通科技用途丢失');}
      const evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId),r=window.SetiDecisionSearch.searchDecision({...window.SetiSearchAgent.OPTIONS,port:p,root,evaluate,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET});
      if(!r.complete||root.legalActions.find(a=>a.actionId===r.actionId)?.target.cardId!=='b_101.webp'||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('真实页面选牌或原根隔离失败');window.__conditionalResearch={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__conditionalResearch?.ok === true',
  obligation:'真实页面的条件科技牌不领取尚未证明的普通科技资本，保留原生合法候选并选择可兑现用途',
  counterexample:'DLC18条件未满足却获得无条件科技奖励，脚本缓存未更新或B101用途被误删',
}), Object.freeze({
  id:'production-known-pass-card',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiCards && window.SetiStateValue)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-062-20261030-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    try{for(const purpose of [false,true]){
      const envelope=structuredClone(f.compositionEnvelope),state=envelope.session.session.workingState;
      if(purpose){const pile=state.cards.passReservePiles[1],old=pile[0],index=state.cards.drawPileCardIds.indexOf('b_4.webp'),entry=window.SetiCards.CARD_CATALOG.find(c=>c.card_id==='b_4.webp');if(index<0||!entry)throw Error('科技对照牌不存在');const {cardName,src,...replacement}=window.SetiCards.createCardInstance(entry,'known-pass-purpose');pile[0]={...replacement,id:old.id,faceUp:true};state.cards.drawPileCardIds[index]=old.cardId;}
      if(!c.lifecycle.restore(envelope).ok)throw Error('PASS根恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
      try{const root=p.openRoot(),id=purpose?'b_4.webp':'dlc_4.png',a=root.legalActions.find(a=>a.target?.kind==='pass-reserve-card'&&a.target.cardId===id),child=p.expand(root,a.actionId),hand=child.observation.selfState.hand;
        if(child.boundary!=='hidden_card_draw'||!hand.some(c=>c.id===a.payload.cardInstanceId&&c.cardId===id)||hand.filter(c=>c.hidden).length!==1)throw Error('已知PASS牌丢失或收入盲抽泄漏');
        if(purpose&&window.SetiStateValue.evaluateStateValue(child.observation,f.seatId).components.handPotential<=0)throw Error('已知科技牌用途未进入估值');
        if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('原根或RNG被修改');
      }finally{p.close();}
    }window.__knownPassCard={ok:true,nativeCases:2};}finally{c.dispose();}
  })()`,
  successExpression:'window.__knownPassCard?.ok === true',
  obligation:'当前原生PASS已公开选牌在后续盲抽后保留身份，真实科技用途可估值而收入盲抽仍隐藏',
  counterexample:'遮蔽已知选牌漏计用途、误读未来PASS选项或泄漏收入盲抽',
}), Object.freeze({
  id:'production-winning-income-recovery',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiSearchAgent?.createSearchAgent && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('获胜收入开局恢复失败');
    let checkpoint=null,inputs=0,expectedValue;
    const legacy=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-first-launch-timing-native-20261104-v1.json').then(r=>r.json());
    for(const step of legacy.paidSteps.slice(0,3)){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===step.actionId);if(!a)throw Error('收入控制前缀缺失');const out=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!out.ok)throw Error('收入控制前缀失败');}
    const control=structuredClone(c.lifecycle.save().envelope),state=JSON.parse(control.committedState);state.players.players.find(p=>p.id===f.seatId).resources.publicity=5;control.committedState=JSON.stringify(state);if(!c.lifecycle.restore(control).ok)throw Error('研究费以下的收入控制恢复失败');
    const knownAtRoot=new Set(c.projection({role:'player',playerId:f.seatId}).state.selfState.hand.map(c=>c.id));
    try{for(let i=0;i<9;i++){
      const saved=JSON.parse(JSON.stringify(c.lifecycle.save().envelope));if(!c.lifecycle.restore(saved).ok)throw Error('逐输入原生保存恢复失败');
      const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({}),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),ai=window.SetiSearchAgent.createSearchAgent({seatId:f.seatId,analysisPort:p});
      ai.loadCheckpoint(checkpoint);const before=JSON.stringify(c.lifecycle.save().envelope),r=ai.decide({seatId:f.seatId,legalActions:actions}),a=actions.find(a=>a.actionId===r.actionId);
      if(i===0)expectedValue=r.search.value;if(!a||r.search.value!==expectedValue||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('计划值改变或搜索污染原根');
      if(i===0){inputs=r.search.diagnostics.nativeExecutions;if(inputs<1||inputs>256)throw Error('获胜尾部没有按原生输入完整计费');}
      else if(r.search.diagnostics.planContinuation!=='hit'||r.search.diagnostics.nativeExecutions!==0)throw Error('保存恢复后丢失既定目的');
      if(i<4&&a.family!==(i%2?'choose_payment':'move'))throw Error('固定移动准备偏离证书');
      if(i>=4&&i<8&&a.family!==(i%2?'choose_target':'place_data'))throw Error('固定电脑准备偏离证书');
      if(i===8&&a.family!=='end_turn')throw Error('获胜电脑前缀未按证书结束回合');
      if((i===2||i===3)&&r.search.analysis.movementIntentRecoveries!==1)throw Error('剩余路线未从完整证书恢复');
      checkpoint=JSON.parse(JSON.stringify(ai.createCheckpoint()));
      const out=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!out.ok)throw Error('既定输入未通过原生验证');
    }
    const observed=c.projection({role:'player',playerId:f.seatId}).state,masked={...observed,selfState:{...observed.selfState,hand:observed.selfState.hand.map(card=>knownAtRoot.has(card.id)?card:{id:card.id,hidden:true})}};if(window.SetiStateValue.evaluateStateValue(masked,f.seatId).total!==expectedValue||window.SetiStateValue.evaluateStateValue(observed,f.seatId).total<expectedValue)throw Error('盲抽前用途预测与真实兑现不一致，或提前使用了新牌身份');
    const owner=observed.publicState.players.find(p=>p.playerId===f.seatId);if(owner.publicity!==6||JSON.stringify(owner.dataProgress.computerSlots)!=='[1,2]'||!observed.selfState.hand.some(c=>c.id==='card-15-0'))throw Error('获胜电脑前缀必须保留DLC9并兑现当前研究资金');
    window.__winningIncomeRecovery={ok:true,inputs,restoredNativeSteps:9};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__winningIncomeRecovery?.ok === true',
  obligation:'真实页面的研究费以下当前获胜电脑准备逐输入保存原生状态与AI证书，保留DLC9、兑现研究资金，恢复后维持目的和值且见证计入预算',
  counterexample:'付费移动之间或电脑前缀完成后冷恢复偏离原计划、证书复用虚构后继、固定见证不计费或真实兑现值不同',
}), Object.freeze({
  id:'production-free-launch-plan-recovery',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiResearchIncomeCapital && window.SetiSearchAgent?.createSearchAgent)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('免费发射根恢复失败');let checkpoint=null,freeValue;
    try{for(let i=0;i<4;i++){
      const saved=structuredClone(c.lifecycle.save().envelope);if(!c.lifecycle.restore(saved).ok)throw Error('免费发射逐步原生恢复失败');
      const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({}),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),ai=window.SetiSearchAgent.createSearchAgent({seatId:f.seatId,analysisPort:p});ai.loadCheckpoint(checkpoint);
      const before=JSON.stringify(c.lifecycle.save().envelope),r=ai.decide({seatId:f.seatId,legalActions:actions}),a=actions.find(a=>a.actionId===r.actionId);
      if(i===0)freeValue=r.search.value;
      if(!a||a.family!==['play_card','move','choose_payment','end_turn'][i]||r.search.value!==freeValue||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('免费发射用途、固定路线或根隔离错误');
      if(!i&&(a.target.cardInstanceId!=='card-13-0'||r.search.diagnostics.nativeExecutions>256))throw Error('教师首个免费发射没有进入获胜候选');
      if(i&&(r.search.diagnostics.planContinuation!=='hit'||r.search.diagnostics.nativeExecutions!==0))throw Error('免费发射证书冷恢复失效');
      if(i===3&&r.search.analysis.completedMovementRecoveries!==1)throw Error('已完成移动目的未恢复');
      checkpoint=JSON.parse(JSON.stringify(ai.createCheckpoint()));const out=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!out.ok)throw Error('免费发射原生输入失败');
    }window.__freeLaunchRecovery={ok:true,restoredNativeSteps:4};}finally{c.dispose();}
  })()`,
  successExpression:'window.__freeLaunchRecovery?.ok === true',
  obligation:'实际教师首个分流选择免费发射，已知研究收入及任务数据联合用途计值一致，四个原生输入冷恢复且后续零模拟',
  counterexample:'Node中首个分流已修复但页面未装配、完成移动后目标丢失或跨输入泄漏随机状态',
}), Object.freeze({
  id:'production-funded-movement-tail',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiFundedMovementTail && window.SetiDecisionSearch)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json').then(r=>r.json()),seed=f.source.seed,reference=await fetch('/reports/ai-foundation-20261023/human405-v155-cold-serial-case-105-20261104-v1.json').then(r=>r.json());
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('固定移动尾部根恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot(),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId),r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET});
      if(!r.complete||r.actionId!==reference.actionId||r.value!==reference.value||r.diagnostics.nativeExecutions>=256||r.diagnostics.movementValuePrunes<=0||p.getDiagnostics().movementRuleQueries<=0)throw Error('原生固定移动上界未保持同动作同值或没有节约组合执行');
      const bounds=r.lines.flatMap(l=>l.actionBounds||[]).filter(b=>b.boundKind==='fixed-paid-movement-tail');if(!bounds.length||bounds.some(b=>b.value<=b.upperBound))throw Error('固定移动上界错误剪除同值路线');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('固定移动上界污染根或RNG');window.__movementTail={ok:true,nativeInputs:r.diagnostics.nativeExecutions};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__movementTail?.ok === true',
  obligation:'实际页面用原生移动规则计算固定准备尾部上界，仅严格劣势路线免组合执行，保留完整参考动作和值',
  counterexample:'浏览器缺少新模块、上界使用假观察、同值路线被剪除或移动查询写入真实状态',
}), Object.freeze({
  id:'production-funded-research-value',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue?.researchCapital && window.SetiTechResolver)',
  actionExpression: `(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-035-20261030-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('科技用途恢复失败');
    const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot(),value=window.SetiStateValue.evaluateStateValue(root.observation,f.seatId),player=root.observation.publicState.players.find(p=>p.playerId===f.seatId);
      if(player.researchPublicityCost!==6||value.components.researchPotential!==9.5||value.components.probePotential!==5.5||value.components.handPotential!==2*window.SetiStateValue.FORECAST.usefulScansPerLaterRound-1.5||value.total!==window.SetiStateValue.sumValueParts([60.5,(window.SetiStateValue.FORECAST.usefulScansPerLaterRound-2)*2,11/3])||value.components.researchIncomePotential!==window.SetiStateValue.sumValueParts([5,11/3]))throw Error('公开费用或科技用途估值缺失');
      if(JSON.stringify(window.SetiStateValue.evaluateStateValue(p.valueObservation(root),f.seatId))!==JSON.stringify(value))throw Error('完整与紧凑用途估值不同');
      const start=p.expand(root,root.legalActions.find(a=>a.family==='research_tech').actionId),choice=start.legalActions.find(a=>a.target.tileId==='blue1'&&a.target.blueSlot===1),end=p.expand(start,choice.actionId),actual=window.SetiStateValue.evaluateStateValue(end.observation,f.seatId);
      if(actual.total!==window.SetiStateValue.sumValueParts([value.total,-value.components.researchIncomePotential,2,11/12])||actual.components.researchPotential!==0)throw Error('原生取得科技与用途重复计价');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('科技用途验证污染根或RNG');
      p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({scanPlanning:true,finalMarkPlanning:true});
      const witness=await fetch('/reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step35-20261031-v1.json').then(r=>r.json());
      let mission=root;for(const step of witness.rows.find(r=>r.name==='student-best').steps){const a=mission.legalActions.find(a=>a.actionId===step.actionId);if(!a)throw Error('任务原生输入不可达');mission=p.expand(mission,a.actionId);}
      const completed=window.SetiStateValue.evaluateStateValue(mission.observation,f.seatId);
      if(window.SetiStateValue.sumValueParts([completed.total,-completed.components.researchIncomePotential])!==window.SetiStateValue.sumValueParts([value.total,-value.components.researchIncomePotential])||completed.components.probePotential!==0)throw Error('探测任务完整奖励链不连续或消耗探测器后仍重复估值');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('探测任务污染原根或RNG');
    }finally{p.close();c.dispose();}
    for(const [name,expected] of [['autonomous',60.5],['teacher58',61.5]]){
      const fixture=await fetch('/adhoc/ai-decision-corpus-20261031-v98-pass-boundary-v1/'+name+'-before-pass-20261031-v1.json').then(r=>r.json());
      const kernel=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});kernel.newGame({seed});const composition=kernel.composition;
      if(!composition.lifecycle.restore(fixture.compositionEnvelope).ok)throw Error('PASS反例恢复失败');
      const original=JSON.stringify(composition.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition,seatId:fixture.seatId,maxCacheEntries:0});
      try{const root=port.openRoot(),pass=root.legalActions.find(a=>a.family==='pass'),child=port.expand(root,pass.actionId),view=child.observation;
        if(!view.publicState.passingPlayerIds.includes(fixture.seatId)||view.publicState.passedPlayerIds.includes(fixture.seatId))throw Error('PASS奖励期间规划窗口与正式名单混淆');
        const value=window.SetiStateValue.evaluateStateValue(view,fixture.seatId);
        if(value.total!==window.SetiStateValue.sumValueParts([expected,11/3])||JSON.stringify(window.SetiStateValue.evaluateStateValue(port.valueObservation(child),fixture.seatId))!==JSON.stringify(value))throw Error('PASS投资窗口未统一或持牌重复计价');
        if(JSON.stringify(composition.lifecycle.save().envelope)!==original)throw Error('PASS反例污染正式根');
      }finally{port.close();composition.dispose();}
    }
    window.__fundedResearchSmoke={ok:true,passInvestmentWindows:2};
  })()`,
  successExpression:'window.__fundedResearchSmoke?.ok === true',
  obligation:'真实页面公开原生研究费用，宣传与持牌科技在PASS奖励期间转入下一轮，紧凑观察与根隔离保持',
  counterexample:'Node单独可用而页面未装配费用来源、PASS完成前仍计本轮投资、同一科技重复计价或估值读取隐藏奖励',
}), Object.freeze({
  id:'production-mixed-blue-analysis',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiEndGameScoring?.getPlayerTraceCounts && window.SetiAmibaAnalysisCapital && window.SetiStateValue)',
  actionExpression:`(async()=>{
    const control=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v264-ready-analysis-extra-blue-native-control-20261106-v1.json').then(r=>r.json()),e=control.prefixes['1'],s=JSON.parse(e.committedState),seed=s.meta.seed,seat='player-white',v=window.SetiStateValue;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('mixed analysis restore');const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state,legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});let inputs=0;
    const submit=predicate=>{const a=legal().find(predicate);if(!a)throw Error('mixed analysis input missing');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('mixed analysis rejected');inputs++;};
    try{const root=observe(),f={...window.SetiProbeCapital.factsFromObservation(root,seat),supply:s.tech,researchCost:6,analyzeEnergyCost:0},q=v.purposeCapital(f).analysisPlan;if(v.evaluateStateValue(root,seat).total!==142||q.value!==3||q.selected.position!==4||JSON.stringify(f.traceCounts)!==JSON.stringify(window.SetiEndGameScoring.getPlayerTraceCounts(s.players.players.find(p=>p.id===seat),s.aliens)))throw Error('mixed global counts or funded quote differs');
      const p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const n=p.openRoot();p.setResourcePlanning(true);if(v.evaluateStateValue(p.valueObservation(n),seat).total!==142||p.resourceSpec(n).plans.some(p=>p.goal.kind==='blue-data')||p.postMainValueBound(n)!==null)throw Error('mixed compact/preparation/ceiling contract differs');}finally{p.close();}
      submit(a=>a.family==='end_turn');submit(a=>a.family==='place_data');submit(a=>a.target?.target==='computer');submit(a=>a.family==='analyze');submit(a=>a.target?.choiceId==='trace:1:blue:amiba:4');submit(a=>a.target?.choiceId==='amiba:blind');submit(a=>a.family==='end_turn');const masked=window.SetiRuleComposition.sanitizeHiddenInformationObservation(root,observe(),{code:'hidden_card_reveal'});if(inputs!==7||v.evaluateStateValue(masked,seat).total!==142||masked.selfState.traceCounts.blue!==3||masked.selfState.hand.filter(c=>c.hidden).length!==2)throw Error('mixed native anonymous realization differs');if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('mixed analysis mutated root/RNG');window.__mixedBlueAnalysisSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__mixedBlueAnalysisSmoke?.ok === true',
  obligation:'多物种公开痕迹计数在页面/紧凑/Native一致；实际187根保留数据并在下一主行动固定填6、免电分析及匿名两牌原生兑现142V，拒绝套用安静剪枝',
  counterexample:'页面漏正式计数API、第二物种使分析归零、固定准备被丢弃、未知牌筹资或原根/RNG变化',
}), 
Object.freeze({
  id:'production-ready-amiba-analysis',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAmibaAnalysisCapital && window.SetiAlienAmiba?.getPublicTraceState && window.SetiStateValue)',
  actionExpression:`(async()=>{
    const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/',cp=await fetch(folder+'teacher-before-input-160-20261105-v1.checkpoint.json').then(r=>r.json()),teacher=await fetch('/seti-saves/seti-save-537-merged.json').then(r=>r.json()),e=cp.coreState.compositionEnvelope,s=JSON.parse(e.committedState),seed=s.meta.seed,seat='player-white',v=window.SetiStateValue;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('ready Amiba restore');const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state,legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
    const submit=a=>{if(!a)throw Error('ready analysis input missing');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('ready analysis native input rejected');};
    try{const root=observe(),value=v.evaluateStateValue(root,seat);if(value.total!==124.08333333333333||value.components.analysisPotential!==10.083333333333334||root.publicState.board.aliens.amibaTraces.blindCardCount!==6||Object.hasOwn(root.publicState.board.aliens.amibaTraces,'cardDeck'))throw Error('public ready analysis facts/value missing');
      const p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const n=p.openRoot();if(JSON.stringify(v.evaluateStateValue(p.valueObservation(n),seat))!==JSON.stringify(v.evaluateStateValue(n.observation,seat)))throw Error('ready analysis compact facts differ');}finally{p.close();}
      for(const i of [160,161,162])submit(legal().find(a=>a.actionId===teacher.replaySteps[i-1].action.actionId));submit(legal().find(a=>a.family==='place_data'));submit(legal().find(a=>a.target?.target==='computer'));submit(legal().find(a=>a.family==='place_data'));submit(legal().find(a=>a.target?.target==='blueBonus'&&a.target.blueSlot===1));submit(legal().find(a=>a.family==='end_turn'));
      const masked=window.SetiRuleComposition.sanitizeHiddenInformationObservation(root,observe(),{code:'hidden_card_reveal'});if(v.evaluateStateValue(masked,seat).total!==124.08333333333333)throw Error('native analysis/tail and anonymous floor disagree');if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('ready analysis changed root/RNG');
      const factor=await fetch(folder+'v208-income-factor-prefixes-20261106-v1.checkpoint.json').then(r=>r.json()),information=await fetch(folder+'v204-actual-safety-choice-native-20261106-v1.json').then(r=>r.json()),mask=envelope=>{if(!c.lifecycle.restore(envelope).ok)throw Error('income analysis restore');return window.SetiRuleComposition.sanitizeHiddenInformationObservation(information.branches.safety.observation,observe(),{code:'hidden_card_reveal'});},start=mask(factor.common.prefixes[1]),f={...window.SetiProbeCapital.factsFromObservation(start,seat),supply:start.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0},q=v.purposeCapital(f).analysisPlan;
      if(v.evaluateStateValue(start,seat).total!==112.5||q.selected?.incomeCardId!=='alien-amiba-3-3'||q.selected.preparationPlacements!==3)throw Error('known computer3 income analysis missing');if(v.evaluateStateValue(mask(factor.branches['energy-Amiba3'].envelope),seat).total!==112.5)throw Error('known income analysis native endpoint differs');if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('income analysis changed root/RNG');
      const pending=await fetch(folder+'v214-actual123-corner-safety-purple2-prefix-20261106-v1.checkpoint.json').then(r=>r.json());if(!c.lifecycle.restore(pending.prefixes[6]).ok)throw Error('pending mark restore');const waiting=observe();if(waiting.selfState.nextFinalMark.followingThreshold!==70||v.evaluateStateValue(waiting,seat).total!==120)throw Error('earned pending B incorrectly blocks income analysis');submit(legal().find(a=>a.family==='end_turn'));submit(legal().find(a=>a.target?.tileId==='b'));if(JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(pending.prefixes[8])||v.evaluateStateValue(observe(),seat).total!==120||observe().selfState.nextFinalMark.followingThreshold!==null)throw Error('native B handoff or following threshold differs');if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('pending B changed root/RNG');window.__readyAmibaSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__readyAmibaSmoke?.ok === true',
  obligation:'真实页面公开痕迹占位及数量，无新身份、实体或虚构观察，分析/整区/蓝尾部与剩余电脑资本原生兑现，第3格收入分析共享钱包且紧凑观察一致',
  counterexample:'Node有效而页面缺模块、漏公开输入、把未知收入当资金、重复领取格位或原根RNG变化',
}), Object.freeze({
  id:'production-known-symbol-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiKnownSymbolCapital && window.SetiStateValue && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/',cp=await fetch(folder+'teacher-before-input-133-20261105-v1.checkpoint.json').then(r=>r.json()),teacher=await fetch('/seti-saves/seti-save-537-merged.json').then(r=>r.json()),e=cp.coreState.compositionEnvelope,state=JSON.parse(e.committedState),seed=state.meta.seed,seat='player-white',v=window.SetiStateValue;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('symbol root restore');
    const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state,facts=o=>({...window.SetiProbeCapital.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0});
    try{const before=observe(),q=v.purposeCapital(facts(before)).symbolCardPlan;if(q.value!==2.5||q.selected.slotId!=='blue_1'||v.evaluateStateValue(before,seat).total!==115.75||before.selfState.pendingHandCardTriggers.length)throw Error('known public symbol value/history missing');
      const p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=p.openRoot();if(JSON.stringify(v.evaluateStateValue(p.valueObservation(root),seat))!==JSON.stringify(v.evaluateStateValue(root.observation,seat)))throw Error('compact symbol facts disagree');}finally{p.close();}
      const historical=structuredClone(state);historical.turn.type1TriggerEvents=[...(historical.turn.type1TriggerEvents||[]),{type:'alienTrace',traceType:'pink',playerId:seat}];const h=window.SetiRuleObservation.buildRuleObservation(historical,seed,seat);if(!h.selfState.pendingHandCardTriggers.some(t=>t.cardInstanceId==='alien-amiba-0-1')||v.purposeCapital(facts(h)).symbolCardPlan.value!==0)throw Error('newly reserved historical trigger was ignored');
      for(const i of [133,134,135]){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===teacher.replaySteps[i-1].action.actionId);if(!a)throw Error('symbol native input missing');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);if(!r.ok)throw Error('symbol native input rejected');}
      if(v.evaluateStateValue(observe(),seat).total!==115.75||v.purposeCapital(facts(observe())).symbolCardPlan.value!==0)throw Error('native symbol did not realize its quote exactly');if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('symbol quote changed root/RNG');window.__knownSymbolSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__knownSymbolSmoke?.ok === true',
  obligation:'真实页面已持区域牌读取移动后的公开symbol并共享钱包，历史手牌触发及紧凑观察正确，原生三输入兑现2.5',
  counterexample:'Node存在而页面漏模块/历史手牌输入、重复计价、伪造观察、读隐藏牌或改变原根RNG',
}), Object.freeze({
  id:'production-research-new-final-mark',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiEndGameScoring?.describeNextFinalMark && window.SetiStateValue && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/',control=await fetch(folder+'v204-actual-safety-choice-native-20261106-v1.json').then(r=>r.json()),follow=await fetch(folder+'v204-safety-research-followup-prefix-20261106-v1.checkpoint.json').then(r=>r.json()),e=control.branches.safety.envelope,s=JSON.parse(e.committedState),seed=s.meta.seed,seat='player-white',v=window.SetiStateValue;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('new mark root restore');const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state;
    try{const before=observe(),facts={...window.SetiProbeCapital.factsFromObservation(before,seat),supply:before.publicState.board.techSupply},fund=v.researchFunding(facts,{resources:facts.player,income:facts.player.income,startingIncome:0});if(v.evaluateStateValue(before,seat).total!==123.58333333333333||fund.newFinalMark?.currentValue!==8)throw Error('current-funded first mark missing');
      const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=port.openRoot(),compact=port.valueObservation(root);if(JSON.stringify(compact.selfState.nextFinalMark)!==JSON.stringify(before.selfState.nextFinalMark)||v.evaluateStateValue(compact,seat).total!==123.58333333333333)throw Error('new mark compact/full facts differ');}finally{port.close();}
      for(const step of follow.steps){const d=c.inspect().session?.decision,as=d?.choices||c.inputPort.enumerateActions({}),a=as.find(a=>a.actionId===step.actionId);if(!a)throw Error('new mark native step missing');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('new mark native input rejected');}
      if(JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(follow.envelope))throw Error('new mark native final state/session/RNG differs');const masked=window.SetiRuleComposition.sanitizeHiddenInformationObservation(before,observe(),{code:'hidden_card_reveal'});if(v.evaluateStateValue(masked,seat).total!==112.5)throw Error('claimed mark counted twice');
      if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('new mark quote changed root/RNG');window.__researchNewFinalMarkSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__researchNewFinalMarkSmoke?.ok === true',
  obligation:'真实页面从同一原生安全协议终点预估已筹资研究的首次终局标记，完整/紧凑事实一致，7输入原生兑现且无重复领取',
  counterexample:'Node单独计新标记、Browser遗漏新公开事实或依赖、使用未来资金、已领取仍重复计分或污染原根RNG',
}), Object.freeze({
  id:'production-research-trigger-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiResearchTriggerCapital && window.SetiCardEffects?.listPendingTriggerKeys && window.SetiAlienAmiba?.getPublicSymbolState && window.SetiStateValue?.researchFunding)',
  actionExpression:`(async()=>{
    const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/',cp=await fetch(folder+'teacher-before-input-127-20261105-v1.checkpoint.json').then(r=>r.json()),teacher=await fetch('/seti-saves/seti-save-537-merged.json').then(r=>r.json()),envelope=cp.coreState.compositionEnvelope,state=JSON.parse(envelope.committedState),seed=state.meta.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    if(!c.lifecycle.restore(envelope).ok)throw Error('research trigger root restore');const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state,own=o=>o.publicState.players.find(p=>p.playerId===seat),facts=o=>window.SetiProbeCapital.factsFromObservation(o,seat),fund=o=>({resources:own(o),income:own(o).income,startingIncome:0}),describe=o=>window.SetiResearchTriggerCapital.describe(facts(o),fund(o),own(o).publicity);
    const submit=i=>{const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===teacher.replaySteps[i-1].action.actionId);if(!a)throw Error('teacher input missing '+i);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);if(!r.ok)throw Error('native trigger input rejected');};
    try{const before=observe(),context=describe(before),g=window.SetiResearchTriggerCapital.gains(context,window.SetiStateValue.DEFAULT_WEIGHTS);
      if(!context.available||g('purple2')!==4||g('blue3','purple2')!==4||g('purple3','purple2')!==0)throw Error('one-shot/moved-symbol quote missing');
      if(!before.selfState.reservedCards.find(c=>c.cardId==='amiba_1.webp').cardEffectState||Object.hasOwn(before.publicState.board.aliens.amiba,'cardDeck')||Object.hasOwn(before.publicState.board.aliens.amiba,'initialConfiguration'))throw Error('public trigger facts missing or secret layout leaked');
      submit(127);submit(128);const pending=observe();if(!pending.selfState.pendingNativeEffects||describe(pending).available)throw Error('pending native trigger was forecast again');
      const p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=p.openRoot();if(!p.valueObservation(root).selfState.pendingNativeEffects||JSON.stringify(window.SetiStateValue.evaluateStateValue(root.observation,seat))!==JSON.stringify(window.SetiStateValue.evaluateStateValue(p.valueObservation(root),seat)))throw Error('compact/full pending facts disagree');}finally{p.close();}
      submit(129);if(describe(observe()).available)throw Error('consumed trigger still has pending symbol movement');submit(130);const after=observe(),next=window.SetiResearchTriggerCapital.gains(describe(after),window.SetiStateValue.DEFAULT_WEIGHTS);
      if(own(after).score-own(pending).score!==4||after.publicState.board.aliens.amiba.symbolSlots.blue_1!=='symbol_3'||next('purple3')!==0||next('blue3')!==4)throw Error('native one-shot reward or public symbol movement mismatch');
      if(!c.lifecycle.restore(envelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('trigger controls changed root/RNG');window.__researchTriggerCapitalSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__researchTriggerCapitalSmoke?.ok === true',
  obligation:'真实页面读取公开触发消费和symbol位置，两研究共享一次性奖励与移动，待结算守卫和完整/紧凑观察一致',
  counterexample:'Node可用而页面缺依赖、重领同色奖励、读取旧布局、在队列结算前预支或泄露隐藏牌堆与配置',
}), Object.freeze({
  id:'production-quiet-data-tail',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiLocalDecisionPlans?.dataTailCompletion && window.SetiResidualDomainSession?.listFinalMarkChoices && window.SetiScienceSession?.listIncomeChoices)',
  actionExpression: `(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json').then(r=>r.json()),state=JSON.parse(f.compositionEnvelope.committedState),owner=state.players.players.find(p=>p.id===f.seatId);owner.mainActionCompleted=true;owner.resources.score=23;state.pieces.rockets=state.pieces.rockets.filter(r=>r.playerId!==f.seatId);
    const seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    if(!c.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(state)}).ok)throw Error('安静数据尾部恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot(),spec=p.turnTailSummary(root,'blue-end-turn'),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId);if(!spec?.dataPlans.length||spec.markedTiles.length!==1)throw Error('固定收入/蓝槽/标记计划丢失');
      const proof=p.turnTailBoundary(root,spec);let rejected=false;try{p.valueObservation(proof);}catch{rejected=true;}if(!rejected)throw Error('值证明暴露虚构观察');let n=root,inputs=0;
      for(const item of spec.dataPlans){const plan=p.resourceSpec(n).plans.find(x=>x.goal.id===item.goal.id),r=p.expandResourcePlan(n,plan,()=>null);if(!r.complete||r.submissions!==item.requiredNativeInputs)throw Error('数据计划原生输入数不一致');n=r.node;inputs+=r.submissions;}
      n=p.expand(n,n.legalActions.find(a=>a.family==='end_turn').actionId);inputs++;
      for(const tile of spec.markedTiles){const policy=p.localDecisionSpec(n),a=n.legalActions.find(a=>a.actionId===policy.selectedActionId);if(a.target.tileId!==tile)throw Error('贪心标记与原生选项不一致');n=p.expand(n,a.actionId);inputs++;}
      if(inputs!==spec.requiredNativeInputs||evaluate(p.valueObservation(n))!==evaluate(root.observation)+spec.netGain)throw Error('数据尾部与原生值不一致');
      const limited=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate,...window.SetiSearchAgent.OPTIONS,budget:{transitions:256,nodes:1,frontier:256,milliseconds:1500}});if(limited.complete||limited.actionId)throw Error('固定证明绕过全局节点预算');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('尾部证明污染真实根');window.__quietDataTailSmoke={ok:true,inputs,marks:spec.markedTiles};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__quietDataTailSmoke?.ok === true',
  obligation:'真实页面连续数据、货币收入、蓝槽和终局标记计划值等于原生执行，证明无虚构观察且受全局预算约束',
  counterexample:'Node 能运行但浏览器缺少共享原生选项构造、漏结算标记或伪造后继且绕过预算',
}), Object.freeze({
  id:'production-funded-hand-timing',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue?.handCapital && window.SetiAnalysisPort)',
  actionExpression: `(async()=>{
    const record=await fetch('/reports/research/35f648b3.28f4e95c.quick-400.json').then(r=>r.json()),cp=await fetch('/'+record.roundEnds[0].checkpointPath).then(r=>r.json()),seed=record.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    if(!c.lifecycle.restore(cp.coreState.compositionEnvelope).ok)throw Error('手牌支付时机反例恢复失败');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{const root=p.openRoot(),o=root.observation,owner=o.publicState.players.find(p=>p.playerId===seat),card=o.selfState.hand.find(c=>c.cardId==='dlc_9.png'),v=window.SetiStateValue,value=v.evaluateStateValue(o,seat);
      if(value.modelVersion!==window.SetiStateValue.MODEL_VERSION||owner.credits!==0||owner.energy!==0||value.components.handPotential!==2*window.SetiStateValue.FORECAST.usefulScansPerLaterRound-1.5)throw Error('未支付的DLC9仍计本轮科技窗口');
      if(root.legalActions.some(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id))throw Error('原生支付检查与钱包不符');
      const quote=(credits,energy,income=owner.income)=>v.handCapital([card],owner.techState,o.publicState.board.techSupply,1,v.DEFAULT_WEIGHTS,{resources:{credits,energy},income});
      if(quote(3,0)!==3*v.FORECAST.usefulScansPerLaterRound-1.5||quote(2,2)!==3*v.FORECAST.usefulScansPerLaterRound-2.5||quote(0,0,{credits:0,energy:0})!==0)throw Error('支付轮次或真实兑换损失未进入用途估值');
      if(JSON.stringify(value)!==JSON.stringify(v.evaluateStateValue(p.valueObservation(root),seat)))throw Error('完整/紧凑手牌资金估值不同');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('手牌资金查询污染根或RNG');window.__fundedHandTimingSmoke={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__fundedHandTimingSmoke?.ok === true',
  obligation:'真实页面按已知支付时机计算手牌科技窗口，兑换损失与Native钱包一致，未来收入只用于未来轮次',
  counterexample:'浏览器沿用无资金约束估值、下一轮收入被拿来支付本轮牌，或查询修改真实根',
}), Object.freeze({
  id:'production-mission-data-continuation',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue?.incomePreparationCapital && window.SetiResearchIncomeCapital?.missionDataContinuation && window.SetiCardPickPlanning)',
  actionExpression:`(async()=>{
    const prefix='/reports/ai-foundation-20261104/two-rounds-teacher-v2/',income=await fetch(prefix+'v158-known-income-timing-native-20261104-v1.json').then(r=>r.json()),extended=await fetch(prefix+'v158-known-orbit-blue-funding-native-20261104-v2.json').then(r=>r.json()),a=income.plans.find(p=>p.technology==='blue2'&&p.plan==='end-orbit-known-credit-income'),b=extended.plans.find(p=>p.technology==='blue2'),f=await fetch('/'+a.source).then(r=>r.json()),seed=f.source.seed,seat=f.seatId;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('mission data root restore');const before=JSON.stringify(c.lifecycle.save().envelope),s=JSON.parse(f.compositionEnvelope.committedState),p=s.players.players.find(p=>p.id===seat),known=new Set([...p.hand,...s.cards.publicCards].filter(Boolean).map(c=>c.id)),legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
    const value=()=>{const o=structuredClone(c.projection({role:'player',playerId:seat}).state);o.selfState.hand=o.selfState.hand.map(c=>known.has(c.id)?c:{id:c.id,hidden:true});o.publicState.board.publicCards=o.publicState.board.publicCards.map(c=>c&&known.has(c.id)?c:null);return window.SetiStateValue.evaluateStateValue(o,seat);};
    const submit=id=>{const a=legal().find(a=>a.actionId===id);if(!a)throw Error('native action missing');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('native action rejected');};
    try{const initial=value();if(initial.total!==window.SetiStateValue.sumValueParts([64.5,11/3]))throw Error('mission/data purpose not connected');submit(a.steps[0].actionId);submit(a.steps[1].actionId);const session=c.lifecycle.save().envelope.session.session,planner=window.SetiCardPickPlanning.createCardPickPlanner(),pick=planner.plan({state:session.workingState,seatId:seat,actions:legal(),status:'decision',session});if(pick.goal.projectedData!==1||pick.selection.cardId!=='card-40-0')throw Error('queued pick ignores following known data/blue funding');submit(pick.selectedActionId);for(const x of [...a.steps.slice(3),...b.steps])submit(x.actionId);if(value().total!==initial.total)throw Error('native mission/data chain does not realize forecast');if(!c.lifecycle.restore(f.compositionEnvelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('mission data changed root/RNG');window.__missionDataContinuation={ok:true};}finally{c.dispose();}
  })()`,
  successExpression:'window.__missionDataContinuation?.ok === true',
  obligation:'Known mission income, current data and a currency blue tail share one wallet; actual queued pick and full native path realize the same value',
  counterexample:'Browser omits data preparation, greedy pick chooses blind income, funding uses a reward twice or native root/RNG changes',
}), Object.freeze({
  id:'production-teacher-development',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue && window.SetiSearchAgent && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/human405-v158-native-20261105-v1/ai-step-055-20261105-v1.json').then(r=>r.json()),seed=f.source.seed,seat=f.seatId;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('development root restore');
    const original=JSON.stringify(c.lifecycle.save().envelope),source=JSON.parse(f.compositionEnvelope.committedState),owner=source.players.players.find(p=>p.id===seat),known=new Set([...owner.hand,...source.cards.publicCards].filter(Boolean).map(c=>c.id)),state=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);},legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
    const submit=a=>{if(!a)throw Error('native action missing');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('native action rejected');};
    const value=()=>{const o=structuredClone(c.projection({role:'player',playerId:seat}).state);o.selfState.hand=o.selfState.hand.map(c=>known.has(c.id)?c:{id:c.id,hidden:true});o.publicState.board.publicCards=o.publicState.board.publicCards.map(c=>c&&known.has(c.id)?c:null);return window.SetiStateValue.evaluateStateValue(o,seat).total;};
    try{const p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),ai=window.SetiSearchAgent.createSearchAgent({seatId:seat,analysisPort:p}),r=ai.decide({seatId:seat,legalActions:legal()}),a=legal().find(a=>a.actionId===r.actionId);if(a?.family!=='pass'||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('preserved research purpose lost or root changed');submit(a);let inputs=1;
      while(!(state().turn.roundNumber===2&&state().turn.currentPlayerId===seat&&!c.inspect().session?.decision)){if(inputs++>=40)throw Error('mandatory continuation bound');const d=c.inspect().session?.decision;submit(d?legal().find(a=>a.family==='choose_card'&&['pass-hand-limit','pass-reserve-card'].includes(a.target.kind)):legal().find(a=>a.family==='pass'));}
      const before=value(),p2=state().players.players.find(p=>p.id===seat);if(p2.resources.credits<3||!p2.hand.some(c=>c.id==='card-15-0'))throw Error('known income did not preserve and fund DLC9');submit(legal().find(a=>a.family==='play_card'&&a.target.cardInstanceId==='card-15-0'));submit(legal().find(a=>a.target.tileId==='purple4'));
      if(!state().players.players.find(p=>p.id===seat).techState.ownedTiles.purple4||value()!==before)throw Error('funded forecast differs from native acquisition');window.__teacherDevelopment={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__teacherDevelopment?.ok === true',
  obligation:'Preserve a known income-funded research card through native PASS and play it after known income without using new draw identities',
  counterexample:'Browser burns the research card for analysis or forecasts a payment that native income cannot fund',
}), Object.freeze({
  id:'production-settled-tech-funding',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiDecisionSearch)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-039-20261104-v1.json').then(r=>r.json()),reference=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v184-cold-serial-teacher-039-20261105-v1.json').then(r=>r.json()),seed=f.source.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('paid-tech root restore');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
    try{const root=p.openRoot(),evaluate=window.SetiStateValue.createStateValueEvaluator(f.seatId),r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET});
      if(!r.complete||r.unresolved.length||r.actionId!==reference.actionId||r.value!==reference.value||r.diagnostics.nativeExecutions>256)throw Error('paid-tech funding contexts were not shared correctly');
      if(!r.lines.some(l=>l.status==='decision'&&l.resourcePolicy?.bound&&l.resourcePolicy.goal?.purpose==='tech'&&l.alternatives>=4))throw Error('distinct technology choices were lost');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('paid-tech sharing changed root/RNG');window.__settledTechFunding={ok:true,nativeInputs:r.diagnostics.nativeExecutions};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__settledTechFunding?.ok === true',
  obligation:'Share fully paid pure-research contexts in the real page while retaining every target and full native state/RNG',
  counterexample:'Preparation metadata repeats the same research effects, removes a target, changes value or writes the root',
}), Object.freeze({
  id:'production-ready-analysis-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiReadyAnalysisCapital && window.SetiStateValue?.purposeCapital && window.SetiProductionKernel)',
  actionExpression:`(async()=>{const w=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-research-analysis-order-native-20261104-v1.json').then(r=>r.json()),seed='seti-free-analyze-v1';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    try{for(const row of w.rows){if(!c.lifecycle.restore(row.afterFirst.envelope).ok)throw Error('restore');const before=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:'player-white'}).state,v=window.SetiStateValue.evaluateStateValue(o,'player-white'),s=JSON.parse(row.afterFirst.envelope.committedState),p=s.players.players.find(p=>p.id==='player-white');
      if(!c.lifecycle.restore(row.afterBoth.envelope).ok)throw Error('native analysis endpoint restore');const endpoint=window.SetiStateValue.evaluateStateValue(c.projection({role:'player',playerId:'player-white'}).state,'player-white');if(row.name==='research-first'?v.total!==endpoint.total:endpoint.total<v.total||v.components.analysisPotential<=0)throw Error('已就绪分析或保留电脑用途不符合原生兑现');if(!c.lifecycle.restore(row.afterFirst.envelope).ok)throw Error('restore native analysis source');
      if(window.SetiResourceDemand.planningCapital(s,p)!==window.SetiStateValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>v.components[k])))throw Error('状态/观察用途分离');
      if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('根/RNG改变');}window.__readyAnalysisSmoke={ok:true};}finally{c.dispose();}})()`,
  successExpression:'window.__readyAnalysisSmoke?.ok === true',
  obligation:'真实页面共享已就绪分析用途，资金机会成本和研究先后原生账本一致',
  counterexample:'只在Node计分析用途、页面少装依赖、状态准备与观察估值分离或读写根/RNG',
}), Object.freeze({
  id:'production-public-income-option',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue?.incomeAllocationCapital && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-039-20261104-v1.json').then(r=>r.json()),seed=f.source.seed,seat=f.seatId;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('public income root restore');const original=JSON.stringify(c.lifecycle.save().envelope);
    const submit=id=>{const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===id);if(!a)throw Error('native path missing '+id);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('native public income path rejected');};
    try{
      let p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
      try{const root=p.openRoot(),r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate:window.SetiStateValue.createStateValueEvaluator(seat),...window.SetiSearchAgent.OPTIONS,budget:window.SetiSearchAgent.BUDGET});
        if(!r.complete||r.unresolved.length||r.actionId!=='orbit:44937d1f'||r.value!==window.SetiStateValue.sumValueParts([64.5,62/182,11/3])||r.diagnostics.nativeExecutions>256)throw Error('public income choice/value incomplete '+JSON.stringify({action:r.actionId,value:r.value,inputs:r.diagnostics.nativeExecutions}));
        if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('public option search changed root/RNG');
      }finally{p.close();}
      for(const id of ['place_data:8fd12fd3','choose_target:29b5215c','place_data:8fd12fd3','choose_target:29b5215c','place_data:8fd12fd3','choose_target:29b5215c','place_data:8fd12fd3','choose_target:29b5215c','choose_card:b27d2a0c','scan:2d21a323','choose_target:2ad5607b','choose_card:65224aaf'])submit(id);
      const before=JSON.stringify(c.lifecycle.save().envelope),value=window.SetiStateValue.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat).total;p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});let proof;
      try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);const root=p.openRoot(),policy=p.cardPickSpec(root),swap=root.legalActions.find(a=>a.family==='industry');proof=p.turnTailSummary(root,'end-turn');if(!swap||policy.retainedActionIds.includes(swap.actionId)||!proof||proof.netGain!==0||proof.requiredNativeInputs!==1)throw Error('plain end incorrectly blocked by company compound guard');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('end summary changed root/RNG');}finally{p.close();}
      submit(proof.firstActionId);if(window.SetiStateValue.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat).total!==value)throw Error('native end differs from identity proof');
      if(!c.lifecycle.restore(f.compositionEnvelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('public option root restoration failed');window.__publicIncomeOptionSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__publicIncomeOptionSmoke?.ok === true',
  obligation:'浏览器以公开收入先验保留筹资选择，完整第39根与Node一致，普通结束摘要不被已排除换牌阻断且与原生13输入相符',
  counterexample:'浏览器少装新用途模块、读到实际隐藏牌、公司复合守卫扩大到结束回合或污染根/RNG',
}), Object.freeze({
 id:'production-known-sector-analysis',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiSectorCardCapital && window.SetiStateValue && window.SetiResourceDemand)',
 actionExpression:`(async()=>{const w=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v178-known-sector-card-continuation-native-20261105-v2.json').then(r=>r.json()),seed=JSON.parse(w.checkpoints[0].checkpoint.coreState.committedState).meta.seed,seat='player-white',k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
  try{for(const row of w.checkpoints){if(!c.lifecycle.restore(row.checkpoint.coreState.compositionEnvelope).ok)throw Error('sector asset checkpoint restore');const before=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,v=window.SetiStateValue.evaluateStateValue(o,seat),s=JSON.parse(c.lifecycle.save().envelope.committedState),p=s.players.players.find(p=>p.id===seat);if(v.total!==82.5||window.SetiResourceDemand.planningCapital(s,p)!==['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].reduce((n,k)=>n+v.components[k],0))throw Error('known sector/analysis capital differs between native prefixes or browser/state');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('sector quote changed original root/RNG');}window.__knownSectorAnalysisSmoke={ok:true};}finally{c.dispose();}})()`,
 successExpression:'window.__knownSectorAnalysisSmoke?.ok === true',
 obligation:'真实浏览器加载已知扇区与现有数据准备估值，四个原生前缀均保留已知用途及待领取标记7、总值82.5并与状态准备一致',
 counterexample:'页面漏装领域报价、重复计价、编造扇区重置后探测任务或写入原根/RNG',
}), Object.freeze({
 id:'production-computer-preinvestment',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiValueArithmetic && window.SetiStateValue?.prepaidComputerCapital && window.SetiProductionKernel)',
 actionExpression:`(async()=>{const record=await fetch('/reports/research/e987ead2.9491f13b.quick-400.json').then(r=>r.json()),checkpoint=await fetch('/'+record.roundEnds[0].checkpointPath).then(r=>r.json()),control=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v179-first-round-analysis-tradeoff-native-20261105-v1.json').then(r=>r.json()),seat='player-white',seed=JSON.parse(checkpoint.coreState.committedState).meta.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,values=window.SetiStateValue;
  try{for(const [name,envelope] of [['retained',checkpoint.coreState.compositionEnvelope],['prepared',control.rows[0].envelope],['consumed',control.rows[1].envelope]]){if(!c.lifecycle.restore(envelope).ok)throw Error('computer asset restore');const before=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,v=values.evaluateStateValue(o,seat),s=JSON.parse(envelope.committedState),p=s.players.players.find(p=>p.id===seat),capital=values.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>v.components[k]));if(window.SetiResourceDemand.planningCapital(s,p)!==capital)throw Error('computer state/observation accounting differs');if(name==='retained'&&(v.total!==values.sumValueParts([65.5,11/3])||v.components.analysisPotential!==11/3))throw Error('retained four data missing');if(name!=='retained'&&v.total!==68.5)throw Error('native analysis does not realize quote');if(name==='consumed'&&v.components.analysisPotential!==0)throw Error('cleared computer retains credit');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('computer quote changed root/RNG');}window.__computerPreinvestmentSmoke={ok:true};}finally{c.dispose();}})()`,
 successExpression:'window.__computerPreinvestmentSmoke?.ok === true',
 obligation:'浏览器加载统一估值账本，保留四格、准备及清空三个原生检查点与状态准备一致，无重复计价或原根/RNG变更',
 counterexample:'Node新增电脑资产但页面漏装依赖、分析清空后仍认领预投入或浮点求和导致状态/观察分歧',
}), Object.freeze({
 id:'production-purpose-realization',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiDecisionSearch && window.SetiStateValue && window.SetiAnalysisPort)',
 actionExpression:`(async()=>{const seat='player-white',cases=[{fixture:'/reports/ai-foundation-20261104/two-rounds-teacher-v2/v184-actual-step091-20261105-v1.json',equal:false},{fixture:'/reports/ai-foundation-20261104/two-rounds-teacher-v2/v187-actual-step117-20261105-v1.json',equal:true}];
 for(const item of cases){const f=await fetch(item.fixture).then(r=>r.json()),seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('realization root restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{const evaluate=window.SetiStateValue.createStateValueEvaluator(seat),root=p.openRoot(),options={port:p,evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET},r=window.SetiDecisionSearch.searchDecision({...options,root}),a=root.legalActions.find(a=>a.actionId===r.actionId),pass=r.roots.find(row=>root.legalActions.find(a=>a.actionId===row.actionId)?.family==='pass');
 if(!r.complete||a?.family!=='place_data'||!pass||!(r.realization>pass.realization)||r.diagnostics.nativeExecutions>256||(item.equal?pass.value!==r.value:r.value<=pass.value))throw Error('current preparation or true exact-value realization tie is wrong');const saved=p.exportPlan(r.planContinuation);if(!saved||!saved.rows.every(row=>Number.isFinite(row.realization)))throw Error('realization plan evidence missing');p.close();const token=p.importPlan(saved),again=window.SetiDecisionSearch.searchDecision({...options,root:p.openRoot(),planContinuation:token});if(!again.complete||again.actionId!==r.actionId||again.value!==r.value||again.realization!==r.realization||again.diagnostics.nativeExecutions!==0)throw Error('saved realization plan not reused');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('realization search changed root/RNG');}finally{p.close();c.dispose();}}
 window.__purposeRealizationSmoke={ok:true,checks:2};})()`,
 successExpression:'window.__purposeRealizationSmoke?.ok === true && window.__purposeRealizationSmoke?.checks === 2',
 obligation:'真实91根落实更高价值分析准备，另以117根严格同值验证优先兑现；两者保存恢复目的/值及零新模拟，原根/RNG不变',
 counterexample:'页面仍在同值时PASS、额外调整标量、用伪造后继计算排序，或计划恢复丢失兑现证据',
}), Object.freeze({
 id:'production-sector-mission-composition',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiSectorCardCapital && window.SetiStateValue && window.SetiProductionKernel)',
 actionExpression:`(async()=>{const w=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v187-sector-mission-prefix-native-20261105-v1.json').then(r=>r.json()),rows=w.rows.filter(x=>['before-sector-card','after-teacher-86','after-teacher-88','after-teacher-90','after-teacher-91'].includes(x.label)),seat='player-white',seed=JSON.parse(rows[0].envelope.committedState).meta.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;try{for(const row of rows){if(!c.lifecycle.restore(row.envelope).ok)throw Error('sector mission root restore');const before=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,v=window.SetiStateValue.evaluateStateValue(o,seat);if(v.total!==94.08333333333333)throw Error('sector card dropped unconsumed mission capital');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('sector mission changed root/RNG');}window.__sectorMissionCompositionSmoke={ok:true,checks:rows.length};}finally{c.dispose();}})()`,
 successExpression:'window.__sectorMissionCompositionSmoke?.ok === true && window.__sectorMissionCompositionSmoke?.checks === 5',
 obligation:'浏览器加载条件扫描与未消费任务的共同钱包报价，五个原生准备前缀同值，原根和RNG不变',
 counterexample:'仅Node修复资本组合、页面仍删去探测器用途，或为一致性伪造重置后的扫描token',
}), Object.freeze({
 id:'production-known-movement-tool',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiKnownMovementCapital && window.SetiStateValue && window.SetiAnalysisPort)',
 actionExpression:`(async()=>{const base='/reports/ai-foundation-20261104/two-rounds-teacher-v2/',f=await fetch(base+'v186-actual-step062-20261105-v1.json').then(r=>r.json()),native=await fetch(base+'v186-dlc5-launch-portfolio-native-20261105-v1.json').then(r=>r.json()),seat=f.seatId,seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('tool PASS root restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{const evaluate=window.SetiStateValue.createStateValueEvaluator(seat),root=p.openRoot(),options={port:p,evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET},r=window.SetiDecisionSearch.searchDecision({...options,root}),a=root.legalActions.find(a=>a.actionId===r.actionId);if(!r.complete||a?.target.cardId!=='dlc_5.png'||r.diagnostics.nativeExecutions>256||r.preparationDebt!==3)throw Error('known tool PASS selection or preparation debt failed');const saved=p.exportPlan(r.planContinuation);if(!saved||!saved.rows.every(row=>Number.isSafeInteger(row.preparationDebt)))throw Error('tool preparation checkpoint missing');p.close();const token=p.importPlan(saved),again=window.SetiDecisionSearch.searchDecision({...options,root:p.openRoot(),planContinuation:token});if(!again.complete||again.actionId!==r.actionId||again.value!==r.value||again.preparationDebt!==r.preparationDebt||again.diagnostics.nativeExecutions!==0)throw Error('tool plan checkpoint reuse');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('tool search changed root/RNG');p.close();const results=[];for(const label of ['dlc_5.png-skip-after-native-end','dlc_5.png-launch-after-native-end']){if(!c.lifecycle.restore(native.branches.find(r=>r.label===label).envelope).ok)throw Error('tool branch restore');const v=window.SetiStateValue.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat);results.push(v);}if(results[0].total!==results[1].total||!(results[1].purposePreparationDebt<results[0].purposePreparationDebt))throw Error('funded launch progress not recognized');window.__knownMovementToolSmoke={ok:true};}finally{p.close();c.dispose();}})()`,
 successExpression:'window.__knownMovementToolSmoke?.ok === true',
 obligation:'浏览器已知DLC5筹资计划改变真实PASS选牌，实际发射减少准备债务，保存恢复保持同值排序且零新模拟',
 counterexample:'页面漏装报价模块、窥视新收入牌、把发射准备视为负担或续行遗漏准备债务',
}), Object.freeze({
  ...smokes.find(smoke=>smoke.id==='production-browser-full-parity'),
  id:'production-search-agent-parity',file:'randomizer/index.html',query:'agent=search',
  obligation:'新search AI在真实页面经共享factory完成初始选择、正式提交和保存恢复',
  counterexample:'仅覆盖初始机器选择，主行动后机器席位未通过共享search factory提交或恢复失效',
}), Object.freeze({
  ...smokes.find(smoke => smoke.id === "production-browser-full-parity"),
  id: "production-completion-agent-parity",
  file: "randomizer/index.html",
  query: "agent=completion",
  obligation: "新completion AI在真实页面经共享factory完成初始选择、正式提交和保存恢复",
  counterexample: "新AI脚本未装配、绕过协调器提交或恢复后仍复用旧算法状态",
 }), Object.freeze({
  id:'production-scan-launch-reserve',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiLocalDecisionPlans && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/',source=await fetch(folder+'v218-paired-scan-setup-prefix-20261106-v1.checkpoint.json').then(r=>r.json()),e=source.branches.ordinary.envelope,seed=JSON.parse(e.committedState).meta.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('scan reserve restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot(),spec=p.resourceSpec(root),normal=spec.plans.filter(p=>p.goal.kind==='scan-flow'&&!p.goal.launch),launch=spec.plans.filter(p=>p.goal.kind==='scan-flow'&&p.goal.launch);if(normal.length!==6||launch.length!==6)throw Error('missing native scan launch purposes');
      if(launch.some(plan=>plan.goal.required.energy!==3||root.legalActions.find(a=>a.actionId===plan.firstActionId)?.target.tradeId!=='credits-for-energy'))throw Error('scan launch energy not reserved');
      const r=p.expandResourcePlan(root,launch.find(p=>p.goal.nebulaId==='sector-1-a'),()=>null);if(!r.complete||!r.prefixes.some(x=>x.action.target?.mode==='launch')||!r.preparations.some(x=>x.reason==='fixed-funded-scan-launch'))throw Error('funded native scan failed to launch');
      const v=window.SetiStateValue;if(JSON.stringify(v.evaluateStateValue(p.valueObservation(root),seat))!==JSON.stringify(v.evaluateStateValue(root.observation,seat)))throw Error('scan reserve full/compact value differs');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('scan reserve changed root/RNG');window.__scanLaunchReserveSmoke={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__scanLaunchReserveSmoke?.ok === true',
  obligation:'Native scan purpose reserves extra purple4 launch energy, fixed branch actually launches, full/compact and root/RNG agree',
  counterexample:'Browser misses reserve purpose, spends last energy on scan, silently skips launch, or mutates the source',
 }), Object.freeze({
  id:'production-amiba-plain-end-value',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiStateValue && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const cp=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v214-actual123-corner-safety-purple2-prefix-20261106-v1.checkpoint.json').then(r=>r.json()),e=cp.prefixes[6],seed=JSON.parse(e.committedState).meta.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('Amiba end restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot(),spec=p.turnTailSummary(root,'end-turn'),evaluate=window.SetiStateValue.createStateValueEvaluator(seat);if(!spec?.publicAmibaPlainEnd||spec.netGain!==0||spec.unrealizedPurposeDelta!==-8||spec.markedTiles.join()!=='b')throw Error('Amiba earned-mark ledger proof missing');
      let child=p.expand(root,spec.firstActionId),inputs=1;while(child.status==='decision'){const fixed=p.localDecisionSpec(child);if(fixed?.kind!=='fixed-final-mark')throw Error('unexpected Amiba end event');child=p.expand(child,fixed.selectedActionId);inputs++;}
      const before=evaluate.details(p.valueObservation(root)),after=evaluate.details(p.valueObservation(child));if(inputs!==spec.requiredNativeInputs||after.value!==before.value||after.unrealizedPurposeValue-before.unrealizedPurposeValue!==-8)throw Error('Amiba native mark value/realization differs');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('Amiba end changed root/RNG');window.__amibaPlainEndSmoke={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__amibaPlainEndSmoke?.ok === true',
  obligation:'Public Amiba end proof equals native final-mark total and realization without a successor observation or source mutation',
  counterexample:'Browser invents a mark value, double claims pending capital, loses realization, or changes source/RNG',
}), Object.freeze({
  id:'production-amiba-currency-tail-value',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiStateValue && window.SetiDecisionSearch && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v223-paired-purple2-known-analysis-single-3-root-20261106-v1.json').then(r=>r.json()),seed=f.source.seed,seat=f.seatId;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('currency tail restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),v=window.SetiStateValue,evaluate=v.createStateValueEvaluator(seat),proofs=new Map();
    try{const port={...p,turnTailBoundary(node,spec){if(spec.publicAmibaCurrencyTail)proofs.set(node,spec);return p.turnTailBoundary(node,spec);}},r=window.SetiDecisionSearch.searchDecision({port,root:p.openRoot(),evaluate,movementPlanning:true,cardPickPlanning:true,resourcePlanning:true,finalMarkPlanning:true,scanPlanning:true,modelKey:evaluate.modelKey,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});if(!r.complete||r.actionId!=='play_card:52a456f8'||r.value!==125.58333333333333||proofs.size<9)throw Error('currency tail choice/value differs');
      for(const[node,spec]of proofs){const before=evaluate.details(p.valueObservation(node));let next=node,inputs=0;for(const step of spec.dataPlans){const plan=p.resourceSpec(next).plans.find(p=>p.goal.id===step.goal.id),result=p.expandResourcePlan(next,plan,()=>null);if(!result.complete)throw Error('currency tail incomplete');next=result.node;inputs+=result.submissions;}next=p.expand(next,next.legalActions.find(a=>a.family==='end_turn').actionId);inputs++;while(next.status==='decision'){const fixed=p.localDecisionSpec(next);if(fixed?.kind!=='fixed-final-mark')throw Error('currency tail pending event');next=p.expand(next,fixed.selectedActionId);inputs++;}const after=evaluate.details(p.valueObservation(next));if(inputs!==spec.requiredNativeInputs||after.value!==v.sumValueParts([before.value,spec.netGain])||v.sumValueParts([after.unrealizedPurposeValue,-before.unrealizedPurposeValue])!==spec.unrealizedPurposeDelta)throw Error('currency native value/realization differs');}
      if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('currency tail changed root/RNG');window.__amibaCurrencyTailSmoke={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__amibaCurrencyTailSmoke?.ok === true',
  obligation:'Every public Amiba fixed currency tail in the native 279-input reference preserves choice, value, realization and root/RNG in Browser',
  counterexample:'Browser omits the typed currency proof, skips a real native event or misprices data and realized purpose',
}), Object.freeze({
  id:'production-amiba-blind-income-value',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiStateValue && window.SetiDecisionSearch && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v225-paired-paired-scan-setup-dlc31-15-root-20261106-v1.json').then(r=>r.json()),seed=f.source.seed,seat=f.seatId;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('blind income restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0}),v=window.SetiStateValue,evaluate=v.createStateValueEvaluator(seat),proofs=new Map();
    try{const port={...p,incomePlanBoundary(node,spec){if(spec.publicAmibaBlindIncome)proofs.set(node,spec);return p.incomePlanBoundary(node,spec);}},r=window.SetiDecisionSearch.searchDecision({port,root:p.openRoot(),evaluate,movementPlanning:true,cardPickPlanning:true,resourcePlanning:true,finalMarkPlanning:true,scanPlanning:true,modelKey:evaluate.modelKey,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});if(!r.complete||r.actionId!=='industry:e887dc52'||r.value!==128.58333333333334||proofs.size<14)throw Error('blind income reference differs');
      for(const[node,spec]of proofs){const before=evaluate.details(p.valueObservation(node)),policy=p.resourceSpec(node);if(policy.plans.length!==1||policy.retainedActionIds.length)throw Error('income has other alternatives');const result=p.expandResourcePlan(node,policy.plans[0],()=>null);if(!result.complete||result.node.status!=='information-barrier'||result.submissions!==spec.requiredNativeInputs)throw Error('wrong native income boundary');const observation=p.valueObservation(result.node),after=evaluate.details(observation);if(after.value!==v.sumValueParts([before.value,spec.netGain])||v.sumValueParts([after.unrealizedPurposeValue,-before.unrealizedPurposeValue])!==spec.unrealizedPurposeDelta||observation.publicState.board.ordinaryDrawCount!==spec.ordinaryDrawCountAfter||spec.ordinaryDrawCountAfter!==spec.ordinaryDrawCountBefore-1)throw Error('income native ledger differs');}
      if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('blind income changed root/RNG');window.__amibaBlindIncomeSmoke={ok:true};
    }finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__amibaBlindIncomeSmoke?.ok === true',
  obligation:'All public Amiba hand-income scalar proofs match their real unknown-card boundaries, deck count, value and realization in Browser',
  counterexample:'Browser reads a hidden identity, invents a successor, miscounts the draw or changes root/RNG',
}), Object.freeze({
  id:'production-public-amiba-income-swap',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue && window.SetiAnalysisPort && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/',prior=await fetch(folder+'v218-paired-visible-scan-prefix-20261106-v1.checkpoint.json').then(r=>r.json()),suffix=await fetch(folder+'v218-paired-scan-income-analysis-prefix-20261106-v1.checkpoint.json').then(r=>r.json()),b=prior.branches.DLC31,seed=JSON.parse(b.envelope.committedState).meta.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    const observe=()=>window.SetiRuleComposition.sanitizeHiddenInformationObservation(b.informationRoot,c.projection({role:'player',playerId:seat}).state,{code:'hidden_card_reveal'});
    try{if(!c.lifecycle.restore(b.envelope).ok)throw Error('swap root restore');const masked=observe(),before=window.SetiStateValue.evaluateStateValue(masked,seat).total;
      for(const secret of ['dlc_31.png','amiba_0.webp']){const variant=structuredClone(masked);for(const card of variant.selfState.hand)if(card.hidden)Object.assign(card,{cardId:secret,id:'secret',price:999});if(window.SetiStateValue.evaluateStateValue(variant,seat).total!==before)throw Error('hidden metadata changes swap capital');}
      const planning=JSON.parse(b.envelope.committedState),actor=planning.players.players.find(p=>p.id===seat),known=new Set(b.informationRoot.publicState.board.publicCards.filter(Boolean).map(c=>c.id));actor.hand=[];actor.resources.handSize=1;planning.cards.unknownPublicSlotIndices=planning.cards.publicCards.flatMap((c,i)=>c&&!known.has(c.id)?[i]:[]);planning.cards.publicCards=planning.cards.publicCards.map(c=>c&&known.has(c.id)?c:null);if(window.SetiResourceDemand.incomeSwapPlan(planning,actor)!==null)throw Error('anonymous forecast leaked executable selection');
      if(!c.lifecycle.restore(suffix.branches.DLC31.prefixes[2]).ok)throw Error('swap after restore');if(before!==123.58333333333333||window.SetiStateValue.evaluateStateValue(observe(),seat).total!==before)throw Error('known public swap capital discontinuity');
      for(let i=0;i<3;i++){if(!c.lifecycle.restore(i===0?b.envelope:suffix.branches.DLC31.prefixes[i-1]).ok)throw Error('swap pending restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),policy=p.cardPickSpec(root),a=root.legalActions.find(a=>a.actionId===policy.selectedActionId);if(!a||(i===0?a.family!=='industry':a.target.cardInstanceId!==(i===1?'card-58-0':'card-18-0')))throw Error('fixed Native swap differs');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('swap changes root/RNG');}finally{p.close();}}
      if(!c.lifecycle.restore(suffix.branches.DLC31.prefixes[4]).ok)throw Error('flat income restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),spec=p.resourceSpec(root),plan=spec.plans.find(p=>p.goal.kind==='income'&&p.goal.incomeCardId==='card-18-0');if(!plan||!spec.incomeTail.realizesForecast||spec.incomeTail.netGain!==0)throw Error('prepaid analysis income was omitted');const result=p.expandResourcePlan(root,plan,()=>null),view=p.valueObservation(result.node);if(!result.complete||result.submissions!==3||view.publicState.players.find(p=>p.playerId===seat).income.energy!==3||view.selfState.hand.length!==0)throw Error('Native fixed income not realized');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('income changes source/RNG');}finally{p.close();}
      window.__publicAmibaIncomeSwapSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__publicAmibaIncomeSwapSmoke?.ok === true',
  obligation:'Known public income is priced before a Native exchange, anonymous metadata is ignored, and all three fixed company steps recover in Browser',
  counterexample:'Browser double counts company/income, reads hidden identity, loses the fixed swap, or mutates source/RNG',
}), Object.freeze({
  id:'production-research-symbol-composition',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiResearchSymbolCapital && window.SetiScienceSession?.getResearchDataCount && window.SetiStateValue && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261105/third-round-teacher-v1/',f=await fetch(F+'v218-corner-safety-purple2-3-root-20261106-v1.json').then(r=>r.json()),controls=await fetch(F+'v238-paid-research-decomposition-20261106-v1.checkpoint.json').then(r=>r.json()),engine=await fetch(F+'v237-engine-before-research-control-20261106-v1.checkpoint.json').then(r=>r.json()),seed=f.source.seed,seat=f.seatId,v=window.SetiStateValue;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    const observe=()=>c.projection({role:'player',playerId:seat}).state,facts=o=>{const p=o.publicState.players.find(p=>p.playerId===seat);return {...window.SetiProbeCapital.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:p.researchPublicityCost,computerSlots:p.dataProgress.computerSlots,analyzeEnergyCost:window.SetiReadyAnalysisCapital.energyCost(p.industryAbilityId),reservedCards:o.selfState.reservedCards};};
    try{if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('research root restore');const original=JSON.stringify(c.lifecycle.save().envelope),before=observe(),q=v.purposeCapital(facts(before)).researchSymbolPlan;if(q.selected?.tileId!=='purple1'||q.value!==9.833333333333334||v.evaluateStateValue(before,seat).total!==123.58333333333333)throw Error('known research/symbol composition missing');
      const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=port.openRoot();if(JSON.stringify(v.evaluateStateValue(port.valueObservation(root),seat))!==JSON.stringify(v.evaluateStateValue(before,seat)))throw Error('compact research composition differs');}finally{port.close();}
      const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
      for(const branch of Object.values(controls.branches)){if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('branch restore');for(const step of branch.steps){const a=legal().find(a=>a.actionId===step.actionId),d=c.inspect().session?.decision;if(!a)throw Error('retained research Native action absent');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('research Native action rejected');}if(JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(branch.envelope))throw Error('research state/session/RNG changed');}
      if(!c.lifecycle.restore(engine.prefixes[0]).ok)throw Error('deferred preparation restore');const end=legal().find(a=>a.family==='end_turn');if(!end||!c.inputPort.submitAction(end).ok)throw Error('deferred real end rejected');const deferred=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{p.setResourcePlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),plan=p.resourceSpec(root).plans.find(p=>p.goal.tileId==='purple1');if(!plan||plan.goal.continuationCardId!==q.selected.beneficiaryCardId||root.legalActions.find(a=>a.actionId===plan.firstActionId)?.target.cardInstanceId!==engine.plan.corner)throw Error('publicity preparation consumed beneficiary');if(JSON.stringify(c.lifecycle.save().envelope)!==deferred)throw Error('preparation mutated root');}finally{p.close();}
      if(!c.lifecycle.restore(f.compositionEnvelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('research quote changed root/RNG');window.__researchSymbolSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__researchSymbolSmoke?.ok === true',
  obligation:'真实页面研究领域数据、一次公开符号移动、已知受益牌与一次B资本共享账本；原生19输入及延后宣传准备恢复一致',
  counterexample:'漏页面模块、只加触发奖励未移动符号、提前丢受益牌、标记重复计分、读取新牌身份或原根RNG变化',
}), Object.freeze({
  id:'production-final-round-proof-guard',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiStateValue && window.SetiLocalDecisionPlans)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261107/final-round-proof-audit-v1/',proof=await fetch(F+'native-income-vs-old-bound-20261107-v2.json').then(r=>r.json()),cp=await fetch('/'+proof.checkpoint).then(r=>r.json()),seat='player-blue',seed='seti-free-analyze-v1',v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;let checked=0;
    try{for(const old of proof.rows.filter(r=>r.violatesBound)){const source=cp.rows.find(r=>r.case===old.case);if(!c.lifecycle.restore(source.source).ok)throw Error('final-round proof root restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
      try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setMovementPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const n=p.openRoot();if(v.supportsLegacyValueProof(n.observation)||v.supportsLegacyValueProof(p.valueObservation(n)))throw Error('R4 viewer probe incorrectly admits legacy model');if(p.postMainValueBound(n)!==null)throw Error('old bound still covers live R4 mission');if(v.evaluateStateValue(n.observation,seat).total!==24||JSON.stringify(v.evaluateStateValue(n.observation,seat))!==JSON.stringify(v.evaluateStateValue(p.valueObservation(n),seat)))throw Error('Native full/compact root differs');p.setMovementPlanning(false);if(p.turnTailSummary(n,'data-end-turn')!==null)throw Error('R4 tail bypasses movement-policy contract');}finally{p.close();}
      const scanning=structuredClone(source.source),scanState=JSON.parse(scanning.committedState),scanner=scanState.players.players.find(p=>p.id===seat);scanner.mainActionCompleted=false;scanner.resources.credits=1;scanning.committedState=JSON.stringify(scanState);if(!c.lifecycle.restore(scanning).ok)throw Error('R4 scan control restore');const scanPort=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const scanRoot=scanPort.openRoot();if(!scanRoot.legalActions.some(a=>a.family==='scan')||scanPort.standardScanValueBound(scanRoot)!==null)throw Error('R4 mission reaches legacy scan theorem');}finally{scanPort.close();}if(!c.lifecycle.restore(source.source).ok)throw Error('R4 proof control source restore');
      let calls=0;const tail=window.SetiLocalDecisionPlans.dataTailCompletion({state:JSON.parse(source.source.committedState),seatId:seat,canLeaveProbeStationary(){calls++;return false;}});if(tail.available||calls===0)throw Error('R4 skips rejecting stationary audit');
      for(const oldAction of source.actions){const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({}),a=actions.find(a=>a.actionId===oldAction.actionId);if(!a)throw Error('Native proof control action absent');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('Native proof control rejected');}
      const actual=v.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat);if(actual.total!==old.after.total||actual.total<=old.upper||JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(source.envelope))throw Error('Native endpoint/state/RNG or bound counterexample differs');if(!c.lifecycle.restore(source.source).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('final-round proof source/RNG changed');checked++;
    }if(checked!==2)throw Error('missing real bound counterexamples');window.__finalRoundProofGuard={ok:true,checked};}finally{c.dispose();}
  })()`,
  successExpression:'window.__finalRoundProofGuard?.ok === true',
  obligation:'Browser rejects the legacy24 ceiling and unaudited R4 stationary data tail; two real10-input income sequences end43.5/29 with complete Native state/session/RNG exact',
  counterexample:'Browser keeps old final-round exclusion, skips movement audit, differs from Node/full/compact or mutates source/RNG',
}), Object.freeze({
  id:'production-final-round-probe-route',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiProbeCapital && window.SetiAnalysisPort && window.SetiStateValue)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261107/final-round-probe-handoff-v1/',cp=await fetch(F+'replayed-prefixes-20261107-v1.checkpoint.json').then(r=>r.json()),seat='player-white',seed='seti-free-analyze-v1',v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    try{for(const[name,at,total]of [['orange2-skip',12,135],['orange2-launch',6,136]]){const rows=cp.branches[name],e=rows[at].envelope;if(!c.lifecycle.restore(e).ok)throw Error('R4 Venus source restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
      try{p.setResourcePlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const n=p.openRoot(),before=v.evaluateStateValue(n.observation,seat);if(before.total!==total||before.components.probePotential!==7)throw Error('R4 current-wallet mission lost');if(JSON.stringify(v.evaluateStateValue(p.valueObservation(n),seat))!==JSON.stringify(before))throw Error('R4 full/compact differs');const plan=p.resourceSpec(n).plans.find(p=>p.goal.kind==='route'&&p.goal.family==='orbit'&&p.goal.planetId==='venus'),r=p.expandResourcePlan(n,plan,()=>null);if(!r.complete||r.goalStatus!=='completed'||r.submissions!==2||v.evaluateStateValue(r.node.observation,seat).total!==total)throw Error('Native auto-target orbit marked unreachable or quote handoff differs');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('R4 plan mutated source/RNG');}finally{p.close();}
    }window.__finalRoundProbeRoute={ok:true};}finally{c.dispose();}
  })()`,
  successExpression:'window.__finalRoundProbeRoute?.ok === true',
  obligation:'Actual Browser R4 probe retains7 current-wallet mission potential; two auto-target Venus orbit/income plans complete with unchanged135/136 total and source/RNG',
  counterexample:'Final-round window remains closed, automatic orbit is infeasible, stale page module or compact/Native handoff differs',
}), Object.freeze({
  id:'production-next-income-probe-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiProbeCapital?.nextIncomeLaunchReplacement && window.SetiStateValue && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const cp=await fetch('/reports/ai-foundation-20261107/orange-tech-fixed-tail-v1/scan-launch-final-tail-native-control-20261107-v1.checkpoint.json').then(r=>r.json()),seat='player-white',source=cp.branches['orange2-launch'].envelope,seed=JSON.parse(source.committedState).meta.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,totals={};
    try{for(const name of ['orange2-skip','orange2-launch']){const e=cp.branches[name].envelope;if(!c.lifecycle.restore(e).ok)throw Error('next-income real Native restore');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=p.openRoot(),v=window.SetiStateValue.evaluateStateValue(root.observation,seat);if(v.components.probePotential!==(name==='orange2-launch'?2:0)||v.components.income!==11.5)throw Error('replacement or income booked twice');if(JSON.stringify(window.SetiStateValue.evaluateStateValue(p.valueObservation(root),seat))!==JSON.stringify(v))throw Error('next-income compact disagrees');totals[name]=v.total;if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('next-income root/RNG changed');}finally{p.close();}}if(totals['orange2-launch']-totals['orange2-skip']!==1)throw Error('Native realized2C-minus1E tradeoff not represented');window.__nextIncomeProbeSmoke={ok:true};}finally{c.dispose();}
  })()`,
  successExpression:'window.__nextIncomeProbeSmoke?.ok === true',
  obligation:'Real R3 pre-PASS double source preserves2C Earth probe replacement, only1E cost, known-income principal counted once and full/compact Native agreement',
  counterexample:'Book future money twice, use blind future card or fabricated successor, stale browser module, lose investment at PASS or mutate source/RNG',
}), Object.freeze({
  id:'production-singleton-resource-ranking',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiResourceDemand && window.SetiAnalysisPort && window.SetiStateValue)',
  actionExpression:`(async()=>{
    const factor=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v208-income-factor-prefixes-20261106-v1.checkpoint.json').then(r=>r.json()),envelope=factor.common.envelope,seat='player-white',seed=JSON.parse(envelope.committedState).meta.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    try{if(!c.lifecycle.restore(envelope).ok)throw Error('singleton Native restore');const original=JSON.stringify(c.lifecycle.save().envelope),session=envelope.session.session,actions=c.inspect().session.decision.choices,goal={kind:'analyze',required:{energy:0},incomeCardId:'card-18-0'},choice=window.SetiResourceDemand.incomeChoice({state:session.workingState,seatId:seat,goal,actions});if(choice.kind!=='fixed'||actions.find(a=>a.actionId===choice.actionId)?.target.cardInstanceId!==goal.incomeCardId)throw Error('singleton income source changed');const p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=p.openRoot(),after=p.expand(root,choice.actionId),v=window.SetiStateValue;if(JSON.stringify(v.evaluateStateValue(after.observation,seat))!==JSON.stringify(v.evaluateStateValue(p.valueObservation(after),seat)))throw Error('singleton Native income value views differ');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('singleton root/RNG changed');window.__singletonResourceSmoke={ok:true};}finally{p.close();}}finally{c.dispose();}
  })()`,
  successExpression:'window.__singletonResourceSmoke?.ok === true',
  obligation:'One bound feasible real Native income chooses the same card and executes normally with full/compact value parity',
  counterexample:'Bypassing feasibility or protection, confusing an unpriced ranking with zero loss, different Native source or root/RNG mutation',
}), Object.freeze({
  id:'production-company-fixed-intent',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiCardPickPlanning && window.SetiStateValue)',
  actionExpression:`(async()=>{
    const proof=await fetch('/reports/ai-foundation-20261107/company-fixed-intent-v1/native-three-input-control-20261107-v1.json').then(r=>r.json()),seat='player-white',seed=JSON.parse(proof.sourceEnvelope.committedState).meta.seed,v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    try{for(const stage of [0,1,2]){const envelope=stage?proof.steps[stage-1].envelope:proof.sourceEnvelope;if(!c.lifecycle.restore(envelope).ok)throw Error('company source restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{p.setCardPickPlanning(true);p.setResourcePlanning(true);const root=p.openRoot(),spec=p.cardPickSpec(root),action=stage===0?root.legalActions.find(a=>a.family==='industry'&&a.target.abilityId==='deepspace_swap_cards'):root.legalActions.find(a=>a.actionId===spec.selectedActionId),intent=spec.companySwap;if(!action||intent?.selection.cardId!==proof.intent.selection.cardId||intent?.discardIds[0]!==proof.intent.discardIds[0])throw Error('company fixed purpose lost');const result=p.expandWithCardPick(root,action.actionId,()=>null),stats=p.getDiagnostics().cardPick;if(!result.complete||result.submissions!==3-stage||stats.companyIntentReusesThisRoot<2-stage||stats.companyIntentRecoveriesThisRoot!==(stage?1:0))throw Error('company intent reranked or recovery differs');if(JSON.stringify(result.prefixes.map(r=>r.action.target))!==JSON.stringify(proof.steps.slice(stage).map(r=>r.action.target)))throw Error('company Native targets differ');if(JSON.stringify(v.evaluateStateValue(result.node.observation,seat))!==JSON.stringify(v.evaluateStateValue(p.valueObservation(result.node),seat)))throw Error('company observation views differ');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('company root/RNG changed');}finally{p.close();}}window.__companyFixedIntentSmoke={ok:true};}finally{c.dispose();}
  })()`,
  successExpression:'window.__companyFixedIntentSmoke?.ok === true',
  obligation:'Source-selected company intention is shared across two actual Native menus and rebuilt identically at both cold checkpoints; three inputs remain charged',
  counterexample:'Repeated portfolio ranking, stale plan across changed Native source, missing browser module, warm/cold target or observation drift',
}), Object.freeze({
  id:'production-publicity-handoff',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPublicityCapital && window.SetiStateValue && window.SetiRuleComposition)',
  actionExpression:`(async()=>{
    const [proof,source]=await Promise.all([fetch('/reports/ai-foundation-20261107/publicity-handoff-v1/native-publicity-handoff-20261107-v1.json').then(r=>r.json()),fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v204-actual-safety-choice-native-20261106-v1.json').then(r=>r.json())]),seat='player-white',seed=JSON.parse(proof.record.before.committedState).meta.seed,v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
    try{for(const phase of ['before','after']){if(!c.lifecycle.restore(proof.record[phase]).ok)throw Error('handoff restore');const original=JSON.stringify(c.lifecycle.save().envelope),mask=o=>window.SetiRuleComposition.sanitizeHiddenInformationObservation(source.branches.safety.observation,o,{code:'hidden_card_reveal'}),full=mask(c.projection({role:'player',playerId:seat}).state),compact=mask(c.projection({role:'player',playerId:seat,valueOnly:true}).state),value=v.evaluateStateValue(full,seat);if(value.total!==116.5||JSON.stringify(value)!==JSON.stringify(v.evaluateStateValue(compact,seat)))throw Error('publicity handoff value differs');const facts={...window.SetiProbeCapital.factsFromObservation(full,seat),supply:full.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0};if(v.purposeCapital(facts).analysisPublicityPlan.value!==(phase==='before'?4:0))throw Error('publicity handoff double counted or lost');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('handoff mutated root/RNG');}if(!c.lifecycle.restore(proof.record.before).ok)throw Error('handoff original restore');window.__publicityHandoffSmoke={ok:true};}finally{c.dispose();}
  })()`,
  successExpression:'window.__publicityHandoffSmoke?.ok === true',
  obligation:'A real post-analysis known-owned publicity corner hands off4V to funded research while both browser observation views stay116.5',
  counterexample:'Computer clearing destroys still-owned research funding, public hand facts differ, double counting or root/RNG mutation',
}), Object.freeze({
  id:'production-deferred-publicity-capital',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPublicityCapital && window.SetiAnalysisPort && window.SetiStateValue && window.SetiProbeCapital)',
  actionExpression:`(async()=>{
    const control=await fetch('/reports/ai-foundation-20261107/publicity-deferral-learning-v1/native-commutation-20261107-v1.json').then(r=>r.json()),seat='player-white',v=window.SetiStateValue;
    for(const f of control.results){const seed=JSON.parse(f.sourceEnvelope.committedState).meta.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.sourceEnvelope).ok)throw Error('deferred root restore');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);const root=p.openRoot(),full=root.observation,compact=p.valueObservation(root);if(full.selfState.turnCardBonusCount!==0||v.evaluateStateValue(full,seat).total!==f.arms.early.value.total)throw Error('preparation not priced before corner');if(JSON.stringify(v.evaluateStateValue(full,seat))!==JSON.stringify(v.evaluateStateValue(compact,seat)))throw Error('deferred compact differs');if(p.resourceSpec(root).plans.some(p=>p.goal.kind==='analysis-publicity'))throw Error('future funding still forces immediate discard');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('deferred root changed');}finally{p.close();}try{for(const arm of ['early','late']){if(!c.lifecycle.restore(f.arms[arm].envelope).ok)throw Error('deferred endpoint restore');if(v.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat).total!==f.arms.early.value.total)throw Error('prepared capital counted twice');}if(!c.lifecycle.restore(f.sourceEnvelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('deferred root/RNG not restored');}finally{c.dispose();}}window.__deferredPublicityCapitalSmoke={ok:true};
  })()`,
  successExpression:'window.__deferredPublicityCapitalSmoke?.ok === true',
  obligation:'Known publicity suppliers carry their finite funded purpose before Native use; two exact early/late endpoints and all observation views agree',
  counterexample:'Only burning a valuable card creates forecast value, missing0bonus fact activates unsafe quote, double-counted preparation, browser module missing or root/RNG changes',
}), Object.freeze({
  id:'production-public-alien-offer',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiAlienAmiba?.getPublicTraceState && window.SetiStateValue && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261107/anonymous-data-continuation-v1/actual156-blue4-known-data-native-20261107-v1.json').then(r=>r.json()),seed=JSON.parse(f.root.committedState).meta.seed,seat='player-white',v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.root).ok)throw Error('public root restore');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});const root=p.openRoot();if(root.observation.publicState.board.aliens.amibaTraces.displayedCardIndex!==9)throw Error('public root display missing');const pending=p.expand(root,f.sequence[0]);const blind=p.expand(pending,pending.legalActions.find(a=>a.target.source==='blind').actionId);if(blind.observation.selfState.hand.filter(c=>c.hidden).length!==2)throw Error('blind became known');let n=p.expand(pending,pending.legalActions.find(a=>a.target.source==='display').actionId);for(const id of [null,...f.sequence.slice(2,-1)]){if(id)n=p.expand(n,id);const full=n.observation,compact=p.valueObservation(n);if(!full.selfState.hand.some(c=>c.id==='alien-amiba-9-5'&&c.cardId==='amiba_9.webp')||full.selfState.hand.filter(c=>c.hidden).length!==1)throw Error('public identity lost or other draw leaked');if(full.publicState.board.aliens.amibaTraces.displayedCardIndex!==null)throw Error('next display leaked');if(JSON.stringify(v.evaluateStateValue(full,seat))!==JSON.stringify(v.evaluateStateValue(compact,seat)))throw Error('public value views differ');}if(blind.observation.selfState.hand.some(c=>c.cardId==='amiba_9.webp'))throw Error('sibling knowledge leaked');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('public root/RNG changed');window.__publicAlienOfferSmoke={ok:true};}finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__publicAlienOfferSmoke?.ok === true',
  obligation:'Root-visible alien display identity survives its real Native acquisition and fixed data plan; blind sibling and next refill stay unknown',
  counterexample:'UI/public projection disagree, known card is masked, sibling or refill leaks, value-only differs or root/RNG changes',
}), Object.freeze({
  id:'production-anonymous-data-continuation',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiStateValue && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261107/anonymous-data-continuation-v1/actual156-blue4-known-data-native-20261107-v1.json').then(r=>r.json()),seed=JSON.parse(f.root.committedState).meta.seed,seat='player-white',v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.root).ok)throw Error('anonymous root restore');const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});let n=p.openRoot();n=p.expand(n,f.sequence[0]);n=p.expand(n,n.legalActions.find(a=>a.target.choiceId==='amiba:blind').actionId);if(n.status!=='stable')throw Error('two-card reward cut known data');const o=p.valueObservation(n),hidden=o.selfState.hand.filter(c=>c.hidden),spec=p.turnTailSummary(n,'blue-end-turn');if(hidden.length!==2||hidden.some(c=>c.id||c.cardId)||v.evaluateStateValue(o,seat).total!==138)throw Error('two-card anonymous quantity/value');if(!spec||spec.requiredNativeInputs!==5||spec.netGain!==2)throw Error('known five-input suffix');for(const id of f.sequence.slice(2,-1))n=p.expand(n,id);if(v.evaluateStateValue(p.valueObservation(n),seat).total!==140||n.status!=='information-barrier')throw Error('Native data endpoint');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('anonymous root/RNG changed');window.__anonymousDataContinuationSmoke={ok:true};}finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__anonymousDataContinuationSmoke?.ok === true',
  obligation:'Two anonymous newly held cards retain the same root-known held-data plan, with a five-input scalar matching independent Native140 and no identity use',
  counterexample:'Hand-count gate cuts a safe known tail, new identities enter payment, portfolio differs from Native or root/RNG changes',
}), Object.freeze({
  id:'production-known-postdraw-tail',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiStateValue && window.SetiResourceDemand)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261105/third-round-teacher-v1/',f=await fetch(F+'v239-actual-before-132-root-20261106-v1.json').then(r=>r.json()),cp=await fetch(F+'v239-free-alien-card-boundary-control-20261106-v1.checkpoint.json').then(r=>r.json()),seed=f.source.seed,seat=f.seatId,v=window.SetiStateValue,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('postdraw root restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});let node=p.openRoot();for(const id of cp.contexts['387'].path)node=p.expand(node,id);node=p.expand(node,cp.contexts['387'].branches.blind.acceptedActionId);if(node.status!=='stable')throw Error('free card lost a certified known tail');const compact=p.valueObservation(node),full=node.observation,spec=p.turnTailSummary(node,'data-end-turn');if(!spec||spec.requiredNativeInputs!==6||v.sumValueParts([v.evaluateStateValue(compact,seat).total,spec.netGain])!==125.25)throw Error('known six-input tail value missing');if(JSON.stringify(v.evaluateStateValue(full,seat))!==JSON.stringify(v.evaluateStateValue(compact,seat)))throw Error('postdraw compact/full disagree');if(compact.selfState.hand.filter(c=>c.hidden).length!==1||compact.selfState.hand.filter(c=>c.hidden).some(c=>c.id||c.cardId))throw Error('anonymous hand leaked an identity');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('postdraw root/RNG changed');const teacher=await fetch('/reports/ai-foundation-20261106/analysis-blue-choice-v1/teacher167-root-20261106-v1.json').then(r=>r.json());if(!c.lifecycle.restore(teacher.compositionEnvelope).ok)throw Error('known data root restore');const dataRoot=JSON.stringify(c.lifecycle.save().envelope),q=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{q.setResourcePlanning(true);q.setMovementPlanning(true);q.setCardPickPlanning(true);q.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});let n=q.openRoot();for(const id of ['play_card:5d3aef4d','choose_card:3fd1e1f1','choose_target:4ca50ef1'])n=q.expand(n,id);if(n.status!=='stable')throw Error('blind draw cut known data');const knownTail=q.turnTailSummary(n,'data-end-turn');if(!knownTail||knownTail.requiredNativeInputs!==5||v.sumValueParts([v.evaluateStateValue(q.valueObservation(n),seat).total,knownTail.netGain])!==130.08333333333334)throw Error('known five-input proof disagrees with Native');const r=q.expandResourcePlan(n,q.resourceSpec(n).plans[0],()=>null);if(!r.complete||r.submissions!==4||r.node.status!=='information-barrier')throw Error('fixed four-input plan was not materialized');if(v.evaluateStateValue(q.valueObservation(r.node),seat).total!==130.08333333333334)throw Error('fixed Native value mismatch');if(JSON.stringify(c.lifecycle.save().envelope)!==dataRoot)throw Error('fixed data root/RNG changed');}finally{q.close();}window.__knownPostdrawTailSmoke={ok:true};}finally{p.close();c.dispose();}
  })()`,
  successExpression:'window.__knownPostdrawTailSmoke?.ok === true',
  obligation:'Actual free Amiba reward retains only a certified root-known currency-income/blue/end flow; unknown hand identity stays opaque and Native snapshot unchanged',
  counterexample:'Browser drops the known tail, exposes a new identity, disagrees with compact value or invents a successor',
}), Object.freeze({
  id:'production-scalar-capital-cache',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiStateValue?.purposeCapitalValue && window.SetiProbeCapital && window.SetiResourceDemand)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v239-actual-before-132-root-20261106-v1.json').then(r=>r.json()),state=JSON.parse(f.compositionEnvelope.committedState),owner=state.players.players.find(p=>p.id===f.seatId),v=window.SetiStateValue,facts={...window.SetiProbeCapital.factsFromState(state,owner),supply:state.tech,researchCost:6,analyzeEnergyCost:0},before=JSON.stringify(state);
    for(const credits of [owner.resources.credits,0,1]){const next=structuredClone(facts);next.player.credits=credits;const full=v.purposeCapital(next).total;if(v.purposeCapitalValue(next)!==full||v.purposeCapitalValue(structuredClone(next))!==full)throw Error('cached full-input scalar or changed wallet disagrees');}
    const ordered={credits:90.66666666666667,energy:4.142857142857143,publicity:71.45454545454545,availableData:41.76923076923077,additionalPublicScan:17.647058823529413,handSize:3},reversed=Object.fromEntries(Object.entries(ordered).reverse());for(const weights of [ordered,reversed])if(v.purposeCapitalValue(facts,weights)!==v.purposeCapital(facts,weights).total)throw Error('custom input order lost its formal arithmetic');
    if(window.SetiResourceDemand.planningCapital(state,owner)!==v.purposeCapital(facts).total)throw Error('production numeric planning bypassed shared value');if(JSON.stringify(state)!==before)throw Error('scalar quote mutated its source');window.__scalarCapitalCacheSmoke={ok:true};
  })()`,
  successExpression:'window.__scalarCapitalCacheSmoke?.ok === true',
  obligation:'Browser mutable numeric planning shares exact complete-input scalar quotes and rekeys changed wallets without altering full-value contracts',
  counterexample:'Missing page API, partial or stale cache key, changed wallet not repriced, or a caller-owned source is frozen/mutated',
}), Object.freeze({
  id:'production-blue-data-analysis',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAmibaAnalysisCapital && window.SetiStateValue && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v254-blue-data-before-analysis-root-20261106-v1.json').then(r=>r.json()),e=structuredClone(f.compositionEnvelope),state=JSON.parse(e.committedState),seat=f.seatId,seed=state.meta.seed,v=window.SetiStateValue,p=state.players.players.find(p=>p.id===seat),card=p.reservedCards.find(c=>c.cardId==='amiba_9.webp');p.completedTaskCount=2;p.taskState={staleLegacy:true};card.cardEffectState.consumedTriggerIds=['amiba9-blue-data-1'];e.committedState=JSON.stringify(state);
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(e).ok)throw Error('blue data fixture restore');
    const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state;
    try{const o=observe(),owner=o.publicState.players.find(p=>p.playerId===seat),facts={...window.SetiProbeCapital.factsFromObservation(o,seat),supply:o.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0},q=v.purposeCapital(facts).analysisPlan;if(owner.completedTaskCount!==2||q.selected?.blueDataTrigger?.ruleId!=='amiba9-blue-data-2'||q.selected.blueDataTrigger.gainedData!==1||q.selected.endpoint.resources.completedTaskCount!==3)throw Error('canonical completion or one-event-one-slot quote disagrees');
      const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const root=port.openRoot();if(JSON.stringify(v.evaluateStateValue(port.valueObservation(root),seat))!==JSON.stringify(v.evaluateStateValue(root.observation,seat)))throw Error('compact completion facts disagree');}finally{port.close();}
      for(const accept of [a=>a.family==='analyze',a=>a.target?.choiceId==='trace:1:blue:amiba:2',a=>a.target?.ruleId==='amiba9-blue-data-2']){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(accept);if(!a)throw Error('missing Native blue data input');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);if(!r.ok)throw Error('Native blue data rejected');}
      const after=observe();if(after.publicState.players.find(p=>p.playerId===seat).completedTaskCount!==3||after.selfState.reservedCards.some(c=>c.id===card.id))throw Error('last slot Native consumption or completion projection wrong');if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('blue data root/RNG changed');window.__blueDataAnalysisSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__blueDataAnalysisSmoke?.ok === true',
  obligation:'Canonical completion count, one blue trigger slot and the consumed-card analysis endpoint agree in production Browser, full and compact values',
  counterexample:'Legacy taskState replaces real completion count, both blue slots are priced for one event, final-slot card remains reserved or root/RNG changes',
}), Object.freeze({
  id:'production-income-choice-consistency',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiIncomeCardOrder && window.SetiResourceDemand && window.SetiAnalysisPort)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261105/third-round-teacher-v1/',f=await fetch(F+'v253-actual-before-142-root-20261106-v1.json').then(r=>r.json()),control=await fetch(F+'v254-known-blue-data-native-control-20261106-v1.json').then(r=>r.json()),state=JSON.parse(f.compositionEnvelope.committedState),seat=f.seatId,seed=state.meta.seed,demand=window.SetiResourceDemand,initial=demand.catalog({state,seatId:seat,requirements:window.SetiProductionKernel.getResourceGoalRequirements(state,seat)}).find(g=>g.kind==='income');if(initial?.incomeCardId!=='card-49-0')throw Error('initial income tie must preserve amiba9');
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('income fixture restore');const original=JSON.stringify(c.lifecycle.save().envelope),legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),submit=test=>{const d=c.inspect().session?.decision,a=legal().find(test);if(!a)throw Error('missing income Native choice');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('income Native rejected');};
    try{submit(a=>a.family==='place_data');submit(a=>a.target?.target==='computer');const current=c.lifecycle.save().envelope.session.session.workingState,actions=legal(),plain={kind:'income',targetComputerSlot:4,required:{}},chosen=demand.incomeChoice({state:current,seatId:seat,goal:plain,actions}),shuffled=actions.map((a,i)=>({...a,actionId:'unrelated:'+String(999-i)})).reverse(),again=demand.incomeChoice({state:current,seatId:seat,goal:plain,actions:shuffled});if(actions.find(a=>a.actionId===chosen.actionId)?.target.cardInstanceId!==initial.incomeCardId||shuffled.find(a=>a.actionId===again.actionId)?.target.cardInstanceId!==initial.incomeCardId)throw Error('pending/menu-ID tie differs');
      submit(a=>a.actionId===chosen.actionId);submit(a=>a.family==='place_data');submit(a=>a.target?.target==='blueBonus'&&a.target.blueSlot===2);submit(a=>a.family==='end_turn');if(JSON.stringify(c.lifecycle.save().envelope)!==JSON.stringify(control.prefixes[6]))throw Error('income endpoint/RNG differs');if(!c.lifecycle.restore(f.compositionEnvelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('income root/RNG changed');window.__incomeChoiceConsistencySmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__incomeChoiceConsistencySmoke?.ok === true',
  obligation:'Initial and pending exact-value income ties preserve the higher-cost known card with one shared policy, regardless of menu/action IDs, and reproduce the same Native endpoint',
  counterexample:'Browser lacks shared ordering dependency, source and pending choices differ, renamed action IDs change card selection, or root/RNG mutates',
}), Object.freeze({
  id:'production-income-purpose-eligibility',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiResourceDemand && window.SetiDecisionSearch && window.SetiIncomeCardOrder)',
  actionExpression:`(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json').then(r=>r.json()),state=JSON.parse(f.compositionEnvelope.committedState),seat=f.seatId,seed=state.meta.seed,goal=window.SetiResourceDemand.catalog({state,seatId:seat,requirements:window.SetiProductionKernel.getResourceGoalRequirements(state,seat)}).find(g=>g.kind==='income'),p=state.players.players.find(p=>p.id===seat);if(!goal||window.SetiCards.getIncomeGainForCard(p.hand.find(c=>c.id===goal.incomeCardId)).energy!==1)throw Error('needed energy supplier was removed before main');
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('income purpose root restore');const original=JSON.stringify(c.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{const evaluate=window.SetiStateValue.createStateValueEvaluator(seat),r=window.SetiDecisionSearch.searchDecision({port,root:port.openRoot(),evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET});if(!r.complete||r.value<48||r.diagnostics.nativeExecutions>256)throw Error('income purpose Native window regressed');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('income purpose root/RNG changed');window.__incomePurposeEligibilitySmoke={ok:true};}finally{port.close();c.dispose();}
  })()`,
  successExpression:'window.__incomePurposeEligibilitySmoke?.ok === true',
  obligation:'Production Browser preserves the pre-main energy-income supplier and the complete Native window value, with shared cost tie ordering and unchanged root/RNG',
  counterexample:'A tied credit supplier suppresses all income preparation, loses the known48 window, omits the shared dependency or mutates the source',
}), Object.freeze({
  id:'production-company-income-priority',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiDecisionSearch && window.SetiSearchAgent)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v256-energy-income-post-main-root-20261106-v1.json').then(r=>r.json()),seat=f.seatId,seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('company income fixture restore');const original=JSON.stringify(c.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{const evaluate=window.SetiStateValue.createStateValueEvaluator(seat),r=window.SetiDecisionSearch.searchDecision({port,root:port.openRoot(),evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET});if(!r.complete||r.value<123.08333333333333||r.actionId!=='industry:e887dc52'||r.diagnostics.nativeExecutions>256)throw Error('positive known swap suppressed by income tail');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('company income root/RNG changed');window.__companyIncomePrioritySmoke={ok:true};}finally{port.close();c.dispose();}
  })()`,
  successExpression:'window.__companyIncomePrioritySmoke?.ok === true',
  obligation:'A strictly higher known company purpose precedes fixed income preparation and improves the complete Native window without card subset expansion',
  counterexample:'The greedy income tail consumes the outgoing card before the selected swap, loses its Native financing improvement or mutates root/RNG',
 }), Object.freeze({
  id:'production-analysis-publicity-preparation',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiAnalysisPort && window.SetiDecisionSearch && window.SetiSearchAgent)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261105/third-round-teacher-v1/',f=await fetch(F+'v259-analysis-publicity-post-main-root-20261106-v1.json').then(r=>r.json()),seat=f.seatId,seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('analysis publicity restore');const original=JSON.stringify(c.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
    try{port.setResourcePlanning(true);port.setCardPickPlanning(true);const root=port.openRoot(),plan=port.resourceSpec(root).plans.find(p=>p.goal.kind==='analysis-publicity'),evaluate=window.SetiStateValue.createStateValueEvaluator(seat),beforeValue=evaluate(port.valueObservation(root));if(plan)throw Error('already-owned publicity capital still forces immediate discard');const corner=root.legalActions.find(a=>a.family==='card_corner'&&a.target?.cardInstanceId==='alien-amiba-9-5');if(!corner||beforeValue!==138.75)throw Error('known preparation or real corner absent');const after=port.expand(root,corner.actionId);if(evaluate(port.valueObservation(after))!==beforeValue)throw Error('executed preparation counted twice');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('funding root/RNG changed');window.__analysisPublicityPreparationSmoke={ok:true};}finally{port.close();c.dispose();}
  })()`,
  successExpression:'window.__analysisPublicityPreparationSmoke?.ok === true',
  obligation:'A known post-main publicity corner funds the existing analysis/research continuation once, from128.25 to at least137.75 with the same reachable Native funding route and unchanged source/RNG',
  counterexample:'The fixed preparation is omitted after main, uses hidden suppliers, repeats spending or invents a Native successor',
}), Object.freeze({
  id:'production-research-order-mark',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiResearchTriggerCapital && window.SetiStateValue?.researchFunding && window.SetiProbeCapital)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261105/third-round-teacher-v1/v263-research-order-mark-native-fixture-20261106-v1.json').then(r=>r.json()),envelope=f.compositionEnvelope,state=JSON.parse(envelope.committedState),seed=state.meta.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    try{
      if(!c.lifecycle.restore(envelope).ok)throw Error('research order restore');const original=JSON.stringify(c.lifecycle.save().envelope),observe=()=>c.projection({role:'player',playerId:seat}).state,own=o=>o.publicState.players.find(p=>p.playerId===seat),o=observe(),facts={...window.SetiProbeCapital.factsFromObservation(o,seat),supply:state.tech},wallet={resources:facts.player,income:facts.player.income,startingIncome:0},funding=window.SetiStateValue.researchFunding(facts,wallet),trigger=window.SetiResearchTriggerCapital.gains(window.SetiResearchTriggerCapital.describe(facts,wallet),window.SetiStateValue.DEFAULT_WEIGHTS);
      if(!funding.newFinalMark||facts.player.score!==64||!facts.nextFinalMark.options.every(x=>x.currentValue===0)||trigger.development(['orange1','blue4']).completedTaskGain!==1||trigger.development(['blue4']).completedTaskGain!==0)throw Error('known completion mark facts missing');
      const hand=o.selfState.hand.filter(card=>card.cardId==='b_101.webp'),tech=own(o).techState,supply={stacks:{orange1:state.tech.stacks.orange1,blue4:state.tech.stacks.blue4}},v=window.SetiStateValue,joint=funding=>v.sumValueParts([v.handCapital(hand,tech,supply,3,v.DEFAULT_WEIGHTS,funding),v.researchCapital({hand,techState:tech,supply,round:3,publicity:6,researchCost:6,funding})]);
      if(joint(funding)-joint({...funding,newFinalMark:null})!==4)throw Error('held-first mark4 missing or repeated');
      for(const [name,b]of Object.entries(f.branches)){if(!c.lifecycle.restore(b.afterResearchEnvelope).ok)throw Error('native order endpoint restore');const p=own(observe());if(p.finalScore-p.score!==(name==='heldOrange1-paidBlue4'?33:29))throw Error('Native order end-game points differ');}
      if(!c.lifecycle.restore(envelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('research order root/RNG changed');window.__researchOrderMarkSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__researchOrderMarkSmoke?.ok === true',
  obligation:'Known paid/held research orders price the first earned C1 mark with one Type1 completion and match retained Native end-game totals in production Browser',
  counterexample:'Browser lacks completion/ordered-publicity ledger, ignores a zero-current-value C1, double claims the mark or changes the Native root/RNG',
}), Object.freeze({
  id:'production-dlc20-alien-exclusion',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiProductionKernel && window.SetiRuleObservation && window.SetiRandom)',
  actionExpression:`(async()=>{
    const f=await fetch('/reports/ai-foundation-20261106/dlc20-alien-legality-v1/actual-before-dlc20-178-20261106-v1.json').then(r=>r.json()),e=f.compositionEnvelope,seed=JSON.parse(e.committedState).meta.seed;
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
    try{if(!c.lifecycle.restore(e).ok)throw Error('DLC20 actual root restore');const original=JSON.stringify(c.lifecycle.save().envelope),a=c.inputPort.enumerateActions({}).find(a=>a.family==='play_card'&&a.target.cardInstanceId===f.playAction.target.cardInstanceId);if(!a)throw Error('DLC20 actual play missing '+JSON.stringify(c.inputPort.enumerateActions({})));const played=c.inputPort.submitAction(a);if(!played.ok)throw Error('DLC20 actual play rejected '+JSON.stringify(played));
      const d=c.inspect().session.decision;if(JSON.stringify(d.choices.map(a=>a.target.cardInstanceId))!==JSON.stringify(['card-60-0']))throw Error('DLC20 offers alien or omits ordinary card');const saved=JSON.stringify(c.lifecycle.save().envelope),base={decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId};
      if(c.inputPort.submitDecision({...base,choice:f.historicalIllegalChoice}).ok||JSON.stringify(c.lifecycle.save().envelope)!==saved)throw Error('DLC20 accepts alien or mutates rejected input');
      if(!c.inputPort.submitDecision({...base,choice:d.choices[0]}).ok)throw Error('DLC20 rejects ordinary');const p=JSON.parse(c.lifecycle.save().envelope.committedState).players.players.find(p=>p.id==='player-white');if(p.resources.score!==77||p.resources.publicity!==5||p.hand.length!==1||p.hand[0].cardId!=='chong_7.webp')throw Error('DLC20 normal triple corner endpoint');
      if(!c.lifecycle.restore(e).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('DLC20 root/RNG restore');window.__dlc20AlienSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__dlc20AlienSmoke?.ok === true',
  obligation:'Browser Production rejects the historical DLC20 alien discard without mutation and pays an ordinary corner exactly three times',
  counterexample:'Species cardId does not start with alien, stale historical choice bypasses legality, or repeated reward/source RNG changes',
}), Object.freeze({
  id:'production-scan-analysis-income',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiScanAnalysisIncomeUtility && window.SetiResourceDemand && window.SetiProductionKernel)',
  actionExpression:`(async()=>{
    const F='/reports/ai-foundation-20261106/scan-analysis-income-v1/',f=await fetch(F+'income176-20261106-v1.json').then(r=>r.json()),e=await fetch(F+'afterElectricIncome-20261106-v1.json').then(r=>r.json()),seed=JSON.parse(e.compositionEnvelope.committedState).meta.seed,seat='player-white';
    const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),submit=test=>{const d=c.inspect().session?.decision,a=legal().find(test);if(!a)throw Error('known scan income Native choice missing');const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('known scan income rejected '+JSON.stringify(r));};
    try{if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('income root restore');const before=JSON.stringify(c.lifecycle.save().envelope),s=f.compositionEnvelope.session.session.workingState,a=legal(),pick=window.SetiResourceDemand.incomeChoice({state:s,seatId:seat,goal:{kind:'income',required:{}},actions:a});if(a.find(a=>a.actionId===pick.actionId)?.target.cardInstanceId!=='card-60-0'||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('income ranking does not preserve funded electric purpose/root');
      if(!c.lifecycle.restore(e.compositionEnvelope).ok)throw Error('electric endpoint restore');const original=JSON.stringify(c.lifecycle.save().envelope),state=JSON.parse(e.compositionEnvelope.committedState),p=state.players.players.find(p=>p.id===seat),q=window.SetiScanAnalysisIncomeUtility.quote({state,player:p});if(q.value!==3||q.selected.scoreGain!==7||q.selected.trade!=='cards-for-energy')throw Error('scan income utility differs in Browser');const value=()=>window.SetiStateValue.evaluateStateValue(c.projection({role:'player',playerId:seat}).state,seat).total,v=value();
      submit(a=>a.family==='end_turn');submit(a=>a.target?.tradeId===q.selected.trade);for(const id of q.selected.consumedCardIds)submit(a=>a.family==='choose_payment'&&a.target?.cardInstanceId===id);submit(a=>a.family==='choose_payment'&&a.target?.confirm);submit(a=>a.family==='scan');submit(a=>a.family==='choose_target'&&a.target?.nebulaId===q.selected.normal.nebulaId);submit(a=>a.family==='choose_card'&&a.target?.nebulaId===q.selected.publicScan.nebulaId&&a.target?.cardInstanceId===q.selected.publicScan.cardInstanceId);
      for(let n=0;n<q.selected.computerPlacements;n++){submit(a=>a.family==='place_data');submit(a=>a.target?.target==='computer');}submit(a=>a.family==='end_turn');submit(a=>a.family==='analyze');submit(a=>a.target?.choiceId==='trace:'+q.selected.extraBlueSlot+':blue:state-extra');submit(a=>a.family==='end_turn');if(value()!==v+q.value||value()!==141.5)throw Error('Native scan income utility did not realize shared wallet value');if(!c.lifecycle.restore(e.compositionEnvelope).ok||JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('scan income source/RNG changed');window.__scanAnalysisIncomeSmoke={ok:true};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__scanAnalysisIncomeSmoke?.ok === true',
  obligation:'Browser fixed income selects a currently funded known scan-analysis purpose and realizes its3 utility through the same16 formal inputs with source/RNG restored',
  counterexample:'Lexical tie replaces electricity, hidden cards or exhausted tokens fund the plan, currency is spent twice, or Browser uses a different policy',
})]);
