# 第573步取证保存失败（2026-09-08）

首次脚本将researchOutcomes全部叶的重复观察整体JSON.stringify，最终保存时抛出
RangeError: Invalid string length（Node v22.22.0），进程退出1，未落可用JSON。
这是诊断序列化失败；没有可核对的搜索结果，不宣称单点通过，也不计为正式规则失败。
修正为逐叶保留估值、动作链与研究身份，不保存重复的完整叶观察，再执行单点取证。
不是完整局重跑。已有完整局cb456d23.04648dd1.full.json保持不变。
