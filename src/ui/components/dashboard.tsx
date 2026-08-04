import { Duration, Effect, Fiber, Schedule } from "effect";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { UI_COLORS } from "../../constants/theme.js";
import {
  DASHBOARD_ACTIVITY_LABELS,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  MAX_VISIBLE_BRANCHES,
  MAX_VISIBLE_PROJECTS,
  MIN_TERMINAL_COLUMNS,
} from "../../constants/ui.js";
import type { ApplicationError } from "../../types/errors.js";
import type { ComputeSettings } from "../../types/neon.js";
import type {
  DashboardActivity,
  DashboardEffect,
  DashboardProps,
  DashboardPrompt,
} from "../../types/ui.js";
import { displayErrorMessage } from "../../utils/display-error-message.js";
import { formatBytes, formatDate } from "../../utils/format.js";
import { isAuthenticationFailure } from "../../utils/is-authentication-failure.js";
import {
  dashboardReducer,
  initialDashboardState,
} from "../state/dashboard-reducer.js";

const parseComputeSettings = (value: string): ComputeSettings | undefined => {
  const parts = value.split(",").map((part) => Number(part.trim()));
  const minCu = parts[0];
  const maxCu = parts[1];
  const suspendTimeoutSeconds = parts[2];
  if (
    minCu === undefined ||
    maxCu === undefined ||
    suspendTimeoutSeconds === undefined ||
    !Number.isFinite(minCu) ||
    !Number.isFinite(maxCu) ||
    !Number.isInteger(suspendTimeoutSeconds) ||
    minCu < 0.25 ||
    maxCu < minCu ||
    suspendTimeoutSeconds < 0
  ) {
    return undefined;
  }
  return { minCu, maxCu, suspendTimeoutSeconds };
};

