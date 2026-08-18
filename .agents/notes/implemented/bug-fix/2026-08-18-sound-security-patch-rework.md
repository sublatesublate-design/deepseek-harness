# Agent Note: Keep only sound security patches

Status: implemented

English | [中文](2026-08-18-sound-security-patch-rework.zh.md)

## Problem

A batch of eighteen security and behavior patches did not typecheck, broke existing sandbox-escape tests, silently broke approval callers, and replaced the bilingual README pair. Several patches also contradicted shipped contracts: empty-response retry already lives in `dsh-llm-retry`; `writableRoots` already includes `workspaceRoot`; `SandboxedFileSystem` documents that every mode may read; `SandboxProvider.confine` is per-call; user `!!js` is a documented config dialect; and `fs-local` `editText` already restores line endings by a majority-of-first-4k rule.

## Decision

Undeclared `README*` and `docs/` edits are reverted. The following patches stay, each rewritten to the owning contract:

- **P1.** `translate` treats `null` tool-call `id`/`name` as absent (`!= null`), with a regression test.
- **P2.** `/permission` asks `ctx.userQuestions` before switching to a preset whose approval is `never`, and refuses when that service is absent or the answer is not `Yes`. `set()` does not confirm. Name-substring matching (`danger`, `yolo`) is not the trigger.
- **P3.** `/api` HTTP and WebSocket handlers reject a proven non-loopback `remoteAddress` only when the carrier is bound to `0.0.0.0`. A missing peer address is not proven remote. `isLoopbackRemoteAddress` lives beside `isLoopbackHostname`. Binding `0.0.0.0` also requires `allowNonLoopback: true` (`z.boolean().default(false)`). There is no TLS certificate check.
- **P8.** `harness.defineTool` `execute` receives a read-only façade that throws on `exec.ctx` and `exec.agent.ctx`. Inject remains "whatever the host half declared"; there is no hardcoded service allowlist.
- **P10.** `dsh plugin` activates a newly installed bundle only after a TTY yes. A non-TTY install names the bundles and leaves them inactive.
- **W2.** Model-facing tool output uses POSIX separators through `posixDisplayPath`. Error text that names a backend `displayPath` keeps the backend spelling.
- **W3.** `str_replace_editor` first matches `old_str` verbatim so mixed-EOL files stay unique. When that misses, it LF-normalizes file and search text, then restores the majority line ending of the first 4 KiB — the same rule `dsh-fs-local` `editText` already applies. A single CRLF line does not convert an LF file.
- **P4.** `runHostHalf` and `resolveRequestRun` require `pending.agentId === agent.id`. The Client Remote now passes that agent id; the orchestrator `approve(requestId, future)` arity is unchanged.
- **P5.** User patch files under the task workspace or platform temp parse without `!!js`. Home and profile files outside those roots keep `process.env` interpolation. `--patch` overlays stay trusted. Boot does not refuse a config directory merely for sitting under a writable root.
- **P7.** `SubprocessSpawnSpec.sandbox` is the per-call policy. `LocalSubprocessRuntime` confines when it is present and not `danger-full-access`, and throws if `ctx.sandbox` is absent. `tool-git` passes the resolved policy. Unmarked trusted spawns stay unconfined.
- **B4.** `git_commit` already asks through `tools/pre-execute`. `tool-bash` asks the same way for `git commit`, `git push`, and `git reset --hard`. Command-string matching remains bypassable; that residual is documented by this note.

These patches remain absent:

