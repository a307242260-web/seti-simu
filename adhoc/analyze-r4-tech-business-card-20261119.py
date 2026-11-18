"""Read existing authoritative game/decision evidence. Never run SETI or AI."""
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(sys.argv[1])
assert not OUTPUT.exists(), 'Reuse the existing analysis instead of overwriting it'
COMMIT = 'aad43e42ab5be10e8c645a8001eb2c9ede0579d0'
RECORD = 'reports/research/2170d824.5fabd621.full.json'
EXPECTED = '81b86fed3857ccdd22e968ce00e59cfa4b9781ade5b71b69d65b79038d72d428'
D = 'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1/'
TEACHER = D + 'teacher-current-legal-reference-384-20261118-v1.replay.json'
sha = lambda b: hashlib.sha256(b).hexdigest()
raw = subprocess.check_output(['git', 'show', COMMIT + ':' + RECORD], cwd=ROOT)
assert sha(raw) == EXPECTED
record = json.loads(raw)
teacher_bytes = (ROOT / TEACHER).read_bytes()
teacher = json.loads(teacher_bytes)
teacher_proof_path = D + 'teacher-current-legal-reference-proof-20261118-v1.json'
teacher_proof_bytes = (ROOT / teacher_proof_path).read_bytes()
teacher_proof = json.loads(teacher_proof_bytes)
assert teacher_proof['completeNativeStateEqual'] and teacher_proof['rngEqual']
trace_path = ROOT / record['agentTracePath']
trace_bytes = trace_path.read_bytes()
all_traces = [json.loads(line) for line in trace_bytes.splitlines() if line.strip()]
traces = [trace for trace in all_traces if trace['context']['seatId'] == 'player-white']
searches = record['metrics']['searches']
joined = len(traces) == len(searches) and all(
    t.get('actionId') == s.get('action') for t, s in zip(traces, searches))

round_number = 1
teacher_research = []
teacher_tech = []
teacher_pass = []
is_tech = lambda tile: bool(re.fullmatch(r'(blue|orange|purple)[1-4]', str(tile)))
for index, entry in enumerate(teacher['actions'], 1):
    action = entry['action']
    if action.get('actorId') != 'player-white':
        continue
    target = action.get('target') or {}
    if action['family'] == 'research_tech':
        teacher_research.append({'input': index, 'round': round_number})
    if is_tech(target.get('tileId')):
        teacher_tech.append({'input': index, 'round': round_number,
                             'tile': target['tileId'], 'blueSlot': target.get('blueSlot')})
    if action['family'] == 'pass':
        teacher_pass.append({'input': index, 'round': round_number})
        round_number += 1

windows = []
ai_acquisitions = []
goal_kinds = set()
for index, trace in enumerate(traces):
    context = trace['context']
    observation = context['observation']
    public = observation['publicState']
    owner = next(p for p in public['players'] if p['playerId'] == 'player-white')
    legal = context['legalActions']
    selected = next((a for a in legal if a['actionId'] == trace['actionId']), None)
    selected_target = (selected or {}).get('target') or {}
    step = searches[index]['step'] if joined else None
    if is_tech(selected_target.get('tileId')):
        ai_acquisitions.append({'input': step, 'round': public['roundNumber'],
                                'tile': selected_target['tileId'],
                                'blueSlot': selected_target.get('blueSlot')})
    if public['roundNumber'] != 4:
        continue
    search = trace.get('search') or {}
    roots = search.get('roots') or []
    for node in roots:
        goal = node.get('goal') or {}
        if goal.get('kind'):
            goal_kinds.add(goal['kind'])
    research = [node for node in roots if str(node.get('actionId', '')).startswith('research_tech:')
                or 'research' in str((node.get('goal') or {}).get('kind', '')).lower()]
    legal_research = [a for a in legal if a['family'] == 'research_tech']
    if not legal_research and not research:
        continue
    candidates = [{key: node[key] for key in ['actionId', 'goal', 'value', 'completion', 'valueType', 'prunedByPlan'] if key in node}
                  for node in research]
    finite_values = [node.get('value') for node in research
                     if isinstance(node.get('value'), (int, float)) and math.isfinite(node['value'])]
    best = max(finite_values) if finite_values else None
    resources = {k: owner.get(k) for k in ['credits', 'energy', 'publicity', 'availableData', 'handCount']}
    row = {'input': step, 'requestId': context.get('requestId'), 'turn': public.get('turnNumber'),
           'selected': {'actionId': trace['actionId'], 'family': (selected or {}).get('family'), 'target': selected_target},
           'wallet': resources, 'mainActionCompleted': owner.get('mainActionCompleted'),
           'researchPublicityCost': owner.get('researchPublicityCost'),
           'researchDirectlyLegal': bool(legal_research), 'selectedValue': search.get('value'),
           'bestResearchRootValue': best, 'researchRoots': candidates,
           'reusedCoverage': search.get('reusedCoverage'),
           'complete': search.get('complete'), 'unresolvedCount': len(search.get('unresolved') or [])}
    if not row['mainActionCompleted']:
        windows.append(row)

