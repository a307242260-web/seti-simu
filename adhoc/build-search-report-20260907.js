"use strict";
const fs = require("node:fs"), v8 = require("node:v8"), zlib = require("node:zlib"), assert = require("node:assert/strict");
const out = "reports/iteration/search-node-report-20260907.html";
const read = p => JSON.parse(fs.readFileSync(p));
const source = "reports/research/91f9a83a.73e7b2ca.full.json", record = read(source);
const full = record.metrics.searches.filter(s=>s.kind === "strategic" && s.diagnostics.executedNodeCount >= s.diagnostics.maxExecutionNodes);
function aggregate(searches) {
  const result = {nodes:0,submissions:0,byFamily:{}};
  for(const s of searches) {const d=s.diagnostics;result.nodes+=d.executedNodeCount;result.submissions+=d.successfulInputSubmissionCount;
    for(const [k,n] of Object.entries(d.attemptedNodeCountByFamily))result.byFamily[k]=(result.byFamily[k]||0)+n;}
  assert.equal(Object.values(result.byFamily).reduce((a,b)=>a+b,0),result.nodes);return result;
}
const input = v8.deserialize(zlib.gunzipSync(fs.readFileSync("reports/iteration/policy-input-42-20260906.v8.gz")));
const cp=read("reports/iteration/company-movement-input-42-20260906.json").checkpoint;
const cold=read("reports/iteration/company-movement-42-20260906-v2.json").diagnostics;
const actionDict=[], actionIndex=new Map();
function actionId(action) {const key=JSON.stringify(action);if(!actionIndex.has(key)){actionIndex.set(key,actionDict.length);actionDict.push(action);}return actionIndex.get(key);}
const chains=input.actionOutcomes.flatMap(o=>o.leaves.map(l=>({root:o.actionId,id:l.leafId,status:l.status,
  terminal:l.terminalReason,target:l.rootRouteTargetId,plan:l.rootRoutePlanId,chain:l.actionChain,
  steps:(l.planSteps||[]).map(s=>actionId(s.action)),trace:l.secondaryAgentTrace,
  goalPaths:l.secondaryAgentGoalPaths,goalSelections:l.secondaryAgentGoalSelections,
  executionStepCount:l.executionStepCount})));
assert.equal(chains.length,2938);
const withoutPlan = chains.filter(c=>!c.steps.length);
assert.equal(withoutPlan.length,1);
assert.deepEqual(withoutPlan[0].chain,["pass:ff716055"]);
const data={source,all:aggregate(record.metrics.searches),full:aggregate(full),searches:record.metrics.searches.length,
  fullSearches:full.map(s=>({step:s.step,seat:s.seat,action:s.action,...s.diagnostics})),
  cold,rootState:JSON.parse(cp.coreState.committedState),rootSession:cp.coreState.session,
  rootObservation:input.observation,rootActions:input.legalActions,actionDict,chains,
  outcomes:input.actionOutcomes.map(o=>({actionId:o.actionId,status:o.status,searchCompleteness:o.searchCompleteness,
    reasonCodes:o.reasonCodes,code:o.code,message:o.message,leaves:o.leaves.length})),
  capture:read("reports/iteration/policy-input-capture-42-20260906.json"),
  verification:read("reports/iteration/policy-plan-view-decision-42-20260906.json")};
