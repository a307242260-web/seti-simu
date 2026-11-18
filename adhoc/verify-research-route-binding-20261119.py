"""Verify parent-route admission with actual subprocesses and durable receipts."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile
import time

GUARD = Path(sys.argv[1]).resolve()
OUTPUT = Path(sys.argv[2]).resolve()
assert not OUTPUT.exists(), 'Do not overwrite verification evidence'
rows = []


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')
    return path


def route(directory, name, seconds=10, status='open'):
    now = time.time()
    return write(directory / (name + '.route.json'), {
        'schemaVersion': 'seti-research-route-v1', 'startedEpochSeconds': now - 30,
        'deadlineEpochSeconds': now + seconds, 'status': status, 'workUnits': []})


def unit(directory, name, parent=None, schema='seti-research-wall-window-v2'):
    now = time.time()
    record = {'schemaVersion': schema, 'startedEpochSeconds': now - 10,
              'deadlineEpochSeconds': now + 20, 'status': 'open', 'attempts': []}
    if parent is not None:
        record['routeCheckpoint'] = parent.name
    return write(directory / (name + '.json'), record)


def command(path, program):
    return [sys.executable, str(GUARD), str(path), '--', sys.executable, '-u', '-c', program]


def run(path, program, expected=0):
    result = subprocess.run(command(path, program), capture_output=True, text=True, timeout=3)
    assert result.returncode == expected, (result.returncode, expected, result.stdout, result.stderr)
    return result, json.loads(path.read_text())


def passed(name):
    rows.append({'case': name, 'passed': True})
    print('PASS ' + name, flush=True)


try:
    with tempfile.TemporaryDirectory(prefix='seti-route-binding-controls-') as temporary:
        directory = Path(temporary)
        marker = directory / 'must-not-start'
        forbidden = f"from pathlib import Path; Path({str(marker)!r}).write_text('started')"

        parent = route(directory, 'frozen', status='frozen')
        p = unit(directory, 'fresh-child-of-frozen-route', parent, schema='seti-research-wall-window-v1')
        original = parent.read_bytes()
        result, record = run(p, forbidden, 2)
        assert 'WORK_ROUTE_CLOSED' in result.stderr and not marker.exists()
        assert parent.read_bytes() == original and record['attempts'] == []
        passed('new child window cannot restart a frozen parent route')

        p = unit(directory, 'missing-route-reference')
        result = subprocess.run(command(p, forbidden), capture_output=True, text=True)
        assert result.returncode != 0 and 'WORK_ROUTE_REQUIRED' in result.stderr
        assert not marker.exists() and json.loads(p.read_text())['attempts'] == []
        passed('v2 research window requires an explicit parent route')

        parent = route(directory, 'expired-parent', seconds=-1)
        p = unit(directory, 'fresh-child-of-expired-route', parent)
        result, record = run(p, forbidden, 124)
        assert 'WORK_ROUTE_EXPIRED' in result.stderr and not marker.exists()
        assert record['attempts'] == [] and json.loads(parent.read_text())['status'] == 'expired'
        passed('fresh child cannot renew the expired route deadline')

        parent = route(directory, 'shared-limit')
        original_cutoff = json.loads(parent.read_text())['deadlineEpochSeconds']
        first = unit(directory, 'first-unit', parent)
        second = unit(directory, 'second-unit', parent)
        third = unit(directory, 'third-unit', parent)
        _, a = run(first, "print('first')")
        _, b = run(first, "print('resume')")
        _, c = run(second, "print('second')")
        receipt = json.loads(parent.read_text())
        assert receipt['deadlineEpochSeconds'] == original_cutoff
        assert receipt['workUnits'] == [str(first.resolve()), str(second.resolve())]
        assert len(a['attempts']) == 1 and len(b['attempts']) == 2 and len(c['attempts']) == 1
        assert all(x['effectiveDeadlineEpochSeconds'] == original_cutoff for x in b['attempts'])
        original = parent.read_bytes()
        result, record = run(third, forbidden, 2)
        assert 'WORK_ROUTE_UNIT_LIMIT' in result.stderr and not marker.exists()
        assert record['attempts'] == [] and parent.read_bytes() == original
        passed('two durable units share one cutoff and third unit is denied')

        alias = directory / 'first-alias.json'
        alias.symlink_to(first)
        _, record = run(alias, "print('same-unit-alias')")
        assert len(record['attempts']) == 3 and len(json.loads(parent.read_text())['workUnits']) == 2
        passed('canonical window identity preserves resume across a symlink alias')

        parent = route(directory, 'running-cutoff', seconds=0.35)
        p = unit(directory, 'long-child', parent)
        own_deadline = json.loads(p.read_text())['deadlineEpochSeconds']
        started = time.monotonic()
        result, record = run(p, "import time; print('partial',flush=True); time.sleep(10)", 124)
        assert time.monotonic() - started < 2 and result.stdout == 'partial\n'
        assert record['status'] == 'expired' and record['deadlineEpochSeconds'] == own_deadline
        assert record['attempts'][0]['childExitCode'] != 0
        assert json.loads(parent.read_text())['status'] == 'expired'
        assert Path(record['attempts'][0]['stdout']).read_text() == 'partial\n'
        passed('parent cutoff stops a running child without rewriting its own deadline')

        parent = route(directory, 'concurrent-route')
        first = unit(directory, 'live-child', parent)
        second = unit(directory, 'competing-child', parent)
        ready = directory / 'live-ready'
        program = f"from pathlib import Path; import time; Path({str(ready)!r}).write_text('live'); time.sleep(.5)"
        process = subprocess.Popen(command(first, program), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            until = time.monotonic() + 2
            while not ready.exists() and time.monotonic() < until:
                time.sleep(.01)
            assert ready.exists() and process.poll() is None
            result, record = run(second, forbidden, 2)
            assert 'WORK_ROUTE_BUSY' in result.stderr and record['attempts'] == [] and not marker.exists()
            process.communicate(timeout=2)
            assert process.returncode == 0 and len(json.loads(parent.read_text())['workUnits']) == 1
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()
        passed('route lock excludes simultaneous commands from different child windows')

        parent = route(directory, 'wrong-parent-schema')
        bad = json.loads(parent.read_text()); bad['schemaVersion'] = 'seti-research-wall-window-v1'; write(parent, bad)
        p = unit(directory, 'wrong-parent-child', parent)
        result = subprocess.run(command(p, forbidden), capture_output=True, text=True)
        assert result.returncode != 0 and 'WORK_ROUTE_SCHEMA_INVALID' in result.stderr
        assert not marker.exists() and json.loads(p.read_text())['attempts'] == []
        passed('ordinary work window cannot masquerade as a route ledger')

        parent = directory / 'absent.route.json'
        p = unit(directory, 'absent-parent-child', parent)
        result = subprocess.run(command(p, forbidden), capture_output=True, text=True)
        assert result.returncode != 0 and not marker.exists() and json.loads(p.read_text())['attempts'] == []
        passed('missing route ledger fails before command launch')

        for label in ['route-duration', 'unit-duration']:
            parent = route(directory, label)
            p = unit(directory, label + '-child', parent)
            target = parent if label == 'route-duration' else p
            bad = json.loads(target.read_text())
            bad['deadlineEpochSeconds'] = bad['startedEpochSeconds'] + (7201 if label == 'route-duration' else 3601)
            write(target, bad)
            result = subprocess.run(command(p, forbidden), capture_output=True, text=True)
            assert result.returncode != 0 and 'WORK_ROUTE_DURATION_LIMIT' in result.stderr
            assert not marker.exists() and json.loads(p.read_text())['attempts'] == []
            assert json.loads(parent.read_text())['workUnits'] == []
            passed(label + ' cannot exceed the existing 120 or 60 minute limit')
except Exception as error:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({'passed': False, 'completedControls': rows, 'error': repr(error),
        'guardSha256': hashlib.sha256(GUARD.read_bytes()).hexdigest()}, indent=2) + '\n')
    raise

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps({'passed': True, 'controls': rows,
    'guardSha256': hashlib.sha256(GUARD.read_bytes()).hexdigest(),
    'verificationSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'scope': 'Command route ledger only; cannot prevent bypassing the guard or editing ledger files.',
    'newAISearches': 0, 'newNativeInputs': 0, 'newAutonomousGames': 0}, indent=2) + '\n')
print('SUMMARY route controls passed=' + str(len(rows)) + ' failed=0', flush=True)
