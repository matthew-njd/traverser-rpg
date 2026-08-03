**Traverser** is a mythology-themed fitness RPG mobile app set in the world of "The Old Roads." It turns real-world physical activity into RPG-style progression — gamifying exercise so the love of RPGs becomes the motivation to move more.

Design and architecture live in [`/docs`](docs). The GDD sections and tech specs are the source of
truth; [`docs/DECISIONS.md`](docs/DECISIONS.md) is the running changelog of every deviation from them.

---

## Running the stack

Docker Desktop and the .NET 10 SDK are the only prerequisites.

```
cp infra/.env.example infra/.env     # then fill it in — every value is deliberately blank
cd infra && docker compose up -d
```

Two services (tech-06 §3): `api` on `127.0.0.1:8080` and `db` (Postgres 18) on
`127.0.0.1:5432`. **Both are loopback-only, and that is the security boundary, not a formatting
choice** — the API becomes reachable from the phone through `tailscale serve`, never through the
LAN. Publishing either on `0.0.0.0` undoes tech-06 §1.2.

The stack is designed to be switched off between sessions. `restart: unless-stopped` brings it
back when the PC boots but respects a deliberate `docker compose stop`.

### First run, and after every new migration

Migrations are **never** applied at startup (tech-06 §1.6) — this machine sleeps on a power
button, and a half-applied migration on the only copy of the fitness history is worse than an API
that refuses to start. They are an explicit host command:

```
dotnet ef database update --project api/Traverser.Api
```

The API asserts on boot that the applied migration set matches its own and exits naming the
missing ones if it does not (tech-06 §5.2), so forgetting this is loud rather than mysterious:

```
docker compose logs api
# Database schema does not match this build (not applied: 20260731214341_InitialSchema, ...)
```

Applying migrations also seeds all content — the seed ships as EF `HasData`, so it arrives inside
the migration rather than as a separate step.

↯ **A new migration means two commands, not one.** `dotnet ef database update` runs on the *host*
and changes the database; the container is a compiled snapshot of the `Migrations/` folder as it
stood when the image was built. Update the database without rebuilding and the halves drift apart
in the other direction — the API now sees a migration it has never heard of and refuses to start:

```
# applied but unknown to this build: 20260801140924_ContentValidationConstraints
docker compose up -d --build api    # --build is the whole point; plain `up -d` reuses the old image
```

So the full sequence after `dotnet ef migrations add` is: **add → `database update` → `up -d
--build api`.** Both directions of the assertion are deliberate (tech-06 §5.2) — an image serving
a schema it was not compiled against is exactly the silent-corruption case §1.6 exists to prevent.

### One-time setup on a fresh clone

`dotnet ef` and `dotnet run` from the host read the connection string from .NET user-secrets, not
from `infra/.env` (DECISIONS 2026-07-31). The password is the only part that is secret; the rest
is in `appsettings.Development.json`.

```
dotnet user-secrets set "ConnectionStrings:Traverser" \
  "Host=localhost;Port=5432;Database=<POSTGRES_DB>;Username=<POSTGRES_USER>;Password=<POSTGRES_PASSWORD>" \
  --project api/Traverser.Api
```

### Checking it works

```
curl.exe http://127.0.0.1:8080/api/v1/content/version
# {"content_version":1}
```

↯ **`curl.exe`, not `curl`.** In Windows PowerShell 5.1 `curl` is an alias for `Invoke-WebRequest`,
which parses the response through the legacy IE engine and interrupts with a *"Security Warning:
Script Execution Risk"* prompt. The request succeeded; the warning is about parsing the reply. The
`.exe` suffix bypasses the alias and runs the real curl in System32.

### Day-to-day

| | |
|---|---|
| API inner loop | `docker compose stop api`, then `dotnet run --project api/Traverser.Api` on the host — hot reload, not an image rebuild |
| Rebuild the image | `docker compose up -d --build api` |
| Logs | `docker compose logs -f api` |
| psql | `docker compose exec db psql -U <POSTGRES_USER> <POSTGRES_DB>` |
| GUI client | DBeaver et al. connect to `localhost:5432` — the published port exists for this and for `dotnet ef` |
| Tests | `dotnet test` |

