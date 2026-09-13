# 外星人机制设计总纲

本文总结外星人机制的通用建模方式。具体外星人的规则与坐标放在 `assets/aliens/<外星人>/implementation.md`；原始规则文本保留在同目录 `face_detail.md`。

## 文档分层

- `AGENTS.md`：只保留外星人公共状态、入口索引和当前实现概览。
- `docs/alien-design.md`：记录外星人通用生命周期、代码接口、撤销边界和新增外星人的检查清单。
- `assets/aliens/<外星人>/implementation.md`：记录该外星人的运行时状态、揭示副作用、正面痕迹格、奖励、外星人牌和当前实现限制。
- `assets/aliens/<外星人>/face_detail.md`：保留设计源文本，不作为代码接口说明。

## 通用生命周期

1. 设置阶段从可选物种池分配两个不重复的隐藏身份，写入槽位 `assignedAlienId`；`alienId` 留空且 `revealed=false`。默认可选池为八种正式物种，每局只有两个。未揭示前 UI 只显示 `state1.png` / `state2.png` 和三色首痕迹区域。
2. 玩家获得外星人痕迹时，未揭示槽位先尝试放置三色首痕迹：`yellow`、`pink`、`blue`。放置首痕迹立即获得 state 图奖励：外星人 1 为 5 分 + 1 宣传，外星人 2 为 3 分 + 1 宣传。同色首痕迹只记录第一位拥有者；后续同色痕迹增加 `extraCount`，每枚 state 额外痕迹获得 3 分，并在 `extraMarkers` 里记录每枚额外 token 的归属玩家颜色。
3. 三种首痕迹都放置后进入待揭示状态；回合结束确认执行主动发现，翻开该槽位已分配物种并初始化专属状态，不重新随机选择身份。缺少有效预分配时显式失败。拥有该槽位首痕迹的玩家按数量获得对应揭示奖励；标准物种发外星人牌，九折/方舟使用专属奖励。
4. 揭示后的痕迹不再走普通首痕迹模型，而是进入该外星人的正面格位/专属交互。格位可为单占用、可叠放、需解锁、需支付资源、或绑定专属区域奖励。
5. 痕迹奖励可能直接给资源/分数/数据，也可能打开后续选择：外星人牌、公共牌精选、盲抽、扇区扫描、移动、任务完成等。
6. 外星人牌按物种自有规则进入手牌、保留区或专属区。打出后复用主行动效果队列、快速行动步骤、1/2/3 型任务、或物种自己的条件触发系统。

## 代码接口

搜索假设世界与真实局分开：共享Production在每次搜索根从公开可选池中无放回采样
未揭示身份及相应初始配置，排除根已揭示物种；不读取本局真实预分配。每份假设仍只有
两个物种，已揭示身份不改变。假设揭示沿正式规则结算奖励，真实提交仍按原局固定配置。
未揭示物种差分与方舟假设奖励资源后继的行为验证见 `tools/alien-reveal-hidden.test.js`。

- `randomizer/game/aliens/catalog.js`：登记外星人 ID、名称、素材目录。
- `randomizer/game/aliens/state.js`：公共槽位、本局揭示池、首痕迹、额外痕迹、揭示判定。
- `randomizer/game/aliens/randomizer.js`：设置阶段使用显式随机源分配两个不重复身份，主动发现只读取预分配；`initial-game-state.js` 使用独立开局流，盘面重置不重复分配。
- `randomizer/game/aliens/placement.js`：公共首痕迹坐标和各外星人正面格位坐标。
- `randomizer/game/aliens/<alien>.js`：物种专属状态、揭示初始化、痕迹放置、奖励、卡牌模型。
- `randomizer/game/effects/science-session.js`：普通与卡牌来源共用的痕迹目标枚举、放置、正式实体序号及领奖派发。卡牌转换使用 `createAlienTraceEffect(ownerId, cardEffect, cardInstanceId)`，保留来源允许颜色/目标条件；目标资格复用 Card Effects 的纯规则函数，不复制物种格位规则。空合法集在非 Decision 准备阶段明确记录落空。卡牌按痕迹数量的后计分在位置奖励（含选牌）之后执行。
- `randomizer/game/effects/residual-domain-session.js`：物种奖励、机会队列、followup、撤销与 journal 的唯一规则 owner。
- `randomizer/app/browser-host/decision-ui.js`、`resident-renderer.js`：只消费 BrowserProjection 的物种 Decision 与面板 presentation。
- `randomizer/app.js`：只装配 Production Composition、投影、输入与 DOM。

外星人专属状态统一挂在 `alienGameState.<alienId>`。状态字段应能完整表达 UI 和规则，不依赖 DOM 作为权威数据。

固定盘面的隐藏身份约定见 `docs/fixed-boards.md`。`randomizeAlienAssignments` 接收
的固定配置统一来自 `state/fixed-world-config.js`，与普通牌初始化共用同一来源。
该方法接收
`seed` 和显式 `random`：已有固定定义时读取两槽身份，否则从可选池无放回取两个。
固定身份与可选池冲突时显式失败。共享初态只为两槽选中物种调用
`createInitialConfiguration`，以种子、槽位和物种分离随机流，保存到该物种的
`initialConfiguration`；不揭示、不发奖、不激活配件。其余物种不生成配置。
揭示复制读取预生成配置，不修改配置原件；缺配置显式报错，不在揭示时补抽。
方舟后续混洗按开局专属种子和已保存混洗次数生成，不消耗其他领域随机数。
完整恢复、隐藏信息与跨宿主验证尚未完成，当前不能宣称完整固定世界完成。

