#!/usr/bin/env node
"use strict";

// 本地存盘接收服务：浏览器把存档 JSON POST 到这里，直接写入仓库 seti-saves/ 目录。
// 这样"存盘"不再依赖浏览器下载，文件直接出现在仓库里便于开发者读取排查。
// 用法：node tools/save_receiver.js [port]   （默认 8301）

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const saveDir = path.join(repositoryRoot, "seti-saves");
const port = Number(process.argv[2] || process.env.SETI_SAVE_PORT || 8301);

fs.mkdirSync(saveDir, { recursive: true });

function cors(response, method = "GET") {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "600");
}

function respond(response, status, body) {
  cors(response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 64 * 1024 * 1024) {
        reject(new Error("存档过大（超过 64MB）"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function safeFileName(payload) {
  const seed = String(payload?.seed ?? "game")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "game";
  return `seti-save-${seed}-v${payload?.stateVersion ?? 0}.json`;
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    cors(response);
    response.writeHead(204);
    response.end();
    return;
  }
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (request.method === "GET" && url.pathname === "/api/latest") {
    // 返回 seti-saves/ 中最新一份存档的内容（供浏览器读档）
    try {
      const entries = fs.readdirSync(saveDir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => {
          const stat = fs.statSync(path.join(saveDir, name));
          return { name, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      if (!entries.length) {
        respond(response, 404, { ok: false, code: "NO_SAVES", message: "seti-saves/ 目录还没有存档" });
        return;
      }
      const fileName = entries[0].name;
      const content = fs.readFileSync(path.join(saveDir, fileName), "utf8");
      respond(response, 200, { ok: true, fileName, content });
    } catch (error) {
      respond(response, 500, { ok: false, code: "READ_FAILED", message: error.message });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/save") {
    try {
      const raw = await readBody(request);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        respond(response, 400, { ok: false, code: "INVALID_JSON", message: error.message });
        return;
      }
      const fileName = safeFileName(payload);
      const filePath = path.join(saveDir, fileName);
      const uniquePath = fs.existsSync(filePath)
        ? filePath.replace(/\.json$/, `-${Date.now()}.json`)
        : filePath;
      fs.writeFileSync(uniquePath, raw, "utf8");
      respond(response, 200, {
        ok: true,
        fileName: path.basename(uniquePath),
        path: uniquePath,
        savedAt: new Date().toISOString(),
      });
    } catch (error) {
      respond(response, 500, { ok: false, code: "WRITE_FAILED", message: error.message });
    }
    return;
  }
  respond(response, 404, { ok: false, code: "NOT_FOUND" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SETI 存盘接收服务已启动: http://127.0.0.1:${port} -> ${saveDir}`);
});
