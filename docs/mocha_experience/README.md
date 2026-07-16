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

1. 关闭 issue 前读取评论、metadata、验证证据和 `checkpoint/mocha_issue_timeline/<ISSUE>.jsonl`。
2. 有可复用观察时，在对应分类文件新增或更新一条记录。
3. `candidate`、`promote`、`reject` 都要在 `promotion_log.md` 写决策契约。
4. 只有 `promote` 才修改 agent prompt、loop template、watcher、issue-workflow 或项目记忆。
5. 没有值得沉淀的观察时，在 issue 收尾明确写“本 issue 无新增 harness-evolve 经验”。

