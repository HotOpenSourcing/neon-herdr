import type { Effect, Fiber } from "effect";

import type { AuthService } from "../application/ports/auth-service.js";
import type { ClipboardService } from "../application/ports/clipboard-service.js";
import type { ConfigService } from "../application/ports/config-service.js";
import type { NeonService } from "../application/ports/neon-service.js";
import type { StateService } from "../application/ports/state-service.js";
import type { AuthorizationUrlHandler } from "./auth.js";
import type { SettingsSummary } from "./config.js";
import type { ApplicationError } from "./errors.js";
import type {
  ComputeAction,
  ComputeSettings,
  OrganizationSummary,
  ProjectDetails,
  ProjectListResult,
  ProjectSummary,
} from "./neon.js";
import type { DashboardState as PersistedDashboardState } from "./state.js";

export type DashboardScreen =
  | "signin"
  | "organizations"
  | "projects"
  | "details"
  | "help";
export type DashboardStatus = "loading" | "ready" | "error";
export type DashboardActivity =
  | "authenticate"
  | "select-organization"
  | "load-organizations"
  | "disconnect"
  | "load-projects"
  | "refresh-projects"
  | "load-project"
  | "refresh-project"
  | "create-branch"
  | "rename-branch"
  | "delete-branch"
  | "reset-branch"
  | "start-compute"
  | "suspend-compute"
  | "restart-compute"
  | "update-compute"
  | "copy-connection";
export type PromptKind =
  | "search"
  | "create-branch"
  | "rename-branch"
  | "delete-branch"
  | "reset-branch"
  | "compute-settings";

export type DashboardRequirements =
  | AuthService
  | ClipboardService
  | ConfigService
  | NeonService
  | StateService;

export type DashboardEffect<A> = Effect.Effect<
  A,
  ApplicationError,
  DashboardRequirements
>;

export interface OrganizationPickerProps {
  readonly organizations: ReadonlyArray<OrganizationSummary>;
  readonly total: number;
  readonly cursor: number;
  readonly query: string;
  readonly message?: string | undefined;
  readonly busy: boolean;
}

export interface SignInProps {
  readonly checking: boolean;
  readonly connecting: boolean;
  readonly reason?: string | undefined;
  readonly authorizationUrl?: string | undefined;
  readonly toast?: string | undefined;
  readonly signInCommand: string;
}

export interface DashboardPrompt {
  readonly kind: PromptKind;
  readonly label: string;
  readonly value: string;
  readonly expected?: string;
}

export interface DashboardViewState {
  readonly screen: DashboardScreen;
  readonly status: DashboardStatus;
  readonly activity?: DashboardActivity | undefined;
  readonly projects: ReadonlyArray<ProjectSummary>;
  readonly allProjects: ReadonlyArray<ProjectSummary>;
  readonly organizations: ReadonlyArray<OrganizationSummary>;
  readonly projectCursor: number;
  readonly organizationCursor: number;
  readonly organizationChoices: ReadonlyArray<OrganizationSummary>;
  readonly organizationMatches: ReadonlyArray<OrganizationSummary>;
  readonly organizationQuery: string;
  readonly settings?: SettingsSummary | undefined;
  readonly details?: ProjectDetails | undefined;
  readonly loadedBranchIds: ReadonlyArray<string>;
  readonly query: string;
  readonly stale: boolean;
  readonly authenticated: boolean;
  readonly authorizationUrl?: string | undefined;
  readonly warning?: string | undefined;
  readonly error?: string | undefined;
  readonly toast?: string | undefined;
  readonly prompt?: DashboardPrompt | undefined;
}

