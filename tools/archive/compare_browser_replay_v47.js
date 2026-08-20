#!/usr/bin/env node
"use strict";
// 浏览器逐步执行 v47 档步骤，打印每步：存档 actionId/期望 target/summary vs 浏览器实际 choices。
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
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
  constructor(url) { this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map(); }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
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
  const v47 = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "seti-saves/seti-save-重打R2末-v47.json"), "utf8"));
  const steps = v47.replaySteps;
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
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.alert = (msg) => console.warn('[ALERT]', msg); window.prompt = () => 'replay-check'; window.confirm = () => true;" });
    await cdp.send("Page.navigate", { url });
    await waitFor(cdp, "!!window.SetiRandomizer", "SetiRandomizer 装配");
    await evalJs(cdp, `(() => {
      const seed = document.querySelector('#start-seed-input');
      if (seed) { seed.value = 'seti-free-analyze-v1'; seed.dispatchEvent(new Event('input', { bubbles: true })); }
      document.querySelector('#start-screen-start-button').click();
    })()`);
    await delay(800);

    // 浏览器已自动提交 step0，从 step1 开始
    let diverge = null;
    for (let index = 1; index < 60; index += 1) {
      const step = steps[index];
      const action = step.action;
      // 读取当前决策（等待出现）
      let insp = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        insp = await evalJs(cdp, `(() => {
          const i = window.SetiRandomizer.inspect();
          const d = i.projection?.decision || null;
          return d ? { decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, kind: d.kind, choices: d.choices.map(c => ({ choiceId: c.choiceId, label: c.label, disabledReason: c.disabledReason || null })) } : null;
        })()`);
        if (insp) break;
        await delay(150);
      }
      let result;
      if (insp) {
        const pick = insp.choices.find((c) => String(c.choiceId) === String(action.actionId));
        if (!pick) {
          // 尝试按 summary/label 匹配
          const wantSummary = String(action.summary || "");
          const byLabel = insp.choices.find((c) => String(c.label || "") === wantSummary);
          diverge = {
            index, kind: "CHOICE_NOT_FOUND", actionId: action.actionId, wantSummary,
            actual: insp.choices.map((c) => `${c.choiceId}(${c.label})`),
            byLabel: byLabel ? byLabel.choiceId : null,
          };
          break;
        }
        result = await evalJs(cdp, `(() => {
          const i = window.SetiRandomizer.inspect();
          const d = i.projection.decision;
          return window.SetiRandomizer.input.submitDecision({
            decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId,
            choice: { choiceId: ${JSON.stringify(pick.choiceId)} },
          });
        })()`);
      } else {
        result = await evalJs(cdp, `(() => {
          const a = ${JSON.stringify(JSON.stringify(action))};
          const action = JSON.parse(a);
          const i = window.SetiRandomizer.inspect();
          const p = i.projection;
          action.stateVersion = p?.stateVersion ?? 0;
          action.decisionVersion = p?.state?.match?.decisionVersion ?? 0;
          const r = window.SetiRandomizer.input.dispatchAction(action);
          return r;
        })()`);
      }
      if (!result?.ok) {
        diverge = { index, kind: "SUBMIT_FAIL", code: result?.failure?.code || result?.code, msg: result?.failure?.message || result?.message || "", action: `${action.family} ${JSON.stringify(action.summary)}` };
        break;
      }
      if (index <= 24) {
        console.log(`#${index} ok [${action.actorId}] ${action.family} ${JSON.stringify(action.summary).slice(0, 26)} actionId=${action.actionId}`);
      }
    }
    console.log(diverge ? `\n分叉于 #${diverge.index}: ${diverge.kind} ${diverge.code || ""} ${diverge.msg || ""}` : "");
    if (diverge) console.log(JSON.stringify(diverge, null, 1).slice(0, 1200));
    chrome.kill();
    server.close();
  } catch (error) {
    console.error("失败:", error.message);
    chrome.kill();
    server.close();
    process.exit(1);
  }
}
main();
