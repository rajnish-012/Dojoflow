# DojoFlow Production Readiness Review

**Review date:** 5 October 2026  
**Scope:** Static review of the checked-out client, server, configuration, and repository documentation. No application files were changed as part of the review. No build, tests, live API checks, dependency audit, or deployment inspection was performed.  
**Overall assessment:** **Not yet production ready.** The project has broad feature coverage and useful security foundations, but it does not yet have the verification, operational controls, and release evidence needed to claim production readiness.

## Executive summary

The application is a substantial multi-branch academy management system, not the small demo described by parts of its README. It includes public marketing/inquiry pages, student and staff management, dynamic roles/permissions, schedules, attendance, performance, makeups, reports, holidays, promotions, and settings. The backend generally places authentication and database-backed permission checks on management routes, and branch/coach access checks exist in several data flows.

The principal release blockers are:

1. **No visible automated quality gate:** package scripts expose frontend lint/build and server start/dev only; the repository has no checked-in test suite, CI workflow, or release gate. Authorization and scheduling logic need regression coverage before release.
2. **Incomplete production operations:** no deployment/runbook/backup/restore/monitoring evidence is present. `/api/health` is a process-only response and cannot tell an orchestrator whether MongoDB is ready.
3. **Public form abuse and reliability:** public inquiry creation has validation, but no endpoint-specific throttling or bot/spam control. Email is an external side effect attached to this flow and needs operational retry/alert visibility.
4. **Multi-document consistency:** student/account changes and related records are written in separate operations without a transaction; failures can leave profile, login, branch, or assignment state inconsistent.
5. **Security hardening and assurance:** password minimum is six characters in the inspected password-change flow; cookie sessions need explicit cross-origin deployment/CSRF verification; no dependency/security scanning or security test evidence is checked in.
6. **Product and documentation polish:** `ForceStrike` appears in client/server branding while the repository and README call the product DojoFlow. The README calls the app a demo, understates actual features, and lacks an accurate current deployment/operations guide.

This review is not a claim that every feature is broken. It is a prioritized list of evidenced risks and the work required to demonstrate that the whole product is reliable in a real academy environment.

## Findings

### P0 — Must resolve before a production launch

| Finding | Evidence and impact | Required work |
|---|---|---|
| No automated verification/release gate | `client/package.json` provides `lint` and `build`; `server/package.json` provides only `start` and `dev`. No test/spec files or `.github` workflow were found. Role/branch isolation, cookie auth, billing-adjacent data, and date-sensitive scheduling have high regression cost. | Add unit/integration coverage for auth, permissions, cross-branch isolation, student lifecycle, attendance uniqueness, schedules, and public inquiry validation. Add CI for install, lint, typecheck/build, server tests, and dependency/security checks; require green checks for release. |
| Health check does not represent service readiness | `server/server.js` `/api/health` returns success without checking Mongo connectivity or required configuration. A deployment platform could route traffic to a process whose database is unavailable. | Split liveness from readiness; readiness should fail when Mongo is disconnected or initialization is incomplete. Add graceful shutdown, connection lifecycle handling, and deployment health-check instructions. |
| No evidenced backup/restore or recovery process | Maintenance endpoints exist, but the repository contains no documented database backup/restore procedure, recovery objectives, or verified restore evidence. Academy records and contact information are business-critical. | Configure automated encrypted Mongo backups, retention and access policy; define RPO/RTO; rehearse restore into an isolated environment and document the runbook. Confirm what the maintenance “backup/restore” permissions actually do before exposing them operationally. |
| Public inquiry route has no route-specific anti-abuse protection | `server/src/routes/inquiry.routes.js` exposes `POST /` publicly. General API throttling in `server/server.js` is 300 requests/minute/IP; login has its own tighter production-only limit. A public form can therefore be abused for spam, database growth, and email volume. | Add a dedicated stricter inquiry limiter, request size/field bounds, bot/spam defense appropriate to the deployment, and alerting/retention controls. Ensure email volume is bounded and failures are observable. |
| Sensitive multi-document workflows are not atomic | `student.controller.js` changes a Student and linked User separately, and performs other linked writes in separate operations (for example, branch synchronization and deactivation/coach assignment cleanup). A process or DB error between writes can leave access/profile state out of sync. | Use Mongo transactions where deployment topology supports them, or implement explicit compensating actions and consistency checks. Cover partial-failure cases with integration tests. Audit all related write flows, not just student updates. |

