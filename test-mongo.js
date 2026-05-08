import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./backend-node/.env" });

const MONGODB_URI = process.env.MONGODB_URI;
console.log("Testing MongoDB connection...");
console.log("Connection string:", MONGODB_URI.replace(/:[^@]+@/, ":***@"));

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  })
  .then(() => {
    console.log("✓ MongoDB connected successfully!");
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("✗ MongoDB connection failed:", err.message);
    if (err.message.includes("ETIMEDOUT") || err.message.includes("timed out")) {
      console.error("\n⚠️  Connection timeout - possible causes:");
      console.error("  1. MongoDB Atlas is blocking your IP");
      console.error("  2. Network firewall is blocking port 27017");
      console.error("  3. MongoDB Atlas cluster is not running");
      console.error("  4. Wrong credentials in MONGODB_URI");
    }
    process.exit(1);
  });
