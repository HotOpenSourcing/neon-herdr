import { spawn } from "node:child_process";

import { Effect } from "effect";

import { ProcessError } from "../schemas/errors.js";
import type { CommandResult } from "../types/process.js";

const runClipboardProcess = (
  executable: string,
  args: ReadonlyArray<string>,
  value: string
): Effect.Effect<CommandResult, ProcessError> =>
  Effect.async((resume, signal) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: ["pipe", "ignore", "pipe"],
    });
    let settled = false;
    let stderr = "";
    const complete = (effect: Effect.Effect<CommandResult, ProcessError>) => {
      if (settled) {
        return;
      }
      settled = true;
      resume(effect);
    };
    const terminate = () => {
      settled = true;
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    };
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (cause) => {
      complete(
        Effect.fail(
          ProcessError.make({
            executable,
            message: `Could not run ${executable}.`,
            cause,
          })
        )
      );
    });
    child.once("close", (code) =>
      complete(Effect.succeed({ exitCode: code ?? 1, stdout: "", stderr }))
    );
    child.stdin.end(value);
    signal.addEventListener("abort", terminate, { once: true });
    return Effect.sync(terminate);
  });

export const copyText = Effect.fn("copyText")(function* (value: string) {
  const candidates =
    process.platform === "darwin"
      ? [{ executable: "pbcopy", args: [] }]
      : [
          { executable: "wl-copy", args: [] },
          { executable: "xclip", args: ["-selection", "clipboard"] },
        ];
  return yield* Effect.firstSuccessOf(
    candidates.map((candidate) =>
      runClipboardProcess(candidate.executable, candidate.args, value).pipe(
        Effect.flatMap((result) =>
          result.exitCode === 0
            ? Effect.void
            : Effect.fail(
                ProcessError.make({
                  executable: candidate.executable,
                  message: `Clipboard command exited with code ${result.exitCode}.`,
                  cause: result.stderr,
                })
              )
        )
      )
    )
  );
});
