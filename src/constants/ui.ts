import type { DashboardActivity } from "../types/ui.js";

export const MIN_TERMINAL_COLUMNS = 64;
export const DEFAULT_PROJECT_PAGE_SIZE = 50;
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 30;
export const MAX_VISIBLE_PROJECTS = 15;
export const MAX_VISIBLE_BRANCHES = 10;
export const MAX_DISPLAY_ERROR_LENGTH = 240;

export const DASHBOARD_ACTIVITY_LABELS: Readonly<
  Record<DashboardActivity, string>
> = {
  authenticate: "waiting for Neon sign-in…",
  disconnect: "signing out of Neon…",
  "load-projects": "loading projects…",
  "refresh-projects": "refreshing projects…",
  "load-project": "loading project…",
  "refresh-project": "refreshing project…",
  "create-branch": "creating branch…",
  "rename-branch": "renaming branch…",
  "delete-branch": "deleting branch…",
  "reset-branch": "resetting branch…",
  "start-compute": "starting compute…",
  "suspend-compute": "suspending compute…",
  "restart-compute": "restarting compute…",
  "update-compute": "updating compute…",
  "copy-connection": "copying connection…",
};
