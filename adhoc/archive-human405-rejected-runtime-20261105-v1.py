import pathlib,subprocess,json,hashlib,sys
stage=pathlib.Path.cwd();root=pathlib.Path('/Users/bilibili/code/seti-simu');version=int(sys.argv[1]);reason=sys.argv[2];base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip();sha=lambda b:hashlib.sha256(b).hexdigest()
case=f'reports/ai-foundation-20261104/two-rounds-teacher-v2/v{version}-cold-serial-case-105-20261105-v1.json';r=json.loads((stage/case).read_text());assert r['searchVersion'].endswith('v'+str(version));directory=stage/f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261105-v1';directory.mkdir(exist_ok=False);overlays={}
for p,h in r['sourceHashes'].items():
 b=(stage/p).read_bytes();assert sha(b)==h,p
 if subprocess.check_output(['git','show',base+':'+p],cwd=root)==b:continue
 dest=directory/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);overlays[p]=h
for p in ['randomizer/index.html','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','randomizer/game/ai/mission-data-continuation.test.js']:
 b=(stage/p).read_bytes();dest=directory/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);overlays[p]=sha(b)
(directory/'manifest.json').write_text(json.dumps({'baseCommit':base,'searchVersion':r['searchVersion'],'valueModel':r['valueModel'],'case':case,'caseSha256':sha((stage/case).read_bytes()),'nativeInputs':r['nativeInputs'],'milliseconds':r['milliseconds'],'allLoadedRuntimeHashes':r['sourceHashes'],'overlayFiles':overlays,'admitted':False,'officialRuns':0,'reason':reason,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');print(json.dumps({'archive':str(directory.relative_to(stage)),'overlays':len(overlays)}))
