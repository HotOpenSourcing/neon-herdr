import { homedir } from "node:os";
import { join } from "node:path";

import type { PluginPaths } from "../types/config.js";

export const resolvePluginPaths = (): PluginPaths => {
  const defaultConfigRoot =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  const defaultStateRoot =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
  return {
    configDir:
      process.env.HERDR_PLUGIN_CONFIG_DIR ??
      join(defaultConfigRoot, "herdr", "plugins", "neon.herdr"),
    stateDir:
      process.env.HERDR_PLUGIN_STATE_DIR ??
      join(defaultStateRoot, "herdr", "plugins", "neon.herdr"),
  };
};
