# 扇区规划目录修复：证据与冻结设计（2026-09-06）

独立于R3计划复用修正。不得把这两项既有目录问题预先称为R3引入的次生问题。

## 已复现

1. `mercury-scan-directory-audit-20260906.json`：隔离checkpoint显式赋予棕方紫2、
   足够钱电/宣传，公共牌移入弃牌堆以区分来源。规划accessSources仅包含地球
   sector-1-a；正式scan输入经过地球选择后提供水星sector-4-a，提交成功，宣传3→2、
   数据1→2。正式执行数组find，目录却读取planetLocations?.mercury，遗漏已证实。
2. `sector-directory-cache-audit-20260906.json`：无紫2、无公共牌的同一隔离规则输入，
   只改变wheel1Steps=2。暖缓存仍给sector-1-a，正式地球位置已是sector-2-a；仅更换
   gameId使缓存冷启动后给sector-2-a。说明同盘面返回值依赖旧缓存历史，状态等价被破坏。

两项都无AI搜索、无完整局重跑；隔离输入与逐步动作/观察落盘，不冒充历史盘面。

## 修复前必须闭合的目录

| 消费/事实 | 正式来源 | 当前缓存覆盖 | 修复义务 |
|---|---|---|---|
| 扇区竞争与下一结算序号 | data token/替换顺序/extraMarks/settlements、玩家id/color | data、id；color未显式列入 | 具名竞争事实与来源目录分开辨认，按实际输入缓存 |
| 地球/紫1邻区 | solar位置和扇区分配、有效紫1 | solar未入key | 旋转/盘面分配变化不能沿用旧access |
| 公共牌扫描 | publicCards的正式扫描码 | publicCards未入key | 公共补牌/换牌改变access，应立即反映 |
| 紫2水星 | 正式行星数组、有效紫2、正式追加1宣传成本 | 数组读错；状态key也不完整 | 用现有solar primitive；明确目录是能力还是即时可支付范围，不能补位置后虚构免费扫描 |
| 紫3手牌扫描/打牌扫描 | hand/卡牌DSL、有效紫3 | hand已入key | 沿用正式码/DSL，不写第二套卡牌逻辑 |
| 借用科技生效/失效 | 玩家industryBorrowedTech字段与round/turn | 未入key | 当前有效科技必须与正式扫描队列一致 |
| 标准扫描成本 | scanEffects.getStandardScanCost→公司被动 | company未入key | 公司成本变化不可复用旧成本 |

冻结前要求：先明确accessSources的能力/可支付语义及下游目标选择与资源准备的完整消费，
再选择完整修复（补完整key或仅缓存真正静态竞争部分、每次重建动态access）。不得只补
一个太阳系字段然后从后续失败猜下一字段；不得先单行修水星再遗漏追加成本。

验证至少覆盖上述各变化及冷热缓存等价，正式水星支付/缺宣传/跳过、当前实际盘面局部
搜索性能，然后中文独立提交、登记并按固定盘面验收。不能由这些复现解释全部11分差距。

## 冻结设计（2026-09-06）

消费闭包已核对expected-score-evaluator的目标目录、后继绑定及目标排序三处：
accessSources表示潜在触达能力，不等价于当前legalActions；standardScanCost是主行动
基础资源下界。目录已有“钱电不足仍列来源，另做资源准备”的行为；不能在修水星时
改成按当前宣传过滤所有能力。紫2的1宣传、紫3的弃牌由正式scanQueue选择生成和
提交收费；无法支付不会产生收益叶。当前只按基础费用准备资源会漏掉某些追加费用
筹集组合，这是既有搜索近似，不将其包装成完整可达性证明，本修复不扩展搜索顺序。

采用完整派生输入缓存键：每次用现有正式来源计算standardSectorIds、手牌DSL来源和
getStandardScanCost；与gameId、玩家id/color及完整data一起构成缓存键。缓存body只
再读取data和玩家id/color；动态来源、费用由参数传入，不二次读取隐藏依赖。这样旋转、
公共牌、借用生效/过期、公司成本等只要改变输出来源/成本就必然改变键；输出完全相同
则允许共享。无需按大量原始玩家字段猜测缓存失效，也不缓存可变canonical引用。

水星坐标直接调用现有solar.collectPlanetLocations(...).find(planetId)，与正式执行
使用同一数组内容。输出schema、目标ID、来源ID、排序不变。没有新RNG/id/sequence、
Decision或事务；旧“只按data/tech/hand缓存完整目录”入口替换，不增加fallback/第二实现。

验证：从已保存隔离checkpoint建立同gameId暖缓存与只改gameId的冷缓存对照，覆盖
旋转、公共牌、紫2、借用生效与过期、费用、排名/结算，完整目录逐项相等；水星
潜在来源在宣传0仍可列出，但正式扫描不给免费水星步骤。再执行Node/V/单决策门槛；
固定盘面仅在新提交上标准去重运行。

## 实现及局部验证

生产改动仅限production-kernel：水星读取正式行星数组；完整目录缓存采用上述派生
输入键，body不再自行读取动态扫描来源和费用。未改规则收费、策略权重或搜索预算。

- `sector-directory-verification-20260906-v2.json`：8组来源/费用冷热完整目录相等；
  宣传0仍列潜在水星来源但正式动作不可选，宣传3选择水星后扣1宣传。
- `sector-directory-boundaries-20260906.json`：正式data primitive逐步替换、填满、
  结算后，冷热目录相等；ownCount、openSlotCount和下一结算序号按预期变化。
  正式扫描主动跳过水星，玩家资源与目录保持不变。此为隔离规则输入，非历史完整局。
- 首份`sector-directory-verification-20260906.json`失败原因为诊断fixture误用公司
  展示label；已改成正式industry id并保留失败记录，未修改生产校验迎合fixture。
- `sector-directory-performance-20260906.json`：真实棕方第42步checkpoint冷决策
  9701.08ms、4096节点，仍选择launch:c1616852；通过10秒单状态门槛，不外推全盘耗时。
- `node --check randomizer/game/production-kernel.js`与V输入审计通过；默认Node
  unit 73通过、2项指定既有失败，唯一fullFlow通过（日志
  `/tmp/seti-sector-repair-tests-20260906.log`）。不宣称全量测试通过。

局部证据携带生产源码SHA256，后续固定盘面必须在干净提交上登记；当前尚无此次
修复的终局成绩。未证明此前11分差距由这些缺陷造成，第三轮仍未通过。
