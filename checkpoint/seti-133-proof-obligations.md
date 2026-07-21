# SETI-133 Browser Render / UI Projection proof obligations

| ID | 验收条款 | 可证伪命题 | 最小反例 | 唯一落点 | 验证证据 | 失败语义 |
|---|---|---|---|---|---|---|
| R1 | render-runtime 只消费当前 authority 派生的只读 projection | `createRenderRuntime` 的生产 context 不含长期规则 root/slice，任一传统 slice getter 都不会被读取 | 给 `playerState/turnState/cardState/solarState/...` 安装 poison getter 后创建并调用 renderer | `browser-host/projection-adapter.js` + `app/render-runtime.js` | context 结构扫描、poison test、projection 深冻结断言 | 缺失/错误 schema projection 立即抛错，不 fallback 到 closure slice |
| R2 | renderer 无规则 mutation | 任意 render 方法前后 projection bytes、authority snapshot/version 与规则端口调用计数不变 | 在补牌、外星机会、AI 调度端口安装 poison；调用 public cards/player stats/readout renderer | `app/render-runtime.js` | render-time mutation spy 恒为 0；冻结对象写入抛错 | renderer 只更新 DOM；规则写调用不可达 |
| R3 | resident renderer、action bar、Decision UI 只接收规范 projection / ViewState | 传统 root、workingState、长期 slice 不能作为这些 UI 的输入；同 projection 可重建等价 DOM/model | 传 legacy getter、清空 DOM/ViewState 后重建、未知 renderer kind | `browser-host/resident-projection.js`、`resident-renderer.js`、`action-bar.js`、`decision-ui.js` | legacy reject、rebuild、choice identity/unknown fail-closed tests | 未知或 stale identity 不显示可提交控件/不调用规则端口 |
| R4 | projection provider 不泄露 mutable root 或隐藏信息 | provider 输出递归冻结；对手手牌/牌库内容 canary 不出现在序列化 projection 中 | 修改嵌套 resources；注入 opponent/deck canary | `browser-host/projection-adapter.js` | deep-freeze、privacy canary、source identity tests | visibility policy 非对象或 source identity 不合法时 fail-fast |
| R5 | 删除 UI 同步与回灌 | render 调用不得补牌、创建机会、续跑 AI 或把 ViewState 回写规则状态 | 空公共牌、待外星机会、AI 当前席位三种状态仅调用 renderer | `app/render-runtime.js` 与原规则 flow caller | 禁用 callback 结构扫描 + runtime poison | 状态推进仍由 card/alien/AI domain flow 负责，renderer 不兜底 |

## 边界说明

- 本阶段迁移 Browser render、resident renderer、Action Bar 与 Decision UI 的读取边界；规则输入仍由现有生产 Action/Decision host 承担。
- `createCoordinateRuntime` 同时包含指针坐标换算和规则 marker 同步，属于 SETI-134 的 domain runtime 窄端口范围；本阶段不把它伪装成 renderer，也不创建第二 owner。
- SETI-128 才执行最终 composition lifecycle 原子切换；本阶段 projection provider 必须可被其原样接线。
