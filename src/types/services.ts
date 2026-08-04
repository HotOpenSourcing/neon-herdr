import type { Effect } from "effect";

import type {
  AuthUnavailableError,
  ClipboardError,
  ConfigError,
  HerdrCommandError,
  NeonCliError,
  NeonRequestError,
  OAuthError,
  StateError,
} from "../schemas/errors.js";
import type { AuthResolution, AuthorizationUrlHandler } from "./auth.js";
import type { PluginConfig, PluginPaths } from "./config.js";
import type {
  BranchSummary,
  ComputeAction,
  ComputeSettings,
  OrganizationSummary,
  ProjectDetails,
  ProjectSummary,
} from "./neon.js";
import type { DashboardState, ProjectCache } from "./state.js";

export interface ConfigServiceShape {
  readonly paths: PluginPaths;
  readonly load: Effect.Effect<PluginConfig, ConfigError>;
}

export interface AuthServiceShape {
  readonly resolve: Effect.Effect<
    AuthResolution,
    AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly login: (
    onAuthorizationUrl: AuthorizationUrlHandler
  ) => Effect.Effect<AuthResolution, ConfigError | OAuthError>;
  readonly logout: Effect.Effect<void, OAuthError>;
}

export interface StateServiceShape {
  readonly loadDashboard: Effect.Effect<DashboardState, StateError>;
  readonly saveDashboard: (
    state: DashboardState
  ) => Effect.Effect<void, StateError>;
  readonly loadProjectCache: Effect.Effect<
    ProjectCache | undefined,
    StateError
  >;
  readonly saveProjectCache: (
    cache: ProjectCache
  ) => Effect.Effect<void, StateError>;
  readonly clearProjectCache: Effect.Effect<void, StateError>;
}

export interface NeonServiceShape {
  readonly clearCache: Effect.Effect<void>;
  readonly listOrganizations: Effect.Effect<
    ReadonlyArray<OrganizationSummary>,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly refreshOrganizations: Effect.Effect<
    ReadonlyArray<OrganizationSummary>,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly listProjects: Effect.Effect<
    ReadonlyArray<ProjectSummary>,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly refreshProjects: Effect.Effect<
    ReadonlyArray<ProjectSummary>,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly getProjectDetails: (
    projectId: string,
    branchId?: string
  ) => Effect.Effect<
    ProjectDetails,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly refreshProjectDetails: (
    projectId: string,
    branchId?: string
  ) => Effect.Effect<
    ProjectDetails,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly createBranch: (
    projectId: string,
    name: string
  ) => Effect.Effect<
    BranchSummary,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly renameBranch: (
    projectId: string,
    branchId: string,
    name: string
  ) => Effect.Effect<
    BranchSummary,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly deleteBranch: (
    projectId: string,
    branchId: string
  ) => Effect.Effect<
    void,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly resetBranch: (
    projectId: string,
    branchId: string,
    sourceBranchId: string,
    preserveUnderName: string
  ) => Effect.Effect<
    BranchSummary,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly runComputeAction: (
    projectId: string,
    endpointId: string,
    action: ComputeAction
  ) => Effect.Effect<
    void,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly updateCompute: (
    projectId: string,
    endpointId: string,
    settings: ComputeSettings
  ) => Effect.Effect<
    void,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
  readonly getConnectionString: (
    projectId: string,
    branchId: string,
    endpointId: string
  ) => Effect.Effect<
    string,
    NeonRequestError | AuthUnavailableError | ConfigError | OAuthError
  >;
}

export interface HerdrServiceShape {
  readonly focusPane: (
    paneId: string
  ) => Effect.Effect<void, HerdrCommandError>;
  readonly openDashboard: Effect.Effect<string | undefined, HerdrCommandError>;
}

export interface NeonCliServiceShape {
  readonly findExecutable: Effect.Effect<string | undefined>;
  readonly psql: (
    projectId: string,
    branchId: string
  ) => Effect.Effect<void, NeonCliError>;
}

export interface ClipboardServiceShape {
  readonly copy: (value: string) => Effect.Effect<void, ClipboardError>;
}
