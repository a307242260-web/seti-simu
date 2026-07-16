# App Top-Down 拆解图

本文档回答两个问题：

1. 现在 `randomizer/app.js` 和 `randomizer/app/**` 里到底还有哪些逻辑。
2. 站在 top-down 视角，浏览器 app 层已经拆成了哪些模块、还剩哪些顶层胶水没有收口。

这里的 “app 层” 指 `randomizer/index.html` 加载后，由 `randomizer/app/**`、`randomizer/app.js`、页面 DOM 和 `window.SetiRandomizer` 共同组成的浏览器装配层。规则语义仍以 `randomizer/game/**` 为准。

## 1. 顶层视角

从上往下看，当前浏览器端可以拆成 5 层：

1. 页面壳与脚本加载
2. app 基础设施层
3. app 业务编排模块层
4. `app.js` 顶层编排 / 渲染 / 胶水层
5. `game/**` 规则层

可以用下面这个结构来理解：

```text
index.html
  -> solar-system/** + game/** 全局模块
  -> app/dependencies.js
  -> app/constants.js / dom.js / runtime.js / refresh.js
  -> app/start-screen.js / turn-flow.js / hand-flow.js / scan-flow.js
  -> app/effect-flow.js / effect-choice-flow.js
  -> app/action-log-*.js / game-recovery.js / action-briefing.js
  -> app/alien-ui.js / alien-runtime.js
  -> app/bootstrap.js / public-api.js / ai-controller.js
  -> app.js
       -> 组装运行时状态
       -> 注入模块上下文
       -> 承接剩余高耦合流程
       -> 统一驱动 render / pending / quick action / debug / API
```

## 2. 当前模块分层

### 2.1 页面壳

- `randomizer/index.html`
  - 负责页面骨架、各类面板 DOM、overlay 容器、调试区和 action bar。
  - 按传统 `<script>` 顺序加载，没有 bundler，也不是 ES module。

### 2.2 基础设施层

这些模块不直接定义玩法规则，主要负责 app 的底座。

- `randomizer/app/dependencies.js`
  - 收集所有 `window.Seti*` 依赖，校验脚本顺序。
  - 现在已经把 app 层和 `game/**`、`solar-system/**` 的依赖关系显式列出来。

- `randomizer/app/constants.js`
  - app 静态常量、图标路径、奖励表、UI 参数。

- `randomizer/app/dom.js`
  - 固定 DOM 引用注册表。

- `randomizer/app/runtime.js`
  - 统一运行态容器。
  - 当前至少收拢了：
    - `pending`
    - `actionLog`
    - `actionBriefing`
    - `startScreen`
    - `selection`
    - `ui`

- `randomizer/app/refresh.js`
  - 高频刷新组合：
    - `refreshPlayerPanels`
    - `refreshActionState`
    - `refreshBoardState`
    - `refreshAfterPendingChange`

- `randomizer/app/events.js`
  - 页面事件绑定和 route。
  - 把 overlay / resize / 拖拽 / pointer 之类入口统一收在一处。

### 2.3 业务编排模块层

这层已经承接了原先 `app.js` 里最容易形成独立边界的大块逻辑。

- 启动与回合壳层
  - `app/start-screen.js`
  - `app/turn-flow.js`

- 手牌 / 出牌 / 移动支付
  - `app/hand-flow.js`

- 公共牌 / 扫描
  - `app/scan-flow.js`

- 效果队列 / 历史流
  - `app/effect-flow.js`
  - `app/effect-choice-flow.js`

- 外星人 app 层
  - `app/alien-ui.js`
  - `app/alien-runtime.js`
  - `app/alien-trace-reward-flow.js`

- 行动日志 / 恢复 / 导出
  - `app/action-log-runtime.js`
  - `app/action-log-export.js`
  - `app/game-recovery.js`
  - `app/action-briefing.js`

- 调试 / API / 启动 glue
  - `app/bootstrap.js`
  - `app/public-api.js`
  - `app/ai-controller.js`
  - `app/headless-env.js`

### 2.4 `app.js` 当前角色

`app.js` 现在已经不再是“把所有东西都写进去”的唯一实现文件，但它仍然是 app 层最大的总装配点。

当前它主要承担 4 类职责：

1. 组装全局依赖和运行态
2. 连接各 app 模块与 `game/**`
3. 保留尚未完全独立的高耦合流程
4. 承担大量渲染 / 调试 / 状态读出 glue

### 2.5 `game/**` 规则层

- `randomizer/game/**`
  - 仍是规则实现主层。
  - 发射、移动、扫描、科技、外星人规则、公司牌、历史回滚、卡牌 DSL、数据池等核心语义都在这里。

## 3. `app.js` 里现在还剩哪些逻辑

虽然很多块已经迁出，但 `app.js` 还保留着几类“高耦合编排胶水”。

### 3.1 初始化与总装配

文件开头仍负责：

- 从 `SetiAppDependencies` 收集依赖
- 创建 `solarState`、`playerState`、`turnState`、`rocketState`、`cardState`、`alienGameState` 等大状态
- 构造 `runtime`、`refreshHelpers`
- 创建并注入各 helper/controller 的 context
- 挂接 DOM、常量、历史栈和 pending 状态

这部分本质上是“app composition root”。

### 3.2 剩余的玩家交互编排

尽管 `hand-flow`、`scan-flow`、`effect-choice-flow` 已经拆出，`app.js` 里仍留有不少顶层交互 glue：

