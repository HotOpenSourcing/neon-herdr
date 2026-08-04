import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { Effect } from "effect";
import open from "open";
import * as oauth from "openid-client";

import {
  NEONCTL_OAUTH_CLIENT_ID,
  NEONCTL_OAUTH_SCOPES,
  OAUTH_AUTHORIZATION_TIMEOUT_MS,
  OAUTH_BASE_SCOPES,
  OAUTH_CALLBACK_HOST,
  OAUTH_CALLBACK_PATH,
  OAUTH_DISCOVERY_TIMEOUT_SECONDS,
  OAUTH_FAILURE_HTML,
  OAUTH_SUCCESS_HTML,
} from "../../constants/oauth.js";
import { AUTHENTICATE_ACTION_ID } from "../../constants/plugin.js";
import { OAuthError } from "../../schemas/errors.js";
import type {
  AuthorizationUrlHandler,
  OAuthClientSettings,
} from "../../types/auth.js";
import { errorMessage } from "../../utils/error-message.js";
import { herdrActionCommand } from "../../utils/plugin-identity.js";

const oauthFailure = (
  operation: OAuthError["operation"],
  action: string,
  cause: unknown
): OAuthError =>
  OAuthError.make({
    operation,
    message: errorMessage(cause),
    action,
    cause,
  });

const discover = (settings: OAuthClientSettings) =>
  Effect.tryPromise({
    try: () =>
      oauth.discovery(
        new URL(settings.oauthHost),
        settings.clientId,
        { token_endpoint_auth_method: "none" },
        oauth.None(),
        { timeout: OAUTH_DISCOVERY_TIMEOUT_SECONDS }
      ),
    catch: (cause) =>
      oauthFailure(
        "discover",
        "Check the network connection and OAuth host, then try again.",
        cause
      ),
  });

const acquireLoopbackServer = Effect.async<Server, OAuthError>(
  (resume, signal) => {
    const server = createServer();
    let settled = false;
    const cleanup = () => {
      server.off("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const onError = (cause: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resume(
        Effect.fail(
          oauthFailure(
            "callback",
            "Check whether local loopback connections are allowed, then try again.",
            cause
          )
        )
      );
    };
    const onAbort = () => {
      if (server.listening) {
        server.close();
      }
    };
    server.once("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    server.listen(0, OAUTH_CALLBACK_HOST, () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resume(Effect.succeed(server));
    });
    return Effect.sync(() => {
      cleanup();
      if (server.listening) {
        server.close();
      }
    });
  }
);

const releaseLoopbackServer = (server: Server) =>
  Effect.sync(() => {
    server.removeAllListeners("request");
    if (server.listening) {
      server.close();
    }
    server.closeAllConnections();
  });

const callbackPort = (server: Server): number | undefined => {
  const address = server.address();
  return address === null || typeof address === "string"
    ? undefined
    : address.port;
};

const writeResponse = (
  response: ServerResponse,
  status: number,
  body: string
) => {
  if (response.headersSent || response.destroyed) {
    return;
  }
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(body);
};

