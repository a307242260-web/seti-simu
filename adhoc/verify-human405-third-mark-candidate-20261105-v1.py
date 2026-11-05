"""Rebuild the frozen V193 overlay on committed production, then verify changed behavior."""
from pathlib import Path
import hashlib
import io
import json
import subprocess
import tarfile
import tempfile

stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu')
folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
manifest_path=Path('reports/ai-foundation-20261105/candidate-v193-research-mark-20261105-v1/manifest.json')
manifest=json.loads((stage/manifest_path).read_text());output=stage/folder/'v193-independent-candidate-verification-20261105-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if output.exists():
    saved=json.loads(output.read_text());assert saved['manifestSha256']==sha(stage/manifest_path)
    for name,digest in saved['logsSha256'].items():assert sha(stage/name)==digest
    print(json.dumps({'reused':True,'output':str(output.relative_to(stage))}));raise SystemExit(0)
fixtures=[
    str(folder/'teacher-before-input-127-20261105-v1.checkpoint.json'),
    str(folder/'teacher-r3-before-safety-protocol-root-20261105-v1.json'),
    'seti-saves/seti-save-537-merged.json',
    'adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-024-20261030-v1.json',
    'adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-035-20261030-v1.json',
    'reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-first-launch-timing-native-20261104-v1.json',
    'reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step35-20261031-v1.json',
    'reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step36-20261031-v1.json',
    'reports/ai-foundation-20261023/human405-v99-native-witness-comparison-step36-20261031-v1.raw.json.gz',
    'reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-025-20261104-v1.json',
]
snapshot=Path(tempfile.mkdtemp(prefix='seti-v193-clean-candidate-'))
archive=subprocess.check_output(['git','archive','--format=tar',manifest['baseCommit'],'randomizer','assets/cards/card_model.json',*fixtures],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as stream:
    for member in stream.getmembers():
        assert not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
        assert member.isfile() or member.isdir(),member.name
    stream.extractall(snapshot)
for name,digest in manifest['sourceHashes'].items():
    source=stage/manifest_path.parent/name;assert sha(source)==digest
    target=snapshot/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read_bytes())
    if name.endswith('.js'):subprocess.run(['node','--check',name],cwd=snapshot,check=True)
for name,digest in manifest['baseRuntimeHashes'].items():assert sha(snapshot/name)==manifest['sourceHashes'].get(name,digest),name
for name in fixtures+['assets/cards/card_model.json']:assert sha(snapshot/name)==sha(stage/name),name
logs={}
for label in ['research-mark-capital','computer-prefix-plan','winning-income-plan','probe-capital-value']:
    log=folder/f'v193-independent-{label}-20261105-v1.log';assert not(stage/log).exists()
    result=subprocess.run(['node',f'randomizer/game/ai/{label}.test.js'],cwd=snapshot,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=55)
    (stage/log).write_bytes(result.stdout);assert result.returncode==0,result.stdout.decode();logs[str(log)]=sha(stage/log)
result={'status':'passed','candidateAdmitted':False,'baseCommit':manifest['baseCommit'],'manifest':str(manifest_path),'manifestSha256':sha(stage/manifest_path),'snapshot':str(snapshot),'allBaseRuntimeAndOverlayHashesMatched':True,'fixtureHashes':{name:sha(snapshot/name)for name in fixtures+['assets/cards/card_model.json']},'productionChanged':False,'newAutonomousRuns':0,'logsSha256':logs,'scope':'Four changed behavior tests on exact clean base plus archived overlay, not full source admission.'}
output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':str(output.relative_to(stage)),'status':'passed','productionChanged':False}))
