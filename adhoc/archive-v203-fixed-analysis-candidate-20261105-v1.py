from pathlib import Path
import hashlib,json,shutil
stage=Path(__file__).resolve().parents[1];previous='reports/ai-foundation-20261105/candidate-v200-scalar-cache-20261105-v1/manifest.json';prior=json.loads((stage/previous).read_text());dest=stage/'reports/ai-foundation-20261105/candidate-v203-fixed-analysis-20261105-v1';assert not(dest/'manifest.json').exists(),'preserve frozen candidate'
files=set(prior['sourceHashes'])|{'adhoc/third-round-v203-fixed-analysis-contract-20261105-v1.md'};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for n,h in prior['baseRuntimeHashes'].items():
 if n not in files:assert sha(stage/n)==h,n
for name in sorted(files):
 p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(stage/name,p)
m={**prior,'baseCommit':'b8160e6f7739432b30f978c60e11db999f657fe4','searchVersion':'seti-complete-decision-search-v203','valueModel':'seti-purpose-capital-state-value-v27','sourceHashes':{n:sha(stage/n)for n in sorted(files)},'priorCandidate':previous,'scope':'One locally greedy current-funded Amiba analysis/blue-trace/currency-tail plan from formal visible net rewards, then exactly one complete shared-wallet portfolio re-evaluation. V27 policy may forgo lower immediate/higher future local positions. No native option deletion, new state equivalence, upper-bound expansion or budget change. Retain effective V200 scalar/string caches, discard ineffective V201/V202 optimizations.'};(dest/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(str((dest/'manifest.json').relative_to(stage)))