const script = String.raw`
const D=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id);
const names={choose_target:'选择目标',choose_card:'选择卡牌',end_turn:'结束回合',quick_trade:'快速交易',place_data:'填数据',move:'移动',pass:'PASS',scan:'扫描',choose_payment:'选择支付',analyze:'分析',land:'登陆',orbit:'环绕',card_corner:'弃牌角标',industry:'公司能力',play_card:'打牌',research_tech:'研究科技',accept_optional_effect:'接受可选效果',launch:'发射',choose_reward:'选择奖励',complete_task:'完成任务'};
const seat=s=>({ 'player-white':'白方','player-green':'绿方','player-blue':'蓝方','player-brown':'棕方'}[s]||s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(n,t)=>(100*n/t).toFixed(2)+'%';
const table=(head,rows)=>'<table><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const pretty=v=>JSON.stringify(v,null,2);
$('overview').innerHTML='<div class="cards">'+[['全部节点',D.all.nodes],['独立搜索',D.searches],['满额搜索',D.fullSearches.length],['满额节点占全部',pct(D.full.nodes,D.all.nodes)]].map(([a,b])=>'<div><small>'+a+'</small><strong>'+b+'</strong></div>').join('')+'</div>';
$('overview').innerHTML+='<p class="warn">逐步证据覆盖：2937条有完整planSteps；另1条PASS仅有物理actionChain，没有planSteps，展开时如实显示缺失，未补造。所有2938条保留结果均列入。</p>';
$('families').innerHTML=table(['节点类型','全部数量','占全部','满额子集数量','占满额子集'],Object.entries(D.all.byFamily).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[names[k]+' · '+k,n,pct(n,D.all.nodes),D.full.byFamily[k]||0,pct(D.full.byFamily[k]||0,D.full.nodes)]));
$('fulls').innerHTML=table(['步','席位','节点','正式提交','选目标','选牌','填数据','搜索内部秒'],D.fullSearches.map(s=>[s.step,seat(s.seat),s.executedNodeCount,s.successfulInputSubmissionCount,s.attemptedNodeCountByFamily.choose_target||0,s.attemptedNodeCountByFamily.choose_card||0,s.attemptedNodeCountByFamily.place_data||0,(s.totalMilliseconds/1000).toFixed(2)]));
$('cold').innerHTML=table(['第42步冷决策类型','节点','占4096'],Object.entries(D.cold.attemptedNodeCountByFamily).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[names[k]+' · '+k,n,pct(n,D.cold.executedNodeCount)]));
$('specific').innerHTML=table(['选择目标的具体类型（冷决策）','节点','占4096'],Object.entries(D.cold.executedNodeCountByActionSummary).filter(([k])=>k.startsWith('choose_target:')).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[k.slice(14),n,pct(n,4096)]));
const state=D.rootState,players=state.players.players;
$('state').innerHTML='<p>第 '+state.turn.roundNumber+' 轮，第 '+state.turn.turnNumber+' 个玩家回合，行动方：'+seat(state.turn.currentPlayerId)+'。独立冷决策：4096节点 / 4804次正式提交。</p>'+table(['席位','分数','钱','电','宣传','数据','手牌数','钱收入','电收入'],players.map(p=>[seat(p.id),p.resources.score,p.resources.credits,p.resources.energy,p.resources.publicity,p.resources.availableData,p.hand.length,p.income.credits,p.income.energy]));
for(const p of players){const d=document.createElement('details');d.innerHTML='<summary>'+seat(p.id)+'：手牌、收入、科技、数据和初始选择</summary><pre></pre>';d.querySelector('pre').textContent=pretty(p);$('state').appendChild(d);}
for(const [label,v] of [['火箭与当前位置',state.pieces],['太阳系',state.solarSystem],['外星人',state.aliens],['公共牌',state.cards],['完整实际根状态（含非公开存档字段，仅供调试）',state],['AI实际根观察',D.rootObservation]]){const d=document.createElement('details');d.innerHTML='<summary>'+label+'</summary><pre></pre>';d.querySelector('pre').textContent=pretty(v);$('state').appendChild(d);}
$('roots').innerHTML=table(['根动作','描述','保留叶','状态','完整性'],D.outcomes.map(o=>[o.actionId,D.rootActions.find(a=>a.actionId===o.actionId)?.summary||'',o.leaves,o.status,pretty(o.searchCompleteness)]));
for(const a of D.rootActions){const o=document.createElement('option');o.value=a.actionId;o.textContent=a.summary+' · '+a.actionId;$('rootFilter').appendChild(o);}
let page=0,filtered=D.chains;const size=50;
function render(){const query=$('query').value.trim().toLowerCase(),root=$('rootFilter').value;
filtered=D.chains.filter(c=>(!root||c.root===root)&&(!query||JSON.stringify(c).toLowerCase().includes(query)||c.steps.some(i=>JSON.stringify(D.actionDict[i]).toLowerCase().includes(query))));
const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages-1);
$('count').textContent='符合条件 '+filtered.length+' / 全部 '+D.chains.length+' 条保留链；第 '+(page+1)+' / '+pages+' 页';$('chains').replaceChildren();
for(const c of filtered.slice(page*size,(page+1)*size)){const d=document.createElement('details');
d.innerHTML='<summary>'+esc(c.root)+' → '+esc(c.target)+' · '+c.steps.length+'次正式输入 · '+esc(c.terminal||c.status)+' · '+esc(c.id)+'</summary>';
d.addEventListener('toggle',()=>{if(!d.open||d.dataset.loaded)return;d.dataset.loaded='1';const body=document.createElement('div');
body.innerHTML='<p>物理搜索链 '+c.chain.length+' 步；'+(c.steps.length?'已保存正式输入 '+c.steps.length+' 步（包含宏结算，不能按链条长度相加为物理节点）。':'该PASS结果未保存planSteps，不能解释成执行0步；下方保留物理链原文。')+'</p>'+table(['顺序','动作','actionId','目标','payload'],c.steps.map((i,n)=>{const a=D.actionDict[i];return[n+1,a.summary||a.family,a.actionId,pretty(a.target),pretty(a.payload)];}));
const pre=document.createElement('pre');pre.textContent=pretty({physicalActionChain:c.chain,goalPaths:c.goalPaths,goalSelections:c.goalSelections,trace:c.trace});body.appendChild(pre);d.appendChild(body);});$('chains').appendChild(d);}}
$('query').oninput=$('rootFilter').onchange=()=>{page=0;render();};$('prev').onclick=()=>{page=Math.max(0,page-1);render();};$('next').onclick=()=>{page++;render();};
$('download').onclick=()=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([pretty({actionDict:D.actionDict,chains:D.chains})],{type:'application/json'}));a.href=u;a.download='retained-search-chains-step42-20260907.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};render();
`;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>搜索节点分布与第42步搜索链 · 2026-09-07</title><style>body{font:15px/1.65 system-ui;margin:32px auto;max-width:1240px;padding:0 20px;color:#253246;background:#f6f8fc}h1,h2{color:#17263c}section{background:white;padding:22px;margin:20px 0;border:1px solid #dce3ee;border-radius:10px}.cards{display:flex;gap:20px;flex-wrap:wrap}.cards div{flex:1;padding:18px;background:#edf3ff}.cards strong{display:block;font-size:28px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e0e5ee;vertical-align:top;overflow-wrap:anywhere}th{background:#eef2f8;position:sticky;top:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:550px;overflow:auto;background:#f2f5f9;padding:12px;font-size:12px}details{border:1px solid #dde4ee;margin:8px 0;padding:10px}summary{cursor:pointer;font-weight:600}.warn{background:#fff4d9;border-left:4px solid #bc7900;padding:14px}input,select,button{font:inherit;padding:8px;margin:4px;max-width:100%}a{color:#165ab0}</style><h1>搜索节点分布与满额决策复盘</h1><p>2026-09-07 · 固定免电分析盘面 · 生产版本73e7b2ca · 正式终局121 / 88 / 118 / 109，均分109</p><div class="warn">范围：全局与21次满额分布来自当前完整局记录。第42步实际盘面与链条来自同输入的独立冷决策，完整局该步提交数与冷决策不同，分别标注，不混算。链条区包含全部2938条已保留结果，不是所有曾尝试或被剪枝的执行路径；旧记录未保存后者，无法从叶反推。未重跑AI。</div><section id="overview"></section><section><h2>一、全局节点占比与满额子集</h2><p>分母为实际尝试节点，包含失败；满额指strategic搜索达到4096。不是目标来源次数相加，也不是耗时占比。</p><div id="families"></div></section><section><h2>二、21次满额搜索明细</h2><div id="fulls"></div></section><section><h2>三、第42步绿方：实际盘面</h2><p>输入：company-movement-input-42-20260906.json。冷决策选中place_data:dbe01b29。复制优化后同输入验证16.915秒、4096节点、4804提交，评价与29步优胜计划一致。</p><div id="state"></div></section><section><h2>四、该满额点的节点分布</h2><div id="cold"></div><details><summary>展开全部选目标摘要</summary><div id="specific"></div></details></section><section><h2>五、全部根动作与保留结果</h2><div id="roots"></div></section><section><h2>六、全部已保存搜索链条（2938条，无抽样截断）</h2><p>每页50条，可按根动作或动作/目标文字筛选。展开一条可见完整正式输入，包括摘要遗漏的支付、结束回合等宏步骤。不同来源共享节点，不能把链条长度相加当搜索节点数。</p><select id="rootFilter"><option value="">全部根动作</option></select><input id="query" placeholder="搜索：industry、移动、目标ID…"><button id="download">下载全部链条JSON</button><p id="count"></p><button id="prev">上一页</button><button id="next">下一页</button><div id="chains"></div></section><section><h2>来源与未覆盖范围</h2><ul><li>全局记录：${source}</li><li>链条原始图：policy-input-42-20260906.v8.gz（保留共享引用与完整计划证据）</li><li>冷决策节点细分：company-movement-42-20260906-v2.json；链图采集：policy-input-capture-42-20260906.json</li><li>当前版本单点核验：policy-plan-view-decision-42-20260906.json</li><li>未保存的失败/剪枝分支、每次fork的随机身份不在历史链图中；本报告不声称完整搜索树回放。</li></ul></section><script id="data" type="application/json">${JSON.stringify(data).replace(/</g,"\\u003c")}</script><script>${script}</script></html>`;
new (require("node:vm").Script)(script);
fs.writeFileSync(out,html);
const summary={output:out,allNodes:data.all.nodes,fullNodes:data.full.nodes,fullSearches:full.length,retainedChains:chains.length,rootActions:input.legalActions.length,formalActions:actionDict.length,bytes:Buffer.byteLength(html),coverage:"全部保留链，非全部曾执行/剪枝路径"};
fs.writeFileSync("reports/iteration/search-node-report-20260907.json",JSON.stringify(summary,null,2)+"\n");console.log(summary);
