import { Either } from "effect";

import { redactSecrets } from "./redact.js";

export const maskConnectionString = (value: string): string => {
  const parsed = Either.try(() => new URL(value));
  return Either.match(parsed, {
    onLeft: () => redactSecrets(value),
    onRight: (uri) => {
      if (uri.username.length > 0) {
        uri.username = "***";
      }
      if (uri.password.length > 0) {
        uri.password = "***";
      }
      return uri.toString();
    },
  });
};
