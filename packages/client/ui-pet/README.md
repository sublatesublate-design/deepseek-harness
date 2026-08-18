# @deepseek-ai/dsh-client-ui-pet

English | [中文](README.zh.md)

Browser feature plugin that contributes a draggable DeepSeek-blue whale to the frame-wide `shell.overlay` slot. The package owns a validated sprite-version-2 atlas with nine animation rows and sixteen clockwise pointer directions; the client bundle embeds that atlas, so Web and Desktop profiles do not read Codex configuration or user files.

The selected Harness session drives the primary state. A running turn uses `running`, an approval or question uses `waiting`, and conversation, prompt, removal, or open failures use `failed`; these session states take precedence over local gestures. When a turn settles, the whale briefly uses `review` before returning to `idle`. The first mount waves, clicking an idle whale jumps, and dragging switches between the `running-left` and `running-right` rows. While otherwise idle, a nearby pointer selects one of the sixteen look cells at 22.5-degree intervals. High-frequency reasoning blocks use the stable thinking label instead of displaying model-internal reasoning text; tool targets and short response tails remain bounded summaries.

Desktop uses a second transparent always-on-top window for the companion. Its drag bridge moves that native window while preserving the same pointer and click behavior as the Web overlay. The main and standalone renderers synchronize the selected session, while each renderer keeps its own live session stream for speech updates. The standalone window filters the shared overlay slot so only the whale is rendered there; a failed page load destroys the window and can be retried.

The pet is keyboard-focusable, exposes its localized state through its accessible name, stays inside the current viewport while dragged or resized, and stops frame animation under `prefers-reduced-motion`. Session state always outranks decorative gestures when the Harness is failed, waiting, or running.

## Model Experience

None, as this package only reads client session projections and renders browser-local UI without adding model input, messages, events, tools, schemas, or provider requests.

#### KV Cache effect

None; the package never assembles or sends a provider request.

## Known Limitations and Deferred Work

- The Web profile enables one built-in whale and does not yet expose a pet picker, visibility preference, scale control, or alternate atlas registry.
- Drag position lasts for the current page lifetime and is clamped after viewport resize; it is not persisted across application launches.
