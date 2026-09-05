# 轮初数据收入未生成 token 的真实轨迹反例

## 判断

蓝方末轮 PASS 前不是有两个真实数据而搜索漏放：资源字段为2，正式数据池为空。
轮初收入路径只增加 availableData 数值，没有调用正式 data.gainData 创建 token。
这是规则结算与观察输入不一致的独立缺陷；尚未证明由第三/第四轮改动引入，也不能
据此解释终局全部2.75分差。禁止在搜索层补造数据或仅修改观察值来掩盖规则问题。

## 实际证据

来源为已登记 score-corner-r4-20260906 的0d21aebf完整存档。无AI重跑；从共同
开局checkpoint正式重放第24—552步，每步完整动作descriptor及状态摘要与存档一致。
所有席位每步检查 resources.availableData 与 dataState.poolTokens.length：

| 蓝方发生不一致的时点（1起始） | 资源计数 | 池内token | 说明 |
|---|---|---|---|
| 144，进入第二轮 | 0→1 | 0→0 | 首次不一致 |
| 170，移动获得数据 | 1→1 | 0→1 | 正式增数重新按池长度同步；不代表补回先前收入 |
| 291，进入第三轮 | 0→1 | 0→0 | 再次漏token |
| 430，进入第四轮 | 1→2 | 0→0 | 继续只累加数值 |

第553步PASS前，蓝方计算机已有两token、数据池零token；白方是计数1/池内1，
不能把两名玩家剩余数据视为同一个原因。正式 data.canPlaceAnyData 以poolTokens
为准，因此蓝方合法集无place_data是规则对当前真实状态的正确反应。

代码定位：residual-domain-session.js 的 income/round_start_income 分支直接将
income.availableData 传给 players.gainResources；后者只更新数值。正式数据原语
data.gainData负责创建带id/序列的token并同步数值，两者职责不可混用。
现有轮次转换测试只核对信用收入，未覆盖数据token，不能用其通过证明数据收入正确。

## 产物与下一步

- audit-r4-blue-final-pass-20260906.js：定位PASS前完整观察、合法集和物化checkpoint。
- trace-r4-data-count-20260906.js：正式轨迹与每席数据账核对，结果r4-data-count-trace。
- r4-data-first-mismatch：第144步之后物化checkpoint；恢复时应移除增量replaySteps，
  不能把第24步开始的局部replay当成从开局的完整记录。

下一步单独设计轮初数据收入修复：覆盖各席owner、容量/溢出、正式token序列、重复
结算与恢复边界，使用唯一gainData原语。先真实单步反例及相关行为验证，再提交独立
版本做去重固定盘面验证；不改搜索预算/权重，不修改其他收入机制以扩大范围。
本次仅诊断，无生产变化、无新终局，不新增策略版本。第三/第四轮仍未验收。

文档检查范围：四轮计划、迭代登记规范、AI设计、机制参考、RL契约与AGENTS导航。
本次更新四轮计划；其余没有接口或行为变更，不改写生产口径。后续修复需同步轮初
收入契约及检视机制参考中恢复补齐token的描述，不能把恢复补齐当正常结算方案。
