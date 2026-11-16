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

/** Returns the `style` value from an already-parsed config object, or null when the shape is invalid. */
function extractStyle(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null
  const style = (value as Record<string, unknown>).style
  if (style === null || style === undefined) return null
  if (typeof style !== "string") return null
  return style
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

    // Malformed shape (not an object) → disabled.
    return { style: null }
  } catch {
    // Missing file, read error, or invalid JSON → disabled.
    return { style: null }
  }
}

export async function writeConfig(config: OutputStylesConfig): Promise<void> {
  await writeFile(configPath(), JSON.stringify(config))
}
