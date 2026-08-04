import type { DashboardAction, DashboardViewState } from "../../types/ui.js";
import { filterOrganizations } from "../../utils/filter-organizations.js";

export const initialDashboardState: DashboardViewState = {
  screen: "signin",
  status: "loading",
  activity: "load-projects",
  projects: [],
  allProjects: [],
  organizations: [],
  projectCursor: 0,
  organizationCursor: 0,
  organizationChoices: [],
  organizationMatches: [],
  organizationQuery: "",
  loadedBranchIds: [],
  query: "",
  stale: false,
  authenticated: false,
};

export const dashboardReducer = (
  state: DashboardViewState,
  action: DashboardAction
): DashboardViewState => {
  switch (action.type) {
    case "LOADING":
      return {
        ...state,
        status: "loading",
        activity: action.activity,
        error: undefined,
        toast: undefined,
      };
    case "PROJECTS_LOADED": {
      const preferredCursor =
        action.preferredProjectId === undefined
          ? -1
          : action.result.projects.findIndex(
              (project) => project.id === action.preferredProjectId
            );
      return {
        ...state,
        screen: "projects",
        status: "ready",
        activity: undefined,
        projects: action.result.projects,
        allProjects: action.result.allProjects,
        organizations: action.result.organizations,
        projectCursor:
          preferredCursor >= 0
            ? preferredCursor
            : Math.min(
                state.projectCursor,
                Math.max(0, action.result.projects.length - 1)
              ),
        stale: action.result.stale,
        authenticated: action.result.authenticated ?? state.authenticated,
        authorizationUrl: undefined,
        warning: action.result.warning,
        error: undefined,
      };
    }
    case "PROJECTS_FILTERED": {
      const preferredCursor =
        action.preferredProjectId === undefined
          ? -1
          : action.projects.findIndex(
              (project) => project.id === action.preferredProjectId
            );
      return {
        ...state,
        projects: action.projects,
        projectCursor: preferredCursor >= 0 ? preferredCursor : 0,
        query: action.query,
      };
    }
    case "DETAILS_LOADED": {
      const previousDetails =
        state.details?.project.id === action.details.project.id
          ? state.details
          : undefined;
      const loadedBranchId = action.details.selectedBranchId;
      const selectedBranchId =
        previousDetails?.selectedBranchId !== undefined &&
        action.details.branches.some(
          (branch) => branch.id === previousDetails.selectedBranchId
        )
          ? previousDetails.selectedBranchId
          : loadedBranchId;
      const cachedDatabases =
        previousDetails === undefined || loadedBranchId === undefined
          ? []
          : previousDetails.databases.filter(
              (database) => database.branchId !== loadedBranchId
            );
      const cachedRoles =
        previousDetails === undefined || loadedBranchId === undefined
          ? []
          : previousDetails.roles.filter(
              (role) => role.branchId !== loadedBranchId
            );
      const loadedBranchIds =
        loadedBranchId === undefined
          ? []
          : previousDetails === undefined
            ? [loadedBranchId]
            : state.loadedBranchIds.includes(loadedBranchId)
              ? state.loadedBranchIds
              : [...state.loadedBranchIds, loadedBranchId];
      return {
        ...state,
        screen: "details",
        status: "ready",
        activity: undefined,
        details: {
          ...action.details,
          databases: [...cachedDatabases, ...action.details.databases],
          roles: [...cachedRoles, ...action.details.roles],
          selectedBranchId,
        },
        loadedBranchIds,
        authenticated: true,
        authorizationUrl: undefined,
        error: undefined,
      };
    }
    case "ERROR": {
      if (action.authenticated === false) {
        return {
          ...state,
          screen: "signin",
          status: "error",
          activity: undefined,
          authenticated: false,
          authorizationUrl: undefined,
          warning: undefined,
          error: action.message,
        };
      }
      return {
        ...state,
        screen: state.screen === "signin" ? "projects" : state.screen,
        status: "error",
        activity: undefined,
        error: action.message,
        authenticated: action.authenticated ?? state.authenticated,
      };
    }
    case "CHOOSE_ORGANIZATION":
      return {
        ...state,
        screen: "organizations",
        status: "ready",
        activity: undefined,
        organizationChoices: action.organizations,
        organizationMatches: action.organizations,
        organizationQuery: "",
        organizationCursor: 0,
        warning: action.message,
        error: undefined,
        toast: undefined,
      };
    case "FILTER_ORGANIZATIONS": {
      const matches = filterOrganizations(
        state.organizationChoices,
        action.query
      );
      return {
        ...state,
        organizationQuery: action.query,
        organizationMatches: matches,
        organizationCursor: 0,
      };
    }
    case "MOVE_ORGANIZATION":
      return {
        ...state,
        organizationCursor: Math.max(
          0,
          Math.min(
            state.organizationMatches.length - 1,
            state.organizationCursor + action.delta
          )
        ),
      };
    case "MOVE_PROJECT":
      return {
        ...state,
        projectCursor: Math.max(
          0,
          Math.min(
            state.projects.length - 1,
            state.projectCursor + action.delta
          )
        ),
      };
    case "MOVE_BRANCH": {
      if (state.details === undefined || state.details.branches.length === 0) {
        return state;
      }
      const currentIndex = Math.max(
        0,
        state.details.branches.findIndex(
          (branch) => branch.id === state.details?.selectedBranchId
        )
      );
      const nextIndex = Math.max(
        0,
        Math.min(state.details.branches.length - 1, currentIndex + action.delta)
      );
      const nextBranch = state.details.branches[nextIndex];
      return nextBranch === undefined
        ? state
        : {
            ...state,
            details: {
              ...state.details,
              selectedBranchId: nextBranch.id,
            },
          };
    }
    case "SHOW_PROJECTS":
      return {
        ...state,
        screen: "projects",
        error: undefined,
        toast: undefined,
      };
    case "SHOW_HELP":
      return { ...state, screen: "help" };
    case "SETTINGS_LOADED":
      return { ...state, settings: action.settings };
    case "CLOSE_HELP":
      return {
        ...state,
        screen: state.authenticated
          ? state.details === undefined
            ? "projects"
            : "details"
          : state.organizationChoices.length > 0
            ? "organizations"
            : "signin",
      };
    case "OPEN_PROMPT":
      return { ...state, prompt: action.prompt, toast: undefined };
    case "UPDATE_PROMPT":
      return state.prompt === undefined
        ? state
        : { ...state, prompt: { ...state.prompt, value: action.value } };
    case "CLOSE_PROMPT":
      return { ...state, prompt: undefined };
    case "AUTHORIZATION_URL":
      return {
        ...state,
        screen: "signin",
        authorizationUrl: action.url,
        warning: undefined,
        error: undefined,
      };
    case "SIGNED_OUT":
      return {
        ...initialDashboardState,
        screen: "signin",
        status: "ready",
        activity: undefined,
        toast: "Signed out of Neon.",
      };
    case "TOAST":
      return {
        ...state,
        status: "ready",
        activity: undefined,
        toast: action.message,
        error: undefined,
      };
  }
};
