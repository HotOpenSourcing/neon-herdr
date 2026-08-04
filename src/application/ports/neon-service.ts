import { Context } from "effect";

import type { NeonServiceShape } from "../../types/services.js";

export class NeonService extends Context.Tag("neon-herdr/NeonService")<
  NeonService,
  NeonServiceShape
>() {}
