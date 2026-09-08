# 反事实身份修复：验证进度

2026-09-08：独立分支fix/counterfactual-identity-20260908，候选0b01af15，位于/private/tmp/seti-counterfactual-identity-20260908。基于未通过的顺序候选438305b4，未合入dev。完整设计与修改同在该提交的counterfactual-identity-design-20260908.md，不能把此候选当作已验收新基线。

改动：已结算且支持逐节点resetBranch的反事实输入复制后，将旧rngState.state归零；物理身份、派生样本与隔离fork恢复共用规范输入。其他状态字段、原始root及正式RNG不改，活动Session仍完整恢复，来源义务不丢弃。需要规范输入时不能跳过restore。不是卡牌价值或评分权重调整。

实现前后证据：初版只改hash的正式输入对照失败，136个RNG-only输入中52个进入条件Decision时，未提交committedState仍保留旧随机尾值（Session内容本身一致）。重新冻结完整输入契约后，73组/136个规范输入的正式后继全部一致，根checkpoint不变。失败诊断与脚本错误记录均保留在候选提交，未用忽略差异制造通过。

验证：simulation-rule-composition、唯一standard-flow、V输入审计、语法及diff检查通过。白方第二轮第4回合同盘面4096搜索约17.04秒，规则失败0，最佳扫描计划估值35.5→46；共享转置计数2614→3865，但前沿裁剪来源3964→6647，不能单凭估值上涨宣称通过。其获胜计划不同于旧40.83计划，尚未证明原科技长链已保留。

第24步前23步正式重放一致；4096节点约24.2秒、规则失败0、根动作仍放数据。未超过30秒单点门槛，但不能称提速或搜索完整。

标准完整局已启动：counterfactual-identity-20260908，运行提交0b01af15，直接对照quick-turn-order-20260908；已先执行研究记录--list，未重跑已有实验。当前待终局、物理节点与截断验收，完整局进行中不提前登记为完成版本。

证据：quick-turn-white-cross-candidate-identity-20260908.json.gz；临时分支中的step24-entry-states-identity-0b01af15-20260908.json.gz与counterfactual-identity-pairs-canonical-20260908.json。第五轮卡牌估值仍未实施，原Goal继续。
