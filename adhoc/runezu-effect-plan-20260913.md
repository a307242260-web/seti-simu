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
本项规则与完整局验收通过，已合回主目录并核验报告中心；交易候选a5e6170c保留等待修复后重新核对，不能重复旧完整局。

## 已有证据与完整局运行

实现提交f105f8ea。0/1/7/8/9正式打牌基线失败、修复可提交；两分支、重复奖励、
未放置符号、错误owner拒绝与checkpoint恢复测试通过。任务触发测试通过，基线
会错误将symbol_4库存2变3，修复保持2并按实际位置发信用点或分数。盲抽生成牌
与RNG可恢复；黑圈2号是增加额外公共扫描标记，不是立即执行扫描，不增加Decision。
相关play-domain/residual-domain-session和唯一full-flow通过，语法与diff检查通过。

共同输入核验54826退出0，9个输入均按原a5e6170c存档逐步action/after重放捕获，
196/264/303/428/430/445/452/508/564在f105f8ea搜索全部错误为零；战略耗时约
0.64–16.57秒。证据位于adhoc/runezu-error-inputs-20260913。修复版本没有携带交易
候选，以上证明共同输入错误门禁，不将不同搜索轨迹统计当作逐节点无损对比。

主目录154记录与本目录0记录查重后，启动唯一完整局runezu-effect-fix-20260913，
受测f105f8ea，baseline=probe-owner-cache-20260912，会话36267。运行中不改生产代码
或推进HEAD。会话36267退出0，记录e16bc101.f105f8ea.full.json，589步自然终局，
正式分97/123/127/84；与基线逐步action/after差异0，全部搜索错误为空。
执行截断52、队列截断55未变；本项是规则修复，不计预算优化收益。
比较结果见reports/iteration/runezu-full-comparison-f105f8ea-20260913.json。
主目录af3420c4已合回，报告中心124份元数据刷新；21个本地链接与113份历史正文核验通过。
