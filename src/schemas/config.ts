import { Schema } from "effect";

import {
  NEON_OAUTH_HOST,
  NEONCTL_OAUTH_CLIENT_ID,
} from "../constants/oauth.js";
import {
  DEFAULT_PROJECT_PAGE_SIZE,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
} from "../constants/ui.js";

export const PluginConfigSchema = Schema.Struct({
  orgId: Schema.optional(Schema.String),
  oauthClientId: Schema.optionalWith(Schema.String.pipe(Schema.minLength(1)), {
    default: () => NEONCTL_OAUTH_CLIENT_ID,
  }),
  oauthHost: Schema.optionalWith(Schema.String.pipe(Schema.minLength(1)), {
    default: () => NEON_OAUTH_HOST,
  }),
  refreshIntervalSeconds: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(5),
      Schema.lessThanOrEqualTo(3_600)
    ),
    {
      default: () => DEFAULT_REFRESH_INTERVAL_SECONDS,
    }
  ),
  pooledConnections: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),
  pageSize: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(100)
    ),
    {
      default: () => DEFAULT_PROJECT_PAGE_SIZE,
    }
  ),
});

export const DefaultPluginConfig = Schema.decodeUnknownSync(PluginConfigSchema)(
  {}
);
