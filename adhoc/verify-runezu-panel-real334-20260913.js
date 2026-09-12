"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
let source=fs.readFileSync("/tmp/seti-budget334-20260913.OJif7i/adhoc/reproduce-runezu-panel-trace-20260913.js","utf8");
for(const [a,b] of [
 ["adhoc/runezu-panel-trace-bug-20260913.json","adhoc/runezu-panel-real334-fixed-20260913.json"],
 ["adhoc/budget334-input-20260913.json","/tmp/seti-budget334-20260913.OJif7i/adhoc/budget334-input-20260913.json"],
 ["adhoc/trace334-direct-20260913.json","/tmp/seti-budget334-20260913.OJif7i/adhoc/trace334-direct-20260913.json"],
 ["symbolBag","availableSymbols"],
 ['assert(item.missingSymbol,"当前代码未复现缺失符号");','assert.equal(item.missingSymbol,false,"应领取本次痕迹对应符号");'],
 ["assert.deepEqual(item.panelAfter,item.panelBefore);","if(position===4) assert.equal(item.panelAfter,undefined); else assert(item.panelAfter?.symbolId);"],
 ["assert.deepEqual(item.bagAfter,item.bagBefore);","assert.equal(item.bagAfter.length,item.bagBefore.length-(position===1?1:0));"],
]){assert(source.includes(a),a);source=source.replaceAll(a,b);}
new Function("require","console","process",source)(require,console,process);
