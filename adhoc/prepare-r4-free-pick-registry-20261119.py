"""Merge only the verified new record; keep unrelated working catalog edits."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'reports/ai-foundation-20261119'
runtime = Path(json.loads(Path('/private/tmp/seti-r4-free-pick-runtime-20261119.json').read_text())['runtime'])
VERSION = 'teacher-r4-free-blind-control-20261119'
paths = ['reports/iteration/versions.json', 'reports/iteration/registry.json', 'reports/robot-iteration.html']
parent = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
sha = lambda b: hashlib.sha256(b).hexdigest()
before = {p:(ROOT/p).read_bytes() for p in paths}
entry = copy.deepcopy(next(v for v in json.loads((runtime/paths[0]).read_text())['versions'] if v['id']==VERSION))
entry.update(name='免费选牌对照：276分（单步干预）',baseline='teacher-r4-same-start-20261119',baselineEligible=False,summary='同一前286输入，仅第287步免费选择改为盲抽，实际获得虫6；之后原v486执行，终局276对267（+9），后续63输入3.048秒，最大41次模拟/78.09ms。非自主整局，不代表盲抽普遍更优。')
row = copy.deepcopy(next(v for v in json.loads((runtime/paths[1]).read_text())['versions'] if v['id']==VERSION))
row.update({k:entry[k] for k in ['name','baseline','baselineEligible','summary']})
row.update(isHead=False,diffStat=None,diffFiles=[])
assert row['aiGeneration']=='v2' and row['results'][0]['scores']['player-white']==276
assert all(row['completeness'][k] for k in ['record','save','report'])
assert (ROOT/'tools/robot-iteration-lib.js').read_bytes()==(runtime/'tools/robot-iteration-lib.js').read_bytes()
base=Path(tempfile.mkdtemp(prefix='seti-r4-free-pick-registry-targeted-',dir='/private/tmp'))
result={'parent':parent,'version':VERSION,'beforeWorkingHashes':{p:sha(b) for p,b in before.items()},'sharedIndexSha256':sha((ROOT/'.git/index').read_bytes()),'builds':{},'mode':'new-entry-only; no historical registry/Git rebuild'}
for kind in ['head','working']:
 source={p:subprocess.check_output(['git','show',parent+':'+p],cwd=ROOT) for p in paths} if kind=='head' else before
 catalog=json.loads(source[paths[0]]);registry=json.loads(source[paths[1]])
 assert any(v['id']==entry['baseline'] for v in catalog['versions'])
 assert not any(v['id']==VERSION for v in catalog['versions'])
 assert not any(v['id']==VERSION for v in registry['versions'])
 old_catalog=copy.deepcopy(catalog['versions']);old_rows=copy.deepcopy(registry['versions']);old_v1=copy.deepcopy(registry['generations']['v1'])
 catalog['versions'].insert(0,copy.deepcopy(entry));registry['versions'].insert(0,copy.deepcopy(row))
 best_code="const fs=require('fs'),lib=require('./tools/robot-iteration-lib'),r=JSON.parse(fs.readFileSync(0,'utf8'));const v=r.versions.filter(x=>x.aiGeneration==='v2');const m=Object.fromEntries(v.map(x=>[x.id,x.results]));process.stdout.write(JSON.stringify(lib.computeBestOf(v,m)));"
 computed=subprocess.run(['node','-e',best_code],cwd=runtime,input=json.dumps(registry),capture_output=True,text=True,timeout=20)
 assert computed.returncode==0,computed.stderr
 best=json.loads(computed.stdout);registry['generations']['v2']['bestOf']=best;registry['bestOf']=best
 registry['generations']['v2']['versionCount']+=1;registry['generations']['v2']['recordCount']+=1
 registry['builtAt']=datetime.now(timezone.utc).isoformat();registry['headCommit']=parent[:9]
 registry['orphans']=[x for x in registry['orphans'] if (x if isinstance(x,str) else x.get('recordFile'))!='91b4e074.b6e4c628.full.json']
 assert catalog['versions'][1:]==old_catalog and registry['versions'][1:]==old_rows
 assert registry['generations']['v1']==old_v1
 html=source[paths[2]].decode();start=html.index('const ALL_REGISTRY = ')+len('const ALL_REGISTRY = ');_,count=json.JSONDecoder().raw_decode(html[start:])
 encoded=json.dumps(registry,ensure_ascii=False,indent=2).replace('<','\\u003c');updated=html[:start]+encoded+html[start+count:]
 assert updated[:start]==html[:start] and updated[start+len(encoded):]==html[start+count:]
 build=base/kind
 outputs={paths[0]:(json.dumps(catalog,ensure_ascii=(kind=='head'),indent=2)+'\n').encode(),paths[1]:(json.dumps(registry,ensure_ascii=(kind=='head'),indent=2)+'\n').encode(),paths[2]:updated.encode()}
 for p,content in outputs.items():(build/p).parent.mkdir(parents=True,exist_ok=True);(build/p).write_bytes(content)
 result['builds'][kind]={'directory':str(build),'paths':{p:sha(content) for p,content in outputs.items()},'priorCatalogEntriesPreserved':True,'priorRegistryRowsPreserved':True,'HTMLTemplatePreserved':True,'v1Unchanged':True}
for p,content in before.items():assert (ROOT/p).read_bytes()==content,p
assert sha((ROOT/'.git/index').read_bytes())==result['sharedIndexSha256']
output=Path('/private/tmp/seti-r4-free-pick-registry-20261119-prepared.json');assert not output.exists();output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
