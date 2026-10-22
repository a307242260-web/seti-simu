# 分支已提交状态复用（2026-10-23）

目标是减少首次搜索的通用执行成本，不改变搜索空间、状态等价、收益上界或全局预算。
现有256输入冷根中，restore约73–92ms、checkpoint约42–45ms，均包含重复状态处理。
先在相同三个真实根、相同256次输入上统计整状态解析/克隆次数，再作图摘要及正式根不变对照。
统计包装有额外成本，诊断time上限15s只为避免包装本身截断256输入，不用于600ms或180s验收。

方案：分析端口按完整committedState字符串保存最近一份JSON解码，并完整冻结。
身份读取稳定节点时共用该树，pending节点仍用自身workingState；restore通过已有trustedState
参数交给隔离store，store只接收冻结committed root，beginWorkingCopy仍复制，Session仍复制。
字符串任一字节变化即替换，不能只按stateVersion判断，关闭释放；容量仍1。

受信任StateStore的serializeForkSnapshot按完整冻结committed对象身份缓存最近一次canonical
序列化；commit、普通restore或fork restore换根后下一次保存重新计算。同版本不同状态不能命中。
缓存只在trustedIsolatedOwnership内启用，不改变普通宿主保存的校验与复制。
不得复用Session、working copy或返回外部可写对象；不从外部envelope原字符串直接冒充canonical输出。

不变契约：正式合法信封/规则执行/边界/状态身份/证明/观察/随机状态与原始完整图一致；
未闭合仍显式失败，输入/node/frontier预算不变，生产600ms不变，先单步对照后才考虑整局。
验收：同版本不同状态、成功/失败提交、普通/受信任恢复的canonical bytes和隔离；真实pending
多个envelope共享committed解码；完整Node、相关Chrome、V输入审计及同预算八点复测。

首轮对照：三个256输入图摘要完全相同；整状态克隆426/399/344→230/217/178，
解析375/353/314→272/250/242。未加包装的八点复测仍4/8，四个失败点都是输入额度耗尽。
因此后续重点是必要计算量：现有取牌界对任何对手保留牌都返回null，真实三个中后期点均受此限制。
下一步可审查交易到信息边界的局部事件闭包及更早取得真实下界的展开顺序；此处仅是调查线索，
尚未扩大取牌界、改动展开顺序或取得完整复杂主行动证据。
