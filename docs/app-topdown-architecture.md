# App Top-Down 最终架构

本文档记录浏览器 app 层的最终源码边界。页面仍采用传统 `<script>` 顺序加载；规则语义以 `randomizer/game/**` 为准，`randomizer/app/**` 负责 UI 运行域，`randomizer/app.js` 是 composition root 与跨 flow 顶层总控。

## 1. 行数预算与迁移结果

五个迁移域启动前，`randomizer/app.js` 为 29,573 行（`9414cc4^`）；各阶段收口后依次为：

| 阶段 | app.js 行数 | 主要迁移 |
|---|---:|---|
| 迁移前 | 29,573 | 单文件承载具体 effect、卡牌、外星人、科技/公司、渲染/日志 |
| effect executors | 25,248 | `app/effects/**` |
| card/income/scan/trigger | 19,772 | `card-runtime`、`income-runtime`、`scan-flow`、`card-trigger-runtime` |
| alien species runtime | 16,035 | `app/aliens/species-runtime.js` |
| tech/industry runtime | 13,558 | `tech-runtime.js`、`industry-runtime.js` |
| render/log runtime | 11,997 | `render-runtime.js`、`action-log-runtime.js` 等 |
| 最终严格验收 | 9,930 | `final-score-ai-runtime.js`、`turn-end-flow.js`、`action-interaction-runtime.js` |

最终结果低于 10,000 行硬门槛。新增的三个收口模块分别为 1,122、547、1,045 行，均低于约 3,000 行的单文件预算。

## 2. 加载与装配顺序

`randomizer/index.html` 的加载顺序保持为：

1. `solar-system/**` 与 `game/**` 注册规则层全局模块。
2. 独立 app runtime 注册 `window.SetiApp*`：
   - 基础设施：`dependencies`、`constants`、`dom`、`runtime`、`refresh`、`events`
   - 交互/流程：`start-screen`、`turn-flow`、`turn-end-flow`、`hand-flow`、`scan-flow`
   - 行动：`action-runtime`、`action-interaction-runtime`
   - effect：`effect-flow`、`effect-choice-flow`、`effects/**`
   - 卡牌/科技/公司：`card-runtime`、`card-trigger-runtime`、`income-runtime`、`tech-runtime`、`industry-runtime`
   - 外星人：`alien-runtime`、`alien-ui`、`aliens/species-runtime`
   - 展示/恢复：`render-runtime`、`final-ui-runtime`、`action-log-runtime`、`game-recovery`
   - AI/API：`final-score-ai-runtime`、`ai-controller`、`public-api`、`headless-env`
3. `app.js` 调用 `SetiAppDependencies.collectDependencies(window)`，创建状态并把显式 context 注入各 runtime。
4. `bootstrap` 与 `public-api` 完成事件、`window.SetiRandomizer` 和 headless 入口装配。

`app/dependencies.js` 是必需全局模块的权威表；`dependencies.test.js` 与 `script-loading.test.js` 分别校验全局依赖契约和 HTML 脚本文件存在性。

## 3. 各迁移域最终归属

### Effect

- `effects/movement-scan.js`：移动、落点、轨道/登陆、扇区扫描执行器。
- `effects/rewards.js`：资源、数据、抽牌、条件、科技和扫描奖励。
- `effects/aliens.js`：外星人 effect 与 continuation。
- `effects/dispatcher.js`：顶层 effect type 分发。
- `effect-flow.js` / `effect-choice-flow.js`：队列、history step 与选择器生命周期。

`app.js` 只保留 executor context 注入、跨 flow continuation 和少量兼容转发，不再保留巨型 type switch 或成片 effect 实现。

### Card / income / scan / trigger

- `card-runtime.js`：出牌、弃牌角标、公共牌、PASS 预留与卡牌移动。
- `card-trigger-runtime.js`：任务、1 型触发、奖励队列与续跑。
- `income-runtime.js`：收入与轮开始收益。
- `scan-flow.js`：扫描目标、扇区结算、延迟补牌。
- `hand-flow.js`：手牌/支付选择与相关交互状态。

`app.js` 只连接这些 runtime 与 action/effect/history/render 层。

### Alien

