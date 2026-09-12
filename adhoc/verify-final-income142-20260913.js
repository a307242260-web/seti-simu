"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const output = "adhoc/final-income142-20260913.json";
if (fs.existsSync(output)) { console.log("已有142复核，不重复重放"); process.exit(0); }
let source = fs.readFileSync("/tmp/seti-income432-audit-20260913.TPxMg7/adhoc/audit-real-finalmark142-20260913.js", "utf8");
assert(source.includes("adhoc/real-finalmark142-20260913.json"));
source = source.replace("adhoc/real-finalmark142-20260913.json", output);
// 同一realm执行已验证重放脚本，相对模块从本受测目录加载；不改生产代码。
new Function("require", "console", "process", source)(require, console, process);
const result = JSON.parse(fs.readFileSync(output));
assert(!result.error); assert(result.rootFieldsPresent);
for (const formula of result.formulas) assert.equal(formula.policyBase, formula.formalBase);
assert.equal(result.formulas.find(f => f.formulaId === "a2").policyBase, 1);
console.log("真实142：全部合法板块基础值与正式状态一致，A2修正为1");