- **B1 / B2** in `agent-loop`. Empty responses already retry in `dsh-llm-retry`. Hallucination keyword matching belongs in a `guard/` plugin if it is wanted at all, and Chinese completion phrases false-positive after a real tool round.
- **B3.** Filtering invented `<invoke>` / `<tool_call>` / `<|tool_sep|>` markers. They do not appear in this codebase's model dialect and would corrupt legitimate text.
- **B5.** In-memory `undo()` on `SandboxedFileSystem`. No caller, and a snapshot pop followed by `writeText` would push the bad content back.
- **P6.** Read blacklists (`includes('/.env')`) and workspace-only reads. Every sandbox mode permits reading; the blacklist also matches `.env.example` and the repo's own root `.env`.
- **P9 host-only / define approval.** Client-bearing `cordis_run` already waits for a page decision. Host-only packages run in the existing sandbox façade without a second prompt; that is the documented host-owned path. `cordis_define` only stages source. A hardcoded inject allowlist and `ctx.approval` on the tools are still rejected.
- **W1.** Re-adding `policy.workspaceRoot` beside `writableRoots(policy)`. The helper already includes that root.

## Alternatives considered

**Land the original eighteen patches after fixing compile errors.** Rejected because several patches remain incorrect after they typecheck: fail-open confirmation, fail-open confine, invented DSML filters, and a required `sessionId` that existing callers do not pass.

**Move B1/B2 into `dsh-llm-retry` and a new `guard/` plugin in this change.** Rejected as out of scope. Empty-response retry already exists. A hallucination detector needs its own false-positive analysis; shipping a Chinese-substring check in the loop would have encoded the wrong owner and the wrong test.

**Normalize `displayPath` inside `fs-local` `resolve`.** Rejected because `displayPath` is also compared against platform paths in tests and stubs. Presentation helpers rewrite only model-visible text.

**Add `allowNonLoopback` with `z.boolean().optional()` and a `'::'` host check.** Rejected: Schemastery has no `.optional()`, and `host` is only `'127.0.0.1' | '0.0.0.0'`. The shipped flag uses `.default(false)` and tests the `0.0.0.0` literal.

**Approve dynamic-plugin runs by changing `orchestrator.approve` to three arguments.** Rejected because existing two-argument UI callers would bind `requestId` as a session id and silently no-op. Ownership is checked on the Host Remote methods instead.

## Consequences

The tree typechecks again. Existing sandbox-escape tests keep their inject declarations. Orchestrator `approve` keeps two arguments. User patches outside the workspace still parse `!!js`; workspace-writable patch files do not. Reads stay unfenced. Subprocess confinement is per-call on the spec and fail-closed when requested. Switching to `danger-full-access` through `/permission` requires a live question provider. `/api` on a wildcard bind refuses a proven remote peer. Binding `0.0.0.0` requires `allowNonLoopback`. Dynamic host halves still inject any service they declare; they cannot read `exec.agent.ctx`. A foreign session cannot settle another session's `cordis/request-run`.

## Testing

`packages/llm/llm-deepseek/tests/translate.spec.ts` pins a null tool-call name leaving the accumulated name intact.

`packages/interaction/permission-presets/tests/projection.spec.ts` covers a confirmed `never` switch, a declined switch, a missing `userQuestions` refusal, and an unconfirmed `ask` switch.

`packages/client/connection/tests/loopback-hostname.client.spec.ts` and `node-half.host.spec.ts` pin `isLoopbackRemoteAddress` and the wildcard-bind peer check on HTTP and WebSocket.

`packages/extensions/cordis-host-runner/tests/sandbox-context.spec.ts` keeps the original `.ctx` escape, host-Promise, and declared-inject cases, and adds `exec.agent.ctx`.

`packages/fs/tool-str-replace-editor/tests/tools.spec.ts` pins CRLF restore and that one CRLF line does not rewrite an LF file. `packages/fs/tool-fs/tests/tools.spec.ts` pins `posixDisplayPath`.

`packages/extensions/cordis-host-runner/tests/runner.spec.ts` refuses `resolveRequestRun` from a foreign agent. `packages/boot/app-boot/tests/user-patches.spec.ts` refuses `!!js` under the workspace root. `packages/subprocess/subprocess-local/tests/local.spec.ts` throws when a confined spawn has no sandbox service. `packages/shell/tool-bash/tests/tools.spec.ts` asks before `git push`. `packages/host/webserver/tests/webserver.spec.ts` refuses `0.0.0.0` without `allowNonLoopback`.
