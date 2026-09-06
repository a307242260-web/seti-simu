# 阿米巴满数据池结算设计（2026-09-06，生产修改前冻结）

真实404已按原replay重放前403步并核对动作/状态。隔离正式分支执行普通发射、两次
逆时针移动、正式规划下一己方回合及登陆奖励，21次提交复现6条失败：黄1/2位置各1条，
黄3/4之后的展示牌/盲抽各2条，均“数据池已满（6/6），本次数据被弃置”。
证据white-404-branches-20260906-v4.json。原搜索2:4比例相同，但全部738次同因仍待
修复后的同状态搜索核实。v1工具接口错误、v2未到达行星、v3遍历超出诊断预算，均保留
失败/不足证据，不称为完整遍历。v3另发现取消外星牌返回协议错误，当前AI不选择取消，
与本次738次失败无因果证据，不夹带修复。

## 完整边界

正式data.gainData在满池时返回ok:false, discarded:true，并已增加discardedCount；
这代表奖励正常溢出，不是规则执行失败。缺player/槽位等失败没有discarded标记，必须
继续显式失败。不得把所有ok:false都忽略，不改变data primitive契约或容量。

| 来源 | 唯一发奖owner | 结算后续 |
|---|---|---|
| 正面痕迹区域奖励 | Card awardAmibaSymbols，经Science派发 | 全部初始symbol各一次、再固定同时移动 |
| 移除痕迹区域奖励 | 同上 | 同上，保留先前痕迹移除 |
| 卡牌单symbol图标 | 同上 | 仅所选symbol领奖、移动一次 |

awardAmibaSymbols只接受明确discarded的溢出结果，记录amiba_data_discarded事件后继续
资源/盲抽；正常获得数据保持原行为。两个调用者把该事件附在原symbol resolved事件前。
root.player.dataState.discardedCount仅由data primitive增加，不制造token，不消耗dataToken
序号；盲抽仍使用正式RNG/卡牌序号及隐藏屏障。状态和pending保持原owner、类型与恢复
契约，不创建新的满池选择或搜索快路径，不调整预算/评分。

旧区域修复be6bd7b6将发奖抽成共享函数时保留了原CHOOSE_SYMBOL_REWARD的
if(!gained.ok)return逻辑（父提交同处亦存在），不能称为公司移动修复引入；当前区域
必然奖励使这一既有契约误用继续可达。

验收：空池、5枚、6枚分别获得/填满/弃置；满池仍盲抽与移动，不重复计分、弃置或序号；
保存恢复后完整envelope一致；真实6条失败转成功；单步性能及固定完整局另行登记，
现有已通过版本109分不代表本修改自动通过，Goal门槛不降。

## 实施验收

已修改共享发奖及两个事件出口。原真实分支同样21次正式提交，6条失败均转成功，
见white-404-overflow-fixed-20260906.json。现有Card composition测试扩展0/5/6枚数据，
验证实际token上限、弃置次数、dataToken序号、盲抽与固定移动、事件、错误输入不变及
完整保存恢复；已完成session的journal从提交结果检查，不从已清除pending取值。
77unit+1fullFlow通过（6.54s+0.51s），按用户要求排除两项既有测试，不宣称无遗漏。
单步搜索与固定完整局待完成。

文档核对：已更新阿米巴实现说明及性能计划；机制手册现有“满池增加discardedCount”
与本次一致，README/AGENTS/AI设计/RL入口及schema未变，无需修改；长期记忆未动。
