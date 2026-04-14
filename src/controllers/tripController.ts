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
            booking.status = "Completed";
            await booking.save();

            // 🔱 Update Car Availability (Make it ready for next deployment)
            // If the car has a standby status or location, update it here if needed
            
            // 🛰️ Notify Observers
            const io = (global as any).io;
            if (io) {
                io.to(id).emit("bookingStatusUpdate", { bookingId: id, status: "Completed" });
            }

            return res.json({ message: "Mission archived successfully.", status: "Completed" });
        }

        res.status(400).json({ message: "Invalid mission termination parameters." });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
