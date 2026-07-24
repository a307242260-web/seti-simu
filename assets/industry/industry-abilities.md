# 正式公司能力

Production company catalog 只包含 11 个正式标签：

- 层云核心
- 芬威克研究中心
- 赫利昂联合体
- 寰宇动力
- 任务中继站
- 哨兵探测网络
- 深空探测
- 图灵系统
- 未来跨度研究所
- 异星实验室
- 宇宙战略集团

公司行动由 `randomizer/game/effects/residual-domain-session.js` 独占执行。
Browser 与 Simulation 只能提交 Standard Action 或 Effect Session Decision，不能直接调用
`randomizer/app` 中的 picker、callback 或 continuation。

## 主动能力

| 公司 | 正式能力 |
|---|---|
| 层云核心 | 依公共牌区三张牌的弃牌角标生成效果节点；同类角标合并 |
| 图灵系统 | 当前回合借用一项橙色或紫色供应科技 |
| 哨兵探测网络 | 武装当前回合，打出非外星牌后结算该牌弃牌角标 |
| 寰宇动力 | 两次各 1 移动力，必须选择不同火箭 |
| 赫利昂联合体 | 使一项非蓝科技失效，再选择一张手牌增加收入 |
| 任务中继站 | 支付 2 宣传精选公共牌并获得收入角标 |
| 芬威克研究中心 | 支付 1 宣传精选公共牌并获得弃牌角标 |
| 深空探测 | 精确选择手牌与公共牌并交换 |
| 宇宙战略集团 | 精选公共牌并清空三色奖励槽 |
| 未来跨度研究所 | 精选公共牌并提高已扣牌的目标分 |
| 异星实验室 | 三色板块分别复用正式发射、扫描、科技行动 |

所有公开牌补牌、盲抽与外星人揭示都建立不可逆屏障。条件选择在提交时重新校验
owner、stateVersion、decisionVersion 与 choiceId；失效选择不得修改 committed state、
RNG cursor、effect sequence 或 journal。
