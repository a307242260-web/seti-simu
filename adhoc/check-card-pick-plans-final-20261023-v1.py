"""Bind the final fixed-card-plan evidence to the tested source and logs."""
import hashlib
import json
import pathlib
import subprocess

stage=pathlib.Path('.')
sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest()
files=json.loads((stage/'adhoc/card-pick-base-changes-20261023-v1.json').read_text())
files += ['randomizer/game/ai/card-pick-planning.js','randomizer/game/ai/card-pick-planning.test.js',
    'adhoc/benchmark-fixed-card-pick-20261023-v1.js','adhoc/audit-card-pick-plans-corpus-20261023-v1.js',
    'adhoc/explain-publicity-trade-20261023-v1.js']
syntax=[]
for p in files:
    if p.endswith('.js'):
        subprocess.run(['node','--check',p],check=True,capture_output=True)
        syntax.append(p)
reports=['reports/ai-foundation-20261023/fixed-card-pick-benchmark-v1.json','reports/ai-foundation-20261023/card-pick-plans-corpus-v1.json']
checks=0
for p in reports:
    report=json.loads((stage/p).read_text())
    for source,expected in report['sourceHashes'].items():
        assert sha(source)==expected,source
        checks+=1
    for row in report['rows']:
        assert sha(row['rawPath'])==row['rawSha256'],row['rawPath']
        assert row['rootUnchanged'] and not row.get('error'),row
logs=['adhoc/card-pick-plans-full-node-20261023-v2.log','adhoc/card-pick-plans-browser-20261023-v2.log',
    'adhoc/card-pick-plans-v-input-20261023-v2.log','adhoc/card-pick-plans-targeted-20261023-v6.log']
full,browser,audit,targeted=[(stage/p).read_text() for p in logs]
assert 'SUMMARY unit passed=139 failed=0 total=139' in full
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
assert 'SUMMARY browserSmoke passed=5 failed=0 total=5' in browser
assert 'SUMMARY unit passed=3 failed=0 total=3' in targeted
assert sum(line.startswith('[PASS] independent-') for line in audit.splitlines())==32
failures=[line for line in audit.splitlines() if line.startswith('[FAIL]')]
assert len(failures)==1 and 'decisionObs' in failures[0] and 'aomomo' in failures[0]
result={'syntaxChecked':syntax,'runtimeSourceHashChecks':checks,'reportHashesMatchFinalSource':True,'rawHashesVerified':True,
    'fullNode':'139 unit + 1 fullFlow passed','chromeSmokes':'5 passed','independentVInputs':32,'legacyVAuditFailure':failures[0],
    'logs':{p:sha(p) for p in logs},'fixedPoints':'5/8; 062/105/152 watchdog',
    'scope':'Purpose admission, fixed card/payment execution and semantic offer cache. Not complete turn, comprehensive card strength or full-game acceptance.'}
(stage/'reports/ai-foundation-20261023/card-pick-plans-final-validation-v1.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