export type DashboardAction =
  | { readonly type: "LOADING"; readonly activity: DashboardActivity }
  | {
      readonly type: "PROJECTS_LOADED";
      readonly result: ProjectListResult;
      readonly preferredProjectId?: string | undefined;
    }
  | {
      readonly type: "PROJECTS_FILTERED";
      readonly projects: ReadonlyArray<ProjectSummary>;
      readonly query: string;
      readonly preferredProjectId?: string | undefined;
    }
  | { readonly type: "DETAILS_LOADED"; readonly details: ProjectDetails }
  | {
      readonly type: "ERROR";
      readonly message: string;
      readonly authenticated?: boolean | undefined;
    }
  | {
      readonly type: "CHOOSE_ORGANIZATION";
      readonly organizations: ReadonlyArray<OrganizationSummary>;
      readonly message?: string | undefined;
    }
  | { readonly type: "MOVE_ORGANIZATION"; readonly delta: number }
  | { readonly type: "FILTER_ORGANIZATIONS"; readonly query: string }
  | { readonly type: "MOVE_PROJECT"; readonly delta: number }
  | { readonly type: "MOVE_BRANCH"; readonly delta: number }
  | { readonly type: "SHOW_PROJECTS" }
  | { readonly type: "SHOW_HELP" }
  | { readonly type: "SETTINGS_LOADED"; readonly settings: SettingsSummary }
  | { readonly type: "CLOSE_HELP" }
  | { readonly type: "OPEN_PROMPT"; readonly prompt: DashboardPrompt }
  | { readonly type: "UPDATE_PROMPT"; readonly value: string }
  | { readonly type: "CLOSE_PROMPT" }
  | { readonly type: "AUTHORIZATION_URL"; readonly url: string }
  | { readonly type: "SIGNED_OUT" }
  | { readonly type: "TOAST"; readonly message: string };

export interface DashboardController {
  readonly authenticate: (
    onAuthorizationUrl: AuthorizationUrlHandler,
    search?: string
  ) => DashboardEffect<ProjectListResult>;
  readonly disconnect: () => DashboardEffect<void>;
  readonly loadRefreshInterval: () => DashboardEffect<number>;
  readonly loadState: () => DashboardEffect<PersistedDashboardState>;
  readonly loadProjects: (
    search?: string
  ) => DashboardEffect<ProjectListResult>;
  readonly refreshProjects: (
    search?: string
  ) => DashboardEffect<ProjectListResult>;
  readonly loadSettings: () => DashboardEffect<SettingsSummary>;
  readonly loadOrganizations: () => DashboardEffect<
    ReadonlyArray<OrganizationSummary>
  >;
  readonly selectOrganization: (
    orgId: string,
    search?: string
  ) => DashboardEffect<ProjectListResult>;
  readonly searchProjects: (
    projects: ReadonlyArray<ProjectSummary>,
    query: string
  ) => DashboardEffect<ReadonlyArray<ProjectSummary>>;
  readonly loadDetails: (
    projectId: string,
    branchId?: string
  ) => DashboardEffect<ProjectDetails>;
  readonly refreshDetails: (
    projectId: string,
    branchId?: string
  ) => DashboardEffect<ProjectDetails>;
  readonly createBranch: (
    projectId: string,
    name: string
  ) => DashboardEffect<unknown>;
  readonly renameBranch: (
    projectId: string,
    branchId: string,
    name: string
  ) => DashboardEffect<unknown>;
  readonly deleteBranch: (
    projectId: string,
    branchId: string,
    branchName: string,
    confirmation: string
  ) => DashboardEffect<void>;
  readonly resetBranch: (
    projectId: string,
    branchId: string,
    sourceBranchId: string,
    branchName: string,
    confirmation: string
  ) => DashboardEffect<unknown>;
  readonly runComputeAction: (
    projectId: string,
    endpointId: string,
    action: ComputeAction
  ) => DashboardEffect<void>;
  readonly updateCompute: (
    projectId: string,
    endpointId: string,
    settings: ComputeSettings
  ) => DashboardEffect<void>;
  readonly copyConnection: (
    projectId: string,
    branchId: string,
    endpointId: string
  ) => DashboardEffect<string>;
}

export interface DashboardEffectRunner {
  readonly runFork: <A>(
    effect: DashboardEffect<A>
  ) => Fiber.Fiber<A, ApplicationError>;
}

export interface DashboardProps {
  readonly controller: DashboardController;
  readonly effectRunner: DashboardEffectRunner;
}
