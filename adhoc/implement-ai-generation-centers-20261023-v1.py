from pathlib import Path
import json
p=Path('tools/robot-iteration-lib.js');s=p.read_text();needle='// 写回前先备份（保留对比基准），再原子写回。'
i=s.index(needle)
s=s[:i]+'''// V1 是旧启发式 AI；V2 包含新主线的 completion 基础策略和 search 玩家。
function recordAIGeneration(record) {
  const type = record?.agentType;
  const policy = record?.policyVersion || "";
  const policyGeneration = /^seti-(completion-agent|search-agent)-/.test(policy) ? "v2" : null;
  if (type && !["heuristic", "completion", "search"].includes(type)) throw new Error(`AI_AGENT_TYPE_INVALID: ${type}`);
  const generation = type ? (type === "heuristic" ? "v1" : "v2") : policyGeneration || "v1";
  if (policyGeneration && generation !== policyGeneration) throw new Error("AI_RECORD_GENERATION_MISMATCH");
  return generation;
}

function versionAIGeneration(version, recordsByFile) {
  if (version.aiGeneration != null && !["v1", "v2"].includes(version.aiGeneration)) {
    throw new Error(`AI_GENERATION_INVALID: ${version.id}`);
  }
  const generations = new Set(Object.keys(version.records || {}).filter(file => recordsByFile[file])
    .map(file => recordAIGeneration(recordsByFile[file])));
  if (version.agentType) generations.add(recordAIGeneration({ agentType: version.agentType }));
  if (version.aiGeneration) generations.add(version.aiGeneration);
  if (generations.size > 1) throw new Error(`AI_VERSION_GENERATION_MIXED: ${version.id}`);
  return [...generations][0] || "v1";
}

function validateAIGenerations(versions, recordsByFile) {
  const generations = new Map(versions.map(version => [version.id, versionAIGeneration(version, recordsByFile)]));
  for (const version of versions) if (generations.has(version.baseline) && generations.get(version.baseline) !== generations.get(version.id)) {
    throw new Error(`AI_BASELINE_GENERATION_MISMATCH: ${version.id} -> ${version.baseline}`);
  }
  return generations;
}

'''+s[i:]
s=s.replace('function saveVersions(data) {\n','function saveVersions(data) {\n  validateAIGenerations(data.versions, scanResearchRecords());\n')
s=s.replace('      policyVersion: rec.policyVersion,','      policyVersion: rec.policyVersion,\n      agentType: rec.agentType || (/^seti-completion-agent-/.test(rec.policyVersion || "") ? "completion"\n        : /^seti-search-agent-/.test(rec.policyVersion || "") ? "search" : "heuristic"),\n      aiGeneration: recordAIGeneration(rec),')
s=s.replace('function computeBestOf(versions, resolvedMap) {','function computeBestOf(versions, resolvedMap) {\n  if (new Set(versions.map(version => version.aiGeneration || "v1")).size > 1) throw new Error("AI_BEST_OF_GENERATION_MIXED");')
# Extract the existing nearest-ancestor baseline selection unchanged, then invoke it separately per generation.
a=s.index('  // 当前 baseline 版本：优先 head 精确匹配 git HEAD；');b=s.index('  // 组装版本列表',a)
block=s[a:b];body=block[block.index('  let currentBaseline = null;'):]
s=s[:a]+'''  const nowHead = gitHeadShort();
  const generations = Object.fromEntries(["v1", "v2"].map(aiGeneration => {
    const members = versions.filter(version => generationByVersion.get(version.id) === aiGeneration);
    const current = selectCurrentBaseline(members, nowHead);
    return [aiGeneration, { currentBaseline: current?.id || null,
      bestOf: computeBestOf(members.map(version => ({ ...version, aiGeneration })), resolvedMap),
      versionCount: members.length, recordCount: members.reduce((count,version) => count+Object.keys(version.records || {}).length,0) }];
  }));
  const defaultGeneration = "v2", currentBaseline = generations[defaultGeneration].currentBaseline;
  const bestOf = generations[defaultGeneration].bestOf;
  const { warnings, orphans } = auditRegistry(versions, recordsByFile, resolvedMap, bestOf);

'''+s[b:]
s=s.replace('  const bestOf = computeBestOf(versions, resolvedMap);\n  const { warnings, orphans } = auditRegistry(versions, recordsByFile, resolvedMap, bestOf);\n\n','')
pos=s.index('function computeRegistry(')
s=s[:pos]+'''function selectCurrentBaseline(versions, nowHead) {
'''+body+'''  return currentBaseline;
}

'''+s[pos:]
s=s.replace('  const recordsByFile = scanResearchRecords();\n  const resolvedMap', '  const recordsByFile = scanResearchRecords();\n  const generationByVersion = validateAIGenerations(versions, recordsByFile);\n  const resolvedMap')
s=s.replace('      id: v.id,\n      name: v.name,','      id: v.id,\n      aiGeneration: generationByVersion.get(v.id),\n      name: v.name,')
s=s.replace('      isHead: currentBaseline ? v.id === currentBaseline.id : false,','      isHead: v.id === generations[generationByVersion.get(v.id)].currentBaseline,')
s=s.replace('      currentBaseline: currentBaseline ? currentBaseline.id : null,','      defaultGeneration, generations,\n      currentBaseline,')
s=s.replace('      steps: rec.steps,\n      terminal: rec.terminal,\n    });','      steps: rec.steps,\n      terminal: rec.terminal,\n      aiGeneration: recordAIGeneration(rec),\n    });')
s=s.replace('  saveVersions,\n','  saveVersions,\n  recordAIGeneration,\n  versionAIGeneration,\n  validateAIGenerations,\n  selectCurrentBaseline,\n')
p.write_text(s)
# Explicitly tag existing V2 versions; legacy IDs, record ownership and physical files stay unchanged.
p=Path('reports/iteration/versions.json');d=json.loads(p.read_text());
for v in d['versions']:
 if v['id'].startswith('ai-foundation'):
  v['aiGeneration']='v2'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
