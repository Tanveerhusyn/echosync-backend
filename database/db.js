const mongoose = require("mongoose");
require("dotenv").config(); // This line is crucial

const connectDB = async () => {
  try {
    console.log("MongoDB URI:", process.env.MONGODB_URI); // Log the URI for debugging
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in the environment variables");
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
