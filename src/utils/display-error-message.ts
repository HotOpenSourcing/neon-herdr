import { MAX_DISPLAY_ERROR_LENGTH } from "../constants/ui.js";
import { errorMessage } from "./error-message.js";
import { redactSecrets } from "./redact.js";

export const displayErrorMessage = (cause: unknown): string => {
  const message = redactSecrets(errorMessage(cause))
    .replace(/\s+/gu, " ")
    .trim();
  return message.length <= MAX_DISPLAY_ERROR_LENGTH
    ? message
    : `${message.slice(0, MAX_DISPLAY_ERROR_LENGTH - 1).trimEnd()}…`;
};
