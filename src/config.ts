import { homedir } from "node:os"
import { readFile, writeFile } from "node:fs/promises"
import type { OutputStylesConfig } from "./types"

/**
 * Directory holding the output-style pack JSON files, resolved once here so
 * every entrypoint and the dialog share a single source of truth. The dialog
 * shows this path to users in its empty state, so it must be the same
 * directory the plugin actually loads from — never a separately hardcoded copy.
 */
export const STYLES_DIR = `${homedir()}/.config/opencode/output-styles`

function configPath(): string {
  return `${homedir()}/.config/opencode/output-styles.json`
}

/** State file of the predecessor persona-injector plugin. Read-only here. */
function legacyConfigPath(): string {
  return `${homedir()}/.config/opencode/persona-injector.json`
}

/** Returns the `style` value from an already-parsed config object, or null when the shape is invalid. */
function extractStyle(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null
  const style = (value as Record<string, unknown>).style
  if (style === null || style === undefined) return null
  if (typeof style !== "string") return null
  return style
}

/**
 * Reads the predecessor `persona-injector.json` and maps its active `persona`
 * id to a style id. Style ids keep the old file-name convention, so an id
 * carried over this way matches the migrated style pack one-to-one. Read-only;
 * any error or invalid shape falls back to disabled.
 */
async function migrateFromLegacy(): Promise<OutputStylesConfig> {
  try {
    const raw = await readFile(legacyConfigPath(), "utf-8")
    const parsed: unknown = JSON.parse(raw)
    const legacy = extractPersonaId(parsed)
    return legacy ? { style: legacy } : { style: null }
  } catch {
    // Missing file, read error, or invalid JSON → disabled.
    return { style: null }
  }
}

/** Narrowly reads the legacy `persona` field (a string) or returns null. */
function extractPersonaId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null
  const persona = (value as Record<string, unknown>).persona
  return typeof persona === "string" ? persona : null
}

export async function readConfig(): Promise<OutputStylesConfig> {
  try {
    const raw = await readFile(configPath(), "utf-8")
    const parsed: unknown = JSON.parse(raw)
    const style = extractStyle(parsed)

    // A valid config (style string or explicit null) wins outright.
    if (style !== null) return { style }
    // Parsed object without a style field → treat as disabled.
    if (typeof parsed === "object" && parsed !== null) return { style: null }

    // Otherwise fall back to legacy migration.
    return migrateFromLegacy()
  } catch {
    // Missing file or unparsable JSON → legacy migration, which safely
    // defaults to disabled on error.
    return migrateFromLegacy()
  }
}

export async function writeConfig(config: OutputStylesConfig): Promise<void> {
  await writeFile(configPath(), JSON.stringify(config))
}
