import { Cause, Option, Runtime } from "effect";

const unwrapFiberFailure = (cause: unknown): unknown => {
  if (Cause.isCause(cause)) {
    return Option.getOrUndefined(Cause.failureOption(cause)) ?? Cause.pretty(cause);
  }
  if (!Runtime.isFiberFailure(cause)) {
    return cause;
  }
  return (
    Option.getOrUndefined(
      Cause.failureOption(cause[Runtime.FiberFailureCauseId]),
    ) ?? cause
  );
};

export const errorMessage = (cause: unknown): string => {
  const failure = unwrapFiberFailure(cause);
  const message =
    failure instanceof Error
      ? failure.message
      : typeof failure === "object" &&
          failure !== null &&
          "message" in failure &&
          typeof failure.message === "string"
        ? failure.message
        : String(failure);
  const action =
    typeof failure === "object" &&
    failure !== null &&
    "action" in failure &&
    typeof failure.action === "string"
      ? failure.action
      : undefined;
  return action === undefined ? message : `${message} ${action}`;
};
