#!/usr/bin/env node
"use strict";
// 决定性对照：当前浏览器从零玩到研究科技补公共牌点。
// 如果补的牌 = dlc_40 → 浏览器与旧档一致（simulator 重放才分叉 → simulator 与浏览器不一致）
// 如果补的牌 = b_8   → 浏览器与 simulator 一致（旧档才是旧 RNG 时代）
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

    async function waitDecision() {
      for (let a = 0; a < 60; a++) {
        const insp = await evalJs(cdp, `(() => { const i = window.SetiRandomizer.inspect(); const d = i.projection?.decision || null; return d ? { decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, kind: d.kind, choices: d.choices.map(c => ({ choiceId: c.choiceId, label: c.label })) } : null; })()`);
        if (insp) return insp;
        await delay(150);
      }
      return null;
    }
    async function submitByLabel(label) {
      const insp = await waitDecision();
      if (!insp) return null;
      const pick = insp.choices.find((c) => c.label === label) || insp.choices[0];
      const r = await evalJs(cdp, `(() => { const i = window.SetiRandomizer.inspect(); const d = i.projection.decision; return window.SetiRandomizer.input.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: { choiceId: ${JSON.stringify(pick.choiceId)} } }); })()`);
      return r;
    }
    async function snapshot() {
      return evalJs(cdp, `(() => {
        const i = window.SetiRandomizer.inspect();
        const render = i.projection?.resident?.browserReadModel?.render || {};
        const cp = render.cardPanels || {};
        const pp = render.playerPanels || {};
        return {
          sv: i.projection?.stateVersion,
          pub: (cp.publicCards || []).map(c => (c.definitionId || c.id) + ':' + (c.id || '')),
          white: { credits: (pp.players || []).find(x => x.id === 'player-white')?.credits, energy: (pp.players || []).find(x => x.id === 'player-white')?.energy, score: (pp.players || []).find(x => x.id === 'player-white')?.score, hand: (cp.handCards || []).map(c => c.definitionId + ':' + c.id) },
        };
      })()`);
    }
    // 1) 白色初始选择 4 步
    for (let i = 1; i <= 4; i++) {
      const r = await submitByLabel(steps[i].action.summary);
      if (!r?.ok) { console.log(`初始#${i} 失败 ${JSON.stringify(r)}`); process.exit(1); }
    }
    await delay(2500); // AI 完成其他玩家初始选择
    // 2) 白色收入 2 步
    for (let i = 17; i <= 18; i++) {
      const r = await submitByLabel(steps[i].action.summary);
      if (!r?.ok) { console.log(`收入#${i} 失败 ${JSON.stringify(r)}`); process.exit(1); }
    }
    await delay(2500); // AI 完成其他玩家收入
    console.log("收入后:", JSON.stringify(await snapshot()));

    // 3) 白色回合：点手牌 card-13-0 (b_117) → 点打牌按钮
    const clickPlay = async () => {
      const r = await evalJs(cdp, `(() => {
        const cardBtn = document.querySelector('[data-hand-card-id="card-13-0"]');
        if (!cardBtn) return { ok: false, why: 'no hand card button' };
        cardBtn.click();
        return { ok: true };
      })()`);
      await delay(300);
      const r2 = await evalJs(cdp, `(() => {
        const btn = document.getElementById('action-play-card-button');
        if (!btn) return { ok: false, why: 'no play button' };
        btn.click();
        return { ok: true, disabled: btn.disabled };
      })()`);
      return r2;
    };
    const pr = await clickPlay();
    console.log("打 b_117:", JSON.stringify(pr));
    await delay(800);
    console.log("打牌后:", JSON.stringify(await snapshot()));
    // 4) 快速行动 1能量→移动1步（action-quick-button 点击 + 选择）
    await evalJs(cdp, `document.getElementById('action-quick-button').click()`);
    await delay(400);
    const dMove = await waitDecision();
    if (dMove) {
      const pick = dMove.choices.find((c) => c.label === "移动探测器 3 向外") || dMove.choices[0];
      await evalJs(cdp, `(() => { const i = window.SetiRandomizer.inspect(); const d = i.projection.decision; return window.SetiRandomizer.input.submitDecision({ decisionId: d.decisionId, decisionVersion: d.decisionVersion, ownerId: d.ownerId, choice: { choiceId: ${JSON.stringify(pick.choiceId)} } }); })()`);
      await delay(400);
    }
    // 5) 回合结束
    await evalJs(cdp, `document.getElementById('action-confirm-button').click()`);
    await delay(600);
    console.log("end_turn 后:", JSON.stringify(await snapshot()));
    // 6) 等 AI 完成 PASS
    await delay(4000);
    console.log("AI PASS 后:", JSON.stringify(await snapshot()));
    // 7) 研究科技（action-research-button? 查按钮）
    const researchBtn = await evalJs(cdp, `(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').includes('研究') || b.id.includes('research'));
      return btns.map(b => ({ id: b.id, text: (b.textContent || '').trim().slice(0, 20) }));
    })()`);
    console.log("研究按钮:", JSON.stringify(researchBtn));
    if (researchBtn.length) {
      await evalJs(cdp, `document.getElementById(${JSON.stringify(researchBtn[0].id)}).click()`);
      await delay(400);
      const d38 = await submitByLabel("研究 blue2（蓝槽 1）");
      if (d38?.ok) {
        await delay(300);
        const d39 = await submitByLabel("b_48.webp");
        console.log("#39 选卡结果:", JSON.stringify(d39));
        await delay(400);
        console.log("#39 后（补牌）:", JSON.stringify(await snapshot()));
      } else {
        console.log("研究 blue2 失败:", JSON.stringify(d38));
      }
    }
    console.log("\n=== 结论 ===");
    console.log("浏览器 #39 后公共牌: ", JSON.stringify((await snapshot()).pub));
    console.log("simulator 重放 #42 公共牌: b_2.webp:card-17-0, b_8.webp:card-40-0, dlc_21.png:card-19-0");
    console.log("旧档 v47 sv=47 公共牌: dlc_32.png:card-49-0, b_48.webp:card-18-0, b_14.webp:card-50-0");
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
