# 教学学习：最终轮证明适用域与固定数据尾部提速（2026-11-07）

已验证并修正第四轮任务资本与旧证明冲突，随后使一处真实第四轮决策从263降至245次原生输入，首次冷测464.149334ms。四个新增实际R4根、两个证明反例根及R3发射根均通过256输入/600ms；检查在旧第132步停止：完整162输入/688.094500ms，仍不准入。当前隔离候选V301/V54/资源策略25，正式仍V278/V48。没有新自主局或分数：最近受控第三轮85分、同教师起点最高87分，教师合法105分及7钱4电1牌/扫描发展尚未对齐，V41 baseline不变。

## 原生反例与正确性修正

V299开放R4当前钱包探测器用途后，旧上界仍将最终轮当作没有任务资本。从既有case062测试状态派生14个R4主行动后、四数据、单张已知收入牌的受控金融窗口，真实执行140个“放数据/选槽/收入/结束turn”输入。前8个窗口已有checkpoint后不重复跑；追加6个新窗口。另从各自原生source独立重放140输入，所有终态state/session/RNG完全一致，恢复原根。它们是受控金融变体，不是教师路径或自主分数。

两例旧上界均为24；实际插入已知收入后，总估值分别43.5和29。多1电或1钱解锁了已部署探测器的任务用途，旧`maximumPurposeCapital=0`漏掉非线性增长。这些数值是估值，不是盘面分。

V300同步三个入口：

- `supportsLegacyValueProof`只接受第四轮且viewer没有部署的普通场上探测器，避免统一接口把整个R4误称线性；actor、公开探测器事实在Native/formal/compact路径一致。
- `hasUnprovedProbeCapital`不再排除R4，旧post-main上界、未带movement政策的复合尾部、单蓝回退均拒绝未覆盖任务；R4旧线性扫描上界对任何该类探测器退出，原R1—3蓝科技条件保持。
- `dataTailCompletion`在R4同样逐阶段检查探测器是否可以保持原位；调用方拒绝或没有回调时，不得直接用标量关闭窗口。plain end原静止、不跨round的证明不变。

没有恢复错误上界换速度，也未增加新剪枝界或删除必要候选。无探测器的有效证明保留：一组原生对照405→54输入、相同选择和值，另一组81→63。已有带探测器的7条条件尾部仍通过原生对照，完整决策207对252输入、所有根的动作/值保持。两份依赖“R4有probe也无任务价值”的旧测试改为无探测器正例和有探测器拒绝例；角标等价测试按真实适用域检查，并保留无探测器证明实际被使用。没有为了旧结构恢复旧语义。

V300相关11项Node、4项Chrome通过。输入审计新增适用域，28份Native/formal/compact观察一致，合计64通过及旧aomomo冻结对象失败1项。新增审计最初在结束turn后的其他owner状态错误调用openRoot，已改为只读投影；失败日志保留。角标测试新增无探测器变体最初留下activeRocketId悬空，Native明确报STATE_PIECE_REFERENCE_INVALID；修正本次测试变体引用后通过。没有为错误测试修改内核或宿主契约。

V300两个反例冷根分别2输入/37.261583ms和2输入/37.470000ms，正确窗口43.5/29；R4 late首次263/466.156875ms仍超输入门槛。这些首次失败/通过都保留，不重采同源码冷样本。

## 有原生证明的提速

`turnTailSummary`仅在round<4查询当前公司选牌政策；R4一律认为公司动作仍需保留，因此即使当前贪心政策已经排除该动作，也禁止数据尾部合并。V301只去掉这一个轮数条件，所有轮次查询相同的`cardPickSpec`。公司动作仍被政策保留时继续拒绝；逐阶段的新获取目的和V300移动检查、用途增量、原生收入/蓝槽/标记及未知牌守卫全部保持。未更改公司贪心选择、状态等价、资源下界或四null预算。

编译这一行原型的非验收诊断中，263→245输入；原根每个action/goal/value/completion/valueType逐项一致，首选仍公司技能152.5。13个typed尾部在原根知识域内逐个展开67个原生输入，值、用途增量和输入数与证明一致；再从每个真实Native source独立重放67输入，完整state/session/RNG一致。Native重放没有把原来未知的手牌身份作为新根信息重新交给AI。回归测试先复现263≠245，再修到通过。

