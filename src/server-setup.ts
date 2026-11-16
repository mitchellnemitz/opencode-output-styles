/**
 * Output Styles — OpenCode 2.x server setup.
 *
 * Consumed by the default export in `./index.ts` (`Plugin.define`), which is
 * the only server entrypoint. This module stays a non-entrypoint helper so
 * the package scanner cannot resolve a second server plugin from it.
 *
 * OpenCode v2 (`@opencode/plugin`) exposes a single **session context hook**.
 * The context event is mutable immediately before provider dispatch and carries:
 *
 * - `event.system`  — the system prompt as an array of `{ type: "text", text }` parts
 * - `event.agent`   — the authoritative agent id (primary AND subagent sessions)
 * - `event.sessionID`
 * - `event.messages`, `event.model`, `event.tools`
 *
 * The setup function registers the pure, injectable `injectStyle` pipeline (see
 * `./injection`) on `context`, `compaction` and `generate` — exactly the agent-loop
 * request kinds. It deliberately does NOT register the separate `title` hook, so
 * title-generation calls never receive a style.
 *
 * Request kinds are distinguished at registration: only the primary `context`
 * request is allowed to persist the shared system-snapshot sidecar that
 * `model-usage` reads; `compaction`/`generate` inject a style but never
 * overwrite that snapshot with their auxiliary system prompts.
 */
import type { Plugin } from "@opencode/plugin"
import { homedir } from "node:os"
import { readConfig, STYLES_DIR } from "./config"
import { loadStyles, resolveStylePrompt } from "./styles"
import type { StyleMeta } from "./types"
import { createLog } from "./wlib/src/core/log"
import { writeSystemSnapshot } from "./wlib/src/core/system"
import { injectStyle, type StyleInjectionEvent } from "./injection"

/** Stable state root — survives plugin reinstalls and version bumps. */
const STATE_DIR = `${homedir()}/.local/state/opencode/output-styles`
const logger = createLog({ dir: `${STATE_DIR}/logs`, fileName: "output-styles.log" })
const log = logger.log

// Map<styleId, Map<agent, prompt>> — style prompts cached after first load
const stylePromptCache = new Map<string, Map<string, string>>()

/**
 * Loads and caches the per-agent prompts for a given style.
 *
 * - Returns the cached `Map<agent, prompt>` when the style was already loaded.
 * - Otherwise loads every style from `STYLES_DIR`, finds the one matching
 *   `styleId`, resolves a prompt for each agent via `resolveStylePrompt`,
 *   caches the result, and returns it.
 */
export async function loadStylePrompts(
  styleId: string,
): Promise<Map<string, string>> {
  const cached = stylePromptCache.get(styleId)
  if (cached) return cached

  const styles = await loadStyles(STYLES_DIR)
  const meta = styles.find((m: StyleMeta) => m.id === styleId)
  const prompts = new Map<string, string>()

  if (meta) {
    for (const agent of Object.keys(meta.agents)) {
      const prompt = resolveStylePrompt(meta, agent)
      if (prompt) prompts.set(agent, prompt)
    }
  }

  stylePromptCache.set(styleId, prompts)
  log("loadStylePrompts — styleId:", styleId, "found meta:", !!meta, "prompts:", [...prompts.keys()])
  return prompts
}

/**
 * OpenCode 2.x server setup. Consumed by the dual-generation default export in
 * `../output-styles-server.ts` (`{ id, server, setup }`); v2 uses `id + setup`.
 */
export async function setup(ctx: Plugin.Context): Promise<void> {
  const deps = {
    readConfig,
    loadPrompts: loadStylePrompts,
    writeSnapshot: writeSystemSnapshot,
    log,
  }

  // The hook callback must return void; `injectStyle` returns a boolean for
  // testability, so swallow it here.
  //
  // Only the primary agent-loop `context` request owns the shared sidecar
  // snapshot that `model-usage` reads. `compaction`/`generate` still receive
  // the style, but must NOT overwrite that snapshot with their auxiliary
  // system prompts.
  const handlerFor = (persistSnapshot: boolean) =>
    async (event: StyleInjectionEvent): Promise<void> => {
      await injectStyle(event, { ...deps, persistSnapshot })
    }

  // The agent loop + its compaction and generate variants share the context
  // shape; title generation is a separate hook and is intentionally omitted.
  await ctx.session.hook("context", handlerFor(true))
  await ctx.session.hook("compaction", handlerFor(false))
  await ctx.session.hook("generate", handlerFor(false))
}
