import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "commands/dashboard": "src/commands/dashboard.tsx",
    "commands/open-dashboard": "src/commands/open-dashboard.ts",
    "commands/neon-auth": "src/commands/neon-auth.ts",
    "commands/neon-logout": "src/commands/neon-logout.ts",
    "commands/neon-psql": "src/commands/neon-psql.ts",
  },
  clean: true,
  dts: false,
  format: ["esm"],
  minify: false,
  platform: "node",
  sourcemap: true,
  splitting: false,
  target: "node22",
  treeshake: true,
});
