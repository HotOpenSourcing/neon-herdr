import { Context } from "effect";

import type { NeonCliServiceShape } from "../../types/services.js";

export class NeonCliService extends Context.Tag("neon-herdr/NeonCliService")<
  NeonCliService,
  NeonCliServiceShape
>() {}
