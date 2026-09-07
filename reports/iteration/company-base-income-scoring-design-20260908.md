# 公司初始收入计分修复：冻结设计

2026-09-08。独立规则修复，基于候选c57389c2（生产4fbce3b5）。不是虫族蓝8/9策略的一部分，不宣称解释其相对降分。

## 目的与方案

A1/A2按收入增加量计分，排除公司初始收入。真实玩家只保存initialSelection.industry身份；
现有计分helper未解析该身份，正式终局、观察及预览漏扣公司初始收入。复现证据在dev
0cc25d52的green-income-company-base-proof-20260908.json，两局四席均复现。

唯一修改owner为end-game-scoring.getPlayerCompanyBaseIncome：保留既有显式resolver、
映射、字段优先级；缺少显式值时，通过正式initial-cards.getIndustryEffect解析所选公司。
未选公司仍允许空基数；已选公司但目录依赖缺失或身份未知必须抛错。Node和浏览器
都调用同一公司目录；依赖在计分时读取，匹配现有探测器计分模块的晚加载方式，不更改脚本顺序。
不新增state字段或缓存、不迁移存档、不复制11家公司数据、不改初始收入发放。

## 完整影响矩阵

| 入口/语义 | 唯一原语与状态归属 | 验证义务 |
| --- | --- | --- |
| A1/A2已标记板块 | computePlayerTileScore → getFormulaBaseValue → 收入helper | 11家公司初始收入得0；收入增加后按max/min给分 |
| b115未标记板块 | scoreUnmarkedFinalRightmost → 同公式 | 未标记A仍正确扣初始收入，无第二公式 |
| 正式终局 | residual-domain-session.settleFinalScores → computePlayerFinalScore | 原存档状态直接计分等于此前显式目录诊断；新完整局终局一致 |
| AI公共观察及pending板块价值 | rule-observation及final-read-model → 同公式 | 真实玩家身份无需手工resolver；板块预览、观察、计分一致 |
| Browser板块/得分预览 | final-read-model → 同公式 | UMD先加载计分、后加载公司目录，能正确计分；依赖缺失抛错 |
| 旧存档 | 已有initialSelection.industry | 无字段回填，读取纯函数不改玩家/公司目录 |
| 既有显式resolver/map/字段 | 原先优先级保持 | 注入值仍优先，不改变既有接口 |
| 开局未选公司 | 无industry身份 | 不要求尚不存在的公司目录，保持原有无公司契约 |
| 九折收入增加任务 | jiuzhe.getCompanyBaseIncome已解析正式目录 | 不改其规则；九折unit回归，避免无关重构 |

所有项只读已有状态；不产生Action/Decision、不涉及wrong-owner/stale/late处理，不改事务、
费用、奖励、RNG、id或sequence。没有旧executor迁移或第二执行路径需要删除；
需要消除的是“有真实公司身份却返回空基数”的遗漏。基础分、B/C/D公式不变；
b115及最终九折百分比可能随A分纠错变化，属公式传递，不是新策略。

## 验证与性能门禁

1. 先增真实industry身份的unit，复现旧实现失败，再一次性完成helper修复。
2. 11家公司、两种A公式、显式覆盖、未选/未知公司、冻结输入、晚加载UMD及b115。
3. 既有两局终局状态只读重算逐字段对齐诊断；相关计分/观察/九折unit、唯一full-flow、
   V输入审计。若失败先判断义务和根因，不以默认值吞掉失败。
4. 新版本复用193冷根配置、4096物理上限，记录实际耗时/节点/输入/计划执行，
   单根不得超过30秒；规则纠错可能合法改变排序，不要求恢复含错分的旧链。
5. 单点门禁通过、中文提交后才按research --list及robot_iterate run执行唯一完整局，
   每5–10秒透传灰色原始进度。规则修复不要求维持虚增分，仍核对异常及新终局；
   性能目标和108.5总目标不因本修复降低或宣称完成。

## 非目标与文档

不改启发式权重、收入偏好、搜索上限、节点统计、痕迹贪心或移动策略。
同步AI计分说明与本设计/验证记录。规则文档已正确无需改口径；README、AGENTS导航、
save/replay schema不变。主目录保持dev；新分支位于临时目录；未完成全盘前不宣称验收通过。
