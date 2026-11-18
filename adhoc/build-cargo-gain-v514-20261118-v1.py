"""Build one isolated exact-delta cache prototype after the scoped diagnostic."""
from pathlib import Path
import gzip
import hashlib
import json
import subprocess
import tempfile

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'cargo-gain-v514-build-20261118-v1.json'
sha = lambda b: hashlib.sha256(b).hexdigest()
if out.exists():
    print('REUSE', out)
    raise SystemExit(0)
d = json.loads(gzip.decompress((M / 'cargo-compact-reuse-diagnostic-20261118-v2.json.gz').read_bytes()))
assert d['summary']['consistent'] and d['summary']['rebaseExact']
assert d['summary']['optimisticNetMilliseconds'] > 39.702459 + 5
parent_path = M / 'r4-browser-cargo-checks-source-20261118-v1.json'
parent = json.loads(parent_path.read_text())
runtime = Path(tempfile.mkdtemp(prefix='seti-cargo-gain-v514-20261118-'))
subprocess.run(['cp', '-cR', parent['runtime'] + '/.', str(runtime)], check=True)
for p, h in {**parent['unchangedParentPaths'], **parent['changedPaths']}.items():
    assert sha((runtime / p).read_bytes()) == h, p
key_source = (R / 'adhoc/cargo-compact-key-source-20261118-v2.js').read_text()
assert key_source == d['patch']['keyFunction']
p = runtime / 'randomizer/game/ai/analysis-port.js'
body = p.read_text()
needle = '    function knownCargoFuture(state,known,forbiddenCoordinate=null){'
assert body.count(needle) == 1
wrapper = '''    const cargoGainQuotes=new Map();
    const cargoGainStats={hits:0,misses:0,bypasses:0,stores:0,evictions:0,maxKeyCharacters:0};
''' + key_source + '''    function knownCargoFuture(state,known,forbiddenCoordinate=null){
      const key=cargoGainReuseKey(state,known,forbiddenCoordinate);
      if(key!==null){
        const saved=cargoGainQuotes.get(key);
        if(saved){
          cargoGainStats.hits++;
          const p=state.players.players.find(q=>q.id===seatId);
          return {value:stateValue.sumValueParts([finalNoProbeValue(state,p),saved.gain]),
            gain:saved.gain,plans:copyForkData(saved.plans)};
        }
        cargoGainStats.misses++;
      }else cargoGainStats.bypasses++;
      const result=uncachedKnownCargoFuture(state,known,forbiddenCoordinate);
      if(key!==null&&result){
        // Eviction changes work only: a miss executes the same complete Native
        // continuation. No Native state or successor is retained in this cache.
        if(cargoGainQuotes.size>=64){cargoGainQuotes.delete(cargoGainQuotes.keys().next().value);cargoGainStats.evictions++;}
        cargoGainQuotes.set(key,{gain:result.gain,plans:copyForkData(result.plans)});
        cargoGainStats.stores++;cargoGainStats.maxKeyCharacters=Math.max(cargoGainStats.maxKeyCharacters,key.length);
      }
      return result;
    }
    function uncachedKnownCargoFuture(state,known,forbiddenCoordinate=null){'''
body = body.replace(needle, wrapper)
needle = '    function close() {\n'
assert body.count(needle) == 1
body = body.replace(needle, needle + '      cargoGainQuotes.clear();\n')
needle = '      if (fork) throw new Error("ANALYSIS_ROOT_ALREADY_OPEN");'
assert body.count(needle) == 1
body = body.replace(needle, needle + '\n      cargoGainQuotes.clear();for(const key of Object.keys(cargoGainStats))cargoGainStats[key]=0;')
needle = 'return freeze({ cardPick:{...picks,'
assert body.count(needle) == 1
body = body.replace(needle, 'return freeze({ cargoGainReuse:{...cargoGainStats,entries:cargoGainQuotes.size,maxEntries:64},cardPick:{...picks,')
p.write_text(body)
p = runtime / 'randomizer/game/ai/decision-search.js'
body = p.read_text()
assert body.count('seti-complete-decision-search-v513') == 1
p.write_text(body.replace('seti-complete-decision-search-v513', 'seti-complete-decision-search-v514'))
fixture = {'root': json.loads(gzip.decompress((M / 'r4-main-owned-point289-v513-20261118-v1.json.gz').read_bytes()))['root'],
           'examples': d['examples'], 'sourceDiagnosticSha256': sha((M / 'cargo-compact-reuse-diagnostic-20261118-v2.json.gz').read_bytes())}
fixture_bytes = gzip.compress(json.dumps(fixture, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0)
fixture_path = runtime / 'randomizer/game/ai/fixtures/cargo-gain-reuse-20261118-v1.json.gz'
fixture_path.write_bytes(fixture_bytes)
archived_fixture = M / 'cargo-gain-reuse-cases-20261118-v1.json.gz'
archived_fixture.write_bytes(fixture_bytes)
result = {'candidate': 'v514', 'runtime': str(runtime), 'parentManifest': str(parent_path.relative_to(R)),
          'parentManifestSha256': sha(parent_path.read_bytes()), 'promoted': False,
          'kind': 'Exact cargo value-delta memo; Native states and policy graph are unchanged',
          'keySource': str((R / 'adhoc/cargo-compact-key-source-20261118-v2.js').relative_to(R)),
          'wrapper': wrapper, 'fixtureMapping': {str(fixture_path.relative_to(runtime)): str(archived_fixture.relative_to(R))}}
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
for f in ['randomizer/game/ai/analysis-port.js', 'randomizer/game/ai/decision-search.js']:
    subprocess.run(['node', '--check', str(runtime / f)], check=True)
print(json.dumps({'runtime': str(runtime), 'fixtureBytes': len(fixture_bytes), 'promoted': False}))
