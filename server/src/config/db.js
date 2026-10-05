const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection failed.", { name: error?.name || "Error", code: error?.code });
    process.exit(1);
  }
};

module.exports = connectDB;
