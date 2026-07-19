# SETI-39 首轮训练与冻结评测证据

## 结论

`heuristic demonstrations -> BC/value warm start -> legal-action masked PPO` 首轮闭环通过验收。BC-init 在 seed 7/19/31 三个独立训练 RNG 上，早期 AUC 与同预算训练外最终得分均稳定优于 random-init；全部 rollout 非法动作率为 0，teacher 未进入在线热路径。

全局“稳定 200 分”尚未达成：`stable-200-v2` 完整 20 局、80 席评测的完局率为 1、非法动作率和阻塞率为 0，但均分/P25/P50 分别为 56.4875/36/49。此结果只用于明确后续学习目标，不作为本首轮实验通过 200 分门槛的声明。

## 数据与 BC

- smoke：4/4 完整终局，2682 条决策记录。
- expanded：32/32 完整终局，16038 条决策记录。
- dataset SHA256：`51b5091e2c645d2052c29586e5ee682feecf8a28db49f0095dd493973fc41f51`。
- 数据审计：chosen action 全部属于原始 legal set；非法率 0；隐藏信息审计通过；fresh replay 终局一致率 100%。
- held-out BC：top-1 0.8253115，top-3 0.9721476，illegal 0，value MAE 0.1570767；checkpoint reload/handoff parity 通过。

## 同预算 A/B

每臂训练预算均为 3000 env steps，评测池均为 8 个训练外 seed。

| 训练 RNG | BC-init early AUC | random-init early AUC | BC-init 最终均分 | random-init 最终均分 | BC-only 均分 |
|---:|---:|---:|---:|---:|---:|
| 7 | 56.8852 | 19.4911 | 60.0000 | 21.3438 | 56.0938 |
| 19 | 49.1737 | 20.4964 | 55.3125 | 16.6875 | 57.1875 |
| 31 | 51.6441 | 19.5675 | 55.1250 | 22.1250 | 61.8438 |
| 均值 | 52.5676 | 19.8517 | 56.8125 | 20.0521 | 58.3750 |

BC-init 的早期 AUC 与最终均分均为 3/3 RNG 优于 random-init。BC-only 均值略高于当前短预算 BC-init PPO，说明后续长训仍需处理 entropy/BC 衰减与 teacher coverage，不能把短预算 PPO 解释为已经超过 teacher。

## 本轮故障修复

- `STATE_MIGRATION_OUTPUT_INVALID` 根因：方舟二号卡是“每玩家独立实例、共享定义 cardId”，旧校验误把不同实例的共享定义当作同一物理卡重复位置。
- 修复后仍保持卡实例 ID 全局唯一；只对方舟二号卡允许跨玩家共享定义 ID，普通卡重复 `cardId` 继续 fail-closed。
- recovery 错误现在输出首个失败 path、cause code 与结构化诊断；rollout 错误输出完整 canonical action。
- `stable-200-v1` 的 100 policy-decision 上限在当前 policy-owned decision 粒度下使 20/20 局超限；后续提交以新 id 发布 `stable-200-v2`（1000 步），v1 与历史 baseline 保持不变。

## 提交与验证

- `6670144`：修正方舟卡状态不变量并补诊断/回归。
- `01bc567`：发布 `stable-200-v2`，不原地改写 v1。
- `d61d7fe`：补齐 PyTorch 冻结评测入口、分位数/机器 acceptance 与 harness-evolve 记录。
- 最终 `dev`：`node --check randomizer/app.js` 通过；Python 5/5；Node 164/164。

