from pathlib import Path
d=Path('reports/ai-foundation-20261107/income-before-amiba-scalar-work-v1')
s=(d/'probe-scalar-work-prototype-20261107-v2.js').read_text()
def edit(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
edit('''  function ownedProbes(rockets, player) {
    return (rockets || []).filter(r => r.surface === "solar-board"
      && (r.kind || "standard") === "standard" && r.fossilId == null && r.playerId === player.id);
  }''','''  function isOwnedProbe(rocket, playerId) {
    return rocket.surface === "solar-board" && (rocket.kind || "standard") === "standard"
      && rocket.fossilId == null && rocket.playerId === playerId;
  }
  function ownedProbes(rockets, player) {
    return (rockets || []).filter(r => isOwnedProbe(r, player.id));
  }''')
edit('!ownedProbes(facts.board?.rockets, player).length) return scalarOnly ? 0 : zero();','!(facts.board?.rockets || []).some(r => isOwnedProbe(r, seatId))) return scalarOnly ? 0 : zero();')
edit('const scalarRequirementCache=new Map(), scalarRequirementKeysByGeometry=new WeakMap(), fundedGoalsByDirectory=new WeakMap();','''const scalarRequirementCache=new Map(), scalarRequirementKeysByGeometry=new WeakMap(), fundedGoalsByDirectory=new WeakMap();
  const nativeSeatIndex=new Map(['blue','green','brown','white'].map((color,index)=>['player-'+color,{color,index}]));
  function canonicalGeometryIndex(p, a, b, c) {
    const seat=nativeSeatIndex.get(p.id);
    return seat?.color===p.color ? seat.index*8+Number(a)+Number(b)*2+Number(c)*4 : null;
  }''')
edit('''    const p = facts.player, actor = { id: p.id, color: p.color, resources: p, techState: p.techState };
    __requirementRefs.queries++;
    const geometry=[facts.board.solarSystem,facts.board.rockets,facts.board.planets];
    const abilities=['orange2','orange3','orange4'].map(id=>Boolean(p.techState?.ownedTiles?.[id]&&!p.techState?.disabledTiles?.[id]));
    const suffix=[p.id,p.color,abilities],refs=exactGeometryKeys(geometry,scalarPrivate);
    const small=refs&&JSON.stringify(suffix),remembered=refs?.get(small);''','''    const p = facts.player,owned=p.techState?.ownedTiles,disabled=p.techState?.disabledTiles;
    __requirementRefs.queries++;
    const geometry=[facts.board.solarSystem,facts.board.rockets,facts.board.planets];
    const orange2=Boolean(owned?.orange2&&!disabled?.orange2),orange3=Boolean(owned?.orange3&&!disabled?.orange3),
      orange4=Boolean(owned?.orange4&&!disabled?.orange4);
    const refs=exactGeometryKeys(geometry,scalarPrivate),index=refs&&canonicalGeometryIndex(p,orange2,orange3,orange4);
    const small=refs&&(index??JSON.stringify([p.id,p.color,[orange2,orange3,orange4]])),remembered=refs?.get(small);''')
edit('const key=JSON.stringify([...geometry,...suffix]);__requirementRefs.serialized++;','const key=JSON.stringify([...geometry,p.id,p.color,[orange2,orange3,orange4]]);__requirementRefs.serialized++;')
edit('''    __requirementRefs.geometryMisses++;
    const context = { players: { players: [actor] }''','''    __requirementRefs.geometryMisses++;
    const actor = { id: p.id, color: p.color, resources: p, techState: p.techState };
    const context = { players: { players: [actor] }''')
(d/'probe-scalar-work-prototype-20261107-v3.js').write_text(s)
(d/'state-value-mission-data-window-prototype-20261107-v3.js').write_bytes((d/'state-value-mission-data-window-prototype-20261107-v2.js').read_bytes())
