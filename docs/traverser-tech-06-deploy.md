# Traverser Tech Spec — T6: Deployment & Dev Loop

**Status:** locked. Inputs: GDD Section 15 · `traverser-tech-01-data-model.md` · `traverser-tech-02-api-sync.md` · `traverser-tech-04-client.md` · `traverser-tech-05-battle.md` · `traverser-data-manifest.md` · `traverser-dev-project-instructions.md` (hosting) · `DECISIONS.md` · sanctioned scope trims.
**Scope:** the Docker Compose stack that runs the API and Postgres, how configuration and secrets reach it, how migrations and content seeding run, the day-to-day dev loop, the Android install path from `expo run:android` to a signed release APK sideloaded over USB, remote reachability so the phone can sync away from home, the Postgres and identity backup plan, and a migration note for dedicated hardware later. No Dockerfile, `docker-compose.yml`, `.env`, backup script, or config plugin is written this session — those land in M0.

**A note on sourcing.** Tailscale plan limits, `tailscale serve`/`tailscale cert` behaviour, and the .NET 10 container image tags were checked against current documentation this session rather than recalled. Version-sensitive claims that were *not* verified this session are marked **⟨verify⟩** and must be confirmed before they are relied on. Nothing marked that way changes the design.

**↯ markers.** Every place this deployment diverges from a habit that transfers cleanly from web/cloud deployment — the world Matthew is expert in — is marked **↯**. §13 collects them; the inline markers are where they actually bite.

---

## 1. Decisions

**1.1 The deployment target is one machine that is usually off, and that is an input to the design rather than a limitation of it.**
Everything else in this spec follows from this. The host is Matthew's desktop PC; it is powered down between sessions by intention, not by neglect (`CLAUDE.md`, hosting). T2 §1.2 already built the client around it — "server unreachable" is the normal state — and T4 §8.1 makes an unreachable API a *success* path in the client. T6's job is to not undo that. Concretely, this spec adds **no uptime monitoring, no alerting on the API being down, no health-check-driven restart escalation, and no cron job that assumes the machine was awake**. Those are the correct instincts for a service with users; here they would generate a stream of pages about a PC that is off because the person who owns it went to bed.

The one place this constraint is genuinely painful is backups (§10): a nightly job on a machine that is off does not run. §10.3 solves that with a catch-up-on-boot trigger rather than by pretending a schedule is reliable.

**1.2 The API is reachable only on a Tailscale tailnet, over HTTPS, via `tailscale serve`. Compose binds loopback only.**
The API must be reachable from the phone while Matthew is out walking — that is the whole point of a fitness app that syncs on foreground. It must not be reachable from anything else. The resolution is a two-layer arrangement: Compose publishes the API on `127.0.0.1:8080` on the host and nowhere else, and `tailscale serve` proxies `https://<host>.<tailnet>.ts.net/` to that loopback port. There is no LAN binding, no router port-forward, and no public DNS name.

`tailscale serve` rather than a raw tailnet IP is a deliberate choice with a specific payoff: it provisions a real Let's Encrypt certificate for the MagicDNS name, so the client's base URL is an ordinary `https://` URL. ↯ **On Android this is worth more than it looks.** Cleartext HTTP has been blocked by default since Android 9, so a plain-HTTP tailnet endpoint would need a `networkSecurityConfig` cleartext exemption — and per T4 §1.1 `android/` is generated and not committed, so that exemption would have to become a hand-written Expo config plugin, checked in, maintained, and carrying a permanent "cleartext permitted" hole. Trading one CLI invocation on the PC for that is not a close call. The secondary payoff is that dev and release builds differ only in the *hostname*, never in the TLS posture, so there is no self-signed-trust code path that exists only in debug.

Tailscale **Funnel** is explicitly rejected: it exposes the service to the public internet, which is the exact thing the tailnet was chosen to avoid, and nothing in this project needs it.

**1.3 Managed cloud Postgres is rejected, once and for the whole project.**
Stated here so it stops being re-litigated. Free-tier managed Postgres — Supabase is the concrete instance, but the pattern is general — fails this project on two independent terms. First, **inactivity pause**: free projects suspend after a period of no traffic, and this app's traffic pattern is *by design* long silences punctuated by a foreground sync. The failure mode is that the one moment the phone tries to sync is the moment the database is cold. Second, **backups are not in the free tier**. §10 makes backups non-negotiable from M1 because this database holds real fitness history; a hosting choice that structurally cannot satisfy the project's own hardest requirement is not a candidate. Both terms would resolve by paying, which violates `CLAUDE.md`'s $0 constraint.

The self-hosted alternative has a worse *availability* story and a better *durability* story, and durability is the property that matters here. Losing a week of uptime costs nothing (the client queues). Losing the step history costs something unrecoverable.

**1.4 Configuration is environment variables on the server and build-time config on the client. Nothing secret is committed.**
The server reads `ConnectionStrings__Traverser`, `Sentry__Dsn`, and `POSTGRES_*` from the environment, supplied by a gitignored `.env` next to `docker-compose.yml`, with a committed `.env.example` carrying every key and no value. The client's API base URL arrives through `app.config.ts` — it cannot live in `AndroidManifest.xml` or `gradle.properties`, because T4 §1.1 deletes those on every prebuild. §4 gives the full surface.

**1.5 Sentry runs on both tiers, and it is the one external account in the stack.**
`@sentry/react-native` in the app (T4 §3.1) and `Sentry.AspNetCore` in the API, same free-tier organisation, two projects, two DSNs. Server-side is not redundant with client-side: T4 §8.1 makes the client treat an unreachable *or failing* API as a non-event, which means **a 500 inside `POST /api/v1/sync` is invisible from the phone by design**. Without server-side error capture, the only trace of a sync bug is a line in `docker compose logs` on a PC that has since been rebooted. That is precisely the class of failure worth paying attention to, since sync is the one endpoint that advances progression (T2 §3).

