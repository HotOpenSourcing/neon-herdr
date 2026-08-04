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
  OrganizationSelectionRequired,
  StateError,
} from "../schemas/errors.js";

export type ApplicationError =
  | AuthUnavailableError
  | OAuthError
  | ConfigError
  | StateError
  | NeonRequestError
  | OrganizationSelectionRequired
  | ClipboardError
  | ConfirmationError
  | DashboardHostError;

export type CommandError = HerdrCommandError | NeonCliError | StateError;
