import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Car from "./src/models/cars";

dotenv.config();

const activateFleet = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("Connected to database for fleet activation...");

        const result = await Car.updateMany(
            { status: { $exists: false } }, 
            { $set: { status: "APPROVED" } }
        );
        
        const result2 = await Car.updateMany(
            { status: "PENDING" }, 
            { $set: { status: "APPROVED" } }
        );

        console.log(`Success: ${result.modifiedCount + result2.modifiedCount} cars have been authorized and are now LIVE.`);
        process.exit(0);
    } catch (error) {
        console.error("Activation failed:", error);
        process.exit(1);
    }
};

activateFleet();
