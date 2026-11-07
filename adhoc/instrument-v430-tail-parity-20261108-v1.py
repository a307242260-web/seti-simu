from pathlib import Path
from shutil import copytree
b=Path(__file__).parent
src={'v425':b.parent/'seti-v425-public-data-20261108-v1/work-v425','v430':b/'work-v430'}
for name,source in src.items():
    d=b/('parity-'+name)
    d.mkdir()
    copytree(source/'randomizer',d/'randomizer')
    (d/'assets').symlink_to(source/'assets',target_is_directory=True)
    p=d/'randomizer/game/ai/analysis-port.js'
    s=p.read_text()
    target='    function identity(node) {'
    assert s.count(target)==1
    s=s.replace(target,'''    function debugTailSource(node){
      const s=nodes.get(node);
      if(!s?.envelope||node.status!=="stable")return null;
      return require("node:crypto").createHash("sha256").update(JSON.stringify([
        s.envelope,s.intent,s.cardControl,s.resourceControl,cardKnowledgeKey(s.envelope)
      ])).digest("hex");
    }
'''+target)
    s=s.replace('return Object.freeze({ openRoot, expand, identity,', 'return Object.freeze({ openRoot, expand, identity, debugTailSource,')
    p.write_text(s)
    p=d/'randomizer/game/ai/decision-search.js';s=p.read_text()
    target='      node: index, status: entry.node.status, boundary: entry.node.boundary || null,'
    assert s.count(target)==1
    s=s.replace(target,target+'\n      debugTailSource: port.debugTailSource?.(entry.node),')
    p.write_text(s)
