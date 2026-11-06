from pathlib import Path
import hashlib,os,json,subprocess
P=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');receipt=json.loads(Path('/private/tmp/seti-v274-source-delivery-20261106-v1.json').read_text());commit=receipt['commit'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb';entries=subprocess.check_output(['git','--no-optional-locks','ls-tree','-rz',commit],cwd=P);count=0;size=0
for row in entries.split(b'\0'):
 if not row:continue
 meta,n=row.split(b'\t',1);mode,kind,digest=meta.split();assert kind==b'blob';p=P/n.decode();b=os.readlink(p).encode()if mode==b'120000'else p.read_bytes();actual=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest().encode();assert actual==digest,n.decode();count+=1;size+=len(b)
assert sha(repo/'.git/index')==shared
out=Path('/private/tmp/seti-v274-full-run-worktree-audit-20261106-v1.json');assert not out.exists();out.write_text(json.dumps({'sourceCommit':commit,'worktree':str(P),'allTrackedFilesExact':True,'files':count,'bytes':size,'sharedIndexUnchanged':True,'sharedIndexSha256':shared,'newAutonomousRuns':0},indent=2)+'\n');print(out.read_text())
