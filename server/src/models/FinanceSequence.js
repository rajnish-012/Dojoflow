const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model("FinanceSequence", schema);
