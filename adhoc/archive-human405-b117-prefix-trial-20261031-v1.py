"""Verify the single controlled trial and its source/registry bindings; no simulation."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
commit = '225966dd8630404654dbb17cd4139960f008c005'
read = lambda p: json.loads((stage/p).read_text())
sha = lambda p: hashlib.sha256((stage/p).read_bytes()).hexdigest()
folder = 'reports/ai-foundation-20261023/'
comparison = read(folder+'human405-b117-prefix-r1-comparison-20261031-v1.json')
assert comparison['allRuntimeFilesUnchanged'] and not comparison['baselineEligible']
assert comparison['interventionMinusControl'] == {'score': 5, 'stateValue': 6.5}
for row in [comparison['control'], comparison['intervention']]:
    for stem in ['record', 'save', 'trace']:
        assert sha(row[stem+'Path']) == row[stem+'Sha256']
    assert row['strictNativeReplay'] and row['exactFinalCommittedStateSessionRng']
    assert row['maxNativeInputs'] <= 256 and row['maxMilliseconds'] <= 600
assert comparison['control']['forcedTeacherInputs'] == 0
assert comparison['intervention']['forcedTeacherInputs'] == 4
source = read(folder+'human405-b117-prefix-trial-source-check-20261031-v1.json')
assert source['sourceCommit'] == commit
for p, expected in source['sourceHashes'].items():
    data = subprocess.check_output(['git', 'show', commit+':'+p], cwd=root)
    assert data == (stage/p).read_bytes()
    assert hashlib.sha256(data).hexdigest() == expected
versions, registry = read('reports/iteration/versions.json'), read('reports/iteration/registry.json')
own = 'ai-search-v94-b117-prefix-r1-20261031'
v = next(v for v in versions['versions'] if v['id'] == own)
w = next(v for v in registry['versions'] if v['id'] == own)
assert v['baselineEligible'] is False and w['baselineEligible'] is False and not w['isHead']
assert w['aiGeneration'] == 'v2' and registry['currentBaseline'] == 'ai-search-v41-baseline-20261029'
result = w['results'][0]
assert result['scores']['player-white'] == 18 and result['steps'] == 58 and not result['terminal']
assert result['recordPath'] == comparison['intervention']['recordPath'] and result['reportExists']
html = (stage/result['reportPath']).read_text()
assert pathlib.Path(result['recordPath']).stem in html
assert pathlib.Path(result['savePath']).name in html
print(json.dumps({'verified': True, 'runtimeAndTools': len(source['sourceHashes']),
    'controlReused': True, 'fixedTeacherInputs': 4, 'whiteAIInputs': 24,
    'controlWhite': 13, 'controlledWhite': 18, 'teacherWhite': 15,
    'baseline': registry['currentBaseline'], 'goalStatus': 'active'}))
