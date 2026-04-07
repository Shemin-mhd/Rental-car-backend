import cron from "node-cron";
import Booking from "../models/bookings";
import Car from "../models/cars";

/**
 * 🔱 Fleet Synchronization Engine
 * Automatically re-activates vehicles and completes booking dossiers
 * once the rental duration has officially concluded.
 */
export const initCronJobs = () => {
    // 🛰️ Fleet Synchronization Cycle: Every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();
            
            // 🛡️ 1. Archive historically finished bookings
            await Booking.updateMany(
                { status: "Confirmed", endDate: { $lt: now } },
                { status: "Completed" }
            );

            // 🧬 2. Dynamic Real-World Availability Sync
            const allCars = await Car.find({});
            
            for (const car of allCars) {
                // Check if this vehicle is currently "on the road" (Active Cycle)
                const currentBooking = await Booking.findOne({
                    carId: car._id,
                    status: "Confirmed",
                    startDate: { $lte: now },
                    endDate: { $gte: now }
                });

                const shouldBeAvailable = !currentBooking;
                
                if (car.isAvailable !== shouldBeAvailable) {
                    await Car.findByIdAndUpdate(car._id, { isAvailable: shouldBeAvailable });
                    console.log(`🔱 FLEET SYNC [${car.name}]: Availability shifted to ${shouldBeAvailable ? "OPEN" : "RESERVED"}`);
                }
            }
        } catch (error: any) {
            console.error("🔱 FLEET SYNC FAILURE:", error.message);
        }
    });

    console.log("🔱 Synchronizing fleet registry cycles 🛰️");
};
