# Agent Note: The picker worker reads Win32 result strings without koffi.view

Status: implemented

[English](2026-08-19-picker-worker-electron-external-arraybuffer.md) | 中文

## Problem

在桌面应用中选择文件夹时，Win32 目录选择 worker 恰好在读取所选路径的瞬间以原生致命错误（`Error::New napi_get_last_error_info`）崩溃：对话框正常打开，`Show` 与 `GetResult` 成功，随后子进程死亡。桌面主进程以 `electron.exe` 加 `ELECTRON_RUN_AS_NODE=1` 启动 harness，而 `spawnDialogWorker` 复用 `process.execPath`，因此对话框子进程同样运行在 Electron 的 Node 构建之上——该构建拒绝 N-API 外部 ArrayBuffer。`readUtf16` 调用的 `koffi.view` 恰好会创建外部 ArrayBuffer。

## Decision

`readUtf16` 改为用 `koffi.decode(address, 'char16', -1)` 原地解码字符串（koffi 的 `_Out_ void **` 出参把地址以 BigInt 形式交回），随后照旧由 `CoTaskMemFree` 释放。本地 `Koffi` 接口不再声明 `view`，fake-koffi 测试替身对 `view` 直接抛错，使该禁令无法无声回退。`decode(address, 'str16')` 仍是一个已记录的陷阱：`str16` 本身是指针类型，该调用会对地址做双重解引用——在真实 Windows 上是访问违例。

单元测试通道通过 fake koffi（其中 `view` 抛错）覆盖完整对话；win32 冒烟测试在纯 node 下打开并中止真实对话框。Electron-as-Node 运行时做了直接验证：`SHGetKnownFolderPath` 探针（同样的出参 → decode → `CoTaskMemFree` 链路）与构建产物 worker 的打开-取消生命周期都在 `electron.exe` 加 `ELECTRON_RUN_AS_NODE=1` 下干净运行。

## Alternatives considered

**在 32 KB 扫描窗口上使用 `koffi.view`。** 否决：它在纯 node 下可用，但在 `ELECTRON_RUN_AS_NODE` 下是原生致命错误；这正是已交付的缺陷。

**`koffi.decode(address, 'str16')`。** 否决：`str16` 是指针类型，decode 会先读出地址处的指针再解引用——在真实 Windows 上已验证为访问违例。

**在找到的真实 `node.exe` 下 spawn worker。** 否决：这使桌面端耦合一套 node 发现机制，并分叉了 harness 的 `process.execPath` 约定；修复这一处原生调用让 worker 在 harness 运行的所有 Node 宿主间保持可移植。

## Consequences

结果提取只分配普通 JS 字符串，因此 worker 在纯 node 与 Electron-as-Node 下行为一致，路径长度也不再受旧的 32 KB 扫描窗口限制。今后在 Electron 派生子进程中使用 koffi 必须避开 `koffi.view`（外部 ArrayBuffer）；抛错的测试替身为本包钉死了这条规则，而另一个 koffi 使用方 `sandbox-windows-acl` 本就只通过 `koffi.decode` 读取内存。
