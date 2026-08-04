import { Context } from "effect";

import type { ClipboardServiceShape } from "../../types/services.js";

export class ClipboardService extends Context.Tag("neon-herdr/ClipboardService")<
  ClipboardService,
  ClipboardServiceShape
>() {}
