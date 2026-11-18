"""Run one command under an existing, non-renewing research wall-clock window."""
import fcntl
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time


def save(path, record):
    temporary = path.with_name(path.name + '.writing-' + str(os.getpid()))
    temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    os.replace(temporary, path)


def pump(stream, output, logfile, errors):
    try:
        with logfile.open('xb') as target:
            while True:
                block = stream.read1(65536)
                if not block:
                    break
                target.write(block)
                target.flush()
                output.buffer.write(block)
                output.buffer.flush()
    except Exception as error:
        errors.append(str(error))


def terminate_group(child):
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        child.wait(timeout=0.5)
    except subprocess.TimeoutExpired:
        pass
    # The group can still contain a grandchild after its leader has exited.
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    child.wait()


def main(arguments):
    if len(arguments) < 3 or arguments[1] != '--':
        raise ValueError('usage: guard.py checkpoint.json -- command [arguments]')
    path = Path(arguments[0]).resolve()
    with path.with_name(path.name + '.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('WORK_WINDOW_BUSY: an existing guard holds the lock', file=sys.stderr)
            return 2
        record = json.loads(path.read_text())
        if record['schemaVersion'] != 'seti-research-wall-window-v1':
            raise ValueError('WORK_WINDOW_SCHEMA_INVALID')
        start, deadline = record['startedEpochSeconds'], record['deadlineEpochSeconds']
        if not all(isinstance(x, (int, float)) and not isinstance(x, bool)
                   and math.isfinite(x) for x in [start, deadline]) or deadline <= start:
            raise ValueError('WORK_WINDOW_DEADLINE_INVALID')
        now = time.time()
        if now < start:
            raise ValueError('WORK_WINDOW_CLOCK_BEFORE_START')
        if record['status'] != 'open':
            print('WORK_WINDOW_CLOSED: ' + record['status'], file=sys.stderr)
            return 2
        if now >= deadline:
            record.update(status='expired', observedEpochSeconds=now)
            save(path, record)
            print('WORK_WINDOW_EXPIRED: command not started', file=sys.stderr)
            return 124
        command = arguments[2:]
        attempt = {'command': command, 'startedEpochSeconds': now, 'status': 'starting'}
        number = len(record['attempts']) + 1
        prefix = path.with_name(path.stem + '.attempt-' + str(number))
        stdout = prefix.with_name(prefix.name + '.stdout.log')
        stderr = prefix.with_name(prefix.name + '.stderr.log')
        if stdout.exists() or stderr.exists():
            raise ValueError('WORK_WINDOW_EVIDENCE_ALREADY_EXISTS')
        attempt.update(stdout=str(stdout), stderr=str(stderr))
        record['attempts'].append(attempt)
        record['status'] = 'running'
        save(path, record)
        try:
            if time.time() >= deadline:
                attempt.update(status='not-started', exitCode=124)
                record['status'] = 'expired'
                save(path, record)
                return 124
            child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     start_new_session=True)
        except OSError as error:
            attempt.update(status='launch-failed', error=str(error), exitCode=127)
            record['status'] = 'failed'
            save(path, record)
            print('WORK_WINDOW_LAUNCH_FAILED: ' + str(error), file=sys.stderr)
            return 127
        attempt.update(status='running', pid=child.pid)
        save(path, record)
        capture_errors = []
        threads = [threading.Thread(target=pump, args=(*args, capture_errors)) for args in
                   [(child.stdout, sys.stdout, stdout), (child.stderr, sys.stderr, stderr)]]
        for thread in threads:
            thread.start()
        try:
            code = child.wait(timeout=max(0, deadline - time.time()))
        except subprocess.TimeoutExpired:
            terminate_group(child)
            code = 124
        except KeyboardInterrupt:
            terminate_group(child)
            code = 130
        # A child that leaves inherited output pipes open has not completed the
        # guarded work. Wait only to the original deadline, then stop its group.
        for thread in threads:
            thread.join(timeout=max(0, deadline - time.time()))
        if any(thread.is_alive() for thread in threads):
            terminate_group(child)
            code = 124
        for thread in threads:
            thread.join()
        if capture_errors:
            code = 74
            attempt['captureErrors'] = capture_errors
        ended = time.time()
        attempt.update(status='finished' if code == 0 else 'failed', exitCode=code,
                       childExitCode=child.returncode, endedEpochSeconds=ended)
        record['status'] = ('expired' if code == 124 or ended >= deadline else
                            'open' if code == 0 else 'failed')
        save(path, record)
        return code if code >= 0 else 128 - code


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
