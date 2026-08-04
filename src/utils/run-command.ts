import { spawn } from "node:child_process";

import { Effect } from "effect";

import { ProcessError } from "../schemas/errors.js";
import type { CommandResult } from "../types/process.js";

const processError = (executable: string, cause: unknown) =>
  ProcessError.make({
    executable,
    message: `Could not run ${executable}.`,
    cause,
  });

export const runCapturedCommand = (
  executable: string,
  args: ReadonlyArray<string>
): Effect.Effect<CommandResult, ProcessError> =>
  Effect.async((resume, signal) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    let stdout = "";
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
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (cause) => {
      complete(Effect.fail(processError(executable, cause)));
    });
    child.once("close", (code) => {
      complete(Effect.succeed({ exitCode: code ?? 1, stdout, stderr }));
    });
    signal.addEventListener("abort", terminate, { once: true });
    return Effect.sync(terminate);
  });

export const runInheritedCommand = (
  executable: string,
  args: ReadonlyArray<string>
): Effect.Effect<number, ProcessError> =>
  Effect.async((resume, signal) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: "inherit",
    });
    let settled = false;
    const complete = (effect: Effect.Effect<number, ProcessError>) => {
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
    child.once("error", (cause) => {
      complete(Effect.fail(processError(executable, cause)));
    });
    child.once("close", (code) => complete(Effect.succeed(code ?? 1)));
    signal.addEventListener("abort", terminate, { once: true });
    return Effect.sync(terminate);
  });
