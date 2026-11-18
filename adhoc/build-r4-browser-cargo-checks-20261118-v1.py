"""Build a verification-only v513 overlay; never run AI or change its runtime."""
from pathlib import Path
import difflib
import gzip
import hashlib
import json
import subprocess
import tempfile

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'r4-browser-cargo-checks-source-20261118-v1.json'
sha = lambda b: hashlib.sha256(b).hexdigest()
if out.exists():
    print('REUSE', out)
    raise SystemExit(0)
parent_path = M / 'r4-main-owned-v513-source-20261118-v1.json'
parent = json.loads(parent_path.read_text())
base = Path(parent['sealedRoot'])
for name, h in parent['paths'].items():
    assert sha((base / name).read_bytes()) == h, name
runtime = Path(tempfile.mkdtemp(prefix='seti-v513-cargo-checks-20261118-'))
subprocess.run(['cp', '-cR', str(base) + '/.', str(runtime)], check=True)
load = lambda name: json.loads(gzip.decompress((M / name).read_bytes()))
diagnosis = load('r4-browser-cargo-diagnosis-20261118-v1.json.gz')
replay = load('r4-browser-cargo-replay-20261118-v1.json.gz')
prior = load('r4-cargo-whole-suffix-20261118-v1.receipt.json.gz')
assert replay['final'] == prior['root']
fixture = {'root': replay['root'], 'goal': diagnosis['plan']['goal'],
           'actions': [row['action'] for row in replay['trace']] + prior['inputs'],
           'firstClaimInput': 5, 'afterFirstClaim': replay['final'],
           'final': prior['checkpoints'][-1]['envelope'], 'expectedValue': 244,
           'provenance': {name: sha((M / name).read_bytes()) for name in [
               'r4-browser-cargo-diagnosis-20261118-v1.json.gz',
               'r4-browser-cargo-replay-20261118-v1.json.gz',
               'r4-cargo-whole-suffix-20261118-v1.receipt.json.gz']}}
