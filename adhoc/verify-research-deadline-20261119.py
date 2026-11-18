"""Exercise actual guard subprocesses; no SETI modules, AI or Native inputs."""
from pathlib import Path
import hashlib
import json
import os
import signal
import subprocess
import sys
import tempfile
import time

GUARD = Path(__file__).with_name('research-deadline-guard-20261119.py')
OUTPUT = Path(sys.argv[1])
assert not OUTPUT.exists(), 'Do not overwrite an existing verification'
rows = []


def window(directory, name, seconds=10, status='open'):
    now = time.time()
    path = directory / (name + '.json')
    path.write_text(json.dumps({'schemaVersion': 'seti-research-wall-window-v1',
                               'startedEpochSeconds': now - 10,
                               'deadlineEpochSeconds': now + seconds,
                               'status': status, 'attempts': []}))
    return path


def run(path, program, expected=0):
    args = [sys.executable, str(GUARD), str(path), '--', sys.executable, '-u', '-c', program]
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=3)
    except subprocess.TimeoutExpired:
        record = json.loads(path.read_text())
        for attempt in record['attempts']:
            if attempt.get('pid'):
                try:
                    os.killpg(attempt['pid'], signal.SIGKILL)
                except ProcessLookupError:
                    pass
        raise
    assert result.returncode == expected, (result.returncode, result.stdout, result.stderr)
    return result, json.loads(path.read_text())


def passed(name):
    rows.append({'case': name, 'passed': True})
    print('PASS ' + name, flush=True)


try:
    with tempfile.TemporaryDirectory(prefix='seti-work-deadline-controls-') as temporary:
        directory = Path(temporary)
        p = window(directory, 'resume')
        original_deadline = json.loads(p.read_text())['deadlineEpochSeconds']
        first, a = run(p, "import sys; print('first'); print('error-stream',file=sys.stderr)")
        second, b = run(p, "print('second')")
        assert a['deadlineEpochSeconds'] == b['deadlineEpochSeconds'] == original_deadline
        assert len(a['attempts']) == 1 and len(b['attempts']) == 2
        assert first.stdout == 'first\n' and first.stderr == 'error-stream\n'
        assert Path(a['attempts'][0]['stdout']).read_text() == first.stdout
        assert Path(a['attempts'][0]['stderr']).read_text() == first.stderr
        assert second.stdout == Path(b['attempts'][1]['stdout']).read_text() == 'second\n'
        passed('fresh-process resume keeps original deadline and separate output evidence')

        marker = directory / 'must-not-start'
        command = f"from pathlib import Path; Path({str(marker)!r}).write_text('started')"
        p = window(directory, 'expired', seconds=-1)
        _, record = run(p, command, 124)
        assert not marker.exists() and record['status'] == 'expired' and not record['attempts']
        passed('expired checkpoint refuses command before input')

        p = window(directory, 'timeout', seconds=0.35)
        start = time.monotonic()
        result, record = run(p, "import sys,time; print('partial',flush=True); print('partial-error',file=sys.stderr,flush=True); time.sleep(10)", 124)
        assert time.monotonic() - start < 2
        assert record['status'] == 'expired' and record['attempts'][0]['childExitCode'] != 0
        assert result.stdout == Path(record['attempts'][0]['stdout']).read_text() == 'partial\n'
        assert result.stderr == Path(record['attempts'][0]['stderr']).read_text() == 'partial-error\n'
        passed('running deadline stops own process and preserves partial stdout stderr')

        p = window(directory, 'failed')
        _, record = run(p, "import sys; print('diagnostic',file=sys.stderr); sys.exit(7)", 7)
        assert record['status'] == 'failed' and record['attempts'][0]['exitCode'] == 7
        _, after = run(p, command, 2)
        assert not marker.exists() and after == record
        passed('child failure remains explicit and cannot silently restart the window')

        p = window(directory, 'busy')
        ready = directory / 'child-live'
        program = f"from pathlib import Path; import time; Path({str(ready)!r}).write_text('live'); time.sleep(0.6)"
        process = subprocess.Popen([sys.executable, str(GUARD), str(p), '--', sys.executable, '-u', '-c', program], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        until = time.monotonic() + 2
        while not ready.exists() and time.monotonic() < until:
            time.sleep(0.01)
        assert ready.exists() and process.poll() is None
        blocked, _ = run(p, command, 2)
        assert 'WORK_WINDOW_BUSY' in blocked.stderr and not marker.exists()
        process.communicate(timeout=2)
        assert process.returncode == 0 and len(json.loads(p.read_text())['attempts']) == 1
        passed('kernel lock refuses concurrent duplicate command')

        p = window(directory, 'stale', status='running')
        _, record = run(p, command, 2)
        assert not marker.exists() and record['status'] == 'running' and not record['attempts']
        passed('unresolved running receipt fails closed without assuming the job stopped')

        p = window(directory, 'descendant', seconds=0.35)
        child = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('grandchild',flush=True); time.sleep(10)"
        program = f"import subprocess,sys; subprocess.Popen([sys.executable,'-u','-c',{child!r}]); print('leader-exit',flush=True)"
        result, record = run(p, program, 124)
        assert 'leader-exit' in result.stdout and 'grandchild' in result.stdout
        assert record['status'] == 'expired'
        passed('deadline kills remaining process group after leader exits')

        p = window(directory, 'existing-evidence')
        old = p.with_name(p.stem + '.attempt-1.stdout.log')
        old.write_text('historical evidence')
        result = subprocess.run([sys.executable, str(GUARD), str(p), '--', sys.executable, '-c', command], capture_output=True, text=True)
        assert result.returncode != 0 and 'WORK_WINDOW_EVIDENCE_ALREADY_EXISTS' in result.stderr
        assert old.read_text() == 'historical evidence' and not marker.exists()
        assert json.loads(p.read_text())['attempts'] == []
        passed('existing evidence is never overwritten or treated as a new attempt')

        p = window(directory, 'missing-executable')
        result = subprocess.run([sys.executable, str(GUARD), str(p), '--', str(directory / 'no-such-command')], capture_output=True, text=True)
        record = json.loads(p.read_text())
        assert result.returncode == 127 and record['status'] == 'failed'
        assert record['attempts'][0]['status'] == 'launch-failed'
        passed('command launch failure is persisted and returned')

        p = window(directory, 'wrong-schema')
        record = json.loads(p.read_text()); record['schemaVersion'] = 'seti-bounded-route-admission-v1'; p.write_text(json.dumps(record))
        result = subprocess.run([sys.executable, str(GUARD), str(p), '--', sys.executable, '-c', command], capture_output=True, text=True)
        assert result.returncode != 0 and 'WORK_WINDOW_SCHEMA_INVALID' in result.stderr
        assert not marker.exists() and not json.loads(p.read_text())['attempts']
        passed('historical frozen route cannot be mistaken for a fresh work window')
except Exception as error:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({'passed': False, 'completedControls': rows, 'error': repr(error)}, indent=2) + '\n')
    raise

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps({'passed': True, 'controls': rows,
    'guardSha256': hashlib.sha256(GUARD.read_bytes()).hexdigest(),
    'verificationSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'scope': 'Command wall-clock enforcement only; not agent reasoning or AI policy quality',
    'newAISearches': 0, 'newNativeInputs': 0, 'newAutonomousGames': 0}, indent=2) + '\n')
print('SUMMARY controls passed=' + str(len(rows)) + ' failed=0', flush=True)
