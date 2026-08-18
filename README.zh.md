# DeepSeek Desktop

[English](README.md) | 中文

DeepSeek Desktop 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区 fork，面向希望在 Windows 与 macOS 上通过原生桌面窗口使用 coding agent（编程智能体）的开发者。它保留上游由 [Cordis](https://github.com/cordiverse/cordis) 驱动的“一切皆插件”架构，并在此基础上补充桌面运行、工程工作流、受限项目记忆与故障恢复能力。

本项目不是 DeepSeek AI 的官方桌面产品。当前功能位于 `deepseek-desktop` 分支，仍处于开发者预览阶段，可能发生破坏兼容性的变更。

## 为什么做这个 Fork？

原始 Harness 以浏览器为主要使用方式。对于需要长时间运行的桌面开发，这会留下三个实际问题：agent 被限制在浏览器标签页中，第二个窗口没有内置的会话状态伴侣，浏览器里的悬浮元素也不能拖出当前 viewport。

## 我做了什么修改？

- **增加原生 Desktop 宿主：** 使用 Electron 打开现有的 Harness Web 界面、会话、模型、工具和插件组合，同时支持 Windows 与 macOS。
- **增加实时蓝鲸桌宠：** 透明独立窗口会跟随当前会话，显示思考、工具调用、审批、错误和完成状态；主窗口与桌宠会同步当前会话选择。
- **增加可读的实时状态层：** 高频 reasoning 原文被收敛为稳定的思考状态，工具目标和回答尾部只保留长度受限的摘要，避免气泡刷屏。

这些修改服务于需要让 AI 编程环境持续运行整个项目周期的用户。此外，Fork 还增加了本地服务托管与故障恢复、明确的 Git 工作流、受限项目记忆和插件故障隔离，让桌面进程更容易长期稳定使用。

## 本分支提供的功能

### 原生桌面应用

- Electron 外壳复用 Harness 的 Web UI、会话、模型设置、工具和工作区，不维护第二套客户端。
- 桌面端在 `127.0.0.1:3081` 启动托管服务，并为每个进程生成 256 位随机控制凭据。HTTP、RPC 与 WebSocket 请求必须通过认证；凭据不会进入 URL、页面启动数据或日志。
- 服务启动失败时，窗口会显示错误原因、长度受限的最近日志、完整日志位置和重试操作，不再只留下终端报错或空白窗口。
- 源码启动器包含 Windows 与 macOS 窗口行为、单实例聚焦、尺寸记忆、系统菜单、平台标题栏和应用图标。

### coding agent 工程工作流

- 新增 `git_status`、`git_diff`、`git_stage` 和 `git_commit`。暂存只能使用明确路径，提交只能使用已有暂存区，并且每次提交都要求新的人工审批。
- 新增有界项目记忆。正文保存在仓库根目录的 `.dsh-project-memory.json`，启动时只注入小型索引；agent 必须搜索并明确读取相关条目，避免持久化记忆持续占满上下文。
- 工具定义可声明 `observe`、`interact`、`mutate` 或 `orchestrate` 效果等级，供宿主执行权限与恢复策略使用，不把调度元数据泄漏给模型。

### 插件容错与信任说明

- 可选插件可以在独立的 Cordis 子 fiber 中激活。导入或激活失败会被隔离并记录，其他插件可以继续启动；插件清单会展示诊断并允许重试。
- 插件仍是与 Harness 同进程运行的受信任本机代码，可以访问该进程拥有的文件系统、网络、环境变量和进程权限。子 fiber 只隔离受支持的生命周期故障，**不是安全沙箱**。

### 崩溃恢复与审批

- assistant 已请求工具但没有持久化 `tool/call` 时，恢复记录为 `TOOL_NOT_STARTED`，可以按需重新执行。
- 已持久化调用但没有工具结果时，恢复记录为 `TOOL_OUTCOME_UNKNOWN`；系统不会盲目重试可能已经产生副作用的操作。
- 崩溃时尚未回答的审批只会随 interrupted 轮次失效，不会被重放、推定为允许或伪造成人工作出的决定。

## 当前限制

- 当前只提供从源码启动的开发者预览，不生成 Windows 或 macOS 安装包，也未提供代码签名、自动更新和发布渠道。
- Windows 路径已进行本机验证；macOS 启动与窗口分支已实现，但仍需在真实 Mac 硬件上完成运行与打包验收。
- 插件进程隔离、能力授权协议和资源配额尚未实现，因此只能安装并启用你信任的插件。
- 内置 Git 工具不提供 push、force-push、reset、rebase、checkout、远端配置或删除分支；这些高影响操作仍需通过另行授权的 Shell 工作流完成。

## 下载与安装

想同时体验 Desktop 和蓝鲸桌宠，最简单的方式是使用这个 Fork 的 `deepseek-desktop` 分支。你需要安装 Git、pnpm 和 Node.js 22.19 或更高版本。

```sh
git clone --branch deepseek-desktop https://github.com/sublatesublate-design/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm desktop
```

Desktop 会在 `http://127.0.0.1:3081` 启动本地服务。如果只需要浏览器模式，可以运行 `pnpm dsh web`，地址是 `http://127.0.0.1:3080`。

这个 Desktop 分支已经内置蓝鲸插件。如果只想下载插件源码，请访问独立社区仓库 [deepseek-whale-pet](https://github.com/sublatesublate-design/deepseek-whale-pet)。它需要复制到 DSH workspace 中使用，不是可以单独运行的应用，也不是一键安装的 npm 包。

## 运行

### 从源码运行

需要 Node.js 22.19 或更高兼容版本、pnpm 和 Git：

```sh
git clone --branch deepseek-desktop https://github.com/sublatesublate-design/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm desktop
```

桌面应用默认使用 `http://127.0.0.1:3081`。如果只需要浏览器界面，可以运行：

```sh
pnpm dsh web
```

浏览器界面默认使用 `http://127.0.0.1:3080`。

## 详细文档

- [桌面应用：运行方式、安全设计与平台限制](apps/desktop/README.md)
- [Git 工作流工具](packages/git/tool-git/README.md)
- [有界项目记忆](packages/context/tool-project-memory/README.md)
- [插件激活故障隔离](packages/boot/plugin-fault-boundary/README.md)
- [审批与崩溃恢复语义](packages/interaction/user-approval/README.md)

## 上游、开发与许可证

上游项目及原始设计归 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 维护。贡献代码前请阅读[开发指南](docs/development.md)、[架构文档](docs/architecture.md)和 [AGENTS.md](AGENTS.md)。

本 fork 保留上游的 [MIT 许可证](LICENSE)。第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
