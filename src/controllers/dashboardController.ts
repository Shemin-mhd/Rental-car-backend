import { Request, Response } from "express";
import User from "../models/users";
import Car from "../models/cars";
import Booking from "../models/bookings";

export const getAdminStats = async (req: Request, res: Response) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalCars = await Car.countDocuments();
        const bookings = await Booking.find({});

        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
        const totalBookings = bookings.length;
        const pendingVerifications = await Booking.countDocuments({ documentStatus: "Pending" });

        res.status(200).json({
            message: "Admin Terminal Uplink Established",
            stats: {
                users: totalUsers,
                cars: totalCars,
                revenue: totalRevenue,
                bookings: totalBookings,
                pendingVerifications
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: "Protocol Fault: Data retrieval failed", error: error.message });
    }
};

export const getCustomerStats = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const myCars = await Car.find({ ownerId: userId });
        const carIds = myCars.map(c => c._id);

        const activeNodes = myCars.filter(c => !c.isAvailable).length;
        const myBookings = await Booking.find({ carId: { $in: carIds } }).populate("carId", "name image");

        const totalRevenue = myBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
        const avgYield = myBookings.length > 0 ? Math.round(totalRevenue / myBookings.length) : 0;

        // Mock history for chart (In production, group by month in MongoDB)
        const history = [
            { month: "JAN", revenue: Math.round(totalRevenue * 0.1) },
            { month: "FEB", revenue: Math.round(totalRevenue * 0.15) },
            { month: "MAR", revenue: Math.round(totalRevenue * 0.12) },
            { month: "APR", revenue: Math.round(totalRevenue * 0.25) },
            { month: "MAY", revenue: Math.round(totalRevenue * 0.18) },
            { month: "JUN", revenue: Math.round(totalRevenue * 0.2) }
        ];

        res.status(200).json({
            message: "Host Terminal Synchronized",
            stats: {
                revenue: totalRevenue,
                bookings: myBookings.length,
                fleetCount: myCars.length,
                activeNodes,
                avgYield
            },
            history,
            recentBookings: myBookings.slice(-5).reverse()
        });
    } catch (error: any) {
        res.status(500).json({ message: "Host Synchronization Error", error: error.message });
    }
};

export const getAdminUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find({}).select("-password -refreshToken");
        res.status(200).json(users);
    } catch (error: any) {
        res.status(500).json({ message: "User retrieval fault", error: error.message });
    }
};

export const getAdminBookings = async (req: Request, res: Response) => {
    try {
        const bookings = await Booking.find({}).populate("carId", "name regNumber").populate("userId", "name email");
        res.status(200).json(bookings);
    } catch (error: any) {
        res.status(500).json({ message: "Booking retrieval fault", error: error.message });
    }
};

// 🔱 Admin: User Verification
export const getPendingUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find({
            verificationStatus: "PENDING",
            role: { $ne: "admin" },
            $or: [
                { licenseFrontUrl: { $ne: "" } },
                { licenseBackUrl: { $ne: "" } }
            ]
        }).select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching pending users" });
    }
};

export const verifyUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body; // "APPROVED" or "REJECTED"

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.verificationStatus = status;
        if (status === "REJECTED") user.rejectionReason = rejectionReason || "Incomplete documentation";

        await user.save();

        // 🔱 Also update any pending bookings for this user
        const newDocStatus = status === "APPROVED" ? "Approved" : "Rejected";
        const mongoose = require("mongoose");
        const objectId = new mongoose.Types.ObjectId(id);
        
        const pendingBookings = await Booking.find({ userId: objectId, documentStatus: "Pending" });
        
        for (const booking of pendingBookings) {
            booking.documentStatus = newDocStatus;
            booking.status = newDocStatus === "Rejected" ? "Cancelled" : booking.status;
            await booking.save();

            // 🛰️ Real-time Sync-Bridge
            const io = (global as any).io;
            if (io) {
                const roomId = booking._id.toString();
                io.to(roomId).emit("bookingStatusUpdate", {
                    bookingId: roomId,
                    documentStatus: booking.documentStatus,
                    status: booking.status
                });
            }
        }

        res.json({ message: `User identity ${status.toLowerCase()} successfully`, user });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// 🔱 Admin: Fetch ALL vehicles in fleet (not just pending)
export const getAllCars = async (req: Request, res: Response) => {
    try {
        const cars = await Car.find({}).populate("ownerId", "name email");
        res.json(cars);
    } catch (error) {
        res.status(500).json({ message: "Error fetching fleet registry" });
    }
};

// 🔱 Admin: Liquidation - Delete User
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await User.findByIdAndDelete(id);
        res.json({ message: "User account scrubbed from registry 🛡️" });
    } catch (error) {
        res.status(500).json({ message: "Error during user liquidation" });
    }
};

// 🔱 Admin: Liquidation - Delete Car
export const deleteCar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await Car.findByIdAndDelete(id);
        res.json({ message: "Asset decommissioned successfully 🔋" });
    } catch (error) {
        res.status(500).json({ message: "Error during asset decommissioning" });
    }
};

// 🔱 Admin: Sovereign Override - Change User Role
export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        if (!["user", "host", "admin", "customer"].includes(role)) return res.status(400).json({ message: "Invalid Role" });
        await User.findByIdAndUpdate(id, { role });
        res.json({ message: `User credentials updated to: ${role} 🎖️` });
    } catch (error) {
        res.status(500).json({ message: "Error updating role" });
    }
};

// 🔱 Admin: Sovereign Override - Block/Unblock User
export const toggleBlockUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({ message: `Access ${user.isBlocked ? "Revoked (Blocked)" : "Restored (Unblocked)"} 🛡️`, isBlocked: user.isBlocked });
    } catch (error) {
        res.status(500).json({ message: "Error toggling block status" });
    }
};

// 🔱 Admin: Sovereign Override - Change Booking Status
export const updateBookingStatusAdmin = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await Booking.findByIdAndUpdate(id, { status });
        res.json({ message: `Transaction status overridden: ${status} 🛡️` });
    } catch (error) {
        res.status(500).json({ message: "Error overriding status" });
    }
};

// 🔱 Admin: Vehicle Verification
export const getPendingVehicles = async (req: Request, res: Response) => {
    try {
        const cars = await Car.find({
            status: "PENDING",
            $or: [
                { rcFrontUrl: { $ne: "" } },
                { rcBackUrl: { $ne: "" } }
            ]
        }).populate("ownerId", "name email");
        res.json(cars);
    } catch (error) {
        res.status(500).json({ message: "Error fetching pending vehicles" });
    }
};

export const verifyVehicle = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        const vehicle = await Car.findById(id);
        if (!vehicle) return res.status(404).json({ message: "Asset not found" });

        vehicle.status = status;
        if (status === "REJECTED") vehicle.rejectionReason = rejectionReason || "Missing RC/Insurance clarity";

        await vehicle.save();
        res.json({ message: `Vehicle status updated to ${status}`, vehicle });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
