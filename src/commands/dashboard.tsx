import process from "node:process";

import { render } from "ink";
import { Clock, Effect } from "effect";

import { createDashboardController } from "./controller.js";
import { StateService } from "../application/ports/state-service.js";
import { appRuntime } from "../infrastructure/runtime.js";
import { DashboardHostError } from "../schemas/errors.js";
import { Dashboard } from "../ui/components/dashboard.js";
import type { DashboardEffectRunner } from "../types/ui.js";
import { displayErrorMessage } from "../utils/display-error-message.js";
import { runCommand } from "./run-command.js";

const paneId = process.env.HERDR_PANE_ID;
const rememberPane =
  paneId === undefined
    ? Effect.void
    : Effect.fn("rememberDashboardPane")(function* () {
        const state = yield* StateService;
        const saved = yield* state.loadDashboard;
        const now = yield* Clock.currentTimeMillis;
        yield* state.saveDashboard({
          ...saved,
          paneId,
          updatedAt: new Date(now).toISOString(),
        });
      })().pipe(
        Effect.catchAll((error) =>
          Effect.logDebug(
            `Could not remember the dashboard pane: ${displayErrorMessage(error)}`,
          ),
        ),
      );

const controller = createDashboardController();
const effectRunner: DashboardEffectRunner = {
  runFork: (effect) => appRuntime.runFork(effect),
};
const dashboardSession = Effect.acquireUseRelease(
  Effect.sync(() =>
    render(<Dashboard controller={controller} effectRunner={effectRunner} />, {
      exitOnCtrlC: true,
      patchConsole: false,
    }),
  ),
  (instance) =>
    Effect.tryPromise({
      try: () => instance.waitUntilExit(),
      catch: (cause) =>
        DashboardHostError.make({
          message: "The Neon dashboard exited unexpectedly.",
          cause,
        }),
    }),
  () =>
    Effect.sync(() => {
      process.stdout.write("\u001B[?25h");
    }),
);

await runCommand(rememberPane.pipe(Effect.andThen(dashboardSession)));