Per `CLAUDE.md`'s cost rule, flagging it explicitly: **Sentry requires a free account and a DSN — the only account, key, or third-party dependency this stack introduces.** It is $0 at this project's volume by a wide margin (§12), no card is required, and GDD 15 §5.2 already sanctioned it with self-hosting-via-Docker named as the escape hatch if the free tier ever becomes a constraint. No health or gameplay data flows through it — crash and error telemetry only, which also keeps it clear of the analytics trim.

**1.6 Migrations and content seeding are explicit steps, never application startup work.**
An `EnsureCreated`/migrate-on-boot pattern is common and wrong here. This stack starts and stops on a desktop's power button, so "the process started, began migrating, and the machine went to sleep" is a reachable state, and a half-applied migration on the database holding the fitness history is materially worse than an API that refuses to start. Migrations run as a deliberate command; the API's job is to fail fast if the schema it finds is not the schema it expects. §5 specifies both.

---

## 2. Conventions

- **Every image tag is pinned to at least a major version, never `latest`** — `latest` turns "I restarted the stack" into "I upgraded Postgres", and this project's restart cadence is daily.
- **Server config keys use .NET's `__` section separator in the environment** (`ConnectionStrings__Traverser`), because that is what `IConfiguration` binds natively with no custom provider. This is the one place the codebase is not `snake_case`; the wire format (T2 §2) is unaffected.
- **Every Compose service is either backed by a named volume or is disposable.** There is exactly one stateful service. If a second ever appears without a volume, that is a bug, not a simplification.
- **Secrets live in `.env`, which is gitignored; `.env.example` is committed with every key present and every value blank.** A missing key should fail at startup with the key's name, not at first use with a null reference.
- **Anything on the host that the deployment depends on gets written down in this doc, not just done.** A one-machine deployment's real failure mode is an undocumented manual step that the person who performed it has forgotten. `tailscale serve` (§8) and the release keystore (§7.3) are both in this category.
- **Docker Compose v2 syntax (`docker compose`, no `version:` key).** Verified at M0 — the installed Docker Desktop runs Compose v2, and every command in the README uses the v2 spelling.

---

## 3. The Compose stack

Two services. No reverse proxy, no self-hosted Sentry, no pgAdmin, no Redis. Each of those would be defensible on a real deployment and each is dead weight here: TLS is handled by `tailscale serve` (§8), Sentry is hosted (§1.5), `psql` in the `db` container covers database inspection, and nothing in T2's surface caches.

| Service | Image | Ports | Volumes | Restart |
|---|---|---|---|---|
| `api` | built from `./api/Dockerfile` | `127.0.0.1:8080:8080` | none (stateless) | `unless-stopped` |
| `db` | `postgres:18-alpine` | `127.0.0.1:${POSTGRES_PORT}:5432` | `traverser_pgdata:/var/lib/postgresql` | `unless-stopped` |

> **Amended 2026-08-01 (M0):** three changes to the row above, all discovered while building it.
> **(1)** ⟨verify current major⟩ resolved — 18 is current; `postgres:19` does not exist.
> **(2)** ↯ **The mount point is `/var/lib/postgresql`, not `/var/lib/postgresql/data`.** The 18+
> official images moved `PGDATA` to a major-scoped subdirectory (`/var/lib/postgresql/18/docker`)
> so `pg_upgrade --link` can see two majors inside one mount. This spec's original path is the
> pre-18 convention every tutorial still shows, and using it makes the container refuse to start.
> **(3)** "none published" is not achievable alongside §5.1's host-run migrations — the row now
> publishes a **loopback-bound** port. §3.2 below is amended to match; §1.2 is unaffected.
> Compose v2 (§2) and the chiseled runtime tag (§3.3) were also confirmed at M0: `docker compose`
> v5.3.1, and `aspnet:10.0-noble-chiseled-extra` is the tag in use — see §3.5.

Notes that are load-bearing rather than incidental:

**3.1 The loopback bind is what makes §1.2 true.** `127.0.0.1:8080:8080`, not `8080:8080`. The bare form publishes on every host interface, which puts the API on the LAN and — depending on the host firewall — makes the tailnet layer decorative. This one string is the security boundary; it deserves a comment in the Compose file.

**3.2 `db` publishes no port at all.** The API reaches it over the Compose network by service name (`Host=db`). Publishing 5432 to the host is a habit worth breaking here: the only consumer that needs it is an occasional `psql` session, and `docker compose exec db psql -U traverser traverser` covers that without opening anything.

> **Amended 2026-08-01 (M0):** the reasoning holds, the conclusion does not. §5.1's chosen migration path is `dotnet ef database update` **from the host**, which needs a reachable Postgres, and the EF tooling cannot be run through `docker compose exec`. `db` therefore publishes `127.0.0.1:${POSTGRES_PORT}:5432` — loopback-bound, so §1.2's "nothing else on the LAN reaches it" is intact and verified. The habit this section warns against is publishing on `0.0.0.0` out of reflex; that remains forbidden for both services.

**3.3 ↯ .NET 10 container images are Ubuntu, and the Debian tags do not exist.** `mcr.microsoft.com/dotnet/sdk:10.0` and `mcr.microsoft.com/dotnet/aspnet:10.0` both resolve to **Ubuntu 24.04 "Noble Numbat"**, and **Debian images including `bookworm-slim` are not shipped for .NET 10 at all** — this is a documented .NET 10 breaking change. Nearly every .NET Dockerfile tutorial in circulation uses `-bookworm-slim`, so this will look like a typo and is not; a copied tutorial Dockerfile will fail to pull. The explicit-distro form is `10.0-noble`. A chiseled (distroless, non-root) runtime variant is available and preferable for the runtime stage ⟨verify the exact tag at M0⟩.