### P1 — Resolve before broad/paid use

| Finding | Evidence and impact | Required work |
|---|---|---|
| Password policy is weak for production accounts | `server/src/controllers/auth.controller.js` accepts a new password with a minimum length of six. Staff and students share account access to personal data. | Adopt a stronger length-based password policy, validate consistently at account creation/change/reset, provide secure reset/invite flows, and review bcrypt cost against production hardware. Avoid arbitrary composition rules unless supported by policy. |
| Cross-origin cookie session behavior needs deployment proof | `auth.controller.js` issues an HttpOnly cookie; production uses `SameSite=None` and `Secure`. `server.js` checks `Origin` only when it is present for unsafe requests. This depends on correct HTTPS, exact `CLIENT_URL`, proxy behavior, and browser cookie policy. | Prefer same-site frontend/API origins where possible. Verify CSRF protection for every unsafe cookie-authenticated route, reject missing/untrusted origins as appropriate for browser requests, set trusted proxy configuration deliberately, and test login/logout/expiry across supported browsers and production domains. |
| Environment configuration is under-validated | `server/.env.example` documents only `PORT`, `MONGO_URI`, `JWT_SECRET`, while source also relies on `CLIENT_URL`, `NODE_ENV`, email settings/encryption behavior, and frontend `NEXT_PUBLIC_API_URL`. Missing values can silently fall back to localhost or disable production-only controls. | Add startup schema validation with clear fatal errors for missing/weak production values. Document each variable, its source, rotation impact, and which environments need it. Remove localhost fallback from production builds or fail deployment when the API URL is absent. |
| Production error handling and observability are basic | `server.js` logs raw errors with `console.error`; there is no structured logger, request correlation ID, centralized metrics, alerting, or audit trail visible. The generic health response gives no operational diagnosis. | Add structured, redacted logs and request IDs; never log passwords, tokens, SMTP credentials, or sensitive inquiry payloads. Add error reporting, service/database metrics, alert thresholds, and audit records for high-impact admin actions. |
| No pagination contract is guaranteed across all large collections | Student listing supports bounded pagination, but the product now has many list/report APIs and the review did not establish that every collection endpoint paginates and caps query work. Unbounded collections become slow and expensive as academies grow. | Audit every list/report endpoint for pagination, maximum page size, stable sorting, indexed filters, query timeouts, and branch scope before database aggregation. Add realistic-volume performance checks. |
| Personal data lifecycle/privacy controls are undocumented | Students, staff, inquiries, contact data, and training history are stored. The repository does not describe retention, deletion/export requests, consent, access audit, or incident response. Applicable obligations depend on the launch geography and customer type. | Define data classification, retention/deletion and export procedures, privacy notice/consent, access auditing, incident response, and processor/vendor terms for the actual operating jurisdictions. Get a qualified review for legal obligations. |
| Frontend authentication failures collapse to signed-out state | `client/hooks/userAuth.ts` treats any `/auth/me` failure as unauthenticated, including server/network errors. This can misleadingly log users out during an outage and provides little recovery feedback. | Distinguish 401 from transient/network/5xx errors; show a recoverable service error and retry path while avoiding stale privileged content. Add session expiry and outage behavior tests. |

### P2 — Professional completeness and maintainability

