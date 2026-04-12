import mongoose from "mongoose";
import Booking from "./src/models/bookings";

const fixStuckBookings = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect("mongodb+srv://shemin:shemin%40123@cluster0.3nhr0vy.mongodb.net/rentel-garage?retryWrites=true&w=majority&appName=Cluster0");
        console.log("Connected.");
        
        const result = await Booking.updateMany(
            { documentStatus: "Pending" },
            { $set: { documentStatus: "Approved" } }
        );
        console.log(`Updated ${result.modifiedCount} stuck bookings to Approved.`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixStuckBookings();
