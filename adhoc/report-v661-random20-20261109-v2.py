from html import escape
from os.path import relpath
from pathlib import Path
from statistics import mean, median
import json
import sys

source, output = map(Path, sys.argv[1:3])
data = json.loads(source.read_text())
rows = data["rows"]
original = [r for r in rows if r["terminal"]]
assert len(rows) == 20 and len(original) == 17
assert all([e["round"] for e in r["ends"]] == [1, 2, 3, 4] for r in rows)
assert all(r["nativeStateSessionRngExact"] for r in rows)

def final(row):
    return row["score"] if row["terminal"] else row["repair"]["score"]

def table(headers, items):
    head = "".join(f'<th scope="col">{h}</th>' for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in item) + "</tr>" for item in items)
    return f'<div class="scroll"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'

income_keys = ("credits", "energy", "availableData", "handSize", "additionalPublicScan", "publicity")
reserve_keys = ("credits", "energy", "availableData", "handSize", "publicity")
def assets(obj, keys, formatter=str):
    return " / ".join(formatter(obj[k]) for k in keys)

scores = [final(r) for r in rows]
base = [final(r) for r in original]
repairs = [r for r in rows if not r["terminal"]]
ends = [[r["ends"][i] for r in rows] for i in range(4)]
original_ends = [[r["ends"][i] for r in original] for i in range(4)]
m = [mean(x["score"] for x in e) for e in ends]
m_original = [mean(x["score"] for x in e) for e in original_ends]
bonus = mean(final(r) - r["ends"][-1]["score"] for r in rows)

bins = [(a, a + 19, sum(a <= final(r) < a + 20 for r in original),
         sum(a <= final(r) < a + 20 for r in repairs)) for a in range(70, 170, 20)]
assert sum(b + c for _, _, b, c in bins) == len(rows)
bars = []
for i, (lo, hi, n, k) in enumerate(bins):
    x, h, tail = 56 + i * 103, 19 * n, 19 * k
    bars.append(f'<rect x="{x}" y="{168-h}" width="60" height="{h}" fill="#287487"/>'
                f'<rect x="{x}" y="{168-h-tail}" width="60" height="{tail}" fill="#aa6018"/>'
                f'<text x="{x+30}" y="{159-h-tail}" text-anchor="middle">{n+k}</text>'
                f'<text x="{x+30}" y="191" text-anchor="middle">{lo}–{hi}</text>')
px = (65, 210, 355, 500)
py = [170 - 1.35 * value for value in m]
curve = " ".join(f"{x},{y:.1f}" for x, y in zip(px, py))
points = "".join(f'<circle cx="{x}" cy="{y:.1f}" r="5" fill="#287487"/>'
                 f'<text x="{x}" y="{y-13:.1f}" text-anchor="middle">{v:.1f}</text>'
                 f'<text x="{x}" y="191" text-anchor="middle">第{i}轮</text>'
                 for i, (x, y, v) in enumerate(zip(px, py, m), 1))

def mean_assets(ends, field, keys):
    return " / ".join(f"{mean(e[field][key] for e in ends):.1f}" for key in keys)

def row_score(v):
    return f"{v:.1f}".removesuffix(".0")

round_table = table(
    ("阶段", "盘面均分<br>原17局", "盘面均分<br>含续跑20局", "较上轮增分<br>20局", "中位数／范围<br>20局",
     "科技数<br>均值", "永久收入<br>均值", "资源库存<br>均值"),
    [(f"第{i+1}轮", f"{m_original[i]:.1f}", f"{m[i]:.1f}", "—" if i == 0 else f"+{m[i]-m[i-1]:.1f}",
      f'{row_score(median(x["score"] for x in group))}／{min(x["score"] for x in group)}–{max(x["score"] for x in group)}',
      f'{mean(x["tech"] for x in group):.1f}', mean_assets(group, "income", income_keys),
      mean_assets(group, "reserve", reserve_keys)) for i, group in enumerate(ends)]
)

details = []
for r in rows:
    log = Path(r["record"]).name.removesuffix(".json") + ".action-log.html"
    assert (output.parent / log).is_file()
    status = "原始完赛" if r["terminal"] else f'第{r["failedRound"]}轮中断后续跑'
    tail = r.get("repair")
    runtime = f'{r["wallMs"]/1000:.2f}' if not tail else f'{r["wallMs"]/1000:.2f} + {tail["wallMs"]/1000:.2f}'
    over = str(r["overBudget"]) if not tail else f'{r["overBudget"]} + {tail["over"]}'
    details.append((f'<a href="#board-{r["number"]:02}">{r["number"]:02}</a>',
        *(e["score"] for e in r["ends"]), f'<strong>{final(r)}</strong>',
        final(r) - r["ends"][-1]["score"], runtime, over,
        f'{status} · <a href="{escape(log)}">{"原始前缀" if tail else "逐行动复盘"}</a>'))
board_table = table(("盘面", "R1", "R2", "R3", "R4", "终局", "终局加分", "耗时（秒）", "单点超线", "结果／回放"), details)

