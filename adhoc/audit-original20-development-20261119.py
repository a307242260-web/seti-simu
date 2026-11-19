"""Read existing records only; never executes AI, game inputs or new experiments."""
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'reports/iteration/v486-original20-20261119/summary-20261119-v1.json'
RUNTIME = Path('/private/tmp/seti-v486-random20-business-20261119-eihjgdmc')
OUTPUT = ROOT / 'reports/ai-foundation-20261119/original20-development-audit-20261119-v1.json'
RESOURCES = ['credits', 'energy', 'handSize', 'publicity', 'availableData', 'additionalPublicScan']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text())

if OUTPUT.exists():
    cached = read(OUTPUT)
    assert digest(SOURCE) == cached['sources']['summarySha256']
    for item in cached['sources']['boards']:
        for field in ['record', 'trace', 'save']:
            assert digest(RUNTIME / item[field]) == item[field + 'Sha256']
    print(json.dumps({'checkpointReused': True, 'aggregate': cached['aggregate']}))
    raise SystemExit(0)

summary = read(SOURCE)
assert summary['completed'] == 20 and summary['failed'] == 0
sources, rows = [], []
for source in summary['rows']:
    record_path = RUNTIME / source['recordPath']
    assert digest(record_path) == source['sourceRecordSha256']
    record = read(record_path)
    assert record['terminal'] is True
    save_path, trace_path = RUNTIME / record['savePath'], RUNTIME / record['agentTracePath']
    save = read(save_path)
    traces = [json.loads(line) for line in trace_path.read_text().splitlines() if line.strip()]
    offset = record['steps'] - len(traces)
    assert len(save['replaySteps']) == record['steps']
    for i, trace in enumerate(traces):
        assert trace['actionId'] == save['replaySteps'][offset + i]['action']['actionId']
    sources.append({'board': source['number'], 'record': source['recordPath'],
        'recordSha256': digest(record_path), 'trace': record['agentTracePath'],
        'traceSha256': digest(trace_path), 'save': record['savePath'], 'saveSha256': digest(save_path)})
    white = [(offset + i + 1, t) for i, t in enumerate(traces) if t['context']['seatId'] == 'player-white']
    first_observation = white[0][1]['context']['observation']
    initial = next(p for p in first_observation['publicState']['players'] if p['playerId'] == 'player-white')
    ends = {r['round']: r for r in source['roundEnds']}
    menus, income_roots, actions = [], {}, []
    for step, trace in white:
        context = trace['context']
        observation = context['observation']
        round_number = observation['publicState']['roundNumber']
        if round_number not in [1, 2] or step >= ends[round_number]['beforeInput']:
            continue
        hand = {c['id']: c for c in observation['selfState']['hand']}
        legal = {a['actionId']: a for a in context['legalActions']}
        action = legal[trace['actionId']]
        target = action.get('target') or {}
        action_card = hand.get(target.get('cardInstanceId'))
        choice = target.get('choiceId', '')
        usage = ('income' if choice.startswith('income:') else
                 'play' if action['family'] == 'play_card' else
                 'corner' if action['family'] == 'card_corner' else action['family'])
        actions.append({'step': step, 'round': round_number, 'family': action['family'],
            'cardInstanceId': target.get('cardInstanceId'), 'card': (action_card or {}).get('cardId'),
            'usage': usage, 'summary': action['summary']})
        income_choices = [a for a in legal.values() if ((a.get('target') or {}).get('choiceId') or '').startswith('income:')]
        if income_choices:
            known = [hand[(a.get('target') or {}).get('cardInstanceId')] for a in income_choices
                     if (a.get('target') or {}).get('cardInstanceId') in hand]
            unknown = len(income_choices) - len(known)
            owner = next(p for p in observation['publicState']['players'] if p['playerId'] == 'player-white')
            menus.append({'step': step, 'round': round_number, 'choices': len(income_choices),
                'unknownChoiceCards': unknown, 'moneyOptionCount': sum(c.get('incomeCode') == 0 for c in known),
                'selectedIncomeCode': (action_card or {}).get('incomeCode') if usage == 'income' else None,
                'selectedCard': (action_card or {}).get('cardId') if usage == 'income' else None,
                'selectedAsIncome': usage == 'income', 'incomeBefore': owner['income'],
                'selectedSummary': action['summary'],
                'visibleChoiceCards': [{'card': c['cardId'], 'id': c['id'], 'incomeCode': c.get('incomeCode')} for c in known]})
        for root in (trace.get('search') or {}).get('roots', []):
            goal = root.get('goal') or {}
            if goal.get('purpose') != 'income' or not goal.get('cardId'):
                continue
            key = goal['cardId']
            if key not in income_roots:
                income_roots[key] = {'step': step, 'round': round_number, 'cardInstanceId': key,
                    'card': (hand.get(key) or {}).get('cardId'), 'rootValue': root.get('value'),
                    'chosenValue': (trace.get('search') or {}).get('value'),
                    'selectedImmediately': root['actionId'] == trace['actionId'], 'completion': root.get('completion')}
    root_reviews = []
    for key, root in income_roots.items():
        uses = [a for a in actions if a['step'] >= root['step'] and a['cardInstanceId'] == key
                and a['usage'] in ['income', 'play', 'corner']]
        root_reviews.append(dict(root, firstActualUse=uses[0] if uses else None,
            laterTuckedForIncome=any(a['usage'] == 'income' for a in uses)))
    round_assets = [{'round': n, 'score': ends[n]['score'], 'income': ends[n]['income'],
        'incomeGainFromOpening': {k: ends[n]['income'].get(k, 0) - initial['income'].get(k, 0) for k in RESOURCES},
        'techCount': len(ends[n]['technology']['ownedTiles']), 'remaining': ends[n]['resources'],
        'handCount': len(ends[n]['hand'])} for n in [1, 2, 3, 4]]
    rows.append({'board': source['number'], 'seed': source['seed'], 'score': source['score'],
        'openingIncome': initial['income'], 'rounds': round_assets, 'incomeMenusFirstTwoRounds': menus,
        'explicitIncomeGoalCards': root_reviews})

