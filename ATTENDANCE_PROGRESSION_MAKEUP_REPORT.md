# Attendance, Curriculum Progression, and Makeup Correction

**Updated:** 5 October 2026  
**Scope:** Attendance decisions, per-program curriculum progression, makeup recovery, date uniqueness, related history displays, and database migration.

## Result

The attendance workflow now has a server-enforced one-regular-decision-per-student-per-calendar-date rule. `PRESENT` and `ABSENT` consume the next regular curriculum lesson. Every absence automatically creates one recovery record containing the lesson snapshot from that attendance. Completing a recovery is stored as `attendanceType: MAKEUP` and does not advance or rewind regular progress.

This is a focused workflow correction, not a claim that the whole CRM is production ready. The project-wide release blockers in [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md) still apply.

## Business behavior

- **One student/date:** Different session slots cannot create a second regular decision. The API checks the whole calendar date and the database unique index handles races. Conflicts return HTTP `409` with `code: ATTENDANCE_ALREADY_MARKED`.
- **Multiple slots:** Slot selection remains part of the attendance record and is required when more than one active session is available. It does not create a second regular attendance opportunity that day.
- **Present:** The server resolves the student's active enrollment, plan, program, curriculum, and prior valid regular attendance; stores the selected lesson snapshot; and returns the next regular day.
- **Absent:** It stores the same lesson snapshot, marks the lesson consumed immediately, and creates exactly one scheduled makeup. The legacy request flag `makeupRequired` is ignored as an authority, so `false` cannot suppress recovery.
- **Makeup snapshot:** Both automatic and manual recovery copy `planDay`, title, skill, program, session slot, enrollment, and plan from the original absence. The current curriculum is never recalculated when scheduling or completing it. Manual recovery rejects an original absence with an incomplete curriculum snapshot.
- **Completion/history:** A completed makeup visit is a separate `MAKEUP` attendance record. Progress calculation and regular attendance summaries ignore it; the original absence remains a regular event and records recovery status. Timeline/progress views identify makeup recovery separately.
- **Holiday/closed day:** Existing branch schedule and holiday validation remains before regular attendance creation, so these dates create no regular event or makeup and consume no curriculum.
- **Bulk Present:** The bulk endpoint uses the same daily eligibility sheet and delegates each write to the single attendance handler. Existing decisions are skipped; it does not overwrite them.
- **Historical duplicates:** Progress counts at most the first regular record for each India-local calendar date. Conflicting historical records are still retained and must be reviewed manually before index migration.
- **Dates:** Requests remain `YYYY-MM-DD`; API handlers use the project's local-calendar helpers. Makeup completion now passes a formatted calendar-date key to schedule validation instead of a JavaScript `Date` object.

## Database constraint

`Attendance` now has a unique index on `{ student: 1, date: 1 }`, with a partial filter for regular and legacy untyped records. `sessionSlotId` remains stored but is absent from the uniqueness key. Makeup visit rows are labeled `MAKEUP` and excluded from that regular-only unique index. A separate unique index on `Makeup.originalAttendance` prevents two recoveries for one absence.

Attendance dates must be canonical calendar-date values for the deployment timezone. The migration groups dates using `Asia/Kolkata`, reports duplicates before any writes, and canonicalizes timestamps to local midnight only after the conflict check passes. Historical makeup Attendance rows referenced by `Makeup.makeupAttendance` are classified as `MAKEUP`.

## Migration runbook

Do **not** run this automatically during app startup or against production without the normal change window. Stop API writers and take a verified database backup first. Point `MONGO_URI` only at the intended database.

1. Set the process timezone in the migration shell to India time and run a dry report:

   ```powershell
   cd server
   $env:TZ = "Asia/Kolkata"
   npm run migrate:attendance-date-index
   ```

2. If it reports duplicate student/date attendance or multiple makeups for one original absence, resolve each conflict manually. The script intentionally does not delete records or select a winner. Rerun the dry report until it is clean.
3. With the API still stopped and after the backup is verified, apply:

   ```powershell
   npm run migrate:attendance-date-index -- --apply
   ```

4. Verify `attendances` contains `uniq_regular_attendance_student_date` on `{student:1,date:1}` and `makeups` contains `uniq_makeup_original_attendance` on `{originalAttendance:1}`. Restart the API and verify regular marking, absence recovery, and progress in the target environment.

The migration is safe to rerun after it succeeds. It exits before changing indexes or date values when it detects historical conflicts. It has only been exercised against the isolated test database; it has **not** been run against the configured development or production database.

## Verification added

The integration suite now covers present progression, automatic absent recovery even when the request flag is false, progression while recovery is pending, lesson snapshots after later progress, makeup completion without regular progression changes, manual recovery from the original absence, cross-slot duplicates for present and absent, concurrent requests, duplicate historical dates, bulk marking, holiday and closed-day behavior, India-local dates, and migration conflict reporting. See [PHASE2_TESTING_REPORT.md](./PHASE2_TESTING_REPORT.md) for project testing context and remaining assurance gaps.

## Known limits

- Full project release readiness is still **NO**: see the P0/P1/P2 findings in the project readiness report. These workflow tests do not replace CI, deployment topology verification, backup/restore rehearsal, production-like migration rehearsal, or monitoring.
- The migration requires attendance writes to be stopped while it runs. This keeps the conflict report and index creation from racing with inserts.
- Data-level uniqueness is the final concurrency guard. Attendance creation and automatic makeup creation use compensating deletion if the makeup insert fails because every deployment is not guaranteed to support MongoDB transactions.
