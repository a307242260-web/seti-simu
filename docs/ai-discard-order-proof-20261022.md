# AI 弃牌堆顺序等价（2026-10-22）

结论：当前 Production 规则中，完整状态只差 `cards.discardPile` 的排列时，
向前执行的合法选择、统一分析观察和可达规则结果相同。新搜索按实体 ID 排序该数组生成身份键。
实际规则状态、页面展示和 replay 仍记录真实弃牌顺序。

此证明适用于当前固定牌堆规则和 `seti-analysis-observation-v1`；
其他数组仍保持原序，包括手牌、抽牌堆、预留牌、初始选择和未确认的 selected。
证明版本为 `seti-quick-trade-discard-component-v2`，搜索版本为 `seti-complete-decision-search-v2`。

## 完整读取清单

按 `rg -n discardPile randomizer --glob '*.js' --glob '!*.test.js'` 检查全部当前引用：

| 读取/写入点 | 语义与顺序无关的依据 |
| --- | --- |
| `game/cards/deck.js` | 收集已占用 catalog ID 的 Set；清理权威抽牌序时仅判断 membership，不迭代弃牌顺序生成新牌序。耗尽不洗回弃牌。新增弃牌只追加实体。 |
| `game/cards/play-domain.js` | 插入收入与打出后回手均按指定唯一 cardInstanceId 查找、移除；取出的实体与原来位置无关。 |
| `game/effects/residual-domain-session.js` | 按指定唯一实体 ID 查找任务卡图片；不按弃牌堆位置产生决策或奖励。 |
| `game/abilities/scan.js` | 扫描弃牌只追加所选实体。 |
| `game/production-kernel.js` | 初始化清空弃牌堆，不消费原有顺序。 |
| `game/state/high-coupling-slices.js` | 逐实体校验所有权和唯一性；数组索引只用于错误路径。合法状态满足唯一实体 ID 前提。 |
| `app/rule-observation.js` | 分析观察只输出 discardCount。 |
| `app/browser-host/projection-adapter.js` | 完整数组仅用于 resident UI；可信分析端口不传递这层 UI 壳。 |

当前消费者均是追加、按 ID 查找、集合判断、计数、初始化或校验。
追加相同实体保持集合相等；按 ID 移除相同实体后，剩余集合仍相等。
其他规则操作不读取该顺序。因此对任意相同合法选择进行一步执行后，状态仍只可能差弃牌排列；
配合相同 RNG 和其余状态，可对后续路径归纳。若新增按位置读取、洗回牌库或不同观察路径，
必须重审本证明及相应测试，不能沿用此等价。

## 从有序点击到组合出口

交易弃两张牌，A→B 和 B→A 的确认结果只差弃牌排列。
五张手牌原有20个有序支付，归为10个等价类；全部原始支付均有归属。
每个组合仍考虑两个执行顺序，选择实际点击数更少的一种，同分按当前 firstActionId 稳定选择。
已选满同一组合时直接确认；不用先取消再重排。

支付事件本身携带有序 `cardInstanceIds`。可信层检查本席保留牌触发器和本回合事件奖励：
若它们观察 `quick_trade_payment`，保留原有有序出口，不合并组合；
若它们观察 `quick_trade_discard_selection`，点击已有额外规则效果，关闭纯选择宏步。
测试构造了按支付列表记录 distinctBy 进度的真实事件奖励，两种顺序确实生成不同状态；
也构造点击即获信用点的奖励，验证不能再按无效果 toggle 处理。

纯点击本身的 selected 仍有序，因为它影响到下一目标的最短编辑成本。
完成证据按无序目标集合索引，复用时重新选择当前最短执行顺序。
初始资源牌的选择顺序没有套用此证明。

## 反例与验证

`analysis-port.test.js` 穷举五张手牌的26个原始选择状态；
对每个组合执行两种真实有序支付，并比较确认后的身份、完整分析观察和合法集。
两种顺序后的全部公共取牌/盲抽继续执行到信息屏障，结果一致。
钱、电两种弃牌交易还比较了确认后的每个正式合法行动。
根状态与 RNG 不变、复用开关、不同资源事实及模型失效的原有测试继续运行。

单决策基准保留逐点击对照与组合宏步对照。主行动整体是否闭合、整局速度与分数另行验收；
此处只证明这些排列不构成新的必要分支。
