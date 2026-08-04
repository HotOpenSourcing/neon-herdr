import { Context } from "effect";

import type { StateServiceShape } from "../../types/services.js";

export class StateService extends Context.Tag("neon-herdr/StateService")<
  StateService,
  StateServiceShape
>() {}