↯ **`Cannot load library libgssapi_krb5.so.2` on every API start is expected — it is not an
error.** Npgsql probes for Kerberos/GSSAPI at first connection so it can offer integrated auth if
the server negotiates for it. The runtime base image is `aspnet:10.0-noble-chiseled-extra`, which
ships no krb5 library by design — that absence is part of why the image is 74 MB. Postgres here
uses `scram-sha-256` password auth, so the negotiation never happens and nothing is lost. It
prints on stderr with the word *Error*, which is the only reason it looks fatal; the successful
`SELECT migration_id` query appears a line or two later in the same log. Silencing it would mean
leaving chiseled for a full `noble` base and installing `libgssapi-krb5-2` — ~30 MB and a larger
attack surface to remove a cosmetic line. Deliberately not done.

### Rotating the Postgres password

↯ **Editing `POSTGRES_PASSWORD` in `.env` does not change the database's password.** The image
applies it only when initialising a *fresh* data directory; against an existing volume the role
keeps the old one. Worse, the failure is deferred — the running API holds an established pool and
keeps working, then fails on its next recreate. Four steps, in order:

```
docker compose up -d db                 # 1. recreate db so its env picks up the new value
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -v pw="$POSTGRES_PASSWORD" \
  -c "ALTER ROLE CURRENT_USER WITH PASSWORD :'"'"'pw'"'"';"'   # 2. sync the role
docker compose up -d --force-recreate api                      # 3. recreate api
```

4. Re-run the `dotnet user-secrets set` command above — the host copy is a third place the password
lives and nothing syncs it.

Step 2 goes through the container's unix socket, which is `trust`, so it needs neither the old nor
the new password on the command line. Free at M0; from M1 a reseed stops being an escape hatch.

⚠️ **`docker compose down -v` destroys the database volume.** Harmless now; from M1 on it is the
fast path to losing real fitness history (tech-06 §6.4). Reset content by re-running migrations,
not by nuking the volume.

---

## Running the app

Android only (CLAUDE.md). Expo Go will never work here — `react-native-health-connect` needs a
native build (tech-04 §1.1) — so the daily driver is a local development build over USB.

```
cp app/.env.example app/.env     # then set EXPO_PUBLIC_API_BASE_URL
cd app && npm install
npx expo run:android             # builds natively, installs over ADB
```

`app/.env` is loaded from `app/` only — Expo CLI does not walk up to the repo root, so it shares
nothing with `infra/.env`. An unset `EXPO_PUBLIC_API_BASE_URL` fails config resolution by design
(tech-06 §4.2); it does not silently default.

### The asset registry is generated — never hand-edit it

Metro resolves `require()` at build time, so every sprite and sound must appear as a literal path
somewhere (tech-04 §9). That somewhere is `src/assets/registry.generated.ts`, emitted by:

```
npm run gen:assets                    # verify + regenerate; fails naming any missing/orphan file
npm run gen:assets -- --placeholders  # first create placeholders for keys that have no file yet
```

The generator parses `docs/traverser-data-manifest.md` — new content means a manifest key *first*,
then `gen:assets`, never a hardcoded filename. Placeholders are flat-colour PNGs with the key as
text, and silent `.wav` files (not `.ogg`: no OGG encoder in the toolchain, and Metro cannot bundle
`.ogg` without a `metro.config.js`, which arrives at M5 — DECISIONS 2026-08-01). Real art/audio is
drop-in: replace the placeholder (for audio: add `{key}.ogg`, delete the `.wav`), rerun `gen:assets`.

### ↯ The Android SDK ships a ninja too old to build Reanimated

**One-time machine setup. Without it the first native build cannot succeed**, and the error names
nothing that is actually wrong:

