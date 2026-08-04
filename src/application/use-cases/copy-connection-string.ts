import { Effect } from "effect";

import { maskConnectionString } from "../../utils/mask-connection-string.js";
import { ClipboardService } from "../ports/clipboard-service.js";
import { NeonService } from "../ports/neon-service.js";

export const copyConnectionString = Effect.fn("copyConnectionString")(function* (
  projectId: string,
  branchId: string,
  endpointId: string,
) {
  const neon = yield* NeonService;
  const clipboard = yield* ClipboardService;
  const connectionString = yield* neon.getConnectionString(
    projectId,
    branchId,
    endpointId,
  );
  yield* clipboard.copy(connectionString);
  return maskConnectionString(connectionString);
});
