# V299 / V54 / Resource25：原生自动定目标端点的完成判定（2026-11-07）

V298新增R4实际金星环绕前根首次完整263/511.969875ms，超256，保留失败。审阅原始全图发现更严重的覆盖错误：该合法orbit根被标记plan-infeasible。真实两个R4 Native根的固定路线单元测试先复现infeasible≠completed。

根因：route端点以start-target发起；当内核自动选中唯一探测器/星球、直接进入收入choose_card时，targetReached仍false。收入固定选择完成、Native回到stable后，没有“已开始的端点已完成”检查，再次寻找已经被环绕消费的火箭，错误标记goal-route-action-unavailable。多候选端点先显式choose_target会置targetReached，不是同一路径。

最小修正只在resourceDemand.step入口：route&&operation.targetStarted&&status===stable完成。此前start-target只在Native提交成功后记录；stable意味着该端点的强制队列已完成，保留全部收入/选牌输入。未开始的路线仍按全部需求、可达性、固定方向筹资；decision期间仍不提前完成。现有effect-purpose的stable完成合同不变。暂不顺带改变收入菜单的capacity过滤；若有已付费后仍因筹资过滤的真实例子需单独复现。

状态身份/等价/共享前缀不变，无剪枝放宽、预算变动或同源码冷根重测。四null全局budget及单点256Native/600ms保持，新增必要完整路线可能增加执行数，不为过门槛丢弃。验证两个真实根固定计划与独立Native orbit+收入输入、完整观察/原根/RNG一致，及已有route/resource/shared-prefix/income回归后冻结首测。V298最终轮当前钱包修正继续，1536旧估值/计划一致和24Native观察证据保留；V41与原23自主前三轮/第二轮轮末回查等整个goal不变。
