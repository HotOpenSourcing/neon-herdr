import type {
  DashboardStateSchema,
  ProjectCacheSchema,
} from "../schemas/state.js";

export type DashboardState = typeof DashboardStateSchema.Type;
export type ProjectCache = typeof ProjectCacheSchema.Type;
