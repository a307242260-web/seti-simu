"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="adhoc/scan135-frontier-attribution-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const load=rev=>JSON.parse(fs.readFileSync(`adhoc/scan-cost135-${rev}-20260913.json`));
const old=load("d89a9838"),next=load("de73734c");
const target="income:gain:5,2,0,0,2,0",plan="income:data:computer-slot-4";
const pending=old.diagnostics.frontierNodeBreakdown.filter(n=>n.routeTargetId===target&&n.routePlanId===plan);
assert.equal(pending.length,1);assert.equal(pending[0].action,"choose_card:dlc_21.png → 南河三");
assert.equal(pending[0].chainDepth,2);assert.deepEqual(pending[0].rootActionIds,["scan:1b66b805"]);
const chain=next.roots.find(r=>r.actionId==="scan:1b66b805").evaluation.actionChain;
assert.deepEqual(chain.slice(0,3),["scan:1b66b805","choose_target:a2b5645b","choose_card:f8db866c"]);
assert.equal(old.diagnostics.executionLimitReached,true);
const local=JSON.parse(fs.readFileSync("adhoc/scan135-admission-d89a9838-20260913.json"));
assert(local.rows.every(r=>r.admitted));assert.equal(local.rows[1].action.actionId,chain[2]);
const clusters=x=>x.diagnostics.goalClusters.filter(g=>g.path.length===1).map(({targetId,executedOriginCount,completedTransitionCount})=>({targetId,executedOriginCount,completedTransitionCount}));
const result={sources:["scan-cost135-d89a9838-20260913.json","scan-cost135-de73734c-20260913.json","scan135-admission-d89a9838-20260913.json"],
  conclusion:"新优胜收入扫描路线在旧版已入队，停在第3个宏动作公共牌dlc_21的选择；4096执行预算耗尽时仍在frontier。不是该路线被判不可达或被贪心删除。旧版扫描的986个不可达叶属于其他已执行路线，不能代表这条未执行路线。",
  pending,old:{executed:old.diagnostics.executedNodeCount,clusters:clusters(old)},next:{executed:next.diagnostics.executedNodeCount,clusters:clusters(next)},
  boundary:"已定位旧优胜候选受预算挤压的具体位置；不据此声称新增免费移动字段如何改变全部竞争分支的排序，也不将全局掉分视为已解决。"};
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(result));
