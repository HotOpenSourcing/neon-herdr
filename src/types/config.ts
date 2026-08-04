import type {
  DashboardPlacementSchema,
  PluginConfigSchema,
} from "../schemas/config.js";

export type PluginConfig = typeof PluginConfigSchema.Type;
export type DashboardPlacement = typeof DashboardPlacementSchema.Type;

export interface PluginPaths {
  readonly configDir: string;
  readonly stateDir: string;
}

export interface SettingRow {
  readonly label: string;
  readonly value: string;
  readonly source: "config.json" | "state" | "default";
}

export interface SettingsSummary {
  readonly rows: ReadonlyArray<SettingRow>;
  readonly configPath: string;
}
