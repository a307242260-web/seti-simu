# 存档复盘与迁移指南

> 目标：旧版浏览器存档（`seti-browser-save-v2`）与当前内核规则不一致时，如何
> **迁移成当前内核完全兼容的新存档**，以及如何用存档复盘当时情景。
> 2026-08-17 用户确认流程：读档续玩不丢历史、迁移后从零可完美复现、任意时间点可重新接入。

## 1. 旧档不兼容的两个真实原因

老存档是旧版规则录制的，与当前内核有两类差异：

1. **PASS 冗余 end_turn**（`mechanics-reference.md` 261 行）：当前内核 PASS 链
   结算后**自动结束回合**，老档里 PASS 后多出一个 end_turn 动作——迁移时跳过
   （每轮每玩家 1 处，全程约 15-21 处）。
2. **扫描流扇区结算时机**（P13）：老档**逐节点结算**扇区（扫描 → 选扇区 →
   立即痕迹/盲抽奖励）；当前内核**串尾 `SCAN_FINALIZE` 统一 SETTLE**（扫描 →
   选扇区 → [公共牌/移动/天狼星] → SETTLE 痕迹/盲抽 → 公共牌补牌）。

**关键**：扫描流的补牌时机影响 RNG 消费顺序。当前内核必须**先 SETTLE（痕迹盲抽）
再补公共牌**（`SCAN_FINALIZE` 的 spawnedEffects 顺序 = `SETTLE → PUBLIC_REFILL`），
否则盲抽结果错位、手牌与老档不一致。该顺序已作为内核行为固定（2026-08-17 修复）。

其他（卡牌 id、初始选择、收入、盲抽等）经核验与当前目录一致，无规则演变。

## 2. 三档拼接迁移（v47 + v54 + v223 = 537 步完整局）

`seti-saves/seti-save-重打R2末-v47.json`（110 步，从初始选择开始）+
`seti-saves/seti-save-无法登陆-v54.json`（14 步）+ `seti-saves/seti-save-终局未结算-v223.json`
（415 步）是同一局的三段存档（v54 step12/13 与 v223 step0 同动作去重），拼接 = 537 步。

迁移工具：`tools/migrate_537_full_chain.js`（专用脚本，只针对这一局）：

```bash
node tools/migrate_537_full_chain.js
```

流程：

1. 拼接三档 replaySteps（去重跨档重复动作），共 537 步。
2. 初始选择段（#0-16）由补齐逻辑处理：白色固定选 **深空探测**（公司）+ 初始牌
   1（天狼星A扫描两次）+ 初始牌 21（木星环绕器），其余三家宽松取第一可用项；
   初始收入弃牌（#17-22）严格顺序消费。
3. #23 起用**老档动作池**（remaining 集合）驱动当前内核：当前内核弹出一个决策，
   按老档顺序从池中找第一个能匹配的动作消费；**乱序只发生在同扫描流内**
   （当前内核 SETTLE 在流尾），RNG 严格按当前内核决策顺序消费。
4. 适配：PASS 冗余 end_turn 跳过；可选效果"跳过 X"（f9c9827 后不再弹窗）跳过。
5. 输出新存档 `seti-saves/seti-save-537-merged.json`（516 步，因跳过 21 处 end_turn）。
6. 自校验：新存档从头 fast_forward 复现 516/516 步，终局状态与 v223 旧档
   逐玩家一致（白色 249 分、钱/能全对齐）。

## 3. 复盘方法

新存档（或任何 `seti-browser-save-v2`）可用以下工具复盘：

| 工具 | 用途 |
|------|------|
| `tools/fast_forward_save.js <存档>` | 从头快进复现（纯内核重放，~4s/516 步），打印各阶段状态 |
| `tools/fast_forward_save.js <存档> --step N` | 快进到第 N 步 |
| `tools/fast_forward_save.js <存档> --round N` | 快进到第 N 轮 |
| `tools/fast_forward_save.js <存档> --aliens` | 只追踪外星人状态变化 |
| `tools/load_save_simulation.js <存档> --run-ai` | 读档后让 AI 打完 |
| `tools/load_save_simulation.js <存档> --decide N` | 读档后 AI 决策 N 步 |
| `tools/load_save_simulation.js <存档> --history <轮>` | 打印某轮逐行动历史 |

读档续玩（重新接入）：`load_save_simulation.js` 会把存档的浏览器格式历史
（`browserReplaySteps`）保留进恢复后的 env，续玩后再存盘，replaySteps =
**历史（开局→读档点）+ 新步骤**，完整不丢（见 `docs/rl-simulation-env.md`）。

## 4. 旧档缺失的部分（迁移时补齐）

- **初始选择**（公司 + 初始牌）：老档前三段未记录完整初始选择，迁移时白色固定
  深空探测 + 初始 1/21，其他宽松。
- **PASS 冗余 end_turn**：当前内核自动结束回合，老档多出的 end_turn 直接跳过。

## 5. 已确认一致的项（无需适配）

- 卡牌 id：普通（`b_*.webp`/`dlc_*.png`）、外星（`alien-amiba-0-1` 等）、
  初始（`initial:N`）、PASS（`pass-1-2`）与当前目录完全一致。
- 初始收入弃牌、收入/盲抽/精选流程、外星人痕迹与揭示、扇区/星云结构。

## 6. 相关提交

- 2026-08-17：`SCAN_FINALIZE` spawnedEffects 顺序 = `SETTLE → PUBLIC_REFILL`
  （先痕迹盲抽再补公共牌）；公共牌 done 分支与 resolveScanStep 不再单独补牌。
- 2026-08-17：哨兵快照 `snapshotPlayedCard` 排除外星卡（否则保留型外星卡打出时
  id 同时进 reservedCards 与 industryLastPlayedCardThisRound，触发
  `STATE_ALIEN_ENTITY_SEQUENCE_DUPLICATE`）。
- 2026-08-17：`tools/migrate_537_full_chain.js` 三档拼接迁移工具。
