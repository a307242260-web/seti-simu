# SETI Harness Experience Store

本目录记录 SETI workspace 中可复用的执行经验。业务结论留在对应机制文档或 issue；这里只记录工作流、验证、交接、展示和收口方式。

## 分类

- `coding.md`：代码实现、调试和验证。
- `data_analysis.md`：数据分析与口径验证。
- `exploratory_research.md`：探索性研究与假设验证。
- `coordination.md`：拆单、交接、review 和 owner 协作。
- `watcher.md`：可机械检查的状态或 metadata 问题。
- `promotion_log.md`：candidate、promote、reject 的决策契约。

## 收口规则

1. 普通 issue 关单使用 fast closeout：读当前 metadata、owner/member 相关评论、timeline 尾部与验证证据，不整库读取 experience store。
2. 无新信号时，收尾明确写“本 issue 无新增 harness-evolve 经验”，不改仓库文档。
3. 有可复用观察但无需立即修改长期组件时，用 `tools/record_harness_closeout_event.py` 追加轻量 JSONL，由定期 review 集中去重和决定 candidate/reject/promote。
4. 只有需要立即 promotion 或正在执行定期 review 时，才读对应 category 命中段和 `promotion_log.md` 命中段、更新经验文档并写完整决策契约。
5. 只有 `promote` 才修改 agent prompt、loop template、watcher、issue-workflow 或项目记忆。
