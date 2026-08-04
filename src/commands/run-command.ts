import { Effect } from "effect";

import {
  appRuntime,
  type AppServices,
} from "../infrastructure/runtime.js";
import { displayErrorMessage } from "../utils/display-error-message.js";

export const runCommand = async <A, E>(
  program: Effect.Effect<A, E, AppServices>,
): Promise<void> => {
  const exitCode = await appRuntime.runPromise(
    program.pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) =>
          Effect.sync(() => {
            process.stderr.write(`${displayErrorMessage(cause)}\n`);
            return 1;
          }),
        onSuccess: () => Effect.succeed(0),
      }),
    ),
  );
  process.exitCode = exitCode;
  await appRuntime.dispose();
};