const waitForAuthorization = (
  server: Server,
  configuration: oauth.Configuration,
  redirectUri: string,
  codeVerifier: string,
  state: string
) =>
  Effect.async<oauth.TokenEndpointResponse, OAuthError>((resume) => {
    let settled = false;
    const cleanup = () => {
      server.off("request", onRequest);
    };
    const complete = (
      effect: Effect.Effect<oauth.TokenEndpointResponse, OAuthError>
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resume(effect);
    };
    const onRequest = (request: IncomingMessage, response: ServerResponse) => {
      const requestUrl = new URL(request.url ?? "/", redirectUri);
      if (requestUrl.pathname !== OAUTH_CALLBACK_PATH) {
        writeResponse(response, 404, "Not found");
        return;
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Origin": "*",
        });
        response.end();
        return;
      }
      complete(
        Effect.tryPromise({
          try: () =>
            oauth.authorizationCodeGrant(configuration, requestUrl, {
              expectedState: state,
              pkceCodeVerifier: codeVerifier,
            }),
          catch: (cause) =>
            oauthFailure(
              "authorize",
              "Start Neon sign-in again and complete it in the browser.",
              cause
            ),
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              writeResponse(response, 200, OAUTH_SUCCESS_HTML);
            })
          ),
          Effect.tapError(() =>
            Effect.sync(() => {
              writeResponse(response, 400, OAUTH_FAILURE_HTML);
            })
          )
        )
      );
    };
    server.on("request", onRequest);
    return Effect.sync(cleanup);
  }).pipe(
    Effect.timeoutFail({
      duration: OAUTH_AUTHORIZATION_TIMEOUT_MS,
      onTimeout: () =>
        oauthFailure(
          "authorize",
          "Start Neon sign-in again and complete it in the browser.",
          `Authentication timed out after ${OAUTH_AUTHORIZATION_TIMEOUT_MS / 1_000} seconds.`
        ),
    })
  );

export const authorizeWithBrowser = (
  settings: OAuthClientSettings,
  onAuthorizationUrl: AuthorizationUrlHandler
) =>
  Effect.gen(function* () {
    const configuration = yield* discover(settings);
    return yield* Effect.acquireUseRelease(
      acquireLoopbackServer,
      (server) =>
        Effect.gen(function* () {
          const port = callbackPort(server);
          if (port === undefined) {
            return yield* oauthFailure(
              "callback",
              "Start Neon sign-in again.",
              "The OAuth callback server has no TCP port."
            );
          }
          const redirectUri = `http://${OAUTH_CALLBACK_HOST}:${port}${OAUTH_CALLBACK_PATH}`;
          const state = oauth.randomState();
          const codeVerifier = oauth.randomPKCECodeVerifier();
          const codeChallenge = yield* Effect.tryPromise({
            try: () => oauth.calculatePKCECodeChallenge(codeVerifier),
            catch: (cause) =>
              oauthFailure("authorize", "Start Neon sign-in again.", cause),
          });
          const scopes =
            settings.clientId === NEONCTL_OAUTH_CLIENT_ID
              ? NEONCTL_OAUTH_SCOPES
              : OAUTH_BASE_SCOPES;
          const authorizationUrl = oauth.buildAuthorizationUrl(configuration, {
            scope: scopes.join(" "),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            redirect_uri: redirectUri,
          });
          yield* Effect.try({
            try: () => onAuthorizationUrl(authorizationUrl.href),
            catch: (cause) =>
              oauthFailure("authorize", "Start Neon sign-in again.", cause),
          });
          yield* Effect.tryPromise({
            try: () => open(authorizationUrl.href),
            catch: (cause) => cause,
          }).pipe(
            Effect.catchAll(() =>
              Effect.logWarning(
                "Could not open the browser; use the printed authorization URL"
              )
            )
          );
          return yield* waitForAuthorization(
            server,
            configuration,
            redirectUri,
            codeVerifier,
            state
          );
        }),
      releaseLoopbackServer
    );
  });

export const refreshOAuthToken = (
  settings: OAuthClientSettings,
  refreshToken: string
) =>
  Effect.gen(function* () {
    const configuration = yield* discover(settings);
    return yield* Effect.tryPromise({
      try: () => oauth.refreshTokenGrant(configuration, refreshToken),
      catch: (cause) =>
        OAuthError.make({
          operation: "refresh",
          message:
            cause instanceof oauth.ResponseBodyError &&
            cause.error === "invalid_grant"
              ? "The stored Neon OAuth session expired or was revoked."
              : errorMessage(cause),
          action: `Press a in the dashboard, or run \`${herdrActionCommand(AUTHENTICATE_ACTION_ID)}\`.`,
          cause,
        }),
    });
  });
