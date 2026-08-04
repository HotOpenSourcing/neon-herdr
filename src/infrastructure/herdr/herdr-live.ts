import { Effect, Layer, Schema } from "effect";

import { HerdrService } from "../../application/ports/herdr-service.js";
import { DASHBOARD_ENTRYPOINT_ID, PLUGIN_ID } from "../../constants/plugin.js";
import { HerdrCommandError } from "../../schemas/errors.js";
import { HerdrPaneOpenResponseSchema } from "../../schemas/herdr.js";
import { errorMessage } from "../../utils/error-message.js";
import { runCapturedCommand } from "../../utils/run-command.js";

export const HerdrLive = Layer.succeed(
  HerdrService,
  HerdrService.of({
    focusPane: (paneId) =>
      Effect.suspend(() => {
        const herdr = process.env.HERDR_BIN_PATH ?? "herdr";
        return runCapturedCommand(herdr, ["plugin", "pane", "focus", paneId]);
      }).pipe(
        Effect.mapError((cause) =>
          HerdrCommandError.make({
            message: `Could not run Herdr: ${errorMessage(cause)}`,
            cause,
          })
        ),
        Effect.flatMap((result) =>
          result.exitCode === 0
            ? Effect.void
            : Effect.fail(
                HerdrCommandError.make({
                  message:
                    result.stderr.trim() ||
                    "The saved dashboard pane no longer exists.",
                  cause: result.stderr,
                })
              )
        )
      ),
    openDashboard: Effect.suspend(() => {
      const herdr = process.env.HERDR_BIN_PATH ?? "herdr";
      const args = [
        "plugin",
        "pane",
        "open",
        "--plugin",
        PLUGIN_ID,
        "--entrypoint",
        DASHBOARD_ENTRYPOINT_ID,
        "--placement",
        "tab",
        "--focus",
      ];
      const workspaceId = process.env.HERDR_WORKSPACE_ID;
      if (workspaceId !== undefined && workspaceId.length > 0) {
        args.push("--workspace", workspaceId);
      }
      return runCapturedCommand(herdr, args);
    }).pipe(
      Effect.mapError((cause) =>
        HerdrCommandError.make({
          message: `Could not run Herdr: ${errorMessage(cause)}`,
          cause,
        })
      ),
      Effect.flatMap((result) =>
        result.exitCode === 0
          ? Effect.succeed(result.stdout)
          : Effect.fail(
              HerdrCommandError.make({
                message:
                  result.stderr.trim() || "Herdr could not open the dashboard.",
                cause: result.stderr,
              })
            )
      ),
      Effect.flatMap((stdout) =>
        Schema.decodeUnknown(Schema.parseJson(HerdrPaneOpenResponseSchema))(
          stdout
        ).pipe(
          Effect.map((decoded) => decoded.result.pane?.pane_id),
          Effect.catchAll(() => Effect.succeed(undefined))
        )
      )
    ),
  })
);
