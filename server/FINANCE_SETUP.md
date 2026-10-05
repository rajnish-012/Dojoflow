# Finance module database setup

Finance writes span invoices, payment ledger entries, receipts, sequence numbers, and audit rows. They use MongoDB transactions so these records commit or roll back together.

The MongoDB URI must point to a replica set or mongos. MongoDB Atlas provides this. A standalone `mongod` does not support the transaction used by this module; finance write requests return HTTP 503 with a setup message in that environment.

For a local Windows MongoDB installation, configure the existing `mongod` service with a single-node replica set (for example, `replication.replSetName: rs0` in its config), restart the service, initiate the set once with `rs.initiate()`, and set the application URI to include `?replicaSet=rs0`. Back up the database before changing a database server configuration.

Create the finance indexes after deployment with `npm run migrate:finance-indexes`. The script preserves unrelated indexes and replaces an older invoice-cycle unique index only after checking for duplicate active cycles. The deployed database must be backed up before the migration.

`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `ONLINE`, and `OTHER` are recorded as staff-entered ledger methods. This phase does not connect a payment gateway or settle online card/UPI transactions.
