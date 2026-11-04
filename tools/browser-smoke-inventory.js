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
    try{for(let i=0;i<13;i++){
      const saved=JSON.parse(JSON.stringify(c.lifecycle.save().envelope));if(!c.lifecycle.restore(saved).ok)throw Error('逐输入原生保存恢复失败');
      const d=c.inspect().session?.decision,actions=d?.choices||c.inputPort.enumerateActions({}),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),ai=window.SetiSearchAgent.createSearchAgent({seatId:f.seatId,analysisPort:p});
      ai.loadCheckpoint(checkpoint);const before=JSON.stringify(c.lifecycle.save().envelope),r=ai.decide({seatId:f.seatId,legalActions:actions}),a=actions.find(a=>a.actionId===r.actionId);
      if(i===0)expectedValue=r.search.value;if(!a||r.search.value!==expectedValue||JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('计划值改变或搜索污染原根');
      if(i===0){inputs=r.search.diagnostics.nativeExecutions;if(inputs<1||inputs>256)throw Error('获胜尾部没有按原生输入完整计费');}
      else if(r.search.diagnostics.planContinuation!=='hit'||r.search.diagnostics.nativeExecutions!==0)throw Error('保存恢复后丢失既定目的');
      if(i<4&&a.family!==(i%2?'choose_payment':'move'))throw Error('固定移动准备偏离证书');
      if(i>=4&&i<12&&a.family!==(i%2?'choose_target':'place_data'))throw Error('固定收入准备偏离证书');
      if(i===12&&(a.family!=='choose_card'||a.target.cardInstanceId!=='card-15-0'))throw Error('没有保留移动支付后的收入供应牌');
      if((i===2||i===3)&&r.search.analysis.movementIntentRecoveries!==1)throw Error('剩余路线未从完整证书恢复');
      checkpoint=JSON.parse(JSON.stringify(ai.createCheckpoint()));
      const out=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!out.ok)throw Error('既定输入未通过原生验证');
    }
    const observed=c.projection({role:'player',playerId:f.seatId}).state,masked={...observed,selfState:{...observed.selfState,hand:observed.selfState.hand.map(card=>knownAtRoot.has(card.id)?card:{id:card.id,hidden:true})}};if(window.SetiStateValue.evaluateStateValue(masked,f.seatId).total!==expectedValue||window.SetiStateValue.evaluateStateValue(observed,f.seatId).total<expectedValue)throw Error('盲抽前用途预测与真实兑现不一致，或提前使用了新牌身份');
    window.__winningIncomeRecovery={ok:true,inputs,restoredNativeSteps:13};
    }finally{c.dispose();}
  })()`,
  successExpression:'window.__winningIncomeRecovery?.ok === true',
  obligation:'真实页面的研究费以下受控收入计划逐输入保存原生状态与AI证书，恢复后维持已选目的和值且额外见证计入预算',
  counterexample:'付费移动之间或收入前缀完成后冷恢复偏离原计划、证书复用虚构后继、固定见证不计费或真实兑现值不同',
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
  id:'production-quiet-data-tail',file:'randomizer/index.html',
  readyExpression:'Boolean(window.SetiLocalDecisionPlans?.dataTailCompletion && window.SetiResidualDomainSession?.listFinalMarkChoices && window.SetiScienceSession?.listIncomeChoices)',
  actionExpression: `(async()=>{
    const f=await fetch('/adhoc/ai-decision-corpus-20261023-v1/case-152-20261023-v1.json').then(r=>r.json()),state=JSON.parse(f.compositionEnvelope.committedState),owner=state.players.players.find(p=>p.id===f.seatId);owner.mainActionCompleted=true;owner.resources.score=23;
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
      if(!r.complete||r.unresolved.length||r.actionId!==reference.actionId||r.value!==reference.value||r.diagnostics.nativeExecutions>256||r.diagnostics.nativeExecutions!==reference.nativeInputs)throw Error('paid-tech funding contexts were not shared correctly');
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
      if(window.SetiResourceDemand.planningCapital(s,p)!==window.SetiStateValue.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential'].map(k=>v.components[k])))throw Error('状态/观察用途分离');
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
  try{for(const row of w.checkpoints){if(!c.lifecycle.restore(row.checkpoint.coreState.compositionEnvelope).ok)throw Error('sector asset checkpoint restore');const before=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,v=window.SetiStateValue.evaluateStateValue(o,seat),s=JSON.parse(c.lifecycle.save().envelope.committedState),p=s.players.players.find(p=>p.id===seat);if(v.total!==75.5||window.SetiResourceDemand.planningCapital(s,p)!==['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential'].reduce((n,k)=>n+v.components[k],0))throw Error('known sector/analysis capital differs between native prefixes or browser/state');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('sector quote changed original root/RNG');}window.__knownSectorAnalysisSmoke={ok:true};}finally{c.dispose();}})()`,
 successExpression:'window.__knownSectorAnalysisSmoke?.ok === true',
 obligation:'真实浏览器加载已知扇区与现有数据准备估值，四个原生前缀均兑现75.5并与状态准备一致',
 counterexample:'页面漏装领域报价、重复计价、编造扇区重置后探测任务或写入原根/RNG',
}), Object.freeze({
 id:'production-computer-preinvestment',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiValueArithmetic && window.SetiStateValue?.prepaidComputerCapital && window.SetiProductionKernel)',
 actionExpression:`(async()=>{const record=await fetch('/reports/research/e987ead2.9491f13b.quick-400.json').then(r=>r.json()),checkpoint=await fetch('/'+record.roundEnds[0].checkpointPath).then(r=>r.json()),control=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v179-first-round-analysis-tradeoff-native-20261105-v1.json').then(r=>r.json()),seat='player-white',seed=JSON.parse(checkpoint.coreState.committedState).meta.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition,values=window.SetiStateValue;
  try{for(const [name,envelope] of [['retained',checkpoint.coreState.compositionEnvelope],['prepared',control.rows[0].envelope],['consumed',control.rows[1].envelope]]){if(!c.lifecycle.restore(envelope).ok)throw Error('computer asset restore');const before=JSON.stringify(c.lifecycle.save().envelope),o=c.projection({role:'player',playerId:seat}).state,v=values.evaluateStateValue(o,seat),s=JSON.parse(envelope.committedState),p=s.players.players.find(p=>p.id===seat),capital=values.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential'].map(k=>v.components[k]));if(window.SetiResourceDemand.planningCapital(s,p)!==capital)throw Error('computer state/observation accounting differs');if(name==='retained'&&(v.total!==values.sumValueParts([65.5,11/3])||v.components.analysisPotential!==11/3))throw Error('retained four data missing');if(name!=='retained'&&v.total!==68.5)throw Error('native analysis does not realize quote');if(name==='consumed'&&v.components.analysisPotential!==0)throw Error('cleared computer retains credit');if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('computer quote changed root/RNG');}window.__computerPreinvestmentSmoke={ok:true};}finally{c.dispose();}})()`,
 successExpression:'window.__computerPreinvestmentSmoke?.ok === true',
 obligation:'浏览器加载统一估值账本，保留四格、准备及清空三个原生检查点与状态准备一致，无重复计价或原根/RNG变更',
 counterexample:'Node新增电脑资产但页面漏装依赖、分析清空后仍认领预投入或浮点求和导致状态/观察分歧',
}), Object.freeze({
 id:'production-purpose-realization',file:'randomizer/index.html',
 readyExpression:'Boolean(window.SetiDecisionSearch && window.SetiStateValue && window.SetiAnalysisPort)',
 actionExpression:`(async()=>{const f=await fetch('/reports/ai-foundation-20261104/two-rounds-teacher-v2/v184-actual-step091-20261105-v1.json').then(r=>r.json()),seat=f.seatId,seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('realization root restore');const original=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{const evaluate=window.SetiStateValue.createStateValueEvaluator(seat),root=p.openRoot(),options={port:p,evaluate,...window.SetiSearchAgent.OPTIONS,modelKey:evaluate.modelKey,budget:window.SetiSearchAgent.BUDGET},r=window.SetiDecisionSearch.searchDecision({...options,root}),a=root.legalActions.find(a=>a.actionId===r.actionId),pass=r.roots.find(row=>root.legalActions.find(a=>a.actionId===row.actionId)?.family==='pass');if(!r.complete||a?.family!=='place_data'||r.value!==85.08333333333333||pass?.value!==r.value||!(r.realization>pass.realization)||r.diagnostics.nativeExecutions>256)throw Error('same-value current purpose still deferred or scalar changed');const saved=p.exportPlan(r.planContinuation);if(!saved||!saved.rows.every(row=>Number.isFinite(row.realization)))throw Error('realization plan evidence missing');p.close();const token=p.importPlan(saved),reopened=p.openRoot(),again=window.SetiDecisionSearch.searchDecision({...options,root:reopened,planContinuation:token});if(!again.complete||again.actionId!==r.actionId||again.value!==r.value||again.realization!==r.realization||again.diagnostics.nativeExecutions!==0)throw Error('saved realization plan not reused');if(JSON.stringify(c.lifecycle.save().envelope)!==original)throw Error('realization search changed root/RNG');window.__purposeRealizationSmoke={ok:true};}finally{p.close();c.dispose();}})()`,
 successExpression:'window.__purposeRealizationSmoke?.ok === true',
 obligation:'真实第91根标量同值时落实分析准备，保存恢复仍复用相同目的/兑现证据且零新模拟，原根/RNG不变',
 counterexample:'页面仍在同值时PASS、额外调整标量、用伪造后继计算排序，或计划恢复丢失兑现证据',
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
})]);
