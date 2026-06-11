#!/usr/bin/env python3
"""Batch split symbol icons and basic card sprite sheets."""

from __future__ import annotations

from pathlib import Path

from split_card_sheet import split_sheet

ROOT = Path(__file__).resolve().parents[1]
SYMBOL_ROWS, SYMBOL_COLS = 7, 5
BASIC_ROWS, BASIC_COLS = 7, 10
BASIC_TILES_PER_SHEET = BASIC_ROWS * BASIC_COLS
SPACE_AGENCY_ROWS, SPACE_AGENCY_COLS = 6, 7


def split_symbols() -> None:
    symbol_dir = ROOT / "assets" / "symbol"
    split_root = symbol_dir / "split"

    for source in sorted(symbol_dir.glob("*.webp")):
        if source.parent.name == "split":
            continue
        output_dir = split_root / source.stem
        split_sheet(
            source,
            output_dir,
            rows=SYMBOL_ROWS,
            cols=SYMBOL_COLS,
            fmt="webp",
        )


def split_basic_cards() -> None:
    basic_dir = ROOT / "assets" / "cards" / "basic"
    output_dir = basic_dir / "split"
    start_index = 1

    for source in sorted(basic_dir.glob("*.png")):
        if source.parent.name == "split":
            continue
        split_sheet(
            source,
            output_dir,
            rows=BASIC_ROWS,
            cols=BASIC_COLS,
            fmt="webp",
            start_index=start_index,
            name_template="b_{index}",
        )
        start_index += BASIC_TILES_PER_SHEET


def split_space_agency_cards() -> None:
    agency_dir = ROOT / "assets" / "cards" / "space-agency"
    output_dir = agency_dir / "split"
    source = agency_dir / "6x7.png"
    if not source.exists():
        print(f"Skip space-agency: {source.name} not found")
        return

    split_sheet(
        source,
        output_dir,
        rows=SPACE_AGENCY_ROWS,
        cols=SPACE_AGENCY_COLS,
        fmt="png",
        name_template="dlc_{index}",
    )

    expected = SPACE_AGENCY_ROWS * SPACE_AGENCY_COLS
    for stale in output_dir.glob("dlc_*.png"):
        if int(stale.stem.split("_")[1]) > expected:
            stale.unlink()


def main() -> None:
    split_symbols()
    split_basic_cards()
    split_space_agency_cards()
    print("Done.")


if __name__ == "__main__":
    main()
