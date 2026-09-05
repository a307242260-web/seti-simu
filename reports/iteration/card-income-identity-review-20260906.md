# 卡牌收入选择正式身份修复（2026-09-06）

## 改动

卡牌收入执行器使用与卡牌精选相同的formalizeChoices生成Standard Action描述符，
补齐actionId、actorId、phase和版本字段。收入选择的target/payload/summary及实际
收入、牌移出游戏、后继奖励、RNG和Decision owner规则不变。

## 验证

- 原第236步失败checkpoint直接恢复后，得到choose_card:929fbc49及正确棕方owner，
  AI提交约61ms完成；能量收入和即时能量各+1，dlc_25收入牌移出游戏，dlc34后继
  抽牌正常。证据`card-income-identity-verification-20260906-v3.json`。
- v1诊断误带从200步续跑的增量replaySteps，重复应用历史导致加载失败；v2已直接
  恢复正式当前状态，但错断言带后继抽牌的整条效果链手牌净减1。记录均保留，v3
  按具体牌去向与后继效果验证，不修改生产行为来适应测试。
- 现有卡牌unit增加正式身份、恢复身份一致及错误owner不消费验证，既有收入/抽牌/
  序号行为断言通过。默认Node 73/75 unit通过，唯一full-flow通过；两个指定既有
  失败保留。V输入审计通过。
- 真实棕方慢样本9656.24ms/4096节点，仍选择launch:c1616852；记录见
  `card-income-identity-performance-20260906.json`，通过10秒单决策门槛但余量小。
- 规则域接口描述同步RL文档；检查AI、README、AGENTS、PROJECT_MEMORY及卡牌DSL/
  Node规范，本次不改规则语义、装配、启动或存档格式，无其他对应口径需要更新。

## 验收

此为收入准备候选触发的既有接口缺陷的独立修复，不混入保牌改动摘要。固定盘面
待新干净提交按标准去重运行；上一候选全盘报错无终局。第三轮基线106.75仍有效。
