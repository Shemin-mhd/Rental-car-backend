// c:\Users\User\OneDrive\Documents\car\Backend\src\controllers\tripController.ts
import { Request, Response } from "express";
import Booking from "../models/bookings";
import Car from "../models/cars";

export const updateTripStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { tripStatus } = req.body;
        const user = (req as any).user;

        const booking = await Booking.findById(id).populate("carId");
        if (!booking) return res.status(404).json({ message: "Mission record not found." });

        const car = booking.carId as any;

        // 🛡️ Tactical Authorization: Only Admin or Car Owner can end the mission
        if (user.role !== 'admin' && car.ownerId?.toString() !== user.id) {
            return res.status(403).json({ message: "Fleet authority denied. Unauthorized mission termination." });
        }

        if (tripStatus === "Completed") {
            const now = new Date();
            const scheduledEnd = new Date(booking.endDate);
            let lateFine = 0;

            if (now > scheduledEnd) {
                const diffMs = now.getTime() - scheduledEnd.getTime();
                const diffHrs = Math.ceil(diffMs / (1000 * 60 * 60)); // Round up to nearest hour
                lateFine = diffHrs * 200;
            }

            booking.status = "Completed";
            booking.actualReturnDate = now;
            booking.lateFine = (booking.lateFine || 0) + lateFine;
            await booking.save();

            // 🔱 Release Car for next assignment
            const carAsset = await Car.findById(booking.carId);
            if (carAsset) {
                carAsset.isAvailable = true;
                await carAsset.save();
            }

            // 🛰️ Notify Observers
            const io = (global as any).io;
            if (io) {
                io.to(id).emit("bookingStatusUpdate", {
                    bookingId: id,
                    status: "Completed",
                    lateFine: lateFine
                });
            }

            return res.json({
                message: lateFine > 0
                    ? `Mission Terminated. Late Fee Applied: ₹${lateFine} (${Math.ceil((now.getTime() - scheduledEnd.getTime()) / 3600000)} hrs late)`
                    : "Mission Terminated. Asset returned on schedule.",
                status: "Completed",
                lateFine
            });
        }

        res.status(400).json({ message: "Invalid mission termination parameters." });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
