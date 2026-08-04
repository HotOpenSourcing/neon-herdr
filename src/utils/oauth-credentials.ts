import type { TokenEndpointResponse } from "openid-client";

import type { OAuthCredentials } from "../types/auth.js";

export const extendOAuthCredentials = (
  token: TokenEndpointResponse,
  now: number,
  previousRefreshToken?: string,
): OAuthCredentials => {
  const refreshToken = token.refresh_token ?? previousRefreshToken;
  return {
    access_token: token.access_token,
    token_type: token.token_type,
    expires_at: now + Math.max(0, token.expires_in ?? 0) * 1_000,
    ...(refreshToken === undefined ? {} : { refresh_token: refreshToken }),
    ...(token.scope === undefined ? {} : { scope: token.scope }),
    ...(token.id_token === undefined ? {} : { id_token: token.id_token }),
  };
};
