import { Effect } from "effect";

import { NeonService } from "../ports/neon-service.js";

export const loadOrganizations = Effect.fn("loadOrganizations")(function* () {
  const neon = yield* NeonService;
  return yield* neon.refreshOrganizations;
});
