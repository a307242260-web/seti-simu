#!/usr/bin/env python3
"""Package the standalone SETI browser build into a zip archive."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_DIRS = ("assets", "randomizer")
ARCHIVE_PREFIX = "seti单机版"


def timestamped_name(now: datetime | None = None) -> str:
    value = now or datetime.now()
    return f"{ARCHIVE_PREFIX}_{value:%Y%m%d_%H%M%S}.zip"


def iter_package_files(target: Path) -> list[Path]:
    files: list[Path] = []
    target = target.resolve()

    for directory_name in PACKAGE_DIRS:
        directory = ROOT / directory_name
        if not directory.is_dir():
            raise FileNotFoundError(f"Required package directory not found: {directory}")
        for path in directory.rglob("*"):
            if path.is_file() and path.resolve() != target:
                files.append(path)

    return sorted(files, key=lambda path: path.relative_to(ROOT).as_posix())


def build_archive(output_dir: Path) -> Path:
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / timestamped_name()
    files = iter_package_files(archive_path)

    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())

    return archive_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Package assets/ and randomizer/ into seti单机版_日期_时间.zip.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT,
        help="directory for the generated zip archive; defaults to the repo root",
    )
    args = parser.parse_args()

    archive_path = build_archive(args.output_dir)
    print(f"wrote {archive_path}")


if __name__ == "__main__":
    main()
