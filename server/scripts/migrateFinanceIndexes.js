require("dotenv").config();

const mongoose = require("mongoose");
const Invoice = require("../src/models/Invoice");
const Payment = require("../src/models/Payment");
const Receipt = require("../src/models/Receipt");
const FinanceAudit = require("../src/models/FinanceAudit");
const FinanceSequence = require("../src/models/FinanceSequence");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be configured before creating finance indexes.");
  await mongoose.connect(process.env.MONGO_URI);
  const expectedCycleIndex = Invoice.schema.indexes().find(([, options]) => options.name === "uniq_invoice_enrollment_cycle");
  const [, cycleOptions] = expectedCycleIndex;
  const existingIndexes = await Invoice.collection.listIndexes().toArray();
  const oldCycleIndex = existingIndexes.find((index) => index.name === cycleOptions.name || (index.key.enrollment === 1 && index.key.cycleKey === 1));
  if (oldCycleIndex && JSON.stringify(oldCycleIndex.partialFilterExpression || null) !== JSON.stringify(cycleOptions.partialFilterExpression || null)) {
    const duplicates = await Invoice.aggregate([
      { $match: { status: { $ne: "CANCELLED" } } },
      { $group: { _id: { enrollment: "$enrollment", cycleKey: "$cycleKey" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ]);
    if (duplicates.length) throw new Error("Duplicate active invoice cycles must be resolved before changing the unique invoice-cycle index.");
    console.log(`Replacing invoice cycle index ${oldCycleIndex.name} after verifying active cycles are unique.`);
    await Invoice.collection.dropIndex(oldCycleIndex.name);
  }
  for (const model of [Invoice, Payment, Receipt, FinanceAudit, FinanceSequence]) await model.createIndexes();
  console.log("Finance indexes are ready.");
}

main()
  .catch((error) => {
    console.error("Finance index migration failed", { name: error?.name || "Error", code: error?.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
