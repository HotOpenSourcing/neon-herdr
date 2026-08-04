import type { OAuthCredentialsSchema } from "../schemas/auth.js";

export type OAuthCredentials = typeof OAuthCredentialsSchema.Type;

export interface OAuthClientSettings {
  readonly oauthHost: string;
  readonly clientId: string;
}

export interface AuthResolution {
  readonly accessToken: string;
  readonly source: "oauth";
}

export type AuthorizationUrlHandler = (url: string) => void;
