import { Clock, Effect } from "effect";

import { NeonService } from "../ports/neon-service.js";
import { StateService } from "../ports/state-service.js";
import { refreshProjects } from "./load-projects.js";

export const selectOrganization = Effect.fn("selectOrganization")(function* (
  orgId: string,
  search?: string
) {
  const state = yield* StateService;
  const neon = yield* NeonService;
  const saved = yield* state.loadDashboard;
  const now = yield* Clock.currentTimeMillis;
  yield* state.saveDashboard({
    ...saved,
    orgId,
    updatedAt: new Date(now).toISOString(),
  });
  yield* neon.clearCache;
  return yield* refreshProjects(search);
});
