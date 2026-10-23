"""Package validated center isolation and unchanged historical V2 game artifacts; no AI rerun."""
import gzip,hashlib,json,pathlib,subprocess
stage=pathlib.Path.cwd();root=pathlib.Path('/Users/bilibili/code/seti-simu');manifest_path='adhoc/ai-generation-centers-stage38-snapshot-20261023.json';manifest=json.loads((stage/manifest_path).read_text());base=manifest['baseCommit'];sha=lambda b:hashlib.sha256(b).hexdigest()
changed=['tools/robot-iteration-lib.js','tools/robot_iterate.js','tools/robot-ai-generation.test.js','tools/node-test-inventory.js','reports/iteration/page-template.html','reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html','docs/robot-iteration-registry.md','README.md']
node_path='reports/ai-foundation-20261023/generation-centers-node-v1.log';log=(stage/node_path).read_text();assert 'SUMMARY unit passed=132 failed=0 total=132' in log and 'SUMMARY fullFlow passed=1 failed=0 total=1' in log
unit_path='reports/ai-foundation-20261023/generation-centers-unit-v3.log';unit=json.loads((stage/unit_path).read_text().splitlines()[-1]);assert unit['aiGenerationIsolation']=='passed' and unit['v2CompleteGames']==9
browser_path='reports/ai-foundation-20261023/generation-centers-chrome-v2.json';browser=json.loads((stage/browser_path).read_text());assert browser['status']=='passed' and len(browser['rows'])==3;assert browser['pageSha256']==sha((stage/'reports/robot-iteration.html').read_bytes())
files=set(changed+[node_path,unit_path,browser_path,'reports/ai-foundation-20261023/generation-centers-build-v2.log','adhoc/implement-ai-generation-centers-20261023-v1.py','adhoc/verify-ai-generation-centers-chrome-20261023-v2.py','adhoc/finalize-ai-generation-centers-20261023-v1.py','adhoc/deliver-ai-generation-centers-20261023-v2.py'])
for row in browser['rows']:
 p=row['domPath'];data=(stage/p).read_bytes()
 if row.get('domEncoding')=='gzip':assert sha(gzip.decompress(data))==row['domSha256'] and sha(data)==row['domCompressedSha256'];files.update([p,row['screenshot']])
 else:
  assert sha(data)==row['domSha256'];packed=gzip.compress(data,mtime=0);(stage/(p+'.gz')).write_bytes(packed);row.update(domPath=p+'.gz',domEncoding='gzip',domCompressedSha256=sha(packed));files.update([p+'.gz',row['screenshot']])
(stage/browser_path).write_text(json.dumps(browser,indent=2)+'\n')
artifacts=manifest['existingV2Artifacts'];tracked=set(subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=root,text=True).splitlines())
for p,expected in artifacts.items():
 assert sha((stage/p).read_bytes())==expected and sha((root/p).read_bytes())==expected
 if p not in tracked:files.add(p)
 else:assert sha(subprocess.check_output(['git','show',base+':'+p],cwd=root))==expected
syntax=[]
for p in ['tools/robot-iteration-lib.js','tools/robot_iterate.js','tools/robot-ai-generation.test.js','tools/node-test-inventory.js']:
 result=subprocess.run(['node','--check',str(stage/p)],capture_output=True,text=True);assert result.returncode==0,result.stderr;syntax.append({'path':p,'sha256':sha((stage/p).read_bytes()),'exitCode':0})
reg=json.loads((stage/'reports/iteration/registry.json').read_text());report={'schemaVersion':'seti-ai-generation-centers-validation-v1','date':'2026-10-23','baseCommit':base,'scope':'V1 legacy and V2 new AI record ownership, baseline selection, independent score/time comparison and page switching. No new AI games run.',
 'defaultGeneration':reg['defaultGeneration'],'generations':{g:{k:d[k] for k in ['versionCount','recordCount','currentBaseline']} for g,d in reg['generations'].items()},'v2CompleteGames':9,'v2SearchCompleteGames':0,'v2FoundationArtifacts':artifacts,
 'node':{'unitPassed':132,'fullFlowPassed':1,'logPath':node_path},'unit':{'path':unit_path,**unit},'browser':{'path':browser_path,'queries':3,'actualChrome':True,'oppositeGenerationRows':0},'syntax':syntax,
 'deliveryResume':manifest['deliveryResume'],'historicalBodyAndGameBytesPreserved':True,'snapshotGeneratedFromCommittedVersions':True,'sharedRootGeneratedFilesWillIncludePreservedUncommittedVersions':True,'sourceHashes':{p:sha((stage/p).read_bytes()) for p in changed},
 'goalStillActive':'Search default decision coverage, new search full games and 180-second acceptance remain unproved. Stage37 attained-plan prototype is isolated and not part of this delivery.'}
p='reports/ai-foundation-20261023/generation-centers-validation-v1.json';(stage/p).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');files.add(p)
manifest.update(validationPath=p,files={p:sha((stage/p).read_bytes()) for p in sorted(files)},notes='Private-index snapshot; only 9 aiGeneration tags added to committed versions. Extra shared version and rebuilt root views remain local and untouched by staged snapshot.')
(stage/manifest_path).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'v2Games':9,'newSearchGames':0,'verified':True}))
