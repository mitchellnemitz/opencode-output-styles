# opencode-output-styles

An [OpenCode](https://opencode.ai) plugin that injects an **output style**
into the system prompt of every agent-loop request, per agent. Pick a style
once; the plugin prepends its per-agent instructions to `context`,
`compaction`, and `generate` requests while leaving title generation alone.

Inspired by the author's earlier `persona-injector` plugin.

## Features

- `/output-style` slash command (also `ctrl+shift+m`) opens a style picker
  dialog with keyboard navigation and an in-place save.
- The active style's name and color show in the session and home footers.
- Styles resolve a prompt per agent id (`coordinator`, `plan`, `build`, and
  any subagent id), with content-based fallback detection for primary agents.
- A system-prompt snapshot sidecar lets external observers (such as a
  model-usage analyzer) read the final post-injection prompt.

## Install

```bash
opencode plugin add github:mitchellnemitz/opencode-output-styles
```

The repo is private, so the installing machine needs GitHub access to it.

## Style packs

Style packs live in `~/.config/opencode/output-styles/` as one JSON file per
style; the file name (minus `.json`) is the style id:

```json
{
  "displayName": "My Style",
  "color": "#22c55e",
  "agents": {
    "build": { "prompt": "You are ..." },
    "plan": { "prompt": "You are ..." },
    "reviewer": { "prompt": "You are ...", "enabled": false }
  }
}
```

- `displayName` (required) and `agents.<id>.prompt` (required per entry) are
  the only required fields; `color` defaults to `#22c55e`, and `enabled`
  defaults to `true`.
- A file whose id starts with `_` is a template: every agent in it renders as
  `[disabled]` and can never inject, regardless of its `enabled` values.

## State

| Path | Purpose |
| --- | --- |
| `~/.config/opencode/output-styles.json` | The active style id, or `null` for disabled. |
| `~/.config/opencode/output-styles/` | Style pack JSON files. |
| `~/.local/state/opencode/output-styles/` | Runtime state: debug logs and the system-snapshot sidecar. |

Coming from `persona-injector`: the plugin reads the predecessor's
`persona-injector.json` once to adopt its active `persona` id, and style ids
keep the old file-name convention, so moving the old JSON files from
`~/.config/opencode/personas/` into `~/.config/opencode/output-styles/`
preserves both the selection and the ids.

## Debugging

Set `OPENCODE_WLIB_DEBUG=true` to write a debug log to
`~/.local/state/opencode/output-styles/logs/output-styles.log`.
