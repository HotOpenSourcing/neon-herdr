import { Effect } from "effect";

import type { ComputeAction, ComputeSettings } from "../../types/neon.js";
import { NeonService } from "../ports/neon-service.js";

export const runComputeAction = Effect.fn("runComputeAction")(function* (
  projectId: string,
  endpointId: string,
  action: ComputeAction
) {
  const neon = yield* NeonService;
  return yield* neon.runComputeAction(projectId, endpointId, action);
});

export const updateCompute = Effect.fn("updateCompute")(function* (
  projectId: string,
  endpointId: string,
  settings: ComputeSettings
) {
  const neon = yield* NeonService;
  return yield* neon.updateCompute(projectId, endpointId, settings);
});
