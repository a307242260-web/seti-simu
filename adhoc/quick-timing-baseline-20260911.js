"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
const savePath = "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json";
const save = JSON.parse(fs.readFileSync(savePath,"utf8"));
const turns = new Map(), counts = {}, late = [];
let previous = null;
for (const step of save.replaySteps) {
  const action = step.action;
  const before = previous || step.after;
  assert(action && before && step.after);
  const key = `${before.r}:${before.t}:${action.actorId}`;
  const state = turns.get(key) || {main:null};
  if (action.phase === "quick") {
    const phase = state.main ? "after-main" : "before-main";
    const countKey = `${phase}:${action.family}`;
    counts[countKey] = (counts[countKey] || 0) + 1;
    if (state.main) late.push({step:step.stepIndex+1,turn:key,main:state.main,
      family:action.family,target:action.target,payload:action.payload,summary:action.summary});
  }
  if (action.phase === "main" && action.family !== "pass") state.main = action.family;
  turns.set(key,state);
  previous = step.after;
}
console.log(JSON.stringify({source:savePath,productionCommit:"31a2e43b",steps:save.replaySteps.length,
  method:"按正式action.phase和输入前round/turn/actor归组；条件选择不算独立快速行动；不据动作名称推断是否限时",
  counts,late},null,2));
