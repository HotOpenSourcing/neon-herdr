import { Clock, Effect } from "effect";

import { ConfirmationError } from "../../schemas/errors.js";
import { NeonService } from "../ports/neon-service.js";

export const createBranch = Effect.fn("createBranch")(function* (
  projectId: string,
  name: string,
) {
  const neon = yield* NeonService;
  return yield* neon.createBranch(projectId, name);
});

export const renameBranch = Effect.fn("renameBranch")(function* (
  projectId: string,
  branchId: string,
  name: string,
) {
  const neon = yield* NeonService;
  return yield* neon.renameBranch(projectId, branchId, name);
});

export const deleteBranch = Effect.fn("deleteBranch")(function* (
  projectId: string,
  branchId: string,
  branchName: string,
  confirmation: string,
) {
  if (confirmation !== branchName) {
    return yield* ConfirmationError.make({
      message: "Branch deletion confirmation did not match.",
      expected: branchName,
    });
  }
  const neon = yield* NeonService;
  return yield* neon.deleteBranch(projectId, branchId);
});

export const resetBranch = Effect.fn("resetBranch")(function* (
  projectId: string,
  branchId: string,
  sourceBranchId: string,
  branchName: string,
  confirmation: string,
) {
  if (confirmation !== branchName) {
    return yield* ConfirmationError.make({
      message: "Branch reset confirmation did not match.",
      expected: branchName,
    });
  }
  const neon = yield* NeonService;
  const now = yield* Clock.currentTimeMillis;
  const timestamp = new Date(now).toISOString().replace(/[:.]/gu, "-");
  return yield* neon.resetBranch(
    projectId,
    branchId,
    sourceBranchId,
    `${branchName}-before-reset-${timestamp}`,
  );
});
