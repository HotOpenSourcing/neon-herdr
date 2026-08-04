export const NEON_OAUTH_HOST = "https://oauth2.neon.tech";
export const NEON_API_BASE_URL = "https://console.neon.tech/api/v2";
export const NEONCTL_OAUTH_CLIENT_ID = "neonctl";
export const OAUTH_CREDENTIALS_FILE = "credentials.json";
export const OAUTH_CALLBACK_HOST = "127.0.0.1";
export const OAUTH_CALLBACK_PATH = "/callback";
export const OAUTH_AUTHORIZATION_TIMEOUT_MS = 60_000;
export const OAUTH_DISCOVERY_TIMEOUT_SECONDS = 10;
export const OAUTH_EXPIRY_SKEW_MS = 30_000;

export const OAUTH_BASE_SCOPES = ["openid", "offline", "offline_access"];

export const NEONCTL_OAUTH_SCOPES = [
  ...OAUTH_BASE_SCOPES,
  "urn:neoncloud:projects:create",
  "urn:neoncloud:projects:read",
  "urn:neoncloud:projects:update",
  "urn:neoncloud:projects:delete",
  "urn:neoncloud:orgs:create",
  "urn:neoncloud:orgs:read",
  "urn:neoncloud:orgs:update",
  "urn:neoncloud:orgs:delete",
  "urn:neoncloud:orgs:permission",
];

export const OAUTH_SUCCESS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Neon for Herdr authenticated</title>
  </head>
  <body style="font-family: system-ui; max-width: 36rem; margin: 4rem auto; padding: 0 1rem">
    <h1>Authentication complete</h1>
    <p>You can close this window and return to Herdr.</p>
  </body>
</html>`;

export const OAUTH_FAILURE_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Neon authentication failed</title></head>
  <body style="font-family: system-ui; max-width: 36rem; margin: 4rem auto; padding: 0 1rem">
    <h1>Authentication failed</h1>
    <p>Return to Herdr and start the sign-in flow again.</p>
  </body>
</html>`;
