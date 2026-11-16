export interface StyleAgentConfig {
  prompt: string
  enabled?: boolean  // defaults to true
}

export interface StyleDefinition {
  displayName: string
  color?: string  // defaults to "#22c55e"
  agents: Record<string, StyleAgentConfig>
}

export interface StyleMeta {
  id: string           // filename without extension
  displayName: string
  color: string        // always resolved (defaulted if missing from JSON)
  agents: Record<string, StyleAgentConfig>
}

export interface OutputStylesConfig {
  style: string | null  // style id, or null = disabled
}
