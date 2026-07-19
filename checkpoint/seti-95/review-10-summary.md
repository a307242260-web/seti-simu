# SETI-95 十轮训练阶段 Review

## 结论

本阶段只完成 10 个完整训练 episode，未启动 `stable-200-v2` 完整评测，也未继续扩大预算。

在 SETI-39 验收冻结运行时（commit `9c7eab2`）、expanded-v1 dataset 与 BC checkpoint 上，seed 7 的 10 局 PPO 训练完成 5,062 env steps：10/10 终局、非法动作率 0、阻塞率 0。训练局均分 59.05，前 5 局/后 5 局均分 58.45/59.65，仅有弱正向变化；样本不足以支持扩大到 200 分目标或宣称超过 BC-only。

当前共享 dev 工作树正处于另一项 effect-session 迁移的未提交中间态。同配置首局在 step 105 后 fail-closed：环境把“凌日系外行星巡天卫星”列为合法行动，但效果结算时因没有可移除的己方环绕标记而拒绝执行。因此当前工作树暂不具备继续训练条件，不能用冻结快照成功结果掩盖集成风险。

## 冻结快照结果

| 指标 | 结果 |
|---|---:|
| 训练 episode | 10 |
| env steps | 5,062 |
| 训练局均分 / 标准差 | 59.05 / 5.56 |
| 最低 / 最高局均分 | 49.75 / 66.75 |
| 前 5 局 / 后 5 局均分 | 58.45 / 59.65 |
| step-weighted AUC | 59.3517 |
| 第 10 局均分 | 63.75 |
| entropy | 0.360229 |
| approx KL | 0.000890 |
| value loss | 0.013899 |
| policy loss | 0.002691 |
| BC loss | 0.425786 |
| wall-clock | 311.38 秒 |

训练后只跑了预先约定的 4 局轻量训练外评测：4/4 终局，16 席均分/P25/P50 为 65.8125/43/60，非法动作率和阻塞率均为 0。该样本仅用于 checkpoint 初筛，不替代 20 局 `stable-200-v2`。

## 证据与下一步

- 训练报告：`checkpoint/seti-95/review-10-rng7-frozen-seti39/training-report.json`
- checkpoint：`checkpoint/seti-95/review-10-rng7-frozen-seti39/checkpoint-5062.pt`
- 训练 rollout：`checkpoint/seti-95/review-10-rng7-frozen-seti39/train.rollout.jsonl`
- 轻量评测 rollout：`checkpoint/seti-95/review-10-rng7-frozen-seti39/eval-5062/rollout.jsonl`
- 当前工作树失败证据：`checkpoint/seti-95/review-10-rng7/train.rollout.jsonl`（105 个成功决策后 fail-closed）
- checkpoint SHA256：`e7787f9dd0c645d39d4b1607af26c04ead7d74fbfeb8210d4b0c4d303e06a54c`
- training report SHA256：`4100b90f9fd856d7a70cdc502868e0fca5dc46a3cb7f6cff1060782bc2ab8e02`
- train/eval rollout SHA256：`ad1686451251179f6361552f2728f0a73bc8c5195587fa891a9d4715d6105973` / `4f40dba08c544153ce5b87b92fb788bc95986b90ed6f9b35321f9cc9e48042e2`

建议先等待 effect-session 迁移形成可验证提交，再在最新 dev 上重跑同一 10 局 seed 7；若合法率和终局率恢复为 100%，再补 seed 19/31 的十轮复验。当前不进入 200 分长预算。

## 验证

- `python3 randomizer/training/long_training.test.py`：7/7 PASS。
- `python3 randomizer/training/pytorch_trainer.test.py`：3/3 PASS。
- `node --check randomizer/app.js`：PASS。
- `node tools/run_node_tests.js`：165/166 PASS；唯一失败为共享迁移中间态的 `randomizer/app/ai-controller.seed-baseline.test.js`，实际 100 步未终局，冻结期望为 99 步终局。该失败未通过改 baseline 掩盖。