averages = []
for n in [1, 2, 3, 4]:
    assets = [r['rounds'][n - 1] for r in rows]
    averages.append({'round': n, 'score': sum(a['score'] for a in assets) / 20,
        'technology': sum(a['techCount'] for a in assets) / 20,
        'income': {k: sum(a['income'].get(k, 0) for a in assets) / 20 for k in RESOURCES},
        'incomeGainFromOpening': {k: sum(a['incomeGainFromOpening'][k] for a in assets) / 20 for k in RESOURCES},
        'noCreditsIncomeGrowthBoards': [r['board'] for r in rows if r['rounds'][n - 1]['incomeGainFromOpening']['credits'] == 0],
        'atMostOneTechnologyBoards': [r['board'] for r in rows if r['rounds'][n - 1]['techCount'] <= 1]})
menus = [dict(board=row['board'], **menu) for row in rows for menu in row['incomeMenusFirstTwoRounds']]
money_available = [m for m in menus if m['moneyOptionCount'] > 0 and m['unknownChoiceCards'] == 0]
money_declined = [m for m in money_available if m['selectedAsIncome'] and m['selectedIncomeCode'] != 0]
roots = [dict(board=row['board'], **r) for row in rows for r in row['explicitIncomeGoalCards']]
aggregate = {'meanScore': sum(r['score'] for r in rows) / 20, 'rounds': averages,
    'openingIncome': {k: sum(r['openingIncome'].get(k, 0) for r in rows) / 20 for k in RESOURCES},
    'incomeMenuCount': len(menus), 'incomeMenuUnknownCards': sum(m['unknownChoiceCards'] for m in menus),
    'moneyAvailableMenus': len(money_available), 'moneyDeclinedMenus': len(money_declined),
    'moneyDeclinedBoards': sorted(set(m['board'] for m in money_declined)),
    'incomeGoalDistinctCards': len(roots), 'incomeGoalBoards': sorted(set(r['board'] for r in roots)),
    'notImmediateButLaterIncome': [r for r in roots if not r['selectedImmediately'] and r['laterTuckedForIncome']]}
result = {'schemaVersion': 'seti-existing20-development-audit-v1', 'sourceCommit': summary['sourceCommit'],
    'sources': {'summary': str(SOURCE.relative_to(ROOT)), 'summarySha256': digest(SOURCE), 'runtime': str(RUNTIME), 'boards': sources},
    'newAISearches': 0, 'newNativeInputs': 0, 'newGames': 0,
    'roundBoundary': 'before own PASS, excluding PASS card choice and next-round income',
    'classificationLimits': ['Income goal metadata is not all possible income production.',
        'A money option declined does not establish it was better; cards have other uses and payment timing matters.',
        'Low income and low final score are descriptive, not causal proof.',
        'Card/energy income code mapping is 0 credits, 1 energy, 2 cards; all choices are observed own hand cards.',
        'Round income differences are measured from each board actual opening, never inferred from company base.'],
    'aggregate': aggregate, 'moneyDeclinedEvidence': money_declined, 'rows': rows}
OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'checkpoint': str(OUTPUT.relative_to(ROOT)), 'aggregate': aggregate}, ensure_ascii=False))
