#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const inventory = require("./browser-smoke-inventory");

const repositoryRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
let chromePath = process.env.CHROME_PATH || null;
let listOnly = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--list") listOnly = true;
  else if (args[index] === "--chrome") {
    chromePath = args[index + 1];
    if (!chromePath) throw new Error("--chrome 需要可执行文件路径");
    index += 1;
  } else {
    throw new Error(`未知参数：${args[index]}`);
  }
}

function findChrome() {
  const candidates = [
    chromePath,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : null,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function contentType(file) {
  return new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "application/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".svg", "image/svg+xml"],
    [".png", "image/png"],
    [".webp", "image/webp"],
  ]).get(path.extname(file).toLowerCase()) || "application/octet-stream";
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
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, { "content-type": contentType(absolute) }).end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError || new Error(`等待 ${url} 超时`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

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
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 超时`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

function validateInventory() {
  const ids = new Set();
  for (const smoke of inventory) {
    for (const field of ["id", "file", "resultSelector", "resultAttribute", "obligation", "counterexample"]) {
      if (typeof smoke[field] !== "string" || !smoke[field].trim()) {
        throw new Error(`Chrome smoke ${smoke.id || "<unknown>"} 缺少 ${field}`);
      }
    }
    if (ids.has(smoke.id)) throw new Error(`Chrome smoke id 重复：${smoke.id}`);
    ids.add(smoke.id);
    if (!fs.existsSync(path.join(repositoryRoot, smoke.file))) {
      throw new Error(`Chrome smoke 文件不存在：${smoke.file}`);
    }
  }
}

async function waitForResult(cdp, smoke, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const evaluated = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const node = document.querySelector(${JSON.stringify(smoke.resultSelector)});
        const value = node?.getAttribute(${JSON.stringify(smoke.resultAttribute)}) || null;
        return { value, text: node?.textContent || "", href: location.href };
      })()`,
    });
    last = evaluated.result?.value || null;
    if (last?.value === "failed" || last?.value === "false") {
      throw new Error(`${smoke.id} 失败：${last.text}`);
    }
    if (last?.value === "passed" || last?.value === "true") return last;
    await delay(100);
  }
  throw new Error(`${smoke.id} 超时：${JSON.stringify(last)}`);
}

async function main() {
  validateInventory();
  if (listOnly) {
    for (const smoke of inventory) {
      process.stdout.write(`${smoke.id}\t${smoke.file}\t${smoke.obligation}\t${smoke.counterexample}\n`);
    }
    process.stdout.write(`COUNT browserSmoke=${inventory.length}\n`);
    return;
  }
  const executable = findChrome();
  if (!executable) throw new Error("找不到 Chrome；请用 --chrome 或 CHROME_PATH 指定");
  const server = await startServer();
  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "seti-browser-smoke-"));
  const chrome = spawn(executable, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "--remote-allow-origins=*",
    "about:blank",
  ], { stdio: "ignore" });
  let cdp = null;
  try {
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) throw new Error("Chrome 没有可用 page target");
    cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    for (const smoke of inventory) {
      const url = `http://127.0.0.1:${server.address().port}/${smoke.file}`;
      await cdp.send("Page.navigate", { url });
      const result = await waitForResult(cdp, smoke);
      process.stdout.write(`PASS ${smoke.id} ${result.href}\n`);
    }
    process.stdout.write(`SUMMARY browserSmoke passed=${inventory.length} failed=0 total=${inventory.length}\n`);
  } finally {
    cdp?.close();
    await new Promise((resolve) => server.close(resolve));
    chrome.kill();
    await delay(200);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
