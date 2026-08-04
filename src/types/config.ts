import type { PluginConfigSchema } from "../schemas/config.js";

export type PluginConfig = typeof PluginConfigSchema.Type;

export interface PluginPaths {
  readonly configDir: string;
  readonly stateDir: string;
}
