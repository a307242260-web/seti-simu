# SETI 浏览器原型

这是一个无构建步骤的 SETI 浏览器原型仓库。页面入口是 `randomizer/index.html`，浏览器装配层在 `randomizer/app/**`，主 UI 与流程编排在 `randomizer/app.js`，核心规则逻辑集中在 `randomizer/game/**`。

当前仓库已经包含：

- 可直接打开试玩的单页原型界面
- 玩家资源、手牌、收入、开局选择与回合流程
- 发射、移动、环绕、登陆、扫描、分析、研究科技、打牌、PASS 与快速行动
- 科技、公司、外星人、终局计分与行动日志
- 电脑玩家 AI、自博弈批跑、A/B 测试与诊断分析
- Node 侧语法检查与较完整的单元测试

## 快速开始

### 直接打开

这是纯前端原型，没有 `package.json`，也没有构建步骤。

最直接的使用方式：

1. 打开 `randomizer/index.html`
2. 点击“开始游戏”
3. 在开始界面选择人数、电脑难度、外星人与公司池

如果浏览器对本地资源或下载行为有限制，建议用一个本地静态服务器打开仓库根目录，再访问 `randomizer/index.html`。

### 调试入口

- `randomizer/app/public-api.js` 组装对外暴露的 `window.SetiRandomizer`
- `randomizer/index.html` 开始界面支持调试开关与行动日志开关
- `randomizer/app/ai-controller.js` 提供 AI 自动机、批跑与策略测试相关入口

## 验证方式

仓库默认没有构建命令，验证以 Node 语法检查和测试脚本为主。

### 默认验证

```bash
node --check randomizer/app.js
rg --files randomizer -g '*.test.js' | sort | while IFS= read -r test; do
  node "$test" || exit $?
done
```

### 额外常用检查

```bash
node --check randomizer/game/history/action-history.js
node --check randomizer/game/history/transactions.js
node --check randomizer/game/abilities/scan.js
```

### 资料生成脚本

```bash
python tools/build_card_catalog_js.py
python tools/analyze_alien_cards.py
```

## 代码地图

### 入口与装配层

- `randomizer/index.html`：浏览器页面入口
- `randomizer/app/dependencies.js`：收集并校验 app 层依赖
- `randomizer/app/constants.js`：app 层静态配置与常量
- `randomizer/app/dom.js`：固定 DOM 元素注册表
- `randomizer/app/events.js`：页面事件绑定与 overlay 分发
- `randomizer/app/action-log-export.js`：行动日志导出
- `randomizer/app/public-api.js`：`window.SetiRandomizer` API
- `randomizer/app/ai-controller.js`：AI 自动机、批跑、A/B 测试与控制器
- `randomizer/app.js`：运行态、流程编排、效果队列、日志与 UI 接线

### 核心规则层

- `randomizer/solar-system/**`：太阳系盘面、旋转与渲染
- `randomizer/game/players.js`：玩家资源、收入、手牌、初始状态
- `randomizer/game/rockets.js`：火箭/探测器状态与移动
- `randomizer/game/planet-stats.js`：环绕、登陆与统计
- `randomizer/game/actions/**`：主行动、快速行动、奖励与交易
- `randomizer/game/abilities/**`：能力链与复用能力函数
- `randomizer/game/history/**`：撤销、事务历史、不可撤销边界
- `randomizer/game/cards/**`：牌库、卡牌效果、任务状态
- `randomizer/game/data/**`：数据池、星云 token、扇区结算
- `randomizer/game/tech/**`：科技供应区、玩家科技板、bonus 与渲染
- `randomizer/game/industry/**`：公司牌主动/被动能力
- `randomizer/game/aliens/**`：外星人状态、揭示、痕迹与物种专属机制
- `randomizer/game/final-scoring.js`：终局板块标记流程
- `randomizer/game/end-game-scoring.js`：终局实时与结算计分
- `randomizer/game/ai/**`：AI 价值模型、目标系统、规划器与分析

## 建议先读

### 先看这些

- `AGENTS.md`：仓库快速入口与任务导航
- `docs/mechanics-reference.md`：完整机制参考
- `docs/app-architecture.md`：app 装配层边界与拆分方向
- `docs/effect-glossary.md`：效果术语表
- `docs/ai-design.md`：AI 设计与验证口径

### 专题文档

- `docs/card-modeling-dsl-spec.md`：卡牌 DSL 规范
- `docs/alien-design.md`：外星人通用设计总结
- `assets/industry/industry-abilities.md`：公司牌建模说明
- `assets/final/final_detail.md`：终局 A/B/C/D 公式

### 外星人物种文档

- `assets/aliens/九折/implementation.md`
- `assets/aliens/异常点/implementation.md`
- `assets/aliens/半人马/implementation.md`
- `assets/aliens/方舟/implementation.md`
- `assets/aliens/虫/implementation.md`
- `assets/aliens/阿米巴/implementation.md`
- `assets/aliens/奥陌陌/implementation.md`
- `assets/aliens/符文族/implementation.md`

## 维护提示

- 这是无构建、全局命名空间风格项目；新增脚本时要考虑 `index.html` 的加载顺序
- 规则语义优先放在 `randomizer/game/**`；`app.js` 负责 UI 编排与状态接线
- 改机制、状态模型、能力流程或资料路径时，同步更新对应文档
- 修改完成后先跑 Node 校验和测试，再提交

## 当前已知维护风险

- `randomizer/app.js` 体量很大，承担了过多流程编排与 pending 状态
- `randomizer/app/ai-controller.js` 已独立，但与 app 主流程之间仍有显式耦合
- 仓库的玩法面已经较完整，后续的主要工程风险更偏向可维护性，而不是“规则完全没实现”
