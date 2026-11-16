/**
 * Output Styles — OpenCode 2.x server entrypoint.
 *
 * Injects the active output style into the system prompt of every agent-loop
 * request kind (`context`, `compaction`, `generate`) via the session hooks
 * registered in `./server-setup`. The active style is resolved from
 * `~/.config/opencode/output-styles.json`; the TUI part (`./tui`) owns
 * selection through the `/output-style` command.
 *
 * Title generation is intentionally not hooked, so generated titles never
 * receive a style.
 */
import { Plugin } from "@opencode/plugin"
import { setup } from "./server-setup"

export default Plugin.define({
  id: "output-styles",
  setup,
})
