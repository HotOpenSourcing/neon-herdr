import { Effect } from "effect";

import { ConfigService } from "../application/ports/config-service.js";
import { StateService } from "../application/ports/state-service.js";
import {
  authenticateNeon,
  disconnectNeon,
} from "../application/use-cases/auth-session.js";
import {
  createBranch,
  deleteBranch,
  resetBranch,
  renameBranch,
} from "../application/use-cases/branch-actions.js";
import {
  runComputeAction,
  updateCompute,
} from "../application/use-cases/compute-actions.js";
import { copyConnectionString } from "../application/use-cases/copy-connection-string.js";
import { loadOrganizations } from "../application/use-cases/load-organizations.js";
import {
  loadProjectDetails,
  refreshProjectDetails,
} from "../application/use-cases/load-project-details.js";
import {
  loadProjects,
  refreshProjects,
} from "../application/use-cases/load-projects.js";
import { loadSettings } from "../application/use-cases/load-settings.js";
import { searchProjects } from "../application/use-cases/search-projects.js";
import { selectOrganization } from "../application/use-cases/select-organization.js";
import type { DashboardController } from "../types/ui.js";

const loadDashboardState = Effect.fn("loadDashboardState")(function* () {
  const state = yield* StateService;
  return yield* state.loadDashboard;
});

const loadRefreshInterval = Effect.fn("loadRefreshInterval")(function* () {
  const config = yield* ConfigService;
  const value = yield* config.load;
  return value.refreshIntervalSeconds;
});

export const createDashboardController = (): DashboardController => ({
  authenticate: authenticateNeon,
  disconnect: disconnectNeon,
  loadRefreshInterval: loadRefreshInterval,
  loadState: loadDashboardState,
  loadProjects,
  refreshProjects,
  loadOrganizations,
  loadSettings,
  selectOrganization,
  searchProjects,
  loadDetails: loadProjectDetails,
  refreshDetails: refreshProjectDetails,
  createBranch,
  renameBranch,
  deleteBranch,
  resetBranch: (
    projectId,
    branchId,
    sourceBranchId,
    branchName,
    confirmation
  ) =>
    resetBranch(projectId, branchId, sourceBranchId, branchName, confirmation),
  runComputeAction,
  updateCompute,
  copyConnection: copyConnectionString,
});
