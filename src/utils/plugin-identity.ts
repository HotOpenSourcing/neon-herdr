import { DEFAULT_HERDR_BIN, DEFAULT_PLUGIN_ID } from "../constants/plugin.js";

const trimmed = (value: string | undefined): string | undefined => {
  const candidate = value?.trim();
  return candidate === undefined || candidate.length === 0
    ? undefined
    : candidate;
};

export const resolvePluginId = (): string =>
  trimmed(process.env.HERDR_PLUGIN_ID) ?? DEFAULT_PLUGIN_ID;

export const resolveHerdrBin = (): string =>
  trimmed(process.env.HERDR_BIN_PATH) ?? DEFAULT_HERDR_BIN;

export const pluginActionId = (actionId: string): string =>
  `${resolvePluginId()}.${actionId}`;

export const herdrActionCommand = (actionId: string): string =>
  `${resolveHerdrBin()} plugin action invoke ${pluginActionId(actionId)}`;
