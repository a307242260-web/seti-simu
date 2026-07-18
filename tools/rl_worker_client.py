#!/usr/bin/env python3
"""Minimal stdlib Python client for the persistent SETI Node worker server."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "seti-rl-ipc-v1"


class WorkerProtocolError(RuntimeError):
    def __init__(self, error: dict[str, Any]):
        super().__init__(f"{error.get('code', 'unknown')}: {error.get('message', 'IPC failed')}")
        self.code = error.get("code")
        self.details = error.get("details")


class SetiWorkerClient:
    def __init__(self, workers: int = 1, timeout_ms: int = 120_000):
        root = Path(__file__).resolve().parents[1]
        self.process = subprocess.Popen(
            [
                "node",
                str(root / "tools" / "run_rl_worker_server.js"),
                "--workers",
                str(workers),
                "--timeout-ms",
                str(timeout_ms),
            ],
            cwd=root,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            text=True,
            bufsize=1,
        )
        self._request_id = 0

    def request(self, operation: str, payload: dict[str, Any] | None = None) -> Any:
        self._request_id += 1
        request = {
            "schemaVersion": SCHEMA_VERSION,
            "requestId": self._request_id,
            "operation": operation,
            "payload": payload or {},
        }
        assert self.process.stdin is not None
        assert self.process.stdout is not None
        self.process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
        self.process.stdin.flush()
        response = json.loads(self.process.stdout.readline())
        if response.get("schemaVersion") != SCHEMA_VERSION:
            raise RuntimeError(f"response schema mismatch: {response.get('schemaVersion')}")
        if not response.get("ok"):
            raise WorkerProtocolError(response.get("error") or {})
        return response.get("result")

    def worker_request(self, worker_id: int, operation: str, payload: dict[str, Any] | None = None) -> Any:
        return self.request(
            "worker_request",
            {"workerId": worker_id, "operation": operation, "payload": payload or {}},
        )

    def batch(self, requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self.request("batch", {"requests": requests})

    def close(self) -> None:
        if self.process.poll() is not None:
            return
        try:
            self.request("shutdown")
        finally:
            if self.process.stdin:
                self.process.stdin.close()
            self.process.wait(timeout=10)

    def __enter__(self) -> "SetiWorkerClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


def choose_fast_action(actions: list[dict[str, Any]]) -> dict[str, Any]:
    return next(
        (action for action in actions if action.get("family") in {"pass", "end_turn"}),
        actions[0],
    )


def smoke(workers: int, episodes: int) -> dict[str, Any]:
    completed = 0
    illegal = 0
    with SetiWorkerClient(workers=workers) as client:
        info = client.request("server_info")
        for start in range(0, episodes, workers):
            active = list(range(min(workers, episodes - start)))
            reset_results = client.batch([
                {
                    "workerId": worker_id,
                    "operation": "reset",
                    "payload": {
                        "config": {
                            "seed": f"python-ipc-smoke:{start + worker_id}",
                            "activePlayerCount": 4,
                            "episodeId": f"smoke-{start + worker_id}",
                            "policyVersion": "python-fast-v1",
                            "opponentIdentity": "self-play",
                            "seat": "all",
                        }
                    },
                }
                for worker_id in active
            ])
            states = {item["workerId"]: item["result"] for item in reset_results if item["ok"]}
            for _ in range(100):
                pending = [worker_id for worker_id, state in states.items() if not state["terminal"]]
                if not pending:
                    break
                actions = {worker_id: choose_fast_action(states[worker_id]["legalActions"]) for worker_id in pending}
                stepped = client.batch([
                    {
                        "workerId": worker_id,
                        "operation": "step",
                        "payload": {"action": actions[worker_id]},
                    }
                    for worker_id in pending
                ])
                for item in stepped:
                    if not item["ok"]:
                        illegal += int(item["error"]["code"] == "illegal_action")
                        raise WorkerProtocolError(item["error"])
                    states[item["workerId"]] = {
                        "observation": item["result"]["observation"],
                        "legalActions": item["result"]["legalActions"],
                        "terminal": item["result"]["done"],
                    }
            if not all(state["terminal"] for state in states.values()):
                raise RuntimeError("episode did not finish within 100 decisions")
            artifacts = []
            for operation in ("replay", "checkpoint"):
                artifacts.extend(client.batch([
                    {"workerId": worker_id, "operation": operation, "payload": {}}
                    for worker_id in active
                ]))
            if not all(item["ok"] for item in artifacts):
                raise WorkerProtocolError(next(item["error"] for item in artifacts if not item["ok"]))
            for item in artifacts:
                expected_episode = f"smoke-{start + item['workerId']}"
                actual_episode = item["result"].get("episodeMetadata", {}).get("episodeId")
                if actual_episode != expected_episode:
                    raise RuntimeError(f"artifact episode mismatch: {actual_episode} != {expected_episode}")
            completed += len(states)
            print(f"[rl-worker-smoke] completed={completed}/{episodes} illegal={illegal}", file=sys.stderr, flush=True)
        return {"server": info, "episodes": completed, "illegalActions": illegal, "ok": completed == episodes}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--episodes", type=int, default=1)
    args = parser.parse_args()
    print(json.dumps(smoke(args.workers, args.episodes), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
