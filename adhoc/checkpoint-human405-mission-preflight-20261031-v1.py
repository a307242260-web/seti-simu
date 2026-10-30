"""Archive the unadmitted mission-value candidate without activating it in production."""
import gzip, hashlib, json, pathlib, subprocess, tarfile
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path(__file__).resolve().parents[1]
base='1cd44bde189c9ce26f976bc4c9dd08391ecbde86'
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
folder=stage/'reports/ai-foundation-20261023'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==base
files={};process=subprocess.Popen(['git','archive',base],cwd=root,stdout=subprocess.PIPE)
with tarfile.open(fileobj=process.stdout,mode='r|') as archive:
 for member in archive:
  if member.isfile():
   old=archive.extractfile(member).read();new=(stage/member.name).read_bytes()
   if old!=new:files[member.name]=new.decode()
assert process.wait()==0
for p in ['randomizer/game/ai/probe-capital.js','randomizer/game/ai/probe-capital-value.test.js']:files[p]=(stage/p).read_text()
assert len(files)==18,sorted(files)
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True,capture_output=True)
archive_path='adhoc/human405-v103-unadmitted-code-20261031-v1.json.gz'
assert not (stage/archive_path).exists(),'Reuse existing candidate archive'
snapshot={'schemaVersion':'seti-unadmitted-source-overlay-v1','baseCommit':base,'searchVersion':'v103','valueModel':'v5','candidateAdmitted':False,
 'files':files,'fileHashes':{p:sha(stage/p) for p in files},'activation':'None. Production runtime and baseline registry are unchanged.'}
