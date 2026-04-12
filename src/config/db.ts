// config/db.js

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log("Attempting Archive_Link to Hive Mainframe... 📡");
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is undefined in the environment configuration.");
    }
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected ✅ [Protocol_Sync_Stable]");
  } catch (error: any) {
    console.error("/// Link_Failure:", error.message);
    process.exit(1);
  }
};

export default connectDB;
