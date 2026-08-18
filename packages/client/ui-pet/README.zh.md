# @deepseek-ai/dsh-client-ui-pet

[English](README.md) | 中文

浏览器功能插件，向框架级 `shell.overlay` slot 提供一只可拖动的 DeepSeek 蓝鲸。该包持有一份经过验证的 sprite-version-2 图集，包含九行动画和十六个顺时针指针方向；客户端 bundle 会内嵌该图集，因此 Web 与 Desktop profile 不会读取 Codex 配置或用户文件。

当前选中的 Harness 会话驱动主要状态。运行中的 turn 使用 `running`，审批或提问使用 `waiting`，会话、提示词发送、移除或打开失败使用 `failed`；这些会话状态优先于本地手势。turn 结束后，蓝鲸会短暂使用 `review`，再回到 `idle`。首次挂载时会挥手，点击空闲蓝鲸会跳跃，拖动时会在 `running-left` 与 `running-right` 行之间切换。在其他空闲状态下，附近指针会按 22.5 度间隔选择十六个 look cell 之一。高频的 reasoning 块只显示稳定的思考状态，不展示模型内部推理文本；工具目标和回答尾部只作为长度受限的摘要显示。

桌面端使用第二个透明、置顶的窗口承载桌宠。拖动桥接会移动原生窗口，同时保留与 Web overlay 相同的指针和点击行为。主窗口与独立窗口会同步当前会话选择；两个 renderer 各自订阅实时会话流，因此气泡可以跟随运行中的思考、工具调用和文本生成更新。独立窗口会过滤共享 overlay slot，只渲染蓝鲸；页面加载失败时会销毁窗口，后续操作可以重试。

宠物可通过键盘聚焦，通过无障碍名称公开本地化状态，在拖动或窗口尺寸变化时保持在当前 viewport 内，并在 `prefers-reduced-motion` 下停止逐帧动画。当 Harness 处于失败、等待或运行状态时，会话状态始终优先于装饰性动作。

## Model Experience

无，因为该包只读取客户端会话投影并渲染浏览器本地 UI，不会增加模型输入、消息、事件、工具、schema 或提供方请求。

#### KV Cache effect

无；该包不会组装或发送提供方请求。

## 已知限制与延期工作

- Web profile 启用一只内置蓝鲸，暂不提供宠物选择器、显示偏好、缩放控制或替代图集注册表。
- 拖动位置仅在当前页面生命周期内保留，并会在 viewport 尺寸变化后受到约束；应用重新启动后不会持久化。
