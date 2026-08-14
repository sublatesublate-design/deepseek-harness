# `@deepseek-ai/dsh-tool-git`

[English](README.md) | 中文

面向本地编码智能体、具有明确边界的 Git 工作流工具。

该包注册 `git_status`、`git_diff`、`git_stage` 和 `git_commit`。命令通过 `ctx.subprocess` 以固定 argv 向量运行，限制收集输出并支持取消，不经过 Shell 字符串插值。暂存必须给出明确路径。提交只使用已有暂存区，并且始终从 `tools/pre-execute` 返回 `ask`；即使普通文件修改已获允许，也必须取得一次新的审批。

该包刻意不提供 push、force-push、reset、rebase、checkout、删除分支或修改远程仓库配置等工具。这些操作只能通过另行治理的 Shell 权限执行。

## 模型体验

### 系统提示与工具 schema

#### 模型看到的内容

固定策略要求模型先检查再暂存、只使用明确路径，并且只有成功的 `git_commit` 结果才能证明提交已经存在。四个生成的 [Git 工具 schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-git) 描述受限工作流。

##### Git 工作流策略

```markdown
Use git_status and git_diff to inspect repository state. Stage only explicit paths with git_stage. git_commit commits only the existing index and always requires a fresh human approval. Never claim a commit was made unless git_commit succeeded. No push, force-push, reset, rebase, checkout, or branch-deletion tool is provided.
```

#### Token 影响

该包可见时产生少量固定提示与 schema 成本。

#### KV Cache 影响

只要插件作用域、配置和 schema 不变，前缀即可稳定复用。

### Git 结果与审批决定

#### 模型看到的内容

`git_status` 返回结构化根目录、分支、HEAD、清洁状态和双列路径状态。`git_diff` 返回受限纯文本补丁，并在截断时明确标记。暂存和提交返回简短确认或 Git 自身的受限诊断。无效路径、输出溢出、取消和非零退出成为带类型错误。提交被拒绝或缺少审批通道会在 Git 启动前报告。

#### Token 影响

结果随数据变化，stdout 与 stderr 分别受 `maxOutputBytes` 限制。

#### KV Cache 影响

调用与结果追加在可复用请求前缀之后。审批决定会增加会话事件，但不会重写更早的提示内容。

## 已知限制与延期工作

- 工作流不提供分支、远程、stash、reset、rebase、checkout 或 push。
- 差异截断会明确标记，但没有溢出文件续读；调用方应按路径缩小范围。
- 仓库钩子与签名配置仍可能让已审批的提交失败。