V301相关7项Node和5项Chrome通过，Chrome也执行245输入决策与13条67输入尾部对照。最新输入审计64通过、旧aomomo失败1项保留，整体不称全绿。

## V301首次冷测

| 根 | 原生输入 | root+search时间 | 窗口值 |
|---|---:|---:|---:|
| R4已知电收入反例 | 2 | 37.113791ms | 43.5 |
| R4已知钱收入反例 | 2 | 37.077500ms | 29 |
| R4晚发射、金星环绕前 | 245 | 464.149334ms | 152.5 |
| R4早发射、金星环绕前 | 136 | 375.892458ms | 151.5 |
| R4早发射、首个白席根 | 187 | 362.603958ms | 152.5 |
| R4晚发射、首个白席根 | 113 | 243.351166ms | 141 |
| R3扫描4的发射选择 | 12 | 66.642791ms | 143.33333333333334 |
| 原第132步 | 162 | 688.094500ms | 140.08333333333334，失败 |

各根完整闭合、原根/RNG保持。四个R4根是已保存实际原生控制路径的各阶段，首选不一定是固定金星路径；不能把窗口值当作新终局成绩。1258具名案例只完成上述8项，不能外推全量。后续完整Node、全部冷根及实际前两轮发展回归尚未完成；Source未准入，未安装正式AI、未登记实验中心新分数。

## 下一处成本与复现入口

原132仍是估值CPU成本。一次明确非验收诊断记录743次完整用途、6158次基础计算；同一完整调用内V8输入重复497次，但同一facts对象重复为0，包含浅层字段的引用诊断键只重复30次，不能据此上引用缓存。3处V8编码前后字节变化的跟进检查保存了原始对，所有可序列化自有字段均无差异；可能是编码/对象共享结构差异（推断），未视作规则状态被修改，也未用于改变缓存等价。这两次仪表查询用于不同诊断问题，不计入冷测合格证据，动作、值和162 Native均保持。

后续先定位原132仍需约88ms的实际计算成本，保留正确的R4证明边界和已省18输入的尾部。通过完整源码准入后再运行唯一标准自主前三轮；仍需实际验证前两轮资产、对齐第三轮具体科技/收入/库存/预投入，并回查第二轮末的额外登陆、收入与保牌决定。整个goal继续进行。

- [14个金融窗口及140原生输入](../reports/ai-foundation-20261107/final-round-proof-audit-v1/native-income-vs-old-bound-20261107-v2.json)、[独立140输入验证](../reports/ai-foundation-20261107/final-round-proof-audit-v1/independent-native-verification-20261107-v1.json)。
- [V300源码](../reports/ai-foundation-20261107/final-round-proof-audit-v1/source-manifest-20261107-v1.json)、[11项Node](../reports/ai-foundation-20261107/final-round-proof-audit-v1/related-node-20261107-v6.log)、[4项Chrome](../reports/ai-foundation-20261107/final-round-proof-audit-v1/browser-smokes-20261107-v3.log)、[输入审计](../reports/ai-foundation-20261107/final-round-proof-audit-v1/input-audit-20261107-v3.log)。
- [13条尾部的原型与67输入展开](../reports/ai-foundation-20261107/r4-company-tail-v1/prototype-native-proof-20261107-v1.json)、[独立67输入验证](../reports/ai-foundation-20261107/r4-company-tail-v1/independent-native-verification-20261107-v1.json)。
- [V301源码](../reports/ai-foundation-20261107/r4-company-tail-v1/source-manifest-20261107-v1.json)、[7项Node](../reports/ai-foundation-20261107/r4-company-tail-v1/related-node-20261107-v1.log)、[5项Chrome](../reports/ai-foundation-20261107/r4-company-tail-v1/browser-smokes-20261107-v1.log)、[输入审计](../reports/ai-foundation-20261107/r4-company-tail-v1/input-audit-20261107-v1.log)、[完整首次冷测检查点](../reports/ai-foundation-20261107/r4-company-tail-v1/serial-cold-gate-20261107-v1.json)。
- [原132单次用途内重复诊断](../reports/ai-foundation-20261107/local-portfolio-reuse-diagnostic-v1/single-purpose-base-repetition-20261107-v1.json)、[序列化字节变化跟进](../reports/ai-foundation-20261107/local-portfolio-reuse-diagnostic-v1/base-input-mutation-details-20261107-v1.json)。
