const CREDENTIAL_PATTERN =
  /(?:postgres(?:ql)?:\/\/)([^:@/\s]+):([^@/\s]+)@/giu;
const API_KEY_PATTERN = /(?:napi_[A-Za-z0-9_-]+|NEON_API_KEY\s*=\s*[^\s]+)/giu;
const OAUTH_FIELD_PATTERN =
  /(?:access_token|refresh_token|id_token)["']?\s*[:=]\s*["']?[^"'\s,}]+/giu;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;

export const redactSecrets = (value: string): string =>
  value
    .replace(CREDENTIAL_PATTERN, "$1***:***@")
    .replace(API_KEY_PATTERN, "[REDACTED]")
    .replace(OAUTH_FIELD_PATTERN, "[OAUTH_TOKEN_REDACTED]")
    .replace(JWT_PATTERN, "[OAUTH_TOKEN_REDACTED]");
