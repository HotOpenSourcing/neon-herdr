import { Effect } from "effect";

import { AuthService } from "../application/ports/auth-service.js";
import { runCommand } from "./run-command.js";

const program = Effect.fn("authenticateNeon")(function* () {
  const auth = yield* AuthService;
  yield* auth.login((url) => {
    process.stdout.write(
      `Opening Neon sign-in in your browser. If it does not open, visit:\n${url}\n`,
    );
  });
  yield* Effect.sync(() => {
    process.stdout.write("Neon authentication complete.\n");
  });
})();

await runCommand(program);
