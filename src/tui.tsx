/** @jsxImportSource @opentui/solid */
/**
 * Output Styles — OpenCode 2.x TUI entrypoint.
 *
 * OpenCode v2 (`@opencode/plugin/tui`) exposes the plugin `Context` in
 * `setup(context)`. This entrypoint:
 *
 * - builds the v2 host adapter once (`createV2Host(context)`) and hands it to
 *   every wlib helper — never touches the raw host API,
 * - claims the `prompt.footer.status` + `home.footer.status` slots for the
 *   active output-style indicator,
 * - registers `/output-style` (`ctrl+shift+m`) through wlib's host-agnostic
 *   `registerSlashCommand`,
 * - opens the shared style dialog (which consumes only `WlibHost`).
 */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { StylePromptIndicator } from "./prompt-indicator"
import { openStyleDialog } from "./dialog"
import { readConfig, STYLES_DIR } from "./config"
import { loadStyles } from "./styles"
import { createV2Host } from "./wlib/src/host/v2"
import { registerSlashCommand } from "./wlib/src/core/command"
import type { StyleMeta } from "./types"

export default Plugin.define({
  id: "output-styles",
  async setup(context) {
    const host = createV2Host(context)

    const [styles, setStyles] = createSignal<StyleMeta[]>([])
    const [activeId, setActiveId] = createSignal<string | null>(null)
    const [activeDisplayName, setActiveDisplayName] = createSignal<string | null>(null)
    const [activeColor, setActiveColor] = createSignal<string | null>(null)

    // Load initial state
    const [loaded, config] = await Promise.all([
      loadStyles(STYLES_DIR),
      readConfig(),
    ])
    setStyles(loaded)
    updateActive(config.style)

    function updateActive(id: string | null) {
      setActiveId(id)
      if (id) {
        const meta = styles().find((p) => p.id === id)
        setActiveDisplayName(meta?.displayName ?? id)
        setActiveColor(meta?.color ?? "#22c55e")
      } else {
        setActiveDisplayName(null)
        setActiveColor(null)
      }
    }

    function onStyleChanged(id: string | null) {
      updateActive(id)
    }

    const notify = (message: string) => context.ui.toast.show({ message })

    // Active-style indicator in the session and home footers.
    context.ui.slot({
      append: "prompt.footer.status",
      render: () => (
        <StylePromptIndicator displayName={activeDisplayName()} color={activeColor()} />
      ),
    })
    context.ui.slot({
      append: "home.footer.status",
      render: () => (
        <StylePromptIndicator displayName={activeDisplayName()} color={activeColor()} />
      ),
    })

    // Register the output-style command + keybinding.
    registerSlashCommand(host, {
      name: "output-style.select",
      title: "Select Output Style",
      slashName: "output-style",
      key: "ctrl+shift+m",
      async run() {
        const fresh = await loadStyles(STYLES_DIR)
        setStyles(fresh)
        openStyleDialog(host, notify, onStyleChanged, styles, activeId)
      },
    })
  },
})