# The registration CLI selects and validates a baseline before starting an experiment.
p=Path('tools/robot_iterate.js');s=p.read_text();s=s.replace('  loadVersions,','  loadVersions,\n  scanResearchRecords,\n  recordAIGeneration,\n  versionAIGeneration,')
s=s.replace('function autoBaseline(versions, head) {','function autoBaseline(versions, head, generation, records) {').replace('    if (!v.head) continue;','    if (!v.head || versionAIGeneration(v,records) !== generation) continue;')
needle='  // 委托 run_research_validation（指纹去重 + 快速→全盘续跑一体）'
i=s.index(needle);s=s[:i]+'''  const records = scanResearchRecords();
  let agentType = "heuristic";
  for (const config of opts.config) for (const pair of config.split(",")) if (pair.startsWith("agentType=")) agentType = pair.slice("agentType=".length);
  const aiGeneration = recordAIGeneration({ agentType });
  if (existing && versionAIGeneration(existing,records) !== aiGeneration) die(`[拒绝] ${vid} 属于另一条 AI 主线，请使用新的版本 id。`);
  const baselineId = opts.baseline || autoBaseline(versions, head, aiGeneration, records);
  const baselineVersion = versions.find(v => v.id === baselineId) || null;
  if (baselineVersion && versionAIGeneration(baselineVersion,records) !== aiGeneration) die("[拒绝] V1/V2 不能互为实验基线。");

'''+s[i:]
s=s.replace('  const baselineId = opts.baseline || autoBaseline(versions, head);\n  const baselineVersion = versions.find((v) => v.id === baselineId) || null;\n','')
s=s.replace('    id: vid,\n','    id: vid,\n    aiGeneration,\n    agentType,\n')
s=s.replace('    id: opts.versionId,\n','    id: opts.versionId,\n    ...(idx >= 0 ? { aiGeneration: versions[idx].aiGeneration, agentType: versions[idx].agentType } : {}),\n')
p.write_text(s)
# Center view: both generations have independent server-computed summaries and a stable URL.
p=Path('reports/iteration/page-template.html');s=p.read_text().replace('<title>SETI 机器人迭代总览（免电分析盘面）</title>','<title>SETI AI 实验中心</title>')
s=s.replace('.eyebrow{','.generation-tabs{display:flex;gap:10px;margin:16px 0}.generation-tabs a{padding:8px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}.generation-tabs a[aria-current="page"]{background:var(--accent);color:#fff}\n.eyebrow{')
s=s.replace('  <h1>机器人迭代总览</h1>','''  <h1 id="center-title">AI 实验中心</h1>
  <nav class="generation-tabs" aria-label="AI 主线"><a id="tab-v2" href="?ai=v2">V2 · 新 AI</a><a id="tab-v1" href="?ai=v1">V1 · 旧 AI</a></nav>
  <p class="intro" id="generation-scope"></p>''')
s=s.replace('    <h2>迭代记录（当前 baseline）</h2>','    <h2 id="records-title">实验记录</h2>')
s=s.replace('const REGISTRY = /*__REGISTRY_JSON__*/;','''const ALL_REGISTRY = /*__REGISTRY_JSON__*/;
const generation = new URLSearchParams(location.search).get("ai") === "v1" ? "v1" : "v2";
const REGISTRY = { ...ALL_REGISTRY, ...ALL_REGISTRY.generations[generation],
  versions: ALL_REGISTRY.versions.filter(version => version.aiGeneration === generation) };''')
s=s.replace('  const badges=[];','''  const badges=[];
  const types=[...new Set(v.results.filter(r=>!r.missingRecord).map(r=>r.agentType))];
  badges.push(`<span class="badge">${types.map(type=>type==="completion"?"基础策略（无搜索）":type==="search"?"搜索 AI":"旧启发式 AI").join(" / ")||"尚无对局"}</span>`);''')
s=s.replace('function init(){','''function init(){
  const label=generation.toUpperCase();
  document.title=`SETI AI ${label} 实验中心`;
  document.getElementById("center-title").textContent=`AI ${label} 实验中心`;
  document.getElementById(`tab-${generation}`).setAttribute("aria-current","page");
  document.getElementById("generation-scope").textContent=generation==="v2"
    ? "新 AI 主线。基础策略与搜索 AI 分别标注；基础策略成绩不能用于搜索 AI 验收。"
    : "旧 AI 主线。保留历史实验、成绩与复盘。";
  document.getElementById("records-title").textContent=`${label} 实验记录（${REGISTRY.versionCount} 个版本 · ${REGISTRY.recordCount} 条记录）`;''')
s=s.replace('  const head=REGISTRY.versions.find(v=>v.isHead);','  const head=REGISTRY.versions.find(v=>v.id===REGISTRY.currentBaseline);')
p.write_text(s)
