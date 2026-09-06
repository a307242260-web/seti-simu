"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const rockets = require("../randomizer/game/rockets"), solar = require("../randomizer/solar-system/core");
const ability = require("../randomizer/game/abilities/rocket");
const input = "reports/iteration/company-hot-prefix-20260907.json";
const output = "reports/iteration/company-route-cost-20260907.json";
const key = (c, free) => `${c.x},${c.y}:${free}`;
const better = (a,b) => !b || a.paid < b.paid || (a.paid === b.paid && a.steps < b.steps);
const equal = (a,b) => a && b && a.paid === b.paid && a.steps === b.steps;

// 几何费用下界：免费额度是一次至多1点的正式边，不是从总点数统一减1。
// 只选给定目的，不执行/估算沿途事件；不能以此删掉有独立收益的更贵路径。
function solve(graph, destinations) {
  const reverse = new Map([...graph.keys()].map(k=>[k,[]]));
  for (const [from,edges] of graph) for (const edge of edges) reverse.get(edge.to).push({from,...edge});
  const distances = new Map(destinations.map(k=>[k,{paid:0,steps:0}]));
  const queue = [...destinations];
  let expanded = 0;
  const settled = new Set();
  while (queue.length) {
    queue.sort((a,b)=>distances.get(a).paid-distances.get(b).paid || distances.get(a).steps-distances.get(b).steps || a.localeCompare(b));
    const at = queue.shift();
    if (settled.has(at)) continue;
    settled.add(at); expanded++;
    for (const edge of reverse.get(at)) {
      const value = {paid:distances.get(at).paid+edge.paid,steps:distances.get(at).steps+1};
      if (!better(value,distances.get(edge.from))) continue;
      distances.set(edge.from,value);queue.push(edge.from);
    }
  }
  assert.ok(expanded <= 64, "每次需求的唯一状态展开不超过32格×2额度状态");
  return {distances,expanded};
}

if (fs.existsSync(output)) console.log(`已有原型：${output}`);
else {
  const fixture = JSON.parse(fs.readFileSync(input)), root = JSON.parse(fixture.envelope.committedState);
  const before = JSON.stringify(root), player = root.players.players.find(p=>p.id === "player-green");
  const context = {...root,state:root};
  const locations = solar.collectVisibleCoordinateContents(root.solarSystem)
    .filter(c=>c.y >= rockets.SECTOR_RING_MIN && c.y <= rockets.SECTOR_RING_MAX);
  const goals = solar.createSolarSnapshot(root.solarSystem).planetLocations.filter(c=>c.planetId !== "earth")
    .map(c=>({id:c.planetId,coordinates:[c]}));
  goals.push({id:"asteroid-position",coordinates:locations.filter(c=>solar.resolveVisibleContent(c.x,c.y,root.solarSystem)?.content?.kind === solar.layout.CONTENT_KIND.ASTEROID)});
  const report = {scope:"当前可达后段公司边界的带一次免费步路线费用原型；非生产搜索、不含终点费用/奖励/动态准备，最短路不证明收益支配",input,rows:[]};
  const started = performance.now();
  for (const rocket of rockets.getRocketsForPlayer(root.pieces,player.id).filter(r=>r.surface === "solar-board")) {
    const graph = new Map();
    for (const c of locations) for (const free of [0,1]) {
      const edges = [], points = ability.getRequiredMovePointsFromCoordinate(context,player,c);
      assert.ok(Number.isInteger(points) && points > 0);
      for (const d of ability.MOVE_DIRECTIONS) {
        const move = rockets.canMoveFromCoordinate(root.pieces,c,d.deltaX,d.deltaY,rocket.id);
        if (!move.ok) continue;
        edges.push({to:key(move.to,free),paid:points,points,mode:"paid",direction:d.id});
        if (free && points <= 1) edges.push({to:key(move.to,0),paid:0,points,mode:"company",direction:d.id});
      }
      graph.set(key(c,free),edges);
    }
    assert.equal(graph.size,64);
    const coordinate = rockets.getRocketSectorCoordinate(rocket);
    for (const goal of goals) {
      assert.ok(goal.coordinates.length);
      const {distances,expanded} = solve(graph,goal.coordinates.flatMap(c=>[key(c,0),key(c,1)]));
      for (const free of [0,1]) {
        const from = key(coordinate,free), best = distances.get(from);
        assert.ok(best, `${rocket.id}/${goal.id}应几何可达`);
        const next = graph.get(from).filter(e=>{
          const tail = distances.get(e.to);
          return tail && equal(best,{paid:e.paid+tail.paid,steps:tail.steps+1});
        });
        assert.ok(best.steps === 0 || next.length);
        for (const e of next.filter(e=>e.mode === "company")) {
          assert.ok(fixture.companyChoices.some(c=>c.target.rocketId === rocket.id && c.payload.direction === e.direction), "免费首步须出现在正式公司合法选择中");
        }
        report.rows.push({rocketId:rocket.id,goal:goal.id,free,from:coordinate,...best,expanded,next});
      }
    }
    for (const [from,edges] of graph) for (const e of edges.filter(e=>e.mode === "company")) {
      assert.ok(from.endsWith(":1") && e.to.endsWith(":0") && e.points === 1 && e.paid === 0);
    }
  }
  assert.equal(JSON.stringify(root),before,"路线读取不修改状态/RNG/序号");
  report.wallMs = performance.now()-started;
  report.verified = true;
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,verified:true,wallMs:report.wallMs,rows:report.rows.map(r=>({rocket:r.rocketId,goal:r.goal,free:r.free,paid:r.paid,steps:r.steps,next:r.next.map(e=>`${e.mode}:${e.direction}`)}))},null,2));
}
