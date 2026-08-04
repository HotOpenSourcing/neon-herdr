import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Clock, Effect, Layer, Schema } from "effect";

import { AuthService } from "../../application/ports/auth-service.js";
import { ConfigService } from "../../application/ports/config-service.js";
import {
  NEON_API_BASE_URL,
  OAUTH_CREDENTIALS_FILE,
  OAUTH_EXPIRY_SKEW_MS,
} from "../../constants/oauth.js";
import {
  OAuthCredentialsSchema,
  OAuthCurrentUserSchema,
} from "../../schemas/auth.js";
import { AuthUnavailableError, OAuthError } from "../../schemas/errors.js";
import type {
  AuthResolution,
  OAuthClientSettings,
  OAuthCredentials,
} from "../../types/auth.js";
import { errorMessage } from "../../utils/error-message.js";
import { extendOAuthCredentials } from "../../utils/oauth-credentials.js";
import { authorizeWithBrowser, refreshOAuthToken } from "./oauth.js";

const isMissingFile = (cause: unknown): boolean =>
  cause instanceof Error && "code" in cause && cause.code === "ENOENT";

const authResolution = (credentials: OAuthCredentials): AuthResolution => ({
  accessToken: credentials.access_token,
  source: "oauth",
});

const storageError = (
  operation: "read" | "write" | "logout",
  path: string,
  cause: unknown
) =>
  OAuthError.make({
    operation,
    message: `Could not ${operation} Neon OAuth credentials at ${path}: ${errorMessage(cause)}`,
    action: "Check the plugin config directory permissions and try again.",
    cause,
  });

