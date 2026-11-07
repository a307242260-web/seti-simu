from pathlib import Path
r=Path('/private/tmp/seti-v321-income-before-amiba-prepaid-trace-20261107-v1/randomizer/game/effects/science-session.js')
s=r.read_text()
a="""    const locations = solar.createSolarSnapshot(
      getWorkingSlice(root, "solarSystem"),
    ).nebulaLocations || {};
    const location = Array.isArray(locations)
      ? locations.find((entry) => entry.id === nebulaId)
      : locations[nebulaId] || null;"""
b="""    const solarState = solar.normalizeSolarInput(getWorkingSlice(root, "solarSystem"));
    const location = solar.getNebulaLocations(solarState.sectorBySlot)
      .find((entry) => entry.id === nebulaId);"""
assert s.count(a)==1
s=s.replace(a,b)
a="""? solar.createSolarSnapshot(getWorkingSlice(root, "solarSystem")).planetLocations
          .find((candidate) => candidate.planetId === planetId)"""
b="""? solar.collectPlanetLocations(solar.normalizeSolarInput(getWorkingSlice(root, "solarSystem")))
          .find((candidate) => candidate.planetId === planetId)"""
assert s.count(a)==1
s=s.replace(a,b)
d=Path('reports/ai-foundation-20261107/teacher-r3-after-amiba-scan-coordinate-v1');d.mkdir(exist_ok=True)
(d/'science-scan-coordinates-prototype-20261107-v1.js').write_text(s)