| Finding | Evidence and impact | Required work |
|---|---|---|
| Product identity is inconsistent | `client/app/layout.tsx`, `client/hooks/userAuth.ts`, and server startup messages contain “ForceStrike”; the repository and user-facing project name are DojoFlow. | Decide the shipping product name and update metadata, page titles, app labels, server logs, legacy migration identifiers, and screenshots consistently. Preserve legacy token migration behavior deliberately if it is still needed. |
| README does not describe the current application | README structure/API/feature lists omit many current modules and still calls this a project/demo at line 899, although the repository contains schedules, CMS, roles, reports, inquiries, promotions, makeups, and maintenance. Setup/deployment guidance is local-development focused. | Rewrite setup and feature documentation from the current routes and UI. Add a production deployment guide, env reference, first-admin provisioning, migrations, backup/recovery, troubleshooting, and supported-browser/accessibility notes. Remove claims that are no longer true. |
| API contract is undocumented | No OpenAPI/Swagger or equivalent checked-in contract was found. The client and server use many hand-maintained request/response shapes. | Publish an API schema (including auth, permissions, validation, errors, pagination, and public endpoints) and generate or validate client types against it. |
| Migrations are manual scripts without a visible release process | `server/scripts` contains multiple migration/backfill scripts. No documented ordering, dry-run, backup prerequisite, idempotency guarantee, or deployment integration was found. | Add a migration inventory and runbook; make scripts idempotent, observable, safe to rerun, and tested on a copy of production-like data. Run migrations as a controlled release step rather than implicitly at web startup. |
| Accessibility and UX assurance is unproven | A substantial custom UI exists, but no automated accessibility checks or keyboard/screen-reader review evidence was found. | Audit keyboard navigation, labels, focus handling, contrast, motion preferences, responsive tables/forms, and validation announcements. Add accessibility checks to CI and manual acceptance criteria. |
| Demo/test route and placeholder assets need a release sweep | `client/app/ui-test/page.tsx` and starter assets such as `next.svg`, `vercel.svg`, and `globe.svg` are present. Their exposure may be intentional, but production routes and public assets should be reviewed. | Decide whether `/ui-test` is internal-only or remove/guard it; remove unused starter assets and ensure no debug/test endpoints or sample credentials are shipped. |

## Positive foundations observed

- Frontend/backend split with TypeScript client and Express/Mongoose API.
- Backend permission middleware resolves current permissions from database roles rather than trusting the client-provided role snapshot.
- Most management routes reviewed explicitly combine authentication and permission checks; public routes are visibly separated in several route files.
- Student data helpers implement branch scope and coach assignment checks in key student access paths.
- Session JWT is stored in an HttpOnly cookie; client API helper removes legacy Authorization headers and uses credentialed fetch.
- CORS uses an explicit configured origin list; Helmet, request-body limits, general API throttling, and login throttling are present.
- Local `server/.env` and `client/.env.local` are ignored and not tracked in Git according to the repository checks; their contents were not opened.
- Sensitive SMTP password storage is described as encrypted in the README, and the corresponding service/controller files exist. Key rotation and failure recovery still need operational documentation and verification.

These are useful building blocks, not substitutes for integration tests or production configuration review.

## Recommended completion sequence

### Gate 1 — Establish release confidence

1. Add CI, lint/typecheck/build, server unit/integration tests, and security/dependency scans.
2. Prove role and branch isolation for every list/detail/write/export endpoint, including coach assignments and student self-service.
3. Add route-specific public inquiry abuse controls and stronger account/password lifecycle policy.
4. Make readiness depend on MongoDB and implement graceful shutdown.
5. Make linked student/account workflows transactional or safely recoverable.

### Gate 2 — Operate it safely

1. Validate environment variables and production cookie/CORS/CSRF behavior on the actual hosting topology.
2. Configure production HTTPS, secret management/rotation, database network restrictions, least-privilege credentials, backups, restore drills, monitoring, and alerting.
3. Add audit logging and define privacy/retention/incident processes for the deployment jurisdictions.
4. Verify migrations against a production-like database and document release/rollback steps.

