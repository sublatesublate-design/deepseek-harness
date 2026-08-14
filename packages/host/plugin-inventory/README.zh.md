# @deepseek-ai/dsh-host-plugin-inventory

[English](README.md) | 中文

当前 Cordis Loader 树的 Host 投影。`PluginInventoryGateway` 注册 `pluginInventory` 服务，并发布由 Typert 生成的 `pluginInventory/list` 与 `pluginInventory/retry` 直接 Remote。每次 list 调用都直接读取 `ctx.loader.entries()`，跳过结构性的 group 行，再按 Loader 顺序返回其余条目，包含条目 id、模块标识、有效启用状态、当前根 Fiber 阶段与失败策略。

阶段为 `pending`、`loading`、`active`、`failed` 或 `unloading`；条目没有存活的根 Fiber 时则为 `null`。普通行报告 `fatal` 策略。存活的 [`plugin-fault-boundary`](../../boot/plugin-fault-boundary/) 行会被投影为其目标模块，并带有 `contained` 策略、长度受限的诊断以及当前是否可重试。重试只委托给该边界，不能修改普通 Loader 行。该快照刻意只表示调用当下：Loader 与边界注册表仍是生命周期权威，本包不拥有缓存、历史、来源模型或事件流。

该服务仅供 Remote 使用，刻意不声明同进程 Cordis `Context` merge。Client 包通过显式的 [`api-remotes`](../../api/remotes/README.md) 组合消费它，而不导入 Host 实现。

## 模型体验

无，因为这个仅限 Host 的清单投影不注册提示词、工具、消息或提供方请求。

#### KV Cache 影响

无；本包从不组装模型输入。

## 已知限制与暂缓事项

- **仅表示调用当下** —— 结果不包含持久的失败历史或订阅；普通条目只要不存在存活的根 Fiber，就会报告 `null`，而不区分其原因。
- **恢复能力范围窄** —— 服务不能启用、停用、添加或移除插件；唯一写操作是重试当前失败且已显式隔离的子插件。
- **无来源信息** —— 服务不识别条目由哪个 bundle、profile 或 override 引入。
