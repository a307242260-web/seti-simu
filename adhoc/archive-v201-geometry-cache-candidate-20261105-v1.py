from pathlib import Path
import hashlib,json,shutil
stage=Path(__file__).resolve().parents[1];previous='reports/ai-foundation-20261105/candidate-v200-scalar-cache-20261105-v1/manifest.json';prior=json.loads((stage/previous).read_text());dest=stage/'reports/ai-foundation-20261105/candidate-v201-geometry-cache-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen candidate'
files=set(prior['sourceHashes'])|{'adhoc/third-round-v201-geometry-cache-contract-20261105-v1.md'};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for n,h in prior['baseRuntimeHashes'].items():
 if n not in files:assert sha(stage/n)==h,n
for name in sorted(files):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
m={**prior,'baseCommit':'b8160e6f7739432b30f978c60e11db999f657fe4','searchVersion':'seti-complete-decision-search-v201','valueModel':'seti-purpose-capital-state-value-v26','sourceHashes':{n:sha(stage/n)for n in sorted(files)},'priorCandidate':previous,'scope':'Exact public probe requirement reuse only after all three geometry graphs are recursively certified frozen, keyed by complete topology object identities and actor color/ID/orange capability bits. Mutable or shallow frozen inputs keep complete content-key invalidation. No wallet caching, successor, node merging, candidate deletion, value or budget change.'};(dest/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
