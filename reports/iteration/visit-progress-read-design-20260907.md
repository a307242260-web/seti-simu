# 访问进度共享只读判定（2026-09-07）

状态：本批设计冻结后已实施，局部验证通过，固定完整局待运行。属于需求式移动的
规则读取步骤，不是移动搜索整体完成。

## 目的和范围

148/497实际根缺少访问收益目的已经验证。路线读取不能复制正式bonus的去重与阈值
规则，也不能调用会发奖励、写领取状态的augmentEffectResult。本批在原Residual
owner内提取`describeEventBonusProgress({bonus,event,ownerId})`，正式结算也改为
使用同一判定；路线原型通过它推进隔离的访问进度。没有新奖励、评分或动作筛选。

有限集合来自242个MODELS递归的REGISTER_EVENT_BONUS：18处，13个移动/访问、
5个signalMarked。不能只验证13个而忽略共享函数对扫描的影响。原有谓词的字段与
比较顺序完整保留，本批不擅自修订牌面或新增匹配条件。

## 冻结矩阵

| 输入/状态 | 只读结果 | 正式写入及执行义务 |
|---|---|---|
| owner不符、事件类型或现有条件不匹配 | inapplicable | 不初始化数组、不发奖励 |
| distinctBy存在且该非空键已在usedKeys | repeated | 不更新usedKeys、不初始化claimedKeys、不发奖励 |
| 新distinct键，onceKey已领取 | claimed，附usedKey | 仍先追加新usedKey，再按原逻辑确保claimedKeys；不得重复领奖 |
| distinct进度未到minCount | progress，附非空usedKey | 先写进度并确保claimedKeys，不发奖励 |
| 达到阈值/没有阈值，且未领取 | reward，按需附usedKey/claimKey | 先写进度，正式applyFormalCardEffects保持原顺序；领取key仍在奖励及followup之后追加 |
| 无onceKey/minCount/distinctBy的重复奖励 | 每次reward，不生成claimKey | 不制造一次性约束；奥陌陌化石重复收益仍有效 |
| b49后续移动、b124移动修正 | 与旧逻辑一致返回reward资格 | 不把资格当作资源奖励；followup和移动修正职责不变 |

`usedKey`/`claimKey`仅在适用时返回，不填undefined；前者表示待追加访问键，后者表示
被检查的领取身份，只有reward状态才追加领取记录。未出现字段不是未知结果。
status始终为上表五种之一。minCount自动claimKey使用原bonus.id。
数组缺省的正常旧行为仍按原执行owner初始化；只读调用不初始化或修改输入。

唯一owner仍是residual-domain-session。正式状态仍归root.turn.cardTurnEventBonuses，
奖励/嵌套Decision、任务触发、运输送达、owner/CAS、不可逆屏障均不迁移。查询不生成
RNG/id/sequence，不排序事件，不复制完整root、不增加cache。旧内联进度判定物理删除，
保留一份匹配谓词供新查询调用；不另建Browser/Simulation分支。

路线原型只消费查询返回的进度，在自身隔离bonus副本上更新；查询不使实际bonus
生效、不发奖励、不延长turn，不改变当前原型“先打牌再移动”的范围。查询耗时须
纳入后续单决策30秒门槛；本批不改变4096节点/256队列/30秒预算。

## 可证伪验证与完成门禁

1. 生产修改前保存18模型事件序列的正式增补输出与完整持久状态摘要，改后逐项相等。
   覆盖首次、同目的重复、不同目的、错误owner、阈值前后、已领取后新目的，以及无数组旧形状。
2. 单元验证冻结输入无修改、首次只进度/第二次得分、重复不领奖、owner/条件不匹配，
   明确合法缺省字段；不以导出存在作为测试。
3. 路线原型消费正式查询后，148/497路线/成本与既有证据一致；正式提交路线及逐步
   恢复沿用并对照旧检查点，不把原型时间冒充AI性能。
4. 单决策实际节点、输入数、计划重放、零规则失败及30秒门槛通过后提交中文版本；
   按研究去重与robot_iterate进行唯一完整固定局，核对均分、动作、状态与非时间诊断。
5. 同步AI/RL内部规则读取契约及测试清单；整体移动目标仍未接入时明确记录，不把
   共享判定完成外推为访问候选已经进入生产搜索，也不宣称节点优化通过。

## 局部验收结果

- visit-progress-read-before/after-20260907.json：18模型×4状态形状×6事件，共432次；
  完整root摘要、返回事件及后续效果、bonus持久状态提取前后逐项相同，冻结查询无写入。
- turn-visit-routes-shared-progress-20260907.json：路线原型消费正式判定后，148/497
  四组路线、成本、访问目的与旧证据相同；不把4.32ms原型用时当生产搜索性能。
- visit-progress-decision-42-20260907.json：18.422秒、4096节点/4804输入、规则失败0，
  30次计划输入正式重放通过；根动作、计划与全部非时间诊断同数据事件版。
  本次冷决策与Node回归同时运行，耗时不可作隔离提速对比，只验证30秒门槛。
- Node回归78/80 unit、1/1 fullFlow；两项失败仍为既有counterfactual-outcome:285
  与strategic-goal-evaluator:386，值与前版相同，没有新增失败。V输入审计通过。
- 已检查README/AGENTS/PROJECT_MEMORY及AI/RL接口、测试清单；内部只读契约与测试
  清单已同步。没有部署、入口、正式存档或观察schema变化，无需修改导航与项目记忆。

本批不生成访问目标、不改移动方向或权重，仍须固定完整局确认效果不退化后收口；
整个Goal仍有移动候选接入、place_data合并和剩余超额/异常治理未完成。
