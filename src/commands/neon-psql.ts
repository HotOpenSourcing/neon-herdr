import { Effect } from "effect";

import { NeonCliService } from "../application/ports/neon-cli-service.js";
import { StateService } from "../application/ports/state-service.js";
import { NeonCliError } from "../schemas/errors.js";
import { runCommand } from "./run-command.js";

const program = Effect.fn("openNeonPsql")(function* () {
  const cli = yield* NeonCliService;
  const state = yield* StateService;
  const selection = yield* state.loadDashboard;
  if (
    selection.selectedProjectId === undefined ||
    selection.selectedBranchId === undefined
  ) {
    return yield* NeonCliError.make({
      message: "No Neon project and branch are selected.",
      action: "Open the dashboard and select a branch first.",
      cause: "missing dashboard selection",
    });
  }
  yield* cli.psql(selection.selectedProjectId, selection.selectedBranchId);
})();

await runCommand(program);
