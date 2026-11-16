/**
 * opencode-wlib — host adapter contract.
 *
 * A single, host-agnostic surface the library's command/keymap, dialog,
 * theme, and renderer helpers talk to. One implementation exists:
 * `./v2` (`createV2Host`) — OpenCode 2.x (`@opencode/plugin/tui`).
 *
 * Types only — no runtime values, so importing it from pure/testable modules
 * is always erased by the runtime transpiler.
 */

import type { JSX } from "solid-js"
import type { DialogSize } from "../core/dialog-fit"
import type { KeyLayerConfig } from "../core/keys"
import type { ThemePalette } from "../core/theme"

/** Which host generation an adapter targets. */
export type HostKind = "v2"

/** Dialog presentation options. */
export interface HostDialogOptions {
  /** Width tier. */
  size?: DialogSize
  /** Center the dialog. */
  centered?: boolean
}

/** Dialog lifecycle: show a render(), set presentation options, clear. */
export interface HostDialog {
  /** Show a dialog rendering `render`; optional close callback. */
  show(render: () => JSX.Element, onClose?: () => void): void
  /** Set presentation options on the active dialog. */
  set(options: HostDialogOptions): void
  /** Close the active dialog. */
  clear(): void
}

/** Terminal/render geometry, in cells. */
export interface HostDimensions {
  width: number
  height: number
}

/** Reactive terminal geometry source. */
export interface HostRenderer {
  /** Read the current geometry synchronously. */
  read(): HostDimensions
  /** Subscribe to resize events; returns an unsubscribe function. */
  subscribe(listener: (dimensions: HostDimensions) => void): () => void
}

/** A palette/global command registration. */
export interface HostCommandOptions {
  /** Command id, e.g. "analyze.show". */
  name: string
  /** Human-readable title. */
  title: string
  /** Slash completion name, e.g. "analyze" → `/analyze`. */
  slashName?: string
  /** Command group (v1 category / v2 group). Defaults to "Plugin". */
  group?: string
  /** Optional key binding, e.g. "ctrl+shift+a" (inline desc defaults to title). */
  key?: string | { key: string; desc: string }
  /** Command handler. */
  run: () => Promise<void> | void
}

/**
 * The host surface every wlib command/keymap/dialog/theme helper uses.
 *
 * Generic over the palette its `theme()` resolves:
 * - `createV2Host` returns `WlibHost<SemanticThemePalette>` — the palette
 *   whose `selectedText` is required (always visible).
 * - The unparameterised `WlibHost` is `WlibHost<ThemePalette>` — the base
 *   shape, whose `selectedText` is required but may be `undefined`.
 *
 * The parameter is covariant (`theme(): P`), so a `WlibHost<SemanticThemePalette>`
 * is assignable wherever the default `WlibHost` (i.e. `WlibHost<ThemePalette>`)
 * is expected — callers that don't care keep the unparameterised spelling.
 */
export interface WlibHost<P extends ThemePalette = ThemePalette> {
  /** Which host generation this adapter targets. */
  readonly kind: HostKind
  /** Register a palette command (+ optional key binding). Returns cleanup. */
  registerCommand(options: HostCommandOptions): () => void
  /** Register a dialog-scoped key layer. Returns cleanup. */
  keymapLayer(config: KeyLayerConfig): () => void
  /** Dialog lifecycle for the host. */
  readonly dialog: HostDialog
  /** Reactive terminal geometry. */
  readonly renderer: HostRenderer
  /** Resolve the current semantic theme palette (RGBA values preserved). */
  theme(): P
}
