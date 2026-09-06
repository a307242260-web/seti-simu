# 探测器扫描依赖独立修复（2026-09-06）

目标：修复science的probe扫描因rockets未注入而丢失合法分支，不改阿米巴规则、
扫描目标定义、评分、搜索去重或4096/256/30秒预算。属于独立正确性修复，不宣称提速。

证据：be6bd7b6真实466及585检查点，错误rockets is not defined；原调用自b8aa26c99
存在。旧结果分别见amiba-region-failure-step-466/585-20260906-v2.json。

| 边界 | 方案及证据义务 |
|---|---|
| 唯一owner | science.scanStepChoices(mode=probe)复用rockets.getRocketSectorCoordinate，无坐标第二实现 |
| Browser/Node | 沿现有UMD依赖模式声明、require、factory实参及形参一起接入；页面rockets脚本已先于science |
| 来源闭包 | play-domain所有PROBE_SECTOR_SCAN转换及残余触发共用science，不增加来源特例 |
| 状态/RNG | 仅读取正式pieces/solarSystem，目标去重仍按既有星云id；不增加状态或RNG/sequence |
| Decision/事务 | 两个不同己方扇区保留选择，对手探测器不进入；提交、stale/owner检查、奖励及恢复沿正式session |
| 反例 | b53打出时己方有两个扇区的探测器，原实现抛错；修复后枚举两项并正式提交，恢复后同结果 |
| 搜索 | 重用真实466/585检查点验证旧错误消失，记录其它失败，不将耗时/节点减少当正确性证明 |

成功标准先为依赖错误消失和正式行为恢复，再独立提交、版本化quick→full。
固定终局仍按108.5门槛，不把上轮106.25偷偷改为验收标准；不处理用户排除的两项旧测试。

## 实施与证据

生产修改仅4行依赖接线。b53正式打牌反例先因science_domain_scan_step中rockets
未定义而失败；修复后两个己方扇区可选、对手扇区排除，正式扫描及恢复一致。
77项unit和唯一full-flow通过（两项用户排除测试未跑）。

真实585：原30次executor抛错消失，2614尝试节点、3448次正式输入、11.48秒，
无失败，根动作仍industry:2259bbe0。真实466：根动作仍launch:c1616852，
4096节点、4593次正式输入、16.50秒；rockets错误消失，但仍12次resolver抛错，
明细为“阿米巴痕迹需要 canonical alienEntity sequence”。严格无抛错断言未通过，
保留失败记录，不通过放宽断言将此状态标为通过。

证据：probe-scan-dependency-step-466/585-20260906.json；验证脚本
adhoc/verify-probe-scan-dependency-20260906.js。此项依赖修复保留，下一项单独定位
痕迹序号缺失；暂不带着已知分支异常运行昂贵全盘，也不宣称性能Goal或效果达标。

已核对README/AGENTS、AI/RL接口、扫描机制说明及性能计划；公共schema、运行方式
与脚本顺序未变，只需补扫描依赖说明和本项进度，不更改项目长期记忆。
