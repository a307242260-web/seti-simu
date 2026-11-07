# V287 / V50：临时资源预览直接求值（2026-11-07）

V286第一次完整168Native/643.607667ms，仍未准入，不重复取快样本。V285完整估值诊断580次包含441次由purposeCapitalValue的缓存未命中进入完整组合；这580次既有完整key均不重复。离线消除V8 alias差异、逐字段比较仍仅3次重复，577种完整值输入。这是反对继续给临时预览构建昂贵完整key的证据，而不是可以忽略输入字段的证明。

唯一运行调整：resourceDemand.planningCapital对可变state/player资源预览直接调用原purposeCapital(...).total；不可变完整Native来源继续使用原planningCapitalDetails WeakMap缓存。公开purposeCapitalValue API和其完整字段/权重、浅冻结拒绝引用、256条界限等契约保持，其他调用方仍可使用；不修改scalarCapitalKey、不简化等价字段、不把不同钱包视为相同。

直接求值与缓存miss原本调用的是同一完整V50函数，原机会成本、剩余手牌、科技/收入/数据、研究符号、标记、当前资源上限全部照常算。没有缓存命中冒充覆盖、Native执行、计划、状态identity或四null预算变化。受控spy用真实完整Native来源证明临时预览不再调用scalar-key路径，变更钱包仍与冻结V286完整结果精确一致；不可变来源仍实际复用。公开scalar API测试继续通过。

先相关测试，再冻结首测重根及全1251门槛；不为600ms改256输入/时间界限或省略必要线。通过完整Node/Browser/输入审计、前两轮动作/资产回归与独立源码快照后，才允许唯一新自主轮。公司固定计划、无用单项排序省算都保留；最高87、最近85及全部原goal仍不变。
