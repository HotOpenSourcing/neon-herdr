import { Context } from "effect";

import type { AuthServiceShape } from "../../types/services.js";

export class AuthService extends Context.Tag("neon-herdr/AuthService")<
  AuthService,
  AuthServiceShape
>() {}
