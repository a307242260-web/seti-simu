"""Restore the archived, unadmitted candidate in an isolated temporary directory."""
import gzip,hashlib,json,pathlib,shutil,subprocess,tarfile,tempfile
source=pathlib.Path(__file__).resolve().parents[1]
git_root=pathlib.Path('/Users/bilibili/code/seti-simu')
report_path='reports/ai-foundation-20261023/human405-v103-mission-preflight-20261031-v1.json'
report=json.loads((source/report_path).read_text())
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert sha(source/report['codeArchive'])==report['codeArchiveSha256']
snapshot=json.loads(gzip.decompress((source/report['codeArchive']).read_bytes()))
assert snapshot['baseCommit']==report['baseCommit'] and snapshot['candidateAdmitted'] is False
out=pathlib.Path(tempfile.mkdtemp(prefix='seti-human405-v103-restored-',dir='/private/tmp'))
process=subprocess.Popen(['git','archive',snapshot['baseCommit']],cwd=git_root,stdout=subprocess.PIPE)
with tarfile.open(fileobj=process.stdout,mode='r|') as archive:
 for member in archive:
  destination=out/member.name;assert destination.resolve().is_relative_to(out)
  if member.isdir():destination.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   destination.parent.mkdir(parents=True,exist_ok=True)
   with destination.open('wb') as handle:shutil.copyfileobj(archive.extractfile(member),handle)
   destination.chmod(member.mode)
  elif member.issym():
   assert (destination.parent/member.linkname).resolve().is_relative_to(out)
   destination.parent.mkdir(parents=True,exist_ok=True);destination.symlink_to(member.linkname)
  else:raise ValueError('Unsupported archive entry: '+member.name)
assert process.wait()==0
for p,data in snapshot['files'].items():
 destination=out/p;assert destination.resolve().is_relative_to(out)
 assert hashlib.sha256(data.encode()).hexdigest()==snapshot['fileHashes'][p]
 destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(data)
paths=set(report['sourceBoundReports'])|{report_path,report['codeArchive'],report['teacherAudit'],report['compatAudit']}
for p in report['sourceBoundReports']:
 r=json.loads((source/p).read_text())
 if r.get('rawPath'):paths.add(r['rawPath'])
 for name,h in r['sourceHashes'].items():assert sha(out/name)==h,(p,name)
paths.update(v['path'] for v in report['validation']['logs'].values())
paths.update(['adhoc/audit-human405-mission-cold-case-20261031-v1.js','adhoc/audit-human405-mission-compat-20261031-v1.js',
 'adhoc/checkpoint-human405-mission-preflight-20261031-v1.py','adhoc/restore-human405-mission-preflight-20261031-v1.py',
 'adhoc/verify-human405-v103-blue2-future-landing-20261031-v1.js','docs/human405-round1-v103-mission-preflight-20261031.md',
 'adhoc/human405-round1-progress-20261031-v28.json'])
for p in paths:
 assert (out/p).resolve().is_relative_to(out)
 (out/p).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/p,out/p)
# Reuse one saved cold checkpoint with the restored production imports; this
# validates replay setup without issuing another search or autonomous game.
result=subprocess.run(['node','adhoc/audit-human405-mission-cold-case-20261031-v1.js','case-001',
 'adhoc/ai-decision-corpus-20261023-v1/case-001-20261023-v1.json'],cwd=out,check=True,capture_output=True,text=True)
assert json.loads(result.stdout)['reused'] is True
print(json.dumps({'restored':str(out),'baseCommit':snapshot['baseCommit'],'candidateAdmitted':False,
 'overlayFiles':len(snapshot['files']),'sourceBoundReportsVerified':len(report['sourceBoundReports']),
 'copiedCheckpointFiles':len(paths),'existingCheckpointReused':True,'newSearches':0}))
