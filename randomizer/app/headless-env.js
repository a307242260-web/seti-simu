"use strict";

const fs = require("node:fs");
const path = require("node:path");

function hashSeed(seed) {
  const text = String(seed ?? "seti-headless");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return function seededRandom() {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function createClassList() {
  const set = new Set();
  return {
    add(...tokens) {
      tokens.filter(Boolean).forEach((token) => set.add(token));
    },
    remove(...tokens) {
      tokens.forEach((token) => set.delete(token));
    },
    toggle(token, force) {
      if (force === true) {
        set.add(token);
        return true;
      }
      if (force === false) {
        set.delete(token);
        return false;
      }
      if (set.has(token)) {
        set.delete(token);
        return false;
      }
      set.add(token);
      return true;
    },
    contains(token) {
      return set.has(token);
    },
    toString() {
      return [...set].join(" ");
    },
  };
}

function createStyle() {
  const values = new Map();
  return {
    setProperty(name, value) {
      values.set(name, String(value));
    },
    removeProperty(name) {
      values.delete(name);
    },
    getPropertyValue(name) {
      return values.get(name) || "";
    },
  };
}

function createFakeElement(tagName = "div", options = {}) {
  const listeners = new Map();
  const children = [];
  const element = {
    tagName: String(tagName || "div").toUpperCase(),
    id: options.id || "",
    className: options.className || "",
    dataset: { ...(options.dataset || {}) },
    style: createStyle(),
    classList: createClassList(),
    children,
    childNodes: children,
    get options() {
      return children;
    },
    parentNode: null,
    ownerDocument: null,
    hidden: false,
    disabled: false,
    checked: Boolean(options.checked),
    value: options.value || "",
    textContent: options.textContent || "",
    innerHTML: "",
    attributes: {},
    appendChild(child) {
      if (!child) return child;
      child.parentNode = element;
      children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.flat().forEach((node) => element.appendChild(node));
    },
    replaceChildren(...nodes) {
      children.length = 0;
      nodes.flat().forEach((node) => element.appendChild(node));
    },
    removeChild(child) {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      if (child) child.parentNode = null;
      return child;
    },
    remove() {
      element.parentNode?.removeChild?.(element);
    },
    setAttribute(name, value) {
      element.attributes[name] = String(value);
      if (name === "id") element.id = String(value);
      if (name === "class") element.className = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(element.attributes, name)
        ? element.attributes[name]
        : null;
    },
    removeAttribute(name) {
      delete element.attributes[name];
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      const evt = event || {};
      evt.target = evt.target || element;
      evt.currentTarget = element;
      const handlers = listeners.get(evt.type) || [];
      handlers.forEach((handler) => handler(evt));
      return true;
    },
    click() {
      if (element.disabled) return;
      element.dispatchEvent({ type: "click", target: element, preventDefault() {}, stopPropagation() {} });
    },
    closest(selector) {
      return element.matches(selector) ? element : null;
    },
    contains(node) {
      return node === element || children.includes(node);
    },
    matches(selector) {
      const text = String(selector || "");
      if (!text) return false;
      if (text.startsWith("#")) return element.id === text.slice(1);
      if (text.startsWith(".")) return String(element.className || "").split(/\s+/).includes(text.slice(1));
      const dataMatch = text.match(/\[data-([a-z0-9-]+)(?:=\"?([^\]\"]+)\"?)?\]/i);
      if (dataMatch) {
        const key = dataMatch[1].replace(/-([a-z0-9])/g, (_all, char) => char.toUpperCase());
        if (!Object.prototype.hasOwnProperty.call(element.dataset, key)) return false;
        return dataMatch[2] == null || String(element.dataset[key]) === dataMatch[2];
      }
      return false;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    },
    focus() {},
    blur() {},
    scrollIntoView() {},
    cloneNode() {
      return createFakeElement(tagName, options);
    },
  };
  if (element.className) {
    element.className.split(/\s+/).filter(Boolean).forEach((token) => element.classList.add(token));
  }
  return element;
}

function createFakeDocument() {
  const byId = new Map();
  const selectorLists = new Map();
  const listeners = new Map();
  const body = createFakeElement("body", { id: "body" });
  const document = {
    readyState: "complete",
    body,
    documentElement: createFakeElement("html"),
    createElement(tagName) {
      const element = createFakeElement(tagName);
      element.ownerDocument = document;
      return element;
    },
    createDocumentFragment() {
      return createFakeElement("#fragment");
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: String(text || "") };
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event?.type) || [];
      handlers.forEach((handler) => handler(event));
      return true;
    },
    getElementById(id) {
      const key = String(id || "");
      if (!byId.has(key)) {
        const element = createFakeElement("div", { id: key });
        element.ownerDocument = document;
        byId.set(key, element);
      }
      return byId.get(key);
    },
    querySelector(selector) {
      const list = selectorLists.get(String(selector)) || [];
      return list[0] || null;
    },
    querySelectorAll(selector) {
      return selectorLists.get(String(selector)) || [];
    },
  };
  body.ownerDocument = document;

  function registerId(id, options = {}) {
    const element = document.getElementById(id);
    Object.assign(element.dataset, options.dataset || {});
    if (options.className) {
      element.className = options.className;
      options.className.split(/\s+/).filter(Boolean).forEach((token) => element.classList.add(token));
    }
    if (options.value != null) element.value = options.value;
    if (options.checked != null) element.checked = Boolean(options.checked);
    return element;
  }

  function registerSelector(selector, elements) {
    selectorLists.set(selector, elements);
    return elements;
  }

  registerSelector(".app-wrap", [registerId("app-wrap", { className: "app-wrap debug-collapsed log-collapsed debug-tools-disabled state-log-disabled" })]);
  registerSelector(".planets-reference img", [createFakeElement("img")]);
  registerSelector(".land-target-label", [createFakeElement("label")]);

  const alienPanels = [1, 2].map((slot) => createFakeElement("section", {
    className: "alien-panel",
    dataset: { alienSlot: String(slot) },
  }));
  const alienTraceLayers = [1, 2].map((slot) => createFakeElement("div", {
    className: "alien-trace-layer",
    dataset: { alienSlot: String(slot) },
  }));
  const alienJiuzheLayers = [1, 2].map((slot) => createFakeElement("div", {
    className: "alien-jiuzhe-trace-layer",
    dataset: { alienSlot: String(slot) },
  }));
  const thresholds = [1, 2].map((slot) => createFakeElement("div", {
    className: "alien-jiuzhe-thresholds",
    dataset: { alienSlot: String(slot) },
  }));
  const finalScoreTiles = ["a", "b", "c", "d"].map((id) => createFakeElement("img", {
    className: "final-score-tile",
    dataset: { finalId: id },
  }));
  const finalScoreWraps = ["a", "b", "c", "d"].map((id) => createFakeElement("button", {
    className: "final-score-tile-wrap",
    dataset: { finalId: id },
  }));
  registerSelector(".alien-panel", alienPanels);
  registerSelector(".alien-trace-layer", alienTraceLayers);
  registerSelector(".alien-jiuzhe-trace-layer", alienJiuzheLayers);
  registerSelector(".alien-jiuzhe-thresholds", thresholds);
  registerSelector(".alien-yichangdian-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-fangzhou-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-banrenma-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-chong-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-amiba-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-aomomo-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-runezu-card-area", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".alien-banrenma-scoremarks", [createFakeElement("div"), createFakeElement("div")]);
  registerSelector(".final-score-tile-wrap", finalScoreWraps);
  registerSelector(".final-score-tile", finalScoreTiles);
  registerSelector(".tech-tile[data-tech-id]", []);

  const startAlienIds = ["九折", "半人马", "奥陌陌", "异常点", "方舟", "符文族", "虫", "阿米巴"];
  const startAlienCheckboxes = startAlienIds.map((alienId, index) => {
    const element = registerId(`start-alien-${index + 1}`, {
      dataset: { startAlienId: alienId },
      checked: true,
    });
    element.closest = (selector) => {
      if (selector === ".start-screen-alien-choice") return createFakeElement("label", { className: "start-screen-alien-choice" });
      return element.matches(selector) ? element : null;
    };
    return element;
  });
  registerSelector("[data-start-alien-id]", startAlienCheckboxes);

  const startIndustryLabels = [
    "层云核心",
    "芬威克研究中心",
    "赫利昂联合体",
    "寰宇动力",
    "任务中继站",
    "哨兵探测网络",
    "深空探测",
    "图灵系统",
    "未来跨度研究所",
    "异星实验室",
    "宇宙战略集团",
    "原教旨主义",
    "星际海盗",
  ];
  const startIndustryCheckboxes = startIndustryLabels.map((label, index) => {
    const element = registerId(`start-industry-${index + 1}`, {
      dataset: { startIndustryLabel: label },
      checked: true,
    });
    element.closest = (selector) => {
      if (selector === ".start-screen-company-choice") return createFakeElement("label", { className: "start-screen-company-choice" });
      return element.matches(selector) ? element : null;
    };
    return element;
  });
  registerSelector("[data-start-industry-label]", startIndustryCheckboxes);

  registerId("start-ai-difficulty", { value: "laughable" });
  registerId("start-player-count", { value: "4" });
  registerId("start-debug-enabled", { checked: false });
  registerId("start-action-log-enabled", { checked: true });
  registerId("start-screen-start-button");
  registerId("start-screen-continue-button");
  registerId("start-screen");
  registerId("start-debug-toggle-text");
  registerId("start-action-log-toggle-text");
  registerId("start-alien-options");
  registerId("start-industry-options");

  return document;
}

function createFakeWindow(document) {
  const storage = new Map();
  const listeners = new Map();
  return {
    document,
    location: { search: "" },
    navigator: { userAgent: "node-headless" },
    URLSearchParams,
    structuredClone,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event?.type) || [];
      handlers.forEach((handler) => handler(event));
    },
    setTimeout,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(() => callback(Date.now()), 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    getComputedStyle() {
      return {
        getPropertyValue() {
          return "0";
        },
      };
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    Blob,
    Image: class FakeImage {
      constructor() {
        this.width = 512;
        this.height = 512;
        this.onload = null;
        this.onerror = null;
        this._listeners = new Map();
      }

      set src(value) {
        this._src = value;
        const loadListeners = this._listeners.get("load") || [];
        if (typeof this.onload === "function") {
          setTimeout(() => this.onload(), 0);
        }
        loadListeners.forEach((handler) => setTimeout(() => handler(), 0));
      }

      get src() {
        return this._src || "";
      }

      addEventListener(type, handler) {
        if (!this._listeners.has(type)) this._listeners.set(type, []);
        this._listeners.get(type).push(handler);
      }
    },
    URL: {
      createObjectURL() {
        return "blob:headless";
      },
      revokeObjectURL() {},
    },
  };
}

function getScriptPaths() {
  const htmlPath = path.resolve(__dirname, "..", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return [...html.matchAll(/<script src="\.\/([^"]+)"/g)]
    .map((match) => path.resolve(path.dirname(htmlPath), match[1].split("?")[0]));
}

function loadBrowserBundle(windowRef) {
  const scriptPaths = getScriptPaths();
  for (const scriptPath of scriptPaths) {
    delete require.cache[scriptPath];
  }
  const appScriptPath = scriptPaths[scriptPaths.length - 1];
  for (const scriptPath of scriptPaths.slice(0, -1)) {
    require(scriptPath);
    for (const key of Object.keys(globalThis)) {
      if (key.startsWith("Seti")) {
        windowRef[key] = globalThis[key];
      }
    }
  }
  require(appScriptPath);
  return windowRef.SetiRandomizer;
}

function buildObservation(api, seed) {
  const turnState = api.getTurnState();
  const playerState = api.getPlayerState();
  const currentPlayer = api.getCurrentPlayer();
  return {
    schemaVersion: "seti-rl-observation-v1",
    seed: seed ?? null,
    currentPlayerId: turnState.currentPlayerId || currentPlayer?.id || null,
    roundNumber: turnState.roundNumber,
    turnNumber: turnState.turnNumber,
    actionCycleNumber: turnState.actionCycleNumber,
    terminal: Boolean(turnState.gameEnded),
    players: (playerState.players || []).map((player) => ({
      playerId: player.id,
      color: player.color,
      score: player.resources?.score || 0,
      credits: player.resources?.credits || 0,
      energy: player.resources?.energy || 0,
      publicity: player.resources?.publicity || 0,
      availableData: player.resources?.availableData || 0,
      handCount: (player.hand || []).length,
      reservedCount: (player.reservedCards || []).length,
    })),
  };
}

function buildReward(beforePlayer, afterPlayer, terminal) {
  const beforeResources = beforePlayer?.resources || {};
  const afterResources = afterPlayer?.resources || {};
  return {
    immediateScoreDelta: (afterResources.score || 0) - (beforeResources.score || 0),
    resourceDelta: {
      credits: (afterResources.credits || 0) - (beforeResources.credits || 0),
      energy: (afterResources.energy || 0) - (beforeResources.energy || 0),
      publicity: (afterResources.publicity || 0) - (beforeResources.publicity || 0),
      availableData: (afterResources.availableData || 0) - (beforeResources.availableData || 0),
      additionalPublicScan: (afterResources.additionalPublicScan || 0) - (beforeResources.additionalPublicScan || 0),
      handCount: ((afterPlayer?.hand || []).length) - ((beforePlayer?.hand || []).length),
    },
    terminalScoreDelta: terminal ? ((afterResources.score || 0) - (beforeResources.score || 0)) : 0,
    shaping: {},
  };
}

function createActionSelector(action) {
  const payload = action?.payload || {};
  return {
    candidateIndex: action.candidateIndex ?? action.maskIndex,
    id: action.id || action.kind || action.actionId,
    tradeId: action.tradeId ?? payload.tradeId,
    cardId: action.cardId ?? payload.cardId,
    cardInstanceId: action.cardInstanceId ?? payload.cardInstanceId,
    handIndex: action.handIndex ?? payload.handIndex,
    blueSlot: action.blueSlot ?? payload.blueSlot,
    target: action.target || null,
  };
}

function getActionPhase(kind) {
  if (kind === "end-turn") return "turn_control";
  if (["move", "quickTrade", "industry", "cardCorner", "placeData"].includes(kind)) return "quick";
  return "main";
}

function completeInitialSelections(api) {
  const initialSelectionState = api.getInitialSelectionState?.();
  const requiredInitialCount = Math.max(
    1,
    Math.round(Number(initialSelectionState?.offersByPlayerId?.[initialSelectionState.currentPlayerId]?.selectedInitialIds?.length) || 0),
  );
  while (true) {
    const selectionState = api.getInitialSelectionState?.();
    if (!selectionState || selectionState.phase !== "selecting" || !selectionState.currentPlayerId) {
      return;
    }
    const offer = api.getInitialSelectionOffer?.(selectionState.currentPlayerId);
    if (!offer) {
      throw new Error(`初始选择缺少玩家 ${selectionState.currentPlayerId} 的 offer`);
    }
    const selectedIndustry = offer.selectedIndustryId || offer.industryOptions?.[0]?.id || null;
    if (!selectedIndustry) {
      throw new Error(`玩家 ${selectionState.currentPlayerId} 初始公司候选为空`);
    }
    api.selectInitialSelectionCard?.("industry", selectedIndustry);
    const initialOptionIds = (offer.initialOptions || [])
      .slice(0, Math.max(2, requiredInitialCount || 2))
      .map((card) => card?.id)
      .filter(Boolean);
    if (initialOptionIds.length < 2) {
      throw new Error(`玩家 ${selectionState.currentPlayerId} 初始牌候选不足`);
    }
    for (const cardId of initialOptionIds) {
      api.selectInitialSelectionCard?.("initial", cardId);
    }
    const confirmResult = api.confirmInitialSelection?.();
    if (confirmResult?.ok === false) {
      throw new Error(confirmResult.message || "确认初始选择失败");
    }
  }
}

function createHeadlessEnv() {
  let api = null;
  let seed = null;
  let config = null;
  let replaySteps = [];
  let restoreRandom = null;

  function boot(resetConfig = {}) {
    const fakeDocument = createFakeDocument();
    const fakeWindow = createFakeWindow(fakeDocument);
    global.window = fakeWindow;
    global.document = fakeDocument;
    globalThis.window = fakeWindow;
    globalThis.document = fakeDocument;
    global.requestAnimationFrame = fakeWindow.requestAnimationFrame;
    global.cancelAnimationFrame = fakeWindow.cancelAnimationFrame;
    global.getComputedStyle = fakeWindow.getComputedStyle;
    global.Image = fakeWindow.Image;
    const originalRandom = Math.random;
    const seededRandom = createSeededRandom(resetConfig.seed);
    Math.random = seededRandom;
    restoreRandom = () => {
      Math.random = originalRandom;
    };
    api = loadBrowserBundle(fakeWindow);
    const startResult = api.startNewGame({
      activePlayerCount: resetConfig.activePlayerCount || 4,
      aiDifficulty: resetConfig.aiDifficulty || "laughable",
      clearStorage: false,
      message: "headless 新游戏已开始",
    });
    if (startResult?.ok === false) {
      throw new Error(startResult.message || "headless startNewGame 失败");
    }
    const playerIds = (api.getPlayerState().players || []).map((player) => player.id);
    api.configureAiAutoBattle({
      playerIds,
      aiDifficulty: resetConfig.aiDifficulty || "laughable",
      stepDelayMs: 0,
      manualDrive: true,
      suppressAutoSchedule: true,
    });
    const initialResolution = api.resolveAiToTurnBoundary({ maxSteps: 2000 });
    if (initialResolution?.ok === false) {
      const failure = initialResolution.final || initialResolution;
      const pendingState = api.getAiAutoBattleProgress?.().pendingState || null;
      const pendingSummary = pendingState
        ? `；pending=${JSON.stringify(pendingState)}`
        : "";
      throw new Error(
        `${failure.message || "headless reset 未能推进到首个决策点"}${pendingSummary}`,
      );
    }
  }

  return {
    reset(resetConfig = {}) {
      restoreRandom?.();
      seed = resetConfig.seed ?? "seti-headless";
      config = {
        seed,
        activePlayerCount: resetConfig.activePlayerCount || 4,
        aiDifficulty: resetConfig.aiDifficulty || "laughable",
      };
      replaySteps = [];
      boot(config);
      return buildObservation(api, seed);
    },
    observe() {
      return buildObservation(api, seed);
    },
    legalActions() {
      const result = api.listAiTurnActionCandidates();
      if (!result?.ok) return [];
      return (result.candidates || [])
        .filter((candidate) => candidate.available !== false)
        .map((candidate) => ({
        actionId: `${candidate.id || "candidate"}:${candidate.candidateIndex}`,
        actorPlayerId: result.currentPlayer?.id || api.getTurnState().currentPlayerId || null,
        phase: getActionPhase(candidate.id),
        kind: candidate.id || null,
        target: candidate.target || null,
        payload: {
          tradeId: candidate.tradeId || null,
          cardId: candidate.cardId || null,
          cardInstanceId: candidate.cardInstanceId || null,
          handIndex: candidate.handIndex ?? null,
          blueSlot: candidate.blueSlot ?? null,
        },
        maskIndex: candidate.candidateIndex,
        summary: candidate.label || candidate.id || "action",
        score: candidate.score ?? null,
        }));
    },
    step(action) {
      const beforeObservation = buildObservation(api, seed);
      const beforePlayerState = api.getPlayerState();
      const actorPlayerId = beforeObservation.currentPlayerId;
      const beforePlayer = (beforePlayerState.players || []).find((player) => player.id === actorPlayerId) || null;
      if (action?.actorPlayerId && action.actorPlayerId !== actorPlayerId) {
        return {
          ok: false,
          actionId: action?.actionId || action?.id || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: beforeObservation,
          legalActions: this.legalActions(),
          replayEvent: null,
          error: `动作执行者不匹配：期望 ${actorPlayerId}，收到 ${action.actorPlayerId}`,
        };
      }
      const selector = createActionSelector(action || {});
      let result;
      try {
        result = api.runAiSelectedTurnAction(selector, { maxSteps: 2000 });
      } catch (error) {
        result = { ok: false, message: error?.stack || error?.message || String(error) };
      }
      if (result?.ok === false) {
        const baseErrorMessage = result.message
          || result.resolution?.final?.message
          || result.resolution?.message
          || result.actionResult?.message
          || "执行失败";
        const pendingState = api.getAiAutoBattleProgress?.().pendingState || null;
        const recentResolution = (result.resolution?.steps || [])
          .slice(-3)
          .map((step) => step?.message)
          .filter(Boolean)
          .join(" | ");
        const errorMessage = [
          baseErrorMessage,
          recentResolution ? `recent=${recentResolution}` : null,
          pendingState ? `pending=${JSON.stringify(pendingState)}` : null,
        ].filter(Boolean).join("；");
        return {
          ok: false,
          actionId: action?.actionId || action?.id || null,
          actorPlayerId,
          reward: buildReward(beforePlayer, beforePlayer, false),
          done: this.isTerminal(),
          observation: buildObservation(api, seed),
          legalActions: this.legalActions(),
          replayEvent: null,
          error: errorMessage,
        };
      }
      const afterPlayerState = api.getPlayerState();
      const afterPlayer = (afterPlayerState.players || []).find((player) => player.id === actorPlayerId) || null;
      const observation = buildObservation(api, seed);
      const done = Boolean(observation.terminal);
      const reward = buildReward(beforePlayer, afterPlayer, done);
      const replayEvent = {
        stepIndex: replaySteps.length,
        actorPlayerId,
        action: structuredClone(action || {}),
        reward,
        preDecision: { actorPlayerId },
        postDecision: observation.terminal ? null : { actorPlayerId: observation.currentPlayerId },
        publicSummary: observation,
      };
      replaySteps.push(replayEvent);
      return {
        ok: true,
        actionId: action?.actionId || action?.id || null,
        actorPlayerId,
        reward,
        done,
        observation,
        legalActions: this.legalActions(),
        replayEvent,
      };
    },
    isTerminal() {
      return Boolean(api?.getTurnState?.().gameEnded);
    },
    getReplay() {
      return {
        schemaVersion: "seti-rl-replay-v1",
        seed,
        config: structuredClone(config || {}),
        steps: structuredClone(replaySteps),
        finalStateSummary: buildObservation(api, seed),
      };
    },
    loadReplay(replay) {
      if (!replay || replay.schemaVersion !== "seti-rl-replay-v1") {
        throw new Error("不支持的 replay schema");
      }
      this.reset(replay.config || { seed: replay.seed });
      for (const [stepIndex, event] of (replay.steps || []).entries()) {
        const result = this.step(event.action);
        if (!result.ok) {
          throw new Error(`replay 第 ${stepIndex} 步失败：${result.error || "未知错误"}`);
        }
      }
      return buildObservation(api, seed);
    },
    loadCheckpoint(checkpoint) {
      api.restoreRecoverySnapshot(checkpoint?.coreState || checkpoint?.snapshot || checkpoint);
      replaySteps = Array.isArray(checkpoint?.replaySteps) ? structuredClone(checkpoint.replaySteps) : replaySteps;
      return buildObservation(api, seed);
    },
    createCheckpoint() {
      return {
        schemaVersion: "seti-rl-checkpoint-v1",
        coreState: api.createRecoverySnapshot(),
        replayCursor: {
          seed,
          stepIndex: replaySteps.length,
        },
        replaySteps: structuredClone(replaySteps),
      };
    },
    dispose() {
      restoreRandom?.();
      restoreRandom = null;
    },
  };
}

module.exports = {
  createHeadlessEnv,
};