```
ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

`Sdk/cmake/3.22.1/bin/ninja.exe` is **ninja 1.10.2 (2020)**, and on Windows it intermittently
fails to `stat` a file that exists — here `react-native-workletsConfigVersion.cmake`, one of
Reanimated's prefab dependencies. Ninja then believes a dependency is missing, marks `build.ninja`
permanently stale, re-runs CMake, gets an identical file back, and loops until it gives up. The
file is on disk the whole time; `dir` finds it, and so does ninja **1.12.1**.

The fix is to replace that one binary. The original is kept alongside it:

```
Sdk/cmake/3.22.1/bin/ninja.exe                 # ninja 1.12.1, from github.com/ninja-build/ninja
Sdk/cmake/3.22.1/bin/ninja-1.10.2-original.exe # the SDK's own, restore by renaming over the above
```

↯ **An SDK Manager update to the CMake package will silently restore 1.10.2** and the loop comes
back. The symptom is unmistakable; the fix is to re-copy 1.12.1.

Dead ends, so they are not re-tried — none of these are the cause:

| Tried | Result |
|---|---|
| Clearing every `.cxx` cache | Reproduces identically on a fresh generate. `.cxx` lives in `node_modules/*/android/`, so `expo prebuild --clean` never touches it |
| `LongPathsEnabled=1` in the registry | No effect on ninja, whose manifest does not opt in. Left enabled — Reanimated's Windows guide wants it anyway |
| `subst` to a short drive | Gradle canonicalises straight back to the real `C:\` path |
| `CMAKE_VERSION=3.31.1` | Reanimated's own Windows guide suggests it, but 4.5.1 does not read the variable |
| Removing `CONFIGURE_DEPENDS` from Reanimated's `CMakeLists.txt` | Removes the glob machinery and the loop still happens |

Path length is **not** the trigger, despite the failing path being the longest in the set: a
one-off ninja manifest stats that exact 264-character relative path without complaint.

### ⚠️ `android/` is generated, and the next prebuild deletes it

`app.config.ts` plus config plugins **are** the native project (tech-04 §1.1). Anything hand-edited
inside `android/` — `AndroidManifest.xml`, `build.gradle`, `gradle.properties` — is written to a
directory that `npx expo prebuild --clean` throws away. This is the single most expensive thing to
learn by accident, which is why `android/` is gitignored rather than committed.

### The release keystore

`traverser-release.keystore` at the repo root is a **permanent artefact**, gitignored, and its loss
is unrecoverable in a specific way: Android only update-installs an APK over one signed by the same
key, so a lost key means uninstall-then-install, and per tech-04 §6.5 uninstall destroys `player_id`,
the bearer token, the SQLite mirror, and the Health Connect grants with no route back to the
server-side profile.

Generated once at M0 — 4096-bit RSA, alias `traverser`, valid to 2053. **Do not regenerate it.**

Its certificate fingerprint is the app's permanent identity. Not a secret — record it here so a
future APK can be checked against it (`keytool -printcert -jarfile app-release.apk`):

```
SHA-256: 72:DC:F5:6B:FF:7C:2A:7C:86:2C:0D:9D:3E:6D:69:24:7E:1D:74:92:00:58:44:8B:8E:9C:B8:D4:6F:3E:D5:90
```

Confirm the wiring at any time with `cd app/android && ./gradlew :app:signingReport` — the `release`
variant must report `Config: traverserRelease`. If it says `Config: debug`, stop and fix it before
installing anything.

Its passwords live in `~/.gradle/gradle.properties`, outside the repo entirely, as four properties:

```
TRAVERSER_KEYSTORE_FILE, TRAVERSER_KEYSTORE_PASSWORD, TRAVERSER_KEY_ALIAS, TRAVERSER_KEY_PASSWORD
```

Gradle also reads these from `ORG_GRADLE_PROJECT_*` environment variables if you'd rather not keep
them on disk. The store and key passwords are deliberately identical — PKCS12 has no separate key
password, and keytool silently ignores `-keypass`.

⚠️ **Both the keystore and that properties file belong in the tech-06 §10.5 backup set.** Backing up
Postgres without them protects the wrong half: the database survives and the app that can claim it
does not.

**Why a config plugin and not an edit to `android/app/build.gradle`:** that file is generated, and
`prebuild --clean` deletes it. The template ships `release { signingConfig signingConfigs.debug }` —
its own comment says *"Caution! In production, you need to generate your own keystore file"* — and
prebuild regenerates that debug keystore, so out of the box every clean rebuild yields a release APK
with a **different signing identity**. `app/plugins/withReleaseSigning.ts` re-injects the real config
on every prebuild. If the keystore properties are missing, a release build **fails loudly** rather
than falling back to the debug key.

Release build (tech-06 §7.2 — an APK, not an AAB, because AAB cannot be sideloaded):

```
npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### ↯ When a reload is not enough

Coming from web React, the reflex is that saving a file is the whole loop. It is not:

| Changed | What it takes |
|---|---|
| A component, a screen, a store | Fast Refresh — save and look |
| `app.config.ts`, `app/.env`, a plugin, a native dep, a permission, the icon | `npx expo prebuild --clean && npx expo run:android` |

`EXPO_PUBLIC_API_BASE_URL` is in the second row: it is **baked into the binary at build time**, so
pointing the app at a different API host is a rebuild and a reinstall, never a restart (tech-04 §3.2,
tech-06 §4.2). The same fact is why moving hosts later (tech-06 §11) needs a re-signed APK.

The app's identity — `com.oldroads.traverser` — is fixed. Changing it after an install makes Android
treat the build as a different app, and per tech-04 §6.5 the uninstall that follows takes the local
database with it.

---

## Backups

↯ **From M1 this stops being optional** (tech-06 §10). Health Connect keeps roughly 30 days of
history on the phone, so beyond that window the Postgres row is the only copy of a given day's steps
that exists anywhere — there is no upstream to re-fetch from and no way to walk those days again.

`infra/backup.sh` takes a `pg_dump -Fc`, writes it to a local folder **and** to the Google Drive
folder, then prunes both. Off-machine is the copy that matters: a dead PC or a failed drive
controller takes every same-machine copy with it.

### One-time setup

Two keys in `infra/.env` (see `.env.example`). Neither has a default, deliberately — a backup job
that guesses its destination is one that reports success while writing where nobody looks:

```
BACKUP_LOCAL_DIR=C:/Users/<you>/Documents/Development/Backups/Traverser
BACKUP_REMOTE_DIR=G:/My Drive/Development/Projects/Apps/Traverser/Backups
```

Then register the schedule, from an ordinary (non-elevated) prompt:

```
powershell -ExecutionPolicy Bypass -File infra\register-backup-task.ps1
```

That `.ps1` is the **only** Windows-specific piece (tech-06 §11.2). `backup.sh` is POSIX sh with no
GNU-only dependencies, so moving the stack to a Linux host means deleting the task and adding one
cron line; the script itself goes across unchanged.

### When it runs

Daily at 03:00 **and** at logon, with run-if-missed set. This machine is frequently asleep at 03:00,
so the catch-up is the mechanism rather than a fallback.

↯ **At logon, not at startup** — a deviation from §10.3's wording, recorded in `DECISIONS.md`.
Docker Desktop is a user-session application: at true machine startup there is no engine to dump
from, so an at-startup trigger would fail on every boot.

At most one dump per day. Both triggers fire on a day that begins with a reboot, and without that
guard a power-cycled machine would spend three of its seven daily slots on a single day. Pass
`--force` to override it for a manual run.

### Retention

7 daily / 4 weekly / 12 monthly (§10.4), applied to both locations by the same script. Sized for the
recovery *window*, not for disk: a bad seed or a bug that corrupts progression may go unnoticed for
weeks, and a 7-day-only history would have overwritten the last good copy by then.

The rule is "the N most recent distinct days/weeks/months that **have** a dump", not "everything
within the last N days" — on a machine that is off for a fortnight, a wall-clock rule would quietly
prune six of the seven dailies while nobody was looking.

About 19 files are kept at steady state rather than 23, because one dump satisfies several rules at
once (the same dedupe restic and borg do for identical policy flags). Space is a non-issue and
always will be: a dump is 83 KB today and grows by well under 1 MB per year of play, so both
locations together stay in the tens of megabytes for years.

### Checking that it is working

```
Get-ScheduledTaskInfo -TaskName 'Traverser database backup'
```

`LastTaskResult` **0** = both copies written · **1** = the dump failed · **2** = the local dump
succeeded and the off-machine copy did not. **2 is a failure, not a warning** — the off-machine copy
is the entire reason the job exists. Every run appends to `backup.log` in `BACKUP_LOCAL_DIR`.

The quickest human check needs no commands: look at the newest file in the Drive folder. If its date
is not today or yesterday, something is broken.

The script waits up to ten minutes for Postgres (sized for a cold Docker Desktop at logon) but will
not start a stopped stack on its own, since `docker compose stop` is a supported thing to do here.

### The dump alone is not a backup

A perfect Postgres backup restored onto new hardware is a database full of history that **no client
can claim**, because `player_id` and the bearer token live only in app storage (tech-04 §6.5). Three
artefacts therefore belong in the Drive folder alongside the dumps, and the script deliberately does
not touch any of them:

| Artefact | Why |
|---|---|
| `infra/.env` | Holds the Postgres password. A dump you cannot authenticate against is not a restore. Re-copy after a password rotation |
| `traverser-release.keystore` | Losing it forces an uninstall, and uninstall destroys the device identity |
| `~/.gradle/gradle.properties` | The keystore's four passwords — either file alone is useless |

They are static, so automating them would buy nothing and add ways to lose them: a scheduled job
that copies your signing key around is more exposure, not less. Copy them once, by hand.

⚠️ A **fourth** member joins them at P8 — the exported `player_id` and bearer token (tech-06 §13.1),
once the Settings screen can produce it. Until that exists, losing the phone still costs the profile
even though the history survives.

### Restoring

Not yet drilled. The drill runs at **P9**, against real data, per §10.6 — that is the moment the
backup stops being hypothetical and the cheapest possible time to find a typo in the dump command:

```
docker compose exec -T db createdb -U <POSTGRES_USER> traverser_restore_test
docker compose exec -T db pg_restore -U <POSTGRES_USER> -d traverser_restore_test \
  --clean --if-exists < traverser-YYYYMMDD-HHMM.dump
# spot-check a known activity_day row, the player's level, the xp_curve row count, then:
docker compose exec -T db dropdb -U <POSTGRES_USER> traverser_restore_test
```

Custom format means `pg_restore` can also pull individual objects out of an archive, which is what
matters on the day the goal is "recover yesterday's `activity_day` rows" rather than "recreate the
whole database".

---

## Reaching the API from the phone — manual host steps

The API binds to `127.0.0.1` and stays there. The phone reaches it over the tailnet, via
`tailscale serve` (tech-06 §8) — never over the LAN, never through a port-forward. These steps are
performed on the Windows host and are **not** reproducible from the repo, which is why they are
written down here (tech-06 §1.4).

Current topology: host `workshop`, phone `mnjd-pixel9`, tailnet `tail465912.ts.net`. The client's
base URL is `https://workshop.tail465912.ts.net/api/v1`.

**1. Three admin-console toggles, all one-time.** Two are in
[DNS settings](https://login.tailscale.com/admin/dns), one is node-scoped:

| Toggle | Why |
|---|---|
| MagicDNS | Gives the host a stable name; without it the base URL would be a `100.x` address baked into a build |
| HTTPS certificates | Prerequisite for `--https=443`. ⚠️ Publishes the host and tailnet DNS names to public certificate-transparency logs, permanently — rename the host *before* enabling (tech-06 §8.2) |
| Serve | Node-scoped consent, reached via the link the CLI prints |

↯ If Serve is not enabled, `tailscale serve` **hangs rather than failing** — it prints
`Serve is not enabled on your tailnet` with a consent URL and waits. It is not a network problem.

**2. Publish the API, from an Administrator terminal:**

```
tailscale serve --bg --https=443 http://127.0.0.1:8080
tailscale serve status          # verify; `tailscale serve off` tears it down
```

`--bg` is load-bearing, not garnish. Without it Serve runs in the foreground and dies with the
terminal, needing a manual restart after every reboot — and this host is expected to be power-cycled
(tech-06 §1.1). With it, Serve persists and resumes on its own.

Tailscale provisions the Let's Encrypt certificate itself as part of this flow; there is no
certificate step to perform and nothing to renew by hand.

**3. Check it end to end**, with Docker running and the phone on the tailnet:

```
curl.exe https://workshop.tail465912.ts.net/api/v1/content/version
# {"content_version":1}
```

Verified 2026-08-01 from **both** the host and the phone's browser — the host check confirms Serve,
the certificate, and the proxy; only the phone check confirms the tunnel, which is the half that
actually has to work while out walking. `tailscale serve status` reports
`https://workshop.tail465912.ts.net (tailnet only) |-- / proxy http://127.0.0.1:8080`.

### Renaming the host is not free

The MagicDNS name is the client's base URL, and that URL is compiled into the APK (tech-06 §4.2).
Renaming the machine later means a rebuild and a reinstall — and the old name stays in the public CT
log regardless. `tailscale set --hostname <name>` is the CLI form if it ever has to happen.

### What is deliberately absent

No retry logic, no connectivity monitoring, no "not connected" banner. Android allows one VPN at a
time and Doze can drop the tunnel mid-walk — both are non-events here, because T2 §1.2 makes an
unreachable API the normal case, T4 §8.1 treats it as success, and T3's high-water marks mean a late
sync loses nothing. Adding any of the three would be a regression (tech-06 §8.4).

---

## M0 is complete

Nothing outstanding. The first device build (§7.1) ran on 2026-08-01 and installed over USB to a
Pixel 9. Tailscale (§8) is done and verified from the phone, Sentry (§9) is wired on both tiers with
both DSNs in place, the content-bundle validation pass (§5.4) is split between CHECK constraints and
`ContentValidationTests`, and the release keystore with its config plugin (§7.3) is generated and
proven by `signingReport`.

M0 delivered the pipeline, not the game. What it proves is that the identity
(`com.oldroads.traverser`), the signing config, the Sentry init, and `EXPO_PUBLIC_API_BASE_URL` all
survive the trip to a real device, which is what M1 builds on.

A close-out pass (2026-08-01, DECISIONS) finished the loose ends so M1 starts at feature work: the
four T1-amendment tables are migrated (`auth_token`, `encounter_grant`, `client_operation`,
`birth_year`), the asset registry and its 115 placeholders exist, and the Expo template is stripped
to a minimal boot shell (root layout + placeholder screen + the env/Sentry wiring).

Deferred by explicit decision, not forgotten: source-map upload, the `getSentryExpoConfig` half of
the Sentry setup, and the `metro.config.js` that lets Metro bundle `.ogg` (all M5); the §13.1
profile export/restore (M1, alongside the backup job); and the template's web-facing npm
dependencies, left installed for a deliberate prune at the next device rebuild.

### Sentry

Two projects in one free-tier org (tech-06 §9.1), two DSNs, two homes:

| Project | DSN goes in | Key |
|---|---|---|
| `traverser-api` | `infra/.env` | `Sentry__Dsn` |
| `traverser-app` | `app/.env` | `EXPO_PUBLIC_SENTRY_DSN` |

**Blank is valid on both tiers and disables capture** — the stack runs without a Sentry account, and
that path is tested, not theoretical. Errors only: no tracing, no profiling, no replay, no screenshots,
and PII plus request-body capture explicitly off, because sync payloads carry heart-rate data (§9.3).

Source-map upload is off, so release-build JS traces are minified until it's enabled at M5. The
`Missing config for organization, project` warning during builds is that decision, not a fault.
