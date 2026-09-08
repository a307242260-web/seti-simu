# 公司默认收入计分修复设计

状态：2026-09-08修复、定向测试、真实单点与完整局完成；独立分支fix/company-income-scoring-20260908，生产提交670441bc。规则修复通过，性能与第五轮效果目标未通过。

## 目的与证据

第24步新发射获胜叶在跨25分时错误预估a2标记22分；深空探测总收入4钱2电2牌，应扣正式目录2钱2电1牌，a2基数为0。证据见step24-income-boundary-attribution-20260908.md及company-income-scoring-evidence-20260908.json。问题是共享计分resolver未识别真实initialSelection.industry，而不是收入屏障或策略权重错误。

## 实现矩阵

| 边界 | 唯一来源/owner | 实现及可证伪义务 |
|---|---|---|
| 公司基础收入 | initial-cards.INDUSTRY_EFFECTS / getIndustryEffect | 根据正式公司身份读取同一目录，不增加收入副本，不修改发放 |
| 显式上下文基数 | end-game-scoring.getPlayerCompanyBaseIncome | 保留现有resolver/map/显式字段契约；缺省路径从已选公司读取 |
| 未选公司 | initialSelection.industry为空 | 返回空基数，支持真实开局，不要求不存在的公司 |
| 公司已选但目录缺项 | 共享计分函数 | 显式TypeError，不默认为0掩盖错误 |
| Node依赖 | 函数调用时require initial-cards | 不在模块加载期建立循环依赖；缺少模块不吞错 |
| Browser依赖 | 调用时globalThis.SetiInitialCards | 保留index.html先计分后初始牌的顺序；公司计分发生前必须装配完成 |
| a1/a2正式分 | getIncomeIncreaseValue→getFormulaBaseValue→computePlayerFinalScore | 全公司目录：只有基础收入为0；新增收入按增长量；初始牌的收入增量仍计入 |
| 待标记预估 | rule-observation.pendingFinalMarkValue→同一公式 | 第24步发射叶a2预估不再22；不在观察层复制扣除逻辑 |
| 终局牌 | b115 unmarkedFinalRightmost→同一公式 | 自动继承正确基数，定向验证卡牌计分 |
| 状态与事务 | 只读玩家及静态目录 | 不写root、不消费RNG/id/sequence、不改变Decision/合法集/恢复或不可逆边界 |

本次不是状态迁移：不新增schema或删除正式入口。旧缺省空基数仅在确实未选公司时保留；有公司不能继续走空基数。预算、状态等价、目标枚举及启发式权重完全不动。

## 验证与后续

1. 真实公司ID且无人工baseIncome字段的行为测试先复现失败；遍历全部公司目录验证增长公式，覆盖显式旧契约和未知公司失败；浏览器UMD后加载模块测试。
2. end-game-scoring定向测试、final-scoring及唯一standard-flow，语法与V输入审计。
3. 正式第24步单点记录获胜评分、输入、节点、耗时、异常；单点达标后标准入口先list、再独立版本固定完整局，不重跑既有实验。
4. 旧轨迹重计分115.25/102.5不是新AI成绩，保留旧记录与注记。作为规则修复不恢复错误分；完整局仍检查新异常与连带行为。

同步范围：docs/ai-design.md的计分口径、assets/final/final_detail.md的数据来源说明、测试清单说明与本迭代记录。未改API、运行方式、浏览器脚本顺序或目录入口，README/AGENTS/部署手册无需变更。

已执行：新增真实公司目录测试修前返回空基数而失败；修后全目录基础/增长公式、正式终局、b115、未知公司报错及浏览器后加载测试通过。end-game-scoring、final-scoring、唯一standard-flow定向验证通过，V输入审计全部通过，生产语法通过。没有宣称全量Node测试通过。第24步诊断增加company-fixed模式，允许通过SETI_DIAGNOSTIC_INPUT_ROOT读取主目录已有历史存档，结果仍归属当前工作树与提交，不重复完整局。

## 验收结果

- 历史a7d65847已修过同一缺陷，但当前aaaed8d0代码基线未带回；本次恢复的是同一正式目录读取语义，验证与收入屏障修复的组合，不重跑旧106.75版本。
- 第24步实际协调器选择放数据，评分92；发射另一个合法最优叶88。4096节点、6450正式输入、失败0、剩余队列243；12161.9ms含一次获胜叶捕获，不声称节点或耗时改善。证据step24-winning-plans-company-fixed-20260908.json。
- 标准完整局记录73d04d3a.670441bc.full.json：613步终局74/105/115/113，均101.75，576539ms；143252节点、182814输入、战略截断30/88、控制截断8/84，记录到的规则执行失败0。
- 直接前版109.75为旧错误计分，其同轨迹正确重计分为102.5；本次新决策轨迹101.75较之低0.75。重计分仅供解释口径差异，不是重跑或替换原记录。历史123.75同轨迹正确重计分115.25；二者仍保留作为对照，不强行追回错误收益。
- 规则修复按用户的规则bug例外验收并保留；三项第五轮门槛尚未满足。只证明修复契约与已记录零异常，不宣称所有策略问题或整局得分差都已归因。下一项回到明确目录漏项与重复搜索，暂不调权重补分。
