# SETI-76 扫描、数据与登陆多选择链 proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 唯一责任点 | 验证证据 | 失败语义 |
|---|---|---|---|---|---|
| 多目标/多参与者/多次 decision trace 可重建 | 扫描目标、扇区、两名参与者奖励各形成独立 owner decision；同 journal replay 得到相同顺序与结果 | p2 奖励由 p1/UI/AI 代选，或两个奖励合并成一个 timestep | `scan-card-session.js` conditional executor + session journal | 固定 trace、owner 切换、decision journal/replay、三动作原子 commit | owner/version/choice 不匹配时 fail-closed，不写 journal |
| UI choices 与 inspect 集合等价 | board/payment/generic renderer 的 choiceId 集合逐项等于同 revision 的 `EffectSession.inspect().decision.choices` | renderer 根据棋盘或资源自行补出一个目标/支付项 | `projection-adapter.js` + `decision-ui.js` | 每次 decision 比较 inspect/projection/render 三集合；真实 Chrome 点击链 | 缺项不可点击；旧 revision 由 host 拒绝 |
| 扫描顺序、奖励队列、补牌归 Effect Session | direct 参与奖励按 p1→p2 执行，之后才运行 deferred draw；补牌只在所有奖励 decision 完成后发生 | deferred draw 抢在 p2 奖励前，或 UI callback 续跑队列 | Effect priority queue + participant reward DecisionEffect | trace 顺序、commitCount=1、隐藏牌在 p2 决策前不可见 | 未知 followup/priority abort；隐藏信息后进入 irreversible barrier |
| 数据放置与登陆目标/支付归共享协议 | place_data 只有一个 board decision；land 先 board target、再 payment decision、最后执行登陆 | UI 直接写 computer slot，或选星球时顺便扣支付 | `createEffectGroup()` + `PLACE_DATA/PREPARE_LAND/LAND` executors | 独立 decision trace、board/payment renderer 类型、每动作单 commit | 未配置领域 executor 返回 `*_UNMIGRATED`；未知 pending fail-closed |
| 旧 pending owner / continuation 热路径为 0 | 迁移模块不引用 scan/data/land pending 字段、AI resolver 或 `completeCurrentActionEffect`，代表 trace spy 恒为 0 | 新 session 最后仍调用旧 queue 完成动作 | session adapter composition | forbidden-symbol 结构扫描 + runtime spies | 任一禁用调用使测试失败 |
| 隐藏补牌/RNG 不泄漏 | 延迟抽牌前 owner projection 不含牌 identity、未来牌序或 RNG；揭示后 RNG 只进入 session journal | p2 奖励 projection 出现 `hidden-*` canary | viewer visibility policy + deferred draw executor | 多 viewer projection canary、Chrome smoke、irreversible journal | 未揭示信息默认不投影；揭示后不得伪回滚 |

状态矩阵：`scan awaiting_input(target→sector→reward p1→reward p2)→deferred draw→completed`；`place_data awaiting_input→completed`；`land awaiting_input(target→payment)→completed`。决策 owner 按 pending/effect owner，而非当前可见玩家。禁区：`scanTargetAction`、`probeSectorScanAction`、`probeLocationRewardAction`、`publicScanQueue`、`dataPlaceAction`、`landTargetAction`、`runAiPendingStep` 与 UI continuation。
