import { Effect } from "effect";

import { disconnectNeon } from "../application/use-cases/auth-session.js";
import { runCommand } from "./run-command.js";

const program = Effect.fn("logoutNeon")(function* () {
  yield* disconnectNeon();
  yield* Effect.sync(() => {
    process.stdout.write(
      "Neon OAuth credentials and cached account data removed.\n"
    );
  });
})();

await runCommand(program);
