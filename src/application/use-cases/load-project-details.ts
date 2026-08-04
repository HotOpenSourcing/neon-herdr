import { Clock, Effect } from "effect";

import { displayErrorMessage } from "../../utils/display-error-message.js";
import { NeonService } from "../ports/neon-service.js";
import { StateService } from "../ports/state-service.js";

const loadProjectDetailsWith = Effect.fn("loadProjectDetailsWith")(function* (
  projectId: string,
  branchId?: string,
  refresh = false
) {
  const neon = yield* NeonService;
  const state = yield* StateService;
  const details = yield* refresh
    ? neon.refreshProjectDetails(projectId, branchId)
    : neon.getProjectDetails(projectId, branchId);
  const now = yield* Clock.currentTimeMillis;
  yield* state
    .saveDashboard({
      selectedProjectId: projectId,
      ...(details.selectedBranchId === undefined
        ? {}
        : { selectedBranchId: details.selectedBranchId }),
      updatedAt: new Date(now).toISOString(),
      ...(process.env.HERDR_PANE_ID === undefined
        ? {}
        : { paneId: process.env.HERDR_PANE_ID }),
    })
    .pipe(
      Effect.catchAll((error) =>
        Effect.logDebug(
          `Could not save the dashboard selection: ${displayErrorMessage(error)}`
        )
      )
    );
  return details;
});

export const loadProjectDetails = Effect.fn("loadProjectDetails")(function* (
  projectId: string,
  branchId?: string
) {
  return yield* loadProjectDetailsWith(projectId, branchId);
});

export const refreshProjectDetails = Effect.fn("refreshProjectDetails")(
  function* (projectId: string, branchId?: string) {
    return yield* loadProjectDetailsWith(projectId, branchId, true);
  }
);
