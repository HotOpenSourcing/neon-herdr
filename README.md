# Neon for Herdr

Neon for Herdr is a terminal dashboard for managing Neon projects without leaving a Herdr workspace. It uses the official [`@neon/sdk`](https://www.npmjs.com/package/@neon/sdk), Ink, and Effect.

The dashboard supports:

- live fuzzy project search and organization lists with a safe stale-data cache
- project details, branches, compute endpoints, databases, roles, and recent operations
- guarded branch creation, rename, deletion, and parent-head reset with preservation
- compute start, suspend, restart, autoscaling, and suspend-timeout controls
- masked pooled or direct connection-string retrieval and clipboard copy
- browser-based Neon OAuth with refreshable sessions and a separate `psql` action

Project deletion, database and role mutations, SQL editing, and MCP workflows are intentionally not exposed.

## Requirements

- Herdr 0.7.0 or newer
- Node.js 22 or newer
- npm
- Linux or macOS
- a Neon account for browser authorization
- optionally, Neon CLI and `psql` for the `psql` action

All dependency versions and the lockfile are committed for reproducible installs.

## Local installation

Build and link the current checkout:

```sh
npm ci
npm run build
herdr plugin link .
```

Herdr validates [`herdr-plugin.toml`](./herdr-plugin.toml), registers the actions, and creates isolated config and state directories. `plugin link` does not run manifest build commands, so local checkouts must be built first.

Confirm discovery:

```sh
herdr plugin list --plugin neon.herdr --json
herdr plugin action list --plugin neon.herdr
```

Open or focus the persistent dashboard tab:

```sh
herdr plugin action invoke neon.herdr.dashboard
```

Unlinking leaves local files and plugin config/state intact:

```sh
herdr plugin unlink neon.herdr
```

## Authentication

The dashboard uses Neon OAuth rather than a manually created API key. Start the plugin-owned Authorization Code + PKCE flow:

```sh
herdr plugin action invoke neon.herdr.authenticate
```

You can also press `a` from the dashboard to sign in or replace an expired or revoked session. Once connected, the same key changes to `a sign out`; signing out removes the stored credentials and clears cached account data. The dashboard opens the browser flow and refreshes the project list as soon as authentication completes. Valid refresh tokens are renewed automatically without opening the browser.

The action starts a temporary callback listener on `127.0.0.1`, opens Neon's authorization page, verifies the returned access token, and stores refreshable credentials as `credentials.json` in the directory printed by:

```sh
herdr plugin config-dir neon.herdr
```

The credentials file is written with mode `0600`. OAuth access tokens, refresh tokens, connection strings, and database passwords are redacted from plugin diagnostics. They are never written to plugin state or the project checkout.

The development configuration uses the public Neon CLI client identifier, `neonctl`, so the flow can be tested immediately. Before distributing the plugin, request a dedicated OAuth client identifier from Neon and set `oauthClientId` in `config.json`.

Disconnect the plugin account and remove its stored OAuth credentials and cached account data with:

```sh
herdr plugin action invoke neon.herdr.logout
```

## Configuration

This plugin uses `config.json`, not `.env`. Create and open it with:

```sh
NEON_HERDR_CONFIG_DIR="$(herdr plugin config-dir neon.herdr)"
cp config.example.json "$NEON_HERDR_CONFIG_DIR/config.json"
chmod 600 "$NEON_HERDR_CONFIG_DIR/config.json"
"${EDITOR:-vi}" "$NEON_HERDR_CONFIG_DIR/config.json"
```

The file accepts:

```json
{
  "oauthClientId": "neonctl",
  "oauthHost": "https://oauth2.neon.tech",
  "orgId": "org-example-123",
  "refreshIntervalSeconds": 30,
  "pooledConnections": true,
  "pageSize": 50
}
```

All fields are optional. `oauthClientId` is the public OAuth client identifier and should be replaced with the dedicated Neon-issued identifier before launch. `oauthHost` normally remains unchanged. `orgId` narrows API calls to one organization. `pooledConnections` controls the connection string copied by `y`. This file contains public configuration and preferences only; OAuth tokens live in the adjacent restricted `credentials.json` file.

Runtime selection and cache data live only in `HERDR_PLUGIN_STATE_DIR`. The dashboard pane id is saved there so the `dashboard` action can focus an existing tab instead of opening duplicates.

## Keyboard controls

Project list:

- `j`/`k` or arrows: move
- `Enter`: open project
- `/`: live fuzzy search by project name, organization, ID, or region
- `r`: refresh

Project details:

- `j`/`k` or arrows: select branch
- `c`: create branch
- `n`: rename branch
- `d`: delete branch after typing its exact name
- `x`: reset a branch from its parent after typing its exact name; the previous state is preserved as a new branch
- `s`: start or suspend the selected branch's compute
- `R`: restart compute
- `e`: edit `min CU,max CU,suspend seconds`
- `y`: retrieve, mask, and copy a connection string
- `b`: back

Global: `a` sign in or out, `?` help, and `q` quit. The UI switches to a resize prompt below 64 columns and honors `NO_COLOR` through Ink's color handling.

## psql

First select a branch in the dashboard. Then invoke:

```sh
herdr plugin action invoke neon.herdr.psql
```

The action delegates connection retrieval and process launch to the installed `neon` or `neonctl` command and never places the connection string in plugin state or logs.

The Neon CLI maintains its own OAuth session. On first use it may open a second browser authorization flow; the plugin does not read or copy the CLI's private credential file.

## Safety model

- Branch deletion is disabled for default and protected branches.
- Deletion requires typing the exact branch name.
- Reset requires typing the exact branch name and preserves the prior state under a timestamped branch name.
- Mutations are never blindly retried; refresh after an ambiguous network failure to inspect recent operations.
- Idempotent reads use bounded jittered retries. Cached projects remain visible if a refresh fails.
- Neon authentication, permission, lock, rate-limit, timeout, operation, and network failures map to actionable UI messages.
- User-facing failures are secret-redacted, collapsed to one line, and length-bounded; recoverable diagnostics stay at debug level.
- OAuth uses state validation, PKCE S256, a loopback-only callback listener, short-lived access tokens, and refresh-token rotation.
- OAuth credentials are stored only in Herdr's plugin config directory with mode `0600`; logout removes that file.
- OAuth refresh-token rotation is serialized and atomically persisted before further API work.
- Connection strings are masked before display and sent to clipboard over stdin, never argv.
- Navigation interrupts the prior Effect request fiber; late results do not overwrite the current screen.

## Architecture

External configuration, stored state, OAuth responses, Neon requests, clipboard processes, and Herdr commands enter the application as typed Effects. Services are composed once with Layers at the command boundary, while Schema validates JSON and tagged errors preserve actionable failure categories.

Neon reads use Effect Cache with the configured refresh interval as their time-to-live. Cache lookups deduplicate concurrent reads, `r` explicitly refreshes the current view, and successful mutations invalidate affected data. Project and branch arrow keys only update the reducer, and fuzzy search ranks the cached project list through an Effect use case while the query is typed, so neither interaction issues a Neon request. Effect fibers handle request interruption and a Schedule drives background refreshes and bounded retries.

Source files follow the repository organization convention: service ports and use cases live under `src/application`, implementations under `src/infrastructure`, external schemas and tagged errors under `src/schemas`, shared types under `src/types`, constants under `src/constants`, and small helpers under `src/utils`.

## Development checks

```sh
npm run typecheck
npm run build
npm run check
```

Live Neon calls are opt-in: link the plugin, invoke the `authenticate` action, and open the dashboard. No automated test command talks to Neon.

## References

- [Herdr plugins](https://herdr.dev/docs/plugins/)
- [Herdr CLI reference](https://herdr.dev/docs/cli-reference/)
- [Neon TypeScript SDK](https://www.npmjs.com/package/@neon/sdk)
- [Neon CLI](https://neon.com/docs/reference/neon-cli)
- [Neon CLI OAuth implementation](https://github.com/neondatabase/neon-pkgs/blob/main/packages/cli/src/auth.ts)
- [Effect documentation](https://effect.website/docs/)
- [Effect Cache](https://effect.website/docs/caching/cache/)
