/**
 * One-time script.
 *
 * Old inquiries only have the branch typed as text. This links each one
 * to a real branch when the text matches a branch name (ignoring
 * capital letters and extra spaces), so branch staff can see them.
 *
 * Run once from the server folder:
 *   node scripts/backfillInquiryBranch.js
 */
require("dotenv").config();

const mongoose = require("mongoose");

const Inquiry = require("../src/models/Inquiry");
const Branch = require("../src/models/Branch");

const normalize = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const branches = await Branch.find();
  const inquiries = await Inquiry.find({ branch: null });

  let linked = 0;
  const unmatched = [];

  for (const inquiry of inquiries) {
    const text = normalize(inquiry.preferredBranch);

    const match = text
      ? branches.find((branch) => normalize(branch.name) === text)
      : null;

    if (match) {
      inquiry.branch = match._id;
      inquiry.preferredBranch = match.name;
      await inquiry.save();
      linked += 1;
    } else {
      unmatched.push(
        `${inquiry.fullName} -> "${inquiry.preferredBranch || ""}"`
      );
    }
  }

  console.log(`Inquiries checked : ${inquiries.length}`);
  console.log(`Linked to a branch: ${linked}`);
  console.log(`Left without one  : ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log(
      "\nThese are only visible to the Super Admin:\n - " +
        unmatched.join("\n - ")
    );
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Backfill failed:", error.message);
  process.exit(1);
});