> **Amended 2026-08-01 (M0):** tag resolved, with a correction. The image is **`mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra`** — the `-extra` suffix matters. Plain `-noble-chiseled` omits ICU *and* tzdata, and Npgsql resolves time zones through `TimeZoneInfo` whenever it reads a `timestamptz`, which tech-01's schema is built on. Saving ~15 MB buys a `TimeZoneNotFoundException` thrown from inside a query instead of at startup. Confirmed distroless and non-root (UID 1654; `exec id` fails — there is no shell). Cosmetic side effect: Npgsql logs `Cannot load library libgssapi_krb5.so.2` per connection attempt, because chiseled ships no Kerberos libraries; SCRAM authentication succeeds regardless and there is nothing to fix.

**3.4 `restart: unless-stopped`, not `always`.** The difference matters given §1.1: `unless-stopped` brings the stack back when the PC boots but respects a deliberate `docker compose stop`. `always` would fight the intended workflow.

**3.5 The API image is a multi-stage build** — `sdk:10.0` restores and publishes, `aspnet:10.0` (or chiseled) runs — and the runtime stage runs as a non-root user. `ASPNETCORE_HTTP_PORTS=8080`; no HTTPS inside the container and no dev certificate, because §1.2 terminates TLS outside it. ↯ This is the inverse of the usual cloud instinct to make the app speak HTTPS end-to-end; here the hop from `tailscale serve` to the container is loopback on a single machine, and adding an in-container certificate would mean managing a cert the client never sees.

---

## 4. Configuration surface

Every key, in one place, so §11's migration is a file copy rather than an archaeology exercise.

### 4.1 Server (`.env`, gitignored; `.env.example` committed)

| Key | Consumed by | Notes |
|---|---|---|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `db` | The password is generated once and only ever exists in `.env` and the backup of `.env` (§10.5). |
| `ConnectionStrings__Traverser` | `api` | `Host=db;Port=5432;Database=…;Username=…;Password=…`. Duplicates the `POSTGRES_*` values; Compose interpolation (`${POSTGRES_USER}`) keeps them from drifting. |
| `Sentry__Dsn` | `api` | Empty is valid and disables capture — the dev loop must not require a Sentry account to run. |
| `Sentry__Environment` | `api` | `development` / `production`, so a local experiment does not pollute real issues. |
| `ASPNETCORE_ENVIRONMENT` | `api` | |

### 4.2 Client (`app.config.ts` → `expo-constants`)

`EXPO_PUBLIC_API_BASE_URL` is the whole surface, and it takes two values:

| Build | Value |
|---|---|
| Dev build on USB, PC awake at home | `http://<lan-ip>:8080/api/v1` — but see below |
| Release APK, anywhere | `https://<host>.<tailnet>.ts.net/api/v1` |

**Recommendation: use the tailnet HTTPS URL for both.** The LAN row exists because it is the obvious thing to reach for, and it is the wrong default: it reintroduces exactly the cleartext-exemption problem §1.2 bought its way out of, and it means the configuration exercised during development is not the configuration that ships. Since the phone is on the tailnet anyway, the tailnet URL works at home too. Keep the LAN form documented as a fallback for diagnosing whether a failure is Tailscale's or the API's, and treat needing it as a signal.

↯ **This value cannot live in a native file.** T4 §1.1 deletes `android/` on every prebuild, so `gradle.properties`, `AndroidManifest.xml`, and `build.gradle` are all unavailable as configuration homes. `app.config.ts` reading `process.env` is the mechanism; it is baked in **at build time**, which means changing the API host requires a rebuild, not a restart. That is a real constraint on §11's migration and is called out there.

---

## 5. Migrations, seeding, and content validation

**5.1 Migrations run as an explicit command.** `dotnet ef database update` from the host against the Compose Postgres, or a one-shot Compose profile (`docker compose run --rm migrate`) that runs the same thing inside the API image. Either is fine; pick one at M0 and put it in the README. What is not fine is calling `Migrate()` in `Program.cs` — §1.6.

**5.2 The API asserts the schema on startup and refuses to serve if it is wrong.** A cheap check that the applied-migrations set matches the assembly's expectation, failing the process with the missing migration named. This is the counterweight to 5.1: taking migrations out of startup is only safe if forgetting to run them is loud.

