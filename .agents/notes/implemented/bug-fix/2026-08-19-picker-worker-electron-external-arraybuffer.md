# Agent Note: The picker worker reads Win32 result strings without koffi.view

Status: implemented

English | [中文](2026-08-19-picker-worker-electron-external-arraybuffer.zh.md)

## Problem

Selecting a folder in the desktop app crashed the Win32 picker worker with a native fatal error (`Error::New napi_get_last_error_info`) exactly when the selected path was read: the dialog opened, `Show` and `GetResult` succeeded, then the child died. The desktop main process spawns the harness as `electron.exe` with `ELECTRON_RUN_AS_NODE=1`, and `spawnDialogWorker` reuses `process.execPath`, so the dialog child also runs Electron's Node build — which rejects N-API external ArrayBuffers. `readUtf16` called `koffi.view`, whose ArrayBuffer is exactly that.

## Decision

`readUtf16` decodes the string in place with `koffi.decode(address, 'char16', -1)` (koffi's `_Out_ void **` out-params surface the address as a BigInt), then `CoTaskMemFree` releases it as before. The local `Koffi` interface no longer declares `view`, and the fake-koffi test double throws on `view` so the prohibition cannot silently regress. `decode(address, 'str16')` remains a documented trap: `str16` is itself a pointer type, so that call double-dereferences the address — an access violation on real Windows.

The unit lane covers the whole conversation over the fake koffi (where `view` throws); the win32 smoke opens and abort-closes a real dialog under plain node. The Electron-as-Node runtime was verified directly: a `SHGetKnownFolderPath` probe (the same out-param → decode → `CoTaskMemFree` chain) and the built worker's open-cancel lifecycle both run cleanly under `electron.exe` with `ELECTRON_RUN_AS_NODE=1`.

## Alternatives considered

**`koffi.view` over a 32 KB scan window.** Rejected: it works under plain node but is a native fatal under `ELECTRON_RUN_AS_NODE`; this was the shipped defect.

**`koffi.decode(address, 'str16')`.** Rejected: `str16` is a pointer type, so decode reads the pointer at the address and then dereferences it — an access violation, verified on real Windows.

**Spawn the worker under a discovered real `node.exe`.** Rejected: it couples the desktop to a node-discovery mechanism and forks the harness's `process.execPath` convention; fixing the one native call keeps the worker portable across every Node host the harness runs under.

## Consequences

Result extraction allocates only a plain JS string, so the worker runs identically under plain node and Electron-as-Node, and path length is no longer bounded by the old 32 KB scan window. Any future koffi use in Electron-spawned children must avoid `koffi.view` (external ArrayBuffers); the throwing test double pins that rule for this package, and `sandbox-windows-acl` — the other koffi consumer — already reads memory only through `koffi.decode`.
