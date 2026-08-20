#!/usr/bin/env node
"use strict";
// 复现：两牌换一钱（cards-for-credit）弃牌选择弹窗的实际 UI 内容。
// 起 http server + headless Chrome，用 SetiRandomizer.restore 注入存档，
// 点快速行动后 dump 弹窗 DOM（选项文本 + 卡面图片）。
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const SAVE_NAME = process.argv[2] || "seti-save-为什么登陆不了木星-v207.json";
const SAVE_PATH = path.join(repositoryRoot, "seti-saves", SAVE_NAME);

function contentType(file) {
  const map = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
  return map[path.extname(file).toLowerCase()] || "application/octet-stream";
}
function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const absolute = path.resolve(repositoryRoot, pathname.replace(/^\/+/, ""));
    if (absolute !== repositoryRoot && !absolute.startsWith(`${repositoryRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(absolute, (error, data) => {
      if (error) { response.writeHead(404).end("Not found"); return; }
      response.writeHead(200, { "content-type": contentType(absolute) }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const p = server.address().port; server.close(() => resolve(p)); });
  });
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

class CdpClient {
  constructor(url) { this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map(); this.listeners = new Set(); }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) { for (const l of this.listeners) l(message); return; }
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }
  send(method, params = {}, timeoutMs = 20000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} 超时`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function evalJs(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`页面异常: ${result.exceptionDetails.text}`);
  return result.result?.value;
}
async function waitFor(cdp, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evalJs(cdp, expression)) return;
    await delay(150);
  }
  throw new Error(`等待超时: ${label}`);
}

