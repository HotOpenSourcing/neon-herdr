import { Context } from "effect";

import type { HerdrServiceShape } from "../../types/services.js";

export class HerdrService extends Context.Tag("neon-herdr/HerdrService")<
  HerdrService,
  HerdrServiceShape
>() {}
