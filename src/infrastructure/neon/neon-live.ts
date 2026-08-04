import {
  createNeonClient,
  type Branch,
  type Database,
  type Endpoint,
  NeonApiError,
  type NeonError,
  type NeonResult,
  type Operation,
  type Organization,
  type Project,
  type ProjectListItem,
  type Role,
} from "@neon/sdk";
import {
  restoreProjectBranch as restoreProjectBranchRaw,
  wrapRaw,
} from "@neon/sdk/raw";
import { Cache, Data, Duration, Effect, Layer, Schedule } from "effect";

import { AuthService } from "../../application/ports/auth-service.js";
import { ConfigService } from "../../application/ports/config-service.js";
import { NeonService } from "../../application/ports/neon-service.js";
import { StateService } from "../../application/ports/state-service.js";
import {
  NeonRequestError,
  OrganizationSelectionRequired,
} from "../../schemas/errors.js";
import type {
  BranchSummary,
  ComputeSummary,
  DatabaseSummary,
  OperationSummary,
  OrganizationSummary,
  ProjectDetailsCacheKey,
  ProjectSummary,
  RoleSummary,
} from "../../types/neon.js";
import { errorMessage } from "../../utils/error-message.js";

const readRetrySchedule = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.identity<unknown>()),
  Schedule.addDelay(([, error]) =>
    error instanceof NeonRequestError && error.retryAfterMs !== undefined
      ? Duration.millis(error.retryAfterMs)
      : Duration.zero
  ),
  Schedule.intersect(Schedule.recurs(2))
);

const restoreProjectBranch = wrapRaw(restoreProjectBranchRaw);

const projectDetailsCacheKey = (
  projectId: string,
  branchId?: string
): ProjectDetailsCacheKey =>
  Data.struct({ projectId, branchId: branchId ?? "" });

const retryAfterMilliseconds = (error: NeonError): number | undefined => {
  const value =
    error instanceof NeonApiError
      ? error.response?.headers.get("retry-after")
      : undefined;
  if (value === null || value === undefined) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? undefined
    : Math.max(0, timestamp - Date.now());
};

const mapNeonError = (error: NeonError): NeonRequestError => {
  if (error.kind === "auth") {
    const status = error instanceof NeonApiError ? error.status : undefined;
    return NeonRequestError.make({
      category: status === 403 ? "permission" : "auth",
      message: error.message,
      action:
        status === 403
          ? "Reconnect Neon and grant access to this resource."
          : "Press a in the dashboard to sign in again.",
      retryable: false,
    });
  }
  if (error.kind === "rate_limit") {
    const retryAfterMs = retryAfterMilliseconds(error);
    return retryAfterMs === undefined
      ? NeonRequestError.make({
          category: "rate_limit",
          message: error.message,
          action: "Wait briefly, then refresh.",
          retryable: true,
        })
      : NeonRequestError.make({
          category: "rate_limit",
          message: error.message,
          action: "Wait briefly, then refresh.",
          retryable: true,
          retryAfterMs,
        });
  }
  if (error.kind === "network") {
    return NeonRequestError.make({
      category: "network",
      message: error.message,
      action: "Check the network connection and press r to retry.",
      retryable: true,
    });
  }
  if (error.kind === "not_found") {
    return NeonRequestError.make({
      category: "not_found",
      message: error.message,
      action: "Refresh; the resource may have been removed elsewhere.",
      retryable: false,
    });
  }
  if (error.kind === "operation") {
    return NeonRequestError.make({
      category: "operation",
      message: error.message,
      action: "Inspect recent operations before trying another mutation.",
      retryable: false,
    });
  }
  if (error.kind === "timeout") {
    return NeonRequestError.make({
      category: "timeout",
      message: error.message,
      action: "Refresh to inspect whether the operation completed.",
      retryable: true,
    });
  }
  if (
    error instanceof NeonApiError &&
    error.kind === "api" &&
    error.status === 423
  ) {
    return NeonRequestError.make({
      category: "locked",
      message: error.message,
      action: "Wait for the current Neon operation to finish.",
      retryable: true,
    });
  }
  return NeonRequestError.make({
    category: "unknown",
    message: error.message,
    action: "Press r to retry or inspect Neon status and permissions.",
    retryable: false,
  });
};

const ORGANIZATION_REQUIRED_PATTERN = /org_id is required/i;

const requiresOrganization = (error: unknown): error is NeonRequestError =>
  error instanceof NeonRequestError &&
  ORGANIZATION_REQUIRED_PATTERN.test(error.message);

