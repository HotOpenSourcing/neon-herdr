import {
  AuthUnavailableError,
  NeonRequestError,
  OAuthError,
} from "../schemas/errors.js";
import type { ApplicationError } from "../types/errors.js";

export const isAuthenticationFailure = (error: ApplicationError): boolean =>
  error instanceof AuthUnavailableError ||
  error instanceof OAuthError ||
  (error instanceof NeonRequestError && error.category === "auth");

export const impliesAuthenticated = (error: ApplicationError): boolean =>
  error instanceof NeonRequestError && error.category !== "auth";
