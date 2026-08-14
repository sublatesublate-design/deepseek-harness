# @deepseek-ai/dsh-plugin-fault-boundary

[English](README.md) | 中文

为可选 Cordis Loader 插件提供显式启用的激活故障隔离。默认导出注册 `ctx.pluginFaults`；`./boundary` 导出在子 Fiber 内导入并挂载一个目标插件。如果导入或激活失败，边界会记录日志与长度受限的诊断并吸收失败，使边界行及其同级插件仍能完成启动。普通 Loader 行继续保持仓库既有的明确失败行为。

在 patch 中显式使用包装器：

```yaml
- insert:
    - id: my-optional-plugin
      name: '@deepseek-ai/dsh-plugin-fault-boundary/boundary'
      config:
        plugin: '@scope/my-optional-plugin'
        config:
          feature: true
```

注册表提供调用当下的 `list()`、`get(entryId)` 与 `retry(entryId)`。重试会先处置失败的子 Fiber，再重新导入并激活目标。Web 插件清单会展示目标模块而非包装器，并且只在仍处于挂载状态的边界失败时开放重试。

## 信任模型

插件属于受信任的本机代码。已挂载插件与 Harness 在同一进程中运行，可以使用该进程的文件系统、网络、环境变量、原生模块和进程控制权限。子 Fiber 只隔离受支持的激活失败，不限制能力。仅安装并启用你信任其代码与更新来源的插件。

## 模型体验

无，因为这个仅限 Host 的边界只改变插件生命周期，不提供模型提示词、工具、消息或提供方请求。

#### KV Cache 影响

无；本包从不组装模型输入。

## 已知限制与暂缓事项

- **仅隔离激活故障，不提供安全隔离** —— 边界覆盖模块导入以及 Cordis 激活/重载生命周期失败；它既不缩减插件权限，也无法恢复死循环、原生崩溃、进程退出，或激活后任意未处理的异步异常。
- **仅显式启用** —— 只有 Loader 行使用 `./boundary` 时插件才会被隔离；核心行继续明确失败，避免缺少必要服务时应用表面上仍显示健康。
- **诊断不持久化** —— 记录只在边界行挂载期间存在。完整失败信息保留在 Host 日志中；受信客户端只收到最长 500 字符的单行消息。
