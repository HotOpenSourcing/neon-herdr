import { Effect } from "effect";

import type { SettingRow, SettingsSummary } from "../../types/config.js";
import { ConfigService } from "../ports/config-service.js";
import { StateService } from "../ports/state-service.js";

const source = (
  explicitKeys: ReadonlyArray<string>,
  key: string
): SettingRow["source"] =>
  explicitKeys.includes(key) ? "config.json" : "default";

export const loadSettings = Effect.fn("loadSettings")(function* () {
  const configService = yield* ConfigService;
  const state = yield* StateService;
  const config = yield* configService.load;
  const explicitKeys = yield* configService.explicitKeys;
  const saved = yield* state.loadDashboard.pipe(
    Effect.catchAll(() => Effect.succeed(undefined))
  );
  const savedOrgId = saved?.orgId;
  const organization = config.orgId ?? savedOrgId;
  const rows: ReadonlyArray<SettingRow> = [
    {
      label: "placement",
      value:
        config.dashboardPlacement === "split"
          ? `split ${config.dashboardSplitDirection}`
          : config.dashboardPlacement,
      source: source(explicitKeys, "dashboardPlacement"),
    },
    {
      label: "organization",
      value: organization ?? "not selected",
      source:
        config.orgId === undefined
          ? savedOrgId === undefined
            ? "default"
            : "state"
          : "config.json",
    },
    {
      label: "refresh",
      value: `${config.refreshIntervalSeconds}s`,
      source: source(explicitKeys, "refreshIntervalSeconds"),
    },
    {
      label: "pooled connections",
      value: config.pooledConnections ? "on" : "off",
      source: source(explicitKeys, "pooledConnections"),
    },
    {
      label: "page size",
      value: `${config.pageSize}`,
      source: source(explicitKeys, "pageSize"),
    },
    {
      label: "oauth client",
      value: config.oauthClientId,
      source: source(explicitKeys, "oauthClientId"),
    },
  ];
  return {
    rows,
    configPath: configService.configPath,
  } satisfies SettingsSummary;
});
