# DeepSeek Desktop

[English](README.md) | 中文

DeepSeek Desktop 在安全的 Electron 窗口中打开已发布的 DeepSeek Harness Web profile。它复用同一套 Cordis 组合、会话、模型设置、工具、工作区选择器和本地 API，不维护第二套客户端实现。

## 从源码运行

安装仓库依赖，然后启动桌面窗口：

```sh
pnpm install
pnpm desktop
```

`pnpm desktop` 会在首次运行、相关已跟踪或未提交源码发生变化、必要产物缺失时构建 Host、Client、Web 和 Electron 入口产物；其他情况下直接启动 Electron，终端只显示一行状态。成功构建状态和安静模式下的构建日志保存在 `.cache/deepseek-desktop/`；构建失败时会显示最近输出和完整日志路径。`pnpm run build:desktop` 仍是显式全量构建命令。随后，启动器会在 `http://127.0.0.1:3081` 启动自己的托管服务；桌面端的专用默认值可避免与浏览器命令的 3080 端口冲突。每个桌面进程都会生成一枚 256 位控制令牌，将它传给托管 Host，既不放入命令行也不放入 URL，并由 Electron 网络层注入窗口的 HTTP 与 WebSocket API 请求。就绪探测要求符合预期的 Web 文档、通过认证的控制探测和匿名请求返回 401，因此若无关、过期或未认证进程已占用 3081，启动器会给出准确故障，而不会复用它。

设置 `DSH_DESKTOP_PORT` 可更改托管服务端口。`DSH_DESKTOP_URL` 用于选择显式管理的本地开发服务；该服务要求相同 API 请求头时，还需设置 `DSH_DESKTOP_CONTROL_TOKEN`。

## 支持平台

源码启动器支持 Windows 与 macOS。它通过 Electron 内置的 Node runtime 启动 CLI，因此已启动的桌面进程不依赖平台特定的 `node` 可执行文件名。Windows 使用标题栏 overlay 与稳定的应用 ID；macOS 使用内嵌红黄绿按钮、标准应用菜单、Dock 行为和同一套品牌应用图标。仅当保存的窗口坐标仍与当前显示器相交时，桌面端才会恢复该坐标。

## 桌面行为

应用使用一个原生窗口，提供紧凑的可拖动标题栏、常规窗口尺寸记忆、单实例聚焦、外部浏览器接管新窗口、浏览器权限拒绝、上下文隔离、渲染器沙箱，并禁止页面访问 Node.js。源码启动器允许 Electron 显示 Windows GUI，同时隐藏构建与服务控制台。服务启动期间，窗口会立即显示本地化的启动页面；应用页面导航完成或再次启动应用时，桌面端会重新恢复并显示窗口。故障诊断会区分地址不可达、不兼容服务、构建不完整和认证失败；同一窗口提供重试、可折叠的长度受限输出和当前日志位置。重试和应用退出都会等待自有进程树关闭后再继续。日志写入 Electron 的 DeepSeek Desktop 用户数据目录下的 `logs/desktop.log`，上一次运行的日志保留为 `logs/desktop.previous.log`。

构建完成后，`pnpm test:desktop:built` 会使用临时用户数据目录和回环端口启动真实 Electron 入口、托管 CLI、认证 API 和 Web 应用。该冒烟测试仅在 Web 应用加载完成后退出，随后验证关闭过程已经释放端口，并删除隔离数据。

## 已知限制与待办工作

这个开发者预览包从仓库检出目录运行，不生成安装包。Windows 行为已在本机执行验证；macOS 分支仍需在 macOS 硬件上实际运行，之后才进入发布工作。产品引导、自动更新、签名和可分发打包不属于当前源码运行预览。
