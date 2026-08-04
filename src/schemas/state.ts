import { Schema } from "effect";

const ProjectSummaryStateSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  regionId: Schema.String,
  pgVersion: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  orgId: Schema.optional(Schema.String),
  orgName: Schema.optional(Schema.String),
  storageBytes: Schema.optional(Schema.Number),
});

export const DashboardStateSchema = Schema.Struct({
  paneId: Schema.optional(Schema.String),
  orgId: Schema.optional(Schema.String),
  selectedProjectId: Schema.optional(Schema.String),
  selectedBranchId: Schema.optional(Schema.String),
  updatedAt: Schema.optional(Schema.String),
});

export const ProjectCacheSchema = Schema.Struct({
  projects: Schema.Array(ProjectSummaryStateSchema),
  cachedAt: Schema.String,
});
