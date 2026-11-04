import pathlib,json,hashlib,subprocess,sys
stage=pathlib.Path.cwd();root=pathlib.Path('/Users/bilibili/code/seti-simu');version=int(sys.argv[1]);base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()
case=sys.argv[2]if len(sys.argv)>2 else f'reports/ai-foundation-20261023/human405-v{version}-cold-serial-case-105-20261104-v1.json'
e=json.loads((stage/case).read_text());assert e['searchVersion'].endswith('v'+str(version));assert not e['complete']or e['nativeInputs']>256 or e['milliseconds']>600
folder=stage/f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261104-v1';folder.mkdir(parents=True,exist_ok=False);sha=lambda b:hashlib.sha256(b).hexdigest();files={}
for p,h in e['sourceHashes'].items():
 b=(stage/p).read_bytes();assert sha(b)==h,p;old=subprocess.run(['git','show',base+':'+p],cwd=root,capture_output=True)
 if old.returncode==0 and old.stdout==b:continue
 dest=folder/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);files[p]=h
for p in ['randomizer/index.html','tools/node-test-inventory.js','randomizer/game/ai/research-income-capital.test.js','randomizer/game/ai/funded-research-value.test.js','randomizer/game/effects/session-runtime.test.js']:
 b=(stage/p).read_bytes();dest=folder/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);files[p]=sha(b)
(folder/'manifest.json').write_text(json.dumps({'baseCommit':base,'searchVersion':e['searchVersion'],'valueModel':e['valueModel'],'case':case,'caseSha256':sha((stage/case).read_bytes()),'nativeInputs':e['nativeInputs'],'milliseconds':e['milliseconds'],'admitted':False,'officialRuns':0,'allLoadedRuntimeHashes':e['sourceHashes'],'overlayFiles':files,'goalStatus':'active','goalAchieved':False},indent=2)+'\n')
print(json.dumps({'archive':str(folder.relative_to(stage)),'files':len(files),'nativeInputs':e['nativeInputs'],'milliseconds':e['milliseconds']}))