(stage/archive_path).write_bytes(gzip.compress((json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n').encode(),mtime=0))
archive_sha=sha(stage/archive_path)
teacher_path='reports/ai-foundation-20261023/human405-round1-v103-audit-20261030-v1.json';teacher=json.loads((stage/teacher_path).read_text())
compat_path='reports/ai-foundation-20261023/human405-v103-compat-cold-20261031-v1.json';compat=json.loads((stage/compat_path).read_text())
assert teacher['status']==compat['status']=='complete'
rows=[{'label':'teacher-'+str(r['step']),'nativeInputs':r['evidenceNativeInputs'],'milliseconds':r['milliseconds'],'evidencePath':r['evidencePath'],'complete':r['graphClosed']} for r in teacher['rows']]+compat['rows']
assert len(rows)==45 and all(r['complete'] for r in rows)
source_reports=[r['evidencePath'] for r in rows]+['reports/ai-foundation-20261023/human405-v103-blue2-native-future-landing-20261031-v1.json']
for p in source_reports:
 r=json.loads((stage/p).read_text())
 for source,h in r['sourceHashes'].items():assert sha(stage/source)==h,(p,source)
 if r.get('rawPath'):assert sha(stage/r['rawPath'])==r['rawSha256'],p
logs={
 'fullNode':'human405-v103-full-node-20261031-v1.log',
 'chromeFunctional':'human405-v103-chrome-functional-20261031-v2.log',
 'chromeHotpathFailure':'human405-v103-chrome-20261031-v2.log',
 'valueInputAudit':'human405-v103-value-input-audit-20261031-v3.log'}
full=(folder/logs['fullNode']).read_text();assert 'SUMMARY unit passed=152 failed=0 total=152' in full;assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
chrome=(folder/logs['chromeFunctional']).read_text();assert len([l for l in chrome.splitlines() if l.startswith('PASS ')])==6;assert 'Error:' not in chrome
failures=[l for l in (folder/logs['valueInputAudit']).read_text().splitlines() if '[FAIL]' in l];assert len(failures)==1 and 'aomomo' in failures[0]
distributions=[]
for label in ['teacher-39','case-105','case-152']:
 row=next(r for r in rows if r['label']==label);r=json.loads((stage/row['evidencePath']).read_text());raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()))
 counts={};details={}
 for edge in raw['sharedPrefixGraph']['edges']:
  family=edge['actionId'].split(':')[0];counts[family]=counts.get(family,0)+1
  action=raw.get('diagnosticActions',{}).get(edge['actionId'])
  if action:
   target=action.get('target',{});kind=target.get('kind') or target.get('target') or (target.get('choiceId') or '').split(':')[0] or family
   key=family+':'+kind;details[key]=details.get(key,0)+1
 assert sum(counts.values())==row['nativeInputs'],(label,counts,row)
 distributions.append({**row,'allNativeInputFamilies':counts,'nativeTargetDetails':details,'logicalPreparationInputs':raw['diagnostics']['logicalResourceInputs'],
  'sharedPreparationHits':raw['diagnostics']['sharedResourceInputHits'],'typedTailProofs':raw['diagnostics']['turnTailProofs'],
  'note':'Family counts cover every actual native input once. Target details are available only where action descriptors were captured. Logical preparation totals may overlap shared prefixes.'})
overruns=[r for r in rows if r['nativeInputs']>256 or r['milliseconds']>600]
report={'schemaVersion':'seti-human405-mission-preflight-v1','goalStatus':'active','baseCommit':base,'candidateSearch':'v103','candidateValue':'v5',
 'candidateAdmitted':False,'productionSearch':'v99','productionValue':'v4','baselineUnchanged':'ai-search-v41-baseline-20261029',
 'codeArchive':archive_path,'codeArchiveSha256':archive_sha,'codeFileHashes':snapshot['fileHashes'],
 'sourceBoundReports':source_reports,'sourceBinding':'Reconstruct baseCommit plus the UTF8 files in codeArchive. These reports describe that isolated candidate, not current production code.',
 'teacherAudit':teacher_path,'compatAudit':compat_path,'coldRoots':45,'allComplete':True,'gatePassed':not overruns,'overruns':overruns,
 'maxNativeInputs':max(r['nativeInputs'] for r in rows),'maxMilliseconds':max(r['milliseconds'] for r in rows),
 'teacherFirstInputMatches':teacher['categoryCounts'].get('same-first-input',0),'teacherCategoryCounts':teacher['categoryCounts'],
 'nativeContinuity':{'orbitBeforeWithForecast':57.5,'orbitAfterConsumedProbe':57.5,'orbitNativeInputs':4,'landingBeforeWithForecast':62,'landingAfterConsumedProbe':62,'landingNativeInputs':3,'separateBlueFollowup':62.5},
 'coldRecovery':{'oldIncomeOnlyValue':59,'oldRecoveredValue':60.5,'correctedRootValue':60.5,'correctedRecoveredValue':60.5,'currentSourceRegression':'randomizer/game/ai/income-plan-value.test.js in codeArchive'},
 'validation':{'fullNodeUnitPassed':152,'fullFlowPassed':1,'chromeFunctionalPassed':6,'chromeHotpathPassed':False,
   'valueInputAudit':'Independent current paths pass; sole pre-existing frozen aomomo failure remains, exit1.',
   'javascriptSyntaxFiles':len([p for p in files if p.endswith('.js')]),'logs':{k:{'path':str((folder/v).relative_to(stage)),'sha256':sha(folder/v)} for k,v in logs.items()}},
 'inputDistributions':distributions,'autonomousRun':False,
 'pending':['Reduce teacher39 338 actual native inputs and legacy105 283/737.790ms without truncation or unproved upper bounds.',
   'Review final-round priority change and case152 240/609.906ms, preserving the zero late-round mission forecast.',
   'Current own-probe income/numeric shortcuts decline; plain quiet end-turn is revalidated with unchanged public mission facts. Revalidate each recovered proof natively.',
   'All45 gates and the unchanged256-input Chrome hotpath must pass before one standard autonomous white-only R1, then compare endpoint strategy and value against the teacher.']}
out='reports/ai-foundation-20261023/human405-v103-mission-preflight-20261031-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'report':out,'archive':archive_path,'files':len(files),'matches':report['teacherFirstInputMatches'],'overruns':overruns,'fullNode':152,'chromeFunctional':6,'candidateAdmitted':False},ensure_ascii=False))