## 撤销与不可逆边界

确定性效果优先可撤销：资源、数据、分数、痕迹放置、任务移牌、化石搬运、symbol 移动等，都由 Effect Session 记录 undo frame。

以下行为属于新信息边界，应写入不可撤销屏障：

- 揭示外星人并初始化随机牌库、化石、symbol、异常标记、解锁牌等。
- 揭示时按首痕迹归属发放外星人牌。
- 盲抽基础牌或外星人牌。
- 拿走展示外星人牌后翻新展示牌。
- 方舟 card1 翻牌或重新洗牌。
- 公共牌精选后补出新公共牌。
- 太阳系旋转本身。

屏障本身和屏障之前的 journal 不可撤销；屏障之后的新确定性步骤仍可单独撤销。恢复只接受 Composition lifecycle envelope 与 Effect Session checkpoint。

## UI 与坐标

- 未揭示槽位使用公共 `ALIEN_TRACE_MARKER_SLOTS` 和 `ALIEN_EXTRA_TRACE_MARKER_SLOTS`；槽位揭示后不能补首痕迹，但已拥有首痕迹的颜色仍可使用 `ALIEN_EXTRA_TRACE_MARKER_SLOTS` 追加 state 额外痕迹并获得 3 分。
- 任务、终局或卡牌条件按“某外星人/某物种拥有痕迹”统计时，应合并该槽位揭示前 state 面板的首痕迹、state 额外痕迹和揭示后的正面痕迹。state 额外痕迹按 `extraMarkers` 中每枚额外 token 的归属计入；旧状态缺少该列表时才回退为首痕迹拥有者。若条件明确要求正面位置、空格或特定位置奖励，则只按对应物种正面格位计算。
- 揭示后的正面格位必须在 `placement.js` 固化坐标，并在对应 `implementation.md` 说明坐标来源和叠放规则。
- 在奖励结算前判断“是否还存在任一合法痕迹位置”时，统一调用 `SetiAliens.canPlaceAnyRevealedAlienTrace`；该判断会复用各物种的格位与资源支付规则，不能只按“槽位已揭示”推定正面仍可放置。普通痕迹奖励应先保留可执行的方舟解锁分支；若方舟也不可解锁且面板无合法位置，则把奖励记为落空并直接完成当前效果，即使该效果为 `required` 或不可跳过也不能停在空选择状态。
- 外星人牌展示、盲抽和取消统一生成标准 Decision；拿展示牌后刷新展示牌属于不可逆。
- 共用外星人拿牌执行器的取消只放弃当前拿牌，不撤销此前痕迹/分析等奖励；使用正式
  状态提交结果继续Session，不消耗RNG/实体序号，不改变牌堆、展示或手牌，不生成
  抽牌事件或新增不可逆屏障。空牌堆只有取消时也遵守同一契约。

## 展示牌与盲抽的共用约定

阿米巴、虫、奥陌陌、半人马、符文族、异常点共用以下取牌约定；这是六种可选物种
的机制分组，不表示每局出现六个外星人。每局仍只有两个槽位。

- 盲抽和展示补牌均从各自已有 `cardDeck` 顶部取牌，不在取牌时再次随机选索引。
- 盲抽牌堆耗尽后不重建、不回洗；尚在展示区的最后一张仍可领取。
- 展示牌和盲抽牌堆都耗尽时，取牌返回 `ALIEN_CARD_DECK_EMPTY`，不创建卡牌。
  正式选牌 Decision 只剩取消，不消耗 RNG 或实体序号。
- 以上仅描述运行期取牌；物种随机配件和完整世界种子的接入仍在 FIXED-WORLD-01 中，
  不能据此声称已实现完整固定世界。九折与方舟的专属牌机制另行验证。

## 新增外星人检查清单

- 在 `catalog.js` 登记外星人 ID、名称和素材路径。
- 在 `state.js` 或专属模块中定义默认状态、揭示初始化和 reset 行为。
- 在 `placement.js` 定义正面痕迹格、奖励位、symbol 位或专属棋子显示坐标。
- 在 `residual-domain-session.js` 接入揭示副作用、奖励队列和外星人牌获取；`app.js` 只装配投影与输入。
- 明确每个奖励是可撤销 Effect，还是不可逆屏障。
- 若有外星人牌，记录牌堆、展示牌、盲抽、打出费用、进入区域、任务类型和终局计分。
- 添加或更新 `assets/aliens/<外星人>/implementation.md`。
- 添加单元测试，至少覆盖状态初始化、痕迹放置、奖励分支和不可逆边界。

## 当前物种文档

- 九折：`assets/aliens/九折/implementation.md`
- 异常点：`assets/aliens/异常点/implementation.md`
- 半人马：`assets/aliens/半人马/implementation.md`
- 方舟：`assets/aliens/方舟/implementation.md`
- 虫：`assets/aliens/虫/implementation.md`
- 阿米巴：`assets/aliens/阿米巴/implementation.md`
- 奥陌陌：`assets/aliens/奥陌陌/implementation.md`
- 符文族：`assets/aliens/符文族/implementation.md`
