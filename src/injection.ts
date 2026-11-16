/**
 * Pure style-injection core for the v2 server entrypoint.
 *
 * No host imports — every side effect that touches the world (config, style
 * loading, snapshot persistence, logging) is injected, so the whole pipeline
 * is unit-testable with `bun:test` while the entrypoint stays a thin adapter.
 *
 * Behaviour (parity with the v1 `system.transform` pipeline):
 * - style JSON compatibility + legacy migration (via injected `readConfig`)
 * - title-generator exclusion (`isTitleGenerator`, from wlib), failing closed:
 *   an indeterminate predicate skips injection AND snapshot
 * - marker protection + per-call duplicate guard (`STYLE_MARKER`)
 * - primary/subagent routing (event `agent` first; `detectPrimaryAgent` fallback
 *   only for a genuinely primary agent — never for an unknown subagent id)
 * - system-snapshot sidecar (via injected `writeSnapshot`), only for the
 *   request kinds the host marks snapshot-worthy
 */
import type { OutputStylesConfig } from "./types"
import { detectPrimaryAgent, isPrimaryAgentId } from "./agent-detection"
import { isTitleGenerator as defaultIsTitleGenerator } from "./wlib/src/core/system"

/** The canonical marker. The duplicate guard and the snapshot sidecar depend on it. */
export const STYLE_MARKER = "Instructions from: output-styles"

/** A system prompt part (structurally compatible with the host `SystemPart`). */
export interface StyleSystemPart {
  type: "text"
  text: string
  cache?: unknown
  metadata?: unknown
}

/** Structural view of the v2 `session.hook("context")` event. */
export interface StyleInjectionEvent {
  readonly sessionID?: string
  readonly agent?: string
  system: StyleSystemPart[]
}

export interface StyleInjectionDeps {
  /** Resolve the active style config (injectable for tests). */
  readConfig: () => Promise<OutputStylesConfig>
  /** Load the per-agent prompts for a style (injectable for tests). */
  loadPrompts: (styleId: string) => Promise<Map<string, string>>
  /** Persist the final system prompt (injectable/omittable for tests). */
  writeSnapshot?: (sessionID: string, rawText: string) => Promise<void>
  /**
   * Whether this request may persist the shared system-prompt sidecar that
   * `model-usage` reads. Defaults to `true` (preserves the single-caller
   * contract). The host passes `false` for the `compaction`/`generate` request
   * kinds so their auxiliary system prompts cannot overwrite the primary
   * agent-loop snapshot.
   */
  persistSnapshot?: boolean
  /** Title-generator predicate (defaults to wlib `isTitleGenerator`). */
  isTitleGenerator?: (system: string[]) => boolean
  /** Debug logger (defaults to a no-op). */
  log?: (...args: unknown[]) => void
}

const systemText = (system: StyleSystemPart[]): string => system.map((part) => part.text).join("\n")

/** Best-effort error message that never throws, so logging can't reject a hook. */
const errorMessage = (err: unknown): string => {
  try {
    return err instanceof Error ? err.message : String(err)
  } catch {
    return "<unprintable error>"
  }
}

/** Best-effort description of an arbitrary value that never throws. */
const describeValue = (value: unknown): string => {
  try {
    return typeof value === "string" ? value : String(value)
  } catch {
    return `<unprintable ${typeof value}>`
  }
}

/**
 * Inject the active style into an event's system prompt.
 *
 * Returns `true` when a style was injected, `false` otherwise (disabled,
 * title generation, already marked, or no prompt for the resolved agent).
 */
export async function injectStyle(
  event: StyleInjectionEvent,
  deps: StyleInjectionDeps,
): Promise<boolean> {
  const log = deps.log ?? (() => {})

  // Fail closed: only an explicit boolean `false` proves this is NOT a
  // title-generation call. `true` skips injection; a non-boolean result, a
  // thrown predicate, or a non-function value all leave us unable to prove
  // safety, so they abort the whole pipeline — no injection, no snapshot — and
  // never reject the hook.
  let isTitleGen: boolean
  try {
    const result = (deps.isTitleGenerator ?? defaultIsTitleGenerator)(event.system.map((part) => part.text))
    if (result === true || result === false) {
      isTitleGen = result
    } else {
      log("ERROR in isTitleGenerator: non-boolean result, failing closed:", describeValue(result))
      return false
    }
  } catch (err) {
    log("ERROR in isTitleGenerator:", errorMessage(err))
    return false
  }

  try {
    log("injectStyle — sessionID:", event.sessionID, "agent:", event.agent, "parts:", event.system.length)

    // 1. Resolve active style (disabled → nothing to do).
    const config = await deps.readConfig()
    const styleId = config.style
    if (!styleId) return false

    // 2. Skip title generator (defensive — `title` uses its own v2 hook).
    if (isTitleGen) return false

    // 3. Per-call duplicate guard.
    if (systemText(event.system).includes(STYLE_MARKER)) return false

    // 4. Resolve the agent: authoritative event.agent first. Content detection
    //    is a fallback ONLY for a genuine primary agent — either the host gave
    //    no id, or a known primary id whose style entry is missing (e.g.
    //    "build" resolved to "plan"). Any other provided id is a subagent and
    //    must never be re-routed to a primary style by content sniffing.
    const prompts = await deps.loadPrompts(styleId)
    let agent = (event.agent ?? "").toLowerCase()
    let prompt = prompts.get(agent)
    if (!prompt && (!agent || isPrimaryAgentId(agent))) {
      const fallback = detectPrimaryAgent(event.system.map((part) => part.text))
      if (fallback) {
        agent = fallback
        prompt = prompts.get(agent)
      }
    }
    if (!prompt) return false

    // 5. Prepend MARKER + prompt + separator, guarding against an empty array.
    if (event.system.length === 0) {
      event.system.push({ type: "text", text: STYLE_MARKER + "\n" + prompt + "\n\n---" })
    } else {
      const first = event.system[0]
      event.system[0] = { ...first, text: STYLE_MARKER + "\n" + prompt + "\n\n---\n\n" + first.text }
    }
    log("injectStyle — injected MARKER for:", agent)
    return true
  } catch (err) {
    log("ERROR in injectStyle:", errorMessage(err))
    return false
  } finally {
    // Persist the final system prompt for observers (model-usage). Skipped for
    // title-generator calls, for non-snapshot request kinds, and never allowed
    // to reject the hook on a broken writer.
    const persist = deps.persistSnapshot ?? true
    if (persist && !isTitleGen && event.sessionID && deps.writeSnapshot) {
      try {
        await deps.writeSnapshot(event.sessionID, systemText(event.system))
      } catch (err) {
        log("ERROR in writeSnapshot:", errorMessage(err))
      }
    }
  }
}