const unexpectedNeonError = (cause: unknown): NeonRequestError =>
  NeonRequestError.make({
    category: "unknown",
    message: errorMessage(cause),
    action: "Press r to retry. If this persists, enable NEON_HERDR_DEBUG=1.",
    retryable: false,
  });

const fromNeonResult = <A>(
  operation: (signal: AbortSignal) => Promise<NeonResult<A>>
) =>
  Effect.tryPromise({
    try: (signal) => operation(signal),
    catch: unexpectedNeonError,
  }).pipe(
    Effect.flatMap((result) =>
      result.error === undefined
        ? Effect.succeed(result.data)
        : Effect.fail(mapNeonError(result.error))
    )
  );

const retryRead = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(
    Effect.retry({
      schedule: readRetrySchedule,
      while: (error) => error instanceof NeonRequestError && error.retryable,
    })
  );

const mapProject = (project: Project | ProjectListItem): ProjectSummary => {
  const base = {
    id: project.id,
    name: project.name,
    regionId: project.region_id,
    pgVersion: project.pg_version,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
  return {
    ...base,
    ...(project.org_id === undefined ? {} : { orgId: project.org_id }),
    ...(!("org_name" in project) || project.org_name === undefined
      ? {}
      : { orgName: project.org_name }),
    ...(project.synthetic_storage_size === undefined
      ? {}
      : { storageBytes: project.synthetic_storage_size }),
  };
};

const mapOrganization = (organization: Organization): OrganizationSummary => ({
  id: organization.id,
  name: organization.name,
  handle: organization.handle,
  plan: organization.plan,
});

const mapBranch = (branch: Branch): BranchSummary => ({
  id: branch.id,
  projectId: branch.project_id,
  name: branch.name,
  ...(branch.parent_id === undefined ? {} : { parentId: branch.parent_id }),
  state: branch.current_state,
  isDefault: branch.default,
  protected: branch.protected,
  ...(branch.logical_size === undefined
    ? {}
    : { logicalSizeBytes: branch.logical_size }),
  createdAt: branch.created_at,
  updatedAt: branch.updated_at,
});

const mapCompute = (endpoint: Endpoint): ComputeSummary => ({
  id: endpoint.id,
  branchId: endpoint.branch_id,
  host: endpoint.host,
  type: endpoint.type,
  state: endpoint.current_state,
  minCu: endpoint.autoscaling_limit_min_cu,
  maxCu: endpoint.autoscaling_limit_max_cu,
  suspendTimeoutSeconds: endpoint.suspend_timeout_seconds,
  disabled: endpoint.disabled,
});

const mapDatabase = (database: Database): DatabaseSummary => ({
  id: database.id,
  branchId: database.branch_id,
  name: database.name,
  ownerName: database.owner_name,
});

const mapRole = (role: Role): RoleSummary => ({
  branchId: role.branch_id,
  name: role.name,
  protected: role.protected ?? false,
  ...(role.authentication_method === undefined
    ? {}
    : { authenticationMethod: role.authentication_method }),
});

const mapOperation = (operation: Operation): OperationSummary => ({
  id: operation.id,
  action: operation.action,
  status: operation.status,
  ...(operation.branch_id === undefined
    ? {}
    : { branchId: operation.branch_id }),
  ...(operation.endpoint_id === undefined
    ? {}
    : { endpointId: operation.endpoint_id }),
  ...(operation.error === undefined ? {} : { error: operation.error }),
  updatedAt: operation.updated_at,
});

export const NeonLive = Layer.effect(
  NeonService,
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const configService = yield* ConfigService;
    const stateService = yield* StateService;

    const resolveOrgId = Effect.fn("Neon.resolveOrgId")(function* (
      configuredOrgId?: string
    ) {
      if (configuredOrgId !== undefined) {
        return configuredOrgId;
      }
      const saved = yield* stateService.loadDashboard.pipe(
        Effect.catchAll(() => Effect.succeed(undefined))
      );
      return saved?.orgId;
    });

    const makeClient = Effect.fn("Neon.makeClient")(function* (
      orgIdOverride?: string
    ) {
      const credentials = yield* auth.resolve;
      const config = yield* configService.load;
      const orgId = orgIdOverride ?? (yield* resolveOrgId(config.orgId));
      const client = createNeonClient({
        apiKey: credentials.accessToken,
        retries: 0,
        waitForReadiness: false,
        ...(orgId === undefined ? {} : { orgId }),
      });
      return { client, config };
    });

    const loadOrganizations = Effect.fn("Neon.loadOrganizations")(function* () {
      const { client } = yield* makeClient();
      const organizations = yield* retryRead(
        fromNeonResult((signal) => client.user.organizations({ signal }))
      );
      return organizations.map(mapOrganization);
    });

    const listProjectsWith = Effect.fn("Neon.listProjectsWith")(function* (
      orgId?: string
    ) {
      const { client, config } = yield* makeClient(orgId);
      const projects = yield* retryRead(
        fromNeonResult(() =>
          client.projects.list({ limit: config.pageSize }).all()
        )
      );
      return projects.map(mapProject);
    });

    const recoverWithOrganization = Effect.fn("Neon.recoverWithOrganization")(
      function* (failure: NeonRequestError) {
        const organizations = yield* loadOrganizations().pipe(
          Effect.catchAll(() => Effect.succeed([]))
        );
        const only = organizations.length === 1 ? organizations[0] : undefined;
        if (only !== undefined) {
          return yield* listProjectsWith(only.id);
        }
        if (organizations.length === 0) {
          return yield* Effect.fail(failure);
        }
        return yield* Effect.fail(
          OrganizationSelectionRequired.make({
            message: `This Neon account has ${organizations.length} organizations.`,
            action: "Choose the one to show projects for.",
            organizations,
          })
        );
      }
    );

    const loadProjects = Effect.fn("Neon.loadProjects")(function* () {
      const config = yield* configService.load;
      const orgId = yield* resolveOrgId(config.orgId);
      if (orgId !== undefined) {
        return yield* listProjectsWith(orgId);
      }
      return yield* listProjectsWith().pipe(
        Effect.catchIf(requiresOrganization, recoverWithOrganization)
      );
    });

    const loadProjectDetails = Effect.fn("Neon.loadProjectDetails")(function* (
      key: ProjectDetailsCacheKey
    ) {
      const projectId = key.projectId;
      const branchId = key.branchId.length === 0 ? undefined : key.branchId;
      const { client } = yield* makeClient();
      const overview = yield* Effect.all(
        {
          project: retryRead(
            fromNeonResult((signal) =>
              client.projects.get(projectId, { signal })
            )
          ),
          branches: retryRead(
            fromNeonResult(() => client.branches.list(projectId).all())
          ),
          computes: retryRead(
            fromNeonResult((signal) =>
              client.postgres.endpoints.list(projectId, { signal })
            )
          ),
          operations: retryRead(
            fromNeonResult(() => client.operations.list(projectId).all())
          ),
        },
        { concurrency: "unbounded" }
      );
      const selectedBranch =
        overview.branches.find((branch) => branch.id === branchId) ??
        overview.branches.find((branch) => branch.default) ??
        overview.branches[0];
      const branchData =
        selectedBranch === undefined
          ? { databases: [], roles: [] }
          : yield* Effect.all(
              {
                databases: retryRead(
                  fromNeonResult((signal) =>
                    client.postgres.databases.list(
                      projectId,
                      selectedBranch.id,
                      { signal }
                    )
                  )
                ),
                roles: retryRead(
                  fromNeonResult((signal) =>
                    client.postgres.roles.list(projectId, selectedBranch.id, {
                      signal,
                    })
                  )
                ),
              },
              { concurrency: "unbounded" }
            );
      const base = {
        project: mapProject(overview.project),
        branches: overview.branches.map(mapBranch),
        computes: overview.computes.map(mapCompute),
        databases: branchData.databases.map(mapDatabase),
        roles: branchData.roles.map(mapRole),
        operations: overview.operations.slice(0, 10).map(mapOperation),
      };
      return selectedBranch === undefined
        ? base
        : { ...base, selectedBranchId: selectedBranch.id };
    });

    const cacheConfig = yield* configService.load;
    const cacheTtl = Duration.seconds(cacheConfig.refreshIntervalSeconds);
    const organizationCache = yield* Cache.make({
      capacity: 1,
      timeToLive: cacheTtl,
      lookup: loadOrganizations,
    });
    const projectCache = yield* Cache.make({
      capacity: 1,
      timeToLive: cacheTtl,
      lookup: () => loadProjects(),
    });
    const projectDetailsCache = yield* Cache.make({
      capacity: 100,
      timeToLive: cacheTtl,
      lookup: loadProjectDetails,
    });

    const listOrganizations = organizationCache.get(undefined);
    const refreshOrganizations = organizationCache
      .refresh(undefined)
      .pipe(Effect.andThen(organizationCache.get(undefined)));
    const listProjects = projectCache.get(undefined);
    const refreshProjects = projectCache
      .refresh(undefined)
      .pipe(Effect.andThen(projectCache.get(undefined)));
    const getProjectDetails = (projectId: string, branchId?: string) =>
      projectDetailsCache.get(projectDetailsCacheKey(projectId, branchId));
    const refreshProjectDetails = (projectId: string, branchId?: string) => {
      const key = projectDetailsCacheKey(projectId, branchId);
      return projectDetailsCache
        .refresh(key)
        .pipe(Effect.andThen(projectDetailsCache.get(key)));
    };
    const invalidateProjectData = Effect.all(
      [projectCache.invalidateAll, projectDetailsCache.invalidateAll],
      { discard: true }
    );

    const createBranch = Effect.fn("Neon.createBranch")(function* (
      projectId: string,
      name: string
    ) {
      const { client } = yield* makeClient();
      const branch = yield* fromNeonResult((signal) =>
        client.branches.create(
          projectId,
          { name },
          { signal, waitForReadiness: true }
        )
      );
      yield* invalidateProjectData;
      return mapBranch(branch);
    });

    const renameBranch = Effect.fn("Neon.renameBranch")(function* (
      projectId: string,
      branchId: string,
      name: string
    ) {
      const { client } = yield* makeClient();
      const branch = yield* fromNeonResult((signal) =>
        client.branches.update(projectId, branchId, { name }, { signal })
      );
      yield* invalidateProjectData;
      return mapBranch(branch);
    });

    const deleteBranch = Effect.fn("Neon.deleteBranch")(function* (
      projectId: string,
      branchId: string
    ) {
      const { client } = yield* makeClient();
      yield* fromNeonResult((signal) =>
        client.branches.delete(projectId, branchId, { signal })
      );
      yield* invalidateProjectData;
    });

    const resetBranch = Effect.fn("Neon.resetBranch")(function* (
      projectId: string,
      branchId: string,
      sourceBranchId: string,
      preserveUnderName: string
    ) {
      const { client } = yield* makeClient();
      const result = yield* fromNeonResult((signal) =>
        restoreProjectBranch({
          client: client.client,
          path: { project_id: projectId, branch_id: branchId },
          body: {
            source_branch_id: sourceBranchId,
            preserve_under_name: preserveUnderName,
          },
          signal,
        })
      );
      if (result === undefined) {
        return yield* NeonRequestError.make({
          category: "unknown",
          message: "Neon accepted the reset but returned no branch payload.",
          action: "Refresh to inspect the branch and recent operations.",
          retryable: false,
        });
      }
      yield* invalidateProjectData;
      return mapBranch(result.branch);
    });

    const runComputeAction = Effect.fn("Neon.runComputeAction")(function* (
      projectId: string,
      endpointId: string,
      action: "start" | "suspend" | "restart"
    ) {
      const { client } = yield* makeClient();
      yield* fromNeonResult((signal) => {
        switch (action) {
          case "start":
            return client.postgres.endpoints.start(projectId, endpointId, {
              signal,
            });
          case "suspend":
            return client.postgres.endpoints.suspend(projectId, endpointId, {
              signal,
            });
          case "restart":
            return client.postgres.endpoints.restart(projectId, endpointId, {
              signal,
            });
        }
      });
      yield* projectDetailsCache.invalidateAll;
    });

    const updateCompute = Effect.fn("Neon.updateCompute")(function* (
      projectId: string,
      endpointId: string,
      settings: {
        readonly minCu: number;
        readonly maxCu: number;
        readonly suspendTimeoutSeconds: number;
      }
    ) {
      const { client } = yield* makeClient();
      yield* fromNeonResult((signal) =>
        client.postgres.endpoints.update(
          projectId,
          endpointId,
          {
            autoscaling_limit_min_cu: settings.minCu,
            autoscaling_limit_max_cu: settings.maxCu,
            suspend_timeout_seconds: settings.suspendTimeoutSeconds,
          },
          { signal }
        )
      );
      yield* projectDetailsCache.invalidateAll;
    });

    const getConnectionString = Effect.fn("Neon.getConnectionString")(
      function* (projectId: string, branchId: string, endpointId: string) {
        const { client, config } = yield* makeClient();
        return yield* retryRead(
          fromNeonResult((signal) =>
            client.postgres.connectionString(
              {
                projectId,
                branchId,
                endpointId,
                pooled: config.pooledConnections,
              },
              { signal }
            )
          )
        );
      }
    );

    const clearCache = Effect.all(
      [
        organizationCache.invalidateAll,
        projectCache.invalidateAll,
        projectDetailsCache.invalidateAll,
      ],
      { discard: true }
    );

    return NeonService.of({
      clearCache,
      listOrganizations,
      refreshOrganizations,
      listProjects,
      refreshProjects,
      getProjectDetails,
      refreshProjectDetails,
      createBranch,
      renameBranch,
      deleteBranch,
      resetBranch,
      runComputeAction,
      updateCompute,
      getConnectionString,
    });
  })
);
