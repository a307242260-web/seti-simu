# 方舟高级奖励接入设计（2026-09-08）

状态：临时分支生产接入4d3711c5已实现，9项正式事务、隐藏边界/根隔离、撤销和
Chrome代表性打牌验证通过；单点13.36秒通过30秒门槛，完整局622步均95.5与父版
全动作/状态一致，规则修复通过，未合dev。非策略/性能通过，仍29次截断。
证据索引见fangzhou-major-reward-progress-20260908.md。
反例与范围：[扣费但不发奖励](fangzhou-play-missing-reward-review-20260908.md)。

## 规则及唯一入口

官方`rules/seti-alien-species-space-agencies-en.pdf`第1–2页ARKHOS明确：打出已解锁
security card支付2信用点，翻一张exploration card获得major reward。每5张用完，
已翻与先前搁置4张混合重建5张。现有9张洗牌序列、每翻5张重洗的表示可保留，
不另建牌堆/RNG。原implementation引用的face_detail.md不存在，不能继续作为来源。
9种奖励内容取fangzhou.CARD1_DEFINITIONS，12张解锁牌身份取createCard2Definition。

正式卡表新增12个明确模型，共用一个`FANGZHOU_MAJOR_REWARD` effect type。
buildPlayEffects只能返回“翻高级奖励”描述，不能读取牌堆顶。Card Play域的
genericExecute负责翻牌：复用fangzhou.flipCard1Reward，随机参数显式使用本域
nextCommittedRandom(root)，只在实际重洗时消耗。保存域meta.rngState.cardPlay；
基础奖励仍使用其既有residualDomains随机源，不为本修复改写历史基础奖励。
既有打牌支付、移牌、mainActionCompleted和打牌后公司被动保持原入口。

## 完整9项矩阵

| 索引 | 生成的效果序列（沿用已有队列顺序） | 正式owner/primitive | Decision与资源 |
| --- | --- | --- | --- |
| 0 | 2电、黄痕迹 | Card Play DIRECT；Science ALIEN_TRACE | 玩家选择痕迹位置；奖励/揭示由原队列处理 |
| 1 | 盲抽2、完整扫描 | Card Play DRAW_CARDS；Science EXECUTE scan | 只免基础扫描费用，紫科技仍按正式流程支付；未知新牌遮蔽 |
| 2 | 3宣传、蓝痕迹 | DIRECT；ALIEN_TRACE | 与0相同的正式痕迹owner |
| 3 | 黄/红/蓝各扫描、任意扫描 | Science SCAN_STEP + 一个SCAN_FINALIZE | 保留所有实际非等价选择；同一flow末尾结算，不逐次提前结算 |
| 4 | 1数据、研究科技 | DIRECT gain_data；Science RESEARCH execute入口 | 无目标时仍公转再跳过；不能直接建空RESEARCH Decision绕过execute |
| 5 | 4电、额外公共扫描标记1 | DIRECT gain_resources | 标记进resources.additionalPublicScan，不依赖旧专属executor |
| 6 | 粉痕迹、无视上限免费发射 | ALIEN_TRACE；Card Play LAUNCH→abilities.launchProbe | 保留原生成器的先痕迹后发射；ignoreRocketLimit=true，不吞其他失败 |
| 7 | 1钱1电1宣传、1数据、精选1 | DIRECT；PICK_CARD_START | 保留正式公共牌选择及盲抽选择、补牌屏障和实体身份 |
| 8 | 无视上限免费发射、移动3 | LAUNCH；CARD_MOVE | 仍按正式移动选择/地形/来源结算，不加入独立寻路或改变目标策略 |

所有嵌套效果由既有createSpawnedCardEffect与spawnCardEffects展开；卡牌实体id原样
传入，不从当前手牌反查已经打出的牌。资源、牌、探测器、痕迹、科技实体序号仍由
对应primitive持有，翻奖励自身不创建手牌实体或修改meta.sequences。

## 文件职责与旧路径

- cards/effects.js：声明新effect及12模型；不含随机/翻牌逻辑，不新增手牌类型。
- aliens/fangzhou-card1-queue.js：复用完整9项转换，物理移除未接入的
  fangzhou_launch/fangzhou_additional_public_scan专用类型，改输出已有launch与
  gain_resources描述。不是在调用端另写类型适配表。全仓检索旧类型/旧CUSTOM_TYPES
  消费者，出现实际调用时先回设计复核，不能维持第二套执行路径。
- cards/play-domain.js：注册一个generic effect，校验owner/来源后调用正式翻牌；
  对生成描述执行现有归属检查后spawn，保留整串SCAN_FINALIZE及打牌后被动次序。
- rule-composition.js：将fangzhou_reward_reveal纳入隐藏信息边界；不能只加撤销屏障
  却让搜索把翻出的奖励当成根已知信息。基本奖励原有同名屏障也应被正确识别。
- 不修改正式合法动作family、不加UI resolver、不改4096/256/时间预算或启发式。

## 事务、恢复和不可逆边界

打牌仍在统一Action transaction内付费/移牌；高级翻牌紧接其效果队列。翻牌结果
保留index/tier/reshuffled事件及来源cardInstanceId，写fangzhou_reward_reveal屏障。
重洗属于同一提交的root修改，不使用Math.random，不在枚举/观察/模型构建阶段翻牌。
奖励后续在同一Session内执行，任何真实失败显式返回，不catch后改空奖励。

所有多选都由现有owner Decision处理；wrong-owner/stale/version由共享inputPort
拒绝。奖励选择中间保存再恢复不能重复翻牌/抽牌或重新付费，完整state/RNG/sequence/
合法集与不中断路径一致。撤销不得跨过翻牌边界，翻牌后的可逆步骤保持原journal规则。
搜索fork不能污染原根；隐藏屏障后计划继续使用现有遮蔽和失效检查，不缓存真实堆顶。

## 批量验收门禁

1. 旧复现改为对应的失败回归；12种card2均有相同正式翻牌效果，非方舟模型不变。
2. 9张固定堆顶分别正式打牌，核验付费一次、恰好翻一张、各奖励和真实后继；完整
   科技（含无合法目标）、4次扫描同flow、满上限发射、3移动、精选分别到最终边界。
3. 第5张之后重洗，冷实例与同实例恢复结果一致；奖励中间Decision恢复、错误owner/
   stale提交拒绝且不改变状态；翻牌不可逆及根fork隔离。
4. 验证搜索识别fangzhou_reward_reveal，不能把未知奖励当已知根牌面；检查必需字段，
   V输入审计、unit、唯一full-flow及代表性浏览器正式打牌smoke。未完成不能称修复通过。
5. 按标准去重/版本登记跑一次固定完整局，记录新增奖励造成的正常纠错分数变化及
   搜索节点、耗时、失败/截断。规则bug采用规则正确性例外，但整体Goal仍须≥108.5
   并消除未完成搜索；这轮不因此宣布性能通过。

实现前检查：正式Science.RESEARCH已经有无目标公转execute入口；不得复用residual
createFormalCardEffectNode的直接Decision方式接本奖励。正式Card Play LAUNCH已接受
ignoreRocketLimit；只允许规则规定的落空，不把任意错误认作“不可发射”。

文档同步范围：方舟implementation、卡牌DSL/API相关条目、AI隐藏屏障说明、测试清单
及版本/迭代记录；如果新类型影响审计目录，随实现更新。生产修复在临时分支，不切dev。
