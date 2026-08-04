import { Effect } from "effect";

import type { AuthorizationUrlHandler } from "../../types/auth.js";
import { AuthService } from "../ports/auth-service.js";
import { NeonService } from "../ports/neon-service.js";
import { StateService } from "../ports/state-service.js";
import { refreshProjects } from "./load-projects.js";

export const authenticateNeon = Effect.fn("authenticateNeon")(function* (
  onAuthorizationUrl: AuthorizationUrlHandler,
  search?: string
) {
  const auth = yield* AuthService;
  yield* auth.login(onAuthorizationUrl);
  const result = yield* refreshProjects(search);
  return { ...result, authenticated: true };
});

export const disconnectNeon = Effect.fn("disconnectNeon")(function* () {
  const auth = yield* AuthService;
  const neon = yield* NeonService;
  const state = yield* StateService;
  const dashboard = yield* state.loadDashboard;
  const clearedDashboard =
    dashboard.paneId === undefined ? {} : { paneId: dashboard.paneId };
  yield* Effect.all(
    [
      neon.clearCache,
      state.clearProjectCache,
      state.saveDashboard(clearedDashboard),
    ],
    { discard: true }
  );
  yield* auth.logout;
});
