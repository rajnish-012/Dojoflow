# ForceStrike Phase 2 testing and data-integrity report

## Delivered

- Kept Node's built-in `node:test` runner and added Supertest plus MongoDB Memory Server for real Express API tests against an isolated MongoDB database.
- Separated Express app import from production startup, so tests can load the actual app without listening on the production port or connecting to the configured database.
- Added `test`, `test:unit`, `test:integration`, and `test:coverage` scripts in `server/package.json`.
- Added API coverage for login, invalid/inactive credentials, malformed/expired/deactivated sessions, logout, password changes and session invalidation, password recovery response privacy, reset-token expiry/reuse, database-backed RBAC changes, student create/update/deactivation, inquiry validation/deduplication and persistence when email is unconfigured, and branch isolation.
- Exercised branch A versus branch B through student list/detail/update/delete/create, attendance read/write, holiday read/write, makeup reads, schedule reads, performance reads, promotion history, and summary reports. Query-string branch overrides were included.
- Covered attendance absence, duplicate prevention, future holiday rejection, makeup creation/scheduling, India-local midnight date filtering, and the attendance uniqueness constraint. Added holiday CRUD/past-date checks and weekly schedule validation/monthly calendar coverage.
- Added indexes for branch/date attendance queries and branch/student performance history queries.

## Test results

`npm test` ran both test commands successfully:

- Unit tests: **6 passed, 0 failed**.
- Integration/API tests: **20 passed, 0 failed**.
- Total: **26 passed, 0 failed**.
- No test wrote to the configured development or production database. Integration tests used an ephemeral MongoDB Memory Server database.

The Node coverage run reported **49.20% line**, **49.82% branch**, and **46.15% function** coverage across all loaded production and test files. Coverage is intentionally concentrated on critical security and workflow paths; it is not a claim of broad controller coverage.

## Data-integrity finding and database migration

The prior sparse unique index on `Student.user` also indexed explicit `null` values. As a result, more than one unlinked legacy student could conflict even though the model intends to support unlinked profiles. The model now defines a partial unique index that only constrains ObjectId links. An integration test reproduces the old index, runs the migration, verifies multiple null links are accepted, and verifies duplicate ObjectId links are still rejected.

Existing databases need the migration after a verified backup and while the API is stopped:

```powershell
cd server
npm run migrate:student-user-index
```

The migration was tested only against the ephemeral integration database; it was **not** run against the configured development or production database.

## Remaining high-value test work

- Attendance still needs fuller API coverage for present flows, eligibility/plan progression, past-date restrictions, holidays and overrides, bulk marking, and timezone boundary matrices.
- Makeup completion/cancellation, eligibility and conflicting schedules need end-to-end tests, beyond the tested absence creation and scheduling path.
- Date-specific schedule overrides, closed-day interactions, duplicate slots, and session-type lifecycle behavior need additional integration coverage; weekly schedule validation and monthly calendar reads are covered.
- Student plan changes, branch transfers, coach assignment, timeline, progress, and related-record cleanup need lifecycle/integrity scenarios.
- Performance creation/update, promotion eligibility and mutation, and report date filters/empty data behavior need more than the current read-scope assertions.
- Coach assignment authorization and branch scoping are not covered yet.
- Inquiry rate limiting, email-provider rejection, database outage handling, and rate-limit behavior across multiple app instances need dedicated tests. The present inquiry test covers persistence when no SMTP settings exist.
- Race-condition tests and recovery from failures between multi-document writes are still needed. Student creation already has compensating cleanup, but attendance-to-makeup, makeup completion, branch transfer, and other related-document changes are not proven atomic. MongoDB transactions were not added without confirming that every deployment uses a replica set; the local database topology is unknown.
- Index auditing should continue for query patterns not covered by the new Attendance and Performance indexes, and index-build rollout should be monitored on production-sized data.

## Operational notes

The first MongoDB Memory Server run may download a test MongoDB binary. In this Windows sandbox, test execution required permission for its isolated `mongod` process to start. Mongoose currently reports a deprecation warning for the `new` option elsewhere in the codebase; the tested reset-token path has been updated to `returnDocument: "after"`.

## Attendance workflow follow-up

The attendance and makeup gaps listed above were addressed in a later workflow pass. The current integration suite now includes the required one-student/date constraint, present and absent progression, automatic makeup snapshots, manual recovery, completion isolation, slot bypass and concurrent requests, bulk marking, historical duplicate handling, schedule/holiday checks, and India-local dates. The dedicated behavior and migration runbook is in [ATTENDANCE_PROGRESSION_MAKEUP_REPORT.md](./ATTENDANCE_PROGRESSION_MAKEUP_REPORT.md).

The original **20 integration test** count and **26 total test** count above describe the earlier Phase 2 baseline. The follow-up run on 5 October 2026 completed **6 unit tests and 34 integration tests (40 total), all passing**. `npx tsc --noEmit` passed, and lint passed for the changed attendance/makeup API and row type files. Linting the complete attendance and student progress pages still reports pre-existing hook-pattern and `any`-type violations outside this change. The remaining limitations concerning CI, operations, and production migration rehearsal continue to apply.
