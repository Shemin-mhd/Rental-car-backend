import cron from "node-cron";
import Booking from "../models/bookings";
import Car from "../models/cars";

/**
 * 🔱 Fleet Synchronization Engine
 * - Re-activates vehicles after rental ends
 * - Sends pickup reminder notifications (1 day before & day-of)
 * - Auto-completes trips after endDate
 */
export const initCronJobs = () => {

    // 🛰️ Fleet Synchronization Cycle: Every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            // 🛡️ 1. Archive finished trips (active_trip past endDate → Completed)
            const completedResult = await Booking.updateMany(
                { status: { $in: ["Confirmed", "active_trip", "upcoming_pickup", "arrived"] }, endDate: { $lt: now } },
                { status: "Completed" }
            );
            if (completedResult.modifiedCount > 0) {
                console.log(`[CRON] Archived ${completedResult.modifiedCount} completed trip(s)`);
            }

            // 🧬 2. Dynamic Real-World Availability Sync
            const allCars = await Car.find({});
            for (const car of allCars) {
                const currentBooking = await Booking.findOne({
                    carId: car._id,
                    status: { $in: ["Confirmed", "upcoming_pickup", "arrived", "active_trip"] },
                    startDate: { $lte: now },
                    endDate: { $gte: now },
                });
                const shouldBeAvailable = !currentBooking;
                if (car.isAvailable !== shouldBeAvailable) {
                    await Car.findByIdAndUpdate(car._id, {
                        isAvailable: shouldBeAvailable,
                        availableFrom: shouldBeAvailable ? new Date() : (currentBooking?.endDate || car.availableFrom),
                    });
                    console.log(`🔱 FLEET SYNC [${car.name}]: ${shouldBeAvailable ? "OPEN" : "RESERVED"}`);
                }
            }
        } catch (error: any) {
            console.error("🔱 FLEET SYNC FAILURE:", error.message);
        }
    });

    // 🔔 Pickup Reminder Cycle: Every hour
    cron.schedule("0 * * * *", async () => {
        try {
            const io = (global as any).io;
            if (!io) return;

            const now = new Date();

            // ── 1-DAY BEFORE REMINDER ─────────────────────────────────────────
            // Window: startDate is between 23h and 25h from now
            const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
            const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

            const tomorrowBookings = await Booking.find({
                status: "Confirmed",
                startDate: { $gte: in23h, $lte: in25h },
            }).populate("carId", "name ownerId");

            for (const booking of tomorrowBookings) {
                const car = booking.carId as any;
                const pickupDate = new Date(booking.startDate).toLocaleDateString("en-IN", {
                    weekday: "short", day: "numeric", month: "short",
                });

                // Transition to upcoming_pickup
                booking.status = "upcoming_pickup";
                await booking.save();

                // Notify user
                io.to(`user-${booking.userId.toString()}`).emit("pickupReminder", {
                    bookingId: booking._id,
                    type: "tomorrow",
                    title: "Pickup Tomorrow 🚗",
                    message: `Your pickup for ${car?.name || "your car"} is scheduled tomorrow (${pickupDate}).`,
                });

                // Notify host
                if (car?.ownerId) {
                    io.to(`user-${car.ownerId.toString()}`).emit("pickupReminder", {
                        bookingId: booking._id,
                        type: "tomorrow",
                        title: "Customer Pickup Tomorrow",
                        message: `${booking.fullName} is scheduled to pick up ${car.name} tomorrow (${pickupDate}).`,
                    });
                }

                console.log(`[CRON][REMINDER] 1-day notice sent for booking ${booking._id}`);
            }

            // ── PICKUP-DAY REMINDER ───────────────────────────────────────────
            // Window: startDate is between now and 1h from now (same day, upcoming hours)
            const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);

            const todayBookings = await Booking.find({
                status: "upcoming_pickup",
                startDate: { $gte: now, $lte: in1h },
            }).populate("carId", "name ownerId");

            for (const booking of todayBookings) {
                const car = booking.carId as any;

                // Notify user
                io.to(`user-${booking.userId.toString()}`).emit("pickupReminder", {
                    bookingId: booking._id,
                    type: "today",
                    title: "Pickup Today! 🔑",
                    message: `Your pickup for ${car?.name || "your car"} is scheduled today. Head to the pickup location now.`,
                });

                // Notify host
                if (car?.ownerId) {
                    io.to(`user-${car.ownerId.toString()}`).emit("pickupReminder", {
                        bookingId: booking._id,
                        type: "today",
                        title: "Customer Arriving Today",
                        message: `${booking.fullName} is scheduled to pick up ${car.name} today. Be ready!`,
                    });
                }

                console.log(`[CRON][REMINDER] Day-of notice sent for booking ${booking._id}`);
            }
        } catch (error: any) {
            console.error("[CRON][REMINDER] Failure:", error.message);
        }
    });

    console.log("🔱 Fleet registry sync + pickup reminders initialized 🛰️");
};
