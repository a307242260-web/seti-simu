# 原23输入自主前三轮验收入口（2026-11-07）

目标：新增human405-white-first3-v1，初始化恢复原23输入的完整Native信封/RNG、空机器缓存。白色共享Production搜索、其他三家沿用原开局PASS/强制选择；自主范围rounds1-3，与teacher112受控第三轮独立。完整性能准入前只做无AI的宿主行为验证，不运行自主实验。

成功标准：独立指纹/quick-only，在R3结算推进R4后停止；normal/failed记录都包含firstThreeRoundsSettled、openingInputs23、newInputsAfterOpening、completedRoundEnds。分数/资源取R3提交PASS前快照，PASS选牌/R4收入不混入。每轮完整checkpoint保存具体科技/六收入/所有资源、手牌与已投入牌、电脑蓝槽/探测器/扫描、外星人和终局预投入。实验中心显示临时轮末口径，不能进完整局榜或晋升V41。相关旧first1/first2/teacherR3不变。失败保存原根且不代PASS，同源码/实验去重。

验证：真实原23信封/RNG恢复及不带teacher112；生产runner零AI初始化、实际原生R3 PASS/选牌/收入边界与失败注入；旧场景回归；实验中心解析与榜单排除、实际模板渲染。Native搜索/估值/规则/状态等价/资源剪枝/四预算与256输入600ms门槛不修改。V296首次132为162/682.490792ms仍未准入，该失败保留，不为宿主变动重测同Runtime冷根。