export const AuthLive = Layer.effect(
  AuthService,
  Effect.gen(function* () {
    const configService = yield* ConfigService;
    const credentialsPath = join(
      configService.paths.configDir,
      OAUTH_CREDENTIALS_FILE
    );
    const credentialsTemporaryPath = `${credentialsPath}.${process.pid}.tmp`;
    const authSemaphore = yield* Effect.makeSemaphore(1);
    const removeTemporaryCredentials = Effect.tryPromise({
      try: () => rm(credentialsTemporaryPath, { force: true }),
      catch: (cause) => cause,
    }).pipe(Effect.catchAll(() => Effect.void));

    const loadSettings = configService.load.pipe(
      Effect.map((config): OAuthClientSettings => ({
        oauthHost: config.oauthHost,
        clientId: config.oauthClientId,
      }))
    );

    const readCredentials = Effect.tryPromise({
      try: () => readFile(credentialsPath, "utf8"),
      catch: (cause) => cause,
    }).pipe(
      Effect.catchAll((cause) =>
        isMissingFile(cause)
          ? Effect.succeed(undefined)
          : Effect.fail(storageError("read", credentialsPath, cause))
      ),
      Effect.flatMap((contents) => {
        if (contents === undefined) {
          return Effect.succeed(undefined);
        }
        return Schema.decodeUnknown(Schema.parseJson(OAuthCredentialsSchema))(
          contents
        ).pipe(
          Effect.mapError((cause) =>
            storageError("read", credentialsPath, cause)
          )
        );
      })
    );

    const writeCredentials = (credentials: OAuthCredentials) =>
      Effect.tryPromise({
        try: () =>
          writeFile(
            credentialsTemporaryPath,
            `${JSON.stringify(credentials, undefined, 2)}\n`,
            { mode: 0o600 }
          ),
        catch: (cause) => storageError("write", credentialsPath, cause),
      }).pipe(
        Effect.andThen(
          Effect.tryPromise({
            try: () => chmod(credentialsTemporaryPath, 0o600),
            catch: (cause) => storageError("write", credentialsPath, cause),
          })
        ),
        Effect.andThen(
          Effect.tryPromise({
            try: () => rename(credentialsTemporaryPath, credentialsPath),
            catch: (cause) => storageError("write", credentialsPath, cause),
          })
        ),
        Effect.ensuring(removeTemporaryCredentials)
      );

    const verifyAccessToken = (accessToken: string) =>
      Effect.tryPromise({
        try: (signal) =>
          fetch(`${NEON_API_BASE_URL}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
          }),
        catch: (cause) =>
          OAuthError.make({
            operation: "verify",
            message: `Could not verify the Neon OAuth token: ${errorMessage(cause)}`,
            action: "Check the network connection and sign in again.",
            cause,
          }),
      }).pipe(
        Effect.flatMap((response) =>
          response.ok
            ? Effect.tryPromise({
                try: () => response.json(),
                catch: (cause) =>
                  OAuthError.make({
                    operation: "verify",
                    message: "Neon returned an unreadable user response.",
                    action:
                      "Sign in again. If this persists, contact Neon support.",
                    cause,
                  }),
              })
            : Effect.fail(
                OAuthError.make({
                  operation: "verify",
                  message: `Neon rejected the OAuth token with HTTP ${response.status}.`,
                  action: "Run the Neon sign-in action again.",
                  cause: `HTTP ${response.status}`,
                })
              )
        ),
        Effect.flatMap(Schema.decodeUnknown(OAuthCurrentUserSchema)),
        Effect.mapError((cause) =>
          cause instanceof OAuthError
            ? cause
            : OAuthError.make({
                operation: "verify",
                message: "Neon returned an invalid user response.",
                action:
                  "Sign in again. If this persists, contact Neon support.",
                cause,
              })
        ),
        Effect.map((user) => user.id)
      );

    const makeCredentials = Effect.fn("Auth.makeCredentials")(function* (
      token: Parameters<typeof extendOAuthCredentials>[0],
      previousRefreshToken?: string
    ) {
      const now = yield* Clock.currentTimeMillis;
      return extendOAuthCredentials(token, now, previousRefreshToken);
    });

    const persistLoginToken = Effect.fn("Auth.persistLoginToken")(function* (
      token: Parameters<typeof extendOAuthCredentials>[0]
    ) {
      const credentials = yield* makeCredentials(token);
      const userId = yield* verifyAccessToken(credentials.access_token);
      const verifiedCredentials = { ...credentials, user_id: userId };
      yield* writeCredentials(verifiedCredentials);
      return verifiedCredentials;
    });

    const persistRefreshedToken = Effect.fn("Auth.persistRefreshedToken")(
      function* (
        token: Parameters<typeof extendOAuthCredentials>[0],
        previousCredentials: OAuthCredentials
      ) {
        const credentials = yield* makeCredentials(
          token,
          previousCredentials.refresh_token
        );
        const refreshedCredentials =
          previousCredentials.user_id === undefined
            ? credentials
            : { ...credentials, user_id: previousCredentials.user_id };
        yield* writeCredentials(refreshedCredentials);
        return refreshedCredentials;
      }
    );

    const resolveCredentials = Effect.fn("Auth.resolve")(function* () {
      const settings = yield* loadSettings;
      const credentials = yield* readCredentials;
      if (credentials === undefined) {
        return yield* AuthUnavailableError.make({
          message: "Neon is not connected.",
          action:
            "Press a in the dashboard, or run `herdr plugin action invoke neon.herdr.authenticate`.",
        });
      }
      const now = yield* Clock.currentTimeMillis;
      if (credentials.expires_at > now + OAUTH_EXPIRY_SKEW_MS) {
        return authResolution(credentials);
      }
      if (credentials.refresh_token === undefined) {
        return yield* AuthUnavailableError.make({
          message: "The Neon OAuth session expired without a refresh token.",
          action:
            "Press a in the dashboard, or run the Neon sign-in action again.",
        });
      }
      const token = yield* refreshOAuthToken(
        settings,
        credentials.refresh_token
      );
      const refreshed = yield* persistRefreshedToken(token, credentials);
      return authResolution(refreshed);
    });

    const resolve = authSemaphore.withPermits(1)(resolveCredentials());

    const loginCredentials = Effect.fn("Auth.login")(function* (
      onAuthorizationUrl: (url: string) => void
    ) {
      const settings = yield* loadSettings;
      const token = yield* authorizeWithBrowser(settings, onAuthorizationUrl);
      const credentials = yield* persistLoginToken(token);
      return authResolution(credentials);
    });

    const login = (onAuthorizationUrl: (url: string) => void) =>
      authSemaphore.withPermits(1)(loginCredentials(onAuthorizationUrl));

    const logout = authSemaphore.withPermits(1)(
      Effect.tryPromise({
        try: () => rm(credentialsPath, { force: true }),
        catch: (cause) => storageError("logout", credentialsPath, cause),
      })
    );

    return AuthService.of({ resolve, login, logout });
  })
);
