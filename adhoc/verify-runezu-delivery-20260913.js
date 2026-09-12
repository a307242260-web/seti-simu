"use strict";
// 复用已归档的静态交付检查；单次替换固定版本预期，不执行规则或AI。
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const replacements = {
  "frontier-materialization-20260912": "runezu-effect-fix-20260913", "eee63294": "f105f8ea",
  "597": "589", "97.75": "107.75", "75, 125, 102, 89": "97, 123, 127, 84",
  "203": "195", "233757": "217662", "54": "52", "60": "55",
};
const source = fs.readFileSync(path.join(__dirname, "verify-frontier-delivery-20260912.js"), "utf8")
  .replace(/frontier-materialization-20260912|eee63294|75, 125, 102, 89|97\.75|\b(?:597|203|233757|54|60)\b/g,
    (value) => replacements[value]);
vm.runInNewContext(source, { require, console, __dirname });