assert len(fixture['actions']) == 12
fixture_name = 'randomizer/game/ai/fixtures/cargo-browser-native-replay-20261118-v1.json.gz'
fixture_bytes = gzip.compress(json.dumps(fixture, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0)
archived_fixture = M / 'r4-browser-cargo-native-replay-fixture-20261118-v1.json.gz'
archived_fixture.write_bytes(fixture_bytes)
(runtime / fixture_name).write_bytes(fixture_bytes)
name = 'tools/browser-smoke-inventory.js'
before = (base / name).read_text()
body = before
helper = """const assertOtherCargo=(initialJobs,currentJobs,goal)=>{
          const others=Object.values(initialJobs).filter(job=>job.fossilId!==goal.fossilId);
          if(!others.length)throw Error('independent cargo witness missing');
          for(const other of others){const actual=Object.values(currentJobs).find(job=>job.fossilId===other.fossilId);
            if(JSON.stringify(actual)!==JSON.stringify(other))throw Error('first claim overwrote independent cargo');}
        };"""
changes = {
    "const before=JSON.stringify(save()),oldJob=JSON.stringify(state().aliens.chong.transportTasksByRocketId['5']),turn=state().turn.turnNumber;let checkpoint,initial,oldIsolated=false,inputs=0;":
    "const before=JSON.stringify(save()),initialJobs=structuredClone(state().aliens.chong.transportTasksByRocketId),turn=state().turn.turnNumber;let checkpoint,initial,selectedGoal,oldIsolated=false,inputs=0;\n        " + helper,
    "throw Error('cargo fixed plan or executed root report missing');}":
    "throw Error('cargo fixed plan or executed root report missing');selectedGoal=selected.goal;}",
    "apply(a);if(a.family==='complete_task'&&a.target.cardInstanceId==='alien-chong-6-16'){if(JSON.stringify(state().aliens.chong.transportTasksByRocketId['5'])!==oldJob)throw Error('first claim overwrote independent cargo');oldIsolated=true;}":
    "apply(a);if(a.family==='complete_task'&&a.target.ruleId==='transport'&&a.target.cardInstanceId===selectedGoal.cardId){assertOtherCargo(initialJobs,state().aliens.chong.transportTasksByRocketId,selectedGoal);oldIsolated=true;}"
}
for old, new in changes.items():
    assert body.count(old) == 1, old
    body = body.replace(old, new)
expression = """(async()=>{
 const response=await fetch('/FIXTURE');if(!response.ok)throw Error('Native replay fixture missing');
 const f=JSON.parse(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text());
 const seed=JSON.parse(f.root.committedState).meta.seed,seat='player-white';
 const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v,c)=>window.SetiRuleObservation.buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true,trustedCommitted:c?.trustedCommitted===true,trustedFrozenWorking:c?.trustedFrozenWorking===true})});
 k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState)},menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 HELPER
 try{
  if(!c.lifecycle.restore(f.root).ok||JSON.stringify(save())!==JSON.stringify(f.root))throw Error('Native replay root differs');
  const initialJobs=structuredClone(state().aliens.chong.transportTasksByRocketId),rng=JSON.stringify(state().meta.rngState);let checked=false,mutations=0;
  for(let i=0;i<f.actions.length;i++){
   const expected=f.actions[i],a=menu().find(x=>x.actionId===expected.actionId&&JSON.stringify(x.target)===JSON.stringify(expected.target));if(!a)throw Error('Native replay action missing: '+i);
   const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);if(!r.ok)throw Error('Native replay rejected: '+i);
   if(i+1===f.firstClaimInput){
    if(a.family!=='complete_task'||a.target.cardInstanceId!==f.goal.cardId||JSON.stringify(save())!==JSON.stringify(f.afterFirstClaim))throw Error('Native first-claim boundary differs');
    const currentJobs=structuredClone(state().aliens.chong.transportTasksByRocketId);assertOtherCargo(initialJobs,currentJobs,f.goal);
    const entry=Object.entries(initialJobs).find(([,job])=>job.fossilId!==f.goal.fossilId);if(!entry)throw Error('Other job missing');
    for(const kind of ['overwrite','remove']){const changed=structuredClone(currentJobs);if(kind==='overwrite')changed[entry[0]].cardId+=':corrupt';else delete changed[entry[0]];let rejected=false;try{assertOtherCargo(initialJobs,changed,f.goal)}catch{rejected=true}if(!rejected)throw Error('Broken cargo invariant accepted: '+kind);mutations++;}
    if(JSON.stringify(currentJobs['5'])===JSON.stringify(initialJobs['5']))throw Error('Legacy invariant unexpectedly passes');checked=true;
   }
  }
  const value=window.SetiStateValue.createStateValueEvaluator(seat)(c.projection({role:'player',playerId:seat}).state);
  if(JSON.stringify(save())!==JSON.stringify(f.final)||JSON.stringify(state().meta.rngState)!==rng||value!==f.expectedValue||!checked||mutations!==2)throw Error('Native final state, RNG, value or invariant differs');
  window.__knownCargoNativeReplay={ok:true,inputs:f.actions.length,value,firstClaimPreservedFossil:'fossil_06',negativeControls:mutations};
 }finally{c.dispose()}
})()""".replace('FIXTURE', fixture_name).replace('HELPER', helper)
case = {'id': 'production-known-post-main-cargo-native-replay', 'file': 'randomizer/index.html',
        'readyExpression': 'Boolean(window.SetiProductionKernel && window.SetiStateValue && window.SetiRuleObservation)',
        'actionExpression': expression,
        'successExpression': 'window.__knownCargoNativeReplay?.ok === true && window.__knownCargoNativeReplay.inputs === 12 && window.__knownCargoNativeReplay.value === 244 && window.__knownCargoNativeReplay.negativeControls === 2',
        'obligation': 'Replay saved Native inputs; exact first-claim/final states and RNG; actual independent task preserved; overwritten or missing other task rejected. No AI search.',
        'counterexample': 'The claimed fossil task is mistaken for the independent task, or a damaged independent task passes.'}
needle = 'const smokes = ['
assert body.count(needle) == 1
body = body.replace(needle, needle + '\n  Object.freeze(' + json.dumps(case, ensure_ascii=False) + '),', 1)
(runtime / name).write_text(body)
subprocess.run(['node', '--check', str(runtime / name)], check=True)
patch = ''.join(difflib.unified_diff(before.splitlines(True), body.splitlines(True), fromfile='a/' + name, tofile='b/' + name, n=0))
patch_path = M / 'r4-browser-cargo-checks-20261118-v1.patch'
patch_path.write_text(patch)
for key, h in parent['paths'].items():
    if key != name:
        assert sha((runtime / key).read_bytes()) == h, key
# Presentation assets are read-only links; the Native card catalog stays sealed.
for p in (R / 'assets').iterdir():
    target = runtime / 'assets' / p.name
    if not target.exists():
        target.symlink_to(p, target_is_directory=p.is_dir())
result = {'parentManifest': str(parent_path.relative_to(R)), 'parentManifestSha256': sha(parent_path.read_bytes()),
          'kind': 'verification-only overlay; v513 AI runtime unchanged', 'runtime': str(runtime),
          'changedPaths': {name: sha(body.encode()), fixture_name: sha(fixture_bytes)},
          'unchangedParentPaths': {key: h for key, h in parent['paths'].items() if key != name},
          'incrementalPatch': str(patch_path.relative_to(R)), 'patchSha256': sha(patch.encode()),
          'fixtureMapping': {fixture_name: str(archived_fixture.relative_to(R))},
          'helperSource': helper, 'helperSha256': sha(helper.encode()),
          'newAISearches': 0, 'newGames': 0, 'promoted': False,
          'validationScope': 'Saved Native replay only; original AI Browser smoke and remaining admission not claimed passed.'}
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'runtime': str(runtime), 'fixtureBytes': len(fixture_bytes), 'unchangedParentFiles': len(result['unchangedParentPaths']), 'newAISearches': 0}))