### Gate 3 — Ship a professional product

1. Reconcile DojoFlow/ForceStrike branding and update the README to match current behavior.
2. Publish API and operator documentation; complete responsive, accessibility, and supported-browser reviews.
3. Remove or restrict developer-only UI/routes and unused starter assets.
4. Run end-to-end acceptance with representative Super Admin, Branch Admin, Coach, Student, and public visitor accounts.
5. Record a release checklist and obtain explicit operational sign-off from the product owner.

## Readiness verdict

**Current status: No-go for a 100% production-ready claim.** The codebase has a broad feature set and several sound security patterns, but there is not enough automated evidence or operational preparation to establish reliability and recoverability. “100%” is not a verifiable software property; a practical launch decision should instead require the release gates above, tested failure recovery, and acceptance by the people who will operate the system.

## Review limitations

- Static source review only; no routes were exercised and no build, lint, test, or browser workflow was run.
- Database indexes and actual data cardinality were not inspected against a running MongoDB instance.
- Hosting provider configuration, TLS termination, DNS, secrets, firewall rules, backups, and monitoring were not available in the repository review.
- The working tree contained existing uncommitted changes. Those were treated as user work and were not modified. Findings describe the checked-out files, including those current changes.

## Security hardening follow-up (5 October 2026)

The subsequent Phase 1 security work changed the current readiness picture:

- Replaced the active hard-coded admin script with explicit environment-driven, create-only provisioning; added a centralized environment validator and production frontend API URL validation.
- Added model-level bcrypt hashing, a shared 12-character/72-byte password policy, password change invalidation, non-enumerating recovery, one-time hashed reset tokens, and rate limits for login/recovery/reset/inquiry.
- Added a one-time migration for legacy plaintext user passwords. **It has not been run against any database**; back up first and run it with the API stopped before production use.
- Tightened production error responses, readiness reporting, cookie request origin validation, public CMS projections, inquiry response/duplicate handling, and fixed missing-branch promotion scope.
- Added focused configuration/password tests and recovery UI. The old legacy-session bridge remains because the frontend still calls it during authentication migration.

Outstanding security risks include:

- A retired bootstrap credential is present in historical Git commits. The current `.git` directory is read-only in this workspace, so history rewriting was not performed. Treat any account created with that historical credential as compromised, rotate it, and coordinate a repository history scrub before redistributing.
- The Express rate limiter uses its in-memory store. Multi-instance deployments need a shared store or gateway throttling; configured proxy hops must match the real hosting topology.
- CAPTCHA/Turnstile integration is deferred because the app has no widget integration. Database backup/restore drills, live cookie/CSRF checks, and database-backed password recovery were not executable in this static workspace review.
- Verification results for this implementation are recorded in the handoff response. The full existing client lint still has unrelated errors, and the production build could not fetch the existing Google-hosted Inter font in this network-restricted environment.

## Attendance and makeup workflow follow-up (5 October 2026)

The attendance/curriculum/makeup correction adds one regular student/date decision, unique makeup-per-absence enforcement, immediate progression for both present and absent decisions, curriculum snapshots, separate makeup attendance history, structured duplicate conflicts, and integration coverage for races, bulk marking, historical duplicates, holidays/closures, and India-local dates. The implementation and manual database runbook are documented in [ATTENDANCE_PROGRESSION_MAKEUP_REPORT.md](./ATTENDANCE_PROGRESSION_MAKEUP_REPORT.md).

This raises confidence in this workflow but does not change the project-wide **No-go** verdict. The follow-up has been exercised against an isolated MongoDB Memory Server, not production-like data. Run the attendance migration only after a verified backup and manual conflict resolution, with attendance writers stopped. CI/release gating, hosting and recovery drills, broader end-to-end coverage, and the other P0/P1 findings remain outstanding. See the updated totals in [PHASE2_TESTING_REPORT.md](./PHASE2_TESTING_REPORT.md) after the complete suite passes.
