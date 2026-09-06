# 终局位置计分输入缺失（独立问题，2026-09-07）

状态：01b4d49e已独立实现、验证、登记；完整局均105.5，整体门槛未通过。

`final-probe-location-reproduction-v2-20260907.json` 基于真实42状态，明确改动为加入
b82保留牌，并把一个已有普通探测器放到当前可见小行星。没有模拟历史获得这张牌
或移动到此的行动，不把它作为历史终局失分的证据。

同一输入正式 `computePlayerFinalScore` 未传位置时漏13分，传入已修复位置事实后
增加13分；Browser FinalReadModel与rule-observation同样漏13分。residual正式终局
调用也未装配probeLocations/details，源码已核对；其完整结算行为仍需正式回归。
初版证据保留：诊断脚本误按id查找观察玩家（正式字段playerId），因此缺少该字段，
不能证明信息层行为；v2改用正式字段并添加必需结果断言。不是生产新增异常。

下一轮边界：让正式计分、信息层与Browser读模型消费同一个位置读取，不能只修UI，
也不能在AI侧发虚拟奖励补漏。评估是否将纯位置读取迁到可共同依赖的规则模块，
避免end-game-scoring依赖Card Play执行域而形成循环。须冻结调用闭包后实现，
测试小行星/空格/对手/参考图/旋转、终局实际结算与观察一致性；不改评分权重。

本问题直接涉及需求式移动中的真实终局位置收益，应在移动需求入口接入前独立修复。
每次修复仍须单决策门槛、独立中文提交和唯一完整局；不得因假设可补分而认定通过。

## 冻结设计与义务

唯一位置事实owner迁入现有rockets模块，原buildProbeLocationData完整迁移（根输入
形状不变），Card Play不保留转发export。唯一计分owner仍为end-game-scoring的
probeLocation分支，在需要这类计分时从正式pieces/solarSystem生成位置事实，不依赖
调用方选装索引；不会给每个无位置计分卡的节点增加几何读取。

| 来源与边界 | 实现与可证伪证据 |
|---|---|
| Card Play条件 / residual状态任务 | 两个调用均改用rockets同一primitive；已有64格/任务奖励/恢复回归必须保持 |
| scoreCardEndGameRule probeLocation | 正式根pieces/solarSystem是唯一输入，旧注入probeLocations不能覆盖实际盘面；小行星13分、空格/对手/化石/参考图0分 |
| computePlayerCardScore→computePlayerFinalScore | 沿现有调用链，无虚拟奖励或第二份规则；测试真实保留b82和当前旋转位置 |
| residual.settleFinalScores | 原正式结算调用无需加装索引即可计13分；finalScore、breakdown及match.finalScores一致 |
| rule-observation / Browser FinalReadModel | 原调用共用修复后的正式计分；受控状态三方总分一致；删除FinalReadModel可选buildProbeLocationIndex与派生空索引 |
| 浏览器/Node依赖 | rockets仅依赖solar/stateSequences，无计分环；endGame在HTML先于rockets加载，按现有晚绑定模块模式在计分执行时取模块，缺失显式抛错，不改脚本顺序，不静默catch |
| 状态/确定性/事务 | 位置读取纯读，无新增状态、缓存、RNG、序号、排序；评分仍在现有终局事务写入，无新增Decision或owner变更 |
| 缺失与恢复 | 执行位置计分必需pieces和solarSystem，缺失不得用空索引计0；正式任务既有保存恢复义务保留 |
| 旧入口删除 | Card Play本地函数/export、两个生产调用及FinalReadModel可选索引物理删除；历史取证脚本保留当时版本语义，不作为当前运行入口 |

门槛：生产patch前先正式盘面计分红测；整批实现后跑位置/卡牌/残余终局定向回归、
全Node及V审计；真实42单次冷决策/完整计划与30秒门槛，然后独立提交、唯一完整局。

红绿证据：生产修改前，end-game-scoring.test与residual-domain-session.test均明确
在正式位置卡计分处失败（实际0、预期13）；完整批次后两项与原位置任务回归通过。
额外覆盖旋转两状态全部64格、对手/化石/参考图、伪造旧索引无效、必需盘面缺失；
正式终局事务与信息层/页面读模型同分。浏览器式无require的真实UMD模块执行验证
先加载计分、后加载rockets的晚绑定语义（不是实际Chrome smoke）。

真实42验证：final-probe-location-decision-42-20260907.json，15.214秒、4096节点、
4804成功输入、失败0，根动作仍place_data:dbe01b29，根+29步后续计划全部正式重放
成功。此前15.820秒；单次测量不声称性能收益，本次目的为计分正确性。
全Node为77/79 unit、1/1 fullFlow，两项既有失败仍为beam断言与分析目标释放断言；
V输入审计全通过，五个生产文件语法通过，无新增测试失败。
生产旧Card Play位置函数/export与FinalReadModel可选位置索引均已删除，当前三个
生产消费者共用rockets primitive；历史取证脚本保留原版本记录，不用于当前修复验收。
文档检查覆盖README/AGENTS/PROJECT_MEMORY、卡牌DSL、机制参考、AI设计、Simulation
契约和当前迭代计划：更新受影响机制/接口，入口和长期约定不变，无需修改记忆。

## 完整局验收

唯一记录c292b693.01b4d49e.full.json，562步109/88/118/107、均105.5；与b8be61a5
完整replay及终局状态相同。179次搜索、105127节点、129506成功输入、规则失败0，
21次4096策略截断和8次1节点控制截断不变。375879ms，比378516ms少0.70%，
单次测量不声称稳定提速。原固定终局四席均未保留b82，不能把受控修复13分外推为
本盘应增加13分。核验与文件SHA256见final-probe-location-full-verification-20260907.json。
正式位置计分义务通过，整体108.5及零截断门槛未通过；不回滚正确规则，回到需求式
移动主线，不调权重补分。迭代中心仍有5项历史警告，本轮记录/存档/报告齐全。
