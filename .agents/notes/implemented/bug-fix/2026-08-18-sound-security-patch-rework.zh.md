# Agent Note: Keep only sound security patches

Status: implemented

[English](2026-08-18-sound-security-patch-rework.md) | 中文

## Problem

一批十八项安全与行为补丁未能通过类型检查，打挂了既有的沙箱逃逸测试，使审批调用方静默失效，并整体替换了双语文档对。若干补丁还与已交付契约冲突：空响应重试已由 `dsh-llm-retry` 承担；`writableRoots` 已包含 `workspaceRoot`；`SandboxedFileSystem` 写明每种模式都允许读取；`SandboxProvider.confine` 按次调用；用户侧 `!!js` 是已文档化的配置方言；`fs-local` 的 `editText` 已按前 4 KiB 多数票恢复换行。

## Decision

未申报的 `README*` 与 `docs/` 改动已回滚。下列补丁保留，并按所属契约重写：

- **P1.** `translate` 将工具调用 `id`/`name` 的 `null` 视为缺席（`!= null`），并配有回归测试。
- **P2.** `/permission` 在切换到审批策略为 `never` 的预设前询问 `ctx.userQuestions`；该服务缺席或答案不是 `Yes` 时拒绝。`set()` 不要求确认。不以名称子串（`danger`、`yolo`）作为触发条件。
- **P3.** 仅当载体绑定 `0.0.0.0` 且 `remoteAddress` 被证明为非回环时，`/api` 的 HTTP 与 WebSocket 处理才会拒绝。缺失的对端地址不算已证明的远程。`isLoopbackRemoteAddress` 与 `isLoopbackHostname` 放在一起。绑定 `0.0.0.0` 还需要 `allowNonLoopback: true`（`z.boolean().default(false)`）。不存在 TLS 证书校验。
- **P8.** `harness.defineTool` 的 `execute` 收到只读门面，访问 `exec.ctx` 或 `exec.agent.ctx` 会抛错。inject 仍是“宿主半边已声明的服务”；没有硬编码服务白名单。
- **P10.** `dsh plugin` 仅在 TTY 下得到明确 yes 后才激活新安装的 bundle。非 TTY 安装会列出这些 bundle 并保持未激活。
- **W2.** 面向模型的工具输出通过 `posixDisplayPath` 使用 POSIX 分隔符。点名后端 `displayPath` 的错误文本保持后端原拼写。
- **W3.** `str_replace_editor` 先按原文匹配 `old_str`，使混合换行文件仍能区分。原文未命中时，将文件与搜索文本规范为 LF，只把命中的 UTF-16 范围映射回原文偏移，并仅对替换文本应用前 4 KiB 的多数换行。插入使用原文逻辑行偏移与同一换行选择。未编辑区间保留原始字节，包括混合 CRLF/LF 边界与末尾空行。
- **P4.** `runHostHalf` 与 `resolveRequestRun` 要求 `pending.agentId === agent.id`。Client Remote 传入该 agent id；编排器 `approve(requestId, future)` 的 arity 不变。
- **P5.** 位于任务工作区或平台临时目录下的用户补丁文件按不含 `!!js` 的方言解析。这些根之外的 home／profile 文件仍可做 `process.env` 插值。`--patch` overlay 仍受信任。启动不会仅因配置目录落在可写根内就拒绝。
- **P7.** `SubprocessSpawnSpec.sandbox` 与 `SubprocessTerminalSpawnSpec.sandbox` 携带按次策略及可选会话身份。提供方必须实施受限策略，否则拒绝。`LocalSubprocessRuntime` 是普通与终端 spawn 唯一的本地限制归属方；终端分配会在包装前验证原始 argv、取消状态与规范化 cwd。`tool-git` 和 `terminal-bash` 传入已解析策略。未标记的受信任 spawn 仍不受限；E2B 在实现前拒绝受限策略。
- **P11.** 仅当解析后的 origin 与受管应用 origin 相等时，桌面主 renderer 才保留顶层导航。其他 HTTP(S) 目标交给外部浏览器，其他 scheme 一律拒绝；原生恢复操作要求 URL 完全等于 `dsh-desktop://retry` 或 `dsh-desktop://open-log`。
- **B4.** `git_commit` 已通过 `tools/pre-execute` 询问。`tool-bash` 对 `git commit`、`git push` 和 `git reset --hard` 走同一条路径。命令字符串匹配仍可被绕过；该残留由本笔记记录。

下列补丁仍不存在：

