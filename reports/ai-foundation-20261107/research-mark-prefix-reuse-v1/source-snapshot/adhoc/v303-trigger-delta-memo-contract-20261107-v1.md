# V303 / V54：复用同一完整触发输入的默认估值差（2026-11-07）

goal继续；正式V278/V48、最近R3 85/最高87、V41保持。V301首次冷测132=162Native/688.0945ms失败，不重采样，不运行新局。此前V302共同钱包触顶原型0命中已否决，未写运行源码。

V301独立诊断：5345次createGains、117019次total(types)，仅84个完整signature，旧64FIFO造成456次ledger miss；128以上虚拟容量226miss。先不改变容量，避免一次改变两个变量。真正大头包括所有命中仍重复构造颜色数组/字符串、做两次ledger读取与默认整数加法。

本候选仅在weights===arithmetic.DEFAULT_WEIGHTS时，将gain(id,prior)已经计算的同色/跨色净差存进现有同signature数值Map的独立命名空间。完整signature仍包含原context、weights、已付宣传及付款时序；每次gains/prepareGains仍重新生成原完整key。科技ID先按原API映射到颜色，保留prior的原truthy语义，颜色只可能blue/orange/purple/null，不与原total(types)命名空间冲突。

该净差命中时，其两个原total项均已存在；默认weights对象不可变，原arith.sum结果必相同。context在返回函数后可变也不扩大原缓存语义：原函数对已经计算的两个total本就复用，未见过的颜色组合仍按旧路径计算。自定义/可变/访问器权重走原实现，不缓存净差。只存数值，不存原生节点、后继、对象身份或绑定调用方可变输入的函数；旧64FIFO保持。

先内存原型比较同一失败根全部序列化roots、首选、值与162Native，测净差命中及减少的实际total调用；再以当前Native教师context、三色和未知ID、付款时序、数据/宣传边界、自定义权重和调用后输入变化作行为对照，并检查来源保持。只有收益和等价证据成立才改运行源码。

不改变状态等价/去重、可达性/资源下界剪枝、必要候选、搜索闭合、beam或四null全局budget；单点256Native/600ms仍必须满足。新源码相关Node、Browser与输入审计后冻结，唯一首次冷测；全1258和完整源码准入、前两轮实际资产、原23自主前三轮、R2轮末回查均仍需要完成。
