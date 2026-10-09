# Application-wide table and row-action audit

Audit started 2026-10-09. This checklist records repository discovery and the verified changes made in this pass. A source match identifies a review target; it does not by itself mean that every interaction on that screen has been manually verified.

## Discovery inventory

The client contains 53 `page.tsx` routes. The sidebar is assembled from server-provided navigation modules and grouped by `client/lib/navigation-groups.ts`; the group registry covers Academy, Operations, Content, Reports, Administration, and Settings. A source scan found 27 app/component files matching table, data-table, grid, or row-heading patterns. The list below includes every discovered page route. Status is deliberately conservative where action behavior still needs individual review.

| Module | Route/page | Table/list and actions found in source scan | Components | Status |
|---|---|---|---|---|
| Dashboard | `/`, `/dashboard` | Dashboard summary lists; no general-purpose row-action column confirmed | Page-specific cards and buttons | Discovered; action review pending |
| Student dashboard | `/student-dashboard`, `/student-dashboard/receipts/[id]` | Student summary/receipt views; no row-action column confirmed | Page-specific cards, receipt view | Discovered; action review pending |
| Students | `/students`, `/students/[id]`, `/students/[id]/timeline`, `/students/[id]/progress` | Student list View; profile/detail actions; guardian management; progress/timeline controls | `IconButton`, `Button`, detail panels | View row action inspected; remaining page actions pending |
| Memberships | `/memberships` | Enrollment rows: History, renew/new enrollment, status changes | `Button`, `Select`, modal | Source located; workflow/permission review pending |
| Plans and curriculum | `/plans`, `/curriculum` | Plan cards: Edit, Deactivate; curriculum milestone rows: Edit, Delete | `Button`, `IconButton`, cards | Source located; permission/confirmation review pending |
| Training programs | `/training-session-types` | Program rows: Edit, Activate/Deactivate, Delete (delete hidden when scheduled sessions exist) | Standardized to `IconButton`; `ConfirmationDialog` | Fixed; permission and guarded-delete conditions retained |
| Attendance | `/attendance`, `/attendance/corrections` | Attendance rows: mark, undo, request correction; correction rows: approve/reject | `AttendanceSheet`, `AttendanceRow`, `Button` | Source located; behavior review pending |
| Makeup scheduling | `/makeups` | Makeup rows: complete, cancel, schedule/action controls | `IconButton`, `Button`, confirmation dialog | Source located; behavior review pending |
| Performance and progress | `/performance`, `/progress` | Performance rating/editor controls; progress detail controls | Native button, `Button` | Source located; row-action scope pending |
| Promotions | `/promotions` | Promotion rows/cards: History, Promote | `Button` | Source located; loading/permission review pending |
| Grading and certificates | `/grading`, `/grading/[id]`, `/certificates`, `/certificates/[id]` | Evaluation actions and certificate generation/preview; list actions not yet confirmed | `Button`, links | Discovered; full action review pending |
| Calendar and schedules | `/calendar`, `/branch-schedules`, `/branches/[id]/schedule` | Calendar event lifecycle/edit actions; schedule controls | `Button`, `IconButton`, calendar components | Source located; row/list interaction review pending |
| Holidays | `/holidays` | Holiday rows: edit/delete and related visibility controls | `IconButton`, `Button`, confirmation | Source located; behavior review pending |
| Inquiries and CRM | `/inquiries`, `/inquiry`, `/crm` | Lead rows/cards: View/details, trial, conversion, follow-up actions | `IconButton`, `Button`, custom row/card | CRM action cell inspected; remaining inquiry routes pending |
| Coach assignments | `/coach-assignments`, `/coach-assignments/[coachId]` | Assignment rows: Unassign; profile availability controls | `Button`, profile controls | Source located; branch/permission review pending |
| Fees and payments | `/fees`, `/fees/receipts/[id]` | Invoice rows: Issue, Cancel, Record payment; payment rows: Receipt, Refund, Correct | `FinanceTables`, `Button` | Actions and state guards source-checked; runtime review pending |
| Fee terms | Shared on fee/plan management screens | Fee-term rows: View, Edit, Supersede, Retire (retire opens confirmation) | Changed icon-only actions from `Button` to shared `IconButton` | Fixed; permission/status guards retained |
| Inventory and merchandise | `/inventory`, `/merchandise` | Order rows: Cancel, Return; inventory lists are tab-specific | `Button`, `ReturnButton` | Source located; API/loading review pending |
| Branches | `/branches` | Branch cards rather than a table; create/edit card actions | `Button`, `BranchCard` | Discovered; card action review pending |
| Roles and permissions | `/roles` | Role rows: configure/view permissions, Delete (system/user-count guards) | `IconButton` | Source located; RBAC guards require final review |
| Modules/navigation | `/modules` | Module rows: reorder, hide/show, Edit, Delete; section reorder | `IconButton` | Source located; prior in-progress local-state update retained |
| Settings and branding | `/settings`, `/settings/staff`, `/settings/branding`, `/settings/maintenance`, `/settings/email` | Shared settings sections; staff rows include user edit actions | `SettingsSectionPage`, `IconButton` | Source located; section-by-section review pending |
| Website/CMS | `/(admin)/website/homepage` | Statistics cards: Edit, Delete | `Button` | Source located; behavior review pending |
| Reports | `/reports`, `/reports/attendance-analytics` | Report tables/results; no destructive row action confirmed | `Button`, table/list views | Discovered; table/export review pending |
| Audit logs | `/audit-logs` | Audit event rows open details; no mutation actions | Table, detail modal | Source scan indicates read-only rows; behavior review pending |
| Notifications | `/notifications` | Notification list controls | Page-specific controls | Discovered; row-action review pending |
| Session types | `/training-session-types` | Included in Training programs above | Shared row controls | Fixed |
| Authentication/access | `/login`, `/forgot-password`, `/reset-password`, `/unauthorized` | Forms and navigation; no row-level table actions | `Button`, native form controls | Discovered; no table action scope found in scan |
| Public enrollment | `/inquiry` | Plan/session selection controls, not row management actions | `Button`, schedule selector | Discovered; no table action scope found in scan |
| UI component demo | `/ui-test` | Component demonstrations, not business row actions | `Button`, `IconButton` | Discovered; excluded from business action standardization |

