# RUNEZU-EFFECT-01

起点6f505903，独立目录89VI2r；预算专项发现的规则bug插入修复，不携带未接受交易策略。
正式规则face_detail.md：s_N是symbol_N当前黑圈位置奖励，不是符号本体。
基线真实Action复现0/1/7/8分支executor缺失，9的确定奖励executor缺失，详见baseline-detail。

方案：play-domain注册分支choose_target和确定奖励；分支按模型顺序产生逐符号效果，
复用getTraceFaceRewardForSymbol和buildRewardEffects及既有卡牌spawn/扫描收尾。
未放置符号沿用角标的无收益契约，但事件明确记录原因；非法符号/分支必须显式失败。
任务奖励删除错误gainPlayerSymbol分支，使用已有正式节点转换进入同一奖励executor。
不变更库存符号、隐藏牌价、AI策略或预算。重复符号不能去重。

验收：两分支/重复/未放置/位置改变/任务库存不变、抽牌和扫描后继、标准输入拒绝
与恢复契约；相关unit+唯一full-flow；196共同输入和其余错误检查；新提交完整局与报告中心。
当前仅开发，未宣称通过；交易候选a5e6170c保留等待修复后重新核对，不能重复旧完整局。