- **B1 / B2**（位于 `agent-loop`）。空响应已由 `dsh-llm-retry` 重试。幻觉关键词匹配若需要，应落在 `guard/` 插件；中文收尾短语会在真实工具轮次之后误报。
- **B3.** 过滤自造的 `<invoke>` / `<tool_call>` / `<|tool_sep|>` 标记。它们不属于本仓库的模型方言，只会破坏合法文本。
- **B5.** `SandboxedFileSystem` 上的内存 `undo()`。没有调用方；弹出快照后再 `writeText` 会把错误内容压回栈。
- **P6.** 读取黑名单（`includes('/.env')`）以及仅允许工作区内读取。每种沙箱模式都允许读取；该黑名单还会命中 `.env.example` 和本仓库根目录的 `.env`。
- **P9 的 host-only／define 审批。** 带 Client 的 `cordis_run` 已经等待页面决定。Host-only 包在既有沙箱门面中运行、不再二次确认，这是已文档化的宿主自有路径。`cordis_define` 只暂存源码。硬编码 inject 白名单和工具上的 `ctx.approval` 仍然拒绝。
- **W1.** 在 `writableRoots(policy)` 之外再塞入 `policy.workspaceRoot`。该辅助函数已经包含该根。

## Alternatives considered

**先修编译错误再合入原十八项。** 拒绝：修到能编译之后，若干补丁仍然不成立——fail-open 的确认、fail-open 的 confine、自造 DSML 过滤，以及既有调用方不会传入的必填 `sessionId`。

**在本次把 B1/B2 搬进 `dsh-llm-retry` 和新的 `guard/` 插件。** 拒绝：超出本次范围。空响应重试已经存在。幻觉检测需要单独的误报分析；在 loop 里塞中文子串检查会写错归属，也写错测试。

**在 `fs-local` 的 `resolve` 里规范化 `displayPath`。** 拒绝：测试与桩代码仍按平台路径比较 `displayPath`。展示辅助函数只改写面向模型的文本。

**用 `z.boolean().optional()` 和 `'::'` 检查增加 `allowNonLoopback`。** 拒绝：Schemastery 没有 `.optional()`，且 `host` 只有 `'127.0.0.1' | '0.0.0.0'`。已交付的开关使用 `.default(false)` 并只判断 `0.0.0.0` 字面量。

**通过把 `orchestrator.approve` 改成三参数来审批动态插件运行。** 拒绝：既有两参 UI 调用会把 `requestId` 绑成 session id 并静默空操作。归属在 Host Remote 方法上检查。

## Consequences

仓库重新通过类型检查。既有沙箱逃逸测试保留其 inject 声明。编排器 `approve` 仍是两参数。工作区外的用户补丁仍解析 `!!js`；工作区可写的补丁文件则不能。读取仍不受围栏限制。子进程约束按次写在 spec 上，请求 confine 时 fail-closed。通过 `/permission` 切换到 `danger-full-access` 需要存活的提问服务。绑定通配地址的 `/api` 拒绝已证明的远程对端。绑定 `0.0.0.0` 需要 `allowNonLoopback`。动态宿主半边仍可 inject 其声明的任何服务；它们不能读取 `exec.agent.ctx`。外会话不能结算另一会话的 `cordis/request-run`。

## Testing

`packages/llm/llm-deepseek/tests/translate.spec.ts` 钉住：工具调用名称为 null 时不覆盖已累积的名称。

`packages/interaction/permission-presets/tests/projection.spec.ts` 覆盖已确认的 `never` 切换、拒绝的切换、缺少 `userQuestions` 时的拒绝，以及无需确认的 `ask` 切换。

`packages/client/connection/tests/loopback-hostname.client.spec.ts` 与 `node-half.host.spec.ts` 钉住 `isLoopbackRemoteAddress`，以及通配绑定下 HTTP 与 WebSocket 的对端检查。

`packages/extensions/cordis-host-runner/tests/sandbox-context.spec.ts` 保留原有的 `.ctx` 逃逸、宿主 Promise 与已声明 inject 用例，并增加 `exec.agent.ctx`。

`packages/fs/tool-str-replace-editor/tests/tools.spec.ts` 钉住 CRLF 写回，以及单个 CRLF 行不会改写 LF 文件。`packages/fs/tool-fs/tests/tools.spec.ts` 钉住 `posixDisplayPath`。

`packages/extensions/cordis-host-runner/tests/runner.spec.ts` 拒绝外会话的 `resolveRequestRun`。`packages/boot/app-boot/tests/user-patches.spec.ts` 拒绝工作区根下的 `!!js`。`packages/subprocess/subprocess-local/tests/local.spec.ts` 在 confined spawn 没有 sandbox 服务时抛错。`packages/shell/tool-bash/tests/tools.spec.ts` 在 `git push` 前询问。`packages/host/webserver/tests/webserver.spec.ts` 在没有 `allowNonLoopback` 时拒绝 `0.0.0.0`。
