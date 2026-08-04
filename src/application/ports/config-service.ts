import { Context } from "effect";

import type { ConfigServiceShape } from "../../types/services.js";

export class ConfigService extends Context.Tag("neon-herdr/ConfigService")<
  ConfigService,
  ConfigServiceShape
>() {}
