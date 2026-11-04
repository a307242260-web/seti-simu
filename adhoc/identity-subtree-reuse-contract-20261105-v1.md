# V182：只复用不可变且与Session引用无关的身份子树

依据V181 case105 CPU profile：身份normalize36个self样本，structuredClone58；先只改normalize的重复遍历，不同时改复制、规则或估值。基底c4098165，生产仍V178/V16。

完整physicalKey字节、Session引用首次出现顺序、实体/数组/RNG/私有计划目标键必须不变。只对递归已确认全部冻结、且任何referenceKeys字段都不含effect-session-N:effect/group:N引用的对象保存规范化结果。含任何Session编号的子树无论是否匹配当前prefix均不复用，防止下一次Session或引用编号上下文改变。浅冻结、可变后代、普通可变输入均不复用；不同状态的资源、队列与排序仍进入原身份。WeakMap归属单个analysis port，close释放；没有新规则状态或剪枝。

目标可达性、资源下界、全局四预算null、固定准备计划都不变；仍要求完整搜索≤256原生模拟/600ms。先对旧V181与新实现的身份字节做原生夹具/Session/可变子树对照及现有identity/cycle/restore测试，再测首个慢根105。保留首次冷测，未过不运行新自主局。性能变化必须同时保持候选选择、值、搜索图及原根/RNG；不从单根通过外推全部169根通过。