summary = []
ai_owned, teacher_owned = set(), set()
for rnd in range(1, 5):
    ai_regular = [s['step'] for s in searches if str(s['action']).startswith('research_tech:')
                  and (next((i + 1 for i, end in enumerate(record['roundEnds']) if s['step'] <= end['beforeInput']), None) == rnd)]
    teacher_regular = [x['input'] for x in teacher_research if x['round'] == rnd]
    ai_tiles = [x for x in ai_acquisitions if x['round'] == rnd]
    teacher_tiles = [x for x in teacher_tech if x['round'] == rnd]
    ai_owned.update(x['tile'] for x in ai_tiles)
    teacher_owned.update(x['tile'] for x in teacher_tiles)
    assert ai_owned == {k for k, v in record['roundEnds'][rnd - 1]['technology']['ownedTiles'].items() if v}
    assert teacher_owned == {k for k, v in teacher_proof['roundEnds'][rnd - 1]['technology']['ownedTiles'].items() if v}
    summary.append({'round': rnd, 'aiRegularResearchInputs': ai_regular,
                    'teacherRegularResearchInputs': teacher_regular,
                    'aiTechSelections': ai_tiles, 'teacherTechSelections': teacher_tiles,
                    'aiCumulativeTech': sorted(ai_owned), 'teacherCumulativeTech': sorted(teacher_owned)})

r4_observations = [(searches[i]['step'], t) for i, t in enumerate(traces)
                   if joined and t['context']['observation']['publicState']['roundNumber'] == 4]
publicity_events = []
for (step, trace), (_, following) in zip(r4_observations, r4_observations[1:]):
    player = next(p for p in trace['context']['observation']['publicState']['players'] if p['playerId'] == 'player-white')
    after = next(p for p in following['context']['observation']['publicState']['players'] if p['playerId'] == 'player-white')
    delta = after['publicity'] - player['publicity']
    if delta:
        action = next(a for a in trace['context']['legalActions'] if a['actionId'] == trace['actionId'])
        publicity_events.append({'input': step, 'family': action['family'], 'target': action.get('target'),
                                  'before': player['publicity'], 'after': after['publicity'], 'delta': delta})
free_tech_index = next(i for i, entry in enumerate(teacher['actions'])
                      if (entry['action'].get('target') or {}).get('tileId') == 'blue4')
grant_sequence = [{'input': i + 1, 'action': teacher['actions'][i]['action']}
                  for i in range(free_tech_index - 1, free_tech_index + 2)]
entry_comparison = {'boundary': 'round3-before-pass-card-and-next-income',
                    'ai': record['roundEnds'][2], 'teacher': teacher_proof['roundEnds'][2]}

result = {'schemaVersion': 'seti-r4-tech-business-card-v2', 'sources': {
    RECORD: {'gitCommit': COMMIT, 'sha256': EXPECTED},
    TEACHER: {'sha256': sha(teacher_bytes)},
    teacher_proof_path: {'sha256': sha(teacher_proof_bytes)},
    record['agentTracePath']: {'sha256': sha(trace_bytes), 'bytes': len(trace_bytes), 'source': 'existing working research evidence; no regeneration'}},
    'question': 'What concrete fourth-round research windows explain the technology development gap?',
    'scope': 'Existing formal272 vs legal teacher384 trajectories; different R4 starting states, not a same-state causal comparison',
    'formalScore': record['summary']['scores']['player-white'], 'teacherLegalScore': teacher['result']['score'],
    'traceJoin': {'provenByOrderedActionIds': joined, 'allSeatTraces': len(all_traces), 'whiteTraces': len(traces), 'recordedSearches': len(searches)},
    'roundResearchLedger': summary, 'teacherPassInputs': teacher_pass,
    'aiRoundEnds': record['roundEnds'], 'teacherR4EntryInput': next((x['input'] + 1 for x in teacher_pass if x['round'] == 3), None),
    'r4GoalKindsObserved': sorted(goal_kinds), 'r4ResearchWindows': windows,
    'r4PublicityObservedDeltas': publicity_events,
    'r4PublicityAccounting': {'aiBeforeRound3Pass': record['roundEnds'][2]['resources']['publicity'],
                              'aiBeforeRound4Pass': record['roundEnds'][3]['resources']['publicity'],
                              'observedPositiveDeltas': sum(x['delta'] for x in publicity_events if x['delta'] > 0),
                              'observedNegativeDeltas': sum(x['delta'] for x in publicity_events if x['delta'] < 0),
                              'teacherBeforeRound3Pass': teacher_proof['roundEnds'][2]['resources']['publicity'],
                              'teacherBeforeRound4Pass': teacher_proof['roundEnds'][3]['resources']['publicity'],
                              'teacherR4RegularResearchActions': 4,
                              'teacherFullPublicityFlowAvailable': False},
    'round3AssetComparison': entry_comparison, 'teacherCardGrantedBlue4Sequence': grant_sequence,
    'readerSha256': sha(Path(__file__).read_bytes()),
    'preliminaryExtractionCorrection': 'Only blue/orange/purple1-4 are technologies. Generic tileId a/b/c/d belongs to final scoring, excluded and checked against all eight official round-end tech sets.',
    'newAISearches': 0, 'newNativeInputs': 0, 'newAutonomousGames': 0,
    'runtimeModified': False, 'v514Reopened': False,
    'limits': ['Recorded root bounds are not proof that every alternative attained its quoted value.',
               'Main research actions, technology selections and unique cumulative tiles are separate counts.',
               'A resource shortfall or higher selected model value does not by itself justify the policy.']}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'traceJoin': result['traceJoin'], 'roundResearchLedger': summary,
                  'r4ResearchWindows': [{k: x[k] for k in ['input', 'selected', 'wallet', 'researchDirectlyLegal', 'selectedValue', 'bestResearchRootValue', 'reusedCoverage']} for x in windows],
                  'r4GoalKinds': sorted(goal_kinds)}, ensure_ascii=False))
