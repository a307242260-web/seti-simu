from pathlib import Path
import hashlib,json,os,subprocess,sys

stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu')
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
mp=Path('reports/ai-foundation-20261106/candidate-v263-research-order-mark-v1/manifest.json')
m=json.loads((stage/mp).read_text());base=m['baseCommit'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
overlayPath=mp.parent/'validation-overlay-20261106-v1.json';overlay=json.loads((stage/overlayPath).read_text()) if '--post-validation' in sys.argv else None
expected=dict(m['sourceHashes'])
if overlay:
 assert overlay['sourceManifest']==str(mp) and overlay['sourceManifestSha256']==sha(stage/mp) and overlay['runtimeChanged'] is False
 for n,h in overlay['validationSourceHashes'].items():
  assert n=='tools/browser-smoke-inventory.js' and overlay['originalSourceHashes'][n]==m['baseRuntimeHashes'][n]
  expected[n]=h
out=stage/F/('v263-isolated-source-tree-post-validation-20261106-v1.json' if '--post-validation' in sys.argv else 'v263-isolated-source-tree-20261106-v1.json');assert not out.exists()
assert stage!=repo and(stage/'.git').is_file()
index=Path('/private/tmp/seti-v263-source-admission-20261106-v1.index')
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
for name,digest in m['baseRuntimeHashes'].items():assert sha(stage/name)==expected.get(name,digest),name
for name,digest in expected.items():assert sha(stage/name)==digest,name
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args):return subprocess.check_output(['git','--git-dir='+str(repo/'.git'),'--work-tree='+str(stage),*args],env=env)
paths=sorted(expected)
if not index.exists():git('read-tree',base)
git('add','--',*paths)
tree=git('write-tree').decode().strip()
changed=git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0');assert set(changed)<=set(paths)
# read-tree leaves empty stat records for unchanged files. Compare actual Git
# blob bytes rather than treating diff-files' stat-only entries as source edits.
verified=0
for entry in git('ls-tree','-r','-z',tree,'--','randomizer','tools','assets').split(b'\0'):
 if not entry:continue
 header,name=entry.split(b'\t',1);mode,kind,digest=header.split();assert kind==b'blob'
 file=stage/name.decode();data=os.readlink(file).encode()if mode==b'120000'else file.read_bytes()
 actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest().encode();assert actual==digest,name.decode()
 if mode!=b'120000':assert bool(file.stat().st_mode&0o111)==(mode==b'100755'),name.decode()
 verified+=1
extra=[p for p in git('ls-files','--others','--exclude-standard','-z','--','randomizer','tools','assets').decode().split('\0')if p];assert not extra,extra
for name,digest in expected.items():assert hashlib.sha256(git('cat-file','blob',tree+':'+name)).hexdigest()==digest,name
assert sha(repo/'.git/index')==shared
r={'status':'source-tree-verified-not-yet-admitted','baseCommit':base,'snapshotTree':tree,'physicalIndependentWorktree':str(stage),'privateIndex':str(index),'sharedIndexSha256':shared,'sharedIndexPreserved':True,'productionBranchUnchanged':True,'frozenSourceManifest':str(mp),'frozenSourceManifestSha256':sha(stage/mp),'ownedSourceHashes':expected,'frozenSourceHashes':m['sourceHashes'],'validationOverlay':str(overlayPath) if overlay else None,'validationOverlaySha256':sha(stage/overlayPath) if overlay else None,'runtimeUnchangedFromFrozenCandidate':True,'changedPaths':changed,'runtimeAssetToolsExactToStagedTree':True,'runtimeAssetPathsVerified':verified,'noUnstagedOrUntrackedRuntimeInputs':True,'scope':'The existing isolated worktree is independently proven byte-identical to a private-index tree made from committed02701e180 plus the frozen owned source/test inputs and the explicitly declared validation-only Browser test overlay. Production runtime bytes remain frozen. All other randomizer/tools/assets files match that tree by actual Git blob content and executable modes, independently of unrefreshed index stat records. Functional validation runs in this physical independent tree; no shared-root edits or index refresh are used. This is a source snapshot proof, not completed source admission or a new autonomous game.'}
out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(stage)),'tree':tree,'owned':len(paths),'changed':len(changed),'physicalSnapshotExact':True,'sharedIndexPreserved':True}))
