# SETI 项目长期记忆

## Mocha issue workspace 路由

- `SETI-*` 属于本机 SETI workspace，服务入口是 `localhost:3030`。使用 `/Users/bilibili/.local/bin/mocha`，不得附加 `--profile algo1-wyfx`。
- `ALG-*` 属于文艺复兴 / `algo1-wyfx` workspace。仅处理明确的 `ALG-*` issue 时使用 `/Users/bilibili/.local/bin/mocha --profile algo1-wyfx`。
- 读取、评论、改状态或触发 issue 前，必须先按 issue key 前缀选择 workspace。不得把不存在于当前 workspace 的 `SETI-N` 自动改查或改写为同号 `ALG-N`，反之亦然。
- 如果 issue key 与当前入口不匹配，应停止 mutation，先核对入口；不能通过猜测同号 issue 继续操作。

证据：2026-07-19，SETI-92 的纠偏评论因误带 `--profile algo1-wyfx` 被发到 ALG-92。ALG-92 agent 识别出任务不匹配且未改代码，随后纠偏已重新发送到本机 SETI-92。