- 各类 pending 之间的切换与兜底取消
- 多个 flow 之间的继续执行 / 中断 / 收尾
- 一些需要同时读写：
  - `pendingState`
  - `rocketState.statusNote`
  - `actionHistory`
  - `quickActionHistory`
  - `render*`
  - `updateActionButtons`
  的流程总控

典型还留在 `app.js` 的，就是“一个选择器结束后，要不要继续下一个 effect / quick action / turn-end flow”的决策 glue。

### 3.3 卡牌、收入、公司、终局等跨模块流程

`app.js` 里还保留着一些跨模块编排域：

- 收入流程与轮开始收益编排
- 公司牌 1x 能力和被动奖励的总控
- 部分 card trigger / task completion / score source 接线
- final score pending mark、终局结果汇总和展示
- Pluto、行业被动、特殊 company / alien 分支的 app 层 glue

这些逻辑的问题不是“规则没拆”，而是它们仍然同时碰：

- 玩家状态
- 历史记录
- UI 状态
- action log
- effect flow
- quick action

所以还没有被完全压成更薄的模块边界。

### 3.4 渲染层仍有大量顶层函数

当前 `app.js` 仍直接承载大量 render 函数，包括：

- board / wheel / sector / rotate token
- rocket / marker / planets reference / alien board marker
- public cards / hand / reserved cards / opponent stats
- final score board / final result dialog
- state readout / debug 面板 / hover preview

也就是说，业务流程拆出去了很多，但视图渲染层还没有被完全分到独立的 render-runtime 子模块。

### 3.5 调试与开发辅助逻辑

`app.js` 还保留大量 debug / calibration / cheats：

- reveal alien for debug
- fill nebula data
- sector win debug
- debug gain card / income / score
- 各 alien 校准入口
- 坐标 readout / token size / marker layout 调试

这些内容很适合最终再做一次“debug-runtime / calibration-runtime”收口。

## 4. 现在已经拆出来的逻辑图

如果从“业务域”视角看，当前 app 层已经形成下面这些块：

### 4.1 已经相对独立的块

- 启动入口域
  - `start-screen.js`
  - `turn-flow.js`

- 手牌交互域
  - `hand-flow.js`

- 公共牌 / 扫描域
  - `scan-flow.js`

- 效果执行域
  - `effect-flow.js`
  - `effect-choice-flow.js`

- 外星人 app 域
  - `alien-ui.js`
  - `alien-runtime.js`
  - `alien-trace-reward-flow.js`

- 日志 / 恢复 / 导出域
  - `action-log-runtime.js`
  - `action-log-export.js`
  - `game-recovery.js`
  - `action-briefing.js`

- bootstrap / API / AI 域
  - `bootstrap.js`
  - `public-api.js`
  - `ai-controller.js`
  - `headless-env.js`

### 4.2 还没有完全独立的块

- render-runtime
  - 目前大部分仍在 `app.js`

- debug-runtime
  - 目前大部分仍在 `app.js`

- player panel / board visual runtime
  - 仍与顶层状态和 action button 刷新强耦合

- final scoring / final result UI runtime
  - 规则在 `game/**`，但面板编排和展示仍主要在 `app.js`

## 5. 当前 top-down 模块架构建议

如果按 top-down 再整理一层，当前最合理的 app 架构可以写成：

```text
App Shell
  - index.html
  - style.css

App Infrastructure
  - dependencies.js
  - constants.js
  - dom.js
  - runtime.js
  - refresh.js
  - events.js

App Flow Modules
  - start-screen.js
  - turn-flow.js
  - hand-flow.js
  - scan-flow.js
  - effect-flow.js
  - effect-choice-flow.js
  - alien-ui.js
  - alien-runtime.js
  - alien-trace-reward-flow.js

App Support Modules
  - action-log-runtime.js
  - action-log-export.js
  - game-recovery.js
  - action-briefing.js
  - ai-controller.js
  - public-api.js
  - bootstrap.js
  - headless-env.js

App Composition Root
  - app.js

Game Rules
  - game/**
```

其中 `app.js` 的理想终态应该是：

- 只保留 composition root
- 少量顶层 render schedule
- 极少量跨模块 glue

而不是继续承载成千上万行具体流程和渲染细节。

## 6. 当前重构完成度判断

按今天代码现状看：

- “模块边界是否已经形成”：
  - 是，已经形成了。
- “`app.js` 是否仍然过大”：
  - 是，仍然过大。
- “问题还在不在于没有拆计划”：
  - 不在。现在的问题已经从“没有拆分计划”变成“哪些剩余 glue 还值得继续下沉，哪些应接受留在 composition root”。

换句话说，当前阶段不是继续补新的大类子 issue，而是：

1. 用 top-down 视角确认 app 层最终目标结构
2. 识别 `app.js` 剩余逻辑中哪些属于：
   - 可继续模块化的 render/debug/runtime
   - 应保留在顶层的 composition glue
3. 在这一步确认之后，再决定最后一轮收口和文档更新

## 7. 与 `AGENTS.md` 的关系

这份文档是给后续重写 `AGENTS.md` 准备的中间稿。

在“架构确认 + 重构完成收口”之前，`AGENTS.md` 仍应保持快速导航角色，不在里面塞进这份 top-down 长文。

等确认收口后，再把 `AGENTS.md` 重写成：

- 更薄的入口导航
- 指向这份架构文档
- 反映最终确认后的 app 层模块边界