- `alien-runtime.js`：通用揭示、痕迹与队列适配。
- `alien-ui.js`：揭示提示、痕迹 picker 与物种放置模式。
- `aliens/species-runtime.js`：八个物种的奖励、牌/任务 dialog、followup 与面板实现。
- `turn-end-flow.js`：回合末批量揭示及其阻塞 continuation。

`app.js` 只保留显式 context、跨 runtime 转发和顶层状态所有权，不保留物种实现正文。

### Tech / industry

- `tech-runtime.js`：科技选择、蓝槽、确认/取消/undo。
- `industry-runtime.js`：公司主动/被动、picker、pending 与 history 回滚。
- 公司规则与数值仍由 `game/industry/**` 提供。

`app.js` 只负责把公司/科技 runtime 接入主要行动、effect 和刷新总线。

### Render / debug / log

- `render-runtime.js`：玩家、卡牌、数据、火箭、marker、坐标转换和引用贴图。
- `final-ui-runtime.js`：终局计分与结果 UI。
- `action-log-runtime.js`：日志 draft/entry、导入与 DOM 展示。
- `debug-runtime.js`：debug、calibration、quick sector scan、failsafe 与 reveal 调试入口。
- `action-interaction-runtime.js`：移动箭头、冥王星交互、数据放置 picker。
- `final-score-ai-runtime.js`：终局板块 AI 估值、可行性惩罚与竞速调整。

`app.js` 只保留统一刷新调度、顶层事件路由所需转发和 controller 装配。

## 4. app.js 最终职责

`randomizer/app.js` 允许保留：

1. 状态所有权：`solarState`、`playerState`、`turnState`、`rocketState`、`cardState`、`alienGameState` 与 runtime pending。
2. Composition root：收集依赖、创建 runtime/controller、注入显式 context。
3. 跨 flow 总控：主要行动、快速行动、effect/history、AI 与回合推进之间的 continuation。
4. 统一刷新与兼容转发：组合 `render*`、`update*`，向传统事件/API 暴露稳定函数名。
5. 少量仍需同时触及多域状态的恢复、撤销和顶层行动事务胶水。

不得重新加入：

- 具体 effect type switch；
- 卡牌/收入/扫描/任务触发分支正文；
- 外星人物种、科技、公司或 debug 的成片实现；
- 玩家/卡牌/外星人面板的节点构建；
- AI 策略公式、公开 API 列表或 headless schema 实现；
- 大段静态常量、固定 DOM 查询或事件绑定。

## 5. Public API 与 headless 边界

- `public-api.js` 组装 `window.SetiRandomizer`，`app.js` 只提供显式 context。
- `headless-env.js` 提供 headless observation/action/replay 适配；它通过公开 API 和注入回调工作，不读取 `app.js` 局部实现。
- `ai-controller.js` 通过 state getter/setter 与动作回调访问 app 状态；迁移不得复制 pending 状态。
- 新 runtime 均同时支持 `window.SetiApp*` 和 `module.exports`，便于传统浏览器加载与 Node 回归。

## 6. 超大文件与残余风险

- `app/aliens/species-runtime.js` 为 4,367 行，超过约 3,000 行。它不是本轮新增文件；当前边界是“八物种共用机会队列、dialog 与渲染 context 的单一物种运行域”。后续继续拆时，应按物种或 `rewards/dialogs/render` 子域拆分，并保持共用队列只有一个所有者。
- `app/ai-controller.js` 约 22,960 行，同样是既有超大文件。终局板块估值已迁到 `final-score-ai-runtime.js`；后续应按 observation/candidates/decision/batch analytics 拆分，避免把新策略继续堆回控制器。
- `app.js` 虽已低于预算，仍是 9,930 行的大型 composition root。后续只允许按明确跨域边界继续减小，不以压缩格式或复制状态换取行数。
- 浏览器行为依赖传统脚本顺序；新增 runtime 必须同步更新 `index.html`、`dependencies.js` 和依赖测试。

## 7. 验证基线

每次跨模块变更至少执行：

```bash
node --check randomizer/app.js
rg --files randomizer -g '*.test.js' | sort | while IFS= read -r test; do
  node "$test" || exit $?
done
```

涉及脚本顺序、DOM、首屏或公开 API 时，还要用真实浏览器加载 `randomizer/index.html`，确认无初始化异常并检查 `window.SetiRandomizer` 可用。