drilldowns = "".join(
    f'<details id="board-{r["number"]:02}"><summary>盘面 {r["number"]:02} · {final(r)} 分</summary>'
    + table(("轮次", "盘面分", "科技数", "永久收入", "资源库存"),
            [(e["round"], e["score"], e["tech"], assets(e["income"], income_keys),
              assets(e["reserve"], reserve_keys)) for e in r["ends"]])
    + "</details>" for r in rows
)

style = """
*{box-sizing:border-box}body{margin:0;background:#f2f6f6;color:#172f37;font:16px/1.55 system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:1.6rem 1rem}h1{line-height:1.2;font-size:clamp(1.65rem,4vw,2.55rem)}
h2{font-size:1.18rem;margin:0 0 .6rem}p{margin:.45rem 0 .85rem}
section,.metric{background:#fff;border:1px solid #d5e2e4;border-radius:12px;padding:1rem;margin-bottom:1rem}
.cards,.charts{display:grid;gap:1rem}.cards{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.charts{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
.metric b{display:block;color:#175d6f;font-size:1.6rem}.muted{color:#496069;font-size:.92rem}
svg{width:100%;font-size:14px;fill:#263c43}a{color:#0d6069}.swatch{display:inline-block;width:.8rem;height:.8rem;border-radius:2px}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{text-align:right;padding:.38rem .5rem;border-bottom:1px solid #e1e9e9;white-space:nowrap}
th:first-child,td:first-child,th:last-child,td:last-child{text-align:left}
details{padding:.32rem .25rem;border-bottom:1px solid #e1e9e9}summary{cursor:pointer}
"""

content = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SETI V661 · 20 局免电分析汇总</title><style>{style}</style></head><body><main>
<h1>V661 · 20 局免电分析汇总</h1>
<p>白席使用同一套 V661 策略，自主操作深空探测；另外三席只 PASS 和处理强制选择。使用此前生成的 20 个盘面。</p>
<div class="cards"><div class="metric">原始完赛<b>17 / 20</b>均分 {mean(base):.1f} · 中位 {row_score(median(base))}</div>
<div class="metric">计入修复续跑<b>20 / 20</b>均分 {mean(scores):.1f} · 中位 {row_score(median(scores))}</div>
<div class="metric">终局分数范围<b>{min(scores)}–{max(scores)}</b>08 号最低 · 06 号最高</div>
<div class="metric">原始完赛耗时<b>{min(r['wallMs'] for r in original)/1000:.2f}–{max(r['wallMs'] for r in original)/1000:.2f} 秒</b>17 局均低于 3 分钟</div></div>
<div class="charts"><section><h2>终局得分分布</h2><svg viewBox="0 0 560 200" role="img" aria-label="终局得分区间和局数">
<path d="M45 168H550" stroke="#bacacc"/>{''.join(bars)}</svg>
<p class="muted"><span class="swatch" style="background:#287487"></span> 原始完赛 · <span class="swatch" style="background:#aa6018"></span> 修复后续跑</p></section>
<section><h2>各轮平均盘面分 · 20 局</h2><svg viewBox="0 0 560 200" role="img" aria-label="第1至4轮的平均盘面分">
<path d="M40 170H530" stroke="#bacacc"/><polyline points="{curve}" fill="none" stroke="#287487" stroke-width="3"/>{points}</svg>
<p class="muted">第 4 轮盘面均分 {m[-1]:.1f}。终局结算另加 {bonus:.1f} 分。</p></section></div>
<section><h2>逐轮进展</h2><p>取白席本轮 PASS 前的快照，PASS 选牌和下一轮收入不计入本轮。第 4 轮盘面分也不含终局加分。</p>
<p class="muted">永久收入顺序：钱 / 电 / 数据 / 手牌 / 额外公开扫描 / 宣传。库存顺序：钱 / 电 / 数据 / 手牌 / 宣传。科技数按已拥有的不同科技统计。</p>{round_table}</section>
<section><h2>20 个盘面明细</h2><p>06 号第二轮只有 14 分，之后两轮分别拿了 57、41 分，最终第一（159 分）。08 号第三、四轮均为 50 分，最终 77 分。</p>
<p class="muted">04、05、13 从失败存档在修复规则后继续，终局分为 141、135、97。两段耗时和超线次数分别列出。单点超线指一次决策超过 256 个原生输入或 600 毫秒。</p>{board_table}</section>
<section><h2>各盘面轮末资产</h2><p class="muted">永久收入和资源库存的顺序与上表一致。</p>{drilldowns}</section>
<section><h2>来源与核验</h2><p>原始 20 局尝试累计 {sum(r["overBudget"] for r in rows)} 次单点超线。3 局续跑另有 {sum(r["repair"]["over"] for r in repairs)} 次。原始行动全部经原生回放校验；续跑的新增轮末快照从已保存的合法行动重放提取，终局状态和随机数与续跑存档一致。</p>
<p><a href="{escape(relpath(source, output.parent))}">逐轮数据 JSON</a> · <a href="summary-20261109-v1.html">原批次汇总</a> · <a href="../../{escape(data["verified"].removeprefix("reports/"))}">原始核验</a> · <a href="../../{escape(data["repaired"].removeprefix("reports/"))}">修复核验</a> · <a href="../../robot-iteration.html?ai=v2">V2 实验中心</a></p></section>
</main></body></html>
"""
output.write_text(content, encoding="utf-8")
