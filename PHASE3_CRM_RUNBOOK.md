# Phase 3 CRM: Leads, Trials, and Admissions

The existing `Inquiry` record is the CRM lead record. Public website inquiries continue to create inquiries and send the configured inquiry email. Staff-created leads, follow-up history, status audit history, conversion links, and follow-up dates are stored on that same record. Trials are separate records linked to a lead.

## Deploy

1. Take the normal verified database backup.
2. With the production `MONGO_URI` configured, run `cd server; npm run migrate:crm-indexes` once before deploying. This creates lead query indexes and a unique trial booking index. Existing trial collections should be empty on first rollout; if duplicates already exist, resolve them before retrying the index command.
3. Deploy the backend and frontend together. Startup updates the existing `inquiries` navigation module to open `/crm` while keeping its database permission (`inquiry.view`).
4. Check lead visibility as a branch user, trial creation and attendance recording, lead status history, admission, and the optional invoice path. Optional admission invoices use the existing financial models and require `finance.manage`; as with other financial writes, MongoDB must support transactions (Atlas or a replica set).

## CRM behavior

- Website inquiries default to source `WEBSITE`; staff-created leads default to `STAFF`.
- Supported lead statuses are `NEW`, `CONTACTED`, `TRIAL_SCHEDULED`, `TRIAL_COMPLETED`, `INTERESTED`, `NOT_INTERESTED`, `CONVERTED`, and `LOST`. Legacy inquiry statuses remain readable for compatibility.
- Status changes append actor, timestamp, prior status, next status, and note to the lead history. Trial stages are set by trial actions, and `CONVERTED` is set only by admission conversion.
- A repeated conversion of the same lead returns the already-linked student, enrollment, and invoice. Conversion finds an existing student by phone/email before creating a profile and refuses cross-branch or conflicting identity matches.
- Follow-up reminders run at server startup and hourly afterward. Reminder keys make retries idempotent. The assigned active staff member receives the notification; an unassigned lead notifies branch administrators.
- Trial bookings reject duplicate lead/date/time records. Coach overlaps are checked when a coach is assigned. Cancelled trials may be rebooked.
