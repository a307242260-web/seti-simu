# 数量移动修复进度

2026-09-09，隔离分支fix/counted-card-move-20260909，基于dev 0d8fda38。

已提交候选4bc44eb2；目录/private/tmp/seti-counted-card-move-20260909。
本文件和验证检查点已同步主目录用于报告，生产代码仍隔离。

## 实际改动

- 共享getMovementAllowance按剩余手牌移动角标或地球扇区其他行星/彗星计算首次额度。
- 初次创建Decision时将额度冻结到remaining；后续仅按正式移动成本扣减。
- 零额度直接正常完成，不再最低补1；额度非法显式报错。
- 正式枚举和Production Kernel需求读取共用同一个函数，未改搜索权重、上限或计数。

## 已验证

真实存档派生的正式打牌验证见counted-card-move-verification-20260909.json：
b98零手牌无移动Decision；两移动角标为2→1→结束；b87火星+彗星为2→1→结束；
b77固定移动仍1点。各移动Decision核对AI cardRemaining，初次/中间恢复合法输入不变，
错误owner拒绝且状态不变。

常驻cards/play-domain.test.js补入零/两点正式动作回归：提前结束、错误owner/version，
恢复重放后完整envelope一致（含实体、RNG和journal），移动事件两次，额度不补发。
语法、定向卡牌测试和V输入审计通过。
完整Node：unit 78/80，唯一full-flow 1/1；两个用户已暂不处理的既有断言仍失败：
simulation-counterfactual-outcome的beam 10674≠0，以及strategic-goal-evaluator的
data:analyze≠null。未出现新增失败，不声明全量全绿。

验证夹具初稿使用b49但它已位于原盘面保留堆，被STATE_CARD_LOCATION_CONFLICT拒绝；
固定移动对照改用独立合法的b77发射+1移动。此为夹具修正，无生产绕过。

## 未完成

固定第24步已完成：11.349秒、4096物理节点、执行截断true、规则失败0，选择放数据；
正式前23步动作与状态摘要和基线一致。见counted-card-move-step24-4bc44eb2-20260909.json。
该单点只通过30秒执行门槛，不代表搜索完整；两张牌的额度正确性由正式夹具另行证明。
首次诊断误保存整个AI返回对象导致JSON字符串过大，未写出检查点；改为限定结果字段
后重新运行这一单点并成功留证。没有重复完整局。

已在隔离工作树检查研究记录并启动唯一标准完整局counted-card-move-20260909，
运行句柄50188；第1轮进度持续输出轮次、回合、席位与四席过程分。
尚需完整局结果、实际卡牌路径与信息边界核对和登记；未合dev，不声明该规则修复
完整验收或第五轮三项指标通过。不继续扩展其他卡牌规则。

文档已更新机制参考、RL额度契约和本设计；检查ai-design/AGENTS/README，无新接口路径
或策略变化需补。该修复不改Browser装配、DOM或传统脚本顺序。
