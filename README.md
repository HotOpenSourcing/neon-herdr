# Neon for Herdr

Neon for [Herdr](https://herdr.dev/) is a terminal dashboard for managing Neon projects without leaving a Herdr workspace. It uses the official [`@neon/sdk`](https://www.npmjs.com/package/@neon/sdk), Ink, and Effect.

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
- pnpm 11
- Linux or macOS
- a Neon account for browser authorization
- optionally, Neon CLI and `psql` for the `psql` action

All dependency versions and the lockfile are committed for reproducible installs.

## Install

Install straight from GitHub. `plugin install` clones the repo, shows a preview of the source and the commands it will run, runs the manifest build steps, then registers the plugin:

```sh
herdr plugin install neon-solutions/neon-herdr
```

Add `--yes` for a noninteractive install, and `--ref` to pin a revision:

```sh
herdr plugin install neon-solutions/neon-herdr --yes --ref v0.1.0
```

Open it:

```sh
herdr plugin action invoke neon.herdr.dashboard
```

By default the dashboard opens as a persistent pane split below the focused pane, so your shell or editor stays visible above it. It is an ordinary Herdr pane once open: resize, move, or zoom it with the usual `pane` commands. The action remembers the pane, so invoking it again refocuses that pane instead of opening a second copy. Change the default with [`dashboardPlacement`](#where-the-dashboard-opens), or invoke `neon.herdr.dashboard-tab` for a tab without touching config.

Installed plugins are global to your user and available in every Herdr session. There is no `plugin update` in v1; reinstall to refresh. Remove it with `herdr plugin uninstall neon.herdr`.

### From a local checkout

For development, or to review the code before running it, link the working tree instead. `plugin link` does not run manifest build commands, so build first:

```sh
pnpm install --frozen-lockfile
pnpm build
herdr plugin link .
```

Installing over a locally linked plugin is refused, so `herdr plugin unlink neon.herdr` before switching to the GitHub install. Unlinking leaves config and state intact.

### Verify

```sh
herdr plugin list --plugin neon.herdr --json
herdr plugin action list --plugin neon.herdr
herdr plugin log list --plugin neon.herdr
```

Herdr validates [`herdr-plugin.toml`](./herdr-plugin.toml), registers the actions, and creates isolated config and state directories.

## First run

Nothing works until the plugin has a Neon session, and no keybinding is required to get one. Open the dashboard from a shell in any Herdr session:

```sh
herdr plugin action invoke neon.herdr.dashboard
```

The dashboard opens on a **Not connected** screen and stays there until you sign in. Press `a`, finish the flow in the browser, and the project list loads by itself. The screen also prints the shell command to run if the key does not reach the pane.

If you would rather not open the dashboard first, run the sign-in action directly and then open the dashboard:

```sh
herdr plugin action invoke neon.herdr.authenticate
```

Both paths use the same flow and store the same credentials, so you only do this once per machine. To bind the dashboard to `prefix+shift+n` afterwards, see [Keyboard controls](#keyboard-controls).

## Authentication

The dashboard uses Neon OAuth rather than a manually created API key, through an Authorization Code + PKCE flow the plugin owns.

Press `a` from the dashboard to sign in or replace an expired or revoked session. Once connected, the same key changes to `a sign out`; signing out removes the stored credentials and clears cached account data. The dashboard opens the browser flow and refreshes the project list as soon as authentication completes. Valid refresh tokens are renewed automatically without opening the browser.

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

Press `?` in the dashboard to see the settings actually in force, each tagged with where it came from (`config.json`, `state`, or `default`), along with the exact path to edit. The view is read-only; the plugin never writes `config.json`.

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
  "dashboardPlacement": "split",
  "dashboardSplitDirection": "down",
  "refreshIntervalSeconds": 30,
  "pooledConnections": true,
  "pageSize": 50
}
```

### Where the dashboard opens

`dashboardPlacement` controls how the `dashboard` action opens the pane, and `dashboardSplitDirection` controls which side a split lands on.

This setting applies to the `dashboard` action. `dashboard-tab` always opens a tab.

| `dashboardPlacement` | Result |
| --- | --- |
| `split` (default) | A persistent pane beside the focused pane in the current tab. `dashboardSplitDirection` picks `down` (default) or `right`. |
| `tab` | A dedicated tab in the current workspace. |
| `zoomed` | A pane zoomed over the focused pane, unzoomable with the usual `pane zoom`. |
| `overlay` | A temporary zoomed overlay that restores the previous focus and zoom when closed. |

All four are ordinary Herdr panes once open, so the saved pane is refocused on the next invocation rather than duplicated.

The split anchors on the pane that invoked the action. That pane is resolved from `HERDR_PANE_ID`, then `HERDR_ACTIVE_PANE_ID` for a keybinding command, then `focused_pane_id` in `HERDR_PLUGIN_CONTEXT_JSON` for a CLI invocation. Herdr rejects `split`, `zoomed`, and `overlay` without a target pane, so if none of those resolve the plugin falls back to `tab` instead of failing the action.

`orgId` is optional. When it is absent and the account has several organizations, the dashboard prompts with a selectable list and stores the choice in the state directory; `o` reopens that picker at any time. Setting `orgId` in `config.json` pins the organization and skips the prompt.

All fields are optional. `oauthClientId` is the public OAuth client identifier and should be replaced with the dedicated Neon-issued identifier before launch. `oauthHost` normally remains unchanged. `orgId` narrows API calls to one organization. `pooledConnections` controls the connection string copied by `y`. This file contains public configuration and preferences only; OAuth tokens live in the adjacent restricted `credentials.json` file.

The plugin identifier is never hardcoded. Herdr injects `HERDR_PLUGIN_ID`, `HERDR_PLUGIN_CONFIG_DIR`, `HERDR_PLUGIN_STATE_DIR`, and `HERDR_BIN_PATH` into every runtime command, and the plugin derives its config and state directories, its `plugin pane open --plugin` argument, and the sign-in commands it prints from those values. Installing under a different manifest `id` therefore needs no code change. Outside Herdr the identifier falls back to `neon.herdr` under the XDG directories.

Runtime selection and cache data live only in `HERDR_PLUGIN_STATE_DIR`. The dashboard pane id is saved there so the `dashboard` action can focus an existing tab instead of opening duplicates.

## Keyboard controls

Herdr plugins cannot declare keybindings in the manifest, so bind the dashboard from `~/.config/herdr/config.toml`. The recommended default is `prefix+shift+n`:

```toml
[[keys.command]]
key = "prefix+shift+n"
type = "plugin_action"
command = "neon.herdr.dashboard"
description = "open Neon dashboard in a split"

[[keys.command]]
key = "prefix+alt+n"
type = "plugin_action"
command = "neon.herdr.dashboard-tab"
description = "open Neon dashboard in a tab"
```

Two actions open the dashboard so split and tab can each have a key without editing `config.json`:

| Action | Opens |
| --- | --- |
| `neon.herdr.dashboard` | Uses `dashboardPlacement`, a split to the right by default. |
| `neon.herdr.dashboard-tab` | Always a dedicated tab, ignoring `dashboardPlacement`. |

Both focus the existing Neon pane when one is already open, so there is one dashboard at a time wherever it lives and the bindings are safe to press repeatedly. To move it, close the pane and invoke the other action. They appear in Herdr's keybinding help at `prefix+?` under the descriptions above. Reload with `herdr server reload-config`.

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

Organization picker:

- type: fuzzy filter by name, handle, ID, or plan
- arrows or `ctrl+n`/`ctrl+p`: move
- `Enter`: select and reload projects
- `esc`: clear the filter, then leave the picker

Global: `o` switch organization, `a` sign in or out, `?` help and effective settings, and `q` quit. The UI switches to a resize prompt below 64 columns and honors `NO_COLOR` through Ink's color handling.

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

## Development

Link the working tree once, then iterate:

```sh
pnpm install --frozen-lockfile
pnpm build
herdr plugin link .
```

Herdr spawns a fresh process for every action and pane command, so the loop is just rebuild and reopen:

```sh
pnpm build
herdr plugin action invoke neon.herdr.dashboard
```

Close and reopen the dashboard pane to pick up a rebuild; a running pane keeps the code it started with. Editing `herdr-plugin.toml` changes the contract Herdr validated at link time, so re-register after manifest edits:

```sh
herdr plugin unlink neon.herdr && herdr plugin link .
```

Changes to `~/.config/herdr/config.toml`, including the keybinding, need `herdr server reload-config`.

Run the dashboard outside Herdr against throwaway directories when iterating on the UI. This leaves your real credentials and cache untouched:

```sh
pnpm build
export NEON_DEV_DIR=$(mktemp -d)
HERDR_PLUGIN_CONFIG_DIR=$NEON_DEV_DIR HERDR_PLUGIN_STATE_DIR=$NEON_DEV_DIR \
  node dist/commands/dashboard.js
```

The plugin derives its identifier, config directory, state directory, and the commands it prints from the `HERDR_*` variables Herdr injects, so overriding them is enough to sandbox a run.

Inspect what Herdr recorded when a command misbehaves:

```sh
herdr plugin log list --plugin neon.herdr
```

Checks:

```sh
pnpm typecheck
pnpm build
pnpm check
```

Live Neon calls are opt-in: link the plugin, invoke the `authenticate` action, and open the dashboard. No automated test command talks to Neon.

## Credits

[herdr-file-viewer](https://github.com/smarzban/herdr-file-viewer) by [Saeed Marzban](https://github.com/smarzban) was the reference for much of this plugin's pane behavior. Opening beside your work in a split rather than taking over a tab, keeping that pane idempotent so one key summons it instead of stacking copies, and making the placement a user setting instead of a plugin opinion all came from studying it. It is also a strong example of a terminal UI that earns its space, from the git-aware tree to the per-file view selection and the help overlay, and it set the bar this dashboard aims at.

## References

- [Herdr plugins](https://herdr.dev/docs/plugins/)
- [Herdr configuration](https://herdr.dev/docs/configuration/)
- [herdr-file-viewer](https://github.com/smarzban/herdr-file-viewer)
- [Herdr CLI reference](https://herdr.dev/docs/cli-reference/)
- [Neon TypeScript SDK](https://www.npmjs.com/package/@neon/sdk)
- [Neon CLI](https://neon.com/docs/reference/neon-cli)
- [Neon CLI OAuth implementation](https://github.com/neondatabase/neon-pkgs/blob/main/packages/cli/src/auth.ts)
- [Effect documentation](https://effect.website/docs/)
- [Effect Cache](https://effect.website/docs/caching/cache/)
