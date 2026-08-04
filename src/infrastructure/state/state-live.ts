import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Effect, Layer, Schema } from "effect";

import { ConfigService } from "../../application/ports/config-service.js";
import { StateService } from "../../application/ports/state-service.js";
import {
  DASHBOARD_STATE_FILE,
  PROJECT_CACHE_FILE,
} from "../../constants/plugin.js";
import { StateError } from "../../schemas/errors.js";
import {
  DashboardStateSchema,
  ProjectCacheSchema,
} from "../../schemas/state.js";

const isMissingFile = (cause: unknown): boolean =>
  cause instanceof Error && "code" in cause && cause.code === "ENOENT";

export const StateLive = Layer.effect(
  StateService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const dashboardPath = join(config.paths.stateDir, DASHBOARD_STATE_FILE);
    const cachePath = join(config.paths.stateDir, PROJECT_CACHE_FILE);

    const load = <A>(path: string, schema: Schema.Schema<A>) =>
      Effect.tryPromise({
        try: () => readFile(path, "utf8"),
        catch: (cause) => cause,
      }).pipe(
        Effect.catchAll((cause) =>
          isMissingFile(cause)
            ? Effect.succeed(undefined)
            : Effect.fail(
                StateError.make({
                  message: "Could not read plugin state.",
                  path,
                  cause,
                }),
              ),
        ),
        Effect.flatMap((contents) => {
          if (contents === undefined) {
            return Effect.succeed(undefined);
          }
          return Schema.decodeUnknown(Schema.parseJson(schema))(contents).pipe(
            Effect.mapError((cause) =>
              StateError.make({
                message: "Plugin state is not valid.",
                path,
                cause,
              }),
            ),
          );
        }),
      );

    const save = <A>(path: string, value: A) => {
      const temporaryPath = `${path}.${process.pid}.tmp`;
      const mapError = (cause: unknown) =>
        StateError.make({
          message: "Could not save plugin state.",
          path,
          cause,
        });
      return Effect.tryPromise({
        try: () => mkdir(config.paths.stateDir, { recursive: true }),
        catch: mapError,
      }).pipe(
        Effect.andThen(
          Effect.tryPromise({
            try: () =>
              writeFile(
                temporaryPath,
                `${JSON.stringify(value, undefined, 2)}\n`,
                { encoding: "utf8", mode: 0o600 },
              ),
            catch: mapError,
          }),
        ),
        Effect.andThen(
          Effect.tryPromise({
            try: () => rename(temporaryPath, path),
            catch: mapError,
          }),
        ),
      );
    };

    return StateService.of({
      loadDashboard: load(dashboardPath, DashboardStateSchema).pipe(
        Effect.map((state) => state ?? {}),
      ),
      saveDashboard: (state) => save(dashboardPath, state),
      loadProjectCache: load(cachePath, ProjectCacheSchema),
      saveProjectCache: (cache) => save(cachePath, cache),
      clearProjectCache: Effect.tryPromise({
        try: () => rm(cachePath, { force: true }),
        catch: (cause) =>
          StateError.make({
            message: "Could not clear the Neon project cache.",
            path: cachePath,
            cause,
          }),
      }),
    });
  }),
);
