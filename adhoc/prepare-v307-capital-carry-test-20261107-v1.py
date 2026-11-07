from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];D=P/'reports/ai-foundation-20261107/capital-carry-v1';D.mkdir(exist_ok=True)
m=json.loads((P/'reports/ai-foundation-20261107/read-only-rewards-v1/source-manifest-20261107-v1.json').read_text())
p=P/'randomizer/game/ai/local-decision-plans.js';assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sourceHashes'][str(p.relative_to(P))]
r=D/'local-plans-v306-reference-20261107-v1.js';assert not r.exists();r.write_bytes(p.read_bytes())