async function main() {
  const server = await startServer();
  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "seti-cdp-"));
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    "--disable-background-networking", "--disable-default-apps", "--disable-extensions", "--disable-gpu",
    "--disable-sync", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--remote-allow-origins=*",
    "about:blank",
  ], { stdio: "ignore" });
  try {
    const url = `http://127.0.0.1:${server.address().port}/randomizer/index.html`;
    await delay(800);
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
    const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    const cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "window.alert = (msg) => { console.warn('[ALERT]', msg); };",
    });
    await cdp.send("Page.navigate", { url });
    await waitFor(cdp, "!!window.SetiRandomizer", "SetiRandomizer 装配");
    // 测试 fetch 8301
    const fetchTest = await evalJs(cdp, `fetch("http://127.0.0.1:8301/api/saves").then((r) => r.status).catch((e) => "ERR:" + e.message)`);
    console.log("fetch 8301:", fetchTest);
    // 用 UI 读档（humanSeat 会正确设置，viewer 为当前玩家）
    await evalJs(cdp, "document.querySelector('#start-screen-load-button').click()");
    await delay(1200);
    const pickerState = await evalJs(cdp, `(() => ({
      overlayHidden: document.querySelector('#save-picker-overlay')?.hidden,
      listChildren: document.querySelector('#save-picker-list')?.children.length || 0,
      startHidden: document.querySelector('#start-screen')?.hidden,
    }))()`);
    console.log("读档弹层:", JSON.stringify(pickerState));
    if (pickerState.overlayHidden !== false) throw new Error("存档弹层未打开");
    const picked = await evalJs(cdp, `(() => {
      const buttons = [...document.querySelectorAll('#save-picker-list button')];
      const target = buttons.find((b) => b.textContent.includes(${JSON.stringify(SAVE_NAME)}));
      if (!target) return buttons.map((b) => b.textContent.trim().slice(0, 60));
      target.click();
      return "clicked";
    })()`);
    console.log("存档选择:", picked);
    await waitFor(cdp, "document.querySelector('#start-screen')?.hidden === true", "存档恢复完成");
    await delay(800);
    // 打开快速行动面板
    await evalJs(cdp, "document.querySelector('#action-quick-button')?.click()");
    await delay(300);
    const tradeBtn = await evalJs(cdp, `(() => {
      const b = document.querySelector('[data-quick-trade="cards-for-credit"]');
      if (!b) return null;
      return { disabled: b.disabled, ariaDisabled: b.getAttribute('aria-disabled'), title: b.title };
    })()`);
    console.log("两牌换一钱按钮:", JSON.stringify(tradeBtn));
    await evalJs(cdp, "document.querySelector('[data-quick-trade=\"cards-for-credit\"]').click()");
    await delay(800);
    // dump 内核决策与弹窗 DOM
    const inspect = await evalJs(cdp, `window.SetiRandomizer.inspect()`);
    const decision = inspect?.projection?.decision || null;
    console.log("=== 投影决策 ===");
    console.log(JSON.stringify({
      kind: decision?.kind,
      decisionId: decision?.decisionId,
      titleKey: decision?.titleKey,
      promptKey: decision?.promptKey,
      choices: (decision?.choices || []).map((c) => ({ choiceId: c.choiceId, label: c.label, presentation: c.presentation })),
    }, null, 2).slice(0, 4000));
    const dump = await evalJs(cdp, `(() => {
      const root = document.querySelector('.decision-ui') || document.querySelector('.decision-panel') || document.querySelector('[class*="decision"]');
      if (!root) return { found: false, bodyText: document.body.innerText.slice(0, 1500) };
      return {
        found: true,
        className: root.className,
        fullText: (root.innerText || '').trim().slice(0, 2000),
        html: root.outerHTML.slice(0, 3000),
        allImgs: [...root.querySelectorAll('img')].map((i) => i.src).filter(Boolean),
      };
    })()`);
    console.log("=== 弹窗 DOM ===");
    console.log(JSON.stringify(dump, null, 2).slice(0, 7000));
    // 交互：点选 2 张卡 → 确认弃牌 → 检查结算
    const clickCard = async (idx) => {
      await evalJs(cdp, `(() => {
        const buttons = [...document.querySelectorAll('[data-decision-ui-intent="submit-choice"]')];
        const cards = buttons.filter((b) => b.querySelector('img'));
        const target = cards[${idx}];
        if (!target) return "no-card-" + idx;
        target.click();
        return target.dataset.choiceId;
      })()`);
      await delay(400);
    };
    await clickCard(0);
    await clickCard(1);
    const state2 = await evalJs(cdp, `(() => {
      const buttons = [...document.querySelectorAll('.decision-ui-choice')];
      const confirm = buttons.find((b) => b.textContent.includes('确认弃牌'));
      const cards = buttons.filter((b) => b.querySelector('img'));
      return {
        confirmText: confirm?.textContent?.trim() || null,
        confirmDisabled: confirm?.disabled || null,
        selectedCards: cards.filter((b) => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('is-rule-selected')).map((b) => b.getAttribute('aria-label')),
      };
    })()`);
    console.log("=== 选 2 张后 ===");
    console.log(JSON.stringify(state2, null, 2));
    await evalJs(cdp, `(() => {
      const confirm = [...document.querySelectorAll('.decision-ui-choice')].find((b) => b.textContent.includes('确认弃牌'));
      if (confirm && !confirm.disabled) confirm.click();
    })()`);
    await delay(600);
    const after = await evalJs(cdp, `(() => {
      const decisionRoot = document.querySelector('.composition-decision-root');
      const projection = window.SetiRandomizer.inspect().projection;
      const players = projection?.resident?.browserReadModel?.render?.playerPanels?.players || [];
      const white = players.find((p) => p.id === 'player-white') || players[0];
      return {
        decisionOpen: decisionRoot ? !decisionRoot.hidden : false,
        whiteCredits: white?.resources?.credits ?? null,
        whiteHandCount: white?.handCards?.length ?? null,
        handIds: (white?.handCards || []).map((c) => c.cardId || c.id),
      };
    })()`);
    console.log("=== 结算后 ===");
    console.log(JSON.stringify(after, null, 2));
    chrome.kill();
    server.close();
  } catch (error) {
    console.error("复现失败:", error.message);
    chrome.kill();
    server.close();
    process.exit(1);
  }
}
main();
