import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "assets/cards/card_model.json"
OUTPUT = ROOT / "randomizer/game/card-catalog.js"


def main() -> None:
    catalog = json.loads(MODEL.read_text(encoding="utf-8"))
    body = (
        '(function (root) {\n'
        '  "use strict";\n'
        f"  root.SetiCardCatalog = Object.freeze({json.dumps(catalog, ensure_ascii=False)});\n"
        '})(typeof globalThis !== "undefined" ? globalThis : window);\n'
    )
    OUTPUT.write_text(body, encoding="utf-8")
    print(f"wrote {OUTPUT} ({len(catalog)} cards)")


if __name__ == "__main__":
    main()