**5.3 Seeding is idempotent and versioned.** T1 §1 makes content (enemy stats, moves, items, gear, drop rates, `xp_curve`'s 60 precomputed rows) seeded Postgres data served as a versioned bundle. The seeder is therefore re-runnable, upserts by manifest ID, and bumps `content_version` when anything it wrote changed. T2 §2 negotiates API version and `content_version` independently, so a reseed must never look like an API break.

**5.4 The content-bundle validation pass lives here.** T5 §12 assigned it to "T6 or M0" and it lands in the seed step, running after the upserts and failing the seed loudly on any violation. The checks T5 named, plus the ones its reasoning implies:

- Every enemy has **at least one** `enemy_move` row. T5 §11.6 does not catch this, and the runtime symptom is a battle where the enemy silently never acts — a bug that looks like a balance problem.
- Every `enemy_move.weight` is **strictly positive**. A zero or negative weight corrupts T5 §5's weighted selection rather than merely skewing it.
- Every `enemy_drop_pool` row references an item or gear def that exists, and every drop rate is in `(0, 1]`.
- Every content row's manifest key exists in `traverser-data-manifest.md`, and every `xp_curve` level 1–60 is present exactly once.
- Every `gear_def.grants_move_id` that is set points at a real move, and — per `DECISIONS.md` 2026-07-26 (T5 correction) — is set only on Trinket-slot gear.

This is the server-side twin of T4 §9.2's build-time asset check. Between them, an ID that exists in one place and not the other fails either the build or the seed, never a battle.

> **Amended 2026-08-01 (M0):** "lands in the seed step" has no target — the seed ships as EF `HasData` inside a migration, so there is no seed step to hook. The six checks split by what each can express, and both halves fail before content reaches a device:
>
> - **Per-row facts become CHECK constraints**, failing when the migration is applied: `ck_enemy_move_ai_weight` (tightened from `between 0 and 100`, which permitted the exact value this section forbids), `ck_drop_rate_chance`, `ck_enemy_drop_pool_weight`, `ck_gear_def_grants_move_trinket_only`. Migration `20260801140924_ContentValidationConstraints`; all four applied against the seeded database with no violations, so they guard future edits rather than fixing present data.
> - **Facts spanning rows, tables, or files become tests** in `ContentValidationTests`: every enemy has a move, drop-pool rows resolve and are drawable, and the manifest cross-check.
>
> Two things this section's list left implicit and the implementation makes explicit. **`drop_rate.chance` excludes 0 as well as exceeding 1** — "never drops" is expressed by *omitting* the row (GDD 8 §5.2 gives wild encounters and the daily goal no `trinket` row at all), so a `0.0` row would be a second spelling of an absence that already carries meaning. And **`enemy_drop_pool.weight` needs the same strict positivity as `enemy_move.ai_weight`**, for the same reason: both feed a weighted draw, where 0 does not mean rare, it means absent.
>
> The manifest cross-check **parses `traverser-data-manifest.md`** rather than transcribing it, unlike the fixtures — the fixtures are a deliberate independent second copy, whereas a transcribed ID list would drift and start reporting its own mistakes as seed errors. It selects tables by shape (any seeded table keyed by a single string column), so it fails closed: a content table added later is covered without anyone remembering. Verified by mutation — renaming one seeded ID fails the test naming that ID.

---

## 6. The local dev loop

**6.1 The normal shape of a session.** `docker compose up -d` brings up `db` and `api`. For API work, stop the `api` service and run `dotnet watch` on the host against the containerised Postgres — the inner loop is a hot reload, not an image rebuild. For client work, the API stays in Compose and untouched. ↯ The cloud habit of rebuilding an image to test a change is the slow path; it belongs to the commit, not the edit.

**6.2 Client rebuild boundary — deferred to T4 §3.2, deliberately.** T4 already specifies exactly when Fast Refresh suffices and when `npx expo prebuild --clean && npx expo run:android` is mandatory, and T4 §11 rows 1–2 are the two traps. Restating it here would create a second copy to drift. The one item T6 adds: **`EXPO_PUBLIC_API_BASE_URL` is build-time (§4.2), so changing the API host is a rebuild, not a reload.** That belongs on T4 §3.2's list.

**6.3 Database inspection.** `docker compose exec db psql -U traverser traverser`. No GUI tool in the stack (§3).

**6.4 Resetting.** `docker compose down -v` destroys the volume and therefore the data. ↯ **From M1 on, this command is dangerous** — it is the fast path to losing real fitness history, and it is muscle memory from web work where the local database is always disposable. §10 is the mitigation; the discipline is to reset by dropping and reseeding the *content* tables rather than nuking the volume.

**6.5 Logs.** `docker compose logs -f api`. Note §1.5's point: from M1 this is *not* the primary error channel, because a failure that happens while Matthew is out walking will have scrolled past or been lost to a reboot by the time anyone looks. Sentry is the durable channel.

---

## 7. The Android install path

No EAS, no cloud build service, no Play Store account, no developer-program fee. Two artefacts.

**7.1 Development build — `npx expo run:android` over USB.** This is the documented local-build path (T4 §1.1), not a workaround. It compiles on Matthew's machine, installs to the connected device over ADB, and is the daily driver for M0–M4. Expo Go is permanently unusable here because `react-native-health-connect` needs a native build (T4 §1.1).

**7.2 Release build — a signed APK, sideloaded.** `npx expo run:android --variant release` (flag spelling verified against the SDK 57 CLI's own help at M0 — DECISIONS 2026-08-01), or `./gradlew assembleRelease` inside the generated `android/`. An **APK**, not an AAB: AAB exists for Play Store delivery and cannot be installed directly. Transfer over USB (`adb install -r`) and install. This is what M5's "installable on my phone as a daily-use app" means.

**7.3 The release keystore is a permanent artefact and losing it is destructive.** This is the section that matters, and it is a consequence of T4 §1.1 that no prior spec states.

Android will only update-install an APK over an existing one when both are signed by the same key. A different key means the install is refused and the only way forward is uninstall-then-install — and per T4 §6.5 / `DECISIONS.md` 2026-07-26, **uninstall destroys `player_id` and the bearer token with no recovery path to the server-side profile.** So the signing identity has to be stable across every release build for the life of the app.

The trap: prebuild generates a *debug* keystore, and `npx expo prebuild --clean` regenerates it. Anything signed with the generated keystore has an identity that silently changes the next time the native project is rebuilt from scratch. Therefore:

- Generate one release keystore at M0 with `keytool`, store it **outside `android/`** (which is gitignored and deleted by prebuild) — repo root, gitignored, e.g. `traverser-release.keystore`.
- Passwords come from the environment, never from a committed file.
- Wire the signing config through a **local Expo config plugin** ⟨verify the plugin API surface at M0⟩ that injects the release `signingConfig` during prebuild, pointing at the out-of-tree keystore path. A hand-edit to `android/app/build.gradle` is deleted by the next prebuild — T4 §11 row 2.
- **The keystore and its passwords are part of the backup set (§10.5), not an afterthought.** Losing the keystore means the next release cannot be installed over the current one, which means an uninstall, which means data loss.

> **Amended 2026-08-01 (M0):** done, and the ⟨verify⟩ is resolved — **`withAppBuildGradle` from `expo/config-plugins`**, in `app/plugins/withReleaseSigning.ts`, appending a marker-guarded Groovy block rather than regex-editing the template's `signingConfigs {}` (which would break on any upgrade that reformats it). The block calls `android.signingConfigs.create(...)` and reassigns `android.buildTypes.release.signingConfig`; the marker makes a prebuild without `--clean` idempotent.
>
> This section describes the trap accurately but understates it. The generated `android/app/build.gradle` contains, verbatim, **`release { signingConfig signingConfigs.debug }`** under the template's own *"Caution! In production, you need to generate your own keystore file"* comment. The default is not "unsigned until you configure it" — it is *silently signed with the throwaway key that prebuild regenerates*. So the plugin's job is to override a working-looking default, and its absence is invisible until an update-install is refused months later. The injected block therefore **throws** if a release task is requested without the keystore properties, instead of falling back.
>
> Two corrections to the bullets. **"Passwords come from the environment"** became `~/.gradle/gradle.properties` — Gradle reads project properties from there *and* from `ORG_GRADLE_PROJECT_*` env vars, so both work, but the file is the persistent default because a missing shell export fails by producing a wrongly-signed APK rather than an error. And **the backup set gains two members, not one**: the keystore and that properties file are useless apart, so §10.5's row should name both.
>
> ↯ **PKCS12 keystores have no separate key password.** `keytool` warns and reuses the store password, so `TRAVERSER_KEY_PASSWORD` equals `TRAVERSER_KEYSTORE_PASSWORD` by necessity. Setting them to different values yields a keystore Gradle cannot open with the credentials you believe you configured.

**7.4 No over-the-air updates.** T4 §15 defers `expo-updates` — there is no distribution channel to update through. Every change reaches the phone as a rebuild over USB.

---

## 8. Remote reachability — Tailscale

The requirement is narrow: the phone must be able to sync while Matthew is out walking, not just on the home Wi-Fi. Everything below was confirmed against current Tailscale documentation this session.

**8.1 The plan is free and comfortably sized.** The **Personal plan** covers 6 users, unlimited user devices, and 50 tagged devices, at no cost and with no card. This project needs one user and two devices — the PC and the phone. ✅ $0, with roughly an order of magnitude of headroom in every dimension.

**8.2 Topology.** One tailnet. Tailscale client on the Windows host, Tailscale on the Android phone, both signed into the same account. **MagicDNS on**, so the host has a stable name instead of a `100.x.y.z` address that would end up hardcoded in a build. **HTTPS certificates enabled** in the admin console's DNS settings — this is a prerequisite for §8.3.

> **Amended 2026-08-01 (M0):** there are **three** admin-console prerequisites, not two. Alongside MagicDNS and HTTPS certificates, **Serve must be enabled for the tailnet** — a separate, node-scoped consent step this section did not know about. Until it is, §8.3's command does not fail: it *blocks*, printing `Serve is not enabled on your tailnet` with a `https://login.tailscale.com/f/serve?node=…` link, and waits indefinitely for the toggle. Worth knowing, because a command that hangs reads as a network problem rather than a missing permission.
>
> §8.2's "name the host something uninteresting" mitigation was **acted on before enabling HTTPS, not after**, and the ordering is the whole point — a CT-log entry cannot be withdrawn, so renaming afterwards leaves the old name published forever. `tailscale set --hostname <name>` does it from the CLI without the admin console and takes effect immediately. Doing this *first* also avoids a second cost: the MagicDNS name is the client's base URL, and §4.2 makes that build-time, so a later rename is a rebuild and a reinstall.

Worth stating rather than clicking past: enabling HTTPS requires acknowledging that **machine names and the tailnet DNS name are published to a public certificate-transparency ledger**. That is inherent to Let's Encrypt, not a Tailscale quirk. The practical consequence is that the *existence* of a host with a given name becomes public information; the service itself remains unreachable outside the tailnet, and no data is exposed. Naming the host something uninteresting is the whole mitigation.

**8.3 The one command that makes the API reachable.** In an **Administrator** terminal on the Windows host:

```
tailscale serve --bg --https=443 http://127.0.0.1:8080
```

`--bg` is not optional garnish: **without it, Serve runs in the foreground and stops when the terminal closes, and needs manual restarting after every reboot or `tailscale up`.** With it, Serve persists and resumes automatically after a reboot or a Tailscale restart — which, given §1.1's power cycles, is the difference between a working deployment and a puzzling one. Verify with `tailscale serve status` (`--json` for machine-readable); tear down with `tailscale serve off`.

Tailscale provisions the Let's Encrypt certificate for the MagicDNS name automatically as part of this flow, handling the DNS-01 challenge itself; `tailscale cert` is the manual equivalent if a certificate is ever needed directly. The client's base URL is then `https://<host>.<tailnet>.ts.net/api/v1` (§4.2).

**8.4 ↯ Android-side realities that have no web analogue.**

- **Tailscale on Android is a VPN service, and Android permits exactly one active VPN at a time.** If anything else on the phone holds the VPN slot, the tailnet is down and sync cannot happen. There is no way around this at the OS level.
- **Doze and battery optimisation can drop the tunnel** while the phone is idle in a pocket, which is exactly when a walk is happening.

Both of these would be serious problems for an app that needed a live connection. Here they are non-events, and the reason is architectural rather than lucky: T2 §1.2 makes the API unreachable the normal case, T4 §8.1 makes the client treat that as success, and T3's high-water-mark deltas mean nothing is lost by syncing later. **The mitigation is the existing offline design, and this spec adds no retry logic, no connectivity monitoring, and no user-facing "not connected" state.** Adding any of them would be a regression against T4 §14. If a walk's steps arrive at the next foreground instead of during the walk, the system is working as specified.

**8.5 Alternatives, and why not.**

| Rejected | Reason |
|---|---|
| Router port-forward + dynamic DNS | Puts the API on the public internet, needs router configuration Matthew may not control, and makes the bearer token (T2 §1.4) the only thing between the internet and the fitness history. |
| Tailscale **Funnel** | Also public exposure. Solves a problem this project does not have. |
| ngrok / Cloudflare Tunnel free tiers | Ephemeral URLs on the free tier (a build-time base URL, §4.2, cannot chase a changing hostname), or an account plus a domain. Both add a third-party in the data path for no gain over the tailnet. |
| Self-hosted WireGuard | Tailscale *is* WireGuard with the key distribution and NAT traversal already solved. Doing it manually reintroduces the port-forward. |

---

## 9. Observability

**9.1 Two Sentry projects, one free-tier org** (§1.5). `traverser-app` for `@sentry/react-native`, `traverser-api` for `Sentry.AspNetCore`. Separate DSNs so a client crash and a server exception are never in the same triage queue.

**9.2 What the server captures.** Unhandled exceptions, and explicitly the ones the client cannot report: failures inside `POST /api/v1/sync`, seed/validation failures (§5.4), and migration assertion failures (§5.2). `Sentry__Environment` separates dev noise from real issues.

**9.3 What is deliberately not instrumented.** No performance tracing, no custom event pipeline, no `POST /events` — the analytics trim stands, and GDD 15's Sentry-only recommendation is the whole of it. No request body is attached to an event: sync payloads contain step counts and heart-rate minutes, which is health data, and it does not leave the tailnet. **PII and request-body capture must be explicitly disabled**, not left at whatever the SDK defaults to. ⟨verify the relevant `Sentry.AspNetCore` option names at M0.⟩

> **Amended 2026-08-01 (M0):** §9.3's ⟨verify⟩ is resolved. On `Sentry.AspNetCore` the two options are **`SendDefaultPii = false`** (request URL, headers, IP, user identity) and **`MaxRequestBodySize = RequestSize.None`** from `Sentry.Extensibility` (the body itself, and gated behind `SendDefaultPii` besides). Both are already the SDK defaults; both are set explicitly, because "we rely on the default" is not a decision that survives an SDK upgrade. `TracesSampleRate = 0.0` covers the no-tracing half. The client equivalents on `@sentry/react-native` 7.11.0 are `sendDefaultPii`, `attachScreenshot`, `attachViewHierarchy`, `tracesSampleRate`, and `profilesSampleRate`, all verified against the installed typings.
>
> Two additions this section did not anticipate:
>
> - **`enableCaptureFailedRequests: false` on the client**, for a reason that is architectural rather than privacy. T2 §1.2 makes an unreachable API the normal case and T4 §8.1 makes the client treat it as success — so a failed request here is the design working, not an incident. Left on, it would fill a free-tier quota with events describing correct behaviour and bury the real ones. This is the client-side twin of §9.4's "the API being down is not an incident."
> - **§9.2's migration-assertion capture needs an explicit `SentrySdk.CaptureException` and `FlushAsync`.** Sentry's ASP.NET Core integration reports unhandled exceptions from the *request pipeline*; the §5.2 assertion throws during startup, before a pipeline exists. Left to the integration, the one server failure this section names would be the only one that never arrives, and the process would exit before the background sender flushed.

**9.4 No alerting.** §1.1. The API being down is not an incident.

---

## 10. Backups — non-negotiable from M1

This database holds real, unreproducible fitness history. Health Connect retains roughly 30 days on the device that was spiked (`DECISIONS.md` 2026-07-26), so beyond that window **the Postgres row is the only copy of a given day's steps that exists anywhere**. That single fact is why §1.3 rejected a hosting option whose free tier excludes backups.

**10.1 The thing that makes this two problems instead of one.** T4 §6.5 established that uninstall destroys `player_id` and the bearer token with no path back to the server-side profile. Follow that through: a perfect Postgres backup, restored onto new hardware, is a database full of history that **no client can claim**, because the identity needed to claim it lived only in app storage on a phone. A backup plan covering only Postgres is a plan that restores data nobody can reach. So the backup set is Postgres **and** the device identity (§10.5), and the gap in the second is flagged as an open item (§13.1).

**10.2 Mechanism.** `pg_dump -Fc` — the custom format, because it is compressed and `pg_restore` can select individual objects out of it, which matters on the day the goal is "recover yesterday's `activity_day` rows" rather than "recreate the whole database".

```
docker compose exec -T db pg_dump -U traverser -Fc traverser > traverser-YYYYMMDD-HHMM.dump
```

Written to a local folder **and** to a folder an existing OneDrive/Google Drive client already syncs. That gives an off-machine copy for $0 with no new account and no new service — and off-machine is the copy that matters, because a dead PC or a failed drive controller takes every same-machine copy with it. The database is small enough (single player, sixty levels, a few years of daily rows) that both copies are trivial against any consumer cloud quota.

**10.3 Schedule, adapted to a machine that is off.** A plain nightly task does not fit §1.1 — the PC is frequently asleep at 3am. Instead: a Windows Task Scheduler task with **both** a daily trigger and an at-startup trigger, configured to run if the scheduled start was missed. The effect is "at most one dump per day, taken the next time the machine is awake". ⟨Decide at M0 whether this is a Task Scheduler task on the host or a sidecar container with the same catch-up semantics; the host task is simpler and has fewer ways to silently not run.⟩

**10.4 Retention:** 7 daily, 4 weekly, 12 monthly, oldest pruned by the same script. The sizing is not about disk — the dumps are tiny — it is about the recovery *window*. A bad seed or a bug that corrupts progression may not be noticed for weeks, and a 7-day-only history would have already overwritten the last good copy.

**10.5 The full backup set.** Everything needed to reconstitute the deployment, not just the data:

| Artefact | Where | Why |
|---|---|---|
| `pg_dump -Fc` output | local + cloud-synced folder | The fitness history. |
| `.env` | cloud-synced folder, outside the repo | Contains the Postgres password. A dump you cannot authenticate against is not a restore. |
| Release keystore + its passwords | cloud-synced folder, outside the repo | §7.3 — losing it forces an uninstall, which destroys the device identity. |
| Device `player_id` + bearer token | **unresolved — §13.1** | §10.1. Without this the restore has no claimant. |

**10.6 The restore drill, because an untested backup is not a backup.**

```
docker compose exec -T db createdb -U traverser traverser_restore_test
docker compose exec -T db pg_restore -U traverser -d traverser_restore_test --clean --if-exists < traverser-YYYYMMDD-HHMM.dump
```

Then a spot-check query — a known `activity_day` row, the player's level, the `xp_curve` row count — and `dropdb`. **Run this once at M1, immediately after the first real step sync, and again at M5.** The M1 drill is the important one: it is the moment the backup stops being hypothetical, and the cheapest possible time to discover that the dump command has a typo in it.

**10.7 M1, not M5.** M0 contains no real data and nothing worth protecting. The first genuine step sync is the moment this section becomes mandatory, and it should be in place *before* that sync, not after it.

---

## 11. Moving Compose to dedicated home-lab hardware

Short by intention — this is a note for a decision to be made at **M5**, not a plan to execute now.

**11.1 What makes the move cheap.** If T6 is built as specified, the entire deployment is: `docker-compose.yml`, `.env`, one named volume, one `tailscale serve` invocation, and the API image's Dockerfile. That is the complete inventory. The migration is correspondingly dull:

1. `pg_dump -Fc` on the old host (§10.2) — the backup that already runs nightly is the migration tool.
2. Install Docker and Tailscale on the new host; join the same tailnet.
3. Copy the repo and `.env`; `docker compose up -d`; run migrations (§5.1); `pg_restore` the dump.
4. `tailscale serve --bg --https=443 http://127.0.0.1:8080` on the new host — a new MagicDNS name, and therefore a new certificate, provisioned automatically.
5. Update `EXPO_PUBLIC_API_BASE_URL` and **rebuild the APK** (§4.2 — the base URL is build-time, so this step is a rebuild and a sideload, not a config edit). Sign it with the same keystore (§7.3) so the install is an update, not an uninstall.
6. Retire `tailscale serve` on the old host and remove it from the tailnet.

Step 5 is the only genuinely annoying part, and it is annoying because of an Android build-time constraint rather than anything in this spec. If it becomes a recurring irritation, the fix is a stable MagicDNS name that follows the service rather than the machine — Tailscale Services can advertise a service-level endpoint independent of which host backs it ⟨verify plan availability and setup at the time⟩ — which would make future host moves invisible to the client entirely. Not worth setting up for one migration.

**11.2 What would make it expensive, and is therefore avoided now.** Host-absolute paths in the Compose file (use relative paths and named volumes). Windows-specific scripting anywhere in the critical path — §10.3's Task Scheduler task is the one exception, and it is deliberately a thin wrapper around a portable `pg_dump` command line, so a Linux host replaces it with a cron entry and changes nothing else. Anything baked into the image that should be configuration (§4). Data living anywhere but the named volume.

**11.3 The trigger to watch for.** The scheduled decision point is M5. The one thing that would justify pulling it earlier is wanting the API reachable while the desktop is off — which is a different requirement from the one §8 solves, and would show up as walks routinely syncing a day late rather than during the walk. Until that is an actual annoyance rather than an anticipated one, the desktop is sufficient and §1.1 stands.

---

## 12. The $0 ledger

Every external dependency, its free-tier limit, and this project's usage against it. A line without a stated limit is not finished.

| Dependency | Free tier | This project's usage |
|---|---|---|
| Tailscale | Personal plan: 6 users, unlimited user devices, 50 tagged devices. No card. | 1 user, 2 devices, 0 tagged. |
| Let's Encrypt (via Tailscale) | Free, unlimited, automated. | 1 certificate, auto-renewed. |
| Sentry | Free developer tier — the one account/key in the stack (§1.5). Self-hostable via Docker as the escape hatch (GDD 15 §5.2). | Single-player error volume. Effectively zero against any event quota. |
| Docker Desktop | Free for personal use and small business. | One host, personal use. ⟨Re-read the licence terms if this ever becomes commercial.⟩ |
| Postgres, .NET 10, Expo, React Native | Open source. | — |
| Local Android builds | `expo run:android` is free; no EAS, no Play Store account, no $25 developer fee. | Local builds only (§7). |
| OneDrive / Google Drive | Existing personal quota, already paid-for-or-free. | Dumps measured in megabytes. |

**Recurring cost: $0.** No card is on file with any service in this table. The only paid-adjacent item is host hardware, which is already owned and re-decided at M5 (§11).

---

## 13. Cross-spec flags

- **T2 (API & Sync) — both obligations met.** T2 §7 asked that health checks and alerting not treat an unreachable API as an outage (§1.1: none exist) and that "Tailscale reachability is what makes §1.4's token load-bearing rather than ceremonial" (§8: the API is on the tailnet, so the token is now the real access control on a real remote write surface). T2 §1.2's premise is preserved, not softened.
- **T4 (Client) — one addition to T4 §3.2's rebuild-boundary list.** `EXPO_PUBLIC_API_BASE_URL` is build-time (§4.2), so changing the API host is a prebuild-and-rebuild, not a reload. T6 also names a consequence of T4 §1.1 that T4 does not: the generated debug keystore is regenerated by `prebuild --clean`, which makes a stable out-of-tree **release** keystore mandatory rather than good practice (§7.3), because a signing-identity change forces an uninstall and T4 §6.5 makes uninstall unrecoverable.
- **T5 (Battle Engine) — T5 §12's content-bundle validation is placed.** It runs in the seed step, §5.4, with T5's two named checks plus four the same reasoning implies. T5 §11.6's blind spot (an enemy with no move rows) now fails the seed instead of producing a silent no-op enemy.
- **T1 (Data Model):** no schema change. §5.3 assumes T1 §1's seeded-content-as-versioned-bundle design and §5.4 validates against `traverser-data-manifest.md`; T6 introduces no tables and no IDs.
- **GDD 15 (Analytics):** §1.5 adopts GDD 15 §5.2's recommendation and extends it to the server tier. The analytics trim is unchanged — crash/error only, no event pipeline, no health or gameplay data through Sentry (§9.3).
- **M0 (Scaffolding):** this doc's primary consumer. M0 owes the Dockerfile, `docker-compose.yml`, `.env.example`, the migration/seed commands, §5.4's validation pass, the release keystore and its config plugin, the `tailscale serve` setup, and the README that records the manual host steps.
- **M1 (The Walk):** **§10 becomes mandatory before the first real step sync, not after it.** The M1 restore drill (§10.6) is a checklist item, not an aspiration.
- **M5 (The Song):** the home-lab decision (§11) and the second restore drill.
- **Manifest:** T6 adds no content IDs, but §5.4 makes the manifest load-bearing at seed time in the same way T4 §9.2 made it load-bearing at build time. The two ID families flagged on 2026-07-25 and escalated by T4 (six `gate_*` keys, twelve concrete `gear_{slot}_{tier}` keys) block the seed as well as the build.

### 13.1 ~~Open~~ **Decided 2026-07-26**: recovering the device identity after an uninstall

> **Resolution: candidate 1 adopted** — the manual export/import path, built at **M1 alongside the backup job** (`DECISIONS.md` 2026-07-26). The analysis below is retained as the record of why.

**The conflict.** §10 makes the Postgres backup non-negotiable, and §10.1 shows that a Postgres backup alone is not restorable-to: `player_id` and the bearer token live only in app storage (T4 §6.5), so losing the phone, wiping it, or being forced into an uninstall by a keystore change (§7.3) leaves a complete history with no client able to claim it. T4 §15 defers "account recovery after uninstall" to real auth, which is the right call for a *feature*; but the backup requirement makes it a gap in T6's deliverable *now*, because a backup plan with an unclaimable restore is incomplete regardless of what the roadmap says.

**Candidates.**
1. **Manual export/import.** A Settings screen that displays or exports `player_id` and the token; a first-launch "restore from backup" path that accepts them instead of registering. Cheapest, and it slots into the backup set (§10.5) as a file. Weakness: it only helps if it was used *before* the loss.
2. **Recovery code.** The server issues a short human-transcribable code at registration that re-mints a token for an existing `player_id`. More robust and more ceremony; a new endpoint, and it edges toward the auth flows the guest-only trim excludes.
3. **Accept the loss.** Document that a device loss ends the run. Consistent with the trim and with T4 §15, and incompatible with §10 being described as non-negotiable.

**Recommendation for M-phase:** candidate 1, implemented at **M1** alongside the backup job, not deferred to M5. It is a screen, a file, and a branch in the registration path — small enough that it costs less than the argument about whether to build it, and it is the only candidate that makes §10's restore story actually complete. Candidate 2 arrives naturally with real auth (T2 §8) and should not be built before it.

Logged here rather than decided silently, per T4 §10.5's precedent.

---

## 14. ↯ Divergences from web/cloud deployment habits

| # | The habit that transfers wrong | What is true here | § |
|---|---|---|---|
| 1 | Uptime monitoring and alerting are baseline hygiene | The host is off by design; alerts would fire nightly and mean nothing | 1.1 |
| 2 | A managed database free tier is the obvious $0 choice | Inactivity-pause and no-backups terms both fail this project outright | 1.3 |
| 3 | Terminate TLS at the app, end to end | TLS terminates at `tailscale serve`; the container hop is loopback and needs no cert | 3.5 |
| 4 | Plain HTTP is fine on a private network | Android blocks cleartext by default, and `android/` is generated — the exemption would be a permanent config plugin | 1.2 |
| 5 | `docker-compose` publishes `8080:8080` | That is every interface, including the LAN; the loopback bind *is* the security boundary | 3.1 |
| 6 | Migrate on application startup | A machine that sleeps mid-migration leaves a half-applied schema on the only copy of the fitness history | 1.6 |
| 7 | `docker compose down -v` to get a clean slate | From M1 that command destroys unreproducible personal health data | 6.4 |
| 8 | `-bookworm-slim` is the standard .NET runtime tag | Debian images are not shipped for .NET 10 at all; the images are Ubuntu Noble | 3.3 |
| 9 | Signing keys are a release-engineering detail | A changed signing key forces an uninstall, and uninstall destroys the only copy of the device identity | 7.3 |
| 10 | A VPN client just runs in the background | Android allows one active VPN at a time and Doze can drop it — harmless here only because the client treats unreachable as success | 8.4 |
| 11 | Container logs are where you look when something breaks | The failure happens while nobody is watching and the host reboots; Sentry is the durable channel | 6.5, 1.5 |
| 12 | Nightly cron is a reliable schedule | The machine is asleep at 3am; the backup trigger needs catch-up-on-boot semantics | 10.3 |

---

## 15. Deferred by design

| Deferred | Why / how it lands |
|---|---|
| CI/CD | One developer, one machine, no deploy target but localhost. A GitHub Actions workflow running `dotnet test` and the T4/T5 formula tests is the first thing worth adding, and costs nothing to add later. |
| Self-hosted Sentry | Free tier is generous past any volume this project will reach (§12). GDD 15 §5.2's escape hatch, unchanged: it self-hosts via Docker into whatever §11 becomes. |
| A reverse proxy (nginx/Caddy/Traefik) | `tailscale serve` is the reverse proxy and the TLS terminator (§1.2). A second one would exist to route a single upstream. |
| Uptime monitoring, alerting, status pages | §1.1. The API being down is the normal case. |
| Postgres replication, PITR, WAL archiving | §10's dump-and-retain covers the actual risk (device loss, disk failure, a bad seed) for a single-player database. Replication protects availability, which §1.1 says is not a goal. |
| Log aggregation | `docker compose logs` plus Sentry. One host, one service. |
| Play Store / AAB distribution | Sanctioned trim: no store account, sideload only (§7.2). |
| Over-the-air updates | T4 §15 — no distribution channel to update through. |
| Tailscale ACLs, tags, device approval | Two devices, one user. The default "users can access their own devices" policy is exactly the intended posture. Worth revisiting only when §11's host is shared with other services. |
| Multi-device sync | T2 §1.5, GDD 11 §11. Unrelated to deployment; noted so a second tailnet device is not mistaken for support for it. |
| Secrets management beyond `.env` | One host, one operator, gitignored file, backed up per §10.5. A vault would add a dependency and no security. |
