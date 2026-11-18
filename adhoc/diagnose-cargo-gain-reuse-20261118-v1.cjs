'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict'),os=require('node:os'),cp=require('node:child_process');
const R=path.resolve(__dirname,'..'),M=path.join(R,'reports/ai-foundation-20261118'),out=path.join(M,'cargo-gain-reuse-diagnostic-20261118-v1.json.gz'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out)){console.log('REUSE',out);process.exit(0);}
const parentPath=path.join(M,'r4-browser-cargo-checks-source-20261118-v1.json'),parent=JSON.parse(fs.readFileSync(parentPath)),runtime=fs.mkdtempSync(path.join(os.tmpdir(),'seti-cargo-gain-diagnostic-20261118-'));cp.execFileSync('cp',['-cR',parent.runtime+'/.',runtime]);
for(const [p,h]of Object.entries({...parent.unchangedParentPaths,...parent.changedPaths}))assert.equal(sha(fs.readFileSync(path.join(runtime,p))),h);
const file=path.join(runtime,'randomizer/game/ai/analysis-port.js'),base=fs.readFileSync(file,'utf8'),needle='    function knownCargoFuture(state,known,forbiddenCoordinate=null){';assert.equal(base.split(needle).length,2);
const keyFunction=`    function cargoGainReuseKey(state,known,forbiddenCoordinate){
      const p=state.players.players.find(q=>q.id===seatId);
      if(!p||state.turn.roundNumber!==4||!Number.isSafeInteger(p.resources.score)
        ||!knownRootAlienIds.has("虫")||!knownRootAlienIds.has("阿米巴")
        ||Object.values(state.aliens.aliens).some(s=>!s.revealed||!["虫","阿米巴"].includes(s.alienId))
        ||cardEffects.listPendingTriggerKeys(p,state.turn).length
        ||p.reservedCards.some(c=>{const rule=endScoring.resolveCardEndGameRule(c,cardEffects);return rule&&!["planetLandingPairs","amibaTraceCount","chongTraceCount"].includes(rule.kind);}))return null;
      const owner={...p,resources:{...p.resources,score:null},scoreSources:null};
      const source={...state,data:{...state.data,nebulae:null,sectorSettlements:null},
        players:{...state.players,players:state.players.players.map(q=>q===p?owner:q)}};
      return JSON.stringify([source,[...known].sort(),forbiddenCoordinate]);
    }
`;
const wrapper=keyFunction+`    function knownCargoFuture(state,known,forbiddenCoordinate=null){
      const keyStart=performance.now(),key=cargoGainReuseKey(state,known,forbiddenCoordinate),keyMs=performance.now()-keyStart;
      const start=performance.now(),result=uncachedKnownCargoFuture(state,known,forbiddenCoordinate),elapsed=performance.now()-start;
      globalThis.__setiCargoGainObserver({key,keyMs,result,elapsed,rebase:()=>finalNoProbeValue(state,state.players.players.find(p=>p.id===seatId))});
      return result;
    }
    function uncachedKnownCargoFuture(state,known,forbiddenCoordinate=null){`;
fs.writeFileSync(file,base.replace(needle,wrapper));const rows=[],groups=new Map();
globalThis.__setiCargoGainObserver=({key,keyMs,result,elapsed,rebase})=>{
 const keyHash=key===null?null:sha(Buffer.from(key)),resultHash=result?sha(Buffer.from(JSON.stringify({gain:result.gain,plans:result.plans}))):null;
 const row={keyHash,keyBytes:key?.length||0,keyMilliseconds:keyMs,available:!!result,resultHash,milliseconds:elapsed,rebaseMilliseconds:0,rebaseExact:true};
 if(key!==null){let group=groups.get(key);if(!group){group={keyHash,keyBytes:key.length,calls:0,available:!!result,resultHash,consistent:true,repeatMilliseconds:0,rebaseMilliseconds:0,keyMilliseconds:0};groups.set(key,group)}else{group.repeatMilliseconds+=elapsed;if(group.resultHash!==resultHash)group.consistent=false;if(result){const start=performance.now(),value=rebase();row.rebaseMilliseconds=performance.now()-start;row.rebaseExact=value+result.gain===result.value;group.rebaseMilliseconds+=row.rebaseMilliseconds;}}
 group.calls++;group.keyMilliseconds+=keyMs;}
 rows.push(row);
};
const refPath=path.join(M,'r4-main-owned-point289-v513-20261118-v1.json.gz'),ref=JSON.parse(z.gunzipSync(fs.readFileSync(refPath)));process.chdir(runtime);const {open}=require(path.join(R,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/native-root-harness-20261118-v1.cjs')),m=open(ref.root);
const result={kind:'Cargo marginal-value identity diagnostic; no caching and no admission timing',referenceSha256:sha(fs.readFileSync(refPath)),parentManifestSha256:sha(fs.readFileSync(parentPath)),driverSha256:sha(fs.readFileSync(__filename)),runtime,patch:{file:'randomizer/game/ai/analysis-port.js',beforeSha256:sha(Buffer.from(base)),afterSha256:sha(fs.readFileSync(file)),needle,wrapper,keyFunction},rows};
try{
 const q=m.automatic();result.search={complete:q.complete,native:q.n,value:q.value,graphNodes:q.lines.length,actionId:q.a.actionId,wireGraphSha256:sha(Buffer.from(JSON.stringify(q.lines))),wireRootsSha256:sha(Buffer.from(JSON.stringify(q.roots)))};
 result.graphAndRootsExact=result.search.wireGraphSha256===sha(Buffer.from(JSON.stringify(ref.search.lines)))&&result.search.wireRootsSha256===sha(Buffer.from(JSON.stringify(ref.search.roots)));
 result.groups=[...groups.values()];const positive=result.groups.filter(g=>g.available);result.summary={calls:rows.length,eligibleCalls:result.groups.reduce((n,g)=>n+g.calls,0),uniqueKeys:result.groups.length,positiveKeys:positive.length,positiveCalls:positive.reduce((n,g)=>n+g.calls,0),positiveRepeats:positive.reduce((n,g)=>n+g.calls-1,0),keyMilliseconds:rows.reduce((n,r)=>n+r.keyMilliseconds,0),repeatMilliseconds:positive.reduce((n,g)=>n+g.repeatMilliseconds,0),rebaseMilliseconds:positive.reduce((n,g)=>n+g.rebaseMilliseconds,0),consistent:result.groups.every(g=>g.consistent),rebaseExact:rows.every(r=>r.rebaseExact)};
 result.summary.optimisticNetMilliseconds=result.summary.repeatMilliseconds-result.summary.keyMilliseconds-result.summary.rebaseMilliseconds;fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));
 assert(result.graphAndRootsExact&&q.complete&&q.n===69&&q.value===239.5);assert(result.summary.consistent&&result.summary.rebaseExact);console.log(JSON.stringify({output:out,search:result.search,summary:result.summary}));
}catch(error){result.failure={message:error.message,stack:error.stack};fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));throw error;}
finally{delete globalThis.__setiCargoGainObserver;m.dispose();}
