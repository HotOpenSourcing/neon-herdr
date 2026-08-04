import { homedir } from "node:os";
import { join } from "node:path";

import type { PluginPaths } from "../types/config.js";
import { resolvePluginId } from "./plugin-identity.js";

export const resolvePluginPaths = (): PluginPaths => {
  const pluginId = resolvePluginId();
  const defaultConfigRoot =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  const defaultStateRoot =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return {
    configDir:
      process.env.HERDR_PLUGIN_CONFIG_DIR ??
      join(defaultConfigRoot, "herdr", "plugins", "config", pluginId),
    stateDir:
      process.env.HERDR_PLUGIN_STATE_DIR ??
      join(defaultStateRoot, "herdr", "plugins", pluginId),
  };
};
