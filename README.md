# MemeSpace v2.1 — Node.js startup fix

This is the complete local source package with the worker-runtime startup dependency removed. START-WINDOWS.cmd now runs **Next.js on Node.js with a local SQLite database**. It does not start Vite, Vinext, Wrangler or workerd. The animated binary head, brain, assets and module interfaces remain included.

## Windows: start here

1. Stop the old MemeSpace terminal with Ctrl+C.
2. Install **Node.js 24 or newer** if it is not already installed.
3. Extract this corrected ZIP into a normal folder. Open the folder containing `package.json` and the two Windows launchers.
4. Double-click **SETUP-WINDOWS.cmd** and let it finish.
5. Double-click **START-WINDOWS.cmd**.
6. Wait for **MemeSpace is ready**, then open **http://localhost:5173/**. Keep the terminal open; Ctrl+C stops the server.

The first setup needs internet access to download the locked dependencies. You do not need a ChatGPT subscription, Sites account, Cloudflare account or paid API key. The optional wallet module still requires a compatible wallet extension.

If you extracted these files over the old source folder, run setup again so the corrected scripts are used. Do not delete your old `.wrangler` directory if you want to keep its database.

## What changed

The reported failure occurred after the database migrations succeeded, inside the Cloudflare Vite plugin's worker-entry loading path (`runInRunnerObject` / `getWorkerEntryExportTypes`). The opaque internal reference did not identify the underlying platform fault, and a Windows machine was not available to reproduce that exact native exception.

This repair removes that entire startup path from the local edition:

- Node.js runs Next.js using its webpack mode.
- Node's built-in SQLite driver replaces the local D1 worker binding.
- Local sign-in uses a signed session cookie; it ignores caller-supplied hosted identity headers.
- The launcher checks the server and database before announcing that MemeSpace is ready.
- The same database migrations and API behavior are retained.
- The published Sites website was not changed by this local-package repair.

Updating Wrangler is not required to run the corrected launcher. The old Sites/Vite configuration and dependencies are retained with the source for reference, but the local setup/start/build/migrate commands do not execute them. The application/database/authentication adapters in this edition target Node.js; do not deploy this edited export back to Sites without restoring the hosted adapters.

## Sign-in and saved features

Open Community Chat or Your Profile and use **Sign in**. It signs in to one local owner identity without leaving your computer. Edit your display name and bio in Your Profile. This enables chat, replies, reactions, bookmarks, lesson progress and saved meme captions.

The historical `local_seedy` database user ID is preserved so old saved records still belong to you. New sessions display “Local Owner”; profile names you saved remain intact. No hosted chat history or private account data is included in the ZIP.

This is a **single-user local edition** bound to 127.0.0.1. It is not a public registration or multi-user authentication service. The session key is generated on your machine and stored next to the database. It is not included in the download.

## Preserve an existing local database

New data lives in **`data/memespace.sqlite`**. If the new database does not yet exist, setup looks for the earlier database in `.wrangler/state/v3/d1`, copies it with SQLite's backup operation, and applies only pending migrations. The original file is left unchanged.

- Upgrading in the same folder: preserve `.wrangler`; setup imports it automatically.
- Moving to a fresh folder: copy the old `.wrangler` folder into the new project **before** first setup.
- Moving an already-upgraded v2.1 installation: stop the server and copy the entire `data` folder.
- If more than one old database is found, setup stops with an explanation instead of guessing or overwriting one.

For a database backup, open a terminal in the project folder and run:

```sh
node scripts/local.mjs backup
```

Backups go into `backups/` as standalone SQLite files. To restore, stop the server, preserve the current `data` folder elsewhere, and copy the selected backup to `data/memespace.sqlite`. Keep the same project's `data/session.key` if you want its local sessions to remain valid. Do not leave old `memespace.sqlite-wal` or `memespace.sqlite-shm` files beside a restored database; move the entire current data folder aside first.

## macOS and Linux

With Node.js 24 or newer and npm installed, run these from the extracted project folder:

```sh
node scripts/local.mjs setup
node scripts/local.mjs start
```

Then open http://localhost:5173/.

## Editing, building and checking

Source edits reload in local development mode. Main files:

- `app/scene.tsx`: animated binary head and brain renderer.
- `app/page.tsx`: portal, brain navigation and module shell.
- `app/expanded-modules.tsx`: interactive module workspaces.
- `app/content.ts`: stories and lessons.
- `app/globals.css`: visual styling.
- `app/api/`: persistent module endpoints.
- `lib/local-database.mjs`: SQLite adapter, migrations and old-data import.
- `lib/local-session.mjs`: signed local sessions and loopback/origin checks.
- `db/schema.ts`, `drizzle/`: schema and SQL migration history.
- `public/geometry/`: head/brain data and attribution licenses.

Commands:

```sh
node scripts/local.mjs build
node scripts/local.mjs serve
node scripts/local.mjs migrate
node scripts/local.mjs backup
node scripts/local.mjs test
```

`build` creates a standard Next.js production build in `.next`. `serve` runs that compiled build locally. `start` runs development mode and does not require a separate build. `migrate` and `backup` do not need the Cloudflare runtime. `test` checks storage and starts a temporary server on port 5381 with worker-runtime modules explicitly unavailable.

The pnpm lockfile and dependency versions are retained. Do not run `npm ci`, because there is no npm package-lock. Setup invokes the pinned pnpm version through npm. Installed dependencies, local databases, session keys, logs and caches are intentionally excluded from the ZIP.

## Troubleshooting

- **Old Wrangler/Vite banner still appears:** you are launching the old copy or old script. This package's START-WINDOWS.cmd starts Node.js/Next.js and prints the v2.1 Node runtime startup message.
- **Node is not recognized:** install Node.js and reopen the terminal.
- **Port 5173 is occupied:** stop the previous copy, or run `$env:MEMESPACE_PORT=5174; node scripts/local.mjs start` in PowerShell.
- **Sign-in fails:** use localhost or 127.0.0.1 with the port printed by the launcher, not a LAN IP. Local sign-in is intentionally restricted to this computer.
- **SQLite experimental warning:** some Node 24 releases print this informational warning. It does not indicate a startup failure.
- **Setup download fails:** verify npm registry access and rerun setup; existing data is not removed.
- **Native install issue:** a fresh extraction and setup installs packages for your OS. Do not copy someone else's node_modules folder between Windows and Linux.
- **Old data missing:** preserve the old folder. See the database-import steps above before using a fresh installation.

## Validation and limits

The corrected package is tested with Node 24 on Linux. The regression check denies loading Cloudflare worker-runtime modules, then verifies server readiness, page and geometry delivery, sign-in, profile writes, chat, reactions and bookmarks. Database tests cover repeated migrations, reopening saved data and importing an earlier database without changing the original. TypeScript and production-build results are recorded in FIX-REPORT.md. Windows launchers are included; direct execution on Windows was not available here, so no Windows-specific runtime success is claimed.

The current platform features and later roadmap remain described in IMPLEMENTATION.md. This repair changes local hosting, not the scope of the Build Bible. For public multi-user hosting, replace local sign-in with a proper authentication service and configure HTTPS and access controls.

References: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Node.js SQLite](https://nodejs.org/api/sqlite.html). Preserve geometry and vendored-code attribution/licenses when redistributing.
