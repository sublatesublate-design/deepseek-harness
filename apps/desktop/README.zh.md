# DeepSeek Harness 桌面端

[English](README.md) | 中文

桌面应用在安全的 Electron 窗口中打开已发布的 Web profile。它复用同一套 Cordis 组合、会话、模型设置、工具、工作区选择器和本地 API，不维护第二套客户端实现。

## 从源码运行

安装依赖并构建一次仓库，然后启动桌面窗口：

```sh
pnpm install
pnpm run build
pnpm desktop
```

启动器会在 `http://127.0.0.1:3081` 启动自己的托管服务。桌面端的专用默认值可避免与浏览器命令的 3080 端口冲突。每个桌面进程都会生成一枚 256 位控制令牌，将它传给托管 Host，既不放入命令行也不放入 URL，并由 Electron 网络层注入窗口的 HTTP 与 WebSocket API 请求。就绪探测要求服务具有匹配的凭据边界，因此若无关或未认证进程已占用 3081，启动器会报告启动失败，而不会复用它。

设置 `DSH_DESKTOP_PORT` 可更改托管服务端口。`DSH_DESKTOP_URL` 用于选择显式管理的本地开发服务；该服务要求相同 API 请求头时，还需设置 `DSH_DESKTOP_CONTROL_TOKEN`。

## 支持平台

源码启动器支持 Windows 与 macOS。它通过 Electron 内置的 Node runtime 启动 CLI，因此已启动的桌面进程不依赖平台特定的 `node` 可执行文件名。Windows 使用标题栏 overlay 与稳定的应用 ID；macOS 使用内嵌红黄绿按钮、标准应用菜单、Dock 行为和同一套品牌应用图标。

## 桌面行为

应用使用一个原生窗口，提供紧凑的可拖动标题栏、常规窗口尺寸记忆、单实例聚焦、外部浏览器接管新窗口、浏览器权限拒绝、上下文隔离、渲染器沙箱，并禁止页面访问 Node.js。本地服务启动失败时，同一窗口会显示故障、长度受限的最近服务输出、当前日志文件位置，以及重试或在文件管理器中显示日志的操作。日志写入 Electron 的 DeepSeek Harness 用户数据目录下的 `logs/desktop.log`。

## 已知限制与待办工作

这个开发者预览包从已构建的仓库检出目录运行，不生成安装包。Windows 行为已在本机执行验证；macOS 分支仍需在 macOS 硬件上实际运行，之后才进入发布工作。产品引导、自动更新、签名和可分发打包不属于当前源码运行预览。
