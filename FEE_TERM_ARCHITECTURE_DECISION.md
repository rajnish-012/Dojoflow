# Fee Term Architecture Decision

**Status:** Approved architecture — implementation through Phase 14 complete; legacy data migration not performed  
**Decision date:** 2026-10-07  
**Implementation status updated:** 2026-10-08

## Decision

ForceStrike will model a training programme and its financial terms as separate concepts:

```text
Training Plan
    -> FeeTerm records
    -> Student Enrollment
    -> frozen billingSnapshot
    -> Invoice
    -> Payment
    -> Receipt
```

`Plan` remains the master training entity. `Plan.name` remains the single source
of truth for the current plan identity.

`FeeTerm` will be a separate collection that references a Plan. A FeeTerm will
never own a plan name.

This records the approved architecture baseline. Implementation followed the
phase sequence below. No legacy data migration or historical financial record
rewrite was performed.

## Implementation status

- Phases 1–6: FeeTerm persistence and administration, enrollment selection and
  snapshots, invoice generation, admission payment, and renewal workflows were
  completed before this follow-up.
- Phase 7: Finance reports and dashboard/export paths use posted invoices,
  payments, and receipts. Report filters cover branch, plan, invoice status,
  payment movement, and date range.
- Phase 8: FeeTerm and report endpoints enforce finance permissions and branch
  scope on the server.
- Phase 9: Regression coverage verifies current FeeTerm changes do not rewrite
  historical agreements, invoices, payments, receipts, or report totals.
- Phase 10: Legacy fields remain present and readable for legacy workflows.
- Phase 11: Backend lifecycle, authorization, financial-history, and API
  regression tests are maintained in the integration suite.
- Phase 12: FeeTerm controls use the shared confirmation UI, readable frequency
  labels, and date-only formatting.
- Phase 13: FeeTerm administration uses a single scoped list request with
  branch, frequency, and status filters and effective-date query support.
- Phase 14: The Plan → FeeTerm → Enrollment snapshot → Invoice → Payment →
  Receipt architecture was rechecked against the implementation.

The implementation does not authorize or perform a migration. Any legacy data
migration remains a separate task requiring explicit approval.

## Business model

One Training Plan can have many FeeTerms. Each FeeTerm represents one way to
purchase that plan, such as:

- Dubai Main Branch + Monthly
- Dubai Main Branch + Quarterly
- Dubai Main Branch + One Time
- Delhi Branch + Monthly

A FeeTerm will be identified by its Plan, branch, billing frequency, effective
date range, amount, registration fee, tax, discount rules, and status.

The intended conceptual fields are:

```text
FeeTerm
  plan
  branch
  billingFrequency
  amount
  registrationFee
  taxRate
  discountRules[]
  effectiveFrom
  effectiveUntil
  status
  version / supersedes
  audit metadata
```

Future dimensions such as age category, student type, payment mode, batch, or
currency are outside this decision and will not be introduced unless separately
approved.

## Invariants

1. A Plan can have many FeeTerms.
2. A FeeTerm belongs to exactly one Plan.
3. A FeeTerm has no independent plan name.
4. Multiple terms can exist for the same Plan and branch when their billing
   frequencies differ.
5. Active terms with the same Plan, branch, and billing frequency cannot have
   overlapping effective date ranges.
6. A new enrollment must select a valid FeeTerm for its Plan, branch, and start
   date.
7. The selected FeeTerm must be stored on the enrollment.
8. Enrollment must freeze the selected monetary terms in `billingSnapshot`.
9. Invoice generation must use the enrollment snapshot, never the current
   FeeTerm configuration.
10. Payments and receipts remain linked to invoices without a new payment
    architecture.

## Enrollment and billing workflow

```text
Add Student
    -> Student details
    -> Branch
    -> Training Plan
    -> Available FeeTerms for branch and start date
    -> Admin selects FeeTerm
    -> Create Enrollment
    -> Freeze billingSnapshot
    -> Generate Invoice
    -> Optional Pay Now
    -> Payment updates Invoice
    -> Receipt
```

The Add Student screen is an orchestration workflow. It must use the underlying
Student, Enrollment, FeeTerm, Invoice, Payment, and Receipt entities; it must
not bypass them.

The same fee-term selection requirement applies to CRM conversion, direct
admission, new enrollment, and renewal flows.

## Historical behaviour

Existing enrollment agreements, invoices, payments, and receipts are immutable
financial history.

Changing, retiring, or superseding a FeeTerm must never change existing
enrollment snapshots or financial documents. New enrollments use the currently
valid FeeTerm. Existing enrollment invoices use the frozen billing snapshot.

Used terms should be versioned by creating a successor with a later effective
date and retiring or closing the prior term, rather than rewriting the prior
financial agreement.

## Effective dates and validation

New terms should have an effective start date and may have an open-ended end
date. Sequential terms are valid when their date ranges do not overlap.

The implementation rejects overlap for active terms sharing:

```text
Plan + Branch + Billing Frequency
```

Database indexes prevent duplicate starts. Application-level transactional
validation rejects arbitrary date-range overlaps.

## RBAC and branch scope

Existing permissions and branch restrictions remain in force:

- `finance.view` views fee terms.
- `finance.manage` creates, changes, retires, and supersedes fee terms.
- `membership.manage` selects an allowed fee term during enrollment or renewal.
- `finance.collect`, `finance.refund`, and `finance.report` remain unchanged.

Branch-scoped users may view and manage only FeeTerms in their assigned branch.
They cannot create or modify FeeTerms for another branch.

## Legacy compatibility and migration boundary

The following existing fields remain untouched until a separately approved
dry-run migration and reconciliation:

- `Plan.price`
- `Plan.billingFrequency`
- `Plan.registrationFee`
- `Plan.taxRate`
- `Plan.branchFeeOverrides[]`
- legacy `feeName`
- enrollment `feePlan`

Legacy values remain in place for existing records and compatibility paths.
Current legacy dependencies include plan pricing and branch overrides used by
legacy enrollment/invoice fallback behavior; `feeName` is retained in snapshots
for legacy invoice readers; and enrollment `feePlan` continues to reference the
Plan for existing consumers. FeeTerm selection creates a separate FeeTerm
reference and frozen `billingSnapshot` for new agreements. These fields have
not been deleted, renamed, bulk converted, or migrated.

## Implementation phase sequence

1. FeeTerm persistence, indexes, overlap rules, and audit behaviour.
2. FeeTerm administration UI and APIs.
3. FeeTerm selection across new enrollment and admission flows.
4. Invoice generation from frozen enrollment agreements.
5. Add Student admission with optional invoice payment.
6. Renewal using explicit FeeTerm selection.
7. Historical financial reporting and dashboards.
8. RBAC and branch-scoping audit.
9. Historical data safety audit.
10. Legacy compatibility audit.
11. Regression test suite.
12. UX and production-readiness audit.
13. Performance and API audit.
14. Final architecture audit.

Legacy data migration is outside this sequence and requires separate explicit
approval.

## Explicitly deferred

- Data migration or updates to existing records
- Deleting legacy fields
- Changing existing invoice, payment, or receipt records
