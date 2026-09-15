const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const User = require("./src/models/User");

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const existingAdmin = await User.findOne({
      email: "admin@dojoflow.com",
    });

    if (existingAdmin) {
      existingAdmin.name = "Dojo Admin";
      existingAdmin.password = hashedPassword;
      existingAdmin.role = "SUPER_ADMIN";
      existingAdmin.branch = null;

      await existingAdmin.save();

      console.log("Existing admin account updated successfully");
    } else {
      await User.create({
        name: "Dojo Admin",
        email: "admin@dojoflow.com",
        password: hashedPassword,
        role: "SUPER_ADMIN",
        branch: null,
      });

      console.log("Admin account created successfully");
    }

    console.log("Email: admin@dojoflow.com");
    console.log("Password: admin123");

    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error);
    process.exit(1);
  }
};

createAdmin();