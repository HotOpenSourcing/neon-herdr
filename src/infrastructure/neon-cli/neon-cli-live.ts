import { Effect, Layer } from "effect";

import { NeonCliService } from "../../application/ports/neon-cli-service.js";
import { NeonCliError } from "../../schemas/errors.js";
import { errorMessage } from "../../utils/error-message.js";
import {
  runCapturedCommand,
  runInheritedCommand,
} from "../../utils/run-command.js";

const candidates: ReadonlyArray<string> = ["neon", "neonctl"];

const findExecutable = Effect.fn("NeonCli.findExecutable")(function* () {
  for (const executable of candidates) {
    const result = yield* runCapturedCommand(executable, ["--version"]).pipe(
      Effect.either,
    );
    if (result._tag === "Right" && result.right.exitCode === 0) {
      return executable;
    }
  }
  return undefined;
});

const missingCli = NeonCliError.make({
  message: "The Neon CLI is not installed.",
  action: "Install it with `brew install neonctl` or `npm install -g neonctl`.",
  cause: "command not found",
});

export const NeonCliLive = Layer.succeed(
  NeonCliService,
  NeonCliService.of({
    findExecutable: findExecutable(),
    psql: (projectId, branchId) =>
      Effect.gen(function* () {
        const executable = yield* findExecutable();
        if (executable === undefined) {
          return yield* missingCli;
        }
        const exitCode = yield* runInheritedCommand(
              executable,
              [
                "connection-string",
                "--project-id",
                projectId,
                "--branch-id",
                branchId,
                "--psql",
              ],
            ).pipe(
          Effect.mapError((cause) =>
            NeonCliError.make({
              message: `Could not launch psql: ${errorMessage(cause)}`,
              action: "Check that both Neon CLI and psql are installed.",
              cause,
            }),
          ),
        );
        if (exitCode !== 0) {
          return yield* NeonCliError.make({
            message: "The Neon CLI psql command failed.",
            action: "Authenticate with the Neon CLI and verify that psql is installed.",
            cause: `exit code ${exitCode}`,
          });
        }
      }),
  }),
);
