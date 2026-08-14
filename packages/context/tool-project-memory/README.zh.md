# `@deepseek-ai/dsh-tool-project-memory`

[English](README.md) | 中文

面向编码智能体、具有明确容量边界的仓库级记忆。

该包把生成状态保存在 Git 根目录的 `.dsh-project-memory.json`；找不到 Git 根目录时使用会话工作目录。该文件是普通 UTF-8 JSON，拒绝符号链接，限制条目数量、单条长度和总字节数，并经过共享的 `fs/write-intent` 门禁后按版本比较写入。团队可以把它提交为共享项目知识，也可以忽略它，仅用于本地召回。

会话第一次进入有效步骤时，该包只注入一个很小的索引，其中只有活动条目的 id、类型、标题和标签。正文不会自动进入上下文。`memory_search` 返回受限摘要，`memory_read` 读取一个明确条目，`memory_write` 创建或替换条目，`memory_archive` 保留已失效内容的审计历史，并从普通搜索中隐藏它。

记忆只是召回层，不是权威来源。必须遵守的规则应放在 `AGENTS.md` 或提交进仓库的文档中。适合保存的是长期有效的决策、约定、陷阱和环境事实；聊天记录、日志、秘密、源码转储、临时路径和很容易重新发现的事实不应写入记忆。

## 模型体验

### 系统提示与启动索引

#### 模型看到的内容

固定策略区分强制指令与可能出错的召回内容，并说明哪些信息不得保存。每个会话至多一次，第一个有效步骤可以追加受限快照，其中只有活动条目的 id、类型、标题和标签。存储不存在或为空时不追加快照。

##### 项目记忆策略

```markdown
Project memory is a bounded recall layer, not an authority source. AGENTS.md and checked-in documentation remain authoritative. Search memory when prior decisions, conventions, pitfalls, or environment facts may matter; read only relevant entries. Write concise durable facts, not transcripts, logs, secrets, source code, temporary paths, or facts that are cheap to rediscover. Update an existing entry instead of creating a duplicate, and archive entries that are no longer true.
```

#### Token 影响

固定策略成本，加上最多 `maxIndexBytes` 的数据相关启动元数据；条目正文不包含在内。

#### KV Cache 影响

固定系统段可稳定复用。一次性快照追加到第一个请求，只有会话之间受限活动索引发生变化时才改变。

### 记忆 schema 与结果

#### 模型看到的内容

四个生成的[项目记忆工具 schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-project-memory)提供受限搜索、明确读取、创建或替换以及归档。搜索返回排序元数据和短摘要，读取返回一个明确条目，修改返回受到影响的持久条目。格式错误、容量超限、符号链接、并发过期、标题重复和 id 不存在会成为带类型错误，并给出明确恢复路径。索引加载错误会被记录和隔离。

#### Token 影响

固定 schema 成本加受限的逐调用结果。搜索受 `maxSearchResults` 与 `maxSearchBytes` 限制；明确条目受 `maxEntryChars` 和小型信封限制。

#### KV Cache 影响

工具调用和结果追加在可复用前缀之后。写入会改变下一个会话的启动索引，但不会重写当前会话的冻结快照。

## 已知限制与延期工作

- 检索使用词法匹配而非嵌入；标题和标签应采用后续任务可能使用的语言。
- JSON 文件是项目级生成状态，但团队必须自行决定提交还是忽略。
- 条目有时间戳和归档状态，但没有作者、置信度或自动矛盾检测。
- 损坏存储会在启动时被隔离，但记忆工具会失败，直到人工修复或删除该文件。
