"""Build a HEAD-only validation fix without overwriting the shared old checkout."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
output = directory / 'frozen-continuation-validation-20261119-v1.json'
assert not output.exists()
git = lambda *args: subprocess.check_output(['git', *args], cwd=repo)
head = git('rev-parse', 'HEAD').decode().strip()
snapshot = Path(tempfile.mkdtemp(prefix='seti-frozen-validation-head-20261119-', dir='/private/tmp'))
names = git('ls-tree', '-r', '--name-only', head, '--', 'randomizer', 'tools', 'assets').decode().splitlines()
names = [name for name in names if name.endswith(('.js', '.cjs', '.json', '.gz'))]
archive = git('archive', '--format=tar', head, '--', *names)
assert len(archive) < 64 * 1024 * 1024
with tarfile.open(fileobj=io.BytesIO(archive)) as source:
    for item in source:
        if not item.isfile():
            continue
        assert not item.name.startswith('/') and '..' not in Path(item.name).parts
        target = snapshot / item.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.extractfile(item).read())
doc = 'docs/rl-simulation-env.md'
(snapshot / doc).parent.mkdir(parents=True, exist_ok=True)
(snapshot / doc).write_bytes(git('show', head + ':' + doc))
test = 'tools/research-frozen-continuation-identity.test.js'
(snapshot / test).write_bytes((repo / 'adhoc/frozen-continuation-identity-test-source-20261119.cjs').read_bytes())
record = {'parent': head, 'snapshot': str(snapshot), 'newNativeInputs': 0,
          'newAutonomousGames': 0, 'productionStrategyChanged': False, 'checks': {}}
save = lambda: output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
red = subprocess.run(['node', test], cwd=snapshot, capture_output=True, text=True)
record['checks']['before'] = {'exitCode': red.returncode, 'stdout': red.stdout, 'stderr': red.stderr}
save()
assert red.returncode != 0 and 'ENOENT' in red.stderr

file = snapshot / 'tools/research-human405-full.js'
source = file.read_text()
def replace(old, new):
    global source
    assert source.count(old) == 1, (old[:100], source.count(old))
    source = source.replace(old, new)

runtime_loop = " for(const [p,h]of Object.entries(proof.runtimeSourceHashes))if(p.startsWith('randomizer/'))assert.equal(sha(p),h,'FULL_CONTINUATION_STRATEGY_DRIFT:'+p);\n"
assert source.count(runtime_loop) == 2
source = source.replace(runtime_loop, '')
for record_name, proof_name in [('V189_SOURCE', 'V189_PROOF'), ('SOURCE', 'PROOF')]:
    old = f' const record=read({record_name}),proof=read({proof_name}),save=read(record.savePath),state=JSON.parse(save.committedState);'
    new = f' const proof=read({proof_name});\n' + runtime_loop + f' const record=read({record_name}),save=read(record.savePath),state=JSON.parse(save.committedState);'
    replace(old, new)
replace('function v661Source(){', "function v661RuntimeHashes(){\n const admission=read(V661_DIR+'v661-source-admission-proof-20261109-v1.json');\n assert.equal(sha(admission.manifest),admission.manifestSha256,'V661_CONTINUATION_SOURCE_DRIFT:'+admission.manifest);\n return read(admission.manifest).runtimeHashes;\n}\nfunction v661Source(){")
replace("function v661Continuation(){\n const {originalRuntimeHashes,...source}=v661Source();\n for(const [p,h] of Object.entries(originalRuntimeHashes))assert.equal(sha(p),h,'V661_CONTINUATION_SOURCE_DRIFT:'+p);\n return source;\n}",
 "function v661Continuation(){\n const runtimeHashes=v661RuntimeHashes();\n for(const [p,h] of Object.entries(runtimeHashes))assert.equal(sha(p),h,'V661_CONTINUATION_SOURCE_DRIFT:'+p);\n const {originalRuntimeHashes,...source}=v661Source();\n assert.deepEqual(originalRuntimeHashes,runtimeHashes,'V661_CONTINUATION_SOURCE_DRIFT:runtime-manifest');\n return source;\n}")
r4_loop = " for(const [p,h] of Object.entries(admission.runtimeHashes))assert.equal(sha(p),h,'R4_CANDIDATE_SOURCE_DRIFT:'+p);\n"
replace(r4_loop, '')
replace(' const {originalRuntimeHashes,...source}=v661Source(),admission=read(R4_ADMISSION);', ' const admission=read(R4_ADMISSION);')
replace(' assert.equal(admission.scenario,R4_ID);', ' assert.equal(admission.scenario,R4_ID);\n' + r4_loop +
 " const expectedRuntimeHashes=v661RuntimeHashes();\n assert(Object.keys(expectedRuntimeHashes).every(p=>Object.hasOwn(admission.runtimeHashes,p)),'R4_ADMISSION_RUNTIME_MISSING');\n const {originalRuntimeHashes,...source}=v661Source();")
staged_loop = " for(const [file,hash] of Object.entries(admission.runtimeHashes))\n  assert.equal(sha(file),hash,'STAGED_LANDING_RUNTIME_DRIFT:'+file);\n"
staged_coverage = " for(const file of Object.keys(read(R4_ADMISSION).runtimeHashes))\n  assert(Object.hasOwn(admission.runtimeHashes,file),'STAGED_LANDING_RUNTIME_MISSING:'+file);\n"
replace(staged_loop, '')
replace(staged_coverage, '')
replace(' const admission=read(admissionPath),record=read(STAGED_LANDING_RECORD),save=read(record.savePath);', ' const admission=read(admissionPath);')
replace(' assert.equal(admission.scenario,STAGED_LANDING_ID);', ' assert.equal(admission.scenario,STAGED_LANDING_ID);\n' + staged_loop + staged_coverage +
 ' const record=read(STAGED_LANDING_RECORD),save=read(record.savePath);')
file.write_text(source)

inventory = snapshot / 'tools/node-test-inventory.js'
text = inventory.read_text()
marker = '    entry("tools/research-human405-full.test.js",'
assert text.count(marker) == 1
entry = '    entry("' + test + '", "training/reporting", "冻结续局先核对当前源码再读取历史载荷；匹配源码仍校验记录存档痕迹与开局前缀", "旧存档缺失掩盖源码漂移、部分源码匹配误接旧前缀或跳过档案校验"),\n'
inventory.write_text(text.replace(marker, entry + marker))
p = snapshot / doc
text = p.read_text()
assert text.count('## 环境 API') == 1
paragraph = ('## 冻结教学续局\n\n'
 '固定版本续局先读取小型源码准入证明，核对当前运行时的完整哈希集合，再读取历史记录、存档、痕迹和检查点。'
 '源码不匹配时直接报告对应的源码漂移错误；历史载荷缺失或损坏不能遮蔽这个拒绝原因。分阶段续局不能只凭一个模块匹配就读取旧盘面。'
 '源码匹配后，记录、存档、痕迹、原始开局前缀与已有准入条件仍须逐项校验；本顺序不放宽任何续局准入条件。\n\n')
p.write_text(text.replace('## 环境 API', paragraph + '## 环境 API'))

metadata = ['reports/ai-foundation-20261023/human405-v123-completion-runtime-source-check-20261031-v1.json',
 'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json',
 'reports/ai-foundation-20261110/v661-r4-amiba1-v1/r4-resume-admission-20261110-v1.json',
 'reports/fixed-boards/free-analyze-random20-20261104-v1.json']
metadata += ['reports/ai-foundation-20261113/prepass-funded-landing/r4-staged-landing-admission-20261113-' + version + '.json' for version in ['v1', 'v2', 'v3']]
for name in metadata:
    data = git('show', head + ':' + name)
    target = snapshot / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    value = json.loads(data)
    for key in ['runtimeHashes', 'runtimeSourceHashes']:
        for required in value.get(key, {}):
            target = snapshot / required
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(git('show', head + ':' + required))
record['ownedPaths'] = ['tools/research-human405-full.js', test, 'tools/node-test-inventory.js', doc]
for name in ['tools/research-human405-full.js', test, 'tools/node-test-inventory.js']:
    subprocess.run(['node', '--check', str(snapshot / name)], check=True)
for name, command in [
    ('after', ['node', 'tools/run_node_tests.js', '--match', test]),
    ('existing', ['node', 'tools/run_node_tests.js', '--match', 'tools/research-human405-full.test.js', '--match', 'tools/research-human405-r4.test.js']),
]:
    result = subprocess.run(command, cwd=snapshot, capture_output=True, text=True, timeout=50)
    record['checks'][name] = {'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
    save()
record['ownedHashes'] = {name: hashlib.sha256((snapshot / name).read_bytes()).hexdigest() for name in record['ownedPaths']}
record['passed'] = all(record['checks'][name]['exitCode'] == 0 for name in ['after', 'existing'])
save()
print(json.dumps({'snapshot': str(snapshot), 'beforeFailedForMissingArchive': True, 'passed': record['passed'],
                  'after': record['checks']['after'], 'existing': record['checks']['existing']}, ensure_ascii=False))
