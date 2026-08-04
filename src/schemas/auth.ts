import { Schema } from "effect";

export const OAuthCredentialsSchema = Schema.Struct({
  access_token: Schema.String.pipe(Schema.minLength(1)),
  refresh_token: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  expires_at: Schema.Number,
  token_type: Schema.String.pipe(Schema.minLength(1)),
  scope: Schema.optional(Schema.String),
  id_token: Schema.optional(Schema.String),
  user_id: Schema.optional(Schema.String),
});

export const OAuthCurrentUserSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
});
