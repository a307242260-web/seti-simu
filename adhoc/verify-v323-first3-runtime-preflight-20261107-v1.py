from pathlib import Path
import hashlib,json,os,subprocess
root=Path.cwd()
assert root==Path('/private/tmp/seti-v323-autonomous-first3-20261107-v1')
receipt=Path('/private/tmp/seti-v323-source-admission-delivery-20261107-v1.json')
j=json.loads(receipt.read_text())
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();assert j['commit']==head
g=subprocess.check_output(['git','ls-tree','-rz',head,'--','randomizer','tools','assets'])
count=0
for row in g.split(b'\0'):
 if not row:continue
 m,n=row.split(b'\t',1);mode,_,expected=m.split();p=root/n.decode()
 b=os.readlink(p).encode() if mode==b'120000' else p.read_bytes()
 oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest().encode()
 assert oid==expected,n
 count+=1
assert count==978
d=root/'reports/ai-foundation-20261107/committed-computer-recovery-v323-v1'
p=d/'autonomous-first3-runtime-preflight-20261107-v1.json'
assert not p.exists()
r={'sourceCommit':head,'scope':'Every physical rule, policy, asset and tool in the isolated experiment matches the admitted committed tree. No AI calls.', 'runtimeAssetToolFiles':count,'sourceAdmission':j['sourceAdmission'],'sourceAdmissionSha256':j['sourceAdmissionSha256'],'mode':'human405-white-first3-v1','openingInputs':23,'newAutonomousRuns':0}
p.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r))
