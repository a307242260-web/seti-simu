# 阿米巴区域奖励规则修复（独立缺陷，2026-09-06）

状态：规则依据与实现边界已核对，尚未修改生产规则。本项替代A1/A2所依赖的
“区域奖励可以任意选择顺序”假设，不是进一步优化A1快照实现。

## 原始规则证据

仓库当前implementation.md指向已删除的face_detail.md。实际原文仍可读取：

`git show '6fb70ec1^:assets/aliens/阿米巴/face_detail.md'`

相关原文：

> 区域奖励即此时某种颜色3个区域内的symbol奖励之和（可能没有奖励）。如初始状态下，橙色区域奖励即有2个随机symbol。
>
> 每当一个symbol的奖励被结算后，立刻将该symbol进行移动。外层的6个位置的symbol顺时针移动，且先移动顺时针方向更靠后的那个，内层的则为逆时针移动（蓝3->橙3->红3），移动时会跳过已存在symbol的格子，每个格子最多只能存在一个symbol。例如初始状态下，有玩家获取了橙色区域奖励后，橙1、橙2的symbol需要移动，橙3此时没有symbol因此没有变化。此时橙2的symbol移动到了蓝1，橙2的格子空出，橙1的symbol移动到了橙2。

卡牌0/1/4/5/6/7/9及其相关任务明确为指定颜色区域“任选一个”symbol，与区域全部
奖励不同。现有amiba.resolveRegionReward已按规定顺序处理起始已占槽位；正式交互
却由CHOOSE_SYMBOL_REWARD反复枚举当前位置、maxSettles=3限制次数，二者矛盾。
cebfe452的提交说明将maxSettles=3称为“区域全部”，没有新增任意排序规则的依据。

真实反例已在amiba-continuation-contract-20260906.json保留：橙区开始只有两个符号，
先选orange_2的数据，再选orange_1的盲抽，随后又能选移动至orange_2的同一个盲抽符号。
这不只是搜索重复，而是多发奖励，并产生不存在的顺序分支。

## A2观察分组结果

只读绿210：2448次来源调用、1488个观察对象、264个公开内容分组；完整规则state
哈希有1488种，去掉RNG仍有1488种。不能按公开观察合并。这一结论仅否定A2的公开
观察去重，不证明这些分支符合游戏规则。两份原始记录为amiba-repeated-states-210-
20260906.json与amiba-repeated-full-states-210-20260906.json；脚本未改变选择器输出。

## 完整实施矩阵

| 来源/边界 | 正式owner与实现义务 | 可证伪证据 |
|---|---|---|
| 放置阿米巴痕迹 | science-session只生成独立区域确定性Effect，不再生成symbol Decision | 真实黄2/蓝2/粉2落点后无逐symbol选项 |
| 移除痕迹（阿米巴3） | play-domain保留“移除哪个痕迹”的Decision，随后生成同一区域Effect | 移除目标仍可选；只结算移除颜色 |
| 单个符号卡牌及任务 | 原CHOOSE_SYMBOL_REWARD只执行一次，保留每个合法符号选项 | 两项区域卡牌仍有两项；选择一次后不追加区域奖励 |
| 区域移动顺序 | amiba.resolveRegionReward复用getSymbolResolutionOrder/resolveSymbolAtSlot | 起始槽位快照、外圈后位优先、内圈反向、同符号不重复 |
| 奖励发放 | play-domain区域与单个符号共享奖励发放函数；资源gainResources、数据gainData、盲抽createCardDrawContext | 分数/宣传、data实体及序列、盲抽张数逐项正确 |
| 会话和事务 | 普通确定性Effect在同一正式session drain执行，资源失败返回正式fail；不调用AI或新执行器 | 失败不静默；无新外部输入和伪造replay步骤 |
| 原子内部顺序 | 既有resolveRegionReward先逐个移动并返回奖励列表；按相同列表发奖；实施前确认gainData/盲抽无读符号布局的同步副作用 | 如发现同步依赖，回到矩阵，不用额外顺序特判绕过 |
| 隐藏信息与RNG | 盲抽通过当前正式root RNG，结果上报hidden_card_draw；正式根与搜索fork隔离 | 新牌身份仍遮蔽；新规则不保留旧错误分支的抽样结果 |
| 事件/计划 | 区域Effect记录每个amiba_symbol_resolved及region；计划只记录真实用户输入，确定性奖励在同次输入中结算 | 真实痕迹动作后奖励已发生，不产生虚构choose_target计划 |
| 历史恢复 | 普通正式事务/快照照常恢复；旧错误区域Decision的maxSettles/settledCount不得继续多发奖励 | 明确拒绝旧区域pending或旧非法输入，不静默当成单选；从区域发生前的checkpoint验证 |
| 空区域 | 正式区域Effect成功结算零项，不新造Decision | 空区域不会卡死或送额外奖励 |
| 删除账 | 删除区域来源maxSettles、settledCount与递归symbol选择；保留真正单选类型 | 全仓检索两旧字段和来源；不恢复Browser旁路 |

拟新增amiba的RESOLVE_REGION_REWARD效果类型，在play-domain的既有generic Effect
目录登记为确定性执行；science-session和移除痕迹两个来源共用它。无新增AI剪枝、
快照API或预算修改。所有调用来源已由CHOOSE_SYMBOL_REWARD/maxSettles检索定位。

## 验证与迭代边界

1. 实施前闭合上表同步副作用和旧pending失败语义，再一次完成全部入口与文档。
2. 真实绿210痕迹输入复现；区域两符号只发两次，按原顺序移动；另验移除痕迹、
   卡牌单选、空区域、三个区域布局和正式恢复。纯amiba unit不能替代实际domain证据。
3. 单决策耗时/节点/正式提交数/计划可执行性及信息遮蔽。新根选择允许改变，但
   不得新增执行异常或依靠多发奖励提分；之后按版本去重quick/full。
4. 固定盘面仍以终局均分108.5为效果门槛。规则修复若因取消非法重复奖励降分，
   记录正确性与效果的区别，分析后续AI影响；不恢复错误奖励补分。
5. 文档核对：implementation.md、ai-design、rl-simulation-env、相关机制说明与
   新Effect目录/注释；旧错误说法删除或明确标记为历史失败假设。
