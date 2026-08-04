import type {
  AuthUnavailableError,
  ClipboardError,
  ConfigError,
  ConfirmationError,
  DashboardHostError,
  HerdrCommandError,
  NeonCliError,
  NeonRequestError,
  OAuthError,
  StateError,
} from "../schemas/errors.js";

export type ApplicationError =
  | AuthUnavailableError
  | OAuthError
  | ConfigError
  | StateError
  | NeonRequestError
  | ClipboardError
  | ConfirmationError
  | DashboardHostError;

export type CommandError = HerdrCommandError | NeonCliError | StateError;
