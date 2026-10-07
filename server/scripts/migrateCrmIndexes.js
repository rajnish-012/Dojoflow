require("dotenv").config();

const mongoose = require("mongoose");
const Inquiry = require("../src/models/Inquiry");
const Trial = require("../src/models/Trial");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be configured before creating CRM indexes.");
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Inquiry.createIndexes(), Trial.createIndexes()]);
  console.log("CRM lead and trial indexes are ready.");
}

main()
  .catch((error) => {
    console.error("CRM index migration failed", { name: error?.name || "Error", code: error?.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
