/**
 * opencode-wlib — normalized theme palette.
 *
 * OpenCode themes expose color values under different property names
 * across plugin code (e.g. `text` vs `foreground`, `textMuted` vs
 * `muted`, `error` vs `red`). This helper normalizes them into a single
 * typed palette with sensible fallbacks, so dialogs stop drifting.
 *
 * Color values are OpenCode `RGBA` objects (from `@opentui/core`), not
 * strings — pass any non-null object through untouched. The RGBA type is
 * imported type-only, so core modules stay runtime-host-agnostic.
 */

import type { RGBA } from "@opentui/core"

/** A theme color value: a hex string, or an OpenCode RGBA object. */
export type ThemeColorValue = string | RGBA

export interface ThemePalette {
  /** Primary text color. */
  fg: ThemeColorValue
  /** Secondary/muted text color. */
  muted: ThemeColorValue
  /** Error/danger color. */
  red: ThemeColorValue
  /**
   * Success/positive feedback color (e.g. a completed operation).
   *
   * Optional on the base shape: {@link resolveThemeColors} leaves it
   * unpopulated when the theme names no success color.
   * {@link resolveSemanticTheme} always populates it at runtime;
   * {@link SemanticThemePalette} narrows it to required.
   */
  success?: ThemeColorValue
  /**
   * Warning/caution feedback color.
   *
   * Optional on the base shape: {@link resolveThemeColors} leaves it
   * unpopulated when the theme names no warning color.
   * {@link resolveSemanticTheme} always populates it at runtime;
   * {@link SemanticThemePalette} narrows it to required.
   */
  warning?: ThemeColorValue
  /** Selection/active background color. */
  primary: ThemeColorValue
  /**
   * Text color used on the selected list item. The base shape types it as
   * possibly `undefined` (`ThemeColorValue | undefined`): the loose resolver
   * (`resolveThemeColors`) may leave it `undefined` when the theme names no
   * selection text. The semantic resolver (`resolveSemanticTheme`) always
   * yields a visible value and returns {@link SemanticThemePalette}, where
   * `selectedText` is required and always defined.
   */
  selectedText: ThemeColorValue | undefined
  /** Background color of the app/surface. */
  background: ThemeColorValue
  /** Dialog/panel surface background color. */
  panel: ThemeColorValue
}

/**
 * v2-specific resolved palette: every field of {@link ThemePalette}, but
 * `selectedText`, `success` and `warning` are **required**.
 * `resolveSemanticTheme` never yields `undefined` for them —
 * `selectedText` falls back to the resolved, visible `fg` and the feedback
 * colors fall back to `THEME_DEFAULTS` — so consumers get
 * non-optional values without a `?? fallback`.
 *
 * Extends {@link ThemePalette}, so it is a drop-in wherever the base shape is
 * expected (e.g. `createV2Host` returns `WlibHost<SemanticThemePalette>`, which
 * remains assignable to `WlibHost`).
 */
export interface SemanticThemePalette extends ThemePalette {
  /** Text color used on the selected list item. Always defined and visible (v2). */
  selectedText: ThemeColorValue
  /** Success/positive feedback color. Always defined (v2). */
  success: ThemeColorValue
  /** Warning/caution feedback color. Always defined (v2). */
  warning: ThemeColorValue
}

export interface ThemePaletteFallbacks {
  fg?: ThemeColorValue
  muted?: ThemeColorValue
  red?: ThemeColorValue
  success?: ThemeColorValue
  warning?: ThemeColorValue
  primary?: ThemeColorValue
  background?: ThemeColorValue
  panel?: ThemeColorValue
}

/** Default palette values, shared by both resolvers. */
export const THEME_DEFAULTS = {
  fg: "#ffffff",
  muted: "#888888",
  red: "#ef4444",
  success: "#22c55e",
  warning: "#eab308",
  primary: "#4f46e5",
  background: "#000000",
  panel: "#000000",
} as const satisfies Record<string, ThemeColorValue>

/**
 * Structural view of the OpenCode v2 `ResolvedTheme` semantic tokens
 * (`@opencode/theme/tui`). Kept structural on purpose: leaves are `unknown`
 * so RGBA objects pass through untouched and the type tracks whatever the
 * host actually resolves, without importing the theme package. Only the
 * tokens wlib maps are declared.
 *
 * NOTE ON KEYS: `context.theme` is already-resolved, so its action states drop
 * the `$` sigil — `focused`, `selected`, `base`, … (see `resolvedKey` in the
 * host's theme resolver). The `$focused`/`$selected` spelling appears only in
 * the *raw* theme definitions a plugin might author, never in the resolved
 * context. This type models the resolved shape.
 */
