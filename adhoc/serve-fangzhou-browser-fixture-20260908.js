"use strict";
// 临时只读验收服务：生产页面及正式读档接口，只有一个明确标记的派生fixture。
const fs = require("node:fs"), http = require("node:http"), path = require("node:path");
const root = "/private/tmp/seti-fangzhou-major-20260908.z4LG96";
const evidence = JSON.parse(fs.readFileSync("/Users/bilibili/code/seti-simu/reports/iteration/fangzhou-hidden-boundary-4d3711c5-20260908.json"));
const fileName = "验收fixture-方舟高级奖励5-非历史存档.json";
const content = JSON.stringify(evidence.rootEnvelope);
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:8301");
  if (request.method !== "GET") { response.writeHead(405).end("只读验收服务"); return; }
  if (url.pathname === "/api/saves" || url.pathname === "/api/save") {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (url.pathname === "/api/saves") response.end(JSON.stringify({ saves: [{ fileName, mtimeMs: Date.now(), size: Buffer.byteLength(content) }] }));
    else if (url.searchParams.get("file") === fileName) response.end(JSON.stringify({ ok: true, content }));
    else response.writeHead(404).end(JSON.stringify({ ok: false, message: "验收fixture不存在" }));
    return;
  }
  const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end("Forbidden"); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    response.end(data);
  });
}).listen(8301, "127.0.0.1", () => console.log("方舟候选 4d3711c5 只读验收：http://127.0.0.1:8301/randomizer/index.html"));
