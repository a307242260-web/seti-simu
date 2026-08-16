#!/usr/bin/env node
"use strict";
// 复现：读「终局未结算」存档，dump 页面终局相关 UI（状态栏、玩家分数、终局面板）。
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const SAVE_NAME = process.argv[2] || "seti-save-终局未结算-v223.json";

function contentType(file) {
  const map = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png" };
  return map[path.extname(file).toLowerCase()] || "application/octet-stream";
}
function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const absolute = path.resolve(repositoryRoot, pathname.replace(/^\/+/, ""));
    if (absolute !== repositoryRoot && !absolute.startsWith(`${repositoryRoot}${path.sep}`)) { response.writeHead(403).end("Forbidden"); return; }
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
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.alert = (msg) => { console.warn('[ALERT]', msg); };", });
    await cdp.send("Page.navigate", { url });
    await waitFor(cdp, "!!window.SetiRandomizer", "SetiRandomizer 装配");
    await evalJs(cdp, "document.querySelector('#start-screen-load-button').click()");
    await waitFor(cdp, "document.querySelector('#save-picker-overlay')?.hidden === false", "存档弹层");
    await waitFor(cdp, "!!document.querySelector('#save-picker-list')?.children.length", "存档列表");
    await evalJs(cdp, `(() => {
      const target = [...document.querySelectorAll('#save-picker-list button')].find((b) => b.textContent.includes(${JSON.stringify(SAVE_NAME)}));
      target?.click();
    })()`);
    await waitFor(cdp, "document.querySelector('#start-screen')?.hidden === true", "存档恢复完成");
    await delay(1000);

    const dump = await evalJs(cdp, `(() => {
      const proj = window.SetiRandomizer.inspect().projection;
      const panels = proj?.resident?.browserReadModel?.render?.playerPanels?.players || [];
      const overlay = document.querySelector('#final-result-overlay');
      const table = document.querySelector('.final-result-table');
      const round = document.querySelector('#round-status-round');
      const turn = document.querySelector('#round-status-turn');
      return {
        terminal: proj?.resident?.browserReadModel?.render?.turnPresentation?.terminal,
        settled: proj?.match?.finalScoringSettled,
        matchKeys: proj?.match ? Object.keys(proj.match) : null,
        finalScoresCount: proj?.match?.finalScores?.length ?? null,
        panelSample: panels[0] ? Object.fromEntries(Object.entries(panels[0]).filter(([k]) => ["id", "name", "displayName", "color", "uiColor"].includes(k))) : null,
        panelCount: panels.length,
        overlayHidden: overlay?.hidden,
        overlayText: overlay ? (overlay.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500) : null,
        tableRows: table ? [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent).join(' | ')) : null,
        roundText: round?.textContent || null,
        turnText: turn?.textContent || null,
      };
    })()`);
    console.log("=== 终局 UI ===");
    console.log(JSON.stringify(dump, null, 2));
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