export interface SemanticThemeLike {
  readonly text?: {
    readonly base?: unknown
    readonly muted?: unknown
    readonly action?: {
      readonly primary?: {
        /** Resting text color on the primary action surface. */
        readonly base?: unknown
        /** Text color while the action is focused — the visible contrast text. */
        readonly focused?: unknown
        /** Text color while the action is selected. */
        readonly selected?: unknown
      }
    }
    readonly feedback?: {
      readonly error?: { readonly base?: unknown }
      readonly success?: { readonly base?: unknown }
      readonly warning?: { readonly base?: unknown }
    }
  }
  readonly background?: {
    readonly base?: unknown
    readonly raised?: { readonly base?: unknown; readonly high?: unknown; readonly max?: unknown }
    readonly action?: {
      readonly primary?: {
        /** Resting surface color; the default v2 theme sets this to `transparent`. */
        readonly base?: unknown
        /** Surface color while focused — the visible accent that paints a selected row. */
        readonly focused?: unknown
        /** Surface color while selected; often `transparent` in the default v2 theme. */
        readonly selected?: unknown
      }
    }
  }
}

/**
 * A valid color value is a non-empty string OR a non-null object (OpenCode
 * theme colors are RGBA instances). Everything else (numbers, null,
 * undefined, empty strings) is treated as missing.
 */
function validColor(v: unknown): ThemeColorValue | undefined {
  if (typeof v === "string") return v.length > 0 ? v : undefined
  if (v !== null && typeof v === "object") return v as ThemeColorValue
  return undefined
}

/**
 * True when a color is explicitly see-through: the literal `"transparent"`
 * string, or an OpenCode `RGBA` whose alpha is zero. An RGBA without an
 * `alpha`-bearing object shape (no `a`) is treated as opaque.
 */
function isTransparent(v: ThemeColorValue): boolean {
  if (typeof v === "string") return v.toLowerCase() === "transparent"
  return v.a === 0
}

/**
 * Like {@link validColor}, but rejects see-through values. Used for the
 * surface tokens (selection background, app background, panel) where a
 * transparent value would render the element invisible rather than fall
 * through to a usable default. Non-transparent RGBA objects are preserved
 * by identity.
 */
function visibleColor(v: unknown): ThemeColorValue | undefined {
  const c = validColor(v)
  return c !== undefined && !isTransparent(c) ? c : undefined
}

/**
 * Resolve a normalized palette from any theme-like object. Accepts both
 * property-name conventions (`text`/`foreground`, `textMuted`/`muted`,
 * `error`/`red`) and falls back to defaults. The semantic feedback colors
 * `success`/`warning` map from `theme.success`/`theme.warning`, then the
 * caller's fallbacks, then `THEME_DEFAULTS`.
 *
 * `success`/`warning` are optional on the returned {@link ThemePalette} type;
 * this resolver always populates them at runtime (never `undefined`).
 */
export function resolveThemeColors(
  theme: { [key: string]: unknown } | null | undefined,
  fallbacks: ThemePaletteFallbacks = {},
): ThemePalette {
  return {
    fg: validColor(theme?.text) ?? validColor(theme?.foreground) ?? fallbacks.fg ?? THEME_DEFAULTS.fg,
    muted: validColor(theme?.textMuted) ?? validColor(theme?.muted) ?? fallbacks.muted ?? THEME_DEFAULTS.muted,
    red: validColor(theme?.error) ?? validColor(theme?.red) ?? fallbacks.red ?? THEME_DEFAULTS.red,
    success:
      validColor(theme?.success) ?? fallbacks.success ?? THEME_DEFAULTS.success,
    warning:
      validColor(theme?.warning) ?? fallbacks.warning ?? THEME_DEFAULTS.warning,
    primary: validColor(theme?.primary) ?? fallbacks.primary ?? THEME_DEFAULTS.primary,
    selectedText: validColor(theme?.selectedListItemText),
    background: validColor(theme?.background) ?? fallbacks.background ?? THEME_DEFAULTS.background,
    panel: validColor(theme?.backgroundPanel) ?? fallbacks.panel ?? THEME_DEFAULTS.panel,
  }
}

