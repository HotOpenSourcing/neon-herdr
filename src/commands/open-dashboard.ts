import { Clock, Effect } from "effect";

import { HerdrService } from "../application/ports/herdr-service.js";
import { StateService } from "../application/ports/state-service.js";
import { runCommand } from "./run-command.js";

const placementArgument = process.argv[2];
const placement =
  placementArgument === "tab" || placementArgument === "split"
    ? placementArgument
    : undefined;

const program = Effect.fn("openNeonDashboard")(function* () {
  const herdr = yield* HerdrService;
  const state = yield* StateService;
  const saved = yield* state.loadDashboard;
  if (saved.paneId !== undefined) {
    const focused = yield* herdr.focusPane(saved.paneId).pipe(Effect.either);
    if (focused._tag === "Right") {
      return;
    }
  }
  const paneId = yield* herdr.openDashboard(placement);
  if (paneId !== undefined) {
    const now = yield* Clock.currentTimeMillis;
    yield* state.saveDashboard({
      ...saved,
      paneId,
      updatedAt: new Date(now).toISOString(),
    });
  }
})();

await runCommand(program);
