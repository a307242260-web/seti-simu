// 只消费5d17835f真实追踪；不重跑AI，不继承旧版路线编号或旧审查结论。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),src='step24-entry-states-5d17835f-20260908.json.gz';
const r=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(base,'reports/iteration',src))));
assert.ok(r.passed&&r.actionMatches&&Object.values(r.parity).every(Boolean));
assert.ok(r.codeHead.startsWith('5d17835f'));
const rows=r.rows.filter(x=>x.strategic);assert.equal(rows.length,4096);
const ctx={};vm.runInNewContext(fs.readFileSync(path.join(base,'randomizer/game/card-catalog.js'),'utf8'),ctx);
const cards=Object.fromEntries(ctx.SetiCardCatalog.map(c=>[c.card_id,{name:c.card_name,image:'../../assets/cards/'+c.set+'/split/'+c.card_id}]));
const nodes=new Map();const key=p=>JSON.stringify(p);
function ensure(p){if(!nodes.has(key(p)))nodes.set(key(p),{path:p,ids:new Set(),shared:0,entries:[],routes:[]});return nodes.get(key(p));}
for(const c of r.diagnostics.goalClusters||[])ensure(c.path).routes=c.routeVariants||[];
for(const row of rows){const keys=new Set();for(const o of row.node.origins)if(o.target)for(const p of o.goalPaths||[])keys.add(key([...p,o.target]));for(const k of keys){const n=ensure(JSON.parse(k));n.ids.add(row.ordinal);if(keys.size>1)n.shared++;}}
for(const row of rows)for(const o of row.entryState.entryOrigins.filter(o=>o.target&&(o.entry||o.target.startsWith('decision:'))))for(const p of o.paths||[]){
 const n=ensure([...p,o.target]),player=row.entryState.player,stateKey=key(player);let e=n.entries.find(e=>e.stateKey===stateKey);
 if(!e){e={stateKey,player,starts:[]};n.entries.push(e);}if(!e.starts.some(s=>key(s.chain)===key(o.chain)))e.starts.push({chain:o.chain,ordinal:row.ordinal});
}
const actionById=new Map();for(const row of r.rows)for(const a of [row.node.action,...row.execution.inputs])actionById.set(a.actionId,a);
const signature=a=>key([a.family,a.target||{}]),completions=new Map();
for(const row of rows)for(const o of row.entryState.entryOrigins.filter(o=>o.entry))for(const p of o.paths||[]){const k=key(p);if(!completions.has(k))completions.set(k,[]);completions.get(k).push({row,o});}
for(const n of nodes.values())for(const route of n.routes){route.states=[];const seen=new Set();
 for(const {row,o} of completions.get(key(n.path))||[]){const chain=o.chain.map((id,index)=>({a:actionById.get(id),index})).filter(x=>x.a?.family!=='end_turn'),tail=chain.slice(-route.actions.length);
  if(!tail.length||tail.length!==route.actions.length||!tail.every((x,i)=>x.a&&signature(x.a)===signature(route.actions[i])))continue;
  const prefix=o.chain.slice(0,tail[0].index),entry=n.entries.find(e=>e.starts.some(s=>key(s.chain)===key(prefix)));if(!entry)continue;
  const state={before:entry.player,after:row.entryState.player,ordinal:row.ordinal};const k=key([state.before,state.after]);if(!seen.has(k)){seen.add(k);route.states.push(state);}
 }
}
const instanceFaces={};for(const row of rows)for(const c of row.entryState.player.hand||[]){const a=instanceFaces[c.id]||=[];if(!a.includes(c.cardId))a.push(c.cardId);}
const list=[...nodes.values()].sort((a,b)=>a.path.length-b.path.length||b.ids.size-a.ids.size);
function letter(i){let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
const payload={source:r.source,cards,instanceFaces,initial:rows[0].entryState.player,
 nodes:list.map((n,i)=>({...n,letter:letter(i),ids:[...n.ids],entries:n.entries.map(({stateKey,...e})=>e)})),
 rows:rows.map(x=>({id:x.ordinal,action:x.node.action,before:x.node.priority,after:x.execution.priority,inputs:x.execution.inputs})),
 remaining:r.diagnostics.remainingFrontierNodeCount,beam:r.diagnostics.beamPrunedOriginCount,inputs:r.diagnostics.successfulInputSubmissionCount};
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>108.75组合 · 第24步目标搜索树</title>
<style>body{font:15px/1.6 system-ui;margin:24px;background:#f4f6fa;color:#223047}section{background:white;padding:18px;margin:14px 0;border-radius:8px}#layout{display:grid;grid-template-columns:420px 1fr;gap:18px}#tree,#detail{max-height:80vh;overflow:auto}button,summary{cursor:pointer}button{margin:5px;padding:5px;color:#174d9f}table{border-collapse:collapse;width:100%}td,th{padding:7px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}details{margin:10px 0;padding-left:12px;border-left:2px solid #ccd}img{width:140px;vertical-align:top;margin:6px}small{color:#667}@media(max-width:900px){#layout{display:block}}</style>
<h1>108.75组合：第24步真实目标树</h1><p>5d17835f · 4096执行节点 · ${payload.inputs}次正式输入 · 与原完整局动作和节点分类一致</p>
<p>目标按层展示，并标明父目标。每个目标的节点数只算本目标，不含子目标；共享执行会计入多个目标，不能直接加总。不同入口不冒充同一状态。本报告不自动套用旧版路线1/3等价结论。</p>
<section id="initial"></section><div id="layout"><section id="tree"></section><section id="detail"></section></div>
<section>尚余物理候选 ${payload.remaining}；队列累计裁掉来源 ${payload.beam}（不是物理节点数）。未执行的路径不能补成已经完成的路线。<a href="${src}">原始追踪检查点</a></section>
<script id="data" type="application/json">${JSON.stringify(payload).replace(/</g,'\\u003c')}</script><script>
const D=JSON.parse(document.getElementById('data').textContent),byId=new Map(D.rows.map(r=>[r.id,r])),byPath=new Map(D.nodes.map(n=>[JSON.stringify(n.path),n]));
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const labels={'data:analyze':'填数据并分析','orbit:mars:planet:':'环绕火星','land:mars:planet:':'登陆火星','orbit:venus:planet:':'环绕金星'};
const planets={mars:'火星',venus:'金星',mercury:'水星',jupiter:'木星',saturn:'土星',uranus:'天王星',neptune:'海王星'};
function label(k){if(labels[k])return labels[k];if(k.startsWith('tech:gain:'))return '获得科技 '+k.slice(10);if(k.startsWith('income:gain:'))return '增加收入 '+k.slice(12);if(k.startsWith('sector:win:'))return '争取扇区优势 '+k.slice(11);for(const [id,name] of Object.entries(planets))if(k.includes(':'+id+':'))return (k.startsWith('land:')?'登陆':'环绕')+name;return k;}
const cardText=s=>String(s).replace(/(?:b_[0-9]+[.]webp|dlc_[0-9]+[.]png)/g,id=>D.cards[id]?.name||id);
function action(a){let s=a.summary||a.family;const ids=[...(String(s).match(/(?:b_[0-9]+[.]webp|dlc_[0-9]+[.]png)/g)||[])];
 if(a.family==='choose_payment'&&a.target?.cardIds?.length){s='移动支付：';for(const id of a.target.cardIds){const faces=D.instanceFaces[id];if(faces?.length===1){ids.push(faces[0]);s+='弃《'+(D.cards[faces[0]]?.name||faces[0])+'》 ';}else s+='弃1张牌（牌面无法唯一关联） ';}if(a.target.energyCost)s+='另付'+a.target.energyCost+'电';}
 if(a.family==='choose_card'&&String(a.target?.choiceId||'').startsWith('pick:'))s='精选入手：'+s;
 if(a.family==='choose_card'&&String(a.target?.choiceId||'').startsWith('income:'))s='插入收入：'+s;
 const box=el('div',cardText(s));for(const id of new Set(ids)){const c=D.cards[id];if(!c)continue;const img=el('img');img.src=c.image;img.alt=c.name;img.loading='lazy';box.append(img);}return box;
}
function state(p){const r=p.resources;return '钱'+r.credits+' ｜ 电'+r.energy+' ｜ 宣传'+r.publicity+' ｜ 分数'+r.score+' ｜ 数据'+r.availableData+' ｜ 计算机'+p.dataState.placedTokens.length+'/6 ｜ 手牌'+p.hand.length+'张';}
function stateDiff(c){const table=el('table');const head=el('tr');['状态','执行前','完成后','变化'].forEach(t=>head.append(el('th',t)));table.append(head);function add(k,a,b){const tr=el('tr');[k,a,b,typeof a==='number'&&typeof b==='number'?b-a:a===b?'不变':'变化'].forEach(v=>tr.append(el('td',String(v))));table.append(tr);}for(const [k,t] of Object.entries({credits:'钱',energy:'电',publicity:'宣传',score:'分数',availableData:'数据'}))add(t,c.before.resources[k],c.after.resources[k]);add('计算机',c.before.dataState.placedTokens.length,c.after.dataState.placedTokens.length);add('手牌数量',c.before.hand.length,c.after.hand.length);for(const [k,t] of Object.entries({credits:'钱收入',energy:'电收入',handSize:'牌收入',additionalPublicScan:'公共扫描收入'}))add(t,c.before.income[k]||0,c.after.income[k]||0);return table;}
function priority(r){const table=el('table');const names=['完成目标','目标进度','当前状态价值','关联目标分','探测器资源缺口改善','新增痕迹','数据缺口改善','新增填数','分析就绪','最佳探测器目标分','剩余移动负值'];const a=r.before?.sortKey||[r.before],b=r.after?.sortKey||[r.after];const h=el('tr');['排序项（依次比较）','执行前','执行后'].forEach(t=>h.append(el('th',t)));table.append(h);for(let i=0;i<Math.max(a.length,b.length);i++){const tr=el('tr');[names[i]||'排序项'+i,a[i]??'不适用',b[i]??'不适用'].forEach(v=>tr.append(el('td',String(v))));table.append(tr);}return table;}
function show(n){const box=document.getElementById('detail');box.replaceChildren(el('h2',n?n.letter+' '+n.path.map(label).join(' → '):'全部执行顺序'));
 if(n){box.append(el('h3','目标入口状态'));for(const [i,e] of n.entries.entries()){const d=el('details');d.open=i===0;d.append(el('summary','入口'+(i+1)+'：'+state(e.player)),el('p','起步节点：'+e.starts.map(s=>'#'+s.ordinal).join('、')));if(n.path.at(-1)==='data:analyze')d.append(el('p','填满尚缺'+Math.max(0,6-e.player.dataState.placedTokens.length-e.player.resources.availableData)+'个数据。第4格收入不等于6格填满。'));for(const c of e.player.hand)d.append(action({summary:c.cardId}));box.append(d);}if(!n.entries.length)box.append(el('p','尚未执行到该目标入口，不用父目标状态代替。'));
 box.append(el('h3','完成路线与路线前后变化'));n.routes.forEach((r,i)=>{const d=el('details');d.append(el('summary','路线'+(i+1)+'：'+r.actions.map(a=>cardText(a.summary||a.family)).join(' → ')));for(const c of r.states){d.append(stateDiff(c),el('small','完成后状态来自后继入口 #'+c.ordinal+'；覆盖玩家状态，不代表全盘等价。'));}if(!r.states.length)d.append(el('p','未捕获可精确匹配的完成后入口，不虚构状态差异。'));const list=el('ol');for(const a of r.actions){const li=el('li');li.append(action(a));list.append(li);}d.append(list);box.append(d);});if(!n.routes.length)box.append(el('p','没有记录到完成路线。'));}
 box.append(el('h3','实际交替搜索顺序'));for(const id of n?n.ids:D.rows.map(r=>r.id)){const r=byId.get(id),d=el('details');d.append(el('summary','#'+id+' '+cardText(r.action.summary)+' · '+r.inputs.length+'次输入'));d.addEventListener('toggle',()=>{if(!d.open||d.dataset.loaded)return;d.dataset.loaded=1;d.append(priority(r));for(const a of r.inputs)d.append(action(a));});box.append(d);}}
const initial=document.getElementById('initial');initial.append(el('h2','第24步白方初始状态'),el('p',state(D.initial)));for(const c of D.initial.hand)initial.append(action({summary:c.cardId}));
const tree=document.getElementById('tree');const all=el('button','查看全部4096节点');all.onclick=()=>show(null);tree.append(all);for(let depth=1;depth<=Math.max(...D.nodes.map(n=>n.path.length));depth++){const group=el('details');group.open=depth<=2;group.append(el('summary','第'+depth+'层目标'));for(const n of D.nodes.filter(n=>n.path.length===depth)){const p=byPath.get(JSON.stringify(n.path.slice(0,-1))),line=el('div'),button=el('button',n.letter+' '+label(n.path.at(-1))+'：'+n.ids.length+'节点');button.onclick=()=>show(n);line.append(button);if(p){const parent=el('button','←父'+p.letter);parent.onclick=()=>show(p);line.append(parent);}else line.append(el('span','←起点'));line.append(el('small',' 共享'+n.shared+'节点'));group.append(line);}tree.append(group);}show(D.nodes[0]);
</script></html>`;
const out=path.join(base,'reports/iteration/step24-real-goal-tree-5d17835f-20260909.html');
for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
if(fs.existsSync(out))assert.equal(fs.readFileSync(out,'utf8'),html);else fs.writeFileSync(out,html,{flag:'wx'});
console.log(JSON.stringify({out,targets:payload.nodes.length,routes:payload.nodes.reduce((s,n)=>s+n.routes.length,0),routesWithStates:payload.nodes.reduce((s,n)=>s+n.routes.filter(r=>r.states.length).length,0),remaining:payload.remaining,beam:payload.beam}));