/**
 * Resolve a normalized palette from the OpenCode v2 semantic theme tokens
 * (`context.theme`, a `ResolvedTheme`). RGBA values are passed through
 * untouched — never string-coerced — so the host's color objects survive.
 *
 * Mapping:
 * - `fg`          ← `text.base` (must itself be visible: a transparent/zero-alpha
 *                   `text.base` is skipped and falls through to
 *                   `THEME_DEFAULTS.fg`, so the `selectedText` fallback below can
 *                   never inherit invisible text)
 * - `muted`       ← `text.muted`
 * - `red`         ← `text.feedback.error.base`
 * - `success`     ← `text.feedback.success.base` (a transparent/zero-alpha token
 *                   falls back to `THEME_DEFAULTS.success`)
 * - `warning`     ← `text.feedback.warning.base` (same visible-color rule as
 *                   `success`)
 * - `primary`     ← `background.action.primary.focused`, then `selected`,
 *                   then `.base` (selected-row background). The default v2
 *                   theme leaves `.base`/`selected` `transparent` and only
 *                   paints the accent on `focused`, so focused wins.
 * - `selectedText`← `text.action.primary.focused`, then `selected`, then
 *                   `.base` (text on the primary background), and finally the
 *                   resolved `fg`. Consumers always need *visible* text, so
 *                   when every selection text state is absent or transparent
 *                   this never yields `undefined` — it falls back to the
 *                   resting foreground. (The loose resolver,
 *                   {@link resolveThemeColors}, deliberately keeps `undefined`.)
 * - `background`  ← `background.base`
 * - `panel`       ← `background.raised.base`, then `background.raised.high`:
 *                   the dialog/panel surface, then the lighter menu surface.
 *
 * Resolved keys carry no `$` sigil (unlike the raw `$focused`/`$selected`
 * definition keys), matching the host's `ResolvedTheme`.
 *
 * Transparent values (`"transparent"` or zero-alpha RGBA) are treated as absent
 * so a theme cannot paint an invisible surface or label: for the selection
 * background and app/panel surfaces a see-through value would render nothing,
 * for `selectedText` it would render invisible text (so a transparent
 * selected-text token is *skipped* rather than preserved), and for the semantic
 * feedback tokens (`success`/`warning`) it would render invisible status text.
 * A transparent feedback token therefore falls back to its `THEME_DEFAULTS`
 * counterpart, and `selectedText` lands on the resolved foreground instead of
 * `undefined` so a label can never render invisible text; the resolved foreground
 * is itself drawn only from a visible `text.base` (a transparent one falls
 * through to `THEME_DEFAULTS.fg`). Non-transparent RGBA objects are preserved by
 * identity.
 *
 * Returns {@link SemanticThemePalette} — the base {@link ThemePalette} shape
 * with `selectedText`, `success` and `warning` narrowed to required (this
 * resolver always yields a value for all three).
 */
export function resolveSemanticTheme(
  theme: SemanticThemeLike | null | undefined,
): SemanticThemePalette {
  const actionBackground = theme?.background?.action?.primary
  const actionText = theme?.text?.action?.primary
  const fg = visibleColor(theme?.text?.base) ?? THEME_DEFAULTS.fg
  return {
    fg,
    muted: validColor(theme?.text?.muted) ?? THEME_DEFAULTS.muted,
    red: validColor(theme?.text?.feedback?.error?.base) ?? THEME_DEFAULTS.red,
    success:
      visibleColor(theme?.text?.feedback?.success?.base) ?? THEME_DEFAULTS.success,
    warning:
      visibleColor(theme?.text?.feedback?.warning?.base) ?? THEME_DEFAULTS.warning,
    primary:
      visibleColor(actionBackground?.focused) ??
      visibleColor(actionBackground?.selected) ??
      visibleColor(actionBackground?.base) ??
      THEME_DEFAULTS.primary,
    selectedText:
      visibleColor(actionText?.focused) ??
      visibleColor(actionText?.selected) ??
      visibleColor(actionText?.base) ??
      fg,
    background: visibleColor(theme?.background?.base) ?? THEME_DEFAULTS.background,
    panel:
      visibleColor(theme?.background?.raised?.base) ??
      visibleColor(theme?.background?.raised?.high) ??
      THEME_DEFAULTS.panel,
  }
}
