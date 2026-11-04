"""Verify or materialize the unadmitted candidate; never modify the shared checkout."""
import argparse,hashlib,json,pathlib,subprocess,tarfile,os
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'reports/ai-foundation-20261104/candidate-v183-income-analysis-input-20261105-v1';manifest=json.loads((folder/'manifest.json').read_text());parser=argparse.ArgumentParser();parser.add_argument('--dest');parser.add_argument('--verify-only',action='store_true');args=parser.parse_args();git_dir=pathlib.Path(os.environ.get('GIT_DIR',str(root/'.git')));git_dir=git_dir if git_dir.exists() else pathlib.Path('/Users/bilibili/code/seti-simu/.git');git=['git','--git-dir='+str(git_dir)]
def sha(data):return hashlib.sha256(data).hexdigest()
for name,h in manifest['overlayFiles'].items():assert sha((folder/name).read_bytes())==h,name
for name,h in manifest['allLoadedRuntimeHashes'].items():
 data=(folder/name).read_bytes() if name in manifest['overlayFiles'] else subprocess.check_output(git+['show',manifest['baseCommit']+':'+name],cwd=root)
 assert sha(data)==h,name
if args.dest and not args.verify_only:
 dest=pathlib.Path(args.dest).resolve();assert not dest.exists(),'destination must not exist';dest.mkdir(parents=True)
 process=subprocess.Popen(git+['archive',manifest['baseCommit']],cwd=root,stdout=subprocess.PIPE)
 with tarfile.open(fileobj=process.stdout,mode='r|') as tar:
  for member in tar:
   name=pathlib.PurePosixPath(member.name)
   assert not name.is_absolute() and '..' not in name.parts and (member.isfile() or member.isdir()),member.name
   tar.extract(member,path=dest)
 assert process.wait()==0
 for name in manifest['overlayFiles']:
  target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((folder/name).read_bytes())
 for name,h in manifest['allLoadedRuntimeHashes'].items():assert sha((dest/name).read_bytes())==h,name
 print(json.dumps({'destination':str(dest),'candidateOnly':True,'productionUnchanged':True,'sourceModules':len(manifest['allLoadedRuntimeHashes'])}))
else:print(json.dumps({'verified':True,'baseCommit':manifest['baseCommit'],'overlayFiles':len(manifest['overlayFiles']),'sourceModules':len(manifest['allLoadedRuntimeHashes']),'admitted':False,'officialRuns':0}))
