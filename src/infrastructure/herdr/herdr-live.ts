import { Effect, Layer, Schema } from "effect";

import { ConfigService } from "../../application/ports/config-service.js";
import { HerdrService } from "../../application/ports/herdr-service.js";
import { DASHBOARD_ENTRYPOINT_ID } from "../../constants/plugin.js";
import { HerdrCommandError } from "../../schemas/errors.js";
import { HerdrPaneOpenResponseSchema } from "../../schemas/herdr.js";
import type { DashboardPlacement, PluginConfig } from "../../types/config.js";
import { errorMessage } from "../../utils/error-message.js";
import {
  resolveHerdrBin,
  resolvePluginId,
} from "../../utils/plugin-identity.js";
import { runCapturedCommand } from "../../utils/run-command.js";

const contextPaneId = (): string | undefined => {
  const raw = process.env.HERDR_PLUGIN_CONTEXT_JSON;
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  try {
    const context: unknown = JSON.parse(raw);
    const paneId =
      typeof context === "object" && context !== null
        ? (context as { focused_pane_id?: unknown }).focused_pane_id
        : undefined;
    return typeof paneId === "string" && paneId.length > 0 ? paneId : undefined;
  } catch {
    return undefined;
  }
};

const resolveTargetPaneId = (): string | undefined => {
  const candidates = [
    process.env.HERDR_PANE_ID,
    process.env.HERDR_ACTIVE_PANE_ID,
    contextPaneId(),
  ];
  return candidates.find(
    (candidate): candidate is string =>
      candidate !== undefined && candidate.length > 0
  );
};

const dashboardOpenArgs = (
  placement: PluginConfig["dashboardPlacement"],
  direction: PluginConfig["dashboardSplitDirection"]
): ReadonlyArray<string> => {
  const args = [
    "plugin",
    "pane",
    "open",
    "--plugin",
    resolvePluginId(),
    "--entrypoint",
    DASHBOARD_ENTRYPOINT_ID,
    "--focus",
  ];
  const targetPaneId = resolveTargetPaneId();
  const needsTargetPane =
    placement === "split" || placement === "zoomed" || placement === "overlay";
  const effectivePlacement =
    needsTargetPane && targetPaneId === undefined ? "tab" : placement;
  args.push("--placement", effectivePlacement);
  if (effectivePlacement === "split") {
    args.push("--direction", direction);
  }
  if (effectivePlacement === "tab") {
    const workspaceId = process.env.HERDR_WORKSPACE_ID;
    if (workspaceId !== undefined && workspaceId.length > 0) {
      args.push("--workspace", workspaceId);
    }
    return args;
  }
  if (targetPaneId !== undefined) {
    args.push("--target-pane", targetPaneId);
  }
  return args;
};

export const HerdrLive = Layer.effect(
  HerdrService,
  Effect.gen(function* () {
    const configService = yield* ConfigService;
    return HerdrService.of({
      focusPane: (paneId) =>
        Effect.suspend(() => {
          const herdr = resolveHerdrBin();
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
      openDashboard: (placementOverride?: DashboardPlacement) =>
        configService.load
          .pipe(
            Effect.map((config) =>
              dashboardOpenArgs(
                placementOverride ?? config.dashboardPlacement,
                config.dashboardSplitDirection
              )
            ),
            Effect.flatMap((args) =>
              Effect.suspend(() => runCapturedCommand(resolveHerdrBin(), args))
            )
          )
          .pipe(
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
                        result.stderr.trim() ||
                        "Herdr could not open the dashboard.",
                      cause: result.stderr,
                    })
                  )
            ),
            Effect.flatMap((stdout) =>
              Schema.decodeUnknown(
                Schema.parseJson(HerdrPaneOpenResponseSchema)
              )(stdout).pipe(
                Effect.map((decoded) => decoded.result.pane?.pane_id),
                Effect.catchAll(() => Effect.succeed(undefined))
              )
            )
          ),
    });
  })
);
