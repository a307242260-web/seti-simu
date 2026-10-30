import gzip,hashlib,json,os,pathlib,subprocess
root=pathlib.Path("/Users/bilibili/code/seti-simu");stage=pathlib.Path("/private/tmp/seti-human405-v119-staged-20261031-wlp1z0ck");index="/private/tmp/seti-human405-v121-admission-index-b45o4pgw/index"
def git(*args,env=None):return subprocess.check_output(["git",*args],cwd=root,env=dict(os.environ,GIT_OPTIONAL_LOCKS="0",**(env or {})))
def tree(commit):
 out={}
 for row in git("ls-tree","-r","-z",commit).split(b"\0"):
  if row:head,name=row.split(b"\t",1);out[name.decode()]=head.decode().split()[2]
 return out
def blob(data):return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def remove_copy(directory,expected,partial=False):
 assert directory not in [root,stage] and directory.parent==pathlib.Path("/private/tmp") and directory.is_dir()
 total=0;rows=[];partials=[]
 for parent,dirs,names in os.walk(directory):
  assert not any((pathlib.Path(parent)/d).is_symlink() for d in dirs)
  for name in names:
   p=pathlib.Path(parent)/name;assert p.is_file() and not p.is_symlink();rel=str(p.relative_to(directory));assert rel in expected,rel
   size=p.stat().st_size;h=hashlib.sha1(b"blob "+str(size).encode()+b"\0")
   with p.open("rb") as f:
    for data in iter(lambda:f.read(1024*1024),b""):h.update(data)
   actual=h.hexdigest()
   if actual!=expected[rel]:
    assert partial,rel;original=git("cat-file","blob",expected[rel]);data=p.read_bytes();assert len(data)<len(original) and original.startswith(data),rel;partials.append(rel)
   p.unlink();total+=size;rows.append(rel+" "+actual)
 assert len(partials)<=1
 for parent,dirs,names in os.walk(directory,topdown=False):pathlib.Path(parent).rmdir()
 return {"directory":str(directory),"filesVerified":len(rows),"bytesRemoved":total,"fileListSha256":hashlib.sha256("\n".join(sorted(rows)).encode()).hexdigest(),"partialArchiveWrites":partials,"uniqueUntrackedFilesRemoved":0}
assert hashlib.sha256((root/".git/index").read_bytes()).hexdigest()=="fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49"
expected={}
for row in git("ls-files","--stage","-z",env={"GIT_INDEX_FILE":index}).split(b"\0"):
 if row:head,name=row.split(b"\t",1);expected[name.decode()]=head.decode().split()[1]
results=[remove_copy(pathlib.Path("/private/tmp/seti-human405-v121-staged-20261031-dpemknb0"),expected,True)];print(json.dumps(results[-1]),flush=True)
report_path="reports/ai-foundation-20261023/human405-v103-mission-preflight-20261031-v1.json";report=json.loads((root/report_path).read_text());archive=json.loads(gzip.decompress((root/report["codeArchive"]).read_bytes()));expected=tree(archive["baseCommit"])
for p,data in archive["files"].items():assert hashlib.sha256(data.encode()).hexdigest()==archive["fileHashes"][p];expected[p]=blob(data.encode())
paths=set(report["sourceBoundReports"])|{report_path,report["codeArchive"],report["teacherAudit"],report["compatAudit"]}
for p in report["sourceBoundReports"]:
 r=json.loads((root/p).read_text())
 if r.get("rawPath"):paths.add(r["rawPath"])
paths.update(v["path"] for v in report["validation"]["logs"].values())
paths.update(["adhoc/audit-human405-mission-cold-case-20261031-v1.js","adhoc/audit-human405-mission-compat-20261031-v1.js","adhoc/checkpoint-human405-mission-preflight-20261031-v1.py","adhoc/restore-human405-mission-preflight-20261031-v1.py","adhoc/verify-human405-v103-blue2-future-landing-20261031-v1.js","docs/human405-round1-v103-mission-preflight-20261031.md","adhoc/human405-round1-progress-20261031-v28.json"])
committed=tree("5d250c4b8d8a1254f8aece9ac8fe856eb6c74093")
for p in paths:expected[p]=committed[p]
results.append(remove_copy(pathlib.Path("/private/tmp/seti-human405-v103-restored-ly2j6pry"),expected));print(json.dumps(results[-1]),flush=True)
output=stage/"reports/ai-foundation-20261023/human405-verified-temporary-cleanup-20261031-v1.json";output.write_text(json.dumps({"scope":"Only task-generated copies; every removed file matches committed/archive bytes, except one incomplete archive prefix. Current working snapshot and originals preserved.","results":results,"sharedIndexUnchanged":hashlib.sha256((root/".git/index").read_bytes()).hexdigest()=="fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49"},indent=2)+"\n")
