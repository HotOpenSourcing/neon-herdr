import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { Effect, Layer, Schema } from "effect";

import { ConfigService } from "../../application/ports/config-service.js";
import { PLUGIN_CONFIG_FILE } from "../../constants/plugin.js";
import {
  DefaultPluginConfig,
  PluginConfigSchema,
} from "../../schemas/config.js";
import { ConfigError } from "../../schemas/errors.js";
import { resolvePluginPaths } from "../../utils/resolve-plugin-paths.js";

const isMissingFile = (cause: unknown): boolean =>
  cause instanceof Error && "code" in cause && cause.code === "ENOENT";

export const ConfigLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const paths = resolvePluginPaths();
    yield* Effect.all(
      [
        Effect.tryPromise({
          try: () => mkdir(paths.configDir, { recursive: true }),
          catch: (cause) =>
            ConfigError.make({
              message: "Could not create the Neon Herdr config directory.",
              path: paths.configDir,
              cause,
            }),
        }),
        Effect.tryPromise({
          try: () => mkdir(paths.stateDir, { recursive: true }),
          catch: (cause) =>
            ConfigError.make({
              message: "Could not create the Neon Herdr state directory.",
              path: paths.stateDir,
              cause,
            }),
        }),
      ],
      { concurrency: "unbounded", discard: true }
    );
    const configPath = join(paths.configDir, PLUGIN_CONFIG_FILE);
    const load = Effect.tryPromise({
      try: () => readFile(configPath, "utf8"),
      catch: (cause) => cause,
    }).pipe(
      Effect.catchAll((cause) =>
        isMissingFile(cause)
          ? Effect.succeed(undefined)
          : Effect.fail(
              ConfigError.make({
                message: "Could not read the plugin configuration.",
                path: configPath,
                cause,
              })
            )
      ),
      Effect.flatMap((contents) => {
        if (contents === undefined) {
          return Effect.succeed(DefaultPluginConfig);
        }
        return Schema.decodeUnknown(Schema.parseJson(PluginConfigSchema))(
          contents
        ).pipe(
          Effect.mapError((cause) =>
            ConfigError.make({
              message: "The plugin configuration is not valid.",
              path: configPath,
              cause,
            })
          )
        );
      })
    );
    return ConfigService.of({ paths, load });
  })
);
