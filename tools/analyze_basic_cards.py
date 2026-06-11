import argparse
import csv
import re
from pathlib import Path

import cv2
import easyocr
import numpy as np
from PIL import Image


HEADERS = [
    "卡牌编号",
    "卡牌名称",
    "卡牌价格",
    "左上角符号颜色",
    "卡牌右上角颜色",
    "右下及底部线条颜色",
]

NAME_CORRECTIONS = {
    "dlc_13.png": "詹姆斯·克拉克·麦克斯韦望远镜",
    "dlc_21.png": "轨道加注",
    "dlc_26.png": "新型AI模型",
    "dlc_36.png": "大耳朵射电望远镜",
    "dlc_41.png": "系外行星巡天",
}


def numeric_key(path: Path) -> int:
    match = re.search(r"\d+", path.stem)
    return int(match.group()) if match else 0


def patch_hsv(image: Image.Image, x: int, y: int, radius: int = 5) -> tuple[int, int, int]:
    patch = np.array(image.crop((x - radius, y - radius, x + radius + 1, y + radius + 1)).convert("RGB"))
    median_rgb = np.median(patch.reshape(-1, 3), axis=0).astype(np.uint8)
    hsv = cv2.cvtColor(np.uint8([[median_rgb]]), cv2.COLOR_RGB2HSV)[0, 0]
    return int(hsv[0]), int(hsv[1]), int(hsv[2])


def classify_basic_color(hsv: tuple[int, int, int]) -> str:
    h, s, v = hsv
    if v < 80 and s < 90:
        return "黑"
    if s < 80:
        return "灰"
    if h < 12 or h > 165:
        return "红"
    if 85 <= h <= 125:
        return "蓝"
    if 18 <= h <= 42:
        return "黄"
    if 43 <= h <= 90:
        return "绿"
    return "灰"


def majority(items: list[str]) -> str:
    counts: dict[str, int] = {}
    for item in items:
        counts[item] = counts.get(item, 0) + 1
    return max(counts, key=counts.get)


def classify_top_left_symbol(image: Image.Image) -> str:
    # This point sits inside the symbol body for red/blue cards, and inside the
    # pale gray insert for gray cards.
    color = classify_basic_color(patch_hsv(image, 118, 66))
    return color if color in {"红", "蓝"} else "灰"


def classify_top_right(image: Image.Image) -> str:
    votes = [
        classify_basic_color(patch_hsv(image, 635, 20)),
        classify_basic_color(patch_hsv(image, 690, 15)),
        classify_basic_color(patch_hsv(image, 725, 115)),
    ]
    color = majority(votes)
    return color if color in {"蓝", "红", "黄", "黑"} else "黑"


def classify_bottom_line(image: Image.Image) -> str:
    width, height = image.size
    votes = [
        classify_basic_color(patch_hsv(image, width - 150, height - 25)),
        classify_basic_color(patch_hsv(image, width - 100, height - 55)),
        classify_basic_color(patch_hsv(image, width - 60, height - 75)),
        classify_basic_color(patch_hsv(image, width - 40, height - 35)),
    ]
    colored_votes = [vote for vote in votes if vote in {"黄", "绿"}]
    color = majority(colored_votes) if colored_votes else "灰"
    return color if color in {"黄", "绿"} else "灰"


def read_text(reader: easyocr.Reader, image: Image.Image, box: tuple[int, int, int, int]) -> str:
    crop = image.crop(box)
    crop = crop.resize((crop.width * 3, crop.height * 3))
    result = reader.readtext(np.array(crop), detail=0, paragraph=False)
    return "".join(result).strip()


def read_price(reader: easyocr.Reader, image: Image.Image) -> str:
    crop = image.crop((0, 430, 80, 520))
    for scale in (4, 3, 5, 6):
        scaled = crop.resize((crop.width * scale, crop.height * scale))
        result = reader.readtext(np.array(scaled), detail=0, paragraph=False, allowlist="01234")
        joined = "".join(result)
        match = re.search(r"[0-4]", joined)
        if match:
            return match.group(0)
    return ""


def analyze_card(reader: easyocr.Reader, path: Path) -> dict[str, str]:
    image = Image.open(path).convert("RGB")
    name = read_text(reader, image, (290, 455, 747, 540))
    name = NAME_CORRECTIONS.get(path.name, name)
    return {
        "卡牌编号": path.name,
        "卡牌名称": name,
        "卡牌价格": read_price(reader, image),
        "左上角符号颜色": classify_top_left_symbol(image),
        "卡牌右上角颜色": classify_top_right(image),
        "右下及底部线条颜色": classify_bottom_line(image),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze SETI basic card images into a CSV table.")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("assets/cards/basic/split"),
        help="Directory containing split card .webp files.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/cards/basic/split_analysis_sample10.csv"),
        help="CSV output path.",
    )
    parser.add_argument("--limit", type=int, default=10, help="Number of cards to process. Use 0 for all.")
    parser.add_argument("--skip", type=int, default=0, help="Number of sorted cards to skip before processing.")
    args = parser.parse_args()

    image_extensions = {".webp", ".png", ".jpg", ".jpeg"}
    files = sorted(
        [path for path in args.input_dir.iterdir() if path.suffix.lower() in image_extensions],
        key=numeric_key,
    )
    if args.skip:
        files = files[args.skip :]
    if args.limit:
        files = files[: args.limit]

    reader = easyocr.Reader(["ch_sim", "en"], gpu=False, verbose=False)
    rows = [analyze_card(reader, path) for path in files]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8-sig", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
