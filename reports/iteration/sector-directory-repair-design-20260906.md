# 扇区规划目录修复：证据与设计义务（2026-09-06，尚未冻结）

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

尚未冻结：先明确accessSources的能力/可支付语义及下游目标选择与资源准备的完整消费，
再选择完整修复（补完整key或仅缓存真正静态竞争部分、每次重建动态access）。不得只补
一个太阳系字段然后从后续失败猜下一字段；不得先单行修水星再遗漏追加成本。

验证至少覆盖上述各变化及冷热缓存等价，正式水星支付/缺宣传/跳过、当前实际盘面局部
搜索性能，然后中文独立提交、登记并按固定盘面验收。不能由这些复现解释全部11分差距。
