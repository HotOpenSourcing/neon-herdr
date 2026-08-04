import { Schema } from "effect";

export class AuthUnavailableError extends Schema.TaggedError<AuthUnavailableError>(
  "AuthUnavailableError"
)("AuthUnavailableError", {
  message: Schema.String,
  action: Schema.String,
}) {}

export const OAuthOperationSchema = Schema.Literal(
  "discover",
  "authorize",
  "callback",
  "read",
  "write",
  "refresh",
  "verify",
  "logout"
);

export class OAuthError extends Schema.TaggedError<OAuthError>("OAuthError")(
  "OAuthError",
  {
    operation: OAuthOperationSchema,
    message: Schema.String,
    action: Schema.String,
    cause: Schema.Defect,
  }
) {}

export class ConfigError extends Schema.TaggedError<ConfigError>("ConfigError")(
  "ConfigError",
  {
    message: Schema.String,
    path: Schema.String,
    cause: Schema.Defect,
  }
) {}

export class StateError extends Schema.TaggedError<StateError>("StateError")(
  "StateError",
  {
    message: Schema.String,
    path: Schema.String,
    cause: Schema.Defect,
  }
) {}

export const NeonErrorCategorySchema = Schema.Literal(
  "auth",
  "permission",
  "locked",
  "rate_limit",
  "network",
  "not_found",
  "operation",
  "timeout",
  "unknown"
);

export class NeonRequestError extends Schema.TaggedError<NeonRequestError>(
  "NeonRequestError"
)("NeonRequestError", {
  category: NeonErrorCategorySchema,
  message: Schema.String,
  action: Schema.String,
  retryable: Schema.Boolean,
  retryAfterMs: Schema.optional(Schema.Number),
}) {}

export class HerdrCommandError extends Schema.TaggedError<HerdrCommandError>(
  "HerdrCommandError"
)("HerdrCommandError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class NeonCliError extends Schema.TaggedError<NeonCliError>(
  "NeonCliError"
)("NeonCliError", {
  message: Schema.String,
  action: Schema.String,
  cause: Schema.Defect,
}) {}

export class ConfirmationError extends Schema.TaggedError<ConfirmationError>(
  "ConfirmationError"
)("ConfirmationError", {
  message: Schema.String,
  expected: Schema.String,
}) {}

export class ClipboardError extends Schema.TaggedError<ClipboardError>(
  "ClipboardError"
)("ClipboardError", {
  message: Schema.String,
  action: Schema.String,
  cause: Schema.Defect,
}) {}

export class ProcessError extends Schema.TaggedError<ProcessError>(
  "ProcessError"
)("ProcessError", {
  executable: Schema.String,
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class DashboardHostError extends Schema.TaggedError<DashboardHostError>(
  "DashboardHostError"
)("DashboardHostError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}
