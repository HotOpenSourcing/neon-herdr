import { Clock, Effect } from "effect";

import { displayErrorMessage } from "../../utils/display-error-message.js";
import { isAuthenticationFailure } from "../../utils/is-authentication-failure.js";
import { NeonService } from "../ports/neon-service.js";
import { StateService } from "../ports/state-service.js";
import { searchProjects } from "./search-projects.js";

const loadProjectsWith = Effect.fn("loadProjectsWith")(function* (
  search?: string,
  refresh = false,
) {
  const neon = yield* NeonService;
  const state = yield* StateService;
  const live = Effect.all(
    {
      projects: refresh ? neon.refreshProjects : neon.listProjects,
      organizations: (refresh
        ? neon.refreshOrganizations
        : neon.listOrganizations
      ).pipe(
        Effect.catchAll((error) =>
          Effect.logDebug(
            `Could not load Neon organizations: ${displayErrorMessage(error)}`,
          ).pipe(Effect.as([])),
        ),
      ),
    },
    { concurrency: "unbounded" },
  ).pipe(
    Effect.tap(({ projects }) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) =>
          state.saveProjectCache({
            projects,
            cachedAt: new Date(now).toISOString(),
          }),
        ),
        Effect.catchAll((error) =>
          Effect.logDebug(
            `Could not save the Neon project cache: ${displayErrorMessage(error)}`,
          ),
        ),
      ),
    ),
    Effect.flatMap(({ projects, organizations }) =>
      searchProjects(projects, search ?? "").pipe(
        Effect.map((matches) => ({
          projects: matches,
          allProjects: projects,
          organizations,
          stale: false,
          authenticated: true,
        })),
      ),
    ),
  );
  return yield* live.pipe(
    Effect.catchAll((failure) =>
      state.loadProjectCache.pipe(
        Effect.flatMap((cache) =>
          cache === undefined
            ? Effect.fail(failure)
            : searchProjects(cache.projects, search ?? "").pipe(
                Effect.map((matches) => ({
                  projects: matches,
                  allProjects: cache.projects,
                  organizations: [],
                  stale: true,
                  ...(isAuthenticationFailure(failure)
                    ? { authenticated: false }
                    : {}),
                  warning: displayErrorMessage(
                    `${displayErrorMessage(failure)} Showing cache from ${cache.cachedAt}.`,
                  ),
                })),
              ),
        ),
      ),
    ),
  );
});

export const loadProjects = Effect.fn("loadProjects")(function* (
  search?: string,
) {
  return yield* loadProjectsWith(search);
});

export const refreshProjects = Effect.fn("refreshProjects")(function* (
  search?: string,
) {
  return yield* loadProjectsWith(search, true);
});
