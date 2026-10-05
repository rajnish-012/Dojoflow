require("dotenv").config();

const mongoose = require("mongoose");
const Notification = require("../src/models/Notification");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI must be configured before creating notification indexes.");
  await mongoose.connect(process.env.MONGO_URI);
  await Notification.createIndexes();
  console.log("Notification indexes are ready.");
}

main()
  .catch((error) => {
    console.error("Notification index migration failed", { name: error?.name || "Error", code: error?.code });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
