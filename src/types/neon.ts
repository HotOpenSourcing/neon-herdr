export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly plan: string;
}

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly regionId: string;
  readonly pgVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly orgId?: string | undefined;
  readonly orgName?: string | undefined;
  readonly storageBytes?: number | undefined;
}

export interface BranchSummary {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly parentId?: string | undefined;
  readonly state: string;
  readonly isDefault: boolean;
  readonly protected: boolean;
  readonly logicalSizeBytes?: number | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ComputeSummary {
  readonly id: string;
  readonly branchId: string;
  readonly host: string;
  readonly type: string;
  readonly state: string;
  readonly minCu: number;
  readonly maxCu: number;
  readonly suspendTimeoutSeconds: number;
  readonly disabled: boolean;
}

export interface DatabaseSummary {
  readonly id: number;
  readonly branchId: string;
  readonly name: string;
  readonly ownerName: string;
}

export interface RoleSummary {
  readonly branchId: string;
  readonly name: string;
  readonly protected: boolean;
  readonly authenticationMethod?: string | undefined;
}

export interface OperationSummary {
  readonly id: string;
  readonly action: string;
  readonly status: string;
  readonly branchId?: string | undefined;
  readonly endpointId?: string | undefined;
  readonly error?: string | undefined;
  readonly updatedAt: string;
}

export interface SnapshotSummary {
  readonly id: string;
  readonly branchId: string;
  readonly name?: string | undefined;
  readonly createdAt: string;
}

export interface ProjectDetails {
  readonly project: ProjectSummary;
  readonly branches: ReadonlyArray<BranchSummary>;
  readonly computes: ReadonlyArray<ComputeSummary>;
  readonly databases: ReadonlyArray<DatabaseSummary>;
  readonly roles: ReadonlyArray<RoleSummary>;
  readonly operations: ReadonlyArray<OperationSummary>;
  readonly selectedBranchId?: string | undefined;
}

export interface ProjectDetailsCacheKey {
  readonly projectId: string;
  readonly branchId: string;
}

export interface ProjectListResult {
  readonly projects: ReadonlyArray<ProjectSummary>;
  readonly allProjects: ReadonlyArray<ProjectSummary>;
  readonly organizations: ReadonlyArray<OrganizationSummary>;
  readonly stale: boolean;
  readonly authenticated?: boolean | undefined;
  readonly warning?: string | undefined;
}

export type ComputeAction = "start" | "suspend" | "restart";

export interface ComputeSettings {
  readonly minCu: number;
  readonly maxCu: number;
  readonly suspendTimeoutSeconds: number;
}
