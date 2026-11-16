import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type {
  StyleAgentConfig,
  StyleDefinition,
  StyleMeta,
} from "./types"

/**
 * Default color applied when a style does not define one.
 */
const DEFAULT_COLOR = "#22c55e"

/**
 * Type guard that validates the raw shape of a parsed style object.
 *
 * A valid style must have a string `displayName` and an object `agents`
 * where every entry carries a string `prompt`.
 */
function isValidStyle(raw: unknown): raw is StyleDefinition {
  if (typeof raw !== "object" || raw === null) return false

  const obj = raw as Record<string, unknown>
  if (typeof obj.displayName !== "string") return false
  if (typeof obj.agents !== "object" || obj.agents === null) return false

  for (const agent of Object.values(obj.agents as Record<string, unknown>)) {
    if (typeof agent !== "object" || agent === null) return false
    if (typeof (agent as Record<string, unknown>).prompt !== "string") return false
  }

  return true
}

/**
 * Loads every style definition from the `*.json` files in `dir`.
 *
 * - Skips non-JSON files, invalid JSON, and malformed shapes (logging a warning).
 * - Resolves the `color` default and the per-agent `enabled` default.
 * - Template styles (`_` prefixed ids) keep their `enabled` field untouched,
 *   since they are auto-disabled by convention.
 * - Returns `[]` if the directory does not exist.
 */
export async function loadStyles(dir: string): Promise<StyleMeta[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    // Directory does not exist (or is unreadable) → treat as empty.
    return []
  }

  const styles: StyleMeta[] = []

  for (const filename of files) {
    if (!filename.endsWith(".json")) continue

    const id = filename.slice(0, -".json".length)
    const isTemplate = id.startsWith("_")

    let raw: unknown
    try {
      const text = await readFile(join(dir, filename), "utf-8")
      raw = JSON.parse(text)
    } catch (err) {
      console.warn(`[output-styles] Skipping invalid JSON file "${filename}":`, err)
      continue
    }

    if (!isValidStyle(raw)) {
      console.warn(
        `[output-styles] Skipping "${filename}": missing or invalid "displayName" or "agents".`,
      )
      continue
    }

    const definition = raw as StyleDefinition
    const agents: Record<string, StyleAgentConfig> = {}

    for (const [agentName, agent] of Object.entries(definition.agents)) {
      if (isTemplate) {
        // Auto-disabled by convention; leave `enabled` exactly as authored.
        agents[agentName] = { ...agent }
      } else {
        agents[agentName] = { ...agent, enabled: agent.enabled ?? true }
      }
    }

    styles.push({
      id,
      displayName: definition.displayName,
      color: definition.color ?? DEFAULT_COLOR,
      agents,
    })
  }

  styles.sort((a, b) => a.id.localeCompare(b.id))
  return styles
}

/**
 * Resolves the prompt for a specific agent within a style.
 *
 * Returns `null` when the agent is not listed, when it is disabled, or when
 * the style is a template (auto-disabled by convention).
 *
 * The returned prompt has trailing whitespace trimmed for clean injection.
 */
export function resolveStylePrompt(
  styleMeta: StyleMeta,
  agent: string,
): string | null {
  const config = styleMeta.agents[agent]
  if (!config) return null

  // Template styles are auto-disabled regardless of their `enabled` field.
  if (styleMeta.id.startsWith("_")) return null
  if (config.enabled === false) return null

  return config.prompt.trimEnd()
}

/**
 * Returns the resolved color of a style (already defaulted at load time).
 */
export function resolveStyleColor(styleMeta: StyleMeta): string {
  return styleMeta.color
}
