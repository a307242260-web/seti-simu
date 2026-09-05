# 轮初数据收入独立修复设计（实现前冻结）

候选：round-data-income-r4-20260906。目的：轮初收入获得可放置的真实数据，资源计数
与池内token同步；不是提高搜索分值或补偿第三/第四轮终局分差。
真实反例和原路径证据见r4-data-count-review-20260906.md。

## 完整边界与可证伪义务

| 项目 | 现行语义与唯一实现 | 证据/禁止项 |
|---|---|---|
| 来源与owner | probe-turn TURN_ADVANCE在roundAdvanced时按activePlayerIds逐席发income/round_start_income；residual按effect.ownerId找玩家 | 多席unit核对各自收入；不以当前行动玩家替代owner |
| 状态 | 只将该分支的availableData数值直加改成正式data.gainData；其他资源及盲抽保留 | 正式第144步前后与旧canonical对照，仅pool和dataToken序列应不同 |
| 零/正常/满池 | 非负整数收入逐次发放；gainData维护poolTokens、计数、容量6与discardedCount | 0/5/6已有数据与0/2收入组合；已有token不改、不重复增数 |
| 错误 | gainData的discarded是正常溢出；其余ok:false直接返回；缺序列直接抛错 | 不catch吞掉、不用裸gainResources补数，不改gainData |
| id与RNG | 每个实际入池token消耗root.meta.sequences.dataToken一次，溢出不消费；无额外RNG | unit核对序列和全席唯一id；实际恢复核对完整canonical |
| Decision | 数据发放是既有确定性handoff，无新选择；抽牌仍沿既有drawOptions | 不新增UI、自动策略或第二份Browser实现 |
| 事务/重复 | 仍由Effect Session执行并经公共inputPort确认，失败不由本分支强行提交 | 真实144步动作成功后再次提交旧descriptor失败且状态不变 |
| 恢复 | 从143步已确认checkpoint继续，两env执行同一个144步动作应完全一致；完成后恢复不再发收入 | 比较observation、legalActions、canonical及序列；不修改checkpoint格式 |
| 范围排除 | 第一轮setup、插收入牌、其他数据奖励和旧档修补不在本次修改范围 | 不重构所有收入、不加搜索特例、不调整budget/评分/计划 |

不为已有错误档追补历史收入；完整效果实验必须由新版本从开局运行，不能从旧版200步
续跑（旧档已经缺第二轮收入）。同新版本quick200到full的标准续跑仍允许。

## 实现与验证顺序

1. 在现有residual handoff unit增加数据收入边界，先证旧实现失败。
2. 批量完成该唯一分支及机制/RL文档；真实轨迹在首次不一致之前完全重放，验证
   144步新结果与恢复/重复拒绝。不按新行为强行重放旧版此后AI选择。
3. 相关unit、唯一full-flow、语法及文档diff检查；两项用户指定既有失败不处理。
4. 中文提交独立生产版本，先查研究记录，再标准quick200及同版本full登记。
   终局仍需与已通过106.75比较；局部规则正确不等于第三/第四轮验收。

受影响文档：mechanics-reference轮初收入、rl-simulation-env恢复/观察说明、四轮计划。
AI设计/README/AGENTS接口导航无改动；不修改PROJECT_MEMORY。

## 本地实现验证

- 修改前新增行为断言失败：轮初收入2数据，池内实际0而预期2。
- 修改后0/5/6已有数据×0/2收入、两席owner、容量弃置、旧token保持、全席唯一id、
  成功入池消耗序列及无额外RNG的unit通过。
- 真实第24—143步动作与摘要完全一致。第144步正式提交后相对旧canonical仅多
  蓝方data-token-20及dataToken序列20→21；没有其他事实变化。
- 第143步checkpoint恢复后执行144步得到完全相同canonical/观察/合法集；第144步
  完成后恢复也相同，不重复发放。再次提交旧动作失败且canonical不变。
  证据：round-data-income-r4-real-20260906.json及对应adhoc脚本。
- 全量Node：unit 76/78，fullFlow 1/1；两项失败仍为用户指定暂不处理的
  simulation-counterfactual-outcome（旧beam断言）与strategic-goal-evaluator
  （分析后目标释放断言）。未出现新增失败。语法与diff检查通过。

本地证据证明本次限定结算修复，不证明所有历史数据来源、全部规则状态或终局效果。
尚未运行新版本固定盘面，第三/第四轮仍未验收；下一步提交后标准实验，不复用旧版
200步checkpoint。旧档恢复修补说明不作为本次新局正确性的证据。