## Verified findings and changes

- `Button` and `IconButton` did not define a visible keyboard focus ring. Both now share a `focus-visible` accent ring and surface-colored offset.
- `IconButton` destructive styling now uses the same solid danger treatment as `Button`'s danger variant.
- Fee-term icon-only actions had a separate implementation using labeled `Button` elements. They now use `IconButton`, have explicit per-record accessible labels, align to the end of the action cell, and keep the existing status/permission gates and retirement confirmation.
- Training program table actions used a mixture of text and icon buttons. Edit, Activate/Deactivate, and Delete now use `IconButton` with action-specific labels/tooltips; delete continues to appear only when the program has no scheduled sessions and still opens the existing confirmation dialog.
- No new action component was introduced. `Button`, `IconButton`, `ConfirmationDialog`, and the existing data-table components remain the design-system primitives.

## Remaining checklist

- [ ] Inspect every route above for nested tables, cards, responsive/mobile action variants, and dynamically rendered action menus; confirm all permission and branch-scope predicates.
- [ ] Record exact action sets and loading/error/confirmation behavior for each table-bearing screen, especially attendance, makeup, CRM, holidays, finance, roles, settings/staff, inventory, and calendar.
- [ ] Compare repeated View/Edit/Delete/History/Restore/visibility implementations across all modules and standardize every accidental difference.
- [ ] Repeat the scan after changes and run route-appropriate interaction tests, full ESLint, TypeScript, and a production build with a valid `NEXT_PUBLIC_API_URL`.

## Checks run in this pass

- Repository route discovery: 53 page routes found.
- Table/grid/data-table source scan: 27 matching app/component files found.
- Focused ESLint on the four changed frontend components: passed.
- `npx tsc --noEmit`: passed.
- Full `npm run lint`: failed on 44 errors and 42 warnings elsewhere in the client; the four changed frontend components pass focused ESLint.
- `npm run build`: could not load `next.config.ts` because the local `NEXT_PUBLIC_API_URL` does not meet the required real HTTPS production hostname validation.
- Exact count of distinct row-action implementations and total inconsistencies is not yet established; the route and source-file counts above are discovery counts, not claims that every implementation was behavior-tested.