export const Dashboard = ({ controller, effectRunner }: DashboardProps) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const requestRef = useRef<Fiber.Fiber<void, ApplicationError> | undefined>(
    undefined
  );
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(
    DEFAULT_REFRESH_INTERVAL_SECONDS
  );

  const runRequest = useCallback(
    <A,>(
      activity: DashboardActivity,
      effect: DashboardEffect<A>,
      onSuccess: (value: A) => void
    ) => {
      if (requestRef.current !== undefined) {
        effectRunner.runFork(Fiber.interrupt(requestRef.current));
      }
      dispatch({ type: "LOADING", activity });
      requestRef.current = effectRunner.runFork(
        effect.pipe(
          Effect.matchEffect({
            onFailure: (failure) =>
              Effect.sync(() => {
                dispatch({
                  type: "ERROR",
                  message: displayErrorMessage(failure),
                  ...(isAuthenticationFailure(failure)
                    ? { authenticated: false }
                    : {}),
                });
              }),
            onSuccess: (value) => Effect.sync(() => onSuccess(value)),
          })
        )
      );
    },
    [effectRunner]
  );

  const filterProjects = useCallback(
    (query: string) => {
      const currentState = stateRef.current;
      const preferredProjectId =
        currentState.projects[currentState.projectCursor]?.id;
      effectRunner.runFork(
        controller.searchProjects(currentState.allProjects, query).pipe(
          Effect.tap((projects) =>
            Effect.sync(() => {
              dispatch({
                type: "PROJECTS_FILTERED",
                projects,
                query,
                preferredProjectId,
              });
            })
          ),
          Effect.asVoid
        )
      );
    },
    [controller, effectRunner]
  );

  const refreshProjects = useCallback(
    (
      preferredProjectId?: string,
      search = stateRef.current.query,
      activity: DashboardActivity = "refresh-projects"
    ) => {
      runRequest(activity, controller.refreshProjects(search), (result) => {
        const latestPreferredProjectId =
          preferredProjectId === undefined
            ? undefined
            : (stateRef.current.projects[stateRef.current.projectCursor]?.id ??
              preferredProjectId);
        dispatch({
          type: "PROJECTS_LOADED",
          result,
          preferredProjectId: latestPreferredProjectId,
        });
      });
    },
    [controller, runRequest]
  );

  const refreshDetails = useCallback(
    (
      projectId: string,
      branchId?: string,
      activity: DashboardActivity = "refresh-project"
    ) => {
      runRequest(
        activity,
        controller.refreshDetails(projectId, branchId),
        (details) => {
          dispatch({ type: "DETAILS_LOADED", details });
        }
      );
    },
    [controller, runRequest]
  );

  const loadDetails = useCallback(
    (projectId: string, branchId?: string) => {
      runRequest(
        "load-project",
        controller.loadDetails(projectId, branchId),
        (details) => {
          dispatch({ type: "DETAILS_LOADED", details });
        }
      );
    },
    [controller, runRequest]
  );

  const selectedProject = state.projects[state.projectCursor];
  const selectedBranch = state.details?.branches.find(
    (branch) => branch.id === state.details?.selectedBranchId
  );
  const selectedBranchComputes =
    state.details?.computes.filter(
      (compute) => compute.branchId === selectedBranch?.id
    ) ?? [];
  const selectedCompute =
    selectedBranchComputes.find((compute) => compute.type === "read_write") ??
    selectedBranchComputes[0];
  const selectedDatabases =
    state.details?.databases.filter(
      (database) => database.branchId === selectedBranch?.id
    ) ?? [];
  const selectedRoles =
    state.details?.roles.filter(
      (role) => role.branchId === selectedBranch?.id
    ) ?? [];
  const selectedBranchDataLoaded =
    selectedBranch === undefined ||
    state.loadedBranchIds.includes(selectedBranch.id);

  useEffect(() => {
    runRequest(
      "load-projects",
      Effect.all(
        {
          saved: controller.loadState(),
          refreshIntervalSeconds: controller.loadRefreshInterval(),
          result: controller.loadProjects(),
        },
        { concurrency: "unbounded" }
      ),
      ({ saved, refreshIntervalSeconds, result }) => {
        setRefreshIntervalSeconds(refreshIntervalSeconds);
        dispatch({
          type: "PROJECTS_LOADED",
          result,
          preferredProjectId: saved.selectedProjectId,
        });
      }
    );
    return () => {
      if (requestRef.current !== undefined) {
        effectRunner.runFork(Fiber.interrupt(requestRef.current));
      }
    };
  }, [controller, effectRunner, runRequest]);

  useEffect(() => {
    const poll = Effect.sync(() => {
      const currentState = stateRef.current;
      if (
        currentState.status === "loading" ||
        currentState.prompt !== undefined
      ) {
        return;
      }
      if (currentState.screen === "projects") {
        const currentProject =
          currentState.projects[currentState.projectCursor];
        refreshProjects(currentProject?.id, currentState.query);
      } else if (
        currentState.screen === "details" &&
        currentState.details !== undefined
      ) {
        refreshDetails(
          currentState.details.project.id,
          currentState.details.selectedBranchId
        );
      }
    });
    const interval = Duration.seconds(refreshIntervalSeconds);
    const pollingFiber = effectRunner.runFork(
      Effect.sleep(interval).pipe(
        Effect.andThen(poll.pipe(Effect.repeat(Schedule.spaced(interval)))),
        Effect.asVoid
      )
    );
    return () => {
      effectRunner.runFork(Fiber.interrupt(pollingFiber));
    };
  }, [effectRunner, refreshDetails, refreshIntervalSeconds, refreshProjects]);

  const completePrompt = useCallback(
    (prompt: DashboardPrompt) => {
      dispatch({ type: "CLOSE_PROMPT" });
      if (prompt.kind === "search") {
        filterProjects(prompt.value);
        return;
      }
      if (state.details === undefined || selectedBranch === undefined) {
        return;
      }
      const activity: DashboardActivity =
        prompt.kind === "create-branch"
          ? "create-branch"
          : prompt.kind === "rename-branch"
            ? "rename-branch"
            : prompt.kind === "delete-branch"
              ? "delete-branch"
              : prompt.kind === "reset-branch"
                ? "reset-branch"
                : "update-compute";
      let mutation: DashboardEffect<void>;
      if (prompt.kind === "create-branch") {
        mutation = controller
          .createBranch(state.details.project.id, prompt.value.trim())
          .pipe(Effect.asVoid);
      } else if (prompt.kind === "rename-branch") {
        mutation = controller
          .renameBranch(
            state.details.project.id,
            selectedBranch.id,
            prompt.value.trim()
          )
          .pipe(Effect.asVoid);
      } else if (prompt.kind === "delete-branch") {
        mutation = controller.deleteBranch(
          state.details.project.id,
          selectedBranch.id,
          selectedBranch.name,
          prompt.value
        );
      } else if (prompt.kind === "reset-branch") {
        if (selectedBranch.parentId === undefined) {
          dispatch({
            type: "ERROR",
            message: "A root branch cannot be reset from a parent branch.",
          });
          return;
        }
        mutation = controller
          .resetBranch(
            state.details.project.id,
            selectedBranch.id,
            selectedBranch.parentId,
            selectedBranch.name,
            prompt.value
          )
          .pipe(Effect.asVoid);
      } else {
        const settings = parseComputeSettings(prompt.value);
        if (settings === undefined || selectedCompute === undefined) {
          dispatch({
            type: "ERROR",
            message: "Use min CU,max CU,suspend seconds (example: 0.25,2,300).",
          });
          return;
        }
        mutation = controller.updateCompute(
          state.details.project.id,
          selectedCompute.id,
          settings
        );
      }
      runRequest(
        activity,
        mutation.pipe(
          Effect.flatMap(() =>
            controller.loadDetails(
              state.details?.project.id ?? "",
              selectedBranch.id
            )
          )
        ),
        (details) => dispatch({ type: "DETAILS_LOADED", details })
      );
    },
    [
      controller,
      filterProjects,
      runRequest,
      selectedBranch,
      selectedCompute,
      state.details,
    ]
  );

  useInput((input, key) => {
    if (state.prompt !== undefined) {
      if (key.escape) {
        dispatch({ type: "CLOSE_PROMPT" });
      } else if (key.return) {
        completePrompt(state.prompt);
      } else if (key.backspace || key.delete) {
        const value = state.prompt.value.slice(0, -1);
        dispatch({
          type: "UPDATE_PROMPT",
          value,
        });
        if (state.prompt.kind === "search") {
          filterProjects(value);
        }
      } else if (key.ctrl && input === "u") {
        dispatch({ type: "UPDATE_PROMPT", value: "" });
        if (state.prompt.kind === "search") {
          filterProjects("");
        }
      } else if (!key.ctrl && !key.meta && input.length > 0) {
        const value = `${state.prompt.value}${input}`;
        dispatch({
          type: "UPDATE_PROMPT",
          value,
        });
        if (state.prompt.kind === "search") {
          filterProjects(value);
        }
      }
      return;
    }
    if (input === "q" || (key.ctrl && input === "c")) {
      exit();
      return;
    }
    if (input === "?") {
      dispatch({ type: "SHOW_HELP" });
      return;
    }
    if (input === "a") {
      if (state.screen === "help") {
        dispatch({ type: "CLOSE_HELP" });
      }
      if (state.authenticated) {
        runRequest("disconnect", controller.disconnect(), () => {
          dispatch({ type: "SIGNED_OUT" });
        });
      } else {
        const preferredProjectId =
          state.details?.project.id ?? selectedProject?.id;
        runRequest(
          "authenticate",
          controller.authenticate(
            (url) => dispatch({ type: "AUTHORIZATION_URL", url }),
            state.query
          ),
          (result) => {
            dispatch({
              type: "PROJECTS_LOADED",
              result,
              preferredProjectId,
            });
            dispatch({
              type: "TOAST",
              message: "Neon authentication complete.",
            });
          }
        );
      }
      return;
    }
    if (state.screen === "help") {
      dispatch({ type: "CLOSE_HELP" });
      return;
    }
    if (state.screen === "projects") {
      if (input === "j" || key.downArrow) {
        dispatch({ type: "MOVE_PROJECT", delta: 1 });
      } else if (input === "k" || key.upArrow) {
        dispatch({ type: "MOVE_PROJECT", delta: -1 });
      } else if (input === "/") {
        dispatch({
          type: "OPEN_PROMPT",
          prompt: {
            kind: "search",
            label: "Search projects",
            value: state.query,
          },
        });
      } else if (input === "r") {
        refreshProjects(selectedProject?.id);
      } else if (key.return && selectedProject !== undefined) {
        loadDetails(selectedProject.id);
      }
      return;
    }
    if (state.details === undefined) {
      return;
    }
    if (input === "b" || key.escape) {
      dispatch({ type: "SHOW_PROJECTS" });
    } else if (input === "j" || key.downArrow) {
      dispatch({ type: "MOVE_BRANCH", delta: 1 });
    } else if (input === "k" || key.upArrow) {
      dispatch({ type: "MOVE_BRANCH", delta: -1 });
    } else if (input === "r") {
      refreshDetails(state.details.project.id, selectedBranch?.id);
    } else if (input === "c") {
      dispatch({
        type: "OPEN_PROMPT",
        prompt: { kind: "create-branch", label: "New branch name", value: "" },
      });
    } else if (input === "n" && selectedBranch !== undefined) {
      dispatch({
        type: "OPEN_PROMPT",
        prompt: {
          kind: "rename-branch",
          label: "Rename branch",
          value: selectedBranch.name,
        },
      });
    } else if (
      input === "d" &&
      selectedBranch !== undefined &&
      !selectedBranch.isDefault &&
      !selectedBranch.protected
    ) {
      dispatch({
        type: "OPEN_PROMPT",
        prompt: {
          kind: "delete-branch",
          label: `Type ${selectedBranch.name} to delete`,
          value: "",
          expected: selectedBranch.name,
        },
      });
    } else if (input === "x" && selectedBranch?.parentId !== undefined) {
      dispatch({
        type: "OPEN_PROMPT",
        prompt: {
          kind: "reset-branch",
          label: `Type ${selectedBranch.name} to reset it from its parent`,
          value: "",
          expected: selectedBranch.name,
        },
      });
    } else if (input === "s" && selectedCompute !== undefined) {
      const action = selectedCompute.state === "active" ? "suspend" : "start";
      runRequest(
        action === "suspend" ? "suspend-compute" : "start-compute",
        controller
          .runComputeAction(
            state.details.project.id,
            selectedCompute.id,
            action
          )
          .pipe(
            Effect.flatMap(() =>
              controller.loadDetails(
                state.details?.project.id ?? "",
                selectedBranch?.id
              )
            )
          ),
        (details) => dispatch({ type: "DETAILS_LOADED", details })
      );
    } else if (input === "R" && selectedCompute !== undefined) {
      runRequest(
        "restart-compute",
        controller
          .runComputeAction(
            state.details.project.id,
            selectedCompute.id,
            "restart"
          )
          .pipe(
            Effect.flatMap(() =>
              controller.loadDetails(
                state.details?.project.id ?? "",
                selectedBranch?.id
              )
            )
          ),
        (details) => dispatch({ type: "DETAILS_LOADED", details })
      );
    } else if (input === "e" && selectedCompute !== undefined) {
      dispatch({
        type: "OPEN_PROMPT",
        prompt: {
          kind: "compute-settings",
          label: "min CU,max CU,suspend seconds",
          value: `${selectedCompute.minCu},${selectedCompute.maxCu},${selectedCompute.suspendTimeoutSeconds}`,
        },
      });
    } else if (input === "y" && selectedBranch !== undefined) {
      if (selectedCompute === undefined) {
        dispatch({
          type: "ERROR",
          message:
            "This branch has no compute endpoint, so it has no connection string.",
        });
      } else {
        runRequest(
          "copy-connection",
          controller.copyConnection(
            state.details.project.id,
            selectedBranch.id,
            selectedCompute.id
          ),
          (masked) => dispatch({ type: "TOAST", message: `Copied ${masked}` })
        );
      }
    }
  });

  const columns = stdout.columns ?? 80;
  const narrow = columns < MIN_TERMINAL_COLUMNS;

  if (state.screen === "help") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={UI_COLORS.brand}>
          Neon Herdr keys
        </Text>
        <Text>j/k or arrows move · Enter opens · r refreshes · / searches</Text>
        <Text>
          b back · c create · n rename · d delete · x reset (typed confirmation)
        </Text>
        <Text>
          s start/suspend · R restart · e compute settings · y copy connection
        </Text>
        <Text>
          a {state.authenticated ? "sign out" : "sign in"} · q quit · ? help ·
          any key closes help
        </Text>
      </Box>
    );
  }

  if (narrow) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">
          Neon Herdr needs at least {MIN_TERMINAL_COLUMNS} columns.
        </Text>
        <Text>
          Resize the pane. a {state.authenticated ? "signs out" : "signs in"}, q
          quits, ? shows keyboard help.
        </Text>
        {state.error === undefined ? null : (
          <Text color="red">{state.error}</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color={UI_COLORS.brand}>
          Neon
        </Text>
        <Text dimColor>
          {state.activity === undefined
            ? "? help · q quit"
            : DASHBOARD_ACTIVITY_LABELS[state.activity]}
        </Text>
      </Box>
      {state.warning === undefined ? null : (
        <Text color="yellow">{state.warning}</Text>
      )}
      {state.error === undefined ? null : (
        <Text color="red">{state.error}</Text>
      )}
      {state.toast === undefined ? null : (
        <Text color="cyan">{state.toast}</Text>
      )}
      {state.prompt === undefined ? null : (
        <Box borderStyle="round" borderColor={UI_COLORS.brand} paddingX={1}>
          <Text>{state.prompt.label}: </Text>
          <Text bold>{state.prompt.value}</Text>
          <Text inverse> </Text>
        </Box>
      )}
      {state.screen === "projects" ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={UI_COLORS.section}>
            Projects {state.query.length > 0 ? `(search: ${state.query})` : ""}
          </Text>
          {state.projects.length === 0 && state.status !== "loading" ? (
            <Text dimColor>No projects found.</Text>
          ) : null}
          {state.projects
            .slice(0, MAX_VISIBLE_PROJECTS)
            .map((project, index) => (
              <Text
                key={project.id}
                bold={index === state.projectCursor}
                color={
                  index === state.projectCursor ? UI_COLORS.selection : "white"
                }
              >
                {index === state.projectCursor ? "› " : "  "}
                {project.name.padEnd(28)} {project.regionId.padEnd(18)} PG{" "}
                {project.pgVersion} · {formatBytes(project.storageBytes)}
              </Text>
            ))}
          <Text dimColor>
            {state.organizations.length} organizations · Enter details · /
            search · r refresh · a{" "}
            {state.authenticated ? "sign out" : "sign in"}
          </Text>
        </Box>
      ) : state.details === undefined ? null : (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={UI_COLORS.section}>
            {state.details.project.name}
          </Text>
          <Text dimColor>
            {state.details.project.id} · {state.details.project.regionId} ·
            created {formatDate(state.details.project.createdAt)}
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text bold color={UI_COLORS.section}>
              Branches
            </Text>
            {state.details.branches
              .slice(0, MAX_VISIBLE_BRANCHES)
              .map((branch) => (
                <Text
                  key={branch.id}
                  bold={branch.id === selectedBranch?.id}
                  color={
                    branch.id === selectedBranch?.id
                      ? UI_COLORS.selection
                      : "white"
                  }
                >
                  {branch.id === selectedBranch?.id ? "› " : "  "}
                  {branch.name.padEnd(28)} {branch.state.padEnd(10)}{" "}
                  {branch.isDefault
                    ? "default"
                    : branch.protected
                      ? "protected"
                      : ""}
                </Text>
              ))}
          </Box>
          {selectedCompute === undefined ? null : (
            <Text>
              <Text bold color={UI_COLORS.section}>
                Compute
              </Text>{" "}
              {selectedCompute.id}: {selectedCompute.state} ·{" "}
              {selectedCompute.minCu}–{selectedCompute.maxCu} CU · suspend{" "}
              {selectedCompute.suspendTimeoutSeconds}s
            </Text>
          )}
          {selectedBranchDataLoaded ? (
            <>
              <Text>
                <Text bold color={UI_COLORS.section}>
                  Databases:
                </Text>{" "}
                {selectedDatabases
                  .map((database) => `${database.name} (${database.ownerName})`)
                  .join(", ") || "—"}
              </Text>
              <Text>
                <Text bold color={UI_COLORS.section}>
                  Roles:
                </Text>{" "}
                {selectedRoles.map((role) => role.name).join(", ") || "—"}
              </Text>
            </>
          ) : (
            <Text dimColor>
              Branch databases and roles are not cached · r loads them
            </Text>
          )}
          <Box flexDirection="column" marginTop={1}>
            <Text bold color={UI_COLORS.section}>
              Recent operations
            </Text>
            {state.details.operations.slice(0, 4).map((operation) => (
              <Text
                key={operation.id}
                color={
                  operation.status === "failed" || operation.status === "error"
                    ? "red"
                    : "white"
                }
              >
                {operation.action.padEnd(22)} {operation.status.padEnd(10)}{" "}
                {formatDate(operation.updatedAt)}
              </Text>
            ))}
          </Box>
          <Text dimColor>
            b back · j/k branch · c/n/d/x branch · s/R/e compute ·{" "}
            {selectedCompute === undefined
              ? "no compute connection"
              : "y connection"}{" "}
            · a {state.authenticated ? "sign out" : "sign in"}
          </Text>
        </Box>
      )}
    </Box>
  );
};
